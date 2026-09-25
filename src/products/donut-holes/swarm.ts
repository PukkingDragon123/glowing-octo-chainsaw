import * as THREE from 'three';
import { toonGradient } from '../../engine/voxel';
import type { ModuleSpot } from '../common/qrLayout';
import { isStructural } from '../common/swarm';

/**
 * Variant of the shared PieceSwarm for the donut holes:
 * - PARKED pieces are drawn at a fixed spot without physics (the holes piled up inside the box),
 * - assembly can roll pieces along the floor (spin matches the distance travelled) instead of hopping,
 * - options (roll, target offset) are per piece group.
 */
export interface DonutSwarmOptions {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  targets: THREE.Vector3[];
  colors: THREE.Color[];
  scanColors: THREE.Color[];
  scale: THREE.Vector3;
  scanScale: THREE.Vector3;
  radius: number;
  floor: (x: number, z: number) => number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  gravity?: number;
  restitution: number;
  friction: number;
  collide: boolean;
  /** Spheres roll (on the floor and during assembly); boxes tumble and settle square. */
  roll: boolean;
}

const HIDDEN = 0;
const PHYSICS = 1;
const FLYING = 2;
const SETTLED = 3;
const PARKED = 4;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _e = new THREE.Euler();
const ID = new THREE.Quaternion();

export class DonutSwarm {
  readonly mesh: THREE.InstancedMesh;
  readonly count: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private ang: Float32Array;
  private quat: THREE.Quaternion[];
  private state: Uint8Array;
  private hopFrom: Float32Array;
  private hopQuat: THREE.Quaternion[];
  private hopT0: Float32Array;
  private hopDur: Float32Array;
  private hopH: Float32Array;
  private pending = 0;
  private resolveAssemble: (() => void) | null = null;
  private time = 0;
  private scanT = 0;
  private scanTarget = 0;
  private dirty = true;
  private o: DonutSwarmOptions;
  private hash = new Map<number, number[]>();
  private pool: number[][] = [];
  private poolUsed = 0;
  onLand: ((i: number) => void) | null = null;
  onBounce: ((i: number, speed: number) => void) | null = null;

  constructor(o: DonutSwarmOptions) {
    this.o = o;
    const n = o.targets.length;
    this.count = n;
    this.mesh = new THREE.InstancedMesh(o.geometry, o.material, Math.max(1, n));
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.ang = new Float32Array(n * 3);
    this.quat = Array.from({ length: n }, () => new THREE.Quaternion());
    this.state = new Uint8Array(n);
    this.hopFrom = new Float32Array(n * 3);
    this.hopQuat = Array.from({ length: n }, () => new THREE.Quaternion());
    this.hopT0 = new Float32Array(n);
    this.hopDur = new Float32Array(n);
    this.hopH = new Float32Array(n);
    for (let i = 0; i < n; i++) this.mesh.setColorAt(i, o.colors[i]);
    if (n === 0) this.mesh.count = 0;
    this.write();
  }

  hideAll() {
    this.state.fill(HIDDEN);
    this.dirty = true;
  }

  park(i: number, p: THREE.Vector3, rx: number, ry: number, rz: number) {
    this.state[i] = PARKED;
    this.pos[i * 3] = p.x;
    this.pos[i * 3 + 1] = p.y;
    this.pos[i * 3 + 2] = p.z;
    this.quat[i].setFromEuler(_e.set(rx, ry, rz));
    this.dirty = true;
  }

  /** Launch a piece from where it is (parked) or from `p`. */
  spawn(i: number, p: THREE.Vector3 | null, v: THREE.Vector3, spin = 6) {
    if (p) {
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z;
    }
    this.state[i] = PHYSICS;
    this.vel[i * 3] = v.x;
    this.vel[i * 3 + 1] = v.y;
    this.vel[i * 3 + 2] = v.z;
    this.ang[i * 3] = (Math.random() - 0.5) * spin;
    this.ang[i * 3 + 1] = (Math.random() - 0.5) * spin;
    this.ang[i * 3 + 2] = (Math.random() - 0.5) * spin;
  }

  positionOf(i: number, out: THREE.Vector3) {
    return out.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
  }

  isParked(i: number) {
    return this.state[i] === PARKED;
  }

  settleAll() {
    for (let i = 0; i < this.count; i++) {
      const t = this.o.targets[i];
      this.state[i] = SETTLED;
      this.pos[i * 3] = t.x;
      this.pos[i * 3 + 1] = t.y;
      this.pos[i * 3 + 2] = t.z;
      if (!this.o.roll) this.quat[i].identity();
    }
    this.pending = 0;
    const r = this.resolveAssemble;
    this.resolveAssemble = null;
    r?.();
    this.dirty = true;
  }

  /** Move every piece home; `when[k]` is the departure delay of order[k]. */
  assemble(order: number[], when: number[], duration: number, hop: number): Promise<void> {
    return new Promise((resolve) => {
      this.pending = 0;
      order.forEach((i, k) => {
        if (this.state[i] === SETTLED) return;
        this.pending++;
        this.state[i] = FLYING;
        this.hopFrom[i * 3] = this.pos[i * 3];
        this.hopFrom[i * 3 + 1] = this.pos[i * 3 + 1];
        this.hopFrom[i * 3 + 2] = this.pos[i * 3 + 2];
        this.hopQuat[i].copy(this.quat[i]);
        this.hopT0[i] = this.time + when[k];
        this.hopDur[i] = duration * (0.85 + Math.random() * 0.3);
        this.hopH[i] = hop * (0.6 + Math.random() * 0.8);
      });
      if (this.pending === 0) resolve();
      else this.resolveAssemble = resolve;
    });
  }

  setScanMode(on: boolean) {
    this.scanTarget = on ? 1 : 0;
  }

  private write() {
    const ss = this.o.scanScale;
    for (let i = 0; i < this.count; i++) {
      if (this.state[i] === HIDDEN) _m.makeScale(0, 0, 0);
      else {
        _v.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
        _s.copy(this.o.scale);
        if (this.state[i] === SETTLED && this.scanT > 0) {
          _s.x *= 1 + (ss.x - 1) * this.scanT;
          _s.y *= 1 + (ss.y - 1) * this.scanT;
          _s.z *= 1 + (ss.z - 1) * this.scanT;
        }
        _m.compose(_v, this.quat[i], _s);
      }
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.dirty = false;
  }

  update(dt: number) {
    this.time += dt;
    const o = this.o;
    const g = o.gravity ?? 9.8;
    const r = o.radius;
    const b = o.bounds;
    let moved = false;
    const hash = o.collide ? this.hash : null;
    if (hash && hash.size) {
      hash.clear();
      this.poolUsed = 0;
    }
    for (let i = 0; i < this.count; i++) {
      const st = this.state[i];
      const k = i * 3;
      if (st === PHYSICS) {
        moved = true;
        this.vel[k + 1] -= g * dt;
        const px = this.pos[k];
        const pz = this.pos[k + 2];
        this.pos[k] += this.vel[k] * dt;
        this.pos[k + 1] += this.vel[k + 1] * dt;
        this.pos[k + 2] += this.vel[k + 2] * dt;
        const fy = o.floor(this.pos[k], this.pos[k + 2]) + r;
        let grounded = false;
        if (this.pos[k + 1] < fy) {
          this.pos[k + 1] = fy;
          if (this.vel[k + 1] < 0) {
            const sp = -this.vel[k + 1];
            if (sp > 0.6) this.onBounce?.(i, sp);
            this.vel[k + 1] = sp > 0.4 ? sp * o.restitution : 0;
          }
          grounded = true;
          const fr = Math.exp(-o.friction * dt);
          this.vel[k] *= fr;
          this.vel[k + 2] *= fr;
          this.ang[k] *= fr;
          this.ang[k + 1] *= fr;
          this.ang[k + 2] *= fr;
        }
        if (this.pos[k] < b.minX + r) {
          this.pos[k] = b.minX + r;
          this.vel[k] = Math.abs(this.vel[k]) * o.restitution;
        } else if (this.pos[k] > b.maxX - r) {
          this.pos[k] = b.maxX - r;
          this.vel[k] = -Math.abs(this.vel[k]) * o.restitution;
        }
        if (this.pos[k + 2] < b.minZ + r) {
          this.pos[k + 2] = b.minZ + r;
          this.vel[k + 2] = Math.abs(this.vel[k + 2]) * o.restitution;
        } else if (this.pos[k + 2] > b.maxZ - r) {
          this.pos[k + 2] = b.maxZ - r;
          this.vel[k + 2] = -Math.abs(this.vel[k + 2]) * o.restitution;
        }
        if (grounded && o.roll) this.rollBy(i, this.pos[k] - px, this.pos[k + 2] - pz);
        else {
          _axis.set(this.ang[k], this.ang[k + 1], this.ang[k + 2]);
          const a = _axis.length();
          if (a > 1e-4) {
            _q.setFromAxisAngle(_axis.multiplyScalar(1 / a), a * dt);
            this.quat[i].premultiply(_q);
          }
        }
        if (hash && this.pos[k + 1] < fy + r * 2) {
          const key = (Math.floor(this.pos[k] / (r * 2)) + 5000) * 10007 + Math.floor(this.pos[k + 2] / (r * 2)) + 5000;
          let cell = hash.get(key);
          if (!cell) {
            cell = this.bucket();
            hash.set(key, cell);
          }
          cell.push(i);
        }
      } else if (st === FLYING) {
        moved = true;
        const t0 = this.hopT0[i];
        if (this.time < t0) continue;
        const t = Math.min(1, (this.time - t0) / this.hopDur[i]);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const target = o.targets[i];
        const px = this.pos[k];
        const pz = this.pos[k + 2];
        this.pos[k] = this.hopFrom[k] + (target.x - this.hopFrom[k]) * e;
        this.pos[k + 1] = this.hopFrom[k + 1] + (target.y - this.hopFrom[k + 1]) * e + this.hopH[i] * 4 * t * (1 - t);
        this.pos[k + 2] = this.hopFrom[k + 2] + (target.z - this.hopFrom[k + 2]) * e;
        if (o.roll) this.rollBy(i, this.pos[k] - px, this.pos[k + 2] - pz);
        else this.quat[i].copy(this.hopQuat[i]).slerp(ID, e);
        if (t >= 1) {
          this.state[i] = SETTLED;
          this.onLand?.(i);
          this.pending--;
          if (this.pending <= 0 && this.resolveAssemble) {
            const res = this.resolveAssemble;
            this.resolveAssemble = null;
            res();
          }
        }
      }
    }
    if (hash && hash.size) this.collide(hash);
    if (Math.abs(this.scanT - this.scanTarget) > 1e-3) {
      this.scanT += Math.sign(this.scanTarget - this.scanT) * Math.min(Math.abs(this.scanTarget - this.scanT), dt * 2.5);
      for (let i = 0; i < this.count; i++) this.mesh.setColorAt(i, _c.copy(o.colors[i]).lerp(o.scanColors[i], this.scanT));
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      moved = true;
    }
    if (moved || this.dirty) this.write();
  }

  private bucket() {
    let b = this.pool[this.poolUsed];
    if (!b) {
      b = [];
      this.pool.push(b);
    }
    this.poolUsed++;
    b.length = 0;
    return b;
  }

  private rollBy(i: number, dx: number, dz: number) {
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) return;
    _axis.set(dz / d, 0, -dx / d);
    _q.setFromAxisAngle(_axis, d / this.o.radius);
    this.quat[i].premultiply(_q);
  }

  private collide(hash: Map<number, number[]>) {
    const minD = this.o.radius * 2;
    for (const [key, cell] of hash) {
      const kx = Math.floor(key / 10007);
      const kz = key - kx * 10007;
      for (let dx = 0; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dz < 0) continue;
          const other = dx === 0 && dz === 0 ? cell : hash.get((kx + dx) * 10007 + kz + dz);
          if (!other) continue;
          for (let a = 0; a < cell.length; a++) {
            const ia = cell[a];
            for (let bi = other === cell ? a + 1 : 0; bi < other.length; bi++) {
              const ib = other[bi];
              const ddx = this.pos[ib * 3] - this.pos[ia * 3];
              const ddz = this.pos[ib * 3 + 2] - this.pos[ia * 3 + 2];
              const d2 = ddx * ddx + ddz * ddz;
              if (d2 < minD * minD && d2 > 1e-8) {
                const d = Math.sqrt(d2);
                const push = (minD - d) * 0.5;
                const nx = ddx / d;
                const nz = ddz / d;
                this.pos[ia * 3] -= nx * push;
                this.pos[ia * 3 + 2] -= nz * push;
                this.pos[ib * 3] += nx * push;
                this.pos[ib * 3 + 2] += nz * push;
                const rv = (this.vel[ib * 3] - this.vel[ia * 3]) * nx + (this.vel[ib * 3 + 2] - this.vel[ia * 3 + 2]) * nz;
                if (rv < 0) {
                  const j = rv * 0.5;
                  this.vel[ia * 3] += nx * j;
                  this.vel[ia * 3 + 2] += nz * j;
                  this.vel[ib * 3] -= nx * j;
                  this.vel[ib * 3 + 2] -= nz * j;
                }
              }
            }
          }
        }
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

export interface PieceGroup {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  scale: THREE.Vector3;
  scanScale: THREE.Vector3;
  roll: boolean;
  /** Added to the module centre (e.g. to sit taller pieces on the paper). */
  offset: THREE.Vector3;
  color: (s: ModuleSpot) => [THREE.Color, THREE.Color];
}

type Shared = Pick<DonutSwarmOptions, 'radius' | 'floor' | 'bounds' | 'restitution' | 'friction' | 'collide' | 'gravity'>;

/** Donut holes for data modules, square brownie bites for finder + alignment modules. */
export class DonutQR {
  readonly swarms: DonutSwarm[] = [];
  readonly map: { s: number; i: number }[] = [];
  onLand: ((spot: number) => void) | null = null;
  onBounce: ((spot: number, speed: number) => void) | null = null;

  constructor(readonly spots: ModuleSpot[], data: PieceGroup, struct: PieceGroup, shared: Shared) {
    const groups = [
      { cfg: data, idx: [] as number[] },
      { cfg: struct, idx: [] as number[] },
    ];
    spots.forEach((s, k) => groups[isStructural(s.kind) ? 1 : 0].idx.push(k));
    groups.forEach((g, gi) => {
      const cols = g.idx.map((k) => g.cfg.color(spots[k]));
      const sw = new DonutSwarm({
        ...shared,
        geometry: g.cfg.geometry,
        material: g.cfg.material,
        targets: g.idx.map((k) => spots[k].pos.clone().add(g.cfg.offset)),
        colors: cols.map((c) => c[0]),
        scanColors: cols.map((c) => c[1]),
        scale: g.cfg.scale,
        scanScale: g.cfg.scanScale,
        roll: g.cfg.roll,
      });
      g.idx.forEach((k, i) => (this.map[k] = { s: gi, i }));
      sw.onLand = (i) => this.onLand?.(g.idx[i]);
      sw.onBounce = (i, sp) => this.onBounce?.(g.idx[i], sp);
      this.swarms.push(sw);
    });
  }

  get count() {
    return this.spots.length;
  }

  get meshes() {
    return this.swarms.map((s) => s.mesh);
  }

  park(k: number, p: THREE.Vector3, rx: number, ry: number, rz: number) {
    const { s, i } = this.map[k];
    this.swarms[s].park(i, p, rx, ry, rz);
  }

  spawn(k: number, p: THREE.Vector3 | null, v: THREE.Vector3, spin = 6) {
    const { s, i } = this.map[k];
    this.swarms[s].spawn(i, p, v, spin);
  }

  positionOf(k: number, out: THREE.Vector3) {
    const { s, i } = this.map[k];
    return this.swarms[s].positionOf(i, out);
  }

  hideAll() {
    for (const s of this.swarms) s.hideAll();
  }

  settleAll() {
    for (const s of this.swarms) s.settleAll();
  }

  /** Staggered departures across `spread` seconds in the given global order. */
  assemble(order: number[], spread: number, duration: number, hop: number): Promise<void> {
    const per: number[][] = this.swarms.map(() => []);
    const when: number[][] = this.swarms.map(() => []);
    order.forEach((k, idx) => {
      const { s, i } = this.map[k];
      per[s].push(i);
      when[s].push((idx / Math.max(1, order.length - 1)) * spread);
    });
    return Promise.all(this.swarms.map((sw, si) => (per[si].length ? sw.assemble(per[si], when[si], duration, hop) : Promise.resolve()))).then(() => undefined);
  }

  setScanMode(on: boolean) {
    for (const s of this.swarms) s.setScanMode(on);
  }

  update(dt: number) {
    for (const s of this.swarms) s.update(dt);
  }

  dispose() {
    for (const s of this.swarms) s.dispose();
  }
}

export function toonMaterial(map: THREE.Texture) {
  return new THREE.MeshToonMaterial({ color: '#ffffff', map, gradientMap: toonGradient() });
}
