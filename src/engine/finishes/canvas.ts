/** Canvas helpers shared by every procedural finish. */
import * as THREE from 'three';

export type RGB = readonly [number, number, number];

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: false })!;
  return [cv, ctx];
}

export function hex(c: string | number): RGB {
  const n = typeof c === 'number' ? c : parseInt(c.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const css = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);

export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const scale = (a: RGB, k: number): RGB => [Math.min(255, a[0] * k), Math.min(255, a[1] * k), Math.min(255, a[2] * k)];

/** Sample a multi-stop ramp at t in 0..1. */
export function ramp(stops: readonly RGB[], t: number): RGB {
  const x = Math.max(0, Math.min(0.99999, t)) * (stops.length - 1);
  const i = Math.floor(x);
  return mix(stops[i], stops[i + 1], x - i);
}

/** Fill a canvas per pixel. `fn` receives u, v in 0..1 and writes sRGB 0..255 into `out`. */
export function pixelFill(w: number, h: number, fn: (u: number, v: number, out: [number, number, number]) => void): HTMLCanvasElement {
  const [cv, ctx] = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const out: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      fn(x / w, v, out);
      const i = (y * w + x) * 4;
      d[i] = out[0];
      d[i + 1] = out[1];
      d[i + 2] = out[2];
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** Run a draw routine at the nine wrapped offsets so strokes tile across the edges. */
export function tiled(ctx: CanvasRenderingContext2D, w: number, h: number, draw: () => void) {
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      ctx.save();
      ctx.translate(ox * w, oy * h);
      draw();
      ctx.restore();
    }
  }
}

export type Wrap = 'repeat' | 'mirror' | 'clamp';

export function toTexture(cv: HTMLCanvasElement, wrap: Wrap = 'repeat'): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(cv);
  const mode = wrap === 'repeat' ? THREE.RepeatWrapping : wrap === 'mirror' ? THREE.MirroredRepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapS = tex.wrapT = mode;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  return tex;
}
