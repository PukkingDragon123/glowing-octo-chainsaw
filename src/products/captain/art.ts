import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { buddyPortrait, type BuddySpec, type Pose } from '../../art/buddy';
import { CAST } from '../../art/cast';
import type { Flavor } from '../types';

export const INK = '#1d1b26';

export const CAPTAIN_FLAVORS: Flavor[] = [
  { id: 'berry', name: 'Berry Blast', c: { bg: '#6f4ef2', grid: '#7d5ff5', arch: '#f7b8d9', archDark: '#eb9cc6', accent: '#ffd23f', text: '#ffffff', bowl: '#8fd3ff', piece: '#3a1d57', bit: '#8a4fd0' } },
  { id: 'cocoa', name: 'Cocoa Loco', c: { bg: '#8a5634', grid: '#976040', arch: '#f6dcb0', archDark: '#ebc996', accent: '#ff8b3d', text: '#fff6e0', bowl: '#ffcf9e', piece: '#3b2214', bit: '#6b3a20' } },
  { id: 'honey', name: 'Honey Hero', c: { bg: '#f4b62f', grid: '#f7c24a', arch: '#fff2c7', archDark: '#f8e29f', accent: '#e84a5f', text: '#ffffff', bowl: '#8fe3c8', piece: '#5a2d0c', bit: '#c77d22' } },
  { id: 'mint', name: 'Minty Mate', c: { bg: '#27b28b', grid: '#35be97', arch: '#d8f6ea', archDark: '#b9ecd8', accent: '#ff5d8f', text: '#ffffff', bowl: '#ffc2d9', piece: '#123f35', bit: '#1f7a60' } },
];

/**
 * Front art layout (texture pixels). The white card inside the window is where the link sticker is
 * glued on the unopened box (and where the poster composites the QR).
 */
export const FRONT = { w: 112, h: 160, cardX: 50, cardY: 60, cardSize: 56 };

export type CaptainPose = 'salute' | 'point' | 'cheer';

const POSES: Record<CaptainPose, Pose> = {
  salute: { armL: 2.75, armR: 0.55, mouth: 'grin' },
  point: { armL: 0.45, armR: 1.95, mouth: 'open' },
  cheer: { armL: 2.45, armR: 2.45, eyes: 'happy', mouth: 'open' },
};

/** A slightly smaller Captain for tight spots (store ads, standees) that used the old 60×64 sprite. */
const CAPTAIN_SMALL: BuddySpec = { ...CAST.captain, body: { ...CAST.captain.body, w: 34, h: 32 } };

const cache = new Map<string, HTMLCanvasElement>();
function portrait(spec: BuddySpec, pose: Pose, key: string) {
  let c = cache.get(key);
  if (!c) {
    c = buddyPortrait(spec, pose).toCanvas();
    cache.set(key, c);
  }
  return c;
}

/** Draw a canvas with its top-left at (x, y), optionally mirrored. */
function stamp(target: Painter, c: HTMLCanvasElement, x: number, y: number, flip = false) {
  const ctx = target.ctx;
  ctx.save();
  if (flip) {
    ctx.translate(Math.round(x) + c.width, Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(c, 0, 0);
  } else ctx.drawImage(c, Math.round(x), Math.round(y));
  ctx.restore();
}

/** The Captain buddy portrait for packaging. */
function captainPortrait(pose: CaptainPose = 'point') {
  return portrait(CAST.captain, POSES[pose], 'big-' + pose);
}

/**
 * Captain QR in a ~60×64 box, feet near the bottom (kept for the store ads and the cardboard
 * standee, which were drawn around the old sprite).
 */
export function drawCaptain(target: Painter, x: number, y: number, pose: CaptainPose = 'salute', flip = false) {
  const c = portrait(CAPTAIN_SMALL, POSES[pose], 'small-' + pose);
  stamp(target, c, x + 30 - c.width / 2, y + 62 - c.height, flip);
}

/** A little rounded cocoa square with a highlight (the cereal bits flying around the box). */
function cerealBit(p: Painter, x: number, y: number, s: number, color: string) {
  const L = new Painter(s + 2, s + 2);
  L.roundRect(1, 1, s, s, Math.max(1, s / 3), color);
  if (s >= 4) {
    L.rect(2, 2, Math.max(1, s - 3), 1, shade(color, 0.22));
    L.px(1 + Math.floor(s / 2), 1 + Math.floor(s / 2), shade(color, -0.18));
  }
  L.outline(INK);
  p.blit(L, x - 1, y - 1);
}

function sparkle(p: Painter, x: number, y: number, color = '#ffffff') {
  p.px(x, y - 2, color).px(x, y + 2, color).px(x - 2, y, color).px(x + 2, y, color);
  p.rect(x - 1, y - 1, 3, 3, color);
}

function logo(p: Painter, f: Flavor, cx: number, y: number) {
  p.text('CAPTAIN', cx, y, { font: FONT_BIG, scale: 2, bold: true, color: f.c.text, outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  const qy = y + 17;
  const w = p.textWidth('QR', { font: FONT_BIG, scale: 4, bold: true });
  p.text('QR', cx, qy, { font: FONT_BIG, scale: 4, bold: true, color: f.c.accent, outline: INK, outlineWidth: 2, shadow: INK, shadowOffset: [0, 3], align: 'center' });
  // a little face peeking out of the Q's counter
  const qx = Math.round(cx - w / 2);
  p.rect(qx + 8, qy + 4, 8, 12, '#ffffff');
  p.rect(qx + 9, qy + 8, 2, 3, INK).rect(qx + 13, qy + 8, 2, 3, INK);
  p.rect(qx + 11, qy + 12, 2, 1, INK);
}

/** Round "NEW" sticker with a scalloped edge. */
function newSticker(p: Painter, cx: number, cy: number, f: Flavor) {
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    p.disc(cx + Math.cos(a) * 8.5, cy + Math.sin(a) * 8.5, 3.2, INK);
  }
  p.disc(cx, cy, 10, INK);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    p.disc(cx + Math.cos(a) * 8.5, cy + Math.sin(a) * 8.5, 2.2, f.c.accent);
  }
  p.disc(cx, cy, 9, f.c.accent);
  p.text('NEW', cx + 0.5, cy - 2, { font: FONT_TINY, color: INK, align: 'center' });
}

/** Chain-link icon printed on the card (it shows once the link sticker comes off). */
function linkIcon(p: Painter, cx: number, cy: number, color: string) {
  const ring = (x: number, y: number) => {
    p.roundRect(x - 7, y - 4, 14, 8, 4, color);
    p.roundRect(x - 5, y - 2, 10, 4, 2, '#ffffff');
  };
  ring(cx - 4, cy + 2);
  ring(cx + 4, cy - 2);
  p.roundRect(cx - 1, cy - 4, 5, 3, 1, '#ffffff');
  p.rect(cx - 1, cy - 2, 5, 1, color);
}

/** Front of the cereal box: logo, pink arch window with the card, and Captain QR pointing at it. */
export function boxFront(f: Flavor): Painter {
  const { w, h, cardX, cardY, cardSize } = FRONT;
  const p = new Painter(w, h);
  p.clear(f.c.bg);
  p.grid(0, 0, w, h, 8, f.c.grid, 3);
  // soft dots at the grid crossings make the pattern read rounder
  for (let y = 3; y < h; y += 8) for (let x = 3; x < w; x += 8) p.disc(x + 0.5, y + 0.5, 1.2, f.c.grid);
  p.rect(0, 0, w, 1, shade(f.c.bg, 0.2));
  p.rect(0, h - 2, w, 2, shade(f.c.bg, -0.2));

  // arch window with a floor band and soft light rays
  const ax = 7;
  const ay = 50;
  const aw = 98;
  const ah = 104;
  const arch = new Painter(w, h);
  arch.ellipse(ax + aw / 2, ay + aw / 2, aw / 2, aw / 2, f.c.arch);
  arch.roundRect(ax, ay + aw / 2, aw, ah - aw / 2, 10, f.c.arch);
  arch.rect(ax, ay + aw / 2, aw, 10, f.c.arch);
  const floorY = ay + ah - 20;
  const clip = arch.clone();
  arch.rect(ax, floorY, aw, 20, f.c.archDark);
  for (let i = 0; i < 3; i++) arch.poly([[ax + 22 + i * 24, ay], [ax + 32 + i * 24, ay], [ax + 10 + i * 24, floorY], [ax + i * 24, floorY]], shade(f.c.arch, 0.05));
  // keep the rays inside the window shape
  arch.ctx.globalCompositeOperation = 'destination-in';
  arch.ctx.drawImage(clip.canvas, 0, 0);
  arch.ctx.globalCompositeOperation = 'source-over';
  arch.rect(ax + 8, floorY, aw - 16, 1, shade(f.c.archDark, 0.08));
  arch.outline(INK);
  p.blit(arch, 0, 0);

  // flying cocoa bits + a milk splash on the floor
  const bits: [number, number, number][] = [
    [26, 58, 5], [18, 72, 4], [40, 64, 3], [99, 124, 5], [90, 131, 4], [104, 142, 3],
  ];
  for (const [bx, by, s] of bits) cerealBit(p, bx, by, s, f.c.bit);
  p.ellipse(84, 146, 11, 3, '#ffffff');
  p.disc(76, 141, 2, '#ffffff');
  p.disc(92, 140, 1.5, '#ffffff');
  sparkle(p, 30, 88, '#ffffff');
  sparkle(p, 102, 116, '#ffffff');

  // the card: a white panel with a rounded frame and a soft drop shadow
  p.roundRect(cardX + 1, cardY + 1, cardSize + 4, cardSize + 4, 5, shade(f.c.arch, -0.14));
  p.roundRect(cardX - 2, cardY - 2, cardSize + 4, cardSize + 4, 5, INK);
  p.roundRect(cardX, cardY, cardSize, cardSize, 4, '#ffffff');
  p.rect(cardX + 3, cardY + cardSize - 4, cardSize - 6, 1, '#ece8f4');
  linkIcon(p, cardX + cardSize / 2, cardY + cardSize / 2 - 4, shade(f.c.bg, -0.05));
  p.text('SCAN ME', cardX + cardSize / 2, cardY + cardSize - 14, { font: FONT_TINY, color: shade(f.c.bg, -0.05), align: 'center' });

  // Captain QR stands in the window, pointing at the card
  const cap = captainPortrait('point');
  stamp(p, cap, -1, h - cap.height - 1);

  logo(p, f, w / 2, 5);
  newSticker(p, 97, 40, f);
  return p;
}

/** Side panel: logo, a short QR-trition table and a little Captain badge. */
export function boxSide(f: Flavor): Painter {
  const w = 40;
  const h = 160;
  const p = new Painter(w, h);
  p.clear(f.c.bg);
  p.grid(0, 0, w, h, 8, f.c.grid, 3);
  p.text('CAPTAIN', w / 2, 5, { font: FONT_TINY, color: f.c.text, outline: INK, align: 'center' });
  p.text('QR', w / 2, 13, { font: FONT_BIG, scale: 2, bold: true, color: f.c.accent, outline: INK, shadow: INK, shadowOffset: [0, 1], align: 'center' });
  const tx = 3;
  const ty = 36;
  const tw = w - 6;
  p.roundRect(tx - 1, ty - 1, tw + 2, 58, 4, INK);
  p.roundRect(tx, ty, tw, 56, 3, '#ffffff');
  p.text('QR-TRI-', tx + 3, ty + 3, { font: FONT_TINY, color: INK });
  p.text('TION', tx + 3, ty + 9, { font: FONT_TINY, color: INK });
  p.rect(tx + 2, ty + 15, tw - 4, 2, INK);
  const rows: [string, string][] = [
    ['SCANS', '1'],
    ['SUGAR', '0'],
    ['FUN', 'MAX'],
    ['YUM', '99'],
  ];
  rows.forEach(([k, v], i) => {
    const ry = ty + 19 + i * 9;
    p.text(k, tx + 3, ry, { font: FONT_TINY, color: INK });
    p.text(v, tx + tw - 3, ry, { font: FONT_TINY, color: INK, align: 'right' });
    if (i < rows.length - 1) p.rect(tx + 2, ry + 7, tw - 4, 1, '#e3dff0');
  });
  // round badge with a waving Captain
  p.disc(w / 2, 128, 17, INK);
  p.disc(w / 2, 128, 16, f.c.arch);
  const cap = portrait({ ...CAST.captain, body: { ...CAST.captain.body, w: 20, h: 19 }, limbs: { ...CAST.captain.limbs!, thick: 4, arm: 7, leg: 5 } }, { armL: 0.5, armR: 2.5, noLegs: true }, 'badge');
  stamp(p, cap, w / 2 - cap.width / 2, 145 - cap.height);
  p.rect(w / 2 - 15, 145, 30, 1, INK);
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
  const cols = 11;
  const rows = 12;
  const cs = 8;
  const mx = Math.floor((w - cols * cs) / 2);
  const my = 32;
  p.roundRect(mx - 4, my - 4, cols * cs + 9, rows * cs + 9, 5, INK);
  p.roundRect(mx - 3, my - 3, cols * cs + 7, rows * cs + 7, 4, '#fffdf5');
  const visited = new Uint8Array(cols * rows);
  const right = new Uint8Array(cols * rows).fill(1);
  const down = new Uint8Array(cols * rows).fill(1);
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stack = [0];
  visited[0] = 1;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const cx = cur % cols;
    const cy = Math.floor(cur / cols);
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
      const x0 = mx + cx * cs;
      const y0 = my + cy * cs;
      if (right[i] && cx < cols - 1) p.rect(x0 + cs, y0, 1, cs + 1, f.c.bg);
      if (down[i] && cy < rows - 1) p.rect(x0, y0 + cs, cs + 1, 1, f.c.bg);
    }
  p.strokeRect(mx - 1, my - 1, cols * cs + 3, rows * cs + 3, f.c.bg);
  // start: a tiny Captain face; goal: a phone
  p.disc(mx + 4, my + 4, 3, '#a0633a');
  p.rect(mx + 1, my, 7, 2, '#ffffff');
  p.px(mx + 3, my + 4, INK).px(mx + 5, my + 4, INK);
  const gx = mx + (cols - 1) * cs + 1;
  const gy = my + (rows - 1) * cs + 1;
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
  p.roundRect(w / 2 - 14, Math.floor(d / 2) - 5, 28, 10, 4, f.c.accent);
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

/** Tiny 28×40 front for the shelf model: drawn at roughly 1:1 with its on-screen size. */
export function boxFrontSmall(f: Flavor): Painter {
  const p = new Painter(28, 40);
  p.clear(f.c.bg);
  p.grid(0, 0, 28, 40, 4, f.c.grid, 1);
  p.text('CAPTAIN', 14, 1, { font: FONT_TINY, color: f.c.text, align: 'center' });
  p.text('QR', 14, 7, { font: FONT_BIG, color: f.c.accent, outline: INK, align: 'center' });
  const arch = new Painter(28, 40);
  arch.arch(2, 17, 24, 22, f.c.arch);
  arch.rect(2, 35, 24, 4, f.c.archDark);
  arch.outline(INK);
  p.blit(arch, 0, 0);
  // the white card
  p.roundRect(13, 20, 12, 12, 2, INK).roundRect(14, 21, 10, 10, 2, '#ffffff');
  p.rect(16, 25, 6, 2, shade(f.c.bg, -0.05));
  // Captain: round cocoa head, sailor hat, dot eyes and a grin
  p.disc(8, 31.5, 5.5, INK).disc(8, 31.5, 4.5, '#a0633a');
  p.px(6, 33, '#ffd460').px(10, 33, '#ffd460');
  p.px(6, 31, INK).px(10, 31, INK);
  p.rect(7, 33, 3, 2, '#fff3d4').px(8, 34, '#f6c945');
  p.rect(3, 25, 11, 3, INK).rect(4, 25, 9, 2, '#ffffff').rect(4, 27, 9, 1, '#23305e').px(8, 25, '#f6c945');
  p.px(24, 38, '#ffffff').px(21, 38, '#ffffff').px(18, 38, '#ffffff');
  return p;
}

export function boxSideSmall(f: Flavor): Painter {
  const p = new Painter(10, 40);
  p.clear(f.c.bg);
  p.grid(0, 0, 10, 40, 4, f.c.grid, 1);
  p.rect(1, 10, 8, 18, '#ffffff');
  for (let y = 12; y < 27; y += 2) p.rect(2, y, 6, 1, '#b8b4c8');
  p.disc(5, 33, 3, INK).disc(5, 33, 2, '#a0633a');
  return p;
}
