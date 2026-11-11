/**
 * The simulated economy: drop rolls, valuation, contracts and resupply rules.
 * Credits are play money. Nothing here touches real currency.
 */
import { caseContents, CASES, CHEAPEST_CASE } from '../data/cases';
import { nextRarity, RARITIES, RARITY_ORDER, SEED_COUNT, TALLY_CHANCE, TALLY_VALUE, type RarityId } from '../data/rarities';
import { SKINS, type SkinDef } from '../data/skins';
import { pickOne, rand, randInt, uid } from './rng';
import type { Item } from './types';

export const STARTING_CREDITS = 2500;
export const RESUPPLY_AMOUNT = 1500;
/** Free credits are always available when you cannot afford a case, otherwise on this cooldown. */
export const RESUPPLY_COOLDOWN_MS = 3 * 60 * 1000;
export const CONTRACT_SIZE = 10;

/* ---------------- rolling ---------------- */

/** Map a uniform roll to a rarity. The rarest tiers sit at the top of the range. */
export function rarityForRoll(roll: number): RarityId {
  let edge = 1;
  for (let i = RARITY_ORDER.length - 1; i > 0; i--) {
    edge -= RARITIES[RARITY_ORDER[i]].odds;
    if (roll >= edge) return RARITY_ORDER[i];
  }
  return RARITY_ORDER[0];
}

/** Lower bound of the roll range for each rarity, for showing how close a roll came. */
export function rarityThresholds(): Record<RarityId, number> {
  const out = {} as Record<RarityId, number>;
  let edge = 1;
  for (let i = RARITY_ORDER.length - 1; i >= 0; i--) {
    edge -= RARITIES[RARITY_ORDER[i]].odds;
    out[RARITY_ORDER[i]] = Math.max(0, edge);
  }
  return out;
}

const rollFloat = (skin: SkinDef) => {
  const f = skin.float[0] + rand() * (skin.float[1] - skin.float[0]);
  return Math.round(f * 1e6) / 1e6;
};

function mint(skin: SkinDef, caseId: string, source: Item['source'], tally: boolean, float: number, roll?: number): Item {
  return { id: uid(), skinId: skin.id, float, seed: randInt(SEED_COUNT), tally, count: 0, caseId, source, at: Date.now(), fav: false, roll };
}

/** Open one case. */
export function rollCase(caseId: string): Item {
  const contents = caseContents(caseId);
  const roll = rand();
  let rarity = rarityForRoll(roll);
  // A case with an empty tier falls through to the next one down.
  while (!contents[rarity].length && rarity !== 'service') rarity = RARITY_ORDER[RARITY_ORDER.indexOf(rarity) - 1];
  const skin = pickOne(contents[rarity]);
  return mint(skin, caseId, 'case', rand() < TALLY_CHANCE, rollFloat(skin), roll);
}

/** A filler entry for the reel: same odds as a real drop, but never minted. */
export function rollPreview(caseId: string): SkinDef {
  const contents = caseContents(caseId);
  let rarity = rarityForRoll(rand());
  while (!contents[rarity].length && rarity !== 'service') rarity = RARITY_ORDER[RARITY_ORDER.indexOf(rarity) - 1];
  return pickOne(contents[rarity]);
}

/* ---------------- valuation ---------------- */

/** Cleaner items are worth more; the curve is steepest near pristine. */
export function wearMultiplier(float: number): number {
  const pts: [number, number][] = [
    [0, 1.4],
    [0.02, 1.18],
    [0.08, 1.0],
    [0.2, 0.8],
    [0.45, 0.58],
    [0.7, 0.44],
    [1, 0.34],
  ];
  for (let i = 1; i < pts.length; i++) {
    if (float <= pts[i][0]) {
      const t = (float - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
      return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
    }
  }
  return pts[pts.length - 1][1];
}

export function valueOf(skinId: string, float: number, tally: boolean): number {
  const skin = SKINS[skinId];
  if (!skin) return 0;
  const v = RARITIES[skin.rarity].baseValue * skin.value * wearMultiplier(float) * (tally ? TALLY_VALUE : 1);
  return Math.max(1, Math.round(v));
}

export const itemValue = (item: Item) => valueOf(item.skinId, item.float, item.tally);

/* ---------------- contracts ---------------- */

export interface ContractCheck {
  ok: boolean;
  reason?: string;
  rarity?: RarityId;
  target?: RarityId;
  tally?: boolean;
}

/** Ten items of one rarity, all Tally or none, trade up to one item of the next rarity. */
export function checkContract(items: Item[]): ContractCheck {
  if (!items.length) return { ok: false, reason: 'Add ten items of the same rarity.' };
  const rarity = SKINS[items[0].skinId].rarity;
  const tally = items[0].tally;
  const target = nextRarity(rarity);
  if (!target || target === 'relic') return { ok: false, reason: `${RARITIES[rarity].name} items cannot be traded up.`, rarity };
  for (const it of items) {
    if (SKINS[it.skinId].rarity !== rarity) return { ok: false, reason: 'All items must share one rarity.', rarity };
    if (it.tally !== tally) return { ok: false, reason: 'Tally and standard items cannot be mixed.', rarity };
  }
  if (items.length < CONTRACT_SIZE) return { ok: false, reason: `${CONTRACT_SIZE - items.length} more needed.`, rarity, target, tally };
  if (items.length > CONTRACT_SIZE) return { ok: false, reason: `A contract takes exactly ${CONTRACT_SIZE} items.`, rarity, target, tally };
  return { ok: true, rarity, target, tally };
}

export interface ContractOutcome {
  skin: SkinDef;
  chance: number;
}

/** Possible results, weighted by how many inputs came from each case. */
export function contractOutcomes(items: Item[]): ContractOutcome[] {
  const check = checkContract(items);
  if (!check.target) return [];
  const byCase = new Map<string, number>();
  for (const it of items) byCase.set(it.caseId, (byCase.get(it.caseId) ?? 0) + 1);
  const out: ContractOutcome[] = [];
  for (const [caseId, n] of byCase) {
    const pool = caseContents(caseId)[check.target];
    for (const skin of pool) out.push({ skin, chance: n / items.length / pool.length });
  }
  return out.sort((a, b) => b.chance - a.chance);
}

/** Execute a valid contract. The result's wear follows the average wear of the inputs. */
export function rollContract(items: Item[]): Item | null {
  const check = checkContract(items);
  if (!check.ok || !check.target) return null;
  const donor = pickOne(items);
  const pool = caseContents(donor.caseId)[check.target];
  if (!pool.length) return null;
  const skin = pickOne(pool);
  let norm = 0;
  for (const it of items) {
    const s = SKINS[it.skinId];
    const span = s.float[1] - s.float[0] || 1;
    norm += (it.float - s.float[0]) / span;
  }
  norm /= items.length;
  const float = Math.round((skin.float[0] + norm * (skin.float[1] - skin.float[0])) * 1e6) / 1e6;
  return mint(skin, donor.caseId, 'contract', !!check.tally, float);
}

/* ---------------- resupply ---------------- */

export function resupplyState(credits: number, lastResupply: number, now = Date.now()): { available: boolean; waitMs: number; broke: boolean } {
  const broke = credits < CHEAPEST_CASE;
  const waitMs = Math.max(0, lastResupply + RESUPPLY_COOLDOWN_MS - now);
  return { available: broke || waitMs === 0, waitMs: broke ? 0 : waitMs, broke };
}

export const casePrice = (caseId: string) => CASES[caseId]?.price ?? 0;

/** Long-run average value returned per case, for the odds panel. */
export function expectedValue(caseId: string): number {
  const contents = caseContents(caseId);
  let ev = 0;
  for (const r of RARITY_ORDER) {
    const pool = contents[r];
    if (!pool.length) continue;
    let avg = 0;
    for (const s of pool) {
      // average the wear curve across the skin's float range
      let w = 0;
      const steps = 24;
      for (let i = 0; i < steps; i++) w += wearMultiplier(s.float[0] + ((i + 0.5) / steps) * (s.float[1] - s.float[0]));
      avg += RARITIES[r].baseValue * s.value * (w / steps);
    }
    ev += RARITIES[r].odds * (avg / pool.length) * (1 + TALLY_CHANCE * (TALLY_VALUE - 1));
  }
  return ev;
}
