import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { buddyPortrait, type BuddySpec, type Pose } from '../../art/buddy';
import { CAST } from '../../art/cast';
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
// Mascot

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

/** Tapey, the cassette buddy, as a flat portrait (`k` = size relative to the full mascot). */
export function tapeyArt(k: number, pose: Pose = {}): Painter {
  return buddyPortrait(k === 1 ? CAST.tapey : miniSpec(CAST.tapey, k), pose).toPainter();
}

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
  // tapey waving from the cover
  const tapey = tapeyArt(0.5, { armL: 0.5, armR: 2.6 });
  p.blit(tapey, 3, 76 - tapey.h);
  // "be kind, rewind" sticker: a rewind icon
  p.disc(36, 70, 6, INK);
  p.disc(36, 70, 5, '#ffe066');
  p.poly([[32, 70], [35.5, 67.5], [35.5, 72.5]], INK);
  p.poly([[35.5, 70], [39, 67.5], [39, 72.5]], INK);
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
// The TV and the VCR (rounded shapes), world units

/**
 * Little CRT TV standing on y = 0, front face at z = `front`: a rounded body with a CRT hump at the
 * back, a big rounded screen on the left and the knob panel on the right.
 */
export const TV = { w: 1.5, h: 1.25, d: 0.8, front: 0.5, scr: { x: -0.15, y: 0.69, w: 1.0, h: 0.9 }, knobX: 0.53 };

/** VCR under the TV: front face at z = `front`, tape slot on the left. */
export const VCR = { w: 1.6, h: 0.4, d: 1.1, front: 0.55, slot: { x: -0.175, y: 0.175, w: 0.85, h: 0.15 } };
