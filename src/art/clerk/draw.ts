import { Bitmap, Mask, hex, mixRGB, type RGB } from '../pixel';

/**
 * Painting kit for the clerk: every part is drawn into a shared "composition" canvas (so the rest
 * pose lines up exactly), optionally through a local frame (origin + angle) so rotated pieces like
 * the arm can be drawn axis-aligned. Flat buddy-style shading: base fill, hard lower-right shade
 * crescent, top-left light rim, small highlight, 2px ink outline.
 */

export const INK: RGB = hex('#221a1f');

export interface Pal {
  deep: RGB;
  shade: RGB;
  base: RGB;
  light: RGB;
  hi: RGB;
}

const pal = (deep: string, shade: string, base: string, light: string, hi: string): Pal => ({
  deep: hex(deep),
  shade: hex(shade),
  base: hex(base),
  light: hex(light),
  hi: hex(hi),
});

export const BLUE = pal('#33475a', '#48657c', '#5e7e96', '#86a3b8', '#b8cedb');
export const BELLY = pal('#28384a', '#33475a', '#3f5870', '#56738b', '#7e9bb0');
export const RED = pal('#6e1f2b', '#9c2f39', '#c9444b', '#e46e68', '#f7a08e');
export const METAL = pal('#4b4f58', '#6b6f78', '#8d9198', '#b9bdc3', '#eef0f3');
export const STEEL = pal('#505865', '#737d8c', '#9aa4b2', '#c9d1db', '#f4f7fa');
export const SKIN = pal('#d98c8c', '#eba7a0', '#f7d8c6', '#fff0e6', '#ffffff');
export const GILL = pal('#b24470', '#d9608a', '#f28aa8', '#ffb3c8', '#ffe0ea');
export const HAZ_BLUE = pal('#233d68', '#2f5391', '#3f6fb8', '#6b95d6', '#a9c6f0');
export const WHITE = pal('#8e97a6', '#c9cfd8', '#eef0ea', '#fbfbf6', '#ffffff');

export const MOUTH_DARK: RGB = hex('#3a1220');
export const MOUTH: RGB = hex('#8f2436');
export const TONGUE: RGB = hex('#f07a8c');
export const TONGUE_LIGHT: RGB = hex('#ffa3b1');
export const BLUSH: RGB = hex('#f59aaa');
export const TOOTH: RGB = hex('#fff6e4');
export const LENS: RGB = hex('#16202e');
export const LENS_GLOW: RGB = hex('#5fe0ff');

export type Test = (x: number, y: number) => boolean;
export type Pt = [number, number];

// ---- shape tests in local coordinates

export const T = {
  ellipse:
    (cx: number, cy: number, rx: number, ry: number): Test =>
    (x, y) =>
      ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1,
  circle:
    (cx: number, cy: number, r: number): Test =>
    (x, y) =>
      (x - cx) ** 2 + (y - cy) ** 2 <= r * r,
  rect:
    (x0: number, y0: number, w: number, h: number): Test =>
    (x, y) =>
      x >= x0 && x <= x0 + w && y >= y0 && y <= y0 + h,
  roundRect:
    (x0: number, y0: number, w: number, h: number, r: number): Test =>
    (x, y) => {
      if (x < x0 || x > x0 + w || y < y0 || y > y0 + h) return false;
      const cx = Math.max(x0 + r, Math.min(x0 + w - r, x));
      const cy = Math.max(y0 + r, Math.min(y0 + h - r, y));
      return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
    },
  poly:
    (pts: Pt[]): Test =>
    (x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    },
  capsule: (x0: number, y0: number, x1: number, y1: number, r: number): Test => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1;
    return (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2));
      return (x - x0 - dx * t) ** 2 + (y - y0 - dy * t) ** 2 <= r * r;
    };
  },
  /** Ellipse rotated by `deg` (clockwise on screen). */
  rotEllipse: (cx: number, cy: number, rx: number, ry: number, deg: number): Test => {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const u = dx * c + dy * s;
      const v = -dx * s + dy * c;
      return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
    };
  },
};

/** Quadratic bezier sampled into points (inclusive of both ends). */
export function qb(p0: Pt, p1: Pt, p2: Pt, n = 10): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    out.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]);
  }
  return out;
}

/** Smooth closed curve through control points (Catmull-Rom), as a polygon. */
export function smooth(pts: Pt[], samples = 8): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let s = 0; s < samples; s++) {
      const t = s / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

export interface Cut {
  bmp: Bitmap;
  /** Top-left of the cropped bitmap in the canvas it was drawn in. */
  ox: number;
  oy: number;
}

/**
 * One sprite being painted. Coordinates are canvas pixels unless a local frame is set. The bitmap
 * only covers `win` (x0, y0, x1, y1 in canvas pixels) so rasterising stays cheap; masks live in
 * that window.
 */
export class Part {
  readonly b: Bitmap;
  readonly w: number;
  readonly h: number;
  /** Canvas position of the window's top-left pixel. */
  readonly wx: number;
  readonly wy: number;
  private ox = 0;
  private oy = 0;
  private c = 1;
  private s = 0;

  constructor(w: number, h: number, win?: [number, number, number, number]) {
    const x0 = win ? Math.max(0, Math.floor(win[0])) : 0;
    const y0 = win ? Math.max(0, Math.floor(win[1])) : 0;
    const x1 = win ? Math.min(w, Math.ceil(win[2])) : w;
    const y1 = win ? Math.min(h, Math.ceil(win[3])) : h;
    this.wx = x0;
    this.wy = y0;
    this.w = x1 - x0;
    this.h = y1 - y0;
    this.b = new Bitmap(this.w, this.h);
  }

  /** Draw subsequent shapes in a local frame: origin (ox, oy), rotated `deg` clockwise. */
  frame(ox = 0, oy = 0, deg = 0) {
    this.ox = ox;
    this.oy = oy;
    this.c = Math.cos((deg * Math.PI) / 180);
    this.s = Math.sin((deg * Math.PI) / 180);
    return this;
  }

  /** Local → canvas. */
  at(lx: number, ly: number): Pt {
    return [this.ox + lx * this.c - ly * this.s, this.oy + lx * this.s + ly * this.c];
  }

  /** Rasterise a test (in local coordinates) at pixel centres. */
  M(test: Test): Mask {
    const m = new Mask(this.w, this.h);
    const { c, s } = this;
    const bx = this.wx + 0.5 - this.ox;
    const by = this.wy + 0.5 - this.oy;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const X = x + bx;
        const Y = y + by;
        if (test(X * c + Y * s, -X * s + Y * c)) m.m[y * this.w + x] = 1;
      }
    return m;
  }

  /** Polygon (local coordinates) rasterised by scanlines, even-odd rule, at pixel centres. */
  polyMask(pts: Pt[]): Mask {
    const m = new Mask(this.w, this.h);
    const P = pts.map(([x, y]) => this.at(x, y));
    const xs: number[] = [];
    for (let y = 0; y < this.h; y++) {
      const cy = y + this.wy + 0.5;
      xs.length = 0;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const [xi, yi] = P[i];
        const [xj, yj] = P[j];
        if (yi > cy !== yj > cy) xs.push(xi + ((cy - yi) * (xj - xi)) / (yj - yi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, Math.floor(xs[k] - this.wx - 0.5) + 1);
        const b = Math.min(this.w - 1, Math.ceil(xs[k + 1] - this.wx - 0.5) - 1);
        for (let x = a; x <= b; x++) m.m[y * this.w + x] = 1;
      }
    }
    return m;
  }

  /** Is canvas pixel (x, y) set in a mask of this part? */
  has(m: Mask, x: number, y: number) {
    return m.get(Math.floor(x) - this.wx, Math.floor(y) - this.wy) === 1;
  }

  /** Visit every set pixel of a mask with its canvas pixel coordinates. */
  each(m: Mask, fn: (x: number, y: number) => void) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (m.m[y * this.w + x]) fn(x + this.wx, y + this.wy);
  }

  /** Blit a bitmap with its top-left at canvas pixel (x, y). */
  blit(src: Bitmap, x: number, y: number) {
    this.b.blit(src, Math.round(x) - this.wx, Math.round(y) - this.wy);
    return this;
  }

  empty() {
    return new Mask(this.w, this.h);
  }

  /** Mask of everything painted so far. */
  painted() {
    return this.b.opaque();
  }

  fill(m: Mask, c: RGB) {
    this.b.paint(m, c);
    return m;
  }

  /** Pixels of `m` whose neighbour at (dx, dy) — in canvas space — falls outside `m`. */
  rim(m: Mask, dx: number, dy: number) {
    const out = new Mask(this.w, this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) if (m.m[y * this.w + x] && !m.get(x + dx, y + dy)) out.m[y * this.w + x] = 1;
    return out;
  }

  /**
   * Buddy-style flat shading: base, lower-right shade crescent (`s` px), a thinner deep crescent,
   * a top-left light rim (`l` px) and an optional highlight mask.
   */
  shade(m: Mask, p: Pal, o: { s?: number; l?: number; deep?: number; hi?: Mask | null; noLight?: boolean } = {}) {
    const bb = m.bounds();
    if (bb.w <= 0) return m;
    const s = o.s ?? Math.max(2, Math.round(Math.min(bb.w, bb.h) * 0.14));
    const l = o.l ?? 1;
    this.fill(m, p.base);
    const sh = this.rim(m, s, s);
    this.fill(sh, p.shade);
    if ((o.deep ?? 1) > 0) this.fill(this.rim(m, o.deep ?? 1, o.deep ?? 1).intersect(sh), p.deep);
    if (!o.noLight && l > 0) this.fill(this.rim(m, -l, -l).subtract(sh), p.light);
    if (o.hi) this.fill(o.hi.clone().intersect(m), p.hi);
    return m;
  }

  /** 1px ink along the inside edge of a mask (for panel boundaries between shapes). */
  inkEdge(m: Mask, c: RGB = INK) {
    this.fill(m.edge(), c);
    return m;
  }

  px(x: number, y: number, c: RGB) {
    this.b.set(Math.floor(x) - this.wx, Math.floor(y) - this.wy, c);
    return this;
  }

  /** Pixel line in canvas space (Bresenham), optionally clipped. */
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, clip?: Mask) {
    x0 = Math.round(x0) - this.wx;
    y0 = Math.round(y0) - this.wy;
    x1 = Math.round(x1) - this.wx;
    y1 = Math.round(y1) - this.wy;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (!clip || clip.get(x0, y0)) this.b.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** Line in local coordinates. */
  lineL(x0: number, y0: number, x1: number, y1: number, c: RGB, clip?: Mask) {
    const a = this.at(x0, y0);
    const b = this.at(x1, y1);
    return this.line(a[0] - 0.5, a[1] - 0.5, b[0] - 0.5, b[1] - 0.5, c, clip);
  }

  /** Mix painted pixels inside a mask toward a colour. */
  tint(m: Mask, c: RGB, t: number) {
    for (let i = 0; i < m.m.length; i++) {
      if (!m.m[i]) continue;
      const x = i % this.w;
      const y = (i / this.w) | 0;
      if (this.b.alpha(x, y)) this.b.set(x, y, mixRGB(this.b.get(x, y), c, t));
    }
    return this;
  }

  erase(m: Mask) {
    for (let i = 0; i < m.m.length; i++) if (m.m[i]) this.b.clearPx(i % this.w, (i / this.w) | 0);
    return this;
  }

  /** Two-tone rivet: light top-left pixel, dark bottom-right (canvas coords). */
  rivet(x: number, y: number, p: Pal = METAL, big = false) {
    x = Math.floor(x) - this.wx;
    y = Math.floor(y) - this.wy;
    if (big) {
      this.b.set(x, y, p.hi);
      this.b.set(x + 1, y, p.light);
      this.b.set(x, y + 1, p.light);
      this.b.set(x + 1, y + 1, p.deep);
    } else {
      this.b.set(x, y, p.light);
      this.b.set(x + 1, y + 1, p.deep);
      this.b.set(x + 1, y, p.shade);
      this.b.set(x, y + 1, p.shade);
    }
    return this;
  }

  /**
   * The mech's signature: a big flat X-head screw. Metal disc with a dark rim, bevel light on the
   * top-left, an X slot with a lit lower edge, and a glint. `deg` rotates the slot.
   */
  xScrew(cx: number, cy: number, r: number, o: { deg?: number; ring?: Pal | null; p?: Pal } = {}) {
    const p = o.p ?? METAL;
    const saved = [this.ox, this.oy, this.c, this.s] as const;
    this.frame(0, 0, 0);
    if (o.ring) {
      const ring = this.M(T.circle(cx, cy, r + 2.2));
      this.shade(ring, o.ring, { s: 2, l: 1 });
      this.fill(this.M(T.circle(cx, cy, r + 0.9)), INK);
    }
    const disc = this.M(T.circle(cx, cy, r));
    this.shade(disc, p, { s: Math.max(1, Math.round(r * 0.28)), l: 1, deep: 1 });
    // slot: two crossing bars
    const a = (((o.deg ?? 45) * Math.PI) / 180);
    const len = r * 0.78;
    const th = r >= 5 ? 1.25 : 0.8;
    const slot = this.empty();
    for (const k of [0, 1]) {
      const ang = a + (k * Math.PI) / 2;
      const dx = Math.cos(ang) * len;
      const dy = Math.sin(ang) * len;
      slot.union(this.M(T.capsule(cx - dx, cy - dy, cx + dx, cy + dy, th)));
    }
    slot.intersect(disc.erode());
    this.fill(slot, p.deep);
    // lit lower edge of the slot (bevel)
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) if (slot.get(x, y) && !slot.get(x, y + 1) && disc.get(x, y + 1)) this.b.set(x, y + 1, p.light);
    this.fill(this.M(T.circle(cx, cy, 0.9)), INK);
    // glint
    this.px(cx - r * 0.55, cy - r * 0.62, p.hi);
    if (r >= 5) this.px(cx - r * 0.55 + 1, cy - r * 0.62, p.hi);
    this.frame(saved[0], saved[1], 0);
    this.c = saved[2];
    this.s = saved[3];
    return disc;
  }

  /** Thick ink outline around everything painted, then crop to the opaque box. */
  cut(thick = 2): Cut {
    for (let i = 0; i < thick; i++) this.b.outline(INK, i > 0);
    return this.cutRaw();
  }

  /** Crop without adding an outline (warns when the window was too small). */
  cutRaw(): Cut {
    const c = crop(this.b);
    if (c.ox === 0 || c.oy === 0 || c.ox + c.bmp.w === this.w || c.oy + c.bmp.h === this.h) console.warn('clerk sprite touches its drawing window', this.wx, this.wy, this.w, this.h);
    c.ox += this.wx;
    c.oy += this.wy;
    return c;
  }
}

export function crop(b: Bitmap): Cut {
  const m = b.opaque().bounds();
  if (m.w <= 0) return { bmp: new Bitmap(1, 1), ox: 0, oy: 0 };
  const out = new Bitmap(m.w, m.h);
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const i = ((y + m.y0) * b.w + x + m.x0) * 4;
      if (b.data[i + 3]) out.set(x, y, [b.data[i], b.data[i + 1], b.data[i + 2]], b.data[i + 3]);
    }
  return { bmp: out, ox: m.x0, oy: m.y0 };
}
