import * as THREE from 'three';
import { Painter, shade } from '../../engine/Painter';
import { ease } from '../../engine/tween';
import { audio } from '../../engine/audio';
import { toonGradient, voxelMaterial, voxelMesh } from '../../engine/voxel';
import { toonMat } from '../../engine/batch';
import { LAYER_NO_OUTLINE } from '../../engine/PixelRenderer';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import { atlasBox } from '../common/box';
import { layoutModules } from '../common/qrLayout';
import { Particles } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import {
  POSTER,
  TICKET,
  TICKET_FLAVORS,
  WRAP,
  chocolateFace,
  glowSprite,
  metalFoil,
  pedestalVoxels,
  posterArt,
  raysSprite,
  runnerTop,
  shineBand,
  ticketBack,
  ticketFront,
  wrapperBack,
  wrapperFront,
  wrapperSide,
} from './art';

/** Chocolate bar (standing), share of it covered by the paper wrapper, ticket card size. */
const BW = 0.85;
const BH = 1.25;
const BD = 0.13;
const PAPER = 0.74;
const TW = 2.5;
const TH = 1.5625;
const TT = 0.024;
const QUIET = 3;
const STRIPS = 5;

function solid(w: number, h: number, color: string) {
  return new Painter(w, h).clear(color).canvas;
}

function mip(mesh: THREE.Mesh) {
  const m = mesh.material as THREE.MeshToonMaterial;
  if (m.map) {
    m.map.generateMipmaps = true;
    m.map.minFilter = THREE.LinearMipmapLinearFilter;
    m.map.needsUpdate = true;
  }
  return mesh;
}

// -------------------------------------------------------------------------------------------------
// Embossed QR modules

/** Beveled square with its top facing +z: dark enamel top, precious-metal bevels (vertex colours). */
function embossGeometry(f: Flavor): THREE.BufferGeometry {
  const S = 0.45;
  const T = 0.41;
  const h = 0.5;
  const top = new THREE.Color(f.c.emboss);
  const metal = new THREE.Color(f.c.metal).lerp(new THREE.Color(f.c.metalLo), 0.35);
  const metalLo = new THREE.Color(f.c.emboss).lerp(new THREE.Color(f.c.metalLo), 0.5);
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const n = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const face = (pts: number[][], color: THREE.Color, k: number) => {
    a.fromArray(pts[0]);
    b.fromArray(pts[1]);
    c.fromArray(pts[2]);
    n.subVectors(b, a).cross(c.sub(a)).normalize();
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
      col.push(color.r * k, color.g * k, color.b * k);
    }
  };
  face([[-T, 1, -T], [T, 1, -T], [T, 1, T], [-T, 1, T]], top, 1);
  face([[-h, S, -h], [h, S, -h], [T, 1, -T], [-T, 1, -T]], metal, 1.05);
  face([[-h, S, -h], [-h, S, h], [-T, 1, T], [-T, 1, -T]], metal, 1);
  face([[-h, S, h], [h, S, h], [T, 1, T], [-T, 1, T]], metal, 0.8);
  face([[h, S, -h], [h, S, h], [T, 1, T], [T, 1, -T]], metal, 0.75);
  face([[-h, 0, -h], [h, 0, -h], [h, S, -h], [-h, S, -h]], metalLo, 1);
  face([[-h, 0, h], [h, 0, h], [h, S, h], [-h, S, h]], metalLo, 0.8);
  face([[-h, 0, -h], [-h, 0, h], [-h, S, h], [-h, S, -h]], metalLo, 0.9);
  face([[h, 0, -h], [h, 0, h], [h, S, h], [h, S, -h]], metalLo, 0.7);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.rotateX(Math.PI / 2); // height now along +z (the card normal)
  g.computeBoundingSphere();
  return g;
}

const _m4 = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _c = new THREE.Color();

/** The QR's dark modules as raised enamel squares on the card, rising in the wake of a light sweep. */
class Emboss {
  readonly mesh: THREE.InstancedMesh;
  private t0: Float32Array;
  private time = 0;
  private endAt = -1;
  private resolve: (() => void) | null = null;
  private scanT = 0;
  private scanTarget = 0;
  private dirty = true;
  private fun = new THREE.Color('#ffffff');
  private scan = new THREE.Color('#1c1c1c');
  onRise: ((i: number) => void) | null = null;
  private risen: Uint8Array;

  constructor(private spots: { pos: THREE.Vector3 }[], geo: THREE.BufferGeometry, private m: number, private h: number) {
    const n = spots.length;
    const mat = new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap: toonGradient() });
    this.mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.t0 = new Float32Array(n).fill(1e9);
    this.risen = new Uint8Array(n);
    for (let i = 0; i < n; i++) this.mesh.setColorAt(i, this.fun);
  }

  hideAll() {
    this.t0.fill(1e9);
    this.risen.fill(0);
    this.endAt = -1;
    this.dirty = true;
  }

  showAll() {
    this.t0.fill(-100);
    this.risen.fill(1);
    this.endAt = -1;
    this.dirty = true;
    const r = this.resolve;
    this.resolve = null;
    r?.();
  }

  /** delay(i) = seconds from now until module i rises. */
  rise(delay: (i: number) => number, dur: number): Promise<void> {
    let last = 0;
    for (let i = 0; i < this.spots.length; i++) {
      const d = delay(i);
      this.t0[i] = this.time + d;
      this.risen[i] = 0;
      last = Math.max(last, d);
    }
    this.endAt = this.time + last + dur;
    this.dur = dur;
    this.dirty = true;
    return new Promise((res) => (this.resolve = res));
  }

  private dur = 0.3;

  setScanMode(on: boolean) {
    this.scanTarget = on ? 1 : 0;
    this.mesh.castShadow = !on;
  }

  update(dt: number) {
    this.time += dt;
    const animating = this.endAt > 0 && this.time <= this.endAt + dt;
    if (Math.abs(this.scanT - this.scanTarget) > 1e-3) {
      this.scanT += Math.sign(this.scanTarget - this.scanT) * Math.min(Math.abs(this.scanTarget - this.scanT), dt * 3);
      _c.copy(this.fun).lerp(this.scan, this.scanT);
      for (let i = 0; i < this.spots.length; i++) this.mesh.setColorAt(i, _c);
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
    const grow = 0.94 + 0.1 * this.scanT;
    const flat = 1 - 0.5 * this.scanT;
    for (let i = 0; i < this.spots.length; i++) {
      const u = (this.time - this.t0[i]) / this.dur;
      if (u < 0) _m4.makeScale(0, 0, 0);
      else {
        if (!this.risen[i]) {
          this.risen[i] = 1;
          this.onRise?.(i);
        }
        const k = u < 1 ? ease.outBack(u) : 1;
        const p = this.spots[i].pos;
        _p.set(p.x, p.y, p.z);
        _s.set(this.m * grow, this.m * grow, this.h * k * flat + 1e-4);
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
// Models

/** The golden ticket card, facing +z, centred at its origin. */
function ticketModel(f: Flavor) {
  const group = new THREE.Group();
  const edgeH = solid(160, 4, f.c.metalLo);
  const edgeV = solid(4, 100, f.c.metalLo);
  const body = atlasBox(TW, TH, TT, { px: edgeV, nx: edgeV, py: edgeH, ny: edgeH, pz: ticketFront(f).canvas, nz: ticketBack(f).canvas });
  group.add(body);
  const px = TW / TICKET.w;
  const py = TH / TICKET.h;
  const panel = Math.min(px, py) * TICKET.qrSize;
  const centre = new THREE.Vector3(-TW / 2 + (TICKET.qrX + TICKET.qrSize / 2) * px, TH / 2 - (TICKET.qrY + TICKET.qrSize / 2) * py, TT / 2);
  // camera-safe bright plate under the code, shown only in scan mode
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(TICKET.qrSize * px, TICKET.qrSize * py), new THREE.MeshToonMaterial({ color: f.c.cardScan, gradientMap: toonGradient(), emissive: new THREE.Color(f.c.cardScan).multiplyScalar(0.25) }));
  plate.position.set(centre.x, centre.y, TT / 2 + 0.0008);
  plate.visible = false;
  group.add(plate);
  return { group, body, panel, centre, plate };
}

interface Flap {
  pivots: THREE.Group[];
  rest: number[];
}

/** Standing chocolate bar: paper wrapper below, precious foil above (two peelable flaps). */
function barModel(f: Flavor, s: number, shelf: boolean) {
  const group = new THREE.Group();
  const w = BW * s;
  const h = BH * s;
  const d = BD * s;
  const ph = PAPER * h;
  const fh = h - ph;
  const side = wrapperSide(f, 12, WRAP.h).canvas;
  const cap = solid(WRAP.w, 12, f.c.wrap);
  const paper = atlasBox(w + 0.012 * s, ph, d + 0.012 * s, { px: side, nx: side, py: cap, ny: cap, pz: wrapperFront(f).canvas, nz: wrapperBack(f).canvas }, { mipmaps: shelf });
  paper.position.y = ph / 2;
  group.add(paper);
  const foilSide = metalFoil(f, 12, 28, 7).canvas;
  const choc = chocolateFace(WRAP.w, 28).canvas;
  const block = atlasBox(w - 0.004 * s, fh, d - 0.004 * s, { px: foilSide, nx: foilSide, py: shelf ? metalFoil(f, WRAP.w, 12, 9).canvas : chocolateFace(WRAP.w, 12).canvas, ny: cap, pz: shelf ? metalFoil(f, WRAP.w, 28, 3).canvas : choc, nz: shelf ? metalFoil(f, WRAP.w, 28, 5).canvas : choc }, { mipmaps: shelf });
  block.position.y = ph + fh / 2;
  group.add(block);
  const flaps: Flap[] = [];
  let foilMat: THREE.MeshToonMaterial | null = null;
  if (!shelf) {
    foilMat = new THREE.MeshToonMaterial({ map: metalFoil(f, 48, 24, 11).texture(), gradientMap: toonGradient(), side: THREE.DoubleSide, emissive: new THREE.Color(f.c.metalLo).multiplyScalar(0.25) });
    const vLen = fh / (STRIPS - 1);
    for (let k = 0; k < 2; k++) {
      const holder = new THREE.Group();
      holder.rotation.y = k * Math.PI;
      holder.position.set(0, 0, 0);
      group.add(holder);
      const pivots: THREE.Group[] = [];
      const rest: number[] = [];
      let parent: THREE.Object3D = holder;
      for (let i = 0; i < STRIPS; i++) {
        const len = i < STRIPS - 1 ? vLen : d / 2 + 0.004;
        const pv = new THREE.Group();
        if (i === 0) pv.position.set(0, ph, d / 2 + 0.004);
        else pv.position.set(0, vLen, 0);
        const geo = new THREE.PlaneGeometry(w + 0.008, len + 0.002);
        geo.translate(0, len / 2, 0);
        const mesh = new THREE.Mesh(geo, foilMat);
        mesh.castShadow = true;
        pv.add(mesh);
        parent.add(pv);
        parent = pv;
        pivots.push(pv);
        const r = i === STRIPS - 1 ? -Math.PI / 2 : 0;
        rest.push(r);
        pv.rotation.x = r;
      }
      flaps.push({ pivots, rest });
    }
  }
  return { group, flaps, foilMat, height: h };
}

/** 0 = wrapped, 1 = curled open. The free end peels first and the curl travels down to the hinge. */
function setPeel(fl: Flap, t: number) {
  const n = fl.pivots.length;
  const curl = (Math.PI * 1.55) / n;
  for (let i = 0; i < n; i++) {
    const delay = ((n - 1 - i) / n) * 0.5;
    const u = Math.min(1, Math.max(0, (t - delay) / 0.5));
    const e = ease.inOutCubic(u);
    fl.pivots[i].rotation.x = fl.rest[i] + (curl - fl.rest[i]) * e;
  }
}

// -------------------------------------------------------------------------------------------------

function createShowcase(ctx: ProductContext): ShowcaseItem {
  const { qr, flavor: f, tweens, group: tg } = ctx;
  const root = new THREE.Group();

  // pedestal + floating bar (back centre)
  const pedPos = new THREE.Vector3(0.3, 0, -0.85);
  const pedestal = voxelMesh(pedestalVoxels(f), { scale: 0.04, anchor: 'bottom-center' });
  pedestal.position.copy(pedPos);
  root.add(pedestal);
  const cushionTop = 8 * 0.04;
  const bar = barModel(f, 1, false);
  const barPivot = new THREE.Group();
  root.add(barPivot);
  barPivot.add(bar.group);
  bar.group.position.y = -BH / 2;
  const floatY = cushionTop + 0.14 + BH / 2;
  const restY = cushionTop + BH / 2;

  // golden halo behind the bar / ticket
  const glowTex = glowSprite(f.c.metalHi, 32).texture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffffff', transparent: true, depthWrite: false, opacity: 0.35 }));
  glow.scale.set(2.2, 2.2, 1);
  glow.layers.set(LAYER_NO_OUTLINE);
  root.add(glow);
  const raysTex = raysSprite(f.c.metalHi, 64).texture();
  const rays = new THREE.Sprite(new THREE.SpriteMaterial({ map: raysTex, color: '#ffffff', transparent: true, depthWrite: false, opacity: 0 }));
  rays.scale.set(3.4, 3.4, 1);
  rays.layers.set(LAYER_NO_OUTLINE);
  rays.visible = false;
  root.add(rays);

  // red velvet runner the ticket lands on
  const RUN_H = 0.012;
  const runSide = solid(174, 2, '#4a0816');
  const runner = atlasBox(2.9, RUN_H, 2.0, { px: runSide, nx: runSide, py: runnerTop(f).canvas, ny: runSide, pz: runSide, nz: runSide });
  runner.position.set(0.3, RUN_H / 2, 0.72);
  runner.castShadow = false;
  root.add(runner);

  // the ticket
  const ticket = ticketModel(f);
  root.add(ticket.group);
  const ticketRest = new THREE.Vector3(0.3, RUN_H + TT / 2 + 0.003, 0.72);
  const n = qr.size;
  const qrSize = (ticket.panel * n) / (n + QUIET * 2);
  const m = qrSize / n;
  const spots = layoutModules(qr, { size: qrSize, center: ticket.centre.clone(), plane: 'xy' });
  const emboss = new Emboss(spots, embossGeometry(f), m, m * 0.4);
  ticket.group.add(emboss.mesh);
  // light sweep across the card face
  const shineTex = shineBand().texture();
  const shine = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), new THREE.MeshBasicMaterial({ map: shineTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
  shine.position.z = TT / 2 + m * 0.5;
  shine.layers.set(LAYER_NO_OUTLINE);
  shine.visible = false;
  ticket.group.add(shine);

  const sparkleGeo = new THREE.OctahedronGeometry(1, 0);
  const fx = new Particles(420, { glow: true, geometry: sparkleGeo });
  root.add(fx.mesh);
  const golds = [f.c.metalHi, f.c.metal, '#ffffff'];

  let rises = 0;
  emboss.onRise = () => {
    if (rises++ % 9 === 0) audio.play('blip', { rate: 1.2 + Math.random() * 0.6, minGap: 0.04 });
  };

  let time = 0;
  let idle = true;
  let done = false;
  let scanOn = false;
  let run = 0;
  let twinkle = 0;
  const tmp = new THREE.Vector3();

  function hideRays() {
    rays.visible = false;
    rays.material.opacity = 0;
  }

  function setStart() {
    hideRays();
    barPivot.position.set(pedPos.x, floatY, pedPos.z);
    barPivot.rotation.set(0, 0, 0);
    for (const fl of bar.flaps) setPeel(fl, 0);
    ticket.group.visible = false;
    emboss.hideAll();
    shine.visible = false;
    glow.position.set(pedPos.x, floatY, pedPos.z - 0.2);
    glow.material.opacity = 0.3;
  }
  function setFinal() {
    hideRays();
    barPivot.position.set(pedPos.x, restY, pedPos.z);
    barPivot.rotation.set(-0.08, -0.25, 0);
    for (const fl of bar.flaps) setPeel(fl, 1);
    ticket.group.visible = true;
    ticket.group.position.copy(ticketRest);
    ticket.group.rotation.set(-Math.PI / 2, 0, 0);
    ticket.group.scale.setScalar(1);
    emboss.showAll();
    shine.visible = false;
    glow.position.set(ticketRest.x, 0.3, ticketRest.z);
    glow.material.opacity = 0.18;
  }
  setStart();

  async function reveal() {
    const my = ++run;
    const alive = () => my === run;
    tweens.cancel(tg);
    idle = false;
    done = false;
    // settle the floating bar and let it tremble with light
    audio.play('ding');
    const ry0 = barPivot.rotation.y;
    const y0 = barPivot.position.y;
    await tweens.tween(0.9, (t) => {
      barPivot.rotation.y = ry0 * (1 - t);
      barPivot.position.y = y0 + (floatY + 0.1 - y0) * t;
      barPivot.rotation.z = Math.sin(t * Math.PI * 14) * 0.03 * t;
      glow.material.opacity = 0.3 + t * 0.5;
      if (Math.random() < 0.5) fx.burst(tmp.set(pedPos.x + (Math.random() - 0.5) * BW, barPivot.position.y + BH / 2, pedPos.z), { count: 1, color: golds, speed: 0.6, up: 1.4, size: 0.03, life: 0.6, gravity: 1 });
    }, ease.linear, tg);
    barPivot.rotation.z = 0;
    // the foil peels open
    audio.play('rip');
    audio.play('crunch');
    const top = new THREE.Vector3(pedPos.x, barPivot.position.y + BH / 2, pedPos.z);
    await tweens.tween(0.8, (t) => {
      for (const fl of bar.flaps) setPeel(fl, t);
    }, ease.linear, tg);
    audio.play('chime');
    fx.burst(top, { count: 40, color: golds, speed: 1.6, up: 3.2, size: 0.04, life: 1.1, gravity: 2 });
    rays.visible = true;
    rays.position.set(top.x, top.y + 0.05, top.z - 0.5);
    glow.position.set(top.x, top.y - 0.2, top.z - 0.45);
    void tweens.tween(0.4, (t) => (rays.material.opacity = 0.85 * t), ease.outQuad, tg);
    // the golden ticket rises out of the bar, spinning
    ticket.group.visible = true;
    ticket.group.rotation.set(0, 0, 0);
    const start = new THREE.Vector3(pedPos.x, top.y - TH * 0.18, pedPos.z);
    const peak = new THREE.Vector3(pedPos.x, top.y + 0.22, pedPos.z + 0.6);
    audio.play('whoosh');
    await tweens.tween(1.2, (t) => {
      ticket.group.position.lerpVectors(start, peak, ease.outCubic(t));
      ticket.group.scale.setScalar(0.3 + 0.3 * ease.outCubic(t));
      ticket.group.rotation.y = ease.inOutCubic(t) * Math.PI * 4;
      glow.material.opacity = 0.8;
      if (Math.random() < 0.8) fx.burst(ticket.group.position, { count: 2, color: golds, speed: 0.5, up: 0.2, size: 0.03, life: 0.7, gravity: 0.5 });
    }, ease.linear, tg);
    // tip over and glide down to land face up
    const from = ticket.group.position.clone();
    await tweens.tween(1.1, (t) => {
      const e = ease.inOutCubic(t);
      ticket.group.position.lerpVectors(from, ticketRest, e);
      ticket.group.position.y += Math.sin(Math.PI * t) * 0.35;
      ticket.group.rotation.set((-Math.PI / 2) * e, Math.sin(Math.PI * t) * 0.3, Math.sin(Math.PI * t * 2) * 0.08);
      ticket.group.scale.setScalar(0.6 + 0.4 * e);
      glow.material.opacity = 0.8 * (1 - e);
      rays.material.opacity = 0.85 * (1 - e);
    }, ease.linear, tg);
    ticket.group.position.copy(ticketRest);
    ticket.group.rotation.set(-Math.PI / 2, 0, 0);
    rays.visible = false;
    audio.play('clack');
    audio.play('ding');
    fx.burst(tmp.set(ticketRest.x, 0.05, ticketRest.z), { count: 30, color: golds, speed: 2.2, up: 1.2, size: 0.035, life: 0.8, gravity: 3 });
    // the empty bar settles onto its cushion
    const by = barPivot.position.y;
    void tweens.tween(0.8, (t) => {
      barPivot.position.y = by + (restY - by) * ease.outBounce(t);
      barPivot.rotation.set(-0.08 * t, -0.25 * t, 0);
    }, ease.linear, tg);
    await tweens.wait(0.25, tg);
    // a sweep of light embosses the code into the card
    audio.play('unlock');
    shine.visible = true;
    const sweep = 1.2;
    void tweens.tween(sweep, (t) => (shineTex.offset.x = 0.75 - 1.5 * t), ease.inOutQuad, tg).then(() => (shine.visible = false));
    const x0 = ticket.centre.x - ticket.panel / 2;
    await emboss.rise((i) => {
      const p = spots[i].pos;
      const u = (p.x - x0) / ticket.panel + (p.y - ticket.centre.y) * 0.25;
      return 0.15 + Math.max(0, u) * sweep * 0.85;
    }, 0.32);
    if (!alive()) return;
    audio.play('tada');
    fx.burst(tmp.set(ticketRest.x, 0.2, ticketRest.z), { count: 70, color: golds, speed: 2.8, up: 3.6, size: 0.045, life: 1.4, gravity: 3.5 });
    done = true;
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
    actionLabel: 'Peel the foil!',
    hero: { target: new THREE.Vector3(0.3, 0.85, 0.12), distance: 5.9, yaw: 0.0, pitch: 0.46 },
    update(dt) {
      time += dt;
      if (idle) {
        barPivot.position.y = floatY + Math.sin(time * 1.6) * 0.06;
        barPivot.rotation.y = Math.sin(time * 0.8) * 0.4;
        glow.material.opacity = 0.28 + Math.sin(time * 2.2) * 0.06;
        twinkle -= dt;
        if (twinkle <= 0) {
          twinkle = 0.35 + Math.random() * 0.4;
          fx.burst(tmp.set(pedPos.x + (Math.random() - 0.5) * 1.3, floatY + (Math.random() - 0.5) * 1.5, pedPos.z + 0.2), { count: 1, color: golds, speed: 0.1, up: 0.15, size: 0.035, life: 0.9, gravity: 0 });
        }
      } else if (done && !scanOn) {
        twinkle -= dt;
        if (twinkle <= 0) {
          twinkle = 0.25 + Math.random() * 0.35;
          fx.burst(tmp.set(ticketRest.x + (Math.random() - 0.5) * TW, 0.08 + Math.random() * 0.25, ticketRest.z + (Math.random() - 0.5) * TH), { count: 1, color: golds, speed: 0.05, up: 0.1, size: 0.03, life: 0.8, gravity: 0 });
        }
        glow.material.opacity = 0.16 + Math.sin(time * 2) * 0.04;
      }
      if (rays.visible) rays.material.rotation = time * 0.6;
      emboss.update(dt);
      fx.update(dt);
    },
    focusView() {
      ticket.group.updateWorldMatrix(true, false);
      const c = ticket.centre.clone();
      c.z += m * 0.4;
      c.applyMatrix4(ticket.group.matrixWorld);
      return { center: c, normal: new THREE.Vector3(0, 1, 0), size: ticket.panel, up: new THREE.Vector3(0, 0, -1) };
    },
    setScanMode(on) {
      scanOn = on;
      emboss.setScanMode(on);
      ticket.plate.visible = on;
      glow.visible = !on;
      if (on) hideRays();
      fx.mesh.visible = !on;
    },
    dispose() {
      emboss.dispose();
      disposeTree(root);
    },
  };
}

/** Free GPU resources this showcase owns (the shared toon/voxel materials and toon ramp are kept). */
function disposeTree(root: THREE.Object3D) {
  const keep = new Set<THREE.Material>([toonMat(), voxelMaterial()]);
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
  const dark = f.c.embossScan;
  const rim = shade(f.c.embossScan, 0.08);
  return composePoster(
    art,
    scale,
    {
      qr: ctx.qr,
      x: POSTER.qrX,
      y: POSTER.qrY,
      size: POSTER.qrSize,
      dark,
      light: f.c.cardScan,
      quiet: 3,
      module: (c2d, _r, _c, x, y, mm) => {
        c2d.fillStyle = dark;
        c2d.fillRect(x, y, mm, mm);
        if (mm >= 8) {
          const b = Math.max(1, Math.round(mm / 12));
          c2d.fillStyle = rim;
          c2d.fillRect(x + b, y + b, mm - 2 * b, b);
        }
      },
    },
    { label: ctx.label, product: 'Golden Ticket · ' + f.name, accent: f.c.metalLo },
  );
}

export const goldenTicket: ProductDef = {
  id: 'golden-ticket',
  name: 'Golden Ticket',
  tagline: 'Only five in the world. Probably.',
  reveal: 'Peel back the golden foil: a ticket rises, spins and lands with your code embossed in gold.',
  section: 'premium',
  price: 200,
  badge: 'LIMITED',
  flavors: TICKET_FLAVORS,
  shelfSize: [0.3, 0.46],
  shelfModel(f) {
    const s = 0.3;
    const g = new THREE.Group();
    const bar = barModel(f, s, true);
    g.add(bar.group);
    // the corner of a golden ticket peeking out of the foil
    const peek = mip(atlasBox(0.2, 0.07, 0.006, { px: solid(4, 8, f.c.metalLo), nx: solid(4, 8, f.c.metalLo), py: solid(32, 4, f.c.metalLo), ny: solid(32, 4, f.c.metalLo), pz: ticketFront(f).canvas, nz: ticketBack(f).canvas }, { mipmaps: true }));
    peek.position.set(0.02, bar.height + 0.025, 0);
    peek.rotation.z = -0.12;
    g.add(peek);
    return g;
  },
  createShowcase,
  poster,
};
