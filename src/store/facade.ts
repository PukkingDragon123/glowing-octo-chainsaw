import * as THREE from 'three';
import { toonGradient } from '../engine/voxel';
import { Painter } from '../engine/Painter';
import { FONT_BIG } from '../engine/pixelFont';
import { LAYER_NO_OUTLINE } from '../engine/PixelRenderer';
import { Bitmap, ellipse, hex, pixelTexture } from '../art/pixel';
import { spriteMesh } from '../art/spriteMesh';
import { drawLogo, BRAND } from '../art/brand';
import { buddyPortrait } from '../art/buddy';
import { CAST } from '../art/cast';
import { Kit, PAL } from './kit';
import { STORE } from './layout';

/** The storefront seen from the street: awning, sign, glass doors, posters, sky. */

export interface Facade {
  group: THREE.Group;
  doors: THREE.Object3D[];
  bulbs: THREE.Mesh[];
  clouds: THREE.Object3D[];
  sign: THREE.Object3D;
}

function toon(color: string, map?: THREE.Texture) {
  return new THREE.MeshToonMaterial({ color, map: map ?? null, gradientMap: toonGradient() });
}

/** Pink and white striped awning strip with a scalloped hem. */
function awningCanvas(w: number) {
  const H = 28;
  const b = new Bitmap(w, H);
  const pink = hex(BRAND.pink);
  const white = hex('#ffffff');
  const pinkD = hex(BRAND.pinkDark);
  const stripe = 10;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < w; x++) {
      const band = Math.floor(x / stripe) % 2 === 0;
      const r = stripe / 2;
      const local = (x % stripe) - r + 0.5;
      const hem = y - 18;
      if (hem > 0 && local * local + (hem - 0) * (hem - 0) * 1.2 > r * r) continue;
      b.set(x, y, band ? pink : white);
      if (y === 18 && band) b.set(x, y, pinkD);
    }
  b.outline('#2a1c22');
  return b.toCanvas();
}

/** The big sign: logo mark + XOLOTL KOBINI in chunky pixel letters, with marquee bulbs. */
function signCanvas() {
  const p = new Painter(220, 40);
  p.roundRect(0, 0, 220, 40, 8, '#2a1c22');
  p.roundRect(2, 2, 216, 36, 7, '#ffffff');
  p.roundRect(4, 4, 212, 32, 6, '#fff6ef');
  const logo = drawLogo(28, { badge: true }).toCanvas();
  const w1 = p.textWidth('XOLOTL', { font: FONT_BIG, scale: 2, spacing: 1 });
  const w2 = p.textWidth('KOBINI', { font: FONT_BIG, scale: 2, spacing: 1 });
  const total = 28 + 8 + w1 + 10 + w2;
  const x0 = Math.round((220 - total) / 2);
  p.ctx.drawImage(logo, x0, 6);
  p.text('XOLOTL', x0 + 36, 13, { font: FONT_BIG, scale: 2, color: BRAND.pink, shadow: BRAND.pinkDark, shadowOffset: [1, 1], spacing: 1 });
  p.text('KOBINI', x0 + 36 + w1 + 10, 13, { font: FONT_BIG, scale: 2, color: '#5fb3a1', shadow: '#3f8a7a', shadowOffset: [1, 1], spacing: 1 });
  return p.canvas;
}

function cloudSprite() {
  const w = 64;
  const h = 26;
  const b = new Bitmap(w, h);
  const m = ellipse(w, h, 20, 16, 13, 8).union(ellipse(w, h, 34, 12, 14, 10)).union(ellipse(w, h, 47, 16, 12, 7)).union(ellipse(w, h, 32, 19, 26, 6));
  b.paint(m, '#fff4f4');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m.get(x, y) && !m.get(x, y + 2)) b.set(x, y, hex('#f6c8d6'));
  return b.toCanvas();
}

function skyTexture() {
  const p = new Painter(4, 64);
  const stops = ['#6d7fd6', '#8f89dc', '#c49be0', '#f2a6c8', '#ffc1b0', '#ffd9a8', '#ffe9c2'];
  for (let i = 0; i < 64; i++) p.rect(0, i, 4, 1, stops[Math.min(stops.length - 1, Math.floor((i / 64) * stops.length))]);
  return p.texture();
}

export function buildFacade(): Facade {
  const g = new THREE.Group();
  const z = STORE.frontZ;
  const x0 = -9;
  const x1 = 7;
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  const H = 3.6;
  const k = new Kit();

  // sky + distant city
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(90, 30), new THREE.MeshBasicMaterial({ map: skyTexture() }));
  sky.position.set(cx, 8, -12);
  sky.layers.set(LAYER_NO_OUTLINE);
  g.add(sky);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), new THREE.MeshBasicMaterial({ color: '#fff0c2' }));
  sun.position.set(cx + 9, 6.2, -11.8);
  sun.layers.set(LAYER_NO_OUTLINE);
  g.add(sun);
  const clouds: THREE.Object3D[] = [];
  for (let i = 0; i < 6; i++) {
    const c = spriteMesh(cloudSprite(), { ppu: 18 + (i % 3) * 4, anchor: [0.5, 0.5], doubleSided: true });
    c.position.set(cx - 22 + i * 8.5, 7 + (i % 3) * 1.4, -11.5);
    c.layers.set(LAYER_NO_OUTLINE);
    c.userData.speed = 0.15 + (i % 3) * 0.08;
    clouds.push(c);
    g.add(c);
  }
  // neighbouring pastel buildings
  const hood = [
    [x0 - 4.2, 5.2, '#bfe3d4', 3.8],
    [x1 + 3.8, 4.6, '#ffd8b5', 3.4],
    [x0 - 8.6, 6.4, '#d7c9f2', 3.2],
    [x1 + 8, 5.8, '#ffc7d6', 3.8],
  ] as const;
  for (const [bx, bh, col, bw] of hood) {
    k.rbox(bw, bh, 3, 0.18, col, bx, 0, z - 1.8);
    for (let wy = 1.2; wy < bh - 0.6; wy += 1.1) for (const wx of [-bw / 4, bw / 4]) k.rbox(0.62, 0.72, 0.06, 0.06, '#fff2c9', bx + wx, wy, z - 0.28);
  }

  // store front wall around windows and door
  k.rbox(w, 0.35, 0.3, 0.08, PAL.white, cx, 0, z);
  k.rbox(w, 0.5, 0.36, 0.1, PAL.white, cx, H - 0.5, z);
  for (const px of [x0 + 0.15, STORE.doorX - 1.05, STORE.doorX + 1.05, x1 - 0.15]) k.rbox(0.3, H, 0.34, 0.1, PAL.white, px, 0, z);
  k.rbox(w + 0.4, 0.2, 0.5, 0.08, PAL.pinkLight, cx, H, z);
  // window sills with flower boxes
  for (const [a, b] of [
    [x0 + 0.3, STORE.doorX - 1.2],
    [STORE.doorX + 1.2, x1 - 0.3],
  ]) {
    k.rbox(b - a, 0.2, 0.36, 0.06, PAL.mintDark, (a + b) / 2, 0.35, z + 0.25);
    for (let fx = a + 0.2; fx < b - 0.1; fx += 0.3) k.sphere(0.1, ['#ff8fb1', '#ffd66b', '#ffffff'][Math.round(fx * 7) % 3], fx, 0.62, z + 0.3, 0.8);
  }
  // sidewalk + street
  k.rbox(w + 16, 0.1, 5, 0.03, '#e9e2d7', cx, -0.115, z + 2.5);
  k.rbox(w + 16, 0.12, 0.3, 0.05, '#cfc6b8', cx, -0.08, z + 5);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(60, 12), new THREE.MeshBasicMaterial({ color: '#6c6a86' }));
  street.rotation.x = -Math.PI / 2;
  street.position.set(cx, -0.08, z + 11);
  g.add(street);
  for (let sx = cx - 26; sx < cx + 26; sx += 3) k.rbox(1.4, 0.02, 0.18, 0.02, '#f6efe0', sx, -0.07, z + 9);
  // bench + lamp posts
  k.rbox(1.6, 0.08, 0.45, 0.04, PAL.woodDark, x1 - 1.6, 0.42, z + 1.6);
  k.rbox(1.6, 0.35, 0.08, 0.04, PAL.woodDark, x1 - 1.6, 0.52, z + 1.4);
  for (const lx of [x1 - 2.3, x1 - 0.9]) k.rbox(0.08, 0.42, 0.4, 0.03, '#5b6475', lx, 0, z + 1.6);
  for (const lx of [x0 - 0.8, x1 + 0.9]) {
    k.cyl(0.06, 0.08, 3.4, '#5b6475', lx, 0, z + 3.2, 10);
    k.sphere(0.24, '#fff3c4', lx, 3.55, z + 3.2, 1, new THREE.MeshBasicMaterial({ color: '#fff3c4' }));
  }
  g.add(k.build());

  // glass: windows and the sliding doors
  const glassMat = new THREE.MeshBasicMaterial({ color: '#dff3ff', transparent: true, opacity: 0.18, depthWrite: false });
  const winL = new THREE.Mesh(new THREE.PlaneGeometry(STORE.doorX - 1.2 - x0 - 0.3, 2.6), glassMat);
  winL.position.set((x0 + 0.3 + STORE.doorX - 1.2) / 2, 0.35 + 1.4, z + 0.05);
  const winR = new THREE.Mesh(new THREE.PlaneGeometry(x1 - 0.3 - (STORE.doorX + 1.2), 2.6), glassMat);
  winR.position.set((STORE.doorX + 1.2 + x1 - 0.3) / 2, 0.35 + 1.4, z + 0.05);
  for (const m of [winL, winR]) {
    m.layers.set(LAYER_NO_OUTLINE);
    m.renderOrder = 2;
    g.add(m);
  }
  // mascot posters in the windows
  const posters: [string, number, number][] = [
    ['captain', x0 + 1.6, 1.6],
    ['drops', STORE.doorX - 2.4, 1.7],
    ['fizzy', STORE.doorX + 2.4, 1.6],
    ['oni', x1 - 1.6, 1.7],
  ];
  for (const [id, px, py] of posters) {
    const spec = CAST[id];
    if (!spec) continue;
    const art = buddyPortrait(spec, { armR: 2.5, mouth: 'open' });
    const p = new Painter(art.w + 12, art.h + 16);
    p.roundRect(0, 0, p.w, p.h, 4, '#2a1c22');
    p.roundRect(1, 1, p.w - 2, p.h - 2, 3, id === 'captain' ? '#ffe7a3' : id === 'drops' ? '#ffd6e6' : id === 'fizzy' ? '#d6f0ff' : '#dff6e8');
    p.ctx.drawImage(art.toCanvas(), 6, 8);
    const poster = spriteMesh(p.canvas, { ppu: 64, anchor: [0.5, 0.5], doubleSided: true });
    poster.position.set(px, py, z + 0.02);
    g.add(poster);
  }
  // doors (two sliding glass panels with pink frames and the logo)
  const doors: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const door = new THREE.Group();
    const dk = new Kit();
    dk.rbox(1.0, 0.1, 0.06, 0.03, BRAND.pink, 0, 0, 0);
    dk.rbox(1.0, 0.1, 0.06, 0.03, BRAND.pink, 0, 2.5, 0);
    dk.rbox(0.08, 2.6, 0.06, 0.03, BRAND.pink, -0.46, 0, 0);
    dk.rbox(0.08, 2.6, 0.06, 0.03, BRAND.pink, 0.46, 0, 0);
    door.add(dk.build());
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 2.42), glassMat);
    pane.position.y = 1.3;
    pane.layers.set(LAYER_NO_OUTLINE);
    pane.renderOrder = 2;
    door.add(pane);
    if (side === -1) {
      const decal = spriteMesh(drawLogo(32, { badge: true, round: true }).toCanvas(), { ppu: 32 / 0.5, anchor: [0.5, 0.5], doubleSided: true });
      decal.position.set(0.3, 1.45, 0.035);
      door.add(decal);
    }
    const closedX = STORE.doorX + side * 0.5;
    door.position.set(closedX, 0.35, z + 0.02);
    door.userData.closedX = closedX;
    door.userData.openX = closedX + side * 0.95;
    doors.push(door);
    g.add(door);
  }
  // awning
  const aw = awningCanvas(Math.round(w * 22));
  const awMesh = spriteMesh(aw, { ppu: 22, anchor: [0.5, 1], doubleSided: true });
  awMesh.position.set(cx, H - 0.35, z + 0.45);
  awMesh.rotation.x = -0.55;
  g.add(awMesh);
  // sign with marquee bulbs
  const signTex = pixelTexture(signCanvas());
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2 * 40 / 220), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(STORE.doorX, H + 1.0, z + 0.28);
  g.add(sign);
  const sk = new Kit();
  sk.rbox(7.5, 1.7, 0.3, 0.2, PAL.pink, STORE.doorX, H + 0.15, z + 0.1);
  g.add(sk.build());
  const bulbs: THREE.Mesh[] = [];
  const bulbGeo = new THREE.SphereGeometry(0.055, 8, 6);
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    const per = 2 * (7.5 + 1.7);
    let d = t * per;
    let bx: number;
    let by: number;
    if (d < 7.5) {
      bx = -3.75 + d;
      by = 1.7;
    } else if ((d -= 7.5) < 1.7) {
      bx = 3.75;
      by = 1.7 - d;
    } else if ((d -= 1.7) < 7.5) {
      bx = 3.75 - d;
      by = 0;
    } else {
      d -= 7.5;
      bx = -3.75;
      by = d;
    }
    const bulb = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: '#fff3a8' }));
    bulb.position.set(STORE.doorX + bx, H + 0.15 + by, z + 0.27);
    bulb.layers.set(LAYER_NO_OUTLINE);
    bulbs.push(bulb);
    g.add(bulb);
  }
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.layers.isEnabled(1)) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return { group: g, doors, bulbs, clouds, sign };
}

export { toon };
