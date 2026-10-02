import * as THREE from 'three';
import { CAMERA_PITCH, CAMERA_YAW, PIXELS_PER_UNIT } from '../rendering/IsoCamera';
import { createSpriteMaterial, type SpriteUniforms } from '../rendering/SpriteMaterial';
import { AnimationPlayer } from './animation/AnimationPlayer';
import type { SpriteSheet } from './animation/SpriteSheet';

/** Compensation du raccourci vertical : un panneau vertical vu à CAMERA_PITCH. */
export const VERTICAL_STRETCH = 1 / Math.cos(CAMERA_PITCH);

/**
 * Oriente les normales d'un panneau vers la caméra ET vers le haut : les
 * sprites captent ainsi la lumière des torches placées au-dessus d'eux.
 */
export function tiltSpriteNormals(geo: THREE.BufferGeometry): void {
  const n = geo.getAttribute('normal') as THREE.BufferAttribute;
  const v = new THREE.Vector3(0, 0.75, 1).normalize();
  for (let i = 0; i < n.count; i++) n.setXYZ(i, v.x, v.y, v.z);
  n.needsUpdate = true;
}

/**
 * Représentation visuelle d'un personnage : panneau vertical orienté vers la
 * caméra, pivot aux pieds, animé depuis une planche de sprites, avec ombre
 * portée en pastille. Le miroir horizontal gère l'orientation gauche/droite.
 */
export class SpriteActor {
  readonly root = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly anim: AnimationPlayer;
  readonly uniforms: SpriteUniforms;
  private readonly colorTex: THREE.Texture;
  private readonly emissiveTex: THREE.Texture;
  private readonly shadow: THREE.Mesh;
  readonly material: THREE.MeshLambertMaterial;
  flipX = false;
  /** Décalage vertical visuel (sauts, lévitation). */
  lift = 0;

  constructor(readonly sheet: SpriteSheet, initialClip: string, shadowRadius = 0.6) {
    this.colorTex = sheet.color.clone();
    this.emissiveTex = sheet.emissive.clone();
    const { material, uniforms } = createSpriteMaterial(
      this.colorTex,
      this.emissiveTex,
      new THREE.Vector2(sheet.cols * sheet.frameW, sheet.rows * sheet.frameH),
    );
    this.material = material;
    this.uniforms = uniforms;

    const w = sheet.frameW / PIXELS_PER_UNIT;
    const h = (sheet.frameH / PIXELS_PER_UNIT) * VERTICAL_STRETCH;
    const geo = new THREE.PlaneGeometry(w, h);
    // Pivot : (pivotX, pivotY) de la frame à l'origine.
    const px = (sheet.pivotX + 0.5) / sheet.frameW;
    const py = (sheet.pivotY + 1) / sheet.frameH;
    geo.translate(w * (0.5 - px), h * (py - 0.5), 0);
    tiltSpriteNormals(geo);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.rotation.y = CAMERA_YAW;
    this.mesh.frustumCulled = true;
    this.root.add(this.mesh);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(shadowRadius, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.scale.y = 0.6;
    this.shadow.position.y = 0.02;
    this.shadow.renderOrder = 1;
    this.root.add(this.shadow);

    this.anim = new AnimationPlayer(sheet, initialClip);
    this.applyFrame();
  }

  /** Copie la frame courante (UV) vers une autre texture de la même planche. */
  copyFrameTo(tex: THREE.Texture): void {
    tex.repeat.copy(this.colorTex.repeat);
    tex.offset.copy(this.colorTex.offset);
  }

  setShadowOpacity(o: number): void {
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = o;
  }

  update(dt: number): void {
    this.anim.update(dt);
    this.applyFrame();
    this.mesh.position.y = this.lift;
  }

  private applyFrame(): void {
    const s = this.sheet;
    const col = this.anim.frame;
    const row = this.anim.clip.row;
    const fw = 1 / s.cols;
    const fh = 1 / s.rows;
    const y = 1 - (row + 1) * fh;
    for (const t of [this.colorTex, this.emissiveTex]) {
      if (this.flipX) {
        t.repeat.set(-fw, fh);
        t.offset.set((col + 1) * fw, y);
      } else {
        t.repeat.set(fw, fh);
        t.offset.set(col * fw, y);
      }
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.colorTex.dispose();
    this.emissiveTex.dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
  }
}
