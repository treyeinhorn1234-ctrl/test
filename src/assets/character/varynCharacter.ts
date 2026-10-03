import { PixelCanvas } from '../pixel/PixelCanvas';
import { getImage, type Pixels } from '../images/registry';
import type { ClipDef, ClipInfo } from '../../entities/animation/SpriteSheet';
import { crescent, rotated, sampleKeys } from '../sprites/frontRig';
import { apply, compose, invert, rotateAbout, translate, type Affine, type Vec } from '../sprites/boneRig';
import rigJson from './varyn/rig.json';

/**
 * Varyn, Seigneur des Abysses — personnage riggé à partir de calques séparés
 * (src/assets/character/varyn/, voir tools/build_varyn_parts.py) :
 *
 *   bassin ─┬─ buste ─┬─ cou ── tête
 *           │         ├─ épaulière avant / arrière
 *           │         ├─ bras avant : épaule → coude → poignet → épée Eclipse
 *           │         └─ bras arrière : épaule → coude → poignet
 *           ├─ jambe avant / arrière : hanche → genou → cheville
 *           ├─ cape arrière (ondule) · pan de cape avant
 *
 * Les images sont rendues en direct, à la demande, dans 8 directions
 * isométriques (5 vues dessinées + leurs miroirs) — sans lissage ni
 * interpolation de pixels : rotations au plus proche voisin uniquement.
 */
export type View = 'S' | 'SE' | 'E' | 'NE' | 'N';

export interface VarynPose {
  rx: number;
  ry: number;
  torso: number;
  head: number;
  nS: number;
  nE: number;
  nW: number;
  fS: number;
  fE: number;
  fW: number;
  nH: number;
  nK: number;
  nA: number;
  fH: number;
  fK: number;
  fA: number;
  sway: number;
  flare: number;
  wave: number;
  smear: number;
  smearFrom: number;
  smearTo: number;
  smearR: number;
  claw: number;
  clawFrom: number;
  clawTo: number;
  runes: number;
  roll: number;
  swordBehind: number;
}

interface BoneJson {
  id: string;
  parent: string | null;
  pivot: string;
  file: string;
  core: boolean;
}

const RIG = rigJson as unknown as {
  width: number;
  height: number;
  pivots: Record<string, [number, number]>;
  swordTip: [number, number];
  bones: BoneJson[];
  backViewLayers: { head: string; capeDrape: string };
  layerOrder: { front: string[]; back: string[] };
};
const PV = (name: string): Vec => ({ x: RIG.pivots[name][0], y: RIG.pivots[name][1] });
const SWORD_TIP: Vec = { x: RIG.swordTip[0], y: RIG.swordTip[1] };

// --- Cadre de rendu ---------------------------------------------------------
export const FRAME_W = 200;
export const FRAME_H = 200;
const OX = 55;
const OY = 70;
export const PIVOT_X = OX + 60;
export const PIVOT_Y = OY + 114;

interface Layer {
  px: Pixels;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

let layers: Map<string, Layer> | null = null;

function loadLayers(): Map<string, Layer> {
  if (layers) return layers;
  layers = new Map();
  const add = (key: string, file: string) => {
    const px = getImage(`character/varyn/${file}`);
    let x0 = px.width, y0 = px.height, x1 = -1, y1 = -1;
    for (let y = 0; y < px.height; y++)
      for (let x = 0; x < px.width; x++)
        if (px.data[(y * px.width + x) * 4 + 3] >= 128) {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y);
          x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
    layers!.set(key, { px, x0, y0, x1, y1 });
  };
  for (const b of RIG.bones) add(b.id, b.file);
  add('headBack', RIG.backViewLayers.head);
  add('capeDrape', RIG.backViewLayers.capeDrape);
  return layers;
}

// --- Squelette ----------------------------------------------------------------
function anglesOf(p: VarynPose): Record<string, number> {
  return {
    torso: p.torso, neck: p.head * 0.35, head: p.head * 0.65,
    nUpper: p.nS, nFore: p.nE, nHand: p.nW, nPad: p.nS * 0.3,
    fUpper: p.fS, fFore: p.fE, fHand: p.fW, fPad: p.fS * 0.3,
    nThigh: p.nH, nShin: p.nK, nFoot: p.nA,
    fThigh: p.fH, fShin: p.fK, fFoot: p.fA,
  };
}

const NEAR_ARM = ['nUpper', 'nFore', 'nHand', 'sword', 'nPad'];
const FAR_ARM = ['fUpper', 'fFore', 'fHand', 'fPad'];
const NEAR_LEG = ['nThigh', 'nShin', 'nFoot'];
const FAR_LEG = ['fThigh', 'fShin', 'fFoot'];
const BODY = ['torso', 'pelvis', 'neck', 'head', 'capeFront', 'capeDrape'];

/** Ajustement de vue : corrige la silhouette pour chaque orientation dessinée. */
function viewAdjust(view: View, bone: string): Affine {
  const squash = (s: number, cx: number): Affine => ({ a: s, b: 0, c: 0, d: 1, tx: cx * (1 - s), ty: 0 });
  const front = view === 'S' || view === 'N';
  const profile = view === 'E';
  if (front) {
    // Face (ou dos) : bras et jambes s'écartent symétriquement.
    if (NEAR_ARM.includes(bone)) return translate(-3, 0);
    if (FAR_ARM.includes(bone)) return translate(4, 0);
    if (NEAR_LEG.includes(bone)) return translate(-2, 0);
    if (FAR_LEG.includes(bone)) return translate(3, 0);
    return translate(0, 0);
  }
  if (profile) {
    // Profil : buste plus étroit, bras et jambe arrière masqués derrière le corps.
    if (BODY.includes(bone)) return squash(0.8, 61);
    if (FAR_ARM.includes(bone)) return compose(translate(-8, 0), squash(0.8, 76));
    if (FAR_LEG.includes(bone)) return translate(-5, 0);
    if (NEAR_LEG.includes(bone)) return translate(1, 0);
    if (NEAR_ARM.includes(bone)) return translate(3, 0);
    if (bone === 'cape') return translate(-4, 0);
    return translate(0, 0);
  }
  return translate(0, 0);
}

function worldTransforms(p: VarynPose, view: View): Map<string, Affine> {
  const ang = anglesOf(p);
  const root = translate(p.rx, p.ry);
  const out = new Map<string, Affine>();
  const byId = new Map(RIG.bones.map((b) => [b.id, b]));
  const resolve = (id: string): Affine => {
    const hit = out.get(id);
    if (hit) return hit;
    const b = byId.get(id)!;
    const parent = b.parent === null ? root : resolve(b.parent);
    const m = compose(parent, rotateAbout(PV(b.pivot), ang[id] ?? 0));
    out.set(id, m);
    return m;
  };
  for (const b of RIG.bones) resolve(b.id);
  // Calques propres aux vues de dos, attachés au buste / à la tête.
  out.set('capeDrape', out.get('torso')!);
  out.set('headBack', out.get('head')!);
  const adjusted = new Map<string, Affine>();
  for (const [id, m] of out) adjusted.set(id, compose(viewAdjust(view, id === 'headBack' ? 'head' : id), m));
  return adjusted;
}

function drawLayer(
  layer: Layer, m: Affine, c: PixelCanvas, e: PixelCanvas, glow: number,
  shift?: (sy: number) => number,
): void {
  const pad = shift ? 16 : 0;
  const pts = [
    apply(m, { x: layer.x0 - pad, y: layer.y0 }), apply(m, { x: layer.x1 + 1 + pad, y: layer.y0 }),
    apply(m, { x: layer.x0 - pad, y: layer.y1 + 1 }), apply(m, { x: layer.x1 + 1 + pad, y: layer.y1 + 1 }),
  ];
  const x0 = Math.floor(Math.min(...pts.map((q) => q.x))) - 1;
  const x1 = Math.ceil(Math.max(...pts.map((q) => q.x))) + 1;
  const y0 = Math.floor(Math.min(...pts.map((q) => q.y))) - 1;
  const y1 = Math.ceil(Math.max(...pts.map((q) => q.y))) + 1;
  const inv = invert(m);
  const { px } = layer;
  const k = 0.55 + glow * 0.6;
  for (let dy = y0; dy <= y1; dy++)
    for (let dx = x0; dx <= x1; dx++) {
      const s = apply(inv, { x: dx + 0.5, y: dy + 0.5 });
      const sy = Math.floor(s.y);
      const sx = Math.floor(s.x - (shift ? shift(sy) : 0));
      if (sx < 0 || sy < 0 || sx >= px.width || sy >= px.height) continue;
      const i = (sy * px.width + sx) * 4;
      if (px.data[i + 3] < 128) continue;
      const r = px.data[i], g = px.data[i + 1], b = px.data[i + 2];
      const col = (r << 16) | (g << 8) | b;
      c.px(OX + dx, OY + dy, col);
      // Reflets violets de l'armure : émissifs.
      if (b > 110 && b > g + 45 && r > g + 10) {
        e.px(OX + dx, OY + dy, (Math.min(255, r * k) << 16) | (Math.min(255, g * k) << 8) | Math.min(255, b * k));
      }
    }
}

/** Referme les fissures d'un pixel aux articulations (teinte voisine la plus sombre). */
function closeCracks(c: PixelCanvas): void {
  const fills: [number, number, number][] = [];
  for (let y = 1; y < c.height - 1; y++)
    for (let x = 1; x < c.width - 1; x++) {
      if (c.alphaAt(x, y)) continue;
      let n = 0, best = 0, bestL = 1e9;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!c.alphaAt(x + ox, y + oy)) continue;
        n++;
        const col = c.colorAt(x + ox, y + oy);
        const l = ((col >> 16) & 255) + ((col >> 8) & 255) + (col & 255);
        if (l < bestL) {
          bestL = l;
          best = col;
        }
      }
      if (n >= 3) fills.push([x, y, best]);
    }
  for (const [x, y, col] of fills) c.px(x, y, col);
}

function flipped(src: PixelCanvas): PixelCanvas {
  const out = new PixelCanvas(src.width, src.height);
  out.blit(src, 0, 0, true);
  return out;
}

/**
 * Rendu d'une pose dans une vue. Les vues de dos (NE, N) utilisent le
 * heaume vu de dos et la cape drapée, l'épée passe derrière le corps, puis
 * l'image est retournée (la main d'épée se retrouve du bon côté).
 */
export function renderPose(p: VarynPose, view: View, phase: number): { color: PixelCanvas; emissive: PixelCanvas } {
  const L = loadLayers();
  const back = view === 'NE' || view === 'N';
  const tf = worldTransforms(p, view);
  let c = new PixelCanvas(FRAME_W, FRAME_H);
  let e = new PixelCanvas(FRAME_W, FRAME_H);
  const capeShift = (sy: number) => {
    const f = Math.max(0, Math.min(1, (sy - 50) / 70));
    const wave = Math.sin(sy * 0.21 - phase) * p.wave * 2.2 + Math.sin(sy * 0.47 - phase * 2) * p.wave * 0.8;
    return Math.round(f * (wave + p.sway * 3 - p.flare * 10));
  };
  const drapeShift = (sy: number) => {
    const f = Math.max(0, Math.min(1, (sy - 40) / 70));
    return Math.round(f * (Math.sin(sy * 0.18 - phase) * p.wave * 1.6 + p.sway * 2 + p.flare * 4));
  };
  const frontShift = (sy: number) => Math.round(Math.max(0, (sy - 88) / 18) * Math.sin(sy * 0.4 - phase) * p.wave * 1.5);
  const order = back ? RIG.layerOrder.back : RIG.layerOrder.front;
  const draw = (id: string) => {
    const key = back && id === 'head' ? 'headBack' : id;
    const layer = L.get(key);
    const m = tf.get(key);
    if (!layer || !m) return;
    const shift = id === 'cape' ? capeShift : id === 'capeDrape' ? drapeShift : id === 'capeFront' ? frontShift : undefined;
    drawLayer(layer, m, c, e, back && id === 'head' ? 0 : p.runes, shift);
  };
  if (!back && p.swordBehind > 0.5) draw('sword');
  for (const id of order) {
    if (!back && id === 'sword' && p.swordBehind > 0.5) continue;
    draw(id);
  }
  closeCracks(c);
  c.outline(0x05040a);

  const shoulder = apply(tf.get('nUpper')!, PV('nShoulder'));
  if (p.smear > 0) {
    crescent(c, e, { x: OX + shoulder.x, y: OY + shoulder.y }, p.smearFrom, p.smearTo, Math.max(10, p.smearR - 42), p.smearR + 3,
      { edge: 0xf0e4ff, core: 0xb27cff, faint: 0x6a30d0 }, p.smear);
  }
  if (p.claw > 0) {
    const fsh = apply(tf.get('fUpper')!, PV('fShoulder'));
    for (const r of [24, 30, 36]) {
      crescent(c, e, { x: OX + fsh.x, y: OY + fsh.y }, p.clawFrom, p.clawTo, r - 2, r, { edge: 0xe8d4ff, core: 0xa060ff, faint: 0x6a30d0 }, p.claw);
    }
  }
  if (back) {
    c = flipped(c);
    e = flipped(e);
  }
  if (p.roll !== 0) {
    const cx = OX + 60, cy = OY + 80;
    c = rotated(c, p.roll, cx, cy);
    e = rotated(e, p.roll, cx, cy);
  }
  return { color: c, emissive: e };
}

// ------------------------------------------------------------- animations

const BASE: VarynPose = {
  rx: 0, ry: 0, torso: 0, head: 0,
  nS: 0, nE: 0, nW: 0, fS: 0, fE: 0, fW: 0,
  nH: 0, nK: 0, nA: 0, fH: 0, fK: 0, fA: 0,
  sway: 0, flare: 0, wave: 0.6,
  smear: 0, smearFrom: 0, smearTo: 0, smearR: 0,
  claw: 0, clawFrom: 0, clawTo: 0,
  runes: 0.5, roll: 0, swordBehind: 0,
};

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
    ], 8),
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
    ], 8),
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
    ], 6),
  },
  {
    // Genou arrière à terre, cuisse avant à l'horizontale, épée plantée devant lui.
    name: 'death', fps: 9, loop: false,
    frames: K([
      { t: 0, p: { torso: -0.22, head: -0.25, nS: 0.35, fS: -0.4, runes: 0.3 } },
      { t: 0.3, p: { torso: 0.1, head: 0.1, nS: -0.2, nW: 0.4, nH: -0.6, nK: 0.6, fH: 0.05, fK: 0.7, fA: -0.4, ry: 5 } },
      { t: 0.6, p: { torso: 0.25, head: 0.35, nS: -0.5, nE: -0.1, nW: 1.0, fS: 0.3, fE: 0.4, nH: -1.5, nK: 1.4, nA: 0.1, fH: 0.1, fK: 1.65, fA: -1.2, ry: 14, runes: 0.1, wave: 0.3 } },
      { t: 1, p: { torso: 0.32, head: 0.5, nS: -0.5, nE: -0.1, nW: 1.05, fS: 0.35, fE: 0.5, nH: -1.6, nK: 1.45, nA: 0.15, fH: 0.1, fK: 1.7, fA: -1.2, ry: 15, runes: 0, wave: 0.15, sway: -0.3 } },
    ], 8),
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
    ], 8),
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
function annotateTrails(clip: ClipDef<VarynPose>): void {
  let prev: number | null = null;
  let prevPrev: number | null = null;
  for (const f of clip.frames) {
    const tf = worldTransforms(f, 'SE');
    const sh = apply(tf.get('nUpper')!, PV('nShoulder'));
    const tip = apply(tf.get('sword')!, SWORD_TIP);
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
      const fsh = apply(tf.get('fUpper')!, PV('fShoulder'));
      const hand = apply(tf.get('fHand')!, PV('fHand'));
      const ha = Math.atan2(hand.y - fsh.y, hand.x - fsh.x);
      f.clawTo = ha;
      f.clawFrom = ha - 1.4;
    }
    prevPrev = prev;
    prev = a;
  }
}
for (const c of CLIPS) annotateTrails(c);

export const VARYN_CLIPS = CLIPS;

/** Table des clips (pour le lecteur d'animation). */
export const VARYN_CLIP_INFO: Map<string, ClipInfo> = new Map(
  CLIPS.map((c, row) => [c.name, { name: c.name, row, count: c.frames.length, fps: c.fps, loop: c.loop, events: c.events ?? {} }]),
);

/** Huit directions écran → vue dessinée + miroir. */
export function viewForDirection(screenX: number, screenUp: number): { view: View; flip: boolean } {
  const a = Math.atan2(screenUp, screenX);
  const k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; // 0 = E, 1 = NE, 2 = N … 7 = SE
  const table: { view: View; flip: boolean }[] = [
    { view: 'E', flip: false }, { view: 'NE', flip: false }, { view: 'N', flip: false }, { view: 'NE', flip: true },
    { view: 'E', flip: true }, { view: 'SE', flip: true }, { view: 'S', flip: false }, { view: 'SE', flip: false },
  ];
  return table[k];
}

/**
 * Fournisseur d'images : rend à la demande et garde en cache les dernières
 * images (clé : clip, frame, vue).
 */
export class VarynFrames {
  private cache = new Map<string, { color: ImageData; emissive: ImageData }>();
  private readonly max = 160;

  get(clip: string, frame: number, view: View): { color: ImageData; emissive: ImageData } {
    const key = `${clip}|${frame}|${view}`;
    const hit = this.cache.get(key);
    if (hit) {
      this.cache.delete(key);
      this.cache.set(key, hit);
      return hit;
    }
    const def = CLIPS.find((c) => c.name === clip) ?? CLIPS[0];
    const pose = def.frames[Math.min(frame, def.frames.length - 1)];
    const { color, emissive } = renderPose(pose, view, (frame / def.frames.length) * Math.PI * 2);
    const res = { color: toImageData(color), emissive: toImageData(emissive) };
    this.cache.set(key, res);
    if (this.cache.size > this.max) this.cache.delete(this.cache.keys().next().value!);
    return res;
  }
}

function toImageData(c: PixelCanvas): ImageData {
  return new ImageData(new Uint8ClampedArray(c.data), c.width, c.height);
}

let shared: VarynFrames | null = null;
export function getVarynFrames(): VarynFrames {
  if (!shared) shared = new VarynFrames();
  return shared;
}

/** Portrait du HUD : heaume recadré sur la pose de repos. */
export function varynPortraitSource(): { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number } {
  return { canvas: renderPose(CLIPS[0].frames[0], 'SE', 0).color.toCanvas(), x: OX + 42, y: OY + 2, w: 40, h: 40 };
}
