/**
 * Vesper-9: compact 9 mm submachine gun with a monolithic railed upper,
 * polymer lower, folding skeleton stock and a long stick magazine.
 * Authored in mm. x = 0 at the rear face of the upper, bore axis on y = 0.
 */
import * as THREE from 'three';
import { Builder, alongY, arcBand, box, circle, lathe, loft, pinZ, plate, poly, rail, rect, rod, rotate2, slot, studZ, warp, xf, type BuiltModel, type P2 } from '../kit';

export function buildVesper(): BuiltModel {
  const b = new Builder();
  const HW = 17; // upper half-width
  const LW = 16; // lower half-width
  const SW = 16.2; // upper half-width above the shoulder step

  /* ---------------- upper receiver ---------------- */
  // Cross-section in the zy plane; `port` notches the right side for ejection.
  const upperSec = (port: boolean): P2[] => {
    const p: P2[] = [
      [-17.8, -17, 0.8],
      [17.8, -17, 0.8],
      [17.8, -13.2],
      [HW, -12.4],
    ];
    if (port) p.push([HW, -5.5], [8, -5.5], [8, 8.6], [HW, 8.6]);
    p.push([HW, 9.5], [SW, 10.3], [SW, 12.5, 1.2], [10.6, 21.9, 2], [-10.6, 21.9, 2], [-SW, 12.5, 1.2], [-SW, 10.3], [-HW, 9.5], [-HW, -12.4], [-17.8, -13.2]);
    return p;
  };
  const seg = (sec: P2[], x0: number, x1: number, bevel = 0.7) => plate(poly(sec), { t: x1 - x0, plane: 'zy', at: (x0 + x1) / 2, bevel });
  b.add('body', seg(upperSec(false), 0, 118));
  b.add('body', seg(upperSec(true), 118, 162, 0.6));

  // hollow handguard: roof and floor straps, recessed slotted side plates, front ring
  const roof: P2[] = [
    [HW, 8.4],
    [HW, 9.5],
    [SW, 10.3],
    [SW, 12.5, 1.2],
    [10.6, 21.9, 2],
    [-10.6, 21.9, 2],
    [-SW, 12.5, 1.2],
    [-SW, 10.3],
    [-HW, 9.5],
    [-HW, 8.4],
    [-14, 8.4],
    [-14, 11.5],
    [-8.5, 19],
    [8.5, 19],
    [14, 11.5],
    [14, 8.4],
  ];
  const floor: P2[] = [
    [-17.8, -17, 0.8],
    [17.8, -17, 0.8],
    [17.8, -13.2],
    [HW, -12.4],
    [HW, -10.5],
    [14, -10.5],
    [14, -14],
    [-14, -14],
    [-14, -10.5],
    [-HW, -10.5],
    [-HW, -12.4],
    [-17.8, -13.2],
  ];
  b.add('body', seg(roof, 162, 274), seg(floor, 162, 274));
  const inner = poly([
    [-14, -14],
    [14, -14],
    [14, 11.5],
    [8.5, 19],
    [-8.5, 19],
    [-14, 11.5],
  ]);
  b.add('body', plate(poly(upperSec(false)), { t: 5, plane: 'zy', at: 276.5, bevel: 0.8, holes: [inner] }));
  const CY = 4.6; // charging-handle track height
  const side = plate(rect(162.4, -11.6, 116, 21, 0.4), {
    t: 3.3,
    at: 14.85,
    bevel: 0.4,
    bevelSegs: 1,
    holes: [slot(175, CY, 229, CY, 2.6), slot(176, -5.6, 196, -5.6, 3), slot(208, -5.6, 228, -5.6, 3)],
  });
  b.both('body', side);

  // top rail
  b.add('body', rail(3, 277, 21.6));

  /* ---------------- barrel ---------------- */
  b.add(
    'steel',
    lathe([
      [164, 0],
      [164, 11.5],
      [177, 11.5],
      [178.5, 8],
      [281, 8],
      [282, 7.4],
      [300, 7.4],
      [300, 0],
    ]),
  );

  /* ---------------- bolt in the ejection port ---------------- */
  b.add('bright', box(118.6, -5.2, 150.5, 8.7, 6, { at: 9, bevel: 0.6, r: 0.8 }));
  b.add('steel', box(150, -5.2, 161.6, 8.7, 6.8, { at: 9.1, bevel: 0.5, r: 0.6 })); // barrel extension
  b.add('dark', box(122, 3.6, 143, 5.4, 0.8, { at: 12, bevel: 0.2, r: 0.8 })); // cam track
  b.add('steel', box(141, -2.6, 151.5, 0.6, 1.6, { at: 12.4, bevel: 0.4, r: 0.6 })); // extractor
  b.add('steel', studZ(144, -1, 0.9, 12.6, 13.5, 0.2));
  // brass deflector behind the port
  b.add(
    'body',
    plate(
      poly([
        [103, HW - 0.6],
        [117.4, HW - 0.6],
        [117.4, HW + 4.2, 1.2],
        [112, HW + 4.2, 1.5],
      ]),
      { t: 13, plane: 'xz', at: 2, bevel: 0.8 },
    ),
  );

  /* ---------------- lower receiver ---------------- */
  b.add(
    'sec',
    plate(
      poly([
        [-3, -15.5, 1],
        [170, -15.5, 1],
        [171, -24, 2.5],
        [166, -40, 2],
        [60, -40, 1],
        [52, -44, 2],
        [6, -44, 3],
        [-3, -36, 3],
      ]),
      { t: LW * 2, bevel: 1.0 },
    ),
  );
  // raked magazine well
  const RAKE = 6;
  const rk = <T extends THREE.Vector2[]>(o: T) => rotate2(o, RAKE, 141, -17);
  const rkp = (x: number, y: number): [number, number] => {
    const c = Math.cos((RAKE * Math.PI) / 180);
    const s = Math.sin((RAKE * Math.PI) / 180);
    return [141 + (x - 141) * c - (y + 17) * s, -17 + (x - 141) * s + (y + 17) * c];
  };
  b.add(
    'sec',
    plate(
      rk(
        poly([
          [118, -12.5],
          [164, -16.5],
          [164.6, -57, 2],
          [166.6, -63, 1.5],
          [116.4, -63, 1.5],
          [118.4, -57, 2],
        ]),
      ),
      { t: 34.7, bevel: 1.3 },
    ),
  );
  b.add('dark', plate(rk(rect(122.4, -63.6, 38.4, 3, 0.6)), { t: 27.5, bevel: 0.3, bevelSegs: 1 }));
  // well side flutes
  for (const x of [128, 141, 154]) b.add('sec', plate(rk(rect(x - 3.4, -56, 6.8, 21, 1.6)), { t: 36.3, bevel: 0.8 }));

  /* ---------------- magazine ---------------- */
  const MB = -188; // magazine body bottom (before rake)
  b.add('body', plate(rk(rect(125, MB, 33, -10 - MB, 2)), { t: 21.6, bevel: 1.6, bevelSegs: 3 }));
  for (const x of [133.5, 149.5]) b.add('body', plate(rk(rect(x - 2.6, MB + 8, 5.2, -77 - MB, 2.2)), { t: 23.2, bevel: 0.8 }));
  b.add('body', plate(rk(rect(156.4, MB + 4, 3.2, -71 - MB, 1)), { t: 9, bevel: 1.0 })); // front spine
  b.add('body', plate(rk(rect(123.4, MB + 4, 3, -71 - MB, 1)), { t: 13, bevel: 1.0 })); // rear spine
  b.add('sec', plate(rk(rect(122.4, MB - 8, 39.6, 9.4, 2.4)), { t: 25, bevel: 1.6, bevelSegs: 3 }));
  b.add('sec', plate(rk(rect(124, MB - 0.6, 35.6, 3.4, 0.8)), { t: 23.4, bevel: 0.6 }));
  for (const y of [-92, -122, -152]) {
    const [wx, wy] = rkp(141.5, y);
    b.both('dark', studZ(wx, wy, 1.7, 10.4, 11.15, 0.15));
  }
  {
    const [fx, fy] = rkp(141.5, MB - 3.3);
    b.both('steel', studZ(fx, fy, 2.2, 12, 13, 0.3));
  }

  /* ---------------- pistol grip ---------------- */
  const gripWarp = (p: THREE.Vector3) => {
    const k = THREE.MathUtils.clamp((-37 - p.y) / 88, 0, 1);
    p.z *= THREE.MathUtils.lerp(0.88, 1.04, k);
  };
  const grip = plate(
    poly([
      [-8, -35.5, 2],
      [54, -37, 2],
      [53, -46, 5],
      [45.5, -57, 7],
      [45.5, -70, 14],
      [28.5, -127, 6],
      [-10.5, -122, 7],
      [-0.5, -92, 36],
      [4.5, -62, 18],
      [-1.5, -46, 6],
    ]),
    { t: 28, bevel: 6.5, bevelSegs: 4 },
  );
  b.add('sec', warp(grip, gripWarp));
  // grip ribs across the side panels, raked with the grip axis
  for (let i = 0; i < 9; i++) {
    const cx = 25.6 - i * 1.7;
    const cy = -59 - i * 6.6;
    const ax = [-0.249, -0.969];
    const px = [0.969, -0.249];
    const q = (u: number, v: number): P2 => [cx + px[0] * u + ax[0] * v, cy + px[1] * u + ax[1] * v, 1.1];
    const ribG = plate(poly([q(-12.5, -1.5), q(12.5, -1.5), q(12.5, 1.5), q(-12.5, 1.5)]), { t: 29.3, bevel: 0.7 });
    b.add('sec', warp(ribG, gripWarp));
  }
  // grip base cap
  b.add(
    'sec',
    plate(
      poly([
        [-12.4, -119.6, 2],
        [30.6, -125.2, 2],
        [29.6, -130.6, 2.4],
        [-13.2, -125.2, 2.4],
      ]),
      { t: 27, bevel: 2.4, bevelSegs: 3 },
    ),
  );
  b.add('steel', pinZ(22, -45.5, 2.2, 13.2, 0.5));

  /* ---------------- trigger group ---------------- */
  b.add(
    'sec',
    plate(
      poly([
        [50, -39],
        [121, -39],
        [121.5, -47, 2],
        [117, -66, 5],
        [63, -70, 8],
        [50, -56, 4],
      ]),
      {
        t: 13,
        bevel: 0.9,
        holes: [
          poly([
            [56, -41.6],
            [116, -41.6],
            [113, -62.2, 4],
            [65.5, -65.6, 7],
            [56, -54, 3],
          ]),
        ],
      },
    ),
  );
  b.add(
    'steel',
    plate(
      poly([
        [84, -38],
        [93.5, -38],
        [92, -49, 4],
        [87, -60.5, 2.2],
        [83.2, -60.5, 1.4],
        [84.2, -50, 8],
      ]),
      { t: 6.4, bevel: 1.2 },
    ),
  );

  /* ---------------- muzzle: three-lug mount + birdcage ---------------- */
  for (const a of [0, 120, 240]) {
    b.add('steel', xf(plate(rect(-2.1, 6.4, 4.2, 4.4, 0.5), { t: 8, plane: 'zy', at: 288.5, bevel: 0.6 }), { rx: a }));
  }
  b.add('steel', rod(293.6, 297.4, 8.7, { chamfer: 0.7 }));
  b.add('steel', rod(297.2, 306, 9.7, { chamfer: 0.9 }));
  for (let i = 0; i < 6; i++) {
    const a = 30 + i * 60;
    b.add('steel', plate(arcBand(0, 0, 5.5, 9.7, a - 19, a + 19), { t: 16.4, plane: 'zy', at: 313.4, bevel: 0.45, bevelSegs: 1 }));
  }
  b.add(
    'steel',
    lathe([
      [320.8, 5.3],
      [320.8, 9.7],
      [324.8, 9.7],
      [326, 8.6],
      [326, 5.3],
      [320.8, 5.3],
    ]),
  );
  b.add('dark', rod(303, 321.4, 5.2, { chamfer: 0.2 }));

  /* ---------------- charging handles (ambidextrous, forward) ---------------- */
  b.both('steel', rod(160, 233, 2.2, { y: CY, z: 11.4, segs: 12 }));
  b.both('steel', plate(slot(219, CY, 227, CY, 2.3), { t: 5.4, at: 15.6, bevel: 0.5 }));
  b.both('steel', studZ(223, CY, 3.2, 17.5, 26.5));
  b.both('steel', studZ(223, CY, 4.5, 24, 30, 1.1));
  for (const z of [20, 21.6, 23.2]) b.both('steel', studZ(223, CY, 3.7, z - 0.4, z + 0.4, 0.3)); // knurl rings

  /* ---------------- accessory rails ---------------- */
  for (const g of rail(240, 273.5, 16.2)) b.add('body', xf(g.clone(), { rx: 90 }), xf(g, { rx: -90 }));
  b.add('body', rail(186, 272, -16.7, { down: true }));

  /* ---------------- vertical fore-grip ---------------- */
  b.add(
    'sec',
    plate(
      poly([
        [-13.6, -19.5, 1],
        [13.6, -19.5, 1],
        [13.6, -28, 1.5],
        [10.5, -31.5, 1],
        [-10.5, -31.5, 1],
        [-13.6, -28, 1.5],
      ]),
      { t: 31, plane: 'zy', at: 223, bevel: 1.0 },
    ),
  );
  b.add('steel', pinZ(223, -24.2, 3, 13.6, 1.4));
  {
    const secs: { x: number; w: number; h: number; r: number }[] = [
      { x: -93, w: 17, h: 21, r: 7 },
      { x: -91, w: 22.5, h: 27, r: 9 },
    ];
    for (let i = 0; i < 5; i++) {
      const y = -86 + i * 10;
      const sw = 1 + 0.6 * Math.sin((i / 4) * Math.PI);
      secs.push({ x: y, w: 23.5 + sw, h: 28.5 + sw, r: 9.5 }, { x: y + 5.5, w: 23.5 + sw, h: 28.5 + sw, r: 9.5 });
      secs.push({ x: y + 6.5, w: 21.6 + sw, h: 26.6 + sw, r: 8.6 }, { x: y + 9, w: 21.6 + sw, h: 26.6 + sw, r: 8.6 });
    }
    secs.push({ x: -35, w: 24.5, h: 30, r: 7 }, { x: -30.5, w: 24.5, h: 30, r: 7 });
    b.add('sec', xf(alongY(loft(secs)), { x: 223 }));
  }

  /* ---------------- folding skeleton stock ---------------- */
  b.add(
    'steel',
    plate(
      poly([
        [-16.2, -16.2, 1],
        [16.2, -16.2, 1],
        [16.2, 12.2, 1.5],
        [10, 21.2, 2],
        [-10, 21.2, 2],
        [-16.2, 12.2, 1.5],
      ]),
      { t: 6, plane: 'zy', at: -2.6, bevel: 0.8 },
    ),
  );
  b.add('steel', plate(rect(-17, -13.5, 12.4, 23, 1.5), { t: 25, bevel: 1.2 })); // hinge block
  const knuckle = (y0: number, y1: number, r: number) => xf(alongY(rod(y0, y1, r, { chamfer: 0.6, segs: 18 })), { x: -15.5, z: 11.5 });
  b.add('steel', knuckle(-13.8, -6.6, 4.8), knuckle(2.2, 9.8, 4.8), knuckle(-15.4, 11.4, 1.9));
  b.add('sec', knuckle(-6.2, 1.8, 4.8));
  b.add('steel', studZ(-10.5, -2, 3.1, -15.6, -12)); // latch button
  b.add(
    'sec',
    plate(
      poly([
        [-17.4, 11, 2],
        [-186, 11, 3],
        [-190, 5, 2],
        [-190, -78, 3],
        [-176, -80, 3],
        [-160, -62, 6],
        [-52, -14, 10],
        [-17.4, -14, 2],
      ]),
      {
        t: 22,
        bevel: 2.4,
        bevelSegs: 3,
        holes: [
          poly([
            [-43.5, 2.5, 3],
            [-173, 2.5, 4],
            [-173, -56.5, 5],
          ]),
        ],
      },
    ),
  );
  // cheek pad and butt pad
  b.add(
    'rubber',
    loft([
      { x: -158, y: 11.5, w: 19, h: 4, r: 2 },
      { x: -154, y: 12.6, w: 25, h: 7, rt: 3.4, rb: 1 },
      { x: -52, y: 12.6, w: 25, h: 7, rt: 3.4, rb: 1 },
      { x: -48, y: 11.5, w: 19, h: 4, r: 2 },
    ]),
  );
  b.add(
    'rubber',
    plate(
      poly([
        [-188.6, 13.5, 2],
        [-198, 12, 4],
        [-200, -79, 4],
        [-188.6, -82, 2],
      ]),
      { t: 27, bevel: 3, bevelSegs: 3 },
    ),
  );
  for (let i = 0; i < 9; i++) b.add('rubber', box(-201.2, -72 + i * 9, -198, -67.6 + i * 9, 21, { bevel: 0.8, r: 0.8 }));
  b.add('steel', pinZ(-181.5, -28, 4.6, 11, 0.6));
  b.both('dark', studZ(-181.5, -28, 2.9, 11.2, 11.95, 0.15));

  /* ---------------- iron sights ---------------- */
  const sightBase = poly([
    [-12.6, 24.6, 1],
    [12.6, 24.6, 1],
    [12.6, 31, 1],
    [9.4, 34.6, 1],
    [-9.4, 34.6, 1],
    [-12.6, 31, 1],
  ]);
  b.add('steel', plate(sightBase, { t: 25, plane: 'zy', at: 28, bevel: 0.8 }));
  b.add('steel', pinZ(28, 28, 2.7, 12.6, 2.2));
  b.add(
    'steel',
    plate(
      poly([
        [-6.4, 34],
        [6.4, 34],
        [6.4, 43.5, 2],
        [3.4, 49.6, 3],
        [-3.4, 49.6, 3],
        [-6.4, 43.5, 2],
      ]),
      { t: 3, plane: 'zy', at: 31, bevel: 0.5, holes: [circle(0, 43, 2.5, 18)] },
    ),
  );
  b.both(
    'steel',
    plate(
      poly([
        [17, 34],
        [39.5, 34],
        [39.5, 40, 2],
        [34.5, 50.5, 3],
        [26.5, 50.5, 3],
        [17, 41, 3],
      ]),
      { t: 2.8, at: 9.6, bevel: 0.7 },
    ),
  );
  b.add('steel', studZ(31, 38.6, 3.7, 10.5, 17.5, 0.7));
  b.add('steel', plate(sightBase, { t: 22, plane: 'zy', at: 259, bevel: 0.8 }));
  b.add('steel', pinZ(259, 28, 2.7, 12.6, 2.2));
  b.both(
    'steel',
    plate(
      poly([
        [249, 34],
        [269.5, 34],
        [269.5, 38.5, 2],
        [264.5, 50.5, 2.5],
        [258, 50.5, 2.5],
        [249, 40.5, 3],
      ]),
      { t: 2.8, at: 8.6, bevel: 0.7 },
    ),
  );
  b.add('steel', xf(alongY(rod(33.5, 38, 3.3, { chamfer: 0.6, segs: 14 })), { x: 260 }));
  b.add('steel', xf(alongY(rod(37, 47.2, 1.3, { chamfer: 0.35, segs: 10 })), { x: 260 }));

  /* ---------------- controls and pins ---------------- */
  // ambidextrous selector with position pips
  b.both('steel', studZ(30, -27, 4.7, 15.5, 18.2));
  b.both('steel', plate(slot(30, -27, 44.5, -24, 2.7), { t: 2.2, at: 18.9, bevel: 0.5 }));
  b.both(
    'steel',
    plate(
      poly(
        [
          [40, -28.2],
          [49, -26.3],
          [48, -20.8],
          [39, -22.7],
        ],
        1,
      ),
      { t: 3.6, at: 19.6, bevel: 0.8 },
    ),
  );
  for (const a of [12, 48, 84]) {
    const r = (a * Math.PI) / 180;
    b.both('dark', studZ(30 + Math.cos(r) * 23.5, -27 + Math.sin(r) * 8.2 + 1.2, 1.0, LW - 0.2, LW + 0.35, 0.1));
  }
  // magazine release button and fence (right), catch bar (left)
  b.add('steel', plate(rect(103, -36.4, 11, 10.4, 1.6), { t: 3.4, at: LW + 1.3, bevel: 0.7 }));
  for (const y of [-33.8, -31.2, -28.6]) b.add('steel', box(104.4, y - 0.6, 112.6, y + 0.6, 0.8, { at: LW + 3.2, bevel: 0.25, r: 0.4 }));
  b.add('sec', box(100.6, -39.4, 116.4, -37, 5.4, { at: LW + 1.4, bevel: 0.7, r: 0.8 }));
  b.add('steel', plate(rk(rect(122, -30.6, 24, 5.6, 1)), { t: 2.6, at: -18.2, bevel: 0.6 }));
  b.add('steel', plate(rk(rect(124, -30.6, 5, 5.6, 1)), { t: 2, at: -19.6, bevel: 0.5 }));
  // bolt release: paddle (left) and lever (right)
  b.add(
    'steel',
    plate(
      poly([
        [97.5, -18.6, 1],
        [110, -18.6, 1],
        [111, -32, 2],
        [104, -37, 2],
        [98, -33, 2],
      ]),
      { t: 3, at: -(LW + 1.1), bevel: 0.7 },
    ),
  );
  for (const y of [-21.2, -23.8, -26.4]) b.add('steel', box(99.2, y - 0.6, 108.8, y + 0.6, 0.8, { at: -(LW + 2.8), bevel: 0.25, r: 0.4 }));
  b.add('steel', plate(slot(69, -21, 85, -21, 2.2), { t: 2, at: LW + 0.7, bevel: 0.5 }));
  b.add('steel', box(64.5, -24.2, 72.5, -17.8, 3.4, { at: LW + 1.4, bevel: 0.8, r: 1.2 }));
  // takedown, trigger and hammer pins
  b.add('steel', pinZ(163, -23, 3.3, LW, 1.0), pinZ(9, -24, 3.3, LW, 1.0), pinZ(89, -31.5, 1.9, LW, 0.5), pinZ(67, -30, 1.9, LW, 0.5));
  // sling sockets and handguard screws
  b.both('steel', studZ(14, 1, 5.2, HW - 0.5, HW + 0.8, 0.4));
  b.both('dark', studZ(14, 1, 3.3, HW + 0.4, HW + 1.15, 0.15));
  for (const [x, y] of [
    [167.2, CY],
    [167.2, -5.6],
    [235.6, CY],
    [235.6, -5.6],
  ]) b.both('steel', studZ(x, y, 1.9, 16, 17.3, 0.3));

  /* ---------------- left-side details ---------------- */
  // data plate with corner screws
  b.add('body', plate(rect(30, -9, 62, 15, 1.6), { t: 1.2, at: -(HW + 0.3), bevel: 0.4, bevelSegs: 1 }));
  for (const [x, y] of [
    [33.6, -5.6],
    [88.4, -5.6],
    [33.6, 2.6],
    [88.4, 2.6],
  ]) b.add('steel', studZ(x, y, 1.3, -(HW + 1.3), -(HW + 0.5), 0.25));
  // ejector housing above the magazine well
  b.add('body', plate(rect(121, -9.5, 38, 13, 1.4), { t: 1.6, at: -(HW + 0.4), bevel: 0.5, bevelSegs: 1 }));
  b.add('steel', studZ(128, -3, 1.7, -(HW + 1.6), -(HW + 0.6), 0.3), studZ(152, -3, 1.7, -(HW + 1.6), -(HW + 0.6), 0.3));

  b.anchor('muzzle', 326, 0, 0, [1, 0, 0]);
  b.anchor('tally', 62, -1, HW + 0.2, [0, 0, 1]);
  b.anchor('eject', 140, 2, HW, [0.2, 0.5, 1]);
  return b.build();
}
