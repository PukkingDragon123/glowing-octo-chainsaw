import * as THREE from 'three';
import { toonGradient } from '../../engine/voxel';
import type { ModuleSpot } from './qrLayout';
import { KIND_ALIGNMENT, KIND_FINDER } from '../../qr/qr';

export interface SwarmOptions {
  geometry: THREE.BufferGeometry;
  material?: THREE.Material;
  targets: THREE.Vector3[];
  targetQuats?: THREE.Quaternion[];
  colors: THREE.Color[];
  scanColors?: THREE.Color[];
  /** Base scale per piece (or one for all). */
  scale: THREE.Vector3 | THREE.Vector3[];
  /** Multiplier applied to settled pieces in scan mode (e.g. grow to close gaps). */
  scanScale?: THREE.Vector3;
  /** Collision radius used for floor/walls/neighbours. */
  radius: number;
  floor?: (x: number, z: number) => number;
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  gravity?: number;
  restitution?: number;
  friction?: number;
  collide?: boolean;
  /** Rolling spin (spheres) vs tumbling (cubes, flat pieces). */
  roll?: boolean;
  castShadow?: boolean;
}

const HIDDEN = 0;
const PHYSICS = 1;
const FLYING = 2;
const SETTLED = 3;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * A crowd of instanced pieces (candies, cereal, ice…) that can bounce around with cheap physics
 * and then hop into their QR module positions.
 */
export class PieceSwarm {
  readonly mesh: THREE.InstancedMesh;
  readonly count: number;
  readonly pos: Float32Array;
  readonly vel: Float32Array;
  readonly ang: Float32Array;
  readonly quat: THREE.Quaternion[];
  readonly state: Uint8Array;
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
  private scales: THREE.Vector3[];
  private opts: Required<Pick<SwarmOptions, 'gravity' | 'restitution' | 'friction' | 'radius'>> & SwarmOptions;
  onLand: ((i: number) => void) | null = null;
  onBounce: ((i: number, speed: number) => void) | null = null;

  constructor(opts: SwarmOptions) {
    this.opts = { gravity: 9.8, restitution: 0.35, friction: 2.5, ...opts };
    const n = opts.targets.length;
    this.count = n;
    const mat = opts.material ?? new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: toonGradient() });
    this.mesh = new THREE.InstancedMesh(opts.geometry, mat, Math.max(1, n));
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = opts.castShadow ?? true;
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
    this.scales = Array.isArray(opts.scale) ? opts.scale : Array.from({ length: n }, () => opts.scale as THREE.Vector3);
    for (let i = 0; i < n; i++) this.mesh.setColorAt(i, opts.colors[i]);
    if (n === 0) this.mesh.count = 0;
    this.hideAll();
  }

  hideAll() {
    this.state.fill(HIDDEN);
    this.writeAll();
  }

  spawn(i: number, p: THREE.Vector3, v: THREE.Vector3, spin = 6) {
    this.state[i] = PHYSICS;
    this.pos[i * 3] = p.x;
    this.pos[i * 3 + 1] = p.y;
    this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x;
    this.vel[i * 3 + 1] = v.y;
    this.vel[i * 3 + 2] = v.z;
    this.ang[i * 3] = (Math.random() - 0.5) * spin;
    this.ang[i * 3 + 1] = (Math.random() - 0.5) * spin;
    this.ang[i * 3 + 2] = (Math.random() - 0.5) * spin;
    this.quat[i].setFromEuler(new THREE.Euler(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28));
  }

  /** Knock every visible piece loose from where it is now, with a velocity chosen per piece. */
  kick(velocity: (i: number, pos: THREE.Vector3) => THREE.Vector3, spin = 8) {
    const p = new THREE.Vector3();
    for (let i = 0; i < this.count; i++) {
      if (this.state[i] === HIDDEN) continue;
      this.positionOf(i, p);
      const v = velocity(i, p);
      this.state[i] = PHYSICS;
      this.vel[i * 3] = v.x;
      this.vel[i * 3 + 1] = v.y;
      this.vel[i * 3 + 2] = v.z;
      this.ang[i * 3] = (Math.random() - 0.5) * spin;
      this.ang[i * 3 + 1] = (Math.random() - 0.5) * spin;
      this.ang[i * 3 + 2] = (Math.random() - 0.5) * spin;
    }
  }

  /** Place a piece directly at its target (finished state). */
  settle(i: number) {
    const t = this.opts.targets[i];
    this.state[i] = SETTLED;
    this.pos[i * 3] = t.x;
    this.pos[i * 3 + 1] = t.y;
    this.pos[i * 3 + 2] = t.z;
    if (this.opts.targetQuats) this.quat[i].copy(this.opts.targetQuats[i]);
    else this.quat[i].identity();
  }

  settleAll() {
    for (let i = 0; i < this.count; i++) this.settle(i);
    if (this.resolveAssemble) {
      const r = this.resolveAssemble;
      this.resolveAssemble = null;
      this.pending = 0;
      r();
    }
    this.writeAll();
  }

  /**
   * Hop every piece to its target. `order` lists piece indices in the sequence they should move;
   * `spread` is the total time over which departures are staggered.
   */
  assemble(order: number[], spread = 1.6, duration = 0.55, hop = 0.3, delay = 0): Promise<void> {
    return new Promise((resolve) => {
      this.pending = 0;
      order.forEach((i, k) => {
        if (this.state[i] === SETTLED) return;
        if (this.state[i] === HIDDEN) {
          // hidden pieces pop in from above their target
          const t = this.opts.targets[i];
          this.pos[i * 3] = t.x;
          this.pos[i * 3 + 1] = t.y + hop * 3;
          this.pos[i * 3 + 2] = t.z;
        }
        this.pending++;
        this.state[i] = FLYING;
        this.hopFrom[i * 3] = this.pos[i * 3];
        this.hopFrom[i * 3 + 1] = this.pos[i * 3 + 1];
        this.hopFrom[i * 3 + 2] = this.pos[i * 3 + 2];
        this.hopQuat[i].copy(this.quat[i]);
        this.hopT0[i] = this.time + delay + (order.length > 1 ? (k / (order.length - 1)) * spread : 0);
        this.hopDur[i] = duration * (0.85 + Math.random() * 0.3);
        this.hopH[i] = hop * (0.7 + Math.random() * 0.6);
      });
      if (this.pending === 0) resolve();
      else this.resolveAssemble = resolve;
    });
  }

  setScanMode(on: boolean) {
    this.scanTarget = on ? 1 : 0;
  }

  private writeAll() {
    for (let i = 0; i < this.count; i++) this.writeOne(i);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private writeOne(i: number) {
    if (this.state[i] === HIDDEN) {
      _m.makeScale(0, 0, 0);
    } else {
      _v.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      _s.copy(this.scales[i]);
      const ss = this.opts.scanScale;
      if (ss && this.state[i] === SETTLED && this.scanT > 0) {
        _s.x *= 1 + (ss.x - 1) * this.scanT;
        _s.y *= 1 + (ss.y - 1) * this.scanT;
        _s.z *= 1 + (ss.z - 1) * this.scanT;
      }
      _m.compose(_v, this.quat[i], _s);
    }
    this.mesh.setMatrixAt(i, _m);
  }

  update(dt: number) {
    this.time += dt;
    const o = this.opts;
    const floor = o.floor ?? (() => 0);
    const r = o.radius;
    let moved = false;
    let hash: Map<number, number[]> | null = null;
    if (o.collide) hash = new Map();

    for (let i = 0; i < this.count; i++) {
      const st = this.state[i];
      if (st === PHYSICS) {
        moved = true;
        const k = i * 3;
        this.vel[k + 1] -= o.gravity * dt;
        this.pos[k] += this.vel[k] * dt;
        this.pos[k + 1] += this.vel[k + 1] * dt;
        this.pos[k + 2] += this.vel[k + 2] * dt;
        const fy = floor(this.pos[k], this.pos[k + 2]) + r;
        let grounded = false;
        if (this.pos[k + 1] < fy) {
          this.pos[k + 1] = fy;
          if (this.vel[k + 1] < 0) {
            const sp = -this.vel[k + 1];
            if (sp > 0.6) this.onBounce?.(i, sp);
            this.vel[k + 1] = sp > 0.4 ? sp * o.restitution : 0;
          }
          grounded = true;
          const f = Math.exp(-o.friction * dt);
          this.vel[k] *= f;
          this.vel[k + 2] *= f;
          this.ang[k] *= f;
          this.ang[k + 1] *= f;
          this.ang[k + 2] *= f;
        }
        if (o.bounds) {
          const b = o.bounds;
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
        }
        // orientation
        if (grounded && o.roll) {
          const vx = this.vel[k];
          const vz = this.vel[k + 2];
          const sp = Math.hypot(vx, vz);
          if (sp > 1e-4) {
            _axis.set(vz, 0, -vx).normalize();
            _q.setFromAxisAngle(_axis, (sp / r) * dt);
            this.quat[i].premultiply(_q);
          }
        } else {
          _axis.set(this.ang[k], this.ang[k + 1], this.ang[k + 2]);
          const a = _axis.length();
          if (a > 1e-4) {
            _q.setFromAxisAngle(_axis.multiplyScalar(1 / a), a * dt);
            this.quat[i].premultiply(_q);
          }
        }
        if (hash && this.pos[k + 1] < fy + r * 2) {
          const key = (Math.floor(this.pos[k] / (r * 2)) + 5000) * 10007 + Math.floor(this.pos[k + 2] / (r * 2)) + 5000;
          const cell = hash.get(key);
          if (cell) cell.push(i);
          else hash.set(key, [i]);
        }
      } else if (st === FLYING) {
        moved = true;
        const t0 = this.hopT0[i];
        if (this.time < t0) continue;
        const t = Math.min(1, (this.time - t0) / this.hopDur[i]);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const target = o.targets[i];
        const k = i * 3;
        this.pos[k] = this.hopFrom[k] + (target.x - this.hopFrom[k]) * e;
        this.pos[k + 1] = this.hopFrom[k + 1] + (target.y - this.hopFrom[k + 1]) * e + this.hopH[i] * 4 * t * (1 - t);
        this.pos[k + 2] = this.hopFrom[k + 2] + (target.z - this.hopFrom[k + 2]) * e;
        _q2.copy(o.targetQuats ? o.targetQuats[i] : _q.identity());
        this.quat[i].copy(this.hopQuat[i]).slerp(_q2, e);
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

    if (hash) {
      const minD = r * 2;
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
              for (let bIdx = other === cell ? a + 1 : 0; bIdx < other.length; bIdx++) {
                const ib = other[bIdx];
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

    if (moved) this.writeAll();

    if (Math.abs(this.scanT - this.scanTarget) > 1e-3) {
      this.scanT += Math.sign(this.scanTarget - this.scanT) * Math.min(Math.abs(this.scanTarget - this.scanT), dt * 2.5);
      if (o.scanColors) {
        for (let i = 0; i < this.count; i++) {
          _c.copy(o.colors[i]).lerp(o.scanColors[i], this.scanT);
          this.mesh.setColorAt(i, _c);
        }
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      }
      if (o.scanScale) this.writeAll();
    }
  }

  /** Is every piece at rest in its QR spot? */
  get settled() {
    for (let i = 0; i < this.count; i++) if (this.state[i] !== SETTLED) return false;
    return true;
  }

  positionOf(i: number, out = new THREE.Vector3()) {
    return out.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

export function scaleVec(x: number, y = x, z = x) {
  return _s.set(x, y, z).clone();
}

export { UP };

// -------------------------------------------------------------------------------------------------

/** Finder + alignment modules must stay square for scanners; everything else may be round. */
export function isStructural(kind: number) {
  return kind === KIND_FINDER || kind === KIND_ALIGNMENT;
}

export interface QRSwarmOptions extends Omit<SwarmOptions, 'geometry' | 'material' | 'targets' | 'targetQuats' | 'colors' | 'scanColors' | 'scale' | 'scanScale'> {
  spots: ModuleSpot[];
  data: { geometry: THREE.BufferGeometry; material?: THREE.Material; scale: THREE.Vector3; scanScale?: THREE.Vector3; color: (s: ModuleSpot) => [THREE.Color, THREE.Color]; quat?: (s: ModuleSpot) => THREE.Quaternion };
  /** Pieces for finder/alignment modules (square-ish). Defaults to the data settings. */
  struct?: { geometry: THREE.BufferGeometry; material?: THREE.Material; scale: THREE.Vector3; scanScale?: THREE.Vector3; color: (s: ModuleSpot) => [THREE.Color, THREE.Color]; quat?: (s: ModuleSpot) => THREE.Quaternion };
}

/**
 * Two instanced swarms driven as one: round/fancy pieces for data modules and square pieces for the
 * finder & alignment patterns, so stylised codes still scan. Pieces are addressed by spot index.
 */
export class QRSwarm {
  readonly swarms: PieceSwarm[] = [];
  readonly spots: ModuleSpot[];
  private map: { s: number; i: number }[] = [];
  private backs: number[][] = [];
  onLand: ((spot: number) => void) | null = null;
  onBounce: ((spot: number, speed: number) => void) | null = null;

  constructor(o: QRSwarmOptions) {
    this.spots = o.spots;
    const groups: { cfg: NonNullable<QRSwarmOptions['struct']>; idx: number[] }[] = [{ cfg: o.data, idx: [] }];
    if (o.struct) groups.push({ cfg: o.struct, idx: [] });
    o.spots.forEach((s, k) => {
      const g = o.struct && isStructural(s.kind) ? 1 : 0;
      groups[g].idx.push(k);
    });
    groups.forEach((g, gi) => {
      const cols = g.idx.map((k) => g.cfg.color(o.spots[k]));
      const sw = new PieceSwarm({
        ...o,
        geometry: g.cfg.geometry,
        material: g.cfg.material,
        targets: g.idx.map((k) => o.spots[k].pos),
        targetQuats: g.idx.map((k) => (g.cfg.quat ? g.cfg.quat(o.spots[k]) : new THREE.Quaternion())),
        colors: cols.map((c) => c[0]),
        scanColors: cols.map((c) => c[1]),
        scale: g.cfg.scale,
        scanScale: g.cfg.scanScale,
      });
      g.idx.forEach((k, i) => (this.map[k] = { s: gi, i }));
      const back: number[] = g.idx;
      this.backs[gi] = back;
      sw.onLand = (i) => this.onLand?.(back[i]);
      sw.onBounce = (i, sp) => this.onBounce?.(back[i], sp);
      this.swarms.push(sw);
    });
  }

  get count() {
    return this.spots.length;
  }

  get meshes() {
    return this.swarms.map((s) => s.mesh);
  }

  spawn(k: number, p: THREE.Vector3, v: THREE.Vector3, spin = 6) {
    const { s, i } = this.map[k];
    this.swarms[s].spawn(i, p, v, spin);
  }

  positionOf(k: number, out = new THREE.Vector3()) {
    const { s, i } = this.map[k];
    return this.swarms[s].positionOf(i, out);
  }

  hideAll() {
    for (const s of this.swarms) s.hideAll();
  }

  kick(velocity: (spot: number, pos: THREE.Vector3) => THREE.Vector3, spin = 8) {
    this.swarms.forEach((sw, si) => sw.kick((i, pos) => velocity(this.backs[si][i], pos), spin));
  }

  settleAll() {
    for (const s of this.swarms) s.settleAll();
  }

  assemble(order: number[], spread = 1.6, duration = 0.55, hop = 0.3): Promise<void> {
    // keep the global order/timing by converting to per-swarm orders with matching delays
    const per: number[][] = this.swarms.map(() => []);
    const when: number[][] = this.swarms.map(() => []);
    order.forEach((k, idx) => {
      const { s, i } = this.map[k];
      per[s].push(i);
      when[s].push(idx / Math.max(1, order.length - 1));
    });
    return Promise.all(
      this.swarms.map((sw, si) => {
        if (!per[si].length) return Promise.resolve();
        const first = when[si][0];
        const last = when[si][when[si].length - 1];
        return sw.assemble(per[si], spread * Math.max(0.05, last - first), duration, hop, first * spread);
      }),
    ).then(() => undefined);
  }

  setScanMode(on: boolean) {
    for (const s of this.swarms) s.setScanMode(on);
  }

  update(dt: number) {
    for (const s of this.swarms) s.update(dt);
  }

  get settled() {
    return this.swarms.every((s) => s.settled);
  }

  dispose() {
    for (const s of this.swarms) s.dispose();
  }
}
