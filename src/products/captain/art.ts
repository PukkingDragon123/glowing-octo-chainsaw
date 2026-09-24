import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { VoxelGrid } from '../../engine/voxel';
import type { Flavor } from '../types';
import type { QRLike } from '../../engine/Painter';

export const INK = '#1d1b26';

export const CAPTAIN_FLAVORS: Flavor[] = [
  { id: 'berry', name: 'Berry Blast', c: { bg: '#6f4ef2', grid: '#8467ff', arch: '#f7b8d9', archDark: '#e592bd', accent: '#ffd23f', text: '#ffffff', bowl: '#8fd3ff', piece: '#3a1d57' } },
  { id: 'cocoa', name: 'Cocoa Loco', c: { bg: '#8a5634', grid: '#a0693f', arch: '#f6dcb0', archDark: '#e5c08a', accent: '#ff8b3d', text: '#fff6e0', bowl: '#ffcf9e', piece: '#3b2214' } },
  { id: 'honey', name: 'Honey Hero', c: { bg: '#f4b62f', grid: '#ffc957', arch: '#fff2c7', archDark: '#f5d98a', accent: '#e84a5f', text: '#ffffff', bowl: '#8fe3c8', piece: '#5a2d0c' } },
  { id: 'mint', name: 'Minty Mate', c: { bg: '#27b28b', grid: '#46c9a2', arch: '#d8f6ea', archDark: '#a9e6cf', accent: '#ff5d8f', text: '#ffffff', bowl: '#ffc2d9', piece: '#123f35' } },
];

/** QR card placement on the 112×160 front art (texture pixels). */
export const FRONT = { w: 112, h: 160, cardX: 40, cardY: 74, cardSize: 52 };

export type CaptainPose = 'salute' | 'point' | 'cheer';

/** Captain QR: a waffle-square cereal bit in a captain's hat, rubber-hose limbs and big gloves. */
export function drawCaptain(target: Painter, x: number, y: number, pose: CaptainPose = 'salute', flip = false) {
  const L = new Painter(60, 64);
  const waffle = '#eba53f';
  const waffleDark = '#c77d22';
  const waffleLight = '#fbd27a';
  const glove = '#ffffff';
  const shoe = '#e63950';

  // legs (behind body)
  L.thickLine(22, 44, 19, 55, 0.9, INK);
  L.thickLine(33, 44, 36, 55, 0.9, INK);
  // shoes
  L.ellipse(17.5, 56.5, 4.5, 2.6, shoe);
  L.ellipse(38, 56.5, 4.5, 2.6, shoe);
  L.rect(13, 58, 9, 1, '#ffffff');
  L.rect(34, 58, 9, 1, '#ffffff');

  // arms
  if (pose === 'salute') {
    L.thickLine(15, 34, 9, 27, 0.9, INK);
    L.thickLine(9, 27, 15, 18, 0.9, INK);
  } else if (pose === 'cheer') {
    L.thickLine(15, 33, 8, 24, 0.9, INK);
    L.thickLine(8, 24, 8, 14, 0.9, INK);
  } else {
    L.thickLine(15, 34, 9, 40, 0.9, INK);
  }
  if (pose === 'cheer') {
    L.thickLine(41, 33, 48, 24, 0.9, INK);
    L.thickLine(48, 24, 48, 14, 0.9, INK);
  } else {
    L.thickLine(41, 34, 49, 30, 0.9, INK);
  }

  // body: waffle square
  L.roundRect(13, 22, 30, 25, 4, waffle);
  for (let gx = 18; gx < 42; gx += 5) L.rect(gx, 23, 1, 23, waffleDark);
  for (let gy = 27; gy < 46; gy += 5) L.rect(14, gy, 28, 1, waffleDark);
  L.rect(15, 23, 26, 1, waffleLight);
  L.rect(14, 24, 1, 20, waffleLight);
  // face panel (smooth area so the face reads)
  L.roundRect(17, 27, 22, 15, 4, waffleLight);
  // eyes
  L.ellipse(23, 31.5, 3.2, 4, '#ffffff');
  L.ellipse(33, 31.5, 3.2, 4, '#ffffff');
  L.disc(23.8, 32.4, 1.8, INK);
  L.disc(33.8, 32.4, 1.8, INK);
  L.px(23, 31, '#ffffff');
  L.px(33, 31, '#ffffff');
  // cheeks
  L.ellipse(19.5, 37.5, 1.8, 1.2, '#ff8fa3');
  L.ellipse(36.5, 37.5, 1.8, 1.2, '#ff8fa3');
  // handlebar mustache
  L.ellipse(25.5, 37.5, 3.6, 1.6, INK);
  L.ellipse(30.5, 37.5, 3.6, 1.6, INK);
  L.px(21, 36, INK);
  L.px(20, 35, INK);
  L.px(35, 36, INK);
  L.px(36, 35, INK);
  // smile
  L.rect(26, 40, 4, 1, '#7a1f2b');
  L.px(25, 39, '#7a1f2b');
  L.px(30, 39, '#7a1f2b');

  // captain hat
  L.roundRect(15, 9, 26, 10, 4, '#f4f6fb');
  L.rect(17, 10, 22, 1, '#ffffff');
  L.rect(15, 16, 26, 5, '#23305e');
  L.rect(15, 16, 26, 1, '#3a4a86');
  L.ellipse(28, 21.5, 15, 2.4, '#141428');
  L.disc(28, 16.5, 3, '#ffd23f');
  L.rect(27, 15, 1, 1, INK).rect(29, 15, 1, 1, INK).rect(27, 17, 1, 1, INK).rect(28, 16, 1, 1, '#b8860b');

  // gloves
  const gloveAt = (gx: number, gy: number) => {
    L.disc(gx, gy, 3.6, glove);
    L.disc(gx - 2.5, gy - 2, 1.6, glove);
    L.disc(gx + 2.6, gy - 1.6, 1.5, glove);
    L.rect(gx - 3, gy + 2, 6, 2, glove);
  };
  if (pose === 'salute') gloveAt(15, 16);
  else if (pose === 'cheer') gloveAt(8, 11);
  else gloveAt(9, 42);
  if (pose === 'cheer') gloveAt(48, 11);
  else {
    // pointing hand
    L.disc(50, 30, 3.4, glove);
    L.rect(51, 28, 7, 3, glove);
    L.rect(47, 32, 4, 2, glove);
  }

  L.outline(INK);
  // glove cuff lines after outline
  target.ctx.save();
  if (flip) {
    target.ctx.translate(x + L.w, y);
    target.ctx.scale(-1, 1);
    target.ctx.drawImage(L.canvas, 0, 0);
  } else target.ctx.drawImage(L.canvas, Math.round(x), Math.round(y));
  target.ctx.restore();
}

/** Little waffle cereal bit with outline. */
function cerealBit(p: Painter, x: number, y: number, s: number, color: string) {
  const L = new Painter(s + 2, s + 2);
  L.roundRect(1, 1, s, s, 1, color);
  if (s >= 4) {
    L.px(1 + Math.floor(s / 2), 1 + Math.floor(s / 2), shade(color, -0.2));
    L.rect(1, 1, s, 1, shade(color, 0.15));
  }
  L.outline(INK);
  p.blit(L, x - 1, y - 1);
}

function logo(p: Painter, f: Flavor, cx: number, y: number, big = true) {
  const text = f.c.text;
  p.text('CAPTAIN', cx, y, { font: FONT_BIG, scale: big ? 2 : 1, bold: true, color: text, outline: INK, shadow: INK, shadowOffset: [0, big ? 2 : 1], align: 'center' });
  const qy = y + (big ? 17 : 9);
  const s = big ? 4 : 2;
  const w = p.textWidth('QR', { font: FONT_BIG, scale: s, bold: true });
  p.text('QR', cx, qy, { font: FONT_BIG, scale: s, bold: true, color: f.c.accent, outline: INK, outlineWidth: big ? 2 : 1, shadow: INK, shadowOffset: [0, big ? 3 : 1], align: 'center' });
  if (big) {
    // cute eyes inside the Q's counter
    const qx = Math.round(cx - w / 2);
    p.disc(qx + 7.5, qy + 12, 2.2, '#ffffff');
    p.disc(qx + 13.5, qy + 12, 2.2, '#ffffff');
    p.px(qx + 8, qy + 12, INK).px(qx + 14, qy + 12, INK);
    p.px(qx + 8, qy + 13, INK).px(qx + 14, qy + 13, INK);
  }
}

/** Front of the cereal box. When `qr` is given it is painted into the card (for flat posters). */
export function boxFront(f: Flavor, qr?: QRLike): Painter {
  const { w, h } = FRONT;
  const p = new Painter(w, h);
  p.clear(f.c.bg);
  p.grid(0, 0, w, h, 8, f.c.grid, 3);
  // top shine + bottom shade
  p.rect(0, 0, w, 1, shade(f.c.bg, 0.2));
  p.rect(0, h - 2, w, 2, shade(f.c.bg, -0.2));

  // arch window with floor band
  const ax = 9,
    ay = 50,
    aw = 94,
    ah = 97;
  const archLayer = new Painter(w, h);
  archLayer.arch(ax, ay, aw, ah, f.c.arch);
  archLayer.rect(ax, ay + ah - 16, aw, 16, f.c.archDark);
  // window light rays
  for (let i = 0; i < 3; i++) archLayer.poly([[ax + 20 + i * 22, ay], [ax + 30 + i * 22, ay], [ax + 8 + i * 22, ay + ah - 16], [ax - 2 + i * 22, ay + ah - 16]], shade(f.c.arch, 0.06));
  archLayer.outline(INK);
  p.blit(archLayer, 0, 0);

  // flying cereal bits + milk splash
  const bits: [number, number, number][] = [
    [30, 60, 5], [22, 72, 4], [96, 66, 5], [92, 80, 4], [98, 128, 5], [82, 133, 4], [30, 128, 3], [72, 62, 4],
  ];
  for (const [bx, by, s] of bits) cerealBit(p, bx, by, s, '#eba53f');
  p.ellipse(90, 140, 9, 3, '#ffffff');
  p.disc(84, 136, 2, '#ffffff');
  p.disc(97, 134, 1.5, '#ffffff');

  // QR card (painted for posters; the 3D box overlays a crisp decal here)
  const { cardX, cardY, cardSize } = FRONT;
  p.rect(cardX - 2, cardY - 2, cardSize + 4, cardSize + 4, INK);
  p.rect(cardX, cardY, cardSize, cardSize, '#ffffff');
  p.rect(cardX + cardSize + 2, cardY, 2, cardSize + 4, shade(f.c.arch, -0.35));
  p.rect(cardX, cardY + cardSize + 2, cardSize + 4, 2, shade(f.c.arch, -0.35));
  if (qr) {
    const m = Math.floor(cardSize / (qr.size + 2));
    const off = Math.floor((cardSize - qr.size * m) / 2);
    p.qr(qr, cardX + off, cardY + off, m, INK);
  } else {
    // placeholder pattern
    p.rect(cardX + 4, cardY + 4, 12, 12, INK).rect(cardX + 6, cardY + 6, 8, 8, '#fff').rect(cardX + 8, cardY + 8, 4, 4, INK);
    p.rect(cardX + cardSize - 16, cardY + 4, 12, 12, INK).rect(cardX + cardSize - 14, cardY + 6, 8, 8, '#fff').rect(cardX + cardSize - 12, cardY + 8, 4, 4, INK);
    p.rect(cardX + 4, cardY + cardSize - 16, 12, 12, INK).rect(cardX + 6, cardY + cardSize - 14, 8, 8, '#fff').rect(cardX + 8, cardY + cardSize - 12, 4, 4, INK);
    p.dither(cardX + 18, cardY + 18, cardSize - 22, cardSize - 22, INK, 0.45);
  }
  // "scan me" tab above the card
  p.roundRect(cardX + 12, cardY - 9, 28, 8, 2, f.c.accent);
  p.text('SCAN ME', cardX + 26, cardY - 8, { font: FONT_TINY, color: INK, align: 'center' });

  // mascot breaking out of the arch, holding the card
  drawCaptain(p, -2, 88, 'point');

  // logo
  logo(p, f, w / 2, 5);

  // NEW! burst
  p.burst(96, 36, 11, 12, INK);
  p.burst(96, 36, 10, 12, f.c.accent);
  p.text('NEW', 96, 31, { font: FONT_TINY, color: INK, align: 'center' });
  p.text('!', 96, 37, { font: FONT_TINY, color: INK, align: 'center' });

  // weight tag + badges
  p.roundRect(5, 149, 26, 9, 3, INK);
  p.roundRect(6, 150, 24, 7, 2, '#ffffff');
  p.text('400g', 18, 151, { font: FONT_TINY, color: INK, align: 'center' });
  const badges = ['0%', '0%', 'QR'];
  badges.forEach((b, i) => {
    const bx = 72 + i * 13;
    p.disc(bx, 153, 6, INK);
    p.disc(bx, 153, 5, '#ffffff');
    p.text(b, bx, 151, { font: FONT_TINY, color: INK, align: 'center' });
  });
  return p;
}

/** Side panel with the QR-trition facts table. */
export function boxSide(f: Flavor, withSmallQrSpace = true): Painter {
  const w = 40;
  const h = 160;
  const p = new Painter(w, h);
  p.clear(f.c.bg);
  p.grid(0, 0, w, h, 8, f.c.grid, 3);
  p.text('CAPTAIN', w / 2, 5, { font: FONT_TINY, color: f.c.text, outline: INK, align: 'center' });
  p.text('QR', w / 2, 13, { font: FONT_BIG, scale: 2, bold: true, color: f.c.accent, outline: INK, shadow: INK, shadowOffset: [0, 1], align: 'center' });
  // facts table
  const tx = 3,
    ty = 34,
    tw = w - 6;
  p.rect(tx - 1, ty - 1, tw + 2, 86, INK);
  p.rect(tx, ty, tw, 84, '#ffffff');
  p.text('QR-TRI-', tx + 2, ty + 2, { font: FONT_TINY, color: INK });
  p.text('TION', tx + 2, ty + 8, { font: FONT_TINY, color: INK });
  p.rect(tx + 1, ty + 14, tw - 2, 2, INK);
  const rows: [string, string][] = [
    ['SCANS', '1'],
    ['KCAL', '0'],
    ['SUGAR', '0%'],
    ['PX', '100%'],
    ['LINKS', '1'],
    ['FUN', '200%'],
    ['YUM', 'MAX'],
    ['VIT Q', '99%'],
    ['VIT R', '99%'],
  ];
  rows.forEach(([k, v], i) => {
    const ry = ty + 18 + i * 7;
    p.text(k, tx + 2, ry, { font: FONT_TINY, color: INK });
    p.text(v, tx + tw - 2, ry, { font: FONT_TINY, color: INK, align: 'right' });
    p.rect(tx + 1, ry + 6, tw - 2, 1, '#cfcfd8');
  });
  // small QR area at the bottom (decal is overlaid in 3D)
  if (withSmallQrSpace) {
    p.rect(6, 126, 28, 28, INK);
    p.rect(7, 127, 26, 26, '#ffffff');
    p.dither(9, 129, 22, 22, INK, 0.4);
  }
  return p;
}

/** Back of the box: a maze game, like every good cereal box. */
export function boxBack(f: Flavor): Painter {
  const w = 112;
  const h = 160;
  const p = new Painter(w, h);
  p.clear(f.c.bg);
  p.grid(0, 0, w, h, 8, f.c.grid, 3);
  p.text('HELP CAPTAIN QR', w / 2, 6, { font: FONT_BIG, bold: true, color: f.c.text, outline: INK, shadow: INK, align: 'center' });
  p.text('FIND THE LINK!', w / 2, 18, { font: FONT_BIG, bold: true, color: f.c.accent, outline: INK, shadow: INK, align: 'center' });
  // maze
  const cols = 11,
    rows = 12,
    cs = 8;
  const mx = Math.floor((w - cols * cs) / 2),
    my = 32;
  p.rect(mx - 3, my - 3, cols * cs + 7, rows * cs + 7, INK);
  p.rect(mx - 2, my - 2, cols * cs + 5, rows * cs + 5, '#fffdf5');
  const visited = new Uint8Array(cols * rows);
  const right = new Uint8Array(cols * rows).fill(1);
  const down = new Uint8Array(cols * rows).fill(1);
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stack = [0];
  visited[0] = 1;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const cx = cur % cols,
      cy = Math.floor(cur / cols);
    const nb: [number, string][] = [];
    if (cx > 0 && !visited[cur - 1]) nb.push([cur - 1, 'L']);
    if (cx < cols - 1 && !visited[cur + 1]) nb.push([cur + 1, 'R']);
    if (cy > 0 && !visited[cur - cols]) nb.push([cur - cols, 'U']);
    if (cy < rows - 1 && !visited[cur + cols]) nb.push([cur + cols, 'D']);
    if (!nb.length) {
      stack.pop();
      continue;
    }
    const [nxt, dir] = nb[Math.floor(rnd() * nb.length)];
    if (dir === 'L') right[nxt] = 0;
    if (dir === 'R') right[cur] = 0;
    if (dir === 'U') down[nxt] = 0;
    if (dir === 'D') down[cur] = 0;
    visited[nxt] = 1;
    stack.push(nxt);
  }
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < cols; cx++) {
      const i = cy * cols + cx;
      const x0 = mx + cx * cs,
        y0 = my + cy * cs;
      if (right[i] && cx < cols - 1) p.rect(x0 + cs, y0, 1, cs + 1, f.c.bg);
      if (down[i] && cy < rows - 1) p.rect(x0, y0 + cs, cs + 1, 1, f.c.bg);
    }
  p.strokeRect(mx - 1, my - 1, cols * cs + 3, rows * cs + 3, f.c.bg);
  // start (captain) and goal (phone with QR)
  p.disc(mx + 4, my + 4, 3, '#eba53f');
  p.px(mx + 3, my + 3, INK).px(mx + 5, my + 3, INK);
  const gx = mx + (cols - 1) * cs + 1,
    gy = my + (rows - 1) * cs + 1;
  p.rect(gx, gy - 1, 6, 8, INK);
  p.rect(gx + 1, gy, 4, 5, '#7ee0ff');
  // coupon
  const cy0 = 136;
  for (let x = 6; x < w - 6; x += 3) {
    p.px(x, cy0, INK);
    p.px(x, cy0 + 19, INK);
  }
  for (let y = cy0; y < cy0 + 20; y += 3) {
    p.px(6, y, INK);
    p.px(w - 7, y, INK);
  }
  p.text('COUPON', 12, cy0 + 4, { font: FONT_TINY, color: f.c.text });
  p.text('1 FREE QR CODE', 12, cy0 + 11, { font: FONT_TINY, color: f.c.accent });
  p.star(w - 18, cy0 + 10, 7, 3, 5, f.c.accent);
  return p;
}

export function boxTop(f: Flavor, w = 112, d = 40): Painter {
  const p = new Painter(w, d);
  p.clear(f.c.bg);
  p.rect(0, Math.floor(d / 2), w, 1, shade(f.c.bg, -0.25));
  p.roundRect(w / 2 - 14, Math.floor(d / 2) - 5, 28, 10, 3, f.c.accent);
  p.text('OPEN', w / 2, Math.floor(d / 2) - 3, { font: FONT_TINY, color: INK, align: 'center' });
  p.text('CAPTAIN QR', 4, 3, { font: FONT_TINY, color: f.c.text });
  return p;
}

export function boxBottom(f: Flavor, w = 112, d = 40): Painter {
  const p = new Painter(w, d);
  p.clear(shade(f.c.bg, -0.15));
  p.text('BEST BEFORE: NEVER', w / 2, d / 2 - 2, { font: FONT_TINY, color: shade(f.c.text, -0.2), align: 'center' });
  return p;
}

/** Voxel figure of Captain QR (≈ 20×32×12 voxels). */
export function captainVoxels(): VoxelGrid {
  const g = new VoxelGrid(26, 34, 12);
  const waffle = '#eba53f';
  const dark = '#c77d22';
  const light = '#fbd27a';
  const ox = 7; // body left
  // legs + shoes
  g.box(ox + 3, 3, 5, ox + 3, 8, 5, INK);
  g.box(ox + 8, 3, 5, ox + 8, 8, 5, INK);
  g.box(ox + 1, 0, 4, ox + 4, 2, 8, '#e63950');
  g.box(ox + 7, 0, 4, ox + 10, 2, 8, '#e63950');
  g.box(ox + 1, 0, 8, ox + 4, 0, 8, '#ffffff');
  g.box(ox + 7, 0, 8, ox + 10, 0, 8, '#ffffff');
  // body 12x12x8
  g.box(ox, 9, 2, ox + 11, 20, 9, waffle);
  g.paint((x, y, z) => ((x - ox) % 3 === 0 || (y - 9) % 3 === 0) && z !== 9 ? dark : null);
  // face (front z=9)
  g.box(ox + 2, 11, 9, ox + 9, 18, 9, light);
  g.box(ox + 2, 15, 10, ox + 4, 17, 10, '#ffffff');
  g.box(ox + 7, 15, 10, ox + 9, 17, 10, '#ffffff');
  g.box(ox + 3, 15, 11, ox + 3, 16, 11, INK);
  g.box(ox + 8, 15, 11, ox + 8, 16, 11, INK);
  g.box(ox + 2, 13, 10, ox + 9, 13, 10, INK); // mustache
  g.set(ox + 1, 14, 10, INK).set(ox + 10, 14, 10, INK);
  g.box(ox + 4, 11, 10, ox + 7, 11, 10, '#7a1f2b'); // smile
  g.set(ox + 1, 12, 10, '#ff8fa3').set(ox + 10, 12, 10, '#ff8fa3');
  // hat
  g.box(ox - 1, 21, 1, ox + 12, 23, 10, '#23305e');
  g.box(ox, 24, 2, ox + 11, 27, 9, '#f4f6fb');
  g.box(ox - 1, 21, 10, ox + 12, 21, 11, '#141428'); // visor
  g.box(ox + 5, 22, 11, ox + 6, 23, 11, '#ffd23f'); // badge
  // arms: left salutes, right points
  g.box(ox - 1, 15, 5, ox - 1, 16, 6, INK);
  g.box(ox - 2, 16, 5, ox - 2, 19, 6, INK);
  g.box(ox - 4, 19, 4, ox - 1, 22, 7, '#ffffff'); // glove at hat
  g.box(ox + 12, 15, 5, ox + 15, 15, 6, INK);
  g.box(ox + 16, 14, 4, ox + 18, 17, 7, '#ffffff');
  g.box(ox + 19, 16, 5, ox + 21, 16, 6, '#ffffff'); // pointing finger
  return g;
}
