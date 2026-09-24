import * as THREE from 'three';
import { Painter, shade } from '../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../engine/pixelFont';

export interface SignStyle {
  bg: string;
  fg: string;
  border?: string;
  scale?: number;
  padX?: number;
  padY?: number;
  sub?: string;
  icon?: (p: Painter, x: number, y: number) => void;
  iconW?: number;
  shadow?: string;
}

/** Pixel sign texture sized to its text. Returns texture + aspect (w/h). */
export function signTexture(text: string, s: SignStyle): { texture: THREE.Texture; aspect: number; w: number; h: number } {
  const scale = s.scale ?? 1;
  const padX = s.padX ?? 5;
  const padY = s.padY ?? 4;
  const probe = new Painter(4, 4);
  const tw = probe.textWidth(text, { font: FONT_BIG, scale, bold: true });
  const subW = s.sub ? probe.textWidth(s.sub, { font: FONT_TINY }) : 0;
  const iconW = s.icon ? (s.iconW ?? 9) + 3 : 0;
  const w = Math.max(tw + iconW, subW) + padX * 2;
  const h = 7 * scale + padY * 2 + (s.sub ? 7 : 0);
  const p = new Painter(w, h);
  p.clear(s.border ?? shade(s.bg, -0.35));
  p.rect(1, 1, w - 2, h - 2, s.bg);
  p.rect(1, 1, w - 2, 1, shade(s.bg, 0.15));
  p.rect(1, h - 2, w - 2, 1, shade(s.bg, -0.15));
  const tx = padX + iconW;
  if (s.icon) s.icon(p, padX, Math.round(padY + (7 * scale - 9) / 2));
  p.text(text, tx, padY, { font: FONT_BIG, scale, bold: true, color: s.fg, shadow: s.shadow ?? shade(s.bg, -0.3), shadowOffset: [0, 1] });
  if (s.sub) p.text(s.sub, w / 2, h - padY - 5, { font: FONT_TINY, color: shade(s.fg, -0.1), align: 'center' });
  return { texture: p.texture(), aspect: w / h, w, h };
}

/** A flat sign mesh of the given height. Double sided. */
export function signMesh(text: string, height: number, s: SignStyle, emissive = false): THREE.Mesh {
  const { texture, aspect } = signTexture(text, s);
  const mat = emissive
    ? new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
    : new THREE.MeshToonMaterial({ map: texture });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(height * aspect, height), mat);
  return mesh;
}

/** Yellow shelf-edge price tag, like every convenience store. */
export function priceTagTexture(name: string, price: number, owned: boolean): THREE.Texture {
  const w = 40;
  const h = 18;
  const p = new Painter(w, h);
  const free = price === 0 || owned;
  const bg = free ? '#ffe45e' : '#ff5d73';
  p.clear('#3b3024');
  p.rect(1, 1, w - 2, h - 2, bg);
  p.rect(1, 1, w - 2, 4, free ? '#ffd23f' : '#e63950');
  const short = name.length > 12 ? name.slice(0, 11) + '.' : name;
  p.text(short.toUpperCase(), 3, 1, { font: FONT_TINY, color: free ? '#3b3024' : '#ffffff' });
  if (free) {
    p.text(owned && price > 0 ? 'OWNED' : 'FREE', w / 2, 8, { font: FONT_BIG, color: '#3b3024', align: 'center' });
  } else {
    // coin icon + price
    p.disc(7, 11.5, 3.5, '#ffd23f');
    p.disc(7, 11.5, 2, '#f2a900');
    p.text(String(price), 13, 8, { font: FONT_BIG, color: '#ffffff' });
  }
  return p.texture();
}
