import * as THREE from 'three';
import { VoxelGrid, voxelMesh, toonGradient } from '../engine/voxel';
import { Batcher, paintGeometry, toonMat } from '../engine/batch';
import { Painter, shade } from '../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../engine/pixelFont';
import { LAYER_NO_OUTLINE } from '../engine/PixelRenderer';
import { rng } from '../engine/tween';
import { drawCaptain } from '../products/captain/art';

const INK = '#1d1b26';

// -------------------------------------------------------------------------------------------------
// Maneki-neko cashier: the cat behind the counter waves its paw forever.

export function cashierCat() {
  const g = new VoxelGrid(14, 18, 10);
  const white = '#fbf7f0';
  const orange = '#f4a261';
  const black = '#2b2d42';
  // body
  g.ellipsoid(7, 5, 5, 5, 5.2, 4.2, white);
  // head
  g.ellipsoid(7, 12, 5, 5, 4.4, 4.2, white);
  // ears
  g.box(3, 15, 4, 4, 17, 6, white);
  g.box(10, 15, 4, 11, 17, 6, white);
  g.box(3, 16, 6, 3, 16, 6, '#ffb3c1');
  g.box(11, 16, 6, 11, 16, 6, '#ffb3c1');
  // patches
  g.paint((x, y) => (x < 6 && y > 12 ? orange : x > 9 && y < 7 && y > 2 ? black : null));
  // face (front z=9)
  g.box(4, 11, 9, 5, 12, 9, INK);
  g.box(9, 11, 9, 10, 12, 9, INK);
  g.set(7, 10, 9, '#ff8fa3');
  g.box(6, 9, 9, 8, 9, 9, INK);
  g.set(3, 10, 9, '#ff8fa3').set(11, 10, 9, '#ff8fa3');
  // collar + bell
  g.box(3, 8, 1, 11, 8, 9, '#e63946');
  g.box(6, 6, 9, 8, 7, 9, '#ffd23f');
  // left paw resting (holds a gold coin "QR")
  g.box(2, 3, 7, 4, 5, 9, white);
  g.box(2, 5, 9, 4, 7, 9, '#ffd23f');
  const body = voxelMesh(g, { scale: 0.05, anchor: 'bottom-center' });
  // waving arm
  const a = new VoxelGrid(4, 7, 4);
  a.box(0, 0, 0, 3, 6, 3, white);
  a.box(0, 5, 3, 3, 6, 3, '#ffb3c1');
  const arm = voxelMesh(a, { scale: 0.05, anchor: 'bottom-center' });
  const pivot = new THREE.Group();
  arm.position.y = -0.02;
  pivot.add(arm);
  pivot.position.set(0.24, 0.42, 0.1);
  const group = new THREE.Group();
  group.add(body, pivot);
  return { group, arm: pivot };
}

export function cashRegister() {
  const g = new VoxelGrid(12, 10, 10);
  g.box(0, 0, 0, 11, 3, 9, '#5c677d');
  g.box(0, 4, 0, 11, 5, 7, '#7d8597');
  for (let x = 1; x < 11; x += 2) for (let z = 4; z < 9; z += 2) g.set(x, 4, z + 1, '#e9ecef');
  g.box(2, 6, 1, 9, 9, 2, '#343a40');
  g.box(3, 7, 3, 8, 8, 3, '#7CFFCB');
  g.box(1, 1, 10 - 1, 10, 2, 9, '#adb5bd');
  return voxelMesh(g, { scale: 0.045 });
}

/** Screen texture that cycles an "earn QRBucks" ad loop. */
export class AdScreen {
  readonly painter = new Painter(64, 36);
  readonly texture: THREE.CanvasTexture;
  private t = 0;
  private frame = -1;
  constructor() {
    this.texture = this.painter.texture();
  }
  update(dt: number) {
    this.t += dt;
    const f = Math.floor(this.t * 4);
    if (f === this.frame) return;
    this.frame = f;
    const p = this.painter;
    const phase = Math.floor(this.t / 3) % 3;
    p.clear('#141b2d');
    if (phase === 0) {
      p.gradientV(0, 0, 64, 36, '#6f4ef2', '#2b1d6b', 3);
      drawCaptain(p, 2, -8, 'cheer');
      p.text('WATCH AD', 44, 8, { font: FONT_TINY, color: '#ffffff', align: 'center' });
      p.text('+25', 44, 16, { font: FONT_BIG, color: '#ffd23f', align: 'center', outline: INK });
      p.text('QB', 44, 25, { font: FONT_TINY, color: '#ffd23f', align: 'center' });
    } else if (phase === 1) {
      p.gradientV(0, 0, 64, 36, '#e8233a', '#8f0f24', 3);
      for (let i = 0; i < 9; i++) {
        const x = (i * 13 + f * 3) % 70 - 4;
        p.disc(x, 26 + Math.sin(i + this.t * 3) * 3, 3, ['#ffd60a', '#3ddc84', '#8b5cf6', '#ff8a1f'][i % 4]);
      }
      p.text('SCAN THE', 32, 4, { font: FONT_TINY, color: '#ffffff', align: 'center' });
      p.text('RAINBOW', 32, 11, { font: FONT_BIG, color: '#ffd60a', align: 'center', outline: INK });
    } else {
      p.gradientV(0, 0, 64, 36, '#0b1d2d', '#003049', 3);
      p.text('QRBUCKS', 32, 5, { font: FONT_BIG, color: '#7CFFCB', align: 'center' });
      p.text('TAP TO EARN', 32, 17, { font: FONT_TINY, color: '#ffffff', align: 'center' });
      if (f % 2 === 0) p.text('▶ PLAY', 32, 25, { font: FONT_TINY, color: '#ffd23f', align: 'center' });
    }
    // scanlines
    for (let y = 0; y < 36; y += 2) p.rect(0, y, 64, 1, 'rgba(0,0,0,0.18)');
    this.texture.needsUpdate = true;
  }
}

export function wallTV(screen: AdScreen) {
  const group = new THREE.Group();
  const b = new Batcher();
  b.box(1.36, 0.8, 0.08, '#23242f', 0, 0, 0);
  b.box(0.1, 0.35, 0.1, '#3a3b48', 0, 0.78, -0.02);
  const frame = b.build();
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.68), new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false }));
  scr.position.set(0, 0.4, 0.045);
  group.add(frame, scr);
  return { group, screen: scr };
}

// -------------------------------------------------------------------------------------------------

export function hotFoodCase() {
  const group = new THREE.Group();
  const b = new Batcher();
  b.box(1.5, 0.5, 0.6, '#c0392b', 0, 0, 0);
  b.box(1.5, 0.05, 0.6, '#95a5a6', 0, 0.5, 0);
  // buns
  const r = rng(4);
  for (let i = 0; i < 7; i++) {
    const g = paintGeometry(new THREE.SphereGeometry(0.09, 8, 6), i % 3 === 0 ? '#ffd6a5' : '#fdfcf5');
    b.add(g, toonMat(), -0.6 + i * 0.2, 0.62, -0.12 + r() * 0.05, 0, 0, 0, 1, 0.75, 1);
  }
  b.box(1.5, 0.02, 0.6, '#7f8c8d', 0, 0.9, 0);
  group.add(b.build());
  // sausages rolling
  const rollers: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 8), new THREE.MeshToonMaterial({ color: '#c1440e', gradientMap: toonGradient() }));
    s.rotation.z = Math.PI / 2;
    s.position.set(-0.45 + (i % 3) * 0.45, 0.58, 0.14 + Math.floor(i / 3) * 0.07);
    group.add(s);
    rollers.push(s);
  }
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.36, 0.56), new THREE.MeshBasicMaterial({ color: '#ffe8c2', transparent: true, opacity: 0.18, depthWrite: false }));
  glass.position.set(0, 0.72, 0);
  glass.layers.set(LAYER_NO_OUTLINE);
  group.add(glass);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.4), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
  lamp.position.set(0, 0.88, 0);
  group.add(lamp);
  return { group, rollers };
}

function magazineCover(seed: number): HTMLCanvasElement {
  const r = rng(seed);
  const cols = ['#ef476f', '#06d6a0', '#118ab2', '#ffd166', '#8338ec', '#fb5607', '#3a86ff'];
  const bg = cols[Math.floor(r() * cols.length)];
  const p = new Painter(20, 28);
  p.clear(bg);
  const titles = ['POP', 'QR!', 'WOW', 'NEON', 'CUTE', 'BYTE'];
  p.text(titles[Math.floor(r() * titles.length)], 10, 2, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  p.disc(10, 16, 5 + r() * 2, shade(bg, 0.25));
  p.disc(10, 15, 2.5, '#ffe0bd');
  p.rect(3, 23, 10, 1, '#ffffff');
  p.rect(3, 25, 7, 1, '#ffffff');
  return p.canvas;
}

export function magazineRack(width: number) {
  const group = new THREE.Group();
  const b = new Batcher();
  const rows = [0.35, 0.8, 1.25];
  b.box(width, 1.7, 0.1, '#6d597a', 0, 0, -0.3);
  for (const y of rows) {
    b.box(width, 0.03, 0.35, '#b56576', 0, y - 0.03, -0.1);
    b.box(width, 0.08, 0.02, '#e56b6f', 0, y, 0.07);
  }
  group.add(b.build());
  // magazines leaning back
  const atlas = new Painter(21 * 8, 29);
  for (let i = 0; i < 8; i++) atlas.blit(magazineCover(10 + i), i * 21, 0);
  const tex = atlas.texture();
  const mb = new Batcher();
  const mat = toonMat(tex);
  const r = rng(77);
  for (const y of [0.35, 0.8]) {
    for (let x = -width / 2 + 0.18; x < width / 2 - 0.1; x += 0.26) {
      if (r() < 0.12) continue;
      const k = Math.floor(r() * 8);
      const g = paintGeometry(new THREE.PlaneGeometry(0.22, 0.3), '#ffffff');
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (k * 21 + uv.getX(i) * 20) / atlas.w, (uv.getY(i) * 28 + 1) / atlas.h);
      mb.add(g, mat, x, y + 0.16, -0.08, -0.25, 0, 0);
    }
  }
  group.add(mb.build({ castShadow: false }));
  return group;
}

// -------------------------------------------------------------------------------------------------

/** Cardboard standee of Captain QR for the cereal promo. */
export function captainStandee(height: number) {
  const p = new Painter(60, 70);
  drawCaptain(p, 0, 4, 'cheer');
  p.text('NEW!', 30, 0, { font: FONT_BIG, color: '#ffd23f', outline: INK, align: 'center', bold: true });
  const tex = p.texture();
  const mat = new THREE.MeshToonMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, gradientMap: toonGradient() });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(height * (60 / 70), height), mat);
  m.position.y = height / 2;
  m.castShadow = true;
  const g = new THREE.Group();
  g.add(m);
  // cardboard foot
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), new THREE.MeshToonMaterial({ color: '#c89f65', gradientMap: toonGradient() }));
  foot.position.set(0, 0.025, -0.05);
  g.add(foot);
  return g;
}

export function pallet(w: number, d: number) {
  const b = new Batcher();
  b.box(w, 0.04, d, '#c9a26b', 0, 0.1, 0);
  for (const z of [-d / 2 + 0.06, 0, d / 2 - 0.06]) b.box(w, 0.08, 0.1, '#a67c52', 0, 0.02, z);
  return b.build();
}

// -------------------------------------------------------------------------------------------------

export function openChiller(width: number) {
  const group = new THREE.Group();
  const b = new Batcher();
  const h = 2.05;
  b.box(width, h, 0.1, '#dfe7ec', 0, 0, -0.62);
  b.box(0.08, h, 0.75, '#b8c4cc', -width / 2, 0, -0.3);
  b.box(0.08, h, 0.75, '#b8c4cc', width / 2, 0, -0.3);
  b.box(width, 0.36, 0.75, '#2b3a55', 0, 0, -0.3);
  b.box(width, 0.18, 0.8, '#2ec4b6', 0, h - 0.18, -0.28);
  for (const y of [0.42, 0.9, 1.34, 1.72]) {
    b.box(width - 0.1, 0.03, 0.6, '#eef3f6', 0, y - 0.03, -0.3);
    b.box(width - 0.1, 0.05, 0.015, '#ffe45e', 0, y - 0.07, 0.01);
  }
  group.add(b.build());
  const strip = new THREE.Mesh(new THREE.BoxGeometry(width - 0.2, 0.03, 0.05), new THREE.MeshBasicMaterial({ color: '#e9fbff' }));
  strip.position.set(0, h - 0.2, 0.08);
  group.add(strip);
  const sign = new Painter(48, 10);
  sign.clear('#2ec4b6');
  sign.text('FRESH', 24, 2, { font: FONT_BIG, color: '#ffffff', align: 'center' });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.25), new THREE.MeshBasicMaterial({ map: sign.texture() }));
  s.position.set(0, h - 0.09, 0.13);
  group.add(s);
  return group;
}

export function coffeeMachine() {
  const g = new VoxelGrid(14, 20, 10);
  g.box(0, 0, 0, 13, 2, 9, '#3d405b');
  g.box(1, 3, 0, 12, 18, 7, '#e07a5f');
  g.box(1, 19, 0, 12, 19, 8, '#3d405b');
  g.box(3, 13, 8, 10, 17, 8, '#1d1b26');
  g.box(4, 14, 9, 9, 16, 9, '#7CFFCB');
  g.box(5, 8, 7, 8, 11, 9, '#2b2d42');
  g.box(6, 6, 8, 7, 7, 8, '#5c5f7a');
  g.box(5, 3, 6, 8, 5, 9, '#ffffff');
  for (let i = 0; i < 3; i++) g.set(3 + i * 4, 10, 8, ['#ffd23f', '#06d6a0', '#ef476f'][i]);
  return voxelMesh(g, { scale: 0.05 });
}

// -------------------------------------------------------------------------------------------------

export interface CoolerDoors {
  group: THREE.Group;
  glass: THREE.Mesh[];
}

export function coolerUnit(doors: number, doorW: number): CoolerDoors {
  const group = new THREE.Group();
  const b = new Batcher();
  const w = doors * doorW;
  const h = 2.35;
  // hollow body: back, sides, roof and plinth (the front is glass)
  b.box(w + 0.2, h + 0.2, 0.08, '#39415a', 0, 0, -1.0);
  b.box(0.1, h + 0.2, 0.95, '#39415a', -w / 2 - 0.05, 0, -0.52);
  b.box(0.1, h + 0.2, 0.95, '#39415a', w / 2 + 0.05, 0, -0.52);
  b.box(w + 0.2, 0.12, 0.95, '#39415a', 0, h + 0.08, -0.52);
  b.box(w, 0.1, 0.95, '#2b3044', 0, 0, -0.52);
  b.box(w, h - 0.25, 0.04, '#cfe8ff', 0, 0.15, -0.94);
  // header
  b.box(w + 0.2, 0.34, 0.12, '#00b4ff', 0, h - 0.14, -0.06);
  for (let i = 0; i <= doors; i++) b.box(0.07, h - 0.2, 0.08, '#2b3044', -w / 2 + i * doorW, 0.1, -0.08);
  b.box(w, 0.07, 0.08, '#2b3044', 0, 0.1, -0.08);
  b.box(w, 0.07, 0.08, '#2b3044', 0, h - 0.17, -0.08);
  // handles
  for (let i = 0; i < doors; i++) b.box(0.04, 0.5, 0.05, '#dfe7ec', -w / 2 + i * doorW + doorW - 0.14, 0.9, -0.01);
  group.add(b.build());
  // header sign
  const p = new Painter(96, 12);
  p.clear('#00b4ff');
  p.text('COLD DRINKS ❄', 48, 2, { font: FONT_BIG, color: '#ffffff', align: 'center', bold: true, shadow: '#0077b6' });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, (w * 0.6 * 12) / 96), new THREE.MeshBasicMaterial({ map: p.texture() }));
  sign.position.set(0, h - 0.14 + 0.17, 0.005);
  group.add(sign);
  // inner light
  const light = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.04, 0.06), new THREE.MeshBasicMaterial({ color: '#f4fbff' }));
  light.position.set(0, h - 0.36, -0.2);
  group.add(light);
  // glass doors
  const glass: THREE.Mesh[] = [];
  const gm = new THREE.MeshBasicMaterial({ color: '#bfe9ff', transparent: true, opacity: 0.16, depthWrite: false });
  for (let i = 0; i < doors; i++) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(doorW - 0.08, h - 0.32), gm);
    g.position.set(-w / 2 + doorW * (i + 0.5), 0.15 + (h - 0.32) / 2, -0.05);
    g.layers.set(LAYER_NO_OUTLINE);
    group.add(g);
    glass.push(g);
    // frost corners
    const f = new Painter(16, 16);
    f.dither(0, 0, 16, 2, '#ffffff', 0.5);
    f.dither(0, 14, 16, 2, '#ffffff', 0.35);
    const frost = new THREE.Mesh(new THREE.PlaneGeometry(doorW - 0.08, h - 0.32), new THREE.MeshBasicMaterial({ map: f.texture(), transparent: true, opacity: 0.4, depthWrite: false }));
    frost.position.copy(g.position).add(new THREE.Vector3(0, 0, 0.002));
    frost.layers.set(LAYER_NO_OUTLINE);
    group.add(frost);
  }
  return { group, glass };
}

export function chestFreezer(w: number) {
  const group = new THREE.Group();
  const b = new Batcher();
  const h = 0.85;
  const d = 0.95;
  b.box(w, h, d, '#f1f5f9', 0, 0, 0);
  b.box(w + 0.02, 0.12, d + 0.02, '#8ecae6', 0, 0.12, 0);
  b.box(w - 0.1, 0.05, d - 0.1, '#cfefff', 0, h - 0.3, 0);
  // ice cream tubs inside
  const r = rng(21);
  const cols = ['#ffafcc', '#bde0fe', '#fdffb6', '#caffbf', '#ffc6ff', '#ffd6a5'];
  for (let x = -w / 2 + 0.16; x < w / 2 - 0.1; x += 0.2)
    for (let z = -d / 2 + 0.16; z < d / 2 - 0.1; z += 0.22) {
      if (r() < 0.2) continue;
      b.cylinder(0.08, 0.13, cols[Math.floor(r() * cols.length)], x, h - 0.25, z, 8);
    }
  group.add(b.build());
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.02, d - 0.06), new THREE.MeshBasicMaterial({ color: '#dff6ff', transparent: true, opacity: 0.25, depthWrite: false }));
  glass.position.y = h + 0.01;
  glass.layers.set(LAYER_NO_OUTLINE);
  group.add(glass);
  const p = new Painter(56, 12);
  p.clear('#8ecae6');
  p.text('ICE COLD', 28, 2, { font: FONT_BIG, color: '#ffffff', align: 'center', shadow: '#219ebc' });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.19), new THREE.MeshBasicMaterial({ map: p.texture() }));
  sign.position.set(0, 0.45, d / 2 + 0.005);
  group.add(sign);
  return group;
}

// -------------------------------------------------------------------------------------------------

function velvetTexture() {
  const p = new Painter(16, 16);
  p.clear('#7b1e3a');
  p.dither(0, 0, 16, 16, '#8f2847', 0.3);
  for (let x = 0; x < 16; x += 4) p.rect(x, 0, 1, 16, '#6a1631');
  return p.texture(true);
}

export function vipShelf(width: number) {
  const group = new THREE.Group();
  const b = new Batcher();
  const h = 2.25;
  const vel = velvetTexture();
  const back = paintGeometry(new THREE.PlaneGeometry(width, h), '#ffffff');
  const uv = back.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * width * 4, uv.getY(i) * h * 4);
  b.add(back, toonMat(vel), 0, h / 2, -0.6);
  const gold = '#f2c14e';
  b.box(width + 0.12, 0.1, 0.7, shade(gold, -0.1), 0, h, -0.3);
  b.box(0.1, h, 0.7, gold, -width / 2, 0, -0.3);
  b.box(0.1, h, 0.7, gold, width / 2, 0, -0.3);
  b.box(width, 0.3, 0.7, '#2b2d42', 0, 0, -0.3);
  for (const y of [0.95, 1.5]) {
    b.box(width, 0.04, 0.6, '#1d1b26', 0, y - 0.04, -0.3);
    b.box(width, 0.04, 0.02, gold, 0, y - 0.06, 0.005);
  }
  // pedestal in the middle
  b.box(0.9, 0.6, 0.6, '#1d1b26', 0, 0.3, -0.2);
  b.box(0.95, 0.04, 0.65, gold, 0, 0.9, -0.2);
  group.add(b.build());
  // velvet rope posts
  const rope = new Batcher();
  for (const x of [-width / 2 + 0.3, -0.9, 0.9, width / 2 - 0.3]) {
    rope.cylinder(0.12, 0.03, gold, x, 0, 0.9, 10);
    rope.cylinder(0.025, 0.85, gold, x, 0, 0.9, 8);
    rope.add(paintGeometry(new THREE.SphereGeometry(0.05, 8, 6), gold), toonMat(), x, 0.9, 0.9);
  }
  group.add(rope.build());
  const posts = [-width / 2 + 0.3, -0.9, 0.9, width / 2 - 0.3];
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i];
    const c = posts[i + 1];
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(a, 0.85, 0.9), new THREE.Vector3((a + c) / 2, 0.6, 0.9), new THREE.Vector3(c, 0.85, 0.9));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.025, 5), new THREE.MeshToonMaterial({ color: '#c1121f', gradientMap: toonGradient() }));
    group.add(tube);
  }
  // sign
  const p = new Painter(72, 14);
  p.clear('#1d1b26');
  p.strokeRect(0, 0, 72, 14, gold);
  p.text('★ PREMIUM ★', 36, 3, { font: FONT_BIG, color: gold, align: 'center', bold: true });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.35), new THREE.MeshBasicMaterial({ map: p.texture() }));
  sign.position.set(0, h + 0.3, -0.2);
  group.add(sign);
  // spotlight cones
  const coneMat = new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide });
  for (const x of [-1.5, 0, 1.5]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.4, 12, 1, true), coneMat);
    cone.position.set(x, 1.6, -0.1);
    cone.layers.set(LAYER_NO_OUTLINE);
    group.add(cone);
  }
  return group;
}

// -------------------------------------------------------------------------------------------------
// Foreground decor

export function basketStack() {
  const b = new Batcher();
  for (let i = 0; i < 4; i++) {
    const y = i * 0.07;
    b.box(0.5, 0.05, 0.36, '#e63946', 0, y, 0);
    b.box(0.5, 0.2, 0.03, '#e63946', 0, y, 0.17);
    b.box(0.5, 0.2, 0.03, '#e63946', 0, y, -0.17);
    b.box(0.03, 0.2, 0.36, '#e63946', 0.24, y, 0);
    b.box(0.03, 0.2, 0.36, '#e63946', -0.24, y, 0);
  }
  b.box(0.36, 0.03, 0.03, '#1d1b26', 0, 0.48, 0.1);
  return b.build();
}

export function wetFloorSign() {
  const p = new Painter(20, 30);
  p.clear('#ffd23f');
  p.poly([[10, 3], [17, 16], [3, 16]], INK);
  p.poly([[10, 6], [15, 15], [5, 15]], '#ffd23f');
  p.rect(9, 8, 2, 4, INK);
  p.rect(9, 13, 2, 1, INK);
  p.text('WET', 10, 19, { font: FONT_TINY, color: INK, align: 'center' });
  p.text('FLOOR', 10, 25, { font: FONT_TINY, color: INK, align: 'center' });
  const tex = p.texture();
  const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient(), side: THREE.DoubleSide });
  const g = new THREE.Group();
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.6), mat);
    m.position.set(0, 0.3, s * 0.1);
    m.rotation.x = s * 0.3;
    if (s < 0) m.rotation.y = Math.PI;
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

export function pottedPlant() {
  const g = new VoxelGrid(10, 22, 10);
  g.box(2, 0, 2, 7, 5, 7, '#bc6c25');
  g.box(1, 5, 1, 8, 6, 8, '#dda15e');
  const r = rng(5);
  for (let i = 0; i < 70; i++) {
    const x = 5 + (r() - 0.5) * 8;
    const y = 8 + r() * 13;
    const z = 5 + (r() - 0.5) * 8;
    g.set(x, y, z, r() > 0.5 ? '#2d6a4f' : '#40916c');
  }
  g.box(4, 6, 4, 5, 12, 5, '#6b4423');
  return voxelMesh(g, { scale: 0.06 });
}

export function cardboardBoxes() {
  const b = new Batcher();
  b.box(0.6, 0.45, 0.5, '#c89f65', 0, 0, 0);
  b.box(0.5, 0.35, 0.42, '#b98b52', 0.05, 0.45, 0.02, 0.2);
  b.box(0.62, 0.05, 0.08, '#e8d5b0', 0, 0.44, 0);
  return b.build();
}

/** Small voxel padlock shown on locked products. */
export function padlock() {
  const g = new VoxelGrid(7, 9, 4);
  g.box(0, 0, 0, 6, 4, 2, '#f2c14e');
  g.box(1, 5, 1, 1, 7, 1, '#adb5bd');
  g.box(5, 5, 1, 5, 7, 1, '#adb5bd');
  g.box(2, 8, 1, 4, 8, 1, '#adb5bd');
  g.box(3, 1, 3, 3, 3, 3, INK);
  return voxelMesh(g, { scale: 0.022, shadows: false });
}
