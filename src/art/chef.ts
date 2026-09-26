import { Bitmap, Mask, blob, capsule, ellipse, hex, mixRGB, poly, prng, ramp, rect, roundRect, type RGB } from './pixel';

/**
 * Procedural pixel-art "chef": builds detailed food sprites from shaded shapes, the way a pixel
 * artist would — every shape gets a height profile, is lit from the top-left and banded into a
 * hand-picked colour ramp with light dithering, then the whole sprite gets a dark ink outline.
 */

export const INK = '#2a1a1d';

export type Form = 'round' | 'soft' | 'flat' | 'cylX' | 'cylY' | 'none';

export interface ShadeOpts {
  /** Height profile of the shape (default 'round'). */
  form?: Form;
  /** Bevel radius in px for 'soft' and 'flat' (default 3 / 2). */
  bevel?: number;
  /** Brightness offset: >0 lighter, <0 darker. */
  bias?: number;
  /** Soften band edges with an ordered dither (default true). */
  dither?: boolean;
  /** Random texture: chance per pixel to step one shade darker or lighter. */
  grain?: number;
  /** Cast a 1px shadow onto layers below, to the bottom-right (default true). */
  shadow?: boolean;
  /** Paint the boundary against lower layers one step darker. */
  rim?: boolean;
  /** Keep the brightest band for highlights only (default true). */
  highlights?: boolean;
  seed?: number;
}

const LIGHT: [number, number, number] = (() => {
  const v: [number, number, number] = [-0.5, -0.62, 0.6];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Height field for a mask given a form. */
function heights(mask: Mask, form: Form, bevel: number): Float32Array {
  const { w, h } = mask;
  const H = new Float32Array(w * h);
  if (form === 'none') return H;
  if (form === 'cylX' || form === 'cylY') {
    const alongX = form === 'cylX';
    // tube: curvature across the short axis only
    const outer = alongX ? w : h;
    const inner = alongX ? h : w;
    for (let o = 0; o < outer; o++) {
      let i = 0;
      while (i < inner) {
        const at = (k: number) => (alongX ? mask.get(o, k) : mask.get(k, o));
        if (!at(i)) {
          i++;
          continue;
        }
        let j = i;
        while (j < inner && at(j)) j++;
        const half = (j - i) / 2;
        for (let k = i; k < j; k++) {
          const d = Math.min(k - i + 0.5, j - k - 0.5);
          const t = Math.min(1, d / half);
          const v = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))) * half;
          if (alongX) H[k * w + o] = v;
          else H[o * w + k] = v;
        }
        i = j;
      }
    }
    return H;
  }
  const d = mask.distance();
  let R = bevel;
  if (form === 'round') {
    R = 0;
    for (let i = 0; i < d.length; i++) R = Math.max(R, d[i]);
    R = Math.max(1, R);
  }
  for (let i = 0; i < d.length; i++) {
    if (!d[i]) continue;
    const t = Math.min(1, d[i] / R);
    H[i] = form === 'flat' ? t * R * 0.7 : Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))) * R;
  }
  return H;
}

export class Chef {
  readonly bmp: Bitmap;
  /** Which layer owns each pixel (-1 empty). */
  private owner: Int16Array;
  private nLayers = 0;
  private rand: () => number;

  constructor(readonly w: number, readonly h: number, seed = 7) {
    this.bmp = new Bitmap(w, h);
    this.owner = new Int16Array(w * h).fill(-1);
    this.rand = prng(seed);
  }

  // shape helpers sized to this sprite
  ellipse(cx: number, cy: number, rx: number, ry: number) {
    return ellipse(this.w, this.h, cx, cy, rx, ry);
  }
  circle(cx: number, cy: number, r: number) {
    return ellipse(this.w, this.h, cx, cy, r, r);
  }
  rect(x: number, y: number, w: number, h: number) {
    return rect(this.w, this.h, x, y, w, h);
  }
  roundRect(x: number, y: number, w: number, h: number, r: number) {
    return roundRect(this.w, this.h, x, y, w, h, r);
  }
  poly(pts: [number, number][]) {
    return poly(this.w, this.h, pts);
  }
  capsule(x0: number, y0: number, x1: number, y1: number, r: number) {
    return capsule(this.w, this.h, x0, y0, x1, y1, r);
  }
  blob(pts: [number, number][], samples = 8) {
    return blob(this.w, this.h, pts, samples);
  }
  empty() {
    return new Mask(this.w, this.h);
  }
  /** Mask of everything painted so far. */
  painted() {
    return this.bmp.opaque();
  }

  /** Shade a shape with a ramp (dark → light, usually 5 colours) and paint it on top. */
  layer(mask: Mask, colors: RGB[] | string, o: ShadeOpts = {}) {
    const r = typeof colors === 'string' ? ramp(colors) : colors;
    const n = r.length;
    const form = o.form ?? 'round';
    const bevel = o.bevel ?? (form === 'flat' ? 2 : 3);
    const H = heights(mask, form, bevel);
    const { w, h } = this;
    const id = this.nLayers++;
    const rand = o.seed !== undefined ? prng(o.seed) : this.rand;
    const hAt = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h || !mask.m[y * w + x] ? 0 : H[y * w + x]);
    const flat = LIGHT[2];
    const top = o.highlights === false ? n - 1 : n - 1;
    const below = new Mask(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!mask.m[i]) continue;
        if (this.owner[i] >= 0) below.m[i] = 1;
        let nx = (hAt(x - 1, y) - hAt(x + 1, y)) / 2;
        let ny = (hAt(x, y - 1) - hAt(x, y + 1)) / 2;
        let nz = 1;
        const l = Math.hypot(nx, ny, nz);
        nx /= l;
        ny /= l;
        nz /= l;
        let s = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] - flat + (o.bias ?? 0);
        if (o.dither !== false) s += (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 0.09;
        // map to bands around the mid colour
        const mid = Math.floor(n / 2);
        let idx: number;
        if (s > 0.3) idx = top;
        else if (s > 0.1) idx = mid + 1;
        else if (s > -0.16) idx = mid;
        else if (s > -0.42) idx = mid - 1;
        else idx = mid - 2;
        if (o.highlights !== false && idx === top && s < 0.36) idx = Math.min(idx, n - 2);
        if (o.grain && rand() < o.grain) idx += rand() < 0.6 ? -1 : 1;
        idx = Math.max(0, Math.min(n - 1, idx));
        this.bmp.set(x, y, r[idx]);
        this.owner[i] = id;
      }
    if (o.rim) {
      // boundary pixels that sit on a lower layer get one step darker for separation
      const e = mask.edge();
      for (let i = 0; i < e.m.length; i++) {
        if (!e.m[i] || !below.m[i]) continue;
        const x = i % w;
        const y = (i / w) | 0;
        this.bmp.set(x, y, mixRGB(this.bmp.get(x, y), r[0], 0.55));
      }
    }
    if (o.shadow !== false && id > 0) this.castShadow(mask, id);
    return mask;
  }

  /** Flat colour without shading. */
  flat(mask: Mask, color: string | RGB) {
    const c = typeof color === 'string' ? hex(color) : color;
    const id = this.nLayers++;
    for (let i = 0; i < mask.m.length; i++) {
      if (!mask.m[i]) continue;
      this.bmp.set(i % this.w, (i / this.w) | 0, c);
      this.owner[i] = id;
    }
    return mask;
  }

  /** Darken lower layers just below/right of a shape (a soft 1px drop shadow). */
  private castShadow(mask: Mask, id: number) {
    const { w, h } = this;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (mask.m[i] || this.owner[i] < 0 || this.owner[i] === id) continue;
        if (mask.get(x - 1, y - 1) || mask.get(x, y - 1)) {
          this.bmp.set(x, y, mixRGB(this.bmp.get(x, y), [30, 12, 30], 0.35));
        }
      }
  }

  /** Scatter small marks (seeds, chips, sprinkles, crumbs) inside a mask. */
  scatter(
    mask: Mask,
    o: { count: number; colors: string[]; kind?: 'dot' | 'seed' | 'chip' | 'sprinkle' | 'plus'; margin?: number; seed?: number },
  ) {
    const rand = o.seed !== undefined ? prng(o.seed) : this.rand;
    const inner = o.margin ? erodeN(mask, o.margin) : mask;
    const spots: number[] = [];
    for (let i = 0; i < inner.m.length; i++) if (inner.m[i]) spots.push(i);
    if (!spots.length) return;
    const cols = o.colors.map(hex);
    const used = new Set<number>();
    for (let k = 0; k < o.count; k++) {
      let i = spots[(rand() * spots.length) | 0];
      // keep marks from touching each other
      for (let tries = 0; tries < 6 && (used.has(i) || used.has(i + 1) || used.has(i - 1) || used.has(i + this.w) || used.has(i - this.w)); tries++) i = spots[(rand() * spots.length) | 0];
      used.add(i);
      const x = i % this.w;
      const y = (i / this.w) | 0;
      const c = cols[(rand() * cols.length) | 0];
      const kind = o.kind ?? 'dot';
      const put = (px: number, py: number, col = c) => {
        if (mask.get(px, py)) this.bmp.set(px, py, col);
      };
      if (kind === 'dot') put(x, y);
      else if (kind === 'seed') {
        put(x, y);
        put(x + 1, y);
        put(x, y + 1, mixRGB(c, [60, 30, 20], 0.45));
        put(x + 1, y + 1, mixRGB(c, [60, 30, 20], 0.3));
        used.add(i + 1);
      } else if (kind === 'chip') {
        put(x, y, mixRGB(c, [255, 255, 255], 0.2));
        put(x + 1, y);
        put(x, y + 1);
        put(x + 1, y + 1, mixRGB(c, [0, 0, 0], 0.3));
      } else if (kind === 'sprinkle') {
        const dir = (rand() * 4) | 0;
        put(x, y);
        if (dir === 0) put(x + 1, y);
        else if (dir === 1) put(x, y + 1);
        else if (dir === 2) put(x + 1, y + 1);
        else put(x + 1, y - 1);
      } else if (kind === 'plus') {
        put(x, y);
        put(x - 1, y);
        put(x + 1, y);
        put(x, y - 1);
        put(x, y + 1);
      }
    }
  }

  px(x: number, y: number, color: string | RGB) {
    this.bmp.set(Math.round(x), Math.round(y), typeof color === 'string' ? hex(color) : color);
    return this;
  }

  /** Pixel line (Bresenham), optionally clipped to a mask. */
  line(x0: number, y0: number, x1: number, y1: number, color: string | RGB, clip?: Mask) {
    const c = typeof color === 'string' ? hex(color) : color;
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (!clip || clip.get(x0, y0)) this.bmp.set(x0, y0, c);
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

  /** Paint a mask with a colour on top of what's there (no layer bookkeeping). */
  paint(mask: Mask, color: string | RGB) {
    this.bmp.paint(mask, typeof color === 'string' ? hex(color) : color);
    return this;
  }

  /** Tint painted pixels inside a mask toward a colour (glazes, grill marks, bites). */
  tint(mask: Mask, color: string, t: number) {
    const c = hex(color);
    for (let i = 0; i < mask.m.length; i++) {
      if (!mask.m[i]) continue;
      const x = i % this.w;
      const y = (i / this.w) | 0;
      if (this.bmp.alpha(x, y)) this.bmp.set(x, y, mixRGB(this.bmp.get(x, y), c, t));
    }
    return this;
  }

  /** Erase pixels (bites, holes). */
  erase(mask: Mask) {
    for (let i = 0; i < mask.m.length; i++) {
      if (!mask.m[i]) continue;
      this.bmp.clearPx(i % this.w, (i / this.w) | 0);
      this.owner[i] = -1;
    }
    return this;
  }

  /** A short bright glint: the little white specular that makes pixel food look glossy. */
  shine(x: number, y: number, len = 2, color = '#ffffff') {
    const c = hex(color);
    for (let k = 0; k < len; k++) this.bmp.set(x + k, y - k, c);
    return this;
  }

  /** Finish: dark outline around the silhouette. Returns the canvas. */
  done(o: { outline?: string | null; diagonal?: boolean } = {}): HTMLCanvasElement {
    if (o.outline !== null) this.bmp.outline(o.outline ?? INK, o.diagonal ?? false);
    return this.bmp.toCanvas();
  }
}

function erodeN(m: Mask, n: number) {
  let out = m;
  for (let i = 0; i < n; i++) out = out.erode();
  return out;
}

// -------------------------------------------------------------------------------------------------
// Hand-tuned material ramps (dark → light)

export const R = {
  crust: ['#5e2f18', '#98552a', '#c98446', '#e8b36f', '#f8dba5'],
  dough: ['#8a5a32', '#c48a50', '#e2b479', '#f3d5a2', '#fff0d2'],
  pale: ['#9c7a55', '#cfae84', '#ecd4ad', '#faeccd', '#fffaf0'],
  choco: ['#24110d', '#3f1f15', '#62331f', '#8a4f30', '#b0724a'],
  milkChoco: ['#3b1f14', '#633622', '#8e5534', '#b77a4f', '#d9a275'],
  cream: ['#9a91a6', '#cfc8d6', '#efeaec', '#fffaf3', '#ffffff'],
  vanilla: ['#b58a52', '#dcb77a', '#f3dca6', '#fff1cc', '#fffbea'],
  strawberry: ['#5c0d20', '#9e1a31', '#dd3647', '#ff6d68', '#ffa89a'],
  pink: ['#80284f', '#bb4b78', '#ec7ea4', '#ffb0c8', '#ffdfe9'],
  cheese: ['#86540c', '#c78c1a', '#f0bf2d', '#ffe067', '#fff4b3'],
  lettuce: ['#1c4a22', '#2c772b', '#58a93a', '#93d25b', '#cbef8d'],
  tomato: ['#5a1110', '#992216', '#d6412a', '#f47a53', '#ffb18b'],
  meat: ['#2a120e', '#4b2114', '#72361e', '#99532f', '#bc794b'],
  ham: ['#6e2a33', '#a8485a', '#dc7a86', '#f6a8ab', '#ffd6cf'],
  rice: ['#8b879e', '#c2bfce', '#e8e6ee', '#fbfaff', '#ffffff'],
  nori: ['#0c1712', '#182a20', '#284232', '#3b5c47', '#557a60'],
  orange: ['#76300a', '#bb5610', '#ee8a1f', '#ffb64c', '#ffdc8c'],
  lemon: ['#7b5f08', '#c29b10', '#f0cf25', '#fff06a', '#fffbc4'],
  apple: ['#56101a', '#96202a', '#d53a3a', '#f76e5c', '#ffa58a'],
  green: ['#173d23', '#246334', '#3d8f45', '#6fbd5c', '#aee084'],
  mint: ['#1d4d46', '#2f7a6c', '#4fae95', '#86d8b9', '#c4f2dc'],
  grape: ['#2a1640', '#4b2a6e', '#7446a1', '#a071cf', '#cfa8f0'],
  blue: ['#1a2350', '#2c3f86', '#4568c2', '#76a1ea', '#b5d3ff'],
  sky: ['#1f4a6e', '#3278a8', '#58a8d8', '#90d0f2', '#cdeeff'],
  caramel: ['#5c2c0a', '#94501a', '#c9812e', '#eab05a', '#fbd99a'],
  egg: ['#9c6a0a', '#d99a12', '#ffc325', '#ffe06b', '#fff5c2'],
  steel: ['#3a4150', '#626b7c', '#8f98a8', '#bcc4d0', '#e6ebf2'],
  wood: ['#4a2716', '#744024', '#9e6036', '#c4874f', '#e2b27a'],
  purple: ['#3b1a4f', '#5e2d7a', '#8a4aa8', '#b97fd4', '#e2bdf2'],
  red: ['#5a0f16', '#9a1d24', '#d8353a', '#f7695e', '#ffa18e'],
  white: ['#9ea6b8', '#cdd3de', '#eef1f6', '#fbfcff', '#ffffff'],
  paper: ['#a89c86', '#d4c8b0', '#efe6d2', '#fbf6ea', '#ffffff'],
  brown: ['#3d2014', '#643520', '#8c5430', '#b47a4b', '#d7a676'],
  honey: ['#6b3a06', '#a86410', '#dc9722', '#f7c24e', '#ffe396'],
  soda: ['#3a0d0d', '#6b1a14', '#9a2c1c', '#c9502e', '#e98052'],
  matcha: ['#2b4219', '#48662a', '#6f913e', '#9bbb5e', '#c9de8e'],
  teal: ['#12423f', '#1f6b64', '#34998c', '#62c7b3', '#a6ead9'],
} satisfies Record<string, string[]>;

/** Ramp from the table above as RGB arrays. */
export function mat(name: keyof typeof R): RGB[] {
  return R[name].map(hex);
}
