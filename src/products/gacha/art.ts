import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { buddyPortrait, type BuddySpec, type Pose } from '../../art/buddy';
import { CAST } from '../../art/cast';
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
export const RED_DARK = '#b3122a';
const RED_LIGHT = '#ff6b76';
export const SILVER = '#d9dee6';
export const SILVER_DARK = '#9aa1ad';
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

// ---------------------------------------------------------------------------------------------
// The machine (rounded shapes + painted panels), world units

/**
 * Gacha machine standing on y = 0, body front at z = `front`. Front, bottom to top: the prize chute,
 * the coin mech with the crank, the prize-card window (where the shop sticker goes) and a white
 * header band with the logo. The glass dome sits on the body top (`top`).
 */
export const MACHINE = {
  w: 0.92,
  d: 0.8,
  front: 0.33,
  top: 1.31,
  chute: { y: 0.1, w: 0.56, h: 0.44 },
  mech: { y: 0.58, w: 0.46, h: 0.26, d: 0.1 },
  crank: { y: 0.71 },
  panel: { y: 0.88, w: 0.74, h: 0.28 },
  band: { y: 1.18, h: 0.09 },
};

/** A mascot at packaging size: body, face and limbs shrink together (the pixel style stays). */
function miniSpec(spec: BuddySpec, k: number): BuddySpec {
  const L = spec.limbs ?? { color: '#58a88f', tip: '#f3d270' };
  return {
    ...spec,
    body: { ...spec.body, w: Math.round(spec.body.w * k), h: Math.round(spec.body.h * k) },
    eyes: { ...spec.eyes, gap: spec.eyes?.gap !== undefined ? spec.eyes.gap * k : undefined, r: spec.eyes?.r !== undefined ? Math.max(1.5, spec.eyes.r * k) : undefined },
    mouth: { ...spec.mouth, w: spec.mouth?.w !== undefined ? Math.round(spec.mouth.w * k) : undefined },
    limbs: { ...L, arm: Math.round((L.arm ?? 13) * k), leg: Math.round((L.leg ?? 9) * k), thick: Math.max(4, Math.round((L.thick ?? 6) * k)) },
  };
}

/** Capsu, the capsule buddy, as a flat portrait (`k` = size relative to the full mascot). */
export function capsuArt(k: number, pose: Pose = {}): Painter {
  return buddyPortrait(k === 1 ? CAST.capsu : miniSpec(CAST.capsu, k), pose).toPainter();
}

/** Prize-card window on the machine front (100 px per unit): capsu with the capsule lineup and the price. */
export function panelArt(f: Flavor): Painter {
  const w = Math.round(MACHINE.panel.w * 100);
  const h = Math.round(MACHINE.panel.h * 100);
  const p = new Painter(w, h);
  p.clear(CREAM);
  p.rect(0, 0, w, 1, '#ffffff');
  p.strokeRect(0, 0, w, h, INK);
  p.strokeRect(1, 1, w - 2, h - 2, RED_LIGHT);
  const capsu = capsuArt(0.5, { armL: 0.5, armR: 2.6 });
  p.blit(capsu, 4, h - 3 - capsu.h);
  // capsule lineup
  const cols = [f.c.cap, '#ffd23f', '#4cc9f0', '#3ddc84', '#ff5d8f'];
  cols.forEach((c, i) => {
    const x = 36 + i * 8;
    p.disc(x, 9, 3.4, INK);
    p.ellipse(x, 8.6, 2.6, 2.4, c);
    p.rect(x - 2, 9, 5, 2, '#ffffff');
    p.px(x - 1, 7, '#ffffff');
  });
  p.text('1 PLAY', 52, 15, { font: FONT_TINY, color: RED_DARK, align: 'center' });
  p.text('120 QB', 52, 21, { font: FONT_TINY, color: INK, align: 'center' });
  return p;
}

/** Logo for the white header band (100 px per unit). */
export function bandArt(): Painter {
  const p = new Painter(56, 9);
  p.text('QR', 2, 1, { font: FONT_BIG, bold: true, color: RED, align: 'left' });
  p.text('GACHA', 19, 2, { font: FONT_TINY, color: INK });
  p.star(51, 4.5, 3.6, 1.6, 5, '#ffd23f');
  return p;
}
