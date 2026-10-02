import * as THREE from 'three';
import { PixelCanvas } from '../../assets/pixel/PixelCanvas';

/**
 * Planche de sprites : une ligne par animation, une colonne par frame.
 * Deux textures parallèles : couleur et émission (yeux, runes, lueurs).
 */
export interface ClipInfo {
  name: string;
  row: number;
  count: number;
  fps: number;
  loop: boolean;
  /** Événements déclenchés à l'entrée d'une frame (ex. bruit de pas). */
  events: Record<number, string>;
}

export interface SpriteSheet {
  frameW: number;
  frameH: number;
  cols: number;
  rows: number;
  /** Ligne de pixels correspondant au sol (pieds) dans une frame. */
  pivotY: number;
  /** Colonne de pixels du centre du personnage. */
  pivotX: number;
  color: THREE.Texture;
  emissive: THREE.Texture;
  clips: Map<string, ClipInfo>;
  /** Image composite pour le débogage / visualiseur de sprites. */
  debugCanvas: HTMLCanvasElement;
  /** Orientation native des frames (true = le personnage regarde à gauche). */
  facesLeft: boolean;
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
      row,
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
    rows,
    pivotX: spec.pivotX,
    pivotY: spec.pivotY,
    color: colorTex,
    emissive: emTex,
    clips,
    debugCanvas: color.toCanvas(),
    facesLeft: spec.facesLeft ?? false,
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
