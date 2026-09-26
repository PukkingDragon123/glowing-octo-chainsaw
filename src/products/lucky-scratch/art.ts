import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { buddyPortrait, type BuddySpec, type Pose } from '../../art/buddy';
import { CAST } from '../../art/cast';
import type { Flavor } from '../types';

export const INK = '#1d1b26';
const CREAM = '#fff4d6';

export const SCRATCH_FLAVORS: Flavor[] = [
  {
    id: 'gold',
    name: 'Gold Rush',
    c: { main: '#f4c430', base: '#f4c430', light: '#ffe27a', dark: '#c8930f', deep: '#7a4a06', ribbon: '#e63946', ribbonDark: '#a4161a', win: '#e63946' },
  },
  {
    id: 'jade',
    name: 'Jade Luck',
    c: { main: '#2a9d8f', base: '#2a9d8f', light: '#5cc9b5', dark: '#1d7268', deep: '#0f3f3a', ribbon: '#f4c430', ribbonDark: '#b8860b', win: '#ffd23f' },
  },
  {
    id: 'ruby',
    name: 'Ruby Seven',
    c: { main: '#d62839', base: '#d62839', light: '#ff5d6c', dark: '#a0172a', deep: '#5c0a17', ribbon: '#ffd23f', ribbonDark: '#c8930f', win: '#ffd23f' },
  },
];

/** Card front layout in texture pixels. The foil panel hides the QR; the lucky buddy stands below it. */
export const CARD = { w: 96, h: 148, panelX: 16, panelY: 39, panelSize: 64 };

const FOIL = { base: '#c3c9d3', light: '#e3e7ee', dark: '#8e95a3', deep: '#6b7280' };

function sunburst(p: Painter, cx: number, cy: number, n: number, c1: string, c2: string) {
  p.clear(c1);
  const R = 260;
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * Math.PI * 2 + 0.1;
    const a1 = ((i + 1) / n) * Math.PI * 2 + 0.1;
    p.poly([[cx, cy], [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R], [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R]], c2);
  }
}

/** A mascot at packaging size: body, face and limbs shrink together (the pixel style stays). */
function miniSpec(spec: BuddySpec, k: number): BuddySpec {
  const L = spec.limbs ?? { color: '#58a88f', tip: '#f3d270' };
  return {
    ...spec,
    body: { ...spec.body, w: Math.round(spec.body.w * k), h: Math.round(spec.body.h * k) },
    eyes: { ...spec.eyes, gap: spec.eyes?.gap !== undefined ? spec.eyes.gap * k : undefined, r: spec.eyes?.r !== undefined ? Math.max(1.5, spec.eyes.r * k) : undefined },
    mouth: { ...spec.mouth, w: spec.mouth?.w !== undefined ? Math.round(spec.mouth.w * k) : undefined },
    limbs: { ...L, arm: Math.round((L.arm ?? 13) * k), leg: Math.round((L.leg ?? 9) * k), thick: Math.max(4, Math.round((L.thick ?? 6) * k)) },
  };
}

/** Lucky, the coin buddy, as a flat portrait (`k` = size relative to the full mascot). */
export function luckyArt(k: number, pose: Pose = {}): Painter {
  return buddyPortrait(k === 1 ? CAST.lucky : miniSpec(CAST.lucky, k), pose).toPainter();
}

function sparkle(p: Painter, x: number, y: number, c = '#ffffff') {
  p.px(x, y - 2, c).px(x, y - 1, c).px(x, y + 1, c).px(x, y + 2, c);
  p.px(x - 2, y, c).px(x - 1, y, c).px(x + 1, y, c).px(x + 2, y, c);
  p.px(x, y, c);
}

/** The silver scratch-off coating (64×64). Drawn once per card; erased texel by texel. */
export function foilArt(size = CARD.panelSize): Painter {
  const p = new Painter(size, size);
  p.clear(FOIL.base);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if ((x + y) % 8 < 3) p.px(x, y, FOIL.light);
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) p.px(Math.floor(rnd() * size), Math.floor(rnd() * size), FOIL.dark);
  // embossed coins around the edge
  const coin = (cx: number, cy: number) => {
    p.disc(cx, cy + 1, 4.2, FOIL.deep);
    p.disc(cx, cy, 4.2, FOIL.light);
    p.disc(cx, cy, 2.6, FOIL.base);
    p.px(cx - 1, cy - 2, '#ffffff');
  };
  for (const [cx, cy] of [[8, 8], [56, 8], [8, 56], [56, 56], [32, 55], [8, 32], [56, 32], [32, 9]] as const) coin(cx, cy);
  p.text('SCRATCH', size / 2, 21, { font: FONT_BIG, bold: true, color: FOIL.deep, shadow: '#f5f7fa', shadowOffset: [0, 1], align: 'center' });
  p.text('HERE!', size / 2, 31, { font: FONT_BIG, bold: true, color: FOIL.deep, shadow: '#f5f7fa', shadowOffset: [0, 1], align: 'center' });
  p.text('WIN A QR', size / 2, 42, { font: FONT_TINY, color: '#5a6170', align: 'center' });
  sparkle(p, 17, 46, '#ffffff');
  sparkle(p, 48, 17, '#ffffff');
  p.strokeRect(0, 0, size, size, FOIL.dark);
  p.rect(1, 1, size - 2, 1, '#f5f7fa');
  return p;
}

export interface CardArtOptions {
  /** Paint the silver foil over the panel (shelf model). */
  foil?: boolean;
  /** Scraps of foil around the panel edge (posters). */
  scraps?: boolean;
}

/** Front of the lottery card (96×148). */
export function cardFront(f: Flavor, opts: CardArtOptions = {}): Painter {
  const { w, h, panelX, panelY, panelSize } = CARD;
  const c = f.c;
  const p = new Painter(w, h);
  sunburst(p, w / 2, panelY + panelSize / 2, 20, c.base, c.light);
  // stub strip with a row of tiny stars + perforation
  p.rect(0, 0, w, 10, c.deep);
  for (let x = 10; x < w; x += 19) sparkle(p, x, 5, x % 2 ? c.light : CREAM);
  for (let x = 1; x < w; x += 3) p.rect(x, 10, 2, 1, INK);
  p.rect(0, 11, w, 1, shade(c.base, 0.25));

  // ribbon banner with "LUCKY"
  const rb = new Painter(w, 24);
  rb.poly([[1, 6], [13, 6], [13, 21], [1, 21], [6, 13.5]], c.ribbonDark);
  rb.poly([[95, 6], [83, 6], [83, 21], [95, 21], [90, 13.5]], c.ribbonDark);
  rb.poly([[10, 18], [14, 18], [14, 22]], shade(c.ribbonDark, -0.2));
  rb.poly([[86, 18], [82, 18], [82, 22]], shade(c.ribbonDark, -0.2));
  rb.rect(10, 2, 76, 16, c.ribbon);
  rb.rect(10, 2, 76, 1, shade(c.ribbon, 0.25));
  rb.rect(10, 16, 76, 2, shade(c.ribbon, -0.15));
  rb.outline(INK);
  p.blit(rb, 0, 11);
  p.text('LUCKY', w / 2, 14, { font: FONT_BIG, scale: 2, bold: true, color: '#ffffff', outline: INK, shadow: INK, shadowOffset: [0, 1], align: 'center' });
  p.text('SCRATCH & SCAN', w / 2, 30, { font: FONT_TINY, color: CREAM, outline: INK, align: 'center' });

  // panel frame (the QR decal / foil sit inside)
  p.rect(panelX - 3, panelY - 3, panelSize + 6, panelSize + 6, INK);
  p.rect(panelX - 2, panelY - 2, panelSize + 4, panelSize + 4, CREAM);
  p.rect(panelX + panelSize + 3, panelY - 1, 1, panelSize + 5, shade(c.base, -0.35));
  p.rect(panelX - 1, panelY + panelSize + 3, panelSize + 5, 1, shade(c.base, -0.35));
  p.rect(panelX, panelY, panelSize, panelSize, '#ffffff');
  if (opts.foil) p.blit(foilArt(panelSize), panelX, panelY);
  if (opts.scraps) {
    // a few curls of silver left at the edges, like a real scratched card
    const scrap = (x: number, y: number, ww: number, hh: number) => {
      p.rect(x, y, ww, hh, FOIL.base);
      p.rect(x, y + hh - 1, ww, 1, FOIL.dark);
    };
    scrap(panelX - 2, panelY - 2, 9, 3);
    scrap(panelX + panelSize - 6, panelY + panelSize, 8, 2);
    scrap(panelX + panelSize, panelY + 18, 2, 7);
  }
  // sparkles around the panel
  sparkle(p, panelX - 8, panelY + 6, '#ffffff');
  sparkle(p, panelX + panelSize + 7, panelY + 44, '#ffffff');
  sparkle(p, panelX - 7, panelY + 52, CREAM);

  // bottom strip with the lotto name and the price badge (12 px)
  const by = h - 12;
  p.rect(0, by, w, 12, shade(c.deep, 0.05));
  p.rect(0, by, w, 1, INK);
  p.text('QR LOTTO', 60, by + 4, { font: FONT_TINY, color: CREAM, align: 'center' });

  // lucky, the coin buddy, beckoning below the panel (feet on the strip)
  const wy = panelY + panelSize + 4;
  const lucky = luckyArt(0.6, { armL: 0.45, armR: 2.7 });
  p.blit(lucky, 2, Math.max(wy, h - 3 - lucky.h));
  // WIN! badge beside the buddy
  const bx = 40;
  const bw = w - bx - 6;
  p.roundRect(bx, wy + 4, bw, 18, 4, INK);
  p.roundRect(bx + 1, wy + 5, bw - 2, 16, 3, c.deep);
  p.rect(bx + 4, wy + 5, bw - 8, 1, shade(c.deep, 0.2));
  p.text('WIN!', bx + bw / 2 + 1, wy + 6, { font: FONT_BIG, scale: 2, color: '#ffd23f', shadow: INK, shadowOffset: [0, 1], align: 'center' });
  // price sticker overlapping the strip
  p.burst(w - 11, by + 5, 8, 12, INK);
  p.burst(w - 11, by + 5, 7, 12, c.ribbon);
  p.text('50', w - 11, by + 3, { font: FONT_TINY, color: '#ffffff', outline: INK, align: 'center' });
  // card edge
  p.strokeRect(0, 0, w, h, INK);
  return p;
}

export function cardBack(f: Flavor): Painter {
  const { w, h } = CARD;
  const c = f.c;
  const p = new Painter(w, h);
  p.clear(c.dark);
  p.grid(0, 0, w, h, 6, shade(c.dark, 0.05), 2);
  p.rect(0, 0, w, 10, c.deep);
  for (let x = 1; x < w; x += 3) p.rect(x, 10, 2, 1, INK);
  p.text('HOW TO PLAY', w / 2, 18, { font: FONT_BIG, bold: true, color: '#ffffff', outline: INK, align: 'center' });
  const steps = ['1 SCRATCH THE FOIL', '2 FIND YOUR CODE', '3 SCAN IT', '4 YOU WIN!'];
  steps.forEach((s, i) => {
    p.roundRect(8, 34 + i * 14, w - 16, 11, 3, CREAM);
    p.text(s, 12, 37 + i * 14, { font: FONT_TINY, color: INK });
  });
  for (let i = 0; i < 6; i++) p.dither(8, 96 + i * 4, w - 16 - (i % 3) * 10, 2, shade(c.dark, 0.25), 0.5);
  p.text('ODDS OF WINNING: 1 IN 1', w / 2, h - 14, { font: FONT_TINY, color: c.light, align: 'center' });
  p.strokeRect(0, 0, w, h, INK);
  return p;
}

export function cardEdge(f: Flavor): Painter {
  return new Painter(4, 32).clear(f.c.dark);
}

/** "WIN!" starburst sticker that pops out when the code is uncovered. */
export function winSticker(f: Flavor): Painter {
  const p = new Painter(44, 30);
  const L = new Painter(44, 30);
  L.burst(22, 15, 14, 14, f.c.ribbon);
  L.ellipse(22, 15, 20, 11, f.c.ribbon);
  L.outline(INK);
  p.blit(L, 0, 0);
  p.text('WIN!', 22, 8, { font: FONT_BIG, bold: true, color: '#ffffff', outline: INK, shadow: INK, shadowOffset: [0, 1], align: 'center' });
  p.text('QR', 22, 18, { font: FONT_TINY, color: INK, align: 'center' });
  return p;
}
