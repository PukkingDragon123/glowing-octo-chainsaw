import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { buddyPortrait, type BuddySpec, type Pose } from '../../art/buddy';
import { CAST } from '../../art/cast';
import type { Flavor } from '../types';
import type { PixelArt } from '../../qr/pixelCodec';
import { pixelArtCanvas } from '../../qr/pixelCapture';

export const INK = '#1d1b26';
export const PEN = '#2f4bc4';

export const POSTCARD_FLAVORS: Flavor[] = [
  { id: 'classic', name: 'Classic', c: { main: '#f4f1ea', body: '#f4f1ea', band: '#d9d3c4', accent: '#ff5d73', paper: '#fbfaf7', doodle: '#ff5d73' } },
  { id: 'sunset', name: 'Sunset', c: { main: '#ff8c61', body: '#ff9b71', band: '#e8704b', accent: '#ffd23f', paper: '#fff5ec', doodle: '#ff8c61' } },
  { id: 'mint', name: 'Mint', c: { main: '#7ae7c7', body: '#7ae7c7', band: '#4fc6a4', accent: '#ff8fab', paper: '#f3fdf9', doodle: '#2fb58c' } },
  { id: 'midnight', name: 'Midnight', c: { main: '#2b2d42', body: '#3b3e5e', band: '#2b2d42', accent: '#ffd23f', paper: '#f3f3ff', doodle: '#6c63ff' } },
];

/** Instant photo layout (texture pixels): picture on the left, the code on the right, caption below. */
export const PHOTO = { w: 112, h: 68, picX: 4, picY: 4, picSize: 50, qrX: 58, qrY: 4, qrSize: 50, capX: 5, capY: 57, capW: 102, capH: 9 };

// ---------------------------------------------------------------------------------------------
// Pictures

/** Default postcard picture: a sunset beach with a smiling sun, palm tree and a sailboat (32×32). */
export function defaultPicture(): Painter {
  const p = new Painter(32, 32);
  p.gradientV(0, 0, 32, 20, '#ff9ecd', '#ffc26b', 4);
  // clouds
  const cloud = (x: number, y: number) => {
    p.ellipse(x, y, 3.5, 1.6, '#ffffff');
    p.ellipse(x + 2.5, y - 1, 2.2, 1.6, '#ffffff');
    p.rect(x - 3, y + 1, 7, 1, '#ffe3f1');
  };
  cloud(6, 5);
  cloud(25, 8);
  // sun with a face
  p.disc(17, 16, 7, '#ffe066');
  p.disc(17, 16, 5.5, '#fff08a');
  p.px(15, 14, INK).px(19, 14, INK).px(15, 15, INK).px(19, 15, INK);
  p.px(13, 16, '#ff8fab').px(21, 16, '#ff8fab');
  p.rect(16, 18, 3, 1, INK).px(15, 17, INK).px(19, 17, INK);
  // sea
  p.rect(0, 19, 32, 8, '#3a8dde');
  p.rect(0, 19, 32, 1, '#ffd6a0');
  for (let y = 21; y < 27; y += 2) for (let x = (y * 3) % 5; x < 32; x += 6) p.rect(x, y, 3, 1, '#8fd3ff');
  p.rect(10, 20, 14, 1, '#ffe8b0');
  p.rect(12, 22, 10, 1, '#ffe8b0');
  // sailboat
  p.poly([[25, 12], [25, 19], [21, 19]], '#ffffff');
  p.poly([[26, 14], [26, 19], [29, 19]], '#ff5d73');
  p.rect(21, 19, 9, 2, '#8a4b2a');
  // sand
  p.rect(0, 27, 32, 5, '#ffd89e');
  for (let i = 0; i < 12; i++) p.px((i * 7 + 3) % 32, 28 + (i % 4), '#e8b96a');
  // palm tree
  p.thickLine(5, 30, 7, 12, 0.8, '#8a5a2b');
  for (let y = 14; y < 30; y += 3) p.px(6, y, '#6b4220');
  const leaf = (x1: number, y1: number) => p.thickLine(7, 11, x1, y1, 0.9, '#2fb56a');
  leaf(1, 13);
  leaf(13, 13);
  leaf(3, 8);
  leaf(12, 8);
  leaf(8, 5);
  p.disc(7, 12, 1.2, '#6b3f1f');
  // birds
  p.px(12, 6, INK).px(13, 7, INK).px(14, 6, INK);
  p.px(20, 3, INK).px(21, 4, INK).px(22, 3, INK);
  return p;
}

/** The picture for a postcard: the user's pixel art, or the default scene. */
export function pictureCanvas(art: PixelArt | null, frame = 0): HTMLCanvasElement {
  return art ? pixelArtCanvas(art, frame, 1) : defaultPicture().canvas;
}

// ---------------------------------------------------------------------------------------------
// Photo paper

export const DEFAULT_CAPTION = 'Hi from Kobini!';

/** Fit a caption into `maxW` pixels (FONT_BIG, mixed case), with a trailing ".." when cut. */
export function fitCaption(text: string, maxW: number): string {
  const p = new Painter(4, 4);
  let s = text.trim() || DEFAULT_CAPTION;
  if (p.textWidth(s, { font: FONT_BIG }) <= maxW) return s;
  while (s.length > 1 && p.textWidth(s + '..', { font: FONT_BIG }) > maxW) s = s.slice(0, -1);
  return s.trimEnd() + '..';
}

/** Photo paper: border, the picture window (dark until developed) and the code panel. */
export function photoFront(f: Flavor, picture?: HTMLCanvasElement, caption?: string): Painter {
  const { w, h, picX, picY, picSize, qrX, qrY, qrSize } = PHOTO;
  const p = new Painter(w, h);
  const paper = f.c.paper;
  p.clear(paper);
  // paper grain
  let s = 5;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) p.px(Math.floor(rnd() * w), Math.floor(rnd() * h), shade(paper, -0.04));
  // picture window
  p.rect(picX - 1, picY - 1, picSize + 2, picSize + 2, shade(paper, -0.14));
  if (picture) {
    p.ctx.imageSmoothingEnabled = false;
    p.ctx.drawImage(picture, picX, picY, picSize, picSize);
  } else p.rect(picX, picY, picSize, picSize, '#2a1d18');
  // code panel stays plain paper white
  p.rect(qrX, qrY, qrSize, qrSize, '#ffffff');
  // doodles in the corners of the caption strip (well away from the code)
  const d = f.c.doodle;
  p.px(w - 6, h - 6, d).px(w - 7, h - 6, d).px(w - 5, h - 6, d).px(w - 6, h - 7, d).px(w - 6, h - 5, d);
  p.px(w - 10, h - 9, d);
  if (caption) p.text(caption, PHOTO.capX, PHOTO.capY, { font: FONT_BIG, color: PEN });
  // edge
  p.strokeRect(0, 0, w, h, shade(paper, -0.22));
  return p;
}

export function photoBack(f: Flavor): Painter {
  const { w, h } = PHOTO;
  const p = new Painter(w, h);
  p.clear('#f0ede6');
  for (let x = 0; x < w; x += 16) p.text('PIXEL FILM', x + 2, 8 + ((x / 16) % 2) * 20, { font: FONT_TINY, color: '#d6d0c2' });
  p.rect(0, h - 10, w, 10, f.c.band);
  p.text('XOLOTL KOBINI INSTANT', w / 2, h - 8, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  return p;
}

/** Transparent strip with the handwritten caption; `chars` limits how much is written. */
export function drawCaption(target: Painter, text: string, chars: number) {
  target.clear();
  target.text(text.slice(0, chars), 0, 1, { font: FONT_BIG, color: PEN });
}

/** White starburst for the flash. */
export function flashBurst(): Painter {
  const p = new Painter(32, 32);
  p.star(16, 16, 15, 5, 8, '#fff6c8');
  p.star(16, 16, 11, 4, 8, '#ffffff');
  p.disc(16, 16, 5, '#ffffff');
  return p;
}

// ---------------------------------------------------------------------------------------------
// The camera (rounded shapes + painted decals)

/**
 * Instant camera, world units: body w×h×d standing on y = 0 with its front face at z = `front`;
 * the photo slot runs along the top at z = `slotZ`. The lens sits on the left, the label window
 * (where the shop sticker goes) on the right, the flash and viewfinder along the top.
 */
export const CAM = {
  w: 1.8,
  h: 1.2,
  d: 0.8,
  front: 0.3,
  slotZ: -0.325,
  band: 0.3,
  lens: { x: -0.4, y: 0.62, r: 0.42 },
  flash: { x: 0.52, y: 1.04, w: 0.36, h: 0.12 },
  window: { x: 0.41, y: 0.63, w: 0.7, h: 0.52 },
};

/** Painted details above the band, in 100 px per world unit, transparent elsewhere. */
export const FRONT_TEX = { x0: -0.8, x1: 0.8, y0: CAM.band + 0.02, y1: CAM.h - 0.1, ppu: 100 };

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

/** Snappy, the instant-photo buddy, as a flat portrait (`k` = size relative to the full mascot). */
export function snappyArt(k: number, pose: Pose = {}): Painter {
  return buddyPortrait(k === 1 ? CAST.snappy : miniSpec(CAST.snappy, k), pose).toPainter();
}

/** Front decal: the label window (snappy waving on cream) and the viewfinder. */
export function frontDecal(f: Flavor): Painter {
  const { x0, x1, y0, y1, ppu } = FRONT_TEX;
  const W = Math.round((x1 - x0) * ppu);
  const H = Math.round((y1 - y0) * ppu);
  const p = new Painter(W, H);
  const X = (x: number) => Math.round((x - x0) * ppu);
  const Y = (y: number) => Math.round((y1 - y) * ppu);
  // label window
  const win = CAM.window;
  const wx = X(win.x - win.w / 2);
  const wy = Y(win.y + win.h / 2);
  const ww = Math.round(win.w * ppu);
  const wh = Math.round(win.h * ppu);
  p.roundRect(wx - 2, wy - 2, ww + 4, wh + 4, 8, shade(f.c.band, -0.25));
  p.roundRect(wx, wy, ww, wh, 7, f.c.paper);
  p.roundRect(wx + 3, wy + 3, ww - 6, wh - 6, 5, shade(f.c.paper, -0.05));
  for (let x = wx + 8; x < wx + ww - 8; x += 7) p.px(x, wy + wh - 5, shade(f.c.paper, -0.14));
  const snappy = snappyArt(0.72, { armL: 0.5, armR: 2.6 });
  p.blit(snappy, wx + Math.round(ww * 0.33 - snappy.w / 2), wy + wh - 4 - snappy.h);
  p.text('SAY', wx + Math.round(ww * 0.76), wy + 14, { font: FONT_BIG, bold: true, color: f.c.accent, outline: INK, align: 'center' });
  p.text('CHEESE!', wx + Math.round(ww * 0.76), wy + 25, { font: FONT_TINY, color: INK, align: 'center' });
  p.sprite(['.#.#.', '#####', '#####', '.###.', '..#..'], wx + Math.round(ww * 0.76) - 2, wy + 33, { '#': f.c.accent });
  // viewfinder
  const vx = X(0.12);
  const vy = Y(1.08);
  p.roundRect(vx - 1, vy - 1, 16, 12, 3, shade(f.c.body, -0.3));
  p.roundRect(vx, vy, 14, 10, 3, INK);
  p.rect(vx + 3, vy + 2, 3, 2, '#9fd8ff').px(vx + 3, vy + 2, '#ffffff');
  return p;
}

/** Band decal (the grip band along the bottom): a rainbow trailing from the lens and the brand. */
export function bandDecal(f: Flavor): Painter {
  const W = 156;
  const H = 20;
  const p = new Painter(W, H);
  const stripe = ['#ff5d73', '#ffb13b', '#ffe066', '#3ddc84', '#4cc9f0'];
  stripe.forEach((c, i) => p.rect(0, 2 + i * 3, 72, 3, c));
  const light = f.id === 'classic' || f.id === 'mint' ? INK : '#ffffff';
  p.text('PIXEL', 112, 2, { font: FONT_BIG, bold: true, color: light, align: 'center' });
  p.text('INSTANT', 112, 11, { font: FONT_TINY, color: f.c.accent, outline: f.id === 'classic' ? undefined : shade(f.c.band, -0.3), align: 'center' });
  return p;
}
