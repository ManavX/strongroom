/** Builds the renderable object for an inventory item or a catalogue preview. */
import * as THREE from 'three';
import { SKINS } from '../data/skins';
import { WEAPONS } from '../data/weapons';
import { resolveLook } from './finishes/library';
import { createTally, disposeTally, setTallyCount } from './tally';
import { createWeapon, disposeWeapon, setWeaponWear, type WeaponObject } from './weaponFactory';

export interface ItemSpec {
  skinId: string;
  float: number;
  seed: number;
  tally: boolean;
  count?: number;
}

export const specKey = (s: ItemSpec) => `${s.skinId}|${s.float.toFixed(4)}|${s.seed}|${s.tally ? 1 : 0}`;

const FORWARD = new THREE.Vector3(0, 0, 1);

export function createItemObject(spec: ItemSpec): WeaponObject {
  const skin = SKINS[spec.skinId];
  if (!skin) throw new Error(`Unknown skin "${spec.skinId}"`);
  const weapon = WEAPONS[skin.weapon];
  const look = resolveLook(weapon.id, weapon.stock, skin.recipe, skin.id, spec.seed);
  const obj = createWeapon(weapon.id, look, spec.float, spec.seed);
  if (spec.tally) {
    const anchor = obj.userData.anchors.tally;
    if (anchor) {
      const t = createTally(spec.count ?? 0, spec.float);
      t.position.copy(anchor.pos);
      if (anchor.dir) t.quaternion.setFromUnitVectors(FORWARD, anchor.dir);
      // Knives carry a smaller unit.
      if (weapon.kind === 'Knife') t.scale.setScalar(0.72);
      obj.add(t);
    }
  }
  return obj;
}

export function updateItemObject(obj: THREE.Object3D, patch: { float?: number; seed?: number; count?: number }) {
  if (patch.float !== undefined) setWeaponWear(obj, patch.float, patch.seed);
  if (patch.count !== undefined) {
    const t = obj.getObjectByName('tally');
    if (t) setTallyCount(t, patch.count);
  }
}

export function disposeItemObject(obj: THREE.Object3D) {
  const t = obj.getObjectByName('tally');
  if (t) disposeTally(t);
  disposeWeapon(obj);
}
