import { PixelCanvas } from '../pixel/PixelCanvas';
import { getImage } from '../images/registry';
import { buildSpriteSheet, type ClipDef, type SpriteSheet } from '../../entities/animation/SpriteSheet';
import { crescent, rotated, sampleKeys } from './frontRig';
import {
  apply, boneTransforms, buildBoneRig, closeCracks, drawPart, segDist, translate,
  type Affine, type BoneDef, type RigData, type Vec,
} from './boneRig';

/**
 * Varyn, Seigneur des Abysses — sprite dessiné (src/assets/images/varyn.png,
 * 106×121 px, vue isométrique 3/4 tournée vers la droite), animé par un
 * squelette complet comme un corps humain :
 *
 *   bassin ─┬─ buste ─┬─ tête
 *           │         ├─ bras avant : épaule → coude → poignet → (épée Eclipse)
 *           │         └─ bras arrière : épaule → coude → poignet
 *           ├─ jambe avant : hanche → genou → cheville
 *           ├─ jambe arrière : hanche → genou → cheville
 *           └─ cape (ondulation, envol)
 *
 * Chaque pose donne l'angle de chaque articulation (relatif au repos).
 */
export interface VarynPose {
  rx: number;
  ry: number;
  torso: number;
  head: number;
  /** Bras avant (tient l'épée) : épaule, coude, poignet. */
  nS: number;
  nE: number;
  nW: number;
  /** Bras arrière. */
  fS: number;
  fE: number;
  fW: number;
  /** Jambe avant : hanche, genou, cheville. */
  nH: number;
  nK: number;
  nA: number;
  /** Jambe arrière. */
  fH: number;
  fK: number;
  fA: number;
  sway: number;
  flare: number;
  wave: number;
  /** Traînée de l'épée (0..1) — l'arc est calculé depuis la trajectoire de la pointe. */
  smear: number;
  smearFrom: number;
  smearTo: number;
  smearR: number;
  /** Griffes abyssales de la main arrière. */
  claw: number;
  clawFrom: number;
  clawTo: number;
  runes: number;
  roll: number;
  swordBehind: number;
}

// --- Squelette (coordonnées de l'image source) ------------------------------
const P = {
  waist: { x: 60, y: 62 },
  neck: { x: 61, y: 24 },
  nShoulder: { x: 46, y: 33 },
  nElbow: { x: 39, y: 48 },
  nWrist: { x: 42, y: 57 },
  nHand: { x: 44, y: 61 },
  fShoulder: { x: 73, y: 34 },
  fElbow: { x: 77, y: 50 },
  fWrist: { x: 79, y: 61 },
  fHand: { x: 80, y: 64 },
  nHip: { x: 51, y: 67 },
  nKnee: { x: 49, y: 82 },
  nAnkle: { x: 45, y: 103 },
  nToe: { x: 42, y: 112 },
  fHip: { x: 64, y: 70 },
  fKnee: { x: 67, y: 87 },
  fAnkle: { x: 71, y: 102 },
  fToe: { x: 80, y: 109 },
  pelvis: { x: 60, y: 66 },
};
const SWORD_TIP: Vec = { x: 98.6, y: 107.3 };

const BONES: BoneDef[] = [
  { id: 'pelvis', parent: null, pivot: P.pelvis, core: true },
  { id: 'cape', parent: null, pivot: P.pelvis, core: true },
  { id: 'torso', parent: 'pelvis', pivot: P.waist, core: true },
  { id: 'head', parent: 'torso', pivot: P.neck },
  { id: 'nUpper', parent: 'torso', pivot: P.nShoulder },
  { id: 'nFore', parent: 'nUpper', pivot: P.nElbow },
  { id: 'nHand', parent: 'nFore', pivot: P.nWrist },
  { id: 'sword', parent: 'nHand', pivot: P.nHand },
  { id: 'fUpper', parent: 'torso', pivot: P.fShoulder },
  { id: 'fFore', parent: 'fUpper', pivot: P.fElbow },
  { id: 'fHand', parent: 'fFore', pivot: P.fWrist },
  { id: 'nThigh', parent: 'pelvis', pivot: P.nHip },
  { id: 'nShin', parent: 'nThigh', pivot: P.nKnee },
  { id: 'nFoot', parent: 'nShin', pivot: P.nAnkle },
  { id: 'fThigh', parent: 'pelvis', pivot: P.fHip },
  { id: 'fShin', parent: 'fThigh', pivot: P.fKnee },
  { id: 'fFoot', parent: 'fShin', pivot: P.fAnkle },
];

// --- Lame (pour la segmentation) ---------------------------------------------
const REST_A = 0.7008;
const DIR = { x: Math.cos(REST_A), y: Math.sin(REST_A) };
const NRM = { x: -DIR.y, y: DIR.x };
const GUARD = { x: 48, y: 65 };

function swordMask(w: number, h: number, opaque: (x: number, y: number) => boolean): Uint8Array {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!opaque(x, y)) continue;
      const dx = x + 0.5 - (GUARD.x + 0.5), dy = y + 0.5 - (GUARD.y + 0.5);
      const t = dx * DIR.x + dy * DIR.y;
      const p = dx * NRM.x + dy * NRM.y;
      const bw = t < 56 ? 4.3 : 4.3 - ((t - 56) / 12) * 2.4;
      const blade = t > 0.5 && t < 69 && Math.abs(p) <= bw;
      const guard = Math.abs(t) <= 2.2 && Math.abs(p) <= 11.5;
      const hilt = t <= 0.5 && t > -27 && Math.abs(p) <= 2.8 && Math.hypot(x - P.nHand.x, y - P.nHand.y) > 5;
      if (blade || guard || hilt) m[y * w + x] = 1;
    }
  // Absorbe les résidus fins le long de la lame (contour hors du corps).
  for (let pass = 0; pass < 2; pass++) {
    const grab: number[] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!opaque(x, y) || m[y * w + x]) continue;
        let touch = false;
        let body = 0;
        for (let j = -1; j <= 1; j++)
          for (let k = -1; k <= 1; k++) {
            if (!j && !k) continue;
            const xx = x + k, yy = y + j;
            if (!opaque(xx, yy)) continue;
            if (m[yy * w + xx]) touch = true;
            else body++;
          }
        if (touch && body <= 3) grab.push(y * w + x);
      }
    for (const i of grab) m[i] = 1;
  }
  return m;
}

function buildRig(): RigData {
  const img = getImage('varyn');
  const { width: w, height: h, data } = img;
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] >= 128;
  const sword = swordMask(w, h, opaque);
  type Cand = [string, Vec, Vec, number];
  const nArm: Cand[] = [
    ['nUpper', { x: 45, y: 37 }, P.nElbow, 5.5],
    ['nFore', P.nElbow, P.nWrist, 5],
    ['nHand', P.nHand, P.nHand, 5.2],
  ];
  const fArm: Cand[] = [
    ['fUpper', { x: 74, y: 37 }, P.fElbow, 6],
    ['fFore', P.fElbow, P.fWrist, 6],
    ['fHand', P.fHand, P.fHand, 5.5],
  ];
  const nLeg: Cand[] = [
    ['nThigh', { x: 51, y: 72 }, P.nKnee, 6],
    ['nShin', P.nKnee, P.nAnkle, 5.5],
    ['nFoot', P.nAnkle, P.nToe, 6.5],
  ];
  const fLeg: Cand[] = [
    ['fThigh', { x: 64, y: 76 }, P.fKnee, 6],
    ['fShin', P.fKnee, P.fAnkle, 6],
    ['fFoot', P.fAnkle, P.fToe, 8],
  ];
  const nearest = (p: Vec, list: Cand[]): string | null => {
    let best: string | null = null;
    let bestD = 0;
    for (const [id, a, b, r] of list) {
      const d = segDist(p, a, b) - r;
      if (d <= 0 && (best === null || d < bestD)) {
        best = id;
        bestD = d;
      }
    }
    return best;
  };
  return buildBoneRig(img, BONES, (x, y) => {
    if (sword[y * w + x]) return 'sword';
    const p = { x: x + 0.5, y: y + 0.5 };
    if (y < 24 && x >= 50 && x <= 74) return 'head';
    if (x < 52 && y >= 38 && y <= 68) {
      const n = nearest(p, nArm);
      if (n) return n;
    }
    if (x >= 70 && y >= 36 && y <= 70) {
      const n = nearest(p, fArm);
      if (n) return n;
    }
    if (x <= 56 && y >= 74) {
      const n = nearest(p, nLeg);
      if (n && (n !== 'nFoot' || y >= 100)) return n;
    }
    if (x >= 58 && y >= 80) {
      const n = nearest(p, fLeg);
      if (n && (n !== 'fFoot' || y >= 99)) return n;
    }
    if ((x < 40 && y >= 50) || (x < 44 && y >= 88)) return 'cape';
    return y < 63 ? 'torso' : 'pelvis';
  });
}

// --- Cadre ---------------------------------------------------------------------
const FW = 200;
const FH = 200;
const OX = 55;
const OY = 70;
const G = OY + 114;
const PIVOT_X = OX + 60;

const BASE: VarynPose = {
  rx: 0, ry: 0, torso: 0, head: 0,
  nS: 0, nE: 0, nW: 0, fS: 0, fE: 0, fW: 0,
  nH: 0, nK: 0, nA: 0, fH: 0, fK: 0, fA: 0,
  sway: 0, flare: 0, wave: 0.6,
  smear: 0, smearFrom: 0, smearTo: 0, smearR: 0,
  claw: 0, clawFrom: 0, clawTo: 0,
  runes: 0.5, roll: 0, swordBehind: 0,
};

function anglesOf(p: VarynPose): Record<string, number> {
  return {
    torso: p.torso, head: p.head,
    nUpper: p.nS, nFore: p.nE, nHand: p.nW,
    fUpper: p.fS, fFore: p.fE, fHand: p.fW,
    nThigh: p.nH, nShin: p.nK, nFoot: p.nA,
    fThigh: p.fH, fShin: p.fK, fFoot: p.fA,
  };
}

function transformsOf(rig: RigData, p: VarynPose): Affine[] {
  return boneTransforms(rig, anglesOf(p), translate(p.rx, p.ry));
}

/** Position monde (source) d'un point d'un os. */
function worldPoint(rig: RigData, tf: Affine[], bone: string, pt: Vec): Vec {
  return apply(tf[rig.index.get(bone)!], pt);
}

/** Ordre de profondeur, du fond vers l'avant. */
const ORDER = ['cape', 'fUpper', 'fFore', 'fHand', 'fThigh', 'fShin', 'fFoot', 'pelvis', 'nThigh', 'nShin', 'nFoot', 'torso', 'head', 'nUpper', 'nFore', 'SWORD', 'nHand'];

function drawFrame(rig: RigData, p: VarynPose, c: PixelCanvas, e: PixelCanvas, frame: number, count: number): void {
  const tf = transformsOf(rig, p);
  const phase = (frame / Math.max(1, count)) * Math.PI * 2;
  // Cape : ondulation par ligne, croissante vers l'ourlet ; envol vers l'arrière (gauche).
  const capeShift = (sy: number) => {
    const f = Math.max(0, Math.min(1, (sy - 50) / 70));
    const wave = Math.sin(sy * 0.21 - phase) * p.wave * 2.2 + Math.sin(sy * 0.47 - phase * 2) * p.wave * 0.8;
    return Math.round(f * (wave + p.sway * 3 - p.flare * 10));
  };
  const opts = { glow: p.runes, rowShift: { cape: capeShift } };
  const draw = (id: string) => drawPart(rig, id, tf[rig.index.get(id)!], OX, OY, c, e, opts);
  if (p.swordBehind > 0.5) draw('sword');
  for (const id of ORDER) {
    if (id === 'SWORD') {
      if (p.swordBehind <= 0.5) draw('sword');
    } else draw(id);
  }
  closeCracks(c);
  c.outline(0x05040a);

  if (p.smear > 0) {
    const sh = worldPoint(rig, tf, 'nUpper', P.nShoulder);
    crescent(c, e, { x: OX + sh.x, y: OY + sh.y }, p.smearFrom, p.smearTo, Math.max(10, p.smearR - 42), p.smearR + 3,
      { edge: 0xf0e4ff, core: 0xb27cff, faint: 0x6a30d0 }, p.smear);
  }
  if (p.claw > 0) {
    const sh = worldPoint(rig, tf, 'fUpper', P.fShoulder);
    for (const r of [24, 30, 36]) {
      crescent(c, e, { x: OX + sh.x, y: OY + sh.y }, p.clawFrom, p.clawTo, r - 2, r, { edge: 0xe8d4ff, core: 0xa060ff, faint: 0x6a30d0 }, p.claw);
    }
  }
}

// ------------------------------------------------------------- animations

const K = (keys: { t: number; p: Partial<VarynPose> }[], n: number, loop = false) => sampleKeys(BASE, keys, n, loop);

function walkCycle(n: number, amp: number, knee: number, extra: Partial<VarynPose>): VarynPose[] {
  return Array.from({ length: n }, (_, i) => {
    const ph = (i / n) * Math.PI * 2;
    const s = Math.sin(ph);
    return {
      ...BASE,
      ...extra,
      // Jambes en opposition ; le genou plie pendant la phase de retour.
      nH: -s * amp,
      nK: Math.max(0, Math.cos(ph)) * knee,
      nA: -Math.max(0, Math.cos(ph)) * knee * 0.4,
      fH: s * amp,
      fK: Math.max(0, -Math.cos(ph)) * knee,
      fA: -Math.max(0, -Math.cos(ph)) * knee * 0.4,
      // Balancier des bras.
      fS: (extra.fS ?? 0) + s * amp * 0.7,
      fE: (extra.fE ?? 0) - Math.abs(s) * 0.15,
      nS: (extra.nS ?? 0) - s * amp * 0.25,
      ry: (extra.ry ?? 0) - Math.round(Math.abs(Math.cos(ph)) * 2) + 1,
      torso: (extra.torso ?? 0) + Math.sin(ph * 2) * 0.02,
      head: (extra.head ?? 0) - Math.sin(ph * 2) * 0.03,
    };
  });
}

const CLIPS: ClipDef<VarynPose>[] = [
  {
    name: 'idle', fps: 6, loop: true,
    frames: K([
      { t: 0, p: { wave: 0.5 } },
      { t: 0.5, p: { ry: 1, torso: 0.02, head: -0.04, nS: 0.03, nE: -0.03, fS: -0.04, fE: 0.06, wave: 0.7, runes: 0.85 } },
      { t: 1, p: { wave: 0.5 } },
    ], 8, true),
  },
  { name: 'walk', fps: 11, loop: true, frames: walkCycle(8, 0.4, 0.6, { wave: 0.9, sway: 0.4, torso: 0.04 }), events: { 1: 'step', 5: 'step' } },
  {
    name: 'run', fps: 14, loop: true,
    frames: walkCycle(8, 0.55, 0.95, { wave: 1.2, flare: 0.8, torso: 0.2, head: -0.12, nS: 0.25, nE: 0.2, fE: -0.5 }),
    events: { 1: 'step', 5: 'step' },
  },
  {
    // Taille diagonale : l'épée part derrière la tête et s'abat en avant.
    name: 'attack1', fps: 14, loop: false,
    frames: K([
      { t: 0, p: { torso: -0.15, head: 0.05, nS: -3.3, nE: -0.9, nW: -0.5, fS: 0.3, fE: -0.3, nH: 0.1, fH: -0.1, ry: -1 } },
      { t: 0.3, p: { torso: -0.05, nS: -2.9, nE: -0.6, nW: -0.4, fS: 0.2, smear: 1 } },
      { t: 0.5, p: { torso: 0.14, head: -0.06, nS: -1.8, nE: -0.25, nW: -0.15, fS: -0.3, fE: -0.4, nH: -0.25, nK: 0.2, fH: 0.15, smear: 1, runes: 1, flare: 0.4 } },
      { t: 0.7, p: { torso: 0.22, head: -0.1, nS: -0.6, nE: 0.1, nW: 0.4, fS: -0.5, fE: -0.5, nH: -0.3, nK: 0.3, fH: 0.2, ry: 2, smear: 0.6, flare: 0.5 } },
      { t: 1, p: { torso: 0.06, nS: -0.1, nW: 0.15, ry: 1 } },
    ], 7),
  },
  {
    // Revers ascendant : de bas en avant vers le haut et l'arrière.
    name: 'attack2', fps: 14, loop: false,
    frames: K([
      { t: 0, p: { torso: 0.15, nS: 0.25, nE: 0.1, nW: 0.25, ry: 3, nH: -0.2, nK: 0.3 } },
      { t: 0.3, p: { torso: 0.1, nS: -0.7, nE: -0.3, nW: -0.3, fS: 0.3, smear: 1, runes: 1 } },
      { t: 0.55, p: { torso: -0.06, head: 0.05, nS: -1.8, nE: -0.5, nW: -0.5, fS: 0.4, ry: -2, smear: 1, flare: 0.4 } },
      { t: 0.75, p: { torso: -0.1, nS: -2.1, nE: -0.6, nW: -0.6, fS: 0.35, ry: -2, smear: 0.6 } },
      { t: 1, p: { torso: -0.1, nS: -2.2, nE: -0.6, nW: -0.6, ry: -1 } },
    ], 7),
  },
  {
    // Coup vertical écrasant : saut, épée au-dessus de la tête, impact au sol.
    name: 'attack3', fps: 14, loop: false,
    frames: K([
      { t: 0, p: { torso: -0.12, nS: -3.0, nE: -1.0, nW: -0.3, fS: -2.4, fE: -0.8, ry: -3, nH: -0.2, nK: 0.4, runes: 1 } },
      { t: 0.3, p: { torso: -0.18, head: 0.08, nS: -3.2, nE: -1.1, nW: -0.4, fS: -2.6, fE: -0.9, ry: -6, nH: -0.3, nK: 0.6, fH: 0.2, fK: 0.4, runes: 1, flare: 0.5 } },
      { t: 0.45, p: { torso: 0.05, nS: -2.0, nE: -0.5, nW: 0.1, fS: -1.4, fE: -0.5, ry: -2, smear: 1, runes: 1 } },
      { t: 0.6, p: { torso: 0.3, head: -0.15, nS: -0.9, nE: -0.2, nW: 1.2, fS: -0.6, fE: -0.3, ry: 6, nH: -0.5, nK: 0.9, nA: -0.3, fH: 0.4, fK: 0.5, smear: 1, runes: 1, flare: 0.6 } },
      { t: 0.82, p: { torso: 0.3, head: -0.15, nS: -0.9, nE: -0.2, nW: 1.2, fS: -0.5, ry: 6, nH: -0.5, nK: 0.9, nA: -0.3, fH: 0.4, fK: 0.5, runes: 0.9 } },
      { t: 1, p: { torso: 0.08, nS: -0.2, nW: 0.3, ry: 2, nH: -0.1, nK: 0.2 } },
    ], 8),
  },
  {
    // Tourbillon : charge l'épée derrière, puis tour complet autour de l'épaule.
    name: 'heavy', fps: 12, loop: false,
    frames: K([
      { t: 0, p: { torso: -0.25, head: 0.1, nS: 0.9, nE: 0.4, nW: 0.6, fS: 0.6, ry: 3, nH: -0.3, nK: 0.5, fH: 0.3, fK: 0.3, runes: 1, swordBehind: 1, sway: -0.5 } },
      { t: 0.3, p: { torso: -0.3, head: 0.12, nS: 1.0, nE: 0.5, nW: 0.6, fS: 0.7, ry: 5, nH: -0.4, nK: 0.7, fH: 0.4, fK: 0.4, runes: 1, swordBehind: 1, flare: 0.3 } },
      { t: 0.45, p: { torso: 0.0, nS: -0.5, nE: 0.2, nW: 0.3, fS: 0.2, ry: 3, smear: 1, runes: 1 } },
      { t: 0.55, p: { torso: 0.2, nS: -2.0, nE: 0.0, nW: 0.1, fS: -0.4, ry: 1, nH: -0.3, fH: 0.2, smear: 1, runes: 1, flare: 0.6 } },
      { t: 0.65, p: { torso: 0.15, nS: -3.6, nE: -0.2, nW: 0.0, fS: -0.8, ry: 0, smear: 1, runes: 1, flare: 0.8 } },
      { t: 0.75, p: { torso: 0.0, nS: -5.2, nE: -0.1, nW: 0.1, fS: -0.4, ry: 2, smear: 1, runes: 1, flare: 0.8 } },
      { t: 0.87, p: { torso: -0.05, nS: -6.1, nE: 0, nW: 0.1, ry: 3, smear: 0.6, flare: 0.5 } },
      { t: 1, p: { nS: -Math.PI * 2, ry: 1 } },
    ], 9),
  },
  {
    name: 'dodge', fps: 14, loop: false,
    frames: K([
      { t: 0, p: { torso: 0.2, nS: 0.3, nE: 0.2, fS: 0.5, fE: -0.3, nH: -0.35, nK: 0.3, fH: 0.4, fK: 0.3, ry: 3, flare: 0.7, wave: 1.2 } },
      { t: 0.45, p: { torso: 0.35, head: -0.15, nS: 0.5, nE: 0.3, fS: 0.8, fE: -0.4, nH: -0.55, nK: 0.5, fH: 0.6, fK: 0.6, ry: 5, flare: 1.2, wave: 1.4, runes: 1 } },
      { t: 1, p: { torso: 0.12, nS: 0.1, fS: 0.2, ry: 2, flare: 0.4, wave: 0.9 } },
    ], 6),
  },
  {
    name: 'roll', fps: 16, loop: false,
    frames: [
      { ...BASE, torso: 0.3, head: 0.2, nS: 0.3, fS: 0.4, nH: -0.4, nK: 0.6, fH: -0.2, fK: 0.6, ry: 5, flare: 0.5 },
      ...[1, 2, 3, 4, 5, 6].map((i) => ({
        ...BASE, torso: 0.5, head: 0.35, nS: 0.5, nE: 0.6, fS: 0.6, fE: 0.8,
        nH: -1.1, nK: 1.6, fH: -0.9, fK: 1.7, ry: 8, flare: 0.9, wave: 1.2, swordBehind: 1,
        roll: (i / 6) * Math.PI * 2 - 0.0001,
      })),
      { ...BASE, torso: 0.2, nS: 0.2, nH: -0.3, nK: 0.5, fK: 0.3, ry: 4, flare: 0.4 },
    ],
  },
  {
    name: 'hurt', fps: 10, loop: false,
    frames: K([
      { t: 0, p: { torso: -0.22, head: -0.25, nS: 0.35, nE: 0.2, fS: -0.5, fE: -0.4, nH: 0.15, fH: -0.1, ry: 1, sway: -0.6, runes: 0.2 } },
      { t: 0.5, p: { torso: -0.15, head: -0.12, nS: 0.25, fS: -0.3, ry: 2 } },
      { t: 1, p: { torso: -0.04, ry: 1 } },
    ], 3),
  },
  {
    // Genou arrière à terre, cuisse avant à l'horizontale, épée plantée devant lui.
    name: 'death', fps: 9, loop: false,
    frames: K([
      { t: 0, p: { torso: -0.22, head: -0.25, nS: 0.35, fS: -0.4, runes: 0.3 } },
      { t: 0.3, p: { torso: 0.1, head: 0.1, nS: -0.2, nW: 0.4, nH: -0.6, nK: 0.6, fH: 0.05, fK: 0.7, fA: -0.4, ry: 5 } },
      { t: 0.6, p: { torso: 0.25, head: 0.35, nS: -0.5, nE: -0.1, nW: 1.0, fS: 0.3, fE: 0.4, nH: -1.5, nK: 1.4, nA: 0.1, fH: 0.1, fK: 1.65, fA: -1.2, ry: 14, runes: 0.1, wave: 0.3 } },
      { t: 1, p: { torso: 0.32, head: 0.5, nS: -0.5, nE: -0.1, nW: 1.05, fS: 0.35, fE: 0.5, nH: -1.6, nK: 1.45, nA: 0.15, fH: 0.1, fK: 1.7, fA: -1.2, ry: 15, runes: 0, wave: 0.15, sway: -0.3 } },
    ], 9),
  },
  {
    // Griffe abyssale : la main arrière déchire l'air en avant.
    name: 'cast', fps: 14, loop: false,
    frames: K([
      { t: 0, p: { torso: -0.12, fS: -2.6, fE: -0.6, fW: -0.4, nS: 0.2, runes: 1 } },
      { t: 0.35, p: { torso: 0.05, fS: -2.0, fE: -0.3, fW: -0.2, claw: 1, runes: 1 } },
      { t: 0.55, p: { torso: 0.25, head: -0.1, fS: -0.7, fE: 0.0, fW: 0.2, nH: -0.3, nK: 0.3, claw: 1, runes: 1, flare: 0.5 } },
      { t: 0.75, p: { torso: 0.22, fS: -0.2, fE: 0.1, fW: 0.3, nH: -0.3, nK: 0.3, claw: 0.5, flare: 0.3 } },
      { t: 1, p: { torso: 0.05, fS: 0 } },
    ], 7),
  },
  {
    name: 'interact', fps: 8, loop: false,
    frames: K([
      { t: 0, p: { torso: 0.05 } },
      { t: 1, p: { torso: 0.15, head: -0.1, fS: -1.3, fE: -0.4, fW: -0.2, nH: -0.2, nK: 0.2, runes: 1 } },
    ], 4),
  },
  {
    // Victoire : Eclipse brandie vers le ciel.
    name: 'victory', fps: 7, loop: true,
    frames: K([
      { t: 0, p: { torso: -0.1, head: 0.12, nS: -2.6, nE: -0.1, nW: 0.43, fS: 0.4, fE: -0.3, runes: 1, flare: 0.5, wave: 1 } },
      { t: 0.5, p: { torso: -0.12, head: 0.15, nS: -2.65, nE: -0.12, nW: 0.47, fS: 0.45, fE: -0.35, runes: 1, flare: 0.7, wave: 1.2, ry: -1 } },
      { t: 1, p: { torso: -0.1, head: 0.12, nS: -2.6, nE: -0.1, nW: 0.43, fS: 0.4, fE: -0.3, runes: 1, flare: 0.5, wave: 1 } },
    ], 6, true),
  },
];

/**
 * Traînées : l'arc est déduit de la trajectoire réelle de la pointe de
 * l'épée autour de l'épaule (deux frames en arrière → frame courante).
 */
function annotateTrails(rig: RigData, clip: ClipDef<VarynPose>): void {
  let prev: number | null = null;
  let prevPrev: number | null = null;
  for (const f of clip.frames) {
    const tf = transformsOf(rig, f);
    const sh = worldPoint(rig, tf, 'nUpper', P.nShoulder);
    const tip = worldPoint(rig, tf, 'sword', SWORD_TIP);
    let a = Math.atan2(tip.y - sh.y, tip.x - sh.x);
    if (prev !== null) {
      while (a - prev > Math.PI) a -= Math.PI * 2;
      while (a - prev < -Math.PI) a += Math.PI * 2;
    }
    if (f.smear > 0 && prev !== null) {
      f.smearFrom = prevPrev ?? prev;
      f.smearTo = a;
      f.smearR = Math.hypot(tip.x - sh.x, tip.y - sh.y);
    }
    if (f.claw > 0) {
      const fsh = worldPoint(rig, tf, 'fUpper', P.fShoulder);
      const hand = worldPoint(rig, tf, 'fHand', P.fHand);
      const ha = Math.atan2(hand.y - fsh.y, hand.x - fsh.x);
      f.clawTo = ha;
      f.clawFrom = ha - 1.4;
    }
    prevPrev = prev;
    prev = a;
  }
}

export const VARYN_CLIPS = CLIPS;

let cached: SpriteSheet | null = null;

export function getVarynSheet(): SpriteSheet {
  if (!cached) {
    const rig = buildRig();
    for (const clip of CLIPS) annotateTrails(rig, clip);
    cached = buildSpriteSheet<VarynPose>({
      frameW: FW,
      frameH: FH,
      pivotX: PIVOT_X,
      pivotY: G,
      pixelsPerUnit: 32,
      outline: null,
      facesLeft: false,
      clips: CLIPS,
      draw: (pose, c, e, frame, row) => {
        const count = CLIPS[row].frames.length;
        if (pose.roll !== 0) {
          const tc = new PixelCanvas(FW, FH);
          const te = new PixelCanvas(FW, FH);
          drawFrame(rig, pose, tc, te, frame, count);
          const cx = OX + 60, cy = OY + 80;
          c.blit(rotated(tc, pose.roll, cx, cy), 0, 0);
          e.blit(rotated(te, pose.roll, cx, cy), 0, 0);
        } else {
          drawFrame(rig, pose, c, e, frame, count);
        }
      },
    });
  }
  return cached;
}

/** Zone du heaume pour le portrait du HUD. */
export const VARYN_PORTRAIT_RECT = { x: OX + 42, y: OY + 2, w: 40, h: 40 };

/** Débogage : parties du rig en couleurs (?debug=sprites&rig=1). */
export function debugRigCanvas(): HTMLCanvasElement {
  const rig = buildRig();
  const c = new PixelCanvas(rig.w * 2 + 4, rig.h);
  const hue = (k: number) => {
    const a = (k * 137.5 * Math.PI) / 180;
    const r = 128 + 120 * Math.cos(a), g = 128 + 120 * Math.cos(a + 2.1), b = 128 + 120 * Math.cos(a + 4.2);
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  };
  for (let y = 0; y < rig.h; y++)
    for (let x = 0; x < rig.w; x++) {
      const i = y * rig.w + x;
      if (rig.part[i] >= 0) c.px(x, y, hue(rig.part[i]));
      if (rig.underPart[i] >= 0) c.px(rig.w + 4 + x, y, rig.underColor[i]);
      else if (rig.part[i] >= 0 && rig.bones[rig.part[i]].core) c.px(rig.w + 4 + x, y, rig.color[i]);
    }
  for (const b of rig.bones) c.px(b.pivot.x, b.pivot.y, 0xffffff);
  return c.toCanvas();
}
