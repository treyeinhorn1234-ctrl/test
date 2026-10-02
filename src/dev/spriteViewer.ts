import { getVarynSheet } from '../assets/sprites/varynSprite';
import { getSkeletonSheet } from '../assets/sprites/skeletonSprite';

/** Visualiseur de planches de sprites (?debug=sprites) pour l'itération artistique. */
export function showSpriteViewer(root: HTMLElement): void {
  root.innerHTML = '';
  root.style.cssText = 'background:#2a2433;padding:12px;overflow:auto;height:100vh;box-sizing:border-box';
  for (const [name, sheet] of [['Varyn', getVarynSheet()], ['Squelette', getSkeletonSheet()]] as const) {
    const title = document.createElement('div');
    title.textContent = `${name} — ${[...sheet.clips.keys()].join(', ')}`;
    title.style.cssText = 'color:#ddd;font:14px monospace;margin:8px 0';
    const cv = sheet.debugCanvas;
    cv.style.cssText = `image-rendering:pixelated;width:${cv.width * 3}px;background:#57506a`;
    root.append(title, cv);
  }
}
