import type { CombatStats } from './Stats';

export type DamageType = 'physical' | 'magical';

/** Description d'un coup porté (indépendante de la cible). */
export interface HitInfo {
  /** Multiplicateur appliqué à la puissance de l'attaquant. */
  power: number;
  type: DamageType;
  knockback: number;
  /** Durée d'étourdissement infligée (s). */
  stun: number;
  /** Gel de l'image à l'impact (s) — la « sensation » du coup. */
  hitstop: number;
  shake: number;
  /** Brise la garde (bouclier) de la cible. */
  guardBreak?: boolean;
  tag: string;
}

export interface DamageResult {
  amount: number;
  crit: boolean;
  blocked: boolean;
}

/**
 * Calcule les dégâts finaux : puissance × variance, coup critique,
 * puis résistance de la cible selon le type.
 */
export function resolveDamage(
  attacker: CombatStats,
  defender: CombatStats,
  hit: HitInfo,
  blocked: boolean,
  rng: () => number = Math.random,
): DamageResult {
  const base = (hit.type === 'physical' ? attacker.physAtk : attacker.magAtk) * hit.power;
  const variance = 0.9 + rng() * 0.2;
  const crit = !blocked && rng() < attacker.critChance;
  let amount = base * variance * (crit ? attacker.critMult : 1);
  const resist = hit.type === 'physical' ? defender.armor : defender.magicResist;
  amount *= 1 - Math.min(0.9, Math.max(0, resist));
  if (blocked) amount *= 0.15;
  return { amount: Math.max(1, Math.round(amount)), crit, blocked };
}
