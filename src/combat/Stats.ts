/** Statistiques de combat partagées par le joueur et les ennemis. */
export interface CombatStats {
  maxHp: number;
  hp: number;
  maxMana: number;
  mana: number;
  maxStamina: number;
  stamina: number;
  /** Puissance physique (attaques à l'épée). */
  physAtk: number;
  /** Puissance magique (sorts abyssaux). */
  magAtk: number;
  /** Réduction des dégâts physiques (0..0.9). */
  armor: number;
  /** Réduction des dégâts magiques (0..0.9). */
  magicResist: number;
  critChance: number;
  critMult: number;
}

export function createStats(partial: Partial<CombatStats> & Pick<CombatStats, 'maxHp'>): CombatStats {
  return {
    hp: partial.maxHp,
    maxMana: 0,
    mana: partial.maxMana ?? 0,
    maxStamina: 0,
    stamina: partial.maxStamina ?? 0,
    physAtk: 10,
    magAtk: 10,
    armor: 0,
    magicResist: 0,
    critChance: 0.05,
    critMult: 1.5,
    ...partial,
  };
}
