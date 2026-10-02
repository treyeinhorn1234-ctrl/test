import * as THREE from 'three';

/**
 * Toile de pixel art procédurale : primitives (pixels, rectangles, lignes,
 * disques, polygones), contour automatique et conversion en texture Three.js
 * filtrée au plus proche voisin. Tous les visuels du prototype sont générés
 * ainsi : aucun asset externe, et chaque générateur peut être remplacé par
 * une vraie planche de sprites (PNG) sans toucher au reste du code.
 */
export class PixelCanvas {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Écrit un pixel (couleur 0xRRGGBB). Les alphas < 255 sont mélangés. */
  px(x: number, y: number, color: number, alpha = 255): void {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inBounds(x, y)) return;
    const i = (y * this.width + x) * 4;
    const r = (color >> 16) & 255;
    const g = (color >> 8) & 255;
    const b = color & 255;
    if (alpha >= 255) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = 255;
    } else {
      const a = alpha / 255;
      const da = this.data[i + 3] / 255;
      const oa = a + da * (1 - a);
      if (oa <= 0) return;
      this.data[i] = (r * a + this.data[i] * da * (1 - a)) / oa;
      this.data[i + 1] = (g * a + this.data[i + 1] * da * (1 - a)) / oa;
      this.data[i + 2] = (b * a + this.data[i + 2] * da * (1 - a)) / oa;
      this.data[i + 3] = oa * 255;
    }
  }

  alphaAt(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0;
    return this.data[(y * this.width + x) * 4 + 3];
  }

  colorAt(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0;
    const i = (y * this.width + x) * 4;
    return (this.data[i] << 16) | (this.data[i + 1] << 8) | this.data[i + 2];
  }

  clearPx(x: number, y: number): void {
    if (!this.inBounds(x, y)) return;
    this.data[(y * this.width + x) * 4 + 3] = 0;
  }

  rect(x: number, y: number, w: number, h: number, color: number, alpha = 255): void {
    x = Math.round(x);
    y = Math.round(y);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, color, alpha);
  }

  /** Ligne de Bresenham avec un pinceau carré de taille `size`. */
  line(x0: number, y0: number, x1: number, y1: number, color: number, size = 1, alpha = 255): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const off = Math.floor((size - 1) / 2);
    for (;;) {
      if (size === 1) this.px(x0, y0, color, alpha);
      else this.rect(x0 - off, y0 - off, size, size, color, alpha);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  disc(cx: number, cy: number, r: number, color: number, alpha = 255): void {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.px(x, y, color, alpha);
      }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: number, alpha = 255): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, color, alpha);
      }
  }

  /** Remplit un polygone (test pair-impair au centre de chaque pixel). */
  poly(points: ReadonlyArray<readonly [number, number]>, color: number, alpha = 255): void {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++)
      for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
        const tx = x + 0.5;
        const ty = y + 0.5;
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [xi, yi] = points[i];
          const [xj, yj] = points[j];
          if (yi > ty !== yj > ty && tx < ((xj - xi) * (ty - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.px(x, y, color, alpha);
      }
  }

  /** Ajoute un contour d'1 pixel autour des zones opaques (4-voisinage). */
  outline(color: number, onlyIfEmpty = true): void {
    const w = this.width;
    const h = this.height;
    const marks: number[] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (onlyIfEmpty && this.alphaAt(x, y) > 0) continue;
        if (
          this.alphaAt(x - 1, y) > 128 ||
          this.alphaAt(x + 1, y) > 128 ||
          this.alphaAt(x, y - 1) > 128 ||
          this.alphaAt(x, y + 1) > 128
        )
          marks.push(x, y);
      }
    for (let i = 0; i < marks.length; i += 2) this.px(marks[i], marks[i + 1], color);
  }

  /** Copie une autre toile (avec miroir horizontal optionnel). */
  blit(src: PixelCanvas, dx: number, dy: number, flipX = false): void {
    for (let y = 0; y < src.height; y++)
      for (let x = 0; x < src.width; x++) {
        const sx = flipX ? src.width - 1 - x : x;
        const a = src.alphaAt(sx, y);
        if (a === 0) continue;
        this.px(dx + x, dy + y, src.colorAt(sx, y), a);
      }
  }

  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.width;
    c.height = this.height;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(this.width, this.height);
    img.data.set(this.data);
    ctx.putImageData(img, 0, 0);
    return c;
  }

  toDataURL(): string {
    return this.toCanvas().toDataURL();
  }

  toTexture(srgb = true): THREE.CanvasTexture {
    const tex = new THREE.CanvasTexture(this.toCanvas());
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return tex;
  }
}

/** Mélange deux couleurs 0xRRGGBB. */
export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Assombrit (t<0) ou éclaircit (t>0) une couleur. */
export function shade(c: number, t: number): number {
  return t >= 0 ? mixColor(c, 0xffffff, t) : mixColor(c, 0x000000, -t);
}
