import * as THREE from 'three';
import { Batcher, paintGeometry, toonMat } from '../engine/batch';
import { Painter, shade } from '../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../engine/pixelFont';
import { LAYER_NO_OUTLINE } from '../engine/PixelRenderer';
import { VoxelGrid, voxelMesh, toonGradient } from '../engine/voxel';
import { rng } from '../engine/tween';
import { STORE } from './fixtures';

const INK = '#1d1b26';

function logoSignTexture() {
  const probe = new Painter(4, 4);
  const tw = probe.textWidth('QR MARKET', { font: FONT_BIG, scale: 2, bold: true });
  const p = new Painter(tw + 36, 22);
  p.clear('#141b2d');
  // QR-ish icon
  p.rect(5, 3, 16, 16, '#ffd23f');
  p.rect(7, 5, 5, 5, INK).rect(14, 5, 5, 5, INK).rect(7, 12, 5, 5, INK).rect(14, 13, 3, 3, INK);
  p.text('QR MARKET', 27, 4, { font: FONT_BIG, scale: 2, bold: true, color: '#ffffff', shadow: '#ff5d73', shadowOffset: [1, 1] });
  return { tex: p.texture(), aspect: p.w / p.h };
}

function neonOpenTexture() {
  const p = new Painter(40, 14);
  p.clear('#1d1b26');
  p.text('OPEN 24H', 20, 3, { font: FONT_BIG, color: '#ff5d8f', align: 'center' });
  return p.texture();
}

function scooter() {
  const g = new VoxelGrid(22, 14, 8);
  const body = '#2ec4b6';
  g.cylinder(4, 4, 0, 1, 3, INK);
  g.box(2, 0, 3, 6, 6, 4, INK);
  g.box(15, 0, 3, 19, 6, 4, INK);
  g.box(3, 2, 3, 5, 4, 4, '#adb5bd');
  g.box(16, 2, 3, 18, 4, 4, '#adb5bd');
  g.box(5, 5, 2, 17, 7, 5, body);
  g.box(14, 7, 2, 18, 9, 5, body);
  g.box(8, 8, 2, 13, 9, 5, '#3d405b');
  g.box(18, 9, 3, 18, 13, 4, '#adb5bd');
  g.box(16, 13, 1, 20, 13, 6, INK);
  g.box(19, 10, 3, 20, 11, 4, '#ffd23f');
  return voxelMesh(g, { scale: 0.06 });
}

function lampPost() {
  const g = new VoxelGrid(8, 64, 4);
  g.box(3, 0, 1, 4, 60, 2, '#3d405b');
  g.box(0, 58, 0, 7, 59, 3, '#3d405b');
  g.box(0, 55, 1, 2, 57, 2, '#ffe8a3');
  return voxelMesh(g, { scale: 0.06 });
}

export interface Facade {
  group: THREE.Group;
  doors: THREE.Object3D[];
  neon: THREE.Mesh;
  lamp: THREE.PointLight;
}

/** Storefront, sidewalk and street for the walk-in intro (behind the camera once inside). */
export function buildFacade(): Facade {
  const group = new THREE.Group();
  const z = STORE.frontZ;
  const x0 = STORE.xMin;
  const x1 = STORE.xMax;
  const W = x1 - x0;
  const cx = (x0 + x1) / 2;
  const b = new Batcher();
  const wall = '#f7f4ec';
  const H = STORE.ceilingY;
  // fascia band with stripes
  b.box(W, 0.9, 0.3, '#2ec4b6', cx, H, z);
  b.box(W, 0.14, 0.32, '#ffd23f', cx, H - 0.14, z);
  b.box(W, 0.12, 0.32, '#ff5d73', cx, H - 0.26, z);
  // wall pieces between windows / door
  const pillars = [x0, -4.2, -1.1, 1.1, 4.2, 8.5, 13, 18, 24, 30, 36, x1];
  for (const px of pillars) b.box(0.4, H, 0.3, wall, px, 0, z);
  // kick panel under windows
  b.box(W, 0.45, 0.28, '#3d405b', cx, 0, z);
  b.box(W, 0.08, 0.3, wall, cx, 0.45, z);
  // transom above windows/door
  b.box(W, 0.25, 0.28, wall, cx, H - 0.5, z);
  // door frame
  b.box(2.2, 0.12, 0.34, '#2b2d42', 0, 2.35, z);
  b.box(0.12, 2.4, 0.34, '#2b2d42', -1.1, 0, z);
  b.box(0.12, 2.4, 0.34, '#2b2d42', 1.1, 0, z);
  // sidewalk + curb + street
  b.box(W, 0.08, 3.2, '#c9c6bd', cx, -0.08, z + 1.7);
  b.box(W, 0.14, 0.2, '#e9e5dc', cx, -0.14, z + 3.3);
  b.box(W, 0.02, 14, '#2b2d42', cx, -0.16, z + 10.4);
  group.add(b.build());
  // sidewalk tile lines
  const tiles = new Painter(16, 16);
  tiles.clear('#c9c6bd');
  tiles.rect(0, 0, 16, 1, '#b3afa4').rect(0, 0, 1, 16, '#b3afa4');
  const tt = tiles.texture(true);
  tt.repeat.set(W / 0.8, 3.2 / 0.8);
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(W, 3.2), new THREE.MeshToonMaterial({ map: tt, gradientMap: toonGradient() }));
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(cx, 0.001, z + 1.7);
  walk.receiveShadow = true;
  group.add(walk);
  // road dashes
  const dash = new Batcher();
  for (let x = x0; x < x1; x += 1.6) dash.box(0.8, 0.01, 0.1, '#ffd23f', x, -0.14, z + 7.5);
  group.add(dash.build({ castShadow: false }));

  // window glass (see-through into the lit store)
  const glassMat = new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.14, depthWrite: false });
  for (let i = 0; i < pillars.length - 1; i++) {
    const a = pillars[i] + 0.2;
    const c = pillars[i + 1] - 0.2;
    if (a > -1.2 && c < 1.2) continue;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(c - a, H - 1.2), glassMat);
    g.position.set((a + c) / 2, 0.53 + (H - 1.2) / 2, z + 0.05);
    g.layers.set(LAYER_NO_OUTLINE);
    group.add(g);
  }
  // sliding doors
  const doors: THREE.Object3D[] = [];
  const dm = new THREE.MeshBasicMaterial({ color: '#bfe9ff', transparent: true, opacity: 0.2, depthWrite: false });
  for (const s of [-1, 1]) {
    const d = new THREE.Group();
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.3), dm);
    pane.position.y = 1.15;
    pane.layers.set(LAYER_NO_OUTLINE);
    const frame = new Batcher();
    frame.box(1.04, 0.06, 0.05, '#2b2d42', 0, 0, 0);
    frame.box(1.04, 0.06, 0.05, '#2b2d42', 0, 2.26, 0);
    frame.box(0.05, 2.3, 0.05, '#2b2d42', s * -0.5, 0, 0);
    frame.box(0.04, 0.4, 0.05, '#adb5bd', s * -0.4, 0.9, 0.04);
    d.add(pane, frame.build());
    d.position.set(s * 0.52, 0, z + 0.08);
    d.userData.closedX = s * 0.52;
    d.userData.openX = s * 1.55;
    group.add(d);
    doors.push(d);
    // door sticker
    const st = new Painter(18, 18);
    st.disc(9, 9, 8, '#ffd23f');
    st.text('PUSH', 9, 3, { font: FONT_TINY, color: INK, align: 'center' });
    st.text('NO', 9, 10, { font: FONT_TINY, color: INK, align: 'center' });
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: st.texture(), transparent: true, alphaTest: 0.5 }));
    sticker.position.set(0, 1.4, 0.01);
    sticker.visible = false;
    d.add(sticker);
  }

  // big logo sign
  const sign = logoSignTexture();
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.8 * sign.aspect, 0.8), new THREE.MeshBasicMaterial({ map: sign.tex, toneMapped: false }));
  logo.position.set(0, H + 0.45, z + 0.17);
  group.add(logo);
  // neon OPEN sign in a window
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.38), new THREE.MeshBasicMaterial({ map: neonOpenTexture(), toneMapped: false }));
  neon.position.set(-2.6, 2.1, z + 0.07);
  group.add(neon);
  // posters in windows
  const poster = new Painter(24, 32);
  poster.clear('#6f4ef2');
  poster.text('NEW', 12, 3, { font: FONT_TINY, color: '#ffd23f', align: 'center' });
  poster.rect(5, 10, 14, 14, '#ffffff');
  poster.rect(7, 12, 4, 4, INK).rect(13, 12, 4, 4, INK).rect(7, 18, 4, 4, INK).rect(14, 19, 2, 2, INK);
  poster.text('SCAN', 12, 26, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), new THREE.MeshBasicMaterial({ map: poster.texture() }));
  pm.position.set(2.7, 1.4, z + 0.07);
  group.add(pm);

  const sc = scooter();
  sc.position.set(-3.2, 0, z + 2.3);
  sc.rotation.y = 0.35;
  group.add(sc);
  const lp = lampPost();
  lp.position.set(4.6, 0, z + 2.9);
  group.add(lp);
  const lamp = new THREE.PointLight('#ffd89c', 6, 7, 1.6);
  lamp.position.set(4.6, 3.3, z + 2.9);
  group.add(lamp);

  // stars
  const r = rng(99);
  const starPos: number[] = [];
  for (let i = 0; i < 260; i++) starPos.push(-40 + r() * 90, 4 + r() * 30, -30 - r() * 20);
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)), new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false }));
  stars.layers.set(LAYER_NO_OUTLINE);
  group.add(stars);
  // moon
  const moon = new THREE.Mesh(new THREE.CircleGeometry(1.6, 16), new THREE.MeshBasicMaterial({ color: '#fff4c7' }));
  moon.position.set(14, 16, -28);
  moon.layers.set(LAYER_NO_OUTLINE);
  group.add(moon);
  // roof silhouette so the sky reads above the store
  const roof = paintGeometry(new THREE.BoxGeometry(W, 0.6, 12), shade('#141b2d', 0.1));
  const rm = new THREE.Mesh(roof, toonMat());
  rm.position.set(cx, H + 1.2, z - 5);
  group.add(rm);
  return { group, doors, neon, lamp };
}
