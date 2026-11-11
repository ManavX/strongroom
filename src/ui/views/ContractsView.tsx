/** Trade-up contracts: ten items of one rarity in, one item of the next rarity out. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { audio } from '../../audio/audio';
import { checkContract, CONTRACT_SIZE, contractOutcomes, itemValue } from '../../core/economy';
import type { Item } from '../../core/types';
import { RARITIES, wearTier, type RarityId } from '../../data/rarities';
import { SKINS } from '../../data/skins';
import { WEAPONS } from '../../data/weapons';
import { getEngine } from '../../engine/Engine';
import { useGame } from '../../state/store';
import { useUI } from '../../state/ui';
import { Btn, ItemCard, rarVar, Thumb } from '../components';
import { catalogSpec, fmtCR, fmtPct, itemSpec } from '../format';
import { IconClose, IconPlus } from '../icons';
import { ResultPanel } from './VaultView';

const TRADEABLE: RarityId[] = ['service', 'specialist', 'elite'];

export function ContractsView() {
  const items = useGame((s) => s.items);
  const contract = useUI((s) => s.contract);
  const phase = useUI((s) => s.phase);
  const drop = useUI((s) => s.drop);
  const setUI = useUI((s) => s.set);
  const toggleContract = useUI((s) => s.toggleContract);
  const openInspect = useUI((s) => s.openInspect);
  const toast = useUI((s) => s.toast);
  const [tab, setTab] = useState<RarityId>('service');
  const [tally, setTally] = useState(false);

  // Drop ids that no longer exist (sold elsewhere).
  const chosen = useMemo(() => contract.map((id) => items.find((i) => i.id === id)).filter((i): i is Item => !!i), [contract, items]);
  useEffect(() => {
    if (chosen.length !== contract.length) setUI({ contract: chosen.map((i) => i.id) });
  }, [chosen, contract.length, setUI]);

  const check = useMemo(() => checkContract(chosen), [chosen]);
  const outcomes = useMemo(() => contractOutcomes(chosen), [chosen]);
  const lockedRarity = chosen.length ? SKINS[chosen[0].skinId].rarity : null;
  const lockedTally = chosen.length ? chosen[0].tally : null;
  const activeRarity = lockedRarity ?? tab;
  const activeTally = lockedTally ?? tally;

  const pool = useMemo(
    () => items.filter((i) => SKINS[i.skinId].rarity === activeRarity && i.tally === activeTally && !i.fav).sort((a, b) => itemValue(a) - itemValue(b)),
    [items, activeRarity, activeTally],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) if (!i.fav) c[`${SKINS[i.skinId].rarity}:${i.tally ? 1 : 0}`] = (c[`${SKINS[i.skinId].rarity}:${i.tally ? 1 : 0}`] ?? 0) + 1;
    return c;
  }, [items]);

  const chosenSet = useMemo(() => new Set(contract), [contract]);
  const avgFloat = chosen.length ? chosen.reduce((s, i) => s + i.float, 0) / chosen.length : 0;
  const inputValue = chosen.reduce((s, i) => s + itemValue(i), 0);

  const onPick = useCallback((it: Item) => toggleContract(it.id), [toggleContract]);

  const autofill = () => {
    const need = CONTRACT_SIZE - chosen.length;
    if (need <= 0) return;
    const add = pool.filter((i) => !chosenSet.has(i.id)).slice(0, need);
    if (!add.length) return;
    audio.select();
    setUI({ contract: [...contract, ...add.map((i) => i.id)] });
  };

  const execute = async () => {
    const engine = getEngine();
    if (!check.ok || !engine || phase !== 'idle') return;
    audio.unlock();
    const result = useGame.getState().executeContract(contract);
    if (!result) {
      audio.error();
      toast('That contract is not valid', 'bad');
      return;
    }
    setUI({ contract: [], phase: 'reveal', drop: result, dropSource: 'contract' });
    await engine.stage.presentLoose(itemSpec(result));
    setUI({ phase: 'result' });
  };

  const finish = async (sell: boolean) => {
    const engine = getEngine();
    const d = useUI.getState().drop;
    if (!engine || !d) return;
    if (sell) {
      const got = useGame.getState().sellItems([d.id]);
      audio.coin();
      toast(`Sold for ${fmtCR(got)} CR`, 'good');
    }
    setUI({ phase: 'idle', drop: null });
    await engine.stage.exitInspect('backdrop');
  };

  if (phase !== 'idle' && drop) {
    return phase === 'result' ? (
      <div className="vault" data-phase="result">
        <ResultPanel
          item={drop}
          source="contract"
          onSell={() => void finish(true)}
          onDone={() => void finish(false)}
          onInspect={() => {
            setUI({ phase: 'idle', drop: null });
            openInspect({ kind: 'item', id: drop.id });
          }}
        />
      </div>
    ) : null;
  }

  const target = check.target ?? (activeRarity === 'service' ? 'specialist' : activeRarity === 'specialist' ? 'elite' : 'master');
  return (
    <div className="page contracts">
      <header className="page__head">
        <div>
          <div className="page__kicker">Form TU-10 // Trade-up</div>
          <h1 className="page__title">Contracts</h1>
        </div>
        <p className="contracts__lede">Surrender ten items of one rarity for one item of the next rarity up. The result comes from the cases your items came from, and its wear follows the average wear you put in.</p>
      </header>

      <div className="contracts__body">
        <section className="panel contracts__form">
          <div className="panel__head">
            <span className="label">
              Inputs {chosen.length} / {CONTRACT_SIZE}
            </span>
            <span className="contracts__flow">
              <span className="rar" style={rarVar(activeRarity)}>
                {RARITIES[activeRarity].name}
              </span>
              <i>to</i>
              <span className="rar" style={rarVar(target)}>
                {RARITIES[target].name}
              </span>
            </span>
          </div>
          <div className="panel__body">
            <div className="slots">
              {Array.from({ length: CONTRACT_SIZE }, (_, i) => {
                const it = chosen[i];
                if (!it)
                  return (
                    <div className="slot" key={i}>
                      <IconPlus />
                    </div>
                  );
                const skin = SKINS[it.skinId];
                return (
                  <button type="button" className="slot slot--full" key={it.id} style={rarVar(skin.rarity)} title={`${WEAPONS[skin.weapon].name} ${skin.name}`} onClick={() => toggleContract(it.id)}>
                    <Thumb spec={itemSpec(it)} eager className="slot__img" />
                    <span className="slot__x">
                      <IconClose />
                    </span>
                    <span className="slot__wear mono">{wearTier(it.float).short}</span>
                  </button>
                );
              })}
            </div>

            <dl className="kv contracts__stats">
              <dt>Average wear</dt>
              <dd>{chosen.length ? `${avgFloat.toFixed(4)}  ${wearTier(avgFloat).short}` : 'none yet'}</dd>
              <dt>Input value</dt>
              <dd>{fmtCR(inputValue)} CR</dd>
              <dt>Variant</dt>
              <dd>{activeTally ? 'Tally' : 'Standard'}</dd>
            </dl>

            {outcomes.length > 0 && (
              <div className="outcomes">
                <div className="label">Possible results</div>
                {outcomes.slice(0, 8).map((o) => (
                  <button type="button" className="outcome" key={o.skin.id} style={rarVar(o.skin.rarity)} onClick={() => openInspect({ kind: 'preview', ...catalogSpec(o.skin) })}>
                    <span className="outcome__thumb">
                      <Thumb spec={catalogSpec(o.skin)} className="contents__img" />
                    </span>
                    <span className="outcome__text">
                      <b>{o.skin.name}</b>
                      <i>{WEAPONS[o.skin.weapon].name}</i>
                    </span>
                    <span className="mono">{fmtPct(o.chance, 1)}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="contracts__actions">
              <span className="contracts__status label" data-ok={check.ok}>
                {check.ok ? 'Ready to sign' : check.reason}
              </span>
              <Btn size="sm" variant="ghost" onClick={autofill} disabled={chosen.length >= CONTRACT_SIZE || pool.length === chosen.length}>
                Fill cheapest
              </Btn>
              <Btn size="sm" variant="ghost" onClick={() => setUI({ contract: [] })} disabled={!chosen.length}>
                Clear
              </Btn>
              <Btn variant="primary" disabled={!check.ok} onClick={() => void execute()} quiet>
                Sign contract
              </Btn>
            </div>
          </div>
        </section>

        <section className="contracts__pool">
          <div className="toolbar">
            <div className="seg">
              {TRADEABLE.map((r) => (
                <button
                  type="button"
                  key={r}
                  data-on={activeRarity === r}
                  disabled={!!lockedRarity && lockedRarity !== r}
                  onClick={() => {
                    audio.select();
                    setTab(r);
                  }}
                >
                  {RARITIES[r].name} <span className="mono">{counts[`${r}:${activeTally ? 1 : 0}`] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="seg">
              {[false, true].map((t) => (
                <button
                  type="button"
                  key={String(t)}
                  data-on={activeTally === t}
                  disabled={lockedTally !== null && lockedTally !== t}
                  onClick={() => {
                    audio.select();
                    setTally(t);
                  }}
                >
                  {t ? 'Tally' : 'Standard'}
                </button>
              ))}
            </div>
            <span className="label toolbar__end">Favourites are protected and never listed</span>
          </div>
          {pool.length === 0 ? (
            <div className="empty">
              <div className="empty__title">Nothing eligible</div>
              <div>
                You hold no unprotected {activeTally ? 'Tally ' : ''}
                {RARITIES[activeRarity].name} items.
              </div>
            </div>
          ) : (
            <div className="grid grid--dense">
              {pool.slice(0, 240).map((it) => (
                <ItemCard key={it.id} item={it} onClick={onPick} selecting selected={chosenSet.has(it.id)} dim={!chosenSet.has(it.id) && chosen.length >= CONTRACT_SIZE} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
