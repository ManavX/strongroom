/**
 * Sentry-9: striker-fired polymer service pistol.
 * Authored in mm. x = 0 at the rear face of the slide, bore axis on y = 0.
 */
import * as THREE from 'three';
import { Builder, alongY, box, circle, pinZ, plate, poly, pts, rect, rod, rotate2, shift, slot, studZ, tube, warp, xf, type BuiltModel, type P2, type V2 } from '../kit';

const SW = 12.7; // slide half-width
const ST = 9.5; // slide top
const SB = -13.5; // slide bottom
const FL = SW - 0.45; // slide flank above the rail band
const FW = 12.3; // frame half-width
const GW = 15; // grip half-width

/** Mirror a right-hand half profile (bottom to top) into a closed zy outline. */
function sym(right: P2[]): V2[] {
  const left = [...right].reverse().map(([z, y, r]) => [-z, y, r] as P2);
  return poly([...right, ...left]);
}

/** Prism along X from a zy outline with square ends (butt-joins seamlessly). */
const seg = (o: V2[], x0: number, x1: number) => plate(o, { t: x1 - x0, plane: 'zy', at: (x0 + x1) / 2, bevel: 0 });
/** Rounded end cap for a `seg`: half of it is buried in the segment behind it. */
const cap = (o: V2[], x: number, dir: 1 | -1, r = 0.8) => plate(o, { t: 2 * r + 0.04, plane: 'zy', at: x - dir * (r + 0.02), bevel: r, bevelSegs: 3 });

/** Force an outline counter-clockwise so ExtrudeGeometry fixes the winding of its holes. */
function ccw(o: V2[]): V2[] {
  let area = 0;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) area += o[j].x * o[i].y - o[i].x * o[j].y;
  return area < 0 ? [...o].reverse() : o;
}

/** Clearance of a point inside a closed outline (negative when outside). */
function clearance(o: V2[], x: number, y: number): number {
  let inside = false;
  let d = Infinity;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const a = o[i];
    const c = o[j];
    if (a.y > y !== c.y > y && x < ((c.x - a.x) * (y - a.y)) / (c.y - a.y) + a.x) inside = !inside;
    const ex = c.x - a.x;
    const ey = c.y - a.y;
    const t = THREE.MathUtils.clamp(((x - a.x) * ex + (y - a.y) * ey) / (ex * ex + ey * ey || 1), 0, 1);
    d = Math.min(d, Math.hypot(x - a.x - ex * t, y - a.y - ey * t));
  }
  return inside ? d : -d;
}

/** Slide cross-section; g > 0 cuts the serration groove into both flanks. */
function slideProf(g = 0): V2[] {
  const p1: [number, number] = [FL, 3];
  const p2: [number, number] = [9.4, ST];
  if (g <= 0) return sym([[SW, SB, 0.5], [SW, -10.7], [FL, -10.25], [p1[0], p1[1], 0.8], [p2[0], p2[1], 1.4]]);
  const dz = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const len = Math.hypot(dz, dy);
  const nz = dy / len;
  const ny = -dz / len;
  const f = 0.7;
  return sym([
    [SW, SB, 0.5],
    [SW, -10.7],
    [FL - g, -10.25 + g],
    [FL - g, p1[1] - 0.24 * g],
    [p1[0] + dz * f - nz * g, p1[1] + dy * f - ny * g],
    [p1[0] + dz * (f + 0.1), p1[1] + dy * (f + 0.1)],
    [p2[0], p2[1], 1.4],
  ]);
}

export function buildSentry(): BuiltModel {
  const b = new Builder();
  const full = slideProf();
  const groove = slideProf(0.75);

  /* ---------------- slide ---------------- */
  const SL = 176; // slide length
  const PORT0 = 74;
  const PORT1 = 105;
  const YP = 0.6; // lower edge of the ejection port
  const ZL = -6; // left edge of the port on the top flat
  const R = 0.9; // end rounding
  const serrated = (x0: number, x1: number, n: number, gw: number) => {
    const pitch = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const a = x0 + i * pitch;
      b.add('body', seg(groove, a, a + gw), seg(full, a + gw, a + pitch));
    }
  };
  b.add('body', cap(full, 0, -1, R), seg(full, R + 0.02, 7));
  serrated(7, 39.4, 9, 1.7);
  b.add('body', seg(full, 39.4, PORT0));
  b.add(
    'body',
    seg(
      poly([
        [-SW, SB, 0.5],
        [SW, SB, 0.5],
        [SW, -10.7],
        [FL, -10.25],
        [FL, YP, 0.5],
        [ZL, YP],
        [ZL, ST],
        [-9.4, ST, 1.4],
        [-FL, 3, 0.8],
        [-FL, -10.25],
        [-SW, -10.7],
      ]),
      PORT0,
      PORT1,
    ),
  );
  b.add('body', seg(full, PORT1, 137.4));
  serrated(137.4, 159, 6, 1.7);
  b.add('body', seg(full, 159, SL - R - 0.02), cap(full, SL, 1, R));

  // barrel hood filling the port, and the barrel proper
  b.add(
    'bright',
    plate(
      poly([
        [ZL + 0.35, YP - 1],
        [9.3, YP - 1],
        [9.3, 5.8, 0.6],
        [7.6, ST - 0.35, 0.8],
        [ZL + 0.35, ST - 0.35, 0.3],
      ]),
      { t: 29.2, plane: 'zy', at: PORT0 + 14.1, bevel: 0.45 },
    ),
  );
  b.add('dark', plate(poly([[ZL + 0.2, YP - 0.6], [11.4, YP - 0.6], [11.4, 3], [9.6, 6.4], [ZL + 0.2, 6.4]]), { t: 4, plane: 'zy', at: PORT1 - 1.7, bevel: 0 }));
  b.add('bright', tube(PORT1 - 4, SL + 1.5, 7.2, 4.5, { chamfer: 0.7, depth: 14 }));
  b.add('dark', rod(SL - 4, SL + 0.35, 8.1, { chamfer: 0.2 }));

  // loaded-chamber notch at the back of the hood
  b.add('dark', box(PORT0 - 0.3, ST - 1.4, PORT0 + 2.4, ST - 0.05, 2.6, { bevel: 0.2, r: 0.3 }));

  // extractor let into the right flank behind the port
  b.add('dark', box(57.4, -0.2, PORT0 + 0.6, 3.2, 0.7, { at: FL, bevel: 0.1, r: 0.5 }));
  b.add('steel', box(58, 0.3, PORT0 + 0.4, 2.7, 1.1, { at: FL - 0.1, bevel: 0.35, r: 0.5 }));
  b.add('steel', studZ(61, 1.5, 0.9, FL, FL + 0.75, 0.2));

  // rear sight: dovetailed two-dot notch
  b.add(
    'steel',
    plate(
      poly([
        [-8.7, ST - 0.6],
        [8.7, ST - 0.6],
        [8.7, ST + 1.4, 0.4],
        [7.5, ST + 5.4, 0.6],
        [2.0, ST + 5.4, 0.2],
        [2.0, ST + 2.5, 0.4],
        [-2.0, ST + 2.5, 0.4],
        [-2.0, ST + 5.4, 0.2],
        [-7.5, ST + 5.4, 0.6],
        [-8.7, ST + 1.4, 0.4],
      ]),
      { t: 8, plane: 'zy', at: 8.4, bevel: 0.5 },
    ),
  );
  b.add('steel', plate(poly([[11, ST - 0.6], [20.5, ST - 0.6], [20.5, ST + 0.5, 0.3], [13, ST + 2.6, 0.5], [11, ST + 2.6]]), { t: 16.4, bevel: 0.5 }));
  for (const z of [-4.75, 4.75]) b.add('led', rod(3.95, 5.2, 1.05, { y: ST + 3.4, z, chamfer: 0.15, segs: 14 }));
  b.add('steel', studZ(15.5, ST + 0.9, 1.1, 8.0, 8.75, 0.25)); // windage set screw

  // front sight: ramped post with a light-pipe window
  b.add(
    'steel',
    plate(
      poly([
        [161.5, ST - 0.6],
        [173, ST - 0.6],
        [173, ST + 0.9, 0.4],
        [167.2, ST + 5.0, 0.6],
        [162, ST + 5.0, 0.5],
        [161.5, ST + 1, 0.3],
      ]),
      { t: 4.4, bevel: 0.5, holes: [slot(163.6, ST + 2.9, 166.4, ST + 2.9, 0.95)] },
    ),
  );
  b.add('led', rod(161.2, 168.3, 0.8, { y: ST + 2.9, chamfer: 0.15, segs: 12 }));
  b.add('steel', box(159.5, ST - 0.6, 175, ST + 0.75, 6.4, { bevel: 0.35, r: 0.4 }));

  // optics cover plate
  b.add('body', plate(rect(25, -7.5, 43, 15, 1.6), { t: 1.1, plane: 'xz', at: ST + 0.1, bevel: 0.35 }));
  for (const x of [29.5, 63.5]) {
    b.add('steel', alongY(rod(ST, ST + 0.95, 1.7, { chamfer: 0.3, segs: 14 })).translate(x, 0, 0));
    b.add('dark', alongY(rod(ST, ST + 1.3, 0.8, { chamfer: 0.05, segs: 6 })).translate(x, 0, 0));
  }

  // anti-glare ribs between the port and the front sight
  for (let x = 109; x < 156; x += 2.3) b.add('body', box(x, ST - 0.4, x + 1.1, ST + 0.34, 10.4, { bevel: 0.22, r: 0.2 }));

  // striker cover plate on the rear face
  b.add('steel', plate(poly([[-6.8, SB + 1.6, 1.2], [6.8, SB + 1.6, 1.2], [6.8, 4.2, 2.5], [-6.8, 4.2, 2.5]]), { t: 1.1, plane: 'zy', at: 0.1, bevel: 0.3 }));
  b.add('dark', rod(-0.75, 0.2, 1.3, { y: -1.2, chamfer: 0.1, segs: 12 }));

  // recoil-spring guide rod under the muzzle
  b.add('dark', rod(SL - 4, SL + 0.32, 3.15, { y: -10.25, chamfer: 0.1 }));
  b.add('steel', rod(SL - 4, SL + 0.7, 2.55, { y: -10.25, chamfer: 0.4 }));
  b.add('dark', rod(SL - 1, SL + 1.0, 1.0, { y: -10.25, chamfer: 0.1, segs: 10 }));

  /* ---------------- frame ---------------- */
  // dust cover and trigger housing
  b.add(
    'sec',
    plate(
      poly([
        [52, -13.2],
        [168, -13.2, 0.8],
        [169.5, -19, 2],
        [166, -24, 1.5],
        [125.5, -24, 0.6],
        [122, -29.5, 2],
        [60, -29.5],
        [56, -40],
        [52, -40],
      ]),
      { t: FW * 2, bevel: 0.8 },
    ),
  );

  // accessory rail: a neck under the dust cover carrying four dovetail lugs
  b.add('sec', plate(rect(-8.4, -27.4, 16.8, 4.6, 0.4), { t: 39, plane: 'zy', at: 146.8, bevel: 0.4 }));
  const lug = poly([
    [-10.6, -25.6, 0.3],
    [10.6, -25.6, 0.3],
    [10.6, -26.9],
    [8.9, -28.6, 0.3],
    [-8.9, -28.6, 0.3],
    [-10.6, -26.9],
  ]);
  for (const x of [131.4, 141.4, 151.4, 161.4]) b.add('sec', plate(lug, { t: 5.6, plane: 'zy', at: x, bevel: 0.3, bevelSegs: 1 }));

  // index pads above the trigger guard
  const padHoles = [133, 137, 141, 145].map((x) => circle(x, -18.8, 0.85, 6));
  b.both('sec', plate(ccw(slot(131.5, -18.8, 146.5, -18.8, 2.7)), { t: 0.8, at: FW, bevel: 0.25, holes: padHoles }));

  // trigger guard
  b.add(
    'sec',
    plate(
      ccw(
        poly([
          [58, -28],
          [123, -25],
          [123.5, -31, 2.5],
          [120.5, -55, 6],
          [114, -59.5, 3],
          [76, -59.5, 10],
          [61, -47, 4],
        ]),
      ),
      {
        t: 15,
        bevel: 2,
        bevelSegs: 3,
        holes: [
          poly([
            [69, -31.5, 3],
            [117, -31.5, 4],
            [115, -53.5, 5.5],
            [80, -54.5, 10],
            [67, -42, 5],
          ]),
        ],
      },
    ),
  );
  for (let i = 0; i < 6; i++) {
    const y = -35 - i * 3.3;
    const x = 123.5 + (y + 31) * (3 / 24);
    b.add('sec', box(x - 0.6, y - 0.75, x + 0.6, y + 0.75, 10.4, { bevel: 0.3, r: 0.3 }));
  }

  /* ---------------- trigger ---------------- */
  b.add(
    'steel',
    plate(
      poly([
        [92, -27],
        [100.5, -27],
        [99.6, -35, 6],
        [97.3, -43, 10],
        [98.4, -50.6, 1.6],
        [94.2, -51.2, 1.8],
        [92.6, -41, 12],
      ]),
      { t: 7, bevel: 1.5, bevelSegs: 3 },
    ),
  );
  b.add('dark', plate(poly([[97, -30], [100.7, -30], [99.95, -35, 6], [97.65, -43, 10], [98.6, -49.6], [96.4, -49.6], [95.6, -43], [97, -35]]), { t: 2.6, bevel: 0.15 }));
  b.add(
    'steel',
    plate(poly([[98, -31.8], [101.6, -31.8, 0.5], [101, -36, 5], [98.8, -43, 8], [99.8, -48.8, 0.6], [97, -48.8], [96.2, -43], [97.6, -36]]), { t: 1.5, bevel: 0.4 }),
  );

  /* ---------------- controls ---------------- */
  // ambidextrous slide stop
  b.both(
    'steel',
    plate(poly([[49, -14.6, 0.8], [71, -14.9, 0.6], [77, -16.6, 1], [76.5, -19, 1], [60, -18.3, 0.6], [49, -18.5, 0.8]]), { t: 1.5, at: FW + 0.65, bevel: 0.45 }),
    box(45.5, -19.3, 56.5, -14.2, 1.9, { at: FW + 1.45, bevel: 0.5, r: 1 }),
    studZ(74.3, -17.3, 1.7, FW, FW + 1.9),
  );
  for (const x of [47.4, 50.1, 52.8]) b.both('steel', box(x, -18.7, x + 1.2, -14.8, 1, { at: FW + 2.5, bevel: 0.3, r: 0.3 }));

  // takedown lever on the left, its axle end on the right
  b.add('steel', studZ(106, -18.6, 3.1, -(FW + 1.9), -(FW - 0.5)));
  b.add('steel', plate(slot(106, -18.6, 118.5, -17.6, 2.0), { t: 1.4, at: -(FW + 1.2), bevel: 0.4 }));
  b.add('steel', box(114.5, -19.9, 121.5, -15.3, 1.7, { at: -(FW + 2.2), bevel: 0.5, r: 1 }));
  b.add('steel', studZ(106, -18.6, 2.4, FW - 0.5, FW + 0.6));
  b.add('dark', box(104.1, -19.05, 107.9, -18.15, 0.6, { at: FW + 0.65, bevel: 0.1, r: 0.2 }));

  // magazine release
  b.add('dark', plate(rect(55.4, -40.6, 11.2, 8.4, 2.2), { t: 29.6, bevel: 0.3 }));
  b.add('steel', plate(rect(56.2, -39.8, 9.6, 6.8, 1.7), { t: 31, bevel: 0.9, bevelSegs: 2 }));
  for (const x of [57.7, 60.2, 62.7]) b.add('steel', box(x, -39, x + 1.2, -33.8, 31.9, { bevel: 0.3, r: 0.3 }));

  // pins
  b.add('steel', pinZ(97, -21.5, 1.7, FW, 0.35));
  b.add('steel', pinZ(88, -17.2, 1.3, FW, 0.35));
  b.add('steel', pinZ(31, -35.5, 1.6, 14.75, 0.35));

  /* ---------------- grip ---------------- */
  const gripWarp = (p: THREE.Vector3) => {
    const k = THREE.MathUtils.smoothstep(p.y, -40, -16);
    const swell = 1 + 0.035 * Math.exp(-(((p.y + 76) / 22) ** 2));
    p.z *= THREE.MathUtils.lerp(swell, 12.45 / GW, k);
  };
  const grip = plate(
    poly([
      [14, -7],
      [74, -7],
      [70, -35, 5],
      [60.5, -44, 5],
      [36, -106, 4],
      [-17, -111, 5],
      [-9, -80, 60],
      [8, -42, 40],
      [13.5, -24, 10],
    ]),
    { t: GW * 2, bevel: 6, bevelSegs: 4 },
  );
  b.add('sec', warp(grip, gripWarp));

  // beavertail
  b.add(
    'sec',
    plate(
      poly([
        [-1.5, -14.4, 1.8],
        [22, -13.6],
        [22, -34],
        [11, -27, 6],
        [-1.5, -17.6, 1.6],
      ]),
      { t: 23, bevel: 2.6, bevelSegs: 3 },
    ),
  );

  // checkered side panels: a proud plate pierced by a diamond lattice
  const panelO = ccw(poly([[20, -42, 4], [51.5, -47, 3], [31, -98.5, 3], [-7.5, -101.5, 3], [-1.5, -78, 40], [12.5, -48, 10]]));
  const diamonds: V2[][] = [];
  const ca = Math.cos(5.4 * (Math.PI / 180));
  const sa = Math.sin(5.4 * (Math.PI / 180));
  for (let j = 0; j < 24; j++) {
    for (let i = -4; i < 22; i++) {
      const u = i * 5 + (j % 2) * 2.5;
      const v = j * 3.1;
      const x = -22 + u * ca - v * sa;
      const y = -108 + u * sa + v * ca;
      if (clearance(panelO, x, y) < 2.9) continue;
      diamonds.push(pts([[x + 1.75, y], [x, y + 1.3], [x - 1.75, y], [x, y - 1.3]]));
    }
  }
  const panel = plate(panelO, { t: 1.2, at: GW + 0.15, bevel: 0, holes: diamonds });
  b.both('sec', warp(panel, gripWarp));

  // front-strap ribs
  for (let i = 0; i < 13; i++) {
    const sD = 8 + i * 4;
    const cx = 60.5 - 0.3675 * sD + 0.93 * 0.15;
    const cy = -44 - 0.93 * sD - 0.3675 * 0.15;
    b.add('sec', plate(shift(rotate2(rect(-0.95, -0.65, 1.9, 1.3, 0.25), -111.6), cx, cy), { t: 15, bevel: 0.3 }));
  }

  // interchangeable backstrap insert
  b.add(
    'sec',
    plate(
      poly([
        [-17.7, -107.5, 2],
        [-10.1, -80, 60],
        [6.9, -42, 40],
        [11.6, -28.5, 4],
        [17, -30, 2],
        [13, -44, 40],
        [-3.5, -80, 60],
        [-10.5, -106, 2],
      ]),
      { t: 17, bevel: 3, bevelSegs: 3 },
    ),
  );
  b.add('steel', pinZ(-8.5, -97, 1.3, 14.2, 0.3)); // backstrap retaining pin

  // magazine base plate with a dark parting line above it
  b.add('dark', plate(poly([[38.2, -99.4], [-18.6, -104.7], [-18.7, -106.2], [38.3, -100.9]]), { t: 2 * GW + 0.9, bevel: 0.2 }));
  b.add(
    'sec',
    plate(
      poly([
        [38.5, -100.6, 1],
        [-19, -106, 1.5],
        [-18.2, -114.6, 2.5],
        [41, -109.1, 3],
      ]),
      { t: 2 * GW + 1.8, bevel: 1.6, bevelSegs: 3 },
    ),
  );

  // floor-plate latch and toe ridge under the base plate
  b.add('steel', xf(alongY(rod(-0.9, 0.2, 2.4, { chamfer: 0.3, segs: 14 })), { rz: 5.4, x: 14, y: -111.9 }));
  b.add('dark', xf(alongY(rod(-1.2, 0.2, 1, { chamfer: 0.1, segs: 8 })), { rz: 5.4, x: 14, y: -111.9 }));
  b.add('sec', plate(poly([[39, -103.5, 0.8], [42.4, -104.4, 1.2], [42.6, -108.6, 1.4], [39, -108.4, 0.8]]), { t: 20, bevel: 1.2, bevelSegs: 2 }));

  b.anchor('muzzle', SL + 1.5, 0, 0, [1, 0, 0]);
  b.anchor('tally', 121, -4, FL, [0, 0, 1]);
  b.anchor('eject', 89, 6, 9.5, [0.2, 0.6, 1]);
  return b.build();
}
