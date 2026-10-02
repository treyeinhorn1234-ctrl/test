import * as THREE from 'three';
import type { Entity } from '../entities/Entity';
import type { GameContext } from '../core/GameContext';
import { resolveDamage, type HitInfo } from './Damage';
import { angleDiff } from '../utils/math';

/**
 * Hitbox en arc de cercle, attachée à son propriétaire. Elle touche chaque
 * cible au plus une fois pendant sa durée de vie.
 */
export interface Hitbox {
  owner: Entity;
  /** Angle central (fixé au lancement de l'attaque). */
  angle: number;
  /** Demi-ouverture de l'arc (radians). */
  arc: number;
  range: number;
  /** Recul du centre de l'arc : touche aussi les cibles collées au porteur. */
  offset: number;
  hit: HitInfo;
  ttl: number;
  hits: Set<Entity>;
}

/**
 * Gère les entités combattantes, les hitboxes actives et la séparation
 * physique entre entités (elles ne se chevauchent pas).
 */
export class CombatSystem {
  readonly entities: Entity[] = [];
  private hitboxes: Hitbox[] = [];

  add(e: Entity): void {
    this.entities.push(e);
  }

  remove(e: Entity): void {
    const i = this.entities.indexOf(e);
    if (i >= 0) this.entities.splice(i, 1);
    this.hitboxes = this.hitboxes.filter((h) => h.owner !== e);
  }

  clear(): void {
    this.entities.length = 0;
    this.hitboxes.length = 0;
  }

  spawnHitbox(owner: Entity, opts: Omit<Hitbox, 'owner' | 'hits'>): Hitbox {
    const hb: Hitbox = { owner, hits: new Set(), ...opts };
    this.hitboxes.push(hb);
    return hb;
  }

  cancelHitboxes(owner: Entity): void {
    this.hitboxes = this.hitboxes.filter((h) => h.owner !== owner);
  }

  /** Test d'intersection arc / cercle (hurtbox). */
  static arcHits(origin: THREE.Vector3, angle: number, arc: number, range: number, target: Entity): boolean {
    const dx = target.position.x - origin.x;
    const dz = target.position.z - origin.z;
    const dist = Math.hypot(dx, dz);
    if (dist > range + target.radius) return false;
    if (dist < target.radius + 0.3) return true;
    // Élargit l'arc de la taille angulaire de la cible.
    const slack = Math.asin(Math.min(1, target.radius / dist));
    return Math.abs(angleDiff(angle, Math.atan2(dz, dx))) <= arc + slack;
  }

  update(dt: number, ctx: GameContext): void {
    for (const hb of this.hitboxes) {
      hb.ttl -= dt;
      if (!hb.owner.alive) continue;
      const origin = hb.owner.position.clone();
      origin.x -= Math.cos(hb.angle) * hb.offset;
      origin.z -= Math.sin(hb.angle) * hb.offset;
      for (const target of this.entities) {
        if (target.faction === hb.owner.faction || hb.hits.has(target) || !target.canBeHit()) continue;
        if (!CombatSystem.arcHits(origin, hb.angle, hb.arc, hb.range + hb.offset, target)) continue;
        hb.hits.add(target);
        this.applyHit(hb.owner, target, hb.hit, ctx);
      }
    }
    this.hitboxes = this.hitboxes.filter((h) => h.ttl > 0);
    this.separate();
  }

  /** Applique un coup directement (projectiles, sorts, zones). */
  applyHit(attacker: Entity, target: Entity, hit: HitInfo, ctx: GameContext): void {
    const blocked = target.isBlocking(attacker, hit);
    const result = resolveDamage(attacker.stats, target.stats, hit, blocked);
    target.stats.hp = Math.max(0, target.stats.hp - result.amount);
    const killed = target.stats.hp <= 0;
    target.onHit(result, hit, attacker, ctx);
    const pos = target.center;
    ctx.events.emit('hit', {
      target, attacker, amount: result.amount, crit: result.crit, blocked, killed, position: pos, tag: hit.tag,
    });
    const dir = new THREE.Vector3().subVectors(target.position, attacker.position).setY(0).normalize();
    ctx.fx.impact(pos, dir, attacker.faction === 'player' ? 'player' : 'enemy', result.crit, blocked);
    ctx.hitstop(blocked ? hit.hitstop * 0.6 : result.crit ? hit.hitstop * 1.5 : hit.hitstop);
    ctx.cameraRig.addTrauma(hit.shake * (result.crit ? 1.4 : 1) * (attacker.faction === 'enemy' ? 1.2 : 1));
  }

  /** Les entités vivantes se repoussent (sauf les fantômes en esquive). */
  private separate(): void {
    const list = this.entities;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive || a.ghost) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive || b.ghost) continue;
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const min = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = min - d;
        const wa = b.mass / (a.mass + b.mass);
        const nx = dx / d;
        const nz = dz / d;
        a.position.x -= nx * push * wa;
        a.position.z -= nz * push * wa;
        b.position.x += nx * push * (1 - wa);
        b.position.z += nz * push * (1 - wa);
      }
    }
  }
}
