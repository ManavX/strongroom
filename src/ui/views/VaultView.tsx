/** The vault: pick a case, unlock it, watch the reel, meet the drop. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../../audio/audio';
import { expectedValue, rarityThresholds, resupplyState, rollPreview, valueOf } from '../../core/economy';
import type { Item } from '../../core/types';
import { caseContents, CASE_LIST, CASES } from '../../data/cases';
import { RARITIES, RARITY_ORDER } from '../../data/rarities';
import { SKINS, type SkinDef } from '../../data/skins';
import { WEAPONS } from '../../data/weapons';
import { getEngine } from '../../engine/Engine';
import { useGame } from '../../state/store';
import { useUI } from '../../state/ui';
import { Btn, rarVar, RarityTag, Switch, Thumb, WearGauge } from '../components';
import { catalogSpec, fmtCR, fmtPct, itemSpec } from '../format';
import { useKey } from '../hooks';
import { IconBolt, IconChevL, IconChevR, IconEye, IconStarFill, IconSupply } from '../icons';

const REEL_COUNT = 58;
const REEL_WIN = 49;
const REEL_MS = 6400;

/* ------------------------------------------------------------------ */
/* Reel                                                                */
/* ------------------------------------------------------------------ */

function ReelCard({ skin }: { skin: SkinDef }) {
  const relic = skin.rarity === 'relic';
  return (
    <div className="reel__card" style={rarVar(skin.rarity)} data-relic={relic || undefined}>
      <div className="reel__art">
        {relic ? (
          <div className="reel__mystery">
            <IconStarFill />
          </div>
        ) : (
          <Thumb spec={catalogSpec(skin)} eager className="reel__img" />
        )}
      </div>
      <div className="reel__meta">
        <span className="reel__weapon">{relic ? 'Relic blade' : WEAPONS[skin.weapon].name}</span>
        <span className="reel__name">{relic ? 'Classified' : skin.name}</span>
      </div>
    </div>
  );
}

function Reel({ caseId, winner, onDone }: { caseId: string; winner: Item; onDone: () => void }) {
  const windowRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const skip = useRef(false);
  const entries = useMemo(() => {
    const list: SkinDef[] = [];
    for (let i = 0; i < REEL_COUNT; i++) list.push(i === REEL_WIN ? SKINS[winner.skinId] : rollPreview(caseId));
    return list;
    // one strip per opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const win = windowRef.current!;
    const strip = stripRef.current!;
    const cards = Array.from(strip.children) as HTMLElement[];
    const stage = getEngine()?.stage;
    const step = cards[1].offsetLeft - cards[0].offsetLeft;
    const cardW = cards[0].offsetWidth;
    const x0 = cardW * 1.5;
    // land somewhere inside the winning card, never dead centre every time
    const x1 = REEL_WIN * step + cardW * (0.14 + Math.random() * 0.72);
    const ease = (t: number) => 1 - Math.pow(1 - t, 4.6);
    let start = 0;
    let last = -1;
    let raf = 0;
    let done = false;
    const frame = (now: number) => {
      if (!start) start = now;
      if (skip.current) {
        start = Math.min(start, now - REEL_MS + 420);
        skip.current = false;
      }
      const t = Math.min(1, (now - start) / REEL_MS);
      const x = x0 + (x1 - x0) * ease(t);
      strip.style.transform = `translate3d(${win.clientWidth / 2 - x}px,0,0)`;
      const idx = Math.max(0, Math.min(cards.length - 1, Math.floor(x / step)));
      if (idx !== last) {
        if (last >= 0) delete cards[last].dataset.hot;
        cards[idx].dataset.hot = 'true';
        last = idx;
        const rar = RARITIES[entries[idx].rarity];
        audio.tick(rar.tier);
        stage?.setReelGlow(rar.glow, 0.45 + t * 0.55);
      }
      if (t < 1) raf = requestAnimationFrame(frame);
      else if (!done) {
        done = true;
        cards[REEL_WIN].dataset.win = 'true';
        setTimeout(onDone, 560);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useKey((e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      skip.current = true;
    }
  }, []);

  return (
    <div className="reel" onClick={() => (skip.current = true)}>
      <div className="reel__window" ref={windowRef}>
        <div className="reel__strip" ref={stripRef}>
          {entries.map((s, i) => (
            <ReelCard key={i} skin={s} />
          ))}
        </div>
        <i className="reel__marker" />
      </div>
      <div className="reel__hint label">Click or press space to skip</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Result                                                              */
/* ------------------------------------------------------------------ */

export function ResultPanel({ item, source, onSell, onInspect, onAgain, onDone, againCost, canAgain }: { item: Item; source: 'case' | 'contract'; onSell: () => void; onInspect: () => void; onAgain?: () => void; onDone: () => void; againCost?: number; canAgain?: boolean }) {
  const skin = SKINS[item.skinId];
  const weapon = WEAPONS[skin.weapon];
  const rar = RARITIES[skin.rarity];
  const value = valueOf(item.skinId, item.float, item.tally);
  const thr = rarityThresholds();
  // Lift the item clear of this panel while it is on screen.
  useEffect(() => {
    const stage = getEngine()?.stage;
    stage?.setScreenOffset(0, -Math.round(window.innerHeight * 0.15));
    return () => stage?.setScreenOffset(0, 0);
  }, []);
  return (
    <div className="result" style={rarVar(skin.rarity)}>
      <div className="result__glow" />
      <div className="result__head">
        <RarityTag rarity={skin.rarity} />
        {item.tally && <span className="badge badge--tally">Tally</span>}
        <span className="result__src label">{source === 'case' ? CASES[item.caseId]?.name : 'Trade-up contract'}</span>
      </div>
      <div className="result__weapon">{weapon.name}</div>
      <h2 className="result__name">{skin.name}</h2>
      <p className="result__desc">{skin.desc}</p>
      <div className="result__stats">
        <WearGauge float={item.float} range={skin.float} />
        <dl className="kv">
          <dt>Pattern</dt>
          <dd>#{String(item.seed).padStart(3, '0')}</dd>
          <dt>Value</dt>
          <dd>{fmtCR(value)} CR</dd>
          {item.roll !== undefined && (
            <>
              <dt>Roll</dt>
              <dd title={`${rar.name} needs a roll of ${thr[skin.rarity].toFixed(4)} or higher`}>{item.roll.toFixed(5)}</dd>
            </>
          )}
        </dl>
      </div>
      <div className="result__actions">
        <Btn variant="ghost" onClick={onSell} quiet>
          Sell <span className="mono">+{fmtCR(value)}</span>
        </Btn>
        <Btn onClick={onInspect}>
          <IconEye /> Inspect
        </Btn>
        {onAgain && (
          <Btn onClick={onAgain} disabled={!canAgain}>
            Open another <span className="mono">−{fmtCR(againCost ?? 0)}</span>
          </Btn>
        )}
        <Btn variant="primary" onClick={onDone}>
          Keep
        </Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Contents                                                            */
/* ------------------------------------------------------------------ */

function Contents({ caseId, open, onClose }: { caseId: string; open: boolean; onClose: () => void }) {
  const contents = caseContents(caseId);
  const openInspect = useUI((s) => s.openInspect);
  const discovered = useGame((s) => s.discovered);
  return (
    <aside className="contents panel" data-open={open}>
      <div className="panel__head">
        <span className="label">Contents and odds</span>
        <button type="button" className="contents__close label" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="contents__list">
        {[...RARITY_ORDER].reverse().map((r) => {
          const pool = contents[r];
          if (!pool.length) return null;
          const rar = RARITIES[r];
          return (
            <section key={r} style={rarVar(r)}>
              <header className="contents__tier">
                <span className="rar">{rar.name}</span>
                <span className="mono contents__odds">{fmtPct(rar.odds, rar.odds < 0.01 ? 2 : 1)}</span>
              </header>
              {r === 'relic' ? (
                <button
                  type="button"
                  className="contents__row contents__row--relic"
                  onClick={() => {
                    audio.select();
                    openInspect({ kind: 'preview', ...catalogSpec(pool[pool.length - 1]) });
                  }}
                >
                  <span className="contents__thumb">
                    <span className="reel__mystery">
                      <IconStarFill />
                    </span>
                  </span>
                  <span className="contents__text">
                    <b>{WEAPONS[pool[0].weapon].name} blades</b>
                    <i>{pool.length} finishes, exceedingly rare</i>
                  </span>
                </button>
              ) : (
                pool.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className="contents__row"
                    data-found={!!discovered[s.id]}
                    onPointerEnter={() => audio.hover()}
                    onClick={() => {
                      audio.select();
                      openInspect({ kind: 'preview', ...catalogSpec(s) });
                    }}
                  >
                    <span className="contents__thumb">
                      <Thumb spec={catalogSpec(s)} className="contents__img" />
                    </span>
                    <span className="contents__text">
                      <b>{s.name}</b>
                      <i>{WEAPONS[s.weapon].name}</i>
                    </span>
                    <span className="mono contents__each">{fmtPct(rar.odds / pool.length, 2)}</span>
                  </button>
                ))
              )}
            </section>
          );
        })}
        <p className="contents__note">One in ten drops carries a Tally counter. Wear and pattern are rolled per item. Credits are play money: nothing here can be bought or cashed out.</p>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export function VaultView() {
  const caseId = useUI((s) => s.caseId);
  const phase = useUI((s) => s.phase);
  const drop = useUI((s) => s.drop);
  const setUI = useUI((s) => s.set);
  const setCase = useUI((s) => s.setCase);
  const toast = useUI((s) => s.toast);
  const openInspect = useUI((s) => s.openInspect);
  const credits = useGame((s) => s.credits);
  const lastResupply = useGame((s) => s.lastResupply);
  const quickOpen = useGame((s) => s.settings.quickOpen);
  const reducedMotion = useGame((s) => s.settings.reducedMotion);
  const setSetting = useGame((s) => s.setSetting);
  const [contentsOpen, setContentsOpen] = useState(false);
  const reelDone = useRef<(() => void) | null>(null);

  const def = CASES[caseId];
  const index = CASE_LIST.findIndex((c) => c.id === caseId);
  const canAfford = credits >= def.price;
  const supply = resupplyState(credits, lastResupply);
  const ev = useMemo(() => expectedValue(caseId), [caseId]);
  const relicName = WEAPONS[def.relic].name;

  const cycle = useCallback(
    (dir: number) => {
      if (phase !== 'idle') return;
      audio.select();
      setCase(CASE_LIST[(index + dir + CASE_LIST.length) % CASE_LIST.length].id);
    },
    [index, phase, setCase],
  );

  const open = useCallback(async () => {
    const ui = useUI.getState();
    if (ui.phase !== 'idle') return;
    const engine = getEngine();
    if (!engine) return;
    audio.unlock();
    const item = useGame.getState().openCase(ui.caseId);
    if (!item) {
      audio.error();
      toast('Not enough credits', 'bad');
      return;
    }
    // have the reel artwork ready before it rolls
    for (const pool of Object.values(caseContents(ui.caseId))) for (const s of pool) if (s.rarity !== 'relic') void engine.thumbs.request(catalogSpec(s));
    setUI({ phase: 'unlatch', drop: item, dropSource: 'case' });
    await engine.stage.unlatch();
    const st = useGame.getState().settings;
    if (!st.quickOpen && !st.reducedMotion) {
      setUI({ phase: 'reel' });
      await new Promise<void>((res) => (reelDone.current = res));
    }
    setUI({ phase: 'reveal' });
    await engine.stage.reveal(itemSpec(item));
    setUI({ phase: 'result' });
  }, [setUI, toast]);

  const dismiss = useCallback(async () => {
    const engine = getEngine();
    if (useUI.getState().phase !== 'result' || !engine) return;
    setUI({ phase: 'idle', drop: null });
    await engine.stage.dismissDrop('vault');
  }, [setUI]);

  const sell = useCallback(async () => {
    const d = useUI.getState().drop;
    if (!d) return;
    const got = useGame.getState().sellItems([d.id]);
    audio.coin();
    toast(`Sold for ${fmtCR(got)} CR`, 'good');
    await dismiss();
  }, [dismiss, toast]);

  const again = useCallback(async () => {
    await dismiss();
    await open();
  }, [dismiss, open]);

  const inspect = useCallback(() => {
    const d = useUI.getState().drop;
    if (!d) return;
    setUI({ phase: 'idle', drop: null });
    openInspect({ kind: 'item', id: d.id });
  }, [openInspect, setUI]);

  useKey(
    (e) => {
      if (phase === 'idle') {
        if (e.code === 'ArrowLeft') cycle(-1);
        else if (e.code === 'ArrowRight') cycle(1);
        else if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          void open();
        }
      } else if (phase === 'result') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          void again();
        } else if (e.code === 'Escape') void dismiss();
      }
    },
    [phase, cycle, open, again, dismiss],
  );

  // Render the case's catalogue artwork ahead of time so the list and the reel never show blanks.
  useEffect(() => {
    const engine = getEngine();
    if (!engine) return;
    for (const pool of Object.values(caseContents(caseId))) for (const s of pool) void engine.thumbs.request(catalogSpec(s)).catch(() => {});
  }, [caseId]);

  const idle = phase === 'idle';
  return (
    <div className="vault" data-phase={phase}>
      <div className="vault__left" data-show={idle}>
        <div className="vault__kicker mono">
          Case {String(index + 1).padStart(2, '0')} / {String(CASE_LIST.length).padStart(2, '0')}
        </div>
        <h1 className="vault__name">{def.name}</h1>
        <p className="vault__tag">{def.tagline}</p>
        <dl className="vault__facts">
          <div>
            <dt className="label">Relic drop</dt>
            <dd>{relicName}</dd>
          </div>
          <div>
            <dt className="label">Relic odds</dt>
            <dd className="mono">{fmtPct(RARITIES.relic.odds)}</dd>
          </div>
          <div>
            <dt className="label">Avg. return</dt>
            <dd className="mono">{fmtPct(ev / def.price, 0)}</dd>
          </div>
        </dl>
        <div className="caseswitch">
          <button type="button" className="iconbtn" onClick={() => cycle(-1)} aria-label="Previous case">
            <IconChevL />
          </button>
          {CASE_LIST.map((c) => (
            <button
              type="button"
              key={c.id}
              className="caseswitch__tab"
              data-on={c.id === caseId}
              style={{ ['--c' as string]: c.accent }}
              onPointerEnter={() => audio.hover()}
              onClick={() => {
                if (c.id !== caseId) {
                  audio.select();
                  setCase(c.id);
                }
              }}
            >
              {c.name.replace(' Case', '')}
            </button>
          ))}
          <button type="button" className="iconbtn" onClick={() => cycle(1)} aria-label="Next case">
            <IconChevR />
          </button>
        </div>
      </div>

      <div className="vault__right" data-show={idle}>
        <button type="button" className="btn btn--sm contents__toggle" onClick={() => setContentsOpen(true)}>
          Contents
        </button>
        <Contents caseId={caseId} open={contentsOpen} onClose={() => setContentsOpen(false)} />
      </div>

      <div className="cta" data-show={idle}>
        {canAfford ? (
          <Btn variant="primary" size="lg" onClick={() => void open()} quiet>
            Unlock <span className="cta__price mono">{fmtCR(def.price)} CR</span>
          </Btn>
        ) : (
          <div className="cta__broke">
            <span className="label">Not enough credits for this case</span>
            <Btn
              variant="primary"
              size="lg"
              disabled={!supply.available}
              onClick={() => {
                if (useGame.getState().resupply()) {
                  audio.coin(true);
                  toast('Resupply received', 'good');
                }
              }}
              quiet
            >
              <IconSupply /> Resupply
            </Btn>
          </div>
        )}
        <div className="cta__row">
          <Switch on={quickOpen || reducedMotion} onChange={(v) => setSetting('quickOpen', v)}>
            <IconBolt width={13} height={13} /> Quick open
          </Switch>
          <span className="cta__hint label">Drag to turn the case</span>
        </div>
      </div>

      {phase === 'reel' && drop && <Reel caseId={caseId} winner={drop} onDone={() => reelDone.current?.()} />}

      {phase === 'result' && drop && (
        <ResultPanel item={drop} source="case" onSell={() => void sell()} onInspect={inspect} onAgain={() => void again()} againCost={def.price} canAgain={credits >= def.price} onDone={() => void dismiss()} />
      )}
    </div>
  );
}
