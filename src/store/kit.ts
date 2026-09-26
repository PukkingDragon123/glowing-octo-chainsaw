import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Batcher, paintGeometry, toonMat } from '../engine/batch';
import { Painter } from '../engine/Painter';
import { rng } from '../engine/tween';

/** Palette, rounded geometry and painted textures for the Xolotl Kobini interior. */

export const PAL = {
  ink: '#2a1c22',
  cream: '#fff4e3',
  creamDark: '#f3e2c7',
  white: '#fffdf8',
  mint: '#a8dcc8',
  mintDark: '#7cc2aa',
  mintDeep: '#4f9f86',
  pink: '#f47c9f',
  pinkLight: '#ffc2d4',
  pinkDeep: '#d95a82',
  butter: '#ffe6a3',
  peach: '#ffc9a8',
  lilac: '#d6c4f5',
  sky: '#a9d8f5',
  ice: '#dff3ff',
  wood: '#dca56c',
  woodDark: '#a8703f',
  steel: '#c9d1dc',
  steelDark: '#8d98a8',
};

const geoCache = new Map<string, THREE.BufferGeometry>();

/** Rounded box geometry (cached). */
export function rboxGeo(w: number, h: number, d: number, r: number, segs = 2) {
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const key = [w, h, d, rr, segs].map((v) => v.toFixed(3)).join('|');
  let g = geoCache.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, segs, Math.max(0.001, rr));
    geoCache.set(key, g);
  }
  return g;
}

/** Batches rounded shapes into a few merged meshes. */
export class Kit {
  readonly b = new Batcher();

  /** Rounded box sitting on y (bottom), centred on x/z. */
  rbox(w: number, h: number, d: number, r: number, color: string, x: number, y: number, z: number, ry = 0, mat?: THREE.Material) {
    const g = paintGeometry(rboxGeo(w, h, d, r).clone(), color);
    this.b.add(g, mat ?? toonMat(), x, y + h / 2, z, 0, ry, 0);
    return this;
  }

  cyl(rTop: number, rBot: number, h: number, color: string, x: number, y: number, z: number, seg = 16, rx = 0, rz = 0, mat?: THREE.Material) {
    const g = paintGeometry(new THREE.CylinderGeometry(rTop, rBot, h, seg), color);
    this.b.add(g, mat ?? toonMat(), x, y + h / 2, z, rx, 0, rz);
    return this;
  }

  sphere(r: number, color: string, x: number, y: number, z: number, sy = 1, mat?: THREE.Material) {
    const g = paintGeometry(new THREE.SphereGeometry(r, 16, 10), color);
    this.b.add(g, mat ?? toonMat(), x, y, z, 0, 0, 0, 1, sy, 1);
    return this;
  }

  add(geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, mat?: THREE.Material) {
    this.b.add(paintGeometry(geo, color), mat ?? toonMat(), x, y, z, rx, ry, rz);
    return this;
  }

  build(opts: { castShadow?: boolean; receiveShadow?: boolean } = {}) {
    return this.b.build(opts);
  }
}

// -------------------------------------------------------------------------------------------------
// Textures

/** Big soft checker floor with grout and speckles. One repeat = 2×2 tiles. */
export function floorTexture() {
  const p = new Painter(64, 64);
  const a = '#fff6ea';
  const b = '#e3f1e8';
  p.rect(0, 0, 32, 32, a).rect(32, 32, 32, 32, a).rect(32, 0, 32, 32, b).rect(0, 32, 32, 32, b);
  const r = rng(4);
  for (let i = 0; i < 70; i++) p.px(Math.floor(r() * 64), Math.floor(r() * 64), r() < 0.5 ? '#efe4d2' : '#d5e8dc');
  const grout = '#e2d6c4';
  p.rect(0, 0, 64, 1, grout).rect(0, 32, 64, 1, grout).rect(0, 0, 1, 64, grout).rect(32, 0, 1, 64, grout);
  // tiny shine on each tile corner
  for (const [x, y] of [
    [3, 3],
    [35, 35],
    [35, 3],
    [3, 35],
  ])
    p.rect(x, y, 3, 1, '#ffffff').rect(x, y, 1, 3, '#ffffff');
  return p.texture(true);
}

/** Cream wallpaper with little pink dots and stars. */
export function wallpaperTexture() {
  const p = new Painter(48, 48);
  p.clear(PAL.cream);
  const dot = '#ffd6e2';
  const star = '#ffe6a3';
  for (const [x, y] of [
    [6, 6],
    [30, 18],
    [18, 34],
    [42, 42],
  ])
    p.rect(x, y, 2, 2, dot);
  for (const [x, y] of [
    [36, 5],
    [10, 24],
    [40, 30],
    [24, 44],
  ]) {
    p.px(x, y - 1, star).px(x - 1, y, star).px(x, y, star).px(x + 1, y, star).px(x, y + 1, star);
  }
  return p.texture(true);
}

/** Mint beadboard for the lower wall. */
export function beadboardTexture() {
  const p = new Painter(16, 32);
  p.clear(PAL.mint);
  p.rect(0, 0, 1, 32, PAL.mintDark);
  p.rect(1, 0, 1, 32, '#c2eadb');
  p.rect(8, 0, 1, 32, PAL.mintDark);
  p.rect(9, 0, 1, 32, '#c2eadb');
  return p.texture(true);
}

/** Pegboard for shelf backs, tinted by the section colour. */
export function pegboardTexture(base: string, hole: string) {
  const p = new Painter(16, 16);
  p.clear(base);
  for (let y = 3; y < 16; y += 6) for (let x = 3; x < 16; x += 6) p.rect(x, y, 2, 2, hole);
  return p.texture(true);
}

/** Wood grain for counters and crates. */
export function woodTexture() {
  const p = new Painter(32, 32);
  p.clear(PAL.wood);
  const r = rng(8);
  for (let y = 0; y < 32; y += 4) {
    p.rect(0, y, 32, 1, '#c98f58');
    for (let k = 0; k < 4; k++) p.rect(Math.floor(r() * 28), y + 2, 3 + Math.floor(r() * 5), 1, '#e8b983');
  }
  return p.texture(true);
}
