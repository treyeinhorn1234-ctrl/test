import * as THREE from 'three';
import { clamp, damp } from '../utils/math';

/** Densité de référence : 16 texels de jeu par unité monde (1 tuile = 2 unités = 32 px). */
export const PIXELS_PER_UNIT = 16;
export const CAMERA_YAW = Math.PI / 4;
export const CAMERA_PITCH = THREE.MathUtils.degToRad(38);
const FOV = 26;

/**
 * Caméra isométrique en perspective légère.
 * - suit une cible avec un lissage exponentiel (aucune secousse),
 * - zoom léger à la molette,
 * - tremblement basé sur un « trauma »,
 * - alignement sur la grille de texels + décalage sous-pixel pour éviter
 *   le scintillement typique du pixel art en mouvement.
 */
export class IsoCamera {
  readonly camera: THREE.PerspectiveCamera;
  /** Point regardé (lissé). */
  readonly focus = new THREE.Vector3();
  private readonly goal = new THREE.Vector3();
  private readonly dir: THREE.Vector3;
  readonly right: THREE.Vector3;
  readonly up: THREE.Vector3;
  /** Direction « haut de l'écran » projetée au sol (pour les déplacements). */
  readonly groundUp: THREE.Vector3;
  readonly groundRight: THREE.Vector3;
  zoom = 1;
  private targetZoom = 1;
  /** Multiplicateur de cadrage imposé par le jeu (boss, cinématiques). */
  private framing = 1;
  private targetFraming = 1;
  private trauma = 0;
  /** Zoom bref à l'impact (« punch »), amorti rapidement. */
  private punchAmount = 0;
  private shakeTime = 0;
  followRate = 7;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 400);
    this.dir = new THREE.Vector3(
      Math.sin(CAMERA_YAW) * Math.cos(CAMERA_PITCH),
      Math.sin(CAMERA_PITCH),
      Math.cos(CAMERA_YAW) * Math.cos(CAMERA_PITCH),
    ).normalize();
    const forward = this.dir.clone().negate();
    this.right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    this.up = new THREE.Vector3().crossVectors(this.right, forward).normalize();
    this.groundUp = new THREE.Vector3(forward.x, 0, forward.z).normalize();
    this.groundRight = new THREE.Vector3(this.right.x, 0, this.right.z).normalize();
    this.camera.up.copy(this.up);
  }

  setTarget(p: THREE.Vector3, snap = false): void {
    this.goal.copy(p);
    if (snap) this.focus.copy(p);
  }

  addZoomInput(steps: number): void {
    this.targetZoom = clamp(this.targetZoom - steps * 0.08, 0.8, 1.35);
  }

  setFraming(f: number): void {
    this.targetFraming = f;
  }

  punch(amount: number): void {
    this.punchAmount = Math.min(0.12, this.punchAmount + amount);
  }

  addTrauma(amount: number): void {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  /** Hauteur visible (unités monde) au niveau du point focal. */
  visibleHeight(targetPixelsY: number): number {
    return targetPixelsY / PIXELS_PER_UNIT / (this.zoom * this.framing * (1 + this.punchAmount));
  }

  update(dt: number, targetSize: THREE.Vector2, subpixelOut: THREE.Vector2): void {
    this.focus.x = damp(this.focus.x, this.goal.x, this.followRate, dt);
    this.focus.y = damp(this.focus.y, this.goal.y, this.followRate, dt);
    this.focus.z = damp(this.focus.z, this.goal.z, this.followRate, dt);
    this.zoom = damp(this.zoom, this.targetZoom, 10, dt);
    this.framing = damp(this.framing, this.targetFraming, 3, dt);
    this.punchAmount = damp(this.punchAmount, 0, 9, dt);

    const cam = this.camera;
    cam.aspect = targetSize.x / targetSize.y;
    const vh = this.visibleHeight(targetSize.y);
    const dist = vh / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    cam.far = dist + 120;
    cam.near = Math.max(1, dist - 60);
    cam.updateProjectionMatrix();

    const pos = this.focus.clone().addScaledVector(this.dir, dist);

    // Tremblement (trauma²) dans le plan de l'écran.
    this.shakeTime += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    const shake = this.trauma * this.trauma * 0.45;
    if (shake > 0) {
      const t = this.shakeTime * 38;
      pos.addScaledVector(this.right, shake * (Math.sin(t * 1.3) + Math.sin(t * 2.9) * 0.5));
      pos.addScaledVector(this.up, shake * (Math.cos(t * 1.7) + Math.sin(t * 3.7) * 0.5));
    }

    // Alignement sur la grille de texels au plan focal.
    const unitsPerTexel = vh / targetSize.y;
    const r = pos.dot(this.right);
    const u = pos.dot(this.up);
    const rs = Math.round(r / unitsPerTexel) * unitsPerTexel;
    const us = Math.round(u / unitsPerTexel) * unitsPerTexel;
    pos.addScaledVector(this.right, rs - r).addScaledVector(this.up, us - u);
    subpixelOut.set(-(rs - r) / unitsPerTexel, -(us - u) / unitsPerTexel);

    cam.position.copy(pos);
    cam.lookAt(pos.clone().sub(this.dir));
    cam.updateMatrixWorld();
  }
}
