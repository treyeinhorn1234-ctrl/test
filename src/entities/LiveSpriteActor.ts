import * as THREE from 'three';
import { CAMERA_YAW } from '../rendering/IsoCamera';
import { createSpriteMaterial, type SpriteUniforms } from '../rendering/SpriteMaterial';
import { AnimationPlayer, type ClipSource } from './animation/AnimationPlayer';
import type { Actor } from './Actor';
import { tiltSpriteNormals, VERTICAL_STRETCH } from './SpriteActor';

export interface LiveFrameSource<V extends string> extends ClipSource {
  frameW: number;
  frameH: number;
  pivotX: number;
  pivotY: number;
  pixelsPerUnit: number;
  get(clip: string, frame: number, view: V): { color: ImageData; emissive: ImageData };
  viewFor(screenX: number, screenUp: number): { view: V; flip: boolean };
}

/**
 * Sprite rendu en direct : à chaque changement de frame ou de direction, la
 * pose est rendue par le rig (avec cache) puis envoyée dans une texture.
 * Permet 8 directions sans planche géante en mémoire.
 */
export class LiveSpriteActor<V extends string> implements Actor {
  readonly root = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly anim: AnimationPlayer;
  readonly uniforms: SpriteUniforms;
  readonly material: THREE.MeshLambertMaterial;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly emCanvas: HTMLCanvasElement;
  private readonly emCtx: CanvasRenderingContext2D;
  private readonly colorTex: THREE.CanvasTexture;
  private readonly emTex: THREE.CanvasTexture;
  private readonly shadow: THREE.Mesh;
  private view: V;
  private flip = false;
  private lastKey = '';
  private ghosts: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture }[] = [];

  constructor(
    private readonly source: LiveFrameSource<V>,
    initialClip: string,
    initialView: V,
    shadowRadius = 0.9,
    depthBias = 1.1,
    emissiveIntensity = 1.6,
    fillLight = 1.0,
  ) {
    this.view = initialView;
    const mk = () => {
      const c = document.createElement('canvas');
      c.width = source.frameW;
      c.height = source.frameH;
      return c;
    };
    this.canvas = mk();
    this.emCanvas = mk();
    this.ctx = this.canvas.getContext('2d')!;
    this.emCtx = this.emCanvas.getContext('2d')!;
    const tex = (c: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    this.colorTex = tex(this.canvas);
    this.emTex = tex(this.emCanvas);
    const { material, uniforms } = createSpriteMaterial(this.colorTex, this.emTex, new THREE.Vector2(source.frameW, source.frameH), {
      depthBias, emissiveIntensity, fillLight,
    });
    this.material = material;
    this.uniforms = uniforms;

    const w = source.frameW / source.pixelsPerUnit;
    const h = (source.frameH / source.pixelsPerUnit) * VERTICAL_STRETCH;
    const geo = new THREE.PlaneGeometry(w, h);
    const px = (source.pivotX + 0.5) / source.frameW;
    const py = (source.pivotY + 1) / source.frameH;
    geo.translate(w * (0.5 - px), h * (py - 0.5), 0);
    tiltSpriteNormals(geo);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.rotation.y = CAMERA_YAW;
    this.root.add(this.mesh);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(shadowRadius, 14),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.scale.y = 0.6;
    this.shadow.position.y = 0.02;
    this.root.add(this.shadow);

    this.anim = new AnimationPlayer(source, initialClip);
    this.refresh();
  }

  setFacing(screenX: number, screenUp: number): void {
    if (Math.hypot(screenX, screenUp) < 0.2) return;
    const { view, flip } = this.source.viewFor(screenX, screenUp);
    this.view = view;
    this.flip = flip;
  }

  setShadowOpacity(o: number): void {
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = o;
  }

  private refresh(): void {
    const key = `${this.anim.clip.name}|${this.anim.frame}|${this.view}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      const f = this.source.get(this.anim.clip.name, this.anim.frame, this.view);
      this.ctx.putImageData(f.color, 0, 0);
      this.emCtx.putImageData(f.emissive, 0, 0);
      this.colorTex.needsUpdate = true;
      this.emTex.needsUpdate = true;
    }
    for (const t of [this.colorTex, this.emTex]) {
      t.repeat.x = this.flip ? -1 : 1;
      t.offset.x = this.flip ? 1 : 0;
    }
  }

  update(dt: number): void {
    this.anim.update(dt);
    this.refresh();
  }

  ghostTexture(slot: number): THREE.Texture {
    let g = this.ghosts[slot];
    if (!g) {
      const canvas = document.createElement('canvas');
      canvas.width = this.canvas.width;
      canvas.height = this.canvas.height;
      const tex = new THREE.CanvasTexture(canvas);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      g = { canvas, tex };
      this.ghosts[slot] = g;
    }
    const ctx = g.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, g.canvas.width, g.canvas.height);
    ctx.drawImage(this.canvas, 0, 0);
    g.tex.repeat.x = this.flip ? -1 : 1;
    g.tex.offset.x = this.flip ? 1 : 0;
    g.tex.needsUpdate = true;
    return g.tex;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.colorTex.dispose();
    this.emTex.dispose();
    for (const g of this.ghosts) g.tex.dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
  }
}
