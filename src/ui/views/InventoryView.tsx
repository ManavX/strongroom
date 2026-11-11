/** Inventory: browse, filter, sort, favourite and sell everything you have unboxed. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../../audio/audio';
import { itemValue } from '../../core/economy';
import type { Item } from '../../core/types';
import { CASE_LIST } from '../../data/cases';
import { RARITIES, RARITY_ORDER, type RarityId } from '../../data/rarities';
import { SKINS } from '../../data/skins';
import { WEAPON_KINDS, WEAPONS } from '../../data/weapons';
import { inventoryValue, useGame } from '../../state/store';
import { useUI } from '../../state/ui';
import { Btn, ItemCard, rarVar, Switch } from '../components';
import { fmtCR } from '../format';
import { IconSearch } from '../icons';

type Sort = 'new' | 'old' | 'value' | 'cheap' | 'rarity' | 'wear' | 'name';
const SORTS: { id: Sort; name: string }[] = [
  { id: 'new', name: 'Newest' },
  { id: 'old', name: 'Oldest' },
  { id: 'value', name: 'Value: high' },
  { id: 'cheap', name: 'Value: low' },
  { id: 'rarity', name: 'Rarity' },
  { id: 'wear', name: 'Cleanest' },
  { id: 'name', name: 'Name' },
];
const PAGE = 96;

export function InventoryView() {
  const items = useGame((s) => s.items);
  const toggleFav = useGame((s) => s.toggleFav);
  const selecting = useUI((s) => s.selecting);
  const selection = useUI((s) => s.selection);
  const setUI = useUI((s) => s.set);
  const toggleSelected = useUI((s) => s.toggleSelected);
  const clearSelection = useUI((s) => s.clearSelection);
  const openInspect = useUI((s) => s.openInspect);
  const setView = useUI((s) => s.setView);
  const toast = useUI((s) => s.toast);

  const [query, setQuery] = useState('');
  const [rar, setRar] = useState<RarityId[]>([]);
  const [kind, setKind] = useState('all');
  const [caseId, setCaseId] = useState('all');
  const [sort, setSort] = useState<Sort>('new');
  const [tallyOnly, setTallyOnly] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [confirm, setConfirm] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const [now] = useState(() => Date.now());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((it) => {
      const skin = SKINS[it.skinId];
      const weapon = WEAPONS[skin.weapon];
      if (rar.length && !rar.includes(skin.rarity)) return false;
      if (kind !== 'all' && weapon.kind !== kind) return false;
      if (caseId !== 'all' && it.caseId !== caseId) return false;
      if (tallyOnly && !it.tally) return false;
      if (favOnly && !it.fav) return false;
      if (q && !`${weapon.name} ${skin.name} ${RARITIES[skin.rarity].name}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const tier = (it: Item) => RARITIES[SKINS[it.skinId].rarity].tier;
    const cmp: Record<Sort, (a: Item, b: Item) => number> = {
      new: (a, b) => b.at - a.at,
      old: (a, b) => a.at - b.at,
      value: (a, b) => itemValue(b) - itemValue(a),
      cheap: (a, b) => itemValue(a) - itemValue(b),
      rarity: (a, b) => tier(b) - tier(a) || itemValue(b) - itemValue(a),
      wear: (a, b) => a.float - b.float,
      name: (a, b) => `${WEAPONS[SKINS[a.skinId].weapon].name}${SKINS[a.skinId].name}`.localeCompare(`${WEAPONS[SKINS[b.skinId].weapon].name}${SKINS[b.skinId].name}`),
    };
    return list.sort(cmp[sort]);
  }, [items, query, rar, kind, caseId, sort, tallyOnly, favOnly]);

  // Reset the window whenever the result set changes shape.
  useEffect(() => setLimit(PAGE), [query, rar, kind, caseId, sort, tallyOnly, favOnly]);

  // Grow the rendered window as the sentinel scrolls into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setLimit((n) => n + PAGE), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const selectedSet = useMemo(() => new Set(selection), [selection]);
  const selectedItems = useMemo(() => items.filter((i) => selectedSet.has(i.id) && !i.fav), [items, selectedSet]);
  const selectedValue = useMemo(() => selectedItems.reduce((s, i) => s + itemValue(i), 0), [selectedItems]);
  const total = useMemo(() => inventoryValue(items), [items]);

  const onCard = useCallback(
    (it: Item) => {
      if (useUI.getState().selecting) toggleSelected(it.id);
      else openInspect({ kind: 'item', id: it.id });
    },
    [openInspect, toggleSelected],
  );
  const onFav = useCallback((it: Item) => toggleFav(it.id), [toggleFav]);

  const sellSelected = () => {
    if (!selectedItems.length) return;
    if (!confirm) {
      setConfirm(true);
      return;
    }
    const got = useGame.getState().sellItems(selectedItems.map((i) => i.id));
    audio.coin(true);
    toast(`Sold ${selectedItems.length} for ${fmtCR(got)} CR`, 'good');
    setConfirm(false);
    clearSelection();
  };

  useEffect(() => setConfirm(false), [selection]);

  const shown = filtered.slice(0, limit);
  return (
    <div className="page inv">
      <header className="page__head">
        <div>
          <div className="page__kicker">Locker 09 // Holdings</div>
          <h1 className="page__title">Inventory</h1>
        </div>
        <div className="page__meta">
          <div>
            <div className="metric__v">{fmtCR(items.length)}</div>
            <div className="metric__k label">Items</div>
          </div>
          <div>
            <div className="metric__v">{fmtCR(total)}</div>
            <div className="metric__k label">Total value, CR</div>
          </div>
        </div>
      </header>

      <div className="toolbar">
        <label className="search">
          <IconSearch />
          <input className="input" placeholder="Search weapon or finish" value={query} onChange={(e) => setQuery(e.target.value)} spellCheck={false} />
        </label>
        <div className="toolbar__chips">
          {[...RARITY_ORDER].reverse().map((r) => (
            <button
              type="button"
              key={r}
              className="chip"
              style={rarVar(r)}
              data-on={rar.includes(r)}
              onClick={() => {
                audio.select();
                setRar((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
              }}
            >
              <i className="chip__dot" />
              {RARITIES[r].name}
            </button>
          ))}
        </div>
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Weapon type">
          <option value="all">All types</option>
          {WEAPON_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <select className="select" value={caseId} onChange={(e) => setCaseId(e.target.value)} aria-label="Case">
          <option value="all">All cases</option>
          {CASE_LIST.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Switch on={tallyOnly} onChange={setTallyOnly}>
          Tally
        </Switch>
        <Switch on={favOnly} onChange={setFavOnly}>
          Favourites
        </Switch>
        <div className="toolbar__end">
          <Btn size="sm" variant={selecting ? 'primary' : undefined} onClick={() => (selecting ? clearSelection() : setUI({ selecting: true }))}>
            {selecting ? 'Done' : 'Select'}
          </Btn>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          <div className="empty__title">Nothing in the locker yet</div>
          <div>Open a case and whatever comes out is stored here.</div>
          <Btn variant="primary" onClick={() => setView('vault')}>
            Go to the vault
          </Btn>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="empty__title">No matches</div>
          <div>No items fit those filters.</div>
          <Btn
            onClick={() => {
              setQuery('');
              setRar([]);
              setKind('all');
              setCaseId('all');
              setTallyOnly(false);
              setFavOnly(false);
            }}
          >
            Clear filters
          </Btn>
        </div>
      ) : (
        <>
          <div className="inv__count label">
            {filtered.length === items.length ? `${items.length} items` : `${filtered.length} of ${items.length} items`}
          </div>
          <div className="grid">
            {shown.map((it) => (
              <ItemCard key={it.id} item={it} onClick={onCard} onFav={onFav} selecting={selecting} selected={selectedSet.has(it.id)} dim={selecting && it.fav} fresh={now - it.at < 120000} />
            ))}
          </div>
          {limit < filtered.length && <div ref={sentinel} className="inv__more label">Loading more</div>}
        </>
      )}

      {selecting && (
        <div className="bulkbar panel">
          <span className="bulkbar__info">
            <b className="mono">{selectedItems.length}</b> selected
            <span className="mono bulkbar__value">{fmtCR(selectedValue)} CR</span>
          </span>
          <Btn
            size="sm"
            variant="ghost"
            onClick={() =>
              setUI({
                selection: filtered.filter((i) => !i.fav).map((i) => i.id),
              })
            }
          >
            Select all shown
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => setUI({ selection: [] })} disabled={!selection.length}>
            Clear
          </Btn>
          <Btn size="sm" variant={confirm ? 'primary' : 'danger'} disabled={!selectedItems.length} onClick={sellSelected} quiet>
            {confirm ? 'Confirm sale' : 'Sell selected'} <span className="mono">+{fmtCR(selectedValue)}</span>
          </Btn>
        </div>
      )}
    </div>
  );
}
