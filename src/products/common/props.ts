import * as THREE from 'three';
import { Batcher, paintGeometry, toonMat } from '../../engine/batch';
import { LAYER_NO_OUTLINE } from '../../engine/PixelRenderer';
import { toonGradient } from '../../engine/voxel';
import { shade } from '../../engine/Painter';

/**
 * Pooled particle bursts (splashes, sparkles, crumbs). Cubes by default — they read as pixels.
 */
export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private n: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private size: Float32Array;
  private gravity: Float32Array;
  private next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private c = new THREE.Color();
  floorY = -Infinity;

  constructor(max = 400, opts: { glow?: boolean; geometry?: THREE.BufferGeometry } = {}) {
    this.n = max;
    const geo = opts.geometry ?? new THREE.BoxGeometry(1, 1, 1);
    const mat = opts.glow ? new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }) : new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: toonGradient() });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(LAYER_NO_OUTLINE);
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.gravity = new Float32Array(max);
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
      this.mesh.setColorAt(i, this.c.set('#ffffff'));
    }
  }

  burst(at: THREE.Vector3, opts: { count?: number; color?: string | string[]; speed?: number; up?: number; life?: number; size?: number; gravity?: number; spread?: number }) {
    const count = opts.count ?? 12;
    const colors = Array.isArray(opts.color) ? opts.color : [opts.color ?? '#ffffff'];
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.n;
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed ?? 1.5) * (0.4 + Math.random() * 0.6);
      const spread = opts.spread ?? 1;
      this.pos.set([at.x, at.y, at.z], i * 3);
      this.vel.set([Math.cos(a) * sp * spread, (opts.up ?? 1.5) * (0.5 + Math.random() * 0.8), Math.sin(a) * sp * spread], i * 3);
      this.maxLife[i] = this.life[i] = (opts.life ?? 0.7) * (0.6 + Math.random() * 0.6);
      this.size[i] = (opts.size ?? 0.03) * (0.6 + Math.random() * 0.8);
      this.gravity[i] = opts.gravity ?? 6;
      this.mesh.setColorAt(i, this.c.set(colors[Math.floor(Math.random() * colors.length)]));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number) {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] -= this.gravity[i] * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < this.floorY) {
        this.pos[k + 1] = this.floorY;
        this.vel[k + 1] *= -0.3;
        this.vel[k] *= 0.6;
        this.vel[k + 2] *= 0.6;
      }
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      const s = this.life[i] <= 0 ? 0 : this.size[i] * Math.min(1, t * 3);
      this.v.set(this.pos[k], this.pos[k + 1], this.pos[k + 2]);
      this.s.set(s, s, s);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Square cereal bowl. Returns group + inner size + milk surface height. */
export function squareBowl(inner: number, color = '#ffffff', milk = '#fbf7ee') {
  const b = new Batcher();
  const wall = inner * 0.08;
  const h = inner * 0.26;
  const outer = inner + wall * 2;
  const rim = shade(color, -0.18);
  b.box(outer * 0.86, h * 0.18, outer * 0.86, shade(color, -0.2), 0, 0, 0);
  b.box(outer, h * 0.25, outer, color, 0, h * 0.14, 0);
  // walls
  b.box(outer, h, wall, color, 0, h * 0.14, inner / 2 + wall / 2);
  b.box(outer, h, wall, color, 0, h * 0.14, -inner / 2 - wall / 2);
  b.box(wall, h, inner, color, inner / 2 + wall / 2, h * 0.14, 0);
  b.box(wall, h, inner, color, -inner / 2 - wall / 2, h * 0.14, 0);
  // rim band + decorative stripe (four strips each, so the inside stays open)
  const ring = (y: number, hh: number, c: string, grow: number) => {
    const o = outer + grow;
    const t = wall + grow / 2;
    b.box(o, hh, t, c, 0, y, inner / 2 + t / 2);
    b.box(o, hh, t, c, 0, y, -inner / 2 - t / 2);
    b.box(t, hh, inner, c, inner / 2 + t / 2, y, 0);
    b.box(t, hh, inner, c, -inner / 2 - t / 2, y, 0);
  };
  ring(h * 0.14 + h * 0.9, h * 0.1, '#ffffff', 0.012);
  ring(h * 0.14 + h * 0.35, h * 0.1, rim, 0.012);
  const g = b.build();
  const milkY = h * 0.14 + h * 0.72;
  const milkMesh = new THREE.Mesh(new THREE.PlaneGeometry(inner, inner), new THREE.MeshToonMaterial({ color: milk, gradientMap: toonGradient() }));
  milkMesh.rotation.x = -Math.PI / 2;
  milkMesh.position.y = milkY;
  milkMesh.receiveShadow = true;
  g.add(milkMesh);
  return { group: g, inner, milkY, milkMesh, height: h };
}

/** Flat paper/placemat for pieces to land on. */
export function tray(w: number, d: number, color = '#ffffff', edge = '#e9e4da', thickness = 0.03) {
  const b = new Batcher();
  b.box(w, thickness, d, color, 0, 0, 0);
  b.box(w + 0.04, thickness * 0.6, d + 0.04, edge, 0, -thickness * 0.6, 0);
  const g = b.build();
  return { group: g, top: thickness };
}

/** Cheap soft shadow blob under objects that float. */
export function blobShadow(radius: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5) / 8;
      if (d < 1) {
        ctx.fillStyle = `rgba(20,16,40,${d < 0.6 ? 0.35 : 0.18})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.layers.set(LAYER_NO_OUTLINE);
  return m;
}

export function coloredBox(w: number, h: number, d: number, color: string) {
  const m = new THREE.Mesh(paintGeometry(new THREE.BoxGeometry(w, h, d), color), toonMat());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Pixel texture helper: tiny tile for instanced pieces (multiplied by instance colour). */
export function tileTexture(size: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
