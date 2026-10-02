import { PixelCanvas, mixColor } from '../pixel/PixelCanvas';

/**
 * Outils de dessin des personnages « vue de face 3/4 » détaillés :
 * - masques de formes (polygones, ellipses, segments épais),
 * - peinture de plaques d'armure : biseau éclairé en haut à gauche, ombre en
 *   bas à droite, liseré gravé intérieur, dégradé tramé,
 * - filigranes (volutes), gemmes,
 * - flammes animées autour d'une silhouette,
 * - traînées d'arme avec angles non bornés (balayages > 180°),
 * - rotation au plus proche voisin (roulade).
 */
export interface Pt {
  x: number;
  y: number;
}

export class Mask {
  readonly data: Uint8Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8Array(w * h);
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }
  set(x: number, y: number): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = 1;
  }
  poly(pts: ReadonlyArray<Pt>): this {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++)
      for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
        const tx = x + 0.5, ty = y + 0.5;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const a = pts[i], b = pts[j];
          if (a.y > ty !== b.y > ty && tx < ((b.x - a.x) * (ty - a.y)) / (b.y - a.y) + a.x) inside = !inside;
        }
        if (inside) this.set(x, y);
      }
    return this;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y);
      }
    return this;
  }
  /** Segment épais à extrémités arrondies (capsule) avec épaisseur variable. */
  capsule(a: Pt, b: Pt, r0: number, r1 = r0): this {
    const minX = Math.floor(Math.min(a.x, b.x) - Math.max(r0, r1) - 1);
    const maxX = Math.ceil(Math.max(a.x, b.x) + Math.max(r0, r1) + 1);
    const minY = Math.floor(Math.min(a.y, b.y) - Math.max(r0, r1) - 1);
    const maxY = Math.ceil(Math.max(a.y, b.y) + Math.max(r0, r1) + 1);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
        const qx = a.x + dx * t, qy = a.y + dy * t;
        const r = r0 + (r1 - r0) * t;
        if ((px - qx) ** 2 + (py - qy) ** 2 <= r * r) this.set(x, y);
      }
    return this;
  }
  rect(x: number, y: number, w: number, h: number): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j);
    return this;
  }
  /** Distance (4-voisinage) au bord, plafonnée à `max`. 0 = hors masque. */
  distances(max = 5): Uint8Array {
    const d = new Uint8Array(this.w * this.h);
    for (let i = 0; i < d.length; i++) d[i] = this.data[i] ? 255 : 0;
    for (let k = 1; k <= max; k++) {
      for (let y = 0; y < this.h; y++)
        for (let x = 0; x < this.w; x++) {
          const i = y * this.w + x;
          if (d[i] !== 255) continue;
          const n = (xx: number, yy: number) => (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h ? 0 : d[yy * this.w + xx]);
          if (n(x - 1, y) === k - 1 || n(x + 1, y) === k - 1 || n(x, y - 1) === k - 1 || n(x, y + 1) === k - 1) d[i] = k;
        }
    }
    for (let i = 0; i < d.length; i++) if (d[i] === 255) d[i] = max + 1;
    return d;
  }
}

export interface Tones {
  /** Arête éclairée. */
  rim: number;
  hi: number;
  base: number;
  dark: number;
  /** Arête dans l'ombre. */
  shadow: number;
  /** Liseré gravé (ornement). */
  engrave?: number;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => BAYER[(x & 3) + (y & 3) * 4] / 16;

/** Peint une plaque à partir d'un masque, avec volume et gravure. */
export function paint(c: PixelCanvas, m: Mask, t: Tones, opts: { engraveAt?: number; light?: number } = {}): void {
  const d = m.distances(5);
  let minY = Infinity, maxY = -Infinity;
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++)
      if (d[y * m.w + x]) {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
  const span = Math.max(1, maxY - minY);
  const light = opts.light ?? 0;
  const engraveAt = opts.engraveAt ?? 3;
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const k = d[y * m.w + x];
      if (!k) continue;
      let col: number;
      if (k === 1) {
        const up = !m.get(x, y - 1) || !m.get(x - 1, y);
        const down = !m.get(x, y + 1) || !m.get(x + 1, y);
        col = up && !down ? t.rim : down ? t.shadow : t.dark;
      } else if (t.engrave !== undefined && k === engraveAt && maxDistOk(d, m, x, y, engraveAt + 2)) {
        col = !m.get(x, y - engraveAt) || !m.get(x - engraveAt, y) ? t.engrave : mixColor(t.engrave, t.dark, 0.45);
      } else {
        // Dégradé vertical tramé : haut clair → bas sombre.
        const v = (y - minY) / span - light;
        const b = bayer(x, y);
        col = v < 0.3 ? (v + b * 0.3 < 0.28 ? t.hi : t.base) : v > 0.68 ? (v - b * 0.3 > 0.62 ? t.dark : t.base) : t.base;
      }
      c.px(x, y, col);
    }
}

/** Vrai si la forme est assez épaisse autour du point pour porter une gravure. */
function maxDistOk(d: Uint8Array, m: Mask, x: number, y: number, need: number): boolean {
  let best = 0;
  for (let j = -2; j <= 2; j++)
    for (let i = -2; i <= 2; i++) {
      const xx = x + i, yy = y + j;
      if (xx < 0 || yy < 0 || xx >= m.w || yy >= m.h) continue;
      best = Math.max(best, d[yy * m.w + xx]);
    }
  return best >= need;
}

/** Volute ornementale (spirale) façon filigrane. */
export function swirl(c: PixelCanvas, cx: number, cy: number, r: number, color: number, dir = 1, turns = 1.4): void {
  const steps = Math.ceil(r * 10);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = dir * t * Math.PI * 2 * turns;
    const rr = r * (1 - t * 0.75);
    c.px(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), color);
  }
}

/** Gemme en losange, émissive. */
export function gem(c: PixelCanvas, e: PixelCanvas, x: number, y: number, size: number, cols: [number, number, number]): void {
  x = Math.round(x);
  y = Math.round(y);
  for (let j = -size; j <= size; j++)
    for (let i = -size; i <= size; i++) {
      const dist = Math.abs(i) + Math.abs(j);
      if (dist > size) continue;
      const col = dist === size ? cols[0] : i + j < 0 ? cols[2] : cols[1];
      c.px(x + i, y + j, col);
      e.px(x + i, y + j, col);
    }
}

function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Flammes autour d'une silhouette : des langues ondulantes naissent sur les
 * bords supérieurs et latéraux et montent en s'affinant. Elles ne recouvrent
 * jamais le personnage (dessinées seulement dans le vide).
 */
export function flames(
  c: PixelCanvas,
  e: PixelCanvas,
  region: Mask | null,
  seed: number,
  intensity: number,
  palette: [number, number, number],
  density = 0.1,
): void {
  if (intensity <= 0) return;
  const w = c.width, h = c.height;
  const solid = (x: number, y: number) => c.alphaAt(x, y) > 0;
  const roots: Pt[] = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      if (!solid(x, y) || (region && !region.get(x, y))) continue;
      const top = !solid(x, y - 1);
      const side = !solid(x - 1, y) || !solid(x + 1, y);
      if (!top && !side) continue;
      if (hash(x, y, seed >> 2) < density * (top ? 1 : 0.45)) roots.push({ x, y });
    }
  const drawn: [number, number, number][] = [];
  for (const r of roots) {
    const hh = Math.round((3 + hash(r.x, r.y, seed) * 9) * intensity);
    const gap = hash(r.y, r.x, seed + 7) < 0.35 ? 1 + Math.floor(hash(r.x, seed, 3) * 3) : 0;
    const lean = (hash(r.x, seed, r.y) - 0.5) * 0.6 + (r.x < w / 2 ? -0.15 : 0.15);
    const phase = Math.floor(hash(seed, r.x, r.y) * 4);
    for (let k = gap; k < hh + gap; k++) {
      const t = (k - gap) / Math.max(1, hh);
      // Zigzag : la langue serpente d'un pixel tous les deux pixels.
      const zig = ((k + phase) >> 1) % 2 === 0 ? 0 : 1;
      const x = Math.round(r.x + zig + k * lean);
      const y = r.y - 1 - k;
      if (y < 0 || solid(x, y)) continue;
      const col = t < 0.35 ? palette[0] : t < 0.75 ? palette[1] : palette[2];
      drawn.push([x, y, col]);
    }
  }
  for (const [x, y, col] of drawn) {
    c.px(x, y, col);
    e.px(x, y, col);
  }
}

/**
 * Traînée d'arme en croissant. Les angles ne sont pas bornés : un balayage de
 * -0.9 à -3.8 parcourt le dessus du personnage de droite à gauche.
 */
export function crescent(
  c: PixelCanvas,
  e: PixelCanvas,
  center: Pt,
  from: number,
  to: number,
  rIn: number,
  rOut: number,
  cols: { edge: number; core: number; faint: number },
  strength = 1,
): void {
  const sweep = Math.max(-Math.PI * 2, Math.min(Math.PI * 2, to - from));
  if (Math.abs(sweep) < 0.05 || strength <= 0) return;
  const s = Math.sign(sweep);
  for (let y = Math.floor(center.y - rOut); y <= Math.ceil(center.y + rOut); y++)
    for (let x = Math.floor(center.x - rOut); x <= Math.ceil(center.x + rOut); x++) {
      const dx = x + 0.5 - center.x, dy = y + 0.5 - center.y;
      const r = Math.hypot(dx, dy);
      if (r < rIn || r > rOut) continue;
      let rel = Math.atan2(dy, dx) - from;
      rel = ((rel % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (s < 0) rel = rel === 0 ? 0 : Math.PI * 2 - rel;
      if (rel > Math.abs(sweep)) continue;
      const t = rel / Math.abs(sweep); // 1 = position actuelle de la lame
      const radial = (r - rIn) / (rOut - rIn);
      // Le croissant s'amincit vers la queue de la traînée.
      const minRadial = 1 - (0.25 + 0.75 * t);
      if (radial < minRadial) continue;
      const k = t * strength;
      const b = bayer(x, y);
      let col: number | null = null;
      if (radial > 0.86) col = k > 0.12 ? cols.edge : null;
      else if (radial > 0.6) col = k > 0.3 ? cols.core : k + b * 0.3 > 0.3 ? cols.faint : null;
      else col = k + b * 0.5 > 0.7 ? cols.faint : null;
      if (col === null) continue;
      c.px(x, y, col);
      e.px(x, y, col);
    }
}

/** Rotation au plus proche voisin d'une toile autour d'un point. */
export function rotated(src: PixelCanvas, angle: number, cx: number, cy: number): PixelCanvas {
  const out = new PixelCanvas(src.width, src.height);
  const cos = Math.cos(-angle), sin = Math.sin(-angle);
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const sx = Math.floor(cx + dx * cos - dy * sin);
      const sy = Math.floor(cy + dx * sin + dy * cos);
      const a = src.alphaAt(sx, sy);
      if (a) out.px(x, y, src.colorAt(sx, sy), a);
    }
  return out;
}

/** Interpole des poses clés (temps 0..1) en `n` frames avec lissage. */
export function sampleKeys<P extends object>(base: P, keys: { t: number; p: Partial<P> }[], n: number, loop = false): P[] {
  const full = keys.map((k) => ({ t: k.t, p: { ...base, ...k.p } as P }));
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const t = loop ? i / n : n === 1 ? 0 : i / (n - 1);
    let a = full[0], b = full[full.length - 1];
    for (let k = 0; k < full.length - 1; k++) {
      if (t >= full[k].t && t <= full[k + 1].t) {
        a = full[k];
        b = full[k + 1];
        break;
      }
    }
    const span = b.t - a.t || 1;
    let u = Math.max(0, Math.min(1, (t - a.t) / span));
    u = u * u * (3 - 2 * u);
    const p = { ...a.p } as Record<string, unknown>;
    for (const key of Object.keys(b.p)) {
      const va = (a.p as Record<string, unknown>)[key];
      const vb = (b.p as Record<string, unknown>)[key];
      if (typeof va === 'number' && typeof vb === 'number') p[key] = va + (vb - va) * u;
    }
    out.push(p as P);
  }
  return out;
}

export function polar(o: Pt, a: number, len: number): Pt {
  return { x: o.x + Math.cos(a) * len, y: o.y + Math.sin(a) * len };
}

/** IK jambe vue de face : le genou part vers le côté `side` (-1 gauche, 1 droite). */
export function knee(hip: Pt, foot: Pt, l1: number, l2: number, side: number): Pt {
  const dx = foot.x - hip.x, dy = foot.y - hip.y;
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const base = Math.atan2(dy, dx);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * Math.max(0.01, d));
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const k1 = polar(hip, base - a, l1), k2 = polar(hip, base + a, l1);
  return (k1.x - k2.x) * side > 0 ? k1 : k2;
}
