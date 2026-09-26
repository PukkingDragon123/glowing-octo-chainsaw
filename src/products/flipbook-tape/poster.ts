import { Painter, shade } from '../../engine/Painter';
import { FONT_TINY } from '../../engine/pixelFont';
import type { Flavor } from '../types';
import type { PixelArt } from '../../qr/pixelCodec';
import { pixelArtCanvas } from '../../qr/pixelCapture';
import { INK, PEN, shortTitle, tapeyArt } from './art';

/** Poster: the little TV showing the code (tapey sitting on top), the VCR below and a film strip of the frames. */
export function flipbookPosterArt(f: Flavor, flip: PixelArt, title: string) {
  const w = 120;
  const h = 134;
  const c = f.c;
  const p = new Painter(w, h);
  p.clear(c.cover);
  for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) p.rect(x, y, 4, 4, shade(c.cover, 0.06));

  // antenna
  p.thickLine(52, 16, 38, 3, 0.6, '#c9ced6');
  p.thickLine(56, 16, 72, 4, 0.6, '#c9ced6');
  p.disc(38, 3, 2, c.accent);
  p.disc(72, 4, 2, c.accent);
  // TV body
  const tv = new Painter(w, 90);
  tv.roundRect(6, 14, 108, 74, 6, c.tv);
  tv.rect(10, 84, 100, 3, c.tvDark);
  tv.rect(12, 88, 6, 2, INK).rect(102, 88, 6, 2, INK);
  tv.outline(INK);
  p.blit(tv, 0, 0);
  const sx = 12;
  const sy = 19;
  const ss = 64;
  // tube rim (the code panel inside stays light)
  p.roundRect(sx - 3, sy - 3, ss + 6, ss + 6, 3, '#3a3a44');
  p.rect(sx, sy, ss, ss, '#eef7ff');
  // knob panel
  p.disc(95, 32, 7, INK);
  p.disc(95, 32, 6, '#4a4a56');
  p.rect(94, 26, 2, 5, '#ffffff');
  p.disc(95, 52, 5, INK);
  p.disc(95, 52, 4, '#4a4a56');
  for (let y = 62; y < 78; y += 3) p.rect(86, y, 18, 1, shade(c.tvDark, -0.25));
  p.rect(104, 20, 3, 3, '#5cff9a');
  p.text('QR TV', sx + ss / 2, 84, { font: FONT_TINY, color: shade(c.tvDark, -0.4), align: 'center' });

  // VCR
  p.rect(8, 92, 104, 12, INK);
  p.rect(9, 93, 102, 10, c.vcr);
  p.rect(14, 96, 44, 4, INK);
  p.rect(74, 95, 30, 6, '#0d1a17');
  p.text('PLAY', 89, 96, { font: FONT_TINY, color: '#5cffc8', align: 'center' });

  // film strip with up to 4 frames
  const fy = 108;
  p.rect(0, fy, w, 24, '#1b1b22');
  for (let x = 2; x < w; x += 6) {
    p.rect(x, fy + 2, 3, 2, '#e8e8f0');
    p.rect(x, fy + 20, 3, 2, '#e8e8f0');
  }
  const n = Math.min(4, flip.frames.length);
  const fw = 14;
  const gap = 6;
  const total = n * fw + (n - 1) * gap;
  const x0 = Math.round((w - total) / 2) - 17;
  for (let i = 0; i < n; i++) {
    const fr = Math.floor((i * flip.frames.length) / n);
    const x = x0 + i * (fw + gap);
    p.rect(x - 1, fy + 5, fw + 2, fw + 2, '#000000');
    p.ctx.imageSmoothingEnabled = false;
    p.ctx.drawImage(pixelArtCanvas(flip, fr, 1), x, fy + 6, fw, fw);
  }
  // title label like a tape spine (two short lines)
  p.rect(w - 37, fy + 5, 34, 14, '#fbfaf5');
  p.rect(w - 37, fy + 5, 2, 14, c.accent);
  const t = shortTitle(title, 16);
  const split = t.length > 8 ? Math.max(t.lastIndexOf(' ', 8), 0) : t.length;
  const l1 = split > 0 ? t.slice(0, split) : t.slice(0, 8);
  const l2 = shortTitle(t.slice(l1.length).trim(), 8);
  p.text(l1, w - 19, fy + 6, { font: FONT_TINY, color: PEN, align: 'center' });
  if (l2) p.text(l2, w - 19, fy + 12, { font: FONT_TINY, color: PEN, align: 'center' });

  // extra headroom so tapey can sit on the TV
  const top = 16;
  const out = new Painter(w, h + top);
  out.clear(c.cover);
  for (let y = 0; y < top; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) out.rect(x, y, 4, 4, shade(c.cover, 0.06));
  out.blit(p, 0, top);
  const tapey = tapeyArt(0.56, { armL: 2.6, armR: 2.6, eyes: 'happy', mouth: 'open' });
  out.blit(tapey, w - 8 - tapey.w, top + 15 - tapey.h);
  out.strokeRect(0, 0, w, h + top, INK);
  return { art: out, qrX: sx, qrY: sy + top, qrSize: ss };
}
