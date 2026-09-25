import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { VoxelGrid } from '../../engine/voxel';
import type { Flavor } from '../types';

export const INK = '#1d1b26';

/**
 * Chips are the dark modules, so every flavour uses a naturally dark chip: blue-corn, chilli,
 * seaweed and smoky BBQ. `chips` are the party colours, `scan` the scan-safe shade.
 */
export const CRUNCH_FLAVORS: Flavor[] = [
  { id: 'seasalt', name: 'Sea Salt', c: { main: '#2f80ed', bag: '#2f80ed', bagDark: '#1c5fbf', accent: '#ffd23f', ribbon: '#7ee0ff', chipA: '#2a4ea8', chipB: '#5b2a86', scan: '#172554' } },
  { id: 'tomyum', name: 'Tom Yum', c: { main: '#e8483f', bag: '#e8483f', bagDark: '#b8322b', accent: '#ffd23f', ribbon: '#ffd23f', chipA: '#b3261e', chipB: '#c2410c', scan: '#7f1d1d' } },
  { id: 'nori', name: 'Seaweed', c: { main: '#2e7d4f', bag: '#2e7d4f', bagDark: '#1f5c38', accent: '#b8f33c', ribbon: '#b8f33c', chipA: '#1f6b3a', chipB: '#1d2b22', scan: '#0f2a1a' } },
  { id: 'bbq', name: 'Smoky BBQ', c: { main: '#a0522d', bag: '#a0522d', bagDark: '#7a3b1e', accent: '#ffb703', ribbon: '#ffb703', chipA: '#7a3b16', chipB: '#4a2410', scan: '#3b1d08' } },
];

export const BAG = { w: 96, h: 128, winX: 18, winY: 42, winSize: 60 };

const GOLD = '#f4c542';
const GOLD_D = '#d9a520';

/** A little golden chip with ridges and seasoning flecks. */
export function chipSprite(p: Painter, cx: number, cy: number, rx: number, ry: number, fleck: string) {
  p.ellipse(cx, cy + 1, rx + 1, ry + 1, INK);
  p.ellipse(cx, cy, rx, ry, GOLD);
  for (let x = Math.round(cx - rx + 2); x < cx + rx - 1; x += 3) p.rect(x, Math.round(cy - ry * 0.4), 1, Math.max(1, Math.round(ry * 0.9)), GOLD_D);
  p.px(cx - rx * 0.4, cy - ry * 0.3, '#fff1b8');
  p.px(cx + rx * 0.3, cy + ry * 0.1, fleck).px(cx - rx * 0.2, cy + ry * 0.3, fleck);
}

/** Chipper, the mascot: a potato chip in cool sunglasses. */
function chipper(p: Painter, x: number, y: number) {
  const L = new Painter(34, 34);
  L.thickLine(9, 22, 5, 27, 0.8, INK);
  L.thickLine(25, 22, 30, 17, 0.8, INK);
  L.disc(4.5, 28, 2.4, '#ffffff');
  L.disc(30.5, 16, 2.4, '#ffffff');
  L.thickLine(13, 27, 12, 32, 0.8, INK);
  L.thickLine(20, 27, 21, 32, 0.8, INK);
  L.ellipse(11, 32.5, 3, 1.6, '#ff5d73');
  L.ellipse(22, 32.5, 3, 1.6, '#ff5d73');
  L.ellipse(17, 17, 11, 12, GOLD);
  for (let yy = 8; yy < 28; yy += 4) L.rect(8, yy, 18, 1, GOLD_D);
  L.ellipse(13, 12, 3, 2, '#fff1b8');
  // sunglasses
  L.rect(8, 14, 18, 2, INK);
  L.roundRect(8, 14, 8, 5, 2, INK);
  L.roundRect(18, 14, 8, 5, 2, INK);
  L.px(10, 15, '#7ee0ff').px(20, 15, '#7ee0ff');
  // grin
  L.rect(13, 22, 8, 1, '#7a1f2b');
  L.px(12, 21, '#7a1f2b').px(21, 21, '#7a1f2b');
  L.rect(14, 23, 6, 1, '#ffffff');
  L.outline(INK);
  p.blit(L, x, y);
}

function flavorIcon(p: Painter, f: Flavor, x: number, y: number) {
  if (f.id === 'tomyum') {
    // chilli + lemongrass
    p.poly([[x, y + 6], [x + 7, y + 1], [x + 8, y + 3], [x + 2, y + 8]], '#ff3b30');
    p.rect(x + 7, y, 2, 2, '#3ddc84');
    p.rect(x + 10, y, 1, 8, '#b8f33c');
  } else if (f.id === 'nori') {
    p.rect(x, y + 1, 9, 7, '#14532d');
    p.rect(x + 1, y + 2, 7, 1, '#2e7d4f');
  } else if (f.id === 'bbq') {
    p.poly([[x + 4, y], [x + 8, y + 5], [x + 6, y + 8], [x + 2, y + 8], [x, y + 5]], '#ff8a1f');
    p.poly([[x + 4, y + 3], [x + 6, y + 6], [x + 4, y + 8], [x + 2, y + 6]], '#ffd23f');
  } else {
    for (const [dx, dy] of [[0, 4], [3, 1], [6, 4], [3, 6], [8, 0]]) p.rect(x + dx, y + dy, 2, 2, '#ffffff');
  }
}

/** Bag front. `window` leaves a white plate in the middle for posters. */
export function bagFront(f: Flavor, window = false): Painter {
  const { w, h, winX, winY, winSize } = BAG;
  const p = new Painter(w, h);
  p.clear(f.c.bag);
  // metallic sheen
  p.rect(9, 0, 5, h, shade(f.c.bag, 0.12));
  p.rect(16, 0, 2, h, shade(f.c.bag, 0.08));
  p.rect(w - 12, 0, 3, h, shade(f.c.bag, -0.1));
  p.dither(0, 0, w, 6, shade(f.c.bag, -0.2), 0.5);
  p.dither(0, h - 6, w, 6, shade(f.c.bag, -0.2), 0.5);
  // burst behind the logo
  p.burst(w / 2, 20, 30, 18, INK);
  p.burst(w / 2, 20, 28, 18, f.c.accent);
  p.text('CRUNCH', w / 2, 8, { font: FONT_BIG, scale: 2, bold: true, color: '#ffffff', outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  p.text('BYTES', w / 2 + 6, 25, { font: FONT_BIG, scale: 2, bold: true, color: f.c.bag, outline: '#ffffff', outlineWidth: 1, align: 'center' });
  if (window) {
    p.roundRect(winX - 3, winY - 3, winSize + 6, winSize + 6, 6, INK);
    p.roundRect(winX - 2, winY - 2, winSize + 4, winSize + 4, 5, '#ffffff');
  } else {
    // chip pile + mascot
    const pile: [number, number][] = [
      [30, 88], [44, 90], [58, 88], [24, 80], [38, 80], [52, 82], [32, 72], [46, 72], [40, 64],
    ];
    for (const [x, y] of pile) chipSprite(p, x, y, 8, 5, f.c.chipA);
    chipper(p, 56, 50);
    // flying crumbs
    chipSprite(p, 18, 56, 5, 3, f.c.chipB);
    chipSprite(p, 80, 92, 6, 4, f.c.chipA);
  }
  // flavour ribbon
  p.rect(0, 102, w, 13, INK);
  p.rect(0, 103, w, 11, shade(f.c.bag, -0.35));
  flavorIcon(p, f, 6, 104);
  p.text(f.name.toUpperCase(), w / 2 + 6, 105, { font: FONT_BIG, color: f.c.ribbon, align: 'center' });
  // weight + badges
  p.roundRect(4, 117, 22, 8, 2, '#ffffff');
  p.text('75G', 15, 118, { font: FONT_TINY, color: INK, align: 'center' });
  p.text('8-BIT CRUNCH', 62, 119, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  p.burst(84, 48, 9, 10, INK);
  p.burst(84, 48, 8, 10, '#ff5d73');
  p.text('NEW', 84, 46, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  return p;
}

export function bagBack(f: Flavor): Painter {
  const p = new Painter(BAG.w, BAG.h);
  p.clear(shade(f.c.bag, -0.06));
  p.text('BYTE FACTS', BAG.w / 2, 8, { font: FONT_BIG, bold: true, color: '#ffffff', outline: INK, align: 'center' });
  p.rect(10, 22, BAG.w - 20, 62, INK);
  p.rect(11, 23, BAG.w - 22, 60, '#ffffff');
  const rows: [string, string][] = [
    ['SERVING', '1 SCAN'],
    ['CRUNCH', '110%'],
    ['PIXELS', '4096'],
    ['SALT', 'JUST OK'],
    ['BUGS', '0'],
    ['FUN', 'MAX'],
  ];
  rows.forEach(([k, v], i) => {
    const y = 26 + i * 9;
    p.text(k, 14, y, { font: FONT_TINY, color: INK });
    p.text(v, BAG.w - 14, y, { font: FONT_TINY, color: INK, align: 'right' });
    p.rect(12, y + 6, BAG.w - 24, 1, '#d8d4cc');
  });
  p.text('KEEP CALM AND', BAG.w / 2, 92, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  p.text('CRUNCH ON', BAG.w / 2, 100, { font: FONT_BIG, color: f.c.accent, outline: INK, align: 'center' });
  p.rect(28, 112, 40, 12, '#ffffff');
  for (let x = 30; x < 66; x += 2) p.rect(x, 113, x % 6 === 0 ? 2 : 1, 10, INK);
  return p;
}

export function bagFrontSmall(f: Flavor): Painter {
  const p = new Painter(24, 32);
  p.clear(f.c.bag);
  p.rect(3, 0, 1, 32, shade(f.c.bag, 0.12));
  p.burst(12, 7, 9, 12, f.c.accent);
  p.text('CRUNCH', 12, 1, { font: FONT_TINY, color: INK, align: 'center' });
  p.text('BYTES', 12, 7, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  for (const [x, y] of [[7, 20], [13, 21], [18, 19], [10, 16], [15, 15]]) {
    p.ellipse(x, y, 3, 2, GOLD);
    p.px(x - 1, y - 1, '#fff1b8');
  }
  p.rect(0, 25, 24, 4, INK);
  p.rect(2, 26, 20, 2, f.c.ribbon);
  return p;
}

export function crimp(f: Flavor, top: boolean): Painter {
  const w = BAG.w;
  const h = 10;
  const p = new Painter(w, h);
  p.rect(0, top ? 3 : 0, w, 7, f.c.bagDark);
  for (let x = 0; x < w; x += 4) {
    if (top) p.poly([[x, 3], [x + 2, 0], [x + 4, 3]], f.c.bagDark);
    else p.poly([[x, 7], [x + 2, 10], [x + 4, 7]], f.c.bagDark);
  }
  for (let x = 1; x < w; x += 2) p.rect(x, top ? 4 : 1, 1, 5, shade(f.c.bagDark, -0.14));
  return p;
}

/** Gingham napkin the chips land on: white middle (the code lives there), checked border. */
export function napkin(f: Flavor, px: number, border: number): Painter {
  const p = new Painter(px, px);
  p.clear('#ffffff');
  const c1 = shade(f.c.bag, 0.25);
  const c2 = shade(f.c.bag, 0.4);
  for (let y = 0; y < px; y += 2)
    for (let x = 0; x < px; x += 2) {
      const inBorder = x < border || y < border || x >= px - border || y >= px - border;
      if (!inBorder) continue;
      const a = (x / 2) % 2 === 0;
      const b = (y / 2) % 2 === 0;
      p.rect(x, y, 2, 2, a && b ? f.c.bag : a || b ? c1 : c2);
    }
  p.strokeRect(border, border, px - border * 2, px - border * 2, shade(f.c.bag, 0.3));
  return p;
}

/** Chipper as voxels (≈16×22×6). */
export function chipperVoxels(f: Flavor): VoxelGrid {
  const g = new VoxelGrid(18, 22, 7);
  g.ellipsoid(9, 13, 3.5, 7.5, 8.5, 2.4, GOLD);
  g.paint((_x, y, z) => (y % 3 === 0 && z >= 4 ? GOLD_D : null));
  g.set(5, 16, 5, f.c.chipA).set(12, 9, 5, f.c.chipA).set(8, 7, 5, f.c.chipA);
  // sunglasses
  g.box(3, 14, 5, 15, 15, 6, INK);
  g.box(4, 13, 6, 7, 15, 6, INK);
  g.box(11, 13, 6, 14, 15, 6, INK);
  g.set(5, 14, 6, '#7ee0ff').set(12, 14, 6, '#7ee0ff');
  // grin
  g.box(7, 9, 6, 11, 9, 6, '#7a1f2b');
  g.set(6, 10, 6, '#7a1f2b').set(12, 10, 6, '#7a1f2b');
  // arms + gloves
  g.box(1, 10, 3, 2, 10, 3, INK);
  g.box(0, 11, 2, 1, 13, 4, '#ffffff');
  g.box(16, 11, 3, 17, 11, 3, INK);
  g.box(16, 12, 2, 17, 14, 4, '#ffffff');
  // legs + shoes
  g.box(7, 2, 3, 7, 4, 3, INK);
  g.box(11, 2, 3, 11, 4, 3, INK);
  g.box(5, 0, 2, 8, 1, 5, '#ff5d73');
  g.box(10, 0, 2, 13, 1, 5, '#ff5d73');
  return g;
}
