import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { VoxelGrid } from '../../engine/voxel';
import type { Flavor } from '../types';
import type { PixelArt } from '../../qr/pixelCodec';
import { pixelArtCanvas } from '../../qr/pixelCapture';

export const INK = '#1d1b26';
export const PEN = '#2f4bc4';

export const TAPE_FLAVORS: Flavor[] = [
  { id: 'retro', name: 'Retro Black', c: { main: '#2b2b2b', shell: '#2b2b2b', shellHi: '#454548', window: '#141416', tv: '#efe6cf', tvDark: '#d4c8aa', vcr: '#34343c', vcrHi: '#4a4a54', accent: '#ff5d73', cover: '#1b1b24', cover2: '#ff5d73' } },
  { id: 'clear', name: 'Clear Purple', c: { main: '#9d4edd', shell: '#a66ce6', shellHi: '#c9a2f5', window: '#7b3fc4', tv: '#c3b1f2', tvDark: '#9f89d8', vcr: '#5e3aa8', vcrHi: '#7a55c6', accent: '#3ff8ff', cover: '#5a2a9e', cover2: '#3ff8ff' } },
  { id: 'pastel', name: 'Pastel', c: { main: '#ffafcc', shell: '#ffb8d2', shellHi: '#ffd6e5', window: '#f08db3', tv: '#ffe0ec', tvDark: '#f5bfd3', vcr: '#fff4f8', vcrHi: '#ffffff', accent: '#8ecae6', cover: '#ffc8dd', cover2: '#8ecae6' } },
];

// ---------------------------------------------------------------------------------------------
// Default flipbook: a little blob hopping under the stars (6 frames, 24×24)

export function defaultFlipbook(): PixelArt {
  const size = 24;
  const palette: [number, number, number][] = [
    [22, 24, 52], // 0 night
    [48, 44, 104], // 1 night light
    [255, 255, 255], // 2 white
    [255, 214, 102], // 3 star yellow
    [255, 120, 168], // 4 blob pink
    [255, 178, 208], // 5 blob light
    [29, 27, 38], // 6 ink
    [110, 220, 170], // 7 grass
    [60, 170, 120], // 8 grass dark
  ];
  const hops = [0, 3, 5, 6, 5, 3];
  const frames: Uint8Array[] = [];
  for (let f = 0; f < 6; f++) {
    const px = new Uint8Array(size * size);
    const h = hops[f];
    const squash = f === 0 ? 1 : 0;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let c = y < 12 ? 0 : 1;
        if (y >= 20) c = (x + (y === 20 ? 0 : 1)) % 3 === 0 ? 8 : 7;
        // twinkling stars
        const stars = [[3, 3], [19, 2], [9, 7], [21, 9], [14, 4]];
        stars.forEach(([sx, sy], i) => {
          if (x === sx && y === sy) c = (i + f) % 3 === 0 ? 2 : 3;
        });
        // blob body (ellipse), squashes when it lands
        const cx = 12;
        const cy = 16 - h + squash;
        const rx = 5 + squash;
        const ry = 4.5 - squash;
        const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (d <= 1) c = d > 0.7 ? 4 : 5;
        if (d > 1 && d <= 1.35 && y < 20) c = 6;
        // face
        const ey = Math.round(cy - 1);
        if (y === ey && (x === 10 || x === 14)) c = 6;
        if (y === ey + 2 && x >= 11 && x <= 13) c = 6;
        if (y === ey + 1 && (x === 9 || x === 15)) c = 4;
        // shadow on the grass
        if (y === 20 && Math.abs(x - 12) <= 3 - Math.floor(h / 3)) c = 8;
        px[y * size + x] = c;
      }
    frames.push(px);
  }
  return { w: size, h: size, palette, frames, delay: 140, caption: 'My Flipbook' };
}

/** Flipbook frame as a CRT picture: upscaled 3× with faint scanlines. */
export function crtFrame(art: PixelArt, frame: number): HTMLCanvasElement {
  const src = pixelArtCanvas(art, frame, 1);
  const k = 3;
  const p = new Painter(art.w * k, art.h * k);
  p.ctx.imageSmoothingEnabled = false;
  p.ctx.drawImage(src, 0, 0, art.w * k, art.h * k);
  p.ctx.globalAlpha = 0.18;
  for (let y = 2; y < p.h; y += k) p.rect(0, y, p.w, 1, '#000000');
  p.ctx.globalAlpha = 1;
  return p.canvas;
}

/** Static noise frames. */
export function noiseFrame(seed: number, w = 48, h = 40): HTMLCanvasElement {
  const p = new Painter(w, h);
  let s = seed * 7919 + 13;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const img = p.ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.floor(40 + rnd() * 215);
    const band = Math.floor(i / w) % 9 === seed % 9 ? 30 : 0;
    img.data[i * 4] = Math.min(255, v + band);
    img.data[i * 4 + 1] = Math.min(255, v + band);
    img.data[i * 4 + 2] = Math.min(255, v + band + 10);
    img.data[i * 4 + 3] = 255;
  }
  p.ctx.putImageData(img, 0, 0);
  return p.canvas;
}

/** Diagonal glare + corner shading on the CRT glass (transparent). */
export function glassArt(): Painter {
  const p = new Painter(40, 36);
  p.ctx.globalAlpha = 0.22;
  p.poly([[4, 2], [14, 2], [4, 14]], '#ffffff');
  p.ctx.globalAlpha = 0.12;
  p.poly([[16, 2], [22, 2], [4, 20], [4, 15]], '#ffffff');
  p.ctx.globalAlpha = 1;
  return p;
}

// ---------------------------------------------------------------------------------------------
// Printed surfaces

/** VCR front display: "12:00" or "PLAY". */
export function vcrDisplay(text: string, on = true): Painter {
  const p = new Painter(40, 9);
  p.clear('#0d1a17');
  if (on) p.text(text, 20, 2, { font: FONT_TINY, color: '#5cffc8', align: 'center' });
  return p;
}

/** Printed strip along the top of the VCR front (160×10). */
export function vcrLabel(f: Flavor): Painter {
  const p = new Painter(160, 10);
  p.clear(f.c.vcr);
  const light = f.id === 'pastel' ? '#9c6b82' : '#d9d9e6';
  p.rect(0, 8, 160, 1, shade(f.c.vcr, f.id === 'pastel' ? -0.12 : 0.12));
  p.text('QR-VHS', 4, 2, { font: FONT_TINY, color: light });
  p.roundRect(34, 1, 13, 7, 2, light);
  p.text('HQ', 40.5, 2, { font: FONT_TINY, color: f.c.vcr, align: 'center' });
  p.text('4 HEAD HI-FI', 54, 2, { font: FONT_TINY, color: shade(light, -0.25) });
  p.text('STEREO', 156, 2, { font: FONT_TINY, color: f.c.accent, align: 'right' });
  return p;
}

export function tvBrand(f: Flavor): Painter {
  const p = new Painter(28, 7);
  p.clear(f.c.tv);
  p.text('QR TV', 1, 1, { font: FONT_TINY, color: shade(f.c.tvDark, -0.35) });
  p.px(24, 3, '#ff5d73').px(25, 3, '#ffd23f').px(26, 3, '#3ddc84');
  return p;
}

/** Upper-case and shorten a title to `n` characters, preferring to cut at a space. */
export function shortTitle(title: string, n: number): string {
  const t = title.toUpperCase().trim();
  if (t.length <= n) return t;
  const cut = t.lastIndexOf(' ', n);
  return (cut > n / 2 ? t.slice(0, cut) : t.slice(0, n)).trim();
}

/** Tape top face (78×43): reel windows and a paper label with room for the small QR. */
export const TAPE_TOP = { w: 78, h: 43, qrX: 57, qrY: 4, qrSize: 12 };

export function tapeTop(f: Flavor, title: string): Painter {
  const { w, h } = TAPE_TOP;
  const p = new Painter(w, h);
  const c = f.c;
  p.clear(c.shell);
  p.strokeRect(0, 0, w, h, shade(c.shell, -0.25));
  p.rect(1, 1, w - 2, 1, c.shellHi);
  // label
  p.rect(6, 2, 66, 15, '#fbfaf5');
  p.rect(6, 2, 66, 3, c.accent);
  p.rect(6, 16, 66, 1, '#d8d4c8');
  p.text(shortTitle(title, 11), 9, 8, { font: FONT_TINY, color: PEN });
  p.rect(9, 14, 44, 1, '#d8d4c8');
  // reel windows
  const reel = (cx: number, cy: number, spool: number) => {
    p.disc(cx, cy, 9.5, shade(c.window, -0.1));
    p.disc(cx, cy, 8.5, c.window);
    p.disc(cx, cy, spool, '#5a3a2a');
    p.disc(cx, cy, 3.6, '#f4f4f4');
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      p.px(Math.round(cx + Math.cos(a) * 2.6), Math.round(cy + Math.sin(a) * 2.6), '#9a9aa6');
    }
    p.px(cx, cy, INK);
  };
  reel(22, 29, 8);
  reel(56, 29, 5);
  // clear window between the reels
  p.rect(33, 25, 12, 8, shade(c.window, 0.05));
  p.strokeRect(33, 25, 12, 8, shade(c.shell, -0.2));
  // screws
  for (const [x, y] of [[3, 3], [w - 4, 3], [3, h - 4], [w - 4, h - 4]] as const) p.px(x, y, shade(c.shell, -0.45));
  return p;
}

/** The spine (78×11) that faces you when the tape lies on the table. */
export function tapeSpine(f: Flavor, title: string): Painter {
  const p = new Painter(78, 11);
  p.clear(f.c.shell);
  p.rect(4, 2, 70, 7, '#fbfaf5');
  p.rect(4, 2, 3, 7, f.c.accent);
  p.text(shortTitle(title, 14), 10, 3, { font: FONT_TINY, color: PEN });
  p.text('SP', 72, 3, { font: FONT_TINY, color: '#9a9aa6', align: 'right' });
  return p;
}

/** Tape flap side (78×11). */
export function tapeFlap(f: Flavor): Painter {
  const p = new Painter(78, 11);
  p.clear(shade(f.c.shell, -0.12));
  p.rect(10, 3, 58, 5, shade(f.c.shell, -0.3));
  p.rect(10, 3, 58, 1, shade(f.c.shell, 0.05));
  return p;
}

/** VHS sleeve cover (44×80), standing like a rental tape. */
export function sleeveCover(f: Flavor): Painter {
  const w = 44;
  const h = 80;
  const p = new Painter(w, h);
  const c = f.c;
  p.clear(c.cover);
  // rainbow stripes across
  const stripes = ['#ff5d73', '#ffb13b', '#ffe066', '#3ddc84', '#4cc9f0'];
  stripes.forEach((s, i) => p.poly([[0, 44 + i * 4], [w, 30 + i * 4], [w, 33 + i * 4], [0, 47 + i * 4]], s));
  // title
  p.text('FLIP', w / 2, 4, { font: FONT_BIG, bold: true, color: '#ffffff', outline: INK, shadow: INK, shadowOffset: [0, 1], align: 'center' });
  p.text('BOOK', w / 2, 13, { font: FONT_BIG, bold: true, color: c.cover2, outline: INK, shadow: INK, shadowOffset: [0, 1], align: 'center' });
  p.text('TAPE', w / 2, 23, { font: FONT_TINY, color: '#ffffff', outline: INK, align: 'center' });
  // TV mascot
  const L = new Painter(24, 22);
  L.roundRect(2, 3, 20, 15, 3, c.tv);
  L.rect(5, 6, 11, 9, '#7ee0ff');
  L.px(8, 9, INK).px(12, 9, INK).rect(9, 12, 3, 1, INK);
  L.px(18, 7, INK).px(18, 11, INK);
  L.thickLine(8, 3, 5, 0, 0.5, '#9a9aa6');
  L.thickLine(14, 3, 18, 0, 0.5, '#9a9aa6');
  L.rect(5, 18, 2, 3, INK).rect(17, 18, 2, 3, INK);
  L.outline(INK);
  p.blit(L, 10, 52);
  // stickers
  // "be kind, rewind" sticker: a rewind icon
  p.disc(35, 70, 7, INK);
  p.disc(35, 70, 6, '#ffe066');
  p.poly([[30, 70], [34, 67], [34, 73]], INK);
  p.poly([[34, 70], [38, 67], [38, 73]], INK);
  p.rect(39, 67, 1, 6, INK);
  p.roundRect(3, 70, 13, 7, 2, '#ffffff');
  p.text('VHS', 9.5, 71, { font: FONT_TINY, color: INK, align: 'center' });
  p.strokeRect(0, 0, w, h, INK);
  return p;
}

export function sleeveSpine(f: Flavor): Painter {
  const p = new Painter(12, 80);
  p.clear(f.c.cover);
  p.rect(2, 4, 8, 72, '#ffffff');
  const t = 'FLIPBOOK';
  for (let i = 0; i < t.length; i++) p.text(t[i], 6, 10 + i * 7, { font: FONT_TINY, color: INK, align: 'center' });
  return p;
}

// ---------------------------------------------------------------------------------------------
// Voxels

/** CRT TV grid (scale 0.05). Screen opening x 2..21, y 4..21 on the front (z 21). */
export const TV = { sx: 30, sy: 27, sz: 24, scale: 0.05, scrX0: 2, scrX1: 21, scrY0: 4, scrY1: 21 };

export function tvVoxels(f: Flavor): VoxelGrid {
  const g = new VoxelGrid(TV.sx, TV.sy, TV.sz);
  const body = f.c.tv;
  const dark = f.c.tvDark;
  // main body (rounded front box) + tapered CRT back
  const r = 2;
  for (let z = 6; z <= 21; z++)
    for (let y = 1; y <= 24; y++)
      for (let x = 0; x <= 29; x++) {
        const dx = Math.max(r - x, 0, x - (29 - r));
        const dy = Math.max(1 + r - y, 0, y - (24 - r));
        const dz = Math.max(6 + r - z, 0, z - (21 - r));
        if (dx * dx + dy * dy + dz * dz <= r * r + 0.01) g.set(x, y, z, body);
      }
  g.box(4, 3, 1, 25, 21, 5, dark);
  g.box(7, 5, 0, 22, 19, 0, shade(dark, -0.08));
  // feet
  for (const [x, z] of [[2, 7], [27, 7], [2, 19], [27, 19]] as const) g.box(x - 1, 0, z - 1, x, 0, z, INK);
  // screen opening: dark tube rim, recessed
  const { scrX0, scrX1, scrY0, scrY1 } = TV;
  g.box(scrX0 - 1, scrY0 - 1, 21, scrX1 + 1, scrY1 + 1, 21, '#3a3a44');
  g.box(scrX0, scrY0, 20, scrX1, scrY1, 21, null);
  g.box(scrX0, scrY0, 19, scrX1, scrY1, 19, '#101014');
  // bezel bevel
  g.box(scrX0 - 2, scrY0 - 2, 21, scrX1 + 2, scrY0 - 2, 21, dark);
  // knob panel
  const knob = (cx: number, cy: number, rad: number, depth: number) => {
    for (let y = cy - 3; y <= cy + 3; y++)
      for (let x = cx - 3; x <= cx + 3; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= rad) g.box(x, y, 22, x, y, 21 + depth, d > rad - 1 ? '#2c2c34' : '#4a4a56');
      }
  };
  knob(25, 18, 2.4, 2);
  knob(25, 12, 1.8, 1);
  g.set(25, 20, 23, '#ffffff').set(25, 19, 23, '#ffffff').set(25, 13, 22, '#ffffff');
  // speaker grille
  for (let y = 3; y <= 8; y += 2) g.box(23, y, 21, 27, y, 21, shade(dark, -0.25));
  // antenna base on top
  g.box(12, 25, 11, 17, 25, 15, '#4a4a54');
  g.box(13, 26, 12, 16, 26, 14, '#5a5a66');
  return g;
}

/** VCR grid (scale 0.05): slot x 4..20, y 2..4 on the front (z 21). */
export const VCR = { sx: 32, sy: 8, sz: 22, scale: 0.05, slotX0: 4, slotX1: 20, slotY0: 2, slotY1: 4 };

export function vcrVoxels(f: Flavor): VoxelGrid {
  const g = new VoxelGrid(VCR.sx, VCR.sy, VCR.sz);
  const body = f.c.vcr;
  const hi = f.c.vcrHi;
  g.box(0, 1, 0, 31, 7, 21, body);
  g.box(0, 7, 0, 31, 7, 21, hi);
  g.box(0, 7, 21, 31, 7, 21, shade(hi, 0.1));
  for (const [x, z] of [[1, 1], [30, 1], [1, 20], [30, 20]] as const) g.set(x, 0, z, INK);
  // slot: hollow with dark walls
  const { slotX0, slotX1, slotY0, slotY1 } = VCR;
  g.box(slotX0 - 1, slotY0 - 1, 10, slotX1 + 1, slotY1 + 1, 21, INK);
  g.box(slotX0, slotY0, 11, slotX1, slotY1, 21, null);
  g.box(slotX0 - 1, slotY0 - 1, 21, slotX1 + 1, slotY0 - 1, 21, shade(body, -0.25));
  // buttons row
  for (let i = 0; i < 5; i++) g.set(22 + i * 2, 1, 21, i === 1 ? '#ff5d73' : '#9a9aa6');
  return g;
}
