import qrcode from 'qrcode-generator';

export type ECLevel = 'L' | 'M' | 'Q' | 'H';

export const KIND_DATA = 0;
export const KIND_FINDER = 1;
export const KIND_SEPARATOR = 2;
export const KIND_TIMING = 3;
export const KIND_ALIGNMENT = 4;
export const KIND_FORMAT = 5;
export const KIND_VERSION = 6;

export interface QRMatrix {
  text: string;
  version: number;
  ec: ECLevel;
  size: number;
  dark: Uint8Array;
  kind: Uint8Array;
  darkCount: number;
  isDark(r: number, c: number): boolean;
  kindAt(r: number, c: number): number;
  /** Top-left corners (row, col) of the three finder patterns. */
  finders: [number, number][];
  /** True when (r,c) is inside one of the 7x7 finder squares. */
  inFinder(r: number, c: number): boolean;
}

// Alignment pattern centre coordinates per version (index = version - 1).
const ALIGN: number[][] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
  [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
  [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170],
];

export function utf8Binary(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

type Mode = 'Numeric' | 'Alphanumeric' | 'Byte';

export function pickMode(text: string): Mode {
  if (/^[0-9]+$/.test(text)) return 'Numeric';
  if (/^[0-9A-Z $%*+\-./:]+$/.test(text)) return 'Alphanumeric';
  return 'Byte';
}

export class QRTooLongError extends Error {
  constructor() {
    super('That is too much data for one QR code. Try a shorter link or a smaller image.');
  }
}

export function makeQR(text: string, ec: ECLevel = 'M'): QRMatrix {
  if (!text) text = ' ';
  const mode = pickMode(text);
  const qr = qrcode(0, ec);
  qr.addData(mode === 'Byte' ? utf8Binary(text) : text, mode);
  try {
    qr.make();
  } catch {
    throw new QRTooLongError();
  }
  const size = qr.getModuleCount();
  const version = (size - 17) / 4;
  const dark = new Uint8Array(size * size);
  let darkCount = 0;
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (qr.isDark(r, c)) {
        dark[r * size + c] = 1;
        darkCount++;
      }

  const kind = new Uint8Array(size * size);
  const mark = (r: number, c: number, k: number) => {
    if (r >= 0 && c >= 0 && r < size && c < size) kind[r * size + c] = k;
  };
  const finders: [number, number][] = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
  // separators first (8x8 region), then finders on top
  for (const [fr, fc] of finders)
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) mark(fr + r, fc + c, KIND_SEPARATOR);
  for (const [fr, fc] of finders) for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) mark(fr + r, fc + c, KIND_FINDER);
  for (let i = 8; i < size - 8; i++) {
    mark(6, i, KIND_TIMING);
    mark(i, 6, KIND_TIMING);
  }
  const pos = ALIGN[version - 1] ?? [];
  for (const ar of pos)
    for (const ac of pos) {
      const nearFinder = (ar === 6 && ac === 6) || (ar === 6 && ac === pos[pos.length - 1]) || (ar === pos[pos.length - 1] && ac === 6);
      if (nearFinder) continue;
      for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) mark(ar + r, ac + c, KIND_ALIGNMENT);
    }
  for (let i = 0; i <= 8; i++) {
    if (kind[8 * size + i] !== KIND_TIMING) mark(8, i, KIND_FORMAT);
    if (kind[i * size + 8] !== KIND_TIMING) mark(i, 8, KIND_FORMAT);
  }
  for (let i = 0; i < 8; i++) mark(8, size - 1 - i, KIND_FORMAT);
  for (let i = 0; i < 7; i++) mark(size - 1 - i, 8, KIND_FORMAT);
  mark(size - 8, 8, KIND_FORMAT);
  if (version >= 7) {
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 3; j++) {
        mark(i, size - 11 + j, KIND_VERSION);
        mark(size - 11 + j, i, KIND_VERSION);
      }
  }

  return {
    text,
    version,
    ec,
    size,
    dark,
    kind,
    darkCount,
    finders,
    isDark: (r, c) => r >= 0 && c >= 0 && r < size && c < size && dark[r * size + c] === 1,
    kindAt: (r, c) => kind[r * size + c],
    inFinder: (r, c) => finders.some(([fr, fc]) => r >= fr && r < fr + 7 && c >= fc && c < fc + 7),
  };
}

/** Human readable density hint for the UI. */
export function densityLabel(qr: QRMatrix): { label: string; level: 'easy' | 'ok' | 'dense' } {
  if (qr.version <= 6) return { label: 'Easy scan', level: 'easy' };
  if (qr.version <= 15) return { label: 'Good scan', level: 'ok' };
  return { label: 'Dense: print it big', level: 'dense' };
}
