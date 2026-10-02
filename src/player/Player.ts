import * as THREE from 'three';
import { PAL } from '../assets/palette';
import { getVarynSheet } from '../assets/sprites/varynSprite';
import type { DamageResult, HitInfo } from '../combat/Damage';
import { createStats } from '../combat/Stats';
import type { GameContext } from '../core/GameContext';
import { StateMachine } from '../engine/StateMachine';
import { Entity } from '../entities/Entity';
import { SpriteActor } from '../entities/SpriteActor';
import { Experience } from '../progression/Experience';
import type { Interactable } from '../world/Level';
import { angleDiff, damp } from '../utils/math';
import { ABYSSAL_CLAW, CLAW_COOLDOWN, COMBO, HEAVY, type AttackDef } from './PlayerAttacks';

type PState = 'idle' | 'move' | 'attack' | 'dodge' | 'roll' | 'hurt' | 'dead' | 'interact' | 'victory';
type Buffered = 'light' | 'heavy' | 'claw' | 'dodge';

const WALK_SPEED = 4.6;
const RUN_SPEED = 7.6;
const RUN_COST = 14;
const DODGE_COST = 22;
const DODGE_TIME = 0.32;
const DODGE_IFRAMES = 0.27;
const BUFFER_TIME = 0.3;
const ROLL_COST = 18;
const ROLL_TIME = 0.5;
const ROLL_IFRAMES = 0.36;

/**
 * Varyn, contrôlé par le joueur. Toute la logique d'action passe par une
 * machine à états qui pilote les animations, les hitboxes et les coûts.
 */
export class Player extends Entity {
  readonly xp = new Experience();
  readonly light: THREE.PointLight;
  private readonly fsm: StateMachine<Player, PState>;
  private ctx!: GameContext;

  private moveDir = new THREE.Vector3();
  private buffer: Buffered | null = null;
  private bufferTime = 0;
  private attack: AttackDef | null = null;
  private comboIndex = 0;
  private hitboxSpawned = false;
  private dodgeDir = new THREE.Vector3();
  /** Sens de balayage des arcs du combo (alterne à chaque coup). */
  private arcSign = 1;
  private ghostTimer = 0;
  private staminaDelay = 0;
  private deathNotified = false;
  running = false;
  clawCooldown = 0;
  /** Objet interactif à portée (défini par le jeu chaque frame). */
  interactTarget: Interactable | null = null;
  private auraTimer = 0;

  constructor() {
    super(
      'player',
      0.55,
      createStats({
        maxHp: 120, maxMana: 60, maxStamina: 100,
        physAtk: 14, magAtk: 16, armor: 0.1, magicResist: 0.1,
        critChance: 0.12, critMult: 1.8,
      }),
      new SpriteActor(getVarynSheet(), 'idle', 0.9, 1.1, 0.95),
    );
    this.mass = 3;
    this.centerHeight = 1.7;
    this.light = new THREE.PointLight(0xd8c8ff, 14, 11, 1.2);
    this.fsm = new StateMachine<Player, PState>(this, {
      idle: { enter: (p) => p.actor.anim.play('idle'), update: (p, dt) => p.updateLocomotion(dt) },
      move: { update: (p, dt) => p.updateLocomotion(dt) },
      attack: { update: (p, dt) => p.updateAttack(dt) },
      dodge: {
        enter: (p) => p.enterDodge(),
        update: (p, dt) => p.updateDodge(dt),
        exit: (p) => {
          p.ghost = false;
        },
      },
      roll: {
        enter: (p) => p.enterRoll(),
        update: (p, dt) => p.updateRoll(dt),
        exit: (p) => {
          p.ghost = false;
        },
      },
      hurt: {
        enter: (p) => {
          p.actor.anim.playFor('hurt', 0.3);
          p.velocity.set(0, 0, 0);
        },
        update: (p) => (p.fsm.time > 0.3 ? 'idle' : undefined),
      },
      dead: {
        enter: (p) => {
          p.actor.anim.play('death');
          p.velocity.set(0, 0, 0);
          p.ctx.events.emit('sfx', { name: 'playerDeath' });
        },
        update: (p) => {
          if (p.fsm.time > 2.4 && !p.deathNotified) {
            p.deathNotified = true;
            p.ctx.events.emit('playerDied', {});
          }
        },
      },
      interact: {
        enter: (p) => {
          p.actor.anim.playFor('interact', 0.5);
          p.velocity.set(0, 0, 0);
          if (p.interactTarget) p.faceTowards(p.interactTarget.position);
        },
        update: (p) => {
          if (p.fsm.time > 0.22 && p.interactTarget && !p.hitboxSpawned) {
            p.hitboxSpawned = true;
            p.ctx.events.emit('interact', { kind: p.interactTarget.kind });
          }
          return p.fsm.time > 0.5 ? 'idle' : undefined;
        },
        exit: (p) => {
          p.hitboxSpawned = false;
        },
      },
      victory: {
        enter: (p) => {
          p.actor.anim.play('victory', true);
          p.velocity.set(0, 0, 0);
        },
        update: (p) => {
          if (Math.random() < 0.5) p.ctx.fx.aura(p.position, PAL.void3, 1, 0.6);
          return p.fsm.time > 1.6 || p.moveDir.lengthSq() > 0 || p.buffer ? 'idle' : undefined;
        },
      },
    });
    this.fsm.set('idle');
  }

  get state(): PState | null {
    return this.fsm.current;
  }

  get isDead(): boolean {
    return this.fsm.is('dead');
  }

  /** Réinitialise Varyn pour une nouvelle partie. */
  reset(at: THREE.Vector3): void {
    const s = this.stats;
    this.xp.reset();
    s.maxHp = 120;
    s.maxMana = 60;
    s.physAtk = 14;
    s.magAtk = 16;
    s.hp = s.maxHp;
    s.mana = s.maxMana;
    s.stamina = s.maxStamina;
    this.alive = true;
    this.deathNotified = false;
    this.position.copy(at);
    this.velocity.set(0, 0, 0);
    this.knockback.set(0, 0, 0);
    this.facing = Math.PI / 2;
    this.clawCooldown = 0;
    this.buffer = null;
    this.actor.uniforms.uTintAmount.value = 0;
    this.fsm.set('idle', true);
  }

  celebrate(): void {
    if (this.fsm.is('idle', 'move')) this.fsm.set('victory');
  }

  gainXp(amount: number): number {
    const levels = this.xp.add(amount);
    if (levels > 0) {
      const s = this.stats;
      s.maxHp += 14 * levels;
      s.maxMana += 6 * levels;
      s.physAtk += 2 * levels;
      s.magAtk += 2 * levels;
      s.hp = s.maxHp;
      s.mana = s.maxMana;
    }
    return levels;
  }

  heal(amount: number): number {
    const before = this.stats.hp;
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
    return this.stats.hp - before;
  }

  restoreMana(): void {
    this.stats.mana = this.stats.maxMana;
  }

  update(dt: number, ctx: GameContext): void {
    this.ctx = ctx;
    this.readInput(dt);
    this.regen(dt);
    this.fsm.update(dt);
    this.integrate(dt, ctx);

    // Lumière d'aura placée côté caméra pour éclairer le sprite.
    const toCam = ctx.cameraRig.groundUp.clone().negate();
    this.light.position.copy(this.position).addScaledVector(toCam, 2.6).setY(3.2);
    this.auraTimer += dt;
    if (this.alive && this.auraTimer > 0.12) {
      this.auraTimer = 0;
      ctx.fx.aura(this.position, PAL.void2, 1, 0.5);
    }
    this.syncVisual(dt, ctx);
    // Pendant l'esquive, Varyn devient une ombre translucide.
    this.actor.uniforms.uTint.value.set(PAL.void0);
    this.actor.uniforms.uTintAmount.value = this.fsm.is('dodge') ? 0.55 : 0;
  }

  private readInput(dt: number): void {
    const input = this.ctx.input;
    const axis = input.moveAxis();
    const rig = this.ctx.cameraRig;
    this.moveDir.set(0, 0, 0).addScaledVector(rig.groundUp, axis.y).addScaledVector(rig.groundRight, axis.x);
    if (this.moveDir.lengthSq() > 0) this.moveDir.normalize();
    this.running = input.isDown('run') && this.moveDir.lengthSq() > 0 && this.stats.stamina > 1;

    const press = (b: Buffered) => {
      this.buffer = b;
      this.bufferTime = BUFFER_TIME;
    };
    if (input.wasPressed('lightAttack')) press('light');
    if (input.wasPressed('heavyAttack')) press('heavy');
    if (input.wasPressed('spell1')) press('claw');
    if (input.wasPressed('dodge')) press('dodge');
    if (input.wasPressed('spell2') || input.wasPressed('special')) {
      this.ctx.events.emit('message', {
        title: 'Pouvoir scellé',
        text: "Ce pouvoir dort encore sous le sceau. Chaînes de l'Abîme, Frappe d'Eclipse et Tempête du Néant se débloqueront en progressant (Étape 3).",
      });
    }
    this.bufferTime -= dt;
    if (this.bufferTime <= 0) this.buffer = null;

    if (input.wasPressed('interact') && this.interactTarget && this.fsm.is('idle', 'move', 'victory')) {
      this.fsm.set('interact');
    }
  }

  private regen(dt: number): void {
    const s = this.stats;
    this.clawCooldown = Math.max(0, this.clawCooldown - dt);
    if (!this.alive) return;
    s.mana = Math.min(s.maxMana, s.mana + 1.5 * dt);
    if (this.running && this.fsm.is('move')) {
      s.stamina = Math.max(0, s.stamina - RUN_COST * dt);
      this.staminaDelay = 0.5;
    } else if (this.fsm.is('attack', 'dodge')) {
      this.staminaDelay = 0.5;
    } else {
      this.staminaDelay -= dt;
      if (this.staminaDelay <= 0) s.stamina = Math.min(s.maxStamina, s.stamina + 34 * dt);
    }
  }

  private spendStamina(amount: number): void {
    this.stats.stamina = Math.max(0, this.stats.stamina - amount);
    this.staminaDelay = 0.6;
  }

  /** Tente de lancer l'action mémorisée. Retourne vrai si une action démarre. */
  private tryBuffered(): boolean {
    const b = this.buffer;
    if (!b) return false;
    const s = this.stats;
    if (b === 'dodge') {
      if (s.stamina <= 0) return false;
      this.buffer = null;
      // En courant : pas de l'ombre (rapide) ; sinon roulade.
      this.fsm.set(this.ctx.input.isDown('run') && this.moveDir.lengthSq() > 0 ? 'dodge' : 'roll', true);
      return true;
    }
    if (b === 'light') {
      if (s.stamina <= 0) return false;
      this.buffer = null;
      const next = this.fsm.is('attack') && this.attack && COMBO.includes(this.attack) ? (this.comboIndex + 1) % COMBO.length : 0;
      this.startAttack(COMBO[next], next);
      return true;
    }
    if (b === 'heavy') {
      if (s.stamina <= 0) return false;
      this.buffer = null;
      this.startAttack(HEAVY, 0);
      return true;
    }
    if (b === 'claw') {
      this.buffer = null;
      if (this.clawCooldown > 0 || s.mana < (ABYSSAL_CLAW.mana ?? 0)) {
        this.ctx.events.emit('sfx', { name: 'denied' });
        return false;
      }
      this.clawCooldown = CLAW_COOLDOWN;
      this.startAttack(ABYSSAL_CLAW, 0);
      return true;
    }
    return false;
  }

  private updateLocomotion(dt: number): PState | void {
    if (this.tryBuffered()) return;
    const moving = this.moveDir.lengthSq() > 0;
    const speed = moving ? (this.running ? RUN_SPEED : WALK_SPEED) : 0;
    this.velocity.x = damp(this.velocity.x, this.moveDir.x * speed, 16, dt);
    this.velocity.z = damp(this.velocity.z, this.moveDir.z * speed, 16, dt);
    if (moving) {
      this.facing = Math.atan2(this.moveDir.z, this.moveDir.x);
      this.actor.anim.play(this.running ? 'run' : 'walk');
      if (!this.fsm.is('move')) this.fsm.set('move');
    } else {
      if (this.fsm.is('move')) this.fsm.set('idle');
    }
    for (const ev of this.actor.anim.consumeEvents()) {
      if (ev === 'step') {
        this.ctx.events.emit('sfx', { name: 'step', volume: this.running ? 0.5 : 0.3 });
        if (this.running) this.ctx.fx.dust(this.position, 2, 0.5);
      }
    }
  }

  /** Oriente l'attaque vers la souris, avec une légère assistance de visée. */
  private aimAngle(range: number): number {
    const aim = this.ctx.aimPoint;
    let angle = this.facing;
    const dx = aim.x - this.position.x;
    const dz = aim.z - this.position.z;
    if (dx * dx + dz * dz > 0.09) angle = Math.atan2(dz, dx);
    let best: Entity | null = null;
    let bestScore = Infinity;
    for (const e of this.ctx.combat.entities) {
      if (e.faction !== 'enemy' || !e.alive) continue;
      const ex = e.position.x - this.position.x;
      const ez = e.position.z - this.position.z;
      const d = Math.hypot(ex, ez);
      if (d > range + 1.6) continue;
      const diff = Math.abs(angleDiff(angle, Math.atan2(ez, ex)));
      if (diff > 0.7) continue;
      const score = d + diff * 3;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (best) angle = Math.atan2(best.position.z - this.position.z, best.position.x - this.position.x);
    return angle;
  }

  private startAttack(def: AttackDef, comboIndex: number): void {
    this.attack = def;
    this.comboIndex = comboIndex;
    this.hitboxSpawned = false;
    this.facing = this.aimAngle(def.range);
    this.spendStamina(def.stamina);
    if (def.mana) this.stats.mana -= def.mana;
    this.actor.anim.playFor(def.anim, def.duration);
    this.fsm.set('attack', true);
    this.ctx.events.emit('playerAttack', { position: this.position.clone(), heavy: def === HEAVY });
    if (def === HEAVY) this.ctx.events.emit('sfx', { name: 'charge' });
  }

  private updateAttack(dt: number): PState | void {
    const def = this.attack!;
    const t = this.fsm.time;
    const fwd = this.forward;
    // Élan : avance pendant la phase active, puis s'arrête net.
    const lungeK = t < def.activeStart - 0.06 ? 0.15 : t < def.activeEnd ? 1 : 0;
    const target = def.lunge * lungeK;
    this.velocity.x = damp(this.velocity.x, fwd.x * target, 20, dt);
    this.velocity.z = damp(this.velocity.z, fwd.z * target, 20, dt);

    if (def === HEAVY && t < def.activeStart) {
      this.ctx.fx.aura(this.position, PAL.void3, 2, 0.9);
      this.ctx.fx.converge(this.position, PAL.void2, 3, 2.6);
    }

    if (!this.hitboxSpawned && t >= def.activeStart) {
      this.hitboxSpawned = true;
      this.ctx.combat.spawnHitbox(this, {
        angle: this.facing, arc: def.arc, range: def.range, offset: 0.4,
        hit: def.hit, ttl: def.activeEnd - def.activeStart,
      });
      this.ctx.events.emit('sfx', { name: def.sfx });
      this.attackVfx(def);
      if (def.shockwave) {
        const p = this.position.clone().addScaledVector(fwd, 1.6);
        this.ctx.fx.shockwave(p, PAL.void2, def.shockwave);
        this.ctx.fx.dust(p, 12, 1.4);
        this.ctx.cameraRig.addTrauma(0.25);
        this.ctx.events.emit('sfx', { name: 'slam' });
      }
      if (def === ABYSSAL_CLAW) {
        const p = this.position.clone().addScaledVector(fwd, 1.9);
        this.ctx.fx.clawMarks(p, this.facing);
        this.ctx.fx.aura(p, PAL.void3, 14, 1.2);
      }
    }

    if (t >= def.cancelAt) {
      if (this.buffer === 'dodge' || this.buffer === 'heavy' || this.buffer === 'claw') {
        if (this.tryBuffered()) return;
      }
      if (this.buffer === 'light' && t >= def.activeEnd + 0.03) {
        if (this.tryBuffered()) return;
      }
    }
    if (t >= def.duration) {
      this.attack = null;
      return this.moveDir.lengthSq() > 0 ? 'move' : 'idle';
    }
  }

  /** Effets de taille : croissant au sol, braises, fissures, griffes. */
  private attackVfx(def: AttackDef): void {
    const fx = this.ctx.fx;
    const pos = this.position;
    if (def === ABYSSAL_CLAW) {
      for (const [r, k] of [[2.4, 0], [3.0, 1], [3.6, 2]] as const) {
        fx.slashArc(pos, this.facing + def.arc - k * 0.08, -def.arc * 2, r, PAL.void1, PAL.void3, 0.26, 1.0 + k * 0.15);
      }
      fx.swordTrail(pos, this.facing, def.range, PAL.void3, 14);
      return;
    }
    if (def === HEAVY) {
      fx.slashArc(pos, this.facing, Math.PI * 2 * this.arcSign, def.range + 0.3, PAL.void1, PAL.void3, 0.34, 1.0);
      fx.slashArc(pos, this.facing + 0.6, Math.PI * 2 * this.arcSign, def.range - 0.6, PAL.void0, PAL.void2, 0.38, 0.6);
      fx.swordTrail(pos, this.facing, def.range, PAL.void3, 26);
      fx.crack(pos.clone().addScaledVector(this.forward, 1.2), PAL.void1, 1.3);
      this.ctx.cameraRig.punch(0.07);
      return;
    }
    const slam = def === COMBO[2];
    if (slam) {
      fx.slashArc(pos, this.facing - def.arc, def.arc * 2, def.range + 0.2, PAL.void1, PAL.void3, 0.26, 0.5);
      fx.crack(pos.clone().addScaledVector(this.forward, 1.7), PAL.void1, 1);
      this.ctx.cameraRig.punch(0.05);
    } else {
      this.arcSign *= -1;
      fx.slashArc(pos, this.facing - def.arc * this.arcSign, def.arc * 2 * this.arcSign, def.range + 0.2, PAL.void1, PAL.void3, 0.22, 1.2);
    }
    fx.swordTrail(pos, this.facing, def.range, PAL.void2, slam ? 18 : 10);
  }

  private enterRoll(): void {
    this.dodgeDir.copy(this.moveDir.lengthSq() > 0 ? this.moveDir : this.forward);
    this.facing = Math.atan2(this.dodgeDir.z, this.dodgeDir.x);
    this.spendStamina(ROLL_COST);
    this.invulnerable = ROLL_IFRAMES;
    this.ghost = true;
    this.ghostTimer = 0;
    this.attack = null;
    this.ctx.combat.cancelHitboxes(this);
    this.actor.anim.playFor('roll', ROLL_TIME);
    this.ctx.events.emit('sfx', { name: 'roll' });
    this.ctx.fx.dust(this.position, 10, 1.1);
  }

  private updateRoll(dt: number): PState | void {
    const t = this.fsm.time;
    const k = Math.max(0, 1 - t / ROLL_TIME);
    const speed = 2.5 + 10.5 * Math.pow(k, 1.1);
    this.velocity.set(this.dodgeDir.x * speed, 0, this.dodgeDir.z * speed);
    this.ghostTimer -= dt;
    if (this.ghostTimer <= 0) {
      this.ghostTimer = 0.07;
      this.ctx.fx.dust(this.position, 2, 0.6);
      this.ctx.fx.aura(this.position, PAL.void1, 1, 0.3);
    }
    if (t >= ROLL_TIME * 0.75 && t - dt < ROLL_TIME * 0.75) this.ctx.fx.dust(this.position, 8, 1);
    if (t >= ROLL_TIME) return this.moveDir.lengthSq() > 0 ? 'move' : 'idle';
  }

  private enterDodge(): void {
    this.dodgeDir.copy(this.moveDir.lengthSq() > 0 ? this.moveDir : this.forward);
    this.facing = Math.atan2(this.dodgeDir.z, this.dodgeDir.x);
    this.spendStamina(DODGE_COST);
    this.invulnerable = DODGE_IFRAMES;
    this.ghost = true;
    this.ghostTimer = 0;
    this.attack = null;
    this.ctx.combat.cancelHitboxes(this);
    this.actor.anim.playFor('dodge', DODGE_TIME);
    this.ctx.events.emit('sfx', { name: 'dodge' });
    this.ctx.fx.dust(this.position, 8, 1);
  }

  private updateDodge(dt: number): PState | void {
    const t = this.fsm.time;
    const k = Math.max(0, 1 - t / DODGE_TIME);
    const speed = 3 + 15 * Math.pow(k, 1.4);
    this.velocity.set(this.dodgeDir.x * speed, 0, this.dodgeDir.z * speed);
    this.ghostTimer -= dt;
    if (this.ghostTimer <= 0) {
      this.ghostTimer = 0.045;
      this.ctx.fx.afterimage(this.actor);
      this.ctx.fx.aura(this.position, PAL.void1, 2, 0.4);
    }
    if (t >= DODGE_TIME) return this.moveDir.lengthSq() > 0 ? 'move' : 'idle';
  }

  onHit(_result: DamageResult, hit: HitInfo, from: Entity, ctx: GameContext): void {
    if (!this.alive) return;
    this.flash(0.14);
    const dir = new THREE.Vector3().subVectors(this.position, from.position).setY(0).normalize();
    this.applyKnockback(dir, hit.knockback * 0.8);
    ctx.events.emit('sfx', { name: 'playerHurt' });
    if (this.stats.hp <= 0) {
      this.alive = false;
      ctx.combat.cancelHitboxes(this);
      this.fsm.set('dead');
      return;
    }
    this.invulnerable = 0.6;
    // L'attaque lourde, une fois lancée, ne peut être interrompue (super-armure).
    const armored = this.fsm.is('attack') && this.attack === HEAVY && this.fsm.time > HEAVY.activeStart - 0.15;
    if (!armored) {
      ctx.combat.cancelHitboxes(this);
      this.attack = null;
      this.fsm.set('hurt', true);
    }
  }
}
