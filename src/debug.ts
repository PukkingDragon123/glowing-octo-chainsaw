import { makeQR } from './qr/qr';
import type { Painter } from './engine/Painter';

/** Dev-only texture gallery: open /?debug=art to inspect product art at 4x. */
export async function showArtDebug(root: HTMLElement) {
  document.body.style.overflow = 'auto';
  root.style.position = 'static';
  root.style.padding = '16px';
  root.style.display = 'flex';
  root.style.flexWrap = 'wrap';
  root.style.gap = '12px';
  root.style.background = '#2a2f45';
  const qr = makeQR('https://pukkingdragon123.github.io/glowing-octo-chainsaw/');
  const add = (p: Painter | HTMLElement, scale = 4) => {
    const c = 'ctx' in p ? p.scaled(scale) : p;
    root.appendChild(c);
  };
  const which = new URLSearchParams(location.search).get('p') ?? 'all';
  const mod = await import('./products/debugArt');
  mod.debugArt(which, qr, add);
}
