import { PixelCanvas } from '../../pixel/PixelCanvas';
import { buildSpriteSheet, type ClipDef, type SpriteSheet } from '../../../entities/animation/SpriteSheet';
import {
  addTrails, blade, CX, facingAngle, FH, FOOT_Y, FW, ghostBlade, polar, sampleKeys, shadedEllipse, shadedRect, sparkle, swoosh, withSpin,
  type Dir, type Key, type Pt, type TrailPose,
} from './chibiKit';

/**
 * Squelette de la crypte en chibi (~48 px) : crâne aux orbites bleues sous un
 * casque rouillé, cage thoracique, épée ébréchée et bouclier rond.
 * Mort : effondrement en tas d'os ; résurrection : la même chose à l'envers.
 */
interface Pose extends TrailPose {
  dir: Dir;
  bob: number;
  lean: number;
  step: number;
  swordA: number;
  handR: number;
  smear: number;
  smearFrom: number;
  smearTo: number;
  shieldUp: boolean;
  jaw: number;
  glow: number;
  /** 0 = debout, 1 = tas d'os. */
  collapse: number;
  spin: number;
  sparks: number;
  /** Tremblement d'os (±1 px une frame sur deux). */
  shake: number;
}

const C = {
  ink: 0x0a080c,
  b0: 0x5d5448, b1: 0x9b9180, b2: 0xcfc6b0, b3: 0xf0ead8,
  r0: 0x3a2418, r1: 0x6b3f22, r2: 0x9a6033,
  w0: 0x2a1c14, w1: 0x4a3222, w2: 0x6e4c30,
  eye: 0x58c8ff, eyeHi: 0xd8f4ff,
  st0: 0x403a3a, st1: 0x7a7270, st2: 0xb0a8a0,
};
const BONE = { lo: C.b0, mid: C.b1, hi: C.b2 };
const BONE_HI = { lo: C.b1, mid: C.b2, hi: C.b3 };
const WOOD = { lo: C.w0, mid: C.w1, hi: C.w2 };
const SWORD = { edge: C.st2, mid: C.st1, dark: C.st0, guard: C.r1, grip: C.w1 };

function base(dir: Dir): Pose {
  return { dir, bob: 0, lean: 0, step: 0, swordA: facingAngle(dir) + 0.9, handR: 5, smear: 0, smearFrom: 0, smearTo: 0, shieldUp: false, jaw: 0, glow: 0.6, collapse: 0, spin: 0, trail: 0, smearFade: 0, ghostA: [], sparks: 0, shake: 0 };
}

function eyes(c: PixelCanvas, e: PixelCanvas, xs: number[], y: number, glow: number): void {
  for (const x of xs) {
    c.rect(x, y, 2, 2, C.ink);
    if (glow <= 0) continue;
    c.px(x, y, C.eye);
    e.px(x, y, glow > 0.7 ? C.eyeHi : C.eye);
    if (glow > 0.7) {
      c.px(x + 1, y, C.eye);
      e.px(x + 1, y, C.eye);
    }
  }
}

function drawSkull(c: PixelCanvas, e: PixelCanvas, p: Pose, h: Pt): void {
  const x = Math.round(h.x), y = Math.round(h.y);
  const side = p.dir === 'side';
  shadedEllipse(c, x, y, side ? 7.5 : 8, 7.5, BONE_HI);
  // Mâchoire.
  const jw = side ? 5 : 7;
  const jx = side ? x - 1 : x - 3;
  shadedRect(c, jx, y + 5 + p.jaw, jw, 3, BONE);
  if (p.dir !== 'up') for (let i = 0; i < jw; i += 2) c.px(jx + i, y + 5 + p.jaw, C.ink);
  // Casque rouillé : calotte et cimier.
  for (let yy = y - 8; yy <= y - 2; yy++)
    for (let xx = x - 9; xx <= x + 9; xx++) {
      const dx = (xx + 0.5 - x) / 8.6, dy = (yy + 0.5 - y) / 8;
      if (dx * dx + dy * dy <= 1) c.px(xx, yy, yy === y - 2 ? C.r0 : dx < -0.2 && dy < -0.6 ? C.r2 : C.r1);
    }
  c.rect(x - 1, y - 10, 2, 3, C.r2);
  if (p.dir === 'up') return;
  if (side) {
    eyes(c, e, [x + 2], y, p.glow);
    c.px(x + 6, y + 3, C.ink);
  } else {
    eyes(c, e, [x - 4, x + 2], y, p.glow);
    c.px(x, y + 3, C.ink);
  }
}

function drawRibs(c: PixelCanvas, p: Pose, top: number, lx: number): void {
  const side = p.dir === 'side';
  const x0 = CX + lx + (side ? -3 : -5);
  const w = side ? 7 : 11;
  c.rect(CX + lx, top, 1, 10, C.b1); // colonne
  for (let i = 0; i < 4; i++) {
    const y = top + 1 + i * 2;
    const inset = i === 3 ? 2 : 0;
    c.rect(x0 + inset, y, w - inset * 2, 1, i === 0 ? C.b3 : C.b2);
    c.px(x0 + inset, y + 1, C.b0);
    c.px(x0 + w - 1 - inset, y + 1, C.b0);
  }
  // Bassin.
  shadedRect(c, CX + lx - (side ? 3 : 4), top + 9, side ? 6 : 9, 2, BONE);
  // Ceinture de cuir en lambeaux.
  c.rect(CX + lx - (side ? 3 : 5), top + 8, side ? 7 : 11, 1, C.w1);
}

function drawLegs(c: PixelCanvas, p: Pose, hip: number): void {
  if (p.dir === 'side') {
    for (const [dx, lift, cols] of [[-1 - p.step * 3, p.step < 0 ? 0 : Math.abs(p.step), BONE], [2 + p.step * 3, p.step > 0 ? 0 : Math.abs(p.step), BONE_HI]] as const) {
      c.rect(CX + dx, hip, 2, FOOT_Y - hip - 1 - lift, cols.mid);
      c.px(CX + dx, hip + 4, cols.hi);
      shadedRect(c, CX + dx - 1, FOOT_Y - 2 - lift, 4, 2, cols);
    }
    return;
  }
  const l = FOOT_Y - hip - 1 + Math.max(0, p.step) - Math.max(0, -p.step);
  const r = FOOT_Y - hip - 1 + Math.max(0, -p.step) - Math.max(0, p.step);
  for (const [x, len] of [[CX - 4, l], [CX + 3, r]] as const) {
    c.rect(x, hip, 2, len - 1, C.b2);
    c.px(x, hip + 4, C.b3);
    shadedRect(c, x - 1, hip + len - 2, 4, 2, BONE);
  }
}

function drawShield(c: PixelCanvas, at: Pt, front: boolean): void {
  shadedEllipse(c, at.x, at.y, front ? 5 : 2.5, 5, WOOD);
  if (front) {
    c.line(at.x - 4, at.y, at.x + 4, at.y, C.r1);
    c.rect(Math.round(at.x) - 1, Math.round(at.y) - 1, 3, 3, C.r2);
  } else c.line(at.x, at.y - 4, at.x, at.y + 4, C.r1);
}

function drawSkeleton(p: Pose, c: PixelCanvas, e: PixelCanvas): void {
  const F = facingAngle(p.dir);
  const lx = Math.round(Math.cos(F) * p.lean);
  const top = FOOT_Y - 19 + p.bob;
  const hip = top + 10;
  const head = { x: CX + lx + (p.dir === 'side' ? 1 : 0), y: FOOT_Y - 29 + p.bob + Math.max(0, p.lean < 0 ? 1 : 0) };
  const chest = { x: CX + lx, y: top + 3 };
  const hand = polar(chest, p.swordA, p.handR);
  // Bras d'arme et bras de bouclier selon la direction.
  const swordSide = p.dir === 'down' ? -1 : 1;
  const shieldAt: Pt =
    p.dir === 'side'
      ? { x: chest.x + (p.shieldUp ? 6 : 2), y: chest.y + (p.shieldUp ? 0 : 3) }
      : { x: chest.x - swordSide * (p.shieldUp ? 4 : 7), y: chest.y + (p.shieldUp ? 1 : 3) };
  const swordBehind = p.dir === 'up' ? Math.sin(p.swordA) < 0.4 : p.dir === 'side' ? false : Math.sin(p.swordA) < -0.88;
  const shieldBehind = p.dir === 'up' || (p.dir === 'side' && !p.shieldUp);

  for (const ga of p.ghostA) ghostBlade(c, e, polar(chest, ga, p.handR), ga, 15, 0x3a8ad0, 110);
  if (shieldBehind) drawShield(c, shieldAt, p.dir === 'up');
  if (swordBehind) blade(c, e, hand, p.swordA, 15, SWORD);
  drawLegs(c, p, hip);
  drawRibs(c, p, top, lx);
  drawSkull(c, e, p, head);
  // Bras (os fins).
  const shoulders = p.dir === 'side' ? [{ x: chest.x, y: top + 1 }] : [{ x: chest.x + swordSide * 6, y: top + 1 }, { x: chest.x - swordSide * 6, y: top + 1 }];
  c.line(shoulders[0].x, shoulders[0].y, hand.x, hand.y, C.b2, 1);
  c.rect(Math.round(hand.x) - 1, Math.round(hand.y) - 1, 2, 2, C.b3);
  if (shoulders[1]) c.line(shoulders[1].x, shoulders[1].y, shieldAt.x, shieldAt.y, C.b1, 1);
  if (!shieldBehind) drawShield(c, shieldAt, p.dir !== 'side' || p.shieldUp);
  if (!swordBehind) blade(c, e, hand, p.swordA, 15, SWORD);
  c.outline(C.ink);
  if (p.smear > 0) swoosh(c, e, chest, p.smearFrom, p.smearTo, p.handR + 6, p.handR + 16, [0x2a6ab0, 0x58c8ff, 0xd8f4ff], p.smearFade);
  if (p.sparks > 0) sparkle(c, e, polar(hand, p.swordA, 15), p.sparks > 0.6 ? 3 : 2, C.eyeHi, C.eye);
}

/** Tas d'os : le squelette s'effondre progressivement (collapse 0..1). */
function drawPile(p: Pose, c: PixelCanvas, e: PixelCanvas): void {
  const t = p.collapse;
  const y = FOOT_Y;
  // Os éparpillés au sol.
  const bones: [number, number, number, number][] = [[-9, -1, -3, -2], [3, -1, 9, 0], [-5, -3, 1, -2], [-2, 0, 5, -2], [6, -3, 10, -4]];
  for (const [x0, y0, x1, y1] of bones) c.line(CX + x0 * t, y + y0, CX + x1 * t, y + y1, C.b2, 2);
  // Côtes affaissées.
  for (let i = 0; i < 3; i++) c.rect(CX - 4 + i, y - 4 - i * 2 * (1 - t) - 2, 9 - i * 2, 1, C.b2);
  // Épée et bouclier au sol.
  blade(c, e, { x: CX - 10, y: y - 1 }, -0.1, 15, SWORD, 2);
  drawShield(c, { x: CX + 9, y: y - 3 }, true);
  // Crâne qui retombe.
  const head = { x: CX - 2 + t * 3, y: y - 6 - (1 - t) * 10 };
  drawSkull(c, e, { ...p, dir: 'down', jaw: 1, glow: p.glow * (1 - t * 0.8) }, head);
  c.outline(C.ink);
}

// ------------------------------------------------------------- animations

type Gen = (dir: Dir) => Partial<Pose>[];

/** Le coup part du côté du bras d'arme (gauche de face, droite de dos, d'en haut derrière de profil). */
const sideSign = (dir: Dir) => (dir === 'side' ? -1 : 1);
const PX_FIELDS = ['bob', 'lean', 'step', 'jaw', 'shake'] as const;

function keyed(dir: Dir, n: number, keys: Key<Pose>[]): Pose[] {
  return sampleKeys(base(dir), keys, n).map((f) => {
    const o = { ...f };
    for (const k of PX_FIELDS) o[k] = Math.round(o[k]);
    return o;
  });
}

/** Armé : l'épée remonte derrière l'épaule, le squelette se cambre et claque des os. */
const windup: Gen = (dir) => {
  const F = facingAngle(dir);
  const s = sideSign(dir);
  return keyed(dir, 6, [
    { t: 0, p: { swordA: F + s * 1.2, handR: 5 } },
    { t: 0.35, ease: 'out', p: { swordA: F + s * 2.3, handR: 4, lean: -1, jaw: 1, glow: 1 } },
    { t: 0.7, p: { swordA: F + s * 2.5, handR: 4, lean: -2, bob: 1, jaw: 2, shake: 1 } },
    { t: 1, p: { swordA: F + s * 2.6, shake: 1, jaw: 1 } },
  ]);
};

/** Frappe : fente en avant, taille rapide avec traînée et rémanences, accompagnement. */
const strike: Gen = (dir) => {
  const F = facingAngle(dir);
  const s = sideSign(dir);
  return keyed(dir, 6, [
    { t: 0, p: { swordA: F + s * 2.6, handR: 4, lean: -1, glow: 1, jaw: 2 } },
    { t: 0.25, ease: 'in', p: { swordA: F + s * 0.6, handR: 7, lean: 2, step: 1, trail: 1 } },
    { t: 0.45, ease: 'out', p: { swordA: F - s * 1.1, handR: 8, lean: 3, trail: 1, sparks: 1 } },
    { t: 0.7, p: { swordA: F - s * 1.4, handR: 7, lean: 2, trail: 0.4, sparks: 0, jaw: 1 } },
    { t: 1, p: { swordA: F - s * 1.3, handR: 6, lean: 1, trail: 0 } },
  ]);
};

/** Récupération : l'élan retombe, le crâne vacille, retour en garde. */
const recover: Gen = (dir) => {
  const F = facingAngle(dir);
  const s = sideSign(dir);
  return keyed(dir, 5, [
    { t: 0, p: { swordA: F - s * 1.3, handR: 6, lean: 1, step: 1 } },
    { t: 0.3, p: { swordA: F - s * 1.0, handR: 5, lean: 0, bob: 1, jaw: 1, step: 0 } },
    { t: 0.6, p: { swordA: F + 0.5, bob: 0, jaw: 0, lean: -1 } },
    { t: 1, p: { swordA: F + 0.9, handR: 5, lean: 0 } },
  ]);
};

const CLIPS: { name: string; fps: number; loop: boolean; gen: Gen; events?: Record<number, string> }[] = [
  { name: 'idle', fps: 4, loop: true, gen: () => [{}, { bob: 1, glow: 0.8 }, { bob: 1, jaw: 1 }, {}] },
  {
    name: 'walk', fps: 7, loop: true,
    gen: () => [{ step: 1 }, { bob: 1, jaw: 1 }, { step: -1 }, { bob: 1 }],
    events: { 0: 'rattle', 2: 'rattle' },
  },
  { name: 'windup', fps: 10, loop: false, gen: windup },
  { name: 'attack', fps: 18, loop: false, gen: strike },
  { name: 'recover', fps: 9, loop: false, gen: recover },
  { name: 'block', fps: 8, loop: false, gen: () => [{ shieldUp: true, lean: -1 }, { shieldUp: true, bob: 1 }] },
  { name: 'hurt', fps: 10, loop: false, gen: () => [{ lean: -2, jaw: 2, glow: 1, bob: 1 }, { lean: -1, jaw: 1 }] },
];

const DIRS: Dir[] = ['down', 'up', 'side'];
const DEATH: Partial<Pose>[] = [{ lean: -2, jaw: 2, glow: 1 }, { collapse: 0.3, glow: 0.8 }, { collapse: 0.6, glow: 0.5 }, { collapse: 0.85, glow: 0.2 }, { collapse: 1, glow: 0 }];

export const SKELETON_CLIPS: ClipDef<Pose>[] = [
  ...CLIPS.flatMap((c) =>
    DIRS.map((dir) => ({
      name: `${c.name}@${dir}`,
      fps: c.fps,
      loop: c.loop,
      events: c.events,
      frames: addTrails(c.gen(dir).map((o) => ({ ...base(dir), ...o }))),
    })),
  ),
  // Mort et résurrection : identiques dans toutes les directions.
  { name: 'death', fps: 9, loop: false, events: { 2: 'collapse' }, frames: DEATH.map((o) => ({ ...base('down'), ...o })) },
  { name: 'rise', fps: 8, loop: false, events: { 0: 'rattle' }, frames: [...DEATH].reverse().map((o) => ({ ...base('down'), ...o })) },
];

function draw(p: Pose, c: PixelCanvas, e: PixelCanvas, frame: number): void {
  const paint = (cc: PixelCanvas, ee: PixelCanvas) =>
    withSpin(cc, ee, p.spin, CX, FOOT_Y - 11, (c2, e2) => (p.collapse > 0 ? drawPile(p, c2, e2) : drawSkeleton(p, c2, e2)));
  if (!p.shake) {
    paint(c, e);
    return;
  }
  const tc = new PixelCanvas(FW, FH);
  const te = new PixelCanvas(FW, FH);
  paint(tc, te);
  const dx = frame % 2 ? p.shake : -p.shake;
  c.blit(tc, dx, 0);
  e.blit(te, dx, 0);
}

let cached: SpriteSheet | null = null;

export function getSkeletonSheet(): SpriteSheet {
  if (!cached) {
    cached = buildSpriteSheet<Pose>({
      frameW: FW,
      frameH: FH,
      pivotX: CX,
      pivotY: FOOT_Y,
      pixelsPerUnit: 16,
      outline: null,
      facesLeft: false,
      clips: SKELETON_CLIPS,
      draw: (pose, c, e, frame) => draw(pose, c, e, frame),
    });
  }
  return cached;
}
