/**
 * Camera and subject rigs.
 *
 * The camera never orbits freely: the vault behind the pedestal is a composed
 * backdrop. Instead the player spins the subject (the case on its turntable,
 * or an item floating above it) while the camera handles framing, zoom and a
 * little pointer parallax.
 */
import * as THREE from 'three';

export interface Shot {
  target: THREE.Vector3Like;
  /** Azimuth around the target, radians (0 = straight on from +Z). */
  theta: number;
  /** Polar angle from straight up, radians. */
  phi: number;
  radius: number;
  fov?: number;
  /** The radius was already fitted to the viewport: skip the narrow-screen pull-back. */
  fitted?: boolean;
}

const damp = (cur: number, goal: number, k: number, dt: number) => cur + (goal - cur) * (1 - Math.exp(-k * dt));

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private cur = { tx: 0, ty: 0.2, tz: 0, theta: 0, phi: 1.2, radius: 2.4, fov: 30, ox: 0, oy: 0 };
  private goal = { ...this.cur };
  /** Multiplier on radius from user zoom. */
  zoom = 1;
  private zoomCur = 1;
  zoomRange: [number, number] = [1, 1];
  /** Pointer parallax amount in radians at the screen edge. */
  parallax = 0.05;
  private px = 0;
  private py = 0;
  stiffness = 5.5;
  /** Handheld drift. */
  drift = 1;
  private size = new THREE.Vector2(1, 1);
  private fitted = false;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  setShot(s: Shot, instant = false) {
    this.goal.tx = s.target.x;
    this.goal.ty = s.target.y;
    this.goal.tz = s.target.z;
    this.goal.theta = s.theta;
    this.goal.phi = s.phi;
    this.goal.radius = s.radius;
    if (s.fov) this.goal.fov = s.fov;
    this.fitted = !!s.fitted;
    if (instant) {
      const { ox, oy } = this.cur;
      Object.assign(this.cur, this.goal, { ox, oy });
      this.zoomCur = this.zoom;
    }
  }

  /** Shift the subject away from screen centre, in pixels (to clear UI panels). */
  setScreenOffset(x: number, y: number) {
    this.goal.ox = x;
    this.goal.oy = y;
  }

  setPointer(nx: number, ny: number) {
    this.px = nx;
    this.py = ny;
  }

  addZoom(factor: number) {
    this.zoom = THREE.MathUtils.clamp(this.zoom * factor, this.zoomRange[0], this.zoomRange[1]);
  }

  resize(w: number, h: number) {
    this.size.set(w, h);
    this.camera.aspect = w / h;
  }

  get radius() {
    return this.cur.radius * this.zoomCur;
  }

  update(dt: number, time: number) {
    const c = this.cur;
    const g = this.goal;
    const k = this.stiffness;
    c.tx = damp(c.tx, g.tx, k, dt);
    c.ty = damp(c.ty, g.ty, k, dt);
    c.tz = damp(c.tz, g.tz, k, dt);
    c.theta = damp(c.theta, g.theta, k, dt);
    c.phi = damp(c.phi, g.phi, k, dt);
    c.radius = damp(c.radius, g.radius, k, dt);
    c.fov = damp(c.fov, g.fov, k, dt);
    c.ox = damp(c.ox, g.ox, 6, dt);
    c.oy = damp(c.oy, g.oy, 6, dt);
    this.zoomCur = damp(this.zoomCur, this.zoom, 9, dt);

    const d = this.drift;
    const theta = c.theta + this.px * this.parallax + Math.sin(time * 0.21) * 0.012 * d;
    const phi = THREE.MathUtils.clamp(c.phi - this.py * this.parallax * 0.6 + Math.sin(time * 0.17 + 1.3) * 0.008 * d, 0.2, 1.62);
    // Narrow viewports need more distance to keep the subject in frame.
    const aspectFix = !this.fitted && this.camera.aspect < 1.15 ? 1.15 / this.camera.aspect : 1;
    const r = c.radius * this.zoomCur * Math.pow(aspectFix, 0.85);
    const sp = Math.sin(phi);
    this.camera.position.set(c.tx + r * sp * Math.sin(theta), c.ty + r * Math.cos(phi), c.tz + r * sp * Math.cos(theta));
    this.camera.lookAt(c.tx, c.ty, c.tz);
    if (Math.abs(this.camera.fov - c.fov) > 0.01) this.camera.fov = c.fov;
    if (Math.abs(c.ox) > 0.5 || Math.abs(c.oy) > 0.5) this.camera.setViewOffset(this.size.x, this.size.y, -c.ox, -c.oy, this.size.x, this.size.y);
    else if (this.camera.view?.enabled) this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }
}

/** Drag-to-spin for whatever is on the pedestal. */
export class SpinRig {
  readonly group = new THREE.Group();
  yaw = 0;
  pitch = 0;
  private yawCur = 0;
  private pitchCur = 0;
  /** Idle auto-rotation in rad/s. */
  auto = 0;
  pitchRange: [number, number] = [0, 0];
  private idle = 10;
  private vel = 0;
  private qy = new THREE.Quaternion();
  private qx = new THREE.Quaternion();
  private static X = new THREE.Vector3(1, 0, 0);
  private static Y = new THREE.Vector3(0, 1, 0);

  drag(dx: number, dy: number) {
    this.yaw += dx;
    this.vel = dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy, this.pitchRange[0], this.pitchRange[1]);
    this.idle = 0;
  }

  /** Snap targets without animation. */
  set(yaw: number, pitch = 0) {
    this.yaw = this.yawCur = yaw;
    this.pitch = this.pitchCur = pitch;
  }

  /** Rotate to the nearest equivalent of `yaw` (so the subject never unwinds several turns). */
  face(yaw: number, pitch = 0) {
    const turns = Math.round((this.yaw - yaw) / (Math.PI * 2));
    this.yaw = yaw + turns * Math.PI * 2;
    this.pitch = pitch;
    this.idle = -2;
  }

  touch() {
    this.idle = 0;
  }

  update(dt: number) {
    this.idle += dt;
    if (this.auto && this.idle > 2.6) this.yaw += this.auto * dt * Math.min(1, (this.idle - 2.6) / 1.5);
    this.yawCur = damp(this.yawCur, this.yaw, 11, dt);
    this.pitchCur = damp(this.pitchCur, this.pitch, 11, dt);
    this.qy.setFromAxisAngle(SpinRig.Y, this.yawCur);
    this.qx.setFromAxisAngle(SpinRig.X, this.pitchCur);
    this.group.quaternion.copy(this.qx).multiply(this.qy);
  }
}

/** Distance at which a box of the given size fills the frame at the given fov / aspect. */
export function fitDistance(size: THREE.Vector3, fovDeg: number, aspect: number, margin = 1.25): number {
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  const tanH = tanV * aspect;
  // The subject spins, so fit its longest horizontal dimension, but let height drive tall frames.
  const halfW = Math.max(size.x, size.z * 0.6) / 2;
  const halfH = Math.max(size.y, size.x * 0.28) / 2;
  return Math.max(halfW / tanH, halfH / tanV) * margin + size.z / 2;
}
