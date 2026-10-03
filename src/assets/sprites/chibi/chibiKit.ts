import { PixelCanvas } from '../../pixel/PixelCanvas';

/**
 * Outils communs aux sprites chibi (style RPG Maker : grosse tête,
 * 4 directions). Tout est dessiné au pixel près, sans lissage.
 */
export type Dir = 'down' | 'up' | 'side';

/** Frame 64×64 : personnage d'environ 48 px, marge pour les traînées d'arme. */
export const FW = 64;
export const FH = 64;
/** Pieds du personnage dans la frame. */
export const FOOT_Y = 53;
export const CX = 32;

export interface Pt {
  x: number;
  y: number;
}

/** Angle « vers l'avant » de chaque direction (écran, y vers le bas). Le côté regarde à droite. */
export function facingAngle(dir: Dir): number {
  return dir === 'down' ? Math.PI / 2 : dir === 'up' ? -Math.PI / 2 : 0;
}

export function polar(o: Pt, a: number, len: number): Pt {
  return { x: o.x + Math.cos(a) * len, y: o.y + Math.sin(a) * len };
}

/** Ellipse ombrée : éclairage venant d'en haut à gauche, liseré sombre en bas. */
export function shadedEllipse(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, cols: { lo: number; mid: number; hi: number }): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const light = -dx * 0.5 - dy * 0.8;
      c.px(x, y, d > 0.72 && light < 0.1 ? cols.lo : light > 0.35 ? cols.hi : cols.mid);
    }
}

/** Rectangle ombré (arête haute claire, arête basse sombre). */
export function shadedRect(c: PixelCanvas, x: number, y: number, w: number, h: number, cols: { lo: number; mid: number; hi: number }): void {
  c.rect(x, y, w, h, cols.mid);
  c.rect(x, y, w, 1, cols.hi);
  c.rect(x, y + h - 1, w, 1, cols.lo);
  c.rect(x + w - 1, y, 1, h, cols.lo);
}

/** Lame d'épée : fil clair, gouttière sombre, garde et pommeau. */
export function blade(
  c: PixelCanvas,
  e: PixelCanvas,
  hand: Pt,
  a: number,
  len: number,
  cols: { edge: number; mid: number; dark: number; guard: number; grip: number; rune?: number },
  width = 3,
): void {
  const perp = { x: -Math.sin(a), y: Math.cos(a) };
  const tip = polar(hand, a, len);
  const b0 = polar(hand, a, 2);
  c.line(b0.x, b0.y, tip.x, tip.y, cols.mid, width);
  c.line(b0.x - perp.x, b0.y - perp.y, tip.x, tip.y, cols.edge, 1);
  if (width >= 3) c.line(b0.x + perp.x, b0.y + perp.y, polar(hand, a, len - 2).x + perp.x, polar(hand, a, len - 2).y + perp.y, cols.dark, 1);
  if (cols.rune !== undefined) {
    for (let d = 4; d < len - 3; d += 4) {
      const r = polar(hand, a, d);
      c.px(r.x, r.y, cols.rune);
      e.px(r.x, r.y, cols.rune);
    }
  }
  const g = polar(hand, a, 1);
  c.line(g.x - perp.x * 3, g.y - perp.y * 3, g.x + perp.x * 3, g.y + perp.y * 3, cols.guard, 1);
  const pm = polar(hand, a + Math.PI, 3);
  c.line(hand.x, hand.y, pm.x, pm.y, cols.grip, 1);
}

/** Traînée de taille : arc entre deux angles autour d'un point, plus vif côté lame. */
export function swoosh(c: PixelCanvas, e: PixelCanvas, center: Pt, from: number, to: number, rIn: number, rOut: number, cols: [number, number, number], fade = 0): void {
  const sweep = to - from;
  const s = Math.sign(sweep) || 1;
  for (let y = Math.floor(center.y - rOut); y <= Math.ceil(center.y + rOut); y++)
    for (let x = Math.floor(center.x - rOut); x <= Math.ceil(center.x + rOut); x++) {
      const dx = x + 0.5 - center.x, dy = y + 0.5 - center.y;
      const r = Math.hypot(dx, dy);
      if (r < rIn || r > rOut) continue;
      let rel = (Math.atan2(dy, dx) - from) * s;
      rel = ((rel % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (rel > Math.abs(sweep)) continue;
      const t = rel / Math.abs(sweep);
      const radial = (r - rIn) / (rOut - rIn);
      if (radial < 1 - (0.3 + 0.7 * t)) continue;
      const col = radial > 0.8 ? cols[2] : t > 0.5 ? cols[1] : cols[0];
      if (t < 0.25 && (x + y) % 2) continue;
      // Fondu : la traînée se dissout de la queue vers la lame.
      if (fade > 0 && bayer(x, y) < fade * (1.4 - t)) continue;
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

/** Dessine `draw` puis fait pivoter le résultat (roulade, chute). */
export function withSpin(c: PixelCanvas, e: PixelCanvas, spin: number, cx: number, cy: number, draw: (c: PixelCanvas, e: PixelCanvas) => void): void {
  if (spin === 0) {
    draw(c, e);
    return;
  }
  const tc = new PixelCanvas(c.width, c.height);
  const te = new PixelCanvas(c.width, c.height);
  draw(tc, te);
  c.blit(rotated(tc, spin, cx, cy), 0, 0);
  e.blit(rotated(te, spin, cx, cy), 0, 0);
}

// ------------------------------------------------------------- poses clés

export type Ease = 'linear' | 'in' | 'out' | 'smooth' | 'snap';

export interface Key<P> {
  /** Instant normalisé 0..1 dans le clip. */
  t: number;
  p: Partial<P>;
  /** Courbe d'arrivée sur cette clé depuis la précédente. */
  ease?: Ease;
}

function easeFn(e: Ease, t: number): number {
  switch (e) {
    case 'in': return t * t;
    case 'out': return 1 - (1 - t) * (1 - t);
    case 'smooth': return t * t * (3 - 2 * t);
    case 'snap': return t < 0.5 ? 0 : 1;
    default: return t;
  }
}

/**
 * Échantillonne `n` frames entre des poses clés. Les champs numériques sont
 * interpolés (avec la courbe de la clé d'arrivée), les autres sont tenus
 * jusqu'à la clé suivante. Chaque clé hérite de la précédente.
 */
export function sampleKeys<P extends object>(base: P, keys: Key<P>[], n: number): P[] {
  const full: { t: number; p: P; ease: Ease }[] = [];
  let prev = base;
  for (const k of keys) {
    const p = { ...prev, ...k.p } as P;
    full.push({ t: k.t, p, ease: k.ease ?? 'smooth' });
    prev = p;
  }
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    let k = 0;
    while (k < full.length - 2 && t > full[k + 1].t) k++;
    const a = full[k], b = full[Math.min(k + 1, full.length - 1)];
    const span = b.t - a.t;
    const u = span <= 0 ? 1 : Math.max(0, Math.min(1, (t - a.t) / span));
    const e = easeFn(b.ease, u);
    const o = { ...a.p } as Record<string, unknown>;
    for (const key of Object.keys(b.p)) {
      const va = (a.p as Record<string, unknown>)[key];
      const vb = (b.p as Record<string, unknown>)[key];
      if (typeof va === 'number' && typeof vb === 'number') o[key] = va + (vb - va) * e;
      else o[key] = u >= 1 ? vb : va;
    }
    out.push(o as P);
  }
  return out;
}

/** Champs nécessaires au calcul automatique des traînées d'arme. */
export interface TrailPose {
  swordA: number;
  /** Intensité de la traînée (0 : aucune). */
  trail: number;
  smear: number;
  smearFrom: number;
  smearTo: number;
  smearFade: number;
  ghostA: number[];
}

/**
 * Traînées automatiques : la traînée de chaque frame couvre l'arc réellement
 * balayé par la lame depuis la frame précédente, avec des images rémanentes
 * de la lame aux positions intermédiaires.
 */
export function addTrails<P extends TrailPose>(frames: P[]): P[] {
  return frames.map((f, i) => {
    if (i === 0 || f.trail <= 0) return f;
    const prev = frames[i - 1];
    const d = f.swordA - prev.swordA;
    if (Math.abs(d) < 0.35) return f;
    const ghosts = Math.abs(d) > 0.9 ? [prev.swordA + d * 0.33, prev.swordA + d * 0.66] : [prev.swordA + d * 0.5];
    return { ...f, smear: f.trail, smearFrom: prev.swordA, smearTo: f.swordA, smearFade: 1 - f.trail, ghostA: ghosts };
  });
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Seuil de tramage ordonné 4×4 (0..1). */
export function bayer(x: number, y: number): number {
  return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/** Image rémanente de lame : silhouette translucide, légèrement émissive. */
export function ghostBlade(c: PixelCanvas, e: PixelCanvas, hand: Pt, a: number, len: number, col: number, alpha = 130): void {
  const tip = polar(hand, a, len);
  const b0 = polar(hand, a, 3);
  c.line(b0.x, b0.y, tip.x, tip.y, col, 2, alpha);
  e.line(b0.x, b0.y, tip.x, tip.y, col, 1, alpha >> 1);
}

/** Éclat en étoile (pointe de lame, impact). */
export function sparkle(c: PixelCanvas, e: PixelCanvas, at: Pt, size: number, core: number, rim: number): void {
  const x = Math.round(at.x), y = Math.round(at.y);
  for (let k = 1; k <= size; k++) {
    const col = k === size ? rim : core;
    for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) {
      c.px(x + dx, y + dy, col);
      e.px(x + dx, y + dy, col);
    }
  }
  if (size >= 3) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    c.px(x + dx, y + dy, rim);
    e.px(x + dx, y + dy, rim);
  }
  c.px(x, y, 0xffffff);
  e.px(x, y, 0xffffff);
}

/** Impact au sol dans la frame : poussière, éclats de pierre et fissure lumineuse. */
export function groundImpact(c: PixelCanvas, e: PixelCanvas, at: Pt, k: number, glow: number, frame: number): void {
  if (k <= 0) return;
  const r = 4 + k * 7;
  // Fissure.
  for (const a of [0.2, 1.4, 2.6, 3.5, 4.6, 5.6]) {
    let p = { x: at.x, y: at.y };
    const len = r * (0.6 + ((a * 7) % 1) * 0.5);
    for (let s = 0; s < len; s += 2) {
      const q = polar(p, a + Math.sin(s + a) * 0.5, 2);
      const qq = { x: q.x, y: at.y + (q.y - at.y) * 0.5 };
      c.line(p.x, p.y, qq.x, qq.y, 0x120a18);
      if (s < len * k) e.px(qq.x, qq.y, glow);
      p = qq;
    }
  }
  // Poussière en anneau aplati.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + frame;
    const d = r * (0.8 + (i % 3) * 0.15);
    const x = at.x + Math.cos(a) * d;
    const y = at.y + Math.sin(a) * d * 0.45;
    if (bayer(Math.round(x), Math.round(y)) > k + 0.2) continue;
    c.disc(x, y - 1, 1.5 + (i % 2), i % 3 ? 0x6e6478 : 0x8c8296, 200);
  }
  // Éclats projetés.
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * (0.15 + i * 0.17);
    const p = polar(at, a, r * 0.9 * (0.6 + k * 0.6));
    c.px(p.x, p.y, 0x9a90a4);
  }
}
