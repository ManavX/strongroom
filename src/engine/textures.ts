/**
 * Shared procedural textures. Nothing here is downloaded: the wear shader's
 * noise atlas is synthesised once at start-up.
 */
import * as THREE from 'three';
import { fbm, mulberry32 } from './noise';

let noiseTex: THREE.DataTexture | null = null;

/**
 * 512px tileable RGBA atlas used by the surface shader:
 *   R  large soft blotches (where paint wears through first)
 *   G  fine grain
 *   B  scratches
 *   A  pitting / speckle
 */
export function getNoiseTexture(): THREE.DataTexture {
  if (noiseTex) return noiseTex;
  const S = 512;
  const data = new Uint8Array(S * S * 4);

  // Scratches and pits are drawn with the 2D canvas, wrapped across the tile edges.
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  const rnd = mulberry32(90210);

  const wrapDraw = (fn: (ox: number, oy: number) => void) => {
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) fn(ox * S, oy * S);
  };

  // --- scratches
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  ctx.lineCap = 'round';
  for (let i = 0; i < 520; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const long = rnd() < 0.22;
    const len = long ? 90 + rnd() * 260 : 6 + rnd() * 60;
    // mostly along the weapon's length, with a minority of cross scratches
    const ang = rnd() < 0.78 ? (rnd() - 0.5) * 0.5 : rnd() * Math.PI;
    const bend = (rnd() - 0.5) * len * 0.12;
    const a = 0.25 + rnd() * 0.75;
    const w = 0.5 + rnd() * (long ? 1.3 : 1.0);
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len;
    wrapDraw((ox, oy) => {
      ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.quadraticCurveTo(x + ox + dx / 2 - Math.sin(ang) * bend, y + oy + dy / 2 + Math.cos(ang) * bend, x + ox + dx, y + oy + dy);
      ctx.stroke();
    });
  }
  // nicks
  for (let i = 0; i < 700; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 0.4 + rnd() * 1.6;
    const a = 0.3 + rnd() * 0.7;
    wrapDraw((ox, oy) => {
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(x + ox, y + oy, r * (1 + rnd() * 2), r, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  const scratch = ctx.getImageData(0, 0, S, S).data;

  // --- pits
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 0.5 + rnd() * rnd() * 3.2;
    const a = 0.2 + rnd() * 0.8;
    wrapDraw((ox, oy) => {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  const pits = ctx.getImageData(0, 0, S, S).data;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const i = (y * S + x) * 4;
      const cloud = fbm(u, v, 4, 5, 11, 0.55);
      const grain = fbm(u, v, 48, 3, 23, 0.6);
      data[i] = Math.max(0, Math.min(255, ((cloud - 0.5) * 1.9 + 0.5) * 255));
      data[i + 1] = Math.max(0, Math.min(255, ((grain - 0.5) * 2.1 + 0.5) * 255));
      data[i + 2] = scratch[i];
      data[i + 3] = pits[i];
    }
  }

  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  noiseTex = tex;
  return tex;
}

/** Soft radial sprite used for dust, sparks and glows. */
let dotTex: THREE.CanvasTexture | null = null;
export function getDotTexture(): THREE.CanvasTexture {
  if (dotTex) return dotTex;
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  dotTex = new THREE.CanvasTexture(cv);
  dotTex.colorSpace = THREE.SRGBColorSpace;
  return dotTex;
}
