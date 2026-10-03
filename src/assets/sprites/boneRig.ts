import { PixelCanvas } from '../pixel/PixelCanvas';
import type { Pixels } from '../images/registry';

/**
 * Rig squelettique 2D pour animer un sprite dessiné d'un seul tenant.
 *
 * 1. Segmentation : chaque pixel opaque de l'image est attribué à une partie
 *    (os) — par règles de région puis par distance aux segments osseux.
 * 2. Sous-couche : les pixels occupés par les membres sont reconstitués sur
 *    les parties « cœur » (buste, bassin, cape) par propagation des couleurs
 *    voisines, pour qu'aucun trou n'apparaisse quand un membre bouge.
 * 3. Rendu : chaque partie est dessinée par transformation inverse (rotation
 *    autour de son articulation, composée avec celles de ses parents), dans
 *    un ordre de profondeur défini, puis les fissures aux articulations sont
 *    refermées.
 */
export interface Vec {
  x: number;
  y: number;
}

/** Transformation affine 2D : x' = a·x + c·y + tx ; y' = b·x + d·y + ty. */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

export function apply(m: Affine, p: Vec): Vec {
  return { x: m.a * p.x + m.c * p.y + m.tx, y: m.b * p.x + m.d * p.y + m.ty };
}

export function compose(m: Affine, n: Affine): Affine {
  // m ∘ n : applique n puis m.
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    tx: m.a * n.tx + m.c * n.ty + m.tx,
    ty: m.b * n.tx + m.d * n.ty + m.ty,
  };
}

export function invert(m: Affine): Affine {
  const det = m.a * m.d - m.b * m.c;
  const a = m.d / det, b = -m.b / det, c = -m.c / det, d = m.a / det;
  return { a, b, c, d, tx: -(a * m.tx + c * m.ty), ty: -(b * m.tx + d * m.ty) };
}

export function rotateAbout(p: Vec, angle: number): Affine {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return { a: cs, b: sn, c: -sn, d: cs, tx: p.x - cs * p.x + sn * p.y, ty: p.y - sn * p.x - cs * p.y };
}

export function translate(x: number, y: number): Affine {
  return { a: 1, b: 0, c: 0, d: 1, tx: x, ty: y };
}

export interface BoneDef {
  id: string;
  parent: string | null;
  pivot: Vec;
  /** Partie « cœur » : reçoit la sous-couche reconstituée. */
  core?: boolean;
}

export interface RigData {
  w: number;
  h: number;
  color: Uint32Array;
  glow: Uint8Array;
  /** Index de partie par pixel (-1 : transparent). */
  part: Int16Array;
  /** Sous-couche : couleur et partie cœur sous les membres (-1 : aucune). */
  underPart: Int16Array;
  underColor: Uint32Array;
  bones: BoneDef[];
  index: Map<string, number>;
  /** Boîte englobante source par partie (avec la sous-couche). */
  bbox: { x0: number; y0: number; x1: number; y1: number }[];
}

/**
 * Construit le rig : `classify` renvoie l'identifiant de partie d'un pixel
 * opaque (ou null si transparent).
 */
export function buildBoneRig(
  src: Pixels,
  bones: BoneDef[],
  classify: (x: number, y: number, rgb: number) => string,
): RigData {
  const { width: w, height: h, data } = src;
  const index = new Map(bones.map((b, i) => [b.id, i]));
  const color = new Uint32Array(w * h);
  const glow = new Uint8Array(w * h);
  const part = new Int16Array(w * h).fill(-1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      color[i] = (r << 16) | (g << 8) | b;
      if (data[i * 4 + 3] < 128) continue;
      if (b > 110 && b > g + 45 && r > g + 10) glow[i] = 1;
      const id = classify(x, y, color[i]);
      const k = index.get(id);
      if (k === undefined) throw new Error(`Partie inconnue : ${id}`);
      part[i] = k;
    }

  // Sous-couche : reconstitue les parties cœur sous les membres.
  const isCore = bones.map((b) => !!b.core);
  const underPart = new Int16Array(w * h).fill(-1);
  const underColor = new Uint32Array(w * h);
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && part[y * w + x] >= 0;
  const enclosed = (x: number, y: number) => {
    // Encadré par de la matière dans au moins une direction (on ne crée pas de matière hors silhouette).
    for (const [ax, ay] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      let sides = 0;
      for (const s of [-1, 1]) {
        for (let k = 1; k <= 14; k++) {
          const xx = x + ax * k * s, yy = y + ay * k * s;
          if (!opaque(xx, yy)) break;
          if (isCore[part[yy * w + xx]]) {
            sides++;
            break;
          }
        }
      }
      if (sides === 2) return true;
    }
    return false;
  };
  let pending: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (part[i] < 0 || isCore[part[i]]) continue;
    if (enclosed(i % w, (i / w) | 0)) pending.push(i);
  }
  const lum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
  for (let pass = 0; pass < 40 && pending.length; pass++) {
    const next: number[] = [];
    const adds: [number, number, number][] = [];
    for (const i of pending) {
      const x = i % w, y = (i / w) | 0;
      let best = -1, bestC = 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + ox, yy = y + oy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        let p = -1, c = 0;
        if (underPart[j] >= 0) {
          p = underPart[j];
          c = underColor[j];
        } else if (part[j] >= 0 && isCore[part[j]]) {
          p = part[j];
          c = color[j];
        }
        if (p >= 0 && (best < 0 || lum(c) < lum(bestC))) {
          best = p;
          bestC = c;
        }
      }
      if (best >= 0) adds.push([i, best, bestC]);
      else next.push(i);
    }
    for (const [i, p, c] of adds) {
      underPart[i] = p;
      underColor[i] = c;
    }
    pending = next;
  }

  const bbox = bones.map(() => ({ x0: w, y0: h, x1: -1, y1: -1 }));
  for (let i = 0; i < w * h; i++) {
    for (const p of [part[i], underPart[i]]) {
      if (p < 0) continue;
      const x = i % w, y = (i / w) | 0;
      const bb = bbox[p];
      bb.x0 = Math.min(bb.x0, x);
      bb.y0 = Math.min(bb.y0, y);
      bb.x1 = Math.max(bb.x1, x);
      bb.y1 = Math.max(bb.y1, y);
    }
  }
  return { w, h, color, glow, part, underPart, underColor, bones, index, bbox };
}

/** Calcule les transformations monde de chaque os (angles relatifs au repos). */
export function boneTransforms(rig: RigData, angles: Record<string, number>, root: Affine): Affine[] {
  const out: Affine[] = new Array(rig.bones.length);
  const resolve = (i: number): Affine => {
    if (out[i]) return out[i];
    const b = rig.bones[i];
    const parent = b.parent === null ? root : resolve(rig.index.get(b.parent)!);
    out[i] = compose(parent, rotateAbout(b.pivot, angles[b.id] ?? 0));
    return out[i];
  };
  for (let i = 0; i < rig.bones.length; i++) resolve(i);
  return out;
}

export interface DrawOptions {
  /** Décalage horizontal par ligne source (ondulation de cape), par partie. */
  rowShift?: Record<string, (srcY: number) => number>;
  /** Intensité de la lueur des reflets émissifs. */
  glow: number;
}

/** Dessine une partie transformée (avec sa sous-couche si c'est une partie cœur). */
export function drawPart(
  rig: RigData,
  id: string,
  m: Affine,
  ox: number,
  oy: number,
  c: PixelCanvas,
  e: PixelCanvas,
  opts: DrawOptions,
): void {
  const k = rig.index.get(id)!;
  const bb = rig.bbox[k];
  if (bb.x1 < 0) return;
  const shift = opts.rowShift?.[id];
  const pad = shift ? 16 : 0;
  // Boîte destination : transforme les coins de la boîte source.
  const corners = [
    apply(m, { x: bb.x0 - pad, y: bb.y0 }), apply(m, { x: bb.x1 + 1 + pad, y: bb.y0 }),
    apply(m, { x: bb.x0 - pad, y: bb.y1 + 1 }), apply(m, { x: bb.x1 + 1 + pad, y: bb.y1 + 1 }),
  ];
  const x0 = Math.floor(Math.min(...corners.map((p) => p.x))) - 1;
  const x1 = Math.ceil(Math.max(...corners.map((p) => p.x))) + 1;
  const y0 = Math.floor(Math.min(...corners.map((p) => p.y))) - 1;
  const y1 = Math.ceil(Math.max(...corners.map((p) => p.y))) + 1;
  const inv = invert(m);
  const k2 = 0.55 + opts.glow * 0.6;
  for (let dy = y0; dy <= y1; dy++)
    for (let dx = x0; dx <= x1; dx++) {
      const s = apply(inv, { x: dx + 0.5, y: dy + 0.5 });
      const sy = Math.floor(s.y);
      const sx = Math.floor(s.x - (shift ? shift(sy) : 0));
      if (sx < 0 || sy < 0 || sx >= rig.w || sy >= rig.h) continue;
      const i = sy * rig.w + sx;
      let col: number;
      if (rig.part[i] === k) col = rig.color[i];
      else if (rig.underPart[i] === k) col = rig.underColor[i];
      else continue;
      c.px(ox + dx, oy + dy, col);
      if (rig.part[i] === k && rig.glow[i]) {
        const r = Math.min(255, ((col >> 16) & 255) * k2), g = Math.min(255, ((col >> 8) & 255) * k2), b = Math.min(255, (col & 255) * k2);
        e.px(ox + dx, oy + dy, (r << 16) | (g << 8) | b);
      }
    }
}

/** Referme les fissures d'un pixel (aux articulations) avec la teinte voisine la plus sombre. */
export function closeCracks(c: PixelCanvas): void {
  const fills: [number, number, number][] = [];
  for (let y = 1; y < c.height - 1; y++)
    for (let x = 1; x < c.width - 1; x++) {
      if (c.alphaAt(x, y)) continue;
      let n = 0;
      let best = -1;
      let bestL = 1e9;
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

/** Distance d'un point à un segment. */
export function segDist(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}
