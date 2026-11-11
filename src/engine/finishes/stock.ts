/**
 * Factory ("unskinned") surfaces: what a part looks like when no skin paints it.
 */
import type * as THREE from 'three';
import { fbm2 } from '../noise';
import { SUB, type SurfaceSpec } from '../materials/surface';
import { hex, mix, pixelFill, toTexture, type RGB } from './canvas';

const texCache = new Map<string, THREE.Texture>();

function cached(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = texCache.get(key);
  if (!t) {
    t = make();
    texCache.set(key, t);
  }
  return t;
}

/** Laminated wood: glue lines along the length with warped grain. Tileable. */
export function woodTexture(light: string, dark: string, line: string, key: string): THREE.Texture {
  return cached(`wood:${key}`, () => {
    const L = hex(light);
    const D = hex(dark);
    const G = hex(line);
    const cv = pixelFill(1024, 512, (u, v, out) => {
      const warp = fbm2(u, v, 2, 4, 3, 7);
      const fig = fbm2(u, v, 2, 3, 2, 91);
      const rings = 0.5 + 0.5 * Math.sin((v * 30 + warp * 1.5) * Math.PI * 2);
      const streak = fbm2(u, v, 4, 180, 3, 19, 0.6);
      const pore = fbm2(u, v, 60, 500, 2, 43);
      let c: RGB = mix(L, D, Math.min(1, rings * rings * 0.3 + streak * 0.5));
      c = mix(c, G, Math.pow(rings, 16) * 0.5);
      c = mix(c, D, Math.max(0, pore - 0.6) * 1.4);
      const k = 0.8 + fig * 0.4;
      out[0] = Math.min(255, c[0] * k);
      out[1] = Math.min(255, c[1] * k);
      out[2] = Math.min(255, c[2] * k);
    });
    return toTexture(cv, 'repeat');
  });
}

export const STOCK = {
  /** Black-oxide / parkerised steel. */
  // Dark gun finishes are oxide / phosphate / anodic layers: optically they are
  // dielectric coatings, so they are modelled with low metalness. Treating them
  // as dark metals kills their specular response and flattens every form.
  blackOxide: (): SurfaceSpec => ({
    color: 0x1d1e21,
    metalness: 0.25,
    roughness: 0.4,
    clearcoat: 0.25,
    clearcoatRoughness: 0.4,
    grain: 0.012,
    primer: 0x2b2826,
    sub: SUB.steel,
  }),
  /** Hard-anodised aluminium (receivers, handguards). */
  anodised: (): SurfaceSpec => ({
    color: 0x1b1c1f,
    metalness: 0.3,
    roughness: 0.46,
    grain: 0.016,
    primer: 0x34322f,
    sub: SUB.aluminium,
  }),
  /** Small blued-steel parts: barrels, pins, sights. */
  gunSteel: (): SurfaceSpec => ({
    color: 0x26282c,
    metalness: 0.55,
    roughness: 0.34,
    clearcoat: 0.2,
    clearcoatRoughness: 0.3,
    grain: 0.008,
    primer: 0x3a3a3c,
    sub: SUB.steel,
  }),
  /** Polished bolt / chamber steel. */
  bright: (): SurfaceSpec => ({
    color: 0xaeb2b8,
    metalness: 1,
    roughness: 0.24,
    grain: 0.006,
    primer: 0x8d9096,
    sub: { ...SUB.steel, roughness: 0.34 },
    wearScale: 0.8,
  }),
  /** Satin-finished blade steel. */
  satin: (): SurfaceSpec => ({
    color: 0x9a9ea4,
    metalness: 1,
    roughness: 0.3,
    grain: 0.006,
    primer: 0x7c8086,
    sub: { ...SUB.steel, roughness: 0.4 },
    wearScale: 0.85,
  }),
  polymer: (): SurfaceSpec => ({
    color: 0x121315,
    metalness: 0,
    roughness: 0.62,
    grain: 0.05,
    primer: 0x2a2b2d,
    sub: SUB.polymer,
    wearScale: 0.75,
    envIntensity: 0.8,
  }),
  rubber: (): SurfaceSpec => ({
    color: 0x0c0c0d,
    metalness: 0,
    roughness: 0.88,
    grain: 0.07,
    primer: 0x1c1c1d,
    sub: { color: 0x2c2c2e, metalness: 0, roughness: 0.92 },
    wearScale: 0.6,
    envIntensity: 0.6,
  }),
  /** Oiled red laminate. */
  laminate: (): SurfaceSpec => ({
    pattern: woodTexture('#8e4f27', '#4d2512', '#2a1207', 'laminate'),
    patSize: [330, 165],
    metalness: 0,
    roughness: 0.36,
    clearcoat: 0.55,
    clearcoatRoughness: 0.22,
    grain: 0.02,
    primer: 0x8a6a48,
    sub: SUB.wood,
    wearScale: 0.9,
  }),
  /** Dark walnut. */
  walnut: (): SurfaceSpec => ({
    pattern: woodTexture('#7a4a2a', '#2e1a0e', '#170c06', 'walnut'),
    patSize: [300, 150],
    metalness: 0,
    roughness: 0.42,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
    grain: 0.02,
    primer: 0x6e5238,
    sub: SUB.wood,
    wearScale: 0.9,
  }),
} as const;

export type StockName = keyof typeof STOCK;
