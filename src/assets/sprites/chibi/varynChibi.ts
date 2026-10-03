import { PixelCanvas } from '../../pixel/PixelCanvas';
import { buildSpriteSheet, type ClipDef, type SpriteSheet } from '../../../entities/animation/SpriteSheet';
import {
  addTrails, blade, CX, facingAngle, FH, FOOT_Y, FW, ghostBlade, groundImpact, polar, sampleKeys, shadedEllipse, shadedRect, sparkle, swoosh,
  withSpin, type Dir, type Key, type Pt, type TrailPose,
} from './chibiKit';

/**
 * Varyn en chibi (style RPG Maker) : ~48 px de haut, grosse tête casquée à cornes et
 * couronne brisée, yeux rouges, armure noire à reflets violets, cape pourpre,
 * épée Eclipse dans le dos (en main pour combattre).
 * 4 directions : bas, haut, côté (droite ; la gauche est le miroir).
 */
interface Pose extends TrailPose {
  dir: Dir;
  /** Profil gauche (miroir du profil droit), pour les rotations sur soi-même. */
  mirror: boolean;
  bob: number;
  /** Inclinaison (px) dans la direction regardée. */
  lean: number;
  /** Pas : -1 / 0 / 1 (pied gauche ou droit en avant). */
  step: number;
  sword: 'back' | 'hand';
  swordA: number;
  handR: number;
  smear: number;
  smearFrom: number;
  smearTo: number;
  cape: number;
  flare: number;
  claw: number;
  reach: number;
  eyesClosed: boolean;
  glow: number;
  kneel: number;
  /** Rotation finale de toute l'image (roulade, chute). */
  spin: number;
  spinCx: number;
  spinCy: number;
  raise: boolean;
  /** Éclat à la pointe de la lame. */
  sparks: number;
  /** Lame chargée d'énergie abyssale. */
  bladeGlow: number;
  /** Impact au sol devant le personnage. */
  impact: number;
  /** Énergie qui converge vers le personnage (charge). */
  charge: number;
  /** Tremblement (±1 px une frame sur deux). */
  shake: number;
  /** Hauteur de saut (px) : tout le personnage décolle. */
  air: number;
  /** Jambes repliées (px) pendant un saut. */
  tuck: number;
  /** Main libre : angle et distance au buste (0 : repos). */
  offA: number;
  offR: number;
}

const C = {
  ink: 0x07050b,
  a0: 0x1c1824, a1: 0x2e2838, a2: 0x463d52, a3: 0x6c607a, a4: 0xa898b4,
  c0: 0x22122c, c1: 0x381f48, c2: 0x552d6e, c3: 0x7a44a0,
  v1: 0x9d5cff, v2: 0xd9b8ff,
  eye: 0xff3434, eyeHi: 0xffb0a0,
  st0: 0x3a3542, st1: 0x6a6476, st2: 0xb6aec2,
  grip: 0x3a2a2e,
};
const ARMOR = { lo: C.a0, mid: C.a2, hi: C.a3 };
const ARMOR_D = { lo: C.a0, mid: C.a1, hi: C.a2 };
const SWORD = { edge: C.st2, mid: C.st1, dark: C.st0, guard: C.a3, grip: C.grip, rune: C.v1 };

function base(dir: Dir): Pose {
  return {
    dir, bob: 0, lean: 0, step: 0, sword: 'back', swordA: 0, handR: 6,
    smear: 0, smearFrom: 0, smearTo: 0, cape: 0, flare: 0, claw: 0, reach: 0,
    eyesClosed: false, glow: 0.6, kneel: 0, spin: 0, spinCx: CX, spinCy: FOOT_Y - 11, raise: false,
    mirror: false, trail: 0, smearFade: 0, ghostA: [], sparks: 0, bladeGlow: 0, impact: 0, charge: 0, shake: 0, air: 0, tuck: 0,
    offA: 0, offR: 0,
  };
}

function glowPx(c: PixelCanvas, e: PixelCanvas, x: number, y: number, col: number): void {
  c.px(x, y, col);
  e.px(x, y, col);
}

function drawHead(c: PixelCanvas, e: PixelCanvas, p: Pose, h: Pt): void {
  const { dir } = p;
  const x = Math.round(h.x), y = Math.round(h.y);
  // Cornes : l'une entière, l'autre brisée.
  if (dir === 'side') {
    c.line(x - 5, y - 4, x - 9, y - 9, C.a1, 2);
    c.line(x - 9, y - 9, x - 10, y - 13, C.a2, 1);
    c.line(x + 4, y - 5, x + 6, y - 9, C.a1, 2);
    c.px(x + 7, y - 10, C.a3);
  } else {
    c.line(x - 7, y - 4, x - 10, y - 9, C.a1, 2);
    c.line(x - 10, y - 9, x - 11, y - 14, C.a2, 1);
    c.px(x - 11, y - 15, C.a3);
    c.line(x + 7, y - 4, x + 9, y - 8, C.a1, 2);
    c.px(x + 10, y - 9, C.a3);
  }
  // Heaume.
  shadedEllipse(c, x, y, dir === 'side' ? 8.5 : 9, 8.5, ARMOR);
  // Couronne brisée : trois pointes et une gemme abyssale.
  for (const [dx, h0] of [[-4, 3], [0, 4], [4, 2]] as const) c.line(x + dx, y - 7, x + dx + Math.sign(dx), y - 7 - h0, C.a3, 1);
  c.rect(x - 5, y - 7, 11, 1, C.a3);
  glowPx(c, e, x, y - 8, C.v1);
  if (dir === 'up') {
    // Dos du heaume : arête centrale et plaque de nuque.
    c.line(x, y - 6, x, y + 6, C.a3);
    c.rect(x - 5, y + 5, 11, 2, C.a1);
    return;
  }
  // Fente de la visière et yeux incandescents.
  const eyeCol = p.eyesClosed ? C.a1 : C.eye;
  if (dir === 'down') {
    c.rect(x - 7, y + 1, 15, 3, C.ink);
    c.line(x, y - 6, x, y, C.a4);
    for (const ex of [x - 4, x + 3]) {
      c.px(ex, y + 2, eyeCol);
      c.px(ex + 1, y + 2, eyeCol);
      if (!p.eyesClosed) {
        e.px(ex, y + 2, C.eye);
        e.px(ex + 1, y + 2, C.eyeHi);
      }
    }
    c.rect(x - 3, y + 5, 7, 2, C.a1); // mentonnière
  } else {
    c.rect(x + 1, y + 1, 8, 3, C.ink);
    c.line(x + 2, y - 6, x + 3, y, C.a4);
    c.px(x + 5, y + 2, eyeCol);
    c.px(x + 6, y + 2, eyeCol);
    if (!p.eyesClosed) {
      e.px(x + 5, y + 2, C.eye);
      e.px(x + 6, y + 2, C.eyeHi);
    }
    c.rect(x + 1, y + 5, 6, 2, C.a1);
  }
}

function drawCape(c: PixelCanvas, p: Pose, top: number, over: boolean): void {
  const s = p.cape;
  const f = p.flare;
  let pts: [number, number][];
  if (p.dir === 'side') {
    const back = CX - 13 - f * 6 + s * 2;
    pts = [[CX + 2, top], [CX - 5, top], [back + 2, top + 9], [back, FOOT_Y - 1 - f * 5], [back + 4, FOOT_Y - 3 - f * 4], [back + 7, FOOT_Y - f * 3], [CX - 2, FOOT_Y - 2]];
  } else {
    const w0 = over ? 9 : 8;
    const w1 = over ? 11 + f * 2 : 12 + f * 3;
    pts = [[CX - w0, top], [CX + w0, top], [CX + w1 + s, FOOT_Y - 1]];
    for (let i = 1; i < 6; i++) pts.push([CX + w1 + s - (i * (2 * w1)) / 6, FOOT_Y - 1 - (i % 2 ? 3 : 0)]);
    pts.push([CX - w1 + s, FOOT_Y - 1]);
  }
  c.poly(pts, C.c1);
  // Plis et liseré pourpre.
  const xs = pts.map((q) => q[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  for (let x = Math.ceil(minX) + 2; x < maxX - 1; x += 3) {
    for (let y = top + 3; y < FOOT_Y; y++) {
      const i = (y * c.width + x) * 4;
      if (c.data[i + 3] && c.colorAt(x, y) === C.c1) c.px(x + ((y >> 2) & 1), y, C.c0);
    }
  }
  c.line(pts[1][0], pts[1][1], pts[2][0], pts[2][1], C.c3);
  if (over) c.line(pts[0][0], pts[0][1], pts[pts.length - 1][0], pts[pts.length - 1][1], C.c2);
}

function drawLegs(c: PixelCanvas, p: Pose, hip: number): void {
  const foot = FOOT_Y - p.tuck;
  const len = foot - hip;
  if (p.dir === 'side') {
    const back = { x: CX - 1 - p.step * 3, lift: p.step < 0 ? 0 : Math.abs(p.step) };
    const front = { x: CX + 2 + p.step * 3, lift: p.step > 0 ? 0 : Math.abs(p.step) };
    for (const [leg, cols] of [[back, ARMOR_D], [front, ARMOR]] as const) {
      shadedRect(c, leg.x - 1, hip, 3, len - 1 - leg.lift, cols);
      shadedRect(c, leg.x - 1, foot - 2 - leg.lift, 5, 2, cols);
    }
    return;
  }
  const l = len - 1 + Math.max(0, p.step);
  const r = len - 1 + Math.max(0, -p.step);
  shadedRect(c, CX - 5, hip, 4, l - 1, ARMOR);
  shadedRect(c, CX + 2, hip, 4, r - 1, ARMOR_D);
  shadedRect(c, CX - 6, hip + l - 2, 5, 2, ARMOR);
  shadedRect(c, CX + 2, hip + r - 2, 5, 2, ARMOR_D);
}

function drawBody(c: PixelCanvas, e: PixelCanvas, p: Pose, top: number): void {
  const side = p.dir === 'side';
  const x0 = side ? CX - 4 : CX - 6;
  const w = side ? 9 : 13;
  shadedRect(c, x0, top, w, 9, ARMOR);
  c.rect(x0 + 1, top + 7, w - 2, 1, C.a0); // ceinture
  if (p.dir === 'down') {
    c.rect(CX - 3, top + 1, 7, 4, C.a3);
    c.rect(CX - 3, top + 1, 7, 1, C.a4);
    glowPx(c, e, CX, top + 3, C.v1);
    glowPx(c, e, CX, top + 7, C.v2);
  } else if (side) {
    c.rect(CX + 1, top + 1, 3, 4, C.a3);
    glowPx(c, e, CX + 2, top + 3, C.v1);
  }
  // Reflets violets de l'armure.
  for (const [dx, dy] of [[-4, 4], [3, 6], [-2, 7]] as const) if (!side || dx > -3) glowPx(c, e, CX + dx, top + dy, 0x6a34c0);
  // Épaulières à pointe.
  const pads: number[] = side ? [CX] : [CX - 7, CX + 7];
  for (const px of pads) {
    shadedEllipse(c, px, top + 1, 3.5, 2.6, ARMOR);
    c.line(px + (px < CX ? -1 : 1), top - 1, px + (px < CX ? -3 : 3), top - 3, C.a3);
  }
}

function drawSwordOnBack(c: PixelCanvas, e: PixelCanvas, p: Pose, top: number): void {
  if (p.dir === 'down') blade(c, e, { x: CX + 9, y: top - 3 }, 2.45, 22, SWORD, 2);
  else if (p.dir === 'up') blade(c, e, { x: CX - 9, y: top - 3 }, 0.7, 22, SWORD, 3);
  else blade(c, e, { x: CX - 6, y: top - 4 }, 1.05, 22, SWORD, 2);
}

function drawArms(c: PixelCanvas, e: PixelCanvas, p: Pose, top: number, hand: Pt | null, claw: Pt | null): void {
  const sh = p.dir === 'side' ? [{ x: CX, y: top + 2 }] : [{ x: CX - 7, y: top + 2 }, { x: CX + 7, y: top + 2 }];
  sh.forEach((s, i) => {
    // Main d'arme : bras d'épée (gauche à l'écran de face, droite de dos, avant de profil).
    const weaponArm = p.dir === 'side' ? true : p.dir === 'down' ? i === 0 : i === 1;
    let target: Pt;
    if (weaponArm && hand) target = hand;
    else if (!weaponArm && claw) target = claw;
    else if (!weaponArm && p.offR > 0) target = polar({ x: s.x, y: s.y + 2 }, p.offA, p.offR);
    else target = { x: s.x + (p.dir === 'side' ? -p.step : 0), y: s.y + 6 };
    c.line(s.x, s.y, target.x, target.y, C.a2, 2);
    shadedRect(c, Math.round(target.x) - 1, Math.round(target.y) - 1, 3, 3, ARMOR);
  });
  if (claw && p.claw > 0) {
    const a = facingAngle(p.dir);
    for (const k of [-0.4, 0, 0.4]) {
      const t = polar(claw, a + k, 5);
      c.line(claw.x, claw.y, t.x, t.y, C.v1);
      e.line(claw.x, claw.y, t.x, t.y, C.v1);
      glowPx(c, e, t.x, t.y, C.v2);
    }
  }
}

const SMEAR_COLS: [number, number, number] = [0x6a30d0, 0xb27cff, 0xf0e4ff];
const BLADE_LEN = 18;

/** La lame passe-t-elle derrière le corps pour cette direction ? */
function swordBehind(p: Pose): boolean {
  if (p.raise) return true;
  const sn = Math.sin(p.swordA), cs = Math.cos(p.swordA);
  if (p.dir === 'up') return sn < 0.4;
  if (p.dir === 'down') return sn < -0.55;
  return cs < -0.35;
}

function drawVaryn(p: Pose, c: PixelCanvas, e: PixelCanvas): void {
  const f = facingAngle(p.dir);
  const lx = Math.round(Math.cos(f) * p.lean);
  const ly = p.dir === 'side' ? 0 : Math.round(Math.sin(f) * p.lean * 0.5);
  const top = FOOT_Y - 19 + p.bob + p.kneel + ly;
  const hip = Math.min(FOOT_Y - 3 - p.tuck, top + 9);
  const head = { x: CX + lx + (p.dir === 'side' ? 1 : 0), y: FOOT_Y - 28 + p.bob + p.kneel + ly };
  const chest = { x: CX + lx, y: top + 4 };
  // Épée levée : la main monte au-dessus de l'épaule d'arme, la lame passe derrière la tête.
  const raiseX = p.dir === 'side' ? 3 : p.dir === 'down' ? -9 : 9;
  const hand = p.sword === 'hand' ? (p.raise ? { x: chest.x + raiseX, y: head.y - 6 } : polar(chest, p.swordA, p.handR)) : null;
  const claw = p.reach > 0 ? polar(chest, f, 6 + p.reach * 3) : null;
  const behind = hand !== null && swordBehind(p);
  const swordAngle = p.raise ? -Math.PI / 2 : p.swordA;

  const drawSword = () => {
    if (!hand) return;
    blade(c, e, hand, swordAngle, BLADE_LEN, SWORD);
    if (p.bladeGlow > 0) {
      // Lame chargée : fil incandescent et runes vives.
      const tip = polar(hand, swordAngle, BLADE_LEN);
      const b0 = polar(hand, swordAngle, 3);
      e.line(b0.x, b0.y, tip.x, tip.y, C.v1, 2, Math.round(120 + 135 * p.bladeGlow));
      if (p.bladeGlow > 0.5) c.line(b0.x, b0.y, tip.x, tip.y, C.v2, 1);
    }
  };

  /** Griffe abyssale : trois grandes entailles parallèles, en diagonale devant la main. */
  const drawClaw = () => {
    if (!(p.claw > 0 && claw)) return;
    const len = 6 + p.claw * 10;
    const along = f + 0.75;
    const center = polar(claw, f, 5);
    for (const k of [-1, 0, 1]) {
      const o = polar(center, f, k * 4);
      const a = polar(o, along, -len / 2);
      const b = polar(o, along, len / 2);
      const m0 = polar(o, along, -len / 4), m1 = polar(o, along, len / 4);
      c.line(a.x, a.y, b.x, b.y, 0x6a30d0, 1);
      c.line(m0.x, m0.y, m1.x, m1.y, C.v1, 2);
      c.line(m0.x, m0.y, m1.x, m1.y, C.v2, 1);
      e.line(a.x, a.y, b.x, b.y, C.v1, 2);
    }
    sparkle(c, e, polar(center, along, len / 2 + 1), p.claw > 0.7 ? 3 : 2, C.v2, C.v1);
  
  };

  // Énergie qui converge (derrière le personnage).
  if (p.charge > 0) {
    for (let i = 0; i < 12; i++) {
      const a = i * 2.39996;
      const d = 6 + (1 - p.charge) * 14 + (i % 4) * 2;
      const q = polar(chest, a, d);
      const t = polar(chest, a, d + 2 + p.charge * 2);
      c.line(q.x, q.y, t.x, t.y, i % 3 ? C.v1 : C.v2);
      e.line(q.x, q.y, t.x, t.y, C.v1);
    }
  }
  // Impact au sol vu de dos : il est derrière Varyn (plus loin de la caméra).
  const impactAt = polar({ x: CX, y: FOOT_Y }, f, p.dir === 'side' ? 15 : 7);
  impactAt.y = FOOT_Y + (p.dir === 'down' ? 5 : p.dir === 'up' ? -6 : 0);
  if (p.dir === 'up') {
    groundImpact(c, e, impactAt, p.impact, C.v1, 0);
    drawClaw();
  }

  // Images rémanentes de la lame, derrière tout le reste.
  if (hand && !p.raise) for (const ga of p.ghostA) ghostBlade(c, e, polar(chest, ga, p.handR), ga, BLADE_LEN, 0x7a48d8, 110);

  if (p.dir !== 'up') drawCape(c, p, top, false);
  if (p.sword === 'back' && p.dir !== 'up') drawSwordOnBack(c, e, p, top);
  // Bras libre de profil : derrière le buste.
  if (p.dir === 'side' && p.offR > 0) {
    const sh = { x: CX + lx - 1, y: top + 3 };
    const t = polar(sh, p.offA, p.offR);
    c.line(sh.x, sh.y, t.x, t.y, C.a1, 2);
    shadedRect(c, Math.round(t.x) - 1, Math.round(t.y) - 1, 3, 3, ARMOR_D);
  }
  if (behind) drawSword();
  drawLegs(c, p, hip);
  // Le buste suit l'inclinaison.
  const body = new PixelCanvas(FW, FH);
  const be = new PixelCanvas(FW, FH);
  drawBody(body, be, p, top);
  c.blit(body, lx, 0);
  e.blit(be, lx, 0);
  if (p.dir === 'up') {
    drawCape(c, p, top - 1, true);
    if (p.sword === 'back') drawSwordOnBack(c, e, p, top);
  }
  drawHead(c, e, p, head);
  drawArms(c, e, p, top, hand, claw);
  if (!behind) drawSword();
  c.outline(C.ink);
  if (p.smear > 0) swoosh(c, e, chest, p.smearFrom, p.smearTo, p.handR + 7, p.handR + BLADE_LEN + 1, SMEAR_COLS, p.smearFade);
  if (p.dir !== 'up') drawClaw();
  if (hand && p.sparks > 0) sparkle(c, e, polar(hand, swordAngle, BLADE_LEN), p.sparks > 0.6 ? 3 : 2, C.v2, C.v1);
  if (p.dir !== 'up') groundImpact(c, e, impactAt, p.impact, C.v1, 0);
}

// ------------------------------------------------------------- animations

type Gen = (dir: Dir) => Partial<Pose>[];

const PI = Math.PI;

/**
 * Sens de taille : le coup droit part du côté du bras d'arme (à gauche de
 * l'écran de face, à droite de dos) ; de profil, il part d'en haut derrière.
 */
const sideSign = (dir: Dir) => (dir === 'side' ? -1 : 1);

/** Champs exprimés en pixels : arrondis après interpolation (pas de demi-pixels). */
const PX_FIELDS = ['bob', 'lean', 'kneel', 'air', 'tuck', 'step', 'shake'] as const;

function keyed(dir: Dir, n: number, keys: Key<Pose>[]): Pose[] {
  return sampleKeys(base(dir), keys, n).map((f) => {
    const o = { ...f };
    for (const k of PX_FIELDS) o[k] = Math.round(o[k]);
    return o;
  });
}

/** Coup droit / revers : anticipation, taille, accompagnement, retour en garde. */
const slash = (back: boolean, hop: number): Gen => (dir) => {
  const F = facingAngle(dir);
  const s = sideSign(dir) * (back ? -1 : 1);
  return keyed(dir, 8, [
    { t: 0, p: { sword: 'hand', swordA: F + s * 1.2, handR: 5 } },
    { t: 0.16, ease: 'out', p: { swordA: F + s * 2.5, handR: 4, lean: -1, bob: 1, cape: 0.5, offA: F, offR: 5, glow: 1 } },
    { t: 0.3, ease: 'in', p: { swordA: F - s * 0.1, handR: 8, lean: 2, bob: 0, air: hop, step: 1, trail: 1, flare: 0.7, offA: F + PI, offR: 4, cape: -0.6 } },
    { t: 0.44, ease: 'out', p: { swordA: F - s * 1.35, handR: 8, lean: 3, air: 0, trail: 1, sparks: 1 } },
    { t: 0.6, p: { swordA: F - s * 1.6, handR: 7, lean: 2, trail: 0.35, sparks: 0, flare: 0.3 } },
    { t: 0.8, p: { swordA: F - s * 1.35, handR: 6, lean: 1, trail: 0, step: 0, cape: 0.2, offR: 2 } },
    { t: 1, p: { swordA: F - s * 1.1, handR: 5, lean: 0, offR: 0, flare: 0, cape: 0, glow: 0.6 } },
  ]);
};

/** Bond et frappe verticale : accroupi, saut, lame au-dessus de la tête, impact au sol. */
const leapSlam: Gen = (dir) => {
  const F = facingAngle(dir);
  const s = sideSign(dir);
  return keyed(dir, 10, [
    { t: 0, p: { sword: 'hand', swordA: F + s * 1.2, handR: 5 } },
    { t: 0.12, ease: 'out', p: { kneel: 3, swordA: F + s * 2.0, handR: 4, cape: 0.5, glow: 1, flare: 0.2 } },
    { t: 0.24, ease: 'out', p: { kneel: 0, air: 8, tuck: 3, swordA: F + s * 2.8, handR: 6, flare: 1, bladeGlow: 0.7, offA: F + PI * 0.75, offR: 5 } },
    { t: 0.34, ease: 'in', p: { air: 5, tuck: 2, swordA: F + s * 1.3, handR: 8, lean: 2, trail: 1 } },
    { t: 0.44, ease: 'in', p: { air: 0, tuck: 0, kneel: 4, swordA: F - s * 0.3, handR: 8, lean: 3, trail: 1, impact: 1, sparks: 1, bladeGlow: 1, flare: 0.3 } },
    { t: 0.58, p: { impact: 0.75, trail: 0, sparks: 0.4, bladeGlow: 0.5 } },
    { t: 0.76, p: { impact: 0.3, kneel: 2, sparks: 0, lean: 1, offR: 2 } },
    { t: 1, p: { kneel: 0, impact: 0, bladeGlow: 0, lean: 0, swordA: F - s * 0.8, handR: 5, offR: 0, glow: 0.6 } },
  ]);
};

/** Direction du corps la plus proche d'un angle écran (avec le profil gauche en miroir). */
function bodyDir(a: number): { dir: Dir; mirror: boolean } {
  const x = Math.cos(a), y = Math.sin(a);
  if (Math.abs(y) > Math.abs(x)) return { dir: y > 0 ? 'down' : 'up', mirror: false };
  return { dir: 'side', mirror: x < 0 };
}

/** Coup lourd : charge (lame traînée derrière, énergie qui converge), puis tour complet sur soi-même. */
const spinSlash: Gen = (dir) => {
  const F = facingAngle(dir);
  const s = sideSign(dir);
  const a0 = F + s * 2.6;
  const frames = keyed(dir, 14, [
    { t: 0, p: { sword: 'hand', swordA: F + s * 1.4, handR: 5 } },
    { t: 0.12, ease: 'out', p: { swordA: a0, kneel: 2, handR: 5, offA: F, offR: 5, glow: 1, charge: 0.3, bladeGlow: 0.3, flare: 0.3 } },
    { t: 0.36, ease: 'linear', p: { charge: 1, bladeGlow: 1, shake: 1, kneel: 3, cape: 0.6 } },
    { t: 0.42, ease: 'in', p: { swordA: a0 - s * 0.9, kneel: 1, charge: 0, shake: 0, handR: 7, trail: 1, offR: 3 } },
    { t: 0.5, ease: 'linear', p: { swordA: a0 - s * PI, kneel: 0, air: 2, handR: 8, flare: 1, trail: 1 } },
    { t: 0.6, ease: 'linear', p: { swordA: a0 - s * 2 * PI, air: 0, kneel: 2, impact: 1, sparks: 1, trail: 1 } },
    { t: 0.7, ease: 'out', p: { swordA: a0 - s * (2 * PI + 0.7), impact: 0.6, sparks: 0.3, trail: 0.6, flare: 0.5 } },
    { t: 0.85, p: { impact: 0.2, sparks: 0, trail: 0, kneel: 1, bladeGlow: 0.2, offR: 2 } },
    { t: 1, p: { impact: 0, kneel: 0, bladeGlow: 0, swordA: a0 - s * (2 * PI + 0.5), handR: 5, offR: 0, flare: 0, glow: 0.6, cape: 0 } },
  ]);
  // Le corps tourne avec la lame pendant la rotation.
  return frames.map((f, i) => {
    const t = i / (frames.length - 1);
    const turned = f.swordA - a0;
    if (t < 0.38 || t > 0.72 || Math.abs(turned) < 0.5 || Math.abs(turned) > 2 * PI - 0.5) return f;
    return { ...f, ...bodyDir(F + turned) };
  });
};

/** Griffe abyssale : main libre ramenée, énergie, puis trois entailles projetées. */
const clawStrike: Gen = (dir) => {
  const F = facingAngle(dir);
  return keyed(dir, 9, [
    { t: 0, p: { offA: F, offR: 3 } },
    { t: 0.15, ease: 'out', p: { lean: -1, bob: 1, offA: F + PI, offR: 4, charge: 0.7, glow: 1, cape: 0.4 } },
    { t: 0.3, ease: 'in', p: { lean: 2, bob: 0, step: 1, reach: 1, claw: 0.7, charge: 0, offR: 0, flare: 0.7, cape: -0.6 } },
    { t: 0.42, ease: 'out', p: { lean: 3, reach: 1.3, claw: 1 } },
    { t: 0.6, p: { claw: 0.45, reach: 0.9, lean: 2, flare: 0.3 } },
    { t: 0.8, p: { claw: 0, reach: 0.3, lean: 1, step: 0 } },
    { t: 1, p: { reach: 0, lean: 0, glow: 0.6, cape: 0, flare: 0 } },
  ]);
};

const CLIPS: { name: string; fps: number; loop: boolean; gen: Gen; events?: Record<number, string> }[] = [
  { name: 'idle', fps: 4, loop: true, gen: () => [{}, { glow: 0.8 }, { bob: 1, cape: 0.5, glow: 1 }, { bob: 1, cape: 0.3 }] },
  {
    name: 'walk', fps: 8, loop: true,
    gen: () => [{ step: 1, cape: 0.5 }, { bob: 1, cape: 0.2 }, { step: -1, cape: -0.4 }, { bob: 1, cape: 0 }],
    events: { 0: 'step', 2: 'step' },
  },
  {
    name: 'run', fps: 12, loop: true,
    gen: () => [{ step: 1, lean: 2, flare: 0.6 }, { bob: 1, lean: 2, flare: 0.8 }, { step: -1, lean: 2, flare: 0.6 }, { bob: 1, lean: 2, flare: 0.9 }],
    events: { 0: 'step', 2: 'step' },
  },
  { name: 'attack1', fps: 18, loop: false, gen: slash(false, 0) },
  { name: 'attack2', fps: 18, loop: false, gen: slash(true, 1) },
  { name: 'attack3', fps: 16, loop: false, gen: leapSlam },
  { name: 'heavy', fps: 16, loop: false, gen: spinSlash },
  {
    name: 'dodge', fps: 12, loop: false,
    gen: () => [{ lean: 2, kneel: 1, flare: 0.7 }, { lean: 3, kneel: 2, flare: 1, glow: 1 }, { lean: 1, kneel: 1, flare: 0.4 }],
  },
  {
    name: 'roll', fps: 14, loop: false,
    gen: (dir) => {
      const s = dir === 'up' ? -1 : 1;
      return [
        { kneel: 3, flare: 0.4 },
        { kneel: 6, spin: s * 1.3, flare: 0.8 },
        { kneel: 6, spin: s * 2.6, flare: 0.8 },
        { kneel: 6, spin: s * 3.9, flare: 0.8 },
        { kneel: 6, spin: s * 5.2, flare: 0.8 },
        { kneel: 2, flare: 0.3 },
      ];
    },
  },
  { name: 'hurt', fps: 8, loop: false, gen: () => [{ lean: -2, eyesClosed: true, bob: 1, cape: -0.5 }, { lean: -1, eyesClosed: true }] },
  {
    name: 'death', fps: 6, loop: false,
    gen: () => [
      { lean: -2, eyesClosed: true },
      { kneel: 3, eyesClosed: true, glow: 0.3 },
      { kneel: 5, eyesClosed: true, glow: 0.1, spin: 0.6, spinCy: FOOT_Y - 1 },
      { kneel: 5, eyesClosed: true, glow: 0, spin: 1.45, spinCy: FOOT_Y - 1 },
    ],
  },
  { name: 'cast', fps: 18, loop: false, gen: clawStrike },
  { name: 'interact', fps: 6, loop: false, gen: () => [{ reach: 0.4 }, { reach: 0.9, lean: 1, glow: 1 }] },
  {
    name: 'victory', fps: 4, loop: true,
    gen: () => [{ sword: 'hand', raise: true, glow: 1, flare: 0.4 }, { sword: 'hand', raise: true, glow: 1, bob: -1, flare: 0.6 }],
  },
];

const DIRS: Dir[] = ['down', 'up', 'side'];

export const VARYN_CLIPS: ClipDef<Pose>[] = CLIPS.flatMap((c) =>
  DIRS.map((dir) => ({
    name: `${c.name}@${dir}`,
    fps: c.fps,
    loop: c.loop,
    events: c.events,
    frames: addTrails(c.gen(dir).map((o) => ({ ...base(dir), ...o }))),
  })),
);

/** Reflète les angles écran (miroir horizontal). */
const mirrorA = (a: number) => Math.PI - a;

function draw(p: Pose, c: PixelCanvas, e: PixelCanvas, frame: number): void {
  // Profil gauche : on dessine le profil droit aux angles reflétés, puis on retourne l'image.
  const q: Pose = p.mirror
    ? { ...p, swordA: mirrorA(p.swordA), smearFrom: mirrorA(p.smearFrom), smearTo: mirrorA(p.smearTo), ghostA: p.ghostA.map(mirrorA), offA: mirrorA(p.offA) }
    : p;
  const dx = p.shake > 0 ? (frame % 2 ? 1 : -1) * Math.round(p.shake) : 0;
  const dy = -Math.round(p.air);
  if (!p.mirror && dx === 0 && dy === 0) {
    withSpin(c, e, q.spin, q.spinCx, q.spinCy, (cc, ee) => drawVaryn(q, cc, ee));
    return;
  }
  const tc = new PixelCanvas(FW, FH);
  const te = new PixelCanvas(FW, FH);
  withSpin(tc, te, q.spin, q.spinCx, q.spinCy, (cc, ee) => drawVaryn(q, cc, ee));
  c.blit(tc, dx, dy, p.mirror);
  e.blit(te, dx, dy, p.mirror);
}

let cached: SpriteSheet | null = null;

export function getVarynSheet(): SpriteSheet {
  if (!cached) {
    cached = buildSpriteSheet<Pose>({
      frameW: FW,
      frameH: FH,
      pivotX: CX,
      pivotY: FOOT_Y,
      pixelsPerUnit: 16,
      outline: null,
      facesLeft: false,
      clips: VARYN_CLIPS,
      draw: (pose, c, e, frame) => draw(pose, c, e, frame),
    });
  }
  return cached;
}

/** Zone de la planche servant au portrait du HUD (tête, frame idle de face). */
export function varynPortraitSource(): { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number } {
  const s = getVarynSheet();
  const row = s.clips.get('idle@down')!.row;
  return { canvas: s.debugCanvas, x: CX - 18, y: row * s.frameH + FOOT_Y - 44, w: 36, h: 36 };
}
