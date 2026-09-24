import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonGradient } from './voxel';

const tmpColor = new THREE.Color();

/** Fill (or create) a vertex colour attribute with one sRGB colour. */
export function paintGeometry(geo: THREE.BufferGeometry, color: string | THREE.Color) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  if (color instanceof THREE.Color) tmpColor.copy(color);
  else tmpColor.set(color);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = tmpColor.r;
    arr[i * 3 + 1] = tmpColor.g;
    arr[i * 3 + 2] = tmpColor.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Colour individual box faces (BoxGeometry order: +x, -x, +y, -y, +z, -z). */
export function paintBoxFaces(geo: THREE.BufferGeometry, faces: (string | null)[], fallback: string) {
  paintGeometry(geo, fallback);
  const col = geo.attributes.color as THREE.BufferAttribute;
  const groups = geo.groups;
  groups.forEach((g, i) => {
    const c = faces[i];
    if (!c) return;
    tmpColor.set(c);
    const idx = geo.index!;
    for (let k = g.start; k < g.start + g.count; k++) {
      const v = idx.getX(k);
      col.setXYZ(v, tmpColor.r, tmpColor.g, tmpColor.b);
    }
  });
  return geo;
}

function normalize(g: THREE.BufferGeometry) {
  if (!g.index) {
    const count = g.attributes.position.count;
    const idx: number[] = [];
    for (let i = 0; i < count; i++) idx.push(i);
    g.setIndex(idx);
  }
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.color) paintGeometry(g, '#ffffff');
  for (const key of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv', 'color'].includes(key)) g.deleteAttribute(key);
  }
  g.clearGroups();
  return g;
}

const materials = new Map<string, THREE.Material>();

/** Shared vertex-coloured toon material (optionally with a texture). */
export function toonMat(map?: THREE.Texture | null, opts: { emissive?: boolean; transparent?: boolean } = {}): THREE.Material {
  const key = (map ? map.uuid : 'none') + (opts.emissive ? '-e' : '') + (opts.transparent ? '-t' : '');
  let m = materials.get(key);
  if (!m) {
    if (opts.emissive) {
      m = new THREE.MeshBasicMaterial({ vertexColors: true, map: map ?? null, transparent: !!opts.transparent });
    } else {
      m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), map: map ?? null, transparent: !!opts.transparent, alphaTest: opts.transparent ? 0.5 : 0 });
    }
    materials.set(key, m);
  }
  return m;
}

interface Item {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}

/**
 * Collects static geometry and merges it per material, so a whole aisle becomes a handful of draw calls.
 */
export class Batcher {
  private items: Item[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();

  add(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = normalize(geo.clone());
    this.e.set(rx, ry, rz);
    this.q.setFromEuler(this.e);
    this.p.set(x, y, z);
    this.s.set(sx, sy, sz);
    this.m.compose(this.p, this.q, this.s);
    g.applyMatrix4(this.m);
    this.items.push({ geo: g, mat });
    return this;
  }

  addMatrix(geo: THREE.BufferGeometry, mat: THREE.Material, matrix: THREE.Matrix4) {
    const g = normalize(geo.clone());
    g.applyMatrix4(matrix);
    this.items.push({ geo: g, mat });
    return this;
  }

  /** Box with its bottom at y. */
  box(w: number, h: number, d: number, color: string, x: number, y: number, z: number, ry = 0, mat?: THREE.Material) {
    const g = paintGeometry(new THREE.BoxGeometry(w, h, d), color);
    return this.add(g, mat ?? toonMat(), x, y + h / 2, z, 0, ry, 0);
  }

  cylinder(r: number, h: number, color: string, x: number, y: number, z: number, seg = 10, mat?: THREE.Material, rTop = r) {
    const g = paintGeometry(new THREE.CylinderGeometry(rTop, r, h, seg), color);
    return this.add(g, mat ?? toonMat(), x, y + h / 2, z);
  }

  build(opts: { castShadow?: boolean; receiveShadow?: boolean } = {}): THREE.Group {
    const group = new THREE.Group();
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const it of this.items) {
      const list = byMat.get(it.mat) ?? [];
      list.push(it.geo);
      byMat.set(it.mat, list);
    }
    for (const [mat, geos] of byMat) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = opts.castShadow ?? true;
      mesh.receiveShadow = opts.receiveShadow ?? true;
      group.add(mesh);
      for (const g of geos) g.dispose();
    }
    this.items = [];
    return group;
  }
}
