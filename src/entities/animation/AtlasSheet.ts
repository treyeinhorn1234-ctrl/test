import * as THREE from 'three';
import type { ClipInfo, FrameData, SpriteSheet } from './SpriteSheet';

/**
 * Planche chargée depuis des images (atlas exportés par un outil, ex.
 * `tools/build_knight.py`) : pages couleur + émission et métadonnées JSON.
 */
export interface AtlasMeta {
  frameW: number;
  frameH: number;
  cols: number;
  pages: { h: number }[];
  pivotX: number;
  pivotY: number;
  clips: Record<string, { page: number; start: number; count: number; fps: number; loop: boolean; events: Record<string, string> }>;
  moves?: Record<string, FrameData>;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

function pixelTexture(img: HTMLImageElement, srgb: boolean): THREE.Texture {
  const t = new THREE.Texture(img);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export async function loadAtlasSheet(
  meta: AtlasMeta,
  colorUrls: string[],
  emissiveUrls: string[],
  opts: { pixelsPerUnit: number; directions: 4 | 8 },
): Promise<SpriteSheet> {
  const [colors, emissives] = await Promise.all([Promise.all(colorUrls.map(loadImage)), Promise.all(emissiveUrls.map(loadImage))]);
  const pages = colors.map((img, i) => {
    const rows = Math.round(meta.pages[i].h / meta.frameH);
    const color = pixelTexture(img, true);
    // L'émission peut être à une résolution inférieure : mêmes UV, cellules plus petites.
    const emissive = pixelTexture(emissives[i], true);
    for (const t of [color, emissive]) t.repeat.set(1 / meta.cols, 1 / rows);
    return { color, emissive, rows, image: img };
  });
  const clips = new Map<string, ClipInfo>();
  for (const [name, c] of Object.entries(meta.clips)) {
    clips.set(name, {
      name,
      page: c.page,
      start: c.start,
      count: c.count,
      fps: c.fps,
      loop: c.loop,
      events: Object.fromEntries(Object.entries(c.events).map(([k, v]) => [Number(k), v])),
    });
  }
  return {
    frameW: meta.frameW,
    frameH: meta.frameH,
    cols: meta.cols,
    pages,
    pivotX: meta.pivotX,
    pivotY: meta.pivotY,
    clips,
    facesLeft: false,
    pixelsPerUnit: opts.pixelsPerUnit,
    directions: opts.directions,
    frameData: new Map(Object.entries(meta.moves ?? {})),
  };
}
