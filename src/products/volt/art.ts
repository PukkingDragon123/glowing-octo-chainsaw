import { Painter, shade, mix } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY, type BitmapFont } from '../../engine/pixelFont';
import { buddyPortrait, type BuddySpec, type Pose } from '../../art/buddy';
import { CAST } from '../../art/cast';
import type { Flavor } from '../types';

export const INK = '#1d1b26';

/**
 * Colour keys: neon / neonLight / neonDark (the glow), zap (secondary spark colour), can / hex (the
 * matte black can), ink (scan-mode module colour, very dark).
 */
export const VOLT_FLAVORS: Flavor[] = [
  { id: 'blue', name: 'Electric Blue', c: { main: '#00b4ff', neon: '#00b4ff', neonLight: '#9be9ff', neonDark: '#0b5aa6', zap: '#fff15c', can: '#141220', hex: '#1d1a2c', ink: '#070b16' } },
  { id: 'lime', name: 'Toxic Lime', c: { main: '#a3ff12', neon: '#a3ff12', neonLight: '#e4ffa6', neonDark: '#4e8a07', zap: '#ff4fd0', can: '#12140f', hex: '#1b2016', ink: '#08100a' } },
  { id: 'pink', name: 'Plasma Pink', c: { main: '#ff2fb3', neon: '#ff2fb3', neonLight: '#ffb8e8', neonDark: '#a0106c', zap: '#4ff0ff', can: '#170f1a', hex: '#241829', ink: '#12060d' } },
];

/** Wrap label: front centred at x = w/4, back at x = 3w/4. */
export const LABEL = { w: 128, h: 80 };
/** Label row (px from the top) the link sticker is centred on, on the front of the can. */
export const STICKER_Y = 38;

const cache = new Map<string, HTMLCanvasElement>();
/** Volty, the Volt Energy bolt buddy, as a flat portrait (cached). */
function voltyPortrait(pose: Pose, key: string, spec: BuddySpec = CAST.volty) {
  let c = cache.get(key);
  if (!c) {
    c = buddyPortrait(spec, pose).toCanvas();
    cache.set(key, c);
  }
  return c;
}

/** A smaller Volty for the can wrap. */
const VOLTY_SMALL: BuddySpec = { ...CAST.volty, body: { ...CAST.volty.body, w: 26, h: 32 }, eyes: { ...CAST.volty.eyes, gap: 9, r: 1.6 }, mouth: { ...CAST.volty.mouth, w: 8 }, limbs: { ...CAST.volty.limbs!, arm: 9, leg: 6, thick: 5 } };

/** A portrait with a 1px neon rim, so it reads on the black can (the rim glows too). */
function neonRim(c: HTMLCanvasElement, color: string) {
  const L = new Painter(c.width + 2, c.height + 2);
  L.ctx.drawImage(c, 1, 1);
  L.outline(color);
  return L.canvas;
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

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Text slanted to the right, like a speed logo (each row shifted by `slant` px per `every` rows). */
export function italicText(p: Painter, text: string, cx: number, y: number, opts: { font?: BitmapFont; scale?: number; color: string; outline?: string; shadow?: string; bold?: boolean }) {
  const font = opts.font ?? FONT_BIG;
  const scale = opts.scale ?? 1;
  const L = new Painter(Math.ceil(p.textWidth(text, { font, scale, bold: opts.bold })) + 16, font.height * scale + 6);
  L.text(text, 4, 2, { font, scale, bold: opts.bold, color: opts.color, outline: opts.outline, shadow: opts.shadow, shadowOffset: [1, 2] });
  const h = L.h;
  const x0 = Math.round(cx - L.w / 2);
  for (let row = 0; row < h; row++) {
    const shift = Math.round((h - row) / 3.2);
    p.ctx.drawImage(L.canvas, 0, row, L.w, 1, x0 + shift - 2, y - 2 + row, L.w, 1);
  }
}

/** Jagged lightning bolt polygon between two points. */
export function boltShape(p: Painter, x0: number, y0: number, x1: number, y1: number, w: number, fill: string, core?: string) {
  const pts: [number, number][] = [
    [x0, y0],
    [x0 + (x1 - x0) * 0.55 + w, y0 + (y1 - y0) * 0.42],
    [x0 + (x1 - x0) * 0.42 + w * 0.2, y0 + (y1 - y0) * 0.48],
    [x1, y1],
    [x0 + (x1 - x0) * 0.45 - w, y0 + (y1 - y0) * 0.58],
    [x0 + (x1 - x0) * 0.58 - w * 0.2, y0 + (y1 - y0) * 0.52],
  ];
  p.poly(pts, fill);
  if (core) {
    p.line(x0, y0, x0 + (x1 - x0) * 0.5 + w * 0.5, y0 + (y1 - y0) * 0.45, core);
    p.line(x0 + (x1 - x0) * 0.5 - w * 0.5, y0 + (y1 - y0) * 0.55, x1, y1, core);
  }
}

/** Classic chunky lightning-bolt icon inside a box, with an optional inset core colour. */
export function boltIcon(p: Painter, x: number, y: number, w: number, h: number, fill: string, core?: string, inset = 2) {
  const shape: [number, number][] = [
    [0.56, 0],
    [0.98, 0],
    [0.64, 0.4],
    [0.94, 0.4],
    [0.18, 1],
    [0.4, 0.56],
    [0.08, 0.56],
  ];
  p.poly(shape.map(([u, v]) => [x + u * w, y + v * h]), fill);
  if (core) {
    const ix = inset / w;
    const iy = inset / h;
    const cx = 0.53;
    const cy = 0.48;
    p.poly(shape.map(([u, v]) => [x + (cx + (u - cx) * (1 - ix * 2.4)) * w, y + (cy + (v - cy) * (1 - iy * 2.4)) * h]), core);
  }
}

function hexGrid(p: Painter, x: number, y: number, w: number, h: number, col: string) {
  for (let yy = 0; yy < h; yy += 6) {
    const off = (yy / 6) % 2 ? 4 : 0;
    for (let xx = -8; xx < w + 8; xx += 8) {
      const hx = x + xx + off;
      const hy = y + yy;
      p.px(hx + 1, hy, col).px(hx + 2, hy, col).px(hx, hy + 1, col).px(hx + 3, hy + 1, col).px(hx, hy + 2, col).px(hx + 3, hy + 2, col).px(hx + 1, hy + 3, col).px(hx + 2, hy + 3, col);
    }
  }
}

function battery(p: Painter, x: number, y: number, f: Flavor, bars = 5) {
  p.rect(x, y, 16, 7, f.c.neon);
  p.rect(x + 1, y + 1, 14, 5, f.c.can);
  p.rect(x + 16, y + 2, 1, 3, f.c.neon);
  for (let i = 0; i < bars; i++) p.rect(x + 2 + i * 3 - (i > 3 ? 0 : 0), y + 2, 2, 3, i === bars - 1 ? '#ffffff' : f.c.neonLight);
}

/** The can wrap (colour map). */
export function canLabel(f: Flavor): Painter {
  const { w, h } = LABEL;
  const c = f.c;
  const p = new Painter(w, h);
  p.clear(c.can);
  hexGrid(p, 0, 2, w, h, c.hex);
  // rims
  p.rect(0, 0, w, 3, c.neonDark);
  p.rect(0, 3, w, 1, c.neon);
  p.rect(0, h - 4, w, 1, c.neon);
  p.rect(0, h - 3, w, 3, c.neonDark);
  // seam racing stripes
  for (const x of [w / 2 - 3, w / 2 + 1, w - 3, 1]) p.rect(x, 4, 2, h - 8, shade(c.can, 0.08));
  p.rect(w / 2 - 1, 4, 1, h - 8, c.neonDark);

  // ---------------- front
  const fx = w / 4;
  // neon bolt behind the logo
  boltIcon(p, fx - 12, 3, 26, 30, c.neonDark, c.neon, 2);
  italicText(p, 'VOLT', fx, 9, { font: FONT_BIG, scale: 2, bold: true, color: '#ffffff', outline: c.neon, shadow: c.neonDark });
  let ex = fx - 17;
  for (const ch of 'ENERGY') {
    p.text(ch, ex, 26, { font: FONT_TINY, color: c.neonLight });
    ex += 6;
  }
  // Volty peeks up from the bottom rim (the link sticker goes just above him)
  const volty = neonRim(voltyPortrait({ armL: 2.5, armR: 0.5, mouth: 'open', noLegs: true }, 'label', VOLTY_SMALL), c.neon);
  stamp(p, volty, fx - volty.width / 2, h - 2 - volty.height);
  battery(p, fx + 13, 66, f);
  // sparkle ticks
  for (const [x, y] of [
    [fx - 22, 10],
    [fx + 24, 18],
    [fx - 24, 58],
  ]) {
    p.px(x, y, '#ffffff').px(x - 1, y, c.neonLight).px(x + 1, y, c.neonLight).px(x, y - 1, c.neonLight).px(x, y + 1, c.neonLight);
  }

  // ---------------- back
  const bx = (w * 3) / 4;
  p.rect(bx - 24, 8, 48, 38, c.neon);
  p.rect(bx - 23, 9, 46, 36, c.can);
  p.text('POWER FACTS', bx, 11, { font: FONT_TINY, color: c.neonLight, align: 'center' });
  p.rect(bx - 22, 17, 44, 1, c.neon);
  const rows: [string, string][] = [
    ['VOLTS', '9000'],
    ['CHARGE', '100%'],
    ['SLEEP', '0'],
    ['QR', '1'],
  ];
  rows.forEach(([k, v], i) => {
    const y = 19 + i * 6;
    p.text(k, bx - 21, y, { font: FONT_TINY, color: '#ffffff' });
    p.text(v, bx + 21, y, { font: FONT_TINY, color: c.neonLight, align: 'right' });
  });
  // warning triangle
  p.poly([[bx - 18, 64], [bx - 10, 50], [bx - 2, 64]], c.zap);
  p.poly([[bx - 16, 63], [bx - 10, 53], [bx - 4, 63]], c.can);
  boltShape(p, bx - 8, 54, bx - 12, 62, 1.5, c.zap);
  p.text('HIGH', bx + 9, 51, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  p.text('VOLT', bx + 9, 58, { font: FONT_TINY, color: c.zap, align: 'center' });
  // barcode (off-white so it does not glow)
  p.rect(bx + 1, 66, 22, 9, '#e8e8ee');
  const rnd = seeded(4);
  for (let x = bx + 2; x < bx + 22; x += 1 + (rnd() > 0.5 ? 1 : 0)) if (rnd() > 0.35) p.rect(x, 67, 1, 7, INK);
  return p;
}

/** Keep only the neon pixels of a label: the emissive map. */
export function glowMap(src: Painter, colors: string[]): Painter {
  const out = new Painter(src.w, src.h);
  out.clear('#000000');
  const keys = new Set(colors.map((h) => h.toLowerCase()));
  const s = src.ctx.getImageData(0, 0, src.w, src.h);
  const o = out.ctx.getImageData(0, 0, src.w, src.h);
  for (let i = 0; i < s.data.length; i += 4) {
    const hex = '#' + [s.data[i], s.data[i + 1], s.data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    if (keys.has(hex)) {
      o.data[i] = s.data[i];
      o.data[i + 1] = s.data[i + 1];
      o.data[i + 2] = s.data[i + 2];
    }
  }
  out.ctx.putImageData(o, 0, 0);
  return out;
}

export function canGlow(f: Flavor, label: Painter) {
  return glowMap(label, [f.c.neon, f.c.neonLight, '#ffffff', f.c.zap]);
}

/** Can lid (disc). Canvas bottom = front. */
export function lidArt(open: boolean): Painter {
  const s = 32;
  const p = new Painter(s, s);
  const c = (s - 1) / 2 + 0.5;
  p.disc(c, c, 16, '#7d8596');
  p.disc(c, c, 14.8, '#dfe4ec');
  p.disc(c, c, 13.6, '#8f98aa');
  p.disc(c, c, 12.8, '#bcc4d0');
  p.ring(c, c, 9, '#aab3c1', 1);
  const oy = c + 7;
  p.ellipse(c, oy, 5.2, 3.6, '#8f98aa');
  p.ellipse(c, oy - 0.4, 4.3, 2.8, open ? INK : '#cdd4de');
  p.disc(c, c, 1.6, '#6f7788');
  return p;
}

/** Ring-pull tab in the flavour's neon colour. */
export function tabArt(f: Flavor): Painter {
  const p = new Painter(12, 18);
  const col = f.c.neon;
  p.roundRect(1, 1, 10, 16, 4, col);
  p.ctx.clearRect(3, 3, 6, 6);
  p.px(3, 3, col).px(8, 3, col).px(3, 8, col).px(8, 8, col);
  p.disc(6, 12.5, 1.4, shade(col, -0.3));
  p.rect(2, 2, 1, 5, '#ffffff');
  p.outline(INK);
  return p;
}

/** Emitter logo plate. */
export function plateArt(f: Flavor): Painter {
  const p = new Painter(40, 10);
  p.clear('#20222e');
  p.rect(0, 0, 40, 1, '#3a3e52');
  italicText(p, 'VOLT', 14, 2, { font: FONT_TINY, color: f.c.neonLight });
  for (let i = 0; i < 4; i++) p.rect(26 + i * 3, 3, 2, 4, i < 3 ? f.c.neon : '#3a3e52');
  return p;
}

/** Dash pattern for the orbit rings (alpha-tested). */
export function dashArt(): Painter {
  const p = new Painter(96, 2);
  for (let x = 0; x < 96; x++) if (x % 8 < 5 || x % 32 === 30) p.rect(x, 0, 1, 2, '#ffffff');
  return p;
}

/** Soft vertical fade for the projector fan (white, alpha falls off upwards). */
export function fanArt(): Painter {
  const p = new Painter(16, 32);
  for (let y = 0; y < 32; y++) {
    const a = Math.pow(1 - y / 31, 1.6) * 0.9 + 0.08;
    p.ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
    p.ctx.fillRect(0, y, 16, 1);
  }
  return p;
}

/** Smoked projection field behind the hologram: dark and scanlined, with a dithered pixel edge. */
export function fieldArt(px: number, core: number): Painter {
  const p = new Painter(px, px);
  const half = px / 2;
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const dx = Math.max(0, Math.abs(x + 0.5 - half) - core / 2);
      const dy = Math.max(0, Math.abs(y + 0.5 - half) - core / 2);
      const d = Math.min(1, Math.hypot(dx, dy) / (half - core / 2));
      if ((bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < d) continue;
      // blending happens in linear light: 1 - 0.14^2.2 keeps ~14% of the background visible
      const seen = y % 2 ? 0.2 : 0.12;
      const a = 1 - Math.pow(seen, 2.2);
      p.ctx.fillStyle = `rgba(6,8,20,${a.toFixed(3)})`;
      p.ctx.fillRect(x, y, 1, 1);
    }
  return p;
}

/** Soft round glow sprite (additive aura). */
export function auraArt(): Painter {
  const p = new Painter(32, 32);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16) / 16;
      if (d >= 1) continue;
      const a = Math.pow(1 - d, 2) * 0.9;
      p.ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      p.ctx.fillRect(x, y, 1, 1);
    }
  return p;
}

/** Hologram sheet: faint grid + bright corner brackets. */
export function sheetArt(px: number): Painter {
  const p = new Painter(px, px);
  p.clear('#000000');
  const g = '#1c1c1c';
  for (let i = 0; i < px; i += 4) {
    p.rect(i, 0, 1, px, g);
    p.rect(0, i, px, 1, g);
  }
  const b = '#ffffff';
  const L = Math.round(px * 0.12);
  for (const [x, y, dx, dy] of [
    [0, 0, 1, 1],
    [px - 1, 0, -1, 1],
    [0, px - 1, 1, -1],
    [px - 1, px - 1, -1, -1],
  ]) {
    for (let k = 0; k < L; k++) {
      p.px(x + dx * k, y, b).px(x + dx * k, y + dy, b);
      p.px(x, y + dy * k, b).px(x + dx, y + dy * k, b);
    }
  }
  return p;
}

// -------------------------------------------------------------------------------------------------
// Poster

export const POSTER = { w: 120, h: 212, qrX: 22, qrY: 48, qrSize: 76 };

function miniCan(p: Painter, f: Flavor, x: number, y: number) {
  const c = f.c;
  const L = new Painter(24, 52);
  L.rect(2, 6, 20, 40, c.can);
  hexGrid(L, 2, 6, 20, 40, c.hex);
  L.rect(2, 6, 20, 1, c.neon).rect(2, 45, 20, 1, c.neon);
  boltIcon(L, 5, 9, 14, 34, c.neonDark, c.neon, 2);
  L.text('V', 12, 14, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  L.text('O', 12, 20, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  L.text('L', 12, 26, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  L.text('T', 12, 32, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  L.rect(4, 2, 16, 4, '#c9d1dc');
  L.rect(5, 1, 14, 1, '#e6ebf2');
  L.rect(4, 46, 16, 3, '#9aa3b5');
  L.rect(10, 0, 4, 2, c.neon);
  L.rect(3, 7, 1, 38, shade(c.can, 0.2));
  L.outline(INK);
  p.blit(L, x, y);
}

export function posterArt(f: Flavor): Painter {
  const { w, h, qrX, qrY, qrSize } = POSTER;
  const c = f.c;
  const p = new Painter(w, h);
  p.clear('#0b0a12');
  hexGrid(p, 0, 0, w, h, '#15131f');
  // lightning in the background
  const rnd = seeded(8);
  for (let i = 0; i < 5; i++) {
    let x = rnd() * w;
    let y = 0;
    while (y < h) {
      const nx = x + (rnd() - 0.5) * 16;
      const ny = y + 6 + rnd() * 10;
      p.line(x, y, nx, ny, i % 2 ? c.neonDark : mix(c.neonDark, '#0b0a12', 0.4));
      x = nx;
      y = ny;
    }
  }
  // logo
  const cx = w / 2;
  boltIcon(p, cx - 22, 1, 44, 42, c.neonDark, shade(c.neonDark, 0.12), 3);
  italicText(p, 'VOLT', cx, 8, { font: FONT_BIG, scale: 3, bold: true, color: '#ffffff', outline: c.neon, shadow: c.neonDark });
  let ex = cx - 22;
  for (const ch of 'ENERGY') {
    p.text(ch, ex, 34, { font: FONT_TINY, color: c.neonLight });
    ex += 8;
  }
  // light panel + neon frame (the code sits on the light panel)
  const fx = qrX - 5;
  const fy = qrY - 5;
  const fs = qrSize + 10;
  p.rect(fx - 3, fy - 3, fs + 6, fs + 6, c.neonDark);
  p.rect(fx - 2, fy - 2, fs + 4, fs + 4, c.neon);
  p.rect(fx - 1, fy - 1, fs + 2, fs + 2, c.neonLight);
  p.rect(fx, fy, fs, fs, '#eefcff');
  for (const [x, y] of [
    [fx - 3, fy - 3],
    [fx + fs - 1, fy - 3],
    [fx - 3, fy + fs - 1],
    [fx + fs - 1, fy + fs - 1],
  ])
    p.rect(x, y, 4, 4, '#ffffff');
  // emitter under the panel
  p.rect(cx - 20, fy + fs + 5, 40, 5, '#2b2e3d');
  p.rect(cx - 16, fy + fs + 4, 32, 1, c.neon);
  p.rect(cx - 4, fy + fs + 3, 8, 2, c.neonLight);
  // can, tagline and Volty cheering
  p.text('CHARGE YOUR CODES', cx, fy + fs + 13, { font: FONT_TINY, color: c.neonLight, align: 'center' });
  miniCan(p, f, 6, h - 54);
  const volty = neonRim(voltyPortrait({ armL: 2.45, armR: 2.45, eyes: 'happy', mouth: 'open' }, 'poster'), c.neon);
  stamp(p, volty, w - 6 - volty.width, h - 2 - volty.height);
  return p;
}
