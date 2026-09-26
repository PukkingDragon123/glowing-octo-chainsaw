import * as THREE from 'three';
import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { rng } from '../../engine/tween';
import { buddyPortrait, drawEyes, drawMouth, type BuddySpec, type EyeStyle, type MouthStyle, type Pose } from '../../art/buddy';
import { CAST } from '../../art/cast';
import type { Flavor } from '../types';

export const INK = '#1d1b26';
export const RICE = '#fcfaf4';
export const NORI = '#1f2d22';
export const NORI_SCAN = '#121a14';

export const ONIGIRI_FLAVORS: Flavor[] = [
  { id: 'tuna', name: 'Tuna Mayo', c: { main: '#2e86de', dark: '#1b5ea6', accent: '#ffd23f', fill: '#f1dcaa', fillDark: '#c99f5c', text: '#ffffff' } },
  { id: 'salmon', name: 'Salmon', c: { main: '#ff7f50', dark: '#d8542a', accent: '#fff0c2', fill: '#ff9470', fillDark: '#df5b39', text: '#ffffff' } },
  { id: 'ume', name: 'Umeboshi', c: { main: '#e84393', dark: '#b3286d', accent: '#ffe3f1', fill: '#d7263d', fillDark: '#8c1327', text: '#ffffff' } },
  { id: 'pork', name: 'Spicy Pork', c: { main: '#e67e22', dark: '#b45a10', accent: '#ffe066', fill: '#c9582e', fillDark: '#7d2d13', text: '#ffffff' } },
];

/** Two-line label text per flavour (the tear strip splits the label down the middle). */
export const LABEL_LINES: Record<string, [string, string]> = {
  tuna: ['TUNA', 'MAYO'],
  salmon: ['SAL-', 'MON'],
  ume: ['UME', 'PLUM'],
  pork: ['SPICY', 'PORK'],
};

/**
 * Onigiri dimensions (world units). The silhouette is a rounded triangle W×H; the flat front face is
 * the silhouette shrunk by `bevel`. The code square (with quiet zone) sits near the bottom of that face.
 */
export const ONI = {
  W: 3.2,
  H: 2.85,
  Ra: 0.5,
  Rb: 0.4,
  T: 1.0,
  bevel: 0.1,
  bevelT: 0.13,
  codeS: 1.22,
  codeBottom: 0.2,
};

export type Pt = [number, number];

/** Polygon with rounded corners: one arc per corner, tangent to both edges. */
export function roundedPolygon(corners: Pt[], radii: number[], seg = 8): Pt[] {
  const n = corners.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = corners[i];
    const a = corners[(i + n - 1) % n];
    const b = corners[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ux = (a[0] - p[0]) / la;
    const uy = (a[1] - p[1]) / la;
    const vx = (b[0] - p[0]) / lb;
    const vy = (b[1] - p[1]) / lb;
    const ang = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
    const r = Math.max(0.001, radii[i]);
    const t = r / Math.tan(ang / 2);
    const d = r / Math.sin(ang / 2);
    const bl = Math.hypot(ux + vx, uy + vy);
    const cx = p[0] + ((ux + vx) / bl) * d;
    const cy = p[1] + ((uy + vy) / bl) * d;
    const a1 = Math.atan2(p[1] + uy * t - cy, p[0] + ux * t - cx);
    const a2 = Math.atan2(p[1] + vy * t - cy, p[0] + vx * t - cx);
    let da = a2 - a1;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    for (let k = 0; k <= seg; k++) {
      const aa = a1 + (da * k) / seg;
      out.push([cx + Math.cos(aa) * r, cy + Math.sin(aa) * r]);
    }
  }
  return out;
}

/** Sharp triangle corners (base-left, base-right, apex) offset outward by `off` (negative shrinks). */
export function triCorners(off = 0): Pt[] {
  const { W, H } = ONI;
  const A: Pt = [0, H];
  const B: Pt = [-W / 2, 0];
  const C: Pt = [W / 2, 0];
  const a = W;
  const b = Math.hypot(A[0] - C[0], A[1] - C[1]);
  const c = Math.hypot(A[0] - B[0], A[1] - B[1]);
  const per = a + b + c;
  const ix = (a * A[0] + b * B[0] + c * C[0]) / per;
  const iy = (a * A[1] + b * B[1] + c * C[1]) / per;
  const r = (0.5 * W * H) / (per / 2);
  const k = (r + off) / r;
  return [B, C, A].map(([x, y]) => [ix + (x - ix) * k, iy + (y - iy) * k] as Pt);
}

/** Onigiri outline (counter-clockwise), grown by `off`. off = 0 is the silhouette. */
export function oniOutline(off = 0, seg = 8): Pt[] {
  return roundedPolygon(triCorners(off), [ONI.Rb + off, ONI.Rb + off, ONI.Ra + off], seg);
}

/** Keep the part of a convex polygon left (or right) of x = x0. */
export function clipX(poly: Pt[], x0: number, keepLeft: boolean): Pt[] {
  const inside = (p: Pt) => (keepLeft ? p[0] <= x0 : p[0] >= x0);
  const cut = (p: Pt, q: Pt): Pt => {
    const t = (x0 - p[0]) / (q[0] - p[0]);
    return [x0, p[1] + (q[1] - p[1]) * t];
  };
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const ci = inside(cur);
    const pi = inside(prev);
    if (ci) {
      if (!pi) out.push(cut(prev, cur));
      out.push(cur);
    } else if (pi) out.push(cut(prev, cur));
  }
  return out;
}

/** Flat polygon mesh geometry (facing +Z) with UVs computed from positions. */
export function polyGeometry(poly: Pt[], uv: (x: number, y: number) => Pt): THREE.BufferGeometry {
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ShapeGeometry(shape);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uva = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const [u, v] = uv(pos.getX(i), pos.getY(i));
    uva.setXY(i, u, v);
  }
  return g;
}

// -------------------------------------------------------------------------------------------------
// Film texture space: local onigiri coords (origin bottom-centre of the front face) → texture pixels.

export const FILM = { PX: 48, X0: -1.95, X1: 1.95, Y0: -0.25, Y1: 2.5 };
export const filmW = Math.round((FILM.X1 - FILM.X0) * FILM.PX);
export const filmH = Math.round((FILM.Y1 - FILM.Y0) * FILM.PX);
export const fx = (x: number) => (x - FILM.X0) * FILM.PX;
export const fy = (y: number) => (FILM.Y1 - y) * FILM.PX;
export const filmUV = (x: number, y: number): Pt => [(x - FILM.X0) / (FILM.X1 - FILM.X0), (y - FILM.Y0) / (FILM.Y1 - FILM.Y0)];

/** Film outline offset from the silhouette. */
export const FILM_OFF = 0.06;
export const TAB_R = 0.19;

/** Centre of a pull tab poking out of rounded film corner `i` (0 = bottom-left, 1 = bottom-right). */
function cornerTab(i: number): Pt {
  const cs = triCorners(FILM_OFF);
  const p = cs[i];
  const a = cs[(i + 2) % 3];
  const b = cs[(i + 1) % 3];
  const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
  const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
  const ux = (a[0] - p[0]) / la + (b[0] - p[0]) / lb;
  const uy = (a[1] - p[1]) / la + (b[1] - p[1]) / lb;
  const ang = Math.acos(((a[0] - p[0]) * (b[0] - p[0]) + (a[1] - p[1]) * (b[1] - p[1])) / (la * lb));
  const bl = Math.hypot(ux, uy);
  const r = ONI.Rb + FILM_OFF;
  const d = r / Math.sin(ang / 2) - r - 0.02;
  return [p[0] + (ux / bl) * d, p[1] + (uy / bl) * d];
}
/** Centres of the "2" and "3" corner tabs. */
export const TAB2: Pt = cornerTab(0);
export const TAB3: Pt = cornerTab(1);

function toPx(poly: Pt[]): Pt[] {
  return poly.map(([x, y]) => [fx(x), fy(y)] as Pt);
}

function clipTo(layer: Painter, poly: Pt[]) {
  const mask = new Painter(layer.w, layer.h);
  mask.poly(toPx(poly), '#fff');
  layer.ctx.globalCompositeOperation = 'destination-in';
  layer.ctx.drawImage(mask.canvas, 0, 0);
  layer.ctx.globalCompositeOperation = 'source-over';
}

/** A mascot at packaging size: body, face and limbs shrink together (the pixel style stays). */
export function miniSpec(spec: BuddySpec, k: number): BuddySpec {
  const L = spec.limbs ?? { color: '#58a88f', tip: '#f3d270' };
  return {
    ...spec,
    body: { ...spec.body, w: Math.round(spec.body.w * k), h: Math.round(spec.body.h * k) },
    eyes: { ...spec.eyes, gap: spec.eyes?.gap !== undefined ? spec.eyes.gap * k : undefined, r: spec.eyes?.r !== undefined ? Math.max(1.5, spec.eyes.r * k) : undefined },
    mouth: { ...spec.mouth, w: spec.mouth?.w !== undefined ? Math.round(spec.mouth.w * k) : undefined },
    limbs: { ...L, arm: Math.round((L.arm ?? 13) * k), leg: Math.round((L.leg ?? 9) * k), thick: Math.max(4, Math.round((L.thick ?? 6) * k)) },
  };
}

/** The onigiri buddy as a flat portrait, `k` = size relative to the full mascot. */
export function oniArt(k: number, pose: Pose = {}): Painter {
  return buddyPortrait(k === 1 ? CAST.oni : miniSpec(CAST.oni, k), pose).toPainter();
}

/** Tiny filling pictogram for the label. */
function drawFilling(p: Painter, x: number, y: number, f: Flavor) {
  const L = new Painter(14, 10);
  if (f.id === 'tuna') {
    L.rect(2, 3, 10, 6, '#c9d3dc');
    L.rect(2, 3, 10, 2, f.c.fill);
    L.rect(3, 6, 8, 1, '#8fa0b0');
  } else if (f.id === 'salmon') {
    L.ellipse(7, 5, 6, 3.5, f.c.fill);
    L.rect(3, 4, 1, 3, '#ffd2c2').rect(6, 3, 1, 4, '#ffd2c2').rect(9, 4, 1, 3, '#ffd2c2');
  } else if (f.id === 'ume') {
    L.disc(7, 5.5, 4, f.c.fill);
    L.px(5, 4, '#ff8fa0').px(6, 3, '#ff8fa0');
    L.rect(7, 0, 1, 2, '#3f8f3a');
  } else {
    L.rect(2, 3, 5, 4, f.c.fill).rect(7, 4, 5, 4, f.c.fillDark);
    L.px(3, 3, '#ff6b3d').px(9, 4, '#ff6b3d');
  }
  L.outline(INK);
  p.blit(L, x, y);
}

/** Printed front film (transparent where clear). Drawn in film texture space. */
export function filmFront(f: Flavor): Painter {
  const p = new Painter(filmW, filmH);
  const outline = oniOutline(FILM_OFF);
  // clear film tint
  p.poly(toPx(outline), 'rgba(200,225,255,0.025)');
  // heat-seal rim
  const rim = new Painter(filmW, filmH);
  rim.poly(toPx(outline), 'rgba(255,255,255,0.55)');
  rim.ctx.globalCompositeOperation = 'destination-out';
  rim.poly(toPx(oniOutline(FILM_OFF - 0.05)), '#000');
  rim.ctx.globalCompositeOperation = 'source-over';
  p.blit(rim, 0, 0);
  // shine streaks
  const shine = new Painter(filmW, filmH);
  for (const [x0, w] of [[fx(-1.25), 3], [fx(-1.02), 1], [fx(0.9), 2]] as const) {
    for (let i = 0; i < 70; i++) shine.rect(x0 + i * 0.55, fy(0.35) - i, w, 1, 'rgba(255,255,255,0.42)');
  }
  clipTo(shine, oniOutline(FILM_OFF - 0.08));
  p.blit(shine, 0, 0);

  // flavour label (split down the middle by the tear strip, like the real thing)
  const lx = Math.round(fx(-0.68));
  const ly = Math.round(fy(1.64));
  const lw = Math.round(1.36 * FILM.PX);
  const lh = Math.round(0.7 * FILM.PX);
  p.roundRect(lx - 1, ly - 1, lw + 2, lh + 2, 5, INK);
  p.roundRect(lx, ly, lw, lh, 4, f.c.main);
  p.rect(lx + 3, ly + 2, lw - 6, 1, shade(f.c.main, 0.18));
  p.rect(lx + 3, ly + lh - 3, lw - 6, 1, f.c.dark);
  const half = Math.floor(lw / 2);
  const panel = half - 5; // strip covers the middle ±5px
  // left: the onigiri buddy waving on a sunburst, popping out over the top edge of the label
  const mcx = lx + Math.round(panel / 2) + 1;
  const mcy = ly + Math.round(lh / 2);
  p.disc(mcx, mcy, 12, shade(f.c.main, 0.12));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.line(mcx + Math.cos(a) * 8, mcy + Math.sin(a) * 8, mcx + Math.cos(a) * 12, mcy + Math.sin(a) * 12, shade(f.c.main, 0.22));
  }
  const oni = oniArt(0.62, { armL: 0.45, armR: 2.5 });
  p.blit(oni, Math.round(mcx - oni.w / 2) - 1, ly + lh - 1 - oni.h);
  // right: flavour name + pictogram
  const [l1, l2] = LABEL_LINES[f.id] ?? [f.name.toUpperCase(), ''];
  const rx = lx + half + 5;
  const rw = lw - half - 6;
  const fit = (s: string) => (p.textWidth(s, { font: FONT_BIG }) <= rw ? FONT_BIG : FONT_TINY);
  const f1 = fit(l1);
  const f2 = fit(l2);
  p.text(l1, rx + rw / 2, ly + 4, { font: f1, color: '#ffffff', outline: INK, align: 'center' });
  p.text(l2, rx + rw / 2, ly + (f1 === FONT_BIG ? 13 : 11), { font: f2, color: f.c.accent, outline: INK, align: 'center' });
  drawFilling(p, rx + Math.round(rw / 2) - 7, ly + lh - 13, f);

  // brand logo along the bottom, either side of the strip
  p.text('ONIGIRI', fx(-0.22), fy(0.21), { font: FONT_TINY, color: '#ffffff', outline: INK, align: 'right' });
  p.text('QR', fx(0.2), fy(0.21), { font: FONT_TINY, color: f.c.accent, outline: INK });

  // "OPEN" arrows towards the corner tabs
  const arrow = (x: number, y: number, dir: -1 | 1) => {
    for (let i = 0; i < 4; i++) p.px(x + dir * i * 3, y + i, 'rgba(232,35,58,0.9)');
    p.px(x + dir * 9, y + 2, '#e8233a').px(x + dir * 9, y + 3, '#e8233a').px(x + dir * 8, y + 3, '#e8233a');
  };
  arrow(Math.round(fx(-0.82)), Math.round(fy(0.44)), -1);
  arrow(Math.round(fx(0.82)), Math.round(fy(0.44)), 1);

  // corner tabs (2 and 3)
  const tab = (c: Pt, label: string) => {
    const cx = fx(c[0]);
    const cy = fy(c[1]);
    const r = TAB_R * FILM.PX;
    p.disc(cx, cy, r, INK);
    p.disc(cx, cy, r - 1, '#ffffff');
    p.disc(cx, cy, r - 3, '#e8233a');
    p.text(label, cx + 1, cy - 3, { font: FONT_BIG, bold: true, color: '#ffffff', align: 'center' });
  };
  tab(TAB2, '2');
  tab(TAB3, '3');
  return p;
}

/** Back film: QR-trition table, how-to pictograms and a barcode. Drawn as seen from behind. */
export function filmBack(f: Flavor): Painter {
  const p = new Painter(filmW, filmH);
  const outline = oniOutline(FILM_OFF);
  p.poly(toPx(outline), 'rgba(225,238,255,0.16)');
  const cx = filmW / 2;
  // how-to panel
  const hy = Math.round(fy(1.55));
  p.roundRect(cx - 34, hy, 68, 22, 3, INK);
  p.roundRect(cx - 33, hy + 1, 66, 20, 2, '#ffffff');
  p.text('HOW TO OPEN', cx, hy + 3, { font: FONT_TINY, color: f.c.dark, align: 'center' });
  ['1', '2', '3'].forEach((n, i) => {
    const bx = cx - 20 + i * 20;
    p.disc(bx, hy + 14, 4, '#e8233a');
    p.text(n, bx + 1, hy + 12, { font: FONT_TINY, color: '#ffffff', align: 'center' });
    if (i < 2) p.text('>', bx + 10, hy + 12, { font: FONT_TINY, color: INK, align: 'center' });
  });
  // facts
  const ty = hy + 26;
  p.rect(cx - 30, ty, 60, 34, INK);
  p.rect(cx - 29, ty + 1, 58, 32, '#ffffff');
  p.text('QR-TRITION', cx, ty + 3, { font: FONT_TINY, color: INK, align: 'center' });
  p.rect(cx - 27, ty + 9, 54, 1, INK);
  [['RICE', '100%'], ['NORI', 'QR'], ['KCAL', '0'], ['SMILES', 'MAX']].forEach(([k, v], i) => {
    p.text(k, cx - 26, ty + 11 + i * 5.5, { font: FONT_TINY, color: INK });
    p.text(v, cx + 26, ty + 11 + i * 5.5, { font: FONT_TINY, color: INK, align: 'right' });
  });
  // barcode + best before
  const by = ty + 38;
  p.rect(cx - 22, by, 44, 14, '#ffffff');
  for (let x = 0; x < 40; x++) if ((x * 7) % 5 < 3) p.rect(cx - 20 + x, by + 2, 1, 9, INK);
  p.text('BEST BEFORE: TODAY', cx, by + 16, { font: FONT_TINY, color: '#e8233a', align: 'center' });
  p.text('NET 110G', cx, by + 23, { font: FONT_TINY, color: INK, align: 'center' });
  return p;
}

/** Red tear strip with the "1" pull tab at the top. Canvas is strip-width × strip-length. */
export function stripArt(len: number, w: number): Painter {
  const W = Math.max(8, Math.round(w * FILM.PX));
  const H = Math.round(len * FILM.PX);
  const p = new Painter(W, H);
  p.clear('#e8233a');
  p.rect(0, 0, 1, H, '#b3122a').rect(W - 1, 0, 1, H, '#b3122a');
  for (let y = 22; y < H - 4; y += 9) {
    const c = Math.floor(W / 2);
    p.px(c, y + 2, '#ffffff').px(c - 1, y + 1, '#ffffff').px(c + 1, y + 1, '#ffffff').px(c - 2, y, '#ffc2c9').px(c + 2, y, '#ffc2c9');
  }
  // tab head
  p.roundRect(0, 0, W, 18, 3, '#ff4d5e');
  p.disc(W / 2, 8, 5.5, '#ffffff');
  p.text('1', W / 2 + 1, 5, { font: FONT_BIG, bold: true, color: '#e8233a', align: 'center' });
  p.rect(1, 17, W - 2, 1, '#b3122a');
  return p;
}

/** Tiling rice texture: little outlined grains on warm white. Everything stays light for scanning. */
export function riceTexture(): THREE.CanvasTexture {
  const S = 32;
  const p = new Painter(S, S);
  p.clear(RICE);
  const r = rng(11);
  const edge = '#e9e2d0';
  const wrap = (fn: (ox: number, oy: number) => void) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy);
  };
  for (let i = 0; i < 24; i++) {
    const x = Math.floor(r() * S);
    const y = Math.floor(r() * S);
    const kind = Math.floor(r() * 4);
    wrap((ox, oy) => {
      const X = x + ox;
      const Y = y + oy;
      if (kind === 0) {
        p.rect(X + 1, Y, 3, 1, edge).rect(X + 1, Y + 2, 3, 1, edge).px(X, Y + 1, edge).px(X + 4, Y + 1, edge);
        p.rect(X + 1, Y + 1, 3, 1, '#ffffff');
      } else if (kind === 1) {
        p.rect(X, Y + 1, 1, 3, edge).rect(X + 2, Y + 1, 1, 3, edge).px(X + 1, Y, edge).px(X + 1, Y + 4, edge);
        p.rect(X + 1, Y + 1, 1, 3, '#ffffff');
      } else if (kind === 2) {
        p.px(X + 2, Y, edge).px(X + 3, Y, edge).px(X + 1, Y + 1, edge).px(X + 3, Y + 1, edge).px(X, Y + 2, edge).px(X + 2, Y + 2, edge).px(X, Y + 3, edge).px(X + 1, Y + 3, edge);
        p.px(X + 2, Y + 1, '#ffffff').px(X + 1, Y + 2, '#ffffff');
      } else {
        p.px(X, Y, edge).px(X + 1, Y, edge).px(X, Y + 1, edge).px(X + 2, Y + 1, edge).px(X + 1, Y + 2, edge).px(X + 3, Y + 2, edge).px(X + 2, Y + 3, edge).px(X + 3, Y + 3, edge);
        p.px(X + 1, Y + 1, '#ffffff').px(X + 2, Y + 2, '#ffffff');
      }
    });
  }
  for (let i = 0; i < 14; i++) p.px(Math.floor(r() * S), Math.floor(r() * S), '#f3eee2');
  const t = p.texture(true);
  return t;
}

/** Face decal size in texture px (48 px per world unit), and the height of its top edge on the rice. */
export const FACE = { w: 48, h: 22, top: 1.975 };
export type FaceMode = 'sleep' | 'blink' | 'open' | 'happy';

/** The big onigiri's face, drawn with the buddy's own dot eyes, toothy grin and blush dots. */
const FACE_SPEC: BuddySpec = { ...CAST.oni, body: { ...CAST.oni.body, w: 48, h: 44 }, eyes: { gap: 17, r: 2.8 }, mouth: { w: 14 } };

/** Face decal: sleeping (in the wrapper), blinking, wide awake or beaming. */
export function faceArt(mode: FaceMode): Painter {
  const p = new Painter(FACE.w, FACE.h);
  const cx = FACE.w / 2;
  const eyes: EyeStyle = mode === 'open' ? 'dot' : mode === 'happy' ? 'happy' : 'closed';
  const mouth: MouthStyle = mode === 'sleep' ? 'smile' : mode === 'happy' ? 'open' : 'grin';
  const blush = CAST.oni.blush ?? '#ffb0b8';
  p.ellipse(cx - 15.5, 11, 3.6, 2.4, blush);
  p.ellipse(cx + 15.5, 11, 3.6, 2.4, blush);
  const e = drawEyes(FACE_SPEC, eyes).toCanvas();
  p.blit(e, Math.round(cx - e.width / 2), Math.round(6 - e.height / 2));
  const m = drawMouth(FACE_SPEC, mouth).toCanvas();
  p.blit(m, Math.round(cx - m.width / 2), 9);
  return p;
}

/** "z" bubble for the sleeping onigiri. */
export function zzzArt(): Painter {
  const p = new Painter(9, 9);
  p.text('Z', 2, 1, { font: FONT_BIG, color: '#ffffff', outline: '#5b6bb0' });
  return p;
}

/** Wooden serving board (top face). */
export function woodTop(w: number, h: number): Painter {
  const p = new Painter(w, h);
  p.clear('#e9c78f');
  const r = rng(5);
  for (let y = 0; y < h; y += 11) {
    p.rect(0, y, w, 1, '#c99a5c');
    for (let i = 0; i < 6; i++) {
      const gx = Math.floor(r() * w);
      p.rect(gx, y + 3 + Math.floor(r() * 6), 6 + Math.floor(r() * 10), 1, '#dcb477');
    }
  }
  for (let i = 0; i < 3; i++) {
    const kx = Math.floor(r() * (w - 8)) + 4;
    const ky = Math.floor(r() * (h - 8)) + 4;
    p.ellipse(kx, ky, 2.5, 1.5, '#b98548').px(kx, ky, '#8f6230');
  }
  p.rect(0, 0, w, 1, '#f5dcae');
  return p;
}

export function woodSide(w: number, h: number): Painter {
  const p = new Painter(w, h);
  p.clear('#cf9f62');
  p.rect(0, 0, w, 1, '#f0d29f');
  p.rect(0, h - 1, w, 1, '#a8773e');
  for (let x = 3; x < w; x += 7) p.rect(x, 1, 3, 1, '#bf8d50');
  return p;
}

/** Bamboo leaf decal (alpha). */
export function leafArt(): Painter {
  const w = 72;
  const h = 18;
  const p = new Painter(w, h);
  const pts: Pt[] = [];
  for (let i = 0; i <= 18; i++) {
    const u = i / 18;
    pts.push([1 + u * (w - 2), h / 2 - Math.pow(Math.sin(Math.PI * u), 0.75) * (h / 2 - 1.5)]);
  }
  for (let i = 18; i >= 0; i--) {
    const u = i / 18;
    pts.push([1 + u * (w - 2), h / 2 + Math.pow(Math.sin(Math.PI * u), 0.75) * (h / 2 - 1.5)]);
  }
  p.poly(pts, '#4caf50');
  p.poly(pts.slice(0, 19).map(([x, y]) => [x, y + 2] as Pt).concat(pts.slice(0, 19).reverse().map(([x]) => [x, h / 2] as Pt)), '#66c466');
  p.rect(3, Math.floor(h / 2), w - 6, 1, '#2e7d32');
  for (let x = 10; x < w - 8; x += 9) {
    p.line(x, h / 2 - 1, x + 4, h / 2 - 5, '#3f9a43');
    p.line(x, h / 2 + 1, x + 4, h / 2 + 5, '#3f9a43');
  }
  p.outline('#1f5a24');
  return p;
}

// -------------------------------------------------------------------------------------------------
// Shelf model: the wrapped onigiri baked into one opaque front texture.

export function bakedFront(f: Flavor, qrSize = 25): Painter {
  const p = new Painter(filmW, filmH);
  const sil = oniOutline(0);
  p.poly(toPx(sil), RICE);
  const r = rng(3);
  for (let i = 0; i < 220; i++) {
    const x = Math.floor(r() * filmW);
    const y = Math.floor(r() * filmH);
    p.rect(x, y, 2, 1, '#ebe4d2');
  }
  clipTo(p, sil);
  // nori square
  const S = ONI.codeS;
  const m = S / (qrSize + 4);
  const n0 = -S / 2 + 2 * m;
  const n1 = S / 2 - 2 * m;
  const yb = ONI.codeBottom + 2 * m;
  p.rect(fx(n0), fy(yb + (n1 - n0)), (n1 - n0) * FILM.PX, (n1 - n0) * FILM.PX, NORI);
  p.dither(fx(n0), fy(yb + (n1 - n0)), (n1 - n0) * FILM.PX, (n1 - n0) * FILM.PX, '#2b3d2f', 0.2);
  // sleeping face
  const face = faceArt('sleep');
  p.blit(face, fx(0) - face.w / 2, fy(FACE.top));
  p.blit(filmFront(f), 0, 0);
  const strip = stripArt(2.35, 0.2);
  p.blit(strip, fx(0) - strip.w / 2, fy(2.37));
  // opaque everywhere the film is
  p.hardenAlpha(8);
  return p;
}

// -------------------------------------------------------------------------------------------------
// Poster art

/** Poster canvas; the code square (with quiet zone) sits on the bottom of the rice triangle. */
export const POSTER = { w: 144, h: 184, base: 158, codeX: 45, codeY: 100, codeSize: 54 };

/** Poster: the unwrapped onigiri with its nori code, logo and flavour banner. Code region reserved. */
export function posterArt(f: Flavor): Painter {
  const { w, h } = POSTER;
  const p = new Painter(w, h);
  // background: soft seigaiha waves
  p.clear('#fff3e4');
  const tile = new Painter(16, 16);
  for (const [tx, ty] of [[8, 8], [0, 16], [16, 16], [0, 0], [16, 0]] as Pt[]) {
    tile.ring(tx, ty, 7, '#ffe2cf', 1);
    tile.ring(tx, ty, 4, '#ffe8da', 1);
  }
  for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) p.blit(tile, x, y);
  // top logo band
  p.rect(0, 0, w, 30, f.c.main);
  p.rect(0, 30, w, 2, INK);
  for (let x = 0; x < w; x += 12) p.rect(x, 26, 6, 4, f.c.dark);
  p.text('ONIGIRI', w / 2 - 20, 5, { font: FONT_BIG, scale: 2, bold: true, color: '#ffffff', outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });
  p.text('QR', w - 24, 4, { font: FONT_BIG, scale: 3, bold: true, color: f.c.accent, outline: INK, shadow: INK, shadowOffset: [0, 2], align: 'center' });

  // onigiri triangle
  const base = POSTER.base;
  const tw = 138;
  const th = 124;
  const tri = roundedPolygon([[w / 2 - tw / 2, base], [w / 2 + tw / 2, base], [w / 2, base - th]], [14, 14, 20], 6);
  const shadow = tri.map(([x, y]) => [x + 3, y + 3] as Pt);
  p.poly(shadow, 'rgba(90,60,40,0.25)');
  const rice = new Painter(w, h);
  rice.poly(tri, RICE);
  const r = rng(21);
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(r() * w);
    const y = Math.floor(r() * h);
    if (r() < 0.5) rice.rect(x, y, 3, 1, '#ebe4d2');
    else rice.rect(x, y, 1, 2, '#ebe4d2');
  }
  const mask = new Painter(w, h);
  mask.poly(tri, '#fff');
  rice.ctx.globalCompositeOperation = 'destination-in';
  rice.ctx.drawImage(mask.canvas, 0, 0);
  rice.ctx.globalCompositeOperation = 'source-over';
  rice.outline(INK);
  p.blit(rice, 0, 0);
  // filling on top
  p.ellipse(w / 2, base - th + 16, 9, 4, INK);
  p.ellipse(w / 2, base - th + 15.5, 8, 3.2, f.c.fill);
  p.px(w / 2 - 3, base - th + 15, f.c.fillDark).px(w / 2 + 2, base - th + 14, f.c.fillDark).px(w / 2 + 4, base - th + 16, f.c.fillDark);

  // code square region (rice) sits on the bottom of the triangle
  // face above the code
  const face = faceArt('open');
  p.blit(face, w / 2 - face.w / 2, POSTER.codeY - 22);

  // two onigiri buddies cheering either side of the code
  const left = oniArt(0.62, { armL: 2.6, armR: 2.6, eyes: 'happy', mouth: 'open' });
  p.blit(left, Math.min(POSTER.codeX - 3 - left.w, 3), 162 - left.h);
  const right = oniArt(0.62, { armL: 0.6, armR: 2.5 });
  p.blit(right, Math.max(POSTER.codeX + POSTER.codeSize + 3, w - 3 - right.w), 162 - right.h);

  // bottom banner with flavour + 1-2-3
  p.rect(0, 163, w, h - 163, f.c.main);
  p.rect(0, 163, w, 1, INK);
  p.text(f.name.toUpperCase(), 6, 167, { font: FONT_BIG, bold: true, color: '#ffffff', outline: INK });
  ['1', '2', '3'].forEach((n, i) => {
    const bx = w - 40 + i * 13;
    p.disc(bx, 171, 5.5, INK);
    p.disc(bx, 171, 4.5, '#e8233a');
    p.text(n, bx + 1, 168, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  });
  p.text('FREE', 6, 177, { font: FONT_TINY, color: f.c.accent });
  p.text('FRESH TODAY', w - 6, 177, { font: FONT_TINY, color: '#ffffff', align: 'right' });
  return p;
}
