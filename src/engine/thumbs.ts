/**
 * Item thumbnails are real renders of the actual 3D item (its skin, wear, seed
 * and Tally module), produced off-screen on the main renderer and handed to
 * the UI as blob URLs. Requests are queued and rendered a few per frame.
 */
import * as THREE from 'three';
import type { EnvLibrary } from './env';
import { createItemObject, disposeItemObject, specKey, type ItemSpec } from './itemObject';
import { WEAPONS } from '../data/weapons';
import { SKINS } from '../data/skins';

export const THUMB_W = 400;
export const THUMB_H = 300;
const CACHE_LIMIT = 900;

const TONEMAP_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform float exposure;
varying vec2 vUv;
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 color) {
  const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= exposure / 0.6;
  color = inM * color;
  color = RRTAndODTFit(color);
  color = outM * color;
  return clamp(color, 0.0, 1.0);
}
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float a = clamp(c.a, 0.0, 1.0);
  vec3 rgb = a > 0.0005 ? c.rgb / a : vec3(0.0);
  rgb = aces(rgb);
  rgb = mix(rgb * 12.92, 1.055 * pow(rgb, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, rgb));
  gl_FragColor = vec4(rgb, a);
}`;

interface Job {
  key: string;
  spec: ItemSpec;
  resolve: (url: string) => void;
  reject: (e: unknown) => void;
}

export class ThumbRenderer {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(13, THUMB_W / THUMB_H, 0.05, 30);
  private pivot = new THREE.Group();
  private hdr: THREE.WebGLRenderTarget;
  private ldr: THREE.WebGLRenderTarget;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quadMat: THREE.ShaderMaterial;
  private queue: Job[] = [];
  private inflight = new Map<string, Promise<string>>();
  private cache = new Map<string, string>();
  private busy = false;
  private pixels = new Uint8Array(THUMB_W * THUMB_H * 4);
  private canvas: OffscreenCanvas | HTMLCanvasElement;
  private ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private corners = Array.from({ length: 8 }, () => new THREE.Vector3());

  constructor(
    private renderer: THREE.WebGLRenderer,
    envs: EnvLibrary,
  ) {
    this.scene.environment = envs.get('studio');
    this.scene.environmentIntensity = 0.85;
    const key = new THREE.DirectionalLight(0xfff0de, 2.4);
    key.position.set(-1.4, 2.6, 2.4);
    const rim = new THREE.DirectionalLight(0xa9c8ff, 1.4);
    rim.position.set(2.2, 1.2, -2.4);
    const warm = new THREE.DirectionalLight(0xffb060, 0.7);
    warm.position.set(-2.4, -0.6, -1.5);
    this.scene.add(key, rim, warm, this.pivot);

    this.hdr = new THREE.WebGLRenderTarget(THUMB_W, THUMB_H, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
    this.ldr = new THREE.WebGLRenderTarget(THUMB_W, THUMB_H, { type: THREE.UnsignedByteType, depthBuffer: false });
    this.quadMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.hdr.texture }, exposure: { value: 1.25 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: TONEMAP_FRAG,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.quadMat));

    if (typeof OffscreenCanvas !== 'undefined') {
      this.canvas = new OffscreenCanvas(THUMB_W, THUMB_H);
      this.ctx = this.canvas.getContext('2d')!;
    } else {
      const cv = document.createElement('canvas');
      cv.width = THUMB_W;
      cv.height = THUMB_H;
      this.canvas = cv;
      this.ctx = cv.getContext('2d')!;
    }
  }

  /** Cached URL if this exact item has already been rendered. */
  peek(spec: ItemSpec): string | null {
    const key = specKey(spec);
    const hit = this.cache.get(key);
    if (hit) {
      this.cache.delete(key);
      this.cache.set(key, hit);
    }
    return hit ?? null;
  }

  request(spec: ItemSpec): Promise<string> {
    const key = specKey(spec);
    const hit = this.peek(spec);
    if (hit) return Promise.resolve(hit);
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const p = new Promise<string>((resolve, reject) => this.queue.push({ key, spec, resolve, reject }));
    this.inflight.set(key, p);
    return p;
  }

  get pending() {
    return this.queue.length + (this.busy ? 1 : 0);
  }

  /** Called once per frame by the engine. Renders at most one thumbnail per call. */
  pump() {
    if (this.busy || !this.queue.length) return;
    const job = this.queue.shift()!;
    this.busy = true;
    this.render(job.spec)
      .then((url) => {
        this.cache.set(job.key, url);
        if (this.cache.size > CACHE_LIMIT) {
          const first = this.cache.entries().next().value;
          if (first) {
            this.cache.delete(first[0]);
            URL.revokeObjectURL(first[1]);
          }
        }
        job.resolve(url);
      })
      .catch(job.reject)
      .finally(() => {
        this.inflight.delete(job.key);
        this.busy = false;
      });
  }

  private frame(obj: THREE.Object3D, bounds: THREE.Box3, knife: boolean) {
    // Three-quarter product angle; blades are rolled further so they fill the 4:3 frame.
    this.pivot.rotation.set(THREE.MathUtils.degToRad(9), THREE.MathUtils.degToRad(-22), THREE.MathUtils.degToRad(knife ? 34 : 15), 'YXZ');
    this.pivot.updateMatrixWorld(true);
    let i = 0;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) this.corners[i++].set(x, y, z).applyMatrix4(this.pivot.matrixWorld);
    const tanV = Math.tan((this.camera.fov * Math.PI) / 360);
    const tanH = tanV * this.camera.aspect;
    let cx0 = Infinity;
    let cx1 = -Infinity;
    let cy0 = Infinity;
    let cy1 = -Infinity;
    for (const c of this.corners) {
      cx0 = Math.min(cx0, c.x);
      cx1 = Math.max(cx1, c.x);
      cy0 = Math.min(cy0, c.y);
      cy1 = Math.max(cy1, c.y);
    }
    const mx = (cx0 + cx1) / 2;
    const my = (cy0 + cy1) / 2;
    let d = 0;
    for (const c of this.corners) d = Math.max(d, Math.abs(c.x - mx) / tanH + c.z, Math.abs(c.y - my) / tanV + c.z);
    d *= 1.03;
    this.camera.position.set(mx, my, d);
    this.camera.lookAt(mx, my, 0);
    this.camera.near = Math.max(0.02, d - 1.5);
    this.camera.far = d + 1.5;
    this.camera.updateProjectionMatrix();
    void obj;
  }

  private async render(spec: ItemSpec): Promise<string> {
    const r = this.renderer;
    const obj = createItemObject(spec);
    this.pivot.add(obj);
    const knife = WEAPONS[SKINS[spec.skinId].weapon].kind === 'Knife';
    this.frame(obj, obj.userData.bounds, knife);

    const prevTarget = r.getRenderTarget();
    const prevClear = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    const prevTone = r.toneMapping;
    const prevShadow = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false;
    r.toneMapping = THREE.NoToneMapping;
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(this.hdr);
    r.clear();
    r.render(this.scene, this.camera);
    r.setRenderTarget(this.ldr);
    r.clear();
    r.render(this.quadScene, this.quadCam);
    r.setRenderTarget(prevTarget);
    r.setClearColor(prevClear, prevAlpha);
    r.toneMapping = prevTone;
    r.shadowMap.autoUpdate = prevShadow;

    this.pivot.remove(obj);
    disposeItemObject(obj);

    await r.readRenderTargetPixelsAsync(this.ldr, 0, 0, THUMB_W, THUMB_H, this.pixels);

    const img = this.ctx.createImageData(THUMB_W, THUMB_H);
    const row = THUMB_W * 4;
    for (let y = 0; y < THUMB_H; y++) {
      const src = (THUMB_H - 1 - y) * row;
      img.data.set(this.pixels.subarray(src, src + row), y * row);
    }
    this.ctx.putImageData(img, 0, 0);
    let blob: Blob | null;
    if ('convertToBlob' in this.canvas) blob = await this.canvas.convertToBlob({ type: 'image/webp', quality: 0.9 });
    else blob = await new Promise<Blob | null>((res) => (this.canvas as HTMLCanvasElement).toBlob(res, 'image/webp', 0.9));
    if (!blob) throw new Error('thumbnail encode failed');
    return URL.createObjectURL(blob);
  }

  dispose() {
    for (const url of this.cache.values()) URL.revokeObjectURL(url);
    this.cache.clear();
    this.hdr.dispose();
    this.ldr.dispose();
    this.quadMat.dispose();
  }
}
