import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { makeQR, KIND_FINDER, KIND_TIMING, KIND_ALIGNMENT, KIND_DATA, pickMode, type QRMatrix } from '../src/qr/qr';
import { contactPayload, detectLinkKind, normalizeUrl, wifiPayload, describePayload } from '../src/qr/payload';
import {
  decodePixelArt,
  encodePixelArt,
  extractPixelHash,
  medianCut,
  packPixelArt,
  pixelArtUrl,
  unpackPixelArt,
  type PixelArt,
} from '../src/qr/pixelCodec';

function rasterize(qr: QRMatrix, m = 4, quiet = 4) {
  const n = (qr.size + quiet * 2) * m;
  const data = new Uint8ClampedArray(n * n * 4).fill(255);
  for (let r = 0; r < qr.size; r++)
    for (let c = 0; c < qr.size; c++) {
      if (!qr.isDark(r, c)) continue;
      for (let y = 0; y < m; y++)
        for (let x = 0; x < m; x++) {
          const i = (((r + quiet) * m + y) * n + (c + quiet) * m + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
    }
  return { data, n };
}

function decode(qr: QRMatrix) {
  const { data, n } = rasterize(qr);
  return jsQR(data, n, n)?.data ?? null;
}

describe('makeQR', () => {
  it('encodes a link that decodes back to the same text', () => {
    const qr = makeQR('https://example.com/hello?x=1');
    expect(qr.size).toBe(17 + 4 * qr.version);
    expect(decode(qr)).toBe('https://example.com/hello?x=1');
  });

  it('handles UTF-8 text (Thai + emoji)', () => {
    const text = 'สวัสดี QR Market ✨';
    const qr = makeQR(text, 'Q');
    expect(decode(qr)).toBe(text);
  });

  it('picks compact modes', () => {
    expect(pickMode('0123456789')).toBe('Numeric');
    expect(pickMode('HELLO WORLD')).toBe('Alphanumeric');
    expect(pickMode('hello')).toBe('Byte');
    expect(decode(makeQR('HELLO WORLD 123'))).toBe('HELLO WORLD 123');
  });

  it('labels function patterns', () => {
    const qr = makeQR('https://example.com/a-longer-link-to-force-version-2-or-more');
    expect(qr.version).toBeGreaterThanOrEqual(2);
    expect(qr.kindAt(0, 0)).toBe(KIND_FINDER);
    expect(qr.kindAt(3, qr.size - 4)).toBe(KIND_FINDER);
    expect(qr.kindAt(qr.size - 1, 6)).toBe(KIND_FINDER);
    expect(qr.kindAt(6, 10)).toBe(KIND_TIMING);
    const a = qr.size - 7;
    expect(qr.kindAt(a, a)).toBe(KIND_ALIGNMENT);
    expect(qr.isDark(a, a)).toBe(true);
    expect(qr.inFinder(2, 2)).toBe(true);
    expect(qr.inFinder(10, 10)).toBe(false);
    let data = 0;
    for (let i = 0; i < qr.size * qr.size; i++) if (qr.kind[i] === KIND_DATA) data++;
    expect(data).toBeGreaterThan(qr.size * qr.size * 0.5);
  });

  it('throws a friendly error when the data is too long', () => {
    expect(() => makeQR('x'.repeat(5000), 'H')).toThrow(/too much data/);
  });
});

describe('payloads', () => {
  it('normalizes bare domains', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl('  https://a.b/c ')).toBe('https://a.b/c');
    expect(normalizeUrl('mailto:hi@x.com')).toBe('mailto:hi@x.com');
    expect(normalizeUrl('just words')).toBe('just words');
  });

  it('escapes Wi-Fi fields', () => {
    expect(wifiPayload({ ssid: 'My;Net', password: 'p:a,ss', security: 'WPA' })).toBe('WIFI:T:WPA;S:My\\;Net;P:p\\:a\\,ss;;');
    expect(wifiPayload({ ssid: 'Open', password: '', security: 'nopass', hidden: true })).toBe('WIFI:T:nopass;S:Open;H:true;;');
    expect(describePayload(wifiPayload({ ssid: 'Cafe;1', password: 'x', security: 'WPA' }))).toBe('Wi-Fi: Cafe;1');
  });

  it('builds a vCard', () => {
    const v = contactPayload({ name: 'Somchai Jaidee', phone: '+66 81 234 5678', email: 'a@b.co' });
    expect(v).toContain('N:Jaidee;Somchai;;;');
    expect(v).toContain('TEL;TYPE=CELL:+66812345678');
    expect(v.startsWith('BEGIN:VCARD')).toBe(true);
  });

  it('detects link kinds', () => {
    expect(detectLinkKind('https://youtu.be/abc')).toBe('youtube');
    expect(detectLinkKind('https://www.tiktok.com/@x/video/1')).toBe('tiktok');
    expect(detectLinkKind('https://line.me/ti/p/abc')).toBe('line');
    expect(detectLinkKind('https://cdn.site/clip.mp4')).toBe('video');
    expect(detectLinkKind('https://example.com')).toBe('web');
  });
});

function sampleArt(frames = 1, n = 8, size = 24): PixelArt {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const palette: [number, number, number][] = [];
  for (let i = 0; i < n; i++) palette.push([Math.floor(rnd() * 256), Math.floor(rnd() * 256), Math.floor(rnd() * 256)]);
  const fr: Uint8Array[] = [];
  for (let f = 0; f < frames; f++) {
    const a = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) a[y * size + x] = ((x >> 2) + (y >> 2) + f) % n;
    fr.push(a);
  }
  return { w: size, h: size, palette, frames: fr, delay: frames > 1 ? 250 : 0, caption: frames > 1 ? 'สวัสดี!' : '' };
}

describe('pixel codec', () => {
  it('packs and unpacks losslessly', () => {
    const art = sampleArt(3, 5, 20);
    const back = unpackPixelArt(packPixelArt(art));
    expect(back.w).toBe(20);
    expect(back.palette).toEqual(art.palette);
    expect(back.frames.map((f) => Array.from(f))).toEqual(art.frames.map((f) => Array.from(f)));
    expect(back.delay).toBe(250);
    expect(back.caption).toBe('สวัสดี!');
  });

  it('round-trips through the compressed string form', async () => {
    const art = sampleArt(6, 8, 16);
    const s = await encodePixelArt(art);
    expect(/^[zr][A-Za-z0-9_-]+$/.test(s)).toBe(true);
    const back = await decodePixelArt(s);
    expect(back.frames.map((f) => Array.from(f))).toEqual(art.frames.map((f) => Array.from(f)));
  });

  it('fits a 24x24 postcard into a scannable QR and reads it back', async () => {
    const art = sampleArt(1, 8, 24);
    const url = await pixelArtUrl(art, 'https://pukkingdragon123.github.io/glowing-octo-chainsaw/');
    const qr = makeQR(url, 'L');
    expect(qr.version).toBeLessThanOrEqual(20);
    const text = decode(qr);
    expect(text).toBe(url);
    const back = await decodePixelArt(extractPixelHash(text!)!);
    expect(Array.from(back.frames[0])).toEqual(Array.from(art.frames[0]));
  });

  it('median cut finds distinct colours', () => {
    const px: [number, number, number][] = [];
    for (let i = 0; i < 50; i++) px.push([250, 10, 10], [10, 250, 10], [10, 10, 250]);
    const pal = medianCut(px, 3);
    expect(pal.length).toBe(3);
    expect(pal.some(([r]) => r > 200)).toBe(true);
    expect(pal.some(([, g]) => g > 200)).toBe(true);
    expect(pal.some(([, , b]) => b > 200)).toBe(true);
  });
});
