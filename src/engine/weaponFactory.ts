/**
 * Turns a built model + a look (one surface spec per material group) into a
 * renderable object. Geometry is shared between every instance of a weapon;
 * materials are per instance because wear and seed are per item.
 */
import * as THREE from 'three';
import type { Group } from './models/kit';
import { getModel } from './models/registry';
import { createSurface, setSurfaceWear, type SurfaceSpec } from './materials/surface';
import { STOCK } from './finishes/stock';

export interface WeaponLook {
  body: SurfaceSpec;
  sec: SurfaceSpec;
  steel?: SurfaceSpec;
  bright?: SurfaceSpec;
  rubber?: SurfaceSpec;
}

/** Model units are millimetres; the scene is in metres. */
export const MM = 0.001;

const glassMat = () =>
  new THREE.MeshPhysicalMaterial({
    color: 0x070d14,
    metalness: 0.3,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    iridescence: 1,
    iridescenceIOR: 1.9,
    iridescenceThicknessRange: [260, 420],
    envMapIntensity: 1.7,
  });

const darkMat = () => new THREE.MeshStandardMaterial({ color: 0x040404, roughness: 0.95, metalness: 0 });

export interface WeaponObject extends THREE.Group {
  userData: {
    weaponId: string;
    /** Bounding box in metres, centred on the origin. */
    bounds: THREE.Box3;
    anchors: Record<string, { pos: THREE.Vector3; dir?: THREE.Vector3 }>;
    materials: THREE.Material[];
  };
}

export function createWeapon(weaponId: string, look: WeaponLook, wear: number, seed: number): WeaponObject {
  const model = getModel(weaponId);
  const root = new THREE.Group() as WeaponObject;
  root.name = `weapon:${weaponId}`;
  const materials: THREE.Material[] = [];

  const specFor = (g: Group): THREE.Material => {
    switch (g) {
      case 'body':
        return createSurface(look.body, wear, seed);
      case 'sec':
        return createSurface(look.sec, wear, seed + 0.31);
      case 'steel':
        return createSurface(look.steel ?? STOCK.gunSteel(), wear, seed + 0.57);
      case 'bright':
        return createSurface(look.bright ?? STOCK.bright(), wear, seed + 0.73);
      case 'rubber':
        return createSurface(look.rubber ?? STOCK.rubber(), wear, seed + 0.11);
      case 'glass':
        return glassMat();
      case 'led':
        return new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.25, 0.1).multiplyScalar(3), toneMapped: false });
      case 'dark':
      default:
        return darkMat();
    }
  };

  for (const [group, geo] of Object.entries(model.parts) as [Group, THREE.BufferGeometry][]) {
    const mat = specFor(group);
    materials.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = group;
    mesh.scale.setScalar(MM);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  const bounds = model.bounds.clone();
  bounds.min.multiplyScalar(MM);
  bounds.max.multiplyScalar(MM);
  const anchors: WeaponObject['userData']['anchors'] = {};
  for (const [k, a] of Object.entries(model.anchors)) {
    anchors[k] = { pos: a.pos.clone().multiplyScalar(MM), dir: a.dir?.clone() };
  }
  root.userData = { weaponId, bounds, anchors, materials };
  return root;
}

export function setWeaponWear(obj: THREE.Object3D, wear: number, seed?: number) {
  const mats = (obj as WeaponObject).userData?.materials;
  if (!mats) return;
  for (const m of mats) setSurfaceWear(m, wear, seed);
}

/** Dispose per-instance materials. Shared geometry and cached textures are left alone. */
export function disposeWeapon(obj: THREE.Object3D) {
  const mats = (obj as WeaponObject).userData?.materials;
  if (mats) for (const m of mats) m.dispose();
  obj.removeFromParent();
}
