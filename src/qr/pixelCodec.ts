/**
 * Pixel Postcards & Flipbooks: a tiny picture (or a few video frames) is quantised to a small palette,
 * bit-packed, deflated and stored in the link's #fragment. The QR code carries the picture itself;
 * nothing is uploaded anywhere.
 *
 * Layout (bytes): [ver=1][flags][w][h][frames][delay/10ms][paletteSize] [palette rgb * n]
 *                 [bit-packed indices, frames after the first XOR'd with the previous frame]
 *                 [captionLength][caption utf-8]
 * Encoded as 'z' + base64url(deflate-raw(bytes)) or 'r' + base64url(bytes), whichever is shorter.
 */

export interface PixelArt {
  w: number;
  h: number;
  palette: [number, number, number][];
  frames: Uint8Array[];
  /** Milliseconds per frame (animations only). */
  delay: number;
  caption: string;
}

export const HASH_PREFIX = '#v1.';
export const MAX_SIDE = 64;
export const MAX_FRAMES = 24;

class BitWriter {
  bytes: number[] = [];
  private cur = 0;
  private n = 0;
  write(value: number, bits: number) {
    for (let i = bits - 1; i >= 0; i--) {
      this.cur = (this.cur << 1) | ((value >> i) & 1);
      this.n++;
      if (this.n === 8) {
        this.bytes.push(this.cur);
        this.cur = 0;
        this.n = 0;
      }
    }
  }
  flush() {
    if (this.n > 0) {
      this.bytes.push(this.cur << (8 - this.n));
      this.cur = 0;
      this.n = 0;
    }
    return this.bytes;
  }
}

class BitReader {
  private pos = 0;
  private bit = 0;
  constructor(private data: Uint8Array, start: number) {
    this.pos = start;
  }
  read(bits: number) {
    let v = 0;
    for (let i = 0; i < bits; i++) {
      if (this.pos >= this.data.length) throw new Error('Postcard data is cut off.');
      const b = (this.data[this.pos] >> (7 - this.bit)) & 1;
      v = (v << 1) | b;
      this.bit++;
      if (this.bit === 8) {
        this.bit = 0;
        this.pos++;
      }
    }
    return v;
  }
  get byteOffset() {
    return this.bit === 0 ? this.pos : this.pos + 1;
  }
}

export function bitsFor(paletteSize: number) {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, paletteSize))));
}

export function packPixelArt(art: PixelArt): Uint8Array {
  const n = art.palette.length;
  if (n < 1 || n > 16) throw new Error('Palette must have 1-16 colours.');
  if (art.w < 1 || art.h < 1 || art.w > MAX_SIDE || art.h > MAX_SIDE) throw new Error('Picture is too big.');
  if (art.frames.length < 1 || art.frames.length > MAX_FRAMES) throw new Error('Too many frames.');
  const caption = new TextEncoder().encode(art.caption.slice(0, 80));
  const header = [1, caption.length ? 2 : 0, art.w, art.h, art.frames.length, Math.min(255, Math.round(art.delay / 10)), n];
  for (const [r, g, b] of art.palette) header.push(r & 255, g & 255, b & 255);
  const bw = new BitWriter();
  const bpp = bitsFor(n);
  const size = art.w * art.h;
  for (let f = 0; f < art.frames.length; f++) {
    const frame = art.frames[f];
    const prev = f > 0 ? art.frames[f - 1] : null;
    for (let i = 0; i < size; i++) bw.write(prev ? frame[i] ^ prev[i] : frame[i], bpp);
  }
  const body = bw.flush();
  const out = [...header, ...body, caption.length, ...caption];
  return new Uint8Array(out);
}

export function unpackPixelArt(data: Uint8Array): PixelArt {
  if (data.length < 7 || data[0] !== 1) throw new Error('Unknown postcard format.');
  const flags = data[1];
  const w = data[2];
  const h = data[3];
  const frameCount = data[4];
  const delay = data[5] * 10;
  const n = data[6];
  if (!w || !h || !frameCount || !n || n > 16) throw new Error('Postcard header is damaged.');
  const palette: [number, number, number][] = [];
  let p = 7;
  for (let i = 0; i < n; i++) {
    palette.push([data[p], data[p + 1], data[p + 2]]);
    p += 3;
  }
  const br = new BitReader(data, p);
  const bpp = bitsFor(n);
  const frames: Uint8Array[] = [];
  const size = w * h;
  for (let f = 0; f < frameCount; f++) {
    const fr = new Uint8Array(size);
    const prev = f > 0 ? frames[f - 1] : null;
    for (let i = 0; i < size; i++) {
      const v = br.read(bpp);
      fr[i] = (prev ? v ^ prev[i] : v) % n;
    }
    frames.push(fr);
  }
  let caption = '';
  const off = br.byteOffset;
  if (flags & 2 && off < data.length) {
    const len = data[off];
    caption = new TextDecoder().decode(data.slice(off + 1, off + 1 + len));
  }
  return { w, h, palette, frames, delay: delay || 200, caption };
}

// ------------------------------------------------------------------------------------------------
// base64url + deflate

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const blob = new Blob([data as BlobPart]);
  const piped = blob.stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

export async function encodePixelArt(art: PixelArt): Promise<string> {
  const raw = packPixelArt(art);
  let best = 'r' + toBase64Url(raw);
  if (typeof CompressionStream !== 'undefined') {
    try {
      const z = await pipe(raw, new CompressionStream('deflate-raw'));
      const zs = 'z' + toBase64Url(z);
      if (zs.length < best.length) best = zs;
    } catch {
      /* keep raw */
    }
  }
  return best;
}

export async function decodePixelArt(encoded: string): Promise<PixelArt> {
  const kind = encoded[0];
  const bytes = fromBase64Url(encoded.slice(1));
  if (kind === 'r') return unpackPixelArt(bytes);
  if (kind === 'z') {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed postcards.');
    return unpackPixelArt(await pipe(bytes, new DecompressionStream('deflate-raw')));
  }
  throw new Error('Unknown postcard encoding.');
}

// ------------------------------------------------------------------------------------------------
// Colour quantisation (median cut) — works on plain RGBA arrays so it runs in tests too.

type RGB = [number, number, number];

export function medianCut(pixels: RGB[], maxColors: number): RGB[] {
  if (pixels.length === 0) return [[0, 0, 0]];
  // Variance-driven split: always cut the box/channel with the largest squared error, at the mean.
  let boxes: RGB[][] = [pixels];
  while (boxes.length < maxColors) {
    let bestIdx = -1;
    let bestScore = 0;
    let bestChannel = 0;
    let bestMean = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let ch = 0; ch < 3; ch++) {
        let sum = 0;
        for (const p of box) sum += p[ch];
        const mean = sum / box.length;
        let sse = 0;
        for (const p of box) sse += (p[ch] - mean) * (p[ch] - mean);
        const weight = ch === 1 ? 1.2 : ch === 0 ? 1 : 0.8;
        const score = sse * weight;
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
          bestChannel = ch;
          bestMean = mean;
        }
      }
    });
    if (bestIdx < 0 || bestScore === 0) break;
    const left: RGB[] = [];
    const right: RGB[] = [];
    for (const p of boxes[bestIdx]) (p[bestChannel] <= bestMean ? left : right).push(p);
    if (!left.length || !right.length) break;
    boxes.splice(bestIdx, 1, left, right);
  }
  return boxes.map((box) => {
    const sum = [0, 0, 0];
    for (const p of box) {
      sum[0] += p[0];
      sum[1] += p[1];
      sum[2] += p[2];
    }
    return [Math.round(sum[0] / box.length), Math.round(sum[1] / box.length), Math.round(sum[2] / box.length)] as RGB;
  });
}

export function nearestIndex(palette: RGB[], r: number, g: number, b: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i];
    const rm = (pr + r) / 2;
    const dr = pr - r,
      dg = pg - g,
      db = pb - b;
    // "redmean" perceptual distance
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export interface QuantizeOptions {
  colors: number;
  dither?: boolean;
  pop?: boolean;
}

/** Quantise one or more RGBA frames (same size) to a shared palette. */
export function quantizeFrames(frames: Uint8ClampedArray[], w: number, h: number, opts: QuantizeOptions): { palette: RGB[]; frames: Uint8Array[] } {
  const adjusted = frames.map((f) => (opts.pop ? popColors(f) : f));
  const samples: RGB[] = [];
  const stride = Math.max(1, Math.floor((adjusted.length * w * h) / 6000));
  let k = 0;
  for (const f of adjusted)
    for (let i = 0; i < w * h; i++) {
      if (k++ % stride === 0) samples.push([f[i * 4], f[i * 4 + 1], f[i * 4 + 2]]);
    }
  const palette = medianCut(samples, opts.colors);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const out = adjusted.map((f) => {
    const idx = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let r = f[i * 4],
          g = f[i * 4 + 1],
          b = f[i * 4 + 2];
        if (opts.dither) {
          const d = ((bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5) * 40;
          r += d;
          g += d;
          b += d;
        }
        idx[i] = nearestIndex(palette, r, g, b);
      }
    return idx;
  });
  return { palette, frames: out };
}

function popColors(f: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(f.length);
  for (let i = 0; i < f.length; i += 4) {
    const r = f[i],
      g = f[i + 1],
      b = f[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = 1.3;
    const con = 1.1;
    out[i] = ((l + (r - l) * sat - 128) * con + 128) | 0;
    out[i + 1] = ((l + (g - l) * sat - 128) * con + 128) | 0;
    out[i + 2] = ((l + (b - l) * sat - 128) * con + 128) | 0;
    out[i + 3] = 255;
  }
  return out;
}

export function viewerBase(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const configured = env?.VITE_PUBLIC_URL;
  if (configured) return configured.replace(/#.*$/, '');
  if (typeof location === 'undefined') return 'https://qr.market/';
  return location.origin + location.pathname;
}

export async function pixelArtUrl(art: PixelArt, base = viewerBase()): Promise<string> {
  return base + HASH_PREFIX + (await encodePixelArt(art));
}

export function extractPixelHash(urlOrHash: string): string | null {
  const i = urlOrHash.indexOf(HASH_PREFIX);
  if (i < 0) return null;
  return urlOrHash.slice(i + HASH_PREFIX.length);
}
