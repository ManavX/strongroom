/**
 * The vault set: turntable pedestal, etched floor, the vault door in the back
 * wall and the practical lights. Everything is built from primitives and
 * canvas textures, in metres.
 */
import * as THREE from 'three';
import { mulberry32 } from '../noise';

export interface VaultSet {
  group: THREE.Group;
  /** Emissive accents that follow the selected case's colour. */
  accents: THREE.MeshBasicMaterial[];
  ring: THREE.MeshBasicMaterial;
  key: THREE.SpotLight;
  rimCool: THREE.SpotLight;
  rimWarm: THREE.SpotLight;
  turntable: THREE.Group;
  wheel: THREE.Group;
  dispose(): void;
}

export const PEDESTAL_R = 0.62;
export const PEDESTAL_H = 0.13;

function floorTexture(): THREE.CanvasTexture {
  const S = 2048;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const r = mulberry32(4107);
  const c = S / 2;
  ctx.fillStyle = '#17181a';
  ctx.fillRect(0, 0, S, S);
  // mottling
  for (let i = 0; i < 2600; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 20 + r() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.02 + r() * 0.05;
    g.addColorStop(0, r() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,240,220,${a * 0.5})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // plate seams: rings and spokes. The texture spans 7 m.
  const m = S / 7;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.lineWidth = 5;
  for (const rad of [0.95, 1.7, 2.6, 3.4]) {
    ctx.beginPath();
    ctx.arc(c, c, rad * m, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let ring = 0; ring < 3; ring++) {
    const r0 = [0.95, 1.7, 2.6][ring] * m;
    const r1 = [1.7, 2.6, 3.4][ring] * m;
    const n = [8, 12, 18][ring];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.19;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
      ctx.stroke();
      // bolts
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      for (const rr of [r0 + 16, r1 - 16]) {
        for (const off of [-0.03, 0.03]) {
          ctx.beginPath();
          ctx.arc(c + Math.cos(a + off * (m / rr)) * rr, c + Math.sin(a + off * (m / rr)) * rr, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  // warning band around the pedestal
  ctx.save();
  ctx.translate(c, c);
  const b0 = 0.79 * m;
  const b1 = 0.87 * m;
  const segs = 72;
  for (let i = 0; i < segs; i++) {
    if (i % 2) continue;
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    ctx.fillStyle = `rgba(214,142,34,${0.2 + r() * 0.16})`;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a0) * b0, Math.sin(a0) * b0);
    ctx.lineTo(Math.cos(a1) * b0, Math.sin(a1) * b0);
    ctx.lineTo(Math.cos(a1 + 0.05) * b1, Math.sin(a1 + 0.05) * b1);
    ctx.lineTo(Math.cos(a0 + 0.05) * b1, Math.sin(a0 + 0.05) * b1);
    ctx.closePath();
    ctx.fill();
  }
  // stencilled arc text
  ctx.fillStyle = 'rgba(226,222,212,0.2)';
  ctx.font = '700 30px "Barlow Condensed", "Arial Narrow", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = 'STRONGROOM  ·  VAULT 09  ·  AUTHORISED ACCESS ONLY  ·  STAND CLEAR OF TURNTABLE  ·  ';
  const tr = 1.3 * m;
  const step = (Math.PI * 2) / (text.length * 2.05);
  for (let rep = 0; rep < 2; rep++) {
    for (let i = 0; i < text.length; i++) {
      const a = Math.PI / 2 + rep * Math.PI + (i - text.length / 2) * step;
      ctx.save();
      ctx.rotate(a - Math.PI / 2);
      ctx.translate(0, tr);
      ctx.rotate(Math.PI);
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
  // scuffs
  ctx.lineCap = 'round';
  for (let i = 0; i < 500; i++) {
    const x = r() * S;
    const y = r() * S;
    const a = r() * Math.PI * 2;
    const len = 20 + r() * 160;
    ctx.strokeStyle = `rgba(255,255,255,${0.015 + r() * 0.04})`;
    ctx.lineWidth = 0.6 + r() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function turnedTexture(): THREE.CanvasTexture {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const c = S / 2;
  const r = mulberry32(77);
  ctx.fillStyle = '#2b2d31';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 420; i++) {
    const rad = r() * c;
    ctx.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.02 + r() * 0.05})` : `rgba(0,0,0,${0.04 + r() * 0.1})`;
    ctx.lineWidth = 0.6 + r() * 1.4;
    ctx.beginPath();
    ctx.arc(c, c, rad, 0, Math.PI * 2);
    ctx.stroke();
  }
  // degree ticks
  ctx.save();
  ctx.translate(c, c);
  for (let i = 0; i < 120; i++) {
    const major = i % 10 === 0;
    ctx.rotate((Math.PI * 2) / 120);
    ctx.fillStyle = `rgba(232,228,218,${major ? 0.6 : 0.28})`;
    ctx.fillRect(-1.5, -c * 0.965, major ? 4 : 3, major ? 30 : 15);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 6;
  for (const k of [0.88, 0.52]) {
    ctx.beginPath();
    ctx.arc(c, c, c * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function wallTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 512;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const r = mulberry32(991);
  ctx.fillStyle = '#121315';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 4; j++) {
      const x = i * (W / 16);
      const y = j * (H / 4);
      const k = 0.85 + r() * 0.3;
      ctx.fillStyle = `rgb(${18 * k},${19 * k},${21 * k})`;
      ctx.fillRect(x + 2, y + 2, W / 16 - 4, H / 4 - 4);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      for (const [bx, by] of [
        [8, 8],
        [W / 16 - 10, 8],
        [8, H / 4 - 10],
        [W / 16 - 10, H / 4 - 10],
      ]) {
        ctx.beginPath();
        ctx.arc(x + bx, y + by, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function buildVaultSet(): VaultSet {
  const group = new THREE.Group();
  group.name = 'vault-set';
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(o: T) => {
    owned.push(o);
    return o;
  };
  const accents: THREE.MeshBasicMaterial[] = [];
  const accentMat = (strength: number) => {
    const m = own(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    m.userData.strength = strength;
    accents.push(m);
    return m;
  };

  const steel = own(new THREE.MeshStandardMaterial({ color: 0x23252a, metalness: 0.9, roughness: 0.42 }));
  const darkSteel = own(new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.85, roughness: 0.5 }));
  const yFloor = -PEDESTAL_H;

  /* ---------- floor ---------- */
  const floorTex = own(floorTexture());
  const floorMat = own(new THREE.MeshStandardMaterial({ map: floorTex, color: 0x8f9298, metalness: 0.35, roughness: 0.58, envMapIntensity: 0.7 }));
  const floor = new THREE.Mesh(own(new THREE.PlaneGeometry(7, 7)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = yFloor;
  floor.receiveShadow = true;
  group.add(floor);
  const apron = new THREE.Mesh(own(new THREE.PlaneGeometry(40, 40)), own(new THREE.MeshStandardMaterial({ color: 0x0d0e10, metalness: 0.4, roughness: 0.6 })));
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = yFloor - 0.002;
  group.add(apron);

  /* ---------- pedestal / turntable ---------- */
  const turntable = new THREE.Group();
  group.add(turntable);
  const R = PEDESTAL_R;
  const profile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(R - 0.012, 0),
    new THREE.Vector2(R, -0.012),
    new THREE.Vector2(R, -0.05),
    new THREE.Vector2(R + 0.02, -0.062),
    new THREE.Vector2(R + 0.02, -0.078),
    new THREE.Vector2(R + 0.075, -0.092),
    new THREE.Vector2(R + 0.085, -PEDESTAL_H),
  ];
  const body = new THREE.Mesh(own(new THREE.LatheGeometry(profile, 96)), steel);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const topTex = own(turnedTexture());
  const top = new THREE.Mesh(own(new THREE.CircleGeometry(R - 0.012, 96)), own(new THREE.MeshStandardMaterial({ map: topTex, color: 0xd0d3d8, metalness: 0.95, roughness: 0.3, envMapIntensity: 1.1 })));
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.0006;
  top.receiveShadow = true;
  turntable.add(top);
  // light ring set into the skirt
  const ring = accentMat(2.6);
  const ringMesh = new THREE.Mesh(own(new THREE.TorusGeometry(R + 0.021, 0.0045, 8, 128)), ring);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.y = -0.07;
  group.add(ringMesh);
  const ring2 = new THREE.Mesh(own(new THREE.TorusGeometry(R + 0.086, 0.003, 6, 128)), accentMat(1.2));
  ring2.rotation.x = Math.PI / 2;
  ring2.position.y = -PEDESTAL_H + 0.006;
  group.add(ring2);

  /* ---------- back wall + vault door ---------- */
  const zWall = -4.6;
  const wallTex = own(wallTexture());
  wallTex.repeat.set(3, 2);
  const wallMat = own(new THREE.MeshStandardMaterial({ map: wallTex, color: 0x9a9da3, metalness: 0.6, roughness: 0.62 }));
  const wall = new THREE.Mesh(own(new THREE.PlaneGeometry(22, 9)), wallMat);
  wall.position.set(0, 4.5 + yFloor, zWall);
  group.add(wall);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(own(new THREE.PlaneGeometry(14, 9)), wallMat);
    side.position.set(s * 6.2, 4.5 + yFloor, zWall + 7);
    side.rotation.y = -s * Math.PI / 2;
    group.add(side);
  }

  const door = new THREE.Group();
  door.position.set(0, 1.28, zWall + 0.02);
  group.add(door);
  const DR = 1.28;
  const face = new THREE.Mesh(own(new THREE.CylinderGeometry(DR, DR, 0.3, 96)), steel);
  face.rotation.x = Math.PI / 2;
  face.position.z = 0.15;
  door.add(face);
  const frame = new THREE.Mesh(own(new THREE.TorusGeometry(DR + 0.16, 0.15, 16, 96)), darkSteel);
  frame.position.z = 0.1;
  door.add(frame);
  for (const [rad, tube] of [
    [DR - 0.14, 0.03],
    [DR * 0.66, 0.025],
    [DR * 0.36, 0.04],
  ]) {
    const t = new THREE.Mesh(own(new THREE.TorusGeometry(rad, tube, 10, 96)), darkSteel);
    t.position.z = 0.3;
    door.add(t);
  }
  const boltGeo = own(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12));
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const b = new THREE.Mesh(boltGeo, darkSteel);
    b.rotation.x = Math.PI / 2;
    b.position.set(Math.cos(a) * (DR - 0.07), Math.sin(a) * (DR - 0.07), 0.31);
    door.add(b);
  }
  const barGeo = own(new THREE.BoxGeometry(0.11, DR * 0.86, 0.06));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    const bar = new THREE.Mesh(barGeo, darkSteel);
    bar.position.set(Math.cos(a) * DR * 0.55, Math.sin(a) * DR * 0.55, 0.32);
    bar.rotation.z = a - Math.PI / 2;
    door.add(bar);
  }
  const wheel = new THREE.Group();
  wheel.position.z = 0.42;
  door.add(wheel);
  wheel.add(new THREE.Mesh(own(new THREE.TorusGeometry(0.34, 0.028, 12, 48)), steel));
  const hub = new THREE.Mesh(own(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 24)), steel);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = -0.04;
  wheel.add(hub);
  const spokeGeo = own(new THREE.CylinderGeometry(0.016, 0.016, 0.68, 8));
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Mesh(spokeGeo, steel);
    sp.rotation.z = (i / 3) * Math.PI;
    wheel.add(sp);
  }
  // halo behind the door frame and strip lights on the wall
  const halo = new THREE.Mesh(own(new THREE.TorusGeometry(DR + 0.34, 0.012, 8, 128)), accentMat(1.9));
  halo.position.z = 0.02;
  door.add(halo);
  const stripGeo = own(new THREE.BoxGeometry(0.03, 2.9, 0.02));
  for (const x of [-3.9, -2.75, 2.75, 3.9]) {
    const s = new THREE.Mesh(stripGeo, accentMat(Math.abs(x) > 3 ? 1.1 : 1.8));
    s.position.set(x, 1.28, zWall + 0.03);
    group.add(s);
  }
  // pillars for depth
  const pillarGeo = own(new THREE.BoxGeometry(0.42, 6, 0.42));
  const slitGeo = own(new THREE.BoxGeometry(0.02, 1.4, 0.43));
  for (const [x, z] of [
    [-2.7, -3.3],
    [2.7, -3.3],
    [-4.4, -1.8],
    [4.4, -1.8],
  ]) {
    const p = new THREE.Mesh(pillarGeo, darkSteel);
    p.position.set(x, 3 + yFloor, z);
    group.add(p);
    const slit = new THREE.Mesh(slitGeo, accentMat(0.9));
    slit.position.set(x, 1.25, z);
    group.add(slit);
  }
  // overhead light ring
  const halo2 = new THREE.Mesh(own(new THREE.TorusGeometry(1.25, 0.018, 8, 96)), own(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.86, 0.7).multiplyScalar(2.2), toneMapped: false })));
  halo2.rotation.x = Math.PI / 2;
  halo2.position.y = 3.3;
  group.add(halo2);
  const gantry = new THREE.Mesh(own(new THREE.TorusGeometry(1.25, 0.07, 10, 96)), darkSteel);
  gantry.rotation.x = Math.PI / 2;
  gantry.position.y = 3.37;
  group.add(gantry);

  /* ---------- lights ---------- */
  const key = new THREE.SpotLight(0xffe6c8, 95, 12, 0.52, 0.75, 1.6);
  key.position.set(-1.7, 3.5, 2.3);
  key.target.position.set(0, 0.2, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1.5;
  key.shadow.camera.far = 8;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 5;
  group.add(key, key.target);

  const rimCool = new THREE.SpotLight(0x86b4ff, 150, 12, 0.3, 0.9, 1.6);
  rimCool.position.set(2.6, 2.3, -2.7);
  rimCool.target.position.set(0, 0.42, 0);
  group.add(rimCool, rimCool.target);

  const rimWarm = new THREE.SpotLight(0xff9a44, 110, 12, 0.3, 0.9, 1.6);
  rimWarm.position.set(-2.8, 1.7, -2.3);
  rimWarm.target.position.set(0, 0.42, 0);
  group.add(rimWarm, rimWarm.target);

  group.add(new THREE.HemisphereLight(0x3a4658, 0x120c08, 0.35));

  return {
    group,
    accents,
    ring,
    key,
    rimCool,
    rimWarm,
    turntable,
    wheel,
    dispose() {
      for (const o of owned) o.dispose();
      group.removeFromParent();
    },
  };
}

/** Tint every accent emissive toward a colour. */
export function setAccent(set: VaultSet, color: THREE.ColorRepresentation, level = 1) {
  const c = new THREE.Color(color);
  for (const m of set.accents) m.color.copy(c).multiplyScalar((m.userData.strength as number) * level);
}
