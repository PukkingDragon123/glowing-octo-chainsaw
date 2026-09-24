import * as THREE from 'three';
import { Painter, shade } from '../../engine/Painter';
import { ease } from '../../engine/tween';
import { audio } from '../../engine/audio';
import { toonGradient } from '../../engine/voxel';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import { atlasBox } from '../common/box';
import { layoutModules, orderSpots } from '../common/qrLayout';
import { QRSwarm, isStructural } from '../common/swarm';
import { Particles, tray } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import { CANDY_FLAVORS, CANDY_SETS, crimpStrip, packBack, packFront, PACK, INK } from './art';

const SIZE = { w: 1.2, h: 1.5, d: 0.36 };

function solid(w: number, h: number, color: string) {
  return new Painter(w, h).clear(color).canvas;
}

/** Puffy pillow-pack: segmented box squeezed thin at the crimped ends. */
function packModel(f: Flavor, scale: number, mip: boolean) {
  const w = SIZE.w * scale;
  const h = SIZE.h * scale;
  const d = SIZE.d * scale;
  const group = new THREE.Group();
  const side = solid(8, 64, f.c.bagDark);
  const body = atlasBox(w, h, d, { px: side, nx: side, py: solid(8, 8, f.c.bagDark), ny: solid(8, 8, f.c.bagDark), pz: packFront(f).canvas, nz: packBack(f).canvas }, { segments: [10, 12, 2], mipmaps: mip });
  const pos = body.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / (w / 2);
    const ny = pos.getY(i) / (h / 2);
    const k = Math.max(0.07, (1 - Math.pow(Math.abs(ny), 6)) * (0.6 + 0.4 * (1 - nx * nx)));
    pos.setZ(i, pos.getZ(i) * k);
  }
  body.geometry.computeVertexNormals();
  body.position.y = h / 2;
  group.add(body);

  const crimpH = 0.11 * scale;
  const makeCrimp = (top: boolean) => {
    const tex = crimpStrip(f, top).texture();
    if (mip) {
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, crimpH), new THREE.MeshToonMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, gradientMap: toonGradient() }));
    m.position.y = top ? h + crimpH / 2 - 0.01 * scale : -crimpH / 2 + 0.01 * scale;
    m.castShadow = true;
    group.add(m);
    return m;
  };
  const topCrimp = makeCrimp(true);
  makeCrimp(false);
  return { group, topCrimp, h, w, d };
}

function candyColors(f: Flavor) {
  return CANDY_SETS[f.id] ?? CANDY_SETS.original;
}

function createShowcase(ctx: ProductContext): ShowcaseItem {
  const { qr, flavor: f, tweens, group: tg } = ctx;
  const root = new THREE.Group();

  const traySize = 2.5;
  const trayPos = new THREE.Vector3(0.45, 0, 0.35);
  const paper = tray(traySize + 0.12, traySize + 0.12, '#ffffff', '#e8e2f2', 0.04);
  paper.group.position.copy(trayPos);
  root.add(paper.group);
  // little rim so candies stay on the paper
  const rimMat = new THREE.MeshToonMaterial({ color: shade(f.c.bag, 0.1), gradientMap: toonGradient() });
  for (const [x, z, sw, sd] of [
    [0, traySize / 2 + 0.06, traySize + 0.24, 0.06],
    [0, -traySize / 2 - 0.06, traySize + 0.24, 0.06],
    [traySize / 2 + 0.06, 0, 0.06, traySize + 0.12],
    [-traySize / 2 - 0.06, 0, 0.06, traySize + 0.12],
  ] as const) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.07, sd), rimMat);
    rim.position.set(trayPos.x + x, 0.06, trayPos.z + z);
    rim.castShadow = true;
    rim.receiveShadow = true;
    root.add(rim);
  }

  const pack = packModel(f, 1, false);
  const pivot = new THREE.Group();
  const rest = new THREE.Vector3(-1.75, 0.85, -0.45);
  pivot.position.copy(rest);
  pack.group.position.y = -pack.h / 2;
  pivot.add(pack.group);
  pivot.rotation.y = 0.45;
  root.add(pivot);

  // candies
  const quiet = 2;
  const qrSize = (traySize * qr.size) / (qr.size + quiet * 2);
  const m = qrSize / qr.size;
  const r = m * 0.47;
  const floorY = paper.top;
  const spots = layoutModules(qr, { size: qrSize, center: new THREE.Vector3(trayPos.x, floorY + r * 0.55, trayPos.z) });
  const set = candyColors(f);
  const swarm = new QRSwarm({
    spots,
    data: {
      geometry: new THREE.SphereGeometry(1, 14, 10),
      scale: new THREE.Vector3(r, r * 0.55, r),
      scanScale: new THREE.Vector3(1.06, 0.8, 1.06),
      color: () => {
        const c = set[Math.floor(Math.random() * set.length)];
        return [new THREE.Color(c.fun), new THREE.Color(c.scan)];
      },
    },
    // finder + alignment squares are licorice tiles: they keep the code readable for cameras
    struct: {
      geometry: new THREE.BoxGeometry(1, 1, 1),
      scale: new THREE.Vector3(m * 0.9, r * 0.9, m * 0.9),
      scanScale: new THREE.Vector3(1.13, 1, 1.13),
      color: () => [new THREE.Color('#3b2140'), new THREE.Color('#1c1022')],
    },
    radius: r * 0.55,
    floor: () => floorY,
    bounds: { minX: trayPos.x - traySize / 2, maxX: trayPos.x + traySize / 2, minZ: trayPos.z - traySize / 2, maxZ: trayPos.z + traySize / 2 },
    restitution: 0.45,
    friction: 1.1,
    collide: spots.length < 3000,
    roll: true,
  });
  for (const mesh of swarm.meshes) root.add(mesh);
  let lastClack = 0;
  swarm.onBounce = (_i, sp) => {
    const now = performance.now();
    if (now - lastClack > 25) {
      lastClack = now;
      audio.play('clack', { rate: 0.8 + Math.min(1, sp) * 0.5, minGap: 0.02 });
    }
  };
  let n = 0;
  swarm.onLand = () => {
    if (n++ % 5 === 0) audio.play('clack', { minGap: 0.03 });
  };

  const fx = new Particles(260);
  fx.floorY = floorY;
  root.add(fx.mesh);

  let time = 0;
  let idle = true;
  let done = false;
  const spout = new THREE.Vector3();
  const dir = new THREE.Vector3();

  async function reveal() {
    done = false;
    idle = false;
    swarm.hideAll();
    pack.topCrimp.visible = true;
    pack.topCrimp.position.set(0, pack.h + 0.045, 0);
    pack.topCrimp.rotation.set(0, 0, 0);
    // tug
    await tweens.tween(0.5, (t) => {
      pivot.rotation.z = Math.sin(t * Math.PI * 8) * 0.05;
      pivot.scale.set(1 + Math.sin(t * Math.PI) * 0.04, 1 - Math.sin(t * Math.PI) * 0.03, 1);
    }, ease.linear, tg);
    // RIP!
    audio.play('rip');
    const tearFrom = pack.topCrimp.position.clone();
    pack.group.updateWorldMatrix(true, false);
    const tearWorld = new THREE.Vector3(0, pack.h, 0).applyMatrix4(pack.group.matrixWorld);
    fx.burst(tearWorld, { count: 26, color: [f.c.bag, f.c.bagDark, '#ffffff'], speed: 1.4, up: 2.2, size: 0.035, life: 0.9 });
    void tweens.tween(0.9, (t) => {
      pack.topCrimp.position.set(tearFrom.x - t * 1.2, tearFrom.y + Math.sin(t * Math.PI) * 0.8 + t * 0.2, tearFrom.z + t * 0.6);
      pack.topCrimp.rotation.set(t * 3, 0, t * 5);
    }, ease.outQuad, tg).then(() => (pack.topCrimp.visible = false));
    await tweens.wait(0.25, tg);
    // flip over the tray
    const from = pivot.position.clone();
    const fromRy = pivot.rotation.y;
    const to = new THREE.Vector3(-0.1, 1.75, trayPos.z - 0.1);
    await tweens.tween(0.7, (t) => {
      pivot.position.lerpVectors(from, to, t);
      pivot.rotation.y = fromRy * (1 - t);
      pivot.rotation.z = -2.6 * t;
    }, ease.inOutCubic, tg);
    // pour with shakes
    const order = orderSpots(spots.map((s, i) => ({ ...s, i })), 'random', 11).map((s) => s.i);
    const pourTime = Math.min(2.4, 1 + order.length / 800);
    let spawned = 0;
    await tweens.tween(pourTime, (t) => {
      pivot.rotation.z = -2.6 + Math.sin(t * Math.PI * 10) * 0.12;
      pivot.position.x = to.x + Math.sin(t * Math.PI * 2) * 0.35;
      pack.group.updateWorldMatrix(true, false);
      spout.set(0, pack.h, 0).applyMatrix4(pack.group.matrixWorld);
      dir.set(0, 1, 0).transformDirection(pack.group.matrixWorld);
      const want = Math.floor(order.length * Math.min(1, t * 1.1));
      while (spawned < want) {
        const i = order[spawned++];
        const p = spout.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.25));
        const v = dir.clone().multiplyScalar(1 + Math.random()).add(new THREE.Vector3((Math.random() - 0.5) * 2.4, Math.random() * 0.5, (Math.random() - 0.5) * 2.4));
        swarm.spawn(i, p, v, 12);
      }
    }, ease.linear, tg);
    while (spawned < order.length) swarm.spawn(order[spawned++], spout.clone(), dir.clone(), 12);
    // put the empty pack down
    void tweens.tween(0.8, (t) => {
      pivot.position.lerpVectors(to, new THREE.Vector3(rest.x, 0.25, rest.z + 0.3), t);
      pivot.rotation.z = -2.6 + (2.6 - Math.PI / 2) * t;
      pivot.rotation.y = fromRy * t;
    }, ease.inOutCubic, tg);
    // let them roll around
    await tweens.wait(1.3, tg);
    audio.play('whoosh');
    const orderIn = orderSpots(spots.map((s, i) => ({ ...s, i })), 'spiral').map((s) => s.i);
    await swarm.assemble(orderIn, Math.min(2.6, 1.2 + order.length / 600), 0.6, 0.22);
    audio.play('tada');
    fx.burst(new THREE.Vector3(trayPos.x, 0.3, trayPos.z), { count: 50, color: set.map((c) => c.fun), speed: 2.4, up: 3.2, size: 0.05, life: 1.2 });
    done = true;
  }

  function finish() {
    tweens.cancel(tg);
    idle = false;
    pack.topCrimp.visible = false;
    pivot.position.set(rest.x, 0.25, rest.z + 0.3);
    pivot.rotation.set(0, 0.45, -Math.PI / 2);
    pivot.scale.set(1, 1, 1);
    swarm.settleAll();
    done = true;
  }

  return {
    root,
    reveal,
    finish,
    actionLabel: 'Rip it open!',
    hero: { target: new THREE.Vector3(-0.2, 0.75, 0.1), distance: 5.9, yaw: 0.12, pitch: 0.45 },
    update(dt) {
      time += dt;
      if (idle) {
        pivot.position.y = rest.y + Math.sin(time * 2) * 0.05;
        pivot.rotation.z = Math.sin(time * 1.3) * 0.04;
      }
      swarm.update(dt);
      fx.update(dt);
      void done;
    },
    focusView: () => ({ center: new THREE.Vector3(trayPos.x, floorY, trayPos.z), normal: new THREE.Vector3(0, 1, 0), size: traySize, up: new THREE.Vector3(0, 0, -1) }),
    setScanMode: (on) => swarm.setScanMode(on),
    dispose() {
      swarm.dispose();
    },
  };
}

function poster(ctx: ProductContext) {
  const art = packFront(ctx.flavor, false);
  const set = candyColors(ctx.flavor);
  const scale = posterScale(art.w);
  let seed = 5;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return composePoster(
    art,
    scale,
    {
      qr: ctx.qr,
      x: PACK.winX,
      y: PACK.winY,
      size: PACK.winSize,
      dark: INK,
      light: '#fdf6f0',
      quiet: 2,
      module: (c2d, r, c, x, y, m) => {
        if (isStructural(ctx.qr.kindAt(r, c))) {
          c2d.fillStyle = '#1c1022';
          c2d.fillRect(x, y, m, m);
          return;
        }
        const col = set[Math.floor(rnd() * set.length)].scan;
        c2d.fillStyle = col;
        c2d.beginPath();
        c2d.arc(x + m / 2, y + m / 2, m * 0.5, 0, Math.PI * 2);
        c2d.fill();
        c2d.fillStyle = 'rgba(255,255,255,0.35)';
        c2d.fillRect(Math.round(x + m * 0.25), Math.round(y + m * 0.22), Math.max(1, Math.round(m * 0.22)), Math.max(1, Math.round(m * 0.14)));
      },
    },
    { label: ctx.label, product: 'Pixel Drops · ' + ctx.flavor.name, accent: ctx.flavor.c.bag },
  );
}

export const pixelDrops: ProductDef = {
  id: 'pixel-drops',
  name: 'Pixel Drops',
  tagline: 'Scan the rainbow.',
  reveal: 'Rip the pack. Candies bounce, roll around and hop into a rainbow QR.',
  section: 'snacks',
  price: 0,
  badge: 'HOT',
  flavors: CANDY_FLAVORS,
  shelfSize: [0.3, 0.42],
  shelfModel(f) {
    return packModel(f, 0.24, true).group;
  },
  createShowcase,
  poster,
};
