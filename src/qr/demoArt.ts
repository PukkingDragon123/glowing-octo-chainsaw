import type { PixelArt } from './pixelCodec';

/** A tiny procedurally drawn pixel picture (a waving smiley on a sunset) for demos and tests. */
export function demoPixelArt(frames = 1, size = 24): PixelArt {
  const palette: [number, number, number][] = [
    [255, 209, 102], // sun yellow
    [255, 138, 101], // peach
    [239, 71, 111], // pink
    [118, 58, 146], // purple
    [29, 27, 38], // ink
    [255, 255, 255], // white
    [6, 214, 160], // mint
    [17, 138, 178], // blue
  ];
  const out: Uint8Array[] = [];
  for (let f = 0; f < frames; f++) {
    const px = new Uint8Array(size * size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let c = y < size * 0.35 ? 0 : y < size * 0.55 ? 1 : y < size * 0.75 ? 2 : 3;
        const dx = x - size / 2 + 0.5;
        const dy = y - size * 0.52;
        const d = Math.hypot(dx, dy);
        if (d < size * 0.3) c = 0;
        if (d >= size * 0.3 && d < size * 0.34) c = 4;
        const eyeY = Math.round(size * 0.45);
        const blink = frames > 1 && f === Math.floor(frames / 2);
        if ((x === Math.round(size * 0.4) || x === Math.round(size * 0.6)) && (y === eyeY || (!blink && y === eyeY - 1))) c = 4;
        if (y === Math.round(size * 0.62) && Math.abs(dx) < size * 0.14) c = 4;
        if (y === Math.round(size * 0.6) && Math.abs(dx) >= size * 0.12 && Math.abs(dx) < size * 0.16) c = 4;
        // waving hand
        const hx = Math.round(size * 0.84 + Math.sin((f / Math.max(1, frames)) * Math.PI * 2) * 1.5);
        if (Math.abs(x - hx) <= 1 && Math.abs(y - Math.round(size * 0.3)) <= 1) c = 5;
        if (y >= size - 2) c = (x + f) % 4 < 2 ? 6 : 7;
        px[y * size + x] = c;
      }
    out.push(px);
  }
  return { w: size, h: size, palette, frames: out, delay: 180, caption: frames > 1 ? 'Hi from QR Market!' : 'Wish you were here!' };
}
