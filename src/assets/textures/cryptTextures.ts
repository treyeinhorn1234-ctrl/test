import * as THREE from 'three';
import { PAL } from '../palette';
import { PixelCanvas, mixColor, shade } from '../pixel/PixelCanvas';
import { createRng, randInt } from '../../utils/math';

/**
 * Textures pixel art procédurales des Cryptes Oubliées.
 * Densité : 16 px par unité monde (1 tuile = 2 unités = 32 px).
 */
type Rng = () => number;

function noiseFill(c: PixelCanvas, x: number, y: number, w: number, h: number, base: number, rng: Rng, amp = 0.08): void {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const n = (rng() - 0.5) * 2 * amp;
      c.px(x + i, y + j, shade(base, n));
    }
}

function crack(c: PixelCanvas, rng: Rng, x: number, y: number, len: number, color: number): void {
  let cx = x;
  let cy = y;
  for (let i = 0; i < len; i++) {
    c.px(cx, cy, color);
    cx += rng() < 0.6 ? 1 : 0;
    cy += rng() < 0.5 ? 1 : rng() < 0.5 ? -1 : 0;
  }
}

/** Dalle de sol : variant 0 = pierre, 1 = fissurée, 2 = moussue, 3 = gravée. */
export function floorTile(variant: number, seed: number): THREE.Texture {
  const rng = createRng(seed);
  const c = new PixelCanvas(32, 32);
  c.rect(0, 0, 32, 32, PAL.stone0);
  // Découpe en dalles irrégulières.
  const layouts = [
    [[0, 0, 16, 16], [16, 0, 16, 10], [16, 10, 16, 22], [0, 16, 16, 16]],
    [[0, 0, 20, 12], [20, 0, 12, 20], [0, 12, 20, 20], [20, 20, 12, 12]],
    [[0, 0, 32, 14], [0, 14, 12, 18], [12, 14, 20, 18]],
  ];
  const layout = layouts[seed % layouts.length];
  for (const [x, y, w, h] of layout) {
    const base = [PAL.stone2, PAL.stone2, PAL.stone3, mixColor(PAL.stone2, PAL.stone3, 0.5)][randInt(rng, 0, 3)];
    noiseFill(c, x + 1, y + 1, w - 1, h - 1, base, rng, 0.07);
    // Biseau : arête haute éclairée, arête basse sombre.
    c.line(x + 1, y + 1, x + w - 1, y + 1, shade(base, 0.12));
    c.line(x + 1, y + 1, x + 1, y + h - 1, shade(base, 0.06));
    c.line(x + 1, y + h - 1, x + w - 1, y + h - 1, shade(base, -0.25));
    // Usure : quelques pixels clairs / sombres.
    for (let k = 0; k < 4; k++) c.px(x + 2 + rng() * (w - 4), y + 2 + rng() * (h - 4), shade(base, rng() < 0.5 ? -0.2 : 0.15));
  }
  if (variant === 1) {
    crack(c, rng, randInt(rng, 2, 10), randInt(rng, 4, 20), 18, PAL.stone0);
    crack(c, rng, randInt(rng, 14, 22), randInt(rng, 2, 12), 10, PAL.stone0);
  } else if (variant === 2) {
    for (let k = 0; k < 40; k++) {
      const x = Math.floor(rng() * 32);
      const y = Math.floor(rng() * 32);
      const near = c.colorAt(x, y) === PAL.stone0 || rng() < 0.35;
      if (near) c.px(x, y, rng() < 0.5 ? PAL.moss1 : PAL.moss0);
    }
  } else if (variant === 3) {
    // Glyphe effacé de l'ancien empire.
    c.disc(16, 16, 7, shade(PAL.stone2, -0.1));
    c.disc(16, 16, 5.5, PAL.stone3);
    c.line(16, 11, 16, 21, PAL.stone1);
    c.line(12, 14, 20, 18, PAL.stone1);
    c.line(12, 18, 20, 14, PAL.stone1);
    crack(c, rng, 8, 20, 12, PAL.stone0);
  }
  return finalize(c, true);
}

/** Mur de briques : 32 px de large × 64 px de haut (4 unités). */
export function wallTexture(seed: number): THREE.Texture {
  const rng = createRng(seed);
  const c = new PixelCanvas(32, 64);
  c.rect(0, 0, 32, 64, PAL.stone0);
  for (let row = 0; row < 8; row++) {
    const y = row * 8;
    const off = row % 2 === 0 ? 0 : 8;
    for (let bx = -8; bx < 32; bx += 16) {
      const x = bx + off;
      const base = mixColor(PAL.stone2, PAL.stone3, rng() * 0.8);
      // Ombre/encrassement plus fort vers le bas du mur.
      const grime = (row / 8) * 0.25;
      const col = shade(base, -grime);
      for (let j = 1; j < 8; j++)
        for (let i = 1; i < 16; i++) {
          const px = x + i;
          if (px < 0 || px >= 32) continue;
          c.px(px, y + j, shade(col, (rng() - 0.5) * 0.12));
        }
      for (let i = 1; i < 16; i++) if (x + i >= 0 && x + i < 32) c.px(x + i, y + 1, shade(col, 0.14));
      for (let i = 1; i < 16; i++) if (x + i >= 0 && x + i < 32) c.px(x + i, y + 7, shade(col, -0.2));
      // Briques ébréchées.
      if (rng() < 0.3) c.rect(x + 2 + rng() * 10, y + 2, 2, 2, PAL.stone1);
    }
  }
  // Coulures d'humidité et mousse au pied du mur.
  for (let k = 0; k < 3; k++) {
    const x = randInt(rng, 1, 30);
    const len = randInt(rng, 8, 30);
    for (let y = 0; y < len; y++) c.px(x, randInt(rng, 0, 4) + y, shade(c.colorAt(x, y), -0.18));
  }
  for (let x = 0; x < 32; x++) {
    const h = randInt(rng, 0, 4);
    for (let y = 0; y < h; y++) c.px(x, 63 - y, rng() < 0.5 ? PAL.moss0 : PAL.moss1);
  }
  return finalize(c, true);
}

export function wallTopTexture(seed: number): THREE.Texture {
  const rng = createRng(seed);
  const c = new PixelCanvas(32, 32);
  noiseFill(c, 0, 0, 32, 32, PAL.stone1, rng, 0.1);
  for (let k = 0; k < 14; k++) {
    const x = randInt(rng, 0, 29);
    const y = randInt(rng, 0, 29);
    c.rect(x, y, 3, 2, PAL.stone2);
    c.px(x, y, PAL.stone3);
  }
  c.line(0, 0, 31, 0, PAL.stone3);
  c.line(0, 0, 0, 31, PAL.stone3);
  return finalize(c, true);
}

export function pillarTexture(seed: number): THREE.Texture {
  const rng = createRng(seed);
  const c = new PixelCanvas(32, 64);
  for (let x = 0; x < 32; x++) {
    // Cannelures verticales.
    const flute = x % 4;
    const base = flute === 0 ? PAL.stone1 : flute === 1 ? PAL.stone4 : PAL.stone3;
    for (let y = 0; y < 64; y++) c.px(x, y, shade(base, (rng() - 0.5) * 0.1 - (y / 64) * 0.15));
  }
  // Bagues sculptées.
  for (const y of [6, 54]) {
    c.rect(0, y, 32, 3, PAL.stone4);
    c.line(0, y, 31, y, PAL.stone5);
    c.line(0, y + 3, 31, y + 3, PAL.stone0);
  }
  for (let k = 0; k < 3; k++) crack(c, rng, randInt(rng, 0, 28), randInt(rng, 12, 48), 10, PAL.stone0);
  for (let x = 0; x < 32; x++) if (rng() < 0.6) c.px(x, 63 - randInt(rng, 0, 3), PAL.moss1);
  return finalize(c, true);
}

/** Côté de sarcophage avec frise sculptée. */
export function sarcophagusSide(seed: number): THREE.Texture {
  const rng = createRng(seed);
  const c = new PixelCanvas(32, 16);
  noiseFill(c, 0, 0, 32, 16, PAL.stone3, rng, 0.08);
  c.line(0, 0, 31, 0, PAL.stone5);
  c.line(0, 15, 31, 15, PAL.stone1);
  c.rect(2, 4, 28, 8, PAL.stone2);
  for (let x = 4; x < 28; x += 6) {
    c.rect(x, 5, 3, 6, PAL.stone4);
    c.px(x + 1, 6, PAL.stone5);
  }
  return finalize(c, true);
}

/** Couvercle de sarcophage : gisant de chevalier sculpté. */
export function sarcophagusLid(seed: number, broken = false): THREE.Texture {
  const rng = createRng(seed);
  const c = new PixelCanvas(32, 64);
  noiseFill(c, 0, 0, 32, 64, PAL.stone3, rng, 0.07);
  c.rect(0, 0, 32, 1, PAL.stone5);
  c.rect(0, 0, 1, 64, PAL.stone4);
  // Gisant.
  c.ellipse(16, 10, 5, 5, PAL.stone4);
  c.rect(13, 6, 7, 2, PAL.gold0);
  c.poly([[9, 16], [23, 16], [21, 50], [11, 50]], PAL.stone4);
  c.line(16, 18, 16, 52, PAL.stone2);
  c.rect(12, 22, 9, 2, PAL.stone5); // mains jointes
  c.line(16, 16, 16, 58, PAL.stone5); // épée gravée
  c.rect(13, 24, 7, 1, PAL.stone5);
  for (let k = 0; k < 4; k++) crack(c, rng, randInt(rng, 2, 28), randInt(rng, 2, 60), 8, PAL.stone1);
  if (broken) {
    for (let y = 30; y < 64; y++) for (let x = 0; x < 32; x++) if (y > 30 + Math.sin(x * 0.7) * 3) c.clearPx(x, y);
  }
  return finalize(c, true);
}

/** Grande porte scellée : couleur + émission (runes du sceau). */
export function sealedDoor(seed: number): { color: THREE.Texture; emissive: THREE.Texture } {
  const rng = createRng(seed);
  const c = new PixelCanvas(64, 80);
  const e = new PixelCanvas(64, 80);
  noiseFill(c, 0, 0, 64, 80, PAL.stone1, rng, 0.06);
  // Arche.
  c.poly([[6, 80], [6, 24], [14, 10], [32, 4], [50, 10], [58, 24], [58, 80]], PAL.stone3);
  c.poly([[10, 80], [10, 26], [16, 14], [32, 9], [48, 14], [54, 26], [54, 80]], PAL.wood0);
  // Battants de fer.
  c.line(32, 9, 32, 79, PAL.ink, 2);
  for (const y of [24, 46, 68]) {
    c.rect(10, y, 44, 3, PAL.rust0);
    c.line(10, y, 53, y, PAL.rust1);
    for (let x = 13; x < 54; x += 8) c.px(x, y + 1, PAL.bone1);
  }
  // Sceau circulaire et runes.
  const glyph = (x: number, y: number, col: number) => {
    c.px(x, y, col);
    e.px(x, y, col);
  };
  for (let a = 0; a < Math.PI * 2; a += 0.06) {
    glyph(32 + Math.cos(a) * 11, 44 + Math.sin(a) * 11, PAL.void1);
    if (Math.floor(a * 10) % 3 === 0) glyph(32 + Math.cos(a) * 8, 44 + Math.sin(a) * 8, PAL.void2);
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    glyph(32 + Math.cos(a) * 4, 44 + Math.sin(a) * 4, PAL.void3);
    const r0 = { x: 32 + Math.cos(a) * 11, y: 44 + Math.sin(a) * 11 };
    const r1 = { x: 32 + Math.cos(a) * 15, y: 44 + Math.sin(a) * 15 };
    c.line(r0.x, r0.y, r1.x, r1.y, PAL.void1);
    e.line(r0.x, r0.y, r1.x, r1.y, PAL.void1);
  }
  glyph(32, 44, PAL.void3);
  // Chaînes du sceau.
  for (let y = 26; y < 78; y += 3) {
    glyph(16 + (y % 2), y, PAL.void0);
    glyph(48 - (y % 2), y, PAL.void0);
  }
  return { color: finalize(c, true), emissive: finalize(e, true) };
}

function finalize(c: PixelCanvas, srgb: boolean): THREE.Texture {
  const t = c.toTexture(srgb);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}
