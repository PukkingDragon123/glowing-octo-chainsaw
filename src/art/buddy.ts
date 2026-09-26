import * as THREE from 'three';
import { Bitmap, Mask, blob, capsule, ellipse, hex, poly, rect, roundRect, type RGB } from './pixel';
import { spriteMesh } from './spriteMesh';

/**
 * "Buddies": the round, dot-eyed mascots of Xolotl Kobini. Flat colours, thick dark outlines,
 * big toothy grins, blush dots and stubby two-tone limbs. Each buddy is drawn procedurally in
 * parts (body, eyes, mouth, arms, legs, topper) so it can be rigged and animated in 3D, or
 * composed into a flat portrait for packaging art.
 */

export const BUDDY_INK = '#221a1f';

export type BodyShape = 'round' | 'squircle' | 'drop' | 'bean' | 'tri' | 'box' | 'can' | 'star' | 'bolt' | 'capsule' | 'blobby' | 'ticket';
export type EyeStyle = 'dot' | 'happy' | 'closed' | 'sparkle' | 'wide' | 'wink' | 'star';
export type MouthStyle = 'grin' | 'smile' | 'open' | 'o' | 'cat' | 'flat' | 'wobbly' | 'tongue';
export type TopKind = 'none' | 'leaf' | 'sprout' | 'captain' | 'bow' | 'antenna' | 'chef' | 'beanie' | 'crown' | 'drip' | 'swirl' | 'straw' | 'cap';

export interface BuddySpec {
  id: string;
  body: {
    shape: BodyShape;
    w: number;
    h: number;
    color: string;
    shade?: string;
    light?: string;
    /** Extra paint on the body (icing, stripes, nori, spots). Gets the body mask in body-pixel coords. */
    pattern?: (b: Bitmap, m: Mask, spec: BuddySpec) => void;
  };
  eyes?: { style?: EyeStyle; y?: number; gap?: number; r?: number; color?: string };
  mouth?: { style?: MouthStyle; y?: number; w?: number };
  blush?: string | null;
  limbs?: { color: string; tip: string; arm?: number; leg?: number; thick?: number };
  /** `size` scales the hats that follow the body width (captain, chef, crown, drip). */
  top?: { kind: TopKind; color?: string; color2?: string; color3?: string; size?: number };
  ink?: string;
}

const O = 2; // outline thickness in px

function inkOutline(b: Bitmap, ink: RGB, thick = O) {
  for (let i = 0; i < thick; i++) b.outline(ink, i > 0);
}

/** Body silhouette mask inside a (w, h) box starting at (x, y). */
export function bodyMask(shape: BodyShape, W: number, H: number, x: number, y: number, w: number, h: number): Mask {
  const cx = x + w / 2;
  switch (shape) {
    case 'round':
      return ellipse(W, H, cx, y + h / 2, w / 2, h / 2);
    case 'squircle':
      return roundRect(W, H, x, y, w, h, Math.min(w, h) * 0.34);
    case 'box':
      return roundRect(W, H, x, y, w, h, Math.min(w, h) * 0.16);
    case 'can':
      return roundRect(W, H, x, y, w, h, w * 0.22);
    case 'capsule':
      return roundRect(W, H, x, y, w, h, w / 2);
    case 'drop':
      return blob(W, H, [
        [cx, y],
        [cx + w * 0.3, y + h * 0.35],
        [x + w, y + h * 0.68],
        [cx + w * 0.3, y + h],
        [cx - w * 0.3, y + h],
        [x, y + h * 0.68],
        [cx - w * 0.3, y + h * 0.35],
      ]);
    case 'bean':
      return blob(W, H, [
        [x + w * 0.18, y + h * 0.1],
        [cx, y],
        [x + w * 0.85, y + h * 0.12],
        [x + w, y + h * 0.5],
        [x + w * 0.85, y + h * 0.9],
        [cx, y + h],
        [x + w * 0.12, y + h * 0.88],
        [x, y + h * 0.5],
      ]);
    case 'tri':
      return blob(W, H, [
        [cx, y],
        [x + w * 0.78, y + h * 0.42],
        [x + w, y + h * 0.86],
        [cx, y + h],
        [x, y + h * 0.86],
        [x + w * 0.22, y + h * 0.42],
      ]);
    case 'blobby':
      return blob(W, H, [
        [cx, y + h * 0.02],
        [x + w * 0.9, y + h * 0.18],
        [x + w, y + h * 0.6],
        [x + w * 0.82, y + h],
        [x + w * 0.18, y + h],
        [x, y + h * 0.6],
        [x + w * 0.1, y + h * 0.18],
      ]);
    case 'star': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 1 : 0.55;
        pts.push([cx + Math.cos(a) * (w / 2) * r, y + h * 0.55 + Math.sin(a) * (h / 2) * r * 1.05]);
      }
      return blob(W, H, pts, 3).union(ellipse(W, H, cx, y + h * 0.58, w * 0.3, h * 0.3));
    }
    case 'bolt':
      return poly(W, H, [
        [x + w * 0.55, y],
        [x + w * 0.05, y + h * 0.56],
        [x + w * 0.44, y + h * 0.56],
        [x + w * 0.3, y + h],
        [x + w * 0.95, y + h * 0.4],
        [x + w * 0.55, y + h * 0.4],
        [x + w * 0.78, y],
      ]).union(roundRect(W, H, x + w * 0.22, y + h * 0.3, w * 0.56, h * 0.36, 3));
    case 'ticket': {
      const m = roundRect(W, H, x, y, w, h, 3);
      m.subtract(ellipse(W, H, x, y + h / 2, h * 0.16, h * 0.16)).subtract(ellipse(W, H, x + w, y + h / 2, h * 0.16, h * 0.16));
      return m;
    }
  }
}

/** Body sprite: fill, lower-right shade crescent, small top-left highlight, pattern, blush, ink. */
export function drawBody(spec: BuddySpec): Bitmap {
  const { w, h, shape } = spec.body;
  const W = w + O * 2;
  const H = h + O * 2;
  const b = new Bitmap(W, H);
  const m = bodyMask(shape, W, H, O, O, w, h);
  const fill = hex(spec.body.color);
  const shadeC = hex(spec.body.shade ?? mixHex(spec.body.color, '#3a1f4a', 0.28));
  const lightC = hex(spec.body.light ?? mixHex(spec.body.color, '#fffbe8', 0.45));
  b.paint(m, fill);
  // shade crescent: pixels that would leave the shape if moved s px down-right
  const s = Math.max(2, Math.round(Math.min(w, h) * 0.1));
  const sm = new Mask(W, H);
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (m.get(xx, yy) && !m.get(xx + s, yy + s)) sm.set(xx, yy);
  b.paint(sm, shadeC);
  // highlight: a short arc near the top-left
  const hl = new Mask(W, H);
  const bb = m.bounds();
  const hx = bb.x0 + bb.w * 0.26;
  const hy = bb.y0 + bb.h * 0.2;
  for (let yy = 0; yy < H; yy++)
    for (let xx = 0; xx < W; xx++) {
      const dx = (xx + 0.5 - hx) / Math.max(2, bb.w * 0.1);
      const dy = (yy + 0.5 - hy) / Math.max(1.5, bb.h * 0.06);
      if (dx * dx + dy * dy <= 1 && m.get(xx, yy) && m.get(xx - 2, yy - 2)) hl.set(xx, yy);
    }
  if (spec.body.shape !== 'bolt') b.paint(hl, lightC);
  spec.body.pattern?.(b, m, spec);
  // blush dots under the eyes
  if (spec.blush !== null) {
    const f = faceLayout(spec);
    const bc = hex(spec.blush ?? '#ffd460');
    const br = Math.max(2, Math.round(w * 0.08));
    for (const side of [-1, 1]) {
      const bm = ellipse(W, H, O + f.cx + side * (f.gap / 2 + br * 0.9), O + f.eyeY + f.r + br * 0.9, br, br * 0.72).intersect(m.erode());
      b.paint(bm, bc);
    }
  }
  inkOutline(b, hex(spec.ink ?? BUDDY_INK));
  return b;
}

/** Where the face goes, in body-pixel coordinates (no outline offset). */
export function faceLayout(spec: BuddySpec) {
  const { w, h } = spec.body;
  const r = spec.eyes?.r ?? Math.max(1.6, Math.min(2.6, w * 0.055));
  const gap = spec.eyes?.gap ?? w * 0.46;
  const eyeY = (spec.eyes?.y ?? 0.42) * h;
  const mouthY = (spec.mouth?.y ?? 0.56) * h;
  const mouthW = spec.mouth?.w ?? Math.round(w * 0.42);
  return { cx: w / 2, r, gap, eyeY, mouthY, mouthW };
}

/** Both eyes in one sprite (so blinking is a texture swap), sized to the body. */
export function drawEyes(spec: BuddySpec, style: EyeStyle = spec.eyes?.style ?? 'dot'): Bitmap {
  const f = faceLayout(spec);
  const W = Math.ceil(f.gap + f.r * 2 + 6);
  const H = Math.ceil(f.r * 2 + 6);
  const b = new Bitmap(W, H);
  const ink = hex(spec.eyes?.color ?? spec.ink ?? BUDDY_INK);
  const white: RGB = [255, 255, 255];
  const cy = H / 2;
  for (const side of [-1, 1]) {
    const cx = W / 2 + (side * f.gap) / 2;
    const r = f.r;
    if (style === 'dot' || style === 'sparkle' || (style === 'wink' && side === -1)) {
      b.paint(ellipse(W, H, cx, cy, r, r * 1.08), ink);
      if (style === 'sparkle') b.set(Math.floor(cx - r * 0.4), Math.floor(cy - r * 0.45), white);
    } else if (style === 'wide') {
      b.paint(ellipse(W, H, cx, cy, r + 1.4, r + 1.6), ink);
      b.paint(ellipse(W, H, cx, cy, r + 0.5, r + 0.7), white);
      b.paint(ellipse(W, H, cx, cy + 0.4, r * 0.62, r * 0.7), ink);
    } else if (style === 'happy' || (style === 'wink' && side === 1)) {
      // ^ shaped closed-happy eyes
      const m = new Mask(W, H);
      for (let x = -Math.ceil(r + 1); x <= Math.ceil(r + 1); x++) {
        const yy = Math.round(cy + Math.abs(x) * 0.7 - r * 0.2);
        m.set(Math.round(cx + x - 0.5), yy);
        m.set(Math.round(cx + x - 0.5), yy + 1);
      }
      b.paint(m, ink);
    } else if (style === 'closed') {
      b.paint(rect(W, H, cx - r - 0.5, cy - 0.2, r * 2 + 1, 1.2), ink);
    } else if (style === 'star') {
      b.paint(poly(W, H, [
        [cx, cy - r - 1.5],
        [cx + 1, cy - 1],
        [cx + r + 1.5, cy],
        [cx + 1, cy + 1],
        [cx, cy + r + 1.5],
        [cx - 1, cy + 1],
        [cx - r - 1.5, cy],
        [cx - 1, cy - 1],
      ]), ink);
    }
  }
  return b;
}

export function drawMouth(spec: BuddySpec, style: MouthStyle = spec.mouth?.style ?? 'grin'): Bitmap {
  const f = faceLayout(spec);
  const mw = Math.max(6, Math.round(style === 'grin' || style === 'open' ? f.mouthW : f.mouthW * 0.6));
  const mh = Math.max(4, Math.round(style === 'grin' ? mw * 0.5 : style === 'open' ? mw * 0.62 : mw * 0.4));
  const W = mw + 4;
  const H = mh + 4;
  const b = new Bitmap(W, H);
  const ink = hex(spec.ink ?? BUDDY_INK);
  const x0 = 2;
  const y0 = 2;
  if (style === 'grin') {
    // half-moon of teeth, like a big happy snack
    const m = ellipse(W, H, x0 + mw / 2, y0, mw / 2, mh).intersect(rect(W, H, 0, y0, W, H));
    b.paint(m, '#fff3d4');
    const teeth = [x0 + Math.round(mw * 0.3), x0 + Math.round(mw * 0.5), x0 + Math.round(mw * 0.7)];
    // one golden tooth
    const gold = new Mask(W, H);
    for (let y = 0; y < H; y++) for (let x = teeth[1] + 1; x < teeth[2]; x++) if (m.get(x, y)) gold.set(x, y);
    b.paint(gold, '#f6c945');
    for (const tx of teeth)
      for (let y = y0; y < y0 + mh; y++) if (m.get(tx, y) && m.get(tx, y + 1)) b.set(tx, y, ink);
    b.outline(ink);
  } else if (style === 'open' || style === 'tongue') {
    const m = ellipse(W, H, x0 + mw / 2, y0, mw / 2, mh).intersect(rect(W, H, 0, y0, W, H));
    b.paint(m, '#8f2436');
    b.paint(ellipse(W, H, x0 + mw / 2, y0 + mh - 1, mw * 0.28, mh * 0.42).intersect(m), '#f07a8c');
    b.paint(rect(W, H, x0 + 1, y0, mw - 2, 1.2).intersect(m), '#fff3d4');
    b.outline(ink);
  } else if (style === 'o') {
    b.paint(ellipse(W, H, W / 2, H / 2, mw * 0.28, mh * 0.5), '#8f2436');
    b.outline(ink);
  } else if (style === 'smile' || style === 'cat') {
    const m = new Mask(W, H);
    const cx = W / 2;
    for (let x = -mw / 2; x <= mw / 2; x += 0.5) {
      const t = x / (mw / 2);
      const yy = style === 'cat' ? y0 + Math.abs(Math.sin(t * Math.PI)) * (mh * 0.6) : y0 + (1 - t * t) * (mh * 0.7);
      m.set(Math.round(cx + x - 0.5), Math.round(yy));
    }
    b.paint(m.dilate(), ink);
  } else if (style === 'flat') {
    b.paint(rect(W, H, x0 + mw * 0.2, H / 2 - 0.5, mw * 0.6, 1.4), ink);
  } else if (style === 'wobbly') {
    const m = new Mask(W, H);
    for (let x = 0; x < mw; x++) m.set(x0 + x, Math.round(H / 2 + Math.sin(x * 1.3) * 1.1));
    b.paint(m.dilate(), ink);
  }
  return b;
}

/**
 * A stubby limb: two-tone tube with a mitten / foot tip, drawn along `angle` (0 = straight down,
 * positive swings toward +x). Returns the bitmap and the pivot pixel (shoulder / hip).
 */
export function drawLimbAt(spec: BuddySpec, kind: 'arm' | 'leg', angle = 0): { bmp: Bitmap; px: number; py: number } {
  const L = spec.limbs ?? { color: '#58a88f', tip: '#f3d270' };
  const t = L.thick ?? 6;
  const len = kind === 'arm' ? (L.arm ?? 13) : (L.leg ?? 9);
  const tipR = kind === 'arm' ? t * 0.72 : t * 0.62;
  const reach = len + tipR * 1.6;
  const pad = Math.ceil(tipR * 1.4 + O + 2);
  const dx = Math.sin(angle);
  const dy = Math.cos(angle);
  const minX = Math.min(0, dx * reach) - pad;
  const maxX = Math.max(0, dx * reach) + pad;
  const minY = Math.min(0, dy * reach) - pad;
  const maxY = Math.max(0, dy * reach) + pad;
  const W = Math.ceil(maxX - minX);
  const H = Math.ceil(maxY - minY);
  const px = -minX;
  const py = -minY;
  const b = new Bitmap(W, H);
  const x0 = px + dx * (t / 2);
  const y0 = py + dy * (t / 2);
  const x1 = px + dx * len;
  const y1 = py + dy * len;
  const tube = capsule(W, H, x0, y0, x1, y1, t / 2);
  b.paint(tube, L.color);
  // shade on the side away from the light (right / lower side)
  const tubeShade = new Mask(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tube.get(x, y) && (!tube.get(x + 2, y) || !tube.get(x + 1, y + 2))) tubeShade.set(x, y);
  b.paint(tubeShade, mixHex(L.color, '#1f2a4a', 0.3));
  let tip: Mask;
  if (kind === 'arm') {
    tip = ellipse(W, H, px + dx * (len + tipR * 0.3), py + dy * (len + tipR * 0.3), tipR, tipR);
  } else {
    // feet always point forward-ish (+x) and sit flat
    tip = ellipse(W, H, px + dx * len + tipR * 0.35, py + dy * len + tipR * 0.3, tipR * 1.25, tipR * 0.8);
  }
  b.paint(tip, L.tip);
  const tipShade = new Mask(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tip.get(x, y) && !tip.get(x + 1, y + 2)) tipShade.set(x, y);
  b.paint(tipShade, mixHex(L.tip, '#a0521c', 0.35));
  const ink = hex(spec.ink ?? BUDDY_INK);
  // crease where the mitten meets the sleeve
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!tip.get(x, y) || tube.get(x, y) === 0) continue;
      const inTubeOnly = (xx: number, yy: number) => tube.get(xx, yy) && !tip.get(xx, yy);
      if (inTubeOnly(x - Math.round(dx), y - Math.round(dy)) || inTubeOnly(x, y - 1)) b.set(x, y, ink);
    }
  inkOutline(b, ink);
  return { bmp: b, px, py };
}

/** Limb pointing straight down with the pivot at the top centre (for the 3D rig). */
export function drawLimb(spec: BuddySpec, kind: 'arm' | 'leg'): Bitmap {
  return drawLimbAt(spec, kind, 0).bmp;
}

/** Toppers that are worn rather than grown: they go in front of the head when they sink onto it. */
const WORN: TopKind[] = ['captain', 'bow', 'chef', 'beanie', 'crown', 'cap', 'drip'];

/**
 * Where a topper's bottom edge rests, in rows down from the top of the body bitmap: a few rows in on
 * a round head, lower on a pointy one (a star's tip) so a hat doesn't balance on a point.
 */
export function topperSeat(body: Bitmap, top: Bitmap): number {
  const op = body.opaque();
  const need = Math.min(top.w * 0.4, body.w * 0.45);
  for (let y = 0; y < body.h; y++) {
    let n = 0;
    for (let x = 0; x < body.w; x++) if (op.get(x, y)) n++;
    if (n >= need) return Math.max(5, y + 2);
  }
  return 5;
}

/** Hats, leaves and other toppers. Anchored at their bottom centre. */
export function drawTop(spec: BuddySpec): Bitmap | null {
  const top = spec.top;
  if (!top || top.kind === 'none') return null;
  const ink = hex(spec.ink ?? BUDDY_INK);
  const w = spec.body.w * (top.size ?? 1);
  const c1 = top.color;
  const c2 = top.color2;
  let b: Bitmap;
  switch (top.kind) {
    case 'leaf': {
      b = new Bitmap(22, 14);
      b.paint(poly(22, 14, [
        [7, 13.5],
        [8, 5],
        [11.5, 4.5],
        [11, 13.5],
      ]), c1 ?? '#9c7f7c');
      const leaf = blob(22, 14, [
        [11, 7],
        [15, 3],
        [20.5, 3.5],
        [18, 8],
        [13, 9.5],
      ]);
      b.paint(leaf, c2 ?? '#58a88f');
      b.paint(ellipse(22, 14, 19, 4.5, 2.2, 1.6).intersect(leaf), top.color3 ?? '#f3d270');
      for (let x = 12; x < 18; x++) b.set(x, Math.round(7.5 - (x - 12) * 0.5), mixRGB3(hex(c2 ?? '#58a88f'), ink, 0.5));
      break;
    }
    case 'sprout': {
      b = new Bitmap(18, 14);
      b.paint(rect(18, 14, 8, 6, 2, 8), c1 ?? '#4f9a4a');
      b.paint(blob(18, 14, [
        [9, 7],
        [5, 3],
        [1.5, 4],
        [3.5, 8],
      ]), c1 ?? '#6fc35c');
      b.paint(blob(18, 14, [
        [9, 6],
        [12, 2],
        [16.5, 2.5],
        [14.5, 7],
      ]), c2 ?? '#8ad86e');
      break;
    }
    case 'captain': {
      const W = Math.round(w * 0.78);
      b = new Bitmap(W, 16);
      b.paint(roundRect(W, 16, 2, 2, W - 4, 8, 4), c1 ?? '#ffffff');
      b.paint(rect(W, 16, 2, 8, W - 4, 3), c2 ?? '#23305e');
      b.paint(roundRect(W, 16, 0, 11, W * 0.62, 3.5, 1.5), '#1b1b2e');
      // gold anchor badge
      const ax = W / 2;
      b.paint(ellipse(W, 16, ax, 6, 2.6, 2.4), '#f6c945');
      b.set(Math.round(ax - 0.5), 5, [180, 120, 30]);
      b.set(Math.round(ax - 0.5), 6, [180, 120, 30]);
      break;
    }
    case 'bow': {
      b = new Bitmap(20, 11);
      b.paint(poly(20, 11, [
        [10, 5.5],
        [2, 1],
        [2, 10],
      ]), c1 ?? '#ff6d9d');
      b.paint(poly(20, 11, [
        [10, 5.5],
        [18, 1],
        [18, 10],
      ]), c1 ?? '#ff6d9d');
      b.paint(ellipse(20, 11, 10, 5.5, 2.4, 2.4), c2 ?? '#ffa9c6');
      break;
    }
    case 'antenna': {
      b = new Bitmap(10, 14);
      b.paint(rect(10, 14, 4, 5, 2, 9), c2 ?? '#8f98a8');
      b.paint(ellipse(10, 14, 5, 3.5, 3, 3), c1 ?? '#ff5d73');
      break;
    }
    case 'chef': {
      b = new Bitmap(Math.round(w * 0.7), 18);
      const W = b.w;
      b.paint(ellipse(W, 18, W * 0.3, 7, W * 0.26, 6), '#ffffff');
      b.paint(ellipse(W, 18, W * 0.7, 7, W * 0.26, 6), '#ffffff');
      b.paint(ellipse(W, 18, W * 0.5, 5.5, W * 0.3, 5.5), '#ffffff');
      b.paint(rect(W, 18, W * 0.18, 9, W * 0.64, 7), '#f1ede6');
      break;
    }
    case 'beanie': {
      const W = Math.round(w * 0.8);
      b = new Bitmap(W, 15);
      b.paint(ellipse(W, 15, W / 2, 11, W / 2 - 1, 9).intersect(rect(W, 15, 0, 0, W, 12)), c1 ?? '#ff6d6d');
      b.paint(rect(W, 15, 1, 10, W - 2, 4), c2 ?? '#ffffff');
      b.paint(ellipse(W, 15, W / 2, 2.5, 2.5, 2.2), c2 ?? '#ffffff');
      break;
    }
    case 'crown': {
      const W = Math.round(w * 0.56);
      b = new Bitmap(W, 12);
      b.paint(poly(W, 12, [
        [1, 11],
        [1, 2],
        [W * 0.3, 7],
        [W / 2, 0.5],
        [W * 0.7, 7],
        [W - 1, 2],
        [W - 1, 11],
      ]), c1 ?? '#f6c945');
      b.set(Math.round(W / 2 - 0.5), 7, hex(c2 ?? '#ff5d73'));
      break;
    }
    case 'drip': {
      // a dollop of cream / icing on the head
      const W = Math.round(w * 0.7);
      b = new Bitmap(W, 12);
      b.paint(blob(W, 12, [
        [W / 2, 1],
        [W * 0.8, 4],
        [W - 1, 10],
        [W * 0.2, 11],
        [1, 10],
        [W * 0.2, 4],
      ]), c1 ?? '#fffaf0');
      break;
    }
    case 'swirl': {
      const W = Math.round(w * 0.5);
      b = new Bitmap(W, 12);
      b.paint(ellipse(W, 12, W / 2, 8.5, W / 2 - 1, 3.2), c1 ?? '#fffaf0');
      b.paint(ellipse(W, 12, W / 2, 5.5, W / 2 - 3, 2.6), c1 ?? '#fffaf0');
      b.paint(ellipse(W, 12, W / 2, 2.6, 2.2, 2), c1 ?? '#fffaf0');
      break;
    }
    case 'straw': {
      b = new Bitmap(10, 18);
      b.paint(poly(10, 18, [
        [3, 17],
        [6, 1],
        [8.5, 1.5],
        [5.5, 17],
      ]), c1 ?? '#ff6d9d');
      for (let y = 3; y < 17; y += 4) b.set(Math.round(6 - y * 0.12), y, hex(c2 ?? '#ffffff'));
      break;
    }
    case 'cap': {
      const W = Math.round(w * 0.8);
      b = new Bitmap(W + 6, 12);
      b.paint(ellipse(W + 6, 12, W / 2, 10, W / 2 - 1, 8.5).intersect(rect(W + 6, 12, 0, 0, W + 6, 10.5)), c1 ?? '#4a74d9');
      b.paint(roundRect(W + 6, 12, W * 0.45, 8.5, W * 0.55 + 4, 3, 1.4), c2 ?? '#2f4ea3');
      break;
    }
    default:
      return null;
  }
  inkOutline(b, ink);
  return b;
}

function mixHex(a: string, b: string, t: number) {
  const A = hex(a);
  const B = hex(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function mixRGB3(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// -------------------------------------------------------------------------------------------------
// Flat portrait (for packaging, posters, UI)

export interface Pose {
  armL?: number;
  armR?: number;
  eyes?: EyeStyle;
  mouth?: MouthStyle;
  /** Hide the legs (e.g. peeking out of a box). */
  noLegs?: boolean;
}

/** Compose a buddy into one flat bitmap for packaging and posters. Arm angles: 0 down, π up. */
export function buddyPortrait(spec: BuddySpec, pose: Pose = {}): Bitmap {
  const body = drawBody(spec);
  const eyes = drawEyes(spec, pose.eyes);
  const mouth = drawMouth(spec, pose.mouth);
  const top = drawTop(spec);
  const f = faceLayout(spec);
  const aL = pose.armL ?? 0.7;
  const aR = pose.armR ?? 0.7;
  const armL = drawLimbAt(spec, 'arm', -aL);
  const armR = drawLimbAt(spec, 'arm', aR);
  const legL = drawLimbAt(spec, 'leg', 0.08);
  const legR = drawLimbAt(spec, 'leg', -0.08);
  // part placements relative to the body bitmap's top-left
  const shoulderY = O + spec.body.h * 0.52;
  const hipY = body.h - 5;
  type Place = { bmp: Bitmap; x: number; y: number };
  const parts: Place[] = [];
  if (!pose.noLegs) {
    parts.push({ bmp: legL.bmp, x: body.w * 0.5 - spec.body.w * 0.2 - legL.px, y: hipY - legL.py });
    parts.push({ bmp: legR.bmp, x: body.w * 0.5 + spec.body.w * 0.2 - legR.px, y: hipY - legR.py });
  }
  parts.push({ bmp: armL.bmp, x: O + 3 - armL.px, y: shoulderY - armL.py });
  parts.push({ bmp: armR.bmp, x: body.w - O - 3 - armR.px, y: shoulderY - armR.py });
  parts.push({ bmp: body, x: 0, y: 0 });
  parts.push({ bmp: eyes, x: O + f.cx - eyes.w / 2, y: O + f.eyeY - eyes.h / 2 });
  parts.push({ bmp: mouth, x: O + f.cx - mouth.w / 2, y: O + f.mouthY - 2 });
  if (top) parts.push({ bmp: top, x: body.w / 2 - top.w / 2, y: topperSeat(body, top) - top.h });
  let x0 = 0;
  let y0 = 0;
  let x1 = body.w;
  let y1 = body.h;
  for (const p of parts) {
    p.x = Math.round(p.x);
    p.y = Math.round(p.y);
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + p.bmp.w);
    y1 = Math.max(y1, p.y + p.bmp.h);
  }
  // trim empty margins of limb bitmaps
  const out = new Bitmap(x1 - x0, y1 - y0);
  for (const p of parts) out.blit(p.bmp, p.x - x0, p.y - y0);
  return trim(out);
}

/** Crop transparent borders. */
export function trim(b: Bitmap): Bitmap {
  const m = b.opaque().bounds();
  if (m.w <= 0) return b;
  const out = new Bitmap(m.w, m.h);
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const i = ((y + m.y0) * b.w + x + m.x0) * 4;
      if (b.data[i + 3]) out.set(x, y, [b.data[i], b.data[i + 1], b.data[i + 2]], b.data[i + 3]);
    }
  return out;
}

// -------------------------------------------------------------------------------------------------
// 3D rig

type Action = { kind: 'wave' | 'cheer' | 'hop' | 'boop' | 'spin' | 'nod'; t: number; dur: number; done?: () => void };

/**
 * A rigged buddy made of flat sprite parts. Origin at the feet. Call update(dt) every frame.
 * Actions: wave, cheer, hop, boop, spin, nod. Walking: set `walkSpeed`.
 */
export class Buddy extends THREE.Group {
  readonly spec: BuddySpec;
  readonly ppu: number;
  readonly bodyPivot = new THREE.Group();
  readonly bodyMesh: THREE.Mesh;
  private eyesMesh: THREE.Mesh;
  private mouthMesh: THREE.Mesh;
  private eyeMat: Record<string, THREE.Material> = {};
  private mouthMat: Record<string, THREE.Material> = {};
  private eyeGeo: Record<string, THREE.BufferGeometry> = {};
  private mouthGeo: Record<string, THREE.BufferGeometry> = {};
  readonly armL = new THREE.Group();
  readonly armR = new THREE.Group();
  readonly legL = new THREE.Group();
  readonly legR = new THREE.Group();
  private topMesh: THREE.Mesh | null = null;
  private legLen: number;
  private bodyH: number;
  private time = Math.random() * 10;
  private blinkIn = 1 + Math.random() * 3;
  private blinkT = 0;
  private actions: Action[] = [];
  private eyeStyle: EyeStyle;
  private mouthStyle: MouthStyle;
  private lookX = 0;
  private lookTarget = 0;
  private lookIn = 2;
  private squash = 0;
  private squashV = 0;
  /** World units per second; >0 animates a walk cycle (movement itself is up to the owner). */
  walkSpeed = 0;
  /** 1 = facing right, -1 = facing left (mirrors the rig). */
  facing = 1;
  /** Hop height in world units for the current action. */
  private hopY = 0;
  /** Face the camera around the Y axis each frame. */
  billboard = false;
  readonly hit: THREE.Mesh;

  constructor(spec: BuddySpec, ppu = 64) {
    super();
    this.spec = spec;
    this.ppu = ppu;
    this.eyeStyle = spec.eyes?.style ?? 'dot';
    this.mouthStyle = spec.mouth?.style ?? 'grin';
    const body = drawBody(spec);
    const legBmp = drawLimb(spec, 'leg');
    const armBmp = drawLimb(spec, 'arm');
    // measure the drawn leg (the bitmap has padding) so feet sit exactly on the floor
    const legBox = legBmp.opaque().bounds();
    this.legLen = legBox.h / ppu;
    this.bodyH = body.h / ppu;
    const Z = 0.004;

    // legs (pivot at hips)
    for (const [g, side] of [
      [this.legL, -1],
      [this.legR, 1],
    ] as [THREE.Group, number][]) {
      const m = spriteMesh(legBmp, { ppu, anchor: [0.5, 1], castShadow: true, doubleSided: true });
      m.position.y = legBox.y0 / ppu;
      g.add(m);
      g.position.set((side * spec.body.w * 0.2) / ppu, this.legLen, -Z);
      this.add(g);
    }
    // body
    this.bodyPivot.position.y = this.legLen - 3 / ppu;
    this.add(this.bodyPivot);
    this.bodyMesh = spriteMesh(body, { ppu, anchor: [0.5, 0], castShadow: true, doubleSided: true });
    this.bodyPivot.add(this.bodyMesh);
    // face
    const f = faceLayout(spec);
    const toX = (px: number) => (px + O - body.w / 2) / ppu;
    const toY = (py: number) => (body.h - (py + O)) / ppu;
    this.eyesMesh = new THREE.Mesh();
    this.mouthMesh = new THREE.Mesh();
    this.setEyes(this.eyeStyle);
    this.setMouth(this.mouthStyle);
    this.eyesMesh.position.set(toX(f.cx), toY(f.eyeY), Z);
    this.mouthMesh.position.set(toX(f.cx), toY(f.mouthY - 2), Z * 1.5);
    this.bodyPivot.add(this.eyesMesh, this.mouthMesh);
    // arms (pivot at shoulders, behind the body)
    for (const [g, side] of [
      [this.armL, -1],
      [this.armR, 1],
    ] as [THREE.Group, number][]) {
      const m = spriteMesh(armBmp, { ppu, anchor: [0.5, 1], castShadow: true, doubleSided: true });
      m.position.y = 2 / ppu;
      g.add(m);
      g.position.set((side * (body.w / 2 - 3)) / ppu, (body.h * 0.52) / ppu, -Z * 0.5);
      g.rotation.z = side * 0.5;
      this.bodyPivot.add(g);
    }
    // topper
    const top = drawTop(spec);
    if (top) {
      this.topMesh = spriteMesh(top, { ppu, anchor: [0.5, 0], castShadow: true, doubleSided: true });
      const seat = topperSeat(body, top);
      const worn = seat > 5 && WORN.includes(spec.top!.kind);
      this.topMesh.position.set(0, (body.h - seat) / ppu, worn ? Z * 0.8 : -Z * 0.3);
      this.bodyPivot.add(this.topMesh);
    }
    // invisible pick box
    const hw = body.w / ppu;
    const hh = this.legLen + this.bodyH + (top ? top.h / ppu : 0);
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(hw * 1.1, hh, 0.2), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = hh / 2;
    this.hit.userData.buddy = this;
    this.add(this.hit);
  }

  get height() {
    return this.legLen + this.bodyH;
  }

  setEyes(style: EyeStyle) {
    if (!this.eyeMat[style]) {
      const m = spriteMesh(drawEyes(this.spec, style), { ppu: this.ppu, anchor: [0.5, 0.5], doubleSided: true });
      this.eyeMat[style] = m.material as THREE.Material;
      this.eyeGeo[style] = m.geometry;
    }
    this.eyesMesh.geometry = this.eyeGeo[style];
    this.eyesMesh.material = this.eyeMat[style];
  }

  setMouth(style: MouthStyle) {
    if (!this.mouthMat[style]) {
      const m = spriteMesh(drawMouth(this.spec, style), { ppu: this.ppu, anchor: [0.5, 1], doubleSided: true });
      this.mouthMat[style] = m.material as THREE.Material;
      this.mouthGeo[style] = m.geometry;
    }
    this.mouthMesh.geometry = this.mouthGeo[style];
    this.mouthMesh.material = this.mouthMat[style];
  }

  /** Default expression the face returns to. */
  setFace(eyes: EyeStyle, mouth: MouthStyle) {
    this.eyeStyle = eyes;
    this.mouthStyle = mouth;
    this.setEyes(eyes);
    this.setMouth(mouth);
  }

  private play(kind: Action['kind'], dur: number) {
    return new Promise<void>((done) => {
      this.actions = this.actions.filter((a) => {
        if (a.kind === kind) a.done?.();
        return a.kind !== kind;
      });
      this.actions.push({ kind, t: 0, dur, done });
    });
  }

  wave() {
    return this.play('wave', 1.4);
  }
  cheer() {
    return this.play('cheer', 1.1);
  }
  hop() {
    return this.play('hop', 0.55);
  }
  spin() {
    return this.play('spin', 0.7);
  }
  nod() {
    return this.play('nod', 0.6);
  }
  /** A squishy poke reaction. */
  boop() {
    this.squashV -= 7;
    return this.play('boop', 0.7);
  }

  /** Glance toward -1 (left) .. 1 (right). */
  look(x: number) {
    this.lookTarget = Math.max(-1, Math.min(1, x));
    this.lookIn = 2.5 + Math.random() * 2;
  }

  update(dt: number, camera?: THREE.Camera) {
    this.time += dt;
    const t = this.time;
    // squash & stretch spring
    this.squashV += (-this.squash * 90 - this.squashV * 9) * dt;
    this.squash += this.squashV * dt;

    let armL = -0.35 - Math.sin(t * 2.1) * 0.08;
    let armR = 0.35 + Math.sin(t * 2.1 + 0.6) * 0.08;
    let legL = 0;
    let legR = 0;
    let bob = 0;
    let breathe = Math.sin(t * 2.6) * 0.025;
    let tilt = Math.sin(t * 1.3) * 0.03;
    let spinY = 0;
    let eyes: EyeStyle | null = null;
    let mouth: MouthStyle | null = null;

    if (this.walkSpeed > 0.01) {
      const f = t * 11;
      legL = Math.sin(f) * 0.55;
      legR = -Math.sin(f) * 0.55;
      bob = Math.abs(Math.sin(f)) * 2.2 / this.ppu;
      armL = -0.25 + Math.sin(f) * 0.45;
      armR = 0.25 + Math.sin(f) * 0.45;
      tilt = -0.06 * this.facing;
      breathe = 0;
    }

    this.hopY = 0;
    for (const a of this.actions) {
      a.t += dt;
      const p = Math.min(1, a.t / a.dur);
      if (a.kind === 'wave') {
        armR = 2.5 + Math.sin(a.t * 14) * 0.35;
        mouth = 'open';
      } else if (a.kind === 'cheer') {
        armL = -2.7 + Math.sin(a.t * 18) * 0.15;
        armR = 2.7 - Math.sin(a.t * 18) * 0.15;
        this.hopY = Math.abs(Math.sin(p * Math.PI * 2)) * 0.12;
        eyes = 'happy';
        mouth = 'open';
      } else if (a.kind === 'hop') {
        this.hopY = Math.sin(p * Math.PI) * 0.22;
        if (p < 0.12) breathe = -0.12;
        armL = -1.3;
        armR = 1.3;
      } else if (a.kind === 'boop') {
        eyes = 'happy';
        mouth = 'open';
      } else if (a.kind === 'spin') {
        spinY = p * Math.PI * 2;
        this.hopY = Math.sin(p * Math.PI) * 0.1;
      } else if (a.kind === 'nod') {
        tilt += Math.sin(p * Math.PI * 4) * 0.12;
      }
      if (p >= 1) a.done?.();
    }
    this.actions = this.actions.filter((a) => a.t < a.dur);

    // blinking
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkT = 0.12;
      this.blinkIn = 2 + Math.random() * 3.5;
    }
    if (this.blinkT > 0) {
      this.blinkT -= dt;
      if (!eyes) eyes = 'closed';
    }
    // glancing around
    this.lookIn -= dt;
    if (this.lookIn <= 0) {
      this.lookTarget = Math.random() < 0.5 ? 0 : (Math.random() - 0.5) * 2;
      this.lookIn = 2 + Math.random() * 4;
    }
    this.lookX += (this.lookTarget - this.lookX) * Math.min(1, dt * 10);
    const eyeShift = Math.round(this.lookX * 1.4) / this.ppu;
    const f = faceLayout(this.spec);
    this.eyesMesh.position.x = (f.cx + O - (this.spec.body.w + O * 2) / 2) / this.ppu + eyeShift;
    this.mouthMesh.position.x = (f.cx + O - (this.spec.body.w + O * 2) / 2) / this.ppu + eyeShift * 0.6;

    const wantEyes = eyes ?? this.eyeStyle;
    const wantMouth = mouth ?? this.mouthStyle;
    if (this.eyesMesh.userData.style !== wantEyes) {
      this.setEyes(wantEyes);
      this.eyesMesh.userData.style = wantEyes;
    }
    if (this.mouthMesh.userData.style !== wantMouth) {
      this.setMouth(wantMouth);
      this.mouthMesh.userData.style = wantMouth;
    }

    const sq = this.squash + breathe;
    this.bodyPivot.scale.set(1 - sq * 0.6, 1 + sq, 1);
    this.bodyPivot.position.y = this.legLen - 3 / this.ppu + bob + this.hopY;
    this.bodyPivot.rotation.z = tilt;
    this.legL.position.y = this.legR.position.y = this.legLen + this.hopY;
    this.armL.rotation.z = armL;
    this.armR.rotation.z = armR;
    this.legL.rotation.z = legL;
    this.legR.rotation.z = legR;
    if (this.topMesh) this.topMesh.rotation.z = Math.sin(t * 3.1) * 0.05 - tilt * 0.5;
    this.scale.x = Math.abs(this.scale.x) * (this.facing < 0 ? -1 : 1);
    if (this.billboard && camera) {
      camera.getWorldPosition(this.tmpA);
      this.getWorldPosition(this.tmpB);
      // world yaw toward the camera, minus the parent's own yaw
      let parentYaw = 0;
      if (this.parent) {
        this.parent.getWorldQuaternion(this.tmpQ);
        this.tmpE.setFromQuaternion(this.tmpQ, 'YXZ');
        parentYaw = this.tmpE.y;
      }
      this.rotation.y = Math.atan2(this.tmpA.x - this.tmpB.x, this.tmpA.z - this.tmpB.z) - parentYaw + spinY;
    } else this.rotation.y = spinY;
  }

  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private tmpE = new THREE.Euler();

  /** Free every texture, material and geometry this buddy made (including unused face frames). */
  dispose() {
    const mats = new Set<THREE.Material>([...Object.values(this.eyeMat), ...Object.values(this.mouthMat)]);
    const geos = new Set<THREE.BufferGeometry>([...Object.values(this.eyeGeo), ...Object.values(this.mouthGeo)]);
    this.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      geos.add(m.geometry);
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x));
    });
    for (const m of mats) {
      (m as THREE.MeshBasicMaterial).map?.dispose();
      m.dispose();
    }
    for (const g of geos) g.dispose();
    this.removeFromParent();
  }
}
