import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
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

export const PACK = { w: 96, h: 128, winX: 18, winY: 46, winSize: 60 };

export function candySprite(p: Painter, cx: number, cy: number, r: number, color: string, letter = true) {
  p.ellipse(cx, cy + 1, r + 1, r * 0.8 + 1, INK);
  p.ellipse(cx, cy, r, r * 0.8, color);
  p.ellipse(cx - r * 0.35, cy - r * 0.3, r * 0.35, r * 0.22, shade(color, 0.25));
  p.rect(Math.round(cx - r), Math.round(cy + r * 0.45), Math.round(r * 2), 1, shade(color, -0.2));
  if (letter && r >= 4) {
    p.px(cx, cy, '#ffffff').px(cx, cy + 1, '#ffffff').px(cx + 1, cy - 1, '#ffffff');
  }
}

export function packFront(f: Flavor, withWindowCandies = true): Painter {
  const { w, h, winX, winY, winSize } = PACK;
  const p = new Painter(w, h);
  const set = CANDY_SETS[f.id] ?? CANDY_SETS.original;
  p.clear(f.c.bag);
  // shine stripes
  p.rect(6, 0, 3, h, shade(f.c.bag, 0.08));
  p.rect(11, 0, 1, h, shade(f.c.bag, 0.08));
  p.rect(w - 10, 0, 2, h, shade(f.c.bag, -0.08));
  // rainbow arc behind the window
  const cx = w / 2;
  const cy = winY + winSize * 0.55;
  const bands = set.map((c) => c.fun);
  for (let i = 0; i < bands.length; i++) {
    const r = 46 - i * 4;
    p.ellipse(cx, cy, r, r, INK);
    p.ellipse(cx, cy, r - 1, r - 1, bands[i]);
  }
  p.ellipse(cx, cy, 46 - bands.length * 4 - 1, 46 - bands.length * 4 - 1, f.c.bag);
  p.rect(0, cy, w, h - cy, f.c.bag);
  // candy window
  p.roundRect(winX - 3, winY - 3, winSize + 6, winSize + 6, 6, INK);
  p.roundRect(winX - 2, winY - 2, winSize + 4, winSize + 4, 5, '#ffffff');
  p.roundRect(winX, winY, winSize, winSize, 4, '#fdf6f0');
  if (withWindowCandies) {
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const x = winX + 6 + rnd() * (winSize - 12);
      const y = winY + 6 + rnd() * (winSize - 12);
      candySprite(p, x, y, 4, bands[Math.floor(rnd() * bands.length)]);
    }
    p.rect(winX + 4, winY + 3, 2, 12, '#ffffff');
    p.rect(winX + 8, winY + 3, 1, 6, '#ffffff');
  }
  // logo
  p.text('PIXEL', cx, 7, { font: FONT_BIG, scale: 2, bold: true, color: f.c.text, outline: INK, outlineWidth: 1, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  p.text('DROPS', cx, 25, { font: FONT_BIG, scale: 2, bold: true, color: f.c.accent, outline: INK, outlineWidth: 1, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  // tumbling hero candies
  candySprite(p, 14, 116, 6, bands[0]);
  candySprite(p, 82, 112, 7, bands[2 % bands.length]);
  candySprite(p, 70, 121, 5, bands[3 % bands.length]);
  // tagline + weight
  p.text('SCAN THE RAINBOW', cx, 112, { font: FONT_TINY, color: f.c.text, outline: INK, align: 'center' });
  p.roundRect(28, 119, 40, 7, 2, INK);
  p.text(f.name.toUpperCase(), 48, 120, { font: FONT_TINY, color: f.c.accent, align: 'center' });
  return p;
}

export function packBack(f: Flavor): Painter {
  const p = new Painter(PACK.w, PACK.h);
  p.clear(shade(f.c.bag, -0.05));
  p.text('HOW TO', PACK.w / 2, 10, { font: FONT_BIG, bold: true, color: f.c.text, outline: INK, align: 'center' });
  p.text('SCAN IT', PACK.w / 2, 20, { font: FONT_BIG, bold: true, color: f.c.accent, outline: INK, align: 'center' });
  const steps = ['1 RIP THE PACK', '2 WATCH THEM ROLL', '3 TAP FOCUS', '4 POINT CAMERA'];
  steps.forEach((s, i) => {
    p.roundRect(8, 36 + i * 16, PACK.w - 16, 12, 3, '#ffffff');
    p.text(s, 12, 40 + i * 16, { font: FONT_TINY, color: INK });
  });
  p.rect(10, 104, 44, 16, '#ffffff');
  for (let x = 12; x < 52; x += 2) p.rect(x, 106, x % 6 === 0 ? 2 : 1, 10, INK);
  p.text('61.5G', 76, 108, { font: FONT_TINY, color: f.c.text, align: 'center' });
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
