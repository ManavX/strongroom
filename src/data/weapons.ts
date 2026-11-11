/** Weapon platforms. Every skin is a finish applied to one of these. */
import type { StockName } from '../engine/finishes/stock';

export type WeaponKind = 'Rifle' | 'Sniper' | 'SMG' | 'Shotgun' | 'Pistol' | 'Knife';

export interface WeaponDef {
  id: string;
  name: string;
  kind: WeaponKind;
  /** Factory finish for parts a skin leaves alone. */
  stock: { body: StockName; sec: StockName };
  blurb: string;
  /** Sound family for the test-fire interaction. */
  report: 'rifle' | 'heavy' | 'pistol' | 'magnum' | 'smg' | 'shotgun' | 'blade';
}

export const WEAPONS: Record<string, WeaponDef> = {
  krait: {
    id: 'krait',
    name: 'Krait-47',
    kind: 'Rifle',
    stock: { body: 'blackOxide', sec: 'laminate' },
    blurb: 'Stamped-steel assault rifle with laminate furniture. Crude, loud and impossible to kill.',
    report: 'rifle',
  },
  marshal: {
    id: 'marshal',
    name: 'Marshal C4',
    kind: 'Rifle',
    stock: { body: 'anodised', sec: 'polymer' },
    blurb: 'Modular carbine with a free-float handguard. The benchmark everything else is measured against.',
    report: 'rifle',
  },
  longwatch: {
    id: 'longwatch',
    name: 'Longwatch .338',
    kind: 'Sniper',
    stock: { body: 'anodised', sec: 'polymer' },
    blurb: 'Bolt-action precision rifle in a full chassis. One round, one decision.',
    report: 'heavy',
  },
  vesper: {
    id: 'vesper',
    name: 'Vesper-9',
    kind: 'SMG',
    stock: { body: 'anodised', sec: 'polymer' },
    blurb: 'Compact 9 mm submachine gun built for tight corridors and short arguments.',
    report: 'smg',
  },
  breacher: {
    id: 'breacher',
    name: 'Breacher-12',
    kind: 'Shotgun',
    stock: { body: 'blackOxide', sec: 'polymer' },
    blurb: 'Pump-action 12 gauge. Opens doors, ends conversations.',
    report: 'shotgun',
  },
  sentry: {
    id: 'sentry',
    name: 'Sentry-9',
    kind: 'Pistol',
    stock: { body: 'blackOxide', sec: 'polymer' },
    blurb: 'Striker-fired service pistol. Seventeen rounds of dependable.',
    report: 'pistol',
  },
  magnate: {
    id: 'magnate',
    name: 'Magnate .50',
    kind: 'Pistol',
    stock: { body: 'blackOxide', sec: 'polymer' },
    blurb: 'Gas-operated magnum pistol. Absurd in every dimension, including the recoil.',
    report: 'magnum',
  },
  regent: {
    id: 'regent',
    name: 'Regent .357',
    kind: 'Pistol',
    stock: { body: 'blackOxide', sec: 'walnut' },
    blurb: 'Six-shot double-action revolver. Old habits, deep bluing.',
    report: 'magnum',
  },
  karambit: {
    id: 'karambit',
    name: 'Karambit',
    kind: 'Knife',
    stock: { body: 'satin', sec: 'polymer' },
    blurb: 'Claw-profile blade with a retention ring. Small, curved and personal.',
    report: 'blade',
  },
  tanto: {
    id: 'tanto',
    name: 'Tanto',
    kind: 'Knife',
    stock: { body: 'satin', sec: 'polymer' },
    blurb: 'Angular fighting knife with a reinforced tip. All geometry, no apology.',
    report: 'blade',
  },
  kukri: {
    id: 'kukri',
    name: 'Kukri',
    kind: 'Knife',
    stock: { body: 'satin', sec: 'walnut' },
    blurb: 'Forward-weighted recurve chopper. Half tool, half heirloom.',
    report: 'blade',
  },
};

export const WEAPON_KINDS: WeaponKind[] = ['Rifle', 'Sniper', 'SMG', 'Shotgun', 'Pistol', 'Knife'];
