import * as THREE from 'three';
import { Painter, shade } from '../../engine/Painter';
import { ease } from '../../engine/tween';
import { audio } from '../../engine/audio';
import { toonGradient, voxelMaterial, voxelMesh } from '../../engine/voxel';
import { toonMat } from '../../engine/batch';
import { LAYER_NO_OUTLINE } from '../../engine/PixelRenderer';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import { atlasBox } from '../common/box';
import { layoutModules, orderSpots } from '../common/qrLayout';
import { isStructural } from '../common/swarm';
import { Particles } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import { DonutQR, toonMaterial } from './swarm';
import {
  BOX_PX,
  DONUT_FLAVORS,

  POSTER,
  WINDOW,
  boxBack,
  boxFront,
  boxInside,
  boxSideLeft,
  boxSideRight,
  brownieTexture,
  cellophane,
  donutVoxels,
  glazeTexture,
  lidLip,
  lidTop,
  lidUnder,
  posterArt,
  sprinkleColors,
  waxPaper,
  waxSheet,
} from './art';

/** Bakery box size (x, y, z), wall thickness, raised insert height, lid lip height. */
const BW = 1.3;
const BH = 0.7;
const BD = 0.95;
const T = 0.03;
const FLOOR = BH - 0.2;
const LIP = 0.1;

function solid(w: number, h: number, color: string) {
  return new Painter(w, h).clear(color).canvas;
}

function mipmapped(mesh: THREE.Mesh) {
  const mat = mesh.material as THREE.MeshToonMaterial;
  if (mat.map) {
    mat.map.generateMipmaps = true;
    mat.map.minFilter = THREE.LinearMipmapLinearFilter;
    mat.map.needsUpdate = true;
  }
  return mesh;
}

interface BoxParts {
  group: THREE.Group;
  body: THREE.Group;
  lid: THREE.Group;
}

/** Bakery box: four walls + raised insert, a hinged lid with a cellophane window and an awning lip. */
function bakeryBox(f: Flavor, s: number, opts: { shelf?: boolean } = {}): BoxParts {
  const mip = !!opts.shelf;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const inside = boxInside(f, 32, 32).canvas;
  const rim = solid(8, 8, shade(f.c.box, 0.1));
  const edge = solid(8, 8, f.c.deep);
  const w = BW * s;
  const h = BH * s;
  const d = BD * s;
  const t = T * s;
  const add = (m: THREE.Mesh, x: number, y: number, z: number) => {
    m.position.set(x, y, z);
    body.add(mip ? mipmapped(m) : m);
  };
  const o = { mipmaps: mip };
  add(atlasBox(w, h, t, { px: edge, nx: edge, py: rim, ny: edge, pz: boxFront(f).canvas, nz: inside }, o), 0, h / 2, d / 2 - t / 2);
  add(atlasBox(w, h, t, { px: edge, nx: edge, py: rim, ny: edge, pz: inside, nz: boxBack(f).canvas }, o), 0, h / 2, -d / 2 + t / 2);
  add(atlasBox(t, h, d - 2 * t, { px: inside, nx: boxSideLeft(f).canvas, py: rim, ny: edge, pz: edge, nz: edge }, o), -w / 2 + t / 2, h / 2, 0);
  add(atlasBox(t, h, d - 2 * t, { px: boxSideRight(f).canvas, nx: inside, py: rim, ny: edge, pz: edge, nz: edge }, o), w / 2 - t / 2, h / 2, 0);
  const paper = waxPaper(64, 5).canvas;
  const strip = solid(64, 2, shade(f.c.pale, -0.1));
  add(atlasBox(w - 2 * t, 0.02 * s, d - 2 * t, { px: strip, nx: strip, py: paper, ny: inside, pz: strip, nz: strip }, o), 0, FLOOR * s - 0.01 * s, 0);

  // lid, hinged along the back top edge
  const lid = new THREE.Group();
  lid.position.set(0, h, -d / 2);
  group.add(lid);
  const lw = w + 0.03 * s;
  const ld = d + 0.03 * s;
  // atlasBox sizes its atlas from the front/side faces, so give it edge strips as wide as the top
  const lidEdge = solid(BOX_PX.w, 2, f.c.deep);
  const lidSide = solid(BOX_PX.d, 2, f.c.deep);
  const top = atlasBox(lw, t, ld, { px: lidSide, nx: lidSide, py: lidTop(f, !opts.shelf).canvas, ny: opts.shelf ? boxInside(f, BOX_PX.w, BOX_PX.d).canvas : lidUnder(f).canvas, pz: lidEdge, nz: lidEdge }, o);
  (top.material as THREE.MeshToonMaterial).alphaTest = 0.5;
  (top.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;
  top.position.set(0, t / 2, ld / 2 - 0.015 * s);
  lid.add(mip ? mipmapped(top) : top);
  const lipArt = lidLip(f).canvas;
  const lip = atlasBox(lw, LIP * s, t * 0.6, { px: solid(2, 8, f.c.pale), nx: solid(2, 8, f.c.pale), py: solid(8, 2, f.c.pale), ny: solid(8, 2, f.c.pale), pz: lipArt, nz: lipArt }, o);
  (lip.material as THREE.MeshToonMaterial).alphaTest = 0.5;
  lip.position.set(0, t - (LIP * s) / 2, ld - 0.015 * s + t * 0.3);
  lid.add(mip ? mipmapped(lip) : lip);
  if (!opts.shelf) {
    // cellophane window
    const px = lw / BOX_PX.w;
    const pz = ld / BOX_PX.d;
    const tex = cellophane().texture();
    const cell = new THREE.Mesh(
      new THREE.PlaneGeometry(WINDOW.w * px, WINDOW.h * pz),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    cell.rotation.x = -Math.PI / 2;
    cell.position.set(-lw / 2 + (WINDOW.x + WINDOW.w / 2) * px, t * 0.9, -0.015 * s + (WINDOW.y + WINDOW.h / 2) * pz);
    cell.layers.set(LAYER_NO_OUTLINE);
    lid.add(cell);
  }
  return { group, body, lid };
}

// -------------------------------------------------------------------------------------------------

function createShowcase(ctx: ProductContext): ShowcaseItem {
  const { qr, flavor: f, tweens, group: tg } = ctx;
  const root = new THREE.Group();

  // --- bakery box: waits in the middle of the wax paper, then hops to the back left
  const boxPos = new THREE.Vector3(-1.58, 0, -0.52);
  const box = bakeryBox(f, 1);
  root.add(box.group);

  // --- wax paper: the code + 2-module quiet zone fills QS; the printed border lives in the margin
  const QS = 2.3;
  const PS = QS + 0.16;
  const paperPos = new THREE.Vector3(0.52, 0, 0.36);
  const paperTop = 0.014;
  const boxStart = new THREE.Vector3(paperPos.x, paperTop, paperPos.z - 0.05);
  const sheetPx = 192;
  const waxTex = waxSheet(f, sheetPx, Math.round(((PS - QS) / 2 / PS) * sheetPx)).texture();
  const paperMats = [0, 1, 2, 3, 4, 5].map((i) => (i === 2 ? new THREE.MeshToonMaterial({ map: waxTex, gradientMap: toonGradient() }) : new THREE.MeshToonMaterial({ color: '#d9ccb6', gradientMap: toonGradient() })));
  const paper = new THREE.Mesh(new THREE.BoxGeometry(PS, paperTop, PS), paperMats);
  paper.position.set(paperPos.x, paperTop / 2, paperPos.z);
  paper.receiveShadow = true;
  root.add(paper);

  // --- donut holes + brownie bites
  const quiet = 2;
  const n = qr.size;
  const qrSize = (QS * n) / (n + quiet * 2);
  const m = qrSize / n;
  const r = m * 0.5;
  const ry = r;
  const spots = layoutModules(qr, { size: qrSize, center: new THREE.Vector3(paperPos.x, paperTop + ry, paperPos.z) });
  const holeTex = glazeTexture(f, true).texture();
  const holeScanTex = glazeTexture(f, false, true).texture();
  const brownieTex = brownieTexture(f).texture();
  const brownieScanTex = brownieTexture(f, true).texture();
  const holeMat = toonMaterial(holeTex);
  const brownieMat = toonMaterial(brownieTex);
  const white = new THREE.Color('#ffffff');
  const inBox = (x: number, z: number) => Math.abs(x - boxPos.x) < BW / 2 && Math.abs(z - boxPos.z) < BD / 2;
  const onPaper = (x: number, z: number) => Math.abs(x - paperPos.x) < PS / 2 && Math.abs(z - paperPos.z) < PS / 2;
  const swarm = new DonutQR(
    spots,
    {
      geometry: new THREE.SphereGeometry(1, 12, 9),
      material: holeMat,
      scale: new THREE.Vector3(r, ry, r),
      scanScale: new THREE.Vector3(1.12, 1.12, 1.12),
      roll: true,
      offset: new THREE.Vector3(),
      color: () => [white.clone().multiplyScalar(0.9 + Math.random() * 0.1), white.clone()],
    },
    {
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material: brownieMat,
      scale: new THREE.Vector3(m * 0.94, ry * 2, m * 0.94),
      scanScale: new THREE.Vector3(1.07, 1, 1.07),
      roll: false,
      offset: new THREE.Vector3(),
      color: () => [white.clone().multiplyScalar(0.92 + Math.random() * 0.08), white.clone()],
    },
    {
      radius: ry,
      floor: (x, z) => (inBox(x, z) ? FLOOR : onPaper(x, z) ? paperTop : 0),
      bounds: { minX: boxPos.x - BW / 2, maxX: paperPos.x + PS / 2, minZ: boxPos.z - BD / 2, maxZ: paperPos.z + PS / 2 },
      restitution: 0.45,
      friction: 1.25,
      collide: spots.length < 3000,
    },
  );
  for (const mesh of swarm.meshes) root.add(mesh);

  // pile them up inside the box (visible through the cellophane); box-local positions
  const pile: THREE.Vector3[] = [];
  const tmpP = new THREE.Vector3();
  {
    const x0 = -BW / 2 + T + r;
    const x1 = BW / 2 - T - r;
    const z0 = -BD / 2 + T + r;
    const z1 = BD / 2 - T - r;
    const rowStep = r * 1.74;
    // heap: every layer covers a smaller ellipse than the one below, so the pile domes up
    for (let layer = 0; pile.length < spots.length; layer++) {
      const y = FLOOR + ry + layer * ry * 1.5;
      const reach = Math.max(0.25, 1.05 - layer * 0.16);
      let row = 0;
      for (let z = z0 + (layer % 2) * r * 0.9; z <= z1 && pile.length < spots.length; z += rowStep, row++)
        for (let x = x0 + ((row + layer) % 2) * r; x <= x1 && pile.length < spots.length; x += r * 2.02) {
          const ex = x / (BW / 2 - T);
          const ez = z / (BD / 2 - T);
          if (layer > 0 && ex * ex + ez * ez > reach * reach) continue;
          pile.push(new THREE.Vector3(x + (Math.random() - 0.5) * r * 0.2, y, z));
        }
      if (layer > 60) break;
    }
  }
  const pileOrder = orderSpots(spots.map((s, i) => ({ ...s, i })), 'random', 21).map((s) => s.i);
  const pileRot = pileOrder.map((k) => [Math.random() * 6.28, isStructural(spots[k].kind) ? 0 : Math.random() * 6.28, Math.random() * 6.28]);
  const parkAt = (at: THREE.Vector3) => {
    pileOrder.forEach((k, j) => {
      tmpP.copy(pile[Math.min(j, pile.length - 1)]).add(at);
      const [a, b, c] = pileRot[j];
      swarm.park(k, tmpP, a, b, isStructural(spots[k].kind) ? 0 : c);
    });
  };
  // launch order: top of the pile first
  const launchOrder = pileOrder.slice().reverse();

  // --- mascot
  const mascot = voxelMesh(donutVoxels(f), { scale: 0.024, anchor: 'bottom-center' });
  const mascotRest = new THREE.Vector3(-0.62, 0, -1.22);
  mascot.visible = false;
  root.add(mascot);

  const fx = new Particles(360);
  fx.floorY = paperTop;
  root.add(fx.mesh);
  const sprinkles = sprinkleColors(f);

  let lastClack = 0;
  swarm.onBounce = (_i, sp) => {
    const now = performance.now();
    if (now - lastClack > 30) {
      lastClack = now;
      audio.play('clack', { rate: 0.7 + Math.min(1, sp / 4) * 0.6, minGap: 0.025 });
    }
  };
  let lands = 0;
  swarm.onLand = () => {
    if (lands++ % 7 === 0) audio.play('clack', { rate: 1.3, minGap: 0.03 });
  };

  let time = 0;
  let idle = true;
  let done = false;
  let run = 0;
  const setLid = (a: number) => (box.lid.rotation.x = -a);

  function setStart() {
    setLid(0);
    box.group.position.copy(boxStart);
    box.body.scale.set(1, 1, 1);
    parkAt(boxStart);
    mascot.visible = false;
  }
  function setFinal() {
    setLid(1.95);
    box.group.position.copy(boxPos);
    box.body.scale.set(1, 1, 1);
    swarm.settleAll();
    mascot.visible = true;
    mascot.position.copy(mascotRest);
    mascot.rotation.set(0, -0.15, 0);
  }
  setStart();

  const tmp = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const toPaper = new THREE.Vector3(paperPos.x - boxPos.x, 0, paperPos.z - boxPos.z).normalize();
  const side = new THREE.Vector3(-toPaper.z, 0, toPaper.x);

  async function reveal() {
    const my = ++run;
    const alive = () => my === run;
    tweens.cancel(tg);
    idle = false;
    done = false;
    setLid(0);
    // excited wiggle
    audio.play('clack');
    await tweens.tween(0.55, (t) => {
      const k = Math.sin(t * Math.PI * 7) * (1 - t);
      box.group.rotation.z = k * 0.04;
      box.body.scale.set(1 + Math.abs(k) * 0.03, 1 - Math.abs(k) * 0.04, 1 + Math.abs(k) * 0.03);
      setLid(Math.max(0, k) * 0.2);
    }, ease.linear, tg);
    box.group.rotation.z = 0;
    box.body.scale.set(1, 1, 1);
    setLid(0);
    // hop off the paper to the back corner (the holes inside travel along)
    audio.play('whoosh');
    const hopFrom = box.group.position.clone();
    await tweens.tween(0.7, (t) => {
      box.group.position.lerpVectors(hopFrom, boxPos, t);
      box.group.position.y += Math.sin(Math.PI * t) * 0.75;
      box.group.rotation.y = Math.sin(Math.PI * t) * 0.35;
      parkAt(box.group.position);
    }, ease.inOutQuad, tg);
    box.group.rotation.y = 0;
    parkAt(boxPos);
    audio.play('clack');
    await tweens.tween(0.25, (t) => {
      const k = Math.sin(Math.PI * t);
      box.body.scale.set(1 + k * 0.05, 1 - k * 0.1, 1 + k * 0.05);
    }, ease.linear, tg);
    // flip the lid open
    audio.play('pop');
    audio.play('whoosh');
    await tweens.tween(0.5, (t) => setLid(1.95 * t), ease.outBack, tg);
    // donut holes pop out in a fountain
    const total = launchOrder.length;
    const popTime = Math.min(1.8, 0.9 + total / 900);
    let launched = 0;
    await tweens.tween(popTime, (t) => {
      const want = Math.floor(total * Math.min(1, t * 1.05));
      box.body.scale.set(1, 1 - Math.sin(t * Math.PI * 12) * 0.02, 1);
      while (launched < want) {
        const k = launchOrder[launched++];
        const along = 0.9 + Math.random() * 1.6;
        const across = (Math.random() - 0.5) * 1.5;
        vel.copy(toPaper).multiplyScalar(along).addScaledVector(side, across);
        vel.y = 3.1 + Math.random() * 1.4;
        swarm.spawn(k, null, vel, 10);
        if (launched % 6 === 0) audio.play('pop', { rate: 0.9 + Math.random() * 0.6, minGap: 0.05 });
      }
      if (Math.random() < 0.25) fx.burst(tmp.set(boxPos.x, FLOOR + 0.15, boxPos.z), { count: 1, color: sprinkles, speed: 1.2, up: 3, size: 0.02, life: 0.8 });
    }, ease.linear, tg);
    while (launched < total) swarm.spawn(launchOrder[launched++], null, vel.set(toPaper.x, 3.5, toPaper.z), 10);
    box.body.scale.set(1, 1, 1);
    // let them bounce and roll around on the wax paper
    await tweens.wait(1.5, tg);
    // roll into place
    audio.play('whoosh');
    const order = orderSpots(spots.map((s, i) => ({ ...s, i })), 'spiral').map((s) => s.i);
    await swarm.assemble(order, Math.min(2.2, 1.1 + spots.length / 900), 0.8, m * 0.6);
    if (!alive()) return;
    audio.play('tada');
    fx.burst(new THREE.Vector3(paperPos.x, 0.35, paperPos.z), { count: 60, color: sprinkles, speed: 2.6, up: 3.2, size: 0.03, life: 1.2 });
    // Dough-R jumps out of the box
    mascot.visible = true;
    const from = new THREE.Vector3(boxPos.x, FLOOR - 0.5, boxPos.z);
    await tweens.tween(0.8, (t) => {
      mascot.position.lerpVectors(from, mascotRest, t);
      mascot.position.y = from.y + (mascotRest.y - from.y) * t + Math.sin(Math.PI * t) * 1.1;
      mascot.rotation.set(0, -0.15 + (1 - t) * Math.PI * 2, 0);
    }, ease.linear, tg);
    audio.play('clack');
    await tweens.tween(0.35, (t) => mascot.scale.set(1 + Math.sin(Math.PI * t) * 0.12, 1 - Math.sin(Math.PI * t) * 0.18, 1 + Math.sin(Math.PI * t) * 0.12), ease.linear, tg);
    if (!alive()) return;
    done = true;
  }

  function finish() {
    run++;
    tweens.cancel(tg);
    idle = false;
    box.group.rotation.z = 0;
    mascot.scale.set(1, 1, 1);
    setFinal();
    done = true;
  }

  let scanOn = false;
  return {
    root,
    reveal,
    finish,
    actionLabel: 'Flip the lid!',
    hero: { target: new THREE.Vector3(0.12, 0.34, 0.22), distance: 5.4, yaw: 0.1, pitch: 0.62 },
    update(dt) {
      time += dt;
      if (idle) {
        // the holes are restless: the lid hops every so often
        const hop = Math.pow(Math.max(0, Math.sin(time * 2.3)), 12);
        setLid(hop * 0.16);
        box.body.scale.set(1 + hop * 0.02, 1 - hop * 0.03, 1 + hop * 0.02);
      }
      swarm.update(dt);
      fx.update(dt);
      if (done) {
        mascot.position.y = Math.abs(Math.sin(time * 3)) * 0.07;
        mascot.rotation.z = Math.sin(time * 3) * 0.08;
      }
    },
    focusView: () => ({ center: new THREE.Vector3(paperPos.x, paperTop, paperPos.z), normal: new THREE.Vector3(0, 1, 0), size: QS, up: new THREE.Vector3(0, 0, -1) }),
    setScanMode(on) {
      if (on === scanOn) return;
      scanOn = on;
      holeMat.map = on ? holeScanTex : holeTex;
      brownieMat.map = on ? brownieScanTex : brownieTex;
      holeMat.needsUpdate = true;
      brownieMat.needsUpdate = true;
      // shadows would grey out the light modules (and the finder rings) next to each piece
      for (const mesh of swarm.meshes) mesh.castShadow = !on;
      swarm.setScanMode(on);
    },
    dispose() {
      swarm.dispose();
      for (const t of [holeTex, holeScanTex, brownieTex, brownieScanTex]) t.dispose();
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
  const glaze = f.c.glazeScan;
  const brownie = f.c.brownieScan;
  return composePoster(
    art,
    scale,
    {
      qr: ctx.qr,
      x: POSTER.qrX,
      y: POSTER.qrY,
      size: POSTER.qrSize,
      dark: glaze,
      light: '#fdfaf2',
      quiet: 2,
      module: (c2d, r, c, x, y, mm) => {
        if (isStructural(ctx.qr.kindAt(r, c))) {
          c2d.fillStyle = brownie;
          c2d.fillRect(x, y, mm, mm);
          return;
        }
        c2d.fillStyle = glaze;
        c2d.beginPath();
        c2d.arc(x + mm / 2, y + mm / 2, mm * 0.54, 0, Math.PI * 2);
        c2d.fill();
      },
    },
    { label: ctx.label, product: 'Dough-R Code · ' + f.name, accent: f.c.deep },
  );
}

export const donutHoles: ProductDef = {
  id: 'donut-holes',
  name: 'Dough-R Code',
  tagline: 'Holes are the whole point.',
  reveal: 'Flip the lid: glazed donut holes pop out, bounce around and roll into place.',
  section: 'snacks',
  price: 0,
  flavors: DONUT_FLAVORS,
  shelfSize: [0.42, 0.4],
  shelfModel(f) {
    const g = new THREE.Group();
    const s = 0.3;
    const a = bakeryBox(f, s, { shelf: true });
    g.add(a.group);
    const b = bakeryBox(f, s, { shelf: true });
    b.group.position.y = BH * s + T * s;
    b.group.rotation.y = 0.12;
    g.add(b.group);
    return g;
  },
  createShowcase,
  poster,
};


