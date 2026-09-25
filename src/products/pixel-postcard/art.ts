import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { VoxelGrid } from '../../engine/voxel';
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

export const DEFAULT_CAPTION = 'Hi from QR Market!';

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
  p.text('QR MARKET INSTANT', w / 2, h - 8, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  return p;
}

/** Transparent strip with the handwritten caption; `chars` limits how much is written. */
export function drawCaption(target: Painter, text: string, chars: number) {
  target.clear();
  target.text(text.slice(0, chars), 0, 1, { font: FONT_BIG, color: PEN });
}

/** Small printed badge on the camera front (two lines). */
export function cameraLabel(f: Flavor): Painter {
  const p = new Painter(32, 18);
  p.clear(f.c.band);
  const light = f.id === 'classic' ? INK : '#ffffff';
  p.text('PIXEL', 16, 3, { font: FONT_TINY, color: light, align: 'center' });
  p.rect(5, 9, 22, 1, shade(f.c.band, -0.15));
  p.text('INSTANT', 16, 11, { font: FONT_TINY, color: f.id === 'classic' ? '#ff5d73' : f.id === 'midnight' ? f.c.accent : '#fff6c8', align: 'center' });
  return p;
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
// Voxels

/** Camera grid: body occupies z 0..15, the lens pokes out to z 19. */
export const CAM = { sx: 36, sy: 21, sz: 20, scale: 0.05, lensX: 12.5, lensY: 10.5, slotZ: 3 };

export function cameraVoxels(f: Flavor): VoxelGrid {
  const g = new VoxelGrid(CAM.sx, CAM.sy, CAM.sz);
  const body = f.c.body;
  const band = f.c.band;
  // rounded body
  const r = 2;
  for (let z = 0; z <= 15; z++)
    for (let y = 0; y <= 20; y++)
      for (let x = 0; x <= 35; x++) {
        const dx = Math.max(r - x, 0, x - (35 - r));
        const dy = Math.max(r - y, 0, y - (20 - r));
        const dz = Math.max(r - z, 0, z - (15 - r));
        if (dx * dx + dy * dy + dz * dz <= r * r + 0.01) g.set(x, y, z, y <= 5 ? band : body);
      }
  // film slot along the top (a real groove so the photo can come out)
  for (let x = 2; x <= 33; x++) {
    g.set(x, 20, CAM.slotZ, null).set(x, 19, CAM.slotZ, null);
    g.set(x, 20, CAM.slotZ - 1, shade(band, -0.2)).set(x, 20, CAM.slotZ + 1, shade(band, -0.2));
  }
  // rainbow stripe on the front
  const stripe = ['#ff5d73', '#ffb13b', '#ffe066', '#3ddc84', '#4cc9f0'];
  for (let y = 0; y <= 20; y++)
    for (let i = 0; i < stripe.length; i++) {
      const x = 22 + i;
      for (let z = 15; z >= 12; z--)
        if (g.filled(x, y, z)) {
          g.set(x, y, z, stripe[i]);
          break;
        }
    }
  // lens: base ring, silver barrel, dark glass with a glint
  const { lensX, lensY } = CAM;
  for (let y = 0; y < CAM.sy; y++)
    for (let x = 0; x < CAM.sx; x++) {
      const d = Math.hypot(x + 0.5 - lensX, y + 0.5 - lensY);
      if (d <= 7.2) g.set(x, y, 16, '#34343f');
      if (d <= 6.2) {
        g.box(x, y, 16, x, y, 18, d > 5.2 ? '#b9bfca' : '#d9dee6');
      }
      if (d <= 4.6) g.set(x, y, 19, INK).set(x, y, 18, INK);
      if (d <= 3.3) g.set(x, y, 19, null).set(x, y, 18, d < 1.3 ? '#35509a' : '#23346e');
    }
  g.set(11, 12, 18, '#9fd8ff').set(10, 12, 18, '#ffffff').set(11, 13, 18, '#9fd8ff');
  // accent ring around the lens on the body
  for (let y = 0; y < CAM.sy; y++)
    for (let x = 0; x < CAM.sx; x++) {
      const d = Math.hypot(x + 0.5 - lensX, y + 0.5 - lensY);
      if (d > 7.2 && d <= 8.2 && g.filled(x, y, 15)) g.set(x, y, 15, f.c.accent);
    }
  // viewfinder window (top right)
  g.box(28, 15, 15, 32, 18, 15, INK);
  g.box(29, 17, 15, 29, 17, 15, '#9fd8ff');
  g.box(27, 14, 15, 33, 14, 15, shade(body, -0.15));
  // strap lugs on the sides
  g.box(0, 14, 6, 0, 16, 9, '#c9ced6');
  g.box(35, 14, 6, 35, 16, 9, '#c9ced6');
  return g;
}
