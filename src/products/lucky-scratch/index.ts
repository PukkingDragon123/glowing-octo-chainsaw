import * as THREE from 'three';
import { toonGradient, voxelMesh } from '../../engine/voxel';
import { ease } from '../../engine/tween';
import { audio } from '../../engine/audio';
import type { Flavor, ProductContext, ProductDef, ShowcaseItem } from '../types';
import { atlasBox } from '../common/box';
import { qrDecal } from '../common/qrLayout';
import { Particles } from '../common/props';
import { composePoster, posterScale } from '../common/poster';
import { CAT, CARD, INK, SCRATCH_FLAVORS, cardBack, cardEdge, cardFront, catArmVoxels, catVoxels, coinVoxels, foilArt, standVoxels, winSticker } from './art';

const CARD_W = 1.5;
const PX = CARD_W / CARD.w;
const CARD_H = CARD.h * PX;
const CARD_D = 0.035;
/** Backwards lean of the card in its holder. */
const LEAN = 0.2;
const N = CARD.panelSize;
const PANEL = N * PX;
const PANEL_CX = -CARD_W / 2 + (CARD.panelX + N / 2) * PX;
const PANEL_CY = CARD_H - (CARD.panelY + N / 2) * PX;
const DECAL_Z = CARD_D / 2 + 0.003;
const FOIL_Z = CARD_D / 2 + 0.006;
const COIN_SCALE = 0.024;
const COIN_R = 7.5 * COIN_SCALE;
const COIN_T = 3 * COIN_SCALE;
/** Share of the foil that has to be scratched before the rest flakes off by itself. */
const WIN_SHARE = 0.7;
const FOIL_EDGE = '#7d8594';
const SILVER = ['#c3c9d3', '#e3e7ee', '#8e95a3', '#ffffff'];
const CONFETTI = ['#ffd23f', '#ff5d73', '#7ee0ff', '#3ddc84', '#ffffff', '#b388ff'];

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

function cardBody(f: Flavor, scale: number, foil: boolean, mip: boolean) {
  const edge = cardEdge(f).canvas;
  const body = atlasBox(CARD_W * scale, CARD_H * scale, CARD_D * scale, { px: edge, nx: edge, py: edge, ny: edge, pz: cardFront(f, { foil }).canvas, nz: cardBack(f).canvas }, { mipmaps: mip });
  body.position.y = (CARD_H * scale) / 2;
  return body;
}

function createShowcase(ctx: ProductContext): ShowcaseItem {
  const { qr, flavor: f, tweens, group: tg } = ctx;
  const root = new THREE.Group();

  // --- holder block + leaning card
  const stand = voxelMesh(standVoxels(f), { scale: 0.05, anchor: 'bottom-center' });
  root.add(stand);
  const cardPivot = new THREE.Group();
  cardPivot.position.set(0, 0.1, 0.03);
  cardPivot.rotation.x = -LEAN;
  cardPivot.updateMatrix();
  root.add(cardPivot);
  const body = cardBody(f, 1, false, false);
  cardPivot.add(body);

  const decal = qrDecal(qr, PANEL, INK, '#ffffff', 2);
  decal.position.set(PANEL_CX, PANEL_CY, DECAL_Z);
  cardPivot.add(decal);

  // --- scratch-off foil: a canvas we erase texel by texel (alpha-tested)
  const foil = foilArt(N);
  const foilTex = foil.texture();
  const foilMesh = new THREE.Mesh(new THREE.PlaneGeometry(PANEL, PANEL), new THREE.MeshToonMaterial({ map: foilTex, gradientMap: toonGradient(), alphaTest: 0.5 }));
  foilMesh.position.set(PANEL_CX, PANEL_CY, FOIL_Z);
  cardPivot.add(foilMesh);
  const mask = new Uint8Array(N * N);
  let cleared = 0;
  let foilGone = false;

  // --- "WIN!" sticker
  const stickerArt = winSticker(f);
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.45), new THREE.MeshToonMaterial({ map: stickerArt.texture(), gradientMap: toonGradient(), alphaTest: 0.5, side: THREE.DoubleSide }));
  sticker.position.set(CARD_W / 2 - 0.12, CARD_H - 0.02, CARD_D / 2 + 0.08);
  sticker.rotation.z = -0.22;
  sticker.scale.setScalar(0.001);
  sticker.visible = false;
  cardPivot.add(sticker);

  // --- coins: a little stack + the scratching coin
  const coinGrid = coinVoxels();
  const coinProto = voxelMesh(coinGrid, { scale: COIN_SCALE, anchor: 'center' });
  const stackPos = new THREE.Vector3(1.28, 0, 0.5);
  for (let k = 0; k < 3; k++) {
    const c = new THREE.Mesh(coinProto.geometry, coinProto.material);
    c.castShadow = c.receiveShadow = true;
    c.rotation.set(-Math.PI / 2, 0, k * 0.7);
    c.position.set(stackPos.x + (k % 2) * 0.02, COIN_T / 2 + k * COIN_T, stackPos.z - (k === 1 ? 0.015 : 0));
    root.add(c);
  }
  const coin = coinProto;
  const coinRest = new THREE.Vector3(stackPos.x + 0.01, COIN_T / 2 + 3 * COIN_T, stackPos.z);
  const coinRestQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0.3));
  coin.position.copy(coinRest);
  coin.quaternion.copy(coinRestQ);
  root.add(coin);

  // --- lucky cat
  const cat = new THREE.Group();
  const catScale = 0.032;
  const catBody = voxelMesh(catVoxels(f.c.collar), { scale: catScale, anchor: 'bottom-center' });
  cat.add(catBody);
  const armPivot = new THREE.Group();
  const [shx, shy, shz] = CAT.shoulder;
  armPivot.position.set((shx - CAT.sx / 2) * catScale, shy * catScale, (shz - CAT.sz / 2) * catScale);
  const arm = voxelMesh(catArmVoxels(), { scale: catScale, anchor: 'corner' });
  arm.position.set(-0.5 * catScale, 0, -2.5 * catScale);
  armPivot.add(arm);
  cat.add(armPivot);
  cat.position.set(-1.45, 0, 0.3);
  cat.rotation.y = 0.45;
  root.add(cat);

  const fx = new Particles(360);
  fx.floorY = 0.005;
  root.add(fx.mesh);

  // --- helpers
  const _v = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _q2 = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _inv = new THREE.Matrix4();
  const _ray = new THREE.Ray();

  /** Texel (u, v) on the foil → point in root space. */
  const texelToRoot = (u: number, v: number, out: THREE.Vector3, lift = 0) =>
    out.set(PANEL_CX - PANEL / 2 + (u / N) * PANEL, PANEL_CY + PANEL / 2 - (v / N) * PANEL, FOIL_Z + lift).applyMatrix4(cardPivot.matrix);

  function eraseDisc(cx: number, cy: number, r: number) {
    const c2 = foil.ctx;
    // darken the rim of the remaining foil so scratches get a crumbly edge
    c2.globalCompositeOperation = 'source-atop';
    foil.disc(cx, cy, r + 1.3, FOIL_EDGE);
    c2.globalCompositeOperation = 'source-over';
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(N - 1, Math.ceil(cy + r));
    for (let py = y0; py <= y1; py++) {
      const dy = (py + 0.5 - cy) / r;
      if (Math.abs(dy) > 1) continue;
      const half = r * Math.sqrt(1 - dy * dy);
      const xa = Math.max(0, Math.round(cx - half));
      const xb = Math.min(N, Math.round(cx + half));
      if (xb <= xa) continue;
      c2.clearRect(xa, py, xb - xa, 1);
      for (let x = xa; x < xb; x++) {
        const i = py * N + x;
        if (!mask[i]) {
          mask[i] = 1;
          cleared++;
        }
      }
    }
  }

  let lastU = -1;
  let lastV = -1;
  let travelled = 0;
  function strokeTo(u: number, v: number, r: number) {
    if (foilGone) return;
    if (lastU < -100) {
      eraseDisc(u, v, r);
    } else {
      const d = Math.hypot(u - lastU, v - lastV);
      const steps = Math.max(1, Math.ceil(d / 1.5));
      for (let i = 1; i <= steps; i++) eraseDisc(lastU + ((u - lastU) * i) / steps, lastV + ((v - lastV) * i) / steps, r);
      travelled += d;
    }
    lastU = u;
    lastV = v;
    foilTex.needsUpdate = true;
    if (travelled > 5) {
      travelled = 0;
      if (u > 0 && u < N && v > 0 && v < N) fx.burst(texelToRoot(u, v, _v, 0.02), { count: 2, color: SILVER, speed: 0.7, up: 1.1, size: 0.028, life: 0.6 });
    }
    if (cleared >= WIN_SHARE * N * N) clearFoil(true);
  }
  const penUp = () => {
    lastU = lastV = -1000;
  };
  penUp();

  let celebrate = 0;
  let scanMode = false;
  function popSticker(animated: boolean) {
    sticker.visible = true;
    if (!animated) {
      sticker.scale.setScalar(1);
      return;
    }
    void tweens.tween(0.5, (t) => sticker.scale.setScalar(Math.max(0.001, t)), ease.outBack, tg);
  }

  /** Flake off whatever foil is left. */
  function clearFoil(party: boolean) {
    if (foilGone) return;
    foilGone = true;
    if (!party) {
      foilMesh.visible = false;
      popSticker(false);
      return;
    }
    audio.play('tada');
    fx.burst(texelToRoot(N / 2, -6, _v, 0.2), { count: 70, color: CONFETTI, speed: 2.2, up: 3.2, size: 0.05, life: 1.4 });
    celebrate = 2.5;
    popSticker(true);
    // quick sweeping wipe of the leftovers
    let col = -8;
    void tweens.tween(0.45, (t) => {
      const target = -8 + t * (N + 16);
      const c2 = foil.ctx;
      while (col < target) {
        c2.clearRect(Math.floor(col), 0, 4, N);
        if (Math.floor(col) % 8 === 0) {
          for (let k = 0; k < 3; k++) fx.burst(texelToRoot(col, 8 + Math.random() * (N - 16), _v, 0.02), { count: 2, color: SILVER, speed: 0.9, up: 1.4, size: 0.032, life: 0.8 });
        }
        col += 4;
      }
      foilTex.needsUpdate = true;
    }, ease.linear, tg).then(() => (foilMesh.visible = false));
  }

  /** Put the coin on the card with its upper rim scraping at texel (u, v). */
  function poseCoinOnCard(u: number, v: number, wobble: number) {
    const tilt = -0.95;
    const up = COIN_R;
    // contact point, then back off along the tilted coin's "up" axis
    texelToRoot(u, v, _v, 0.004);
    _e.set(tilt, 0, wobble, 'ZXY');
    _q.setFromEuler(_e);
    _q2.copy(cardPivot.quaternion).multiply(_q);
    _v2.set(0, -up, 0).applyQuaternion(_q2);
    _v.add(_v2);
    // keep the coin face just in front of the card
    _v2.set(0, 0, COIN_T * 0.5).applyQuaternion(cardPivot.quaternion);
    coin.position.copy(_v).add(_v2);
    coin.quaternion.copy(_q2);
  }

  let revealing = false;
  let time = 0;

  async function reveal() {
    if (foilGone) {
      // already scratched by hand: a victory coin flip
      audio.play('coin');
      const from = coin.position.clone();
      await tweens.tween(0.7, (t) => {
        coin.position.set(from.x, from.y + Math.sin(t * Math.PI) * 0.6, from.z);
        coin.rotation.set(-Math.PI / 2 + t * Math.PI * 4, 0, 0.3);
      }, ease.linear, tg);
      coin.position.copy(coinRest);
      coin.quaternion.copy(coinRestQ);
      celebrate = 1.5;
      audio.play('ding');
      return;
    }
    revealing = true;
    // pick up the coin
    audio.play('coin');
    const p0 = coin.position.clone();
    const lift = new THREE.Vector3(1.05, 1.15, 0.75);
    await tweens.tween(0.45, (t) => {
      coin.position.lerpVectors(p0, lift, t);
      coin.position.y += Math.sin(t * Math.PI) * 0.25;
      _e.set(-Math.PI / 2 + t * Math.PI * 2.5, t * 0.6, 0.3);
      coin.quaternion.setFromEuler(_e);
    }, ease.outQuad, tg);
    // glide onto the top-left corner of the foil
    const rows = [5, 14, 23, 32, 41, 50, 59];
    const u0 = 3;
    const u1 = N - 3;
    const pA = coin.position.clone();
    const qA = coin.quaternion.clone();
    poseCoinOnCard(u0, rows[0], 0);
    const pB = coin.position.clone();
    const qB = coin.quaternion.clone();
    await tweens.tween(0.35, (t) => {
      coin.position.lerpVectors(pA, pB, t);
      coin.quaternion.slerpQuaternions(qA, qB, t);
    }, ease.inOutCubic, tg);
    audio.play('scratch');
    penUp();
    // zig-zag scratching
    for (let k = 0; k < rows.length && !foilGone; k++) {
      const from = k % 2 === 0 ? u0 : u1;
      const to = k % 2 === 0 ? u1 : u0;
      const dir = Math.sign(to - from);
      const vPrev = k === 0 ? rows[0] : rows[k - 1];
      await tweens.tween(0.3, (t) => {
        if (foilGone) return;
        const u = from + (to - from) * t;
        const v = vPrev + (rows[k] - vPrev) * Math.min(1, t * 5);
        strokeTo(u, v, 5.3);
        poseCoinOnCard(u, v, dir * 0.28 + Math.sin(t * Math.PI * 6) * 0.08);
        audio.play('scratch', { minGap: 0.05 });
      }, ease.inOutSine, tg);
    }
    penUp();
    if (!foilGone) clearFoil(true);
    // coin hops back home with a spin
    const pC = coin.position.clone();
    const qC = coin.quaternion.clone();
    await tweens.tween(0.6, (t) => {
      coin.position.lerpVectors(pC, coinRest, t);
      coin.position.y += Math.sin(t * Math.PI) * 0.45;
      coin.quaternion.slerpQuaternions(qC, coinRestQ, t);
      coin.rotateY(Math.sin(t * Math.PI) * 2);
    }, ease.inOutCubic, tg);
    coin.position.copy(coinRest);
    coin.quaternion.copy(coinRestQ);
    audio.play('clack');
    await tweens.wait(0.5, tg);
    revealing = false;
  }

  function finish() {
    tweens.cancel(tg);
    revealing = false;
    penUp();
    if (!foilGone) {
      foilGone = true;
      popSticker(false);
    }
    foilMesh.visible = false;
    sticker.visible = true;
    sticker.scale.setScalar(1);
    coin.position.copy(coinRest);
    coin.quaternion.copy(coinRestQ);
  }

  let scratching = false;
  let hitU = 0;
  let hitV = 0;
  function rayToTexel(ray: THREE.Ray) {
    cardPivot.updateWorldMatrix(true, false);
    _inv.copy(cardPivot.matrixWorld).invert();
    _ray.copy(ray).applyMatrix4(_inv);
    const dz = _ray.direction.z;
    if (Math.abs(dz) < 1e-6) return false;
    const t = (FOIL_Z - _ray.origin.z) / dz;
    if (t < 0) return false;
    _ray.at(t, _v);
    hitU = ((_v.x - (PANEL_CX - PANEL / 2)) / PANEL) * N;
    hitV = ((PANEL_CY + PANEL / 2 - _v.y) / PANEL) * N;
    return true;
  }

  return {
    root,
    reveal,
    finish,
    actionLabel: 'Scratch it!',
    hero: { target: new THREE.Vector3(0.0, 0.95, 0.1), distance: 5.4, yaw: 0.08, pitch: 0.3 },
    pointer(kind, hit, ray) {
      if (kind === 'up') {
        const was = scratching;
        scratching = false;
        penUp();
        return was;
      }
      if (kind === 'down') {
        if (foilGone || !hit) return false;
        if (hit.object !== foilMesh && hit.object !== decal && hit.object !== body) return false;
        if (!rayToTexel(ray) || hitU < -3 || hitU > N + 3 || hitV < -3 || hitV > N + 3) return false;
        scratching = true;
        penUp();
        strokeTo(hitU, hitV, 4.5);
        audio.play('scratch', { minGap: 0.05 });
        return true;
      }
      if (!scratching) return false;
      if (!foilGone && rayToTexel(ray)) {
        strokeTo(hitU, hitV, 4.5);
        audio.play('scratch', { minGap: 0.05 });
      }
      return true;
    },
    update(dt) {
      time += dt;
      fx.update(dt);
      if (celebrate > 0) celebrate -= dt;
      const happy = celebrate > 0;
      armPivot.rotation.x = 0.05 + Math.max(0, Math.sin(time * (happy ? 12 : 3.2))) * (happy ? 0.8 : 0.5);
      cat.position.y = happy ? Math.abs(Math.sin(time * 9)) * 0.12 : 0;
      if (sticker.visible && !scanMode) sticker.rotation.z = -0.22 + Math.sin(time * 2.4) * 0.06;
      if (!revealing && !scratching && !foilGone) coin.position.y = coinRest.y + Math.max(0, Math.sin(time * 2.2)) * 0.015;
    },
    focusView() {
      cardPivot.updateWorldMatrix(true, false);
      const center = new THREE.Vector3(PANEL_CX, PANEL_CY, DECAL_Z).applyMatrix4(cardPivot.matrixWorld);
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(cardPivot.matrixWorld);
      const up = new THREE.Vector3(0, 1, 0).transformDirection(cardPivot.matrixWorld);
      return { center, normal, size: PANEL, up };
    },
    setScanMode(on) {
      scanMode = on;
      if (on && !foilGone) finish();
    },
    dispose() {
      foilTex.dispose();
      fx.mesh.geometry.dispose();
    },
  };
}

function poster(ctx: ProductContext) {
  const art = cardFront(ctx.flavor, { scraps: true });
  return composePoster(art, posterScale(art.w), { qr: ctx.qr, x: CARD.panelX, y: CARD.panelY, size: CARD.panelSize, dark: INK, light: '#ffffff', quiet: 2 }, { label: ctx.label, product: 'Lucky Scratch', accent: ctx.flavor.c.ribbon });
}

export const luckyScratch: ProductDef = {
  id: 'lucky-scratch',
  name: 'Lucky Scratch',
  tagline: 'Everyone is a winner.',
  reveal: 'Scratch the silver foil with your finger or mouse to reveal the code.',
  section: 'counter',
  price: 50,
  flavors: SCRATCH_FLAVORS,
  shelfSize: [0.34, 0.44],
  shelfModel(f) {
    const s = 0.19;
    const g = new THREE.Group();
    const stand = voxelMesh(standVoxels(f), { scale: 0.05 * s, anchor: 'bottom-center' });
    g.add(stand);
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.1 * s, 0.03 * s);
    pivot.rotation.x = -LEAN;
    pivot.add(cardBody(f, s, true, true));
    g.add(pivot);
    return withMipmaps(g);
  },
  createShowcase,
  poster,
};
