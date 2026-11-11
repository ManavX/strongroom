/** Rarity ladder, drop odds and wear tiers. */

export type RarityId = 'service' | 'specialist' | 'elite' | 'master' | 'relic';

export interface Rarity {
  id: RarityId;
  name: string;
  /** Position on the ladder, 0 = most common. */
  tier: number;
  color: string;
  /** Brighter variant for glows and light sources. */
  glow: string;
  /** Probability of a case drop landing in this tier. */
  odds: number;
  /** Baseline credit value at pristine wear. */
  baseValue: number;
}

/**
 * Odds follow the distribution players expect from this genre:
 * each tier is roughly five times rarer than the one below it.
 */
export const RARITIES: Record<RarityId, Rarity> = {
  service: { id: 'service', name: 'Service', tier: 0, color: '#7f9cc4', glow: '#a9c4ea', odds: 0.7992, baseValue: 38 },
  specialist: { id: 'specialist', name: 'Specialist', tier: 1, color: '#2fc4b2', glow: '#6ff0de', odds: 0.1598, baseValue: 185 },
  elite: { id: 'elite', name: 'Elite', tier: 2, color: '#9a72ff', glow: '#c2a8ff', odds: 0.032, baseValue: 860 },
  master: { id: 'master', name: 'Master', tier: 3, color: '#ff4f6b', glow: '#ff8fa1', odds: 0.0064, baseValue: 4300 },
  relic: { id: 'relic', name: 'Relic', tier: 4, color: '#ffc94d', glow: '#ffe39a', odds: 0.0026, baseValue: 46000 },
};

export const RARITY_ORDER: RarityId[] = ['service', 'specialist', 'elite', 'master', 'relic'];

export const nextRarity = (r: RarityId): RarityId | null => {
  const i = RARITY_ORDER.indexOf(r);
  return i >= 0 && i < RARITY_ORDER.length - 1 ? RARITY_ORDER[i + 1] : null;
};

export type WearId = 'pristine' | 'light' | 'field' | 'heavy' | 'ravaged';

export interface WearTier {
  id: WearId;
  name: string;
  short: string;
  /** Upper bound of the float range (exclusive, except the last). */
  max: number;
}

export const WEAR_TIERS: WearTier[] = [
  { id: 'pristine', name: 'Pristine', short: 'PR', max: 0.08 },
  { id: 'light', name: 'Light Use', short: 'LU', max: 0.2 },
  { id: 'field', name: 'Field Worn', short: 'FW', max: 0.45 },
  { id: 'heavy', name: 'Heavy Wear', short: 'HW', max: 0.7 },
  { id: 'ravaged', name: 'Ravaged', short: 'RV', max: 1.0001 },
];

export function wearTier(float: number): WearTier {
  for (const t of WEAR_TIERS) if (float < t.max) return t;
  return WEAR_TIERS[WEAR_TIERS.length - 1];
}

/** Chance that a drop carries a Tally counter module. */
export const TALLY_CHANCE = 0.1;
/** Value multiplier for Tally items. */
export const TALLY_VALUE = 1.9;
/** Pattern seeds run 0..999. */
export const SEED_COUNT = 1000;
