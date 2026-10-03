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
  W: 480,
  H: 270,
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
// les cartes sont dessinées sur 15 rangées ; on ajoute du ciel au-dessus pour remplir l'écran
const MAP_PAD = 3, ROWS = 15 + MAP_PAD;
// hauteur de référence des écrans de menu (centrés verticalement)
const DH = 180, OY = Math.round((H - DH) / 2);

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
      qiwave: ['KeyI'],
      timestop: ['KeyL'],
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
      case 'dagger': this.noise(0.05, 0.08, 7000, 'highpass'); this.tone(1400, 0.04, 'square', 0.025, 900); break;
      case 'iai':
        this.noise(0.25, 0.3, 9000, 'highpass');
        this.tone(2400, 0.25, 'sawtooth', 0.05, 300);
        this.tone(70, 0.4, 'sine', 0.3, 40, 0.3);
        break;
      case 'charged': this.tone(880, 0.3, 'triangle', 0.08, 1760); this.tone(1320, 0.4, 'sine', 0.05, 0, 0.05); break;
      case 'graze': this.tone(2200, 0.03, 'square', 0.03); break;
      case 'tick': this.tone(1500, 0.02, 'square', 0.04); this.tone(750, 0.03, 'triangle', 0.04, 0, 0.02); break;
      case 'timeStop':
        this.tone(900, 0.9, 'sawtooth', 0.09, 50);
        this.tone(1800, 0.5, 'sine', 0.06, 200);
        this.noise(0.8, 0.18, 6000, 'bandpass', 300, 0, 2);
        break;
      case 'timeResume': this.tone(60, 0.5, 'sawtooth', 0.08, 900); this.noise(0.4, 0.12, 300, 'bandpass', 5000, 0, 2); break;
      case 'spell':
        [392, 494, 587, 784].forEach((f, i) => this.tone(f, 1.0, 'triangle', 0.07, 0, i * 0.04));
        this.noise(0.6, 0.15, 3000, 'highpass');
        break;
      case 'bullet': this.tone(700, 0.04, 'sine', 0.025, 400); break;
      case 'bonus': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.3, 'square', 0.05, 0, i * 0.06)); break;
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
    this.wob = 0; this.wobF = 0; this.wobP = 0;
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
      if (p.wob) p.x += Math.sin((p.max - p.life) * p.wobF + p.wobP) * p.wob * dt;
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

// Décor animé par le vent : chaque rangée de pixels est décalée d'un nombre
// entier de pixels (ondulation nette, sans flou). mode 0 : ancré en bas
// (arbres, bambous) ; mode 1 : suspendu par le haut (lanternes, bannières).
const SWAY_FS = `
uniform sampler2D map;
uniform vec2 texSize;
uniform float time;
uniform float amp;
uniform float speed;
uniform float phase;
uniform float mode;
uniform float opacity;
uniform float gust;
varying vec2 vUv;
void main() {
  float row = floor(vUv.y * texSize.y);
  float h = mode < 0.5 ? vUv.y : 1.0 - vUv.y;
  float w = h * h;
  float s = sin(time * speed + phase + row * 0.05) * 0.65 + sin(time * speed * 2.3 + phase * 1.7 + row * 0.11) * 0.25;
  s += gust * sin(time * 0.7 + phase) * 0.6;
  float off = floor(s * amp * w + 0.5);
  float col = floor(vUv.x * texSize.x) - off;
  if (col < 0.0 || col >= texSize.x) discard;
  vec4 c = texture2D(map, vec2((col + 0.5) / texSize.x, (row + 0.5) / texSize.y));
  if (c.a < 0.5) discard;
  gl_FragColor = vec4(c.rgb, c.a * opacity);
}`;
const SWAY_VS = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

class SwayDecor {
  constructor(parent, canvas, x, y, opts = {}) {
    const pad = Math.ceil(opts.amp || 2) + 1;
    // marge transparente pour que l'ondulation ne soit pas rognée
    const [c, ctx] = makeCanvas(canvas.width + pad * 2, canvas.height);
    ctx.drawImage(canvas, pad, 0);
    this.tex = canvasTexture(c);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: this.tex },
        texSize: { value: new THREE.Vector2(c.width, c.height) },
        time: { value: 0 },
        amp: { value: opts.amp || 2 },
        speed: { value: opts.speed || 1.6 },
        phase: { value: opts.phase != null ? opts.phase : Math.random() * 6 },
        mode: { value: opts.hang ? 1 : 0 },
        opacity: { value: 1 },
        gust: { value: 0 },
      },
      vertexShader: SWAY_VS,
      fragmentShader: SWAY_FS,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(planeGeo(c.width, c.height), this.mat);
    this.mesh.position.set(Math.round(x - pad), -Math.round(y), 0);
    this.mesh.renderOrder = opts.order || 9;
    this.parent = parent;
    this.x = x;
    this.y = y;
    this.w = canvas.width;
    this.h = canvas.height;
    parent.add(this.mesh);
  }
  // décalage horizontal (en pixels) du bas de l'objet suspendu, pour y caler un halo
  swing(t) {
    const u = this.mat.uniforms;
    const s = Math.sin(t * u.speed.value + u.phase.value + (this.h - 1) * 0.05) * 0.65 + Math.sin(t * u.speed.value * 2.3 + u.phase.value * 1.7) * 0.25;
    return Math.round(s * u.amp.value);
  }
  update(t, gust = 0) {
    this.mat.uniforms.time.value = t;
    this.mat.uniforms.gust.value = gust;
  }
  dispose() {
    this.parent.remove(this.mesh);
    this.mat.dispose();
    this.tex.dispose();
  }
}

// ---- Post-traitement plein écran (rendu 320×180 → écran) ----
const POST_FS = `
uniform sampler2D tScene;
uniform vec2 res;
uniform float time;
uniform vec4 ripples[6];
uniform float aberr;
uniform vec3 tint;
uniform float vignette;
uniform float bloom;
uniform float thr;
uniform float grain;
uniform float desat;
uniform float cold;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 tex(vec2 p) { return texture2D(tScene, (floor(p) + 0.5) / res).rgb; }
void main() {
  vec2 px = vUv * res;
  vec2 off = vec2(0.0);
  for (int i = 0; i < 6; i++) {
    vec4 r = ripples[i];
    if (r.w <= 0.0) continue;
    vec2 d = px - r.xy;
    float dist = length(d);
    float band = exp(-pow((dist - r.z) / 5.0, 2.0));
    off += d / (dist + 0.001) * band * r.w * 5.0;
  }
  vec2 p = px - off;
  vec3 c;
  if (aberr > 0.01) {
    c.r = tex(p + vec2(aberr, 0.0)).r;
    c.g = tex(p).g;
    c.b = tex(p - vec2(aberr, 0.0)).b;
  } else c = tex(p);
  vec3 b = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7853982;
    vec2 dir = vec2(cos(a), sin(a));
    b += max(tex(p + dir * 2.0) - thr, 0.0);
    b += max(tex(p + dir * 4.5) - thr, 0.0) * 0.6;
  }
  c += b * bloom / 6.0;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, vec3(l), desat);
  c = mix(c, vec3(l) * vec3(0.78, 0.9, 1.18) + vec3(0.02, 0.03, 0.06), cold);
  c *= tint;
  vec2 q = vUv - 0.5;
  c *= 1.0 - smoothstep(0.32, 0.82, length(q * vec2(1.0, 0.82))) * vignette;
  c += (hash(floor(px) + floor(time * 12.0)) - 0.5) * grain;
  gl_FragColor = vec4(c, 1.0);
}`;
class PostFX {
  constructor() {
    this.rt = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false });
    this.rt.texture.colorSpace = THREE.NoColorSpace;
    this.ripples = [];
    this.rippleU = Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, 0, 0));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.rt.texture },
        res: { value: new THREE.Vector2(W, H) },
        time: { value: 0 },
        ripples: { value: this.rippleU },
        aberr: { value: 0 },
        tint: { value: new THREE.Vector3(1, 1, 1) },
        vignette: { value: 0.35 },
        bloom: { value: 0.3 },
        thr: { value: 0.85 },
        grain: { value: 0.03 },
        desat: { value: 0 },
        cold: { value: 0 },
      },
      vertexShader: SWAY_VS,
      fragmentShader: POST_FS,
      depthTest: false,
      depthWrite: false,
    });
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.Mesh(planeGeo(W, H), this.mat));
    this.cam = new THREE.OrthographicCamera(0, W, 0, -H, -10, 10);
    this.aberr = 0;
    this.desat = 0;
    this.cold = 0;
  }
  setTheme(th) {
    const p = th ? th.post : { tint: [1, 1, 1], bloom: 0.3, thr: 0.85, vignette: 0.45, grain: 0.03 };
    const u = this.mat.uniforms;
    u.tint.value.set(p.tint[0], p.tint[1], p.tint[2]);
    u.bloom.value = p.bloom;
    u.thr.value = p.thr;
    u.vignette.value = p.vignette;
    u.grain.value = p.grain;
  }
  // onde de choc : position monde, force, vitesse d'expansion (px/s)
  ripple(x, y, strength = 1, speed = 220) {
    if (this.ripples.length >= 6) this.ripples.shift();
    this.ripples.push({ x, y, r: 0, s: strength, speed, life: 0.6 });
  }
  update(dt) {
    for (const r of this.ripples) {
      r.r += r.speed * dt;
      r.life -= dt;
    }
    this.ripples = this.ripples.filter((r) => r.life > 0);
    this.aberr = Math.max(0, this.aberr - dt * 4);
    this.desat = Math.max(0, this.desat - dt * 0.8);
  }
  render(renderer, scene, cam, camX, camY, time) {
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    const u = this.mat.uniforms;
    u.time.value = time;
    u.aberr.value = this.aberr;
    u.desat.value = this.desat;
    u.cold.value = this.cold;
    for (let i = 0; i < 6; i++) {
      const r = this.ripples[i];
      if (r) this.rippleU[i].set(r.x - camX, H - (r.y - camY), r.r, r.s * Math.max(0, r.life / 0.6));
      else this.rippleU[i].set(0, 0, 0, 0);
    }
    renderer.render(this.scene, this.cam);
  }
}

// ---- Traînée de lame (ruban géométrique, pixelisé par le rendu 480×270) ----
const TRAIL_VS = `
attribute vec2 tuv;
varying vec2 vT;
void main() { vT = tuv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const TRAIL_FS = `
uniform float head;
uniform float tail;
uniform float alpha;
uniform float mode;
uniform vec3 cA;
uniform vec3 cB;
uniform vec3 cC;
varying vec2 vT;
void main() {
  float d = head - vT.x;
  if (d < 0.0 || d > tail) discard;
  float k = 1.0 - d / tail;
  float thick = 0.12 + 0.88 * k;
  float e = mode > 0.5 ? 1.0 - abs(vT.y * 2.0 - 1.0) : vT.y;
  if (e < 1.0 - thick) discard;
  float edge = (e - (1.0 - thick)) / max(thick, 0.001);
  vec3 c = edge > 0.78 ? cC : (edge > 0.42 ? cB : cA);
  float a = floor((0.3 + 0.7 * k) * 4.0 + 0.5) / 4.0;
  gl_FragColor = vec4(c, a * alpha);
}`;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
class SlashTrail {
  // o : { arc: [r0, r1, a0, a1] | line: [len, width], flip, dur, fade, tail, colors: [intérieur, milieu, bord], follow() → [x, y] }
  constructor(parent, o) {
    const N = 36;
    const pos = new Float32Array((N + 1) * 2 * 3), tuv = new Float32Array((N + 1) * 2 * 2), idx = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      let ix, iy, ox, oy;
      if (o.arc) {
        const [r0, r1, a0, a1] = o.arc;
        const a = a0 + (a1 - a0) * u;
        let dx = Math.cos(a), dy = Math.sin(a);
        if (o.flip) dx = -dx;
        ix = dx * r0; iy = dy * r0; ox = dx * r1; oy = dy * r1;
      } else {
        const [len, wd] = o.line;
        const x = len * u * (o.flip ? -1 : 1), slope = o.slope || 0;
        ix = x; iy = -wd / 2 + x * slope; ox = x; oy = wd / 2 + x * slope;
      }
      pos.set([ix, -iy, 0, ox, -oy, 0], i * 6);
      tuv.set([u, 0, u, 1], i * 4);
      if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('tuv', new THREE.BufferAttribute(tuv, 2));
    g.setIndex(idx);
    const cols = (o.colors || ['#7fe3ff', '#d8f6ff', '#ffffff']).map((c) => new THREE.Color(hexNum(c)));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { head: { value: 0 }, tail: { value: o.tail || 0.7 }, alpha: { value: 1 }, mode: { value: o.line ? 1 : 0 }, cA: { value: cols[0] }, cB: { value: cols[1] }, cC: { value: cols[2] } },
      vertexShader: TRAIL_VS,
      fragmentShader: TRAIL_FS,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.renderOrder = o.order || 15;
    this.mesh.frustumCulled = false;
    this.geo = g;
    this.o = o;
    this.t = 0;
    this.dur = o.dur || 0.12;
    this.fade = o.fade || 0.16;
    this.parent = parent;
    parent.add(this.mesh);
    this.step(0);
  }
  get total() { return this.dur + this.fade; }
  step(dt) {
    this.t += dt;
    const p = clamp(this.t / this.dur, 0, 1);
    const u = this.mat.uniforms;
    u.head.value = easeOut(p) * (1 + u.tail.value);
    u.alpha.value = this.t <= this.dur ? 1 : Math.max(0, 1 - (this.t - this.dur) / this.fade);
    if (this.t > this.dur) u.head.value = 1 + u.tail.value * (0.4 + 0.6 * ((this.t - this.dur) / this.fade));
    const [x, y] = this.o.follow ? this.o.follow() : [this.o.x, this.o.y];
    this.mesh.position.set(Math.round(x), -Math.round(y), 0);
  }
  dispose() {
    this.parent.remove(this.mesh);
    this.mat.dispose();
    this.geo.dispose();
  }
}

// Géométrie centrée (effets qui tournent : étoiles d'impact, entailles)
const CGEO_CACHE = new Map();
function centerGeo(w, h) {
  const k = w + 'x' + h;
  if (!CGEO_CACHE.has(k)) CGEO_CACHE.set(k, new THREE.PlaneGeometry(w, h));
  return CGEO_CACHE.get(k);
}
// Étoile d'impact 40×40 (5 frames) et entaille 72×9 (4 frames)
function drawHitStar(ctx, f) {
  const c = 20, R = [9, 15, 18, 19, 19][f];
  if (f < 3) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2, L = k % 2 ? R : R * 0.55;
      line(ctx, c, c, c + Math.cos(a) * L, c + Math.sin(a) * L, '#ffffff', f === 0 ? 2 : 1);
    }
    disc(ctx, c, c, [5, 3, 1][f], '#ffffff');
  }
  for (let a = 0; a < Math.PI * 2; a += 0.12) {
    if (f >= 1 && (f < 3 || a % 0.36 < 0.12)) rect(ctx, c + Math.cos(a) * R, c + Math.sin(a) * R, 1, 1, '#ffffff');
  }
}
function drawCutLine(ctx, f) {
  const half = [12, 34, 35, 35][f], th = [1, 3, 2, 1][f];
  rect(ctx, 36 - half, 4 - Math.floor(th / 2), half * 2, th, '#ffffff');
  if (f === 1) { rect(ctx, 36 - half - 2, 4, 2, 1, '#ffffff'); rect(ctx, 36 + half, 4, 2, 1, '#ffffff'); }
}
// Effet ponctuel centré, orientable
function spawnFx(level, sheet, x, y, opts = {}) {
  const s = new Sprite(level.group, sheet, opts.order || 17, !!opts.additive);
  s.mesh.geometry = centerGeo(sheet.fw, sheet.fh);
  s.mesh.position.set(Math.round(x), -Math.round(y), 0);
  s.mesh.rotation.z = opts.rot || 0;
  if (opts.scale) s.mesh.scale.set(opts.scale, opts.scale, 1);
  if (opts.tint) s.setTint(opts.tint);
  const dur = opts.dur || 0.2;
  const e = { sprite: s, life: (opts.delay || 0) + dur, t: 0 };
  s.visible = !opts.delay;
  e.update = (ee) => {
    const t = ee.t - (opts.delay || 0);
    s.visible = t >= 0;
    if (t >= 0) s.setFrame(Math.min(sheet.count - 1, Math.floor((t / dur) * sheet.count)));
  };
  level.effects.push(e);
  return e;
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




// ---- Finition « style du héros » : éclairage haut-gauche + contour coloré ----
// Les pixels exposés en haut à gauche s'éclaircissent, ceux du bas à droite
// s'assombrissent ; le contour prend la teinte (assombrie) de la matière voisine.
function stylizeCanvas(ctx, w, h, outlineK = 0.42) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data, out = new Uint8ClampedArray(d);
  const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] >= 128;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] >= 128) {
        out[i + 3] = 255;
        let k = 1;
        if (!op(x - 1, y - 1) || !op(x, y - 1)) k = 1.22;
        else if (!op(x + 1, y + 1) || !op(x, y + 1)) k = 0.74;
        else if (!op(x + 1, y)) k = 0.85;
        out[i] = Math.min(255, d[i] * k + (k > 1 ? 10 : 0));
        out[i + 1] = Math.min(255, d[i + 1] * k + (k > 1 ? 10 : 0));
        out[i + 2] = Math.min(255, d[i + 2] * k + (k > 1 ? 12 : 0));
        continue;
      }
      out[i + 3] = 0;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (op(x + dx, y + dy)) {
          const j = ((y + dy) * w + x + dx) * 4;
          r += d[j]; g += d[j + 1]; b += d[j + 2]; n++;
        }
      }
      if (n) {
        out[i] = (r / n) * outlineK;
        out[i + 1] = (g / n) * outlineK;
        out[i + 2] = (b / n) * outlineK + 8;
        out[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(new ImageData(out, w, h), 0, 0);
}
function buildStyledSheet(fw, fh, count, drawFrame, k) {
  const sheet = buildSheet(fw, fh, count, drawFrame, null);
  const ctx = sheet.canvas.getContext('2d');
  stylizeCanvas(ctx, sheet.canvas.width, sheet.canvas.height, k);
  sheet.tex.needsUpdate = true;
  return sheet;
}

// ---- Squelette articulé pour les guerriers (cuisses, tibias, bras, tête, arme) ----
// Angles en radians : 0 = vers le bas, positif = vers l'avant (le personnage regarde à droite).
const limbEnd = (x, y, a, l) => [x + Math.sin(a) * l, y + Math.cos(a) * l];
function limb(ctx, x0, y0, x1, y1, w, mid, dark, light) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  const r = w / 2;
  for (let i = 0; i <= n; i++) ellipse(ctx, Math.round(lerp(x0, x1, i / n) + 0.5), Math.round(lerp(y0, y1, i / n) + 0.5), Math.max(0, Math.round(r - 0.3)), Math.max(0, Math.round(r - 0.3)), dark);
  for (let i = 0; i <= n; i++) ellipse(ctx, Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n)), Math.max(0, Math.round(r - 0.8)), Math.max(0, Math.round(r - 0.8)), mid);
  if (light && w >= 3) line(ctx, x0 - r * 0.5, y0 - 0.5, x1 - r * 0.5, y1 - 0.5, light);
}
function ramp3(c) { return [shade(c, 0.28), c, shade(c, -0.38)]; }

// Poses : chaque entrée décrit une image (voir WARRIOR_FRAMES)
function warriorPose(f) {
  const P = { bob: 0, lean: 0, thF: 0.1, shF: 0, thB: -0.1, shB: 0, arF: 0.5, faF: 1.2, arB: -0.2, faB: 0.3, wpn: 1.2, head: 0, skirt: 0, smear: 0, cast: 0, hurt: 0 };
  if (f < 4) { // repos (respiration)
    P.bob = f === 1 || f === 2 ? 1 : 0;
    P.arF = 0.45; P.faF = 1.0 + (f % 2) * 0.05;
  } else if (f < 12) { // marche (8 images)
    const ph = ((f - 4) / 8) * Math.PI * 2;
    P.thF = Math.sin(ph) * 0.55;
    P.shF = P.thF - Math.max(0, Math.cos(ph)) * 0.75;
    P.thB = -Math.sin(ph) * 0.55;
    P.shB = P.thB - Math.max(0, -Math.cos(ph)) * 0.75;
    P.bob = Math.abs(Math.sin(ph)) > 0.7 ? 0 : 1;
    P.arF = 0.35 - Math.sin(ph) * 0.35; P.faF = 1.0;
    P.arB = Math.sin(ph) * 0.4; P.faB = 0.4;
    P.skirt = Math.sin(ph) * 1.5;
    P.lean = 0.06;
  } else if (f < 15) { // armé : l'arme monte derrière la tête
    const k = (f - 12 + 1) / 3;
    P.lean = -0.12 * k; P.thF = 0.25; P.shF = 0.1; P.thB = -0.3; P.shB = -0.2;
    P.arF = lerp(0.5, Math.PI - 0.5, k); P.faF = lerp(1.2, Math.PI + 0.3, k); P.wpn = lerp(1.2, 0.4, k);
    P.arB = -0.4 * k; P.faB = 0.2;
  } else if (f < 18) { // frappe en trois temps, avec traînée
    const k = f - 15;
    P.lean = [0.25, 0.32, 0.18][k]; P.thF = 0.6; P.shF = 0.25; P.thB = -0.55; P.shB = -0.45; P.bob = 1;
    P.arF = [2.3, 1.5, 0.9][k]; P.faF = [2.0, 1.3, 0.6][k]; P.wpn = [0.3, 0.1, 0.0][k];
    P.arB = -0.7; P.faB = -0.2;
    P.smear = [1, 2, 0][k];
  } else if (f < 20) { // touché
    P.hurt = 1; P.lean = -0.3 - (f - 18) * 0.1; P.thF = -0.2; P.thB = 0.25; P.shB = 0.5;
    P.arF = -0.6; P.faF = -1.0; P.arB = -1.2; P.faB = -1.6; P.head = -1;
  } else { // sort (incantation)
    const k = f - 20;
    P.arF = 1.45; P.faF = 1.55; P.arB = 0.9 + k * 0.1; P.faB = 1.3; P.cast = k + 1; P.lean = 0.05; P.thF = 0.2; P.thB = -0.2;
  }
  return P;
}
const WARRIOR_FRAMES = 23; // 0-3 repos, 4-11 marche, 12-14 armé, 15-17 frappe, 18-19 touché, 20-22 sort

function drawRigWarrior(ctx, f, p, style, S = 1, FW = 64, FH = 48) {
  const P = warriorPose(f);
  const ground = FH - 3;
  const cx = Math.round(FW * 0.4);
  const hipY = ground - 17 * S + P.bob;
  const hipX = cx + P.lean * 4 * S;
  const neckX = hipX + Math.sin(P.lean) * 13 * S, neckY = hipY - Math.cos(P.lean) * 13 * S;
  const sk = ramp3(p.skin), ar = ramp3(p.armor), cl = ramp3(p.cloth), pa = ramp3(p.pants), mt = ramp3(p.metal);
  // jambe arrière
  let [kx, ky] = limbEnd(hipX - 1, hipY, P.thB, 8.5 * S);
  let [fx, fy] = limbEnd(kx, ky, P.shB, 8.5 * S);
  limb(ctx, hipX - 1, hipY, kx, ky, 4 * S, pa[2], shade(p.pants, -0.6), null);
  limb(ctx, kx, ky, fx, fy, 3.4 * S, pa[2], shade(p.pants, -0.6), null);
  rect(ctx, fx - 1.5 * S, fy - 1, 5 * S, 2.5 * S, shade(p.boot, -0.2));
  // bras arrière
  const shBX = neckX - 2 * S, shBY = neckY + 2 * S;
  let [ex, ey] = limbEnd(shBX, shBY, P.arB, 6.5 * S);
  let [hx, hy] = limbEnd(ex, ey, P.faB, 6 * S);
  limb(ctx, shBX, shBY, ex, ey, 3.5 * S, ar[2], shade(p.armor, -0.6), null);
  limb(ctx, ex, ey, hx, hy, 3 * S, sk[2], shade(p.skin, -0.6), null);
  // cape
  if (style.cape) {
    const sw = P.skirt + (f >= 4 && f < 12 ? 1 : 0);
    poly(ctx, [[neckX - 3 * S, neckY + 1], [neckX + 1 * S, neckY + 1], [hipX - 4 * S - sw, ground - 3], [hipX - 12 * S - sw * 2, ground - 2]], cl[2]);
    line(ctx, neckX - 2 * S, neckY + 3, hipX - 9 * S - sw * 2, ground - 3, shade(p.cloth, -0.55));
  }
  // jupe / longue tunique (plis)
  const skirtL = style.robe ? 15 * S : 10 * S;
  const sx = P.skirt;
  poly(ctx, [[hipX - 5 * S, hipY - 3 * S], [hipX + 5 * S, hipY - 3 * S], [hipX + 7 * S + sx, hipY + skirtL], [hipX - 7 * S + sx * 0.5, hipY + skirtL]], cl[1]);
  for (let i = -1; i <= 1; i++) line(ctx, hipX + i * 3 * S, hipY, hipX + i * 4 * S + sx, hipY + skirtL - 1, cl[2]);
  rect(ctx, hipX - 7 * S + sx * 0.5, hipY + skirtL - 1, 14 * S, 1, shade(p.cloth, -0.5));
  rect(ctx, hipX - 4 * S, hipY - 2 * S, 2, skirtL, cl[0]);
  // jambe avant
  [kx, ky] = limbEnd(hipX + 1, hipY, P.thF, 8.5 * S);
  [fx, fy] = limbEnd(kx, ky, P.shF, 8.5 * S);
  if (!style.robe || f >= 4) {
    limb(ctx, hipX + 1, hipY + 2, kx, ky, 4 * S, pa[1], shade(p.pants, -0.45), pa[0]);
    limb(ctx, kx, ky, fx, fy, 3.4 * S, pa[1], shade(p.pants, -0.45), pa[0]);
  }
  rect(ctx, fx - 1.5 * S, fy - 1.5, 5.5 * S, 3 * S, p.boot);
  rect(ctx, fx - 1.5 * S, fy - 1.5, 5.5 * S, 1, shade(p.boot, 0.3));
  // torse : cuirasse lamellaire ou robe
  const tw = 5 * S;
  const tpts = [[neckX - tw, neckY], [neckX + tw, neckY], [hipX + tw - 0.5, hipY - 2], [hipX - tw + 0.5, hipY - 2]];
  poly(ctx, tpts, ar[1]);
  poly(ctx, [[neckX - tw, neckY], [neckX - tw + 3, neckY], [hipX - tw + 3, hipY - 2], [hipX - tw + 0.5, hipY - 2]], ar[0]);
  poly(ctx, [[neckX + tw - 2, neckY], [neckX + tw, neckY], [hipX + tw - 0.5, hipY - 2], [hipX + tw - 2.5, hipY - 2]], ar[2]);
  if (!style.robe) {
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      const yy = lerp(neckY, hipY - 2, t), xx = lerp(neckX, hipX, t);
      line(ctx, xx - tw + 1, yy, xx + tw - 1, yy, ar[2]);
      for (let q = -tw + 2; q < tw - 1; q += 2) rect(ctx, xx + q, yy + 1, 1, 1, ar[0]);
    }
    ellipse(ctx, neckX - tw + 1, neckY + 2, 3 * S, 2.5 * S, ar[1]);
    rect(ctx, neckX - tw - 1, neckY + 3, 4 * S, 1, p.trim);
  } else {
    line(ctx, neckX - 2, neckY + 1, hipX + 3, hipY - 3, ar[2]);
    line(ctx, neckX - 1, neckY + 1, hipX + 4, hipY - 3, shade(p.trim, 0.1));
  }
  // ceinture
  rect(ctx, hipX - tw, hipY - 3, tw * 2, 2.5 * S, p.trim);
  rect(ctx, hipX - 1, hipY - 3, 3 * S, 2.5 * S, PAL.gold);
  rect(ctx, hipX, hipY - 3, 1, 1, PAL.goldLight);
  // tête
  const hdx = neckX + 1 + P.head, hdy = neckY - 5 * S;
  ellipse(ctx, hdx, hdy, 3.5 * S, 4 * S, sk[1]);
  rect(ctx, hdx - 3 * S, hdy - 1, 2, 4 * S, sk[2]);
  rect(ctx, hdx + 3 * S - 1, hdy, 1, 3, sk[0]);
  if (P.hurt) {
    rect(ctx, hdx + 1, hdy - 1, 3, 1, PAL.black);
  } else {
    rect(ctx, hdx + 1, hdy - 1, 3, 1, shade(p.skin, -0.6));
    rect(ctx, hdx + 2, hdy, 2, 1, p.eye);
    rect(ctx, hdx + 3, hdy, 1, 1, shade(p.eye, 0.5));
  }
  rect(ctx, hdx + 1, hdy + 2 * S, 2, 1, shade(p.skin, -0.45));
  const hr = 4 * S;
  switch (style.hat) {
    case 'helmet':
      ellipse(ctx, hdx, hdy - 2, hr, 3 * S, ar[1]);
      rect(ctx, hdx - hr, hdy - 2, hr * 2, 2, ar[2]);
      rect(ctx, hdx - hr, hdy - 1, hr * 2, 1, p.trim);
      rect(ctx, hdx - hr - 1, hdy - 1, 3, 6 * S, ar[1]);
      rect(ctx, hdx - 1, hdy - 3 * S - 4, 2, 4, p.trim);
      rect(ctx, hdx - 2, hdy - 3 * S - 5, 4, 2, shade(p.trim, 0.3));
      break;
    case 'topknot':
      ellipse(ctx, hdx - 1, hdy - 2, hr, 2.5 * S, '#2a2232');
      rect(ctx, hdx - hr - 1, hdy - 2, 3, 6 * S, '#2a2232');
      ellipse(ctx, hdx - 1, hdy - 3 * S - 3, 2, 1.5, '#2a2232');
      for (let k = 0; k < 3; k++) line(ctx, hdx - hr, hdy + k, hdx - hr - 4 - k * 2, hdy + 3 + k * 3, shade(p.skin, 0.25));
      break;
    case 'bald':
      rect(ctx, hdx - 1, hdy - 4 * S, 3, 1, sk[0]);
      for (let i = 0; i < 6; i++) disc(ctx, neckX - 4 + i * 1.8, neckY + 2 + Math.sin(i) * 1.5, 1, i % 2 ? PAL.gold : PAL.goldDark);
      break;
    case 'stone':
      rect(ctx, hdx - hr, hdy - 4 * S, hr * 2, 3, ar[2]);
      rect(ctx, hdx - hr - 1, hdy - 2, hr * 2 + 2, 1, ar[1]);
      line(ctx, neckX - 2, neckY + 2, hipX, hipY - 4, p.trim);
      line(ctx, hipX + 2, hipY + 2, fx, fy - 4, p.trim);
      break;
    case 'horned':
      ellipse(ctx, hdx, hdy - 2, hr, 2.5 * S, ar[1]);
      line(ctx, hdx - 2, hdy - 4, hdx - 5, hdy - 9 * S, mt[0]);
      line(ctx, hdx + 2, hdy - 4, hdx + 5, hdy - 9 * S, mt[0]);
      break;
    case 'crown':
      ellipse(ctx, hdx, hdy - 2, hr, 3 * S, ar[1]);
      poly(ctx, [[hdx - hr - 4, hdy - 6], [hdx - hr + 1, hdy - 3], [hdx - hr, hdy - 1]], ar[0]);
      poly(ctx, [[hdx + hr + 4, hdy - 6], [hdx + hr - 1, hdy - 3], [hdx + hr, hdy - 1]], ar[0]);
      rect(ctx, hdx - 1, hdy - 3, 2, 2, p.trim);
      break;
    case 'hood':
      ellipse(ctx, hdx - 1, hdy - 1, hr + 1, hr + 1, cl[1]);
      ellipse(ctx, hdx + 1, hdy + 1, hr - 1, hr - 1, sk[1]);
      rect(ctx, hdx + 1, hdy, 3, 1, p.eye);
      rect(ctx, hdx - hr - 1, hdy - 2, 2, 9, cl[2]);
      break;
  }
  // bras avant + arme
  const shFX = neckX + 2 * S, shFY = neckY + 2 * S;
  [ex, ey] = limbEnd(shFX, shFY, P.arF, 6.5 * S);
  [hx, hy] = limbEnd(ex, ey, P.faF, 6 * S);
  const wa = P.faF + P.wpn;
  const drawWeapon = () => {
    if (style.weapon === 'dao') {
      const [bx, by] = limbEnd(hx, hy, wa, 16 * S);
      rect(ctx, hx - 1, hy - 1, 3, 3, p.hilt);
      const [gx, gy] = limbEnd(hx, hy, wa, 2);
      line(ctx, gx - 2, gy, gx + 2, gy, PAL.gold);
      line(ctx, gx, gy, bx, by, mt[1], 2);
      line(ctx, gx, gy, bx, by, mt[0]);
      const [mx, my] = limbEnd(hx, hy, wa, 11 * S);
      line(ctx, mx, my, bx, by, p.metalLight, 1);
    } else if (style.weapon === 'halberd') {
      const [bx, by] = limbEnd(hx, hy, wa, 18 * S);
      const [tx, ty] = limbEnd(hx, hy, wa + Math.PI, 10 * S);
      line(ctx, tx, ty, bx, by, PAL.woodDark, 2);
      line(ctx, tx, ty, bx, by, PAL.wood);
      const [nx, ny] = limbEnd(bx, by, wa + 1.4, 4 * S);
      poly(ctx, [[bx, by], [nx, ny], ...[limbEnd(bx, by, wa, 6 * S)]], mt[1]);
      line(ctx, bx, by, ...limbEnd(bx, by, wa, 6 * S), p.metalLight);
      rect(ctx, bx - 1, by - 1, 3, 3, p.trim);
    } else if (style.weapon === 'fist') {
      disc(ctx, hx, hy, 2.5 * S, ar[1]);
    }
  };
  if (style.weapon !== 'halberd' || P.arF > 1) drawWeapon();
  limb(ctx, shFX, shFY, ex, ey, 4 * S, ar[1], shade(p.armor, -0.5), ar[0]);
  limb(ctx, ex, ey, hx, hy, 3.4 * S, sk[1], shade(p.skin, -0.5), sk[0]);
  disc(ctx, hx, hy, 1.6 * S, sk[1]);
  if (style.weapon === 'halberd' && P.arF <= 1) drawWeapon();
  // traînée de la frappe (comme les frames d'attaque du samouraï)
  if (P.smear) {
    const R = 17 * S, ccx = shFX, ccy = shFY + 2;
    const a0 = P.smear === 1 ? -2.3 : -1.4, a1 = P.smear === 1 ? -0.2 : 0.9;
    for (let a = a0; a <= a1; a += 0.04) {
      const t = (a - a0) / (a1 - a0);
      const th = 1 + Math.round(Math.sin(t * Math.PI) * 2.2);
      rect(ctx, ccx + Math.cos(a) * R, ccy + Math.sin(a) * R, th, th, t > 0.3 ? p.metalLight : shade(p.metal, 0.4));
    }
  }
  if (P.cast) {
    const ox = hx + 3, oy = hy;
    disc(ctx, ox, oy, 1 + P.cast, p.magic);
    disc(ctx, ox, oy, P.cast - 0.5, shade(p.magic, 0.6));
    for (let k = 0; k < P.cast * 2; k++) rect(ctx, ox + Math.cos(k * 1.7) * (3 + P.cast), oy + Math.sin(k * 1.7) * (3 + P.cast), 1, 1, shade(p.magic, 0.7));
  }
}

// ---- Petit démon détaillé 32×28 : 0-3 sautillement, 4 bond, 5 touché ----
function drawImpHD(ctx, f, p) {
  const bob = f < 4 ? [0, -1, -2, -1][f] : f === 4 ? -3 : 0;
  const sq = f < 4 ? [1, 0, 0, 0][f] : 0;
  const cx = 15 + (f === 4 ? 2 : 0) - (f === 5 ? 2 : 0), cy = 17 + bob + sq;
  const B = ramp3(p.body);
  // queue en fouet
  for (let i = 0; i < 9; i++) {
    const a = 2.6 + Math.sin(i * 0.5 + f) * 0.3;
    rect(ctx, cx - 6 - i * 0.9, cy + 2 - i * 0.9 + Math.sin(i * 0.8 + f) * 1.2, 2, 2, B[2]);
    void a;
  }
  poly(ctx, [[cx - 15, cy - 9], [cx - 12, cy - 6], [cx - 15, cy - 5]], p.dark);
  // ailes membraneuses
  const wy = f % 2 ? -1 : 1;
  poly(ctx, [[cx - 3, cy - 4], [cx - 11, cy - 11 + wy], [cx - 9, cy - 4 + wy], [cx - 12, cy - 2]], shade(p.dark, 0.1));
  line(ctx, cx - 3, cy - 4, cx - 11, cy - 11 + wy, p.dark);
  // pattes arrière
  const lg = f < 4 ? [0, 1, 0, -1][f] : 0;
  limb(ctx, cx - 3, cy + 4, cx - 4 + lg, cy + 9 - bob - sq, 3, B[2], shade(p.body, -0.6), null);
  // corps (ventre rond)
  ellipse(ctx, cx, cy, 7, 6 - sq, B[1]);
  ellipse(ctx, cx - 1, cy - 1, 6, 5 - sq, B[1]);
  ellipse(ctx, cx + 1, cy + 2, 4, 3, p.belly);
  ellipse(ctx, cx + 1, cy + 3, 3, 1, shade(p.belly, -0.2));
  // patte avant
  limb(ctx, cx + 3, cy + 4, cx + 4 - lg, cy + 9 - bob - sq, 3, B[1], shade(p.body, -0.5), B[0]);
  rect(ctx, cx + 3 - lg, cy + 9 - bob - sq, 4, 2, p.dark);
  // tête
  const hx = cx + 3, hy = cy - 6;
  ellipse(ctx, hx, hy, 5, 4, B[1]);
  rect(ctx, hx - 4, hy - 3, 6, 1, B[0]);
  // cornes recourbées
  poly(ctx, [[hx - 4, hy - 3], [hx - 7, hy - 9], [hx - 2, hy - 4]], p.horn);
  poly(ctx, [[hx + 2, hy - 3], [hx + 5, hy - 9], [hx + 4, hy - 3]], p.horn);
  rect(ctx, hx - 7, hy - 9, 1, 1, shade(p.horn, -0.3));
  // visage
  if (f === 5) {
    line(ctx, hx, hy - 1, hx + 2, hy + 1, PAL.white);
    line(ctx, hx + 2, hy - 1, hx, hy + 1, PAL.white);
  } else {
    rect(ctx, hx, hy - 1, 3, 2, p.eye);
    rect(ctx, hx + 2, hy - 1, 1, 1, PAL.white);
    rect(ctx, hx + 4, hy - 1, 1, 2, p.eye);
  }
  rect(ctx, hx + 1, hy + 2, 4, 1, shade(p.dark, -0.4));
  rect(ctx, hx + 2, hy + 3, 1, 1, PAL.white);
  rect(ctx, hx + 4, hy + 3, 1, 1, PAL.white);
  // griffes (bond)
  if (f === 4) {
    limb(ctx, cx + 5, cy, cx + 11, cy - 2, 2.5, B[1], shade(p.body, -0.5), null);
    for (let k = 0; k < 3; k++) rect(ctx, cx + 11 + k, cy - 4 + k * 2, 1, 1, PAL.ivory);
  }
}

// ---- Esprits détaillés 28×28 ----
function drawSpiritHD(ctx, f, kind, p) {
  const t = f % 4, atk = f === 4, hurt = f === 5;
  if (kind === 'bat') {
    const up = [1, 0.3, -0.6, 0.3][t];
    const wy = atk ? -8 : up * 8;
    const B = ramp3(p.body);
    for (const s of [-1, 1]) {
      const bx = 14 + s * 3;
      poly(ctx, [[bx, 13], [14 + s * 13, 13 - wy], [14 + s * 11, 17 - wy * 0.3], [14 + s * 7, 16], [14 + s * 5, 18]], p.dark);
      line(ctx, bx, 13, 14 + s * 13, 13 - wy, p.light);
      line(ctx, 14 + s * 9, 13 - wy * 0.6, 14 + s * 8, 17 - wy * 0.2, shade(p.dark, 0.3));
    }
    ellipse(ctx, 14, 15, 4, 5, B[1]);
    ellipse(ctx, 15, 16, 2, 3, B[0]);
    ellipse(ctx, 15, 9, 3, 3, B[1]);
    poly(ctx, [[17, 9], [21, 10], [17, 11]], PAL.gold);
    rect(ctx, 15, 8, 2, 1, hurt ? PAL.white : p.eye);
    poly(ctx, [[13, 6], [12, 2], [15, 6]], B[2]);
    rect(ctx, 12, 20, 1, 3, p.dark);
    rect(ctx, 16, 20, 1, 3, p.dark);
    return;
  }
  if (kind === 'wind') {
    const R = atk ? 10 : 9;
    for (let k = 0; k < 3; k++) {
      for (let a = 0; a < Math.PI * 1.6; a += 0.08) {
        const r = R - k * 3 - a * 0.6;
        if (r < 1) continue;
        rect(ctx, 14 + Math.cos(a + t * 0.9 + k * 2) * r, 14 + Math.sin(a + t * 0.9 + k * 2) * r, 2, 2, k === 0 ? p.dark : k === 1 ? p.body : p.light);
      }
    }
    ellipse(ctx, 14, 14, 5, 4, PAL.ivory);
    rect(ctx, 10, 12, 8, 1, shade(PAL.ivory, -0.2));
    rect(ctx, 11, 13, 2, 2, hurt ? PAL.vermilion : p.eye);
    rect(ctx, 15, 13, 2, 2, hurt ? PAL.vermilion : p.eye);
    rect(ctx, 13, 16, 2, 1, PAL.vermilion);
    return;
  }
  // flamme spectrale (feu follet, flamme fantôme, néant)
  const sway = [0, 1, 0, -1][t];
  const C = [p.dark, p.body, p.light, '#ffffff'];
  for (let k = 0; k < 4; k++) {
    const s = 1 - k * 0.24;
    poly(ctx, [[14 - 7 * s, 16], [14 + sway * (1 + k * 0.5) - 1, 2 + k * 3 + (t % 2)], [14 + 7 * s, 16]], C[k]);
    ellipse(ctx, 14, 17, Math.round(7 * s), Math.round(7 * s), C[k]);
  }
  for (let k = 0; k < 3; k++) rect(ctx, 9 + k * 4 + sway, 23 + (k % 2), 2, 2 + ((t + k) % 2), p.body);
  if (kind === 'void') {
    ellipse(ctx, 14, 16, 3, 2, PAL.white);
    rect(ctx, 14, 16, 1, 1, atk ? PAL.vermilion : p.eye);
  } else {
    rect(ctx, 11, 15, 2, 3, hurt ? PAL.white : p.eye);
    rect(ctx, 15, 15, 2, 3, hurt ? PAL.white : p.eye);
    rect(ctx, 11, 15, 1, 1, shade(p.light, 0.5));
    rect(ctx, 15, 15, 1, 1, shade(p.light, 0.5));
    if (atk) ellipse(ctx, 14, 20, 2, 1, p.eye);
  }
}

// ---- Le Général Corrompu, au même squelette (×1.35) ----
const GENERAL_POSE_MAP = [0, 2, 5, 9, 14, 16, 13, 18]; // repos, repos, marche, marche, armé, frappe, saut, touché
function drawGeneralHD(ctx, f, p) {
  const pf = GENERAL_POSE_MAP[f];
  drawRigWarrior(ctx, pf, {
    skin: p.mask, eye: p.eye, armor: p.armor, trim: p.trim, cloth: p.cape, pants: p.pants, boot: p.boot,
    metal: p.metal, metalLight: '#ffffff', hilt: p.gold, magic: p.trim,
  }, { hat: 'helmet', weapon: 'halberd', cape: true }, 1.35, 80, 64);
  // cornes de bélier par-dessus le casque
  const P = warriorPose(pf);
  const S = 1.35, ground = 61, cx = 32;
  const hipY = ground - 17 * S + P.bob, hipX = cx + P.lean * 4 * S;
  const nX = hipX + Math.sin(P.lean) * 13 * S, nY = hipY - Math.cos(P.lean) * 13 * S;
  const hx = nX + 1 + P.head, hy = nY - 5 * S;
  // cornes de bélier enroulées
  for (const s of [-1, 1]) {
    for (let t = 0; t < 1; t += 0.06) {
      const ang = -1.9 + t * 4.6, r = 4.5 - t * 2.5;
      const px = hx + s * (4 + Math.cos(ang) * r * 0.9), py = hy - 4 + Math.sin(ang) * r;
      rect(ctx, px, py, 2, 2, t < 0.5 ? p.horn : shade(p.horn, -0.25));
    }
  }
  // épaulières en tête de tigre
  ellipse(ctx, nX - 6, nY + 3, 4, 3, p.gold);
  rect(ctx, nX - 7, nY + 3, 2, 1, PAL.black);
}

// ---- BOSS 1 : le Général Corrompu 48×48 ----
// 0-1 repos, 2-3 marche, 4 armé, 5 frappe, 6 saut/écrasement, 7 touché

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
const BULLET_COLORS = { red: '#e0412b', blue: '#4a8aff', violet: '#b46bff', gold: '#f2b53a', jade: '#3ecf8e', cyan: '#7fe3ff', white: '#eef4ff' };
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
  for (const k in IMP_PALETTES) ART.imps[k] = buildStyledSheet(32, 28, 6, (c, f) => drawImpHD(c, f, IMP_PALETTES[k]));
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
  for (const k in wstyles) ART.warriors[k] = buildStyledSheet(64, 48, WARRIOR_FRAMES, (c, f) => drawRigWarrior(c, f, STYLE_PALETTES[k], wstyles[k]));
  ART.spirits = {};
  for (const k in SPIRIT_PALETTES) {
    const kind = k === 'ghostflame' ? 'wisp' : k;
    ART.spirits[k] = buildStyledSheet(28, 28, 6, (c, f) => drawSpiritHD(c, f, kind, SPIRIT_PALETTES[k]));
  }
  ART.general = buildStyledSheet(80, 64, 8, (c, f) => drawGeneralHD(c, f, {
    cape: '#9c1d22', capeDark: '#5a0f17', armor: '#3a3446', armorDark: '#24202e', trim: '#e0412b',
    gold: '#f2b53a', pants: '#2a2633', pantsDark: '#1c1a24', boot: '#1a1210', mask: '#c8322a',
    maskDark: '#7a1a18', eye: '#ffde4a', horn: '#efe6cf', metal: '#d8dce8',
  }));
  ART.jadeLion = buildStyledSheet(56, 44, 8, (c, f) => drawJadeLion(c, f, {
    body: '#3ecf8e', dark: '#1f7a55', light: '#9cf5c8', gold: '#f2b53a', eye: '#e0412b', glow: '#ffe08a',
  }));
  ART.windLord = buildStyledSheet(40, 44, 7, (c, f) => drawWindLord(c, f, {
    robe: '#bfe8ff', robeLight: '#ffffff', trim: '#3a5a9c', gold: '#f2b53a', mask: '#efe6cf',
    eye: '#e0412b', hat: '#1b2346', fan: '#e0412b', fanDark: '#5a0f17',
  }));
  const dragonPal = {
    scale: '#9c1d22', scaleLight: '#e0412b', scaleDark: '#5a0f17', belly: '#f2b53a', mane: '#f2b53a',
    maneDark: '#a8641c', horn: '#ffe08a', eye: '#c46bff', whisker: '#ffe08a', fire: '#ffe08a',
  };
  ART.dragonHead = buildStyledSheet(44, 32, 3, (c, f) => drawDragonHead(c, f, dragonPal));
  ART.dragonSeg = buildStyledSheet(20, 20, 4, (c, f) => drawDragonSegment(c, f, dragonPal));
  ART.dragonTail = buildStyledSheet(20, 14, 1, (c, f) => drawDragonTail(c, f, dragonPal));
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
  ART.lantern = buildLanternSheet();
  ART.hitStar = buildSheet(40, 40, 5, (c, f) => drawHitStar(c, f), null);
  ART.cutLine = buildSheet(72, 9, 4, (c, f) => drawCutLine(c, f), null);
  ART.dagger = buildSheet(16, 7, 1, (ctx) => {
    rect(ctx, 1, 3, 3, 1, PAL.gold);
    rect(ctx, 4, 2, 1, 3, PAL.goldLight);
    rect(ctx, 5, 2, 9, 3, '#d8e4f0');
    rect(ctx, 5, 2, 9, 1, PAL.white);
    rect(ctx, 5, 4, 8, 1, PAL.qi);
    rect(ctx, 14, 3, 1, 1, PAL.white);
  });
  ART.bullets = {};
  for (const [k, col] of Object.entries(BULLET_COLORS)) {
    ART.bullets[k] = buildSheet(12, 12, 2, (ctx, f) => {
      disc(ctx, 6, 6, 4, col);
      disc(ctx, 6, 6, f ? 3 : 2, shade(col, 0.55));
      disc(ctx, 6, 6, 1, PAL.white);
      if (f) rect(ctx, 4, 4, 1, 1, PAL.white);
    }, '#140c18');
  }
}

// ---- Thèmes des décors : lavis à l'encre (shan shui) décliné par niveau ----
const THEMES = {
  forest: {
    paper: ['#f1f1e6', '#e4ebe0', '#d4e1d8', '#c4d6cf'],
    sun: { x: 236, y: 46, r: 13, c: '#fbf6e2', halo: '#e9eedf' },
    far: { ink: '#9fb2b0', mist: '#d9e3dc' },
    mid: { ink: '#2f3a3b', mid: '#6e8486', mist: '#cbd8d2', stroke: '#171d1e' },
    near: { ink: '#51685f', mist: '#bccdc5', dark: '#3a4d47' },
    cloud: { fill: '#faf6ea', shade: '#e3decf', line: '#aebcbc' },
    rock: { crack: '#1f2427', dark: '#41474a', base: '#61676a', light: '#868c8c', lighter: '#a9aeab' },
    top: { style: 'moss', light: '#9cc562', a: '#62903c', dark: '#41662e', deep: '#2f4d25', flower: '#d8402a', flower2: '#f4ead0' },
    pine: { trunk: '#6e3c27', trunkDark: '#43231a', trunkLight: '#9a5d3a', leaf: '#2f5240', leafLight: '#4f7a58', leafDark: '#1e3729', ink: '#16201c' },
    bamboo: { a: '#5f9a3c', light: '#a0d06a', dark: '#36652c', leaf: '#4a8838', leafLight: '#8cc65a' },
    arch: { roof: '#2e4a4c', roofLight: '#4f6f6c', roofDark: '#1a2c2e', pillar: '#a8322a', pillarDark: '#6a1c18', plaster: '#ddd8c6', plasterDark: '#b9b3a0', stone: '#8c908e', stoneLight: '#b4b8b2', stoneDark: '#4e5254', ink: '#1a1f22', gold: '#e8b040' },
    wood: '#7a4a2e', woodDark: '#4a2a1a', woodLight: '#a8703c', rope: '#c8a070',
    wall: { a: '#3f8a3a', b: '#7cc24f' },
    spike: { a: '#d8c080', b: '#8a7040', c: '#4f6a3a' },
    hazard: { deep: '#2a7488', mid: '#4fa9ba', light: '#a4e4ea', foam: '#ffffff' },
    water: true,
    gate: '#7a1a18', mist: '#f2f4ec', mistAlpha: 0.55,
    weather: 'leaves', petals: '#f2b8c8', fireflies: false, birds: '#2a3030', shafts: 0xfff4d0,
    platform: { a: '#7a4a2e', b: '#a8703c', c: '#4a2a1a' },
    post: { tint: [1.02, 1.0, 0.96], bloom: 0.25, thr: 0.9, vignette: 0.35, grain: 0.035 },
  },
  temple: {
    paper: ['#f2e2cf', '#ebcdb8', '#dcaea0', '#c98d86'],
    sun: { x: 92, y: 62, r: 18, c: '#f6d0b0', halo: '#efc8b4' },
    far: { ink: '#b89aa0', mist: '#e8cfc0' },
    mid: { ink: '#3a2630', mid: '#7a5a64', mist: '#dcb8ac', stroke: '#1c1218' },
    near: { ink: '#5c4048', mist: '#d0a89e', dark: '#432e36' },
    cloud: { fill: '#fbeee2', shade: '#ecd2c4', line: '#c8a0a0' },
    rock: { crack: '#221a20', dark: '#463c44', base: '#665c64', light: '#8a8088', lighter: '#aaa0a6' },
    top: { style: 'brick', light: '#f2b53a', a: '#a8302a', dark: '#6a1c18', deep: '#4a1210', flower: '#e8a040', flower2: '#f4ead0', moss: '#6a8a3e' },
    pine: { trunk: '#5a3226', trunkDark: '#3a1e18', trunkLight: '#86523a', leaf: '#34483a', leafLight: '#557058', leafDark: '#22302a', ink: '#1a1416' },
    bamboo: { a: '#5a8a3c', light: '#94c068', dark: '#34582c', leaf: '#4a7a38', leafLight: '#86b65a' },
    arch: { roof: '#2a3a44', roofLight: '#4a5e66', roofDark: '#18242c', pillar: '#a8322a', pillarDark: '#6a1c18', plaster: '#e6d6c4', plasterDark: '#c4ae9c', stone: '#8a8288', stoneLight: '#b0a8ac', stoneDark: '#4c4450', ink: '#1c1418', gold: '#f2b53a' },
    wood: '#9c2a24', woodDark: '#5a1414', woodLight: '#d84a32', rope: '#f2b53a',
    wall: { a: '#9c1d22', b: '#f2b53a' },
    spike: { a: '#c8ccd8', b: '#6d6a72', c: '#45424d' },
    hazard: { deep: '#7a1a10', mid: '#c8322a', light: '#f07a2a', foam: '#ffde4a' },
    gate: '#3a2a3a', mist: '#f4e2d6', mistAlpha: 0.5,
    weather: 'embers', petals: '#f5a8b8', fireflies: false, birds: '#3a2028', shafts: 0xffd8a8,
    platform: { a: '#6d6a72', b: '#9a96a0', c: '#45424d' },
    post: { tint: [1.04, 0.98, 0.95], bloom: 0.4, thr: 0.86, vignette: 0.4, grain: 0.035 },
  },
  mountain: {
    paper: ['#f8e4b8', '#f4c48c', '#eb9a68', '#d8684e'],
    sun: { x: 200, y: 92, r: 30, c: '#fff4d0', halo: '#fbd8a0' },
    far: { ink: '#c88a78', mist: '#f2c49c' },
    mid: { ink: '#3a1e28', mid: '#7a4a50', mist: '#e8a888', stroke: '#1a0c12', snow: '#f8ece4' },
    near: { ink: '#5a3038', mist: '#dc967c', dark: '#3e2028' },
    cloud: { fill: '#fff4e4', shade: '#f6d4b8', line: '#d89c88' },
    rock: { crack: '#22141a', dark: '#4a3240', base: '#6a4e5a', light: '#8c7078', lighter: '#ae9298' },
    top: { style: 'snow', light: '#ffffff', a: '#f2f0fa', dark: '#c4cce4', deep: '#9aa6cc', flower: '#ffffff', flower2: '#ffffff' },
    pine: { trunk: '#5a3226', trunkDark: '#341c16', trunkLight: '#86523a', leaf: '#2e3e38', leafLight: '#4c6058', leafDark: '#1c2824', ink: '#140e10', snow: '#f8f4ff' },
    bamboo: { a: '#5a8a3c', light: '#94c068', dark: '#34582c', leaf: '#4a7a38', leafLight: '#86b65a' },
    arch: { roof: '#2e3a4c', roofLight: '#4c5a6e', roofDark: '#1a2232', pillar: '#a8322a', pillarDark: '#6a1c18', plaster: '#ecdcc8', plasterDark: '#c8b29c', stone: '#8e8088', stoneLight: '#b4a6ac', stoneDark: '#4e4450', ink: '#1a1218', gold: '#f2b53a' },
    wood: '#5a3a2a', woodDark: '#3a2418', woodLight: '#8a5a3a', rope: '#d8c8a8',
    wall: { a: '#9ac8e8', b: '#e0f4ff' },
    spike: { a: '#e0f4ff', b: '#8ac0e8', c: '#5a8ab8' },
    hazard: { deep: '#24486a', mid: '#3a7ab8', light: '#7fe3ff', foam: '#ffffff' },
    water: true,
    gate: '#3a2430', mist: '#fbe6d0', mistAlpha: 0.5,
    weather: 'snow', petals: null, fireflies: false, birds: '#3a1a22', shafts: 0xffe0b0,
    platform: { a: '#5a3a2a', b: '#8a5a3a', c: '#3a2418' },
    post: { tint: [1.05, 0.99, 0.94], bloom: 0.35, thr: 0.88, vignette: 0.4, grain: 0.035 },
  },
  dragon: {
    paper: ['#0c0818', '#1a1234', '#2c1e50', '#45306c'],
    sun: { x: 236, y: 56, r: 7, c: '#ffffff', halo: '#a466c4' },
    far: { ink: '#3a2c60', mist: '#2a1f4a' },
    mid: { ink: '#0e0a1c', mid: '#241a40', mist: '#3a2c62', stroke: '#05030c', rim: '#e8b040' },
    near: { ink: '#1a1230', mist: '#4a3878', dark: '#120c22' },
    cloud: { fill: '#f2c24a', shade: '#c8902a', line: '#8a5a18' },
    rock: { crack: '#0c0818', dark: '#1e1638', base: '#2e2252', light: '#44346e', lighter: '#5c4a8c' },
    top: { style: 'gold', light: '#ffe08a', a: '#f2b53a', dark: '#a8641c', deep: '#6a3a10', flower: '#c46bff', flower2: '#ffe08a' },
    pine: { trunk: '#4a3060', trunkDark: '#2a1a3a', trunkLight: '#6a4a88', leaf: '#2a2a5a', leafLight: '#4a4a8a', leafDark: '#18183a', ink: '#08060f' },
    bamboo: { a: '#c8902a', light: '#ffe08a', dark: '#8a5a18', leaf: '#d8a83a', leafLight: '#ffe08a' },
    arch: { roof: '#3a2460', roofLight: '#5a3a88', roofDark: '#22143c', pillar: '#c8902a', pillarDark: '#8a5a18', plaster: '#d8cce8', plasterDark: '#a898c0', stone: '#6a5a8a', stoneLight: '#8e7cb0', stoneDark: '#3a2c5a', ink: '#0a0614', gold: '#ffe08a' },
    wood: '#c8902a', woodDark: '#8a5a18', woodLight: '#ffe08a', rope: '#ffe08a',
    wall: { a: '#f2b53a', b: '#ffe08a' },
    spike: { a: '#e0a8ff', b: '#a466c4', c: '#6b3a8c' },
    hazard: { deep: '#24103a', mid: '#6b3a8c', light: '#c46bff', foam: '#ffd8ff' },
    gate: '#4a2460', mist: '#5a4888', mistAlpha: 0.45,
    weather: 'motes', petals: null, fireflies: false, birds: null, shafts: null,
    platform: { a: '#c8902a', b: '#ffe08a', c: '#8a5a18' },
    post: { tint: [1.0, 0.98, 1.06], bloom: 0.9, thr: 0.62, vignette: 0.5, grain: 0.04 },
  },
};

// ---- Tampon de pixels (rendu rapide des grandes surfaces peintes) ----
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
function hash2(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise1(x, s = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash2(i, 0, s), hash2(i + 1, 0, s), u);
}
class PixBuf {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  set(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255;
  }
  has(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[(y * this.w + x) * 4 + 3] > 0; }
  canvas() {
    const [c, ctx] = makeCanvas(this.w, this.h);
    ctx.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return c;
  }
}
const _rampOut = [0, 0, 0];
// Dégradé tramé (ordered dithering) entre plusieurs couleurs
function ramp(stops, t, x, y, steps = 6) {
  const q = clamp(t, 0, 1) * steps;
  let i = Math.floor(q);
  if (q - i > bayer(x, y)) i++;
  const u = Math.min(i, steps) / steps;
  const s = u * (stops.length - 1);
  const k = Math.min(stops.length - 2, Math.floor(s));
  const f = s - k, a = stops[k], b = stops[k + 1];
  _rampOut[0] = a[0] + (b[0] - a[0]) * f;
  _rampOut[1] = a[1] + (b[1] - a[1]) * f;
  _rampOut[2] = a[2] + (b[2] - a[2]) * f;
  return _rampOut;
}

// ---- Montagnes au lavis (pics, dégradé encre → brume, coups de pinceau) ----
function inkRange(buf, peaks, pal, seed, opts = {}) {
  const cw = buf.w;
  const top = new Float32Array(cw).fill(1e9);
  const owner = new Int16Array(cw).fill(-1);
  peaks.forEach((p, i) => {
    for (let dx = -p.w / 2; dx <= p.w / 2; dx++) {
      const x = ((Math.round(p.x + dx) % cw) + cw) % cw;
      const t = Math.abs(dx) / (p.w / 2);
      const prof = Math.max(0, 1 - Math.pow(t, p.sharp || 1.4));
      const rough = (noise1((p.x + dx) * 0.18, seed + i) - 0.5) * 0.12 + (noise1((p.x + dx) * 0.05, seed + i * 3) - 0.5) * 0.18;
      const y = p.base - p.h * prof * (1 + rough * (1 - t * 0.5));
      if (y < top[x]) { top[x] = y; owner[x] = i; }
    }
  });
  const ink = hexToRgb(pal.ink), mist = hexToRgb(pal.mist);
  const mid = pal.mid ? hexToRgb(pal.mid) : null;
  const stops = mid ? [ink, mid, mist] : [ink, mist];
  const stroke = pal.stroke ? hexToRgb(pal.stroke) : ink;
  const snow = pal.snow ? hexToRgb(pal.snow) : null;
  const rim = pal.rim ? hexToRgb(pal.rim) : null;
  for (let x = 0; x < cw; x++) {
    if (owner[x] < 0) continue;
    const p = peaks[owner[x]];
    const y0 = Math.max(0, Math.ceil(top[x]));
    let dxp = x - p.x;
    if (dxp > cw / 2) dxp -= cw;
    if (dxp < -cw / 2) dxp += cw;
    const lit = dxp < 0;
    for (let y = y0; y < buf.h; y++) {
      const depth = y - top[x];
      let t = depth / (p.h * (opts.fade || 0.55) + 6);
      t = Math.max(t, (y - (p.base - p.h * 0.3)) / (p.h * 0.3 + 1));
      if (lit) t += 0.1;
      let c = ramp(stops, t, x, y, opts.steps || 7);
      if (snow && depth < p.h * 0.22 && (lit || bayer(x, y) < 0.35) && depth > 1) c = snow;
      buf.set(x, y, c);
    }
    buf.set(x, y0, stroke);
    if (rim && lit) buf.set(x, y0, rim);
  }
  // coups de pinceau (texture « cun ») partant des crêtes
  const rng = mulberry32(seed * 7 + 1);
  peaks.forEach((p) => {
    const n = Math.floor(p.h / (opts.strokeDiv || 5));
    for (let k = 0; k < n; k++) {
      const dx = (rng() - 0.5) * p.w * 0.8;
      let x = p.x + dx;
      const xi = ((Math.round(x) % cw) + cw) % cw;
      if (owner[xi] < 0) continue;
      let y = top[xi] + rng() * 6;
      const len = 6 + rng() * p.h * 0.45;
      const slope = (dx / (p.w / 2)) * 0.7 + (rng() - 0.5) * 0.3;
      const w2 = rng() < 0.4 ? 2 : 1;
      for (let s = 0; s < len; s++) {
        const dry = s / len;
        if (rng() < 0.15 + dry * 0.6) { x += slope; y += 1; continue; }
        const xx = ((Math.round(x) % cw) + cw) % cw;
        if (y >= top[xx]) {
          buf.set(xx, y, stroke);
          if (w2 === 2 && dry < 0.5) buf.set(xx + 1, y, stroke);
        }
        x += slope;
        y += 1;
      }
    }
    // petits pins accrochés aux crêtes
    if (opts.ridgePines) {
      for (let k = 0; k < 3; k++) {
        const x = ((Math.round(p.x + (rng() - 0.5) * p.w * 0.5) % cw) + cw) % cw;
        if (owner[x] < 0) continue;
        const y = Math.round(top[x]);
        for (let j = 0; j < 4; j++) for (let i = -2 + (j >> 1); i <= 2 - (j >> 1); i++) buf.set(x + i, y - j, stroke);
      }
    }
  });
  return top;
}
// Bande de brume tramée (densité croissante vers le bas)
function mistBand(buf, y, h, col, density = 1) {
  const c = hexToRgb(col);
  for (let yy = 0; yy < h; yy++) {
    const d = (yy / h) * density;
    for (let x = 0; x < buf.w; x++) if (d > bayer(x, y + yy) + (noise1(x * 0.05 + yy * 0.1, 9) - 0.5) * 0.5) buf.set(x, y + yy, c);
  }
}

// ---- Pins tordus (tronc fixe + frondaisons animées par le vent) ----
function buildPine(seed, pal, scale = 1) {
  const rng = mulberry32(seed);
  const w = Math.round(84 * scale), h = Math.round(86 * scale), ax = Math.round(w * (0.35 + rng() * 0.3));
  const [tc, tctx] = makeCanvas(w, h);
  const [lc, lctx] = makeCanvas(w, h);
  const pts = [];
  let x = ax, y = h - 1, th = 7 * scale;
  const lean = rng() < 0.5 ? -1 : 1;
  for (let i = 0; i < 7; i++) {
    pts.push([x, y, th]);
    y -= h * (0.1 + rng() * 0.03);
    x += lean * (2 + rng() * 4) * scale * (i < 3 ? 1 : -0.6);
    th = Math.max(2, th * 0.8);
  }
  const stamp = (ctx, sx, sy, r, c) => disc(ctx, Math.round(sx), Math.round(sy), Math.max(1, Math.round(r)), c);
  const seg = (ctx, a, b, ra, rb, c) => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let k = 0; k <= n; k++) stamp(ctx, lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n), lerp(ra, rb, k / n), c);
  };
  for (let i = 0; i + 1 < pts.length; i++) seg(tctx, pts[i], pts[i + 1], pts[i][2] / 2, pts[i + 1][2] / 2, pal.trunk);
  // racines
  seg(tctx, [ax, h - 2], [ax - 7 * scale, h - 1], 2, 1, pal.trunk);
  seg(tctx, [ax, h - 2], [ax + 6 * scale, h - 1], 2, 1, pal.trunk);
  const pads = [];
  for (let i = 2; i < pts.length; i++) {
    const [bx, by] = pts[i];
    if (i < pts.length - 1 && rng() < 0.75) {
      const dir = (i % 2 ? 1 : -1) * (rng() < 0.8 ? 1 : -1);
      const len = (12 + rng() * 18) * scale;
      const ex = clamp(bx + dir * len, 12, w - 12), ey = by - 4 - rng() * 6;
      seg(tctx, [bx, by], [ex, ey], 1.5, 1, pal.trunk);
      pads.push([ex, ey - 2, (9 + rng() * 6) * scale, (4 + rng() * 2) * scale]);
    }
  }
  const tip = pts[pts.length - 1];
  pads.push([tip[0], tip[1] - 3, 13 * scale, 6 * scale]);
  pads.push([tip[0] + lean * 6 * scale, tip[1] + 4, 10 * scale, 4 * scale]);
  // reflets et texture d'écorce
  for (let i = 0; i + 1 < pts.length; i++) line(tctx, pts[i][0] - pts[i][2] / 3, pts[i][1], pts[i + 1][0] - pts[i + 1][2] / 3, pts[i + 1][1], pal.trunkLight);
  for (let k = 0; k < 10; k++) {
    const p = pts[Math.floor(rng() * (pts.length - 1))];
    rect(tctx, p[0] + (rng() - 0.5) * p[2], p[1] - rng() * 6, 1, 2, pal.trunkDark);
  }
  // frondaisons en coussins (dessous sombre, dessus éclairé, aiguilles)
  for (const [px, py, rx, ry] of pads) {
    ellipse(lctx, px, py + 2, rx, ry, pal.leafDark);
    ellipse(lctx, px, py, rx, ry, pal.leaf);
    for (let k = 0; k < rx * 1.6; k++) {
      const a = rng() * Math.PI, r = rng();
      rect(lctx, px + Math.cos(a) * rx * r, py - Math.sin(a) * ry * r - 1, rng() < 0.5 ? 2 : 1, 1, pal.leafLight);
    }
    for (let k = 0; k < rx; k++) rect(lctx, px - rx + rng() * rx * 2, py + ry * 0.4 + rng() * 2, 1, 1, pal.leafDark);
    for (let xx = -rx + 2; xx < rx - 1; xx += 3) rect(lctx, px + xx, py + ry + 1 + ((xx >> 1) & 1), 1, 1, pal.leafDark);
    if (pal.snow) {
      ellipse(lctx, px, py - ry + 2, rx * 0.7, 1, pal.snow);
    }
  }
  outlineCanvas(tctx, w, h, pal.ink);
  outlineCanvas(lctx, w, h, pal.ink);
  return { trunk: tc, leaves: lc, w, h, ax };
}

// ---- Bosquet de bambous (entièrement animé) ----
function buildBamboo(seed, pal, h = 104) {
  const rng = mulberry32(seed);
  const w = 46;
  const [c, ctx] = makeCanvas(w, h);
  const n = 7 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const x = 6 + Math.round(rng() * (w - 14));
    const sh = h * (0.55 + rng() * 0.43);
    const col = i % 3 === 0 ? pal.dark : pal.a;
    rect(ctx, x, h - sh, 3, sh, col);
    rect(ctx, x, h - sh, 1, sh, i % 3 === 0 ? pal.a : pal.light);
    for (let y = h - 6; y > h - sh; y -= 9 + Math.floor(rng() * 5)) {
      rect(ctx, x - 1, y, 5, 1, pal.dark);
      if (y < h - sh * 0.35 && rng() < 0.7) {
        const dir = rng() < 0.5 ? -1 : 1;
        for (let k = 0; k < 3; k++) {
          const ly = y - 1 - k * 2 + Math.floor(rng() * 2);
          const len = 4 + Math.floor(rng() * 4);
          line(ctx, x + 1 + dir * 2, ly, x + 1 + dir * (2 + len), ly + 2 + k, k === 1 ? pal.leafLight : pal.leaf);
        }
      }
    }
    // bouquet de feuilles au sommet
    for (let k = 0; k < 5; k++) {
      const dir = k % 2 ? 1 : -1;
      line(ctx, x + 1, h - sh + 2 + k, x + 1 + dir * (4 + rng() * 5), h - sh + 5 + k * 2, k % 2 ? pal.leafLight : pal.leaf);
    }
  }
  outlineCanvas(ctx, w, h, '#1c2a1c');
  return c;
}

// ---- Toit chinois en tuiles (avancées relevées, faîtage orné) ----
function drawTiledRoof(ctx, x, y, w, h, a) {
  const ov = Math.round(h * 0.9);
  for (let yy = 0; yy < h; yy++) {
    const t = yy / h;
    const e = Math.round(ov * t * t);
    const x0 = x - e, x1 = x + w + e;
    rect(ctx, x0, y + yy, x1 - x0, 1, a.roof);
    for (let xx = x0 + ((yy >> 1) & 1); xx < x1; xx += 3) rect(ctx, xx, y + yy, 1, 1, a.roofLight);
  }
  const by = y + h;
  const bx0 = x - ov + 2, bx1 = x + w + ov - 2;
  rect(ctx, bx0, by, bx1 - bx0, 2, a.roofDark);
  for (let xx = bx0; xx < bx1; xx += 3) rect(ctx, xx, by, 2, 1, a.roofLight);
  // avancées relevées
  poly(ctx, [[bx0 - 6, by - 6], [bx0 + 2, by - 1], [bx0 + 6, by + 2], [bx0 - 1, by + 1]], a.roof);
  poly(ctx, [[bx1 + 6, by - 6], [bx1 - 2, by - 1], [bx1 - 6, by + 2], [bx1 + 1, by + 1]], a.roof);
  rect(ctx, bx0 - 7, by - 7, 2, 2, a.pillar);
  rect(ctx, bx1 + 5, by - 7, 2, 2, a.pillar);
  // faîtage
  rect(ctx, x + 2, y - 3, w - 4, 3, a.roofDark);
  rect(ctx, x + 2, y - 3, w - 4, 1, a.roofLight);
  rect(ctx, x - 2, y - 6, 4, 4, a.pillar);
  rect(ctx, x + w - 2, y - 6, 4, 4, a.pillar);
  rect(ctx, x - 3, y - 8, 2, 2, a.pillar);
  rect(ctx, x + w + 1, y - 8, 2, 2, a.pillar);
  rect(ctx, x + w / 2 - 2, y - 7, 4, 4, a.gold);
}
// Pavillon ouvert (comme au bord du lac) — les lanternes sont animées à part
function drawPavilion(ctx, x, baseY, a, w = 60) {
  // soubassement de pierre
  rect(ctx, x - 6, baseY - 7, w + 12, 7, a.stone);
  rect(ctx, x - 6, baseY - 7, w + 12, 1, a.stoneLight);
  for (let xx = x - 6; xx < x + w + 6; xx += 8) rect(ctx, xx, baseY - 6, 1, 6, a.stoneDark);
  rect(ctx, x - 6, baseY - 1, w + 12, 1, a.stoneDark);
  // balustrade
  rect(ctx, x - 2, baseY - 16, w + 4, 2, a.pillar);
  rect(ctx, x - 2, baseY - 10, w + 4, 1, a.pillar);
  for (let xx = x; xx < x + w; xx += 5) rect(ctx, xx, baseY - 15, 1, 6, a.pillarDark);
  // piliers
  const cols = [x, x + Math.round(w / 3), x + Math.round((2 * w) / 3), x + w - 4];
  for (const cx of cols) {
    rect(ctx, cx, baseY - 46, 4, 39, a.pillar);
    rect(ctx, cx, baseY - 46, 1, 39, a.pillarDark);
    rect(ctx, cx + 3, baseY - 46, 1, 39, a.pillarDark);
  }
  // linteau et frise
  rect(ctx, x - 3, baseY - 50, w + 6, 5, a.pillar);
  rect(ctx, x - 3, baseY - 49, w + 6, 1, a.gold);
  for (let xx = x; xx < x + w; xx += 6) rect(ctx, xx + 2, baseY - 47, 3, 1, a.roofLight);
  drawTiledRoof(ctx, x, baseY - 66, w, 15, a);
}
// Temple à étage avec escalier, enduit, plaque dorée
function drawShrine(ctx, x, baseY, a, w = 76) {
  // escalier de pierre
  for (let i = 0; i < 4; i++) {
    rect(ctx, x + w / 2 - 14 - i * 3, baseY - 4 - i * 4 + 4, 28 + i * 6, 4, i % 2 ? a.stone : a.stoneLight);
    rect(ctx, x + w / 2 - 14 - i * 3, baseY - i * 4, 28 + i * 6, 1, a.stoneDark);
  }
  rect(ctx, x - 4, baseY - 16, w + 8, 12, a.stone);
  rect(ctx, x - 4, baseY - 16, w + 8, 1, a.stoneLight);
  for (let xx = x; xx < x + w; xx += 10) rect(ctx, xx, baseY - 15, 1, 11, a.stoneDark);
  // murs enduits
  rect(ctx, x, baseY - 54, w, 38, a.plaster);
  rect(ctx, x, baseY - 20, w, 4, a.plasterDark);
  // piliers rouges
  for (const cx of [x, x + 16, x + w - 20, x + w - 4]) {
    rect(ctx, cx, baseY - 56, 4, 40, a.pillar);
    rect(ctx, cx + 3, baseY - 56, 1, 40, a.pillarDark);
  }
  // porte et fenêtres à croisillons
  rect(ctx, x + w / 2 - 10, baseY - 44, 20, 28, a.ink);
  rect(ctx, x + w / 2 - 9, baseY - 43, 18, 27, a.pillarDark);
  rect(ctx, x + w / 2, baseY - 43, 1, 27, a.ink);
  for (const wx of [x + 6, x + w - 14]) {
    rect(ctx, wx, baseY - 44, 8, 10, a.pillarDark);
    rect(ctx, wx + 1, baseY - 43, 6, 8, a.plasterDark);
    rect(ctx, wx + 3, baseY - 43, 1, 8, a.pillarDark);
    rect(ctx, wx + 1, baseY - 40, 6, 1, a.pillarDark);
  }
  // plaque dorée
  rect(ctx, x + w / 2 - 9, baseY - 60, 18, 8, a.ink);
  rect(ctx, x + w / 2 - 8, baseY - 59, 16, 6, a.gold);
  rect(ctx, x + w / 2 - 5, baseY - 57, 3, 2, a.pillarDark);
  rect(ctx, x + w / 2 + 2, baseY - 57, 3, 2, a.pillarDark);
  rect(ctx, x - 3, baseY - 60, w + 6, 4, a.pillar);
  drawTiledRoof(ctx, x, baseY - 78, w, 18, a);
}
// Pont de pierre en arche (tablier praticable + arche + balustrade)
function drawArchBridge(ctx, x0, x1, deckY, gl, gr, a) {
  const w = x1 - x0, mid = (x0 + x1) / 2;
  const bottom = Math.max(gl, gr);
  const archTop = deckY + 9, span = w / 2 - 8;
  // maçonnerie avec ouverture en arc
  for (let x = x0; x < x1; x++) {
    const t = (x - mid) / span;
    const archY = Math.abs(t) < 1 ? archTop + Math.round((1 - Math.sqrt(1 - t * t)) * (bottom - archTop)) : bottom;
    const ground = x < mid ? gl : gr;
    for (let y = deckY + 4; y < Math.min(archY, ground); y++) {
      const row = Math.floor((y - deckY) / 4), off = row % 2 ? 4 : 0;
      const mortar = (y - deckY) % 4 === 0 || (x - x0 + off) % 8 === 0;
      rect(ctx, x, y, 1, 1, mortar ? a.stoneDark : (hash2(Math.floor((x + off) / 8), row, 3) < 0.3 ? a.stoneLight : a.stone));
    }
    if (Math.abs(t) < 1 && archY < ground) {
      rect(ctx, x, archY, 1, 1, a.ink);
      rect(ctx, x, archY - 1, 1, 1, a.stoneDark);
    }
  }
  // clé de voûte
  rect(ctx, mid - 2, archTop - 1, 4, 4, a.stoneLight);
  // tablier
  rect(ctx, x0 - 2, deckY, w + 4, 5, a.stoneLight);
  rect(ctx, x0 - 2, deckY, w + 4, 1, '#ffffff');
  rect(ctx, x0 - 2, deckY + 4, w + 4, 1, a.stoneDark);
  for (let x = x0; x < x1; x += 8) rect(ctx, x, deckY + 1, 1, 3, a.stoneDark);
  // balustrade
  rect(ctx, x0 - 2, deckY - 7, w + 4, 2, a.stone);
  rect(ctx, x0 - 2, deckY - 7, w + 4, 1, a.stoneLight);
  for (let x = x0; x <= x1 - 3; x += 8) {
    rect(ctx, x, deckY - 9, 3, 9, a.stone);
    rect(ctx, x, deckY - 9, 3, 1, a.stoneLight);
    rect(ctx, x + 2, deckY - 8, 1, 8, a.stoneDark);
  }
}
// Rocher moussu
function drawBoulder(ctx, x, baseY, w, h, th, seed) {
  const r = th.rock, tp = th.top, rng = mulberry32(seed);
  const cx = x + w / 2;
  ellipse(ctx, cx, baseY - h / 2, w / 2, h / 2, r.base);
  ellipse(ctx, cx + 2, baseY - h / 2 + 2, w / 2 - 3, h / 2 - 3, r.dark);
  ellipse(ctx, cx - 2, baseY - h / 2 - 1, w / 2 - 4, h / 2 - 4, r.base);
  ellipse(ctx, cx - 4, baseY - h / 2 - 3, w / 4, h / 4, r.light);
  for (let k = 0; k < 4; k++) line(ctx, cx - w / 3 + rng() * w * 0.6, baseY - h + 3 + rng() * h * 0.4, cx - w / 3 + rng() * w * 0.6, baseY - 3, r.crack);
  rect(ctx, x, baseY - 2, w, 2, r.dark);
  if (tp.style !== 'gold') {
    ellipse(ctx, cx - 1, baseY - h + 3, w / 3, 3, tp.style === 'snow' ? tp.a : tp.a);
    rect(ctx, cx - w / 4, baseY - h + 1, w / 2, 1, tp.light);
    for (let k = 0; k < 3; k++) rect(ctx, cx - w / 4 + rng() * w / 2, baseY - h + 5, 1, 2 + rng() * 3, tp.dark);
  }
}

// ---- Terrain rocheux : pierres de Voronoï, mousse, neige, briques, or ----
function renderTerrain(th, isSolid, paint, x0, y0, w, h) {
  const buf = new PixBuf(w, h);
  const R = th.rock, T = th.top;
  const tones = [R.crack, R.dark, R.base, R.light, R.lighter].map(hexToRgb);
  const topC = [T.deep, T.dark, T.a, T.light].map(hexToRgb);
  const flower = hexToRgb(T.flower), flower2 = hexToRgb(T.flower2);
  const moss = T.moss ? hexToRgb(T.moss) : null;
  const SX = 11, SY = 8;
  const t0x = Math.floor(x0 / TILE), t1x = Math.ceil((x0 + w) / TILE), t0y = Math.floor(y0 / TILE), t1y = Math.ceil((y0 + h) / TILE);
  for (let ty = t0y; ty < t1y; ty++) {
    for (let tx = t0x; tx < t1x; tx++) {
      if (!paint(tx, ty)) continue;
      let runTop = ty;
      while (runTop > 0 && isSolid(tx, runTop - 1)) runTop--;
      const exposedTop = !isSolid(tx, runTop - 1);
      const L = isSolid(tx - 1, ty), Rr = isSolid(tx + 1, ty), D = ty + 1 >= ROWS || isSolid(tx, ty + 1);
      for (let ly = 0; ly < TILE; ly++) {
        for (let lx = 0; lx < TILE; lx++) {
          const px = tx * TILE + lx, py = ty * TILE + ly;
          const depth = py - runTop * TILE;
          let tone, vein = false;
          if (T.style === 'brick' || T.style === 'gold') {
            const bw = T.style === 'gold' ? 16 : 12, bh = T.style === 'gold' ? 8 : 6;
            const row = Math.floor(py / bh), off = row % 2 ? bw / 2 : 0;
            const col = Math.floor((px + off) / bw);
            const mortar = py % bh === 0 || (px + off) % bw === 0;
            const v = hash2(col, row, 11);
            tone = mortar ? 0 : v < 0.25 ? 1 : v < 0.8 ? 2 : 3;
            if (!mortar && py % bh === 1) tone = Math.min(4, tone + 1);
            if (T.style === 'gold' && !mortar && hash2(px, py, 5) < 0.012) vein = true;
          } else {
            const cx = Math.floor(px / SX), cy = Math.floor(py / SY);
            let f1 = 1e9, f2 = 1e9, fx = 0, fy = 0, id = 0;
            for (let j = -1; j <= 1; j++) {
              for (let i = -1; i <= 1; i++) {
                const gx = cx + i, gy = cy + j;
                const ox = (gx + 0.15 + hash2(gx, gy, 1) * 0.7) * SX, oy = (gy + 0.15 + hash2(gx, gy, 2) * 0.7) * SY;
                const d = Math.hypot((px - ox) * 0.9, py - oy);
                if (d < f1) { f2 = f1; f1 = d; fx = ox; fy = oy; id = hash2(gx, gy, 3); }
                else if (d < f2) f2 = d;
              }
            }
            if (f2 - f1 < 1.25) tone = 0;
            else {
              tone = id < 0.2 ? 1 : id < 0.8 ? 2 : 3;
              const l = (px - fx) + (py - fy);
              if (l < -SX * 0.4) tone++;
              else if (l > SX * 0.45) tone--;
            }
          }
          if (tone > 0 && depth > 20) {
            const k = (depth - 20) / 56;
            if (k > bayer(px, py)) tone--;
            if (k > 1 + bayer(px, py)) tone--;
          }
          if ((!L && lx === 0) || (!Rr && lx === TILE - 1) || (!D && ly === TILE - 1)) tone = 0;
          else if (tone > 1 && ((!L && lx === 1) || (!Rr && lx === TILE - 2) || (!D && ly === TILE - 2))) tone--;
          let c = vein && tone > 0 ? hexToRgb(PAL.gold) : tones[clamp(tone, 0, 4)];
          // dessus : mousse / neige / laque / or
          if (exposedTop && ty === runTop) {
            const n = noise1(px * 0.35, 21);
            const thick = (T.style === 'brick' ? 4 : T.style === 'gold' ? 3 : 4) + Math.floor(n * 3);
            const drip = hash2(px, 0, 31) < 0.14 ? 2 + Math.floor(hash2(px, 1, 31) * 4) : 0;
            if (ly < thick) {
              c = ly === 0 ? topC[3] : ly === thick - 1 ? topC[1] : hash2(px, py, 7) < 0.18 ? topC[3] : topC[2];
              if (T.style === 'gold' && ly === 1 && (px % 6 === 0 || px % 6 === 1)) c = topC[1];
            } else if (ly < thick + drip && T.style !== 'gold') c = ly === thick + drip - 1 ? topC[0] : topC[1];
            else if (moss && ly < thick + drip + 2 && hash2(Math.floor(px / 5), 0, 41) < 0.3) c = moss;
          }
          buf.set(px - x0, py - y0, c);
        }
      }
      // brins d'herbe, fleurs, congères au-dessus de la surface
      if (exposedTop && ty === runTop && T.style !== 'gold') {
        for (let lx = 0; lx < TILE; lx++) {
          const px = tx * TILE + lx, sy = runTop * TILE - y0;
          const hsh = hash2(px, 0, 51);
          if (T.style === 'moss') {
            if (hsh < 0.4) {
              const bh = 1 + Math.floor(hash2(px, 2, 51) * 3);
              for (let k = 1; k <= bh; k++) buf.set(px - x0, sy - k, k === bh ? topC[3] : topC[2]);
            }
            if (hsh > 0.975) {
              buf.set(px - x0, sy - 1, topC[1]);
              buf.set(px - x0, sy - 2, topC[1]);
              buf.set(px - x0, sy - 3, hsh > 0.99 ? flower2 : flower);
              buf.set(px - x0 + 1, sy - 3, hsh > 0.99 ? flower2 : flower);
            }
          } else if (T.style === 'snow') {
            if (noise1(px * 0.2, 61) > 0.62) buf.set(px - x0, sy - 1, topC[3]);
          } else if (T.style === 'brick' && hsh < 0.06) {
            buf.set(px - x0, sy - 1, moss || topC[2]);
          }
        }
      }
    }
  }
  return buf.canvas();
}
// Une tuile isolée (compatibilité : murs fissurés)
function drawGroundTile(ctx, th, x, y, nb, rng, cracked = false) {
  const c = renderTerrain(th, () => true, (tx, ty) => tx === 0 && ty === 0, 0, 0, TILE, TILE);
  ctx.drawImage(c, x, y);
  if (cracked) {
    line(ctx, x + 3, y + 3, x + 7, y + 8, th.rock.crack);
    line(ctx, x + 7, y + 8, x + 5, y + 13, th.rock.crack);
    line(ctx, x + 7, y + 8, x + 12, y + 10, th.rock.crack);
  }
}
function drawWallOverlay(ctx, th, x, y, rng) {
  const w = th.wall;
  if (th.top.style === 'moss' || th.top.style === 'snow') {
    for (let k = 0; k < 2; k++) {
      const vx = x + 2 + Math.floor(rng() * 12);
      rect(ctx, vx, y, 1, 16, w.a);
      rect(ctx, vx - 1, y + 3 + Math.floor(rng() * 8), 2, 2, w.b);
      rect(ctx, vx + 1, y + 9 + Math.floor(rng() * 5), 2, 1, w.b);
    }
  } else {
    rect(ctx, x + 2, y + 1, 12, 14, th.rock.crack);
    rect(ctx, x + 4, y + 1, 1, 14, w.a);
    rect(ctx, x + 11, y + 1, 1, 14, w.a);
    rect(ctx, x + 2, y + 5, 12, 1, w.a);
    rect(ctx, x + 2, y + 11, 12, 1, w.a);
    rect(ctx, x + 7, y + 7, 2, 2, w.b);
  }
}
function drawStairTile(ctx, th, x, y, topOpen) {
  const a = th.arch;
  rect(ctx, x, y, 16, 16, a.stone);
  for (let k = 0; k < 2; k++) {
    const sy = y + k * 8;
    rect(ctx, x, sy, 16, 2, a.stoneLight);
    rect(ctx, x, sy + 7, 16, 1, a.stoneDark);
    rect(ctx, x + (k ? 5 : 11), sy + 2, 1, 5, a.stoneDark);
  }
  if (topOpen) {
    rect(ctx, x, y, 16, 1, '#ffffff');
    if (th.top.style === 'moss') { rect(ctx, x, y + 1, 3, 1, th.top.a); rect(ctx, x + 13, y + 1, 3, 2, th.top.a); }
    if (th.top.style === 'snow') rect(ctx, x, y, 16, 2, th.top.a);
  }
}
function drawBridgeTile(ctx, th, x, y, leftEnd, rightEnd) {
  rect(ctx, x, y, 16, 5, th.wood);
  rect(ctx, x, y, 16, 1, th.woodLight);
  rect(ctx, x, y + 5, 16, 1, th.woodDark);
  for (let i = 0; i < 16; i += 4) rect(ctx, x + i, y + 1, 1, 4, th.woodDark);
  rect(ctx, x, y - 7, 16, 1, th.rope);
  rect(ctx, x + 8, y - 5, 1, 1, th.rope);
  if (leftEnd || rightEnd) {
    const px = leftEnd ? x : x + 14;
    rect(ctx, px, y - 9, 2, 9, th.woodDark);
    rect(ctx, px, y - 10, 2, 1, PAL.gold);
  } else rect(ctx, x + 7, y - 6, 1, 6, th.rope);
}
function drawSuspendedTile(ctx, th, x, y, chain) {
  const a = th.arch;
  rect(ctx, x, y, 16, 6, a.stone);
  rect(ctx, x, y, 16, 1, a.stoneLight);
  rect(ctx, x, y + 5, 16, 1, a.stoneDark);
  rect(ctx, x + 6, y + 2, 4, 2, th.top.a);
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

// ---- Ciel en papier de riz ----
function buildSky(themeName) {
  const th = THEMES[themeName];
  const [c, ctx] = makeCanvas(W, H);
  bandGradient(ctx, 0, 0, W, H, th.paper);
  const rng = mulberry32(themeName.length * 977);
  const s = th.sun;
  // halo tramé du soleil / de la lune
  for (let r = s.r * 3; r > s.r; r -= 2) {
    const dens = 1 - (r - s.r) / (s.r * 2);
    ctx.fillStyle = s.halo;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y);
      if (d <= r && d > r - 2 && dens * 0.8 > bayer(s.x + x, s.y + y)) ctx.fillRect(s.x + x, s.y + y, 1, 1);
    }
  }
  disc(ctx, s.x, s.y, s.r, s.c);
  if (themeName === 'mountain') for (let i = 0; i < 4; i++) rect(ctx, s.x - s.r - 4, s.y + 6 + i * 6, s.r * 2 + 8, 1 + (i >> 1), th.paper[2]);
  // grain du papier
  const dark = themeName === 'dragon';
  for (let i = 0; i < 700; i++) {
    const x = Math.floor(rng() * W), y = Math.floor(rng() * H);
    ctx.fillStyle = dark ? (rng() < 0.2 ? '#ffe08a' : '#a8a0d0') : rng() < 0.5 ? 'rgba(120,110,90,0.10)' : 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, 1, 1);
    if (dark && i > 160) break;
  }
  if (dark) {
    for (let k = 0; k < 3; k++) {
      for (let a = 0; a < Math.PI * 2; a += 0.035) {
        const r = 24 - k * 6;
        rect(ctx, s.x + Math.cos(a + k) * r, s.y + Math.sin(a + k) * r * 0.9, 2, 2, k === 0 ? '#7a4aa8' : k === 1 ? '#e8b040' : '#ffe08a');
      }
    }
  }
  return c;
}
function wrapDraw(cw, x, w, fn) {
  fn(x);
  if (x < 0) fn(x + cw);
  if (x + w > cw) fn(x - cw);
}
// Couches de parallaxe : lointain, montagnes à l'encre, proche, premier plan
function buildLayers(themeName) {
  const th = THEMES[themeName];
  const rng = mulberry32(themeName.length * 131 + 7);
  const CW = 640, CH = 240;
  const layers = [];
  // 1. crêtes lointaines
  let buf = new PixBuf(CW, CH);
  const far = [];
  for (let i = 0; i < 9; i++) far.push({ x: i * 72 + rng() * 30, w: 90 + rng() * 70, h: 50 + rng() * 50, base: 190, sharp: 1.2 + rng() * 0.5 });
  inkRange(buf, far, th.far, 3, { fade: 0.9, steps: 10, strokeDiv: 30 });
  mistBand(buf, 150, 40, th.far.mist, 1.2);
  for (let y = 188; y < CH; y++) for (let x = 0; x < CW; x++) buf.set(x, y, hexToRgb(th.far.mist));
  layers.push({ c: buf.canvas(), fx: 0.06, fy: 0.04, offY: -14 });
  // 2. grands pics à l'encre avec coups de pinceau
  buf = new PixBuf(CW, CH);
  const mid = [];
  for (let i = 0; i < 5; i++) mid.push({ x: 40 + i * 128 + rng() * 40, w: 70 + rng() * 60, h: 110 + rng() * 60, base: 215, sharp: 1.5 + rng() * 0.6 });
  for (let i = 0; i < 5; i++) mid.push({ x: 100 + i * 128 + rng() * 40, w: 60 + rng() * 40, h: 60 + rng() * 40, base: 215, sharp: 1.3 });
  inkRange(buf, mid, th.mid, 5, { fade: 0.5, steps: 16, strokeDiv: 4, ridgePines: true });
  mistBand(buf, 160, 50, th.mid.mist, 1.3);
  for (let y = 208; y < CH; y++) for (let x = 0; x < CW; x++) buf.set(x, y, hexToRgb(th.mid.mist));
  let c = buf.canvas();
  let ctx = c.getContext('2d');
  layers.push({ c, fx: 0.15, fy: 0.1, offY: -6 });
  // 3. plan proche : falaises, pins, architecture en silhouette douce
  buf = new PixBuf(CW, CH);
  const near = [];
  for (let i = 0; i < 7; i++) near.push({ x: i * 92 + rng() * 30, w: 50 + rng() * 40, h: 50 + rng() * 50, base: 235, sharp: 0.9 + rng() * 0.4 });
  inkRange(buf, near, { ink: th.near.ink, mist: th.near.mist, stroke: th.near.dark }, 8, { fade: 0.6, steps: 12, strokeDiv: 7 });
  c = buf.canvas();
  ctx = c.getContext('2d');
  const silhouette = { roof: th.near.dark, roofLight: th.near.ink, roofDark: th.near.dark, pillar: th.near.dark, pillarDark: th.near.dark, plaster: th.near.ink, plasterDark: th.near.dark, stone: th.near.ink, stoneLight: th.near.ink, stoneDark: th.near.dark, ink: th.near.dark, gold: th.near.ink };
  for (let i = 0; i < 4; i++) {
    const x = i * 160 + 30 + rng() * 40, base = 200 + rng() * 20;
    if (themeName === 'dragon') wrapDraw(CW, x - 10, 90, (xx) => { poly(ctx, [[xx - 10, base - 4], [xx + 70, base - 4], [xx + 50, base + 20], [xx + 25, base + 34], [xx, base + 16]], th.near.dark); drawPavilion(ctx, xx, base - 4, silhouette, 54); });
    else if (i % 2 === 0) wrapDraw(CW, x - 10, 90, (xx) => drawPavilion(ctx, xx, base, silhouette, 50));
    else {
      const p = buildPine(900 + i, { trunk: th.near.dark, trunkDark: th.near.dark, trunkLight: th.near.dark, leaf: th.near.dark, leafLight: th.near.ink, leafDark: th.near.dark, ink: th.near.dark }, 0.8);
      wrapDraw(CW, x, p.w, (xx) => { ctx.drawImage(p.trunk, xx, base - p.h); ctx.drawImage(p.leaves, xx, base - p.h); });
    }
  }
  if (themeName === 'forest' || themeName === 'temple') {
    for (let i = 0; i < 6; i++) {
      const bc = buildBamboo(500 + i, { a: th.near.ink, light: th.near.mist, dark: th.near.dark, leaf: th.near.ink, leafLight: th.near.mist }, 120);
      wrapDraw(CW, i * 107 + 70, 46, (xx) => ctx.drawImage(bc, xx, 240 - 120 - 6));
    }
  }
  layers.push({ c, fx: 0.32, fy: 0.24, offY: 4 });
  // 4. premier plan : rochers et feuillages sombres (rares)
  const [fc, fctx] = makeCanvas(CW, CH);
  const fg = th.near.dark;
  // touffes d'herbes hautes au premier plan, en bas de l'écran
  for (let i = 0; i < 3; i++) {
    const x = 60 + i * 210 + rng() * 40;
    wrapDraw(CW, x - 20, 50, (xx) => {
      for (let k = 0; k < 9; k++) line(fctx, xx + k * 3, 240, xx + k * 3 + (k % 2 ? 4 : -3), 226 - (k % 3) * 4, fg);
    });
  }
  layers.push({ c: fc, fx: 1.25, fy: 1.0, offY: 0, fg: true });
  // agrandit chaque couche vers le bas (prolonge la dernière rangée) pour couvrir l'écran 480×270
  const EXT = 110;
  for (const l of layers) {
    if (l.fg) { l.offY += MAP_PAD * TILE; continue; }
    const [c2, x2] = makeCanvas(l.c.width, l.c.height + EXT);
    x2.drawImage(l.c, 0, 0);
    x2.drawImage(l.c, 0, l.c.height - 1, l.c.width, 1, 0, l.c.height, l.c.width, EXT);
    l.c = c2;
    l.offY += 70;
  }
  return layers;
}
// Brume qui défile (bancs tramés)
function buildMistCanvas(col) {
  const buf = new PixBuf(256, 48);
  const c = hexToRgb(col);
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 256; x++) {
      const n = noise1(x * 0.04, 3) * 0.6 + noise1(x * 0.11 + y * 0.05, 4) * 0.4;
      const v = Math.sin((y / 47) * Math.PI) * n * 1.4;
      if (v > bayer(x, y) + 0.15) buf.set(x, y, c);
    }
  }
  return buf.canvas();
}
// Nuage de papier découpé (lobes arrondis, base plate, ombré)
function buildCloudSheet(w, h, seed, pal) {
  return buildSheet(w, h, 1, (ctx) => {
    const rng = mulberry32(seed);
    const n = Math.max(3, Math.floor(w / 12));
    const base = h - 3;
    for (let i = 0; i < n; i++) {
      const cx = 5 + ((w - 10) * (i + 0.5)) / n, r = Math.min(h - 4, 4 + rng() * (h * 0.45) + (Math.abs(i - n / 2) < 1 ? h * 0.2 : 0)) * 0.9;
      disc(ctx, cx, base - r * 0.6, r, pal.fill);
    }
    rect(ctx, 3, base - 3, w - 6, 3, pal.fill);
    for (let x = 3; x < w - 3; x++) {
      rect(ctx, x, base - 1, 1, 1, pal.shade);
      if ((x >> 2) % 3 === 0) rect(ctx, x, base - 2, 1, 1, pal.shade);
    }
    for (let i = 0; i < n; i += 2) {
      const cx = 5 + ((w - 10) * (i + 0.5)) / n;
      rect(ctx, cx - 2, base - h * 0.55, 3, 1, '#ffffff');
    }
  }, pal.line);
}
// Liquide animé (surface) et reflets
function buildHazardCanvas(th) {
  const hz = th.hazard;
  const [c, ctx] = makeCanvas(48, 16);
  rect(ctx, 0, 2, 48, 14, hz.mid);
  rect(ctx, 0, 9, 48, 7, hz.deep);
  for (let x = 0; x < 48; x++) {
    const y = Math.round(2 + Math.sin((x / 48) * Math.PI * 4) * 1.2);
    ctx.clearRect(x, 0, 1, y);
    rect(ctx, x, y, 1, 1, hz.foam);
    if (x % 12 < 4) rect(ctx, x, y + 1, 1, 1, hz.light);
    if ((x * 7) % 16 < 2) rect(ctx, x, 6 + (x % 3), 2, 1, hz.light);
  }
  for (let x = 0; x < 48; x += 2) if (bayer(x, 8) < 0.5) rect(ctx, x, 8, 1, 1, hz.deep);
  return c;
}
function buildShimmerCanvas(th) {
  const [c, ctx] = makeCanvas(64, 16);
  const rng = mulberry32(4);
  for (let i = 0; i < 16; i++) rect(ctx, Math.floor(rng() * 60), 4 + Math.floor(rng() * 11), 2 + Math.floor(rng() * 4), 1, th.hazard.light);
  return c;
}
function buildWaterfallCanvas(th, front) {
  const [c, ctx] = makeCanvas(24, 48);
  const rng = mulberry32(front ? 2 : 1);
  if (!front) {
    rect(ctx, 0, 0, 24, 48, th.hazard.mid);
    for (let i = 0; i < 14; i++) rect(ctx, Math.floor(rng() * 24), Math.floor(rng() * 48), 1, 6 + Math.floor(rng() * 10), th.hazard.deep);
    rect(ctx, 0, 0, 1, 48, th.hazard.deep);
    rect(ctx, 23, 0, 1, 48, th.hazard.deep);
  } else {
    for (let i = 0; i < 22; i++) rect(ctx, 1 + Math.floor(rng() * 22), Math.floor(rng() * 48), 1, 4 + Math.floor(rng() * 12), rng() < 0.6 ? '#ffffff' : th.hazard.light);
    for (let y = 0; y < 48; y += 3) { rect(ctx, 1, y, 1, 2, '#ffffff'); rect(ctx, 22, y + 1, 1, 2, '#ffffff'); }
  }
  return c;
}
// Rayons de lumière obliques (additifs, en paliers)
function buildShaftCanvas() {
  const [c, ctx] = makeCanvas(96, 180);
  for (let y = 0; y < 180; y++) {
    for (let x = 0; x < 96; x++) {
      const u = x - y * 0.35;
      const band = Math.max(0, 1 - Math.abs(u - 30) / 14) + Math.max(0, 1 - Math.abs(u - 62) / 8) * 0.7;
      const v = Math.round(band * (1 - y / 180) * 4) / 4;
      if (v > 0) { ctx.fillStyle = `rgb(${Math.round(v * 90)},${Math.round(v * 90)},${Math.round(v * 90)})`; ctx.fillRect(x, y, 1, 1); }
    }
  }
  return c;
}
// Vol d'oiseaux (2 frames)
function buildBirdSheet(col) {
  return buildSheet(9, 6, 2, (ctx, f) => {
    if (f === 0) { line(ctx, 1, 2, 4, 4, col); line(ctx, 4, 4, 7, 2, col); }
    else { line(ctx, 1, 4, 4, 3, col); line(ctx, 4, 3, 7, 4, col); }
  }, null);
}
// Écume au pied des cascades (4 frames)
function buildSplashSheet(th) {
  return buildSheet(40, 14, 4, (ctx, f) => {
    const rng = mulberry32(f + 1);
    for (let i = 0; i < 9; i++) {
      const x = 6 + rng() * 28, r = 2 + rng() * 3;
      disc(ctx, x, 10 - rng() * 3 - (f % 2), r, i % 3 ? '#ffffff' : th.hazard.light);
    }
    rect(ctx, 4, 11, 32, 2, '#ffffff');
  }, null);
}
// Planche « dragon volant au loin »
function buildFlyingDragonSheet(col, accent) {
  return buildSheet(64, 24, 4, (ctx, f) => drawDragon(ctx, 4, 12, 16, (f * Math.PI) / 2, col, accent), null);
}

// ---- Décors hérités (temples, pagodes, statues…) recolorés par thème ----
function drawMountain(ctx, x, baseY, w, h, col, light, snow) {
  poly(ctx, [[x, baseY], [x + w * 0.38, baseY - h * 0.85], [x + w * 0.5, baseY - h], [x + w * 0.62, baseY - h * 0.8], [x + w, baseY]], col);
  poly(ctx, [[x + w * 0.5, baseY - h], [x + w * 0.38, baseY - h * 0.85], [x + w * 0.3, baseY - h * 0.5], [x + w * 0.45, baseY - h * 0.55]], light);
  if (snow) poly(ctx, [[x + w * 0.5, baseY - h], [x + w * 0.62, baseY - h * 0.8], [x + w * 0.5, baseY - h * 0.82], [x + w * 0.38, baseY - h * 0.85]], snow);
}
function drawRoof(ctx, x, y, w, col, edge) {
  poly(ctx, [[x - 6, y + 2], [x + 4, y - 7], [x + w - 4, y - 7], [x + w + 6, y + 2], [x + w + 3, y + 4], [x + w - 4, y], [x + 4, y], [x - 3, y + 4]], col);
  rect(ctx, x + 4, y - 8, w - 8, 2, edge);
  rect(ctx, x - 7, y, 2, 2, edge);
  rect(ctx, x + w + 5, y, 2, 2, edge);
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
    disc(ctx, cx, y - 3, 5 + ((i * 7) % 4), col);
  }
  rect(ctx, x, y, w, 4, col);
  if (dark) rect(ctx, x + 2, y + 3, w - 4, 1, dark);
  if (light) rect(ctx, x + 4, y - 6, w / 3, 1, light);
}
function drawDragon(ctx, x, y, len, phase, col, accent) {
  for (let i = len; i >= 0; i--) {
    const px = x + i * 3, py = y + Math.sin(phase + i * 0.35) * 4;
    disc(ctx, px, py, i === len ? 3 : Math.max(1, 2 - (i < 4 ? 1 : 0)), col);
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
  rect(ctx, x + 2, baseY - 2, 4, 2, th.arch.stoneDark);
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
// Lanterne rouge suspendue (planche à part, animée en balancier)
function buildLanternSheet() {
  return buildSheet(12, 18, 1, (ctx) => {
    rect(ctx, 5, 0, 1, 4, PAL.black);
    rect(ctx, 2, 3, 7, 2, PAL.gold);
    ellipse(ctx, 5, 9, 4, 5, PAL.vermilion);
    rect(ctx, 2, 6, 1, 6, '#ff8a5a');
    rect(ctx, 5, 5, 1, 9, '#b8281e');
    rect(ctx, 3, 8, 1, 3, PAL.goldLight);
    rect(ctx, 2, 13, 7, 2, PAL.gold);
    rect(ctx, 5, 15, 1, 2, PAL.gold);
  });
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
//   I colonne  A portique  F cascade  Y pin  G bambous  J pavillon  R rocher
//   _  pont de pierre en arche          Q  escalier de pierre (sol)
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
      'J : combo de quatre coups. ↑+J projette en l\'air, puis J pour un combo aérien, ↓+J en l\'air pour un plongeon. Maintenez J pour charger un iaijutsu. K (maintenu) : dagues de Qi.',
      'L : ARRÊT DU TEMPS. Le monde se fige et l\'eau gèle : on peut marcher dessus ! La jauge d\'horloge s\'épuise. L pour relancer le temps.',
      'SHIFT : dash. Vous êtes invulnérable pendant le dash. Les planches fissurées s\'effondrent !',
      'Sautez contre les parois couvertes de lianes pour rebondir. Certains murs fissurés cachent des secrets...',
      'I : vague de Qi (30 Qi). Frôlez les projectiles sans être touché (GRAZE) pour recharger Qi et temps. Seul le cœur de votre corps est vulnérable.',
      'Ce lac est trop large pour être sauté : arrêtez le temps (L) et traversez sur la glace... sans traîner !',
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
        '......................o.o.o.....',
        '.......................###......',
        '......................#####.....',
        '........................F.......',
        '..................===...........',
        '..P..n.J..s....L...Y........x.G.',
        '######################____######',
        '######################~~~~######',
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
        '.Y.s..d.........G....R..^^..d.',
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
        '.G.s....................R..x...w.G',
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
        '..s..R.....................Y.d..',
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
        '..........W.......o.o.o.o.....Y...',
        '..........W...####################',
        '..........W...W###################',
        '..........W...W###################',
        '..........W...W#...........#######',
        '..s...B...W...XX..d........#######',
        '....G.........XX.....x...r.#######',
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
        '#########....w..R..x..d.s.k.J....w..',
        '####################################',
        '####################################',
        '####################################',
      ],
      [
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '..........o.o.o.o.o.o...............',
        '....................................',
        '...........g...........g............',
        '....................................',
        '....................................',
        '..Y..s....................R...d..G..',
        '######~~~~~~~~~~~~~~~~##############',
        '######~~~~~~~~~~~~~~~~##############',
        '####################################',
      ],
      [
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '.......................o.o.o........',
        '......................=====.........',
        '....................................',
        '..............-----.................',
        '....................................',
        '.......===..............g...........',
        '....................................',
        '..G....w......d....x.....w....k.Y...',
        '####################################',
        '####################################',
        '####################################',
      ],
      [
        '.................................#',
        '.................................#',
        '.................................#',
        '.................................#',
        '.................................#',
        '.................................#',
        '.................................#',
        '.........---................---..#',
        '.................................#',
        '..................---............#',
        '.................................#',
        '.LY.E..G..............Z.......G..#',
        '##################################',
        '##################################',
        '##################################',
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
        '...................tQQ########',
        '..................QQ##########',
        '.YP.n..s..t.S...QQ############',
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
        '..I.T.....w...I.......Y...b...m...',
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
        '..kY.t..........VV.......o........',
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
        '..b..Y...w.......u...R...x...m..',
        '################################',
        '################################',
        '################################',
      ],
      [
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '...........g..............g.........',
        '......................---...........',
        '.......VV....VV.....................',
        '..................CC................',
        '..b...........................m..t..',
        '#####~~~~~~~~~~~~~~~~~~~~~~#########',
        '#####~~~~~~~~~~~~~~~~~~~~~~#########',
        '####################################',
      ],
      [
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '....................m...............',
        '.................======.............',
        '....................................',
        '....................................',
        '....................................',
        '..I...u.....I.....x...u....I...k....',
        '####################################',
        '####################################',
        '####################################',
      ],
      [
        '.................................#',
        '.................................#',
        '.................................#',
        '.................................#',
        '.................................#',
        '.................................#',
        '.................................#',
        '.........---................---..#',
        '.................................#',
        '..................---............#',
        '.................................#',
        '.ks.E.....Y...........Z........t.#',
        '##################################',
        '##################################',
        '##################################',
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
      'Le bassin de la cascade gèle lui aussi quand le temps s\'arrête. Les pièces au-dessus n\'attendent que vous.',
      'Les maîtres déclenchent des CARTES DE SORT : des nuées de projectiles. Survivez sans être touché pour un bonus, et n\'oubliez pas l\'arrêt du temps !',
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
        '.RP..n..s..p...........d..Y...',
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
        '..k..L.Y...................#######',
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
        '..Y..w....p.......................',
        '##############....................',
        '##############....................',
        '########.....X....................',
        '########..r..X..B..^^^^^^^...wR...',
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
        '..k..L....Y.....d...R...w.....L...',
        '##################################',
        '##################################',
        '##################################',
      ],
      [
        '....................................',
        '....................................',
        '................F...................',
        '....................................',
        '....................................',
        '....................................',
        '.........y.................y........',
        '....................................',
        '...........o.o.o.o.o................',
        '....................................',
        '....................................',
        '..Y..s....................R.........',
        '#####~~~~~~~~~~~~~~~~~##############',
        '#####~~~~~~~~~~~~~~~~~##############',
        '####################################',
      ],
      [
        '....................................',
        '....................................',
        '....................................',
        '............................o.......',
        '...........................===......',
        '....................................',
        '......................CC............',
        '....................................',
        '..............CC....................',
        '....................................',
        '........B...........................',
        '..L.........d.............w....k....',
        '####################################',
        '####################################',
        '####################################',
      ],
      [
        '.................................#',
        '.................................#',
        '.................................#',
        '.................................#',
        '.................................#',
        '.................................#',
        '.................................#',
        '........---.................---..#',
        '.................................#',
        '..................---............#',
        '.................................#',
        '.Ls.E.....Y...........Z..........#',
        '##################################',
        '##################################',
        '##################################',
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
        '.GP..n..s..A....J.....S....d..',
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
        '..u....G....w.....R...x....w....t.',
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
        '..B..R..#.r..X....^^^^..s...k..Y',
        '################################',
        '################################',
        '################################',
      ],
      [
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '.............g...........g..........',
        '....................................',
        '..........o.o.o......o.o.o..........',
        '.........MMM.........MMM............',
        '...............---..................',
        '..x...............................w.',
        '#####~~~~~~~~~~~~~~~~~~~~~~~~~######',
        '#####~~~~~~~~~~~~~~~~~~~~~~~~~######',
        '####################################',
      ],
      [
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '....................................',
        '..................m.................',
        '............==========..............',
        '....................................',
        '....................................',
        '....................................',
        '..u....w......I......w......k..G....',
        '####################################',
        '####################################',
        '####################################',
      ],
      [
        '.................................#',
        '.................................#',
        '.................................#',
        '.................................#',
        '.................................#',
        '.................................#',
        '.................................#',
        '........---.................---..#',
        '.................................#',
        '..................---............#',
        '.................................#',
        '.t..E.................Z......G.t.#',
        '##################################',
        '##################################',
        '##################################',
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
      if (level.solidTile(t) || (t === T_ONEWAY && !b.dropThrough && prevBottom <= ty * TILE + 0.5)) {
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
    this.kx = 0;
    this.ky = 0;
  }
  kick(dx, dy) {
    this.kx += dx;
    this.ky += dy;
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
    const kd = Math.exp(-dt * 16);
    this.kx *= kd;
    this.ky *= kd;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.ox = (Math.random() * 2 - 1) * this.shakeMag;
      this.oy = (Math.random() * 2 - 1) * this.shakeMag;
    } else {
      this.ox = this.oy = 0;
      this.shakeMag = 0;
    }
  }
  get rx() { return Math.round(this.x + this.ox + this.kx); }
  get ry() { return Math.round(this.y + this.oy + this.ky); }
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
    const inCells = (tx, ty) => cells.some(([a, b]) => a === tx && b === ty);
    const sheet = buildSheet(this.w, this.h, 1, (ctx) => {
      ctx.drawImage(renderTerrain(th, (tx, ty) => level.solidAt(tx, ty), inCells, this.x, this.y, this.w, this.h), 0, 0);
      for (const [cx, cy] of cells) {
        const x = (cx - x0) * TILE, y = (cy - y0) * TILE;
        line(ctx, x + 3, y + 3, x + 7, y + 8, th.rock.crack);
        line(ctx, x + 7, y + 8, x + 5, y + 13, th.rock.crack);
        line(ctx, x + 7, y + 8, x + 12, y + 10, th.rock.crack);
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
      const inRoom = (tx, ty) => room.some(([a, b]) => a === tx && b === ty);
      const csheet = buildSheet((rx1 - rx0 + 1) * TILE, (ry1 - ry0 + 1) * TILE, 1, (ctx) => {
        ctx.drawImage(renderTerrain(th, () => true, inRoom, rx0 * TILE, ry0 * TILE, (rx1 - rx0 + 1) * TILE, (ry1 - ry0 + 1) * TILE), 0, 0);
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
    this.game.fx.burst(this.cx, this.cy, 6, [this.level.theme.rock.base, this.level.theme.rock.light], 70, 0.5, 200);
    if (this.hp <= 0) {
      this.broken = true;
      this.sprite.visible = false;
      for (const [cx, cy] of this.cells) {
        this.level.tiles[cy * this.level.w + cx] = T_EMPTY;
        for (let i = 0; i < 4; i++) this.game.fx.debris(cx * TILE + rand(0, 16), cy * TILE + rand(0, 16), this.level.theme.rock.base);
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
    g.ripple(this.x + 8, this.y + 10, 0.7, 200);
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
    super(level, 'gate', col * TILE, (8 + MAP_PAD) * TILE, TILE, 64);
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
    for (let r = 8 + MAP_PAD; r <= 11 + MAP_PAD; r++) this.level.tiles[r * this.level.w + this.col] = T_GATE;
    this.game.audio.play('gate');
    this.game.camera.shake(3, 0.4);
  }
  open() {
    this.closed = false;
    for (let r = 8 + MAP_PAD; r <= 11 + MAP_PAD; r++) this.level.tiles[r * this.level.w + this.col] = T_EMPTY;
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
    const rows = ROWS;
    const grid = [];
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (const s of secs) {
        const sw = Math.max(...s.map((x) => x.length));
        line += (s[r - MAP_PAD] || '').padEnd(sw, '.');
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
        else if (ch === '=' || ch === '-' || ch === '_') t = T_ONEWAY;
        else if (ch === 'Q') t = T_SOLID;
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
  // l'eau se fige (et devient praticable) pendant l'arrêt du temps
  solidTile(t) { return isSolidTile(t) || (t === T_HAZARD && this.theme.water && this.game.timeStopped); }
  solidAt(tx, ty) { return this.solidTile(this.tileAt(tx, ty)); }
  standableAt(tx, ty) { const t = this.tileAt(tx, ty); return isSolidTile(t) || t === T_ONEWAY; }
  groundBelow(c, r) {
    for (let rr = r + 1; rr < this.h; rr++) {
      const t = this.tileAt(c, rr);
      if (isSolidTile(t) || t === T_ONEWAY || t === T_SPIKE) return rr * TILE;
    }
    return (r + 1) * TILE;
  }
  // ---- Construction visuelle : ciel, parallaxe, nuages, morceaux de décor, animations ----
  buildVisuals() {
    const th = this.theme;
    const skyTex = canvasTexture(buildSky(this.themeName));
    this.skyMesh = new THREE.Mesh(planeGeo(W, H), new THREE.MeshBasicMaterial({ map: skyTex, depthTest: false, depthWrite: false }));
    this.skyMesh.renderOrder = 0;
    this.group.add(this.skyMesh);
    this.disposables.push(skyTex, this.skyMesh.material);
    this.layers = [];
    this.sways = [];
    this.lanterns = [];
    this.clouds = [];
    this.birds = [];
    this.shafts = [];
    this.waterfalls = [];
    const defs = buildLayers(this.themeName);
    const orders = [1, 3, 5];
    let li = 0;
    for (const d of defs) this.layers.push(new ParallaxLayer(this.group, d.c, d.fx, d.fy, d.offY, d.fg ? 30 : orders[li++], d.fg ? 0.95 : 1, d.drift || 0));
    // nuages de papier qui dérivent à différentes profondeurs
    const sizes = [[64, 22], [44, 16], [30, 12]];
    const csheets = sizes.map(([w, h], i) => buildCloudSheet(w, h, this.index * 10 + i + 1, th.cloud));
    this.ownSheets.push(...csheets);
    const crng = mulberry32(this.index * 31 + 5);
    for (let i = 0; i < 8; i++) {
      const k = i % 3, fx = [0.05, 0.12, 0.22, 0.3][i % 4];
      this.clouds.push({ sprite: new Sprite(this.group, csheets[k], fx < 0.1 ? 2 : fx < 0.2 ? 4 : 6), x: crng() * 700, y: 8 + crng() * 70 + (k === 0 ? 0 : 20), fx, speed: 3 + crng() * 6 });
    }
    if (this.themeName === 'mountain' || this.themeName === 'dragon') {
      const sheet = buildFlyingDragonSheet(this.themeName === 'mountain' ? '#3a1a22' : '#e8b040', this.themeName === 'mountain' ? '#a8322a' : '#ffe08a');
      this.ownSheets.push(sheet);
      for (let i = 0; i < 2; i++) this.flyingDragons.push({ sprite: new Sprite(this.group, sheet, 2), x: rand(0, 600), y: 30 + i * 34, speed: 14 + i * 8, phase: i });
    }
    if (th.birds) {
      this.birdSheet = buildBirdSheet(th.birds);
      this.ownSheets.push(this.birdSheet);
      for (let i = 0; i < 7; i++) {
        const s = new Sprite(this.group, this.birdSheet, 4);
        s.visible = false;
        this.birds.push({ sprite: s, ox: i * 11 + (i % 2) * 5, oy: Math.abs(i - 3) * 5 + (i % 2) * 2, ph: i * 0.7 });
      }
      this.flock = { t0: -100, y: 40, dir: 1 };
    }
    // rayons de lumière
    if (th.shafts) {
      const tex = canvasTexture(buildShaftCanvas());
    // (rayons étirés à la hauteur de l'écran)
      this.disposables.push(tex);
      for (let i = 0; i < 3; i++) {
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 });
        mat.color.setHex(th.shafts);
        const mesh = new THREE.Mesh(planeGeo(96, 180), mat);
        mesh.scale.set(1.3, H / 180, 1);
        mesh.renderOrder = 7;
        this.group.add(mesh);
        this.disposables.push(mat);
        this.shafts.push({ mesh, mat, x: 40 + i * 140, ph: i * 2.1 });
      }
    }
    // brume : un banc derrière le décor, un voile devant
    this.layers.push(new ParallaxLayer(this.group, buildMistCanvas(th.mist), 0.45, 0.35, 186, 6, th.mistAlpha, 7));
    this.layers.push(new ParallaxLayer(this.group, buildMistCanvas(th.mist), 1.15, 1.0, 264, 29, th.mistAlpha * 0.45, 16));
    this.buildChunks();
    // liquides animés (surface + reflets)
    const hzC = buildHazardCanvas(th), shC = buildShimmerCanvas(th);
    for (let r = 0; r < this.h; r++) {
      let c = 0;
      while (c < this.w) {
        if (this.tileAt(c, r) === T_HAZARD && this.tileAt(c, r - 1) !== T_HAZARD) {
          let e = c;
          while (this.tileAt(e + 1, r) === T_HAZARD && this.tileAt(e + 1, r - 1) !== T_HAZARD) e++;
          const len = (e - c + 1) * TILE;
          const hs = new ScrollStrip(this.group, hzC, c * TILE, r * TILE, len, TILE, 9, 10, 0);
          hs.isHazard = true;
          this.strips.push(hs);
          const sh = new ScrollStrip(this.group, shC, c * TILE, r * TILE, len, TILE, 9, -7, 0, 0.8);
          sh.mat.blending = THREE.AdditiveBlending;
          this.strips.push(sh);
          if (!th.water) {
            for (let x = c * TILE + 16; x < (e + 1) * TILE; x += 56) {
              const gl = new Glow(this.group, 64, hexNum(th.hazard.light), 0.22, 0.25);
              gl.setCenter(x, r * TILE + 6);
              this.glows.push(gl);
            }
          }
          c = e + 1;
        } else c++;
      }
    }
    const lanternCanvas = ART.lantern.canvas;
    const addLantern = (x, y) => {
      const s = new SwayDecor(this.group, lanternCanvas, x, y, { amp: 2, hang: true, speed: 1.8, order: 10 });
      const gl = new Glow(this.group, 48, 0xff6a3a, 0.45, 0.2);
      this.sways.push(s);
      this.lanterns.push({ s, gl, x: x + 6, y: y + 10 });
    };
    // décor animé des marqueurs
    for (const m of this.markers) {
      const x = m.c * TILE, gy = this.groundBelow(m.c, m.r);
      const seed = m.c * 131 + m.r * 7 + this.index;
      switch (m.ch) {
        case 'L': addLantern(x + 9, gy - 38); break;
        case 't': {
          const fl = new Sprite(this.group, ART.flame, 10);
          fl.setPos(x + 4, gy - 34);
          this.effects.push({ sprite: fl, flame: true, life: Infinity, x: x + 8, y: gy - 26 });
          const gl = new Glow(this.group, 64, 0xffa040, 0.55, 0.3);
          gl.setCenter(x + 8, gy - 28);
          this.glows.push(gl);
          break;
        }
        case 'Y': {
          const p = this.pineFor(seed);
          this.sways.push(new SwayDecor(this.group, p.leaves, x + 8 - p.ax, gy - p.h, { amp: 1.6, speed: 1.1, order: 8 }));
          break;
        }
        case 'G': {
          const bc = buildBamboo(seed, th.bamboo, 100 + (seed % 20));
          this.sways.push(new SwayDecor(this.group, bc, x + 8 - bc.width / 2, gy - bc.height + 1, { amp: 3, speed: 1.4, order: 7 }));
          break;
        }
        case 'J':
          addLantern(x - 12, gy - 54);
          addLantern(x + 54, gy - 54);
          break;
        case 'T':
          addLantern(x - 26, gy - 64);
          addLantern(x + 50, gy - 64);
          break;
        case 'F': {
          let bottom = m.r;
          while (bottom < this.h && !this.solidAt(m.c, bottom) && this.tileAt(m.c, bottom) !== T_HAZARD) bottom++;
          const top = m.r * TILE, h = Math.min(this.ph, bottom * TILE) - top;
          const sx = x - 4;
          this.strips.push(new ScrollStrip(this.group, buildWaterfallCanvas(th, false), sx, top, 24, h, 7, 0, 55));
          this.strips.push(new ScrollStrip(this.group, buildWaterfallCanvas(th, true), sx, top, 24, h, 7, 0, 95));
          const wf = { x: sx + 12, y: top + h, top, splash: null };
          if (bottom < this.h) {
            if (!this.splashSheet) { this.splashSheet = buildSplashSheet(th); this.ownSheets.push(this.splashSheet); }
            wf.splash = new Sprite(this.group, this.splashSheet, 10);
            wf.splash.setPos(sx - 8, top + h - 10);
            const gl = new Glow(this.group, 72, 0xffffff, 0.18, 0.3);
            gl.setCenter(sx + 12, top + h - 2);
            this.glows.push(gl);
          }
          this.waterfalls.push(wf);
          break;
        }
      }
    }
  }
  pineFor(seed) {
    this.pineCache = this.pineCache || new Map();
    if (!this.pineCache.has(seed)) this.pineCache.set(seed, buildPine(seed, this.theme.pine, 0.95 + (seed % 5) * 0.05));
    return this.pineCache.get(seed);
  }
  buildChunks() {
    const th = this.theme, CW = 256;
    const decor = [], post = [];
    const add = (x0, x1, draw) => decor.push({ x0, x1, draw });
    const addPost = (x0, x1, draw) => post.push({ x0, x1, draw });
    const rngA = mulberry32(this.index * 1000 + 3);
    const style = th.top.style;
    // petits décors automatiques sur les surfaces
    for (let c = 0; c < this.w; c++) {
      for (let r = 1; r < this.h; r++) {
        if (this.tileAt(c, r) !== T_SOLID || this.tileAt(c, r - 1) !== T_EMPTY || this.grid[r][c] === 'Q') continue;
        const x = c * TILE, y = r * TILE, roll = rngA(), seed = c * 97 + r;
        if (roll < 0.09) add(x - 2, x + 22, (ctx) => drawBoulder(ctx, x, y + 2, 14 + (seed % 8), 9 + (seed % 5), th, seed));
        else if (roll < 0.15 && style === 'moss') {
          add(x, x + 16, (ctx) => {
            for (let k = 0; k < 5; k++) line(ctx, x + 8, y, x + 3 + k * 2.5, y - 4 - (k % 2) * 2, k % 2 ? th.top.light : th.top.a);
          });
        } else if (roll < 0.2 && style !== 'gold') {
          add(x, x + 16, (ctx) => { rect(ctx, x + 6, y - 6, 1, 6, th.top.dark); rect(ctx, x + 5, y - 7, 3, 2, th.top.flower); });
        } else if (roll < 0.25 && style === 'gold') {
          add(x, x + 16, (ctx) => { rect(ctx, x + 1, y - 10, 2, 10, PAL.gold); rect(ctx, x + 13, y - 10, 2, 10, PAL.gold); rect(ctx, x, y - 10, 16, 2, PAL.goldLight); rect(ctx, x, y - 5, 16, 1, PAL.goldDark); });
        }
      }
    }
    // décor des marqueurs
    for (const m of this.markers) {
      const x = m.c * TILE, gy = this.groundBelow(m.c, m.r);
      const seed = m.c * 131 + m.r * 7 + this.index;
      switch (m.ch) {
        case 'L': add(x, x + 18, (ctx) => drawLanternPost(ctx, x, gy, th)); break;
        case 't': add(x, x + 16, (ctx) => drawTorchStand(ctx, x, gy)); break;
        case 'T': add(x - 34, x + 64, (ctx) => drawShrine(ctx, x - 30, gy, th.arch)); break;
        case 'J': add(x - 16, x + 80, (ctx) => drawPavilion(ctx, x - 4, gy, th.arch)); break;
        case 'p': add(x - 16, x + 40, (ctx) => drawPagoda(ctx, x - 8, gy, 3, th.arch.pillar, th.arch.roof, th.arch.gold)); break;
        case 'S': add(x - 10, x + 30, (ctx) => drawDragonStatue(ctx, x - 8, gy, this.themeName === 'dragon' ? '#c8902a' : th.arch.stone, this.themeName === 'dragon' ? PAL.goldLight : th.arch.stoneLight, PAL.jade)); break;
        case 'I': add(x, x + 16, (ctx) => drawColumn(ctx, x + 3, 0, gy, th.arch.pillar, th.arch.gold)); break;
        case 'A': add(x - 26, x + 34, (ctx) => drawPaifang(ctx, x - 20, gy, th.arch.pillar, th.arch.roof, th.arch.gold)); break;
        case 'b': add(x - 8, x + 24, (ctx) => drawBellFrame(ctx, x - 5, gy, th)); break;
        case 'R': add(x - 8, x + 36, (ctx) => drawBoulder(ctx, x - 6, gy + 2, 30, 20, th, seed)); break;
        case 'Y': {
          const p = this.pineFor(seed);
          add(x + 8 - p.ax, x + 8 - p.ax + p.w, (ctx) => ctx.drawImage(p.trunk, x + 8 - p.ax, gy - p.h));
          break;
        }
        case 'F':
          if (!this.solidAt(m.c, m.r - 1)) addPost(x - 16, x + 36, (ctx) => drawBoulder(ctx, x - 10, m.r * TILE + 4, 36, 14, th, seed));
          break;
      }
    }
    // ponts de pierre en arche (suites de « _ »)
    for (let r = 0; r < this.h; r++) {
      let c = 0;
      while (c < this.w) {
        if (this.grid[r][c] === '_') {
          let e = c;
          while (this.grid[r][e + 1] === '_') e++;
          const x0 = c * TILE, x1 = (e + 1) * TILE;
          const gl = this.groundBelow(c, r), gr = this.groundBelow(e, r);
          addPost(x0 - 4, x1 + 4, (ctx) => drawArchBridge(ctx, x0, x1, r * TILE, Math.min(this.ph, gl), Math.min(this.ph, gr), th.arch));
          c = e + 1;
        } else c++;
      }
    }
    const isSolid = (tx, ty) => this.solidAt(tx, ty) && tx >= 0 && tx < this.w;
    const paint = (tx, ty) => {
      const t = this.tileAt(tx, ty);
      return tx >= 0 && tx < this.w && ((t === T_SOLID && this.grid[ty][tx] !== 'Q') || t === T_WALL);
    };
    const n = Math.ceil(this.pw / CW);
    for (let i = 0; i < n; i++) {
      const [c, ctx] = makeCanvas(CW, this.ph);
      ctx.save();
      ctx.translate(-i * CW, 0);
      for (const d of decor) if (d.x1 >= i * CW && d.x0 <= (i + 1) * CW) d.draw(ctx);
      ctx.drawImage(renderTerrain(th, isSolid, paint, i * CW, 0, CW, this.ph), i * CW, 0);
      const c0 = i * (CW / TILE), c1 = Math.min(this.w, c0 + CW / TILE);
      for (let r = 0; r < this.h; r++) {
        for (let col = c0; col < c1; col++) {
          const t = this.tileAt(col, r), x = col * TILE, y = r * TILE;
          const rng = mulberry32(col * 7919 + r * 131 + this.index);
          const ch = this.grid[r][col];
          if (t === T_WALL) drawWallOverlay(ctx, th, x, y, rng);
          else if (ch === 'Q') drawStairTile(ctx, th, x, y, !this.solidAt(col, r - 1));
          else if (t === T_ONEWAY) {
            if (ch === '-') drawSuspendedTile(ctx, th, x, y, col % 3 === 0 || this.grid[r][col - 1] !== '-' || this.grid[r][col + 1] !== '-');
            else if (ch === '=') drawBridgeTile(ctx, th, x, y, this.grid[r][col - 1] !== '=', this.grid[r][col + 1] !== '=');
          } else if (t === T_SPIKE) drawSpikeTile(ctx, th, x, y);
          else if (t === T_HAZARD && this.tileAt(col, r - 1) === T_HAZARD) {
            rect(ctx, x, y, TILE, TILE, th.hazard.deep);
            if (hash2(col, r, 9) < 0.5) rect(ctx, x + Math.floor(hash2(col, r, 8) * 12), y + 6, 3, 1, th.hazard.mid);
          }
        }
      }
      for (const d of post) if (d.x1 >= i * CW && d.x0 <= (i + 1) * CW) d.draw(ctx);
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
    const stopped = this.game.timeStopped;
    if (!stopped) this.time += dt;
    if (!this.showcase) this.stats.time += dt;
    if (!stopped) for (const p of this.platforms) { p.update(dt); }
    else for (const p of this.platforms) { p.dx = 0; p.dy = 0; }
    if (this.player) this.player.update(dt);
    if (!stopped) {
      for (const e of this.enemies) e.update(dt);
      if (this.boss) this.boss.update(dt);
    }
    for (const p of this.projectiles) p.update(dt);
    if (!stopped) for (const s of this.strikes) s.update(dt);
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
    if (!stopped) this.ambient(dt);
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
        if (p) { p.wob = 30; p.wobF = 2.5; p.wobP = rand(0, 6); }
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
    if (this.theme.petals && Math.random() < dt * 4) {
      const p = fx.normal.spawn(cx + rand(-20, W + 60), cy - 4, rand(-30, -10), rand(14, 26), 9, Math.random() < 0.5 ? 2 : 1, hexNum(this.theme.petals));
      if (p) { p.wob = 40; p.wobF = rand(1.5, 3); p.wobP = rand(0, 6); }
    }
    for (const w of this.waterfalls) {
      if (w.x < cx - 40 || w.x > cx + W + 40) continue;
      if (w.y < this.ph - 2) {
        for (let k = 0; k < 2; k++) {
          const p = fx.normal.spawn(w.x + rand(-11, 11), w.y - 2, rand(-45, 45), rand(-90, -20), rand(0.4, 0.8), 1, Math.random() < 0.7 ? 0xffffff : hexNum(this.theme.hazard.light));
          if (p) p.grav = 260;
        }
        if (Math.random() < 0.35) {
          const m = fx.add.spawn(w.x + rand(-14, 14), w.y - rand(2, 8), rand(-10, 10), rand(-22, -8), rand(1, 1.8), 3, 0x6a7a7a);
          if (m) { m.drag = 0.5; m.wob = 10; m.wobF = 2; }
        }
      }
      if (Math.random() < 0.3) fx.add.spawn(w.x + rand(-10, 10), rand(w.top, w.y), 0, rand(40, 80), 0.3, 1, 0xffffff);
    }
  }
  // Positionne les éléments liés à la caméra (ciel, parallaxe, nuages, oiseaux, lueurs)
  syncView(cam) {
    const x = cam.rx, y = cam.ry, t = this.time;
    this.skyMesh.position.set(x, -y, 0);
    for (const l of this.layers) l.update(x, y, t);
    for (const s of this.strips) {
      s.update(t);
      if (s.isHazard && this.theme.water) s.mat.color.setHex(this.game.timeStopped ? 0xe8fbff : 0xffffff);
    }
    for (const gl of this.glows) gl.update(t);
    const gust = Math.pow(Math.max(0, Math.sin(t * 0.37)), 6);
    for (const s of this.sways) s.update(t, gust);
    for (const l of this.lanterns) {
      l.gl.setCenter(l.x + l.s.swing(t), l.y);
      l.gl.update(t);
    }
    for (const c of this.clouds) {
      const span = W + 160;
      let sx = (c.x - x * c.fx + t * c.speed) % span;
      if (sx < 0) sx += span;
      c.sprite.setPos(x + sx - 80, y + c.y - (y - (this.ph - H)) * c.fx);
    }
    for (const d of this.flyingDragons) {
      const span = W + 420;
      const sx = W + 140 - ((t * d.speed + d.phase * 300) % span);
      d.sprite.setFrame(Math.floor(t * 6 + d.phase) % 4);
      d.sprite.setPos(x + sx, y + d.y + Math.sin(t + d.phase) * 6);
    }
    if (this.birds.length) {
      const cycle = 17, k = Math.floor(t / cycle), local = t % cycle;
      const dir = k % 2 ? -1 : 1, active = local < 12;
      const fxs = dir > 0 ? -70 + local * 36 : W + 70 - local * 36;
      const fy = 26 + (k % 3) * 14 + Math.sin(local * 0.6) * 6;
      for (const b of this.birds) {
        b.sprite.visible = active;
        if (!active) continue;
        b.sprite.setFrame(Math.floor(t * 5 + b.ph) % 2);
        b.sprite.setFlip(dir < 0);
        b.sprite.setPos(x + fxs - b.ox * dir, y + fy + b.oy + Math.sin(t * 2 + b.ph) * 2);
      }
    }
    for (const s of this.shafts) {
      const span = W + 96;
      const sx = ((((s.x - x * 0.2) % span) + span) % span) - 96;
      s.mesh.position.set(x + sx, -y, 0);
      s.mat.opacity = 0.18 + 0.16 * Math.sin(t * 0.45 + s.ph);
    }
    for (const w of this.waterfalls) if (w.splash) w.splash.setFrame(Math.floor(t * 12) % 4);
  }
  dispose() {
    const all = [this.enemies, this.projectiles, this.pickups, this.objects, this.platforms.map((p) => p.sprite), this.strikes, this.glows, this.strips, this.layers, this.sways,
      this.lanterns.map((l) => l.gl), this.clouds.map((c) => c.sprite), this.birds.map((b) => b.sprite), this.waterfalls.filter((w) => w.splash).map((w) => w.splash)];
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
// Répertoire de coups. Angles en radians (0 = devant, positif = vers le bas).
//  frames : images de la planche ATTACK (ou RUN si anim: 'run'), active : fenêtre de coup
//  arc : [r0, r1, a0, a1] traînée de lame ; line : [longueur, épaisseur] estoc
const MOVES = {
  g1: { frames: [2, 3, 4, 5, 6], fps: 30, active: [1, 3], dmg: 1, kb: 110, lunge: 120, arc: [8, 38, -2.1, 0.75], dur: 0.1, ox: 3, oy: 12, next: 'g2', sfx: 'attack', kick: 2 },
  g2: { frames: [4, 5, 6, 6], fps: 26, active: [0, 2], dmg: 1, kb: 130, lunge: 140, arc: [8, 38, 1.05, -1.7], dur: 0.1, ox: 3, oy: 12, next: 'g3', sfx: 'attack', kick: 2, colors: ['#4aa8d8', '#bfeeff', '#ffffff'] },
  g3: { frames: [4, 4, 5, 5, 6], anim: 'run', runFrames: [4, 4, 4, 5, 5], fps: 26, active: [0, 3], dmg: 1.3, kb: 200, lunge: 360, lungeT: 0.11, line: [70, 9], dur: 0.08, ox: -6, oy: 13, next: 'g4', sfx: 'attack3', kick: 5, ghosts: true, colors: ['#4aa8d8', '#e8faff', '#ffffff'] },
  g4: { frames: [3, 4, 5, 6, 5, 6, 6], fps: 22, active: [1, 5], dmg: 1.7, kb: 300, lunge: 70, spin: true, arc: [6, 46, -1.6, -1.6 + Math.PI * 2.2], dur: 0.24, tail: 0.5, ox: 0, oy: 13, multi: true, sfx: 'attack3', shake: 4, stop: 0.1, ripple: 1.3, kick: 4, colors: ['#f2b53a', '#ffe08a', '#ffffff'] },
  up: { frames: [3, 4, 5, 6, 6], fps: 24, active: [1, 3], dmg: 1.3, kb: 50, launch: true, hop: -300, arc: [8, 44, 2.3, -1.5], dur: 0.13, ox: 2, oy: 14, next: 'a1', sfx: 'attack3', kickY: -4, stop: 0.07, colors: ['#f2b53a', '#ffe08a', '#ffffff'] },
  a1: { frames: [3, 4, 5, 6], fps: 28, active: [1, 2], dmg: 1, kb: 80, juggle: true, arc: [8, 38, -1.9, 0.9], dur: 0.1, ox: 2, oy: 12, next: 'a2', sfx: 'attack', air: true, kick: 2 },
  a2: { frames: [4, 5, 6, 6], fps: 26, active: [0, 2], dmg: 1, kb: 80, juggle: true, arc: [8, 38, 1.0, -1.8], dur: 0.1, ox: 2, oy: 12, next: 'a3', sfx: 'attack', air: true, kick: 2, colors: ['#4aa8d8', '#bfeeff', '#ffffff'] },
  a3: { frames: [2, 3, 4, 5, 6, 6], fps: 22, active: [2, 4], dmg: 1.6, kb: 220, spike: true, arc: [6, 50, -2.6, 1.7], dur: 0.15, ox: 0, oy: 12, sfx: 'attack3', air: true, shake: 3, stop: 0.08, kick: 3, colors: ['#f2b53a', '#ffe08a', '#ffffff'] },
  dash: { frames: [4, 5, 6, 6], fps: 22, active: [0, 3], dmg: 1.4, kb: 180, arc: [10, 46, -0.7, 0.55], dur: 0.12, ox: -4, oy: 13, sfx: 'attack3', pierce: true, kick: 4, colors: ['#4aa8d8', '#e8faff', '#ffffff'] },
};

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
    this.comboCd = 0;
    this.airMoves = 0;
    this.charge = -1;
    this.charged = false;
    this.plunging = false;
    this.lungeT = 0;
    this.qiCd = 0;
    this.casting = 0;
    this.knifeCd = 0;
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
    this.hiddenT = 0;
    this.sprite = new Sprite(level.group, ART.player, 14);
    this.aura = new Glow(level.group, 56, 0x7fe3ff, 0.12, 0.1);
    this.ghosts = [];
    for (let i = 0; i < 12; i++) {
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
      const target = ax * CONFIG.RUN_SPEED * (attacking ? 0.2 : this.charge >= 0 ? 0.25 : 1);
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
      if (this.plunging) this.vy = this.plungeT > 0.06 ? 560 : -70;
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
    // --- Attaques au sabre ---
    this.holdT = !locked && inp.held('attack') ? (this.holdT || 0) + dt : 0;
    this.iaiPose = (this.iaiPose || 0) - dt;
    if (!locked && inp.hit('attack') && this.hurtT <= 0 && !this.plunging) {
      if (this.dashT > 0) { this.dashT = Math.max(this.dashT, 0.13); this.startMove('dash'); }
      else if (!this.onGround && inp.held('down') && !this.attack) this.startPlunge();
      else if (this.attack) this.attack.queued = true;
      else if (this.comboCd <= 0) {
        if (this.onGround) this.startMove(inp.held('up') ? 'up' : 'g1');
        else if (this.airMoves < 4) this.startMove('a1');
      }
    }
    if (this.attack) this.updateAttack(dt);
    this.updateCharge(dt, locked);
    if (this.plunging) this.updatePlunge(dt);
    if (this.lungeT > 0) {
      this.lungeT -= dt;
      this.vx = this.facing * MOVES.g3.lunge;
      if (Math.random() < 0.8) g.fx.dust(this.cx - this.facing * 6, this.y + this.h, 1);
    }
    // --- Pouvoir spécial : vague de Qi ---
    this.knifeCd -= dt;
    if (!locked && inp.held('special') && this.knifeCd <= 0 && this.dashT <= 0 && this.hurtT <= 0) this.throwKnife(inp.held('up'));
    if (!locked && inp.hit('qiwave') && this.dashT <= 0) this.special();
    if (!locked && inp.hit('timestop')) g.toggleTimeStop();
    // --- Physique ---
    const prevVy = this.vy;
    const res = moveBody(this, lv, dt);
    if (res.platform) res.platform.onStand(this);
    if (this.plunging && this.onGround) this.plungeImpact();
    if (this.onGround) {
      this.airMoves = 0;
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
      if (!this.standingOn && isSolidTile(lv.tileAt(Math.floor(this.x / TILE), ty)) && isSolidTile(lv.tileAt(Math.floor((this.x + this.w) / TILE), ty)) && this.invuln < 0.5) {
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
  startMove(name) {
    const g = this.game, def = MOVES[name];
    if (def.air) this.airMoves++;
    this.attack = { name, def, t: 0, hits: new Set(), queued: false, half: false, ghostT: 0 };
    this.charge = -1;
    this.charged = false;
    if (this.onGround && def.lunge && !def.lungeT) this.vx = this.facing * def.lunge;
    if (def.lungeT) this.lungeT = def.lungeT;
    if (!this.onGround && name !== 'dash') this.vy = Math.min(this.vy, def.air ? -40 : 20);
    if (def.hop) { this.vy = def.hop; this.onGround = false; this.standingOn = null; this.coyote = 0; }
    g.audio.play(def.sfx);
    const delay = def.active[0] / def.fps;
    const follow = () => [this.cx + this.facing * def.ox, this.y + def.oy];
    const trail = new SlashTrail(this.level.group, { arc: def.arc, line: def.line, flip: this.facing < 0, dur: def.dur, fade: 0.14, tail: def.tail || 0.75, colors: def.colors, follow });
    trail.mesh.visible = delay <= 0;
    const fx = { sprite: trail, life: delay + trail.total, t: 0 };
    fx.update = (e, dt) => {
      if (e.t < delay) return;
      trail.mesh.visible = true;
      trail.step(dt);
    };
    this.level.effects.push(fx);
  }
  attackBox(def) {
    const ox = this.cx + this.facing * def.ox, oy = this.y + def.oy;
    if (def.line) {
      const len = def.line[0];
      return { x: this.facing > 0 ? ox : ox - len, y: oy - 11, w: len, h: 22 };
    }
    const [, r1, a0, a1] = def.arc;
    if (Math.abs(a1 - a0) >= Math.PI * 1.9) return { x: ox - r1, y: oy - r1, w: r1 * 2, h: r1 * 2 };
    let x0 = ox, x1 = ox, y0 = oy, y1 = oy;
    for (let k = 0; k <= 10; k++) {
      const a = a0 + ((a1 - a0) * k) / 10;
      const px = ox + Math.cos(a) * r1 * this.facing, py = oy + Math.sin(a) * r1;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  updateAttack(dt) {
    const a = this.attack, d = a.def, g = this.game;
    a.t += dt;
    const fi = Math.floor(a.t * d.fps);
    if (fi >= d.active[0] && fi <= d.active[1]) {
      if (d.multi && !a.half && fi >= Math.floor((d.active[0] + d.active[1]) / 2) + 1) { a.half = true; a.hits.clear(); }
      this.applyHits(this.attackBox(d), g.damage * d.dmg, d, a.hits);
    }
    a.ghostT -= dt;
    if ((d.ghosts || d.spin || d.hop || d.spike) && a.ghostT <= 0) { a.ghostT = 0.035; this.spawnGhost(0.2); }
    const dur = d.frames.length / d.fps;
    if (a.queued && a.t > dur * 0.5 && d.next) {
      let nx = d.next;
      if (!this.onGround && nx.startsWith('g')) nx = 'a1';
      if (nx === 'a1' && this.airMoves >= 4) nx = null;
      if (nx) { this.startMove(nx); return; }
    }
    if (a.t >= dur) {
      this.attack = null;
      if (a.name === 'g4' || a.name === 'a3') this.comboCd = 0.16;
    }
  }
  // Charge (maintenir J après un coup) puis iaijutsu : traversée éclair et entailles différées
  updateCharge(dt, locked) {
    const g = this.game;
    const holding = !locked && g.input.held('attack');
    if (this.charge < 0) {
      if (holding && !this.attack && this.onGround && this.dashT <= 0 && this.hurtT <= 0 && this.holdT > 0.22) this.charge = 0;
      return;
    }
    if (!this.onGround || this.hurtT > 0 || this.dashT > 0) { this.charge = -1; this.charged = false; return; }
    if (holding) {
      this.charge += dt;
      if (Math.random() < 0.8) {
        const a = rand(0, Math.PI * 2), r = rand(22, 34);
        const pr = g.fx.add.spawn(this.cx + Math.cos(a) * r, this.cy + Math.sin(a) * r, -Math.cos(a) * r * 3, -Math.sin(a) * r * 3, 0.3, 1, this.charge > 0.55 ? 0xffe08a : 0x7fe3ff);
        if (pr) pr.shrink = true;
      }
      if (!this.charged && this.charge > 0.55) {
        this.charged = true;
        g.audio.play('charged');
        g.fx.ring(this.cx, this.cy, PAL.goldLight, 16);
        g.ripple(this.cx, this.cy, 0.5, 200);
      }
    } else {
      const ok = this.charged;
      this.charge = -1;
      this.charged = false;
      if (ok) this.iai();
    }
  }
  iai() {
    const g = this.game, lv = this.level, dir = this.facing;
    const sx = this.x;
    let dist = 0;
    for (; dist < 156; dist += 4) {
      const nx = sx + dir * (dist + 4);
      const tx = Math.floor((dir > 0 ? nx + this.w : nx) / TILE);
      let blocked = false;
      for (let yy = this.y + 2; yy < this.y + this.h - 1; yy += 8) if (lv.solidAt(tx, Math.floor(yy / TILE))) blocked = true;
      if (blocked) break;
    }
    const ex = sx + dir * dist;
    const box = { x: Math.min(sx, ex) - 6, y: this.y - 8, w: Math.abs(ex - sx) + this.w + 12, h: this.h + 12 };
    const pool = lv.boss ? lv.enemies.concat(lv.boss.hurtTargets()) : lv.enemies;
    const targets = pool.filter((e) => !e.dead && overlap(box, e.hitbox()));
    for (let k = 0; k < 8; k++) {
      this.x = sx + ((ex - sx) * k) / 8;
      this.placeSprite();
      this.sprite.setFrame(PLAYER_ANIMS.run.start + 4);
      this.spawnGhost(0.4);
    }
    this.x = ex;
    this.vx = dir * 50;
    this.invuln = Math.max(this.invuln, 0.5);
    this.iaiPose = 0.5;
    const trail = new SlashTrail(lv.group, { line: [Math.abs(ex - sx) + 26, 5], flip: dir < 0, dur: 0.05, fade: 0.5, tail: 1.2, colors: ['#e0412b', '#ffd8c8', '#ffffff'], x: sx + this.w / 2 - dir * 12, y: this.y + 15, order: 16 });
    lv.effects.push({ sprite: trail, life: trail.total, t: 0, update: (e, dt) => trail.step(dt) });
    g.audio.play('iai');
    g.flash(0xffffff, 0.3);
    g.post.aberr = 2.5;
    g.slowmo = 0.3;
    g.camera.kick(dir * 7, 0);
    const dmg = 8 + g.upg.dmg * 2;
    g.later(0.32, () => {
      if (this.level !== lv) return;
      for (const e of targets) {
        if (e.dead) continue;
        const hb = e.hitbox(), cx = hb.x + hb.w / 2, cy = hb.y + hb.h / 2;
        for (let k = 0; k < 3; k++) spawnFx(lv, ART.cutLine, cx + rand(-5, 5), cy + rand(-7, 7), { rot: rand(-1.2, 1.2), dur: 0.22, delay: k * 0.05 });
        spawnFx(lv, ART.hitStar, cx, cy, { dur: 0.25, scale: 1.6 });
        e.hurt(dmg, dir, 260, { launch: true, stop: 0.12 });
        g.fx.sparks(cx, cy, dir);
        g.fx.burst(cx, cy, 14, [PAL.vermilion, PAL.white, PAL.goldLight], 160, 0.5);
        g.ripple(cx, cy, 1.4, 260);
      }
      if (targets.length) {
        g.audio.play('attack3');
        g.audio.play('hit');
        g.camera.shake(6, 0.3);
        g.hitstop = 0.12;
        g.flash(0xffffff, 0.2);
        g.gainQi(10);
      }
    });
  }
  // Plongeon (↓ + J en l'air) : chute éclair puis onde de choc à l'atterrissage
  startPlunge() {
    const g = this.game;
    this.plunging = true;
    this.plungeT = 0;
    this.plungeHits = new Set();
    this.vx = this.facing * 20;
    g.audio.play('dash');
    const trail = new SlashTrail(this.level.group, { line: [46, 9], dur: 0.08, fade: 0.25, tail: 0.9, colors: ['#f2b53a', '#ffe08a', '#ffffff'], follow: () => [this.cx, this.y + 4] });
    trail.mesh.rotation.z = Math.PI / 2;
    this.level.effects.push({ sprite: trail, life: 0.9, t: 0, update: (e, dt) => { if (this.plunging) trail.t = Math.min(trail.t, trail.dur); trail.step(dt); } });
  }
  updatePlunge(dt) {
    this.plungeT += dt;
    this.vx = approach(this.vx, 0, 200 * dt);
    this.afterT -= dt;
    if (this.afterT <= 0) { this.afterT = 0.03; this.spawnGhost(0.18); }
    this.applyHits({ x: this.x - 4, y: this.y + this.h - 6, w: this.w + 8, h: 16 }, this.game.damage, { kb: 40, spike: true, stop: 0.03 }, this.plungeHits);
  }
  plungeImpact() {
    const g = this.game, lv = this.level;
    this.plunging = false;
    const fy = this.y + this.h;
    this.applyHits({ x: this.cx - 58, y: fy - 34, w: 116, h: 38 }, g.damage * 2.2, { kb: 170, launch: true, stop: 0.1, shake: 6, ripple: 0, kick: 0, kickY: 5 }, new Set());
    g.audio.play('slam');
    g.ripple(this.cx, fy, 1.9, 300);
    g.camera.shake(5, 0.3);
    g.camera.kick(0, 6);
    g.fx.dust(this.cx, fy, 22);
    spawnFx(lv, ART.hitStar, this.cx, fy - 4, { dur: 0.22, scale: 2 });
    for (const d of [-1, 1]) {
      spawnFx(lv, ART.cutLine, this.cx + d * 30, fy - 2, { dur: 0.25, rot: 0, scale: 1 });
      for (let k = 0; k < 8; k++) {
        const pr = g.fx.add.spawn(this.cx + d * k * 6, fy - 1, d * rand(80, 200), rand(-120, -20), rand(0.3, 0.6), 2, pick([0xffe08a, 0xf2b53a, 0xffffff]));
        if (pr) pr.grav = 500;
      }
    }
    this.comboCd = 0.12;
  }
  // Applique les dégâts d'une zone d'attaque du joueur à tout ce qui est touchable
  applyHits(box, dmg, def, hits) {
    const g = this.game, lv = this.level;
    let hit = false;
    const targets = lv.boss ? lv.enemies.concat(lv.boss.hurtTargets()) : lv.enemies;
    for (const e of targets) {
      if (e.dead || hits.has(e) || !overlap(box, e.hitbox())) continue;
      hits.add(e);
      if (e.hurt(dmg, this.facing, def.kb, def)) {
        hit = true;
        const hb = e.hitbox();
        const hx = clamp(box.x + box.w / 2, hb.x, hb.x + hb.w), hy = hb.y + hb.h / 2;
        g.fx.sparks(hx, hy, this.facing);
        spawnFx(lv, ART.hitStar, hx, hy, { dur: 0.18, rot: Math.random() * 6, scale: def.stop > 0.06 ? 1.5 : 1 });
        const swing = def.line ? 0 : def.arc ? (def.arc[3] > def.arc[2] ? 0.75 : -0.75) * this.facing : 0;
        spawnFx(lv, ART.cutLine, hb.x + hb.w / 2, hy, { dur: 0.16, rot: -swing + rand(-0.2, 0.2) });
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
      g.hitstop = Math.max(g.hitstop, def.stop || 0.05);
      if (def.shake) g.camera.shake(def.shake, 0.18);
      g.camera.kick(this.facing * (def.kick || 2), def.kickY || 0);
      if (def.ripple) g.ripple(this.cx + this.facing * 20, this.cy, def.ripple, 240);
      g.gainQi(4);
      if (!this.onGround && !this.plunging) this.vy = Math.min(this.vy, -70);
    }
    return hit;
  }
  dashStrike() {
    const box = { x: this.x - 4, y: this.y, w: this.w + 8, h: this.h };
    this.applyHits(box, this.game.damage, { kb: 140, stop: 0.03 }, this.dashHits);
  }
  // Dagues de Qi lancées en rafale (maintenir K ; ↑ pour viser en diagonale)
  throwKnife(up) {
    const g = this.game;
    const cost = 3;
    if (g.qi < cost) {
      this.knifeCd = 0.3;
      g.qiFlash = 0.3;
      g.audio.play('noQi');
      return;
    }
    g.qi -= cost;
    this.knifeCd = 0.12;
    this.casting = 0.12;
    this.attack = null;
    const x = this.facing > 0 ? this.x + this.w - 2 : this.x - 14;
    const p = new Projectile(this.level, 'dagger', x, this.y + 8 - (up ? 4 : 0), this.facing * (up ? 280 : 380), up ? -260 : 0, 'player', 1 + g.upg.dmg * 0.5);
    p.life = 0.75;
    this.level.addProjectile(p);
    g.audio.play('dagger');
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
    g.ripple(this.cx + this.facing * 12, this.cy, 0.9, 260);
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
    if (g.spell) g.spell.bonus = false;
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
    g.post.aberr = 2.5;
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
        if (tile === T_HAZARD && !lv.solidTile(tile) && this.y + this.h > ty * TILE + 5) return this.hazardHit(true);
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
    g.resumeTime(true);
    this.dead = true;
    this.deathT = 0;
    this.attack = null;
    g.hp = 0;
    this.vx *= 0.3;
    g.audio.play('death');
    g.camera.shake(5, 0.4);
    g.ripple(this.cx, this.cy, 1.2, 160);
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
  spawnGhost(life = 0.22) {
    const gh = this.ghosts.find((x) => x.life <= 0) || this.ghosts[0];
    gh.life = gh.max = life;
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
      const d = this.attack.def, i = Math.min(d.frames.length - 1, Math.floor(this.attack.t * d.fps));
      frame = d.anim === 'run' ? A.run.start + d.runFrames[i] : A.attack.start + d.frames[i];
    } else if (this.plunging) frame = A.attack.start + 6;
    else if (this.iaiPose > 0) frame = A.attack.start + (this.iaiPose > 0.25 ? 6 : 5);
    else if (this.charge >= 0) frame = A.attack.start + (Math.floor(this.charge * 8) % 2);
    else if (this.dashT > 0) frame = A.run.start + 4;
    else if (!this.onGround) {
      if (this.wallSlide) frame = A.idle.start;
      else frame = A.run.start + (this.vy < -40 ? 3 : this.vy < 60 ? 2 : 11);
    } else if (Math.abs(this.vx) > 12) {
      const speed = Math.abs(this.vx) / CONFIG.RUN_SPEED;
      frame = A.run.start + (Math.floor(this.animT * A.run.fps * Math.max(0.5, speed)) % A.run.n);
    } else frame = A.idle.start + (Math.floor(this.animT * A.idle.fps) % A.idle.n);
    this.sprite.setFrame(frame);
    let flip = this.wallSlide ? this.wallDir > 0 : this.facing < 0;
    if (this.attack && this.attack.def.spin && Math.floor(this.attack.t / 0.045) % 2) flip = !flip;
    this.sprite.setFlip(flip);
    const blink = this.invuln > 0 && this.dashT <= 0 && this.iaiPose <= 0 && Math.floor(this.invuln * 16) % 2 === 0;
    this.sprite.visible = !blink;
    if (this.hurtT > 0) this.sprite.setFlash(0.5, 0xff4040);
    else if (this.charge >= 0) this.sprite.setFlash(this.charged ? 0.25 + 0.25 * Math.sin(this.charge * 30) : 0.12, this.charged ? 0xffe08a : 0x7fe3ff);
    else this.sprite.setFlash(0, 0xffffff);
    this.placeSprite();
    for (const gh of this.ghosts) {
      if (gh.life > 0) {
        gh.life -= dt;
        gh.s.setOpacity(Math.max(0, gh.life / (gh.max || 0.22)) * 0.7);
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
  hurt(dmg, dir, kb, o = {}) {
    if (this.dead) return false;
    if (this.invulnerable) {
      this.game.audio.play('land');
      return false;
    }
    this.hp -= dmg;
    this.flashT = 0.12;
    this.game.popDamage(this.cx, this.y - 4, dmg, !!(o.stop && o.stop > 0.06));
    const resist = this.cfg.heavy ? 0.25 : 1;
    this.vx = dir * kb * resist;
    if (!this.flying && this.onGround && !this.cfg.heavy) this.vy = -kb * 0.45;
    if (this.flying) this.vy = -kb * 0.2;
    if (!this.cfg.heavy) {
      if (o.launch) { this.vy = this.flying ? -200 : -340; this.onGround = false; this.vx = dir * 30; }
      else if (o.spike && !this.onGround) this.vy = 380;
      else if (o.juggle && !this.onGround) { this.vy = Math.min(this.vy, -150); this.vx = dir * 40; }
    }
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
    g.ripple(this.cx, this.cy, 0.35, 180);
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
      this.vx = approach(this.vx, 0, (this.onGround ? 500 : 120) * dt);
      const airborne = !this.flying && !this.onGround;
      if (this.stateT > 0.28 && !(airborne && this.stateT < 1.6)) this.setState('chase');
      if (this.flying) { this.x += this.vx * dt; this.y += this.vy * dt; this.vy = approach(this.vy, 0, 300 * dt); }
      else {
        // en l'air après un coup ascendant : gravité adoucie pour les jongles
        this.vy = Math.min(this.vy + CONFIG.GRAVITY * 0.55 * dt, CONFIG.MAX_FALL);
        const was = this.onGround;
        moveBody(this, this.level, dt);
        if (this.onGround && !was && this.stateT > 0.1) this.game.fx.dust(this.cx, this.y + this.h, 5);
        if (this.y > this.level.ph + 32) { this.dead = true; this.removed = true; }
      }
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
    super(level, type, x, groundY, 14, 14);
    this.footPad = 1;
    this.anchorX = 1;
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
    super(level, type, x, groundY, heavy ? 18 : 14, heavy ? 34 : 32);
    this.footPad = 1;
    this.anchorX = 6;
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
    const wind = this.cfg.heavy ? 0.7 : 0.45;
    if (this.state === 'dormant' || this.state === 'awaken') f = 0;
    else if (this.state === 'windup') f = 12 + Math.min(2, Math.floor((this.stateT / wind) * 3));
    else if (this.state === 'slash') f = 15 + Math.min(2, Math.floor(this.stateT / 0.06));
    else if (this.state === 'recover') f = 17;
    else if (this.state === 'cast') f = 20 + Math.min(2, Math.floor(this.stateT / 0.2));
    else f = Math.abs(this.vx) > 5 ? 4 + (Math.floor(this.animT * 11) % 8) : Math.floor(this.animT * 4) % 4;
    if (this.state === 'awaken') this.sprite.setTint(Math.floor(this.stateT * 12) % 2 ? 0xffffff : 0x9a9aa8);
    this.sprite.setFrame(f);
  }
  onHurt(dir) {
    if (this.state === 'dormant') return;
    if (!this.cfg.heavy && this.state !== 'slash' && this.state !== 'cast') this.setState('hurt');
  }
  render() {
    super.render();
    if (this.state === 'hurt') this.sprite.setFrame(18 + (Math.floor(this.stateT * 8) % 2));
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
    const bcol = kind.startsWith('b_') ? kind.slice(2) : null;
    const sheet = bcol ? ART.bullets[bcol] : kind === 'dagger' ? ART.dagger : kind === 'qiwave' ? ART.qiWave : kind === 'tornado' ? ART.tornado : ART.proj[kind];
    this.turn = 0;
    this.accel = 0;
    this.maxSpeed = 400;
    this.grazeCd = 0;
    this.stopT = 0;
    this.sprite = new Sprite(level.group, sheet, 16);
    this.w = Math.max(6, sheet.fw - 4);
    this.h = Math.max(6, sheet.fh - 4);
    this.x = x + 2;
    this.y = y + 2;
    this.trail = bcol ? hexNum(BULLET_COLORS[bcol]) : kind === 'dagger' ? 0x7fe3ff : { fireball: 0xf07a2a, voidball: 0xc46bff, qiwave: 0x7fe3ff, windblade: 0xbfe8ff, meteor: 0xc46bff, jadeshard: 0x3ecf8e, shockwave: 0xf2b53a, jadewave: 0x9cf5c8, blade: 0xffffff, feather: 0xbfe8ff, tornado: 0xbfe8ff }[kind] || 0xffffff;
    if (kind === 'shockwave' || kind === 'jadewave' || kind === 'tornado') { this.ground = true; this.parryable = false; }
  }
  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.game.fx.burst(this.x + this.w / 2, this.y + this.h / 2, 8, [this.trail, 0xffffff], 70, 0.35);
    if (this.kind === 'meteor') {
      this.game.audio.play('explode');
      this.game.camera.shake(2, 0.15);
      this.game.ripple(this.x + this.w / 2, this.y + this.h / 2, 0.6, 200);
      this.game.fx.burst(this.x + this.w / 2, this.y + this.h / 2, 16, [PAL.violetLight, PAL.goldLight], 120, 0.6, 150);
    }
  }
  update(dt) {
    if (this.dead) return;
    // arrêt du temps : les projectiles ennemis se figent, ceux du héros s'arrêtent après un instant
    if (this.game.timeStopped) {
      if (this.owner === 'enemy') return;
      this.stopT += dt;
      if (this.stopT > 0.08) return;
    }
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) return this.danmaku ? (this.dead = true) : this.destroy();
    if (this.turn || this.accel) {
      const sp = clamp(Math.hypot(this.vx, this.vy) + this.accel * dt, 0, this.maxSpeed);
      const a = Math.atan2(this.vy, this.vx) + this.turn * dt;
      this.vx = Math.cos(a) * sp;
      this.vy = Math.sin(a) * sp;
    }
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
    if (this.danmaku && lv.arena) {
      const a = lv.arena;
      if (this.x < a.x - 30 || this.x > a.x + W + 30 || this.y > lv.ph + 10 || this.y < a.y - 70) { this.dead = true; return; }
    }
    if (this.owner === 'enemy') {
      const p = lv.player;
      this.grazeCd -= dt;
      if (p && !p.dead) {
        // zone vulnérable réduite au centre du corps (façon shoot'em up)
        const core = { x: p.cx - 3, y: p.y + 9, w: 6, h: 12 };
        if (overlap(this, core)) {
          if (p.hurt(this.damage, this.x + this.w / 2) && !this.pierce) return this.destroy();
        } else if (this.grazeCd <= 0 && Math.abs(this.x + this.w / 2 - p.cx) < this.w / 2 + 11 && Math.abs(this.y + this.h / 2 - p.cy) < this.h / 2 + 16) {
          this.grazeCd = 0.4;
          this.game.graze(this.x + this.w / 2, this.y + this.h / 2);
        }
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
          if (q !== this && !q.dead && q.owner === 'enemy' && (q.parryable || q.danmaku) && overlap(this, q)) q.destroy();
        }
      }
    }
    const fr = this.sprite.sheet.count;
    this.sprite.setFrame(Math.floor(this.t * 12) % fr);
    this.sprite.setFlip(this.vx < 0);
    this.sprite.setPos(this.x - 2, this.y - 2);
    if (this.danmaku) return;
    if (!this.danmaku && Math.random() < 0.6) {
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
      g.ripple(this.x + 8, this.floor, 0.6, 220);
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
        g.ripple(cx, cy, 1.6, 240);
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
  hurt(dmg, dir, kb, o = {}) {
    if (!this.active || this.dying || this.state === 'PHASE_2') return false;
    this.hp -= dmg;
    const hb = this.hitbox();
    this.game.popDamage(hb.x + hb.w / 2, hb.y - 4, dmg, !!(o.stop && o.stop > 0.06));
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
  // ---- danmaku ----
  shoot(color, x, y, ang, speed, o = {}) {
    const lv = this.level;
    const p = new Projectile(lv, 'b_' + color, x - 6, y - 6, Math.cos(ang) * speed, Math.sin(ang) * speed, 'enemy', 1);
    p.danmaku = true;
    p.walls = false;
    p.parryable = false;
    p.life = o.life || 8;
    p.turn = o.turn || 0;
    p.accel = o.accel || 0;
    p.maxSpeed = o.max || 400;
    p.gravity = o.gravity || 0;
    lv.addProjectile(p);
    return p;
  }
  ring(color, n, speed, off = 0, o = {}, x = this.cx, y = this.cy) {
    for (let i = 0; i < n; i++) this.shoot(color, x, y, off + (i / n) * Math.PI * 2, speed, o);
    this.game.audio.play('bullet');
  }
  aim(x = this.cx, y = this.cy) {
    const p = this.player();
    return Math.atan2(p.cy - y, p.cx - x);
  }
  fan(color, n, spread, speed, o = {}, x = this.cx, y = this.cy) {
    const base = this.aim(x, y);
    for (let i = 0; i < n; i++) this.shoot(color, x, y, base + (i - (n - 1) / 2) * spread, speed, o);
    this.game.audio.play('bullet');
  }
  spellUpdate(dt, a) {
    const g = this.game;
    if (!a.def) {
      const list = SPELLS[this.kind][this.phase - 1];
      this.spellIdx = ((this.spellIdx == null ? -1 : this.spellIdx) + 1) % list.length;
      a.def = list[this.spellIdx];
      a.t = -0.9;
      g.startSpell(a.def.name, a.def.dur, this);
    }
    this.spellMove(dt, a);
    this.telegraph = a.t < 0;
    if (a.t >= 0) a.def.run(this, a, dt);
    if (a.t > a.def.dur) {
      g.endSpell();
      return true;
    }
    return false;
  }
  every(a, key, iv) {
    if (a[key] == null) a[key] = 0;
    if (a.t >= a[key]) { a[key] += iv; return true; }
    return false;
  }
  enterPhase2() {
    const g = this.game;
    if (g.spell) g.endSpell(true);
    this.setState('PHASE_2');
    this.atk = null;
    this.vx = 0;
    g.audio.play('roar');
    g.camera.shake(6, 1.4);
    g.flash(0xffffff, 0.5);
    g.ripple(this.cx, this.cy, 1.8, 180);
    g.post.aberr = 3;
    g.toast(this.name + ' ENTRE EN FUREUR !', PAL.vermilion);
    for (const p of this.level.projectiles) if (p.owner === 'enemy') p.destroy();
  }
  defeat() {
    const g = this.game;
    if (g.spell) g.endSpell(true);
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
      const x = a.x + (i % 2 ? W - 60 : 60) + rand(-20, 20);
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
          this.attackCount = (this.attackCount || 0) + 1;
          const wantSpell = this.forceSpell || (this.phase === 1 ? this.attackCount % 4 === 3 : this.attackCount % 3 === 0);
          const name = wantSpell && SPELLS[this.kind] ? 'spell' : this.chooseAttack();
          this.forceSpell = false;
          this.lastAttack = name;
          this.atk = { name, t: 0, step: 0, n: 0 };
          this.setState(this.isSpecial(name) ? 'SPECIAL_ATTACK' : 'ATTACK');
          this.startAttack(name);
        }
        break;
      case 'ATTACK':
      case 'SPECIAL_ATTACK':
        this.atk.t += dt;
        if (this.atk.name === 'spell' ? this.spellUpdate(dt, this.atk) : this.attackUpdate(dt, this.atk)) { this.atk = null; this.setState('IDLE'); }
        break;
      case 'DAMAGED':
        this.damagedUpdate(dt);
        if (this.stateT > 0.6) this.setState('CHASE');
        break;
      case 'PHASE_2':
        this.phase2Update(dt);
        if (Math.random() < 0.6) g.fx.add.spawn(this.cx + rand(-20, 20), this.cy + rand(-20, 20), rand(-40, 40), rand(-80, -20), 0.7, 2, pick([0xc46bff, 0xe0412b, 0xffe08a]));
        if (this.stateT > 2) { this.phase = 2; this.forceSpell = true; this.spellIdx = null; this.onPhase2(); this.setState('IDLE'); }
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
  isSpecial(name) { return ['spell', 'summon', 'slam', 'tornado', 'feathers', 'breath', 'lightning', 'meteor'].includes(name); }
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
    g.ripple(this.cx, this.cy, 2.2, 260);
    g.post.aberr = 3;
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
    super(level, kind, x, gy, lion ? 40 : 26, lion ? 28 : 46, lion ? ART.jadeLion : ART.general, lion ? 110 : 80, name);
    this.lion = lion;
    this.footPad = 1;
    this.anchorX = lion ? 0 : 8;
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
              const pr = new Projectile(this.level, this.shard, this.arenaX + 30 + Math.random() * (W - 60), this.level.arena.y + 4 - i * 20, rand(-15, 15), 60, 'enemy', 1);
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
  spellMove(dt) {
    const tx = this.level.arena.x + W / 2;
    const dx = tx - this.cx;
    this.facing = sign(this.aim() > -Math.PI / 2 && this.aim() < Math.PI / 2 ? 1 : -1);
    this.vx = Math.abs(dx) > 6 ? approach(this.vx, sign(dx) * this.speed(), 300 * dt) : approach(this.vx, 0, 600 * dt);
    this.physics(dt);
    this.frame = Math.abs(this.vx) > 5 ? 2 + (Math.floor(this.animT * 6) % 2) : this.lion ? 6 : 4;
  }
  spawnWaves() {
    const g = this.game;
    g.audio.play('slam');
    g.camera.shake(5, 0.35);
    g.ripple(this.cx, this.y + this.h, 1.1, 240);
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
          const pr = new Projectile(lv, 'feather', lv.arena.x + 20 + Math.random() * (W - 40), lv.arena.y - 6, rand(-30, 30), 150, 'enemy', 1);
          pr.walls = true;
          lv.addProjectile(pr);
        }
        return a.t > 2.5;
      }
    }
    return true;
  }
  spellMove(dt) {
    this.steer(this.level.arena.x + W / 2 + Math.sin(this.animT * 0.8) * 30, this.level.arena.y + 46, 90, dt);
    this.physics(dt);
    this.frame = 4;
    this.facing = sign(this.player().cx - this.cx) || 1;
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
  spellMove(dt) {
    this.steer(this.level.arena.x + W / 2 + Math.sin(this.animT * 0.6) * 50, this.level.arena.y + 40 + Math.sin(this.animT * 1.3) * 10, 110, dt);
    this.physics(dt);
    this.mouth = 1;
  }
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
          const pr = new Projectile(lv, 'meteor', ar.x + 20 + Math.random() * (W - 40), ar.y - 10, rand(-20, 20), 40, 'enemy', 1);
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

// Cartes de sort : [phase 1], [phase 2]. run(boss, état, dt) est appelé chaque pas.
const SPELLS = {
  general: [
    [{ name: 'Signe du sabre « Cercle des mille lames »', dur: 7, run: (b, a) => {
      if (b.every(a, 'r', 0.75)) { a.k = (a.k || 0) + 1; b.ring('red', 18, 68, (a.k % 2) * 0.17); }
      if (b.every(a, 'f', 1.5)) b.fan('gold', 3, 0.2, 110);
    } }],
    [{ name: 'Signe martial « Tempête vermillon »', dur: 8, run: (b, a) => {
      if (b.every(a, 's', 0.08)) { a.ang = (a.ang || 0) + 0.27; for (const k of [0, Math.PI]) b.shoot('red', b.cx, b.cy, a.ang + k, 82, { turn: 0.25 }); }
      if (b.every(a, 'f', 1.3)) b.fan('gold', 5, 0.18, 105);
    } },
    { name: 'Signe impérial « Pluie de hallebardes »', dur: 8, run: (b, a) => {
      const ar = b.level.arena;
      if (b.every(a, 'r', 0.1)) b.shoot('violet', ar.x + 12 + Math.random() * (W - 24), ar.y - 8, Math.PI / 2 + rand(-0.15, 0.15), 115);
      if (b.every(a, 'g', 1.2)) b.ring('gold', 12, 48, Math.random());
    } }],
  ],
  lion: [
    [{ name: 'Signe de jade « Fleur de pierre »', dur: 7, run: (b, a) => {
      if (b.every(a, 'r', 0.95)) { b.ring('jade', 14, 72, 0, { turn: 0.7 }); b.ring('jade', 14, 72, Math.PI / 14, { turn: -0.7 }); }
    } }],
    [{ name: 'Signe sacré « Éboulis de la montagne »', dur: 8, run: (b, a) => {
      if (b.every(a, 'l', 0.22)) for (let i = 0; i < 3; i++) { const p = b.shoot('jade', b.cx, b.cy - 6, -Math.PI / 2 + rand(-0.9, 0.9), rand(150, 210), { gravity: 170 }); p.life = 6; }
      if (b.every(a, 'f', 1.4)) b.fan('cyan', 5, 0.22, 100);
    } },
    { name: 'Signe gardien « Mandala de jade »', dur: 8, run: (b, a) => {
      if (b.every(a, 's', 0.09)) {
        a.ang = (a.ang || 0) + 0.21;
        b.shoot('jade', b.cx, b.cy, a.ang, 70);
        b.shoot('gold', b.cx, b.cy, -a.ang * 1.3 + 1, 64);
      }
    } }],
  ],
  wind: [
    [{ name: 'Signe du vent « Éventail des quatre saisons »', dur: 7, run: (b, a) => {
      if (b.every(a, 'f', 0.45)) { a.k = (a.k || 0) + 1; b.fan(a.k % 2 ? 'cyan' : 'white', 7, 0.17, 98); }
    } }],
    [{ name: 'Signe tourbillon « Danse des mille feuilles »', dur: 8, run: (b, a) => {
      if (b.every(a, 's', 0.07)) { a.ang = (a.ang || 0) + 0.31; for (let k = 0; k < 3; k++) b.shoot('cyan', b.cx, b.cy, a.ang + (k * Math.PI * 2) / 3, 78, { turn: 0.45 }); }
    } },
    { name: 'Signe céleste « Rideau de nuages »', dur: 8, run: (b, a) => {
      const ar = b.level.arena, p = b.player();
      if (b.every(a, 'c', 0.11)) { a.k = (a.k || 0) + 1; b.shoot('white', ar.x + 10 + ((a.k * 53) % (W - 20)), ar.y - 8, Math.PI / 2, 88); }
      if (b.every(a, 'h', 0.9)) { const left = Math.random() < 0.5; for (let i = 0; i < 3; i++) b.shoot('blue', left ? ar.x - 10 : ar.x + W + 10, p.cy + (i - 1) * 14, left ? 0 : Math.PI, 95); }
    } }],
  ],
  dragon: [
    [{ name: 'Signe du dragon « Perles célestes »', dur: 8, run: (b, a) => {
      if (b.every(a, 'r', 0.65)) b.ring('gold', 20, 30, Math.random(), { accel: 65, max: 150 });
      if (b.every(a, 'f', 1.2)) b.fan('red', 5, 0.2, 115);
    } }],
    [{ name: 'Signe du néant « Porte des Esprits »', dur: 9, run: (b, a) => {
      if (b.every(a, 's', 0.09)) { a.ang = (a.ang || 0) + 0.17; for (let k = 0; k < 4; k++) b.shoot('violet', b.cx, b.cy, a.ang + (k * Math.PI) / 2, 70); }
      if (b.every(a, 'z', 0.18)) { a.ang2 = (a.ang2 || 0) - 0.23; b.shoot('red', b.cx, b.cy, a.ang2, 60, { accel: 25, max: 120 }); }
    } },
    { name: 'Dernier souffle « Constellation déchue »', dur: 9, run: (b, a) => {
      const ar = b.level.arena;
      if (b.every(a, 'r', 0.08)) b.shoot('gold', ar.x + 10 + Math.random() * (W - 20), ar.y - 8, Math.PI / 2 + rand(-0.3, 0.3), rand(70, 120), { turn: rand(-0.3, 0.3) });
      if (b.every(a, 'g', 1.1)) b.ring('violet', 22, 55, Math.random());
    } }],
  ],
};

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
    this.post = new PostFX();
    this.post.setTheme(null);
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
    this.timeStopped = false;
    this.tp = 100;
    this.tsCd = 0;
    this.tickT = 0;
    this.tpFlash = 0;
    this.grazes = 0;
    this.grazeT = 0;
    this.spell = null;
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
  ripple(x, y, strength = 1, speed = 220) { this.post.ripple(x, y, strength, speed); }
  popDamage(x, y, v, big) {
    this.popups = this.popups || [];
    if (this.popups.length > 24) this.popups.shift();
    this.popups.push({ x: x + rand(-4, 4), y, v: Math.max(1, Math.round(v)), t: 0, big, vx: rand(-20, 20) });
  }
  // ---- Arrêt du temps ----
  toggleTimeStop() {
    if (this.timeStopped) return this.resumeTime();
    const p = this.level && this.level.player;
    if (!p || p.dead || this.tsCd > 0) return;
    if (this.tp < 15) {
      this.audio.play('noQi');
      this.tpFlash = 0.4;
      return;
    }
    this.timeStopped = true;
    this.tsCd = 0.3;
    this.tickT = 0;
    this.audio.play('timeStop');
    this.ripple(p.cx, p.cy, 2.4, 340);
    this.post.aberr = 2;
    this.flash(0xffffff, 0.25);
  }
  resumeTime(silent = false) {
    if (!this.timeStopped) return;
    this.timeStopped = false;
    this.tsCd = 0.35;
    if (silent) return;
    const p = this.level && this.level.player;
    this.audio.play('timeResume');
    if (p) this.ripple(p.cx, p.cy, 1.2, 260);
    if (this.level) for (const q of this.level.projectiles) q.stopT = 0;
  }
  // Frôler un projectile sans être touché : recharge Qi et temps
  graze(x, y) {
    this.grazes++;
    this.grazeT = 0.5;
    this.gainQi(5);
    this.tp = Math.min(100, this.tp + 4);
    this.addScore(10);
    this.audio.play('graze');
    for (let i = 0; i < 4; i++) {
      const pr = this.fx.add.spawn(x, y, rand(-60, 60), rand(-60, 60), 0.25, 1, pick([0xffffff, 0x7fe3ff]));
      if (pr) pr.drag = 6;
    }
  }
  // ---- Cartes de sort ----
  startSpell(name, dur, boss) {
    this.spell = { name, dur, t: 0, bonus: true, boss };
    this.audio.play('spell');
    this.flash(0xffffff, 0.3);
    this.ripple(boss.cx, boss.cy, 1.4, 240);
  }
  endSpell(broken = false) {
    const s = this.spell;
    if (!s) return;
    this.spell = null;
    if (!broken && s.bonus) {
      this.addScore(3000);
      this.gainQi(this.maxQi);
      this.tp = 100;
      this.audio.play('bonus');
      this.toast('BONUS DE SORT !  +3000', PAL.goldLight);
    } else if (!broken) this.toast('SORT ÉCHOUÉ', PAL.ivoryDark);
    if (this.level) for (const p of this.level.projectiles) if (p.danmaku && !p.dead) { p.dead = true; this.fx.add.spawn(p.x + 5, p.y + 5, 0, -30, 0.4, 2, 0xffe08a); }
  }
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
    this.level = new Level(this, 0, true);
    this.post.setTheme(this.level.theme);
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
    this.post.setTheme(this.level.theme);
    this.post.desat = 0;
    this.camera.setBounds(this.level);
    this.camera.lock = null;
    this.camera.snap(this.level.player);
    this.combo = 0;
    this.toasts = [];
    this.hitstop = 0;
    this.slowmo = 0;
    this.audio.playMusic(this.level.def.music);
    this.timeStopped = false;
    this.tp = 100;
    this.spell = null;
    this.grazes = 0;
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
    const sp = lv.bossSpawn || { x: lv.arena.x + W * 0.66, y: lv.arena.y + H - 48 };
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
    this.resumeTime(true);
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
    this.post.update(dt);
    if (this.state === 'gameover') this.post.desat = Math.min(0.85, this.post.desat + dt * 1.6);
    this.post.cold = this.timeStopped ? Math.min(1, this.post.cold + dt * 6) : Math.max(0, this.post.cold - dt * 4);
    this.tpFlash -= dt;
    this.grazeT -= dt;
    if (['menu', 'controls', 'credits', 'levelclear', 'victory', 'gameover'].includes(this.state)) {
      this.fx.normal.update(dt);
      this.fx.add.update(dt);
    }
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
    this.tsCd -= dt;
    if (this.timeStopped) {
      this.tp -= 17 * sdt;
      this.tickT -= sdt;
      if (this.tickT <= 0) { this.tickT = 0.5; this.audio.play('tick'); }
      if (this.tp <= 0) { this.tp = 0; this.resumeTime(); }
    } else this.tp = Math.min(100, this.tp + 2.5 * sdt);
    if (this.spell) this.spell.t += sdt;
    lv.update(sdt);
    if (!this.timeStopped) {
      this.fx.normal.update(sdt);
      this.fx.add.update(sdt);
    }
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
      this.post.render(r, this.scene, this.cam3, cam.rx, cam.ry, this.level.time);
    }
    this.drawUI();
    this.uiTex.needsUpdate = true;
    r.render(this.uiScene, this.uiCam);
  }
  drawUI() {
    const c = this.ui;
    c.clearRect(0, 0, W, H);
    const centered = (fn) => {
      c.save();
      c.translate(0, OY);
      fn.call(this, c);
      c.restore();
    };
    switch (this.state) {
      case 'intro': centered(this.drawIntro); break;
      case 'menu': centered(this.drawMenu); break;
      case 'controls': centered(this.drawControls); break;
      case 'credits': centered(this.drawCredits); break;
      case 'play':
      case 'dialog':
        this.drawHUD(c);
        if (this.state === 'dialog') this.drawDialog(c);
        break;
      case 'pause': this.drawHUD(c); centered(this.drawPause); break;
      case 'gameover': centered(this.drawGameOver); break;
      case 'levelclear': centered(this.drawLevelClear); break;
      case 'upgrade': centered(this.drawUpgrade); break;
      case 'victory': centered(this.drawVictory); break;
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
    // jauge de temps (arrêt du temps)
    disc(c, 8, 26, 3, this.timeStopped ? PAL.white : PAL.ivory);
    rect(c, 8, 24, 1, 2, PAL.black);
    rect(c, 8, 26, 2, 1, PAL.black);
    rect(c, 15, 24, 62, 5, this.tpFlash > 0 && Math.floor(this.tpFlash * 20) % 2 ? PAL.vermilion : PAL.black);
    rect(c, 16, 25, 60, 3, '#2a2418');
    const tw = Math.round((this.tp / 100) * 60);
    rect(c, 16, 25, tw, 3, this.timeStopped ? (Math.floor(this.stateT * 8) % 2 ? PAL.white : PAL.goldLight) : PAL.gold);
    rect(c, 16 + 9, 24, 1, 5, PAL.ivoryDark);
    if (this.timeStopped) drawText(c, 'TEMPS ARRÊTÉ', 80, 24, PAL.white);
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
    if (this.grazes > 0) drawText(c, 'GRAZE ' + this.grazes, W - 5, 50, this.grazeT > 0 ? PAL.white : PAL.qi, 1, 'right');
    // carte de sort : bandeau d'annonce puis titre près de la barre du boss
    const sp = this.spell;
    if (sp) {
      const name = sp.name;
      if (sp.t < 1.6) {
        const k = Math.min(1, sp.t / 0.25), out = Math.max(0, (sp.t - 1.3) / 0.3);
        c.globalAlpha = 0.75 * (1 - out);
        poly(c, [[W * (1 - k), 70 + OY], [W, 64 + OY], [W, 92 + OY], [W * (1 - k) - 20, 96 + OY]], PAL.darkRed);
        c.globalAlpha = 1 - out;
        drawText(c, 'CARTE DE SORT', W - 10, 70 + OY, PAL.goldLight, 1, 'right');
        drawText(c, name, W - 10 + (1 - k) * 200, 82 + OY, PAL.white, 1, 'right');
        c.globalAlpha = 1;
      }
      const left = Math.max(0, Math.ceil(sp.dur - sp.t));
      const tw2 = textWidth(name) + 8;
      rect(c, W - tw2 - 4, H - 34, tw2 + 4, 9, 'rgba(18,10,16,0.75)');
      drawText(c, name, W - 6, H - 32, sp.bonus ? PAL.goldLight : PAL.ivoryDark, 1, 'right', null);
      drawText(c, String(left), 6, H - 32, left <= 3 ? PAL.vermilion : PAL.ivory, 1, 'left');
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
    // chiffres de dégâts
    if (this.popups) {
      for (const pp of this.popups) {
        pp.t += 1 / 60;
        const k = pp.t;
        const sx = Math.round(pp.x + pp.vx * k - this.camera.rx), sy = Math.round(pp.y - 22 * k + 30 * k * k - this.camera.ry);
        if (k < 0.75 || Math.floor(k * 20) % 2) drawText(c, String(pp.v), sx, sy, pp.big ? PAL.goldLight : PAL.white, pp.big && k < 0.12 ? 2 : 1, 'center', PAL.black);
      }
      this.popups = this.popups.filter((pp) => pp.t < 0.95);
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
      c.save();
      c.translate(0, OY);
      c.globalAlpha = a * 0.6;
      rect(c, 0, 64, W, 40, PAL.black);
      c.globalAlpha = a;
      this.ornamentLine(c, 68, 200);
      drawText(c, tc.text, W / 2, 75, tc.boss ? PAL.vermilion : PAL.goldLight, 2, 'center');
      drawText(c, tc.sub, W / 2, 90, PAL.ivory, 1, 'center');
      this.ornamentLine(c, 99, 200);
      c.globalAlpha = 1;
      c.restore();
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
    wrapText(text, Math.floor((W - 40) / 4)).slice(0, 5).forEach((l, i) => drawText(c, l, x + 7, y + 7 + i * 7, PAL.ivory));
    if (d.chars >= d.lines[d.i].length && Math.floor(this.stateT * 3) % 2) drawText(c, d.i < d.lines.length - 1 ? 'J >' : 'J X', x + w - 8, y + h - 9, PAL.gold, 1, 'right');
  }
  drawIntro(c) {
    rect(c, 0, -OY, W, H, '#07050a');
    const t = this.stateT;
    for (let i = 0; i < 40; i++) {
      const x = (i * 53 + t * (8 + (i % 5) * 3)) % W, y = DH - ((i * 37 + t * (12 + (i % 7) * 4)) % DH);
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
    if (t > 2 && Math.floor(t * 2) % 2) drawText(c, 'APPUYEZ SUR UNE TOUCHE', W / 2, DH - 22, PAL.gold, 1, 'center');
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
    rect(c, 0, -OY, W, H, PAL.black);
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
    rect(c, 0, -OY, W, H, PAL.black);
    c.globalAlpha = 1;
    this.panel(c, 30, 14, W - 60, DH - 28);
    drawText(c, 'COMMANDES', W / 2, 22, PAL.gold, 2, 'center');
    const rows = [
      ['← →  /  A D (Q D)', 'SE DÉPLACER'],
      ['ESPACE', 'SAUTER  (X2 : DOUBLE SAUT)'],
      ['ESPACE CONTRE UN MUR', 'REBOND MURAL (LIANES)'],
      ['↓ + ESPACE', 'DESCENDRE D\'UN PONT'],
      ['J (X4) / ↑+J', 'COMBO AU SABRE / COUP ASCENDANT'],
      ['J EN L\'AIR / ↓+J', 'COMBO AÉRIEN / PLONGEON SISMIQUE'],
      ['MAINTENIR J', 'IAIJUTSU (RELÂCHER QUAND C\'EST CHARGÉ)'],
      ['K (MAINTENIR) / ↑+K', 'DAGUES DE QI'],
      ['I', 'VAGUE DE QI (30 QI)'],
      ['L', 'ARRÊT DU TEMPS (L POUR REPARTIR)'],
      ['SHIFT', 'DASH INVINCIBLE'],
      ['E / ↑', 'LIRE / PARLER'],
      ['ÉCHAP / P', 'PAUSE'],
      ['M', 'COUPER LE SON'],
    ];
    rows.forEach(([k, v], i) => {
      drawText(c, k, 40, 38 + i * 8, PAL.goldLight);
      drawText(c, v, 168, 38 + i * 8, PAL.ivory);
    });
    drawText(c, 'ENTRÉE : RETOUR', W / 2, DH - 24, PAL.ivoryDark, 1, 'center');
  }
  drawCredits(c) {
    c.globalAlpha = 0.75;
    rect(c, 0, -OY, W, H, PAL.black);
    c.globalAlpha = 1;
    this.panel(c, 30, 14, W - 60, DH - 28);
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
    drawText(c, 'ENTRÉE : RETOUR', W / 2, DH - 24, PAL.ivoryDark, 1, 'center');
  }
  drawPause(c) {
    c.globalAlpha = 0.6;
    rect(c, 0, -OY, W, H, PAL.black);
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
    rect(c, 0, -OY, W, H, PAL.black);
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
    rect(c, 0, -OY, W, H, PAL.black);
    c.globalAlpha = 1;
    this.panel(c, 40, 16, W - 80, DH - 32);
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
    rect(c, 0, -OY, W, H, '#0d0a14');
    for (let i = 0; i < 30; i++) {
      const x = (i * 47 + this.stateT * 6) % W, y = H - ((i * 31 + this.stateT * 14) % DH);
      rect(c, x, y, 1, 1, i % 2 ? PAL.gold : PAL.qiDark);
    }
    this.panel(c, 16, 8, W - 32, DH - 16);
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
    drawText(c, (on ? '> ' : '  ') + 'CONTINUER VERS : ' + LEVELS[this.levelIndex + 1].name + (on ? ' <' : ''), W / 2, DH - 22, on ? PAL.goldLight : PAL.ivory, 1, 'center');
  }
  drawVictory(c) {
    const t = this.stateT;
    c.globalAlpha = Math.min(0.85, t * 0.4);
    rect(c, 0, -OY, W, H, '#07050a');
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
