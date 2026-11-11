/**
 * Magnate .50: gas-operated magnum pistol with a fixed barrel.
 * Authored in mm. x = 0 at the rear face of the slide, bore axis on y = 0.
 */
import * as THREE from 'three';
import { Builder, alongY, box, circle, lathe, pinZ, plate, poly, pts, rect, rod, rotate2, shift, slot, studZ, xf, type BuiltModel, type P2, type V2 } from '../kit';

const SW = 16.2; // slide half-width
const SB = -19; // slide bottom
const ST = 13.6; // slide top behind the barrel
const BW = 15.6; // barrel half-width at its base
const FW = 14.2; // frame half-width
const GW = 17.5; // grip half-width
const SL = 258; // slide length
const ML = 262; // muzzle

/** Mirror a right-hand half profile (bottom to top) into a closed zy outline. */
function sym(right: P2[]): V2[] {
  const left = [...right].reverse().map(([z, y, r]) => [-z, y, r] as P2);
  return poly([...right, ...left]);
}

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

/** Prism along X from a zy outline with square ends (butt-joins seamlessly). */
const seg = (o: V2[], x0: number, x1: number, holes?: V2[][]) => plate(o, { t: x1 - x0, plane: 'zy', at: (x0 + x1) / 2, bevel: 0, holes });
/** Rounded end cap for a `seg`: half of it is buried in the segment behind it. */
const cap = (o: V2[], x: number, dir: 1 | -1, r = 0.8, holes?: V2[][]) =>
  plate(o, { t: 2 * r + 0.04, plane: 'zy', at: x - dir * (r + 0.02), bevel: r, bevelSegs: 3, holes });

/** Slide cross-section behind the barrel; g > 0 cuts the serration groove. */
function slideProf(g = 0): V2[] {
  if (g <= 0) return sym([[SW, SB, 0.6], [SW, -3, 1], [10.2, 11, 1.2], [8.6, ST, 1.4]]);
  return sym([
    [SW, SB, 0.6],
    [SW, -16.6],
    [SW - g, -16.6 + g],
    [SW - g, -3 - 0.205 * g],
    [SW - 4.8 - 0.919 * g, 8.2 - 0.394 * g],
    [SW - 5.28, 9.32],
    [10.2, 11, 1.2],
    [8.6, ST, 1.4],
  ]);
}

export function buildMagnate(): BuiltModel {
  const b = new Builder();
  const full = ccw(slideProf());
  const groove = ccw(slideProf(0.95));
  const R = 1;

  /* ---------------- slide ---------------- */
  const PORT0 = 76;
  const BR = 104; // barrel breech
  b.add('body', cap(full, 0, -1, R), seg(full, R + 0.02, 7));
  for (let i = 0; i < 10; i++) {
    const a = 7 + i * 4.6;
    b.add('body', seg(groove, a, a + 2.1), seg(full, a + 2.1, a + 4.6));
  }
  b.add('body', seg(full, 53, PORT0));
  b.add(
    'body',
    seg(
      poly([
        [-SW, SB, 0.6],
        [SW, SB, 0.6],
        [SW, -3, 1],
        [14.49, 1, 0.4],
        [-5, 1],
        [-5, ST],
        [-8.6, ST, 1.4],
        [-10.2, 11, 1.2],
        [-SW, -3, 1],
      ]),
      PORT0,
      BR,
    ),
  );
  // lower rails running forward under the barrel
  const band = sym([[SW, SB, 0.6], [SW, -6.4, 0.7], [14.6, -5.2]]);
  b.add('body', seg(band, BR, SL - R - 0.02), cap(band, SL, 1, R));

  // rotating bolt seen through the port
  b.add('bright', rod(PORT0 - 1, BR - 0.6, 9.4, { chamfer: 0.9 }));
  b.add('steel', box(89, 3.2, BR - 0.9, 6.4, 2.2, { at: 8.2, bevel: 0.4, r: 0.5 }));

  /* ---------------- barrel ---------------- */
  const barrel = ccw(sym([[BW, -9], [BW, -3, 0.8], [9.2, 11.8, 0.6], [9.2, 12.8, 0.3], [8.4, 14.2, 0.4]]));
  const bore = [circle(0, 0, 6.35, 20)];
  b.add('body', seg(barrel, BR, ML - R - 0.02, bore), cap(barrel, ML, 1, R, bore));
  b.add('dark', rod(205, 238, 6.7, { chamfer: 0.1 }));

  // polished crown ring around the bore
  b.add(
    'bright',
    lathe([
      [ML - 3, 8.4],
      [ML + 0.15, 8.4],
      [ML + 0.65, 7.9],
      [ML + 0.65, 6.9],
      [ML + 0.3, 6.5],
      [ML - 3, 6.5],
    ]),
  );

  // compensator ports let into the sloped flanks behind the muzzle
  const onBarrel = <T extends THREE.BufferGeometry>(g: T) => xf(g, { rx: -23.4, pivot: [0, -3, BW] as const });
  for (const x of [225, 233, 241]) {
    b.both('dark', onBarrel(plate(slot(x, 2.6, x + 3.4, 11.4, 1.7), { t: 0.8, at: BW + 0.02, bevel: 0.1 })));
  }

  // scope rail: eleven lugs standing on the barrel's top flat
  const lug = poly([
    [-8.2, 12.2],
    [8.2, 12.2],
    [10.6, 13.9],
    [10.6, 14.7],
    [8, 17.2, 0.3],
    [-8, 17.2, 0.3],
    [-10.6, 14.7],
    [-10.6, 13.9],
  ]);
  for (let i = 0; i < 11; i++) b.add('body', plate(lug, { t: 4.8, plane: 'zy', at: 112.4 + i * 10, bevel: 0.3, bevelSegs: 1 }));
  // ribbed sighting ramp ahead of the rail, carrying the front sight
  b.add('body', plate(poly([[-7.6, 13.4], [7.6, 13.4], [7.6, 15.1, 0.5], [6.4, 16.2, 0.4], [-6.4, 16.2, 0.4], [-7.6, 15.1, 0.5]]), { t: 42, plane: 'zy', at: 238.6, bevel: 0.5 }));
  for (let x = 220; x < 244; x += 2.2) b.add('body', box(x, 15.8, x + 1.05, 16.55, 10.6, { bevel: 0.22, r: 0.2 }));
  b.add('steel', box(245.5, 15.6, 258.5, 17, 9, { bevel: 0.35, r: 0.4 }));
  b.add('steel', plate(poly([[247, 16.4], [258, 16.4], [258, 17.6, 0.4], [252.5, 21.8, 0.6], [248, 21.8, 0.5], [247, 18, 0.3]]), { t: 3.6, bevel: 0.5 }));
  b.add('led', rod(246.55, 247.9, 0.95, { y: 19.9, chamfer: 0.15, segs: 12 }));

  // rear sight
  b.add(
    'steel',
    plate(
      poly([
        [-8.2, ST - 0.6],
        [8.2, ST - 0.6],
        [8.2, ST + 1.5, 0.4],
        [7, ST + 6.2, 0.6],
        [2.1, ST + 6.2, 0.2],
        [2.1, ST + 3, 0.4],
        [-2.1, ST + 3, 0.4],
        [-2.1, ST + 6.2, 0.2],
        [-7, ST + 6.2, 0.6],
        [-8.2, ST + 1.5, 0.4],
      ]),
      { t: 9, plane: 'zy', at: 8.2, bevel: 0.5 },
    ),
  );
  b.add('steel', plate(poly([[11.5, ST - 0.6], [21, ST - 0.6], [21, ST + 0.5, 0.3], [13.5, ST + 3, 0.5], [11.5, ST + 3]]), { t: 15.6, bevel: 0.5 }));
  for (const z of [-4.5, 4.5]) b.add('led', rod(3.25, 4.6, 1, { y: ST + 4, z, chamfer: 0.15, segs: 12 }));
  // anti-glare ribs along the slide top
  for (let x = 24; x < 73; x += 2.6) b.add('body', box(x, ST - 0.4, x + 1.2, ST + 0.36, 11.6, { bevel: 0.22, r: 0.2 }));

  // slide rear face: hammer slot and firing-pin retainer
  b.add('dark', plate(poly([[-5, SB + 0.4], [5, SB + 0.4], [5, -2, 1.5], [-5, -2, 1.5]]), { t: 1.2, plane: 'zy', at: 0.1, bevel: 0.1 }));
  b.add('steel', rod(-0.5, 1, 3.2, { y: 4.2, chamfer: 0.35, segs: 16 }));
  b.add('dark', rod(-0.8, 1, 1.1, { y: 4.2, chamfer: 0.1, segs: 8 }));

  // slide nose: recoil-spring guide ends either side of the gas piston plug
  for (const z of [-9.6, 9.6]) {
    b.add('dark', rod(SL - 3, SL + 0.32, 3.1, { y: -12.6, z, chamfer: 0.1 }));
    b.add('steel', rod(SL - 3, SL + 0.9, 2.4, { y: -12.6, z, chamfer: 0.5 }));
  }
  b.add('steel', rod(SL - 3, SL + 0.6, 3.6, { y: -12.6, chamfer: 0.5 }));
  b.add('dark', rod(SL - 1, SL + 0.95, 1.5, { y: -12.6, chamfer: 0.1, segs: 6 }));

  // ambidextrous safety lying on the sloped flank over the serrations
  const tilt = { rx: -23.2, pivot: [0, -3, SW] as const };
  const onFlank = <T extends THREE.BufferGeometry>(g: T) => xf(g, tilt);
  b.both(
    'steel',
    onFlank(studZ(17.5, 4.6, 4.6, SW - 0.5, SW + 2.3, 0.5)),
    onFlank(plate(poly([[16, 1.6, 1], [34, -0.4, 1], [45, -0.6, 2.2], [45.6, 5.2, 2.4], [34, 5.4, 1.5], [18, 7.6, 1]]), { t: 1.9, at: SW + 0.75, bevel: 0.5 })),
    onFlank(box(36.5, -1.2, 46.4, 6, 2.4, { at: SW + 2.2, bevel: 0.7, r: 1.6 })),
  );
  for (const x of [38.3, 41, 43.7]) b.both('steel', onFlank(box(x, -0.4, x + 1.2, 5.2, 1, { at: SW + 3.5, bevel: 0.3, r: 0.3 })));
  b.both('dark', onFlank(box(15.2, 4.25, 19.8, 4.95, 0.6, { at: SW + 2.35, bevel: 0.1, r: 0.2 })));

  /* ---------------- frame ---------------- */
  b.add(
    'body',
    plate(
      poly([
        [-8, -18.7, 1.6],
        [204, -18.7, 0.8],
        [205.5, -25, 1.5],
        [197, -35.5, 3],
        [132, -35.5, 1],
        [130, -38],
        [70, -38],
        [66, -62],
        [12, -62],
        [7, -37, 6],
        [-8, -25, 2.2],
      ]),
      { t: FW * 2, bevel: 0.9 },
    ),
  );
  // trigger guard
  b.add(
    'body',
    plate(
      ccw(
        poly([
          [70, -36],
          [134, -33],
          [134.5, -40, 2],
          [133, -62, 7],
          [125, -69, 4],
          [84, -69, 8],
          [72, -60, 4],
        ]),
      ),
      {
        t: 17,
        bevel: 2.2,
        bevelSegs: 3,
        holes: [
          poly([
            [80, -39.5, 3],
            [126, -39.5, 4],
            [125, -58, 7],
            [119, -62.5, 4],
            [88, -62.5, 8],
            [78, -52, 5],
          ]),
        ],
      },
    ),
  );
  // exposed front strap
  b.add('body', plate(poly([[65, -60], [74.2, -63.5, 2], [59.2, -124, 2], [50, -124]]), { t: 21, bevel: 3, bevelSegs: 3 }));

  /* ---------------- grip ---------------- */
  b.add(
    'sec',
    plate(
      poly([
        [5, -33],
        [73, -36],
        [74.5, -58, 3],
        [72, -64, 3],
        [57, -123, 4],
        [-13, -126, 6],
        [-10, -95, 70],
        [2, -52, 50],
        [6.5, -38, 8],
      ]),
      { t: GW * 2, bevel: 6.5, bevelSegs: 4 },
    ),
  );
  b.add('body', plate(poly([[60, -121.5, 1], [-15, -124.5, 1], [-15.5, -129.6, 2], [61, -126.6, 2]]), { t: 33, bevel: 1.5, bevelSegs: 2 }));

  /* ---------------- hammer and trigger ---------------- */
  b.add(
    'steel',
    plate(
      poly([
        [2, -20],
        [2, 6, 1],
        [-2.5, 8.5, 2],
        [-11.5, 5.5, 1.5],
        [-11, 2.5, 1.2],
        [-4.5, 0, 3],
        [-3.5, -20],
      ]),
      { t: 9, bevel: 1, bevelSegs: 2 },
    ),
  );
  b.add(
    'steel',
    plate(
      poly([
        [96, -36],
        [105, -36],
        [104, -45, 6],
        [101.5, -53, 10],
        [102.5, -59, 1.6],
        [98.6, -59.6, 1.8],
        [96.6, -50, 12],
      ]),
      { t: 8, bevel: 1.6, bevelSegs: 3 },
    ),
  );
  // hammer spur serrations
  for (let i = 0; i < 4; i++) {
    const cx = -9.6 + i * 2.05;
    const cy = 6.45 + i * 0.69;
    b.add('steel', plate(shift(rotate2(rect(-0.55, -0.5, 1.1, 1, 0.2), 18.4), cx, cy), { t: 7.4, bevel: 0.25 }));
  }
  b.add('dark', plate(poly([[97.6, -39], [105.3, -39], [104.35, -45, 6], [101.85, -53, 10], [102.75, -58], [100.5, -58], [99.8, -53], [101.4, -45]]), { t: 2.4, bevel: 0.15 }));

  /* ---------------- controls ---------------- */
  // slide stop on the left, its axle end on the right
  b.add('steel', plate(poly([[84, -20.6, 0.8], [117, -20.9, 0.6], [124.5, -23, 1.2], [123.6, -26, 1.2], [99, -24.7, 0.6], [84, -24.8, 0.8]]), { t: 1.8, at: -(FW + 0.75), bevel: 0.5 }));
  b.add('steel', box(79.5, -25.6, 93, -20, 2.3, { at: -(FW + 1.75), bevel: 0.6, r: 1.2 }));
  for (const x of [81.6, 84.6, 87.6]) b.add('steel', box(x, -24.9, x + 1.3, -20.7, 1, { at: -(FW + 3.05), bevel: 0.3, r: 0.3 }));
  b.add('steel', studZ(120.6, -23.6, 2.3, -(FW + 2.3), FW + 0.7));
  // barrel lock: lever on the left, push button on the right
  b.add('steel', studZ(152, -26.5, 3.7, -(FW + 2.2), -(FW - 0.5)));
  b.add('steel', plate(slot(152, -26.5, 165, -29.5, 2.3), { t: 1.6, at: -(FW + 1.3), bevel: 0.45 }));
  b.add('steel', box(160.5, -32, 168.5, -27, 1.9, { at: -(FW + 2.4), bevel: 0.6, r: 1.2 }));
  b.add('dark', studZ(152, -26.5, 4.3, FW - 0.5, FW + 0.35, 0.1));
  b.add('steel', studZ(152, -26.5, 3.4, FW - 0.5, FW + 1.5, 0.5));
  // magazine release
  b.add('dark', plate(rect(64.6, -49.4, 11.6, 9.8, 2.4), { t: 2 * GW - 0.4, bevel: 0.3 }));
  b.add('steel', plate(rect(65.6, -48.4, 9.6, 7.8, 1.9), { t: 2 * GW + 1.4, bevel: 1, bevelSegs: 2 }));
  for (const x of [67.1, 69.7, 72.3]) b.add('steel', box(x, -47.6, x + 1.2, -41.4, 2 * GW + 2.3, { bevel: 0.3, r: 0.3 }));
  // pins
  b.add('steel', pinZ(104, -28, 1.8, FW, 0.4));
  b.add('steel', pinZ(9, -27, 2.2, FW, 0.45));
  b.add('steel', pinZ(31, -29.5, 1.5, FW, 0.4));
  b.add('steel', pinZ(58, -27, 1.5, FW, 0.4));
  // slide-rail ledge along the top of the frame
  b.add('body', box(-3, -22.6, 203.5, -18.9, 2 * FW + 1.3, { bevel: 0.45, r: 0.6 }));

  /* ---------------- grip panels ---------------- */
  const panelO = ccw(poly([[12, -45.5, 4], [64.5, -48, 4], [51.5, -115.5, 4], [-5, -118, 4], [-2.5, -95, 60], [7.5, -56, 40]]));
  const diamonds: V2[][] = [];
  for (let j = 0; j < 26; j++) {
    for (let i = 0; i < 18; i++) {
      const x = -12 + i * 5 + (j % 2) * 2.5;
      const y = -120 + j * 3.1;
      if (clearance(panelO, x, y) < 3 || Math.hypot(x - 33, y + 60) < 9.6 || Math.hypot(x - 27, y + 99) < 5.2) continue;
      diamonds.push(pts([[x + 1.75, y], [x, y + 1.3], [x - 1.75, y], [x, y - 1.3]]));
    }
  }
  b.both('sec', plate(panelO, { t: 1.5, at: GW + 0.25, bevel: 0, holes: diamonds }));
  // medallion and grip screw
  b.both('steel', studZ(33, -60, 7, GW + 0.4, GW + 1.6, 0.5), studZ(27, -99, 3, GW + 0.4, GW + 1.7, 0.4));
  b.both('bright', studZ(33, -60, 5.2, GW + 1, GW + 2, 0.35));
  b.both('dark', box(24.6, -99.45, 29.4, -98.55, 0.6, { at: GW + 1.75, bevel: 0.1, r: 0.2 }));
  // lanyard-style retaining pin through the heel
  b.add('steel', pinZ(-1, -112, 1.6, 16.9, 0.4));
  // base-plate toe and latch
  b.add('body', plate(poly([[58, -123.2, 0.8], [63.5, -124, 1.4], [64, -127.4, 1.6], [58, -127.6, 0.8]]), { t: 22, bevel: 1.2, bevelSegs: 2 }));
  b.add('steel', xf(alongY(rod(-0.9, 0.3, 3, { chamfer: 0.35, segs: 16 })), { rz: 2.3, x: 24, y: -128.2 }));
  b.add('dark', xf(alongY(rod(-1.2, 0.3, 1.2, { chamfer: 0.1, segs: 8 })), { rz: 2.3, x: 24, y: -128.2 }));

  b.anchor('muzzle', ML, 0, 0, [1, 0, 0]);
  b.anchor('tally', 185, -12.6, SW, [0, 0, 1]);
  b.anchor('eject', 90, 8, 9, [0.2, 0.6, 1]);
  return b.build();
}
