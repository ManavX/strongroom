/**
 * Renderer, post-processing chain, frame loop and adaptive quality.
 * One Engine owns the single WebGL context for the whole app.
 */
import { BloomEffect, DepthOfFieldEffect, EffectComposer, EffectPass, NoiseEffect, RenderPass, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode, VignetteEffect, BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import type { Quality } from '../core/types';
import { EnvLibrary } from './env';
import { warmModels } from './models/registry';
import { VaultStage } from './stage/VaultStage';
import { ThumbRenderer } from './thumbs';

export type RunLevel = 'full' | 'idle' | 'paused';
type TierName = 'low' | 'medium' | 'high';

interface Tier {
  dpr: number;
  /** Ceiling on rendered pixels, in megapixels, whatever the display's density. */
  maxMp: number;
  msaa: number;
  dof: boolean;
  shadow: number;
  bloom: number;
}

const TIERS: Record<TierName, Tier> = {
  low: { dpr: 1.25, maxMp: 1.2, msaa: 0, dof: false, shadow: 1024, bloom: 0.55 },
  medium: { dpr: 1.3, maxMp: 1.7, msaa: 4, dof: false, shadow: 2048, bloom: 0.7 },
  high: { dpr: 1.75, maxMp: 3.2, msaa: 4, dof: true, shadow: 2048, bloom: 0.75 },
};

/** The scene never needs more than this: high-refresh displays would only burn GPU. */
const FRAME_BUDGET = 1 / 60;

/**
 * Integrated and mobile GPUs run Medium well but not High, so Auto never steps
 * them up. Detection is by renderer name and errs toward "modest" when unsure.
 */
function isModestGpu(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    return /Intel|Iris|UHD|Radeon\(TM\)\s+(\d{3}M|Graphics)|Radeon\s+\d{3}M|Vega|Adreno|Mali|PowerVR|SwiftShader|llvmpipe|Basic Render/i.test(name);
  } catch {
    return true;
  }
}

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly envs: EnvLibrary;
  readonly stage: VaultStage;
  readonly thumbs: ThumbRenderer;
  private composer: EffectComposer;
  private dof: DepthOfFieldEffect;
  private dofPass: EffectPass;
  private bloom: BloomEffect;
  private smaa: SMAAEffect;
  private finalPass: EffectPass | null = null;
  private finalAA: boolean | null = null;
  private finalEffects: [BloomEffect, VignetteEffect, NoiseEffect, ToneMappingEffect];
  private clock = new THREE.Clock();
  private raf = 0;
  private level: RunLevel = 'full';
  private idleAccum = 0;
  private quality: Quality = 'auto';
  private tier: TierName = 'medium';
  private autoLocked = false;
  private scale = 1;
  private samples: number[] = [];
  private frames = 0;
  private w = 1;
  private h = 1;
  private acc = 0;
  private modestGpu = false;
  private disposed = false;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  /** Smoothed frame time in ms, for the settings readout. */
  frameMs = 16;
  onTier?: (tier: TierName) => void;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, depth: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x050506, 1);

    this.envs = new EnvLibrary(this.renderer);
    this.modestGpu = isModestGpu(this.renderer.getContext());
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.tier = coarse ? 'low' : 'medium';
    this.stage = new VaultStage(this.envs, coarse ? 260 : 620);
    this.thumbs = new ThumbRenderer(this.renderer, this.envs);

    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: TIERS[this.tier].msaa });
    this.composer.addPass(new RenderPass(this.stage.scene, this.stage.camera));

    this.dof = new DepthOfFieldEffect(this.stage.camera, { focusDistance: 2, focusRange: 1.4, bokehScale: 3.2, resolutionScale: 0.5 });
    this.dofPass = new EffectPass(this.stage.camera, this.dof);
    this.dofPass.enabled = false;
    this.composer.addPass(this.dofPass);

    this.bloom = new BloomEffect({ blendFunction: BlendFunction.ADD, mipmapBlur: true, luminanceThreshold: 1.05, luminanceSmoothing: 0.25, intensity: TIERS[this.tier].bloom, radius: 0.78, levels: 7 });
    const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.62 });
    const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    grain.blendMode.opacity.value = 0.11;
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    this.smaa = new SMAAEffect({ preset: SMAAPreset.MEDIUM });
    this.finalEffects = [this.bloom, vignette, grain, tone];

    this.applyTier();
    this.resize();
    this.bind();
    warmModels();
  }

  /* ---------------- quality ---------------- */

  setQuality(q: Quality) {
    this.quality = q;
    if (q !== 'auto') {
      this.tier = q;
      this.autoLocked = true;
    } else {
      this.autoLocked = false;
      this.samples.length = 0;
    }
    this.scale = 1;
    this.applyTier();
    this.resize();
  }

  get currentTier(): TierName {
    return this.tier;
  }

  /** The active tier, trimmed on integrated GPUs while Auto is in charge. */
  private get eff(): Tier {
    const t = TIERS[this.tier];
    if (this.quality !== 'auto' || !this.modestGpu) return t;
    return { ...t, msaa: Math.min(t.msaa, 2), maxMp: t.maxMp * 0.78 };
  }

  private applyTier() {
    const t = this.eff;
    this.composer.multisampling = t.msaa;
    // SMAA only stands in when MSAA is off. Effects are merged into one shader per pass,
    // so switching means swapping the final pass rather than toggling a flag.
    const aa = t.msaa === 0;
    if (aa !== this.finalAA) {
      if (this.finalPass) this.composer.removePass(this.finalPass);
      this.finalPass = aa ? new EffectPass(this.stage.camera, ...this.finalEffects, this.smaa) : new EffectPass(this.stage.camera, ...this.finalEffects);
      this.composer.addPass(this.finalPass);
      this.finalAA = aa;
    }
    this.bloom.intensity = t.bloom;
    this.dofPass.enabled = t.dof;
    const key = this.stage.scene.getObjectByProperty('isSpotLight', true) as THREE.SpotLight | undefined;
    if (key?.shadow && key.shadow.mapSize.x !== t.shadow) {
      key.shadow.mapSize.set(t.shadow, t.shadow);
      key.shadow.map?.dispose();
      key.shadow.map = null;
    }
    this.onTier?.(this.tier);
  }

  private adapt(dtMs: number) {
    if (this.level !== 'full' || document.hidden) return;
    this.samples.push(dtMs);
    if (this.samples.length < 150) return;
    const sorted = [...this.samples].sort((a, b) => a - b);
    this.samples.length = 0;
    // Judged against the 60 fps budget, not the display's refresh rate.
    const p85 = sorted[Math.floor(sorted.length * 0.85)];
    const slow = p85 > 21.5;
    if (slow) {
      if (this.scale > 0.72) this.scale = Math.max(0.7, this.scale - 0.12);
      else if (!this.autoLocked && this.tier !== 'low') {
        this.tier = this.tier === 'high' ? 'medium' : 'low';
        this.scale = 1;
        this.autoLocked = true; // do not oscillate back up
        this.applyTier();
      }
      this.resize();
    } else if (p85 < 18) {
      if (this.scale < 1) {
        this.scale = Math.min(1, this.scale + 0.06);
        this.resize();
      } else if (!this.autoLocked && !this.modestGpu && this.quality === 'auto' && this.tier === 'medium' && this.frames > 600 && !matchMedia('(pointer: coarse)').matches) {
        this.tier = 'high';
        this.applyTier();
        this.resize();
      }
    }
  }

  /* ---------------- sizing ---------------- */

  resize = () => {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    this.w = w;
    this.h = h;
    const tier = this.eff;
    let dpr = Math.min(window.devicePixelRatio || 1, tier.dpr);
    // Large or dense displays: hold the pixel count to the tier's budget.
    const mp = (w * h * dpr * dpr) / 1e6;
    if (mp > tier.maxMp) dpr *= Math.sqrt(tier.maxMp / mp);
    dpr *= this.scale;
    this.renderer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.stage.resize(w, h);
  };

  /* ---------------- input ---------------- */

  private bind() {
    const el = this.canvas;
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      if (this.pointers.size === 1) {
        this.stage.drag(e.clientX - p.x, e.clientY - p.y);
      } else if (this.pointers.size === 2) {
        p.x = e.clientX;
        p.y = e.clientY;
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch > 0) this.stage.zoomBy(this.pinch / d);
        this.pinch = d;
        return;
      }
      p.x = e.clientX;
      p.y = e.clientY;
    });
    const end = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      this.pinch = 0;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.stage.zoomBy(Math.exp(e.deltaY * 0.0011));
      },
      { passive: false },
    );
    window.addEventListener('pointermove', (e) => {
      this.stage.cam.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    });
    window.addEventListener('resize', this.resize);
    new ResizeObserver(this.resize).observe(el);
  }

  /* ---------------- loop ---------------- */

  setRunLevel(level: RunLevel) {
    this.level = level;
  }

  start() {
    if (this.raf) return;
    this.clock.start();
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.1);
      this.thumbs.pump();
      if (this.level === 'paused') return;
      if (this.level === 'idle') {
        this.idleAccum += dt;
        if (this.idleAccum < 0.11) return;
        this.renderFrame(this.idleAccum);
        this.idleAccum = 0;
        return;
      }
      // Cap at 60 fps: on a 120 Hz display this renders every other refresh.
      this.acc += dt;
      if (this.acc < FRAME_BUDGET - 0.0015) return;
      const step = Math.min(this.acc, 0.1);
      this.acc = Math.min(this.acc - FRAME_BUDGET, FRAME_BUDGET);
      this.frames++;
      this.renderFrame(step);
      if (!this.thumbs.pending) this.adapt(step * 1000);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private renderFrame(dt: number) {
    if (dt > 0) this.frameMs += (dt * 1000 - this.frameMs) * 0.06;
    const time = this.clock.elapsedTime;
    this.stage.update(dt, time);
    if (this.dofPass.enabled) {
      // keep the subject sharp: focus on the camera target with a generous range
      const d = this.stage.cam.radius;
      this.dof.cocMaterial.focusDistance = d;
      this.dof.cocMaterial.focusRange = Math.max(0.5, d * 0.55);
    }
    this.composer.render(dt);
  }

  /**
   * Render one frame at `scale` times the current resolution and return it as a PNG.
   * Used by photo mode.
   */
  async capture(scale = 2): Promise<Blob> {
    const dpr = this.renderer.getPixelRatio();
    const maxDim = this.renderer.capabilities.maxTextureSize;
    const target = Math.min(dpr * scale, maxDim / Math.max(this.w, this.h), 4);
    this.renderer.setPixelRatio(target);
    this.composer.setSize(this.w, this.h);
    this.renderFrame(0);
    const blob = await new Promise<Blob | null>((res) => this.canvas.toBlob(res, 'image/png'));
    this.renderer.setPixelRatio(dpr);
    this.composer.setSize(this.w, this.h);
    this.renderFrame(0);
    if (!blob) throw new Error('capture failed');
    return blob;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.thumbs.dispose();
    this.stage.dispose();
    this.envs.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}

/* ---------------- singleton access for the UI ---------------- */

let instance: Engine | null = null;
const waiters: ((e: Engine) => void)[] = [];

export function bootEngine(canvas: HTMLCanvasElement): Engine {
  if (instance) return instance;
  instance = new Engine(canvas);
  instance.start();
  for (const w of waiters.splice(0)) w(instance);
  return instance;
}

export const getEngine = () => instance;

export function whenEngine(): Promise<Engine> {
  return instance ? Promise.resolve(instance) : new Promise((res) => waiters.push(res));
}
