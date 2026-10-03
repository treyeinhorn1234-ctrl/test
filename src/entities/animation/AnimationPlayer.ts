import type { ClipInfo } from './SpriteSheet';

/** Tout ce qui fournit une table de clips (planche ou rendu en direct). */
export interface ClipSource {
  clips: Map<string, ClipInfo>;
}

/**
 * Lecteur d'animation image par image. Pilote un index de frame à partir
 * d'un clip de la planche, avec vitesse variable, boucle et événements.
 */
export class AnimationPlayer {
  clip: ClipInfo;
  /** Nom logique du clip (sans suffixe de direction). */
  baseName: string;
  private _back = false;
  private time = 0;
  frame = 0;
  speed = 1;
  finished = false;
  private pendingEvents: string[] = [];

  constructor(private readonly sheet: ClipSource, initial: string) {
    this.clip = this.get(initial);
    this.baseName = initial;
  }

  /** Vue de dos : utilise la variante « @back » d'un clip quand elle existe. */
  get back(): boolean {
    return this._back;
  }

  set back(v: boolean) {
    if (v === this._back) return;
    this._back = v;
    const resolved = this.resolve(this.baseName);
    if (resolved !== this.clip.name) {
      // Change de variante sans perdre la progression.
      this.clip = this.get(resolved);
      this.frame = Math.min(this.frame, this.clip.count - 1);
    }
  }

  private resolve(name: string): string {
    if (this._back && this.sheet.clips.has(`${name}@back`)) return `${name}@back`;
    return name;
  }

  private get(name: string): ClipInfo {
    const c = this.sheet.clips.get(name);
    if (!c) throw new Error(`Animation inconnue : ${name}`);
    return c;
  }

  has(name: string): boolean {
    return this.sheet.clips.has(name);
  }

  /** Lance un clip. `restart` force le redémarrage s'il est déjà joué. */
  play(name: string, restart = false, speed = 1): void {
    this.speed = speed;
    if (this.baseName === name && !restart) return;
    this.baseName = name;
    this.clip = this.get(this.resolve(name));
    this.time = 0;
    this.frame = 0;
    this.finished = false;
    this.fire(0);
  }

  /** Joue un clip en l'étirant pour qu'il dure exactement `duration` secondes. */
  playFor(name: string, duration: number): void {
    const c = this.get(name);
    this.play(name, true, c.count / c.fps / Math.max(0.01, duration));
  }

  /** Progression normalisée 0..1 dans le clip courant. */
  get progress(): number {
    return Math.min(1, (this.time * this.clip.fps) / this.clip.count);
  }

  private fire(frame: number): void {
    const ev = this.clip.events[frame];
    if (ev) this.pendingEvents.push(ev);
  }

  update(dt: number): void {
    if (this.finished) return;
    this.time += dt * this.speed;
    const duration = this.clip.count / this.clip.fps;
    if (this.clip.loop) this.time = ((this.time % duration) + duration) % duration;
    else if (this.time < 0) this.time = 0;
    let f = Math.floor(this.time * this.clip.fps);
    if (f >= this.clip.count) {
      if (this.clip.loop) {
        f = this.clip.count - 1;
      } else {
        f = this.clip.count - 1;
        this.finished = true;
      }
    }
    if (f !== this.frame) {
      this.frame = f;
      this.fire(f);
    }
  }

  consumeEvents(): string[] {
    const e = this.pendingEvents;
    this.pendingEvents = [];
    return e;
  }
}
