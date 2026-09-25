import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { VoxelGrid } from '../../engine/voxel';
import type { Flavor } from '../types';

export const INK = '#1d1b26';

/** The flavor is the rarity finish of the prize plaque. */
export const GACHA_FLAVORS: Flavor[] = [
  { id: 'holo', name: 'Holo', c: { main: '#9b5de5', cap: '#c77dff', glow: '#e0aaff', beam: '#f3c4ff', label: 'HOLO RARE', stars: '5' } },
  { id: 'gold', name: 'Gold', c: { main: '#f2a900', cap: '#f7c948', glow: '#ffe066', beam: '#ffe9a0', label: 'GOLD RARE', stars: '4' } },
  { id: 'neon', name: 'Neon', c: { main: '#00f5d4', cap: '#ff2ec4', glow: '#3ff8ff', beam: '#9ffcf0', label: 'NEON RARE', stars: '3' } },
  { id: 'galaxy', name: 'Galaxy', c: { main: '#3a0ca3', cap: '#4c2a9e', glow: '#b8a4ff', beam: '#c9b8ff', label: 'GALAXY RARE', stars: '5' } },
];

export const RED = '#e63946';
const RED_DARK = '#b3122a';
const RED_LIGHT = '#ff6b76';
const SILVER = '#d9dee6';
const SILVER_DARK = '#9aa1ad';
const CREAM = '#fff6e6';

export const CAPSULE_COLORS = ['#ff5d8f', '#ffd23f', '#3ddc84', '#4cc9f0', '#b388ff', '#ff9f1c', '#ff6b6b', '#7ae7c7'];

/** Plaque art in texture pixels; the QR decal covers `qr*`. */
export const PLAQUE = { w: 80, h: 104, panelX: 12, panelY: 19, panelSize: 56, qrX: 14, qrY: 21, qrSize: 52 };

const RAINBOW = ['#ff9ad5', '#ffc29a', '#fff59a', '#a8f7c0', '#9ad8ff', '#c9a8ff'];

function starRow(p: Painter, n: number, cy: number, fill: string, edge = INK) {
  const L = new Painter(p.w, 12);
  const gap = 10;
  const x0 = p.w / 2 - ((n - 1) * gap) / 2;
  for (let i = 0; i < n; i++) L.star(x0 + i * gap, 6, 4.6, 2, 5, fill);
  L.outline(edge);
  for (let i = 0; i < n; i++) L.px(x0 + i * gap - 1, 4, '#ffffff');
  p.blit(L, 0, cy - 6);
}

function sparkle(p: Painter, x: number, y: number, c: string, big = false) {
  p.px(x, y, c).px(x - 1, y, c).px(x + 1, y, c).px(x, y - 1, c).px(x, y + 1, c);
  if (big) p.px(x - 2, y, c).px(x + 2, y, c).px(x, y - 2, c).px(x, y + 2, c);
}

function diamond(p: Painter, x: number, y: number, c: string) {
  p.px(x, y - 2, c).rect(x - 1, y - 1, 3, 1, c).rect(x - 2, y, 5, 1, c).rect(x - 1, y + 1, 3, 1, c).px(x, y + 2, c);
}

/** One animation frame of the rarity frame around the code (phase 0..1). */
export function plaqueArt(f: Flavor, phase = 0): Painter {
  const { w, h, panelX, panelY, panelSize } = PLAQUE;
  const p = new Painter(w, h);
  const id = f.id;
  let banner = '#ffffff';
  let bannerText = INK;
  let starFill = '#ffd23f';
  let border = SILVER;
  const on = phase % 0.5 < 0.42; // neon flicker
  if (id === 'holo') {
    // diagonal rainbow foil with glitter lines and a travelling sheen
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const t = ((x + y * 0.8) / 30 + phase) % 1;
        p.px(x, y, RAINBOW[Math.floor(t * RAINBOW.length)]);
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) if ((x + y) % 2 === 0 && ((x + y * 0.8) / 30 + phase) % (1 / RAINBOW.length) < 0.03) p.px(x, y, '#ffffff');
    const s = -40 + phase * (w + h + 60);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = Math.abs(x + y - s);
        if (d < 4) p.px(x, y, d < 1.5 ? '#ffffff' : '#fdf2ff');
      }
    const spots: [number, number][] = [[6, 30], [73, 40], [6, 62], [73, 70], [8, 86], [71, 86]];
    spots.forEach(([dx, dy], i) => diamond(p, dx, dy, (i + Math.floor(phase * 8)) % 3 === 0 ? '#ffffff' : '#f3dcff'));
    border = '#f4f6ff';
  } else if (id === 'gold') {
    p.clear('#f2b705');
    // engraved guilloche lattice
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x - y + 400) % 6 === 0 || (x + y) % 6 === 0) p.px(x, y, '#dca204');
    const s = -30 + phase * (w + h + 60);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = Math.abs(x + y - s);
        if (d < 6) p.px(x, y, d < 2 ? '#fff6c8' : '#ffd84d');
      }
    border = '#fff0a8';
    banner = '#d62839';
    bannerText = '#ffe066';
    starFill = '#ffffff';
  } else if (id === 'neon') {
    p.clear('#140f2e');
    for (let x = 2; x < w; x += 6) p.rect(x, 0, 1, h, '#2a1f5c');
    for (let y = 2; y < h; y += 6) p.rect(0, y, w, 1, '#2a1f5c');
    border = '#3a2a7a';
    banner = '#140f2e';
    bannerText = on ? '#3ff8ff' : '#1f8f99';
    starFill = '#fff35c';
  } else {
    // galaxy: nebula, twinkling stars, a ringed planet and a shooting star
    p.gradientV(0, 0, w, h, '#120636', '#3a0ca3', 5);
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 12; i++) {
      const cx = rnd() * w;
      const cy = rnd() * h;
      p.dither(Math.round(cx - 8), Math.round(cy - 5), 16, 10, i % 2 ? '#7b2cbf' : '#c2185b', 0.3);
    }
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(rnd() * w);
      const y = Math.floor(rnd() * h);
      const tw = (i * 0.37 + phase) % 1;
      p.px(x, y, tw < 0.5 ? '#ffffff' : i % 3 ? '#b8a4ff' : '#ffe066');
    }
    p.disc(9, 11, 3.6, '#ff9f1c');
    p.px(8, 10, '#ffd6a0');
    p.rect(3, 11, 13, 1, '#ffe066');
    const sx = Math.round(-10 + phase * (w + 30));
    for (let i = 0; i < 7; i++) p.px(sx - i, 5 + Math.round((sx - i) * 0.06), i < 2 ? '#ffffff' : '#b8a4ff');
    border = '#b8a4ff';
    banner = '#ffffff';
  }
  // outer border
  p.strokeRect(0, 0, w, h, INK);
  p.strokeRect(1, 1, w - 2, h - 2, border, 2);
  p.strokeRect(3, 3, w - 6, h - 6, shade(border, -0.35));
  if (id === 'neon') {
    const pink = on ? '#ff4fd8' : '#a8328f';
    const cyan = on ? '#3ff8ff' : '#1f8f99';
    p.strokeRect(5, 5, w - 10, h - 10, '#5a1f63');
    p.strokeRect(6, 6, w - 12, h - 12, pink);
    p.strokeRect(7, 7, w - 14, h - 14, on ? '#ffb3f0' : '#7a2a6d');
    // inner tube keeps a clear gap from the code panel
    p.strokeRect(panelX - 5, panelY - 5, panelSize + 10, panelSize + 10, '#12505a');
    p.strokeRect(panelX - 4, panelY - 4, panelSize + 8, panelSize + 8, cyan);
  }

  // rarity stars
  starRow(p, +f.c.stars, 11, starFill);

  // code panel: plain light surface, never a dark edge around the code
  p.roundRect(panelX - 1, panelY - 1, panelSize + 2, panelSize + 2, 4, '#f4f1ff');
  p.roundRect(panelX, panelY, panelSize, panelSize, 3, '#ffffff');

  // banner with the rarity name
  const by = panelY + panelSize + 5;
  const label = f.c.label;
  const bw = p.textWidth(label, { font: FONT_TINY }) + 12;
  p.roundRect(w / 2 - bw / 2 - 1, by - 1, bw + 2, 11, 3, INK);
  p.roundRect(w / 2 - bw / 2, by, bw, 9, 2, banner);
  p.text(label, w / 2, by + 2, { font: FONT_TINY, color: bannerText, align: 'center' });

  // card number + brand in the bottom corners
  p.text('No.07', 7, h - 11, { font: FONT_TINY, color: '#ffffff', outline: INK });
  p.text('QR', w - 7, h - 11, { font: FONT_TINY, color: '#ffffff', outline: INK, align: 'right' });
  const tw1 = phase < 0.5;
  sparkle(p, 36, h - 9, '#ffffff', tw1);
  sparkle(p, 44, h - 9, '#ffffff', !tw1);
  return p;
}

/** Back of the plaque: capsule pattern + logo. */
export function plaqueBack(f: Flavor): Painter {
  const { w, h } = PLAQUE;
  const p = new Painter(w, h);
  p.clear(RED);
  for (let y = 4; y < h; y += 12)
    for (let x = (y / 12) % 2 ? 8 : 2; x < w; x += 12) {
      p.disc(x + 3, y + 3, 3, RED_LIGHT);
      p.rect(x, y + 3, 7, 3, shade(RED_LIGHT, 0.2));
    }
  p.roundRect(8, h / 2 - 12, w - 16, 24, 4, INK);
  p.roundRect(9, h / 2 - 11, w - 18, 22, 3, CREAM);
  p.text('QR', w / 2, h / 2 - 9, { font: FONT_BIG, bold: true, color: RED, align: 'center' });
  p.text('GACHA', w / 2, h / 2 + 1, { font: FONT_TINY, color: INK, align: 'center' });
  p.strokeRect(0, 0, w, h, INK);
  p.strokeRect(1, 1, w - 2, h - 2, f.c.cap);
  return p;
}

/** Top-half texture of the prize capsule (wraps the hemisphere). */
export function capsuleTopArt(f: Flavor): Painter {
  const p = new Painter(32, 16);
  if (f.id === 'holo') {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) p.px(x, y, RAINBOW[Math.floor((x / 32) * 12 + y / 3) % RAINBOW.length]);
  } else if (f.id === 'gold') {
    p.clear('#f2b705');
    for (let x = 0; x < 32; x += 4) p.rect(x, 0, 1, 16, '#ffd84d');
    for (let i = 0; i < 8; i++) p.px((i * 7) % 32, (i * 5) % 12, '#fff8d0');
  } else if (f.id === 'neon') {
    p.clear('#ff2ec4');
    for (let x = 0; x < 32; x += 8) p.rect(x, 0, 2, 16, '#ff8ae2');
    p.rect(0, 13, 32, 3, '#3ff8ff');
  } else {
    p.gradientV(0, 0, 32, 16, '#6a4cff', '#1b0a4a', 3);
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 24; i++) p.px(Math.floor(rnd() * 32), Math.floor(rnd() * 16), i % 4 ? '#ffffff' : '#ffe066');
  }
  // seam band at the equator
  p.rect(0, 14, 32, 2, shade(f.c.cap, -0.25));
  return p;
}

/** Label on the machine front: logo, price and the capsule lineup. */
export function machineLabel(f: Flavor): Painter {
  const p = new Painter(64, 24);
  p.clear(CREAM);
  p.rect(0, 0, 64, 1, '#ffffff');
  p.text('QR', 5, 3, { font: FONT_BIG, bold: true, color: RED, outline: INK, align: 'left' });
  p.text('GACHA', 22, 4, { font: FONT_TINY, color: INK });
  p.text('1 PLAY 120 QB', 22, 11, { font: FONT_TINY, color: RED_DARK });
  // capsule lineup
  const cols = [f.c.cap, '#ffd23f', '#4cc9f0', '#3ddc84', '#ff5d8f'];
  cols.forEach((c, i) => {
    const x = 6 + i * 12;
    p.disc(x, 20, 3.2, INK);
    p.ellipse(x, 19.5, 2.4, 2.2, c);
    p.rect(x - 2, 20, 5, 2, '#ffffff');
    p.px(x - 1, 18, '#ffffff');
  });
  p.text('?', 61, 16, { font: FONT_TINY, color: RED, align: 'right' });
  p.strokeRect(0, 0, 64, 24, INK);
  return p;
}

// ---------------------------------------------------------------------------------------------
// Voxels

/** Machine base + coin mech + chute (the dome, capsules and crank are separate meshes). */
export const MACHINE = { sx: 22, sy: 26, sz: 21, scale: 0.045 };

export function machineVoxels(): VoxelGrid {
  const g = new VoxelGrid(MACHINE.sx, MACHINE.sy, MACHINE.sz);
  // plinth
  g.box(0, 0, 0, 21, 1, 18, RED_DARK);
  g.box(0, 1, 18, 21, 1, 18, shade(RED_DARK, -0.1));
  // body with rounded vertical edges
  g.box(1, 2, 0, 20, 24, 17, RED);
  for (let y = 2; y <= 24; y++) g.set(1, y, 0, null).set(20, y, 0, null).set(1, y, 17, null).set(20, y, 17, null);
  // white stripe around the sides and back (the label covers the front)
  g.paint((x, y, z) => (y === 21 && (z < 17 || x < 3 || x > 18) ? '#ffffff' : null));
  // silver rim the dome sits in
  g.box(2, 25, 1, 19, 25, 16, SILVER);
  g.box(4, 25, 3, 17, 25, 14, SILVER_DARK);
  // chute: a real hollow with dark walls and a silver frame
  g.box(5, 2, 11, 16, 11, 17, INK);
  g.box(6, 3, 12, 15, 10, 17, null);
  g.box(5, 2, 18, 16, 11, 18, SILVER);
  g.box(6, 3, 18, 15, 10, 18, null);
  g.box(6, 2, 18, 15, 2, 18, SILVER_DARK);
  g.box(6, 2, 12, 15, 2, 17, '#2c2838');
  // coin mech box
  g.box(6, 13, 18, 15, 19, 20, SILVER);
  g.box(6, 13, 20, 15, 13, 20, SILVER_DARK);
  g.box(6, 19, 18, 15, 19, 20, '#eef1f5');
  g.box(9, 19, 19, 12, 19, 19, INK); // coin slot on top
  g.box(14, 14, 20, 14, 14, 20, RED_LIGHT); // little return button
  // side trim
  g.box(0, 12, 5, 0, 13, 12, SILVER);
  g.box(21, 12, 5, 21, 13, 12, SILVER);
  return g;
}

/** The big turning handle (faces +Z, rotates about Z). */
export function crankVoxels(): VoxelGrid {
  const g = new VoxelGrid(13, 13, 4);
  for (let y = 0; y < 13; y++)
    for (let x = 0; x < 13; x++) {
      const d = Math.hypot(x - 6, y - 6);
      if (d <= 4.6) g.box(x, y, 0, x, y, 1, d > 3.6 ? SILVER_DARK : SILVER);
    }
  g.box(1, 5, 2, 11, 7, 3, '#ffffff');
  g.box(0, 4, 2, 2, 8, 3, '#ffd23f');
  g.box(10, 4, 2, 12, 8, 3, '#ffd23f');
  g.set(0, 8, 3, '#fff3b0').set(10, 8, 3, '#fff3b0');
  g.box(5, 5, 3, 7, 7, 3, '#eef1f5');
  return g;
}

export function coinVoxels(): VoxelGrid {
  const R = 4;
  const g = new VoxelGrid(R * 2 + 1, R * 2 + 1, 2);
  for (let y = 0; y <= R * 2; y++)
    for (let x = 0; x <= R * 2; x++) {
      const d = Math.hypot(x - R, y - R);
      if (d <= R + 0.3) g.box(x, y, 0, x, y, 1, d > R - 1 ? '#c8930f' : '#f7c948');
    }
  g.box(R - 1, R - 1, 0, R + 1, R + 1, 1, '#ffe88a');
  g.set(R, R, 0, '#c8930f').set(R, R, 1, '#c8930f');
  return g;
}
