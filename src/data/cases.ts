/** Case definitions and their drop tables. */
import { RARITY_ORDER, type RarityId } from './rarities';
import { SKIN_LIST, type SkinDef } from './skins';

export interface CaseDef {
  id: string;
  name: string;
  tagline: string;
  /** Credits to unlock (key included). */
  price: number;
  /** Trim colour on the shell and the UI accent while this case is selected. */
  accent: string;
  /** Shell look. */
  shell: { color: string; metalness: number; roughness: number; trim: string };
  emblem: 'anvil' | 'eye' | 'compass';
  /** Weapon id of the relic blade this case can drop. */
  relic: string;
}

export const CASES: Record<string, CaseDef> = {
  foundry: {
    id: 'foundry',
    name: 'Foundry Case',
    tagline: 'Heat, pressure and patience.',
    price: 250,
    accent: '#ff8a2a',
    shell: { color: '#2a2622', metalness: 0.15, roughness: 0.62, trim: '#c9741c' },
    emblem: 'anvil',
    relic: 'kukri',
  },
  blacksite: {
    id: 'blacksite',
    name: 'Blacksite Case',
    tagline: 'Signed for by nobody.',
    price: 250,
    accent: '#2fd6c3',
    shell: { color: '#15181c', metalness: 0.2, roughness: 0.55, trim: '#1aa897' },
    emblem: 'eye',
    relic: 'karambit',
  },
  meridian: {
    id: 'meridian',
    name: 'Meridian Case',
    tagline: 'Collected from the far side of the map.',
    price: 250,
    accent: '#e8c36a',
    shell: { color: '#3a3324', metalness: 0.1, roughness: 0.6, trim: '#c9a445' },
    emblem: 'compass',
    relic: 'tanto',
  },
};

export const CASE_LIST: CaseDef[] = Object.values(CASES);

export type CaseContents = Record<RarityId, SkinDef[]>;

const contentsCache = new Map<string, CaseContents>();

export function caseContents(caseId: string): CaseContents {
  let c = contentsCache.get(caseId);
  if (!c) {
    c = { service: [], specialist: [], elite: [], master: [], relic: [] };
    for (const s of SKIN_LIST) if (s.caseId === caseId) c[s.rarity].push(s);
    contentsCache.set(caseId, c);
  }
  return c;
}

/** Every skin in a case, rarest first. */
export function caseSkins(caseId: string): SkinDef[] {
  const c = caseContents(caseId);
  return [...RARITY_ORDER].reverse().flatMap((r) => c[r]);
}

export const CHEAPEST_CASE = Math.min(...CASE_LIST.map((c) => c.price));
