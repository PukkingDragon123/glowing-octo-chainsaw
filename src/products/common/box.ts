import * as THREE from 'three';
import { toonGradient } from '../../engine/voxel';

export interface BoxFaces {
  px: HTMLCanvasElement; // right side
  nx: HTMLCanvasElement; // left side
  py: HTMLCanvasElement; // top
  ny: HTMLCanvasElement; // bottom
  pz: HTMLCanvasElement; // front
  nz: HTMLCanvasElement; // back
}

/**
 * Textured box in a single draw call: the six face canvases are packed into one atlas and the
 * BoxGeometry UVs are remapped onto it.
 */
export function atlasBox(w: number, h: number, d: number, faces: BoxFaces, opts: { basic?: boolean; segments?: [number, number, number]; mipmaps?: boolean } = {}): THREE.Mesh {
  const order: (keyof BoxFaces)[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
  const pad = 1;
  // simple shelf packer: pz, nz on first row; px, nx beside; py, ny at the bottom
  const rects: Record<string, { x: number; y: number; w: number; h: number }> = {};
  let x = 0;
  let rowH = 0;
  let y = 0;
  const maxW = Math.max(faces.pz.width * 2 + faces.px.width * 2 + pad * 8, 64);
  for (const k of ['pz', 'nz', 'px', 'nx', 'py', 'ny'] as (keyof BoxFaces)[]) {
    const c = faces[k];
    if (x + c.width + pad * 2 > maxW) {
      x = 0;
      y += rowH + pad * 2;
      rowH = 0;
    }
    rects[k] = { x: x + pad, y: y + pad, w: c.width, h: c.height };
    x += c.width + pad * 2;
    rowH = Math.max(rowH, c.height);
  }
  const W = maxW;
  const H = y + rowH + pad * 2;
  const atlas = document.createElement('canvas');
  atlas.width = W;
  atlas.height = H;
  const ctx = atlas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (const k of order) {
    const r = rects[k];
    const c = faces[k];
    // extend edges by 1px to avoid bleeding
    ctx.drawImage(c, r.x - 1, r.y, c.width, c.height);
    ctx.drawImage(c, r.x + 1, r.y, c.width, c.height);
    ctx.drawImage(c, r.x, r.y - 1, c.width, c.height);
    ctx.drawImage(c, r.x, r.y + 1, c.width, c.height);
    ctx.drawImage(c, r.x, r.y);
  }
  const tex = new THREE.CanvasTexture(atlas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;

  if (opts.mipmaps) {
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
  }

  const [sx, sy, sz] = opts.segments ?? [1, 1, 1];
  const geo = new THREE.BoxGeometry(w, h, d, sx, sy, sz);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const index = geo.index!;
  order.forEach((k, f) => {
    const r = rects[k];
    const u0 = r.x / W;
    const u1 = (r.x + r.w) / W;
    const v0 = 1 - (r.y + r.h) / H;
    const v1 = 1 - r.y / H;
    const g = geo.groups[f];
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = g.start; i < g.start + g.count; i++) {
      const vi = index.getX(i);
      lo = Math.min(lo, vi);
      hi = Math.max(hi, vi);
    }
    for (let idx = lo; idx <= hi; idx++) {
      const u = uv.getX(idx);
      const v = uv.getY(idx);
      uv.setXY(idx, u0 + (u1 - u0) * u, v0 + (v1 - v0) * v);
    }
  });
  const mat = opts.basic ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient() });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function toCanvas(p: { canvas: HTMLCanvasElement }) {
  return p.canvas;
}
