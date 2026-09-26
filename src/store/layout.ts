/** Store dimensions and the aisles from left (checkout by the door) to right (photo corner). */

export const STORE = {
  backZ: -2.3,
  shelfBackZ: -2.24,
  shelfFrontZ: -1.52,
  ceilingY: 3.5,
  frontZ: 6.5,
  xMin: -11,
  xMax: 50,
  doorX: -1.2,
};

/** Shelf board heights (top surface) of a standard gondola. */
export const LEVELS = [0.16, 0.64, 1.12, 1.6];
export const SHELF_TOP = 2.06;

export type SectionKey = 'checkout' | 'bakery' | 'snacks' | 'candy' | 'cereal' | 'fresh' | 'drinks' | 'frozen' | 'photo';

export interface SectionInfo {
  id: SectionKey;
  x0: number;
  x1: number;
  /** Fixture accent colour. */
  color: string;
  /** Food sprite shown on the hanging sign. */
  sign: string;
}

export const SECTIONS: SectionInfo[] = [
  { id: 'checkout', x0: -11, x1: -2.4, color: '#f47c9f', sign: 'donut' },
  { id: 'bakery', x0: -2.4, x1: 4.2, color: '#ffb98f', sign: 'croissant' },
  { id: 'snacks', x0: 4.2, x1: 11, color: '#ffd66b', sign: 'popcorn' },
  { id: 'candy', x0: 11, x1: 15.6, color: '#ff9fc0', sign: 'cupcake' },
  { id: 'cereal', x0: 15.6, x1: 21.8, color: '#b9a2f0', sign: 'cereal-bowl' },
  { id: 'fresh', x0: 21.8, x1: 28.8, color: '#7cc9a8', sign: 'onigiri' },
  { id: 'drinks', x0: 28.8, x1: 36.8, color: '#79bfee', sign: 'lemonade' },
  { id: 'frozen', x0: 36.8, x1: 41.8, color: '#9ad7f2', sign: 'popsicle' },
  { id: 'photo', x0: 41.8, x1: 48.4, color: '#c9a7f5', sign: 'milk' },
];

export const CAMERA_X_MIN = -7.6;
export const CAMERA_X_MAX = 45.6;

export function sectionAt(x: number): SectionInfo {
  return SECTIONS.find((s) => x >= s.x0 && x < s.x1) ?? (x < SECTIONS[0].x0 ? SECTIONS[0] : SECTIONS[SECTIONS.length - 1]);
}

export function sectionCenter(id: SectionKey) {
  const s = SECTIONS.find((q) => q.id === id)!;
  return (s.x0 + s.x1) / 2;
}
