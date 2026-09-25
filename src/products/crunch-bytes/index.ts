import * as THREE from 'three';
import { Painter } from '../../engine/Painter';
import { ease } from '../../engine/tween';
import { audio } from '../../engine/audio';
import { toonGradient, voxelMesh } from '../../engine/voxel';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import { atlasBox } from '../common/box';
import { layoutModules, orderSpots } from '../common/qrLayout';
import { QRSwarm, isStructural } from '../common/swarm';
import { Particles, tileTexture } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import { BAG, bagBack, bagFront, bagFrontSmall, chipperVoxels, crimp, CRUNCH_FLAVORS, INK, napkin } from './art';

const SIZE = { w: 1.25, h: 1.6, d: 0.44 };

function solid(w: number, h: number, color: string) {
  return new Painter(w, h).clear(color).canvas;
}

/** Puffy chip bag: a segmented box squeezed thin at the crimped ends. */
function bagModel(f: Flavor, scale: number, small: boolean) {
  const w = SIZE.w * scale;
  const h = SIZE.h * scale;
  const d = SIZE.d * scale;
  const group = new THREE.Group();
  const side = solid(8, 64, f.c.bagDark);
  const front = small ? bagFrontSmall(f).canvas : bagFront(f).canvas;
  const back = small ? front : bagBack(f).canvas;
  const body = atlasBox(w, h, d, { px: side, nx: side, py: solid(8, 8, f.c.bagDark), ny: solid(8, 8, f.c.bagDark), pz: front, nz: back }, { segments: [12, 14, 2] });
  const pos = body.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / (w / 2);
    const ny = pos.getY(i) / (h / 2);
    const k = Math.max(0.06, (1 - Math.pow(Math.abs(ny), 5)) * (0.55 + 0.45 * (1 - nx * nx)));
    pos.setZ(i, pos.getZ(i) * k);
  }
  body.geometry.computeVertexNormals();
  body.position.y = h / 2;
  group.add(body);
  const crimpH = 0.12 * scale;
  for (const top of [true, false]) {
    const tex = crimp(f, top).texture();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, crimpH), new THREE.MeshToonMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, gradientMap: toonGradient() }));
    m.position.y = top ? h + crimpH / 2 - 0.01 * scale : -crimpH / 2 + 0.01 * scale;
    m.castShadow = true;
    group.add(m);
  }
  return { group, h, w, d, body };
}

/** A ridged saddle-shaped chip (think stackable crisps), unit radius. */
function chipGeometry() {
  const g = new THREE.CylinderGeometry(1, 1, 0.14, 18, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, pos.getY(i) + 0.24 * (x * x - z * z));
  }
  g.computeVertexNormals();
  return g;
}

function createShowcase(ctx: ProductContext): ShowcaseItem {
  const { qr, flavor: f, tweens, group: tg } = ctx;
  const root = new THREE.Group();

  // gingham napkin; the code lives in its white middle
  const inner = 2.4;
  const border = 0.32;
  const napSize = inner + border * 2;
  const napPos = new THREE.Vector3(0.5, 0, 0.35);
  const napPx = 128;
  const napTex = napkin(f, napPx, Math.round((border / napSize) * napPx)).texture();
  const nap = new THREE.Mesh(new THREE.PlaneGeometry(napSize, napSize), new THREE.MeshToonMaterial({ map: napTex, gradientMap: toonGradient() }));
  nap.rotation.x = -Math.PI / 2;
  nap.position.set(napPos.x, 0.012, napPos.z);
  nap.receiveShadow = true;
  root.add(nap);
  const floorY = 0.014;

  // the bag
  const bag = bagModel(f, 1, false);
  const pivot = new THREE.Group();
  const rest = new THREE.Vector3(-1.9, 0.86, -0.4);
  pivot.position.copy(rest);
  bag.group.position.y = -bag.h / 2;
  pivot.add(bag.group);
  pivot.rotation.y = 0.4;
  root.add(pivot);
  // the popped, empty bag left behind
  const torn = bagModel(f, 1, false).group;
  torn.scale.set(1, 0.92, 0.22);
  torn.rotation.set(-Math.PI / 2, 0, 0.5);
  torn.position.set(-1.95, 0.05, 0.1);
  torn.visible = false;
  root.add(torn);

  // chips (dark modules) + nori crackers (finder/alignment squares)
  const quiet = 2;
  const qrSize = (inner * qr.size) / (qr.size + quiet * 2);
  const m = qrSize / qr.size;
  const r = m * 0.47;
  const spots = layoutModules(qr, { size: qrSize, center: new THREE.Vector3(napPos.x, floorY + m * 0.07, napPos.z) });
  const flecks = tileTexture(8, (c) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, 8, 8);
    c.fillStyle = '#d7d0c4';
    for (const [x, y] of [[1, 2], [5, 1], [3, 5], [6, 6]]) c.fillRect(x, y, 1, 1);
    c.fillStyle = '#efe9df';
    c.fillRect(0, 3, 8, 1);
  });
  const chipCols = [f.c.chipA, f.c.chipB];
  const swarm = new QRSwarm({
    spots,
    data: {
      geometry: chipGeometry(),
      material: new THREE.MeshToonMaterial({ color: '#ffffff', map: flecks, gradientMap: toonGradient() }),
      scale: new THREE.Vector3(r, r, r),
      scanScale: new THREE.Vector3(1.1, 0.35, 1.1),
      color: () => [new THREE.Color(chipCols[Math.floor(Math.random() * 2)]), new THREE.Color(f.c.scan)],
      quat: () => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI),
    },
    struct: {
      geometry: new THREE.BoxGeometry(1, 1, 1),
      scale: new THREE.Vector3(m * 0.92, m * 0.14, m * 0.92),
      scanScale: new THREE.Vector3(1.1, 1, 1.1),
      color: () => [new THREE.Color('#1b2a20'), new THREE.Color('#101a13')],
    },
    radius: r * 0.35,
    floor: () => floorY,
    bounds: { minX: napPos.x - napSize / 2, maxX: napPos.x + napSize / 2, minZ: napPos.z - napSize / 2, maxZ: napPos.z + napSize / 2 },
    restitution: 0.22,
    friction: 3.2,
    collide: spots.length < 3000,
  });
  for (const mesh of swarm.meshes) root.add(mesh);
  let lastCrunch = 0;
  swarm.onBounce = () => {
    const now = performance.now();
    if (now - lastCrunch > 45) {
      lastCrunch = now;
      audio.play(Math.random() < 0.3 ? 'crunch' : 'clack', { minGap: 0.03 });
    }
  };
  let lands = 0;
  swarm.onLand = () => {
    if (lands++ % 6 === 0) audio.play('clack', { minGap: 0.03 });
  };

  const fx = new Particles(260);
  fx.floorY = floorY;
  root.add(fx.mesh);

  // Chipper the mascot
  const chipperMesh = voxelMesh(chipperVoxels(f), { scale: 0.042, anchor: 'bottom-center' });
  const chipperHome = new THREE.Vector3(1.95, 0, -0.8);
  chipperMesh.position.set(chipperHome.x, -1.2, chipperHome.z);
  chipperMesh.rotation.y = -0.45;
  chipperMesh.visible = false;
  root.add(chipperMesh);

  let time = 0;
  let idle = true;
  let done = false;
  const center = new THREE.Vector3();

  const resetBag = () => {
    bag.group.visible = true;
    pivot.position.copy(rest);
    pivot.rotation.set(0, 0.4, 0);
    pivot.scale.set(1, 1, 1);
    torn.visible = false;
  };

  async function reveal() {
    done = false;
    idle = false;
    swarm.hideAll();
    resetBag();
    chipperMesh.visible = false;
    // the bag puffs up like it's about to burst
    audio.play('whoosh');
    await tweens.tween(1.25, (t) => {
      const puff = ease.inCubic(t);
      const wob = Math.sin(t * 46) * 0.035 * t;
      pivot.scale.set(1 + puff * 0.2 + wob, 1 + puff * 0.12 - wob, 1 + puff * 1.3);
      pivot.rotation.z = Math.sin(t * 31) * 0.05 * t;
      pivot.position.y = rest.y + Math.abs(Math.sin(t * 23)) * 0.04 * t;
    }, ease.linear, tg);
    // POP!
    audio.play('pop', { rate: 0.45 });
    audio.play('crack');
    audio.play('crunch');
    pivot.updateWorldMatrix(true, true);
    center.set(0, bag.h / 2, 0).applyMatrix4(bag.group.matrixWorld);
    fx.burst(center, { count: 46, color: [f.c.bag, f.c.bagDark, '#ffffff', '#c9ccd6'], speed: 2.8, up: 2.6, size: 0.06, life: 1 });
    bag.group.visible = false;
    torn.visible = true;
    // chip fountain arcing over onto the napkin
    const order = orderSpots(spots.map((s, i) => ({ ...s, i })), 'random', 23).map((s) => s.i);
    const toward = new THREE.Vector3(napPos.x - center.x, 0, napPos.z - center.z);
    let spawned = 0;
    const burstTime = Math.min(1.1, 0.5 + order.length / 1400);
    await tweens.tween(burstTime, (t) => {
      const want = Math.floor(order.length * t);
      while (spawned < want) {
        const i = order[spawned++];
        const p = center.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3));
        const v = new THREE.Vector3(toward.x * (0.8 + Math.random() * 0.7) + (Math.random() - 0.5) * 1.8, 3.2 + Math.random() * 2.6, toward.z * (0.8 + Math.random() * 0.7) + (Math.random() - 0.5) * 1.8);
        swarm.spawn(i, p, v, 16);
      }
    }, ease.linear, tg);
    while (spawned < order.length) swarm.spawn(order[spawned++], center.clone(), new THREE.Vector3(toward.x, 4, toward.z), 16);
    await tweens.wait(1.5, tg);
    // every chip hops into its spot
    audio.play('whoosh');
    const orderIn = orderSpots(spots.map((s, i) => ({ ...s, i })), 'wave').map((s) => s.i);
    await swarm.assemble(orderIn, Math.min(2.4, 1.1 + order.length / 700), 0.55, 0.3);
    // Chipper jumps up to take a bow
    chipperMesh.visible = true;
    audio.play('tada');
    fx.burst(new THREE.Vector3(napPos.x, 0.3, napPos.z), { count: 40, color: ['#f4c542', '#d9a520', f.c.accent, '#ffffff'], speed: 2.2, up: 3, size: 0.045, life: 1.1 });
    await tweens.tween(0.6, (t) => (chipperMesh.position.y = -1.2 + 1.2 * t), ease.outBack, tg);
    await tweens.tween(0.5, (t) => {
      chipperMesh.rotation.y = -0.45 + t * Math.PI * 2;
      chipperMesh.position.y = Math.sin(t * Math.PI) * 0.35;
    }, ease.inOutCubic, tg);
    done = true;
  }

  function finish() {
    tweens.cancel(tg);
    idle = false;
    bag.group.visible = false;
    torn.visible = true;
    swarm.settleAll();
    chipperMesh.visible = true;
    chipperMesh.position.set(chipperHome.x, 0, chipperHome.z);
    chipperMesh.rotation.y = -0.45;
    done = true;
  }

  let tossing = false;
  async function toss() {
    if (!done || tossing) return;
    tossing = true;
    audio.play('crunch');
    swarm.kick(() => new THREE.Vector3((Math.random() - 0.5) * 1.6, 2.2 + Math.random() * 2.2, (Math.random() - 0.5) * 1.6), 18);
    await tweens.wait(1.5, tg);
    const orderIn = orderSpots(spots.map((s, i) => ({ ...s, i })), 'spiral').map((s) => s.i);
    await swarm.assemble(orderIn, 1.4, 0.5, 0.25);
    audio.play('ding');
    tossing = false;
  }

  return {
    root,
    reveal,
    finish,
    actionLabel: 'Pop the bag!',
    extra: { label: 'Toss them!', run: toss },
    hero: { target: new THREE.Vector3(-0.2, 0.75, 0.15), distance: 6, yaw: 0.1, pitch: 0.45 },
    update(dt) {
      time += dt;
      if (idle) {
        pivot.position.y = rest.y + Math.sin(time * 1.8) * 0.05;
        pivot.rotation.z = Math.sin(time * 1.2) * 0.04;
      }
      if (done && chipperMesh.visible) chipperMesh.position.y = Math.abs(Math.sin(time * 2.4)) * 0.05;
      swarm.update(dt);
      fx.update(dt);
    },
    focusView: () => ({ center: new THREE.Vector3(napPos.x, floorY, napPos.z), normal: new THREE.Vector3(0, 1, 0), size: inner, up: new THREE.Vector3(0, 0, -1) }),
    setScanMode: (on) => swarm.setScanMode(on),
    dispose() {
      swarm.dispose();
    },
  };
}

function poster(ctx: ProductContext) {
  const f = ctx.flavor;
  const art = bagFront(f, true);
  return composePoster(
    art,
    posterScale(art.w),
    {
      qr: ctx.qr,
      x: BAG.winX,
      y: BAG.winY,
      size: BAG.winSize,
      dark: INK,
      light: '#ffffff',
      quiet: 2,
      module: (c2d, r, c, x, y, m) => {
        if (isStructural(ctx.qr.kindAt(r, c))) {
          c2d.fillStyle = '#101a13';
          c2d.fillRect(x, y, m, m);
          return;
        }
        c2d.fillStyle = f.c.scan;
        c2d.beginPath();
        c2d.ellipse(x + m / 2, y + m / 2, m * 0.5, m * 0.46, 0, 0, Math.PI * 2);
        c2d.fill();
        c2d.fillStyle = 'rgba(255,255,255,0.22)';
        c2d.fillRect(Math.round(x + m * 0.2), Math.round(y + m * 0.45), Math.max(1, Math.round(m * 0.6)), Math.max(1, Math.round(m * 0.08)));
      },
    },
    { label: ctx.label, product: 'Crunch Bytes · ' + f.name, accent: f.c.bag },
  );
}

export const crunchBytes: ProductDef = {
  id: 'crunch-bytes',
  name: 'Crunch Bytes',
  tagline: 'Crispy data in every bag.',
  reveal: 'The bag puffs up and pops. Chips rain down and hop into your code.',
  section: 'snacks',
  price: 0,
  flavors: CRUNCH_FLAVORS,
  shelfSize: [0.32, 0.44],
  shelfModel(f) {
    return bagModel(f, 0.25, true).group;
  },
  createShowcase,
  poster,
};
