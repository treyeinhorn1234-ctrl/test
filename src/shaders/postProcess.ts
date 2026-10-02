/**
 * Shader de post-traitement pixel art.
 * Lit la cible basse résolution au plus proche voisin (aucun flou), puis
 * applique : halo lumineux, tonemapping, étalonnage, vignette, flash de
 * dégâts et tramage ordonné (Bayer) aligné sur la grille de pixels du jeu.
 */
export const postVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const postFragment = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uInternal;   // taille de la cible (marge incluse)
uniform vec2 uView;       // taille visible (sans marge)
uniform vec2 uOffset;     // décalage sous-pixel (texels) pour un scrolling fluide
uniform float uPostLevel;
uniform float uBrightness;
uniform float uSaturation;
uniform float uTime;
uniform vec4 uFlash;      // rgb + intensité (flash de dégâts / magie)
varying vec2 vUv;

vec3 fetch(vec2 cell) {
  return texture2D(tDiffuse, (cell + 0.5) / uInternal).rgb;
}

// Tonemapping ACES (approximation de Narkowicz).
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 toSRGB(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int i = x + y * 4;
  float m[16];
  m[0]=0.0;  m[1]=8.0;  m[2]=2.0;  m[3]=10.0;
  m[4]=12.0; m[5]=4.0;  m[6]=14.0; m[7]=6.0;
  m[8]=3.0;  m[9]=11.0; m[10]=1.0; m[11]=9.0;
  m[12]=15.0;m[13]=7.0; m[14]=13.0;m[15]=5.0;
  for (int k = 0; k < 16; k++) { if (k == i) return m[k] / 16.0 - 0.5; }
  return 0.0;
}

void main() {
  vec2 texel = vUv * uView + 1.0 + uOffset;
  vec2 cell = floor(texel);
  vec3 col = fetch(cell);

  if (uPostLevel > 1.5) {
    // Halo : on additionne les parties lumineuses du voisinage (en texels de jeu).
    vec3 glow = vec3(0.0);
    const float T = 0.9;
    glow += max(fetch(cell + vec2( 2.0, 0.0)) - T, 0.0);
    glow += max(fetch(cell + vec2(-2.0, 0.0)) - T, 0.0);
    glow += max(fetch(cell + vec2( 0.0, 2.0)) - T, 0.0);
    glow += max(fetch(cell + vec2( 0.0,-2.0)) - T, 0.0);
    glow += max(fetch(cell + vec2( 3.0, 3.0)) - T, 0.0) * 0.7;
    glow += max(fetch(cell + vec2(-3.0, 3.0)) - T, 0.0) * 0.7;
    glow += max(fetch(cell + vec2( 3.0,-3.0)) - T, 0.0) * 0.7;
    glow += max(fetch(cell + vec2(-3.0,-3.0)) - T, 0.0) * 0.7;
    glow += max(fetch(cell + vec2( 6.0, 0.0)) - T, 0.0) * 0.45;
    glow += max(fetch(cell + vec2(-6.0, 0.0)) - T, 0.0) * 0.45;
    glow += max(fetch(cell + vec2( 0.0, 6.0)) - T, 0.0) * 0.45;
    glow += max(fetch(cell + vec2( 0.0,-6.0)) - T, 0.0) * 0.45;
    col += glow * 0.16;
  }

  col *= uBrightness;
  col = aces(col * 1.15);

  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, uSaturation);

  if (uPostLevel > 0.5) {
    // Étalonnage dark fantasy : ombres froides violacées, hautes lumières chaudes.
    vec3 shadowTint = vec3(0.07, 0.04, 0.10);
    vec3 highTint = vec3(1.06, 0.98, 0.90);
    col = mix(col + shadowTint * (1.0 - luma) * 0.35, col * highTint, smoothstep(0.25, 0.9, luma));
    // Contraste léger.
    col = (col - 0.5) * 1.08 + 0.5;
    // Vignette.
    vec2 d = vUv - 0.5;
    d.x *= uView.x / uView.y;
    float v = smoothstep(0.95, 0.35, length(d));
    col *= mix(0.55, 1.0, v);
    // Flash (dégâts, puissance) concentré sur les bords.
    col = mix(col, uFlash.rgb, uFlash.a * (1.0 - v * 0.75));
  } else {
    col = mix(col, uFlash.rgb, uFlash.a * 0.5);
  }

  col = toSRGB(clamp(col, 0.0, 1.0));

  if (uPostLevel > 1.5) {
    // Quantification tramée : palette réduite, typique du pixel art.
    float levels = 28.0;
    col = floor(col * levels + 0.5 + bayer4(cell) * 0.9) / levels;
  }

  gl_FragColor = vec4(col, 1.0);
}
`;
