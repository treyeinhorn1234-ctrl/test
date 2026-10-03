import { getSkeletonSheet } from '../assets/sprites/skeletonSprite';
import { FRAME_H, FRAME_W, renderPose, VARYN_CLIPS, type View } from '../assets/character/varynCharacter';

/**
 * Visualiseur pour l'itération artistique.
 * - `?debug=sprites` : Varyn, 8 directions × frames du clip `clip` (idle par défaut)
 *   et la planche du squelette.
 * - `&clip=attack1&zoom=3&bg=%23c8c4cc` : clip, agrandissement, fond.
 */
const DIRS: { label: string; view: View; flip: boolean }[] = [
  { label: 'N', view: 'N', flip: false }, { label: 'NE', view: 'NE', flip: false },
  { label: 'E', view: 'E', flip: false }, { label: 'SE', view: 'SE', flip: false },
  { label: 'S', view: 'S', flip: false }, { label: 'SW', view: 'SE', flip: true },
  { label: 'W', view: 'E', flip: true }, { label: 'NW', view: 'NE', flip: true },
];

export function showSpriteViewer(root: HTMLElement): void {
  const q = new URLSearchParams(location.search);
  root.innerHTML = '';
  root.style.cssText = 'background:#2a2433;padding:12px;overflow:auto;height:100vh;box-sizing:border-box';
  const clipName = q.get('clip') ?? 'idle';
  const zoom = Number(q.get('zoom') ?? 2);
  const clip = VARYN_CLIPS.find((c) => c.name === clipName) ?? VARYN_CLIPS[0];
  const cv = document.createElement('canvas');
  const n = clip.frames.length;
  cv.width = n * FRAME_W * zoom;
  cv.height = DIRS.length * FRAME_H * zoom;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = q.get('bg') ?? '#8a8494';
  ctx.fillRect(0, 0, cv.width, cv.height);
  DIRS.forEach((d, row) => {
    clip.frames.forEach((pose, col) => {
      const img = renderPose(pose, d.view, (col / n) * Math.PI * 2).color.toCanvas();
      ctx.save();
      const x = col * FRAME_W * zoom;
      const y = row * FRAME_H * zoom;
      if (d.flip) {
        ctx.translate(x + FRAME_W * zoom, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, FRAME_W * zoom, FRAME_H * zoom);
      } else ctx.drawImage(img, x, y, FRAME_W * zoom, FRAME_H * zoom);
      ctx.restore();
    });
    ctx.fillStyle = '#ffe680';
    ctx.font = `${12 * zoom}px monospace`;
    ctx.fillText(d.label, 4, row * FRAME_H * zoom + 14 * zoom);
  });
  root.appendChild(cv);
  if (q.get('who') === 'skeleton') {
    const s = getSkeletonSheet().debugCanvas;
    s.style.cssText = `image-rendering:pixelated;width:${s.width * 2}px;background:#8a8494;display:block;margin-top:12px`;
    root.appendChild(s);
  }
}
