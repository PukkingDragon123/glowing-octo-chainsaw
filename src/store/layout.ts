import type { SectionId } from '../products/types';

export interface SectionInfo {
  id: SectionId;
  name: string;
  x0: number;
  x1: number;
  color: string;
  icon: string;
}

/** Aisles from left (checkout, next to the door) to right (premium). */
export const SECTIONS: SectionInfo[] = [
  { id: 'counter', name: 'Checkout', x0: -7.5, x1: -2.5, color: '#ff5d73', icon: '¤' },
  { id: 'media', name: 'Photo & Video', x0: -2.5, x1: 1.5, color: '#9b5de5', icon: '▣' },
  { id: 'snacks', name: 'Snacks', x0: 1.5, x1: 9.5, color: '#ff8b3d', icon: '●' },
  { id: 'cereal', name: 'Cereal', x0: 9.5, x1: 15.5, color: '#6f4ef2', icon: '■' },
  { id: 'fresh', name: 'Fresh & Hot', x0: 15.5, x1: 21.5, color: '#2ec4b6', icon: '▲' },
  { id: 'cooler', name: 'Cold Drinks', x0: 21.5, x1: 29.5, color: '#00b4ff', icon: '❄' },
  { id: 'freezer', name: 'Frozen', x0: 29.5, x1: 33.5, color: '#8ecae6', icon: '✱' },
  { id: 'premium', name: 'Premium', x0: 33.5, x1: 39.5, color: '#f2c14e', icon: '★' },
];

export const CAMERA_X_MIN = -5.4;
export const CAMERA_X_MAX = 37.2;

export function sectionAt(x: number): SectionInfo {
  return SECTIONS.find((s) => x >= s.x0 && x < s.x1) ?? (x < SECTIONS[0].x0 ? SECTIONS[0] : SECTIONS[SECTIONS.length - 1]);
}

export function sectionCenter(id: SectionId) {
  const s = SECTIONS.find((q) => q.id === id)!;
  return (s.x0 + s.x1) / 2;
}
