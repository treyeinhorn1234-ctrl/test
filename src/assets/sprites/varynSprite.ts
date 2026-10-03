import { PixelCanvas } from '../pixel/PixelCanvas';
import { getImage, type Pixels } from '../images/registry';
import { buildSpriteSheet, type ClipDef, type SpriteSheet } from '../../entities/animation/SpriteSheet';
import { crescent, rotated, sampleKeys } from './frontRig';

/**
 * Varyn, Seigneur des Abysses — sprite dessiné (src/assets/images/varyn.png,
 * 106×121 px natifs, vue isométrique 3/4 tournée vers la droite) animé par un
 * rig de calques découpés automatiquement dans l'image :
 *  - cape gauche et pan droit (ondulation, balancement, envol),
 *  - jambe gauche / jambe droite (pas, appui, agenouillement),
 *  - buste (respiration, inclinaison),
 *  - épée Eclipse extraite puis pivotée autour de la main (attaques),
 * et une rotation globale pour la roulade. Le trou laissé par la lame devant
 * les jambes est comblé avec les pixels voisins.
 */
export interface VarynPose {
  bob: number;
  lean: number;
  lLx: number;
  lLy: number;
  lRx: number;
  lRy: number;
  /** Écrasement des jambes (1 = normal, <1 = genou à terre). */
  legScale: number;
  /** Angle absolu de la lame (écran, y vers le bas). Repos : 0.70. */
  swordA: number;
  sdx: number;
  sdy: number;
  /** 1 : l'épée passe derrière le corps. */
  swordBehind: number;
  sway: number;
  flare: number;
  wave: number;
  smear: number;
  smearFrom: number;
  smearTo: number;
  claw: number;
  clawFrom: number;
  clawTo: number;
  runes: number;
  roll: number;
}

// --- Géométrie de l'image source (pixels natifs) ---------------------------
const REST_A = 0.7008;
const DIR = { x: Math.cos(REST_A), y: Math.sin(REST_A) };
const NRM = { x: -DIR.y, y: DIR.x };
const GUARD = { x: 48, y: 65 };
const HAND = { x: 43, y: 61 };
const WAIST = 84;

// --- Cadre des frames --------------------------------------------------------
const FW = 224;
const FH = 192;
const OX = 60;
const OY = 60;
const G = OY + 115;
const PIVOT_X = OX + 60;

const BASE: VarynPose = {
  bob: 0, lean: 0, lLx: 0, lLy: 0, lRx: 0, lRy: 0, legScale: 1,
  swordA: REST_A, sdx: 0, sdy: 0, swordBehind: 0,
  sway: 0, flare: 0, wave: 0.6,
  smear: 0, smearFrom: 0, smearTo: 0, claw: 0, clawFrom: 0, clawTo: 0,
  runes: 0.5, roll: 0,
};

type Layer = 'none' | 'capeL' | 'capeR' | 'legL' | 'legR' | 'upper' | 'sword';

interface Rig {
  w: number;
  h: number;
  color: Uint32Array;
  layer: Layer[];
  glow: Uint8Array;
}

const pack = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;

/** Découpe l'image en calques et comble le trou laissé par la lame. */
function buildRig(src: Pixels): { rig: Rig; under: Map<number, { c: number; l: Layer }> } {
  const under = new Map<number, { c: number; l: Layer }>();
  const { width: w, height: h, data } = src;
  const color = new Uint32Array(w * h);
  const layer: Layer[] = new Array(w * h).fill('none');
  const glow = new Uint8Array(w * h);
  const alpha = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : data[(y * w + x) * 4 + 3]);

  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      color[i] = pack(r, g, b);
      if (!alpha(x, y)) continue;
      // Reflets violets de l'armure : émissifs.
      if (b > 110 && b > g + 45 && r > g + 10) glow[i] = 1;
      // Position le long de la lame (t, depuis la garde) et écart (p).
      const dx = x + 0.5 - (GUARD.x + 0.5), dy = y + 0.5 - (GUARD.y + 0.5);
      const t = dx * DIR.x + dy * DIR.y;
      const p = dx * NRM.x + dy * NRM.y;
      const bladeW = t < 56 ? 4.3 : 4.3 - ((t - 56) / 12) * 2.4;
      const onBlade = t > 0.5 && t < 69 && Math.abs(p) <= bladeW;
      // Garde : segment perpendiculaire.
      const onGuard = Math.abs(t) <= 2.2 && Math.abs(p) <= 11.5;
      const onPommel = t <= 0.5 && t > -27 && Math.abs(p) <= 2.8;
      if (onBlade || onGuard || onPommel) layer[i] = 'sword';
      else if (x < 39 && y >= 52) layer[i] = 'capeL';
      else if (x >= 79 && y >= 42 && y <= 72) layer[i] = 'capeR';
      else if (x >= 38 && x <= 51 && y >= 88) layer[i] = 'legL';
      else if (x >= 62 && y >= 86) layer[i] = 'legR';
      else layer[i] = 'upper';
    }

  // Absorbe dans l'épée les résidus fins (contour de lame hors du corps).
  for (let pass = 0; pass < 2; pass++) {
    const grab: number[] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!alpha(x, y) || layer[i] === 'sword') continue;
        let touch = false;
        let body = 0;
        for (let j = -1; j <= 1; j++)
          for (let k = -1; k <= 1; k++) {
            if (!j && !k) continue;
            const xx = x + k, yy = y + j;
            if (!alpha(xx, yy)) continue;
            if (layer[yy * w + xx] === 'sword') touch = true;
            else body++;
          }
        if (touch && body <= 3) grab.push(i);
      }
    for (const i of grab) layer[i] = 'sword';
  }

  // Comble le trou laissé par l'épée là où elle passait devant le corps :
  // un pixel est « dans le corps » s'il a du corps des deux côtés de la lame,
  // puis le remplissage se propage depuis les voisins (teinte la plus sombre).
  const inside: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (layer[i] !== 'sword') continue;
      // Encadré par le corps de part et d'autre (en travers ou le long de la lame).
      const enclosed = [NRM, DIR].some((ax) => {
        let sides = 0;
        for (const s of [-1, 1]) {
          for (let k = 1; k <= 12; k++) {
            const sx = Math.round(x + ax.x * k * s), sy = Math.round(y + ax.y * k * s);
            if (!alpha(sx, sy)) break;
            if (layer[sy * w + sx] !== 'sword') {
              sides++;
              break;
            }
          }
        }
        return sides === 2;
      });
      if (enclosed) inside.push(i);
    }
  const filled = new Map<number, { c: number; l: Layer }>();
  const lum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
  let pending = inside;
  for (let pass = 0; pass < 30 && pending.length; pass++) {
    const next: number[] = [];
    const add: [number, { c: number; l: Layer }][] = [];
    for (const i of pending) {
      const x = i % w, y = (i / w) | 0;
      let best: { c: number; l: Layer } | null = null;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + ox, yy = y + oy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        const cand = filled.get(j) ?? (alpha(xx, yy) && layer[j] !== 'sword' ? { c: color[j], l: layer[j] } : null);
        if (cand && (!best || lum(cand.c) < lum(best.c))) best = cand;
      }
      if (best) add.push([i, best]);
      else next.push(i);
    }
    for (const [i, v] of add) filled.set(i, v);
    pending = next;
  }
  // Ferme les petits trous restants (pixels entourés sur 3 côtés au moins).
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < w * h; i++) {
      if (layer[i] !== 'sword' || filled.has(i)) continue;
      const x = i % w, y = (i / w) | 0;
      let best: { c: number; l: Layer } | null = null;
      let n = 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + ox, yy = y + oy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        const cand = filled.get(j) ?? (alpha(xx, yy) && layer[j] !== 'sword' ? { c: color[j], l: layer[j] } : null);
        if (!cand) continue;
        n++;
        if (!best || lum(cand.c) < lum(best.c)) best = cand;
      }
      if (n >= 3 && best) filled.set(i, best);
    }
  }
  for (const [i, v] of filled) under.set(i, v);
  return { rig: { w, h, color, layer, glow }, under };
}

interface Sampler {
  rig: Rig;
  under: Map<number, { c: number; l: Layer }>;
}

function sampleLayer(s: Sampler, x: number, y: number, want: Layer): number | null {
  const { rig } = s;
  if (x < 0 || y < 0 || x >= rig.w || y >= rig.h) return null;
  const i = y * rig.w + x;
  if (want === 'sword') return rig.layer[i] === 'sword' ? rig.color[i] : null;
  if (rig.layer[i] === want) return rig.color[i];
  const u = s.under.get(i);
  if (u && u.l === want) return u.c;
  return null;
}

function glowAt(s: Sampler, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= s.rig.w || y >= s.rig.h) return false;
  return s.rig.glow[y * s.rig.w + x] === 1;
}

function emit(c: PixelCanvas, e: PixelCanvas, s: Sampler, sx: number, sy: number, dx: number, dy: number, col: number, runes: number): void {
  c.px(dx, dy, col);
  if (glowAt(s, sx, sy)) {
    const k = 0.55 + runes * 0.6;
    const r = Math.min(255, ((col >> 16) & 255) * k), g = Math.min(255, ((col >> 8) & 255) * k), b = Math.min(255, (col & 255) * k);
    e.px(dx, dy, (r << 16) | (g << 8) | b);
  }
}

function drawFrame(s: Sampler, p: VarynPose, c: PixelCanvas, e: PixelCanvas, frame: number, count: number): void {
  const { rig } = s;
  const phase = (frame / Math.max(1, count)) * Math.PI * 2;
  const upperDx = (y: number) => Math.round(p.lean * Math.max(0, Math.min(1, (WAIST - y) / 70)));
  const upperDy = (y: number) => Math.round(p.bob * Math.max(0, Math.min(1, (WAIST + 4 - y) / 14)));

  // Cape : décalage horizontal par ligne, croissant vers l'ourlet.
  const capeDx = (y: number, top: number, side: number) => {
    const f = Math.max(0, Math.min(1, (y - top) / (rig.h - top)));
    const wave = Math.sin(y * 0.21 - phase * 1) * p.wave * 2.2 + Math.sin(y * 0.47 - phase * 2) * p.wave * 0.8;
    return Math.round(f * (wave + p.sway * 3 * side - p.flare * 9) + upperDx(Math.min(y, top + 4)) * (1 - f));
  };

  const drawCape = (which: 'capeL' | 'capeR', top: number) => {
    for (let dy = 0; dy < rig.h + 8; dy++) {
      const ys = dy - Math.round(p.bob * Math.max(0, 1 - (dy - top) / 30)) + Math.round(p.flare * 4 * Math.max(0, (dy - top) / 60));
      const off = capeDx(ys, top, which === 'capeL' ? 1 : -0.5);
      for (let dx = -12; dx < rig.w + 12; dx++) {
        const col = sampleLayer(s, dx - off, ys, which);
        if (col !== null) emit(c, e, s, dx - off, ys, OX + dx, OY + dy, col, p.runes);
      }
    }
  };

  const drawLeg = (which: 'legL' | 'legR', ox: number, oy: number) => {
    const foot = 115;
    for (let dy = 0; dy < rig.h; dy++) {
      // Écrasement vertical autour du pied (genou à terre).
      const ys = Math.round(foot - (foot - (dy - oy)) / p.legScale);
      for (let dx = 0; dx < rig.w; dx++) {
        const col = sampleLayer(s, dx - ox, ys, which);
        if (col !== null) emit(c, e, s, dx - ox, ys, OX + dx, OY + dy, col, p.runes);
      }
    }
  };

  const drawSword = () => {
    const delta = p.swordA - REST_A;
    const cos = Math.cos(-delta), sin = Math.sin(-delta);
    const hx = HAND.x + upperDx(HAND.y) + p.sdx;
    const hy = HAND.y + upperDy(HAND.y) + p.sdy;
    const R = 80;
    for (let dy = Math.floor(hy - R); dy <= hy + R; dy++)
      for (let dx = Math.floor(hx - R); dx <= hx + R; dx++) {
        const rx = dx + 0.5 - hx, ry = dy + 0.5 - hy;
        const sx = Math.floor(HAND.x + rx * cos - ry * sin);
        const sy = Math.floor(HAND.y + rx * sin + ry * cos);
        const col = sampleLayer(s, sx, sy, 'sword');
        if (col === null) continue;
        c.px(OX + dx, OY + dy, col);
        // Gouttière runique : légère lueur le long de la lame quand Varyn concentre sa puissance.
        if (p.runes > 0.8) e.px(OX + dx, OY + dy, 0x2a1060);
      }
  };

  drawCape('capeR', 42);
  drawCape('capeL', 52);
  if (p.swordBehind > 0.5) drawSword();
  drawLeg('legL', p.lLx, -p.lLy);
  drawLeg('legR', p.lRx, -p.lRy);
  // Buste (et bas du corps statique) avec inclinaison et respiration.
  for (let dy = -20; dy < rig.h; dy++) {
    const sy = dy - upperDy(dy);
    const shift = upperDx(sy);
    for (let dx = -10; dx < rig.w + 10; dx++) {
      const sx = dx - shift;
      const col = sampleLayer(s, sx, sy, 'upper');
      if (col !== null) emit(c, e, s, sx, sy, OX + dx, OY + dy, col, p.runes);
    }
  }
  if (p.swordBehind <= 0.5) drawSword();
  c.outline(0x05040a);

  const hand = { x: OX + HAND.x + upperDx(HAND.y) + p.sdx, y: OY + HAND.y + upperDy(HAND.y) + p.sdy };
  if (p.smear > 0) {
    crescent(c, e, hand, p.smearFrom, p.smearTo, 22, 80, { edge: 0xf0e4ff, core: 0xb27cff, faint: 0x6a30d0 }, p.smear);
  }
  if (p.claw > 0) {
    const chest = { x: OX + 62 + p.lean, y: OY + 50 };
    for (const r of [24, 30, 36]) crescent(c, e, chest, p.clawFrom, p.clawTo, r - 2, r, { edge: 0xe8d4ff, core: 0xa060ff, faint: 0x6a30d0 }, p.claw);
  }
}

// ------------------------------------------------------------- animations

const K = (keys: { t: number; p: Partial<VarynPose> }[], n: number, loop = false) => sampleKeys(BASE, keys, n, loop);

function walkCycle(n: number, stride: number, lift: number, extra: Partial<VarynPose>): VarynPose[] {
  return Array.from({ length: n }, (_, i) => {
    const ph = (i / n) * Math.PI * 2;
    return {
      ...BASE,
      ...extra,
      lLx: Math.round(Math.cos(ph) * stride),
      lLy: Math.round(Math.max(0, Math.sin(ph)) * lift),
      lRx: Math.round(-Math.cos(ph) * stride),
      lRy: Math.round(Math.max(0, -Math.sin(ph)) * lift),
      bob: Math.round(Math.abs(Math.sin(ph)) * 2),
      swordA: (extra.swordA ?? REST_A) + Math.sin(ph) * 0.04,
    };
  });
}

export const VARYN_CLIPS: ClipDef<VarynPose>[] = [
  {
    name: 'idle', fps: 7, loop: true,
    frames: K([
      { t: 0, p: { wave: 0.5 } },
      { t: 0.5, p: { bob: 2, wave: 0.7, runes: 0.85, swordA: REST_A + 0.02 } },
      { t: 1, p: { wave: 0.5 } },
    ], 8, true),
  },
  { name: 'walk', fps: 11, loop: true, frames: walkCycle(8, 3, 3, { wave: 0.9, sway: 0.4, lean: 1 }), events: { 1: 'step', 5: 'step' } },
  {
    name: 'run', fps: 14, loop: true,
    frames: walkCycle(8, 5, 5, { wave: 1.2, flare: 0.8, lean: 5, swordA: 0.4, sdx: 3 }),
    events: { 1: 'step', 5: 'step' },
  },
  {
    name: 'attack1', fps: 14, loop: false,
    frames: K([
      { t: 0, p: { swordA: -2.1, sdx: -6, sdy: -14, lean: -4, bob: -1, wave: 0.8 } },
      { t: 0.3, p: { swordA: -1.2, sdx: 0, sdy: -12, lean: 0, smear: 1, smearFrom: -2.1, smearTo: -1.2, runes: 1 } },
      { t: 0.5, p: { swordA: 0.1, sdx: 8, sdy: -4, lean: 6, lLx: 3, smear: 1, smearFrom: -1.6, smearTo: 0.1, runes: 1, flare: 0.4 } },
      { t: 0.7, p: { swordA: 0.95, sdx: 8, sdy: 2, lean: 6, lLx: 3, bob: 2, smear: 0.6, smearFrom: -0.5, smearTo: 0.95, flare: 0.5 } },
      { t: 1, p: { swordA: 0.85, sdx: 4, lean: 2, bob: 1 } },
    ], 7),
  },
  {
    name: 'attack2', fps: 14, loop: false,
    frames: K([
      { t: 0, p: { swordA: 1.5, sdx: 2, sdy: 6, lean: 3, bob: 3 } },
      { t: 0.3, p: { swordA: 0.6, sdx: 8, sdy: 2, lean: 5, smear: 1, smearFrom: 1.5, smearTo: 0.6, runes: 1 } },
      { t: 0.55, p: { swordA: -0.7, sdx: 8, sdy: -8, lean: 4, bob: -2, smear: 1, smearFrom: 1.0, smearTo: -0.7, runes: 1, flare: 0.4 } },
      { t: 0.75, p: { swordA: -1.4, sdx: 4, sdy: -14, lean: 1, smear: 0.6, smearFrom: 0.0, smearTo: -1.4 } },
      { t: 1, p: { swordA: -1.6, sdx: 0, sdy: -14, lean: 0 } },
    ], 7),
  },
  {
    name: 'attack3', fps: 14, loop: false,
    frames: K([
      { t: 0, p: { swordA: -1.75, sdx: 0, sdy: -16, bob: -3, runes: 1, flare: 0.3 } },
      { t: 0.3, p: { swordA: -1.95, sdx: -3, sdy: -20, bob: -5, runes: 1, flare: 0.5 } },
      { t: 0.45, p: { swordA: -0.8, sdx: 4, sdy: -12, bob: -1, lean: 3, smear: 1, smearFrom: -1.95, smearTo: -0.8, runes: 1 } },
      { t: 0.6, p: { swordA: 1.05, sdx: 10, sdy: 4, bob: 6, lean: 7, lLx: 4, smear: 1, smearFrom: -1.3, smearTo: 1.05, runes: 1, flare: 0.6 } },
      { t: 0.82, p: { swordA: 1.1, sdx: 10, sdy: 5, bob: 6, lean: 7, lLx: 4, runes: 0.9, flare: 0.3 } },
      { t: 1, p: { swordA: 0.8, sdx: 3, bob: 1, lean: 2 } },
    ], 8),
  },
  {
    name: 'heavy', fps: 12, loop: false,
    frames: K([
      { t: 0, p: { swordA: 2.5, sdx: -10, sdy: 4, lean: -5, bob: 3, runes: 1, swordBehind: 1, sway: -0.5 } },
      { t: 0.3, p: { swordA: 2.75, sdx: -12, sdy: 5, lean: -6, bob: 4, runes: 1, swordBehind: 1, flare: 0.3 } },
      { t: 0.45, p: { swordA: 1.2, sdx: 0, sdy: 4, lean: 2, bob: 2, smear: 1, smearFrom: 2.75, smearTo: 1.2, runes: 1 } },
      { t: 0.55, p: { swordA: -0.3, sdx: 8, sdy: -2, lean: 6, smear: 1, smearFrom: 2.4, smearTo: -0.3, runes: 1, flare: 0.6 } },
      { t: 0.65, p: { swordA: -1.9, sdx: 4, sdy: -10, lean: 4, smear: 1, smearFrom: 1.0, smearTo: -1.9, runes: 1, flare: 0.8 } },
      { t: 0.75, p: { swordA: -3.4, sdx: -6, sdy: -8, lean: 0, smear: 1, smearFrom: -0.5, smearTo: -3.4, runes: 1, flare: 0.8 } },
      { t: 0.87, p: { swordA: -4.9, sdx: -6, sdy: 2, lean: -1, bob: 3, smear: 0.6, smearFrom: -2.2, smearTo: -4.9, flare: 0.5 } },
      { t: 1, p: { swordA: REST_A - Math.PI * 2, sdx: 0, bob: 1 } },
    ], 9),
  },
  {
    name: 'dodge', fps: 14, loop: false,
    frames: K([
      { t: 0, p: { lean: 5, bob: 3, flare: 0.7, wave: 1.2, swordA: 0.35, sdx: 2, lRx: 3, lLx: -3 } },
      { t: 0.45, p: { lean: 9, bob: 5, flare: 1.2, wave: 1.4, swordA: 0.25, sdx: 4, lRx: 5, lLx: -5, lLy: 3, runes: 1 } },
      { t: 1, p: { lean: 3, bob: 2, flare: 0.4, wave: 0.9, swordA: 0.5 } },
    ], 6),
  },
  {
    name: 'roll', fps: 16, loop: false,
    frames: [
      { ...BASE, lean: 5, bob: 4, flare: 0.5, swordA: 0.35, swordBehind: 1 },
      ...[1, 2, 3, 4, 5, 6].map((i) => ({ ...BASE, lean: 3, bob: 2, flare: 0.9, wave: 1.2, swordA: -0.5, sdx: -6, sdy: -4, swordBehind: 1, roll: (i / 6) * Math.PI * 2 - 0.0001 })),
      { ...BASE, lean: 3, bob: 3, flare: 0.4, swordA: 0.5 },
    ],
  },
  {
    name: 'hurt', fps: 10, loop: false,
    frames: K([
      { t: 0, p: { lean: -6, bob: 1, swordA: 1.0, sdx: -3, sway: -0.6, runes: 0.2 } },
      { t: 0.5, p: { lean: -4, bob: 2, swordA: 0.9 } },
      { t: 1, p: { lean: -1, bob: 1 } },
    ], 3),
  },
  {
    name: 'death', fps: 9, loop: false,
    frames: K([
      { t: 0, p: { lean: -6, swordA: 1.0, runes: 0.3 } },
      { t: 0.3, p: { lean: 2, bob: 4, swordA: 1.3, sdx: 4, sdy: 8, runes: 0.2 } },
      { t: 0.55, p: { lean: 5, bob: 7, swordA: 1.5, sdx: 8, sdy: 16, runes: 0.1, wave: 0.3 } },
      { t: 1, p: { lean: 7, bob: 8, swordA: 1.57, sdx: 9, sdy: 18, runes: 0, wave: 0.15, sway: -0.3 } },
    ], 9),
  },
  {
    name: 'cast', fps: 14, loop: false,
    frames: K([
      { t: 0, p: { lean: -3, bob: 1, swordA: 1.3, sdx: -4, runes: 1 } },
      { t: 0.35, p: { lean: 3, swordA: 1.3, claw: 1, clawFrom: -2.2, clawTo: -0.9, runes: 1, flare: 0.3 } },
      { t: 0.55, p: { lean: 7, lLx: 3, swordA: 1.35, claw: 1, clawFrom: -1.9, clawTo: 0.5, runes: 1, flare: 0.5 } },
      { t: 0.75, p: { lean: 6, lLx: 3, swordA: 1.3, claw: 0.5, clawFrom: -0.8, clawTo: 0.9, flare: 0.3 } },
      { t: 1, p: { lean: 1, swordA: 0.9 } },
    ], 7),
  },
  {
    name: 'interact', fps: 8, loop: false,
    frames: K([
      { t: 0, p: { lean: 1, bob: 1 } },
      { t: 1, p: { lean: 4, bob: 2, runes: 1 } },
    ], 4),
  },
  {
    name: 'victory', fps: 7, loop: true,
    frames: K([
      { t: 0, p: { swordA: -1.57, sdx: -2, sdy: -22, runes: 1, flare: 0.5, wave: 1 } },
      { t: 0.5, p: { swordA: -1.57, sdx: -2, sdy: -24, runes: 1, flare: 0.7, wave: 1.2, bob: -1 } },
      { t: 1, p: { swordA: -1.57, sdx: -2, sdy: -22, runes: 1, flare: 0.5, wave: 1 } },
    ], 6, true),
  },
];

let cached: SpriteSheet | null = null;

export function getVarynSheet(): SpriteSheet {
  if (!cached) {
    const { rig, under } = buildRig(getImage('varyn'));
    const sampler: Sampler = { rig, under };
    const counts = new Map(VARYN_CLIPS.map((c) => [c, c.frames.length]));
    cached = buildSpriteSheet<VarynPose>({
      frameW: FW,
      frameH: FH,
      pivotX: PIVOT_X,
      pivotY: G,
      pixelsPerUnit: 32,
      outline: null,
      facesLeft: false,
      clips: VARYN_CLIPS,
      draw: (pose, c, e, frame, row) => {
        const clip = VARYN_CLIPS[row];
        if (pose.roll !== 0) {
          const tc = new PixelCanvas(FW, FH);
          const te = new PixelCanvas(FW, FH);
          drawFrame(sampler, pose, tc, te, frame, counts.get(clip) ?? 8);
          const cx = OX + 58, cy = OY + 78;
          c.blit(rotated(tc, pose.roll, cx, cy), 0, 0);
          e.blit(rotated(te, pose.roll, cx, cy), 0, 0);
        } else {
          drawFrame(sampler, pose, c, e, frame, counts.get(clip) ?? 8);
        }
      },
    });
  }
  return cached;
}

/** Image native pour le portrait du HUD (heaume + couronne). */
export const VARYN_PORTRAIT_RECT = { x: OX + 44, y: OY + 2, w: 40, h: 40 };

/** Débogage : calques du rig en couleurs (?debug=rig). */
export function debugRigCanvas(): HTMLCanvasElement {
  const { rig, under } = buildRig(getImage('varyn'));
  const c = new PixelCanvas(rig.w * 2 + 4, rig.h);
  const tint: Record<Layer, number> = { none: 0, capeL: 0x3060ff, capeR: 0x30c0ff, legL: 0x30ff60, legR: 0x90ff30, upper: 0xffffff, sword: 0xff3030 };
  for (let y = 0; y < rig.h; y++)
    for (let x = 0; x < rig.w; x++) {
      const i = y * rig.w + x;
      const l = rig.layer[i];
      if (l !== 'none') c.px(x, y, tint[l]);
      const u = under.get(i);
      if (l === 'sword' && !u) c.px(rig.w + 4 + x, y, 0xff00ff);
      else if (u) c.px(rig.w + 4 + x, y, u.c);
      else if (l !== 'none') c.px(rig.w + 4 + x, y, rig.color[i]);
    }
  return c.toCanvas();
}
