/**
 * Marshal C4: AR-pattern carbine with a free-float handguard and a collapsible stock.
 * Authored in mm. x = 0 at the rear face of the upper receiver, bore axis on y = 0.
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

export function buildMarshal(): BuiltModel {
  const b = new Builder();
  const UZ = 15.6; // upper receiver half-width
  const LZ = 14.3; // lower receiver half-width

  /* ---------------- upper receiver ---------------- */
  // Core section (z, y). The right wall is a separate plate so the ejection port is a real opening.
  const upperSec = poly([
    [-14.6, -16],
    [9.8, -16],
    [9.8, 12.5],
    [15.3, 12.5],
    [15.3, 14.5, 2],
    [9.6, 21.5, 1.5],
    [-9.6, 21.5, 1.5],
    [-UZ, 14.5, 2],
    [-UZ, -9, 3],
  ]);
  b.add('body', plate(upperSec, { t: 198, plane: 'zy', at: 99, bevel: 0.8 }));
  b.add(
    'body',
    plate(rect(0.4, -16, 197.2, 28.8, 1.2), {
      t: 6.1,
      at: 12.55,
      bevel: 0.7,
      holes: [rect(90, -7.5, 70, 15, 2.2)],
    }),
  );
  // port interior and bolt carrier
  b.add('dark', box(86, -10, 164, 10, 0.8, { at: 10, bevel: 0 }));
  b.add('bright', rod(86, 149, 9.4, { y: -0.4, z: 3.4, chamfer: 0.8 }));
  b.add('steel', rod(148, 164, 7.6, { y: -0.4, z: 3.4, chamfer: 0.6 }));
  // carrier vent holes and cam-pin slot
  for (const x of [112, 121]) b.add('dark', studZ(x, 2.2, 1.5, 10, 12.75, 0.1));
  b.add('dark', box(132, -3.2, 146, 0.4, 1, { at: 12.4, bevel: 0.2, r: 1.2 }));

  // the round of the bolt-carrier bore shows as a bulge along the left wall and ahead of the port
  const bulge = (x0: number, x1: number, arcStart: number) =>
    lathe(
      [
        [x0, 14],
        [x0 + 1.6, 17.3],
        [x1 - 1.6, 17.3],
        [x1, 14],
      ],
      { arc: 180, arcStart, segs: 26 },
    );
  b.add('body', bulge(1.2, 196.8, 180), bulge(164, 196.8, 0));
  // rear lug boss and a stiffening pad on the left
  b.add('body', box(3, -15, 22, -6.5, 1.6, { at: -(UZ + 0.3), bevel: 0.6, r: 2.4 }));
  b.add('body', box(96, -15.2, 150, -9.4, 1.4, { at: -(UZ + 0.2), bevel: 0.5, r: 1.6 }));

  // top rail
  b.add('body', rail(2.4, 197.7, 21.3));

  // charging handle with latch
  b.add(
    'steel',
    plate(
      poly([
        [-12, -15, 2],
        [-12, 15, 2],
        [-9.5, 20.5, 1.5],
        [-3.5, 20.5, 1.5],
        [-3.5, 8.5],
        [5, 7],
        [5, -7],
        [-3.5, -8.5],
        [-3.5, -20.5, 1.5],
        [-9.5, -20.5, 1.5],
      ]),
      { t: 5, plane: 'xz', at: 18.6, bevel: 0.8 },
    ),
  );
  b.add('steel', plate(poly([[-12.6, -16.5, 1.2], [-2.6, -16.5, 1.2], [-2.6, -23.4, 1.2], [-9.5, -23.4, 2.4]]), { t: 3.6, plane: 'xz', at: 18.6, bevel: 0.6 }));
  b.add('steel', alongY(rod(15.6, 21.6, 1.1, { chamfer: 0.2, segs: 10 })).translate(-6, 0, -18.4));

  // forward assist: angled housing, plunger and cap
  const fa = <T extends THREE.BufferGeometry>(g: T) => xf(g, { ry: 13, pivot: [66, 5.5, 11] });
  b.add('body', fa(rod(21, 68, 7.6, { y: 5.5, z: 11, chamfer: 1.2 })));
  b.add('body', fa(rod(21, 27, 8.6, { y: 5.5, z: 11, chamfer: 0.8 })));
  b.add('steel', fa(rod(9, 22, 5.4, { y: 5.5, z: 11, chamfer: 0.5 })));
  b.add('steel', fa(rod(3.5, 10, 6.8, { y: 5.5, z: 11, chamfer: 1.4 })));
  b.add('body', box(40, -6, 70, 2, 5, { at: 15, bevel: 1, r: 2 }));

  // brass deflector
  b.add('body', plate(poly([[69, 14.5], [89.6, 14.5], [89.6, 22.2, 1.6], [85.5, 23, 1.6]]), { t: 17, plane: 'xz', at: 0.6, bevel: 1.2 }));

  // ejection-port cover, hanging open on its hinge rod
  const door = <T extends THREE.BufferGeometry>(g: T) => xf(g, { rx: -16, pivot: [0, -10.4, 16.8] });
  b.add('steel', rod(84.5, 165.5, 1.7, { y: -10.4, z: 16.8, chamfer: 0.4, segs: 12 }));
  for (const x of [86.5, 163.5]) b.add('body', box(x - 2.4, -12.6, x + 2.4, -8.2, 4, { at: 16.2, bevel: 0.6, r: 1 }));
  b.add('steel', door(box(91, -28.4, 161, -10.2, 1.5, { at: 17.2, bevel: 0.45, r: 1.6 })));
  b.add('steel', door(box(96, -25.6, 156, -14.6, 1.4, { at: 18.1, bevel: 0.6, r: 2.4 })));
  b.add('steel', door(studZ(126, -20.1, 2.6, 18.2, 19.6, 0.5)));

  /* ---------------- lower receiver ---------------- */
  b.add(
    'body',
    plate(
      poly([
        [-17.5, -3],
        [1, -3],
        [1, -15.7],
        [188.5, -15.7, 1.5],
        [191.5, -19, 1.5],
        [191.5, -27, 2],
        [189.6, -31, 2],
        [190, -86, 3],
        [124, -78, 2],
        [122.5, -52, 2.5],
        [61, -52, 2.5],
        [57.5, -57, 1.5],
        [56, -78, 1.5],
        [49, -78.5, 1.5],
        [40, -62, 2],
        [6, -56, 3],
        [-6, -42, 5],
        [-17.5, -24, 3],
      ]),
      { t: LZ * 2, bevel: 0.9 },
    ),
  );
  // receiver-extension ring
  b.add('body', rod(-17.6, 0.6, 17.3, { chamfer: 1.2 }));
  // magazine well: proud side panels and a flared lip
  b.add(
    'body',
    plate(
      poly([
        [132, -17.6, 1.5],
        [187.4, -17.6, 2],
        [188.6, -80, 1.5],
        [126.6, -72.4, 1.5],
        [126.2, -46, 1.5],
        [129, -40, 1.5],
      ]),
      { t: LZ * 2 + 1.4, bevel: 0.7 },
    ),
  );
  b.add(
    'body',
    plate(
      poly([
        [124.8, -70.6, 1.6],
        [190.7, -78.6, 1.6],
        [191, -87.2, 3],
        [124.4, -79.1, 2],
      ]),
      { t: LZ * 2 + 3.6, bevel: 1.2, bevelSegs: 3 },
    ),
  );
  b.add('dark', xf(plate(rect(128.2, -11.4, 58.6, 22.8, 2), { t: 1.2, plane: 'xz', at: -79.3, bevel: 0 }), { rz: -6.93, pivot: [124.4, -79.1, 0] }));
  // front serrations on the magazine well
  for (let i = 0; i < 6; i++) b.add('body', box(189.2, -40 - i * 6, 191.6, -37 - i * 6, 20, { bevel: 0.5, r: 0.7 }));

  // takedown and pivot pins: heads on the right, detent ends on the left
  for (const x of [12, 174]) {
    b.add('steel', studZ(x, -22.5, 4.3, LZ - 1, LZ + 1.7, 0.6));
    b.add('dark', studZ(x, -22.5, 1.6, LZ + 1.3, LZ + 1.95, 0.1));
    b.add('steel', studZ(x, -22.5, 3.2, -(LZ + 1), -LZ + 1, 0.4));
  }
  b.add('steel', pinZ(62, -39, 2, LZ, 0.45));
  b.add('steel', pinZ(83.5, -31, 2, LZ, 0.45));

  // trigger guard and trigger
  b.add(
    'body',
    plate(
      poly([
        [125.5, -72.6],
        [125.5, -77.4],
        [92, -81.6, 30],
        [55, -79.6],
        [55, -75],
        [92, -77, 30],
      ]),
      { t: 10.4, bevel: 0.6 },
    ),
  );
  b.add('steel', pinZ(121.5, -75.2, 1.2, 5.2, 0.3), pinZ(58.5, -77, 1.2, 5.2, 0.3));
  b.add(
    'steel',
    plate(
      poly([
        [60.5, -50],
        [70, -50],
        [69.5, -57, 3],
        [73.6, -68.4, 1.6],
        [70, -71.2, 1.6],
        [64.5, -60, 5],
      ]),
      { t: 6.4, bevel: 1.1, bevelSegs: 3 },
    ),
  );

  /* ---------------- controls ---------------- */
  // selector: full lever on the left, short ambidextrous lever on the right
  b.add('steel', studZ(47, -30, 4.6, -(LZ + 2.6), -LZ + 1, 0.5));
  b.add('steel', plate(slot(47, -30, 68, -30, 3.3), { t: 2.2, at: -(LZ + 2.1), bevel: 0.6 }));
  b.add('steel', box(60, -33.8, 72.5, -26.2, 4.6, { at: -(LZ + 3.4), bevel: 0.9, r: 1.8 }));
  b.add('steel', studZ(47, -30, 4.2, LZ - 1, LZ + 2.4, 0.5));
  b.add('steel', plate(slot(47, -30, 62, -30, 2.9), { t: 2, at: LZ + 1.9, bevel: 0.6 }));
  b.add('steel', box(56, -33, 65, -27, 3.8, { at: LZ + 2.9, bevel: 0.8, r: 1.6 }));
  for (const s of [-1, 1]) b.add('dark', box(45.9, -31.9, 48.1, -28.1, 0.6, { at: s * (LZ + (s > 0 ? 2.35 : 2.55)), bevel: 0, r: 0.3 }));

  // bolt release paddle (left)
  const BC = -(UZ + 1.7);
  b.add('body', box(118.5, -37, 134.5, -17.5, 3.4, { at: -(LZ + 1.1), bevel: 0.8, r: 1.6 }));
  b.add(
    'steel',
    plate(
      poly([
        [119.5, -7, 1.6],
        [133, -7, 1.6],
        [134, -20, 2],
        [130.5, -36, 1.6],
        [123.5, -36, 1.6],
        [119, -20, 2],
      ]),
      { t: 2.8, at: BC, bevel: 0.7 },
    ),
  );
  for (let i = 0; i < 4; i++) b.add('steel', box(121, -10.2 - i * 2.6, 131.8, -8.8 - i * 2.6, 1.6, { at: BC - 1.5, bevel: 0.4, r: 0.5 }));
  b.add('steel', plate(slot(124.5, -30.5, 129.5, -30.5, 3.2), { t: 2, at: BC - 1.6, bevel: 0.6 }));
  b.add('steel', pinZ(126.5, -22.8, 1.3, 0.2, 0.2).translate(0, 0, BC - 1.3));

  // magazine release: fenced button on the right, catch bar on the left
  b.add('body', plate(slot(114, -35, 125, -35, 6.6), { t: 4, at: LZ + 0.5, bevel: 0.8, holes: [slot(114, -35, 125, -35, 4.5)] }));
  b.add('steel', plate(slot(114, -35, 125, -35, 3.9), { t: 3.4, at: LZ + 1.2, bevel: 0.7 }));
  for (let i = 0; i < 4; i++) b.add('steel', box(113.6 + i * 3.1, -37.6, 115 + i * 3.1, -32.4, 1.2, { at: LZ + 3, bevel: 0.35, r: 0.4 }));
  b.add('steel', box(111, -38.6, 137.5, -31.4, 2.4, { at: -(LZ + 0.6), bevel: 0.6, r: 1.4 }));
  b.add('dark', studZ(124.5, -35, 1.7, -(LZ + 2.1), -(LZ + 1.5), 0.1));

  /* ---------------- pistol grip ---------------- */
  // Lofted along its own axis, then swung down and back 25 degrees from vertical.
  const grip = <T extends THREE.BufferGeometry>(g: T) => xf(g, { rz: -115, x: 34, y: -50 });
  b.add(
    'sec',
    grip(
      loft(
        [
          { x: 0, w: 26, h: 44, rt: 6, rb: 9 },
          { x: 9, w: 30, h: 46, rt: 7, rb: 11 },
          { x: 30, w: 29.4, h: 43.5, rt: 8, rb: 12 },
          { x: 58, w: 30.4, h: 43, rt: 8, rb: 12.5 },
          { x: 84, w: 31.6, h: 44.5, rt: 8, rb: 13 },
          { x: 95, w: 31, h: 44, rt: 8, rb: 12.5 },
          { x: 99, w: 27, h: 39.5, rt: 6.5, rb: 10.5 },
        ],
        { k: 6 },
      ),
    ),
  );
  // raised side panels
  b.add(
    'sec',
    grip(
      loft([
        { x: 24, w: 28, h: 24, r: 3.5 },
        { x: 27, w: 30.7, h: 27, r: 4 },
        { x: 58, w: 31.6, h: 27, r: 4 },
        { x: 86, w: 32.8, h: 28, r: 4 },
        { x: 89, w: 30, h: 25, r: 3.5 },
      ]),
    ),
  );
  // front- and back-strap ribs
  for (let i = 0; i < 9; i++) {
    const s = 26 + i * 7;
    b.add(
      'sec',
      grip(
        loft([
          { x: s, w: 17, h: 43.4, rt: 6, rb: 8 },
          { x: s + 1, w: 19, h: 45.4, rt: 7, rb: 9 },
          { x: s + 3, w: 19, h: 45.4, rt: 7, rb: 9 },
          { x: s + 4, w: 17, h: 43.4, rt: 6, rb: 8 },
        ]),
      ),
    );
  }
  b.add('dark', grip(loft([{ x: 98, w: 17, h: 28, r: 5 }, { x: 99.5, w: 17, h: 28, r: 5 }])));
  b.add('steel', grip(rod(98.6, 100.2, 3.2, { chamfer: 0.4, segs: 14 })));

  /* ---------------- receiver extension ---------------- */
  b.add('steel', rod(-212, -14, 14.6, { chamfer: 1 }));
  b.add('steel', box(-208, -21.5, -24, -10, 8.6, { bevel: 0.6, r: 1 }));
  for (const x of [-46, -66]) b.add('dark', alongY(rod(-21.85, -20.5, 2.3, { chamfer: 0.1, segs: 12 })).translate(x, 0, 0));
  // end plate and castle nut
  b.add('steel', plate(rect(-15.4, -25.5, 30.8, 44, 6), { t: 3.2, plane: 'zy', at: -19, bevel: 0.7 }));
  b.add('steel', rod(-27.4, -20.2, 18, { chamfer: 0.7 }));
  for (let i = 0; i < 6; i++) b.add('steel', plate(arcBand(0, 0, 14.4, 18, i * 60 + 11, i * 60 + 49), { t: 5.6, plane: 'zy', at: -29.9, bevel: 0.5, bevelSegs: 1 }));
  for (const s of [-1, 1]) {
    b.add('steel', plate(circle(0, -18.5, 5), { t: 1.8, at: s * 15.2, plane: 'xy', bevel: 0.5, holes: [circle(0, -18.5, 3.1, 14)] }).translate(-19, 0, 0));
  }

  /* ---------------- collapsible stock ---------------- */
  const st = <T extends THREE.BufferGeometry>(g: T) => g.translate(6.5, 0, 0) as T;
  b.add(
    'sec',
    st(
      loft(
        [
          { x: -247, y: -1.5, w: 34, h: 40, r: 7 },
          { x: -244, y: -1.5, w: 37, h: 43, r: 8.5 },
          { x: -110, y: -1.5, w: 36, h: 43, r: 8.5 },
          { x: -97, y: -1.5, w: 35, h: 42, r: 8.5 },
          { x: -93, y: -1.5, w: 31.5, h: 38.5, r: 7 },
        ],
        { k: 6 },
      ),
    ),
  );
  // side ribs along the sleeve
  for (const y of [9, -11]) b.add('sec', st(box(-234, y - 2.2, -102, y + 2.2, 37.9, { bevel: 0.8, r: 2 })));
  // strut with lightening window
  b.add(
    'sec',
    st(
      plate(
        poly([
          [-246, -17],
          [-138, -17],
          [-134, -26, 3.5],
          [-150, -42, 9],
          [-232, -104, 6],
          [-248, -104, 3.5],
        ]),
        {
          t: 24,
          bevel: 2.2,
          bevelSegs: 3,
          holes: [
            poly([
              [-231, -31, 4],
              [-164, -31, 5],
              [-231, -83, 5],
            ]),
          ],
        },
      ),
    ),
  );
  // butt block and ribbed rubber pad
  b.add('sec', st(plate(poly([[-252, 15, 3.5], [-236, 20.5, 3.5], [-234, -104.5, 3.5], [-250, -104.5, 3.5]]), { t: 40, bevel: 3, bevelSegs: 3 })));
  b.add('rubber', st(plate(poly([[-257.6, 12.5, 2.6], [-250.6, 15.6, 2.6], [-248.6, -103.6, 2.6], [-255.8, -103.6, 2.6]]), { t: 38, bevel: 2.2, bevelSegs: 3 })));
  for (let i = 0; i < 7; i++) {
    const y = 4 - i * 15.5;
    b.add('rubber', st(xf(box(-258.9, y - 4.5, -256.9, y + 4.5, 29, { bevel: 0.6, r: 0.9 }), { x: (4 - y) * 0.0165 })));
  }
  // adjustment latch
  b.add(
    'sec',
    st(
      plate(
        poly([
          [-98, -21],
          [-98, -28.5, 2],
          [-126, -30.5, 2],
          [-137.5, -38.5, 1.8],
          [-140.5, -34.5, 1.8],
          [-131, -21, 4],
        ]),
        { t: 14, bevel: 1.2 },
      ),
    ),
  );
  b.add('steel', st(pinZ(-106, -25, 1.7, 7, 0.5)));
  // sling sockets
  for (const s of [-1, 1]) {
    b.add('steel', st(plate(circle(-226, 0, 5.6), { t: 1.8, at: s * 18.4, bevel: 0.5, holes: [circle(-226, 0, 3.6, 16)] })));
    b.add('dark', st(studZ(-226, 0, 3.8, s * 18.55 - 0.25, s * 18.55 + 0.25, 0.05)));
  }

  /* ---------------- barrel ---------------- */
  b.add(
    'steel',
    lathe([
      [190, 0],
      [190, 12.5],
      [238, 12.5],
      [240, 9.6],
      [392, 9.6],
      [393, 8.6],
      [497, 8.6],
      [498.5, 7.1],
      [519, 7.1],
      [520.5, 8.6],
      [544, 8.6],
      [545.5, 7.4],
      [547, 7.4],
      [547, 0],
    ]),
  );
  // low-profile gas block and gas tube (seen through the handguard vents)
  b.add('steel', rod(362, 392, 11.6, { chamfer: 0.8 }));
  b.add('steel', box(362, 6, 392, 19.4, 12.5, { bevel: 0.8, r: 2 }));
  b.add('steel', rod(196, 366, 2.3, { y: 14.6, segs: 10, chamfer: 0.3 }));
  for (const x of [369, 385]) b.add('dark', alongY(rod(-12.1, -11, 2.1, { chamfer: 0.1, segs: 10 })).translate(x, 0, 0));

  // birdcage flash hider: crush washer, collar, slotted cage over a dark core, front ring
  b.add('steel', rod(545.6, 548.4, 9.7, { chamfer: 0.9 }));
  b.add('steel', rod(548, 557.4, 11, { chamfer: 0.8 }));
  b.add('dark', rod(556, 584, 6.4, { chamfer: 0.1, segs: 20 }));
  const cage: [number, number][] = [
    [14, 40],
    [56, 82],
    [98, 124],
    [140, 166],
    [182, 358],
  ];
  for (const [a0, a1] of cage) b.add('steel', plate(arcBand(0, 0, 6, 11, a0, a1), { t: 26.2, plane: 'zy', at: 570, bevel: 0.6, bevelSegs: 1 }));
  b.add('steel', tube(582.6, 588, 11, 4.6, { chamfer: 0.9, depth: 2.4 }));
  b.add('dark', rod(585, 586.2, 4.5, { chamfer: 0.05, segs: 14 }));
  for (const s of [-1, 1]) b.add('dark', box(549.6, -3.4, 555.8, 3.4, 0.7, { at: s * 10.75, bevel: 0, r: 0.4 }));

  /* ---------------- free-float handguard ---------------- */
  const HG0 = 198.4;
  const HG1 = 478.4;
  const oct = (ap: number): V2[] => {
    const r = ap / Math.cos(Math.PI / 8);
    const o: [number, number][] = [];
    for (let i = 0; i < 8; i++) o.push([Math.cos(((i + 0.5) * Math.PI) / 4) * r, Math.sin(((i + 0.5) * Math.PI) / 4) * r]);
    return pts(o);
  };
  // each face is its own plate so the slots are real openings
  const mlok: V2[][] = [];
  for (let i = 0; i < 5; i++) mlok.push(oval(246 + i * 40, 278 + i * 40, 0, 3.6));
  const vents: V2[][] = [];
  for (let i = 0; i < 9; i++) vents.push(oval(246 + i * 24, 262 + i * 24, 0, 3.1, 3));
  const face = (deg: number, holes: V2[][], centre = 20, t = 2.4) =>
    xf(plate(rect(HG0, -9.05, HG1 - HG0, 18.1), { t, at: centre, bevel: 0.5, bevelSegs: 1, holes }), { rx: deg });
  b.add('body', face(0, mlok), face(180, mlok), face(90, mlok));
  b.add('body', face(45, vents), face(135, vents), face(-45, vents), face(-135, vents));
  b.add('body', face(-90, [], 19.9, 3));
  // barrel-nut collar with clamp bolts, and the front end ring
  b.add('body', plate(oct(22.3), { t: 40, plane: 'zy', at: 218.4, bevel: 0.9 }));
  for (const x of [209, 228]) {
    b.add('steel', pinZ(x, -6, 2.6, 22.3, 0.6));
    for (const s of [-1, 1]) b.add('dark', studZ(x, -6, 1.3, s * 22.95 - 0.2, s * 22.95 + 0.2, 0.05));
  }
  b.add('body', plate(oct(21.7), { t: 5, plane: 'zy', at: 476.4, bevel: 0.7, holes: [circle(0, 0, 17, 20)] }));
  // sling sockets in the collar
  for (const s of [-1, 1]) {
    b.add('steel', plate(circle(219, 3.4, 5.2, 14), { t: 1.6, at: s * 22.5, bevel: 0.45, bevelSegs: 1, holes: [circle(219, 3.4, 3.4, 12)] }));
    b.add('dark', studZ(219, 3.4, 3.6, s * 22.65 - 0.25, s * 22.65 + 0.25, 0.05));
  }
  // rails: full-length top, short sections at 3, 6 and 9 o'clock
  b.add('body', rail(202.4, 477.7, 21.3));
  for (const rx of [90, 180, -90]) b.add('body', rail(441.6, 476.9, 21).map((g) => xf(g, { rx })));

  /* ---------------- magazine ---------------- */
  // Straight in the well, then curving forward about a centre ahead of the rifle.
  const MC: [number, number] = [456.4, -92];
  const RR = 330; // spine radius
  const RF = 269.8; // front-wall radius
  b.add(
    'body',
    plate(pts([[126.4, -20], ...arcPts(MC[0], MC[1], RR, 180, 193, 8), ...arcPts(MC[0], MC[1], RF, 193, 180, 8), [186.6, -20]]), {
      t: 22.4,
      bevel: 1.5,
    }),
  );
  for (const d of [15, 45]) {
    const x0 = 126.4 + d;
    b.add(
      'body',
      plate(pts([[x0 - 2.6, -76], ...arcPts(MC[0], MC[1], RR - d + 2.6, 180, 191.2, 6), ...arcPts(MC[0], MC[1], RR - d - 2.6, 191.2, 180, 6), [x0 + 2.6, -76]]), {
        t: 24.4,
        bevel: 1,
      }),
    );
  }
  for (const a of [184.2, 186, 187.8, 189.6]) b.add('body', plate(arcBand(MC[0], MC[1], RR - 38, RR - 22, a, a + 0.6), { t: 23.8, bevel: 0.5, bevelSegs: 1 }));
  b.add('body', plate(arcBand(MC[0], MC[1], RR - 1.4, RR + 1, 181, 192.2), { t: 9, bevel: 0.8 }));
  b.add('body', plate(arcBand(MC[0], MC[1], RF - 2.6, RR + 2.6, 192.4, 194.4), { t: 25.8, bevel: 1.1 }));

  /* ---------------- flip-up iron sights (deployed) ---------------- */
  const sightBase = (x0: number, x1: number) => {
    b.add(
      'steel',
      plate(
        poly([
          [x0, 29.8],
          [x1, 29.8],
          [x1, 36.5, 1.5],
          [x1 - 5, 39.5, 1.5],
          [x0 + 5, 39.5, 1.5],
          [x0, 36.5, 1.5],
        ]),
        { t: 23, bevel: 0.8 },
      ),
    );
    b.add('steel', box(x0 + 2, 24.7, x1 - 2, 31.4, 27.6, { bevel: 0.8, r: 1.4 }));
    b.add('steel', pinZ((x0 + x1) / 2, 28, 2.7, 13.8, 1.3));
  };
  // rear: aperture arm with windage knob
  sightBase(7, 41);
  b.add(
    'steel',
    plate(
      poly([
        [-6.5, 37],
        [6.5, 37],
        [6.5, 59, 2],
        [4.6, 71, 3.4],
        [-4.6, 71, 3.4],
        [-6.5, 59, 2],
      ]),
      { t: 5, plane: 'zy', at: 14, bevel: 0.7, holes: [circle(0, 66, 2.5, 14)] },
    ),
  );
  b.add('steel', alongZ(rod(-9.4, 9.4, 3.3, { chamfer: 0.6, segs: 14 })).translate(14, 40.5, 0));
  b.add('steel', alongZ(rod(5, 12.5, 4.8, { chamfer: 0.8, segs: 16 })).translate(14, 51, 0));
  b.add('steel', alongZ(rod(-8.2, -5, 2.6, { chamfer: 0.5, segs: 12 })).translate(14, 51, 0));
  // front: post between protective ears
  sightBase(445, 475);
  b.add(
    'steel',
    plate(
      poly([
        [-8.6, 37],
        [8.6, 37],
        [8.8, 60, 2],
        [8, 71, 1.4],
        [5, 71, 1.4],
        [4.6, 56, 1.6],
        [-4.6, 56, 1.6],
        [-5, 71, 1.4],
        [-8, 71, 1.4],
        [-8.8, 60, 2],
      ]),
      { t: 6, plane: 'zy', at: 467, bevel: 0.7 },
    ),
  );
  b.add('steel', alongZ(rod(-10.6, 10.6, 3.3, { chamfer: 0.6, segs: 14 })).translate(467, 40.5, 0));
  b.add('steel', alongY(rod(55, 58, 2.8, { chamfer: 0.5, segs: 12 })).translate(467, 0, 0));
  b.add('steel', alongY(rod(57, 66, 1.1, { chamfer: 0.3, segs: 8 })).translate(467, 0, 0));

  /* @@NEXT */

  b.anchor('muzzle', 588, 0, 0, [1, 0, 0]);
  b.anchor('tally', 160, -50, LZ + 0.7, [0, 0, 1]);
  b.anchor('eject', 125, 0, UZ, [0.25, 0.5, 1]);
  return b.build();
}
