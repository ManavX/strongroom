/** Named test looks for the lab viewer. `skin:<id>` resolves a catalogue skin. */
import type { WeaponLook } from '../engine/weaponFactory';
import { STOCK } from '../engine/finishes/stock';
import { resolveLook } from '../engine/finishes/library';
import { SKINS } from '../data/skins';
import { WEAPONS } from '../data/weapons';

export function skinWeapon(name: string): string | null {
  return name.startsWith('skin:') ? (SKINS[name.slice(5)]?.weapon ?? null) : null;
}

export function labLook(name: string, seed = 1): WeaponLook | null {
  if (name.startsWith('skin:')) {
    const s = SKINS[name.slice(5)];
    if (!s) return null;
    const w = WEAPONS[s.weapon];
    return resolveLook(w.id, w.stock, s.recipe, s.id, Math.round(seed));
  }
  switch (name) {
    case 'poly':
      return { body: STOCK.anodised(), sec: STOCK.polymer() };
    case 'walnut':
      return { body: STOCK.blackOxide(), sec: STOCK.walnut() };
    case 'knife':
      return { body: STOCK.satin(), sec: STOCK.polymer() };
    case 'knifewood':
      return { body: STOCK.satin(), sec: STOCK.walnut() };
    case 'steel':
      return { body: STOCK.satin(), sec: STOCK.walnut() };
    default:
      return null;
  }
}
