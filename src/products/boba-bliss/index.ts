import * as THREE from 'three';
import { Painter, shade } from '../../engine/Painter';
import { toonGradient } from '../../engine/voxel';
import { Batcher, paintGeometry, toonMat } from '../../engine/batch';
import { ease } from '../../engine/tween';
import { audio } from '../../engine/audio';
import { Buddy } from '../../art/buddy';
import { CAST } from '../../art/cast';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import { atlasBox } from '../common/box';
import { layoutModules, orderSpots } from '../common/qrLayout';
import { QRSwarm, isStructural } from '../common/swarm';
import { Particles } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import { BOBA_FLAVORS, CUP_TEX, POSTER, STICKER_Y, cupWrap, jellyGlint, jellyTile, posterArt, sealArt, strawArt, trayArt } from './art';
import { glossy } from './gloss';

/** Cup proportions (showcase scale). */
const CUP = { rTop: 0.45, rBottom: 0.36, H: 1.2, lip: 0.035, foot: 0.03 };
const STRAW = { len: 1.35, r: 0.062 };

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

interface CupModel {
  group: THREE.Group;
  bodyMat: THREE.MeshToonMaterial;
  full: THREE.Texture;
  empty: THREE.Texture;
  /** Height of the sealed top. */
  top: number;
}

/** Sealed bubble-tea cup: tapered wrap-textured body, plastic lip, printed film seal. */
function buildCup(f: Flavor, s: number, mip: boolean): CupModel {
  const group = new THREE.Group();
  const rT = CUP.rTop * s;
  const rB = CUP.rBottom * s;
  const H = CUP.H * s;
  const lip = CUP.lip * s;
  const foot = CUP.foot * s;
  const seg = 28;
  const full = tex(cupWrap(f, true), mip);
  const empty = tex(cupWrap(f, false), mip);
  const bodyMat = toon(full);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, H, seg, 1, true, -Math.PI / 2), bodyMat);
  body.position.y = foot + H / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const b = new Batcher();
  b.add(paintGeometry(new THREE.CylinderGeometry(rB, rB * 0.94, foot, seg), '#dfe9f3'), toonMat(), 0, foot / 2, 0);
  b.add(paintGeometry(new THREE.CylinderGeometry(rT * 1.05, rT * 1.05, lip, seg), '#f4f9ff'), toonMat(), 0, foot + H + lip / 2, 0);
  group.add(b.build());
  const top = foot + H + lip;
  const seal = new THREE.Mesh(new THREE.CircleGeometry(rT * 1.04, seg), toon(tex(sealArt(f), mip)));
  seal.rotation.x = -Math.PI / 2;
  seal.position.y = top + 0.002 * s;
  seal.receiveShadow = true;
  group.add(seal);
  return { group, bodyMat, full, empty, top };
}

/** Fat striped straw with a slanted, pointy tip at the bottom (local +y = drinking end). */
function buildStraw(f: Flavor, s: number, mip: boolean) {
  const len = STRAW.len * s;
  const r = STRAW.r * s;
  const geo = new THREE.CylinderGeometry(r, r, len, 12, 1, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0) pos.setY(i, pos.getY(i) + (pos.getX(i) / r + 1) * r * 0.9);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, toon(tex(strawArt(f), mip)));
  mesh.castShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  return { group, len };
}

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
  const c = f.c;
  const root = new THREE.Group();

  // ---------------------------------------------------------------- cup + straw
  const cup = buildCup(f, 1, false);
  const cupPivot = new THREE.Group();
  const cupHome = new THREE.Vector3(-1.82, 0, -0.05);
  const cupYaw = 0.3;
  cupPivot.position.copy(cupHome);
  cupPivot.rotation.y = cupYaw;
  cupPivot.add(cup.group);
  root.add(cupPivot);

  const straw = buildStraw(f, 1, false);
  const strawRestPos = new THREE.Vector3(-1.2, STRAW.r, 1.0);
  const strawRestQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.55, Math.PI / 2));
  /** Straw centre height (cup-local) once it is stabbed through the seal. */
  const strawInY = cup.top + straw.len * 0.5 - straw.len * 0.56;
  const setStrawRest = () => {
    root.add(straw.group);
    straw.group.position.copy(strawRestPos);
    straw.group.quaternion.copy(strawRestQuat);
  };
  const setStrawInCup = () => {
    cup.group.add(straw.group);
    straw.group.position.set(0.04, strawInY, 0.02);
    straw.group.quaternion.set(0, 0, 0, 1);
  };
  setStrawRest();

  // ---------------------------------------------------------------- tray
  const traySize = 2.35;
  const margin = 0.1;
  const codeSize = traySize - margin * 2; // code + 2-module quiet zone
  const trayPos = new THREE.Vector3(0.62, 0, 0.3);
  const trayTop = 0.045;
  const trayPx = 94;
  const edge = new Painter(8, 4).clear('#f3e6cf').canvas;
  const plate = atlasBox(traySize, trayTop, traySize, { px: edge, nx: edge, py: trayArt(f, trayPx, Math.round((margin / traySize) * trayPx)).canvas, ny: edge, pz: edge, nz: edge });
  plate.position.set(trayPos.x, trayTop / 2, trayPos.z);
  plate.castShadow = false;
  root.add(plate);
  const rimB = new Batcher();
  const rimH = 0.085;
  const rimT = 0.07;
  const wood = '#e8c48f';
  const woodDark = '#d4a86a';
  for (const [x, z, w, d] of [
    [0, traySize / 2 + rimT / 2, traySize + rimT * 2, rimT],
    [0, -traySize / 2 - rimT / 2, traySize + rimT * 2, rimT],
    [traySize / 2 + rimT / 2, 0, rimT, traySize],
    [-traySize / 2 - rimT / 2, 0, rimT, traySize],
  ] as const) {
    rimB.box(w, rimH, d, wood, trayPos.x + x, 0, trayPos.z + z);
    rimB.box(w + 0.004, 0.012, d + 0.004, woodDark, trayPos.x + x, rimH * 0.45, trayPos.z + z);
  }
  root.add(rimB.build());

  // ---------------------------------------------------------------- pearls + grass jelly
  const quiet = 2;
  const qrSize = (codeSize * qr.size) / (qr.size + quiet * 2);
  const m = qrSize / qr.size;
  const r = m * 0.48;
  const spots = layoutModules(qr, { size: qrSize, center: new THREE.Vector3(trayPos.x, trayTop + r, trayPos.z) });
  const gloss = { value: 1 };
  const pearlMat = glossy(new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: toonGradient() }), gloss, 0.955, new THREE.Vector3(-0.35, 0.78, 0.52));
  const jellyMat = new THREE.MeshToonMaterial({ color: '#ffffff', map: jellyTile().texture(), emissiveMap: jellyGlint().texture(), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1, gradientMap: toonGradient() });
  const pearlCol = new THREE.Color(c.pearl);
  const swarm = new QRSwarm({
    spots,
    data: {
      geometry: new THREE.SphereGeometry(1, 12, 9),
      material: pearlMat,
      scale: new THREE.Vector3(r, r, r),
      scanScale: new THREE.Vector3(1.17, 1, 1.17),
      color: () => [pearlCol.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.05), new THREE.Color(c.pearlScan)],
    },
    // finder + alignment modules are square grass-jelly cubes, so cameras can lock on
    struct: {
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material: jellyMat,
      scale: new THREE.Vector3(m * 0.94, r * 2, m * 0.94),
      scanScale: new THREE.Vector3(1.1, 1, 1.1),
      color: () => [new THREE.Color(c.jelly), new THREE.Color(c.jellyScan)],
    },
    radius: r,
    floor: () => trayTop,
    bounds: { minX: trayPos.x - traySize / 2 + 0.01, maxX: trayPos.x + traySize / 2 - 0.01, minZ: trayPos.z - traySize / 2 + 0.01, maxZ: trayPos.z + traySize / 2 - 0.01 },
    gravity: 9.8,
    restitution: 0.42,
    friction: 1.3,
    collide: spots.length < 3000,
    roll: true,
  });
  for (const mesh of swarm.meshes) root.add(mesh);

  // ---------------------------------------------------------------- fx + sounds
  const fx = new Particles(360);
  fx.floorY = trayTop;
  root.add(fx.mesh);
  const sparkle = new Particles(160, { glow: true });
  root.add(sparkle.mesh);
  let lastClack = 0;
  swarm.onBounce = (_k, sp) => {
    const now = performance.now();
    if (now - lastClack > 30) {
      lastClack = now;
      audio.play('clack', { rate: 0.7 + Math.min(1, sp) * 0.4, minGap: 0.025 });
    }
  };
  let landed = 0;
  swarm.onLand = (k) => {
    if (landed++ % 5 === 0) audio.play('clack', { rate: isStructural(spots[k].kind) ? 0.6 : 1.1, minGap: 0.03 });
  };

  // ---------------------------------------------------------------- Pearl, the tapioca buddy
  const pearl = new Buddy(CAST.pearl, 64);
  pearl.billboard = true;
  const pearlRest = new THREE.Vector3(-0.98, 0, -0.66);
  pearl.visible = false;
  root.add(pearl);
  let nextAct = 0;

  // ---------------------------------------------------------------- state
  let time = 0;
  let phase: 'idle' | 'busy' | 'done' = 'idle';
  let scanT = 0;
  let scanTarget = 0;
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const strawTip = new THREE.Vector3();
  const strawDir = new THREE.Vector3();

  const resetCup = () => {
    cupPivot.position.copy(cupHome);
    cupPivot.rotation.set(0, cupYaw, 0);
    cupPivot.scale.set(1, 1, 1);
  };
  const strawEnd = () => {
    straw.group.updateWorldMatrix(true, false);
    strawTip.set(0, straw.len / 2, 0).applyMatrix4(straw.group.matrixWorld);
    strawDir.set(0, 1, 0).transformDirection(straw.group.matrixWorld);
    return strawTip;
  };

  async function reveal() {
    phase = 'busy';
    swarm.hideAll();
    resetCup();
    setStrawRest();
    cup.bodyMat.map = cup.full;

    // 1. shake it like a tea-shop shaker
    audio.play('whoosh');
    await tweens.tween(0.25, (t) => (cupPivot.position.y = t * 0.4), ease.outQuad, tg);
    await tweens.tween(1.0, (t) => {
      const k = Math.sin(t * Math.PI);
      cupPivot.position.y = 0.4 + Math.sin(t * Math.PI * 18) * 0.13 * k;
      cupPivot.position.x = cupHome.x + Math.sin(t * Math.PI * 9) * 0.06 * k;
      cupPivot.rotation.z = Math.sin(t * Math.PI * 18 + 1) * 0.22 * k;
      if (Math.random() < 0.35) audio.play('clack', { rate: 0.8 + Math.random() * 0.5, minGap: 0.05 });
    }, ease.linear, tg);
    await tweens.tween(0.2, (t) => {
      cupPivot.position.y = 0.4 * (1 - t);
      cupPivot.rotation.z = 0;
      cupPivot.position.x = cupHome.x;
    }, ease.inQuad, tg);
    audio.play('step');
    await tweens.tween(0.18, (t) => {
      const k = Math.sin(t * Math.PI);
      cupPivot.scale.set(1 + k * 0.06, 1 - k * 0.08, 1 + k * 0.06);
    }, ease.outQuad, tg);

    // 2. the straw flies up and stabs the seal
    audio.play('whoosh');
    cup.group.updateWorldMatrix(true, false);
    const above = new THREE.Vector3(0.04, cup.top + straw.len * 0.5 + 0.18, 0.02).applyMatrix4(cup.group.matrixWorld);
    const from = strawRestPos.clone();
    await tweens.tween(0.6, (t) => {
      straw.group.position.lerpVectors(from, above, t);
      straw.group.position.y += Math.sin(t * Math.PI) * 0.5;
      straw.group.quaternion.slerpQuaternions(strawRestQuat, tmpQ.identity(), t);
    }, ease.inOutCubic, tg);
    await tweens.wait(0.12, tg);
    const stabFrom = straw.group.position.clone();
    await tweens.tween(0.12, (t) => (straw.group.position.y = stabFrom.y - (straw.len * 0.56 + 0.18) * t), ease.inQuad, tg);
    audio.play('pop');
    setStrawInCup();
    cup.group.updateWorldMatrix(true, false);
    tmpA.set(0, cup.top + 0.02, 0).applyMatrix4(cup.group.matrixWorld);
    fx.burst(tmpA, { count: 18, color: [c.tea, c.milk, '#ffffff'], speed: 1.1, up: 1.6, size: 0.035, life: 0.6 });
    await tweens.tween(0.16, (t) => {
      const k = Math.sin(t * Math.PI);
      cupPivot.scale.set(1 + k * 0.05, 1 - k * 0.07, 1 + k * 0.05);
    }, ease.outQuad, tg);

    // 3. tip it over the tray and pour the pearls out through the straw
    const tipPos = new THREE.Vector3(-1.38, 1.34, 0.3);
    const tilt = -1.95;
    await tweens.tween(0.65, (t) => {
      cupPivot.position.lerpVectors(cupHome, tipPos, t);
      cupPivot.rotation.set(0, cupYaw * (1 - t), tilt * t);
    }, ease.inOutCubic, tg);
    audio.play('pour');
    const order = orderSpots(spots.map((s, i) => ({ ...s, i })), 'random', 9).map((s) => s.i);
    const pourTime = Math.min(1.8, 1.0 + order.length / 900);
    let spawned = 0;
    await tweens.tween(pourTime, (t) => {
      cupPivot.rotation.z = tilt + Math.sin(t * Math.PI * 12) * 0.07;
      cupPivot.position.x = tipPos.x + Math.sin(t * Math.PI * 2) * 0.18;
      const want = Math.floor(order.length * Math.min(1, t * 1.1));
      const end = strawEnd();
      while (spawned < want) {
        const k = order[spawned++];
        tmpA.set(end.x + (Math.random() - 0.5) * 0.06, end.y + (Math.random() - 0.5) * 0.06, end.z + (Math.random() - 0.5) * 0.06);
        tmpB.copy(strawDir).multiplyScalar(0.5 + Math.random() * 0.9);
        tmpB.x += (Math.random() - 0.55) * 1.5;
        tmpB.z += (Math.random() - 0.5) * 2.0;
        swarm.spawn(k, tmpA, tmpB, 8);
      }
      if (Math.random() < 0.2) audio.play('pour', { minGap: 0.3 });
    }, ease.linear, tg);
    while (spawned < order.length) swarm.spawn(order[spawned++], strawEnd(), strawDir, 8);
    cup.bodyMat.map = cup.empty;

    // 4. cup goes home while the pearls roll around
    void tweens.tween(0.8, (t) => {
      cupPivot.position.lerpVectors(tipPos, cupHome, t);
      cupPivot.position.y += Math.sin(t * Math.PI) * 0.15;
      cupPivot.rotation.set(0, cupYaw * t, tilt * (1 - t));
    }, ease.inOutCubic, tg).then(() => resetCup());
    await tweens.wait(1.05, tg);

    // 5. roll into the code
    audio.play('whoosh');
    const orderIn = orderSpots(spots.map((s, i) => ({ ...s, i })), 'spiral').map((s) => s.i);
    await swarm.assemble(orderIn, Math.min(2.0, 1.2 + orderIn.length / 800), 0.55, 0.05);

    // 6. ta-da
    audio.play('tada');
    sparkle.burst(new THREE.Vector3(trayPos.x, 0.35, trayPos.z), { count: 40, color: ['#ffffff', c.accent, c.tea, '#ffd23f'], speed: 2.2, up: 2.8, size: 0.045, life: 1.1, gravity: 4 });
    await tweens.tween(0.5, (t) => {
      cupPivot.position.y = Math.sin(t * Math.PI) * 0.3;
      cupPivot.rotation.y = cupYaw + t * Math.PI * 2;
    }, ease.inOutCubic, tg);
    resetCup();

    // 7. one last pearl pops out of the cup... it's Pearl! It lands beside the tray and cheers
    cup.group.updateWorldMatrix(true, false);
    const lid = new THREE.Vector3(0, cup.top, 0).applyMatrix4(cup.group.matrixWorld);
    pearl.visible = scanTarget === 0;
    audio.play('pop', { rate: 1.3 });
    void pearl.spin();
    await tweens.tween(0.75, (t) => {
      pearl.position.lerpVectors(lid, pearlRest, t);
      pearl.position.y = lid.y * (1 - t) + Math.sin(Math.PI * t) * 0.6;
      pearl.scale.setScalar(0.35 + 0.65 * t);
    }, ease.inOutQuad, tg);
    pearl.position.copy(pearlRest);
    pearl.scale.setScalar(1);
    audio.play('clack');
    fx.burst(pearlRest, { count: 10, color: [c.tea, c.milk, '#ffffff'], speed: 1.1, up: 1.4, size: 0.03, life: 0.5 });
    void pearl.boop();
    await tweens.wait(0.3, tg);
    void pearl.cheer();
    phase = 'done';
    nextAct = time + 2.5;
  }

  function finish() {
    tweens.cancel(tg);
    resetCup();
    setStrawInCup();
    cup.bodyMat.map = cup.empty;
    swarm.settleAll();
    pearl.position.copy(pearlRest);
    pearl.scale.setScalar(1);
    pearl.visible = scanTarget === 0;
    phase = 'done';
  }

  return {
    root,
    reveal,
    finish,
    actionLabel: 'Shake it!',
    hero: { target: new THREE.Vector3(-0.3, 0.55, 0.35), distance: 5.7, yaw: 0.1, pitch: 0.52 },
    // the link sticker goes on the front of the cup, tilted to follow its tapered wall
    label: {
      object: cup.group,
      position: new THREE.Vector3(0, CUP.foot + CUP.H * (1 - STICKER_Y / CUP_TEX.h), CUP.rBottom + (CUP.rTop - CUP.rBottom) * (1 - STICKER_Y / CUP_TEX.h) + 0.003),
      rotation: new THREE.Euler(Math.atan2(CUP.rTop - CUP.rBottom, CUP.H), 0, 0),
      size: [0.42, 0.27],
    },
    update(dt, _time, camera) {
      time += dt;
      pearl.update(dt, camera);
      if (phase === 'done' && time > nextAct) {
        nextAct = time + 3 + Math.random() * 3;
        const r = Math.random();
        void (r < 0.4 ? pearl.wave() : r < 0.75 ? pearl.hop() : pearl.nod());
      }
      if (phase === 'idle') {
        const w = time % 3.4;
        cupPivot.rotation.z = w < 0.5 ? Math.sin(w * Math.PI * 8) * 0.04 * (1 - w / 0.5) : 0;
        cupPivot.position.y = w < 0.5 ? Math.abs(Math.sin(w * Math.PI * 4)) * 0.03 * (1 - w / 0.5) : 0;
      }
      swarm.update(dt);
      fx.update(dt);
      sparkle.update(dt);
      if (Math.abs(scanT - scanTarget) > 1e-3) {
        scanT += Math.sign(scanTarget - scanT) * Math.min(Math.abs(scanTarget - scanT), dt * 2.5);
        gloss.value = 1 - scanT;
        jellyMat.emissiveIntensity = 1 - scanT;
      }
    },
    focusView: () => ({ center: new THREE.Vector3(trayPos.x, trayTop, trayPos.z), normal: new THREE.Vector3(0, 1, 0), size: codeSize * 1.03, up: new THREE.Vector3(0, 0, -1) }),
    setScanMode(on) {
      scanTarget = on ? 1 : 0;
      swarm.setScanMode(on);
      pearl.visible = !on && phase === 'done';
      // no shadows on the tray while scanning: they would grey out light modules and the quiet zone
      for (const mesh of swarm.meshes) mesh.castShadow = !on;
      cupPivot.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = !on;
      });
      straw.group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = !on;
      });
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
      dark: f.c.pearlScan,
      light: '#fff6e8',
      quiet: 2,
      module: (g, r, col, x, y, mm) => {
        if (isStructural(ctx.qr.kindAt(r, col))) {
          // grass jelly cube: solid dark square with a faint (still dark) top bevel
          g.fillStyle = f.c.jellyScan;
          g.fillRect(x, y, mm, mm);
          g.fillStyle = shade(f.c.jellyScan, 0.06);
          g.fillRect(x, y, mm, Math.max(1, Math.round(mm * 0.14)));
          return;
        }
        g.fillStyle = f.c.pearlScan;
        g.beginPath();
        g.arc(x + mm / 2, y + mm / 2, mm * 0.52, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        const s = Math.max(1, Math.round(mm * 0.18));
        g.fillRect(Math.round(x + mm * 0.25), Math.round(y + mm * 0.22), s, s);
      },
    },
    { label: ctx.label, product: 'Boba Bliss · ' + f.name, accent: f.c.accent },
  );
}

export const bobaBliss: ProductDef = {
  id: 'boba-bliss',
  name: 'Boba Bliss',
  tagline: 'Shake it till it scans.',
  reveal: 'Shake the cup, stab the seal: tapioca pearls pour out and roll into your code.',
  section: 'cooler',
  price: 100,
  badge: 'HOT',
  flavors: BOBA_FLAVORS,
  shelfSize: [0.3, 0.46],
  shelfModel(f) {
    const s = 0.33;
    const cup = buildCup(f, s, true);
    const straw = buildStraw(f, s, true);
    straw.group.position.set(0.04 * s, cup.top + straw.len * 0.5 - straw.len * 0.56, 0.02 * s);
    cup.group.add(straw.group);
    return cup.group;
  },
  createShowcase,
  poster,
};
