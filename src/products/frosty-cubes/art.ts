import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { rng } from '../../engine/tween';
import { VoxelGrid } from '../../engine/voxel';
import type { Flavor } from '../types';

export const INK = '#1d1b26';

/** Ice colours: `fun` is the icy highlight tone (the texture darkens the core), `scan` is the scan-safe tone. */
export interface IceColor {
  fun: string;
  scan: string;
}

export const ICE_SETS: Record<string, IceColor[]> = {
  classic: [
    { fun: '#5d72db', scan: '#141a4a' },
    { fun: '#4b5fc8', scan: '#11164a' },
    { fun: '#6f82e6', scan: '#171d55' },
  ],
  blueraz: [
    { fun: '#3f86ff', scan: '#0e2066' },
    { fun: '#2f6cf0', scan: '#0b1b5c' },
    { fun: '#62a0ff', scan: '#10256e' },
  ],
  cola: [
    { fun: '#b0703f', scan: '#2e170b' },
    { fun: '#96592f', scan: '#27130a' },
    { fun: '#c4834a', scan: '#33190c' },
  ],
  grape: [
    { fun: '#a066e0', scan: '#2a1042' },
    { fun: '#8a4fd0', scan: '#240d3c' },
    { fun: '#b47ff0', scan: '#2f1348' },
  ],
};

export const FROSTY_FLAVORS: Flavor[] = [
  { id: 'classic', name: 'Blueberry Ice', c: { band: '#2f6fd8', bandDark: '#1f4fa8', accent: '#ffd23f', tint: '#cfe8ff', scarf: '#ff5d73' } },
  { id: 'blueraz', name: 'Blue Raspberry', c: { band: '#1f9bf0', bandDark: '#1470b8', accent: '#ff7ac0', tint: '#cdeeff', scarf: '#ffd23f' } },
  { id: 'cola', name: 'Cola Ice', c: { band: '#c0392b', bandDark: '#8e2418', accent: '#ffd23f', tint: '#ffe9d6', scarf: '#2f6fd8' } },
  { id: 'grape', name: 'Grape Soda', c: { band: '#7b3fc8', bandDark: '#582a96', accent: '#7ee0a0', tint: '#eadcff', scarf: '#ffd23f' } },
];

export function iceSet(f: Flavor) {
  return ICE_SETS[f.id] ?? ICE_SETS.classic;
}

export const BAG = { w: 96, h: 128 };

/** Pixel penguin mascot (~26×30 px). */
export function drawPenguin(p: Painter, x: number, y: number, f: Flavor, wave = true) {
  const L = new Painter(30, 32);
  const body = '#26315e';
  // flippers
  if (wave) {
    L.poly([[4, 16], [0, 8], [3, 7], [8, 14]], body);
  } else L.poly([[4, 14], [1, 24], [5, 23], [8, 16]], body);
  L.poly([[24, 14], [28, 22], [25, 24], [21, 17]], body);
  // body + belly
  L.ellipse(15, 18, 10, 12.5, body);
  L.ellipse(15, 21, 7, 9, '#ffffff');
  L.ellipse(15, 11, 7.5, 6, '#ffffff');
  L.rect(8, 5, 14, 3, body);
  // eyes, cheeks, beak
  L.rect(11, 9, 2, 3, INK).px(11, 9, '#ffffff');
  L.rect(18, 9, 2, 3, INK).px(18, 9, '#ffffff');
  L.px(9, 13, '#ff9fb5').px(10, 13, '#ff9fb5').px(20, 13, '#ff9fb5').px(21, 13, '#ff9fb5');
  L.poly([[13, 13], [18, 13], [15.5, 16]], '#ff9f1c');
  // scarf
  L.rect(8, 17, 15, 3, f.c.scarf);
  L.rect(19, 19, 3, 6, f.c.scarf);
  L.px(9, 18, shade(f.c.scarf, 0.2)).px(12, 18, shade(f.c.scarf, 0.2)).px(15, 18, shade(f.c.scarf, 0.2));
  // feet
  L.ellipse(11, 30, 3.5, 1.6, '#ff9f1c');
  L.ellipse(19, 30, 3.5, 1.6, '#ff9f1c');
  L.outline(INK);
  p.blit(L, x - 1, y - 1);
}

function snowflake(p: Painter, x: number, y: number, c: string) {
  p.px(x, y, c).px(x - 1, y, c).px(x + 1, y, c).px(x, y - 1, c).px(x, y + 1, c);
  p.px(x - 2, y - 2, c).px(x + 2, y - 2, c).px(x - 2, y + 2, c).px(x + 2, y + 2, c);
}

/** Ice cube sprite for printed art. */
export function drawCube(p: Painter, x: number, y: number, s: number, col: string) {
  p.rect(x - 1, y - 1, s + 2, s + 2, INK);
  p.rect(x, y, s, s, shade(col, -0.18));
  p.rect(x, y, s, 1, shade(col, 0.25)).rect(x, y, 1, s, shade(col, 0.25));
  p.px(x + 1, y + 1, '#ffffff');
}

/** Front of the clear ice bag. `withCubes` paints the ice visible through the film (opaque shelf version). */
export function bagFront(f: Flavor, withCubes = false): Painter {
  const { w, h } = BAG;
  const p = new Painter(w, h);
  const set = iceSet(f);
  // clear film with a frosted edge
  p.rect(0, 0, w, h, withCubes ? '#e8f5ff' : 'rgba(215,236,255,0.05)');
  if (withCubes) {
    const r = rng(8);
    for (let i = 0; i < 70; i++) drawCube(p, 4 + Math.floor(r() * (w - 14)), 36 + Math.floor(r() * 64), 7 + Math.floor(r() * 3), set[Math.floor(r() * set.length)].fun);
  }
  const frost = new Painter(w, h);
  frost.dither(0, 0, w, h, 'rgba(255,255,255,0.6)', 0.3);
  frost.ctx.globalCompositeOperation = 'destination-out';
  frost.roundRect(7, 7, w - 14, h - 14, 16, '#000');
  frost.ctx.globalCompositeOperation = 'source-over';
  frost.dither(12, 40, w - 24, 60, 'rgba(255,255,255,0.35)', 0.06);
  p.blit(frost, 0, 0);
  // sealed side seams
  p.rect(0, 0, 2, h, 'rgba(235,246,255,0.75)').rect(w - 2, 0, 2, h, 'rgba(235,246,255,0.75)');
  // shine
  for (let i = 0; i < 60; i++) p.rect(8 + i * 0.25, 38 + i, 2, 1, 'rgba(255,255,255,0.5)');
  for (let i = 0; i < 30; i++) p.rect(14 + i * 0.25, 52 + i, 1, 1, 'rgba(255,255,255,0.45)');
  // header band with logo
  p.rect(0, 0, w, 33, f.c.band);
  p.rect(0, 33, w, 2, f.c.bandDark);
  for (let x = 0; x < w; x += 8) p.poly([[x, 35], [x + 4, 39], [x + 8, 35]], f.c.bandDark);
  for (let x = 0; x < w; x += 8) p.poly([[x, 33], [x + 4, 37], [x + 8, 33]], f.c.band);
  snowflake(p, 8, 7, 'rgba(255,255,255,0.6)');
  snowflake(p, 88, 25, 'rgba(255,255,255,0.6)');
  p.text('FROSTY', w / 2, 3, { font: FONT_BIG, scale: 2, bold: true, color: '#ffffff', outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  p.text('CUBES', w / 2 - 8, 19, { font: FONT_BIG, bold: true, color: f.c.accent, outline: INK, shadow: INK, align: 'center' });
  // printed snowflakes on the clear window
  for (const [sx, sy] of [[74, 46], [20, 70], [82, 86], [44, 58]] as const) snowflake(p, sx, sy, '#ffffff');
  // 2kg burst
  p.burst(78, 22, 12, 12, INK);
  p.burst(78, 22, 11, 12, f.c.accent);
  p.text('2KG', 78, 18, { font: FONT_BIG, bold: true, color: INK, align: 'center' });
  // bottom band + flavour
  p.rect(0, h - 22, w, 22, f.c.band);
  p.rect(0, h - 23, w, 1, f.c.bandDark);
  p.text(f.name.toUpperCase(), w / 2 + 12, h - 17, { font: FONT_TINY, color: '#ffffff', outline: INK, align: 'center' });
  p.roundRect(40, h - 10, 50, 7, 2, '#ffffff');
  p.text('PURE ICE', 65, h - 9, { font: FONT_TINY, color: f.c.bandDark, align: 'center' });
  // mascot waving from the corner
  drawPenguin(p, 2, h - 40, f);
  return p;
}

export function bagBack(f: Flavor): Painter {
  const { w, h } = BAG;
  const p = new Painter(w, h);
  p.rect(0, 0, w, h, 'rgba(215,236,255,0.13)');
  p.dither(0, 0, w, h, 'rgba(255,255,255,0.5)', 0.1);
  p.rect(0, 0, w, 20, f.c.band);
  p.text('KEEP', w / 2, 3, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  p.text('FROZEN -18°', w / 2, 10, { font: FONT_TINY, color: f.c.accent, align: 'center' });
  // facts table
  p.rect(18, 56, 60, 40, INK);
  p.rect(19, 57, 58, 38, '#ffffff');
  p.text('ICE-TRITION', w / 2, 59, { font: FONT_TINY, color: INK, align: 'center' });
  p.rect(20, 65, 56, 1, INK);
  [['CUBES', 'MANY'], ['CHILL', '100%'], ['KCAL', '0'], ['QR', '1']].forEach(([k, v], i) => {
    p.text(k, 21, 67 + i * 7, { font: FONT_TINY, color: INK });
    p.text(v, 75, 67 + i * 7, { font: FONT_TINY, color: INK, align: 'right' });
  });
  p.rect(26, 104, 44, 14, '#ffffff');
  for (let x = 0; x < 40; x++) if ((x * 5) % 7 < 4) p.rect(28 + x, 106, 1, 9, INK);
  return p;
}

export function bagSide(f: Flavor, withCubes = false): Painter {
  const p = new Painter(16, BAG.h);
  p.rect(0, 0, 16, BAG.h, withCubes ? '#dbeeff' : 'rgba(225,242,255,0.3)');
  if (!withCubes) p.dither(0, 0, 16, BAG.h, 'rgba(255,255,255,0.6)', 0.25);
  p.rect(0, 0, 16, 20, f.c.band);
  p.rect(0, BAG.h - 22, 16, 22, f.c.band);
  return p;
}

/** Heat-seal crimp with saw teeth (transparent between teeth) and a "tear here" notch line. */
export function crimpStrip(top: boolean): Painter {
  const w = BAG.w;
  const h = 10;
  const p = new Painter(w, h);
  const c = '#e3f2ff';
  p.rect(0, top ? 3 : 0, w, 7, c);
  for (let x = 0; x < w; x += 4) {
    if (top) p.poly([[x, 3], [x + 2, 0], [x + 4, 3]], c);
    else p.poly([[x, 7], [x + 2, 10], [x + 4, 7]], c);
  }
  for (let x = 1; x < w; x += 2) p.rect(x, top ? 4 : 1, 1, 5, '#c7e2f7');
  if (top) for (let x = 0; x < w; x += 3) p.px(x, 9, '#6aa9e0');
  return p;
}

/** Tiling frost for the tray: stays very light so the code background reads as white. */
export function frostTile(): Painter {
  const S = 32;
  const p = new Painter(S, S);
  p.clear('#f5faff');
  const r = rng(31);
  for (let i = 0; i < 26; i++) p.px(Math.floor(r() * S), Math.floor(r() * S), '#e6f1fb');
  for (let i = 0; i < 5; i++) {
    const x = 3 + Math.floor(r() * (S - 6));
    const y = 3 + Math.floor(r() * (S - 6));
    const c = '#e2eef9';
    p.px(x, y, c).px(x - 1, y, c).px(x + 1, y, c).px(x, y - 1, c).px(x, y + 1, c);
  }
  for (let i = 0; i < 10; i++) p.px(Math.floor(r() * S), Math.floor(r() * S), '#ffffff');
  return p;
}

/** Face tile for ice-cube instances (multiplied by the instance colour): bright rim, deep core, glint. */
export function iceTile(): Painter {
  const S = 8;
  const p = new Painter(S, S);
  p.clear('#9c9cab');
  p.rect(1, 1, S - 2, S - 2, '#90909f');
  p.rect(2, 2, 3, 2, '#aaaab8');
  p.rect(0, 0, S, 1, '#ffffff').rect(0, 0, 1, S, '#ffffff');
  p.rect(0, S - 1, S, 1, '#b4b4c0').rect(S - 1, 0, 1, S, '#b4b4c0');
  p.px(1, 1, '#ffffff').px(2, 1, '#ffffff').px(1, 2, '#ffffff');
  p.px(5, 5, '#a2a2ae');
  return p;
}

/** Penguin figure (≈ 16×22×14 voxels) in a scarf, cheering. */
export function penguinVoxels(f: Flavor): VoxelGrid {
  const g = new VoxelGrid(20, 24, 16);
  const body = '#26315e';
  const cx = 10;
  // feet
  g.box(cx - 5, 0, 8, cx - 2, 1, 13, '#ff9f1c');
  g.box(cx + 1, 0, 8, cx + 4, 1, 13, '#ff9f1c');
  // body
  g.ellipsoid(cx, 9, 8, 7, 8.5, 6.5, body);
  g.ellipsoid(cx, 8.5, 10.5, 5, 6.5, 4.5, '#ffffff');
  // head
  g.ellipsoid(cx, 17.5, 8, 6, 5.5, 5.5, body);
  g.ellipsoid(cx, 17, 10.3, 4.5, 4, 3.2, '#ffffff');
  // eyes + cheeks + beak
  g.box(cx - 3, 17, 13, cx - 2, 18, 13, INK);
  g.box(cx + 2, 17, 13, cx + 3, 18, 13, INK);
  g.set(cx - 3, 18, 13, '#ffffff').set(cx + 2, 18, 13, '#ffffff');
  g.box(cx - 5, 15, 12, cx - 4, 15, 12, '#ff9fb5');
  g.box(cx + 4, 15, 12, cx + 5, 15, 12, '#ff9fb5');
  g.box(cx - 1, 15, 13, cx + 1, 16, 15, '#ff9f1c');
  // scarf
  g.box(cx - 6, 12, 3, cx + 6, 13, 13, f.c.scarf);
  g.paint((x, y, z) => (y >= 12 && y <= 13 && (x + z) % 3 === 0 && x > cx - 7 && x < cx + 7 ? shade(f.c.scarf, 0.2) : null));
  g.box(cx + 3, 7, 13, cx + 5, 11, 13, f.c.scarf);
  // flippers up (cheering)
  g.box(cx - 9, 10, 7, cx - 7, 16, 9, body);
  g.box(cx + 7, 10, 7, cx + 9, 16, 9, body);
  // bobble hat
  g.box(cx - 5, 22, 5, cx + 5, 23, 11, f.c.band);
  g.box(cx - 1, 23, 7, cx + 1, 23, 9, '#ffffff');
  return g;
}

// -------------------------------------------------------------------------------------------------
// Poster

export const POSTER = { w: 144, h: 176, codeX: 36, codeY: 52, codeSize: 72 };

/** Poster: a frosty tray seen from above, the bag and the penguin cheering. Code region reserved. */
export function posterArt(f: Flavor): Painter {
  const { w, h } = POSTER;
  const p = new Painter(w, h);
  p.clear('#bfe6ff');
  p.gradientV(0, 0, w, h, '#d7f0ff', '#8fd0ff', 5);
  const r = rng(44);
  for (let i = 0; i < 26; i++) snowflake(p, 3 + Math.floor(r() * (w - 6)), 3 + Math.floor(r() * (h - 6)), 'rgba(255,255,255,0.8)');
  // logo
  p.text('FROSTY', w / 2, 5, { font: FONT_BIG, scale: 2, bold: true, color: '#ffffff', outline: INK, shadow: f.c.bandDark, shadowOffset: [0, 2], align: 'center' });
  p.text('CUBES', w / 2, 23, { font: FONT_BIG, scale: 2, bold: true, color: f.c.accent, outline: INK, shadow: f.c.bandDark, shadowOffset: [0, 2], align: 'center' });
  // tray (frosty white) under the code region
  const { codeX, codeY, codeSize } = POSTER;
  p.roundRect(codeX - 7, codeY - 7, codeSize + 14, codeSize + 14, 5, INK);
  p.roundRect(codeX - 6, codeY - 6, codeSize + 12, codeSize + 12, 4, '#d9eefc');
  p.rect(codeX - 3, codeY - 3, codeSize + 6, codeSize + 6, '#f5faff');
  // spare cubes scattered around the tray
  const set = iceSet(f);
  for (const [cx, cy] of [[20, 132], [28, 138], [120, 60], [126, 70], [116, 140]] as const) drawCube(p, cx, cy, 7, set[Math.floor(r() * set.length)].fun);
  // penguin
  drawPenguin(p, 106, 126, f);
  // badge
  p.burst(16, 46, 12, 12, INK);
  p.burst(16, 46, 11, 12, f.c.accent);
  p.text('2KG', 16, 43, { font: FONT_BIG, bold: true, color: INK, align: 'center' });
  // flavour ribbon
  p.rect(0, h - 16, w, 16, f.c.band);
  p.rect(0, h - 16, w, 1, INK);
  p.text(f.name.toUpperCase(), 6, h - 12, { font: FONT_BIG, bold: true, color: '#ffffff', outline: INK });
  p.text('90 QB', w - 6, h - 11, { font: FONT_TINY, color: f.c.accent, align: 'right' });
  return p;
}
