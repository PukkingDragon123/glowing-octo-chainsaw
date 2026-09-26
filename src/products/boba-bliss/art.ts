import { Painter, shade, mix } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { buddyPortrait, type BuddySpec, type Pose } from '../../art/buddy';
import { CAST } from '../../art/cast';
import type { Flavor } from '../types';

export const INK = '#1d1b26';

/**
 * Colour keys: tea / teaDark / milk (the drink), accent (logo + straw), seal / sealInk (printed film),
 * pearl + jelly for the party view and pearlScan + jellyScan for the camera-safe view.
 */
export const BOBA_FLAVORS: Flavor[] = [
  { id: 'thaitea', name: 'Thai Tea', c: { main: '#f28c28', tea: '#f28c28', teaDark: '#cf6417', milk: '#fbd6a4', accent: '#ff5d73', straw: '#ff5d73', seal: '#ffe3bf', sealInk: '#f28c28', pearl: '#3b2217', pearlScan: '#1d100a', jelly: '#23291f', jellyScan: '#111510' } },
  { id: 'taro', name: 'Taro', c: { main: '#b69cf0', tea: '#b89cec', teaDark: '#8f71cf', milk: '#ece2ff', accent: '#ffc93c', straw: '#8f71cf', seal: '#f1eaff', sealInk: '#9a7ddc', pearl: '#3a2219', pearlScan: '#1d100a', jelly: '#23291f', jellyScan: '#111510' } },
  { id: 'brownsugar', name: 'Brown Sugar', c: { main: '#8b5a2b', tea: '#f3e2c8', teaDark: '#8b4a1f', milk: '#fff5e6', accent: '#ffb347', straw: '#8b4a1f', seal: '#fbe9d0', sealInk: '#a0612b', pearl: '#4a2612', pearlScan: '#221008', jelly: '#262a20', jellyScan: '#121510' } },
  { id: 'matcha', name: 'Matcha', c: { main: '#7cb342', tea: '#8cc152', teaDark: '#5d8f2c', milk: '#eef7de', accent: '#ff8fb1', straw: '#ff8fb1', seal: '#eaf6d8', sealInk: '#6fa33a', pearl: '#3a2218', pearlScan: '#1d100a', jelly: '#232a1d', jellyScan: '#10150e' } },
];

/** Cup wrap texture. Front of the cup at x = w/4, back at x = 3w/4; y = 0 is the rim. */
export const CUP_TEX = { w: 176, h: 88 };
/** Wrap row (px from the rim) the link sticker is centred on, on the front of the cup. */
export const STICKER_Y = 50;

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** One glossy tapioca pearl sprite. */
export function pearlSprite(p: Painter, cx: number, cy: number, r: number, color = '#3b2217') {
  p.disc(cx, cy, r + 1, INK);
  p.disc(cx, cy, r, color);
  if (r >= 2) {
    p.disc(cx + r * 0.25, cy + r * 0.25, r * 0.7, shade(color, -0.06));
    p.px(cx - Math.round(r * 0.4), cy - Math.round(r * 0.4), '#ffffff');
    if (r >= 3) p.px(cx - Math.round(r * 0.4) + 1, cy - Math.round(r * 0.4), shade(color, 0.35));
  }
}

const cache = new Map<string, HTMLCanvasElement>();
/** Pearl, the Boba Bliss tapioca buddy, as a flat portrait (cached). */
function pearlPortrait(pose: Pose, key: string, spec: BuddySpec = CAST.pearl) {
  let c = cache.get(key);
  if (!c) {
    c = buddyPortrait(spec, pose).toCanvas();
    cache.set(key, c);
  }
  return c;
}

/** Smaller Pearls for the cup wrap and the seal. */
const PEARL_SMALL: BuddySpec = { ...CAST.pearl, body: { ...CAST.pearl.body, w: 24, h: 24 }, limbs: { ...CAST.pearl.limbs!, arm: 9, leg: 6, thick: 5 } };
const PEARL_TINY: BuddySpec = { ...CAST.pearl, body: { ...CAST.pearl.body, w: 17, h: 17 }, top: { kind: 'none' }, limbs: { ...CAST.pearl.limbs!, arm: 6, leg: 4, thick: 4 } };

function stamp(p: Painter, c: HTMLCanvasElement, x: number, y: number, flip = false) {
  p.ctx.save();
  if (flip) {
    p.ctx.translate(Math.round(x) + c.width, Math.round(y));
    p.ctx.scale(-1, 1);
    p.ctx.drawImage(c, 0, 0);
  } else p.ctx.drawImage(c, Math.round(x), Math.round(y));
  p.ctx.restore();
}

/** Tiny hand-drawn Pearl face (for spots too small for a portrait). */
function pearlFace(p: Painter, cx: number, cy: number, r: number, f: Flavor) {
  p.disc(cx, cy, r + 1, INK);
  p.disc(cx, cy, r, f.c.pearl);
  p.px(cx - Math.round(r * 0.45), cy - Math.round(r * 0.5), shade(f.c.pearl, 0.35));
  p.px(cx - 2, cy, INK).px(cx + 2, cy, INK);
  p.rect(cx - 1, cy + 2, 3, 1, '#fff3d4');
  p.rect(cx + 1, cy - r - 3, 1, 3, f.c.straw);
}

function heart(p: Painter, cx: number, cy: number, col: string) {
  p.rect(cx - 2, cy - 1, 2, 2, col).rect(cx + 1, cy - 1, 2, 2, col);
  p.rect(cx - 2, cy, 5, 1, col).rect(cx - 1, cy + 1, 3, 1, col).px(cx, cy + 2, col);
}

/** Tiny elephant (a Bangkok touch on the back of the cup). */
function elephant(p: Painter, x: number, y: number, body: string, ear: string) {
  const L = new Painter(16, 12);
  L.sprite(
    [
      '...#####......',
      '..########....',
      '.##########...',
      '.##eee######..',
      '.##eee#######.',
      '#.##########..',
      '#..###..###...',
      '#..###..###...',
    ],
    1,
    1,
    { '#': body, e: ear },
  );
  L.px(4, 3, INK);
  L.outline(INK);
  p.blit(L, x, y);
}

/**
 * Wrap texture for the cup: clear head space, milk-swirled tea with ice, a pile of pearls at the
 * bottom (omitted once they are poured out), the mascot sticker on the front and an order sticker
 * on the back.
 */
export function cupWrap(f: Flavor, withPearls = true): Painter {
  const { w, h } = CUP_TEX;
  const c = f.c;
  const p = new Painter(w, h);
  const rnd = seeded(7);
  const head = 8;
  // head space (clear plastic under the seal)
  p.rect(0, 0, w, head, '#eef6ff');
  for (let x = 0; x < w; x += 11) p.rect(x, 1, 1, head - 2, '#ffffff');
  // tea body
  p.rect(0, head, w, h - head, c.tea);
  if (f.id === 'brownsugar') {
    // tiger stripes of syrup running down the milk
    for (let i = 0; i < 12; i++) {
      const x0 = (i / 12) * w + rnd() * 6;
      for (let y = head + 2; y < h; y++) {
        const xx = x0 + Math.sin(y * 0.18 + i) * 3;
        const wv = y > h - 30 ? 3 : 2;
        for (const off of [-w, 0, w]) p.rect(xx + off, y, wv, 1, y > h - 26 ? c.teaDark : shade(c.teaDark, 0.25));
      }
    }
  } else {
    // darker tea settling at the bottom, milk swirling in from the top
    p.rect(0, h - 24, w, 24, shade(c.tea, -0.06));
    p.dither(0, h - 28, w, 4, shade(c.tea, -0.06), 0.5);
    for (let x = 0; x < w; x++) {
      const y1 = head + 5 + Math.round(Math.sin((x / w) * Math.PI * 6) * 3 + Math.sin((x / w) * Math.PI * 10) * 1.5);
      p.rect(x, head, 1, y1 - head, c.milk);
      p.px(x, y1, mix(c.milk, c.tea, 0.5));
      const y2 = head + 14 + Math.round(Math.sin((x / w) * Math.PI * 4 + 1) * 4);
      p.rect(x, y2, 1, 2, mix(c.milk, c.tea, 0.55));
    }
  }
  // surface foam line
  p.rect(0, head, w, 1, '#ffffff');
  // ice cubes floating in the tea (all the way round)
  for (let i = 0; i < 7; i++) {
    const ix = (i / 7) * w + rnd() * 10;
    const iy = head + 3 + rnd() * 16;
    const s = 7 + Math.floor(rnd() * 3);
    for (const off of [-w, 0, w]) {
      p.rect(ix + off, iy, s, s, mix('#ffffff', c.tea, 0.35));
      p.strokeRect(ix + off, iy, s, s, mix('#ffffff', c.tea, 0.15));
      p.rect(ix + off + 1, iy + 1, 2, 1, '#ffffff');
    }
  }
  // pearls resting at the bottom
  if (withPearls) {
    for (let row = 0; row < 4; row++) {
      const y = h - 4 - row * 5;
      for (let x = (row % 2) * 3; x < w + 6; x += 6 + (row > 1 ? Math.floor(rnd() * 5) : 0)) {
        if (row === 3 && rnd() > 0.45) continue;
        pearlSprite(p, x, y, 2.4, c.pearl);
      }
    }
  } else {
    for (let i = 0; i < 6; i++) pearlSprite(p, rnd() * w, h - 4, 2.4, c.pearl);
  }
  // condensation droplets
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w;
    const y = head + 2 + rnd() * (h - head - 20);
    p.px(x, y, '#ffffff');
    p.px(x, y + 1, mix('#ffffff', c.tea, 0.5));
  }

  // ---------------- front: logo, the sticker spot and a Pearl badge
  const fx = w / 4;
  p.text('BOBA', fx, 11, { font: FONT_BIG, scale: 2, bold: true, color: '#ffffff', outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  const bw = p.textWidth('BLISS', { font: FONT_BIG, bold: true }) + 10;
  p.roundRect(fx - bw / 2, 28, bw, 10, 4, INK);
  p.text('BLISS', fx, 29, { font: FONT_BIG, bold: true, color: c.accent, align: 'center' });
  // round printed badge with Pearl waving (its straw pokes up behind the sticker)
  const by = 70;
  p.disc(fx, by, 20, INK);
  p.disc(fx, by, 19, '#fffaf2');
  p.ring(fx, by, 17, mix(c.accent, '#ffffff', 0.5), 1);
  const pearl = pearlPortrait({ armL: 0.45, armR: 2.45, mouth: 'open', noLegs: true }, 'wrap', PEARL_SMALL);
  stamp(p, pearl, fx - pearl.width / 2, by + 14 - pearl.height);
  heart(p, fx + 21, 58, c.accent);
  heart(p, fx - 22, 82, '#ffffff');

  // ---------------- back: order sticker, elephant, barcode
  const bx = (w * 3) / 4;
  p.rect(bx - 22, 15, 44, 40, INK);
  p.rect(bx - 21, 16, 42, 38, '#ffffff');
  p.text('ORDER 88', bx, 18, { font: FONT_TINY, color: INK, align: 'center' });
  p.rect(bx - 20, 24, 40, 1, INK);
  const opts: [string, string][] = [
    ['SUGAR', '50%'],
    ['ICE', 'LESS'],
    ['PEARL', 'YES'],
    ['SIZE', 'L'],
  ];
  opts.forEach(([k, v], i) => {
    const y = 26 + i * 7;
    p.rect(bx - 19, y + 1, 3, 3, INK);
    p.px(bx - 18, y + 2, c.accent);
    p.text(k, bx - 14, y, { font: FONT_TINY, color: INK });
    p.text(v, bx + 19, y, { font: FONT_TINY, color: INK, align: 'right' });
  });
  elephant(p, bx - 24, 58, '#d9e2f2', '#ffb3c6');
  p.text('BKK', bx - 4, 62, { font: FONT_TINY, color: '#ffffff', outline: INK });
  heart(p, bx + 13, 64, c.accent);
  return p;
}

/** Printed film seal (disc). Canvas bottom = front of the cup. */
export function sealArt(f: Flavor): Painter {
  const s = 56;
  const p = new Painter(s, s);
  const c = f.c;
  const cc = (s - 1) / 2 + 0.5;
  p.disc(cc, cc, s / 2, '#dfe9f2');
  p.disc(cc, cc, s / 2 - 1.5, c.seal);
  // pattern of pearls + hearts
  const rnd = seeded(13);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = 12 + rnd() * 12;
    const x = cc + Math.cos(a) * rr;
    const y = cc + Math.sin(a) * rr;
    if (rnd() > 0.5) p.disc(x, y, 1.5, c.sealInk);
    else heart(p, x, y, mix(c.sealInk, c.seal, 0.3));
  }
  p.ring(cc, cc, s / 2 - 3, c.sealInk, 1);
  // centre badge (soft ring: an ink ring around the dark mascot would look like a QR finder)
  p.disc(cc, cc, 12, c.sealInk);
  p.disc(cc, cc, 11, '#fffaf2');
  const pearl = pearlPortrait({ armL: 0.6, armR: 0.6, mouth: 'grin', noLegs: true }, 'seal', PEARL_TINY);
  stamp(p, pearl, cc - pearl.width / 2, cc + 9 - pearl.height);
  p.text('BOBA', cc, 6, { font: FONT_TINY, color: INK, align: 'center' });
  p.text('SHAKE ME', cc, s - 11, { font: FONT_TINY, color: INK, align: 'center' });
  return p;
}

/** Candy-striped straw (wraps into a spiral). */
export function strawArt(f: Flavor): Painter {
  const p = new Painter(16, 64);
  p.clear('#ffffff');
  for (let y = 0; y < 64; y++) for (let x = 0; x < 16; x++) if ((x + y) % 8 < 3) p.px(x, y, f.c.straw);
  p.rect(0, 0, 16, 1, shade(f.c.straw, -0.2));
  return p;
}

/** Cream tray top: plain code area with a dotted border and hearts in the margin. */
export function trayArt(f: Flavor, px: number, margin: number): Painter {
  const p = new Painter(px, px);
  p.clear('#fff6e8');
  const col = mix(f.c.accent, '#fff6e8', 0.7);
  const e = Math.max(2, Math.round(margin / 2));
  for (let i = e; i < px - e; i += 3) {
    p.px(i, e, col).px(i, px - 1 - e, col).px(e, i, col).px(px - 1 - e, i, col);
  }
  for (const [x, y] of [
    [e + 4, e + 4],
    [px - e - 5, e + 4],
    [e + 4, px - e - 5],
    [px - e - 5, px - e - 5],
  ])
    heart(p, x, y, col);
  return p;
}

/** Grass jelly cube tile (multiplied by the instance colour). */
export function jellyTile(): Painter {
  const p = new Painter(8, 8);
  p.clear('#ffffff');
  p.strokeRect(0, 0, 8, 8, '#d0d0d0');
  return p;
}

/** Emissive glint on the jelly cubes (fades out in scan mode). */
export function jellyGlint(): Painter {
  const p = new Painter(8, 8);
  p.clear('#000000');
  p.rect(1, 1, 3, 1, '#9fb89a').px(1, 2, '#9fb89a');
  p.px(2, 1, '#ffffff');
  return p;
}

// -------------------------------------------------------------------------------------------------
// Poster

export const POSTER = { w: 120, h: 202, qrX: 22, qrY: 46, qrSize: 76 };

function miniCup(p: Painter, f: Flavor, x: number, y: number) {
  const L = new Painter(34, 56);
  const c = f.c;
  // straw
  L.rect(19, 0, 5, 18, '#ffffff');
  for (let yy = 0; yy < 18; yy += 4) L.rect(19, yy, 5, 2, c.straw);
  // cup body (tapered)
  L.poly([[3, 14], [31, 14], [27, 53], [7, 53]], c.tea);
  L.rect(3, 12, 28, 3, '#f4f8ff');
  L.poly([[4, 15], [30, 15], [29.5, 21], [4.5, 21]], c.milk);
  for (let i = 0; i < 9; i++) pearlSprite(L, 9 + (i % 5) * 4 + (i > 4 ? 2 : 0), 49 - (i > 4 ? 4 : 0), 1.6, c.pearl);
  L.disc(17, 32, 6, '#fffaf2');
  pearlFace(L, 17, 33, 3.5, f);
  L.rect(8, 16, 1, 30, '#ffffff');
  L.outline(INK);
  p.blit(L, x, y);
}

export function posterArt(f: Flavor): Painter {
  const { w, h, qrX, qrY, qrSize } = POSTER;
  const c = f.c;
  const p = new Painter(w, h);
  p.clear(c.main);
  // pearl polka dots
  for (let y = 4; y < h; y += 12) for (let x = (y / 12) % 2 ? 10 : 4; x < w; x += 12) p.disc(x, y, 2, shade(c.main, -0.08));
  // logo
  const cx = w / 2;
  p.text('BOBA', cx, 5, { font: FONT_BIG, scale: 2, bold: true, color: '#ffffff', outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  const bw = p.textWidth('BLISS', { font: FONT_BIG, bold: true }) + 12;
  p.roundRect(cx - bw / 2, 23, bw, 11, 3, INK);
  p.text('BLISS', cx, 25, { font: FONT_BIG, bold: true, color: c.accent, align: 'center' });
  heart(p, cx + bw / 2 + 6, 28, '#ffffff');
  heart(p, cx - bw / 2 - 6, 28, '#ffffff');
  // tray frame around the code
  const fx = qrX - 6;
  const fy = qrY - 6;
  const fs = qrSize + 12;
  p.roundRect(fx - 1, fy - 1, fs + 2, fs + 2, 4, INK);
  p.roundRect(fx, fy, fs, fs, 3, '#e8c48f');
  p.rect(fx + 2, fy + 2, fs - 4, fs - 4, '#fff6e8');
  for (let i = fx + 3; i < fx + fs - 3; i += 4) {
    p.px(i, fy + 1, '#d4a86a');
    p.px(i, fy + fs - 2, '#d4a86a');
  }
  // tagline, then the cup and Pearl cheering
  p.text('SHAKE IT TILL IT SCANS', cx, fy + fs + 4, { font: FONT_TINY, color: '#ffffff', outline: INK, align: 'center' });
  miniCup(p, f, 4, h - 58);
  const pearl = pearlPortrait({ armL: 2.45, armR: 2.45, eyes: 'happy', mouth: 'open' }, 'poster');
  stamp(p, pearl, w - 6 - pearl.width, h - 2 - pearl.height);
  heart(p, 50, h - 30, '#ffffff');
  heart(p, 44, h - 16, c.accent);
  return p;
}
