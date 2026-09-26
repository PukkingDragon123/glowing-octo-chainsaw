import * as THREE from 'three';
import { LAYER_NO_OUTLINE } from '../engine/PixelRenderer';
import { prng } from './pixel';
import { SpriteAtlas, spriteGeometry } from './spriteMesh';
import {
  ARM,
  CHAIN_LINK,
  FLOOR,
  MIDX,
  PIV,
  armJoints,
  buildClerkArt,
  knuckles,
  type ClerkArt,
  type EyeStyle,
  type MouthStyle,
  type Sprite,
} from './clerk/art';
import type { Pt } from './clerk/draw';
import { defaultReceiptTexture } from './clerk/receipt';

/**
 * The store clerk: a pink axolotl riding an open cockpit on top of a chunky blue shark mech, with
 * red fins, a spinning steel drill nose on a dangling chain, exhaust cannons that puff bubbles and
 * a big red claw arm. Built from flat pixel-art sprite parts (see clerk/art.ts) parented at their
 * joints and animated with layered procedural motion: hover bob with squash & stretch, lagging
 * pilot, wiggling gills, swaying fins, blinking and glancing, drill frames, chain physics, idle
 * flourishes and interruptible actions that return promises.
 *
 * Origin at floor level, centred, facing +Z. About 2.1 units wide; the mech hovers with its feet
 * ~0.45 above the floor and the gill tips ~2.05 up, so the cockpit, pilot, fins, drill, toothy jaw
 * and claw all read above a 0.95-high counter (scale `root` by ~0.88 for an exact 1.8 height).
 */

export type ClerkMood = 'idle' | 'happy' | 'surprised' | 'sleepy';
type ActKind = 'wave' | 'cheer' | 'point' | 'scan' | 'print' | 'yawn' | 'drill' | 'thumbs' | 'hop';

interface Act {
  kind: ActKind;
  t: number;
  dur: number;
  resolve: (() => void) | null;
}

const D = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const sstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Fade in over `i` seconds, out over the last `o` seconds of `dur`. */
const env = (t: number, dur: number, i: number, o: number) => sstep(0, i, t) * (1 - sstep(dur - o, dur, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 → 1 → 0 bump over [a, b]. */
const bump = (a: number, b: number, x: number) => (x <= a || x >= b ? 0 : Math.sin(((x - a) / (b - a)) * Math.PI));

/** The mech floats this much above its drawn rest position (keeps the claw above the counter). */
const LIFT = 0.09;
const REST_UP = ARM.upper;
const REST_FO = ARM.fore;
const REST_CL = ARM.fore + ARM.claw;

/** Numeric pose channels that cross-fade when one action interrupts another. */
const BLEND_KEYS = [
  'hover', 'lean', 'shiftX', 'shiftZ', 'tiltX', 'squash', 'tail', 'dorsal', 'fin', 'hatch', 'legs', 'jaw', 'drillTilt',
  'up', 'fo', 'cl', 'armZ', 'spread', 'curl0', 'curl1', 'curl2', 'curl3', 'thumb', 'pilotY', 'pilotTilt', 'armL', 'armR',
  'gillFlare', 'lookX', 'lookY',
] as const;
type BlendKey = (typeof BLEND_KEYS)[number];
const XFADE = 0.28;

/** Every animated channel for one frame (angles in degrees on screen, clockwise positive). */
class Pose {
  hover = 0;
  lean = 0;
  shiftX = 0;
  shiftZ = 0;
  spin = 0;
  tiltX = 0;
  squash = 0;
  shake = 0;
  tail = 0;
  dorsal = 0;
  fin = 0;
  hatch = 0;
  legs = 0;
  jaw = 0;
  drillSpeed = 3;
  drillTilt = 0;
  up = REST_UP;
  fo = REST_FO;
  cl = REST_CL;
  armZ = 0;
  spread = 0;
  curl0 = 1;
  curl1 = 1;
  curl2 = 1;
  curl3 = 1;
  /** Extra thumb rotation (degrees, negative = up). */
  thumb = 0;
  pilotY = 0;
  pilotTilt = 0;
  armL = 0;
  armR = 0;
  gillAmp = 6;
  gillSpeed = 3.2;
  gillFlare = 0;
  eyes: EyeStyle = 'dot';
  mouth: MouthStyle = 'grin';
  lookX = 0;
  lookY = 0;
  beam = 0;
  beamX = 0;
}

interface Bubble {
  on: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  ph: number;
  spark: boolean;
}

/**
 * Greedy-meshed sprites are made of many abutting quads; their T-junctions can leave pinhole cracks
 * that show the background as sparkles in the low-res render. Pad every quad outward by a fraction
 * of a texel (UVs unchanged, so no texture bleeding) to seal them.
 */
function sealQuads(g: THREE.BufferGeometry, eps: number) {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const a = pos.array as Float32Array;
  for (let q = 0; q < pos.count; q += 4) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let k = 0; k < 4; k++) {
      const x = a[(q + k) * 3];
      const y = a[(q + k) * 3 + 1];
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    for (let k = 0; k < 4; k++) {
      const i = (q + k) * 3;
      a[i] += a[i] === x0 ? -eps : a[i] === x1 ? eps : 0;
      a[i + 1] += a[i + 1] === y0 ? -eps : a[i + 1] === y1 ? eps : 0;
    }
  }
  pos.needsUpdate = true;
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

const BUBBLES = 32;
const RECEIPT_SEG = 8;

export class Clerk {
  readonly root = new THREE.Group();
  /** Invisible pick volume covering the clerk (userData.clerk = this). */
  readonly hit: THREE.Object3D;
  /** The receipt paper strip (child of root), hidden until print(); clickable. */
  readonly receipt: THREE.Mesh;

  private readonly ppu: number;
  private readonly atlas = new SpriteAtlas(512);
  private readonly mat: THREE.MeshBasicMaterial;

  // rig
  private readonly mech = new THREE.Group();
  private readonly mechBase = new THREE.Vector3();
  private readonly tailUpper: THREE.Group;
  private readonly tailLower: THREE.Group;
  private readonly dorsal: THREE.Group;
  private readonly hatch: THREE.Group;
  private readonly antenna: THREE.Group;
  private readonly exhausts: THREE.Group[] = [];
  private readonly exhaustBase: THREE.Vector3[] = [];
  private readonly exhaustDir: [number, number][] = [];
  private readonly exhaustMouths: THREE.Object3D[] = [];
  private readonly jaw: THREE.Group;
  private readonly lid: THREE.Mesh;
  private readonly lidGeo: THREE.BufferGeometry[] = [];
  private mechBlinkIn = 3.1;
  private mechBlinkT = 0;
  private readonly finNear: THREE.Group;
  private readonly legNear: THREE.Group;
  private readonly legFar: THREE.Group;
  private readonly drill: THREE.Group;
  private readonly drillMesh: THREE.Mesh;
  private readonly drillGeo: THREE.BufferGeometry[] = [];
  private readonly drillTip = new THREE.Object3D();
  private readonly chain: THREE.Group[] = [];
  private readonly shoulder: THREE.Group;
  private readonly elbow: THREE.Group;
  private readonly wrist: THREE.Group;
  private readonly fingers: THREE.Group[] = [];
  private readonly fingerMesh: THREE.Mesh[] = [];
  private readonly fingerGeo: THREE.BufferGeometry[][] = [];
  private readonly pilot = new THREE.Group();
  private readonly pilotBase = new THREE.Vector3();
  private readonly eyesMesh: THREE.Mesh;
  private readonly mouthMesh: THREE.Mesh;
  private readonly eyesBase = new THREE.Vector3();
  private readonly mouthBase = new THREE.Vector3();
  private readonly eyeGeo = {} as Record<EyeStyle, THREE.BufferGeometry>;
  private readonly mouthGeo = {} as Record<MouthStyle, THREE.BufferGeometry>;
  private readonly gills: THREE.Group[] = [];
  private readonly pilotArmL: THREE.Group;
  private readonly pilotArmR: THREE.Group;
  private readonly pilotArmGeo: THREE.BufferGeometry[][] = [];
  private readonly mouthAnchor = new THREE.Object3D();
  private readonly shoulderZ = 0.06;

  // particles / effects
  private readonly bubbles: Bubble[] = [];
  private readonly bubbleMeshes: THREE.InstancedMesh[] = [];
  private readonly beamFan: THREE.Mesh;
  private readonly beamLine: THREE.Mesh;
  private readonly beamGlow: THREE.Mesh;
  private readonly beamDot: THREE.Mesh;
  private readonly receiptMat: THREE.MeshBasicMaterial;
  private readonly defaultTex: THREE.CanvasTexture;
  private receiptLen = 0.44;
  private receiptW = 0.22;
  private receiptP = 0;
  private receiptOut = false;
  private receiptSwing = 0;
  private receiptSwingV = 0;

  // state
  private time = 0;
  private ph = 0;
  private mood: ClerkMood = 'idle';
  private act: Act | null = null;
  private readonly pose = new Pose();
  /** Last frame's pose and the snapshot an interrupting action fades in from. */
  private readonly lastPose = new Pose();
  private readonly fromPose = new Pose();
  private xfade = 0;
  private readonly rand = prng(1717);
  private blinkIn = 1.6;
  private blinkT = 0;
  private glanceIn = 2.2;
  private glanceX = 0;
  private glanceY = 0;
  private lookX = 0;
  private lookY = 0;
  private readonly lookTarget = new THREE.Vector3();
  private lookActive = false;
  private flourishIn = 9;
  private fidgetIn = 4;
  private fidgetT = -1;
  private fidgetKind = 0;
  private bubbleIn = 0.6;
  private burstQueue = 0;
  private drillPhase = 0;
  private drillFrame = -1;
  private sq = 0;
  private sqV = 0;
  private pilotAbs = 0;
  private pilotV = 0;
  private prevMountY = 0;
  private mountV = 0;
  private mountA = 0;
  private antennaA = 0;
  private antennaV = 0;
  private hatchA = 0;
  private hatchV = 0;
  private readonly chainA = [0, 0, 0];
  private readonly chainV = [0, 0, 0];
  private readonly chainPrev = new THREE.Vector3();
  private readonly chainVel = new THREE.Vector3();
  private chainInit = false;
  private moodKick = 0;
  private readonly puff = [0, 0];
  private readonly counts = [0, 0, 0, 0, 0];
  private sparkIn = 0;
  private readonly curls = [1, 1, 1, 1];

  // scratch (no allocations per frame)
  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private readonly m4 = new THREE.Matrix4();
  private readonly q4 = new THREE.Quaternion();
  private readonly s3 = new THREE.Vector3();
  private readonly e3 = new THREE.Euler();

  constructor(opts: { ppu?: number } = {}) {
    this.ppu = opts.ppu ?? 64;
    const art: ClerkArt = buildClerkArt();
    this.mat = new THREE.MeshBasicMaterial({ map: this.atlas.texture(), side: THREE.DoubleSide });
    this.root.userData.clerk = this;

    // ---- mech
    const M = PIV.mech;
    this.mechBase.set(this.cx(M[0]), this.cy(M[1]), 0);
    this.mech.position.copy(this.mechBase);
    this.root.add(this.mech);
    this.tailLower = this.part('tailLower', art.tailLower, this.mech, M, -0.07);
    this.tailUpper = this.part('tailUpper', art.tailUpper, this.mech, M, -0.066);
    this.legFar = this.part('legFar', art.legFar, this.mech, M, -0.05);
    this.dorsal = this.part('dorsal', art.dorsal, this.mech, M, -0.06);
    this.hatch = this.part('hatch', art.hatch, this.mech, M, -0.048);
    for (const [i, s] of [art.exhaustB, art.exhaustA].entries()) {
      const g = this.part(i === 0 ? 'exB' : 'exA', s, this.mech, M, -0.04 + i * 0.005);
      this.exhausts.push(g);
      this.exhaustBase.push(g.position.clone());
      const mouth = art.exhaustMouths[1 - i];
      const a = Math.atan2(-(mouth[1] - s.py), mouth[0] - s.px);
      this.exhaustDir.push([Math.cos(a), Math.sin(a)]);
      const o = new THREE.Object3D();
      o.position.set((mouth[0] - s.px) / this.ppu, -(mouth[1] - s.py) / this.ppu, 0);
      g.add(o);
      this.exhaustMouths.push(o);
    }
    this.antenna = this.part('antenna', art.antenna, this.mech, M, -0.01);
    this.part('body', art.body, this.mech, M, 0);
    this.jaw = this.part('jaw', art.jaw, this.mech, M, 0.004);
    art.lids.forEach((l, i) => this.lidGeo.push(this.geo('lid' + i, l)));
    this.lid = new THREE.Mesh(this.lidGeo[1], this.mat);
    this.lid.position.set((art.lids[0].px - M[0]) / this.ppu, -(art.lids[0].py - M[1]) / this.ppu, 0.003);
    this.lid.visible = false;
    this.mech.add(this.lid);
    this.legNear = this.part('legNear', art.legNear, this.mech, M, 0.006);
    this.finNear = this.part('finNear', art.finNear, this.mech, M, 0.012);
    this.mouthAnchor.position.set((art.mouthFront[0] - M[0]) / this.ppu, -(art.mouthFront[1] - M[1]) / this.ppu, 0.01);
    this.mech.add(this.mouthAnchor);

    // ---- pilot
    const P = PIV.pilot;
    this.pilot.position.set((P[0] - M[0]) / this.ppu, -(P[1] - M[1]) / this.ppu, 0.01);
    this.pilotBase.copy(this.pilot.position);
    this.mech.add(this.pilot);
    for (let i = 0; i < art.gills.length; i++) this.gills.push(this.part('gill' + i, art.gills[i], this.pilot, P, -0.004 - (i % 3) * 0.0004));
    this.part('pilotBody', art.pilot, this.pilot, P, 0);
    for (const s of Object.keys(art.eyes) as EyeStyle[]) this.eyeGeo[s] = this.geo('eyes_' + s, art.eyes[s]);
    for (const s of Object.keys(art.mouth) as MouthStyle[]) this.mouthGeo[s] = this.geo('mouth_' + s, art.mouth[s]);
    this.eyesMesh = new THREE.Mesh(this.eyeGeo.dot, this.mat);
    this.eyesMesh.position.set((PIV.eyes[0] - P[0]) / this.ppu, -(PIV.eyes[1] - P[1]) / this.ppu, 0.002);
    this.eyesBase.copy(this.eyesMesh.position);
    this.mouthMesh = new THREE.Mesh(this.mouthGeo.grin, this.mat);
    this.mouthMesh.position.set((PIV.mouth[0] - P[0]) / this.ppu, -(PIV.mouth[1] - P[1]) / this.ppu, 0.0025);
    this.mouthBase.copy(this.mouthMesh.position);
    this.pilot.add(this.eyesMesh, this.mouthMesh);
    this.pilotArmL = this.part('armL', art.armL, this.pilot, P, 0.016);
    this.pilotArmR = this.part('armR', art.armR, this.pilot, P, 0.016);
    this.pilotArmGeo.push([(this.pilotArmL.children[0] as THREE.Mesh).geometry, this.geo('armLUp', art.armLUp)]);
    this.pilotArmGeo.push([(this.pilotArmR.children[0] as THREE.Mesh).geometry, this.geo('armRUp', art.armRUp)]);
    this.part('rim', art.rim, this.mech, M, 0.02);

    // ---- drill + chain
    this.drill = new THREE.Group();
    this.drill.position.set((PIV.drill[0] - M[0]) / this.ppu, -(PIV.drill[1] - M[1]) / this.ppu, 0.03);
    this.mech.add(this.drill);
    art.drill.forEach((s, i) => this.drillGeo.push(this.geo('drill' + i, s)));
    this.drillMesh = new THREE.Mesh(this.drillGeo[0], this.mat);
    this.drillMesh.castShadow = true;
    this.drill.add(this.drillMesh);
    this.drillTip.position.set((art.drillTip[0] - PIV.drill[0]) / this.ppu, -(art.drillTip[1] - PIV.drill[1]) / this.ppu, 0);
    this.drill.add(this.drillTip);
    let parent: THREE.Object3D = this.drill;
    let pp: Pt = PIV.drill;
    art.chain.forEach((s, i) => {
      // the chain hangs in front of the claw (its top link stays over the collar in side views)
      const g = this.part('chain' + i, s, parent, pp, i === 0 ? 0.075 : 0.001);
      if (i > 0) g.position.set(0, -CHAIN_LINK / this.ppu, 0.0005);
      this.chain.push(g);
      parent = g;
      pp = PIV.chain;
    });

    // ---- the big arm
    const { S, E, W } = armJoints();
    this.shoulder = this.part('upperArm', art.upperArm, this.mech, M, this.shoulderZ);
    this.part('shoulderCap', art.shoulderCap, this.shoulder, S, 0.004);
    this.elbow = this.part('forearm', art.forearm, this.shoulder, S, 0.012);
    this.wrist = this.part('palm', art.palm, this.elbow, E, 0.012);
    const k = knuckles();
    const bases = [...k.fingers, k.thumb];
    const fz = [-0.003, -0.002, -0.001, 0.002];
    art.fingers.forEach((frames, f) => {
      const geos = frames.map((s, c) => this.geo(`finger${f}_${c}`, s));
      this.fingerGeo.push(geos);
      const g = new THREE.Group();
      g.position.set((bases[f][0] - W[0]) / this.ppu, -(bases[f][1] - W[1]) / this.ppu, fz[f]);
      const m = new THREE.Mesh(geos[1], this.mat);
      m.castShadow = true;
      g.add(m);
      this.wrist.add(g);
      this.fingers.push(g);
      this.fingerMesh.push(m);
    });

    // ---- bubbles: one instanced mesh per frame size + the pop burst
    art.bubbles.forEach((c, i) => {
      const id = 'bubble' + i;
      this.atlas.add(id, c.bmp.toCanvas());
      const geo = spriteGeometry(c.bmp, { ppu: this.ppu, anchor: [0.5, 0.5], uv: this.atlas.uv(id) });
      const im = new THREE.InstancedMesh(geo, this.mat, BUBBLES);
      im.count = 0;
      im.frustumCulled = false;
      im.layers.set(LAYER_NO_OUTLINE);
      this.root.add(im);
      this.bubbleMeshes.push(im);
    });
    for (let i = 0; i < BUBBLES; i++) this.bubbles.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, age: 0, life: 1, size: 0, ph: 0, spark: false });

    // ---- scanner beam (fan from the drill tip + bright line on the counter)
    const fanGeo = new THREE.BufferGeometry();
    fanGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    this.beamFan = new THREE.Mesh(fanGeo, new THREE.MeshBasicMaterial({ color: '#ff3048', transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
    const band = () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      return g;
    };
    this.beamLine = new THREE.Mesh(band(), new THREE.MeshBasicMaterial({ color: '#ff5a6a', side: THREE.DoubleSide }));
    this.beamGlow = new THREE.Mesh(band(), new THREE.MeshBasicMaterial({ color: '#ff2a44', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
    this.beamDot = new THREE.Mesh(new THREE.CircleGeometry(0.028, 10), new THREE.MeshBasicMaterial({ color: '#ff5a6a' }));
    for (const m of [this.beamFan, this.beamLine, this.beamGlow, this.beamDot]) {
      m.layers.set(LAYER_NO_OUTLINE);
      m.frustumCulled = false;
      m.visible = false;
      m.renderOrder = 2;
      this.root.add(m);
    }

    // ---- receipt: a bendy strip that slides out of the mouth
    this.defaultTex = defaultReceiptTexture();
    this.receiptMat = new THREE.MeshBasicMaterial({ map: this.defaultTex, side: THREE.DoubleSide });
    const rg = new THREE.BufferGeometry();
    const nv = (RECEIPT_SEG + 1) * 2;
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    rg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(nv * 2), 2));
    rg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nv * 3).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
    const idx: number[] = [];
    for (let i = 0; i < RECEIPT_SEG; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    rg.setIndex(idx);
    this.receipt = new THREE.Mesh(rg, this.receiptMat);
    this.receipt.visible = false;
    this.receipt.castShadow = true;
    this.receipt.frustumCulled = false;
    this.receipt.userData.receipt = true;
    this.receipt.userData.clerk = this;
    this.root.add(this.receipt);

    this.update(0, 0);

    // ---- pick volume around the rest pose (sits behind the receipt so the paper wins raycasts)
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.mech);
    this.root.worldToLocal(box.min);
    this.root.worldToLocal(box.max);
    const size = box.getSize(new THREE.Vector3());
    const hit = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y + 0.08, 0.22), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2 + 0.02, -0.06);
    hit.userData.clerk = this;
    this.hit = hit;
    this.root.add(hit);
  }

  // ------------------------------------------------------------------------------------------------
  // construction helpers

  private cx(px: number) {
    return (px - MIDX) / this.ppu;
  }
  private cy(py: number) {
    return (FLOOR - py) / this.ppu;
  }

  /** Atlas geometry for a sprite, anchored at its pivot (built from the bitmap: no canvas readback). */
  private geo(id: string, s: Sprite) {
    this.atlas.add(id, s.bmp.toCanvas());
    const ax = (s.px - s.ox) / s.bmp.w;
    const ay = (s.oy + s.bmp.h - s.py) / s.bmp.h;
    return sealQuads(spriteGeometry(s.bmp, { ppu: this.ppu, anchor: [ax, ay], uv: this.atlas.uv(id) }), 0.2 / this.ppu);
  }

  /** A sprite in its own group at its pivot, placed relative to the parent's pivot. */
  private part(id: string, s: Sprite, parent: THREE.Object3D, parentPivot: Pt, z: number) {
    const g = new THREE.Group();
    g.position.set((s.px - parentPivot[0]) / this.ppu, -(s.py - parentPivot[1]) / this.ppu, z);
    const m = new THREE.Mesh(this.geo(id, s), this.mat);
    m.castShadow = true;
    g.add(m);
    parent.add(g);
    return g;
  }

  // ------------------------------------------------------------------------------------------------
  // public API

  /** Big claw waves hello; the axolotl waves too. */
  wave() {
    return this.play('wave', 2.1);
  }

  /** Arms up, happy eyes, the mech bounces and spins, bubbles burst from the exhausts. */
  cheer() {
    this.burstQueue = 2;
    return this.play('cheer', 1.8);
  }

  /** The claw points down-forward at the counter while the axolotl nods. */
  point() {
    return this.play('point', 1.9);
  }

  /** Leans forward; a red scanner line sweeps from the drill nose. */
  scan() {
    return this.play('scan', 1.7);
  }

  /** The jaw opens and a paper receipt slides out and dangles. */
  print(receiptTexture?: THREE.Texture) {
    const tex = receiptTexture ?? this.defaultTex;
    this.receiptMat.map = tex;
    this.receiptMat.needsUpdate = true;
    const img = tex.image as { width?: number; height?: number } | undefined;
    const aspect = img && img.width && img.height ? img.height / img.width : 2;
    this.receiptW = 0.25;
    this.receiptLen = clamp(this.receiptW * aspect, 0.3, 0.6);
    this.receiptP = 0;
    this.receiptOut = true;
    this.receipt.visible = true;
    this.receiptSwingV += 1.5;
    return this.play('print', 2.3);
  }

  hideReceipt() {
    this.receiptOut = false;
    this.receiptP = 0;
    this.receipt.visible = false;
  }

  /** Glance toward a world point (null = idle glancing). */
  lookAt(point: THREE.Vector3 | null) {
    if (point) {
      this.lookTarget.copy(point);
      this.lookActive = true;
    } else this.lookActive = false;
  }

  setMood(mood: ClerkMood) {
    if (mood === this.mood) return;
    this.mood = mood;
    if (mood === 'surprised') {
      this.sqV += 4;
      this.moodKick = 1;
    } else if (mood === 'happy') this.sqV -= 2.5;
    this.flourishIn = Math.min(this.flourishIn, mood === 'sleepy' ? 5 : 12);
  }

  get currentMood() {
    return this.mood;
  }

  private play(kind: ActKind, dur: number) {
    return new Promise<void>((resolve) => {
      if (this.act) {
        // interrupting: fade from wherever the previous action left the rig
        this.act.resolve?.();
        for (const k of BLEND_KEYS) this.fromPose[k] = this.lastPose[k];
        this.xfade = XFADE;
      }
      this.act = { kind, t: 0, dur, resolve };
      this.fidgetT = -1;
    });
  }

  // ------------------------------------------------------------------------------------------------
  // animation

  update(dt: number, _t = 0, camera?: THREE.Camera) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    this.time += dt;
    const P = this.pose;
    const mood = this.mood;
    this.ph += dt * (mood === 'sleepy' ? 0.6 : mood === 'happy' ? 1.2 : 1);
    this.idle(P, dt, camera);

    // scheduled idle flourishes (only when nothing else is going on)
    if (!this.act) {
      this.flourishIn -= dt;
      if (this.flourishIn <= 0) {
        this.flourishIn = 8 + this.rand() * 7;
        const r = this.rand();
        const pick: ActKind = mood === 'sleepy' ? (r < 0.6 ? 'yawn' : 'hop') : r < 0.25 ? 'yawn' : r < 0.5 ? 'drill' : r < 0.75 ? 'thumbs' : 'hop';
        const dur = pick === 'yawn' ? 2.3 : pick === 'drill' ? 1.5 : pick === 'thumbs' ? 1.9 : 1.0;
        this.act = { kind: pick, t: 0, dur, resolve: null };
      }
    }
    const a = this.act;
    if (a) {
      a.t += dt;
      this.applyAct(P, a, dt);
      if (a.t >= a.dur) {
        this.act = null;
        a.resolve?.();
      }
    }
    if (this.xfade > 0) {
      this.xfade = Math.max(0, this.xfade - dt);
      const w = sstep(0, XFADE, XFADE - this.xfade);
      for (let i = 0; i < BLEND_KEYS.length; i++) {
        const k: BlendKey = BLEND_KEYS[i];
        P[k] = lerp(this.fromPose[k], P[k], w);
      }
    }
    for (let i = 0; i < BLEND_KEYS.length; i++) this.lastPose[BLEND_KEYS[i]] = P[BLEND_KEYS[i]];
    this.applyPose(P, dt);
    this.updateBubbles(dt);
    this.updateReceipt(dt);
    this.updateBeam(P);
  }

  /** Always-on layered idle motion (also resets the pose). */
  private idle(P: Pose, dt: number, camera?: THREE.Camera) {
    const ph = this.ph;
    const mood = this.mood;
    const sleepy = mood === 'sleepy';
    P.hover = Math.sin(ph * 1.7) * 0.034 + Math.sin(ph * 0.63 + 1) * 0.012 - (sleepy ? 0.03 : 0);
    P.lean = Math.sin(ph * 0.9) * 0.018 - (sleepy ? 0.03 : 0);
    P.shiftX = 0;
    P.shiftZ = 0;
    P.spin = 0;
    P.tiltX = 0;
    P.squash = Math.sin(ph * 1.7 + 1.4) * 0.012;
    P.shake = 0;
    P.tail = Math.sin(ph * 2.3) * 0.09;
    P.dorsal = Math.sin(ph * 1.8 + 1) * 0.045;
    P.fin = Math.sin(ph * 2.7 + 0.5) * 0.14;
    P.hatch = Math.sin(ph * 1.2 + 2) * 0.04;
    P.legs = Math.sin(ph * 1.7 - 0.9) * 0.12;
    P.jaw = this.receiptOut ? 0.16 : 0;
    P.drillSpeed = sleepy ? 0.6 : 3.5;
    P.drillTilt = 0;
    P.up = REST_UP + Math.sin(ph * 1.3) * 2.5;
    P.fo = REST_FO + Math.sin(ph * 1.3 + 0.7) * 3.5;
    P.cl = REST_CL + Math.sin(ph * 1.3 + 1.3) * 4.5;
    P.armZ = 0;
    P.spread = 0;
    let curl = sleepy ? 1.4 : 1;
    // idle finger fidget: open wide, then clench, then relax
    this.fidgetIn -= dt;
    if (this.fidgetIn <= 0 && this.fidgetT < 0 && !this.act) {
      this.fidgetT = 0;
      this.fidgetKind = (this.fidgetKind + 1) % 2;
      this.fidgetIn = 4 + this.rand() * 4;
    }
    P.curl0 = P.curl1 = P.curl2 = P.curl3 = curl;
    if (this.fidgetT >= 0) {
      this.fidgetT += dt;
      const f = this.fidgetT;
      if (this.fidgetKind === 0) {
        // open wide, clench, relax
        curl = f < 0.35 ? lerp(1, 0, sstep(0, 0.25, f)) : f < 0.8 ? lerp(0, 2, sstep(0.35, 0.6, f)) : lerp(2, 1, sstep(0.8, 1.2, f));
        P.curl0 = P.curl1 = P.curl2 = P.curl3 = curl;
        P.spread = bump(0, 0.6, f) * 6;
        P.cl += bump(0.3, 1.1, f) * -6;
        if (f > 1.25) this.fidgetT = -1;
      } else {
        // drum the fingers on the counter, one after another, twice
        P.curl2 = 1 + bump(0, 0.16, f % 0.62) * 1.2;
        P.curl1 = 1 + bump(0, 0.16, (f - 0.09) % 0.62) * 1.2;
        P.curl0 = 1 + bump(0, 0.16, (f - 0.18) % 0.62) * 1.2;
        P.cl += 4 * bump(0, 1.3, f);
        if (f > 1.3) this.fidgetT = -1;
      }
    }
    P.thumb = 0;
    P.pilotY = Math.sin(ph * 2.4) * 0.35;
    P.pilotTilt = Math.sin(ph * 1.1) * 2;
    P.armL = Math.sin(ph * 2.1) * 4;
    P.armR = Math.sin(ph * 2.1 + 1) * -4;
    P.gillAmp = mood === 'happy' ? 9 : sleepy ? 3 : mood === 'surprised' ? 4 : 6;
    P.gillSpeed = mood === 'happy' ? 5 : sleepy ? 1.5 : mood === 'surprised' ? 9 : 3.2;
    P.gillFlare = mood === 'surprised' ? 20 : sleepy ? -14 : 0;
    P.eyes = mood === 'happy' ? 'sparkle' : mood === 'surprised' ? 'wide' : sleepy ? 'sleepy' : 'dot';
    P.mouth = mood === 'happy' ? 'open' : mood === 'surprised' ? 'o' : sleepy ? 'smile' : 'grin';
    if (mood === 'surprised') {
      P.armL += 40;
      P.armR -= 40;
      P.lean += 0.03;
    }
    if (this.moodKick > 0) {
      this.moodKick = Math.max(0, this.moodKick - dt * 2.5);
      P.lean += Math.sin(this.moodKick * Math.PI) * 0.08;
      P.pilotY += Math.sin(this.moodKick * Math.PI) * 2.5;
    }
    P.beam = 0;
    P.beamX = 0;

    // blinking (actions that squeeze the eyes shut simply override it)
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkT = 0.13;
      const double = this.rand() < 0.2;
      this.blinkIn = double ? 0.28 : (sleepy ? 1.2 : 2.2) + this.rand() * 3;
    }
    if (this.blinkT > 0) {
      this.blinkT -= dt;
      P.eyes = 'blink';
    }
    // glancing around (or at the player now and then)
    this.glanceIn -= dt;
    if (this.glanceIn <= 0) {
      const r = this.rand();
      this.glanceIn = 1.8 + this.rand() * 3.5;
      if (r < 0.4) {
        this.glanceX = 0;
        this.glanceY = 0;
      } else if (r < 0.85) {
        this.glanceX = (this.rand() < 0.5 ? -1 : 1) * (0.5 + this.rand() * 0.5);
        this.glanceY = (this.rand() - 0.6) * 0.8;
      } else if (camera) {
        this.worldToLook(camera.getWorldPosition(this.v1));
        this.glanceX = this.v1.x;
        this.glanceY = this.v1.y;
      }
    }
    let lx = this.glanceX;
    let ly = this.glanceY;
    if (this.lookActive) {
      this.worldToLook(this.v1.copy(this.lookTarget));
      lx = this.v1.x;
      ly = this.v1.y;
    }
    // the pilot keeps an eye on its own claw while it fidgets
    const peek = this.fidgetT >= 0 && !this.lookActive ? bump(0, 1.3, this.fidgetT) : 0;
    P.lookX = lerp(lx, 0.9, peek);
    P.lookY = lerp(ly, -0.7, peek);
  }

  /** World point → look direction (-1..1, -1..1) from the pilot's head. Writes into v. */
  private worldToLook(v: THREE.Vector3) {
    this.root.updateWorldMatrix(true, false);
    this.root.worldToLocal(v);
    const hx = this.cx(PIV.eyes[0]);
    const hy = this.cy(PIV.eyes[1]);
    const dz = Math.max(0.6, v.z);
    v.set(clamp((v.x - hx) / (dz * 0.9), -1, 1), clamp((v.y - hy) / (dz * 0.9), -1, 1), 0);
    return v;
  }

  private applyAct(P: Pose, a: Act, dt: number) {
    const t = a.t;
    const d = a.dur;
    switch (a.kind) {
      case 'wave': {
        const w = env(t, d, 0.32, 0.4);
        const wv = Math.sin(t * 15);
        P.up = lerp(P.up, -4, w);
        P.fo = lerp(P.fo, -54 + Math.sin(t * 15 - 0.7) * 7, w);
        P.cl = lerp(P.cl, -70 + wv * 24, w);
        this.setCurl(P, lerp(P.curl0, 0, w));
        P.spread = lerp(P.spread, 9, w);
        P.armZ = 0.07 * w;
        P.lean += 0.045 * w;
        P.hover += 0.012 * w;
        P.armR = lerp(P.armR, -56 + Math.sin(t * 15 + 0.8) * 16, sstep(0.1, 0.4, t) * (1 - sstep(d - 0.45, d - 0.05, t)));
        P.pilotTilt -= 5 * w;
        P.gillSpeed = lerp(P.gillSpeed, 6, w);
        if (w > 0.3) {
          P.eyes = 'happy';
          P.mouth = 'open';
        }
        break;
      }
      case 'cheer': {
        const w = env(t, d, 0.12, 0.3);
        const hop = Math.abs(Math.sin((t / 0.58) * Math.PI));
        P.hover += hop * 0.1 * w;
        P.squash += Math.cos((t / 0.58) * Math.PI * 2) * 0.05 * w;
        P.spin = sstep(0.5, 1.0, t) * Math.PI * 2;
        P.armL = lerp(P.armL, 54 + Math.sin(t * 18) * 14, w);
        P.armR = lerp(P.armR, -54 - Math.sin(t * 18) * 14, w);
        P.pilotY += Math.abs(Math.sin(t * 9)) * 2 * w;
        P.eyes = 'happy';
        P.mouth = 'open';
        P.gillFlare = lerp(P.gillFlare, 18, w);
        P.gillSpeed = 10;
        P.gillAmp = lerp(P.gillAmp, 9, w);
        const pump = Math.sin(t * 11);
        P.up = lerp(P.up, 2 + pump * 10, w);
        P.fo = lerp(P.fo, -58 + pump * 6, w);
        P.cl = lerp(P.cl, -72 + pump * 8, w);
        P.armZ = 0.06 * w;
        this.setCurl(P, lerp(P.curl0, 2, w));
        P.drillSpeed = 26;
        P.tail += Math.sin(t * 14) * 0.2 * w;
        P.fin += Math.sin(t * 16) * 0.35 * w;
        P.dorsal += Math.sin(t * 12) * 0.08 * w;
        P.hatch += Math.sin(t * 20) * 0.12 * w;
        P.legs += Math.sin(t * 13) * 0.4 * w;
        if (this.burstQueue === 2 && t > 0.08) this.burst(7);
        if (this.burstQueue === 1 && t > 0.9) this.burst(6);
        break;
      }
      case 'point': {
        const w = env(t, d, 0.3, 0.38);
        const tap = bump(0.62, 0.82, t) + bump(0.9, 1.1, t);
        P.up = lerp(P.up, -30, w);
        P.fo = lerp(P.fo, 2, w);
        P.cl = lerp(P.cl, 28 + tap * 9, w);
        P.armZ = 0.16 * w;
        P.curl0 = lerp(P.curl0, 0, w);
        P.curl1 = P.curl2 = P.curl3 = lerp(P.curl1, 2, w);
        P.spread = lerp(P.spread, -3, w);
        P.lean -= 0.03 * w;
        P.shiftZ += 0.03 * w;
        const nod = t > 0.35 && t < 1.45 ? Math.abs(Math.sin((t - 0.35) * 5.7)) : 0;
        P.pilotY -= nod * 1.6 * w;
        P.pilotTilt += nod * 4 * w;
        P.lookX = lerp(P.lookX, 0.8, w);
        P.lookY = lerp(P.lookY, -0.9, w);
        P.mouth = nod > 0.5 ? 'cat' : 'smile';
        break;
      }
      case 'scan': {
        const w = env(t, d, 0.28, 0.32);
        P.lean = lerp(P.lean, -0.14, w);
        P.shiftZ += 0.06 * w;
        P.tiltX += 0.07 * w;
        P.drillTilt = -0.12 * w;
        P.drillSpeed = lerp(P.drillSpeed, 22, w);
        P.up = lerp(P.up, 98, w);
        P.fo = lerp(P.fo, 6, w);
        P.cl = lerp(P.cl, -4, w);
        this.setCurl(P, lerp(P.curl0, 1.4, w));
        const on = sstep(0.3, 0.4, t) * (1 - sstep(1.3, 1.4, t));
        P.beam = on;
        P.beamX = Math.sin(((t - 0.3) / 1.05) * Math.PI * 2) * 0.26;
        P.lookX = lerp(P.lookX, 0.9 + P.beamX, w);
        P.lookY = lerp(P.lookY, -1, w);
        if (t < 1.38) P.mouth = 'o';
        else {
          P.eyes = 'happy';
          P.mouth = 'open';
          P.hover += bump(1.38, 1.7, t) * 0.04;
        }
        P.gillFlare += 8 * w;
        break;
      }
      case 'print': {
        const w = env(t, d, 0.3, 0.5);
        P.jaw = t < 0.35 ? sstep(0, 0.3, t) : t < 1.55 ? 1 : lerp(1, 0.16, sstep(1.55, 1.8, t));
        this.receiptP = clamp((t - 0.32) / 1.2, 0, 1);
        const printing = t > 0.32 && t < 1.55;
        P.shake = printing ? 0.0045 : 0;
        P.up = lerp(P.up, 62, w);
        P.fo = lerp(P.fo, -44, w);
        P.cl = lerp(P.cl, -66, w);
        this.setCurl(P, lerp(P.curl0, 0.4, w));
        P.armZ = 0.03 * w;
        P.lookX = lerp(P.lookX, 0.6, w);
        P.lookY = lerp(P.lookY, -1, w);
        if (t < 1.6) P.mouth = 'o';
        else {
          P.eyes = 'happy';
          P.mouth = 'open';
          P.hover += bump(1.6, 1.95, t) * 0.05;
        }
        break;
      }
      case 'yawn': {
        const w = env(t, d, 0.35, 0.45);
        const stretch = sstep(0.25, 0.6, t) * (1 - sstep(1.3, 1.7, t));
        P.armL = lerp(P.armL, 58, stretch);
        P.armR = lerp(P.armR, -58, stretch);
        P.pilotY += stretch * 1.6;
        if (t > 0.2 && t < 1.85) P.eyes = 'blink';
        if (t > 0.3 && t < 1.7) P.mouth = 'yawn';
        P.gillFlare += t < 1.7 ? -12 * w : 16 * bump(1.7, 2.2, t);
        P.hover -= 0.02 * w;
        P.squash += stretch * 0.03;
        P.pilotTilt += bump(1.8, 2.25, t) * Math.sin(t * 25) * 6;
        P.drillSpeed *= 0.3;
        break;
      }
      case 'drill': {
        const w = env(t, d, 0.2, 0.3);
        const rev = sstep(0.15, 0.35, t) * (1 - sstep(1.1, 1.4, t));
        P.drillSpeed = lerp(P.drillSpeed, 32, rev);
        P.drillTilt = Math.sin(t * 60) * 0.03 * rev;
        P.shake = 0.003 * rev;
        P.eyes = 'sparkle';
        P.mouth = 'open';
        P.lookX = lerp(P.lookX, 1, w);
        P.lookY = lerp(P.lookY, 0.1, w);
        this.setCurl(P, lerp(P.curl0, 2, w));
        P.cl += Math.sin(t * 30) * 3 * rev;
        if (t > 0.3 && this.burstQueue === 0 && t - dt <= 0.3) this.burst(4);
        break;
      }
      case 'thumbs': {
        const w = env(t, d, 0.3, 0.38);
        P.up = lerp(P.up, 10, w);
        P.fo = lerp(P.fo, -54, w);
        P.cl = lerp(P.cl, -46 + Math.sin(t * 8) * 4, w);
        P.curl0 = P.curl1 = P.curl2 = lerp(P.curl0, 2, w);
        P.curl3 = lerp(P.curl3, 0, w);
        P.thumb = -34 * w;
        P.armZ = 0.05 * w;
        if (w > 0.4) {
          P.eyes = 'wink';
          P.mouth = 'grin';
        }
        P.pilotTilt += 5 * w;
        P.lean += 0.03 * w;
        break;
      }
      case 'hop': {
        const crouch = bump(0, 0.18, t);
        const air = t > 0.16 && t < 0.72 ? Math.sin(((t - 0.16) / 0.56) * Math.PI) : 0;
        P.hover += -crouch * 0.03 + air * 0.15;
        P.squash += -crouch * 0.08 + (air > 0 ? 0.05 * (1 - air) : 0) - bump(0.72, 0.9, t) * 0.09;
        P.legs += -air * 0.5;
        P.fin += air * 0.4;
        P.tail += Math.sin(t * 16) * 0.15 * air;
        if (air > 0.6) {
          P.eyes = 'happy';
          P.mouth = 'open';
        }
        break;
      }
    }
  }

  private setCurl(P: Pose, c: number) {
    P.curl0 = P.curl1 = P.curl2 = P.curl3 = c;
  }

  /** Queue a bubble burst from both exhausts. */
  private burst(n: number) {
    this.burstQueue = Math.max(0, this.burstQueue - 1);
    for (let i = 0; i < n; i++) this.emit(i % 2, 1.8);
    this.puff[0] = this.puff[1] = 1;
  }

  private applyPose(P: Pose, dt: number) {
    const ppu = this.ppu;
    // squash & stretch spring
    this.sqV += (-this.sq * 110 - this.sqV * 9) * dt;
    this.sq += this.sqV * dt;
    const sq = clamp(this.sq + P.squash, -0.25, 0.25);
    const shake = P.shake ? Math.sin(this.time * 190) * P.shake : 0;
    const m = this.mech;
    m.position.set(this.mechBase.x + P.shiftX + shake, this.mechBase.y + LIFT + P.hover, P.shiftZ);
    m.rotation.set(P.tiltX, P.spin, P.lean);
    m.scale.set(1 - sq * 0.5, 1 + sq, 1);

    // mount motion for secondary springs
    const mountY = m.position.y;
    const v = dt > 0 ? (mountY - this.prevMountY) / dt : 0;
    this.prevMountY = mountY;
    this.mountA = dt > 0 ? (v - this.mountV) / dt : 0;
    this.mountV = v;
    const acc = clamp(this.mountA, -30, 30);

    // pilot lags behind the mech (secondary motion)
    this.pilotV += (-this.pilotAbs * 150 - this.pilotV * 10 - acc * 0.9) * dt;
    this.pilotAbs = clamp(this.pilotAbs + this.pilotV * dt, -0.05, 0.05);
    this.pilot.position.set(this.pilotBase.x, this.pilotBase.y + this.pilotAbs + P.pilotY / ppu, this.pilotBase.z);
    this.pilot.rotation.z = -P.pilotTilt * D - this.lookX * 0.05;

    // fins, legs, hatch, antenna
    this.tailUpper.rotation.z = P.tail;
    this.tailLower.rotation.z = -P.tail * 0.8 + 0.02;
    this.dorsal.rotation.z = P.dorsal;
    this.finNear.rotation.z = P.fin;
    const legSwing = P.legs + clamp(v * 1.2, -0.4, 0.4);
    this.legNear.rotation.z = legSwing;
    this.legFar.rotation.z = legSwing * 0.8 + 0.05;
    this.hatchV += (-this.hatchA * 60 - this.hatchV * 5 + acc * 0.5) * dt;
    this.hatchA += this.hatchV * dt;
    this.hatch.rotation.z = P.hatch + clamp(this.hatchA, -0.4, 0.4);
    this.antennaV += (-this.antennaA * 90 - this.antennaV * 4 - acc * 0.9 - P.shake * 400 * Math.sin(this.time * 70)) * dt;
    this.antennaA += this.antennaV * dt;
    this.antenna.rotation.z = clamp(this.antennaA, -0.6, 0.6);

    // jaw
    this.jaw.rotation.z = -P.jaw * 24 * D;
    // the mech blinks its lens too (and droops it when sleepy)
    this.mechBlinkIn -= dt;
    if (this.mechBlinkIn <= 0) {
      this.mechBlinkT = 0.14;
      this.mechBlinkIn = 3 + this.rand() * 4;
    }
    this.mechBlinkT -= dt;
    const lidShut = this.mechBlinkT > 0 || P.eyes === 'happy';
    const lidHalf = this.mood === 'sleepy' || P.mouth === 'yawn';
    this.lid.visible = lidShut || lidHalf;
    const lg = this.lidGeo[lidShut ? 1 : 0];
    if (this.lid.geometry !== lg) this.lid.geometry = lg;

    // exhaust puff recoil
    for (let i = 0; i < 2; i++) {
      this.puff[i] = Math.max(0, this.puff[i] - dt * 5);
      const k = this.puff[i] * 1.6;
      const dx = this.exhaustDir[i][0];
      const dy = this.exhaustDir[i][1];
      this.exhausts[i].position.set(this.exhaustBase[i].x - (dx * k) / ppu, this.exhaustBase[i].y - (dy * k) / ppu, this.exhaustBase[i].z);
      this.exhausts[i].scale.set(1 + this.puff[i] * 0.08, 1 + this.puff[i] * 0.08, 1);
    }

    // drill spin frames
    this.drillPhase += dt * P.drillSpeed;
    const frame = Math.floor(this.drillPhase) & 3;
    if (frame !== this.drillFrame) {
      this.drillFrame = frame;
      this.drillMesh.geometry = this.drillGeo[frame];
    }
    this.drill.rotation.z = P.drillTilt + Math.sin(this.ph * 1.9) * 0.015;

    // the arm
    this.shoulder.position.z = this.shoulderZ + P.armZ;
    this.shoulder.rotation.z = -(P.up - REST_UP) * D;
    this.elbow.rotation.z = -(P.fo - P.up + (REST_UP - REST_FO)) * D;
    this.wrist.rotation.z = -(P.cl - P.fo - (REST_CL - REST_FO)) * D;
    const curls = this.curls;
    curls[0] = P.curl0;
    curls[1] = P.curl1;
    curls[2] = P.curl2;
    curls[3] = P.curl3;
    for (let f = 0; f < 4; f++) {
      const c = clamp(curls[f], 0, 2);
      const fr = Math.round(c);
      const g = this.fingerGeo[f][fr];
      if (this.fingerMesh[f].geometry !== g) this.fingerMesh[f].geometry = g;
      const spread = f === 3 ? -P.spread * 1.5 + P.thumb : (f - 1) * P.spread;
      this.fingers[f].rotation.z = -((c - fr) * 12 + spread) * D;
    }

    // pilot face + arms + gills
    this.lookX += (P.lookX - this.lookX) * Math.min(1, dt * 12);
    this.lookY += (P.lookY - this.lookY) * Math.min(1, dt * 12);
    const ex = Math.round(this.lookX * 1.6) / ppu;
    const ey = Math.round(this.lookY * 1.1) / ppu;
    this.eyesMesh.position.set(this.eyesBase.x + ex, this.eyesBase.y + ey, this.eyesBase.z);
    this.mouthMesh.position.set(this.mouthBase.x + ex * 0.6, this.mouthBase.y + ey * 0.4, this.mouthBase.z);
    if (this.eyesMesh.geometry !== this.eyeGeo[P.eyes]) this.eyesMesh.geometry = this.eyeGeo[P.eyes];
    if (this.mouthMesh.geometry !== this.mouthGeo[P.mouth]) this.mouthMesh.geometry = this.mouthGeo[P.mouth];
    this.pilotArmL.rotation.z = -P.armL * D;
    this.pilotArmR.rotation.z = -P.armR * D;
    const armMeshL = this.pilotArmL.children[0] as THREE.Mesh;
    const armMeshR = this.pilotArmR.children[0] as THREE.Mesh;
    // raised arms swap to a longer frame whose open hand sticks out past the big head
    const upL = P.armL > 34;
    const upR = P.armR < -34;
    const gl = this.pilotArmGeo[0][upL ? 1 : 0];
    const gr = this.pilotArmGeo[1][upR ? 1 : 0];
    if (armMeshL.geometry !== gl) armMeshL.geometry = gl;
    if (armMeshR.geometry !== gr) armMeshR.geometry = gr;

    const flap = clamp(this.pilotV * 3, -0.6, 0.6);
    for (let i = 0; i < 6; i++) {
      const right = i < 3;
      const row = i % 3;
      const side = right ? 1 : -1;
      const spreadDir = row === 0 ? -1 : row === 1 ? -0.3 : 1;
      const wig = Math.sin(this.time * P.gillSpeed + row * 1.3 + (right ? 0 : 0.7)) * P.gillAmp;
      const deg = (wig + P.gillFlare * spreadDir) * side;
      this.gills[i].rotation.z = -deg * D + flap * side * (row === 1 ? 0.5 : 1) * 0.35;
    }

    // chain: a little pendulum hanging from the drill collar
    this.updateChain(dt);
  }

  private updateChain(dt: number) {
    const anchor = this.chain[0];
    anchor.updateWorldMatrix(true, false);
    this.v1.setFromMatrixPosition(anchor.matrixWorld);
    this.root.worldToLocal(this.v1);
    if (!this.chainInit || dt <= 0) {
      this.chainPrev.copy(this.v1);
      this.chainVel.set(0, 0, 0);
      this.chainInit = true;
      if (dt <= 0) return;
    }
    const vx = (this.v1.x - this.chainPrev.x) / dt;
    const vy = (this.v1.y - this.chainPrev.y) / dt;
    const ax = clamp((vx - this.chainVel.x) / dt, -40, 40);
    const ay = clamp((vy - this.chainVel.y) / dt, -40, 40);
    this.chainVel.set(vx, vy, 0);
    this.chainPrev.copy(this.v1);
    const L = (CHAIN_LINK * 3) / this.ppu;
    const g = 9.8;
    const A = this.chainA;
    const V = this.chainV;
    V[0] += (-((g + ay) * Math.sin(A[0]) + ax * Math.cos(A[0])) / L - V[0] * 1.6) * dt;
    A[0] = clamp(A[0] + V[0] * dt, -1.2, 1.2);
    for (let i = 1; i < 3; i++) {
      V[i] += ((A[i - 1] - A[i]) * 160 - V[i] * 7 - (ax * Math.cos(A[i])) / L * 0.3) * dt;
      A[i] = clamp(A[i] + V[i] * dt, -1.4, 1.4);
    }
    // world angle → local rotation (undo the mech lean and drill tilt)
    const parentRot = this.mech.rotation.z + this.drill.rotation.z;
    this.chain[0].rotation.z = A[0] - parentRot;
    this.chain[1].rotation.z = A[1] - A[0];
    this.chain[2].rotation.z = A[2] - A[1];
  }

  // ------------------------------------------------------------------------------------------------
  // bubbles

  private free(): Bubble | null {
    for (let i = 0; i < this.bubbles.length; i++) if (!this.bubbles[i].on) return this.bubbles[i];
    return null;
  }

  /** A hot spark flicked off the spinning drill tip. */
  private spark() {
    const b = this.free();
    if (!b) return;
    this.drillTip.updateWorldMatrix(true, false);
    this.v2.setFromMatrixPosition(this.drillTip.matrixWorld);
    this.root.worldToLocal(this.v2);
    const a = (this.rand() - 0.3) * 2.4;
    const sp = 0.6 + this.rand() * 0.9;
    b.on = true;
    b.spark = true;
    b.x = this.v2.x;
    b.y = this.v2.y;
    b.z = this.v2.z + 0.04;
    b.vx = Math.cos(a) * sp;
    b.vy = Math.sin(a) * sp + 0.4;
    b.age = 0;
    b.life = 0.25 + this.rand() * 0.25;
    b.size = 4;
    b.ph = 0;
  }

  private emit(ex: number, speed = 1) {
    const b = this.free();
    if (!b) return;
    b.spark = false;
    const o = this.exhaustMouths[ex];
    o.updateWorldMatrix(true, false);
    this.v2.setFromMatrixPosition(o.matrixWorld);
    this.root.worldToLocal(this.v2);
    const dx = this.exhaustDir[ex][0];
    const dy = this.exhaustDir[ex][1];
    const s = (0.25 + this.rand() * 0.2) * speed;
    b.on = true;
    b.x = this.v2.x;
    b.y = this.v2.y;
    b.z = this.v2.z + 0.02 + this.rand() * 0.05;
    b.vx = dx * s + (this.rand() - 0.5) * 0.08 * speed;
    b.vy = dy * s + (this.rand() - 0.2) * 0.08 * speed;
    b.age = 0;
    b.life = 0.9 + this.rand() * 0.9;
    const r = this.rand();
    b.size = r < 0.4 ? 0 : r < 0.8 ? 1 : 2;
    b.ph = this.rand() * 6.28;
  }

  private updateBubbles(dt: number) {
    const sleepy = this.mood === 'sleepy';
    if (this.pose.drillSpeed > 24) {
      this.sparkIn -= dt;
      if (this.sparkIn <= 0) {
        this.sparkIn = 0.03 + this.rand() * 0.05;
        this.spark();
      }
    }
    this.bubbleIn -= dt;
    if (this.bubbleIn <= 0) {
      this.bubbleIn = (sleepy ? 1.8 : 0.75) + this.rand() * 0.6;
      const ex = this.rand() < 0.5 ? 0 : 1;
      const n = 1 + (this.rand() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) this.emit(ex, 1);
      this.puff[ex] = 1;
    }
    const counts = this.counts;
    counts.fill(0);
    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i];
      if (!b.on) continue;
      b.age += dt;
      if (b.age > b.life + (b.spark ? 0 : 0.14)) {
        b.on = false;
        continue;
      }
      if (b.spark) {
        b.vy -= 4.5 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        const n = counts[4]++;
        const k = 1 - (b.age / b.life) * 0.5;
        this.s3.set(k, k, 1);
        this.v1.set(b.x, b.y, b.z);
        this.m4.compose(this.v1, this.q4.setFromEuler(this.e3.set(0, 0, 0)), this.s3);
        this.bubbleMeshes[4].setMatrixAt(n, this.m4);
        continue;
      }
      // buoyancy + drag + wobble
      b.vy += (0.55 - b.vy) * Math.min(1, dt * 1.6);
      b.vx *= Math.max(0, 1 - dt * 1.8);
      b.x += (b.vx + Math.sin(b.age * 7 + b.ph) * 0.05) * dt;
      b.y += b.vy * dt;
      const popping = b.age > b.life;
      const kind = popping ? 3 : b.size;
      const im = this.bubbleMeshes[kind];
      const n = counts[kind]++;
      const grow = popping ? 1 : Math.min(1, b.age / 0.12);
      this.s3.set(grow, grow, 1);
      this.v1.set(b.x, b.y, b.z);
      this.m4.compose(this.v1, this.q4.setFromEuler(this.e3.set(0, 0, 0)), this.s3);
      im.setMatrixAt(n, this.m4);
    }
    for (let k = 0; k < 5; k++) {
      const im = this.bubbleMeshes[k];
      im.count = counts[k];
      im.instanceMatrix.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------------------------------------------
  // receipt

  private updateReceipt(dt: number) {
    if (!this.receiptOut) return;
    if (this.act?.kind !== 'print' && this.receiptP < 1) this.receiptP = Math.min(1, this.receiptP + dt * 1.2);
    this.mouthAnchor.updateWorldMatrix(true, false);
    this.v1.setFromMatrixPosition(this.mouthAnchor.matrixWorld);
    this.root.worldToLocal(this.v1);
    // dangle: a damped swing, nudged by the mech's motion
    this.receiptSwingV += (-this.receiptSwing * 30 - this.receiptSwingV * 2.2 - this.mountA * 0.04 + (this.pose.shake ? Math.sin(this.time * 80) * 3 : 0)) * dt;
    this.receiptSwing = clamp(this.receiptSwing + this.receiptSwingV * dt, -0.5, 0.5);
    const p = this.receiptP;
    const len = Math.max(0.001, this.receiptLen * p);
    const pos = this.receipt.geometry.getAttribute('position') as THREE.BufferAttribute;
    const uv = this.receipt.geometry.getAttribute('uv') as THREE.BufferAttribute;
    const hw = this.receiptW / 2;
    const sw = this.receiptSwing;
    let y = 0;
    let z = 0;
    let x = 0;
    for (let i = 0; i <= RECEIPT_SEG; i++) {
      const s = i / RECEIPT_SEG;
      if (i > 0) {
        const seg = len / RECEIPT_SEG;
        // curls toward the customer near the bottom and swings sideways
        const bend = 0.12 + s * s * 0.5 + Math.sin(this.time * 1.7) * 0.03;
        y -= Math.cos(bend) * seg * Math.cos(sw * 0.6);
        z += Math.sin(bend) * seg;
        x += Math.sin(sw) * seg;
      }
      pos.setXYZ(i * 2, x - hw, y, z);
      pos.setXYZ(i * 2 + 1, x + hw, y, z);
      const v = p * (1 - s);
      uv.setXY(i * 2, 0, v);
      uv.setXY(i * 2 + 1, 1, v);
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    this.receipt.geometry.computeBoundingSphere();
    this.receipt.position.set(this.v1.x, this.v1.y, this.v1.z + 0.09);
  }

  // ------------------------------------------------------------------------------------------------
  // scanner beam

  private setBand(m: THREE.Mesh, cx: number, cz: number, hw: number, th: number, y: number) {
    const a = m.geometry.getAttribute('position') as THREE.BufferAttribute;
    a.setXYZ(0, cx - hw - th, y, cz - th);
    a.setXYZ(1, cx + hw + th, y, cz - th);
    a.setXYZ(2, cx + hw + th, y, cz + th);
    a.setXYZ(3, cx - hw - th, y, cz + th);
    a.needsUpdate = true;
  }

  private updateBeam(P: Pose) {
    const on = P.beam > 0.01;
    this.beamFan.visible = this.beamLine.visible = this.beamGlow.visible = this.beamDot.visible = on;
    if (!on) return;
    this.drillTip.updateWorldMatrix(true, false);
    this.v1.setFromMatrixPosition(this.drillTip.matrixWorld);
    this.root.worldToLocal(this.v1);
    const tx = this.v1.x;
    const ty = this.v1.y;
    const tz = this.v1.z + 0.03;
    this.beamDot.position.set(tx, ty, tz + 0.01);
    this.beamDot.scale.setScalar(0.8 + Math.sin(this.time * 50) * 0.25);
    const cx = tx - 0.3 + P.beamX;
    const cy = 0.958;
    const cz = 0.44;
    const hw = 0.17 * P.beam;
    const fan = this.beamFan.geometry.getAttribute('position') as THREE.BufferAttribute;
    fan.setXYZ(0, tx, ty, tz);
    fan.setXYZ(1, cx - hw, cy, cz);
    fan.setXYZ(2, cx + hw, cy, cz);
    fan.needsUpdate = true;
    this.setBand(this.beamLine, cx, cz, hw, 0.028, cy + 0.002);
    this.setBand(this.beamGlow, cx, cz, hw, 0.09, cy + 0.001);
    (this.beamFan.material as THREE.MeshBasicMaterial).opacity = 0.36 + Math.sin(this.time * 40) * 0.08;
  }
}
