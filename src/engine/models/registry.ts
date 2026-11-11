/** Lazy, cached access to built weapon geometry. */
import type { BuiltModel } from './kit';
import { buildKrait } from './weapons/krait';
import { buildMarshal } from './weapons/marshal';
import { buildLongwatch } from './weapons/longwatch';
import { buildSentry } from './weapons/sentry';
import { buildMagnate } from './weapons/magnate';
import { buildRegent } from './weapons/regent';
import { buildVesper } from './weapons/vesper';
import { buildBreacher } from './weapons/breacher';
import { buildKarambit } from './knives/karambit';
import { buildTanto } from './knives/tanto';
import { buildKukri } from './knives/kukri';

const builders: Record<string, () => BuiltModel> = {
  krait: buildKrait,
  marshal: buildMarshal,
  longwatch: buildLongwatch,
  sentry: buildSentry,
  magnate: buildMagnate,
  regent: buildRegent,
  vesper: buildVesper,
  breacher: buildBreacher,
  karambit: buildKarambit,
  tanto: buildTanto,
  kukri: buildKukri,
};

const cache = new Map<string, BuiltModel>();

export function hasModel(id: string): boolean {
  return id in builders;
}

export function modelIds(): string[] {
  return Object.keys(builders);
}

export function getModel(id: string): BuiltModel {
  let m = cache.get(id);
  if (!m) {
    const build = builders[id];
    if (!build) throw new Error(`Unknown weapon model "${id}"`);
    m = build();
    cache.set(id, m);
  }
  return m;
}

/** Build remaining models during idle time so the first inventory render does not hitch. */
export function warmModels(ids: string[] = modelIds()) {
  const queue = ids.filter((id) => !cache.has(id));
  const step = () => {
    const id = queue.shift();
    if (!id) return;
    getModel(id);
    if (queue.length) schedule();
  };
  const schedule = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(step, { timeout: 1500 });
    else setTimeout(step, 60);
  };
  schedule();
}
