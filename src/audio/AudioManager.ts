import * as THREE from 'three';
import type { AudioSettings } from '../core/Settings';
import { ProceduralMusic } from './music/ProceduralMusic';
import { SFX_GENERATORS } from './sfx/ProceduralSfx';

/**
 * Assets audio définitifs (optionnels). Associer un nom d'effet à une URL
 * suffit pour remplacer le placeholder synthétique correspondant, ex. :
 *   swing: new URL('../assets/audio/sfx/swing.ogg', import.meta.url).href
 */
const SFX_FILES: Record<string, string> = {};

/**
 * Système audio centralisé (Web Audio API).
 * Bus indépendants : maître → musique / effets / ambiance, avec une
 * réverbération de crypte partagée. Spatialisation simple : atténuation
 * selon la distance à Varyn et panoramique selon l'axe horizontal écran.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private ambience!: GainNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private musicGen: ProceduralMusic | null = null;
  private lastPlayed = new Map<string, number>();
  private readonly listener = new THREE.Vector3();
  private readonly screenRight = new THREE.Vector3(1, 0, 0);
  private settings: AudioSettings;

  constructor(settings: AudioSettings) {
    this.settings = settings;
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  /** Doit être appelé suite à un geste utilisateur (politique d'autoplay). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.8, 2.6);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.master);
    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.ambience = ctx.createGain();
    for (const bus of [this.music, this.sfx, this.ambience]) {
      bus.connect(this.master);
      bus.connect(this.reverbSend);
    }
    this.applySettings(this.settings);
    this.musicGen = new ProceduralMusic(ctx, this.music);
    this.musicGen.start();
    this.startAmbience();
    void this.loadFiles();
  }

  applySettings(s: AudioSettings): void {
    this.settings = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.05);
    this.music.gain.setTargetAtTime(s.music * 0.6, t, 0.05);
    this.sfx.gain.setTargetAtTime(s.sfx, t, 0.05);
    this.ambience.gain.setTargetAtTime(s.ambience * 0.5, t, 0.05);
  }

  setListener(pos: THREE.Vector3, screenRight: THREE.Vector3): void {
    this.listener.copy(pos);
    this.screenRight.copy(screenRight);
  }

  setMusicIntensity(v: number): void {
    this.musicGen?.setIntensity(v);
  }

  /** Coupe/rétablit globalement (pause du jeu). */
  setPaused(paused: boolean): void {
    if (!this.ctx) return;
    this.sfx.gain.setTargetAtTime(paused ? 0 : this.settings.sfx, this.ctx.currentTime, 0.05);
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private async loadFiles(): Promise<void> {
    const ctx = this.ctx!;
    for (const [name, url] of Object.entries(SFX_FILES)) {
      try {
        const res = await fetch(url);
        this.buffers.set(name, await ctx.decodeAudioData(await res.arrayBuffer()));
      } catch {
        /* le placeholder synthétique reste utilisé */
      }
    }
  }

  private getBuffer(name: string): AudioBuffer | null {
    const ctx = this.ctx!;
    let b = this.buffers.get(name);
    if (b) return b;
    const gen = SFX_GENERATORS[name];
    if (!gen) return null;
    const data = gen(ctx.sampleRate);
    b = ctx.createBuffer(1, data.length, ctx.sampleRate);
    b.copyToChannel(new Float32Array(data), 0);
    this.buffers.set(name, b);
    return b;
  }

  /** Pré-génère les effets pour éviter un à-coup au premier déclenchement. */
  warmup(): void {
    if (!this.ctx) return;
    for (const name of Object.keys(SFX_GENERATORS)) this.getBuffer(name);
  }

  play(name: string, opts: { volume?: number; position?: THREE.Vector3; pitch?: number; bus?: 'sfx' | 'ui' } = {}): void {
    const ctx = this.ctx;
    if (!ctx) return;
    // Anti-saturation : un même son ne se répète pas plus d'une fois toutes les 30 ms.
    const now = ctx.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -1) < 0.03) return;
    this.lastPlayed.set(name, now);
    const buf = this.getBuffer(name);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (opts.pitch ?? 1) * (0.94 + Math.random() * 0.12);
    const g = ctx.createGain();
    let vol = opts.volume ?? 1;
    const pan = ctx.createStereoPanner();
    if (opts.position) {
      const dx = opts.position.x - this.listener.x;
      const dz = opts.position.z - this.listener.z;
      const dist = Math.hypot(dx, dz);
      vol *= Math.max(0, 1 - dist / 28);
      pan.pan.value = Math.max(-0.8, Math.min(0.8, (dx * this.screenRight.x + dz * this.screenRight.z) / 12));
    }
    if (vol <= 0.01) return;
    g.gain.value = vol;
    src.connect(g).connect(pan).connect(this.sfx);
    src.start();
  }

  /** Ambiance de crypte : souffle grave filtré + gouttes d'eau occasionnelles. */
  private startAmbience(): void {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let y = 0;
    for (let i = 0; i < len; i++) {
      y += 0.02 * (Math.random() * 2 - 1 - y);
      d[i] = y * 3;
    }
    // Fondu aux extrémités pour une boucle sans clic.
    for (let i = 0; i < 2000; i++) {
      d[i] *= i / 2000;
      d[len - 1 - i] *= i / 2000;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(lp.frequency);
    src.connect(lp).connect(this.ambience);
    src.start();
    lfo.start();

    const drip = () => {
      if (!this.ctx) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const f = 900 + Math.random() * 900;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.08);
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      const p = ctx.createStereoPanner();
      p.pan.value = Math.random() * 1.6 - 0.8;
      o.connect(g).connect(p).connect(this.ambience);
      o.start(t);
      o.stop(t + 0.2);
      window.setTimeout(drip, 2500 + Math.random() * 6000);
    };
    window.setTimeout(drip, 3000);
  }
}
