/** Ephemeral interface state. Nothing here is persisted. */
import { create } from 'zustand';
import type { Item } from '../core/types';
import type { ItemSpec } from '../engine/itemObject';

export type View = 'vault' | 'inventory' | 'contracts' | 'collection' | 'records';
export type Phase = 'idle' | 'unlatch' | 'reel' | 'reveal' | 'result';

export type InspectTarget = { kind: 'item'; id: string } | ({ kind: 'preview' } & ItemSpec);

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad';
}

interface UIState {
  view: View;
  caseId: string;
  phase: Phase;
  drop: Item | null;
  dropSource: 'case' | 'contract';
  inspect: InspectTarget | null;
  photo: boolean;
  settingsOpen: boolean;
  toasts: Toast[];
  /** Inventory multi-select. */
  selecting: boolean;
  selection: string[];
  /** Item ids placed in the contract slots. */
  contract: string[];
  setView: (v: View) => void;
  setCase: (id: string) => void;
  set: (patch: Partial<UIState>) => void;
  openInspect: (t: InspectTarget) => void;
  closeInspect: () => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
  toggleContract: (id: string) => void;
}

let toastId = 1;

export const useUI = create<UIState>((set, get) => ({
  view: 'vault',
  caseId: 'foundry',
  phase: 'idle',
  drop: null,
  dropSource: 'case',
  inspect: null,
  photo: false,
  settingsOpen: false,
  toasts: [],
  selecting: false,
  selection: [],
  contract: [],
  setView: (view) => {
    if (get().phase !== 'idle' && get().phase !== 'result') return;
    set({ view, inspect: null, photo: false, selecting: false, selection: [] });
  },
  setCase: (caseId) => {
    if (get().phase === 'idle') set({ caseId });
  },
  set: (patch) => set(patch),
  openInspect: (inspect) => set({ inspect, photo: false }),
  closeInspect: () => set({ inspect: null, photo: false }),
  toast: (text, tone = 'info') => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
  toggleSelected: (id) => set((s) => ({ selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id] })),
  clearSelection: () => set({ selection: [], selecting: false }),
  toggleContract: (id) =>
    set((s) => {
      if (s.contract.includes(id)) return { contract: s.contract.filter((x) => x !== id) };
      if (s.contract.length >= 10) return {};
      return { contract: [...s.contract, id] };
    }),
}));
