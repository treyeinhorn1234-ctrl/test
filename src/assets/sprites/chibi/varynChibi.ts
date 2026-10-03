import { PixelCanvas } from '../../pixel/PixelCanvas';
import { buildSpriteSheet, type ClipDef, type SpriteSheet } from '../../../entities/animation/SpriteSheet';
import {
  addTrails, blade, CX, facingAngle, FH, FOOT_Y, FW, ghostBlade, groundImpact, polar, sampleKeys, shadedEllipse, shadedRect, sparkle, swoosh,
  withSpin, type Dir, type Key, type Pt, type TrailPose,
} from './chibiKit';
import { along, foreshorten, forwardVec, gait, ik2, joint, segment, type Chain } from './chibiRig';

/**
 * Varyn en chibi (style RPG Maker) : ~48 px de haut, grosse tête casquée à
 * cornes et couronne brisée, yeux rouges, armure noire à reflets violets,
 * cape pourpre, épée Eclipse dans le dos (en main pour combattre).
 *
 * Rig complet : bassin, colonne (inclinaison, torsion, respiration), cou et
 * tête (hochement, regard), épaules → coudes → poignets et hanches → genoux
 * → chevilles en cinématique inverse, cape en tissu ondulant.
 * 4 directions : bas, haut, côté (droite ; la gauche est le miroir).
 */
interface Pose extends TrailPose {
  dir: Dir;
  /** Profil gauche (miroir du profil droit), pour les rotations sur soi-même. */
  mirror: boolean;
  /** Bassin plus bas (px, positif vers le bas). */
  bob: number;
  /** Inclinaison du buste (px) dans la direction regardée : la colonne se plie, les pieds restent. */
  lean: number;
  /** Pas d'attaque : pied d'appel en avant (0..1). */
  step: number;
  /** Pieds A (gauche de face / proche de profil) et B : avancée (px) et levée (px). */
  fa: number;
  fb: number;
  la: number;
  lb: number;
  /** Balancement des bras (-1..1), opposé aux jambes. */
  swing: number;
  /** Torsion des épaules (-1..1). */
  twist: number;
  /** Respiration : épaules et buste qui se soulèvent (0..1). */
  breath: number;
  /** Tête : hochement (px, positif vers le bas) et regard latéral (-1..1). */
  headTilt: number;
  headTurn: number;
  /** Phase d'ondulation de la cape. */
  wave: number;
  sword: 'back' | 'hand';
  swordA: number;
  /** Distance épaule → main d'arme. */
  handR: number;
  cape: number;
  flare: number;
  claw: number;
  reach: number;
  eyesClosed: boolean;
  glow: number;
  /** Flexion des genoux (px) : le bassin descend, les pieds restent au sol. */
  kneel: number;
  /** Rotation finale de toute l'image (roulade, chute). */
  spin: number;
  spinCx: number;
  spinCy: number;
  raise: boolean;
  sparks: number;
  bladeGlow: number;
  impact: number;
  charge: number;
  shake: number;
  /** Hauteur de saut (px) : tout le personnage décolle. */
  air: number;
  /** Pieds repliés vers le bassin (px). */
  tuck: number;
  /** Main libre : angle et distance à l'épaule (0 : bras au repos). */
  offA: number;
  offR: number;
}

const C = {
  ink: 0x07050b,
  a0: 0x1c1824, a1: 0x2e2838, a2: 0x463d52, a3: 0x6c607a, a4: 0xa898b4,
  c0: 0x22122c, c1: 0x381f48, c2: 0x552d6e, c3: 0x7a44a0, c4: 0x9a5cc8,
  v1: 0x9d5cff, v2: 0xd9b8ff, v0: 0x6a34c0,
  eye: 0xff3434, eyeHi: 0xffb0a0,
  st0: 0x3a3542, st1: 0x6a6476, st2: 0xb6aec2,
  grip: 0x3a2a2e, mail: 0x2a2433,
};
/** Contour intérieur entre les parties du corps. */
const INNER = 0x0c0912;
const ARMOR = { lo: C.a0, mid: C.a2, hi: C.a3 };
const ARMOR_HI = { lo: C.a1, mid: C.a3, hi: C.a4 };
const ARMOR_D = { lo: C.a0, mid: C.a1, hi: C.a2 };
const MAIL = { lo: C.a0, mid: C.mail, hi: C.a1 };
const SWORD = { edge: C.st2, mid: C.st1, dark: C.st0, guard: C.a3, grip: C.grip, rune: C.v1 };

const THIGH = 5.6, SHIN = 6;
const UPPER = 4.5, FORE = 4.5;

function base(dir: Dir): Pose {
  return {
    dir, mirror: false, bob: 0, lean: 0, step: 0, fa: 0, fb: 0, la: 0, lb: 0, swing: 0, twist: 0, breath: 0, headTilt: 0, headTurn: 0, wave: 0,
    sword: 'back', swordA: 0, handR: 6, cape: 0, flare: 0, claw: 0, reach: 0, eyesClosed: false, glow: 0.6, kneel: 0,
    spin: 0, spinCx: CX, spinCy: FOOT_Y - 11, raise: false, sparks: 0, bladeGlow: 0, impact: 0, charge: 0, shake: 0, air: 0, tuck: 0,
    offA: 0, offR: 0, trail: 0, smear: 0, smearFrom: 0, smearTo: 0, smearFade: 0, ghostA: [],
  };
}

function glowPx(c: PixelCanvas, e: PixelCanvas, x: number, y: number, col: number): void {
  c.px(x, y, col);
  e.px(x, y, col);
}

// ------------------------------------------------------------- squelette

/** Positions de toutes les articulations pour une pose. */
interface Skeleton {
  F: number;
  fwd: Pt;
  pelvis: Pt;
  /** Ligne des épaules (milieu). */
  chest: Pt;
  neck: Pt;
  head: Pt;
  legA: Chain;
  legB: Chain;
  /** Bras d'arme et bras libre. */
  armW: Chain;
  armO: Chain;
  /** La main libre est ouverte (griffe, interaction). */
  openHand: boolean;
  /** Les épaules : A (gauche écran de face) et B. */
  shA: Pt;
  shB: Pt;
  top: number;
}

function solve(p: Pose): Skeleton {
  const F = facingAngle(p.dir);
  const fwd = forwardVec(p.dir);
  const side = p.dir === 'side';
  const lx = Math.round(Math.cos(F) * p.lean);
  const ly = side ? 0 : Math.round(Math.sin(F) * p.lean * 0.5);
  // Bassin : descend avec le rebond et la flexion des genoux, suit un peu l'inclinaison.
  const pelvis = { x: CX + Math.round(lx * 0.3), y: FOOT_Y - 12 + p.bob + p.kneel + Math.round(ly * 0.3) };
  // Colonne : le haut du buste part dans l'inclinaison (cisaillement) et se soulève à l'inspiration.
  const top = pelvis.y - 8 - Math.round(p.breath) + Math.round(ly * 0.7);
  const chest = { x: CX + lx + (side ? 0 : Math.round(p.twist)), y: top };
  const neck = { x: chest.x + (side ? 1 : 0), y: top - 1 };
  const head = { x: neck.x + Math.round(lx * 0.3), y: top - 9 + Math.round(p.headTilt) };

  // Hanches et pieds (cibles au sol).
  const hipA = side ? { x: pelvis.x + 1, y: pelvis.y } : { x: pelvis.x - 3, y: pelvis.y };
  const hipB = side ? { x: pelvis.x - 1, y: pelvis.y } : { x: pelvis.x + 3, y: pelvis.y };
  const fa = p.fa + p.step * 3;
  const fb = p.fb - p.step;
  const footBase = (hipX: number) => (side ? CX : hipX + (hipX < CX ? -0.5 : 0.5));
  const footA = { x: footBase(side ? CX + 1 : CX - 3) + fwd.x * fa, y: FOOT_Y - 1 - p.la - p.tuck + fwd.y * fa };
  const footB = { x: footBase(side ? CX - 1 : CX + 3) + fwd.x * fb, y: FOOT_Y - 1 - p.lb - p.tuck + fwd.y * fb };
  // Genoux : vers l'avant de profil, légèrement vers l'extérieur de face/dos.
  const kneeA = side ? { x: 1, y: 0.2 } : { x: -1, y: 0.3 };
  const kneeB = side ? { x: 1, y: 0.2 } : { x: 1, y: 0.3 };
  // De face/de dos, les genoux plient vers la caméra : écart latéral réduit.
  const fs = (ch: Chain) => (side ? ch : foreshorten(ch, 0.3));
  const legA = fs(ik2(hipA, footA, THIGH, SHIN, kneeA));
  const legB = fs(ik2(hipB, footB, THIGH, SHIN, kneeB));

  // Épaules (la torsion en avance une et recule l'autre).
  const tw = side ? 0 : p.twist;
  const shA = side ? { x: chest.x, y: top + 2 } : { x: chest.x - 7, y: top + 2 + Math.round(tw * 0.6) };
  const shB = side ? { x: chest.x - 2, y: top + 2 } : { x: chest.x + 7, y: top + 2 - Math.round(tw * 0.6) };
  // Bras d'arme : A de face et de profil, B de dos.
  const shW = p.dir === 'up' ? shB : shA;
  const shO = p.dir === 'up' ? shA : shB;
  const outW = side ? -1 : Math.sign(shW.x - chest.x);
  const outO = side ? -1 : Math.sign(shO.x - chest.x);
  const hang = (sh: Pt, out: number, sw: number): Pt =>
    side ? { x: sh.x + sw * 3 + out * 0.5, y: sh.y + 8.5 - Math.abs(sw) } : { x: sh.x + out * 1.2, y: sh.y + 8.5 + sw * fwd.y * 2 };

  let handW: Pt;
  if (p.sword === 'hand') handW = p.raise ? { x: shW.x + (side ? 2 : -outW), y: head.y - 6 } : polar(shW, p.swordA, p.handR);
  else handW = hang(shW, outW, -p.swing);
  let handO: Pt;
  const openHand = p.reach > 0;
  if (p.reach > 0) handO = polar(shO, F, 5 + p.reach * 3);
  else if (p.offR > 0) handO = polar(shO, p.offA, p.offR);
  else handO = hang(shO, outO, p.swing);
  // Coudes : vers l'extérieur et vers le bas (vers l'arrière de profil).
  const armW = ik2(shW, handW, UPPER, FORE, { x: outW, y: 0.8 });
  const armO = ik2(shO, handO, UPPER, FORE, { x: outO, y: 0.8 });
  return { F, fwd, pelvis, chest, neck, head, legA, legB, armW, armO, openHand, shA, shB, top };
}

// ------------------------------------------------------------- parties du corps

function drawLeg(c: PixelCanvas, leg: Chain, p: Pose, near: boolean): void {
  const cols = near ? ARMOR : ARMOR_D;
  const side = p.dir === 'side';
  // Cuissard, genouillère, jambière, soleret.
  segment(c, leg.root, leg.mid, side ? 4 : 3, near ? MAIL : ARMOR_D);
  segment(c, leg.mid, leg.end, 3, near ? ARMOR_HI : ARMOR);
  joint(c, leg.mid, 1, near ? ARMOR_HI : ARMOR);
  const fx = Math.round(leg.end.x), fy = Math.round(leg.end.y);
  if (side) {
    shadedRect(c, fx - 2, fy - 1, 6, 2, cols);
    c.px(fx + 3, fy, cols.lo);
  } else {
    shadedRect(c, fx - 2, fy - 1, 5, 2, cols);
    if (p.dir === 'down') c.px(fx, fy - 1, near ? C.a4 : C.a3);
  }
}

function drawTorso(c: PixelCanvas, e: PixelCanvas, p: Pose, s: Skeleton): void {
  const side = p.dir === 'side';
  const wB = side ? 3.5 : 5;
  const wT = side ? 4.5 : 6.5;
  const pb = s.pelvis, ch = s.chest;
  const bot = pb.y + 1;
  // Cuirasse : trapèze cisaillé entre bassin et épaules.
  c.poly([[ch.x - wT, ch.y], [ch.x + wT + 1, ch.y], [pb.x + wB + 1, bot], [pb.x - wB, bot]], C.a2);
  c.line(ch.x - wT, ch.y, pb.x - wB, bot, C.a3);
  c.line(ch.x + wT, ch.y, pb.x + wB, bot, C.a0);
  c.line(ch.x - wT, ch.y, ch.x + wT, ch.y, C.a3);
  // Ceinture et boucle.
  const by = bot - 1;
  c.line(pb.x - wB, by, pb.x + wB, by, C.a0);
  if (p.dir === 'down') {
    // Plastron, arête centrale, gemme du cœur et boucle abyssale.
    c.poly([[ch.x - 3, ch.y + 1], [ch.x + 4, ch.y + 1], [ch.x + 3, ch.y + 5], [ch.x - 2, ch.y + 5]], C.a3);
    c.line(ch.x - 3, ch.y + 1, ch.x + 3, ch.y + 1, C.a4);
    c.line(ch.x, ch.y + 2, ch.x, ch.y + 5, C.a4);
    glowPx(c, e, ch.x, ch.y + 3, C.v1);
    glowPx(c, e, Math.round((ch.x + pb.x) / 2), by, C.v2);
    for (const [dx, dy] of [[-4, 4], [4, 6]] as const) glowPx(c, e, ch.x + dx, ch.y + dy, C.v0);
  } else if (side) {
    c.poly([[ch.x + 1, ch.y + 1], [ch.x + 4, ch.y + 1], [ch.x + 4, ch.y + 5], [ch.x + 1, ch.y + 5]], C.a3);
    glowPx(c, e, ch.x + 2, ch.y + 3, C.v1);
    glowPx(c, e, pb.x + 1, by, C.v2);
  } else {
    // Dossière : colonne de plaques.
    for (let y = ch.y + 1; y < by; y += 2) c.px(Math.round(ch.x + ((pb.x - ch.x) * (y - ch.y)) / (by - ch.y)), y, C.a3);
  }
  // Tassettes : deux plaques qui suivent les cuisses.
  for (const leg of side ? [s.legA] : [s.legA, s.legB]) {
    const t = along(leg.root, leg.mid, 0.45);
    shadedRect(c, Math.round(t.x) - 2, Math.round(leg.root.y), 4, 2, ARMOR);
  }
}

function drawPauldron(c: PixelCanvas, at: Pt, out: number): void {
  shadedEllipse(c, at.x, at.y - 1, 3.6, 2.7, ARMOR_HI);
  c.line(at.x - 2, at.y + 1, at.x + 2, at.y + 1, C.a1);
  // Pointe d'épaulière.
  c.line(at.x + out, at.y - 3, at.x + out * 3, at.y - 5, C.a3);
}

function drawArm(c: PixelCanvas, e: PixelCanvas, arm: Chain, near: boolean, open: boolean, grip: boolean): void {
  const cols = near ? ARMOR : ARMOR_D;
  segment(c, arm.root, arm.mid, 3, near ? MAIL : ARMOR_D);
  segment(c, arm.mid, arm.end, 3, cols);
  // Cubitière.
  joint(c, arm.mid, 1, near ? ARMOR_HI : ARMOR);
  // Canon d'avant-bras.
  const g = along(arm.mid, arm.end, 0.6);
  c.px(g.x, g.y, near ? C.a3 : C.a2);
  // Gantelet : poing fermé sur la poignée, ou main ouverte en griffe.
  const hx = Math.round(arm.end.x), hy = Math.round(arm.end.y);
  shadedRect(c, hx - 1, hy - 1, 3, 3, grip ? ARMOR_HI : cols);
  if (open) {
    const a = Math.atan2(arm.end.y - arm.mid.y, arm.end.x - arm.mid.x);
    for (const k of [-0.6, 0, 0.6]) {
      const t = polar(arm.end, a + k, 3);
      c.px(t.x, t.y, C.a3);
      glowPx(c, e, polar(arm.end, a + k, 4).x, polar(arm.end, a + k, 4).y, C.v1);
    }
  }
}

function drawHead(c: PixelCanvas, e: PixelCanvas, p: Pose, h: Pt): void {
  const { dir } = p;
  const x = Math.round(h.x), y = Math.round(h.y);
  const tx = dir === 'side' ? 0 : Math.round(p.headTurn * 2);
  // Cornes : l'une entière, l'autre brisée (elles suivent le regard à l'opposé).
  const hx = x - Math.sign(tx);
  if (dir === 'side') {
    c.line(x - 5, y - 4, x - 9, y - 9, C.a1, 2);
    c.line(x - 9, y - 9, x - 10, y - 13, C.a2, 1);
    c.line(x + 4, y - 5, x + 6, y - 9, C.a1, 2);
    c.px(x + 7, y - 10, C.a3);
  } else {
    c.line(hx - 7, y - 4, hx - 10, y - 9, C.a1, 2);
    c.line(hx - 10, y - 9, hx - 11, y - 14, C.a2, 1);
    c.px(hx - 11, y - 15, C.a3);
    c.line(hx + 7, y - 4, hx + 9, y - 8, C.a1, 2);
    c.px(hx + 10, y - 9, C.a3);
  }
  // Heaume.
  shadedEllipse(c, x, y, dir === 'side' ? 8.5 : 9, 8.5, ARMOR);
  // Couronne brisée : trois pointes et une gemme abyssale.
  for (const [dx, h0] of [[-4, 3], [0, 4], [4, 2]] as const) c.line(x + dx + tx, y - 7, x + dx + tx + Math.sign(dx), y - 7 - h0, C.a3, 1);
  c.rect(x - 5 + tx, y - 7, 11, 1, C.a3);
  glowPx(c, e, x + tx, y - 8, C.v1);
  if (dir === 'up') {
    // Dos du heaume : arête centrale et plaque de nuque.
    c.line(x, y - 6, x, y + 6, C.a3);
    c.rect(x - 5, y + 5, 11, 2, C.a1);
    return;
  }
  // Fente de la visière et yeux incandescents.
  const eyeCol = p.eyesClosed ? C.a1 : C.eye;
  if (dir === 'down') {
    c.rect(x - 7 + tx, y + 1, 15, 3, C.ink);
    c.line(x + tx, y - 6, x + tx, y, C.a4);
    for (const ex of [x - 4 + tx, x + 3 + tx]) {
      c.px(ex, y + 2, eyeCol);
      c.px(ex + 1, y + 2, eyeCol);
      if (!p.eyesClosed) {
        e.px(ex, y + 2, C.eye);
        e.px(ex + 1, y + 2, p.glow > 0.8 ? 0xffffff : C.eyeHi);
      }
    }
    c.rect(x - 3 + tx, y + 5, 7, 2, C.a1); // mentonnière
  } else {
    c.rect(x + 1, y + 1, 8, 3, C.ink);
    c.line(x + 2, y - 6, x + 3, y, C.a4);
    c.px(x + 5, y + 2, eyeCol);
    c.px(x + 6, y + 2, eyeCol);
    if (!p.eyesClosed) {
      e.px(x + 5, y + 2, C.eye);
      e.px(x + 6, y + 2, p.glow > 0.8 ? 0xffffff : C.eyeHi);
    }
    c.rect(x + 1, y + 5, 6, 2, C.a1);
  }
}

/**
 * Cape en tissu : accrochée aux épaules, ourlet découpé qui ondule (phase
 * `wave`), se balance (`cape`) et se soulève vers l'arrière (`flare`).
 * Plis tracés de l'attache vers l'ourlet, doublure visible quand elle se soulève.
 */
function drawCape(c: PixelCanvas, p: Pose, s: Skeleton, over: boolean): void {
  const sw = p.cape;
  const fl = p.flare;
  const top = s.top;
  // De dos, la cape s'arrête aux mollets pour laisser voir le pas.
  const hemY = over ? FOOT_Y - 6 : FOOT_Y - 1;
  const N = 7;
  let attach: [number, number][];
  const hem: [number, number][] = [];
  if (p.dir === 'side') {
    attach = [[s.chest.x + 1, top], [s.chest.x - 4, top]];
    const back = CX - 11 - fl * 7 + sw * 2;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const wv = Math.sin(p.wave + i * 1.1) * (0.6 + fl);
      // De l'arrière (t=0) vers les talons (t=1) ; l'ourlet remonte quand la cape vole.
      hem.push([back + t * (s.pelvis.x - 2 - back) + wv * 0.6, hemY - fl * 6 * (1 - t) + (i % 2 ? -2 : 0) + wv]);
    }
  } else {
    const w0 = over ? 9 : 8;
    const w1 = (over ? 11 : 12) + fl * 3;
    attach = [[s.chest.x - w0, top], [s.chest.x + w0, top]];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const wv = Math.sin(p.wave + i * 1.3) * (0.5 + fl * 0.8);
      hem.push([s.chest.x - w1 + t * 2 * w1 + sw * (1 + t) + wv * 0.5, hemY - (i % 2 ? 3 : 0) - fl * 2 * Math.abs(Math.sin(p.wave + i)) + wv * 0.5]);
    }
  }
  const pts: [number, number][] = [attach[0], attach[1], ...(p.dir === 'side' ? hem : [...hem].reverse())];
  c.poly(pts, C.c1);
  // Plis : de l'attache vers chaque creux de l'ourlet.
  for (let i = 1; i < N; i += 2) {
    const t = i / N;
    const ax = attach[0][0] + (attach[1][0] - attach[0][0]) * (p.dir === 'side' ? 1 - t : t);
    const hx = hem[p.dir === 'side' ? i : i][0];
    const hy = hem[i][1];
    c.line(ax, top + 3, hx, hy - 1, C.c0);
    c.line(ax + 1, top + 4, hx + 1, hy - 2, C.c2);
  }
  // Liseré éclairé et doublure retournée quand la cape se soulève.
  c.line(attach[1][0], attach[1][1], hem[p.dir === 'side' ? 0 : N][0], hem[p.dir === 'side' ? 0 : N][1], C.c3);
  if (fl > 0.4) for (let i = 0; i < N; i++) c.line(hem[i][0], hem[i][1] - 1, hem[i + 1][0], hem[i + 1][1] - 1, i % 2 ? C.c3 : C.c4);
  if (over) c.line(attach[0][0], attach[0][1], attach[1][0], attach[1][1], C.c2);
}

function drawSwordOnBack(c: PixelCanvas, e: PixelCanvas, p: Pose, s: Skeleton): void {
  const top = s.top;
  if (p.dir === 'down') blade(c, e, { x: s.chest.x + 9, y: top - 3 }, 2.45, 22, SWORD, 2);
  else if (p.dir === 'up') blade(c, e, { x: s.chest.x - 9, y: top - 3 }, 0.7, 22, SWORD, 3);
  else blade(c, e, { x: s.chest.x - 6, y: top - 4 }, 1.05, 22, SWORD, 2);
}

// ------------------------------------------------------------- assemblage

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
  const s = solve(p);
  const { F } = s;
  const side = p.dir === 'side';
  const holding = p.sword === 'hand';
  const hand = holding ? s.armW.end : null;
  const swordAngle = p.raise ? -Math.PI / 2 : p.swordA;
  const behind = holding && swordBehind(p);
  const pivot = s.armW.root;

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
  const claw = p.claw > 0 ? s.armO.end : null;
  /** Griffe abyssale : trois grandes entailles parallèles, en diagonale devant la main. */
  const drawClaw = () => {
    if (!claw) return;
    const len = 6 + p.claw * 10;
    const al = F + 0.75;
    const center = polar(claw, F, 5);
    for (const k of [-1, 0, 1]) {
      const o = polar(center, F, k * 4);
      const a = polar(o, al, -len / 2), b = polar(o, al, len / 2);
      const m0 = polar(o, al, -len / 4), m1 = polar(o, al, len / 4);
      c.line(a.x, a.y, b.x, b.y, 0x6a30d0, 1);
      c.line(m0.x, m0.y, m1.x, m1.y, C.v1, 2);
      c.line(m0.x, m0.y, m1.x, m1.y, C.v2, 1);
      e.line(a.x, a.y, b.x, b.y, C.v1, 2);
    }
    sparkle(c, e, polar(center, al, len / 2 + 1), p.claw > 0.7 ? 3 : 2, C.v2, C.v1);
  };

  // Énergie qui converge (derrière le personnage).
  if (p.charge > 0) {
    const mid = { x: s.chest.x, y: s.chest.y + 4 };
    for (let i = 0; i < 12; i++) {
      const a = i * 2.39996;
      const d = 6 + (1 - p.charge) * 14 + (i % 4) * 2;
      const q = polar(mid, a, d), t = polar(mid, a, d + 2 + p.charge * 2);
      c.line(q.x, q.y, t.x, t.y, i % 3 ? C.v1 : C.v2);
      e.line(q.x, q.y, t.x, t.y, C.v1);
    }
  }
  const impactAt = { x: CX + Math.cos(F) * (side ? 15 : 7), y: FOOT_Y + (p.dir === 'down' ? 5 : p.dir === 'up' ? -6 : 0) };
  if (p.dir === 'up') {
    groundImpact(c, e, impactAt, p.impact, C.v1, 0);
    drawClaw();
  }
  // Images rémanentes de la lame, derrière tout le reste.
  if (holding && !p.raise) for (const ga of p.ghostA) ghostBlade(c, e, polar(pivot, ga, p.handR), ga, BLADE_LEN, 0x7a48d8, 110);

  const outA = side ? 1 : -1;
  /**
   * Chaque partie du corps est dessinée sur son propre calque puis contourée
   * (« selout ») avant d'être posée : les membres se détachent les uns des
   * autres au lieu de se fondre dans une même masse d'armure.
   */
  const part = (fn: (pc: PixelCanvas) => void) => {
    const pc = new PixelCanvas(FW, FH);
    fn(pc);
    pc.outline(INNER);
    c.blit(pc, 0, 0);
  };
  if (p.dir === 'down') {
    part((pc) => drawCape(pc, p, s, false));
    if (!holding) drawSwordOnBack(c, e, p, s);
    if (behind) drawSword();
    part((pc) => drawLeg(pc, s.legB, p, false));
    part((pc) => drawLeg(pc, s.legA, p, true));
    part((pc) => drawTorso(pc, e, p, s));
    part((pc) => drawArm(pc, e, s.armO, true, s.openHand, false));
    part((pc) => drawArm(pc, e, s.armW, true, false, holding));
    part((pc) => drawPauldron(pc, s.shA, outA));
    part((pc) => drawPauldron(pc, s.shB, -outA));
    part((pc) => drawHead(pc, e, p, s.head));
    if (!behind) drawSword();
  } else if (p.dir === 'up') {
    part((pc) => drawLeg(pc, s.legA, p, true));
    part((pc) => drawLeg(pc, s.legB, p, true));
    if (behind) drawSword();
    part((pc) => drawArm(pc, e, s.armO, false, s.openHand, false));
    if (behind || !holding) part((pc) => drawArm(pc, e, s.armW, false, false, holding));
    part((pc) => drawTorso(pc, e, p, s));
    part((pc) => drawCape(pc, p, s, true));
    if (!holding) drawSwordOnBack(c, e, p, s);
    part((pc) => drawPauldron(pc, s.shA, -1));
    part((pc) => drawPauldron(pc, s.shB, 1));
    part((pc) => drawHead(pc, e, p, s.head));
    if (holding && !behind) {
      part((pc) => drawArm(pc, e, s.armW, true, false, true));
      drawSword();
    }
  } else {
    part((pc) => drawCape(pc, p, s, false));
    if (!holding) drawSwordOnBack(c, e, p, s);
    part((pc) => drawLeg(pc, s.legB, p, false));
    part((pc) => drawArm(pc, e, s.armO, false, s.openHand, false));
    if (behind) drawSword();
    part((pc) => drawLeg(pc, s.legA, p, true));
    part((pc) => drawTorso(pc, e, p, s));
    part((pc) => drawHead(pc, e, p, s.head));
    part((pc) => drawArm(pc, e, s.armW, true, false, holding));
    part((pc) => drawPauldron(pc, s.shA, -1));
    if (!behind) drawSword();
  }
  c.outline(C.ink);
  if (p.smear > 0) swoosh(c, e, pivot, p.smearFrom, p.smearTo, p.handR + 6, p.handR + BLADE_LEN + 1, SMEAR_COLS, p.smearFade);
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
const PX_FIELDS = ['bob', 'lean', 'kneel', 'air', 'tuck', 'shake', 'fa', 'fb', 'la', 'lb', 'breath', 'headTilt'] as const;

function keyed(dir: Dir, n: number, keys: Key<Pose>[]): Pose[] {
  return sampleKeys(base(dir), keys, n).map((f, i) => {
    const o = { ...f };
    for (const k of PX_FIELDS) o[k] = Math.round(o[k]);
    // La cape continue d'onduler pendant l'action.
    o.wave = f.wave + i * 0.9;
    return o;
  });
}

/** Coup droit / revers : anticipation, taille, accompagnement, retour en garde. */
const slash = (back: boolean, hop: number): Gen => (dir) => {
  const F = facingAngle(dir);
  const s = sideSign(dir) * (back ? -1 : 1);
  return keyed(dir, 8, [
    { t: 0, p: { sword: 'hand', swordA: F + s * 1.2, handR: 6, fb: -1 } },
    // Anticipation : buste tourné côté arme, poids sur l'arrière, regard sur la cible.
    { t: 0.16, ease: 'out', p: { swordA: F + s * 2.5, handR: 5, lean: -1, kneel: 1, twist: s, cape: 0.5, offA: F, offR: 6, glow: 1, headTurn: -s * 0.5, fa: -1, fb: 1 } },
    // Taille : fente avant, torsion inversée, main libre ramenée en contrepoids.
    { t: 0.3, ease: 'in', p: { swordA: F - s * 0.1, handR: 9, lean: 2, kneel: 1, air: hop, step: 1, twist: -s, trail: 1, flare: 0.7, offA: F + PI, offR: 5, cape: -0.6, headTurn: 0, headTilt: 1 } },
    { t: 0.44, ease: 'out', p: { swordA: F - s * 1.35, handR: 9, lean: 3, kneel: 2, air: 0, trail: 1, sparks: 1 } },
    { t: 0.6, p: { swordA: F - s * 1.6, handR: 8, lean: 2, trail: 0.35, sparks: 0, flare: 0.3, twist: -s * 0.5 } },
    { t: 0.8, p: { swordA: F - s * 1.35, handR: 7, lean: 1, kneel: 1, trail: 0, step: 0.4, cape: 0.2, offR: 3, headTilt: 0, twist: 0 } },
    { t: 1, p: { swordA: F - s * 1.1, handR: 6, lean: 0, kneel: 0, step: 0, offR: 0, flare: 0, cape: 0, glow: 0.6, fa: 0, fb: 0 } },
  ]);
};

/** Bond et frappe verticale : accroupi, saut, lame au-dessus de la tête, impact au sol. */
const leapSlam: Gen = (dir) => {
  const F = facingAngle(dir);
  const s = sideSign(dir);
  return keyed(dir, 10, [
    { t: 0, p: { sword: 'hand', swordA: F + s * 1.2, handR: 6 } },
    { t: 0.12, ease: 'out', p: { kneel: 4, lean: 1, swordA: F + s * 2.0, handR: 5, cape: 0.5, glow: 1, flare: 0.2, offA: F + 0.6, offR: 6, headTilt: 1, fa: 1, fb: -1 } },
    { t: 0.24, ease: 'out', p: { kneel: 0, lean: -1, air: 9, tuck: 3, swordA: F + s * 2.8, handR: 8, flare: 1, bladeGlow: 0.7, offA: F + PI * 0.75, offR: 7, headTilt: -1, breath: 1 } },
    { t: 0.34, ease: 'in', p: { air: 5, tuck: 2, swordA: F + s * 1.3, handR: 9, lean: 2, trail: 1, headTilt: 0 } },
    { t: 0.44, ease: 'in', p: { air: 0, tuck: 0, kneel: 5, swordA: F - s * 0.3, handR: 9, lean: 3, trail: 1, impact: 1, sparks: 1, bladeGlow: 1, flare: 0.3, step: 1, offA: F + PI, offR: 5, headTilt: 2, breath: 0 } },
    { t: 0.58, p: { impact: 0.75, trail: 0, sparks: 0.4, bladeGlow: 0.5 } },
    { t: 0.76, p: { impact: 0.3, kneel: 3, sparks: 0, lean: 1, offR: 3, headTilt: 1 } },
    { t: 1, p: { kneel: 0, impact: 0, bladeGlow: 0, lean: 0, step: 0, swordA: F - s * 0.8, handR: 6, offR: 0, glow: 0.6, headTilt: 0, fa: 0, fb: 0 } },
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
    { t: 0, p: { sword: 'hand', swordA: F + s * 1.4, handR: 6 } },
    { t: 0.12, ease: 'out', p: { swordA: a0, kneel: 3, handR: 6, offA: F, offR: 6, glow: 1, charge: 0.3, bladeGlow: 0.3, flare: 0.3, twist: s, fa: 2, fb: -2, headTilt: 1 } },
    { t: 0.36, ease: 'linear', p: { charge: 1, bladeGlow: 1, shake: 1, kneel: 4, cape: 0.6, breath: 1 } },
    { t: 0.42, ease: 'in', p: { swordA: a0 - s * 0.9, kneel: 1, charge: 0, shake: 0, handR: 8, trail: 1, offR: 4, twist: -s, breath: 0, headTilt: 0 } },
    { t: 0.5, ease: 'linear', p: { swordA: a0 - s * PI, kneel: 0, air: 2, handR: 9, flare: 1, trail: 1, fa: 1, fb: -1, la: 1 } },
    { t: 0.6, ease: 'linear', p: { swordA: a0 - s * 2 * PI, air: 0, kneel: 3, impact: 1, sparks: 1, trail: 1, la: 0, fa: 2, fb: -2 } },
    { t: 0.7, ease: 'out', p: { swordA: a0 - s * (2 * PI + 0.7), impact: 0.6, sparks: 0.3, trail: 0.6, flare: 0.5, twist: 0 } },
    { t: 0.85, p: { impact: 0.2, sparks: 0, trail: 0, kneel: 1, bladeGlow: 0.2, offR: 3 } },
    { t: 1, p: { impact: 0, kneel: 0, bladeGlow: 0, swordA: a0 - s * (2 * PI + 0.5), handR: 6, offR: 0, flare: 0, glow: 0.6, cape: 0, fa: 0, fb: 0 } },
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
    { t: 0, p: { offA: F + 1.2, offR: 5 } },
    { t: 0.15, ease: 'out', p: { lean: -1, kneel: 1, offA: F + PI, offR: 6, charge: 0.7, glow: 1, cape: 0.4, twist: 1, breath: 1, fb: 1 } },
    { t: 0.3, ease: 'in', p: { lean: 2, kneel: 1, step: 1, reach: 1, claw: 0.7, charge: 0, offR: 0, flare: 0.7, cape: -0.6, twist: -1, breath: 0, headTilt: 1 } },
    { t: 0.42, ease: 'out', p: { lean: 3, kneel: 2, reach: 1.3, claw: 1 } },
    { t: 0.6, p: { claw: 0.45, reach: 0.9, lean: 2, flare: 0.3, twist: -0.5 } },
    { t: 0.8, p: { claw: 0, reach: 0.3, lean: 1, kneel: 1, step: 0.4, headTilt: 0, twist: 0 } },
    { t: 1, p: { reach: 0, lean: 0, kneel: 0, step: 0, glow: 0.6, cape: 0, flare: 0, fb: 0 } },
  ]);
};

/** Locomotion : cycle de pas complet (contact, passage), bras en balancier, tête qui suit. */
const locomotion = (n: number, run: boolean): Gen => (dir) =>
  gait(n, run).map((g, i) => ({
    ...g,
    la: g.la,
    lb: g.lb,
    swing: g.swing * (run ? 1 : 0.7),
    lean: run ? 2 : 0,
    bob: g.bob - (run ? 0 : 0),
    air: g.air,
    twist: dir === 'side' ? 0 : Math.round(g.swing * (run ? 1 : 0.6)),
    headTilt: run ? 1 : 0,
    breath: g.bob === 0 ? 1 : 0,
    cape: -g.swing * 0.4,
    flare: run ? 0.7 + 0.2 * Math.abs(g.swing) : 0.1,
    wave: i * (run ? 1.6 : 1.1),
  }));

const CLIPS: { name: string; fps: number; loop: boolean; gen: Gen; events?: Record<number, string> }[] = [
  {
    // Respiration : buste qui se soulève, tête qui suit, cape qui ondule, regard qui balaie.
    name: 'idle', fps: 5, loop: true,
    gen: () => [
      { wave: 0 }, { breath: 1, wave: 0.9 }, { breath: 1, glow: 0.8, wave: 1.8, headTurn: 0.5 },
      { breath: 1, glow: 1, wave: 2.7, headTurn: 0.5 }, { wave: 3.6, cape: 0.3 }, { bob: 1, wave: 4.5, cape: 0.3, headTilt: 1 },
    ],
  },
  { name: 'walk', fps: 10, loop: true, gen: locomotion(8, false), events: { 0: 'step', 4: 'step' } },
  { name: 'run', fps: 14, loop: true, gen: locomotion(8, true), events: { 0: 'step', 4: 'step' } },
  { name: 'attack1', fps: 18, loop: false, gen: slash(false, 0) },
  { name: 'attack2', fps: 18, loop: false, gen: slash(true, 1) },
  { name: 'attack3', fps: 16, loop: false, gen: leapSlam },
  { name: 'heavy', fps: 16, loop: false, gen: spinSlash },
  {
    // Pas de l'ombre : appui, glissade basse, rétablissement.
    name: 'dodge', fps: 12, loop: false,
    gen: (dir) => keyed(dir, 4, [
      { t: 0, p: { kneel: 2, lean: 1, fa: 1, fb: -2, flare: 0.5 } },
      { t: 0.35, p: { kneel: 4, lean: 3, fa: 3, fb: -3, flare: 1, glow: 1, swing: -1, headTilt: 1 } },
      { t: 0.7, p: { kneel: 2, lean: 2, fa: 1, fb: -1, flare: 0.6, swing: 0 } },
      { t: 1, p: { kneel: 0, lean: 0, fa: 0, fb: 0, flare: 0.2, headTilt: 0 } },
    ]),
  },
  {
    // Roulade : accroupi, corps en boule (jambes repliées, tête rentrée), tour complet, réception.
    name: 'roll', fps: 14, loop: false,
    gen: (dir) => {
      const s = dir === 'up' ? -1 : 1;
      const ball = { kneel: 4, tuck: 4, headTilt: 3, lean: 2, offA: facingAngle(dir), offR: 4, swing: 0, flare: 0.8 };
      return keyed(dir, 7, [
        { t: 0, p: { kneel: 3, lean: 2, fa: 2, fb: -2, flare: 0.4 } },
        { t: 0.18, p: { ...ball, spin: s * 1.2 } },
        { t: 0.4, ease: 'linear', p: { spin: s * 2.8 } },
        { t: 0.62, ease: 'linear', p: { spin: s * 4.4 } },
        { t: 0.8, ease: 'linear', p: { spin: s * 2 * PI, kneel: 3, tuck: 0, headTilt: 1, offR: 0, fa: 1, fb: -1 } },
        { t: 1, p: { spin: 0, kneel: 1, lean: 0, headTilt: 0, fa: 0, fb: 0, flare: 0.3 } },
      ]).map((f) => ({ ...f, spin: Math.abs(f.spin) >= 2 * PI - 0.01 ? 0 : f.spin }));
    },
  },
  {
    // Blessure : le buste part en arrière, la tête bascule, les genoux plient.
    name: 'hurt', fps: 10, loop: false,
    gen: (dir) => keyed(dir, 3, [
      { t: 0, p: { lean: -3, kneel: 1, eyesClosed: true, headTilt: -1, cape: -0.6, swing: 1, fb: -1 } },
      { t: 0.5, p: { lean: -2, kneel: 2, eyesClosed: true, headTilt: 0 } },
      { t: 1, p: { lean: -1, kneel: 1, eyesClosed: false, swing: 0 } },
    ]),
  },
  {
    // Mort : recul, genoux qui cèdent, buste qui s'affaisse, chute au sol.
    name: 'death', fps: 7, loop: false,
    gen: (dir) => keyed(dir, 6, [
      { t: 0, p: { lean: -3, eyesClosed: true, headTilt: -1, swing: 1 } },
      { t: 0.25, p: { kneel: 3, lean: 1, headTilt: 2, glow: 0.3, swing: 0 } },
      { t: 0.45, p: { kneel: 6, lean: 2, headTilt: 3, glow: 0.1, tuck: 0 } },
      // Chute : pivot à la taille pour que le corps allongé tienne dans la frame.
      { t: 0.7, ease: 'in', p: { kneel: 6, spin: 0.7, spinCy: FOOT_Y - 10, glow: 0 } },
      { t: 1, ease: 'out', p: { kneel: 5, spin: 1.45, spinCy: FOOT_Y - 13, headTilt: 1 } },
    ]),
  },
  { name: 'cast', fps: 18, loop: false, gen: clawStrike },
  {
    name: 'interact', fps: 8, loop: false,
    gen: (dir) => keyed(dir, 4, [
      { t: 0, p: { headTilt: 1 } },
      { t: 0.4, p: { reach: 0.6, lean: 1, kneel: 1, headTilt: 2 } },
      { t: 1, p: { reach: 1, lean: 1, glow: 1, headTilt: 1 } },
    ]),
  },
  {
    // Victoire : l'épée levée, la cape qui claque.
    name: 'victory', fps: 5, loop: true,
    gen: (dir) => [0, 1, 2, 3].map((i) => ({
      ...base(dir), sword: 'hand' as const, raise: true, glow: 1, flare: 0.4 + (i % 2) * 0.3, wave: i * 1.5,
      bob: i === 1 || i === 2 ? -1 : 0, breath: i % 2, offA: facingAngle(dir) + 1.4, offR: 6, headTilt: -1,
    })),
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
  c.blit(tc, dx + (p.mirror ? 1 : 0), dy, p.mirror);
  e.blit(te, dx + (p.mirror ? 1 : 0), dy, p.mirror);
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

