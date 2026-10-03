import { getKnightSheet } from '../assets/character/knight/knightSheet';
import { getSkeletonSheet } from '../assets/sprites/chibi/skeletonChibi';
import { cellOf, type SpriteSheet } from '../entities/animation/SpriteSheet';

/**
 * Visualiseur pour l'itération artistique.
 * - `?debug=sprites` : toutes les animations de Varyn et du squelette (une ligne par clip@direction).
 * - `&who=varyn|skeleton` : un seul personnage ; `&clip=heavy` : clips dont le nom commence ainsi ;
 *   `&zoom=3&bg=%23c8c4cc` : agrandissement, fond.
 */
export function showSpriteViewer(root: HTMLElement): void {
  const q = new URLSearchParams(location.search);
  root.innerHTML = '';
  root.style.cssText = 'background:#2a2433;padding:12px;overflow:auto;height:100vh;box-sizing:border-box;font:12px monospace;color:#ffe680';
  const zoom = Number(q.get('zoom') ?? 2);
  const bg = q.get('bg') ?? '#8a8494';
  const who = q.get('who');
  const prefix = q.get('clip') ?? '';
  const sheets: [string, SpriteSheet][] = [];
  if (who !== 'skeleton') sheets.push(['varyn', getKnightSheet()]);
  if (who !== 'varyn') sheets.push(['skeleton', getSkeletonSheet()]);
  for (const [name, s] of sheets) {
    const clips = [...s.clips.values()].filter((c) => c.name.startsWith(prefix));
    if (!clips.length) continue;
    const maxCount = Math.max(...clips.map((c) => c.count));
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:8px;margin-bottom:16px';
    const labels = document.createElement('div');
    labels.innerHTML = clips.map((c) => `<div style="height:${s.frameH * zoom}px;line-height:${s.frameH * zoom}px;white-space:nowrap">${name} · ${c.name}</div>`).join('');
    // Recopie les cellules de chaque clip sur une ligne.
    const cv = document.createElement('canvas');
    cv.width = maxCount * s.frameW;
    cv.height = clips.length * s.frameH;
    const g = cv.getContext('2d')!;
    clips.forEach((c, i) => {
      for (let f = 0; f < c.count; f++) {
        const { col, row } = cellOf(s, c, f);
        g.drawImage(s.pages[c.page].image, col * s.frameW, row * s.frameH, s.frameW, s.frameH, f * s.frameW, i * s.frameH, s.frameW, s.frameH);
      }
    });
    cv.style.cssText = `image-rendering:pixelated;width:${cv.width * zoom}px;flex-shrink:0;background:${bg}`;
    wrap.append(labels, cv);
    root.appendChild(wrap);
  }
}
