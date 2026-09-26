import * as THREE from 'three';
import { Painter, shade } from '../../engine/Painter';
import { toonGradient } from '../../engine/voxel';
import { Kit } from '../../store/kit';
import { Buddy } from '../../art/buddy';
import { CAST } from '../../art/cast';
import { ease } from '../../engine/tween';
import { audio } from '../../engine/audio';
import { LAYER_NO_OUTLINE } from '../../engine/PixelRenderer';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import type { PixelArt } from '../../qr/pixelCodec';
import { atlasBox } from '../common/box';
import { canvasTexture, qrDecal } from '../common/qrLayout';
import { Particles } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import { INK, TAPE_FLAVORS, TAPE_TOP, TV, VCR, crtFrame, defaultFlipbook, glassArt, noiseFrame, sleeveCover, sleeveSpine, tapeFlap, tapeSpine, tapeTop, tvBrand, vcrDisplay, vcrLabel } from './art';
import { flipbookPosterArt } from './poster';

const VCR_H = VCR.h;
const VCR_FRONT = VCR.front;
/** The TV stands on the VCR, its front a little behind the VCR's. */
const TV_Z = VCR_FRONT - 0.04 - TV.front;
const SCR_W = TV.scr.w;
const SCR_H = TV.scr.h;
/** Screen centre in TV-local space (just in front of the bezel). */
const SCR_C = new THREE.Vector3(TV.scr.x, TV.scr.y, TV.front + 0.022);
const QR_SIZE = 0.76;
const SLOT_C = new THREE.Vector3(VCR.slot.x, VCR.slot.y, VCR_FRONT);
const TAPE = { w: 0.78, h: 0.105, d: 0.43 };
const SCREEN_LIGHT_HEX = '#eef7ff';
const SCREEN_LIGHT = new THREE.Color(SCREEN_LIGHT_HEX);
const TPX = TAPE.w / TAPE_TOP.w;

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

function titleOf(art: PixelArt | null) {
  return (art?.caption || 'My Flipbook').trim() || 'My Flipbook';
}

function tapeModel(f: Flavor, title: string) {
  const shell = solid(f.c.shell);
  return atlasBox(TAPE.w, TAPE.h, TAPE.d, { px: shell, nx: shell, py: tapeTop(f, title).canvas, ny: solid(shade(f.c.shell, -0.1)), pz: tapeSpine(f, title).canvas, nz: tapeFlap(f).canvas });
}

/** A flat rounded rectangle facing +Z, with 0..1 UVs across it. */
function roundedPlane(w: number, h: number, r: number) {
  const x = -w / 2;
  const y = -h / 2;
  const sh = new THREE.Shape();
  sh.moveTo(x + r, y);
  sh.lineTo(x + w - r, y);
  sh.quadraticCurveTo(x + w, y, x + w, y + r);
  sh.lineTo(x + w, y + h - r);
  sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  sh.lineTo(x + r, y + h);
  sh.quadraticCurveTo(x, y + h, x, y + h - r);
  sh.lineTo(x, y + r);
  sh.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(sh, 6);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x) / w, (pos.getY(i) - y) / h);
  return g;
}

/** The little CRT: soft rounded body, CRT hump, dark rounded bezel, chunky knobs, speaker slots, stubby feet. */
function tvModel(f: Flavor) {
  const k = new Kit();
  const { w, h, d, front } = TV;
  const zc = front - d / 2;
  k.rbox(w, h - 0.05, d, 0.16, f.c.tv, 0, 0.05, zc);
  k.rbox(1.1, 0.95, 0.42, 0.16, f.c.tvDark, 0, 0.16, zc - d / 2 - 0.12);
  for (const x of [-0.6, 0.6]) for (const z of [zc - 0.26, zc + 0.26]) k.rbox(0.13, 0.07, 0.13, 0.04, INK, x, 0, z);
  const sc = TV.scr;
  k.rbox(sc.w + 0.12, sc.h + 0.12, 0.04, 0.1, '#3a3a44', sc.x, sc.y - (sc.h + 0.12) / 2, front);
  const knob = (y: number, r: number, depth: number) => {
    k.add(new THREE.CylinderGeometry(r, r, depth, 22), '#2c2c34', TV.knobX, y, front + depth / 2, Math.PI / 2);
    k.add(new THREE.CylinderGeometry(r * 0.74, r * 0.74, 0.012, 22), '#4a4a56', TV.knobX, y, front + depth + 0.004, Math.PI / 2);
    k.rbox(0.022, r * 0.8, 0.01, 0.006, '#ffffff', TV.knobX, y, front + depth + 0.01);
  };
  knob(0.93, 0.12, 0.1);
  knob(0.63, 0.09, 0.07);
  for (let i = 0; i < 4; i++) k.rbox(0.26, 0.026, 0.012, 0.01, shade(f.c.tvDark, -0.25), TV.knobX, 0.17 + i * 0.065, front);
  k.rbox(0.3, 0.06, 0.26, 0.03, '#4a4a54', 0, h - 0.01, 0.075);
  return k.build();
}

/** The VCR: rounded slab with a light lid, the tape slot (frame + dark mouth), buttons and feet. */
function vcrModel(f: Flavor) {
  const k = new Kit();
  const { w, h, d, front } = VCR;
  const zc = front - d / 2;
  k.rbox(w, h - 0.05, d, 0.07, f.c.vcr, 0, 0.05, zc);
  k.rbox(w - 0.05, 0.02, d - 0.05, 0.01, f.c.vcrHi, 0, h - 0.014, zc);
  for (const x of [-0.66, 0.66]) for (const z of [zc - 0.4, zc + 0.4]) k.rbox(0.14, 0.06, 0.14, 0.03, INK, x, 0, z);
  const sl = VCR.slot;
  k.rbox(sl.w + 0.05, sl.h + 0.05, 0.02, 0.02, shade(f.c.vcr, -0.25), sl.x, sl.y - (sl.h + 0.05) / 2, front);
  k.rbox(sl.w, sl.h, 0.02, 0.012, INK, sl.x, sl.y - sl.h / 2, front + 0.004);
  for (let i = 0; i < 5; i++) k.rbox(0.06, 0.04, 0.03, 0.012, i === 1 ? '#ff5d73' : '#9a9aa6', 0.28 + i * 0.1, 0.06, front);
  return k.build();
}

function sleeveModel(f: Flavor, scale = 1) {
  const spine = sleeveSpine(f).canvas;
  const m = atlasBox(0.44 * scale, 0.8 * scale, 0.12 * scale, { px: spine, nx: spine, py: solid(f.c.cover), ny: solid(f.c.cover), pz: sleeveCover(f).canvas, nz: solid(shade(f.c.cover, -0.1)) });
  m.position.y = 0.4 * scale;
  return m;
}

function createShowcase(ctx: ProductContext): ShowcaseItem {
  const { qr, flavor: f, tweens, group: tg } = ctx;
  const root = new THREE.Group();
  const flip = ctx.art && ctx.art.frames.length > 0 ? ctx.art : defaultFlipbook();
  const title = titleOf(ctx.art);

  // --- TV on a VCR
  const set = new THREE.Group();
  set.position.set(-0.5, 0, -0.42);
  set.rotation.y = 0.14;
  set.updateMatrix();
  root.add(set);
  set.add(vcrModel(f));
  const tv = new THREE.Group();
  tv.position.set(0, VCR_H, TV_Z);
  set.add(tv);
  tv.add(tvModel(f));

  // screen: background (static / glow), content (flipbook frames) and the code
  const white = canvasTexture(solid('#ffffff', 2, 2));
  const noise = [0, 1, 2, 3].map((k) => canvasTexture(noiseFrame(k)));
  const frames = flip.frames.map((_, i) => canvasTexture(crtFrame(flip, i)));
  const bgMat = new THREE.MeshBasicMaterial({ map: white, color: '#101014' });
  const bg = new THREE.Mesh(roundedPlane(SCR_W - 0.01, SCR_H - 0.01, 0.1), bgMat);
  bg.position.copy(SCR_C);
  tv.add(bg);
  const picMat = new THREE.MeshBasicMaterial({ map: frames[0] });
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(QR_SIZE, QR_SIZE), picMat);
  pic.position.copy(SCR_C).add(new THREE.Vector3(0, 0, 0.002));
  pic.visible = false;
  tv.add(pic);
  const decal = qrDecal(qr, QR_SIZE, INK, SCREEN_LIGHT_HEX, 2);
  decal.position.copy(SCR_C).add(new THREE.Vector3(0, 0, 0.003));
  decal.visible = false;
  tv.add(decal);
  const glass = new THREE.Mesh(roundedPlane(SCR_W, SCR_H, 0.1), new THREE.MeshBasicMaterial({ map: glassArt().texture(), transparent: true, depthWrite: false }));
  glass.position.copy(SCR_C).add(new THREE.Vector3(0, 0, 0.035));
  glass.layers.set(LAYER_NO_OUTLINE);
  tv.add(glass);
  const brand = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.07), new THREE.MeshToonMaterial({ map: tvBrand(f).texture(), gradientMap: toonGradient() }));
  brand.position.set(SCR_C.x, 0.1, TV.front + 0.003);
  tv.add(brand);
  const ledMat = new THREE.MeshBasicMaterial({ color: '#5a1f2a' });
  const led = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), ledMat);
  led.position.set(TV.knobX, 1.12, TV.front + 0.003);
  tv.add(led);
  // rabbit-ear antenna
  const rodMat = new THREE.MeshToonMaterial({ color: '#c9ced6', gradientMap: toonGradient() });
  const tipMat = new THREE.MeshToonMaterial({ color: f.c.accent, gradientMap: toonGradient() });
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, TV.h + 0.04, 0.075);
    pivot.rotation.set(-0.2, 0, side * 0.55);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.62, 6), rodMat);
    rod.position.y = 0.31;
    rod.castShadow = true;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), tipMat);
    tip.position.y = 0.63;
    pivot.add(rod, tip);
    tv.add(pivot);
  }

  // VCR slot flap + display
  const flapPivot = new THREE.Group();
  flapPivot.position.set(SLOT_C.x, VCR.slot.y + VCR.slot.h / 2, VCR_FRONT + 0.02);
  const flapArt = new Painter(34, 6).clear(shade(f.c.vcr, f.id === 'pastel' ? -0.08 : 0.1));
  flapArt.rect(0, 0, 34, 1, shade(f.c.vcr, f.id === 'pastel' ? 0.05 : 0.25)).rect(2, 3, 30, 1, shade(f.c.vcr, -0.2));
  const flap = new THREE.Mesh(new THREE.BoxGeometry(VCR.slot.w, VCR.slot.h, 0.008), new THREE.MeshToonMaterial({ map: flapArt.texture(), gradientMap: toonGradient() }));
  flap.position.y = -VCR.slot.h / 2;
  flapPivot.add(flap);
  set.add(flapPivot);
  const displayTex = {
    clock: vcrDisplay('12:00').texture(),
    blank: vcrDisplay('', false).texture(),
    play: vcrDisplay('PLAY >').texture(),
  };
  const displayMat = new THREE.MeshBasicMaterial({ map: displayTex.clock });
  const display = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.09), displayMat);
  display.position.set(0.475, 0.175, VCR_FRONT + 0.003);
  set.add(display);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.09), new THREE.MeshToonMaterial({ map: vcrLabel(f).texture(), gradientMap: toonGradient() }));
  strip.position.set(0, 0.3, VCR_FRONT + 0.003);
  set.add(strip);

  // --- sleeve + tape
  const sleeve = sleeveModel(f);
  const sleeveGroup = new THREE.Group();
  sleeveGroup.add(sleeve);
  sleeveGroup.position.set(1.62, 0, -0.32);
  sleeveGroup.rotation.y = -0.42;
  root.add(sleeveGroup);
  const tape = new THREE.Group();
  tape.add(tapeModel(f, title));
  const label = qrDecal(qr, TAPE_TOP.qrSize * TPX, INK, '#fbfaf5', 1);
  label.rotation.x = -Math.PI / 2;
  label.position.set((TAPE_TOP.qrX + TAPE_TOP.qrSize / 2) * TPX - TAPE.w / 2, TAPE.h / 2 + 0.002, (TAPE_TOP.qrY + TAPE_TOP.qrSize / 2) * TPX - TAPE.d / 2);
  tape.add(label);
  const tapeRest = new THREE.Vector3(0.78, TAPE.h / 2, 0.66);
  const tapeRestQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.28, 0));
  tape.position.copy(tapeRest);
  tape.quaternion.copy(tapeRestQ);
  root.add(tape);

  const sparks = new Particles(160, { glow: true });
  root.add(sparks.mesh);

  // --- screen state machine (driven from update, no allocations)
  type Mode = 'off' | 'warm' | 'static' | 'play' | 'qr';
  let mode: Mode = 'off';
  let modeTime = 0;
  let frameIdx = 0;
  let frameClock = 0;
  let noiseIdx = 0;
  let scanMode = false;
  let blinkClock = 0;
  let displayState: 'clock' | 'play' = 'clock';
  const frameDelay = Math.max(0.06, (flip.delay || 140) / 1000);
  const setMode = (m: Mode) => {
    mode = m;
    modeTime = 0;
    pic.visible = m === 'play';
    decal.visible = m === 'qr';
    bg.scale.set(1, 1, 1);
    if (m === 'off') {
      bgMat.map = white;
      bgMat.color.set('#101014');
    } else if (m === 'warm') {
      bgMat.map = white;
      bgMat.color.set('#ffffff');
    } else if (m === 'static') {
      bgMat.map = noise[0];
      bgMat.color.set('#ffffff');
    } else if (m === 'play') {
      bgMat.map = white;
      bgMat.color.set('#0b0f1e');
      frameIdx = 0;
      frameClock = 0;
      picMat.map = frames[0];
    } else {
      bgMat.map = white;
      bgMat.color.copy(SCREEN_LIGHT);
    }
  };
  setMode('off');

  let time = 0;
  let done = false;
  let idle = true;
  const _v = new THREE.Vector3();

  // tapey, the cassette buddy, pops up in front of the set once the code is on screen
  const tapeyAt = new THREE.Vector3(0.92, 0, 0.88);
  const tapey = new Buddy(CAST.tapey, 72);
  tapey.billboard = true;
  tapey.position.copy(tapeyAt);
  tapey.visible = false;
  root.add(tapey);
  let tapeyNext = 4;
  function popTapey(animated: boolean) {
    tapey.position.copy(tapeyAt);
    tapey.visible = !scanMode;
    if (!animated) {
      tapey.scale.setScalar(1);
      return;
    }
    tapey.scale.setScalar(0.01);
    void tweens.tween(0.5, (t) => {
      tapey.scale.setScalar(Math.max(0.01, ease.outBack(t)));
      tapey.position.y = tapeyAt.y + Math.sin(t * Math.PI) * 0.35;
    }, ease.linear, tg).then(() => void tapey.cheer());
  }

  /** Tape back on the table, TV off (so reveal() can replay after finish()). */
  function resetIdle() {
    root.attach(tape);
    tape.visible = true;
    tape.position.copy(tapeRest);
    tape.quaternion.copy(tapeRestQ);
    flapPivot.rotation.x = 0;
    displayState = 'clock';
    displayMat.map = displayTex.clock;
    ledMat.color.set('#5a1f2a');
    setMode('off');
    tapey.visible = false;
    done = false;
  }

  function finalState() {
    tv.scale.set(1, 1, 1);
    tape.visible = false;
    flapPivot.rotation.x = 0;
    displayState = 'play';
    displayMat.map = displayTex.play;
    ledMat.color.set('#5cff9a');
    setMode('qr');
    popTapey(false);
  }

  async function reveal() {
    if (done || !tape.visible || mode !== 'off') resetIdle();
    idle = false;
    done = false;
    // pick the tape up and line it up with the slot
    audio.play('whoosh');
    const p0 = tape.position.clone();
    await tweens.tween(0.35, (t) => {
      tape.position.set(p0.x, p0.y + t * 0.35, p0.z);
      tape.rotation.z = Math.sin(t * Math.PI) * 0.15;
    }, ease.outQuad, tg);
    set.attach(tape);
    const a = tape.position.clone();
    const qa = tape.quaternion.clone();
    const front = new THREE.Vector3(SLOT_C.x, SLOT_C.y, VCR_FRONT + TAPE.d / 2 + 0.06);
    const qb = new THREE.Quaternion();
    await tweens.tween(0.65, (t) => {
      tape.position.lerpVectors(a, front, t);
      tape.position.y += Math.sin(t * Math.PI) * 0.18;
      tape.quaternion.slerpQuaternions(qa, qb, t);
    }, ease.inOutCubic, tg);
    // push it in: the flap swings up
    audio.play('clack', { rate: 0.8 });
    const inside = new THREE.Vector3(SLOT_C.x, SLOT_C.y, VCR_FRONT - TAPE.d / 2 - 0.08);
    await tweens.tween(0.55, (t) => {
      tape.position.lerpVectors(front, inside, t);
      flapPivot.rotation.x = Math.min(1, t * 3) * 1.45;
    }, ease.inQuad, tg);
    tape.visible = false;
    audio.play('clack', { rate: 0.6 });
    await tweens.tween(0.2, (t) => (flapPivot.rotation.x = 1.45 * (1 - t)), ease.outQuad, tg);
    displayState = 'play';
    displayMat.map = displayTex.play;
    audio.play('blip');
    await tweens.wait(0.25, tg);

    // the TV warms up: a bright line, then snow
    ledMat.color.set('#5cff9a');
    audio.play('zap');
    setMode('warm');
    await tweens.tween(0.3, (t) => bg.scale.set(0.3 + 0.7 * t, Math.max(0.02, t * t), 1), ease.outQuad, tg);
    setMode('static');
    audio.play('fizz');
    await tweens.wait(0.8, tg);

    // play the flipbook for a couple of loops
    setMode('play');
    const loop = frameDelay * flip.frames.length;
    const playTime = THREE.MathUtils.clamp(loop * 2, 2.4, 4.2);
    await tweens.wait(playTime, tg);

    // snow again, then the code
    setMode('static');
    audio.play('fizz');
    await tweens.wait(0.35, tg);
    setMode('qr');
    audio.play('ding');
    audio.play('tada');
    popTapey(true);
    void tweens.tween(0.45, (t) => {
      const s = Math.sin(t * Math.PI * 2) * (1 - t);
      tv.scale.set(1 + s * 0.035, 1 - s * 0.04, 1 + s * 0.035);
    }, ease.linear, tg).then(() => tv.scale.set(1, 1, 1));
    tv.updateMatrixWorld(true);
    for (const [dx, dy] of [[-0.55, 0.45], [0.55, 0.45], [-0.55, -0.4], [0.55, -0.4]] as const) {
      _v.set(SCR_C.x + dx, SCR_C.y + dy, SCR_C.z + 0.15).applyMatrix4(tv.matrixWorld);
      sparks.burst(_v, { count: 10, color: ['#ffffff', f.c.accent, '#ffe066'], speed: 0.9, up: 1.2, size: 0.035, life: 0.9, gravity: 1.2 });
    }
    done = true;
  }

  function finish() {
    tweens.cancel(tg);
    idle = false;
    finalState();
    done = true;
  }

  return {
    root,
    reveal,
    finish,
    actionLabel: 'Press play!',
    hero: { target: new THREE.Vector3(0.12, 0.8, 0.05), distance: 5.0, yaw: 0.05, pitch: 0.28 },
    // stuck on the TV screen like a sticky note: that's where the flipbook will play
    label: { object: tv, position: new THREE.Vector3(SCR_C.x, SCR_C.y, SCR_C.z + 0.04), size: [0.7, 0.42] },
    update(dt, _time, camera) {
      time += dt;
      tapey.update(dt, camera);
      if (done && !scanMode && tapey.visible) {
        tapeyNext -= dt;
        if (tapeyNext < 0) {
          tapeyNext = 4 + Math.random() * 3;
          void (Math.random() < 0.5 ? tapey.wave() : tapey.hop());
        }
      }
      modeTime += dt;
      sparks.update(dt);
      if (mode === 'static') {
        noiseIdx = (noiseIdx + 1) % noise.length;
        bgMat.map = noise[noiseIdx];
      } else if (mode === 'play') {
        frameClock += dt;
        if (frameClock >= frameDelay) {
          frameClock -= frameDelay;
          frameIdx = (frameIdx + 1) % frames.length;
          picMat.map = frames[frameIdx];
        }
        const flicker = 0.93 + Math.sin(time * 37) * 0.03 + (Math.sin(time * 5.3) > 0.97 ? -0.08 : 0);
        picMat.color.setScalar(flicker);
      } else if (mode === 'qr') {
        // same light as the code's quiet zone, with a faint CRT shimmer outside scan mode
        const k = scanMode ? 1 : 0.985 + Math.sin(time * 29) * 0.012;
        bgMat.color.copy(SCREEN_LIGHT).multiplyScalar(k);
      }
      if (displayState === 'clock') {
        blinkClock += dt;
        if (blinkClock > 0.5) {
          blinkClock = 0;
          displayMat.map = displayMat.map === displayTex.clock ? displayTex.blank : displayTex.clock;
        }
      }
      if (idle) tape.position.y = TAPE.h / 2 + Math.max(0, Math.sin(time * 2.4)) * 0.03;
    },
    focusView() {
      tv.updateWorldMatrix(true, false);
      const center = SCR_C.clone().add(new THREE.Vector3(0, 0, 0.003)).applyMatrix4(tv.matrixWorld);
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(tv.matrixWorld);
      const up = new THREE.Vector3(0, 1, 0).transformDirection(tv.matrixWorld);
      return { center, normal, size: QR_SIZE, up };
    },
    setScanMode(on) {
      scanMode = on;
      tapey.visible = done && !on;
      glass.visible = !on;
      if (on && !done) finish();
    },
    dispose() {
      white.dispose();
      for (const t of noise) t.dispose();
      for (const t of frames) t.dispose();
      sparks.mesh.geometry.dispose();
    },
  };
}

function poster(ctx: ProductContext) {
  const flip = ctx.art && ctx.art.frames.length > 0 ? ctx.art : defaultFlipbook();
  const { art, qrX, qrY, qrSize } = flipbookPosterArt(ctx.flavor, flip, titleOf(ctx.art));
  return composePoster(art, posterScale(art.w), { qr: ctx.qr, x: qrX, y: qrY, size: qrSize, dark: INK, light: SCREEN_LIGHT_HEX, quiet: 2 }, { label: ctx.label, product: 'Flipbook Tape', accent: shade(ctx.flavor.c.accent, -0.1) });
}

export const flipbookTape: ProductDef = {
  id: 'flipbook-tape',
  name: 'Flipbook Tape',
  tagline: 'Be kind, rewind.',
  reveal: 'Insert the tape: your flipbook plays on a tiny TV, then the screen turns into your code.',
  section: 'media',
  price: 0,
  preferredMode: 'video',
  flavors: TAPE_FLAVORS,
  shelfSize: [0.26, 0.42],
  shelfModel(f) {
    const s = 0.5;
    const g = new THREE.Group();
    g.add(sleeveModel(f, s));
    return withMipmaps(g);
  },
  createShowcase,
  poster,
};
