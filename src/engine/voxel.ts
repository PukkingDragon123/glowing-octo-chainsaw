import * as THREE from 'three';

/**
 * Dense voxel grid. Each cell stores 0 (empty) or an sRGB color + 1.
 * Converted into a single BufferGeometry with hidden faces removed and per-vertex ambient occlusion.
 */
export class VoxelGrid {
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly data: Uint32Array;

  constructor(sx: number, sy: number, sz: number) {
    this.sx = sx;
    this.sy = sy;
    this.sz = sz;
    this.data = new Uint32Array(sx * sy * sz);
  }

  private idx(x: number, y: number, z: number) {
    return x + this.sx * (y + this.sy * z);
  }

  inside(x: number, y: number, z: number) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }

  get(x: number, y: number, z: number): number {
    if (!this.inside(x, y, z)) return 0;
    return this.data[this.idx(x, y, z)];
  }

  filled(x: number, y: number, z: number) {
    return this.get(x, y, z) !== 0;
  }

  set(x: number, y: number, z: number, color: string | number | null) {
    x = Math.round(x);
    y = Math.round(y);
    z = Math.round(z);
    if (!this.inside(x, y, z)) return this;
    this.data[this.idx(x, y, z)] = color === null ? 0 : toCell(color);
    return this;
  }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string | number | null) {
    const v = color === null ? 0 : toCell(color);
    for (let z = Math.max(0, Math.min(z0, z1)); z <= Math.min(this.sz - 1, Math.max(z0, z1)); z++)
      for (let y = Math.max(0, Math.min(y0, y1)); y <= Math.min(this.sy - 1, Math.max(y0, y1)); y++)
        for (let x = Math.max(0, Math.min(x0, x1)); x <= Math.min(this.sx - 1, Math.max(x0, x1)); x++)
          this.data[this.idx(x, y, z)] = v;
    return this;
  }

  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, color: string | number | null) {
    const v = color === null ? 0 : toCell(color);
    for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx;
          const dy = (y + 0.5 - cy) / ry;
          const dz = (z + 0.5 - cz) / rz;
          if (dx * dx + dy * dy + dz * dz <= 1 && this.inside(x, y, z)) this.data[this.idx(x, y, z)] = v;
        }
    return this;
  }

  sphere(cx: number, cy: number, cz: number, r: number, color: string | number | null) {
    return this.ellipsoid(cx, cy, cz, r, r, r, color);
  }

  /** Cylinder along the Y axis. */
  cylinder(cx: number, cz: number, y0: number, y1: number, r: number, color: string | number | null, rz = r) {
    const v = color === null ? 0 : toCell(color);
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const dx = (x + 0.5 - cx) / r;
          const dz = (z + 0.5 - cz) / rz;
          if (dx * dx + dz * dz <= 1 && this.inside(x, y, z)) this.data[this.idx(x, y, z)] = v;
        }
    return this;
  }

  /**
   * Stamp 2D pixel art onto a plane. Rows go top→bottom (y decreasing), columns left→right (x increasing).
   * `z0..z1` sets the thickness.
   */
  stampXY(rows: string[], palette: Record<string, string>, x0: number, yTop: number, z0: number, z1 = z0) {
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const col = palette[rows[r][c]];
        if (!col) continue;
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x0 + c, yTop - r, z, col);
      }
    }
    return this;
  }

  /** Paint only voxels that already exist (like a spray can): fn returns a color or null to keep. */
  paint(fn: (x: number, y: number, z: number, current: string) => string | null) {
    for (let z = 0; z < this.sz; z++)
      for (let y = 0; y < this.sy; y++)
        for (let x = 0; x < this.sx; x++) {
          const i = this.idx(x, y, z);
          const v = this.data[i];
          if (!v) continue;
          const next = fn(x, y, z, cellToHex(v));
          if (next) this.data[i] = toCell(next);
        }
    return this;
  }

  count() {
    let n = 0;
    for (let i = 0; i < this.data.length; i++) if (this.data[i]) n++;
    return n;
  }
}

function toCell(color: string | number): number {
  const n = typeof color === 'number' ? color : parseInt(color.replace('#', ''), 16);
  return (n & 0xffffff) + 1;
}

function cellToHex(v: number): string {
  return '#' + (v - 1).toString(16).padStart(6, '0');
}

export interface VoxelMeshOptions {
  /** World size of a single voxel. */
  scale?: number;
  /** Where the grid origin sits: 'center' centres x/z and puts y=0 at the bottom. */
  anchor?: 'center' | 'bottom-center' | 'corner';
  ao?: number;
}

// face definitions: normal, 4 corner offsets (counter-clockwise seen from outside)
const FACES: { n: [number, number, number]; c: [number, number, number][] }[] = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

const tmpColor = new THREE.Color();

export function meshVoxels(grid: VoxelGrid, opts: VoxelMeshOptions = {}): THREE.BufferGeometry {
  const s = opts.scale ?? 0.05;
  const aoStrength = opts.ao ?? 0.22;
  const anchor = opts.anchor ?? 'bottom-center';
  const ox = anchor === 'corner' ? 0 : -grid.sx / 2;
  const oy = anchor === 'center' ? -grid.sy / 2 : 0;
  const oz = anchor === 'corner' ? 0 : -grid.sz / 2;

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let z = 0; z < grid.sz; z++)
    for (let y = 0; y < grid.sy; y++)
      for (let x = 0; x < grid.sx; x++) {
        const v = grid.get(x, y, z);
        if (!v) continue;
        tmpColor.setHex(v - 1, THREE.SRGBColorSpace);
        for (const f of FACES) {
          const [nx, ny, nz] = f.n;
          if (grid.filled(x + nx, y + ny, z + nz)) continue;
          const base = positions.length / 3;
          const aoVals: number[] = [];
          for (const [cx, cy, cz] of f.c) {
            positions.push((x + cx + ox) * s, (y + cy + oy) * s, (z + cz + oz) * s);
            normals.push(nx, ny, nz);
            // ambient occlusion: look at the 3 voxels touching this corner on the face's outer side
            const ax = cx === 1 ? 1 : -1;
            const ay = cy === 1 ? 1 : -1;
            const az = cz === 1 ? 1 : -1;
            let side1 = 0,
              side2 = 0,
              corner = 0;
            if (nx !== 0) {
              side1 = +grid.filled(x + nx, y + ay, z);
              side2 = +grid.filled(x + nx, y, z + az);
              corner = +grid.filled(x + nx, y + ay, z + az);
            } else if (ny !== 0) {
              side1 = +grid.filled(x + ax, y + ny, z);
              side2 = +grid.filled(x, y + ny, z + az);
              corner = +grid.filled(x + ax, y + ny, z + az);
            } else {
              side1 = +grid.filled(x + ax, y, z + nz);
              side2 = +grid.filled(x, y + ay, z + nz);
              corner = +grid.filled(x + ax, y + ay, z + nz);
            }
            const occ = side1 && side2 ? 3 : side1 + side2 + corner;
            aoVals.push(occ);
            const k = 1 - (occ / 3) * aoStrength;
            colors.push(tmpColor.r * k, tmpColor.g * k, tmpColor.b * k);
          }
          // flip quad diagonal to avoid AO anisotropy
          if (aoVals[0] + aoVals[2] > aoVals[1] + aoVals[3]) {
            indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base + 0);
          } else {
            indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
        }
      }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

let sharedToonGradient: THREE.DataTexture | null = null;

/** A 4-step toon ramp so voxel lighting reads as flat pixel-art bands. */
export function toonGradient(): THREE.DataTexture {
  if (sharedToonGradient) return sharedToonGradient;
  const data = new Uint8Array([90, 150, 215, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  sharedToonGradient = tex;
  return tex;
}

const materialCache = new Map<string, THREE.Material>();

export function voxelMaterial(kind: 'toon' | 'lambert' | 'basic' = 'toon'): THREE.Material {
  const key = 'vox-' + kind;
  let m = materialCache.get(key);
  if (!m) {
    if (kind === 'toon') m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
    else if (kind === 'lambert') m = new THREE.MeshLambertMaterial({ vertexColors: true });
    else m = new THREE.MeshBasicMaterial({ vertexColors: true });
    materialCache.set(key, m);
  }
  return m;
}

export function voxelMesh(grid: VoxelGrid, opts: VoxelMeshOptions & { material?: THREE.Material; shadows?: boolean } = {}) {
  const mesh = new THREE.Mesh(meshVoxels(grid, opts), opts.material ?? voxelMaterial());
  mesh.castShadow = opts.shadows ?? true;
  mesh.receiveShadow = opts.shadows ?? true;
  return mesh;
}
