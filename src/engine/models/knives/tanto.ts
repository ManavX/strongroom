/**
 * Tanto: fighting knife with an angular reinforced tip, fuller, steel guard,
 * cord-wrapped grip and a steel pommel with a lanyard hole.
 * Authored in mm. x = 0 at the front face of the guard, blade axis on y = 0.
 */
import { Builder, circle, loft, pinZ, plate, poly, slot, warp, type BuiltModel } from '../kit';
import { blade, gridSurface, type P3, type Pt } from './blade';

export function buildTanto(): BuiltModel {
  const b = new Builder();

  /* ---------------- blade ---------------- */
  const heelS: Pt = [-1.5, 16];
  const heelE: Pt = [-1.5, -16.6];
  const corner: Pt = [132, -15.2];
  const tip: Pt = [160, 15.4];
  // The transition line (yokote) bisects the corner, so both bevels keep the same angle.
  const l1 = Math.hypot(corner[0] - heelE[0], corner[1] - heelE[1]);
  const l2 = Math.hypot(tip[0] - corner[0], tip[1] - corner[1]);
  const bx = -(corner[0] - heelE[0]) / l1 + (tip[0] - corner[0]) / l2;
  const by = -(corner[1] - heelE[1]) / l1 + (tip[1] - corner[1]) / l2;
  const sdx = tip[0] - heelS[0];
  const sdy = tip[1] - heelS[1];
  // corner + b * q = heelS + sd * r
  const q = ((heelS[0] - corner[0]) * sdy - (heelS[1] - corner[1]) * sdx) / (bx * sdy - by * sdx);
  const r = (corner[0] + bx * q - heelS[0]) / sdx;
  const NM = 44;
  const NF = 14;
  const spine: Pt[] = [];
  const edge: Pt[] = [];
  for (let i = 0; i <= NM; i++) {
    const k = i / NM;
    const e = Math.min(1, Math.max(0, (k - 0.72) / 0.28));
    const lean = e * e * (3 - 2 * e);
    const ex = heelE[0] + (corner[0] - heelE[0]) * k;
    const rs = ((ex - heelS[0]) / sdx) * (1 - lean) + r * lean * k;
    edge.push([ex, heelE[1] + (corner[1] - heelE[1]) * k]);
    spine.push([heelS[0] + sdx * rs, heelS[1] + sdy * rs]);
  }
  for (let i = 1; i <= NF; i++) {
    const k = i / NF;
    edge.push([corner[0] + (tip[0] - corner[0]) * k, corner[1] + (tip[1] - corner[1]) * k]);
    spine.push([heelS[0] + sdx * (r + (1 - r) * k), heelS[1] + sdy * (r + (1 - r) * k)]);
  }
  const bl = blade({
    spine,
    edge,
    thick: 5.4,
    tipThick: 4.8,
    grindWidth: 15,
    edgeBevel: 1.8,
    edgeThick: 0.6,
    plunge: { at: 14.5, len: 5 },
    fuller: { from: 44, to: 118, offset: 7.6, width: 4.6, depth: 0.9 },
    chamfer: 0.45,
    jimping: { from: 12.5, to: 36.5, pitch: 3, depth: 0.9 },
  });
  b.add('body', bl.body);
  b.add('bright', bl.bevel);

  /* ---------------- guard and blade collar ---------------- */
  const guard = plate(
    poly([
      [-11.5, -25.5, 7],
      [11.5, -25.5, 7],
      [11.5, 23.5, 7],
      [-11.5, 23.5, 7],
    ]),
    { t: 5.6, plane: 'zy', at: -3, bevel: 1.3, bevelSegs: 3 },
  );
  // quillons sweep slightly forward
  b.add('steel', warp(guard, (p) => void (p.x += 0.0065 * p.y * p.y)));
  b.add(
    'steel',
    loft([
      { x: -1, y: -0.3, w: 9.2, h: 35.6, r: 1.8 },
      { x: 6.4, y: -0.3, w: 8.6, h: 35, r: 1.5 },
      { x: 7.6, y: -0.3, w: 6.8, h: 33.8, r: 0.9 },
    ]),
  );

  /* ---------------- grip ---------------- */
  // Oval section with a palm swell; `grow` offsets the surface outward.
  const HX0 = -113;
  const HX1 = -12;
  const EXP = 2 / 2.5;
  const sect = (x: number, phi: number, grow = 0): P3 => {
    const k = Math.min(1, Math.max(0, (HX1 - x) / (HX1 - HX0)));
    const sw = Math.sin(Math.PI * k);
    const a = 9.3 + 0.9 * sw + grow;
    const bq = 14.0 + 1.1 * sw + 0.7 * k * k + grow;
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    return [x, Math.sign(c) * Math.abs(c) ** EXP * bq, Math.sign(s) * Math.abs(s) ** EXP * a];
  };
  /** Shell around the grip section from a profile of [x, grow], listed front to back. */
  const shell = (prof: readonly Pt[]) =>
    gridSurface(
      prof.length - 1,
      44,
      (u, v) => {
        const q2 = prof[Math.round(u * (prof.length - 1))];
        return sect(q2[0], v * Math.PI * 2, q2[1]);
      },
      { crease: 33 },
    );

  // core under the wrap
  b.add(
    'dark',
    gridSurface(18, 44, (u, v) => sect(HX1 + 2 + (HX0 - HX1 - 4) * u, v * Math.PI * 2)),
  );
  // two counter-wound straps crossing on the side faces
  const PITCH = 15.6;
  const TURNS = (HX1 - HX0) / PITCH;
  const STRAP: readonly Pt[] = [
    [-3.1, -1],
    [-3.1, 0.45],
    [-2.5, 0.95],
    [0, 1.1],
    [2.5, 0.95],
    [3.1, 0.45],
    [3.1, -1],
  ];
  for (const dir of [1, -1]) {
    b.add(
      'sec',
      gridSurface(
        Math.round(TURNS * 44),
        STRAP.length - 1,
        (u, v) => {
          const phi = Math.PI / 2 + dir * u * TURNS * Math.PI * 2;
          const pr = STRAP[Math.round(v * (STRAP.length - 1))];
          const top = 1.05 + dir * 0.3 * Math.sin(phi);
          return sect(HX1 + (HX0 - HX1) * u + pr[0], phi, pr[1] < 0 ? -0.6 : pr[1] * top);
        },
        { flip: dir < 0 },
      ),
    );
  }
  // retaining peg in one of the diamond openings
  b.add('steel', pinZ(HX1 - PITCH * 2.5, 0, 1.7, 10.2, 0.5));

  // ferrule behind the guard
  b.add(
    'steel',
    shell([
      [-4, 1.4],
      [-5.4, 2.2],
      [-13.8, 2.2],
      [-14.6, 1.4],
      [-14.6, -0.8],
    ]),
  );

  /* ---------------- pommel ---------------- */
  b.add(
    'steel',
    shell([
      [-108.4, -0.8],
      [-108.4, 1.8],
      [-109.2, 2.6],
      [-116, 2.6],
      ...[15, 30, 45, 60, 75, 90].map((t): Pt => [-116 - 5 * Math.sin((t * Math.PI) / 180), -2.4 + 5 * Math.cos((t * Math.PI) / 180)]),
      [-121, -5.5],
      [-121, -9.25],
    ]),
  );
  b.add('steel', plate(slot(-117, 0, -123.4, 0, 6.6), { t: 5.4, bevel: 1.0, holes: [circle(-123.8, 0, 3)] }));

  const flat = bl.onFlat(24, 9);
  b.anchor('tally', flat[0], flat[1], flat[2], [0, 0, 1]);
  b.anchor('tip', tip[0], tip[1], 0, [1, 0, 0]);
  b.anchor('muzzle', tip[0], tip[1], 0, [1, 0, 0]);
  return b.build();
}
