/**
 * ⚠️ SONS TEMPORAIRES (placeholders) — synthétisés procéduralement.
 * Chaque effet est une fonction qui produit des échantillons PCM. Pour
 * passer aux assets définitifs, déposer des fichiers dans
 * `src/assets/audio/sfx/<nom>.ogg` et les déclarer dans `SFX_FILES`
 * (AudioManager) : le fichier remplacera automatiquement la version
 * synthétique portant le même nom.
 */
export type SfxGenerator = (sr: number) => Float32Array;

const rnd = () => Math.random() * 2 - 1;

function buffer(sr: number, seconds: number, fn: (t: number, i: number) => number): Float32Array {
  const n = Math.floor(sr * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / sr, i);
  return out;
}

/** Filtre passe-bas à un pôle appliqué en place (fréquence variable). */
function lowpass(data: Float32Array, sr: number, cutoff: (t: number) => number): Float32Array {
  let y = 0;
  for (let i = 0; i < data.length; i++) {
    const a = 1 - Math.exp((-2 * Math.PI * cutoff(i / sr)) / sr);
    y += a * (data[i] - y);
    data[i] = y;
  }
  return data;
}

function highpass(data: Float32Array, sr: number, cutoff: number): Float32Array {
  const low = lowpass(Float32Array.from(data), sr, () => cutoff);
  for (let i = 0; i < data.length; i++) data[i] -= low[i];
  return data;
}

const env = (t: number, a: number, d: number) => (t < a ? t / a : Math.exp(-(t - a) / d));

function whoosh(sr: number, dur: number, f0: number, f1: number, gain: number): Float32Array {
  const d = buffer(sr, dur, () => rnd());
  lowpass(d, sr, (t) => f0 + (f1 - f0) * Math.sin(Math.min(1, t / dur) * Math.PI));
  highpass(d, sr, 200);
  return d.map((v, i) => {
    const t = i / sr;
    return v * gain * Math.sin(Math.min(1, t / dur) * Math.PI) ** 1.5;
  });
}

function thump(sr: number, dur: number, f0: number, f1: number, gain: number): Float32Array {
  let ph = 0;
  return buffer(sr, dur, (t) => {
    const f = f1 + (f0 - f1) * Math.exp(-t * 18);
    ph += (2 * Math.PI * f) / sr;
    return Math.sin(ph) * gain * Math.exp(-t / (dur * 0.35));
  });
}

function mix(...parts: Float32Array[]): Float32Array {
  const n = Math.max(...parts.map((p) => p.length));
  const out = new Float32Array(n);
  for (const p of parts) for (let i = 0; i < p.length; i++) out[i] += p[i];
  return out;
}

function bell(sr: number, dur: number, freqs: number[], decay: number, gain: number): Float32Array {
  return buffer(sr, dur, (t) => {
    let v = 0;
    freqs.forEach((f, k) => (v += Math.sin(2 * Math.PI * f * t) * Math.exp(-t / (decay / (1 + k * 0.4))) / (k + 1)));
    return v * gain * Math.min(1, t * 400);
  });
}

function noiseBurst(sr: number, dur: number, cutoff: number, gain: number): Float32Array {
  const d = buffer(sr, dur, (t) => rnd() * Math.exp(-t / (dur * 0.25)));
  lowpass(d, sr, () => cutoff);
  return d.map((v) => v * gain);
}

export const SFX_GENERATORS: Record<string, SfxGenerator> = {
  swing: (sr) => whoosh(sr, 0.2, 600, 3200, 0.9),
  swingHeavy: (sr) => mix(whoosh(sr, 0.32, 300, 1800, 1.1), thump(sr, 0.3, 140, 60, 0.3)),
  enemySwing: (sr) => whoosh(sr, 0.16, 800, 2600, 0.5),
  dodge: (sr) => whoosh(sr, 0.22, 1200, 5000, 0.55),
  roll: (sr) => mix(whoosh(sr, 0.35, 300, 1600, 0.6), thump(sr, 0.2, 120, 60, 0.35), lowpass(buffer(sr, 0.3, (t) => rnd() * 0.3 * Math.exp(-t * 8)), sr, () => 700)),
  soulAbsorb: (sr) => bell(sr, 0.5, [1046, 1568], 0.12, 0.18),
  boneHit: (sr) =>
    mix(
      noiseBurst(sr, 0.12, 4000, 0.9),
      thump(sr, 0.18, 220, 80, 0.7),
      buffer(sr, 0.08, (t) => (Math.random() < 0.02 ? rnd() : 0) * Math.exp(-t * 30)),
    ),
  block: (sr) => mix(bell(sr, 0.5, [523, 1231, 1873, 2467], 0.12, 0.5), noiseBurst(sr, 0.05, 6000, 0.6)),
  playerHurt: (sr) => {
    let ph = 0;
    const grunt = buffer(sr, 0.28, (t) => {
      ph += (2 * Math.PI * (120 - t * 120)) / sr;
      return Math.tanh(Math.sin(ph) * 3) * 0.35 * env(t, 0.01, 0.08);
    });
    return mix(lowpass(grunt, sr, () => 900), thump(sr, 0.25, 160, 50, 0.8), noiseBurst(sr, 0.1, 2500, 0.5));
  },
  step: (sr) => lowpass(buffer(sr, 0.08, (t) => rnd() * Math.exp(-t * 60) * 0.7), sr, () => 500),
  rattle: (sr) =>
    buffer(sr, 0.3, (t) => {
      const click = Math.random() < 0.004 ? 1 : 0;
      return click * rnd() * 0.8 * Math.exp(-t * 6);
    }).map((v, i, a) => v + (i > 0 ? a[i - 1] * 0.6 : 0)),
  claw: (sr) => {
    let ph = 0;
    const sweep = buffer(sr, 0.45, (t) => {
      ph += (2 * Math.PI * (300 + t * 1600)) / sr;
      return Math.sin(ph + Math.sin(ph * 2.01) * 2) * 0.3 * env(t, 0.05, 0.12);
    });
    return mix(sweep, whoosh(sr, 0.3, 1500, 6000, 0.6), noiseBurst(sr, 0.2, 3000, 0.3));
  },
  slam: (sr) => mix(thump(sr, 0.7, 120, 35, 1.1), noiseBurst(sr, 0.4, 900, 0.8)),
  charge: (sr) => {
    let ph = 0;
    return buffer(sr, 0.45, (t) => {
      ph += (2 * Math.PI * (90 + t * 260)) / sr;
      return (Math.sin(ph) + Math.sin(ph * 1.5) * 0.5) * 0.25 * Math.min(1, t * 6) * (1 - t / 0.45);
    });
  },
  soul: (sr) =>
    buffer(sr, 1.2, (t) => {
      const vib = Math.sin(t * 30) * 4;
      return (Math.sin(2 * Math.PI * (660 + vib) * t) + Math.sin(2 * Math.PI * (990 + vib) * t) * 0.6) * 0.12 * env(t, 0.15, 0.35);
    }),
  pickup: (sr) => mix(bell(sr, 0.5, [880, 1760], 0.15, 0.3), bell(sr, 0.5, [1318], 0.2, 0.25).map((v, i) => (i > sr * 0.07 ? v : 0))),
  denied: (sr) => buffer(sr, 0.14, (t) => Math.sign(Math.sin(2 * Math.PI * 110 * t)) * 0.18 * (1 - t / 0.14)),
  enemyWindup: (sr) => {
    const d = buffer(sr, 0.4, () => rnd());
    lowpass(d, sr, (t) => 800 + t * 5000);
    return highpass(d, sr, 600).map((v, i) => v * 0.35 * Math.min(1, i / sr / 0.3));
  },
  rise: (sr) => mix(lowpass(buffer(sr, 0.9, (t) => rnd() * 0.6 * env(t, 0.2, 0.3)), sr, () => 300), SFX_GENERATORS.rattle(sr)),
  waveStart: (sr) => mix(bell(sr, 2.2, [73.4, 146.8, 220, 293.6, 349], 0.9, 0.5), thump(sr, 1, 90, 40, 0.6)),
  levelUp: (sr) => {
    const notes = [293.66, 349.23, 440, 587.33];
    return mix(...notes.map((f, k) => bell(sr, 1.2, [f, f * 2], 0.4, 0.22).map((v, i) => (i > k * sr * 0.09 ? v : 0))));
  },
  playerDeath: (sr) => {
    let ph = 0;
    const fall = buffer(sr, 2.5, (t) => {
      ph += (2 * Math.PI * (110 * Math.exp(-t * 0.6))) / sr;
      return Math.sin(ph) * 0.4 * env(t, 0.05, 0.8);
    });
    return mix(fall, thump(sr, 1.2, 100, 30, 0.9), bell(sr, 2.5, [73.4, 87.3, 110], 1, 0.3));
  },
  interact: (sr) => mix(bell(sr, 0.8, [392, 784, 1175], 0.25, 0.25), noiseBurst(sr, 0.2, 1200, 0.2)),
  uiClick: (sr) => mix(noiseBurst(sr, 0.03, 3000, 0.4), bell(sr, 0.12, [1200], 0.03, 0.2)),
  uiHover: (sr) => bell(sr, 0.08, [1800], 0.02, 0.08),
  message: (sr) => bell(sr, 1, [587, 880], 0.35, 0.2),
};
