import * as THREE from 'three';
import { Painter, shade } from '../../engine/Painter';
import { VoxelGrid, meshVoxels, toonGradient } from '../../engine/voxel';
import { Batcher, paintBoxFaces, paintGeometry, toonMat } from '../../engine/batch';
import { ease } from '../../engine/tween';
import { audio } from '../../engine/audio';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import { layoutModules } from '../common/qrLayout';
import { isStructural } from '../common/swarm';
import { Particles } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import { LABEL, POSTER, VOLT_FLAVORS, auraArt, canGlow, canLabel, dashArt, fanArt, fieldArt, lidArt, plateArt, posterArt, sheetArt, tabArt } from './art';
import { Bolts } from './bolts';
import { glowLayer, holoMaterial, holoUniforms } from './holo';

/** Tall slim 500ml can. The label is 1.25 units tall and wraps exactly once. */
const CAN = { H: 1.25, foot: 0.07, neck: 0.1, rim: 0.03, R: ((LABEL.w / LABEL.h) * 1.25) / (2 * Math.PI) };

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

/** Matte black can with emissive neon print, chrome ends and a neon ring-pull. */
function buildCan(f: Flavor, s: number, mip: boolean) {
  const R = CAN.R * s;
  const H = CAN.H * s;
  const foot = CAN.foot * s;
  const neck = CAN.neck * s;
  const rim = CAN.rim * s;
  const seg = 24;
  const group = new THREE.Group();
  const label = canLabel(f);
  const bodyMat = toon(tex(label, mip), { emissiveMap: tex(canGlow(f, label), mip), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.85 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, seg, 1, true, -Math.PI / 2), bodyMat);
  body.position.y = foot + H / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const b = new Batcher();
  b.add(paintGeometry(new THREE.CylinderGeometry(R, R * 0.8, foot, seg, 1, false), '#9aa3b5'), toonMat(), 0, foot / 2, 0);
  b.add(paintGeometry(new THREE.CylinderGeometry(R * 0.84, R, neck, seg, 1, true), '#cfd6e0'), toonMat(), 0, foot + H + neck / 2, 0);
  b.add(paintGeometry(new THREE.CylinderGeometry(R * 0.87, R * 0.87, rim, seg, 1, false), '#e8ecf2'), toonMat(), 0, foot + H + neck + rim / 2, 0);
  group.add(b.build());
  const top = foot + H + neck + rim;
  const closedLid = tex(lidArt(false), mip);
  const openLid = tex(lidArt(true), mip);
  const lid = new THREE.Mesh(new THREE.CircleGeometry(R * 0.87, seg), toon(closedLid));
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = top + 0.002 * s;
  group.add(lid);
  const tabPivot = new THREE.Group();
  tabPivot.position.set(0, top + 0.01 * s, 0);
  const tl = R * 0.92;
  const tab = new THREE.Mesh(new THREE.PlaneGeometry(tl * (12 / 18), tl), toon(tex(tabArt(f), mip), { alphaTest: 0.5, side: THREE.DoubleSide }));
  tab.rotation.x = -Math.PI / 2;
  tab.position.z = -0.19 * tl;
  tab.castShadow = true;
  tabPivot.add(tab);
  group.add(tabPivot);
  return { group, bodyMat, tabPivot, lid, closedLid, openLid, top, R, mouth: new THREE.Vector3(0, top, 0.38 * R) };
}

/** Octagonal hologram emitter with a neon ring, a lens and status LEDs. */
function buildEmitter(f: Flavor) {
  const group = new THREE.Group();
  const b = new Batcher();
  const oct = Math.PI / 8;
  b.add(paintGeometry(new THREE.CylinderGeometry(0.6, 0.68, 0.13, 8), '#2b2e3d'), toonMat(), 0, 0.065, 0, 0, oct);
  b.add(paintGeometry(new THREE.CylinderGeometry(0.5, 0.58, 0.06, 8), '#3d4257'), toonMat(), 0, 0.16, 0, 0, oct);
  b.add(paintGeometry(new THREE.CylinderGeometry(0.22, 0.26, 0.035, 16), '#171922'), toonMat(), 0, 0.207, 0);
  // little feet
  for (let i = 0; i < 4; i++) {
    const a = oct + (i * Math.PI) / 2 + Math.PI / 4;
    b.box(0.12, 0.02, 0.12, '#1c1e28', Math.sin(a) * 0.5, -0.005, Math.cos(a) * 0.5, a);
  }
  const body = b.build();
  group.add(body);
  const ringMat = new THREE.MeshBasicMaterial({ color: f.c.neonDark, toneMapped: false });
  const ring = glowLayer(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.022, 6, 40), ringMat));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.19;
  group.add(ring);
  const lensMat = new THREE.MeshBasicMaterial({ color: f.c.neonDark, toneMapped: false });
  const lens = glowLayer(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16), lensMat));
  lens.position.y = 0.228;
  group.add(lens);
  // status LEDs around the lower body
  const ledMat = new THREE.MeshBasicMaterial({ color: f.c.neonDark, toneMapped: false });
  const ledGeo = new THREE.BoxGeometry(0.07, 0.025, 0.012);
  const leds = glowLayer(new THREE.InstancedMesh(ledGeo, ledMat, 6));
  const mm = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < 6; i++) {
    const a = ((i - 2.5) / 6) * Math.PI * 1.1;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
    mm.compose(new THREE.Vector3(Math.sin(a) * 0.645, 0.075, Math.cos(a) * 0.645), q, new THREE.Vector3(1, 1, 1));
    leds.setMatrixAt(i, mm);
  }
  group.add(leds);
  // logo plate on the front face
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.085), toon(tex(plateArt(f), false), { emissiveMap: tex(plateArt(f), false), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.6 }));
  plate.position.set(0, 0.062, 0.642);
  plate.rotation.x = -0.46;
  group.add(plate);
  return { group, ringMat, lensMat, ledMat, lensY: 0.24 };
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
  const U = holoUniforms();
  const neon = new THREE.Color(c.neon);
  const neonLight = new THREE.Color(c.neonLight);
  const neonDark = new THREE.Color(c.neonDark);
  const white = new THREE.Color('#ffffff');

  // ---------------------------------------------------------------- can
  const can = buildCan(f, 1, false);
  const canPivot = new THREE.Group();
  const canHome = new THREE.Vector3(-1.82, 0, 0.35);
  const canYaw = 0.35;
  canPivot.position.copy(canHome);
  canPivot.rotation.y = canYaw;
  canPivot.add(can.group);
  root.add(canPivot);

  // ---------------------------------------------------------------- emitter
  const holo = new THREE.Vector3(0.78, 1.42, -0.12);
  const emitter = buildEmitter(f);
  emitter.group.position.set(holo.x, 0, holo.z);
  root.add(emitter.group);
  const lensPos = new THREE.Vector3(holo.x, emitter.lensY, holo.z);
  const poolMat = new THREE.MeshBasicMaterial({ map: tex(auraArt(), false), color: neon, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const pool = glowLayer(new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), poolMat));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(holo.x, 0.004, holo.z + 0.1);
  root.add(pool);

  // standby hologram: a little voxel lightning bolt swaying above the emitter
  const boltGrid = new VoxelGrid(9, 14, 3);
  boltGrid.stampXY(
    ['....#####', '...#####.', '...####..', '..####...', '..#######', '.#######.', '....###..', '...###...', '...##....', '..##.....', '..#......', '.#.......', '.........', '.........'],
    { '#': '#ffffff' },
    0,
    13,
    0,
    2,
  );
  // solid (outlined) so it reads against the busy shelves; scanlines still crawl over it
  const standbyMat = holoMaterial(U, { vertexColors: true, color: neon, blending: THREE.NormalBlending, transparent: false, depthWrite: true }, { scan: 0.3, sweep: 0 });
  const standby = new THREE.Mesh(meshVoxels(boltGrid, { scale: 0.058, anchor: 'center' }), standbyMat);
  standby.position.set(holo.x, 0.82, holo.z);
  root.add(standby);
  let standbyVis = 1;

  // ---------------------------------------------------------------- hologram QR
  const codeSize = 1.94; // code + 2-module quiet zone
  const quiet = 2;
  const qrSize = (codeSize * qr.size) / (qr.size + quiet * 2);
  const m = qrSize / qr.size;
  const spots = layoutModules(qr, { size: qrSize, center: holo, plane: 'xy' });
  const N = spots.length;
  const voxGeo = paintBoxFaces(new THREE.BoxGeometry(1, 1, 1), ['#a8a8a8', '#a8a8a8', '#d6d6d6', '#808080', '#ffffff', '#5a5a5a'], '#ffffff');
  const neonMat = holoMaterial(U, { vertexColors: true }, { scan: 0.42, sweep: 0.9 });
  const vox = glowLayer(new THREE.InstancedMesh(voxGeo, neonMat, Math.max(1, N)));
  vox.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  vox.frustumCulled = false;
  vox.renderOrder = 3;
  const inkMat = new THREE.MeshBasicMaterial({ color: c.ink, transparent: true, opacity: 0 });
  const ink = new THREE.InstancedMesh(voxGeo, inkMat, Math.max(1, N));
  ink.instanceMatrix = vox.instanceMatrix;
  ink.frustumCulled = false;
  ink.visible = false;
  ink.renderOrder = 2;
  root.add(vox, ink);
  const baseCol: THREE.Color[] = spots.map((s) => (isStructural(s.kind) ? neonLight.clone() : Math.random() < 0.12 ? neonLight.clone().lerp(neon, 0.5) : neon.clone()));
  const appear = new Float32Array(N).fill(1e9);
  const tmpM = new THREE.Matrix4();
  const tmpS = new THREE.Vector3();
  const tmpP = new THREE.Vector3();
  const tmpC = new THREE.Color();
  const ident = new THREE.Quaternion();
  let voxDirty = true;
  let colorsDirty = true;
  let printing = false;

  // scan panel: bright light box that fades in behind the code
  const panelSize = codeSize + 0.36; // generous light margin keeps busy shelves away from the code
  const panelMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(panelSize, panelSize), panelMat);
  panel.position.set(holo.x, holo.y, holo.z - m * 0.6);
  panel.visible = false;
  panel.renderOrder = 1;
  root.add(panel);

  // smoked projection field: gives the neon something dark to glow against (fades out for scanning)
  const fieldSize = codeSize + 0.8;
  const fieldMat = new THREE.MeshBasicMaterial({ map: tex(fieldArt(96, Math.round((96 * (codeSize + 0.25)) / fieldSize)), false), transparent: true, opacity: 0, depthWrite: false });
  const field = glowLayer(new THREE.Mesh(new THREE.PlaneGeometry(fieldSize, fieldSize), fieldMat));
  field.position.set(holo.x, holo.y, holo.z - m * 1.2);
  field.renderOrder = 0;
  root.add(field);

  // hologram sheet (grid + corner brackets) and projector fan
  const sheetMat = holoMaterial(U, { map: tex(sheetArt(64), false), color: neon, opacity: 0 }, { scan: 0.5, sweep: 0.25 });
  const sheet = glowLayer(new THREE.Mesh(new THREE.PlaneGeometry(codeSize + 0.08, codeSize + 0.08), sheetMat));
  sheet.position.set(holo.x, holo.y, holo.z - m * 0.7);
  root.add(sheet);
  const fanGeo = new THREE.BufferGeometry();
  {
    const top = holo.y + codeSize / 2 + 0.04;
    const hw = codeSize / 2 + 0.04;
    const z = holo.z - m * 0.9;
    fanGeo.setAttribute('position', new THREE.Float32BufferAttribute([lensPos.x, lensPos.y, z, holo.x + hw, top, z, holo.x - hw, top, z, lensPos.x - 0.14, lensPos.y, z, lensPos.x + 0.14, lensPos.y, z], 3));
    fanGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 0, 1, 1, 0, 1, 0.4, 0, 0.6, 0], 2));
    fanGeo.setIndex([3, 4, 1, 3, 1, 2]);
  }
  const fanMat = holoMaterial(U, { map: tex(fanArt(), false), color: neon, opacity: 0, side: THREE.DoubleSide }, { scan: 0.35, sweep: 0.15 });
  const fan = glowLayer(new THREE.Mesh(fanGeo, fanMat));
  root.add(fan);

  // print head: bright bar that sweeps up while the code prints
  const beamMat = new THREE.MeshBasicMaterial({ color: c.neonLight, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const beam = glowLayer(new THREE.Mesh(new THREE.BoxGeometry(codeSize + 0.1, 0.025, 0.025), beamMat));
  beam.visible = false;
  root.add(beam);

  // orbit rings
  const dash = tex(dashArt(), false);
  dash.wrapS = THREE.RepeatWrapping;
  dash.repeat.set(4, 1);
  const ringMat = new THREE.MeshBasicMaterial({ map: dash, color: neon, alphaTest: 0.5, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const ringMat2 = ringMat.clone();
  ringMat2.color = neonLight.clone();
  const ringA = glowLayer(new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.014, 4, 128), ringMat));
  const ringB = glowLayer(new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.01, 4, 112), ringMat2));
  const pivotA = new THREE.Group();
  const pivotB = new THREE.Group();
  pivotA.position.copy(holo);
  pivotB.position.copy(holo);
  pivotA.rotation.set(Math.PI / 2 - 0.32, 0.18, 0);
  pivotB.rotation.set(Math.PI / 2 + 0.42, -0.3, 0);
  pivotA.add(ringA);
  pivotB.add(ringB);
  root.add(pivotA, pivotB);

  // electric aura around the can while it crackles
  const auraMat = new THREE.SpriteMaterial({ map: tex(auraArt(), false), color: neon, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const aura = glowLayer(new THREE.Sprite(auraMat));
  aura.scale.set(1.5, 2.1, 1);
  aura.position.y = can.top * 0.5;
  can.group.add(aura);

  // ---------------------------------------------------------------- fx
  const bolts = new Bolts(18, c.neon);
  root.add(bolts.core, bolts.glow);
  const sparks = new Particles(260, { glow: true });
  root.add(sparks.mesh);
  const motes = new Particles(90, { glow: true });
  root.add(motes.mesh);

  // ---------------------------------------------------------------- state
  let time = 0;
  let phase: 'idle' | 'busy' | 'done' = 'idle';
  let power = 0; // emitter power 0..1
  let holoVis = 0; // hologram (sheet, fan) visibility 0..1
  let ringVis = 0;
  let glow = 0.85; // can emissive
  let scanT = 0;
  let scanTarget = 0;
  let crackle = false;
  let nextBolt = 0;
  let nextFlicker = 3;
  let flickerEnd = 0;
  let nextMote = 0;
  let sweepAuto = true;
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const mouthW = new THREE.Vector3();

  const setTab = (t: number) => {
    can.tabPivot.rotation.x = t * 1.2;
    (can.lid.material as THREE.MeshToonMaterial).map = t > 0 ? can.openLid : can.closedLid;
  };
  const resetCan = () => {
    canPivot.position.copy(canHome);
    canPivot.rotation.set(0, canYaw, 0);
  };
  const mouthWorld = () => {
    can.group.updateWorldMatrix(true, false);
    return mouthW.copy(can.mouth).applyMatrix4(can.group.matrixWorld);
  };
  /** Random point on the can's surface (world). */
  const canPoint = (out: THREE.Vector3) => {
    const a = Math.random() * Math.PI * 2;
    const y = 0.1 + Math.random() * (can.top - 0.05);
    out.set(Math.sin(a) * can.R, y, Math.cos(a) * can.R);
    can.group.updateWorldMatrix(true, false);
    return out.applyMatrix4(can.group.matrixWorld);
  };

  function writeVoxels() {
    const fill = 0.84 + (1.03 - 0.84) * scanT;
    const ripple = m * 0.28 * (1 - scanT) * holoVis;
    let animating = ripple > 1e-5;
    let flashing = false;
    for (let k = 0; k < N; k++) {
      const age = time - appear[k];
      let sc = 0;
      if (age >= 0) {
        if (age < 0.28) {
          const t = age / 0.28;
          sc = t < 0.6 ? (t / 0.6) * 1.35 : 1.35 - ((t - 0.6) / 0.4) * 0.35;
          animating = true;
        } else sc = 1;
      } else if (appear[k] < 1e8) animating = true;
      const s = m * fill * sc;
      tmpS.set(s, s, s);
      const sp = spots[k];
      tmpP.copy(sp.pos);
      if (ripple > 0) tmpP.z += Math.sin(time * 2.2 - (sp.r + sp.c) * 0.32) * ripple;
      tmpM.compose(tmpP, ident, tmpS);
      vox.setMatrixAt(k, tmpM);
      if (colorsDirty) {
        if (age >= 0 && age < 0.35) {
          tmpC.copy(white).lerp(baseCol[k], age / 0.35);
          flashing = true;
        } else tmpC.copy(baseCol[k]);
        vox.setColorAt(k, tmpC);
      }
    }
    vox.instanceMatrix.needsUpdate = true;
    if (colorsDirty && vox.instanceColor) vox.instanceColor.needsUpdate = true;
    colorsDirty = flashing || printing;
    voxDirty = animating;
  }
  const hideVoxels = () => {
    appear.fill(1e9);
    voxDirty = true;
    colorsDirty = true;
  };
  hideVoxels();

  const applyPower = () => {
    poolMat.opacity = 0.12 + power * 0.33;
    emitter.ringMat.color.copy(neonDark).lerp(neon, power);
    emitter.lensMat.color.copy(neonDark).lerp(neonLight, power);
    emitter.ledMat.color.copy(neonDark).lerp(neonLight, power);
  };
  applyPower();

  async function reveal() {
    phase = 'busy';
    hideVoxels();
    bolts.clear();
    resetCan();
    setTab(0);
    power = 0;
    holoVis = 0;
    ringVis = 0;
    sweepAuto = false;
    U.uSweep.value = -100;
    applyPower();
    void tweens.tween(0.4, (t) => (standbyVis = 1 - t), ease.inBack, tg);

    // 1. the can hums and vibrates
    audio.play('zap');
    await tweens.tween(0.55, (t) => {
      canPivot.position.x = canHome.x + (Math.random() - 0.5) * 0.025 * t;
      canPivot.position.z = canHome.z + (Math.random() - 0.5) * 0.02 * t;
      canPivot.rotation.z = (Math.random() - 0.5) * 0.07 * t;
      glow = 0.85 + t * 0.9;
      if (Math.random() < 0.25) sparks.burst(canPoint(tmpA), { count: 2, color: [c.neon, '#ffffff'], speed: 0.8, up: 0.8, size: 0.022, life: 0.3, gravity: 2 });
    }, ease.linear, tg);
    resetCan();

    // 2. CRACK! the tab pops and the can flashes
    audio.play('crack');
    audio.play('fizz');
    void tweens.tween(0.22, (t) => setTab(Math.max(0.02, t)), ease.outBack, tg);
    sparks.burst(mouthWorld(), { count: 26, color: [c.neon, c.neonLight, '#ffffff', c.zap], speed: 1.6, up: 2.4, size: 0.03, life: 0.6, gravity: 3 });
    glow = 3;
    await tweens.wait(0.25, tg);

    // 3. it levitates and lightning crackles all around it
    audio.play('whoosh');
    crackle = true;
    nextBolt = time;
    await tweens.tween(1.6, (t) => {
      canPivot.position.y = ease.outQuad(Math.min(1, t * 2.2)) * 0.38 + Math.sin(t * 20) * 0.012;
      canPivot.rotation.y = canYaw + t * Math.PI * 0.9;
      canPivot.rotation.z = Math.sin(t * 31) * 0.03;
    }, ease.linear, tg);
    crackle = false;

    // 4. a big arc powers the emitter
    const top = mouthWorld().clone();
    for (let i = 0; i < 3; i++) bolts.fire(top, lensPos, { life: 0.55, jitter: 0.14, thick: 2.6 - i * 0.6 });
    audio.play('zap', { rate: 0.8 });
    audio.play('whoosh');
    sparks.burst(lensPos, { count: 34, color: [c.neon, '#ffffff', c.zap], speed: 1.8, up: 2.2, size: 0.032, life: 0.7, gravity: 3 });
    glow = 3;
    await tweens.tween(0.4, (t) => {
      power = t;
      holoVis = t * 0.6;
      applyPower();
    }, ease.outQuad, tg);

    // 5. print the code, row by row, bottom to top
    const dur = Math.min(2.4, 1.3 + qr.size * 0.025);
    const t0 = time;
    for (let k = 0; k < N; k++) {
      const fromBottom = (qr.size - 1 - spots[k].r) / Math.max(1, qr.size - 1);
      appear[k] = t0 + fromBottom * dur + Math.random() * 0.06;
    }
    voxDirty = true;
    colorsDirty = true;
    printing = true;
    beam.visible = true;
    const yBottom = holo.y - qrSize / 2 - m;
    const yTop = holo.y + qrSize / 2 + m;
    let lastRow = -1;
    await tweens.tween(dur + 0.1, (t) => {
      const y = yBottom + (yTop - yBottom) * Math.min(1, t * (dur + 0.1) / dur);
      beam.position.set(holo.x, y, holo.z + m * 0.6);
      U.uSweep.value = y;
      holoVis = 0.6 + t * 0.4;
      const row = Math.floor(t * 12);
      if (row !== lastRow) {
        lastRow = row;
        audio.play('blip', { rate: 0.8 + t * 0.9, minGap: 0.05 });
        tmpA.set(holo.x + (Math.random() - 0.5) * qrSize, y, holo.z + 0.05);
        sparks.burst(tmpA, { count: 3, color: [c.neonLight, '#ffffff'], speed: 0.7, up: 0.6, size: 0.022, life: 0.35, gravity: 1 });
      }
    }, ease.linear, tg);
    beam.visible = false;
    printing = false;
    sweepAuto = true;

    // 6. rings spin up, the can lands
    audio.play('unlock');
    void tweens.tween(0.5, (t) => {
      canPivot.position.y = 0.38 * (1 - t);
      canPivot.rotation.set(0, canYaw + Math.PI * 0.9 * (1 - t) + t * Math.PI * 2, 0);
    }, ease.inQuad, tg).then(() => {
      resetCan();
      audio.play('step');
    });
    await tweens.tween(0.6, (t) => (ringVis = t), ease.outBack, tg);
    audio.play('tada');
    for (const [dx, dy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      sparks.burst(tmpA.set(holo.x + (dx * codeSize) / 2, holo.y + (dy * codeSize) / 2, holo.z), { count: 10, color: [c.neon, c.neonLight, '#ffffff'], speed: 1.2, up: 1.2, size: 0.03, life: 0.7, gravity: 2 });
    phase = 'done';
  }

  function finish() {
    tweens.cancel(tg);
    standbyVis = 0;
    resetCan();
    setTab(1);
    bolts.clear();
    crackle = false;
    beam.visible = false;
    power = 1;
    holoVis = 1;
    ringVis = 1;
    glow = 0.85;
    sweepAuto = true;
    applyPower();
    appear.fill(-10);
    voxDirty = true;
    colorsDirty = true;
    printing = false;
    phase = 'done';
  }

  return {
    root,
    reveal,
    finish,
    actionLabel: 'Crack it!',
    hero: { target: new THREE.Vector3(-0.45, 1.2, 0.1), distance: 6.3, yaw: 0.12, pitch: 0.17 },
    update(dt) {
      time += dt;
      U.uTime.value = time;

      // scan-mode cross-fade: neon hologram -> dark modules on a bright panel
      if (Math.abs(scanT - scanTarget) > 1e-3) {
        scanT += Math.sign(scanTarget - scanT) * Math.min(Math.abs(scanTarget - scanT), dt * 2.5);
        if (Math.abs(scanT - scanTarget) <= 1e-3) scanT = scanTarget;
        voxDirty = true;
      }
      const fun = 1 - scanT;
      inkMat.opacity = scanT;
      ink.visible = scanT > 0.001;
      panelMat.opacity = scanT;
      panel.visible = scanT > 0.001;

      // flicker (fun mode only)
      let gain = 1;
      if (phase === 'done' && scanTarget === 0) {
        if (time > nextFlicker) {
          flickerEnd = time + 0.22;
          nextFlicker = time + 2.5 + Math.random() * 3.5;
        }
        if (time < flickerEnd) gain = Math.random() < 0.5 ? 0.35 : 0.9;
      }
      U.uGain.value = gain;
      neonMat.opacity = fun;
      vox.visible = fun > 0.001;
      fieldMat.opacity = Math.min(1, holoVis * 1.6) * fun;
      field.visible = fieldMat.opacity > 0.001;
      sheetMat.opacity = holoVis * 0.8 * fun;
      fanMat.opacity = holoVis * 0.2 * fun;
      sheet.visible = fan.visible = sheetMat.opacity > 0.001;
      ringMat.opacity = ringMat2.opacity = Math.min(1, ringVis) * fun;
      pivotA.visible = pivotB.visible = ringMat.opacity > 0.001;
      const rs = Math.max(0.001, ringVis);
      pivotA.scale.setScalar(rs);
      pivotB.scale.setScalar(rs);
      ringA.rotation.z = time * 0.7;
      ringB.rotation.z = -time * 1.05;
      if (sweepAuto) {
        const span = codeSize + 0.6;
        U.uSweep.value = holo.y - span / 2 + ((time * 0.42) % 1.6) * span;
      }

      standby.visible = standbyVis > 0.01;
      if (standby.visible) {
        standby.rotation.y = Math.sin(time * 1.3) * 0.6;
        standby.position.y = 0.82 + Math.sin(time * 2) * 0.04;
        standby.scale.setScalar(Math.max(0.001, standbyVis * (1 - scanT)));
      }

      // can glow breathing
      glow += (0.85 + Math.sin(time * 2.4) * 0.2 - glow) * (1 - Math.exp(-3 * dt));
      const auraT = crackle ? 0.55 + Math.random() * 0.35 : Math.max(0, (glow - 1.2) * 0.3);
      auraMat.opacity += (auraT - auraMat.opacity) * (1 - Math.exp(-12 * dt));
      aura.visible = auraMat.opacity > 0.01;
      can.bodyMat.emissiveIntensity = glow;
      if (phase === 'idle') {
        power = 0.1 + Math.sin(time * 1.7) * 0.08;
        applyPower();
        if (Math.random() < dt * 0.6) {
          const p = mouthWorld();
          tmpA.set(p.x + (Math.random() - 0.5) * 0.3, p.y + 0.05 + Math.random() * 0.2, p.z + (Math.random() - 0.5) * 0.3);
          bolts.fire(p, tmpA, { life: 0.1, jitter: 0.25, thick: 0.7 });
        }
      }

      // lightning crackle around the levitating can
      if (crackle && time >= nextBolt) {
        nextBolt = time + 0.035 + Math.random() * 0.05;
        const a = canPoint(tmpA);
        tmpB.set(a.x - canPivot.position.x, 0, a.z - canPivot.position.z).normalize();
        const reach = 0.4 + Math.random() * 0.6;
        tmpB.set(a.x + tmpB.x * reach, Math.max(0.02, a.y + (Math.random() - 0.5) * 1.0), a.z + tmpB.z * reach);
        if (Math.random() < 0.3) tmpB.y = 0.01; // arc to the counter
        bolts.fire(a, tmpB, { life: 0.1 + Math.random() * 0.1, jitter: 0.24, thick: 1.4 + Math.random() * 1.0 });
        sparks.burst(tmpB, { count: 3, color: [c.neon, '#ffffff', c.zap], speed: 0.9, up: 0.9, size: 0.024, life: 0.35, gravity: 3 });
        audio.play('zap', { rate: 1 + Math.random() * 0.6, minGap: 0.09 });
      }

      // data motes drifting up the projector beam
      if (holoVis > 0.5 && scanTarget === 0 && time > nextMote) {
        nextMote = time + 0.12;
        tmpA.set(holo.x + (Math.random() - 0.5) * 0.25, emitter.lensY + 0.05, holo.z + (Math.random() - 0.5) * 0.25);
        motes.burst(tmpA, { count: 1, color: [c.neon, c.neonLight], speed: 0.35, up: 0.5, size: 0.02, life: 1.8, gravity: -0.35, spread: 1 });
      }

      if (voxDirty) writeVoxels();
      bolts.update(dt);
      sparks.update(dt);
      motes.update(dt);
    },
    focusView: () => ({ center: holo.clone(), normal: new THREE.Vector3(0, 0, 1), size: codeSize * 1.06, up: new THREE.Vector3(0, 1, 0) }),
    setScanMode(on) {
      scanTarget = on ? 1 : 0;
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
  const hi = shade(f.c.ink, 0.1);
  return composePoster(
    art,
    scale,
    {
      qr: ctx.qr,
      x: POSTER.qrX,
      y: POSTER.qrY,
      size: POSTER.qrSize,
      dark: f.c.ink,
      light: '#eefcff',
      quiet: 2,
      module: (g, _r, _c, x, y, mm) => {
        // dark voxel with a faint (still dark) bevel
        g.fillStyle = f.c.ink;
        g.fillRect(x, y, mm, mm);
        const b = Math.max(1, Math.round(mm * 0.14));
        g.fillStyle = hi;
        g.fillRect(x, y, mm, b);
        g.fillRect(x, y, b, mm);
      },
    },
    { label: ctx.label, product: 'Volt Energy · ' + f.name, accent: f.c.neonDark },
  );
}

export const volt: ProductDef = {
  id: 'volt',
  name: 'Volt Energy',
  tagline: 'Charge your codes.',
  reveal: 'Crack it open: lightning crackles, then a neon hologram QR flickers to life.',
  section: 'cooler',
  price: 150,
  badge: 'RARE',
  flavors: VOLT_FLAVORS,
  shelfSize: [0.26, 0.48],
  shelfModel(f) {
    return buildCan(f, 0.32, true).group;
  },
  createShowcase,
  poster,
};
