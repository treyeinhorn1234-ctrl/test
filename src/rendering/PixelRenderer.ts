import * as THREE from 'three';
import { postFragment, postVertex } from '../shaders/postProcess';
import type { GraphicsSettings } from '../core/Settings';
import { QUALITY_PRESETS } from '../core/Settings';

/**
 * Rendu pixel art : la scène est rendue dans une cible basse résolution
 * (taille écran / pixelSize), puis agrandie au plus proche voisin avec un
 * shader de post-traitement. Une marge d'un texel permet un décalage
 * sous-pixel qui rend le suivi de caméra fluide sans scintillement.
 */
export class PixelRenderer {
  readonly renderer: THREE.WebGLRenderer;
  private target: THREE.WebGLRenderTarget;
  private postScene = new THREE.Scene();
  private postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private postMaterial: THREE.ShaderMaterial;
  /** Résolution visible interne (sans marge). */
  readonly view = new THREE.Vector2(1, 1);
  /** Décalage sous-pixel, en texels, fourni par la caméra. */
  readonly subpixel = new THREE.Vector2();
  private flash = new THREE.Vector4(0, 0, 0, 0);
  private flashDecay = 4;
  private settings: GraphicsSettings;

  constructor(container: HTMLElement, settings: GraphicsSettings) {
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.classList.add('game-canvas');
    container.appendChild(this.renderer.domElement);

    this.target = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
      depthBuffer: true,
    });

    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: postVertex,
      fragmentShader: postFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: this.target.texture },
        uInternal: { value: new THREE.Vector2(2, 2) },
        uView: { value: this.view },
        uOffset: { value: this.subpixel },
        uPostLevel: { value: 2 },
        uBrightness: { value: 1 },
        uSaturation: { value: 1 },
        uTime: { value: 0 },
        uFlash: { value: this.flash },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
    quad.frustumCulled = false;
    this.postScene.add(quad);

    this.applySettings(settings);
    window.addEventListener('resize', () => this.resize());
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** Taille de la cible de rendu (marge incluse) — utilisée pour l'aspect caméra. */
  get targetSize(): THREE.Vector2 {
    return new THREE.Vector2(this.view.x + 2, this.view.y + 2);
  }

  applySettings(s: GraphicsSettings): void {
    this.settings = s;
    const preset = QUALITY_PRESETS[s.quality];
    this.renderer.shadowMap.enabled = preset.shadows > 0;
    const u = this.postMaterial.uniforms;
    u.uPostLevel.value = s.postLevel;
    u.uBrightness.value = s.brightness;
    u.uSaturation.value = s.saturation;
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    const ps = Math.max(1, Math.round(this.settings.pixelSize));
    this.view.set(Math.max(1, Math.ceil(w / ps)), Math.max(1, Math.ceil(h / ps)));
    this.target.setSize(this.view.x + 2, this.view.y + 2);
    this.postMaterial.uniforms.uInternal.value.set(this.view.x + 2, this.view.y + 2);
  }

  /** Déclenche un flash coloré plein écran (dégâts reçus, montée de niveau…). */
  triggerFlash(color: THREE.ColorRepresentation, strength: number, decay = 4): void {
    const c = new THREE.Color(color);
    this.flash.set(c.r, c.g, c.b, Math.max(this.flash.w, strength));
    this.flashDecay = decay;
  }

  render(scene: THREE.Scene, camera: THREE.Camera, dt: number, time: number): void {
    this.flash.w = Math.max(0, this.flash.w - dt * this.flashDecay);
    this.postMaterial.uniforms.uTime.value = time;
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }

  dispose(): void {
    this.target.dispose();
    this.postMaterial.dispose();
    this.renderer.dispose();
  }
}
