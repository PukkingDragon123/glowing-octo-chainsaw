import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { buddyPortrait, type BuddySpec, type Pose } from '../../art/buddy';
import { CAST } from '../../art/cast';
import type { Flavor } from '../types';

export const INK = '#1d1b26';

/**
 * Colour keys: can / canDark / accent (logo) / drink / foam, `bubble` + `ice` for the party view and
 * `bubbleScan` + `iceScan` for the camera-safe view (all dark enough to read as QR modules).
 */
export const FIZZ_FLAVORS: Flavor[] = [
  { id: 'cola', name: 'Cola', c: { main: '#d7263d', can: '#d7263d', canDark: '#9c1330', accent: '#ffd23f', stripe: '#ffffff', drink: '#6b3421', foam: '#fff1dc', air: '#ffe7cf', bubble: '#6e3620', bubbleScan: '#2c1209', ice: '#5a2c1a', iceScan: '#2a1109' } },
  { id: 'lime', name: 'Lemon-Lime', c: { main: '#57c43a', can: '#57c43a', canDark: '#2d8a26', accent: '#fff36b', stripe: '#ffffff', drink: '#d9f58a', foam: '#f6ffe6', air: '#ecffc9', bubble: '#357a1f', bubbleScan: '#143a0b', ice: '#2c6219', iceScan: '#153c0c' } },
  { id: 'grape', name: 'Grape', c: { main: '#7b2cbf', can: '#7b2cbf', canDark: '#4f1a88', accent: '#c6f45a', stripe: '#ffffff', drink: '#6a2590', foam: '#f6e8ff', air: '#f0deff', bubble: '#5a2394', bubbleScan: '#250b45', ice: '#491e7a', iceScan: '#270c48' } },
  { id: 'cream', name: 'Cream Soda', c: { main: '#f4a261', can: '#f4a261', canDark: '#c86e2c', accent: '#ff4f81', stripe: '#fffaf0', drink: '#eab676', foam: '#fffaf0', air: '#fff4d9', bubble: '#99531a', bubbleScan: '#452006', ice: '#80461a', iceScan: '#482207' } },
];

/** Wrap label. The front panel is centred at x = w/4, the back panel at x = 3w/4. */
export const LABEL = { w: 192, h: 88 };
/** Label row (px from the top) the link sticker is centred on, on the front of the can. */
export const STICKER_Y = 50;

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Outlined soap bubble: ring + glint. */
export function bubbleRing(p: Painter, cx: number, cy: number, r: number, col: string, glint = '#ffffff') {
  if (r < 1.5) {
    p.px(cx, cy, col);
    return;
  }
  p.ring(cx, cy, r, col, 1);
  p.px(cx - Math.round(r * 0.45), cy - Math.round(r * 0.45), glint);
}

const cache = new Map<string, HTMLCanvasElement>();
/** Fizzy, the Fizz Pop bubble buddy, as a flat portrait (cached). */
function fizzyPortrait(pose: Pose, key: string, spec: BuddySpec = CAST.fizzy) {
  let c = cache.get(key);
  if (!c) {
    c = buddyPortrait(spec, pose).toCanvas();
    cache.set(key, c);
  }
  return c;
}

/** A smaller Fizzy for the can wrap. */
const FIZZY_SMALL: BuddySpec = { ...CAST.fizzy, body: { ...CAST.fizzy.body, w: 28, h: 26 }, limbs: { ...CAST.fizzy.limbs!, arm: 10, leg: 7, thick: 5 } };

function stamp(p: Painter, c: HTMLCanvasElement, x: number, y: number, flip = false) {
  p.ctx.save();
  if (flip) {
    p.ctx.translate(Math.round(x) + c.width, Math.round(y));
    p.ctx.scale(-1, 1);
    p.ctx.drawImage(c, 0, 0);
  } else p.ctx.drawImage(c, Math.round(x), Math.round(y));
  p.ctx.restore();
}

function barcode(p: Painter, x: number, y: number, w: number, h: number, seed = 7) {
  const rnd = seeded(seed);
  p.rect(x - 2, y - 2, w + 4, h + 7, '#ffffff');
  let xx = x;
  while (xx < x + w) {
    const bw = rnd() > 0.6 ? 2 : 1;
    if (rnd() > 0.35) p.rect(xx, y, bw, h, INK);
    xx += bw + 1;
  }
  p.text('4 20330 1', x + w / 2, y + h + 1, { font: FONT_TINY, color: INK, align: 'center' });
}

function snowflake(p: Painter, cx: number, cy: number, col: string) {
  p.rect(cx - 2, cy, 5, 1, col).rect(cx, cy - 2, 1, 5, col);
  p.px(cx - 1, cy - 1, col).px(cx + 1, cy - 1, col).px(cx - 1, cy + 1, col).px(cx + 1, cy + 1, col);
}

/** Big bubbly logo, centred on cx. Returns the bottom y. */
export function drawLogo(p: Painter, f: Flavor, cx: number, y: number, scale = 2) {
  const sh = scale >= 2 ? 2 : 1;
  p.text('FIZZ', cx, y, { font: FONT_BIG, scale, bold: true, color: f.c.stripe, outline: INK, shadow: INK, shadowOffset: [0, sh], align: 'center' });
  const y2 = y + 7 * scale + 2;
  p.text('POP!', cx + scale, y2, { font: FONT_BIG, scale, bold: true, color: f.c.accent, outline: INK, shadow: INK, shadowOffset: [0, sh], align: 'center' });
  // glints on the letters
  if (scale >= 2) {
    const w1 = p.textWidth('FIZZ', { font: FONT_BIG, scale, bold: true });
    const x1 = Math.round(cx - w1 / 2);
    p.px(x1 + 1, y + 1, '#ffffff');
    const w2 = p.textWidth('POP!', { font: FONT_BIG, scale, bold: true });
    const x2 = Math.round(cx + scale - w2 / 2);
    p.px(x2 + 1, y2 + 1, '#ffffff').px(x2 + 13, y2 + 3, '#ffffff');
  }
  return y2 + 7 * scale + sh;
}

/** The wrap-around can label. */
export function canLabel(f: Flavor): Painter {
  const { w, h } = LABEL;
  const c = f.c;
  const p = new Painter(w, h);
  p.clear(c.can);
  const light = shade(c.can, 0.1);
  const rnd = seeded(11);

  // background bubbles (drawn wrapped so the seam is invisible)
  for (let i = 0; i < 46; i++) {
    const bx = rnd() * w;
    const by = 8 + rnd() * (h - 18);
    const br = 1 + Math.floor(rnd() * 3.2);
    for (const off of [-w, 0, w]) bubbleRing(p, bx + off, by, br, light, shade(c.can, 0.25));
  }

  // swoosh: two seamless waves
  for (let x = 0; x < w; x++) {
    const y0 = 50 + Math.round(Math.sin((x / w) * Math.PI * 4) * 3);
    p.rect(x, y0, 1, 3, c.stripe);
    p.px(x, y0 + 3, INK);
    p.px(x, y0 - 1, INK);
    p.px(x, y0 + 6, c.accent);
  }

  // top & bottom bands (printed rims)
  p.rect(0, 0, w, 5, c.canDark);
  p.rect(0, 5, w, 1, INK);
  for (let x = 0; x < w; x += 6) p.rect(x, 2, 3, 1, shade(c.canDark, 0.15));
  p.rect(0, h - 6, w, 6, c.canDark);
  p.rect(0, h - 7, w, 1, INK);
  for (let x = 3; x < w; x += 6) p.rect(x, h - 3, 3, 1, shade(c.canDark, 0.15));

  // ---------------- front panel (centre x = w/4)
  const fx = w / 4;
  drawLogo(p, f, fx, 6, 2);
  // Fizzy peeks up over the bottom rim, antenna tucked behind the sticker spot
  const fizzy = fizzyPortrait({ armL: 2.5, armR: 0.5, mouth: 'open', noLegs: true }, 'label', FIZZY_SMALL);
  stamp(p, fizzy, fx - fizzy.width / 2, h - 2 - fizzy.height);
  snowflake(p, fx - 27, 70, '#ffffff');
  snowflake(p, fx + 28, 64, '#ffffff');
  bubbleRing(p, fx + 25, 74, 2.5, '#ffffff');
  bubbleRing(p, fx - 24, 60, 2, '#ffffff');

  // ---------------- back panel (centre x = 3w/4)
  const bx = (w * 3) / 4;
  const tx = bx - 29;
  const ty = 11;
  p.rect(tx - 1, ty - 1, 60, 37, INK);
  p.rect(tx, ty, 58, 35, '#ffffff');
  p.text('FIZZ FACTS', tx + 3, ty + 2, { font: FONT_TINY, color: INK });
  p.rect(tx + 1, ty + 8, 56, 1, INK);
  const rows: [string, string][] = [
    ['BUBBLES', '9999+'],
    ['POP', '100%'],
    ['SUGAR', '0G'],
    ['QR', '1'],
  ];
  rows.forEach(([k, v], i) => {
    const ry = ty + 10 + i * 6;
    p.text(k, tx + 3, ry, { font: FONT_TINY, color: INK });
    p.text(v, tx + 55, ry, { font: FONT_TINY, color: INK, align: 'right' });
  });
  barcode(p, bx - 26, 64, 26, 8);
  // little Fizzy on the back
  const small = fizzyPortrait({ armL: 0.5, armR: 2.5, eyes: 'wink', mouth: 'grin', noLegs: true }, 'back', { ...FIZZY_SMALL, body: { ...FIZZY_SMALL.body, w: 20, h: 19 }, limbs: { ...FIZZY_SMALL.limbs!, arm: 7, thick: 4 } });
  stamp(p, small, bx + 20 - small.width / 2, h - 7 - small.height);
  // ice-cold condensation droplets all over
  const drops = seeded(29);
  for (let i = 0; i < 34; i++) {
    const x = Math.floor(drops() * w);
    const y = 8 + Math.floor(drops() * (h - 18));
    p.px(x, y, '#ffffff').px(x, y + 1, 'rgba(255,255,255,0.75)');
    p.px(x + 1, y + 1, shade(c.can, 0.28));
  }
  return p;
}

/** Can lid (disc texture). Canvas bottom = front of the can. */
export function lidArt(open = false): Painter {
  const s = 40;
  const p = new Painter(s, s);
  const c = (s - 1) / 2;
  p.clear();
  p.disc(c + 0.5, c + 0.5, 20, '#8f98aa');
  p.disc(c + 0.5, c + 0.5, 18.5, '#e6ebf2');
  p.disc(c + 0.5, c + 0.5, 17, '#9aa3b5');
  p.disc(c + 0.5, c + 0.5, 16, '#c9d1dc');
  // pressed rings
  p.ring(c + 0.5, c + 0.5, 12, '#b7c0cd', 1);
  // opening score (front = bottom of the canvas)
  const oy = c + 9;
  p.ellipse(c + 0.5, oy, 6.5, 4.5, '#9aa3b5');
  p.ellipse(c + 0.5, oy - 0.5, 5.5, 3.5, open ? INK : '#d7dde6');
  if (open) p.ellipse(c + 0.5, oy + 0.5, 4, 2, '#3a2230');
  // rivet
  p.disc(c + 0.5, c + 0.5, 2, '#7f889a');
  p.disc(c, c, 1, '#eef2f7');
  return p;
}

/** Ring-pull tab (transparent hole). Canvas top = ring end (back), bottom = nose over the opening. */
export function tabArt(color = '#dfe4ec'): Painter {
  const p = new Painter(14, 22);
  p.roundRect(1, 1, 12, 20, 5, color);
  // finger hole
  p.ctx.clearRect(4, 4, 6, 7);
  p.px(4, 4, color).px(9, 4, color).px(4, 10, color).px(9, 10, color);
  // rivet + nose detail
  p.disc(7, 15, 1.6, shade(color, -0.25));
  p.rect(5, 18, 4, 1, shade(color, -0.18));
  p.rect(2, 2, 1, 6, '#ffffff');
  p.outline(INK);
  return p;
}

/** Oblong dark opening shown once the tab pops. */
export function holeArt(drink: string): Painter {
  const p = new Painter(16, 10);
  p.ellipse(8, 5, 7.5, 4.5, INK);
  p.ellipse(8, 5.5, 5.5, 3, shade(drink, -0.35));
  p.rect(5, 3, 3, 1, shade(drink, 0.05));
  return p;
}

/**
 * Front of the frosted acrylic panel. The centre (code + quiet zone) is a flat, bright frost colour;
 * the frosted border carries snowflakes, bubbles and chrome standoff bolts.
 */
export function panelArt(f: Flavor, px: number, border: number): Painter {
  const p = new Painter(px, px);
  const frost = '#f6fbff';
  p.clear(frost);
  const edge = '#dcefff';
  // frosted border band
  p.rect(0, 0, px, border, edge);
  p.rect(0, px - border, px, border, edge);
  p.rect(0, 0, border, px, edge);
  p.rect(px - border, 0, border, px, edge);
  p.dither(0, 0, px, border - 1, '#eaf6ff', 0.5);
  p.dither(0, px - border + 1, px, border - 1, '#eaf6ff', 0.5);
  p.dither(0, 0, border - 1, px, '#eaf6ff', 0.5);
  p.dither(px - border + 1, 0, border - 1, px, '#eaf6ff', 0.5);
  // flavour stripe on the very edge
  p.strokeRect(0, 0, px, px, '#9fcbe6', 1);
  p.strokeRect(1, 1, px - 2, px - 2, '#ffffff', 1);
  const rnd = seeded(5);
  for (let i = 0; i < 26; i++) {
    const t = rnd() * 4;
    const along = 8 + rnd() * (px - 16);
    const d = 2 + rnd() * (border - 4);
    const [x, y] = t < 1 ? [along, d] : t < 2 ? [along, px - 1 - d] : t < 3 ? [d, along] : [px - 1 - d, along];
    if (rnd() > 0.5) snowflake(p, x, y, '#ffffff');
    else bubbleRing(p, x, y, 1.5 + rnd() * 1.2, '#b9dcf2');
  }
  // chrome standoff bolts in the corners
  for (const [x, y] of [
    [border / 2, border / 2],
    [px - border / 2, border / 2],
    [border / 2, px - border / 2],
    [px - border / 2, px - border / 2],
  ]) {
    p.disc(x, y, 2.6, '#8f98aa');
    p.disc(x, y, 1.8, '#e6ebf2');
    p.px(x - 1, y - 1, '#ffffff');
  }
  void f;
  return p;
}

/** Front of the stand the panel slides out of: flavour colours under a snowy, icicled top. */
export function baseFront(f: Flavor, w: number, h: number): Painter {
  const p = new Painter(w, h);
  const c = f.c;
  p.clear(c.can);
  p.rect(0, h - 3, w, 3, c.canDark);
  const rnd = seeded(3);
  for (let i = 0; i < 14; i++) bubbleRing(p, 4 + rnd() * (w - 8), 8 + rnd() * (h - 12), 1 + rnd() * 1.8, shade(c.can, 0.12), shade(c.can, 0.3));
  const cx = w / 2;
  const tw = p.textWidth('FIZZ POP', { font: FONT_BIG, bold: true }) + 12;
  p.roundRect(cx - tw / 2, 6, tw, 11, 4, INK);
  p.text('FIZZ POP', cx, 8, { font: FONT_BIG, bold: true, color: c.accent, align: 'center' });
  p.text('ICE COLD CODES', cx, h - 7, { font: FONT_TINY, color: '#ffffff', outline: INK, align: 'center' });
  snowflake(p, cx - tw / 2 - 7, 11, '#ffffff');
  snowflake(p, cx + tw / 2 + 7, 11, '#ffffff');
  // snow cap with icicles
  p.rect(0, 0, w, 3, '#ffffff');
  for (let x = 0; x < w; x++) {
    const bump = rnd();
    const len = bump > 0.86 ? 3 + Math.floor(rnd() * 3) : bump > 0.55 ? 1 : 0;
    if (len) {
      p.rect(x, 3, 1, len, '#ffffff');
      p.px(x, 3 + len, '#a9d8f5');
    } else p.px(x, 3, '#cfeaff');
  }
  return p;
}

export function baseTop(f: Flavor, w: number, h: number): Painter {
  const p = new Painter(w, h);
  p.clear('#f4fbff');
  p.dither(0, 0, w, h, '#e1f1fc', 0.25);
  // slot the panel slides out of
  p.rect(3, Math.floor(h / 2) - 1, w - 6, 3, INK);
  p.rect(3, Math.floor(h / 2) - 2, w - 6, 1, shade(f.c.can, -0.2));
  return p;
}

/** Ice cube tile for instanced finder pieces (multiplied by the instance colour). */
export function iceTile(): Painter {
  const p = new Painter(8, 8);
  p.clear('#ffffff');
  p.strokeRect(0, 0, 8, 8, '#d6d6d6');
  return p;
}

/** Emissive layer of the ice cubes: icy rim + glint (fades out in scan mode). */
export function iceGlint(): Painter {
  const p = new Painter(8, 8);
  p.clear('#000000');
  p.strokeRect(0, 0, 8, 8, '#5aa9e0');
  p.rect(0, 0, 8, 1, '#a8dcff').rect(0, 0, 1, 8, '#a8dcff');
  p.rect(1, 1, 2, 1, '#ffffff').px(1, 2, '#ffffff');
  p.px(5, 5, '#3a78a8');
  return p;
}

/** Loose ice cube on the counter (plain map, lit normally). */
export function counterIce(): Painter {
  const p = new Painter(8, 8);
  p.clear('#dff3ff');
  p.strokeRect(0, 0, 8, 8, '#9fd2f2');
  p.rect(1, 1, 6, 1, '#ffffff').rect(1, 1, 1, 6, '#ffffff');
  p.rect(3, 3, 2, 2, '#c4e6fb');
  return p;
}

// -------------------------------------------------------------------------------------------------
// Poster

export const POSTER = { w: 128, h: 192, qrX: 26, qrY: 42, qrSize: 76 };

function tinyCan(p: Painter, f: Flavor, x: number, y: number) {
  const L = new Painter(30, 48);
  const c = f.c;
  // body
  L.rect(3, 6, 24, 36, c.can);
  L.rect(3, 6, 24, 2, c.canDark);
  L.rect(3, 40, 24, 2, c.canDark);
  L.rect(5, 8, 2, 32, shade(c.can, 0.18));
  L.rect(22, 8, 3, 32, shade(c.can, -0.12));
  // swoosh
  for (let xx = 3; xx < 27; xx++) L.px(xx, 28 + Math.round(Math.sin(xx * 0.5) * 1.5), c.stripe);
  L.text('FIZZ', 15, 12, { font: FONT_TINY, color: c.stripe, align: 'center' });
  L.text('POP', 15, 19, { font: FONT_TINY, color: c.accent, align: 'center' });
  L.disc(15, 34, 3, '#9fe3ff');
  L.px(14, 34, INK).px(16, 34, INK);
  // metal top / bottom
  L.rect(5, 3, 20, 3, '#c9d1dc');
  L.rect(6, 2, 18, 1, '#e6ebf2');
  L.rect(5, 42, 20, 3, '#9aa3b5');
  L.rect(12, 0, 6, 2, '#dfe4ec');
  L.outline(INK);
  p.blit(L, x, y);
}

export function posterArt(f: Flavor): Painter {
  const { w, h, qrX, qrY, qrSize } = POSTER;
  const c = f.c;
  const p = new Painter(w, h);
  p.clear(c.can);
  // sunburst
  const cx = w / 2;
  const cy = qrY + qrSize / 2;
  for (let i = 0; i < 16; i += 2) {
    const a0 = (i / 16) * Math.PI * 2;
    const a1 = ((i + 1) / 16) * Math.PI * 2;
    p.poly([[cx, cy], [cx + Math.cos(a0) * 200, cy + Math.sin(a0) * 200], [cx + Math.cos(a1) * 200, cy + Math.sin(a1) * 200]], shade(c.can, 0.06));
  }
  const rnd = seeded(21);
  for (let i = 0; i < 40; i++) bubbleRing(p, rnd() * w, rnd() * h, 1 + rnd() * 3, shade(c.can, 0.16), shade(c.can, 0.35));
  // logo
  drawLogo(p, f, cx - 1, 4, 2);
  // frosted panel frame around the code
  const fx = qrX - 6;
  const fy = qrY - 6;
  const fs = qrSize + 12;
  p.roundRect(fx - 1, fy - 1, fs + 2, fs + 2, 4, INK);
  p.roundRect(fx, fy, fs, fs, 3, '#dcefff');
  p.dither(fx + 1, fy + 1, fs - 2, fs - 2, '#eaf6ff', 0.5);
  for (const [bx, by] of [
    [fx + 3, fy + 3],
    [fx + fs - 4, fy + 3],
    [fx + 3, fy + fs - 4],
    [fx + fs - 4, fy + fs - 4],
  ]) {
    p.disc(bx, by, 2, '#8f98aa');
    p.px(bx, by, '#ffffff');
  }
  snowflake(p, fx + fs / 2, fy + 3, '#ffffff');
  snowflake(p, fx + fs / 2, fy + fs - 3, '#ffffff');
  // scan me tab
  p.roundRect(cx - 17, fy + fs + 1, 34, 8, 2, INK);
  p.text('SCAN ME', cx, fy + fs + 2, { font: FONT_TINY, color: c.accent, align: 'center' });
  // can + mascot at the bottom
  tinyCan(p, f, 4, h - 50);
  for (let i = 0; i < 5; i++) bubbleRing(p, 19 + (i % 2) * 5, h - 54 - i * 7, 1.5 + (i % 3) * 0.6, '#ffffff');
  const fizzy = fizzyPortrait({ armL: 2.45, armR: 2.45, eyes: 'happy', mouth: 'open' }, 'poster');
  stamp(p, fizzy, w - 4 - fizzy.width, h - 2 - fizzy.height);
  p.text('ICE', 50, h - 34, { font: FONT_BIG, bold: true, color: '#ffffff', outline: INK, align: 'center' });
  p.text('COLD!', 50, h - 22, { font: FONT_BIG, bold: true, color: c.accent, outline: INK, align: 'center' });
  return p;
}
