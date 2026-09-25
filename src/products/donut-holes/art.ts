import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { rng } from '../../engine/tween';
import { VoxelGrid } from '../../engine/voxel';
import type { Flavor } from '../types';

export const INK = '#1d1b26';

/**
 * box/deep/pale: bakery box. text/accent: logo. frost: mascot frosting. glaze/glazeScan: the donut
 * holes (fun / camera-safe). sprinkles: comma list. brownie: finder-square brownie bites.
 */
export const DONUT_FLAVORS: Flavor[] = [
  { id: 'classic', name: 'Classic Glaze', c: { box: '#ff9ec4', deep: '#de5f97', pale: '#ffd6e7', text: '#ffffff', accent: '#7a3f22', frost: '#ff79b0', glaze: '#5a2e18', glazeScan: '#26120a', sprinkles: '#ff5d8f,#ffd23f,#4fc3ff,#7ed957,#ffffff', brownie: '#4a2816', brownieScan: '#1e0e06' } },
  { id: 'choco', name: 'Choco Sprinkle', c: { box: '#8a5433', deep: '#5c3219', pale: '#c89a74', text: '#fff4e6', accent: '#ff9ec4', frost: '#5e321c', glaze: '#40200f', glazeScan: '#1f0e06', sprinkles: '#ffffff,#ff9ec4,#f3d7b0,#ffffff', brownie: '#3d200f', brownieScan: '#1a0b04' } },
  { id: 'ube', name: 'Ube Dream', c: { box: '#8c6ad8', deep: '#6245b3', pale: '#dccfff', text: '#ffffff', accent: '#ffe066', frost: '#b99cff', glaze: '#432260', glazeScan: '#1f1030', sprinkles: '#ffffff,#ffe066,#ff9ec4,#9ff0ff', brownie: '#3e2418', brownieScan: '#1c0d07' } },
  { id: 'matcha', name: 'Matcha Mochi', c: { box: '#6fbf73', deep: '#3f8f4a', pale: '#d6f1d0', text: '#ffffff', accent: '#ff7fae', frost: '#a8e39a', glaze: '#2f4220', glazeScan: '#152010', sprinkles: '#ffffff,#ff8fb8,#ffe066,#ffffff', brownie: '#442816', brownieScan: '#1c0d06' } },
];

export function sprinkleColors(f: Flavor) {
  return f.c.sprinkles.split(',');
}

/** Box art sizes in texture pixels (8 px per 0.1 world units). */
export const BOX_PX = { w: 104, h: 56, d: 76 };
/** Lid window rectangle inside the lid-top art. */
export const WINDOW = { x: 22, y: 21, w: 60, h: 34 };

// -------------------------------------------------------------------------------------------------
// Sprites

/** Dough-R, the mascot: a frosted donut with a face, waving. ~40x42 px. */
export function drawDonut(target: Painter, x: number, y: number, f: Flavor, pose: 'wave' | 'cheer' = 'wave', flip = false) {
  const L = new Painter(42, 44);
  const cx = 21;
  const cy = 19;
  const limb = '#6b3a22';
  const frost = f.c.frost;
  // feet
  L.thickLine(16, 31, 15, 37, 0.8, limb);
  L.thickLine(26, 31, 27, 37, 0.8, limb);
  L.ellipse(14.5, 39, 3.6, 2.1, '#ff5d73');
  L.ellipse(27.5, 39, 3.6, 2.1, '#ff5d73');
  L.rect(11, 40, 7, 1, '#ffffff');
  L.rect(24, 40, 7, 1, '#ffffff');
  // arms
  if (pose === 'cheer') {
    L.thickLine(8, 17, 3, 8, 0.9, limb);
    L.thickLine(34, 17, 39, 8, 0.9, limb);
    L.disc(3, 7, 2.3, '#ffffff');
    L.disc(39, 7, 2.3, '#ffffff');
  } else {
    L.thickLine(8, 19, 3, 11, 0.9, limb);
    L.disc(3, 10, 2.3, '#ffffff');
    L.thickLine(34, 22, 39, 27, 0.9, limb);
    L.disc(39.5, 27.5, 2.3, '#ffffff');
  }
  // dough ring
  L.disc(cx, cy + 0.5, 14, '#c98a4a');
  L.disc(cx - 0.4, cy - 0.3, 13.2, '#eab676');
  // frosting with drips
  L.disc(cx, cy - 0.6, 11.4, frost);
  const drips = [0.3, 1.1, 1.7, 2.5, 3.3, 4.2, 5.0, 5.8];
  drips.forEach((a, i) => L.disc(cx + Math.cos(a) * 11.6, cy - 0.6 + Math.sin(a) * 11.6, i % 2 ? 1.9 : 1.4, frost));
  L.ellipse(cx - 5, cy - 7, 3.2, 1.8, shade(frost, 0.14));
  L.px(cx - 7, cy - 8, '#ffffff');
  // sprinkles
  const sp = sprinkleColors(f);
  const rnd = rng(17);
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 6.5 + rnd() * 4;
    const sx = cx + Math.cos(a) * r;
    const sy = cy - 0.6 + Math.sin(a) * r;
    if (sy > cy - 7 && sy < cy - 1 && Math.abs(sx - cx) > 3 && Math.abs(sx - cx) < 9) continue; // keep eyes clear
    const c = sp[i % sp.length];
    if (rnd() < 0.5) L.rect(sx, sy, 2, 1, c);
    else L.rect(sx, sy, 1, 2, c);
  }
  // hole
  L.ctx.globalCompositeOperation = 'destination-out';
  L.disc(cx, cy, 3.8, '#000');
  L.ctx.globalCompositeOperation = 'source-over';
  L.ring(cx, cy, 4.9, shade(frost, -0.18), 1);
  // face
  L.ellipse(cx - 6.5, cy - 4, 2.5, 3.1, '#ffffff');
  L.ellipse(cx + 6.5, cy - 4, 2.5, 3.1, '#ffffff');
  L.disc(cx - 6, cy - 3.3, 1.7, INK);
  L.disc(cx + 7, cy - 3.3, 1.7, INK);
  L.px(cx - 7, cy - 5, '#ffffff').px(cx + 6, cy - 5, '#ffffff');
  L.ellipse(cx - 9.5, cy + 2.5, 1.8, 1.1, '#ff4f8b');
  L.ellipse(cx + 9.5, cy + 2.5, 1.8, 1.1, '#ff4f8b');
  // big smile under the hole
  L.rect(cx - 3, cy + 7, 7, 1, '#5a1a1a');
  L.px(cx - 4, cy + 6, '#5a1a1a').px(cx + 4, cy + 6, '#5a1a1a');
  L.rect(cx - 2, cy + 8, 5, 1, '#ff6b7a');
  L.outline(INK);
  target.ctx.save();
  if (flip) {
    target.ctx.translate(Math.round(x) + L.w, Math.round(y));
    target.ctx.scale(-1, 1);
    target.ctx.drawImage(L.canvas, 0, 0);
  } else target.ctx.drawImage(L.canvas, Math.round(x), Math.round(y));
  target.ctx.restore();
}

/** Small chocolate donut hole with sprinkles (for illustrations). */
export function holeSprite(p: Painter, cx: number, cy: number, r: number, f: Flavor, seed = 1) {
  const L = new Painter(Math.ceil(r * 2 + 4), Math.ceil(r * 2 + 4));
  const c = r + 2;
  L.disc(c, c, r, f.c.glaze);
  L.ellipse(c - r * 0.35, c - r * 0.4, r * 0.4, r * 0.28, shade(f.c.glaze, 0.2));
  const sp = sprinkleColors(f);
  const rnd = rng(seed);
  for (let i = 0; i < Math.max(2, r); i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * r * 0.7;
    L.px(c + Math.cos(a) * d, c + Math.sin(a) * d, sp[Math.floor(rnd() * sp.length)]);
  }
  L.outline(INK);
  p.blit(L, cx - c, cy - c);
}

function sparkle(p: Painter, x: number, y: number, color = '#ffffff') {
  p.px(x, y - 2, color).px(x, y - 1, color).px(x, y + 1, color).px(x, y + 2, color);
  p.px(x - 2, y, color).px(x - 1, y, color).px(x + 1, y, color).px(x + 2, y, color);
}

function polka(p: Painter, w: number, h: number, color: string, step = 10, seedShift = 0) {
  for (let y = 3; y < h; y += step)
    for (let x = 3 + (((y / step) | 0) % 2) * (step / 2) + seedShift; x < w; x += step) {
      p.disc(x, y, 1.6, color);
    }
}

/** Striped awning with scalloped edge across the top of a panel. */
function awning(p: Painter, w: number, f: Flavor, h = 7) {
  const L = new Painter(w, h + 3);
  for (let x = 0; x < w; x += 8) {
    L.rect(x, 0, 4, h, '#ffffff');
    L.rect(x + 4, 0, 4, h, f.c.pale);
  }
  for (let x = 0; x < w; x += 8) {
    L.disc(x + 2, h, 2.2, '#ffffff');
    L.disc(x + 6, h, 2.2, f.c.pale);
  }
  L.outline(INK);
  p.blit(L, 0, 0);
}

// -------------------------------------------------------------------------------------------------
// Box panels

export function boxFront(f: Flavor): Painter {
  const { w, h } = BOX_PX;
  const p = new Painter(w, h);
  p.clear(f.c.box);
  polka(p, w, h, shade(f.c.box, 0.08), 10);
  p.text('DOUGH-R', w / 2, 12, { font: FONT_BIG, scale: 2, bold: true, color: f.c.text, outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  p.text('CODE', w / 2, 30, { font: FONT_BIG, scale: 2, bold: true, color: f.c.accent, outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  holeSprite(p, 17, 37, 5, f, 3);
  holeSprite(p, 25, 42, 3.5, f, 4);
  holeSprite(p, 88, 37, 5, f, 5);
  holeSprite(p, 80, 42, 3.5, f, 6);
  // bottom band
  p.rect(0, h - 8, w, 8, f.c.deep);
  p.rect(0, h - 8, w, 1, INK);
  p.text('FRESH HOLES DAILY', w / 2, h - 6, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  sparkle(p, 8, 16, '#ffffff');
  sparkle(p, 96, 22, '#ffffff');
  return p;
}

export function boxSideRight(f: Flavor): Painter {
  const { d: w, h } = BOX_PX;
  const p = new Painter(w, h);
  p.clear(f.c.box);
  polka(p, w, h, shade(f.c.box, 0.08), 10, 2);
  awning(p, w, f);
  drawDonut(p, 30, 10, f, 'wave');
  // speech bubble
  p.roundRect(3, 14, 28, 16, 4, INK);
  p.roundRect(4, 15, 26, 14, 3, '#ffffff');
  p.poly([[24, 28], [30, 28], [32, 33]], INK);
  p.poly([[25, 28], [29, 28], [30, 31]], '#ffffff');
  p.text('HOLE-Y', 17, 16, { font: FONT_TINY, color: INK, align: 'center' });
  p.text('MOLY!', 17, 22, { font: FONT_TINY, color: f.c.deep, align: 'center' });
  // weight tag
  p.roundRect(3, h - 12, 24, 10, 3, INK);
  p.roundRect(4, h - 11, 22, 8, 2, '#ffffff');
  p.text('24 PCS', 15, h - 9, { font: FONT_TINY, color: INK, align: 'center' });
  return p;
}

export function boxSideLeft(f: Flavor): Painter {
  const { d: w, h } = BOX_PX;
  const p = new Painter(w, h);
  p.clear(f.c.box);
  polka(p, w, h, shade(f.c.box, 0.08), 10, 4);
  awning(p, w, f);
  // round seal
  p.disc(w / 2, 30, 17, INK);
  p.disc(w / 2, 30, 16, '#ffffff');
  p.ring(w / 2, 30, 14, f.c.box, 1);
  p.text('BAKED', w / 2, 20, { font: FONT_TINY, color: f.c.deep, align: 'center' });
  holeSprite(p, w / 2 - 6, 30, 4, f, 8);
  holeSprite(p, w / 2 + 6, 30, 4, f, 9);
  p.text('WITH ♥', w / 2, 37, { font: FONT_TINY, color: f.c.deep, align: 'center' });
  p.text(f.name.toUpperCase(), w / 2, h - 8, { font: FONT_TINY, color: '#ffffff', outline: INK, align: 'center' });
  return p;
}

export function boxBack(f: Flavor): Painter {
  const { w, h } = BOX_PX;
  const p = new Painter(w, h);
  p.clear(shade(f.c.box, -0.04));
  polka(p, w, h, shade(f.c.box, 0.05), 12);
  p.rect(6, 6, 62, 44, INK);
  p.rect(7, 7, 60, 42, '#ffffff');
  p.text('INGREDIENTS', 9, 9, { font: FONT_TINY, color: INK });
  p.rect(8, 15, 58, 1, INK);
  ['FLOUR, SUGAR,', 'COCOA GLAZE,', 'SPRINKLES,', '1 QR CODE'].forEach((t, i) => p.text(t, 9, 18 + i * 7, { font: FONT_TINY, color: INK }));
  p.rect(74, 8, 24, 16, '#ffffff');
  p.strokeRect(74, 8, 24, 16, INK);
  for (let x = 76; x < 96; x += 2) p.rect(x, 10, x % 5 === 0 ? 2 : 1, 10, INK);
  p.text('24 PCS', 86, 30, { font: FONT_TINY, color: '#ffffff', outline: INK, align: 'center' });
  holeSprite(p, 86, 44, 6, f, 12);
  return p;
}

/** Lid top: polka dots, logo, sticker and a transparent cellophane window. */
export function lidTop(f: Flavor, window = true): Painter {
  const w = BOX_PX.w;
  const h = BOX_PX.d;
  const p = new Painter(w, h);
  p.clear(f.c.box);
  polka(p, w, h, shade(f.c.box, 0.08), 10);
  const { x, y, w: ww, h: wh } = WINDOW;
  // window frame
  p.roundRect(x - 4, y - 4, ww + 8, wh + 8, 5, INK);
  p.roundRect(x - 3, y - 3, ww + 6, wh + 6, 4, '#ffffff');
  p.rect(x - 1, y - 1, ww + 2, wh + 2, INK);
  if (window) {
    p.ctx.clearRect(x, y, ww, wh);
  } else {
    p.rect(x, y, ww, wh, '#fbf2e6');
    // tiny donut holes seen through the window (shelf model)
    let s = 7;
    for (let yy = y + 4; yy < y + wh - 2; yy += 7)
      for (let xx = x + 4 + ((yy / 7) % 2) * 3; xx < x + ww - 2; xx += 7) holeSprite(p, xx, yy, 3, f, s++);
    p.rect(x + 3, y + 2, 10, 1, '#ffffff');
    p.rect(x + 3, y + 4, 5, 1, '#ffffff');
  }
  p.text('DOUGH-R CODE', w / 2, 6, { font: FONT_BIG, bold: true, color: f.c.text, outline: INK, align: 'center' });
  p.text('HOT & FRESH', w / 2, h - 12, { font: FONT_TINY, color: '#ffffff', outline: INK, align: 'center' });
  // sticker
  p.burst(w - 12, h - 14, 10, 12, INK);
  p.burst(w - 12, h - 14, 9, 12, '#ffe066');
  p.text('FRESH', w - 11.5, h - 18, { font: FONT_TINY, color: INK, align: 'center' });
  p.text('!', w - 11.5, h - 12, { font: FONT_TINY, color: INK, align: 'center' });
  return p;
}

/** Front lip of the lid: a striped bakery awning with a scalloped (transparent) bottom edge. */
export function lidLip(f: Flavor, h = 8): Painter {
  const w = BOX_PX.w;
  const L = new Painter(w, h);
  const band = h - 3;
  for (let x = 0; x < w; x += 8) {
    L.rect(x, 0, 4, band, '#ffffff');
    L.rect(x + 4, 0, 4, band, f.c.pale);
    L.disc(x + 2, band - 0.5, 2.2, '#ffffff');
    L.disc(x + 6, band - 0.5, 2.2, f.c.pale);
  }
  L.rect(0, 0, w, 1, f.c.deep);
  const out = new Painter(w, h);
  out.blit(L, 0, 0);
  out.outline(INK);
  // outline() only fills transparent pixels; add the side ink where the strip meets the lid
  out.rect(0, 0, w, 1, INK);
  return out;
}

/** Underside of the lid: cardboard with the same window hole (mirrored like the box face UVs). */
export function lidUnder(f: Flavor): Painter {
  const w = BOX_PX.w;
  const h = BOX_PX.d;
  const p = boxInside(f, w, h);
  const { x, y, w: ww, h: wh } = WINDOW;
  p.rect(x - 2, h - y - wh - 2, ww + 4, wh + 4, shade(f.c.pale, -0.12));
  p.ctx.clearRect(x, h - y - wh, ww, wh);
  return p;
}

/** Cellophane: faint white with diagonal shine streaks (drawn with transparency). */
export function cellophane(): Painter {
  const p = new Painter(32, 20);
  p.clear('rgba(255,255,255,0.18)');
  for (let i = -20; i < 32; i += 11) {
    p.poly([[i, 20], [i + 3, 20], [i + 23, 0], [i + 20, 0]], 'rgba(255,255,255,0.55)');
    p.poly([[i + 5, 20], [i + 6, 20], [i + 26, 0], [i + 25, 0]], 'rgba(255,255,255,0.4)');
  }
  return p;
}

/** Plain cardboard inside the box. */
export function boxInside(f: Flavor, w: number, h: number): Painter {
  const p = new Painter(w, h);
  p.clear(shade(f.c.pale, 0.05));
  p.dither(0, 0, w, h, shade(f.c.pale, -0.05), 0.12);
  return p;
}

/** Wax paper: warm off-white with soft creases and grease sheen (stays bright for scanning). */
export function waxPaper(size = 96, seed = 3): Painter {
  const p = new Painter(size, size);
  p.clear('#f6f0e4');
  const rnd = rng(seed);
  // translucent sheen patches
  for (let i = 0; i < 6; i++) p.ellipse(rnd() * size, rnd() * size, 6 + rnd() * 10, 3 + rnd() * 6, '#fbf8f1');
  // creases: a darker valley line with a bright ridge beside it
  for (let i = 0; i < 12; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const len = 14 + rnd() * 34;
    const a = rnd() * Math.PI;
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;
    p.line(x, y, ex, ey, '#e3d8c4');
    p.line(x + 1, y + 1, ex + 1, ey + 1, '#ffffff');
  }
  for (let i = 0; i < 50; i++) p.px(Math.floor(rnd() * size), Math.floor(rnd() * size), '#ebe2d1');
  return p;
}

/** The big wax-paper sheet: creases plus a printed dashed border and corner hearts in the margin. */
export function waxSheet(f: Flavor, size: number, margin: number): Painter {
  const p = new Painter(size, size);
  const tile = waxPaper(96, 3);
  for (let y = 0; y < size; y += 96) for (let x = 0; x < size; x += 96) p.blit(tile, x, y);
  const ink = shade(f.c.box, 0.05);
  const b = Math.max(2, Math.round(margin * 0.45));
  for (let x = b; x < size - b; x += 6) {
    p.rect(x, b, 3, 1, ink);
    p.rect(x, size - b - 1, 3, 1, ink);
  }
  for (let y = b; y < size - b; y += 6) {
    p.rect(b, y, 1, 3, ink);
    p.rect(size - b - 1, y, 1, 3, ink);
  }
  for (const [cx, cy] of [[b, b], [size - b - 1, b], [b, size - b - 1], [size - b - 1, size - b - 1]]) p.text('♥', cx + 0.5, cy - 3, { font: FONT_TINY, color: ink, align: 'center' });
  return p;
}

/** Tile texture for the donut-hole spheres: glaze + sprinkles (u wraps around, v pole to pole). */
export function glazeTexture(f: Flavor, withSprinkles: boolean, scan = false): Painter {
  const w = 32;
  const h = 16;
  const p = new Painter(w, h);
  const base = scan ? f.c.glazeScan : f.c.glaze;
  p.clear(base);
  if (!scan) {
    // glossy streak band + darker drip bottom
    p.rect(0, 3, w, 2, shade(base, 0.1));
    p.rect(0, 12, w, 4, shade(base, -0.06));
  }
  if (withSprinkles) {
    const sp = sprinkleColors(f);
    const rnd = rng(5);
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(rnd() * w);
      const y = 2 + Math.floor(rnd() * (h - 4));
      const c = sp[i % sp.length];
      if (rnd() < 0.5) p.rect(x, y, 2, 1, c);
      else p.rect(x, y, 1, 2, c);
    }
  }
  return p;
}

/** Brownie bite tile: fudgy dark top with crackle lines. */
export function brownieTexture(f: Flavor, scan = false): Painter {
  const s = 16;
  const p = new Painter(s, s);
  const base = scan ? f.c.brownieScan : f.c.brownie;
  p.clear(base);
  if (!scan) {
    const rnd = rng(9);
    for (let i = 0; i < 5; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      p.line(x, y, x + (rnd() - 0.5) * 8, y + (rnd() - 0.5) * 8, shade(base, 0.08));
    }
    p.rect(0, 0, s, 1, shade(base, 0.1));
    p.rect(0, 0, 1, s, shade(base, 0.05));
    p.rect(0, s - 1, s, 1, shade(base, -0.08));
    p.rect(s - 1, 0, 1, s, shade(base, -0.08));
  }
  return p;
}

// -------------------------------------------------------------------------------------------------
// Poster

export const POSTER = { w: 112, h: 176, qrX: 16, qrY: 50, qrSize: 80 };

export function posterArt(f: Flavor): Painter {
  const { w, h, qrX, qrY, qrSize } = POSTER;
  const p = new Painter(w, h);
  p.clear(f.c.box);
  polka(p, w, h, shade(f.c.box, 0.08), 10);
  awning(p, w, f, 8);
  p.text('DOUGH-R', w / 2, 14, { font: FONT_BIG, scale: 2, bold: true, color: f.c.text, outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  p.text('CODE', w / 2, 31, { font: FONT_BIG, scale: 2, bold: true, color: f.c.accent, outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  // wax-paper window with frame
  p.roundRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 6, INK);
  p.roundRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, 5, '#ffffff');
  p.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, '#fdfaf2');
  drawDonut(p, 2, h - 45, f, 'cheer');
  holeSprite(p, 98, 42, 5, f, 2);
  holeSprite(p, 14, 42, 4, f, 3);
  holeSprite(p, 88, h - 19, 4, f, 4);
  holeSprite(p, 99, h - 22, 3, f, 6);
  p.text(f.name.toUpperCase(), 48, h - 34, { font: FONT_TINY, color: '#ffffff', outline: INK });
  p.roundRect(48, h - 24, 28, 11, 3, INK);
  p.roundRect(49, h - 23, 26, 9, 2, '#ffffff');
  p.text('24 PCS', 62, h - 21, { font: FONT_TINY, color: INK, align: 'center' });
  p.text('HOLE-Y MOLY!', 48, h - 9, { font: FONT_TINY, color: f.c.text, outline: INK });
  return p;
}

// -------------------------------------------------------------------------------------------------
// Voxel mascot

/** Dough-R standing on little legs: a frosted donut ring facing +z (~23 x 29 x 8 voxels). */
export function donutVoxels(f: Flavor): VoxelGrid {
  const R = 7;
  const r = 3.6;
  const W = 23;
  const g = new VoxelGrid(W, 30, 9);
  const cx = 11.5;
  const cy = 18.5;
  const cz = 4.5;
  const frost = f.c.frost;
  const sp = sprinkleColors(f);
  const rnd = rng(3);
  for (let z = 0; z < 9; z++)
    for (let y = 0; y < 30; y++)
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const dz = z + 0.5 - cz;
        const d = Math.hypot(dx, dy);
        const t = (d - R) * (d - R) + dz * dz;
        if (t > r * r) continue;
        let col = '#e7b073';
        if (dz > 0.2 && d < R + 2.9) col = frost;
        if (dz > 1.5 && d < R + 2.2 && rnd() < 0.09) col = sp[Math.floor(rnd() * sp.length)];
        if (dz < -1.5) col = '#d49a5c';
        g.set(x, y, z, col);
      }
  // legs + shoes
  g.box(8, 3, 4, 8, 7, 5, '#6b3a22');
  g.box(15, 3, 4, 15, 7, 5, '#6b3a22');
  g.box(6, 0, 3, 9, 2, 7, '#ff5d73');
  g.box(14, 0, 3, 17, 2, 7, '#ff5d73');
  // arms with gloves
  g.box(0, 17, 4, 1, 18, 5, '#6b3a22');
  g.box(0, 19, 3, 1, 21, 5, '#ffffff');
  g.box(21, 17, 4, 22, 18, 5, '#6b3a22');
  g.box(21, 19, 3, 22, 21, 5, '#ffffff');
  const front = (x: number, y: number) => {
    for (let z = g.sz - 1; z >= 0; z--) if (g.filled(x, y, z)) return z;
    return -1;
  };
  const dot = (x: number, y: number, color: string) => {
    const z = front(x, y);
    if (z >= 0) g.set(x, y, z, color);
  };
  // eyes on the upper ring, smile on the lower ring
  for (const ex of [6, 16]) {
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) dot(ex + dx, 20 + dy, INK);
    dot(ex, 22, '#ffffff');
  }
  dot(4, 18, '#ff4f8b');
  dot(19, 18, '#ff4f8b');
  for (let x = 9; x <= 14; x++) dot(x, 10, '#5a1a1a');
  dot(8, 11, '#5a1a1a');
  dot(15, 11, '#5a1a1a');
  return g;
}
