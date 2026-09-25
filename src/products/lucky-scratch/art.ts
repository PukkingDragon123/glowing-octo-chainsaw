import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { VoxelGrid } from '../../engine/voxel';
import type { Flavor } from '../types';

export const INK = '#1d1b26';
const CREAM = '#fff4d6';

export const SCRATCH_FLAVORS: Flavor[] = [
  {
    id: 'gold',
    name: 'Gold Rush',
    c: { main: '#f4c430', base: '#f4c430', light: '#ffe27a', dark: '#c8930f', deep: '#7a4a06', ribbon: '#e63946', ribbonDark: '#a4161a', win: '#e63946', collar: '#e63946', motif: 'cat' },
  },
  {
    id: 'jade',
    name: 'Jade Luck',
    c: { main: '#2a9d8f', base: '#2a9d8f', light: '#5cc9b5', dark: '#1d7268', deep: '#0f3f3a', ribbon: '#f4c430', ribbonDark: '#b8860b', win: '#ffd23f', collar: '#2ec27e', motif: 'clover' },
  },
  {
    id: 'ruby',
    name: 'Ruby Seven',
    c: { main: '#d62839', base: '#d62839', light: '#ff5d6c', dark: '#a0172a', deep: '#5c0a17', ribbon: '#ffd23f', ribbonDark: '#c8930f', win: '#ffd23f', collar: '#d62839', motif: 'seven' },
  },
];

/** Card front layout in texture pixels. The foil panel hides the QR. */
export const CARD = { w: 96, h: 136, panelX: 16, panelY: 39, panelSize: 64 };

const FOIL = { base: '#c3c9d3', light: '#e3e7ee', dark: '#8e95a3', deep: '#6b7280' };

function sunburst(p: Painter, cx: number, cy: number, n: number, c1: string, c2: string) {
  p.clear(c1);
  const R = 260;
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * Math.PI * 2 + 0.1;
    const a1 = ((i + 1) / n) * Math.PI * 2 + 0.1;
    p.poly([[cx, cy], [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R], [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R]], c2);
  }
}

/** Beckoning lucky cat face (maneki-neko), 20×18. */
function catIcon(collar: string): Painter {
  const L = new Painter(20, 19);
  L.poly([[2.5, 9], [3.5, 0.5], [9.5, 5]], '#ffffff');
  L.poly([[17.5, 9], [16.5, 0.5], [10.5, 5]], '#ffffff');
  L.poly([[4, 6], [4.5, 2.5], [7.5, 5]], '#ff9fb4');
  L.ellipse(10, 10.5, 8.2, 6.6, '#ffffff');
  L.poly([[17.5, 9], [16.5, 0.5], [12, 4.2], [14, 7]], '#f4a340');
  L.poly([[16, 6], [15.5, 2.5], [13, 5]], '#ff9fb4');
  L.rect(4, 16, 12, 2, collar);
  L.outline(INK);
  // closed happy eyes, nose, mouth, cheeks, bell
  L.px(5, 10, INK).px(6, 9, INK).px(7, 9, INK).px(8, 10, INK);
  L.px(12, 10, INK).px(13, 9, INK).px(14, 9, INK).px(15, 10, INK);
  L.px(10, 12, '#ff6f91');
  L.px(9, 13, INK).px(11, 13, INK).px(10, 14, INK);
  L.px(4, 12, '#ffb3c6').px(16, 12, '#ffb3c6');
  L.disc(10, 17.5, 1.6, '#ffd23f');
  L.px(10, 18, '#b8860b');
  return L;
}

/** Four-leaf clover, 19×19: four heart leaves, each outlined so they read separately. */
function cloverIcon(): Painter {
  const L = new Painter(19, 19);
  const g = '#3ddc84';
  const gl = '#9af5bf';
  const gd = '#1e9e57';
  L.thickLine(9.5, 11, 14.5, 17.5, 0.7, gd);
  L.outline(INK);
  const leaf = (dx: number, dy: number) => {
    const P = new Painter(19, 19);
    // heart pointing at the centre (9.5, 9.5)
    const cx = 9.5 + dx * 4.6;
    const cy = 9.5 + dy * 4.6;
    const px = -dy;
    const py = dx;
    P.disc(cx + px * 1.9 + dx * 0.6, cy + py * 1.9 + dy * 0.6, 2.5, g);
    P.disc(cx - px * 1.9 + dx * 0.6, cy - py * 1.9 + dy * 0.6, 2.5, g);
    P.poly([[cx + px * 4.2, cy + py * 4.2], [cx - px * 4.2, cy - py * 4.2], [9.5 + dx * 0.8, 9.5 + dy * 0.8]], g);
    P.px(cx + px * 1.6 + dx * 1.2, cy + py * 1.6 + dy * 1.2, gl);
    P.outline(INK);
    L.blit(P, 0, 0);
  };
  leaf(0, -1);
  leaf(-1, 0);
  leaf(1, 0);
  leaf(0, 1);
  L.px(9, 9, gd).px(10, 9, gd).px(9, 10, gd).px(10, 10, gd);
  return L;
}

function sevenIcon(): Painter {
  const L = new Painter(20, 19);
  L.text('7', 10, 2, { font: FONT_BIG, scale: 2, bold: true, color: '#ff3b4e', align: 'center' });
  L.outline('#ffd23f');
  L.outline(INK);
  L.px(6, 5, '#ffb3bb').px(7, 5, '#ffb3bb');
  return L;
}

function cherryIcon(): Painter {
  const L = new Painter(20, 19);
  L.thickLine(6, 12, 11, 3, 0.6, '#2e8b57');
  L.thickLine(14, 13, 11, 3, 0.6, '#2e8b57');
  L.ellipse(13.5, 4, 3, 1.6, '#3ddc84');
  L.disc(6, 13, 4, '#e63946');
  L.disc(14, 14, 4, '#e63946');
  L.outline(INK);
  L.px(4, 11, '#ffffff').px(12, 12, '#ffffff').px(5, 11, '#ffb3bb');
  return L;
}

function coinIcon(): Painter {
  const L = new Painter(18, 18);
  L.disc(9, 9, 7.5, '#f2b705');
  L.disc(9, 9, 5.5, '#ffd84d');
  L.outline(INK);
  L.star(9, 9.4, 4, 1.8, 5, '#f2b705');
  L.px(6, 5, '#fff3b0').px(7, 4, '#fff3b0');
  return L;
}

export function motifIcons(f: Flavor): [Painter, Painter] {
  if (f.c.motif === 'clover') return [cloverIcon(), cloverIcon()];
  if (f.c.motif === 'seven') return [sevenIcon(), cherryIcon()];
  return [catIcon(f.c.collar), coinIcon()];
}

function sparkle(p: Painter, x: number, y: number, c = '#ffffff') {
  p.px(x, y - 2, c).px(x, y - 1, c).px(x, y + 1, c).px(x, y + 2, c);
  p.px(x - 2, y, c).px(x - 1, y, c).px(x + 1, y, c).px(x + 2, y, c);
  p.px(x, y, c);
}

/** The silver scratch-off coating (64×64). Drawn once per card; erased texel by texel. */
export function foilArt(size = CARD.panelSize): Painter {
  const p = new Painter(size, size);
  p.clear(FOIL.base);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if ((x + y) % 8 < 3) p.px(x, y, FOIL.light);
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) p.px(Math.floor(rnd() * size), Math.floor(rnd() * size), FOIL.dark);
  // embossed coins around the edge
  const coin = (cx: number, cy: number) => {
    p.disc(cx, cy + 1, 4.2, FOIL.deep);
    p.disc(cx, cy, 4.2, FOIL.light);
    p.disc(cx, cy, 2.6, FOIL.base);
    p.px(cx - 1, cy - 2, '#ffffff');
  };
  for (const [cx, cy] of [[8, 8], [56, 8], [8, 56], [56, 56], [32, 55], [8, 32], [56, 32], [32, 9]] as const) coin(cx, cy);
  p.text('SCRATCH', size / 2, 21, { font: FONT_BIG, bold: true, color: FOIL.deep, shadow: '#f5f7fa', shadowOffset: [0, 1], align: 'center' });
  p.text('HERE!', size / 2, 31, { font: FONT_BIG, bold: true, color: FOIL.deep, shadow: '#f5f7fa', shadowOffset: [0, 1], align: 'center' });
  p.text('WIN A QR', size / 2, 42, { font: FONT_TINY, color: '#5a6170', align: 'center' });
  sparkle(p, 17, 46, '#ffffff');
  sparkle(p, 48, 17, '#ffffff');
  p.strokeRect(0, 0, size, size, FOIL.dark);
  p.rect(1, 1, size - 2, 1, '#f5f7fa');
  return p;
}

export interface CardArtOptions {
  /** Paint the silver foil over the panel (shelf model). */
  foil?: boolean;
  /** Scraps of foil around the panel edge (posters). */
  scraps?: boolean;
}

/** Front of the lottery card (96×136). */
export function cardFront(f: Flavor, opts: CardArtOptions = {}): Painter {
  const { w, h, panelX, panelY, panelSize } = CARD;
  const c = f.c;
  const p = new Painter(w, h);
  sunburst(p, w / 2, panelY + panelSize / 2, 20, c.base, c.light);
  // stub strip with serial number + perforation
  p.rect(0, 0, w, 10, c.deep);
  p.text('No. 0777-2046-QR', w / 2, 3, { font: FONT_TINY, color: CREAM, align: 'center' });
  for (let x = 1; x < w; x += 3) p.rect(x, 10, 2, 1, INK);
  p.rect(0, 11, w, 1, shade(c.base, 0.25));

  // ribbon banner with "LUCKY"
  const rb = new Painter(w, 24);
  rb.poly([[1, 6], [13, 6], [13, 21], [1, 21], [6, 13.5]], c.ribbonDark);
  rb.poly([[95, 6], [83, 6], [83, 21], [95, 21], [90, 13.5]], c.ribbonDark);
  rb.poly([[10, 18], [14, 18], [14, 22]], shade(c.ribbonDark, -0.2));
  rb.poly([[86, 18], [82, 18], [82, 22]], shade(c.ribbonDark, -0.2));
  rb.rect(10, 2, 76, 16, c.ribbon);
  rb.rect(10, 2, 76, 1, shade(c.ribbon, 0.25));
  rb.rect(10, 16, 76, 2, shade(c.ribbon, -0.15));
  rb.outline(INK);
  p.blit(rb, 0, 11);
  p.text('LUCKY', w / 2, 14, { font: FONT_BIG, scale: 2, bold: true, color: '#ffffff', outline: INK, shadow: INK, shadowOffset: [0, 1], align: 'center' });
  p.text('SCRATCH & SCAN', w / 2, 30, { font: FONT_TINY, color: CREAM, outline: INK, align: 'center' });

  // panel frame (the QR decal / foil sit inside)
  p.rect(panelX - 3, panelY - 3, panelSize + 6, panelSize + 6, INK);
  p.rect(panelX - 2, panelY - 2, panelSize + 4, panelSize + 4, CREAM);
  p.rect(panelX + panelSize + 3, panelY - 1, 1, panelSize + 5, shade(c.base, -0.35));
  p.rect(panelX - 1, panelY + panelSize + 3, panelSize + 5, 1, shade(c.base, -0.35));
  p.rect(panelX, panelY, panelSize, panelSize, '#ffffff');
  if (opts.foil) p.blit(foilArt(panelSize), panelX, panelY);
  if (opts.scraps) {
    // a few curls of silver left at the edges, like a real scratched card
    const scrap = (x: number, y: number, ww: number, hh: number) => {
      p.rect(x, y, ww, hh, FOIL.base);
      p.rect(x, y + hh - 1, ww, 1, FOIL.dark);
    };
    scrap(panelX - 2, panelY - 2, 9, 3);
    scrap(panelX + panelSize - 6, panelY + panelSize, 8, 2);
    scrap(panelX + panelSize, panelY + 18, 2, 7);
  }
  // sparkles around the panel
  sparkle(p, panelX - 8, panelY + 6, '#ffffff');
  sparkle(p, panelX + panelSize + 7, panelY + 44, '#ffffff');
  sparkle(p, panelX - 7, panelY + 52, CREAM);

  // bottom strip: barcode, lotto name, price badge (12 px)
  const by = h - 12;
  p.rect(0, by, w, 12, shade(c.deep, 0.05));
  p.rect(0, by, w, 1, INK);
  p.rect(4, by + 2, 28, 8, CREAM);
  let bs = 7;
  for (let x = 6; x < 30; ) {
    bs = (bs * 16807) % 2147483647;
    const bw = 1 + (bs % 2);
    p.rect(x, by + 3, bw, 6, INK);
    x += bw + 1 + ((bs >> 3) % 2);
  }
  p.text('QR LOTTO', 55, by + 4, { font: FONT_TINY, color: CREAM, align: 'center' });

  // WIN! row with motif icons, between the panel and the strip
  const wy = panelY + panelSize + 3;
  const [ma, mb] = motifIcons(f);
  p.blit(ma, 4, wy - 1);
  p.blit(mb, w - mb.w - 4, wy - 1);
  p.roundRect(26, wy, 45, 18, 4, INK);
  p.roundRect(27, wy + 1, 43, 16, 3, c.deep);
  p.rect(30, wy + 1, 37, 1, shade(c.deep, 0.2));
  p.text('WIN!', w / 2 + 1, wy + 2, { font: FONT_BIG, scale: 2, color: '#ffd23f', shadow: INK, shadowOffset: [0, 1], align: 'center' });
  // price sticker overlapping the strip
  p.burst(w - 11, by + 5, 8, 12, INK);
  p.burst(w - 11, by + 5, 7, 12, c.ribbon);
  p.text('50', w - 11, by + 3, { font: FONT_TINY, color: '#ffffff', outline: INK, align: 'center' });
  // card edge
  p.strokeRect(0, 0, w, h, INK);
  return p;
}

export function cardBack(f: Flavor): Painter {
  const { w, h } = CARD;
  const c = f.c;
  const p = new Painter(w, h);
  p.clear(c.dark);
  p.grid(0, 0, w, h, 6, shade(c.dark, 0.05), 2);
  p.rect(0, 0, w, 10, c.deep);
  for (let x = 1; x < w; x += 3) p.rect(x, 10, 2, 1, INK);
  p.text('HOW TO PLAY', w / 2, 18, { font: FONT_BIG, bold: true, color: '#ffffff', outline: INK, align: 'center' });
  const steps = ['1 SCRATCH THE FOIL', '2 FIND YOUR CODE', '3 SCAN IT', '4 YOU WIN!'];
  steps.forEach((s, i) => {
    p.roundRect(8, 34 + i * 14, w - 16, 11, 3, CREAM);
    p.text(s, 12, 37 + i * 14, { font: FONT_TINY, color: INK });
  });
  for (let i = 0; i < 6; i++) p.dither(8, 96 + i * 4, w - 16 - (i % 3) * 10, 2, shade(c.dark, 0.25), 0.5);
  p.text('ODDS OF WINNING: 1 IN 1', w / 2, h - 14, { font: FONT_TINY, color: c.light, align: 'center' });
  p.strokeRect(0, 0, w, h, INK);
  return p;
}

export function cardEdge(f: Flavor): Painter {
  return new Painter(4, 32).clear(f.c.dark);
}

/** "WIN!" starburst sticker that pops out when the code is uncovered. */
export function winSticker(f: Flavor): Painter {
  const p = new Painter(44, 30);
  const L = new Painter(44, 30);
  L.burst(22, 15, 14, 14, f.c.ribbon);
  L.ellipse(22, 15, 20, 11, f.c.ribbon);
  L.outline(INK);
  p.blit(L, 0, 0);
  p.text('WIN!', 22, 8, { font: FONT_BIG, bold: true, color: '#ffffff', outline: INK, shadow: INK, shadowOffset: [0, 1], align: 'center' });
  p.text('QR', 22, 18, { font: FONT_TINY, color: INK, align: 'center' });
  return p;
}

// ---------------------------------------------------------------------------------------------
// Voxel props

/** Gold coin standing in the XY plane (face towards +Z). */
export function coinVoxels(): VoxelGrid {
  const R = 7;
  const g = new VoxelGrid(R * 2 + 1, R * 2 + 1, 3);
  const rim = '#c8930f';
  const face = '#f7c948';
  const hi = '#ffe88a';
  for (let y = 0; y <= R * 2; y++)
    for (let x = 0; x <= R * 2; x++) {
      const d = Math.hypot(x - R, y - R);
      if (d > R + 0.3) continue;
      const edge = d > R - 1.2;
      for (let z = 0; z < 3; z++) g.set(x, y, z, edge ? rim : face);
    }
  // embossed star on both faces
  const star = [
    '...#...',
    '...#...',
    '..###..',
    '#######',
    '.#####.',
    '..###..',
    '.##.##.',
    '.#...#.',
  ];
  for (let r = 0; r < star.length; r++)
    for (let cc = 0; cc < star[r].length; cc++) {
      if (star[r][cc] !== '#') continue;
      const x = R - 3 + cc;
      const y = R + 4 - r;
      g.set(x, y, 0, hi);
      g.set(x, y, 2, hi);
    }
  return g;
}

/** Card holder: a low slab with a riser behind the card (so nothing hides the card's bottom). */
export function standVoxels(f: Flavor): VoxelGrid {
  const g = new VoxelGrid(36, 4, 10);
  const body = f.c.deep;
  const trim = f.c.light;
  g.box(0, 0, 0, 35, 1, 9, body);
  g.box(0, 1, 9, 35, 1, 9, trim);
  g.box(0, 0, 9, 35, 0, 9, shade(body, -0.15));
  g.box(1, 2, 0, 34, 3, 3, shade(body, 0.06));
  g.box(1, 3, 3, 34, 3, 3, trim);
  for (const x of [3, 32]) g.box(x, 0, 9, x + 1, 0, 9, '#ffd23f');
  return g;
}

/** Box with its 12 edges rounded off (r in voxels). */
function roundBox(g: VoxelGrid, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string, r = 1) {
  for (let z = z0; z <= z1; z++)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = Math.max(x0 + r - x, 0, x - (x1 - r));
        const dy = Math.max(y0 + r - y, 0, y - (y1 - r));
        const dz = Math.max(z0 + r - z, 0, z - (z1 - r));
        if (dx * dx + dy * dy + dz * dz <= r * r + 0.01) g.set(x, y, z, color);
      }
}

/** Grid size of the lucky cat, and where its raised arm attaches. */
export const CAT = { sx: 26, sy: 27, sz: 14, shoulder: [19.5, 9, 7.5] as [number, number, number] };

/** Maneki-neko (lucky cat) sitting, facing +Z. The beckoning arm is a separate grid. */
export function catVoxels(collar: string): VoxelGrid {
  const g = new VoxelGrid(CAT.sx, CAT.sy, CAT.sz);
  const W = '#fbfaf5';
  const shadeW = '#ece6dc';
  const orange = '#f4a340';
  const black = '#3a3440';
  const pink = '#ff9fb4';
  // body: wide at the bottom, then the head (mirror axis x = 13)
  roundBox(g, 6, 0, 2, 19, 4, 11, W, 2);
  roundBox(g, 7, 3, 3, 18, 10, 11, W, 2);
  g.box(7, 0, 3, 18, 0, 10, shadeW);
  roundBox(g, 5, 10, 2, 20, 22, 12, W, 2);
  // ears (triangles, pink inside)
  const ear = (xs: number[][]) => xs.forEach(([x0, x1], i) => g.box(x0, 21 + i, 6, x1, 21 + i, 9, W));
  ear([[7, 10], [7, 10], [7, 9], [7, 8], [7, 7]]);
  ear([[15, 18], [15, 18], [16, 18], [17, 18], [18, 18]]);
  g.box(8, 22, 9, 9, 22, 9, pink).set(8, 23, 9, pink);
  g.box(16, 22, 9, 17, 22, 9, pink).set(17, 23, 9, pink);
  // calico patches
  g.paint((x, y) => (x <= 10 && y >= 19 ? orange : null));
  g.paint((x, y) => (x >= 16 && y >= 22 ? black : null));
  g.paint((x, y, z) => (x >= 16 && y >= 2 && y <= 7 && z <= 8 ? orange : null));
  g.paint((x, y, z) => (x <= 7 && y >= 4 && y <= 6 && z <= 6 ? black : null));
  // face painted on the flat front (z = 12)
  const face = (pts: number[][], c: string) => pts.forEach(([x, y]) => g.filled(x, y, 12) && g.set(x, y, 12, c));
  face([[8, 17], [9, 18], [10, 17], [15, 17], [16, 18], [17, 17]], INK); // happy ^ ^ eyes
  face([[12, 15], [13, 15]], '#ff6f91'); // nose
  face([[10, 14], [12, 14], [13, 14], [15, 14], [11, 13], [14, 13]], INK); // ω mouth
  face([[7, 15], [8, 15], [17, 15], [18, 15]], '#ffb3c6'); // cheeks
  face([[6, 14], [19, 14], [6, 16], [19, 16]], '#a79fae'); // whisker tips
  // collar + bell
  g.paint((_x, y) => (y === 10 ? collar : null));
  g.box(12, 8, 12, 13, 9, 13, '#ffd23f');
  g.box(12, 8, 13, 13, 8, 13, '#c8930f');
  // koban coin held against the belly by the other paw
  roundBox(g, 8, 2, 12, 12, 8, 12, '#f7c948', 1);
  g.box(9, 3, 12, 11, 7, 12, '#ffe88a');
  g.box(10, 3, 12, 10, 7, 12, '#e0a21b');
  roundBox(g, 11, 4, 11, 14, 6, 13, W, 1);
  g.set(12, 5, 13, pink);
  // tail curling up at the back
  g.box(15, 1, 1, 19, 2, 2, W).box(19, 2, 1, 20, 6, 2, orange).box(20, 6, 1, 20, 7, 2, orange);
  return g;
}

/** The raised beckoning arm. Mesh origin = grid corner; the shoulder is grid (0.5, 0, 2.5). */
export function catArmVoxels(): VoxelGrid {
  const g = new VoxelGrid(6, 11, 5);
  const W = '#fbfaf5';
  g.box(0, 0, 1, 2, 3, 3, W);
  g.box(1, 3, 1, 3, 6, 3, W);
  roundBox(g, 1, 6, 0, 5, 10, 4, W, 1);
  // paw pad facing forward
  g.set(3, 7, 4, '#ff9fb4').set(2, 9, 4, '#ff9fb4').set(4, 9, 4, '#ff9fb4');
  return g;
}
