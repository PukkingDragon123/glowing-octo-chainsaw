import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { buddyPortrait, type BuddySpec, type Pose } from '../../art/buddy';
import { CAST } from '../../art/cast';
import { hex, type Bitmap, type Mask } from '../../art/pixel';
import type { Flavor } from '../types';

export const INK = '#1d1b26';

/** Candy colour pairs: `fun` for the party view, `scan` for the scan-safe view (dark enough for cameras). */
export interface CandyColor {
  fun: string;
  scan: string;
}

export const CANDY_SETS: Record<string, CandyColor[]> = {
  original: [
    { fun: '#ff3b4e', scan: '#8f0f24' },
    { fun: '#ff8a1f', scan: '#8a3208' },
    { fun: '#ffd60a', scan: '#6b4a06' },
    { fun: '#3ddc84', scan: '#0f5a2a' },
    { fun: '#8b5cf6', scan: '#4c1d95' },
  ],
  sour: [
    { fun: '#b8f33c', scan: '#3f6212' },
    { fun: '#ffe433', scan: '#6b4a06' },
    { fun: '#ff5fa2', scan: '#86113f' },
    { fun: '#38bdf8', scan: '#1e3a8a' },
  ],
  tropical: [
    { fun: '#ff9f1c', scan: '#8a3208' },
    { fun: '#ffd23f', scan: '#6b4a06' },
    { fun: '#ff5d8f', scan: '#86113f' },
    { fun: '#2ec4b6', scan: '#0b4f4a' },
    { fun: '#e71d36', scan: '#8f0f24' },
  ],
  berry: [
    { fun: '#a855f7', scan: '#4c1d95' },
    { fun: '#ec4899', scan: '#86113f' },
    { fun: '#6366f1', scan: '#312e81' },
    { fun: '#f472b6', scan: '#831843' },
    { fun: '#22d3ee', scan: '#0b4f4a' },
  ],
};

export const CANDY_FLAVORS: Flavor[] = [
  { id: 'original', name: 'Original', c: { bag: '#e8233a', bagDark: '#b3122a', text: '#ffffff', accent: '#ffd60a', paper: '#ffffff' } },
  { id: 'sour', name: 'Sour Blast', c: { bag: '#7ed321', bagDark: '#4f8f0c', text: '#ffffff', accent: '#ff5fa2', paper: '#ffffff' } },
  { id: 'tropical', name: 'Tropical', c: { bag: '#0fb5ae', bagDark: '#087c78', text: '#ffffff', accent: '#ff9f1c', paper: '#ffffff' } },
  { id: 'berry', name: 'Wild Berry', c: { bag: '#6b2fb3', bagDark: '#4a1a86', text: '#ffffff', accent: '#ff5fa2', paper: '#ffffff' } },
];

/** Pack front size and the candy window (texture px) the link sticker is glued over. */
export const PACK = { w: 96, h: 128, winCX: 48, winCY: 61, winR: 25 };

// -------------------------------------------------------------------------------------------------
// The Drops: a gang of candy buddies. Drops (pink) leads; Lemon and Minty tag along.

/** Little shine glints on the upper half of a candy body. */
function glints(color: string) {
  return (b: Bitmap, m: Mask) => {
    const c = hex(color);
    const bb = m.bounds();
    const x0 = bb.x0 + Math.round(bb.w * 0.24);
    const y0 = bb.y0 + Math.round(bb.h * 0.2);
    for (let k = 0; k < 3; k++) if (m.get(x0 + k + 1, y0 + 2 - k)) b.set(x0 + k + 1, y0 + 2 - k, c);
    if (m.get(x0 + Math.round(bb.w * 0.5), y0 + 1)) b.set(x0 + Math.round(bb.w * 0.5), y0 + 1, c);
  };
}

function smallDrop(id: string, color: string, shadeC: string, light: string, bow: [string, string], limbs: [string, string]): BuddySpec {
  return {
    id,
    body: { shape: 'round', w: 26, h: 25, color, shade: shadeC, pattern: glints(light) },
    top: { kind: 'bow', color: bow[0], color2: bow[1] },
    limbs: { color: limbs[0], tip: limbs[1], arm: 10, leg: 7, thick: 5 },
    mouth: { style: 'grin' },
  };
}

export const DROPS = {
  pink: CAST.drops,
  lemon: smallDrop('drops-lemon', '#ffd23f', '#e3a615', '#fff5c2', ['#ff6fa3', '#ffc2d9'], ['#ff8a1f', '#fff4dc']),
  mint: smallDrop('drops-mint', '#44d98a', '#1fa860', '#d2ffe6', ['#7c5cff', '#c9bdff'], ['#2e7df0', '#ffe28a']),
};

const cache = new Map<string, HTMLCanvasElement>();
function dropPortrait(spec: BuddySpec, pose: Pose, key: string) {
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

/** The three Drops posing together, feet on `floor`, centred on `cx`. */
function dropGang(p: Painter, cx: number, floor: number) {
  const lemon = dropPortrait(DROPS.lemon, { armL: 2.5, armR: 0.35, eyes: 'happy', mouth: 'open' }, 'lemon-cheer');
  const mint = dropPortrait(DROPS.mint, { armL: 0.35, armR: 2.5, mouth: 'grin' }, 'mint-wave');
  const pink = dropPortrait(DROPS.pink, { armL: 0.45, armR: 0.45, mouth: 'open' }, 'pink-happy');
  stamp(p, pink, cx - pink.width / 2, floor - pink.height + 1);
  stamp(p, lemon, cx - 29 - lemon.width / 2, floor - lemon.height + 1);
  stamp(p, mint, cx + 29 - mint.width / 2, floor - mint.height + 1);
}

export function candySprite(p: Painter, cx: number, cy: number, r: number, color: string, letter = true) {
  p.ellipse(cx, cy + 1, r + 1, r * 0.8 + 1, INK);
  p.ellipse(cx, cy, r, r * 0.8, color);
  p.ellipse(cx - r * 0.35, cy - r * 0.3, r * 0.35, r * 0.22, shade(color, 0.25));
  p.rect(Math.round(cx - r), Math.round(cy + r * 0.45), Math.round(r * 2), 1, shade(color, -0.2));
  if (letter && r >= 4) {
    p.px(cx, cy, '#ffffff').px(cx, cy + 1, '#ffffff').px(cx + 1, cy - 1, '#ffffff');
  }
}

function logo(p: Painter, f: Flavor, cx: number, y: number) {
  p.text('PIXEL', cx, y, { font: FONT_BIG, scale: 2, bold: true, color: f.c.text, outline: INK, outlineWidth: 1, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  p.text('DROPS', cx, y + 17, { font: FONT_BIG, scale: 2, bold: true, color: f.c.accent, outline: INK, outlineWidth: 1, shadow: INK, shadowOffset: [0, 2], align: 'center' });
}

/** Rainbow bands around (cx, cy), from radius r0 outwards. */
function rainbow(p: Painter, cx: number, cy: number, r0: number, bands: string[], band = 4) {
  for (let i = bands.length - 1; i >= 0; i--) {
    const r = r0 + (i + 1) * band;
    p.disc(cx, cy, r + 1, INK);
    p.disc(cx, cy, r, bands[i]);
  }
}

/** Loose candies scattered inside a round window. */
function windowCandies(p: Painter, cx: number, cy: number, r: number, bands: string[], n: number, seed: number) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * (r - 6);
    candySprite(p, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, 4, bands[Math.floor(rnd() * bands.length)]);
  }
}

/** Pack front: logo, a rainbow porthole full of candies (the sticker spot) and the Drops gang. */
export function packFront(f: Flavor): Painter {
  const { w, h, winCX: cx, winCY: cy, winR: r } = PACK;
  const p = new Painter(w, h);
  const set = CANDY_SETS[f.id] ?? CANDY_SETS.original;
  const bands = set.map((c) => c.fun);
  p.clear(f.c.bag);
  // shine stripes + polka sprinkles
  p.rect(6, 0, 3, h, shade(f.c.bag, 0.08));
  p.rect(11, 0, 1, h, shade(f.c.bag, 0.08));
  p.rect(w - 10, 0, 2, h, shade(f.c.bag, -0.08));
  for (let y = 6; y < h; y += 12) for (let x = (y / 12) % 2 ? 4 : 10; x < w; x += 12) p.disc(x, y, 1.2, shade(f.c.bag, 0.1));
  // rainbow porthole with candies inside
  rainbow(p, cx, cy, r + 2, bands, 3);
  p.disc(cx, cy, r + 3, INK);
  p.disc(cx, cy, r + 2, '#ffffff');
  p.disc(cx, cy, r, '#fdf6f0');
  windowCandies(p, cx, cy, r, bands, 22, 3);
  p.ellipse(cx - r * 0.55, cy - r * 0.55, 3, 5, '#ffffff');
  p.px(cx - r * 0.3, cy - r * 0.75, '#ffffff');
  logo(p, f, w / 2, 5);
  // the Drops gang cheering at the bottom
  dropGang(p, w / 2, h - 1);
  return p;
}

export function packBack(f: Flavor): Painter {
  const p = new Painter(PACK.w, PACK.h);
  p.clear(shade(f.c.bag, -0.05));
  p.text('HOW TO', PACK.w / 2, 10, { font: FONT_BIG, bold: true, color: f.c.text, outline: INK, align: 'center' });
  p.text('SCAN IT', PACK.w / 2, 20, { font: FONT_BIG, bold: true, color: f.c.accent, outline: INK, align: 'center' });
  const steps = ['1 RIP THE PACK', '2 WATCH THEM ROLL', '3 TAP FOCUS', '4 POINT CAMERA'];
  steps.forEach((s, i) => {
    p.roundRect(8, 36 + i * 16, PACK.w - 16, 12, 4, '#ffffff');
    p.text(s, 12, 40 + i * 16, { font: FONT_TINY, color: INK });
  });
  p.text('SCAN THE RAINBOW', PACK.w / 2, 104, { font: FONT_TINY, color: f.c.text, outline: INK, align: 'center' });
  p.roundRect(28, 112, 40, 12, 3, '#ffffff');
  for (let x = 30; x < 66; x += 2) p.rect(x, 114, x % 6 === 0 ? 2 : 1, 8, INK);
  return p;
}

/** Crimp strip with saw teeth (transparent between teeth). */
export function crimpStrip(f: Flavor, top: boolean): Painter {
  const w = PACK.w;
  const h = 10;
  const p = new Painter(w, h);
  p.rect(0, top ? 3 : 0, w, 7, f.c.bagDark);
  for (let x = 0; x < w; x += 4) {
    if (top) p.poly([[x, 3], [x + 2, 0], [x + 4, 3]], f.c.bagDark);
    else p.poly([[x, 7], [x + 2, 10], [x + 4, 7]], f.c.bagDark);
  }
  for (let x = 1; x < w; x += 2) p.rect(x, top ? 4 : 1, 1, 5, shade(f.c.bagDark, -0.12));
  if (top) {
    for (let x = 0; x < w; x += 3) p.px(x, 9, '#ffffff');
  }
  return p;
}

/** Tiny 24×32 front for the shelf model. */
export function packFrontSmall(f: Flavor): Painter {
  const p = new Painter(24, 32);
  const set = CANDY_SETS[f.id] ?? CANDY_SETS.original;
  p.clear(f.c.bag);
  p.rect(3, 0, 1, 32, shade(f.c.bag, 0.1));
  const cx = 12;
  const cy = 18;
  set.slice(0, 4).forEach((c, i) => p.disc(cx, cy, 9 - i * 1.4, c.fun));
  p.disc(cx, cy, 5, INK);
  p.disc(cx, cy, 4, '#fdf6f0');
  set.forEach((c, i) => p.px(10 + (i % 3) * 2, 16 + Math.floor(i / 3) * 2, c.fun));
  p.text('PIXEL', 12, 1, { font: FONT_TINY, color: f.c.text, align: 'center' });
  p.text('DROPS', 12, 7, { font: FONT_TINY, color: f.c.accent, align: 'center' });
  // a pink Drop peeking up from the bottom
  p.disc(12, 29.5, 4.5, INK).disc(12, 29.5, 3.5, '#ff6fa3');
  p.px(10, 29, INK).px(14, 29, INK).rect(11, 31, 3, 1, '#fff3d4');
  p.rect(10, 24, 5, 2, '#ffd23f').px(12, 24, '#fff1a8');
  p.px(3, 29, set[0].fun).px(20, 30, set[1 % set.length].fun);
  return p;
}

// -------------------------------------------------------------------------------------------------
// Poster

export const POSTER = { w: 112, h: 188, qrX: 18, qrY: 44, qrSize: 76 };

export function posterArt(f: Flavor): Painter {
  const { w, h, qrX, qrY, qrSize } = POSTER;
  const set = CANDY_SETS[f.id] ?? CANDY_SETS.original;
  const bands = set.map((c) => c.fun);
  const p = new Painter(w, h);
  p.clear(f.c.bag);
  for (let y = 6; y < h; y += 12) for (let x = (y / 12) % 2 ? 4 : 10; x < w; x += 12) p.disc(x, y, 1.2, shade(f.c.bag, 0.1));
  // rainbow arches peeking out behind the code window
  const cx = w / 2;
  const cy = qrY + qrSize / 2;
  const r0 = qrSize / 2 + 4;
  for (let i = bands.length - 1; i >= 0; i--) {
    const r = r0 + (i + 1) * 4;
    p.disc(cx, cy, r + 1, INK);
    p.disc(cx, cy, r, bands[i]);
  }
  p.rect(0, cy, w, h - cy, f.c.bag);
  for (let y = 6; y < h; y += 12) for (let x = (y / 12) % 2 ? 4 : 10; x < w; x += 12) if (y > cy) p.disc(x, y, 1.2, shade(f.c.bag, 0.1));
  p.roundRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, 7, INK);
  p.roundRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 6, '#ffffff');
  p.rect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, '#fdf6f0');
  logo(p, f, cx, 4);
  dropGang(p, cx, h - 12);
  p.text('SCAN THE RAINBOW', cx, h - 9, { font: FONT_TINY, color: f.c.text, outline: INK, align: 'center' });
  return p;
}
