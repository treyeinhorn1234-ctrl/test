import * as THREE from 'three';
import { PAL } from '../palette';
import { PixelCanvas, shade } from '../pixel/PixelCanvas';
import { createRng, randInt } from '../../utils/math';

/**
 * Sprites de décor (panneaux verticaux ou décalques au sol) : statues des
 * rois oubliés, flammes, bougies, ossements, bannières profanées.
 */
export interface PropSprite {
  color: THREE.Texture;
  emissive?: THREE.Texture;
  width: number;
  height: number;
  pivotX: number;
  pivotY: number;
}

function pack(c: PixelCanvas, e: PixelCanvas | null, pivotX: number, pivotY: number): PropSprite {
  c.outline(PAL.ink);
  return {
    color: c.toTexture(),
    emissive: e?.toTexture(),
    width: c.width,
    height: c.height,
    pivotX,
    pivotY,
  };
}

/** Statue d'un des rois oubliés — couronne, épée pointe en bas, visage érodé. */
export function kingStatue(seed: number): PropSprite {
  const rng = createRng(seed);
  const c = new PixelCanvas(40, 72);
  const s = (x: number, y: number, w: number, h: number, col: number) => c.rect(x, y, w, h, col);
  // Piédestal.
  s(6, 60, 28, 11, PAL.stone2);
  s(4, 58, 32, 3, PAL.stone4);
  c.line(4, 58, 35, 58, PAL.stone5);
  s(8, 63, 24, 1, PAL.stone1);
  // Corps drapé.
  c.poly([[12, 58], [28, 58], [26, 30], [24, 22], [16, 22], [14, 30]], PAL.stone3);
  c.poly([[12, 58], [16, 58], [17, 26], [16, 22], [14, 30]], PAL.stone4);
  for (let y = 34; y < 58; y += 4) c.line(15 + (y % 8 ? 1 : 0), y, 25, y + 2, PAL.stone2);
  // Épaules, tête, couronne.
  s(13, 21, 14, 4, PAL.stone4);
  c.ellipse(20, 15, 4, 5, PAL.stone4);
  c.rect(17, 14, 2, 1, PAL.stone1);
  c.rect(21, 14, 2, 1, PAL.stone1);
  s(16, 9, 9, 2, PAL.gold0);
  for (const x of [16, 19, 22, 24]) c.px(x, 8, PAL.gold0);
  c.px(19, 7, PAL.gold1);
  // Mains sur la garde de l'épée (pointe au sol).
  s(18, 30, 5, 3, PAL.stone5);
  c.line(20, 33, 20, 57, PAL.stone5, 2);
  c.line(16, 32, 24, 32, PAL.stone4, 1);
  // Érosion, fissures, mousse.
  for (let k = 0; k < 5; k++) {
    let x = randInt(rng, 13, 27);
    let y = randInt(rng, 12, 55);
    for (let i = 0; i < 7; i++) {
      c.px(x, y, PAL.stone1);
      x += rng() < 0.5 ? 1 : -1;
      y += 1;
    }
  }
  for (let k = 0; k < 30; k++) {
    const x = randInt(rng, 4, 35);
    const y = randInt(rng, 50, 70);
    if (c.alphaAt(x, y) > 0) c.px(x, y, rng() < 0.5 ? PAL.moss1 : PAL.moss2);
  }
  // Inscription effacée sur le piédestal.
  for (let x = 10; x < 30; x += 2) if (rng() < 0.7) c.px(x, 66, PAL.stone1);
  return pack(c, null, 20, 70);
}

/** Flamme animée (4 frames empilées horizontalement), entièrement émissive. */
export function flameSheet(): PropSprite & { frames: number } {
  const frames = 4;
  const w = 10;
  const h = 16;
  const c = new PixelCanvas(w * frames, h);
  const e = new PixelCanvas(w * frames, h);
  for (let f = 0; f < frames; f++) {
    const ox = f * w;
    const sway = [0, 1, 0, -1][f];
    const tall = [0, 1, 2, 1][f];
    const layers: [number, number, number][] = [
      [PAL.fire0, 4, 9 + tall],
      [PAL.fire1, 3, 7 + tall],
      [PAL.fire2, 2, 5 + tall],
      [PAL.fire3, 1, 3],
    ];
    for (const [col, r, hh] of layers) {
      for (let y = 0; y < hh; y++) {
        const t = y / hh;
        const half = Math.max(0, Math.round(r * (1 - t * t)));
        const cx = ox + 5 + Math.round(sway * t);
        for (let x = cx - half; x <= cx + half - (y % 3 === 2 ? 1 : 0); x++) {
          c.px(x, h - 2 - y, col);
          e.px(x, h - 2 - y, col);
        }
      }
    }
    // Étincelle détachée.
    c.px(ox + 5 - sway, h - 14 - tall, PAL.fire2);
    e.px(ox + 5 - sway, h - 14 - tall, PAL.fire2);
  }
  const color = c.toTexture();
  const emissive = e.toTexture();
  for (const t of [color, emissive]) t.repeat.set(1 / frames, 1);
  return { color, emissive, width: w, height: h, pivotX: 5, pivotY: h - 1, frames };
}

export function candles(seed: number): PropSprite {
  const rng = createRng(seed);
  const c = new PixelCanvas(20, 14);
  const e = new PixelCanvas(20, 14);
  c.ellipse(10, 12, 9, 2, shade(PAL.bone0, -0.3)); // cire fondue
  const n = randInt(rng, 3, 5);
  for (let i = 0; i < n; i++) {
    const x = 3 + Math.floor((i / n) * 14) + randInt(rng, 0, 1);
    const h = randInt(rng, 3, 8);
    c.rect(x, 12 - h, 2, h, PAL.bone2);
    c.px(x, 12 - h, PAL.bone3);
    c.px(x, 11 - h, PAL.fire2);
    c.px(x, 10 - h, PAL.fire3);
    e.px(x, 11 - h, PAL.fire2);
    e.px(x, 10 - h, PAL.fire3);
  }
  return pack(c, e, 10, 13);
}

/** Décalque au sol : ossements épars. */
export function bonesDecal(seed: number): PropSprite {
  const rng = createRng(seed);
  const c = new PixelCanvas(24, 24);
  for (let k = 0; k < 4; k++) {
    const x = randInt(rng, 3, 18);
    const y = randInt(rng, 3, 18);
    const dx = randInt(rng, -5, 5);
    const dy = randInt(rng, -3, 3);
    c.line(x, y, x + dx, y + dy, PAL.bone1);
    c.px(x, y, PAL.bone2);
    c.px(x + dx, y + dy, PAL.bone2);
  }
  if (rng() < 0.6) {
    const x = randInt(rng, 6, 16);
    const y = randInt(rng, 6, 16);
    c.rect(x, y, 4, 3, PAL.bone2);
    c.px(x + 1, y + 1, PAL.ink);
  }
  return pack(c, null, 12, 12);
}

export function rubbleDecal(seed: number): PropSprite {
  const rng = createRng(seed);
  const c = new PixelCanvas(24, 24);
  for (let k = 0; k < 9; k++) {
    const x = randInt(rng, 2, 20);
    const y = randInt(rng, 2, 20);
    const s = randInt(rng, 1, 3);
    c.rect(x, y, s, s, rng() < 0.5 ? PAL.stone3 : PAL.stone4);
    c.px(x, y, PAL.stone5);
  }
  return pack(c, null, 12, 12);
}

/** Bannière de l'empire de Varyn, lacérée par les vainqueurs. */
export function tornBanner(seed: number): PropSprite {
  const rng = createRng(seed);
  const c = new PixelCanvas(18, 44);
  const e = new PixelCanvas(18, 44);
  c.rect(0, 0, 18, 2, PAL.wood1);
  const pts: [number, number][] = [[2, 2], [16, 2], [16, 34]];
  for (let x = 16; x >= 2; x -= 2) pts.push([x, 34 + randInt(rng, 0, 8)]);
  c.poly(pts, PAL.cape1);
  c.rect(2, 2, 2, 36, PAL.cape2);
  // Sigil : couronne brisée sur œil.
  c.ellipse(9, 16, 4, 3, PAL.ink);
  c.px(9, 16, PAL.void1);
  e.px(9, 16, PAL.void0);
  c.line(5, 10, 13, 10, PAL.gold1);
  for (const x of [5, 9, 13]) c.px(x, 9, PAL.gold1);
  // Lacérations.
  for (let k = 0; k < 3; k++) {
    const x = randInt(rng, 4, 13);
    for (let y = randInt(rng, 6, 18); y < 30; y++) if (rng() < 0.85) c.clearPx(x + (y % 5 === 0 ? 1 : 0), y);
  }
  return pack(c, e, 9, 43);
}

/** Cristal abyssal posé sur l'autel. */
export function altarCrystal(): PropSprite {
  const c = new PixelCanvas(16, 24);
  const e = new PixelCanvas(16, 24);
  const pts: [number, number][] = [[8, 0], [13, 9], [10, 23], [6, 23], [3, 9]];
  c.poly(pts, PAL.void1);
  e.poly(pts, PAL.void0);
  c.poly([[8, 0], [8, 23], [6, 23], [3, 9]], PAL.void2);
  e.poly([[8, 0], [8, 23], [6, 23], [3, 9]], PAL.void1);
  c.line(8, 1, 6, 12, PAL.void3);
  e.line(8, 1, 6, 12, PAL.void3);
  return pack(c, e, 8, 23);
}

/** Orbe de sang (soin) déposé par les ennemis. */
export function bloodOrb(): PropSprite {
  const c = new PixelCanvas(10, 10);
  const e = new PixelCanvas(10, 10);
  c.disc(4.5, 4.5, 3.6, PAL.ember0);
  e.disc(4.5, 4.5, 3.6, PAL.ember0);
  c.disc(4, 4, 2, PAL.ember1);
  e.disc(4, 4, 2, PAL.ember1);
  c.px(3, 3, PAL.ember2);
  e.px(3, 3, PAL.ember2);
  return pack(c, e, 5, 9);
}
