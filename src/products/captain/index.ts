import * as THREE from 'three';
import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { ease } from '../../engine/tween';
import { toonGradient } from '../../engine/voxel';
import { toonMat } from '../../engine/batch';
import { audio } from '../../engine/audio';
import { Buddy } from '../../art/buddy';
import { CAST } from '../../art/cast';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import { atlasBox } from '../common/box';
import { layoutModules, orderSpots } from '../common/qrLayout';
import { PieceSwarm } from '../common/swarm';
import { Particles, squareBowl, tileTexture } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import { boxBack, boxBottom, boxFront, boxFrontSmall, boxSide, boxSideSmall, boxTop, CAPTAIN_FLAVORS, FRONT, INK } from './art';

const BOX = { w: 1.4, h: 2.0, d: 0.5 };

function solid(w: number, h: number, color: string) {
  return new Painter(w, h).clear(color).canvas;
}

/** A flat card shaped like the 64×26 speech-bubble art (rounded body + tail on the right), `w`×`h` units, UVs on the art. */
function bubbleGeometry(w: number, h: number) {
  const TW = 64;
  const TH = 26;
  // texel coordinates with y up (the canvas texture puts v = 0 at the bottom row)
  const s = new THREE.Shape();
  s.moveTo(5, 26);
  s.lineTo(59, 26);
  s.quadraticCurveTo(64, 26, 64, 21);
  s.lineTo(64, 11);
  s.quadraticCurveTo(64, 6, 59, 6);
  s.lineTo(50.3, 6);
  s.lineTo(52, 0);
  s.lineTo(43, 6);
  s.lineTo(5, 6);
  s.quadraticCurveTo(0, 6, 0, 11);
  s.lineTo(0, 21);
  s.quadraticCurveTo(0, 26, 5, 26);
  const g = new THREE.ShapeGeometry(s, 4);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv.setXY(i, x / TW, y / TH);
    pos.setXY(i, (x / TW - 0.5) * w, (y / TH - 0.5) * h);
  }
  return g;
}

/** The cereal box: atlas-textured body and optional hinged flaps. */
function cerealBox(f: Flavor, scale: number, withFlaps: boolean) {
  const w = BOX.w * scale;
  const h = BOX.h * scale;
  const d = BOX.d * scale;
  const group = new THREE.Group();
  const front = boxFront(f).canvas;
  const side = boxSide(f).canvas;
  const top = withFlaps ? solid(112, 40, '#5a3a22') : boxTop(f).canvas;
  const body = atlasBox(w, h, d, { px: side, nx: side, py: top, ny: boxBottom(f).canvas, pz: front, nz: boxBack(f).canvas });
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

  // centre of the white card on the front (where the link sticker goes), in box-group space
  const card = new THREE.Vector3(-w / 2 + ((FRONT.cardX + FRONT.cardSize / 2) / FRONT.w) * w, h - ((FRONT.cardY + FRONT.cardSize / 2) / FRONT.h) * h, d / 2);
  return { group, flapFront, flapBack, h, w, d, card };
}

function createShowcase(ctx: ProductContext): ShowcaseItem {
  const { qr, flavor: f, tweens, group: tg } = ctx;
  const root = new THREE.Group();

  // --- box
  const box = cerealBox(f, 1, true);
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

  // --- speech bubble
  const bubbleArt = new Painter(64, 26);
  bubbleArt.roundRect(0, 0, 64, 20, 5, INK);
  bubbleArt.roundRect(1, 1, 62, 18, 4, '#ffffff');
  bubbleArt.poly([[50, 19], [42, 19], [52, 26]], INK);
  bubbleArt.poly([[49, 18], [43, 18], [50, 24]], '#ffffff');
  bubbleArt.text('SCAN ME,', 32, 3, { font: FONT_TINY, color: INK, align: 'center' });
  bubbleArt.text('MATEY!', 32, 10, { font: FONT_BIG, color: '#e63950', align: 'center' });
  // A camera-facing card cut to the bubble's outline rather than a sprite: it writes depth and
  // normals, so the outline pass sees one flat surface instead of drawing the shelf's edges through it.
  const bubble = new THREE.Mesh(bubbleGeometry(1.1, 0.45), new THREE.MeshBasicMaterial({ map: bubbleArt.texture(), alphaTest: 0.5 }));
  const bubbleY = 1.86;
  bubble.position.set(1.6, bubbleY, -0.38);
  bubble.visible = false;
  const parentQuat = new THREE.Quaternion();
  const camQuat = new THREE.Quaternion();
  bubble.onBeforeRender = (_r, _s, cam) => {
    bubble.parent!.getWorldQuaternion(parentQuat);
    bubble.quaternion.copy(parentQuat.invert().multiply(cam.getWorldQuaternion(camQuat)));
    bubble.updateMatrixWorld();
  };
  root.add(bubble);

  // --- Captain QR pops up beside the bowl at the end
  const captain = new Buddy(CAST.captain, 56);
  captain.billboard = true;
  const captainRest = new THREE.Vector3(2.12, 0, -0.42);
  captain.position.copy(captainRest);
  captain.visible = false;
  root.add(captain);

  let done = false;
  let time = 0;
  let scanning = false;
  let nextAct = 3;

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
    // Captain QR pops up out of the counter and cheers
    audio.play('tada');
    fx.burst(new THREE.Vector3(bowlPos.x, surfaceY + 0.3, bowlPos.z), { count: 40, color: ['#ffd23f', '#ff5d73', '#7ee0ff', '#ffffff'], speed: 2, up: 3, size: 0.045, life: 1.1 });
    captain.visible = !scanning;
    await tweens.tween(0.55, (t) => (captain.position.y = -1.4 * (1 - t)), ease.outBack, tg);
    audio.play('pop');
    fx.burst(captainRest, { count: 14, color: ['#ffd23f', '#ffffff', f.c.accent], speed: 1.4, up: 2, size: 0.035, life: 0.7 });
    void captain.cheer();
    await tweens.wait(0.45, tg);
    bubble.visible = !scanning;
    audio.play('blip', { rate: 1.4 });
    await tweens.tween(0.35, (t) => bubble.scale.set(t, t, 1), ease.outBack, tg);
    done = true;
    nextAct = time + 2.5;
  }

  function finish() {
    tweens.cancel(tg);
    setFlaps(1);
    pivot.position.set(rest.x, BOX.h / 2, rest.z);
    pivot.rotation.set(0, 0.35, 0);
    swarm.settleAll();
    captain.position.copy(captainRest);
    captain.visible = !scanning;
    bubble.visible = !scanning;
    bubble.scale.set(1, 1, 1);
    done = true;
  }

  let stirring = false;
  async function stir() {
    if (!done || stirring) return;
    stirring = true;
    audio.play('splash');
    swarm.kick((_i, p) => {
      const dx = p.x - bowlPos.x;
      const dz = p.z - bowlPos.z;
      // swirl around the bowl centre
      return new THREE.Vector3(-dz * 3 + (Math.random() - 0.5) * 0.3, 0.3 + Math.random() * 0.4, dx * 3 + (Math.random() - 0.5) * 0.3);
    }, 6);
    await tweens.wait(1.5, tg);
    audio.play('whoosh');
    const orderIn = orderSpots(spots.map((s, i) => ({ ...s, i })), 'spiral').map((s) => s.i);
    await swarm.assemble(orderIn, 1.6, 0.5, 0.15);
    audio.play('ding');
    stirring = false;
  }

  return {
    root,
    reveal,
    finish,
    actionLabel: 'Pour it!',
    extra: { label: 'Stir it!', run: stir },
    hero: { target: new THREE.Vector3(0.1, 0.85, 0.1), distance: 5.6, yaw: -0.15, pitch: 0.42 },
    // the link sticker goes on the white card in the box's pink window
    label: { object: box.group, position: box.card.clone().setZ(box.card.z + 0.003), size: [0.64, 0.5] },
    update(dt, _time, camera) {
      time += dt;
      swarm.update(dt);
      fx.update(dt);
      captain.update(dt, camera);
      if (done && time > nextAct) {
        nextAct = time + 3.5 + Math.random() * 3;
        const r = Math.random();
        void (r < 0.4 ? captain.wave() : r < 0.7 ? captain.hop() : captain.nod());
      }
      if (bubble.visible) bubble.position.y = bubbleY + Math.sin(time * 2.4) * 0.025;
    },
    focusView: () => ({ center: new THREE.Vector3(bowlPos.x, surfaceY, bowlPos.z), normal: new THREE.Vector3(0, 1, 0), size: inner * 1.02, up: new THREE.Vector3(0, 0, -1) }),
    setScanMode: (on) => {
      scanning = on;
      swarm.setScanMode(on);
      bubble.visible = !on && done;
      captain.visible = !on && done;
    },
    dispose() {
      swarm.dispose();
      disposeTree(root);
    },
  };
}

/** Free GPU resources this showcase owns (the shared toon material and toon ramp are kept). */
function disposeTree(root: THREE.Object3D) {
  const keep = toonMat();
  const ramp = toonGradient();
  const seen = new Set<unknown>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!seen.has(mesh.geometry)) {
      seen.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m || m === keep || seen.has(m)) continue;
      seen.add(m);
      for (const v of Object.values(m)) {
        if (!(v instanceof THREE.Texture) || v === ramp || seen.has(v)) continue;
        seen.add(v);
        v.dispose();
      }
      m.dispose();
    }
  });
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
