import type { PixelCanvas } from '../../pixel/PixelCanvas';
import { polar, type Dir, type Pt } from './chibiKit';

/**
 * Rig 2D des personnages chibi : chaque membre est une chaîne de deux os
 * (bras : épaule → coude → poignet ; jambe : hanche → genou → cheville)
 * résolue par cinématique inverse. Les animations placent les extrémités
 * (main sur la poignée, pied au sol) et les articulations intermédiaires
 * se plient d'elles-mêmes, ce qui garde les pieds plantés quand le bassin
 * descend et fait suivre le coude quand l'épée tourne.
 */

export interface Chain {
  root: Pt;
  mid: Pt;
  end: Pt;
}

/**
 * Cinématique inverse à deux os. `bend` choisit le côté du coude/genou
 * (vecteur de préférence : la solution la plus alignée gagne). La cible
 * hors d'atteinte est ramenée sur le cercle de portée.
 */
export function ik2(root: Pt, target: Pt, l1: number, l2: number, bend: Pt): Chain {
  const dx = target.x - root.x, dy = target.y - root.y;
  const d0 = Math.hypot(dx, dy) || 0.001;
  const d = Math.min(d0, l1 + l2 - 0.01, Math.max(Math.abs(l1 - l2) + 0.01, d0));
  const ux = dx / d0, uy = dy / d0;
  const end = { x: root.x + ux * d, y: root.y + uy * d };
  // Loi des cosinus : projection du coude sur l'axe racine → cible.
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const px = root.x + ux * a, py = root.y + uy * a;
  const m1 = { x: px - uy * h, y: py + ux * h };
  const m2 = { x: px + uy * h, y: py - ux * h };
  const s1 = (m1.x - px) * bend.x + (m1.y - py) * bend.y;
  const s2 = (m2.x - px) * bend.x + (m2.y - py) * bend.y;
  return { root, mid: s1 >= s2 ? m1 : m2, end };
}

export interface Shade {
  lo: number;
  mid: number;
  hi: number;
}

/**
 * Segment de membre épais et ombré : corps moyen, arête éclairée côté
 * lumière (haut-gauche), arête sombre de l'autre côté.
 */
export function segment(c: PixelCanvas, a: Pt, b: Pt, width: number, cols: Shade): void {
  c.line(a.x, a.y, b.x, b.y, cols.mid, width);
  if (width < 2) return;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Normale orientée vers la lumière (haut-gauche).
  let nx = -dy / len, ny = dx / len;
  if (nx * -0.6 + ny * -0.8 < 0) {
    nx = -nx;
    ny = -ny;
  }
  const o = (width - 1) / 2;
  c.line(a.x + nx * o, a.y + ny * o, b.x + nx * o, b.y + ny * o, cols.hi, 1);
  c.line(a.x - nx * o, a.y - ny * o, b.x - nx * o, b.y - ny * o, cols.lo, 1);
}

/** Rotule d'articulation (genouillère, cubitière, rotule osseuse). */
export function joint(c: PixelCanvas, at: Pt, r: number, cols: Shade): void {
  const x = Math.round(at.x), y = Math.round(at.y);
  if (r <= 1) {
    c.rect(x - 1, y - 1, 2, 2, cols.mid);
    c.px(x - 1, y - 1, cols.hi);
    return;
  }
  for (let j = -r; j <= r; j++)
    for (let i = -r; i <= r; i++) {
      const d = i * i + j * j;
      if (d > r * r + 0.5) continue;
      c.px(x + i, y + j, d >= r * r - 1 && i + j > 0 ? cols.lo : i + j < -r / 2 ? cols.hi : cols.mid);
    }
}

// ------------------------------------------------------------- démarche

/** Projection d'un pas « vers l'avant » sur l'écran selon la direction. */
export function forwardVec(dir: Dir): Pt {
  return dir === 'side' ? { x: 1, y: 0 } : dir === 'down' ? { x: 0, y: 0.45 } : { x: 0, y: -0.45 };
}

/**
 * Cycle de marche/course à `n` frames : position avant/arrière et levée de
 * chaque pied, balancement des bras opposé aux jambes, hauteur du bassin
 * (bas au contact, haut au passage). `run` allonge la foulée et ajoute une
 * phase aérienne.
 */
export function gait(n: number, run: boolean): { fa: number; fb: number; la: number; lb: number; swing: number; bob: number; air: number }[] {
  const out = [];
  const stride = run ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const ph = (i / n) * Math.PI * 2;
    const fa = Math.round(Math.cos(ph) * stride);
    const fb = Math.round(Math.cos(ph + Math.PI) * stride);
    // Le pied qui revient vers l'avant se lève (phase de balancier).
    const la = Math.max(0, Math.round(Math.sin(ph) * (run ? 3 : 2)));
    const lb = Math.max(0, Math.round(Math.sin(ph + Math.PI) * (run ? 3 : 2)));
    // Bassin : bas au contact (pieds écartés), haut au passage.
    const spread = Math.abs(Math.cos(ph));
    const bob = Math.round(spread * (run ? 2 : 1));
    const air = run && spread < 0.3 ? 1 : 0;
    out.push({ fa, fb, la, lb, swing: -Math.cos(ph), bob, air });
  }
  return out;
}

/** Point sur l'arc d'une chaîne (pour poser une genouillère ou une cubitière). */
export const along = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export { polar };

/**
 * Raccourci de face / de dos : un genou ou un coude qui plie vers la caméra
 * ne s'écarte presque pas latéralement. On ramène l'articulation vers l'axe
 * racine → extrémité (k = part d'écart conservée).
 */
export function foreshorten(ch: Chain, k: number): Chain {
  const dx = ch.end.x - ch.root.x, dy = ch.end.y - ch.root.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = ((ch.mid.x - ch.root.x) * dx + (ch.mid.y - ch.root.y) * dy) / len2;
  const px = ch.root.x + dx * t, py = ch.root.y + dy * t;
  return { root: ch.root, end: ch.end, mid: { x: px + (ch.mid.x - px) * k, y: py + (ch.mid.y - py) * k } };
}
