/** Collection book: every finish in every case, and which ones you have found. */
import { CASE_LIST, caseSkins } from '../../data/cases';
import { RARITIES } from '../../data/rarities';
import { SKIN_LIST } from '../../data/skins';
import { useGame } from '../../state/store';
import { useUI } from '../../state/ui';
import { SkinTile } from '../components';
import { catalogSpec, fmtPct } from '../format';

export function CollectionView() {
  const discovered = useGame((s) => s.discovered);
  const openInspect = useUI((s) => s.openInspect);
  const found = SKIN_LIST.filter((s) => discovered[s.id]).length;

  return (
    <div className="page coll">
      <header className="page__head">
        <div>
          <div className="page__kicker">Register // All known finishes</div>
          <h1 className="page__title">Collection</h1>
        </div>
        <div className="page__meta">
          <div>
            <div className="metric__v">
              {found} / {SKIN_LIST.length}
            </div>
            <div className="metric__k label">Discovered</div>
          </div>
          <div>
            <div className="metric__v">{fmtPct(found / SKIN_LIST.length, 0)}</div>
            <div className="metric__k label">Complete</div>
          </div>
        </div>
      </header>

      {CASE_LIST.map((c) => {
        const skins = caseSkins(c.id);
        const n = skins.filter((s) => discovered[s.id]).length;
        return (
          <section className="coll__case" key={c.id} style={{ ['--accent' as string]: c.accent }}>
            <header className="coll__head">
              <h2>{c.name}</h2>
              <span className="label">{c.tagline}</span>
              <span className="coll__progress">
                <i style={{ width: `${(n / skins.length) * 100}%` }} />
              </span>
              <span className="mono coll__n">
                {n} / {skins.length}
              </span>
            </header>
            <div className="grid">
              {skins.map((s) => {
                const d = discovered[s.id];
                return (
                  <SkinTile
                    key={s.id}
                    skin={s}
                    spec={catalogSpec(s)}
                    locked={!d}
                    onClick={() => openInspect({ kind: 'preview', ...catalogSpec(s) })}
                    footer={
                      <>
                        <span className="card__wear" style={{ color: RARITIES[s.rarity].color }}>
                          {RARITIES[s.rarity].name}
                        </span>
                        <span className="card__price">{d ? `×${d.n}` : 'Unseen'}</span>
                      </>
                    }
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
