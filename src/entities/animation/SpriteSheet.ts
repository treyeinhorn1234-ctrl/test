import * as THREE from 'three';
import { PixelCanvas } from '../../assets/pixel/PixelCanvas';

/**
 * Planche de sprites : grille de frames réparties sur une ou plusieurs pages
 * de texture. Chaque clip occupe `count` cellules consécutives à partir de
 * `start` sur sa page (ordre de lecture : gauche → droite, haut → bas).
 * Deux textures parallèles par page : couleur et émission (yeux, runes, lueurs).
 */
export interface ClipInfo {
  name: string;
  /** Page de texture et première cellule du clip. */
  page: number;
  start: number;
  count: number;
  fps: number;
  loop: boolean;
  /** Événements déclenchés à l'entrée d'une frame (ex. bruit de pas). */
  events: Record<number, string>;
}

export interface SheetPage {
  color: THREE.Texture;
  emissive: THREE.Texture;
  /** Nombre de lignes de cellules de la page. */
  rows: number;
  /** Image source (visualiseur, portrait). */
  image: CanvasImageSource;
}

export interface SpriteSheet {
  frameW: number;
  frameH: number;
  /** Cellules par ligne (identique sur toutes les pages). */
  cols: number;
  pages: SheetPage[];
  /** Ligne de pixels correspondant au sol (pieds) dans une frame. */
  pivotY: number;
  /** Colonne de pixels du centre du personnage. */
  pivotX: number;
  clips: Map<string, ClipInfo>;
  /** Orientation native des frames (true = le personnage regarde à gauche). */
  facesLeft: boolean;
  /** Densité du sprite (pixels par unité monde). */
  pixelsPerUnit: number;
  /**
   * Directions disponibles : 4 (variantes `@down`, `@up`, `@side`) ou 8
   * (variantes `@s`, `@se`, `@e`, `@ne`, `@n` ; l'ouest est le miroir de l'est).
   */
  directions: 4 | 8;
}

/** Position (colonne, ligne) d'une cellule de clip sur sa page. */
export function cellOf(sheet: SpriteSheet, clip: ClipInfo, frame: number): { col: number; row: number } {
  const k = clip.start + frame;
  return { col: k % sheet.cols, row: Math.floor(k / sheet.cols) };
}

export interface ClipDef<P> {
  name: string;
  fps: number;
  loop: boolean;
  frames: P[];
  events?: Record<number, string>;
}

export interface SheetSpec<P> {
  frameW: number;
  frameH: number;
  pivotX: number;
  pivotY: number;
  /** Couleur de contour automatique (null : le générateur gère lui-même le contour). */
  outline: number | null;
  facesLeft?: boolean;
  pixelsPerUnit?: number;
  clips: ClipDef<P>[];
  draw(pose: P, color: PixelCanvas, emissive: PixelCanvas, frameIndex: number, row: number): void;
}

export function buildSpriteSheet<P>(spec: SheetSpec<P>): SpriteSheet {
  const cols = Math.max(...spec.clips.map((c) => c.frames.length));
  const rows = spec.clips.length;
  const color = new PixelCanvas(cols * spec.frameW, rows * spec.frameH);
  const emissive = new PixelCanvas(cols * spec.frameW, rows * spec.frameH);
  const clips = new Map<string, ClipInfo>();

  spec.clips.forEach((clip, row) => {
    clips.set(clip.name, {
      name: clip.name,
      page: 0,
      start: row * cols,
      count: clip.frames.length,
      fps: clip.fps,
      loop: clip.loop,
      events: clip.events ?? {},
    });
    clip.frames.forEach((pose, col) => {
      const c = new PixelCanvas(spec.frameW, spec.frameH);
      const e = new PixelCanvas(spec.frameW, spec.frameH);
      spec.draw(pose, c, e, col, row);
      if (spec.outline !== null) c.outline(spec.outline);
      color.blit(c, col * spec.frameW, row * spec.frameH);
      emissive.blit(e, col * spec.frameW, row * spec.frameH);
    });
  });

  const colorTex = color.toTexture(true);
  const emTex = emissive.toTexture(true);
  for (const t of [colorTex, emTex]) {
    t.repeat.set(1 / cols, 1 / rows);
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
  }

  return {
    frameW: spec.frameW,
    frameH: spec.frameH,
    cols,
    pages: [{ color: colorTex, emissive: emTex, rows, image: color.toCanvas() }],
    pivotX: spec.pivotX,
    pivotY: spec.pivotY,
    clips,
    facesLeft: spec.facesLeft ?? false,
    pixelsPerUnit: spec.pixelsPerUnit ?? 16,
    directions: 4,
  };
}

/** Interpolation linéaire de poses numériques (champs number uniquement). */
export function lerpPose<P extends object>(a: P, b: P, t: number): P {
  const out = { ...a } as Record<string, unknown>;
  for (const k of Object.keys(b)) {
    const va = (a as Record<string, unknown>)[k];
    const vb = (b as Record<string, unknown>)[k];
    if (typeof va === 'number' && typeof vb === 'number') out[k] = va + (vb - va) * t;
    else out[k] = t < 0.5 ? va : vb;
  }
  return out as P;
}
