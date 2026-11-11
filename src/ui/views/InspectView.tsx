/** Full-screen 3D inspection of an owned item or a catalogue preview, plus photo mode. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { audio } from '../../audio/audio';
import { valueOf } from '../../core/economy';
import { CASES } from '../../data/cases';
import { RARITIES, SEED_COUNT, wearTier } from '../../data/rarities';
import { SKINS } from '../../data/skins';
import { WEAPONS } from '../../data/weapons';
import type { EnvPreset } from '../../engine/env';
import { fadeAmount } from '../../engine/finishes/library';
import { getEngine } from '../../engine/Engine';
import type { ItemSpec } from '../../engine/itemObject';
import { useGame } from '../../state/store';
import { useUI } from '../../state/ui';
import { Btn, rarVar, RarityTag, Switch, WearGauge } from '../components';
import { fmtCR, fmtDate, fmtFloat, fmtPct } from '../format';
import { useKey } from '../hooks';
import { IconBack, IconCamera, IconCrosshair, IconDice, IconDownload, IconStar, IconStarFill } from '../icons';

const ENVS: { id: EnvPreset; name: string }[] = [
  { id: 'vault', name: 'Vault' },
  { id: 'studio', name: 'Studio' },
  { id: 'daylight', name: 'Daylight' },
  { id: 'ember', name: 'Ember' },
  { id: 'ice', name: 'Ice' },
];

async function composePoster(shot: Blob, spec: ItemSpec, withPlate: boolean): Promise<Blob> {
  if (!withPlate) return shot;
  const img = await createImageBitmap(shot);
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const skin = SKINS[spec.skinId];
  const weapon = WEAPONS[skin.weapon];
  const rar = RARITIES[skin.rarity];
  const u = cv.height / 1080;
  const x = 72 * u;
  let y = cv.height - 150 * u;
  const g = ctx.createLinearGradient(0, cv.height - 420 * u, 0, cv.height);
  g.addColorStop(0, 'rgba(5,6,8,0)');
  g.addColorStop(1, 'rgba(5,6,8,0.82)');
  ctx.fillStyle = g;
  ctx.fillRect(0, cv.height - 420 * u, cv.width, 420 * u);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = rar.color;
  ctx.fillRect(x, y - 96 * u, 4 * u, 132 * u);
  ctx.font = `700 ${22 * u}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.letterSpacing = `${4 * u}px`;
  ctx.fillText(`${rar.name.toUpperCase()}${spec.tally ? '  ·  TALLY' : ''}`, x + 22 * u, y - 74 * u);
  ctx.fillStyle = 'rgba(236,232,223,0.72)';
  ctx.font = `600 ${28 * u}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.fillText(weapon.name.toUpperCase(), x + 22 * u, y - 36 * u);
  ctx.fillStyle = '#ece8df';
  ctx.font = `700 ${72 * u}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.letterSpacing = `${3 * u}px`;
  y += 30 * u;
  ctx.fillText(skin.name.toUpperCase(), x + 20 * u, y);
  ctx.letterSpacing = '0px';
  ctx.font = `500 ${19 * u}px "IBM Plex Mono", ui-monospace, Consolas, monospace`;
  ctx.fillStyle = 'rgba(236,232,223,0.6)';
  ctx.fillText(`${wearTier(spec.float).name.toUpperCase()}  ${fmtFloat(spec.float)}   PATTERN #${String(spec.seed).padStart(3, '0')}`, x + 22 * u, y + 40 * u);
  ctx.textAlign = 'right';
  ctx.font = `700 ${24 * u}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.letterSpacing = `${8 * u}px`;
  ctx.fillStyle = 'rgba(236,232,223,0.55)';
  ctx.fillText('STRONGROOM', cv.width - 72 * u, cv.height - 80 * u);
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/png'));
}

export function InspectView() {
  const target = useUI((s) => s.inspect)!;
  const photo = useUI((s) => s.photo);
  const setUI = useUI((s) => s.set);
  const closeInspect = useUI((s) => s.closeInspect);
  const toast = useUI((s) => s.toast);
  const item = useGame((s) => (target.kind === 'item' ? s.items.find((i) => i.id === target.id) : undefined));
  const owned = useGame((s) => s.discovered[target.kind === 'preview' ? target.skinId : (item?.skinId ?? '')]);
  const toggleFav = useGame((s) => s.toggleFav);

  // Preview controls are local: they only drive the render.
  const [pv, setPv] = useState(() => (target.kind === 'preview' ? { float: target.float, seed: target.seed, tally: target.tally } : null));
  const [env, setEnv] = useState<EnvPreset>('vault');
  const [backdrop, setBackdrop] = useState(true);
  const [plate, setPlate] = useState(true);
  const [confirmSell, setConfirmSell] = useState(false);
  const [saving, setSaving] = useState(false);

  const spec: ItemSpec | null = useMemo(() => {
    if (target.kind === 'preview') return { skinId: target.skinId, float: pv?.float ?? target.float, seed: pv?.seed ?? target.seed, tally: pv?.tally ?? target.tally, count: 0 };
    return item ? { skinId: item.skinId, float: item.float, seed: item.seed, tally: item.tally, count: item.count } : null;
  }, [target, pv, item]);

  // The owned item was sold or traded away while open.
  useEffect(() => {
    if (target.kind === 'item' && !item) closeInspect();
  }, [target, item, closeInspect]);

  // Live-retune the preview render.
  useEffect(() => {
    if (target.kind === 'preview' && spec) getEngine()?.stage.retuneItem(spec);
  }, [target.kind, spec]);

  // Keep the subject clear of the side panel.
  useEffect(() => {
    const stage = getEngine()?.stage;
    if (!stage) return;
    const apply = () => {
      const wide = window.innerWidth > 980;
      if (photo) stage.setScreenOffset(0, 0);
      else if (wide) stage.setScreenOffset(-176, 36);
      else stage.setScreenOffset(0, -window.innerHeight * 0.16);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      stage.setScreenOffset(0, 0);
    };
  }, [photo]);

  // Photo-mode lighting applies only while photo mode is on.
  useEffect(() => {
    const stage = getEngine()?.stage;
    if (!stage) return;
    stage.setEnv(photo ? env : 'vault');
    stage.setBackdropVisible(photo ? backdrop : true);
    return () => {
      stage.setEnv('vault');
      stage.setBackdropVisible(true);
    };
  }, [photo, env, backdrop]);

  const fire = useCallback(() => {
    const stage = getEngine()?.stage;
    if (!stage) return;
    audio.unlock();
    const r = stage.fire();
    if (r && item?.tally) {
      useGame.getState().addCount(item.id);
      stage.setItemCount(item.count + 1);
    }
  }, [item]);

  const save = useCallback(async () => {
    const engine = getEngine();
    if (!engine || !spec || saving) return;
    setSaving(true);
    try {
      const shot = await engine.capture(2);
      const blob = await composePoster(shot, spec, plate);
      const skin = SKINS[spec.skinId];
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `strongroom-${skin.id}-${String(spec.seed).padStart(3, '0')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      audio.coin();
      toast('Photo saved', 'good');
    } catch {
      toast('Could not save the photo', 'bad');
    } finally {
      setSaving(false);
    }
  }, [spec, plate, saving, toast]);

  useKey(
    (e) => {
      if (e.code === 'Escape') {
        if (photo) setUI({ photo: false });
        else closeInspect();
      } else if (e.code === 'KeyF') fire();
      else if (e.code === 'KeyP') setUI({ photo: !photo });
    },
    [photo, fire, closeInspect, setUI],
  );

  if (!spec) return null;
  const skin = SKINS[spec.skinId];
  const weapon = WEAPONS[skin.weapon];
  const value = valueOf(spec.skinId, spec.float, spec.tally);
  const isKnife = weapon.kind === 'Knife';

  if (photo) {
    return (
      <div className="inspect inspect--photo">
        <div className="photobar panel">
          <div className="photobar__group">
            <span className="label">Light</span>
            <div className="seg">
              {ENVS.map((e) => (
                <button
                  type="button"
                  key={e.id}
                  data-on={env === e.id}
                  onClick={() => {
                    audio.select();
                    setEnv(e.id);
                  }}
                >
                  {e.name}
                </button>
              ))}
            </div>
          </div>
          <Switch on={backdrop} onChange={setBackdrop}>
            Vault backdrop
          </Switch>
          <Switch on={plate} onChange={setPlate}>
            Name plate
          </Switch>
          <div className="photobar__actions">
            <Btn variant="primary" onClick={() => void save()} disabled={saving}>
              <IconDownload /> {saving ? 'Saving' : 'Save PNG'}
            </Btn>
            <Btn variant="ghost" onClick={() => setUI({ photo: false })}>
              Exit
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inspect" style={rarVar(skin.rarity)}>
      <div className="inspect__top">
        <Btn variant="ghost" onClick={closeInspect}>
          <IconBack /> Back
        </Btn>
      </div>

      <aside className="inspect__panel panel">
        <div className="inspect__rarbar" />
        <div className="panel__body">
          <div className="inspect__tags">
            <RarityTag rarity={skin.rarity} />
            {spec.tally && <span className="badge badge--tally">Tally</span>}
            {target.kind === 'preview' && <span className="badge">Preview</span>}
          </div>
          <div className="inspect__weapon">
            {weapon.name} <span>/ {weapon.kind}</span>
          </div>
          <h2 className="inspect__name">{skin.name}</h2>
          <p className="inspect__desc">{skin.desc}</p>

          <div className="inspect__block">
            <WearGauge float={spec.float} range={skin.float} />
            {target.kind === 'preview' && pv && (
              <input
                type="range"
                className="inspect__slider"
                min={skin.float[0]}
                max={skin.float[1]}
                step={0.001}
                value={pv.float}
                style={{ ['--fill' as string]: `${((pv.float - skin.float[0]) / Math.max(0.001, skin.float[1] - skin.float[0])) * 100}%` }}
                onChange={(e) => setPv({ ...pv, float: parseFloat(e.target.value) })}
                aria-label="Preview wear"
              />
            )}
          </div>

          <dl className="kv inspect__block">
            <dt>Pattern</dt>
            <dd>#{String(spec.seed).padStart(3, '0')}</dd>
            {skin.fade && (
              <>
                <dt>Fade</dt>
                <dd>{fmtPct(fadeAmount(spec.seed, skin.id), 0)}</dd>
              </>
            )}
            {spec.tally && (
              <>
                <dt>{isKnife ? 'Flourishes' : 'Rounds fired'}</dt>
                <dd>{item ? item.count : 0}</dd>
              </>
            )}
            <dt>Value</dt>
            <dd>{fmtCR(value)} CR</dd>
            {item ? (
              <>
                <dt>Origin</dt>
                <dd>{CASES[item.caseId]?.name ?? 'Unknown'}</dd>
                <dt>{item.source === 'case' ? 'Unboxed' : 'Contracted'}</dt>
                <dd>{fmtDate(item.at)}</dd>
                {item.roll !== undefined && (
                  <>
                    <dt>Roll</dt>
                    <dd>{item.roll.toFixed(5)}</dd>
                  </>
                )}
              </>
            ) : (
              <>
                <dt>Found in</dt>
                <dd>{CASES[skin.caseId]?.name}</dd>
                <dt>Owned</dt>
                <dd>{owned ? `${owned.n} unboxed` : 'Not yet'}</dd>
              </>
            )}
          </dl>

          {target.kind === 'preview' && pv && (
            <div className="inspect__preview">
              <Btn
                size="sm"
                onClick={() => setPv({ ...pv, seed: Math.floor(Math.random() * SEED_COUNT) })}
              >
                <IconDice /> New pattern
              </Btn>
              <Switch on={pv.tally} onChange={(v) => setPv({ ...pv, tally: v })}>
                Tally
              </Switch>
            </div>
          )}

          <div className="inspect__actions">
            <Btn onClick={fire} quiet>
              <IconCrosshair /> {isKnife ? 'Flourish' : 'Test fire'} <kbd>F</kbd>
            </Btn>
            <Btn onClick={() => setUI({ photo: true })}>
              <IconCamera /> Photo <kbd>P</kbd>
            </Btn>
            {item && (
              <>
                <Btn onClick={() => toggleFav(item.id)}>
                  {item.fav ? <IconStarFill /> : <IconStar />} {item.fav ? 'Favourited' : 'Favourite'}
                </Btn>
                {confirmSell ? (
                  <Btn
                    variant="primary"
                    quiet
                    onClick={() => {
                      const got = useGame.getState().sellItems([item.id]);
                      audio.coin();
                      toast(`Sold for ${fmtCR(got)} CR`, 'good');
                      closeInspect();
                    }}
                  >
                    Confirm <span className="mono">+{fmtCR(value)}</span>
                  </Btn>
                ) : (
                  <Btn variant="danger" disabled={item.fav} title={item.fav ? 'Favourites are protected from sale' : undefined} onClick={() => setConfirmSell(true)}>
                    Sell <span className="mono">+{fmtCR(value)}</span>
                  </Btn>
                )}
              </>
            )}
          </div>
        </div>
      </aside>

      <div className="inspect__hint label">Drag to rotate · Scroll or pinch to zoom</div>
    </div>
  );
}
