/**
 * Blade primitive and small surface helpers shared by the knives.
 *
 * `blade` lofts a row of cross-sections ("stations") from heel to tip. Every
 * station runs from a spine point to an edge point and carries the same rows:
 *
 *   spine top - chamfer / swedge line - [fuller rows] - grind line - [hollow rows]
 *   - edge-bevel line - edge
 *
 * Each row has a half-thickness, so the section is a real wedge: flat above the
 * grind line, primary bevel below it, then a narrow sharpened bevel that is
 * returned as its own geometry (for the 'bright' group). Normals are computed
 * per panel, so grind lines stay crisp even though the dihedral between flat
 * and bevel is only a few degrees.
 *
 * Positions along the blade (`plunge.at`, `fuller.from`, ...) are millimetres
 * measured from the heel along the blade's midline.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hsNormals } from '../kit';

export type Pt = readonly [number, number];
export type P3 = readonly [number, number, number];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const sstep = (k: number) => {
  const c = clamp01(k);
  return c * c * (3 - 2 * c);
};

/* ------------------------------------------------------------------ */
/* Curve helpers                                                       */
/* ------------------------------------------------------------------ */

function cumLen(p: readonly Pt[]): number[] {
  const c = [0];
  for (let i = 1; i < p.length; i++) c.push(c[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  return c;
}

function sampleAt(p: readonly Pt[], c: number[], s: number): Pt {
  if (s <= 0) return p[0];
  if (s >= c[c.length - 1]) return p[p.length - 1];
  let lo = 0;
  let hi = c.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (c[m] <= s) lo = m;
    else hi = m;
  }
  const k = (s - c[lo]) / Math.max(1e-9, c[hi] - c[lo]);
  return [lerp(p[lo][0], p[hi][0], k), lerp(p[lo][1], p[hi][1], k)];
}

/** n + 1 points spaced evenly by arc length along a polyline (corners are not preserved). */
export function resample(p: readonly Pt[], n: number): Pt[] {
  const c = cumLen(p);
  const total = c[c.length - 1];
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push(sampleAt(p, c, (i / n) * total));
  return out;
}

/** Smooth open curve through the points (centripetal Catmull-Rom), n + 1 evenly spaced samples. */
export function curve(p: readonly Pt[], n: number): Pt[] {
  const cr = new THREE.CatmullRomCurve3(
    p.map((q) => new THREE.Vector3(q[0], q[1], 0)),
    false,
    'centripetal',
  );
  const dense = cr.getPoints(Math.max(64, p.length * 24)).map((v) => [v.x, v.y] as Pt);
  return resample(dense, n);
}

/** Concatenate polylines, dropping the duplicated joint points. */
export function join(...parts: (readonly Pt[])[]): Pt[] {
  const out: Pt[] = [];
  for (const part of parts) {
    for (const q of part) {
      const l = out[out.length - 1];
      if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 1e-4) out.push(q);
    }
  }
  return out;
}

/** Point at distance `s` (mm) along a polyline. */
export function pointAlong(p: readonly Pt[], s: number): Pt {
  return sampleAt(p, cumLen(p), s);
}

/** Offset a closed outline outward by `d` mm (negative shrinks it). */
export function inflate(outline: readonly THREE.Vector2[], d: number): THREE.Vector2[] {
  const n = outline.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    area += a.x * b.y - b.x * a.y;
  }
  const sg = area >= 0 ? 1 : -1;
  const moved = outline.map((p, i) => {
    const a = outline[(i + n - 1) % n];
    const b = outline[(i + 1) % n];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    return new THREE.Vector2(p.x + (sg * d * ty) / l, p.y - (sg * d * tx) / l);
  });
  // drop points that landed closer to the source outline than the offset (tight corners)
  const lim = Math.abs(d) * 0.97;
  return moved.filter((q) => {
    for (let i = 0; i < n; i++) {
      const a = outline[i];
      const b = outline[(i + 1) % n];
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const k = clamp01(((q.x - a.x) * ex + (q.y - a.y) * ey) / (ex * ex + ey * ey || 1));
      if (Math.hypot(q.x - a.x - ex * k, q.y - a.y - ey * k) < lim) return false;
    }
    return true;
  });
}

/** Keep the part of a closed outline where nx * x + ny * y <= c. */
export function clipHalf(outline: readonly THREE.Vector2[], nx: number, ny: number, c: number): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    const da = nx * a.x + ny * a.y - c;
    const db = nx * b.x + ny * b.y - c;
    if (da <= 0) out.push(a);
    if (da <= 0 !== db <= 0) {
      const k = da / (da - db);
      out.push(new THREE.Vector2(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k));
    }
  }
  return out;
}

/**
 * Replace the flat +Z / -Z caps of a plate with a regular grid of `cell` mm, so a
 * later `warp` bends the big faces smoothly instead of along the long, thin
 * triangles of the original triangulation. Returns positions only (warp rebuilds
 * the normals). Plates with holes are returned unchanged.
 */
export function regrid(geo: THREE.BufferGeometry, cell: number): THREE.BufferGeometry {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const P = (src.getAttribute('position') as THREE.BufferAttribute).array as ArrayLike<number>;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let i = 2; i < P.length; i += 3) {
    z0 = Math.min(z0, P[i]);
    z1 = Math.max(z1, P[i]);
  }
  const out: number[] = [];
  const top: number[] = [];
  const capIdx: number[] = [];
  for (let i = 0; i < P.length; i += 9) {
    const at = (z: number) => Math.abs(P[i + 2] - z) < 1e-4 && Math.abs(P[i + 5] - z) < 1e-4 && Math.abs(P[i + 8] - z) < 1e-4;
    if (at(z1)) top.push(P[i], P[i + 1], P[i + 3], P[i + 4], P[i + 6], P[i + 7]);
    if (at(z1) || at(z0)) capIdx.push(i);
    else for (let k = 0; k < 9; k++) out.push(P[i + k]);
  }
  // boundary loop of the top cap
  const key = (x: number, y: number) => Math.round(x * 500) + '_' + Math.round(y * 500);
  const edges = new Map<string, [number, number, number, number]>();
  for (let i = 0; i < top.length; i += 6) {
    for (let k = 0; k < 3; k++) {
      const ax = top[i + k * 2];
      const ay = top[i + k * 2 + 1];
      const bx = top[i + ((k + 1) % 3) * 2];
      const by = top[i + ((k + 1) % 3) * 2 + 1];
      const rev = key(bx, by) + '|' + key(ax, ay);
      if (edges.has(rev)) edges.delete(rev);
      else edges.set(key(ax, ay) + '|' + key(bx, by), [ax, ay, bx, by]);
    }
  }
  const next = new Map<string, [number, number, number, number]>();
  for (const e of edges.values()) next.set(key(e[0], e[1]), e);
  const loop: THREE.Vector2[] = [];
  const first = edges.values().next().value as [number, number, number, number] | undefined;
  for (let e = first, guard = 0; e && guard <= edges.size; guard++) {
    loop.push(new THREE.Vector2(e[0], e[1]));
    e = next.get(key(e[2], e[3]));
    if (e === first) break;
  }
  if (loop.length < 3 || loop.length !== edges.size) {
    for (const i of capIdx) for (let k = 0; k < 9; k++) out.push(P[i + k]);
  } else {
    const emit = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
      const ar = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(ar) < 1e-7) return;
      if (ar > 0) {
        out.push(ax, ay, z1, bx, by, z1, cx, cy, z1, ax, ay, z0, cx, cy, z0, bx, by, z0);
      } else {
        out.push(ax, ay, z1, cx, cy, z1, bx, by, z1, ax, ay, z0, bx, by, z0, cx, cy, z0);
      }
    };
    let minX = Infinity;
    let maxX = -Infinity;
    for (const p of loop) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
    }
    for (let ix = Math.floor(minX / cell); ix * cell < maxX; ix++) {
      const x0 = ix * cell;
      const col = clipHalf(clipHalf(loop, -1, 0, -x0), 1, 0, x0 + cell);
      if (col.length < 3) continue;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of col) {
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      for (let iy = Math.floor(minY / cell); iy * cell < maxY; iy++) {
        const y0 = iy * cell;
        const raw = clipHalf(clipHalf(col, 0, -1, -y0), 0, 1, y0 + cell);
        const pc: THREE.Vector2[] = [];
        for (const q of raw) if (!pc.length || pc[pc.length - 1].distanceToSquared(q) > 1e-10) pc.push(q);
        while (pc.length > 1 && pc[0].distanceToSquared(pc[pc.length - 1]) < 1e-10) pc.pop();
        if (pc.length < 3) continue;
        let area = 0;
        for (let k = 0; k < pc.length; k++) {
          const u = pc[k];
          const v = pc[(k + 1) % pc.length];
          area += u.x * v.y - v.x * u.y;
        }
        if (Math.abs(area) / 2 > cell * cell * 0.9999) {
          emit(x0, y0, x0 + cell, y0, x0 + cell, y0 + cell);
          emit(x0, y0, x0 + cell, y0 + cell, x0, y0 + cell);
        } else {
          for (const t of THREE.ShapeUtils.triangulateShape(pc, [])) emit(pc[t[0]].x, pc[t[0]].y, pc[t[1]].x, pc[t[1]].y, pc[t[2]].x, pc[t[2]].y);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return g;
}

/* ------------------------------------------------------------------ */
/* Generic parametric surface                                          */
/* ------------------------------------------------------------------ */

function soup(tris: number[], crease: number): THREE.BufferGeometry | null {
  if (!tris.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
  const out = hsNormals(g, crease);
  g.dispose();
  return out.getAttribute('position').count ? out : null;
}

/**
 * Tessellate fn(u, v) over [0,1]^2 into nu x nv quads. The front face points
 * along dP/du x dP/dv; pass `flip` to reverse it.
 */
export function gridSurface(nu: number, nv: number, fn: (u: number, v: number) => P3, o: { flip?: boolean; crease?: number } = {}): THREE.BufferGeometry {
  const pt: P3[][] = [];
  for (let i = 0; i <= nu; i++) {
    const row: P3[] = [];
    for (let j = 0; j <= nv; j++) row.push(fn(i / nu, j / nv));
    pt.push(row);
  }
  const tris: number[] = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const A = pt[i][j];
      const B = pt[i + 1][j];
      const C = pt[i + 1][j + 1];
      const D = pt[i][j + 1];
      if (o.flip) tris.push(...A, ...C, ...B, ...A, ...D, ...C);
      else tris.push(...A, ...B, ...C, ...A, ...C, ...D);
    }
  }
  return soup(tris, o.crease ?? 40) ?? new THREE.BufferGeometry();
}

/* ------------------------------------------------------------------ */
/* Blade                                                               */
/* ------------------------------------------------------------------ */

export interface Fuller {
  /** Start / end in mm from the heel. */
  from: number;
  to: number;
  /** Centre of the groove: mm below the spine (`offset`) or a fraction from spine to edge (`pos`). */
  offset?: number;
  pos?: number;
  width: number;
  depth: number;
}

export interface BladeSpec {
  /**
   * Spine polyline, heel to tip. With the same point count as `edge` the two are
   * paired index by index; otherwise the spine is resampled to pair with the
   * edge stations by normalised arc length.
   */
  spine: readonly Pt[];
  /** Edge polyline, heel to tip. Every point is a station. */
  edge: readonly Pt[];
  /** Spine thickness at the heel. */
  thick: number;
  /** Spine thickness at the tip end of the distal taper (default 0.55 x thick). */
  tipThick?: number;
  /** Fraction of the length where the distal taper starts (default 0.25). */
  taperFrom?: number;
  /** Where the primary bevel starts, as a fraction from spine (0) to edge (1). Default 0.5. */
  grind?: number | ((t: number) => number);
  /** Alternative to `grind`: primary bevel width in mm, measured square to the edge. */
  grindWidth?: number;
  /** Width of the sharpened edge bevel in mm (default 1.4). */
  edgeBevel?: number;
  /** Thickness of the blade behind the edge bevel (default 0.55). */
  edgeThick?: number;
  /** 0 = flat grind, about 0.5 = hollow grind, negative = convex. */
  hollow?: number;
  /** Steepest allowed primary bevel (half-thickness per mm of width). Thins the blade where it narrows. */
  maxSlope?: number;
  /** Unsharpened ricasso: full thickness up to `at`, then a plunge ramp `len` long. */
  plunge?: { at: number; len?: number };
  fuller?: Fuller | Fuller[];
  /** False edge on the spine from `from` to the tip. `thick` is the spine thickness left, as a fraction. */
  swedge?: { from: number; width: number; thick?: number; blend?: number };
  /** V-notches cut across the spine. */
  jimping?: { from: number; to: number; pitch?: number; depth?: number };
  /** Spine corner chamfer (default 0.35). */
  chamfer?: number;
  crease?: number;
  capHeel?: boolean;
}

export interface BladeStation {
  /** mm from the heel along the midline. */
  u: number;
  s: Pt;
  e: Pt;
  /** Unit direction spine -> edge. */
  d: Pt;
  /** Spine-to-edge width. */
  L: number;
  /** Half thickness of the flat. */
  hs: number;
  /** Distance from the spine to the grind line. */
  aG: number;
}

export interface Blade {
  /** Flats, primary grind, spine and heel: goes in 'body'. */
  body: THREE.BufferGeometry;
  /** Sharpened edge bevel: goes in 'bright'. */
  bevel: THREE.BufferGeometry;
  stations: BladeStation[];
  length: number;
  tip: Pt;
  /** Point on the +Z flat, `u` mm from the heel and `mm` below the spine. */
  onFlat(u: number, mm: number): P3;
}

interface Row {
  a: number;
  z: number;
}

const FPROF: readonly Pt[] = [
  [-1, 0],
  [-0.7, 0.51],
  [-0.35, 0.88],
  [0, 1],
  [0.35, 0.88],
  [0.7, 0.51],
  [1, 0],
];

export function blade(spec: BladeSpec): Blade {
  const E0 = spec.edge;
  let S0 = spec.spine;
  if (S0.length !== E0.length) {
    const ce = cumLen(E0);
    const cs = cumLen(S0);
    const src = S0;
    S0 = E0.map((_, i) => sampleAt(src, cs, (ce[i] / ce[ce.length - 1]) * cs[cs.length - 1]));
  }
  const n0 = E0.length;
  const u0 = [0];
  for (let i = 1; i < n0; i++) {
    const mx = (S0[i][0] + E0[i][0] - S0[i - 1][0] - E0[i - 1][0]) / 2;
    const my = (S0[i][1] + E0[i][1] - S0[i - 1][1] - E0[i - 1][1]) / 2;
    u0.push(u0[i - 1] + Math.max(1e-4, Math.hypot(mx, my)));
  }
  const U = u0[n0 - 1];

  const eb = spec.edgeBevel ?? 1.4;
  const heN = (spec.edgeThick ?? 0.55) / 2;
  const cham = spec.chamfer ?? 0.35;
  const hollow = spec.hollow ?? 0;
  const nMid = hollow ? 3 : 0;
  const tipFrac = (spec.tipThick ?? spec.thick * 0.55) / spec.thick;
  const taperFrom = spec.taperFrom ?? 0.25;
  const fullers = (spec.fuller ? (Array.isArray(spec.fuller) ? spec.fuller : [spec.fuller]) : []) as Fuller[];
  const plunge = spec.plunge;
  const plungeLen = plunge?.len ?? 4;
  const sw = spec.swedge;
  const swBlend = sw?.blend ?? 12;
  const jim = spec.jimping;
  const jPitch = jim?.pitch ?? 2.6;
  const jDepth = jim?.depth ?? 0.9;
  const gFrac = (t: number) => (typeof spec.grind === 'function' ? spec.grind(t) : (spec.grind ?? 0.5));

  /* ---- refine: add stations where features need them ---- */
  const us = [...u0];
  const want = (v: number) => {
    if (v > 0.05 && v < U - 0.05 && us.every((x) => Math.abs(x - v) > 0.12)) us.push(v);
  };
  if (plunge) for (let k = 0; k <= 6; k++) want(plunge.at + (plungeLen * k) / 6);
  for (const f of fullers) {
    const r = f.width / 2;
    for (const q of [0, 0.06, 0.2, 0.42, 0.7, 1]) {
      want(f.from + r * q);
      want(f.to - r * q);
    }
  }
  if (sw) for (let k = 0; k <= 4; k++) want(sw.from + (swBlend * k) / 4);
  if (jim) for (let v = jim.from; v <= jim.to + 1e-6; v += jPitch) for (const q of [0, 0.3, 0.65]) if (v + q * jPitch <= jim.to + 1e-6) want(v + q * jPitch);
  us.sort((a, b) => a - b);
  const n = us.length;
  const S: Pt[] = [];
  const E: Pt[] = [];
  {
    let k = 0;
    for (const u of us) {
      while (k < n0 - 2 && u0[k + 1] < u) k++;
      const f = clamp01((u - u0[k]) / (u0[k + 1] - u0[k]));
      S.push([lerp(S0[k][0], S0[k + 1][0], f), lerp(S0[k][1], S0[k + 1][1], f)]);
      E.push([lerp(E0[k][0], E0[k + 1][0], f), lerp(E0[k][1], E0[k + 1][1], f)]);
    }
  }

  /* ---- station frames ---- */
  const D: Pt[] = [];
  const Ls: number[] = [];
  const Cs: number[] = [];
  let lastD: Pt = [0, -1];
  for (let i = 0; i < n; i++) {
    let dx = E[i][0] - S[i][0];
    let dy = E[i][1] - S[i][1];
    const L = Math.hypot(dx, dy);
    if (L > 1e-4) {
      dx /= L;
      dy /= L;
      lastD = [dx, dy];
    } else [dx, dy] = lastD;
    // squareness of the station line to the edge (1 = perpendicular)
    let cos = 1;
    for (const k of [i - 1, i]) {
      if (k < 0 || k + 1 >= n) continue;
      const tx = E[k + 1][0] - E[k][0];
      const ty = E[k + 1][1] - E[k][1];
      const tl = Math.hypot(tx, ty);
      if (tl > 1e-5) cos = Math.min(cos, Math.abs(dx * ty - dy * tx) / tl);
    }
    D.push([dx, dy]);
    Ls.push(L);
    Cs.push(Math.max(0.4, cos));
  }
  const wantW = (i: number) => (spec.grindWidth !== undefined ? spec.grindWidth : (1 - gFrac(us[i] / U)) * Ls[i] * Cs[i]);
  let wRef = 0;
  for (let i = 0; i < n; i++) wRef = Math.max(wRef, Math.min(wantW(i), Ls[i] * Cs[i]));
  const maxSlope = spec.maxSlope ?? ((spec.grindWidth !== undefined ? 1 : 1.35) * (spec.thick / 2 - heN)) / Math.max(0.5, wRef - eb);

  /* ---- rows ---- */
  const tags: string[] = ['cham'];
  for (let f = 0; f < fullers.length; f++) {
    tags.push('flat');
    for (let k = 1; k < FPROF.length; k++) tags.push('full');
  }
  tags.push('flat');
  for (let k = 0; k <= nMid; k++) tags.push('grind');
  tags.push('bevel');

  const rowsAt: Row[][] = [];
  const ps: number[] = [];
  const stations: BladeStation[] = [];
  for (let i = 0; i < n; i++) {
    const u = us[i];
    const t = u / U;
    const L = Ls[i];
    const cos = Cs[i];
    const p = plunge ? sstep((u - plunge.at) / plungeLen) : 1;
    const hsNom = (spec.thick / 2) * lerp(1, tipFrac, clamp01((t - taperFrom) / (1 - taperFrom)));
    const ebP = Math.min(eb, 0.45 * L * cos);
    const he = eb > 0 ? heN * (ebP / eb) : 0;
    const Wd = Math.min(L, Math.max(ebP / cos, wantW(i) / cos));
    // the slope limit only applies where the blade is actually ground
    const hs = lerp(hsNom, Math.min(hsNom, he + maxSlope * Math.max(0, Wd * cos - ebP)), p);
    const c = Math.min(cham, hs * 0.35, L * 0.2);
    let w1 = c;
    let zTop = hs - c;
    if (sw) {
      const k = sstep((u - sw.from) / swBlend);
      w1 = lerp(c, sw.width, k);
      zTop = lerp(hs - c, hs * (sw.thick ?? 0.3), k);
    }
    let jd = 0;
    if (jim && u >= jim.from - 1e-6 && u <= jim.to + 1e-6) {
      const ph = (u - jim.from) / jPitch;
      const fr = ph - Math.floor(ph + 1e-6);
      jd = fr < 0.3 ? 0 : jDepth * Math.max(0, 1 - Math.abs((fr - 0.65) / 0.35));
    }
    const aG = L - Wd;
    const a1 = Math.min(jd + w1, aG);
    const rows: Row[] = [
      { a: Math.min(jd, a1), z: zTop },
      { a: a1, z: hs },
    ];
    for (const f of fullers) {
      const du = Math.min(u - f.from, f.to - u);
      const r = f.width / 2;
      const k = du <= 0 ? 0 : du >= r ? 1 : Math.sqrt(1 - (1 - du / r) ** 2);
      const ac = f.offset !== undefined ? f.offset : (f.pos ?? 0.3) * L;
      const dep = Math.max(0, Math.min(f.depth, hs - 0.35)) * k;
      for (const [q, dz] of FPROF) rows.push({ a: Math.min(aG, Math.max(a1, ac + q * r * k)), z: hs - dz * dep });
    }
    rows.push({ a: aG, z: hs });
    const aB = Math.max(aG, L - lerp(c, ebP / cos, p));
    const zB = lerp(hs, he, p);
    for (let m = 1; m <= nMid; m++) {
      const q = m / (nMid + 1);
      rows.push({ a: lerp(aG, aB, q), z: lerp(hs, zB, q) - hollow * (hs - zB) * 0.5 * Math.sin(Math.PI * q) });
    }
    rows.push({ a: aB, z: zB });
    rows.push({ a: L, z: lerp(hs - c, 0, p) });
    rowsAt.push(rows);
    ps.push(p);
    stations.push({ u, s: S[i], e: E[i], d: D[i], L, hs, aG });
  }

  /* ---- triangles ---- */
  const R = tags.length + 1;
  const bins: Record<string, number[]> = { cham: [], flat: [], full: [], grind: [], bevel: [], misc: [] };
  const P = (i: number, j: number, sg: number): P3 => {
    const r = rowsAt[i][j];
    return [S[i][0] + D[i][0] * r.a, S[i][1] + D[i][1] * r.a, sg * r.z];
  };
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < R - 1; j++) {
      let tag = tags[j];
      if (tag === 'bevel' && (ps[i] < 0.999 || ps[i + 1] < 0.999)) tag = 'misc';
      const bin = bins[tag];
      bin.push(...P(i, j, 1), ...P(i, j + 1, 1), ...P(i + 1, j + 1, 1), ...P(i, j, 1), ...P(i + 1, j + 1, 1), ...P(i + 1, j, 1));
      bin.push(...P(i, j, -1), ...P(i + 1, j, -1), ...P(i + 1, j + 1, -1), ...P(i, j, -1), ...P(i + 1, j + 1, -1), ...P(i, j + 1, -1));
    }
    // spine top and (in the ricasso) the flat underside
    bins.misc.push(...P(i, 0, 1), ...P(i + 1, 0, 1), ...P(i + 1, 0, -1), ...P(i, 0, 1), ...P(i + 1, 0, -1), ...P(i, 0, -1));
    bins.misc.push(...P(i, R - 1, 1), ...P(i + 1, R - 1, -1), ...P(i + 1, R - 1, 1), ...P(i, R - 1, 1), ...P(i, R - 1, -1), ...P(i + 1, R - 1, -1));
  }
  const cap = (i: number, flip: boolean) => {
    const ring: P3[] = [];
    for (let j = 0; j < R; j++) ring.push(P(i, j, 1));
    for (let j = R - 1; j >= 0; j--) ring.push(P(i, j, -1));
    const c: P3 = [S[i][0] + (D[i][0] * Ls[i]) / 2, S[i][1] + (D[i][1] * Ls[i]) / 2, 0];
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k];
      const b2 = ring[(k + 1) % ring.length];
      if (flip) bins.misc.push(...c, ...a, ...b2);
      else bins.misc.push(...c, ...b2, ...a);
    }
  };
  if (spec.capHeel !== false) cap(0, false);
  if (Ls[n - 1] > 0.05) cap(n - 1, true);

  const crease = spec.crease ?? 35;
  const bodyParts = (['cham', 'flat', 'full', 'grind', 'misc'] as const).map((k) => soup(bins[k], crease)).filter((g): g is THREE.BufferGeometry => !!g);
  const body = mergeGeometries(bodyParts, false) ?? new THREE.BufferGeometry();
  for (const g of bodyParts) g.dispose();
  const bevel = soup(bins.bevel, crease) ?? new THREE.BufferGeometry();

  const onFlat = (u: number, mm: number): P3 => {
    let k = 0;
    while (k < n - 2 && us[k + 1] < u) k++;
    const f = clamp01((u - us[k]) / (us[k + 1] - us[k]));
    const i = f < 0.5 ? k : k + 1;
    const sx = lerp(S[k][0], S[k + 1][0], f);
    const sy = lerp(S[k][1], S[k + 1][1], f);
    return [sx + D[i][0] * mm, sy + D[i][1] * mm, lerp(stations[k].hs, stations[k + 1].hs, f)];
  };

  return { body, bevel, stations, length: U, tip: E[n - 1], onFlat };
}
