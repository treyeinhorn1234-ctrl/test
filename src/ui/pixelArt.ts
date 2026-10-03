import { PAL } from '../assets/palette';
import { PixelCanvas } from '../assets/pixel/PixelCanvas';
import { knightPortraitSource } from '../assets/character/knight/knightSheet';

/**
 * Éléments graphiques de l'interface générés en pixel art : cadres 9-slice,
 * portrait de Varyn et icônes de capacités. Injectés en variables CSS.
 */
function frame(size: number, slice: number, colors: { outer: number; iron: number; dark: number; accent: number }, bg: [number, number, number, number]): string {
  const c = new PixelCanvas(size, size);
  const [r, g, b, a] = bg;
  c.rect(0, 0, size, size, (r << 16) | (g << 8) | b, a);
  const ring = (i: number, col: number) => {
    c.line(i, i, size - 1 - i, i, col);
    c.line(i, size - 1 - i, size - 1 - i, size - 1 - i, col);
    c.line(i, i, i, size - 1 - i, col);
    c.line(size - 1 - i, i, size - 1 - i, size - 1 - i, col);
  };
  ring(0, colors.outer);
  ring(1, colors.iron);
  ring(2, colors.dark);
  // Ombre interne en bas / lueur en haut.
  c.line(3, 3, size - 4, 3, colors.accent, 1, 90);
  // Coins ornés.
  for (const [x, y] of [[1, 1], [size - 2 - slice + 3, 1], [1, size - 2 - slice + 3], [size - 2 - slice + 3, size - 2 - slice + 3]]) {
    c.rect(x, y, slice - 2, slice - 2, colors.iron);
    c.rect(x + 1, y + 1, slice - 4, slice - 4, colors.dark);
    c.px(x + Math.floor((slice - 2) / 2), y + Math.floor((slice - 2) / 2) - 1, colors.accent);
    c.px(x + Math.floor((slice - 2) / 2) - 1, y + Math.floor((slice - 2) / 2), colors.accent);
    c.px(x + Math.floor((slice - 2) / 2) + 1, y + Math.floor((slice - 2) / 2), colors.accent);
    c.px(x + Math.floor((slice - 2) / 2), y + Math.floor((slice - 2) / 2) + 1, colors.accent);
    c.px(x + Math.floor((slice - 2) / 2), y + Math.floor((slice - 2) / 2), 0xfff0c0);
  }
  return c.toDataURL();
}

/** Portrait de Varyn : recadrage du heaume sur la première frame du sprite. */
export function portrait(): string {
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 40;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(20, 26, 2, 20, 26, 26);
  g.addColorStop(0, '#3a1a5e');
  g.addColorStop(1, '#120a1c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 40, 40);
  ctx.imageSmoothingEnabled = false;
  const r = knightPortraitSource();
  ctx.drawImage(r.image, r.x, r.y, r.w, r.h, 0, 0, 40, 40);
  return c.toDataURL();
}

type IconName = 'light' | 'heavy' | 'dodge' | 'claw' | 'chains' | 'storm' | 'lock';

export function icon(name: IconName): string {
  const c = new PixelCanvas(16, 16);
  switch (name) {
    case 'light':
      c.line(3, 13, 12, 4, PAL.steelEdge, 2);
      c.line(4, 13, 13, 4, PAL.armor3);
      c.line(2, 10, 6, 14, PAL.gold1, 1);
      c.px(2, 14, PAL.wood1);
      break;
    case 'heavy':
      c.line(3, 13, 12, 3, PAL.armor3, 3);
      c.line(4, 12, 12, 4, PAL.steelEdge);
      c.line(1, 10, 6, 15, PAL.gold1);
      for (let a = 0; a < 6; a++) c.px(8 + Math.cos(a) * 6, 9 + Math.sin(a) * 6, PAL.void2);
      break;
    case 'dodge':
      for (let k = 0; k < 3; k++) c.line(2 + k, 4 + k * 3, 9 + k, 4 + k * 3, k === 1 ? PAL.void3 : PAL.void1);
      c.disc(12, 8, 2.5, PAL.armor3);
      c.px(13, 7, PAL.ember1);
      break;
    case 'claw':
      for (let k = -1; k <= 1; k++) {
        c.line(3, 4 + k * 4 + 4, 13, 1 + k * 4 + 4, PAL.void2);
        c.line(4, 5 + k * 4 + 4, 12, 3 + k * 4 + 4, PAL.void3);
      }
      break;
    case 'chains':
      for (let i = 0; i < 4; i++) c.ellipse(3 + i * 3.4, 8 + (i % 2 ? 1 : -1), 2, 1.5, i % 2 ? PAL.void1 : PAL.armor3);
      break;
    case 'storm':
      c.disc(8, 8, 5, PAL.void0);
      c.disc(8, 8, 3, PAL.void1);
      c.px(8, 8, PAL.void3);
      c.line(8, 1, 6, 6, PAL.void3);
      break;
    case 'lock':
      c.rect(4, 7, 8, 7, PAL.armor3);
      c.rect(5, 3, 6, 5, PAL.armor2);
      for (let y = 4; y < 7; y++) for (let x = 7; x < 9; x++) c.clearPx(x, y);
      c.px(8, 10, PAL.ink);
      c.px(8, 11, PAL.ink);
      break;
  }
  c.outline(PAL.ink);
  return c.toDataURL();
}

/** Injecte les cadres et motifs générés dans des variables CSS. */
export function installUiArt(): void {
  const root = document.documentElement.style;
  const iron = { outer: PAL.ink, iron: PAL.stone4, dark: PAL.stone1, accent: PAL.gold1 };
  root.setProperty('--frame', `url(${frame(18, 6, iron, [12, 9, 18, 235])})`);
  root.setProperty('--frame-slot', `url(${frame(12, 4, { ...iron, accent: PAL.stone5 }, [8, 6, 12, 230])})`);
  root.setProperty('--frame-blood', `url(${frame(18, 6, { outer: PAL.ink, iron: PAL.cape2, dark: PAL.cape0, accent: PAL.ember1 }, [16, 6, 10, 240])})`);
  root.setProperty('--frame-void', `url(${frame(18, 6, { outer: PAL.ink, iron: PAL.void0, dark: PAL.inkSoft, accent: PAL.void2 }, [14, 8, 24, 235])})`);
}
