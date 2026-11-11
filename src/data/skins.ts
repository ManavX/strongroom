/**
 * The skin catalogue. Every entry is original: a name, a rarity, a wear range
 * and a recipe that the finish library turns into procedural artwork.
 */
import type { PartRecipe, PatSpec, Recipe } from '../engine/finishes/library';
import type { RarityId } from './rarities';

export interface SkinDef {
  id: string;
  weapon: string;
  name: string;
  rarity: RarityId;
  caseId: string;
  /** Lowest and highest wear this finish can roll. */
  float: readonly [number, number];
  /** Desirability multiplier on the rarity's base value. */
  value: number;
  desc: string;
  /** null = factory finish. */
  recipe: Recipe | null;
  /** Gradient skins expose how far along the fade a seed landed. */
  fade?: boolean;
}

const pat = (gen: string, colors: string[], size: PatSpec['size'], extra: Partial<PatSpec> = {}): PatSpec => ({ gen, colors, size, ...extra });
const solid = (mat: PartRecipe['mat'], color: string, fleckColor?: string): PartRecipe => ({
  mat,
  pat: pat('fleck', [color, fleckColor ?? color], 60, { rotVar: 360 }),
});
const GOLD = { lo: 0.3, hi: 0.55, metalness: 1, roughness: 0.2 };

type Row = Omit<SkinDef, 'id' | 'caseId'>;

const FOUNDRY: Row[] = [
  /* ---- Service ---- */
  {
    weapon: 'sentry',
    name: 'Slag',
    rarity: 'service',
    float: [0, 1],
    value: 0.8,
    desc: 'What is left in the ladle when the good metal has been poured.',
    recipe: { body: { mat: 'matte', pat: pat('patina', ['#2b2c2e', '#55565a', '#3a3b3e', '#7b7468'], 140, { rotVar: 360 }) } },
  },
  {
    weapon: 'vesper',
    name: 'Rivet Line',
    rarity: 'service',
    float: [0, 0.9],
    value: 1.0,
    desc: 'Plated like a boiler door. Every seam accounted for.',
    recipe: { body: { mat: 'satin', pat: pat('plates', ['#4a4d52', '#3a3d42', '#1c1d20', '#c9a23a'], 250, { rotVar: 8 }) } },
  },
  {
    weapon: 'breacher',
    name: 'Cinder Block',
    rarity: 'service',
    float: [0.06, 1],
    value: 0.75,
    desc: 'Grey on grey on grey. Nobody ever stole one.',
    recipe: { body: { mat: 'matte', pat: pat('camo', ['#3b3a38', '#5a5651', '#2a2928', '#77706a'], 200, { a: 4, rotVar: 360 }) } },
  },
  {
    weapon: 'regent',
    name: 'Cold Blue',
    rarity: 'service',
    float: [0, 0.8],
    value: 1.15,
    desc: 'Deep rust bluing, the way it was done before anyone was in a hurry.',
    recipe: { body: { mat: 'anod', pat: pat('patina', ['#101a30', '#1e3358', '#2a4a7c', '#16223d'], 160, { rotVar: 360 }) } },
  },
  {
    weapon: 'marshal',
    name: 'Shop Floor',
    rarity: 'service',
    float: [0, 1],
    value: 0.9,
    desc: 'Walkway stripes borrowed from a factory that never closed.',
    recipe: { body: { mat: 'matte', pat: pat('stripes', ['#3d4146', '#2a2d31', '#55595f', '#d8a52b'], 260, { a: 2, rotVar: 14 }) } },
  },
  {
    weapon: 'krait',
    name: 'Rustbelt',
    rarity: 'service',
    float: [0.1, 1],
    value: 0.85,
    desc: 'Left in a rail yard for a decade. Still cycles.',
    recipe: { body: { mat: 'matte', pat: pat('patina', ['#3a2418', '#7a4424', '#a8632e', '#4f3526', '#2a1c14'], 180, { rotVar: 360 }) } },
  },
  {
    weapon: 'magnate',
    name: 'Soot',
    rarity: 'service',
    float: [0, 1],
    value: 0.7,
    desc: 'Chimney black with a dusting of ash.',
    recipe: { body: solid('matte', '#232425', '#414244') },
  },
  /* ---- Specialist ---- */
  {
    weapon: 'krait',
    name: 'Weld Seam',
    rarity: 'specialist',
    float: [0, 0.75],
    value: 1.0,
    desc: 'Heat tint spreading out from a bead that was laid in one pass.',
    recipe: { body: { mat: 'anod', pat: pat('aurora', ['#1c1f26', '#3b4a78', '#7a4fa0', '#c98a3c', '#2a2d36'], 230, { a: 2, rotVar: 30 }) } },
  },
  {
    weapon: 'longwatch',
    name: 'Blast Furnace',
    rarity: 'specialist',
    float: [0, 0.6],
    value: 1.2,
    desc: 'Tapped at the muzzle, cooling toward the stock.',
    fade: true,
    recipe: { body: { mat: 'satin', pat: pat('fade', ['#17171a', '#4a170d', '#b9441a', '#f2a23a'], 'fit', { shift: [0.4, 0] }) }, sec: 'body' },
  },
  {
    weapon: 'sentry',
    name: 'Hazard Pay',
    rarity: 'specialist',
    float: [0, 0.85],
    value: 1.1,
    desc: 'Chevrons, stencils and a strong suggestion to stand back.',
    recipe: { body: { mat: 'satin', pat: pat('hazard', ['#d9a82a', '#17181a', '#f0c53d', '#17181a'], 230, { rotVar: 6 }) } },
  },
  {
    weapon: 'vesper',
    name: 'Annealed',
    rarity: 'specialist',
    float: [0, 0.7],
    value: 0.95,
    desc: 'Straw, plum, then blue: the colours steel passes through as it relaxes.',
    recipe: { body: { mat: 'anod', pat: pat('patina', ['#3a3d44', '#c9a45a', '#a0507a', '#3c4fa8', '#2a3a66'], 150, { rotVar: 360 }) } },
  },
  {
    weapon: 'breacher',
    name: 'Tread Plate',
    rarity: 'specialist',
    float: [0, 1],
    value: 0.9,
    desc: 'Anti-slip plate, formed and fitted. Grips back.',
    recipe: { body: { mat: 'anod', pat: pat('hexgrid', ['#55585d', '#6c7076', '#3f4246', '#2a2c2f'], 150, { a: 12, b: 0.5, rotVar: 20 }), over: { roughness: 0.38 } } },
  },
  /* ---- Elite ---- */
  {
    weapon: 'marshal',
    name: 'Crucible',
    rarity: 'elite',
    float: [0, 0.65],
    value: 1.0,
    desc: 'Facets of orange light through cracked refractory brick.',
    recipe: { body: { mat: 'gloss', pat: pat('shards', ['#1a1a1c', '#2b2622', '#ff7a1a', '#c2410c', '#ffb347'], 260, { a: 7, rotVar: 360 }) }, sec: solid('matte', '#1b1918', '#35302c') },
  },
  {
    weapon: 'magnate',
    name: 'Quench',
    rarity: 'elite',
    float: [0, 0.9],
    value: 1.25,
    desc: 'Bone-charcoal hardening colours. No two ever come out of the tank alike.',
    recipe: { body: { mat: 'chrome', pat: pat('patina', ['#1d2f6a', '#3a6bd0', '#8a4ad0', '#d9a441', '#243a8a', '#6fb3e8'], 120, { a: 4, b: 2.2, rotVar: 360 }), over: { roughness: 0.22 } } },
  },
  {
    weapon: 'regent',
    name: 'Gilded Hammer',
    rarity: 'elite',
    float: [0, 0.5],
    value: 1.1,
    desc: 'Gold-inlaid scrollwork over black. Presentation grade.',
    recipe: { body: { mat: 'satin', pat: pat('scroll', ['#15161a', '#8a6a1e', '#f0c75a'], 150, { rotVar: 360 }), over: { mask: GOLD } } },
  },
  /* ---- Master ---- */
  {
    weapon: 'krait',
    name: 'Magma Vein',
    rarity: 'master',
    float: [0, 0.7],
    value: 1.2,
    desc: 'Still glowing along the cracks. It has never fully cooled.',
    recipe: {
      body: {
        mat: 'satin',
        pat: pat('magma', ['#141211', '#ff4a0c', '#ffd24a'], 190, { a: 5, rotVar: 360 }),
        over: { mask: { lo: 0.3, hi: 0.75, metalness: 0, roughness: 0.5 }, glow: '#ff5a14', glowStrength: 2.4 },
      },
      sec: solid('matte', '#1b1918', '#35302c'),
    },
  },
  {
    weapon: 'longwatch',
    name: 'Forgemaster',
    rarity: 'master',
    float: [0, 0.55],
    value: 1.0,
    desc: 'Bronze hull plating with the furnace lamps left on.',
    recipe: {
      body: {
        mat: 'anod',
        pat: pat('plates', ['#3a2a1c', '#5a3d24', '#120c08', '#ff8a2a'], 300, { a: 5, rotVar: 6 }),
        over: { mask: { lo: 0.42, hi: 0.62, metalness: 0.2, roughness: 0.4 }, glow: '#ff8a2a', glowStrength: 1.8, roughness: 0.36 },
      },
      sec: 'body',
    },
  },
];

const BLACKSITE: Row[] = [
  /* ---- Service ---- */
  {
    weapon: 'marshal',
    name: 'Night Shift',
    rarity: 'service',
    float: [0.06, 1],
    value: 0.9,
    desc: 'Low-contrast pixels for work nobody signs for.',
    recipe: { body: { mat: 'matte', pat: pat('digital', ['#17191c', '#24282d', '#31363c', '#0e0f11'], 170, { a: 56, rotVar: 4 }) } },
  },
  {
    weapon: 'sentry',
    name: 'Static',
    rarity: 'service',
    float: [0, 1],
    value: 0.7,
    desc: 'Dead-air grey with a hiss you can almost see.',
    recipe: { body: solid('matte', '#1b1c1f', '#6a6d72') },
  },
  {
    weapon: 'vesper',
    name: 'Gridlock',
    rarity: 'service',
    float: [0, 0.9],
    value: 1.05,
    desc: 'A honeycomb lattice with one faint teal line running through it.',
    recipe: { body: { mat: 'matte', pat: pat('hexgrid', ['#14171a', '#1b2226', '#182a2c', '#2fc4b2'], 140, { a: 10, b: 0.3, rotVar: 20 }) } },
  },
  {
    weapon: 'breacher',
    name: 'Dead Channel',
    rarity: 'service',
    float: [0, 1],
    value: 0.75,
    desc: 'Monochrome bands, the test card of a station that went dark.',
    recipe: { body: { mat: 'matte', pat: pat('stripes', ['#1c1e21', '#2b2e33', '#3a3e45', '#5b6068'], 200, { a: 3, rotVar: 14 }) } },
  },
  {
    weapon: 'krait',
    name: 'Asphalt',
    rarity: 'service',
    float: [0.06, 1],
    value: 0.85,
    desc: 'Road-surface black, patched and re-patched.',
    recipe: { body: { mat: 'matte', pat: pat('camo', ['#1a1b1c', '#2a2b2d', '#111112', '#3a3b3e'], 150, { a: 5, rotVar: 360 }) }, sec: solid('matte', '#141516', '#26272a') },
  },
  {
    weapon: 'magnate',
    name: 'Wiretap',
    rarity: 'service',
    float: [0, 0.6],
    value: 1.1,
    desc: 'Carbon twill under clear. Light, stiff and listening.',
    recipe: { body: { mat: 'gloss', pat: pat('weave', ['#101112', '#3a3d42'], 60, { a: 30, rotVar: 0, rot: 45 }) } },
  },
  {
    weapon: 'longwatch',
    name: 'Low Orbit',
    rarity: 'service',
    float: [0, 1],
    value: 0.95,
    desc: 'Terrain contours from a pass at four hundred kilometres.',
    recipe: { body: { mat: 'matte', pat: pat('topo', ['#12161c', '#2b3a4d', '#4f7fb0'], 240, { a: 11, rotVar: 360 }) } },
  },
  /* ---- Specialist ---- */
  {
    weapon: 'vesper',
    name: 'Mainframe',
    rarity: 'specialist',
    float: [0, 0.8],
    value: 1.15,
    desc: 'Live traces under conformal coating. Do not touch the green ones.',
    recipe: {
      body: {
        mat: 'satin',
        pat: pat('circuit', ['#0c1a16', '#1f6b55', '#5dffc8'], 220, { rotVar: 0, rot: 0 }),
        over: { mask: { lo: 0.5, hi: 0.78, metalness: 0.2, roughness: 0.3 }, glow: '#35ffc0', glowStrength: 1.3 },
      },
    },
  },
  {
    weapon: 'sentry',
    name: 'Blueprint',
    rarity: 'specialist',
    float: [0, 0.8],
    value: 1.0,
    desc: 'Revision C. Dimensions in millimetres unless otherwise stated.',
    recipe: { body: { mat: 'satin', pat: pat('blueprint', ['#16335e', '#cfe2ff', '#ffb347'], 260, { rotVar: 6 }) } },
  },
  {
    weapon: 'marshal',
    name: 'Hexfall',
    rarity: 'specialist',
    float: [0, 0.7],
    value: 1.05,
    desc: 'Violet cells dropping out of a dark lattice.',
    recipe: { body: { mat: 'gloss', pat: pat('hexgrid', ['#15121f', '#3b2a78', '#7c4dff', '#241a45', '#b79cff'], 170, { a: 9, b: 0.55, rotVar: 20 }) } },
  },
  {
    weapon: 'regent',
    name: 'Black Ice',
    rarity: 'specialist',
    float: [0, 0.5],
    value: 1.1,
    desc: 'Frost crystals over a surface you would not see until you were on it.',
    recipe: { body: { mat: 'gloss', pat: pat('frost', ['#07090d', '#1d3a55', '#bfe6ff'], 140, { rotVar: 360 }) } },
  },
  {
    weapon: 'krait',
    name: 'Signal Loss',
    rarity: 'specialist',
    float: [0, 0.85],
    value: 0.95,
    desc: 'Teal and magenta smeared across the frame where the feed dropped.',
    recipe: { body: { mat: 'satin', pat: pat('brush', ['#0d0e12', '#19e3c5', '#ff2f7a', '#e9e6df'], 300, { a: 5, rotVar: 40 }) }, sec: solid('matte', '#141516', '#26272a') },
  },
  /* ---- Elite ---- */
  {
    weapon: 'longwatch',
    name: 'Deep Field',
    rarity: 'elite',
    float: [0, 0.5],
    value: 1.2,
    desc: 'A ten-day exposure of an empty patch of sky. It was not empty.',
    recipe: { body: { mat: 'gloss', pat: pat('nebula', ['#04050c', '#3a2a9a', '#c0347a', '#ffffff'], 260, { rotVar: 360 }), over: { iridescence: 0.3 } }, sec: 'body' },
  },
  {
    weapon: 'magnate',
    name: 'Voltage',
    rarity: 'elite',
    float: [0, 0.6],
    value: 1.05,
    desc: 'Arc discharge frozen mid-strike and sealed under lacquer.',
    recipe: {
      body: {
        mat: 'gloss',
        pat: pat('lightning', ['#090b16', '#3a6bff', '#e6f1ff'], 240, { a: 7, rotVar: 360 }),
        over: { mask: { lo: 0.45, hi: 0.85, metalness: 0, roughness: 0.3 }, glow: '#5a8bff', glowStrength: 1.8 },
      },
    },
  },
  {
    weapon: 'breacher',
    name: 'Neon Grid',
    rarity: 'elite',
    float: [0, 0.7],
    value: 1.0,
    desc: 'A wireframe horizon that keeps going after the lights go out.',
    recipe: {
      body: {
        mat: 'satin',
        pat: pat('neongrid', ['#0a0612', '#1a0b2e', '#ff2fd0', '#27f3ff'], 200, { a: 10, rotVar: 10 }),
        over: { mask: { lo: 0.3, hi: 0.7, metalness: 0, roughness: 0.35 }, glow: '#ff4fe0', glowStrength: 1.6 },
      },
    },
  },
  /* ---- Master ---- */
  {
    weapon: 'marshal',
    name: 'Ghostwire',
    rarity: 'master',
    float: [0, 0.5],
    value: 1.15,
    desc: 'Cyan current running through pearl-black housings. It hums when armed.',
    recipe: {
      body: {
        mat: 'pearl',
        pat: pat('circuit', ['#0b0d12', '#232a36', '#6ff7ff'], 240, { a: 44, b: 90, rotVar: 0 }),
        over: { mask: { lo: 0.45, hi: 0.8, metalness: 0.2, roughness: 0.25 }, glow: '#3fe9ff', glowStrength: 2.4 },
      },
      sec: 'body',
    },
  },
  {
    weapon: 'sentry',
    name: 'Prism Break',
    rarity: 'master',
    float: [0, 0.45],
    value: 1.0,
    desc: 'White light went in one side. This is what came out.',
    recipe: { body: { mat: 'pearl', pat: pat('shards', ['#ff3d77', '#ffb347', '#35e0c0', '#5a7dff', '#b06cff'], 150, { a: 8, b: 0.5, rotVar: 360 }), over: { iridescence: 1 } }, sec: solid('gloss', '#0f1014', '#22242c') },
  },
];

const MERIDIAN: Row[] = [
  /* ---- Service ---- */
  {
    weapon: 'krait',
    name: 'Savanna',
    rarity: 'service',
    float: [0.06, 1],
    value: 0.9,
    desc: 'Rosettes in dry grass. Patient.',
    recipe: { body: { mat: 'matte', pat: pat('rosette', ['#c8a56a', '#2a1d12', '#8a5a2a'], 150, { a: 8, rotVar: 360 }) } },
  },
  {
    weapon: 'breacher',
    name: 'Driftwood',
    rarity: 'service',
    float: [0, 1],
    value: 0.75,
    desc: 'Sea-bleached grain, salt still in it.',
    recipe: { body: { mat: 'matte', pat: pat('damascus', ['#6b5a48', '#a8957c'], 200, { a: 9, rotVar: 16 }) } },
  },
  {
    weapon: 'regent',
    name: 'Sandbar',
    rarity: 'service',
    float: [0, 0.9],
    value: 0.85,
    desc: 'Bone-ivory enamel, flecked like wet sand.',
    recipe: { body: solid('satin', '#d8cdb6', '#b9a98a') },
  },
  {
    weapon: 'sentry',
    name: 'Tidepool',
    rarity: 'service',
    float: [0, 1],
    value: 1.0,
    desc: 'Shallow-water teal with darker shapes moving underneath.',
    recipe: { body: { mat: 'satin', pat: pat('camo', ['#1f4a52', '#2f6f74', '#163038', '#58a39a'], 160, { a: 4, rotVar: 360 }) } },
  },
  {
    weapon: 'vesper',
    name: 'Monsoon',
    rarity: 'service',
    float: [0.06, 1],
    value: 0.95,
    desc: 'Jungle stripes that only show when the light comes through.',
    recipe: { body: { mat: 'matte', pat: pat('tiger', ['#2f4a2c', '#16241a', '#6f8f4a'], 200, { a: 6, rotVar: 30 }) } },
  },
  {
    weapon: 'longwatch',
    name: 'Dune Sea',
    rarity: 'service',
    float: [0, 1],
    value: 1.0,
    desc: 'Survey contours of ground that moves every night.',
    recipe: { body: { mat: 'matte', pat: pat('topo', ['#c2a878', '#8a6f47', '#5a4630'], 260, { a: 9, rotVar: 360 }) }, sec: 'body' },
  },
  {
    weapon: 'marshal',
    name: 'Contour',
    rarity: 'service',
    float: [0.06, 1],
    value: 0.8,
    desc: 'Four tones of dust, laid on with a sponge.',
    recipe: { body: { mat: 'matte', pat: pat('camo', ['#b59b6f', '#8f7650', '#d4c19a', '#6b583c'], 240, { a: 3, rotVar: 360 }) }, sec: 'body' },
  },
  /* ---- Specialist ---- */
  {
    weapon: 'magnate',
    name: 'Tidemark',
    rarity: 'specialist',
    float: [0, 0.8],
    value: 1.05,
    desc: 'Overlapping wave crests in indigo and chalk.',
    recipe: { body: { mat: 'satin', pat: pat('waves', ['#16284f', '#e9e6df', '#1f3a73'], 250, { a: 7, b: 4, rotVar: 10 }) } },
  },
  {
    weapon: 'regent',
    name: 'Scrollwork',
    rarity: 'specialist',
    float: [0, 0.6],
    value: 1.15,
    desc: 'Silver acanthus cut into blued steel by someone with a steady hand.',
    recipe: { body: { mat: 'satin', pat: pat('scroll', ['#141a26', '#6f7785', '#dfe5ee'], 130, { rotVar: 360 }), over: { mask: { lo: 0.3, hi: 0.6, metalness: 1, roughness: 0.2 } } } },
  },
  {
    weapon: 'krait',
    name: 'Bengal',
    rarity: 'specialist',
    float: [0, 0.9],
    value: 1.1,
    desc: 'Burnt orange and black. It does not blend in and is not trying to.',
    recipe: { body: { mat: 'satin', pat: pat('tiger', ['#d9771a', '#120c08', '#f2c078'], 220, { a: 8, b: 1.7, rotVar: 30 }) }, sec: solid('matte', '#141516', '#26272a') },
  },
  {
    weapon: 'breacher',
    name: 'Carrara',
    rarity: 'specialist',
    float: [0, 0.6],
    value: 1.0,
    desc: 'Quarried white with grey and gold veining. Heavier than it looks.',
    recipe: { body: { mat: 'gloss', pat: pat('marble', ['#e6e3dc', '#6a6d72', '#b08d57'], 220, { rotVar: 360 }) } },
  },
  {
    weapon: 'longwatch',
    name: 'Verdigris',
    rarity: 'specialist',
    float: [0.05, 1],
    value: 0.9,
    desc: 'Copper that has spent a century on a harbour roof.',
    recipe: { body: { mat: 'anod', pat: pat('patina', ['#1f5a4c', '#3fa08a', '#7a4a2a', '#b5743a', '#2c7a68'], 160, { a: 4, rotVar: 360 }), over: { roughness: 0.42 } } },
  },
  /* ---- Elite ---- */
  {
    weapon: 'vesper',
    name: 'Wyrmscale',
    rarity: 'elite',
    float: [0, 0.6],
    value: 1.15,
    desc: 'Emerald plates, each edged in light. Shed, not made.',
    recipe: { body: { mat: 'pearl', pat: pat('scales', ['#0f6a4a', '#0a2a1e', '#7dffc0'], 110, { a: 12, rotVar: 0, rot: 90 }) }, sec: solid('matte', '#0f1512', '#1f2a25') },
  },
  {
    weapon: 'sentry',
    name: 'Golden Repair',
    rarity: 'elite',
    float: [0, 0.5],
    value: 1.2,
    desc: 'Broken once, mended with gold, and better for it.',
    recipe: { body: { mat: 'gloss', pat: pat('kintsugi', ['#101114', '#9a7420', '#ffd76a'], 230, { a: 5, rotVar: 360 }), over: { mask: GOLD } } },
  },
  {
    weapon: 'marshal',
    name: 'Cathedral',
    rarity: 'elite',
    float: [0, 0.55],
    value: 1.0,
    desc: 'Leaded panes in ruby, cobalt and amber. Best seen backlit.',
    recipe: { body: { mat: 'gloss', pat: pat('glass', ['#b3122e', '#1c4fb0', '#e0a31f', '#1f8a5a', '#6a2aa0', '#0c0c10'], 200, { a: 7, rotVar: 360 }) }, sec: solid('gloss', '#0c0c10', '#1c1c24') },
  },
  /* ---- Master ---- */
  {
    weapon: 'regent',
    name: 'Sun King',
    rarity: 'master',
    float: [0, 0.4],
    value: 1.2,
    desc: 'Engraved and gold-plated from muzzle to backstrap. Ivory to match.',
    recipe: {
      body: { mat: 'chrome', pat: pat('scroll', ['#b8862a', '#7a5510', '#ffe9a0'], 120, { a: 26, rotVar: 360 }), over: { roughness: 0.2 } },
      sec: solid('gloss', '#efe6d0', '#d9ccb0'),
      steel: { mat: 'chrome', color: '#c99a3a', over: { roughness: 0.22 } },
    },
  },
  {
    weapon: 'krait',
    name: 'Aurora Drift',
    rarity: 'master',
    float: [0, 0.5],
    value: 1.05,
    desc: 'Polar light poured over the whole rifle and left to set.',
    recipe: { body: { mat: 'pearl', pat: pat('aurora', ['#0b1030', '#19d3a5', '#5a4bff', '#ff4fb0', '#0b1030'], 400, { a: 1, rotVar: 40 }) }, sec: 'body' },
  },
];

/** Knife finishes. Each case's relic pool is one knife in every finish. */
const BLADE_FINISHES: { name: string; value: number; float: readonly [number, number]; desc: string; recipe: Recipe | null; fade?: boolean }[] = [
  { name: 'Bare Steel', value: 0.7, float: [0, 1], desc: 'Satin-ground and oiled. Nothing to hide behind.', recipe: null },
  {
    name: 'Folded Steel',
    value: 1.0,
    float: [0, 0.8],
    desc: 'Hundreds of welded layers, etched until the pattern stands up.',
    recipe: { body: { mat: 'chrome', pat: pat('damascus', ['#2a2c30', '#b9bec6'], 70, { a: 13, rotVar: 50 }), over: { roughness: 0.26 } } },
  },
  {
    name: 'Obsidian',
    value: 0.95,
    float: [0, 0.6],
    desc: 'Volcanic glass black. Reflects everything, gives nothing back.',
    recipe: { body: { mat: 'gloss', pat: pat('patina', ['#050506', '#15161b', '#0b0c10', '#23242c'], 90, { rotVar: 360 }), over: { roughness: 0.1, metalness: 0.2 } } },
  },
  {
    name: 'Meteorite',
    value: 1.1,
    float: [0, 0.9],
    desc: 'Cut from iron that fell. The crossing bands took a million years to grow.',
    recipe: { body: { mat: 'anod', pat: pat('meteorite', ['#3a3d42', '#7c8088', '#c9ced6'], 60, { rotVar: 360 }), over: { roughness: 0.3 } } },
  },
  {
    name: 'Heat Blued',
    value: 1.25,
    float: [0, 0.7],
    desc: 'Run through the flame until the steel turned every colour at once.',
    recipe: { body: { mat: 'chrome', pat: pat('patina', ['#1d2f6a', '#3a6bd0', '#8a4ad0', '#d9a441', '#6fb3e8'], 80, { a: 3, b: 2, rotVar: 360 }), over: { roughness: 0.2 } } },
  },
  {
    name: 'Bloodstone',
    value: 1.3,
    float: [0, 0.5],
    desc: 'Deep green chalcedony shot through with red. Polished, never painted.',
    recipe: { body: { mat: 'gloss', pat: pat('marble', ['#0f2a1c', '#c21a2a', '#1f5a3a'], 90, { rotVar: 360 }) } },
  },
  {
    name: 'Aurora',
    value: 1.45,
    float: [0, 0.2],
    desc: 'Interference colours that shift as the blade turns.',
    recipe: { body: { mat: 'pearl', pat: pat('aurora', ['#0f2a6a', '#19d3c5', '#7c4dff', '#ff4fb0', '#0f2a6a'], 160, { a: 1, rotVar: 60 }), over: { iridescence: 1 } } },
  },
  {
    name: 'Ember Fade',
    value: 1.6,
    float: [0, 0.12],
    desc: 'Gold at the guard, burning down through orange and rose to violet at the tip.',
    fade: true,
    recipe: { body: { mat: 'chrome', pat: pat('fade', ['#ffd24a', '#ff7a1a', '#e0245e', '#5a1a8a'], 'fit', { shift: [0.5, 0] }), over: { roughness: 0.16 } } },
  },
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

function build(): SkinDef[] {
  const out: SkinDef[] = [];
  const add = (rows: Row[], caseId: string) => {
    for (const r of rows) out.push({ ...r, id: `${r.weapon}_${slug(r.name)}`, caseId });
  };
  add(FOUNDRY, 'foundry');
  add(BLACKSITE, 'blacksite');
  add(MERIDIAN, 'meridian');
  const relics: [string, string][] = [
    ['foundry', 'kukri'],
    ['blacksite', 'karambit'],
    ['meridian', 'tanto'],
  ];
  for (const [caseId, weapon] of relics) {
    for (const f of BLADE_FINISHES) {
      out.push({ id: `${weapon}_${slug(f.name)}`, weapon, name: f.name, rarity: 'relic', caseId, float: f.float, value: f.value, desc: f.desc, recipe: f.recipe, fade: f.fade });
    }
  }
  return out;
}

export const SKIN_LIST: SkinDef[] = build();
export const SKINS: Record<string, SkinDef> = Object.fromEntries(SKIN_LIST.map((s) => [s.id, s]));
