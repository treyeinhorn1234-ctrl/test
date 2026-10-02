import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel/PixelCanvas';
import { buildSpriteSheet, type ClipDef, type SpriteSheet } from '../../entities/animation/SpriteSheet';
import { drawSmear, polar, solveLeg, type Vec2 } from './rigUtils';

/**
 * Varyn, Seigneur des Abysses — sprite procédural 64×64 regardant à droite.
 * Chaque frame est décrite par une pose (angles des bras, de l'épée Eclipse,
 * position des pieds, ondulation de la cape…) puis dessinée en pixel art avec
 * contour automatique. Ajouter une animation = ajouter un ClipDef.
 */
export interface VarynPose {
  bob: number;
  lean: number;
  crouch: number;
  /** Pied avant / arrière : décalage horizontal et levée. */
  fFx: number;
  fFy: number;
  fBx: number;
  fBy: number;
  /** Bras d'épée : angle (y vers le bas) et longueur. */
  arm: number;
  reach: number;
  /** Angle de la lame d'Eclipse. */
  sword: number;
  cape: number;
  flare: number;
  /** Bras libre en griffe (sorts, interactions) : 0 = au repos. */
  claw: number;
  clawA: number;
  clawTrail: number;
  smear: number;
  smearFrom: number;
  smearTo: number;
  runes: number;
  headDown: number;
}

const G = 60; // ligne du sol
const CX = 28; // centre des hanches
const BLADE = 25;

const BASE: VarynPose = {
  bob: 0, lean: 0, crouch: 0,
  fFx: 3, fFy: 0, fBx: -3, fBy: 0,
  arm: 1.0, reach: 7, sword: 1.05,
  cape: 0, flare: 0,
  claw: 0, clawA: 0, clawTrail: 0,
  smear: 0, smearFrom: 0, smearTo: 0,
  runes: 0.5, headDown: 0,
};

const P = (o: Partial<VarynPose>): VarynPose => ({ ...BASE, ...o });

function drawLeg(c: PixelCanvas, hip: Vec2, foot: Vec2, front: boolean): void {
  const knee = solveLeg(hip, foot, 8, 8.5);
  const base = front ? PAL.armor1 : PAL.armor0;
  const hi = front ? PAL.armor3 : PAL.armor1;
  c.line(hip.x, hip.y, knee.x, knee.y, base, 4);
  c.line(knee.x, knee.y, foot.x, foot.y - 1, base, 3);
  // Arête éclairée (lumière venant d'en haut à gauche).
  c.line(hip.x - 1, hip.y, knee.x - 1, knee.y, hi, 1);
  // Genouillère.
  c.rect(knee.x - 1, knee.y - 1, 3, 3, front ? PAL.armor3 : PAL.armor2);
  c.px(knee.x, knee.y - 1, front ? PAL.armor4 : PAL.armor3);
  // Solleret pointé vers l'avant.
  c.rect(foot.x - 2, foot.y - 2, 6, 2, base);
  c.px(foot.x + 4, foot.y - 1, base);
  c.rect(foot.x - 2, foot.y - 2, 4, 1, hi);
}

function drawCape(c: PixelCanvas, sh: Vec2, p: VarynPose): void {
  const sway = p.cape;
  const flare = p.flare;
  const topY = sh.y - 1;
  const bottom = G - 1 - flare * 7;
  const backX = sh.x - 9 - sway * 4 - flare * 9;
  const pts: [number, number][] = [
    [sh.x + 3, topY],
    [sh.x - 6, topY],
    [sh.x - 8 - sway * 2 - flare * 3, topY + 8],
  ];
  // Bord inférieur déchiré : alternance de pointes.
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = backX + (sh.x + 2 - backX) * t;
    const y = bottom + (i % 2 === 0 ? 0 : -3) - t * 2 + (i === 2 ? 2 : 0) + flare * t * 5;
    pts.push([x, y]);
  }
  pts.push([sh.x + 3, topY + 10]);
  c.poly(pts, PAL.cape1);
  // Plis.
  for (let k = 0; k < 3; k++) {
    const fx = sh.x - 5 + k * 3 - sway * (1 + k * 0.5) - flare * (3 - k);
    c.line(sh.x - 3 + k * 2, topY + 3, fx, bottom - 3, PAL.cape0);
  }
  // Rebord éclairé côté dos.
  c.line(sh.x - 6, topY, sh.x - 8 - sway * 2 - flare * 3, topY + 8, PAL.cape3);
  c.line(sh.x - 8 - sway * 2 - flare * 3, topY + 8, backX + 1, bottom - 2, PAL.cape2);
}

function drawSword(c: PixelCanvas, e: PixelCanvas, hand: Vec2, a: number, runes: number): void {
  const dir = { x: Math.cos(a), y: Math.sin(a) };
  const perp = { x: -dir.y, y: dir.x };
  const pommel = polar(hand, a + Math.PI, 3);
  c.line(hand.x, hand.y, pommel.x, pommel.y, PAL.wood1, 2);
  c.px(pommel.x, pommel.y, PAL.gold1);
  // Garde.
  const g = polar(hand, a, 2);
  c.line(g.x - perp.x * 4, g.y - perp.y * 4, g.x + perp.x * 4, g.y + perp.y * 4, PAL.armor3, 2);
  c.px(g.x, g.y, PAL.void2);
  e.px(g.x, g.y, PAL.void2);
  // Lame large et sombre.
  const b0 = polar(hand, a, 3);
  const b1 = polar(hand, a, BLADE - 3);
  const tip = polar(hand, a, BLADE);
  c.line(b0.x, b0.y, b1.x, b1.y, PAL.armor2, 4);
  c.line(b1.x, b1.y, tip.x, tip.y, PAL.armor2, 2);
  // Fil de la lame (éclairé) et gouttière centrale.
  c.line(b0.x + perp.x * -1.5, b0.y + perp.y * -1.5, tip.x, tip.y, PAL.steelEdge, 1);
  c.line(b0.x + perp.x * 1.5, b0.y + perp.y * 1.5, b1.x + perp.x * 1.5, b1.y + perp.y * 1.5, PAL.armor1, 1);
  // Runes abyssales le long de la gouttière.
  for (let i = 5; i < BLADE - 4; i += 3) {
    const r = polar(hand, a, i);
    const col = runes > 0.75 ? PAL.void3 : PAL.void1;
    c.px(r.x, r.y, col);
    if (runes > 0.25) e.px(r.x, r.y, col);
  }
  if (runes > 0.85) {
    c.line(b0.x - perp.x * 1.5, b0.y - perp.y * 1.5, tip.x, tip.y, PAL.void3, 1);
    e.line(b0.x - perp.x * 1.5, b0.y - perp.y * 1.5, tip.x, tip.y, PAL.void2, 1);
  }
}

function drawHead(c: PixelCanvas, e: PixelCanvas, h: Vec2): void {
  const x = Math.round(h.x);
  const y = Math.round(h.y);
  // Cornes : une intacte qui s'enroule vers l'arrière, une brisée.
  c.line(x - 2, y - 4, x - 4, y - 6, PAL.armor3, 2);
  c.line(x - 4, y - 6, x - 5, y - 9, PAL.armor2, 2);
  c.px(x - 5, y - 11, PAL.armor3);
  c.px(x - 4, y - 10, PAL.armor3);
  c.line(x + 2, y - 4, x + 3, y - 6, PAL.armor3, 2);
  c.px(x + 4, y - 7, PAL.armor4); // cassure
  // Heaume.
  c.rect(x - 3, y - 4, 7, 8, PAL.armor1);
  c.rect(x - 2, y - 5, 5, 1, PAL.armor2);
  c.rect(x - 3, y - 4, 2, 6, PAL.armor2); // arrière éclairé
  c.rect(x + 1, y - 3, 3, 6, PAL.armor2); // plaque faciale
  c.px(x + 3, y + 3, PAL.armor1);
  // Couronne brisée en or terni.
  c.rect(x - 3, y - 4, 7, 1, PAL.gold1);
  c.px(x - 2, y - 5, PAL.gold2);
  c.px(x, y - 6, PAL.gold2);
  c.px(x, y - 5, PAL.gold1);
  c.px(x + 2, y - 5, PAL.gold0);
  // Fente du visage et yeux incandescents.
  c.rect(x, y - 1, 4, 1, PAL.ink);
  c.px(x + 1, y - 1, PAL.ember1);
  c.px(x + 3, y - 1, PAL.ember2);
  e.px(x + 1, y - 1, PAL.ember1);
  e.px(x + 3, y - 1, PAL.ember2);
  // Gorgerin.
  c.rect(x - 2, y + 4, 5, 2, PAL.armor0);
}

function drawVaryn(p: VarynPose, c: PixelCanvas, e: PixelCanvas): void {
  const hipY = 44 + p.bob + p.crouch;
  const hip: Vec2 = { x: CX, y: hipY };
  const sh: Vec2 = { x: CX + p.lean, y: hipY - 13 + Math.max(0, p.headDown) * 0.5 };
  const head: Vec2 = { x: sh.x + 1 + p.headDown * 0.6, y: sh.y - 5 + p.headDown };
  const swordJoint: Vec2 = { x: sh.x + 3, y: sh.y + 2 };
  const clawJoint: Vec2 = { x: sh.x - 3, y: sh.y + 2 };

  drawCape(c, sh, p);

  // Jambe arrière.
  drawLeg(c, { x: hip.x - 2, y: hip.y }, { x: CX + p.fBx, y: G - p.fBy }, false);

  // Bras libre au repos (derrière le torse).
  if (p.claw <= 0) {
    const hand = { x: clawJoint.x - 1, y: clawJoint.y + 8 };
    c.line(clawJoint.x, clawJoint.y, hand.x, hand.y, PAL.armor0, 3);
    c.rect(hand.x - 1, hand.y, 3, 2, PAL.armor1);
  }

  drawLeg(c, { x: hip.x + 2, y: hip.y }, { x: CX + p.fFx, y: G - p.fFy }, true);

  // Torse (trapèze penché).
  const torso: [number, number][] = [
    [sh.x - 6, sh.y],
    [sh.x + 6, sh.y],
    [hip.x + 4, hip.y - 2],
    [hip.x - 4, hip.y - 2],
  ];
  c.poly(torso, PAL.armor1);
  c.poly(
    [
      [sh.x - 5, sh.y + 1],
      [sh.x + 1, sh.y + 1],
      [hip.x - 1, hip.y - 6],
      [hip.x - 3, hip.y - 6],
    ],
    PAL.armor2,
  );
  c.line(sh.x - 5, sh.y, sh.x + 5, sh.y, PAL.armor3);
  // Rune de poitrine.
  const runeCol = p.runes > 0.75 ? PAL.void3 : PAL.void1;
  c.line(sh.x + 2, sh.y + 3, sh.x + 2 - p.lean * 0.2, sh.y + 7, runeCol);
  c.px(sh.x + 1, sh.y + 5, runeCol);
  c.px(sh.x + 3, sh.y + 5, runeCol);
  e.line(sh.x + 2, sh.y + 3, sh.x + 2 - p.lean * 0.2, sh.y + 7, runeCol);
  e.px(sh.x + 1, sh.y + 5, runeCol);
  e.px(sh.x + 3, sh.y + 5, runeCol);
  // Ceinture et boucle.
  c.rect(hip.x - 5, hip.y - 3, 10, 2, PAL.armor0);
  c.px(hip.x + 2, hip.y - 3, PAL.void2);
  e.px(hip.x + 2, hip.y - 3, PAL.void1);
  // Tassettes + pan de tissu.
  c.rect(hip.x - 5, hip.y - 1, 3, 3, PAL.armor2);
  c.rect(hip.x + 3, hip.y - 1, 3, 3, PAL.armor2);
  c.poly(
    [
      [hip.x - 1, hip.y - 1],
      [hip.x + 3, hip.y - 1],
      [hip.x + 2 - p.cape, hip.y + 7],
      [hip.x - p.cape, hip.y + 5],
    ],
    PAL.cape1,
  );

  // Épaulière arrière.
  c.ellipse(sh.x - 4, sh.y + 1, 3, 2.5, PAL.armor1);
  c.line(sh.x - 5, sh.y - 1, sh.x - 7, sh.y - 4, PAL.armor2, 1);

  drawHead(c, e, head);

  if (p.smear > 0) {
    drawSmear(c, e, swordJoint, p.smearFrom, p.smearTo, 10, p.reach + BLADE + 1,
      { edge: PAL.void3, core: PAL.void2, faint: PAL.void1 }, p.smear);
  }

  // Bras libre en griffe (devant le torse).
  if (p.claw > 0) {
    const hand = polar(clawJoint, p.clawA, 6 + p.claw * 2);
    c.line(clawJoint.x, clawJoint.y, hand.x, hand.y, PAL.armor1, 3);
    c.rect(hand.x - 1, hand.y - 1, 3, 3, PAL.armor3);
    for (let k = -1; k <= 1; k++) {
      const tip = polar(hand, p.clawA + k * 0.35, 4);
      c.line(hand.x, hand.y, tip.x, tip.y, PAL.void2);
      e.line(hand.x, hand.y, tip.x, tip.y, PAL.void2);
    }
    if (p.clawTrail > 0) {
      for (let k = -1; k <= 1; k++) {
        const s = polar(clawJoint, p.clawA - 1.1 + k * 0.1, 10 + k * 2);
        const t = polar(clawJoint, p.clawA + 0.2 + k * 0.1, 13 + k * 2);
        c.line(s.x, s.y, t.x, t.y, PAL.void3);
        e.line(s.x, s.y, t.x, t.y, PAL.void2);
      }
    }
  }

  // Bras d'épée, Eclipse, épaulière avant.
  const hand = polar(swordJoint, p.arm, p.reach);
  drawSword(c, e, hand, p.sword, p.runes);
  c.line(swordJoint.x, swordJoint.y, hand.x, hand.y, PAL.armor2, 3);
  c.rect(hand.x - 1, hand.y - 1, 3, 3, PAL.armor3);
  c.px(hand.x - 1, hand.y - 1, PAL.armor4);
  c.ellipse(sh.x + 4, sh.y + 1, 4, 3, PAL.armor2);
  c.line(sh.x + 1, sh.y - 1, sh.x + 6, sh.y - 1, PAL.armor4);
  c.line(sh.x + 5, sh.y - 2, sh.x + 8, sh.y - 5, PAL.armor3, 1);
  c.px(sh.x + 8, sh.y - 5, PAL.armor4);
}

function walkFrames(count: number, stride: number, lift: number, extra: Partial<VarynPose>): VarynPose[] {
  const out: VarynPose[] = [];
  for (let i = 0; i < count; i++) {
    const ph = (i / count) * Math.PI * 2;
    out.push(
      P({
        fFx: Math.round(Math.cos(ph) * stride),
        fFy: Math.round(Math.max(0, Math.sin(ph)) * lift),
        fBx: Math.round(-Math.cos(ph) * stride),
        fBy: Math.round(Math.max(0, -Math.sin(ph)) * lift),
        bob: Math.round(Math.abs(Math.sin(ph))),
        cape: 0.3 + Math.sin(ph) * 0.25,
        ...extra,
      }),
    );
  }
  return out;
}

export const VARYN_CLIPS: ClipDef<VarynPose>[] = [
  {
    name: 'idle', fps: 5, loop: true,
    frames: [0, 1, 2, 3].map((i) =>
      P({ bob: [0, 0, 1, 1][i], cape: [0, 0.15, 0.3, 0.15][i], runes: [0.45, 0.6, 0.8, 0.6][i] }),
    ),
  },
  { name: 'walk', fps: 10, loop: true, frames: walkFrames(6, 4, 2, {}), events: { 1: 'step', 4: 'step' } },
  {
    name: 'run', fps: 14, loop: true,
    frames: walkFrames(6, 6, 3, { lean: 2, arm: 1.7, sword: 2.65, flare: 0.5 }),
    events: { 1: 'step', 4: 'step' },
  },
  {
    name: 'attack1', fps: 14, loop: false,
    frames: [
      P({ arm: -1.9, sword: -2.3, lean: -1, cape: 0.2 }),
      P({ arm: -0.6, sword: -0.5, lean: 2, smear: 1, smearFrom: -2.3, smearTo: -0.5 }),
      P({ arm: 0.5, sword: 0.6, lean: 3, fFx: 6, smear: 1, smearFrom: -1.3, smearTo: 0.6 }),
      P({ arm: 0.9, sword: 1.25, lean: 2, fFx: 6, smear: 0.5, smearFrom: 0.1, smearTo: 1.25 }),
      P({ arm: 1.0, sword: 1.2, lean: 1, fFx: 5 }),
    ],
  },
  {
    name: 'attack2', fps: 14, loop: false,
    frames: [
      P({ arm: 1.5, sword: 2.4, crouch: 2, lean: 1 }),
      P({ arm: 0.4, sword: 0.2, lean: 2, fFx: 6, smear: 1, smearFrom: 1.9, smearTo: 0.2 }),
      P({ arm: -0.8, sword: -1.1, lean: 2, fFx: 6, smear: 1, smearFrom: 0.6, smearTo: -1.1 }),
      P({ arm: -1.0, sword: -1.4, lean: 1, fFx: 5, smear: 0.5, smearFrom: -0.5, smearTo: -1.4 }),
      P({ arm: 0.2, sword: 0.5, lean: 1 }),
    ],
  },
  {
    name: 'attack3', fps: 14, loop: false,
    frames: [
      P({ arm: -1.4, sword: -1.9, crouch: 1 }),
      P({ arm: -1.8, sword: -2.6, bob: -2, flare: 0.3, runes: 1, reach: 6 }),
      P({ arm: -0.4, sword: -0.3, bob: -1, lean: 2, smear: 1, smearFrom: -2.6, smearTo: -0.3, runes: 1 }),
      P({ arm: 0.7, sword: 1.0, crouch: 3, lean: 3, fFx: 7, smear: 1, smearFrom: -1.2, smearTo: 1.0, runes: 1 }),
      P({ arm: 0.8, sword: 1.1, crouch: 3, lean: 3, fFx: 7, runes: 0.9 }),
      P({ arm: 0.9, sword: 1.1, crouch: 1, lean: 1, fFx: 5 }),
    ],
  },
  {
    name: 'heavy', fps: 12, loop: false,
    frames: [
      P({ arm: 1.8, sword: 2.7, crouch: 2, lean: -2 }),
      P({ arm: 2.0, sword: 2.9, crouch: 3, lean: -3, runes: 1, flare: 0.3 }),
      P({ arm: 2.0, sword: 2.9, crouch: 3, lean: -3, runes: 1, flare: 0.4, cape: 0.4 }),
      P({ arm: 0.6, sword: 0.4, lean: 3, fFx: 7, runes: 1, smear: 1, smearFrom: 2.9, smearTo: 0.4 }),
      P({ arm: -0.6, sword: -0.8, lean: 4, fFx: 7, runes: 1, smear: 1, smearFrom: 1.2, smearTo: -0.8 }),
      P({ arm: -0.9, sword: -1.2, lean: 3, fFx: 6, smear: 0.5, smearFrom: 0, smearTo: -1.2 }),
      P({ arm: 0.4, sword: 0.8, lean: 1, fFx: 4 }),
    ],
  },
  {
    name: 'dodge', fps: 14, loop: false,
    frames: [
      P({ lean: 4, crouch: 3, flare: 0.7, cape: 0.6, arm: 1.8, sword: 2.7, fFx: 7, fBx: -6 }),
      P({ lean: 5, crouch: 4, flare: 1, cape: 0.8, arm: 1.9, sword: 2.8, fFx: 8, fBx: -8, fBy: 2 }),
      P({ lean: 5, crouch: 4, flare: 1, cape: 0.9, arm: 1.9, sword: 2.8, fFx: 6, fBx: -7, fBy: 1 }),
      P({ lean: 3, crouch: 2, flare: 0.5, cape: 0.5, arm: 1.5, sword: 2.2, fFx: 5, fBx: -4 }),
    ],
  },
  {
    name: 'hurt', fps: 10, loop: false,
    frames: [
      P({ lean: -3, arm: 1.4, sword: 2.0, cape: -0.3, headDown: -1, fFx: 5 }),
      P({ lean: -2, crouch: 1, arm: 1.3, sword: 1.8, cape: -0.2, fFx: 4 }),
    ],
  },
  {
    name: 'death', fps: 8, loop: false,
    frames: [
      P({ lean: -3, arm: 1.4, sword: 2.0, headDown: -1 }),
      P({ crouch: 3, lean: 1, arm: 1.5, sword: 1.6, runes: 0.4 }),
      P({ crouch: 6, lean: 2, arm: 1.3, sword: 1.57, fBx: -6, runes: 0.3, headDown: 1 }),
      P({ crouch: 8, lean: 2, arm: 1.2, sword: 1.57, fBx: -8, fFx: 5, runes: 0.2, headDown: 2 }),
      P({ crouch: 8, lean: 2, arm: 1.2, sword: 1.57, fBx: -8, fFx: 5, runes: 0.1, headDown: 3, cape: -0.1 }),
      P({ crouch: 8, lean: 2, arm: 1.2, sword: 1.57, fBx: -8, fFx: 5, runes: 0, headDown: 3, cape: -0.2 }),
      P({ crouch: 8, lean: 2, arm: 1.2, sword: 1.57, fBx: -8, fFx: 5, runes: 0, headDown: 3, cape: -0.2 }),
    ],
  },
  {
    name: 'cast', fps: 14, loop: false,
    frames: [
      P({ claw: 1, clawA: 2.2, lean: -1, arm: 1.2, sword: 1.5 }),
      P({ claw: 1, clawA: 0.1, lean: 2, fFx: 6, clawTrail: 1, arm: 1.2, sword: 1.5, runes: 1 }),
      P({ claw: 1, clawA: -0.2, lean: 3, fFx: 6, clawTrail: 1, arm: 1.2, sword: 1.5, runes: 1 }),
      P({ claw: 1, clawA: 0.3, lean: 2, fFx: 5, arm: 1.2, sword: 1.5 }),
      P({ claw: 1, clawA: 1.0, lean: 0, arm: 1.1, sword: 1.3 }),
    ],
  },
  {
    name: 'interact', fps: 8, loop: false,
    frames: [
      P({ claw: 1, clawA: 0.9, lean: 1 }),
      P({ claw: 1, clawA: 0.35, lean: 2, fFx: 5 }),
      P({ claw: 1, clawA: 0.35, lean: 2, fFx: 5, runes: 0.9 }),
    ],
  },
  {
    name: 'victory', fps: 6, loop: true,
    frames: [0, 1, 2, 3].map((i) =>
      P({ arm: -1.45, sword: -1.57, reach: 5, runes: 1, flare: [0.3, 0.4, 0.5, 0.4][i], cape: [0.2, 0.4, 0.5, 0.3][i], bob: [0, 0, 1, 0][i] }),
    ),
  },
];

let cached: SpriteSheet | null = null;

export function getVarynSheet(): SpriteSheet {
  if (!cached) {
    cached = buildSpriteSheet<VarynPose>({
      frameW: 64,
      frameH: 64,
      pivotX: CX,
      pivotY: G,
      outline: PAL.ink,
      clips: VARYN_CLIPS,
      draw: (pose, c, e) => drawVaryn(pose, c, e),
    });
  }
  return cached;
}
