/**
 * Hard-surface modelling kit.
 *
 * Every weapon in Strongroom is authored in code from a handful of primitives:
 *   - plate : a filleted 2D profile extruded with a rounded bevel (optionally with
 *             through-holes and shallow pockets)
 *   - lathe : a profile revolved around an axis (barrels, pins, lenses)
 *   - loft  : rounded-rectangle cross-sections swept along an axis (stocks, grips)
 *   - rail  : accessory rail with teeth
 *
 * All authoring is done in millimetres. X points toward the muzzle, Y is up and
 * +Z is the shooter's right-hand side (the side the camera sees by default).
 *
 * Geometry is emitted non-indexed with area-weighted, crease-aware normals. That
 * is what makes small bevels catch a clean highlight instead of smearing a
 * gradient across the large flat faces next to them.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type V2 = THREE.Vector2;
/** x, y and an optional fillet radius for that corner. */
export type P2 = readonly [number, number, number?];

const v2 = (x: number, y: number) => new THREE.Vector2(x, y);
const DEG = Math.PI / 180;

/* ------------------------------------------------------------------ */
/* 2D outlines                                                         */
/* ------------------------------------------------------------------ */

const arcRes = (r: number) => THREE.MathUtils.clamp(Math.round(1.5 + Math.sqrt(r) * 1.3), 2, 12);

function dedupe(pts: V2[], eps = 1e-3): V2[] {
  const out: V2[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || last.distanceToSquared(p) > eps * eps) out.push(p);
  }
  while (out.length > 2 && out[0].distanceToSquared(out[out.length - 1]) <= eps * eps) out.pop();
  return out;
}

/** Closed polygon with per-corner fillets, returned as a polyline. */
export function poly(pts: readonly P2[], defR = 0): V2[] {
  const n = pts.length;
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    let r = p1[2] ?? defR;
    const ax = p0[0] - p1[0];
    const ay = p0[1] - p1[1];
    const bx = p2[0] - p1[0];
    const by = p2[1] - p1[1];
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (r <= 0 || la < 1e-6 || lb < 1e-6) {
      out.push(v2(p1[0], p1[1]));
      continue;
    }
    const ux = ax / la;
    const uy = ay / la;
    const wx = bx / lb;
    const wy = by / lb;
    const theta = Math.acos(THREE.MathUtils.clamp(ux * wx + uy * wy, -1, 1));
    if (theta < 0.03 || Math.PI - theta < 0.03) {
      out.push(v2(p1[0], p1[1]));
      continue;
    }
    let d = r / Math.tan(theta / 2);
    const dMax = Math.min(la, lb) * 0.5;
    if (d > dMax) {
      d = dMax;
      r = d * Math.tan(theta / 2);
    }
    const t1x = p1[0] + ux * d;
    const t1y = p1[1] + uy * d;
    const t2x = p1[0] + wx * d;
    const t2y = p1[1] + wy * d;
    let bsx = ux + wx;
    let bsy = uy + wy;
    const bl = Math.hypot(bsx, bsy);
    bsx /= bl;
    bsy /= bl;
    const cd = r / Math.sin(theta / 2);
    const cx = p1[0] + bsx * cd;
    const cy = p1[1] + bsy * cd;
    const a1 = Math.atan2(t1y - cy, t1x - cx);
    let da = Math.atan2(t2y - cy, t2x - cx) - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    const segs = Math.max(1, Math.ceil((Math.abs(da) / (Math.PI / 2)) * arcRes(r)));
    for (let k = 0; k <= segs; k++) {
      const a = a1 + (da * k) / segs;
      out.push(v2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  }
  return dedupe(out);
}

export function rect(x: number, y: number, w: number, h: number, r = 0): V2[] {
  return poly(
    [
      [x, y, r],
      [x + w, y, r],
      [x + w, y + h, r],
      [x, y + h, r],
    ],
    0,
  );
}

export function circle(cx: number, cy: number, r: number, segs = 0): V2[] {
  const n = segs || Math.max(10, arcRes(r) * 4);
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(v2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return out;
}

/** Stadium / slot between two centres. */
export function slot(x0: number, y0: number, x1: number, y1: number, r: number): V2[] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const base = Math.atan2(dy, dx);
  const n = Math.max(4, arcRes(r) * 2);
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = base - Math.PI / 2 + (i / n) * Math.PI;
    out.push(v2(x1 + Math.cos(a) * r, y1 + Math.sin(a) * r));
  }
  for (let i = 0; i <= n; i++) {
    const a = base + Math.PI / 2 + (i / n) * Math.PI;
    out.push(v2(x0 + Math.cos(a) * r, y0 + Math.sin(a) * r));
  }
  return dedupe(out);
}

/** Smooth closed or open curve through points (centripetal Catmull-Rom). */
export function smooth(pts: readonly (readonly [number, number])[], closed = true, perSeg = 8): V2[] {
  const curve = new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(p[0], p[1], 0)),
    closed,
    'centripetal',
  );
  const n = (closed ? pts.length : pts.length - 1) * perSeg;
  const out: V2[] = [];
  const total = closed ? n : n + 1;
  for (let i = 0; i < total; i++) {
    const p = curve.getPoint(i / n);
    out.push(v2(p.x, p.y));
  }
  return out;
}

/** Translate / mirror helpers for outlines. */
export const shift = (pts: V2[], dx: number, dy: number) => pts.map((p) => v2(p.x + dx, p.y + dy));
export const rotate2 = (pts: V2[], deg: number, cx = 0, cy = 0) => {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return pts.map((p) => v2(cx + (p.x - cx) * c - (p.y - cy) * s, cy + (p.x - cx) * s + (p.y - cy) * c));
};

/* ------------------------------------------------------------------ */
/* Normals                                                             */
/* ------------------------------------------------------------------ */

/**
 * Area-weighted vertex normals with a crease angle. Returns a non-indexed
 * geometry holding only `position` and `normal`. Degenerate triangles are dropped.
 */
export function hsNormals(input: THREE.BufferGeometry, creaseDeg = 42): THREE.BufferGeometry {
  const src = input.index ? input.toNonIndexed() : input;
  const P = (src.getAttribute('position') as THREE.BufferAttribute).array as ArrayLike<number>;
  const triIn = Math.floor(P.length / 9);

  const pos = new Float32Array(triIn * 9);
  const fn = new Float32Array(triIn * 3);
  const fa = new Float32Array(triIn);
  let t = 0;
  for (let i = 0; i < triIn; i++) {
    const o = i * 9;
    const ax = P[o];
    const ay = P[o + 1];
    const az = P[o + 2];
    const e1x = P[o + 3] - ax;
    const e1y = P[o + 4] - ay;
    const e1z = P[o + 5] - az;
    const e2x = P[o + 6] - ax;
    const e2y = P[o + 7] - ay;
    const e2z = P[o + 8] - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-7) continue;
    for (let k = 0; k < 9; k++) pos[t * 9 + k] = P[o + k];
    fn[t * 3] = nx / len;
    fn[t * 3 + 1] = ny / len;
    fn[t * 3 + 2] = nz / len;
    fa[t] = len * 0.5;
    t++;
  }
  const tri = t;
  const vCount = tri * 3;

  // Bucket corners by quantised position.
  const buckets = new Map<string, number[]>();
  const keyOf = new Array<number[]>(vCount);
  for (let v = 0; v < vCount; v++) {
    const k = `${Math.round(pos[v * 3] * 200)}_${Math.round(pos[v * 3 + 1] * 200)}_${Math.round(pos[v * 3 + 2] * 200)}`;
    let list = buckets.get(k);
    if (!list) {
      list = [];
      buckets.set(k, list);
    }
    list.push(v);
    keyOf[v] = list;
  }

  const cosCrease = Math.cos(creaseDeg * DEG);
  const nrm = new Float32Array(vCount * 3);
  for (let v = 0; v < vCount; v++) {
    const f = (v / 3) | 0;
    const fx = fn[f * 3];
    const fy = fn[f * 3 + 1];
    const fz = fn[f * 3 + 2];
    let sx = 0;
    let sy = 0;
    let sz = 0;
    const list = keyOf[v];
    for (let i = 0; i < list.length; i++) {
      const g = (list[i] / 3) | 0;
      const gx = fn[g * 3];
      const gy = fn[g * 3 + 1];
      const gz = fn[g * 3 + 2];
      if (gx * fx + gy * fy + gz * fz >= cosCrease) {
        const w = fa[g];
        sx += gx * w;
        sy += gy * w;
        sz += gz * w;
      }
    }
    const l = Math.hypot(sx, sy, sz) || 1;
    nrm[v * 3] = sx / l;
    nrm[v * 3 + 1] = sy / l;
    nrm[v * 3 + 2] = sz / l;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, vCount * 3), 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return out;
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export type Plane = 'xy' | 'xz' | 'zy';

export interface PlateOpts {
  /** Total thickness along the extrusion axis. */
  t: number;
  /** Bevel radius (default 0.7). */
  bevel?: number;
  bevelSegs?: number;
  /** Centre offset along the extrusion axis. */
  at?: number;
  /** Profile plane. xy extrudes along Z, xz along Y, zy along X. */
  plane?: Plane;
  holes?: V2[][];
  crease?: number;
}

function orient(geo: THREE.BufferGeometry, plane: Plane, at: number): THREE.BufferGeometry {
  if (plane === 'xz') {
    geo.rotateX(Math.PI / 2); // (u, v, w) -> (u, -w, v)
    geo.translate(0, at, 0);
  } else if (plane === 'zy') {
    geo.rotateY(-Math.PI / 2); // (u, v, w) -> (-w, v, u)
    geo.translate(at, 0, 0);
  } else {
    geo.translate(0, 0, at);
  }
  return geo;
}

/** Extrude an outline into a bevelled plate centred on the extrusion axis. */
export function plate(outline: V2[], o: PlateOpts): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline);
  for (const h of o.holes ?? []) shape.holes.push(new THREE.Path(h));
  const segs = o.bevelSegs ?? 2;
  const b = Math.max(0, Math.min(o.bevel ?? 0.7, o.t / 2 - 0.02));
  const geo =
    b > 0.02
      ? new THREE.ExtrudeGeometry(shape, {
          depth: o.t - 2 * b,
          bevelEnabled: true,
          bevelThickness: b,
          bevelSize: b,
          bevelOffset: -b,
          bevelSegments: segs,
          steps: 1,
          curveSegments: 1,
        })
      : new THREE.ExtrudeGeometry(shape, { depth: o.t, bevelEnabled: false, steps: 1, curveSegments: 1 });
  geo.translate(0, 0, -(o.t - 2 * (b > 0.02 ? b : 0)) / 2);
  const g = hsNormals(geo, o.crease ?? 44);
  geo.dispose();
  return orient(g, o.plane ?? 'xy', o.at ?? 0);
}

export interface LatheOpts {
  y?: number;
  z?: number;
  segs?: number;
  crease?: number;
  /** Partial revolution in degrees (default 360). */
  arc?: number;
  arcStart?: number;
}

/**
 * Revolve a profile of [x, radius] points around the X axis. Walk the profile
 * so that the solid is on the right-hand side of the direction of travel
 * (outer surface with x increasing, bores with x decreasing).
 */
export function lathe(profile: readonly (readonly [number, number])[], o: LatheOpts = {}): THREE.BufferGeometry {
  const maxR = profile.reduce((m, p) => Math.max(m, p[1]), 0);
  const segs = o.segs ?? THREE.MathUtils.clamp(Math.round(14 + maxR * 1.1), 16, 56);
  const arc = (o.arc ?? 360) * DEG;
  const a0 = (o.arcStart ?? 0) * DEG;
  const cy = o.y ?? 0;
  const cz = o.z ?? 0;
  const tris: number[] = [];
  const pt = (i: number, j: number) => {
    const a = a0 + (j / segs) * arc;
    return [profile[i][0], cy + profile[i][1] * Math.cos(a), cz + profile[i][1] * Math.sin(a)] as const;
  };
  for (let i = 0; i < profile.length - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const A = pt(i, j);
      const B = pt(i + 1, j);
      const C = pt(i + 1, j + 1);
      const D = pt(i, j + 1);
      tris.push(...A, ...D, ...C, ...A, ...C, ...B);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
  const out = hsNormals(g, o.crease ?? 38);
  g.dispose();
  return out;
}

/** Simple solid cylinder along X with chamfered ends. */
export function rod(x0: number, x1: number, r: number, o: LatheOpts & { chamfer?: number } = {}): THREE.BufferGeometry {
  const c = Math.min(o.chamfer ?? Math.min(0.6, r * 0.2), r * 0.9, Math.abs(x1 - x0) / 2);
  return lathe(
    [
      [x0, 0],
      [x0, r - c],
      [x0 + c, r],
      [x1 - c, r],
      [x1, r - c],
      [x1, 0],
    ],
    o,
  );
}

/** Hollow tube along X (shows a bore at both ends). */
export function tube(x0: number, x1: number, r: number, bore: number, o: LatheOpts & { chamfer?: number; depth?: number } = {}): THREE.BufferGeometry {
  const c = Math.min(o.chamfer ?? 0.5, (r - bore) * 0.45);
  const d = o.depth ?? Math.min(Math.abs(x1 - x0) * 0.45, bore * 6);
  return lathe(
    [
      [x0 + d, 0],
      [x0 + d, bore],
      [x0, bore],
      [x0, r - c],
      [x0 + c, r],
      [x1 - c, r],
      [x1, r - c],
      [x1, bore],
      [x1 - d, bore],
      [x1 - d, 0],
    ],
    o,
  );
}

export interface Sec {
  /** Position along the loft axis (X). */
  x: number;
  /** Centre offset. */
  y?: number;
  z?: number;
  /** Width along Z and height along Y. */
  w: number;
  h: number;
  /** Corner radius; rt / rb override the top / bottom pair. */
  r?: number;
  rt?: number;
  rb?: number;
}

export interface LoftOpts {
  capA?: boolean;
  capB?: boolean;
  /** Segments per corner. */
  k?: number;
  crease?: number;
}

/** Sweep rounded-rectangle cross-sections along X. */
export function loft(secs: readonly Sec[], o: LoftOpts = {}): THREE.BufferGeometry {
  const k = o.k ?? 5;
  const N = 4 * (k + 1);
  const rings: number[][] = [];
  for (const s of secs) {
    const a = s.w / 2;
    const b = s.h / 2;
    const lim = Math.min(a, b);
    const rt = Math.min(s.rt ?? s.r ?? lim * 0.35, lim);
    const rb = Math.min(s.rb ?? s.r ?? lim * 0.35, lim);
    const cy = s.y ?? 0;
    const cz = s.z ?? 0;
    const ring: number[] = [];
    const corner = (czc: number, cyc: number, r: number, start: number) => {
      for (let i = 0; i <= k; i++) {
        const a2 = (start + (i / k) * 90) * DEG;
        ring.push(s.x, cy + cyc + Math.cos(a2) * r, cz + czc + Math.sin(a2) * r);
      }
    };
    corner(a - rt, b - rt, rt, 0);
    corner(a - rb, -(b - rb), rb, 90);
    corner(-(a - rb), -(b - rb), rb, 180);
    corner(-(a - rt), b - rt, rt, 270);
    rings.push(ring);
  }
  const tris: number[] = [];
  const P = (ring: number[], j: number) => {
    const o3 = (j % N) * 3;
    return [ring[o3], ring[o3 + 1], ring[o3 + 2]] as const;
  };
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < N; j++) {
      const A = P(rings[i], j);
      const B = P(rings[i + 1], j);
      const C = P(rings[i + 1], j + 1);
      const D = P(rings[i], j + 1);
      tris.push(...A, ...D, ...C, ...A, ...C, ...B);
    }
  }
  const cap = (ring: number[], s: Sec, flip: boolean) => {
    const c = [s.x, s.y ?? 0, s.z ?? 0] as const;
    for (let j = 0; j < N; j++) {
      const A = P(ring, j);
      const B = P(ring, j + 1);
      if (flip) tris.push(...c, ...A, ...B);
      else tris.push(...c, ...B, ...A);
    }
  };
  if (o.capA !== false) cap(rings[0], secs[0], false);
  if (o.capB !== false) cap(rings[rings.length - 1], secs[secs.length - 1], true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
  const out = hsNormals(g, o.crease ?? 50);
  g.dispose();
  return out;
}

/** Rounded box: a plate in the xy plane. */
export function box(x0: number, y0: number, x1: number, y1: number, t: number, o: Partial<PlateOpts> & { r?: number } = {}): THREE.BufferGeometry {
  return plate(rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0), o.r ?? 0.6), {
    t,
    bevel: 0.5,
    ...o,
  });
}

/** Accessory rail along X. yBase is the underside. Flip with `down` for under-rails. */
export function rail(x0: number, x1: number, yBase: number, o: { w?: number; pitch?: number; tooth?: number; down?: boolean; z?: number } = {}): THREE.BufferGeometry[] {
  const hw = (o.w ?? 21.2) / 2;
  const pitch = o.pitch ?? 10;
  const tooth = o.tooth ?? 5.3;
  const s = o.down ? -1 : 1;
  const zc = o.z ?? 0;
  const base = poly([
    [-hw + 3, 0],
    [hw - 3, 0],
    [hw, 3 * s],
    [hw, 5.4 * s],
    [-hw, 5.4 * s],
    [-hw, 3 * s],
  ]);
  const top = poly([
    [-hw, 5.2 * s],
    [hw, 5.2 * s],
    [hw, 6.0 * s],
    [hw - 2.6, 8.8 * s],
    [-hw + 2.6, 8.8 * s],
    [-hw, 6.0 * s],
  ]);
  const out: THREE.BufferGeometry[] = [];
  const len = x1 - x0;
  const baseGeo = plate(base, { t: len, plane: 'zy', at: x0 + len / 2, bevel: 0.25, bevelSegs: 1 });
  baseGeo.translate(0, yBase, zc);
  out.push(baseGeo);
  const n = Math.max(1, Math.floor((len - tooth) / pitch) + 1);
  const start = x0 + (len - ((n - 1) * pitch + tooth)) / 2 + tooth / 2;
  const proto = plate(top, { t: tooth, plane: 'zy', at: 0, bevel: 0.3, bevelSegs: 1 });
  for (let i = 0; i < n; i++) {
    const g = proto.clone();
    g.translate(start + i * pitch, yBase, zc);
    out.push(g);
  }
  proto.dispose();
  return out;
}

/* ------------------------------------------------------------------ */
/* Transforms                                                          */
/* ------------------------------------------------------------------ */

export interface Xf {
  x?: number;
  y?: number;
  z?: number;
  /** Euler rotation in degrees, applied X then Y then Z about `pivot` (default origin). */
  rx?: number;
  ry?: number;
  rz?: number;
  pivot?: readonly [number, number, number];
  s?: number | readonly [number, number, number];
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

export function xf<T extends THREE.BufferGeometry>(geo: T, t: Xf): T {
  if (t.s !== undefined) {
    const s = typeof t.s === 'number' ? ([t.s, t.s, t.s] as const) : t.s;
    geo.scale(s[0], s[1], s[2]);
    if (s[0] * s[1] * s[2] < 0) flipWinding(geo);
  }
  if (t.rx || t.ry || t.rz) {
    const p = t.pivot ?? [0, 0, 0];
    geo.translate(-p[0], -p[1], -p[2]);
    _e.set((t.rx ?? 0) * DEG, (t.ry ?? 0) * DEG, (t.rz ?? 0) * DEG, 'XYZ');
    _m.makeRotationFromQuaternion(_q.setFromEuler(_e));
    geo.applyMatrix4(_m);
    geo.translate(p[0], p[1], p[2]);
  }
  if (t.x || t.y || t.z) geo.translate(t.x ?? 0, t.y ?? 0, t.z ?? 0);
  return geo;
}

function flipWinding(geo: THREE.BufferGeometry) {
  for (const name of ['position', 'normal']) {
    const a = geo.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!a) continue;
    const arr = a.array as Float32Array;
    for (let i = 0; i < arr.length; i += 9) {
      for (let k = 0; k < 3; k++) {
        const tmp = arr[i + 3 + k];
        arr[i + 3 + k] = arr[i + 6 + k];
        arr[i + 6 + k] = tmp;
      }
    }
    a.needsUpdate = true;
  }
}

/** Mirror a geometry across the XY plane (z -> -z), returning a new geometry. */
export function mirrorZ(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.clone();
  g.scale(1, 1, -1);
  flipWinding(g);
  return g;
}

/** Re-point an X-axis primitive along Z or Y. */
export const alongZ = <T extends THREE.BufferGeometry>(g: T) => g.rotateY(-Math.PI / 2) as T; // +x -> +z
export const alongY = <T extends THREE.BufferGeometry>(g: T) => g.rotateZ(Math.PI / 2) as T; // +x -> +y

/** A pin / rivet head through the body along Z, visible on both sides. */
export function pinZ(x: number, y: number, r: number, halfZ: number, proud = 0.5): THREE.BufferGeometry {
  const g = alongZ(rod(-(halfZ + proud), halfZ + proud, r, { chamfer: Math.min(0.4, r * 0.3), segs: Math.max(10, Math.round(8 + r * 3)) }));
  g.translate(x, y, 0);
  return g;
}

/** A stud standing proud on one side only (+Z by default). */
export function studZ(x: number, y: number, r: number, z0: number, z1: number, chamfer = 0.35): THREE.BufferGeometry {
  const g = alongZ(rod(z0, z1, r, { chamfer, segs: Math.max(10, Math.round(8 + r * 3)) }));
  g.translate(x, y, 0);
  return g;
}

/* ------------------------------------------------------------------ */
/* Builder                                                             */
/* ------------------------------------------------------------------ */

export type Group = 'body' | 'sec' | 'steel' | 'bright' | 'rubber' | 'glass' | 'led' | 'dark';

export interface Anchor {
  pos: THREE.Vector3;
  /** Outward direction of the mount. */
  dir?: THREE.Vector3;
}

export interface BuiltModel {
  parts: Partial<Record<Group, THREE.BufferGeometry>>;
  bounds: THREE.Box3;
  anchors: Record<string, Anchor>;
  triangles: number;
}

export class Builder {
  private bins = new Map<Group, THREE.BufferGeometry[]>();
  readonly anchors: Record<string, Anchor> = {};

  add(group: Group, ...geos: (THREE.BufferGeometry | THREE.BufferGeometry[])[]): this {
    let bin = this.bins.get(group);
    if (!bin) {
      bin = [];
      this.bins.set(group, bin);
    }
    for (const g of geos) {
      if (Array.isArray(g)) bin.push(...g);
      else bin.push(g);
    }
    return this;
  }

  /** Add a geometry and its mirror image across the XY plane. */
  both(group: Group, ...geos: THREE.BufferGeometry[]): this {
    for (const g of geos) this.add(group, g, mirrorZ(g));
    return this;
  }

  anchor(name: string, x: number, y: number, z: number, dir?: readonly [number, number, number]): this {
    this.anchors[name] = { pos: new THREE.Vector3(x, y, z), dir: dir ? new THREE.Vector3(...dir).normalize() : undefined };
    return this;
  }

  /**
   * Merge every group and recentre the model on its bounding-box centre so all
   * weapons share the same pivot convention.
   */
  build(): BuiltModel {
    const parts: Partial<Record<Group, THREE.BufferGeometry>> = {};
    const bounds = new THREE.Box3();
    let triangles = 0;
    for (const [group, list] of this.bins) {
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      merged.computeBoundingBox();
      bounds.union(merged.boundingBox!);
      triangles += merged.getAttribute('position').count / 3;
      parts[group] = merged;
    }
    const c = bounds.getCenter(new THREE.Vector3());
    for (const g of Object.values(parts)) {
      g!.translate(-c.x, -c.y, -c.z);
      g!.computeBoundingBox();
      g!.computeBoundingSphere();
    }
    for (const a of Object.values(this.anchors)) a.pos.sub(c);
    bounds.translate(c.clone().negate());
    return { parts, bounds, anchors: this.anchors, triangles };
  }
}

/* ------------------------------------------------------------------ */
/* Extra outline + deformation helpers                                 */
/* ------------------------------------------------------------------ */

/** Annular band between two radii, from deg0 to deg1 (counter-clockwise, degrees). */
export function arcBand(cx: number, cy: number, rIn: number, rOut: number, deg0: number, deg1: number): V2[] {
  const sweep = Math.abs(deg1 - deg0) * DEG;
  const n = Math.max(3, Math.ceil((sweep / (Math.PI / 2)) * arcRes(rOut)));
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (deg0 + ((deg1 - deg0) * i) / n) * DEG;
    out.push(v2(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut));
  }
  for (let i = n; i >= 0; i--) {
    const a = (deg0 + ((deg1 - deg0) * i) / n) * DEG;
    out.push(v2(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn));
  }
  return dedupe(out);
}

/** Points along an arc (open polyline), for stitching curved edges into a polygon. */
export function arcPts(cx: number, cy: number, r: number, deg0: number, deg1: number, steps = 0): [number, number][] {
  const sweep = Math.abs(deg1 - deg0) * DEG;
  const n = steps || Math.max(2, Math.ceil((sweep / (Math.PI / 2)) * arcRes(r)));
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (deg0 + ((deg1 - deg0) * i) / n) * DEG;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

/** Plain polyline from raw points (no fillets). */
export const pts = (list: readonly (readonly [number, number])[]) => dedupe(list.map((p) => v2(p[0], p[1])));

/** Deform a geometry in place with a per-vertex function, then rebuild its normals. */
export function warp(geo: THREE.BufferGeometry, fn: (p: THREE.Vector3) => void, crease = 44): THREE.BufferGeometry {
  const a = geo.getAttribute('position') as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  for (let i = 0; i < a.count; i++) {
    p.fromBufferAttribute(a, i);
    fn(p);
    a.setXYZ(i, p.x, p.y, p.z);
  }
  const out = hsNormals(geo, crease);
  geo.dispose();
  return out;
}
