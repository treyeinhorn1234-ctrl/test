import * as THREE from 'three';

/**
 * Matériau des sprites : Lambert (éclairé par torches et magie) + carte
 * d'émission, enrichi par shader :
 * - flash de dégâts (mélange vers une couleur),
 * - dissolution pixel par pixel (mort des ennemis) avec liseré lumineux,
 * - teinte (esquive dans l'ombre, invulnérabilité…),
 * - biais de profondeur vers la caméra pour éviter que les panneaux
 *   verticaux ne s'enfoncent dans les murs proches.
 */
export interface SpriteUniforms {
  uFlash: { value: number };
  uFlashColor: { value: THREE.Color };
  uDissolve: { value: number };
  uDissolveColor: { value: THREE.Color };
  uTint: { value: THREE.Color };
  uTintAmount: { value: number };
  uSheetSize: { value: THREE.Vector2 };
  uDepthBias: { value: number };
  /** Lumière de remplissage : garde les personnages lisibles dans le noir. */
  uFillLight: { value: number };
}

export function createSpriteMaterial(
  map: THREE.Texture,
  emissiveMap: THREE.Texture | undefined,
  sheetPixels: THREE.Vector2,
  opts: { depthBias?: number; emissiveIntensity?: number; transparent?: boolean; fillLight?: number } = {},
): { material: THREE.MeshLambertMaterial; uniforms: SpriteUniforms } {
  const material = new THREE.MeshLambertMaterial({
    map,
    emissiveMap: emissiveMap ?? null,
    emissive: emissiveMap ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 1.6,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    transparent: opts.transparent ?? false,
  });
  const uniforms: SpriteUniforms = {
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(0xffffff) },
    uDissolve: { value: 0 },
    uDissolveColor: { value: new THREE.Color(0xa974ff) },
    uTint: { value: new THREE.Color(0x000000) },
    uTintAmount: { value: 0 },
    uSheetSize: { value: sheetPixels },
    uDepthBias: { value: opts.depthBias ?? 0.6 },
    uFillLight: { value: opts.fillLight ?? 0 },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uDepthBias;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 biasedMv = mvPosition;
        biasedMv.z += uDepthBias;
        gl_Position = projectionMatrix * biasedMv;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uFlash;
        uniform vec3 uFlashColor;
        uniform float uDissolve;
        uniform vec3 uDissolveColor;
        uniform vec3 uTint;
        uniform float uTintAmount;
        uniform vec2 uSheetSize;
        uniform float uFillLight;
        float pxHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`,
      )
      .replace(
        '#include <alphatest_fragment>',
        `#include <alphatest_fragment>
        float dissolveEdge = 0.0;
        if (uDissolve > 0.0) {
          vec2 cell = floor(vMapUv * uSheetSize);
          float n = pxHash(cell);
          if (n < uDissolve) discard;
          dissolveEdge = step(n, uDissolve + 0.12);
        }`,
      )
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight += diffuseColor.rgb * uFillLight;
        outgoingLight = mix(outgoingLight, uTint, uTintAmount);
        outgoingLight = mix(outgoingLight, uFlashColor * 0.9, uFlash);
        outgoingLight = mix(outgoingLight, uDissolveColor * 3.0, dissolveEdge);
        #include <opaque_fragment>`,
      );
  };
  // Clé de cache commune : tous les sprites partagent le même programme.
  material.customProgramCacheKey = () => 'ashen-sprite';
  return { material, uniforms };
}
