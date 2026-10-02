import type { PixelCanvas } from '../pixel/PixelCanvas';

/** Outils de dessin partagés par les générateurs de personnages. */

export interface Vec2 {
  x: number;
  y: number;
}

export function polar(origin: Vec2, angle: number, len: number): Vec2 {
  return { x: origin.x + Math.cos(angle) * len, y: origin.y + Math.sin(angle) * len };
}

/**
 * IK à deux segments (hanche → genou → pied). Le genou plie vers l'avant
 * (+x, le personnage regarde vers la droite).
 */
export function solveLeg(hip: Vec2, foot: Vec2, thigh: number, shin: number): Vec2 {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  const d = Math.min(Math.hypot(dx, dy), thigh + shin - 0.001);
  const base = Math.atan2(dy, dx);
  const cosA = (thigh * thigh + d * d - shin * shin) / (2 * thigh * d);
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)));
  // On choisit la solution dont le genou est le plus en avant.
  const k1 = polar(hip, base - a, thigh);
  const k2 = polar(hip, base + a, thigh);
  return k1.x > k2.x ? k1 : k2;
}

/**
 * Traînée d'arme (« smear ») : secteur d'anneau entre deux angles, plus
 * lumineux sur le bord extérieur. Dessinée sur la couleur ET l'émission.
 */
export function drawSmear(
  c: PixelCanvas,
  e: PixelCanvas,
  center: Vec2,
  from: number,
  to: number,
  rInner: number,
  rOuter: number,
  colors: { edge: number; core: number; faint: number },
  strength = 1,
): void {
  const a0 = Math.min(from, to);
  const a1 = Math.max(from, to);
  const newest = to;
  for (let y = Math.floor(center.y - rOuter); y <= Math.ceil(center.y + rOuter); y++)
    for (let x = Math.floor(center.x - rOuter); x <= Math.ceil(center.x + rOuter); x++) {
      const dx = x + 0.5 - center.x;
      const dy = y + 0.5 - center.y;
      const r = Math.hypot(dx, dy);
      if (r < rInner || r > rOuter) continue;
      const a = Math.atan2(dy, dx);
      if (a < a0 || a > a1) continue;
      // t = 1 près de la position actuelle de la lame, 0 à l'arrière de la traînée.
      const t = 1 - Math.abs(a - newest) / Math.max(0.001, a1 - a0);
      const radial = (r - rInner) / (rOuter - rInner);
      const k = t * strength;
      if (radial > 0.86 && k > 0.15) {
        c.px(x, y, colors.edge);
        e.px(x, y, colors.edge);
      } else if (radial > 0.55 && k > 0.35) {
        c.px(x, y, colors.core);
        e.px(x, y, colors.core);
      } else if (k > 0.6 && radial > 0.3) {
        c.px(x, y, colors.faint, 200);
        e.px(x, y, colors.faint, 160);
      }
    }
}
