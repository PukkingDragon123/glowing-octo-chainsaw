import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { rng } from '../../engine/tween';
import { buddyPortrait, type BuddySpec, type Pose } from '../../art/buddy';
import { CAST } from '../../art/cast';
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
/** Lid window rectangle inside the lid-top art (the link sticker is glued over it). */
export const WINDOW = { x: 20, y: 22, w: 64, h: 36 };

// -------------------------------------------------------------------------------------------------
// Sprites

const cache = new Map<string, HTMLCanvasElement>();
/** Dough-R, the frosted-donut buddy, as a flat portrait (cached). */
function donutPortrait(pose: Pose, key: string, spec: BuddySpec = CAST.donut) {
  let c = cache.get(key);
  if (!c) {
    c = buddyPortrait(spec, pose).toCanvas();
    cache.set(key, c);
  }
  return c;
}

/** Smaller Dough-Rs for the box panels. */
const DOUGH_FRONT: BuddySpec = { ...CAST.donut, body: { ...CAST.donut.body, w: 28, h: 24 }, eyes: { y: 0.42 }, mouth: { y: 0.64, w: 11 }, limbs: { ...CAST.donut.limbs!, arm: 9, leg: 6, thick: 5 } };
const DOUGH_SMALL: BuddySpec = { ...CAST.donut, body: { ...CAST.donut.body, w: 30, h: 26 }, eyes: { y: 0.44 }, mouth: { y: 0.64, w: 12 }, limbs: { ...CAST.donut.limbs!, arm: 10, leg: 7, thick: 5 } };

function stamp(p: Painter, c: HTMLCanvasElement, x: number, y: number, flip = false) {
  p.ctx.save();
  if (flip) {
    p.ctx.translate(Math.round(x) + c.width, Math.round(y));
    p.ctx.scale(-1, 1);
    p.ctx.drawImage(c, 0, 0);
  } else p.ctx.drawImage(c, Math.round(x), Math.round(y));
  p.ctx.restore();
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
  // bottom band with a scalloped top edge
  p.rect(0, h - 7, w, 7, f.c.deep);
  for (let x = 2; x < w; x += 6) p.disc(x + 0.5, h - 7, 2.4, f.c.deep);
  // (the top ~7 px hide behind the lid's awning lip)
  p.text('DOUGH-R', w / 2, 9, { font: FONT_BIG, scale: 2, bold: true, color: f.c.text, outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  p.text('CODE', 34, 28, { font: FONT_BIG, scale: 2, bold: true, color: f.c.accent, outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  holeSprite(p, 8, 49, 3.5, f, 4);
  holeSprite(p, 60, 49, 3.5, f, 6);
  // Dough-R peeks up over the bottom band, waving
  const dough = donutPortrait({ armL: 0.5, armR: 1.65, mouth: 'open', noLegs: true }, 'front', DOUGH_FRONT);
  stamp(p, dough, w - 1 - dough.width, h + 2 - dough.height);
  return p;
}

export function boxSideRight(f: Flavor): Painter {
  const { d: w, h } = BOX_PX;
  const p = new Painter(w, h);
  p.clear(f.c.box);
  polka(p, w, h, shade(f.c.box, 0.08), 10, 2);
  awning(p, w, f);
  const dough = donutPortrait({ armL: 2.5, armR: 0.5, eyes: 'happy', mouth: 'open' }, 'side', DOUGH_SMALL);
  stamp(p, dough, w - 2 - dough.width, h - 1 - dough.height);
  // speech bubble
  p.roundRect(3, 13, 30, 17, 5, INK);
  p.roundRect(4, 14, 28, 15, 4, '#ffffff');
  p.poly([[26, 28], [32, 28], [36, 34]], INK);
  p.poly([[27, 28], [31, 28], [34, 32]], '#ffffff');
  p.text('HOLE-Y', 18, 15, { font: FONT_TINY, color: INK, align: 'center' });
  p.text('MOLY!', 18, 21, { font: FONT_TINY, color: f.c.deep, align: 'center' });
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

/** Lid top: polka dots, a small brand line and the cellophane window the link sticker covers. */
export function lidTop(f: Flavor, window = true): Painter {
  const w = BOX_PX.w;
  const h = BOX_PX.d;
  const p = new Painter(w, h);
  p.clear(f.c.box);
  polka(p, w, h, shade(f.c.box, 0.08), 10);
  const { x, y, w: ww, h: wh } = WINDOW;
  // rounded window frame
  p.roundRect(x - 5, y - 5, ww + 10, wh + 10, 8, INK);
  p.roundRect(x - 4, y - 4, ww + 8, wh + 8, 7, '#ffffff');
  p.roundRect(x - 1, y - 1, ww + 2, wh + 2, 3, INK);
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
  p.text('DOUGH-R CODE', w / 2, 5, { font: FONT_BIG, bold: true, color: f.c.text, outline: INK, align: 'center' });
  p.text('♥', 10, h - 11, { font: FONT_BIG, color: '#ffffff', outline: INK, align: 'center' });
  p.text('♥', w - 10, h - 11, { font: FONT_BIG, color: '#ffffff', outline: INK, align: 'center' });
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

export const POSTER = { w: 112, h: 188, qrX: 16, qrY: 50, qrSize: 80 };

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
  const dough = donutPortrait({ armL: 2.45, armR: 2.45, eyes: 'happy', mouth: 'open' }, 'poster');
  stamp(p, dough, 1, h - 2 - dough.height);
  holeSprite(p, 98, 42, 5, f, 2);
  holeSprite(p, 14, 42, 4, f, 3);
  holeSprite(p, 99, h - 12, 4, f, 4);
  p.text('HOLE-Y', 84, h - 36, { font: FONT_BIG, bold: true, color: f.c.text, outline: INK, align: 'center' });
  p.text('MOLY!', 84, h - 24, { font: FONT_BIG, bold: true, color: f.c.accent, outline: INK, align: 'center' });
  return p;
}
