import { useState } from 'react';
import { audio } from '../../audio/audio';
import type { Quality } from '../../core/types';
import { getEngine } from '../../engine/Engine';
import { useGame } from '../../state/store';
import { useUI } from '../../state/ui';
import { Btn, Switch } from '../components';
import { useKey, useNow } from '../hooks';
import { IconClose } from '../icons';

const QUALITIES: { id: Quality; name: string }[] = [
  { id: 'auto', name: 'Auto' },
  { id: 'low', name: 'Low' },
  { id: 'medium', name: 'Medium' },
  { id: 'high', name: 'High' },
];

export function SettingsModal() {
  const settings = useGame((s) => s.settings);
  const setSetting = useGame((s) => s.setSetting);
  const resetAll = useGame((s) => s.resetAll);
  const setUI = useUI((s) => s.set);
  const toast = useUI((s) => s.toast);
  const [confirmReset, setConfirmReset] = useState(false);
  useNow(700);
  const engine = getEngine();
  const close = () => setUI({ settingsOpen: false });
  useKey((e) => e.code === 'Escape' && close(), []);

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="modal__box panel" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="panel__head">
          <h2 className="modal__title">Settings</h2>
          <button type="button" className="iconbtn" onClick={close} aria-label="Close">
            <IconClose />
          </button>
        </div>
        <div className="panel__body">
          <div className="setting">
            <div>
              <div className="setting__name">Graphics quality</div>
              <div className="setting__hint">
                Auto watches frame time and picks a tier. Currently running <b>{engine?.currentTier ?? 'medium'}</b> at {engine ? Math.round(1000 / Math.max(1, engine.frameMs)) : 60} fps.
              </div>
            </div>
            <div className="seg">
              {QUALITIES.map((q) => (
                <button
                  type="button"
                  key={q.id}
                  data-on={settings.quality === q.id}
                  onClick={() => {
                    audio.select();
                    setSetting('quality', q.id);
                  }}
                >
                  {q.name}
                </button>
              ))}
            </div>
          </div>

          <div className="setting">
            <div>
              <div className="setting__name">Volume</div>
              <div className="setting__hint">Every sound is synthesised live in the browser.</div>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={settings.volume}
              style={{ ['--fill' as string]: `${settings.volume * 100}%` }}
              onChange={(e) => setSetting('volume', parseFloat(e.target.value))}
              onPointerUp={() => audio.select()}
              aria-label="Volume"
            />
          </div>

          <div className="setting">
            <div>
              <div className="setting__name">Sound</div>
            </div>
            <Switch on={!settings.muted} onChange={(v) => setSetting('muted', !v)}>
              {settings.muted ? 'Muted' : 'On'}
            </Switch>
          </div>

          <div className="setting">
            <div>
              <div className="setting__name">Quick open</div>
              <div className="setting__hint">Skip the reel and go straight to the reveal.</div>
            </div>
            <Switch on={settings.quickOpen} onChange={(v) => setSetting('quickOpen', v)}>
              {settings.quickOpen ? 'On' : 'Off'}
            </Switch>
          </div>

          <div className="setting">
            <div>
              <div className="setting__name">Reduced motion</div>
              <div className="setting__hint">Shortens interface animation and skips the reel.</div>
            </div>
            <Switch on={settings.reducedMotion} onChange={(v) => setSetting('reducedMotion', v)}>
              {settings.reducedMotion ? 'On' : 'Off'}
            </Switch>
          </div>

          <div className="setting">
            <div>
              <div className="setting__name">Reset progress</div>
              <div className="setting__hint">Clears credits, inventory, collection and records on this device. Settings are kept.</div>
            </div>
            {confirmReset ? (
              <Btn
                size="sm"
                variant="primary"
                onClick={() => {
                  resetAll();
                  setUI({ contract: [], selection: [], selecting: false });
                  setConfirmReset(false);
                  toast('Progress reset', 'info');
                }}
              >
                Confirm reset
              </Btn>
            ) : (
              <Btn size="sm" variant="danger" onClick={() => setConfirmReset(true)}>
                Reset
              </Btn>
            )}
          </div>

          <p className="settings__legal">Strongroom is a simulation. Credits are play money with no cash value: they cannot be bought, sold, transferred or withdrawn. All weapons and finishes are original designs.</p>
        </div>
      </div>
    </div>
  );
}
