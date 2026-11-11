/**
 * Longwatch .338: bolt-action precision rifle in a skeleton chassis with a
 * fluted heavy barrel, three-port muzzle brake, folded bipod and a 34 mm scope.
 * Authored in mm. x = 0 at the rear face of the receiver, bore axis on y = 0.
 */
import * as THREE from 'three';
import { Builder, alongY, alongZ, arcBand, arcPts, box, circle, lathe, loft, pinZ, plate, poly, pts, rail, rect, rod, slot, studZ, tube, warp, xf, type BuiltModel, type V2 } from '../kit';

/** Obround hole outline along X with a fixed, low point count. */
function oval(x0: number, x1: number, y: number, r: number, n = 4): V2[] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI;
    out.push([x1 - r + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + (i / n) * Math.PI;
    out.push([x0 + r + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return pts(out);
}

export function buildLongwatch(): BuiltModel {
  const b = new Builder();
  const RZ = 18; // receiver half-width
  const CZ = 23; // chassis half-width
  const SY = 62; // scope axis height

  /* ---------------- receiver ---------------- */
  // Core section (z, y); the right wall is a separate plate so the ejection port is a real opening.
  b.add(
    'body',
    plate(
      poly([
        [-12, -18],
        [11, -18],
        [11, 10],
        [17.7, 10],
        [9.5, 18.3, 1.6],
        [-9.5, 18.3, 1.6],
        [-RZ, 9.5, 2.4],
        [-RZ, -10, 2.4],
      ]),
      { t: 232, plane: 'zy', at: 116, bevel: 0.9 },
    ),
  );
  b.add('body', plate(rect(0.4, -18, 231.2, 28.3, 1.4), { t: 7.3, at: 14.35, bevel: 0.8, holes: [rect(96, -5, 92, 12.5, 2.4)] }));
  // port interior and bolt body
  b.add('dark', box(92, -8, 192, 10, 0.8, { at: 11.2, bevel: 0 }));
  b.add('bright', rod(92, 181, 10, { y: 0.6, z: 3.4, chamfer: 0.8 }));
  b.add('steel', rod(180, 192, 8.4, { y: 0.6, z: 3.4, chamfer: 0.6 }));
  b.add('body', rail(4, 229.3, 18.1));

  /* ---------------- barrel ---------------- */
  const taper = (x: number) => 1 - 0.186 * THREE.MathUtils.clamp((x - 271) / 472, 0, 1);
  b.add(
    'steel',
    lathe([
      [226, 0],
      [226, 15.5],
      [262, 15.5],
      [268, 14.7],
      [271, 14.7],
      [273, 12.2],
      [741, 12.2 * taper(741)],
      [743, 11.9],
      [797, 11.9],
      [797, 0],
    ]),
  );
  // flutes: eight ribs standing on the core, tapered with the barrel
  for (let k = 0; k < 8; k++) {
    const rib = plate(arcBand(0, 0, 11.6, 14.5, k * 45 + 9, k * 45 + 36), { t: 472, plane: 'zy', at: 507, bevel: 0.9, bevelSegs: 1 });
    b.add(
      'steel',
      warp(rib, (p) => {
        const s = taper(p.x);
        p.y *= s;
        p.z *= s;
      }),
    );
  }

  // receiver ring, barrel lock nut and left-side details
  b.add('body', rod(223, 240, 19.4, { chamfer: 1.3 }));
  b.add('steel', rod(239.4, 248, 17.4, { chamfer: 0.9, segs: 16 }));
  b.add('dark', studZ(207, 3, 1.9, -(RZ + 0.3), -(RZ - 0.5), 0.05));
  b.add('steel', box(5, -7.5, 24, 1.5, 2.6, { at: -(RZ + 0.9), bevel: 0.7, r: 1.6 }));
  for (let i = 0; i < 4; i++) b.add('steel', box(7.5 + i * 3.6, -6, 9.3 + i * 3.6, 0, 1.4, { at: -(RZ + 2.4), bevel: 0.4, r: 0.5 }));
  b.add('body', box(30, -9, 200, -4.6, 1.5, { at: -(RZ + 0.2), bevel: 0.55, r: 1.4 }));

  /* ---------------- bolt ---------------- */
  b.add('bright', rod(-16, 3, 10.4, { chamfer: 0.6 }));
  b.add('steel', rod(-14.6, -1.4, 13.2, { chamfer: 1 }));
  b.add(
    'steel',
    lathe([
      [-52, 0],
      [-52, 8.6],
      [-49, 11.2],
      [-24, 12.6],
      [-20, 14],
      [-14, 14],
      [-14, 0],
    ]),
  );
  b.add('bright', rod(-55, -51.4, 2.6, { chamfer: 0.4, segs: 12 }));
  // bent bolt handle with a teardrop knob (right-hand side)
  b.add('steel', alongZ(rod(8, 28, 5.2, { chamfer: 0.4, segs: 16 })).translate(-8, 0, 0));
  const bh = <T extends THREE.BufferGeometry>(g: T) => xf(alongZ(g), { rx: 47 }).translate(-8, 0, 26.5) as T;
  b.add('steel', bh(rod(-3.5, 27, 5, { chamfer: 1.6, segs: 16 })));
  b.add(
    'steel',
    bh(
      lathe(
        [
          [22, 0],
          [22, 4.6],
          [25, 8.6],
          [31, 11.6],
          [38, 12.2],
          [45, 10.6],
          [49.5, 6.6],
          [51, 0],
        ],
        { segs: 20 },
      ),
    ),
  );
  // safety wing on the shroud
  b.add('steel', studZ(-37, 5, 3.2, 9.5, 15.6, 0.5));
  b.add('steel', plate(poly([[-47, 2.6, 1.4], [-30, 2.6, 2.6], [-29, 8, 2.4], [-35, 12.4, 1.6], [-47, 10.4, 1.6]]), { t: 2.6, at: 13.9, bevel: 0.7 }));
  b.add('steel', box(-49.5, 7.4, -41, 12.6, 5.6, { at: 16.4, bevel: 0.9, r: 1.5 }));

  /* ---------------- muzzle brake ---------------- */
  b.add('steel', rod(789, 800, 14.4, { chamfer: 1, segs: 12 }));
  for (const s of [-1, 1]) {
    b.add(
      'steel',
      plate(
        poly([
          [-20, 7 * s],
          [20, 7 * s],
          [20, 17 * s, 5],
          [-20, 17 * s, 5],
        ]),
        { t: 65.8, plane: 'zy', at: 832.5, bevel: 1 },
      ),
    );
  }
  const baffle = rect(-19.6, -16.6, 39.2, 33.2, 5);
  b.add('steel', plate(baffle, { t: 14, plane: 'zy', at: 806, bevel: 1.1 }));
  for (const [x, t] of [
    [828.5, 5],
    [846.5, 5],
    [862.25, 7.5],
  ]) {
    b.add('steel', plate(baffle, { t, plane: 'zy', at: x, bevel: 1.1, holes: [circle(0, 0, 5.6, 18)] }));
  }
  b.add('dark', rod(812.4, 813.5, 5.3, { chamfer: 0.05, segs: 18 }));

  /* ---------------- chassis centre section ---------------- */
  b.add(
    'body',
    plate(
      poly([
        [-22, -14.3],
        [236, -14.3],
        [236, -37, 2.5],
        [202, -37, 2.5],
        [198, -52, 3],
        [84, -52, 3],
        [81, -38, 2.5],
        [22, -38, 2.5],
        [16, -46, 2.5],
        [-22, -46, 3],
      ]),
      { t: CZ * 2, bevel: 1.2 },
    ),
  );
  // flared magazine-well lip with a dark mouth
  b.add('body', plate(poly([[82.4, -46.4, 1.8], [199.6, -46.4, 1.8], [200.2, -55, 2.6], [81.8, -55, 2.6]]), { t: CZ * 2 + 3.2, bevel: 1.3, bevelSegs: 3 }));
  b.add('dark', plate(rect(88, -14, 106, 28, 2.5), { t: 1.2, plane: 'xz', at: -55, bevel: 0 }));
  // cross pins and sling cups
  b.add('steel', pinZ(219, -25.5, 3, CZ, 0.5), pinZ(36, -26, 2.4, CZ, 0.5));
  for (const s of [-1, 1]) {
    b.add('steel', plate(circle(-8, -30, 5.6, 14), { t: 1.8, at: s * (CZ + 0.3), bevel: 0.5, bevelSegs: 1, holes: [circle(-8, -30, 3.6, 12)] }));
    b.add('dark', studZ(-8, -30, 3.8, s * (CZ + 0.45) - 0.25, s * (CZ + 0.45) + 0.25, 0.05));
  }

  // trigger guard, trigger and magazine release lever
  b.add(
    'body',
    plate(
      poly([
        [19, -37],
        [86, -37],
        [86, -55, 2.5],
        [79, -78, 6],
        [31, -80, 8],
        [19, -62, 5],
      ]),
      {
        t: 13,
        bevel: 0.8,
        holes: [
          poly([
            [25, -40.5, 1.5],
            [80.5, -40.5, 1.5],
            [80, -54, 2.5],
            [75, -72.5, 5],
            [33, -74.5, 7],
            [25, -60, 4.5],
          ]),
        ],
      },
    ),
  );
  b.add(
    'steel',
    plate(
      poly([
        [45, -36],
        [53.5, -36],
        [53, -48, 2.5],
        [55, -66, 1.7],
        [51, -68, 1.7],
        [47.5, -50, 4],
      ]),
      { t: 7, bevel: 1.1, bevelSegs: 3 },
    ),
  );
  b.add('steel', plate(poly([[83.4, -52], [88.6, -52], [89, -69, 2], [84.5, -76.5, 2], [81, -73.5, 1.6]]), { t: 11, bevel: 0.8 }));

  /* ---------------- magazine ---------------- */
  b.add(
    'body',
    plate(
      poly([
        [92, -30],
        [190, -30],
        [190, -92, 3],
        [184, -103, 3],
        [94, -103, 3],
      ]),
      { t: 25, bevel: 1.4 },
    ),
  );
  for (const y of [-69.5, -81.5]) b.add('body', box(101, y - 2.3, 181, y + 2.3, 26.6, { bevel: 0.7, r: 1.6 }));
  b.add('body', plate(poly([[91, -99, 1.8], [187, -99, 1.8], [183.4, -107, 2.6], [91, -107, 2.6]]), { t: 27.6, bevel: 1.2 }));
  for (const x of [112, 126, 140]) b.add('dark', studZ(x, -62, 1.5, 12.2, 12.85, 0.05), studZ(x, -62, 1.5, -12.85, -12.2, 0.05));

  /* ---------------- pistol grip ---------------- */
  const grip = <T extends THREE.BufferGeometry>(g: T) => xf(g, { rz: -105, x: 0, y: -40 });
  b.add(
    'sec',
    grip(
      loft(
        [
          { x: 0, w: 27, h: 43, rt: 6, rb: 9 },
          { x: 8, w: 31, h: 45.5, rt: 7, rb: 11 },
          { x: 34, w: 30.6, h: 44, rt: 8, rb: 12 },
          { x: 64, w: 33, h: 45.5, rt: 8.5, rb: 13 },
          { x: 90, w: 32.6, h: 47, rt: 8.5, rb: 13 },
          { x: 101, w: 32, h: 46.4, rt: 8, rb: 12.5 },
          { x: 105.5, w: 28, h: 41.5, rt: 6.5, rb: 10.5 },
        ],
        { k: 6 },
      ),
    ),
  );
  b.add(
    'sec',
    grip(
      loft([
        { x: 22, w: 29, h: 25, r: 3.5 },
        { x: 25, w: 32, h: 28, r: 4 },
        { x: 64, w: 34.4, h: 29, r: 4 },
        { x: 92, w: 34, h: 30, r: 4 },
        { x: 95, w: 31, h: 27, r: 3.5 },
      ]),
    ),
  );
  for (let i = 0; i < 8; i++) {
    const s = 26 + i * 8.6;
    b.add(
      'sec',
      grip(
        loft([
          { x: s, y: 6, w: 17, h: 33, rt: 6, rb: 4 },
          { x: s + 1, y: 6.8, w: 19, h: 35, rt: 7, rb: 4 },
          { x: s + 3.4, y: 6.8, w: 19, h: 35, rt: 7, rb: 4 },
          { x: s + 4.4, y: 6, w: 17, h: 33, rt: 6, rb: 4 },
        ]),
      ),
    );
  }
  b.add('dark', grip(loft([{ x: 104.5, w: 18, h: 29, r: 5 }, { x: 106, w: 18, h: 29, r: 5 }])));

  /* ---------------- open-top forend ---------------- */
  // Five faces of an octagon about (0, FY); every face is its own plate so the slots are real openings.
  const FY = -12;
  const F0 = 240;
  const F1 = 560;
  const slots: V2[][] = [];
  for (let i = 0; i < 6; i++) slots.push(oval(258 + i * 44, 292 + i * 44, FY, 3.6));
  const vents: V2[][] = [];
  for (let i = 0; i < 12; i++) vents.push(oval(258 + i * 24, 274 + i * 24, FY, 3.1, 3));
  const face = (deg: number, holes: V2[][]) =>
    xf(plate(rect(F0, FY - 9.5, F1 - F0, 19), { t: 3, at: 21.1, bevel: 0.5, bevelSegs: 1, holes }), { rx: deg, pivot: [0, FY, 0] });
  b.add('body', face(0, slots), face(180, slots), face(90, slots.slice(0, 5)), face(45, vents), face(135, vents));
  for (const s of [-1, 1]) b.add('body', rod(243, 557, 2.3, { y: FY + 9.6, z: s * 21.1, segs: 10, chamfer: 0.6 }));
  // bulkheads closing the channel at both ends, relieved for the barrel
  const bulk = pts([
    [23.3, FY + 9.65],
    ...arcPts(0, 0, 16.6, 351.86, 188.14, 10),
    [-23.3, FY + 9.65],
    [-23.3, FY - 9.65],
    [-9.65, FY - 23.3],
    [9.65, FY - 23.3],
    [23.3, FY - 9.65],
  ]);
  b.add('body', plate(bulk, { t: 8, plane: 'zy', at: 239.5, bevel: 0.8 }));
  b.add('body', plate(bulk, { t: 5, plane: 'zy', at: 558.5, bevel: 0.8 }));
  // accessory rail under the front for the bipod
  b.add('body', rail(498, 553.3, FY - 22.4, { down: true }));

  /* ---------------- bipod, folded forward ---------------- */
  b.add('steel', box(506, -49.5, 546, -40, 31, { bevel: 0.8, r: 1.6 }));
  b.add('steel', alongZ(rod(-27, -15, 6.2, { chamfer: 0.9, segs: 10 })).translate(526, -44.6, 0));
  b.add('steel', box(516, -61, 538, -48.5, 47, { bevel: 1, r: 2.4 }));
  b.add('steel', pinZ(527, -55, 3, 23.5, 0.9));
  for (const s of [-1, 1]) {
    const z = s * 19.5;
    b.add('steel', rod(532, 662, 5.4, { y: -56, z, segs: 14, chamfer: 0.6 }));
    b.add('steel', rod(650, 665, 6.7, { y: -56, z, segs: 14, chamfer: 0.9 }));
    b.add('steel', rod(661, 746, 4.2, { y: -56, z, segs: 12, chamfer: 0.5 }));
    for (const x of [690, 706, 722]) b.add('dark', rod(x, x + 2.4, 4.45, { y: -56, z, segs: 12, chamfer: 0.1 }));
    b.add('rubber', rod(741, 764, 6.6, { y: -56, z, segs: 14, chamfer: 2.2 }));
    b.add('steel', rod(536, 604, 1.4, { y: -50.2, z, segs: 8, chamfer: 0.3 }));
  }

  /* ---------------- skeleton buttstock ---------------- */
  // folding hinge
  b.add('steel', plate(poly([[-47, -16, 2.4], [-20.5, -16], [-20.5, -45], [-47, -45, 2.4]]), { t: 42, bevel: 1.2 }));
  b.add('steel', alongY(rod(-48.5, -12.5, 3.8, { chamfer: 0.7, segs: 14 })).translate(-34, 0, -21.6));
  for (const y of [-41, -30.5, -20]) b.add('steel', alongY(rod(y - 3.4, y + 3.4, 5.2, { chamfer: 0.6, segs: 14 })).translate(-34, 0, -21.6));
  b.add('steel', studZ(-34, -30.5, 5, 20, 23.6, 0.8));
  b.add('dark', studZ(-34, -30.5, 2.2, 23.3, 23.9, 0.05));
  // backbone with lightening slots
  b.add(
    'sec',
    plate(rect(-302, -43.5, 256, 26, 2.6), {
      t: 30,
      bevel: 1.5,
      holes: [oval(-104, -60, -30.5, 5.6), oval(-160, -116, -30.5, 5.6)],
    }),
  );
  // butt frame, lower strut with bag-rider flat
  b.add('sec', plate(poly([[-296, -14, 2.5], [-314, -4, 4], [-314, -116, 4], [-297, -116, 4]]), { t: 32, bevel: 1.6 }));
  b.add(
    'sec',
    plate(
      poly([
        [-303, -101],
        [-303, -115.6],
        [-289, -115.6, 5],
        [-200, -48, 3],
        [-200, -40],
        [-215, -40],
      ]),
      { t: 22, bevel: 1.6 },
    ),
  );
  // length-of-pull rods, thumbwheel, pad carrier and ribbed recoil pad
  for (const y of [-22, -98]) b.add('steel', rod(-326, -312, 4, { y, segs: 12, chamfer: 0.4 }));
  b.add('steel', rod(-327, -312, 3.2, { y: -60, segs: 10, chamfer: 0.3 }));
  b.add('steel', rod(-321.4, -316.6, 11, { y: -60, segs: 14, chamfer: 0.9 }));
  b.add('sec', plate(rect(-324.6, -116, 4.8, 127, 1.8), { t: 35, bevel: 1 }));
  b.add('rubber', plate(poly([[-334, 14, 3], [-325.4, 18, 3], [-323.4, -120, 3], [-332.4, -120, 3]]), { t: 40, bevel: 2.4, bevelSegs: 3 }));
  for (let i = 0; i < 8; i++) {
    const y = 6 - i * 16;
    b.add('rubber', box(-335.4 + (6 - y) * 0.0116, y - 4.6, -333.3 + (6 - y) * 0.0116, y + 4.6, 30, { bevel: 0.6, r: 0.9 }));
  }
  // adjustable cheek riser on two posts, with a locking knob
  b.add(
    'sec',
    loft(
      [
        { x: -287, y: 12, w: 33, h: 19, rt: 9, rb: 3 },
        { x: -282, y: 13, w: 40, h: 26, rt: 13, rb: 4 },
        { x: -171, y: 13, w: 40, h: 26, rt: 13, rb: 4 },
        { x: -165, y: 12, w: 33, h: 19, rt: 9, rb: 3 },
      ],
      { k: 6 },
    ),
  );
  b.add('steel', box(-272, -2, -180, 3, 25, { bevel: 0.8, r: 1.6 }));
  for (const x of [-190, -262]) {
    b.add('steel', alongY(rod(-22, 2, 4.2, { chamfer: 0.4, segs: 12 })).translate(x, 0, 0));
    b.add('steel', alongY(rod(-18.6, -14.4, 7, { chamfer: 0.8, segs: 14 })).translate(x, 0, 0));
  }
  b.add('steel', alongZ(rod(14, 27, 7.6, { chamfer: 1.1, segs: 12 })).translate(-226, -30.5, 0));
  b.add('steel', alongZ(rod(-18.4, -14, 4.4, { chamfer: 0.7, segs: 12 })).translate(-226, -30.5, 0));

  /* @@NEXT */

  /* ---------------- telescopic sight ---------------- */
  // 34 mm main tube with a 56 mm objective, on two rings over the receiver rail.
  b.add(
    'body',
    lathe(
      [
        [-20, 18.5],
        [-30, 18.5],
        [-30, 21],
        [48, 21],
        [58, 17],
        [116, 17],
        [119, 21],
        [151, 21],
        [154, 17],
        [232, 17],
        [264, 29],
        [334, 29.6],
        [334, 27],
        [318, 27],
      ],
      { y: SY, segs: 40 },
    ),
  );
  // magnification ring and ocular lock ring
  b.add('steel', lathe([[40, 21.2], [40, 22.6], [54, 22.6], [54, 21.2]], { y: SY, segs: 40 }));
  b.add('rubber', lathe([[-33, 19], [-33, 22.8], [-22, 22.8], [-22, 21.2]], { y: SY, segs: 40 }));
  // lenses, recessed in both bells
  b.add('glass', lathe([[-21, 0], [-21, 18.6]], { y: SY, segs: 40 }));
  b.add('glass', lathe([[320, 27.1], [320, 0]], { y: SY, segs: 40 }));
  // elevation, windage and parallax turrets
  b.add('steel', alongY(rod(SY + 18, SY + 43, 13, { chamfer: 1.6, segs: 32 })).translate(135, 0, 0));
  b.add('steel', alongY(rod(SY + 43, SY + 47, 10.5, { chamfer: 1, segs: 32 })).translate(135, 0, 0));
  b.add('steel', alongZ(rod(18, 40, 12, { chamfer: 1.6, segs: 32 })).translate(135, SY, 0));
  b.add('steel', alongZ(rod(-39, -18, 11, { chamfer: 1.6, segs: 32 })).translate(135, SY, 0));
  // rings and their rail clamps
  for (const x of [84, 192]) {
    b.add('steel', lathe([[x - 9, 17.1], [x - 9, 21.6], [x + 9, 21.6], [x + 9, 17.1]], { y: SY, segs: 40 }));
    b.add('steel', box(x - 9, 25.5, x + 9, SY - 15, 23, { bevel: 1.2, r: 1.5 }));
    b.add('steel', box(x - 8, SY - 4, x + 8, SY + 4, 47, { bevel: 1, r: 1.5 }));
    for (const z of [-20, 20]) {
      b.add('bright', alongY(rod(SY + 3.4, SY + 5.6, 2.2, { chamfer: 0.4, segs: 12 })).translate(x, 0, z));
      b.add('bright', alongY(rod(SY - 5.6, SY - 3.4, 2.2, { chamfer: 0.4, segs: 12 })).translate(x, 0, z));
    }
  }

  b.anchor('muzzle', 866, 0, 0, [1, 0, 0]);
  b.anchor('tally', 140, -34, CZ, [0, 0, 1]);
  b.anchor('eject', 142, 2, RZ, [0.2, 0.6, 1]);
  return b.build();
}
