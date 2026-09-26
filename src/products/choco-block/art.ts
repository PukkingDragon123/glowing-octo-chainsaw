import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { rng } from '../../engine/tween';
import { buddyPortrait, type BuddySpec, type Pose } from '../../art/buddy';
import { CAST } from '../../art/cast';
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

/** Where the link sticker goes on the sleeve front: the cream label ribbon (texture px). */
export const LABEL = { cx: 48, cy: 111, w: 72, h: 24 };

const cache = new Map<string, HTMLCanvasElement>();
/** Choco, the Choco Block buddy, as a flat portrait (cached). */
function chocoPortrait(pose: Pose, key: string, spec: BuddySpec = CAST.choco) {
  let c = cache.get(key);
  if (!c) {
    c = buddyPortrait(spec, pose).toCanvas();
    cache.set(key, c);
  }
  return c;
}

/** A slightly smaller Choco that fits the sleeve window. */
const CHOCO_SLEEVE: BuddySpec = { ...CAST.choco, body: { ...CAST.choco.body, w: 32, h: 31 } };

function stamp(p: Painter, c: HTMLCanvasElement, x: number, y: number, flip = false) {
  p.ctx.save();
  if (flip) {
    p.ctx.translate(Math.round(x) + c.width, Math.round(y));
    p.ctx.scale(-1, 1);
    p.ctx.drawImage(c, 0, 0);
  } else p.ctx.drawImage(c, Math.round(x), Math.round(y));
  p.ctx.restore();
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

/** Round "NEW" sticker with a scalloped edge. */
function newSticker(p: Painter, cx: number, cy: number, color: string) {
  for (const [r, c, d] of [[3, INK, 1], [2, color, 0]] as const) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      p.disc(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, r, c);
    }
    p.disc(cx, cy, 7.5 + d, c);
  }
  p.text('NEW', cx + 0.5, cy - 2, { font: FONT_TINY, color: INK, align: 'center' });
}

/** Cream ribbon banner with folded ends (the label spot on the sleeve). */
function ribbon(p: Painter, f: Flavor, cx: number, cy: number, w: number, h: number, text: string) {
  const x0 = Math.round(cx - w / 2);
  const y0 = Math.round(cy - h / 2);
  const tail = shade(f.c.ribbon, -0.22);
  p.poly([[x0 - 7, y0 + 4], [x0 + 3, y0 + 4], [x0 + 3, y0 + h + 2], [x0 - 7, y0 + h + 2], [x0 - 3, y0 + h / 2 + 3]], INK);
  p.poly([[x0 + w + 7, y0 + 4], [x0 + w - 3, y0 + 4], [x0 + w - 3, y0 + h + 2], [x0 + w + 7, y0 + h + 2], [x0 + w + 3, y0 + h / 2 + 3]], INK);
  p.poly([[x0 - 5, y0 + 5], [x0 + 3, y0 + 5], [x0 + 3, y0 + h + 1], [x0 - 5, y0 + h + 1], [x0 - 2, y0 + h / 2 + 3]], tail);
  p.poly([[x0 + w + 5, y0 + 5], [x0 + w - 3, y0 + 5], [x0 + w - 3, y0 + h + 1], [x0 + w + 5, y0 + h + 1], [x0 + w + 2, y0 + h / 2 + 3]], tail);
  p.roundRect(x0 - 1, y0 - 1, w + 2, h + 2, 5, INK);
  p.roundRect(x0, y0, w, h, 4, f.c.ribbon);
  p.rect(x0 + 3, y0 + h - 3, w - 6, 1, shade(f.c.ribbon, -0.08));
  p.text(text, cx, cy - 2, { font: FONT_TINY, color: f.id === 'dark' ? INK : f.c.deep, align: 'center' });
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
  // soft polka dots instead of pinstripes
  for (let y = 12; y < h; y += 10) for (let x = (y / 10) % 2 ? 8 : 3; x < w; x += 10) p.disc(x, y, 1.4, shade(f.c.main, 0.06));
  p.rect(0, 0, 3, h, f.c.deep);
  p.rect(w - 3, 0, 3, h, f.c.deep);
  p.rect(3, 0, 1, h, shade(f.c.main, 0.12));

  drips(p, w, 7, '#6b3a22', 11);
  logo(p, f, w / 2, 13);

  // rounded showcase window with a sunburst
  const wx = 8;
  const wy = 49;
  const ww = w - 16;
  const wh = 49;
  const win = new Painter(w, h);
  win.roundRect(wx, wy, ww, wh, 10, '#fff4df');
  const cx = wx + ww / 2;
  const cy = wy + wh + 6;
  for (let a = 0; a < 12; a++) {
    const a0 = Math.PI + (a / 12) * Math.PI;
    const a1 = a0 + Math.PI / 24;
    win.poly([[cx, cy], [cx + Math.cos(a0) * 90, cy + Math.sin(a0) * 90], [cx + Math.cos(a1) * 90, cy + Math.sin(a1) * 90]], '#ffe7bf');
  }
  win.ctx.globalCompositeOperation = 'destination-in';
  const mask = new Painter(w, h);
  mask.roundRect(wx, wy, ww, wh, 10, '#000');
  win.ctx.drawImage(mask.canvas, 0, 0);
  win.ctx.globalCompositeOperation = 'source-over';
  win.outline(INK);
  p.blit(win, 0, 0);

  // Choco hugging a bitten chocolate piece
  drawChocoPiece(p, 55, 60, 3, 3, 9, f.c.choco, true);
  const choco = chocoPortrait({ armL: 2.45, armR: 1.2, mouth: 'open' }, 'sleeve', CHOCO_SLEEVE);
  stamp(p, choco, 12, wy + wh + 3 - choco.height);
  sparkle(p, 17, 57, '#ffffff');
  sparkle(p, 84, 57, f.c.accent);
  p.disc(84, 92, 1.5, '#6b3a22').disc(88, 94, 1, '#6b3a22');

  // label ribbon: the link sticker is glued here
  ribbon(p, f, LABEL.cx, LABEL.cy, LABEL.w, LABEL.h, f.name.toUpperCase());

  newSticker(p, 87, 55, f.c.accent);
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
  const tw = w - 48;
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
  const small: BuddySpec = { ...CAST.choco, body: { ...CAST.choco.body, w: 22, h: 22 }, limbs: { ...CAST.choco.limbs!, arm: 9, leg: 6, thick: 5 } };
  const choco = chocoPortrait({ armL: 0.5, armR: 2.5, eyes: 'happy', mouth: 'open' }, 'back', small);
  stamp(p, choco, w - 1 - choco.width, 106 - choco.height);
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

export const POSTER = { w: 112, h: 190, qrX: 16, qrY: 52, qrSize: 80 };

export function posterArt(f: Flavor): Painter {
  const { w, h, qrX, qrY, qrSize } = POSTER;
  const p = new Painter(w, h);
  p.clear(f.c.main);
  for (let y = 12; y < h; y += 10) for (let x = (y / 10) % 2 ? 8 : 3; x < w; x += 10) p.disc(x, y, 1.4, shade(f.c.main, 0.06));
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
  // bottom: Choco cheering next to the tagline
  const choco = chocoPortrait({ armL: 2.45, armR: 2.45, eyes: 'happy', mouth: 'open' }, 'poster');
  stamp(p, choco, 2, h - 1 - choco.height);
  p.text('SNAP.', 84, h - 44, { font: FONT_BIG, bold: true, color: f.c.text, outline: INK, align: 'center' });
  p.text('SCAN.', 84, h - 32, { font: FONT_BIG, bold: true, color: f.c.accent, outline: INK, align: 'center' });
  p.text('SNACK!', 84, h - 20, { font: FONT_BIG, bold: true, color: f.c.text, outline: INK, align: 'center' });
  return p;
}
