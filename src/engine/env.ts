/**
 * Procedural image-based lighting.
 *
 * Reflections are what sell machined metal, so instead of shipping an HDRI the
 * app builds small "light rigs" out of emissive panels and prefilters them with
 * PMREM. Each rig is a few softboxes in a dark room, the same way a product
 * photographer would light a firearm.
 */
import * as THREE from 'three';

export type EnvPreset = 'vault' | 'studio' | 'daylight' | 'ember' | 'ice';

interface Panel {
  /** Centre position. */
  p: [number, number, number];
  /** Width, height. */
  s: [number, number];
  /** Linear colour. */
  c: [number, number, number];
  /** Intensity multiplier (HDR). */
  i: number;
  /** Optional roll around the facing axis, degrees. */
  roll?: number;
}

interface Rig {
  ambient: [number, number, number];
  floor: [number, number, number];
  panels: Panel[];
}

const RIGS: Record<EnvPreset, Rig> = {
  // Warm amber key from the left, cool rim from the right, soft top box.
  vault: {
    ambient: [0.03, 0.03, 0.034],
    floor: [0.05, 0.042, 0.034],
    panels: [
      // overhead key and a broad front-top softbox so camera-facing flats pick up a gradient
      { p: [0, 4.4, 0.4], s: [3.6, 1.8], c: [1.0, 0.94, 0.86], i: 11 },
      { p: [0.4, 3.3, 4.2], s: [5.2, 2.0], c: [1.0, 0.95, 0.9], i: 3.6 },
      // amber strip left, cool strip right
      { p: [-4.2, 1.5, 2.0], s: [0.8, 3.4], c: [1.0, 0.6, 0.24], i: 17 },
      { p: [4.4, 1.6, 0.4], s: [0.55, 3.4], c: [0.5, 0.72, 1.0], i: 13 },
      // rim strips behind
      { p: [0, 2.6, -4.6], s: [5.0, 0.3], c: [1.0, 0.74, 0.45], i: 8 },
      { p: [-3.4, 1.0, -3.4], s: [0.3, 3.0], c: [1.0, 0.7, 0.4], i: 9 },
      // low front fill and floor kicker
      { p: [0.6, 0.6, 5.0], s: [5.0, 1.6], c: [0.84, 0.9, 1.0], i: 1.3 },
      { p: [-1.2, -0.9, 3.4], s: [3.4, 0.4], c: [1.0, 0.66, 0.3], i: 2.6 },
      // pin lights for sparkle
      { p: [-2.4, 3.6, 3.0], s: [0.45, 0.45], c: [1.0, 0.96, 0.9], i: 34 },
      { p: [2.9, 3.2, 2.4], s: [0.3, 0.3], c: [1.0, 0.9, 0.8], i: 38 },
    ],
  },
  // Neutral three-softbox product studio.
  studio: {
    ambient: [0.05, 0.05, 0.052],
    floor: [0.16, 0.16, 0.16],
    panels: [
      { p: [0, 4.4, 0.4], s: [4.6, 2.6], c: [1, 1, 1], i: 8 },
      { p: [-4.4, 1.6, 1.4], s: [1.6, 3.4], c: [1, 0.98, 0.95], i: 7 },
      { p: [4.4, 1.6, 0.6], s: [1.2, 3.4], c: [0.95, 0.97, 1], i: 5 },
      { p: [0, 1.4, 5.0], s: [5.0, 2.6], c: [1, 1, 1], i: 1.6 },
      { p: [0, 1.8, -5.0], s: [6.0, 0.4], c: [1, 1, 1], i: 6 },
    ],
  },
  // Overcast sky dome feel with a low warm sun panel.
  daylight: {
    ambient: [0.22, 0.26, 0.32],
    floor: [0.12, 0.11, 0.1],
    panels: [
      { p: [0, 5.0, 0], s: [9, 9], c: [0.75, 0.86, 1.0], i: 2.4 },
      { p: [-4.6, 2.6, 2.4], s: [1.4, 1.4], c: [1.0, 0.86, 0.66], i: 40 },
      { p: [4.8, 1.4, -1.0], s: [3.0, 3.0], c: [0.8, 0.88, 1.0], i: 1.4 },
      { p: [0, 1.2, 5.0], s: [6.0, 3.0], c: [0.9, 0.94, 1.0], i: 1.2 },
    ],
  },
  // Furnace glow from below and behind.
  ember: {
    ambient: [0.012, 0.006, 0.004],
    floor: [0.05, 0.016, 0.006],
    panels: [
      { p: [-3.6, 0.8, 2.4], s: [0.9, 3.0], c: [1.0, 0.32, 0.08], i: 18 },
      { p: [3.8, 2.0, -2.0], s: [0.5, 3.2], c: [1.0, 0.5, 0.2], i: 12 },
      { p: [0, 4.2, 1.0], s: [2.4, 1.0], c: [1.0, 0.84, 0.7], i: 6 },
      { p: [0, 0.3, -4.6], s: [5.5, 0.5], c: [1.0, 0.24, 0.05], i: 9 },
      { p: [1.4, 3.2, 3.4], s: [0.3, 0.3], c: [1.0, 0.9, 0.8], i: 30 },
    ],
  },
  // Cold blue-white key with a teal kicker.
  ice: {
    ambient: [0.008, 0.012, 0.018],
    floor: [0.012, 0.018, 0.026],
    panels: [
      { p: [0, 4.2, 0.8], s: [3.6, 1.4], c: [0.82, 0.92, 1.0], i: 10 },
      { p: [-4.2, 1.6, 1.4], s: [0.5, 3.2], c: [0.45, 0.8, 1.0], i: 15 },
      { p: [4.2, 1.4, -1.6], s: [0.5, 3.2], c: [0.3, 1.0, 0.85], i: 10 },
      { p: [0, 2.2, -4.6], s: [5.0, 0.2], c: [0.7, 0.85, 1.0], i: 7 },
      { p: [2.6, 3.2, 2.6], s: [0.3, 0.3], c: [1, 1, 1], i: 32 },
    ],
  },
};

function buildRigScene(rig: Rig): THREE.Scene {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(14, 12, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(...rig.ambient), side: THREE.BackSide }),
  );
  room.position.y = 3;
  scene.add(room);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(...rig.floor) }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.6;
  scene.add(floor);

  const centre = new THREE.Vector3(0, 0.4, 0);
  for (const p of rig.panels) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(p.c[0] * p.i, p.c[1] * p.i, p.c[2] * p.i),
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p.s[0], p.s[1]), mat);
    mesh.position.set(...p.p);
    mesh.lookAt(centre);
    if (p.roll) mesh.rotateZ((p.roll * Math.PI) / 180);
    scene.add(mesh);
  }
  return scene;
}

/**
 * Builds and caches prefiltered environments for one renderer. PMREM targets
 * belong to the GL context that made them, so each renderer owns a library.
 */
export class EnvLibrary {
  private pmrem: THREE.PMREMGenerator;
  private cache = new Map<EnvPreset, THREE.WebGLRenderTarget>();

  constructor(private renderer: THREE.WebGLRenderer) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
  }

  get(preset: EnvPreset): THREE.Texture {
    let rt = this.cache.get(preset);
    if (!rt) {
      const scene = buildRigScene(RIGS[preset]);
      rt = this.pmrem.fromScene(scene, 0.035, 0.1, 40);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
      this.cache.set(preset, rt);
    }
    return rt.texture;
  }

  dispose() {
    for (const rt of this.cache.values()) rt.dispose();
    this.cache.clear();
    this.pmrem.dispose();
  }
}
