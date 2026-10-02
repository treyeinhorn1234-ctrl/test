/**
 * Progression de Varyn : expérience et niveaux. Chaque niveau renforce
 * l'enveloppe (PV, mana) et la puissance. L'arbre de compétences et la
 * répartition des statistiques arrivent à l'Étape 5.
 */
export interface LevelUpGains {
  maxHp: number;
  maxMana: number;
  physAtk: number;
  magAtk: number;
}

export class Experience {
  level = 1;
  xp = 0;

  /** XP nécessaire pour passer au niveau suivant. */
  get toNext(): number {
    return Math.round(50 * Math.pow(this.level, 1.45));
  }

  get progress(): number {
    return this.xp / this.toNext;
  }

  /** Ajoute de l'XP ; retourne le nombre de niveaux gagnés. */
  add(amount: number): number {
    this.xp += amount;
    let gained = 0;
    while (this.xp >= this.toNext) {
      this.xp -= this.toNext;
      this.level++;
      gained++;
    }
    return gained;
  }

  static gains(): LevelUpGains {
    return { maxHp: 14, maxMana: 6, physAtk: 2, magAtk: 2 };
  }

  reset(): void {
    this.level = 1;
    this.xp = 0;
  }
}
