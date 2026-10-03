import * as THREE from 'three';
import { PAL } from '../assets/palette';
import { getSkeletonSheet } from '../assets/sprites/skeletonSprite';
import type { DamageResult, HitInfo } from '../combat/Damage';
import { createStats } from '../combat/Stats';
import type { GameContext } from '../core/GameContext';
import { StateMachine } from '../engine/StateMachine';
import type { Entity } from '../entities/Entity';
import { SpriteActor } from '../entities/SpriteActor';
import { angleDiff, damp, randRange } from '../utils/math';
import { Enemy } from './Enemy';

type SState = 'rise' | 'idle' | 'chase' | 'strafe' | 'windup' | 'attack' | 'recover' | 'block' | 'backstep' | 'hurt' | 'dead';

const ATTACK_RANGE = 1.9;
const ATTACK_HIT: HitInfo = { power: 1, type: 'physical', knockback: 6, stun: 0.3, hitstop: 0.06, shake: 0.35, tag: 'skeletonSlash' };

/**
 * Squelette gardien. IA à états :
 * surgit du sol → poursuit → télégraphie (yeux, épée levée) → frappe →
 * récupère (fenêtre de punition) → recule ou contourne. Il peut lever son
 * bouclier quand Varyn attaque de face ; l'attaque lourde brise sa garde.
 * Un système de jetons limite le nombre d'attaquants simultanés.
 */
export class Skeleton extends Enemy {
  private readonly fsm: StateMachine<Skeleton, SState>;
  private ctx!: GameContext;
  private hasToken = false;
  private strafeSign = 1;
  private strafeTime = 0;
  private wanderTarget = new THREE.Vector3();
  private wanderTimer = 0;
  private blockCooldown = 0;
  private stunTime = 0;
  private attackSpawned = false;
  /** Agressivité : raccourcit la télégraphie (augmente avec les vagues). */
  private readonly aggression: number;
  readonly home = new THREE.Vector3();

  constructor(position: THREE.Vector3, level: number) {
    const scale = 1 + (level - 1) * 0.15;
    super(
      'Squelette gardien',
      Math.round(18 * (1 + (level - 1) * 0.2)),
      0.5,
      createStats({
        maxHp: Math.round(55 * scale),
        physAtk: 11 * (1 + (level - 1) * 0.08),
        armor: 0.05,
        magicResist: 0,
        critChance: 0.03,
      }),
      new SpriteActor(getSkeletonSheet(), 'rise', 0.6, 0.8),
    );
    this.aggression = Math.min(1.4, 1 + (level - 1) * 0.06);
    this.position.copy(position);
    this.home.copy(position);
    this.centerHeight = 1.5;
    this.barHeight = 3.7;
    this.strafeSign = Math.random() < 0.5 ? -1 : 1;
    this.fsm = new StateMachine<Skeleton, SState>(this, {
      rise: {
        enter: (s) => {
          s.invulnerable = 1;
          s.actor.anim.play('rise', true);
        },
        update: (s) => {
          s.invulnerable = 0.2;
          return s.actor.anim.finished ? 'idle' : undefined;
        },
      },
      idle: { enter: (s) => s.actor.anim.play('idle'), update: (s, dt) => s.updateIdle(dt) },
      chase: { enter: (s) => s.actor.anim.play('walk'), update: (s, dt) => s.updateChase(dt) },
      strafe: {
        enter: (s) => {
          s.actor.anim.play('walk');
          s.strafeTime = randRange(Math.random, 0.7, 1.4);
        },
        update: (s, dt) => s.updateStrafe(dt),
      },
      windup: {
        enter: (s) => {
          s.velocity.set(0, 0, 0);
          s.actor.anim.playFor('windup', 0.55 / s.aggression);
          s.ctx.events.emit('sfx', { name: 'enemyWindup', position: s.position });
          s.ctx.fx.telegraph(s, 0.65, ATTACK_RANGE + 0.3, 0.55 / s.aggression + 0.06, PAL.soulBlue);
        },
        update: (s, dt) => {
          const t = s.fsm.time;
          // Suit le joueur au début de la télégraphie, puis s'engage.
          if (t < 0.32 / s.aggression) s.turnTowards(s.ctx.player.position, dt, 10);
          s.velocity.multiplyScalar(0.8);
          return t >= 0.55 / s.aggression ? 'attack' : undefined;
        },
      },
      attack: {
        enter: (s) => {
          s.attackSpawned = false;
          s.actor.anim.playFor('attack', 0.3);
        },
        update: (s, dt) => s.updateAttack(dt),
        exit: (s) => s.releaseToken(),
      },
      recover: {
        enter: (s) => {
          s.actor.anim.playFor('recover', 0.55);
        },
        update: (s, dt) => {
          s.velocity.x = damp(s.velocity.x, 0, 10, dt);
          s.velocity.z = damp(s.velocity.z, 0, 10, dt);
          if (s.fsm.time < 0.6) return;
          return Math.random() < 0.35 ? 'backstep' : 'chase';
        },
      },
      block: {
        enter: (s) => {
          s.velocity.set(0, 0, 0);
          s.actor.anim.play('block', true);
          s.blockCooldown = 3.5;
        },
        update: (s, dt) => {
          s.turnTowards(s.ctx.player.position, dt, 8);
          return s.fsm.time > 0.9 ? 'chase' : undefined;
        },
      },
      backstep: {
        enter: (s) => {
          s.actor.anim.play('walk');
          s.actor.anim.speed = -1;
          const away = new THREE.Vector3().subVectors(s.position, s.ctx.player.position).setY(0).normalize();
          s.velocity.copy(away.multiplyScalar(6));
          s.ctx.fx.dust(s.position, 4, 0.6);
        },
        update: (s) => {
          s.velocity.multiplyScalar(0.9);
          s.faceTowards(s.ctx.player.position);
          return s.fsm.time > 0.35 ? 'strafe' : undefined;
        },
        exit: (s) => {
          s.actor.anim.speed = 1;
        },
      },
      hurt: {
        enter: (s) => {
          s.actor.anim.play('hurt', true);
          s.velocity.set(0, 0, 0);
        },
        update: (s) => (s.fsm.time >= s.stunTime ? 'chase' : undefined),
      },
      dead: {
        enter: (s) => {
          s.velocity.set(0, 0, 0);
          s.actor.anim.play('death', true);
        },
      },
    });
    this.fsm.set('rise');
  }

  private releaseToken(): void {
    if (this.hasToken) {
      this.hasToken = false;
      this.ctx.attackTokens.used = Math.max(0, this.ctx.attackTokens.used - 1);
    }
  }

  private turnTowards(p: THREE.Vector3, dt: number, rate: number): void {
    const target = Math.atan2(p.z - this.position.z, p.x - this.position.x);
    this.facing += angleDiff(this.facing, target) * Math.min(1, rate * dt);
  }

  private distToPlayer(): number {
    const p = this.ctx.player.position;
    return Math.hypot(p.x - this.position.x, p.z - this.position.z);
  }

  private moveTowards(target: THREE.Vector3, speed: number, dt: number): void {
    const dir = new THREE.Vector3().subVectors(target, this.position).setY(0);
    if (dir.lengthSq() > 1e-4) dir.normalize();
    this.velocity.x = damp(this.velocity.x, dir.x * speed, 8, dt);
    this.velocity.z = damp(this.velocity.z, dir.z * speed, 8, dt);
    if (dir.lengthSq() > 0) this.turnTowards(target, dt, 10);
  }

  private updateIdle(dt: number): SState | void {
    const player = this.ctx.player;
    if (player.alive && this.distToPlayer() < 14 && this.ctx.level.collision.hasLineOfSight(this.position, player.position)) {
      this.ctx.events.emit('sfx', { name: 'rattle', position: this.position });
      return 'chase';
    }
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = randRange(Math.random, 1.5, 3);
      this.wanderTarget.set(this.home.x + randRange(Math.random, -2.5, 2.5), 0, this.home.z + randRange(Math.random, -2.5, 2.5));
    }
    if (this.position.distanceTo(this.wanderTarget) > 0.3) {
      this.moveTowards(this.wanderTarget, 1.1, dt);
      this.actor.anim.play('walk');
    } else {
      this.velocity.multiplyScalar(0.8);
      this.actor.anim.play('idle');
    }
  }

  private updateChase(dt: number): SState | void {
    const player = this.ctx.player;
    if (!player.alive) return 'idle';
    const d = this.distToPlayer();
    if (d < ATTACK_RANGE + 0.2) {
      const tokens = this.ctx.attackTokens;
      if (tokens.used < tokens.max) {
        tokens.used++;
        this.hasToken = true;
        return 'windup';
      }
      return 'strafe';
    }
    this.moveTowards(player.position, 3.1, dt);
    this.consumeSteps();
  }

  private updateStrafe(dt: number): SState | void {
    const player = this.ctx.player;
    if (!player.alive) return 'idle';
    const to = new THREE.Vector3().subVectors(this.position, player.position).setY(0);
    const d = to.length();
    to.normalize();
    // Tourne autour du joueur à distance respectueuse.
    const tangent = new THREE.Vector3(-to.z, 0, to.x).multiplyScalar(this.strafeSign);
    const radial = d < 2.6 ? 1 : d > 3.6 ? -1 : 0;
    const desired = tangent.multiplyScalar(1.6).addScaledVector(to, radial * 1.4);
    this.velocity.x = damp(this.velocity.x, desired.x, 6, dt);
    this.velocity.z = damp(this.velocity.z, desired.z, 6, dt);
    this.faceTowards(player.position);
    this.consumeSteps();
    this.strafeTime -= dt;
    if (this.ctx.level.collision.isSolidAt(this.position.x + desired.x * 0.4, this.position.z + desired.z * 0.4)) this.strafeSign *= -1;
    if (this.strafeTime <= 0) {
      if (Math.random() < 0.3) this.strafeSign *= -1;
      return 'chase';
    }
  }

  private updateAttack(dt: number): SState | void {
    const t = this.fsm.time;
    const fwd = this.forward;
    const lunge = t < 0.12 ? 5.5 : 0;
    this.velocity.x = damp(this.velocity.x, fwd.x * lunge, 20, dt);
    this.velocity.z = damp(this.velocity.z, fwd.z * lunge, 20, dt);
    if (!this.attackSpawned && t >= 0.05) {
      this.attackSpawned = true;
      this.ctx.combat.spawnHitbox(this, { angle: this.facing, arc: 1.2, range: ATTACK_RANGE + 0.2, offset: 0.3, hit: ATTACK_HIT, ttl: 0.12 });
      this.ctx.fx.slashArc(this.position, this.facing + 0.7, -1.4, ATTACK_RANGE + 0.4, 0x1c6cc4, 0xc8f2ff, 0.22, 1.0);
      this.ctx.fx.swordTrail(this.position, this.facing, ATTACK_RANGE, PAL.soulBlue, 6);
      this.ctx.events.emit('sfx', { name: 'enemySwing', position: this.position });
    }
    if (t >= 0.32) return 'recover';
  }

  private consumeSteps(): void {
    for (const ev of this.actor.anim.consumeEvents()) {
      if (ev === 'rattle' && Math.random() < 0.35) this.ctx.events.emit('sfx', { name: 'rattle', position: this.position, volume: 0.25 });
    }
  }

  onPlayerAttack(ctx: GameContext, heavy: boolean): void {
    this.ctx = ctx;
    if (!this.alive || heavy || this.blockCooldown > 0) return;
    if (!this.fsm.is('chase', 'strafe', 'idle', 'recover')) return;
    if (this.distToPlayer() > 3.4) return;
    if (Math.random() < 0.28) {
      this.faceTowards(ctx.player.position);
      this.fsm.set('block');
    }
  }

  isBlocking(from: Entity, hit: HitInfo): boolean {
    if (!this.fsm.is('block') || hit.guardBreak) return false;
    const a = Math.atan2(from.position.z - this.position.z, from.position.x - this.position.x);
    return Math.abs(angleDiff(this.facing, a)) < 1.3;
  }

  onHit(result: DamageResult, hit: HitInfo, from: Entity, ctx: GameContext): void {
    this.ctx = ctx;
    this.sinceHit = 0;
    if (!result.blocked && !this.fsm.is('windup')) ctx.fx.cancelTelegraph(this);
    this.flash(result.blocked ? 0.06 : 0.12);
    const dir = new THREE.Vector3().subVectors(this.position, from.position).setY(0).normalize();
    if (result.blocked) {
      this.applyKnockback(dir, 2.5);
      from.applyKnockback(dir.clone().negate(), 3);
      ctx.events.emit('sfx', { name: 'block', position: this.position });
      return;
    }
    this.applyKnockback(dir, hit.knockback);
    ctx.events.emit('sfx', { name: 'boneHit', position: this.position });
    if (this.stats.hp <= 0) {
      ctx.fx.cancelTelegraph(this);
      this.releaseToken();
      this.fsm.set('dead');
      this.beginDeath(ctx);
      return;
    }
    if (this.fsm.is('block') && hit.guardBreak) {
      ctx.events.emit('floatText', { text: 'GARDE BRISÉE', position: this.position.clone().setY(2.6), cls: 'crit' });
      ctx.events.emit('sfx', { name: 'block', position: this.position, volume: 0.6 });
      this.stunTime = 1.2;
      this.releaseToken();
      this.fsm.set('hurt', true);
      return;
    }
    // Super-armure partielle pendant la télégraphie.
    if (this.fsm.is('windup') && hit.tag === 'slash' && Math.random() < 0.3) return;
    ctx.fx.cancelTelegraph(this);
    this.stunTime = Math.max(0.18, hit.stun);
    this.releaseToken();
    this.fsm.set('hurt', true);
  }

  protected think(dt: number, ctx: GameContext): void {
    this.ctx = ctx;
    this.blockCooldown = Math.max(0, this.blockCooldown - dt);
    if (this.updateDeath(dt, ctx, PAL.soulBlue)) return;
    this.fsm.update(dt);
    // Les orbites brillent pendant la télégraphie : lisibilité du danger.
    this.actor.material.emissiveIntensity = this.fsm.is('windup', 'attack') ? 4 : 1.6;
    if (this.fsm.is('windup') && Math.random() < dt * 20) ctx.fx.aura(this.position, PAL.soulBlue, 1, 0.35);
  }
}
