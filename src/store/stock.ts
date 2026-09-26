import * as THREE from 'three';
import { SpriteAtlas } from '../art/spriteMesh';
import { foodDefs, type Aisle, type FoodDef } from '../art/foods';
import { rng } from '../engine/tween';

/**
 * Shelf merchandise: every food sprite type becomes one InstancedMesh (exact-silhouette geometry,
 * shared atlas texture), so hundreds of items cost a few dozen draw calls and each one can still
 * be picked and animated on its own.
 */

interface Boop {
  mesh: THREE.InstancedMesh;
  id: number;
  t: number;
  dur: number;
}

export interface Placed {
  id: string;
  mesh: THREE.InstancedMesh;
  index: number;
}

export class Stock {
  readonly group = new THREE.Group();
  readonly atlas = new SpriteAtlas(1024);
  readonly defs: FoodDef[];
  private byAisle = new Map<Aisle, FoodDef[]>();
  private canvases = new Map<string, HTMLCanvasElement>();
  private pending = new Map<string, THREE.Matrix4[]>();
  private base = new Map<THREE.InstancedMesh, THREE.Matrix4[]>();
  private boops: Boop[] = [];
  private material: THREE.MeshLambertMaterial;
  readonly meshes: THREE.InstancedMesh[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(readonly ppu = 96) {
    this.defs = foodDefs();
    for (const d of this.defs) {
      const list = this.byAisle.get(d.aisle) ?? [];
      list.push(d);
      this.byAisle.set(d.aisle, list);
    }
    this.material = new THREE.MeshLambertMaterial({ map: this.atlas.texture(), side: THREE.DoubleSide });
  }

  canvas(id: string) {
    let c = this.canvases.get(id);
    if (!c) {
      const def = this.defs.find((d) => d.id === id);
      if (!def) throw new Error(`Unknown food ${id}`);
      c = def.draw();
      this.canvases.set(id, c);
      this.atlas.add(id, c);
    }
    return c;
  }

  /** World size [w, h] of a food sprite. */
  size(id: string): [number, number] {
    const c = this.canvas(id);
    return [c.width / this.ppu, c.height / this.ppu];
  }

  aisle(a: Aisle) {
    return this.byAisle.get(a) ?? [];
  }

  /** Queue one sprite standing at (x, y, z), bottom-centre anchored. */
  place(id: string, x: number, y: number, z: number, o: { scale?: number; ry?: number; flip?: boolean } = {}) {
    this.canvas(id);
    const list = this.pending.get(id) ?? [];
    const sc = o.scale ?? 1;
    this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.ry ?? 0);
    this.m.compose(this.v.set(x, y, z), this.q, this.s.set(o.flip ? -sc : sc, sc, sc));
    list.push(this.m.clone());
    this.pending.set(id, list);
  }

  /**
   * Stock a shelf run from x0 to x1 at height y with items from the given aisles: groups of 2–4
   * facings of the same item, a slightly offset back row for depth, occasional gaps.
   */
  fillShelf(x0: number, x1: number, y: number, z: number, aisles: Aisle[], o: { seed?: number; maxH?: number; rows?: number; gap?: number; only?: string[] } = {}) {
    const r = rng(o.seed ?? Math.round(x0 * 31 + y * 17));
    const pool = o.only ?? aisles.flatMap((a) => this.aisle(a).map((d) => d.id));
    const fits = pool.filter((id) => this.size(id)[1] <= (o.maxH ?? 0.44));
    if (!fits.length) return;
    const rows = o.rows ?? 2;
    for (let row = rows - 1; row >= 0; row--) {
      let x = x0 + (row ? 0.08 : 0.02);
      const zz = z - row * 0.2;
      while (x < x1) {
        const id = fits[Math.floor(r() * fits.length)];
        const [w] = this.size(id);
        const n = 2 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          if (x + w > x1) break;
          this.place(id, x + w / 2, y, zz + (r() - 0.5) * 0.03, { scale: row ? 0.94 : 1, flip: r() < 0.15 });
          x += w + (o.gap ?? 0.018);
        }
        x += r() < 0.18 ? 0.08 : 0.02;
      }
    }
  }

  build() {
    for (const [id, mats] of this.pending) {
      const geo = this.atlas.geometry(id, { ppu: this.ppu, anchor: [0.5, 0] });
      const mesh = new THREE.InstancedMesh(geo, this.material, mats.length);
      mats.forEach((mm, i) => mesh.setMatrixAt(i, mm));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.food = id;
      mesh.computeBoundingSphere();
      this.base.set(mesh, mats);
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
    this.pending.clear();
    return this.group;
  }

  /** Squash-hop an item (click feedback). */
  boop(mesh: THREE.InstancedMesh, id: number) {
    if (this.boops.some((b) => b.mesh === mesh && b.id === id)) return;
    this.boops.push({ mesh, id, t: 0, dur: 0.55 });
  }

  /** World position of an instance (its bottom centre). */
  positionOf(mesh: THREE.InstancedMesh, id: number, out = new THREE.Vector3()) {
    const b = this.base.get(mesh)![id];
    return out.setFromMatrixPosition(b);
  }

  update(dt: number) {
    if (!this.boops.length) return;
    for (const b of this.boops) {
      b.t += dt;
      const p = Math.min(1, b.t / b.dur);
      const base = this.base.get(b.mesh)![b.id];
      // anticipation squash, hop with stretch, landing squash
      let sy = 1;
      let hop = 0;
      if (p < 0.15) sy = 1 - (p / 0.15) * 0.22;
      else if (p < 0.7) {
        const k = (p - 0.15) / 0.55;
        hop = Math.sin(k * Math.PI) * 0.16;
        sy = 1 + Math.sin(k * Math.PI) * 0.14;
      } else {
        const k = (p - 0.7) / 0.3;
        sy = 1 - Math.sin(k * Math.PI) * 0.12;
      }
      const sx = 1 / Math.sqrt(sy);
      this.m.copy(base);
      const pos = this.v.setFromMatrixPosition(base);
      const sc = this.s.setFromMatrixScale(base);
      this.q.setFromRotationMatrix(this.m.extractRotation(base));
      this.m.compose(pos.clone().setY(pos.y + hop), this.q, new THREE.Vector3(sc.x * sx, sc.y * sy, sc.z));
      b.mesh.setMatrixAt(b.id, this.m);
      b.mesh.instanceMatrix.needsUpdate = true;
      if (p >= 1) {
        b.mesh.setMatrixAt(b.id, base);
      }
    }
    this.boops = this.boops.filter((b) => b.t < b.dur);
  }
}
