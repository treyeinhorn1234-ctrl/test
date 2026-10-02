import * as THREE from 'three';

/**
 * Brume rampante stylisée : plan semi-transparent au ras du sol animé par un
 * bruit fractal, quantifié en paliers pour rester cohérent avec le pixel art.
 */
const vert = /* glsl */ `
varying vec2 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uDensity;
varying vec2 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  // Coordonnées alignées sur la grille de 16 px/unité.
  vec2 p = floor(vWorld * 8.0) / 8.0;
  float n = fbm(p * 0.18 + vec2(uTime * 0.05, uTime * 0.025));
  n += 0.5 * fbm(p * 0.4 - vec2(uTime * 0.04, -uTime * 0.03));
  float a = smoothstep(0.55, 1.1, n);
  a = floor(a * 4.0) / 4.0;
  gl_FragColor = vec4(uColor, a * 0.16 * uDensity);
}
`;

export class GroundMist {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(width: number, depth: number, color: THREE.ColorRepresentation) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uDensity: { value: 1 },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(width / 2, 0.35, depth / 2);
    this.mesh.renderOrder = 4;
  }

  setDensity(d: number): void {
    this.material.uniforms.uDensity.value = d;
    this.mesh.visible = d > 0.01;
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }
}
