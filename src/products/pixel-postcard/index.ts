import * as THREE from 'three';
import { Painter, shade } from '../../engine/Painter';
import { voxelMesh, toonGradient } from '../../engine/voxel';
import { ease } from '../../engine/tween';
import { audio } from '../../engine/audio';
import { LAYER_NO_OUTLINE } from '../../engine/PixelRenderer';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import { atlasBox } from '../common/box';
import { canvasTexture, qrDecal } from '../common/qrLayout';
import { Particles } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import { CAM, INK, PHOTO, POSTCARD_FLAVORS, cameraLabel, cameraVoxels, drawCaption, fitCaption, flashBurst, photoBack, photoFront, pictureCanvas } from './art';
import { postcardPosterArt } from './poster';

const S = CAM.scale;
const cvx = (x: number) => (x - CAM.sx / 2) * S;
const cvz = (z: number) => (z - CAM.sz / 2) * S;
const CAM_TOP = CAM.sy * S;
const FRONT_Z = cvz(16);
const SLOT_Z = cvz(CAM.slotZ + 0.5);
const PHOTO_W = 1.6;
const PX = PHOTO_W / PHOTO.w;
const PHOTO_H = PHOTO.h * PX;
const PHOTO_D = 0.012;
/** Texture pixel (u, v) on the photo → local position (photo centred, facing +Z). */
const pxX = (u: number) => u * PX - PHOTO_W / 2;
const pxY = (v: number) => PHOTO_H / 2 - v * PX;
const QR_SIZE = PHOTO.qrSize * PX;
const QR_LOCAL = new THREE.Vector3(pxX(PHOTO.qrX + PHOTO.qrSize / 2), pxY(PHOTO.qrY + PHOTO.qrSize / 2), PHOTO_D / 2 + 0.002);
const DARK = new THREE.Color('#2a1d18');
const SEPIA = new THREE.Color('#b8906c');
const WHITE = new THREE.Color('#ffffff');

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

function cameraModel(f: Flavor, scale = 1) {
  const group = new THREE.Group();
  group.add(voxelMesh(cameraVoxels(f), { scale: S * scale, anchor: 'bottom-center' }));
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.34 * scale, 0.19125 * scale), new THREE.MeshToonMaterial({ map: cameraLabel(f).texture(), gradientMap: toonGradient() }));
  label.position.set(cvx(30.9) * scale, 3.6 * S * scale, (FRONT_Z + 0.003) * scale);
  group.add(label);
  const flashMat = new THREE.MeshBasicMaterial({ color: '#d8d9e4' });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(7 * S * scale, 3.6 * S * scale), flashMat);
  flash.position.set(cvx(5.5) * scale, 17 * S * scale, (FRONT_Z + 0.003) * scale);
  group.add(flash);
  // ridges on the flash window
  const ridgeMat = new THREE.MeshBasicMaterial({ color: '#b9bccb' });
  for (let i = 0; i < 3; i++) {
    const ridge = new THREE.Mesh(new THREE.PlaneGeometry(7 * S * scale, 0.006 * scale), ridgeMat);
    ridge.position.set(cvx(5.5) * scale, (15.8 + i * 1.2) * S * scale, (FRONT_Z + 0.004) * scale);
    group.add(ridge);
  }
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.075 * scale, 0.075 * scale, 0.06 * scale, 14), new THREE.MeshToonMaterial({ color: f.c.accent, gradientMap: toonGradient() }));
  button.rotation.x = Math.PI / 2;
  button.position.set(cvx(31) * scale, 9.5 * S * scale, (FRONT_Z + 0.03) * scale);
  button.castShadow = true;
  group.add(button);
  return { group, flashMat, flash, button, ridgeMat };
}

function photoModel(f: Flavor) {
  const group = new THREE.Group();
  const paper = solid(f.c.paper);
  const body = atlasBox(PHOTO_W, PHOTO_H, PHOTO_D, { px: paper, nx: paper, py: paper, ny: paper, pz: photoFront(f).canvas, nz: photoBack(f).canvas });
  group.add(body);
  return { group, body };
}

function createShowcase(ctx: ProductContext): ShowcaseItem {
  const { qr, flavor: f, tweens, group: tg, art } = ctx;
  const root = new THREE.Group();

  // --- camera
  const cam = cameraModel(f);
  const camera = cam.group;
  camera.position.set(-0.3, 0, -0.55);
  camera.rotation.y = 0.12;
  camera.updateMatrix();
  root.add(camera);

  // --- the photo: paper + picture (develops) + code (develops) + handwritten caption
  const photo = photoModel(f);
  const card = photo.group;
  const picTex = canvasTexture(pictureCanvas(art));
  const picMat = new THREE.MeshBasicMaterial({ map: picTex, color: DARK.clone() });
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(PHOTO.picSize * PX, PHOTO.picSize * PX), picMat);
  pic.position.set(pxX(PHOTO.picX + PHOTO.picSize / 2), pxY(PHOTO.picY + PHOTO.picSize / 2), PHOTO_D / 2 + 0.001);
  card.add(pic);
  const decal = qrDecal(qr, QR_SIZE, INK, '#ffffff', 2);
  const decalMat = decal.material as THREE.MeshBasicMaterial;
  decalMat.transparent = true;
  decalMat.opacity = 0;
  decal.position.copy(QR_LOCAL);
  card.add(decal);
  const caption = fitCaption(art?.caption ?? '', PHOTO.capW);
  const capPainter = new Painter(PHOTO.capW, PHOTO.capH);
  const capTex = capPainter.texture();
  const capMesh = new THREE.Mesh(new THREE.PlaneGeometry(PHOTO.capW * PX, PHOTO.capH * PX), new THREE.MeshBasicMaterial({ map: capTex, transparent: true, alphaTest: 0.5 }));
  capMesh.position.set(pxX(PHOTO.capX + PHOTO.capW / 2), pxY(PHOTO.capY + PHOTO.capH / 2), PHOTO_D / 2 + 0.001);
  card.add(capMesh);
  let written = 0;
  const writeCaption = (n: number) => {
    if (n === written) return;
    written = n;
    drawCaption(capPainter, caption, n);
    capTex.needsUpdate = true;
  };

  // photo inside the camera, top edge at the slot
  const inSlot = new THREE.Vector3(0, CAM_TOP - PHOTO_H / 2 - 0.02, SLOT_Z);
  const restPos = new THREE.Vector3(0.22, PHOTO_D / 2 + 0.003, 0.64);
  const restQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0.07));
  card.visible = false;
  camera.add(card);
  card.position.copy(inSlot);

  // --- flash effects: starburst, a full-screen white-out and a lingering glow
  const burstMat = new THREE.MeshBasicMaterial({ map: flashBurst().texture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const burst = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), burstMat);
  burst.position.set(cvx(5.5), 17 * S, FRONT_Z + 0.06);
  burst.layers.set(LAYER_NO_OUTLINE);
  burst.visible = false;
  camera.add(burst);
  const whiteMat = new THREE.MeshBasicMaterial({ color: '#fffbea', transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const whiteout = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 10), whiteMat);
  whiteout.renderOrder = 999;
  whiteout.layers.set(LAYER_NO_OUTLINE);
  whiteout.frustumCulled = false;
  whiteout.visible = false;
  root.add(whiteout);

  const sparks = new Particles(160, { glow: true });
  root.add(sparks.mesh);

  const _v = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _c = new THREE.Color();
  let time = 0;
  let done = false;
  let idle = true;

  function develop(t: number) {
    if (t < 0.5) _c.copy(DARK).lerp(SEPIA, t / 0.5);
    else _c.copy(SEPIA).lerp(WHITE, (t - 0.5) / 0.5);
    picMat.color.copy(_c);
    const q = THREE.MathUtils.clamp((t - 0.25) / 0.75, 0, 1);
    decalMat.opacity = q;
  }

  const buttonZ = cam.button.position.z;
  /** Photo back inside the camera, undeveloped (so reveal() can replay after finish()). */
  function resetIdle() {
    camera.add(card);
    card.position.copy(inSlot);
    card.quaternion.identity();
    card.visible = false;
    develop(0);
    decalMat.transparent = true;
    decalMat.needsUpdate = true;
    writeCaption(0);
    cam.flashMat.color.set('#d8d9e4');
    cam.button.position.z = buttonZ;
    burst.visible = whiteout.visible = false;
    camera.rotation.z = 0;
    done = false;
  }

  function landed() {
    root.attach(card);
    card.position.copy(restPos);
    card.quaternion.copy(restQ);
    card.visible = true;
  }

  async function reveal() {
    if (done || card.visible) resetIdle();
    done = false;
    idle = false;
    camera.position.y = 0;
    // wiggle + press the shutter
    await tweens.tween(0.35, (t) => {
      camera.rotation.z = Math.sin(t * Math.PI * 4) * 0.03;
    }, ease.linear, tg);
    camera.rotation.z = 0;
    audio.play('clack');
    const bz = cam.button.position.z;
    await tweens.tween(0.12, (t) => (cam.button.position.z = bz - t * 0.025), ease.outQuad, tg);
    // FLASH!
    audio.play('zap');
    audio.play('pop', { rate: 1.6 });
    cam.flashMat.color.set('#ffffff');
    burst.visible = whiteout.visible = true;
    void tweens.tween(0.12, (t) => (cam.button.position.z = bz - 0.025 * (1 - t)), ease.linear, tg);
    await tweens.tween(0.06, (t) => {
      whiteMat.opacity = 0.9 * t;
      burstMat.opacity = t;
      burst.scale.setScalar(0.3 + t * 0.6);
    }, ease.linear, tg);
    await tweens.tween(0.5, (t) => {
      whiteMat.opacity = 0.9 * (1 - t) * (1 - t);
      burstMat.opacity = 1 - t;
      burst.scale.setScalar(0.9 + t * 0.9);
      burst.rotation.z = t * 0.6;
    }, ease.outQuad, tg);
    burst.visible = whiteout.visible = false;
    await tweens.wait(0.15, tg);
    cam.flashMat.color.set('#d8d9e4');

    // the photo slides out of the top slot (motor whirr)
    card.visible = true;
    const rise = PHOTO_H * 0.74;
    let lastTick = 0;
    await tweens.tween(1.3, (t) => {
      card.position.set(inSlot.x, inSlot.y + rise * t, inSlot.z);
      if (t - lastTick > 0.12) {
        lastTick = t;
        audio.play('pour', { minGap: 0.1 });
      }
    }, ease.linear, tg);
    // pop free and flutter down onto the counter, face up
    audio.play('pop', { rate: 1.2 });
    audio.play('whoosh');
    root.attach(card);
    const p0 = card.position.clone();
    const q0 = card.quaternion.clone();
    await tweens.tween(1.8, (t) => {
      const e = ease.inOutSine(t);
      const decay = 1 - t;
      card.position.lerpVectors(p0, restPos, e);
      card.position.x += Math.sin(t * Math.PI * 3) * 0.3 * decay;
      card.position.y += Math.sin(Math.min(1, t * 1.6) * Math.PI) * 0.2 * decay;
      card.quaternion.slerpQuaternions(q0, restQ, ease.inOutCubic(t));
      _e.set(Math.sin(t * Math.PI * 4) * 0.45 * decay, Math.sin(t * Math.PI * 3 + 1) * 0.35 * decay, Math.sin(t * Math.PI * 2) * 0.25 * decay);
      _q.setFromEuler(_e);
      card.quaternion.multiply(_q);
    }, ease.linear, tg);
    landed();
    audio.play('clack', { rate: 0.7 });
    // develop: dark → sepia → full colour, the code fades in
    await tweens.tween(2.4, (t) => develop(t), ease.inOutSine, tg);
    develop(1);
    decalMat.transparent = false;
    decalMat.needsUpdate = true;
    // someone writes the caption
    const n = caption.length;
    await tweens.tween(Math.min(1.6, 0.35 + n * 0.05), (t) => {
      const k = Math.round(t * n);
      if (k !== written && k % 2 === 0) audio.play('scratch', { minGap: 0.04 });
      writeCaption(k);
    }, ease.linear, tg);
    writeCaption(n);
    audio.play('ding');
    card.updateMatrixWorld(true);
    for (let i = 0; i < 3; i++) {
      _v.copy(QR_LOCAL).applyMatrix4(card.matrixWorld);
      sparks.burst(_v, { count: 14, color: ['#ffffff', '#fff3b0', f.c.accent], speed: 1.2, up: 1.4, size: 0.035, life: 0.9, gravity: 1.5 });
    }
    // the camera does a happy little hop
    await tweens.tween(0.5, (t) => {
      const s = Math.sin(t * Math.PI * 2) * (1 - t);
      camera.position.y = Math.sin(t * Math.PI) * 0.12;
      camera.scale.set(1 + s * 0.04, 1 - s * 0.05, 1 + s * 0.04);
    }, ease.linear, tg);
    camera.position.y = 0;
    camera.scale.set(1, 1, 1);
    done = true;
  }

  function finish() {
    tweens.cancel(tg);
    idle = false;
    camera.rotation.z = 0;
    camera.position.y = 0;
    camera.scale.set(1, 1, 1);
    cam.flashMat.color.set('#d8d9e4');
    burst.visible = whiteout.visible = false;
    landed();
    develop(1);
    decalMat.transparent = false;
    decalMat.needsUpdate = true;
    writeCaption(caption.length);
    done = true;
  }

  return {
    root,
    reveal,
    finish,
    actionLabel: 'Say cheese!',
    hero: { target: new THREE.Vector3(0.0, 0.66, 0.15), distance: 5.0, yaw: 0.05, pitch: 0.36 },
    update(dt) {
      time += dt;
      sparks.update(dt);
      if (idle) {
        // the camera bobs a little, like it's excited to take a picture
        camera.position.y = Math.abs(Math.sin(time * 2.2)) * 0.02;
        camera.rotation.z = Math.sin(time * 1.1) * 0.012;
      } else if (camera.position.y !== 0 && done) camera.position.y = 0;
    },
    focusView() {
      card.updateWorldMatrix(true, false);
      const center = QR_LOCAL.clone().applyMatrix4(card.matrixWorld);
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(card.matrixWorld);
      const up = new THREE.Vector3(0, 1, 0).transformDirection(card.matrixWorld);
      return { center, normal, size: QR_SIZE, up };
    },
    setScanMode(on) {
      // the photo must be fully developed before anyone scans it
      if (on && !done) finish();
    },
    dispose() {
      picTex.dispose();
      capTex.dispose();
      sparks.mesh.geometry.dispose();
    },
  };
}

function poster(ctx: ProductContext) {
  const { art, qrX, qrY, qrSize } = postcardPosterArt(ctx.flavor, ctx.art);
  return composePoster(art, posterScale(art.w), { qr: ctx.qr, x: qrX, y: qrY, size: qrSize, dark: INK, light: '#ffffff', quiet: 2 }, { label: ctx.label, product: 'Pixel Postcard', accent: shade(ctx.flavor.c.accent, -0.1) });
}

export const pixelPostcard: ProductDef = {
  id: 'pixel-postcard',
  name: 'Pixel Postcard',
  tagline: 'Instant film for your pixels.',
  reveal: 'Flash! The photo slides out and develops, with your code printed beside the picture.',
  section: 'media',
  price: 0,
  preferredMode: 'image',
  flavors: POSTCARD_FLAVORS,
  shelfSize: [0.4, 0.3],
  shelfModel(f) {
    const s = 0.21;
    const g = new THREE.Group();
    g.add(cameraModel(f, s).group);
    // a photo peeking out of the slot
    const peek = new THREE.Group();
    const ph = photoModel(f);
    ph.group.scale.setScalar(s);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(PHOTO.picSize * PX * s, PHOTO.picSize * PX * s), new THREE.MeshBasicMaterial({ map: canvasTexture(pictureCanvas(null)) }));
    pic.position.set(pxX(PHOTO.picX + PHOTO.picSize / 2) * s, pxY(PHOTO.picY + PHOTO.picSize / 2) * s, (PHOTO_D / 2 + 0.001) * s);
    peek.add(ph.group, pic);
    peek.position.set(0, (CAM_TOP - PHOTO_H * 0.5 + PHOTO_H * 0.42) * s, SLOT_Z * s);
    g.add(peek);
    return withMipmaps(g);
  },
  createShowcase,
  poster,
};
