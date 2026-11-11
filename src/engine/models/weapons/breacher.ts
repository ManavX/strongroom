/**
 * Breacher-12: pump-action 12-gauge tactical shotgun with a pistol-grip stock,
 * perforated heat shield, ghost-ring sights and a door-breaching standoff.
 * Authored in mm. x = 0 at the rear face of the receiver, bore axis on y = 0.
 */
import * as THREE from 'three';
import { Builder, alongY, arcBand, box, circle, lathe, loft, pinZ, plate, poly, rail, rect, rod, slot, studZ, warp, xf, type BuiltModel, type Group, type P2 } from '../kit';

export function buildBreacher(): BuiltModel {
  const b = new Builder();
  const HW = 18.5; // receiver half-width
  const TY = -29; // magazine tube axis height
  const TR = 12.5; // magazine tube radius
  // The muzzle-end assembly is authored against an 18.5 in barrel and slid M mm forward for the 20 in tube.
  const M = 22;
  const f = {
    add: (g: Group, ...geos: THREE.BufferGeometry[]) => b.add(g, ...geos.map((x) => xf(x, { x: M }))),
    both: (g: Group, ...geos: THREE.BufferGeometry[]) => b.both(g, ...geos.map((x) => xf(x, { x: M }))),
  };

  /* ---------------- receiver ---------------- */
  // Lower body cross-section (zy): flat faces and 45-degree chamfers only, so the
  // segments shade identically. `eject` notches the right wall, `load` the underside.
  const SPLIT = 8.2;
  const recSec = (eject: boolean, load: boolean): P2[] => {
    const p: P2[] = [
      [-HW, -42.4],
      [-HW + 1.6, -44],
    ];
    if (load) p.push([-11.5, -44], [-11.5, -37.5], [11.5, -37.5], [11.5, -44]);
    p.push([HW - 1.6, -44], [HW, -42.4]);
    if (eject) p.push([HW, -11], [3, -11], [3, SPLIT]);
    else p.push([HW, SPLIT]);
    p.push([-HW, SPLIT]);
    return p;
  };
  const seg = (sec: P2[], x0: number, x1: number, bevel = 0) => plate(poly(sec), { t: x1 - x0, plane: 'zy', at: (x0 + x1) / 2, bevel });
  // Bevelled end pieces run 1 mm into their unbevelled neighbours so the joints stay invisible.
  b.add('body', seg(recSec(false, false), 0, 101, 1));
  b.add('body', seg(recSec(true, false), 100, 114));
  b.add('body', seg(recSec(true, true), 114, 168));
  b.add('body', seg(recSec(false, true), 167, 199, 1));
  b.add('body', seg(recSec(false, false), 197, 215, 1));
  // one-piece rounded top strap
  b.add(
    'body',
    seg(
      [
        [-HW, SPLIT],
        [HW, SPLIT],
        [HW, 11, 6],
        [12, 17.5, 6],
        [-12, 17.5, 6],
        [-HW, 11, 6],
      ],
      0,
      215,
      1,
    ),
  );

  /* ---------------- barrel and magazine tube ---------------- */
  b.add(
    'steel',
    lathe([
      [198, 0],
      [198, 13.2],
      [236, 13.2],
      [300, 11.4],
      [632 + M, 10.8],
      [632 + M, 0],
    ]),
  );
  b.add('steel', rod(198, 600 + M, TR, { y: TY }));
  // breech ring and magazine-tube yoke at the receiver face
  b.add('steel', rod(213.6, 222, 14.8, { chamfer: 1 }), rod(213.6, 220, 14.2, { y: TY, chamfer: 1 }));

  /* ---------------- bolt, seen through the ejection port ---------------- */
  b.add('bright', rod(90, 157, 11.6, { chamfer: 0.8, segs: 40 }));
  b.add('steel', rod(156.4, 172, 12.5, { chamfer: 0.6, segs: 40 })); // barrel hood
  b.add('dark', box(104, -2.1, 139, 2.1, 0.9, { at: 11.55, bevel: 0.2, r: 1.2 })); // locking-block cut
  b.add('steel', box(142, -3.6, 157.4, 3.6, 2.6, { at: 11.5, bevel: 0.6, r: 0.8 })); // extractor
  b.add('steel', studZ(146, 0, 1.2, 12.4, 13.2, 0.25));
  b.add('steel', box(96, -11.4, 152, -7.2, 7, { at: 7.2, bevel: 0.5, r: 0.6 })); // slide under the bolt

  /* ---------------- loading port and shell lifter ---------------- */
  b.add('dark', plate(rect(114.4, -11.3, 84.2, 22.6, 0.4), { t: 0.8, plane: 'xz', at: -38.4, bevel: 0.1, bevelSegs: 1 }));
  b.add(
    'steel',
    plate(
      poly([
        [116, -10.6, 1],
        [190, -10.6, 3],
        [196.5, -5, 2],
        [196.5, 5, 2],
        [190, 10.6, 3],
        [116, 10.6, 1],
      ]),
      { t: 1.8, plane: 'xz', at: -41, bevel: 0.5, holes: [slot(152, 0, 186, 0, 2.4)] },
    ),
  );
  b.add('steel', pinZ(120, -40.6, 1.6, 11.2, 0)); // lifter pivot

  /* ---------------- trigger group ---------------- */
  b.add('steel', box(7, -47.6, 101, -43, 30, { bevel: 0.9, r: 1.2 }));
  b.add(
    'steel',
    plate(
      poly([
        [9, -46],
        [95, -46],
        [95, -51, 2],
        [88, -77, 7],
        [42, -81.5, 9],
        [16, -66, 6],
      ]),
      {
        t: 12.4,
        bevel: 0.9,
        holes: [
          poly([
            [35, -49],
            [90, -49],
            [84, -73.4, 5],
            [44, -77.4, 7],
            [35, -68, 4],
          ]),
        ],
      },
    ),
  );
  b.add(
    'steel',
    plate(
      poly([
        [54, -45],
        [63.5, -45],
        [62, -56, 4],
        [56.5, -68.4, 2.2],
        [52.8, -68.4, 1.4],
        [54, -57, 8],
      ]),
      { t: 6.4, bevel: 1.2 },
    ),
  );
  b.add('steel', pinZ(26, -56.5, 3.5, 6.2, 2.6)); // cross-bolt safety
  b.both('dark', studZ(26, -56.5, 2.2, 8.6, 9.1, 0.1));
  b.both(
    'steel',
    plate(
      poly([
        [91, -47],
        [103, -47],
        [103, -51.5, 1],
        [96, -55.5, 1.5],
        [91, -52.5, 1],
      ]),
      { t: 3, at: 7.6, bevel: 0.7 },
    ),
  ); // action release
  b.add('steel', pinZ(17, -32, 2.6, HW, 0.5), pinZ(98, -34, 2.6, HW, 0.5));

  /* ---------------- top rail and ghost-ring rear sight ---------------- */
  b.add('body', rail(24, 196, 17.2));
  b.add(
    'steel',
    plate(
      poly([
        [-12.8, 20.2, 1],
        [12.8, 20.2, 1],
        [12.8, 27, 1],
        [9.6, 30.4, 1],
        [-9.6, 30.4, 1],
        [-12.8, 27, 1],
      ]),
      { t: 30, plane: 'zy', at: 42, bevel: 0.8 },
    ),
  );
  b.add('steel', pinZ(42, 23.8, 2.7, 12.8, 2.2));
  b.add(
    'steel',
    plate(
      poly([
        [-7, 30],
        [7, 30],
        [7.8, 38, 3],
        [5, 44.8, 5],
        [-5, 44.8, 5],
        [-7.8, 38, 3],
      ]),
      { t: 3.4, plane: 'zy', at: 40, bevel: 0.6, holes: [circle(0, 38, 4.2, 20)] },
    ),
  );
  b.both(
    'steel',
    plate(
      poly([
        [28, 30],
        [56, 30],
        [56, 35, 2],
        [49, 46.5, 3],
        [36, 46.5, 3],
        [28, 38, 3],
      ]),
      { t: 2.8, at: 10.6, bevel: 0.7 },
    ),
  );
  b.add('steel', studZ(47, 34.6, 3.7, 11.6, 18, 0.7));

  /* ---------------- stock, pistol grip, recoil pad ---------------- */
  const S = (x: number, top: number, bot: number, w: number, rt: number, rb: number) => ({ x, y: (top + bot) / 2, h: top - bot, w, rt, rb });
  b.add(
    'sec',
    loft([
      S(-289, 4.6, -112, 34, 8, 8),
      S(-285, 6.4, -113.6, 38, 10, 10),
      S(-244, 8.6, -103, 38, 11, 10),
      S(-200, 10.8, -80, 37.6, 11, 10),
      S(-166, 12.4, -58, 37, 11, 10),
      S(-138, 13.6, -46, 36.4, 11, 10),
      S(-108, 14.8, -41, 36, 11, 10),
      S(-70, 16, -41.5, 37, 10, 9),
      S(-30, 17.6, -45, 39.6, 9, 6),
      S(-1.6, 18.5, -45.7, 40.2, 8.5, 4),
      S(0.7, 17.4, -44.6, 38.2, 7.5, 3),
    ]),
  );
  // rubber cheek comb and side inserts
  b.add(
    'rubber',
    loft([
      { x: -228, y: 10.4, w: 20, h: 4, r: 2 },
      { x: -222, y: 12.1, w: 27, h: 7, rt: 3.4, rb: 1 },
      { x: -112, y: 17, w: 26, h: 7, rt: 3.4, rb: 1 },
      { x: -106, y: 16, w: 20, h: 4, r: 2 },
    ]),
  );
  b.add(
    'rubber',
    plate(
      poly([
        [-276, -5, 4],
        [-182, 0, 4],
        [-182, -50, 6],
        [-216, -76, 8],
        [-276, -98, 4],
      ]),
      { t: 39, bevel: 0.9 },
    ),
  );
  const gripWarp = (p: THREE.Vector3) => {
    const k = THREE.MathUtils.clamp((-50 - p.y) / 95, 0, 1);
    p.z *= THREE.MathUtils.lerp(0.92, 1.05, k);
  };
  b.add(
    'sec',
    warp(
      plate(
        poly([
          [12, -30, 1],
          [11, -50, 4],
          [4, -66, 10],
          [3, -78, 14],
          [-14, -146, 7],
          [-55, -141.5, 8],
          [-37, -98, 36],
          [-40, -66, 14],
          [-60, -49, 8],
          [-66, -30, 1],
        ]),
        { t: 32, bevel: 7, bevelSegs: 4 },
      ),
      gripWarp,
    ),
  );
  for (let i = 0; i < 9; i++) {
    const cx = -15.6 - i * 1.75;
    const cy = -72 - i * 7;
    const ax = [-0.243, -0.97];
    const px = [0.97, -0.243];
    const q = (u: number, v: number): P2 => [cx + px[0] * u + ax[0] * v, cy + px[1] * u + ax[1] * v, 1.2];
    b.add('sec', warp(plate(poly([q(-12, -1.6), q(12, -1.6), q(12, 1.6), q(-12, 1.6)]), { t: 33.4, bevel: 0.8 }), gripWarp));
  }
  b.add(
    'sec',
    plate(
      poly([
        [-12.4, -144.6, 2],
        [-15, -150.6, 2.4],
        [-57.6, -146, 2.4],
        [-57, -139.6, 2],
      ]),
      { t: 31, bevel: 2.6, bevelSegs: 3 },
    ),
  );
  // recoil pad on a hard spacer
  b.add('steel', plate(rect(-292.4, -115, 4.6, 123, 1.6), { t: 38.8, bevel: 1.2 }));
  {
    const vents = [];
    for (let i = 0; i < 7; i++) vents.push(slot(-297.6, -97 + i * 14, -297.6, -91 + i * 14, 2.1));
    const pad = plate(
      poly([
        [-291.6, 7.4, 2],
        [-299, 6, 5],
        [-303, -15, 12],
        [-303, -92, 12],
        [-299, -113.6, 5],
        [-291.6, -115, 2],
      ]),
      { t: 37.8, bevel: 1.5, holes: vents },
    );
    b.add(
      'rubber',
      warp(pad, (p) => {
        const k = THREE.MathUtils.clamp((-291.6 - p.x) / 11.4, 0, 1);
        p.z *= 1 - 0.16 * k * k;
      }),
    );
  }
  // rear sling socket
  b.add('steel', pinZ(-156, -26, 5, 18.1, 0.6));
  b.both('dark', studZ(-156, -26, 3.2, 18.4, 19.1, 0.15));

  /* ---------------- stock adapter band, sling loop, receiver screws ---------------- */
  {
    const R = (x: number, d: number) => ({ x, y: -13.6, w: 40.4 + d, h: 64.4 + d, rt: 8.8, rb: 4.2 });
    b.add('steel', loft([R(-5.2, 0), R(-4.4, 1.2), R(-1.2, 1.2), R(-0.4, 0)]));
  }
  b.add('steel', plate(circle(-2.8, -12, 7.4, 22), { t: 2.6, at: -21.8, bevel: 0.7, holes: [circle(-2.8, -12, 4.4, 16)] }));
  for (const y of [-12, -33]) b.both('steel', studZ(191, y, 2.3, HW - 0.6, HW + 0.5, 0.3));
  for (const y of [-12, -33]) b.both('dark', box(189.4, y - 0.35, 192.6, y + 0.35, 0.5, { at: HW + 0.55, bevel: 0.1, r: 0.2 }));

  /* ---------------- side shell carrier (left) ---------------- */
  b.add('steel', plate(rect(46, -37, 140, 36, 3), { t: 2.6, at: -(HW + 1), bevel: 0.6 }));
  for (const [x, y] of [
    [49.2, -4],
    [182.8, -4],
    [49.2, -34],
    [182.8, -34],
  ]) b.add('steel', studZ(x, y, 1.8, -(HW + 3.1), -(HW + 2), 0.3));
  {
    const pitch = 20.6;
    const x0 = 116 - pitch * 2.5;
    const bores = [];
    for (let i = 0; i < 6; i++) bores.push(circle(x0 + i * pitch, -32.6, 10.45, 24));
    b.add('sec', plate(rect(x0 - 12.6, -44.8, pitch * 5 + 25.2, 24.6, 3), { t: 24, plane: 'xz', at: -19, bevel: 0.5, holes: bores }));
    for (let i = 0; i < 6; i++) {
      const up = i % 2 === 1; // alternate brass up / brass down
      const sx = x0 + i * pitch;
      const part = (y0: number, y1: number, r: number, c: number) => xf(alongY(rod(y0, y1, r, { chamfer: c, segs: 22 })), { x: sx, z: -32.6 });
      if (up) {
        b.add('rubber', part(-47, 3, 10.2, 2.4));
        b.add('bright', part(1.6, 14, 10.4, 0.5), part(12.6, 14.2, 11.1, 0.4));
        b.add('steel', part(13.6, 14.6, 3, 0.3));
      } else {
        b.add('rubber', part(-37, 13, 10.2, 2.4));
        b.add('bright', part(-48, -35.6, 10.4, 0.5), part(-48.2, -46.6, 11.1, 0.4));
        b.add('steel', part(-48.6, -47.6, 3, 0.3));
      }
    }
  }

  /* ---------------- pump fore-end and action bars ---------------- */
  b.both('steel', box(204, -33.6, 332, -24.4, 2.6, { at: 13.5, bevel: 0.5, r: 0.6 }));
  b.add('steel', rod(303, 314, 15.4, { y: TY, chamfer: 1 }), rod(461, 468, 15.2, { y: TY, chamfer: 1 }));
  {
    const F = (x: number, w: number, h: number) => ({ x, y: -28, w, h, rt: 5, rb: Math.min(17, w * 0.36) });
    const secs = [F(311, 41, 35), F(313.6, 48, 42), F(322, 48, 42)];
    for (let i = 0; i < 9; i++) {
      const x0 = 324 + i * 14.6;
      secs.push(F(x0, 46.4, 40.4), F(x0 + 4, 46.4, 40.4), F(x0 + 5.6, 50.6, 44), F(x0 + 13, 50.6, 44));
    }
    secs.push(F(457, 48, 42), F(460.4, 48, 42), F(463, 41, 35));
    b.add('sec', loft(secs));
  }

  /* ---------------- perforated heat shield ---------------- */
  const SH0 = 232;
  const SH1 = 542 + M;
  for (let k = -3; k <= 3; k++) {
    const holes = [];
    if (Math.abs(k) < 3) {
      for (let x = Math.abs(k) % 2 ? 266 : 251; x <= SH1 - 20; x += 30) holes.push(slot(x - 9, 0, x + 9, 0, 1.7));
    }
    const strip = plate(rect(SH0, -4.56, SH1 - SH0, 9.12, 0.3), { t: 1.6, plane: 'xz', at: 16, bevel: 0.3, bevelSegs: 1, holes });
    b.add('body', xf(strip, { rx: k * 30 }));
  }
  b.both('body', rod(SH0 + 0.6, SH1 - 0.6, 1.3, { y: -4.8, z: 16, segs: 10 })); // rolled lower edges
  for (const x of [240, SH1 - 8]) b.add('steel', plate(arcBand(0, 0, 11, 17.8, -17, 197), { t: 6, plane: 'zy', at: x, bevel: 0.8 }));

  /* ---------------- barrel clamp with light rails ---------------- */
  f.add('steel', plate(circle(0, 0, 15.4), { t: 24, plane: 'zy', at: 561, bevel: 1.2 }));
  f.add('steel', plate(circle(0, TY, 16.6), { t: 24, plane: 'zy', at: 561, bevel: 1.2 }));
  f.add('steel', plate(rect(-8.2, -24, 16.4, 18, 1), { t: 21, plane: 'zy', at: 561, bevel: 1 }));
  f.add('steel', pinZ(561, -14.5, 3.3, 8.2, 2.6));
  for (const g of rail(547.5, 574.5, 16.3)) f.add('steel', xf(g.clone(), { rx: 90, y: TY }), xf(g, { rx: -90, y: TY }));

  /* ---------------- front sight ---------------- */
  f.add('steel', rod(584, 606, 12.8, { chamfer: 1 }));
  f.add(
    'steel',
    plate(
      poly([
        [583, 9],
        [607, 9],
        [607, 15, 1.5],
        [602, 21, 2],
        [588, 21, 2],
        [583, 13, 2],
      ]),
      { t: 11, bevel: 1 },
    ),
  );
  f.both(
    'steel',
    plate(
      poly([
        [586, 19],
        [604.5, 19],
        [604.5, 30, 2],
        [600.5, 40.6, 2.5],
        [594, 40.6, 2.5],
        [586, 27, 3],
      ]),
      { t: 2.4, at: 5.6, bevel: 0.7 },
    ),
  );
  f.add('steel', box(594.8, 20, 597.6, 38.6, 2.6, { bevel: 0.5, r: 0.5 }));

  /* ---------------- magazine tube cap and sling swivel ---------------- */
  f.add(
    'steel',
    lathe(
      [
        [597, 0],
        [597, 13.4],
        [598.2, 14.3],
        [610.6, 14.3],
        [615, 12.2],
        [618, 8],
        [618, 0],
      ],
      { y: TY },
    ),
  );
  for (let i = 0; i < 3; i++) f.add('steel', rod(599.6 + i * 3, 601.2 + i * 3, 14.9, { y: TY, chamfer: 0.4 }));
  f.add('steel', xf(alongY(rod(-48.6, -42, 2.6, { chamfer: 0.5, segs: 12 })), { x: 604.5 }));
  f.add('steel', plate(circle(604.5, -53, 6.2, 20), { t: 2.6, bevel: 0.7, holes: [circle(604.5, -53, 3.8, 16)] }));

  /* ---------------- breaching standoff ---------------- */
  f.add('steel', rod(608.6, 620, 14, { chamfer: 1 }));
  for (let i = 0; i < 6; i++) {
    const a = 30 + i * 60;
    f.add('steel', plate(arcBand(0, 0, 11.4, 14, a - 16, a + 16), { t: 25.4, plane: 'zy', at: 632, bevel: 0.5, bevelSegs: 1 }));
    f.add('steel', plate(arcBand(0, 0, 10, 14, a - 12, a + 12), { t: 7.6, plane: 'zy', at: 651.7, bevel: 1.6 }));
  }
  f.add(
    'steel',
    lathe([
      [644, 10],
      [644, 14],
      [648, 14],
      [649, 13.2],
      [649, 10],
      [644, 10],
    ]),
  );
  f.add('dark', rod(631, 648.4, 9.9, { chamfer: 0.2 }));

  b.anchor('muzzle', 655.5 + M, 0, 0, [1, 0, 0]);
  b.anchor('tally', 52, -18, HW + 0.2, [0, 0, 1]);
  b.anchor('eject', 134, -1.5, HW, [0.2, 0.5, 1]);
  return b.build();
}
