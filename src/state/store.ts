/**
 * Persistent game state: credits, inventory, history and settings.
 * Saved to IndexedDB (structured clone, debounced) so large inventories do not
 * stall the UI the way a synchronous localStorage write would.
 */
import { del, get, set } from 'idb-keyval';
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { CASES } from '../data/cases';
import { SKINS } from '../data/skins';
import { checkContract, itemValue, RESUPPLY_AMOUNT, resupplyState, rollCase, rollContract, STARTING_CREDITS } from '../core/economy';
import { uid } from '../core/rng';
import type { HistoryEntry, Item, Settings, Stats } from '../core/types';

const HISTORY_LIMIT = 400;

export interface Discovery {
  /** How many have been unboxed. */
  n: number;
  /** Lowest wear seen. */
  best: number;
  first: number;
}

interface Persisted {
  credits: number;
  lastResupply: number;
  items: Item[];
  history: HistoryEntry[];
  stats: Stats;
  discovered: Record<string, Discovery>;
  settings: Settings;
}

export interface GameState extends Persisted {
  hydrated: boolean;
  openCase: (caseId: string) => Item | null;
  sellItems: (ids: string[]) => number;
  toggleFav: (id: string) => void;
  executeContract: (ids: string[]) => Item | null;
  resupply: () => boolean;
  addCount: (id: string, n?: number) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetAll: () => void;
}

const emptyStats = (): Stats => ({
  opened: 0,
  spent: 0,
  unboxedValue: 0,
  sold: 0,
  soldValue: 0,
  contracts: 0,
  resupplies: 0,
  byRarity: {},
  byCase: {},
  sinceRelic: 0,
  longestDrySpell: 0,
  bestDrop: null,
});

const initial = (): Persisted => ({
  credits: STARTING_CREDITS,
  lastResupply: 0,
  items: [],
  history: [],
  stats: emptyStats(),
  discovered: {},
  settings: {
    quality: 'auto',
    volume: 0.7,
    muted: false,
    quickOpen: false,
    reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  },
});

/* ---------------- storage ---------------- */

let pending: { name: string; value: StorageValue<Persisted> } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!pending) return;
  const { name, value } = pending;
  pending = null;
  set(name, value).catch((e) => console.warn('[strongroom] save failed', e));
}

const storage: PersistStorage<Persisted> = {
  getItem: async (name) => {
    try {
      return ((await get(name)) as StorageValue<Persisted> | undefined) ?? null;
    } catch (e) {
      console.warn('[strongroom] load failed', e);
      return null;
    }
  },
  setItem: (name, value) => {
    pending = { name, value };
    if (!timer) timer = setTimeout(flush, 350);
  },
  removeItem: (name) => del(name),
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

/* ---------------- helpers ---------------- */

function record(state: Persisted, item: Item, kind: HistoryEntry['kind']): Pick<Persisted, 'history' | 'discovered' | 'stats'> {
  const value = itemValue(item);
  const entry: HistoryEntry = { id: uid(), at: item.at, kind, caseId: item.caseId, skinId: item.skinId, float: item.float, seed: item.seed, tally: item.tally, value, roll: item.roll };
  const rarity = SKINS[item.skinId].rarity;
  const prev = state.discovered[item.skinId];
  const discovered = {
    ...state.discovered,
    [item.skinId]: { n: (prev?.n ?? 0) + 1, best: Math.min(prev?.best ?? 1, item.float), first: prev?.first ?? item.at },
  };
  const s = state.stats;
  const stats: Stats = {
    ...s,
    unboxedValue: s.unboxedValue + value,
    byRarity: { ...s.byRarity, [rarity]: (s.byRarity[rarity] ?? 0) + 1 },
    bestDrop: !s.bestDrop || value > s.bestDrop.value ? entry : s.bestDrop,
  };
  return { history: [entry, ...state.history].slice(0, HISTORY_LIMIT), discovered, stats };
}

/* ---------------- store ---------------- */

export const useGame = create<GameState>()(
  persist(
    (setState, getState) => ({
      ...initial(),
      hydrated: false,

      openCase: (caseId) => {
        const st = getState();
        const def = CASES[caseId];
        if (!def || st.credits < def.price) return null;
        const item = rollCase(caseId);
        const rec = record(st, item, 'case');
        const isRelic = SKINS[item.skinId].rarity === 'relic';
        const sinceRelic = isRelic ? 0 : st.stats.sinceRelic + 1;
        setState({
          credits: st.credits - def.price,
          items: [item, ...st.items],
          ...rec,
          stats: {
            ...rec.stats,
            opened: st.stats.opened + 1,
            spent: st.stats.spent + def.price,
            byCase: { ...st.stats.byCase, [caseId]: (st.stats.byCase[caseId] ?? 0) + 1 },
            sinceRelic,
            longestDrySpell: Math.max(st.stats.longestDrySpell, sinceRelic),
          },
        });
        return item;
      },

      sellItems: (ids) => {
        const st = getState();
        const kill = new Set(ids);
        let total = 0;
        let n = 0;
        const items = st.items.filter((it) => {
          if (!kill.has(it.id) || it.fav) return true;
          total += itemValue(it);
          n++;
          return false;
        });
        if (!n) return 0;
        setState({ items, credits: st.credits + total, stats: { ...st.stats, sold: st.stats.sold + n, soldValue: st.stats.soldValue + total } });
        return total;
      },

      toggleFav: (id) => setState((st) => ({ items: st.items.map((it) => (it.id === id ? { ...it, fav: !it.fav } : it)) })),

      executeContract: (ids) => {
        const st = getState();
        const idSet = new Set(ids);
        const inputs = st.items.filter((it) => idSet.has(it.id));
        if (inputs.length !== ids.length || !checkContract(inputs).ok) return null;
        const result = rollContract(inputs);
        if (!result) return null;
        const remaining = st.items.filter((it) => !idSet.has(it.id));
        const rec = record({ ...st, items: remaining }, result, 'contract');
        setState({ items: [result, ...remaining], ...rec, stats: { ...rec.stats, contracts: st.stats.contracts + 1 } });
        return result;
      },

      resupply: () => {
        const st = getState();
        if (!resupplyState(st.credits, st.lastResupply).available) return false;
        setState({ credits: st.credits + RESUPPLY_AMOUNT, lastResupply: Date.now(), stats: { ...st.stats, resupplies: st.stats.resupplies + 1 } });
        return true;
      },

      addCount: (id, n = 1) => setState((st) => ({ items: st.items.map((it) => (it.id === id && it.tally ? { ...it, count: it.count + n } : it)) })),

      setSetting: (key, value) => setState((st) => ({ settings: { ...st.settings, [key]: value } })),

      resetAll: () => setState({ ...initial(), settings: getState().settings }),
    }),
    {
      name: 'strongroom:v1',
      version: 1,
      storage,
      partialize: (s): Persisted => ({
        credits: s.credits,
        lastResupply: s.lastResupply,
        items: s.items,
        history: s.history,
        stats: s.stats,
        discovered: s.discovered,
        settings: s.settings,
      }),
      // Drop anything that refers to a skin that no longer exists, and fill in fields added later.
      merge: (saved, current) => {
        const p = (saved ?? {}) as Partial<Persisted>;
        const base = initial();
        return {
          ...current,
          ...base,
          ...p,
          items: (p.items ?? []).filter((it) => SKINS[it.skinId]),
          history: (p.history ?? []).filter((h) => SKINS[h.skinId]),
          stats: { ...base.stats, ...p.stats, bestDrop: p.stats?.bestDrop && SKINS[p.stats.bestDrop.skinId] ? p.stats.bestDrop : null },
          settings: { ...base.settings, ...p.settings },
        };
      },
      onRehydrateStorage: () => () => {
        useGame.setState({ hydrated: true });
      },
    },
  ),
);

/** Total sell value of the inventory. */
export const inventoryValue = (items: Item[]) => items.reduce((sum, it) => sum + itemValue(it), 0);
