import type { PixelCanvas } from '../pixel/PixelCanvas';
import { buildSpriteSheet, type ClipDef, type SpriteSheet } from '../../entities/animation/SpriteSheet';
import { Mask, crescent, flames, knee, paint, polar, sampleKeys, type Pt, type Tones } from './frontRig';

/**
 * Squelette gardien — même direction artistique que Varyn : vue de face 3/4
 * (regard vers la gauche), frames 96×88, os ombrés en volume, demi-heaume et
 * épaulière rouillés, pagne en lambeaux, épée ébréchée, bouclier cerclé de fer
 * et flammes spectrales bleues dans les orbites. Versions « @back » vue de dos.
 * L'animation « rise » (surgir du sol) est la mort jouée à l'envers.
 */
export interface SkeletonPose {
  bob: number;
  lean: number;
  crouch: number;
  fLx: number;
  fLy: number;
  fRx: number;
  fRy: number;
  armA: number;
  swordA: number;
  offA: number;
  /** 0 = bouclier au flanc, 1 = levé en garde. */
  shield: number;
  smear: number;
  smearFrom: number;
  smearTo: number;
  /** Lueur des orbites (1 = télégraphie une attaque). */
  eyes: number;
  flame: number;
  /** 0..1 : effondrement ; >1 : tas d'os. */
  collapse: number;
  back: number;
}

const W = 96;
const H = 88;
const G = 80;
const CX = 48;
const BLADE = 23;

const INK = 0x07050b;
const BONE: Tones = { rim: 0xf2e8cf, hi: 0xd8cba8, base: 0xb4a684, dark: 0x857a60, shadow: 0x4a4234 };
const BONE_DIM: Tones = { rim: 0xc9bc9c, hi: 0xa89b7c, base: 0x8c8064, dark: 0x6a604a, shadow: 0x3a3428 };
const RUST: Tones = { rim: 0x8e8a98, hi: 0x56525f, base: 0x3d3a46, dark: 0x2a2731, shadow: 0x14121a, engrave: 0x9a6442 };
const CLOTH: Tones = { rim: 0x74403c, hi: 0x52282a, base: 0x3c1b1f, dark: 0x2a1216, shadow: 0x15080b };
const WOOD: Tones = { rim: 0x7e5c3a, hi: 0x5c4128, base: 0x46311f, dark: 0x312114, shadow: 0x190f08 };
const SPECTRAL: [number, number, number] = [0x1c6cc4, 0x52c6ff, 0xd0f4ff];

const BASE: SkeletonPose = {
  bob: 0, lean: 0, crouch: 0, fLx: 0, fLy: 0, fRx: 0, fRy: 0,
  armA: 1.95, swordA: 2.3, offA: 1.3, shield: 0,
  smear: 0, smearFrom: 0, smearTo: 0, eyes: 0.5, flame: 0.5, collapse: 0, back: 0,
};

function bone(c: PixelCanvas, a: Pt, b: Pt, r: number, tones = BONE): void {
  paint(c, new Mask(W, H).capsule(a, b, r, r * 0.9), tones);
  paint(c, new Mask(W, H).ellipse(b.x, b.y, r + 0.9, r + 0.9), tones);
}

function drawLeg(c: PixelCanvas, hip: Pt, foot: Pt, greave: boolean, tones: Tones): void {
  const k = knee(hip, foot, 8, 8.5, -1);
  const ankle = { x: foot.x, y: foot.y - 2 };
  bone(c, hip, k, 1.9, tones);
  bone(c, k, ankle, 1.7, tones);
  if (greave) paint(c, new Mask(W, H).capsule({ x: k.x, y: k.y + 2 }, { x: ankle.x, y: ankle.y - 1 }, 2.8, 2.4), RUST, { engraveAt: 2 });
  paint(c, new Mask(W, H).poly([
    { x: ankle.x - 2, y: ankle.y - 1 }, { x: ankle.x + 2, y: ankle.y - 1 }, { x: ankle.x + 2, y: foot.y }, { x: ankle.x - 6, y: foot.y }, { x: ankle.x - 5, y: foot.y - 2 },
  ]), tones);
}

function drawShield(c: PixelCanvas, at: Pt, front: boolean): void {
  const rx = front ? 8 : 5.5;
  paint(c, new Mask(W, H).ellipse(at.x, at.y, rx + 1.5, 10.5), RUST);
  paint(c, new Mask(W, H).ellipse(at.x, at.y, rx, 9), WOOD);
  for (const dx of [-rx * 0.45, rx * 0.2]) c.line(at.x + dx, at.y - 8, at.x + dx, at.y + 8, WOOD.shadow);
  // Fissure et clous.
  c.line(at.x - 2, at.y - 7, at.x + 1, at.y - 2, WOOD.shadow);
  c.line(at.x + 1, at.y - 2, at.x - 1, at.y + 3, WOOD.shadow);
  for (const [dx, dy] of [[-rx + 1.5, 0], [rx - 1.5, 0], [0, -8], [0, 8]]) c.px(at.x + dx, at.y + dy, RUST.rim);
  paint(c, new Mask(W, H).ellipse(at.x, at.y, 2.6, 2.6), RUST);
}

function drawSword(c: PixelCanvas, hand: Pt, a: number): Mask {
  const dir = { x: Math.cos(a), y: Math.sin(a) };
  const perp = { x: -dir.y, y: dir.x };
  const at = (d: number, s = 0): Pt => ({ x: hand.x + dir.x * d + perp.x * s, y: hand.y + dir.y * d + perp.y * s });
  const blade = new Mask(W, H).poly([at(3, 2.4), at(3, -2.4), at(BLADE - 4, -2), at(BLADE, 0), at(BLADE - 4, 2)]);
  // Ébréchures.
  for (const d of [9, 15]) {
    const n = at(d, 2);
    blade.data[Math.round(n.y) * W + Math.round(n.x)] = 0;
  }
  paint(c, blade, { rim: 0xb8aa98, hi: 0x7a6a5a, base: 0x5a4a3c, dark: 0x3e3228, shadow: 0x1c150f });
  for (let d = 4; d < BLADE - 3; d += 3) {
    const r = at(d, 0);
    c.px(r.x, r.y, RUST.hi);
  }
  paint(c, new Mask(W, H).poly([at(2, 5), at(1, 4), at(1, -4), at(2, -5), at(3, 0)]), RUST);
  paint(c, new Mask(W, H).capsule(at(-4), at(1), 1.3), WOOD);
  return blade;
}

function drawSkull(c: PixelCanvas, e: PixelCanvas, h: Pt, p: SkeletonPose, back: boolean): void {
  const x = h.x, y = h.y;
  paint(c, new Mask(W, H).ellipse(x, y, 6.2, 5.8), BONE);
  if (!back) {
    // Mâchoire, dents.
    paint(c, new Mask(W, H).poly([{ x: x - 4, y: y + 3 }, { x: x + 3, y: y + 3 }, { x: x + 2, y: y + 7 }, { x: x - 3, y: y + 7 }]), BONE_DIM);
    for (let i = -3; i <= 2; i += 1) c.px(x + i, y + 4, i % 2 ? 0x2a2218 : BONE.rim);
    // Orbites et cavité nasale.
    for (const ox of [-3.5, 1.5]) {
      const m = new Mask(W, H).ellipse(x + ox, y, 1.9, 2);
      for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (m.get(xx, yy)) c.px(xx, yy, 0x0a0608);
    }
    c.px(x - 1, y + 2, 0x0a0608);
    c.px(x - 1, y + 3, 0x2a2218);
    const eye = p.eyes > 0.8 ? SPECTRAL[2] : SPECTRAL[1];
    for (const ox of [-4, 1]) {
      c.px(x + ox, y, eye);
      e.px(x + ox, y, eye);
      if (p.eyes > 0.8) {
        c.px(x + ox + 1, y, SPECTRAL[1]);
        e.px(x + ox + 1, y, SPECTRAL[1]);
        e.px(x + ox, y - 1, SPECTRAL[0]);
      }
    }
  } else {
    c.line(x - 3, y + 1, x + 3, y + 1, BONE.dark);
  }
  // Demi-heaume rouillé avec nasal et crête cabossée.
  const helm = new Mask(W, H).ellipse(x, y - 2, 6.8, 5);
  for (let yy = Math.round(y - 2); yy < H; yy++) for (let xx = 0; xx < W; xx++) helm.data[yy * W + xx] = 0;
  paint(c, helm, RUST, { engraveAt: 2 });
  if (!back) paint(c, new Mask(W, H).rect(Math.round(x - 1), Math.round(y - 2), 2, 4), RUST);
  paint(c, new Mask(W, H).poly([{ x: x - 2, y: y - 6 }, { x: x - 1, y: y - 11 }, { x: x + 2, y: y - 6 }]), RUST);
}

function drawPile(c: PixelCanvas, e: PixelCanvas, spread: number, flame: number): void {
  const s = spread;
  drawShield(c, { x: CX + 12 + s, y: G - 4 }, false);
  drawSword(c, { x: CX - 4, y: G - 3 }, Math.PI - 0.08);
  bone(c, { x: CX - 9 - s, y: G - 2 }, { x: CX + 3, y: G - 3 }, 1.7);
  bone(c, { x: CX - 3, y: G - 6 }, { x: CX + 8 + s, y: G - 2 }, 1.7);
  bone(c, { x: CX + 2, y: G - 1 }, { x: CX + 10, y: G - 5 }, 1.5, BONE_DIM);
  // Cage thoracique écrasée.
  for (let i = 0; i < 4; i++) bone(c, { x: CX - 6 + i * 3, y: G - 7 }, { x: CX - 5 + i * 3, y: G - 2 }, 1, BONE_DIM);
  paint(c, new Mask(W, H).poly([{ x: CX - 6, y: G - 3 }, { x: CX + 4, y: G - 3 }, { x: CX + 2, y: G }, { x: CX - 8, y: G }]), CLOTH);
  const sk = { x: CX - 12 - s * 2, y: G - 5 };
  paint(c, new Mask(W, H).ellipse(sk.x, sk.y, 5, 4.5), BONE);
  for (const ox of [-2, 2]) c.px(sk.x + ox, sk.y, 0x0a0608);
  if (flame > 0.05) {
    c.px(sk.x - 2, sk.y, SPECTRAL[1]);
    e.px(sk.x - 2, sk.y, SPECTRAL[1]);
  }
}

function drawSkeleton(p: SkeletonPose, c: PixelCanvas, e: PixelCanvas, frame: number, row: number): void {
  const seed = frame * 17 + row * 89;
  if (p.collapse > 1) {
    drawPile(c, e, (p.collapse - 1) * 3, p.flame);
    c.outline(INK);
    flames(c, e, null, seed, p.flame, SPECTRAL, 0.05);
    return;
  }
  const back = p.back > 0.5;
  const mx = back ? -1 : 1;
  const mirror = (a: number) => (back ? Math.PI - a : a);
  const slump = p.collapse;
  const hip = { x: CX - p.lean * 0.4 + slump * 2, y: G - 17 + p.bob + p.crouch + slump * 8 };
  const sh = { x: CX - p.lean - slump * 3, y: hip.y - 15 + slump * 4 };
  const head = { x: sh.x - 1 - slump * 2, y: sh.y - 9 + slump * 5 };
  const swordJ = { x: sh.x - 8 * mx, y: sh.y + 1 };
  const offJ = { x: sh.x + 8 * mx, y: sh.y + 1 };
  const swordHand = polar(polar(swordJ, mirror(p.armA), 6), mirror(p.armA + 0.25), 6);
  const offElbow = polar(offJ, mirror(p.offA), 6);
  const offHand = polar(offElbow, mirror(p.offA - 0.3), 6);
  const swordElbow = polar(swordJ, mirror(p.armA), 6);
  let swordMask = new Mask(W, H);

  const shieldSide = { x: offHand.x + 2 * mx, y: offHand.y - 2 };
  if (p.shield < 0.5 && !back) drawShield(c, shieldSide, false);
  if (back) {
    swordMask = drawSword(c, swordHand, mirror(p.swordA));
    if (p.shield < 0.5) drawShield(c, shieldSide, false);
  }

  drawLeg(c, { x: hip.x + 3, y: hip.y }, { x: CX + 5 + p.fRx, y: G - p.fRy }, false, BONE_DIM);
  drawLeg(c, { x: hip.x - 3, y: hip.y }, { x: CX - 5 + p.fLx, y: G - p.fLy }, true, BONE);

  // Bassin et pagne en lambeaux.
  paint(c, new Mask(W, H).poly([{ x: hip.x - 6, y: hip.y - 3 }, { x: hip.x + 6, y: hip.y - 3 }, { x: hip.x + 4, y: hip.y + 2 }, { x: hip.x - 4, y: hip.y + 2 }]), BONE);
  const cloth: Pt[] = [{ x: hip.x - 6, y: hip.y - 2 }, { x: hip.x + 6, y: hip.y - 2 }];
  for (let i = 0; i <= 6; i++) cloth.push({ x: hip.x + 6 - i * 2, y: hip.y + 7 + (i % 2 ? -3 : 1) + (i === 3 ? 3 : 0) });
  paint(c, new Mask(W, H).poly(cloth), CLOTH);

  // Colonne et cage thoracique.
  bone(c, { x: hip.x, y: hip.y - 3 }, { x: sh.x, y: sh.y + 1 }, 1.5, BONE_DIM);
  if (!back) {
    const cage = new Mask(W, H).ellipse(sh.x, sh.y + 6, 7.5, 6.5);
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (cage.get(xx, yy)) c.px(xx, yy, 0x120c0e);
    for (let i = 0; i < 4; i++) {
      const y = sh.y + 2 + i * 3;
      const w = 7 - Math.abs(i - 1) * 0.8;
      for (const s of [-1, 1]) bone(c, { x: sh.x + s * 1, y }, { x: sh.x + s * w, y: y + 2 }, 0.9);
    }
    bone(c, { x: sh.x, y: sh.y + 1 }, { x: sh.x, y: sh.y + 10 }, 1.1);
  } else {
    for (const s of [-1, 1]) paint(c, new Mask(W, H).ellipse(sh.x + s * 4, sh.y + 4, 3.5, 4), BONE_DIM);
    bone(c, { x: sh.x, y: sh.y }, { x: sh.x, y: sh.y + 12 }, 1.3);
  }
  // Clavicules.
  bone(c, { x: swordJ.x, y: swordJ.y }, { x: offJ.x, y: offJ.y }, 1.2);

  // Bras.
  bone(c, offJ, offElbow, 1.5);
  bone(c, offElbow, offHand, 1.3);
  bone(c, swordJ, swordElbow, 1.5);
  bone(c, swordElbow, swordHand, 1.3);
  // Épaulière rouillée côté épée + lambeau sur l'autre épaule.
  paint(c, new Mask(W, H).poly([{ x: swordJ.x - 1 * mx, y: swordJ.y - 6 }, { x: swordJ.x - 7 * mx, y: swordJ.y - 9 }, { x: swordJ.x - 5 * mx, y: swordJ.y - 2 }]), RUST);
  paint(c, new Mask(W, H).ellipse(swordJ.x, swordJ.y, 5.5, 4), RUST, { engraveAt: 2 });
  paint(c, new Mask(W, H).poly([{ x: offJ.x - 3 * mx, y: offJ.y - 2 }, { x: offJ.x + 4 * mx, y: offJ.y - 2 }, { x: offJ.x + 3 * mx, y: offJ.y + 7 }, { x: offJ.x + 1 * mx, y: offJ.y + 4 }, { x: offJ.x - 1 * mx, y: offJ.y + 8 }]), CLOTH);

  drawSkull(c, e, head, p, back);

  if (!back) swordMask = drawSword(c, swordHand, mirror(p.swordA));
  paint(c, new Mask(W, H).ellipse(swordHand.x, swordHand.y, 1.8, 1.8), BONE);
  if (p.shield >= 0.5) drawShield(c, { x: sh.x + 4 * mx, y: sh.y + 7 }, true);

  c.outline(INK);
  // Flammes spectrales : orbites, épée (lors de la télégraphie), aura légère.
  const headRegion = new Mask(W, H).ellipse(head.x - 1, head.y - 1, 8, 7);
  flames(c, e, headRegion, seed, p.flame * (0.9 + p.eyes * 0.7), SPECTRAL, 0.3);
  flames(c, e, null, seed + 3, p.flame * 0.9, SPECTRAL, 0.05);
  if (p.eyes > 0.8) flames(c, e, swordMask, seed + 9, 0.8, SPECTRAL, 0.35);
  if (p.smear > 0) {
    crescent(c, e, swordJ, mirror(p.smearFrom), mirror(p.smearTo), 9, 12 + BLADE + 1, { edge: 0xe6faff, core: 0x5cc8ff, faint: 0x1c6cc4 }, p.smear);
  }
}

// ------------------------------------------------------------- animations

function walk(n: number): SkeletonPose[] {
  return Array.from({ length: n }, (_, i) => {
    const ph = (i / n) * Math.PI * 2;
    return {
      ...BASE,
      fLx: Math.round(-Math.cos(ph) * 3.5),
      fLy: Math.round(Math.max(0, Math.sin(ph)) * 3),
      fRx: Math.round(Math.cos(ph) * 3.5),
      fRy: Math.round(Math.max(0, -Math.sin(ph)) * 3),
      bob: Math.round(Math.abs(Math.sin(ph)) * 1.4),
      lean: 2,
      armA: 1.85 + Math.sin(ph) * 0.15,
      swordA: 2.2 + Math.sin(ph) * 0.1,
      offA: 1.3 - Math.sin(ph) * 0.15,
    };
  });
}

const DEATH = sampleKeys(BASE, [
  { t: 0, p: { lean: -3, eyes: 1, armA: 1.6, swordA: 1.4, flame: 0.9 } },
  { t: 0.2, p: { collapse: 0.4, armA: 1.7, swordA: 1.2, eyes: 0.6, flame: 0.6 } },
  { t: 0.4, p: { collapse: 0.85, armA: 1.9, swordA: 1.0, eyes: 0.3, flame: 0.4 } },
  { t: 0.55, p: { collapse: 1.05, flame: 0.3 } },
  { t: 1, p: { collapse: 1.7, flame: 0.1 } },
], 8);

const CLIPS_FRONT: ClipDef<SkeletonPose>[] = [
  {
    name: 'idle', fps: 6, loop: true,
    frames: sampleKeys(BASE, [
      { t: 0, p: {} },
      { t: 0.5, p: { bob: 1, armA: 2.02, swordA: 2.35, offA: 1.38, flame: 0.7 } },
      { t: 1, p: {} },
    ], 6, true),
  },
  { name: 'walk', fps: 10, loop: true, frames: walk(8), events: { 0: 'rattle', 4: 'rattle' } },
  {
    name: 'windup', fps: 9, loop: false,
    frames: sampleKeys(BASE, [
      { t: 0, p: { armA: 0.4, swordA: 0.2, lean: -1, eyes: 0.8, flame: 0.8 } },
      { t: 0.6, p: { armA: -0.7, swordA: -1.0, lean: -3, crouch: 1, eyes: 1, flame: 1.1 } },
      { t: 1, p: { armA: -0.9, swordA: -1.25, lean: -3, crouch: 2, bob: -1, eyes: 1, flame: 1.3 } },
    ], 5),
  },
  {
    name: 'attack', fps: 15, loop: false,
    frames: sampleKeys(BASE, [
      { t: 0, p: { armA: -1.6, swordA: -2.1, lean: 0, eyes: 1, smear: 1, smearFrom: -1.0, smearTo: -2.1, flame: 1 } },
      { t: 0.35, p: { armA: -2.9, swordA: -3.4, lean: 3, fLx: -5, eyes: 1, smear: 1, smearFrom: -1.2, smearTo: -3.4, flame: 1 } },
      { t: 0.65, p: { armA: -3.8, swordA: -4.1, lean: 4, fLx: -5, crouch: 2, smear: 0.6, smearFrom: -2.4, smearTo: -4.1, eyes: 0.8 } },
      { t: 1, p: { armA: -4.1, swordA: -4.0, lean: 3, fLx: -4, crouch: 2, eyes: 0.6 } },
    ], 5),
  },
  {
    name: 'recover', fps: 7, loop: false,
    frames: sampleKeys(BASE, [
      { t: 0, p: { armA: 2.15, swordA: 2.25, lean: 3, crouch: 2, fLx: -4 } },
      { t: 1, p: {} },
    ], 4),
  },
  {
    name: 'block', fps: 8, loop: false,
    frames: sampleKeys(BASE, [
      { t: 0, p: { shield: 1, lean: -1, armA: 1.6, swordA: 1.7 } },
      { t: 1, p: { shield: 1, lean: -2, crouch: 2, armA: 1.6, swordA: 1.7, eyes: 0.8 } },
    ], 3),
  },
  {
    name: 'hurt', fps: 10, loop: false,
    frames: sampleKeys(BASE, [
      { t: 0, p: { lean: -4, armA: 1.5, swordA: 1.4, eyes: 1, offA: 0.6 } },
      { t: 1, p: { lean: -1, crouch: 1 } },
    ], 3),
  },
  { name: 'death', fps: 11, loop: false, frames: DEATH, events: { 4: 'collapse' } },
  { name: 'rise', fps: 10, loop: false, frames: [...DEATH].reverse(), events: { 0: 'rattle' } },
];

const WITH_BACK = new Set(['idle', 'walk', 'windup', 'attack', 'recover', 'block']);

export const SKELETON_CLIPS: ClipDef<SkeletonPose>[] = [
  ...CLIPS_FRONT,
  ...CLIPS_FRONT.filter((c) => WITH_BACK.has(c.name)).map((c) => ({
    ...c,
    name: `${c.name}@back`,
    frames: c.frames.map((f) => ({ ...f, back: 1 })),
  })),
];

let cached: SpriteSheet | null = null;

export function getSkeletonSheet(): SpriteSheet {
  if (!cached) {
    cached = buildSpriteSheet<SkeletonPose>({
      frameW: W,
      frameH: H,
      pivotX: CX,
      pivotY: G,
      outline: null,
      facesLeft: true,
      clips: SKELETON_CLIPS,
      draw: (pose, c, e, frame, row) => drawSkeleton(pose, c, e, frame, row),
    });
  }
  return cached;
}
