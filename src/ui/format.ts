import type { Item } from '../core/types';
import type { ItemSpec } from '../engine/itemObject';
import type { SkinDef } from '../data/skins';

const nf = new Intl.NumberFormat('en-US');

export const fmtCR = (n: number) => nf.format(Math.round(n));
export const fmtFloat = (f: number) => f.toFixed(5);
export const fmtPct = (p: number, digits = 2) => `${(p * 100).toFixed(digits)}%`;

export function fmtAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export const fmtDate = (at: number) => new Date(at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function fmtCountdown(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const itemSpec = (it: Item): ItemSpec => ({ skinId: it.skinId, float: it.float, seed: it.seed, tally: it.tally, count: it.count });

/** The representative render of a skin for catalogue views: clean, fixed seed. */
export const catalogSpec = (skin: SkinDef): ItemSpec => ({
  skinId: skin.id,
  float: Math.min(skin.float[1], Math.max(skin.float[0], 0.03)),
  seed: 7,
  tally: false,
});
