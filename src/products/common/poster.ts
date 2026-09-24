import { Painter } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import type { QRMatrix } from '../../qr/qr';

export interface PosterQR {
  qr: QRMatrix;
  /** Region in art pixels (before scaling) reserved for the code, including its light background. */
  x: number;
  y: number;
  size: number;
  dark: string;
  light: string;
  quiet?: number;
  /** Optional per-module painter for stylised codes (gets final canvas coords). */
  module?: (ctx: CanvasRenderingContext2D, r: number, c: number, x: number, y: number, m: number) => void;
}

/**
 * Upscale pixel art and composite a crisp QR on top at an integer module size, then add a receipt
 * strip at the bottom. The result is the downloadable poster.
 */
export function composePoster(art: Painter, scale: number, code: PosterQR, strip?: { label: string; product: string; accent?: string }) {
  const stripH = strip ? 22 : 0;
  const W = art.w * scale;
  const H = (art.h + stripH) * scale;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(art.canvas, 0, 0, W, art.h * scale);

  const quiet = code.quiet ?? 2;
  const region = code.size * scale;
  const m = Math.floor(region / (code.qr.size + quiet * 2));
  const total = m * code.qr.size;
  const ox = Math.round(code.x * scale + (region - total) / 2);
  const oy = Math.round(code.y * scale + (region - total) / 2);
  ctx.fillStyle = code.light;
  ctx.fillRect(code.x * scale, code.y * scale, region, region);
  for (let r = 0; r < code.qr.size; r++)
    for (let c = 0; c < code.qr.size; c++) {
      if (!code.qr.isDark(r, c)) continue;
      if (code.module) code.module(ctx, r, c, ox + c * m, oy + r * m, m);
      else {
        ctx.fillStyle = code.dark;
        ctx.fillRect(ox + c * m, oy + r * m, m, m);
      }
    }

  if (strip) {
    const p = new Painter(art.w, stripH);
    p.clear('#fbfaf5');
    for (let x = 0; x < art.w; x += 4) p.rect(x, 0, 2, 1, '#c9c4b8');
    // right: stacked store logo
    const logoW = 26;
    p.text('QR', art.w - 4, 4, { font: FONT_BIG, color: strip.accent ?? '#ff5d73', align: 'right', bold: true });
    p.text('MARKET', art.w - 4, 13, { font: FONT_TINY, color: '#3b3024', align: 'right' });
    // left: product + content, truncated to the space left
    const room = art.w - logoW - 8;
    const fit = (t: string) => {
      let s = t.toUpperCase();
      while (s.length > 1 && p.textWidth(s, { font: FONT_TINY }) > room) s = s.slice(0, -2) + '.';
      return s;
    };
    p.text(fit(strip.product), 4, 5, { font: FONT_TINY, color: '#3b3024' });
    p.text(fit(strip.label), 4, 13, { font: FONT_TINY, color: '#8a8175' });
    ctx.drawImage(p.canvas, 0, art.h * scale, W, stripH * scale);
  }
  return out;
}

/** Pick an upscale factor so posters land around 1000-1400 px wide. */
export function posterScale(artW: number) {
  return Math.max(2, Math.round(1200 / artW));
}
