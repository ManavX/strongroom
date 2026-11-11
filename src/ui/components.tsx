/** Shared presentational components. */
import { memo, useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { audio } from '../audio/audio';
import { valueOf } from '../core/economy';
import type { Item } from '../core/types';
import { RARITIES, wearTier, WEAR_TIERS, type RarityId } from '../data/rarities';
import { SKINS, type SkinDef } from '../data/skins';
import { WEAPONS } from '../data/weapons';
import type { ItemSpec } from '../engine/itemObject';
import { fmtCR, fmtFloat, itemSpec } from './format';
import { useNearViewport, useThumb } from './hooks';
import { IconCheck, IconStar, IconStarFill } from './icons';

export const rarVar = (r: RarityId): CSSProperties => ({ '--rar': RARITIES[r].color }) as CSSProperties;

export function RarityTag({ rarity }: { rarity: RarityId }) {
  return (
    <span className="rar" style={rarVar(rarity)}>
      {RARITIES[rarity].name}
    </span>
  );
}

/** A button that plays interface sounds. */
export function Btn({
  children,
  variant,
  size,
  block,
  className = '',
  onClick,
  quiet,
  ...rest
}: {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'lg';
  block?: boolean;
  quiet?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = ['btn', variant && `btn--${variant}`, size && `btn--${size}`, block && 'btn--block', className].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={cls}
      onPointerEnter={() => !rest.disabled && audio.hover()}
      onClick={(e) => {
        audio.unlock();
        if (!quiet) audio.click();
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Switch({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="switch"
      data-on={on}
      role="switch"
      aria-checked={on}
      onClick={() => {
        audio.select();
        onChange(!on);
      }}
    >
      <span className="switch__track" />
      {children}
    </button>
  );
}

/** Rendered 3D thumbnail of an item, requested when it nears the viewport. */
export function Thumb({ spec, eager = false, className = 'card__img' }: { spec: ItemSpec; eager?: boolean; className?: string }) {
  const [ref, near] = useNearViewport<HTMLSpanElement>();
  const [url, onError] = useThumb(spec, eager || near);
  return (
    <span ref={ref} style={{ position: 'absolute', inset: 0 }}>
      {url && <img className={className} src={url} alt="" draggable={false} data-ready="true" onError={onError} />}
    </span>
  );
}

/** Five-tier wear gauge with the item's float marked. */
export function WearGauge({ float, range }: { float: number; range?: readonly [number, number] }) {
  const tier = wearTier(float);
  return (
    <div className="wear">
      <div className="wear__row">
        <span className="wear__name">{tier.name}</span>
        <span className="wear__float">{fmtFloat(float)}</span>
      </div>
      <div className="wear__bar" title={WEAR_TIERS.map((t) => t.name).join(' / ')}>
        <i className="wear__needle" style={{ left: `${float * 100}%` }} />
        {range && <i className="wear__range" style={{ left: `${range[0] * 100}%`, width: `${(range[1] - range[0]) * 100}%` }} />}
      </div>
    </div>
  );
}

export interface CardProps {
  item: Item;
  onClick?: (item: Item) => void;
  onFav?: (item: Item) => void;
  selecting?: boolean;
  selected?: boolean;
  dim?: boolean;
  fresh?: boolean;
}

/** Inventory card. Memoised: an inventory can hold thousands. */
export const ItemCard = memo(function ItemCard({ item, onClick, onFav, selecting, selected, dim, fresh }: CardProps) {
  const skin = SKINS[item.skinId];
  const weapon = WEAPONS[skin.weapon];
  const tier = wearTier(item.float);
  return (
    <button
      type="button"
      className="card"
      style={rarVar(skin.rarity)}
      data-selected={selected || undefined}
      data-dim={dim || undefined}
      onPointerEnter={() => audio.hover()}
      onClick={() => {
        audio.unlock();
        audio.select();
        onClick?.(item);
      }}
    >
      <div className="card__thumb">
        <Thumb spec={itemSpec(item)} />
        <div className="card__badges">
          {fresh && <span className="badge badge--new">New</span>}
          {item.tally && <span className="badge badge--tally">Tally</span>}
        </div>
        {selecting ? (
          <span className="card__check">{selected && <IconCheck width={13} height={13} />}</span>
        ) : (
          onFav && (
            <span
              className="card__fav"
              data-on={item.fav}
              role="button"
              tabIndex={-1}
              aria-label={item.fav ? 'Remove favourite' : 'Favourite'}
              onClick={(e) => {
                e.stopPropagation();
                audio.select();
                onFav(item);
              }}
            >
              {item.fav ? <IconStarFill /> : <IconStar />}
            </span>
          )
        )}
      </div>
      <div className="card__meta">
        <span className="card__weapon">{weapon.name}</span>
        <span className="card__name">{skin.name}</span>
        <span className="card__foot">
          <span className="card__wear">
            <b>{tier.short}</b>
            {item.float.toFixed(4)}
          </span>
          <span className="card__price">
            {fmtCR(valueOf(item.skinId, item.float, item.tally))}
            <small>CR</small>
          </span>
        </span>
      </div>
    </button>
  );
});

/** Catalogue tile for a skin (collection book, case contents, contract outcomes). */
export function SkinTile({ skin, spec, onClick, locked, footer }: { skin: SkinDef; spec: ItemSpec; onClick?: () => void; locked?: boolean; footer?: ReactNode }) {
  const weapon = WEAPONS[skin.weapon];
  return (
    <button
      type="button"
      className="card tile"
      style={rarVar(skin.rarity)}
      data-locked={locked || undefined}
      onPointerEnter={() => audio.hover()}
      onClick={() => {
        audio.unlock();
        audio.select();
        onClick?.();
      }}
    >
      <div className="card__thumb">
        <Thumb spec={spec} />
      </div>
      <div className="card__meta">
        <span className="card__weapon">{weapon.name}</span>
        <span className="card__name">{skin.name}</span>
        {footer && <span className="card__foot">{footer}</span>}
      </div>
    </button>
  );
}

/** Number that counts toward its target instead of snapping. */
export function CountUp({ value, format = fmtCR }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const t0 = performance.now();
    const dur = Math.min(900, 250 + Math.abs(value - start) * 0.4);
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      const v = start + (value - start) * e;
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}
