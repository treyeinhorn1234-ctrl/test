import { PixelCanvas } from '../pixel/PixelCanvas';
import { buildSpriteSheet, type ClipDef, type SpriteSheet } from '../../entities/animation/SpriteSheet';
import { Mask, crescent, flames, gem, knee, paint, polar, rotated, sampleKeys, swirl, type Pt, type Tones } from './frontRig';

/**
 * Varyn, Seigneur des Abysses — vue de face 3/4 (regard vers la gauche),
 * frames 128×112. Armure noire ornée (plaques biseautées, liserés gravés,
 * volutes), épaulières à pointes, couronne de cornes brisée, yeux rouges,
 * cape en lambeaux, tabard violet, épée Eclipse et flammes abyssales animées.
 * Chaque animation existe aussi vue de dos (suffixe « @back »).
 */
export interface VarynPose {
  bob: number;
  lean: number;
  crouch: number;
  fLx: number;
  fLy: number;
  fRx: number;
  fRy: number;
  /** Bras d'épée (côté gauche écran) : angle (y vers le bas) et longueur. */
  armA: number;
  armLen: number;
  swordA: number;
  /** 1 : l'épée passe derrière le corps (course, esquive). */
  swordBehind: number;
  /** Bras libre (côté droit écran). */
  offA: number;
  offLen: number;
  claw: number;
  clawSmear: number;
  clawFrom: number;
  clawTo: number;
  cape: number;
  flare: number;
  smear: number;
  smearFrom: number;
  smearTo: number;
  flame: number;
  runes: number;
  headDown: number;
  /** Roulade : angle de rotation de toute la silhouette. */
  roll: number;
  back: number;
}

const W = 128;
const H = 112;
const G = 100;
const CX = 64;
const BLADE = 35;

const INK = 0x07050b;
const ARMOR: Tones = { rim: 0x847888, hi: 0x4c4354, base: 0x372f3e, dark: 0x241e2a, shadow: 0x120e16, engrave: 0x7a6e7e };
const ARMOR_LIGHT: Tones = { rim: 0x9a8e98, hi: 0x5a5062, base: 0x433a4c, dark: 0x2c2534, shadow: 0x15101a, engrave: 0x8e8290 };
const HORN: Tones = { rim: 0x726676, hi: 0x3c3442, base: 0x29232f, dark: 0x1c1722, shadow: 0x0d0a11 };
const CAPE: Tones = { rim: 0x684e78, hi: 0x443450, base: 0x32263c, dark: 0x22192b, shadow: 0x120d18 };
const TABARD: Tones = { rim: 0x8a58b4, hi: 0x5f3784, base: 0x46255f, dark: 0x311a46, shadow: 0x1e0f2c };
const STEEL: Tones = { rim: 0xb0a6b8, hi: 0x625a6a, base: 0x4a4352, dark: 0x332d3a, shadow: 0x15111a };
const GAUNT: Tones = { rim: 0x9a8e98, hi: 0x5e5466, base: 0x463d4e, dark: 0x2e2636, shadow: 0x140f19 };
const FLAME: [number, number, number] = [0x6a2ee0, 0xa868ff, 0xe6d2ff];
const VOID_GEM: [number, number, number] = [0x3a1470, 0x8a4cf0, 0xe0c4ff];
const EYE = 0xff2a2a;
const EYE_CORE = 0xffb0a0;

const BASE: VarynPose = {
  bob: 0, lean: 0, crouch: 0, fLx: 0, fLy: 0, fRx: 0, fRy: 0,
  armA: 1.95, armLen: 13, swordA: 2.45, swordBehind: 0,
  offA: 1.35, offLen: 13, claw: 0, clawSmear: 0, clawFrom: 0, clawTo: 0,
  cape: 0, flare: 0, smear: 0, smearFrom: 0, smearTo: 0,
  flame: 0.6, runes: 0.5, headDown: 0, roll: 0, back: 0,
};

const P = (o: Partial<VarynPose>): VarynPose => ({ ...BASE, ...o });

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------- parties

function drawCape(c: PixelCanvas, sh: Pt, p: VarynPose, overBody: boolean): void {
  const sway = p.cape;
  const fl = p.flare;
  const bottomY = overBody ? G - 9 : G - 1;
  const right = { x: CX + 25 + sway * 7 + fl * 10, y: bottomY - fl * 8 };
  const left = { x: CX - 24 + sway * 2 - fl * 2, y: bottomY - 1 };
  const pts: Pt[] = [
    { x: sh.x - 11, y: sh.y - 1 },
    { x: sh.x + 11, y: sh.y - 1 },
    { x: sh.x + 16, y: sh.y + 8 },
    { x: CX + 20 + sway * 5 + fl * 7, y: G - 22 - fl * 6 },
    right,
  ];
  const n = 11;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = right.x + (left.x - right.x) * t;
    const y = right.y + (left.y - right.y) * t + (i % 2 ? -3 - hash(i) * 4 : hash(i + 9) * 2);
    pts.push({ x, y });
  }
  pts.push(left, { x: CX - 20 + sway, y: G - 22 }, { x: sh.x - 16, y: sh.y + 8 });
  const m = new Mask(W, H).poly(pts);
  paint(c, m, CAPE, { light: 0.1 });
  // Plis.
  for (let k = 0; k < 5; k++) {
    const t = (k + 0.5) / 5;
    const top = { x: sh.x - 9 + t * 18, y: sh.y + 4 };
    const bot = { x: left.x + (right.x - left.x) * t + sway * 2, y: bottomY - 6 };
    for (let s = 0; s <= 1; s += 0.02) {
      const x = Math.round(top.x + (bot.x - top.x) * s + Math.sin(s * 3 + k) * 1.2);
      const y = Math.round(top.y + (bot.y - top.y) * s);
      if (m.get(x, y)) c.px(x, y, k % 2 ? CAPE.dark : CAPE.shadow);
      if (m.get(x - 1, y) && k % 2 === 0) c.px(x - 1, y, CAPE.hi);
    }
  }
}

function drawLeg(c: PixelCanvas, hip: Pt, foot: Pt): void {
  const k = knee(hip, foot, 10, 10.5, -1);
  const ankle = { x: foot.x, y: foot.y - 3 };
  const m = new Mask(W, H).capsule(hip, k, 4.2, 3.6).capsule(k, ankle, 3.6, 3);
  paint(c, m, ARMOR, { engraveAt: 2 });
  // Genouillère en losange, gravée.
  const kp = new Mask(W, H).poly([{ x: k.x, y: k.y - 4 }, { x: k.x + 4, y: k.y }, { x: k.x, y: k.y + 4 }, { x: k.x - 4, y: k.y }]);
  paint(c, kp, ARMOR_LIGHT, { engraveAt: 2 });
  c.px(k.x, k.y, 0x6a3fb0);
  // Solleret pointé vers la gauche.
  const boot = new Mask(W, H).poly([
    { x: ankle.x - 4, y: ankle.y - 1 }, { x: ankle.x + 4, y: ankle.y - 1 }, { x: ankle.x + 5, y: foot.y },
    { x: ankle.x - 7, y: foot.y }, { x: ankle.x - 7, y: foot.y - 2 },
  ]);
  paint(c, boot, ARMOR, { engraveAt: 2 });
}

function drawPauldron(c: PixelCanvas, e: PixelCanvas, at: Pt, s: number): void {
  // Grandes pointes (derrière les plaques) : vers le haut, en biais, vers l'extérieur.
  const spikes: [Pt, Pt, Pt][] = [
    [{ x: at.x - s * 2, y: at.y - 4 }, { x: at.x + s * 1, y: at.y - 18 }, { x: at.x + s * 4, y: at.y - 5 }],
    [{ x: at.x + s * 3, y: at.y - 5 }, { x: at.x + s * 11, y: at.y - 16 }, { x: at.x + s * 8, y: at.y - 2 }],
    [{ x: at.x + s * 7, y: at.y - 1 }, { x: at.x + s * 16, y: at.y - 6 }, { x: at.x + s * 9, y: at.y + 4 }],
  ];
  for (const tri of spikes) paint(c, new Mask(W, H).poly(tri), HORN);
  // Lames d'épaulière superposées, la plus haute en dernier.
  paint(c, new Mask(W, H).ellipse(at.x + s * 3, at.y + 9, 6, 3.6), ARMOR, { engraveAt: 2 });
  paint(c, new Mask(W, H).ellipse(at.x + s * 2, at.y + 5.5, 7.5, 4.4), ARMOR, { engraveAt: 2 });
  const main = new Mask(W, H).poly([
    { x: at.x - s * 7, y: at.y + 3 }, { x: at.x - s * 6, y: at.y - 3 }, { x: at.x - s * 1, y: at.y - 6 },
    { x: at.x + s * 5, y: at.y - 6 }, { x: at.x + s * 9, y: at.y - 2 }, { x: at.x + s * 9, y: at.y + 4 }, { x: at.x + s * 2, y: at.y + 5 },
  ]);
  paint(c, main, ARMOR_LIGHT, { engraveAt: 2 });
  // Arête centrale et gemme.
  c.line(at.x + s * 1, at.y - 5, at.x + s * 2, at.y + 4, ARMOR.engrave!);
  c.line(at.x + s * 2, at.y - 5, at.x + s * 3, at.y + 4, ARMOR.shadow);
  gem(c, e, at.x + s * 5, at.y, 1, VOID_GEM);
}

function drawHead(c: PixelCanvas, e: PixelCanvas, h: Pt, back: boolean): void {
  const x = h.x, y = h.y;
  // Cornes : une immense qui s'enroule, l'autre brisée ; crête centrale.
  const hornL = new Mask(W, H).poly([
    { x: x - 6, y: y - 4 }, { x: x - 3, y: y - 8 }, { x: x - 8, y: y - 12 }, { x: x - 13, y: y - 17 },
    { x: x - 15, y: y - 23 }, { x: x - 14, y: y - 28 }, { x: x - 17, y: y - 21 }, { x: x - 16, y: y - 14 }, { x: x - 11, y: y - 7 },
  ]);
  const hornR = new Mask(W, H).poly([
    { x: x + 6, y: y - 4 }, { x: x + 3, y: y - 8 }, { x: x + 8, y: y - 12 }, { x: x + 12, y: y - 16 },
    { x: x + 14, y: y - 19 }, { x: x + 13, y: y - 21 }, { x: x + 16, y: y - 20 }, { x: x + 15, y: y - 13 }, { x: x + 11, y: y - 7 },
  ]);
  const crest = new Mask(W, H).poly([{ x: x - 3, y: y - 7 }, { x: x - 0.5, y: y - 25 }, { x: x + 3, y: y - 7 }]);
  const spikes = new Mask(W, H)
    .poly([{ x: x - 5, y: y - 7 }, { x: x - 6, y: y - 15 }, { x: x - 2, y: y - 8 }])
    .poly([{ x: x + 5, y: y - 7 }, { x: x + 5, y: y - 13 }, { x: x + 2, y: y - 8 }]);
  for (const m of [hornL, hornR, spikes, crest]) paint(c, m, HORN);
  // Heaume en pointe.
  const helm = new Mask(W, H).poly([
    { x: x - 7, y: y - 6 }, { x: x - 4, y: y - 9 }, { x: x + 4, y: y - 9 }, { x: x + 7, y: y - 6 },
    { x: x + 7, y: y + 1 }, { x: x + 3, y: y + 6 }, { x: x, y: y + 9 }, { x: x - 3, y: y + 6 }, { x: x - 7, y: y + 1 },
  ]);
  paint(c, helm, ARMOR, { engraveAt: 2 });
  if (back) {
    c.line(x, y - 8, x, y + 7, ARMOR.engrave!);
    c.line(x + 1, y - 8, x + 1, y + 7, ARMOR.shadow);
    return;
  }
  // Fente du visage en V et yeux incandescents, inclinés (regard mauvais).
  const slit = new Mask(W, H).poly([
    { x: x - 6, y: y - 2 }, { x: x + 6, y: y - 2 }, { x: x + 2, y: y + 4 }, { x: x, y: y + 7 }, { x: x - 2, y: y + 4 },
  ]);
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (slit.get(xx, yy)) c.px(xx, yy, 0x050308);
  const eyes: [number, number, number][] = [
    [x - 6, y - 1, EYE], [x - 5, y - 1, EYE], [x - 4, y, EYE_CORE], [x - 3, y, EYE], [x - 2, y + 1, EYE],
    [x + 4, y - 1, EYE], [x + 3, y - 1, EYE], [x + 2, y, EYE_CORE], [x + 1, y, EYE], [x, y + 1, EYE],
  ];
  for (const [ex, ey, col] of eyes) {
    c.px(ex - 1, ey, col);
    e.px(ex - 1, ey, col === EYE_CORE ? 0xc04030 : 0x701010);
  }
  // Nez du heaume.
  c.line(x - 1, y - 8, x - 1, y - 3, ARMOR.engrave!);
}

function drawSword(c: PixelCanvas, e: PixelCanvas, hand: Pt, a: number, runes: number, swordMask: Mask): void {
  const dir = { x: Math.cos(a), y: Math.sin(a) };
  const perp = { x: -dir.y, y: dir.x };
  const at = (d: number, s = 0): Pt => ({ x: hand.x + dir.x * d + perp.x * s, y: hand.y + dir.y * d + perp.y * s });
  // Lame large qui s'affine.
  const blade = new Mask(W, H).poly([at(4, 4.2), at(4, -4.2), at(BLADE - 7, -3.8), at(BLADE, 0), at(BLADE - 7, 3.8)]);
  paint(c, blade, STEEL);
  // Fil éclairé sur l'arête tournée vers la lumière, gouttière sombre.
  const litSide = perp.y < 0 || (perp.y === 0 && perp.x < 0) ? 1 : -1;
  for (let d = 5; d < BLADE - 1; d++) {
    const w = d < BLADE - 7 ? 3.2 : 3.2 * (1 - (d - (BLADE - 7)) / 7);
    const p = at(d, w * litSide);
    if (blade.get(Math.round(p.x), Math.round(p.y))) c.px(p.x, p.y, STEEL.rim);
    if (d < BLADE - 7) {
      const f = at(d, 0);
      c.px(f.x, f.y, STEEL.shadow);
    }
  }
  for (let d = 7; d < BLADE - 8; d += 4) {
    const r = at(d, 0);
    const col = runes > 0.75 ? 0xd8b8ff : 0x8a4cf0;
    c.px(r.x, r.y, col);
    if (runes > 0.2) e.px(r.x, r.y, col);
  }
  // Garde incurvée, fusée, pommeau.
  const guard = new Mask(W, H).poly([at(3, 8.5), at(1, 7), at(1.2, -7), at(3, -8.5), at(4.2, 0)]);
  paint(c, guard, ARMOR_LIGHT);
  gem(c, e, at(2.5).x, at(2.5).y, 1, VOID_GEM);
  const grip = new Mask(W, H).capsule(at(-5), at(1), 1.6);
  paint(c, grip, { rim: 0x5a4044, hi: 0x3a2a2e, base: 0x2a1e22, dark: 0x1c1216, shadow: 0x0e080a });
  const pom = at(-6);
  paint(c, new Mask(W, H).ellipse(pom.x, pom.y, 2.2, 2.2), ARMOR_LIGHT);
  c.px(pom.x, pom.y, VOID_GEM[1]);
  e.px(pom.x, pom.y, VOID_GEM[1]);
  for (const m of [blade, guard]) for (let i = 0; i < m.data.length; i++) if (m.data[i]) swordMask.data[i] = 1;
}

function drawArm(c: PixelCanvas, joint: Pt, hand: Pt): void {
  const elbow = { x: (joint.x + hand.x) / 2, y: (joint.y + hand.y) / 2 };
  paint(c, new Mask(W, H).capsule(joint, elbow, 3.8, 3.4).capsule(elbow, hand, 3.4, 3), ARMOR, { engraveAt: 2 });
  paint(c, new Mask(W, H).ellipse(elbow.x, elbow.y, 3, 3), ARMOR_LIGHT);
}

function drawGauntlet(c: PixelCanvas, hand: Pt): void {
  paint(c, new Mask(W, H).ellipse(hand.x, hand.y, 3.4, 3.2), GAUNT);
  c.px(hand.x - 1, hand.y - 2, GAUNT.rim);
  c.px(hand.x + 1, hand.y - 2, GAUNT.rim);
}

// ------------------------------------------------------------- assemblage

function drawBody(p: VarynPose, c: PixelCanvas, e: PixelCanvas, swordMask: Mask): Pt {
  const back = p.back > 0.5;
  const mx = back ? -1 : 1;
  const mirror = (a: number) => (back ? Math.PI - a : a);
  const hip = { x: CX - p.lean * 0.4, y: G - 21 + p.bob + p.crouch };
  const sh = { x: CX - p.lean, y: hip.y - 18 + Math.max(0, p.headDown) * 0.3 };
  const head = { x: sh.x - p.lean * 0.15 - (back ? 0 : 1), y: sh.y - 8 + p.headDown };
  const swordJ = { x: sh.x - 13 * mx, y: sh.y + 4 };
  const offJ = { x: sh.x + 13 * mx, y: sh.y + 4 };
  const swordHand = polar(swordJ, mirror(p.armA), p.armLen);
  const offHand = polar(offJ, mirror(p.offA), p.offLen);
  const swordAngle = mirror(p.swordA);

  if (!back) drawCape(c, sh, p, false);
  if (p.swordBehind > 0.5 || back) drawSword(c, e, swordHand, swordAngle, p.runes, swordMask);

  drawLeg(c, { x: hip.x + 5, y: hip.y }, { x: CX + 7 + p.fRx, y: G - p.fRy });
  drawLeg(c, { x: hip.x - 5, y: hip.y }, { x: CX - 7 + p.fLx, y: G - p.fLy });

  if (!back) {
    // Tassettes et tabard violet en lambeaux.
    for (const s of [-1, 1]) {
      paint(c, new Mask(W, H).poly([
        { x: hip.x + s * 2, y: hip.y - 3 }, { x: hip.x + s * 9, y: hip.y - 3 }, { x: hip.x + s * 10, y: hip.y + 5 }, { x: hip.x + s * 3, y: hip.y + 7 },
      ]), ARMOR, { engraveAt: 2 });
    }
    const sway = p.cape * 2;
    const tab: Pt[] = [{ x: hip.x - 4, y: hip.y - 4 }, { x: hip.x + 4, y: hip.y - 4 }, { x: hip.x + 5 + sway, y: G - 7 }];
    for (let i = 1; i < 6; i++) tab.push({ x: hip.x + 5 + sway - i * 2, y: G - 7 + (i % 2 ? 3 : -1) });
    tab.push({ x: hip.x - 5 + sway, y: G - 8 });
    paint(c, new Mask(W, H).poly(tab), TABARD, { light: 0.05 });
    c.line(hip.x, hip.y - 2, hip.x + sway * 0.6, G - 9, TABARD.dark);
  }

  // Cuirasse.
  const torso = new Mask(W, H).poly([
    { x: sh.x - 12, y: sh.y }, { x: sh.x + 12, y: sh.y }, { x: sh.x + 11, y: sh.y + 10 },
    { x: hip.x + 7, y: hip.y - 3 }, { x: hip.x - 7, y: hip.y - 3 }, { x: sh.x - 11, y: sh.y + 10 },
  ]);
  paint(c, torso, ARMOR, { engraveAt: 3 });
  if (!back) {
    const chest = new Mask(W, H).poly([
      { x: sh.x - 7, y: sh.y + 1 }, { x: sh.x + 7, y: sh.y + 1 }, { x: sh.x + 6, y: sh.y + 9 }, { x: sh.x, y: sh.y + 15 }, { x: sh.x - 6, y: sh.y + 9 },
    ]);
    paint(c, chest, ARMOR_LIGHT, { engraveAt: 2 });
    gem(c, e, sh.x, sh.y + 6, 2, VOID_GEM);
    // Filigrane : arcs gravés sous la plaque pectorale.
    for (const s of [-1, 1]) {
      swirl(c, sh.x + s * 8, sh.y + 12, 2.2, ARMOR.engrave!, s, 1.1);
      c.line(sh.x + s * 3, sh.y + 15, sh.x + s * 8, sh.y + 10, ARMOR.engrave!);
    }
    for (const yy of [hip.y - 8, hip.y - 6]) c.line(hip.x - 6, yy, hip.x + 6, yy, ARMOR.shadow);
    // Ceinture et boucle.
    paint(c, new Mask(W, H).rect(Math.round(hip.x - 8), Math.round(hip.y - 5), 16, 3), GAUNT);
    paint(c, new Mask(W, H).ellipse(hip.x, hip.y - 4, 2.8, 2.2), ARMOR_LIGHT);
    gem(c, e, hip.x, hip.y - 4, 1, VOID_GEM);
  } else {
    c.line(sh.x, sh.y + 1, hip.x, hip.y - 4, ARMOR.engrave!);
  }

  // Bras.
  drawArm(c, offJ, offHand);
  drawGauntlet(c, offHand);
  if (back) drawCape(c, sh, p, true);
  drawArm(c, swordJ, swordHand);

  drawPauldron(c, e, { x: sh.x - 12, y: sh.y }, -1);
  drawPauldron(c, e, { x: sh.x + 12, y: sh.y }, 1);
  // Gorgerin.
  paint(c, new Mask(W, H).ellipse(head.x, head.y + 7, 5, 2.5), GAUNT);
  drawHead(c, e, head, back);

  if (p.swordBehind <= 0.5 && !back) drawSword(c, e, swordHand, swordAngle, p.runes, swordMask);
  drawGauntlet(c, swordHand);

  if (p.claw > 0) {
    for (let k = -1; k <= 1; k++) {
      const tip = polar(offHand, mirror(p.offA) + k * 0.32, 5 + p.claw);
      c.line(offHand.x, offHand.y, tip.x, tip.y, FLAME[1]);
      e.line(offHand.x, offHand.y, tip.x, tip.y, FLAME[1]);
      c.px(tip.x, tip.y, FLAME[2]);
      e.px(tip.x, tip.y, FLAME[2]);
    }
  }
  return swordJ;
}

function drawVaryn(p: VarynPose, c: PixelCanvas, e: PixelCanvas, frame: number, row: number): void {
  const back = p.back > 0.5;
  const mirror = (a: number) => (back ? Math.PI - a : a);
  const swordMask = new Mask(W, H);
  let joint: Pt;
  if (p.roll !== 0) {
    // Roulade : silhouette repliée puis pivotée autour de son centre.
    const tc = new PixelCanvas(W, H);
    const te = new PixelCanvas(W, H);
    joint = drawBody(p, tc, te, swordMask);
    tc.outline(INK);
    const center = { x: CX, y: G - 14 };
    c.blit(rotated(tc, p.roll, center.x, center.y), 0, 0);
    e.blit(rotated(te, p.roll, center.x, center.y), 0, 0);
    swordMask.data.fill(0);
  } else {
    joint = drawBody(p, c, e, swordMask);
    c.outline(INK);
  }
  const seed = frame * 13 + row * 101;
  flames(c, e, null, seed, p.flame * 1.3, FLAME, 0.14);
  flames(c, e, swordMask, seed + 5, p.flame * 1.6, FLAME, 0.7);
  if (p.smear > 0) {
    crescent(c, e, joint, mirror(p.smearFrom), mirror(p.smearTo), 14, p.armLen + BLADE + 2,
      { edge: 0xf0e4ff, core: 0xb27cff, faint: 0x6a30d0 }, p.smear);
  }
  if (p.clawSmear > 0) {
    const offJ = { x: joint.x + (back ? -26 : 26), y: joint.y };
    for (const r of [15, 19, 23]) {
      crescent(c, e, offJ, mirror(p.clawFrom), mirror(p.clawTo), r - 1.5, r, { edge: 0xe8d4ff, core: 0xa060ff, faint: 0x6a30d0 }, p.clawSmear);
    }
  }
}

// ------------------------------------------------------------- animations

function walkCycle(n: number, stride: number, lift: number, extra: Partial<VarynPose>): VarynPose[] {
  return Array.from({ length: n }, (_, i) => {
    const ph = (i / n) * Math.PI * 2;
    return P({
      fLx: Math.round(-Math.cos(ph) * stride),
      fLy: Math.round(Math.max(0, Math.sin(ph)) * lift),
      fRx: Math.round(Math.cos(ph) * stride),
      fRy: Math.round(Math.max(0, -Math.sin(ph)) * lift),
      bob: Math.round(Math.abs(Math.sin(ph)) * 1.5),
      cape: 0.3 + Math.sin(ph) * 0.15 + (extra.cape ?? 0),
      armA: (extra.armA ?? BASE.armA) + Math.sin(ph) * 0.06,
      flame: 0.65,
      ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'cape' && k !== 'armA')),
    });
  });
}

const ROLL_CURL: Partial<VarynPose> = {
  crouch: 11, fLx: -3, fLy: 7, fRx: 3, fRy: 7, armA: 0.7, armLen: 9, swordA: -0.4, swordBehind: 1,
  offA: 1.2, offLen: 9, flare: 0.6, cape: 0.6, headDown: 3, flame: 0.25,
};

const CLIPS_FRONT: ClipDef<VarynPose>[] = [
  {
    name: 'idle', fps: 7, loop: true,
    frames: sampleKeys(BASE, [
      { t: 0, p: {} },
      { t: 0.5, p: { bob: 1, cape: 0.25, runes: 0.85, flame: 0.8, armA: 1.99, swordA: 2.47 } },
      { t: 1, p: {} },
    ], 8, true),
  },
  { name: 'walk', fps: 11, loop: true, frames: walkCycle(8, 4, 3, { lean: 1 }), events: { 1: 'step', 5: 'step' } },
  {
    name: 'run', fps: 14, loop: true,
    frames: walkCycle(8, 7, 5, { lean: 5, cape: 0.6, flare: 0.5, armA: 1.15, swordA: 0.45, swordBehind: 1, runes: 0.8 }),
    events: { 1: 'step', 5: 'step' },
  },
  {
    name: 'attack1', fps: 14, loop: false,
    frames: sampleKeys(BASE, [
      { t: 0, p: { armA: -0.3, swordA: -0.8, lean: -3, crouch: 2, flame: 0.9, cape: 0.3 } },
      { t: 0.25, p: { armA: -1.2, swordA: -1.9, lean: -1, smear: 1, smearFrom: -0.8, smearTo: -1.9, flame: 0.9 } },
      { t: 0.45, p: { armA: -2.8, swordA: -3.3, lean: 4, fLx: -5, crouch: 1, smear: 1, smearFrom: -1.2, smearTo: -3.3, runes: 1, flame: 1 } },
      { t: 0.65, p: { armA: -3.7, swordA: -4.1, lean: 5, fLx: -6, crouch: 2, smear: 0.6, smearFrom: -2.4, smearTo: -4.1, cape: 0.5 } },
      { t: 1, p: { armA: -4.25, swordA: -3.9, lean: 2, fLx: -4, crouch: 1, cape: 0.3 } },
    ], 7),
  },
  {
    name: 'attack2', fps: 14, loop: false,
    frames: sampleKeys(BASE, [
      { t: 0, p: { armA: 2.4, swordA: 2.0, crouch: 3, lean: 2, fLx: -3, flame: 0.9 } },
      { t: 0.3, p: { armA: 2.9, swordA: 3.0, lean: 3, fLx: -5, smear: 1, smearFrom: 2.0, smearTo: 3.0 } },
      { t: 0.5, p: { armA: 3.9, swordA: 4.2, lean: 2, bob: -1, smear: 1, smearFrom: 2.4, smearTo: 4.2, runes: 1, flame: 1 } },
      { t: 0.7, p: { armA: 4.5, swordA: 5.0, smear: 0.6, smearFrom: 3.4, smearTo: 5.0, cape: 0.4 } },
      { t: 1, p: { armA: 4.6, swordA: 5.15, lean: -1 } },
    ], 7),
  },
  {
    name: 'attack3', fps: 14, loop: false,
    frames: sampleKeys(BASE, [
      { t: 0, p: { armA: -1.4, swordA: -1.6, bob: -2, flame: 1, runes: 1, flare: 0.3 } },
      { t: 0.3, p: { armA: -1.6, swordA: -1.75, bob: -4, flame: 1.2, runes: 1, flare: 0.4 } },
      { t: 0.45, p: { armA: -2.6, swordA: -3.0, bob: -1, lean: 3, smear: 1, smearFrom: -1.75, smearTo: -3.0, runes: 1 } },
      { t: 0.6, p: { armA: -3.9, swordA: -4.35, crouch: 6, lean: 5, fLx: -6, smear: 1, smearFrom: -2.2, smearTo: -4.35, runes: 1, flame: 1.2 } },
      { t: 0.8, p: { armA: -3.95, swordA: -4.4, crouch: 6, lean: 5, fLx: -6, runes: 0.9, flame: 1 } },
      { t: 1, p: { armA: -4.25, swordA: -3.9, crouch: 1, lean: 1 } },
    ], 8),
  },
  {
    name: 'heavy', fps: 12, loop: false,
    frames: sampleKeys(BASE, [
      { t: 0, p: { armA: 0.9, swordA: 0.5, crouch: 4, lean: -4, cape: 0.6, flame: 1, runes: 1, swordBehind: 1 } },
      { t: 0.3, p: { armA: 0.8, swordA: 0.35, crouch: 5, lean: -5, flame: 1.4, runes: 1, flare: 0.4, swordBehind: 1 } },
      { t: 0.45, p: { armA: -0.6, swordA: -0.8, crouch: 3, smear: 1, smearFrom: 0.35, smearTo: -0.8, flame: 1.3, runes: 1 } },
      { t: 0.55, p: { armA: -2.2, swordA: -2.5, lean: 4, fLx: -5, smear: 1, smearFrom: 0.35, smearTo: -2.5, flame: 1.3, runes: 1 } },
      { t: 0.65, p: { armA: -3.8, swordA: -4.1, lean: 5, crouch: 2, smear: 1, smearFrom: -0.6, smearTo: -4.1, flame: 1.3, runes: 1 } },
      { t: 0.75, p: { armA: -5.2, swordA: -5.6, lean: 3, crouch: 3, smear: 1, smearFrom: -2.0, smearTo: -5.6, flame: 1.2, runes: 1 } },
      { t: 0.85, p: { armA: -5.4, swordA: -5.9, lean: 2, crouch: 3, smear: 0.5, smearFrom: -3.6, smearTo: -5.9, flame: 1 } },
      { t: 1, p: { armA: -4.4, swordA: -3.9, lean: 1, crouch: 1 } },
    ], 10),
  },
  {
    name: 'dodge', fps: 14, loop: false,
    frames: sampleKeys(BASE, [
      { t: 0, p: { lean: 4, crouch: 3, flare: 0.6, cape: 0.6, armA: 1.2, swordA: 0.5, swordBehind: 1, fLx: -4, fRx: 4, flame: 1 } },
      { t: 0.4, p: { lean: 7, crouch: 5, flare: 1, cape: 1, armA: 1.1, swordA: 0.4, swordBehind: 1, fLx: -7, fRx: 7, fRy: 3, flame: 1.3, runes: 1 } },
      { t: 1, p: { lean: 3, crouch: 2, flare: 0.4, cape: 0.5, armA: 1.6, swordA: 1.6, swordBehind: 1, fLx: -3, fRx: 2 } },
    ], 6),
  },
  {
    name: 'roll', fps: 16, loop: false,
    frames: [
      P({ crouch: 6, lean: 4, fLx: -5, fRx: 4, armA: 1.1, swordA: 0.4, swordBehind: 1, flare: 0.4, flame: 0.4 }),
      ...[1, 2, 3, 4, 5, 6].map((i) => P({ ...ROLL_CURL, roll: -(i / 6) * Math.PI * 2 + 0.0001 })),
      P({ crouch: 5, lean: 3, fLx: -4, fRx: 5, armA: 1.4, swordA: 1.2, swordBehind: 1, cape: 0.5, flame: 0.5 }),
    ],
  },
  {
    name: 'hurt', fps: 10, loop: false,
    frames: sampleKeys(BASE, [
      { t: 0, p: { lean: -4, headDown: -2, armA: 1.6, swordA: 2.0, cape: -0.4, flame: 0.3 } },
      { t: 0.5, p: { lean: -3, crouch: 2, flame: 0.4 } },
      { t: 1, p: { lean: -1, crouch: 1 } },
    ], 3),
  },
  {
    name: 'death', fps: 9, loop: false,
    frames: sampleKeys(BASE, [
      { t: 0, p: { lean: -4, headDown: -2, armA: 1.6, swordA: 2.0, flame: 0.5 } },
      { t: 0.25, p: { crouch: 5, lean: 1, armA: 1.4, swordA: 1.7, flame: 0.4 } },
      { t: 0.45, p: { crouch: 10, fLx: -5, fRx: 4, lean: 2, armA: 1.3, swordA: 1.57, headDown: 2, flame: 0.3 } },
      { t: 0.7, p: { crouch: 11, fLx: -6, fRx: 5, lean: 3, armA: 1.35, swordA: 1.57, headDown: 4, flame: 0.15, runes: 0.2 } },
      { t: 1, p: { crouch: 11, fLx: -6, fRx: 5, lean: 3, armA: 1.35, swordA: 1.57, headDown: 5, flame: 0, runes: 0, cape: -0.2 } },
    ], 10),
  },
  {
    name: 'cast', fps: 14, loop: false,
    frames: sampleKeys(BASE, [
      { t: 0, p: { offA: -0.6, offLen: 14, lean: -2, claw: 1, flame: 0.9, runes: 1 } },
      { t: 0.35, p: { offA: -1.8, lean: 1, claw: 1, clawSmear: 1, clawFrom: -0.6, clawTo: -1.8, flame: 1.1 } },
      { t: 0.55, p: { offA: -3.2, lean: 4, fLx: -5, claw: 1, clawSmear: 1, clawFrom: -1.2, clawTo: -3.2, flame: 1.2 } },
      { t: 0.75, p: { offA: -3.9, lean: 4, fLx: -5, claw: 1, clawSmear: 0.5, clawFrom: -2.4, clawTo: -3.9 } },
      { t: 1, p: { offA: -4.9, lean: 1, claw: 0 } },
    ], 7),
  },
  {
    name: 'interact', fps: 8, loop: false,
    frames: sampleKeys(BASE, [
      { t: 0, p: { offA: 2.0, lean: 1 } },
      { t: 0.5, p: { offA: 2.85, offLen: 15, lean: 3, claw: 0.5, runes: 0.9 } },
      { t: 1, p: { offA: 2.85, offLen: 15, lean: 3, claw: 0.5, runes: 1, flame: 0.9 } },
    ], 4),
  },
  {
    name: 'victory', fps: 7, loop: true,
    frames: sampleKeys(BASE, [
      { t: 0, p: { armA: -1.57, armLen: 12, swordA: -1.57, runes: 1, flame: 1.3, flare: 0.4, cape: 0.3 } },
      { t: 0.5, p: { armA: -1.57, armLen: 12, swordA: -1.57, runes: 1, flame: 1.5, flare: 0.6, cape: 0.5, bob: 1 } },
      { t: 1, p: { armA: -1.57, armLen: 12, swordA: -1.57, runes: 1, flame: 1.3, flare: 0.4, cape: 0.3 } },
    ], 6, true),
  },
];

/** Animations qui possèdent une version vue de dos. */
const WITH_BACK = new Set(['idle', 'walk', 'run', 'attack1', 'attack2', 'attack3', 'heavy', 'dodge', 'cast']);

export const VARYN_CLIPS: ClipDef<VarynPose>[] = [
  ...CLIPS_FRONT,
  ...CLIPS_FRONT.filter((c) => WITH_BACK.has(c.name)).map((c) => ({
    ...c,
    name: `${c.name}@back`,
    frames: c.frames.map((f) => ({ ...f, back: 1 })),
  })),
];

let cached: SpriteSheet | null = null;

export function getVarynSheet(): SpriteSheet {
  if (!cached) {
    cached = buildSpriteSheet<VarynPose>({
      frameW: W,
      frameH: H,
      pivotX: CX,
      pivotY: G,
      outline: null,
      facesLeft: true,
      clips: VARYN_CLIPS,
      draw: (pose, c, e, frame, row) => drawVaryn(pose, c, e, frame, row),
    });
  }
  return cached;
}
