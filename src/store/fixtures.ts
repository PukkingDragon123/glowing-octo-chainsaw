import * as THREE from 'three';
import { Painter, shade } from '../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../engine/pixelFont';
import { Batcher, paintGeometry, toonMat } from '../engine/batch';
import { LAYER_NO_OUTLINE } from '../engine/PixelRenderer';
import { fillShelf } from './filler';
import { rng } from '../engine/tween';
import { toonGradient } from '../engine/voxel';

export const STORE = {
  floorY: 0,
  backZ: -2.05,
  shelfFrontZ: -1.4,
  ceilingY: 3.25,
  frontZ: 8,
  xMin: -8,
  xMax: 42,
};

export const SHELF_LEVELS = [0.12, 0.56, 1.0, 1.44, 1.88];

// -------------------------------------------------------------------------------------------------
// Textures

export function floorTexture(): THREE.Texture {
  const p = new Painter(32, 32);
  const a = '#efe8da';
  const b = '#e4dccb';
  p.rect(0, 0, 16, 16, a).rect(16, 16, 16, 16, a).rect(16, 0, 16, 16, b).rect(0, 16, 16, 16, b);
  const r = rng(9);
  for (let i = 0; i < 40; i++) p.px(Math.floor(r() * 32), Math.floor(r() * 32), '#d6cdb8');
  p.rect(0, 0, 32, 1, '#cfc5b0').rect(0, 16, 32, 1, '#cfc5b0').rect(0, 0, 1, 32, '#cfc5b0').rect(16, 0, 1, 32, '#cfc5b0');
  const t = p.texture(true);
  return t;
}

function pegboardTexture(): THREE.Texture {
  const p = new Painter(16, 16);
  p.clear('#dfe3ea');
  for (let y = 2; y < 16; y += 4) for (let x = 2; x < 16; x += 4) p.px(x, y, '#b9bfcc');
  return p.texture(true);
}

function stripeTexture(): THREE.Texture {
  const p = new Painter(8, 24);
  p.rect(0, 0, 8, 6, '#2ec4b6');
  p.rect(0, 6, 8, 4, '#ffd23f');
  p.rect(0, 10, 8, 4, '#ff5d73');
  p.rect(0, 14, 8, 10, '#f7f4ec');
  return p.texture(true);
}

// -------------------------------------------------------------------------------------------------
// Shell: floor, walls, ceiling, lights

export function buildShell(scene: THREE.Scene) {
  const W = STORE.xMax - STORE.xMin;
  const cx = (STORE.xMax + STORE.xMin) / 2;
  const floorTex = floorTexture();
  floorTex.repeat.set(W / 1.0, (STORE.frontZ - STORE.backZ + 6) / 1.0);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, STORE.frontZ - STORE.backZ + 6),
    new THREE.MeshToonMaterial({ map: floorTex, gradientMap: toonGradient() }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, (STORE.frontZ + STORE.backZ) / 2 + 3);
  floor.receiveShadow = true;
  scene.add(floor);

  // back wall with store stripe near the top
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(W, STORE.ceilingY), new THREE.MeshToonMaterial({ color: '#cfe6de', gradientMap: toonGradient() }));
  wall.position.set(cx, STORE.ceilingY / 2, STORE.backZ);
  wall.receiveShadow = true;
  scene.add(wall);
  const stripeTex = stripeTexture();
  stripeTex.repeat.set(W / 0.3, 1);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.5), new THREE.MeshBasicMaterial({ map: stripeTex }));
  stripe.position.set(cx, STORE.ceilingY - 0.25, STORE.backZ + 0.01);
  scene.add(stripe);

  // side walls
  for (const x of [STORE.xMin, STORE.xMax]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(STORE.frontZ - STORE.backZ, STORE.ceilingY), new THREE.MeshToonMaterial({ color: '#bfdcd2', gradientMap: toonGradient() }));
    side.position.set(x, STORE.ceilingY / 2, (STORE.frontZ + STORE.backZ) / 2);
    side.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    side.receiveShadow = true;
    scene.add(side);
  }

  // ceiling + light panels
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, STORE.frontZ - STORE.backZ), new THREE.MeshBasicMaterial({ color: '#4b5068' }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, STORE.ceilingY, (STORE.frontZ + STORE.backZ) / 2);
  scene.add(ceil);
  const b = new Batcher();
  const lightMat = toonMat(null, { emissive: true });
  for (let x = STORE.xMin + 1.5; x < STORE.xMax; x += 3) {
    for (const z of [-0.6, 2.4, 5.4]) {
      b.box(1.6, 0.05, 0.36, '#fdfcf5', x, STORE.ceilingY - 0.06, z, 0, lightMat);
      b.box(1.7, 0.02, 0.46, '#9aa0b8', x, STORE.ceilingY - 0.03, z);
    }
  }
  const lights = b.build({ castShadow: false, receiveShadow: false });
  lights.traverse((o) => o.layers.set(LAYER_NO_OUTLINE));
  scene.add(lights);
}

// -------------------------------------------------------------------------------------------------
// Gondola shelving

export interface ShelfSlot {
  x: number;
  y: number;
  z: number;
  width: number;
  maxH: number;
}

export interface GondolaOptions {
  levels?: number[];
  color?: string;
  stripColor?: string;
  seed: number;
  /** Shelf levels (indices) reserved for interactive products; the rest get filler. */
  reserved?: number[];
  fillerKinds?: ('box' | 'can' | 'bottle' | 'bag' | 'jar')[];
  backTexture?: THREE.Texture;
  topSign?: string;
}

const pegboard = (() => {
  let t: THREE.Texture | null = null;
  return () => (t ??= pegboardTexture());
})();

/** Wall gondola from x0 to x1. Returns the reserved slots per level. */
export function buildGondola(b: Batcher, x0: number, x1: number, opts: GondolaOptions): ShelfSlot[] {
  const levels = opts.levels ?? SHELF_LEVELS;
  const color = opts.color ?? '#f4f5f8';
  const strip = opts.stripColor ?? '#ffe45e';
  const front = STORE.shelfFrontZ;
  const depth = 0.55;
  const back = front - depth;
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  const topY = levels[levels.length - 1] + 0.42;
  // back panel (pegboard)
  const tex = opts.backTexture ?? pegboard();
  const panelMat = toonMat(tex);
  const panel = paintGeometry(new THREE.PlaneGeometry(w, topY), '#ffffff');
  const uv = panel.attributes.uv as THREE.BufferAttribute;
  if (!opts.backTexture) for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 0.12), uv.getY(i) * (topY / 0.12));
  b.add(panel, panelMat, cx, topY / 2, back + 0.01);
  // base kick plate
  b.box(w, 0.12, depth, shade(color, -0.35), cx, 0, front - depth / 2);
  // uprights every ~1.25m
  const bays = Math.max(1, Math.round(w / 1.25));
  for (let i = 0; i <= bays; i++) {
    const x = x0 + (w * i) / bays;
    b.box(0.05, topY, depth, shade(color, -0.2), x, 0, front - depth / 2);
  }
  // header
  b.box(w, 0.12, 0.08, shade(color, -0.1), cx, topY - 0.12, front - 0.05);
  const slots: ShelfSlot[] = [];
  levels.forEach((y, li) => {
    b.box(w, 0.03, depth, color, cx, y - 0.03, front - depth / 2);
    b.box(w, 0.055, 0.015, strip, cx, y - 0.06, front + 0.005);
    const maxH = (levels[li + 1] ?? topY) - y - 0.06;
    if (opts.reserved?.includes(li)) {
      slots.push({ x: cx, y, z: front, width: w, maxH });
    } else {
      fillShelf(b, x0 + 0.03, x1 - 0.03, y, front, { seed: opts.seed * 31 + li * 7, maxH, depth, kinds: opts.fillerKinds });
    }
  });
  return slots;
}

// -------------------------------------------------------------------------------------------------
// Hanging aisle sign

export function hangingSign(text: string, color: string, x: number, z: number, y = 2.72): THREE.Group {
  const g = new THREE.Group();
  const p = new Painter(8 + text.length * 12, 22);
  p.clear(shade(color, -0.4));
  p.rect(1, 1, p.w - 2, p.h - 2, color);
  p.rect(1, 1, p.w - 2, 2, shade(color, 0.2));
  p.text(text, p.w / 2, 5, { font: FONT_BIG, scale: 2, color: '#ffffff', bold: true, align: 'center', shadow: shade(color, -0.35), shadowOffset: [0, 1] });
  const tex = p.texture();
  const h = 0.26;
  const w = (p.w / p.h) * h;
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [
    new THREE.MeshToonMaterial({ color: shade(color, -0.3) }),
    new THREE.MeshToonMaterial({ color: shade(color, -0.3) }),
    new THREE.MeshToonMaterial({ color: shade(color, -0.3) }),
    new THREE.MeshToonMaterial({ color: shade(color, -0.3) }),
    new THREE.MeshBasicMaterial({ map: tex }),
    new THREE.MeshBasicMaterial({ map: tex }),
  ]);
  board.position.y = 0;
  g.add(board);
  for (const sx of [-w / 2 + 0.08, w / 2 - 0.08]) {
    const wire = new THREE.Mesh(new THREE.BoxGeometry(0.01, STORE.ceilingY - y - h / 2, 0.01), new THREE.MeshBasicMaterial({ color: '#555a70' }));
    wire.position.set(sx, h / 2 + (STORE.ceilingY - y - h / 2) / 2, 0);
    g.add(wire);
  }
  g.position.set(x, y, z);
  g.userData.swayPhase = x;
  return g;
}

export function tinyLabel(text: string, bg: string, fg: string): THREE.Texture {
  const p = new Painter(4 + text.length * 4, 9);
  p.clear(bg);
  p.text(text, p.w / 2, 2, { font: FONT_TINY, color: fg, align: 'center' });
  return p.texture();
}
