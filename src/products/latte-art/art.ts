import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { rng } from '../../engine/tween';
import { buddyPortrait, drawEyes, drawMouth, type BuddySpec, type Pose } from '../../art/buddy';
import { CAST } from '../../art/cast';
import type { Flavor } from '../types';

export const INK = '#1d1b26';
/** Scan-safe cocoa: very dark so it stays dark under the showroom lights. */
export const COCOA_SCAN = '#2b180d';
export const FOAM_SCAN = '#fff9ef';

export const LATTE_FLAVORS: Flavor[] = [
  { id: 'latte', name: 'Latte', c: { cup: '#c98b55', cupDark: '#9a633a', cupLight: '#e8b27e', foam: '#fcf3e3', crema: '#dcae78', cremaDark: '#b97c45', drink: '#5a2e18', cocoa: '#5a3420', cocoa2: '#6e4128', accent: '#ff8fa3', board: '#3d4a42' } },
  { id: 'matcha', name: 'Matcha Latte', c: { cup: '#7cb342', cupDark: '#557f2a', cupLight: '#a6d46b', foam: '#f3f6e2', crema: '#b3d27a', cremaDark: '#86ad48', drink: '#5f8f2c', cocoa: '#4e3220', cocoa2: '#633f28', accent: '#ffb3c6', board: '#34453b' } },
  { id: 'chayen', name: 'Cha Yen', c: { cup: '#f28c28', cupDark: '#c4650f', cupLight: '#ffb35c', foam: '#fff2dd', crema: '#f7b066', cremaDark: '#e07b22', drink: '#d8631b', cocoa: '#553018', cocoa2: '#6b3d20', accent: '#fff08a', board: '#3a3f4f' } },
  { id: 'mocha', name: 'Mocha', c: { cup: '#7a5244', cupDark: '#553428', cupLight: '#a3786a', foam: '#f8ecd9', crema: '#b88763', cremaDark: '#8a5a3c', drink: '#3b1f14', cocoa: '#3f2214', cocoa2: '#51301d', accent: '#ffcf5c', board: '#40393a' } },
];

/** Cup dimensions (world units, before any scaling). */
export const CUP = { rTop: 1.02, rBottom: 0.72, h: 0.86, wall: 0.08, foot: 0.035 };

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

/** Bean, the coffee-bean buddy, as a flat portrait (`k` = size relative to the full mascot). */
export function beanArt(k: number, pose: Pose = {}): Painter {
  // the cream swirl doesn't shrink with the body, so the small versions go without it
  return buddyPortrait(k === 1 ? CAST.bean : { ...miniSpec(CAST.bean, k), top: undefined }, pose).toPainter();
}

/** Cup wall texture size: ~55 px per world unit both ways, so the face keeps round dot eyes. */
export const CUP_TEX = { w: 300, h: 48 };
/** Rows of the wall texture kept clear under the face for the order sticker. */
export const CUP_LABEL = { top: 24, bottom: 41 };

/** The cup's face, drawn with the buddy's dot eyes, toothy grin and blush dots. */
const CUP_FACE: BuddySpec = { ...CAST.bean, body: { ...CAST.bean.body, w: 40, h: 40 }, eyes: { gap: 17, r: 2.4 }, mouth: { w: 12 } };

/** Outer wall wrap-around art. Centre column faces the viewer; u = 0.75 is where the handle sits. */
export function cupArt(f: Flavor, mood: 'smile' | 'happy'): Painter {
  const { w, h } = CUP_TEX;
  const p = new Painter(w, h);
  const cx = w / 2;
  p.clear(f.c.cup);
  p.rect(0, h - 8, w, 8, f.c.cupDark);
  p.rect(0, h - 9, w, 1, shade(f.c.cupDark, -0.08));
  // glaze drips from the rim (short ones over the face)
  const glaze = '#fff6ea';
  p.rect(0, 0, w, 5, glaze);
  const r = rng(4);
  for (let x = 0; x < w; x += 8 + Math.floor(r() * 7)) {
    const nearFace = Math.abs(x + 1 - cx) < 26;
    const len = nearFace ? 1 : 2 + Math.floor(r() * 5);
    p.rect(x, 5, 3, len, glaze);
    p.rect(x + 1, 5 + len, 1, 1, glaze);
    p.px(x + 2, 5, shade(glaze, -0.06));
  }
  p.rect(0, 5, w, 1, 'rgba(255,255,255,0.4)');
  // little hearts + beans around the back, the logo on either side
  const heart = (x: number, y: number, c: string) => {
    p.sprite(['.#.#.', '#####', '#####', '.###.', '..#..'], x, y, { '#': c });
  };
  const bean = (x: number, y: number) => {
    p.ellipse(x, y, 3, 2, '#5a3420');
    p.px(x - 1, y - 1, '#7a4a2c').rect(x - 1, y, 3, 1, '#3a2214');
  };
  heart(26, 20, f.c.accent);
  bean(44, 29);
  heart(262, 15, f.c.accent);
  bean(284, 25);
  p.text('LATTE', 88, 18, { font: FONT_TINY, color: glaze, outline: f.c.cupDark, align: 'center' });
  p.text('CODE', 206, 18, { font: FONT_TINY, color: glaze, outline: f.c.cupDark, align: 'center' });
  // kawaii buddy face at the front, above the sticker spot
  const blush = CAST.bean.blush ?? '#ff9ab0';
  p.ellipse(cx - 15, 17, 3.6, 2.2, blush);
  p.ellipse(cx + 15, 17, 3.6, 2.2, blush);
  const e = drawEyes(CUP_FACE, mood === 'smile' ? 'dot' : 'happy').toCanvas();
  p.blit(e, Math.round(cx - e.width / 2), Math.round(12 - e.height / 2));
  const m = drawMouth(CUP_FACE, mood === 'smile' ? 'grin' : 'open').toCanvas();
  p.blit(m, Math.round(cx - m.width / 2), 14);
  return p;
}

/** Foam disc art: microfoam, a crema ring and a few bubbles. `scan` gives a plain, bright version. */
export function foamArt(f: Flavor, scan = false): Painter {
  const S = 128;
  const p = new Painter(S, S);
  const c = S / 2;
  p.clear(scan ? FOAM_SCAN : f.c.cremaDark);
  if (scan) return p;
  p.disc(c, c, c - 1, f.c.crema);
  p.disc(c, c, c - 6, shade(f.c.crema, 0.1));
  p.disc(c, c, c - 9, f.c.foam);
  const r = rng(12);
  for (let i = 0; i < 160; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * (c - 11);
    p.px(c + Math.cos(a) * d, c + Math.sin(a) * d, shade(f.c.foam, -0.035));
  }
  for (let i = 0; i < 24; i++) {
    const a = r() * Math.PI * 2;
    const d = c - 10 + r() * 5;
    p.ring(c + Math.cos(a) * d, c + Math.sin(a) * d, 1.6, shade(f.c.foam, -0.08), 1);
  }
  return p;
}

/** Chalkboard menu sign: logo, the bean buddy, flavour and price. */
export function signArt(f: Flavor): Painter {
  const w = 64;
  const h = 80;
  const p = new Painter(w, h);
  p.clear('#a8743d');
  p.rect(2, 2, w - 4, h - 4, f.c.board);
  p.dither(2, 2, w - 4, h - 4, shade(f.c.board, 0.05), 0.25);
  p.rect(0, 0, w, 1, '#d19a5c').rect(0, 0, 1, h, '#d19a5c');
  p.text('LATTE', w / 2, 5, { font: FONT_BIG, bold: true, color: '#fff6ea', align: 'center' });
  p.text('CODE', w / 2, 14, { font: FONT_BIG, bold: true, color: f.c.accent, align: 'center' });
  // the bean buddy waving hello, with a HOT badge
  const bean = beanArt(0.56, { armL: 0.5, armR: 2.6 });
  p.blit(bean, Math.round(w / 2 - bean.w / 2), 58 - bean.h);
  p.burst(w - 11, 30, 7, 10, '#ff5d73');
  p.text('HOT', w - 11, 28, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  // flavour + price
  p.text(f.name.toUpperCase(), w / 2, 60, { font: FONT_TINY, color: '#fff6ea', align: 'center' });
  p.rect(10, 67, w - 20, 1, '#d8d2c4');
  p.text('60 QB', w / 2, 70, { font: FONT_BIG, color: '#ffd23f', align: 'center' });
  return p;
}

export function signSide(): Painter {
  return new Painter(8, 80).clear('#8f6030');
}

// -------------------------------------------------------------------------------------------------
// Poster

export const POSTER = { w: 144, h: 180, codeX: 44, codeY: 72, codeSize: 56 };

/** Top-down café table: saucer, cup, foam; the code region sits in the middle of the foam. */
export function posterArt(f: Flavor): Painter {
  const { w, h } = POSTER;
  const p = new Painter(w, h);
  // wooden table
  p.clear('#c98f55');
  for (let y = 0; y < h; y += 12) {
    p.rect(0, y, w, 1, '#a8703d');
    p.rect(0, y + 5, w, 1, '#d69d62');
  }
  // gingham napkin corner
  for (let y = 132; y < h; y += 4)
    for (let x = 0; x < 44 - (y - 132) * 0.2; x += 4) p.rect(x, y, 4, 4, ((x + y) / 4) % 2 ? '#ffffff' : '#ff8fa3');
  // coffee beans
  const bean = (x: number, y: number) => {
    p.ellipse(x, y, 3.5, 2.5, INK);
    p.ellipse(x, y, 2.5, 1.6, '#5a3420');
    p.rect(x - 2, y, 4, 1, '#2e1a0e');
  };
  [[12, 40], [20, 46], [128, 150], [120, 158], [132, 166], [10, 110]].forEach(([x, y]) => bean(x, y));
  // logo
  p.roundRect(8, 4, w - 16, 26, 6, INK);
  p.roundRect(9, 5, w - 18, 24, 5, f.c.cup);
  p.text('LATTE', w / 2 - 20, 9, { font: FONT_BIG, scale: 2, bold: true, color: '#fff6ea', outline: INK, align: 'center' });
  p.text('CODE', w / 2 + 34, 12, { font: FONT_BIG, bold: true, color: f.c.accent, outline: INK, align: 'center' });
  p.text('ART', w / 2 + 34, 20, { font: FONT_TINY, color: '#fff6ea', align: 'center' });
  // saucer + cup from above
  const cx = 72;
  const cy = 100;
  p.disc(cx + 3, cy + 4, 62, 'rgba(60,30,10,0.25)');
  p.disc(cx, cy, 62, INK);
  p.disc(cx, cy, 61, f.c.cup);
  p.disc(cx, cy, 57, '#fff8ef');
  p.disc(cx, cy, 50, '#efe3d0');
  // handle
  p.roundRect(cx + 44, cy - 7, 22, 14, 6, INK);
  p.roundRect(cx + 45, cy - 6, 20, 12, 5, f.c.cup);
  p.roundRect(cx + 52, cy - 3, 9, 6, 3, '#efe3d0');
  // cup rim + foam
  p.disc(cx, cy, 49, INK);
  p.disc(cx, cy, 48, '#fff8ef');
  p.disc(cx, cy, 45, f.c.cremaDark);
  p.disc(cx, cy, 43, f.c.crema);
  p.disc(cx, cy, 41, f.c.foam);
  // steam
  for (const [sx, sy] of [[cx - 30, 36], [cx + 26, 34]]) {
    for (let i = 0; i < 4; i++) p.rect(sx + Math.round(Math.sin(i) * 2), sy + i * 3, 2, 2, 'rgba(255,255,255,0.7)');
  }
  // cookie
  p.disc(126, 60, 10, INK);
  p.disc(126, 60, 9, '#e8b86a');
  p.px(123, 57, '#5a3420').px(128, 62, '#5a3420').px(125, 63, '#5a3420').px(129, 56, '#5a3420');
  // the bean buddy cheering on the napkin (clear of the code square)
  const buddy = beanArt(0.62, { armL: 2.6, armR: 2.6, eyes: 'happy', mouth: 'open' });
  p.blit(buddy, Math.min(3, POSTER.codeX - 2 - buddy.w), h - 14 - buddy.h);
  // flavour ribbon
  p.rect(0, h - 14, w, 14, f.c.cupDark);
  p.rect(0, h - 14, w, 1, INK);
  p.text(f.name.toUpperCase(), 6, h - 10, { font: FONT_BIG, bold: true, color: '#fff6ea', outline: INK });
  p.text('60 QB', w - 6, h - 9, { font: FONT_TINY, color: '#ffd23f', align: 'right' });
  return p;
}
