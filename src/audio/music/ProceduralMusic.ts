/**
 * ⚠️ MUSIQUE TEMPORAIRE — générée en temps réel (Web Audio).
 * Deux couches mixées selon l'intensité :
 *  - exploration : bourdon grave, nappes de chœur en ré mineur, cloche éparse ;
 *  - combat : percussions graves (type taiko) et ostinato tendu.
 * À remplacer par des pistes enregistrées (voir audio/README.md).
 */
const D_MINOR = [146.83, 164.81, 174.61, 196.0, 220.0, 233.08, 261.63, 293.66];
const CHORDS = [
  [73.42, 110.0, 146.83, 174.61], // Rém
  [58.27, 87.31, 116.54, 146.83], // Sib
  [65.41, 98.0, 130.81, 155.56], // Do (mixolydien sombre)
  [55.0, 82.41, 110.0, 138.59], // La (dominante)
];

export class ProceduralMusic {
  private readonly explore: GainNode;
  private readonly combat: GainNode;
  private intensity = 0;
  private targetIntensity = 0;
  private timer: number | null = null;
  private nextBar = 0;
  private bar = 0;
  private readonly bpm = 76;

  constructor(
    private readonly ctx: AudioContext,
    out: AudioNode,
  ) {
    this.explore = ctx.createGain();
    this.combat = ctx.createGain();
    this.explore.gain.value = 0.9;
    this.combat.gain.value = 0;
    this.explore.connect(out);
    this.combat.connect(out);
  }

  start(): void {
    if (this.timer !== null) return;
    this.nextBar = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 200);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  /** 0 = exploration, 1 = combat intense. */
  setIntensity(v: number): void {
    this.targetIntensity = v;
  }

  private get barLength(): number {
    return (60 / this.bpm) * 4;
  }

  private schedule(): void {
    const now = this.ctx.currentTime;
    this.intensity += (this.targetIntensity - this.intensity) * 0.08;
    this.combat.gain.setTargetAtTime(this.intensity * 0.9, now, 0.5);
    this.explore.gain.setTargetAtTime(0.9 - this.intensity * 0.35, now, 0.5);
    while (this.nextBar < now + 1.2) {
      this.scheduleBar(this.nextBar, this.bar);
      this.nextBar += this.barLength;
      this.bar++;
    }
  }

  private scheduleBar(t: number, bar: number): void {
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
    const len = this.barLength;
    // Bourdon + nappe.
    if (bar % 2 === 0) for (const f of chord) this.pad(t, len * 2, f, 0.05);
    this.pad(t, len, 36.71, 0.07, 'sawtooth', 160);
    // Cloche éparse, mélodie modale.
    if (bar % 2 === 1 || Math.random() < 0.4) {
      const f = D_MINOR[Math.floor(Math.random() * D_MINOR.length)] * 2;
      this.bell(t + (len / 4) * Math.floor(Math.random() * 4), f, 0.06);
    }
    // Couche de combat.
    const beat = 60 / this.bpm;
    for (let b = 0; b < 8; b++) {
      const tt = t + (b * beat) / 2;
      if (b === 0 || b === 3 || b === 4 || (b === 6 && bar % 2 === 1)) this.drum(tt, b === 0 ? 0.9 : 0.55);
      const note = chord[b % 2 === 0 ? 1 : 2] * (b % 4 === 3 ? 2 : 1);
      this.pluck(tt, note * 2, 0.07);
    }
  }

  private pad(t: number, dur: number, f: number, gain: number, type: OscillatorType = 'sawtooth', cutoff = 700): void {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    lp.Q.value = 0.7;
    for (const detune of [-7, 6]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    lp.connect(g);
    g.connect(this.explore);
  }

  private bell(t: number, f: number, gain: number): void {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    for (const [ratio, amp] of [[1, 1], [2.76, 0.4], [5.4, 0.15]] as const) {
      const o = c.createOscillator();
      const og = c.createGain();
      og.gain.value = amp;
      o.frequency.value = f * ratio;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 3);
    }
    g.connect(this.explore);
  }

  private drum(t: number, gain: number): void {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
    g.gain.setValueAtTime(gain * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(this.combat);
    o.start(t);
    o.stop(t + 0.55);
  }

  private pluck(t: number, f: number, gain: number): void {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.2);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(lp).connect(g).connect(this.combat);
    o.start(t);
    o.stop(t + 0.3);
  }
}
