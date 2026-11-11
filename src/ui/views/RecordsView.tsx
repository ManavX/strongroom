/** Records: lifetime statistics, luck against the published odds, and the opening log. */
import { CASES } from '../../data/cases';
import { RARITIES, RARITY_ORDER, wearTier } from '../../data/rarities';
import { SKINS } from '../../data/skins';
import { WEAPONS } from '../../data/weapons';
import { useGame } from '../../state/store';
import { useUI } from '../../state/ui';
import { rarVar, Thumb } from '../components';
import { fmtAgo, fmtCR, fmtPct } from '../format';

export function RecordsView() {
  const stats = useGame((s) => s.stats);
  const history = useGame((s) => s.history);
  const openInspect = useUI((s) => s.openInspect);
  const drops = RARITY_ORDER.reduce((n, r) => n + (stats.byRarity[r] ?? 0), 0);
  const ret = stats.spent ? stats.unboxedValue / stats.spent : 0;
  const best = stats.bestDrop;
  const relicEvery = Math.round(1 / RARITIES.relic.odds);

  const tiles: { k: string; v: string; sub?: string }[] = [
    { k: 'Cases opened', v: fmtCR(stats.opened) },
    { k: 'Credits spent', v: fmtCR(stats.spent) },
    { k: 'Value unboxed', v: fmtCR(stats.unboxedValue), sub: stats.spent ? `${fmtPct(ret, 0)} of spend` : undefined },
    { k: 'Items sold', v: fmtCR(stats.sold), sub: stats.sold ? `${fmtCR(stats.soldValue)} CR` : undefined },
    { k: 'Contracts signed', v: fmtCR(stats.contracts) },
    { k: 'Resupplies taken', v: fmtCR(stats.resupplies) },
    { k: 'Since last relic', v: fmtCR(stats.sinceRelic), sub: `1 in ${relicEvery} on average` },
    { k: 'Longest dry spell', v: fmtCR(stats.longestDrySpell) },
  ];

  return (
    <div className="page records">
      <header className="page__head">
        <div>
          <div className="page__kicker">Ledger // Lifetime</div>
          <h1 className="page__title">Records</h1>
        </div>
      </header>

      <div className="stats">
        {tiles.map((t) => (
          <div className="stat panel" key={t.k}>
            <div className="label">{t.k}</div>
            <div className="stat__v mono">{t.v}</div>
            {t.sub && <div className="stat__sub mono">{t.sub}</div>}
          </div>
        ))}
      </div>

      <div className="records__split">
        <section className="panel">
          <div className="panel__head">
            <span className="label">Your luck against the odds</span>
            <span className="label">{fmtCR(drops)} drops</span>
          </div>
          <div className="panel__body dist">
            {[...RARITY_ORDER].reverse().map((r) => {
              const rar = RARITIES[r];
              const n = stats.byRarity[r] ?? 0;
              const actual = drops ? n / drops : 0;
              // widths on a square-root scale so the rare tiers stay visible
              const w = (p: number) => `${Math.min(100, Math.sqrt(p) * 100)}%`;
              return (
                <div className="dist__row" key={r} style={rarVar(r)}>
                  <span className="rar">{rar.name}</span>
                  <div className="dist__bars">
                    <i className="dist__actual" style={{ width: w(actual) }} />
                    <i className="dist__expected" style={{ left: w(rar.odds) }} title={`Expected ${fmtPct(rar.odds)}`} />
                  </div>
                  <span className="mono dist__n">{fmtCR(n)}</span>
                  <span className="mono dist__p">{drops ? fmtPct(actual, actual < 0.01 && actual > 0 ? 2 : 1) : 'none'}</span>
                  <span className="mono dist__e">exp {fmtPct(rar.odds, rar.odds < 0.01 ? 2 : 1)}</span>
                </div>
              );
            })}
            <p className="dist__note">Bars show your share of drops per rarity; the tick marks the published odds. Contract results are included in the counts.</p>
          </div>
        </section>

        <section className="panel best">
          <div className="panel__head">
            <span className="label">Best drop</span>
          </div>
          {best ? (
            <button type="button" className="best__body" style={rarVar(SKINS[best.skinId].rarity)} onClick={() => openInspect({ kind: 'preview', skinId: best.skinId, float: best.float, seed: best.seed, tally: best.tally })}>
              <span className="best__thumb">
                <Thumb spec={{ skinId: best.skinId, float: best.float, seed: best.seed, tally: best.tally }} eager className="best__img" />
              </span>
              <span className="rar">{RARITIES[SKINS[best.skinId].rarity].name}</span>
              <span className="best__weapon">{WEAPONS[SKINS[best.skinId].weapon].name}</span>
              <span className="best__name">{SKINS[best.skinId].name}</span>
              <span className="mono best__value">{fmtCR(best.value)} CR</span>
              <span className="label">
                {wearTier(best.float).name} · {fmtAgo(best.at)}
              </span>
            </button>
          ) : (
            <div className="panel__body best__none">Nothing on record yet.</div>
          )}
        </section>
      </div>

      <section className="panel hist">
        <div className="panel__head">
          <span className="label">Opening log</span>
          <span className="label">Latest {Math.min(history.length, 120)}</span>
        </div>
        {history.length === 0 ? (
          <div className="panel__body best__none">The log fills in as you open cases.</div>
        ) : (
          <div className="hist__scroll">
            <table className="hist__table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Source</th>
                  <th>Item</th>
                  <th>Wear</th>
                  <th>Float</th>
                  <th>Pattern</th>
                  <th>Roll</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 120).map((h) => {
                  const skin = SKINS[h.skinId];
                  return (
                    <tr key={h.id} style={rarVar(skin.rarity)}>
                      <td className="hist__dim">{fmtAgo(h.at)}</td>
                      <td className="hist__dim">{h.kind === 'case' ? CASES[h.caseId]?.name.replace(' Case', '') : 'Contract'}</td>
                      <td>
                        <i className="hist__dot" />
                        {WEAPONS[skin.weapon].name} <b>{skin.name}</b>
                        {h.tally && <span className="badge badge--tally">Tally</span>}
                      </td>
                      <td>{wearTier(h.float).short}</td>
                      <td className="mono">{h.float.toFixed(5)}</td>
                      <td className="mono">#{String(h.seed).padStart(3, '0')}</td>
                      <td className="mono hist__dim">{h.roll !== undefined ? h.roll.toFixed(5) : ''}</td>
                      <td className="mono">{fmtCR(h.value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
