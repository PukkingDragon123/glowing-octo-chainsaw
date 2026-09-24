import * as THREE from 'three';
import { LAYER_NO_OUTLINE } from '../../engine/PixelRenderer';

const SEG = 7;
const Z = new THREE.Vector3(0, 0, 1);

/**
 * Pooled electric arcs: each bolt is a jagged chain of thin boxes (white core + additive neon glow)
 * that re-rolls its path a few times per second while it lives. No allocations per frame.
 */
export class Bolts {
  readonly core: THREE.InstancedMesh;
  readonly glow: THREE.InstancedMesh;
  private readonly max: number;
  private readonly life: Float32Array;
  private readonly total: Float32Array;
  private readonly reroll: Float32Array;
  private readonly ends: Float32Array;
  private readonly jitter: Float32Array;
  private readonly thick: Float32Array;
  private readonly pts: Float32Array;
  private next = 0;
  private dirty = false;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private d = new THREE.Vector3();
  private r = new THREE.Vector3();
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(max: number, glowColor: string) {
    this.max = max;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const n = max * SEG;
    this.core = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, toneMapped: false }), n);
    this.glow = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), n);
    for (const mesh of [this.core, this.glow]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.layers.set(LAYER_NO_OUTLINE);
      mesh.renderOrder = 5;
      for (let i = 0; i < n; i++) mesh.setMatrixAt(i, this.zero);
    }
    this.life = new Float32Array(max);
    this.total = new Float32Array(max);
    this.reroll = new Float32Array(max);
    this.ends = new Float32Array(max * 6);
    this.jitter = new Float32Array(max);
    this.thick = new Float32Array(max);
    this.pts = new Float32Array(max * (SEG + 1) * 3);
  }

  get alive() {
    for (let i = 0; i < this.max; i++) if (this.life[i] > 0) return true;
    return false;
  }

  fire(from: THREE.Vector3, to: THREE.Vector3, opts: { life?: number; jitter?: number; thick?: number } = {}) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.life[i] = this.total[i] = opts.life ?? 0.14;
    this.jitter[i] = opts.jitter ?? 0.12;
    this.thick[i] = opts.thick ?? 1;
    this.ends[i * 6] = from.x;
    this.ends[i * 6 + 1] = from.y;
    this.ends[i * 6 + 2] = from.z;
    this.ends[i * 6 + 3] = to.x;
    this.ends[i * 6 + 4] = to.y;
    this.ends[i * 6 + 5] = to.z;
    this.reroll[i] = 0;
    this.dirty = true;
  }

  clear() {
    this.life.fill(0);
    const n = this.max * SEG;
    for (let i = 0; i < n; i++) {
      this.core.setMatrixAt(i, this.zero);
      this.glow.setMatrixAt(i, this.zero);
    }
    this.core.instanceMatrix.needsUpdate = true;
    this.glow.instanceMatrix.needsUpdate = true;
    this.dirty = false;
  }

  private roll(i: number) {
    const e = this.ends;
    this.a.set(e[i * 6], e[i * 6 + 1], e[i * 6 + 2]);
    this.b.set(e[i * 6 + 3], e[i * 6 + 4], e[i * 6 + 5]);
    this.d.subVectors(this.b, this.a);
    const len = this.d.length();
    this.d.multiplyScalar(1 / Math.max(1e-5, len));
    const base = i * (SEG + 1) * 3;
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG;
      // random direction perpendicular to the bolt
      this.r.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      this.r.addScaledVector(this.d, -this.r.dot(this.d)).normalize();
      const amp = k === 0 || k === SEG ? 0 : this.jitter[i] * len * Math.sin(Math.PI * t) * (0.5 + Math.random() * 0.7);
      this.pts[base + k * 3] = this.a.x + (this.b.x - this.a.x) * t + this.r.x * amp;
      this.pts[base + k * 3 + 1] = this.a.y + (this.b.y - this.a.y) * t + this.r.y * amp;
      this.pts[base + k * 3 + 2] = this.a.z + (this.b.z - this.a.z) * t + this.r.z * amp;
    }
  }

  update(dt: number) {
    if (!this.dirty) return;
    let any = false;
    for (let i = 0; i < this.max; i++) {
      const wasAlive = this.life[i] > 0;
      if (!wasAlive) continue;
      this.life[i] -= dt;
      const alive = this.life[i] > 0;
      if (alive) {
        any = true;
        this.reroll[i] -= dt;
        if (this.reroll[i] <= 0) {
          this.roll(i);
          this.reroll[i] = 0.045;
        }
      }
      const fade = alive ? Math.min(1, (this.life[i] / this.total[i]) * 2.5) : 0;
      const base = i * (SEG + 1) * 3;
      for (let k = 0; k < SEG; k++) {
        const idx = i * SEG + k;
        if (!alive) {
          this.core.setMatrixAt(idx, this.zero);
          this.glow.setMatrixAt(idx, this.zero);
          continue;
        }
        const p = base + k * 3;
        this.a.set(this.pts[p], this.pts[p + 1], this.pts[p + 2]);
        this.b.set(this.pts[p + 3], this.pts[p + 4], this.pts[p + 5]);
        this.d.subVectors(this.b, this.a);
        const len = this.d.length();
        if (len < 1e-5) continue;
        this.q.setFromUnitVectors(Z, this.d.multiplyScalar(1 / len));
        this.a.add(this.b).multiplyScalar(0.5);
        const th = 0.014 * this.thick[i] * fade;
        this.s.set(th, th, len + th);
        this.m.compose(this.a, this.q, this.s);
        this.core.setMatrixAt(idx, this.m);
        this.s.set(th * 3.2, th * 3.2, len + th * 2);
        this.m.compose(this.a, this.q, this.s);
        this.glow.setMatrixAt(idx, this.m);
      }
    }
    this.core.instanceMatrix.needsUpdate = true;
    this.glow.instanceMatrix.needsUpdate = true;
    this.dirty = any;
  }

  /** Random point on the endpoints of the last-fired arc (for spark bursts). */
  endOf(i: number, out: THREE.Vector3) {
    return out.set(this.ends[i * 6 + 3], this.ends[i * 6 + 4], this.ends[i * 6 + 5]);
  }

  dispose() {
    this.core.geometry.dispose();
    (this.core.material as THREE.Material).dispose();
    (this.glow.material as THREE.Material).dispose();
    this.core.dispose();
    this.glow.dispose();
  }
}
