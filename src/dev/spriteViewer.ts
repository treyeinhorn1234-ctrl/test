import { getVarynSheet } from '../assets/sprites/varynSprite';
import { getSkeletonSheet } from '../assets/sprites/skeletonSprite';
import type { SpriteSheet } from '../entities/animation/SpriteSheet';

/**
 * Visualiseur de planches de sprites pour l'itération artistique.
 * - `?debug=sprites` : planches complètes
 * - `?debug=sprites&who=varyn&clip=idle&zoom=6` : un clip agrandi
 */
export function showSpriteViewer(root: HTMLElement): void {
  const q = new URLSearchParams(location.search);
  root.innerHTML = '';
  root.style.cssText = 'background:#2a2433;padding:12px;overflow:auto;height:100vh;box-sizing:border-box';
  const sheets: [string, SpriteSheet][] = [['varyn', getVarynSheet()], ['skeleton', getSkeletonSheet()]];
  const clipName = q.get('clip');
  if (clipName) {
    const sheet = sheets.find(([n]) => n === (q.get('who') ?? 'varyn'))![1];
    const clip = sheet.clips.get(clipName)!;
    const zoom = Number(q.get('zoom') ?? 6);
    const cv = document.createElement('canvas');
    cv.width = clip.count * sheet.frameW * zoom;
    cv.height = sheet.frameH * zoom;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = q.get('bg') ?? '#ffffff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(sheet.debugCanvas, 0, clip.row * sheet.frameH, clip.count * sheet.frameW, sheet.frameH, 0, 0, cv.width, cv.height);
    root.appendChild(cv);
    return;
  }
  for (const [name, sheet] of sheets) {
    const title = document.createElement('div');
    title.textContent = `${name} — ${[...sheet.clips.keys()].join(', ')}`;
    title.style.cssText = 'color:#ddd;font:14px monospace;margin:8px 0';
    const cv = sheet.debugCanvas;
    cv.style.cssText = `image-rendering:pixelated;width:${cv.width * (cv.width > 800 ? 2 : 3)}px;background:#8a8494`;
    root.append(title, cv);
  }
}
