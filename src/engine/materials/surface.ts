/**
 * The Strongroom surface shader.
 *
 * Every weapon part is a two-layer surface: a coating (factory finish or skin
 * paint) over a substrate (bare steel, raw polymer, raw wood). A single wear
 * value drives where the coating has been knocked off:
 *
 *   - sharp convex edges go first. Curvature is measured per pixel from
 *     screen-space derivatives of the object-space normal, so it needs no
 *     baked maps and follows whatever geometry the kit produces
 *   - then scratches, then broad blotches from a noise atlas
 *   - a primer ring is left around each chip, the coating loses its clearcoat
 *     and gloss as it ages, and exposed steel picks up rust at high wear
 *
 * Patterns are projected in weapon space (millimetres), so one texture wraps a
 * whole weapon regardless of how many meshes it is built from.
 *
 * Implemented as a patch on MeshPhysicalMaterial so lighting, environment
 * reflections, clearcoat and iridescence all stay physically based.
 */
import * as THREE from 'three';
import { getNoiseTexture } from '../textures';

export interface Substrate {
  color: THREE.ColorRepresentation;
  metalness: number;
  roughness: number;
  /** 0..1: how readily the bare material rusts at high wear. */
  rust?: number;
}

export interface SurfaceSpec {
  /** Coating tint. Multiplies the pattern when one is set. */
  color?: THREE.ColorRepresentation;
  pattern?: THREE.Texture | null;
  /** Size of one pattern tile in millimetres [width, height]. */
  patSize?: readonly [number, number];
  /** Pattern rotation in degrees and UV offset. */
  patRot?: number;
  patOffset?: readonly [number, number];
  metalness: number;
  roughness: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  iridescence?: number;
  iridescenceIOR?: number;
  iridescenceRange?: readonly [number, number];
  sheen?: number;
  sheenColor?: THREE.ColorRepresentation;
  /** Pattern luminance window that switches to a second metalness / roughness (inlays, foils). */
  mask?: { lo: number; hi: number; metalness: number; roughness: number };
  /** Emissive tint applied through the mask (requires `mask`). */
  glow?: THREE.ColorRepresentation;
  glowStrength?: number;
  /** Micro-relief of the coating in mm (orange peel, cast texture, stippling). */
  grain?: number;
  /** Colour left around chips. */
  primer?: THREE.ColorRepresentation;
  sub: Substrate;
  /** Multiplier on the item's wear for this part (grips wear faster than receivers). */
  wearScale?: number;
  envIntensity?: number;
}

const VERT_PARS = /* glsl */ `
varying vec3 sgP;
varying vec3 sgN;
`;

const VERT_MAIN = /* glsl */ `
sgP = position;
sgN = normal;
`;

const FRAG_PARS = /* glsl */ `
varying vec3 sgP;
varying vec3 sgN;
uniform mat3 normalMatrix;
uniform sampler2D sgNoise;
uniform float sgWear;
uniform float sgSeed;
uniform vec3 sgCoatColor;
uniform vec3 sgCoatProps;
uniform vec3 sgSubColor;
uniform vec3 sgSubProps;
uniform vec3 sgPrimer;
#ifdef SG_PATTERN
uniform sampler2D sgPattern;
uniform vec4 sgPatXf;
uniform vec2 sgPatRot;
#endif
#ifdef SG_MASK
uniform vec4 sgMask;
uniform vec3 sgGlowColor;
#endif

vec3 sgAlbedo;
float sgMetal;
float sgRough;
float sgCoatAlive;
float sgHeight;
vec3 sgGlow;

vec3 sgTriW(vec3 n) {
  vec3 w = abs(n);
  w = w * w * w * w;
  return w / (w.x + w.y + w.z + 1e-5);
}

vec4 sgTri(sampler2D t, vec3 p, vec3 w) {
  return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z;
}

#ifdef SG_PATTERN
vec2 sgPatUV(vec2 q) {
  q = vec2(q.x * sgPatRot.x - q.y * sgPatRot.y, q.x * sgPatRot.y + q.y * sgPatRot.x);
  return q * sgPatXf.xy + sgPatXf.zw;
}
// Side projection that folds over onto top and end faces, like a dipped film.
vec3 sgPat(vec3 p, vec3 w) {
  // No branching: implicit-derivative lookups must stay in uniform control flow.
  return texture2D(sgPattern, sgPatUV(p.xy)).rgb * w.z
    + texture2D(sgPattern, sgPatUV(vec2(p.x, p.y + p.z))).rgb * w.y
    + texture2D(sgPattern, sgPatUV(vec2(p.x + p.z, p.y))).rgb * w.x;
}
#endif

// Signed principal curvature (1/mm) from screen-space derivatives. Convex > 0.
float sgCurvature(vec3 nn) {
  vec3 dPx = dFdx(sgP);
  vec3 dPy = dFdy(sgP);
  vec3 dNx = dFdx(nn);
  vec3 dNy = dFdy(nn);
  float a = length(dPx) + 1e-6;
  vec3 e1 = dPx / a;
  float b = dot(dPy, e1);
  vec3 r = dPy - b * e1;
  float d = length(r) + 1e-6;
  vec3 e2 = r / d;
  float n11 = dot(dNx, e1);
  float n21 = dot(dNx, e2);
  float n12 = dot(dNy, e1);
  float n22 = dot(dNy, e2);
  float s11 = n11 / a;
  float s21 = n21 / a;
  float s12 = (n12 - n11 * b / a) / d;
  float s22 = (n22 - n21 * b / a) / d;
  float H = 0.5 * (s11 + s22);
  float K = s11 * s22 - s12 * s21;
  return H + sign(H) * sqrt(max(H * H - K, 0.0));
}

void sgSurface() {
  vec3 nn = sgN / max(length(sgN), 1e-5);
  vec3 w = sgTriW(nn);
  vec3 ps = sgP + vec3(sgSeed * 37.31, sgSeed * 17.77, sgSeed * 5.13);
  vec4 nA = sgTri(sgNoise, ps / 97.0, w);
  vec4 nB = sgTri(sgNoise, ps / 23.0 + 0.37, w);
  vec4 nC = sgTri(sgNoise, ps / 6.1 + 0.71, w);

  float curv = clamp(sgCurvature(nn), -4.0, 4.0);
  float edge = smoothstep(0.05, 0.42, curv);
  float cavity = smoothstep(0.05, 0.42, -curv);
  float cloud = nA.r * 0.62 + nB.r * 0.38;
  float scratch = max(nA.b, nB.b * 0.75);
  // Edges chip unevenly: the noise decides which stretches of an edge go first.
  float edgeTerm = edge * (0.26 + 0.34 * nB.r + 0.16 * nA.r);
  float pot = cloud * 0.7 + nB.g * 0.1 + edgeTerm + scratch * 0.4 + nC.a * 0.06 - cavity * 0.35;

  float wv = pow(clamp(sgWear, 0.0, 1.0), 0.8);
  float thr = mix(1.7, 0.52, wv);
  float aa = 0.02 + fwidth(pot) * 0.7;
  float worn = smoothstep(thr - aa, thr + aa, pot);
  float ring = smoothstep(thr - 0.17, thr - 0.02, pot) * (1.0 - worn);

  // ---- coating
  vec3 coat = sgCoatColor;
  float cMetal = sgCoatProps.x;
  float cRough = sgCoatProps.y;
  vec3 glow = vec3(0.0);
  #ifdef SG_PATTERN
    vec3 pat = sgPat(sgP, w);
    coat *= pat;
    #ifdef SG_MASK
      float m = smoothstep(sgMask.x, sgMask.y, dot(pat, vec3(0.2126, 0.7152, 0.0722)));
      cMetal = mix(cMetal, sgMask.z, m);
      cRough = mix(cRough, sgMask.w, m);
      glow = sgGlowColor * m * pat;
    #endif
  #endif
  float scuff = smoothstep(0.3, 0.9, scratch) * sgWear;
  float grime = sgWear * (0.25 + 0.5 * cloud);
  coat = mix(coat, coat * 0.8 + vec3(0.02, 0.018, 0.015), grime * 0.55);
  coat = mix(coat, coat * 0.55, cavity * 0.5 * sgWear);
  coat = mix(coat, sgPrimer, ring * 0.7);
  cRough = clamp(cRough + sgWear * 0.1 + scuff * 0.22 + ring * 0.12 + (nC.g - 0.5) * 0.05, 0.045, 1.0);

  // ---- substrate
  vec3 sub = sgSubColor * (0.8 + 0.4 * nB.g) * (1.0 + scratch * 0.25);
  float sMetal = sgSubProps.x;
  float sRough = clamp(sgSubProps.y + (nC.g - 0.5) * 0.3 - scratch * 0.08, 0.08, 1.0);
  float rust = smoothstep(0.56, 0.9, nB.r * 0.55 + nC.r * 0.45 + sgWear * 0.2) * sgSubProps.z * smoothstep(0.45, 1.0, sgWear);
  sub = mix(sub, vec3(0.105, 0.05, 0.026) * (0.5 + nC.g), rust * 0.85);
  sMetal = mix(sMetal, 0.1, rust);
  sRough = mix(sRough, 0.88, rust);

  sgAlbedo = mix(coat, sub, worn);
  sgMetal = mix(cMetal, sMetal, worn);
  sgRough = mix(cRough, sRough, worn);
  sgCoatAlive = 1.0 - worn;
  sgGlow = glow * (1.0 - worn);
  sgHeight = (1.0 - worn) * 0.05
    + (nC.g - 0.5) * sgCoatProps.z * (1.0 - worn)
    + (nC.g - 0.5) * 0.012 * worn
    - scratch * 0.02 * (worn + scuff * 0.5)
    - rust * (nC.r - 0.3) * 0.03;
}

vec3 sgPerturb(vec3 viewN) {
  vec3 nn = sgN / max(length(sgN), 1e-5);
  vec3 dpx = dFdx(sgP);
  vec3 dpy = dFdy(sgP);
  float hx = dFdx(sgHeight);
  float hy = dFdy(sgHeight);
  vec3 r1 = cross(dpy, nn);
  vec3 r2 = cross(nn, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (hx * r1 + hy * r2);
  // Degenerate derivatives (edge-on or sub-pixel triangles) must not produce NaN:
  // a single NaN pixel is smeared across the whole frame by the bloom blur.
  vec3 pv = abs(det) * nn - grad;
  float pl = length(pv);
  if (!(pl > 1e-12)) return viewN;
  vec3 no = pv / pl;
  // normalMatrix carries the mesh scale, so normalise each side before differencing.
  vec3 v0 = normalize(normalMatrix * nn);
  vec3 v1 = normalize(normalMatrix * no);
  vec3 outN = viewN + (v1 - v0);
  float ol = length(outN);
  return ol > 1e-6 ? outN / ol : viewN;
}
`;

function patch(shader: { vertexShader: string; fragmentShader: string }) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_MAIN}`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
    .replace('#include <map_fragment>', `#include <map_fragment>\nsgSurface();\ndiffuseColor.rgb = sgAlbedo;`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = sgRough;`)
    .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\nmetalnessFactor = sgMetal;`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\nnormal = sgPerturb(normal);`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += sgGlow;`)
    .replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
// Last line of defence for the HDR buffer.
if (isnan(gl_FragColor.r) || isnan(gl_FragColor.g) || isnan(gl_FragColor.b)) gl_FragColor.rgb = vec3(0.0);
gl_FragColor.rgb = clamp(gl_FragColor.rgb, 0.0, 2048.0);`,
    )
    .replace(
      '#include <lights_physical_fragment>',
      `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
  material.clearcoat *= sgCoatAlive;
#endif
#ifdef USE_IRIDESCENCE
  material.iridescence *= sgCoatAlive;
#endif
#ifdef USE_SHEEN
  material.sheenColor *= sgCoatAlive;
#endif`,
    );
}

const tmpColor = new THREE.Color();
const linear = (c: THREE.ColorRepresentation) => {
  tmpColor.set(c);
  return new THREE.Vector3(tmpColor.r, tmpColor.g, tmpColor.b);
};

export type SurfaceMaterial = THREE.MeshPhysicalMaterial & {
  userData: { sg: Record<string, THREE.IUniform>; wearScale: number };
};

/** Build a surface material from a spec plus the item's wear and pattern seed. */
export function createSurface(spec: SurfaceSpec, wear: number, seed: number): SurfaceMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: spec.metalness,
    roughness: spec.roughness,
    clearcoat: spec.clearcoat ?? 0,
    clearcoatRoughness: spec.clearcoatRoughness ?? 0.12,
    iridescence: spec.iridescence ?? 0,
    iridescenceIOR: spec.iridescenceIOR ?? 1.6,
    iridescenceThicknessRange: spec.iridescenceRange ? [spec.iridescenceRange[0], spec.iridescenceRange[1]] : [180, 520],
    sheen: spec.sheen ?? 0,
    envMapIntensity: spec.envIntensity ?? 1,
  }) as SurfaceMaterial;
  if (spec.sheenColor !== undefined) mat.sheenColor.set(spec.sheenColor);

  const wearScale = spec.wearScale ?? 1;
  const size = spec.patSize ?? [100, 100];
  const rot = ((spec.patRot ?? 0) * Math.PI) / 180;
  const off = spec.patOffset ?? [0.5, 0.5];
  const u: Record<string, THREE.IUniform> = {
    sgNoise: { value: getNoiseTexture() },
    sgWear: { value: THREE.MathUtils.clamp(wear * wearScale, 0, 1) },
    sgSeed: { value: seed },
    sgCoatColor: { value: linear(spec.color ?? 0xffffff) },
    sgCoatProps: { value: new THREE.Vector3(spec.metalness, spec.roughness, spec.grain ?? 0.01) },
    sgSubColor: { value: linear(spec.sub.color) },
    sgSubProps: { value: new THREE.Vector3(spec.sub.metalness, spec.sub.roughness, spec.sub.rust ?? 0) },
    sgPrimer: { value: linear(spec.primer ?? 0x3a3632) },
    sgPattern: { value: spec.pattern ?? null },
    sgPatXf: { value: new THREE.Vector4(1 / size[0], 1 / size[1], off[0], off[1]) },
    sgPatRot: { value: new THREE.Vector2(Math.cos(rot), Math.sin(rot)) },
    sgMask: { value: new THREE.Vector4(spec.mask?.lo ?? 0, spec.mask?.hi ?? 1, spec.mask?.metalness ?? 0, spec.mask?.roughness ?? 0.5) },
    sgGlowColor: { value: linear(spec.glow ?? 0x000000).multiplyScalar(spec.glowStrength ?? 0) },
  };
  mat.userData.sg = u;
  mat.userData.wearScale = wearScale;

  const defines: Record<string, string> = {};
  if (spec.pattern) defines.SG_PATTERN = '';
  if (spec.pattern && spec.mask) defines.SG_MASK = '';
  mat.defines = { ...(mat.defines ?? {}), ...defines };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    patch(shader);
  };
  // All variants share one patched source; the defines above select the branch.
  mat.customProgramCacheKey = () => 'sg-surface-v2';
  return mat;
}

/** Update wear / seed on an existing surface (used by the collection preview slider). */
export function setSurfaceWear(mat: THREE.Material, wear: number, seed?: number) {
  const sg = (mat as SurfaceMaterial).userData?.sg;
  if (!sg) return;
  sg.sgWear.value = THREE.MathUtils.clamp(wear * ((mat as SurfaceMaterial).userData.wearScale ?? 1), 0, 1);
  if (seed !== undefined) sg.sgSeed.value = seed;
}

/* ------------------------------------------------------------------ */
/* Stock substrates                                                    */
/* ------------------------------------------------------------------ */

export const SUB = {
  steel: { color: 0x9fa2a7, metalness: 1, roughness: 0.36, rust: 1 },
  aluminium: { color: 0xb4b7bb, metalness: 1, roughness: 0.4, rust: 0 },
  polymer: { color: 0x48494c, metalness: 0, roughness: 0.78, rust: 0 },
  wood: { color: 0x917553, metalness: 0, roughness: 0.82, rust: 0 },
  brass: { color: 0xc9a25a, metalness: 1, roughness: 0.32, rust: 0 },
} satisfies Record<string, Substrate>;
