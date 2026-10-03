import * as THREE from 'three';

/**
 * Système de particules en pool (aucune allocation pendant le jeu).
 * Chaque particule est un point carré de quelques pixels de jeu — parfaitement
 * net dans le rendu basse résolution. Les couleurs peuvent dépasser 1 (HDR)
 * pour nourrir le halo lumineux du post-traitement.
 */
export interface ParticleSpec {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life: number;
  color: THREE.ColorRepresentation;
  colorEnd?: THREE.ColorRepresentation;
  intensity?: number;
  size?: number;
  sizeEnd?: number;
  gravity?: number;
  drag?: number;
  alpha?: number;
}

const vert = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
#include <fog_pars_vertex>
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  // Taille en texels de décor (2 pixels de rendu par texel).
  gl_PointSize = aSize * 2.0;
  #include <fog_vertex>
}
`;

const frag = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(vColor, vAlpha);
  #include <fog_fragment>
}
`;

export class ParticleSystem {
  readonly points: THREE.Points;
  private readonly capacity: number;
  private alive = 0;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private c0: Float32Array;
  private c1: Float32Array;
  private size: Float32Array;
  private s0: Float32Array;
  private s1: Float32Array;
  private alpha: Float32Array;
  private a0: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private geo: THREE.BufferGeometry;
  /** Multiplicateur de densité (qualité graphique). */
  density = 1;
  private tmp = new THREE.Color();

  constructor(capacity: number, additive: boolean) {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.c0 = new Float32Array(capacity * 3);
    this.c1 = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.s0 = new Float32Array(capacity);
    this.s1 = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.a0 = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);

    const material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      fog: true,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 10 : 5;
  }

  get count(): number {
    return this.alive;
  }

  emit(p: ParticleSpec): void {
    if (this.density < 1 && Math.random() > this.density) return;
    if (this.alive >= this.capacity) return;
    const i = this.alive++;
    const i3 = i * 3;
    this.pos[i3] = p.x;
    this.pos[i3 + 1] = p.y;
    this.pos[i3 + 2] = p.z;
    this.vel[i3] = p.vx ?? 0;
    this.vel[i3 + 1] = p.vy ?? 0;
    this.vel[i3 + 2] = p.vz ?? 0;
    const k = p.intensity ?? 1;
    this.tmp.set(p.color);
    this.c0[i3] = this.tmp.r * k;
    this.c0[i3 + 1] = this.tmp.g * k;
    this.c0[i3 + 2] = this.tmp.b * k;
    this.tmp.set(p.colorEnd ?? p.color);
    this.c1[i3] = this.tmp.r * k;
    this.c1[i3 + 1] = this.tmp.g * k;
    this.c1[i3 + 2] = this.tmp.b * k;
    this.s0[i] = p.size ?? 1;
    this.s1[i] = p.sizeEnd ?? p.size ?? 1;
    this.a0[i] = p.alpha ?? 1;
    this.life[i] = p.life;
    this.maxLife[i] = p.life;
    this.grav[i] = p.gravity ?? 0;
    this.drag[i] = p.drag ?? 0;
  }

  private kill(i: number): void {
    const last = --this.alive;
    if (i === last) return;
    const copy3 = (a: Float32Array) => {
      a[i * 3] = a[last * 3];
      a[i * 3 + 1] = a[last * 3 + 1];
      a[i * 3 + 2] = a[last * 3 + 2];
    };
    copy3(this.pos);
    copy3(this.vel);
    copy3(this.c0);
    copy3(this.c1);
    for (const a of [this.s0, this.s1, this.a0, this.life, this.maxLife, this.grav, this.drag]) a[i] = a[last];
  }

  update(dt: number): void {
    for (let i = 0; i < this.alive; ) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.kill(i);
        continue;
      }
      const i3 = i * 3;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= d;
      this.vel[i3 + 1] = this.vel[i3 + 1] * d - this.grav[i] * dt;
      this.vel[i3 + 2] *= d;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.02) {
        this.pos[i3 + 1] = 0.02;
        this.vel[i3 + 1] *= -0.3;
      }
      const t = 1 - this.life[i] / this.maxLife[i];
      this.col[i3] = this.c0[i3] + (this.c1[i3] - this.c0[i3]) * t;
      this.col[i3 + 1] = this.c0[i3 + 1] + (this.c1[i3 + 1] - this.c0[i3 + 1]) * t;
      this.col[i3 + 2] = this.c0[i3 + 2] + (this.c1[i3 + 2] - this.c0[i3 + 2]) * t;
      this.size[i] = Math.max(1, Math.round(this.s0[i] + (this.s1[i] - this.s0[i]) * t));
      // Fondu d'entrée bref puis sortie.
      this.alpha[i] = this.a0[i] * Math.min(1, t * 8) * (1 - t * t);
      i++;
    }
    this.geo.setDrawRange(0, this.alive);
    for (const name of ['position', 'aColor', 'aSize', 'aAlpha']) {
      (this.geo.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  clear(): void {
    this.alive = 0;
    this.geo.setDrawRange(0, 0);
  }

  dispose(): void {
    this.geo.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
