import * as THREE from 'three';
import { VoxelGrid, voxelMesh } from '../engine/voxel';
import { Particles } from '../products/common/props';

const INK = '#1d1b26';
const FUR = '#f4a261';
const FUR_D = '#d9823f';
const WHITE = '#fff8f0';

function catGrid(frame: 'walkA' | 'walkB' | 'sit'): VoxelGrid {
  const g = new VoxelGrid(16, 13, 7);
  const sit = frame === 'sit';
  // body
  if (sit) {
    g.box(4, 1, 1, 9, 6, 5, FUR);
    g.box(5, 1, 5, 8, 4, 5, WHITE);
  } else {
    g.box(3, 3, 1, 11, 6, 5, FUR);
    g.box(4, 3, 5, 10, 3, 5, WHITE);
    for (let x = 4; x <= 10; x += 3) g.box(x, 6, 1, x, 6, 5, FUR_D);
  }
  // head
  const hx = sit ? 8 : 10;
  const hy = sit ? 6 : 5;
  g.box(hx, hy, 1, hx + 4, hy + 4, 5, FUR);
  g.box(hx, hy + 5, 1, hx, hy + 5, 1, FUR);
  g.box(hx + 4, hy + 5, 1, hx + 4, hy + 5, 1, FUR);
  g.box(hx, hy + 5, 5, hx, hy + 5, 5, FUR);
  g.box(hx + 4, hy + 5, 5, hx + 4, hy + 5, 5, FUR);
  g.box(hx + 5, hy + 1, 2, hx + 5, hy + 2, 4, WHITE); // muzzle
  g.set(hx + 5, hy + 3, 2, INK).set(hx + 5, hy + 3, 4, INK); // eyes
  g.set(hx + 6, hy + 2, 3, '#ff8fa3'); // nose
  // legs
  if (sit) {
    g.box(5, 0, 1, 5, 0, 2, WHITE);
    g.box(5, 0, 4, 5, 0, 5, WHITE);
    g.box(8, 0, 2, 9, 0, 4, WHITE);
  } else {
    const a = frame === 'walkA';
    g.box(a ? 4 : 5, 0, 1, a ? 4 : 5, 2, 1, FUR_D);
    g.box(a ? 5 : 4, 0, 5, a ? 5 : 4, 2, 5, FUR_D);
    g.box(a ? 10 : 9, 0, 1, a ? 10 : 9, 2, 1, FUR_D);
    g.box(a ? 9 : 10, 0, 5, a ? 9 : 10, 2, 5, FUR_D);
  }
  // tail
  if (sit) g.box(2, 1, 3, 3, 1, 3, FUR_D).box(1, 2, 3, 1, 4, 3, FUR_D);
  else g.box(1, 6, 3, 2, 6, 3, FUR_D).box(0, 7, 3, 0, 9, 3, FUR_D);
  return g;
}

/** The store cat wanders the aisle floor. Pet it for hearts (and a small daily tip). */
export class StoreCat {
  readonly group = new THREE.Group();
  readonly hit: THREE.Mesh;
  private frames: THREE.Mesh[];
  private x: number;
  private target: number;
  private state: 'walk' | 'sit' = 'sit';
  private timer = 2;
  private t = 0;
  private hearts = new Particles(60, { glow: true });
  private jump = 0;

  constructor(x: number, private z: number) {
    this.x = x;
    this.target = x;
    this.frames = (['walkA', 'walkB', 'sit'] as const).map((f) => voxelMesh(catGrid(f), { scale: 0.035, anchor: 'bottom-center' }));
    for (const f of this.frames) this.group.add(f);
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.35), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = 0.22;
    this.group.add(this.hit);
    this.group.position.set(x, 0, z);
    this.show(2);
  }

  get particles() {
    return this.hearts.mesh;
  }

  private show(i: number) {
    this.frames.forEach((f, k) => (f.visible = k === i));
  }

  pet() {
    this.state = 'sit';
    this.timer = 3;
    this.jump = 1;
    const p = this.group.position.clone().add(new THREE.Vector3(0, 0.5, 0));
    this.hearts.burst(p, { count: 10, color: ['#ff5d8f', '#ff8fa3', '#ffd23f'], speed: 0.5, up: 1.6, size: 0.05, gravity: -0.5, life: 1.3 });
  }

  update(dt: number, camX: number) {
    this.t += dt;
    this.timer -= dt;
    if (this.timer <= 0) {
      if (this.state === 'sit') {
        this.state = 'walk';
        // wander somewhere on screen, near the shopper
        this.target = THREE.MathUtils.clamp(camX + (Math.random() - 0.5) * 5, -6.5, 38.5);
        this.timer = 10;
      } else {
        this.state = 'sit';
        this.timer = 2 + Math.random() * 4;
      }
    }
    // stay roughly in view if the camera runs off
    if (Math.abs(this.x - camX) > 6 && this.state === 'sit') {
      this.state = 'walk';
      this.target = camX + (this.x < camX ? -2 : 2);
      this.timer = 10;
    }
    if (this.state === 'walk') {
      const d = this.target - this.x;
      const speed = Math.abs(this.x - camX) > 5 ? 3.2 : 0.9;
      const step = Math.sign(d) * Math.min(Math.abs(d), speed * dt);
      this.x += step;
      this.group.rotation.y = d < 0 ? Math.PI : 0;
      this.show(Math.floor(this.t * 7) % 2);
      if (Math.abs(d) < 0.02) {
        this.state = 'sit';
        this.timer = 2 + Math.random() * 4;
      }
    } else this.show(2);
    this.jump = Math.max(0, this.jump - dt * 2.5);
    this.group.position.set(this.x, Math.sin(this.jump * Math.PI) * 0.25, this.z);
    this.hearts.update(dt);
  }
}
