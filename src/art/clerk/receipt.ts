import * as THREE from 'three';
import { drawLogo } from '../brand';
import { Bitmap, hex, pixelTexture, prng, rect, type RGB } from '../pixel';

/** A generic pixel receipt (used when print() gets no texture of its own). */
export function defaultReceiptTexture(): THREE.CanvasTexture {
  const W = 48;
  const H = 96;
  const b = new Bitmap(W, H);
  const paper = hex('#fffdf4');
  const edge = hex('#e8e1cf');
  const ink = hex('#3a3340');
  const soft = hex('#9c95a3');
  const pink = hex('#f47c9f');
  // paper with a torn zigzag bottom
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const zig = H - 3 + Math.abs(((x % 6) - 3)) * 0.8;
      if (y < zig) b.set(x, y, x === 0 || x === W - 1 ? edge : paper);
    }
  const bar = (x: number, y: number, w: number, c: RGB, h = 1) => b.paint(rect(W, H, x, y, w - 0.01, h - 0.01), c);
  // header: logo + store name
  b.blit(drawLogo(14, { badge: true }), W / 2 - 7, 4);
  bar(9, 21, 30, pink, 2);
  bar(13, 25, 22, soft);
  // items
  const r = prng(7);
  let y = 31;
  for (let i = 0; i < 4; i++) {
    bar(5, y, 8 + Math.floor(r() * 14), ink);
    bar(W - 5 - 7, y, 7, ink);
    y += 4;
  }
  for (let x = 5; x < W - 5; x += 3) bar(x, y + 1, 2, soft);
  y += 5;
  bar(5, y, 12, ink, 2);
  bar(W - 5 - 11, y, 11, ink, 2);
  y += 6;
  // a little code block
  const q = 19;
  const qx = Math.floor(W / 2 - q / 2);
  const qy = y;
  for (let j = 0; j < q; j++)
    for (let i = 0; i < q; i++) {
      const finder = (a: number, c: number) => a >= 0 && a < 7 && c >= 0 && c < 7 && (a === 0 || a === 6 || c === 0 || c === 6 || (a > 1 && a < 5 && c > 1 && c < 5));
      const inFinderZone = (i < 8 && j < 8) || (i > q - 9 && j < 8) || (i < 8 && j > q - 9);
      const on = inFinderZone ? finder(i, j) || finder(i - (q - 7), j) || finder(i, j - (q - 7)) : r() < 0.48;
      if (on) b.set(qx + i, qy + j, ink);
    }
  y += q + 4;
  bar(10, y, 28, soft);
  bar(15, y + 3, 18, pink);
  return pixelTexture(b.toCanvas());
}
