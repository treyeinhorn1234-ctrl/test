import * as THREE from 'three';
import { PAL } from '../assets/palette';
import { getKnightSheet } from '../assets/character/knight/knightSheet';
import { SpriteActor } from '../entities/SpriteActor';
import type { DamageResult, HitInfo } from '../combat/Damage';
import { createStats } from '../combat/Stats';
import type { GameContext } from '../core/GameContext';
import { StateMachine } from '../engine/StateMachine';
import { Entity } from '../entities/Entity';
import { Experience } from '../progression/Experience';
import type { Interactable } from '../world/Level';
import { angleDiff, damp } from '../utils/math';
import type { FrameData } from '../entities/animation/SpriteSheet';
import { CLAW_COOLDOWN, CLAW_EXTRA_RANGE, COMBO, MOVES, type MoveDef, type MoveId } from './PlayerMoves';

type PState = 'idle' | 'move' | 'attack' | 'guard' | 'dodge' | 'roll' | 'hurt' | 'dead' | 'interact' | 'victory';
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
/** Garde levée depuis moins de PARRY_WINDOW s : parade parfaite. */
const PARRY_WINDOW = 0.2;
/** Coût en endurance d'un coup encaissé en garde. */
const GUARD_COST = 14;
/** Après une roulade ou une parade, l'attaque légère devient un uppercut pendant ce délai. */
const RIPOSTE_WINDOW = 0.45;

/**
 * Varyn, contrôlé par le joueur. Toute la logique d'action passe par une
 * machine à états qui pilote les animations, les hitboxes et les coûts.
 *
 * Combat piloté par le sprite : pendant une attaque, c'est la frame affichée
 * qui décide (hitbox à l'entrée de chaque fenêtre active mesurée sur
 * l'animation, portée = allonge de la lame sur ces frames, enchaînement
 * ouvert après la dernière frame active).
 */
export class Player extends Entity {
  readonly xp = new Experience();
  readonly light: THREE.PointLight;
  private readonly fsm: StateMachine<Player, PState>;
  private ctx!: GameContext;

  private moveDir = new THREE.Vector3();
  private buffer: Buffered | null = null;
  private bufferTime = 0;
  private move: MoveDef | null = null;
  private moveFd: FrameData | null = null;
  /** Fenêtres actives déjà déclenchées pour le coup en cours. */
  private windowsFired = 0;
  private comboIndex = 0;
  private hitboxSpawned = false;
  /** Temps depuis la levée de la garde. */
  private guardTime = 0;
  /** Fenêtre de riposte (uppercut) après une roulade ou une parade. */
  private riposte = 0;
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
      new SpriteActor(getKnightSheet(), 'idle', 0.55, 0.8, 1.8, 0.6),
    );
    this.mass = 3;
    this.centerHeight = 1.3;
    this.light = new THREE.PointLight(0xd8c8ff, 14, 11, 1.2);
    this.fsm = new StateMachine<Player, PState>(this, {
      idle: { enter: (p) => p.actor.anim.play('idle'), update: (p, dt) => p.updateLocomotion(dt) },
      move: { update: (p, dt) => p.updateLocomotion(dt) },
      attack: { update: (p, dt) => p.updateAttack(dt) },
      guard: {
        enter: (p) => {
          p.guardTime = 0;
          p.actor.anim.play('guard', true, 1);
          p.velocity.set(0, 0, 0);
        },
        update: (p, dt) => p.updateGuard(dt),
      },
      dodge: {
        enter: (p) => p.enterDodge(),
        update: (p, dt) => p.updateDodge(dt),
        exit: (p) => {
          p.ghost = false;
          p.riposte = RIPOSTE_WINDOW;
        },
      },
      roll: {
        enter: (p) => p.enterRoll(),
        update: (p, dt) => p.updateRoll(dt),
        exit: (p) => {
          p.ghost = false;
          p.riposte = RIPOSTE_WINDOW;
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
    this.move = null;
    this.riposte = 0;
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

    // Garde : tenue tant que la touche est enfoncée.
    if (input.isDown('block') && this.alive && this.fsm.is('idle', 'move', 'victory') && this.stats.stamina > 0) this.fsm.set('guard');
    if (input.wasPressed('block') && this.fsm.is('attack') && this.move && this.windowsFired >= this.activeWindows().length) {
      this.endMove();
      this.fsm.set('guard');
    }

    if (input.wasPressed('interact') && this.interactTarget && this.fsm.is('idle', 'move', 'victory')) {
      this.fsm.set('interact');
    }
  }

  private regen(dt: number): void {
    const s = this.stats;
    this.clawCooldown = Math.max(0, this.clawCooldown - dt);
    this.riposte = Math.max(0, this.riposte - dt);
    if (!this.alive) return;
    s.mana = Math.min(s.maxMana, s.mana + 1.5 * dt);
    if (this.running && this.fsm.is('move')) {
      s.stamina = Math.max(0, s.stamina - RUN_COST * dt);
      this.staminaDelay = 0.5;
    } else if (this.fsm.is('attack', 'dodge', 'guard')) {
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
      const inCombo = this.fsm.is('attack') && this.move && COMBO.includes(this.move.id);
      let id: MoveId;
      if (inCombo) {
        id = COMBO[(this.comboIndex + 1) % COMBO.length];
      } else if (this.riposte > 0) {
        id = 'uppercut';
      } else if (this.running && this.fsm.is('move')) {
        id = 'leap';
      } else {
        id = 'attack1';
      }
      this.startMove(MOVES[id]);
      return true;
    }
    if (b === 'heavy') {
      if (s.stamina <= 0) return false;
      this.buffer = null;
      // Clic droit au milieu du combo : coup de pied brise-garde ; sinon tour complet.
      const branch = this.fsm.is('attack') && this.move && (this.move.id === 'attack1' || this.move.id === 'attack2');
      this.startMove(MOVES[branch ? 'kick' : 'heavy']);
      return true;
    }
    if (b === 'claw') {
      this.buffer = null;
      if (this.clawCooldown > 0 || s.mana < (MOVES.claw.mana ?? 0)) {
        this.ctx.events.emit('sfx', { name: 'denied' });
        return false;
      }
      this.clawCooldown = CLAW_COOLDOWN;
      this.startMove(MOVES.claw);
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

  // ------------------------------------------------------------- attaques pilotées par le sprite

  private activeWindows(): [number, number][] {
    return this.moveFd?.windows ?? [];
  }

  /** Portée mesurée sur le sprite pour une fenêtre (allonge maximale de ses frames). */
  private windowReach(w: [number, number]): number {
    const r = this.moveFd?.reach ?? [];
    let m = 0;
    for (let i = w[0]; i <= w[1]; i++) m = Math.max(m, r[i] ?? 0);
    return m;
  }

  private startMove(def: MoveDef): void {
    const fd = getKnightSheet().frameData?.get(def.anim) ?? null;
    this.move = def;
    this.moveFd = fd;
    this.windowsFired = 0;
    const ci = COMBO.indexOf(def.id);
    this.comboIndex = ci >= 0 ? ci : 0;
    const firstReach = fd && fd.windows.length ? this.windowReach(fd.windows[0]) : 2;
    this.facing = this.aimAngle(firstReach + (def.id === 'claw' ? CLAW_EXTRA_RANGE : 0));
    this.spendStamina(def.stamina);
    if (def.mana) this.stats.mana -= def.mana;
    this.riposte = 0;
    this.actor.anim.play(def.anim, true, def.speed);
    this.fsm.set('attack', true);
    const heavy = def.id === 'heavy' || def.id === 'kick';
    this.ctx.events.emit('playerAttack', { position: this.position.clone(), heavy });
    if (def.id === 'heavy') this.ctx.events.emit('sfx', { name: 'charge' });
  }

  private endMove(): void {
    this.move = null;
    this.moveFd = null;
  }

  /** Durée (s) d'une frame du coup en cours. */
  private frameTime(): number {
    const clip = this.actor.anim.clip;
    return 1 / (clip.fps * (this.move?.speed ?? 1));
  }

  private updateAttack(dt: number): PState | void {
    const def = this.move!;
    const anim = this.actor.anim;
    const frame = anim.frame;
    const windows = this.activeWindows();
    const last = windows.length ? windows[windows.length - 1][1] : Math.floor(anim.clip.count / 2);
    const fwd = this.forward;

    // Élan : léger pendant l'armé, plein jusqu'à la dernière frame active, puis arrêt net.
    const first = windows.length ? windows[0][0] : 0;
    const lungeK = frame < first - 1 ? 0.2 : frame <= last ? 1 : 0;
    this.velocity.x = damp(this.velocity.x, fwd.x * def.lunge * lungeK, 20, dt);
    this.velocity.z = damp(this.velocity.z, fwd.z * def.lunge * lungeK, 20, dt);

    if (def.id === 'heavy' && frame < first) {
      this.ctx.fx.aura(this.position, PAL.void3, 2, 0.9);
      this.ctx.fx.converge(this.position, PAL.void2, 3, 2.6);
    }

    // Une hitbox à l'entrée de chaque fenêtre active du sprite.
    while (this.windowsFired < windows.length && frame >= windows[this.windowsFired][0]) {
      const k = this.windowsFired++;
      const w = windows[k];
      if (frame > w[1] + 1) continue; // fenêtre sautée (ralentissement extrême) : pas de coup fantôme
      const range = this.windowReach(w) + (def.id === 'claw' ? CLAW_EXTRA_RANGE : 0);
      const hit = def.hits[Math.min(k, def.hits.length - 1)];
      this.ctx.combat.spawnHitbox(this, {
        angle: this.facing, arc: def.arc, range, offset: 0.4, hit,
        ttl: (w[1] - w[0] + 1) * this.frameTime() + 0.02,
      });
      this.ctx.events.emit('sfx', { name: def.sfx });
      this.moveVfx(def, k, range);
      if (def.shockwave && k === windows.length - 1) {
        const p = this.position.clone().addScaledVector(fwd, Math.min(range, 1.6));
        this.ctx.fx.shockwave(p, PAL.void2, def.shockwave);
        this.ctx.fx.dust(p, 12, 1.4);
        this.ctx.cameraRig.addTrauma(0.25);
        this.ctx.events.emit('sfx', { name: 'slam' });
      }
    }

    // Enchaînements : ouverts après la dernière frame active (+ délai propre au coup).
    if (frame > last + def.cancelDelay || anim.finished) {
      if (this.buffer && this.tryBuffered()) return;
    }
    if (anim.finished) {
      this.endMove();
      return this.moveDir.lengthSq() > 0 ? 'move' : 'idle';
    }
  }

  /** Effets de taille, à la portée mesurée sur le sprite. */
  private moveVfx(def: MoveDef, k: number, range: number): void {
    const fx = this.ctx.fx;
    const pos = this.position;
    const f = this.facing;
    switch (def.vfx) {
      case 'claw':
        for (const [r, j] of [[range - 0.6, 0], [range, 1], [range + 0.5, 2]] as const) {
          fx.slashArc(pos, f + def.arc - j * 0.08, -def.arc * 2, r, PAL.void1, PAL.void3, 0.26, 1.0 + j * 0.15);
        }
        fx.clawMarks(pos.clone().addScaledVector(this.forward, range * 0.8), f);
        fx.aura(pos.clone().addScaledVector(this.forward, range * 0.8), PAL.void3, 14, 1.2);
        break;
      case 'spin':
        fx.slashArc(pos, f, Math.PI * 2 * this.arcSign, range + 0.2, PAL.void1, PAL.void3, 0.34, 1.0);
        if (k > 0) {
          fx.slashArc(pos, f + 0.6, Math.PI * 2 * this.arcSign, range - 0.6, PAL.void0, PAL.void2, 0.38, 0.6);
          fx.crack(pos.clone().addScaledVector(this.forward, 1.2), PAL.void1, 1.3);
          this.ctx.cameraRig.punch(0.07);
        }
        fx.swordTrail(pos, f, range, PAL.void3, 20);
        break;
      case 'slam':
        fx.slashArc(pos, f - def.arc, def.arc * 2, range + 0.2, PAL.void1, PAL.void3, 0.26, 0.5);
        fx.crack(pos.clone().addScaledVector(this.forward, Math.min(range, 1.7)), PAL.void1, 1.1);
        this.ctx.cameraRig.punch(0.05);
        fx.swordTrail(pos, f, range, PAL.void2, 18);
        break;
      case 'kick':
      case 'uppercut':
        fx.shockwave(pos.clone().addScaledVector(this.forward, range * 0.8).setY(def.vfx === 'uppercut' ? 0.9 : 0.6), PAL.void2, 0.9);
        fx.dust(pos.clone().addScaledVector(this.forward, 0.6), 6, 0.8);
        break;
      default: {
        // Taille : l'arc alterne de sens à chaque coup (rafale comprise).
        this.arcSign *= -1;
        const big = def.vfx === 'flurry' && k === 2;
        fx.slashArc(pos, f - def.arc * this.arcSign, def.arc * 2 * this.arcSign, range + 0.15, PAL.void1, PAL.void3, big ? 0.26 : 0.22, big ? 0.6 : 1.2);
        fx.swordTrail(pos, f, range, PAL.void2, big ? 16 : 10);
        if (big) fx.crack(pos.clone().addScaledVector(this.forward, Math.min(range, 1.6)), PAL.void1, 0.9);
      }
    }
  }

  // ------------------------------------------------------------- garde et parade

  private updateGuard(dt: number): PState | void {
    this.guardTime += dt;
    // La garde suit la visée (souris) ; pas lents possibles.
    const aim = this.ctx.aimPoint;
    const dx = aim.x - this.position.x, dz = aim.z - this.position.z;
    if (dx * dx + dz * dz > 0.09) this.facing = Math.atan2(dz, dx);
    this.velocity.x = damp(this.velocity.x, this.moveDir.x * 1.4, 14, dt);
    this.velocity.z = damp(this.velocity.z, this.moveDir.z * 1.4, 14, dt);
    // Après l'impact sur la garde, revient à la pose de garde tenue.
    const anim = this.actor.anim;
    if (anim.baseName === 'guardHit' && anim.finished) anim.play('guard', true, 1);
    if (!this.ctx.input.isDown('block') || this.stats.stamina <= 0) return this.moveDir.lengthSq() > 0 ? 'move' : 'idle';
    // Riposte immédiate depuis la garde.
    if (this.buffer === 'dodge' || this.buffer === 'claw' || this.buffer === 'heavy' || this.buffer === 'light') {
      if (this.tryBuffered()) return;
    }
  }

  /** Le coup arrive-t-il de face (cône de 140°) ? */
  private facesAttacker(from: Entity): boolean {
    const a = Math.atan2(from.position.z - this.position.z, from.position.x - this.position.x);
    return Math.abs(angleDiff(this.facing, a)) < 1.22;
  }

  isBlocking(from: Entity, hit: HitInfo): boolean {
    return this.fsm.is('guard') && !hit.guardBreak && this.facesAttacker(from);
  }

  tryParry(from: Entity, _hit: HitInfo, ctx: GameContext): boolean {
    if (!this.fsm.is('guard') || this.guardTime > PARRY_WINDOW || !this.facesAttacker(from)) return false;
    this.ctx = ctx;
    // Parade parfaite : riposte possible (uppercut) et un peu d'endurance rendue.
    this.riposte = 0.8;
    this.stats.stamina = Math.min(this.stats.maxStamina, this.stats.stamina + 15);
    this.actor.anim.play('guardHit', true, 1.6);
    this.ctx.fx.aura(this.position, PAL.void3, 10, 1);
    return true;
  }

  private enterRoll(): void {
    this.dodgeDir.copy(this.moveDir.lengthSq() > 0 ? this.moveDir : this.forward);
    this.facing = Math.atan2(this.dodgeDir.z, this.dodgeDir.x);
    this.spendStamina(ROLL_COST);
    this.invulnerable = ROLL_IFRAMES;
    this.ghost = true;
    this.ghostTimer = 0;
    this.endMove();
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
    this.endMove();
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

  onHit(result: DamageResult, hit: HitInfo, from: Entity, ctx: GameContext): void {
    if (!this.alive) return;
    const dir = new THREE.Vector3().subVectors(this.position, from.position).setY(0).normalize();
    if (result.blocked && this.stats.hp > 0) {
      // Coup encaissé en garde : recul, endurance, l'épée vibre — pas d'interruption.
      this.flash(0.05);
      this.applyKnockback(dir, hit.knockback * 0.45);
      this.spendStamina(GUARD_COST);
      this.actor.anim.play('guardHit', true, 1.4);
      ctx.events.emit('sfx', { name: 'block' });
      ctx.fx.impact(this.center.clone().addScaledVector(dir, -0.5), dir.clone().negate(), 'enemy', false, true);
      if (this.stats.stamina <= 0) {
        ctx.events.emit('floatText', { text: 'GARDE BRISÉE', position: this.position.clone().setY(2.8), cls: 'crit' });
        this.fsm.set('hurt', true);
      }
      return;
    }
    this.flash(0.14);
    this.applyKnockback(dir, hit.knockback * 0.8);
    ctx.events.emit('sfx', { name: 'playerHurt' });
    if (this.stats.hp <= 0) {
      this.alive = false;
      ctx.combat.cancelHitboxes(this);
      this.fsm.set('dead');
      return;
    }
    this.invulnerable = 0.6;
    // Super-armure : une fois la première fenêtre active atteinte, le coup va au bout.
    const armored = this.fsm.is('attack') && !!this.move?.superArmor && this.windowsFired > 0;
    if (!armored) {
      ctx.combat.cancelHitboxes(this);
      this.endMove();
      this.fsm.set('hurt', true);
    }
  }
}
