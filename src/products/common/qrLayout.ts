import * as THREE from 'three';
import type { QRMatrix } from '../../qr/qr';

export interface ModuleSpot {
  r: number;
  c: number;
  dark: boolean;
  /** Centre position in world space. */
  pos: THREE.Vector3;
  kind: number;
}

export interface LayoutOptions {
  /** World size of the code excluding the quiet zone. */
  size: number;
  center?: THREE.Vector3;
  /** Plane: 'xz' lies flat (row → +z), 'xy' stands up (row → -y). */
  plane?: 'xz' | 'xy';
  include?: 'dark' | 'light' | 'all';
}

export function moduleSize(qr: QRMatrix, size: number) {
  return size / qr.size;
}

/** Positions for QR modules on a plane. */
export function layoutModules(qr: QRMatrix, opts: LayoutOptions): ModuleSpot[] {
  const center = opts.center ?? new THREE.Vector3();
  const m = opts.size / qr.size;
  const half = (qr.size - 1) / 2;
  const include = opts.include ?? 'dark';
  const spots: ModuleSpot[] = [];
  for (let r = 0; r < qr.size; r++)
    for (let c = 0; c < qr.size; c++) {
      const dark = qr.isDark(r, c);
      if (include === 'dark' && !dark) continue;
      if (include === 'light' && dark) continue;
      const u = (c - half) * m;
      const v = (r - half) * m;
      const pos = opts.plane === 'xy' ? new THREE.Vector3(center.x + u, center.y - v, center.z) : new THREE.Vector3(center.x + u, center.y, center.z + v);
      spots.push({ r, c, dark, pos, kind: qr.kindAt(r, c) });
    }
  return spots;
}

/** Canvas with the QR at exactly `m` pixels per module (+ quiet zone), for crisp decals. */
export function qrDecalCanvas(qr: QRMatrix, dark: string, light: string, quiet = 2, m = 1): HTMLCanvasElement {
  const n = (qr.size + quiet * 2) * m;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, n, n);
  ctx.fillStyle = dark;
  for (let r = 0; r < qr.size; r++) for (let col = 0; col < qr.size; col++) if (qr.isDark(r, col)) ctx.fillRect((col + quiet) * m, (r + quiet) * m, m, m);
  return c;
}

export function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Flat QR decal mesh (plane facing +Z), sized including the quiet zone. */
export function qrDecal(qr: QRMatrix, worldSize: number, dark = '#1b1530', light = '#ffffff', quiet = 2): THREE.Mesh {
  const tex = canvasTexture(qrDecalCanvas(qr, dark, light, quiet));
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldSize, worldSize), new THREE.MeshBasicMaterial({ map: tex }));
  mesh.userData.qrQuiet = quiet;
  return mesh;
}

/** Sort spots so assembly animations sweep nicely. */
export function orderSpots<T extends { r: number; c: number }>(spots: T[], mode: 'wave' | 'random' | 'spiral' | 'rows', seed = 1): T[] {
  const out = spots.slice();
  if (mode === 'rows') return out.sort((a, b) => a.r - b.r || a.c - b.c);
  if (mode === 'wave') return out.sort((a, b) => a.r + a.c - (b.r + b.c));
  if (mode === 'spiral') {
    const n = Math.max(...out.map((s) => Math.max(s.r, s.c))) + 1;
    const h = (n - 1) / 2;
    return out.sort((a, b) => Math.hypot(a.r - h, a.c - h) - Math.hypot(b.r - h, b.c - h));
  }
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
