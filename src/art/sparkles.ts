import * as THREE from 'three';
import { LAYER_NO_OUTLINE } from '../engine/PixelRenderer';
import { iconBitmap, type IconName } from './icons';
import { pixelTexture } from './pixel';

/**
 * Cute pixel-sprite particles: hearts, sparkles, bubbles, stars and notes that pop out, float and
 * shrink away. Camera-facing points with a crisp icon texture; one small pool per icon.
 */

export type SparkleKind = 'heart' | 'sparkle' | 'bubble' | 'star' | 'music';

const vert = /* glsl */ `
attribute float size;
attribute float spin;
uniform float uScale;
varying float vSpin;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / max(0.05, -mv.z);
  gl_Position = projectionMatrix * mv;
  vSpin = spin;
}`;
const frag = /* glsl */ `
uniform sampler2D map;
varying float vSpin;
void main() {
  vec2 uv = gl_PointCoord;
  uv.y = 1.0 - uv.y;
  if (vSpin > 0.5) uv.x = 1.0 - uv.x;
  vec4 c = texture2D(map, uv);
  if (c.a < 0.5) discard;
  gl_FragColor = vec4(c.rgb, 1.0);
  #include <colorspace_fragment>
}`;

class Pool {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private size: Float32Array;
  private spin: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private base: Float32Array;
  private grav: Float32Array;
  private next = 0;
  readonly mat: THREE.ShaderMaterial;

  constructor(icon: IconName, private n = 64) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.spin = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.base = new Float32Array(n);
    this.grav = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('spin', new THREE.BufferAttribute(this.spin, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { map: { value: pixelTexture(iconBitmap(icon).toCanvas()) }, uScale: { value: 300 } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.layers.set(LAYER_NO_OUTLINE);
    this.points.renderOrder = 5;
  }

  emit(at: THREE.Vector3, o: BurstOptions) {
    const count = o.count ?? 6;
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.n;
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 0.6) * (0.4 + Math.random() * 0.6);
      this.pos.set([at.x + (Math.random() - 0.5) * (o.jitter ?? 0.1), at.y + (Math.random() - 0.5) * (o.jitter ?? 0.1), at.z], i * 3);
      this.vel.set([Math.cos(a) * sp, (o.up ?? 1) * (0.5 + Math.random() * 0.7), Math.sin(a) * sp * 0.4], i * 3);
      this.max[i] = this.life[i] = (o.life ?? 1) * (0.7 + Math.random() * 0.5);
      this.base[i] = (o.size ?? 0.12) * (0.75 + Math.random() * 0.5);
      this.grav[i] = o.gravity ?? -0.4;
      this.spin[i] = Math.random() < 0.5 ? 1 : 0;
    }
    (this.points.geometry.attributes.spin as THREE.BufferAttribute).needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.size.fill(0);
    (this.points.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }

  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        this.size[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] -= this.grav[i] * dt;
      this.vel[k] *= 1 - dt * 1.5;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      const t = 1 - Math.max(0, this.life[i]) / this.max[i];
      // pop in fast, hold, shrink out
      const s = t < 0.15 ? t / 0.15 : t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      this.size[i] = this.life[i] > 0 ? this.base[i] * Math.max(0, s) * (t < 0.15 ? 1.2 : 1) : 0;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }
}

export interface BurstOptions {
  count?: number;
  speed?: number;
  up?: number;
  life?: number;
  /** World size of each sprite. */
  size?: number;
  /** Negative floats up. */
  gravity?: number;
  jitter?: number;
}

export class Sparkles {
  readonly group = new THREE.Group();
  private pools = new Map<SparkleKind, Pool>();

  constructor() {
    for (const k of ['heart', 'sparkle', 'bubble', 'star', 'music'] as SparkleKind[]) {
      const p = new Pool(k, 48);
      this.pools.set(k, p);
      this.group.add(p.points);
    }
  }

  /** Remove every live particle (e.g. before a scan view). */
  clear() {
    for (const p of this.pools.values()) p.clear();
  }

  burst(kind: SparkleKind, at: THREE.Vector3, o: BurstOptions = {}) {
    this.pools.get(kind)!.emit(at, o);
  }

  /** Keep sprite sizes right for the current camera and render height. */
  update(dt: number, camera: THREE.PerspectiveCamera, heightPx: number) {
    const scale = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    for (const p of this.pools.values()) {
      p.mat.uniforms.uScale.value = scale;
      p.update(dt);
    }
  }
}
