/** Small deterministic noise toolkit shared by procedural textures and finishes. */

export type Rand = () => number;

export function mulberry32(seed: number): Rand {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * Tileable value noise. `x`, `y` are in lattice units and wrap every `period`
 * cells, so a texture that spans exactly `period` cells tiles seamlessly.
 */
export function vnoise(x: number, y: number, period: number, seed = 1, periodY = period): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const ax = mod(x0, period);
  const ay = mod(y0, periodY);
  const bx = mod(x0 + 1, period);
  const by = mod(y0 + 1, periodY);
  const v00 = hash2(ax, ay, seed);
  const v10 = hash2(bx, ay, seed);
  const v01 = hash2(ax, by, seed);
  const v11 = hash2(bx, by, seed);
  return v00 + (v10 - v00) * fx + (v01 - v00) * fy + (v00 - v10 - v01 + v11) * fx * fy;
}

/** Fractal noise in 0..1. u, v in 0..1 across the tile; `cells` is the base lattice count. */
export function fbm(u: number, v: number, cells: number, octaves: number, seed = 1, gain = 0.5): number {
  let amp = 1;
  let sum = 0;
  let norm = 0;
  let c = cells;
  for (let o = 0; o < octaves; o++) {
    sum += vnoise(u * c, v * c, c, seed + o * 101) * amp;
    norm += amp;
    amp *= gain;
    c *= 2;
  }
  return sum / norm;
}

/** Anisotropic fractal noise: independent lattice counts along u and v (streaks, grain). */
export function fbm2(u: number, v: number, cellsU: number, cellsV: number, octaves: number, seed = 1, gain = 0.5): number {
  let amp = 1;
  let sum = 0;
  let norm = 0;
  let cu = cellsU;
  let cv = cellsV;
  for (let o = 0; o < octaves; o++) {
    sum += vnoise(u * cu, v * cv, cu, seed + o * 131, cv) * amp;
    norm += amp;
    amp *= gain;
    cu *= 2;
    cv *= 2;
  }
  return sum / norm;
}

/** Ridged fractal noise (sharp creases), 0..1. */
export function ridged(u: number, v: number, cells: number, octaves: number, seed = 1): number {
  let amp = 1;
  let sum = 0;
  let norm = 0;
  let c = cells;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(vnoise(u * c, v * c, c, seed + o * 57) * 2 - 1);
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5;
    c *= 2;
  }
  return sum / norm;
}

/**
 * Tileable cellular noise. Returns [F1, F2, cellId] where distances are in cell
 * units and cellId is a stable 0..1 hash of the nearest feature point.
 */
export function worley(u: number, v: number, cells: number, seed = 1, jitter = 1): [number, number, number] {
  const x = u * cells;
  const y = v * cells;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let f1 = 9;
  let f2 = 9;
  let id = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx;
      const cy = iy + dy;
      const wx = mod(cx, cells);
      const wy = mod(cy, cells);
      const px = cx + 0.5 + (hash2(wx, wy, seed) - 0.5) * jitter;
      const py = cy + 0.5 + (hash2(wx, wy, seed + 71) - 0.5) * jitter;
      const d = Math.hypot(px - x, py - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash2(wx, wy, seed + 913);
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return [f1, f2, id];
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
