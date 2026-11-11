/**
 * Dev-only model and material viewer. Driven by query parameters so that
 * tools/shot.mjs can capture contact sheets for visual review:
 *
 *   lab.html?w=krait&wear=0.2&seed=3&views=side,hero&env=vault&exp=1
 */
import * as THREE from 'three';
import { EnvLibrary, type EnvPreset } from '../engine/env';
import { createWeapon, type WeaponLook } from '../engine/weaponFactory';
import { STOCK } from '../engine/finishes/stock';
import { getModel } from '../engine/models/registry';
import { labLook, skinWeapon } from './looks';
import { WEAPONS } from '../data/weapons';

const q = new URLSearchParams(location.search);
const lookName = q.get('look') ?? '';
const weaponId = q.get('w') ?? skinWeapon(lookName) ?? 'krait';
const wear = parseFloat(q.get('wear') ?? '0.08');
const seed = parseFloat(q.get('seed') ?? '1');
const views = (q.get('views') ?? 'side,hero').split(',');
const envName = (q.get('env') ?? 'vault') as EnvPreset;
const exposure = parseFloat(q.get('exp') ?? '1');

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(new THREE.Color(q.get('bg') ?? '#0b0c0e'));

const scene = new THREE.Scene();
const envs = new EnvLibrary(renderer);
scene.environment = envs.get(envName);

const key = new THREE.DirectionalLight(0xfff0de, 2.0);
key.position.set(-1.5, 3, 2.5);
scene.add(key);
const rim = new THREE.DirectionalLight(0x9cc4ff, 1.1);
rim.position.set(2, 1.5, -2.5);
scene.add(rim);

const t0 = performance.now();
const model = getModel(weaponId);
const buildMs = performance.now() - t0;

// `looks=skin:a,skin:b` renders one copy per look; `wears=0,0.3,0.9` one copy per wear value;
// `ws=krait,sentry` one copy per weapon model (each in its factory finish unless `look` is set).
const lookList = q.has('looks') ? q.get('looks')!.split(',') : null;
const idList = q.has('ws') ? q.get('ws')!.split(',') : null;
const wearList = q.has('wears') ? q.get('wears')!.split(',').map(Number) : lookList ? lookList.map(() => wear) : idList ? idList.map(() => wear) : null;
const weapons = (wearList ?? [wear]).map((w, i) => {
  const name = lookList ? lookList[i % lookList.length] : lookName;
  const id = idList ? idList[i % idList.length] : (skinWeapon(name) ?? weaponId);
  const stock = WEAPONS[id]?.stock;
  const fallback: WeaponLook = stock ? { body: STOCK[stock.body](), sec: STOCK[stock.sec]() } : { body: STOCK.blackOxide(), sec: STOCK.laminate() };
  const look: WeaponLook = labLook(name, seed) ?? fallback;
  const o = createWeapon(id, look, w, seed);
  scene.add(o);
  return o;
});
const weapon = weapons[0];

const cam = new THREE.PerspectiveCamera(20, 1, 0.01, 50);

interface ViewDef {
  yaw: number;
  pitch: number;
  zoom?: number;
  /** Target offset as a fraction of the model length along X. */
  tx?: number;
  ty?: number;
}
const VIEWS: Record<string, ViewDef> = {
  side: { yaw: 0, pitch: 0 },
  left: { yaw: 180, pitch: 0 },
  hero: { yaw: 38, pitch: 14 },
  rear: { yaw: -42, pitch: 12 },
  top: { yaw: 0, pitch: 78 },
  under: { yaw: 0, pitch: -70 },
  front: { yaw: 80, pitch: 6 },
  c1: { yaw: 14, pitch: 8, zoom: 2.5, tx: -0.27 },
  c2: { yaw: 10, pitch: 8, zoom: 2.5, tx: 0 },
  c3: { yaw: 18, pitch: 8, zoom: 2.5, tx: 0.27 },
  m1: { yaw: 6, pitch: 4, zoom: 5, tx: -0.1 },
};

const framing = weapons.map((o) => {
  const b = o.userData.bounds;
  const cs: THREE.Vector3[] = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) cs.push(new THREE.Vector3(x, y, z));
  return { size: b.getSize(new THREE.Vector3()), corners: cs };
});
const size = framing[0].size;
void weapon;

function frame(v: ViewDef, aspect: number, k = 0) {
  const { size, corners } = framing[Math.min(k, framing.length - 1)];
  const yaw = (v.yaw * Math.PI) / 180;
  const pitch = (v.pitch * Math.PI) / 180;
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const fwd = dir.clone().negate();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  const target = new THREE.Vector3((v.tx ?? 0) * size.x, (v.ty ?? 0) * size.y, 0);
  const tanV = Math.tan((cam.fov * Math.PI) / 360);
  const tanH = tanV * aspect;
  let d = 0;
  for (const c of corners) {
    const rel = c.clone();
    const f = rel.dot(fwd);
    d = Math.max(d, Math.abs(rel.dot(right)) / tanH - f, Math.abs(rel.dot(up)) / tanV - f);
  }
  d = (d * 1.08) / (v.zoom ?? 1);
  cam.aspect = aspect;
  cam.position.copy(target).addScaledVector(dir, d);
  cam.up.set(0, 1, 0);
  cam.lookAt(target);
  cam.near = Math.max(0.005, d - 2);
  cam.far = d + 4;
  cam.updateProjectionMatrix();
}

function render() {
  const W = renderer.domElement.width;
  const H = renderer.domElement.height;
  renderer.setScissorTest(true);
  const slots = wearList ? wearList.map((_, i) => views[i % views.length]) : views;
  const n = slots.length;
  const cols = n > 3 ? 2 : 1;
  const rows = Math.ceil(n / cols);
  slots.forEach((name, i) => {
    const v = VIEWS[name] ?? VIEWS.side;
    if (wearList) weapons.forEach((o, k) => (o.visible = k === i));
    const col = i % cols;
    const row = Math.floor(i / cols);
    const w = Math.floor(W / cols);
    const h = Math.floor(H / rows);
    const x = col * w;
    const y = H - (row + 1) * h;
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    frame(v, w / h, wearList ? i : 0);
    renderer.render(scene, cam);
  });
}

const hud = document.getElementById('hud')!;
hud.textContent = `${weaponId}  wear ${wear}  seed ${seed}  tris ${model.triangles}  build ${buildMs.toFixed(0)}ms  size ${(size.x * 1000).toFixed(0)}x${(size.y * 1000).toFixed(0)}x${(size.z * 1000).toFixed(0)}mm`;

let frames = 0;
function loop() {
  render();
  frames++;
  if (frames === 3) (window as unknown as { __ready: boolean }).__ready = true;
  if (frames < 6 || q.has('live')) requestAnimationFrame(loop);
}
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  render();
});
loop();
