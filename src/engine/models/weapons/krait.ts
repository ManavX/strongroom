/**
 * Krait-47: stamped-receiver assault rifle with laminate furniture.
 * Authored in mm. x = 0 at the rear of the receiver, bore axis on y = 0.
 */
import * as THREE from 'three';
import { Builder, alongY, arcBand, arcPts, box, circle, loft, lathe, pinZ, plate, poly, pts, rod, slot, studZ, warp, type BuiltModel } from '../kit';

/** A short disc facing the rear (-X), for buttplate hardware. */
function alongX3(x: number, y: number, r: number): THREE.BufferGeometry {
  return rod(x - 1.2, x + 1.2, r, { y, chamfer: Math.min(0.5, r * 0.25), segs: 20 });
}

export function buildKrait(): BuiltModel {
  const b = new Builder();
  const HW = 16; // receiver half-width

  /* ---------------- receiver ---------------- */
  b.add(
    'body',
    plate(
      poly([
        [0, 8, 2],
        [262, 8, 0.8],
        [262, -39, 2],
        [16, -39, 4],
        [0, -22, 3],
      ]),
      { t: HW * 2, bevel: 1.1 },
    ),
  );
  // magazine-well reinforcement and lower rail of the receiver
  b.add('body', box(150, -39, 222, -31, HW * 2 + 2.4, { bevel: 0.8, r: 1.5 }));
  b.add('body', box(20, 3.5, 262, 8.5, HW * 2 + 1.6, { bevel: 0.6, r: 0.8 }));

  // rear trunnion hump under the cover
  b.add(
    'body',
    plate(
      poly([
        [1, 8],
        [24, 8],
        [24, 25, 3],
        [10, 22, 5],
        [1, 12, 2],
      ]),
      { t: 24, bevel: 1.2 },
    ),
  );

  /* ---------------- dust cover ---------------- */
  const coverFull = poly([
    [-15.6, 6],
    [15.6, 6],
    [15.6, 17, 3],
    [9.5, 30, 9],
    [-9.5, 30, 9],
    [-15.6, 17, 3],
  ]);
  b.add('body', plate(coverFull, { t: 132, plane: 'zy', at: 86, bevel: 1.0 }));
  // forward section is cut away on the right for the bolt carrier
  const coverCut = poly([
    [-15.6, 6],
    [10.4, 6],
    [10.4, 19.5],
    [15.6, 19.5, 0.6],
    [15.6, 21.5, 2],
    [9.5, 30, 9],
    [-9.5, 30, 9],
    [-15.6, 17, 3],
  ]);
  b.add('body', plate(coverCut, { t: 111, plane: 'zy', at: 206.5, bevel: 0.6 }));
  // pressed ribs
  const rib = poly([
    [-16.3, 9],
    [16.3, 9],
    [16.3, 17.3, 3.2],
    [9.9, 30.9, 9.4],
    [-9.9, 30.9, 9.4],
    [-16.3, 17.3, 3.2],
  ]);
  for (const x of [46, 82, 118]) b.add('body', plate(rib, { t: 7, plane: 'zy', at: x, bevel: 0.8 }));

  /* ---------------- bolt carrier + charging handle ---------------- */
  b.add('bright', box(153, 8.6, 259, 18.6, 4.4, { at: 12.7, bevel: 0.6, r: 1 }));
  b.add('bright', studZ(233, 13.6, 4.1, 13, 31));
  b.add('bright', studZ(233, 13.6, 5.4, 29, 38, 1.2));

  /* ---------------- rear sight ---------------- */
  b.add(
    'steel',
    plate(
      poly([
        [257, 8],
        [302, 8],
        [302, 21, 2],
        [292, 30.5, 2],
        [263, 30.5, 2],
        [257, 24, 2],
      ]),
      { t: 25, bevel: 1.0 },
    ),
  );
  b.add(
    'steel',
    plate(
      poly([
        [266, 30],
        [338, 24.5, 0.6],
        [338, 27.2, 0.6],
        [266, 34],
      ]),
      { t: 11, bevel: 0.4, bevelSegs: 1 },
    ),
  );
  b.add('steel', box(266, 33, 270.5, 39, 11, { bevel: 0.5, r: 0.5 }));
  b.add('steel', box(300, 26.5, 310, 31.5, 15, { bevel: 0.6, r: 0.8 })); // elevation slider

  /* ---------------- barrel assembly ---------------- */
  b.add(
    'steel',
    lathe([
      [262, 0],
      [262, 9],
      [432, 9],
      [434, 8],
      [626, 8],
      [628, 7.4],
      [675, 7.4],
      [675, 10.6],
      [676.5, 11.4],
      [699, 11.4],
      [701, 10.2],
      [701, 3.9],
      [655, 3.9],
      [655, 0],
    ]),
  );
  // muzzle-brake relief cut suggestion: a dark slot on top
  b.add('dark', box(683, 9.5, 695, 11.9, 7, { bevel: 0.3, r: 1 }));

  // gas tube and block
  b.add('steel', rod(298, 464, 7.6, { y: 22 }));
  b.add('steel', rod(300, 305, 9.4, { y: 22, chamfer: 0.8 }));
  b.add('steel', rod(403, 408, 9.4, { y: 22, chamfer: 0.8 }));
  b.add(
    'steel',
    plate(
      poly([
        [448, -9.5, 2.5],
        [480, -9.5, 2.5],
        [480, 12, 1],
        [470, 31, 3],
        [452, 31, 3],
        [446, 20, 2],
      ]),
      { t: 19, bevel: 1.6 },
    ),
  );
  b.add('steel', rod(462, 476, 6, { y: 22 }));
  b.add('steel', pinZ(463, -3, 2.2, 9.5, 0.6));

  // handguard retainer
  b.add('steel', loft([
    { x: 420, y: -4, w: 37, h: 36, r: 7 },
    { x: 421.2, y: -4, w: 39.5, h: 38.5, r: 8 },
    { x: 430, y: -4, w: 39.5, h: 38.5, r: 8 },
    { x: 431.2, y: -4, w: 37, h: 36, r: 7 },
  ]));
  b.add('steel', studZ(426, -19, 2.4, 19, 25));

  // front sight
  b.add('steel', rod(627, 653, 11.2, { chamfer: 1 }));
  b.add(
    'steel',
    plate(
      poly([
        [629, 6],
        [651, 6],
        [648, 37, 1.5],
        [632, 37, 1.5],
      ]),
      { t: 11, bevel: 1.2 },
    ),
  );
  b.add('steel', plate(arcBand(0, 47, 9.4, 12.6, 128, 412), { t: 13, plane: 'zy', at: 640, bevel: 0.7 }));
  b.add('steel', alongY(rod(36, 50, 1.5, { chamfer: 0.4, segs: 12 })).translate(640, 0, 0));

  // cleaning rod
  b.add('steel', rod(431, 690, 2.3, { y: -13.5, segs: 12 }));
  b.add('steel', rod(690, 697, 3.2, { y: -13.5, segs: 12, chamfer: 0.8 }));
  b.add('steel', box(634, -17, 646, -8, 9, { bevel: 0.6, r: 1.5 }));

  /* ---------------- furniture ---------------- */
  // upper handguard
  b.add(
    'sec',
    loft([
      { x: 305, y: 22.5, w: 31, h: 20, rt: 10, rb: 3 },
      { x: 309, y: 23, w: 37, h: 25, rt: 12.5, rb: 3 },
      { x: 399, y: 23, w: 37, h: 25, rt: 12.5, rb: 3 },
      { x: 403, y: 22.5, w: 31, h: 20, rt: 10, rb: 3 },
    ]),
  );
  // lower handguard with palm swell
  b.add(
    'sec',
    loft([
      { x: 264, y: -11, w: 33, h: 26, rt: 2.5, rb: 9 },
      { x: 270, y: -13, w: 39, h: 31, rt: 3, rb: 11 },
      { x: 318, y: -14, w: 41, h: 33, rt: 3, rb: 12 },
      { x: 345, y: -14.5, w: 46, h: 34, rt: 3, rb: 13 },
      { x: 378, y: -14.5, w: 46, h: 34, rt: 3, rb: 13 },
      { x: 404, y: -14, w: 41, h: 33, rt: 3, rb: 12 },
      { x: 416, y: -13, w: 39, h: 31, rt: 3, rb: 11 },
      { x: 421, y: -11, w: 35, h: 27, rt: 2.5, rb: 9 },
    ]),
  );

  // stock
  const stock = plate(
    poly([
      [6, 5, 2],
      [-246, -22, 6],
      [-251, -120, 7],
      [-236, -123, 5],
      [-42, -45, 40],
      [6, -37, 2],
    ]),
    { t: 41, bevel: 10, bevelSegs: 4 },
  );
  b.add(
    'sec',
    warp(stock, (p) => {
      const k = THREE.MathUtils.clamp(-p.x / 250, 0, 1);
      p.z *= THREE.MathUtils.lerp(0.7, 1.0, Math.sqrt(k));
    }),
  );
  // buttplate
  b.add(
    'steel',
    plate(
      poly([
        [-249, -24, 2],
        [-254, -25, 2],
        [-259, -121, 3],
        [-253, -122, 2],
      ]),
      { t: 39, bevel: 1.6 },
    ),
  );
  b.add('steel', pinZ(-150, -55, 3.2, 17.2, 0.8)); // sling swivel boss

  // pistol grip
  const grip = plate(
    poly([
      [38, -37, 2],
      [80, -37, 4],
      [74, -58, 12],
      [51, -133, 8],
      [15, -127, 9],
      [27, -80, 30],
    ]),
    { t: 29, bevel: 7, bevelSegs: 4 },
  );
  b.add(
    'sec',
    warp(grip, (p) => {
      const k = THREE.MathUtils.clamp((-37 - p.y) / 95, 0, 1);
      p.z *= THREE.MathUtils.lerp(0.86, 1.06, k);
    }),
  );

  /* ---------------- fire controls ---------------- */
  b.add(
    'steel',
    plate(
      poly([
        [76, -38],
        [151, -38],
        [151, -46, 2],
        [147, -69, 6],
        [93, -72, 9],
        [80, -57, 5],
      ]),
      {
        t: 15,
        bevel: 0.6,
        holes: [
          poly([
            [84, -41],
            [146.5, -41],
            [143, -65.5, 5],
            [96, -68, 8],
            [84, -55, 4],
          ]),
        ],
      },
    ),
  );
  b.add(
    'steel',
    plate(
      poly([
        [111, -38],
        [120, -38],
        [118.5, -50, 4],
        [112.5, -62.5, 2.5],
        [108.2, -62.5, 1.5],
        [110, -51, 8],
      ]),
      { t: 6.5, bevel: 1.2 },
    ),
  );
  // magazine release paddle
  b.add(
    'steel',
    plate(
      poly([
        [149, -40],
        [157, -40],
        [159.5, -64, 2],
        [154, -70, 2],
        [150.5, -56, 2],
      ]),
      { t: 13, bevel: 0.8 },
    ),
  );

  // selector lever (right side only)
  b.add(
    'steel',
    plate(
      poly([
        [53, -1.5, 3],
        [70, -1.5, 3],
        [148, -8, 1],
        [160, -5, 1.5],
        [161.5, -13.5, 1.5],
        [148, -16, 1.5],
        [70, -14.5, 3],
        [53, -14.5, 3],
      ]),
      { t: 1.8, at: HW + 1.6, bevel: 0.5, bevelSegs: 1 },
    ),
  );
  b.add('steel', studZ(62, -8, 4.2, HW, HW + 3.6));
  b.add('steel', box(150, -15, 161, -5.5, 6, { at: HW + 5, bevel: 0.8, r: 1.5 }));

  /* ---------------- rivets and pins ---------------- */
  const rivets: [number, number, number][] = [
    [240, -1, 2.6],
    [254, -17, 2.6],
    [240, -31, 2.6],
    [12, -1, 2.3],
    [22, -24, 2.3],
    [165, -27, 2.0],
    [121, -25, 2.0],
    [139, -18, 2.0],
    [97, -9, 2.0],
  ];
  for (const [x, y, r] of rivets) b.add('steel', pinZ(x, y, r, HW, 0.55));

  /* ---------------- magazine ---------------- */
  // Banana curve: arcs about a centre ahead of the magazine well.
  const C: [number, number] = [442, -34];
  const rOut = 290;
  const rIn = 226;
  const a0 = 179;
  const a1 = 217;
  const magOutline = pts([...arcPts(C[0], C[1], rOut, a0, a1, 18), ...arcPts(C[0], C[1], rIn, a1, a0, 16)]);
  b.add('body', plate(magOutline, { t: 26, bevel: 2.2, bevelSegs: 3 }));
  for (const r of [240, 258, 276]) {
    b.add('body', plate(arcBand(C[0], C[1], r - 3, r + 3, 184, 213), { t: 28.4, bevel: 1.3, bevelSegs: 2 }));
  }
  // spine and floor plate
  b.add('body', plate(arcBand(C[0], C[1], rOut - 1.5, rOut + 1.6, 182, 215.5), { t: 10, bevel: 1 }));
  b.add('steel', plate(arcBand(C[0], C[1], rIn - 2, rOut + 2.5, 216.6, 218.4), { t: 28.6, bevel: 1 }));

  /* ---------------- detail pass ---------------- */
  // front trunnion reinforcement and the magazine-well dimple, both sides
  b.both(
    'body',
    plate(
      poly([
        [233, -36, 2],
        [262.4, -36, 1],
        [262.4, 5.5, 1],
        [237, 5.5, 3],
      ]),
      { t: 1.3, at: HW + 0.55, bevel: 0.5, bevelSegs: 1 },
    ),
  );
  b.both('dark', plate(slot(177, -15.5, 197, -15.5, 4.4), { t: 0.7, at: HW + 0.1, bevel: 0.25, bevelSegs: 1 }));
  // handguard vents: two slots low, three ports high, both sides
  b.both('dark', plate(slot(297, -8, 317, -8, 3.1), { t: 1.2, at: 20.3, bevel: 0.3, bevelSegs: 1 }));
  b.both('dark', plate(slot(352, -8, 372, -8, 3.1), { t: 1.2, at: 22.7, bevel: 0.3, bevelSegs: 1 }));
  for (const x of [328, 354, 380]) b.both('dark', plate(circle(x, 24.5, 3.3, 14), { t: 1.2, at: 18.2, bevel: 0.3, bevelSegs: 1 }));
  // grip: steel cap and screw, and pressed grooves on both sides
  b.add(
    'steel',
    plate(
      poly([
        [13, -127.5, 2],
        [51.5, -133.5, 2],
        [51, -137.5, 1.5],
        [12, -131.5, 1.5],
      ]),
      { t: 27, bevel: 1.2 },
    ),
  );
  for (let i = 0; i < 6; i++) {
    const y = -72 - i * 8.5;
    const x0 = 31 - i * 2.1;
    b.both('dark', plate(slot(x0, y, x0 + 26, y - 4.2, 1.2), { t: 0.9, at: 13.4 + i * 0.22, bevel: 0.2, bevelSegs: 1 }));
  }
  // take-down button, bayonet lug, magazine-catch pin, sling loop
  b.add('steel', rod(-3.6, 2.5, 4.3, { y: 15.5, chamfer: 0.8 }));
  b.add('steel', box(451, -17.5, 472, -9.2, 8.5, { bevel: 1, r: 1.6 }));
  b.add('steel', pinZ(153.5, -45, 1.7, 7.6, 0.5));
  b.add('steel', plate(arcBand(-150, -66.5, 5.4, 8, 0, 359.5), { t: 2.8, at: 19.6, bevel: 0.9, bevelSegs: 2 }));
  // buttplate trapdoor and screws
  b.add('steel', alongX3(-259.2, -72, 9));
  for (const y of [-38, -108]) b.add('bright', alongX3(-258.9, y, 2.6));
  // rear-sight range marks and a staked front-sight drum
  for (let i = 0; i < 5; i++) b.add('dark', box(284 + i * 9, 31.1 - i * 0.72, 285.2 + i * 9, 33.6 - i * 0.72, 11.6, { bevel: 0.2, bevelSegs: 1, r: 0.2 }));
  b.add('bright', pinZ(640, 33, 1.5, 5.6, 0.5));

  b.anchor('muzzle', 701, 0, 0, [1, 0, 0]);
  b.anchor('tally', 200, -12, HW + 0.4, [0, 0, 1]);
  b.anchor('eject', 205, 14, HW, [0.2, 0.6, 1]);
  return b.build();
}
