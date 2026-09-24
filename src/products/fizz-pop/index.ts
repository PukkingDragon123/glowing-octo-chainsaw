import * as THREE from 'three';
import { Painter, shade } from '../../engine/Painter';
import { toonGradient } from '../../engine/voxel';
import { Batcher, paintGeometry, toonMat } from '../../engine/batch';
import { ease } from '../../engine/tween';
import { audio } from '../../engine/audio';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import { atlasBox } from '../common/box';
import { layoutModules, orderSpots } from '../common/qrLayout';
import { QRSwarm, isStructural } from '../common/swarm';
import { Particles } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import { FIZZ_FLAVORS, LABEL, POSTER, baseFront, baseTop, canLabel, counterIce, iceGlint, iceTile, lidArt, panelArt, posterArt, tabArt } from './art';
import { glossy } from './gloss';

/** Can proportions (showcase scale). The label is 1 unit tall and wraps exactly once. */
const CAN = { R: ((LABEL.w / LABEL.h) * 1.1) / (2 * Math.PI), H: 1.1, foot: 0.07, neck: 0.1, rim: 0.03 };

function tex(p: Painter, mip: boolean) {
  const t = p.texture();
  if (mip) {
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
  }
  return t;
}

function toon(map: THREE.Texture | null, extra: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ map, gradientMap: toonGradient(), ...extra });
}

interface CanModel {
  group: THREE.Group;
  tabPivot: THREE.Group;
  lid: THREE.Mesh;
  closedLid: THREE.Texture;
  openLid: THREE.Texture;
  /** Local position of the drinking opening. */
  mouth: THREE.Vector3;
  height: number;
  radius: number;
}

/** Soda can: wrap-label cylinder, metal foot/neck/rim, pixel lid and a ring-pull tab on a hinge. */
function buildCan(f: Flavor, s: number, mip: boolean): CanModel {
  const R = CAN.R * s;
  const H = CAN.H * s;
  const foot = CAN.foot * s;
  const neck = CAN.neck * s;
  const rim = CAN.rim * s;
  const seg = 28;
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, seg, 1, true, -Math.PI / 2), toon(tex(canLabel(f), mip)));
  body.position.y = foot + H / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const b = new Batcher();
  b.add(paintGeometry(new THREE.CylinderGeometry(R, R * 0.8, foot, seg, 1, false), '#aab3c3'), toonMat(), 0, foot / 2, 0);
  b.add(paintGeometry(new THREE.CylinderGeometry(R * 0.84, R, neck, seg, 1, true), '#d3dae4'), toonMat(), 0, foot + H + neck / 2, 0);
  b.add(paintGeometry(new THREE.CylinderGeometry(R * 0.87, R * 0.87, rim, seg, 1, false), '#e8ecf2'), toonMat(), 0, foot + H + neck + rim / 2, 0);
  group.add(b.build());

  const top = foot + H + neck + rim;
  const closedLid = tex(lidArt(false), mip);
  const openLid = tex(lidArt(true), mip);
  const lid = new THREE.Mesh(new THREE.CircleGeometry(R * 0.87, seg), toon(closedLid));
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = top + 0.002 * s;
  lid.receiveShadow = true;
  group.add(lid);

  // ring-pull: hinged at the rivet (lid centre); positive rotation.x lifts the ring end
  const tabPivot = new THREE.Group();
  tabPivot.position.set(0, top + 0.01 * s, 0);
  const tl = R * 0.9;
  const tw = R * 0.57;
  const tab = new THREE.Mesh(new THREE.PlaneGeometry(tw, tl), toon(tex(tabArt(), mip), { alphaTest: 0.5, side: THREE.DoubleSide }));
  tab.rotation.x = -Math.PI / 2;
  tab.position.z = -0.182 * tl;
  tab.castShadow = true;
  tabPivot.add(tab);
  group.add(tabPivot);

  return { group, tabPivot, lid, closedLid, openLid, mouth: new THREE.Vector3(0, top, 0.39 * R), height: top, radius: R };
}

const PHYSICS = 1;

/** Free everything this showcase created (the shared cached toon material and toon ramp stay). */
function disposeTree(root: THREE.Object3D) {
  const shared = toonMat();
  const seen = new Set<unknown>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!seen.has(mesh.geometry)) {
      seen.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat || mat === shared || seen.has(mat)) continue;
      seen.add(mat);
      const m = mat as THREE.MeshToonMaterial;
      for (const t of [m.map, m.emissiveMap, m.alphaMap]) {
        if (t && !seen.has(t)) {
          seen.add(t);
          t.dispose();
        }
      }
      mat.dispose();
    }
    if ((mesh as unknown as THREE.InstancedMesh).isInstancedMesh) (mesh as unknown as THREE.InstancedMesh).dispose();
  });
}

function createShowcase(ctx: ProductContext): ShowcaseItem {
  const { qr, flavor: f, tweens, group: tg } = ctx;
  const root = new THREE.Group();
  const c = f.c;

  // ---------------------------------------------------------------- can
  const can = buildCan(f, 1, false);
  const canPivot = new THREE.Group();
  const canHome = new THREE.Vector3(-1.5, 0, 0.62);
  const canYaw = 0.42;
  canPivot.position.copy(canHome);
  canPivot.rotation.y = canYaw;
  canPivot.add(can.group);
  root.add(canPivot);

  // ---------------------------------------------------------------- frosted acrylic panel + stand
  const codeSize = 1.92; // code + 2-module quiet zone
  const border = 0.14;
  const panelW = codeSize + border * 2;
  const panelD = 0.05;
  const panelX = 0.52;
  const panelZ = -0.5;
  const panelBottom = 0.16;
  const panelCY = panelBottom + panelW / 2;
  const panelPx = 110;
  const panelGroup = new THREE.Group();
  const side = new Painter(4, 4).clear('#cfe8f7').canvas;
  const panel = atlasBox(panelW, panelW, panelD, { px: side, nx: side, py: side, ny: side, pz: panelArt(f, panelPx, Math.round((border / panelW) * panelPx)).canvas, nz: new Painter(8, 8).clear('#eaf5fc').canvas });
  panel.position.set(panelX, panelCY, panelZ);
  panel.receiveShadow = false;
  panel.castShadow = false;
  panelGroup.add(panel);
  const panelHidden = -panelW - panelBottom - 0.1;
  panelGroup.position.y = panelHidden;
  root.add(panelGroup);

  const baseW = panelW + 0.2;
  const baseH = 0.3;
  const baseD = 0.44;
  const bf = baseFront(f, 118, 24).canvas;
  const bs = new Painter(22, 24).clear(f.c.can).rect(0, 21, 22, 3, f.c.canDark).canvas;
  const base = atlasBox(baseW, baseH, baseD, { px: bs, nx: bs, py: baseTop(f, 118, 22).canvas, ny: bs, pz: bf, nz: bf });
  base.position.set(panelX, baseH / 2, panelZ);
  root.add(base);

  // loose ice cubes on the counter, for that ice-cold feeling
  const iceBox = new THREE.BoxGeometry(1, 1, 1);
  const looseIceMat = toon(counterIce().texture());
  for (const [x, z, sz, ry, rz] of [
    [-0.72, 0.95, 0.15, 0.4, 0],
    [-0.95, 1.22, 0.12, 1.1, 0],
    [-2.12, 0.98, 0.13, 0.2, 0],
    [-0.62, 1.2, 0.1, 0.8, 0.5],
  ]) {
    const cube = new THREE.Mesh(iceBox, looseIceMat);
    cube.scale.setScalar(sz);
    cube.position.set(x, sz / 2, z);
    cube.rotation.set(0, ry, rz);
    cube.castShadow = true;
    cube.receiveShadow = true;
    root.add(cube);
  }

  // ---------------------------------------------------------------- QR pieces
  const quiet = 2;
  const qrSize = (codeSize * qr.size) / (qr.size + quiet * 2);
  const m = qrSize / qr.size;
  const r = m * 0.5;
  const zFront = panelZ + panelD / 2;
  const codeCenter = new THREE.Vector3(panelX, panelCY, zFront + r * 0.45);
  const spots = layoutModules(qr, { size: qrSize, center: codeCenter, plane: 'xy' });

  const gloss = { value: 1 };
  const bubbleMat = glossy(new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: toonGradient() }), gloss, 0.965, new THREE.Vector3(-0.3, 0.36, 0.88));
  const iceMat = new THREE.MeshToonMaterial({ color: '#ffffff', map: iceTile().texture(), emissiveMap: iceGlint().texture(), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1, gradientMap: toonGradient() });
  const bubbleCol = new THREE.Color(c.bubble);
  const airCol = new THREE.Color(c.air);
  /** Shared by every bubble: big round soap bubbles while floating, glossy beads once frozen. */
  const bead = new THREE.Vector3(r * 1.04, r * 1.04, r * 0.55);
  const airBubble = new THREE.Vector3(r * 1.7, r * 1.7, r * 1.7);
  const bubbleScale = bead.clone();
  const frozen: THREE.Color[] = [];
  const swarm = new QRSwarm({
    spots,
    data: {
      geometry: new THREE.SphereGeometry(1, 12, 8),
      material: bubbleMat,
      scale: bubbleScale,
      scanScale: new THREE.Vector3(1.1, 1.1, 1),
      color: () => {
        const col = bubbleCol.clone().offsetHSL(0, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.06);
        frozen.push(col);
        return [col, new THREE.Color(c.bubbleScan)];
      },
    },
    // finder + alignment modules are frozen soda ice cubes: square, so cameras lock on
    struct: {
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material: iceMat,
      scale: new THREE.Vector3(m * 0.94, m * 0.94, m * 0.62),
      scanScale: new THREE.Vector3(1.09, 1.09, 1),
      color: () => [new THREE.Color(c.ice), new THREE.Color(c.iceScan)],
    },
    radius: r,
    gravity: 0,
    castShadow: false,
  });
  for (const mesh of swarm.meshes) {
    mesh.receiveShadow = false;
    root.add(mesh);
  }
  // data pieces live in swarm 0, in spot order (same split QRSwarm makes)
  const dataSpots: number[] = [];
  const dataIndex = new Int32Array(spots.length).fill(-1);
  spots.forEach((s, k) => {
    if (isStructural(s.kind)) return;
    dataIndex[k] = dataSpots.length;
    dataSpots.push(k);
  });
  const bubbles = swarm.swarms[0];
  const home = new Float32Array(bubbles.count * 3);
  const born = new Float32Array(bubbles.count);
  {
    let seed = 17;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < bubbles.count; i++) {
      // a fluffy cloud of bubbles between the can and the panel
      const a = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd());
      home[i * 3] = -0.5 + Math.cos(a) * rr * 0.95;
      home[i * 3 + 1] = 1.72 + Math.sin(a) * rr * 0.5 + (rnd() - 0.5) * 0.2;
      home[i * 3 + 2] = 0.3 + (rnd() - 0.5) * 0.55;
    }
  }

  // ---------------------------------------------------------------- fx
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const mouthW = new THREE.Vector3();
  const fx = new Particles(420);
  root.add(fx.mesh);
  const sparkle = new Particles(220, { glow: true });
  root.add(sparkle.mesh);

  swarm.onLand = (k) => {
    const p = swarm.positionOf(k, tmpA);
    if (isStructural(spots[k].kind)) {
      audio.play('clack', { rate: 1.4, minGap: 0.05 });
      if (Math.random() < 0.3) sparkle.burst(p, { count: 2, color: ['#ffffff', '#bfe9ff'], speed: 0.5, up: 0.4, size: 0.025, life: 0.35, gravity: 0 });
    } else {
      // the bubble freezes: it turns into a dark, glossy soda bead
      const i = dataIndex[k];
      bubbles.mesh.setColorAt(i, frozen[i]);
      if (bubbles.mesh.instanceColor) bubbles.mesh.instanceColor.needsUpdate = true;
      if (Math.random() < 0.12) {
        audio.play('pop', { rate: 1.6 + Math.random() * 0.8, minGap: 0.06 });
        sparkle.burst(p, { count: 1, color: ['#ffffff', '#dff6ff'], speed: 0.4, up: 0.3, size: 0.022, life: 0.3, gravity: 0 });
      }
    }
  };

  const setBubbleLook = (air: boolean) => {
    for (let i = 0; i < bubbles.count; i++) bubbles.mesh.setColorAt(i, air ? airCol : frozen[i]);
    if (bubbles.mesh.instanceColor) bubbles.mesh.instanceColor.needsUpdate = true;
    bubbleScale.copy(air ? airBubble : bead);
  };

  // ---------------------------------------------------------------- state
  let time = 0;
  let phase: 'idle' | 'busy' | 'done' = 'idle';
  let scanT = 0;
  let scanTarget = 0;

  const mouthWorld = () => {
    can.group.updateWorldMatrix(true, false);
    return mouthW.copy(can.mouth).applyMatrix4(can.group.matrixWorld);
  };

  const setTab = (open: number) => {
    can.tabPivot.rotation.x = open * 1.25;
    (can.lid.material as THREE.MeshToonMaterial).map = open > 0 ? can.openLid : can.closedLid;
  };

  const resetCan = () => {
    canPivot.position.copy(canHome);
    canPivot.rotation.set(0, canYaw, 0);
    canPivot.scale.set(1, 1, 1);
  };

  function spawnBubble(i: number, k: number) {
    const mw = mouthWorld();
    tmpA.set(mw.x + (Math.random() - 0.5) * 0.12, mw.y + Math.random() * 0.05, mw.z + (Math.random() - 0.5) * 0.1);
    tmpB.set((Math.random() - 0.4) * 0.7, 2.3 + Math.random() * 0.9, (Math.random() - 0.5) * 0.5);
    swarm.spawn(k, tmpA, tmpB, 0);
    bubbles.quat[i].identity(); // keep the painted glint facing the viewer
    born[i] = time;
  }

  async function reveal() {
    phase = 'busy';
    swarm.hideAll();
    setBubbleLook(false);
    resetCan();
    setTab(0);
    panelGroup.position.y = panelHidden;

    // 1. shake shake shake
    audio.play('fizz');
    await tweens.tween(1.1, (t) => {
      const amp = 0.04 + t * 0.14;
      canPivot.rotation.z = Math.sin(t * Math.PI * 16) * amp;
      canPivot.rotation.x = Math.cos(t * Math.PI * 12) * amp * 0.5;
      canPivot.position.y = Math.abs(Math.sin(t * Math.PI * 8)) * 0.1 * t;
      if (Math.random() < 0.3) fx.burst(mouthWorld(), { count: 1, color: [c.foam, '#ffffff'], speed: 0.25, up: 0.7, size: 0.03, life: 0.5, gravity: -1 });
      if (Math.random() < 0.08) audio.play('clack', { rate: 0.7, minGap: 0.12 });
    }, ease.linear, tg);
    resetCan();

    // 2. POP!
    audio.play('pop');
    audio.play('fizz');
    void tweens.tween(0.3, (t) => setTab(Math.max(0.02, t)), ease.outBack, tg);
    fx.burst(mouthWorld(), { count: 34, color: [c.foam, '#ffffff', c.drink], speed: 1.3, up: 2.6, size: 0.045, life: 0.8 });
    await tweens.tween(0.22, (t) => {
      const k = Math.sin(t * Math.PI);
      canPivot.scale.set(1 + k * 0.07, 1 - k * 0.1, 1 + k * 0.07);
    }, ease.outQuad, tg);

    // 3. geyser of bubbles
    setBubbleLook(true);
    const order = orderSpots(dataSpots.map((k, i) => ({ r: spots[k].r, c: spots[k].c, i, k })), 'random', 5);
    let spawned = 0;
    const geyser = Math.min(1.7, 1.0 + order.length / 900);
    await tweens.tween(geyser, (t) => {
      const want = Math.floor(order.length * Math.min(1, t * 1.12));
      while (spawned < want) {
        const o = order[spawned++];
        spawnBubble(o.i, o.k);
      }
      const mw = mouthWorld();
      fx.burst(mw, { count: 2, color: [c.foam, '#ffffff', c.drink], speed: 0.35, up: 4.2, size: 0.05, life: 0.55, gravity: 6 });
      canPivot.position.y = Math.sin(t * Math.PI * 30) * 0.012;
      if (Math.random() < 0.15) audio.play('fizz', { minGap: 0.5 });
    }, ease.linear, tg);
    while (spawned < order.length) {
      const o = order[spawned++];
      spawnBubble(o.i, o.k);
    }
    resetCan();

    // 4. the frosted panel slides up while the bubbles float
    audio.play('whoosh');
    await tweens.tween(0.75, (t) => (panelGroup.position.y = panelHidden * (1 - t)), ease.outBack, tg);
    audio.play('clack', { rate: 0.6 });
    await tweens.wait(0.35, tg);

    // 5. freeze into the wall
    audio.play('ding');
    const orderIn = orderSpots(spots.map((s, i) => ({ ...s, i })), 'spiral').map((s) => s.i);
    const spread = Math.min(2.2, 1.3 + orderIn.length / 900);
    void tweens.tween(spread + 0.5, (t) => bubbleScale.lerpVectors(airBubble, bead, t), ease.inOutQuad, tg);
    await swarm.assemble(orderIn, spread, 0.6, 0.12);
    setBubbleLook(false);
    swarm.settleAll();

    // 6. ta-da
    audio.play('tada');
    sparkle.burst(new THREE.Vector3(panelX, panelCY + 0.2, zFront + 0.2), { count: 46, color: ['#ffffff', '#bfe9ff', c.accent, c.can], speed: 2.2, up: 2.2, size: 0.045, life: 1.1, gravity: 3 });
    await tweens.tween(0.55, (t) => {
      canPivot.position.y = Math.sin(t * Math.PI) * 0.35;
      canPivot.rotation.y = canYaw + t * Math.PI * 2;
    }, ease.inOutCubic, tg);
    resetCan();
    phase = 'done';
  }

  function finish() {
    tweens.cancel(tg);
    resetCan();
    setTab(1);
    panelGroup.position.y = 0;
    setBubbleLook(false);
    swarm.settleAll();
    phase = 'done';
  }

  return {
    root,
    reveal,
    finish,
    actionLabel: 'Crack it open!',
    hero: { target: new THREE.Vector3(-0.4, 1.05, 0.15), distance: 5.6, yaw: 0.18, pitch: 0.24 },
    update(dt) {
      time += dt;
      // bubble float field: geyser first, then drift into a fluffy cloud
      if (phase === 'busy') {
        const pos = bubbles.pos;
        const vel = bubbles.vel;
        const blend = 1 - Math.exp(-3.2 * dt);
        const drag = Math.exp(-1.2 * dt);
        for (let i = 0; i < bubbles.count; i++) {
          if (bubbles.state[i] !== PHYSICS) continue;
          const k = i * 3;
          if (time - born[i] < 0.22) {
            vel[k] *= drag;
            vel[k + 1] *= drag;
            vel[k + 2] *= drag;
            continue;
          }
          const hx = home[k] + Math.sin(time * 1.3 + i * 0.7) * 0.06;
          const hy = home[k + 1] + Math.sin(time * 2.1 + i * 1.3) * 0.05;
          const hz = home[k + 2];
          vel[k] += ((hx - pos[k]) * 2.4 - vel[k]) * blend;
          vel[k + 1] += ((hy - pos[k + 1]) * 2.4 - vel[k + 1]) * blend;
          vel[k + 2] += ((hz - pos[k + 2]) * 2.4 - vel[k + 2]) * blend;
        }
      } else if (phase === 'idle') {
        // gentle "shake me" wiggle every few seconds
        const w = time % 3.2;
        canPivot.rotation.z = w < 0.5 ? Math.sin(w * Math.PI * 8) * 0.05 * (1 - w / 0.5) : 0;
      }
      swarm.update(dt);
      fx.update(dt);
      sparkle.update(dt);
      if (Math.abs(scanT - scanTarget) > 1e-3) {
        scanT += Math.sign(scanTarget - scanT) * Math.min(Math.abs(scanTarget - scanT), dt * 2.5);
        gloss.value = 1 - scanT;
        iceMat.emissiveIntensity = 1 - scanT;
      }
      if (phase === 'done' && scanTarget === 0 && Math.random() < dt * 2.5) {
        // frosty twinkles on the finished wall
        const s = spots[Math.floor(Math.random() * spots.length)];
        sparkle.burst(tmpA.set(s.pos.x, s.pos.y, s.pos.z + r), { count: 1, color: ['#ffffff'], speed: 0.1, up: 0.2, size: 0.03, life: 0.45, gravity: 0 });
      }
    },
    focusView: () => ({ center: codeCenter.clone(), normal: new THREE.Vector3(0, 0, 1), size: codeSize * 1.04, up: new THREE.Vector3(0, 1, 0) }),
    setScanMode(on) {
      scanTarget = on ? 1 : 0;
      swarm.setScanMode(on);
    },
    dispose() {
      disposeTree(root);
    },
  };
}

function poster(ctx: ProductContext) {
  const f = ctx.flavor;
  const art = posterArt(f);
  const scale = posterScale(art.w);
  return composePoster(
    art,
    scale,
    {
      qr: ctx.qr,
      x: POSTER.qrX,
      y: POSTER.qrY,
      size: POSTER.qrSize,
      dark: f.c.bubbleScan,
      light: '#f6fbff',
      quiet: 2,
      module: (g, r, col, x, y, mm) => {
        if (isStructural(ctx.qr.kindAt(r, col))) {
          // frozen soda ice cube: solid square with a slightly lighter (still dark) bevel
          g.fillStyle = f.c.iceScan;
          g.fillRect(x, y, mm, mm);
          g.fillStyle = shade(f.c.iceScan, 0.07);
          const b = Math.max(1, Math.round(mm * 0.14));
          g.fillRect(x, y, mm, b);
          g.fillRect(x, y, b, mm);
          return;
        }
        g.fillStyle = f.c.bubbleScan;
        g.beginPath();
        g.arc(x + mm / 2, y + mm / 2, mm * 0.52, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.55)';
        const s = Math.max(1, Math.round(mm * 0.18));
        g.fillRect(Math.round(x + mm * 0.24), Math.round(y + mm * 0.22), s, s);
      },
    },
    { label: ctx.label, product: 'Fizz Pop · ' + f.name, accent: f.c.can },
  );
}

export const fizzPop: ProductDef = {
  id: 'fizz-pop',
  name: 'Fizz Pop',
  tagline: 'Pop the tab, watch it fizz.',
  reveal: 'Crack the can: a bubble geyser floats up and freezes into an ice-cold QR wall.',
  section: 'cooler',
  price: 80,
  flavors: FIZZ_FLAVORS,
  shelfSize: [0.3, 0.42],
  shelfModel(f) {
    const { group } = buildCan(f, 0.34, true);
    return group;
  },
  createShowcase,
  poster,
};

