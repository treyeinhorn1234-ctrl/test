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
export function swoosh(c: PixelCanvas, e: PixelCanvas, center: Pt, from: number, to: number, rIn: number, rOut: number, cols: [number, number, number]): void {
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
