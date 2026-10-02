import type { HitInfo } from '../combat/Damage';

/**
 * Données des attaques de Varyn. Les timings (secondes) définissent la
 * fenêtre active de la hitbox ; l'animation est étirée sur `duration`.
 */
export interface AttackDef {
  anim: string;
  duration: number;
  activeStart: number;
  activeEnd: number;
  /** Après ce moment, une nouvelle action peut interrompre la récupération. */
  cancelAt: number;
  range: number;
  arc: number;
  /** Vitesse d'élan vers l'avant pendant l'attaque. */
  lunge: number;
  stamina: number;
  mana?: number;
  hit: HitInfo;
  shockwave?: number;
  sfx: string;
}

const DEG = Math.PI / 180;

export const COMBO: AttackDef[] = [
  {
    anim: 'attack1', duration: 0.42, activeStart: 0.1, activeEnd: 0.2, cancelAt: 0.24,
    range: 2.7, arc: 75 * DEG, lunge: 4.5, stamina: 7, sfx: 'swing',
    hit: { power: 1, type: 'physical', knockback: 4, stun: 0.3, hitstop: 0.05, shake: 0.18, tag: 'slash' },
  },
  {
    anim: 'attack2', duration: 0.42, activeStart: 0.09, activeEnd: 0.2, cancelAt: 0.24,
    range: 2.7, arc: 80 * DEG, lunge: 4.5, stamina: 7, sfx: 'swing',
    hit: { power: 1.15, type: 'physical', knockback: 4.5, stun: 0.3, hitstop: 0.05, shake: 0.2, tag: 'slash' },
  },
  {
    anim: 'attack3', duration: 0.62, activeStart: 0.2, activeEnd: 0.3, cancelAt: 0.42,
    range: 3.1, arc: 70 * DEG, lunge: 6, stamina: 10, shockwave: 2.4, sfx: 'swingHeavy',
    hit: { power: 1.9, type: 'physical', knockback: 10, stun: 0.6, hitstop: 0.09, shake: 0.45, tag: 'slam' },
  },
];

export const HEAVY: AttackDef = {
  anim: 'heavy', duration: 0.9, activeStart: 0.4, activeEnd: 0.52, cancelAt: 0.66,
  range: 3.4, arc: 115 * DEG, lunge: 7, stamina: 26, shockwave: 3.2, sfx: 'swingHeavy',
  hit: { power: 2.7, type: 'physical', knockback: 13, stun: 1.0, hitstop: 0.11, shake: 0.6, guardBreak: true, tag: 'heavy' },
};

/** Griffe abyssale : première capacité démoniaque (sort principal). */
export const ABYSSAL_CLAW: AttackDef = {
  anim: 'cast', duration: 0.45, activeStart: 0.1, activeEnd: 0.2, cancelAt: 0.28,
  range: 3.6, arc: 55 * DEG, lunge: 3, stamina: 0, mana: 18, sfx: 'claw',
  hit: { power: 1.7, type: 'magical', knockback: 7, stun: 0.5, hitstop: 0.07, shake: 0.3, guardBreak: true, tag: 'claw' },
};

export const CLAW_COOLDOWN = 2.5;
