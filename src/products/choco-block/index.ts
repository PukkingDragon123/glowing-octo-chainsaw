import * as THREE from 'three';
import { Painter, shade } from '../../engine/Painter';
import { ease } from '../../engine/tween';
import { audio } from '../../engine/audio';
import { toonGradient } from '../../engine/voxel';
import { Buddy } from '../../art/buddy';
import { CAST } from '../../art/cast';
import { paintBoxFaces, toonMat } from '../../engine/batch';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import { atlasBox } from '../common/box';
import { Particles } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import { CHOCO_FLAVORS, LABEL, POSTER, SLEEVE, foilTile, foilTriangle, foilWall, posterArt, sleeveBack, sleeveEdge, sleeveFront } from './art';

/** Bar size (square), slab thickness, foil wall height. */
const W = 1.9;
const H_BAR = 0.1;
const FOIL_H = 0.13;
const SLEEVE_W = W * 0.78;
const SLEEVE_T = FOIL_H + 0.03;
const QUIET = 2;
/** A little self-light keeps the foil reading as shiny metal rather than grey card. */
const FOIL_GLOW = new THREE.Color('#3a3f4a');

// -------------------------------------------------------------------------------------------------
// Pillow squares

/** Unit chocolate square: straight walls, then a chamfer up to a smaller top. Baked face shading. */
function pillowGeometry(): THREE.BufferGeometry {
  const S = 0.34;
  const T = 0.27;
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const face = (pts: number[][], k: number) => {
    a.fromArray(pts[0]);
    b.fromArray(pts[1]);
    c.fromArray(pts[2]);
    n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    // make sure the face points away from the square's core
    const centre = new THREE.Vector3();
    for (const p of pts) centre.add(new THREE.Vector3().fromArray(p));
    centre.multiplyScalar(1 / pts.length).sub(new THREE.Vector3(0, 0.35, 0));
    if (n.dot(centre) < 0) {
      pts = pts.slice().reverse();
      n.negate();
    }
    for (const i of [0, 1, 2, 0, 2, 3]) {
      pos.push(...pts[i]);
      nor.push(n.x, n.y, n.z);
      col.push(k, k, k);
    }
  };
  const h = 0.5;
  face([[-T, 1, -T], [T, 1, -T], [T, 1, T], [-T, 1, T]], 1);
  face([[-h, S, -h], [h, S, -h], [T, 1, -T], [-T, 1, -T]], 0.86);
  face([[-h, S, h], [h, S, h], [T, 1, T], [-T, 1, T]], 0.97);
  face([[-h, S, -h], [-h, S, h], [-T, 1, T], [-T, 1, -T]], 1);
  face([[h, S, -h], [h, S, h], [T, 1, T], [T, 1, -T]], 0.82);
  face([[-h, 0, -h], [h, 0, -h], [h, S, -h], [-h, S, -h]], 0.8);
  face([[-h, 0, h], [h, 0, h], [h, S, h], [-h, S, h]], 0.9);
  face([[-h, 0, -h], [-h, 0, h], [-h, S, h], [-h, S, -h]], 0.9);
  face([[h, 0, -h], [h, 0, h], [h, S, h], [h, S, -h]], 0.75);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

interface Cell {
  r: number;
  c: number;
  dark: boolean;
  x: number;
  z: number;
}

const _m4 = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _col = new THREE.Color();

/**
 * Every module (plus the quiet-zone border) is one instanced chocolate square that can pop up out of
 * the slab on a schedule. Scan mode swaps to camera-safe colours and closes the grooves.
 */
class PillowGrid {
  readonly mesh: THREE.InstancedMesh;
  readonly cells: Cell[];
  private t0: Float32Array;
  private popped: Uint8Array;
  private fun: THREE.Color[];
  private scan: THREE.Color[];
  private time = 0;
  private endAt = -1;
  private resolve: (() => void) | null = null;
  private scanT = 0;
  private scanTarget = 0;
  private dirty = true;
  private readonly dur = 0.42;
  onPop: ((i: number) => void) | null = null;

  constructor(cells: Cell[], private y: number, private m: number, private h: number, colors: (c: Cell) => [THREE.Color, THREE.Color]) {
    this.cells = cells;
    const n = cells.length;
    const mat = new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap: toonGradient() });
    this.mesh = new THREE.InstancedMesh(pillowGeometry(), mat, Math.max(1, n));
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.t0 = new Float32Array(n).fill(1e9);
    this.popped = new Uint8Array(n);
    this.fun = [];
    this.scan = [];
    cells.forEach((c, i) => {
      const [f, s] = colors(c);
      this.fun.push(f);
      this.scan.push(s);
      this.mesh.setColorAt(i, f);
    });
  }

  hideAll() {
    this.t0.fill(1e9);
    this.popped.fill(0);
    this.endAt = -1;
    this.dirty = true;
  }

  showAll() {
    this.t0.fill(-100);
    this.popped.fill(1);
    this.dirty = true;
    this.endAt = -1;
    const r = this.resolve;
    this.resolve = null;
    r?.();
  }

  /** Pop squares up in `order`, staggered across `spread` seconds. Resolves when the last one lands. */
  popWave(order: number[], spread: number): Promise<void> {
    const n = order.length;
    order.forEach((i, k) => {
      this.t0[i] = this.time + (n > 1 ? (k / (n - 1)) * spread : 0);
      this.popped[i] = 0;
    });
    this.endAt = this.time + spread + this.dur;
    this.dirty = true;
    return new Promise((res) => (this.resolve = res));
  }

  setScanMode(on: boolean) {
    this.scanTarget = on ? 1 : 0;
    // no self-shadowing in scan mode: it would grey the white squares next to dark ones
    this.mesh.castShadow = !on;
  }

  update(dt: number) {
    this.time += dt;
    const animating = this.endAt > 0 && this.time <= this.endAt + dt;
    if (Math.abs(this.scanT - this.scanTarget) > 1e-3) {
      this.scanT += Math.sign(this.scanTarget - this.scanT) * Math.min(Math.abs(this.scanTarget - this.scanT), dt * 3);
      for (let i = 0; i < this.cells.length; i++) this.mesh.setColorAt(i, _col.copy(this.fun[i]).lerp(this.scan[i], this.scanT));
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      this.dirty = true;
    }
    if (animating || this.dirty) this.write();
    if (this.endAt > 0 && this.time > this.endAt) {
      this.endAt = -1;
      const r = this.resolve;
      this.resolve = null;
      r?.();
    }
  }

  private write() {
    this.dirty = false;
    const m = this.m;
    const grow = 0.955 + 0.08 * this.scanT;
    const flat = 1 - 0.45 * this.scanT;
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];
      const u = (this.time - this.t0[i]) / this.dur;
      if (u < 0) {
        _m4.makeScale(0, 0, 0);
      } else {
        if (!this.popped[i]) {
          this.popped[i] = 1;
          this.onPop?.(i);
        }
        let sy = 1;
        let sxz = 1;
        let lift = 0;
        if (u < 1) {
          sy = ease.outBack(u);
          sxz = 0.72 + 0.28 * ease.outBack(Math.min(1, u * 1.6));
          lift = Math.sin(Math.min(1, u * 1.25) * Math.PI) * m * 0.55;
        }
        _p.set(cell.x, this.y + lift, cell.z);
        _s.set(m * grow * sxz, this.h * sy * flat + 1e-4, m * grow * sxz);
        _m4.compose(_p, _q, _s);
      }
      this.mesh.setMatrixAt(i, _m4);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}

// -------------------------------------------------------------------------------------------------
// Packaging

function sleeveMesh(f: Flavor, s: number, mip: boolean) {
  const end = new Painter(SLEEVE.h, 8).clear(f.c.deep);
  end.rect(0, 0, SLEEVE.h, 1, shade(f.c.main, 0.1));
  const edge = sleeveEdge(f, SLEEVE.w, 8).canvas;
  return atlasBox(SLEEVE_W * s, SLEEVE_T * s, (W + 0.03) * s, { px: end.canvas, nx: end.canvas, py: sleeveFront(f).canvas, ny: sleeveBack(f).canvas, pz: edge, nz: edge }, { mipmaps: mip });
}

function foilTexture(mip: boolean) {
  const t = foilTile(48, 5).texture(true);
  if (mip) {
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
  }
  return t;
}

interface Flap {
  a: THREE.Group;
  b: THREE.Group;
  tri: THREE.Mesh;
}

function pixelTex(p: Painter) {
  return p.texture(false);
}

/** Foil wrap as four hinged flaps: a wall segment (hinged on the counter) + a triangle over the top. */
function foilFlaps() {
  const group = new THREE.Group();
  const flaps: Flap[] = [];
  const wallMat = new THREE.MeshToonMaterial({ map: pixelTex(foilWall(96, 8, 9)), gradientMap: toonGradient(), side: THREE.DoubleSide, emissive: FOIL_GLOW });
  const triMats = [3, 4, 5, 6].map((seed) => new THREE.MeshToonMaterial({ map: pixelTex(foilTriangle(96, 48, seed)), gradientMap: toonGradient(), side: THREE.DoubleSide, emissive: FOIL_GLOW }));
  const sideGeo = new THREE.PlaneGeometry(W, FOIL_H);
  sideGeo.translate(0, FOIL_H / 2, 0);
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-W / 2, 0, 0, W / 2, 0, 0, 0, W / 2, 0], 3));
  tri.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  for (let k = 0; k < 4; k++) {
    const holder = new THREE.Group();
    holder.rotation.y = (k * Math.PI) / 2;
    group.add(holder);
    const a = new THREE.Group();
    a.position.set(0, 0.004, -W / 2 - 0.006);
    holder.add(a);
    const side = new THREE.Mesh(sideGeo, wallMat);
    side.castShadow = true;
    a.add(side);
    const b = new THREE.Group();
    b.position.set(0, FOIL_H, 0);
    a.add(b);
    // (no receiveShadow: the double-sided foil would shadow itself into a dull grey)
    const t = new THREE.Mesh(tri, triMats[k]);
    t.castShadow = true;
    b.add(t);
    flaps.push({ a, b, tri: t });
  }
  // a sheet under the folded flaps so the seams never show the chocolate through
  const under = new THREE.Mesh(new THREE.PlaneGeometry(W, W), wallMat);
  under.rotation.x = -Math.PI / 2;
  under.position.y = FOIL_H - 0.004;
  group.add(under);
  const materials = [wallMat, ...triMats];
  return { group, flaps, materials, under };
}

/**
 * 0 = wrapped, 1 = peeled back. The triangle opens first, then the wall drops outward; the foil ends
 * up crumpled back into a curled silver rim around the bar.
 */
function setFlap(fl: Flap, t: number) {
  const tb = Math.min(1, t * 1.7);
  const ta = Math.max(0, (t - 0.35) / 0.65);
  const ea = ta < 1 ? ease.outBounce(ta) : 1;
  fl.b.rotation.x = (Math.PI / 2) * (1 - ease.outCubic(tb)) + 0.42 * ea;
  fl.a.rotation.x = -(Math.PI / 2 - 0.07) * ea;
  fl.tri.scale.set(1, 1 - 0.5 * ease.inOutQuad(Math.max(0, (t - 0.2) / 0.8)), 1);
}

/** Shelf / standing pack: foil block + paper sleeve, standing up and facing +Z. */
function packModel(f: Flavor, s: number) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  const foilMat = new THREE.MeshToonMaterial({ map: foilTexture(true), gradientMap: toonGradient(), emissive: FOIL_GLOW });
  const foil = new THREE.Mesh(new THREE.BoxGeometry(W * s, FOIL_H * s, W * s), foilMat);
  foil.position.y = (FOIL_H / 2) * s;
  foil.castShadow = true;
  inner.add(foil);
  const sleeve = sleeveMesh(f, s, true);
  sleeve.position.y = (FOIL_H / 2) * s;
  inner.add(sleeve);
  inner.rotation.x = Math.PI / 2;
  inner.position.set(0, (W / 2) * s, -(FOIL_H / 2) * s);
  g.add(inner);
  return g;
}

// -------------------------------------------------------------------------------------------------

function createShowcase(ctx: ProductContext): ShowcaseItem {
  const { qr, flavor: f, tweens, group: tg } = ctx;
  const root = new THREE.Group();
  const barPos = new THREE.Vector3(0.25, 0, 0.12);

  // pack = everything that flips down together (bar, squares, foil, sleeve), in lying-flat coords
  const pack = new THREE.Group();
  root.add(pack);

  const groove = shade(f.c.slab, -0.1);
  const slabGeo = paintBoxFaces(new THREE.BoxGeometry(W, H_BAR, W), [shade(f.c.slab, -0.06), shade(f.c.slab, -0.06), groove, shade(f.c.slab, -0.2), shade(f.c.slab, -0.03), shade(f.c.slab, -0.06)], f.c.slab);
  const slab = new THREE.Mesh(slabGeo, toonMat());
  slab.position.y = H_BAR / 2 + 0.002;
  slab.castShadow = true;
  slab.receiveShadow = true;
  pack.add(slab);

  // chocolate squares: code + quiet zone
  const n = qr.size;
  const span = n + QUIET * 2;
  const m = W / span;
  const half = (n - 1) / 2;
  const cells: Cell[] = [];
  for (let r = -QUIET; r < n + QUIET; r++)
    for (let c = -QUIET; c < n + QUIET; c++) cells.push({ r, c, dark: qr.isDark(r, c), x: (c - half) * m, z: (r - half) * m });
  const dFun = new THREE.Color(f.c.choco);
  const dScan = new THREE.Color(f.c.chocoScan);
  const lFun = new THREE.Color(f.c.white);
  const lScan = new THREE.Color(f.c.whiteScan);
  const pillowH = m * 0.7;
  const grid = new PillowGrid(cells, H_BAR + 0.002, m, pillowH, (cell) => {
    if (cell.dark) return [dFun.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.025), dScan.clone()];
    return [lFun.clone().offsetHSL(0, 0, -Math.random() * 0.02), lScan.clone()];
  });
  pack.add(grid.mesh);
  const waveOrder = cells
    .map((cell, i) => ({ i, k: cell.r + cell.c + Math.random() * 1.5 }))
    .sort((p, q) => p.k - q.k)
    .map((p) => p.i);

  // foil wrap
  const foil = foilFlaps();
  pack.add(foil.group);

  // paper sleeve
  const sleeve = sleeveMesh(f, 1, false);
  const sleeveHome = new THREE.Vector3(0, FOIL_H / 2, 0);
  sleeve.position.copy(sleeveHome);
  pack.add(sleeve);
  const sleeveRest = new THREE.Vector3(-2.2 - barPos.x, SLEEVE_T / 2 + 0.002, -1.2 - barPos.z);
  const sleeveRestRy = 0.5;

  // Choco, the mascot, hops in beside the bar at the end
  const choco = new Buddy(CAST.choco, 60);
  choco.billboard = true;
  const chocoRest = new THREE.Vector3(1.78, 0, -0.62);
  choco.visible = false;
  root.add(choco);
  let scanning = false;
  let nextAct = 0;

  const fx = new Particles(320);
  fx.floorY = 0.01;
  root.add(fx.mesh);

  // pop sounds + crumbs
  let pops = 0;
  const tmp = new THREE.Vector3();
  grid.onPop = (i) => {
    const cell = cells[i];
    if (pops++ % 3 === 0) audio.play('pop', { rate: 0.85 + ((cell.r + cell.c) / (span * 2)) * 0.9, minGap: 0.045 });
    if (cell.dark && Math.random() < 0.08) {
      tmp.set(cell.x, H_BAR + pillowH, cell.z).applyMatrix4(pack.matrixWorld);
      fx.burst(tmp, { count: 2, color: [f.c.choco, f.c.white], speed: 0.5, up: 1.2, size: 0.022, life: 0.5 });
    }
  };

  // idle: floating, tilted back so the sleeve art faces the camera
  const TILT = 1.02;
  const standY = (W / 2) * Math.sin(TILT) + 0.08;
  const standZ = 0.3;
  let idle = true;
  let done = false;
  let time = 0;
  let run = 0;

  function setWrapped() {
    pack.position.set(barPos.x, standY, standZ);
    pack.rotation.set(TILT, 0, 0);
    pack.scale.set(1, 1, 1);
    sleeve.position.copy(sleeveHome);
    sleeve.rotation.set(0, 0, 0);
    sleeve.visible = true;
    for (const fl of foil.flaps) setFlap(fl, 0);
    foil.under.visible = true;
    grid.hideAll();
    choco.visible = false;
  }

  function setFinal() {
    pack.position.set(barPos.x, 0, barPos.z);
    pack.rotation.set(0, 0, 0);
    pack.scale.set(1, 1, 1);
    sleeve.position.copy(sleeveRest);
    sleeve.rotation.set(0, sleeveRestRy, 0);
    for (const fl of foil.flaps) setFlap(fl, 1);
    foil.under.visible = false;
    grid.showAll();
    choco.visible = !scanning;
    choco.position.copy(chocoRest);
  }
  setWrapped();

  async function reveal() {
    const my = ++run;
    const alive = () => my === run;
    tweens.cancel(tg);
    idle = false;
    done = false;
    grid.hideAll();
    // wiggle (blending out of the idle bob)
    audio.play('whoosh');
    const y0 = pack.position.y;
    const ry0 = pack.rotation.y;
    const rz0 = pack.rotation.z;
    await tweens.tween(0.45, (t) => {
      pack.rotation.y = ry0 * (1 - t);
      pack.rotation.z = rz0 * (1 - t) + Math.sin(t * Math.PI * 6) * 0.05 * (1 - t);
      pack.position.y = y0 + (standY - y0) * t + Math.sin(t * Math.PI) * 0.12;
    }, ease.linear, tg);
    // flip down onto the counter, art side up
    await tweens.tween(0.7, (t) => {
      const th = TILT * (1 - t);
      pack.rotation.set(th, 0, 0);
      pack.position.y = (W / 2) * Math.sin(th) + (standY - (W / 2) * Math.sin(TILT)) * (1 - t) + Math.sin(Math.PI * t) * 0.5;
      pack.position.z = standZ + (barPos.z - standZ) * t;
    }, ease.inOutCubic, tg);
    audio.play('clack');
    audio.play('crunch');
    fx.burst(new THREE.Vector3(barPos.x, 0.05, barPos.z + W / 2), { count: 16, color: ['#f3ede2', '#ffffff'], speed: 1.4, up: 0.8, size: 0.035, life: 0.5 });
    await tweens.tween(0.22, (t) => {
      const k = Math.sin(Math.PI * t);
      pack.scale.set(1 + k * 0.03, 1 - k * 0.3, 1 + k * 0.03);
    }, ease.linear, tg);
    // slide the sleeve off sideways
    audio.play('whoosh');
    const offX = -(SLEEVE_W / 2 + W / 2 + 0.1);
    await tweens.tween(0.42, (t) => (sleeve.position.x = offX * t), ease.inQuad, tg);
    const from = sleeve.position.clone();
    await tweens.tween(0.55, (t) => {
      sleeve.position.lerpVectors(from, sleeveRest, t);
      sleeve.position.y += Math.sin(Math.PI * t) * 0.45;
      sleeve.rotation.set(0, sleeveRestRy * t, Math.sin(Math.PI * t) * 0.5);
    }, ease.inOutQuad, tg);
    audio.play('clack');
    // unfold the foil: north + south, then east + west
    foil.under.visible = false;
    audio.play('crunch');
    await tweens.tween(0.62, (t) => {
      setFlap(foil.flaps[0], t);
      setFlap(foil.flaps[2], t);
    }, ease.linear, tg);
    audio.play('crunch');
    await tweens.tween(0.62, (t) => {
      setFlap(foil.flaps[1], t);
      setFlap(foil.flaps[3], t);
    }, ease.linear, tg);
    fx.burst(new THREE.Vector3(barPos.x, 0.25, barPos.z), { count: 18, color: ['#ffffff', '#dfe5ee'], speed: 1.8, up: 1.6, size: 0.03, life: 0.6 });
    await tweens.wait(0.2, tg);
    // squares pop up in a wave
    await grid.popWave(waveOrder, Math.min(2.6, 1.5 + cells.length / 2500));
    if (!alive()) return;
    audio.play('tada');
    fx.burst(new THREE.Vector3(barPos.x, 0.4, barPos.z), { count: 50, color: [f.c.choco, f.c.white, f.c.main, f.c.accent], speed: 2.4, up: 3, size: 0.045, life: 1.2 });
    // Choco pops up beside the bar and cheers
    choco.visible = !scanning;
    choco.position.set(chocoRest.x, -1.3, chocoRest.z);
    audio.play('pop');
    await tweens.tween(0.55, (t) => (choco.position.y = -1.3 * (1 - t)), ease.outBack, tg);
    fx.burst(chocoRest, { count: 14, color: [f.c.accent, '#ffffff', f.c.pale], speed: 1.3, up: 2, size: 0.035, life: 0.7 });
    void choco.cheer();
    await tweens.wait(0.6, tg);
    if (!alive()) return;
    done = true;
    nextAct = time + 2.5;
  }

  function finish() {
    run++;
    tweens.cancel(tg);
    idle = false;
    setFinal();
    done = true;
  }

  return {
    root,
    reveal,
    finish,
    actionLabel: 'Unwrap it!',
    hero: { target: new THREE.Vector3(0.22, 0.4, 0.3), distance: 5.0, yaw: 0.1, pitch: 0.58 },
    // the link sticker goes on the cream ribbon at the bottom of the sleeve (its art faces pack +Y)
    label: {
      object: pack,
      position: new THREE.Vector3(-SLEEVE_W / 2 + (LABEL.cx / SLEEVE.w) * SLEEVE_W, FOIL_H / 2 + SLEEVE_T / 2 + 0.003, -(W + 0.03) / 2 + (LABEL.cy / SLEEVE.h) * (W + 0.03)),
      rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      size: [0.78, 0.34],
    },
    update(dt, _time, camera) {
      time += dt;
      if (idle) {
        pack.position.y = standY + Math.sin(time * 1.8) * 0.06;
        pack.rotation.z = Math.sin(time * 1.2) * 0.035;
        pack.rotation.y = Math.sin(time * 0.7) * 0.08;
      }
      grid.update(dt);
      fx.update(dt);
      choco.update(dt, camera);
      if (done && time > nextAct) {
        nextAct = time + 3 + Math.random() * 3;
        const r = Math.random();
        void (r < 0.4 ? choco.wave() : r < 0.75 ? choco.hop() : choco.spin());
      }
    },
    focusView: () => ({ center: new THREE.Vector3(barPos.x, H_BAR + pillowH, barPos.z), normal: new THREE.Vector3(0, 1, 0), size: W, up: new THREE.Vector3(0, 0, -1) }),
    setScanMode: (on) => {
      scanning = on;
      grid.setScanMode(on);
      choco.visible = !on && done;
    },
    dispose() {
      grid.dispose();
      disposeTree(root);
    },
  };
}

/** Free GPU resources this showcase owns (the shared toon material and toon ramp are kept). */
function disposeTree(root: THREE.Object3D) {
  const keep = new Set<THREE.Material>([toonMat()]);
  const ramp = toonGradient();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh && !(o as THREE.Sprite).isSprite) return;
    if (mesh.isMesh) mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m || keep.has(m)) continue;
      for (const v of Object.values(m)) if (v instanceof THREE.Texture && v !== ramp) v.dispose();
      m.dispose();
    }
  });
}

// -------------------------------------------------------------------------------------------------

function poster(ctx: ProductContext) {
  const f = ctx.flavor;
  const art = posterArt(f);
  const scale = posterScale(art.w);
  const dark = f.c.chocoScan;
  const hi = shade(f.c.chocoScan, 0.05);
  const quiet = 2;
  const out = composePoster(
    art,
    scale,
    {
      qr: ctx.qr,
      x: POSTER.qrX,
      y: POSTER.qrY,
      size: POSTER.qrSize,
      dark,
      light: f.c.white,
      quiet,
      module: (c2d, _r, _c, x, y, mm) => {
        c2d.fillStyle = dark;
        c2d.fillRect(x, y, mm, mm);
        if (mm >= 6) {
          const b = Math.max(1, Math.round(mm / 12));
          c2d.fillStyle = hi;
          c2d.fillRect(x + b, y + b, mm - b * 3, b);
          c2d.fillRect(x + b, y + b, b, mm - b * 3);
        }
      },
    },
    { label: ctx.label, product: 'Choco Block · ' + f.name, accent: f.c.main },
  );
  // chocolate grooves between the white squares (kept very light so the code still reads)
  const c2d = out.getContext('2d')!;
  const region = POSTER.qrSize * scale;
  const mm = Math.floor(region / (ctx.qr.size + quiet * 2));
  const total = mm * (ctx.qr.size + quiet * 2);
  const ox = Math.round(POSTER.qrX * scale + (region - total) / 2);
  const oy = Math.round(POSTER.qrY * scale + (region - total) / 2);
  if (mm >= 6) {
    const lw = Math.max(1, Math.round(mm / 10));
    c2d.fillStyle = shade(f.c.white, -0.035);
    for (let r = -quiet; r < ctx.qr.size + quiet; r++)
      for (let c = -quiet; c < ctx.qr.size + quiet; c++) {
        if (ctx.qr.isDark(r, c)) continue;
        const x = ox + (c + quiet) * mm;
        const y = oy + (r + quiet) * mm;
        c2d.fillRect(x + mm - lw, y, lw, mm);
        c2d.fillRect(x, y + mm - lw, mm, lw);
      }
  }
  return out;
}

export const chocoBlock: ProductDef = {
  id: 'choco-block',
  name: 'Choco Block',
  tagline: 'Snap. Scan. Snack.',
  reveal: 'Slide off the sleeve, unfold the foil: dark and white chocolate squares pop up to spell your code.',
  section: 'snacks',
  price: 0,
  flavors: CHOCO_FLAVORS,
  shelfSize: [0.42, 0.44],
  shelfModel: (f) => packModel(f, 0.22),
  createShowcase,
  poster,
};
