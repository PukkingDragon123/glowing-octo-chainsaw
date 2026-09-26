import * as THREE from 'three';
import { Painter, shade } from '../../engine/Painter';
import { toonGradient } from '../../engine/voxel';
import { Kit } from '../../store/kit';
import { Buddy } from '../../art/buddy';
import { CAST } from '../../art/cast';
import { ease, rng } from '../../engine/tween';
import { audio } from '../../engine/audio';
import { LAYER_NO_OUTLINE } from '../../engine/PixelRenderer';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import { atlasBox } from '../common/box';
import { qrDecal } from '../common/qrLayout';
import { Particles } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import { CAPSULE_COLORS, GACHA_FLAVORS, INK, MACHINE, PLAQUE, RED, RED_DARK, SILVER, SILVER_DARK, bandArt, capsuleTopArt, panelArt, plaqueArt, plaqueBack } from './art';
import { gachaPosterArt } from './poster';

/** Top of the machine body (the dome sits on it) and the centre of the glass dome. */
const BASE_TOP = MACHINE.top;
const DOME_R = 0.43;
const DOME_C = new THREE.Vector3(0, BASE_TOP + 0.27, -0.07);
const MECH_FRONT = MACHINE.front + MACHINE.mech.d;
const CRANK_POS = new THREE.Vector3(0, MACHINE.crank.y, MECH_FRONT + 0.02);
const SLOT_POS = new THREE.Vector3(0, MACHINE.mech.y + MACHINE.mech.h, MACHINE.front + MACHINE.mech.d / 2);
const CAP_R = 0.17;
/** Capsule centre height while it rolls out of the chute (it just fits the mouth). */
const CHUTE_Y = MACHINE.chute.y + 0.04 + CAP_R;
const PX = 1.1 / PLAQUE.w;
const PLAQUE_W = PLAQUE.w * PX;
const PLAQUE_H = PLAQUE.h * PX;
const PLAQUE_D = 0.045;
const QR_SIZE = PLAQUE.qrSize * PX;
const QR_LOCAL = new THREE.Vector3((PLAQUE.qrX + PLAQUE.qrSize / 2 - PLAQUE.w / 2) * PX, (PLAQUE.h / 2 - (PLAQUE.qrY + PLAQUE.qrSize / 2)) * PX, PLAQUE_D / 2 + 0.004);
const FRAMES = 8;

function solid(color: string, w = 4, h = 4) {
  return new Painter(w, h).clear(color).canvas;
}

function withMipmaps(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.MeshToonMaterial | undefined;
    if (mat?.map) {
      mat.map.generateMipmaps = true;
      mat.map.minFilter = THREE.LinearMipmapLinearFilter;
      mat.map.needsUpdate = true;
    }
  });
  return obj;
}

/**
 * Rounded machine body: plinth, soft red body with a white header band (logo), a cream prize window,
 * a silver chute with a dark mouth and the coin mech. Built at unit scale.
 */
function machineBody(f: Flavor, withLabel: boolean) {
  const g = new THREE.Group();
  const M = MACHINE;
  const zc = M.front - M.d / 2;
  const k = new Kit();
  k.rbox(M.w + 0.08, 0.08, M.d + 0.06, 0.04, RED_DARK, 0, 0.03, zc);
  for (const x of [-0.4, 0.4]) for (const z of [zc - 0.33, zc + 0.33]) k.sphere(0.05, RED_DARK, x, 0.035, z, 0.7);
  k.rbox(M.w, M.top - 0.07, M.d, 0.14, RED, 0, 0.07, zc);
  k.rbox(M.w + 0.016, M.band.h, M.d + 0.016, 0.1, '#ffffff', 0, M.band.y, zc);
  k.cyl(0.43, 0.45, 0.05, SILVER, 0, M.top - 0.01, DOME_C.z, 32);
  const C = M.chute;
  k.rbox(C.w, C.h, 0.08, 0.07, SILVER, 0, C.y, M.front + 0.02);
  k.rbox(C.w - 0.12, C.h - 0.1, 0.08, 0.05, '#2c2838', 0, C.y + 0.04, M.front + 0.022);
  const Mh = M.mech;
  k.rbox(Mh.w, Mh.h, Mh.d + 0.02, 0.05, SILVER, 0, Mh.y, M.front + Mh.d / 2 - 0.01);
  k.rbox(0.16, 0.014, 0.03, 0.006, INK, 0, Mh.y + Mh.h - 0.004, SLOT_POS.z);
  k.sphere(0.024, '#ff6b76', Mh.w / 2 - 0.06, Mh.y + 0.055, MECH_FRONT + 0.004);
  const P = M.panel;
  k.rbox(P.w + 0.04, P.h + 0.04, 0.03, 0.03, shade(RED, -0.25), 0, P.y - 0.02, M.front);
  g.add(k.build());
  // a pink heart on each side
  const heart = new Painter(9, 8);
  heart.sprite(['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], 1, 1, { '#': '#ffc2d4' });
  heart.outline('#ffffff');
  const heartMat = new THREE.MeshToonMaterial({ map: heart.texture(), gradientMap: toonGradient(), alphaTest: 0.5 });
  for (const side of [-1, 1]) {
    const hm = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.24), heartMat);
    hm.position.set(side * (M.w / 2 + 0.003), 0.66, zc);
    hm.rotation.y = side * Math.PI / 2;
    g.add(hm);
  }
  const decal = (tex: THREE.Texture, w: number, h: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient(), alphaTest: 0.5 }));
    m.position.set(0, y, z);
    g.add(m);
  };
  decal(bandArt().texture(), 0.56, 0.09, M.band.y + M.band.h / 2, M.front + 0.01);
  if (withLabel) decal(panelArt(f).texture(), P.w, P.h, P.y + P.h / 2, M.front + 0.017);
  return g;
}

/** The big turning handle (faces +Z, turns about Z): silver disc, white bar, yellow knobs. */
function crankModel() {
  const k = new Kit();
  k.add(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 28), SILVER_DARK, 0, 0, -0.01, Math.PI / 2);
  k.add(new THREE.CylinderGeometry(0.135, 0.135, 0.04, 28), SILVER, 0, 0, 0.005, Math.PI / 2);
  k.rbox(0.44, 0.075, 0.05, 0.035, '#ffffff', 0, -0.0375, 0.045);
  for (const x of [-0.22, 0.22]) k.sphere(0.06, '#ffd23f', x, 0, 0.05);
  k.add(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12), '#eef1f5', 0, 0, 0.08, Math.PI / 2);
  return k.build();
}

/** Gold play coin in the XY plane (faces ±Z). */
function coinModel() {
  const face = new Painter(24, 24);
  face.clear('#c8930f');
  face.disc(12, 12, 11, '#e0a21b');
  face.disc(12, 12, 9, '#f7c948');
  face.disc(12, 12, 4, '#ffe88a');
  face.px(8, 6, '#fff6c8');
  const faceMat = new THREE.MeshToonMaterial({ map: face.texture(), gradientMap: toonGradient() });
  const geo = new THREE.CylinderGeometry(0.1, 0.1, 0.044, 24);
  geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, [new THREE.MeshToonMaterial({ color: '#d9a21e', gradientMap: toonGradient() }), faceMat, faceMat]);
  m.castShadow = true;
  return m;
}

/** The whole machine: body, glass dome, cap and the capsule pile inside. */
function buildMachine(f: Flavor, scale = 1, withLabel = true) {
  const group = new THREE.Group();
  const body = machineBody(f, withLabel);
  body.scale.setScalar(scale);
  group.add(body);
  // dome glass: a tinted inner shell (reads as a bowl behind the capsules) + a faint front shell
  const shellGeo = new THREE.SphereGeometry(DOME_R * scale, 22, 16);
  const back = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.BackSide }));
  const glass = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ color: '#f2fbff', transparent: true, opacity: 0.16, depthWrite: false }));
  for (const shell of [back, glass]) {
    shell.position.copy(DOME_C).multiplyScalar(scale);
    shell.layers.set(LAYER_NO_OUTLINE);
    group.add(shell);
  }
  back.renderOrder = 1;
  glass.renderOrder = 2;
  // glints on the glass
  const glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const a = 2.1 + i * 0.16;
    const q = new THREE.Mesh(new THREE.PlaneGeometry(0.035 * scale, 0.1 * scale), glintMat);
    q.position.set(Math.cos(a) * DOME_R * 0.93 * scale, (DOME_C.y + 0.12 + i * 0.045) * scale, (DOME_C.z + Math.sin(a) * -0.2 + 0.33) * scale);
    q.rotation.set(-0.3, -0.6, 0.5 - i * 0.18);
    q.layers.set(LAYER_NO_OUTLINE);
    q.renderOrder = 3;
    group.add(q);
  }
  // cap + knob
  const capMat = new THREE.MeshToonMaterial({ color: RED, gradientMap: toonGradient() });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * scale, 0.21 * scale, 0.1 * scale, 16), capMat);
  cap.position.set(0, (DOME_C.y + DOME_R - 0.03) * scale, DOME_C.z * scale);
  cap.castShadow = true;
  group.add(cap);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055 * scale, 10, 8), new THREE.MeshBasicMaterial({ color: f.c.glow }));
  bulb.position.set(0, (DOME_C.y + DOME_R + 0.05) * scale, DOME_C.z * scale);
  bulb.layers.set(LAYER_NO_OUTLINE);
  group.add(bulb);

  // capsule pile (two instanced hemisphere sets share transforms)
  const n = 26;
  const r = 0.085 * scale;
  const topGeo = new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const botGeo = new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const tops = new THREE.InstancedMesh(topGeo, new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: toonGradient() }), n);
  const bots = new THREE.InstancedMesh(botGeo, new THREE.MeshToonMaterial({ color: '#f6f3fb', gradientMap: toonGradient() }), n);
  const rand = rng(17 + f.id.length);
  const pos: THREE.Vector3[] = [];
  const quat: THREE.Quaternion[] = [];
  const c = DOME_C.clone().multiplyScalar(scale);
  const R = DOME_R * scale - r * 1.05;
  let guard = 0;
  while (pos.length < n && guard++ < 4000) {
    const p = new THREE.Vector3((rand() - 0.5) * 2 * R, (rand() - 0.62) * 2 * R * 0.8, (rand() - 0.5) * 2 * R).add(c);
    if (p.distanceTo(c) > R || p.y < BASE_TOP * scale + r) continue;
    if (pos.some((o) => o.distanceTo(p) < r * 1.9)) continue;
    pos.push(p);
    quat.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 6.28, rand() * 6.28, rand() * 6.28)));
  }
  const m = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);
  const col = new THREE.Color();
  for (let i = 0; i < pos.length; i++) {
    m.compose(pos[i], quat[i], one);
    tops.setMatrixAt(i, m);
    bots.setMatrixAt(i, m);
    tops.setColorAt(i, col.set(i === 3 ? f.c.cap : CAPSULE_COLORS[i % CAPSULE_COLORS.length]));
  }
  tops.count = bots.count = pos.length;
  tops.castShadow = bots.castShadow = false;
  group.add(tops, bots);
  return { group, tops, bots, pos, quat, bulb, glass };
}

function capsuleMesh(f: Flavor, r: number) {
  const g = new THREE.Group();
  const topTex = capsuleTopArt(f).texture();
  const topMat = new THREE.MeshToonMaterial({ map: topTex, gradientMap: toonGradient(), side: THREE.DoubleSide });
  if (f.id === 'neon') topMat.emissive = new THREE.Color('#5a0a45');
  const top = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), topMat);
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshToonMaterial({ color: '#f6f3fb', gradientMap: toonGradient(), side: THREE.DoubleSide }));
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.03, r * 1.03, r * 0.16, 16, 1, true), new THREE.MeshToonMaterial({ color: '#cfc8dc', gradientMap: toonGradient(), side: THREE.DoubleSide }));
  ring.position.y = -r * 0.04;
  for (const o of [top, bottom, ring]) {
    o.castShadow = true;
    o.receiveShadow = true;
    g.add(o);
  }
  return { group: g, top, bottom, ring };
}

function createShowcase(ctx: ProductContext): ShowcaseItem {
  const { qr, flavor: f, tweens, group: tg } = ctx;
  const root = new THREE.Group();

  // --- machine
  const machine = new THREE.Group();
  machine.position.set(-1.05, 0, -0.35);
  machine.rotation.y = 0.28;
  machine.updateMatrix();
  root.add(machine);
  const built = buildMachine(f);
  machine.add(built.group);
  const crank = crankModel();
  crank.position.copy(CRANK_POS);
  machine.add(crank);
  const coin = coinModel();
  const coinRestLocal = new THREE.Vector3(0.42, 0.011, 0.72);
  coin.position.copy(coinRestLocal);
  coin.rotation.set(-Math.PI / 2, 0, 0.4);
  machine.add(coin);

  // --- the prize capsule
  const cap = capsuleMesh(f, CAP_R);
  cap.group.visible = false;
  root.add(cap.group);
  const target = new THREE.Vector3(0.78, CAP_R, 0.5);
  const lidRest = new THREE.Vector3(1.38, 0, 0.92);

  // --- the plaque
  const plaque = new THREE.Group();
  const restY = 1.17;
  const restYaw = -0.1;
  plaque.position.set(target.x, restY, target.z);
  plaque.rotation.y = restYaw;
  const edge = solid(f.c.cap);
  const body = atlasBox(PLAQUE_W, PLAQUE_H, PLAQUE_D, { px: edge, nx: edge, py: edge, ny: edge, pz: solid('#ffffff'), nz: plaqueBack(f).canvas });
  plaque.add(body);
  const frameTex: THREE.Texture[] = [];
  for (let k = 0; k < FRAMES; k++) frameTex.push(plaqueArt(f, k / FRAMES).texture());
  const frameMat = new THREE.MeshBasicMaterial({ map: frameTex[0] });
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(PLAQUE_W, PLAQUE_H), frameMat);
  frame.position.z = PLAQUE_D / 2 + 0.002;
  plaque.add(frame);
  const decal = qrDecal(qr, QR_SIZE, INK, '#ffffff', 2);
  decal.position.copy(QR_LOCAL);
  plaque.add(decal);
  plaque.visible = false;
  root.add(plaque);

  // --- light pillar + particles
  const beamMat = new THREE.MeshBasicMaterial({ color: f.c.beam, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 2.6, 20, 1, true), beamMat);
  beam.position.set(target.x, 1.3, target.z);
  beam.layers.set(LAYER_NO_OUTLINE);
  beam.visible = false;
  root.add(beam);
  const sparks = new Particles(260, { glow: true });
  root.add(sparks.mesh);
  const confetti = new Particles(200);
  confetti.floorY = 0.005;
  root.add(confetti.mesh);

  // --- scratch vectors
  const _v = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _axis = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);
  const toRoot = (local: THREE.Vector3, out: THREE.Vector3) => out.copy(local).applyMatrix4(machine.matrix);

  let jiggle = 0;
  function writePile() {
    const { tops, bots, pos, quat } = built;
    for (let i = 0; i < pos.length; i++) {
      const a = jiggle * (0.5 + ((i * 7) % 5) * 0.2);
      _v.copy(pos[i]);
      if (a > 0) {
        _v.x += Math.sin(time * 31 + i) * 0.02 * a;
        _v.y += Math.abs(Math.sin(time * 23 + i * 1.7)) * 0.035 * a;
        _v.z += Math.cos(time * 27 + i * 0.3) * 0.02 * a;
        _axis.set(Math.sin(i), 1, Math.cos(i)).normalize();
        _q.setFromAxisAngle(_axis, Math.sin(time * 19 + i) * 0.5 * a).multiply(quat[i]);
      } else _q.copy(quat[i]);
      _m.compose(_v, _q, one);
      tops.setMatrixAt(i, _m);
      bots.setMatrixAt(i, _m);
    }
    tops.instanceMatrix.needsUpdate = true;
    bots.instanceMatrix.needsUpdate = true;
  }

  let time = 0;
  let done = false;
  let idle = true;
  let scanMode = false;
  let frameClock = 0;
  let frameIdx = 0;
  let sparkleOn = false;
  const lidEuler = new THREE.Euler();
  const bulbOn = new THREE.Color(f.c.glow);
  const bulbOff = new THREE.Color('#5a4a6a');
  const trail = { count: 1, color: [f.c.glow, '#ffffff', '#ffe066'], speed: 0.3, up: 0.6, size: 0.035, life: 0.8, gravity: 0.2 };

  // capsu, the capsule buddy, pops up between the machine and the prize to cheer
  const capsuAt = new THREE.Vector3(-0.18, 0, 0.8);
  const capsu = new Buddy(CAST.capsu, 72);
  capsu.billboard = true;
  capsu.position.copy(capsuAt);
  capsu.visible = false;
  root.add(capsu);
  let capsuNext = 4;
  function popCapsu(animated: boolean) {
    capsu.position.copy(capsuAt);
    capsu.visible = !scanMode;
    if (!animated) {
      capsu.scale.setScalar(1);
      return;
    }
    capsu.scale.setScalar(0.01);
    void tweens.tween(0.5, (t) => {
      capsu.scale.setScalar(Math.max(0.01, ease.outBack(t)));
      capsu.position.y = capsuAt.y + Math.sin(t * Math.PI) * 0.35;
    }, ease.linear, tg).then(() => void capsu.cheer());
  }

  /** Back to the untouched machine (so reveal() can replay after finish()). */
  function resetIdle() {
    machine.position.x = -1.05;
    coin.visible = true;
    coin.position.copy(coinRestLocal);
    coin.rotation.set(-Math.PI / 2, 0, 0.4);
    crank.rotation.z = 0;
    jiggle = 0;
    writePile();
    cap.group.add(cap.top);
    cap.top.position.set(0, 0, 0);
    cap.top.rotation.set(0, 0, 0);
    cap.group.visible = false;
    cap.group.position.set(0, 0, 0);
    cap.group.quaternion.identity();
    cap.group.scale.set(1, 1, 1);
    plaque.visible = false;
    plaque.scale.setScalar(1);
    plaque.position.set(target.x, restY, target.z);
    plaque.rotation.set(0, restYaw, 0);
    beam.visible = false;
    beamMat.opacity = 0;
    sparkleOn = false;
    capsu.visible = false;
    done = false;
  }

  function placeFinal() {
    coin.visible = false;
    crank.rotation.z = 0;
    jiggle = 0;
    writePile();
    cap.group.visible = true;
    cap.group.position.copy(target);
    cap.group.quaternion.identity();
    cap.group.add(cap.top);
    cap.top.position.set(0, 0, 0);
    cap.top.rotation.set(0, 0, 0);
    // the lid rests upside down beside the cup
    root.attach(cap.top);
    cap.top.position.copy(lidRest).setY(CAP_R);
    cap.top.rotation.set(Math.PI, 0, 0.3);
    plaque.visible = true;
    plaque.scale.setScalar(1);
    plaque.position.set(target.x, restY, target.z);
    plaque.rotation.set(0, restYaw, 0);
    beam.visible = false;
    beamMat.opacity = 0;
    sparkleOn = false;
    popCapsu(false);
  }

  async function reveal() {
    if (done || plaque.visible || cap.group.visible) resetIdle();
    idle = false;
    done = false;
    // 1) the coin hops into the slot
    audio.play('blip');
    const c0 = coin.position.clone();
    const slotAbove = SLOT_POS.clone().setY(SLOT_POS.y + 0.34);
    await tweens.tween(0.55, (t) => {
      coin.position.lerpVectors(c0, slotAbove, t);
      coin.position.y += Math.sin(t * Math.PI) * 0.35;
      coin.rotation.set(-Math.PI / 2 + t * (Math.PI / 2 + Math.PI * 4), 0, 0.4 * (1 - t));
    }, ease.outQuad, tg);
    coin.rotation.set(0, 0, 0);
    await tweens.tween(0.28, (t) => {
      coin.position.set(SLOT_POS.x, slotAbove.y - t * 0.46, SLOT_POS.z);
    }, ease.inQuad, tg);
    coin.visible = false;
    audio.play('coin');
    await tweens.wait(0.15, tg);

    // 2) turn the crank
    let clicks = 0;
    await tweens.tween(1.35, (t) => {
      crank.rotation.z = -t * Math.PI * 2;
      jiggle = Math.sin(t * Math.PI);
      machine.position.x = -1.05 + Math.sin(t * Math.PI * 14) * 0.006 * jiggle;
      if (t * 5 > clicks + 1) {
        clicks++;
        audio.play('clack', { rate: 0.7 });
      }
    }, ease.inOutCubic, tg);
    jiggle = 0;
    machine.position.x = -1.05;
    writePile();
    audio.play('pop', { rate: 0.55 });

    // 3) the capsule rolls out of the chute and across the counter
    cap.group.visible = true;
    const p0 = toRoot(new THREE.Vector3(0, CHUTE_Y, MACHINE.front - CAP_R), new THREE.Vector3());
    const p1 = toRoot(new THREE.Vector3(0, CHUTE_Y, MACHINE.front + 0.08 + CAP_R), new THREE.Vector3());
    const p2 = new THREE.Vector3(p1.x + 0.12, CAP_R, p1.z + 0.22);
    const q0 = new THREE.Quaternion();
    cap.group.quaternion.copy(q0);
    const rollAlong = (from: THREE.Vector3, to: THREE.Vector3, t: number, baseQ: THREE.Quaternion) => {
      cap.group.position.lerpVectors(from, to, t);
      _v2.subVectors(to, from);
      const d = _v2.length() * t;
      _axis.set(_v2.z, 0, -_v2.x).normalize();
      _q.setFromAxisAngle(_axis, d / CAP_R);
      cap.group.quaternion.copy(_q).multiply(baseQ);
    };
    await tweens.tween(0.4, (t) => rollAlong(p0, p1, t, q0), ease.inQuad, tg);
    const q1 = cap.group.quaternion.clone();
    audio.play('clack');
    await tweens.tween(0.3, (t) => {
      rollAlong(p1, p2, t, q1);
      cap.group.position.y = CAP_R + (p1.y - CAP_R) * (1 - t) + Math.sin(t * Math.PI) * 0.12;
    }, ease.linear, tg);
    audio.play('clack', { rate: 1.2 });
    const q2 = cap.group.quaternion.clone();
    await tweens.tween(1.0, (t) => {
      rollAlong(p2, target, t, q2);
      if (Math.random() < 0.08) audio.play('clack', { rate: 1.4, minGap: 0.12 });
    }, ease.outQuad, tg);
    // settle upright with a wobble
    const q3 = cap.group.quaternion.clone();
    await tweens.tween(0.5, (t) => {
      cap.group.quaternion.slerpQuaternions(q3, _q.identity(), t);
      cap.group.rotateZ(Math.sin(t * Math.PI * 3) * 0.25 * (1 - t));
    }, ease.outCubic, tg);
    cap.group.quaternion.identity();

    // 4) shake, shake... POP!
    await tweens.tween(0.6, (t) => {
      cap.group.rotation.z = Math.sin(t * Math.PI * 8) * 0.18 * t;
      cap.group.scale.set(1 + t * 0.12, 1 - t * 0.1, 1 + t * 0.12);
      if (Math.random() < 0.15) audio.play('clack', { rate: 1.6, minGap: 0.1 });
    }, ease.inQuad, tg);
    cap.group.rotation.z = 0;
    cap.group.scale.set(1, 1, 1);
    audio.play('pop');
    audio.play('crack');
    root.attach(cap.top);
    const lidFrom = cap.top.position.clone();
    confetti.burst(_v.copy(target).setY(CAP_R + 0.1), { count: 60, color: [f.c.cap, f.c.glow, '#ffffff', '#ffd23f', '#ff5d8f', '#4cc9f0'], speed: 2.0, up: 3.4, size: 0.045, life: 1.3 });
    void tweens.tween(0.8, (t) => {
      cap.top.position.set(lidFrom.x + (lidRest.x - lidFrom.x) * t, lidFrom.y + Math.sin(t * Math.PI) * 0.9 + (CAP_R - lidFrom.y) * t, lidFrom.z + (lidRest.z - lidFrom.z) * t);
      lidEuler.set(t * Math.PI, t * 2.5, 0.3 * t);
      cap.top.rotation.copy(lidEuler);
    }, ease.linear, tg).then(() => audio.play('clack', { rate: 0.9 }));
    // light pillar
    beam.visible = true;
    void tweens.tween(0.35, (t) => (beamMat.opacity = 0.45 * t), ease.outQuad, tg);

    // 5) the plaque rises out of the cup, spinning, and turns to face you
    plaque.visible = true;
    sparkleOn = true;
    audio.play('whoosh');
    await tweens.tween(1.6, (t) => {
      const s = 0.12 + 0.88 * t;
      plaque.scale.setScalar(s);
      plaque.position.set(target.x, CAP_R + 0.1 + (restY - CAP_R - 0.1) * t, target.z);
      plaque.rotation.y = restYaw + (1 - t) * Math.PI * 6;
    }, ease.outCubic, tg);
    plaque.rotation.y = restYaw;
    sparkleOn = false;
    audio.play('tada');
    popCapsu(true);
    sparks.burst(_v.set(target.x, restY, target.z + 0.1), { count: 50, color: [f.c.glow, '#ffffff', '#ffe066'], speed: 1.8, up: 1.4, size: 0.04, life: 1.1, gravity: 1.5 });
    await tweens.tween(0.9, (t) => (beamMat.opacity = 0.45 * (1 - t)), ease.inQuad, tg);
    beam.visible = false;
    done = true;
  }

  function finish() {
    tweens.cancel(tg);
    idle = false;
    machine.position.x = -1.05;
    placeFinal();
    done = true;
  }

  writePile();

  return {
    root,
    reveal,
    finish,
    actionLabel: 'Turn the crank!',
    hero: { target: new THREE.Vector3(-0.12, 0.95, 0.1), distance: 4.5, yaw: 0.05, pitch: 0.27 },
    // the prize-card window on the machine front, under the logo band
    label: { object: machine, position: new THREE.Vector3(0, MACHINE.panel.y + MACHINE.panel.h / 2, MACHINE.front + 0.02), size: [0.54, 0.25] },
    update(dt, _time, camera) {
      time += dt;
      capsu.update(dt, camera);
      if (done && !scanMode && capsu.visible) {
        capsuNext -= dt;
        if (capsuNext < 0) {
          capsuNext = 4 + Math.random() * 3;
          void (Math.random() < 0.5 ? capsu.wave() : capsu.hop());
        }
      }
      sparks.update(dt);
      confetti.update(dt);
      if (jiggle > 0) writePile();
      frameClock += dt;
      if (frameClock > 0.11) {
        frameClock = 0;
        frameIdx = (frameIdx + 1) % FRAMES;
        frameMat.map = frameTex[frameIdx];
      }
      (built.bulb.material as THREE.MeshBasicMaterial).color.copy(Math.sin(time * 5) > 0 ? bulbOn : bulbOff);
      if (sparkleOn && Math.random() < 0.7) {
        _v.set(target.x + (Math.random() - 0.5) * 0.7, plaque.position.y + (Math.random() - 0.5) * 1.1, target.z + (Math.random() - 0.5) * 0.4);
        sparks.burst(_v, trail);
      }
      if (done) {
        if (scanMode) {
          plaque.position.y = restY;
          plaque.rotation.y = restYaw;
        } else {
          plaque.position.y = restY + Math.sin(time * 1.8) * 0.03;
          plaque.rotation.y = restYaw + Math.sin(time * 0.9) * 0.06;
        }
      } else if (idle) {
        // the crank twitches invitingly now and then
        const k = time % 3.2;
        crank.rotation.z = k < 0.5 ? Math.sin((k / 0.5) * Math.PI * 2) * 0.12 : 0;
      }
    },
    focusView() {
      plaque.position.y = restY;
      plaque.rotation.y = restYaw;
      plaque.updateMatrix();
      plaque.updateWorldMatrix(true, false);
      const center = QR_LOCAL.clone().applyMatrix4(plaque.matrixWorld);
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(plaque.matrixWorld);
      const up = new THREE.Vector3(0, 1, 0).transformDirection(plaque.matrixWorld);
      return { center, normal, size: QR_SIZE, up };
    },
    setScanMode(on) {
      scanMode = on;
      capsu.visible = done && !on;
      if (on && !done) finish();
    },
    dispose() {
      for (const t of frameTex) t.dispose();
      sparks.mesh.geometry.dispose();
      confetti.mesh.geometry.dispose();
    },
  };
}

function poster(ctx: ProductContext) {
  const { art, qrX, qrY, qrSize } = gachaPosterArt(ctx.flavor);
  return composePoster(art, posterScale(art.w), { qr: ctx.qr, x: qrX, y: qrY, size: qrSize, dark: INK, light: '#ffffff', quiet: 2 }, { label: ctx.label, product: 'QR Gacha ' + ctx.flavor.name, accent: RED });
}

export const gacha: ProductDef = {
  id: 'gacha',
  name: 'QR Gacha',
  tagline: 'What will you get?',
  reveal: 'Drop a coin, turn the crank: a capsule pops out with a random rare finish.',
  section: 'counter',
  price: 120,
  badge: 'RARE',
  flavors: GACHA_FLAVORS,
  shelfSize: [0.24, 0.44],
  shelfModel(f) {
    const s = 0.205;
    const g = new THREE.Group();
    const m = buildMachine(f, s);
    g.add(m.group);
    const crank = crankModel();
    crank.scale.setScalar(s);
    crank.position.copy(CRANK_POS).multiplyScalar(s);
    g.add(crank);
    return withMipmaps(g);
  },
  createShowcase,
  poster,
};
