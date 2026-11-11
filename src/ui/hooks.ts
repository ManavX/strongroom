import { useEffect, useRef, useState, type RefObject } from 'react';
import { getEngine, whenEngine, type Engine } from '../engine/Engine';
import { specKey, type ItemSpec } from '../engine/itemObject';

export function useEngine(): Engine | null {
  const [engine, setEngine] = useState<Engine | null>(getEngine());
  useEffect(() => {
    if (engine) return;
    let alive = true;
    void whenEngine().then((e) => alive && setEngine(e));
    return () => {
      alive = false;
    };
  }, [engine]);
  return engine;
}

/**
 * Rendered thumbnail URL for an item. Requests the render only while `active`
 * (cards pass their on-screen state) so a large inventory renders lazily.
 */
export function useThumb(spec: ItemSpec | null, active = true): [string | null, () => void] {
  const engine = useEngine();
  const key = spec ? specKey(spec) : '';
  const [state, setState] = useState<{ key: string; url: string | null }>(() => ({ key, url: spec && engine ? engine.thumbs.peek(spec) : null }));
  const [retry, setRetry] = useState(0);

  let url = state.key === key ? state.url : null;
  if (!url && spec && engine) url = engine.thumbs.peek(spec);

  useEffect(() => {
    if (!spec || !engine || !active) return;
    const cached = engine.thumbs.peek(spec);
    if (cached) {
      setState({ key, url: cached });
      return;
    }
    let alive = true;
    engine.thumbs
      .request(spec)
      .then((u) => alive && setState({ key, url: u }))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // spec identity is captured by `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, engine, active, retry]);

  // If the cache evicted and revoked this URL, ask again.
  const onError = () => {
    setState({ key, url: null });
    setRetry((n) => n + 1);
  };
  return [url, onError];
}

/** True once the element has come within `margin` of the viewport. */
export function useNearViewport<T extends Element>(margin = '260px'): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, margin]);
  return [ref, seen];
}

/** Re-render on an interval (countdowns). */
export function useNow(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}

export function useKey(handler: (e: KeyboardEvent) => void, deps: unknown[]) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      handler(e);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
