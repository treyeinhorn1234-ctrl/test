import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel/PixelCanvas';
import { buildSpriteSheet, type ClipDef, type SpriteSheet } from '../../entities/animation/SpriteSheet';
import { drawSmear, polar, solveLeg, type Vec2 } from './rigUtils';

/**
 * Squelette gardien des cryptes — sprite procédural 48×48 regardant à droite.
 * Épée rouillée, bouclier de bois cerclé de fer, orbites d'un bleu spectral.
 * L'animation « rise » (surgir du sol) est la mort jouée à l'envers.
 */
export interface SkeletonPose {
  bob: number;
  lean: number;
  fFx: number;
  fFy: number;
  fBx: number;
  fBy: number;
  arm: number;
  sword: number;
  /** 0 = bouclier au flanc, 1 = levé en garde. */
  shield: number;
  smear: number;
  smearFrom: number;
  smearTo: number;
  /** Lueur des orbites (1 = télégraphie une attaque). */
  eyes: number;
  /** 0..1 : effondrement ; >1 : tas d'os. */
  collapse: number;
}

const G = 44;
const CX = 22;

const BASE: SkeletonPose = {
  bob: 0, lean: 0, fFx: 2, fFy: 0, fBx: -2, fBy: 0,
  arm: 1.2, sword: 0.9, shield: 0,
  smear: 0, smearFrom: 0, smearTo: 0, eyes: 0.5, collapse: 0,
};
const P = (o: Partial<SkeletonPose>): SkeletonPose => ({ ...BASE, ...o });

function bone(c: PixelCanvas, a: Vec2, b: Vec2, front: boolean): void {
  c.line(a.x, a.y, b.x, b.y, front ? PAL.bone2 : PAL.bone1, 2);
  c.px(a.x, a.y, front ? PAL.bone3 : PAL.bone2);
  c.px(b.x, b.y, front ? PAL.bone3 : PAL.bone2);
}

function leg(c: PixelCanvas, hip: Vec2, foot: Vec2, front: boolean): void {
  const knee = solveLeg(hip, foot, 6, 6.5);
  bone(c, hip, knee, front);
  bone(c, knee, { x: foot.x, y: foot.y - 1 }, front);
  c.rect(foot.x - 1, foot.y - 1, 4, 1, front ? PAL.bone1 : PAL.bone0);
}

function skull(c: PixelCanvas, e: PixelCanvas, h: Vec2, eyes: number): void {
  const x = Math.round(h.x);
  const y = Math.round(h.y);
  c.rect(x - 3, y - 3, 7, 5, PAL.bone2);
  c.rect(x - 2, y - 4, 5, 1, PAL.bone2);
  c.rect(x - 3, y - 3, 2, 4, PAL.bone3);
  c.rect(x - 1, y + 2, 5, 2, PAL.bone1); // mâchoire
  c.px(x, y + 2, PAL.ink);
  c.px(x + 2, y + 2, PAL.ink);
  // Orbites.
  c.rect(x, y - 1, 2, 2, PAL.ink);
  c.rect(x + 3, y - 1, 1, 2, PAL.ink);
  const eyeCol = eyes > 0.8 ? PAL.soulBlue2 : PAL.soulBlue;
  c.px(x + 1, y, eyeCol);
  e.px(x + 1, y, eyeCol);
  if (eyes > 0.8) {
    c.px(x + 3, y, eyeCol);
    e.px(x + 3, y, eyeCol);
    e.px(x + 2, y, PAL.soulBlue);
  }
  // Demi-heaume rouillé.
  c.rect(x - 3, y - 5, 7, 2, PAL.rust1);
  c.rect(x - 4, y - 4, 1, 3, PAL.rust1);
  c.px(x - 1, y - 6, PAL.rust2);
  c.px(x + 1, y - 5, PAL.rust2);
}

function shieldAt(c: PixelCanvas, s: Vec2, front: boolean): void {
  c.ellipse(s.x, s.y, front ? 4 : 3, 5, PAL.wood1);
  c.ellipse(s.x, s.y, front ? 3 : 2, 4, PAL.wood0);
  c.line(s.x - 1, s.y - 4, s.x - 1, s.y + 4, PAL.wood1);
  c.px(s.x, s.y, PAL.rust2);
  c.px(s.x - 1, s.y - 1, PAL.bone2);
  // Cerclage.
  c.line(s.x - (front ? 4 : 3), s.y, s.x + (front ? 4 : 3), s.y, PAL.rust1);
}

function swordAt(c: PixelCanvas, hand: Vec2, a: number): void {
  const tip = polar(hand, a, 14);
  const base = polar(hand, a, 2);
  const perp = { x: -Math.sin(a), y: Math.cos(a) };
  c.line(base.x, base.y, tip.x, tip.y, PAL.rust1, 2);
  c.line(base.x - perp.x * 0.6, base.y - perp.y * 0.6, tip.x, tip.y, PAL.bone1, 1);
  const g = polar(hand, a, 1);
  c.line(g.x - perp.x * 2, g.y - perp.y * 2, g.x + perp.x * 2, g.y + perp.y * 2, PAL.rust0, 1);
  const pm = polar(hand, a + Math.PI, 2);
  c.line(hand.x, hand.y, pm.x, pm.y, PAL.wood1);
}

function drawPile(c: PixelCanvas, e: PixelCanvas, spread: number): void {
  // Tas d'os encore animé d'une faible lueur.
  const s = spread;
  c.line(CX - 7 - s, G - 1, CX + 6 + s, G - 2, PAL.bone1, 2);
  c.line(CX - 4, G - 3, CX + 3 + s, G - 1, PAL.bone2, 2);
  c.line(CX - 2 - s, G - 4, CX - 2, G - 1, PAL.bone1, 1);
  for (let i = 0; i < 3; i++) c.line(CX - 3 + i * 2, G - 5, CX - 2 + i * 2, G - 2, PAL.bone2);
  shieldAt(c, { x: CX - 9 - s, y: G - 3 }, false);
  c.line(CX + 4, G - 1, CX + 16 + s, G - 3, PAL.rust1, 2);
  const sx = CX + 6 + s;
  c.rect(sx - 3, G - 6, 6, 4, PAL.bone2);
  c.rect(sx - 2, G - 2, 4, 1, PAL.bone1);
  c.rect(sx - 1, G - 5, 2, 2, PAL.ink);
  if (s < 2) {
    c.px(sx, G - 4, PAL.soulBlue);
    e.px(sx, G - 4, PAL.soulBlue);
  }
}

function drawSkeleton(p: SkeletonPose, c: PixelCanvas, e: PixelCanvas): void {
  if (p.collapse > 1) {
    drawPile(c, e, (p.collapse - 1) * 3);
    return;
  }
  const slump = p.collapse;
  const hipY = 32 + p.bob + slump * 6;
  const hip: Vec2 = { x: CX, y: hipY };
  const sh: Vec2 = { x: CX + p.lean + slump * 3, y: hipY - 10 + slump * 3 };
  const head: Vec2 = { x: sh.x + 1 + slump * 2, y: sh.y - 5 + slump * 4 };
  const swordJoint = { x: sh.x + 2, y: sh.y + 1 };
  const shieldJoint = { x: sh.x - 2, y: sh.y + 1 };

  if (p.shield < 0.5) shieldAt(c, { x: shieldJoint.x - 3, y: shieldJoint.y + 6 }, false);

  leg(c, { x: hip.x - 1, y: hip.y }, { x: CX + p.fBx, y: G - p.fBy }, false);
  leg(c, { x: hip.x + 1, y: hip.y }, { x: CX + p.fFx, y: G - p.fFy }, true);

  // Bassin + pagne en lambeaux.
  c.rect(hip.x - 3, hip.y - 1, 7, 2, PAL.bone1);
  c.poly([[hip.x - 3, hip.y], [hip.x + 3, hip.y], [hip.x + 2, hip.y + 6], [hip.x, hip.y + 4], [hip.x - 2, hip.y + 6]], PAL.blood0);
  // Colonne et cage thoracique.
  c.line(hip.x, hip.y - 1, sh.x, sh.y, PAL.bone1, 2);
  for (let i = 0; i < 4; i++) {
    const t = i / 4;
    const rx = sh.x + (hip.x - sh.x) * t * 0.6;
    const ry = sh.y + 1 + i * 2;
    const w = 7 - Math.abs(i - 1);
    c.line(rx - w / 2, ry, rx + w / 2, ry, i % 2 ? PAL.bone1 : PAL.bone2);
  }
  c.line(sh.x - 4, sh.y, sh.x + 4, sh.y, PAL.bone2);

  skull(c, e, head, p.eyes);

  if (p.smear > 0) {
    drawSmear(c, e, swordJoint, p.smearFrom, p.smearTo, 6, 21,
      { edge: PAL.soulBlue2, core: PAL.soulBlue, faint: PAL.bone2 }, p.smear);
  }

  const hand = polar(swordJoint, p.arm, 6);
  swordAt(c, hand, p.sword);
  bone(c, swordJoint, hand, true);

  if (p.shield >= 0.5) {
    const sj = { x: sh.x + 4, y: sh.y + 4 };
    c.line(shieldJoint.x, shieldJoint.y, sj.x, sj.y, PAL.bone1, 2);
    shieldAt(c, sj, true);
  }
}

function walk(count: number): SkeletonPose[] {
  return Array.from({ length: count }, (_, i) => {
    const ph = (i / count) * Math.PI * 2;
    return P({
      fFx: Math.round(Math.cos(ph) * 3),
      fFy: Math.round(Math.max(0, Math.sin(ph)) * 2),
      fBx: Math.round(-Math.cos(ph) * 3),
      fBy: Math.round(Math.max(0, -Math.sin(ph)) * 2),
      bob: Math.round(Math.abs(Math.sin(ph))),
      lean: 1,
      arm: 1.1 + Math.sin(ph) * 0.2,
    });
  });
}

const DEATH: SkeletonPose[] = [
  P({ lean: -2, eyes: 1, arm: 1.6, sword: 1.9 }),
  P({ collapse: 0.35, arm: 1.7, sword: 2.2, eyes: 0.6 }),
  P({ collapse: 0.7, arm: 1.9, sword: 2.4, eyes: 0.3 }),
  P({ collapse: 1.05 }),
  P({ collapse: 1.4 }),
  P({ collapse: 1.7 }),
];

export const SKELETON_CLIPS: ClipDef<SkeletonPose>[] = [
  { name: 'idle', fps: 4, loop: true, frames: [0, 1, 2, 3].map((i) => P({ bob: [0, 1, 1, 0][i], arm: [1.2, 1.25, 1.3, 1.25][i] })) },
  { name: 'walk', fps: 9, loop: true, frames: walk(6), events: { 0: 'rattle', 3: 'rattle' } },
  {
    name: 'windup', fps: 8, loop: false,
    frames: [
      P({ arm: -0.6, sword: -1.4, lean: -1, eyes: 0.9 }),
      P({ arm: -1.4, sword: -2.2, lean: -2, eyes: 1 }),
      P({ arm: -1.6, sword: -2.5, lean: -2, eyes: 1, bob: -1 }),
    ],
  },
  {
    name: 'attack', fps: 14, loop: false,
    frames: [
      P({ arm: -0.2, sword: -0.3, lean: 2, fFx: 5, smear: 1, smearFrom: -2.5, smearTo: -0.3, eyes: 1 }),
      P({ arm: 0.7, sword: 0.9, lean: 3, fFx: 5, smear: 1, smearFrom: -1.2, smearTo: 0.9, eyes: 1 }),
      P({ arm: 0.9, sword: 1.2, lean: 2, fFx: 5, eyes: 0.7 }),
    ],
  },
  { name: 'recover', fps: 6, loop: false, frames: [P({ arm: 1.0, sword: 1.3, lean: 1, fFx: 4 }), P({ arm: 1.1, sword: 1.0 })] },
  { name: 'block', fps: 8, loop: false, frames: [P({ shield: 1, lean: -1, arm: 1.4, sword: 1.7 }), P({ shield: 1, lean: -1, arm: 1.4, sword: 1.7, bob: 1 })] },
  { name: 'hurt', fps: 10, loop: false, frames: [P({ lean: -3, arm: 1.7, sword: 2.0, eyes: 1 }), P({ lean: -2, arm: 1.5, sword: 1.7, fFx: 1 })] },
  { name: 'death', fps: 10, loop: false, frames: DEATH, events: { 3: 'collapse' } },
  { name: 'rise', fps: 8, loop: false, frames: [...DEATH].reverse(), events: { 0: 'rattle' } },
];

let cached: SpriteSheet | null = null;

export function getSkeletonSheet(): SpriteSheet {
  if (!cached) {
    cached = buildSpriteSheet<SkeletonPose>({
      frameW: 48,
      frameH: 48,
      pivotX: CX,
      pivotY: G,
      outline: PAL.ink,
      clips: SKELETON_CLIPS,
      draw: (pose, c, e) => drawSkeleton(pose, c, e),
    });
  }
  return cached;
}
