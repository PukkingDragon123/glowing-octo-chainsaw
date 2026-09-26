import * as THREE from 'three';
import { Painter, shade } from '../../engine/Painter';
import { ease } from '../../engine/tween';
import { audio } from '../../engine/audio';
import { FONT_TINY } from '../../engine/pixelFont';
import { toonGradient } from '../../engine/voxel';
import { LAYER_NO_OUTLINE } from '../../engine/PixelRenderer';
import { Buddy } from '../../art/buddy';
import { CAST } from '../../art/cast';
import { Batcher, paintGeometry, toonMat } from '../../engine/batch';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import { atlasBox } from '../common/box';
import { Particles } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import { COCOA_SCAN, CUP, CUP_LABEL, CUP_TEX, cupArt, foamArt, FOAM_SCAN, INK, LATTE_FLAVORS, POSTER, posterArt, signArt, signSide } from './art';
import { CocoaCode, StencilCard } from './parts';

const SAUCER_TOP = 0.106;

function toon(color: string, extra: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });
}

function mipmapped<T extends THREE.Texture>(t: T): T {
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/** White saucer with a flavour-coloured rim band. */
function buildSaucer(f: Flavor, r = 1.42) {
  const b = new Batcher();
  b.cylinder(r * 0.62, 0.035, '#e9e2d6', 0, 0, 0, 28);
  b.cylinder(r * 0.74, 0.07, '#fbf7ef', 0, 0.035, 0, 40, undefined, r);
  // coloured band around the edge + a stripe on top
  b.add(paintGeometry(new THREE.CylinderGeometry(r + 0.006, r * 0.93 + 0.006, 0.034, 40, 1, true), f.c.cup), toonMat(), 0, 0.085, 0);
  const ring = paintGeometry(new THREE.RingGeometry(r - 0.11, r - 0.06, 40), f.c.cup);
  b.add(ring, toonMat(), 0, SAUCER_TOP + 0.001, 0, -Math.PI / 2);
  b.add(paintGeometry(new THREE.CircleGeometry(r * 0.52, 28), '#efe7da'), toonMat(), 0, SAUCER_TOP + 0.001, 0, -Math.PI / 2);
  return b.build();
}

interface Cup {
  group: THREE.Group;
  wallMat: THREE.MeshToonMaterial;
  /** Inner radius at local height y. */
  innerR: (y: number) => number;
  top: number;
  bottom: number;
}

/** The café cup: textured tapered wall, glazed rim, inner wall and a loop handle. */
function buildCup(f: Flavor, dims = CUP, mip = false): Cup {
  const g = new THREE.Group();
  const { rTop, rBottom, h, wall, foot } = dims;
  const tex = cupArt(f, 'smile').texture();
  if (mip) mipmapped(tex);
  const wallMat = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient() });
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 40, 1, true, Math.PI, Math.PI * 2), wallMat);
  outer.position.y = foot + h / 2;
  const footM = new THREE.Mesh(new THREE.CylinderGeometry(rBottom * 0.92, rBottom * 0.86, foot, 32), toon(f.c.cupDark));
  footM.position.y = foot / 2;
  const glaze = toon('#fff6ea');
  const rim = new THREE.Mesh(new THREE.RingGeometry(rTop - wall, rTop, 48), glaze);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = foot + h;
  const bottom = foot + 0.04;
  const rinB = rBottom - wall * 1.3;
  const rinT = rTop - wall;
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(rinT, rinB, h - 0.04, 40, 1, true), toon('#fff4e6', { side: THREE.BackSide }));
  inner.position.y = bottom + (h - 0.04) / 2;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(rinB, 32), toon('#f3e6d3'));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = bottom + 0.001;
  // handle: a fat "C" on +X
  const hy = foot + h * 0.52;
  const rw = rBottom + (rTop - rBottom) * 0.52;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(h * 0.27, h * 0.085, 8, 18, Math.PI * 1.35), toon(f.c.cup));
  handle.rotation.z = -Math.PI * 0.675;
  handle.position.set(rw + h * 0.13, hy, 0);
  for (const m of [outer, footM, rim, inner, floor, handle]) {
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  inner.castShadow = false;
  return {
    group: g,
    wallMat,
    innerR: (y: number) => rinB + ((y - bottom) / (foot + h - bottom)) * (rinT - rinB),
    top: foot + h,
    bottom,
  };
}

function menuSign(f: Flavor) {
  const g = new THREE.Group();
  const side = signSide().canvas;
  const back = new Painter(64, 80).clear('#9a6a36').canvas;
  const top = new Painter(64, 8).clear('#8f6030').canvas;
  const board = atlasBox(0.9, 1.12, 0.05, { px: side, nx: side, py: top, ny: top, pz: signArt(f).canvas, nz: back });
  board.position.set(0, 0.56, 0);
  board.rotation.x = -0.16;
  board.position.z = -0.09;
  g.add(board);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.05), toon('#8f6030'));
  leg.position.set(0, 0.48, -0.36);
  leg.rotation.x = 0.36;
  leg.castShadow = true;
  g.add(leg);
  return g;
}

function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) m.castShadow = m.receiveShadow = true;
  });
  return o;
}

/** Stainless milk jug with its origin at the bottom centre: round belly, pointed spout (+X), loop handle (-X). */
function pitcherModel() {
  const g = new THREE.Group();
  const steel = toon('#cfd8e3', { side: THREE.DoubleSide });
  const profile = [
    [0, 0],
    [0.24, 0],
    [0.275, 0.03],
    [0.285, 0.12],
    [0.275, 0.34],
    [0.25, 0.55],
    [0.25, 0.64],
    [0.265, 0.7],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 28), steel));
  // a bright band and the milk inside
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.281, 0.284, 0.05, 28, 1, true), toon('#eef3f8'));
  band.position.y = 0.2;
  g.add(band);
  const milk = new THREE.Mesh(new THREE.CircleGeometry(0.245, 24), toon('#fffaf0'));
  milk.rotation.x = -Math.PI / 2;
  milk.position.y = 0.6;
  g.add(milk);
  // spout: a little tapered lip pointing out and up
  const spout = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 12, 1, true), steel);
  spout.scale.z = 0.7;
  spout.rotation.z = -Math.PI / 2 + 0.5;
  spout.position.set(0.3, 0.66, 0);
  g.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.034, 8, 16, Math.PI * 1.15), steel);
  handle.rotation.z = Math.PI * 0.43;
  handle.position.set(-0.27, 0.4, 0);
  g.add(handle);
  return shadowed(g);
}

/** Cocoa shaker (origin at the bottom centre): flavour-coloured tin, cream label with a heart, domed lid with holes. */
function shakerModel(f: Flavor) {
  const g = new THREE.Group();
  const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.54, 24), toon(f.c.cup));
  tin.position.y = 0.27;
  const label = new Painter(64, 16).clear('#fff6ea');
  label.rect(0, 0, 64, 1, f.c.cupDark).rect(0, 15, 64, 1, f.c.cupDark);
  label.sprite(['.#.#.', '#####', '#####', '.###.', '..#..'], 30, 5, { '#': '#ff8fa3' });
  label.text('COCOA', 12, 5, { font: FONT_TINY, color: f.c.cupDark, align: 'center' });
  label.text('COCOA', 52, 5, { font: FONT_TINY, color: f.c.cupDark, align: 'center' });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.204, 0.204, 0.2, 24, 1, true), toon('#ffffff', { map: label.texture() }));
  band.position.y = 0.28;
  band.rotation.y = Math.PI; // the heart (texture centre) faces +Z
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.212, 0.212, 0.1, 24), toon('#dfe6ee'));
  lid.position.y = 0.59;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#eef3f8'));
  dome.scale.y = 0.42;
  dome.position.y = 0.64;
  g.add(tin, band, lid, dome);
  const holeMat = toon(INK);
  for (const [x, z] of [[0, 0], [0.08, 0], [-0.08, 0], [0, 0.08], [0, -0.08]]) {
    const h = new THREE.Mesh(new THREE.CircleGeometry(0.018, 8), holeMat);
    h.rotation.x = -Math.PI / 2;
    h.position.set(x, 0.64 + 0.084 - (x * x + z * z) * 1.1, z);
    g.add(h);
  }
  return shadowed(g);
}

/** Butter cookie with chocolate chips (origin at the bottom centre). */
function cookieModel() {
  const top = new Painter(32, 32).clear('#e8b86a');
  top.disc(16, 16, 15, '#efc57c');
  for (const [x, y] of [[10, 9], [20, 12], [14, 20], [23, 21], [8, 17], [17, 5], [25, 15]]) top.rect(x, y, 2, 2, '#f7d89c');
  const side = toon('#d9a55a');
  const face = toon('#ffffff', { map: top.texture() });
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.07, 24), [side, face, side]);
  disc.position.y = 0.035;
  g.add(disc);
  const chip = toon('#5a3420');
  for (const [x, z] of [[-0.07, -0.05], [0.06, -0.08], [0.02, 0.06], [-0.09, 0.07], [0.1, 0.04]]) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 5), chip);
    c.scale.y = 0.7;
    c.position.set(x, 0.072, z);
    g.add(c);
  }
  return shadowed(g);
}

/** Teaspoon lying on its back, centred at the origin along X (bowl on +X). */
function spoonModel() {
  const g = new THREE.Group();
  const steel = toon('#b9c3d0');
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.44, 4, 8), steel);
  handle.rotation.z = Math.PI / 2;
  handle.scale.z = 0.6;
  handle.position.set(-0.08, 0.018, 0);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), toon('#cfd8e3'));
  bowl.scale.set(0.12, 0.03, 0.085);
  bowl.position.set(0.24, 0.03, 0);
  g.add(handle, bowl);
  return shadowed(g);
}

function disposeTree(root: THREE.Object3D) {
  const grad = toonGradient();
  const shared = toonMat();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      if (m === shared) continue;
      const map = (m as THREE.MeshToonMaterial).map;
      if (map && map !== grad) map.dispose();
      m.dispose();
    }
  });
}

function createShowcase(ctx: ProductContext): ShowcaseItem {
  const { qr, flavor: f, tweens, group: tg } = ctx;
  const root = new THREE.Group();
  const C = new THREE.Vector3(0.22, 0, 0.3);

  // --- saucer, cup, treats
  const saucer = buildSaucer(f);
  saucer.position.copy(C);
  root.add(saucer);
  const cup = buildCup(f);
  cup.group.position.set(C.x, SAUCER_TOP, C.z);
  root.add(cup.group);
  const cupTex = { smile: cup.wallMat.map!, happy: cupArt(f, 'happy').texture() };
  const cookie = cookieModel();
  cookie.position.set(C.x + 0.92, SAUCER_TOP - 0.005, C.z + 0.78);
  cookie.rotation.set(0.1, 0.4, 0);
  root.add(cookie);
  const spoon = spoonModel();
  spoon.position.set(C.x - 0.62, SAUCER_TOP, C.z + 0.98);
  spoon.rotation.y = 0.55;
  root.add(spoon);
  // the bean buddy hops up beside the saucer to cheer once the art is done
  const beanAt = new THREE.Vector3(1.9, 0, 0.95);
  const bean = new Buddy(CAST.bean, 64);
  bean.billboard = true;
  bean.position.copy(beanAt);
  bean.visible = false;
  root.add(bean);
  let beanNext = 4;
  let done = false;
  const sign = menuSign(f);
  sign.position.set(-1.9, 0, -1.05);
  sign.rotation.y = 0.42;
  root.add(sign);

  // --- the drink surface
  const levelLow = SAUCER_TOP + cup.bottom + 0.2;
  const levelFull = SAUCER_TOP + cup.top - 0.05;
  const foamTex = foamArt(f).texture();
  const foamScanTex = foamArt(f, true).texture();
  const surfMat = new THREE.MeshToonMaterial({ map: foamTex, gradientMap: toonGradient() });
  const surface = new THREE.Mesh(new THREE.CircleGeometry(1, 48), surfMat);
  surface.rotation.x = -Math.PI / 2;
  surface.receiveShadow = true;
  root.add(surface);
  const drinkCol = new THREE.Color(f.c.drink);
  const white = new THREE.Color('#ffffff');
  const setLevel = (y: number, foam: number) => {
    const r = cup.innerR(y - SAUCER_TOP) - 0.004;
    surface.position.set(C.x, y, C.z);
    surface.scale.set(r, r, 1);
    surfMat.color.copy(drinkCol).lerp(white, foam);
  };

  // --- the code (cocoa on foam)
  const S = 1.2;
  const quiet = 2;
  const cocoa = new CocoaCode(qr, S, quiet, f);
  const codeMat = new THREE.MeshToonMaterial({ map: cocoa.tex, gradientMap: toonGradient(), alphaTest: 0.5 });
  const codePlane = new THREE.Mesh(new THREE.PlaneGeometry(S, S), codeMat);
  codePlane.rotation.x = -Math.PI / 2;
  codePlane.position.set(C.x, levelFull + 0.002, C.z);
  codePlane.receiveShadow = true;
  root.add(codePlane);

  // --- stencil card (rests on the rim)
  const card = new StencilCard(qr, cocoa, f);
  const cardY = SAUCER_TOP + cup.top + 0.006;
  const cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(card.worldW, card.worldH), new THREE.MeshToonMaterial({ map: card.tex, gradientMap: toonGradient(), alphaTest: 0.5, side: THREE.DoubleSide }));
  const cardPivot = new THREE.Group();
  cardMesh.rotation.x = -Math.PI / 2;
  cardMesh.position.x = card.offsetX;
  cardMesh.castShadow = true;
  cardPivot.add(cardMesh);
  cardPivot.visible = false;
  root.add(cardPivot);
  const cardRest = new THREE.Vector3(C.x, cardY, C.z);
  const cardSky = new THREE.Vector3(C.x + 0.9, 3.4, C.z - 1.2);

  // --- pitcher + shaker
  const pitcher = new THREE.Group();
  const pitcherMesh = pitcherModel();
  pitcherMesh.position.y = -0.36;
  pitcher.add(pitcherMesh);
  const pitcherRest = new THREE.Vector3(-1.85, 0.36, 0.42);
  pitcher.position.copy(pitcherRest);
  pitcher.rotation.y = -0.35;
  root.add(pitcher);
  const spoutLocal = new THREE.Vector3(0.4, 0.33, 0);

  const shaker = new THREE.Group();
  const shakerMesh = shakerModel(f);
  shakerMesh.position.y = -0.36;
  shaker.add(shakerMesh);
  const shakerRest = new THREE.Vector3(2.05, 0.36, -0.3);
  shaker.position.copy(shakerRest);
  root.add(shaker);

  // milk stream
  const streamMat = toon('#fffaf0');
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 1, 10, 1, true), streamMat);
  stream.visible = false;
  root.add(stream);
  const _dir = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const setStream = (from: THREE.Vector3, to: THREE.Vector3) => {
    _dir.subVectors(to, from);
    const len = _dir.length();
    stream.position.copy(from).addScaledVector(_dir, 0.5);
    stream.quaternion.setFromUnitVectors(_up, _dir.normalize());
    stream.scale.set(1, len, 1);
  };

  // steam puffs
  const steamN = 12;
  const steam = new THREE.InstancedMesh(new THREE.SphereGeometry(0.6, 10, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false }), steamN);
  steam.layers.set(LAYER_NO_OUTLINE);
  steam.frustumCulled = false;
  root.add(steam);
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();

  const fx = new Particles(700);
  fx.floorY = cardY + 0.004;
  root.add(fx.mesh);
  const fx2 = new Particles(260);
  fx2.floorY = 0;
  root.add(fx2.mesh);

  let time = 0;
  let level = levelLow;
  let foam = 0;
  let steamOn = true;
  let scan = false;

  const reset = () => {
    level = levelLow;
    foam = 0;
    setLevel(level, foam);
    cocoa.clear();
    card.clean();
    codePlane.visible = false;
    cardPivot.visible = false;
    stream.visible = false;
    pitcher.position.copy(pitcherRest);
    pitcher.rotation.set(0, -0.35, 0);
    shaker.position.copy(shakerRest);
    shaker.rotation.set(0, 0, 0);
    cup.wallMat.map = cupTex.smile;
    surface.receiveShadow = true;
    codePlane.receiveShadow = true;
    steamOn = true;
    bean.visible = false;
    done = false;
  };
  reset();

  /** The bean buddy pops up (squash & stretch) and cheers. */
  const popBean = (animated: boolean) => {
    bean.position.copy(beanAt);
    bean.visible = !scan;
    done = true;
    if (!animated) {
      bean.scale.setScalar(1);
      return;
    }
    bean.scale.setScalar(0.01);
    void tweens.tween(0.5, (t) => {
      bean.scale.setScalar(Math.max(0.01, ease.outBack(t)));
      bean.position.y = beanAt.y + Math.sin(t * Math.PI) * 0.35;
    }, ease.linear, tg).then(() => void bean.cheer());
  };

  const spout = new THREE.Vector3();
  const pourTo = new THREE.Vector3();
  const _dust = new THREE.Vector3();
  const cocoaBits = [f.c.cocoa, f.c.cocoa2, '#3b2214'];
  const milkBits = ['#fffaf0', '#ffffff', f.c.crema];

  async function reveal() {
    tweens.cancel(tg);
    reset();
    // pick up the pitcher
    audio.play('whoosh');
    const pourPos = new THREE.Vector3(C.x - 1.08, 1.62, C.z - 0.05);
    const p0 = pitcher.position.clone();
    await tweens.tween(0.8, (t) => {
      pitcher.position.lerpVectors(p0, pourPos, t);
      pitcher.position.y += Math.sin(t * Math.PI) * 0.3;
      pitcher.rotation.set(0, -0.35 * (1 - t), -1.1 * ease.inQuad(t));
    }, ease.inOutCubic, tg);
    // pour: milk rises and turns into foam
    audio.play('splash');
    stream.visible = true;
    steamOn = false;
    await tweens.tween(1.6, (t) => {
      pitcher.rotation.z = -1.1 - Math.sin(t * Math.PI) * 0.12 - (t > 0.6 ? Math.sin((t - 0.6) * 40) * 0.05 : 0);
      pitcher.updateWorldMatrix(true, false);
      spout.copy(spoutLocal).applyMatrix4(pitcher.matrixWorld);
      level = levelLow + (levelFull - levelLow) * ease.outQuad(t);
      foam = THREE.MathUtils.smoothstep(t, 0.05, 0.8);
      setLevel(level, foam);
      pourTo.set(spout.x + 0.06, level, spout.z);
      setStream(spout, pourTo);
      if (Math.random() < 0.35) fx2.burst(pourTo, { count: 2, color: milkBits, speed: 0.6, up: 0.9, size: 0.035, life: 0.35 });
      if (Math.random() < 0.25) audio.play('pour', { minGap: 0.3 });
    }, ease.linear, tg);
    stream.visible = false;
    setLevel(levelFull, 1);
    // pitcher goes home, foam settles
    const p1 = pitcher.position.clone();
    void tweens.tween(0.7, (t) => {
      pitcher.position.lerpVectors(p1, pitcherRest, t);
      pitcher.position.y += Math.sin(t * Math.PI) * 0.25;
      pitcher.rotation.set(0, -0.35 * t, -1.1 * (1 - t));
    }, ease.inOutCubic, tg);
    await tweens.tween(0.35, (t) => surface.scale.setScalar((cup.innerR(levelFull - SAUCER_TOP) - 0.004) * (1 + Math.sin(t * Math.PI * 3) * 0.01 * (1 - t))), ease.linear, tg);
    codePlane.visible = true;
    // the stencil floats down onto the rim
    audio.play('whoosh', { rate: 1.2 });
    cardPivot.visible = true;
    await tweens.tween(0.85, (t) => {
      cardPivot.position.lerpVectors(cardSky, cardRest, t);
      cardPivot.rotation.set(0.7 * (1 - t), 0.5 * (1 - t), -0.4 * (1 - t) + Math.sin(t * Math.PI * 2) * 0.08 * (1 - t));
    }, ease.outCubic, tg);
    cardPivot.position.copy(cardRest);
    cardPivot.rotation.set(0, 0, 0);
    audio.play('clack', { rate: 0.6 });
    // shaker flies over and flips
    const s0 = shaker.position.clone();
    const lane = [-0.42, 0, 0.42];
    const x0 = C.x - 0.78;
    const x1 = C.x + 0.78;
    const hy = cardY + 0.62;
    const start = new THREE.Vector3(x0, hy, C.z + lane[0]);
    await tweens.tween(0.6, (t) => {
      shaker.position.lerpVectors(s0, start, t);
      shaker.position.y += Math.sin(t * Math.PI) * 0.4;
      shaker.rotation.set(0, 0, Math.PI * t);
    }, ease.inOutCubic, tg);
    // dust: three serpentine passes
    const dur = 2.1;
    await tweens.tween(dur, (t) => {
      const seg = Math.min(2, Math.floor(t * 3));
      const u = t * 3 - seg;
      const dirX = seg % 2 === 0 ? 1 : -1;
      const x = dirX > 0 ? x0 + (x1 - x0) * u : x1 - (x1 - x0) * u;
      const zPrev = lane[seg];
      const z = zPrev + (u > 0.85 && seg < 2 ? (lane[seg + 1] - zPrev) * ((u - 0.85) / 0.15) : 0);
      shaker.position.set(x, hy + Math.abs(Math.sin(t * 60)) * 0.04, C.z + z);
      shaker.rotation.set(Math.sin(t * 50) * 0.08, 0, Math.PI + Math.sin(t * 38) * 0.1);
      const lx = x - C.x;
      const lz = z;
      cocoa.sprinkle(lx, lz, 0.46, 0.09);
      card.sprinkle(lx, lz, 0.46, 0.05);
      fx.burst(_dust.set(x, hy - 0.34, C.z + z), { count: 5, color: cocoaBits, speed: 0.45, up: -0.6, size: 0.022, life: 0.6, gravity: 5 });
      if (Math.random() < 0.3) audio.play('scratch', { minGap: 0.09 });
    }, ease.linear, tg);
    await tweens.tween(0.3, () => cocoa.topUp(0.2), ease.linear, tg);
    cocoa.fillAll();
    // shaker goes home
    const s1 = shaker.position.clone();
    void tweens.tween(0.6, (t) => {
      shaker.position.lerpVectors(s1, shakerRest, t);
      shaker.position.y += Math.sin(t * Math.PI) * 0.4;
      shaker.rotation.set(0, 0, Math.PI * (1 - t));
    }, ease.inOutCubic, tg);
    await tweens.wait(0.25, tg);
    // lift the stencil: ta-da!
    audio.play('whoosh');
    await tweens.tween(0.45, (t) => {
      cardPivot.position.y = cardY + ease.outQuad(t) * 0.5;
      cardPivot.rotation.z = Math.sin(t * Math.PI) * 0.06;
    }, ease.linear, tg);
    surface.receiveShadow = false;
    codePlane.receiveShadow = false;
    const c0 = cardPivot.position.clone();
    void tweens.tween(0.7, (t) => {
      cardPivot.position.lerpVectors(c0, cardSky, t);
      cardPivot.rotation.set(-0.8 * t, 0.6 * t, 0.5 * t);
      cardPivot.scale.setScalar(1 - ease.inQuad(t));
    }, ease.inCubic, tg).then(() => {
      cardPivot.visible = false;
      cardPivot.scale.setScalar(1);
    });
    audio.play('ding');
    fx2.burst(_dust.set(C.x, levelFull + 0.15, C.z), { count: 40, color: ['#ff8fa3', '#ffffff', f.c.accent, f.c.crema], speed: 1.8, up: 2.6, size: 0.045, life: 1 });
    cup.wallMat.map = cupTex.happy;
    popBean(true);
    await tweens.wait(0.35, tg);
    audio.play('tada');
    steamOn = true;
  }

  function finish() {
    tweens.cancel(tg);
    reset();
    level = levelFull;
    foam = 1;
    setLevel(level, foam);
    cocoa.fillAll();
    codePlane.visible = true;
    surface.receiveShadow = false;
    codePlane.receiveShadow = false;
    cup.wallMat.map = cupTex.happy;
    popBean(false);
  }

  const steamSpots = [
    [-0.35, 0.2],
    [0.1, -0.3],
    [0.4, 0.25],
  ];

  // the order sticker goes on the cup front, below its face, following the wall's slant
  const labelMid = 1 - (CUP_LABEL.top + CUP_LABEL.bottom) / 2 / CUP_TEX.h;
  const labelR = CUP.rBottom + (CUP.rTop - CUP.rBottom) * labelMid;
  const labelTilt = Math.atan2(CUP.rTop - CUP.rBottom, CUP.h);

  return {
    root,
    reveal,
    finish,
    actionLabel: 'Pour & dust!',
    hero: { target: new THREE.Vector3(0.05, 0.72, 0.25), distance: 6.3, yaw: 0.08, pitch: 0.58 },
    label: { object: cup.group, position: new THREE.Vector3(0, CUP.foot + CUP.h * labelMid, labelR + 0.004), rotation: new THREE.Euler(labelTilt, 0, 0), size: [0.78, 0.33] },
    update(dt, _time, camera) {
      time += dt;
      bean.update(dt, camera);
      if (done && !scan && bean.visible) {
        beanNext -= dt;
        if (beanNext < 0) {
          beanNext = 4 + Math.random() * 3;
          void (Math.random() < 0.5 ? bean.wave() : bean.hop());
        }
      }
      // steam
      const show = steamOn && !scan;
      for (let i = 0; i < steamN; i++) {
        if (!show) {
          _m.makeScale(0, 0, 0);
        } else {
          const ph = (time * 0.3 + i / steamN) % 1;
          const [sx, sz] = steamSpots[i % 3];
          _p.set(C.x + sx + Math.sin(ph * 5 + i) * 0.1, SAUCER_TOP + cup.top + 0.12 + ph * 0.9, C.z + sz);
          const sc = 0.02 + Math.sin(ph * Math.PI) * 0.06;
          _s.set(sc, sc, sc);
          _m.compose(_p, _q, _s);
        }
        steam.setMatrixAt(i, _m);
      }
      steam.instanceMatrix.needsUpdate = true;
      cocoa.flush();
      card.flush();
      fx.update(dt);
      fx2.update(dt);
    },
    focusView: () => ({ center: new THREE.Vector3(C.x, levelFull + 0.002, C.z), normal: new THREE.Vector3(0, 1, 0), size: S, up: new THREE.Vector3(0, 0, -1) }),
    setScanMode(on) {
      scan = on;
      bean.visible = done && !on;
      cocoa.setScan(on);
      surfMat.map = on ? foamScanTex : foamTex;
      if (on) surface.receiveShadow = codePlane.receiveShadow = false;
    },
    dispose() {
      cocoa.dispose();
      card.dispose();
      foamScanTex.dispose();
      cupTex.happy.dispose();
      disposeTree(root);
    },
  };
}

function shelfFoam(f: Flavor) {
  const p = foamArt(f);
  const heart = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  p.sprite(heart, 64 - 21, 64 - 18, { '#': f.c.cocoa }, 6);
  return p;
}

function shelfModel(f: Flavor): THREE.Object3D {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(0.23);
  inner.position.x = -0.045; // centre the cup + handle
  g.add(inner);
  const saucer = buildSaucer(f, 1.05);
  inner.add(saucer);
  const dims = { rTop: 0.86, rBottom: 0.66, h: 1.12, wall: 0.07, foot: 0.035 };
  const cup = buildCup(f, dims, true);
  cup.group.position.y = SAUCER_TOP;
  inner.add(cup.group);
  // a fluffy foam dome peeking over the rim, with a cocoa heart on top
  const rimY = SAUCER_TOP + dims.foot + dims.h;
  const rr = dims.rTop - dims.wall * 0.5;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(rr, 24, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon(f.c.foam));
  dome.scale.y = 0.26;
  dome.position.y = rimY - 0.03;
  inner.add(dome);
  const heart = new THREE.Mesh(new THREE.CircleGeometry(rr * 0.62, 24), new THREE.MeshToonMaterial({ map: mipmapped(shelfFoam(f).texture()), gradientMap: toonGradient() }));
  heart.rotation.x = -Math.PI / 2;
  heart.position.y = rimY - 0.03 + rr * 0.26 - 0.012;
  inner.add(heart);
  return g;
}

function poster(ctx: ProductContext) {
  const art = posterArt(ctx.flavor);
  const scale = posterScale(art.w);
  return composePoster(
    art,
    scale,
    {
      qr: ctx.qr,
      x: POSTER.codeX,
      y: POSTER.codeY,
      size: POSTER.codeSize,
      dark: COCOA_SCAN,
      light: FOAM_SCAN,
      quiet: 2,
      module: (c2d, _r, _c, x, y, m) => {
        c2d.fillStyle = COCOA_SCAN;
        c2d.fillRect(x, y, m, m);
        const q = Math.max(1, Math.floor(m / 5));
        c2d.fillStyle = shade(ctx.flavor.c.cocoa, -0.05);
        c2d.fillRect(x + q, y + q * 2, q, q);
        c2d.fillRect(x + m - q * 2, y + m - q * 2, q, q);
      },
    },
    { label: ctx.label, product: 'Latte Code · ' + ctx.flavor.name, accent: ctx.flavor.c.cup },
  );
}

export const latteArt: ProductDef = {
  id: 'latte-art',
  name: 'Latte Code',
  tagline: 'Foam with a message.',
  reveal: 'Milk foams up, a stencil drops on and cocoa dusts your code onto the latte.',
  section: 'fresh',
  price: 60,
  flavors: LATTE_FLAVORS,
  shelfSize: [0.58, 0.34],
  shelfModel,
  createShowcase,
  poster,
};
