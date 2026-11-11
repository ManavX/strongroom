/**
 * Kukri: forward-curved recurve chopper with a broad belly, the traditional
 * notch (cho) ahead of the bolster, a swelled ringed handle and a flared butt cap.
 * Authored in mm. x = 0 at the front of the bolster, handle axis on y = 0.
 */
import * as THREE from 'three';
import { Builder, loft, xf, type BuiltModel, type Sec } from '../kit';
import { blade, curve, pointAlong, type Pt } from './blade';

export function buildKukri(): BuiltModel {
  const b = new Builder();

  /* ---------------- blade ---------------- */
  const spineC = curve(
    [
      [-1, 15],
      [40, 17.5],
      [85, 19.6],
      [118, 19],
      [152, 14.5],
      [192, 4.5],
      [228, -8],
      [258, -22],
      [281, -37],
      [297, -51],
    ],
    240,
  );
  const edgeC = curve(
    [
      [-1, -15],
      [24, -15],
      [55, -13.2],
      [86, -15.5],
      [116, -22],
      [150, -34],
      [185, -48.5],
      [216, -58.5],
      [246, -63.5],
      [270, -62.5],
      [286, -58],
      [297, -51],
    ],
    400,
  );
  // Stations: fine through the notch, coarser along the rest of the edge.
  const edgeLen = edgeC.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - edgeC[i - 1][0], p[1] - edgeC[i - 1][1]) : 0), 0);
  const spineLen = spineC.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - spineC[i - 1][0], p[1] - spineC[i - 1][1]) : 0), 0);
  const NX0 = 10.5;
  const NX1 = 20.5;
  const sList: number[] = [];
  for (let s = 0; s < edgeLen; s += s > NX0 && s < NX1 + 1 ? 0.42 : s < 40 ? 2 : 4.6) sList.push(s);
  sList.push(edgeLen);
  // Cho: two scallops with a small tooth between them.
  const cho = (x: number) => {
    const q = (x - NX0) / (NX1 - NX0);
    if (q <= 0 || q >= 1) return 0;
    const sc = (c: number) => Math.sqrt(Math.max(0, 1 - ((q - c) / 0.25) ** 2));
    return 6 * Math.max(sc(0.27), sc(0.73));
  };
  const edge: Pt[] = [];
  const spine: Pt[] = [];
  for (const s of sList) {
    const e = pointAlong(edgeC, s);
    edge.push([e[0], e[1] + cho(e[0])]);
    spine.push(pointAlong(spineC, (s / edgeLen) * spineLen));
  }
  const tip = edge[edge.length - 1];

  const bl = blade({
    spine,
    edge,
    thick: 8,
    tipThick: 3,
    taperFrom: 0.12,
    grind: 0.52,
    hollow: -0.3,
    maxSlope: 0.3,
    edgeBevel: 1.9,
    edgeThick: 0.7,
    plunge: { at: 26, len: 11 },
    fuller: [
      { from: 42, to: 212, offset: 6.2, width: 5.2, depth: 1.2 },
      { from: 46, to: 190, offset: 11.6, width: 2.2, depth: 0.55 },
    ],
    chamfer: 0.6,
  });
  b.add('body', bl.body);
  b.add('bright', bl.bevel);

  /* ---------------- bolster ---------------- */
  b.add(
    'steel',
    loft([
      { x: -14.5, w: 23, h: 33, r: 11 },
      { x: -13, w: 25.4, h: 35.6, r: 12.4 },
      { x: -3, w: 24.6, h: 35, r: 12 },
      { x: 0.4, w: 19.5, h: 33.4, r: 9 },
      { x: 2.4, w: 11.5, h: 32, r: 4.5 },
    ]),
  );

  /* ---------------- handle ---------------- */
  // width (z) and height (y) along the grip: waist behind the bolster, palm swell, flared butt
  const knots: [number, number, number][] = [
    [-10, 21, 30],
    [-30, 23.6, 32.2],
    [-58, 27, 35.6],
    [-84, 24.2, 32.6],
    [-101, 24.6, 33.6],
    [-112, 31, 43],
  ];
  const prof = new THREE.CatmullRomCurve3(
    knots.map((k) => new THREE.Vector3(k[0], k[1], k[2])),
    false,
    'centripetal',
  ).getPoints(160);
  const at = (x: number): [number, number] => {
    let i = 0;
    while (i < prof.length - 2 && prof[i + 1].x > x) i++;
    const f = Math.min(1, Math.max(0, (x - prof[i].x) / (prof[i + 1].x - prof[i].x)));
    return [prof[i].y + (prof[i + 1].y - prof[i].y) * f, prof[i].z + (prof[i + 1].z - prof[i].z) * f];
  };
  // raised centre ring and incised lines
  const RING_X = -59;
  const grooves = [-23, -26.5, -50.5, -67.5, -91, -94.5];
  const relief = (x: number) => {
    let d = 0;
    const r = Math.abs(x - RING_X);
    if (r < 3.2) d += 1.4 * Math.cos((r / 3.2) * (Math.PI / 2)) ** 1.2;
    for (const g of grooves) d -= 0.75 * Math.max(0, 1 - Math.abs(x - g) / 0.9);
    return d;
  };
  const xs = new Set<number>();
  for (let x = -10; x >= -112; x -= 3.4) xs.add(+x.toFixed(2));
  xs.add(-112);
  for (const g of grooves) for (const o of [-0.9, 0, 0.9]) xs.add(+(g + o).toFixed(2));
  for (let o = -3.2; o <= 3.21; o += 0.8) xs.add(+(RING_X + o).toFixed(2));
  const secs: Sec[] = [...xs]
    .sort((p, q) => p - q)
    .map((x) => {
      const [w, h] = at(x);
      const d = relief(x) * 2;
      return { x, w: w + d, h: h + d, r: (w + d) / 2 - 0.6 };
    });
  b.add('sec', loft(secs, { k: 6, crease: 46 }));

  /* ---------------- butt cap ---------------- */
  b.add(
    'steel',
    loft([
      { x: -118.4, w: 31, h: 43.4, r: 15 },
      { x: -116.6, w: 34, h: 46.4, r: 16.4 },
      { x: -112.2, w: 33.6, h: 46, r: 16.2 },
      { x: -110.6, w: 30.5, h: 42.4, r: 14.6 },
    ]),
  );
  // peened tang keeper
  b.add(
    'steel',
    xf(
      loft([
        { x: -122.6, w: 3.4, h: 3.4, r: 0.5 },
        { x: -121, w: 7, h: 7, r: 0.8 },
        { x: -118, w: 9.5, h: 9.5, r: 1 },
      ]),
      { rx: 45 },
    ),
  );

  const flat = bl.onFlat(22, 10.2);
  b.anchor('tally', flat[0], flat[1], flat[2], [0, 0, 1]);
  b.anchor('tip', tip[0], tip[1], 0, [1, 0, 0]);
  b.anchor('muzzle', tip[0], tip[1], 0, [1, 0, 0]);
  return b.build();
}
