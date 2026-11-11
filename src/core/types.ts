/** Shared domain types. */

export interface Item {
  /** Unique instance id. */
  id: string;
  skinId: string;
  /** Wear, 0 (pristine) .. 1 (ravaged). Fixed for the life of the item. */
  float: number;
  /** Pattern seed 0..999: slides and rotates the finish. */
  seed: number;
  /** Carries a Tally counter module. */
  tally: boolean;
  /** Rounds test-fired (or flourishes, for blades) while a Tally module was fitted. */
  count: number;
  /** Case it came from; contracts inherit the case of the item they drew from. */
  caseId: string;
  source: 'case' | 'contract';
  /** Unboxed-at timestamp (ms). */
  at: number;
  fav: boolean;
  /** The raw 0..1 roll that decided the rarity (case drops only). */
  roll?: number;
}

export interface HistoryEntry {
  id: string;
  at: number;
  kind: 'case' | 'contract';
  caseId: string;
  skinId: string;
  float: number;
  seed: number;
  tally: boolean;
  value: number;
  roll?: number;
}

export interface Stats {
  opened: number;
  spent: number;
  /** Value of everything unboxed, at the moment it dropped. */
  unboxedValue: number;
  sold: number;
  soldValue: number;
  contracts: number;
  resupplies: number;
  byRarity: Record<string, number>;
  byCase: Record<string, number>;
  /** Cases opened since the last relic. */
  sinceRelic: number;
  longestDrySpell: number;
  bestDrop: HistoryEntry | null;
}

export type Quality = 'auto' | 'low' | 'medium' | 'high';

export interface Settings {
  quality: Quality;
  volume: number;
  muted: boolean;
  quickOpen: boolean;
  reducedMotion: boolean;
}
