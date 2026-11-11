/**
 * Atmosphere and reveal effects: drifting dust, light shafts, spark bursts,
 * the shock ring, the light column and the lens flash.
 */
import * as THREE from 'three';
import { mulberry32 } from '../noise';
import { getDotTexture } from '../textures';

/* ------------------------------------------------------------------ */
/* Dust motes                                                          */
/* ------------------------------------------------------------------ */

export class Dust {
  points: THREE.Points;
  private mat: THREE.ShaderMaterial;

  constructor(count: number) {
    const r = mulberry32(31337);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const rad = Math.sqrt(r()) * 3.2;
      pos[i * 3] = Math.cos(a) * rad;
      pos[i * 3 + 1] = r() * 3.4 - 0.1;
      pos[i * 3 + 2] = Math.sin(a) * rad * 0.8 - 0.4;
      seed[i * 4] = r();
      seed[i * 4 + 1] = r();
      seed[i * 4 + 2] = r();
      seed[i * 4 + 3] = r();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uColor: { value: new THREE.Color(1.0, 0.82, 0.62) }, uGlow: { value: new THREE.Color(0, 0, 0) }, uTex: { value: getDotTexture() } },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime;
        uniform float uScale;
        varying float vA;
        varying float vCore;
        void main() {
          vec3 p = position;
          float t = uTime * (0.25 + aSeed.x * 0.5);
          p.x += sin(t * 0.7 + aSeed.y * 6.283) * 0.18;
          p.z += cos(t * 0.5 + aSeed.z * 6.283) * 0.18;
          p.y = mod(p.y + uTime * (0.012 + aSeed.w * 0.03), 3.4) - 0.1;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = -mv.z;
          gl_PointSize = uScale * (1.6 + aSeed.x * 3.4) / max(d, 0.2);
          // brighter inside the light column above the pedestal, fading with depth
          float col = exp(-dot(p.xz, p.xz) * 0.9);
          vCore = col;
          float tw = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed.y * 1.6) + aSeed.z * 20.0);
          vA = (0.1 + col * 0.5) * tw * smoothstep(0.3, 1.2, d) * (1.0 - smoothstep(4.5, 7.5, d));
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        uniform vec3 uColor;
        uniform vec3 uGlow;
        varying float vA;
        varying float vCore;
        void main() {
          float a = texture2D(uTex, gl_PointCoord).r * vA;
          gl_FragColor = vec4((uColor + uGlow * vCore * 3.0) * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  update(time: number, pixelHeight: number) {
    this.mat.uniforms.uTime.value = time;
    this.mat.uniforms.uScale.value = pixelHeight / 260;
  }

  /** Tint the motes near the pedestal (used while a case is glowing). */
  setGlow(color: THREE.ColorRepresentation, strength: number) {
    (this.mat.uniforms.uGlow.value as THREE.Color).set(color).multiplyScalar(strength);
  }

  dispose() {
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Light shafts                                                        */
/* ------------------------------------------------------------------ */

const SHAFT_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  varying float vH;
  varying vec3 vW;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    vH = uv.y;
    vW = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * mv;
  }`;

const SHAFT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  uniform float uTime;
  uniform float uTop;
  varying vec3 vN;
  varying vec3 vV;
  varying float vH;
  varying vec3 vW;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float soft = pow(clamp(facing, 0.0, 1.0), 2.2);
    float hh = clamp(vH, 0.0, 1.0);
    float fall = mix(pow(1.0 - hh, 1.6), pow(hh, 1.3), uTop);
    // world-space noise: no seam where the angle wraps
    float n = 0.65 + 0.35 * noise(vec2(vW.x * 3.1 + vW.z * 2.3, vW.y * 1.5 - uTime * 0.12));
    float a = soft * fall * n * uStrength;
    gl_FragColor = vec4(uColor * a, a);
  }`;

export interface Shaft {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  set(color: THREE.ColorRepresentation, strength: number): void;
}

/**
 * A cone of light. `top` true = bright at the top (ceiling spot),
 * false = bright at the base (light rising out of the case).
 */
export function createShaft(rTop: number, rBottom: number, height: number, top: boolean): Shaft {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, height, 48, 1, true);
  geo.translate(0, height / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(1, 0.85, 0.65) }, uStrength: { value: 0 }, uTime: { value: 0 }, uTop: { value: top ? 1 : 0 } },
    vertexShader: SHAFT_VERT,
    fragmentShader: SHAFT_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 4;
  mesh.frustumCulled = false;
  return {
    mesh,
    set(color, strength) {
      (mat.uniforms.uColor.value as THREE.Color).set(color);
      mat.uniforms.uStrength.value = strength;
      mesh.visible = strength > 0.002;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Sparks                                                              */
/* ------------------------------------------------------------------ */

export class Sparks {
  points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private max: number;
  private cursor = 0;
  private alive = 0;
  private mat: THREE.ShaderMaterial;

  constructor(max = 700) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max * 2); // remaining, total
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1 }, uTex: { value: getDotTexture() } },
      vertexShader: /* glsl */ `
        attribute vec4 aCol;
        attribute float aSize;
        uniform float uScale;
        varying vec4 vCol;
        void main() {
          vCol = aCol;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uScale * aSize / max(-mv.z, 0.2);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        varying vec4 vCol;
        void main() {
          float a = texture2D(uTex, gl_PointCoord).r * vCol.a;
          gl_FragColor = vec4(vCol.rgb * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }

  /** Emit a burst. `up` biases velocity upward (0 = sphere, 1 = fountain). */
  burst(origin: THREE.Vector3, color: THREE.ColorRepresentation, count: number, speed: number, up = 0.5, life = 1.4, size = 9) {
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const sp = speed * (0.25 + Math.random() * Math.random() * 1.2);
      this.pos[i * 3] = origin.x + (Math.random() - 0.5) * 0.05;
      this.pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.03;
      this.pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.05;
      this.vel[i * 3] = Math.cos(a) * s * sp;
      this.vel[i * 3 + 1] = (u * (1 - up) + up * (0.5 + Math.random())) * sp;
      this.vel[i * 3 + 2] = Math.sin(a) * s * sp;
      const l = life * (0.45 + Math.random() * 0.8);
      this.life[i * 2] = l;
      this.life[i * 2 + 1] = l;
      const hot = 0.6 + Math.random() * 0.8;
      this.col[i * 4] = c.r * hot + 0.25 * Math.random();
      this.col[i * 4 + 1] = c.g * hot + 0.2 * Math.random();
      this.col[i * 4 + 2] = c.b * hot + 0.15 * Math.random();
      this.col[i * 4 + 3] = 1;
      this.size[i] = size * (0.4 + Math.random() * 1.2);
    }
    this.alive = this.max;
  }

  update(dt: number, pixelHeight: number) {
    if (!this.alive) {
      this.points.visible = false;
      return;
    }
    this.points.visible = true;
    this.mat.uniforms.uScale.value = pixelHeight / 260;
    let alive = 0;
    const drag = Math.exp(-1.5 * dt);
    for (let i = 0; i < this.max; i++) {
      const l = this.life[i * 2];
      if (l <= 0) {
        this.col[i * 4 + 3] = 0;
        continue;
      }
      alive++;
      this.vel[i * 3] *= drag;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag - 1.1 * dt;
      this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.002 && this.vel[i * 3 + 1] < 0) {
        this.pos[i * 3 + 1] = 0.002;
        this.vel[i * 3 + 1] *= -0.35;
      }
      const nl = l - dt;
      this.life[i * 2] = nl;
      const k = Math.max(0, nl / this.life[i * 2 + 1]);
      this.col[i * 4 + 3] = k * k * (0.7 + 0.3 * Math.sin(nl * 40 + i));
    }
    this.alive = alive;
    const g = this.points.geometry;
    g.getAttribute('position').needsUpdate = true;
    g.getAttribute('aCol').needsUpdate = true;
    g.getAttribute('aSize').needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Shock ring + flash                                                  */
/* ------------------------------------------------------------------ */

export interface Ring {
  mesh: THREE.Mesh;
  /** t 0..1 progress. */
  set(color: THREE.ColorRepresentation, t: number, maxRadius: number): void;
}

export function createRing(): Ring {
  const geo = new THREE.RingGeometry(0.86, 1, 96, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float band = smoothstep(0.86, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
        float a = band * uAlpha;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  mesh.renderOrder = 4;
  return {
    mesh,
    set(color, t, maxRadius) {
      if (t <= 0 || t >= 1) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const e = 1 - Math.pow(1 - t, 3);
      mesh.scale.setScalar(0.1 + e * maxRadius);
      (mat.uniforms.uColor.value as THREE.Color).set(color).multiplyScalar(3);
      mat.uniforms.uAlpha.value = (1 - t) * (1 - t);
    },
  };
}

export interface Flash {
  sprite: THREE.Sprite;
  set(color: THREE.ColorRepresentation, strength: number, size: number): void;
}

export function createFlash(): Flash {
  const mat = new THREE.SpriteMaterial({ map: getDotTexture(), color: 0xffffff, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const sprite = new THREE.Sprite(mat);
  sprite.visible = false;
  sprite.renderOrder = 7;
  const c = new THREE.Color();
  return {
    sprite,
    set(color, strength, size) {
      sprite.visible = strength > 0.003;
      c.set(color).lerp(new THREE.Color(1, 1, 1), 0.35);
      mat.color.copy(c).multiplyScalar(strength * 2.2);
      sprite.scale.setScalar(size);
    },
  };
}
