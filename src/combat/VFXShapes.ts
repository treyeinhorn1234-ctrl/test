import * as THREE from 'three';
import { PixelCanvas } from '../assets/pixel/PixelCanvas';
import { createRng } from '../utils/math';

/**
 * Ressources des effets : arc de taille au sol (shader), éclat d'impact et
 * fissure de sol (textures pixel art procédurales).
 */

/** Arc en croissant posé au sol : grandit vers sa tête puis s'estompe. */
export function createArcMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uStart: { value: 0 },
      uSweep: { value: 1 },
      uProgress: { value: 1 },
      uFade: { value: 1 },
      uInner: { value: 0.45 },
      uScale: { value: 3 },
      uColor: { value: new THREE.Color(0x9a58ff) },
      uEdge: { value: new THREE.Color(0xf0e4ff) },
      uFill: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() { vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uStart, uSweep, uProgress, uFade, uInner, uScale, uFill;
      uniform vec3 uColor, uEdge;
      varying vec2 vPos;
      void main() {
        // Pixelisation à 32 px par unité monde (densité du rendu).
        vec2 q = (floor(vPos * uScale * 32.0) + 0.5) / (uScale * 32.0);
        float r = length(q);
        if (r > 1.0 || r < uInner * 0.6) discard;
        float a = atan(q.y, q.x);
        float s = sign(uSweep);
        float rel = mod((a - uStart) * s, 6.2831853);
        float span = abs(uSweep) * uProgress;
        if (rel > span) discard;
        float t = rel / max(span, 0.001);
        float radial = (r - uInner) / (1.0 - uInner);
        if (uFill > 0.5) {
          // Zone d'attaque télégraphiée : contour + remplissage progressif.
          bool edge = r > 0.93 || rel < 0.06 || rel > span - 0.06;
          vec3 col = edge ? uEdge : uColor * 0.55;
          float al = edge ? 0.9 : (r < uFade ? 0.55 : 0.18);
          gl_FragColor = vec4(col * al, 1.0);
          return;
        }
        // Le croissant s'affine vers la queue.
        if (radial < 1.0 - (0.2 + 0.8 * t)) discard;
        vec3 col = radial > 0.82 ? uEdge * 2.2 : uColor * (0.6 + 1.6 * t);
        float al = floor((0.35 + 0.65 * t) * uFade * 4.0) / 4.0;
        gl_FragColor = vec4(col * al, 1.0);
      }`,
  });
}

/** Éclat d'impact : 4 frames empilées horizontalement (24×24). */
export function impactTexture(): THREE.Texture {
  const f = 4;
  const c = new PixelCanvas(24 * f, 24);
  for (let k = 0; k < f; k++) {
    const ox = k * 24 + 12;
    const len = [5, 10, 11, 9][k];
    const inner = [0, 2, 5, 7][k];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
      const l = i % 2 ? len * 0.65 : len;
      for (let d = inner; d <= l; d++) c.px(ox + Math.cos(a) * d, 12 + Math.sin(a) * d, d > l - 2 ? 0xa0a0a0 : 0xffffff);
    }
    const core = [4, 3, 1.5, 0][k];
    if (core > 0) c.disc(ox, 12, core, 0xffffff);
  }
  const t = c.toTexture();
  t.repeat.set(1 / f, 1);
  return t;
}

/** Fissure lumineuse au sol (onde de choc, coup lourd). */
export function crackTexture(seed: number): THREE.Texture {
  const rng = createRng(seed);
  const c = new PixelCanvas(64, 64);
  const branch = (x: number, y: number, a: number, len: number, depth: number) => {
    for (let i = 0; i < len; i++) {
      a += (rng() - 0.5) * 0.7;
      x += Math.cos(a);
      y += Math.sin(a);
      c.px(x, y, i < len * 0.5 ? 0xffffff : 0x9a9a9a);
      if (depth < 2 && rng() < 0.06) branch(x, y, a + (rng() < 0.5 ? 0.8 : -0.8), len * 0.5, depth + 1);
    }
  };
  for (let i = 0; i < 7; i++) branch(32, 32, (i / 7) * Math.PI * 2 + rng() * 0.4, 18 + rng() * 10, 0);
  c.disc(32, 32, 3, 0xffffff);
  return c.toTexture();
}
