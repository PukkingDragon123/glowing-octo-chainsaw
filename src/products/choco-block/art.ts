import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { rng } from '../../engine/tween';
import { VoxelGrid } from '../../engine/voxel';
import type { Flavor } from '../types';

export const INK = '#1d1b26';

/**
 * main/deep/pale: sleeve colours. choco/white: the fun chocolate squares, *Scan: the camera-safe
 * versions (very dark / very bright). slab: the white-chocolate bar underneath.
 */
export const CHOCO_FLAVORS: Flavor[] = [
  { id: 'milk', name: 'Milk Classic', c: { main: '#d6283b', deep: '#9c1729', pale: '#ff7d88', accent: '#ffd23f', text: '#ffffff', choco: '#6b3a20', chocoScan: '#2a1409', white: '#fff1d8', whiteScan: '#fffbf2', slab: '#f7e6c8', ribbon: '#fff6e6' } },
  { id: 'dark', name: 'Dark 70%', c: { main: '#23305e', deep: '#141b3a', pale: '#4b5c9e', accent: '#f2c14e', text: '#ffffff', choco: '#40220f', chocoScan: '#1e0e05', white: '#fbeed6', whiteScan: '#fffbf2', slab: '#f3e2c2', ribbon: '#f2c14e' } },
  { id: 'matcha', name: 'Matcha Latte', c: { main: '#4f9d5b', deep: '#2e6a39', pale: '#8fd49a', accent: '#fff09a', text: '#ffffff', choco: '#4f2d19', chocoScan: '#221008', white: '#f1f7dc', whiteScan: '#fbfdf3', slab: '#e6efc9', ribbon: '#fffbe6' } },
  { id: 'strawberry', name: 'Strawberry Swirl', c: { main: '#ff6f9f', deep: '#d23f74', pale: '#ffb3cc', accent: '#fff27a', text: '#ffffff', choco: '#6e3622', chocoScan: '#2c130a', white: '#ffe8ef', whiteScan: '#fff8fa', slab: '#fbdbe5', ribbon: '#ffffff' } },
];

/** Sleeve front art size in texture pixels (width = along the bar's x, height = along z). */
export const SLEEVE = { w: 96, h: 124 };

// -------------------------------------------------------------------------------------------------
// Sprites

/** Cocoa Bean Bo, the Choco Block mascot: a round cocoa bean with a sprout. ~32x38 px. */
export function drawBean(target: Painter, x: number, y: number, pose: 'wave' | 'cheer' | 'hug' = 'wave', flip = false) {
  const L = new Painter(34, 40);
  const bean = '#b06a33';
  const beanDark = '#7e4520';
  const beanLight = '#d08d52';
  const crease = '#5d3015';
  // feet
  L.ellipse(12.5, 36.5, 3.4, 2.1, beanDark);
  L.ellipse(21.5, 36.5, 3.4, 2.1, beanDark);
  // arms (behind the body)
  if (pose === 'cheer') {
    L.thickLine(8, 22, 3, 13, 0.9, beanDark);
    L.thickLine(26, 22, 31, 13, 0.9, beanDark);
    L.disc(3, 12, 2, bean);
    L.disc(31, 12, 2, bean);
  } else if (pose === 'hug') {
    L.thickLine(8, 23, 4, 28, 0.9, beanDark);
    L.thickLine(26, 23, 30, 28, 0.9, beanDark);
    L.disc(4, 28.5, 2, bean);
    L.disc(30, 28.5, 2, bean);
  } else {
    L.thickLine(8, 22, 3, 15, 0.9, beanDark);
    L.disc(3, 14, 2, bean);
    L.thickLine(26, 24, 30, 28, 0.9, beanDark);
    L.disc(30.5, 28.5, 2, bean);
  }
  // body: bean with rim shade + highlight
  L.ellipse(17, 23, 10.5, 12.5, beanDark);
  L.ellipse(16.3, 22.2, 9.8, 11.8, bean);
  L.ellipse(11.5, 15.5, 2.6, 3.2, beanLight);
  L.px(10, 14, '#f0b27a');
  // the bean's crease runs down from the sprout like a hair parting
  L.line(17, 11, 17, 14, crease);
  L.px(16, 15, crease);
  // sprout
  L.rect(17, 5, 1, 6, '#3f8a2f');
  L.ellipse(21.5, 5, 4.2, 2.3, '#72d24c');
  L.line(18, 5, 24, 5, '#3f8a2f');
  L.ellipse(13.5, 7, 2.6, 1.6, '#9be86e');
  // face
  L.ellipse(12.8, 21, 2.7, 3.3, '#ffffff');
  L.ellipse(21.2, 21, 2.7, 3.3, '#ffffff');
  L.disc(13.4, 21.8, 1.75, INK);
  L.disc(21.8, 21.8, 1.75, INK);
  L.px(12, 20, '#ffffff').px(20, 20, '#ffffff');
  L.ellipse(9, 25.5, 1.9, 1.1, '#ff8fa3');
  L.ellipse(25, 25.5, 1.9, 1.1, '#ff8fa3');
  L.rect(16, 26, 3, 1, '#5a1a1a');
  L.px(15, 25, '#5a1a1a').px(19, 25, '#5a1a1a');
  L.px(17, 27, '#ff6b7a');
  L.outline(INK);
  target.ctx.save();
  if (flip) {
    target.ctx.translate(Math.round(x) + L.w, Math.round(y));
    target.ctx.scale(-1, 1);
    target.ctx.drawImage(L.canvas, 0, 0);
  } else target.ctx.drawImage(L.canvas, Math.round(x), Math.round(y));
  target.ctx.restore();
}

/** A piece of chocolate bar: cols x rows pillow squares of `s` px, optional bite from the top-right. */
export function drawChocoPiece(target: Painter, x: number, y: number, cols: number, rows: number, s: number, color: string, bite = false) {
  const L = new Painter(cols * s + 2, rows * s + 2);
  const groove = shade(color, -0.12);
  const hi = shade(color, 0.16);
  const lo = shade(color, -0.2);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const px = 1 + i * s;
      const py = 1 + j * s;
      L.rect(px, py, s, s, groove);
      L.rect(px + 1, py + 1, s - 2, s - 2, color);
      L.rect(px + 1, py + 1, s - 2, 1, hi);
      L.rect(px + 1, py + 1, 1, s - 2, hi);
      L.rect(px + 2, py + s - 2, s - 3, 1, lo);
      L.rect(px + s - 2, py + 2, 1, s - 3, lo);
      if (s >= 8) L.rect(px + 3, py + 3, s - 6, s - 6, shade(color, 0.05));
    }
  if (bite) {
    // bite marks: three overlapping round bites out of the top-right corner
    const bx = cols * s - 1;
    L.ctx.globalCompositeOperation = 'destination-out';
    L.disc(bx, 2, s * 0.62, '#000');
    L.disc(bx - s * 0.55, 0, s * 0.42, '#000');
    L.disc(bx + 1, s * 0.62, s * 0.4, '#000');
    L.ctx.globalCompositeOperation = 'source-over';
  }
  L.outline(INK);
  target.blit(L, x - 1, y - 1);
}

/** Wavy melted-chocolate band across the top of a panel. */
function drips(p: Painter, w: number, depth: number, color: string, seed: number) {
  const L = new Painter(w, depth + 10);
  const rnd = rng(seed);
  L.rect(0, 0, w, depth, color);
  for (let x = 2; x < w - 2; x += 5 + Math.floor(rnd() * 5)) {
    const len = 2 + Math.floor(rnd() * 8);
    const r = 1.5 + rnd() * 1.2;
    L.rect(x - r + 0.5, depth - 1, r * 2, len, color);
    L.disc(x + 0.5, depth - 1 + len, r + 0.3, color);
  }
  // glossy streak
  L.rect(0, 2, w, 1, shade(color, 0.14));
  for (let x = 3; x < w; x += 11) L.rect(x, 4, 3, 1, shade(color, 0.22));
  const out = new Painter(w, depth + 11);
  out.blit(L, 0, 0);
  out.outline(INK);
  p.blit(out, 0, 0);
}

function sparkle(p: Painter, x: number, y: number, color = '#ffffff') {
  p.px(x, y - 2, color).px(x, y - 1, color).px(x, y + 1, color).px(x, y + 2, color);
  p.px(x - 2, y, color).px(x - 1, y, color).px(x + 1, y, color).px(x + 2, y, color);
  p.px(x, y, '#ffffff');
}

function badge(p: Painter, cx: number, cy: number, r: number, bg: string, label: string, fg = INK) {
  p.disc(cx, cy, r + 1, INK);
  p.disc(cx, cy, r, bg);
  p.text(label, cx + 0.5, cy - 2, { font: FONT_TINY, color: fg, align: 'center' });
}

function logo(p: Painter, f: Flavor, cx: number, y: number) {
  const shadow = f.c.deep;
  p.text('CHOCO', cx, y, { font: FONT_BIG, scale: 2, bold: true, color: f.c.text, outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  p.text('BLOCK', cx, y + 17, { font: FONT_BIG, scale: 2, bold: true, color: f.c.accent, outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  // little chocolate square as the dot of a "tm"
  p.rect(cx + 34, y + 1, 4, 4, INK);
  p.rect(cx + 35, y + 2, 2, 2, shadow);
}

// -------------------------------------------------------------------------------------------------
// Sleeve

export function sleeveFront(f: Flavor): Painter {
  const { w, h } = SLEEVE;
  const p = new Painter(w, h);
  p.clear(f.c.main);
  // diagonal pinstripes
  for (let i = -h; i < w; i += 7) p.line(i, h, i + h, 0, shade(f.c.main, 0.05));
  // side bands
  p.rect(0, 0, 3, h, f.c.deep);
  p.rect(w - 3, 0, 3, h, f.c.deep);
  p.rect(3, 0, 1, h, shade(f.c.main, 0.12));

  drips(p, w, 7, '#6b3a22', 11);
  logo(p, f, w / 2, 16);

  // showcase window with sunburst
  const wx = 9;
  const wy = 54;
  const ww = w - 18;
  const wh = 44;
  const win = new Painter(w, h);
  win.roundRect(wx, wy, ww, wh, 6, '#fff4df');
  const cx = wx + ww / 2;
  const cy = wy + wh + 6;
  for (let a = 0; a < 12; a++) {
    const a0 = Math.PI + (a / 12) * Math.PI;
    const a1 = a0 + Math.PI / 24;
    win.poly([[cx, cy], [cx + Math.cos(a0) * 90, cy + Math.sin(a0) * 90], [cx + Math.cos(a1) * 90, cy + Math.sin(a1) * 90]], '#ffe7bf');
  }
  // keep rays inside the window
  win.ctx.globalCompositeOperation = 'destination-in';
  const mask = new Painter(w, h);
  mask.roundRect(wx, wy, ww, wh, 6, '#000');
  win.ctx.drawImage(mask.canvas, 0, 0);
  win.ctx.globalCompositeOperation = 'source-over';
  win.outline(INK);
  p.blit(win, 0, 0);

  // chocolate piece + mascot hugging it
  drawChocoPiece(p, 15, 64, 3, 3, 10, f.c.choco, true);
  drawBean(p, 44, 58, 'wave');
  sparkle(p, 20, 60, '#ffffff');
  sparkle(p, 80, 64, f.c.accent);
  sparkle(p, 73, 92, '#ffffff');
  // splash drops
  p.disc(47, 93, 1.5, '#6b3a22').disc(51, 95, 1, '#6b3a22');

  // flavour ribbon
  const ry = 100;
  p.poly([[6, ry + 1], [14, ry + 1], [14, ry + 9], [6, ry + 9], [9, ry + 5]], shade(f.c.ribbon, -0.25));
  p.poly([[w - 6, ry + 1], [w - 14, ry + 1], [w - 14, ry + 9], [w - 6, ry + 9], [w - 9, ry + 5]], shade(f.c.ribbon, -0.25));
  p.rect(12, ry - 1, w - 24, 10, INK);
  p.rect(13, ry, w - 26, 8, f.c.ribbon);
  p.rect(13, ry + 6, w - 26, 2, shade(f.c.ribbon, -0.1));
  p.text(f.name.toUpperCase(), w / 2, ry + 2, { font: FONT_TINY, color: f.id === 'dark' ? INK : f.c.deep, align: 'center' });

  // weight tag
  p.roundRect(6, 111, 28, 11, 3, INK);
  p.roundRect(7, 112, 26, 9, 2, '#ffffff');
  p.text('100g', 20, 113, { font: FONT_BIG, color: INK, align: 'center' });
  // badges
  badge(p, 60, 116, 5, f.c.accent, 'QR');
  badge(p, 73, 116, 5, '#ffffff', '★', f.c.main);
  badge(p, 86, 116, 5, f.c.pale, f.id === 'dark' ? '70' : '♥', f.id === 'dark' ? INK : f.c.deep);

  // NEW burst
  p.burst(82, 51, 9, 12, INK);
  p.burst(82, 51, 8, 12, f.c.accent);
  p.text('NEW', 82.5, 49, { font: FONT_TINY, color: INK, align: 'center' });
  return p;
}

export function sleeveBack(f: Flavor): Painter {
  const { w, h } = SLEEVE;
  const p = new Painter(w, h);
  p.clear('#fff8ec');
  p.rect(0, 0, w, 20, f.c.main);
  drips(p, w, 4, '#6b3a22', 23);
  p.text('CHOCO BLOCK', w / 2, 10, { font: FONT_BIG, bold: true, color: f.c.text, outline: INK, align: 'center' });
  // how to enjoy: slide, snap, scan
  p.text('HOW TO ENJOY', w / 2, 25, { font: FONT_TINY, color: f.c.deep, align: 'center' });
  const steps = ['SLIDE', 'SNAP', 'SCAN'];
  steps.forEach((s, i) => {
    const x = 6 + i * 29;
    p.roundRect(x, 32, 26, 22, 3, INK);
    p.roundRect(x + 1, 33, 24, 20, 2, i === 1 ? '#ffe9c7' : '#ffffff');
    if (i === 0) {
      p.rect(x + 5, 38, 12, 10, f.c.main);
      p.rect(x + 3, 40, 3, 6, '#c9d0da');
      p.rect(x + 17, 42, 5, 1, INK).px(x + 20, 41, INK).px(x + 20, 43, INK);
    } else if (i === 1) {
      drawChocoPiece(p, x + 5, 37, 2, 2, 7, f.c.choco);
      p.px(x + 20, 36, INK).px(x + 21, 35, INK).px(x + 20, 50, INK);
    } else {
      p.rect(x + 8, 35, 10, 16, INK);
      p.rect(x + 9, 37, 8, 11, '#8fe3ff');
      p.rect(x + 10, 38, 3, 3, INK).rect(x + 14, 38, 2, 2, INK).rect(x + 10, 44, 2, 2, INK).rect(x + 13, 42, 3, 4, INK);
    }
    p.text(s, x + 13, 56, { font: FONT_TINY, color: INK, align: 'center' });
  });
  // QR-trition facts
  const tx = 6;
  const ty = 66;
  const tw = w - 42;
  p.rect(tx - 1, ty - 1, tw + 2, 38, INK);
  p.rect(tx, ty, tw, 36, '#ffffff');
  p.text('QR-TRITION', tx + 2, ty + 2, { font: FONT_TINY, color: INK });
  p.rect(tx + 1, ty + 8, tw - 2, 1, INK);
  const rows: [string, string][] = [
    ['SQUARES', '100%'],
    ['SNAPS', 'MAX'],
    ['SCANS', '1'],
    ['JOY', '200%'],
  ];
  rows.forEach(([k, v], i) => {
    const ry = ty + 10 + i * 6.5;
    p.text(k, tx + 2, ry, { font: FONT_TINY, color: INK });
    p.text(v, tx + tw - 2, ry, { font: FONT_TINY, color: INK, align: 'right' });
    if (i < rows.length - 1) p.rect(tx + 1, ry + 5.5, tw - 2, 1, '#d9d4cc');
  });
  // barcode + weight
  p.rect(6, 108, 36, 12, '#ffffff');
  p.strokeRect(6, 108, 36, 12, INK);
  for (let x = 8; x < 40; x += 2) p.rect(x, 110, x % 5 === 0 ? 2 : 1, 7, INK);
  p.text('100g', 66, 107, { font: FONT_BIG, color: f.c.deep, align: 'center' });
  p.text('BEST BEFORE', 69, 115, { font: FONT_TINY, color: '#8a8175', align: 'center' });
  drawBean(p, w - 36, 64, 'cheer', true);
  return p;
}

/** Long edge of the sleeve (thin strip): stripes in flavour colours. */
export function sleeveEdge(f: Flavor, w = 124, h = 8): Painter {
  const p = new Painter(w, h);
  p.clear(f.c.main);
  p.rect(0, 0, w, 1, shade(f.c.main, 0.15));
  p.rect(0, h - 1, w, 1, f.c.deep);
  for (let x = 4; x < w; x += 10) {
    p.rect(x, 3, 4, 2, '#6b3a22');
    p.rect(x, 3, 4, 1, '#8a5234');
  }
  return p;
}

/** Crinkled silver foil: big faceted crinkles with bright glints. */
export const FOIL = { base: '#dde3eb', hi: '#fbfdff', mid: '#e9edf2', lo: '#b9c2cf', crease: '#939eb0', edge: '#7c879a' };

function crinkle(p: Painter, x0: number, y0: number, w: number, h: number, seed: number, density = 1) {
  const rnd = rng(seed);
  const n = Math.round(((w * h) / 40) * density);
  const cols = [FOIL.hi, FOIL.mid, FOIL.lo, FOIL.mid, FOIL.hi];
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * w;
    const y = y0 + rnd() * h;
    const s = 4 + rnd() * 9;
    const a = rnd() * Math.PI * 2;
    const pts: [number, number][] = [];
    for (let k = 0; k < 3; k++) {
      const aa = a + (k * Math.PI * 2) / 3 + (rnd() - 0.5) * 0.9;
      pts.push([x + Math.cos(aa) * s * (0.5 + rnd() * 0.5), y + Math.sin(aa) * s * (0.5 + rnd() * 0.5)]);
    }
    p.poly(pts, cols[Math.floor(rnd() * cols.length)]);
  }
  for (let i = 0; i < n / 4; i++) {
    const x = x0 + rnd() * w;
    const y = y0 + rnd() * h;
    const dx = (rnd() - 0.5) * 16;
    const dy = (rnd() - 0.5) * 16;
    p.line(x, y, x + dx, y + dy, FOIL.crease);
    p.line(x, y - 1, x + dx, y + dy - 1, '#ffffff');
  }
  for (let i = 0; i < n / 3; i++) p.px(Math.floor(x0 + rnd() * w), Math.floor(y0 + rnd() * h), '#ffffff');
}

/** Tileable foil pattern (used on the small shelf pack). */
export function foilTile(size = 48, seed = 5): Painter {
  const p = new Painter(size, size);
  p.clear(FOIL.base);
  crinkle(p, 0, 0, size, size, seed);
  return p;
}

/** Foil flap triangle (base along the bottom, apex at top centre) with a pixel edge line. */
export function foilTriangle(w = 96, h = 48, seed = 3): Painter {
  const p = new Painter(w, h);
  p.clear(FOIL.base);
  crinkle(p, 0, 0, w, h, seed, 1.2);
  // fold line down the middle + edge lines along the slanted sides
  p.line(w / 2, 2, w / 2, h - 1, FOIL.lo);
  p.line(0, h - 1, w / 2 - 1, 0, FOIL.edge);
  p.line(w - 1, h - 1, w / 2, 0, FOIL.edge);
  p.line(2, h - 1, w / 2, 2, '#ffffff');
  p.rect(0, h - 1, w, 1, FOIL.lo);
  return p;
}

/** Foil wall strip that wraps the side of the bar. */
export function foilWall(w = 96, h = 10, seed = 9): Painter {
  const p = new Painter(w, h);
  p.clear(FOIL.base);
  crinkle(p, 0, 0, w, h, seed, 1.4);
  p.rect(0, 0, w, 1, FOIL.edge);
  p.rect(0, h - 1, w, 1, FOIL.lo);
  p.rect(0, 1, w, 1, '#ffffff');
  return p;
}

// -------------------------------------------------------------------------------------------------
// Poster art

export const POSTER = { w: 112, h: 174, qrX: 16, qrY: 52, qrSize: 80 };

export function posterArt(f: Flavor): Painter {
  const { w, h, qrX, qrY, qrSize } = POSTER;
  const p = new Painter(w, h);
  p.clear(f.c.main);
  for (let i = -h; i < w; i += 7) p.line(i, h, i + h, 0, shade(f.c.main, 0.05));
  drips(p, w, 8, '#6b3a22', 31);
  logo(p, f, w / 2, 14);
  // chocolate bar: a white-chocolate slab with rim (the QR is composited into it)
  p.rect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, INK);
  p.rect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, shade(f.c.white, -0.08));
  p.rect(qrX - 4, qrY - 4, qrSize + 8, 1, '#ffffff');
  p.rect(qrX - 4, qrY - 4, 1, qrSize + 8, '#ffffff');
  p.rect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, f.c.white);
  // drop shadow of the bar
  p.rect(qrX + qrSize + 5, qrY - 2, 2, qrSize + 9, f.c.deep);
  p.rect(qrX - 2, qrY + qrSize + 5, qrSize + 9, 2, f.c.deep);
  // bottom row: mascot, flavour, weight, badges
  drawBean(p, 4, h - 41, 'cheer');
  p.text(f.name.toUpperCase(), 42, h - 32, { font: FONT_TINY, color: f.c.text, outline: INK });
  p.roundRect(42, h - 22, 28, 11, 3, INK);
  p.roundRect(43, h - 21, 26, 9, 2, '#ffffff');
  p.text('100g', 56, h - 20, { font: FONT_BIG, color: INK, align: 'center' });
  badge(p, 82, h - 16, 5, f.c.accent, 'QR');
  badge(p, 96, h - 16, 5, '#ffffff', '★', f.c.main);
  p.burst(w - 12, 13, 9, 12, INK);
  p.burst(w - 12, 13, 8, 12, f.c.accent);
  p.text('NEW', w - 11.5, 11, { font: FONT_TINY, color: INK, align: 'center' });
  return p;
}

// -------------------------------------------------------------------------------------------------
// Voxel mascot

/** Cocoa Bean Bo as voxels (~17 x 24 x 12). Faces +z. */
export function beanVoxels(): VoxelGrid {
  const g = new VoxelGrid(19, 26, 13);
  const bean = '#b06a33';
  const dark = '#7e4520';
  const light = '#c98247';
  const cx = 9.5;
  const cz = 6.5;
  // feet
  g.box(5, 0, 5, 7, 1, 9, dark);
  g.box(12, 0, 5, 14, 1, 9, dark);
  // body
  g.ellipsoid(cx, 12, cz, 7.2, 9.6, 5.6, bean);
  g.paint((x, y, z) => {
    if (y < 7 && (x + y + z) % 2 === 0) return dark;
    if (y > 15 && x < 8 && z > 6) return light;
    return null;
  });
  // arms
  g.box(1, 10, 6, 2, 11, 7, dark);
  g.box(0, 11, 6, 0, 13, 7, bean);
  g.box(17, 10, 6, 18, 11, 7, dark);
  g.box(18, 11, 6, 18, 13, 7, bean);
  // crease + sprout
  g.box(9, 19, 11, 10, 21, 11, '#5d3015');
  g.box(9, 21, 6, 10, 23, 7, '#3f8a2f');
  g.box(10, 23, 5, 14, 24, 8, '#72d24c');
  g.box(6, 22, 6, 8, 22, 7, '#9be86e');
  // face on the front surface
  const front = (x: number, y: number) => {
    for (let z = g.sz - 1; z >= 0; z--) if (g.filled(x, y, z)) return z;
    return -1;
  };
  const dot = (x: number, y: number, color: string, pop = true) => {
    const z = front(x, y);
    if (z < 0) return;
    g.set(x, y, pop ? z + 1 : z, color);
  };
  // big black eyes with a glint, blush, little smile
  for (const ex of [6, 12]) {
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) dot(ex + dx, 11 + dy, INK, false);
    dot(ex, 13, '#ffffff', false);
  }
  dot(4, 10, '#ff8fa3', false);
  dot(5, 10, '#ff8fa3', false);
  dot(14, 10, '#ff8fa3', false);
  dot(15, 10, '#ff8fa3', false);
  dot(9, 9, '#5a1a1a', false);
  dot(10, 9, '#5a1a1a', false);
  dot(8, 10, '#5a1a1a', false);
  dot(11, 10, '#5a1a1a', false);
  return g;
}
