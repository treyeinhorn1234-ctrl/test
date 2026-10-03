import type * as THREE from 'three';
import type { SpriteUniforms } from '../rendering/SpriteMaterial';
import type { AnimationPlayer } from './animation/AnimationPlayer';

/**
 * Représentation visuelle d'une entité (implémentée par SpriteActor).
 */
export interface Actor {
  readonly root: THREE.Group;
  readonly mesh: THREE.Mesh;
  readonly anim: AnimationPlayer;
  readonly uniforms: SpriteUniforms;
  readonly material: THREE.MeshLambertMaterial;
  update(dt: number): void;
  /** Orientation à l'écran : composantes droite / haut de la direction regardée. */
  setFacing(screenX: number, screenUp: number): void;
  setShadowOpacity(o: number): void;
  /** Copie de l'image courante pour une image rémanente (emplacement 0..5). */
  ghostTexture(slot: number): THREE.Texture;
  dispose(): void;
}
