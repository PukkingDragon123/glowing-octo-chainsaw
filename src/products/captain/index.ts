import * as THREE from 'three';
import { Painter, shade } from '../../engine/Painter';
import { voxelMesh } from '../../engine/voxel';
import { ease } from '../../engine/tween';
import { audio } from '../../engine/audio';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import type { QRMatrix } from '../../qr/qr';
import { atlasBox } from '../common/box';
import { layoutModules, orderSpots, qrDecal } from '../common/qrLayout';
import { PieceSwarm } from '../common/swarm';
import { Particles, squareBowl, tileTexture } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import { boxBack, boxBottom, boxFront, boxFrontSmall, boxSide, boxSideSmall, boxTop, CAPTAIN_FLAVORS, captainVoxels, FRONT, INK } from './art';

const BOX = { w: 1.4, h: 2.0, d: 0.5 };

function solid(w: number, h: number, color: string) {
  return new Painter(w, h).clear(color).canvas;
}

/** The cereal box: atlas-textured body, optional hinged flaps and crisp QR decals. */
function cerealBox(f: Flavor, scale: number, qr: QRMatrix | null, withFlaps: boolean) {
  const w = BOX.w * scale;
  const h = BOX.h * scale;
  const d = BOX.d * scale;
  const group = new THREE.Group();
  const front = boxFront(f).canvas;
  const side = boxSide(f).canvas;
  const sideL = boxSide(f, false).canvas;
  const top = withFlaps ? solid(112, 40, '#5a3a22') : boxTop(f).canvas;
  const body = atlasBox(w, h, d, { px: side, nx: sideL, py: top, ny: boxBottom(f).canvas, pz: front, nz: boxBack(f).canvas });
  body.position.y = h / 2;
  group.add(body);

  let flapFront: THREE.Object3D | null = null;
  let flapBack: THREE.Object3D | null = null;
  if (withFlaps) {
    const topArt = boxTop(f);
    const half = (y0: number) => {
      const p = new Painter(112, 20);
      p.ctx.drawImage(topArt.canvas, 0, y0, 112, 20, 0, 0, 112, 20);
      return p.canvas;
    };
    const t = 0.012 * scale;
    const makeFlap = (canvas: HTMLCanvasElement, dir: 1 | -1) => {
      const pivot = new THREE.Group();
      const flap = atlasBox(w, t, d / 2, { px: solid(2, 2, f.c.bg), nx: solid(2, 2, f.c.bg), py: canvas, ny: solid(4, 4, '#caa27a'), pz: solid(4, 2, shade(f.c.bg, -0.1)), nz: solid(4, 2, shade(f.c.bg, -0.1)) });
      flap.position.set(0, t / 2, (-dir * d) / 4);
      pivot.add(flap);
      pivot.position.set(0, h, (dir * d) / 2);
      group.add(pivot);
      return pivot;
    };
    flapFront = makeFlap(half(20), 1);
    flapBack = makeFlap(half(0), -1);
  }

  if (qr) {
    const px = w / FRONT.w;
    const size = FRONT.cardSize * px;
    const card = qrDecal(qr, size, INK, '#ffffff', 2);
    card.position.set(-w / 2 + (FRONT.cardX + FRONT.cardSize / 2) * px, h - (FRONT.cardY + FRONT.cardSize / 2) * px, d / 2 + 0.002 * scale);
    group.add(card);
    const sidePx = d / 40;
    const small = qrDecal(qr, 26 * sidePx, INK, '#ffffff', 1);
    small.rotation.y = Math.PI / 2;
    small.position.set(w / 2 + 0.002 * scale, h - 140 * sidePx, d / 2 - 20 * sidePx);
    group.add(small);
  }
  return { group, flapFront, flapBack, h, w, d };
}

function captainMesh(scale = 0.045) {
  return voxelMesh(captainVoxels(), { scale, anchor: 'bottom-center' });
}

function createShowcase(ctx: ProductContext): ShowcaseItem {
  const { qr, flavor: f, tweens, group: tg } = ctx;
  const root = new THREE.Group();

  // --- box
  const box = cerealBox(f, 1, qr, true);
  const pivot = new THREE.Group(); // rotates around the box centre
  const rest = new THREE.Vector3(-1.25, 0, -0.35);
  pivot.position.set(rest.x, BOX.h / 2, rest.z);
  box.group.position.y = -BOX.h / 2;
  pivot.add(box.group);
  pivot.rotation.y = 0.35;
  root.add(pivot);

  // --- bowl + milk
  const inner = 1.55;
  const bowl = squareBowl(inner, f.c.bowl);
  const bowlPos = new THREE.Vector3(0.7, 0, 0.45);
  bowl.group.position.copy(bowlPos);
  root.add(bowl.group);

  // --- cereal pieces (one per dark module)
  const quiet = 2;
  const qrSize = (inner * qr.size) / (qr.size + quiet * 2);
  const m = qrSize / qr.size;
  const pieceH = m * 0.42;
  const surfaceY = bowl.milkY + pieceH * 0.5;
  const spots = layoutModules(qr, { size: qrSize, center: new THREE.Vector3(bowlPos.x, surfaceY, bowlPos.z) });
  const waffle = tileTexture(4, (c) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, 4, 4);
    c.fillStyle = '#b9b0a8';
    c.fillRect(0, 2, 4, 1);
    c.fillRect(2, 0, 1, 4);
  });
  const baseColor = new THREE.Color(f.c.piece);
  const colors = spots.map(() => baseColor.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.08));
  const scanColors = spots.map(() => new THREE.Color(f.c.piece).offsetHSL(0, 0, -0.03));
  const swarm = new PieceSwarm({
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: new THREE.MeshToonMaterial({ color: '#ffffff', map: waffle }),
    targets: spots.map((s) => s.pos),
    targetQuats: spots.map(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.12)),
    colors,
    scanColors,
    scale: new THREE.Vector3(m * 0.94, pieceH, m * 0.94),
    scanScale: new THREE.Vector3(1.1, 1, 1.1),
    radius: pieceH * 0.5,
    floor: () => bowl.milkY,
    bounds: { minX: bowlPos.x - inner / 2, maxX: bowlPos.x + inner / 2, minZ: bowlPos.z - inner / 2, maxZ: bowlPos.z + inner / 2 },
    restitution: 0.25,
    friction: 5,
    collide: spots.length < 2500,
  });
  root.add(swarm.mesh);

  const fx = new Particles(300);
  root.add(fx.mesh);
  let lastSplash = 0;
  swarm.onBounce = (i) => {
    const now = performance.now();
    if (now - lastSplash < 40) return;
    lastSplash = now;
    fx.burst(swarm.positionOf(i), { count: 3, color: '#ffffff', speed: 0.6, up: 1.2, size: 0.03, life: 0.4 });
  };
  let clacks = 0;
  swarm.onLand = () => {
    if (clacks++ % 6 === 0) audio.play('clack', { minGap: 0.03 });
  };

  // --- mascot pops up at the end
  const captain = captainMesh();
  captain.position.set(2.05, -1.6, -0.1);
  captain.rotation.y = -0.5;
  captain.visible = false;
  root.add(captain);

  let done = false;
  let time = 0;

  const setFlaps = (t: number) => {
    if (box.flapFront) box.flapFront.rotation.x = t * 2.0;
    if (box.flapBack) box.flapBack.rotation.x = -t * 2.0;
  };
  setFlaps(0);

  const spout = new THREE.Vector3();
  const upDir = new THREE.Vector3();

  async function reveal() {
    done = false;
    swarm.hideAll();
    // wiggle
    audio.play('whoosh');
    await tweens.tween(0.5, (t) => {
      pivot.rotation.z = Math.sin(t * Math.PI * 6) * 0.06 * (1 - t);
    }, ease.linear, tg);
    // open flaps
    audio.play('pop');
    await tweens.tween(0.45, (t) => setFlaps(t), ease.outBack, tg);
    // lift and tilt over the bowl
    const from = pivot.position.clone();
    const fromRy = pivot.rotation.y;
    const to = new THREE.Vector3(-0.2, 1.75, bowlPos.z);
    await tweens.tween(0.8, (t) => {
      pivot.position.lerpVectors(from, to, t);
      pivot.rotation.y = fromRy * (1 - t);
      pivot.rotation.z = -2.0 * t;
    }, ease.inOutCubic, tg);
    // pour
    audio.play('splash');
    const order = orderSpots(spots.map((s, i) => ({ ...s, i })), 'random', 7).map((s) => s.i);
    const pourTime = Math.min(2.2, 0.9 + order.length / 900);
    let spawned = 0;
    await tweens.tween(pourTime, (t) => {
      pivot.rotation.z = -2.0 - Math.sin(t * Math.PI) * 0.25;
      const want = Math.floor(order.length * t);
      box.group.updateWorldMatrix(true, false);
      spout.set(0, BOX.h, 0).applyMatrix4(box.group.matrixWorld);
      upDir.set(0, 1, 0).transformDirection(box.group.matrixWorld);
      while (spawned < want) {
        const i = order[spawned++];
        const p = spout.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.35));
        const v = upDir.clone().multiplyScalar(0.9 + Math.random() * 0.8).add(new THREE.Vector3((Math.random() - 0.3) * 0.9, 0, (Math.random() - 0.5) * 1.1));
        swarm.spawn(i, p, v, 10);
      }
      if (Math.random() < 0.3) audio.play('pour', { minGap: 0.25 });
    }, ease.linear, tg);
    while (spawned < order.length) swarm.spawn(order[spawned++], spout.clone(), upDir.clone(), 10);
    // box goes home while the cereal settles
    void tweens.tween(0.9, (t) => {
      pivot.position.lerpVectors(to, from, t);
      pivot.rotation.z = -2.0 * (1 - t);
      pivot.rotation.y = fromRy * t;
    }, ease.inOutCubic, tg);
    await tweens.wait(0.9, tg);
    // swim into place
    audio.play('whoosh');
    const assemblyOrder = orderSpots(spots.map((s, i) => ({ ...s, i })), 'wave').map((s) => s.i);
    await swarm.assemble(assemblyOrder, Math.min(2.4, 1 + order.length / 700), 0.5, 0.18);
    // captain cheers
    captain.visible = true;
    audio.play('tada');
    fx.burst(new THREE.Vector3(bowlPos.x, surfaceY + 0.3, bowlPos.z), { count: 40, color: ['#ffd23f', '#ff5d73', '#7ee0ff', '#ffffff'], speed: 2, up: 3, size: 0.045, life: 1.1 });
    await tweens.tween(0.6, (t) => {
      captain.position.y = -1.6 + 1.6 * t;
    }, ease.outBack, tg);
    await tweens.tween(0.5, (t) => {
      captain.rotation.y = -0.5 + t * Math.PI * 2;
      captain.position.y = Math.sin(t * Math.PI) * 0.35;
    }, ease.inOutCubic, tg);
    done = true;
  }

  function finish() {
    tweens.cancel(tg);
    setFlaps(1);
    pivot.position.set(rest.x, BOX.h / 2, rest.z);
    pivot.rotation.set(0, 0.35, 0);
    swarm.settleAll();
    captain.visible = true;
    captain.position.y = 0;
    captain.rotation.y = -0.5;
    done = true;
  }

  return {
    root,
    reveal,
    finish,
    actionLabel: 'Pour it!',
    hero: { target: new THREE.Vector3(0.1, 0.85, 0.1), distance: 5.6, yaw: -0.15, pitch: 0.42 },
    update(dt) {
      time += dt;
      swarm.update(dt);
      fx.update(dt);
      if (done) captain.position.y = Math.abs(Math.sin(time * 2.2)) * 0.05;
    },
    focusView: () => ({ center: new THREE.Vector3(bowlPos.x, surfaceY, bowlPos.z), normal: new THREE.Vector3(0, 1, 0), size: inner * 1.02, up: new THREE.Vector3(0, 0, -1) }),
    setScanMode: (on) => swarm.setScanMode(on),
    dispose() {
      swarm.dispose();
    },
  };
}

function poster(ctx: ProductContext) {
  const art = boxFront(ctx.flavor);
  const scale = posterScale(art.w);
  return composePoster(art, scale, { qr: ctx.qr, x: FRONT.cardX, y: FRONT.cardY, size: FRONT.cardSize, dark: INK, light: '#ffffff', quiet: 2 }, { label: ctx.label, product: 'Captain QR · ' + ctx.flavor.name, accent: ctx.flavor.c.bg });
}

export const captainQR: ProductDef = {
  id: 'captain-qr',
  name: 'Captain QR',
  tagline: 'Part of a complete breakfast.',
  reveal: 'Pour the box. Every cocoa square swims into place in the milk.',
  section: 'cereal',
  price: 0,
  badge: 'NEW',
  flavors: CAPTAIN_FLAVORS,
  shelfSize: [0.36, 0.52],
  shelfModel(f) {
    const s = 0.26;
    const side = boxSideSmall(f).canvas;
    const top = new Painter(28, 10).clear(shade(f.c.bg, 0.1)).canvas;
    const body = atlasBox(BOX.w * s, BOX.h * s, BOX.d * s, { px: side, nx: side, py: top, ny: top, pz: boxFrontSmall(f).canvas, nz: boxFrontSmall(f).canvas });
    body.position.y = (BOX.h * s) / 2;
    const group = new THREE.Group();
    group.add(body);
    return group;
  },
  createShowcase,
  poster,
};

export { captainMesh };
