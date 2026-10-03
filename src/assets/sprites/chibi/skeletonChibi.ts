import { PixelCanvas } from '../../pixel/PixelCanvas';
import { buildSpriteSheet, type ClipDef, type SpriteSheet } from '../../../entities/animation/SpriteSheet';
import {
  addTrails, blade, CX, facingAngle, FH, FOOT_Y, FW, ghostBlade, polar, sampleKeys, shadedEllipse, shadedRect, sparkle, swoosh, withSpin,
  type Dir, type Key, type Pt, type TrailPose,
} from './chibiKit';
import { foreshorten, forwardVec, gait, ik2, joint, segment, type Chain } from './chibiRig';

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
  /** Flexion des genoux (px) : le bassin descend, les pieds restent au sol. */
  kneel: number;
  /** Pieds A/B : avancée et levée (px). */
  fa: number;
  fb: number;
  la: number;
  lb: number;
  /** Balancement des bras. */
  swing: number;
  /** Crâne : hochement (px) et inclinaison latérale (px). */
  headTilt: number;
  headTurn: number;
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
  return { dir, bob: 0, lean: 0, step: 0, swordA: facingAngle(dir) + 0.9, handR: 5, smear: 0, smearFrom: 0, smearTo: 0, shieldUp: false, jaw: 0, glow: 0.6, collapse: 0, spin: 0, trail: 0, smearFade: 0, ghostA: [], sparks: 0, shake: 0, kneel: 0, fa: 0, fb: 0, la: 0, lb: 0, swing: 0, headTilt: 0, headTurn: 0 };
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

const THIGH = 5, SHIN = 5.6;
const UPPER = 4.5, FORE = 4.5;
/** Contour intérieur entre les os. */
const INNER = 0x1a1410;

interface Bones {
  pelvis: Pt;
  chest: Pt;
  head: Pt;
  top: number;
  legA: Chain;
  legB: Chain;
  armW: Chain;
  armS: Chain;
  shieldAt: Pt;
}

/** Squelette au sens propre : bassin, colonne, crâne et membres en cinématique inverse. */
function solve(p: Pose): Bones {
  const F = facingAngle(p.dir);
  const fwd = forwardVec(p.dir);
  const side = p.dir === 'side';
  const lx = Math.round(Math.cos(F) * p.lean);
  const pelvis = { x: CX + Math.round(lx * 0.3), y: FOOT_Y - 11 + p.bob + p.kneel };
  const top = pelvis.y - 9;
  const chest = { x: CX + lx, y: top + 3 };
  const head = { x: chest.x + (side ? 1 : 0) + Math.round(p.headTurn), y: top - 10 + Math.round(p.headTilt) + (p.lean < 0 ? 1 : 0) };
  const hipA = side ? { x: pelvis.x + 1, y: pelvis.y } : { x: pelvis.x - 3, y: pelvis.y };
  const hipB = side ? { x: pelvis.x - 1, y: pelvis.y } : { x: pelvis.x + 3, y: pelvis.y };
  const fa = p.fa + p.step * 3, fb = p.fb - p.step;
  const footA = { x: (side ? CX + 1 : CX - 3.5) + fwd.x * fa, y: FOOT_Y - 1 - p.la + fwd.y * fa };
  const footB = { x: (side ? CX - 1 : CX + 3.5) + fwd.x * fb, y: FOOT_Y - 1 - p.lb + fwd.y * fb };
  // De face/de dos, les genoux plient vers la caméra : écart latéral réduit.
  const fs = (ch: Chain) => (side ? ch : foreshorten(ch, 0.3));
  const legA = fs(ik2(hipA, footA, THIGH, SHIN, side ? { x: 1, y: 0.2 } : { x: -1, y: 0.3 }));
  const legB = fs(ik2(hipB, footB, THIGH, SHIN, side ? { x: 1, y: 0.2 } : { x: 1, y: 0.3 }));
  // Bras d'épée : gauche à l'écran de face, droite de dos, proche de profil.
  const ws = p.dir === 'down' ? -1 : 1;
  const shW = side ? { x: chest.x, y: top + 1 } : { x: chest.x + ws * 6, y: top + 1 };
  const shS = side ? { x: chest.x - 2, y: top + 1 } : { x: chest.x - ws * 6, y: top + 1 };
  const hand = polar(shW, p.swordA, p.handR);
  const shieldAt: Pt = side
    ? { x: chest.x + (p.shieldUp ? 6 : 2) + p.swing, y: chest.y + (p.shieldUp ? 0 : 3) }
    : { x: chest.x - ws * (p.shieldUp ? 4 : 7), y: chest.y + (p.shieldUp ? 1 : 3) + p.swing * fwd.y * 2 };
  const out = (sh: Pt) => (side ? -1 : Math.sign(sh.x - chest.x));
  const armW = ik2(shW, hand, UPPER, FORE, { x: out(shW), y: 0.8 });
  const armS = ik2(shS, shieldAt, UPPER, FORE, { x: out(shS), y: 0.8 });
  return { pelvis, chest, head, top, legA, legB, armW, armS, shieldAt };
}

/** Colonne vertébrale, cage thoracique qui suit l'inclinaison, bassin et ceinture. */
function drawTorso(c: PixelCanvas, p: Pose, b: Bones): void {
  const side = p.dir === 'side';
  const { pelvis, top } = b;
  const spineAt = (y: number) => pelvis.x + ((b.chest.x - pelvis.x) * (pelvis.y - y)) / (pelvis.y - top);
  // Vertèbres.
  for (let y = top; y <= pelvis.y; y++) c.px(spineAt(y), y, y % 2 ? C.b1 : C.b2);
  // Côtes : quatre arcs, plus courts vers le bas.
  for (let i = 0; i < 4; i++) {
    const y = top + 1 + i * 2;
    const x = Math.round(spineAt(y));
    const half = (side ? 3 : 5) - (i === 3 ? 2 : 0);
    const x0 = side ? x - 2 : x - half;
    const w = side ? half + 3 : half * 2 + 1;
    c.rect(x0, y, w, 1, i === 0 ? C.b3 : C.b2);
    c.px(x0, y + 1, C.b0);
    c.px(x0 + w - 1, y + 1, C.b0);
  }
  // Bassin et ceinture de cuir en lambeaux.
  shadedRect(c, pelvis.x - (side ? 3 : 4), pelvis.y - 1, side ? 6 : 9, 2, BONE);
  c.rect(pelvis.x - (side ? 3 : 5), pelvis.y - 2, side ? 7 : 11, 1, C.w1);
  c.px(pelvis.x + (side ? -3 : 3), pelvis.y, C.w1);
}

function drawBoneLeg(c: PixelCanvas, leg: Chain, near: boolean): void {
  const cols = near ? BONE_HI : BONE;
  segment(c, leg.root, leg.mid, 2, cols); // fémur
  segment(c, leg.mid, leg.end, 2, cols); // tibia
  joint(c, leg.mid, 1, BONE_HI); // rotule
  shadedRect(c, Math.round(leg.end.x) - 1, Math.round(leg.end.y) - 1, 4, 2, cols); // os du pied
}

function drawBoneArm(c: PixelCanvas, arm: Chain, near: boolean): void {
  const cols = near ? BONE_HI : BONE;
  c.line(arm.root.x, arm.root.y, arm.mid.x, arm.mid.y, cols.mid, 2); // humérus
  c.line(arm.mid.x, arm.mid.y, arm.end.x, arm.end.y, cols.hi, 1); // radius et cubitus
  joint(c, arm.mid, 1, BONE_HI);
  joint(c, arm.root, 1, BONE_HI); // tête d'épaule
  c.rect(Math.round(arm.end.x) - 1, Math.round(arm.end.y) - 1, 2, 2, C.b3); // phalanges
}

function drawShield(c: PixelCanvas, at: Pt, front: boolean): void {
  shadedEllipse(c, at.x, at.y, front ? 5 : 2.5, 5, WOOD);
  if (front) {
    c.line(at.x - 4, at.y, at.x + 4, at.y, C.r1);
    c.rect(Math.round(at.x) - 1, Math.round(at.y) - 1, 3, 3, C.r2);
  } else c.line(at.x, at.y - 4, at.x, at.y + 4, C.r1);
}

function drawSkeleton(p: Pose, c: PixelCanvas, e: PixelCanvas): void {
  const b = solve(p);
  const side = p.dir === 'side';
  const hand = b.armW.end;
  const pivot = b.armW.root;
  const swordBehind = p.dir === 'up' ? Math.sin(p.swordA) < 0.4 : side ? false : Math.sin(p.swordA) < -0.88;
  const shieldBehind = p.dir === 'up' || (side && !p.shieldUp);
  /** Chaque os est contouré sur son calque pour rester lisible. */
  const part = (fn: (pc: PixelCanvas) => void) => {
    const pc = new PixelCanvas(FW, FH);
    fn(pc);
    pc.outline(INNER);
    c.blit(pc, 0, 0);
  };

  for (const ga of p.ghostA) ghostBlade(c, e, polar(pivot, ga, p.handR), ga, 15, 0x3a8ad0, 110);
  if (shieldBehind) {
    part((pc) => drawBoneArm(pc, b.armS, false));
    part((pc) => drawShield(pc, b.shieldAt, p.dir === 'up'));
  }
  if (swordBehind) blade(c, e, hand, p.swordA, 15, SWORD);
  if (side) part((pc) => drawBoneLeg(pc, b.legB, false));
  else {
    part((pc) => drawBoneLeg(pc, b.legB, true));
  }
  part((pc) => drawBoneLeg(pc, b.legA, true));
  part((pc) => drawTorso(pc, p, b));
  part((pc) => drawSkull(pc, e, p, b.head));
  part((pc) => drawBoneArm(pc, b.armW, true));
  if (!shieldBehind) {
    part((pc) => drawBoneArm(pc, b.armS, !side));
    part((pc) => drawShield(pc, b.shieldAt, !side || p.shieldUp));
  }
  if (!swordBehind) blade(c, e, hand, p.swordA, 15, SWORD);
  c.outline(C.ink);
  if (p.smear > 0) swoosh(c, e, pivot, p.smearFrom, p.smearTo, p.handR + 5, p.handR + 16, [0x2a6ab0, 0x58c8ff, 0xd8f4ff], p.smearFade);
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
const PX_FIELDS = ['bob', 'lean', 'jaw', 'shake', 'kneel', 'fa', 'fb', 'la', 'lb', 'headTilt', 'headTurn'] as const;

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
    { t: 0, p: { swordA: F + s * 1.2, handR: 6 } },
    // Le squelette se ramasse : genoux pliés, pied arrière reculé, crâne baissé vers sa cible.
    { t: 0.35, ease: 'out', p: { swordA: F + s * 2.3, handR: 6, lean: -1, kneel: 2, fa: 1, fb: -2, jaw: 1, glow: 1, headTilt: 1 } },
    { t: 0.7, p: { swordA: F + s * 2.5, handR: 7, lean: -2, kneel: 3, jaw: 2, shake: 1, shieldUp: true } },
    { t: 1, p: { swordA: F + s * 2.6, shake: 1, jaw: 1, headTurn: 1 } },
  ]);
};

/** Frappe : fente en avant, taille rapide avec traînée et rémanences, accompagnement. */
const strike: Gen = (dir) => {
  const F = facingAngle(dir);
  const s = sideSign(dir);
  return keyed(dir, 6, [
    { t: 0, p: { swordA: F + s * 2.6, handR: 7, lean: -1, kneel: 3, fa: 1, fb: -2, glow: 1, jaw: 2, shieldUp: true } },
    // Fente : le pied d'appel avance, le buste plonge, le bouclier recule en contrepoids.
    { t: 0.25, ease: 'in', p: { swordA: F + s * 0.6, handR: 9, lean: 2, kneel: 2, step: 1, trail: 1, shieldUp: false, swing: -1 } },
    { t: 0.45, ease: 'out', p: { swordA: F - s * 1.1, handR: 9, lean: 3, kneel: 3, trail: 1, sparks: 1, headTilt: 1 } },
    { t: 0.7, p: { swordA: F - s * 1.4, handR: 8, lean: 2, trail: 0.4, sparks: 0, jaw: 1 } },
    { t: 1, p: { swordA: F - s * 1.3, handR: 7, lean: 1, kneel: 1, trail: 0, headTilt: 0 } },
  ]);
};

/** Récupération : l'élan retombe, le crâne vacille, retour en garde. */
const recover: Gen = (dir) => {
  const F = facingAngle(dir);
  const s = sideSign(dir);
  return keyed(dir, 5, [
    { t: 0, p: { swordA: F - s * 1.3, handR: 7, lean: 1, kneel: 1, step: 1 } },
    // L'élan retombe : la lame traîne, le crâne vacille d'un côté puis de l'autre.
    { t: 0.3, p: { swordA: F - s * 1.0, handR: 7, lean: 0, kneel: 2, jaw: 1, step: 0.5, headTurn: 1, headTilt: 1 } },
    { t: 0.6, p: { swordA: F + 0.5, kneel: 1, jaw: 0, lean: -1, headTurn: -1, step: 0 } },
    { t: 1, p: { swordA: F + 0.9, handR: 6, lean: 0, kneel: 0, headTurn: 0, headTilt: 0 } },
  ]);
};

const CLIPS: { name: string; fps: number; loop: boolean; gen: Gen; events?: Record<number, string> }[] = [
  {
    // Au repos : le squelette oscille, la mâchoire claque, le crâne penche.
    name: 'idle', fps: 5, loop: true,
    gen: () => [{}, { kneel: 1, glow: 0.8 }, { kneel: 1, jaw: 1, headTurn: 1 }, { headTurn: 1 }, { jaw: 1 }, { kneel: 1, headTilt: 1 }],
  },
  {
    // Démarche traînante : foulée courte, buste voûté, bras ballants, crâne qui ballotte.
    name: 'walk', fps: 9, loop: true,
    gen: () => gait(8, false).map((g, i) => ({
      fa: Math.round(g.fa * 0.8), fb: Math.round(g.fb * 0.8), la: g.la, lb: g.lb, bob: g.bob, swing: Math.round(g.swing),
      lean: 1, headTurn: i % 4 === 1 ? 1 : i % 4 === 3 ? -1 : 0, jaw: i % 4 === 2 ? 1 : 0,
    })),
    events: { 0: 'rattle', 4: 'rattle' },
  },
  { name: 'windup', fps: 10, loop: false, gen: windup },
  { name: 'attack', fps: 18, loop: false, gen: strike },
  { name: 'recover', fps: 9, loop: false, gen: recover },
  { name: 'block', fps: 8, loop: false, gen: () => [{ shieldUp: true, lean: -1, kneel: 1, fb: -2 }, { shieldUp: true, kneel: 2, fb: -2, headTilt: 1 }] },
  {
    // Blessure : le crâne part en arrière, les genoux plient, les bras s'écartent.
    name: 'hurt', fps: 10, loop: false,
    gen: () => [{ lean: -2, jaw: 2, glow: 1, kneel: 1, headTilt: -1, swing: 1 }, { lean: -2, kneel: 2, jaw: 1, headTurn: 1 }, { lean: -1, kneel: 1 }],
  },
];

const DIRS: Dir[] = ['down', 'up', 'side'];
const DEATH: Partial<Pose>[] = [{ lean: -2, jaw: 2, glow: 1, headTilt: -1 }, { kneel: 4, lean: 1, jaw: 2, glow: 0.9, headTilt: 2 }, { collapse: 0.3, glow: 0.8 }, { collapse: 0.6, glow: 0.5 }, { collapse: 0.85, glow: 0.2 }, { collapse: 1, glow: 0 }];

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
