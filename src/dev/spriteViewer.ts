import { getSkeletonSheet } from '../assets/sprites/chibi/skeletonChibi';
import { getVarynSheet } from '../assets/sprites/chibi/varynChibi';
import type { SpriteSheet } from '../entities/animation/SpriteSheet';

/**
 * Visualiseur pour l'itération artistique.
 * - `?debug=sprites` : planches complètes de Varyn et du squelette (une ligne par clip@direction).
 * - `&who=varyn|skeleton` : une seule planche ; `&clip=heavy` : clips dont le nom commence ainsi ;
 *   `&zoom=3&bg=%23c8c4cc` : agrandissement, fond.
 */
export function showSpriteViewer(root: HTMLElement): void {
  const q = new URLSearchParams(location.search);
  root.innerHTML = '';
  root.style.cssText = 'background:#2a2433;padding:12px;overflow:auto;height:100vh;box-sizing:border-box;font:12px monospace;color:#ffe680';
  const zoom = Number(q.get('zoom') ?? 3);
  const bg = q.get('bg') ?? '#8a8494';
  const who = q.get('who');
  const sheets: [string, SpriteSheet][] = [];
  if (who !== 'skeleton') sheets.push(['varyn', getVarynSheet()]);
  if (who !== 'varyn') sheets.push(['skeleton', getSkeletonSheet()]);
  for (const [name, s] of sheets) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:8px;margin-bottom:16px';
    const labels = document.createElement('div');
    const prefix = q.get('clip') ?? '';
    const rows = [...s.clips.values()].filter((c) => c.name.startsWith(prefix)).sort((a, b) => a.row - b.row);
    if (!rows.length) continue;
    labels.innerHTML = rows.map((c) => `<div style="height:${s.frameH * zoom}px;line-height:${s.frameH * zoom}px;white-space:nowrap">${name} · ${c.name}</div>`).join('');
    // Recopie les lignes retenues de la planche.
    const cv = document.createElement('canvas');
    cv.width = s.debugCanvas.width;
    cv.height = rows.length * s.frameH;
    const g = cv.getContext('2d')!;
    rows.forEach((c, i) => g.drawImage(s.debugCanvas, 0, c.row * s.frameH, cv.width, s.frameH, 0, i * s.frameH, cv.width, s.frameH));
    cv.style.cssText = `image-rendering:pixelated;width:${cv.width * zoom}px;flex-shrink:0;background:${bg}`;
    wrap.append(labels, cv);
    root.appendChild(wrap);
  }
}
