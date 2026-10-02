import type { CombatStats } from '../combat/Stats';
import type { GameContext } from '../core/GameContext';
import { Entity } from '../entities/Entity';
import type { SpriteActor } from '../entities/SpriteActor';

/**
 * Base commune des ennemis : nom affiché, récompense d'XP, barre de vie,
 * séquence de mort (animation → dissolution pixel par pixel → suppression).
 */
export abstract class Enemy extends Entity {
  /** Temps écoulé depuis le dernier coup reçu (affichage de la barre de vie). */
  sinceHit = 99;
  protected deathTime = -1;
  /** Hauteur de la barre de vie au-dessus du sol. */
  barHeight = 2.8;

  constructor(
    readonly displayName: string,
    readonly xpReward: number,
    radius: number,
    stats: CombatStats,
    actor: SpriteActor,
  ) {
    super('enemy', radius, stats, actor);
  }

  /** Appelé quand le joueur déclenche une attaque (pour parer ou esquiver). */
  onPlayerAttack(_ctx: GameContext, _heavy: boolean): void {}

  protected beginDeath(ctx: GameContext): void {
    this.alive = false;
    this.deathTime = 0;
    ctx.combat.cancelHitboxes(this);
    ctx.events.emit('death', { entity: this });
  }

  /** Gère la dissolution après la mort. Retourne vrai si l'entité est en train de mourir. */
  protected updateDeath(dt: number, ctx: GameContext, color: number): boolean {
    if (this.deathTime < 0) return false;
    const before = this.deathTime;
    this.deathTime += dt;
    const start = 1.4;
    if (before < start && this.deathTime >= start) {
      ctx.fx.souls(this.position, color);
      ctx.events.emit('sfx', { name: 'soul', position: this.position });
    }
    const d = Math.max(0, (this.deathTime - start) / 0.9);
    this.actor.uniforms.uDissolve.value = Math.min(1.05, d);
    this.actor.setShadowOpacity(0.5 * (1 - Math.min(1, d)));
    if (d >= 1.05) this.removed = true;
    return true;
  }

  update(dt: number, ctx: GameContext): void {
    this.sinceHit += dt;
    this.think(dt, ctx);
    this.integrate(dt, ctx);
    this.syncVisual(dt, ctx);
  }

  protected abstract think(dt: number, ctx: GameContext): void;
}
