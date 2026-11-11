/**
 * Regent .357: double-action revolver, 4 inch vent-rib barrel with a full underlug.
 * Authored in mm. x = 0 at the breech face behind the cylinder, bore axis on y = 0.
 */
import * as THREE from 'three';
import { Builder, alongY, arcPts, box, circle, pinZ, plate, poly, pts, rect, rod, rotate2, shift, slot, studZ, tube, warp, xf, type BuiltModel, type V2 } from '../kit';

const DEG = Math.PI / 180;
const CY = -11.4; // cylinder axis below the bore
const RC = 19.8; // cylinder radius
const C0 = 1.3; // cylinder rear face
const C1 = 41.6; // cylinder front face
const FW = 9.6; // frame half-width
const FR = 58; // front face of the frame
const ML = 147.5; // muzzle

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

/** Cylinder cross-section with six flutes; `depth` is how deep the flute cutter bites. */
function cylProf(depth: number): V2[] {
  const rf = 6;
  const D = RC + rf - depth;
  const alpha = Math.acos((RC * RC + D * D - rf * rf) / (2 * RC * D));
  const beta = Math.acos((D * D + rf * rf - RC * RC) / (2 * D * rf));
  const out: [number, number][] = [];
  for (let k = 0; k < 6; k++) {
    const th = k * 60 * DEG;
    const cz = D * Math.cos(th);
    const cy = CY + D * Math.sin(th);
    for (let i = 0; i <= 8; i++) {
      const phi = th + Math.PI + beta - (2 * beta * i) / 8;
      out.push([cz + rf * Math.cos(phi), cy + rf * Math.sin(phi)]);
    }
    for (let i = 1; i < 6; i++) {
      const a = th + alpha + ((Math.PI / 3 - 2 * alpha) * i) / 6;
      out.push([RC * Math.cos(a), CY + RC * Math.sin(a)]);
    }
  }
  return pts(out);
}

export function buildRegent(): BuiltModel {
  const b = new Builder();

  /* ---------------- frame ---------------- */
  b.add(
    'body',
    plate(
      ccw(
        poly([
          [-13, 14.3, 1],
          [FR, 14.3, 0.8],
          [FR, -27, 2],
          [46, -41.5, 4],
          [-10, -45.5],
          [-18, -52, 6],
          [-34, -80, 20],
          [-56, -124, 3],
          [-88, -118, 5],
          [-76, -84, 30],
          [-50, -21, 8],
          [-45, -8, 5],
          [-34, -3, 5],
          [-17, 9, 2],
        ]),
      ),
      { t: FW * 2, bevel: 0.9, holes: [poly([[0, 9.2, 1.5], [42.4, 9.2, 1.5], [42.4, -32.2, 2], [0, -32.2, 2]])] },
    ),
  );

  // recoil shield: a domed boss behind the cylinder, as wide as the cylinder itself
  const shield = poly([...arcPts(0, CY, 19.4, -145, 40, 26), [11.5, 8.5, 3], [FW, 14.3, 1], [-FW, 14.3, 1], [-11.5, 6, 3], [-12.5, -19, 2]]);
  b.add('body', seg(shield, -8, -0.2), cap(shield, -14, -1, 6));

  /* ---------------- cylinder ---------------- */
  const round = circle(0, CY, RC, 72);
  const chambers = [0, 1, 2, 3, 4, 5].map((k) => circle(11.4 * Math.cos((30 + k * 60) * DEG), CY + 11.4 * Math.sin((30 + k * 60) * DEG), 4.9, 18));
  const fluted = cylProf(2.4);
  b.add('body', cap(round, C0, -1, 0.9), seg(round, C0 + 0.92, 11));
  [0.5, 1.05, 1.5, 1.85, 2.1, 2.28].forEach((d, i) => b.add('body', seg(cylProf(d), 11 + i, 12 + i)));
  b.add('body', seg(fluted, 17, C1 - 1.22, chambers), cap(fluted, C1, 1, 1.2, chambers));
  // cylinder-stop notches, cartridge rims in the breech gap, gas ring and forcing cone
  for (let k = 0; k < 6; k++) {
    b.add('dark', xf(box(4.6, CY - 1.7, 9.4, CY + 1.7, 0.9, { at: RC, bevel: 0.15, r: 0.4 }), { rx: -(30 + k * 60), pivot: [0, CY, 0] }));
    const a = (30 + k * 60) * DEG;
    b.add('bright', rod(-0.15, C0 + 0.3, 5.6, { y: CY + 11.4 * Math.sin(a), z: 11.4 * Math.cos(a), chamfer: 0.3, segs: 16 }));
  }
  b.add('body', rod(C1 - 0.5, 42.6, 4.4, { y: CY, chamfer: 0.3 }));
  b.add('bright', rod(C1 + 0.15, 42.9, 6.4, { chamfer: 0.2 }));
  for (let k = 0; k < 6; k++) {
    const a = (30 + k * 60) * DEG;
    b.add('dark', rod(22, 32, 5.1, { y: CY + 11.4 * Math.sin(a), z: 11.4 * Math.cos(a), chamfer: 0.1, segs: 14 }));
  }

  /* ---------------- barrel ---------------- */
  b.add('body', tube(FR - 2, ML, 9.2, 4.55, { chamfer: 0.9, depth: 18 }));
  const lug = poly([
    [-7.6, -3],
    [-7.6, -26, 7.2],
    [7.6, -26, 7.2],
    [7.6, -3],
  ]);
  const lugCut = poly([
    [-7.6, -3],
    [-7.6, -7.4, 0.4],
    [1.4, -7.4, 1],
    [1.4, -15.6, 1],
    [-7.6, -15.6, 0.4],
    [-7.6, -26, 7.2],
    [7.6, -26, 7.2],
    [7.6, -3],
  ]);
  b.add('body', seg(lugCut, FR - 1, 104), seg(lug, 104, ML - 2.7), cap(lug, ML - 1.5, 1, 1.2));
  b.add('bright', rod(C1 - 0.5, 96, 2.3, { y: CY, chamfer: 0.2, segs: 14 }));
  b.add('bright', rod(90.5, 101.5, 3.2, { y: CY, chamfer: 0.7, segs: 16 }));
  for (const x of [93, 95.2, 97.4]) b.add('steel', rod(x, x + 1, 3.45, { y: CY, chamfer: 0.25, segs: 16 }));
  b.add('steel', rod(101, 104.6, 1.4, { y: CY, chamfer: 0.2, segs: 10 }));
  b.add('body', rod(FR - 1.5, FR + 2.2, 10, { chamfer: 0.7 })); // barrel shoulder
  for (let x = 61; x < 124; x += 2.4) b.add('body', box(x, 14.9, x + 1.1, 15.62, 6.6, { bevel: 0.2, r: 0.2 }));

  // ramp front sight with a coloured insert
  b.add('steel', box(125, 14.7, 146.2, 16.1, 6.6, { bevel: 0.4, r: 0.5 }));
  b.add('steel', plate(poly([[127, 15.6], [145.6, 15.6], [145.6, 16.8, 0.4], [143.6, 21.7, 0.6], [140.8, 21.9, 0.6], [127, 16.4, 0.3]]), { t: 3.4, bevel: 0.5 }));
  b.add('led', plate(poly([[134.2, 19.6], [140.3, 22.03], [140.6, 21.3], [134.5, 18.87]]), { t: 2.3, bevel: 0.15 }));
  // vent rib
  b.add(
    'body',
    plate(ccw(poly([[FR - 2, 8], [ML - 1.5, 8], [ML - 1, 13.4, 1.5], [ML - 3.5, 15.3, 1], [FR - 2, 15.3]])), {
      t: 8.6,
      bevel: 0.6,
      holes: [slot(70, 11.7, 86, 11.7, 1.5), slot(94, 11.7, 110, 11.7, 1.5), slot(118, 11.7, 130, 11.7, 1.5)],
    }),
  );

  /* ---------------- grip ---------------- */
  const gripWarp = (p: THREE.Vector3) => {
    const k = THREE.MathUtils.smoothstep(p.y, -70, -22);
    p.z *= THREE.MathUtils.lerp(1 + 0.06 * THREE.MathUtils.smoothstep(-p.y, 95, 128), 0.74, k);
  };
  const grip = plate(
    poly([
      [-48.5, -19, 3],
      [-26, -34, 8],
      [-13.5, -47, 3],
      [-12, -56, 3],
      [-21, -80, 14],
      [-29, -104, 20],
      [-38, -127, 6],
      [-90, -131, 9],
      [-92.5, -116, 8],
      [-74.5, -84, 30],
    ]),
    { t: 31, bevel: 7, bevelSegs: 4 },
  );
  b.add('sec', warp(grip, gripWarp));
  // checkered panels
  const panelO = ccw(poly([[-45, -50, 4], [-27, -56, 4], [-40, -110, 5], [-79, -113.5, 5], [-67, -86, 30]]));
  const diamonds: V2[][] = [];
  for (let j = 0; j < 24; j++) {
    for (let i = 0; i < 16; i++) {
      const x = -88 + i * 4.6 + (j % 2) * 2.3;
      const y = -118 + j * 3.1;
      if (clearance(panelO, x, y) < 2.8 || Math.hypot(x + 55, y + 84) < 6.4) continue;
      diamonds.push(pts([[x + 1.6, y], [x, y + 1.35], [x - 1.6, y], [x, y - 1.35]]));
    }
  }
  b.both('sec', warp(plate(panelO, { t: 1.4, at: 15.7, bevel: 0, holes: diamonds }), gripWarp));
  // medallion, grip screw and escutcheon
  b.both('steel', studZ(-41, -43, 6, 11.5, 13.5, 0.5), studZ(-55, -84, 4.2, 14.5, 16.3, 0.5));
  b.both('bright', studZ(-41, -43, 4.6, 12.5, 14, 0.35), studZ(-55, -84, 2.5, 15, 16.9, 0.4));
  b.both('dark', xf(box(-57.4, -84.4, -52.6, -83.6, 0.6, { at: 16.95, bevel: 0.1, r: 0.2 }), { rz: 28, pivot: [-55, -84, 0] }));

  /* ---------------- trigger guard, trigger, hammer ---------------- */
  b.add(
    'body',
    plate(
      ccw(
        poly([
          [-14, -44],
          [40, -42],
          [40.5, -46, 2],
          [30, -66, 10],
          [18, -75.5, 8],
          [-2, -75.5, 8],
          [-14.5, -62, 6],
        ]),
      ),
      {
        t: 11.4,
        bevel: 1.6,
        bevelSegs: 3,
        holes: [
          poly([
            [-9, -46.5, 3],
            [32, -46.5, 4],
            [25, -64.5, 9],
            [16, -70.5, 6],
            [0, -70.5, 7],
            [-11, -60, 5],
          ]),
        ],
      },
    ),
  );
  b.add(
    'steel',
    plate(
      poly([
        [-1, -42],
        [7, -42],
        [8, -50, 5],
        [5.5, -58, 8],
        [6.2, -66, 1.8],
        [2.6, -66.5, 1.8],
        [0.5, -56, 10],
      ]),
      { t: 8, bevel: 1.6, bevelSegs: 3 },
    ),
  );
  b.add(
    'steel',
    plate(
      poly([
        [-22, -12],
        [-12.6, 3],
        [-12.6, 9, 1.2],
        [-17, 13, 2],
        [-27, 12, 3],
        [-43.5, 7.5, 1.5],
        [-44, 4.5, 1.2],
        [-33, 4.6, 4],
        [-30, -2, 4],
        [-34, -12],
      ]),
      { t: 7.4, bevel: 1, bevelSegs: 2 },
    ),
  );
  // checkered thumb pad on the spur
  b.add('steel', plate(poly([[-44.6, 7.9, 0.6], [-29.5, 12.9, 0.6], [-29, 11.4, 0.5], [-44.1, 6.4, 0.5]]), { t: 10.6, bevel: 0.6 }));
  for (let i = 0; i < 6; i++) {
    const cx = -42.6 + i * 2.3;
    const cy = 8.75 + i * 0.762;
    b.add('steel', plate(shift(rotate2(rect(-0.55, -0.45, 1.1, 0.9, 0.2), 18.3), cx, cy), { t: 9.4, bevel: 0.25 }));
  }
  b.add('steel', pinZ(4, -40, 1.5, FW, 0.4));
  b.add('steel', pinZ(-24, -15, 1.9, FW, 0.4));

  /* ---------------- rear sight ---------------- */
  b.add('steel', box(-12.5, 13.9, 16, 15.45, 9.4, { bevel: 0.4, r: 0.6 }));
  b.add('steel', box(-11, 14, -1.5, 17.3, 13.4, { bevel: 0.6, r: 0.8 }));
  b.add(
    'steel',
    plate(
      poly([
        [-7.6, 14],
        [7.6, 14],
        [7.6, 16.6, 0.5],
        [6.7, 20, 0.5],
        [2, 20, 0.2],
        [2, 17.5, 0.35],
        [-2, 17.5, 0.35],
        [-2, 20, 0.2],
        [-6.7, 20, 0.5],
        [-7.6, 16.6, 0.5],
      ]),
      { t: 4.6, plane: 'zy', at: -13.2, bevel: 0.45 },
    ),
  );
  b.add('steel', studZ(-6.3, 15.8, 1.8, 6, 7.7, 0.3), studZ(-6.3, 15.8, 1.3, -7.3, -6, 0.3));
  b.add('dark', box(-7.9, 15.5, -4.7, 16.1, 0.6, { at: 7.7, bevel: 0.1, r: 0.15 }));
  for (const [x, r] of [[-4.2, 1.7], [12, 1.5]] as const) {
    const y = x < 0 ? 17.3 : 15.45;
    b.add('steel', alongY(rod(y - 0.5, y + 0.7, r, { chamfer: 0.25, segs: 14 })).translate(x, 0, 0));
    b.add('dark', box(x - r + 0.2, y + 0.4, x + r - 0.2, y + 1, 0.6, { bevel: 0.1, r: 0.1 }));
  }

  /* ---------------- lockwork furniture ---------------- */
  // cylinder release on the left
  b.add('steel', plate(poly([[-31, -12, 2.5], [-18, -13.5, 2], [-15.5, -6, 2], [-18.5, -1.5, 2], [-29.5, -4, 2.5]]), { t: 3, at: -(FW + 1.1), bevel: 0.8, bevelSegs: 2 }));
  for (let i = 0; i < 4; i++) b.add('steel', box(-28.6 + i * 2.6, -11.4, -27.4 + i * 2.6, -4.6, 1, { at: -(FW + 2.75), bevel: 0.3, r: 0.3 }));
  b.add('steel', studZ(-19.2, -5.2, 1.5, -(FW + 3.4), -(FW + 1)));
  // crane on the left, sideplate with its screws on the right
  b.add('body', plate(poly([[43.2, -12.5, 2], [57.6, -12.5, 1.5], [57.6, -27.3, 2], [46.6, -40.8, 3], [43.2, -40.8, 1]]), { t: 0.9, at: -(FW + 0.05), bevel: 0.3 }));
  b.add(
    'body',
    plate(poly([[-40, -9, 5], [-13, -2, 2], [-6, -33.6, 2], [30, -34.3, 1.5], [36, -40.6, 2], [-12, -44.6, 2], [-34, -34, 8], [-45, -20, 5]]), { t: 0.9, at: FW + 0.05, bevel: 0.3 }),
  );
  ([[-34, -14, 20], [26, -38, -35], [-18, -40, 70]] as const).forEach(([x, y, a]) => {
    b.add('steel', studZ(x, y, 2.2, FW, FW + 1.15, 0.35));
    b.add('dark', xf(box(x - 2, y - 0.38, x + 2, y + 0.38, 0.6, { at: FW + 1.2, bevel: 0.1, r: 0.15 }), { rz: a, pivot: [x, y, 0] }));
  });

  b.anchor('muzzle', ML, 0, 0, [1, 0, 0]);
  b.anchor('tally', 104, -14.5, 7.6, [0, 0, 1]);
  b.anchor('eject', C1 + 0.4, 6, 9, [0.2, 0.6, 1]);
  return b.build();
}
