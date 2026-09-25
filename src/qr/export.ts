import jsQR from 'jsqr';
import type { QRMatrix } from './qr';

export interface PlainQROptions {
  module?: number;
  quiet?: number;
  dark?: string;
  light?: string;
}

export function plainQRCanvas(qr: QRMatrix, opts: PlainQROptions = {}): HTMLCanvasElement {
  const m = opts.module ?? Math.max(4, Math.floor(1024 / (qr.size + 8)));
  const quiet = opts.quiet ?? 4;
  const size = (qr.size + quiet * 2) * m;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = opts.light ?? '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = opts.dark ?? '#000000';
  for (let r = 0; r < qr.size; r++)
    for (let col = 0; col < qr.size; col++) if (qr.isDark(r, col)) ctx.fillRect((col + quiet) * m, (r + quiet) * m, m, m);
  return c;
}

export function qrSvg(qr: QRMatrix, opts: { dark?: string; light?: string; quiet?: number } = {}): string {
  const quiet = opts.quiet ?? 4;
  const n = qr.size + quiet * 2;
  let path = '';
  for (let r = 0; r < qr.size; r++) {
    let c = 0;
    while (c < qr.size) {
      if (!qr.isDark(r, c)) {
        c++;
        continue;
      }
      let run = 1;
      while (c + run < qr.size && qr.isDark(r, c + run)) run++;
      path += `M${c + quiet} ${r + quiet}h${run}v1h-${run}z`;
      c += run;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${opts.light ?? '#fff'}"/><path d="${path}" fill="${opts.dark ?? '#000'}"/></svg>`;
}

/** Try to read a QR code back from an image — proves a stylised design still scans. */
export function scanCanvas(canvas: HTMLCanvasElement, maxSide = 900): string | null {
  let src = canvas;
  if (Math.max(canvas.width, canvas.height) > maxSide) {
    const k = maxSide / Math.max(canvas.width, canvas.height);
    const c = document.createElement('canvas');
    c.width = Math.round(canvas.width * k);
    c.height = Math.round(canvas.height * k);
    const cx = c.getContext('2d')!;
    cx.imageSmoothingEnabled = true;
    cx.drawImage(canvas, 0, 0, c.width, c.height);
    src = c;
  }
  const ctx = src.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, src.width, src.height);
  const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
  return res ? res.data : null;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png'));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  downloadBlob(await canvasToBlob(canvas), filename);
}

interface ViewerDownloads {
  save(req: { filename: string; data: Blob | string }): Promise<{ status: 'saved' | 'delivered' }>;
}
let viewerDl: Promise<ViewerDownloads | null> | undefined;

/**
 * The claude.ai artifact viewer's `downloads` capability when the page is hosted there, else null.
 * That viewer blocks downloads a page starts itself; `save()` asks the viewer to confirm instead.
 */
export function viewerDownloads(): Promise<ViewerDownloads | null> {
  if (!viewerDl) {
    const host = (window as unknown as { claude?: { use?: (name: string) => Promise<unknown> } }).claude;
    viewerDl = typeof host?.use === 'function'
      ? Promise.resolve(host.use('downloads')).then((d) => (d as ViewerDownloads | null) ?? null, () => null)
      : Promise.resolve(null);
  }
  return viewerDl;
}

/** Stop offering viewer saves after the viewer reports them unavailable. */
export function disableViewerDownloads() {
  viewerDl = Promise.resolve(null);
}

export async function copyCanvas(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await canvasToBlob(canvas);
    const Item = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
    if (!Item || !navigator.clipboard?.write) return false;
    await navigator.clipboard.write([new Item({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

export function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'qr'
  );
}
