/**
 * The case: a rugged transit case with a hinged lid, two draw latches and a
 * lit foam interior. Geometry is shared by every case; materials, trim colour
 * and emblem are per case.
 */
import * as THREE from 'three';
import type { CaseDef } from '../../data/cases';
import { STOCK } from '../finishes/stock';
import { createSurface, SUB } from '../materials/surface';
import { box, plate, rect, rod, type V2 } from './kit';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const MM = 0.001;
export const CASE_W = 560;
export const CASE_D = 340;
export const CASE_BASE_H = 150;
export const CASE_LID_H = 95;
const HD = CASE_D / 2;

const foot = (inset: number): V2[] => rect(-CASE_W / 2 + inset, -HD + inset, CASE_W - 2 * inset, CASE_D - 2 * inset, Math.max(4, 44 - inset));

type Part = 'shell' | 'trim' | 'metal' | 'foam' | 'rubber';
type Bins = Partial<Record<Part, THREE.BufferGeometry[]>>;

interface CaseGeo {
  base: Partial<Record<Part, THREE.BufferGeometry>>;
  lid: Partial<Record<Part, THREE.BufferGeometry>>;
  latch: Partial<Record<Part, THREE.BufferGeometry>>;
}

let cached: CaseGeo | null = null;

const merge = (bins: Bins) => {
  const out: Partial<Record<Part, THREE.BufferGeometry>> = {};
  for (const [k, list] of Object.entries(bins) as [Part, THREE.BufferGeometry[]][]) {
    const m = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    if (m) out[k] = m;
  }
  return out;
};

export const LATCH_X = 152;
/** Latch pivot in mm (per side, mirrored on x). */
export const LATCH_PIVOT = new THREE.Vector3(LATCH_X, 112, HD + 9.5);
/** Lid hinge line in mm. */
export const LID_PIVOT = new THREE.Vector3(0, CASE_BASE_H, -HD);

function buildGeo(): CaseGeo {
  if (cached) return cached;
  const base: Bins = { shell: [], trim: [], metal: [], foam: [], rubber: [] };
  const lid: Bins = { shell: [], trim: [], metal: [], foam: [] };
  const latch: Bins = { metal: [] };
  const xz = 'xz' as const;

  /* ---------- base ---------- */
  base.shell!.push(plate(foot(0), { t: CASE_BASE_H, plane: xz, at: CASE_BASE_H / 2, bevel: 9, bevelSegs: 3, holes: [foot(15)] }));
  base.shell!.push(plate(foot(8), { t: 12, plane: xz, at: 10, bevel: 1 }));
  // reinforcing belts
  base.shell!.push(plate(foot(-3), { t: 16, plane: xz, at: 34, bevel: 3, holes: [foot(4)] }));
  base.shell!.push(plate(foot(-3), { t: 12, plane: xz, at: 118, bevel: 3, holes: [foot(4)] }));
  // vertical ribs on the long sides
  for (const x of [-210, -70, 70, 210]) {
    for (const z of [HD + 0.5, -HD - 0.5]) base.shell!.push(box(x - 11, 44, x + 11, 110, 6, { at: z, bevel: 2.4, r: 5 }));
  }
  // trim band at the rim, gasket above it
  base.trim!.push(plate(foot(-1.4), { t: 7, plane: xz, at: CASE_BASE_H - 5, bevel: 1.2, holes: [foot(5)] }));
  base.rubber!.push(plate(foot(3), { t: 4, plane: xz, at: CASE_BASE_H, bevel: 0.6, holes: [foot(13)] }));
  // foam tray with a lit well
  base.foam!.push(plate(foot(15.5), { t: 70, plane: xz, at: 82, bevel: 4, bevelSegs: 2, holes: [rect(-205, -62, 410, 124, 46)] }));
  // latch brackets
  for (const s of [-1, 1]) {
    base.metal!.push(box(s * LATCH_X - 25, 92, s * LATCH_X + 25, 122, 9, { at: HD + 3.5, bevel: 1.4, r: 3 }));
    base.metal!.push(rod(s * LATCH_X - 21, s * LATCH_X + 21, 4.2, { y: 112, z: HD + 9.5 }));
  }
  // handle brackets and grip
  for (const s of [-1, 1]) base.metal!.push(box(s * 74 - 10, 62, s * 74 + 10, 90, 15, { at: HD + 6, bevel: 2, r: 4 }));
  base.rubber!.push(plate(rect(-90, 26, 180, 56, 17), { t: 13, at: HD + 11, bevel: 4, bevelSegs: 3, holes: [rect(-70, 42, 140, 24, 10)] }));
  // hinge barrels
  for (const s of [-1, 1]) {
    base.metal!.push(rod(s * 150 - 34, s * 150 + 34, 7, { y: CASE_BASE_H, z: -HD - 3 }));
    base.metal!.push(box(s * 150 - 30, CASE_BASE_H - 34, s * 150 + 30, CASE_BASE_H - 4, 5, { at: -HD - 1.5, bevel: 1, r: 3 }));
  }
  // feet
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) base.rubber!.push(plate(rect(sx * 215 - 26, sz * 115 - 20, 52, 40, 12), { t: 8, plane: xz, at: 0, bevel: 2 }));

  /* ---------- lid (authored in case space; the mesh is offset under its pivot) ---------- */
  const y0 = CASE_BASE_H;
  lid.shell!.push(plate(foot(0), { t: CASE_LID_H, plane: xz, at: y0 + CASE_LID_H / 2, bevel: 12, bevelSegs: 4, holes: [foot(15)] }));
  lid.shell!.push(plate(foot(13), { t: 14, plane: xz, at: y0 + CASE_LID_H - 9, bevel: 1.5 }));
  lid.shell!.push(plate(foot(-3), { t: 12, plane: xz, at: y0 + 26, bevel: 3, holes: [foot(4)] }));
  for (const z of [-118, -70, 70, 118]) lid.shell!.push(plate(rect(-222, z - 11, 444, 22, 11), { t: 9, plane: xz, at: y0 + CASE_LID_H - 0.5, bevel: 3, bevelSegs: 3 }));
  lid.trim!.push(plate(foot(-1.4), { t: 7, plane: xz, at: y0 + 6, bevel: 1.2, holes: [foot(5)] }));
  lid.trim!.push(plate(rect(-104, -40, 208, 80, 9), { t: 6, plane: xz, at: y0 + CASE_LID_H - 0.5, bevel: 1.6 }));
  lid.foam!.push(plate(foot(15.5), { t: 40, plane: xz, at: y0 + CASE_LID_H - 36, bevel: 4 }));
  for (const s of [-1, 1]) {
    lid.metal!.push(box(s * LATCH_X - 23, y0 + 12, s * LATCH_X + 23, y0 + 30, 8, { at: HD + 3, bevel: 1.4, r: 3 }));
    lid.metal!.push(box(s * 150 - 30, y0 + 4, s * 150 + 30, y0 + 34, 5, { at: -HD - 1.5, bevel: 1, r: 3 }));
  }

  /* ---------- latch arm (authored around its own pivot at the origin) ---------- */
  latch.metal!.push(plate(rect(-18, -6, 36, 66, 6), { t: 5, at: 0, bevel: 1.2, holes: [rect(-9, 26, 18, 18, 4)] }));
  latch.metal!.push(box(-15, 54, 15, 66, 10, { at: 2.5, bevel: 2, r: 4 }));

  cached = { base: merge(base), lid: merge(lid), latch: merge(latch) };
  return cached;
}

/* ---------- emblem + label art ---------- */

function emblemTexture(kind: CaseDef['emblem'], color: string): THREE.CanvasTexture {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = Math.round((S * 80) / 208);
  const ctx = cv.getContext('2d')!;
  const cx = cv.width / 2;
  const cy = cv.height / 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const R = cv.height * 0.34;
  // flanking rules
  ctx.globalAlpha = 0.7;
  ctx.fillRect(34, cy - 2.5, cx - R - 70, 5);
  ctx.fillRect(cx + R + 36, cy - 2.5, cx - R - 70, 5);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 14, 0, Math.PI * 2);
  ctx.stroke();
  if (kind === 'anvil') {
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.95, cy - R * 0.42);
    ctx.lineTo(cx + R * 0.62, cy - R * 0.42);
    ctx.lineTo(cx + R * 0.95, cy - R * 0.16);
    ctx.lineTo(cx + R * 0.3, cy - R * 0.06);
    ctx.lineTo(cx + R * 0.24, cy + R * 0.26);
    ctx.lineTo(cx + R * 0.56, cy + R * 0.56);
    ctx.lineTo(cx - R * 0.56, cy + R * 0.56);
    ctx.lineTo(cx - R * 0.24, cy + R * 0.26);
    ctx.lineTo(cx - R * 0.3, cy - R * 0.06);
    ctx.lineTo(cx - R * 0.95, cy - R * 0.2);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'eye') {
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.95, cy);
    ctx.quadraticCurveTo(cx, cy - R * 0.95, cx + R * 0.95, cy);
    ctx.quadraticCurveTo(cx, cy + R * 0.95, cx - R * 0.95, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - R * 0.9);
    ctx.lineTo(cx, cy - R * 0.6);
    ctx.moveTo(cx, cy + R * 0.6);
    ctx.lineTo(cx, cy + R * 0.9);
    ctx.stroke();
  } else {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const len = i % 2 ? R * 0.52 : R * 0.98;
      const w = i % 2 ? 0.2 : 0.26;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      ctx.lineTo(cx + Math.cos(a + w) * R * 0.2, cy + Math.sin(a + w) * R * 0.2);
      ctx.lineTo(cx + Math.cos(a - w) * R * 0.2, cy + Math.sin(a - w) * R * 0.2);
      ctx.closePath();
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function labelTexture(text: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = 'rgba(233,230,223,0.9)';
  ctx.textBaseline = 'middle';
  ctx.font = '700 84px "Barlow Condensed", "Arial Narrow", Impact, sans-serif';
  ctx.fillText(text.toUpperCase(), 8, 68);
  const w = ctx.measureText(text.toUpperCase()).width;
  ctx.font = '500 34px "IBM Plex Mono", ui-monospace, Consolas, monospace';
  ctx.fillStyle = 'rgba(233,230,223,0.55)';
  ctx.fillText('SR-09 // SEALED', w + 44, 74);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ---------- rig ---------- */

export interface CaseRig {
  root: THREE.Group;
  lid: THREE.Group;
  latches: THREE.Group[];
  glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  light: THREE.PointLight;
  def: CaseDef;
  /** 0 closed .. 1 fully open. */
  setLid(t: number): void;
  setLatches(t: number): void;
  setGlow(color: THREE.ColorRepresentation, strength: number): void;
  dispose(): void;
}

export function createCase(def: CaseDef): CaseRig {
  const geo = buildGeo();
  const root = new THREE.Group();
  root.name = `case:${def.id}`;
  const owned: { dispose(): void }[] = [];
  const seed = def.id.length * 3.7;

  const mats: Record<Part, THREE.Material> = {
    shell: createSurface({ color: def.shell.color, metalness: def.shell.metalness, roughness: def.shell.roughness, grain: 0.06, primer: 0x4a4744, sub: SUB.polymer, envIntensity: 0.9 }, 0.3, seed),
    trim: createSurface({ color: def.shell.trim, metalness: 1, roughness: 0.3, grain: 0.008, primer: 0x6a6660, sub: SUB.aluminium }, 0.16, seed + 1),
    metal: createSurface({ ...STOCK.satin(), color: 0x7d8087, roughness: 0.34 }, 0.3, seed + 2),
    foam: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 1, metalness: 0 }),
    rubber: createSurface(STOCK.rubber(), 0.25, seed + 3),
  };
  owned.push(...Object.values(mats));

  const addParts = (parent: THREE.Object3D, parts: Partial<Record<Part, THREE.BufferGeometry>>, offset?: THREE.Vector3) => {
    for (const [k, g] of Object.entries(parts) as [Part, THREE.BufferGeometry][]) {
      const m = new THREE.Mesh(g, mats[k]);
      m.scale.setScalar(MM);
      if (offset) m.position.copy(offset).multiplyScalar(-MM);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
    }
  };

  addParts(root, geo.base);

  const lid = new THREE.Group();
  lid.position.copy(LID_PIVOT).multiplyScalar(MM);
  addParts(lid, geo.lid, LID_PIVOT);
  root.add(lid);

  // emblem on the lid plate, label on the lid front
  const emblemTex = emblemTexture(def.emblem, '#ffffff');
  const emblemMat = new THREE.MeshBasicMaterial({ map: emblemTex, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(def.accent).multiplyScalar(0.25).addScalar(0.02), polygonOffset: true, polygonOffsetFactor: -2 });
  const emblem = new THREE.Mesh(new THREE.PlaneGeometry(0.196, 0.0754), emblemMat);
  emblem.rotation.x = -Math.PI / 2;
  emblem.position.set(0, (CASE_BASE_H + CASE_LID_H + 2.8) * MM - LID_PIVOT.y * MM, 0 - LID_PIVOT.z * MM);
  lid.add(emblem);
  const labelTex = labelTexture(def.name);
  const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthWrite: false, opacity: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.025), labelMat);
  label.position.set(-0.035, (CASE_BASE_H + 60) * MM - LID_PIVOT.y * MM, (HD + 0.4) * MM - LID_PIVOT.z * MM);
  lid.add(label);
  owned.push(emblemTex, emblemMat, emblem.geometry, labelTex, labelMat, label.geometry);

  const latches: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(s * LATCH_PIVOT.x * MM, LATCH_PIVOT.y * MM, LATCH_PIVOT.z * MM);
    addParts(g, geo.latch);
    root.add(g);
    latches.push(g);
  }

  // lit well under the foam
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.15), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.05;
  root.add(glow);
  owned.push(glowMat, glow.geometry);

  const light = new THREE.PointLight(0xffffff, 0, 2.6, 1.8);
  light.position.set(0, 0.14, 0);
  root.add(light);

  const tmp = new THREE.Color();
  return {
    root,
    lid,
    latches,
    glow,
    light,
    def,
    setLid(t) {
      lid.rotation.x = -t * 1.92;
    },
    setLatches(t) {
      for (const l of latches) l.rotation.x = t * 2.15;
    },
    setGlow(color, strength) {
      tmp.set(color);
      glowMat.color.copy(tmp).multiplyScalar(strength * 2.6);
      light.color.copy(tmp);
      light.intensity = strength * 5.5;
      emblemMat.color.set(def.accent).multiplyScalar(0.25 + strength * 0.2).addScalar(0.02);
    },
    dispose() {
      for (const o of owned) o.dispose();
      root.removeFromParent();
    },
  };
}
