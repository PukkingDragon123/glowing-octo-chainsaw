import * as THREE from 'three';
import { ease } from '../../engine/tween';
import { audio } from '../../engine/audio';
import { toonGradient } from '../../engine/voxel';
import { LAYER_NO_OUTLINE } from '../../engine/PixelRenderer';
import { Painter, shade } from '../../engine/Painter';
import { Buddy } from '../../art/buddy';
import { CAST } from '../../art/cast';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import { atlasBox } from '../common/box';
import { orderSpots } from '../common/qrLayout';
import { Particles } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import {
  bakedFront,
  clipX,
  FACE,
  faceArt,
  FILM_OFF,
  filmBack,
  filmFront,
  filmUV,
  INK,
  leafArt,
  NORI,
  oniOutline,
  ONI,
  ONIGIRI_FLAVORS,
  polyGeometry,
  POSTER,
  posterArt,
  RICE,
  riceTexture,
  stripArt,
  TAB2,
  TAB3,
  TAB_R,
  woodSide,
  woodTop,
  zzzArt,
  type Pt,
} from './art';
import { NoriSheet, TearStrip } from './parts';

const BOARD_TOP = 0.14;
const FILM_Z = ONI.T / 2 + 0.03;
const STRIP_TOP = 2.62;
const STRIP_LEN = 2.5;
const APEX_Y = 2.33;

function mipmapped<T extends THREE.Texture>(t: T): T {
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/** The rice ball: rounded-triangle prism with a flat front face and soft bevelled edges. */
function riceBody(tex: THREE.Texture): THREE.Mesh {
  const outline = oniOutline(-ONI.bevel, 10);
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const depth = ONI.T - 2 * ONI.bevelT;
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: ONI.bevelT, bevelSize: ONI.bevel, bevelSegments: 3, curveSegments: 4 });
  geo.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient() }));
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  return mesh;
}

function riceTex() {
  const t = riceTexture();
  t.repeat.set(1.45, 1.45);
  return t;
}

function circlePoly(c: Pt, r: number, seg = 16): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  return out;
}

function filmMat(tex: THREE.Texture) {
  return new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient(), transparent: true, depthWrite: false });
}

interface FilmHalf {
  group: THREE.Group;
  mats: THREE.MeshToonMaterial[];
}

/** The printed wrapper: two halves (front + back + corner tab each) that slide off sideways. */
function makeFilm(f: Flavor): FilmHalf[] {
  const frontTex = filmFront(f).texture();
  const backTex = filmBack(f).texture();
  const outline = oniOutline(FILM_OFF, 8);
  return ([-1, 1] as const).map((side) => {
    const group = new THREE.Group();
    const fm = filmMat(frontTex);
    const bm = filmMat(backTex);
    const front = new THREE.Mesh(polyGeometry(clipX(outline, side < 0 ? 0.004 : -0.004, side < 0), filmUV), fm);
    front.position.z = FILM_Z;
    const tab = new THREE.Mesh(polyGeometry(circlePoly(side < 0 ? TAB2 : TAB3, TAB_R), filmUV), fm);
    tab.position.z = FILM_Z + 0.003;
    // the back film is seen from behind: local +x ends up on world -x
    const back = new THREE.Mesh(polyGeometry(clipX(outline, side < 0 ? -0.004 : 0.004, side > 0), filmUV), bm);
    back.rotation.y = Math.PI;
    back.position.z = -FILM_Z;
    for (const m of [front, tab, back]) {
      m.layers.set(LAYER_NO_OUTLINE);
      m.renderOrder = 2;
      group.add(m);
    }
    return { group, mats: [fm, bm] };
  });
}

function board(): THREE.Group {
  const g = new THREE.Group();
  const top = woodTop(100, 44).canvas;
  const side = woodSide(100, 5).canvas;
  const end = woodSide(44, 5).canvas;
  const b = atlasBox(4.1, 0.1, 1.8, { px: end, nx: end, py: top, ny: side, pz: side, nz: side });
  b.position.y = 0.04 + 0.05;
  g.add(b);
  const footMat = new THREE.MeshToonMaterial({ color: '#a8743d', gradientMap: toonGradient() });
  for (const x of [-1.5, 1.5]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 1.6), footMat);
    foot.position.set(x, 0.02, 0);
    foot.castShadow = true;
    foot.receiveShadow = true;
    g.add(foot);
  }
  return g;
}

function leaf(len: number, width: number) {
  const tex = leafArt().texture();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, width), new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient(), alphaTest: 0.5, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

function takuan() {
  const g = new THREE.Group();
  const mat = new THREE.MeshToonMaterial({ color: '#f7d64a', gradientMap: toonGradient() });
  const rim = new THREE.MeshToonMaterial({ color: '#e8b923', gradientMap: toonGradient() });
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.045, 14), [rim, mat, mat]);
    s.position.set(i * 0.13, 0.03 + i * 0.012, i * 0.02);
    s.rotation.z = -0.12 * i;
    s.castShadow = true;
    s.receiveShadow = true;
    g.add(s);
  }
  return g;
}

/** Filling peeking out of the top of the rice ball: a soft speckled dollop (ume gets a leaf). */
function filling(f: Flavor, mip = false): THREE.Group {
  const g = new THREE.Group();
  const p = new Painter(32, 16).clear(f.c.fill);
  let seed = f.id.length * 13 + 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const specks = f.id === 'pork' ? [f.c.fillDark, '#ff6b3d'] : f.id === 'tuna' ? [f.c.fillDark, '#6fbf4a'] : [f.c.fillDark, shade(f.c.fill, 0.2)];
  for (let i = 0; i < 70; i++) p.rect(Math.floor(rnd() * 32), Math.floor(rnd() * 16), 2, 1, specks[i % specks.length]);
  const tex = p.texture();
  if (mip) mipmapped(tex);
  const ume = f.id === 'ume';
  const blob = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient() }));
  blob.scale.set(ume ? 0.2 : 0.3, ume ? 0.19 : 0.13, ume ? 0.2 : 0.26);
  blob.castShadow = true;
  g.add(blob);
  if (ume) {
    const leafMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshToonMaterial({ color: '#56b04e', gradientMap: toonGradient() }));
    leafMesh.scale.set(0.09, 0.025, 0.05);
    leafMesh.position.set(0.05, 0.19, 0);
    leafMesh.rotation.z = 0.4;
    g.add(leafMesh);
  }
  return g;
}

/** The little fish-shaped soy sauce bottle every bento comes with (head +X, lies on the board). */
function soyFish(): THREE.Group {
  const g = new THREE.Group();
  // sphere UVs: u = 0 at -X, 0.25 at +Z, 0.5 at +X; v = 1 at the top
  const p = new Painter(64, 32).clear('#e8f4ff');
  p.rect(0, 17, 64, 15, '#6b3a1e');
  for (let x = 0; x < 64; x += 4) p.rect(x, 16 + ((x / 4) % 2), 4, 1, '#8a4f2a');
  p.rect(0, 9, 64, 2, '#ffffff');
  for (const u of [0.4, 0.6]) {
    p.disc(u * 64, 13, 1.8, INK);
    p.px(Math.round(u * 64) - 1, 12, '#ffffff');
  }
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshToonMaterial({ map: p.texture(), gradientMap: toonGradient() }));
  body.scale.set(0.2, 0.09, 0.085);
  body.position.y = 0.09;
  const clear = new THREE.MeshToonMaterial({ color: '#e8f4ff', gradientMap: toonGradient() });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.11, 12), clear);
  tail.scale.z = 0.35;
  tail.rotation.z = -Math.PI / 2;
  tail.position.set(-0.23, 0.09, 0);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 12), new THREE.MeshToonMaterial({ color: '#e53935', gradientMap: toonGradient() }));
  cap.rotation.z = Math.PI / 2;
  cap.position.set(0.215, 0.09, 0);
  for (const m of [body, tail, cap]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
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

  // --- set dressing: serving board, bamboo leaves, pickles and a soy fish
  root.add(board());
  const leafA = leaf(2.9, 0.72);
  leafA.position.set(-0.55, BOARD_TOP + 0.003, 0.18);
  leafA.rotation.z = 0.28;
  root.add(leafA);
  const leafB = leaf(2.6, 0.62);
  leafB.position.set(0.7, BOARD_TOP + 0.006, -0.05);
  leafB.rotation.z = -0.35;
  root.add(leafB);
  const pickles = takuan();
  pickles.position.set(1.62, BOARD_TOP, 0.62);
  root.add(pickles);
  const fish = soyFish();
  fish.position.set(-1.72, BOARD_TOP, 0.66);
  fish.rotation.y = 0.7;
  root.add(fish);

  // the onigiri buddy hops up beside the board to cheer once the code is done
  const buddyAt = new THREE.Vector3(2.45, 0, 0.5);
  const buddy = new Buddy(CAST.oni, 64);
  buddy.billboard = true;
  buddy.position.copy(buddyAt);
  buddy.visible = false;
  root.add(buddy);

  // --- the onigiri
  const oni = new THREE.Group();
  oni.position.set(0, BOARD_TOP + 0.004, 0);
  root.add(oni);
  const squash = new THREE.Group();
  oni.add(squash);
  squash.add(riceBody(riceTex()));
  const dollop = filling(f);
  dollop.position.set(0, APEX_Y - 0.02, 0);
  squash.add(dollop);

  // code geometry (on the flat front face)
  const S = ONI.codeS;
  const quiet = 2;
  const n = qr.size;
  const m = S / (n + quiet * 2);
  const noriSize = n * m;
  const noriBottom = ONI.codeBottom + quiet * m;
  const codeCenter = new THREE.Vector3(0, oni.position.y + ONI.codeBottom + S / 2, ONI.T / 2 + 0.004);

  const nori = new NoriSheet(qr, noriSize);
  nori.mesh.position.set(0, noriBottom, ONI.T / 2 + 0.004);
  squash.add(nori.mesh);

  // face (sleeping inside the wrapper, wakes up at the end)
  const faceTex = { sleep: faceArt('sleep').texture(), blink: faceArt('blink').texture(), open: faceArt('open').texture(), happy: faceArt('happy').texture() };
  const faceMat = new THREE.MeshToonMaterial({ map: faceTex.sleep, gradientMap: toonGradient(), alphaTest: 0.5 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(FACE.w / 48, FACE.h / 48), faceMat);
  face.position.set(0, FACE.top - FACE.h / 96, ONI.T / 2 + 0.002);
  squash.add(face);
  const setFace = (k: keyof typeof faceTex) => (faceMat.map = faceTex[k]);

  // wrapper
  const film = makeFilm(f);
  for (const h of film) squash.add(h.group);
  const strip = new TearStrip(STRIP_LEN, 0.2, stripArt(STRIP_LEN, 0.2).texture());
  strip.mesh.position.set(0, STRIP_TOP, FILM_Z + 0.006);
  squash.add(strip.mesh);

  // sleepy z's
  const zTex = zzzArt().texture();
  const zzz = [0, 1].map(() => {
    const z = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), new THREE.MeshBasicMaterial({ map: zTex, transparent: true, depthWrite: false }));
    z.layers.set(LAYER_NO_OUTLINE);
    root.add(z);
    return z;
  });

  const fx = new Particles(420);
  fx.floorY = BOARD_TOP;
  root.add(fx.mesh);

  // light modules in punch order (ripple out from the centre)
  const lights: { r: number; c: number; pos: THREE.Vector3 }[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (!qr.isDark(r, c)) lights.push({ r, c, pos: new THREE.Vector3((c - (n - 1) / 2) * m, oni.position.y + noriBottom + (n - r - 0.5) * m, ONI.T / 2 + 0.02) });
  const punchOrder = orderSpots(lights, 'spiral');
  const crumbColors = [NORI, '#2c3e30', '#16211a'];
  const filmBits = ['#ffffff', '#dff1ff', '#e8233a'];
  const filmDust = ['#ffffff', '#dff1ff'];
  const _fxPos = new THREE.Vector3();

  let time = 0;
  let idle = true;
  let done = false;
  let nextBlink = 2.5;
  let scan = false;

  const setSquash = (a: number) => squash.scale.set(1 + a * 0.05, 1 - a * 0.08, 1 + a * 0.05);
  const resetFilm = () => {
    for (const h of film) {
      h.group.visible = true;
      h.group.position.set(0, 0, 0);
      h.group.rotation.set(0, 0, 0);
      for (const mm of h.mats) mm.opacity = 1;
    }
    strip.mesh.visible = true;
    strip.mesh.position.set(0, STRIP_TOP, FILM_Z + 0.006);
    strip.mesh.rotation.set(0, 0, 0);
    strip.mesh.scale.set(1, 1, 1);
    strip.setPeel(0);
  };
  const slideFilm = (h: FilmHalf, dir: -1 | 1, t: number) => {
    const e = ease.inQuad(t);
    h.group.position.set(dir * 2.7 * e, Math.sin(t * Math.PI) * 0.12, 0.05 * t);
    h.group.rotation.set(0, dir * 0.35 * t, dir * 0.18 * t);
    const o = 1 - THREE.MathUtils.smoothstep(t, 0.45, 1);
    for (const mm of h.mats) mm.opacity = o;
    if (t >= 1) h.group.visible = false;
  };

  /** The buddy pops up out of nowhere (squash & stretch) and cheers. */
  const popBuddy = (animated: boolean) => {
    buddy.position.copy(buddyAt);
    buddy.visible = !scan;
    if (!animated) {
      buddy.scale.setScalar(1);
      return;
    }
    buddy.scale.setScalar(0.01);
    void tweens.tween(0.5, (t) => {
      buddy.scale.setScalar(Math.max(0.01, ease.outBack(t)));
      buddy.position.y = buddyAt.y + Math.sin(t * Math.PI) * 0.35;
    }, ease.linear, tg).then(() => void buddy.cheer());
  };
  let buddyNext = 4;

  async function reveal() {
    tweens.cancel(tg);
    done = false;
    idle = false;
    resetFilm();
    nori.unpunchAll();
    nori.setWrap(noriSize, 0);
    setFace('sleep');
    buddy.visible = false;
    for (const z of zzz) z.visible = false;
    // wake-up wiggle
    audio.play('pop');
    await tweens.tween(0.5, (t) => {
      squash.rotation.z = Math.sin(t * Math.PI * 6) * 0.035 * (1 - t);
      setSquash(Math.sin(t * Math.PI) * 0.3);
    }, ease.linear, tg);
    squash.rotation.z = 0;
    setSquash(0);
    // 1: the tear strip rolls down like a scroll
    audio.play('rip');
    let lastRip = 0;
    await tweens.tween(1.05, (t) => {
      strip.setPeel(t * STRIP_LEN);
      if (t - lastRip > 0.22) {
        lastRip = t;
        audio.play('rip', { rate: 1.2, minGap: 0.15 });
        fx.burst(_fxPos.set(0, oni.position.y + STRIP_TOP - t * STRIP_LEN, FILM_Z + 0.1), { count: 3, color: filmBits, speed: 0.9, up: 1, size: 0.035, life: 0.5 });
      }
    }, ease.inOutQuad, tg);
    // the roll pops off and bounces away
    const rollFrom = strip.mesh.position.clone();
    void tweens.tween(0.7, (t) => {
      strip.mesh.position.set(rollFrom.x + t * 1.3, rollFrom.y + Math.sin(t * Math.PI) * 0.5 - t * 0.2, rollFrom.z + t * 0.7);
      strip.mesh.rotation.z = -t * 6;
      strip.mesh.scale.setScalar(1 - ease.inQuad(t));
    }, ease.outQuad, tg).then(() => (strip.mesh.visible = false));
    await tweens.wait(0.2, tg);
    // 2 and 3: the film halves slide off
    audio.play('whoosh');
    fx.burst(_fxPos.set(-1.5, oni.position.y + 0.1, FILM_Z), { count: 8, color: filmDust, speed: 1.2, up: 1.2, size: 0.03, life: 0.5 });
    await tweens.tween(0.6, (t) => slideFilm(film[0], -1, t), ease.linear, tg);
    audio.play('whoosh');
    fx.burst(_fxPos.set(1.5, oni.position.y + 0.1, FILM_Z), { count: 8, color: filmDust, speed: 1.2, up: 1.2, size: 0.03, life: 0.5 });
    await tweens.tween(0.6, (t) => slideFilm(film[1], 1, t), ease.linear, tg);
    // the loose nori flops forward...
    await tweens.tween(0.32, (t) => nori.setWrap(noriSize * (1 - t), 0.85 * t), ease.outQuad, tg);
    await tweens.wait(0.08, tg);
    // ...and wraps onto the rice
    audio.play('whoosh', { rate: 1.3 });
    await tweens.tween(0.55, (t) => nori.setWrap(noriSize * t, 0.85 * (1 - t)), ease.inOutCubic, tg);
    // pat pat
    for (let k = 0; k < 2; k++) {
      audio.play('pop', { rate: 0.8 + k * 0.3 });
      await tweens.tween(0.16, (t) => setSquash(Math.sin(t * Math.PI) * 0.6), ease.linear, tg);
    }
    setSquash(0);
    // punch the code out of the nori
    audio.play('crunch');
    let punched = 0;
    await tweens.tween(Math.min(1.8, 0.9 + punchOrder.length / 900), (t) => {
      const want = Math.floor(punchOrder.length * t);
      while (punched < want) {
        const L = punchOrder[punched++];
        nori.punch(L.r, L.c);
        if (punched % 3 === 0) fx.burst(L.pos, { count: 1, color: crumbColors, speed: 0.8, up: 1.3, size: m * 0.9, life: 0.55, gravity: 7 });
        if (punched % 28 === 0) audio.play('pop', { rate: 1.3 + Math.random() * 0.6, minGap: 0.05 });
      }
    }, ease.inOutSine, tg);
    nori.punchAll();
    // good morning!
    setFace('blink');
    await tweens.wait(0.12, tg);
    setFace('happy');
    audio.play('tada');
    popBuddy(true);
    fx.burst(_fxPos.set(0, oni.position.y + APEX_Y + 0.2, 0.3), { count: 46, color: [f.c.main, f.c.accent, '#ffffff', '#ff8fb1'], speed: 2.2, up: 3, size: 0.05, life: 1.1 });
    await tweens.tween(0.45, (t) => {
      oni.position.y = BOARD_TOP + 0.004 + Math.sin(t * Math.PI) * 0.22;
      setSquash(t < 0.15 ? t * 3 : Math.max(0, 0.45 - t) * 0.6);
    }, ease.linear, tg);
    oni.position.y = BOARD_TOP + 0.004;
    setSquash(0);
    setFace('open');
    done = true;
  }

  function finish() {
    tweens.cancel(tg);
    idle = false;
    for (const h of film) h.group.visible = false;
    strip.mesh.visible = false;
    nori.setWrap(noriSize, 0);
    nori.punchAll();
    setFace('open');
    squash.rotation.set(0, 0, 0);
    setSquash(0);
    oni.position.y = BOARD_TOP + 0.004;
    for (const z of zzz) z.visible = false;
    popBuddy(false);
    done = true;
  }

  return {
    root,
    reveal,
    finish,
    actionLabel: 'Pull 1, 2, 3!',
    hero: { target: new THREE.Vector3(0, 1.18, 0.2), distance: 7.1, yaw: -0.3, pitch: 0.24 },
    label: { object: squash, position: new THREE.Vector3(0, 0.6, FILM_Z + 0.009), size: [1.25, 0.56] },
    update(dt, _time, camera) {
      time += dt;
      buddy.update(dt, camera);
      if (done && !scan && buddy.visible) {
        buddyNext -= dt;
        if (buddyNext < 0) {
          buddyNext = 4 + Math.random() * 3;
          void (Math.random() < 0.5 ? buddy.wave() : buddy.hop());
        }
      }
      if (idle) {
        const b = Math.sin(time * 1.6);
        squash.scale.set(1 - b * 0.006, 1 + b * 0.01, 1 - b * 0.006);
        zzz.forEach((z, i) => {
          const ph = (time * 0.45 + i * 0.5) % 1;
          z.visible = !scan;
          z.position.set(0.45 + ph * 0.45, oni.position.y + APEX_Y - 0.2 + ph * 0.5, 0.45);
          z.scale.setScalar(0.45 + ph * 0.6);
          (z.material as THREE.MeshBasicMaterial).opacity = Math.sin(ph * Math.PI);
        });
      }
      if (done && !scan) {
        nextBlink -= dt;
        if (nextBlink < 0) {
          setFace('blink');
          if (nextBlink < -0.12) {
            setFace('open');
            nextBlink = 2.5 + Math.random() * 2.5;
          }
        }
      }
      fx.update(dt);
    },
    focusView: () => ({ center: codeCenter.clone(), normal: new THREE.Vector3(0, 0, 1), size: S, up: new THREE.Vector3(0, 1, 0) }),
    setScanMode(on) {
      scan = on;
      nori.setScan(on);
      buddy.visible = done && !on;
      if (on) {
        setFace(done ? 'open' : 'sleep');
        for (const z of zzz) z.visible = false;
      }
    },
    dispose() {
      nori.dispose();
      strip.dispose();
      for (const t of Object.values(faceTex)) t.dispose();
      disposeTree(root);
    },
  };
}

function shelfModel(f: Flavor): THREE.Object3D {
  const s = 0.135;
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(s);
  inner.position.y = FILM_OFF * s; // the film hangs a little below the rice
  g.add(inner);
  inner.add(riceBody(mipmapped(riceTex())));
  const frontMat = new THREE.MeshToonMaterial({ map: mipmapped(bakedFront(f).texture()), gradientMap: toonGradient(), alphaTest: 0.5 });
  for (const poly of [oniOutline(FILM_OFF), circlePoly(TAB2, TAB_R), circlePoly(TAB3, TAB_R)]) {
    const front = new THREE.Mesh(polyGeometry(poly, filmUV), frontMat);
    front.position.z = ONI.T / 2 + 0.02;
    inner.add(front);
  }
  const tab = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.03), new THREE.MeshToonMaterial({ color: '#e8233a', gradientMap: toonGradient() }));
  tab.position.set(0, APEX_Y + 0.1, ONI.T / 2);
  inner.add(tab);
  const dollop = filling(f, true);
  dollop.position.set(0, APEX_Y - 0.02, 0);
  inner.add(dollop);
  return g;
}

function poster(ctx: ProductContext) {
  const art = posterArt(ctx.flavor);
  const scale = posterScale(art.w);
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return composePoster(
    art,
    scale,
    {
      qr: ctx.qr,
      x: POSTER.codeX,
      y: POSTER.codeY,
      size: POSTER.codeSize,
      dark: NORI,
      light: RICE,
      quiet: 2,
      module: (c2d, _r, _c, x, y, mm) => {
        c2d.fillStyle = NORI;
        c2d.fillRect(x, y, mm, mm);
        const q = Math.max(1, Math.floor(mm / 4));
        c2d.fillStyle = '#2c3e30';
        c2d.fillRect(x + Math.floor(rnd() * (mm - q)), y + Math.floor(rnd() * (mm - q)), q, q);
      },
    },
    { label: ctx.label, product: 'Onigiri QR · ' + ctx.flavor.name, accent: ctx.flavor.c.main },
  );
}

export const onigiri: ProductDef = {
  id: 'onigiri',
  name: 'Onigiri QR',
  tagline: 'Pull 1, 2, 3. Say itadakimasu.',
  reveal: 'Pull the tabs 1-2-3: the wrapper slides off and the nori wraps on as your code.',
  section: 'fresh',
  price: 0,
  flavors: ONIGIRI_FLAVORS,
  shelfSize: [0.42, 0.37],
  shelfModel,
  createShowcase,
  poster,
};
