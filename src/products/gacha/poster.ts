import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import type { Flavor } from '../types';
import { INK, PLAQUE, RED, capsuArt, plaqueArt } from './art';

/** Poster: the prize plaque over a capsule-pattern background with the gacha logo; capsu pops out of the capsule. */
export function gachaPosterArt(f: Flavor) {
  const w = 112;
  const h = 170;
  const p = new Painter(w, h);
  p.clear(RED);
  // capsule wallpaper
  for (let y = 0; y < h; y += 14)
    for (let x = (y / 14) % 2 ? 7 : 0; x < w + 7; x += 14) {
      p.disc(x + 3.5, y + 3.5, 4, shade(RED, 0.12));
      p.rect(x, y + 4, 8, 3, shade(RED, 0.2));
    }
  // light rays behind the plaque
  const px = Math.round((w - PLAQUE.w) / 2);
  const py = 25;
  const cx = w / 2;
  const cy = py + PLAQUE.h / 2;
  for (let i = 0; i < 16; i += 2) {
    const a0 = (i / 16) * Math.PI * 2;
    const a1 = ((i + 1) / 16) * Math.PI * 2;
    p.poly([[cx, cy], [cx + Math.cos(a0) * 150, cy + Math.sin(a0) * 150], [cx + Math.cos(a1) * 150, cy + Math.sin(a1) * 150]], shade(RED, 0.07));
  }
  // logo
  p.text('QR', 38, 4, { font: FONT_BIG, scale: 2, bold: true, color: '#ffffff', outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  p.text('GACHA', 74, 8, { font: FONT_BIG, bold: true, color: '#ffd23f', outline: INK, shadow: INK, shadowOffset: [0, 1], align: 'center' });
  // plaque with a drop shadow
  p.rect(px + 3, py + 3, PLAQUE.w, PLAQUE.h, shade(RED, -0.3));
  p.blit(plaqueArt(f, 0.3), px, py);
  // open capsule halves at the bottom (capsu pops out of the cup)
  const by = py + PLAQUE.h + 20;
  const capsule = (x: number, y: number, top: boolean) => {
    const L = new Painter(22, 14);
    if (top) {
      L.ellipse(11, 12, 10, 10, f.c.cap);
      L.rect(1, 11, 20, 3, shade(f.c.cap, -0.25));
      L.px(6, 5, '#ffffff').px(7, 4, '#ffffff');
    } else {
      L.ellipse(11, 1, 10, 10, '#f6f3fb');
      L.rect(1, 0, 20, 3, '#cfc8dc');
    }
    L.outline(INK);
    p.blit(L, x, y);
  };
  capsule(5, by + 2, true);
  const capsu = capsuArt(0.46, { armL: 2.6, armR: 2.6, eyes: 'happy', mouth: 'open', noLegs: true });
  p.blit(capsu, w - 16 - Math.round(capsu.w / 2), by + 9 - capsu.h);
  capsule(w - 27, by + 4, false);
  p.text('YOU GOT', w / 2, by + 3, { font: FONT_TINY, color: '#ffffff', outline: INK, align: 'center' });
  p.text(f.c.label, w / 2, by + 11, { font: FONT_TINY, color: '#ffd23f', outline: INK, align: 'center' });
  // sparkles
  for (const [sx, sy] of [[9, 34], [103, 48], [8, 96], [104, 110], [96, 12]] as const) {
    p.px(sx, sy, '#ffffff').px(sx - 1, sy, '#ffffff').px(sx + 1, sy, '#ffffff').px(sx, sy - 1, '#ffffff').px(sx, sy + 1, '#ffffff');
  }
  p.strokeRect(0, 0, w, h, INK);
  return { art: p, qrX: px + PLAQUE.qrX, qrY: py + PLAQUE.qrY, qrSize: PLAQUE.qrSize };
}
