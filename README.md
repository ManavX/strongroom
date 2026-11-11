# Strongroom

A browser-based case-opening simulator with a persistent inventory and real-time 3D inspection.

**Live demo: https://cases.manav.world**

Strongroom is a simulation. Credits are play money: they cannot be bought, sold, transferred or cashed out. Every weapon, case and finish is an original design generated in code. Nothing is downloaded at runtime and there are no third-party art or audio assets.

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:5183
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build locally
```

Requires Node 20+ and a browser with WebGL 2.

## Hosting

The site is fully static: there is no server code, and each visitor's progress is stored in
their own browser. It is hosted on Vercel at https://cases.manav.world and redeploys when
`main` is pushed. Any static host works: build with `npm run build` and serve `dist/`.

## What is in it

- **Three cases, 75 finishes.** 51 gun finishes across eight firearms, plus eight blade finishes for each of three knives. Five rarities with published odds (79.92% / 15.98% / 3.2% / 0.64% / 0.26%).
- **Opening sequence.** Latches pop, the lid cracks, a reel decelerates onto the drop, then the case throws open. Relic drops get their own build-up.
- **Per-item wear and pattern.** Each drop rolls a wear float and a pattern seed. Wear is rendered, not labelled: edges chip first, then scratches, then patches, with primer rings and rust.
- **Tally variants.** One drop in ten carries a counter module on the weapon. Test-firing in the inspector increments it.
- **Inventory.** Search, filter by rarity / type / case, seven sort orders, favourites (protected from sale), multi-select selling.
- **Inspector and photo mode.** Rotate, zoom, test fire, five lighting rigs, 2x PNG export with an optional name plate.
- **Trade-up contracts.** Ten items of one rarity for one of the next, with outcome odds shown before you sign.
- **Collection and records.** Every finish with discovery state, lifetime stats, your luck against the published odds, and an opening log.
- **Economy.** 2,500 starting credits, 250 per case, sell-back at item value. A free resupply is always available when you cannot afford a case, otherwise every three minutes.

## Controls

| Where | Input | Action |
| --- | --- | --- |
| Vault | Space / Enter | Unlock the case (or open another from the result) |
| Vault | Left / Right | Switch case |
| Vault | Drag | Turn the case |
| Reel | Click / Space | Skip to the result |
| Inspector | Drag, scroll / pinch | Rotate, zoom |
| Inspector | F | Test fire (flourish for blades) |
| Inspector | P | Photo mode |
| Anywhere | M | Mute |
| Anywhere | Esc | Back |

## How it is built

Vite, React 19, TypeScript, three.js with `postprocessing`, zustand, gsap. State is saved to IndexedDB.

```
src/
  data/        rarities, weapons, the skin catalogue, cases     <- tune content here
  core/        drop rolls, valuation, contracts, resupply rules
  state/       persistent game store and ephemeral UI store
  engine/
    models/    hard-surface kit (kit.ts) and one file per weapon, authored in mm
    materials/ the surface shader: coating over substrate, wear from curvature + noise
    finishes/  procedural skin patterns (canvas) and the recipe -> material resolver
    stage/     the vault set, camera and spin rigs, effects, the opening choreography
    Engine.ts  renderer, post chain, adaptive quality, input
    thumbs.ts  off-screen 3D thumbnails for every item
  audio/       all sound, synthesised with Web Audio
  ui/          React views and components
  lab/         dev-only model and material viewer
```

A few decisions worth knowing about:

- **Geometry is code.** Weapons are built from filleted, bevelled plates, lathes and lofts with area-weighted normals. Adding a weapon means adding one file under `engine/models` and registering it in `registry.ts`.
- **One surface shader.** Every part is a coating over a substrate. Edge wear comes from screen-space curvature, so it needs no baked maps. Skins are projected in weapon space, so one texture wraps a whole weapon.
- **One stage.** The vault, the opening, the inspector and the backdrop behind the menus are all the same scene with different camera shots. The player spins the subject; the camera only frames.
- **Thumbnails are real renders** of the actual item (skin, wear, seed, Tally), produced off-screen and cached.
- **Quality adapts.** Rendering is capped at 60 fps and at a pixel budget per tier. `auto` watches frame time, scales resolution, steps between low / medium / high, and stays off High on integrated GPUs. High adds depth of field.

## Dev tools

`lab.html` (dev server only) renders any model or skin from query parameters:

```
/lab.html?w=krait&wear=0.3&views=side,hero
/lab.html?looks=skin:krait_magma_vein,skin:krait_bengal&views=side,side
/lab.html?ws=sentry,magnate,regent&views=hero,hero,hero
```

`tools/shot.mjs` captures a page with a local Chrome for visual review:

```bash
node tools/shot.mjs "/lab.html?w=marshal&look=poly&views=side,hero" out.png 1600 1000
```

Set `SHOT_EVAL` to run JavaScript in the page first; dev builds expose `window.__sr` (`ui`, `game`, `engine`).
