import * as THREE from 'three';
import type { CombatStats } from '../combat/Stats';
import type { DamageResult, HitInfo } from '../combat/Damage';
import type { GameContext } from '../core/GameContext';
import { SpriteActor } from './SpriteActor';

export type Faction = 'player' | 'enemy';

let nextId = 1;

/**
 * Entité de jeu : position sur le plan XZ, cercle de collision (hurtbox),
 * statistiques, recul physique et représentation sprite.
 */
export abstract class Entity {
  readonly id = nextId++;
  readonly position = new THREE.Vector3();
  /** Vitesse voulue (déplacement contrôlé). */
  readonly velocity = new THREE.Vector3();
  /** Vitesse de recul, amortie indépendamment. */
  readonly knockback = new THREE.Vector3();
  /** Orientation (angle sur le plan XZ, atan2(z, x)). */
  facing = 0;
  alive = true;
  /** Marquée pour suppression par le monde. */
  removed = false;
  /** Temps d'invulnérabilité restant (esquive, apparition…). */
  invulnerable = 0;
  /** Les entités « fantômes » traversent les autres (esquive). */
  ghost = false;
  /** Poids pour la séparation entre entités (plus lourd = moins poussé). */
  mass = 1;
  protected flashTime = 0;
  /** Hauteur du centre de la cible (pour les effets). */
  centerHeight = 1.2;

  constructor(
    readonly faction: Faction,
    readonly radius: number,
    readonly stats: CombatStats,
    readonly actor: SpriteActor,
  ) {}

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(Math.cos(this.facing), 0, Math.sin(this.facing));
  }

  get center(): THREE.Vector3 {
    return this.position.clone().setY(this.centerHeight);
  }

  faceTowards(p: THREE.Vector3): void {
    const dx = p.x - this.position.x;
    const dz = p.z - this.position.z;
    if (dx * dx + dz * dz > 1e-6) this.facing = Math.atan2(dz, dx);
  }

  applyKnockback(dir: THREE.Vector3, force: number): void {
    this.knockback.x += dir.x * force;
    this.knockback.z += dir.z * force;
  }

  canBeHit(): boolean {
    return this.alive && this.invulnerable <= 0;
  }

  /** Vrai si un coup venant de `from` est paré (bouclier). */
  isBlocking(_from: Entity, _hit: HitInfo): boolean {
    return false;
  }

  /** Réaction à un coup déjà résolu (dégâts appliqués par le système de combat). */
  abstract onHit(result: DamageResult, hit: HitInfo, from: Entity, ctx: GameContext): void;

  abstract update(dt: number, ctx: GameContext): void;

  flash(duration = 0.12): void {
    this.flashTime = duration;
  }

  /** Intègre vitesse + recul et résout les collisions avec le décor. */
  protected integrate(dt: number, ctx: GameContext): void {
    this.position.x += (this.velocity.x + this.knockback.x) * dt;
    this.position.z += (this.velocity.z + this.knockback.z) * dt;
    const decay = Math.exp(-9 * dt);
    this.knockback.multiplyScalar(decay);
    ctx.level.collision.resolveCircle(this.position, this.radius);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
  }

  /** Synchronise le sprite : position, miroir selon l'écran, flash. */
  syncVisual(dt: number, ctx: GameContext): void {
    const actor = this.actor;
    actor.root.position.copy(this.position);
    const fx = Math.cos(this.facing);
    const fz = Math.sin(this.facing);
    const screenX = fx * ctx.cameraRig.groundRight.x + fz * ctx.cameraRig.groundRight.z;
    const screenUp = fx * ctx.cameraRig.groundUp.x + fz * ctx.cameraRig.groundUp.z;
    if (screenX > 0.12) actor.setScreenFacing(true);
    else if (screenX < -0.12) actor.setScreenFacing(false);
    // Vue de dos quand le personnage s'éloigne de la caméra (avec hystérésis).
    if (screenUp > 0.5) actor.anim.back = true;
    else if (screenUp < 0.25) actor.anim.back = false;
    this.flashTime = Math.max(0, this.flashTime - dt);
    actor.uniforms.uFlash.value = this.flashTime > 0 ? 0.75 : 0;
    actor.update(dt);
  }
}
