/**
 * Karambit: curved claw blade on a full tang with a finger ring.
 * Authored in mm. x = 0 near the front of the scales, tip down and forward.
 */
import * as THREE from 'three';
import { Builder, alongZ, arcPts, circle, lathe, plate, smooth, studZ, tube, warp, type BuiltModel } from '../kit';
import { blade, clipHalf, curve, inflate, regrid } from './blade';

export function buildKarambit(): BuiltModel {
  const b = new Builder();
  const RING: readonly [number, number] = [-92, -6];

  /* ---------------- blade ---------------- */
  const bl = blade({
    spine: curve(
      [
        [-6, 13.8],
        [12, 13.6],
        [30, 11.8],
        [46, 7],
        [60, -1],
        [71, -12.5],
        [78, -25.5],
        [81, -38],
      ],
      90,
    ),
    edge: curve(
      [
        [-4, -13],
        [4, -12.6],
        [14, -10.8],
        [28, -9.6],
        [42, -11.4],
        [55, -16.6],
        [66, -24.5],
        [75, -33],
        [81, -38],
      ],
      52,
    ),
    thick: 4.6,
    tipThick: 3.2,
    grind: (t) => 0.5 - 0.12 * t,
    hollow: 0.5,
    edgeBevel: 1.4,
    edgeThick: 0.5,
    plunge: { at: 15, len: 4.5 },
    swedge: { from: 42, width: 5.5, thick: 0.3, blend: 14 },
    jimping: { from: 9, to: 27.2, pitch: 2.6, depth: 0.9 },
  });
  b.add('body', bl.body);
  b.add('bright', bl.bevel);

  /* ---------------- tang and ring ---------------- */
  const tang = smooth(
    [
      [-1, 12.6],
      [-6, 13.2],
      [-20, 13.9],
      [-40, 14.2],
      [-58, 12.2],
      [-70, 9.2],
      ...arcPts(RING[0], RING[1], 17, 65, 290, 15),
      [-76, -16.2],
      [-66, -13.4],
      [-52, -14.6],
      [-38, -12.8],
      [-24, -13.8],
      [-12, -15.6],
      [-4, -17.6],
      [0.5, -15.5],
      [1.5, -10],
      [1.5, 6],
    ],
    true,
    5,
  );
  b.add('steel', plate(tang, { t: 4, bevel: 0.5, holes: [circle(RING[0], RING[1], 11.2, 40)] }));
  // finger ring: rounded section revolved about the ring axis
  const RH = 3.1;
  const RI = 10.6;
  const RO = 17.6;
  const RC = 1.7;
  const corner = (cx: number, cr: number, a0: number): [number, number][] =>
    [0, 1, 2, 3, 4].map((k) => {
      const a = ((a0 + k * 22.5) * Math.PI) / 180;
      return [cx + Math.cos(a) * RC, cr + Math.sin(a) * RC];
    });
  const ringProf = [...corner(RH - RC, RO - RC, 90).reverse(), ...corner(RH - RC, RI + RC, 270).reverse(), ...corner(-RH + RC, RI + RC, 180).reverse(), ...corner(-RH + RC, RO - RC, 90).reverse()];
  ringProf.push(ringProf[0]);
  b.add('steel', alongZ(lathe(ringProf, { segs: 64 })).translate(RING[0], RING[1], 0));

  /* ---------------- scales ---------------- */
  const scale = smooth(
    [
      [2.5, 12.2],
      [-6, 12.7],
      [-20, 13.3],
      [-40, 13.6],
      [-58, 11.6],
      [-69, 8.8],
      [-74.5, 6.6],
      [-76.3, 5],
      [-73.5, -1],
      [-72.9, -7.7],
      [-73.8, -12.8],
      [-66, -12.8],
      [-52, -14],
      [-38, -12.2],
      [-24, -13.2],
      [-12, -15],
      [-4.5, -16.9],
      [-0.5, -14.6],
      [1.6, -8],
      [3.2, 2],
      [3.4, 8],
    ],
    true,
    5,
  );
  // Palm swell along the grip and a soft crown across it.
  const swell = (x: number, y = 0) => (0.86 + 0.18 * Math.sin(Math.PI * Math.min(1, Math.max(0, (x + 76) / 80)))) * (1 - 0.0007 * y * y);
  const contour = (g: THREE.BufferGeometry) => warp(regrid(g, 3), (p) => void (p.z *= swell(p.x, p.y)), 40);
  const HT = 7.7; // half-thickness over the grip pads, before the swell
  b.add('dark', plate(inflate(scale, 0.3), { t: 5.4, bevel: 0.15, bevelSegs: 1 }));
  b.add('sec', contour(plate(scale, { t: (HT - 1.1) * 2, bevel: 2.6, bevelSegs: 4 })));
  // raised grip pads separated by slanted channels
  const padArea = inflate(scale, -1.9);
  const cuts = [-90, -62, -44, -26, -8, 20];
  for (let i = 0; i < cuts.length - 1; i++) {
    const pad = clipHalf(clipHalf(padArea, -1, 0.36, -(cuts[i] + 0.9)), 1, -0.36, cuts[i + 1] - 0.9);
    if (pad.length > 2) b.add('sec', contour(plate(pad, { t: HT * 2, bevel: 0.9, bevelSegs: 2 })));
  }

  /* ---------------- hollow pins ---------------- */
  for (const [x, y] of [
    [-53, 0],
    [-35, 0.8],
    [-17, -0.2],
  ]) {
    const hz = HT * swell(x, y) + 0.25;
    b.add('steel', alongZ(tube(-hz, hz, 2.7, 1.8, { chamfer: 0.35, depth: 3, segs: 20 })).translate(x, y, 0));
    b.add('dark', studZ(x, y, 2.1, -(hz - 0.9), hz - 0.9, 0.05));
  }

  const flat = bl.onFlat(21, 6.4);
  const tip = bl.tip;
  b.anchor('tally', flat[0], flat[1], flat[2], [0, 0, 1]);
  b.anchor('tip', tip[0], tip[1], 0, [1, 0, 0]);
  b.anchor('muzzle', tip[0], tip[1], 0, [1, 0, 0]);
  return b.build();
}
