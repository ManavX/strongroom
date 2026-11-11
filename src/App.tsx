/** App shell: owns the stage canvas, keeps the 3D stage in step with the UI, and frames every view. */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { audio } from './audio/audio';
import { resupplyState, RESUPPLY_AMOUNT } from './core/economy';
import { CASES } from './data/cases';
import { bootEngine, type Engine } from './engine/Engine';
import { useGame } from './state/store';
import { useUI, type InspectTarget, type View } from './state/ui';
import { Btn, CountUp } from './ui/components';
import { fmtCountdown, fmtCR, itemSpec } from './ui/format';
import { useKey, useNow } from './ui/hooks';
import { IconBook, IconChart, IconCoin, IconContract, IconGear, IconInventory, IconMark, IconMute, IconSound, IconSupply, IconVault } from './ui/icons';
import { CollectionView } from './ui/views/CollectionView';
import { ContractsView } from './ui/views/ContractsView';
import { InspectView } from './ui/views/InspectView';
import { InventoryView } from './ui/views/InventoryView';
import { RecordsView } from './ui/views/RecordsView';
import { SettingsModal } from './ui/views/SettingsModal';
import { VaultView } from './ui/views/VaultView';

const NAV: { id: View; name: string; icon: typeof IconVault }[] = [
  { id: 'vault', name: 'Vault', icon: IconVault },
  { id: 'inventory', name: 'Inventory', icon: IconInventory },
  { id: 'contracts', name: 'Contracts', icon: IconContract },
  { id: 'collection', name: 'Collection', icon: IconBook },
  { id: 'records', name: 'Records', icon: IconChart },
];

function TopBar() {
  const credits = useGame((s) => s.credits);
  const lastResupply = useGame((s) => s.lastResupply);
  const muted = useGame((s) => s.settings.muted);
  const setSetting = useGame((s) => s.setSetting);
  const setUI = useUI((s) => s.set);
  const toast = useUI((s) => s.toast);
  const now = useNow(1000);
  const supply = resupplyState(credits, lastResupply, now);
  const prev = useRef(credits);
  const [flash, setFlash] = useState<'up' | 'down' | undefined>();
  useEffect(() => {
    if (credits === prev.current) return;
    setFlash(credits > prev.current ? 'up' : 'down');
    prev.current = credits;
    const id = setTimeout(() => setFlash(undefined), 700);
    return () => clearTimeout(id);
  }, [credits]);

  return (
    <header className="topbar">
      <div className="brand">
        <IconMark className="brand__mark" />
        <div>
          <div className="brand__name">Strongroom</div>
          <div className="brand__sub">Simulated vault / play credits only</div>
        </div>
      </div>
      <div className="topbar__right">
        <Btn
          size="sm"
          variant="ghost"
          className="resupply"
          disabled={!supply.available}
          title={`Free ${fmtCR(RESUPPLY_AMOUNT)} credits. Always available when you cannot afford a case.`}
          quiet
          onClick={() => {
            if (useGame.getState().resupply()) {
              audio.coin(true);
              toast(`Resupply: +${fmtCR(RESUPPLY_AMOUNT)} CR`, 'good');
            }
          }}
        >
          <IconSupply />
          {supply.available ? <span className="resupply__label">Resupply +{fmtCR(RESUPPLY_AMOUNT)}</span> : <span className="mono">{fmtCountdown(supply.waitMs)}</span>}
        </Btn>
        <div className="credits" data-flash={flash} title="Play credits. No cash value.">
          <IconCoin className="credits__coin" />
          <span className="credits__value">
            <CountUp value={credits} />
          </span>
          <span className="credits__unit">CR</span>
        </div>
        <button type="button" className="iconbtn" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setSetting('muted', !muted)}>
          {muted ? <IconMute /> : <IconSound />}
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="Settings"
          onClick={() => {
            audio.click();
            setUI({ settingsOpen: true });
          }}
        >
          <IconGear />
        </button>
      </div>
    </header>
  );
}

function NavRail() {
  const view = useUI((s) => s.view);
  const inspect = useUI((s) => s.inspect);
  const setView = useUI((s) => s.setView);
  const count = useGame((s) => s.items.length);
  return (
    <nav className="nav" aria-label="Sections">
      {NAV.map((n) => (
        <button
          type="button"
          key={n.id}
          className="nav__item"
          data-active={view === n.id && !inspect}
          onPointerEnter={() => audio.hover()}
          onClick={() => {
            audio.unlock();
            audio.click();
            setView(n.id);
          }}
        >
          <n.icon />
          <span className="nav__label">{n.name}</span>
          {n.id === 'inventory' && count > 0 && <span className="nav__badge">{count > 999 ? '999+' : count}</span>}
        </button>
      ))}
    </nav>
  );
}

function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div className="toast" key={t.id} data-tone={t.tone}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

const inspectKey = (t: InspectTarget | null) => (!t ? '' : t.kind === 'item' ? `i:${t.id}` : `p:${t.skinId}`);

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [staged, setStaged] = useState(false);
  const [lowfx, setLowfx] = useState(false);
  const hydrated = useGame((s) => s.hydrated);
  const settings = useGame((s) => s.settings);
  const view = useUI((s) => s.view);
  const caseId = useUI((s) => s.caseId);
  const phase = useUI((s) => s.phase);
  const inspect = useUI((s) => s.inspect);
  const photo = useUI((s) => s.photo);
  const settingsOpen = useUI((s) => s.settingsOpen);
  const iKey = inspectKey(inspect);

  // Boot the engine once the canvas exists.
  useEffect(() => {
    const e = bootEngine(canvasRef.current!);
    e.onTier = (t) => setLowfx(t === 'low');
    setLowfx(e.currentTier === 'low');
    setEngine(e);
    void e.stage.setCase(CASES[useUI.getState().caseId], true).then(() => setStaged(true));
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Signal readiness (used by the screenshot tool) and expose handles for debugging in dev builds.
  useEffect(() => {
    if (!staged || !hydrated) return;
    const w = window as unknown as Record<string, unknown>;
    w.__ready = true;
    if (import.meta.env.DEV) w.__sr = { ui: useUI, game: useGame, engine };
  }, [staged, hydrated, engine]);

  // Settings -> engine and audio.
  useEffect(() => {
    engine?.setQuality(settings.quality);
  }, [engine, settings.quality]);
  useEffect(() => {
    audio.setVolume(settings.volume);
    audio.setMuted(settings.muted);
  }, [settings.volume, settings.muted]);

  // Selected case -> stage.
  useEffect(() => {
    if (engine && staged) void engine.stage.setCase(CASES[caseId]);
  }, [engine, staged, caseId]);

  // View and inspect target -> stage mode.
  const wasInspecting = useRef(false);
  useEffect(() => {
    if (!engine) return;
    const stage = engine.stage;
    const rest = view === 'vault' ? 'vault' : 'backdrop';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const target = useUI.getState().inspect;
    if (target) {
      const spec = target.kind === 'item' ? useGame.getState().items.find((i) => i.id === target.id) : target;
      if (!spec) {
        useUI.getState().closeInspect();
        return;
      }
      engine.setRunLevel('full');
      void stage.enterInspect(target.kind === 'item' ? itemSpec(spec as never) : { skinId: target.skinId, float: target.float, seed: target.seed, tally: target.tally });
      wasInspecting.current = true;
    } else {
      if (wasInspecting.current) void stage.exitInspect(rest);
      else if (stage.mode === 'result') void stage.dismissDrop(rest);
      else stage.setRest(rest);
      wasInspecting.current = false;
      engine.setRunLevel('full');
      // Behind the menus the stage only needs to tick over.
      if (rest === 'backdrop') timer = setTimeout(() => useUI.getState().phase === 'idle' && !useUI.getState().inspect && engine.setRunLevel('idle'), 1400);
    }
    return () => clearTimeout(timer);
  }, [engine, view, iKey]);

  // A contract reveal runs on the stage even though a menu view is open.
  useEffect(() => {
    if (engine && phase !== 'idle') engine.setRunLevel('full');
    else if (engine && view !== 'vault' && !inspect) {
      const id = setTimeout(() => useUI.getState().phase === 'idle' && !useUI.getState().inspect && useUI.getState().view !== 'vault' && engine.setRunLevel('idle'), 1400);
      return () => clearTimeout(id);
    }
  }, [engine, phase, view, inspect]);

  useKey(
    (e) => {
      if (e.code === 'KeyM') useGame.getState().setSetting('muted', !useGame.getState().settings.muted);
    },
    [],
  );

  const busy = phase === 'unlatch' || phase === 'reel' || phase === 'reveal';
  const onStage = view === 'vault' || !!inspect || phase !== 'idle';
  const accent = CASES[caseId].accent;

  return (
    <div className={`app${lowfx ? ' lowfx' : ''}${settings.reducedMotion ? ' calm' : ''}`} style={{ '--accent': accent } as CSSProperties}>
      <canvas ref={canvasRef} className="stage-canvas" tabIndex={-1} />
      <div className="frame" />
      <div className="scrim" data-on={!onStage} />
      <div className="ui" data-bare={busy || photo}>
        <TopBar />
        <NavRail />
        <main className="view">
          {inspect ? <InspectView key={iKey} /> : view === 'vault' ? <VaultView /> : view === 'inventory' ? <InventoryView /> : view === 'contracts' ? <ContractsView /> : view === 'collection' ? <CollectionView /> : <RecordsView />}
        </main>
      </div>
      <Toasts />
      {settingsOpen && <SettingsModal />}
      <div className="boot" data-done={staged && hydrated}>
        <div className="boot__inner">
          <IconMark className="boot__mark" />
          <div className="boot__name">Strongroom</div>
          <div className="boot__bar" />
        </div>
      </div>
    </div>
  );
}
