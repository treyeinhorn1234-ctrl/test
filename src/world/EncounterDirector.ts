import * as THREE from 'three';
import type { GameContext } from '../core/GameContext';
import type { Enemy } from '../enemies/Enemy';
import { Skeleton } from '../enemies/Skeleton';

type Phase = 'intro' | 'fighting' | 'calm';

/**
 * Directeur de rencontres du prototype : les gardiens squelettes se
 * relèvent par vagues de plus en plus nombreuses et coriaces. Les points
 * d'apparition proches de Varyn sont évités pour rester équitable.
 */
export class EncounterDirector {
  wave = 0;
  private phase: Phase = 'intro';
  private timer = 4;
  private pending = 0;
  private spawnTimer = 0;
  private spawnedThisWave = 0;
  private waveSize = 0;

  constructor(
    private readonly spawn: (e: Enemy) => void,
    private readonly alive: () => number,
  ) {}

  reset(): void {
    this.wave = 0;
    this.phase = 'intro';
    this.timer = 4;
    this.pending = 0;
    this.spawnedThisWave = 0;
  }

  get remaining(): number {
    return this.pending + this.alive();
  }

  get calmTimeLeft(): number {
    return this.phase === 'fighting' ? 0 : Math.max(0, this.timer);
  }

  private startWave(ctx: GameContext): void {
    this.wave++;
    this.waveSize = Math.min(2 + this.wave, 8);
    this.pending = this.waveSize;
    this.spawnedThisWave = 0;
    this.spawnTimer = 0;
    this.phase = 'fighting';
    ctx.attackTokens.max = this.wave >= 4 ? 3 : 2;
    ctx.events.emit('waveStarted', { wave: this.wave, count: this.waveSize });
    ctx.events.emit('sfx', { name: 'waveStart' });
  }

  private pickSpawn(ctx: GameContext): THREE.Vector3 {
    const spawns = ctx.level.enemySpawns;
    const far = spawns.filter((s) => s.distanceTo(ctx.player.position) > 7);
    const pool = far.length > 0 ? far : spawns;
    const base = pool[Math.floor(Math.random() * pool.length)];
    const p = base.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0, (Math.random() - 0.5) * 1.2));
    ctx.level.collision.resolveCircle(p, 0.5);
    return p;
  }

  update(dt: number, ctx: GameContext): void {
    if (!ctx.player.alive) return;
    if (this.phase !== 'fighting') {
      this.timer -= dt;
      if (this.timer <= 0) this.startWave(ctx);
      this.emitObjective(ctx);
      return;
    }
    if (this.pending > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 0.55;
        this.pending--;
        this.spawnedThisWave++;
        const p = this.pickSpawn(ctx);
        this.spawn(new Skeleton(p, this.wave));
        ctx.fx.dust(p, 14, 1.2);
        ctx.events.emit('sfx', { name: 'rise', position: p });
      }
    } else if (this.alive() === 0) {
      this.phase = 'calm';
      this.timer = 7;
      ctx.events.emit('waveCleared', { wave: this.wave });
    }
    this.emitObjective(ctx);
  }

  private lastObjective = '';

  private emitObjective(ctx: GameContext): void {
    let title: string;
    let detail: string;
    if (this.phase === 'fighting') {
      title = `Vague ${this.wave} — Les gardiens se relèvent`;
      detail = `Squelettes restants : ${this.remaining}`;
    } else if (this.phase === 'intro') {
      title = 'Réveil dans la crypte';
      detail = `Les morts s'agitent… (${Math.ceil(this.timer)})`;
    } else {
      title = `Vague ${this.wave} repoussée`;
      detail = `Prochaine vague dans ${Math.ceil(this.timer)} s`;
    }
    const key = title + detail;
    if (key !== this.lastObjective) {
      this.lastObjective = key;
      ctx.events.emit('objective', { title, detail });
    }
  }
}
