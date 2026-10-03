import { loadAtlasSheet, type AtlasMeta } from '../../../entities/animation/AtlasSheet';
import type { SpriteSheet } from '../../../entities/animation/SpriteSheet';
import meta from './knight.json';

/**
 * Varyn : chevalier rendu en pixel art (packs « Knight », 8 directions),
 * recoloré et complété par `tools/build_knight.py` (armure noire à reflets
 * violets, visière rouge incandescente, épée Eclipse sur les frames d'impact).
 */
const PAGES = import.meta.glob('./knight_*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** Densité du sprite : 32 px par unité (le personnage mesure ~2,5 unités). */
export const KNIGHT_PPU = 32;

let sheet: SpriteSheet | null = null;

export async function loadKnightSheet(): Promise<SpriteSheet> {
  if (sheet) return sheet;
  const m = meta as unknown as AtlasMeta;
  const color = m.pages.map((_, i) => PAGES[`./knight_${i}.png`]);
  const emissive = m.pages.map((_, i) => PAGES[`./knight_${i}_e.png`]);
  sheet = await loadAtlasSheet(m, color, emissive, { pixelsPerUnit: KNIGHT_PPU, directions: 8 });
  return sheet;
}

/** Planche chargée (appeler `loadKnightSheet` au démarrage). */
export function getKnightSheet(): SpriteSheet {
  if (!sheet) throw new Error('Planche du chevalier non chargée');
  return sheet;
}

/** Zone de l'atlas servant au portrait du HUD (tête, première frame du repos de face). */
export function knightPortraitSource(): { image: CanvasImageSource; x: number; y: number; w: number; h: number } {
  const s = getKnightSheet();
  const clip = s.clips.get('idle@s')!;
  const col = clip.start % s.cols, row = Math.floor(clip.start / s.cols);
  return { image: s.pages[clip.page].image, x: col * s.frameW + s.pivotX - 20, y: row * s.frameH + s.pivotY - 82, w: 40, h: 40 };
}
