import * as THREE from 'three';
import { toonGradient } from '../engine/voxel';
import { toonMat } from '../engine/batch';
import { Painter } from '../engine/Painter';
import { LAYER_NO_OUTLINE } from '../engine/PixelRenderer';
import { drawLogo, BRAND } from '../art/brand';
import { pixelTexture } from '../art/pixel';
import { spriteMesh } from '../art/spriteMesh';
import { Kit, PAL, beadboardTexture, floorTexture, pegboardTexture, wallpaperTexture, woodTexture } from './kit';
import { LEVELS, SHELF_TOP, STORE } from './layout';

/** Interior fixtures of Xolotl Kobini: rounded, pastel, cosy. */

function toon(color: string, map?: THREE.Texture) {
  return new THREE.MeshToonMaterial({ color, map: map ?? null, gradientMap: toonGradient() });
}

// -------------------------------------------------------------------------------------------------
// Shell

export function buildShell(scene: THREE.Scene) {
  const W = STORE.xMax - STORE.xMin;
  const cx = (STORE.xMax + STORE.xMin) / 2;
  const depth = STORE.frontZ - STORE.backZ;

  const floorTex = floorTexture();
  floorTex.repeat.set(W / 1.6, (depth + 4) / 1.6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, depth + 4), toon('#ffffff', floorTex));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, (STORE.frontZ + STORE.backZ) / 2 + 2);
  floor.receiveShadow = true;
  scene.add(floor);

  // back wall: wallpaper above a beadboard wainscot with a pink rail
  const wp = wallpaperTexture();
  wp.repeat.set(W / 1.2, STORE.ceilingY / 1.2);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(W, STORE.ceilingY), toon('#ffffff', wp));
  wall.position.set(cx, STORE.ceilingY / 2, STORE.backZ);
  wall.receiveShadow = true;
  scene.add(wall);
  const bb = beadboardTexture();
  bb.repeat.set(W / 0.5, 1);
  const wain = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.95), toon('#ffffff', bb));
  wain.position.set(cx, 0.475, STORE.backZ + 0.005);
  wain.receiveShadow = true;
  scene.add(wain);
  const k = new Kit();
  k.rbox(W, 0.08, 0.06, 0.03, PAL.pink, cx, 0.93, STORE.backZ + 0.03);
  k.rbox(W, 0.14, 0.08, 0.04, PAL.white, cx, STORE.ceilingY - 0.14, STORE.backZ + 0.04);
  k.rbox(W, 0.1, 0.05, 0.02, PAL.pinkLight, cx, STORE.ceilingY - 0.26, STORE.backZ + 0.03);
  k.rbox(W, 0.12, 0.05, 0.02, PAL.white, cx, 0, STORE.backZ + 0.03);
  // side walls
  for (const x of [STORE.xMin, STORE.xMax]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(depth, STORE.ceilingY), toon('#ffffff', wp.clone()));
    (side.material as THREE.MeshToonMaterial).map!.repeat.set(depth / 1.2, STORE.ceilingY / 1.2);
    (side.material as THREE.MeshToonMaterial).map!.needsUpdate = true;
    side.position.set(x, STORE.ceilingY / 2, (STORE.frontZ + STORE.backZ) / 2);
    side.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(side);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, depth), new THREE.MeshBasicMaterial({ color: '#f3e4cf' }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, STORE.ceilingY, (STORE.frontZ + STORE.backZ) / 2);
  scene.add(ceil);
  scene.add(k.build({ castShadow: false }));
}

/** Pendant lamps with dome shades along the aisle, and bunting strung between them. */
export function lampsAndBunting(scene: THREE.Scene, xs: number[]) {
  const k = new Kit();
  const glow = new Kit();
  const bulbMat = toonMat(null, { emissive: true });
  const shades = [PAL.mintDark, PAL.pink, '#ffd66b', PAL.sky];
  const z = -0.55;
  xs.forEach((x, i) => {
    k.cyl(0.008, 0.008, 0.62, '#6b5a5a', x, STORE.ceilingY - 0.62, z, 6);
    const shade = new THREE.SphereGeometry(0.2, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    k.add(shade, shades[i % shades.length], x, STORE.ceilingY - 0.78, z);
    k.cyl(0.03, 0.03, 0.04, '#6b5a5a', x, STORE.ceilingY - 0.62, z, 8);
    glow.sphere(0.07, '#fff3c4', x, STORE.ceilingY - 0.8, z, 1, bulbMat);
  });
  scene.add(k.build({ castShadow: false }));
  const g = glow.build({ castShadow: false, receiveShadow: false });
  g.traverse((o) => o.layers.set(LAYER_NO_OUTLINE));
  scene.add(g);

  // bunting: little triangle flags on a sagging string between lamps
  const flagColors = [PAL.pink, '#ffd66b', PAL.mintDark, PAL.sky, PAL.lilac, '#ffb98f'];
  const flags = new Kit();
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.07, 0, 0, 0.07, 0, 0, 0, -0.14, 0]), 3));
  tri.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  tri.setIndex([0, 1, 2]);
  const flagMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), side: THREE.DoubleSide });
  let c = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    const n = Math.max(4, Math.round((b - a) / 0.26));
    for (let j = 1; j < n; j++) {
      const t = j / n;
      const x = a + (b - a) * t;
      const sag = Math.sin(t * Math.PI) * 0.28;
      flags.add(tri.clone(), flagColors[c++ % flagColors.length], x, STORE.ceilingY - 0.5 - sag, z + 0.25, 0, 0, (t - 0.5) * 0.25, flagMat);
    }
  }
  const fl = flags.build({ castShadow: false });
  scene.add(fl);
}

// -------------------------------------------------------------------------------------------------
// Gondola shelving

export interface ShelfRun {
  x0: number;
  x1: number;
  /** Top surface heights of each shelf. */
  levels: number[];
  /** z of the front row of goods. */
  z: number;
}

const pegCache = new Map<string, THREE.Texture>();

/** Rounded shelving unit against the back wall. Returns the stockable shelf run. */
export function gondola(kit: Kit, scene: THREE.Scene, x0: number, x1: number, color: string, o: { top?: boolean } = {}): ShelfRun {
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  const back = STORE.shelfBackZ;
  const front = STORE.shelfFrontZ;
  const d = front - back;
  const zc = (front + back) / 2;
  // pegboard back panel (textured, separate mesh)
  let tex = pegCache.get(color);
  if (!tex) {
    tex = pegboardTexture(shadeHex(color, 0.35), shadeHex(color, 0.05));
    pegCache.set(color, tex);
  }
  const t = tex.clone();
  t.repeat.set(w / 0.33, SHELF_TOP / 0.33);
  t.needsUpdate = true;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.08, SHELF_TOP - 0.1), toon('#ffffff', t));
  panel.position.set(cx, SHELF_TOP / 2 + 0.05, back + 0.02);
  panel.receiveShadow = true;
  scene.add(panel);
  // uprights
  for (const x of [x0 + 0.04, x1 - 0.04]) kit.rbox(0.08, SHELF_TOP + 0.08, d + 0.04, 0.035, PAL.white, x, 0, zc);
  // plinth
  kit.rbox(w, 0.14, d + 0.02, 0.05, shadeHex(color, -0.08), cx, 0, zc);
  // shelves with coloured rounded lips
  for (const y of LEVELS) {
    kit.rbox(w - 0.1, 0.045, d - 0.04, 0.02, PAL.white, cx, y - 0.045, zc);
    kit.rbox(w - 0.1, 0.065, 0.035, 0.016, color, cx, y - 0.075, front - 0.005);
  }
  if (o.top !== false) kit.rbox(w, 0.06, d + 0.06, 0.03, color, cx, SHELF_TOP, zc);
  return { x0: x0 + 0.1, x1: x1 - 0.1, levels: LEVELS, z: front - 0.12 };
}

function shadeHex(hex: string, amount: number) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amount)));
  return '#' + c.getHexString();
}

// -------------------------------------------------------------------------------------------------
// Checkout counter

export function checkoutCounter(scene: THREE.Scene, x: number, z: number, w: number) {
  const k = new Kit();
  const h = 0.95;
  const d = 0.72;
  k.rbox(w, h - 0.06, d, 0.08, PAL.pink, x, 0, z);
  k.rbox(w + 0.12, 0.08, d + 0.12, 0.04, PAL.woodDark, x, h - 0.08, z);
  k.rbox(w - 0.3, 0.08, 0.04, 0.02, PAL.pinkDeep, x, 0.12, z + d / 2 + 0.005);
  scene.add(k.build());
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.08, d + 0.08), toon('#ffffff', repeatTex(woodTexture(), (w + 0.08) / 0.6, (d + 0.08) / 0.6)));
  top.rotation.x = -Math.PI / 2;
  top.position.set(x, h + 0.001, z);
  top.receiveShadow = true;
  scene.add(top);
  // big white logo on the front
  const logo = spriteMesh(drawLogo(32, { badge: false, round: false }).toCanvas(), { ppu: 70, anchor: [0.5, 0.5] });
  recolor(logo, '#ffffff');
  logo.position.set(x, 0.5, z + d / 2 + 0.004);
  scene.add(logo);
  return { top: h, front: z + d / 2 };
}

/** Recolour a sprite's opaque pixels to one flat colour (keeps the silhouette). */
function recolor(mesh: THREE.Mesh, color: string) {
  const mat = mesh.material as THREE.MeshBasicMaterial;
  const src = (mat.map as THREE.CanvasTexture).image as HTMLCanvasElement;
  const p = new Painter(src.width, src.height);
  p.ctx.drawImage(src, 0, 0);
  p.silhouette(color);
  mat.map = pixelTexture(p.canvas);
}

function repeatTex(t: THREE.Texture, rx: number, ry: number) {
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

// -------------------------------------------------------------------------------------------------
// Cooler with glass doors

export function cooler(scene: THREE.Scene, x0: number, x1: number): ShelfRun & { doors: number[] } {
  const k = new Kit();
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  const back = STORE.shelfBackZ;
  const front = STORE.shelfFrontZ + 0.08;
  const zc = (back + front) / 2;
  const d = front - back;
  const H = 2.3;
  // body
  k.rbox(w, 0.22, d, 0.06, PAL.white, cx, 0, zc);
  k.rbox(w, 0.3, d, 0.08, PAL.sky, cx, H - 0.3, zc);
  k.rbox(0.12, H, d, 0.05, PAL.white, x0 + 0.06, 0, zc);
  k.rbox(0.12, H, d, 0.05, PAL.white, x1 - 0.06, 0, zc);
  // interior back + shelves
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.2, H - 0.5), new THREE.MeshBasicMaterial({ color: '#e8f6ff' }));
  inner.position.set(cx, 0.22 + (H - 0.5) / 2, back + 0.02);
  scene.add(inner);
  const levels = [0.24, 0.72, 1.2, 1.68];
  for (const y of levels) k.rbox(w - 0.22, 0.03, d - 0.12, 0.012, '#f6fbff', cx, y - 0.03, zc - 0.03);
  // door frames
  const nDoors = Math.max(2, Math.round(w / 1.45));
  const dw = (w - 0.24) / nDoors;
  const doors: number[] = [];
  for (let i = 0; i <= nDoors; i++) k.rbox(0.05, H - 0.52, 0.05, 0.02, PAL.white, x0 + 0.12 + i * dw, 0.22, front);
  for (let i = 0; i < nDoors; i++) {
    const dx = x0 + 0.12 + (i + 0.5) * dw;
    doors.push(dx);
    k.rbox(0.04, 0.5, 0.04, 0.018, PAL.steelDark, x0 + 0.12 + (i + 1) * dw - 0.1, 0.9, front + 0.04);
  }
  scene.add(k.build());
  // glass (no outline, slight tint)
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.24, H - 0.52),
    new THREE.MeshBasicMaterial({ color: '#cfeeff', transparent: true, opacity: 0.16, depthWrite: false }),
  );
  glass.position.set(cx, 0.22 + (H - 0.52) / 2, front + 0.01);
  glass.layers.set(LAYER_NO_OUTLINE);
  glass.renderOrder = 2;
  scene.add(glass);
  // sheen streaks
  const streak = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
  for (let i = 0; i < nDoors; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 1.3), streak);
    s.position.set(x0 + 0.12 + i * dw + dw * 0.3, 1.2, front + 0.015);
    s.rotation.z = -0.35;
    s.layers.set(LAYER_NO_OUTLINE);
    s.renderOrder = 3;
    scene.add(s);
  }
  const light = new THREE.PointLight('#cfefff', 3, 5, 1.6);
  light.position.set(cx, 1.6, zc + 0.6);
  scene.add(light);
  return { x0: x0 + 0.16, x1: x1 - 0.16, levels, z: zc + 0.1, doors };
}

// -------------------------------------------------------------------------------------------------
// Chest freezer

export function chestFreezer(scene: THREE.Scene, x: number, z: number, w: number) {
  const k = new Kit();
  const h = 0.82;
  const d = 0.9;
  k.rbox(w, h, d, 0.1, PAL.white, x, 0, z);
  k.rbox(w - 0.04, 0.1, d - 0.04, 0.04, PAL.sky, x, 0.08, z);
  // frosty inside
  const ice = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.2, d - 0.2), new THREE.MeshBasicMaterial({ color: '#e7f7ff' }));
  ice.rotation.x = -Math.PI / 2;
  ice.position.set(x, h - 0.12, z);
  scene.add(ice);
  k.rbox(w + 0.02, 0.05, 0.08, 0.02, PAL.sky, x, h - 0.02, z + d / 2 - 0.04);
  k.rbox(w + 0.02, 0.05, 0.08, 0.02, PAL.sky, x, h - 0.02, z - d / 2 + 0.04);
  scene.add(k.build());
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, d - 0.1), new THREE.MeshBasicMaterial({ color: '#dff4ff', transparent: true, opacity: 0.22, depthWrite: false }));
  lid.rotation.x = -Math.PI / 2;
  lid.position.set(x, h + 0.02, z);
  lid.layers.set(LAYER_NO_OUTLINE);
  scene.add(lid);
  return { top: h - 0.12, inner: { x0: x - w / 2 + 0.16, x1: x + w / 2 - 0.16, z0: z - d / 2 + 0.16, z1: z + d / 2 - 0.16 } };
}

// -------------------------------------------------------------------------------------------------
// Open chiller for fresh food (tiered, with a light canopy)

export function openChiller(kit: Kit, scene: THREE.Scene, x0: number, x1: number): ShelfRun {
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  const back = STORE.shelfBackZ;
  const front = STORE.shelfFrontZ + 0.1;
  const zc = (back + front) / 2;
  const d = front - back;
  kit.rbox(w, 0.5, d, 0.08, PAL.mintDark, cx, 0, zc);
  kit.rbox(w, 1.95, 0.1, 0.05, PAL.mint, cx, 0, back + 0.05);
  for (const x of [x0 + 0.05, x1 - 0.05]) kit.rbox(0.1, 2.2, d, 0.05, PAL.white, x, 0, zc);
  kit.rbox(w, 0.2, d * 0.7, 0.08, PAL.white, cx, 2.0, back + d * 0.35);
  const levels = [0.52, 1.0, 1.46];
  for (const y of levels) {
    kit.rbox(w - 0.14, 0.04, d - 0.1, 0.02, '#f2fff9', cx, y - 0.04, zc - 0.02);
    kit.rbox(w - 0.14, 0.06, 0.03, 0.014, PAL.pink, cx, y - 0.07, front - 0.03);
  }
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, 0.05), new THREE.MeshBasicMaterial({ color: '#fffbe2' }));
  strip.position.set(cx, 1.99, back + d * 0.55);
  strip.rotation.x = Math.PI / 2;
  scene.add(strip);
  return { x0: x0 + 0.12, x1: x1 - 0.12, levels, z: front - 0.14 };
}

// -------------------------------------------------------------------------------------------------
// Coffee bar

export function coffeeBar(scene: THREE.Scene, x: number, z: number, w: number) {
  const k = new Kit();
  k.rbox(w, 0.9, 0.62, 0.07, '#8f5b3e', x, 0, z);
  k.rbox(w + 0.08, 0.06, 0.7, 0.03, PAL.cream, x, 0.9, z);
  // espresso machine
  const mx = x - w * 0.22;
  k.rbox(0.62, 0.52, 0.42, 0.1, '#e8eef5', mx, 0.96, z - 0.05);
  k.rbox(0.66, 0.08, 0.46, 0.04, PAL.pink, mx, 1.48, z - 0.05);
  k.cyl(0.04, 0.04, 0.12, PAL.steelDark, mx - 0.12, 1.08, z + 0.17, 10);
  k.cyl(0.04, 0.04, 0.12, PAL.steelDark, mx + 0.12, 1.08, z + 0.17, 10);
  k.sphere(0.04, '#ff6d6d', mx - 0.18, 1.34, z + 0.17);
  k.sphere(0.04, '#7cc9a8', mx - 0.06, 1.34, z + 0.17);
  k.cyl(0.1, 0.1, 0.02, PAL.steelDark, mx, 0.96, z + 0.12, 14);
  // cup stacks
  for (let i = 0; i < 4; i++) k.cyl(0.055, 0.045, 0.1, i % 2 ? '#ffffff' : '#fff1e0', x + w * 0.3, 0.96 + i * 0.07, z - 0.12, 12);
  scene.add(k.build());
}

// -------------------------------------------------------------------------------------------------
// Photo booth with a curtain

export function photoBooth(scene: THREE.Scene, x: number, z: number) {
  const k = new Kit();
  const w = 1.6;
  const h = 2.3;
  const d = 1.2;
  k.rbox(w, h, d, 0.14, PAL.lilac, x, 0, z);
  k.rbox(w + 0.1, 0.3, d + 0.1, 0.12, PAL.pink, x, h - 0.1, z);
  k.rbox(0.9, 1.7, 0.06, 0.05, '#3b2f4a', x - 0.2, 0.22, z + d / 2 - 0.02);
  scene.add(k.build());
  // curtain with folds
  const p = new Painter(32, 48);
  for (let i = 0; i < 32; i++) {
    const c = i % 8 < 4 ? '#ff7aa2' : i % 8 < 6 ? '#ff9ab8' : '#e75d89';
    p.rect(i, 0, 1, 48, c);
  }
  p.rect(0, 44, 32, 4, '#ffd66b');
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.62), toon('#ffffff', p.texture()));
  curtain.position.set(x - 0.32, 0.26 + 0.81, z + d / 2 + 0.02);
  scene.add(curtain);
  // flashing sign lamp
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff3a8' }));
  lamp.position.set(x + 0.5, h + 0.15, z + d / 2 + 0.05);
  lamp.layers.set(LAYER_NO_OUTLINE);
  scene.add(lamp);
  return { lamp, slot: { x: x + 0.45, y: 1.1, z: z + d / 2 + 0.02 } };
}

/** Retro TV on a cabinet with a screen canvas you can animate. */
export function tvCabinet(scene: THREE.Scene, x: number, z: number) {
  const k = new Kit();
  k.rbox(1.5, 0.7, 0.6, 0.08, PAL.wood, x, 0, z);
  k.rbox(1.0, 0.8, 0.62, 0.16, '#e8dccb', x, 0.72, z);
  k.rbox(0.18, 0.04, 0.3, 0.02, PAL.steelDark, x - 0.08, 1.52, z - 0.1);
  k.cyl(0.006, 0.006, 0.4, PAL.steelDark, x - 0.2, 1.52, z - 0.1, 5, 0, 0.5);
  k.cyl(0.006, 0.006, 0.4, PAL.steelDark, x + 0.05, 1.52, z - 0.1, 5, 0, -0.5);
  k.sphere(0.035, '#ff6d6d', x + 0.38, 1.25, z + 0.31);
  k.sphere(0.035, '#7cc9a8', x + 0.38, 1.12, z + 0.31);
  scene.add(k.build());
  const p = new Painter(48, 36);
  const tex = p.texture();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.5), new THREE.MeshBasicMaterial({ map: tex }));
  screen.position.set(x - 0.08, 1.12, z + 0.315);
  screen.layers.set(LAYER_NO_OUTLINE);
  scene.add(screen);
  return { painter: p, texture: tex, screen };
}

// -------------------------------------------------------------------------------------------------
// Signs

/** A round hanging sign with a sprite icon (no words). */
export function hangingSign(icon: HTMLCanvasElement, color: string, x: number) {
  const g = new THREE.Group();
  const k = new Kit();
  k.cyl(0.006, 0.006, 0.5, '#6b5a5a', -0.2, 0.3, 0, 5);
  k.cyl(0.006, 0.006, 0.5, '#6b5a5a', 0.2, 0.3, 0, 5);
  const disc = new THREE.CylinderGeometry(0.32, 0.32, 0.06, 28);
  k.add(disc, color, 0, 0, 0, Math.PI / 2, 0, 0);
  k.add(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 28), PAL.white, 0, 0, 0, Math.PI / 2, 0, 0);
  g.add(k.build({ castShadow: false }));
  const s = spriteMesh(icon, { ppu: icon.width / 0.38, anchor: [0.5, 0.5], doubleSided: true });
  s.position.z = 0.04;
  g.add(s);
  g.position.set(x, STORE.ceilingY - 0.95, -1.05);
  g.userData.swayPhase = Math.random() * 6;
  return g;
}

/** A standing store-brand logo board. */
export function logoBoard(scale = 1) {
  const s = spriteMesh(drawLogo(64, { badge: true }).toCanvas(), { ppu: 64 / (0.7 * scale), anchor: [0.5, 0.5], doubleSided: true });
  s.userData.brand = BRAND.name;
  return s;
}
