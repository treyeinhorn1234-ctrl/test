/**
 * Paramètres persistants (graphismes, audio, commandes) stockés dans localStorage.
 * Toute modification passe par `update()` qui notifie les abonnés et sauvegarde.
 */
export type QualityPreset = 'low' | 'medium' | 'high';

export type Action =
  | 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight'
  | 'run' | 'dodge' | 'block' | 'lightAttack' | 'heavyAttack'
  | 'spell1' | 'spell2' | 'special' | 'interact'
  | 'inventory' | 'journal' | 'map' | 'pause';

export interface GraphicsSettings {
  quality: QualityPreset;
  /** Taille d'un pixel du jeu en pixels écran (détermine la résolution interne). */
  pixelSize: number;
  /** 0 = aucun, 1 = étalonnage + vignette, 2 = + halo lumineux + tramage. */
  postLevel: number;
  /** Multiplicateur de densité du brouillard. */
  fog: number;
  brightness: number;
  saturation: number;
  showFps: boolean;
}

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  ambience: number;
}

export interface SettingsData {
  graphics: GraphicsSettings;
  audio: AudioSettings;
  bindings: Record<Action, string>;
}

/**
 * Codes physiques (KeyboardEvent.code) : la disposition AZERTY fonctionne
 * automatiquement — la touche physique « Z » d'un clavier AZERTY envoie KeyW.
 */
export const DEFAULT_BINDINGS: Record<Action, string> = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  run: 'ShiftLeft',
  dodge: 'Space',
  block: 'KeyC',
  lightAttack: 'Mouse0',
  heavyAttack: 'Mouse2',
  spell1: 'KeyQ',
  spell2: 'KeyE',
  special: 'KeyR',
  interact: 'KeyF',
  inventory: 'KeyI',
  journal: 'KeyJ',
  map: 'KeyM',
  pause: 'Escape',
};

export const ACTION_LABELS: Record<Action, string> = {
  moveUp: 'Avancer',
  moveDown: 'Reculer',
  moveLeft: 'Gauche',
  moveRight: 'Droite',
  run: 'Courir',
  dodge: 'Roulade / esquive',
  block: 'Garde / parade',
  lightAttack: 'Attaque légère',
  heavyAttack: 'Attaque lourde',
  spell1: 'Sort principal',
  spell2: 'Sort secondaire',
  special: 'Capacité spéciale',
  interact: 'Interagir',
  inventory: 'Inventaire',
  journal: 'Journal de quêtes',
  map: 'Carte',
  pause: 'Menu / Pause',
};

export const QUALITY_PRESETS: Record<QualityPreset, { shadows: number; particles: number; postLevel: number; lights: number }> = {
  low: { shadows: 0, particles: 0.4, postLevel: 1, lights: 4 },
  medium: { shadows: 1024, particles: 0.75, postLevel: 2, lights: 8 },
  high: { shadows: 2048, particles: 1, postLevel: 2, lights: 12 },
};

const STORAGE_KEY = 'ashen-crown.settings.v5';

function defaults(): SettingsData {
  return {
    graphics: {
      quality: 'high',
      pixelSize: 2,
      postLevel: 2,
      fog: 1,
      brightness: 1,
      saturation: 1,
      showFps: false,
    },
    audio: { master: 0.8, music: 0.6, sfx: 0.8, ambience: 0.7 },
    bindings: { ...DEFAULT_BINDINGS },
  };
}

type Listener = (s: SettingsData) => void;

export class Settings {
  data: SettingsData;
  private listeners = new Set<Listener>();

  constructor() {
    this.data = Settings.load();
  }

  private static load(): SettingsData {
    const base = defaults();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as Partial<SettingsData>;
      return {
        graphics: { ...base.graphics, ...parsed.graphics },
        audio: { ...base.audio, ...parsed.audio },
        bindings: { ...base.bindings, ...parsed.bindings },
      };
    } catch {
      return base;
    }
  }

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* stockage indisponible (navigation privée…) : on ignore */
    }
  }

  update(mutator: (d: SettingsData) => void): void {
    mutator(this.data);
    this.save();
    for (const l of this.listeners) l(this.data);
  }

  resetBindings(): void {
    this.update((d) => {
      d.bindings = { ...DEFAULT_BINDINGS };
    });
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
