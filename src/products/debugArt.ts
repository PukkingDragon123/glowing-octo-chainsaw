import type { Painter } from '../engine/Painter';
import type { QRMatrix } from '../qr/qr';
import { scanCanvas } from '../qr/export';
import { Tweens } from '../engine/tween';
import { PRODUCTS, productById } from '.';

/** Dev gallery: every flavor's poster for one product (or all), with a live scan check label. */
export function debugArt(which: string, qr: QRMatrix, add: (p: Painter | HTMLCanvasElement, scale?: number) => void) {
  const list = which === 'all' ? PRODUCTS : [productById(which)].filter(Boolean);
  const tweens = new Tweens();
  for (const product of list) {
    if (!product) continue;
    for (const flavor of product.flavors) {
      const c = product.poster({ qr, flavor, art: null, label: 'pukkingdragon123.github.io/glowing-octo-chainsaw', tweens, group: 'x' });
      const ok = scanCanvas(c, 1400) === qr.text;
      const wrap = document.createElement('figure');
      wrap.style.margin = '0';
      wrap.style.color = ok ? '#7CFFCB' : '#ff5d73';
      wrap.style.font = '12px monospace';
      c.style.width = '260px';
      c.style.imageRendering = 'pixelated';
      wrap.appendChild(c);
      const cap = document.createElement('figcaption');
      cap.textContent = `${product.id} / ${flavor.id}: ${ok ? 'SCANS' : 'NO SCAN'}`;
      wrap.appendChild(cap);
      add(wrap as unknown as HTMLCanvasElement);
      console.log(`POSTER ${product.id}/${flavor.id} ${ok ? 'OK' : 'FAIL'}`);
    }
  }
}
