import { makeQR } from './qr/qr';
import type { Painter } from './engine/Painter';

/**
 * Dev-only galleries:
 *   /?debug=art&p=<product>  product art at 4x
 *   /?debug=food             the food sprite sheet
 *   /?debug=buddy            mascot sheets
 *   /?debug=scene&s=<name>   a live 3D preview (clerk, buddies, food shelf)
 */
export async function showArtDebug(root: HTMLElement) {
  const params = new URLSearchParams(location.search);
  const kind = params.get('debug');
  document.body.style.overflow = 'auto';
  root.style.position = 'static';
  root.style.padding = '16px';
  root.style.display = 'flex';
  root.style.flexWrap = 'wrap';
  root.style.alignContent = 'flex-start';
  root.style.gap = '12px';
  root.style.background = '#2a2f45';
  const add = (p: Painter | HTMLElement, scale = 4) => {
    const c = 'ctx' in p ? p.scaled(scale) : p;
    root.appendChild(c);
  };
  if (kind === 'food') {
    root.style.background = '#f4f2ef';
    const { foodDefs } = await import('./art/foods');
    const scale = Number(params.get('scale') ?? 4);
    for (const f of foodDefs()) {
      const cell = document.createElement('div');
      cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;font:10px monospace;color:#777';
      const src = f.draw();
      const c = document.createElement('canvas');
      c.width = src.width * scale;
      c.height = src.height * scale;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, 0, 0, c.width, c.height);
      cell.append(c, f.id);
      root.appendChild(cell);
    }
    return;
  }
  if (kind === 'buddy' || kind === 'scene' || kind === 'clerk') {
    const m = await import('./art/debugScene');
    await m.showScene(root, kind, params);
    return;
  }
  const qr = makeQR('https://pukkingdragon123.github.io/glowing-octo-chainsaw/');
  const which = params.get('p') ?? 'all';
  const mod = await import('./products/debugArt');
  mod.debugArt(which, qr, add);
}
