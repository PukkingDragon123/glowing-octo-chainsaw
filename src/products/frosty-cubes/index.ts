import * as THREE from 'three';
import { Painter, shade } from '../../engine/Painter';
import { ease, rng } from '../../engine/tween';
import { audio } from '../../engine/audio';
import { toonGradient } from '../../engine/voxel';
import { Buddy } from '../../art/buddy';
import { CAST } from '../../art/cast';
import { LAYER_NO_OUTLINE } from '../../engine/PixelRenderer';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import { atlasBox } from '../common/box';
import { layoutModules, orderSpots } from '../common/qrLayout';
import { QRSwarm, isStructural } from '../common/swarm';
import { Particles } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import { bagBack, bagFront, bagSide, crimpStrip, frostTile, FROSTY_FLAVORS, iceSet, iceTile, POSTER, posterArt } from './art';

const SIZE = { w: 1.3, h: 1.7, d: 0.44 };

function solid(w: number, h: number, color: string) {
  return new Painter(w, h).clear(color).canvas;
}

/** Paint a (partly transparent) canvas over a solid colour: opaque version for the shelf model. */
function flatten(c: HTMLCanvasElement, base: string) {
  const p = new Painter(c.width, c.height).clear(base);
  p.ctx.drawImage(c, 0, 0);
  return p.canvas;
}

function iceMaterial() {
  const tex = iceTile().texture(true);
  return { mat: new THREE.MeshToonMaterial({ color: '#ffffff', map: tex, gradientMap: toonGradient() }), tex };
}

/**
 * The ice bag: a puffy pillow pack. `clear` makes the film see-through (showcase) with real cubes
 * inside; otherwise the cubes are painted on (shelf).
 */
function bagModel(f: Flavor, scale: number, clear: boolean, iceMat?: THREE.Material) {
  const w = SIZE.w * scale;
  const h = SIZE.h * scale;
  const d = SIZE.d * scale;
  const group = new THREE.Group();
  const front = bagFront(f, !clear).canvas;
  const back = clear ? bagBack(f).canvas : flatten(bagBack(f).canvas, '#dbeeff');
  const side = bagSide(f, !clear).canvas;
  const cap = solid(8, 8, clear ? 'rgba(215,236,255,0.15)' : '#dbeeff');
  const body = atlasBox(w, h, d, { px: side, nx: side, py: cap, ny: cap, pz: front, nz: back }, { segments: [10, 12, 2], mipmaps: !clear });
  const pos = body.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / (w / 2);
    const ny = pos.getY(i) / (h / 2);
    const k = Math.max(0.07, (1 - Math.pow(Math.abs(ny), 6)) * (0.62 + 0.38 * (1 - nx * nx)));
    pos.setZ(i, pos.getZ(i) * k);
  }
  body.geometry.computeVertexNormals();
  body.position.y = h / 2;
  if (clear) {
    const old = body.material as THREE.MeshToonMaterial;
    body.material = new THREE.MeshToonMaterial({ map: old.map, gradientMap: toonGradient(), transparent: true, depthWrite: false });
    old.dispose();
    body.layers.set(LAYER_NO_OUTLINE);
    body.renderOrder = 2;
  }
  group.add(body);

  // cubes rattling around inside the clear bag
  let inner: THREE.InstancedMesh | null = null;
  if (clear && iceMat) {
    const n = 46;
    inner = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), iceMat, n);
    const r = rng(5);
    const set = iceSet(f);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const s = (0.13 + r() * 0.05) * scale;
      const y = (0.12 + Math.pow(r(), 0.8) * 0.62) * h;
      const x = (r() - 0.5) * 0.8 * w;
      const z = (r() - 0.5) * 0.35 * d;
      e.set(r() * 6, r() * 6, r() * 6);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
      inner.setMatrixAt(i, m);
      inner.setColorAt(i, c.set(set[i % set.length].fun));
    }
    inner.castShadow = true;
    group.add(inner);
  }

  const crimpH = 0.11 * scale;
  const makeCrimp = (top: boolean) => {
    const tex = crimpStrip(top).texture();
    if (!clear) {
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
  return { group, topCrimp, inner, h, w, d };
}

/** Frosty white serving tray with a pale ice-blue rim. */
function frostTray(size: number) {
  const g = new THREE.Group();
  const tex = frostTile().texture(true);
  tex.repeat.set(size / 0.75, size / 0.75);
  const top = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient() });
  const side = new THREE.MeshToonMaterial({ color: '#cfe6f8', gradientMap: toonGradient() });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(size + 0.18, 0.06, size + 0.18), [side, side, top, side, side, side]);
  slab.position.y = 0.03;
  slab.receiveShadow = true;
  slab.castShadow = true;
  g.add(slab);
  const rimTop = new THREE.MeshToonMaterial({ color: '#f2f9ff', gradientMap: toonGradient() });
  const rimSide = new THREE.MeshToonMaterial({ color: '#bfe0f7', gradientMap: toonGradient() });
  const rimMats = [rimSide, rimSide, rimTop, rimSide, rimSide, rimSide];
  const t = 0.08;
  for (const [x, z, sw, sd] of [
    [0, size / 2 + t / 2 + 0.01, size + t * 2 + 0.02, t],
    [0, -size / 2 - t / 2 - 0.01, size + t * 2 + 0.02, t],
    [size / 2 + t / 2 + 0.01, 0, t, size + 0.02],
    [-size / 2 - t / 2 - 0.01, 0, t, size + 0.02],
  ] as const) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.09, sd), rimMats);
    rim.position.set(x, 0.06 + 0.045, z);
    rim.castShadow = true;
    rim.receiveShadow = true;
    g.add(rim);
  }
  return { group: g, top: 0.06, slab };
}

function disposeTree(root: THREE.Object3D) {
  const grad = toonGradient();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      const map = (m as THREE.MeshToonMaterial).map;
      if (map && map !== grad) map.dispose();
      m.dispose();
    }
  });
}

function createShowcase(ctx: ProductContext): ShowcaseItem {
  const { qr, flavor: f, tweens, group: tg } = ctx;
  const root = new THREE.Group();

  const traySize = 2.5;
  const trayPos = new THREE.Vector3(0.4, 0, 0.35);
  const tray = frostTray(traySize);
  tray.group.position.copy(trayPos);
  root.add(tray.group);
  const floorY = tray.top;

  const ice = iceMaterial();
  const whiteTex = new Painter(2, 2).clear('#ffffff').texture();

  // --- the bag
  const bag = bagModel(f, 1, true, ice.mat);
  const pivot = new THREE.Group();
  const rest = new THREE.Vector3(-1.72, 0.88, -0.45);
  const emptyPos = new THREE.Vector3(rest.x, rest.y - 0.07, rest.z);
  const EMPTY_TILT = 0.07;
  pivot.position.copy(rest);
  bag.group.position.y = -bag.h / 2;
  pivot.add(bag.group);
  pivot.rotation.y = 0.45;
  root.add(pivot);

  // --- cubey, the ice-cube buddy, waits beside the tray and cheers when the code is done
  const cubey = new Buddy(CAST.cubey, 64);
  cubey.billboard = true;
  const cubeyHome = new THREE.Vector3(2.15, 0, -0.35);
  cubey.position.copy(cubeyHome);
  root.add(cubey);
  let cubeyNext = 2.5;

  // --- ice cubes: one per dark module
  const quiet = 2;
  const qrSize = (traySize * qr.size) / (qr.size + quiet * 2);
  const m = qrSize / qr.size;
  const cs = m * 0.86;
  const spots = layoutModules(qr, { size: qrSize, center: new THREE.Vector3(trayPos.x, floorY + cs / 2, trayPos.z) });
  const set = iceSet(f);
  const pick = rng(3);
  const swarm = new QRSwarm({
    spots,
    data: {
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material: ice.mat,
      scale: new THREE.Vector3(cs, cs, cs),
      scanScale: new THREE.Vector3(1.17, 0.5, 1.17),
      color: () => {
        const c = set[Math.floor(pick() * set.length)];
        return [new THREE.Color(c.fun), new THREE.Color(c.scan)];
      },
      quat: () => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (pick() - 0.5) * 0.08),
    },
    radius: cs * 0.5,
    floor: () => floorY,
    bounds: { minX: trayPos.x - traySize / 2, maxX: trayPos.x + traySize / 2, minZ: trayPos.z - traySize / 2, maxZ: trayPos.z + traySize / 2 },
    restitution: 0.36,
    friction: 1.4,
    collide: spots.length < 3000,
    roll: false,
  });
  for (const mesh of swarm.meshes) root.add(mesh);

  const fx = new Particles(300);
  fx.floorY = floorY;
  root.add(fx.mesh);
  const mist = new Particles(120);
  root.add(mist.mesh);

  const tmpB = new THREE.Vector3();
  const frostBits = ['#ffffff', '#dff3ff'];
  let lastClack = 0;
  swarm.onBounce = (k, sp) => {
    const now = performance.now();
    if (now - lastClack > 30) {
      lastClack = now;
      audio.play('clack', { rate: 1.25 + Math.min(1, sp) * 0.6, minGap: 0.02 });
      if (Math.random() < 0.4) fx.burst(swarm.positionOf(k, tmpB), { count: 2, color: frostBits, speed: 0.7, up: 1, size: 0.025, life: 0.35 });
    }
  };
  let lands = 0;
  swarm.onLand = () => {
    if (lands++ % 5 === 0) audio.play('clack', { rate: 1.5, minGap: 0.03 });
  };

  let time = 0;
  let idle = true;
  let done = false;
  let scan = false;
  const spout = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const mistCols = ['#ffffff', '#e6f5ff'];
  const sparkleCols = ['#ffffff', '#e0f4ff'];
  const innerCount = bag.inner?.count ?? 0;

  async function reveal() {
    tweens.cancel(tg);
    idle = false;
    done = false;
    swarm.hideAll();
    if (bag.inner) bag.inner.count = innerCount;
    bag.topCrimp.visible = true;
    bag.topCrimp.position.set(0, bag.h + 0.045, 0);
    bag.topCrimp.rotation.set(0, 0, 0);
    bag.group.scale.set(1, 1, 1);
    cubey.position.copy(cubeyHome);
    cubey.scale.setScalar(1);
    // brrr: the bag shivers
    void cubey.nod();
    audio.play('crunch');
    await tweens.tween(0.55, (t) => {
      pivot.rotation.z = Math.sin(t * Math.PI * 14) * 0.035;
      pivot.position.x = rest.x + Math.sin(t * Math.PI * 18) * 0.02;
      pivot.scale.set(1 + Math.sin(t * Math.PI) * 0.04, 1 - Math.sin(t * Math.PI) * 0.03, 1);
    }, ease.linear, tg);
    pivot.position.x = rest.x;
    // RIP! + a puff of cold mist
    audio.play('rip');
    const tearFrom = bag.topCrimp.position.clone();
    bag.group.updateWorldMatrix(true, false);
    const tearWorld = new THREE.Vector3(0, bag.h, 0).applyMatrix4(bag.group.matrixWorld);
    fx.burst(tearWorld, { count: 22, color: ['#ffffff', '#cfe8ff', f.c.band], speed: 1.4, up: 2, size: 0.035, life: 0.8 });
    mist.burst(tearWorld, { count: 26, color: ['#ffffff', '#e6f5ff'], speed: 0.5, up: 0.5, size: 0.09, life: 1.4, gravity: -0.6 });
    void tweens.tween(0.9, (t) => {
      bag.topCrimp.position.set(tearFrom.x - t * 1.1, tearFrom.y + Math.sin(t * Math.PI) * 0.7 + t * 0.2, tearFrom.z + t * 0.6);
      bag.topCrimp.rotation.set(t * 3, 0, t * 5);
    }, ease.outQuad, tg).then(() => (bag.topCrimp.visible = false));
    await tweens.wait(0.25, tg);
    // flip over the tray
    const from = pivot.position.clone();
    const fromRy = pivot.rotation.y;
    const to = new THREE.Vector3(-0.05, 1.85, trayPos.z - 0.1);
    await tweens.tween(0.7, (t) => {
      pivot.position.lerpVectors(from, to, t);
      pivot.rotation.y = fromRy * (1 - t);
      pivot.rotation.z = -2.6 * t;
    }, ease.inOutCubic, tg);
    // pour with shakes
    audio.play('crunch');
    const order = orderSpots(spots.map((s, i) => ({ ...s, i })), 'random', 13).map((s) => s.i);
    const pourTime = Math.min(2.3, 1 + order.length / 800);
    let spawned = 0;
    await tweens.tween(pourTime, (t) => {
      pivot.rotation.z = -2.6 + Math.sin(t * Math.PI * 10) * 0.12;
      pivot.position.x = to.x + Math.sin(t * Math.PI * 2) * 0.4;
      bag.group.updateWorldMatrix(true, false);
      spout.set(0, bag.h, 0).applyMatrix4(bag.group.matrixWorld);
      dir.set(0, 1, 0).transformDirection(bag.group.matrixWorld);
      const want = Math.floor(order.length * Math.min(1, t * 1.1));
      while (spawned < want) {
        const i = order[spawned++];
        tmp.set(spout.x + (Math.random() - 0.5) * 0.5, spout.y, spout.z + (Math.random() - 0.5) * 0.25);
        vel.copy(dir).multiplyScalar(1 + Math.random());
        vel.x += (Math.random() - 0.5) * 2.6;
        vel.y += Math.random() * 0.5;
        vel.z += (Math.random() - 0.5) * 2.6;
        swarm.spawn(i, tmp, vel, 14);
      }
      if (bag.inner) bag.inner.count = Math.round(innerCount * (1 - Math.min(1, t * 1.2)));
      if (Math.random() < 0.2) mist.burst(spout, { count: 2, color: mistCols, speed: 0.3, up: -0.2, size: 0.08, life: 1, gravity: -0.3 });
    }, ease.linear, tg);
    while (spawned < order.length) swarm.spawn(order[spawned++], spout, dir, 14);
    // the empty bag goes home, deflated
    void tweens.tween(0.8, (t) => {
      pivot.position.lerpVectors(to, emptyPos, t);
      pivot.rotation.z = -2.6 + (2.6 + EMPTY_TILT) * t;
      pivot.rotation.y = fromRy * t;
      bag.group.scale.set(1, 1 - 0.08 * t, 1 - 0.62 * t);
    }, ease.inOutCubic, tg);
    // let them skate around
    await tweens.wait(1.25, tg);
    audio.play('whoosh');
    const orderIn = orderSpots(spots.map((s, i) => ({ ...s, i })), 'rows').map((s) => s.i);
    await swarm.assemble(orderIn, Math.min(2.4, 1.1 + order.length / 650), 0.62, 0.05);
    // cubey pops up and cheers
    audio.play('tada');
    fx.burst(tmp.set(trayPos.x, floorY + 0.3, trayPos.z), { count: 50, color: [...set.map((c) => c.fun), '#ffffff', '#bfe6ff'], speed: 2.4, up: 3.2, size: 0.05, life: 1.2 });
    void cubey.cheer();
    await tweens.tween(0.6, (t) => {
      cubey.position.y = cubeyHome.y + Math.sin(t * Math.PI) * 0.4;
      cubey.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.15);
    }, ease.outQuad, tg);
    cubey.position.copy(cubeyHome);
    cubey.scale.setScalar(1);
    void cubey.cheer();
    done = true;
  }

  function finish() {
    tweens.cancel(tg);
    idle = false;
    bag.topCrimp.visible = false;
    if (bag.inner) bag.inner.count = 0;
    pivot.position.copy(emptyPos);
    pivot.rotation.set(0, 0.45, EMPTY_TILT);
    pivot.scale.set(1, 1, 1);
    bag.group.scale.set(1, 0.92, 0.38);
    cubey.position.copy(cubeyHome);
    cubey.scale.setScalar(1);
    swarm.settleAll();
    done = true;
  }

  return {
    root,
    reveal,
    finish,
    actionLabel: 'Tear it open!',
    hero: { target: new THREE.Vector3(-0.1, 0.62, 0.15), distance: 6.2, yaw: 0.1, pitch: 0.55 },
    // the clear window on the bag front, under the logo band
    label: { object: bag.group, position: new THREE.Vector3(0.05, 0.86, SIZE.d / 2 + 0.006), size: [0.7, 0.36] },
    update(dt, _time, camera) {
      time += dt;
      cubey.update(dt, camera);
      cubeyNext -= dt;
      if (cubeyNext < 0 && !scan && (idle || done)) {
        cubeyNext = 3.5 + Math.random() * 3;
        void (idle ? (Math.random() < 0.6 ? cubey.wave() : cubey.hop()) : Math.random() < 0.5 ? cubey.cheer() : cubey.hop());
      }
      if (idle) {
        pivot.position.y = rest.y + Math.sin(time * 2) * 0.05;
        pivot.rotation.z = Math.sin(time * 1.3) * 0.04;
        if (Math.random() < dt * 2) mist.burst(tmp.set(rest.x + (Math.random() - 0.5) * 0.8, rest.y - 0.7, rest.z + 0.3), { count: 1, color: '#ffffff', speed: 0.15, up: 0.2, size: 0.06, life: 1.2, gravity: -0.25 });
      }
      if (!scan && Math.random() < dt * 3) {
        tmp.set(trayPos.x + (Math.random() - 0.5) * traySize, floorY + 0.02, trayPos.z + (Math.random() - 0.5) * traySize);
        fx.burst(tmp, { count: 1, color: sparkleCols, speed: 0.05, up: 0.25, size: 0.03, life: 0.7, gravity: -0.2 });
      }
      swarm.update(dt);
      fx.update(dt);
      mist.update(dt);
    },
    focusView: () => ({ center: new THREE.Vector3(trayPos.x, floorY, trayPos.z), normal: new THREE.Vector3(0, 1, 0), size: traySize, up: new THREE.Vector3(0, 0, -1) }),
    setScanMode(on) {
      scan = on;
      swarm.setScanMode(on);
      ice.mat.map = on ? whiteTex : ice.tex;
      for (const mesh of swarm.meshes) mesh.castShadow = !on;
      tray.slab.receiveShadow = !on;
      cubey.visible = !on;
    },
    dispose() {
      swarm.dispose();
      whiteTex.dispose();
      ice.tex.dispose();
      disposeTree(root);
    },
  };
}

function poster(ctx: ProductContext) {
  const art = posterArt(ctx.flavor);
  const set = iceSet(ctx.flavor);
  const scale = posterScale(art.w);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return composePoster(
    art,
    scale,
    {
      qr: ctx.qr,
      x: POSTER.codeX,
      y: POSTER.codeY,
      size: POSTER.codeSize,
      dark: set[0].scan,
      light: '#f5faff',
      quiet: 2,
      module: (c2d, r, c, x, y, mm) => {
        const col = set[Math.floor(rnd() * set.length)];
        c2d.fillStyle = col.scan;
        c2d.fillRect(x, y, mm, mm);
        // finder/alignment stay solid; data cubes get an icy rim only on the outside of each ice slab
        if (isStructural(ctx.qr.kindAt(r, c))) return;
        const e = Math.max(1, Math.round(mm / 8));
        const top = !ctx.qr.isDark(r - 1, c);
        const left = !ctx.qr.isDark(r, c - 1);
        c2d.fillStyle = shade(col.scan, 0.16);
        if (top) c2d.fillRect(x, y, mm, e);
        if (left) c2d.fillRect(x, y, e, mm);
        if (top && left) {
          c2d.fillStyle = 'rgba(255,255,255,0.35)';
          c2d.fillRect(x + e, y + e, e, e);
        }
      },
    },
    { label: ctx.label, product: 'Frosty Cubes · ' + ctx.flavor.name, accent: ctx.flavor.c.band },
  );
}

export const frostyCubes: ProductDef = {
  id: 'frosty-cubes',
  name: 'Frosty Cubes',
  tagline: 'Stay cool, stay scannable.',
  reveal: 'Tear the ice bag: cubes clatter across the frosty tray and skate into place.',
  section: 'freezer',
  price: 90,
  flavors: FROSTY_FLAVORS,
  shelfSize: [0.32, 0.46],
  shelfModel(f) {
    const s = 0.24;
    const g = new THREE.Group();
    const bag = bagModel(f, s, false).group;
    bag.position.y = 0.1 * s; // lift so the bottom crimp sits on the shelf
    g.add(bag);
    return g;
  },
  createShowcase,
  poster,
};

