import * as THREE from 'three';
import { Painter, shade } from '../engine/Painter';
import { FONT_TINY } from '../engine/pixelFont';
import { Batcher, paintGeometry, toonMat } from '../engine/batch';
import { rng } from '../engine/tween';

/**
 * Background merchandise: dozens of little boxes, cans, bottles and bags with procedurally drawn
 * pixel labels packed into one atlas texture, so full shelves cost a couple of draw calls.
 */

type CellKind = 'box' | 'can' | 'bottle' | 'bag' | 'jar';

interface Cell {
  kind: CellKind;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  main: string;
}

const ATLAS = 256;
const WORDS = ['YUM', 'POP', 'ZAP', 'MOO', 'NOM', 'WOW', 'BIT', 'JOY', 'FIZ', 'OK', 'HI', 'MEGA', 'LUCK', 'KIDS', 'TOFU', 'SOY', 'NORI', 'MISO', 'TEA', 'COLA', 'LIME', 'YUZU', 'UMAI', 'CHIP'];
const PALETTE = ['#e84a5f', '#ff847c', '#fecea8', '#2a9d8f', '#e9c46a', '#f4a261', '#264653', '#8ecae6', '#219ebc', '#ffb703', '#fb8500', '#6a4c93', '#1982c4', '#8ac926', '#ff595e', '#ffca3a', '#f15bb5', '#00bbf9', '#00f5d4', '#9b5de5', '#ef476f', '#06d6a0', '#118ab2', '#073b4c', '#f78c6b', '#83d483'];

let atlasCache: { texture: THREE.Texture; cells: Record<CellKind, Cell[]> } | null = null;

function drawLabel(p: Painter, x: number, y: number, w: number, h: number, kind: CellKind, r: () => number): string {
  const pick = () => PALETTE[Math.floor(r() * PALETTE.length)];
  const main = pick();
  let accent = pick();
  if (accent === main) accent = shade(main, -0.3);
  const ink = r() > 0.5 ? '#ffffff' : '#1d1b26';
  p.rect(x, y, w, h, main);
  const style = Math.floor(r() * 5);
  if (style === 0) {
    // diagonal band
    for (let i = 0; i < h; i++) p.rect(x + Math.floor(i * 0.6) - 4, y + i, 8, 1, accent);
  } else if (style === 1) {
    p.rect(x, y + Math.floor(h * 0.55), w, Math.max(3, Math.floor(h * 0.25)), accent);
  } else if (style === 2) {
    p.disc(x + w / 2, y + h * 0.55, Math.min(w, h) * 0.3, accent);
  } else if (style === 3) {
    for (let i = 0; i < w; i += 4) p.rect(x + i, y, 2, h, shade(main, 0.08));
  } else {
    p.checker(x, y + h - 5, w, 5, main, accent, 2);
  }
  const word = WORDS[Math.floor(r() * WORDS.length)];
  const tw = p.textWidth(word, { font: FONT_TINY });
  if (tw < w - 2) p.text(word, x + w / 2, y + Math.floor(h * 0.18), { font: FONT_TINY, color: ink, align: 'center' });
  // fake small print
  for (let i = 0; i < 2; i++) p.rect(x + 3, y + h - 4 - i * 2, Math.floor(w * (0.3 + r() * 0.4)), 1, shade(main, -0.25));
  if (kind === 'box' && r() > 0.5) p.star(x + w - 5, y + 5, 3.5, 1.6, 5, '#ffe45e');
  return main;
}

function buildAtlas() {
  if (atlasCache) return atlasCache;
  const p = new Painter(ATLAS, ATLAS);
  p.clear('#ffffff');
  const r = rng(1234);
  const cells: Record<CellKind, Cell[]> = { box: [], can: [], bottle: [], bag: [], jar: [] };
  // White block in the corner for untextured faces
  p.rect(0, 0, 8, 8, '#ffffff');
  const layout: { kind: CellKind; w: number; h: number; n: number }[] = [
    { kind: 'box', w: 24, h: 36, n: 14 },
    { kind: 'bag', w: 28, h: 36, n: 8 },
    { kind: 'can', w: 48, h: 20, n: 8 },
    { kind: 'bottle', w: 48, h: 16, n: 8 },
    { kind: 'jar', w: 40, h: 14, n: 6 },
  ];
  let cx = 8;
  let cy = 0;
  let rowH = 0;
  for (const L of layout) {
    for (let i = 0; i < L.n; i++) {
      if (cx + L.w > ATLAS) {
        cx = 0;
        cy += rowH + 1;
        rowH = 0;
      }
      const main = drawLabel(p, cx, cy, L.w, L.h, L.kind, r);
      cells[L.kind].push({ kind: L.kind, u0: cx / ATLAS, v0: 1 - (cy + L.h) / ATLAS, u1: (cx + L.w) / ATLAS, v1: 1 - cy / ATLAS, main });
      cx += L.w + 1;
      rowH = Math.max(rowH, L.h);
    }
  }
  atlasCache = { texture: p.texture(), cells };
  return atlasCache;
}

const WHITE_U = 2 / ATLAS;
const WHITE_V = 1 - 2 / ATLAS;

/** Box with the front (+z) face mapped to an atlas cell and every other face flat-coloured. */
function labeledBox(w: number, h: number, d: number, cell: Cell) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  paintGeometry(g, shade(cell.main, -0.05));
  const col = g.attributes.color as THREE.BufferAttribute;
  // face order: +x, -x, +y, -y, +z, -z (4 verts each)
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (f === 4) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        uv.setXY(i, cell.u0 + (cell.u1 - cell.u0) * u, cell.v0 + (cell.v1 - cell.v0) * v);
        col.setXYZ(i, 1, 1, 1);
      } else {
        uv.setXY(i, WHITE_U, WHITE_V);
      }
    }
  }
  return g;
}

/** Cylinder whose side is wrapped with an atlas cell; caps are flat-coloured. */
function labeledCylinder(r: number, h: number, cell: Cell, capColor: string, seg = 10) {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1, false);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  paintGeometry(g, capColor);
  const col = g.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    if (Math.abs(nrm.getY(i)) < 0.5) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      uv.setXY(i, cell.u0 + (cell.u1 - cell.u0) * u, cell.v0 + (cell.v1 - cell.v0) * v);
      col.setXYZ(i, 1, 1, 1);
    } else uv.setXY(i, WHITE_U, WHITE_V);
  }
  return g;
}

export interface FillOptions {
  seed: number;
  kinds?: CellKind[];
  maxH: number;
  depth: number;
  cold?: boolean;
}

/**
 * Fill a shelf segment [x0, x1] at height y (front edge at z) with rows of merchandise.
 * Items come in "facings" — 2-4 identical products side by side — like a real store.
 */
export function fillShelf(b: Batcher, x0: number, x1: number, y: number, z: number, opts: FillOptions) {
  const { texture, cells } = buildAtlas();
  const mat = toonMat(texture);
  const r = rng(opts.seed);
  const kinds = opts.kinds ?? ['box', 'bag', 'can', 'bottle', 'jar'];
  let x = x0 + 0.02;
  while (x < x1 - 0.1) {
    const kind = kinds[Math.floor(r() * kinds.length)];
    const list = cells[kind];
    const cell = list[Math.floor(r() * list.length)];
    const facings = 1 + Math.floor(r() * 3);
    let w = 0.2,
      h = 0.3,
      d = 0.14;
    if (kind === 'box') {
      w = 0.16 + r() * 0.12;
      h = Math.min(opts.maxH, 0.24 + r() * 0.18);
      d = 0.08 + r() * 0.06;
    } else if (kind === 'bag') {
      w = 0.2 + r() * 0.08;
      h = Math.min(opts.maxH, 0.26 + r() * 0.1);
      d = 0.07;
    } else if (kind === 'can') {
      w = 0.1;
      h = Math.min(opts.maxH, 0.17);
    } else if (kind === 'bottle') {
      w = 0.11;
      h = Math.min(opts.maxH, 0.3 + r() * 0.06);
    } else {
      w = 0.12;
      h = Math.min(opts.maxH, 0.13);
    }
    for (let f = 0; f < facings && x + w < x1; f++) {
      const cx = x + w / 2;
      const zc = z - (kind === 'box' || kind === 'bag' ? d / 2 : w / 2) - 0.02;
      if (kind === 'box') {
        b.add(labeledBox(w, h, d, cell), mat, cx, y + h / 2, zc);
        // second item behind for depth
        b.add(labeledBox(w, h, d, cell), mat, cx, y + h / 2, zc - d - 0.01);
      } else if (kind === 'bag') {
        const g = labeledBox(w, h, d, cell);
        b.add(g, mat, cx, y + h / 2, zc, 0, 0, (r() - 0.5) * 0.06);
        // crimped top
        b.add(paintGeometry(new THREE.BoxGeometry(w * 0.98, 0.025, d * 0.5), shade(cell.main, -0.15)), mat, cx, y + h + 0.012, zc);
      } else if (kind === 'can') {
        const rad = w / 2;
        b.add(labeledCylinder(rad, h, cell, '#c9ccd6'), mat, cx, y + h / 2, zc);
        b.add(labeledCylinder(rad, h, cell, '#c9ccd6'), mat, cx, y + h * 1.5 + 0.005, zc);
      } else if (kind === 'bottle') {
        const rad = w / 2;
        const bodyH = h * 0.62;
        const glass = opts.cold ? '#bfe6ff' : shade(cell.main, 0.1);
        b.add(labeledCylinder(rad, bodyH, cell, glass), mat, cx, y + bodyH / 2, zc);
        b.add(paintGeometry(new THREE.CylinderGeometry(rad * 0.45, rad, h * 0.22, 10), glass), mat, cx, y + bodyH + h * 0.11, zc);
        b.add(paintGeometry(new THREE.CylinderGeometry(rad * 0.42, rad * 0.42, h * 0.1, 8), PALETTE[Math.floor(r() * PALETTE.length)]), mat, cx, y + bodyH + h * 0.27, zc);
      } else {
        const rad = w / 2;
        b.add(labeledCylinder(rad, h, cell, '#f3efe6'), mat, cx, y + h / 2, zc);
        b.add(paintGeometry(new THREE.CylinderGeometry(rad * 1.02, rad * 1.02, 0.03, 10), shade(cell.main, -0.2)), mat, cx, y + h + 0.015, zc);
      }
      x += w + 0.012;
    }
    x += 0.03 + r() * 0.03;
  }
}
