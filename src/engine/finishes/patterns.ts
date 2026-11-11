/**
 * Procedural skin artwork.
 *
 * Every pattern is generated at runtime on a 2D canvas, so the whole skin
 * catalogue ships as a few kilobytes of code and every design is original.
 * Generators are deterministic for a given parameter set and (unless noted)
 * tile seamlessly, which lets the shader slide and rotate them per item seed.
 */
import { clamp01, fbm, fbm2, hashString, mulberry32, ridged, smoothstep, worley, type Rand } from '../noise';
import { css, hex, makeCanvas, mix, pixelFill, ramp, scale, tiled, type RGB, type Wrap } from './canvas';

export interface PatternParams {
  colors: string[];
  seed?: number;
  /** Generator-specific knobs. */
  a?: number;
  b?: number;
  c?: number;
}

type Gen = (p: PatternParams) => HTMLCanvasElement;

const TAU = Math.PI * 2;
const pal = (p: PatternParams) => p.colors.map((c) => hex(c));
const put = (out: [number, number, number], c: RGB) => {
  out[0] = c[0];
  out[1] = c[1];
  out[2] = c[2];
};
const pick = <T,>(r: Rand, list: readonly T[]) => list[Math.floor(r() * list.length) % list.length];
const mod = (a: number, n: number) => ((a % n) + n) % n;
function cellHash(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(seed, 83492791);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/* ================================================================== */
/* Per-pixel generators (512 px)                                       */
/* ================================================================== */

const PX = 512;

/** Layered blob camouflage. a = blob lattice (default 3). */
const camo: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  const cells = p.a ?? 3;
  return pixelFill(PX, PX, (u, v, out) => {
    let col = c[0];
    for (let i = 1; i < c.length; i++) {
      const n = fbm(u + i * 0.37, v + i * 0.21, Math.round(cells * (1 + 0.3 * i)), 4, s + i * 17);
      const thr = 0.5 + 0.03 * i;
      col = mix(col, c[i], smoothstep(thr, thr + 0.012, n));
    }
    put(out, col);
  });
};

/** Blocky pixel camouflage. a = grid resolution. */
const digital: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  const grid = p.a ?? 48;
  return pixelFill(PX, PX, (u, v, out) => {
    const qu = Math.floor(u * grid) / grid;
    const qv = Math.floor(v * grid) / grid;
    let col = c[0];
    for (let i = 1; i < c.length; i++) {
      const n = fbm(qu + i * 0.41, qv + i * 0.13, 3 + i, 3, s + i * 29);
      if (n > 0.5 + 0.035 * i) col = c[i];
    }
    put(out, col);
  });
};

/** Organic tiger stripes. a = stripe count, b = warp. */
const tiger: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  const freq = Math.round(p.a ?? 7);
  const warp = p.b ?? 1.0;
  return pixelFill(PX, PX, (u, v, out) => {
    const w = fbm(u, v, 3, 3, s);
    const wig = fbm2(u, v, 4, 9, 2, s + 3);
    const st = 0.5 + 0.5 * Math.sin((u * freq + (w - 0.5) * warp + (wig - 0.5) * 0.55) * TAU);
    // stripes swell and pinch out along their length
    const taper = fbm2(u + 0.5, v, 3, 5, 3, s + 9);
    const thr = 0.6 + (taper - 0.5) * 1.15;
    const coat = c[2] ? mix(c[0], c[2], smoothstep(0.35, 0.8, fbm(u, v, 2, 2, s + 20))) : c[0];
    const col = mix(coat, c[1], smoothstep(thr, thr + 0.045, st));
    put(out, scale(col, 0.94 + wig * 0.12));
  });
};

/** Contour-map lines. a = contour count. colors: bg, line, major line. */
const topo: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  const levels = p.a ?? 10;
  return pixelFill(PX, PX, (u, v, out) => {
    const n = fbm(u, v, 3, 4, s, 0.45);
    const x = n * levels;
    const f = x - Math.floor(x);
    const d = Math.min(f, 1 - f);
    const major = Math.floor(x + 0.5) % 4 === 0;
    const line = 1 - smoothstep(major ? 0.05 : 0.025, major ? 0.085 : 0.055, d);
    let col = mix(c[0], scale(c[0], 1.35), n);
    col = mix(col, major ? (c[2] ?? c[1]) : c[1], line);
    put(out, col);
  });
};

/** Veined stone. colors: base, vein, secondary vein. */
const marble: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  return pixelFill(PX, PX, (u, v, out) => {
    const w = fbm(u, v, 3, 5, s);
    const w2 = fbm(u + 0.3, v + 0.7, 4, 4, s + 31);
    const v1 = Math.pow(1 - Math.abs(Math.sin(Math.PI * (3 * u + 2 * v + 3.6 * w))), 9);
    const v2 = Math.pow(1 - Math.abs(Math.sin(Math.PI * (2 * u - 3 * v + 5.2 * w2))), 18) * 0.7;
    let col = mix(c[0], scale(c[0], 0.82), w2);
    col = mix(col, c[1], clamp01(v1 * 0.9));
    col = mix(col, c[2] ?? c[1], clamp01(v2));
    put(out, col);
  });
};

/** Heat-treated colour mottling through a ramp. a = lattice, b = contrast. */
const patina: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  const cells = p.a ?? 3;
  const k = p.b ?? 1.7;
  return pixelFill(PX, PX, (u, v, out) => {
    const wx = fbm(u, v, 2, 3, s + 1);
    const wy = fbm(u + 0.4, v + 0.7, 2, 3, s + 2);
    const n = fbm(u + wx * 0.4, v + wy * 0.4, cells, 5, s);
    const fine = fbm(u, v, 40, 2, s + 5);
    const t = clamp01((n - 0.5) * k + 0.5);
    put(out, scale(ramp(c, t), 0.9 + fine * 0.2));
  });
};

/** Gas clouds and stars. colors: bg, cloud A, cloud B, star. */
const nebula: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  return pixelFill(PX, PX, (u, v, out) => {
    const wx = fbm(u, v, 2, 4, s + 3);
    const n1 = fbm(u + wx * 0.5, v + wx * 0.3, 3, 5, s);
    const n2 = fbm(u - wx * 0.4, v + 0.5, 4, 5, s + 40);
    const a = Math.pow(clamp01(n1 * 1.5 - 0.25), 2.2);
    const b = Math.pow(clamp01(n2 * 1.6 - 0.35), 2.6);
    let r = c[0][0] + c[1][0] * a * 1.1 + c[2][0] * b;
    let g = c[0][1] + c[1][1] * a * 1.1 + c[2][1] * b;
    let bl = c[0][2] + c[1][2] * a * 1.1 + c[2][2] * b;
    const h = cellHash(Math.floor(u * PX), Math.floor(v * PX), s);
    if (h > 0.9975) {
      const k = (h - 0.9975) / 0.0025;
      const st = c[3] ?? [255, 255, 255];
      r += st[0] * k;
      g += st[1] * k;
      bl += st[2] * k;
    }
    out[0] = Math.min(255, r);
    out[1] = Math.min(255, g);
    out[2] = Math.min(255, bl);
  });
};

/** Glowing cracks through cooled rock. colors: rock, glow low, glow high. a = cells. */
const magma: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  const cells = Math.round(p.a ?? 5);
  return pixelFill(PX, PX, (u, v, out) => {
    const w = fbm(u, v, 4, 3, s + 8);
    const [f1, f2, id] = worley(u + (w - 0.5) * 0.08, v + (w - 0.5) * 0.08, cells, s);
    const d = f2 - f1;
    const crack = 1 - smoothstep(0.0, 0.085, d);
    const halo = 1 - smoothstep(0.0, 0.34, d);
    const grit = fbm(u, v, 24, 3, s + 2);
    let col = scale(c[0], (0.55 + 0.7 * id) * (0.75 + 0.5 * grit));
    col = mix(col, c[1], halo * 0.28);
    col = mix(col, ramp([c[1], c[2]], crack), Math.pow(crack, 1.4));
    put(out, col);
  });
};

/** Pattern-welded steel. colors: dark, light. a = layer count. */
const damascus: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  const freq = Math.round(p.a ?? 11);
  return pixelFill(PX, PX, (u, v, out) => {
    const w = fbm(u, v, 2, 4, s);
    const w2 = fbm(u + 0.3, v + 0.6, 5, 3, s + 3);
    let t = 0.5 + 0.5 * Math.sin((v * freq + w * 5.5 + w2 * 1.3) * TAU);
    t = smoothstep(0.18, 0.82, t);
    const fine = fbm2(u, v, 120, 6, 2, s + 6);
    put(out, scale(mix(c[0], c[1], t), 0.9 + fine * 0.2));
  });
};

/** Etched meteoric iron: three families of crossing lamellae. colors: dark, mid, light. */
const meteorite: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  return pixelFill(PX, PX, (u, v, out) => {
    const zone = fbm(u, v, 3, 2, s);
    let t = 0;
    const fam: [number, number][] = [
      [5, 3],
      [-3, 6],
      [7, -2],
    ];
    for (let i = 0; i < 3; i++) {
      const ph = fam[i][0] * u + fam[i][1] * v;
      const band = Math.abs(Math.sin(ph * Math.PI * 5 + fbm(u, v, 6, 2, s + i) * 1.4));
      const on = smoothstep(0.32 + i * 0.12, 0.36 + i * 0.12, mod(zone * 3 + i * 0.37, 1));
      t = Math.max(t, Math.pow(band, 3) * on);
    }
    const grain = fbm(u, v, 60, 2, s + 9);
    put(out, scale(ramp(c, clamp01(t * 0.9 + grain * 0.2)), 0.9 + grain * 0.2));
  });
};

/** Ice crystals. colors: bg, ice, white. */
const frost: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  return pixelFill(PX, PX, (u, v, out) => {
    const r1 = ridged(u, v, 4, 5, s);
    const r2 = ridged(u + 0.5, v + 0.5, 10, 4, s + 7);
    const t = clamp01(Math.pow(r1, 2.4) * 0.85 + Math.pow(r2, 4) * 0.7);
    put(out, ramp(c, t));
  });
};

/** Flowing multi-hue ribbons through a ramp. a = ribbon count. */
const aurora: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  const n = Math.round(p.a ?? 1);
  return pixelFill(PX, PX, (u, v, out) => {
    const w = fbm(u, v, 2, 4, s);
    const w2 = fbm(u + 0.6, v + 0.2, 3, 3, s + 5);
    const t = 0.5 + 0.5 * Math.sin((u * n + w * 1.3 + 0.22 * Math.sin((v + w2 * 0.5) * TAU)) * TAU);
    const streak = fbm2(u, v, 3, 40, 2, s + 11);
    put(out, scale(ramp(c, t), 0.82 + streak * 0.36));
  });
};

/** Leaded glass: cellular panes. last colour is the lead line. a = cells. */
const glass: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  const cells = Math.round(p.a ?? 6);
  const lead = c[c.length - 1];
  const panes = c.slice(0, -1);
  return pixelFill(PX, PX, (u, v, out) => {
    const [f1, f2, id] = worley(u, v, cells, s, 0.95);
    const edge = smoothstep(0.035, 0.075, f2 - f1);
    const base = panes[Math.floor(id * panes.length) % panes.length];
    const shade = 0.72 + 0.5 * mod(id * 7.13, 1) - f1 * 0.35;
    const streak = fbm2(u, v, 4, 60, 2, s + 3);
    put(out, mix(lead, scale(base, shade * (0.9 + streak * 0.25)), edge));
  });
};

/** Big-cat rosettes. colors: coat, ring, core. a = cells. */
const rosette: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  const cells = Math.round(p.a ?? 7);
  return pixelFill(PX, PX, (u, v, out) => {
    const w = fbm(u, v, 5, 3, s + 4);
    const [f1, , id] = worley(u + (w - 0.5) * 0.06, v + (w - 0.5) * 0.06, cells, s, 0.8);
    const size = 0.75 + id * 0.5;
    const gaps = fbm(u, v, 22, 2, s + 6);
    const ring = (smoothstep(0.2 * size, 0.24 * size, f1) - smoothstep(0.36 * size, 0.41 * size, f1)) * smoothstep(0.42, 0.5, gaps);
    const core = 1 - smoothstep(0.15 * size, 0.2 * size, f1);
    let col = mix(c[0], scale(c[0], 0.8), fbm(u, v, 3, 3, s + 2));
    col = mix(col, c[2] ?? c[1], core * 0.85);
    col = mix(col, c[1], clamp01(ring));
    put(out, col);
  });
};

/** Carbon-fibre twill. colors: dark, light. a = tows across the tile. */
const weave: Gen = (p) => {
  const c = pal(p);
  const n = Math.round(p.a ?? 28);
  return pixelFill(PX, PX, (u, v, out) => {
    const x = u * n;
    const y = v * n;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    const fx = x - cx;
    const fy = y - cy;
    const over = mod(cx + cy, 4) < 2;
    const b = over ? Math.pow(Math.sin(Math.PI * fx), 0.7) * (0.55 + 0.45 * Math.sin(Math.PI * fy)) : Math.pow(Math.sin(Math.PI * fy), 0.7) * 0.5 * (0.5 + 0.5 * Math.sin(Math.PI * fx));
    put(out, mix(c[0], c[1], b));
  });
};

/* ================================================================== */
/* Vector generators (1024 px)                                         */
/* ================================================================== */

const VX = 1024;

function speckle(ctx: CanvasRenderingContext2D, r: Rand, n: number, col: RGB, a: number, size = 1.4) {
  ctx.fillStyle = css(col, a);
  for (let i = 0; i < n; i++) ctx.fillRect(r() * VX, r() * VX, size * (0.5 + r()), size * (0.5 + r()));
}

/** Honeycomb tiles. colors: bg, fill A, fill B, ..., line (last). a = columns, b = fill probability. */
const hexgrid: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  const cols = Math.round(p.a ?? 9);
  const fillP = p.b ?? 0.45;
  const [cv, ctx] = makeCanvas(VX, VX);
  const line = c[c.length - 1];
  const fills = c.slice(1, -1);
  ctx.fillStyle = css(c[0]);
  ctx.fillRect(0, 0, VX, VX);
  const hw = VX / cols;
  let rows = Math.round(VX / (hw * 0.866));
  if (rows % 2) rows++;
  const rh = VX / rows;
  // pointy-top hexagons: 0.93 leaves a seam between neighbours
  const rx = (hw * 0.93) / 1.732;
  const ry = (rh / 1.5) * 0.93;
  for (let row = -1; row <= rows + 1; row++) {
    for (let col = -1; col <= cols + 1; col++) {
      const x = (col + (mod(row, 2) ? 0.5 : 0)) * hw;
      const y = row * rh;
      const h = cellHash(mod(col, cols), mod(row, rows), s);
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + Math.PI / 6;
        const px = x + Math.cos(a) * rx;
        const py = y + Math.sin(a) * ry;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (h < fillP && fills.length) {
        const base = fills[Math.floor((h / fillP) * fills.length) % fills.length];
        ctx.fillStyle = css(scale(base, 0.75 + cellHash(col, row, s + 5) * 0.5));
        ctx.fill();
      }
      ctx.strokeStyle = css(line);
      ctx.lineWidth = Math.max(1.5, hw * 0.045);
      ctx.stroke();
    }
  }
  return cv;
};

/** Faceted low-poly crystal. a = grid, b = shading contrast. */
const shards: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  const g = Math.round(p.a ?? 7);
  const contrast = p.b ?? 0.55;
  const [cv, ctx] = makeCanvas(VX, VX);
  const cell = VX / g;
  const pt = (i: number, j: number): [number, number] => {
    const wi = mod(i, g);
    const wj = mod(j, g);
    return [(i + 0.5 + (cellHash(wi, wj, s) - 0.5) * 0.8) * cell, (j + 0.5 + (cellHash(wi, wj, s + 7) - 0.5) * 0.8) * cell];
  };
  for (let j = -1; j <= g; j++) {
    for (let i = -1; i <= g; i++) {
      const A = pt(i, j);
      const B = pt(i + 1, j);
      const C = pt(i + 1, j + 1);
      const D = pt(i, j + 1);
      const flip = cellHash(mod(i, g), mod(j, g), s + 3) > 0.5;
      const tris = flip ? [[A, B, D], [B, C, D]] : [[A, B, C], [A, C, D]];
      tris.forEach((t, k) => {
        const h = cellHash(mod(i, g) * 2 + k, mod(j, g), s + 11);
        const base = c[Math.floor(h * c.length) % c.length];
        const sh = 1 - contrast / 2 + cellHash(mod(i, g), mod(j, g) * 2 + k, s + 13) * contrast;
        const gx = ctx.createLinearGradient(t[0][0], t[0][1], t[2][0], t[2][1]);
        gx.addColorStop(0, css(scale(base, sh * 1.15)));
        gx.addColorStop(1, css(scale(base, sh * 0.8)));
        ctx.fillStyle = gx;
        ctx.strokeStyle = css(scale(base, sh * 1.4), 0.55);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(t[0][0], t[0][1]);
        ctx.lineTo(t[1][0], t[1][1]);
        ctx.lineTo(t[2][0], t[2][1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
    }
  }
  return cv;
};

/** Printed-circuit traces. colors: board, trace, pad / glow. a = grid, b = trace count. */
const circuit: Gen = (p) => {
  const c = pal(p);
  const r = mulberry32(p.seed ?? 1);
  const n = Math.round(p.a ?? 40);
  const count = Math.round(p.b ?? 70);
  const [cv, ctx] = makeCanvas(VX, VX);
  const cell = VX / n;
  ctx.fillStyle = css(c[0]);
  ctx.fillRect(0, 0, VX, VX);
  ctx.fillStyle = css(scale(c[0], 1.5), 0.6);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) ctx.fillRect(i * cell - 1, j * cell - 1, 2, 2);
  const dirs: [number, number][] = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];
  const traces: { pts: [number, number][]; w: number; hot: boolean }[] = [];
  for (let t = 0; t < count; t++) {
    let x = Math.floor(r() * n);
    let y = Math.floor(r() * n);
    let d = Math.floor(r() * 4) * 2;
    const ptsList: [number, number][] = [[x * cell, y * cell]];
    const segs = 2 + Math.floor(r() * 4);
    for (let k = 0; k < segs; k++) {
      const len = 2 + Math.floor(r() * 7);
      x += dirs[d][0] * len;
      y += dirs[d][1] * len;
      ptsList.push([x * cell, y * cell]);
      d = mod(d + (r() < 0.5 ? 1 : -1), 8);
    }
    traces.push({ pts: ptsList, w: cell * (0.12 + r() * 0.16), hot: r() < 0.28 });
  }
  tiled(ctx, VX, VX, () => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const t of traces) {
      ctx.strokeStyle = css(t.hot ? c[2] : c[1]);
      ctx.lineWidth = t.w;
      ctx.beginPath();
      t.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.stroke();
      for (const q of [t.pts[0], t.pts[t.pts.length - 1]]) {
        ctx.fillStyle = css(t.hot ? c[2] : c[1]);
        ctx.beginPath();
        ctx.arc(q[0], q[1], t.w * 1.6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = css(c[0]);
        ctx.beginPath();
        ctx.arc(q[0], q[1], t.w * 0.7, 0, TAU);
        ctx.fill();
      }
    }
  });
  // chips
  for (let i = 0; i < 9; i++) {
    const w = (2 + Math.floor(r() * 4)) * cell;
    const h = (2 + Math.floor(r() * 3)) * cell;
    const x = Math.floor(r() * (n - 6)) * cell;
    const y = Math.floor(r() * (n - 5)) * cell;
    ctx.fillStyle = css(scale(c[0], 0.55));
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = css(c[1], 0.9);
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }
  return cv;
};

/** Overlapping wave fans. colors: bg, line, alt fill. a = columns, b = rings. */
const waves: Gen = (p) => {
  const c = pal(p);
  const cols = Math.round(p.a ?? 7);
  const rings = Math.round(p.b ?? 4);
  const [cv, ctx] = makeCanvas(VX, VX);
  ctx.fillStyle = css(c[0]);
  ctx.fillRect(0, 0, VX, VX);
  const R = VX / cols / 2;
  const rows = cols * 4;
  const step = VX / rows;
  for (let row = -4; row <= rows + 2; row++) {
    for (let col = -1; col <= cols + 1; col++) {
      const x = (col + (mod(row, 2) ? 0.5 : 0)) * R * 2;
      const y = row * step;
      for (let k = 0; k < rings; k++) {
        const rr = R * (1 - k / rings);
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, TAU);
        ctx.fillStyle = css(k % 2 ? (c[2] ?? c[0]) : c[0]);
        ctx.fill();
        ctx.strokeStyle = css(c[1]);
        ctx.lineWidth = Math.max(1.5, R * 0.05);
        ctx.stroke();
      }
    }
  }
  return cv;
};

/** Reptile scales. colors: base, rim, highlight. a = columns. */
const scales: Gen = (p) => {
  const c = pal(p);
  const s = p.seed ?? 1;
  const cols = Math.round(p.a ?? 11);
  const [cv, ctx] = makeCanvas(VX, VX);
  ctx.fillStyle = css(scale(c[0], 0.5));
  ctx.fillRect(0, 0, VX, VX);
  const w = VX / cols;
  const rows = Math.round(VX / (w * 0.62) / 2) * 2;
  const rh = VX / rows;
  const R = w * 0.56;
  for (let row = rows + 2; row >= -2; row--) {
    for (let col = -1; col <= cols + 1; col++) {
      const x = (col + (mod(row, 2) ? 0.5 : 0)) * w;
      const y = row * rh;
      const h = cellHash(mod(col, cols), mod(row, rows), s);
      const g = ctx.createRadialGradient(x, y - R * 0.5, R * 0.1, x, y, R);
      g.addColorStop(0, css(scale(c[0], 0.45 + h * 0.25)));
      g.addColorStop(0.72, css(scale(c[0], 0.9 + h * 0.3)));
      g.addColorStop(0.93, css(c[2] ?? c[1]));
      g.addColorStop(1, css(c[1]));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = css(scale(c[0], 0.3), 0.9);
      ctx.lineWidth = Math.max(1.5, w * 0.03);
      ctx.stroke();
    }
  }
  return cv;
};

/** Diagonal racing bands. colors: bg, band A, band B, pinstripe. a = repeats. */
const stripes: Gen = (p) => {
  const c = pal(p);
  const reps = Math.round(p.a ?? 2);
  const [cv, ctx] = makeCanvas(VX, VX);
  ctx.fillStyle = css(c[0]);
  ctx.fillRect(0, 0, VX, VX);
  const P = VX / reps;
  const band = (off: number, w: number, col: RGB) => {
    ctx.fillStyle = css(col);
    for (let k = -reps - 1; k <= reps + 1; k++) {
      const x = k * P + off * P;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + w * P, 0);
      ctx.lineTo(x + w * P + VX, VX);
      ctx.lineTo(x + VX, VX);
      ctx.closePath();
      ctx.fill();
    }
  };
  band(0.08, 0.3, c[1]);
  band(0.44, 0.1, c[2] ?? c[1]);
  band(0.58, 0.035, c[3] ?? c[1]);
  band(0.02, 0.02, c[3] ?? c[2] ?? c[1]);
  band(0.66, 0.012, c[3] ?? c[1]);
  return cv;
};

/** Industrial warning livery: chevrons, panel breaks and stencilled labels. colors: body, stripe dark, stripe bright, text. */
const hazard: Gen = (p) => {
  const c = pal(p);
  const r = mulberry32(p.seed ?? 1);
  const [cv, ctx] = makeCanvas(VX, VX);
  ctx.fillStyle = css(c[0]);
  ctx.fillRect(0, 0, VX, VX);
  speckle(ctx, r, 5000, scale(c[0], 0.7), 0.35, 2);
  // two chevron bands
  for (const [y0, h] of [
    [VX * 0.16, VX * 0.2],
    [VX * 0.68, VX * 0.11],
  ] as const) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, VX, h);
    ctx.clip();
    ctx.fillStyle = css(c[2]);
    ctx.fillRect(0, y0, VX, h);
    ctx.fillStyle = css(c[1]);
    const w = VX / 16;
    for (let k = -4; k < 36; k += 2) {
      ctx.beginPath();
      ctx.moveTo(k * w, y0);
      ctx.lineTo((k + 1) * w, y0);
      ctx.lineTo((k + 1) * w + h, y0 + h);
      ctx.lineTo(k * w + h, y0 + h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = css(c[1]);
    ctx.fillRect(0, y0 - 6, VX, 6);
    ctx.fillRect(0, y0 + h, VX, 6);
  }
  ctx.fillStyle = css(c[3] ?? c[2]);
  ctx.textBaseline = 'middle';
  const words = ['CAUTION', 'LOT 47-B', 'PRESSURE RATED', 'DO NOT STACK', 'INSPECTED', 'UNIT 09', 'HANDLE WITH CARE', 'KEEP DRY'];
  for (let i = 0; i < 9; i++) {
    const size = 34 + Math.floor(r() * 46);
    ctx.font = `700 ${size}px "Barlow Condensed", "Arial Narrow", Impact, sans-serif`;
    const text = pick(r, words);
    const x = r() * VX;
    const y = pick(r, [0.07, 0.46, 0.56, 0.88, 0.95]) * VX;
    ctx.globalAlpha = 0.75 + r() * 0.25;
    ctx.fillText(text, x, y);
    ctx.fillText(text, x - VX, y);
    ctx.globalAlpha = 1;
  }
  // panel breaks
  ctx.strokeStyle = css(scale(c[0], 0.45));
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const x = Math.round(r() * VX);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, VX);
    ctx.stroke();
  }
  return cv;
};

/** Thrown paint. colors: base then paints. a = blobs per colour. */
const splatter: Gen = (p) => {
  const c = pal(p);
  const r = mulberry32(p.seed ?? 1);
  const n = Math.round(p.a ?? 14);
  const [cv, ctx] = makeCanvas(VX, VX);
  ctx.fillStyle = css(c[0]);
  ctx.fillRect(0, 0, VX, VX);
  const ops: (() => void)[] = [];
  for (let ci = 1; ci < c.length; ci++) {
    for (let i = 0; i < n; i++) {
      const x = r() * VX;
      const y = r() * VX;
      const R = 14 + r() * r() * 110;
      const col = css(scale(c[ci], 0.85 + r() * 0.3));
      const drops: [number, number, number][] = [];
      const k = 6 + Math.floor(r() * 16);
      for (let d = 0; d < k; d++) {
        const a = r() * TAU;
        const dist = R * (0.9 + r() * r() * 2.6);
        drops.push([x + Math.cos(a) * dist, y + Math.sin(a) * dist, R * (0.04 + r() * 0.2)]);
      }
      const lobes: [number, number, number][] = [];
      for (let d = 0; d < 7; d++) {
        const a = r() * TAU;
        lobes.push([x + Math.cos(a) * R * 0.55, y + Math.sin(a) * R * 0.55, R * (0.45 + r() * 0.4)]);
      }
      const drip = r() < 0.4 ? { len: R * (1 + r() * 3), w: R * (0.08 + r() * 0.1), dx: (r() - 0.5) * R } : null;
      ops.push(() => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x, y, R * 0.8, 0, TAU);
        ctx.fill();
        for (const l of lobes) {
          ctx.beginPath();
          ctx.arc(l[0], l[1], l[2], 0, TAU);
          ctx.fill();
        }
        for (const d of drops) {
          ctx.beginPath();
          ctx.arc(d[0], d[1], d[2], 0, TAU);
          ctx.fill();
        }
        if (drip) {
          ctx.strokeStyle = col;
          ctx.lineCap = 'round';
          ctx.lineWidth = drip.w;
          ctx.beginPath();
          ctx.moveTo(x + drip.dx, y);
          ctx.lineTo(x + drip.dx, y + drip.len);
          ctx.stroke();
        }
      });
    }
  }
  tiled(ctx, VX, VX, () => ops.forEach((f) => f()));
  return cv;
};

/** Glowing wireframe grid. colors: bg top, bg bottom, line, accent line. a = divisions. */
const neongrid: Gen = (p) => {
  const c = pal(p);
  const n = Math.round(p.a ?? 12);
  const [cv, ctx] = makeCanvas(VX, VX);
  const g = ctx.createLinearGradient(0, 0, 0, VX);
  g.addColorStop(0, css(c[0]));
  g.addColorStop(0.5, css(c[1]));
  g.addColorStop(1, css(c[0]));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VX, VX);
  const step = VX / n;
  const lineAt = (horizontal: boolean, pos: number, col: RGB, w: number) => {
    for (const [lw, a] of [
      [w * 7, 0.1],
      [w * 3, 0.25],
      [w, 1],
    ] as const) {
      ctx.strokeStyle = css(col, a);
      ctx.lineWidth = lw;
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(0, pos);
        ctx.lineTo(VX, pos);
      } else {
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, VX);
      }
      ctx.stroke();
    }
  };
  for (let i = 0; i <= n; i++) {
    const accent = i % 4 === 0;
    lineAt(true, i * step, accent ? (c[3] ?? c[2]) : c[2], accent ? 3.2 : 2);
    lineAt(false, i * step, accent ? (c[3] ?? c[2]) : c[2], accent ? 3.2 : 2);
  }
  return cv;
};

function crackPath(r: Rand, x: number, y: number, ang: number, len: number, out: { pts: [number, number][]; w: number }[], w: number, depth: number) {
  const ptsList: [number, number][] = [[x, y]];
  const steps = Math.max(3, Math.floor(len / 26));
  for (let i = 0; i < steps; i++) {
    ang += (r() - 0.5) * 0.9;
    x += Math.cos(ang) * (len / steps);
    y += Math.sin(ang) * (len / steps);
    ptsList.push([x, y]);
    if (depth < 2 && r() < 0.11) crackPath(r, x, y, ang + (r() < 0.5 ? 1 : -1) * (0.5 + r() * 0.8), len * (0.3 + r() * 0.35), out, w * 0.6, depth + 1);
  }
  out.push({ pts: ptsList, w });
}

/** Gold-filled crack network. colors: lacquer, gold dark, gold bright. a = crack count. */
const kintsugi: Gen = (p) => {
  const c = pal(p);
  const r = mulberry32(p.seed ?? 1);
  const n = Math.round(p.a ?? 5);
  const [cv, ctx] = makeCanvas(VX, VX);
  ctx.fillStyle = css(c[0]);
  ctx.fillRect(0, 0, VX, VX);
  speckle(ctx, r, 9000, scale(c[0], 1.5), 0.25, 1.6);
  const cracks: { pts: [number, number][]; w: number }[] = [];
  for (let i = 0; i < n; i++) crackPath(r, r() * VX, r() * VX, r() * TAU, 520 + r() * 620, cracks, 11 + r() * 7, 0);
  tiled(ctx, VX, VX, () => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const pass of [0, 1]) {
      for (const k of cracks) {
        ctx.strokeStyle = css(pass ? c[2] : c[1]);
        ctx.lineWidth = pass ? k.w * 0.45 : k.w;
        ctx.beginPath();
        k.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        ctx.stroke();
      }
    }
  });
  return cv;
};

/** Engraved scrollwork. colors: ground, line dark, line bright. a = scroll count. */
const scroll: Gen = (p) => {
  const c = pal(p);
  const r = mulberry32(p.seed ?? 1);
  const n = Math.round(p.a ?? 22);
  const [cv, ctx] = makeCanvas(VX, VX);
  ctx.fillStyle = css(c[0]);
  ctx.fillRect(0, 0, VX, VX);
  // punched background
  ctx.fillStyle = css(scale(c[0], 0.55), 0.9);
  for (let i = 0; i < 16000; i++) {
    ctx.beginPath();
    ctx.arc(r() * VX, r() * VX, 0.8 + r() * 1.2, 0, TAU);
    ctx.fill();
  }
  const curls: { x: number; y: number; rot: number; size: number; dir: number; leaves: number }[] = [];
  for (let i = 0; i < n; i++) curls.push({ x: r() * VX, y: r() * VX, rot: r() * TAU, size: 60 + r() * 120, dir: r() < 0.5 ? 1 : -1, leaves: 2 + Math.floor(r() * 4) });
  const drawCurl = (k: (typeof curls)[number], col: RGB, wMul: number) => {
    ctx.strokeStyle = css(col);
    ctx.fillStyle = css(col);
    ctx.lineCap = 'round';
    const turns = 2.1;
    const steps = 46;
    let px = 0;
    let py = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = k.rot + k.dir * t * turns * TAU;
      const rad = k.size * (1 - t * 0.93);
      const x = k.x + Math.cos(a) * rad;
      const y = k.y + Math.sin(a) * rad;
      if (i > 0) {
        ctx.lineWidth = (1.5 + (1 - t) * 8) * wMul;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      px = x;
      py = y;
    }
    // acanthus leaves off the outer sweep
    for (let l = 0; l < k.leaves; l++) {
      const t = 0.04 + l * 0.085;
      const a = k.rot + k.dir * t * turns * TAU;
      const rad = k.size * (1 - t * 0.93);
      const x = k.x + Math.cos(a) * rad;
      const y = k.y + Math.sin(a) * rad;
      const out = a + k.dir * 0.5;
      const len = k.size * 0.42 * wMul ** 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(out - 0.5) * len * 0.7, y + Math.sin(out - 0.5) * len * 0.7, x + Math.cos(out) * len, y + Math.sin(out) * len);
      ctx.quadraticCurveTo(x + Math.cos(out + 0.6) * len * 0.5, y + Math.sin(out + 0.6) * len * 0.5, x, y);
      ctx.fill();
    }
  };
  tiled(ctx, VX, VX, () => {
    for (const k of curls) drawCurl(k, c[1], 1);
    for (const k of curls) drawCurl(k, c[2] ?? c[1], 0.45);
  });
  return cv;
};

/** Riveted hull plating. colors: plate A, plate B, seam, marking. a = subdivision depth. */
const plates: Gen = (p) => {
  const c = pal(p);
  const r = mulberry32(p.seed ?? 1);
  const depth = Math.round(p.a ?? 5);
  const [cv, ctx] = makeCanvas(VX, VX);
  const rects: [number, number, number, number][] = [];
  const split = (x: number, y: number, w: number, h: number, d: number) => {
    if (d <= 0 || (w < 110 && h < 110) || (d < depth - 1 && r() < 0.16)) {
      rects.push([x, y, w, h]);
      return;
    }
    if (w > h) {
      const k = Math.round((0.32 + r() * 0.36) * w);
      split(x, y, k, h, d - 1);
      split(x + k, y, w - k, h, d - 1);
    } else {
      const k = Math.round((0.32 + r() * 0.36) * h);
      split(x, y, w, k, d - 1);
      split(x, y + k, w, h - k, d - 1);
    }
  };
  split(0, 0, VX, VX, depth);
  for (const [x, y, w, h] of rects) {
    const base = r() < 0.72 ? c[0] : c[1];
    const g = ctx.createLinearGradient(x, y, x, y + h);
    const k = 0.88 + r() * 0.24;
    g.addColorStop(0, css(scale(base, k * 1.08)));
    g.addColorStop(1, css(scale(base, k * 0.92)));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = css(c[2]);
    ctx.lineWidth = 5;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = css(scale(base, 1.5), 0.5);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
    // rivets
    ctx.fillStyle = css(scale(base, 0.55));
    const m = 14;
    for (const [rx, ry] of [
      [x + m, y + m],
      [x + w - m, y + m],
      [x + m, y + h - m],
      [x + w - m, y + h - m],
    ]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 3.6, 0, TAU);
      ctx.fill();
    }
    const roll = r();
    if (roll < 0.18 && w > 120) {
      // vent slots
      ctx.fillStyle = css(c[2]);
      const nSlots = 3 + Math.floor(r() * 3);
      for (let i = 0; i < nSlots; i++) ctx.fillRect(x + w * 0.2, y + h * 0.3 + i * 13, w * 0.6, 6);
    } else if (roll < 0.34) {
      ctx.fillStyle = css(c[3] ?? c[1]);
      ctx.fillRect(x + 22, y + h - 34, Math.min(w - 44, 90), 10);
    } else if (roll < 0.46 && h > 70) {
      ctx.fillStyle = css(c[3] ?? c[1], 0.9);
      ctx.font = `700 ${Math.min(52, h * 0.4) | 0}px "Barlow Condensed", "Arial Narrow", Impact, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(String(Math.floor(r() * 90) + 10), x + 22, y + 20);
    }
  }
  return cv;
};

/** Smooth multi-stop fade along the length. Not tileable: use mirrored wrapping. a = angle in degrees. */
const fade: Gen = (p) => {
  const c = pal(p);
  const r = mulberry32(p.seed ?? 1);
  const [cv, ctx] = makeCanvas(VX, VX / 2);
  const ang = ((p.a ?? 0) * Math.PI) / 180;
  const dx = Math.cos(ang) * VX;
  const dy = Math.sin(ang) * VX;
  const g = ctx.createLinearGradient(0, VX / 4 - dy / 2, dx, VX / 4 + dy / 2);
  c.forEach((col, i) => g.addColorStop(i / (c.length - 1), css(col)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VX, VX / 2);
  // fine brushed streaks so the gradient does not band
  for (let i = 0; i < 2600; i++) {
    const y = r() * (VX / 2);
    const x = r() * VX;
    ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)';
    ctx.fillRect(x, y, 40 + r() * 220, 1);
  }
  return cv;
};

/** Technical drawing. colors: paper, line, accent. */
const blueprint: Gen = (p) => {
  const c = pal(p);
  const r = mulberry32(p.seed ?? 1);
  const [cv, ctx] = makeCanvas(VX, VX);
  ctx.fillStyle = css(c[0]);
  ctx.fillRect(0, 0, VX, VX);
  const step = VX / 32;
  for (let i = 0; i <= 32; i++) {
    ctx.strokeStyle = css(c[1], i % 4 === 0 ? 0.34 : 0.13);
    ctx.lineWidth = i % 4 === 0 ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, VX);
    ctx.moveTo(0, i * step);
    ctx.lineTo(VX, i * step);
    ctx.stroke();
  }
  const ops: (() => void)[] = [];
  const labels = ['R 12.5', 'SECTION A-A', 'DETAIL 3', 'Ø 9.02', 'TOL ±0.05', 'REV C', '1:2', 'DATUM B', 'M4 x 0.7'];
  for (let i = 0; i < 12; i++) {
    const x = Math.round((r() * 30 + 1)) * step;
    const y = Math.round((r() * 30 + 1)) * step;
    const kind = Math.floor(r() * 4);
    const R = step * (1.5 + Math.floor(r() * 4));
    const col = r() < 0.2 ? (c[2] ?? c[1]) : c[1];
    const label = pick(r, labels);
    ops.push(() => {
      ctx.strokeStyle = css(col, 0.95);
      ctx.fillStyle = css(col, 0.95);
      ctx.lineWidth = 2.2;
      if (kind === 0) {
        ctx.beginPath();
        ctx.arc(x, y, R, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, R * 0.55, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([14, 6, 3, 6]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x - R * 1.4, y);
        ctx.lineTo(x + R * 1.4, y);
        ctx.moveTo(x, y - R * 1.4);
        ctx.lineTo(x, y + R * 1.4);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (kind === 1) {
        ctx.strokeRect(x, y, R * 2.4, R * 1.2);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let h = 0; h < 9; h++) {
          ctx.moveTo(x + h * R * 0.3, y + R * 1.2);
          ctx.lineTo(x + h * R * 0.3 + R * 0.3, y + R * 0.9);
        }
        ctx.stroke();
      } else if (kind === 2) {
        // dimension line
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + R * 3, y);
        ctx.moveTo(x, y - 9);
        ctx.lineTo(x, y + 9);
        ctx.moveTo(x + R * 3, y - 9);
        ctx.lineTo(x + R * 3, y + 9);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 12, y - 4);
        ctx.lineTo(x + 12, y + 4);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + R * 2, y);
        ctx.lineTo(x + R * 2.6, y + R);
        ctx.lineTo(x + R * 0.6, y + R * 1.6);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.font = `600 22px "IBM Plex Mono", ui-monospace, Consolas, monospace`;
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, x + 6, y - 8);
    });
  }
  tiled(ctx, VX, VX, () => ops.forEach((f) => f()));
  return cv;
};

function bolt(r: Rand, x0: number, y0: number, x1: number, y1: number, disp: number, out: [number, number][][], depth: number) {
  let ptsList: [number, number][] = [
    [x0, y0],
    [x1, y1],
  ];
  let d = disp;
  for (let it = 0; it < 6; it++) {
    const next: [number, number][] = [];
    for (let i = 0; i < ptsList.length - 1; i++) {
      const a = ptsList[i];
      const b = ptsList[i + 1];
      const mx = (a[0] + b[0]) / 2 + (r() - 0.5) * d;
      const my = (a[1] + b[1]) / 2 + (r() - 0.5) * d;
      next.push(a, [mx, my]);
      if (depth < 2 && it === 2 && r() < 0.45) {
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + (r() - 0.5) * 1.6;
        const len = Math.hypot(x1 - x0, y1 - y0) * (0.25 + r() * 0.3);
        bolt(r, mx, my, mx + Math.cos(ang) * len, my + Math.sin(ang) * len, d * 0.7, out, depth + 1);
      }
    }
    next.push(ptsList[ptsList.length - 1]);
    ptsList = next;
    d *= 0.52;
  }
  out.push(ptsList);
}

/** Branching electrical arcs. colors: bg, halo, core. a = bolt count. */
const lightning: Gen = (p) => {
  const c = pal(p);
  const r = mulberry32(p.seed ?? 1);
  const n = Math.round(p.a ?? 6);
  const [cv, ctx] = makeCanvas(VX, VX);
  ctx.fillStyle = css(c[0]);
  ctx.fillRect(0, 0, VX, VX);
  for (let i = 0; i < 10; i++) {
    const x = r() * VX;
    const y = r() * VX;
    const R = 160 + r() * 260;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, css(c[1], 0.16));
    g.addColorStop(1, css(c[1], 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - R, y - R, R * 2, R * 2);
  }
  const bolts: [number, number][][] = [];
  for (let i = 0; i < n; i++) {
    const x = r() * VX;
    const y = r() * VX;
    const a = r() * TAU;
    const len = 380 + r() * 420;
    bolt(r, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, len * 0.34, bolts, 0);
  }
  tiled(ctx, VX, VX, () => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const [w, col, a] of [
      [16, c[1], 0.12],
      [7, c[1], 0.35],
      [2.6, c[2], 1],
    ] as const) {
      ctx.strokeStyle = css(col, a);
      ctx.lineWidth = w;
      for (const b of bolts) {
        ctx.beginPath();
        b.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        ctx.stroke();
      }
    }
  });
  return cv;
};

/** Dry-brush strokes. colors: ground then paints. a = strokes per colour. */
const brush: Gen = (p) => {
  const c = pal(p);
  const r = mulberry32(p.seed ?? 1);
  const n = Math.round(p.a ?? 7);
  const [cv, ctx] = makeCanvas(VX, VX);
  ctx.fillStyle = css(c[0]);
  ctx.fillRect(0, 0, VX, VX);
  const strokes: { col: RGB; x: number; y: number; a: number; len: number; w: number; bend: number; gaps: number[] }[] = [];
  for (let ci = 1; ci < c.length; ci++) {
    for (let i = 0; i < n; i++) {
      const gaps: number[] = [];
      for (let k = 0; k < 34; k++) gaps.push(r());
      strokes.push({ col: c[ci], x: r() * VX, y: r() * VX, a: (r() - 0.5) * 1.2 + (r() < 0.5 ? 0 : Math.PI), len: 260 + r() * 520, w: 40 + r() * 110, bend: (r() - 0.5) * 220, gaps });
    }
  }
  tiled(ctx, VX, VX, () => {
    ctx.lineCap = 'round';
    for (const s of strokes) {
      const nx = -Math.sin(s.a);
      const ny = Math.cos(s.a);
      for (let k = 0; k < 34; k++) {
        const off = (k / 33 - 0.5) * s.w;
        const g = s.gaps[k];
        const start = g * 0.22;
        const end = 1 - s.gaps[(k + 11) % 34] * 0.4;
        ctx.strokeStyle = css(scale(s.col, 0.8 + g * 0.4), 0.55 + g * 0.45);
        ctx.lineWidth = s.w / 26;
        ctx.beginPath();
        const sx = s.x + nx * off + Math.cos(s.a) * s.len * start;
        const sy = s.y + ny * off + Math.sin(s.a) * s.len * start;
        const ex = s.x + nx * off + Math.cos(s.a) * s.len * end;
        const ey = s.y + ny * off + Math.sin(s.a) * s.len * end;
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo((sx + ex) / 2 + nx * s.bend, (sy + ey) / 2 + ny * s.bend, ex, ey);
        ctx.stroke();
      }
    }
  });
  return cv;
};

/** Bold scattered geometry. colors: ground then shapes. a = shape count. */
const geo: Gen = (p) => {
  const c = pal(p);
  const r = mulberry32(p.seed ?? 1);
  const n = Math.round(p.a ?? 46);
  const [cv, ctx] = makeCanvas(VX, VX);
  ctx.fillStyle = css(c[0]);
  ctx.fillRect(0, 0, VX, VX);
  const shapes: { k: number; x: number; y: number; s: number; rot: number; col: RGB }[] = [];
  for (let i = 0; i < n; i++) shapes.push({ k: Math.floor(r() * 6), x: r() * VX, y: r() * VX, s: 26 + r() * 90, rot: r() * TAU, col: c[1 + Math.floor(r() * (c.length - 1))] });
  tiled(ctx, VX, VX, () => {
    for (const s of shapes) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.fillStyle = css(s.col);
      ctx.strokeStyle = css(s.col);
      ctx.lineWidth = s.s * 0.16;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (s.k === 0) {
        ctx.arc(0, 0, s.s * 0.5, 0, TAU);
        ctx.fill();
      } else if (s.k === 1) {
        ctx.moveTo(0, -s.s * 0.6);
        ctx.lineTo(s.s * 0.55, s.s * 0.45);
        ctx.lineTo(-s.s * 0.55, s.s * 0.45);
        ctx.closePath();
        ctx.fill();
      } else if (s.k === 2) {
        for (let i = 0; i < 6; i++) {
          const x = (i - 2.5) * s.s * 0.32;
          const y = i % 2 ? s.s * 0.2 : -s.s * 0.2;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
      } else if (s.k === 3) {
        ctx.arc(0, 0, s.s * 0.45, 0, TAU);
        ctx.stroke();
      } else if (s.k === 4) {
        ctx.fillRect(-s.s * 0.6, -s.s * 0.1, s.s * 1.2, s.s * 0.2);
      } else {
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) ctx.fillRect((i - 1) * s.s * 0.34 - 4, (j - 1) * s.s * 0.34 - 4, 8, 8);
      }
      ctx.restore();
    }
  });
  return cv;
};

/** Flat colour with fine fleck: the canvas for plain painted finishes. colors: base, fleck. */
const fleck: Gen = (p) => {
  const c = pal(p);
  const r = mulberry32(p.seed ?? 1);
  const [cv, ctx] = makeCanvas(PX, PX);
  ctx.fillStyle = css(c[0]);
  ctx.fillRect(0, 0, PX, PX);
  speckle(ctx, r, 9000, c[1] ?? scale(c[0], 1.4), 0.5, 1.2);
  speckle(ctx, r, 5000, scale(c[0], 0.6), 0.4, 1.2);
  return cv;
};

export const PATTERNS: Record<string, { fn: Gen; wrap: Wrap }> = {
  camo: { fn: camo, wrap: 'repeat' },
  digital: { fn: digital, wrap: 'repeat' },
  tiger: { fn: tiger, wrap: 'repeat' },
  topo: { fn: topo, wrap: 'repeat' },
  marble: { fn: marble, wrap: 'repeat' },
  patina: { fn: patina, wrap: 'repeat' },
  nebula: { fn: nebula, wrap: 'repeat' },
  magma: { fn: magma, wrap: 'repeat' },
  damascus: { fn: damascus, wrap: 'repeat' },
  meteorite: { fn: meteorite, wrap: 'repeat' },
  frost: { fn: frost, wrap: 'repeat' },
  aurora: { fn: aurora, wrap: 'repeat' },
  glass: { fn: glass, wrap: 'repeat' },
  rosette: { fn: rosette, wrap: 'repeat' },
  weave: { fn: weave, wrap: 'repeat' },
  hexgrid: { fn: hexgrid, wrap: 'repeat' },
  shards: { fn: shards, wrap: 'repeat' },
  circuit: { fn: circuit, wrap: 'repeat' },
  waves: { fn: waves, wrap: 'repeat' },
  scales: { fn: scales, wrap: 'repeat' },
  stripes: { fn: stripes, wrap: 'repeat' },
  hazard: { fn: hazard, wrap: 'repeat' },
  splatter: { fn: splatter, wrap: 'repeat' },
  neongrid: { fn: neongrid, wrap: 'repeat' },
  kintsugi: { fn: kintsugi, wrap: 'repeat' },
  scroll: { fn: scroll, wrap: 'repeat' },
  plates: { fn: plates, wrap: 'repeat' },
  fade: { fn: fade, wrap: 'mirror' },
  blueprint: { fn: blueprint, wrap: 'repeat' },
  lightning: { fn: lightning, wrap: 'repeat' },
  brush: { fn: brush, wrap: 'repeat' },
  geo: { fn: geo, wrap: 'repeat' },
  fleck: { fn: fleck, wrap: 'repeat' },
};

export type PatternName = keyof typeof PATTERNS;

export function patternKey(name: string, p: PatternParams): string {
  return `${name}|${p.colors.join(',')}|${p.seed ?? 1}|${p.a ?? ''}|${p.b ?? ''}|${p.c ?? ''}`;
}

export function drawPattern(name: string, p: PatternParams): HTMLCanvasElement {
  const def = PATTERNS[name];
  if (!def) throw new Error(`Unknown pattern "${name}"`);
  return def.fn({ ...p, seed: p.seed ?? (hashString(name) % 9973) + 1 });
}
