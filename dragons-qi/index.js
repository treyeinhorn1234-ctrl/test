/* =========================================================================
 *  DRAGON'S QI — platformer / side-scroller pixel art wuxia
 *  Rendu : Three.js (WebGL) en 320×180, agrandi sans interpolation.
 *  Tous les graphismes (sauf le héros, planches « FREE Samurai 2D Pixel Art »)
 *  sont générés procéduralement ; les sons et la musique sont synthétisés
 *  avec la Web Audio API.
 *
 *  Sommaire
 *    1. Configuration          7. Joueur
 *    2. Utilitaires / police   8. Ennemis, projectiles, objets
 *    3. Entrées                9. Boss
 *    4. Audio                 10. Niveaux (données + construction), caméra
 *    5. Rendu (sprites, particules)  11. Jeu (états, HUD, menus)
 *    6. Génération des graphismes    12. Boucle principale
 * ========================================================================= */
'use strict';

// =========================================================================
// 1. CONFIGURATION
// =========================================================================
const CONFIG = {
  W: 320,
  H: 180,
  TILE: 16,
  FIXED_DT: 1 / 60,
  GRAVITY: 980,
  MAX_FALL: 380,
  RUN_SPEED: 118,
  ACCEL: 1250,
  AIR_ACCEL: 850,
  FRICTION: 1500,
  JUMP_VEL: 305,
  DOUBLE_JUMP_VEL: 275,
  COYOTE: 0.09,
  JUMP_BUFFER: 0.12,
  WALL_SLIDE: 55,
  DASH_SPEED: 330,
  DASH_TIME: 0.17,
  DASH_COOLDOWN: 0.55,
  QI_MAX: 100,
  QI_COST: 30,
  QI_COOLDOWN: 0.9,
  QI_REGEN: 2.5,
  INVULN: 1.1,
  THREE_URLS: [
    'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js',
    'https://unpkg.com/three@0.186.1/build/three.module.js',
  ],
};
const W = CONFIG.W, H = CONFIG.H, TILE = CONFIG.TILE;

// Palette principale (rouge sombre, vermillon, or, noir, bambou, nuit, violet, ivoire)
const PAL = {
  black: '#120a10', ink: '#1d1220', darkRed: '#5a0f17', red: '#9c1d22', vermilion: '#e0412b',
  orange: '#f07a2a', gold: '#f2b53a', goldLight: '#ffe08a', goldDark: '#a8641c', bronze: '#7a4a22',
  bamboo: '#4f9a3c', bambooLight: '#8fd05a', bambooDark: '#2a5a2c', forest: '#173a2a',
  night: '#1b2346', nightDeep: '#0d1028', blue: '#3a5a9c', violet: '#6b3a8c', violetLight: '#a466c4',
  violetDark: '#33193f', ivory: '#efe6cf', ivoryDark: '#bdb29a', white: '#fffaf0', jade: '#3ecf8e',
  jadeDark: '#1f7a55', jadeLight: '#9cf5c8', qi: '#7fe3ff', qiDark: '#2f8fc4', stone: '#6d6a72',
  stoneDark: '#45424d', stoneLight: '#9a96a0', skin: '#e8b48a', skinDark: '#b8794f', wood: '#7a4a2a',
  woodDark: '#4a2a18', woodLight: '#a8703c', pink: '#f59ac0',
};

// =========================================================================
// 2. UTILITAIRES
// =========================================================================
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function approach(v, target, delta) {
  return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
}
// Générateur pseudo-aléatoire déterministe (décors reproductibles)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hexToRgb(hex) {
  const n = typeof hex === 'number' ? hex : parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hexNum(hex) { return typeof hex === 'number' ? hex : parseInt(hex.slice(1), 16); }
function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const k = (v) => clamp(Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)), 0, 255);
  return '#' + ((1 << 24) | (k(r) << 16) | (k(g) << 8) | k(b)).toString(16).slice(1);
}
function mix(h1, h2, t) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  const k = (i) => Math.round(lerp(a[i], b[i], t));
  return '#' + ((1 << 24) | (k(0) << 16) | (k(1) << 8) | k(2)).toString(16).slice(1);
}

// ---- Police bitmap 3×5 (rendu net en basse résolution) ----
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001110',
  '.': '000000000000010', ',': '000000000010100', '!': '010010010000010', '?': '110001010000010',
  ':': '000010000010000', '-': '000000111000000', '+': '000010111010000', "'": '010010000000000',
  '/': '001001010100100', '(': '010100100100010', ')': '010001001001010', '[': '110100100100110',
  ']': '011001001001011', '%': '101001010100101', '=': '000111000111000', '<': '001010100010001',
  '>': '100010001010100', '*': '101010101000000', '"': '101101000000000', '#': '101111101111101',
  '_': '000000000000111', '|': '010010010010010', ' ': '000000000000000',
  '↑': '010111010010010', '↓': '010010010111010', '←': '001010111010001', '→': '100010111010100',
};
function normalizeText(s) {
  return String(s)
    .replace(/Œ/g, 'OE').replace(/œ/g, 'oe').replace(/…/g, '...')
    .replace(/[’‘]/g, "'").replace(/[«»“”]/g, '"').replace(/[—–]/g, '-')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}
function textWidth(s, scale = 1) {
  return Math.max(0, normalizeText(s).length * 4 * scale - scale);
}
function drawGlyphs(ctx, s, x, y, color, scale) {
  ctx.fillStyle = color;
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]] || FONT['?'];
    const gx = x + i * 4 * scale;
    for (let r = 0; r < 5; r++) {
      let run = -1;
      for (let c = 0; c <= 3; c++) {
        const on = c < 3 && g[r * 3 + c] === '1';
        if (on && run < 0) run = c;
        if (!on && run >= 0) {
          ctx.fillRect(gx + run * scale, y + r * scale, (c - run) * scale, scale);
          run = -1;
        }
      }
    }
  }
}
function drawText(ctx, str, x, y, color = PAL.ivory, scale = 1, align = 'left', shadow = PAL.black) {
  const s = normalizeText(str);
  const w = s.length * 4 * scale - scale;
  if (align === 'center') x = Math.round(x - w / 2);
  else if (align === 'right') x = Math.round(x - w);
  if (shadow) drawGlyphs(ctx, s, x + (scale > 1 ? scale : 0), y + scale, shadow, scale);
  drawGlyphs(ctx, s, x, y, color, scale);
  return w;
}
function wrapText(str, maxChars) {
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      if ((line + ' ' + word).trim().length > maxChars) {
        if (line) out.push(line);
        line = word;
      } else line = (line + ' ' + word).trim();
    }
    out.push(line);
  }
  return out;
}

// =========================================================================
// 3. ENTRÉES CLAVIER
// =========================================================================
const PREVENT_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.any = false;
    this.onFirstInput = null;
    this.bindings = {
      left: ['ArrowLeft', 'KeyA', 'KeyQ'],
      right: ['ArrowRight', 'KeyD'],
      up: ['ArrowUp', 'KeyW', 'KeyZ'],
      down: ['ArrowDown', 'KeyS'],
      jump: ['Space'],
      attack: ['KeyJ'],
      special: ['KeyK'],
      dash: ['ShiftLeft', 'ShiftRight'],
      pause: ['Escape', 'KeyP'],
      confirm: ['Enter', 'NumpadEnter', 'Space', 'KeyJ'],
      back: ['Escape', 'Backspace'],
      interact: ['KeyE', 'ArrowUp', 'KeyW', 'KeyZ'],
      mute: ['KeyM'],
    };
    window.addEventListener('keydown', (e) => {
      if (PREVENT_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.pressed.add(e.code);
        this.any = true;
      }
      this.down.add(e.code);
      if (this.onFirstInput) this.onFirstInput();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    window.addEventListener('pointerdown', () => { if (this.onFirstInput) this.onFirstInput(); });
  }
  held(action) {
    for (const c of this.bindings[action]) if (this.down.has(c)) return true;
    return false;
  }
  hit(action) {
    for (const c of this.bindings[action]) if (this.pressed.has(c)) return true;
    return false;
  }
  axis() { return (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0); }
  endStep() {
    this.pressed.clear();
    this.any = false;
  }
}

// =========================================================================
// 4. AUDIO — effets et musique synthétisés (Web Audio API)
// =========================================================================
const MUSIC_TRACKS = {
  menu: { tempo: 72, root: 146.83, scale: [0, 2, 4, 7, 9], density: 0.35, seed: 11, drums: 0, pad: 'sine' },
  forest: { tempo: 92, root: 220.0, scale: [0, 2, 4, 7, 9], density: 0.5, seed: 21, drums: 1, pad: 'triangle' },
  temple: { tempo: 84, root: 164.81, scale: [0, 3, 5, 7, 10], density: 0.45, seed: 31, drums: 1, pad: 'sawtooth' },
  mountain: { tempo: 100, root: 196.0, scale: [0, 2, 4, 7, 9], density: 0.55, seed: 41, drums: 1, pad: 'triangle' },
  dragon: { tempo: 88, root: 146.83, scale: [0, 3, 5, 7, 10], density: 0.5, seed: 51, drums: 1, pad: 'sawtooth' },
  boss: { tempo: 132, root: 130.81, scale: [0, 3, 5, 6, 7, 10], density: 0.6, seed: 61, drums: 2, pad: 'sawtooth' },
  victory: { tempo: 96, root: 261.63, scale: [0, 2, 4, 7, 9], density: 0.55, seed: 71, drums: 0, pad: 'sine' },
};

class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastPlayed = {};
    this.track = null;
    this.pending = null;
    this.timer = null;
  }
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.mus = this.ctx.createGain();
    this.mus.gain.value = 0.32;
    this.mus.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.timer = setInterval(() => this.tickMusic(), 40);
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      this.playMusic(p);
    }
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
  }
  tone(f, dur, type = 'square', vol = 0.15, f2 = 0, delay = 0, dest = null) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  noise(dur, vol = 0.2, freq = 2000, type = 'lowpass', freq2 = 0, delay = 0, q = 1, dest = null) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest || this.sfx);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.03);
  }
  play(name) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (this.lastPlayed[name] && now - this.lastPlayed[name] < 0.03) return;
    this.lastPlayed[name] = now;
    switch (name) {
      case 'jump': this.tone(260, 0.12, 'square', 0.08, 520); break;
      case 'doubleJump': this.tone(420, 0.16, 'triangle', 0.14, 980); this.noise(0.12, 0.05, 3000, 'highpass'); break;
      case 'land': this.noise(0.07, 0.08, 500); break;
      case 'attack': this.noise(0.09, 0.13, 6000, 'bandpass', 1500, 0, 2); this.tone(900, 0.07, 'sine', 0.05, 300); break;
      case 'attack3': this.noise(0.16, 0.18, 7000, 'bandpass', 900, 0, 1.5); this.tone(600, 0.15, 'sawtooth', 0.06, 180); break;
      case 'hit': this.tone(190, 0.12, 'square', 0.12, 70); this.noise(0.1, 0.2, 1800); break;
      case 'kill': this.tone(300, 0.25, 'sawtooth', 0.1, 50); this.noise(0.3, 0.2, 1200, 'lowpass', 200); break;
      case 'hurt': this.tone(240, 0.3, 'sawtooth', 0.15, 60); this.noise(0.18, 0.18, 900); break;
      case 'dash': this.noise(0.2, 0.18, 400, 'bandpass', 4000, 0, 3); break;
      case 'coin': this.tone(988, 0.07, 'square', 0.06); this.tone(1319, 0.14, 'square', 0.06, 0, 0.06); break;
      case 'orb': [523, 659, 784].forEach((f, i) => this.tone(f, 0.15, 'sine', 0.1, 0, i * 0.05)); break;
      case 'heal': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.1, 0, i * 0.06)); break;
      case 'relic': [587, 740, 880, 1175, 1480].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.09, 0, i * 0.08)); break;
      case 'special':
        this.tone(160, 0.45, 'sawtooth', 0.1, 900);
        this.tone(320, 0.4, 'sine', 0.12, 1400);
        this.noise(0.4, 0.15, 800, 'bandpass', 5000, 0, 2);
        break;
      case 'noQi': this.tone(150, 0.12, 'square', 0.07, 110); break;
      case 'bounce': this.tone(180, 0.22, 'sine', 0.2, 620); break;
      case 'crumble': this.noise(0.35, 0.12, 700, 'lowpass', 150); break;
      case 'break': this.noise(0.25, 0.25, 3000, 'lowpass', 300); this.tone(700, 0.08, 'square', 0.04, 1400); break;
      case 'checkpoint':
        [660, 990, 1320].forEach((f, i) => this.tone(f, 1.2, 'sine', 0.08, 0, i * 0.12));
        break;
      case 'bell': this.tone(392, 2.2, 'sine', 0.18); this.tone(588, 1.6, 'sine', 0.08); this.tone(1046, 0.8, 'sine', 0.04); break;
      case 'select': this.tone(660, 0.06, 'square', 0.06); break;
      case 'confirm': this.tone(523, 0.08, 'square', 0.07); this.tone(784, 0.14, 'square', 0.07, 0, 0.07); break;
      case 'enemyShot': this.tone(500, 0.18, 'sawtooth', 0.05, 200); this.noise(0.15, 0.06, 2500, 'bandpass'); break;
      case 'slam': this.tone(90, 0.4, 'sine', 0.35, 35); this.noise(0.45, 0.3, 600, 'lowpass', 80); break;
      case 'roar':
        this.tone(110, 1.1, 'sawtooth', 0.16, 45);
        this.tone(165, 1.0, 'square', 0.06, 60);
        this.noise(1.1, 0.25, 500, 'lowpass', 120);
        break;
      case 'thunder': this.noise(0.9, 0.35, 1500, 'lowpass', 90); this.tone(70, 0.6, 'sine', 0.3, 30); break;
      case 'explode': this.noise(0.6, 0.35, 1400, 'lowpass', 60); this.tone(120, 0.4, 'sine', 0.3, 30); break;
      case 'death':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.12, f * 0.7, i * 0.16));
        this.noise(0.8, 0.12, 900, 'lowpass', 100);
        break;
      case 'fragment':
        [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.08, 0, i * 0.09));
        break;
      case 'gate': this.noise(0.6, 0.25, 300, 'lowpass', 80); this.tone(80, 0.5, 'square', 0.08, 50); break;
      case 'talk': this.tone(rand(500, 700), 0.04, 'square', 0.03); break;
      case 'upgrade': [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.25, 'square', 0.06, 0, i * 0.05)); break;
    }
  }
  // ---- Musique : séquenceur pentatonique procédural ----
  playMusic(name) {
    if (!this.ctx) {
      this.pending = name;
      return;
    }
    if (this.track && this.track.name === name) return;
    this.stopMusic();
    const def = MUSIC_TRACKS[name];
    if (!def) return;
    const rng = mulberry32(def.seed);
    const steps = 64;
    const melody = [], bass = [];
    let deg = 2;
    for (let i = 0; i < steps; i++) {
      const strong = i % 4 === 0;
      if (rng() < (strong ? def.density + 0.25 : def.density * 0.6)) {
        deg = clamp(deg + Math.round((rng() - 0.5) * 4), 0, def.scale.length * 2 - 1);
        melody.push(deg);
      } else melody.push(-1);
      bass.push(i % 16 === 0 ? 0 : i % 16 === 8 ? (rng() < 0.5 ? 3 : 4) % def.scale.length : -1);
    }
    const t = this.ctx.currentTime + 0.1;
    const padGain = this.ctx.createGain();
    padGain.gain.setValueAtTime(0.0001, t);
    padGain.gain.exponentialRampToValueAtTime(0.05, t + 2);
    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 500;
    padFilter.connect(padGain);
    padGain.connect(this.mus);
    const pads = [def.root / 2, (def.root / 2) * Math.pow(2, 7 / 12)].map((f) => {
      const o = this.ctx.createOscillator();
      o.type = def.pad;
      o.frequency.value = f;
      o.detune.value = rand(-6, 6);
      o.connect(padFilter);
      o.start(t);
      return o;
    });
    this.track = { name, def, melody, bass, step: 0, next: t, pads, padGain };
  }
  stopMusic() {
    if (!this.track || !this.ctx) {
      this.track = null;
      return;
    }
    const t = this.ctx.currentTime;
    const tr = this.track;
    tr.padGain.gain.cancelScheduledValues(t);
    tr.padGain.gain.setValueAtTime(tr.padGain.gain.value, t);
    tr.padGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    tr.pads.forEach((o) => o.stop(t + 0.7));
    this.track = null;
  }
  noteFreq(def, deg) {
    const n = def.scale.length;
    const oct = Math.floor(deg / n);
    return def.root * Math.pow(2, (def.scale[deg % n] + 12 * oct) / 12);
  }
  pluck(f, t, vol) {
    const c = this.ctx;
    const o1 = c.createOscillator(), o2 = c.createOscillator();
    o1.type = 'triangle';
    o2.type = 'square';
    o1.frequency.value = f;
    o2.frequency.value = f * 2.001;
    const flt = c.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(f * 6, t);
    flt.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.4);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    const g2 = c.createGain();
    g2.gain.value = 0.18;
    o1.connect(flt);
    o2.connect(g2);
    g2.connect(flt);
    flt.connect(g);
    g.connect(this.mus);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 1);
    o2.stop(t + 1);
  }
  tickMusic() {
    const tr = this.track;
    if (!tr || !this.ctx) return;
    const stepDur = 60 / tr.def.tempo / 4;
    while (tr.next < this.ctx.currentTime + 0.2) {
      const i = tr.step % 64, t = tr.next;
      const m = tr.melody[i];
      if (m >= 0) this.pluck(this.noteFreq(tr.def, m + 5), t, 0.16);
      const b = tr.bass[i];
      if (b >= 0) {
        const f = this.noteFreq(tr.def, b) / 2;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 7);
        o.connect(g);
        g.connect(this.mus);
        o.start(t);
        o.stop(t + stepDur * 8);
      }
      if (tr.def.drums) {
        const kick = tr.def.drums === 2 ? i % 4 === 0 || i % 16 === 10 : i % 16 === 0 || i % 16 === 11;
        if (kick) {
          const o = this.ctx.createOscillator(), g = this.ctx.createGain();
          o.frequency.setValueAtTime(tr.def.drums === 2 ? 110 : 90, t);
          o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
          g.gain.setValueAtTime(0.5, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
          o.connect(g);
          g.connect(this.mus);
          o.start(t);
          o.stop(t + 0.32);
        }
        if (i % 8 === 4) this.noise(0.05, tr.def.drums === 2 ? 0.12 : 0.06, 3000, 'bandpass', 0, t - this.ctx.currentTime, 4, this.mus);
      }
      tr.next += stepDur;
      tr.step++;
    }
  }
}

// =========================================================================
// 5. RENDU — canvas → textures, sprites, lueurs, particules
// =========================================================================
let THREE = null; // chargé dynamiquement au démarrage (CDN)

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}
function canvasTexture(canvas, repeat = false) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace;
  if (repeat) t.wrapS = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

// ---- Primitives pixel (aucun anticrénelage) ----
function rect(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function ellipse(ctx, cx, cy, rx, ry, c) {
  ctx.fillStyle = c;
  for (let dy = -ry; dy <= ry; dy++) {
    const dx = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5)))));
    ctx.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2 + 1, 1);
  }
}
function disc(ctx, cx, cy, r, c) { ellipse(ctx, cx, cy, r, r, c); }
function line(ctx, x0, y0, x1, y1, c, w = 1) {
  ctx.fillStyle = c;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
// Polygone rempli par balayage (bords nets)
function poly(ctx, pts, c) {
  ctx.fillStyle = c;
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x0 = Math.round(xs[i]), x1 = Math.round(xs[i + 1]);
      if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, 1);
    }
  }
}
// Dégradé en bandes tramées (rendu 16 bits)
function bandGradient(ctx, x, y, w, h, colors) {
  const n = colors.length - 1;
  for (let yy = 0; yy < h; yy++) {
    const t = (yy / h) * n;
    const i = Math.min(n - 1, Math.floor(t));
    const f = t - i;
    const steps = 4;
    const q = Math.floor(f * steps) / steps;
    const c = mix(colors[i], colors[i + 1], q);
    const next = mix(colors[i], colors[i + 1], Math.min(1, q + 1 / steps));
    const frac = f * steps - Math.floor(f * steps);
    ctx.fillStyle = c;
    ctx.fillRect(x, y + yy, w, 1);
    if (frac > 0.5) {
      ctx.fillStyle = next;
      for (let xx = (yy % 2); xx < w; xx += 2) ctx.fillRect(x + xx, y + yy, 1, 1);
    }
  }
}
// Contour sombre d'un pixel autour des formes opaques
function outlineCanvas(ctx, w, h, color = PAL.black) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const out = new Uint8ClampedArray(d);
  const [r, g, b] = hexToRgb(color);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] >= 128) {
        out[i + 3] = 255;
        continue;
      }
      out[i + 3] = 0;
      if (
        (x > 0 && d[i - 1] >= 128) || (x < w - 1 && d[i + 7] >= 128) ||
        (y > 0 && d[i - w * 4 + 3] >= 128) || (y < h - 1 && d[i + w * 4 + 3] >= 128)
      ) {
        out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(new ImageData(out, w, h), 0, 0);
}

// ---- Planche de sprites (frames de taille fixe) ----
class Sheet {
  constructor(canvas, fw, fh, count) {
    this.canvas = canvas;
    this.tex = canvasTexture(canvas);
    this.fw = fw;
    this.fh = fh;
    this.count = count;
    this.cols = Math.max(1, Math.floor(canvas.width / fw));
    this.tw = canvas.width;
    this.th = canvas.height;
  }
  rect(i, out) {
    i = clamp(i | 0, 0, this.count - 1);
    const c = i % this.cols, r = Math.floor(i / this.cols);
    out.set((c * this.fw) / this.tw, 1 - ((r + 1) * this.fh) / this.th, this.fw / this.tw, this.fh / this.th);
  }
}
function buildSheet(fw, fh, count, drawFrame, outline = PAL.black) {
  const cols = Math.max(1, Math.min(count, Math.floor(2048 / fw)));
  const rows = Math.ceil(count / cols);
  const [c, ctx] = makeCanvas(cols * fw, rows * fh);
  for (let i = 0; i < count; i++) {
    ctx.save();
    ctx.translate((i % cols) * fw, Math.floor(i / cols) * fh);
    ctx.beginPath();
    ctx.rect(0, 0, fw, fh);
    ctx.clip();
    drawFrame(ctx, i, fw, fh);
    ctx.restore();
  }
  if (outline) outlineCanvas(ctx, c.width, c.height, outline);
  return new Sheet(c, fw, fh, count);
}

const GEO_CACHE = new Map();
function planeGeo(w, h) {
  const key = w + 'x' + h;
  let g = GEO_CACHE.get(key);
  if (!g) {
    g = new THREE.PlaneGeometry(w, h);
    g.translate(w / 2, -h / 2, 0); // origine en haut à gauche
    GEO_CACHE.set(key, g);
  }
  return g;
}

const SPRITE_VS = `
uniform vec4 uvRect;
uniform float flipX;
varying vec2 vUv;
varying vec2 vLocal;
void main() {
  vec2 u = uv;
  if (flipX > 0.5) u.x = 1.0 - u.x;
  vLocal = u;
  vUv = uvRect.xy + u * uvRect.zw;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SPRITE_FS = `
uniform sampler2D map;
uniform float flash;
uniform vec3 flashColor;
uniform vec3 tint;
uniform float opacity;
uniform float dissolve;
uniform vec2 texSize;
varying vec2 vUv;
varying vec2 vLocal;
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.5) discard;
  if (dissolve > 0.0) {
    vec2 cell = floor(vLocal * texSize);
    float n = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    if (n < dissolve) discard;
  }
  vec3 col = mix(c.rgb * tint, flashColor, flash);
  gl_FragColor = vec4(col, c.a * opacity);
}`;

// Sprite animé (quad Three.js + planche de frames)
class Sprite {
  constructor(parent, sheet, order = 10, additive = false) {
    this.sheet = sheet;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: sheet.tex },
        uvRect: { value: new THREE.Vector4() },
        flipX: { value: 0 },
        flash: { value: 0 },
        flashColor: { value: new THREE.Color(1, 1, 1) },
        tint: { value: new THREE.Color(1, 1, 1) },
        opacity: { value: 1 },
        dissolve: { value: 0 },
        texSize: { value: new THREE.Vector2(sheet.fw, sheet.fh) },
      },
      vertexShader: SPRITE_VS,
      fragmentShader: SPRITE_FS,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(planeGeo(sheet.fw, sheet.fh), this.material);
    this.mesh.renderOrder = order;
    this.u = this.material.uniforms;
    this.frame = -1;
    this.parent = parent;
    parent.add(this.mesh);
    this.setFrame(0);
  }
  setFrame(i) {
    if (i === this.frame) return;
    this.frame = i;
    this.sheet.rect(i, this.u.uvRect.value);
  }
  setSheet(sheet) {
    if (sheet === this.sheet) return;
    this.sheet = sheet;
    this.u.map.value = sheet.tex;
    this.u.texSize.value.set(sheet.fw, sheet.fh);
    this.mesh.geometry = planeGeo(sheet.fw, sheet.fh);
    this.frame = -1;
    this.setFrame(0);
  }
  setPos(x, y) { this.mesh.position.set(Math.round(x), -Math.round(y), 0); }
  setFlip(f) { this.u.flipX.value = f ? 1 : 0; }
  set visible(v) { this.mesh.visible = v; }
  get visible() { return this.mesh.visible; }
  setTint(hex) { this.u.tint.value.setHex(hexNum(hex)); }
  setFlash(v, hex = 0xffffff) { this.u.flash.value = v; this.u.flashColor.value.setHex(hex); }
  setOpacity(v) { this.u.opacity.value = v; }
  setDissolve(v) { this.u.dissolve.value = v; }
  dispose() {
    this.parent.remove(this.mesh);
    this.material.dispose();
  }
}

// Halo lumineux additif (lanternes, torches, Qi)
class Glow {
  constructor(parent, size, color, intensity = 0.5, flicker = 0.15) {
    this.sprite = new Sprite(parent, ART.glow, 19, true);
    this.size = size;
    this.sprite.mesh.scale.set(size / 32, size / 32, 1);
    this.sprite.setTint(color);
    this.intensity = intensity;
    this.flicker = flicker;
    this.phase = Math.random() * 10;
    this.x = 0;
    this.y = 0;
  }
  setCenter(x, y) {
    this.x = x;
    this.y = y;
    this.sprite.mesh.position.set(Math.round(x - this.size / 2), -Math.round(y - this.size / 2), 0);
  }
  update(t) {
    const f = 1 - this.flicker + this.flicker * (0.5 + 0.5 * Math.sin(t * 9 + this.phase) * Math.sin(t * 3.7 + this.phase * 2));
    this.sprite.setOpacity(this.intensity * f);
  }
  dispose() { this.sprite.dispose(); }
}

// ---- Système de particules (pool + THREE.Points) ----
class Particle {
  constructor() { this.reset(); }
  reset() {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.life = 0; this.max = 1; this.size = 1;
    this.r = 1; this.g = 1; this.b = 1; this.a = 1;
    this.grav = 0; this.drag = 0; this.shrink = false; this.flicker = false;
    return this;
  }
}
const POINTS_VS = `
attribute float psize;
attribute vec4 pcolor;
varying vec4 vColor;
void main() {
  vColor = pcolor;
  gl_PointSize = psize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const POINTS_FS = `
varying vec4 vColor;
void main() { gl_FragColor = vColor; }`;

class ParticleSystem {
  constructor(parent, max, additive, order) {
    this.max = max;
    this.pool = Array.from({ length: max }, () => new Particle());
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.siz = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSiz = new THREE.BufferAttribute(this.siz, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('pcolor', this.aCol);
    g.setAttribute('psize', this.aSiz);
    this.geometry = g;
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      vertexShader: POINTS_VS,
      fragmentShader: POINTS_FS,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = order;
    parent.add(this.points);
  }
  spawn(x, y, vx, vy, life, size, color) {
    if (this.count >= this.max) return null;
    const p = this.pool[this.count++].reset();
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = p.max = life;
    p.size = size;
    const n = hexNum(color);
    p.r = ((n >> 16) & 255) / 255; p.g = ((n >> 8) & 255) / 255; p.b = (n & 255) / 255;
    return p;
  }
  update(dt) {
    for (let i = 0; i < this.count; i++) {
      const p = this.pool[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pool[i] = this.pool[this.count - 1];
        this.pool[this.count - 1] = p;
        this.count--;
        i--;
        continue;
      }
      p.vy += p.grav * dt;
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
  sync() {
    for (let i = 0; i < this.count; i++) {
      const p = this.pool[i];
      const t = p.life / p.max;
      let s = p.shrink ? Math.max(1, Math.round(p.size * (0.4 + 0.6 * t))) : p.size;
      const a = p.flicker ? (Math.random() < 0.5 ? 1 : 0.4) * Math.min(1, t * 2) : Math.min(1, t * 2.2) * p.a;
      this.pos[i * 3] = Math.floor(p.x) + s / 2;
      this.pos[i * 3 + 1] = -(Math.floor(p.y) + s / 2);
      this.pos[i * 3 + 2] = 0;
      this.col[i * 4] = p.r; this.col[i * 4 + 1] = p.g; this.col[i * 4 + 2] = p.b; this.col[i * 4 + 3] = a;
      this.siz[i] = s;
    }
    this.geometry.setDrawRange(0, this.count);
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aSiz.needsUpdate = true;
  }
  clear() { this.count = 0; }
}

// Bande animée qui se répète (eau, brume, cascades, liquides dangereux)
class ScrollStrip {
  constructor(parent, sheetCanvas, x, y, w, h, order, speedX = 0, speedY = 0, opacity = 1) {
    this.tex = canvasTexture(sheetCanvas, true);
    this.tex.wrapT = THREE.RepeatWrapping;
    this.tex.repeat.set(w / sheetCanvas.width, h / sheetCanvas.height);
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, opacity, alphaTest: 0.01 });
    this.mesh = new THREE.Mesh(planeGeo(w, h), this.mat);
    this.mesh.position.set(Math.round(x), -Math.round(y), 0);
    this.mesh.renderOrder = order;
    this.cw = sheetCanvas.width;
    this.ch = sheetCanvas.height;
    this.sx = speedX;
    this.sy = speedY;
    this.parent = parent;
    parent.add(this.mesh);
  }
  update(t) {
    this.tex.offset.x = Math.round(t * this.sx) / this.cw;
    this.tex.offset.y = Math.round(t * this.sy) / this.ch;
  }
  dispose() {
    this.parent.remove(this.mesh);
    this.mat.dispose();
    this.tex.dispose();
  }
}

// Couche de parallaxe : quad fixé à l'écran dont la texture défile
class ParallaxLayer {
  constructor(parent, canvas, fx, fy, offY, order, opacity = 1, drift = 0) {
    this.tex = canvasTexture(canvas, true);
    this.cw = canvas.width;
    this.ch = canvas.height;
    this.tex.repeat.set(W / this.cw, 1);
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, opacity, alphaTest: 0.01 });
    this.mesh = new THREE.Mesh(planeGeo(W, this.ch), this.mat);
    this.mesh.renderOrder = order;
    this.fx = fx;
    this.fy = fy;
    this.offY = offY;
    this.drift = drift;
    this.parent = parent;
    parent.add(this.mesh);
  }
  update(camX, camY, t) {
    const sx = Math.round(camX * this.fx + t * this.drift);
    this.tex.offset.x = (((sx % this.cw) + this.cw) % this.cw) / this.cw;
    const screenY = Math.round(this.offY - camY * this.fy);
    this.mesh.position.set(Math.round(camX), -(Math.round(camY) + screenY), 0);
  }
  dispose() {
    this.parent.remove(this.mesh);
    this.mat.dispose();
    this.tex.dispose();
  }
}

// =========================================================================
// 6. GÉNÉRATION DES GRAPHISMES (pixel art procédural)
// =========================================================================
const ART = {};

// Le héros : planches « FREE Samurai 2D Pixel Art » (frames 96×96)
const PLAYER_ANIMS = {
  idle: { start: 0, n: 10, fps: 8 },
  run: { start: 16, n: 16, fps: 20 },
  attack: { start: 32, n: 7 },
  hurt: { start: 48, n: 4, fps: 10 },
};
function buildPlayerSheet(images) {
  const [c, ctx] = makeCanvas(96 * 16, 96 * 4);
  ['IDLE', 'RUN', 'ATTACK', 'HURT'].forEach((k, row) => {
    if (images[k]) ctx.drawImage(images[k], 0, row * 96);
  });
  return new Sheet(c, 96, 96, 64);
}

// ---- Palettes des ennemis (variantes par niveau) ----
const STYLE_PALETTES = {
  soldier: { skin: '#c9a07a', eye: '#d26bff', armor: '#3a3446', armorDark: '#24202e', trim: '#9c1d22', cloth: '#5a0f17', clothDark: '#3a0a10', pants: '#2a2633', pantsDark: '#1c1a24', boot: '#1a1210', metal: '#c8ccd8', metalLight: '#ffffff', hilt: '#a8641c', magic: '#d26bff' },
  ghost: { skin: '#bfe8ff', eye: '#ffffff', armor: '#6aa8c8', armorDark: '#3f7092', trim: '#a8e8ff', cloth: '#4a86a8', clothDark: '#2f5e7a', pants: '#3f7092', pantsDark: '#2f5e7a', boot: '#24486a', metal: '#e8fbff', metalLight: '#ffffff', hilt: '#a8e8ff', magic: '#7fe3ff' },
  statue: { skin: '#8a8790', eye: '#3ecf8e', armor: '#6d6a72', armorDark: '#45424d', trim: '#3ecf8e', cloth: '#5a5762', clothDark: '#3c3a44', pants: '#5a5762', pantsDark: '#45424d', boot: '#3c3a44', metal: '#9a96a0', metalLight: '#c8c4cc', hilt: '#45424d', magic: '#3ecf8e' },
  monk: { skin: '#9a5a7a', eye: '#ffde4a', armor: '#c4521e', armorDark: '#8a3412', trim: '#f2b53a', cloth: '#e0682a', clothDark: '#a8461a', pants: '#8a3412', pantsDark: '#6a260c', boot: '#3a1a10', metal: '#f2b53a', metalLight: '#ffe08a', hilt: '#5a2a10', magic: '#ff7a2a' },
  celestial: { skin: '#5a7ad8', eye: '#ffde4a', armor: '#2a3a7a', armorDark: '#1a2452', trim: '#f2b53a', cloth: '#3a2a6a', clothDark: '#24184a', pants: '#1a2452', pantsDark: '#121a3a', boot: '#0d1028', metal: '#d8e0ff', metalLight: '#ffffff', hilt: '#f2b53a', magic: '#7fe3ff' },
  guard: { skin: '#3a2440', eye: '#ff4a8a', armor: '#c89a2a', armorDark: '#8a6418', trim: '#6b3a8c', cloth: '#4a2460', clothDark: '#33193f', pants: '#33193f', pantsDark: '#24102e', boot: '#1a0a20', metal: '#f2e0ff', metalLight: '#ffffff', hilt: '#6b3a8c', magic: '#c46bff' },
  sorcerer: { skin: '#e8d0f0', eye: '#ff4a8a', armor: '#4a2460', armorDark: '#33193f', trim: '#f2b53a', cloth: '#6b3a8c', clothDark: '#4a2460', pants: '#33193f', pantsDark: '#24102e', boot: '#1a0a20', metal: '#f2b53a', metalLight: '#ffe08a', hilt: '#33193f', magic: '#c46bff' },
};
const IMP_PALETTES = {
  red: { body: '#c8322a', dark: '#7a1a18', belly: '#f08a5a', horn: '#efe6cf', eye: '#ffde4a', light: '#f0645a' },
  purple: { body: '#7a3aa8', dark: '#45206a', belly: '#c48ae0', horn: '#ffe08a', eye: '#7fffb0', light: '#a466c4' },
  fire: { body: '#e0682a', dark: '#8a2a12', belly: '#ffd27a', horn: '#3a1a10', eye: '#ffffff', light: '#ffa04a' },
  void: { body: '#2a1a40', dark: '#120a1e', belly: '#6b3a8c', horn: '#f2b53a', eye: '#ff4a8a', light: '#4a3070' },
};
const SPIRIT_PALETTES = {
  wisp: { body: '#4fcf6a', light: '#b8ffb0', dark: '#1f7a3a', eye: '#0d2a14' },
  ghostflame: { body: '#4a8acf', light: '#bfe8ff', dark: '#24486a', eye: '#0d1028' },
  wind: { body: '#bfe8ff', light: '#ffffff', dark: '#5a9ac8', eye: '#1b2346' },
  bat: { body: '#5a2a4a', light: '#a85a8a', dark: '#2a1020', eye: '#ffde4a' },
  void: { body: '#8a3ac8', light: '#e0a8ff', dark: '#3a1060', eye: '#ffde4a' },
};

// ---- Petit démon (BasicDemon) 20×20 : 0-3 marche, 4 bond, 5 touché ----
function drawImp(ctx, f, p) {
  const bob = f < 4 ? [0, 1, 0, 1][f] : 0;
  const lunge = f === 4 ? 2 : 0;
  const hurt = f === 5;
  const by = 12 + bob - (f === 4 ? 2 : 0);
  // queue
  line(ctx, 4, by + 1, 2, by - 3, p.dark);
  rect(ctx, 1, by - 5, 2, 2, p.dark);
  // jambes
  const lg = [[0, 0], [-1, 1], [0, 0], [1, -1]][f % 4];
  if (f === 4) {
    rect(ctx, 5, by + 3, 3, 2, p.dark);
    rect(ctx, 12, by + 4, 3, 2, p.dark);
  } else {
    rect(ctx, 7 + lg[0], by + 4, 2, 3, p.dark);
    rect(ctx, 11 + lg[1], by + 4, 2, 3, p.dark);
  }
  // corps
  ellipse(ctx, 10 + lunge, by, 6, 5, p.body);
  rect(ctx, 6 + lunge, by - 4, 6, 1, p.light);
  ellipse(ctx, 11 + lunge, by + 2, 3, 2, p.belly);
  // cornes
  rect(ctx, 6 + lunge, by - 6, 1, 2, p.horn);
  rect(ctx, 5 + lunge, by - 7, 1, 1, p.horn);
  rect(ctx, 13 + lunge, by - 6, 1, 2, p.horn);
  rect(ctx, 14 + lunge, by - 7, 1, 1, p.horn);
  // yeux + gueule
  if (hurt) {
    rect(ctx, 11, by - 2, 1, 1, PAL.white);
    rect(ctx, 13, by - 2, 1, 1, PAL.white);
  } else {
    rect(ctx, 11 + lunge, by - 2, 2, 2, p.eye);
    rect(ctx, 14 + lunge, by - 2, 1, 2, p.eye);
    rect(ctx, 12 + lunge, by - 2, 1, 1, PAL.black);
  }
  rect(ctx, 12 + lunge, by + 1, 4, 1, PAL.black);
  rect(ctx, 13 + lunge, by + 2, 1, 1, PAL.white);
  rect(ctx, 15 + lunge, by + 2, 1, 1, PAL.white);
  // griffes
  if (f === 4) {
    rect(ctx, 16, by - 1, 3, 2, p.dark);
    rect(ctx, 18, by - 2, 1, 1, PAL.white);
  } else rect(ctx, 15 + lunge, by + 1, 2, 2, p.dark);
}

// ---- Guerrier humanoïde 32×32 : 0-3 marche, 4 armé, 5 frappe, 6 touché, 7 sort ----
function drawWarrior(ctx, f, p, style) {
  const bob = f < 4 ? f % 2 : 0;
  const lean = f === 5 ? 2 : f === 4 ? -1 : f === 6 ? -2 : 0;
  const by = bob;
  const cx = 12 + lean;
  const legs = [[-2, 2], [0, 0], [2, -2], [0, 0]];
  const [l1, l2] = f < 4 ? legs[f] : f === 5 ? [3, -3] : f === 4 ? [-1, 2] : [-2, 1];
  const robe = style.robe;
  // cape / cheveux fantômes
  if (style.cape) poly(ctx, [[cx - 3, 10 + by], [cx - 1, 10 + by], [cx - 4, 25], [cx - 9 - bob, 26]], p.clothDark);
  // jambes
  rect(ctx, cx - 3 + l2, 21, 3, 7, p.pantsDark);
  rect(ctx, cx - 3 + l2, 28, 4, 2, p.boot);
  rect(ctx, cx + l1, 21, 3, 7, p.pants);
  rect(ctx, cx + l1, 28, 4, 2, p.boot);
  // longue tunique
  if (robe) poly(ctx, [[cx - 5, 15 + by], [cx + 5, 15 + by], [cx + 7, 28], [cx - 7, 28]], p.cloth);
  else poly(ctx, [[cx - 5, 16 + by], [cx + 5, 16 + by], [cx + 6, 25], [cx - 6, 25]], p.cloth);
  rect(ctx, cx - (robe ? 7 : 6), robe ? 27 : 24, robe ? 14 : 12, 1, p.clothDark);
  rect(ctx, cx - 1, 18 + by, 2, robe ? 9 : 6, p.clothDark);
  // torse
  rect(ctx, cx - 4, 9 + by, 9, 8, p.armor);
  if (!robe) {
    rect(ctx, cx - 4, 11 + by, 9, 1, p.armorDark);
    rect(ctx, cx - 4, 14 + by, 9, 1, p.armorDark);
    rect(ctx, cx - 6, 9 + by, 3, 3, p.armor);
    rect(ctx, cx - 6, 11 + by, 3, 1, p.trim);
  } else {
    line(ctx, cx - 2, 9 + by, cx + 2, 15 + by, p.armorDark);
  }
  // ceinture
  rect(ctx, cx - 4, 16 + by, 9, 2, p.trim);
  rect(ctx, cx, 16 + by, 2, 2, PAL.gold);
  // tête
  rect(ctx, cx - 2, 2 + by, 6, 7, p.skin);
  rect(ctx, cx + 3, 5 + by, 1, 2, p.skin);
  if (f === 6) rect(ctx, cx + 1, 5 + by, 2, 1, PAL.black);
  else {
    rect(ctx, cx + 1, 5 + by, 2, 1, p.eye);
    rect(ctx, cx + 3, 5 + by, 1, 1, p.eye);
  }
  rect(ctx, cx + 1, 7 + by, 2, 1, shade(p.skin, -0.35));
  // couvre-chef
  switch (style.hat) {
    case 'helmet':
      rect(ctx, cx - 3, 1 + by, 8, 3, p.armor);
      rect(ctx, cx - 3, 3 + by, 8, 1, p.trim);
      rect(ctx, cx - 3, 4 + by, 2, 4, p.armor);
      rect(ctx, cx, 0 + by, 2, 1, p.trim);
      break;
    case 'bald':
      rect(ctx, cx - 1, 2 + by, 3, 1, shade(p.skin, 0.25));
      for (let i = 0; i < 5; i++) rect(ctx, cx - 3 + i * 2, 10 + by + (i % 2), 1, 1, PAL.gold);
      break;
    case 'stone':
      rect(ctx, cx - 3, 0 + by, 8, 3, p.armorDark);
      rect(ctx, cx - 4, 2 + by, 10, 1, p.armor);
      line(ctx, cx - 3, 10 + by, cx, 14 + by, p.trim);
      line(ctx, cx + 3, 18 + by, cx + 1, 22, p.trim);
      break;
    case 'horned':
      rect(ctx, cx - 3, 1 + by, 8, 2, p.armor);
      rect(ctx, cx - 3, 0 + by, 1, 1, p.metalLight);
      rect(ctx, cx + 4, 0 + by, 1, 1, p.metalLight);
      rect(ctx, cx - 4, 1 + by, 1, 1, p.metalLight);
      rect(ctx, cx + 5, 1 + by, 1, 1, p.metalLight);
      break;
    case 'crown':
      rect(ctx, cx - 3, 1 + by, 8, 3, p.armor);
      rect(ctx, cx - 5, 0 + by, 2, 2, p.armor);
      rect(ctx, cx + 5, 0 + by, 2, 2, p.armor);
      rect(ctx, cx, 1 + by, 2, 1, p.trim);
      break;
    case 'hood':
      rect(ctx, cx - 3, 1 + by, 8, 3, p.cloth);
      rect(ctx, cx - 4, 3 + by, 2, 7, p.cloth);
      rect(ctx, cx - 3, 1 + by, 8, 1, p.trim);
      break;
    case 'topknot':
      rect(ctx, cx - 3, 1 + by, 7, 2, '#1a1418');
      rect(ctx, cx - 3, 3 + by, 2, 4, '#1a1418');
      rect(ctx, cx - 1, 0 + by, 3, 1, '#1a1418');
      break;
  }
  // bras + arme
  const wp = style.weapon;
  const drawBlade = (x0, y0, x1, y1) => {
    if (wp === 'halberd') {
      line(ctx, x0 - (x1 - x0) * 0.3, y0 - (y1 - y0) * 0.3, x1, y1, PAL.wood);
      const dx = sign(x1 - x0), dy = sign(y1 - y0);
      rect(ctx, x1 - 1 + dx, y1 - 1 + dy, 3, 3, p.metal);
      rect(ctx, x1 + dx * 2, y1 + dy * 2, 1, 1, p.metalLight);
    } else if (wp === 'dao') {
      line(ctx, x0, y0, x1, y1, p.metal);
      line(ctx, x0 + (x1 - x0) * 0.5, y0 + (y1 - y0) * 0.5 + 1, x1, y1 + 1, p.metal);
      rect(ctx, x0, y0, 2, 2, p.hilt);
    } else if (wp === 'fist') {
      rect(ctx, x0, y0, 3, 3, p.armorDark);
    }
  };
  if (f < 4) {
    rect(ctx, cx + 2, 10 + by, 2, 6, p.armor);
    rect(ctx, cx + 2, 16 + by, 2, 2, p.skin);
    if (wp === 'halberd') {
      line(ctx, cx + 4, 2, cx + 4, 28, PAL.wood);
      rect(ctx, cx + 3, 1, 3, 3, p.metal);
      rect(ctx, cx + 5, 2, 2, 4, p.metal);
    } else drawBlade(cx + 3, 17 + by, cx + 10, 22 + by);
  } else if (f === 4) {
    rect(ctx, cx - 2, 4 + by, 2, 6, p.armor);
    rect(ctx, cx - 3, 3 + by, 2, 2, p.skin);
    drawBlade(cx - 3, 3, cx - 10, 7);
  } else if (f === 5) {
    rect(ctx, cx + 3, 10, 6, 2, p.armor);
    rect(ctx, cx + 9, 10, 2, 2, p.skin);
    drawBlade(cx + 10, 11, cx + 17, 14);
    for (let i = 0; i < 6; i++) {
      const a = -1.2 + i * 0.45;
      rect(ctx, cx + 8 + Math.cos(a) * 9, 13 + Math.sin(a) * 10, 1, 1, p.metalLight);
    }
  } else if (f === 6) {
    rect(ctx, cx - 6, 8 + by, 2, 4, p.armor);
    rect(ctx, cx + 4, 8, 2, 4, p.armor);
  } else if (f === 7) {
    rect(ctx, cx + 3, 10, 5, 2, p.armor);
    rect(ctx, cx + 8, 10, 2, 2, p.skin);
    disc(ctx, cx + 12, 11, 2, p.magic);
    rect(ctx, cx + 12, 10, 1, 1, PAL.white);
  }
}

// ---- Esprit volant 20×20 : 0-3 vol, 4 attaque, 5 touché ----
function drawSpirit(ctx, f, kind, p) {
  const t = f % 4;
  const atk = f === 4, hurt = f === 5;
  if (kind === 'bat') {
    const up = t % 2 === 0;
    const wy = atk ? 4 : up ? 3 : 16;
    poly(ctx, [[9, 10], [1, wy], [4, 12], [7, 13]], p.dark);
    poly(ctx, [[11, 10], [19, wy], [16, 12], [13, 13]], p.dark);
    line(ctx, 9, 10, 2, wy + (up ? 1 : -1), p.light);
    line(ctx, 11, 10, 18, wy + (up ? 1 : -1), p.light);
    ellipse(ctx, 10, 11, 3, 4, p.body);
    rect(ctx, 9, 5, 4, 4, p.body);
    rect(ctx, 13, 7, 3, 1, PAL.gold);
    rect(ctx, 11, 6, 1, 1, hurt ? PAL.white : p.eye);
    rect(ctx, 8, 15, 1, 2, p.dark);
    rect(ctx, 11, 15, 1, 2, p.dark);
    return;
  }
  if (kind === 'wind') {
    const r = atk ? 8 : 7;
    disc(ctx, 10, 10, r, p.dark);
    disc(ctx, 10, 10, r - 2, p.body);
    for (let i = 0; i < 3; i++) {
      const a = t * 0.8 + i * 2.1;
      rect(ctx, 10 + Math.cos(a) * (r - 1), 10 + Math.sin(a) * (r - 1), 2, 2, p.light);
    }
    rect(ctx, 6, 8, 8, 4, PAL.ivory);
    rect(ctx, 7, 9, 2, 1, hurt ? PAL.vermilion : p.eye);
    rect(ctx, 11, 9, 2, 1, hurt ? PAL.vermilion : p.eye);
    rect(ctx, 9, 11, 2, 1, PAL.vermilion);
    return;
  }
  // flamme (wisp, ghostflame, void)
  const sway = [0, 1, 0, -1][t];
  poly(ctx, [[5, 11], [10 + sway, 1 + (t % 2)], [15, 11]], p.body);
  poly(ctx, [[7, 11], [9 - sway, 4], [12, 11]], p.light);
  ellipse(ctx, 10, 12, 5, 5, p.body);
  ellipse(ctx, 10, 13, 3, 3, p.light);
  rect(ctx, 6 + sway, 17, 2, 2, p.body);
  rect(ctx, 12 - sway, 17, 2, 1, p.body);
  if (kind === 'void') {
    disc(ctx, 10, 12, 2, PAL.white);
    rect(ctx, 10, 12, 1, 1, atk ? PAL.vermilion : p.eye);
  } else {
    rect(ctx, 8, 11, 1, 2, hurt ? PAL.white : p.eye);
    rect(ctx, 12, 11, 1, 2, hurt ? PAL.white : p.eye);
    if (atk) rect(ctx, 9, 14, 3, 1, p.eye);
  }
}

// ---- BOSS 1 : le Général Corrompu 48×48 ----
// 0-1 repos, 2-3 marche, 4 armé, 5 frappe, 6 saut/écrasement, 7 touché
function drawGeneral(ctx, f, p) {
  const bob = f <= 3 ? f % 2 : 0;
  const lean = f === 5 ? 3 : f === 4 ? -2 : f === 7 ? -3 : 0;
  const cx = 20 + lean, by = bob + (f === 6 ? -2 : 0);
  // cape
  poly(ctx, [[cx - 6, 12 + by], [cx, 12 + by], [cx - 6, 40], [cx - 16 - bob, 42]], p.cape);
  rect(ctx, cx - 15 - bob, 41, 9, 1, p.capeDark);
  // jambes
  const lg = f === 2 ? [-3, 3] : f === 3 ? [3, -3] : f === 5 ? [5, -4] : [0, 0];
  rect(ctx, cx - 6 + lg[1], 32, 5, 10, p.pantsDark);
  rect(ctx, cx - 6 + lg[1], 41, 6, 4, p.boot);
  rect(ctx, cx + 1 + lg[0], 32, 5, 10, p.pants);
  rect(ctx, cx + 1 + lg[0], 41, 6, 4, p.boot);
  // jupe d'armure lamellaire
  poly(ctx, [[cx - 8, 25 + by], [cx + 8, 25 + by], [cx + 10, 37], [cx - 10, 37]], p.armor);
  for (let y = 28; y < 37; y += 3) rect(ctx, cx - 9, y + by, 18, 1, p.armorDark);
  rect(ctx, cx - 1, 25 + by, 2, 12, p.trim);
  // torse
  rect(ctx, cx - 7, 12 + by, 15, 13, p.armor);
  rect(ctx, cx - 5, 14 + by, 11, 8, p.armorDark);
  disc(ctx, cx, 18 + by, 3, p.gold);
  disc(ctx, cx, 18 + by, 1, p.cape);
  // épaulières tête de tigre
  ellipse(ctx, cx - 8, 13 + by, 4, 3, p.gold);
  ellipse(ctx, cx + 8, 13 + by, 4, 3, p.gold);
  rect(ctx, cx + 9, 13 + by, 2, 1, PAL.black);
  // ceinture
  rect(ctx, cx - 7, 23 + by, 15, 3, p.trim);
  rect(ctx, cx - 2, 23 + by, 4, 3, p.gold);
  // tête : masque + casque à cornes de bélier
  rect(ctx, cx - 4, 3 + by, 9, 9, p.mask);
  rect(ctx, cx - 3, 9 + by, 7, 2, p.maskDark);
  rect(ctx, cx + 1, 6 + by, 3, 1, f === 7 ? PAL.white : p.eye);
  rect(ctx, cx + 1, 10 + by, 4, 1, PAL.black);
  rect(ctx, cx - 5, 1 + by, 11, 4, p.armor);
  rect(ctx, cx - 5, 4 + by, 11, 1, p.gold);
  rect(ctx, cx - 1, 0 + by, 3, 1, p.trim);
  ellipse(ctx, cx - 7, 5 + by, 2, 3, p.horn);
  rect(ctx, cx - 9, 7 + by, 2, 2, p.horn);
  ellipse(ctx, cx + 7, 4 + by, 2, 3, p.horn);
  rect(ctx, cx + 8, 7 + by, 2, 1, p.horn);
  // guandao
  const blade = (x0, y0, x1, y1) => {
    line(ctx, x0, y0, x1, y1, PAL.woodDark, 2);
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    poly(ctx, [[x1, y1], [x1 + (dx / l) * 9, y1 + (dy / l) * 9], [x1 + (dx / l) * 6 + nx * 5, y1 + (dy / l) * 6 + ny * 5], [x1 + nx * 3, y1 + ny * 3]], p.metal);
    rect(ctx, x1 - 1, y1 - 1, 3, 3, p.gold);
  };
  if (f <= 3) {
    rect(ctx, cx + 6, 14 + by, 3, 9, p.armor);
    blade(cx + 8, 40, cx + 12, 4 + by);
  } else if (f === 4) {
    rect(ctx, cx - 5, 4 + by, 3, 9, p.armor);
    blade(cx + 6, 30, cx - 12, 4);
  } else if (f === 5) {
    rect(ctx, cx + 6, 15, 8, 3, p.armor);
    blade(cx + 2, 12, cx + 17, 28);
    for (let i = 0; i < 8; i++) rect(ctx, cx + 10 + Math.cos(-1.4 + i * 0.4) * 13, 22 + Math.sin(-1.4 + i * 0.4) * 14, 1, 1, PAL.white);
  } else if (f === 6) {
    rect(ctx, cx + 4, 4 + by, 3, 10, p.armor);
    blade(cx + 6, 2, cx + 8, 38);
  } else {
    rect(ctx, cx - 9, 10, 3, 6, p.armor);
    blade(cx + 10, 40, cx + 16, 10);
  }
}

// ---- BOSS 2 : le Gardien de Jade (lion-gardien de pierre) 56×44 ----
// 0-1 repos, 2-3 marche, 4 accroupi, 5 bond, 6 rugissement, 7 touché
function drawJadeLion(ctx, f, p) {
  const bob = f <= 3 ? f % 2 : 0;
  const crouch = f === 4 ? 3 : 0;
  const stretch = f === 5 ? 4 : 0;
  const by = 22 + bob + crouch - (f === 5 ? 4 : 0);
  // queue en volutes
  disc(ctx, 6, by - 8, 4, p.dark);
  disc(ctx, 4, by - 12, 3, p.body);
  disc(ctx, 8, by - 13, 2, p.light);
  // pattes arrière
  const lg = f === 2 ? 2 : f === 3 ? -2 : 0;
  rect(ctx, 10 - stretch + lg, by + 6, 6, 12 - crouch - (f === 5 ? -2 : 0), p.dark);
  rect(ctx, 9 - stretch + lg, by + 16 - crouch, 8, 3, p.body);
  // corps
  ellipse(ctx, 25, by + 2, 15 + stretch, 9, p.body);
  ellipse(ctx, 25, by + 5, 11, 4, p.dark);
  for (let i = 0; i < 4; i++) disc(ctx, 16 + i * 6, by - 3, 2, p.light);
  // pattes avant
  rect(ctx, 34 + stretch - lg, by + 5, 6, 13 - crouch, p.dark);
  rect(ctx, 33 + stretch - lg, by + 16 - crouch, 9, 3, p.body);
  rect(ctx, 41 + stretch - lg, by + 17 - crouch, 1, 2, PAL.white);
  // collier + clochette
  rect(ctx, 34, by - 6, 4, 12, p.gold);
  disc(ctx, 38, by + 4, 2, p.gold);
  // crinière
  const hx = 42 + stretch, hy = by - 10 - (f === 6 ? 3 : 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    disc(ctx, hx + Math.cos(a) * 9, hy + Math.sin(a) * 8, 3, i % 2 ? p.dark : p.body);
  }
  // tête
  disc(ctx, hx + 2, hy, 8, p.body);
  ellipse(ctx, hx + 6, hy + 3, 5, 3, p.light);
  // yeux ronds
  disc(ctx, hx + 3, hy - 3, 2, PAL.white);
  rect(ctx, hx + 4, hy - 3, 1, 1, f === 7 ? PAL.vermilion : p.eye);
  rect(ctx, hx - 1, hy - 7, 6, 1, p.dark);
  // gueule
  if (f === 6 || f === 5) {
    rect(ctx, hx + 3, hy + 3, 7, 5, PAL.darkRed);
    rect(ctx, hx + 4, hy + 3, 1, 2, PAL.white);
    rect(ctx, hx + 8, hy + 3, 1, 2, PAL.white);
    rect(ctx, hx + 4, hy + 7, 5, 1, PAL.white);
  } else {
    rect(ctx, hx + 4, hy + 4, 6, 1, PAL.black);
    rect(ctx, hx + 5, hy + 5, 1, 1, PAL.white);
    rect(ctx, hx + 8, hy + 5, 1, 1, PAL.white);
  }
  rect(ctx, hx + 9, hy, 2, 2, p.dark);
  // fissures lumineuses
  line(ctx, 20, by - 2, 24, by + 3, p.glow);
  line(ctx, 30, by, 28, by + 6, p.glow);
}

// ---- BOSS 3 : le Seigneur des Vents 40×44 ----
// 0-3 lévitation, 4 sort, 5 piqué, 6 touché
function drawWindLord(ctx, f, p) {
  const t = f % 4;
  const cx = 20, by = f === 5 ? 2 : [0, 1, 1, 0][t];
  // longue chevelure blanche
  poly(ctx, [[cx - 3, 4 + by], [cx + 2, 4 + by], [cx - 6, 22 + by], [cx - 14 - t, 26 + by]], PAL.ivory);
  // robe qui se termine en tourbillon
  poly(ctx, [[cx - 8, 14 + by], [cx + 8, 14 + by], [cx + 5, 32], [cx + 2 - t, 41], [cx - 4, 34], [cx - 9, 28]], p.robe);
  poly(ctx, [[cx - 3, 14 + by], [cx + 3, 14 + by], [cx + 1, 30], [cx - 2, 30]], p.robeLight);
  for (let i = 0; i < 3; i++) rect(ctx, cx - 6 + i * 4 + t, 33 + i * 2, 3, 1, p.robeLight);
  // manches larges
  poly(ctx, [[cx - 8, 15 + by], [cx - 4, 16 + by], [cx - 6, 26 + by], [cx - 15, 27 + by]], p.robe);
  rect(ctx, cx - 7, 13 + by, 15, 3, p.trim);
  rect(ctx, cx - 7, 21 + by, 15, 2, p.gold);
  // tête et masque
  rect(ctx, cx - 3, 4 + by, 8, 9, p.mask);
  rect(ctx, cx - 3, 4 + by, 8, 2, p.trim);
  rect(ctx, cx + 1, 7 + by, 3, 1, f === 6 ? PAL.white : p.eye);
  rect(ctx, cx + 1, 10 + by, 3, 1, p.trim);
  rect(ctx, cx - 4, 1 + by, 10, 3, p.hat);
  rect(ctx, cx - 1, 0 + by, 4, 1, p.gold);
  // bras + éventail
  if (f === 4) {
    rect(ctx, cx + 4, 15 + by, 8, 3, p.robe);
    poly(ctx, [[cx + 12, 16 + by], [cx + 19, 6 + by], [cx + 19, 26 + by]], p.fan);
    for (let i = 0; i < 4; i++) line(ctx, cx + 12, 16 + by, cx + 19, 8 + by + i * 5, p.fanDark);
  } else if (f === 5) {
    rect(ctx, cx + 3, 18, 6, 3, p.robe);
    poly(ctx, [[cx + 9, 19], [cx + 18, 26], [cx + 12, 30]], p.fan);
  } else {
    rect(ctx, cx + 4, 15 + by, 3, 8, p.robe);
    poly(ctx, [[cx + 6, 22 + by], [cx + 12, 16 + by + t], [cx + 13, 25 + by]], p.fan);
  }
}

// ---- BOSS FINAL : le Roi Dragon Déchu (tête 44×32, segments 20×20, queue) ----
function drawDragonHead(ctx, f, p) {
  const open = f === 1;
  const by = f === 2 ? 2 : 0;
  // crinière flottante
  for (let i = 0; i < 6; i++) poly(ctx, [[14 - i, 8 + i * 2 + by], [4 - i * 0.5, 4 + i * 4 + by], [12, 14 + i * 2 + by]], i % 2 ? p.mane : p.maneDark);
  // bois (cornes)
  line(ctx, 18, 8 + by, 8, 1, p.horn, 2);
  line(ctx, 12, 4, 10, 1, p.horn);
  line(ctx, 22, 7 + by, 16, 1, p.horn, 2);
  // crâne
  ellipse(ctx, 21, 14 + by, 10, 7, p.scale);
  rect(ctx, 14, 9 + by, 12, 2, p.scaleLight);
  // museau
  poly(ctx, [[24, 10 + by], [40, 13 + by], [41, 17 + by], [26, 19 + by]], p.scale);
  rect(ctx, 27, 12 + by, 12, 1, p.scaleLight);
  rect(ctx, 38, 13 + by, 2, 2, p.scaleDark);
  // mâchoire
  if (open) {
    poly(ctx, [[22, 19 + by], [38, 22 + by], [36, 27 + by], [21, 23 + by]], p.scale);
    poly(ctx, [[25, 18 + by], [40, 18 + by], [37, 22 + by], [24, 21 + by]], PAL.darkRed);
    for (let i = 0; i < 5; i++) {
      rect(ctx, 27 + i * 3, 18 + by, 1, 2, PAL.white);
      rect(ctx, 26 + i * 3, 21 + by + (i >> 1) * 0, 1, 1, PAL.white);
    }
    disc(ctx, 37, 20 + by, 2, p.fire);
  } else {
    poly(ctx, [[22, 18 + by], [39, 18 + by], [36, 22 + by], [21, 21 + by]], p.scale);
    rect(ctx, 26, 18 + by, 13, 1, PAL.black);
    rect(ctx, 30, 19 + by, 1, 1, PAL.white);
    rect(ctx, 35, 19 + by, 1, 1, PAL.white);
  }
  rect(ctx, 22, 20 + by, 10, 2, p.belly);
  // œil
  rect(ctx, 23, 11 + by, 5, 3, PAL.black);
  rect(ctx, 24, 11 + by, 3, 2, f === 2 ? PAL.white : p.eye);
  rect(ctx, 22, 10 + by, 7, 1, p.scaleDark);
  // moustaches
  line(ctx, 38, 16 + by, 42, 26 + by, p.whisker);
  line(ctx, 36, 17 + by, 30, 29 + by, p.whisker);
  // barbe
  rect(ctx, 22, 24 + by, 3, 4, p.mane);
}
function drawDragonSegment(ctx, f, p) {
  const r = f === 2 ? 6 : 8;
  if (f === 1) poly(ctx, [[6, 4], [10, -1], [14, 4]], p.mane);
  disc(ctx, 10, 10, r, p.scale);
  ellipse(ctx, 10, 13, r - 2, r - 4, p.belly);
  for (let i = 0; i < 3; i++) rect(ctx, 5 + i * 4, 6 + (i % 2), 2, 1, p.scaleLight);
  rect(ctx, 6, 9, 1, 1, p.scaleDark);
  rect(ctx, 13, 9, 1, 1, p.scaleDark);
  if (f === 3) {
    // patte griffue
    rect(ctx, 9, 15, 3, 3, p.scale);
    rect(ctx, 8, 18, 1, 1, PAL.ivory);
    rect(ctx, 10, 18, 1, 1, PAL.ivory);
    rect(ctx, 12, 18, 1, 1, PAL.ivory);
  }
}
function drawDragonTail(ctx, f, p) {
  poly(ctx, [[2, 7], [14, 3], [17, 7], [14, 11]], p.mane);
  ellipse(ctx, 6, 7, 4, 3, p.scale);
}

// ---- Projectiles ----
function drawProjectileFrame(ctx, kind, f) {
  switch (kind) {
    case 'fireball':
      disc(ctx, 6, 6, 4, PAL.vermilion);
      disc(ctx, 6 + (f ? 1 : 0), 6, 2, PAL.goldLight);
      rect(ctx, 1, 5 + f, 2, 2, PAL.orange);
      break;
    case 'voidball':
      disc(ctx, 6, 6, 4, PAL.violet);
      disc(ctx, 6, 6, 2, f ? PAL.white : PAL.violetLight);
      rect(ctx, 1, 5 + f, 2, 2, PAL.violetDark);
      break;
    case 'jadeshard':
      poly(ctx, [[1, 6], [6, 2 + f], [11, 6], [6, 10 - f]], PAL.jade);
      rect(ctx, 5, 5, 2, 2, PAL.jadeLight);
      break;
    case 'windblade':
      for (let i = 0; i < 9; i++) rect(ctx, 2 + i, 3 + Math.round(Math.sin(i * 0.5 + f) * 1.5), 2, 2, i % 3 ? PAL.qi : PAL.white);
      rect(ctx, 9, 2, 3, 6, PAL.white);
      break;
    case 'shockwave':
      poly(ctx, [[1, 13], [5, 3 + f * 2], [9, 0 + f], [13, 6], [15, 13]], PAL.orange);
      poly(ctx, [[4, 13], [7, 6 + f], [11, 8], [12, 13]], PAL.goldLight);
      break;
    case 'jadewave':
      poly(ctx, [[1, 13], [5, 2 + f * 2], [9, 0 + f], [13, 6], [15, 13]], PAL.jade);
      poly(ctx, [[4, 13], [7, 6 + f], [11, 8], [12, 13]], PAL.jadeLight);
      break;
    case 'meteor':
      disc(ctx, 6, 7, 4, PAL.violet);
      disc(ctx, 6, 7, 2, PAL.goldLight);
      rect(ctx, 4 - f, 0, 2, 3, PAL.violetLight);
      rect(ctx, 8 + f, 1, 1, 2, PAL.violetLight);
      break;
    case 'blade':
      {
        const a = f * (Math.PI / 4);
        for (let i = -4; i <= 4; i++) rect(ctx, 6 + Math.cos(a) * i, 6 + Math.sin(a) * i, 2, 2, i === 0 ? PAL.gold : PAL.white);
        for (let i = -3; i <= 3; i++) rect(ctx, 6 + Math.cos(a + 1.57) * i, 6 + Math.sin(a + 1.57) * i, 1, 1, PAL.ivoryDark);
      }
      break;
    case 'feather':
      line(ctx, 1, 6, 10, 4, PAL.ivory);
      line(ctx, 2, 7, 10, 5, PAL.qi);
      rect(ctx, 9, 3, 2, 3, PAL.white);
      break;
  }
}
const PROJECTILE_DEFS = {
  fireball: { w: 12, h: 12, frames: 2 },
  voidball: { w: 12, h: 12, frames: 2 },
  jadeshard: { w: 12, h: 12, frames: 2 },
  windblade: { w: 14, h: 10, frames: 2 },
  shockwave: { w: 16, h: 14, frames: 2 },
  jadewave: { w: 16, h: 14, frames: 2 },
  meteor: { w: 12, h: 12, frames: 2 },
  blade: { w: 13, h: 13, frames: 4 },
  feather: { w: 12, h: 10, frames: 1 },
};

// Vague de Qi du héros 24×30 (3 frames)
function drawQiWave(ctx, f) {
  const cols = [PAL.qiDark, PAL.qi, PAL.white];
  for (let k = 0; k < 3; k++) {
    const r = 12 - k * 3;
    for (let a = -1.3; a <= 1.3; a += 0.05) {
      const x = 4 + k * 2 + Math.cos(a) * r + f;
      const y = 15 + Math.sin(a) * (13 - k * 2);
      rect(ctx, x, y, 2, 2, cols[k]);
    }
  }
  for (let i = 0; i < 4; i++) rect(ctx, 2 + ((i * 5 + f * 3) % 10), 4 + i * 7, 1, 1, PAL.qi);
}
// Arcs de lame (effets de combo) 40×40
function drawSlash(ctx, f, kind) {
  const fade = [1, 0.75, 0.45][f];
  const outer = kind === 2 ? PAL.gold : PAL.white;
  const inner = kind === 2 ? PAL.goldLight : PAL.qi;
  const span = kind === 2 ? [-2.4, 1.2] : kind === 1 ? [-0.6, 1.9] : [-1.6, 1.3];
  const R = kind === 2 ? 17 : 15;
  for (let a = span[0]; a <= span[1]; a += 0.04) {
    const t = (a - span[0]) / (span[1] - span[0]);
    const th = Math.max(1, Math.round((kind === 2 ? 4 : 3) * Math.sin(t * Math.PI) * fade));
    const x = 18 + Math.cos(a) * R, y = 20 + Math.sin(a) * R;
    rect(ctx, x, y, th, th, t > 0.25 ? outer : inner);
    if (f === 0 && t > 0.3 && t < 0.8) rect(ctx, 18 + Math.cos(a) * (R - 3), 20 + Math.sin(a) * (R - 3), 1, 1, inner);
  }
}

// ---- Objets ----
function drawCoin(ctx, f) {
  const w = [6, 4, 2, 4][f];
  ellipse(ctx, 4, 4, Math.floor(w / 2), 3, PAL.jade);
  if (w > 2) {
    rect(ctx, 4 - Math.floor(w / 2) + 1, 2, 1, 1, PAL.jadeLight);
    rect(ctx, 4, 4, 1, 1, PAL.jadeDark);
  } else rect(ctx, 4, 2, 1, 4, PAL.jadeLight);
}
function drawQiOrb(ctx, f) {
  disc(ctx, 6, 6, 4 + f, PAL.qiDark);
  disc(ctx, 6, 6, 3 + f, PAL.qi);
  rect(ctx, 4, 4, 2, 2, PAL.white);
}
function drawPeach(ctx) {
  disc(ctx, 6, 7, 4, '#f59a8a');
  rect(ctx, 6, 3, 1, 8, '#e06a6a');
  rect(ctx, 3, 5, 2, 2, '#ffd0c0');
  poly(ctx, [[6, 3], [9, 0], [10, 3]], PAL.bamboo);
}
function drawFlower(ctx, f) {
  const petals = f ? PAL.white : '#ffd0ec';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55;
    ellipse(ctx, 7 + Math.cos(a) * 3, 7 + Math.sin(a) * 4, 1, 3, i % 2 ? PAL.pink : petals);
  }
  ellipse(ctx, 7, 9, 5, 2, PAL.pink);
  rect(ctx, 6, 7, 3, 2, PAL.goldLight);
  rect(ctx, 2, 11, 10, 2, PAL.jadeDark);
}
function drawRelic(ctx, f) {
  // ding de bronze (vase rituel) avec inscription lumineuse
  rect(ctx, 3, 4, 8, 6, PAL.bronze);
  rect(ctx, 2, 3, 10, 2, PAL.goldDark);
  rect(ctx, 3, 1, 2, 2, PAL.goldDark);
  rect(ctx, 9, 1, 2, 2, PAL.goldDark);
  rect(ctx, 3, 10, 2, 3, PAL.bronze);
  rect(ctx, 9, 10, 2, 3, PAL.bronze);
  rect(ctx, 5, 6, 4, 2, f ? PAL.goldLight : PAL.gold);
  rect(ctx, 6, 5, 2, 4, f ? PAL.goldLight : PAL.gold);
}
function drawFragment(ctx, f) {
  const w = [6, 4, 2, 4][f];
  poly(ctx, [[8, 1], [8 + w, 9], [8, 17], [8 - w, 9]], PAL.qi);
  poly(ctx, [[8, 3], [8 + Math.max(1, w - 2), 9], [8, 15], [8 - Math.max(1, w - 2), 9]], PAL.white);
  rect(ctx, 7, 7, 2, 4, PAL.goldLight);
}
function drawCheckpoint(ctx, f) {
  // lanterne de pierre (tōrō chinois)
  rect(ctx, 3, 25, 10, 4, PAL.stoneDark);
  rect(ctx, 5, 15, 6, 10, PAL.stone);
  rect(ctx, 5, 15, 1, 10, PAL.stoneLight);
  rect(ctx, 2, 13, 12, 3, PAL.stoneDark);
  rect(ctx, 3, 6, 10, 7, PAL.stone);
  rect(ctx, 5, 8, 6, 4, f ? PAL.goldLight : PAL.black);
  if (f) rect(ctx, 7, 9, 2, 2, PAL.white);
  poly(ctx, [[0, 6], [8, 1], [16, 6]], PAL.stoneDark);
  rect(ctx, 7, 0, 2, 2, PAL.stoneLight);
}
function drawSign(ctx) {
  rect(ctx, 7, 9, 2, 7, PAL.woodDark);
  rect(ctx, 1, 2, 14, 9, PAL.wood);
  rect(ctx, 1, 2, 14, 1, PAL.woodLight);
  rect(ctx, 0, 1, 16, 1, PAL.red);
  rect(ctx, 4, 4, 3, 1, PAL.black);
  rect(ctx, 5, 5, 1, 4, PAL.black);
  rect(ctx, 9, 4, 3, 1, PAL.black);
  rect(ctx, 9, 6, 3, 1, PAL.black);
  rect(ctx, 10, 6, 1, 3, PAL.black);
}
const NPC_STYLES = [
  { robe: '#efe6cf', robeDark: '#bdb29a', hat: '#c8a050', beard: '#ffffff', staff: true },
  { robe: '#6b6a9a', robeDark: '#45446a', hat: null, beard: null, staff: false, hood: '#2a2840' },
  { robe: '#3a6a8a', robeDark: '#24486a', hat: '#c8a050', beard: '#bdb29a', staff: true },
  { robe: '#ffffff', robeDark: '#bfe8ff', hat: null, beard: '#ffffff', staff: false, crane: true },
];
function drawNPC(ctx, f, s) {
  const by = f;
  // robe longue
  poly(ctx, [[4, 10 + by], [11, 10 + by], [13, 27], [2, 27]], s.robe);
  rect(ctx, 7, 11 + by, 1, 16, s.robeDark);
  rect(ctx, 4, 17 + by, 8, 1, PAL.red);
  // tête
  rect(ctx, 5, 3 + by, 6, 7, PAL.skin);
  rect(ctx, 9, 5 + by, 1, 1, PAL.black);
  if (s.beard) rect(ctx, 6, 8 + by, 5, 4 + f, s.beard);
  if (s.hat) poly(ctx, [[1, 4 + by], [8, 0 + by], [15, 4 + by]], s.hat);
  if (s.hood) {
    rect(ctx, 4, 2 + by, 8, 2, s.hood);
    rect(ctx, 4, 2 + by, 2, 9, s.hood);
  }
  if (s.crane) {
    rect(ctx, 4, 1 + by, 7, 2, PAL.white);
    rect(ctx, 6, 0 + by, 3, 1, PAL.vermilion);
    rect(ctx, 11, 5 + by, 3, 1, PAL.gold);
  }
  if (s.staff) {
    rect(ctx, 13, 2, 1, 26, PAL.wood);
    disc(ctx, 13, 3, 2, PAL.gold);
  }
  rect(ctx, 10, 13 + by, 3, 2, PAL.skin);
}
function drawVase(ctx) {
  ellipse(ctx, 6, 9, 5, 5, PAL.ivory);
  rect(ctx, 4, 1, 5, 4, PAL.ivory);
  rect(ctx, 3, 1, 7, 1, PAL.ivoryDark);
  rect(ctx, 2, 8, 9, 1, PAL.blue);
  rect(ctx, 3, 10, 7, 1, PAL.blue);
  rect(ctx, 5, 6, 1, 1, PAL.blue);
  rect(ctx, 7, 12, 1, 1, PAL.blue);
  rect(ctx, 3, 6, 1, 3, PAL.white);
}
function drawBell(ctx) {
  poly(ctx, [[3, 3], [9, 3], [11, 13], [1, 13]], PAL.bronze);
  rect(ctx, 0, 12, 12, 2, PAL.goldDark);
  rect(ctx, 5, 0, 2, 3, PAL.goldDark);
  rect(ctx, 3, 6, 6, 1, PAL.gold);
  rect(ctx, 4, 4, 1, 7, '#a8703c');
}
function drawGate(ctx, th) {
  rect(ctx, 2, 0, 12, 64, th.gate);
  rect(ctx, 2, 0, 2, 64, shade(th.gate, 0.25));
  for (let y = 4; y < 64; y += 12) {
    rect(ctx, 1, y, 14, 3, PAL.gold);
    rect(ctx, 7, y + 1, 2, 1, PAL.goldDark);
  }
}
function drawFlame(ctx, f) {
  const h = [8, 10, 9, 11][f];
  poly(ctx, [[1, 12], [4, 12 - h], [7, 12]], PAL.vermilion);
  poly(ctx, [[2, 12], [4 + (f % 2 ? 1 : -1), 13 - h * 0.7], [6, 12]], PAL.orange);
  rect(ctx, 3, 9, 2, 3, PAL.goldLight);
}

// Halo radial en paliers (texture de lumière)
function buildGlowSheet() {
  const [c, ctx] = makeCanvas(32, 32);
  const img = ctx.createImageData(32, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x - 15.5, y - 15.5) / 16;
      const v = d >= 1 ? 0 : Math.round((1 - d) * (1 - d) * 4) / 4;
      const i = (y * 32 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(v * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new Sheet(c, 32, 32, 1);
}

// Construit toutes les planches globales
function generateArt(images) {
  ART.player = buildPlayerSheet(images);
  ART.glow = buildGlowSheet();
  ART.imps = {};
  for (const k in IMP_PALETTES) ART.imps[k] = buildSheet(20, 20, 6, (c, f) => drawImp(c, f, IMP_PALETTES[k]));
  ART.warriors = {};
  const wstyles = {
    soldier: { hat: 'helmet', weapon: 'dao', cape: false },
    ghost: { hat: 'topknot', weapon: 'dao', cape: true },
    statue: { hat: 'stone', weapon: 'fist', cape: false },
    monk: { hat: 'bald', weapon: 'none', robe: true },
    celestial: { hat: 'horned', weapon: 'halberd', cape: true },
    guard: { hat: 'crown', weapon: 'halberd', cape: true },
    sorcerer: { hat: 'hood', weapon: 'none', robe: true },
  };
  for (const k in wstyles) ART.warriors[k] = buildSheet(32, 32, 8, (c, f) => drawWarrior(c, f, STYLE_PALETTES[k], wstyles[k]));
  ART.spirits = {};
  for (const k in SPIRIT_PALETTES) {
    const kind = k === 'ghostflame' ? 'wisp' : k;
    ART.spirits[k] = buildSheet(20, 20, 6, (c, f) => drawSpirit(c, f, kind, SPIRIT_PALETTES[k]));
  }
  ART.general = buildSheet(48, 48, 8, (c, f) => drawGeneral(c, f, {
    cape: '#9c1d22', capeDark: '#5a0f17', armor: '#3a3446', armorDark: '#24202e', trim: '#e0412b',
    gold: '#f2b53a', pants: '#2a2633', pantsDark: '#1c1a24', boot: '#1a1210', mask: '#c8322a',
    maskDark: '#7a1a18', eye: '#ffde4a', horn: '#efe6cf', metal: '#d8dce8',
  }));
  ART.jadeLion = buildSheet(56, 44, 8, (c, f) => drawJadeLion(c, f, {
    body: '#3ecf8e', dark: '#1f7a55', light: '#9cf5c8', gold: '#f2b53a', eye: '#e0412b', glow: '#ffe08a',
  }));
  ART.windLord = buildSheet(40, 44, 7, (c, f) => drawWindLord(c, f, {
    robe: '#bfe8ff', robeLight: '#ffffff', trim: '#3a5a9c', gold: '#f2b53a', mask: '#efe6cf',
    eye: '#e0412b', hat: '#1b2346', fan: '#e0412b', fanDark: '#5a0f17',
  }));
  const dragonPal = {
    scale: '#9c1d22', scaleLight: '#e0412b', scaleDark: '#5a0f17', belly: '#f2b53a', mane: '#f2b53a',
    maneDark: '#a8641c', horn: '#ffe08a', eye: '#c46bff', whisker: '#ffe08a', fire: '#ffe08a',
  };
  ART.dragonHead = buildSheet(44, 32, 3, (c, f) => drawDragonHead(c, f, dragonPal));
  ART.dragonSeg = buildSheet(20, 20, 4, (c, f) => drawDragonSegment(c, f, dragonPal));
  ART.dragonTail = buildSheet(20, 14, 1, (c, f) => drawDragonTail(c, f, dragonPal));
  ART.proj = {};
  for (const k in PROJECTILE_DEFS) {
    const d = PROJECTILE_DEFS[k];
    ART.proj[k] = buildSheet(d.w, d.h, d.frames, (c, f) => drawProjectileFrame(c, k, f));
  }
  ART.qiWave = buildSheet(26, 32, 3, (c, f) => drawQiWave(c, f), PAL.nightDeep);
  ART.slash = [0, 1, 2].map((k) => buildSheet(40, 40, 3, (c, f) => drawSlash(c, f, k), null));
  ART.coin = buildSheet(9, 9, 4, (c, f) => drawCoin(c, f));
  ART.orb = buildSheet(13, 13, 2, (c, f) => drawQiOrb(c, f), null);
  ART.peach = buildSheet(12, 12, 1, (c) => drawPeach(c));
  ART.flower = buildSheet(14, 14, 2, (c, f) => drawFlower(c, f));
  ART.relic = buildSheet(14, 14, 2, (c, f) => drawRelic(c, f));
  ART.fragment = buildSheet(17, 19, 4, (c, f) => drawFragment(c, f));
  ART.checkpoint = buildSheet(16, 30, 2, (c, f) => drawCheckpoint(c, f));
  ART.sign = buildSheet(16, 17, 1, (c) => drawSign(c));
  ART.npcs = NPC_STYLES.map((s) => buildSheet(16, 29, 2, (c, f) => drawNPC(c, f, s)));
  ART.vase = buildSheet(13, 15, 1, (c) => drawVase(c));
  ART.bell = buildSheet(13, 15, 1, (c) => drawBell(c));
  ART.flame = buildSheet(8, 13, 4, (c, f) => drawFlame(c, f), null);
  ART.lightning = buildSheet(16, 176, 2, (c, f) => drawLightning(c, f), PAL.violet);
  ART.tornado = buildSheet(20, 40, 3, (c, f) => drawTornado(c, f), null);
}

// ---- Thèmes des décors ----
const THEMES = {
  forest: {
    sky: ['#0d1028', '#1b2346', '#2a3f5c', '#4f7a78', '#9cc0a0'],
    ground: { fill: '#3b2418', dark: '#2a1810', speck: '#523424', edge: '#1c0e08', top: '#4f9a3c', topLight: '#8fd05a', topDark: '#2a5a2c', style: 'grass' },
    wall: { base: '#4a4a3a', dark: '#2e2e24', a: '#3f8a3a', b: '#7cc24f' },
    wood: '#7a4a2a', woodDark: '#4a2a18', woodLight: '#a8703c', rope: '#c8a070',
    spike: { a: '#d8c080', b: '#8a7040', c: '#4f9a3c' },
    hazard: { deep: '#1f3a22', mid: '#2e5a30', light: '#5f9a3c', foam: '#b8f090' },
    gate: '#7a1a18', mist: '#a8c8b8', weather: 'leaves', fireflies: true,
    platform: { a: '#7a4a2a', b: '#a8703c', c: '#4a2a18' },
  },
  temple: {
    sky: ['#140818', '#2a0e30', '#5a1a40', '#9c3040', '#e0682a'],
    ground: { fill: '#4a3e52', dark: '#2e2638', speck: '#5a4e62', edge: '#1a1420', top: '#9c1d22', topLight: '#f2b53a', topDark: '#5a0f17', style: 'lacquer' },
    wall: { base: '#5a1a1a', dark: '#3a0e10', a: '#9c1d22', b: '#f2b53a' },
    wood: '#9c1d22', woodDark: '#5a0f17', woodLight: '#e0412b', rope: '#f2b53a',
    spike: { a: '#c8ccd8', b: '#6d6a72', c: '#45424d' },
    hazard: { deep: '#7a1a10', mid: '#c8322a', light: '#f07a2a', foam: '#ffde4a' },
    gate: '#3a2a3a', mist: '#c88a90', weather: 'embers', fireflies: false,
    platform: { a: '#6d6a72', b: '#9a96a0', c: '#45424d' },
  },
  mountain: {
    sky: ['#3a0e18', '#7a1a24', '#c8322a', '#f07a2a', '#f2b53a', '#ffe08a'],
    ground: { fill: '#5a3a44', dark: '#3a2430', speck: '#74525a', edge: '#24141c', top: '#f4f0ff', topLight: '#ffffff', topDark: '#b8c0e0', style: 'snow' },
    wall: { base: '#4a3a54', dark: '#2e2238', a: '#9ac8e8', b: '#e0f4ff' },
    wood: '#5a3a2a', woodDark: '#3a2418', woodLight: '#8a5a3a', rope: '#d8c8a8',
    spike: { a: '#e0f4ff', b: '#8ac0e8', c: '#5a8ab8' },
    hazard: { deep: '#24486a', mid: '#3a7ab8', light: '#7fe3ff', foam: '#ffffff' },
    gate: '#3a2430', mist: '#f8c8a0', weather: 'snow', fireflies: false,
    platform: { a: '#5a3a2a', b: '#8a5a3a', c: '#3a2418' },
  },
  dragon: {
    sky: ['#05030c', '#120a28', '#24124a', '#40206a', '#6b3a8c'],
    ground: { fill: '#2e2050', dark: '#1e143a', speck: '#3e2e68', edge: '#120a24', top: '#f2b53a', topLight: '#ffe08a', topDark: '#a8641c', style: 'gold' },
    wall: { base: '#2e2050', dark: '#1e143a', a: '#f2b53a', b: '#ffe08a' },
    wood: '#c8902a', woodDark: '#8a5a18', woodLight: '#ffe08a', rope: '#ffe08a',
    spike: { a: '#e0a8ff', b: '#a466c4', c: '#6b3a8c' },
    hazard: { deep: '#24103a', mid: '#6b3a8c', light: '#c46bff', foam: '#ffd8ff' },
    gate: '#4a2460', mist: '#c8a0e8', weather: 'motes', fireflies: false,
    platform: { a: '#c8902a', b: '#ffe08a', c: '#8a5a18' },
  },
};

// ---- Éléments de décor (dessinés dans des canvas) ----
function drawMountain(ctx, x, baseY, w, h, col, light, snow) {
  const pts = [[x, baseY], [x + w * 0.38, baseY - h * 0.85], [x + w * 0.5, baseY - h], [x + w * 0.62, baseY - h * 0.8], [x + w, baseY]];
  poly(ctx, pts, col);
  poly(ctx, [[x + w * 0.5, baseY - h], [x + w * 0.38, baseY - h * 0.85], [x + w * 0.3, baseY - h * 0.5], [x + w * 0.45, baseY - h * 0.55]], light);
  if (snow) {
    poly(ctx, [[x + w * 0.5, baseY - h], [x + w * 0.62, baseY - h * 0.8], [x + w * 0.56, baseY - h * 0.76], [x + w * 0.5, baseY - h * 0.82], [x + w * 0.43, baseY - h * 0.74], [x + w * 0.38, baseY - h * 0.85]], snow);
  }
}
// Pic karstique (montagnes de Guilin)
function drawKarst(ctx, x, baseY, w, h, col, light) {
  const r = w / 2;
  rect(ctx, x, baseY - h + r, w, h - r, col);
  ellipse(ctx, x + r, baseY - h + r, r, r, col);
  rect(ctx, x + 2, baseY - h + r, Math.max(1, Math.floor(w / 5)), h - r - 4, light);
  ellipse(ctx, x + r - 2, baseY - h + r - 1, Math.max(1, r - 3), Math.max(1, r - 3), col);
  rect(ctx, x + r - 3, baseY - h + 3, 3, 2, light);
}
function drawTree(ctx, x, baseY, h, col, light, leaves, rng) {
  // bambou : tige segmentée + feuilles
  rect(ctx, x, baseY - h, 3, h, col);
  rect(ctx, x, baseY - h, 1, h, light);
  for (let y = baseY - 6; y > baseY - h; y -= 12 + Math.floor(rng() * 6)) {
    rect(ctx, x - 1, y, 5, 1, shade(col, -0.35));
    if (rng() < 0.55) {
      const dir = rng() < 0.5 ? -1 : 1;
      for (let i = 0; i < 3; i++) {
        const lx = x + 1 + dir * (3 + i * 3), ly = y - 2 + i;
        rect(ctx, dir > 0 ? lx : lx - 4, ly, 5, 1, leaves);
        rect(ctx, dir > 0 ? lx + 1 : lx - 3, ly + 1, 3, 1, leaves);
      }
    }
  }
}
function drawPine(ctx, x, baseY, h, col, light) {
  rect(ctx, x - 1, baseY - h * 0.4, 3, h * 0.4, shade(col, -0.3));
  for (let i = 0; i < 4; i++) {
    const y = baseY - h * 0.35 - i * h * 0.17, w = h * 0.5 - i * h * 0.1;
    poly(ctx, [[x - w / 2, y], [x + w / 2, y], [x + w / 3, y - h * 0.12], [x - w / 3, y - h * 0.12]], col);
    rect(ctx, x - w / 3, y - h * 0.12, w / 2, 1, light);
  }
}
function drawRoof(ctx, x, y, w, col, edge) {
  // toit chinois aux angles relevés
  poly(ctx, [[x - 6, y + 2], [x + 4, y - 7], [x + w - 4, y - 7], [x + w + 6, y + 2], [x + w + 3, y + 4], [x + w - 4, y], [x + 4, y], [x - 3, y + 4]], col);
  rect(ctx, x + 4, y - 8, w - 8, 2, edge);
  rect(ctx, x - 7, y, 2, 2, edge);
  rect(ctx, x + w + 5, y, 2, 2, edge);
}
function drawTemple(ctx, x, baseY, opt = {}) {
  const w = opt.w || 60, col = opt.col || PAL.red, roof = opt.roof || '#24484a', gold = opt.gold || PAL.gold;
  rect(ctx, x - 4, baseY - 6, w + 8, 6, opt.base || PAL.stoneDark);
  rect(ctx, x - 4, baseY - 6, w + 8, 1, opt.baseLight || PAL.stone);
  rect(ctx, x, baseY - 36, w, 30, opt.wall || '#5a1a1a');
  for (let i = 0; i < 4; i++) rect(ctx, x + 2 + i * Math.floor((w - 6) / 3), baseY - 38, 4, 32, col);
  rect(ctx, x + w / 2 - 7, baseY - 26, 14, 20, PAL.black);
  rect(ctx, x + w / 2 - 6, baseY - 25, 12, 19, '#2a1010');
  rect(ctx, x + w / 2 - 1, baseY - 25, 1, 19, gold);
  for (let i = 0; i < 3; i++) rect(ctx, x + 8 + i * 4, baseY - 30, 2, 2, gold);
  rect(ctx, x - 2, baseY - 40, w + 4, 3, gold);
  drawRoof(ctx, x, baseY - 41, w, roof, gold);
  drawRoof(ctx, x + 10, baseY - 54, w - 20, roof, gold);
  rect(ctx, x + w / 2 - 2, baseY - 65, 4, 3, gold);
  if (opt.sign !== false) {
    rect(ctx, x + w / 2 - 6, baseY - 50, 12, 6, PAL.black);
    rect(ctx, x + w / 2 - 5, baseY - 49, 10, 4, gold);
  }
}
function drawPagoda(ctx, x, baseY, tiers, col, roof, gold) {
  let w = 34, y = baseY;
  rect(ctx, x - 4, y - 4, w + 8, 4, PAL.stoneDark);
  y -= 4;
  for (let i = 0; i < tiers; i++) {
    const h = 16 - i;
    const xx = x + (34 - w) / 2;
    rect(ctx, xx, y - h, w, h, col);
    rect(ctx, xx + w / 2 - 2, y - h + 4, 4, h - 4, PAL.black);
    rect(ctx, xx + 2, y - h + 3, 2, 2, gold);
    rect(ctx, xx + w - 4, y - h + 3, 2, 2, gold);
    drawRoof(ctx, xx, y - h, w, roof, gold);
    y -= h + 7;
    w -= 4;
  }
  rect(ctx, x + 16, y - 8, 2, 10, gold);
  disc(ctx, x + 17, y - 9, 2, gold);
}
function drawCloud(ctx, x, y, w, col, light, dark) {
  const n = Math.max(2, Math.floor(w / 12));
  for (let i = 0; i < n; i++) {
    const cx = x + 6 + (i * (w - 12)) / Math.max(1, n - 1);
    const r = 5 + ((i * 7) % 4) + (i === Math.floor(n / 2) ? 3 : 0);
    disc(ctx, cx, y - r / 2, r, col);
  }
  rect(ctx, x, y, w, 4, col);
  if (dark) rect(ctx, x + 2, y + 3, w - 4, 1, dark);
  if (light) {
    for (let i = 0; i < n; i += 2) {
      const cx = x + 6 + (i * (w - 12)) / Math.max(1, n - 1);
      rect(ctx, cx - 3, y - 7, 5, 1, light);
      rect(ctx, cx + 2, y - 6, 1, 2, light);
    }
  }
}
// Dragon lointain (silhouette ondulante) — utilisé en décor et en planche animée
function drawDragon(ctx, x, y, len, phase, col, accent) {
  for (let i = len; i >= 0; i--) {
    const px = x + i * 3, py = y + Math.sin(phase + i * 0.35) * 4;
    const r = i === len ? 3 : Math.max(1, 2 - (i < 4 ? 1 : 0));
    disc(ctx, px, py, r, col);
    if (i % 4 === 0 && i > 0 && i < len) rect(ctx, px, py - 3, 1, 2, accent);
  }
  const hx = x + len * 3, hy = y + Math.sin(phase + len * 0.35) * 4;
  rect(ctx, hx + 2, hy - 1, 5, 3, col);
  rect(ctx, hx, hy - 5, 1, 3, accent);
  rect(ctx, hx + 2, hy - 5, 1, 3, accent);
  rect(ctx, hx + 6, hy + 1, 3, 1, accent);
}
function drawDragonStatue(ctx, x, baseY, col, light, eye) {
  rect(ctx, x, baseY - 8, 32, 8, PAL.stoneDark);
  rect(ctx, x + 2, baseY - 9, 28, 1, PAL.stone);
  rect(ctx, x + 12, baseY - 50, 8, 42, shade(col, -0.25));
  for (let i = 0; i < 6; i++) {
    const yy = baseY - 12 - i * 7, dx = i % 2 ? 6 : -6;
    ellipse(ctx, x + 16 + dx, yy, 6, 3, col);
    rect(ctx, x + 12 + dx, yy - 3, 6, 1, light);
  }
  rect(ctx, x + 14, baseY - 60, 14, 9, col);
  rect(ctx, x + 24, baseY - 56, 7, 4, col);
  rect(ctx, x + 18, baseY - 58, 2, 2, eye);
  rect(ctx, x + 13, baseY - 66, 2, 6, light);
  rect(ctx, x + 17, baseY - 65, 2, 5, light);
  rect(ctx, x + 26, baseY - 52, 4, 1, PAL.black);
}
function drawColumn(ctx, x, topY, baseY, col, gold) {
  rect(ctx, x, topY, 10, baseY - topY, col);
  rect(ctx, x + 1, topY, 2, baseY - topY, shade(col, 0.25));
  rect(ctx, x + 8, topY, 2, baseY - topY, shade(col, -0.35));
  rect(ctx, x - 2, baseY - 4, 14, 4, PAL.stoneDark);
  rect(ctx, x - 1, topY, 12, 3, gold);
  for (let y = topY + 20; y < baseY - 10; y += 30) rect(ctx, x, y, 10, 2, gold);
}
function drawLanternPost(ctx, x, baseY, th) {
  rect(ctx, x + 3, baseY - 40, 2, 40, th.woodDark);
  rect(ctx, x + 3, baseY - 40, 12, 2, th.woodDark);
  rect(ctx, x + 12, baseY - 38, 1, 4, PAL.black);
  ellipse(ctx, x + 12, baseY - 29, 4, 5, PAL.vermilion);
  rect(ctx, x + 9, baseY - 30, 1, 3, PAL.goldLight);
  rect(ctx, x + 9, baseY - 35, 7, 2, PAL.gold);
  rect(ctx, x + 9, baseY - 24, 7, 2, PAL.gold);
  rect(ctx, x + 12, baseY - 22, 1, 3, PAL.gold);
}
function drawTorchStand(ctx, x, baseY) {
  rect(ctx, x + 6, baseY - 18, 4, 18, PAL.stoneDark);
  rect(ctx, x + 2, baseY - 22, 12, 4, PAL.stone);
  rect(ctx, x + 3, baseY - 18, 10, 1, PAL.stoneDark);
  rect(ctx, x + 4, baseY - 2, 8, 2, PAL.stoneDark);
}
function drawBellFrame(ctx, x, baseY, th) {
  rect(ctx, x + 1, baseY - 42, 3, 42, th.woodDark);
  rect(ctx, x + 22, baseY - 42, 3, 42, th.woodDark);
  rect(ctx, x - 2, baseY - 44, 30, 3, th.wood);
  rect(ctx, x - 3, baseY - 45, 3, 2, PAL.gold);
  rect(ctx, x + 26, baseY - 45, 3, 2, PAL.gold);
  rect(ctx, x + 12, baseY - 41, 2, 6, PAL.black);
}
function drawPaifang(ctx, x, baseY, col, roof, gold) {
  rect(ctx, x, baseY - 56, 5, 56, col);
  rect(ctx, x + 45, baseY - 56, 5, 56, col);
  rect(ctx, x - 4, baseY - 48, 58, 4, col);
  rect(ctx, x + 15, baseY - 56, 20, 8, PAL.black);
  rect(ctx, x + 16, baseY - 55, 18, 6, gold);
  drawRoof(ctx, x - 2, baseY - 57, 54, roof, gold);
  rect(ctx, x - 1, baseY - 4, 7, 4, PAL.stoneDark);
  rect(ctx, x + 44, baseY - 4, 7, 4, PAL.stoneDark);
}

// ---- Ciels et couches de parallaxe ----
function buildSky(themeName) {
  const th = THEMES[themeName];
  const [c, ctx] = makeCanvas(W, H);
  bandGradient(ctx, 0, 0, W, H, th.sky);
  const rng = mulberry32(themeName.length * 977);
  const stars = themeName === 'dragon' ? 120 : themeName === 'forest' ? 50 : themeName === 'temple' ? 25 : 0;
  for (let i = 0; i < stars; i++) {
    const y = Math.floor(rng() * H * 0.6);
    rect(ctx, Math.floor(rng() * W), y, 1, 1, rng() < 0.2 ? PAL.goldLight : '#c8d0ff');
  }
  if (themeName === 'forest') {
    disc(ctx, 245, 42, 16, '#efe6cf');
    disc(ctx, 240, 38, 4, '#d8cfb8');
    disc(ctx, 252, 50, 3, '#d8cfb8');
    rect(ctx, 200, 50, 90, 2, '#2a3f5c');
    rect(ctx, 215, 56, 60, 1, '#2a3f5c');
  } else if (themeName === 'temple') {
    disc(ctx, 80, 70, 22, '#e0412b');
    disc(ctx, 74, 64, 5, '#c8322a');
    for (let i = 0; i < 4; i++) rect(ctx, 30 + i * 20, 62 + i * 9, 120 - i * 10, 2, '#5a1a40');
  } else if (themeName === 'mountain') {
    disc(ctx, 200, 120, 34, '#fff0b0');
    disc(ctx, 200, 120, 28, '#ffe08a');
    for (let i = 0; i < 5; i++) rect(ctx, 160, 122 + i * 6, 80, 2 + Math.floor(i / 2), '#f2b53a');
    for (let i = 0; i < 6; i++) {
      const bx = 40 + i * 23, by = 40 + (i % 3) * 8;
      rect(ctx, bx, by, 2, 1, '#5a0f17');
      rect(ctx, bx + 2, by - 1, 2, 1, '#5a0f17');
      rect(ctx, bx - 2, by - 1, 2, 1, '#5a0f17');
    }
  } else if (themeName === 'dragon') {
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2, r = 8 + rng() * 60;
      rect(ctx, 90 + Math.cos(a) * r * 1.6, 60 + Math.sin(a) * r * 0.6, 3, 1, rng() < 0.5 ? '#3a1a5a' : '#4a2a6a');
    }
    // la Porte des Esprits
    for (let k = 0; k < 3; k++) {
      for (let a = 0; a < Math.PI * 2; a += 0.04) {
        const r = 26 - k * 7;
        rect(ctx, 236 + Math.cos(a + k) * r, 56 + Math.sin(a + k) * r * 0.9, 2, 2, k === 0 ? '#a466c4' : k === 1 ? '#f2b53a' : '#ffe08a');
      }
    }
    disc(ctx, 236, 56, 6, '#ffffff');
  }
  return c;
}
function wrapDraw(cw, x, w, fn) {
  fn(x);
  if (x < 0) fn(x + cw);
  if (x + w > cw) fn(x - cw);
}
function ditherBand(ctx, y, h, col, cw) {
  ctx.fillStyle = col;
  for (let yy = 0; yy < h; yy++) {
    const density = yy / h;
    for (let x = 0; x < cw; x++) {
      const th = ((x * 7 + yy * 13) % 8) / 8;
      if (density > th) ctx.fillRect(x, y + yy, 1, 1);
    }
  }
}
function buildLayers(themeName) {
  const th = THEMES[themeName];
  const rng = mulberry32(themeName.length * 131 + 7);
  const CW = 640, CH = 240;
  const layers = [];
  const mk = () => makeCanvas(CW, CH);
  if (themeName === 'forest') {
    let [c, ctx] = mk();
    for (let i = 0; i < 12; i++) {
      const w = 26 + rng() * 26, h = 90 + rng() * 80, x = i * 54 + rng() * 20;
      wrapDraw(CW, x, w, (xx) => drawKarst(ctx, xx, 200, w, h, '#4f6e7e', '#6f8e98'));
    }
    ditherBand(ctx, 150, 40, '#8ab0a8', CW);
    rect(ctx, 0, 190, CW, 50, '#8ab0a8');
    layers.push({ c, fx: 0.12, fy: 0.1, offY: -20 });
    [c, ctx] = mk();
    for (let i = 0; i < 9; i++) {
      const w = 34 + rng() * 30, h = 70 + rng() * 70, x = i * 72 + rng() * 20;
      wrapDraw(CW, x, w, (xx) => drawKarst(ctx, xx, 215, w, h, '#2f5a52', '#3f6e62'));
      if (i === 3) wrapDraw(CW, x, w, (xx) => drawPagoda(ctx, xx + w / 2 - 17, 215 - h + 4, 3, '#1f3a36', '#16302c', '#3f6e62'));
    }
    ditherBand(ctx, 175, 30, '#5f8a7a', CW);
    rect(ctx, 0, 205, CW, 35, '#5f8a7a');
    layers.push({ c, fx: 0.28, fy: 0.2, offY: -10 });
    [c, ctx] = mk();
    for (let i = 0; i < 40; i++) {
      const x = rng() * CW;
      wrapDraw(CW, x, 20, (xx) => drawTree(ctx, xx, CH, 160 + rng() * 80, i % 2 ? '#1f4a2a' : '#245a30', '#2f6a3a', '#2a6a34', mulberry32(i)));
    }
    rect(ctx, 0, 215, CW, 25, '#10261a');
    layers.push({ c, fx: 0.55, fy: 0.45, offY: 0 });
    [c, ctx] = mk();
    for (let i = 0; i < 3; i++) {
      const x = 80 + i * 220 + rng() * 40;
      wrapDraw(CW, x, 30, (xx) => drawTree(ctx, xx, CH, 240, '#0a160e', '#122a18', '#0e2214', mulberry32(i + 50)));
      wrapDraw(CW, x + 9, 30, (xx) => drawTree(ctx, xx, CH, 240, '#0a160e', '#122a18', '#0e2214', mulberry32(i + 70)));
    }
    layers.push({ c, fx: 1.3, fy: 1.0, offY: 0, fg: true });
  } else if (themeName === 'temple') {
    let [c, ctx] = mk();
    for (let i = 0; i < 8; i++) {
      const w = 110 + rng() * 60, h = 60 + rng() * 60, x = i * 82;
      wrapDraw(CW, x, w, (xx) => drawMountain(ctx, xx, 210, w, h, '#4a2050', '#5e2a62', null));
    }
    ditherBand(ctx, 170, 30, '#7a3048', CW);
    rect(ctx, 0, 200, CW, 40, '#7a3048');
    layers.push({ c, fx: 0.12, fy: 0.1, offY: -20 });
    [c, ctx] = mk();
    for (let i = 0; i < 5; i++) {
      const x = i * 128 + rng() * 30;
      wrapDraw(CW, x, 90, (xx) => drawTemple(ctx, xx, 205, { w: 70, col: '#2a1030', wall: '#2a1030', roof: '#1e0a24', gold: '#4a2040', base: '#1e0a24', baseLight: '#2a1030', sign: false }));
      if (i % 2 === 0) wrapDraw(CW, x + 90, 40, (xx) => drawPagoda(ctx, xx, 205, 4, '#2a1030', '#1e0a24', '#4a2040'));
    }
    rect(ctx, 0, 205, CW, 35, '#1e0a24');
    layers.push({ c, fx: 0.3, fy: 0.2, offY: -10 });
    [c, ctx] = mk();
    for (let i = 0; i < 6; i++) {
      const x = i * 107 + 20;
      wrapDraw(CW, x, 12, (xx) => drawColumn(ctx, xx, 20, CH, '#3a0e18', '#6a4a20'));
      wrapDraw(CW, x + 30, 12, (xx) => {
        rect(ctx, xx, 30, 12, 50, '#4a1020');
        rect(ctx, xx, 30, 12, 2, '#6a4a20');
        poly(ctx, [[xx, 80], [xx + 12, 80], [xx + 6, 86]], '#4a1020');
        rect(ctx, xx + 4, 40, 4, 4, '#6a4a20');
      });
    }
    rect(ctx, 0, 0, CW, 22, '#24060e');
    for (let x = 0; x < CW; x += 8) rect(ctx, x, 20, 6, 4, '#3a0e18');
    rect(ctx, 0, 222, CW, 18, '#1a0610');
    layers.push({ c, fx: 0.55, fy: 0.45, offY: 0 });
    [c, ctx] = mk();
    for (let i = 0; i < 2; i++) {
      const x = 150 + i * 320;
      wrapDraw(CW, x, 18, (xx) => drawColumn(ctx, xx, 0, CH, '#12040a', '#2a1a10'));
    }
    layers.push({ c, fx: 1.3, fy: 1.0, offY: 0, fg: true });
  } else if (themeName === 'mountain') {
    let [c, ctx] = mk();
    for (let i = 0; i < 6; i++) {
      const w = 160 + rng() * 80, h = 110 + rng() * 60, x = i * 108;
      wrapDraw(CW, x, w, (xx) => drawMountain(ctx, xx, 220, w, h, '#7a2a3a', '#9a3a44', '#f8d0b8'));
    }
    ditherBand(ctx, 175, 30, '#f0a878', CW);
    rect(ctx, 0, 205, CW, 35, '#f0a878');
    layers.push({ c, fx: 0.1, fy: 0.08, offY: -10, drift: 0 });
    [c, ctx] = mk();
    for (let i = 0; i < 7; i++) {
      const w = 30 + rng() * 26, h = 100 + rng() * 60, x = i * 92 + rng() * 20;
      wrapDraw(CW, x, w, (xx) => {
        drawKarst(ctx, xx, 230, w, h, '#4a1a2e', '#5e2638');
        if (i % 2 === 0) {
          for (let k = 0; k < 3; k++) rect(ctx, xx + w / 2 - 2 + k * 2, 230 - h + 18, 1, h - 18, k === 1 ? '#ffffff' : '#bfe8ff');
        } else drawPagoda(ctx, xx + w / 2 - 17, 230 - h + 6, 3, '#3a1424', '#2a0e1a', '#7a3a3a');
      });
    }
    for (let i = 0; i < 8; i++) {
      const x = i * 80 + rng() * 20;
      wrapDraw(CW, x, 70, (xx) => drawCloud(ctx, xx, 200, 70, '#f8c890', '#fff0d0', '#e8a070'));
    }
    rect(ctx, 0, 200, CW, 40, '#f8c890');
    layers.push({ c, fx: 0.3, fy: 0.2, offY: -10 });
    [c, ctx] = mk();
    for (let i = 0; i < 14; i++) {
      const x = rng() * CW;
      wrapDraw(CW, x, 40, (xx) => drawPine(ctx, xx, 215 + rng() * 10, 50 + rng() * 40, '#2a0e18', '#3a1424'));
    }
    rect(ctx, 0, 220, CW, 20, '#2a0e18');
    layers.push({ c, fx: 0.55, fy: 0.45, offY: 0 });
    [c, ctx] = mk();
    for (let i = 0; i < 4; i++) {
      const x = i * 160 + rng() * 40;
      wrapDraw(CW, x, 80, (xx) => drawCloud(ctx, xx, 40 + rng() * 40, 80, '#fff0e0', '#ffffff', '#f0c8a8'));
    }
    layers.push({ c, fx: 0.4, fy: 0.3, offY: 0, drift: 6, clouds: true });
  } else {
    let [c, ctx] = mk();
    for (let i = 0; i < 5; i++) {
      const x = i * 128 + rng() * 40, y = 120 + rng() * 50, w = 60 + rng() * 30;
      wrapDraw(CW, x, w + 20, (xx) => {
        poly(ctx, [[xx, y], [xx + w, y], [xx + w * 0.7, y + 24], [xx + w * 0.45, y + 40], [xx + w * 0.2, y + 20]], '#2a1848');
        drawTemple(ctx, xx + 8, y, { w: w - 22, col: '#3a2060', wall: '#2a1848', roof: '#1e1038', gold: '#5a3a80', base: '#2a1848', baseLight: '#3a2060', sign: false });
      });
    }
    layers.push({ c, fx: 0.1, fy: 0.08, offY: -10 });
    [c, ctx] = mk();
    for (let i = 0; i < 3; i++) {
      const x = i * 213 + 40;
      wrapDraw(CW, x, 60, (xx) => drawDragonStatue(ctx, xx, 230, '#6a4a28', '#8a6a38', '#c46bff'));
      wrapDraw(CW, x + 70, 90, (xx) => drawTemple(ctx, xx, 230, { w: 80, col: '#8a5a20', wall: '#5a3a18', roof: '#3a2410', gold: '#c8902a' }));
    }
    rect(ctx, 0, 228, CW, 12, '#3a2410');
    layers.push({ c, fx: 0.3, fy: 0.2, offY: -10 });
    [c, ctx] = mk();
    for (let i = 0; i < 10; i++) {
      const x = i * 64 + rng() * 20;
      wrapDraw(CW, x, 70, (xx) => drawCloud(ctx, xx, 200 + rng() * 20, 64, '#c8902a', '#ffe08a', '#8a5a18'));
    }
    rect(ctx, 0, 215, CW, 25, '#c8902a');
    layers.push({ c, fx: 0.55, fy: 0.45, offY: 0 });
    [c, ctx] = mk();
    for (let i = 0; i < 3; i++) {
      const x = i * 213 + rng() * 40;
      wrapDraw(CW, x, 80, (xx) => drawCloud(ctx, xx, 30 + rng() * 50, 70, '#f2b53a', '#ffe08a', '#a8641c'));
    }
    layers.push({ c, fx: 0.45, fy: 0.3, offY: 0, drift: 8, clouds: true });
  }
  return layers;
}
// Brume qui défile
function buildMistCanvas(col) {
  const [c, ctx] = makeCanvas(256, 48);
  const rng = mulberry32(5);
  ctx.fillStyle = col;
  for (let i = 0; i < 9; i++) {
    const x = rng() * 256, y = 18 + rng() * 16, w = 40 + rng() * 60, h = 6 + rng() * 8;
    for (let yy = -h; yy <= h; yy++) {
      for (let xx = -w / 2; xx <= w / 2; xx++) {
        const d = (xx * xx) / ((w / 2) * (w / 2)) + (yy * yy) / (h * h);
        if (d < 1 && ((Math.floor(xx) + yy) & 1) === 0) {
          const px = ((Math.floor(x + xx) % 256) + 256) % 256;
          ctx.fillRect(px, Math.floor(y + yy), 1, 1);
        }
      }
    }
  }
  return c;
}
// Liquide dangereux animé
function buildHazardCanvas(th) {
  const hz = th.hazard;
  const [c, ctx] = makeCanvas(32, 16);
  rect(ctx, 0, 0, 32, 16, hz.mid);
  rect(ctx, 0, 8, 32, 8, hz.deep);
  for (let x = 0; x < 32; x++) {
    const y = Math.round(1.5 + Math.sin((x / 32) * Math.PI * 2) * 1.5);
    rect(ctx, x, 0, 1, y, 'rgba(0,0,0,0)');
    ctx.clearRect(x, 0, 1, y);
    rect(ctx, x, y, 1, 1, hz.foam);
    if (x % 8 < 3) rect(ctx, x, y + 1, 1, 1, hz.light);
  }
  rect(ctx, 6, 10, 2, 1, hz.light);
  rect(ctx, 22, 12, 3, 1, hz.light);
  return c;
}
function buildWaterfallCanvas() {
  const [c, ctx] = makeCanvas(16, 32);
  rect(ctx, 0, 0, 16, 32, '#7fc8f0');
  for (let i = 0; i < 10; i++) rect(ctx, (i * 5) % 16, (i * 11) % 32, 1, 6, '#ffffff');
  for (let i = 0; i < 6; i++) rect(ctx, (i * 7 + 2) % 16, (i * 13) % 32, 1, 4, '#3a8ac8');
  rect(ctx, 0, 0, 1, 32, '#3a8ac8');
  rect(ctx, 15, 0, 1, 32, '#3a8ac8');
  return c;
}
// Planche « dragon volant au loin » (64×24, 4 frames)
function buildFlyingDragonSheet(col, accent) {
  return buildSheet(64, 24, 4, (ctx, f) => drawDragon(ctx, 4, 12, 16, (f * Math.PI) / 2, col, accent), null);
}

// ---- Tuiles ----
function drawGroundTile(ctx, th, x, y, nb, rng, cracked = false) {
  const g = th.ground;
  rect(ctx, x, y, 16, 16, g.fill);
  if (g.style === 'lacquer') {
    const off = (y / 16) % 2 ? 4 : 0;
    rect(ctx, x, y + 7, 16, 1, g.dark);
    rect(ctx, x, y + 15, 16, 1, g.dark);
    rect(ctx, x + ((off + 6) % 16), y, 1, 7, g.dark);
    rect(ctx, x + ((off + 14) % 16), y + 8, 1, 7, g.dark);
    rect(ctx, x + 1, y + 1, 4, 1, g.speck);
  } else if (g.style === 'gold') {
    if (rng() < 0.35) line(ctx, x + rng() * 16, y + 2, x + rng() * 16, y + 14, '#5a3a80');
    if (rng() < 0.15) rect(ctx, x + 6, y + 6, 3, 3, '#a8641c');
    for (let i = 0; i < 3; i++) rect(ctx, x + Math.floor(rng() * 15), y + Math.floor(rng() * 15), 1, 1, g.speck);
  } else {
    for (let i = 0; i < 4; i++) rect(ctx, x + Math.floor(rng() * 14), y + Math.floor(rng() * 14), rng() < 0.5 ? 2 : 1, 1, g.speck);
    if (rng() < 0.3) rect(ctx, x + Math.floor(rng() * 12), y + Math.floor(rng() * 12), 3, 2, g.dark);
  }
  if (!nb.l) rect(ctx, x, y, 1, 16, g.edge);
  if (!nb.r) rect(ctx, x + 15, y, 1, 16, g.edge);
  if (!nb.d) rect(ctx, x, y + 15, 16, 1, g.edge);
  if (!nb.u) {
    if (g.style === 'grass') {
      rect(ctx, x, y, 16, 4, g.top);
      rect(ctx, x, y, 16, 1, g.topLight);
      rect(ctx, x, y + 4, 16, 1, g.topDark);
      for (let i = 0; i < 4; i++) {
        const gx = x + Math.floor(rng() * 15);
        rect(ctx, gx, y - 2, 1, 2, g.top);
        rect(ctx, gx + 1, y - 1, 1, 1, g.topLight);
      }
      if (rng() < 0.4) rect(ctx, x + Math.floor(rng() * 12), y + 5, 1, 3, g.topDark);
    } else if (g.style === 'lacquer') {
      rect(ctx, x, y, 16, 4, g.top);
      rect(ctx, x, y, 16, 1, g.topLight);
      rect(ctx, x, y + 4, 16, 1, g.topDark);
      rect(ctx, x + 7, y + 1, 2, 2, g.topLight);
    } else if (g.style === 'snow') {
      rect(ctx, x, y, 16, 3, g.top);
      rect(ctx, x, y, 16, 1, g.topLight);
      rect(ctx, x, y + 3, 16, 1, g.topDark);
      for (let i = 0; i < 2; i++) rect(ctx, x + 2 + Math.floor(rng() * 12), y + 4, 1, 1 + Math.floor(rng() * 3), '#bfe8ff');
      rect(ctx, x + Math.floor(rng() * 10), y - 1, 4, 1, g.top);
    } else {
      rect(ctx, x, y, 16, 3, g.top);
      rect(ctx, x, y, 16, 1, g.topLight);
      rect(ctx, x, y + 3, 16, 1, g.topDark);
      rect(ctx, x + 3, y + 1, 1, 1, g.topDark);
      rect(ctx, x + 11, y + 1, 1, 1, g.topDark);
      rect(ctx, x, y + 4, 16, 1, '#ffe08a');
    }
  }
  if (cracked) {
    line(ctx, x + 3, y + 3, x + 7, y + 8, g.edge);
    line(ctx, x + 7, y + 8, x + 5, y + 13, g.edge);
    line(ctx, x + 7, y + 8, x + 12, y + 10, g.edge);
  }
}
function drawWallTile(ctx, th, x, y, rng) {
  const w = th.wall;
  rect(ctx, x, y, 16, 16, w.base);
  rect(ctx, x, y, 1, 16, w.dark);
  rect(ctx, x + 15, y, 1, 16, w.dark);
  if (th === THEMES.forest) {
    const vx = x + 3 + Math.floor(rng() * 9);
    rect(ctx, vx, y, 1, 16, w.a);
    rect(ctx, vx - 2, y + 4, 2, 2, w.b);
    rect(ctx, vx + 1, y + 10, 2, 2, w.b);
    rect(ctx, x + 2, y + 13, 3, 1, w.dark);
  } else if (th === THEMES.mountain) {
    rect(ctx, x + 2, y + 4, 12, 2, w.a);
    rect(ctx, x + 3, y + 4, 8, 1, w.b);
    rect(ctx, x + 4, y + 12, 9, 2, w.a);
  } else {
    // treillis (temple / palais)
    rect(ctx, x + 1, y + 1, 14, 14, w.dark);
    rect(ctx, x + 3, y + 1, 1, 14, w.a);
    rect(ctx, x + 12, y + 1, 1, 14, w.a);
    rect(ctx, x + 1, y + 5, 14, 1, w.a);
    rect(ctx, x + 1, y + 11, 14, 1, w.a);
    rect(ctx, x + 7, y + 7, 2, 2, w.b);
  }
}
function drawBridgeTile(ctx, th, x, y, leftEnd, rightEnd) {
  rect(ctx, x, y, 16, 5, th.wood);
  rect(ctx, x, y, 16, 1, th.woodLight);
  rect(ctx, x, y + 5, 16, 1, th.woodDark);
  for (let i = 0; i < 16; i += 5) rect(ctx, x + i, y + 1, 1, 4, th.woodDark);
  rect(ctx, x, y - 7, 16, 1, th.rope);
  if (leftEnd || rightEnd) {
    const px = leftEnd ? x : x + 14;
    rect(ctx, px, y - 9, 2, 9, th.woodDark);
    rect(ctx, px, y - 10, 2, 1, PAL.gold);
  }
  if (!leftEnd && !rightEnd) rect(ctx, x + 7, y - 6, 1, 6, th.rope);
}
function drawSuspendedTile(ctx, th, x, y, chain) {
  rect(ctx, x, y, 16, 6, PAL.stone);
  rect(ctx, x, y, 16, 1, PAL.stoneLight);
  rect(ctx, x, y + 5, 16, 1, PAL.stoneDark);
  rect(ctx, x + 6, y + 2, 4, 2, th.ground.top);
  if (chain) {
    for (let yy = y - 2; yy > y - 60 && yy > 0; yy -= 3) {
      rect(ctx, x + 2, yy, 1, 2, '#8a8690');
      rect(ctx, x + 13, yy, 1, 2, '#8a8690');
    }
  }
}
function drawSpikeTile(ctx, th, x, y) {
  const s = th.spike;
  rect(ctx, x, y + 13, 16, 3, s.c);
  for (let i = 0; i < 4; i++) {
    const sx = x + i * 4;
    poly(ctx, [[sx, y + 14], [sx + 2, y + 5], [sx + 4, y + 14]], s.b);
    rect(ctx, sx + 1, y + 7, 1, 6, s.a);
  }
}

// =========================================================================
// 10a. DONNÉES DES NIVEAUX
// Légende des cartes (tuiles de 16 px, 15 rangées) :
//   #  sol            W  mur à rebond        X  mur fissuré (secret)
//   =  pont (traversable par dessous)        -  plateforme suspendue
//   M  plateforme mobile horizontale         V  plateforme mobile verticale
//   C  plateforme qui s'effondre             B  plateforme rebondissante
//   ^  pics          ~  zone dangereuse (marais, lave, eau maudite, néant)
//   o  pièce de jade q orbe de Qi  h pêche  f fleur spirituelle  r relique
//   k  point de contrôle  s panneau  n PNJ  x vase  b cloche  P départ
//   d w g u m y  ennemis (selon le niveau)   E arène du boss  Z boss
//   L lanterne  t torche  T temple  p pagode  S statue de dragon
//   I colonne  A portique  F cascade
// =========================================================================
const ENEMY_TYPES = {
  imp: { cls: 'BasicDemon', sheet: () => ART.imps.red, hp: 4, dmg: 1, speed: 38, chase: 72, score: 100 },
  impPurple: { cls: 'BasicDemon', sheet: () => ART.imps.purple, hp: 6, dmg: 1, speed: 44, chase: 82, score: 120 },
  impFire: { cls: 'BasicDemon', sheet: () => ART.imps.fire, hp: 7, dmg: 1, speed: 50, chase: 90, score: 140 },
  impVoid: { cls: 'BasicDemon', sheet: () => ART.imps.void, hp: 8, dmg: 1, speed: 54, chase: 96, score: 160 },
  soldier: { cls: 'Warrior', sheet: () => ART.warriors.soldier, hp: 9, dmg: 1, speed: 28, chase: 52, score: 200, reach: 26 },
  ghost: { cls: 'Warrior', sheet: () => ART.warriors.ghost, hp: 10, dmg: 1, speed: 34, chase: 64, score: 250, reach: 26, ghost: true },
  statue: { cls: 'Warrior', sheet: () => ART.warriors.statue, hp: 18, dmg: 2, speed: 18, chase: 34, score: 400, reach: 24, heavy: true, dormant: true },
  monk: { cls: 'Warrior', sheet: () => ART.warriors.monk, hp: 8, dmg: 1, speed: 26, chase: 40, score: 300, ranged: 'fireball' },
  celestial: { cls: 'Warrior', sheet: () => ART.warriors.celestial, hp: 13, dmg: 1, speed: 34, chase: 66, score: 320, reach: 32 },
  guard: { cls: 'Warrior', sheet: () => ART.warriors.guard, hp: 16, dmg: 2, speed: 36, chase: 70, score: 400, reach: 32 },
  sorcerer: { cls: 'Warrior', sheet: () => ART.warriors.sorcerer, hp: 10, dmg: 1, speed: 26, chase: 40, score: 380, ranged: 'voidball' },
  wisp: { cls: 'FlyingSpirit', sheet: () => ART.spirits.wisp, hp: 3, dmg: 1, speed: 40, score: 120, mode: 'dive' },
  ghostflame: { cls: 'FlyingSpirit', sheet: () => ART.spirits.ghostflame, hp: 5, dmg: 1, speed: 36, score: 180, mode: 'shoot', proj: 'fireball' },
  wind: { cls: 'FlyingSpirit', sheet: () => ART.spirits.wind, hp: 6, dmg: 1, speed: 46, score: 220, mode: 'shoot', proj: 'windblade' },
  bat: { cls: 'FlyingSpirit', sheet: () => ART.spirits.bat, hp: 5, dmg: 1, speed: 60, score: 200, mode: 'dive' },
  voidSpirit: { cls: 'FlyingSpirit', sheet: () => ART.spirits.void, hp: 7, dmg: 1, speed: 48, score: 260, mode: 'shoot', proj: 'voidball' },
};

const LEVELS = [
  {
    theme: 'forest', music: 'forest', name: 'FORÊT DE BAMBOUS', subtitle: 'PREMIER FRAGMENT DE QI',
    enemies: { d: 'imp', w: 'soldier', g: 'wisp' },
    npc: { style: 0, name: 'MAÎTRE LU', lines: [
      'Ah, te voilà enfin, jeune immortel.',
      'Le Dragon Céleste est tombé, et son Qi s\'est brisé en quatre fragments.',
      'Le Roi Dragon Déchu veut les réunir pour ouvrir la Porte des Esprits.',
      'Traverse la forêt : le Général Corrompu garde le premier fragment.',
      'Les lanternes de pierre te serviront de refuge. Va, et que le Qi te guide !',
    ] },
    signs: [
      '← → ou A / D : se déplacer.  ESPACE : sauter. Appuyez de nouveau en l\'air pour un double saut.',
      'J : attaquer. Enchaînez trois coups pour un combo dévastateur. Attention aux pieux de bambou !',
      'SHIFT : dash. Vous êtes invulnérable pendant le dash. Les planches fissurées s\'effondrent !',
      'Sautez contre les parois couvertes de lianes pour rebondir. Certains murs fissurés cachent des secrets...',
      'K : vague de Qi (30 Qi). Frapper les ennemis recharge votre Qi. Le Général vous attend plus loin.',
    ],
    boss: { kind: 'general', name: 'LE GÉNÉRAL CORROMPU', title: 'GARDIEN DU PREMIER FRAGMENT' },
    sections: [
      [
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '........................o.o.o...',
        '.......................=====....',
        '................................',
        '..................===...........',
        '..P..n....s....L............x...',
        '################################',
        '################################',
        '################################',
      ],
      [
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '............o.o...............',
        '...........=====..............',
        '...s..d.................^^..d.',
        '########......################',
        '########......################',
        '########......################',
      ],
      [
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '...........g.........g............',
        '..................................',
        '...............o..o...............',
        '.........o..o..====....o..o.......',
        '..k..L...====........====....L....',
        '...........................x...w..',
        '#######~~~~~~~~~~~~~~~~~~~~#######',
        '#######~~~~~~~~~~~~~~~~~~~~#######',
        '##################################',
      ],
      [
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '...................o.o..........',
        '...............o.o..............',
        '...................CC...........',
        '........MMM....CC...............',
        '..s..........................d..',
        '#######..................#######',
        '#######..................#######',
        '#######..................#######',
      ],
      [
        '..................................',
        '..................................',
        '....f.............................',
        '...===............................',
        '..................................',
        '..........W.......o.o.o.o.........',
        '..........W...####################',
        '..........W...W###################',
        '..........W...W###################',
        '..........W...W#...........#######',
        '..s...B...W...XX..d........#######',
        '..............XX.....x...r.#######',
        '##################################',
        '##################################',
        '##################################',
      ],
      [
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '.........o.o........................',
        '...........g........................',
        '#####...............................',
        '#####...............................',
        '#######......q......................',
        '#######....-----....................',
        '#########..................g........',
        '#########....w.....x..d.s.k...L..w..',
        '####################################',
        '####################################',
        '####################################',
      ],
      [
        '.......................#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.........---......---..#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.L..E.........Z........#',
        '########################',
        '########################',
        '########################',
      ],
    ],
  },
  {
    theme: 'temple', music: 'temple', name: 'TEMPLE OUBLIÉ', subtitle: 'DEUXIÈME FRAGMENT DE QI',
    enemies: { d: 'impPurple', w: 'ghost', u: 'statue', m: 'monk', g: 'ghostflame' },
    npc: { style: 1, name: 'NONNE MEI', lines: [
      'Ce temple était autrefois le cœur de notre ordre.',
      'Les moines ont cédé aux murmures du Roi Dragon. Leurs esprits errent encore.',
      'Méfie-toi des statues : la corruption leur a donné vie.',
      'Le Gardien de Jade protège le deuxième fragment, au fond du sanctuaire.',
    ] },
    signs: [
      'Frappez les cloches de bronze : leur chant restaure le Qi. Les statues ne dorment que d\'un œil...',
      'La lave sacrée brûle tout ce qui la touche. Les plateformes de pierre montent et descendent.',
      'Le Gardien de Jade charge et fait trembler le sol. Sautez par-dessus ses ondes de choc !',
    ],
    boss: { kind: 'lion', name: 'LE GARDIEN DE JADE', title: 'LION SACRÉ DU TEMPLE OUBLIÉ' },
    sections: [
      [
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '........................o.o.o.',
        '..............................',
        '...................t##########',
        '..................############',
        '..P.n..s..t.S...##############',
        '##############################',
        '##############################',
        '##############################',
      ],
      [
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '...................o.o............',
        '...................---............',
        '..I.......w...I...........b...m...',
        '##################.....###########',
        '##################.....###########',
        '##################.....###########',
        '##################^^^^^###########',
        '##################################',
        '##################################',
      ],
      [
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '.................o.o..............',
        '..................................',
        '..k..t..........VV.......o........',
        '######..s.........................',
        '######.....VV.........CC..........',
        '######.....................t..u...',
        '##########~~~~~~~~~~~~~~~~########',
        '##########~~~~~~~~~~~~~~~~########',
        '##################################',
      ],
      [
        '................................',
        '..........................f.....',
        '.........................===....',
        '......r.........................',
        '.....---..........---...........',
        '................................',
        '..........---..........---......',
        '..............g.................',
        '.....---..........---...........',
        '................................',
        '..........---........g..........',
        '..b......w.......u.......x...m..',
        '################################',
        '################################',
        '################################',
      ],
      [
        '.......................#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.........---......---..#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.ks.E.........Z......t.#',
        '########################',
        '########################',
        '########################',
      ],
    ],
  },
  {
    theme: 'mountain', music: 'mountain', name: 'MONTAGNE CÉLESTE', subtitle: 'TROISIÈME FRAGMENT DE QI',
    enemies: { d: 'impFire', w: 'celestial', g: 'wind', y: 'bat' },
    npc: { style: 2, name: 'PÈLERIN SHEN', lines: [
      'Voilà sept ans que je gravis cette montagne sans en voir le sommet.',
      'Les vents sont devenus fous depuis la chute du Dragon Céleste.',
      'Leur Seigneur garde le troisième fragment sur la plus haute cime.',
      'Les tambours de guerre te propulseront dans les airs. Bonne ascension !',
    ] },
    signs: [
      'Les plateformes de bois glissent au-dessus du vide : observez leur rythme avant de sauter.',
      'Le Seigneur des Vents attaque depuis les airs. Utilisez le double saut et la vague de Qi !',
    ],
    boss: { kind: 'wind', name: 'LE SEIGNEUR DES VENTS', title: 'MAÎTRE DES CIMES CÉLESTES' },
    sections: [
      [
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..................o.o.o.......',
        '.................=======......',
        '..............................',
        '..............................',
        '..P..n..s..p...........d......',
        '############.....#############',
        '############.....#############',
        '############.....#############',
      ],
      [
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '..........F.......................',
        '.................g................',
        '...............................o..',
        '......................o.o.........',
        '.....................MMM...#######',
        '...........MMM.............#######',
        '...........................#######',
        '..k..L.....................#######',
        '#########..................#######',
        '#########..................#######',
        '#########..................#######',
      ],
      [
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '........y............y............',
        '..................................',
        '..................................',
        '.....w....p.......................',
        '##############....................',
        '##############....................',
        '########.....X....................',
        '########..r..X..B..^^^^^^^...w....',
        '##################################',
        '##################################',
        '##################################',
      ],
      [
        '..................................',
        '..............................f...',
        '.............................===..',
        '..................................',
        '.......................CC.........',
        '.................g................',
        '..................CC..............',
        '......................y...........',
        '.............CC...................',
        '..................................',
        '........CC........................',
        '..k..L..........d.......w.....L...',
        '##################################',
        '##################################',
        '##################################',
      ],
      [
        '.......................#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.......................#',
        '........---.......---..#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.Ls.E.........Z........#',
        '########################',
        '########################',
        '########################',
      ],
    ],
  },
  {
    theme: 'dragon', music: 'dragon', name: 'ROYAUME DU DRAGON', subtitle: 'LE DERNIER FRAGMENT',
    enemies: { d: 'impVoid', w: 'guard', m: 'sorcerer', g: 'voidSpirit', y: 'bat', u: 'statue' },
    npc: { style: 3, name: 'ESPRIT DE LA GRUE', lines: [
      'Je suis ce qui reste de la bonté du Dragon Céleste.',
      'Sa colère est devenue le Roi Dragon Déchu. Il ne peut plus être sauvé...',
      'Mais tu peux le libérer. Frappe sa tête quand elle s\'approche.',
      'Quand il deviendra violet, sa fureur doublera. Ne perds pas espoir.',
    ] },
    signs: [
      'Le néant dévore tout ce qui y tombe. Gardez l\'équilibre sur les plateformes célestes.',
      'Au-delà de ces portes : la Porte des Esprits. C\'est votre dernière chance de vous préparer.',
    ],
    boss: { kind: 'dragon', name: 'LE ROI DRAGON DÉCHU', title: 'SOUVERAIN DE LA PORTE DES ESPRITS' },
    sections: [
      [
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '......................o.o.o...',
        '.....................=====....',
        '..............................',
        '................===...........',
        '..P..n..s..A..........S....d..',
        '##############################',
        '##############################',
        '##############################',
      ],
      [
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '..............g..........g........',
        '..................................',
        '...........o.o.o......o.o.o.......',
        '..........MMM.........MMM.........',
        '...............---................',
        '...x..........................d...',
        '######~~~~~~~~~~~~~~~~~~~~~~~~####',
        '######~~~~~~~~~~~~~~~~~~~~~~~~####',
        '##################################',
      ],
      [
        '..................................',
        '..................................',
        '..................................',
        '..................................',
        '................r.................',
        '...............o.o.o..............',
        '..................................',
        '............==========......m.....',
        '..........................=====...',
        '.......VV.........................',
        '..................................',
        '..u.........w.........x....w....t.',
        '##################################',
        '##################################',
        '##################################',
      ],
      [
        '................................',
        '...f............................',
        '..===...........................',
        '................................',
        '................................',
        '................................',
        '................y...............',
        '................................',
        '........######..................',
        '........#....X..................',
        '........#....X..........g.......',
        '..B.....#.r..X....^^^^..s...k...',
        '################################',
        '################################',
        '################################',
      ],
      [
        '.......................#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.......................#',
        '........---.......---..#',
        '.......................#',
        '.......................#',
        '.......................#',
        '.t..E.........Z......t.#',
        '########################',
        '########################',
        '########################',
      ],
    ],
  },
];

// =========================================================================
// 10b. NIVEAU — tuiles, collisions, construction des décors
// =========================================================================
const T_EMPTY = 0, T_SOLID = 1, T_WALL = 2, T_ONEWAY = 3, T_SPIKE = 4, T_HAZARD = 5, T_BREAK = 6, T_GATE = 7;
const isSolidTile = (t) => t === T_SOLID || t === T_WALL || t === T_BREAK || t === T_GATE;

// Déplacement d'un corps avec collisions (tuiles + plateformes dynamiques)
function moveBody(b, level, dt, usePlatforms = true) {
  const res = { hitX: 0, landed: false, ceil: false, platform: null };
  if (b.standingOn) {
    b.x += b.standingOn.dx;
    b.y += b.standingOn.dy;
  }
  b.standingOn = null;
  // axe X
  b.x += b.vx * dt;
  const top = Math.floor(b.y / TILE), bot = Math.floor((b.y + b.h - 0.01) / TILE);
  if (b.vx > 0) {
    const tx = Math.floor((b.x + b.w - 0.01) / TILE);
    for (let ty = top; ty <= bot; ty++) {
      if (level.solidAt(tx, ty)) { b.x = tx * TILE - b.w; b.vx = 0; res.hitX = 1; break; }
    }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x / TILE);
    for (let ty = top; ty <= bot; ty++) {
      if (level.solidAt(tx, ty)) { b.x = (tx + 1) * TILE; b.vx = 0; res.hitX = -1; break; }
    }
  }
  // axe Y
  const prevBottom = b.y + b.h;
  b.y += b.vy * dt;
  b.onGround = false;
  const l = Math.floor(b.x / TILE), r = Math.floor((b.x + b.w - 0.01) / TILE);
  if (b.vy >= 0) {
    const ty = Math.floor((b.y + b.h) / TILE);
    for (let tx = l; tx <= r; tx++) {
      const t = level.tileAt(tx, ty);
      if (isSolidTile(t) || (t === T_ONEWAY && !b.dropThrough && prevBottom <= ty * TILE + 0.5)) {
        b.y = ty * TILE - b.h;
        b.vy = 0;
        b.onGround = true;
        res.landed = true;
        break;
      }
    }
  } else {
    const ty = Math.floor(b.y / TILE);
    for (let tx = l; tx <= r; tx++) {
      if (level.solidAt(tx, ty)) { b.y = (ty + 1) * TILE; b.vy = 0; res.ceil = true; break; }
    }
  }
  if (usePlatforms && b.vy >= 0 && !b.onGround) {
    for (const p of level.platforms) {
      if (!p.solid) continue;
      if (b.x + b.w > p.x + 1 && b.x < p.x + p.w - 1 && prevBottom <= p.y + 1.5 + Math.max(0, p.dy) && b.y + b.h >= p.y) {
        b.y = p.y - b.h;
        b.vy = 0;
        b.onGround = true;
        b.standingOn = p;
        res.landed = true;
        res.platform = p;
        break;
      }
    }
  }
  return res;
}

// ---- Plateformes dynamiques ----
class Platform {
  constructor(level, type, x, y, w) {
    this.level = level;
    this.type = type; // moving | vertical | crumble | bounce
    this.x = this.baseX = x;
    this.y = this.baseY = y;
    this.w = w;
    this.h = 8;
    this.dx = 0;
    this.dy = 0;
    this.t = (x * 0.013) % (Math.PI * 2);
    this.state = 'idle';
    this.timer = 0;
    this.squash = 0;
    const th = level.theme;
    this.sprite = new Sprite(level.group, buildSheet(w, 14, 2, (ctx, f) => Platform.draw(ctx, type, w, f, th)), 9);
    level.ownSheets.push(this.sprite.sheet);
  }
  static draw(ctx, type, w, f, th) {
    const pc = th.platform;
    if (type === 'bounce') {
      for (let x = 0; x < w; x += 16) {
        const sq = f ? 2 : 0;
        rect(ctx, x + 1, 2 + sq, 14, 3, PAL.ivory);
        rect(ctx, x + 1, 5 + sq, 14, 7 - sq, PAL.red);
        rect(ctx, x + 1, 5 + sq, 14, 1, PAL.gold);
        rect(ctx, x + 1, 11, 14, 1, PAL.gold);
        rect(ctx, x + 3, 7 + sq, 1, 1, PAL.goldLight);
        rect(ctx, x + 12, 7 + sq, 1, 1, PAL.goldLight);
        rect(ctx, x + 6, 3 + sq, 4, 1, PAL.ivoryDark);
      }
      return;
    }
    rect(ctx, 0, 1, w, 6, pc.a);
    rect(ctx, 0, 1, w, 1, pc.b);
    rect(ctx, 0, 6, w, 1, pc.c);
    for (let x = 0; x < w; x += 8) rect(ctx, x + 3, 3, 1, 2, pc.c);
    if (type === 'crumble') {
      for (let x = 4; x < w; x += 11) {
        line(ctx, x, 1, x + 2, 4, pc.c);
        line(ctx, x + 2, 4, x + 1, 6, pc.c);
      }
      rect(ctx, 2, 7, 2, 2 + f, pc.c);
      rect(ctx, w - 5, 7, 2, 1 + f, pc.c);
    } else {
      rect(ctx, 0, 1, 2, 6, PAL.gold);
      rect(ctx, w - 2, 1, 2, 6, PAL.gold);
      rect(ctx, w / 2 - 2, 7, 4, 3, pc.c);
      rect(ctx, w / 2 - 1, 10, 2, 2, PAL.gold);
    }
  }
  get solid() { return this.state !== 'fallen'; }
  onStand(body) {
    if (this.type === 'crumble' && this.state === 'idle') {
      this.state = 'shaking';
      this.timer = 0.45;
      this.level.game.audio.play('crumble');
    }
    if (this.type === 'bounce' && body.isPlayer) {
      body.bounce(480);
      this.squash = 0.15;
      this.level.game.audio.play('bounce');
      this.level.game.fx.burst(this.x + this.w / 2, this.y, 8, [PAL.gold, PAL.ivory], 60, 0.4);
    }
  }
  update(dt) {
    const ox = this.x, oy = this.y;
    this.t += dt;
    if (this.type === 'moving') this.x = this.baseX + Math.sin(this.t * 1.1) * 40;
    else if (this.type === 'vertical') this.y = this.baseY + Math.sin(this.t * 1.2) * 28;
    else if (this.type === 'crumble') {
      if (this.state === 'shaking') {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'fallen';
          this.timer = 3;
          const g = this.level.game;
          for (let i = 0; i < this.w; i += 4) g.fx.debris(this.x + i, this.y + 3, this.level.theme.platform.a);
        }
      } else if (this.state === 'fallen') {
        this.timer -= dt;
        if (this.timer <= 0) this.state = 'idle';
      }
    }
    if (this.squash > 0) this.squash -= dt;
    this.dx = this.x - ox;
    this.dy = this.y - oy;
    const shake = this.state === 'shaking' ? (Math.random() < 0.5 ? -1 : 1) : 0;
    this.sprite.visible = this.state !== 'fallen';
    this.sprite.setFrame(this.squash > 0 || this.state === 'shaking' ? 1 : 0);
    this.sprite.setPos(this.x + shake, this.y - (this.type === 'bounce' ? 3 : 1));
  }
}

// ---- Caméra side-scroller ----
class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.look = 0;
    this.shakeT = 0;
    this.shakeMag = 0;
    this.ox = 0;
    this.oy = 0;
    this.minX = 0;
    this.maxX = 0;
    this.minY = 0;
    this.maxY = 0;
    this.lock = null;
  }
  setBounds(level) {
    this.minX = 0;
    this.maxX = level.pw - W;
    this.minY = 0;
    this.maxY = level.ph - H;
  }
  target(p) {
    let tx = p.x + p.w / 2 - W / 2 + this.look;
    let ty = p.y + p.h / 2 - H * 0.58;
    let minX = this.minX, maxX = this.maxX;
    if (this.lock) { minX = maxX = this.lock.x; ty = this.lock.y; }
    return [clamp(tx, minX, maxX), clamp(ty, this.minY, this.maxY)];
  }
  snap(p) {
    this.look = p.facing * 28;
    [this.x, this.y] = this.target(p);
  }
  shake(mag, dur) {
    if (mag >= this.shakeMag || this.shakeT <= 0) {
      this.shakeMag = mag;
      this.shakeT = dur;
    }
  }
  update(dt, p) {
    this.look = approach(this.look, p.facing * 28 + p.vx * 0.12, 70 * dt);
    const [tx, ty] = this.target(p);
    this.x += (tx - this.x) * Math.min(1, dt * (this.lock ? 3 : 6));
    this.y += (ty - this.y) * Math.min(1, dt * 4.5);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.ox = (Math.random() * 2 - 1) * this.shakeMag;
      this.oy = (Math.random() * 2 - 1) * this.shakeMag;
    } else {
      this.ox = this.oy = 0;
      this.shakeMag = 0;
    }
  }
  get rx() { return Math.round(this.x + this.ox); }
  get ry() { return Math.round(this.y + this.oy); }
}

// ---- Objets du monde : vases, cloches, murs secrets, points de contrôle, panneaux, PNJ ----
class WorldObject {
  constructor(level, kind, x, y, w, h) {
    this.level = level;
    this.game = level.game;
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.dead = false;
    this.hitBy = -1;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  onHit() { return false; }
  update() {}
  dispose() { if (this.sprite) this.sprite.dispose(); if (this.glow) this.glow.dispose(); }
}
class Vase extends WorldObject {
  constructor(level, x, groundY) {
    super(level, 'vase', x + 2, groundY - 14, 12, 14);
    this.sprite = new Sprite(level.group, ART.vase, 11);
    this.sprite.setPos(this.x - 1, this.y - 1);
  }
  onHit() {
    this.dead = true;
    this.game.audio.play('break');
    this.game.fx.burst(this.cx, this.cy, 12, [PAL.ivory, PAL.blue, PAL.white], 90, 0.6, 160);
    const n = randi(2, 4);
    for (let i = 0; i < n; i++) this.level.spawnPickup('coin', this.cx, this.cy, true);
    if (Math.random() < 0.3) this.level.spawnPickup(Math.random() < 0.5 ? 'orb' : 'peach', this.cx, this.cy, true);
    this.game.addScore(20);
    return true;
  }
}
class Bell extends WorldObject {
  constructor(level, x, groundY) {
    super(level, 'bell', x + 1, groundY - 37, 13, 15);
    this.sprite = new Sprite(level.group, ART.bell, 11);
    this.swing = 0;
    this.cool = 0;
  }
  onHit() {
    if (this.cool > 0) return false;
    this.cool = 1.2;
    this.swing = 1;
    this.game.audio.play('bell');
    this.game.gainQi(35);
    this.game.fx.ring(this.cx, this.cy, PAL.gold, 18);
    this.game.addScore(50);
    return true;
  }
  update(dt) {
    this.cool -= dt;
    this.swing = Math.max(0, this.swing - dt * 0.7);
    const off = Math.sin(this.level.time * 14) * 3 * this.swing;
    this.sprite.setPos(this.x - 1 + off, this.y - 1);
  }
}
class BreakWall extends WorldObject {
  constructor(level, cells) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [cx, cy] of cells) { x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy); }
    super(level, 'wall', x0 * TILE, y0 * TILE, (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE);
    this.cells = cells;
    this.hp = 3;
    const th = level.theme;
    const sheet = buildSheet(this.w, this.h, 1, (ctx) => {
      for (const [cx, cy] of cells) {
        const rng = mulberry32(cx * 31 + cy * 17);
        drawGroundTile(ctx, th, (cx - x0) * TILE, (cy - y0) * TILE, { l: true, r: true, u: true, d: true }, rng, true);
      }
    }, null);
    level.ownSheets.push(sheet);
    this.sprite = new Sprite(level.group, sheet, 8);
    this.sprite.setPos(this.x, this.y);
    this.shakeT = 0;
    // la salle secrète derrière le mur reste masquée par de la roche
    const room = BreakWall.findRoom(level, cells);
    this.cover = null;
    if (room) {
      let rx0 = Infinity, ry0 = Infinity, rx1 = -Infinity, ry1 = -Infinity;
      for (const [cx, cy] of room) { rx0 = Math.min(rx0, cx); ry0 = Math.min(ry0, cy); rx1 = Math.max(rx1, cx); ry1 = Math.max(ry1, cy); }
      const csheet = buildSheet((rx1 - rx0 + 1) * TILE, (ry1 - ry0 + 1) * TILE, 1, (ctx) => {
        for (const [cx, cy] of room) drawGroundTile(ctx, th, (cx - rx0) * TILE, (cy - ry0) * TILE, { l: true, r: true, u: true, d: true }, mulberry32(cx * 13 + cy * 7));
      }, null);
      level.ownSheets.push(csheet);
      this.cover = new Sprite(level.group, csheet, 21);
      this.cover.setPos(rx0 * TILE, ry0 * TILE);
      this.coverA = 1;
    }
  }
  static findRoom(level, cells) {
    const open = (x, y) => y >= 0 && x >= 0 && x < level.w && y < level.h && !level.solidAt(x, y);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [cx, cy] of cells) {
      for (const [dx, dy] of dirs) {
        const sx = cx + dx, sy = cy + dy;
        if (!open(sx, sy)) continue;
        const seen = new Set([sy * level.w + sx]), stack = [[sx, sy]], out = [];
        let ok = true;
        while (stack.length && ok) {
          const [x, y] = stack.pop();
          out.push([x, y]);
          if (out.length > 90) ok = false;
          for (const [ex, ey] of dirs) {
            const nx = x + ex, ny = y + ey, k = ny * level.w + nx;
            if (ny < 0) { ok = false; break; }
            if (open(nx, ny) && !seen.has(k)) { seen.add(k); stack.push([nx, ny]); }
          }
        }
        if (ok) return out;
      }
    }
    return null;
  }
  onHit() {
    if (this.broken) return false;
    this.hp--;
    this.shakeT = 0.15;
    this.game.audio.play('hit');
    this.game.fx.burst(this.cx, this.cy, 6, [this.level.theme.ground.fill, this.level.theme.ground.speck], 70, 0.5, 200);
    if (this.hp <= 0) {
      this.broken = true;
      this.sprite.visible = false;
      for (const [cx, cy] of this.cells) {
        this.level.tiles[cy * this.level.w + cx] = T_EMPTY;
        for (let i = 0; i < 4; i++) this.game.fx.debris(cx * TILE + rand(0, 16), cy * TILE + rand(0, 16), this.level.theme.ground.fill);
      }
      this.game.audio.play('break');
      this.game.audio.play('relic');
      this.game.toast('UN PASSAGE SECRET !', PAL.goldLight);
      this.game.camera.shake(3, 0.25);
    }
    return true;
  }
  update(dt) {
    this.shakeT -= dt;
    this.sprite.setPos(this.x + (this.shakeT > 0 ? randi(-1, 1) : 0), this.y);
    if (this.broken) {
      this.coverA -= dt * 2;
      if (this.cover) this.cover.setOpacity(Math.max(0, this.coverA));
      if (!this.cover || this.coverA <= 0) this.dead = true;
    }
  }
  dispose() {
    super.dispose();
    if (this.cover) this.cover.dispose();
  }
}
class Checkpoint extends WorldObject {
  constructor(level, x, groundY, index) {
    super(level, 'checkpoint', x, groundY - 30, 16, 30);
    this.index = index;
    this.sprite = new Sprite(level.group, ART.checkpoint, 9);
    this.sprite.setPos(this.x, this.y);
    this.active = level.game.levelState.checkpoint === index;
    this.glow = new Glow(level.group, 56, 0xffc860, 0.55, 0.2);
    this.glow.setCenter(this.x + 8, this.y + 10);
    this.glow.sprite.visible = this.active;
    this.sprite.setFrame(this.active ? 1 : 0);
  }
  activate() {
    if (this.active) return;
    const g = this.game;
    for (const o of this.level.objects) if (o instanceof Checkpoint && o !== this) { o.active = false; o.sprite.setFrame(0); o.glow.sprite.visible = false; }
    this.active = true;
    this.sprite.setFrame(1);
    this.glow.sprite.visible = true;
    g.levelState.checkpoint = this.index;
    g.hp = g.maxHp;
    g.qi = g.maxQi;
    g.audio.play('checkpoint');
    g.fx.ring(this.x + 8, this.y + 10, PAL.goldLight, 24);
    g.fx.burst(this.x + 8, this.y + 10, 20, [PAL.gold, PAL.goldLight, PAL.white], 70, 0.9, -40);
    g.toast('POINT DE CONTRÔLE — VIE ET QI RESTAURÉS', PAL.goldLight);
  }
  update() { this.glow.update(this.level.time); }
}
class Sign extends WorldObject {
  constructor(level, x, groundY, text) {
    super(level, 'sign', x, groundY - 17, 16, 17);
    this.text = text;
    this.sprite = new Sprite(level.group, ART.sign, 9);
    this.sprite.setPos(this.x, this.y);
    this.prompt = 'LIRE';
  }
  interact() { this.game.openDialog('PANNEAU', [this.text]); }
}
class NPC extends WorldObject {
  constructor(level, x, groundY, def) {
    super(level, 'npc', x, groundY - 29, 16, 29);
    this.def = def;
    this.sprite = new Sprite(level.group, ART.npcs[def.style], 10);
    this.sprite.setPos(this.x, this.y);
    this.prompt = 'PARLER';
    this.talked = false;
  }
  interact() {
    this.game.openDialog(this.def.name, this.def.lines);
    if (!this.talked) {
      this.talked = true;
      this.game.addScore(50);
    }
  }
  update() {
    const p = this.level.player;
    this.sprite.setFlip(p && p.x < this.x);
    this.sprite.setFrame(Math.floor(this.level.time * 1.5) % 2);
  }
}
// Porte de l'arène du boss
class Gate extends WorldObject {
  constructor(level, col) {
    super(level, 'gate', col * TILE, 8 * TILE, TILE, 64);
    this.col = col;
    const th = level.theme;
    const sheet = buildSheet(16, 64, 1, (ctx) => drawGate(ctx, th));
    level.ownSheets.push(sheet);
    this.sprite = new Sprite(level.group, sheet, 9);
    this.raise = 0;
    this.closed = false;
    this.sprite.visible = false;
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.sprite.visible = true;
    for (let r = 8; r <= 11; r++) this.level.tiles[r * this.level.w + this.col] = T_GATE;
    this.game.audio.play('gate');
    this.game.camera.shake(3, 0.4);
  }
  open() {
    this.closed = false;
    for (let r = 8; r <= 11; r++) this.level.tiles[r * this.level.w + this.col] = T_EMPTY;
  }
  update(dt) {
    this.raise = clamp(this.raise + (this.closed ? dt * 3 : -dt * 2), 0, 1);
    this.sprite.visible = this.raise > 0;
    this.sprite.setPos(this.x, this.y + 64 * (1 - this.raise));
  }
}

// ---- Niveau ----
class Level {
  constructor(game, index, showcase = false) {
    this.game = game;
    this.index = index;
    this.def = LEVELS[index];
    this.themeName = this.def.theme;
    this.theme = THEMES[this.themeName];
    this.showcase = showcase;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.time = 0;
    this.ownSheets = [];
    this.disposables = [];
    this.platforms = [];
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.objects = [];
    this.effects = [];
    this.strikes = [];
    this.glows = [];
    this.strips = [];
    this.flyingDragons = [];
    this.boss = null;
    this.bossDefeated = false;
    this.arena = null;
    this.weatherT = 0;
    this.stats = { kills: 0, secrets: 0, secretsTotal: 0, coins: 0, time: 0 };
    this.parse();
    this.buildVisuals();
    if (!showcase) this.spawnEntities();
  }
  parse() {
    const secs = this.def.sections;
    const rows = 15;
    const grid = [];
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (const s of secs) {
        const sw = Math.max(...s.map((x) => x.length));
        line += (s[r] || '').padEnd(sw, '.');
      }
      grid.push(line);
    }
    this.grid = grid;
    this.w = grid[0].length;
    this.h = rows;
    this.pw = this.w * TILE;
    this.ph = this.h * TILE;
    this.tiles = new Uint8Array(this.w * this.h);
    this.markers = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < this.w; c++) {
        const ch = grid[r][c];
        let t = T_EMPTY;
        if (ch === '#') t = T_SOLID;
        else if (ch === 'W') t = T_WALL;
        else if (ch === 'X') t = T_BREAK;
        else if (ch === '=' || ch === '-') t = T_ONEWAY;
        else if (ch === '^') t = T_SPIKE;
        else if (ch === '~') t = T_HAZARD;
        else if (ch !== '.') this.markers.push({ ch, c, r });
        this.tiles[r * this.w + c] = t;
      }
    }
  }
  tileAt(tx, ty) {
    if (tx < 0 || tx >= this.w) return T_SOLID;
    if (ty < 0 || ty >= this.h) return T_EMPTY;
    return this.tiles[ty * this.w + tx];
  }
  solidAt(tx, ty) { return isSolidTile(this.tileAt(tx, ty)); }
  standableAt(tx, ty) { const t = this.tileAt(tx, ty); return isSolidTile(t) || t === T_ONEWAY; }
  groundBelow(c, r) {
    for (let rr = r + 1; rr < this.h; rr++) {
      const t = this.tileAt(c, rr);
      if (isSolidTile(t) || t === T_ONEWAY || t === T_SPIKE) return rr * TILE;
    }
    return (r + 1) * TILE;
  }
  // ---- Construction visuelle : ciel, parallaxe, morceaux de décor, animations ----
  buildVisuals() {
    const g = this.game, th = this.theme;
    const skyC = buildSky(this.themeName);
    const skyTex = canvasTexture(skyC);
    this.skyMesh = new THREE.Mesh(planeGeo(W, H), new THREE.MeshBasicMaterial({ map: skyTex, depthTest: false, depthWrite: false }));
    this.skyMesh.renderOrder = 0;
    this.group.add(this.skyMesh);
    this.disposables.push(skyTex, this.skyMesh.material);
    this.layers = [];
    const defs = buildLayers(this.themeName);
    const orders = [1, 3, 4];
    let li = 0;
    for (const d of defs) {
      const order = d.fg ? 30 : d.clouds ? 5 : orders[li++];
      this.layers.push(new ParallaxLayer(this.group, d.c, d.fx, d.fy, d.offY, order, d.fg ? 0.92 : 1, d.drift || 0));
    }
    if (this.themeName === 'mountain' || this.themeName === 'dragon') {
      const sheet = buildFlyingDragonSheet(this.themeName === 'mountain' ? '#5a0f17' : '#3a1a5a', this.themeName === 'mountain' ? '#f2b53a' : '#c46bff');
      this.ownSheets.push(sheet);
      for (let i = 0; i < 2; i++) {
        this.flyingDragons.push({ sprite: new Sprite(this.group, sheet, 2), x: rand(0, 600), y: 30 + i * 30, speed: 14 + i * 8, phase: i });
      }
    }
    // brume
    this.mist = new ParallaxLayer(this.group, buildMistCanvas(th.mist), 0.8, 0.6, 150, 6, 0.35, 10);
    this.layers.push(this.mist);
    this.buildChunks();
    // liquides dangereux animés
    const hzC = buildHazardCanvas(th);
    for (let r = 0; r < this.h; r++) {
      let c = 0;
      while (c < this.w) {
        if (this.tileAt(c, r) === T_HAZARD && this.tileAt(c, r - 1) !== T_HAZARD) {
          let e = c;
          while (this.tileAt(e + 1, r) === T_HAZARD && this.tileAt(e + 1, r - 1) !== T_HAZARD) e++;
          const len = (e - c + 1) * TILE;
          this.strips.push(new ScrollStrip(this.group, hzC, c * TILE, r * TILE, len, TILE, 9, 12, 0));
          for (let x = c * TILE + 16; x < (e + 1) * TILE; x += 56) {
            const gl = new Glow(this.group, 64, hexNum(th.hazard.light), 0.22, 0.25);
            gl.setCenter(x, r * TILE + 6);
            this.glows.push(gl);
          }
          c = e + 1;
        } else c++;
      }
    }
    // décor animé des marqueurs (lanternes, torches, cascades, cloches)
    for (const m of this.markers) {
      const x = m.c * TILE, gy = this.groundBelow(m.c, m.r);
      if (m.ch === 'L') {
        const gl = new Glow(this.group, 56, 0xff6a3a, 0.5, 0.2);
        gl.setCenter(x + 12, gy - 29);
        this.glows.push(gl);
      } else if (m.ch === 't') {
        const fl = new Sprite(this.group, ART.flame, 10);
        fl.setPos(x + 4, gy - 34);
        this.effects.push({ sprite: fl, flame: true, life: Infinity, x: x + 8, y: gy - 26 });
        const gl = new Glow(this.group, 64, 0xffa040, 0.55, 0.3);
        gl.setCenter(x + 8, gy - 28);
        this.glows.push(gl);
      } else if (m.ch === 'F') {
        let bottom = m.r;
        while (bottom < this.h && !this.solidAt(m.c, bottom)) bottom++;
        const top = m.r * TILE, h = Math.min(this.ph, bottom * TILE) - top;
        this.strips.push(new ScrollStrip(this.group, buildWaterfallCanvas(), x, top, 16, h, 7, 0, 60));
        this.waterfalls = this.waterfalls || [];
        this.waterfalls.push({ x: x + 8, y: top + h });
      }
    }
  }
  buildChunks() {
    const th = this.theme, CW = 256;
    const decor = [];
    const add = (x0, x1, draw) => decor.push({ x0, x1, draw });
    const rngA = mulberry32(this.index * 1000 + 3);
    // décor automatique sur les surfaces
    for (let c = 0; c < this.w; c++) {
      for (let r = 1; r < this.h; r++) {
        if (this.tileAt(c, r) !== T_SOLID || this.tileAt(c, r - 1) !== T_EMPTY) continue;
        const x = c * TILE, y = r * TILE, roll = rngA(), seed = c * 97 + r;
        if (this.themeName === 'forest') {
          if (roll < 0.22) add(x - 4, x + 20, (ctx) => drawTree(ctx, x + 6, y, 90 + (seed % 90), '#2a5a34', '#3a6a40', '#2f6a38', mulberry32(seed)));
          else if (roll < 0.32) add(x, x + 16, (ctx) => { rect(ctx, x + 3, y - 3, 7, 3, '#5a5a4a'); rect(ctx, x + 4, y - 4, 4, 1, '#7a7a6a'); });
          else if (roll < 0.38) add(x, x + 16, (ctx) => { rect(ctx, x + 8, y - 4, 1, 4, PAL.ivory); rect(ctx, x + 6, y - 6, 5, 2, PAL.vermilion); rect(ctx, x + 7, y - 6, 1, 1, PAL.white); });
        } else if (this.themeName === 'temple') {
          if (roll < 0.08) add(x, x + 16, (ctx) => { rect(ctx, x + 4, y - 12, 8, 12, PAL.stoneDark); rect(ctx, x + 2, y - 14, 12, 3, PAL.stone); rect(ctx, x + 6, y - 9, 4, 3, '#ffb060'); });
          else if (roll < 0.14) add(x, x + 16, (ctx) => { rect(ctx, x + 3, y - 6, 10, 6, PAL.bronze); rect(ctx, x + 2, y - 7, 12, 2, PAL.goldDark); rect(ctx, x + 7, y - 14, 1, 7, '#bdb29a'); });
        } else if (this.themeName === 'mountain') {
          if (roll < 0.14) add(x - 12, x + 28, (ctx) => drawPine(ctx, x + 8, y, 30 + (seed % 26), '#3a1a24', '#5a2a34'));
          else if (roll < 0.22) add(x, x + 16, (ctx) => { rect(ctx, x + 2, y - 5, 10, 5, '#6a4a54'); rect(ctx, x + 3, y - 6, 7, 2, '#ffffff'); });
        } else {
          if (roll < 0.12) add(x, x + 16, (ctx) => { rect(ctx, x + 1, y - 10, 2, 10, PAL.gold); rect(ctx, x + 13, y - 10, 2, 10, PAL.gold); rect(ctx, x, y - 10, 16, 2, PAL.goldLight); rect(ctx, x, y - 5, 16, 1, PAL.goldDark); });
          else if (roll < 0.18) add(x - 8, x + 24, (ctx) => drawCloud(ctx, x - 6, y - 2, 26, '#c8902a', '#ffe08a', null));
        }
      }
    }
    // décor des marqueurs
    for (const m of this.markers) {
      const x = m.c * TILE, gy = this.groundBelow(m.c, m.r);
      switch (m.ch) {
        case 'L': add(x, x + 18, (ctx) => drawLanternPost(ctx, x, gy, th)); break;
        case 't': add(x, x + 16, (ctx) => drawTorchStand(ctx, x, gy)); break;
        case 'T': add(x - 30, x + 50, (ctx) => drawTemple(ctx, x - 22, gy, { w: 60, roof: this.themeName === 'dragon' ? '#5a3a18' : '#24484a' })); break;
        case 'p': add(x - 16, x + 40, (ctx) => drawPagoda(ctx, x - 8, gy, 3, '#7a1a18', '#2a3a4a', PAL.gold)); break;
        case 'S': add(x - 10, x + 30, (ctx) => drawDragonStatue(ctx, x - 8, gy, this.themeName === 'dragon' ? '#c8902a' : PAL.stone, this.themeName === 'dragon' ? PAL.goldLight : PAL.stoneLight, PAL.jade)); break;
        case 'I': add(x, x + 16, (ctx) => drawColumn(ctx, x + 3, 0, gy, '#7a1a18', PAL.gold)); break;
        case 'A': add(x - 26, x + 34, (ctx) => drawPaifang(ctx, x - 20, gy, '#9c1d22', '#2a1848', PAL.gold)); break;
        case 'b': add(x - 8, x + 24, (ctx) => drawBellFrame(ctx, x - 5, gy, th)); break;
      }
    }
    const n = Math.ceil(this.pw / CW);
    for (let i = 0; i < n; i++) {
      const [c, ctx] = makeCanvas(CW, this.ph);
      ctx.save();
      ctx.translate(-i * CW, 0);
      for (const d of decor) if (d.x1 >= i * CW && d.x0 <= (i + 1) * CW) d.draw(ctx);
      const c0 = i * (CW / TILE), c1 = Math.min(this.w, c0 + CW / TILE);
      for (let r = 0; r < this.h; r++) {
        for (let col = c0; col < c1; col++) {
          const t = this.tileAt(col, r), x = col * TILE, y = r * TILE;
          const rng = mulberry32(col * 7919 + r * 131 + this.index);
          const ch = this.grid[r][col];
          if (t === T_SOLID) {
            const nb = { l: this.solidAt(col - 1, r), r: this.solidAt(col + 1, r), u: this.solidAt(col, r - 1), d: r + 1 >= this.h || this.solidAt(col, r + 1) };
            drawGroundTile(ctx, th, x, y, nb, rng);
          } else if (t === T_WALL) drawWallTile(ctx, th, x, y, rng);
          else if (t === T_ONEWAY) {
            if (ch === '-') drawSuspendedTile(ctx, th, x, y, col % 3 === 0 || this.grid[r][col - 1] !== '-' || this.grid[r][col + 1] !== '-');
            else drawBridgeTile(ctx, th, x, y, this.grid[r][col - 1] !== '=', this.grid[r][col + 1] !== '=');
          } else if (t === T_SPIKE) drawSpikeTile(ctx, th, x, y);
          else if (t === T_HAZARD && this.tileAt(col, r - 1) === T_HAZARD) rect(ctx, x, y, TILE, TILE, th.hazard.deep);
        }
      }
      ctx.restore();
      const tex = canvasTexture(c);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, alphaTest: 0.5 });
      const mesh = new THREE.Mesh(planeGeo(CW, this.ph), mat);
      mesh.position.set(i * CW, 0, 0);
      mesh.renderOrder = 8;
      this.group.add(mesh);
      this.disposables.push(tex, mat);
    }
  }
  // ---- Entités ----
  spawnEntities() {
    const g = this.game, ls = g.levelState;
    let signIdx = 0, cpIdx = 0;
    const markers = this.markers.slice().sort((a, b) => a.c - b.c || a.r - b.r);
    // murs secrets (regroupés)
    const seen = new Set();
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) {
        if (this.tileAt(c, r) !== T_BREAK || seen.has(r * this.w + c)) continue;
        const cells = [], stack = [[c, r]];
        seen.add(r * this.w + c);
        while (stack.length) {
          const [cx, cy] = stack.pop();
          cells.push([cx, cy]);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (this.tileAt(nx, ny) === T_BREAK && !seen.has(ny * this.w + nx)) { seen.add(ny * this.w + nx); stack.push([nx, ny]); }
          }
        }
        this.objects.push(new BreakWall(this, cells));
      }
    }
    // plateformes dynamiques (suites de lettres identiques)
    for (let r = 0; r < this.h; r++) {
      let c = 0;
      while (c < this.w) {
        const ch = this.grid[r][c];
        if ('MVCB'.includes(ch)) {
          let e = c;
          while (this.grid[r][e + 1] === ch) e++;
          const type = { M: 'moving', V: 'vertical', C: 'crumble', B: 'bounce' }[ch];
          this.platforms.push(new Platform(this, type, c * TILE, r * TILE, (e - c + 1) * TILE));
          c = e + 1;
        } else c++;
      }
    }
    for (const m of markers) {
      const x = m.c * TILE, y = m.r * TILE, gy = this.groundBelow(m.c, m.r);
      const key = m.c + ',' + m.r;
      switch (m.ch) {
        case 'P': this.start = { x: x + 2, y: gy - 28 }; break;
        case 'o': if (!ls.collected.has(key)) this.spawnPickup('coin', x + 8, y + 8, false, key); break;
        case 'q': if (!ls.collected.has(key)) this.spawnPickup('orb', x + 8, y + 8, false, key); break;
        case 'h': if (!ls.collected.has(key)) this.spawnPickup('peach', x + 8, y + 8, false, key); break;
        case 'f':
          this.stats.secretsTotal++;
          if (!ls.collected.has(key)) this.spawnPickup('flower', x + 8, y + 8, false, key);
          break;
        case 'r':
          this.stats.secretsTotal++;
          if (!ls.collected.has(key)) this.spawnPickup('relic', x + 8, y + 8, false, key);
          break;
        case 'k': {
          const cp = new Checkpoint(this, x, gy, cpIdx);
          cp.spawn = { x: x + 2, y: gy - 28 };
          this.objects.push(cp);
          cpIdx++;
          break;
        }
        case 's': this.objects.push(new Sign(this, x, gy, this.def.signs[signIdx++] || '...')); break;
        case 'n': this.objects.push(new NPC(this, x, gy, this.def.npc)); break;
        case 'x': this.objects.push(new Vase(this, x, gy)); break;
        case 'b': this.objects.push(new Bell(this, x, gy)); break;
        case 'E':
          this.arena = { col: m.c, x: m.c * TILE, y: this.ph - H, triggered: false };
          this.gate = new Gate(this, m.c);
          this.objects.push(this.gate);
          break;
        case 'Z': this.bossSpawn = { x: x, y: gy }; break;
        default:
          if (this.def.enemies[m.ch]) this.spawnEnemy(this.def.enemies[m.ch], x + 8, gy);
      }
    }
    // joueur : départ ou point de contrôle
    let spawn = this.start;
    if (ls.checkpoint >= 0) {
      const cp = this.objects.find((o) => o instanceof Checkpoint && o.index === ls.checkpoint);
      if (cp) spawn = cp.spawn;
    }
    this.player = new Player(g, this, spawn.x, spawn.y);
  }
  spawnEnemy(type, x, groundY, summoned = false) {
    const cfg = ENEMY_TYPES[type];
    const Cls = { BasicDemon, Warrior, FlyingSpirit }[cfg.cls];
    const e = new Cls(this, type, x, groundY);
    e.summoned = summoned;
    this.enemies.push(e);
    return e;
  }
  spawnPickup(kind, x, y, dropped = false, key = null) {
    const p = new Pickup(this, kind, x, y, dropped, key);
    this.pickups.push(p);
    return p;
  }
  addProjectile(p) { this.projectiles.push(p); return p; }
  // ---- Mise à jour ----
  update(dt) {
    this.time += dt;
    if (!this.showcase) this.stats.time += dt;
    for (const p of this.platforms) p.update(dt);
    if (this.player) this.player.update(dt);
    for (const e of this.enemies) e.update(dt);
    if (this.boss) this.boss.update(dt);
    for (const p of this.projectiles) p.update(dt);
    for (const s of this.strikes) s.update(dt);
    for (const p of this.pickups) p.update(dt);
    for (const o of this.objects) o.update(dt);
    for (const e of this.effects) {
      if (e.flame) {
        e.sprite.setFrame(Math.floor(this.time * 10 + e.x) % 4);
        if (Math.random() < 0.08) this.game.fx.ember(e.x, e.y);
        continue;
      }
      e.life -= dt;
      e.t = (e.t || 0) + dt;
      if (e.update) e.update(e, dt);
    }
    this.sweep(this.enemies);
    this.sweep(this.projectiles);
    this.sweep(this.pickups);
    this.sweep(this.objects);
    this.sweep(this.strikes);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      if (this.effects[i].life <= 0) {
        this.effects[i].sprite.dispose();
        this.effects.splice(i, 1);
      }
    }
    this.updateArena();
    this.ambient(dt);
  }
  sweep(list) {
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].removed || (list[i].dead && list[i].remove !== false && !(list[i] instanceof Enemy))) {
        list[i].dispose();
        list.splice(i, 1);
      }
    }
  }
  updateArena() {
    const a = this.arena, p = this.player;
    if (!a || !p || this.showcase) return;
    if (!a.triggered && p.x > a.x + TILE * 2.5 && !this.bossDefeated) {
      a.triggered = true;
      this.gate.close();
      this.game.camera.lock = { x: a.x, y: a.y };
      this.game.startBoss();
    }
  }
  ambient(dt) {
    const fx = this.game.fx, cam = this.game.camera;
    const cx = cam.x, cy = cam.y;
    this.weatherT += dt;
    const wthr = this.theme.weather;
    const rate = wthr === 'snow' ? 0.04 : wthr === 'leaves' ? 0.18 : 0.1;
    while (this.weatherT > rate) {
      this.weatherT -= rate;
      if (wthr === 'leaves') {
        const p = fx.normal.spawn(cx + rand(-20, W + 40), cy - 4, rand(-25, 5), rand(18, 32), 7, 2, pick([0x4f9a3c, 0x8fd05a, 0x2a5a2c]));
        if (p) p.drag = 0.05;
        if (this.theme.fireflies && Math.random() < 0.35) {
          const f = fx.add.spawn(cx + rand(0, W), cy + rand(40, H), rand(-6, 6), rand(-6, 6), 3, 1, 0xd8ff7a);
          if (f) f.flicker = true;
        }
      } else if (wthr === 'embers') {
        const p = fx.add.spawn(cx + rand(0, W), cy + H + 4, rand(-8, 8), rand(-30, -14), 5, 1, pick([0xf07a2a, 0xffde4a, 0xe0412b]));
        if (p) p.flicker = true;
        if (Math.random() < 0.3) fx.normal.spawn(cx + rand(0, W), cy + rand(0, H), rand(-4, 4), rand(-3, 3), 4, 1, 0x8a6a7a);
      } else if (wthr === 'snow') {
        fx.normal.spawn(cx + rand(0, W + 80), cy - 4, rand(-30, -14), rand(24, 44), 8, Math.random() < 0.2 ? 2 : 1, 0xffffff);
      } else {
        const p = fx.add.spawn(cx + rand(0, W), cy + H + 4, rand(-5, 5), rand(-22, -10), 7, 1, pick([0xf2b53a, 0xffe08a, 0xc46bff]));
        if (p) p.flicker = Math.random() < 0.5;
      }
    }
    if (this.waterfalls) {
      for (const w of this.waterfalls) {
        if (w.x > cx - 20 && w.x < cx + W + 20 && Math.random() < 0.5) {
          const p = fx.normal.spawn(w.x + rand(-8, 8), Math.min(w.y, this.ph) - 2, rand(-30, 30), rand(-50, -10), 0.5, 1, 0xffffff);
          if (p) p.grav = 200;
        }
      }
    }
  }
  // Positionne les éléments liés à la caméra (ciel, parallaxe, lueurs)
  syncView(cam) {
    const x = cam.rx, y = cam.ry;
    this.skyMesh.position.set(x, -y, 0);
    for (const l of this.layers) l.update(x, y, this.time);
    for (const s of this.strips) s.update(this.time);
    for (const gl of this.glows) gl.update(this.time);
    for (const d of this.flyingDragons) {
      d.x -= d.speed / 60;
      if (d.x < -80) { d.x = W + 200 + rand(0, 300); d.y = 20 + rand(0, 50); }
      d.sprite.setFrame(Math.floor(this.time * 6 + d.phase) % 4);
      d.sprite.setPos(x + d.x, y + d.y + Math.sin(this.time + d.phase) * 6);
    }
  }
  dispose() {
    const all = [this.enemies, this.projectiles, this.pickups, this.objects, this.platforms.map((p) => p.sprite), this.strikes, this.glows, this.strips, this.layers];
    for (const list of all) for (const o of list) o.dispose();
    for (const e of this.effects) e.sprite.dispose();
    for (const d of this.flyingDragons) d.sprite.dispose();
    if (this.boss) this.boss.dispose();
    if (this.player) this.player.dispose();
    for (const s of this.ownSheets) s.tex.dispose();
    for (const d of this.disposables) d.dispose();
    this.group.traverse((o) => { if (o.material && o.material.dispose) o.material.dispose(); });
    this.game.scene.remove(this.group);
  }
}

// =========================================================================
// 7. JOUEUR
// =========================================================================
// Combo de trois coups : frames de la planche ATTACK, fenêtre active, effets
const COMBO = [
  { frames: [2, 3, 4, 5, 6], fps: 24, active: [2, 3], dmg: 1, kb: 120, lunge: 50, slash: 0, reach: 34, up: 6, sfx: 'attack' },
  { frames: [4, 5, 6, 6], fps: 20, active: [0, 1], dmg: 1, kb: 150, lunge: 90, slash: 1, reach: 34, up: 4, sfx: 'attack' },
  { frames: [1, 2, 3, 4, 5, 6, 6], fps: 18, active: [3, 4], dmg: 1.6, kb: 260, lunge: 70, slash: 2, reach: 42, up: 16, sfx: 'attack3', shake: 3, stop: 0.07 },
];

class Player {
  constructor(game, level, x, y) {
    this.game = game;
    this.level = level;
    this.isPlayer = true;
    this.x = x;
    this.y = y;
    this.w = 12;
    this.h = 28;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.standingOn = null;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.canDouble = true;
    this.jumpCut = false;
    this.dashT = 0;
    this.dashCd = 0;
    this.dashDir = 1;
    this.airDash = false;
    this.dashHits = new Set();
    this.attack = null;
    this.comboStep = 0;
    this.comboCd = 0;
    this.qiCd = 0;
    this.casting = 0;
    this.invuln = 0;
    this.hurtT = 0;
    this.dead = false;
    this.deathT = 0;
    this.wallDir = 0;
    this.wallSlide = false;
    this.wallLock = 0;
    this.dropT = 0;
    this.dropThrough = false;
    this.animT = 0;
    this.stepT = 0;
    this.afterT = 0;
    this.wasGround = true;
    this.fallStart = y;
    this.safe = { x, y };
    this.sprite = new Sprite(level.group, ART.player, 14);
    this.aura = new Glow(level.group, 56, 0x7fe3ff, 0.12, 0.1);
    this.ghosts = [];
    for (let i = 0; i < 6; i++) {
      const s = new Sprite(level.group, ART.player, 13);
      s.visible = false;
      s.setFlash(0.75, 0x7fe3ff);
      this.ghosts.push({ s, life: 0 });
    }
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get dashing() { return this.dashT > 0; }
  touchingWall(dir) {
    const tx = Math.floor((dir > 0 ? this.x + this.w + 1 : this.x - 1) / TILE);
    for (let y = this.y + 4; y < this.y + this.h - 4; y += 8) {
      if (this.level.tileAt(tx, Math.floor(y / TILE)) === T_WALL) return true;
    }
    return false;
  }
  bounce(v) {
    this.vy = -v;
    this.onGround = false;
    this.canDouble = true;
    this.airDash = false;
    this.jumpCut = false;
    this.standingOn = null;
  }
  update(dt) {
    const g = this.game, inp = g.input, lv = this.level;
    if (this.dead) return this.updateDeath(dt);
    if (this.respawning) {
      this.vx = this.vy = 0;
      this.animate(dt);
      return;
    }
    this.coyote -= dt;
    this.jumpBuffer -= dt;
    this.dashCd -= dt;
    this.comboCd -= dt;
    this.qiCd -= dt;
    this.invuln -= dt;
    this.hurtT -= dt;
    this.wallLock -= dt;
    this.casting -= dt;
    this.dropT -= dt;
    this.dropThrough = this.dropT > 0;
    const locked = g.inputLocked;
    const ax = locked ? 0 : inp.axis();
    // --- Dash ---
    if (!locked && inp.hit('dash') && this.dashCd <= 0 && this.hurtT <= 0 && (this.onGround || !this.airDash)) {
      this.dashT = CONFIG.DASH_TIME * (1 + g.upg.dash * 0.12);
      this.dashCd = CONFIG.DASH_COOLDOWN - g.upg.dash * 0.08;
      this.dashDir = ax || this.facing;
      this.facing = this.dashDir;
      if (!this.onGround) this.airDash = true;
      this.attack = null;
      this.dashHits.clear();
      g.audio.play('dash');
      g.fx.burst(this.cx, this.y + this.h, 8, [PAL.ivory, PAL.qi], 60, 0.35);
    }
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashDir * CONFIG.DASH_SPEED * (1 + g.upg.dash * 0.15);
      this.vy = 0;
      this.afterT -= dt;
      if (this.afterT <= 0) { this.afterT = 0.028; this.spawnGhost(); }
      if (Math.random() < 0.7) g.fx.add.spawn(this.cx - this.dashDir * 6, this.y + rand(4, this.h - 4), -this.dashDir * rand(20, 60), rand(-10, 10), 0.3, 1, 0x7fe3ff);
      if (g.upg.dash >= 3) this.dashStrike();
      if (this.dashT <= 0) this.vx = this.dashDir * CONFIG.RUN_SPEED;
    } else {
      // --- Déplacement horizontal (accélération / friction) ---
      const attacking = this.attack && this.onGround;
      const target = ax * CONFIG.RUN_SPEED * (attacking ? 0.2 : 1);
      if (this.wallLock <= 0) {
        if (ax !== 0) this.vx = approach(this.vx, target, (this.onGround ? CONFIG.ACCEL : CONFIG.AIR_ACCEL) * dt);
        else this.vx = approach(this.vx, 0, (this.onGround ? CONFIG.FRICTION : CONFIG.AIR_ACCEL * 0.5) * dt);
      }
      if (ax !== 0 && !this.attack && this.wallLock <= 0) this.facing = ax;
      // --- Gravité ---
      let grav = CONFIG.GRAVITY;
      if (Math.abs(this.vy) < 50 && inp.held('jump')) grav *= 0.55;
      if (this.attack && !this.onGround && this.vy > -50) grav *= 0.4;
      this.vy = Math.min(this.vy + grav * dt, CONFIG.MAX_FALL);
      // --- Glissade sur les murs à lianes ---
      this.wallDir = 0;
      if (!this.onGround) {
        if (this.touchingWall(1)) this.wallDir = 1;
        else if (this.touchingWall(-1)) this.wallDir = -1;
      }
      this.wallSlide = this.wallDir !== 0 && ax === this.wallDir && this.vy > 0;
      if (this.wallSlide) {
        this.vy = Math.min(this.vy, CONFIG.WALL_SLIDE);
        this.canDouble = true;
        this.airDash = false;
        if (Math.random() < 0.25) g.fx.dust(this.wallDir > 0 ? this.x + this.w : this.x, this.y + 6, 1);
      }
      // --- Saut, saut mural, double saut ---
      if (!locked && inp.hit('jump')) {
        if (inp.held('down') && this.onGround && this.level.tileAt(Math.floor(this.cx / TILE), Math.floor((this.y + this.h + 1) / TILE)) === T_ONEWAY) {
          this.dropT = 0.25;
        } else this.jumpBuffer = CONFIG.JUMP_BUFFER;
      }
      if (this.jumpBuffer > 0) {
        if (this.onGround || this.coyote > 0) {
          this.vy = -CONFIG.JUMP_VEL;
          this.onGround = false;
          this.coyote = 0;
          this.jumpBuffer = 0;
          this.jumpCut = true;
          this.standingOn = null;
          g.audio.play('jump');
          g.fx.dust(this.cx, this.y + this.h, 5);
        } else if (this.wallDir !== 0) {
          this.vy = -CONFIG.JUMP_VEL * 0.95;
          this.vx = -this.wallDir * 175;
          this.facing = -this.wallDir;
          this.wallLock = 0.16;
          this.jumpBuffer = 0;
          this.jumpCut = true;
          g.audio.play('jump');
          g.fx.dust(this.wallDir > 0 ? this.x + this.w : this.x, this.cy, 6);
        } else if (this.canDouble) {
          this.vy = -CONFIG.DOUBLE_JUMP_VEL;
          this.canDouble = false;
          this.jumpBuffer = 0;
          this.jumpCut = true;
          g.audio.play('doubleJump');
          g.fx.ring(this.cx, this.y + this.h, PAL.qi, 10);
        }
      }
      if (this.jumpCut && !inp.held('jump') && this.vy < 0) {
        this.vy *= 0.5;
        this.jumpCut = false;
      }
    }
    // --- Attaque (combo) ---
    if (!locked && inp.hit('attack') && this.dashT <= 0 && this.hurtT <= 0) {
      if (!this.attack && this.comboCd <= 0) this.startAttack(0);
      else if (this.attack) this.attack.queued = true;
    }
    if (this.attack) this.updateAttack(dt);
    // --- Pouvoir spécial : vague de Qi ---
    if (!locked && inp.hit('special') && this.dashT <= 0) this.special();
    // --- Physique ---
    const prevVy = this.vy;
    const res = moveBody(this, lv, dt);
    if (res.platform) res.platform.onStand(this);
    if (this.onGround) {
      if (!this.wasGround) {
        if (prevVy > 200) {
          g.fx.dust(this.cx, this.y + this.h, 6);
          g.audio.play('land');
        }
      }
      this.coyote = CONFIG.COYOTE;
      this.canDouble = true;
      this.airDash = false;
      // dernière position sûre (sol plein sous les deux pieds)
      const ty = Math.floor((this.y + this.h + 1) / TILE);
      if (!this.standingOn && lv.solidAt(Math.floor(this.x / TILE), ty) && lv.solidAt(Math.floor((this.x + this.w) / TILE), ty) && this.invuln < 0.5) {
        this.safe.x = this.x;
        this.safe.y = this.y;
      }
      if (Math.abs(this.vx) > 60) {
        this.stepT -= dt;
        if (this.stepT <= 0) { this.stepT = 0.16; g.fx.dust(this.cx - this.facing * 4, this.y + this.h, 1); }
      }
    }
    this.wasGround = this.onGround;
    this.hazards();
    this.animate(dt);
  }
  startAttack(step) {
    const g = this.game, def = COMBO[step];
    this.comboStep = step;
    this.attack = { def, step, t: 0, hits: new Set(), queued: false, hitAny: false };
    if (this.onGround) this.vx = this.facing * def.lunge;
    else this.vy = Math.min(this.vy, 20);
    g.audio.play(def.sfx);
    const sx = this.facing > 0 ? this.cx - 6 : this.cx - 34;
    const s = new Sprite(this.level.group, ART.slash[def.slash], 15);
    s.setFlip(this.facing < 0);
    const fx = { sprite: s, life: 0.2, ox: sx - this.x, oy: -14 - (def.slash === 2 ? 6 : 0) };
    fx.update = (e) => {
      e.sprite.setFrame(Math.min(2, Math.floor((e.t / 0.2) * 3)));
      e.sprite.setPos(this.x + e.ox, this.y + e.oy);
    };
    fx.update(fx);
    s.visible = false;
    fx.delay = def.active[0] / def.fps;
    const upd = fx.update;
    fx.update = (e, dt2) => {
      if (e.delay > 0) { e.delay -= dt2; e.life = 0.2; e.t = 0; e.sprite.visible = false; return; }
      e.sprite.visible = true;
      upd(e);
    };
    this.level.effects.push(fx);
  }
  attackBox() {
    const d = this.attack.def;
    const x = this.facing > 0 ? this.cx : this.cx - d.reach;
    return { x, y: this.y - d.up, w: d.reach, h: this.h + d.up - 2 };
  }
  updateAttack(dt) {
    const a = this.attack, d = a.def;
    a.t += dt;
    const fi = Math.floor(a.t * d.fps);
    if (fi >= d.active[0] && fi <= d.active[1]) this.applyHits(this.attackBox(), Math.round(this.game.damage * d.dmg * 10) / 10, d, a.hits);
    const dur = d.frames.length / d.fps;
    if (a.queued && a.t > dur * 0.6 && a.step < 2) {
      this.startAttack(a.step + 1);
      return;
    }
    if (a.t >= dur) {
      this.attack = null;
      if (a.step === 2) this.comboCd = 0.22;
    }
  }
  // Applique les dégâts d'une zone d'attaque du joueur à tout ce qui est touchable
  applyHits(box, dmg, def, hits) {
    const g = this.game, lv = this.level;
    let hit = false;
    const targets = lv.boss ? lv.enemies.concat(lv.boss.hurtTargets()) : lv.enemies;
    for (const e of targets) {
      if (e.dead || hits.has(e) || !overlap(box, e.hitbox())) continue;
      hits.add(e);
      if (e.hurt(dmg, this.facing, def.kb)) {
        hit = true;
        const hx = clamp(box.x + box.w / 2, e.hitbox().x, e.hitbox().x + e.hitbox().w);
        g.fx.sparks(hx, e.hitbox().y + e.hitbox().h / 2, this.facing);
      }
    }
    for (const o of lv.objects) {
      if (o.dead || hits.has(o) || !o.onHit || !overlap(box, o)) continue;
      hits.add(o);
      if (o.onHit(this)) hit = true;
    }
    for (const p of lv.projectiles) {
      if (!p.dead && p.owner === 'enemy' && p.parryable && overlap(box, p)) {
        p.destroy();
        g.fx.sparks(p.x + p.w / 2, p.y + p.h / 2, this.facing);
        g.addScore(10);
      }
    }
    if (hit) {
      g.hitstop = Math.max(g.hitstop, def.stop || 0.045);
      if (def.shake) g.camera.shake(def.shake, 0.18);
      g.gainQi(4);
      if (!this.onGround) this.vy = Math.min(this.vy, -60);
    }
    return hit;
  }
  dashStrike() {
    const box = { x: this.x - 4, y: this.y, w: this.w + 8, h: this.h };
    this.applyHits(box, this.game.damage, { kb: 140, stop: 0.03 }, this.dashHits);
  }
  special() {
    const g = this.game;
    if (this.qiCd > 0) return;
    const cost = g.qiCost;
    if (g.qi < cost) {
      g.audio.play('noQi');
      g.qiFlash = 0.4;
      return;
    }
    g.qi -= cost;
    this.qiCd = g.qiCooldown;
    this.casting = 0.3;
    this.attack = null;
    g.audio.play('special');
    g.camera.shake(2, 0.2);
    const x = this.facing > 0 ? this.x + this.w : this.x - 26;
    const p = new Projectile(this.level, 'qiwave', x, this.y - 4, this.facing * 270, 0, 'player', 6 + g.upg.dmg * 2);
    p.pierce = true;
    p.life = 1.1;
    p.parry = true;
    this.level.addProjectile(p);
    g.fx.burst(this.cx + this.facing * 10, this.cy, 16, [PAL.qi, PAL.white, PAL.qiDark], 110, 0.5);
    g.fx.ring(this.cx, this.cy, PAL.qi, 16);
  }
  hurt(dmg, srcX) {
    const g = this.game;
    if (this.dead || this.invuln > 0 || this.dashT > 0 || g.godMode) return false;
    g.hp -= dmg;
    g.combo = 0;
    this.invuln = CONFIG.INVULN;
    this.hurtT = 0.32;
    this.attack = null;
    const dir = this.cx >= srcX ? 1 : -1;
    this.vx = dir * 170;
    this.vy = -190;
    this.standingOn = null;
    g.audio.play('hurt');
    g.camera.shake(4, 0.25);
    g.flash(0xe0412b, 0.35);
    g.hitstop = 0.08;
    g.fx.burst(this.cx, this.cy, 14, [PAL.vermilion, PAL.darkRed, PAL.white], 120, 0.6, 200);
    if (g.hp <= 0) this.die();
    return true;
  }
  hazards() {
    const lv = this.level, g = this.game;
    if (this.y > lv.ph + 24) return this.hazardHit(false);
    if (this.invuln > 0 && this.hurtT > 0) return;
    const l = Math.floor((this.x + 2) / TILE), r = Math.floor((this.x + this.w - 2) / TILE);
    const t = Math.floor((this.y + 2) / TILE), b = Math.floor((this.y + this.h - 1) / TILE);
    for (let ty = t; ty <= b; ty++) {
      for (let tx = l; tx <= r; tx++) {
        const tile = lv.tileAt(tx, ty);
        if (tile === T_HAZARD && this.y + this.h > ty * TILE + 5) return this.hazardHit(true);
        if (tile === T_SPIKE && this.invuln <= 0 && this.dashT <= 0 && this.y + this.h > ty * TILE + 7) {
          if (this.hurt(1, this.cx)) {
            this.vy = -300;
            if (!this.dead) this.respawnSafe(0.35);
          }
          return;
        }
      }
    }
  }
  hazardHit(liquid) {
    const g = this.game;
    if (this.dead || this.respawning) return;
    if (liquid) g.fx.burst(this.cx, this.y + this.h, 16, [hexNum(this.level.theme.hazard.light), hexNum(this.level.theme.hazard.foam)], 120, 0.6, 250);
    g.hp -= 1;
    g.combo = 0;
    g.audio.play('hurt');
    g.flash(0xe0412b, 0.4);
    g.camera.shake(3, 0.2);
    if (g.hp <= 0) {
      this.die();
      return;
    }
    this.respawnSafe(0);
  }
  respawnSafe(delay) {
    const g = this.game;
    const go = () => {
      if (this.dead) return;
      this.x = this.safe.x;
      this.y = this.safe.y;
      this.vx = this.vy = 0;
      this.invuln = CONFIG.INVULN;
      this.hurtT = 0;
      this.standingOn = null;
      g.fx.ring(this.cx, this.cy, PAL.qi, 14);
    };
    if (delay > 0) g.later(delay, go);
    else {
      this.respawning = true;
      g.fade(0.25, () => { this.respawning = false; go(); });
    }
  }
  die() {
    const g = this.game;
    this.dead = true;
    this.deathT = 0;
    this.attack = null;
    g.hp = 0;
    this.vx *= 0.3;
    g.audio.play('death');
    g.camera.shake(5, 0.4);
    g.slowmo = 0.6;
  }
  updateDeath(dt) {
    const g = this.game;
    this.deathT += dt;
    this.vy = Math.min(this.vy + CONFIG.GRAVITY * dt, CONFIG.MAX_FALL);
    this.vx = approach(this.vx, 0, 400 * dt);
    if (this.y < this.level.ph + 40) moveBody(this, this.level, dt);
    const fi = Math.min(3, Math.floor(this.deathT * 6));
    this.sprite.setFrame(PLAYER_ANIMS.hurt.start + fi);
    this.sprite.setDissolve(clamp((this.deathT - 0.9) / 1.0, 0, 1));
    this.sprite.setFlash(clamp((this.deathT - 0.6) * 1.2, 0, 0.8), 0x7fe3ff);
    if (this.deathT > 0.9 && Math.random() < 0.6) {
      const p = g.fx.add.spawn(this.x + rand(0, this.w), this.y + rand(0, this.h), rand(-10, 10), rand(-60, -20), 1.2, 2, 0x7fe3ff);
      if (p) p.shrink = true;
    }
    this.placeSprite(fi === 3 ? 0 : 0);
    this.aura.sprite.visible = false;
    if (this.deathT > 2.3 && !this.deathDone) {
      this.deathDone = true;
      g.onPlayerDead();
    }
  }
  spawnGhost() {
    const gh = this.ghosts.find((x) => x.life <= 0) || this.ghosts[0];
    gh.life = 0.22;
    gh.s.visible = true;
    gh.s.setFrame(this.sprite.frame);
    gh.s.setFlip(this.facing < 0);
    gh.s.mesh.position.copy(this.sprite.mesh.position);
  }
  animate(dt) {
    const A = PLAYER_ANIMS;
    this.animT += dt;
    let frame;
    if (this.hurtT > 0) frame = A.hurt.start + Math.min(3, Math.floor((0.32 - this.hurtT) * 12));
    else if (this.casting > 0) frame = A.attack.start + 4 + Math.min(2, Math.floor((0.3 - this.casting) * 10));
    else if (this.attack) {
      const d = this.attack.def;
      frame = A.attack.start + d.frames[Math.min(d.frames.length - 1, Math.floor(this.attack.t * d.fps))];
    } else if (this.dashT > 0) frame = A.run.start + 4;
    else if (!this.onGround) {
      if (this.wallSlide) frame = A.idle.start;
      else frame = A.run.start + (this.vy < -40 ? 3 : this.vy < 60 ? 2 : 11);
    } else if (Math.abs(this.vx) > 12) {
      const speed = Math.abs(this.vx) / CONFIG.RUN_SPEED;
      frame = A.run.start + (Math.floor(this.animT * A.run.fps * Math.max(0.5, speed)) % A.run.n);
    } else frame = A.idle.start + (Math.floor(this.animT * A.idle.fps) % A.idle.n);
    this.sprite.setFrame(frame);
    this.sprite.setFlip(this.wallSlide ? this.wallDir > 0 : this.facing < 0);
    const blink = this.invuln > 0 && this.dashT <= 0 && Math.floor(this.invuln * 16) % 2 === 0;
    this.sprite.visible = !blink;
    this.sprite.setFlash(this.hurtT > 0 ? 0.5 : 0, 0xff4040);
    this.placeSprite();
    for (const gh of this.ghosts) {
      if (gh.life > 0) {
        gh.life -= dt;
        gh.s.setOpacity(Math.max(0, gh.life / 0.22) * 0.7);
        if (gh.life <= 0) gh.s.visible = false;
      }
    }
  }
  placeSprite() {
    const flip = this.sprite.u.flipX.value > 0.5;
    this.sprite.setPos(this.cx - (flip ? 49 : 46), this.y + this.h - 81);
    this.aura.setCenter(this.cx, this.cy);
    this.aura.update(this.level.time);
  }
  dispose() {
    this.sprite.dispose();
    this.aura.dispose();
    for (const g of this.ghosts) g.s.dispose();
  }
}

// =========================================================================
// 8. ENNEMIS
// =========================================================================
class Enemy {
  constructor(level, type, x, groundY, w, h) {
    this.level = level;
    this.game = level.game;
    this.type = type;
    this.cfg = ENEMY_TYPES[type] || {};
    this.w = w;
    this.h = h;
    this.x = x - w / 2;
    this.y = groundY - h;
    this.vx = 0;
    this.vy = 0;
    this.hp = this.maxHp = this.cfg.hp || 5;
    this.damage = this.cfg.dmg || 1;
    this.facing = -1;
    this.state = 'patrol';
    this.stateT = 0;
    this.cool = rand(0.3, 1);
    this.flashT = 0;
    this.dead = false;
    this.removed = false;
    this.deathT = 0;
    this.onGround = false;
    this.standingOn = null;
    this.home = { x: this.x, y: this.y };
    this.animT = Math.random() * 2;
    this.footPad = 1;
    this.opacity = 1;
    this.flying = false;
    this.sprite = new Sprite(level.group, this.cfg.sheet ? this.cfg.sheet() : ART.imps.red, 12);
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  hitbox() { return this; }
  setState(s) { this.state = s; this.stateT = 0; }
  player() { return this.level.player; }
  distToPlayer() {
    const p = this.player();
    return p && !p.dead ? Math.hypot(p.cx - this.cx, p.cy - this.cy) : Infinity;
  }
  canSee(range, needFacing = true) {
    const p = this.player();
    if (!p || p.dead) return false;
    const dx = p.cx - this.cx, dy = p.cy - this.cy;
    if (Math.abs(dx) > range || Math.abs(dy) > 56) return false;
    if (needFacing && sign(dx) !== this.facing && Math.abs(dx) > 50) return false;
    return true;
  }
  ledgeAhead(dir) {
    const tx = Math.floor((dir > 0 ? this.x + this.w + 2 : this.x - 2) / TILE);
    const ty = Math.floor((this.y + this.h + 2) / TILE);
    if (this.level.tileAt(tx, ty) === T_SPIKE || this.level.tileAt(tx, ty + 1) === T_HAZARD) return true;
    return !this.level.standableAt(tx, ty) && !this.level.platforms.some((p) => p.solid && tx * TILE + 8 > p.x && tx * TILE + 8 < p.x + p.w && Math.abs(p.y - (this.y + this.h)) < 6);
  }
  wallAhead(dir) {
    const tx = Math.floor((dir > 0 ? this.x + this.w + 2 : this.x - 2) / TILE);
    return this.level.solidAt(tx, Math.floor((this.y + this.h - 4) / TILE));
  }
  hurt(dmg, dir, kb) {
    if (this.dead) return false;
    if (this.invulnerable) {
      this.game.audio.play('land');
      return false;
    }
    this.hp -= dmg;
    this.flashT = 0.12;
    const resist = this.cfg.heavy ? 0.25 : 1;
    this.vx = dir * kb * resist;
    if (!this.flying && this.onGround && !this.cfg.heavy) this.vy = -kb * 0.45;
    if (this.flying) this.vy = -kb * 0.2;
    this.game.registerHit();
    this.game.audio.play('hit');
    this.onHurt(dir);
    if (this.hp <= 0) this.die(dir);
    return true;
  }
  onHurt() {
    if (!this.cfg.heavy) this.setState('hurt');
  }
  die(dir) {
    const g = this.game;
    this.dead = true;
    this.deathT = 0;
    this.vy = -140;
    this.vx = dir * 70;
    this.level.stats.kills++;
    g.addScore(this.cfg.score || 100, true);
    g.audio.play('kill');
    g.camera.shake(2, 0.12);
    g.fx.burst(this.cx, this.cy, 22, [PAL.violet, PAL.violetLight, PAL.black, PAL.vermilion], 130, 0.8, 120);
    g.fx.qiBurst(this.cx, this.cy);
    const n = this.summoned ? randi(0, 1) : randi(1, 3);
    for (let i = 0; i < n; i++) this.level.spawnPickup('coin', this.cx, this.cy, true);
    const r = Math.random();
    if (r < 0.22) this.level.spawnPickup('orb', this.cx, this.cy, true);
    else if (r < 0.3 && g.hp < g.maxHp) this.level.spawnPickup('peach', this.cx, this.cy, true);
  }
  updateDeath(dt) {
    this.deathT += dt;
    this.vy += CONFIG.GRAVITY * 0.6 * dt;
    if (!this.flying) moveBody(this, this.level, dt, false);
    else { this.x += this.vx * dt; this.y += this.vy * dt; }
    this.sprite.setFlash(this.deathT < 0.15 ? 1 : 0.4, this.deathT < 0.15 ? 0xffffff : 0x6b3a8c);
    this.sprite.setDissolve(clamp(this.deathT / 0.6, 0, 1));
    this.place();
    if (this.deathT > 0.62) this.removed = true;
  }
  contact() {
    const p = this.player();
    if (p && !p.dead && overlap(this.hitbox(), p)) p.hurt(this.damage, this.cx);
  }
  physics(dt, gravity = true) {
    if (gravity) this.vy = Math.min(this.vy + CONFIG.GRAVITY * dt, CONFIG.MAX_FALL);
    const res = moveBody(this, this.level, dt);
    if (this.y > this.level.ph + 32) { this.dead = true; this.removed = true; }
    // les ennemis meurent dans les liquides
    const t = this.level.tileAt(Math.floor(this.cx / TILE), Math.floor((this.y + this.h - 2) / TILE));
    if (t === T_HAZARD && !this.dead) { this.hp = 0; this.die(0); }
    return res;
  }
  update(dt) {
    if (this.dead) return this.updateDeath(dt);
    this.stateT += dt;
    this.cool -= dt;
    this.flashT -= dt;
    this.animT += dt;
    if (this.state === 'hurt') {
      this.vx = approach(this.vx, 0, 500 * dt);
      if (this.stateT > 0.28) this.setState('chase');
      if (this.flying) { this.x += this.vx * dt; this.y += this.vy * dt; this.vy = approach(this.vy, 0, 300 * dt); }
      else this.physics(dt);
    } else this.ai(dt);
    if (!this.dead && this.state !== 'hurt' && this.state !== 'dormant') this.contact();
    this.render();
  }
  render() {
    this.sprite.setFlip(this.facing < 0);
    this.sprite.setFlash(this.flashT > 0 ? 1 : this.telegraph ? (Math.floor(this.stateT * 20) % 2 ? 0.55 : 0) : 0, this.flashT > 0 ? 0xffffff : 0xff3030);
    this.sprite.setOpacity(this.opacity);
    this.place();
  }
  place() {
    const s = this.sprite.sheet;
    this.sprite.setPos(this.cx - s.fw / 2 + (this.anchorX || 0) * (this.facing < 0 ? -1 : 1), this.y + this.h - s.fh + this.footPad);
  }
  patrol(dt, speed) {
    if (this.wallAhead(this.facing) || this.ledgeAhead(this.facing) || Math.abs(this.x - this.home.x) > 90) {
      if (this.stateT > 0.3) {
        this.facing = this.wallAhead(this.facing) || this.ledgeAhead(this.facing) ? -this.facing : sign(this.home.x - this.x) || -this.facing;
        this.stateT = 0;
      }
      this.vx = 0;
    } else this.vx = approach(this.vx, this.facing * speed, 400 * dt);
  }
  dispose() { this.sprite.dispose(); }
}

// Petit démon : patrouille, poursuit, bondit sur le héros
class BasicDemon extends Enemy {
  constructor(level, type, x, groundY) {
    super(level, type, x, groundY, 12, 12);
    this.footPad = 1;
  }
  ai(dt) {
    const p = this.player(), cfg = this.cfg;
    switch (this.state) {
      case 'patrol':
        this.patrol(dt, cfg.speed);
        if (this.canSee(120)) { this.setState('chase'); this.game.fx.alert(this.cx, this.y - 6); }
        break;
      case 'chase': {
        const dx = p.cx - this.cx;
        this.facing = sign(dx) || this.facing;
        if (this.ledgeAhead(this.facing) || this.wallAhead(this.facing)) this.vx = approach(this.vx, 0, 600 * dt);
        else this.vx = approach(this.vx, this.facing * cfg.chase, 500 * dt);
        if (Math.abs(dx) < 46 && Math.abs(p.cy - this.cy) < 30 && this.cool <= 0 && this.onGround) this.setState('windup');
        if (this.distToPlayer() > 220) this.setState('patrol');
        break;
      }
      case 'windup':
        this.telegraph = true;
        this.vx = approach(this.vx, 0, 800 * dt);
        if (this.stateT > 0.32) {
          this.telegraph = false;
          this.vy = -210;
          this.vx = this.facing * 150;
          this.setState('lunge');
        }
        break;
      case 'lunge':
        if (this.onGround && this.stateT > 0.1) {
          this.cool = rand(0.9, 1.4);
          this.setState('chase');
        }
        break;
    }
    this.physics(dt);
    const f = this.state === 'lunge' || this.state === 'windup' ? 4 : Math.abs(this.vx) > 5 ? Math.floor(this.animT * 8) % 4 : Math.floor(this.animT * 3) % 2;
    this.sprite.setFrame(this.state === 'hurt' ? 5 : f);
  }
}

// Guerrier : soldat, fantôme, statue animée, moine démoniaque, garde céleste…
class Warrior extends Enemy {
  constructor(level, type, x, groundY) {
    const heavy = ENEMY_TYPES[type].heavy;
    super(level, type, x, groundY, heavy ? 16 : 14, heavy ? 28 : 26);
    this.footPad = 2;
    this.anchorX = 0;
    this.hitDone = false;
    this.teleT = rand(3, 6);
    if (this.cfg.ghost) this.opacity = 0.78;
    if (this.cfg.dormant) {
      this.setState('dormant');
      this.invulnerable = false;
      this.sprite.setTint(0x9a9aa8);
    }
  }
  ai(dt) {
    const p = this.player(), cfg = this.cfg, g = this.game;
    this.telegraph = false;
    switch (this.state) {
      case 'dormant':
        this.vx = 0;
        if (this.distToPlayer() < 80 || this.hp < this.maxHp) {
          this.setState('awaken');
          g.audio.play('slam');
          g.camera.shake(3, 0.4);
          g.fx.burst(this.cx, this.y + this.h, 16, [PAL.stone, PAL.stoneLight, PAL.jade], 90, 0.7, 150);
        }
        break;
      case 'awaken':
        this.telegraph = true;
        if (this.stateT > 0.8) { this.sprite.setTint(0xffffff); this.setState('chase'); }
        break;
      case 'patrol':
        this.patrol(dt, cfg.speed);
        if (this.canSee(150)) { this.setState('chase'); g.fx.alert(this.cx, this.y - 8); }
        break;
      case 'chase': {
        const dx = p.cx - this.cx, adx = Math.abs(dx);
        this.facing = sign(dx) || this.facing;
        let want = 0;
        if (cfg.ranged) {
          if (adx < 70) want = -this.facing;
          else if (adx > 130) want = this.facing;
        } else if (adx > (cfg.reach || 26) - 4) want = this.facing;
        if (want && (this.ledgeAhead(want) || this.wallAhead(want))) want = 0;
        this.vx = approach(this.vx, want * cfg.chase, 400 * dt);
        if (cfg.ranged) {
          if (adx < 170 && Math.abs(p.cy - this.cy) < 80 && this.cool <= 0) this.setState('cast');
        } else if (adx <= (cfg.reach || 26) + 4 && Math.abs(p.cy - this.cy) < 28 && this.cool <= 0) this.setState('windup');
        if (cfg.ghost) {
          this.teleT -= dt;
          if (this.teleT <= 0 && adx > 40) this.setState('fadeOut');
        }
        if (this.distToPlayer() > 260) this.setState('patrol');
        break;
      }
      case 'windup':
        this.telegraph = true;
        this.vx = approach(this.vx, 0, 600 * dt);
        if (this.stateT > (cfg.heavy ? 0.7 : 0.45)) { this.setState('slash'); this.hitDone = false; this.vx = this.facing * 90; g.audio.play('attack'); }
        break;
      case 'slash': {
        this.vx = approach(this.vx, 0, 500 * dt);
        const reach = (cfg.reach || 26) + 6;
        const box = { x: this.facing > 0 ? this.cx : this.cx - reach, y: this.y - 4, w: reach, h: this.h };
        if (!this.hitDone && p && overlap(box, p)) { this.hitDone = p.hurt(this.damage, this.cx) || this.hitDone; }
        if (cfg.heavy && this.stateT < dt * 1.5) {
          g.camera.shake(3, 0.2);
          g.fx.dust(this.cx + this.facing * 16, this.y + this.h, 8);
        }
        if (this.stateT > 0.22) { this.cool = rand(0.8, 1.3); this.setState('recover'); }
        break;
      }
      case 'recover':
        this.vx = approach(this.vx, 0, 600 * dt);
        if (this.stateT > 0.45) this.setState('chase');
        break;
      case 'cast':
        this.telegraph = this.stateT < 0.5;
        this.vx = approach(this.vx, 0, 600 * dt);
        if (this.stateT > 0.55 && !this.hitDone) {
          this.hitDone = true;
          const kind = cfg.ranged;
          const sx = this.cx + this.facing * 14, sy = this.y + 10;
          if (kind === 'voidball') {
            for (let i = -1; i <= 1; i++) {
              const a = Math.atan2(p.cy - sy, p.cx - sx) + i * 0.22;
              this.level.addProjectile(new Projectile(this.level, 'voidball', sx - 6, sy - 6, Math.cos(a) * 110, Math.sin(a) * 110, 'enemy', 1));
            }
          } else this.level.addProjectile(new Projectile(this.level, 'fireball', sx - 6, sy - 6, this.facing * 130, 0, 'enemy', 1));
          g.audio.play('enemyShot');
        }
        if (this.stateT > 0.9) { this.hitDone = false; this.cool = rand(1.6, 2.4); this.setState('chase'); }
        break;
      case 'fadeOut':
        this.vx = 0;
        this.opacity = Math.max(0, 0.78 - this.stateT * 3);
        if (this.stateT > 0.3) {
          const side = -p.facing || 1;
          let nx = p.cx + side * 34 - this.w / 2;
          if (this.level.solidAt(Math.floor((nx + this.w / 2) / TILE), Math.floor((p.y + p.h - 4) / TILE))) nx = p.cx - side * 34 - this.w / 2;
          this.x = nx;
          this.y = p.y + p.h - this.h - 2;
          this.facing = sign(p.cx - this.cx) || 1;
          this.teleT = rand(4, 7);
          g.fx.burst(this.cx, this.cy, 10, [PAL.qi, PAL.white], 60, 0.5);
          this.setState('fadeIn');
        }
        break;
      case 'fadeIn':
        this.opacity = Math.min(0.78, this.stateT * 3);
        if (this.stateT > 0.3) { this.cool = 0; this.setState('windup'); }
        break;
    }
    this.physics(dt);
    let f;
    if (this.state === 'dormant' || this.state === 'awaken') f = 1;
    else if (this.state === 'windup') f = 4;
    else if (this.state === 'slash') f = 5;
    else if (this.state === 'cast') f = 7;
    else f = Math.abs(this.vx) > 5 ? Math.floor(this.animT * 7) % 4 : Math.floor(this.animT * 2) % 2;
    if (this.state === 'awaken') this.sprite.setTint(Math.floor(this.stateT * 12) % 2 ? 0xffffff : 0x9a9aa8);
    this.sprite.setFrame(f);
  }
  onHurt(dir) {
    if (this.state === 'dormant') return;
    if (!this.cfg.heavy && this.state !== 'slash' && this.state !== 'cast') this.setState('hurt');
  }
  render() {
    super.render();
    if (this.state === 'hurt') this.sprite.setFrame(6);
  }
}

// Esprit volant : flotte, plonge ou tire des projectiles
class FlyingSpirit extends Enemy {
  constructor(level, type, x, groundY) {
    super(level, type, x, groundY, 12, 12);
    this.flying = true;
    this.y = groundY - 40;
    this.home = { x: this.x, y: this.y };
    this.footPad = 4;
    this.phase = Math.random() * 6;
    this.setState('idle');
  }
  ai(dt) {
    const p = this.player(), cfg = this.cfg, g = this.game;
    this.telegraph = false;
    const hover = Math.sin(this.animT * 3 + this.phase) * 14;
    const moveTo = (tx, ty, sp) => {
      const dx = tx - this.cx, dy = ty - this.cy, d = Math.hypot(dx, dy) || 1;
      this.vx = approach(this.vx, (dx / d) * sp * Math.min(1, d / 20), 300 * dt);
      this.vy = approach(this.vy, (dy / d) * sp * Math.min(1, d / 20), 300 * dt);
    };
    switch (this.state) {
      case 'idle':
        moveTo(this.home.x + 6, this.home.y + hover * 0.5, cfg.speed * 0.5);
        if (this.distToPlayer() < 140) { this.setState('engage'); g.fx.alert(this.cx, this.y - 6); }
        break;
      case 'engage': {
        const side = this.cx < p.cx ? -1 : 1;
        const dist = cfg.mode === 'shoot' ? 80 : 40;
        moveTo(p.cx + side * dist, p.y - 34 + hover, cfg.speed);
        this.facing = sign(p.cx - this.cx) || this.facing;
        if (this.cool <= 0 && this.distToPlayer() < 150) this.setState('telegraph');
        if (Math.hypot(this.cx - this.home.x, this.cy - this.home.y) > 300 || this.distToPlayer() > 260) this.setState('return');
        break;
      }
      case 'telegraph':
        this.telegraph = true;
        this.vx = approach(this.vx, 0, 400 * dt);
        this.vy = approach(this.vy, 0, 400 * dt);
        if (this.stateT > 0.42) {
          if (cfg.mode === 'dive') {
            const dx = p.cx - this.cx, dy = p.cy - this.cy, d = Math.hypot(dx, dy) || 1;
            this.vx = (dx / d) * cfg.speed * 3.4;
            this.vy = (dy / d) * cfg.speed * 3.4;
            this.setState('dive');
            g.audio.play('dash');
          } else {
            const a = Math.atan2(p.cy - this.cy, p.cx - this.cx);
            this.level.addProjectile(new Projectile(this.level, cfg.proj, this.cx - 6, this.cy - 5, Math.cos(a) * 115, Math.sin(a) * 115, 'enemy', 1));
            g.audio.play('enemyShot');
            this.cool = rand(1.6, 2.4);
            this.setState('engage');
          }
        }
        break;
      case 'dive':
        if (this.stateT > 0.55) { this.cool = rand(1.4, 2.2); this.setState('engage'); }
        break;
      case 'return':
        moveTo(this.home.x, this.home.y, cfg.speed);
        if (Math.hypot(this.cx - this.home.x, this.cy - this.home.y) < 20) this.setState('idle');
        break;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.y = Math.max(4, Math.min(this.y, this.level.ph - 40));
    let f = Math.floor(this.animT * 8) % 4;
    if (this.state === 'telegraph' || this.state === 'dive') f = 4;
    this.sprite.setFrame(f);
    if (Math.random() < 0.25) {
      const col = hexNum(SPIRIT_PALETTES[this.type === 'voidSpirit' ? 'void' : this.type] ? SPIRIT_PALETTES[this.type === 'voidSpirit' ? 'void' : this.type].light : '#ffffff');
      g.fx.add.spawn(this.cx + rand(-4, 4), this.cy + rand(-2, 6), rand(-8, 8), rand(5, 20), 0.5, 1, col);
    }
  }
  render() {
    super.render();
    if (this.state === 'hurt') this.sprite.setFrame(5);
  }
}

// =========================================================================
// 8b. PROJECTILES, FRAPPES DE ZONE, OBJETS À RAMASSER
// =========================================================================
class Projectile {
  constructor(level, kind, x, y, vx, vy, owner, damage) {
    this.level = level;
    this.game = level.game;
    this.kind = kind;
    this.owner = owner;
    this.damage = damage;
    this.vx = vx;
    this.vy = vy;
    this.gravity = 0;
    this.life = 4;
    this.dead = false;
    this.pierce = false;
    this.parryable = owner === 'enemy';
    this.ground = false;
    this.walls = true;
    this.hits = new Set();
    this.t = 0;
    const sheet = kind === 'qiwave' ? ART.qiWave : kind === 'tornado' ? ART.tornado : ART.proj[kind];
    this.sprite = new Sprite(level.group, sheet, 16);
    this.w = Math.max(6, sheet.fw - 4);
    this.h = Math.max(6, sheet.fh - 4);
    this.x = x + 2;
    this.y = y + 2;
    this.trail = { fireball: 0xf07a2a, voidball: 0xc46bff, qiwave: 0x7fe3ff, windblade: 0xbfe8ff, meteor: 0xc46bff, jadeshard: 0x3ecf8e, shockwave: 0xf2b53a, jadewave: 0x9cf5c8, blade: 0xffffff, feather: 0xbfe8ff, tornado: 0xbfe8ff }[kind] || 0xffffff;
    if (kind === 'shockwave' || kind === 'jadewave' || kind === 'tornado') { this.ground = true; this.parryable = false; }
  }
  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.game.fx.burst(this.x + this.w / 2, this.y + this.h / 2, 8, [this.trail, 0xffffff], 70, 0.35);
    if (this.kind === 'meteor') {
      this.game.audio.play('explode');
      this.game.camera.shake(2, 0.15);
      this.game.fx.burst(this.x + this.w / 2, this.y + this.h / 2, 16, [PAL.violetLight, PAL.goldLight], 120, 0.6, 150);
    }
  }
  update(dt) {
    if (this.dead) return;
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) return this.destroy();
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const lv = this.level;
    if (this.walls) {
      const tx = Math.floor((this.x + this.w / 2) / TILE), ty = Math.floor((this.y + this.h / 2) / TILE);
      if (lv.solidAt(tx, ty) || (this.kind === 'meteor' && lv.standableAt(tx, Math.floor((this.y + this.h) / TILE)))) return this.destroy();
    }
    if (this.ground) {
      // reste collé au sol : s'arrête au bord du vide
      const ty = Math.floor((this.y + this.h + 2) / TILE);
      if (!lv.standableAt(Math.floor((this.x + this.w / 2) / TILE), ty)) return this.destroy();
    }
    if (this.owner === 'enemy') {
      const p = lv.player;
      if (p && !p.dead && overlap(this, { x: p.x + 2, y: p.y + 2, w: p.w - 4, h: p.h - 4 })) {
        if (p.hurt(this.damage, this.x + this.w / 2) && !this.pierce) return this.destroy();
      }
    } else {
      const targets = lv.boss ? lv.enemies.concat(lv.boss.hurtTargets()) : lv.enemies;
      for (const e of targets) {
        if (e.dead || this.hits.has(e) || !overlap(this, e.hitbox())) continue;
        this.hits.add(e);
        if (e.hurt(this.damage, sign(this.vx) || 1, 160)) {
          this.game.fx.sparks(e.hitbox().x + e.hitbox().w / 2, this.y + this.h / 2, sign(this.vx));
          this.game.hitstop = Math.max(this.game.hitstop, 0.04);
          if (!this.pierce) return this.destroy();
        }
      }
      for (const o of lv.objects) {
        if (!o.dead && o.onHit && !this.hits.has(o) && overlap(this, o)) {
          this.hits.add(o);
          o.onHit();
        }
      }
      if (this.parry) {
        for (const q of lv.projectiles) {
          if (q !== this && !q.dead && q.owner === 'enemy' && q.parryable && overlap(this, q)) q.destroy();
        }
      }
    }
    const fr = this.sprite.sheet.count;
    this.sprite.setFrame(Math.floor(this.t * 12) % fr);
    this.sprite.setFlip(this.vx < 0);
    this.sprite.setPos(this.x - 2, this.y - 2);
    if (Math.random() < 0.6) {
      const p = this.game.fx.add.spawn(this.x + this.w / 2 + rand(-3, 3), this.y + this.h / 2 + rand(-3, 3), -this.vx * 0.1, -this.vy * 0.1 + rand(-10, 10), 0.35, this.kind === 'qiwave' ? 2 : 1, this.trail);
      if (p) p.shrink = true;
    }
  }
  dispose() { this.sprite.dispose(); }
}

// Frappe de zone (éclair céleste) : avertissement puis colonne de dégâts
class Strike {
  constructor(level, x, delay = 0.85, color = 0xffe08a) {
    this.level = level;
    this.game = level.game;
    this.x = x - 8;
    this.w = 16;
    this.t = -delay;
    this.dead = false;
    this.color = color;
    this.hitDone = false;
    this.sprite = new Sprite(level.group, ART.lightning, 17);
    this.sprite.visible = false;
    this.floor = level.groundBelow(Math.floor(x / TILE), 0);
  }
  update(dt) {
    const g = this.game, lv = this.level;
    this.t += dt;
    const top = this.floor - ART.lightning.fh;
    if (this.t < 0) {
      if (Math.random() < 0.5) g.fx.add.spawn(this.x + rand(0, 16), this.floor - rand(0, 4), 0, rand(-40, -10), 0.3, 1, this.color);
      if (Math.floor(this.t * 12) % 2 === 0) g.fx.normal.spawn(this.x + rand(2, 14), this.floor - 1, 0, 0, 0.05, 2, 0xff3030);
      return;
    }
    if (!this.struck) {
      this.struck = true;
      g.audio.play('thunder');
      g.camera.shake(3, 0.2);
      g.flash(0xffffff, 0.15);
      g.fx.burst(this.x + 8, this.floor, 16, [this.color, 0xffffff], 140, 0.5, 200);
    }
    this.sprite.visible = true;
    this.sprite.setFrame(Math.floor(this.t * 20) % 2);
    this.sprite.setPos(this.x, top);
    this.sprite.setTint(this.color);
    const p = lv.player;
    if (!this.hitDone && p && overlap({ x: this.x + 2, y: top, w: 12, h: ART.lightning.fh }, p)) this.hitDone = p.hurt(1, this.x + 8);
    if (this.t > 0.28) this.dead = true;
  }
  dispose() { this.sprite.dispose(); }
}

const PICKUP_DEFS = {
  coin: { sheet: () => ART.coin, w: 8, h: 8 },
  orb: { sheet: () => ART.orb, w: 10, h: 10 },
  peach: { sheet: () => ART.peach, w: 10, h: 10 },
  flower: { sheet: () => ART.flower, w: 12, h: 12, glow: 0xf59ac0 },
  relic: { sheet: () => ART.relic, w: 12, h: 12, glow: 0xf2b53a },
  fragment: { sheet: () => ART.fragment, w: 16, h: 18, glow: 0x7fe3ff },
};
class Pickup {
  constructor(level, kind, x, y, dropped, key) {
    this.level = level;
    this.game = level.game;
    this.kind = kind;
    const d = PICKUP_DEFS[kind];
    this.w = d.w;
    this.h = d.h;
    this.x = x - d.w / 2;
    this.y = y - d.h / 2;
    this.key = key;
    this.dropped = dropped;
    this.vx = dropped ? rand(-70, 70) : 0;
    this.vy = dropped ? rand(-200, -120) : 0;
    this.life = dropped ? 9 : Infinity;
    this.t = Math.random() * 6;
    this.dead = false;
    this.onGround = false;
    this.standingOn = null;
    this.delay = dropped ? 0.35 : 0;
    this.sprite = new Sprite(level.group, d.sheet(), 11);
    if (d.glow) {
      this.glow = new Glow(level.group, kind === 'fragment' ? 80 : 40, d.glow, kind === 'fragment' ? 0.7 : 0.4, 0.3);
    }
  }
  update(dt) {
    if (this.dead) return;
    const p = this.level.player, g = this.game;
    this.t += dt;
    this.life -= dt;
    this.delay -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (this.dropped) {
      this.vy = Math.min(this.vy + CONFIG.GRAVITY * 0.8 * dt, 300);
      this.vx = approach(this.vx, 0, 60 * dt);
      const was = this.onGround;
      moveBody(this, this.level, dt);
      if (this.onGround && !was) this.vy = 0;
    }
    if (p && !p.dead && this.delay <= 0) {
      const dx = p.cx - (this.x + this.w / 2), dy = p.cy - (this.y + this.h / 2), d = Math.hypot(dx, dy);
      if ((this.kind === 'coin' || this.kind === 'orb') && d < 36) {
        this.x += (dx / d) * 160 * dt;
        this.y += (dy / d) * 160 * dt;
      }
      if (overlap(this, p)) this.collect();
    }
    const bob = this.dropped ? 0 : Math.round(Math.sin(this.t * 3) * 2);
    const fr = this.sprite.sheet.count;
    this.sprite.setFrame(Math.floor(this.t * (this.kind === 'coin' ? 8 : 4)) % fr);
    this.sprite.visible = !(this.dropped && this.life < 2 && Math.floor(this.t * 10) % 2 === 0);
    this.sprite.setPos(this.x + this.w / 2 - this.sprite.sheet.fw / 2, this.y + this.h / 2 - this.sprite.sheet.fh / 2 + bob);
    if (this.glow) {
      this.glow.setCenter(this.x + this.w / 2, this.y + this.h / 2 + bob);
      this.glow.update(this.level.time);
      if (Math.random() < 0.15) g.fx.add.spawn(this.x + rand(0, this.w), this.y + rand(0, this.h), 0, rand(-25, -8), 0.8, 1, this.kind === 'flower' ? 0xffd0ec : 0xffe08a);
    }
  }
  collect() {
    const g = this.game, lv = this.level;
    this.dead = true;
    if (this.key) g.levelState.collected.add(this.key);
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    switch (this.kind) {
      case 'coin':
        g.coins++;
        lv.stats.coins++;
        g.addScore(10);
        g.audio.play('coin');
        g.fx.burst(cx, cy, 5, [PAL.jade, PAL.jadeLight], 40, 0.3);
        break;
      case 'orb':
        g.gainQi(35);
        g.addScore(20);
        g.audio.play('orb');
        g.fx.ring(cx, cy, PAL.qi, 10);
        break;
      case 'peach':
        g.hp = Math.min(g.maxHp, g.hp + 1);
        g.addScore(20);
        g.audio.play('heal');
        g.fx.burst(cx, cy, 10, [PAL.pink, PAL.white], 50, 0.6, -30);
        g.toast('PÊCHE D\'IMMORTALITÉ  +1 VIE', PAL.pink);
        break;
      case 'flower':
        lv.stats.secrets++;
        g.flowers++;
        g.hp = g.maxHp;
        g.qi = g.maxQi;
        g.addScore(1000);
        g.audio.play('relic');
        g.fx.ring(cx, cy, PAL.pink, 22);
        g.toast('FLEUR SPIRITUELLE !  +1000 — VIE ET QI RESTAURÉS', PAL.pink);
        break;
      case 'relic':
        lv.stats.secrets++;
        g.relics++;
        g.points++;
        g.addScore(500);
        g.audio.play('relic');
        g.fx.ring(cx, cy, PAL.gold, 22);
        g.toast('RELIQUE ANCIENNE !  +1 POINT D\'AMÉLIORATION', PAL.goldLight);
        break;
      case 'fragment':
        g.audio.play('fragment');
        g.fx.ring(cx, cy, PAL.qi, 30);
        g.fx.burst(cx, cy, 40, [PAL.qi, PAL.white, PAL.goldLight], 150, 1.2);
        g.flash(0xffffff, 0.5);
        g.onFragment();
        break;
    }
  }
  dispose() {
    this.sprite.dispose();
    if (this.glow) this.glow.dispose();
  }
}

// ---- Effets (aides de haut niveau sur les systèmes de particules) ----
class FX {
  constructor(normal, add) {
    this.normal = normal;
    this.add = add;
  }
  burst(x, y, n, colors, speed, life, grav = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      const c = hexNum(colors[i % colors.length]);
      const sys = i % 2 ? this.add : this.normal;
      const p = sys.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * rand(0.6, 1), Math.random() < 0.3 ? 2 : 1, c);
      if (p) { p.grav = grav; p.drag = 2; }
    }
  }
  sparks(x, y, dir) {
    for (let i = 0; i < 9; i++) {
      const a = (dir > 0 ? 0 : Math.PI) + rand(-0.9, 0.9);
      const s = rand(80, 220);
      const p = this.add.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.15, 0.35), 1, pick([0xffffff, 0xffe08a, 0x7fe3ff]));
      if (p) p.drag = 6;
    }
    const f = this.add.spawn(x - 2, y - 2, 0, 0, 0.06, 5, 0xffffff);
    if (f) f.shrink = true;
  }
  dust(x, y, n) {
    for (let i = 0; i < n; i++) {
      const p = this.normal.spawn(x + rand(-4, 4), y - rand(0, 3), rand(-30, 30), rand(-25, -5), rand(0.3, 0.55), Math.random() < 0.5 ? 2 : 1, pick([0xbdb29a, 0x8a8070, 0xd8d0c0]));
      if (p) { p.drag = 3; p.grav = 30; }
    }
  }
  ring(x, y, col, r) {
    const c = hexNum(col);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const p = this.add.spawn(x, y, Math.cos(a) * r * 4, Math.sin(a) * r * 4, 0.3, 1, c);
      if (p) p.drag = 7;
    }
  }
  qiBurst(x, y) {
    for (let i = 0; i < 8; i++) {
      const p = this.add.spawn(x + rand(-6, 6), y + rand(-6, 6), rand(-20, 20), rand(-60, -20), rand(0.6, 1.1), 1, 0x7fe3ff);
      if (p) p.flicker = true;
    }
  }
  debris(x, y, col) {
    const p = this.normal.spawn(x, y, rand(-50, 50), rand(-120, -30), rand(0.6, 1.1), 2, hexNum(col));
    if (p) p.grav = 500;
  }
  ember(x, y) {
    const p = this.add.spawn(x + rand(-2, 2), y, rand(-6, 6), rand(-40, -20), rand(0.5, 1), 1, pick([0xffde4a, 0xf07a2a]));
    if (p) p.flicker = true;
  }
  alert(x, y) {
    for (let i = 0; i < 3; i++) this.add.spawn(x - 1, y - i * 2, 0, -20, 0.4, 1, 0xff4040);
  }
}

// =========================================================================
// 9. BOSS — système générique à états
//    IDLE → CHASE → ATTACK / SPECIAL_ATTACK → (DAMAGED) → PHASE_2 → DEAD
// =========================================================================
function drawLightning(ctx, f) {
  let x = 8;
  for (let y = 0; y < 176; y += 4) {
    const nx = clamp(x + randi(-2, 2), 3, 12);
    line(ctx, x, y, nx, y + 4, PAL.white, 2);
    if (f && y % 16 === 0) line(ctx, nx, y + 4, nx + (y % 32 ? 3 : -3), y + 9, PAL.goldLight);
    x = nx;
  }
}
function drawTornado(ctx, f) {
  for (let y = 2; y < 38; y += 3) {
    const r = 2 + (38 - y) * 0.2;
    const off = Math.sin(y * 0.4 + f * 2) * 2;
    rect(ctx, 10 - r + off, y, r * 2, 2, y % 6 ? '#bfe8ff' : '#ffffff');
    rect(ctx, 10 - r + off + ((f + y) % 3), y, 2, 1, '#5a9ac8');
  }
}

class Boss extends Enemy {
  constructor(level, kind, x, groundY, w, h, sheet, maxHp, name) {
    super(level, null, x, groundY, w, h);
    this.kind = kind;
    this.sprite.setSheet(sheet);
    this.sprite.mesh.renderOrder = 12;
    this.hp = this.maxHp = maxHp;
    this.name = name;
    this.phase = 1;
    this.active = false;
    this.poise = 0;
    this.poiseMax = 14;
    this.lastAttack = null;
    this.atk = null;
    this.dying = false;
    this.displayHp = maxHp;
    this.arenaX = level.arena.x;
    this.floorY = level.arena.y + H - 3 * TILE;
    this.setState('IDLE');
  }
  hurtTargets() { return this.active && !this.dying && this.state !== 'PHASE_2' ? [this] : []; }
  minionCount() { return this.level.enemies.filter((e) => e.summoned && !e.dead).length; }
  hurt(dmg, dir) {
    if (!this.active || this.dying || this.state === 'PHASE_2') return false;
    this.hp -= dmg;
    this.flashT = 0.1;
    this.poise += dmg;
    this.game.registerHit();
    this.game.audio.play('hit');
    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.hp = Math.ceil(this.maxHp * 0.5);
      this.enterPhase2();
    } else if (this.hp <= 0) {
      this.hp = 0;
      this.defeat();
    } else if (this.poise >= this.poiseMax && this.state === 'CHASE') {
      this.poise = 0;
      this.setState('DAMAGED');
      this.vx = dir * 60;
    }
    return true;
  }
  enterPhase2() {
    const g = this.game;
    this.setState('PHASE_2');
    this.atk = null;
    this.vx = 0;
    g.audio.play('roar');
    g.camera.shake(6, 1.4);
    g.flash(0xffffff, 0.5);
    g.toast(this.name + ' ENTRE EN FUREUR !', PAL.vermilion);
    for (const p of this.level.projectiles) if (p.owner === 'enemy') p.destroy();
  }
  defeat() {
    const g = this.game;
    this.dying = true;
    this.setState('DEAD');
    this.atk = null;
    g.audio.play('roar');
    g.camera.shake(5, 2);
    g.slowmo = 1.2;
    for (const e of this.level.enemies) if (e.summoned && !e.dead) e.die(0);
    for (const p of this.level.projectiles) if (p.owner === 'enemy') p.destroy();
  }
  summon(type, n) {
    const a = this.level.arena;
    for (let i = 0; i < n; i++) {
      const x = a.x + (i % 2 ? 260 : 60) + rand(-20, 20);
      const e = this.level.spawnEnemy(type, x, this.floorY - (ENEMY_TYPES[type].cls === 'FlyingSpirit' ? 30 : 60), true);
      e.state = e.flying ? 'engage' : 'chase';
      e.home = { x: e.x, y: e.y };
      this.game.fx.burst(e.cx, e.cy, 14, [PAL.violet, PAL.violetLight, PAL.black], 90, 0.6);
    }
    this.game.audio.play('roar');
  }
  update(dt) {
    const g = this.game;
    this.stateT += dt;
    this.flashT -= dt;
    this.animT += dt;
    this.displayHp = approach(this.displayHp, this.hp, this.maxHp * 0.6 * dt);
    switch (this.state) {
      case 'IDLE':
        this.idleUpdate(dt);
        if (this.active && this.stateT > (this.phase === 2 ? 0.35 : 0.7)) this.setState('CHASE');
        break;
      case 'CHASE':
        this.chaseUpdate(dt);
        if (this.stateT > this.chaseTime() || (this.stateT > 0.3 && this.inRange())) {
          const name = this.chooseAttack();
          this.lastAttack = name;
          this.atk = { name, t: 0, step: 0, n: 0 };
          this.setState(this.isSpecial(name) ? 'SPECIAL_ATTACK' : 'ATTACK');
          this.startAttack(name);
        }
        break;
      case 'ATTACK':
      case 'SPECIAL_ATTACK':
        this.atk.t += dt;
        if (this.attackUpdate(dt, this.atk)) { this.atk = null; this.setState('IDLE'); }
        break;
      case 'DAMAGED':
        this.damagedUpdate(dt);
        if (this.stateT > 0.6) this.setState('CHASE');
        break;
      case 'PHASE_2':
        this.phase2Update(dt);
        if (Math.random() < 0.6) g.fx.add.spawn(this.cx + rand(-20, 20), this.cy + rand(-20, 20), rand(-40, 40), rand(-80, -20), 0.7, 2, pick([0xc46bff, 0xe0412b, 0xffe08a]));
        if (this.stateT > 2) { this.phase = 2; this.onPhase2(); this.setState('IDLE'); }
        break;
      case 'DEAD':
        this.deadUpdate(dt);
        break;
    }
    if (this.active && !this.dying && this.state !== 'PHASE_2') this.contactDamage();
    this.render();
  }
  contactDamage() {
    const p = this.player();
    if (p && !p.dead && overlap(this.hitbox(), p)) p.hurt(1, this.cx);
  }
  telegraphOn(t) { this.telegraph = t; }
  idleUpdate(dt) { this.vx = approach(this.vx, 0, 600 * dt); this.physics(dt); }
  damagedUpdate(dt) { this.vx = approach(this.vx, 0, 300 * dt); this.physics(dt); }
  phase2Update(dt) { this.vx = 0; this.physics(dt); }
  chaseTime() { return 1.2; }
  inRange() { return false; }
  isSpecial(name) { return ['summon', 'slam', 'tornado', 'feathers', 'breath', 'lightning', 'meteor'].includes(name); }
  onPhase2() {}
  pickWeighted(opts) {
    const list = opts.filter((o) => o[1] > 0 && (o[0] !== this.lastAttack || opts.length === 1));
    let total = list.reduce((s, o) => s + o[1], 0), r = Math.random() * total;
    for (const o of list) { r -= o[1]; if (r <= 0) return o[0]; }
    return list[0][0];
  }
  deadUpdate(dt) {
    const g = this.game;
    this.vx = approach(this.vx, 0, 300 * dt);
    if (!this.flying) this.physics(dt);
    if (Math.random() < 0.35) {
      g.fx.burst(this.cx + rand(-this.w / 2, this.w / 2), this.cy + rand(-this.h / 2, this.h / 2), 10, [PAL.vermilion, PAL.goldLight, PAL.white, PAL.violet], 110, 0.6);
      if (Math.random() < 0.3) g.audio.play('explode');
    }
    this.sprite.setFlash(0.4 + 0.4 * Math.sin(this.stateT * 30), 0xffffff);
    this.sprite.setDissolve(clamp((this.stateT - 1.4) / 1.2, 0, 1));
    if (this.stateT > 2.7 && !this.finished) this.finish();
  }
  finish() {
    const g = this.game;
    this.finished = true;
    this.sprite.visible = false;
    g.flash(0xffffff, 0.8);
    g.audio.play('explode');
    g.fx.burst(this.cx, this.cy, 60, [PAL.white, PAL.goldLight, PAL.qi, PAL.vermilion], 200, 1.2);
    g.onBossDefeated();
  }
  render() {
    if (this.state === 'DEAD') { this.place(); return; }
    this.sprite.setFlip(this.facing < 0);
    this.sprite.setFlash(this.flashT > 0 ? 1 : this.telegraph ? (Math.floor(this.animT * 18) % 2 ? 0.5 : 0) : 0, this.flashT > 0 ? 0xffffff : 0xff3030);
    this.sprite.setTint(this.phase === 2 ? 0xffb0b0 : 0xffffff);
    this.place();
  }
}

// ---- Boss terrestres : le Général Corrompu et le Gardien de Jade ----
class GuardianBoss extends Boss {
  constructor(level, kind, x, gy, name) {
    const lion = kind === 'lion';
    super(level, kind, x, gy, lion ? 40 : 24, lion ? 28 : 40, lion ? ART.jadeLion : ART.general, lion ? 110 : 80, name);
    this.lion = lion;
    this.footPad = lion ? 1 : 2;
    this.wave = lion ? 'jadewave' : 'shockwave';
    this.shard = lion ? 'jadeshard' : 'blade';
    this.minion = lion ? 'impPurple' : 'imp';
    this.cfg = { heavy: true };
  }
  speed() { return (this.lion ? 58 : 50) * (this.phase === 2 ? 1.4 : 1); }
  chaseTime() { return this.phase === 2 ? 0.8 : 1.3; }
  inRange() { const p = this.player(); return p && Math.abs(p.cx - this.cx) < (this.lion ? 52 : 46); }
  chaseUpdate(dt) {
    const p = this.player();
    this.facing = sign(p.cx - this.cx) || this.facing;
    this.vx = approach(this.vx, this.facing * this.speed(), 300 * dt);
    this.physics(dt);
    this.frame = 2 + (Math.floor(this.animT * 6) % 2);
  }
  idleUpdate(dt) {
    super.idleUpdate(dt);
    const p = this.player();
    if (p) this.facing = sign(p.cx - this.cx) || this.facing;
    this.frame = Math.floor(this.animT * 2) % 2;
  }
  damagedUpdate(dt) { super.damagedUpdate(dt); this.frame = 7; }
  phase2Update(dt) { super.phase2Update(dt); this.frame = this.lion ? 6 : 4; this.telegraph = true; }
  chooseAttack() {
    const p = this.player(), d = Math.abs(p.cx - this.cx);
    const p2 = this.phase === 2;
    return this.pickWeighted([
      ['slash', d < 70 ? 4 : 0.5],
      ['charge', d > 80 ? 2.5 : 0.5],
      ['slam', 2],
      ['projectile', d > 60 ? 2 : 0.5],
      ['summon', this.minionCount() < (p2 ? 3 : 2) ? (p2 ? 1.5 : 1) : 0],
    ]);
  }
  startAttack(name) {
    this.vx = 0;
    this.hitDone = false;
  }
  attackUpdate(dt, a) {
    const g = this.game, p = this.player(), p2 = this.phase === 2;
    this.telegraph = false;
    switch (a.name) {
      case 'slash': {
        const wind = p2 ? 0.35 : 0.5;
        if (a.t < wind) {
          this.frame = 4;
          this.telegraph = true;
          this.facing = sign(p.cx - this.cx) || this.facing;
          this.vx = approach(this.vx, 0, 600 * dt);
        } else if (a.t < wind + 0.25) {
          if (this.frame !== 5) { this.vx = this.facing * 230; g.audio.play('attack3'); }
          this.frame = 5;
          const reach = this.lion ? 30 : 36;
          const box = { x: this.facing > 0 ? this.cx : this.cx - reach - this.w / 2, y: this.y - 6, w: reach + this.w / 2, h: this.h + 6 };
          if (!this.hitDone && overlap(box, p)) this.hitDone = p.hurt(1, this.cx);
          this.vx = approach(this.vx, 0, 700 * dt);
        } else {
          this.frame = 1;
          this.vx = approach(this.vx, 0, 700 * dt);
          if (a.t > wind + 0.7) {
            if (p2 && a.n < 1) { a.n++; a.t = 0; this.hitDone = false; }
            else { this.physics(dt); return true; }
          }
        }
        this.physics(dt);
        return false;
      }
      case 'charge': {
        if (a.step === 0) {
          this.frame = 4;
          this.telegraph = true;
          this.facing = sign(p.cx - this.cx) || this.facing;
          if (Math.random() < 0.4) g.fx.dust(this.cx - this.facing * 10, this.y + this.h, 1);
          if (a.t > 0.65) { a.step = 1; a.t = 0; g.audio.play('roar'); }
          this.physics(dt);
        } else if (a.step === 1) {
          this.frame = 5;
          this.vx = this.facing * (p2 ? 330 : 270);
          if (Math.random() < 0.6) g.fx.dust(this.cx - this.facing * 12, this.y + this.h, 2);
          const res = this.physics(dt);
          if (res.hitX || a.t > 2) {
            a.step = 2;
            a.t = 0;
            this.vx = -this.facing * 80;
            this.vy = -150;
            g.audio.play('slam');
            g.camera.shake(6, 0.4);
            const n = p2 ? 6 : 3;
            for (let i = 0; i < n; i++) {
              const pr = new Projectile(this.level, this.shard, this.arenaX + 30 + Math.random() * 260, this.level.arena.y + 4 - i * 20, rand(-15, 15), 60, 'enemy', 1);
              pr.gravity = 260;
              this.level.addProjectile(pr);
            }
          }
        } else {
          this.frame = 7;
          this.vx = approach(this.vx, 0, 200 * dt);
          this.physics(dt);
          if (a.t > (p2 ? 0.55 : 0.9)) return true;
        }
        return false;
      }
      case 'slam': {
        if (a.step === 0) {
          this.frame = 4;
          this.telegraph = true;
          this.physics(dt);
          if (a.t > 0.35) {
            a.step = 1;
            a.t = 0;
            this.vy = -440;
            this.vx = clamp((p.cx - this.cx) / 0.9, -220, 220);
            this.facing = sign(this.vx) || this.facing;
            g.audio.play('jump');
          }
        } else if (a.step === 1) {
          this.frame = 6;
          const res = this.physics(dt);
          if (res.landed && a.t > 0.15) {
            a.step = 2;
            a.t = 0;
            this.vx = 0;
            this.spawnWaves();
          }
        } else {
          this.frame = 1;
          this.physics(dt);
          if (p2 && a.n === 0 && a.t > 0.35) { a.n = 1; this.spawnWaves(); }
          if (a.t > 0.75) return true;
        }
        return false;
      }
      case 'projectile': {
        this.frame = this.lion ? 6 : 4;
        this.telegraph = a.t < 0.45;
        this.vx = approach(this.vx, 0, 600 * dt);
        this.physics(dt);
        if (a.t > 0.45 && a.n === 0) {
          a.n = 1;
          const n = p2 ? 5 : 3;
          const base = Math.atan2(p.cy - this.cy, p.cx - this.cx);
          for (let i = 0; i < n; i++) {
            const ang = base + (i - (n - 1) / 2) * 0.22;
            const pr = new Projectile(this.level, this.shard, this.cx - 6, this.cy - 10, Math.cos(ang) * 140, Math.sin(ang) * 140 - 30, 'enemy', 1);
            pr.gravity = 60;
            this.level.addProjectile(pr);
          }
          g.audio.play('enemyShot');
        }
        return a.t > 0.95;
      }
      case 'summon': {
        this.frame = this.lion ? 6 : 4;
        this.telegraph = true;
        this.physics(dt);
        if (a.t > 0.7 && a.n === 0) { a.n = 1; this.summon(this.minion, this.phase === 2 ? 3 : 2); }
        return a.t > 1.2;
      }
    }
    return true;
  }
  spawnWaves() {
    const g = this.game;
    g.audio.play('slam');
    g.camera.shake(5, 0.35);
    g.fx.dust(this.cx, this.y + this.h, 16);
    for (const dir of [-1, 1]) {
      const pr = new Projectile(this.level, this.wave, this.cx - 8 + dir * 14, this.y + this.h - 14, dir * (this.phase === 2 ? 190 : 150), 0, 'enemy', 1);
      pr.life = 2.5;
      this.level.addProjectile(pr);
    }
  }
  render() {
    super.render();
    this.sprite.setFrame(this.state === 'DEAD' ? 7 : this.frame || 0);
  }
}

// ---- Boss volant : le Seigneur des Vents ----
class WindLordBoss extends Boss {
  constructor(level, x, gy, name) {
    super(level, 'wind', x, gy, 22, 34, ART.windLord, 115, name);
    this.flying = true;
    this.y = level.arena.y + 40;
    this.footPad = 6;
    this.side = 1;
  }
  physics(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const a = this.level.arena;
    this.x = clamp(this.x, a.x + TILE, a.x + W - TILE - this.w);
    this.y = clamp(this.y, a.y + 8, this.floorY - this.h);
    return {};
  }
  steer(tx, ty, sp, dt) {
    const dx = tx - this.cx, dy = ty - this.cy, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 30);
    this.vx = approach(this.vx, (dx / d) * sp * k, 400 * dt);
    this.vy = approach(this.vy, (dy / d) * sp * k, 400 * dt);
  }
  chaseTime() { return this.phase === 2 ? 0.9 : 1.4; }
  idleUpdate(dt) {
    this.steer(this.cx, this.level.arena.y + 55 + Math.sin(this.animT * 2) * 10, 40, dt);
    this.physics(dt);
    this.frame = Math.floor(this.animT * 6) % 4;
  }
  chaseUpdate(dt) {
    const p = this.player();
    if (this.stateT < dt * 1.5) this.side = p.cx < this.level.arena.x + W / 2 ? 1 : -1;
    this.steer(p.cx + this.side * 70, this.level.arena.y + 50 + Math.sin(this.animT * 2.5) * 14, this.phase === 2 ? 110 : 80, dt);
    this.physics(dt);
    this.facing = sign(p.cx - this.cx) || this.facing;
    this.frame = Math.floor(this.animT * 6) % 4;
  }
  damagedUpdate(dt) { this.vx = approach(this.vx, 0, 300 * dt); this.vy = approach(this.vy, -20, 300 * dt); this.physics(dt); this.frame = 6; }
  phase2Update(dt) { this.vx = this.vy = 0; this.frame = 4; this.telegraph = true; }
  chooseAttack() {
    const p2 = this.phase === 2;
    return this.pickWeighted([
      ['fan', 3],
      ['dive', 2],
      ['tornado', 2],
      ['summon', this.minionCount() < 2 ? 1 : 0],
      ['feathers', p2 ? 2 : 0],
    ]);
  }
  startAttack() { this.hitDone = false; }
  attackUpdate(dt, a) {
    const g = this.game, p = this.player(), p2 = this.phase === 2, lv = this.level;
    this.telegraph = false;
    this.facing = sign(p.cx - this.cx) || this.facing;
    switch (a.name) {
      case 'fan': {
        this.frame = 4;
        this.vx = approach(this.vx, 0, 300 * dt);
        this.vy = approach(this.vy, 0, 300 * dt);
        this.physics(dt);
        this.telegraph = a.t < 0.5;
        const shots = p2 ? 2 : 1;
        if (a.t > 0.5 + a.n * 0.45 && a.n < shots) {
          a.n++;
          const n = p2 ? 7 : 5, base = Math.atan2(p.cy - this.cy, p.cx - this.cx);
          for (let i = 0; i < n; i++) {
            const ang = base + (i - (n - 1) / 2) * 0.2;
            lv.addProjectile(new Projectile(lv, 'windblade', this.cx - 7, this.cy - 5, Math.cos(ang) * 120, Math.sin(ang) * 120, 'enemy', 1));
          }
          g.audio.play('enemyShot');
        }
        return a.t > 0.6 + shots * 0.45;
      }
      case 'dive': {
        if (a.step === 0) {
          this.frame = 4;
          this.telegraph = true;
          this.steer(p.cx, lv.arena.y + 40, 120, dt);
          this.physics(dt);
          if (a.t > 0.7) {
            a.step = 1;
            a.t = 0;
            const dx = p.cx - this.cx, dy = this.floorY - 10 - this.cy, d = Math.hypot(dx, dy) || 1;
            this.vx = (dx / d) * 300;
            this.vy = (dy / d) * 300;
            g.audio.play('dash');
          }
        } else if (a.step === 1) {
          this.frame = 5;
          this.physics(dt);
          if (this.y + this.h >= this.floorY - 1 || a.t > 1.2) {
            a.step = 2;
            a.t = 0;
            g.audio.play('slam');
            g.camera.shake(4, 0.3);
            g.fx.dust(this.cx, this.floorY, 14);
            for (const dir of [-1, 1]) lv.addProjectile(new Projectile(lv, 'windblade', this.cx - 7 + dir * 10, this.floorY - 12, dir * 150, 0, 'enemy', 1));
            this.vx = 0;
            this.vy = 0;
          }
        } else {
          this.frame = 6;
          this.vy = approach(this.vy, -90, 300 * dt);
          this.physics(dt);
          if (a.t > (p2 ? 0.6 : 1.0)) return true;
        }
        return false;
      }
      case 'tornado': {
        this.frame = 4;
        this.telegraph = a.t < 0.6;
        this.vx = approach(this.vx, 0, 300 * dt);
        this.vy = approach(this.vy, 0, 300 * dt);
        this.physics(dt);
        if (a.t > 0.6 && a.n === 0) {
          a.n = 1;
          const n = p2 ? 3 : 2;
          for (let i = 0; i < n; i++) {
            const fromLeft = i % 2 === 0;
            const x = fromLeft ? lv.arena.x + 24 : lv.arena.x + W - 44;
            const pr = new Projectile(lv, 'tornado', x, this.floorY - 42 - (i > 1 ? 0 : 0), (fromLeft ? 1 : -1) * (p2 ? 85 : 65) * (i > 1 ? 1.4 : 1), 0, 'enemy', 1);
            pr.life = 4.5;
            pr.pierce = true;
            lv.addProjectile(pr);
          }
          g.audio.play('dash');
        }
        return a.t > 1.1;
      }
      case 'summon': {
        this.frame = 4;
        this.telegraph = true;
        this.vx = approach(this.vx, 0, 300 * dt);
        this.vy = approach(this.vy, 0, 300 * dt);
        this.physics(dt);
        if (a.t > 0.6 && a.n === 0) { a.n = 1; this.summon(p2 ? 'bat' : 'wind', 2); }
        return a.t > 1.1;
      }
      case 'feathers': {
        this.frame = 4;
        this.steer(lv.arena.x + W / 2, lv.arena.y + 30, 100, dt);
        this.physics(dt);
        if (a.t > 0.4 && a.t < 2.2 && Math.floor(a.t * 10) > a.n) {
          a.n = Math.floor(a.t * 10);
          const pr = new Projectile(lv, 'feather', lv.arena.x + 20 + Math.random() * 280, lv.arena.y - 6, rand(-30, 30), 150, 'enemy', 1);
          pr.walls = true;
          lv.addProjectile(pr);
        }
        return a.t > 2.5;
      }
    }
    return true;
  }
  deadUpdate(dt) {
    this.vy = approach(this.vy, 30, 100 * dt);
    this.physics(dt);
    super.deadUpdate(dt);
    this.frame = 6;
  }
  render() {
    super.render();
    this.sprite.setFrame(this.frame || 0);
    if (Math.random() < 0.4 && !this.dying) this.game.fx.add.spawn(this.cx + rand(-8, 8), this.y + this.h, rand(-10, 10), rand(10, 30), 0.5, 1, 0xbfe8ff);
  }
}

// ---- Boss final : le Roi Dragon Déchu (tête + corps segmenté) ----
class DragonKingBoss extends Boss {
  constructor(level, x, gy, name) {
    super(level, 'dragon', x, gy, 30, 20, ART.dragonHead, 200, name);
    this.flying = true;
    this.poiseMax = 18;
    const a = level.arena;
    this.x = a.x + W + 40;
    this.y = a.y + 40;
    this.path = [];
    this.segs = [];
    for (let i = 0; i < 13; i++) {
      const s = new Sprite(level.group, i === 12 ? ART.dragonTail : ART.dragonSeg, 11);
      s.setFrame(i === 12 ? 0 : i >= 10 ? 2 : i === 2 || i === 7 ? 3 : i % 2);
      this.segs.push({ s, x: this.x, y: this.y, alive: true });
    }
    for (let i = 0; i < 130; i++) this.path.push({ x: this.cx + i * 2, y: this.cy });
    this.mouth = 0;
    this.footPad = 6;
  }
  hitbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  physics(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const a = this.level.arena;
    this.y = clamp(this.y, a.y - 30, this.floorY - this.h - 2);
    return {};
  }
  steer(tx, ty, sp, dt, acc = 500) {
    const dx = tx - this.cx, dy = ty - this.cy, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 40);
    this.vx = approach(this.vx, (dx / d) * sp * k, acc * dt);
    this.vy = approach(this.vy, (dy / d) * sp * k, acc * dt);
  }
  sp(v) { return v * (this.phase === 2 ? 1.3 : 1); }
  chaseTime() { return this.phase === 2 ? 1.3 : 1.8; }
  idleUpdate(dt) {
    this.steer(this.cx + Math.cos(this.animT) * 30, this.level.arena.y + 50 + Math.sin(this.animT * 2) * 20, this.sp(70), dt);
    this.physics(dt);
  }
  chaseUpdate(dt) {
    const a = this.level.arena, t = this.animT;
    this.steer(a.x + W / 2 + Math.sin(t * 1.2) * 120, a.y + 55 + Math.sin(t * 2.4) * 30, this.sp(150), dt);
    this.physics(dt);
  }
  damagedUpdate(dt) { this.vx = approach(this.vx, 0, 200 * dt); this.vy = approach(this.vy, 40, 200 * dt); this.physics(dt); }
  phase2Update(dt) {
    this.steer(this.level.arena.x + W / 2, this.level.arena.y + 40, 120, dt);
    this.physics(dt);
    this.mouth = 1;
  }
  onPhase2() {
    for (const s of this.segs) s.s.setTint(0xd090ff);
    this.sprite.setTint(0xd090ff);
  }
  chooseAttack() {
    const p2 = this.phase === 2;
    return this.pickWeighted([
      ['swoop', 3],
      ['fireballs', 2.5],
      ['breath', 1.5],
      ['lightning', 2],
      ['summon', this.minionCount() < 2 ? 1 : 0],
      ['meteor', p2 ? 2 : 0],
    ]);
  }
  startAttack() {}
  fire(kind, ang, speed) {
    const lv = this.level;
    const mx = this.cx + this.facing * 16, my = this.cy + 6;
    const pr = new Projectile(lv, kind, mx - 6, my - 6, Math.cos(ang) * speed, Math.sin(ang) * speed, 'enemy', 1);
    lv.addProjectile(pr);
    return pr;
  }
  attackUpdate(dt, a) {
    const g = this.game, p = this.player(), p2 = this.phase === 2, lv = this.level, ar = lv.arena;
    this.telegraph = false;
    this.mouth = 0;
    switch (a.name) {
      case 'swoop': {
        if (a.step === 0) {
          if (a.t < dt * 1.5) a.dir = p.cx < ar.x + W / 2 ? -1 : 1;
          const sx = a.dir > 0 ? ar.x + 10 : ar.x + W - 10;
          this.steer(sx, this.floorY - 26, this.sp(220), dt, 900);
          this.physics(dt);
          if ((Math.abs(this.cx - sx) < 20 && a.t > 0.6) || a.t > 2) { a.step = 1; a.t = 0; g.audio.play('roar'); }
        } else if (a.step === 1) {
          this.mouth = 1;
          this.telegraph = true;
          this.vx = approach(this.vx, 0, 600 * dt);
          this.vy = approach(this.vy, 0, 600 * dt);
          this.physics(dt);
          if (a.t > 0.55) { a.step = 2; a.t = 0; }
        } else if (a.step === 2) {
          this.mouth = 1;
          this.vx = a.dir * this.sp(250);
          this.vy = approach(this.vy, (this.floorY - 24 - this.cy) * 3, 600 * dt);
          this.physics(dt);
          if (Math.random() < 0.5) g.fx.dust(this.cx, this.floorY, 1);
          if ((a.dir > 0 && this.cx > ar.x + W + 30) || (a.dir < 0 && this.cx < ar.x - 30)) { a.step = 3; a.t = 0; }
        } else {
          // repos : la tête descend près du sol, vulnérable
          if (a.t < dt * 1.5) {
            this.x = a.dir > 0 ? ar.x + W - 70 : ar.x + 40;
            this.y = ar.y - 30;
            this.vx = this.vy = 0;
            this.path = Array.from({ length: 130 }, (_, i) => ({ x: this.cx + Math.sin(i * 0.15) * 8, y: this.cy - i * 2 }));
          }
          this.steer(this.cx, this.floorY - 18, 120, dt);
          this.physics(dt);
          this.mouth = Math.floor(a.t * 3) % 2;
          if (a.t > (p2 ? 1.1 : 1.6)) return true;
        }
        return false;
      }
      case 'fireballs': {
        if (a.step === 0) {
          const sx = p.cx < ar.x + W / 2 ? ar.x + W - 50 : ar.x + 50;
          this.steer(sx, ar.y + 45, this.sp(200), dt, 800);
          this.physics(dt);
          if (a.t > 0.9) { a.step = 1; a.t = 0; }
        } else {
          this.vx = approach(this.vx, 0, 400 * dt);
          this.vy = approach(this.vy, 0, 400 * dt);
          this.physics(dt);
          this.mouth = 1;
          this.telegraph = a.t < 0.3;
          const shots = p2 ? 5 : 3;
          if (a.t > 0.35 + a.n * 0.28 && a.n < shots) {
            a.n++;
            const base = Math.atan2(p.cy - this.cy, p.cx - this.cx);
            if (p2) for (const off of [-0.25, 0, 0.25]) this.fire('voidball', base + off, 130);
            else this.fire('fireball', base, 150);
            g.audio.play('enemyShot');
          }
          if (a.t > 0.5 + shots * 0.28) return true;
        }
        return false;
      }
      case 'breath': {
        if (a.step === 0) {
          this.steer(ar.x + W / 2, ar.y + 26, this.sp(200), dt, 800);
          this.physics(dt);
          if (a.t > 1) { a.step = 1; a.t = 0; g.audio.play('roar'); }
        } else {
          this.vx = approach(this.vx, 0, 400 * dt);
          this.vy = approach(this.vy, 0, 400 * dt);
          this.physics(dt);
          this.mouth = 1;
          const dur = 1.7;
          if (Math.floor(a.t / 0.07) > a.n && a.t < dur) {
            a.n = Math.floor(a.t / 0.07);
            const sweep = (a.t / dur);
            const ang = Math.PI * (0.85 - sweep * 0.7);
            this.facing = Math.cos(ang) > 0 ? 1 : -1;
            const pr = this.fire(p2 ? 'voidball' : 'fireball', ang, 170);
            pr.gravity = 40;
          }
          if (a.t > dur + 0.3) return true;
        }
        return false;
      }
      case 'lightning': {
        this.steer(ar.x + W / 2 + Math.sin(a.t * 2) * 60, ar.y + 30, 90, dt);
        this.physics(dt);
        this.mouth = 1;
        this.telegraph = a.t < 0.4;
        if (a.n === 0 && a.t > 0.4) {
          a.n = 1;
          const offs = p2 ? [-96, -48, 0, 48, 96] : [-64, 0, 64];
          for (const o of offs) lv.strikes.push(new Strike(lv, clamp(p.cx + o, ar.x + 24, ar.x + W - 24), 0.85, p2 ? 0xd090ff : 0xffe08a));
          g.audio.play('enemyShot');
        }
        if (p2 && a.n === 1 && a.t > 1.3) {
          a.n = 2;
          lv.strikes.push(new Strike(lv, p.cx, 0.6, 0xd090ff));
          lv.strikes.push(new Strike(lv, p.cx + rand(-30, 30), 0.75, 0xd090ff));
        }
        return a.t > (p2 ? 2.2 : 1.8);
      }
      case 'summon': {
        this.steer(ar.x + W / 2, ar.y + 40, 90, dt);
        this.physics(dt);
        this.mouth = 1;
        this.telegraph = true;
        if (a.t > 0.7 && a.n === 0) { a.n = 1; this.summon(p2 ? 'voidSpirit' : 'impVoid', 2); }
        return a.t > 1.2;
      }
      case 'meteor': {
        this.steer(ar.x + W / 2, ar.y + 20, 100, dt);
        this.physics(dt);
        this.mouth = 1;
        if (a.t > 0.4 && a.t < 2.6 && Math.floor(a.t / 0.17) > a.n) {
          a.n = Math.floor(a.t / 0.17);
          const pr = new Projectile(lv, 'meteor', ar.x + 20 + Math.random() * 280, ar.y - 10, rand(-20, 20), 40, 'enemy', 1);
          pr.gravity = 260;
          pr.parryable = true;
          lv.addProjectile(pr);
        }
        return a.t > 2.9;
      }
    }
    return true;
  }
  update(dt) {
    super.update(dt);
    // le corps suit la trajectoire de la tête
    const head = { x: this.cx, y: this.cy };
    const last = this.path[0];
    if (Math.hypot(head.x - last.x, head.y - last.y) >= 2) {
      this.path.unshift(head);
      if (this.path.length > 130) this.path.pop();
    }
    if (Math.abs(this.vx) > 5) this.facing = sign(this.vx);
    const p = this.player();
    for (let i = 0; i < this.segs.length; i++) {
      const seg = this.segs[i];
      const pt = this.path[Math.min(this.path.length - 1, (i + 1) * 8)];
      seg.x = pt.x;
      seg.y = pt.y + Math.sin(this.animT * 4 + i * 0.6) * 1.5;
      const sh = seg.s.sheet;
      seg.s.setPos(seg.x - sh.fw / 2, seg.y - sh.fh / 2);
      seg.s.setFlip(i === 12 ? this.path[Math.min(this.path.length - 1, i * 8)].x < seg.x : false);
      seg.s.visible = seg.alive;
      seg.s.setFlash(this.flashT > 0 ? 0.6 : 0, 0xffffff);
      if (this.active && !this.dying && seg.alive && p && !p.dead && this.state !== 'PHASE_2') {
        if (overlap({ x: seg.x - 6, y: seg.y - 6, w: 12, h: 12 }, p)) p.hurt(1, seg.x);
      }
    }
    if (!this.dying && Math.random() < 0.3) {
      const s = this.segs[randi(0, 11)];
      this.game.fx.add.spawn(s.x + rand(-6, 6), s.y + rand(-6, 6), rand(-10, 10), rand(-20, 0), 0.6, 1, this.phase === 2 ? 0xc46bff : 0xffe08a);
    }
  }
  deadUpdate(dt) {
    const g = this.game;
    this.vx = approach(this.vx, 0, 200 * dt);
    this.vy = approach(this.vy, 20, 200 * dt);
    this.physics(dt);
    this.mouth = 1;
    // les segments explosent un à un, de la queue vers la tête
    const idx = 12 - Math.floor(this.stateT / 0.17);
    for (let i = 12; i >= Math.max(0, idx); i--) {
      const s = this.segs[i];
      if (s.alive) {
        s.alive = false;
        g.audio.play('explode');
        g.camera.shake(3, 0.2);
        g.fx.burst(s.x, s.y, 18, [PAL.vermilion, PAL.goldLight, PAL.violetLight, PAL.white], 140, 0.8);
      }
    }
    this.sprite.setFlash(0.4 + 0.4 * Math.sin(this.stateT * 30), 0xffffff);
    if (this.stateT > 2.4) this.sprite.setDissolve(clamp((this.stateT - 2.4) / 0.8, 0, 1));
    if (this.stateT > 3.3 && !this.finished) this.finish();
  }
  render() {
    if (this.state !== 'DEAD') {
      this.sprite.setFlip(this.facing < 0);
      this.sprite.setFlash(this.flashT > 0 ? 1 : this.telegraph ? (Math.floor(this.animT * 18) % 2 ? 0.5 : 0) : 0, this.flashT > 0 ? 0xffffff : 0xff3030);
    }
    this.sprite.setFrame(this.state === 'DAMAGED' || this.flashT > 0 ? 2 : this.mouth ? 1 : 0);
    this.sprite.setPos(this.cx - 22 + (this.facing < 0 ? -4 : 4), this.cy - 16);
  }
  dispose() {
    super.dispose();
    for (const s of this.segs) s.s.dispose();
  }
}

function createBoss(level, def, x, gy) {
  if (def.kind === 'general' || def.kind === 'lion') return new GuardianBoss(level, def.kind, x, gy, def.name);
  if (def.kind === 'wind') return new WindLordBoss(level, x, gy, def.name);
  return new DragonKingBoss(level, x, gy, def.name);
}

// =========================================================================
// 11. JEU — états, progression, HUD, menus
// =========================================================================
const INTRO_TEXT = 'Le royaume est plongé dans le chaos après la chute d\'un ancien dragon céleste. Le héros doit traverser les terres sacrées pour récupérer quatre fragments de Qi et empêcher le Roi Dragon Déchu d\'ouvrir la Porte des Esprits.';
const ENDING_TEXT = 'Le Roi Dragon Déchu s\'effondre dans un dernier rugissement. Les quatre fragments de Qi se réunissent et la Porte des Esprits se referme à jamais. Dans le ciel apaisé, le Dragon Céleste renaît, et la paix revient sur les terres sacrées.';
const UPGRADES = [
  { key: 'hp', name: 'VITALITÉ', desc: '+1 cœur de vie maximum' },
  { key: 'dmg', name: 'FORCE', desc: '+1 dégât par coup d\'épée, vague de Qi renforcée' },
  { key: 'qi', name: 'ESPRIT', desc: '+25 d\'énergie spirituelle maximum' },
  { key: 'cd', name: 'FLUX', desc: 'Vague de Qi moins chère et recharge plus rapide' },
  { key: 'dash', name: 'VENT', desc: 'Dash plus long et plus fréquent (rang 3 : il blesse)' },
];
const UPGRADE_MAX = 3;

class Game {
  init(images) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(W, H, false);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x07050a, 1);
    this.renderer.autoClear = false;
    this.canvas = this.renderer.domElement;
    document.body.appendChild(this.canvas);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.scene = new THREE.Scene();
    this.cam3 = new THREE.OrthographicCamera(0, W, 0, -H, -100, 100);
    this.cam3.position.z = 10;
    // Interface : canvas 2D basse résolution affiché par-dessus la scène
    [this.uiCanvas, this.ui] = makeCanvas(W, H);
    this.uiTex = canvasTexture(this.uiCanvas);
    this.uiScene = new THREE.Scene();
    this.uiCam = new THREE.OrthographicCamera(0, W, 0, -H, -10, 10);
    const uiMesh = new THREE.Mesh(planeGeo(W, H), new THREE.MeshBasicMaterial({ map: this.uiTex, transparent: true, depthTest: false, depthWrite: false }));
    this.uiScene.add(uiMesh);
    generateArt(images);
    this.input = new Input();
    this.audio = new AudioManager();
    this.input.onFirstInput = () => this.audio.unlock();
    this.fx = new FX(new ParticleSystem(this.scene, 900, false, 18), new ParticleSystem(this.scene, 700, true, 20));
    this.camera = new Camera();
    this.level = null;
    this.timers = [];
    this.toasts = [];
    this.flashA = 0;
    this.flashC = '#ffffff';
    this.fadeA = 0;
    this.fadeJob = null;
    this.hitstop = 0;
    this.slowmo = 0;
    this.qiFlash = 0;
    this.combo = 0;
    this.comboT = 0;
    this.menuIndex = 0;
    this.sel = 0;
    this.stateT = 0;
    this.best = 0;
    try { this.best = parseInt(localStorage.getItem('dragonsqi.best') || '0', 10) || 0; } catch (e) { this.best = 0; }
    this.resetProgress();
    this.setState('intro');
  }
  resize() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    const scale = s >= 1 ? Math.floor(s) : s;
    this.canvas.style.width = Math.round(W * scale) + 'px';
    this.canvas.style.height = Math.round(H * scale) + 'px';
  }
  resetProgress() {
    this.upg = { hp: 0, dmg: 0, qi: 0, cd: 0, dash: 0 };
    this.score = 0;
    this.coins = 0;
    this.flowers = 0;
    this.relics = 0;
    this.points = 0;
    this.fragments = 0;
    this.levelIndex = 0;
    this.hp = this.maxHp;
    this.qi = this.maxQi;
    this.totalTime = 0;
  }
  // ---- Statistiques dérivées des améliorations ----
  get maxHp() { return 3 + this.upg.hp; }
  get maxQi() { return CONFIG.QI_MAX + 25 * this.upg.qi; }
  get damage() { return 2 + this.upg.dmg; }
  get qiCost() { return CONFIG.QI_COST - 4 * this.upg.cd; }
  get qiCooldown() { return CONFIG.QI_COOLDOWN * (1 - 0.2 * this.upg.cd); }
  get inputLocked() { return this.fadeJob !== null || this.state !== 'play'; }
  gainQi(n) { this.qi = Math.min(this.maxQi, this.qi + n); }
  addScore(n, useCombo = false) {
    const mult = useCombo ? 1 + Math.min(this.combo, 20) * 0.05 : 1;
    this.score += Math.round(n * mult);
  }
  registerHit() {
    this.combo++;
    this.comboT = 2;
  }
  toast(text, color = PAL.ivory) {
    this.toasts.push({ text, color, t: 0 });
    if (this.toasts.length > 3) this.toasts.shift();
  }
  flash(color, a) {
    this.flashC = '#' + hexNum(color).toString(16).padStart(6, '0');
    this.flashA = Math.max(this.flashA, a);
  }
  later(t, fn) { this.timers.push({ t, fn }); }
  fade(dur, fn) {
    if (this.fadeJob) return;
    this.fadeJob = { dur, fn, phase: 'out', t: 0 };
  }
  setState(s) {
    this.state = s;
    this.stateT = 0;
    this.sel = 0;
  }
  // ---- Flux de jeu ----
  showMenu() {
    this.unloadLevel();
    this.level = new Level(this, 2, true);
    this.camera.setBounds(this.level);
    this.camera.lock = null;
    this.camera.x = 0;
    this.camera.y = this.level.ph - H;
    this.audio.playMusic('menu');
    this.setState('menu');
  }
  unloadLevel() {
    if (this.level) this.level.dispose();
    this.level = null;
    this.fx.normal.clear();
    this.fx.add.clear();
  }
  startNewGame() {
    this.resetProgress();
    this.loadLevel(0, true);
  }
  loadLevel(i, fresh) {
    this.unloadLevel();
    this.levelIndex = i;
    if (fresh) {
      this.levelState = { checkpoint: -1, collected: new Set(), scoreStart: this.score, coinsStart: this.coins, relicsStart: this.relics, flowersStart: this.flowers, pointsStart: this.points };
      this.hp = this.maxHp;
      this.qi = this.maxQi;
    }
    this.level = new Level(this, i);
    this.camera.setBounds(this.level);
    this.camera.lock = null;
    this.camera.snap(this.level.player);
    this.combo = 0;
    this.toasts = [];
    this.hitstop = 0;
    this.slowmo = 0;
    this.audio.playMusic(this.level.def.music);
    this.titleCard = { text: this.level.def.name, sub: 'NIVEAU ' + (i + 1) + ' — ' + this.level.def.subtitle, t: 0 };
    this.setState('play');
  }
  restartLevel() {
    const ls = this.levelState;
    this.score = ls.scoreStart;
    this.coins = ls.coinsStart;
    this.relics = ls.relicsStart;
    this.flowers = ls.flowersStart;
    this.points = ls.pointsStart;
    this.loadLevel(this.levelIndex, true);
  }
  respawnCheckpoint() {
    this.hp = this.maxHp;
    this.qi = this.maxQi;
    this.loadLevel(this.levelIndex, false);
  }
  startBoss() {
    const lv = this.level, def = lv.def.boss;
    const sp = lv.bossSpawn || { x: lv.arena.x + 220, y: lv.arena.y + H - 48 };
    lv.boss = createBoss(lv, def, sp.x, sp.y);
    this.audio.stopMusic();
    this.audio.play('roar');
    this.camera.shake(4, 1);
    this.titleCard = { text: def.name, sub: def.title, t: 0, boss: true };
    this.later(2.4, () => {
      if (lv.boss && this.level === lv) {
        lv.boss.active = true;
        this.audio.playMusic('boss');
      }
    });
  }
  onBossDefeated() {
    const lv = this.level;
    lv.bossDefeated = true;
    this.audio.stopMusic();
    this.addScore(5000);
    this.toast('VICTOIRE !  +5000', PAL.goldLight);
    const a = lv.arena;
    this.later(1.2, () => {
      if (this.level !== lv) return;
      lv.spawnPickup('fragment', a.x + W / 2, lv.ph - 3 * TILE - 26);
      this.audio.play('fragment');
      this.toast('UN FRAGMENT DE QI APPARAÎT...', PAL.qi);
    });
  }
  onFragment() {
    this.fragments = Math.max(this.fragments, this.levelIndex + 1);
    const lv = this.level;
    lv.player.invuln = 99;
    this.later(1.6, () => {
      this.audio.playMusic('victory');
      this.clearStats = {
        score: this.score - this.levelState.scoreStart,
        coins: lv.stats.coins,
        kills: lv.stats.kills,
        secrets: lv.stats.secrets,
        secretsTotal: lv.stats.secretsTotal,
        time: lv.stats.time,
      };
      this.totalTime += lv.stats.time;
      if (this.levelIndex >= LEVELS.length - 1) {
        this.saveBest();
        this.setState('victory');
      } else {
        this.points += 2;
        this.setState('levelclear');
      }
    });
  }
  onPlayerDead() { this.setState('gameover'); this.audio.stopMusic(); }
  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try { localStorage.setItem('dragonsqi.best', String(this.best)); } catch (e) { /* stockage indisponible */ }
    }
  }
  openDialog(name, lines) {
    this.dialog = { name, lines, i: 0, chars: 0 };
    this.setState('dialog');
    this.audio.play('select');
  }
  // ---- Mise à jour ----
  update(dt) {
    const inp = this.input;
    this.stateT += dt;
    if (inp.hit('mute')) this.audio.toggleMute();
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }
    if (this.fadeJob) {
      const f = this.fadeJob;
      f.t += dt;
      if (f.phase === 'out') {
        this.fadeA = Math.min(1, f.t / f.dur);
        if (f.t >= f.dur) { f.phase = 'in'; f.t = 0; f.fn(); }
      } else {
        this.fadeA = Math.max(0, 1 - f.t / f.dur);
        if (f.t >= f.dur) { this.fadeJob = null; this.fadeA = 0; }
      }
    }
    this.flashA = Math.max(0, this.flashA - dt * 2.2);
    this.qiFlash -= dt;
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < 2.8);
    if (this.titleCard) {
      this.titleCard.t += dt;
      if (this.titleCard.t > 3) this.titleCard = null;
    }
    switch (this.state) {
      case 'intro':
        if ((inp.any && this.stateT > 0.4) || this.stateT > 16) { this.audio.unlock(); this.showMenu(); }
        break;
      case 'menu': this.updateMenu(dt); break;
      case 'controls':
      case 'credits':
        this.level.update(dt);
        this.camera.x += dt * 14;
        if ((inp.hit('confirm') || inp.hit('back')) && this.stateT > 0.2) { this.audio.play('select'); this.setState('menu'); this.sel = this.menuIndex; }
        break;
      case 'play': this.updatePlay(dt); break;
      case 'dialog': this.updateDialog(dt); break;
      case 'pause': this.updatePause(); break;
      case 'gameover': this.updateGameOver(dt); break;
      case 'levelclear':
        this.level.update(dt);
        if (inp.hit('confirm') && this.stateT > 1) { this.audio.play('confirm'); this.setState('upgrade'); }
        break;
      case 'upgrade': this.updateUpgrade(); break;
      case 'victory':
        if (this.level) this.level.update(dt);
        if (inp.hit('confirm') && this.stateT > 3) { this.audio.play('confirm'); this.fade(0.6, () => this.showMenu()); }
        break;
    }
    inp.endStep();
  }
  menuNav(n) {
    const inp = this.input;
    if (inp.hit('up')) { this.sel = (this.sel + n - 1) % n; this.audio.play('select'); }
    if (inp.hit('down')) { this.sel = (this.sel + 1) % n; this.audio.play('select'); }
    return inp.hit('confirm') && this.stateT > 0.15;
  }
  updateMenu(dt) {
    this.level.update(dt);
    this.camera.x += dt * 14;
    this.camera.y = this.level.ph - H;
    if (this.fadeJob) return;
    if (this.menuNav(3)) {
      this.audio.play('confirm');
      this.menuIndex = this.sel;
      if (this.sel === 0) this.fade(0.6, () => this.startNewGame());
      else this.setState(this.sel === 1 ? 'controls' : 'credits');
    }
  }
  updatePlay(dt) {
    const inp = this.input, lv = this.level, p = lv.player;
    if (inp.hit('pause') && !this.fadeJob) { this.setState('pause'); this.audio.play('select'); return; }
    if (this.fadeJob && this.fadeJob.phase === 'out') return;
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    let sdt = dt;
    if (this.slowmo > 0) { this.slowmo -= dt; sdt = dt * 0.4; }
    this.comboT -= sdt;
    if (this.comboT <= 0) this.combo = 0;
    if (!p.dead) this.qi = Math.min(this.maxQi, this.qi + CONFIG.QI_REGEN * sdt);
    lv.update(sdt);
    this.camera.update(sdt, p);
    // interactions : points de contrôle, panneaux, PNJ
    this.prompt = null;
    if (!p.dead) {
      for (const o of lv.objects) {
        if (o instanceof Checkpoint && overlap(o, p)) o.activate();
        if (o.interact && Math.abs(o.cx - p.cx) < 20 && Math.abs(o.y + o.h - (p.y + p.h)) < 24) {
          this.prompt = o;
          if (inp.hit('interact')) { o.interact(); break; }
        }
      }
    }
  }
  updateDialog(dt) {
    const d = this.dialog, inp = this.input;
    if (this.level) this.level.syncView(this.camera);
    const line = d.lines[d.i];
    const before = Math.floor(d.chars);
    d.chars = Math.min(line.length, d.chars + dt * 55);
    if (Math.floor(d.chars) !== before && Math.floor(d.chars) % 3 === 0) this.audio.play('talk');
    if (inp.hit('confirm') || inp.hit('interact') || inp.hit('attack')) {
      if (d.chars < line.length) d.chars = line.length;
      else if (d.i < d.lines.length - 1) { d.i++; d.chars = 0; this.audio.play('select'); }
      else { this.dialog = null; this.setState('play'); }
    }
  }
  updatePause() {
    const inp = this.input;
    if (inp.hit('pause') && this.stateT > 0.1) { this.setState('play'); return; }
    if (this.menuNav(3)) {
      this.audio.play('confirm');
      if (this.sel === 0) this.setState('play');
      else if (this.sel === 1) this.fade(0.4, () => this.restartLevel());
      else { this.audio.stopMusic(); this.fade(0.5, () => this.showMenu()); }
    }
  }
  updateGameOver(dt) {
    if (this.level) this.level.update(dt * 0.3);
    if (this.stateT < 1.2 || this.fadeJob) return;
    if (this.menuNav(2)) {
      this.audio.play('confirm');
      if (this.sel === 0) this.fade(0.5, () => this.respawnCheckpoint());
      else { this.saveBest(); this.fade(0.5, () => this.showMenu()); }
    }
  }
  updateUpgrade() {
    const inp = this.input;
    if (this.fadeJob) return;
    const n = UPGRADES.length + 1;
    if (this.menuNav(n)) {
      if (this.sel === UPGRADES.length) {
        this.audio.play('confirm');
        this.fade(0.6, () => this.loadLevel(this.levelIndex + 1, true));
        return;
      }
      const u = UPGRADES[this.sel];
      if (this.points > 0 && this.upg[u.key] < UPGRADE_MAX) {
        this.points--;
        this.upg[u.key]++;
        if (u.key === 'hp') this.hp = this.maxHp;
        if (u.key === 'qi') this.qi = this.maxQi;
        this.audio.play('upgrade');
        this.upgFlash = { i: this.sel, t: 0.4 };
      } else this.audio.play('noQi');
    }
    if (this.upgFlash) this.upgFlash.t -= 1 / 60;
    void inp;
  }
  // ---- Rendu ----
  draw() {
    const r = this.renderer;
    r.clear();
    if (this.level) {
      const cam = this.camera;
      this.level.syncView(cam);
      this.cam3.position.set(cam.rx, -cam.ry, 10);
      this.fx.normal.sync();
      this.fx.add.sync();
      r.render(this.scene, this.cam3);
    }
    this.drawUI();
    this.uiTex.needsUpdate = true;
    r.render(this.uiScene, this.uiCam);
  }
  drawUI() {
    const c = this.ui;
    c.clearRect(0, 0, W, H);
    switch (this.state) {
      case 'intro': this.drawIntro(c); break;
      case 'menu': this.drawMenu(c); break;
      case 'controls': this.drawControls(c); break;
      case 'credits': this.drawCredits(c); break;
      case 'play':
      case 'dialog':
        this.drawHUD(c);
        if (this.state === 'dialog') this.drawDialog(c);
        break;
      case 'pause': this.drawHUD(c); this.drawPause(c); break;
      case 'gameover': this.drawGameOver(c); break;
      case 'levelclear': this.drawLevelClear(c); break;
      case 'upgrade': this.drawUpgrade(c); break;
      case 'victory': this.drawVictory(c); break;
    }
    if (this.flashA > 0) {
      c.globalAlpha = Math.min(1, this.flashA);
      c.fillStyle = this.flashC;
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
    }
    if (this.fadeA > 0) {
      c.globalAlpha = this.fadeA;
      c.fillStyle = '#07050a';
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
    }
  }
  panel(c, x, y, w, h, alpha = 0.88) {
    c.globalAlpha = alpha;
    rect(c, x, y, w, h, PAL.ink);
    c.globalAlpha = 1;
    rect(c, x, y, w, 1, PAL.gold);
    rect(c, x, y + h - 1, w, 1, PAL.gold);
    rect(c, x, y, 1, h, PAL.gold);
    rect(c, x + w - 1, y, 1, h, PAL.gold);
    rect(c, x + 2, y + 2, w - 4, 1, PAL.goldDark);
    rect(c, x + 2, y + h - 3, w - 4, 1, PAL.goldDark);
    for (const [cx, cy] of [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]]) rect(c, cx, cy, 3, 3, PAL.vermilion);
  }
  ornamentLine(c, y, w = 220) {
    const x = Math.round(W / 2 - w / 2);
    rect(c, x, y, w, 1, PAL.gold);
    rect(c, x, y + 2, w, 1, PAL.gold);
    rect(c, x - 3, y, 2, 3, PAL.vermilion);
    rect(c, x + w + 1, y, 2, 3, PAL.vermilion);
    rect(c, W / 2 - 2, y - 1, 4, 5, PAL.vermilion);
  }
  heart(c, x, y, full) {
    const shape = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
    for (let r = 0; r < shape.length; r++) {
      for (let k = 0; k < 7; k++) {
        if (shape[r][k] !== 'X') continue;
        let col = full ? PAL.vermilion : PAL.darkRed;
        if (full && r === 1 && k === 1) col = PAL.white;
        rect(c, x + k, y + r, 1, 1, col);
      }
    }
  }
  drawHUD(c) {
    const lv = this.level;
    // vie
    rect(c, 3, 3, this.maxHp * 9 + 4, 9, 'rgba(18,10,16,0.6)');
    for (let i = 0; i < this.maxHp; i++) this.heart(c, 5 + i * 9, 4, i < this.hp);
    // énergie spirituelle
    const bw = 60 + this.upg.qi * 15;
    drawText(c, 'QI', 5, 15, PAL.qi);
    rect(c, 15, 14, bw + 2, 7, this.qiFlash > 0 && Math.floor(this.qiFlash * 20) % 2 ? PAL.vermilion : PAL.black);
    rect(c, 16, 15, bw, 5, '#1d1a30');
    const fw = Math.round((this.qi / this.maxQi) * bw);
    rect(c, 16, 15, fw, 5, PAL.qiDark);
    rect(c, 16, 15, fw, 2, PAL.qi);
    for (let x = 16 + 4; x < 16 + bw; x += 5) rect(c, x, 15, 1, 5, 'rgba(13,16,40,0.7)');
    const costX = 16 + Math.round((this.qiCost / this.maxQi) * bw);
    rect(c, costX, 13, 1, 9, this.qi >= this.qiCost ? PAL.white : PAL.vermilion);
    // fragments de Qi
    for (let i = 0; i < 4; i++) {
      const x = W / 2 - 22 + i * 12, y = 4;
      const got = i < this.fragments;
      poly(c, [[x + 4, y], [x + 8, y + 5], [x + 4, y + 10], [x, y + 5]], got ? PAL.qi : PAL.ink);
      if (got) rect(c, x + 3, y + 3, 2, 3, PAL.white);
      else poly(c, [[x + 4, y + 2], [x + 6, y + 5], [x + 4, y + 8], [x + 2, y + 5]], '#2a2440');
    }
    // score, pièces, niveau
    drawText(c, String(this.score).padStart(7, '0'), W - 5, 5, PAL.goldLight, 1, 'right');
    ellipse(c, W - 34, 15, 2, 2, PAL.jade);
    rect(c, W - 34, 14, 1, 1, PAL.jadeLight);
    drawText(c, 'X' + this.coins, W - 5, 13, PAL.jadeLight, 1, 'right');
    drawText(c, 'NIV. ' + (this.levelIndex + 1) + '/4', W - 5, 21, PAL.ivoryDark, 1, 'right');
    if (this.points > 0) drawText(c, 'POINTS ' + this.points, W - 5, 29, PAL.gold, 1, 'right');
    // combo
    if (this.combo >= 3) {
      const s = this.comboT > 1.8 ? 2 : 1;
      drawText(c, 'COMBO X' + this.combo, W - 5, 38, this.combo >= 10 ? PAL.gold : PAL.vermilion, s, 'right');
    }
    // barre de vie du boss
    const b = lv && lv.boss;
    if (b && b.active && !b.finished) {
      const bx = 60, by = H - 13, bwid = W - 120;
      this.panel(c, bx - 4, by - 10, bwid + 8, 20, 0.75);
      drawText(c, b.name, W / 2, by - 7, b.phase === 2 ? PAL.violetLight : PAL.goldLight, 1, 'center');
      rect(c, bx, by, bwid, 4, PAL.black);
      rect(c, bx, by, Math.round((b.displayHp / b.maxHp) * bwid), 4, PAL.ivory);
      rect(c, bx, by, Math.round((b.hp / b.maxHp) * bwid), 4, b.phase === 2 ? PAL.violet : PAL.vermilion);
      rect(c, bx + bwid / 2, by - 1, 1, 6, PAL.gold);
    }
    // invite d'interaction
    if (this.prompt && this.state === 'play') {
      const o = this.prompt;
      const sx = Math.round(o.cx - this.camera.rx), sy = Math.round(o.y - this.camera.ry - 10);
      const txt = '[E] ' + o.prompt;
      const tw = textWidth(txt);
      rect(c, sx - tw / 2 - 2, sy - 2, tw + 4, 9, 'rgba(18,10,16,0.8)');
      drawText(c, txt, sx, sy, PAL.goldLight, 1, 'center', null);
    }
    // messages
    this.toasts.forEach((t, i) => {
      if (t.t > 2.3 && Math.floor(t.t * 12) % 2) return;
      drawText(c, t.text, W / 2, 48 + i * 9, t.color, 1, 'center');
    });
    // carte de titre (niveau / boss)
    const tc = this.titleCard;
    if (tc) {
      const a = tc.t < 0.4 ? tc.t / 0.4 : tc.t > 2.4 ? Math.max(0, (3 - tc.t) / 0.6) : 1;
      c.globalAlpha = a;
      c.globalAlpha = a * 0.6;
      rect(c, 0, 64, W, 40, PAL.black);
      c.globalAlpha = a;
      this.ornamentLine(c, 68, 200);
      drawText(c, tc.text, W / 2, 75, tc.boss ? PAL.vermilion : PAL.goldLight, 2, 'center');
      drawText(c, tc.sub, W / 2, 90, PAL.ivory, 1, 'center');
      this.ornamentLine(c, 99, 200);
      c.globalAlpha = 1;
    }
  }
  drawDialog(c) {
    const d = this.dialog;
    const x = 10, y = H - 52, w = W - 20, h = 46;
    this.panel(c, x, y, w, h, 0.92);
    rect(c, x + 6, y - 5, textWidth(d.name) + 8, 9, PAL.darkRed);
    rect(c, x + 6, y - 5, textWidth(d.name) + 8, 1, PAL.gold);
    drawText(c, d.name, x + 10, y - 3, PAL.goldLight, 1, 'left', null);
    const text = d.lines[d.i].slice(0, Math.floor(d.chars));
    wrapText(text, 74).slice(0, 5).forEach((l, i) => drawText(c, l, x + 7, y + 7 + i * 7, PAL.ivory));
    if (d.chars >= d.lines[d.i].length && Math.floor(this.stateT * 3) % 2) drawText(c, d.i < d.lines.length - 1 ? 'J >' : 'J X', x + w - 8, y + h - 9, PAL.gold, 1, 'right');
  }
  drawIntro(c) {
    rect(c, 0, 0, W, H, '#07050a');
    const t = this.stateT;
    for (let i = 0; i < 40; i++) {
      const x = (i * 53 + t * (8 + (i % 5) * 3)) % W, y = H - ((i * 37 + t * (12 + (i % 7) * 4)) % H);
      rect(c, x, y, 1, 1, i % 3 ? PAL.vermilion : PAL.gold);
    }
    this.ornamentLine(c, 40, 240);
    const shown = Math.floor(Math.max(0, t - 0.5) * 32);
    const lines = wrapText(INTRO_TEXT, 62);
    let count = 0;
    lines.forEach((l, i) => {
      const vis = l.slice(0, Math.max(0, shown - count));
      count += l.length;
      drawText(c, vis, W / 2 - textWidth(l) / 2, 60 + i * 11, PAL.ivory);
    });
    this.ornamentLine(c, 60 + lines.length * 11 + 6, 240);
    if (t > 2 && Math.floor(t * 2) % 2) drawText(c, 'APPUYEZ SUR UNE TOUCHE', W / 2, H - 22, PAL.gold, 1, 'center');
  }
  drawTitle(c, y) {
    const t = this.stateT;
    drawText(c, "DRAGON'S QI", W / 2 + 1, y + 2, PAL.darkRed, 4, 'center', null);
    drawText(c, "DRAGON'S QI", W / 2, y, PAL.gold, 4, 'center', PAL.black);
    const sx = W / 2 - textWidth("DRAGON'S QI", 4) / 2 + ((t * 60) % 200);
    if (sx < W / 2 + 86) rect(c, sx, y, 2, 20, 'rgba(255,240,200,0.6)');
    drawText(c, 'LA LÉGENDE DU GUERRIER IMMORTEL', W / 2, y + 26, PAL.ivory, 1, 'center');
  }
  drawMenu(c) {
    c.globalAlpha = 0.35;
    rect(c, 0, 0, W, H, PAL.black);
    c.globalAlpha = 1;
    this.ornamentLine(c, 18, 250);
    this.drawTitle(c, 28);
    const opts = ['JOUER', 'COMMANDES', 'CRÉDITS'];
    opts.forEach((o, i) => {
      const y = 92 + i * 18, on = this.sel === i;
      const label = '[ ' + o + ' ]';
      if (on) {
        const w = textWidth(label, 1) + 18;
        c.globalAlpha = 0.7;
        rect(c, W / 2 - w / 2, y - 4, w, 13, PAL.darkRed);
        c.globalAlpha = 1;
        ellipse(c, W / 2 - w / 2 - 6, y + 2, 3, 4, PAL.vermilion);
        rect(c, W / 2 - w / 2 - 9, y + 1, 7, 1, PAL.gold);
        ellipse(c, W / 2 + w / 2 + 6, y + 2, 3, 4, PAL.vermilion);
        rect(c, W / 2 + w / 2 + 3, y + 1, 7, 1, PAL.gold);
      }
      drawText(c, label, W / 2, y, on ? PAL.goldLight : PAL.ivoryDark, 1, 'center');
    });
    this.ornamentLine(c, 150, 250);
    drawText(c, '↑↓ CHOISIR   ENTRÉE / J VALIDER   M SON', W / 2, 158, PAL.ivoryDark, 1, 'center');
    if (this.best > 0) drawText(c, 'MEILLEUR SCORE ' + this.best, W / 2, 168, PAL.gold, 1, 'center');
  }
  drawControls(c) {
    c.globalAlpha = 0.75;
    rect(c, 0, 0, W, H, PAL.black);
    c.globalAlpha = 1;
    this.panel(c, 30, 14, W - 60, H - 28);
    drawText(c, 'COMMANDES', W / 2, 22, PAL.gold, 2, 'center');
    const rows = [
      ['← →  /  A D (Q D)', 'SE DÉPLACER'],
      ['ESPACE', 'SAUTER  (X2 : DOUBLE SAUT)'],
      ['ESPACE CONTRE UN MUR', 'REBOND MURAL (LIANES)'],
      ['↓ + ESPACE', 'DESCENDRE D\'UN PONT'],
      ['J', 'ATTAQUE (COMBO 3 COUPS)'],
      ['K', 'VAGUE DE QI (COÛTE DU QI)'],
      ['SHIFT', 'DASH INVINCIBLE'],
      ['E / ↑', 'LIRE / PARLER'],
      ['ÉCHAP / P', 'PAUSE'],
      ['M', 'COUPER LE SON'],
    ];
    rows.forEach(([k, v], i) => {
      drawText(c, k, 44, 44 + i * 10, PAL.goldLight);
      drawText(c, v, 150, 44 + i * 10, PAL.ivory);
    });
    drawText(c, 'ENTRÉE : RETOUR', W / 2, H - 24, PAL.ivoryDark, 1, 'center');
  }
  drawCredits(c) {
    c.globalAlpha = 0.75;
    rect(c, 0, 0, W, H, PAL.black);
    c.globalAlpha = 1;
    this.panel(c, 30, 14, W - 60, H - 28);
    drawText(c, 'CRÉDITS', W / 2, 22, PAL.gold, 2, 'center');
    const rows = [
      ["DRAGON'S QI", PAL.goldLight],
      ['UN PLATFORMER WUXIA ORIGINAL', PAL.ivory],
      ['', PAL.ivory],
      ['RENDU : THREE.JS (WEBGL), 320 X 180', PAL.ivory],
      ['HÉROS : « FREE SAMURAI 2D PIXEL ART V1.2 »', PAL.ivory],
      ['DÉCORS, ENNEMIS ET BOSS : PIXEL ART PROCÉDURAL', PAL.ivory],
      ['SONS ET MUSIQUE : SYNTHÈSE WEB AUDIO', PAL.ivory],
      ['', PAL.ivory],
      ['INSPIRÉ DES LÉGENDES DE LA CHINE ANCIENNE', PAL.qi],
      ['MERCI D\'AVOIR JOUÉ !', PAL.vermilion],
    ];
    rows.forEach(([t, col], i) => drawText(c, t, W / 2, 44 + i * 10, col, 1, 'center'));
    drawText(c, 'ENTRÉE : RETOUR', W / 2, H - 24, PAL.ivoryDark, 1, 'center');
  }
  drawPause(c) {
    c.globalAlpha = 0.6;
    rect(c, 0, 0, W, H, PAL.black);
    c.globalAlpha = 1;
    this.panel(c, W / 2 - 70, 40, 140, 96);
    drawText(c, 'PAUSE', W / 2, 50, PAL.gold, 3, 'center');
    ['CONTINUER', 'RECOMMENCER', 'MENU PRINCIPAL'].forEach((o, i) => {
      const on = this.sel === i;
      drawText(c, (on ? '> ' : '  ') + o + (on ? ' <' : '  '), W / 2, 82 + i * 14, on ? PAL.goldLight : PAL.ivoryDark, 1, 'center');
    });
  }
  drawGameOver(c) {
    const t = this.stateT;
    c.globalAlpha = Math.min(0.8, t * 0.6);
    rect(c, 0, 0, W, H, PAL.black);
    c.globalAlpha = Math.min(1, t * 1.2);
    drawText(c, 'YOU DIED', W / 2 + 2, 52, PAL.black, 5, 'center', null);
    drawText(c, 'YOU DIED', W / 2, 50, PAL.vermilion, 5, 'center', PAL.darkRed);
    drawText(c, 'VOTRE QI S\'EST DISSIPÉ...', W / 2, 82, PAL.ivoryDark, 1, 'center');
    c.globalAlpha = 1;
    if (t > 1.2) {
      ['RECOMMENCER (DERNIER POINT DE CONTRÔLE)', 'MENU PRINCIPAL'].forEach((o, i) => {
        const on = this.sel === i;
        drawText(c, (on ? '> ' : '  ') + o + (on ? ' <' : '  '), W / 2, 112 + i * 14, on ? PAL.goldLight : PAL.ivoryDark, 1, 'center');
      });
      drawText(c, 'SCORE ' + this.score, W / 2, 152, PAL.gold, 1, 'center');
    }
  }
  fmtTime(s) {
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + String(r).padStart(2, '0');
  }
  drawLevelClear(c) {
    const s = this.clearStats;
    c.globalAlpha = 0.7;
    rect(c, 0, 0, W, H, PAL.black);
    c.globalAlpha = 1;
    this.panel(c, 40, 16, W - 80, H - 32);
    drawText(c, 'FRAGMENT DE QI RÉCUPÉRÉ', W / 2, 26, PAL.qi, 1, 'center');
    drawText(c, LEVELS[this.levelIndex].name, W / 2, 38, PAL.gold, 2, 'center');
    const rows = [
      ['SCORE DU NIVEAU', String(s.score)],
      ['PIÈCES DE JADE', String(s.coins)],
      ['ENNEMIS VAINCUS', String(s.kills)],
      ['SECRETS', s.secrets + ' / ' + s.secretsTotal],
      ['TEMPS', this.fmtTime(s.time)],
    ];
    rows.forEach(([k, v], i) => {
      if (this.stateT < 0.3 + i * 0.15) return;
      drawText(c, k, 64, 62 + i * 11, PAL.ivory);
      drawText(c, v, W - 64, 62 + i * 11, PAL.goldLight, 1, 'right');
    });
    if (this.stateT > 1.2) drawText(c, '+2 POINTS D\'ESPRIT  (TOTAL ' + this.points + ')', W / 2, 122, PAL.qi, 1, 'center');
    if (this.stateT > 1.5 && Math.floor(this.stateT * 2) % 2) drawText(c, 'ENTRÉE : AUTEL DU QI', W / 2, 140, PAL.gold, 1, 'center');
  }
  drawUpgrade(c) {
    rect(c, 0, 0, W, H, '#0d0a14');
    for (let i = 0; i < 30; i++) {
      const x = (i * 47 + this.stateT * 6) % W, y = H - ((i * 31 + this.stateT * 14) % H);
      rect(c, x, y, 1, 1, i % 2 ? PAL.gold : PAL.qiDark);
    }
    this.panel(c, 16, 8, W - 32, H - 16);
    drawText(c, 'AUTEL DU QI', W / 2, 16, PAL.gold, 2, 'center');
    drawText(c, 'POINTS D\'ESPRIT DISPONIBLES : ' + this.points, W / 2, 31, this.points ? PAL.qi : PAL.ivoryDark, 1, 'center');
    UPGRADES.forEach((u, i) => {
      const y = 44 + i * 19, on = this.sel === i;
      if (on) rect(c, 24, y - 3, W - 48, 18, '#2a1428');
      if (this.upgFlash && this.upgFlash.i === i && this.upgFlash.t > 0) rect(c, 24, y - 3, W - 48, 18, '#4a3a20');
      drawText(c, (on ? '> ' : '  ') + u.name, 28, y, on ? PAL.goldLight : PAL.ivory);
      for (let k = 0; k < UPGRADE_MAX; k++) {
        const got = k < this.upg[u.key];
        poly(c, [[W - 70 + k * 12 + 4, y - 1], [W - 70 + k * 12 + 8, y + 3], [W - 70 + k * 12 + 4, y + 7], [W - 70 + k * 12, y + 3]], got ? PAL.qi : '#3a3050');
      }
      drawText(c, u.desc, 40, y + 7, PAL.ivoryDark);
    });
    const on = this.sel === UPGRADES.length;
    drawText(c, (on ? '> ' : '  ') + 'CONTINUER VERS : ' + LEVELS[this.levelIndex + 1].name + (on ? ' <' : ''), W / 2, H - 22, on ? PAL.goldLight : PAL.ivory, 1, 'center');
  }
  drawVictory(c) {
    const t = this.stateT;
    c.globalAlpha = Math.min(0.85, t * 0.4);
    rect(c, 0, 0, W, H, '#07050a');
    c.globalAlpha = 1;
    this.ornamentLine(c, 14, 250);
    drawText(c, 'VICTOIRE', W / 2, 22, PAL.gold, 3, 'center');
    const lines = wrapText(ENDING_TEXT, 66);
    const shown = Math.floor(t * 40);
    let count = 0;
    lines.forEach((l, i) => {
      drawText(c, l.slice(0, Math.max(0, shown - count)), W / 2 - textWidth(l) / 2, 46 + i * 9, PAL.ivory);
      count += l.length;
    });
    if (t > 3) {
      drawText(c, 'SCORE FINAL ' + this.score, W / 2, 100, PAL.goldLight, 2, 'center');
      drawText(c, 'PIÈCES ' + this.coins + '   FLEURS ' + this.flowers + '   RELIQUES ' + this.relics + '   TEMPS ' + this.fmtTime(this.totalTime), W / 2, 118, PAL.ivory, 1, 'center');
      drawText(c, 'MERCI D\'AVOIR JOUÉ !', W / 2, 134, PAL.vermilion, 1, 'center');
      if (Math.floor(t * 2) % 2) drawText(c, 'ENTRÉE : MENU PRINCIPAL', W / 2, 152, PAL.gold, 1, 'center');
    }
    this.ornamentLine(c, 164, 250);
  }
}

// =========================================================================
// 12. DÉMARRAGE ET BOUCLE PRINCIPALE (pas de temps fixe)
// =========================================================================
let game = null;
let lastTime = 0;
let accumulator = 0;

function gameLoop(now) {
  requestAnimationFrame(gameLoop);
  const t = now / 1000;
  let dt = lastTime ? t - lastTime : 0;
  lastTime = t;
  if (dt > 0.25) dt = 0.25;
  accumulator += dt;
  let steps = 0;
  while (accumulator >= CONFIG.FIXED_DT && steps < 5) {
    game.update(CONFIG.FIXED_DT);
    accumulator -= CONFIG.FIXED_DT;
    steps++;
  }
  if (steps >= 5) accumulator = 0;
  game.draw();
}

async function loadThree() {
  let lastErr = null;
  for (const url of CONFIG.THREE_URLS) {
    try {
      return await import(url);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
function loadHeroImages() {
  const src = window.SAMURAI_SPRITES || {};
  const names = ['IDLE', 'RUN', 'ATTACK', 'HURT'];
  return Promise.all(names.map((n) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve([n, img]);
    img.onerror = () => resolve([n, null]);
    img.src = src[n] || 'assets/samurai/' + n + '.png';
  }))).then((list) => Object.fromEntries(list));
}
async function boot() {
  const bootEl = document.getElementById('boot');
  try {
    THREE = await loadThree();
  } catch (e) {
    if (bootEl) bootEl.innerHTML = "DRAGON'S QI<br><br>Impossible de charger Three.js.<br>Une connexion internet est nécessaire au premier lancement.";
    console.error(e);
    return;
  }
  THREE.ColorManagement.enabled = false;
  const images = await loadHeroImages();
  game = new Game();
  game.init(images);
  window.__game = game;
  if (bootEl) bootEl.remove();
  requestAnimationFrame(gameLoop);
}
window.addEventListener('load', boot);
