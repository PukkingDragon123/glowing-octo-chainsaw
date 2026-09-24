import { quantizeFrames, type PixelArt } from './pixelCodec';

export interface CaptureOptions {
  size: number;
  colors: number;
  dither: boolean;
  caption: string;
}

/** Downscale any drawable to size×size (centre crop) with good averaging. */
function drawCover(src: CanvasImageSource, sw: number, sh: number, size: number): Uint8ClampedArray {
  // progressive halving keeps small results from aliasing
  let cur: HTMLCanvasElement | null = null;
  const side = Math.min(sw, sh);
  const sx = (sw - side) / 2;
  const sy = (sh - side) / 2;
  let w = side;
  const first = document.createElement('canvas');
  const firstSide = Math.max(size, Math.min(1024, side));
  first.width = first.height = firstSide;
  const fctx = first.getContext('2d')!;
  fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(src, sx, sy, side, side, 0, 0, firstSide, firstSide);
  cur = first;
  w = firstSide;
  while (w / 2 >= size) {
    const next = document.createElement('canvas');
    next.width = next.height = Math.max(size, Math.floor(w / 2));
    const nctx = next.getContext('2d')!;
    nctx.imageSmoothingQuality = 'high';
    nctx.drawImage(cur, 0, 0, next.width, next.height);
    cur = next;
    w = next.width;
  }
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const octx = out.getContext('2d', { willReadFrequently: true })!;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(cur, 0, 0, size, size);
  return octx.getImageData(0, 0, size, size).data;
}

export async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

export function imageToPixelArt(img: HTMLImageElement | HTMLCanvasElement, opts: CaptureOptions): PixelArt {
  const w = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const h = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const rgba = drawCover(img, w, h, opts.size);
  const q = quantizeFrames([rgba], opts.size, opts.size, { colors: opts.colors, dither: opts.dither, pop: true });
  return { w: opts.size, h: opts.size, palette: q.palette, frames: q.frames, delay: 0, caption: opts.caption };
}

export interface VideoCapture {
  video: HTMLVideoElement;
  duration: number;
  dispose(): void;
}

export async function openVideo(file: Blob): Promise<VideoCapture> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('This video format could not be opened in the browser. Try an MP4 or WebM.'));
  });
  let duration = video.duration;
  if (!Number.isFinite(duration)) duration = 5;
  return { video, duration, dispose: () => URL.revokeObjectURL(url) };
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    video.currentTime = t;
    setTimeout(done, 1500);
  });
}

export async function videoToPixelArt(
  cap: VideoCapture,
  opts: CaptureOptions & { start: number; frames: number; fps: number },
  onProgress?: (p: number) => void,
): Promise<PixelArt> {
  const frames: Uint8ClampedArray[] = [];
  const v = cap.video;
  for (let i = 0; i < opts.frames; i++) {
    const t = Math.min(cap.duration - 0.05, opts.start + i / opts.fps);
    await seek(v, Math.max(0, t));
    frames.push(drawCover(v, v.videoWidth, v.videoHeight, opts.size));
    onProgress?.((i + 1) / opts.frames);
  }
  const q = quantizeFrames(frames, opts.size, opts.size, { colors: opts.colors, dither: opts.dither, pop: true });
  return { w: opts.size, h: opts.size, palette: q.palette, frames: q.frames, delay: Math.round(1000 / opts.fps), caption: opts.caption };
}

/** Render pixel art to a canvas at an integer scale (used by previews, the viewer and 3D textures). */
export function pixelArtCanvas(art: PixelArt, frame = 0, scale = 1): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = art.w * scale;
  c.height = art.h * scale;
  const ctx = c.getContext('2d')!;
  const f = art.frames[Math.min(frame, art.frames.length - 1)];
  for (let y = 0; y < art.h; y++)
    for (let x = 0; x < art.w; x++) {
      const [r, g, b] = art.palette[f[y * art.w + x]];
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  return c;
}
