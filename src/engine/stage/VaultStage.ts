/**
 * The one persistent 3D scene. Every view of the app is a different use of
 * this stage: the case on its turntable, the opening and reveal sequence, the
 * item inspector and the dimmed backdrop behind the menus.
 */
import gsap from 'gsap';
import * as THREE from 'three';
import { audio } from '../../audio/audio';
import type { CaseDef } from '../../data/cases';
import { RARITIES, type RarityId } from '../../data/rarities';
import { SKINS } from '../../data/skins';
import { WEAPONS } from '../../data/weapons';
import type { EnvLibrary, EnvPreset } from '../env';
import { createItemObject, disposeItemObject, updateItemObject, type ItemSpec } from '../itemObject';
import { createCase, type CaseRig } from '../models/caseModel';
import type { WeaponObject } from '../weaponFactory';
import { createFlash, createRing, createShaft, Dust, Sparks, type Flash, type Ring, type Shaft } from './fx';
import { CameraRig, fitDistance, SpinRig, type Shot } from './rigs';
import { buildVaultSet, setAccent, type VaultSet } from './set';

export type StageMode = 'vault' | 'opening' | 'result' | 'inspect' | 'backdrop';

const ITEM_Y = 0.52;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const SHOTS: Record<'vault' | 'open' | 'reel' | 'backdrop', Shot> = {
  vault: { target: V(0, 0.4, 0), theta: 0, phi: 1.41, radius: 2.2, fov: 33 },
  open: { target: V(0, 0.34, 0), theta: 0, phi: 1.2, radius: 1.95, fov: 33 },
  reel: { target: V(0, 0.66, 0), theta: 0, phi: 1.27, radius: 2.4, fov: 33 },
  backdrop: { target: V(0, 0.9, 0), theta: 0.3, phi: 1.45, radius: 3.7, fov: 33 },
};
const WARM = new THREE.Color(0xffdcb0);

export class VaultStage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  readonly cam = new CameraRig(this.camera);
  mode: StageMode = 'vault';

  private set: VaultSet;
  private caseSpin = new SpinRig();
  private caseLift = new THREE.Group();
  private caseRig: CaseRig | null = null;
  private caseToken = 0;
  private itemLift = new THREE.Group();
  private itemSpin = new SpinRig();
  private itemKick = new THREE.Group();
  private item: WeaponObject | null = null;
  private itemSpec: ItemSpec | null = null;
  private itemSize = new THREE.Vector3(0.6, 0.2, 0.05);

  private dust: Dust;
  private sparks = new Sparks(900);
  private ring: Ring = createRing();
  private ring2: Ring = createRing();
  private flash: Flash = createFlash();
  private muzzle: Flash = createFlash();
  private muzzleLight = new THREE.PointLight(0xffb060, 0, 3, 2);
  private column: Shaft = createShaft(0.5, 0.2, 2.6, false);
  private ceiling: Shaft = createShaft(0.25, 0.95, 3.3, true);

  /** Animated scalar state, driven by gsap and applied every frame. */
  private fx = { lid: 0, latch: 0, glow: 0, column: 0, ring: 0, ring2: 0, flash: 0, dim: 1, shake: 0, muzzle: 0, accent: 1 };
  private glowColor = new THREE.Color(WARM);
  private glowGoal = new THREE.Color(WARM);
  private accent = new THREE.Color(0xff8a2a);
  private accentGoal = new THREE.Color(0xff8a2a);
  private reelGlow: number | null = null;
  private charging = 0;
  private size = new THREE.Vector2(1280, 720);
  private keyBase: number;
  private rimCoolBase: number;
  private rimWarmBase: number;
  private busy = false;
  private tmp = new THREE.Vector3();

  constructor(private envs: EnvLibrary, dustCount = 520) {
    this.scene.background = new THREE.Color(0x050506);
    this.scene.fog = new THREE.FogExp2(0x060607, 0.085);
    this.scene.environment = envs.get('vault');
    this.scene.environmentIntensity = 0.95;

    this.set = buildVaultSet();
    this.keyBase = this.set.key.intensity;
    this.rimCoolBase = this.set.rimCool.intensity;
    this.rimWarmBase = this.set.rimWarm.intensity;
    this.scene.add(this.set.group);

    this.caseSpin.group.add(this.caseLift);
    this.caseSpin.auto = 0.16;
    this.scene.add(this.caseSpin.group);

    this.itemLift.position.y = ITEM_Y;
    this.itemSpin.pitchRange = [-1.25, 1.25];
    this.itemSpin.group.add(this.itemKick);
    this.itemLift.add(this.itemSpin.group);
    this.scene.add(this.itemLift);

    this.dust = new Dust(dustCount);
    this.ring.mesh.position.y = 0.004;
    this.ring2.mesh.position.y = 0.006;
    this.column.mesh.position.y = 0.1;
    this.ceiling.set(WARM, 0.085);
    this.muzzleLight.castShadow = false;
    this.scene.add(this.dust.points, this.sparks.points, this.ring.mesh, this.ring2.mesh, this.flash.sprite, this.muzzle.sprite, this.muzzleLight, this.column.mesh, this.ceiling.mesh);

    this.cam.setShot(SHOTS.vault, true);
    setAccent(this.set, this.accent, 1);
  }

  /* ---------------------------------------------------------------- */
  /* Input                                                             */
  /* ---------------------------------------------------------------- */

  drag(dx: number, dy: number) {
    const k = 0.0062;
    if (this.mode === 'vault') this.caseSpin.drag(dx * k, 0);
    else if (this.mode === 'result' || this.mode === 'inspect') this.itemSpin.drag(dx * k, dy * k);
  }

  zoomBy(factor: number) {
    if (this.mode === 'result' || this.mode === 'inspect' || this.mode === 'vault') this.cam.addZoom(factor);
  }

  resize(w: number, h: number) {
    this.size.set(w, h);
    this.cam.resize(w, h);
    if (this.item && (this.mode === 'result' || this.mode === 'inspect')) this.cam.setShot(this.itemShot());
  }

  /** Shift the subject off-centre to clear UI panels (pixels). */
  setScreenOffset(x: number, y: number) {
    this.cam.setScreenOffset(x, y);
  }

  /* ---------------------------------------------------------------- */
  /* Cases                                                             */
  /* ---------------------------------------------------------------- */

  get currentCase(): CaseDef | null {
    return this.caseRig?.def ?? null;
  }

  async setCase(def: CaseDef, instant = false): Promise<void> {
    if (this.caseRig?.def.id === def.id) return;
    const token = ++this.caseToken;
    this.accentGoal.set(def.accent);
    const old = this.caseRig;
    if (old && !instant) {
      audio.whoosh(0.5);
      await gsap.to(this.caseLift.position, { y: -0.5, duration: 0.3, ease: 'power2.in' });
    }
    if (token !== this.caseToken) return;
    old?.dispose();
    const rig = createCase(def);
    this.caseRig = rig;
    this.caseLift.add(rig.root);
    this.fx.lid = 0;
    this.fx.latch = 0;
    this.fx.glow = 0;
    if (instant) {
      this.caseLift.position.y = 0;
      this.accent.copy(this.accentGoal);
      return;
    }
    this.caseLift.position.y = -0.5;
    this.caseSpin.set(this.caseSpin.yaw - 1.4);
    this.caseSpin.face(0.42);
    await gsap.to(this.caseLift.position, { y: 0, duration: 0.6, ease: 'back.out(1.3)' });
  }

  /* ---------------------------------------------------------------- */
  /* Opening sequence                                                  */
  /* ---------------------------------------------------------------- */

  /** Step 1: square the case up, pop the latches and crack the lid. */
  async unlatch(): Promise<void> {
    if (!this.caseRig) return;
    this.mode = 'opening';
    this.cam.zoom = 1;
    this.cam.zoomRange = [1, 1];
    this.caseSpin.auto = 0;
    this.caseSpin.face(0);
    this.cam.setShot(SHOTS.open);
    this.glowGoal.copy(WARM);
    const tl = gsap.timeline();
    tl.to(this.fx, { latch: 1, duration: 0.3, ease: 'back.out(2.2)', onStart: () => audio.latch() }, 0.3);
    tl.call(() => audio.latch(), [], 0.42);
    tl.to(this.fx, { lid: 0.13, duration: 0.55, ease: 'back.out(1.6)', onStart: () => audio.lid() }, 0.62);
    tl.to(this.fx, { glow: 0.5, duration: 0.5 }, 0.62);
    tl.to(this.fx, { column: 0.18, duration: 0.6 }, 0.7);
    await tl;
    this.cam.setShot(SHOTS.reel);
  }

  /** Step 2: while the reel spins, the case light follows whatever is under the marker. */
  setReelGlow(color: string | null, strength = 0.6) {
    if (color === null) {
      this.reelGlow = null;
      return;
    }
    this.glowGoal.set(color);
    this.reelGlow = strength;
  }

  /** Step 3: throw the lid open and present the drop. */
  async reveal(spec: ItemSpec): Promise<void> {
    const rarityId = SKINS[spec.skinId].rarity;
    const rar = RARITIES[rarityId];
    const tier = rar.tier;
    this.reelGlow = null;
    this.glowGoal.set(rar.glow);
    this.mountItem(spec);
    const item = this.item!;
    item.visible = false;
    this.itemKick.position.set(0, 0.16 - ITEM_Y, 0);
    this.itemKick.scale.setScalar(0.1);
    this.itemSpin.set(-0.45 - 4.2, 0.1);

    const tl = gsap.timeline();
    let t0 = 0;
    if (tier >= 4) {
      // Relic: the room goes dark and the case builds pressure first.
      t0 = 1.35;
      audio.charge();
      this.charging = 1;
      tl.to(this.fx, { dim: 0.18, duration: 0.5, ease: 'power2.out' }, 0);
      tl.to(this.fx, { glow: 2.4, duration: 1.3, ease: 'power3.in' }, 0);
      tl.to(this.fx, { column: 0.9, duration: 1.3, ease: 'power3.in' }, 0);
      tl.to(this.fx, { shake: 1, duration: 1.3, ease: 'power2.in' }, 0);
      tl.to(this.fx, { lid: 0.3, duration: 1.3, ease: 'power2.in' }, 0);
    }
    tl.call(
      () => {
        this.charging = 0;
        audio.reveal(tier);
        item.visible = true;
        const o = this.tmp.set(0, 0.16, 0);
        this.sparks.burst(o, rar.glow, [70, 110, 170, 260, 520][tier], 1.6 + tier * 0.5, 0.75, 1.3 + tier * 0.25, 8 + tier * 1.5);
        this.cam.setShot(this.itemShot());
        this.setItemZoomRange();
      },
      [],
      t0,
    );
    tl.to(this.fx, { lid: 1, duration: 0.8, ease: 'back.out(1.25)' }, t0);
    tl.to(this.fx, { shake: 0, duration: 0.25 }, t0);
    tl.fromTo(this.fx, { flash: 0 }, { flash: 0.9 + tier * 0.35, duration: 0.07, ease: 'none' }, t0);
    tl.to(this.fx, { flash: 0, duration: 0.7 + tier * 0.15, ease: 'power2.out' }, t0 + 0.07);
    tl.fromTo(this.fx, { ring: 0 }, { ring: 1, duration: 1.05, ease: 'none' }, t0);
    if (tier >= 3) tl.fromTo(this.fx, { ring2: 0 }, { ring2: 1, duration: 1.2, ease: 'none' }, t0 + 0.16);
    tl.to(this.fx, { column: 1.25 + tier * 0.2, duration: 0.14 }, t0);
    tl.to(this.fx, { column: 0, duration: 1.3, ease: 'power2.out' }, t0 + 0.14);
    tl.to(this.caseLift.position, { y: -0.8, duration: 0.65, ease: 'power2.in' }, t0 + 0.5);
    tl.to(this.fx, { glow: 1.5 + tier * 0.2, duration: 0.12 }, t0);
    tl.to(this.fx, { glow: 0.75, duration: 1.4 }, t0 + 0.12);
    tl.to(this.fx, { dim: 1, duration: 0.9 }, t0 + 0.1);
    tl.to(this.itemKick.position, { y: 0, duration: 1.25, ease: 'expo.out' }, t0);
    tl.to(this.itemKick.scale, { x: 1, y: 1, z: 1, duration: 1.05, ease: 'expo.out' }, t0);
    tl.to(this.itemSpin, { yaw: -0.45, duration: 1.5, ease: 'expo.out' }, t0);
    if (tier >= 4) tl.call(() => this.sparks.burst(this.tmp.set(0, ITEM_Y, 0), rar.glow, 260, 2.2, 0.2, 1.8, 9), [], t0 + 0.25);
    await tl;
    this.mode = 'result';
    this.itemSpin.auto = 0.22;
    this.itemSpin.touch();
  }

  /** Present an item that did not come out of the case (contract results). */
  async presentLoose(spec: ItemSpec): Promise<void> {
    const rar = RARITIES[SKINS[spec.skinId].rarity];
    const tier = rar.tier;
    this.mode = 'opening';
    this.caseSpin.auto = 0;
    this.glowGoal.set(rar.glow);
    gsap.to(this.caseLift.position, { y: -0.6, duration: 0.4, ease: 'power2.in', overwrite: true });
    this.mountItem(spec);
    this.itemKick.position.set(0, -0.35, 0);
    this.itemKick.scale.setScalar(0.1);
    this.itemSpin.set(-0.45 - 4.2, 0.1);
    this.cam.zoom = 1;
    this.cam.setShot(this.itemShot());
    this.setItemZoomRange();
    audio.contract();
    const tl = gsap.timeline();
    const t0 = 0.45;
    tl.to(this.fx, { dim: 0.3, duration: 0.4 }, 0);
    tl.call(
      () => {
        audio.reveal(tier);
        this.sparks.burst(this.tmp.set(0, ITEM_Y - 0.1, 0), rar.glow, [90, 140, 200, 300, 520][tier], 1.8 + tier * 0.4, 0.3, 1.4, 9);
      },
      [],
      t0,
    );
    tl.fromTo(this.fx, { flash: 0 }, { flash: 1 + tier * 0.3, duration: 0.07, ease: 'none' }, t0);
    tl.to(this.fx, { flash: 0, duration: 0.8, ease: 'power2.out' }, t0 + 0.07);
    tl.fromTo(this.fx, { ring: 0 }, { ring: 1, duration: 1.05, ease: 'none' }, t0);
    tl.to(this.fx, { dim: 1, duration: 0.9 }, t0 + 0.1);
    tl.to(this.itemKick.position, { y: 0, duration: 1.2, ease: 'expo.out' }, t0);
    tl.to(this.itemKick.scale, { x: 1, y: 1, z: 1, duration: 1.0, ease: 'expo.out' }, t0);
    tl.to(this.itemSpin, { yaw: -0.45, duration: 1.5, ease: 'expo.out' }, t0);
    await tl;
    this.mode = 'result';
    this.itemSpin.auto = 0.22;
    this.itemSpin.touch();
  }

  /** Put the drop away and reset the case. */
  async dismissDrop(next: 'vault' | 'backdrop' = 'vault'): Promise<void> {
    const tl = gsap.timeline();
    this.itemSpin.auto = 0;
    if (this.item) {
      tl.to(this.itemKick.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.3, ease: 'power2.in' }, 0);
      tl.to(this.itemKick.position, { y: 0.35, duration: 0.3, ease: 'power2.in' }, 0);
    }
    // The case went below the floor during the reveal: close it down there, then bring it back up.
    this.fx.glow = 0;
    this.fx.column = 0;
    this.fx.lid = 0;
    this.fx.latch = 0;
    tl.call(() => audio.whoosh(0.5), [], 0.12);
    tl.to(this.caseLift.position, { y: 0, duration: 0.6, ease: 'back.out(1.2)' }, 0.15);
    this.applyRestShot(next);
    await tl;
    this.unmountItem();
    this.mode = next;
    this.caseSpin.auto = 0.16;
    this.caseSpin.touch();
  }

  /* ---------------------------------------------------------------- */
  /* Inspect                                                           */
  /* ---------------------------------------------------------------- */

  async enterInspect(spec: ItemSpec): Promise<void> {
    const sameItem = this.item && this.itemSpec && this.itemSpec.skinId === spec.skinId && this.itemSpec.seed === spec.seed && this.itemSpec.float === spec.float && this.itemSpec.tally === spec.tally;
    this.mode = 'inspect';
    this.caseSpin.auto = 0;
    gsap.to(this.caseLift.position, { y: -0.6, duration: 0.4, ease: 'power2.in', overwrite: true });
    gsap.to(this.fx, { glow: 0, column: 0, lid: 0, latch: 0, duration: 0.3, overwrite: true });
    if (!sameItem) {
      this.mountItem(spec);
      this.itemKick.position.set(0, -0.25, 0);
      this.itemKick.scale.setScalar(0.6);
      this.itemSpin.set(-0.45 - 1.6, 0.1);
      this.itemSpin.face(-0.45, 0.1);
      gsap.to(this.itemKick.position, { y: 0, duration: 0.7, ease: 'expo.out' });
      gsap.to(this.itemKick.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'expo.out' });
      audio.whoosh(0.7);
    }
    this.itemSpin.auto = 0.2;
    this.cam.zoom = 1;
    this.cam.setShot(this.itemShot());
    this.setItemZoomRange();
  }

  /** Swap wear / seed on the inspected item without rebuilding it (collection preview). */
  retuneItem(spec: ItemSpec) {
    if (!this.item || !this.itemSpec) return;
    if (this.itemSpec.skinId !== spec.skinId || this.itemSpec.seed !== spec.seed || this.itemSpec.tally !== spec.tally) {
      const yaw = this.itemSpin.yaw;
      const pitch = this.itemSpin.pitch;
      this.mountItem(spec);
      this.itemSpin.set(yaw, pitch);
    } else {
      updateItemObject(this.item, { float: spec.float, seed: spec.seed, count: spec.count });
      this.itemSpec = spec;
    }
  }

  setItemCount(count: number) {
    if (this.item) updateItemObject(this.item, { count });
  }

  async exitInspect(next: 'vault' | 'backdrop'): Promise<void> {
    this.itemSpin.auto = 0;
    this.applyRestShot(next);
    gsap.to(this.caseLift.position, { y: 0, duration: 0.6, ease: 'back.out(1.2)', delay: 0.15, overwrite: true });
    if (this.item) {
      await gsap.to(this.itemKick.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.25, ease: 'power2.in' });
      this.unmountItem();
    }
    this.mode = next;
    this.caseSpin.auto = 0.16;
  }

  setRest(next: 'vault' | 'backdrop') {
    if (this.mode === 'vault' || this.mode === 'backdrop') {
      this.mode = next;
      this.applyRestShot(next);
    }
  }

  private applyRestShot(next: 'vault' | 'backdrop') {
    this.cam.zoom = 1;
    this.cam.zoomRange = next === 'vault' ? [0.72, 1.25] : [1, 1];
    this.cam.setShot(SHOTS[next]);
  }

  /* ---------------------------------------------------------------- */
  /* Test fire                                                         */
  /* ---------------------------------------------------------------- */

  /** Dry-fire the inspected item. Returns what happened so the UI can count it. */
  fire(): 'shot' | 'flourish' | null {
    if (!this.item || !this.itemSpec || this.busy) return null;
    if (this.mode !== 'inspect' && this.mode !== 'result') return null;
    const weapon = WEAPONS[SKINS[this.itemSpec.skinId].weapon];
    this.itemSpin.touch();
    if (weapon.kind === 'Knife') {
      this.busy = true;
      audio.fire('blade');
      gsap.to(this.itemKick.rotation, {
        x: this.itemKick.rotation.x + Math.PI * 2,
        duration: 0.62,
        ease: 'power3.inOut',
        onComplete: () => {
          this.itemKick.rotation.x = 0;
          this.busy = false;
        },
      });
      return 'flourish';
    }
    audio.fire(weapon.report);
    const heavy = weapon.report === 'heavy' || weapon.report === 'shotgun' || weapon.report === 'magnum' ? 1.6 : 1;
    const len = this.itemSize.x;
    gsap.killTweensOf(this.itemKick.position);
    gsap.killTweensOf(this.itemKick.rotation);
    this.itemKick.position.set(0, 0, 0);
    this.itemKick.rotation.set(0, 0, 0);
    gsap.timeline()
      .to(this.itemKick.position, { x: -0.028 * heavy, duration: 0.04, ease: 'power2.out' }, 0)
      .to(this.itemKick.rotation, { z: (0.028 * heavy) / Math.max(0.25, len), duration: 0.05, ease: 'power2.out' }, 0)
      .to(this.itemKick.position, { x: 0, duration: 0.55, ease: 'elastic.out(1, 0.5)' }, 0.05)
      .to(this.itemKick.rotation, { z: 0, duration: 0.6, ease: 'elastic.out(1, 0.45)' }, 0.05);
    gsap.fromTo(this.fx, { muzzle: 1 }, { muzzle: 0, duration: 0.11, ease: 'power2.out', overwrite: 'auto' });
    const a = this.item.userData.anchors.muzzle;
    if (a) {
      this.item.updateWorldMatrix(true, false);
      const p = this.tmp.copy(a.pos);
      this.item.localToWorld(p);
      this.muzzle.sprite.position.copy(p);
      this.muzzleLight.position.copy(p);
      this.sparks.burst(p, 0xffc070, 22, 1.8 * heavy, 0.1, 0.32, 5);
    }
    return 'shot';
  }

  /* ---------------------------------------------------------------- */
  /* Photo mode                                                        */
  /* ---------------------------------------------------------------- */

  setEnv(preset: EnvPreset) {
    this.scene.environment = this.envs.get(preset);
  }

  setBackdropVisible(visible: boolean) {
    this.set.group.visible = visible;
    this.dust.points.visible = visible;
    this.ceiling.mesh.visible = visible;
    (this.scene.fog as THREE.FogExp2).density = visible ? 0.085 : 0;
    this.scene.environmentIntensity = visible ? 0.95 : 1.25;
  }

  /* ---------------------------------------------------------------- */
  /* Internals                                                         */
  /* ---------------------------------------------------------------- */

  private mountItem(spec: ItemSpec) {
    this.unmountItem();
    const obj = createItemObject(spec);
    obj.userData.bounds.getSize(this.itemSize);
    this.itemKick.add(obj);
    this.itemKick.position.set(0, 0, 0);
    this.itemKick.rotation.set(0, 0, 0);
    this.itemKick.scale.setScalar(1);
    this.item = obj;
    this.itemSpec = spec;
  }

  private unmountItem() {
    if (this.item) disposeItemObject(this.item);
    this.item = null;
    this.itemSpec = null;
    gsap.killTweensOf(this.itemKick.position);
    gsap.killTweensOf(this.itemKick.rotation);
    gsap.killTweensOf(this.itemKick.scale);
    this.busy = false;
  }

  private itemShot(): Shot {
    const d = fitDistance(this.itemSize, 30, this.camera.aspect, 1.42);
    return { target: V(0, ITEM_Y, 0), theta: 0, phi: 1.46, radius: Math.max(0.5, d), fov: 30, fitted: true };
  }

  private setItemZoomRange() {
    this.cam.zoom = 1;
    this.cam.zoomRange = [0.3, 1.5];
  }

  update(dt: number, time: number) {
    // colour smoothing
    const k = 1 - Math.exp(-9 * dt);
    this.glowColor.lerp(this.glowGoal, k);
    this.accent.lerp(this.accentGoal, 1 - Math.exp(-3 * dt));
    if (this.reelGlow !== null) this.fx.glow += (this.reelGlow - this.fx.glow) * k;

    const f = this.fx;
    if (this.caseRig) {
      this.caseRig.setLid(f.lid);
      this.caseRig.setLatches(f.latch);
      this.caseRig.setGlow(this.glowColor, f.glow);
      const s = f.shake * 0.006;
      this.caseRig.root.position.set((Math.random() - 0.5) * s, Math.abs(Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    if (this.charging) {
      this.charging += dt;
      if (Math.random() < 0.6) this.sparks.burst(this.tmp.set(0, 0.17, 0), this.glowColor, 3, 1.2 + f.shake * 1.8, 0.95, 0.9, 6);
    }
    this.column.set(this.glowColor, f.column);
    (this.column.mesh.material.uniforms.uTime as THREE.IUniform).value = time;
    (this.ceiling.mesh.material.uniforms.uTime as THREE.IUniform).value = time;
    this.ring.set(this.glowColor, f.ring, 2.7);
    this.ring2.set(this.glowColor, f.ring2, 3.6);
    this.flash.sprite.position.set(0, 0.3 + f.lid * 0.25, 0.1);
    this.flash.set(this.glowColor, f.flash, 1.4 + f.flash * 1.6);
    this.muzzle.set(0xffc880, f.muzzle * 1.4, 0.16 + f.muzzle * 0.2);
    this.muzzleLight.intensity = f.muzzle * 14;
    this.dust.setGlow(this.glowColor, Math.min(1, f.glow * 0.5));

    this.set.key.intensity = this.keyBase * f.dim;
    this.set.rimCool.intensity = this.rimCoolBase * (0.35 + 0.65 * f.dim);
    this.set.rimWarm.intensity = this.rimWarmBase * (0.35 + 0.65 * f.dim);
    setAccent(this.set, this.accent, 0.4 + 0.6 * f.dim);
    this.set.wheel.rotation.z = time * 0.02;

    this.caseSpin.update(dt);
    this.itemSpin.update(dt);
    this.set.turntable.quaternion.copy(this.caseSpin.group.quaternion);
    this.itemLift.position.y = ITEM_Y + Math.sin(time * 0.9) * 0.007;

    this.dust.update(time, this.size.y);
    this.sparks.update(dt, this.size.y);
    this.cam.update(dt, time);
  }

  dispose() {
    this.unmountItem();
    this.caseRig?.dispose();
    this.set.dispose();
    this.dust.dispose();
    this.sparks.dispose();
  }
}
