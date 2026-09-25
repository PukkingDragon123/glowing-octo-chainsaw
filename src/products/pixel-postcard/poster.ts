import { Painter, shade } from '../../engine/Painter';
import { FONT_TINY } from '../../engine/pixelFont';
import type { Flavor } from '../types';
import type { PixelArt } from '../../qr/pixelCodec';
import { INK, PHOTO, fitCaption, photoFront, pictureCanvas } from './art';

/** Poster: the developed instant photo taped to a cork board. */
export function postcardPosterArt(f: Flavor, art: PixelArt | null) {
  const w = PHOTO.w + 16;
  const h = PHOTO.h + 28;
  const p = new Painter(w, h);
  p.clear('#d6a574');
  let s = 9;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) p.px(Math.floor(rnd() * w), Math.floor(rnd() * h), i % 3 ? '#c18c5c' : '#e6bf92');
  const ox = 8;
  const oy = 11;
  // photo with a soft drop shadow
  p.rect(ox + 2, oy + 2, PHOTO.w, PHOTO.h, '#a8784c');
  const caption = fitCaption(art?.caption ?? '', PHOTO.capW);
  p.blit(photoFront(f, pictureCanvas(art), caption), ox, oy);
  // washi tape on the top corners
  const tape = (pts: [number, number][], c: string) => {
    p.ctx.globalAlpha = 0.85;
    p.poly(pts, c);
    p.ctx.globalAlpha = 1;
  };
  tape([[ox - 5, oy + 3], [ox + 13, oy - 5], [ox + 17, oy + 3], [ox - 1, oy + 11]], shade(f.c.accent, 0.2));
  tape([[ox + PHOTO.w - 13, oy - 5], [ox + PHOTO.w + 5, oy + 3], [ox + PHOTO.w + 1, oy + 11], [ox + PHOTO.w - 17, oy + 3]], '#9ad8ff');
  // title + a heart doodle along the bottom of the board
  p.text(f.name.toUpperCase() + ' FILM', ox, h - 10, { font: FONT_TINY, color: '#fff6e6', outline: '#8a5a33' });
  p.sprite(['.#.#.', '#####', '#####', '.###.', '..#..'], w - 16, h - 11, { '#': f.c.doodle });
  p.strokeRect(0, 0, w, h, INK);
  return { art: p, qrX: ox + PHOTO.qrX, qrY: oy + PHOTO.qrY, qrSize: PHOTO.qrSize };
}
