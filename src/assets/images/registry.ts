/**
 * Registre des images sources (sprites dessinés) chargées au démarrage.
 * Les générateurs de planches lisent les pixels d'ici de façon synchrone.
 */
import varynUrl from '../character/varyn/source.png';

/** Calques du personnage (dossiers body/, head/, arms/, legs/, cape/, weapon/). */
const PART_URLS = import.meta.glob('../character/*/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const images = new Map<string, Pixels>();

const SOURCES: Record<string, string> = {
  varyn: varynUrl,
  // Clé : « character/<nom>/<dossier>/<fichier>.png »
  ...Object.fromEntries(Object.entries(PART_URLS).map(([k, v]) => [k.replace('../', ''), v])),
};

async function load(url: string): Promise<Pixels> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  return { width: c.width, height: c.height, data: d.data };
}

/** Charge toutes les images sources (à appeler avant de créer le jeu). */
export async function loadImages(): Promise<void> {
  await Promise.all(Object.entries(SOURCES).map(async ([k, url]) => images.set(k, await load(url))));
}

export function getImage(name: string): Pixels {
  const p = images.get(name);
  if (!p) throw new Error(`Image non chargée : ${name}`);
  return p;
}
