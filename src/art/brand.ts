import { Bitmap, Mask, capsule, ellipse, hex, roundRect } from './pixel';

/** Xolotl Kobini brand: a minimal pink-and-white axolotl mark. */

export const BRAND = {
  name: 'Xolotl Kobini',
  pink: '#f47c9f',
  pinkDark: '#d95a82',
  white: '#ffffff',
  cream: '#fff6ef',
};

/**
 * The axolotl head mark. `size` is the badge size in px. With `badge` the head sits white on a
 * pink rounded square; without it the head is pink on transparent.
 */
export function drawLogo(size = 32, o: { badge?: boolean; round?: boolean } = {}): Bitmap {
  const badge = o.badge ?? true;
  const S = size;
  const b = new Bitmap(S, S);
  const k = S / 32;
  const pink = hex(BRAND.pink);
  const white = hex(BRAND.white);
  const fg = badge ? white : pink;
  const hole = badge ? pink : ([0, 0, 0] as [number, number, number]);
  if (badge) {
    const bg = o.round ? ellipse(S, S, S / 2, S / 2, S / 2, S / 2) : roundRect(S, S, 0, 0, S, S, 7 * k);
    b.paint(bg, pink);
  }
  const head = new Mask(S, S);
  head.union(ellipse(S, S, 16 * k, 18.5 * k, 9.5 * k, 7.2 * k));
  // three gill fronds on each side, fanning up and out
  const fronds: [number, number, number, number][] = [
    [8.2, 15.5, 3.2, 9.8],
    [7.4, 18.2, 2.6, 16.8],
    [8.4, 21.2, 3.4, 23.4],
  ];
  for (const [x0, y0, x1, y1] of fronds) {
    head.union(capsule(S, S, x0 * k, y0 * k, x1 * k, y1 * k, 1.35 * k));
    head.union(capsule(S, S, (32 - x0) * k, y0 * k, (32 - x1) * k, y1 * k, 1.35 * k));
  }
  b.paint(head, fg);
  // face: eyes and a tiny smile in the background colour
  const face = new Mask(S, S);
  face.union(ellipse(S, S, 12.4 * k, 17.6 * k, 1.35 * k, 1.5 * k));
  face.union(ellipse(S, S, 19.6 * k, 17.6 * k, 1.35 * k, 1.5 * k));
  for (let x = -2.2; x <= 2.2; x += 0.25) {
    const y = 21.2 + (1 - (x / 2.2) ** 2) * 1.0;
    face.set(Math.round((16 + x) * k - 0.5), Math.round(y * k - 0.5));
  }
  if (badge) b.paint(face, hole);
  else for (let i = 0; i < face.m.length; i++) if (face.m[i]) b.clearPx(i % S, (i / S) | 0);
  return b;
}

export function logoDataURL(size = 64, badge = true) {
  return drawLogo(size, { badge }).toCanvas().toDataURL('image/png');
}
