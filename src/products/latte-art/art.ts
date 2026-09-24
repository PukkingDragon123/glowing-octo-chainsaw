import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { rng } from '../../engine/tween';
import { VoxelGrid } from '../../engine/voxel';
import type { Flavor } from '../types';

export const INK = '#1d1b26';
/** Scan-safe cocoa: very dark so it stays dark under the showroom lights. */
export const COCOA_SCAN = '#2b180d';
export const FOAM_SCAN = '#fff9ef';

export const LATTE_FLAVORS: Flavor[] = [
  { id: 'latte', name: 'Latte', c: { cup: '#c98b55', cupDark: '#9a633a', cupLight: '#e8b27e', foam: '#fcf3e3', crema: '#dcae78', cremaDark: '#b97c45', drink: '#5a2e18', cocoa: '#5a3420', cocoa2: '#6e4128', accent: '#ff8fa3', board: '#3d4a42' } },
  { id: 'matcha', name: 'Matcha Latte', c: { cup: '#7cb342', cupDark: '#557f2a', cupLight: '#a6d46b', foam: '#f3f6e2', crema: '#b3d27a', cremaDark: '#86ad48', drink: '#5f8f2c', cocoa: '#4e3220', cocoa2: '#633f28', accent: '#ffb3c6', board: '#34453b' } },
  { id: 'chayen', name: 'Cha Yen', c: { cup: '#f28c28', cupDark: '#c4650f', cupLight: '#ffb35c', foam: '#fff2dd', crema: '#f7b066', cremaDark: '#e07b22', drink: '#d8631b', cocoa: '#553018', cocoa2: '#6b3d20', accent: '#fff08a', board: '#3a3f4f' } },
  { id: 'mocha', name: 'Mocha', c: { cup: '#7a5244', cupDark: '#553428', cupLight: '#a3786a', foam: '#f8ecd9', crema: '#b88763', cremaDark: '#8a5a3c', drink: '#3b1f14', cocoa: '#3f2214', cocoa2: '#51301d', accent: '#ffcf5c', board: '#40393a' } },
];

/** Cup dimensions (world units, before any scaling). */
export const CUP = { rTop: 1.02, rBottom: 0.72, h: 0.86, wall: 0.08, foot: 0.035 };

/** Outer wall wrap-around art. Centre column faces the viewer; u = 0.75 is where the handle sits. */
export function cupArt(f: Flavor, mood: 'smile' | 'happy'): Painter {
  const w = 200;
  const h = 48;
  const p = new Painter(w, h);
  p.clear(f.c.cup);
  p.rect(0, h - 8, w, 8, f.c.cupDark);
  p.rect(0, h - 9, w, 1, shade(f.c.cupDark, -0.08));
  // glaze drips from the rim
  const glaze = '#fff6ea';
  p.rect(0, 0, w, 6, glaze);
  const r = rng(4);
  for (let x = 0; x < w; x += 7 + Math.floor(r() * 6)) {
    const len = 2 + Math.floor(r() * 6);
    p.rect(x, 6, 3, len, glaze);
    p.rect(x + 1, 6 + len, 1, 1, glaze);
    p.px(x + 2, 6, shade(glaze, -0.06));
  }
  p.rect(0, 6, w, 1, 'rgba(255,255,255,0.4)');
  // little hearts + beans around the back
  const heart = (x: number, y: number, c: string) => {
    p.sprite(['.#.#.', '#####', '#####', '.###.', '..#..'], x, y, { '#': c });
  };
  const bean = (x: number, y: number) => {
    p.ellipse(x, y, 3, 2, '#5a3420');
    p.px(x - 1, y - 1, '#7a4a2c').rect(x - 1, y, 3, 1, '#3a2214');
  };
  heart(20, 22, f.c.accent);
  bean(36, 30);
  heart(160, 16, f.c.accent);
  bean(176, 24);
  p.text('LATTE', 50, 18, { font: FONT_TINY, color: glaze, outline: f.c.cupDark });
  p.text('CODE', 128, 30, { font: FONT_TINY, color: glaze, outline: f.c.cupDark });
  // kawaii face at the front
  const cx = w / 2;
  const ey = 22;
  p.ellipse(cx - 17, ey + 7, 4, 2, 'rgba(255,130,160,0.8)');
  p.ellipse(cx + 17, ey + 7, 4, 2, 'rgba(255,130,160,0.8)');
  if (mood === 'smile') {
    for (const ex of [cx - 10, cx + 10]) {
      p.sprite(['.###.', '#####', '#####', '#####', '.###.'], ex - 2, ey - 2, { '#': INK });
      p.rect(ex - 1, ey - 1, 2, 2, '#ffffff');
    }
  } else {
    for (const ex of [cx - 10, cx + 10]) p.sprite(['.###.', '#...#', '#...#'], ex - 2, ey - 1, { '#': INK });
  }
  p.sprite(['#...#', '.###.'], cx - 2, ey + 5, { '#': '#7a1f2b' });
  if (mood === 'happy') p.rect(cx - 1, ey + 6, 3, 1, '#ff8fa3');
  return p;
}

/** Foam disc art: microfoam, a crema ring and a few bubbles. `scan` gives a plain, bright version. */
export function foamArt(f: Flavor, scan = false): Painter {
  const S = 128;
  const p = new Painter(S, S);
  const c = S / 2;
  p.clear(scan ? FOAM_SCAN : f.c.cremaDark);
  if (scan) return p;
  p.disc(c, c, c - 1, f.c.crema);
  p.disc(c, c, c - 6, shade(f.c.crema, 0.1));
  p.disc(c, c, c - 9, f.c.foam);
  const r = rng(12);
  for (let i = 0; i < 160; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * (c - 11);
    p.px(c + Math.cos(a) * d, c + Math.sin(a) * d, shade(f.c.foam, -0.035));
  }
  for (let i = 0; i < 24; i++) {
    const a = r() * Math.PI * 2;
    const d = c - 10 + r() * 5;
    p.ring(c + Math.cos(a) * d, c + Math.sin(a) * d, 1.6, shade(f.c.foam, -0.08), 1);
  }
  return p;
}

/** Chalkboard menu sign: logo, mascot, flavour, price, badges. */
export function signArt(f: Flavor): Painter {
  const w = 64;
  const h = 80;
  const p = new Painter(w, h);
  p.clear('#a8743d');
  p.rect(2, 2, w - 4, h - 4, f.c.board);
  p.dither(2, 2, w - 4, h - 4, shade(f.c.board, 0.05), 0.25);
  p.rect(0, 0, w, 1, '#d19a5c').rect(0, 0, 1, h, '#d19a5c');
  p.text('LATTE', w / 2, 5, { font: FONT_BIG, bold: true, color: '#fff6ea', align: 'center' });
  p.text('CODE', w / 2, 14, { font: FONT_BIG, bold: true, color: f.c.accent, align: 'center' });
  // chalk cup mascot
  const cx = w / 2;
  const cy = 38;
  p.roundRect(cx - 10, cy - 6, 20, 15, 4, '#fff6ea');
  p.rect(cx - 9, cy - 5, 18, 3, f.c.cup);
  p.ring(cx + 11, cy + 1, 4, '#fff6ea', 2);
  p.px(cx - 4, cy + 1, INK).px(cx + 4, cy + 1, INK).rect(cx - 1, cy + 4, 3, 1, INK);
  p.px(cx - 6, cy + 3, '#ff8fa3').px(cx + 6, cy + 3, '#ff8fa3');
  for (let i = 0; i < 3; i++) p.line(cx - 5 + i * 5, cy - 9, cx - 3 + i * 5, cy - 13, '#d8d2c4');
  // flavour + price
  const name = f.name.toUpperCase();
  p.text(name, w / 2, 52, { font: FONT_TINY, color: '#fff6ea', align: 'center' });
  p.rect(10, 59, w - 20, 1, '#d8d2c4');
  p.text('60 QB', w / 2 - 11, 62, { font: FONT_BIG, color: '#ffd23f', align: 'center' });
  p.text('350ML', w / 2 + 18, 64, { font: FONT_TINY, color: '#d8d2c4', align: 'center' });
  p.burst(w - 11, 30, 7, 10, '#ff5d73');
  p.text('HOT', w - 11, 28, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  p.text('ART INSIDE', w / 2, 72, { font: FONT_TINY, color: '#bfe3d0', align: 'center' });
  return p;
}

export function signSide(): Painter {
  return new Painter(8, 80).clear('#8f6030');
}

/** Stainless milk jug (≈ 16×16×13 voxels): tapered body, pointed spout on +X, loop handle on -X. */
export function pitcherVoxels(): VoxelGrid {
  const g = new VoxelGrid(19, 17, 13);
  const steel = '#cfd8e3';
  const dark = '#a3afc0';
  const light = '#f1f5fa';
  const cx = 8;
  const cz = 6;
  for (let y = 0; y <= 14; y++) {
    const r = 5.9 - y * 0.09;
    g.cylinder(cx, cz, y, y, r, steel, r);
    if (y >= 1) g.cylinder(cx, cz, y, y, r - 1, null, r - 1);
  }
  g.cylinder(cx, cz, 15, 15, 5.2, steel, 5.2);
  g.cylinder(cx, cz, 15, 15, 4.2, null, 4.2);
  // milk inside
  g.cylinder(cx, cz, 11, 12, 4.6, '#fffaf0', 4.6);
  // shading: bright on the right, darker on the left, a pressed band
  g.paint((x, y) => {
    if (y === 3 || y === 4) return x > cx + 2 ? '#dfe6ee' : '#b8c4d4';
    if (x >= cx + 3) return light;
    if (x <= cx - 4) return dark;
    return null;
  });
  // pointed spout
  g.box(cx + 5, 12, cz - 2, cx + 6, 15, cz + 2, steel);
  g.box(cx + 7, 14, cz - 1, cx + 8, 15, cz + 1, light);
  g.box(cx + 9, 15, cz, cx + 9, 15, cz, light);
  g.box(cx + 5, 13, cz - 1, cx + 8, 15, cz + 1, null);
  g.box(cx + 5, 13, cz, cx + 9, 14, cz, null);
  // loop handle
  g.box(cx - 8, 4, cz - 1, cx - 8, 12, cz + 1, dark);
  g.box(cx - 7, 12, cz - 1, cx - 6, 13, cz + 1, dark);
  g.box(cx - 7, 4, cz - 1, cx - 6, 4, cz + 1, dark);
  return g;
}

/** Cocoa shaker with a flavour label and a holey lid. Lid on top (+Y). */
export function shakerVoxels(f: Flavor): VoxelGrid {
  const g = new VoxelGrid(11, 16, 11);
  g.cylinder(5, 5, 0, 11, 4.4, f.c.cup, 4.4);
  g.cylinder(5, 5, 4, 8, 4.5, '#fff6ea', 4.5);
  g.cylinder(5, 5, 12, 14, 4.6, '#dfe6ee', 4.6);
  g.cylinder(5, 5, 15, 15, 3.4, '#dfe6ee', 3.4);
  g.set(4, 15, 4, INK).set(6, 15, 6, INK).set(4, 15, 6, INK).set(6, 15, 4, INK).set(5, 15, 5, INK);
  // label heart
  g.box(4, 6, 10, 6, 6, 10, '#ff8fa3');
  g.set(4, 7, 10, '#ff8fa3').set(6, 7, 10, '#ff8fa3').set(5, 5, 10, '#ff8fa3');
  return g;
}

/** Butter cookie with chocolate chips. */
export function cookieVoxels(): VoxelGrid {
  const g = new VoxelGrid(9, 2, 9);
  g.cylinder(4.5, 4.5, 0, 1, 4.3, '#e8b86a', 4.3);
  g.paint((x, y, z) => (y === 1 && (x * 7 + z * 3) % 11 === 0 ? '#5a3420' : y === 1 && (x + z) % 5 === 0 ? '#f4cf8a' : null));
  return g;
}

export function spoonVoxels(): VoxelGrid {
  const g = new VoxelGrid(16, 2, 5);
  g.box(0, 0, 2, 10, 0, 2, '#cfd8e3');
  g.ellipsoid(13, 0.8, 2.5, 2.6, 1.2, 2.2, '#dfe6ee');
  g.set(0, 0, 2, '#9aa7b8');
  return g;
}

// -------------------------------------------------------------------------------------------------
// Poster

export const POSTER = { w: 144, h: 180, codeX: 44, codeY: 72, codeSize: 56 };

/** Top-down café table: saucer, cup, foam; the code region sits in the middle of the foam. */
export function posterArt(f: Flavor): Painter {
  const { w, h } = POSTER;
  const p = new Painter(w, h);
  // wooden table
  p.clear('#c98f55');
  for (let y = 0; y < h; y += 12) {
    p.rect(0, y, w, 1, '#a8703d');
    p.rect(0, y + 5, w, 1, '#d69d62');
  }
  // gingham napkin corner
  for (let y = 132; y < h; y += 4)
    for (let x = 0; x < 44 - (y - 132) * 0.2; x += 4) p.rect(x, y, 4, 4, ((x + y) / 4) % 2 ? '#ffffff' : '#ff8fa3');
  // coffee beans
  const bean = (x: number, y: number) => {
    p.ellipse(x, y, 3.5, 2.5, INK);
    p.ellipse(x, y, 2.5, 1.6, '#5a3420');
    p.rect(x - 2, y, 4, 1, '#2e1a0e');
  };
  [[12, 40], [20, 46], [128, 150], [120, 158], [132, 166], [10, 110]].forEach(([x, y]) => bean(x, y));
  // logo
  p.roundRect(8, 4, w - 16, 26, 6, INK);
  p.roundRect(9, 5, w - 18, 24, 5, f.c.cup);
  p.text('LATTE', w / 2 - 20, 9, { font: FONT_BIG, scale: 2, bold: true, color: '#fff6ea', outline: INK, align: 'center' });
  p.text('CODE', w / 2 + 34, 12, { font: FONT_BIG, bold: true, color: f.c.accent, outline: INK, align: 'center' });
  p.text('ART', w / 2 + 34, 20, { font: FONT_TINY, color: '#fff6ea', align: 'center' });
  // saucer + cup from above
  const cx = 72;
  const cy = 100;
  p.disc(cx + 3, cy + 4, 62, 'rgba(60,30,10,0.25)');
  p.disc(cx, cy, 62, INK);
  p.disc(cx, cy, 61, f.c.cup);
  p.disc(cx, cy, 57, '#fff8ef');
  p.disc(cx, cy, 50, '#efe3d0');
  // handle
  p.roundRect(cx + 44, cy - 7, 22, 14, 6, INK);
  p.roundRect(cx + 45, cy - 6, 20, 12, 5, f.c.cup);
  p.roundRect(cx + 52, cy - 3, 9, 6, 3, '#efe3d0');
  // cup rim + foam
  p.disc(cx, cy, 49, INK);
  p.disc(cx, cy, 48, '#fff8ef');
  p.disc(cx, cy, 45, f.c.cremaDark);
  p.disc(cx, cy, 43, f.c.crema);
  p.disc(cx, cy, 41, f.c.foam);
  // steam
  for (const [sx, sy] of [[cx - 30, 36], [cx + 26, 34]]) {
    for (let i = 0; i < 4; i++) p.rect(sx + Math.round(Math.sin(i) * 2), sy + i * 3, 2, 2, 'rgba(255,255,255,0.7)');
  }
  // cookie
  p.disc(126, 60, 10, INK);
  p.disc(126, 60, 9, '#e8b86a');
  p.px(123, 57, '#5a3420').px(128, 62, '#5a3420').px(125, 63, '#5a3420').px(129, 56, '#5a3420');
  // flavour ribbon
  p.rect(0, h - 14, w, 14, f.c.cupDark);
  p.rect(0, h - 14, w, 1, INK);
  p.text(f.name.toUpperCase(), 6, h - 10, { font: FONT_BIG, bold: true, color: '#fff6ea', outline: INK });
  p.text('60 QB', w - 6, h - 9, { font: FONT_TINY, color: '#ffd23f', align: 'right' });
  return p;
}
