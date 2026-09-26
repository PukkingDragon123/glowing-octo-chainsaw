import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { buddyPortrait, type BuddySpec, type Pose } from '../../art/buddy';
import { CAST } from '../../art/cast';
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

/** Bag front size; the link sticker is glued over the chip pile in the middle (texture px). */
export const BAG = { w: 96, h: 128, pileX: 48, pileY: 66 };

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

const cache = new Map<string, HTMLCanvasElement>();
/** Chipper, the Crunch Bytes buddy, as a flat portrait (cached). */
function chipperPortrait(pose: Pose, key: string, spec: BuddySpec = CAST.chipper) {
  let c = cache.get(key);
  if (!c) {
    c = buddyPortrait(spec, pose).toCanvas();
    cache.set(key, c);
  }
  return c;
}

function stamp(p: Painter, c: HTMLCanvasElement, x: number, y: number, flip = false) {
  p.ctx.save();
  if (flip) {
    p.ctx.translate(Math.round(x) + c.width, Math.round(y));
    p.ctx.scale(-1, 1);
    p.ctx.drawImage(c, 0, 0);
  } else p.ctx.drawImage(c, Math.round(x), Math.round(y));
  p.ctx.restore();
}

/** A heap of golden chips centred on (cx, cy). */
function chipPile(p: Painter, f: Flavor, cx: number, cy: number) {
  const pile: [number, number][] = [
    [-16, 14], [0, 16], [16, 14], [-22, 6], [-8, 7], [8, 8], [22, 6], [-14, -2], [2, -1], [16, -2], [-6, -9], [9, -10], [1, -17],
  ];
  for (const [x, y] of pile) chipSprite(p, cx + x, cy + y, 8, 5, f.c.chipA);
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
  p.text('NEW', cx + 0.5, cy - 2, { font: FONT_TINY, color: '#ffffff', align: 'center' });
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

function logo(p: Painter, f: Flavor, cx: number, y: number) {
  p.burst(cx, y + 12, 30, 18, INK);
  p.burst(cx, y + 12, 28, 18, f.c.accent);
  p.text('CRUNCH', cx, y, { font: FONT_BIG, scale: 2, bold: true, color: '#ffffff', outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  p.text('BYTES', cx + 6, y + 17, { font: FONT_BIG, scale: 2, bold: true, color: f.c.bag, outline: '#ffffff', outlineWidth: 1, align: 'center' });
}

function bagBackground(p: Painter, f: Flavor) {
  const { w, h } = p;
  p.clear(f.c.bag);
  // metallic sheen
  p.rect(9, 0, 5, h, shade(f.c.bag, 0.12));
  p.rect(16, 0, 2, h, shade(f.c.bag, 0.08));
  p.rect(w - 12, 0, 3, h, shade(f.c.bag, -0.1));
  p.dither(0, 0, w, 6, shade(f.c.bag, -0.2), 0.5);
  p.dither(0, h - 6, w, 6, shade(f.c.bag, -0.2), 0.5);
}

/** Bag front: logo burst, a pile of chips (the sticker spot) and Chipper popping up to wave. */
export function bagFront(f: Flavor): Painter {
  const { w, h, pileX, pileY } = BAG;
  const p = new Painter(w, h);
  bagBackground(p, f);
  // a round spotlight behind the pile
  p.disc(pileX, pileY, 31, shade(f.c.bag, 0.1));
  p.disc(pileX, pileY, 27, shade(f.c.bag, 0.16));
  chipPile(p, f, pileX, pileY);
  chipSprite(p, 14, 52, 5, 3, f.c.chipB);
  chipSprite(p, 84, 60, 6, 4, f.c.chipA);
  flavorIcon(p, f, 8, 88);
  logo(p, f, w / 2, 6);
  // Chipper pops up at the bottom, waving
  const chip = chipperPortrait({ armL: 0.5, armR: 2.45, mouth: 'open', noLegs: true }, 'front');
  stamp(p, chip, w / 2 + 4 - chip.width / 2, h + 1 - chip.height);
  newSticker(p, 84, 44, '#ff5d73');
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
  for (const [x, y] of [[7, 18], [13, 19], [18, 17], [10, 14], [15, 13]]) {
    p.ellipse(x, y, 3, 2, GOLD);
    p.px(x - 1, y - 1, '#fff1b8');
  }
  // Chipper's pointy head peeking up
  p.poly([[12, 21], [18, 31], [6, 31]], INK);
  p.poly([[12, 23], [16.5, 31], [7.5, 31]], GOLD);
  p.px(10, 27, INK).px(13, 27, INK).rect(10, 29, 4, 1, '#fff3d4');
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

// -------------------------------------------------------------------------------------------------
// Poster

export const POSTER = { w: 112, h: 194, qrX: 18, qrY: 46, qrSize: 76 };

export function posterArt(f: Flavor): Painter {
  const { w, h, qrX, qrY, qrSize } = POSTER;
  const p = new Painter(w, h);
  bagBackground(p, f);
  logo(p, f, w / 2, 6);
  p.roundRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, 7, INK);
  p.roundRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 6, '#ffffff');
  const pileY = qrY + qrSize + 26;
  for (const [x, y] of [[-34, 8], [-20, 10], [22, 10], [36, 8], [-28, 2], [30, 2]] as [number, number][]) chipSprite(p, w / 2 + x, pileY + y, 8, 5, f.c.chipA);
  const chip = chipperPortrait({ armL: 2.45, armR: 2.45, eyes: 'happy', mouth: 'open' }, 'poster');
  stamp(p, chip, w / 2 - chip.width / 2, h - 12 - chip.height);
  p.text('CRUNCH ON!', w / 2, h - 9, { font: FONT_TINY, color: '#ffffff', outline: INK, align: 'center' });
  return p;
}
