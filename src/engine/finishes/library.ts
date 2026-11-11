/**
 * Turns a skin recipe (pure data) into the surface specs a weapon needs.
 * Pattern textures are cached with a small LRU so browsing a large inventory
 * does not pin every skin's artwork on the GPU.
 */
import type * as THREE from 'three';
import { hashString, mulberry32 } from '../noise';
import type { SurfaceSpec } from '../materials/surface';
import type { WeaponLook } from '../weaponFactory';
import { getModel } from '../models/registry';
import { toTexture } from './canvas';
import { PATTERNS, drawPattern, patternKey, type PatternParams } from './patterns';
import { STOCK, type StockName } from './stock';

/* ---------------- pattern texture cache ---------------- */

const MAX_TEXTURES = 22;
const texCache = new Map<string, THREE.Texture>();

export function getPatternTexture(name: string, params: PatternParams): THREE.Texture {
  const key = patternKey(name, params);
  const hit = texCache.get(key);
  if (hit) {
    texCache.delete(key);
    texCache.set(key, hit);
    return hit;
  }
  const tex = toTexture(drawPattern(name, params), PATTERNS[name].wrap);
  texCache.set(key, tex);
  if (texCache.size > MAX_TEXTURES) {
    const first = texCache.entries().next().value;
    if (first) {
      texCache.delete(first[0]);
      // Frees the GPU copy only. A material still holding the texture simply
      // re-uploads it from its canvas on next use.
      first[1].dispose();
    }
  }
  return tex;
}

/* ---------------- recipe types ---------------- */

export type MatName = 'matte' | 'satin' | 'gloss' | 'anod' | 'chrome' | 'pearl';

const MATS: Record<MatName, Pick<SurfaceSpec, 'metalness' | 'roughness' | 'clearcoat' | 'clearcoatRoughness' | 'iridescence' | 'iridescenceIOR' | 'grain'>> = {
  /** Ceramic coating: flat, slightly chalky. */
  matte: { metalness: 0, roughness: 0.56, clearcoat: 0, grain: 0.022 },
  /** Lacquered paint with a soft sheen. */
  satin: { metalness: 0, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.28, grain: 0.012 },
  /** Wet-look automotive clear. */
  gloss: { metalness: 0, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.045, grain: 0.004 },
  /** Dyed anodised or heat-coloured metal. */
  anod: { metalness: 1, roughness: 0.3, clearcoat: 0, grain: 0.008 },
  /** Mirror-polished or plated metal. */
  chrome: { metalness: 1, roughness: 0.13, clearcoat: 0, grain: 0.003 },
  /** Interference pigment under clear. */
  pearl: { metalness: 0.55, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.06, iridescence: 0.9, iridescenceIOR: 1.7, grain: 0.004 },
};

export interface PatSpec extends PatternParams {
  gen: string;
  /** Tile size in mm. 'fit' stretches one tile across the weapon's length. */
  size: number | readonly [number, number] | 'fit';
  /** Base rotation in degrees and how far the seed may swing it. */
  rot?: number;
  rotVar?: number;
  /** Maximum UV slide the seed may apply on each axis (default: anywhere). */
  shift?: readonly [number, number];
}

export interface PartRecipe {
  mat: MatName;
  /** Solid colour, or a tint multiplied over the pattern. */
  color?: string;
  pat?: PatSpec;
  /** Fine-tuning on top of the material preset. */
  over?: Partial<SurfaceSpec>;
}

export interface Recipe {
  body: PartRecipe;
  /** Furniture: its own recipe, 'body' to continue the main finish, or omitted for factory furniture. */
  sec?: PartRecipe | 'body';
  /** Optional override for the small steel parts (barrel, pins, sights). */
  steel?: PartRecipe;
}

/** How far along its fade a gradient skin sits for a given seed, 0..1. Only meaningful for 'fade' patterns. */
export function fadeAmount(seed: number, skinId: string): number {
  const r = mulberry32((Math.imul(seed + 1, 2654435761) ^ hashString(skinId)) >>> 0);
  return r();
}

function partSpec(part: PartRecipe, stock: StockName, weaponId: string, skinId: string, seed: number, salt: number): SurfaceSpec {
  const base = STOCK[stock]();
  const preset = MATS[part.mat];
  const spec: SurfaceSpec = {
    ...preset,
    color: part.color ?? '#ffffff',
    primer: 0x3d3a36,
    sub: base.sub,
    wearScale: base.wearScale,
    ...part.over,
  };
  if (part.pat) {
    const { gen, size, rot, rotVar, shift, ...params } = part.pat;
    spec.pattern = getPatternTexture(gen, params);
    const wrap = PATTERNS[gen].wrap;
    const r = mulberry32((Math.imul(seed + 1, 2654435761) ^ hashString(skinId) ^ salt) >>> 0);
    let sz: readonly [number, number];
    if (size === 'fit') {
      const b = getModel(weaponId).bounds;
      const w = (b.max.x - b.min.x) * 1.06;
      const img = spec.pattern.image as { width: number; height: number };
      sz = [w, (w * img.height) / img.width];
    } else {
      sz = typeof size === 'number' ? [size, size] : size;
    }
    const sh = shift ?? (wrap === 'repeat' ? [1, 1] : [0.35, 0.1]);
    spec.patSize = sz;
    spec.patOffset = [0.5 + (r() - 0.5) * sh[0], 0.5 + (r() - 0.5) * sh[1]];
    spec.patRot = (rot ?? 0) + (r() - 0.5) * (rotVar ?? 0);
  }
  return spec;
}

/** Resolve the complete look of a weapon. `recipe` null means factory finish. */
export function resolveLook(weaponId: string, stock: { body: StockName; sec: StockName }, recipe: Recipe | null, skinId: string, seed: number): WeaponLook {
  if (!recipe) return { body: STOCK[stock.body](), sec: STOCK[stock.sec]() };
  const body = partSpec(recipe.body, stock.body, weaponId, skinId, seed, 0);
  let sec: SurfaceSpec;
  if (recipe.sec === 'body') sec = partSpec(recipe.body, stock.sec, weaponId, skinId, seed, 0);
  else if (recipe.sec) sec = partSpec(recipe.sec, stock.sec, weaponId, skinId, seed, 0x9e3779b9);
  else sec = STOCK[stock.sec]();
  const look: WeaponLook = { body, sec };
  if (recipe.steel) look.steel = partSpec(recipe.steel, 'gunSteel', weaponId, skinId, seed, 0x51ed270b);
  return look;
}
