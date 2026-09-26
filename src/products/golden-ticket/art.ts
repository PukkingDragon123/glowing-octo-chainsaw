import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { rng } from '../../engine/tween';
import { buddyPortrait, type BuddySpec, type Pose } from '../../art/buddy';
import { CAST } from '../../art/cast';
import type { Flavor } from '../types';

export const INK = '#1d1b26';

/**
 * metal/metalHi/metalLo/metalInk: the precious-metal ramp (wrapper foil, ticket card, trim).
 * card/cardScan: ticket face (fun / camera-safe bright). emboss: dark enamel for the QR modules.
 */
export const TICKET_FLAVORS: Flavor[] = [
  { id: 'gold', name: 'Gold', c: { metal: '#f2c14e', metalHi: '#fff0a8', metalLo: '#b8862b', metalInk: '#5a3d10', card: '#f7cd55', cardScan: '#ffe79a', emboss: '#120c06', embossScan: '#0e0905', wrap: '#141118', wrapHi: '#241e2a', seal: '#a8182e' } },
  { id: 'rose', name: 'Rose Gold', c: { metal: '#eaa39a', metalHi: '#ffe0da', metalLo: '#b56d66', metalInk: '#5c2a26', card: '#f4b5ab', cardScan: '#ffdcd6', emboss: '#150a0b', embossScan: '#0d0607', wrap: '#1a1216', wrapHi: '#2c1e24', seal: '#6a1a3a' } },
  { id: 'platinum', name: 'Platinum', c: { metal: '#cdd7df', metalHi: '#f7fbff', metalLo: '#8a97a4', metalInk: '#2c343d', card: '#dde5ec', cardScan: '#f4f8fb', emboss: '#0c0e12', embossScan: '#08090b', wrap: '#101318', wrapHi: '#1c222a', seal: '#1f3a6a' } },
];

/** Paper wrapper art (front) in texture px, and the label window (for the sticker) on it. */
export const WRAP = { w: 72, h: 80, winX: 14, winY: 51, winW: 44, winH: 22 };
/** Ticket face art and where the QR panel (code + quiet zone) sits on it. */
export const TICKET = { w: 160, h: 100, qrX: 65, qrY: 6, qrSize: 88 };

// -------------------------------------------------------------------------------------------------
// Sprites

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

/** Goldie, the star buddy, as a flat portrait (`k` = size; small ones leave the crown off, it doesn't shrink). */
export function goldieArt(k: number, pose: Pose = {}, crown = k >= 0.8): Painter {
  const spec = k === 1 ? CAST.goldie : miniSpec(CAST.goldie, k);
  return buddyPortrait(crown ? spec : { ...spec, top: undefined }, pose).toPainter();
}

/** Little royal crown. ~17x12 px. */
export function drawCrown(p: Painter, x: number, y: number, f: Flavor) {
  const L = new Painter(19, 14);
  L.poly([[1, 12], [1, 4], [5, 8], [9, 1], [13, 8], [17, 4], [17, 12]], f.c.metal);
  L.rect(1, 10, 17, 3, f.c.metalLo);
  L.rect(2, 10, 15, 1, f.c.metalHi);
  L.px(9, 4, f.c.metalHi).px(8, 6, f.c.metalHi);
  L.disc(1.5, 3.5, 1.2, f.c.metalHi);
  L.disc(9.5, 1, 1.2, f.c.metalHi);
  L.disc(17.5, 3.5, 1.2, f.c.metalHi);
  L.px(5, 11, '#e8334a').px(9, 11, '#3fa7ff').px(13, 11, '#e8334a');
  L.outline(INK);
  p.blit(L, x, y);
}

function sparkle(p: Painter, x: number, y: number, color: string, big = false) {
  const r = big ? 3 : 2;
  for (let i = 1; i <= r; i++) {
    p.px(x, y - i, color).px(x, y + i, color).px(x - i, y, color).px(x + i, y, color);
  }
  p.px(x, y, '#ffffff');
}

/** Crinkled precious-metal foil. */
export function metalFoil(f: Flavor, w: number, h: number, seed = 4): Painter {
  const p = new Painter(w, h);
  p.clear(f.c.metal);
  const rnd = rng(seed);
  const cols = [f.c.metalHi, shade(f.c.metal, 0.06), f.c.metalLo, shade(f.c.metal, -0.05), f.c.metalHi];
  const n = Math.round((w * h) / 34);
  for (let i = 0; i < n; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const s = 3 + rnd() * 7;
    const a = rnd() * Math.PI * 2;
    const pts: [number, number][] = [];
    for (let k = 0; k < 3; k++) {
      const aa = a + (k * Math.PI * 2) / 3 + (rnd() - 0.5) * 0.9;
      pts.push([x + Math.cos(aa) * s * (0.5 + rnd() * 0.5), y + Math.sin(aa) * s * (0.5 + rnd() * 0.5)]);
    }
    p.poly(pts, cols[Math.floor(rnd() * cols.length)]);
  }
  for (let i = 0; i < n / 5; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const dx = (rnd() - 0.5) * 12;
    const dy = (rnd() - 0.5) * 12;
    p.line(x, y, x + dx, y + dy, f.c.metalInk);
    p.line(x, y - 1, x + dx, y + dy - 1, '#ffffff');
  }
  for (let i = 0; i < n / 3; i++) p.px(Math.floor(rnd() * w), Math.floor(rnd() * h), '#ffffff');
  return p;
}

// -------------------------------------------------------------------------------------------------
// Chocolate bar wrapper

function damask(p: Painter, w: number, h: number, f: Flavor) {
  p.clear(f.c.wrap);
  for (let y = 2; y < h; y += 6)
    for (let x = 2 + ((y / 6) % 2) * 3; x < w; x += 6) {
      p.px(x, y, f.c.wrapHi).px(x - 1, y + 1, f.c.wrapHi).px(x + 1, y + 1, f.c.wrapHi).px(x, y + 2, f.c.wrapHi);
    }
}

function border(p: Painter, x: number, y: number, w: number, h: number, f: Flavor) {
  p.strokeRect(x, y, w, h, f.c.metal);
  p.strokeRect(x + 2, y + 2, w - 4, h - 4, f.c.metalLo);
  // corner diamonds
  for (const [cx, cy] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]]) {
    p.poly([[cx, cy - 2.5], [cx + 2.5, cy], [cx, cy + 2.5], [cx - 2.5, cy]], f.c.metalHi);
  }
}

export function wrapperFront(f: Flavor): Painter {
  const { w, h, winX, winY, winW, winH } = WRAP;
  const p = new Painter(w, h);
  damask(p, w, h, f);
  border(p, 2, 2, w - 4, h - 4, f);
  const gold = { font: FONT_BIG, bold: true, color: f.c.metal, shadow: f.c.metalInk, shadowOffset: [0, 1] as [number, number], align: 'center' as const };
  p.text('GOLDEN', w / 2, 5, gold);
  p.text('TICKET', w / 2, 13, { ...gold, color: f.c.metalHi });
  // goldie waving from the middle of the wrapper
  const goldie = goldieArt(0.56, { armL: 0.5, armR: 2.5 });
  p.blit(goldie, Math.round(w / 2 - goldie.w / 2), winY - 2 - goldie.h);
  // label window: a gold frame around a ribbon and the wax seal (the sticker sits here in the shop)
  p.rect(winX - 1, winY - 1, winW + 2, winH + 2, INK);
  p.rect(winX, winY, winW, winH, f.c.metalLo);
  p.rect(winX + 1, winY + 1, winW - 2, winH - 2, f.c.wrapHi);
  p.rect(winX + 1, winY + 1, winW - 2, 1, f.c.metal);
  p.disc(w / 2, winY + winH / 2, 7.5, INK);
  p.disc(w / 2, winY + winH / 2, 6.5, f.c.seal);
  p.ring(w / 2, winY + winH / 2, 5, shade(f.c.seal, 0.15), 1);
  p.text('★', w / 2 + 0.5, winY + winH / 2 - 2, { font: FONT_TINY, color: f.c.metal, align: 'center' });
  sparkle(p, 10, 26, f.c.metalHi);
  sparkle(p, w - 10, 34, f.c.metalHi, true);
  sparkle(p, 11, 44, f.c.metalHi);
  return p;
}

export function wrapperBack(f: Flavor): Painter {
  const { w, h } = WRAP;
  const p = new Painter(w, h);
  damask(p, w, h, f);
  border(p, 2, 2, w - 4, h - 4, f);
  p.text('ONE IN A', w / 2, 8, { font: FONT_TINY, color: f.c.metal, align: 'center' });
  p.text('MILLION', w / 2, 14, { font: FONT_BIG, bold: true, color: f.c.metalHi, shadow: f.c.metalInk, align: 'center' });
  p.rect(8, 25, w - 16, 1, f.c.metalLo);
  ['FIND THE', 'GOLDEN TICKET', 'INSIDE AND', 'SCAN YOUR', 'FORTUNE'].forEach((t, i) => p.text(t, w / 2, 29 + i * 7, { font: FONT_TINY, color: f.c.metal, align: 'center' }));
  p.rect(14, 66, 44, 9, f.c.metal);
  for (let x = 16; x < 56; x += 2) p.rect(x, 67, x % 5 === 0 ? 2 : 1, 7, f.c.wrap);
  return p;
}

/** Narrow side of the wrapper: black with a gold pinstripe. */
export function wrapperSide(f: Flavor, w = 12, h = 80): Painter {
  const p = new Painter(w, h);
  p.clear(f.c.wrap);
  p.rect(Math.floor(w / 2) - 1, 0, 2, h, f.c.metal);
  p.rect(Math.floor(w / 2) - 1, 0, 1, h, f.c.metalHi);
  return p;
}

/** Dark chocolate squares (revealed when the foil peels back). */
export function chocolateFace(w: number, h: number): Painter {
  const p = new Painter(w, h);
  const base = '#3b2014';
  p.clear(shade(base, -0.08));
  const s = 12;
  for (let y = 0; y < h; y += s)
    for (let x = 0; x < w; x += s) {
      p.rect(x + 1, y + 1, s - 2, s - 2, base);
      p.rect(x + 1, y + 1, s - 2, 1, shade(base, 0.14));
      p.rect(x + 1, y + 1, 1, s - 2, shade(base, 0.1));
      p.rect(x + 2, y + s - 2, s - 3, 1, shade(base, -0.14));
    }
  return p;
}

// -------------------------------------------------------------------------------------------------
// The ticket

/** Ticket face. `scan` repaints the QR panel in the camera-safe bright tone. */
export function ticketFront(f: Flavor, scan = false): Painter {
  const { w, h, qrX, qrY, qrSize } = TICKET;
  const p = new Painter(w, h);
  p.clear(f.c.card);
  // guilloche: fine interference waves
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = Math.sin(x * 0.35 + Math.sin(y * 0.22) * 3) + Math.sin(y * 0.41 - x * 0.12);
      if (v > 1.55) p.px(x, y, shade(f.c.card, 0.07));
      else if (v < -1.7) p.px(x, y, shade(f.c.card, -0.05));
    }
  // ornate double border with corner flourishes
  p.strokeRect(2, 2, w - 4, h - 4, f.c.metalLo);
  p.strokeRect(4, 4, w - 8, h - 8, f.c.metalInk);
  p.strokeRect(5, 5, w - 10, h - 10, f.c.metalHi);
  for (let x = 8; x < w - 8; x += 4) {
    p.px(x, 3, f.c.metalHi);
    p.px(x, h - 4, f.c.metalHi);
  }
  for (const [cx, cy, sx, sy] of [[7, 7, 1, 1], [w - 8, 7, -1, 1], [7, h - 8, 1, -1], [w - 8, h - 8, -1, -1]]) {
    p.rect(cx, cy, 6 * sx, 1, f.c.metalInk);
    p.rect(cx, cy, 1, 6 * sy, f.c.metalInk);
    p.px(cx + 2 * sx, cy + 2 * sy, f.c.metalInk);
    p.px(cx + 3 * sx, cy + 3 * sy, f.c.metalHi);
  }
  // left panel: crown, title, admit one, serial
  const lx = 34;
  drawCrown(p, lx - 9.5, 11, f);
  const title = { font: FONT_BIG, bold: true, color: f.c.metalInk, shadow: f.c.metalHi, shadowOffset: [1, 1] as [number, number], align: 'center' as const };
  p.text('GOLDEN', lx, 29, { ...title, scale: 1 });
  p.text('TICKET', lx, 39, title);
  p.rect(lx - 22, 50, 44, 1, f.c.metalLo);
  p.rect(lx - 22, 51, 44, 1, f.c.metalHi);
  p.text('ADMIT ONE', lx, 55, { font: FONT_TINY, color: f.c.metalInk, align: 'center' });
  p.text('TO THE QR', lx, 63, { font: FONT_TINY, color: f.c.metalLo, align: 'center' });
  p.text('FACTORY', lx, 69, { font: FONT_TINY, color: f.c.metalLo, align: 'center' });
  p.roundRect(lx - 20, 78, 40, 11, 3, f.c.metalInk);
  p.roundRect(lx - 19, 79, 38, 9, 2, f.c.metalHi);
  p.text('No. 0001', lx, 81, { font: FONT_TINY, color: f.c.metalInk, align: 'center' });
  // QR panel: a clean bright plate framed by an engraved line (kept outside the quiet zone)
  p.rect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, f.c.metalLo);
  p.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, f.c.metalHi);
  p.rect(qrX, qrY, qrSize, qrSize, scan ? f.c.cardScan : shade(f.c.card, 0.06));
  sparkle(p, 57, 16, '#ffffff', true);
  sparkle(p, 12, 74, '#ffffff');
  return p;
}

export function ticketBack(f: Flavor): Painter {
  const { w, h } = TICKET;
  const p = new Painter(w, h);
  p.clear(shade(f.c.card, -0.04));
  for (let y = 4; y < h; y += 8) for (let x = 4 + ((y / 8) % 2) * 4; x < w; x += 8) p.px(x, y, f.c.metalHi);
  p.strokeRect(3, 3, w - 6, h - 6, f.c.metalInk);
  p.strokeRect(5, 5, w - 10, h - 10, f.c.metalLo);
  drawCrown(p, w / 2 - 9.5, 14, f);
  p.text('CONGRATULATIONS!', w / 2, 34, { font: FONT_BIG, bold: true, color: f.c.metalInk, shadow: f.c.metalHi, shadowOffset: [1, 1], align: 'center' });
  p.text('PRESENT THIS TICKET', w / 2, 52, { font: FONT_TINY, color: f.c.metalInk, align: 'center' });
  p.text('AT THE FACTORY GATES', w / 2, 60, { font: FONT_TINY, color: f.c.metalInk, align: 'center' });
  p.text('★ ★ ★ ★ ★', w / 2, 74, { font: FONT_TINY, color: f.c.metalLo, align: 'center' });
  return p;
}

/** Soft radial glow (for additive halos). */
export function glowSprite(color: string, size = 32): Painter {
  const p = new Painter(size, size);
  const c = size / 2;
  const steps = 6;
  for (let i = steps; i >= 1; i--) {
    const r = (c * i) / steps;
    p.ctx.globalAlpha = 0.16 + (1 - i / steps) * 0.18;
    p.disc(c, c, r, color);
  }
  p.ctx.globalAlpha = 1;
  return p;
}

/** Pixel sunburst: alternating light wedges fading out in steps (for the ticket's entrance). */
export function raysSprite(color: string, size = 64): Painter {
  const p = new Painter(size, size);
  const c = size / 2;
  const wedges = 14;
  for (let ring = 4; ring >= 1; ring--) {
    const r = (c * ring) / 4;
    p.ctx.globalAlpha = 0.14 + (4 - ring) * 0.12;
    for (let i = 0; i < wedges; i++) {
      const a0 = (i / wedges) * Math.PI * 2;
      const a1 = a0 + (Math.PI / wedges) * 0.9;
      p.poly([[c, c], [c + Math.cos(a0) * r, c + Math.sin(a0) * r], [c + Math.cos(a1) * r, c + Math.sin(a1) * r]], color);
    }
  }
  p.ctx.globalAlpha = 0.5;
  p.disc(c, c, c * 0.22, '#ffffff');
  p.ctx.globalAlpha = 1;
  return p;
}

/** Diagonal light band for the shine sweep (transparent elsewhere). */
export function shineBand(): Painter {
  const w = 64;
  const h = 32;
  const p = new Painter(w, h);
  const bands: [number, number][] = [[26, 0.35], [29, 0.8], [33, 0.45], [37, 0.25]];
  for (const [x, a] of bands) {
    p.ctx.globalAlpha = a;
    p.poly([[x, h], [x + 3, h], [x + 3 + h * 0.5, 0], [x + h * 0.5, 0]], '#ffffff');
  }
  p.ctx.globalAlpha = 1;
  return p;
}

/** Red velvet runner with a woven diamond pattern and gold trim (the ticket lands on it). */
export function runnerTop(f: Flavor, w = 174, h = 120): Painter {
  const p = new Painter(w, h);
  const red = '#7a1028';
  p.clear(red);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = (Math.abs(((x + 6) % 12) - 6) + Math.abs(((y + 6) % 12) - 6)) | 0;
      if (d === 6) p.px(x, y, '#651022');
      else if (d === 0) p.px(x, y, '#9a1c38');
    }
  p.strokeRect(3, 3, w - 6, h - 6, f.c.metalLo);
  p.strokeRect(4, 4, w - 8, h - 8, f.c.metal);
  p.strokeRect(6, 6, w - 12, h - 12, f.c.metalLo);
  for (let x = 9; x < w - 9; x += 6) {
    p.px(x, 1, f.c.metal);
    p.px(x, h - 2, f.c.metal);
  }
  for (let y = 9; y < h - 9; y += 6) {
    p.px(1, y, f.c.metal);
    p.px(w - 2, y, f.c.metal);
  }
  for (const [cx, cy] of [[10, 10], [w - 11, 10], [10, h - 11], [w - 11, h - 11]]) {
    p.poly([[cx, cy - 3], [cx + 3, cy], [cx, cy + 3], [cx - 3, cy]], f.c.metal);
    p.px(cx, cy, f.c.metalHi);
  }
  return p;
}

// -------------------------------------------------------------------------------------------------
// Poster

export const POSTER = { w: 120, h: 166, qrX: 20, qrY: 62, qrSize: 80 };

export function posterArt(f: Flavor): Painter {
  const { w, h, qrX, qrY, qrSize } = POSTER;
  const p = new Painter(w, h);
  damask(p, w, h, f);
  border(p, 3, 3, w - 6, h - 6, f);
  // goldie cheering over the title, crown and all (as big as the space allows)
  const titleY = qrY - 16;
  const cheer: Pose = { armL: 2.6, armR: 2.6, eyes: 'happy', mouth: 'open' };
  let goldie = goldieArt(0.7, cheer, true);
  for (const k of [0.64, 0.58, 0.52]) if (goldie.h > titleY - 6) goldie = goldieArt(k, cheer, true);
  p.blit(goldie, Math.round(w / 2 - goldie.w / 2), titleY - 1 - goldie.h);
  p.text('GOLDEN TICKET', w / 2, titleY, { font: FONT_BIG, bold: true, color: f.c.metal, shadow: f.c.metalInk, shadowOffset: [0, 1], align: 'center' });
  // the ticket card holding the code
  const cx = qrX - 10;
  const cy = qrY - 6;
  const cw = qrSize + 20;
  const ch = qrSize + 22;
  p.rect(cx - 1, cy - 1, cw + 2, ch + 2, INK);
  p.rect(cx, cy, cw, ch, f.c.card);
  p.strokeRect(cx + 2, cy + 2, cw - 4, ch - 4, f.c.metalLo);
  p.strokeRect(cx + 3, cy + 3, cw - 6, ch - 6, f.c.metalHi);
  p.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, f.c.metalHi);
  p.text('ADMIT ONE · No. 0001', w / 2, qrY + qrSize + 5, { font: FONT_TINY, color: f.c.metalInk, align: 'center' });
  sparkle(p, 12, 30, f.c.metalHi, true);
  sparkle(p, w - 12, 44, f.c.metalHi);
  sparkle(p, w - 16, h - 12, f.c.metalHi, true);
  sparkle(p, 14, h - 16, f.c.metalHi);
  return p;
}
