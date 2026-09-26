import { h } from '../ui/dom';
import { logoDataURL } from '../art/brand';
import { iconImg } from '../art/icons';
import { decodePixelArt, extractPixelHash, type PixelArt } from '../qr/pixelCodec';

function drawFrame(canvas: HTMLCanvasElement, art: PixelArt, frame: number) {
  const ctx = canvas.getContext('2d')!;
  const f = art.frames[frame % art.frames.length];
  const img = ctx.createImageData(art.w, art.h);
  for (let i = 0; i < art.w * art.h; i++) {
    const [r, g, b] = art.palette[f[i]];
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Landing page for scanned Pixel Postcards / Flipbooks. The picture is decoded from the link
 * itself, so it shows instantly without loading the 3D store.
 */
export async function showViewer(root: HTMLElement, onEnter: () => void): Promise<boolean> {
  const encoded = extractPixelHash(location.hash);
  if (!encoded) return false;
  const canvas = h('canvas', { width: 1, height: 1, 'aria-label': 'Pixel picture from the QR code' });
  const caption = h('div', { class: 'caption' });
  const meta = h('div', { class: 'viewer-meta' });
  const enter = h('button', { class: 'pill pink', onclick: () => {
    window.clearInterval(timer);
    history.replaceState(null, '', location.pathname + location.search);
    wrap.remove();
    onEnter();
  } }, h('span', { class: 'lead' }, iconImg('play', 2), 'MAKE YOUR OWN'), h('img', { src: logoDataURL(32), alt: '', width: 28, height: 28, style: 'image-rendering:pixelated' }));
  const brand = h('div', { class: 'viewer-brand' }, h('img', { src: logoDataURL(32), alt: '' }), 'XOLOTL KOBINI');
  const card = h('div', { class: 'polaroid' }, brand, canvas, caption, meta, enter);
  const wrap = h('div', { class: 'viewer' }, card);
  root.appendChild(wrap);
  let timer = 0;
  try {
    const art = await decodePixelArt(encoded);
    canvas.width = art.w;
    canvas.height = art.h;
    drawFrame(canvas, art, 0);
    caption.textContent = art.caption || (art.frames.length > 1 ? 'A pixel flipbook for you' : 'A pixel postcard for you');
    meta.textContent = `${art.w}×${art.h} PIXELS · ${art.palette.length} COLOURS${art.frames.length > 1 ? ` · ${art.frames.length} FRAMES` : ''} · STORED INSIDE THE QR CODE`;
    if (art.frames.length > 1) {
      let f = 0;
      timer = window.setInterval(() => drawFrame(canvas, art, ++f), Math.max(60, art.delay));
    }
  } catch (e) {
    caption.textContent = 'This postcard could not be opened.';
    meta.textContent = (e as Error).message.toUpperCase();
  }
  return true;
}
