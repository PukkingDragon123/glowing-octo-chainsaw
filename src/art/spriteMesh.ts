import * as THREE from 'three';
import { Bitmap, pixelTexture } from './pixel';

/**
 * Flat pixel sprites as real geometry: the opaque pixels are merged into rectangles (greedy
 * meshing), so the mesh matches the sprite's silhouette exactly. That keeps depth, normals,
 * shadows, picking and the outline pass all in agreement with what you see — no alpha testing.
 */

export interface SpriteGeoOptions {
  /** Texture pixels per world unit. */
  ppu: number;
  /** Anchor inside the sprite, 0..1 from the left / bottom (default bottom-centre). */
  anchor?: [number, number];
  /** Sub-rectangle of a shared atlas texture this sprite lives in (UV space). */
  uv?: { u0: number; v0: number; u1: number; v1: number };
}

type Source = HTMLCanvasElement | Bitmap;

function alphaOf(src: Source): { w: number; h: number; a: Uint8Array } {
  if (src instanceof Bitmap) {
    const a = new Uint8Array(src.w * src.h);
    for (let i = 0; i < a.length; i++) a[i] = src.data[i * 4 + 3] > 0 ? 1 : 0;
    return { w: src.w, h: src.h, a };
  }
  const ctx = src.getContext('2d', { willReadFrequently: true })!;
  const d = ctx.getImageData(0, 0, src.width, src.height).data;
  const a = new Uint8Array(src.width * src.height);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  return { w: src.width, h: src.height, a };
}

/** Rectangles covering every opaque pixel exactly once. */
export function greedyRects(w: number, h: number, a: Uint8Array): [number, number, number, number][] {
  const used = new Uint8Array(w * h);
  const out: [number, number, number, number][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!a[i] || used[i]) continue;
      let rw = 1;
      while (x + rw < w && a[i + rw] && !used[i + rw]) rw++;
      let rh = 1;
      grow: while (y + rh < h) {
        for (let k = 0; k < rw; k++) {
          const j = (y + rh) * w + x + k;
          if (!a[j] || used[j]) break grow;
        }
        rh++;
      }
      for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) used[(y + yy) * w + x + xx] = 1;
      out.push([x, y, rw, rh]);
    }
  }
  return out;
}

export function spriteGeometry(src: Source, o: SpriteGeoOptions): THREE.BufferGeometry {
  const { w, h, a } = alphaOf(src);
  const rects = greedyRects(w, h, a);
  const [ax, ay] = o.anchor ?? [0.5, 0];
  const uv = o.uv ?? { u0: 0, v0: 0, u1: 1, v1: 1 };
  const pos = new Float32Array(rects.length * 12);
  const uvs = new Float32Array(rects.length * 8);
  const nrm = new Float32Array(rects.length * 12);
  const idx: number[] = [];
  const X = (px: number) => (px - ax * w) / o.ppu;
  const Y = (py: number) => (h - py - ay * h) / o.ppu;
  const U = (px: number) => uv.u0 + (px / w) * (uv.u1 - uv.u0);
  const V = (py: number) => uv.v0 + (1 - py / h) * (uv.v1 - uv.v0);
  rects.forEach(([x, y, rw, rh], k) => {
    const corners: [number, number][] = [
      [x, y + rh],
      [x + rw, y + rh],
      [x + rw, y],
      [x, y],
    ];
    corners.forEach(([px, py], c) => {
      pos.set([X(px), Y(py), 0], k * 12 + c * 3);
      uvs.set([U(px), V(py)], k * 8 + c * 2);
      nrm.set([0, 0, 1], k * 12 + c * 3);
    });
    const b = k * 4;
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(idx);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  g.userData.size = [w / o.ppu, h / o.ppu];
  return g;
}

/** Unlit material for flat pixel art (colours stay exactly as drawn). */
export function spriteMaterial(map: THREE.Texture, opts: { side?: THREE.Side; color?: THREE.ColorRepresentation } = {}) {
  return new THREE.MeshBasicMaterial({ map, side: opts.side ?? THREE.FrontSide, color: opts.color ?? '#ffffff' });
}

export interface SpriteMeshOptions extends SpriteGeoOptions {
  material?: THREE.Material;
  doubleSided?: boolean;
  castShadow?: boolean;
}

/** One sprite as its own mesh with its own texture. */
export function spriteMesh(src: Source, o: SpriteMeshOptions): THREE.Mesh {
  const canvas = src instanceof Bitmap ? src.toCanvas() : src;
  const geo = spriteGeometry(canvas, o);
  const mat = o.material ?? spriteMaterial(pixelTexture(canvas), { side: o.doubleSided ? THREE.DoubleSide : THREE.FrontSide });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = o.castShadow ?? false;
  return m;
}

/** Packs many small canvases into one texture (row packing) so sprites can share a material. */
export class SpriteAtlas {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private x = 1;
  private y = 1;
  private rowH = 0;
  private rects = new Map<string, { x: number; y: number; w: number; h: number; src: HTMLCanvasElement }>();
  private tex: THREE.CanvasTexture | null = null;

  constructor(readonly size = 1024) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
  }

  add(id: string, src: HTMLCanvasElement) {
    if (this.rects.has(id)) return this.rects.get(id)!;
    if (this.x + src.width + 1 > this.size) {
      this.x = 1;
      this.y += this.rowH + 1;
      this.rowH = 0;
    }
    if (this.y + src.height + 1 > this.size) throw new Error('Sprite atlas full');
    const r = { x: this.x, y: this.y, w: src.width, h: src.height, src };
    this.ctx.drawImage(src, r.x, r.y);
    this.rects.set(id, r);
    this.x += src.width + 1;
    this.rowH = Math.max(this.rowH, src.height);
    if (this.tex) this.tex.needsUpdate = true;
    return r;
  }

  has(id: string) {
    return this.rects.has(id);
  }

  uv(id: string) {
    const r = this.rects.get(id)!;
    const s = this.size;
    // canvas textures are flipped: v = 1 is the top row
    return { u0: r.x / s, u1: (r.x + r.w) / s, v1: 1 - r.y / s, v0: 1 - (r.y + r.h) / s };
  }

  geometry(id: string, o: Omit<SpriteGeoOptions, 'uv'>) {
    const r = this.rects.get(id)!;
    return spriteGeometry(r.src, { ...o, uv: this.uv(id) });
  }

  texture() {
    if (!this.tex) this.tex = pixelTexture(this.canvas);
    return this.tex;
  }
}
