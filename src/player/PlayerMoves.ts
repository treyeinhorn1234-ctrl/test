import type { HitInfo } from '../combat/Damage';

/**
 * Coups de Varyn. Le **sprite** fait foi pour le temps et la portée :
 * `tools/build_knight.py` mesure sur chaque frame l'allonge du membre ou de la
 * lame et en déduit les fenêtres actives (`knight.json` → `moves`). Ici ne
 * figurent que les données de conception : puissance, recul, ouverture de
 * l'arc, élan, coûts et vitesse de lecture.
 *
 * - Une hitbox est créée à l'entrée de chaque fenêtre active, avec la portée
 *   mesurée sur ces frames ; plusieurs fenêtres = plusieurs impacts.
 * - L'enchaînement devient possible après la dernière frame active.
 */
export type MoveId = 'attack1' | 'attack2' | 'attack3' | 'leap' | 'heavy' | 'kick' | 'uppercut' | 'claw';

export interface MoveDef {
  id: MoveId;
  /** Animation du sprite (ses frames actives pilotent la hitbox). */
  anim: string;
  /** Vitesse de lecture (× fps du clip). */
  speed: number;
  /** Demi-ouverture de l'arc de la hitbox (radians). */
  arc: number;
  /** Élan vers l'avant jusqu'à la fin de la dernière fenêtre active (unités/s). */
  lunge: number;
  stamina: number;
  mana?: number;
  /** Un coup par fenêtre active (le dernier est réutilisé s'il en manque). */
  hits: HitInfo[];
  sfx: string;
  /** Frames supplémentaires après la dernière fenêtre avant de pouvoir enchaîner. */
  cancelDelay: number;
  /** Ne peut pas être interrompu une fois la première fenêtre atteinte. */
  superArmor?: boolean;
  /** Onde de choc au sol à l'impact (rayon). */
  shockwave?: number;
  /** Rayon de l'effet visuel de taille (sinon : portée mesurée). */
  vfx: 'slash' | 'flurry' | 'slam' | 'spin' | 'kick' | 'uppercut' | 'claw';
}

const DEG = Math.PI / 180;

const slash = (power: number, extra: Partial<HitInfo> = {}): HitInfo => ({
  power, type: 'physical', knockback: 4, stun: 0.3, hitstop: 0.05, shake: 0.18, tag: 'slash', ...extra,
});

export const MOVES: Record<MoveId, MoveDef> = {
  attack1: {
    id: 'attack1', anim: 'attack1', speed: 1.5, arc: 70 * DEG, lunge: 4, stamina: 7, sfx: 'swing', cancelDelay: 1, vfx: 'slash',
    hits: [slash(1)],
  },
  attack2: {
    id: 'attack2', anim: 'attack2', speed: 1.5, arc: 80 * DEG, lunge: 4, stamina: 7, sfx: 'swing', cancelDelay: 1, vfx: 'slash',
    hits: [slash(1.15, { knockback: 4.5, shake: 0.2 })],
  },
  // Final en rafale : trois impacts mesurés sur le sprite, le dernier projette.
  attack3: {
    id: 'attack3', anim: 'attack3', speed: 1.45, arc: 75 * DEG, lunge: 3.5, stamina: 11, sfx: 'swing', cancelDelay: 2, vfx: 'flurry',
    hits: [slash(0.7, { knockback: 1.5, stun: 0.35 }), slash(0.7, { knockback: 1.5, stun: 0.35 }), slash(1.5, { knockback: 9, stun: 0.6, hitstop: 0.09, shake: 0.4, tag: 'slam' })],
  },
  // En courant : bond, impact à la réception (onde de choc).
  leap: {
    id: 'leap', anim: 'leap', speed: 1.4, arc: 100 * DEG, lunge: 7, stamina: 14, sfx: 'swingHeavy', cancelDelay: 2, vfx: 'slam', shockwave: 2.6,
    hits: [{ power: 1.9, type: 'physical', knockback: 10, stun: 0.7, hitstop: 0.09, shake: 0.5, tag: 'slam' }],
  },
  // Tour complet, deux balayages ; super-armure.
  heavy: {
    id: 'heavy', anim: 'heavy', speed: 1.15, arc: Math.PI, lunge: 2.5, stamina: 26, sfx: 'swingHeavy', cancelDelay: 1, vfx: 'spin', superArmor: true, shockwave: 3,
    hits: [
      { power: 1.4, type: 'physical', knockback: 5, stun: 0.6, hitstop: 0.07, shake: 0.35, guardBreak: true, tag: 'heavy' },
      { power: 2.2, type: 'physical', knockback: 13, stun: 1.0, hitstop: 0.11, shake: 0.6, guardBreak: true, tag: 'heavy' },
    ],
  },
  // Bifurcation du combo (clic droit après le coup 1 ou 2) : brise la garde.
  kick: {
    id: 'kick', anim: 'kick', speed: 1.5, arc: 55 * DEG, lunge: 5, stamina: 12, sfx: 'swingHeavy', cancelDelay: 1, vfx: 'kick',
    hits: [{ power: 1.3, type: 'physical', knockback: 12, stun: 0.9, hitstop: 0.08, shake: 0.4, guardBreak: true, tag: 'kick' }],
  },
  // En sortie de roulade ou après une parade : uppercut qui projette.
  uppercut: {
    id: 'uppercut', anim: 'uppercut', speed: 1.5, arc: 70 * DEG, lunge: 6, stamina: 10, sfx: 'swingHeavy', cancelDelay: 1, vfx: 'uppercut',
    hits: [{ power: 1.8, type: 'physical', knockback: 11, stun: 0.9, hitstop: 0.1, shake: 0.45, tag: 'uppercut' }],
  },
  // Griffe abyssale : la main projette trois entailles (mana).
  claw: {
    id: 'claw', anim: 'cast', speed: 1.6, arc: 55 * DEG, lunge: 2, stamina: 0, mana: 18, sfx: 'claw', cancelDelay: -3, vfx: 'claw',
    hits: [{ power: 1.7, type: 'magical', knockback: 7, stun: 0.5, hitstop: 0.07, shake: 0.3, guardBreak: true, tag: 'claw' }],
  },
};

export const COMBO: MoveId[] = ['attack1', 'attack2', 'attack3'];
export const CLAW_COOLDOWN = 2.5;
/** Portée de la griffe au-delà de la main (la magie prolonge le geste). */
export const CLAW_EXTRA_RANGE = 1.6;
