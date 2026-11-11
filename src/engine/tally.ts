/**
 * The Tally module: a small counter unit bolted to the weapon that shows how
 * many rounds it has test-fired. Built from the same kit as the weapons.
 */
import * as THREE from 'three';
import { box, studZ } from './models/kit';
import { createSurface } from './materials/surface';
import { STOCK } from './finishes/stock';
import { MM } from './weaponFactory';

const W = 34;
const H = 13;
const D = 4.6;

let housingGeo: THREE.BufferGeometry | null = null;
let screwGeo: THREE.BufferGeometry | null = null;

function geometries() {
  if (!housingGeo) {
    housingGeo = box(-W / 2, -H / 2, W / 2, H / 2, D, { at: D / 2 - 0.4, bevel: 0.9, r: 1.6 });
    const s1 = studZ(-W / 2 + 2.6, 0, 1.1, D - 0.6, D + 0.25, 0.25);
    const s2 = studZ(W / 2 - 2.6, 0, 1.1, D - 0.6, D + 0.25, 0.25);
    screwGeo = new THREE.BufferGeometry();
    const a = s1.getAttribute('position').array as Float32Array;
    const b = s2.getAttribute('position').array as Float32Array;
    const an = s1.getAttribute('normal').array as Float32Array;
    const bn = s2.getAttribute('normal').array as Float32Array;
    const pos = new Float32Array(a.length + b.length);
    const nrm = new Float32Array(an.length + bn.length);
    pos.set(a);
    pos.set(b, a.length);
    nrm.set(an);
    nrm.set(bn, an.length);
    screwGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    screwGeo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    s1.dispose();
    s2.dispose();
  }
  return { housingGeo, screwGeo: screwGeo! };
}

const SEGS: Record<string, number[]> = {
  // a b c d e f g
  '0': [1, 1, 1, 1, 1, 1, 0],
  '1': [0, 1, 1, 0, 0, 0, 0],
  '2': [1, 1, 0, 1, 1, 0, 1],
  '3': [1, 1, 1, 1, 0, 0, 1],
  '4': [0, 1, 1, 0, 0, 1, 1],
  '5': [1, 0, 1, 1, 0, 1, 1],
  '6': [1, 0, 1, 1, 1, 1, 1],
  '7': [1, 1, 1, 0, 0, 0, 0],
  '8': [1, 1, 1, 1, 1, 1, 1],
  '9': [1, 1, 1, 1, 0, 1, 1],
};

function drawDigit(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ch: string, on: string, off: string) {
  const t = Math.max(2, w * 0.2);
  const g = 1;
  const seg = SEGS[ch] ?? SEGS['0'];
  const rects: [number, number, number, number][] = [
    [x + t + g, y, w - 2 * (t + g), t], // a
    [x + w - t, y + t + g, t, h / 2 - t - 2 * g], // b
    [x + w - t, y + h / 2 + g, t, h / 2 - t - 2 * g], // c
    [x + t + g, y + h - t, w - 2 * (t + g), t], // d
    [x, y + h / 2 + g, t, h / 2 - t - 2 * g], // e
    [x, y + t + g, t, h / 2 - t - 2 * g], // f
    [x + t + g, y + h / 2 - t / 2, w - 2 * (t + g), t], // g
  ];
  rects.forEach((r, i) => {
    ctx.fillStyle = seg[i] ? on : off;
    ctx.fillRect(r[0], r[1], r[2], r[3]);
  });
}

function drawCount(cv: HTMLCanvasElement, count: number) {
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#060504';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const text = String(Math.min(999999, Math.max(0, Math.floor(count)))).padStart(6, '0');
  const dw = 22;
  const dh = 40;
  const gap = 8;
  const x0 = (cv.width - (6 * dw + 5 * gap)) / 2;
  const y0 = (cv.height - dh) / 2;
  for (let i = 0; i < 6; i++) drawDigit(ctx, x0 + i * (dw + gap), y0, dw, dh, text[i], '#ffb24a', '#2a1a0a');
}

export interface TallyObject extends THREE.Group {
  userData: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; materials: THREE.Material[] };
}

/** Build a Tally module in scene units (metres), facing +Z with its back on z = 0. */
export function createTally(count: number, wear: number): TallyObject {
  const { housingGeo: hg, screwGeo: sg } = geometries();
  const root = new THREE.Group() as TallyObject;
  root.name = 'tally';
  const housingMat = createSurface(STOCK.anodised(), wear * 0.8, 0.42);
  const screwMat = createSurface(STOCK.bright(), wear, 0.9);
  const housing = new THREE.Mesh(hg, housingMat);
  const screws = new THREE.Mesh(sg, screwMat);
  housing.scale.setScalar(MM);
  screws.scale.setScalar(MM);
  housing.castShadow = screws.castShadow = true;

  const cv = document.createElement('canvas');
  cv.width = 200;
  cv.height = 56;
  drawCount(cv, count);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry((W - 10) * MM, (H - 5.4) * MM), screenMat);
  screen.position.z = (D - 0.34) * MM;

  root.add(housing, screws, screen);
  root.userData = { canvas: cv, texture: tex, materials: [housingMat, screwMat, screenMat] };
  return root;
}

export function setTallyCount(obj: THREE.Object3D, count: number) {
  const t = obj as TallyObject;
  if (!t.userData?.canvas) return;
  drawCount(t.userData.canvas, count);
  t.userData.texture.needsUpdate = true;
}

export function disposeTally(obj: THREE.Object3D) {
  const t = obj as TallyObject;
  if (!t.userData?.materials) return;
  for (const m of t.userData.materials) m.dispose();
  t.userData.texture.dispose();
  t.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry instanceof THREE.PlaneGeometry) mesh.geometry.dispose();
  });
}
