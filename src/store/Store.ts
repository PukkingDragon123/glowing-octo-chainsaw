import * as THREE from 'three';
import { Batcher } from '../engine/batch';
import { ease, type Tweens } from '../engine/tween';
import { audio } from '../engine/audio';
import { buildGondola, buildShell, hangingSign, STORE, SHELF_LEVELS, type ShelfSlot } from './fixtures';
import { fillShelf } from './filler';
import { priceTagTexture } from './signs';
import { SECTIONS, CAMERA_X_MAX, CAMERA_X_MIN, sectionAt, sectionCenter, type SectionInfo } from './layout';
import {
  AdScreen,
  basketStack,
  captainStandee,
  cardboardBoxes,
  cashierCat,
  cashRegister,
  chestFreezer,
  coffeeMachine,
  coolerUnit,
  hotFoodCase,
  magazineRack,
  openChiller,
  padlock,
  pallet,
  pottedPlant,
  vipShelf,
  wallTV,
  wetFloorSign,
} from './props';
import { buildFacade, type Facade } from './facade';
import { StoreCat } from './cat';
import { PRODUCTS, productById } from '../products';
import type { Flavor, ProductDef } from '../products/types';

export interface ShelfItem {
  product: ProductDef;
  flavor: Flavor;
  group: THREE.Group;
  hit: THREE.Mesh;
  baseY: number;
  hover: number;
  wobble: number;
}

interface Tag {
  product: ProductDef;
  mesh: THREE.Mesh;
  lock: THREE.Object3D | null;
}

type HoverFn = (item: ShelfItem | null, x: number, y: number) => void;

const CAM_Y = 2.05;
const CAM_Z = 5.4;
const LOOK_Y = 0.98;

export class Store {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 120);
  readonly items: ShelfItem[] = [];
  private tags: Tag[] = [];
  camX = 12.5;
  targetX = 12.5;
  private vel = 0;
  private sun: THREE.DirectionalLight;
  private signs: THREE.Group[] = [];
  private cat: { group: THREE.Group; arm: THREE.Object3D };
  private rollers: THREE.Mesh[] = [];
  private adScreen = new AdScreen();
  private tvMesh: THREE.Mesh;
  private registerMesh: THREE.Object3D;
  private facade: Facade;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private hovered: ShelfItem | null = null;
  private hitTargets: THREE.Object3D[] = [];
  private dragging = false;
  private dragStartX = 0;
  private dragLastX = 0;
  private dragMoved = 0;
  private lastMoveT = 0;
  private keys = new Set<string>();
  private stepAcc = 0;
  private mouse = new THREE.Vector2();
  private time = 0;
  /** 'outside' before the walk-in, 'walking' during it, 'aisle' when browsing. */
  phase: 'outside' | 'walking' | 'aisle' = 'outside';
  enabled = true;
  owns: (p: ProductDef) => boolean = (p) => p.price === 0;
  onHover: HoverFn = () => {};
  onPick: (item: ShelfItem) => void = () => {};
  onRegister: () => void = () => {};
  onTV: () => void = () => {};
  onSection: (s: SectionInfo) => void = () => {};
  onPet: () => void = () => {};
  private storeCat = new StoreCat(11.2, -0.55);
  private lastSection = '';
  private camLook = new THREE.Vector3();
  private introCam = { pos: new THREE.Vector3(0, 2.1, 17), look: new THREE.Vector3(0, 2.2, STORE.frontZ) };

  constructor(private canvas: HTMLCanvasElement, private tweens: Tweens) {
    this.scene.background = new THREE.Color('#141b2d');
    buildShell(this.scene);

    const hemi = new THREE.HemisphereLight('#fff8ec', '#8d93b5', 1.55);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -9;
    sc.right = 9;
    sc.top = 4.5;
    sc.bottom = -3.5;
    sc.near = 0.5;
    sc.far = 30;
    this.sun.shadow.bias = -0.0015;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    const coolLight = new THREE.PointLight('#bfe9ff', 5, 6, 1.5);
    coolLight.position.set(25.5, 2.0, -0.6);
    const vipLight = new THREE.PointLight('#ffd98a', 7, 6, 1.4);
    vipLight.position.set(36.5, 2.5, 0.4);
    const warm = new THREE.PointLight('#ffb070', 3, 5, 1.6);
    warm.position.set(-4.5, 2.2, 0.5);
    this.scene.add(coolLight, vipLight, warm);

    this.cat = cashierCat();
    const tv = wallTV(this.adScreen);
    this.tvMesh = tv.screen;
    this.registerMesh = cashRegister();
    this.buildAisles(tv.group);

    this.facade = buildFacade();
    this.scene.add(this.facade.group);
    this.scene.add(this.storeCat.group, this.storeCat.particles);

    this.bindInput();
    this.updateCamera(0);
  }

  // -----------------------------------------------------------------------------------------------
  // Layout

  private addItem(product: ProductDef, flavor: Flavor, x: number, y: number, z: number, scale = 1, ry = 0) {
    const model = product.shelfModel(flavor);
    const group = new THREE.Group();
    group.add(model);
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    group.rotation.y = ry;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        // crisp pixel look: pick one mip level with nearest texels instead of blending levels
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const map = (mat as THREE.MeshToonMaterial).map;
          if (map && map.generateMipmaps && map.minFilter !== THREE.NearestMipmapNearestFilter) {
            map.minFilter = THREE.NearestMipmapNearestFilter;
            map.needsUpdate = true;
          }
        }
      }
    });
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const hit = new THREE.Mesh(new THREE.BoxGeometry(size.x + 0.04, size.y + 0.04, size.z + 0.06), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(center);
    group.add(hit);
    this.scene.add(group);
    const item: ShelfItem = { product, flavor, group, hit, baseY: y, hover: 0, wobble: Math.random() * 6 };
    hit.userData.item = item;
    this.hitTargets.push(hit);
    this.items.push(item);
    return item;
  }

  /** Fill a shelf slot with a product's flavours as repeated facings; returns next free x. */
  private stockRow(product: ProductDef, slot: ShelfSlot, x0: number, x1: number, scale = 1) {
    const w = product.shelfSize[0] * scale + 0.04;
    const n = Math.max(1, Math.floor((x1 - x0) / w));
    const pad = (x1 - x0 - n * w) / 2;
    for (let i = 0; i < n; i++) {
      const flavor = product.flavors[i % product.flavors.length];
      this.addItem(product, flavor, x0 + pad + w * (i + 0.5), slot.y, slot.z - 0.2, scale);
    }
    this.addTag(product, x0 + pad + 0.18, slot.y - 0.06, slot.z + 0.02);
  }

  private addTag(product: ProductDef, x: number, y: number, z: number, ry = 0) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.131), new THREE.MeshBasicMaterial({ map: priceTagTexture(product.name, product.price, this.owns(product)) }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    this.scene.add(mesh);
    let lock: THREE.Object3D | null = null;
    if (product.price > 0) {
      lock = padlock();
      lock.position.set(x + 0.23, y - 0.06, z + 0.02);
      this.scene.add(lock);
    }
    this.tags.push({ product, mesh, lock });
    this.refreshTag(this.tags[this.tags.length - 1]);
  }

  private refreshTag(t: Tag) {
    const owned = this.owns(t.product);
    const mat = t.mesh.material as THREE.MeshBasicMaterial;
    mat.map?.dispose();
    mat.map = priceTagTexture(t.product.name, t.product.price, owned);
    mat.needsUpdate = true;
    if (t.lock) t.lock.visible = !owned;
  }

  refreshOwnership() {
    for (const t of this.tags) this.refreshTag(t);
  }

  private buildAisles(tvGroup: THREE.Group) {
    const P = (id: string) => productById(id)!;
    const b = new Batcher();
    const front = STORE.shelfFrontZ;

    // ---- checkout
    buildGondola(b, -7.5, -4.6, { seed: 11, fillerKinds: ['box', 'jar'], stripColor: '#ff5d73' });
    b.box(1.8, 0.9, 0.6, '#3d405b', -3.55, 0, -1.72);
    b.box(1.84, 0.04, 0.64, '#f7f4ec', -3.55, 0.9, -1.72);
    b.box(3.2, 0.95, 0.75, '#ff5d73', -5.5, 0, 0.55);
    b.box(3.26, 0.06, 0.8, '#f7f4ec', -5.5, 0.95, 0.55);
    b.box(3.2, 0.12, 0.02, '#ffd23f', -5.5, 0.55, 0.93);
    b.box(0.5, 0.05, 0.4, '#2b2d42', -4.4, 1.0, 0.45);
    const hot = hotFoodCase();
    hot.group.position.set(-3.55, 0.94, -1.72);
    this.rollers = hot.rollers;
    this.scene.add(hot.group);
    tvGroup.position.set(-3.55, 1.95, -1.96);
    this.scene.add(tvGroup);
    this.registerMesh.position.set(-5.6, 1.01, 0.45);
    this.registerMesh.rotation.y = 0.15;
    this.scene.add(this.registerMesh);
    this.cat.group.position.set(-6.65, 1.01, 0.5);
    this.cat.group.rotation.y = 0.25;
    this.scene.add(this.cat.group);
    this.addItem(P('lucky-scratch'), P('lucky-scratch').flavors[0], -4.75, 1.0, 0.6, 1.0);
    this.addItem(P('lucky-scratch'), P('lucky-scratch').flavors[1 % P('lucky-scratch').flavors.length], -4.35, 1.0, 0.65, 1.0, -0.2);
    this.addTag(P('lucky-scratch'), -4.55, 0.83, 0.935);
    this.addItem(P('gacha'), P('gacha').flavors[0], -2.95, 0, 0.95, 2.4);
    this.addTag(P('gacha'), -2.95, 0.25, 1.35);

    // ---- media
    const rack = magazineRack(1.7);
    rack.position.set(-1.6, 0, front - 0.1);
    this.scene.add(rack);
    const media = buildGondola(b, -0.7, 1.5, { seed: 12, reserved: [2, 3], stripColor: '#c77dff' });
    this.stockRow(P('pixel-postcard'), media[1], -0.7, 1.5);
    this.stockRow(P('flipbook-tape'), media[0], -0.7, 1.5);

    // ---- snacks
    const s1 = buildGondola(b, 1.5, 5.5, { seed: 13, reserved: [2, 3], stripColor: '#ffd23f' });
    const s2 = buildGondola(b, 5.5, 9.5, { seed: 14, reserved: [2, 3], stripColor: '#ffd23f' });
    this.stockRow(P('pixel-drops'), s1[1], 1.5, 5.5);
    this.stockRow(P('crunch-bytes'), s1[0], 1.5, 5.5);
    this.stockRow(P('choco-block'), s2[1], 5.5, 9.5);
    this.stockRow(P('donut-holes'), s2[0], 5.5, 9.5);

    // ---- cereal (the star of the show)
    const c1 = buildGondola(b, 9.5, 15.5, { seed: 15, reserved: [2, 3], stripColor: '#b8a4ff', fillerKinds: ['box'] });
    this.stockRow(P('captain-qr'), c1[1], 9.5, 15.5);
    this.stockRow(P('captain-qr'), c1[0], 9.5, 15.5);
    const pl = pallet(1.7, 1.0);
    pl.position.set(12.4, 0, 0.75);
    this.scene.add(pl);
    const cap = P('captain-qr');
    const ps = 1.1;
    const bw = cap.shelfSize[0] * ps + 0.02;
    const rows = [4, 3];
    rows.forEach((n, row) => {
      for (let i = 0; i < n; i++) {
        const x = 12.4 + (i - (n - 1) / 2) * bw;
        this.addItem(cap, cap.flavors[(i + row) % cap.flavors.length], x, 0.14 + row * cap.shelfSize[1] * ps, 0.8, ps);
      }
    });
    this.addTag(cap, 12.4, 0.12, 1.28);
    const standee = captainStandee(1.25);
    standee.position.set(13.75, 0, 0.9);
    standee.rotation.y = -0.35;
    this.scene.add(standee);

    // ---- fresh & hot
    const chill = openChiller(3.6);
    chill.position.set(17.4, 0, front - 0.02);
    this.scene.add(chill);
    const oni = P('onigiri');
    const chillSlotA: ShelfSlot = { x: 17.4, y: 0.9, z: front - 0.05, width: 3.4, maxH: 0.4 };
    const chillSlotB: ShelfSlot = { x: 17.4, y: 1.34, z: front - 0.05, width: 3.4, maxH: 0.36 };
    this.stockRow(oni, chillSlotB, 15.7, 19.1);
    this.stockRow(oni, chillSlotA, 15.7, 19.1);
    fillShelf(b, 15.7, 19.1, 1.72, front - 0.05, { seed: 31, maxH: 0.26, depth: 0.5, kinds: ['bottle', 'can'], cold: true });
    fillShelf(b, 15.7, 19.1, 0.42, front - 0.05, { seed: 32, maxH: 0.4, depth: 0.5, kinds: ['bottle', 'box', 'jar'], cold: true });
    b.box(2.0, 0.9, 0.7, '#6d4c41', 20.4, 0, -1.65);
    b.box(2.04, 0.05, 0.74, '#f7f4ec', 20.4, 0.9, -1.65);
    const cm = coffeeMachine();
    cm.position.set(19.9, 0.95, -1.75);
    this.scene.add(cm);
    const latte = P('latte-art');
    for (let i = 0; i < latte.flavors.length && i < 3; i++) this.addItem(latte, latte.flavors[i], 20.55 + i * 0.36, 0.95, -1.5);
    this.addTag(latte, 20.9, 0.84, -1.27);

    // ---- cooler
    const cooler = coolerUnit(5, 1.5);
    cooler.group.position.set(25.5, 0, front - 0.02);
    this.scene.add(cooler.group);
    const cz = front - 0.02 - 0.35;
    for (const y of [0.35, 0.8, 1.25, 1.7]) {
      b.box(7.4, 0.03, 0.7, '#e8f4ff', 25.5, y - 0.03, cz - 0.1);
    }
    const coolSlot = (y: number): ShelfSlot => ({ x: 0, y, z: cz + 0.25, width: 1.4, maxH: 0.42 });
    // door 1 + 5: filler; doors 2-4: products
    for (const [x0, x1] of [
      [21.8, 23.2],
      [27.8, 29.2],
    ]) {
      for (const [i, y] of [0.35, 0.8, 1.25, 1.7].entries()) fillShelf(b, x0, x1, y, cz + 0.25, { seed: 40 + i + x0, maxH: 0.4, depth: 0.5, kinds: ['bottle', 'can'], cold: true });
    }
    const drinks = ['fizz-pop', 'boba-bliss', 'volt'];
    drinks.forEach((id, k) => {
      const x0 = 23.3 + k * 1.5;
      const x1 = x0 + 1.4;
      this.stockRow(P(id), coolSlot(1.25), x0, x1);
      this.stockRow(P(id), coolSlot(0.8), x0, x1);
      fillShelf(b, x0, x1, 0.35, cz + 0.25, { seed: 60 + k, maxH: 0.4, depth: 0.5, kinds: ['bottle', 'can'], cold: true });
      fillShelf(b, x0, x1, 1.7, cz + 0.25, { seed: 70 + k, maxH: 0.4, depth: 0.5, kinds: ['bottle', 'can'], cold: true });
    });

    // ---- freezer
    buildGondola(b, 29.5, 33.5, { seed: 16, fillerKinds: ['box', 'bag'], stripColor: '#8ecae6' });
    const fr = chestFreezer(2.6);
    fr.position.set(31.5, 0, 0.45);
    this.scene.add(fr);
    const frosty = P('frosty-cubes');
    for (let i = 0; i < 5; i++) this.addItem(frosty, frosty.flavors[i % frosty.flavors.length], 30.55 + i * 0.47, 0.87, 0.45);
    this.addTag(frosty, 30.6, 0.62, 0.93);

    // ---- premium
    const vip = vipShelf(5.4);
    vip.position.set(36.5, 0, front + 0.05);
    this.scene.add(vip);
    const gold = P('golden-ticket');
    this.addItem(gold, gold.flavors[0], 36.5, 0.95, front - 0.15, 1.6);
    this.addTag(gold, 36.5, 0.8, front + 0.2);
    const picks = PRODUCTS.filter((p) => p.price > 0 && p.id !== 'golden-ticket');
    const span = 4.9;
    picks.forEach((p, i) => this.addItem(p, p.flavors[0], 36.5 - span / 2 + (span * (i + 0.5)) / picks.length, 1.5, front - 0.15, 0.85));
    gold.flavors.forEach((fl, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const k = Math.floor(i / 2);
      this.addItem(gold, fl, 36.5 + side * (1.05 + k * 0.62), 0.95, front - 0.15, 0.95);
    });

    this.scene.add(b.build());

    // ---- hanging aisle signs
    for (const s of SECTIONS) {
      if (s.id === 'cooler' || s.id === 'premium') continue; // these fixtures carry their own signs
      const sign = hangingSign(s.name.toUpperCase(), s.color, (s.x0 + s.x1) / 2, 0.35, 2.6);
      this.signs.push(sign);
      this.scene.add(sign);
    }

    // ---- foreground decor (parallax)
    const fg: [THREE.Object3D, number, number, number][] = [
      [basketStack(), -1.1, 1.7, 0.3],
      [wetFloorSign(), 8.3, 1.8, 0.6],
      [pottedPlant(), 15.55, 1.4, 0],
      [cardboardBoxes(), 21.4, 1.7, -0.3],
      [pottedPlant(), 33.6, 1.6, 0.8],
      [basketStack(), 29.4, 1.9, -0.4],
    ];
    for (const [o, x, z, ry] of fg) {
      o.position.set(x, 0, z);
      o.rotation.y = ry;
      o.traverse((m) => ((m as THREE.Mesh).castShadow = true));
      this.scene.add(o);
    }
  }

  // -----------------------------------------------------------------------------------------------
  // Input

  private bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.phase !== 'aisle' || e.button !== 0) return;
      this.dragging = true;
      this.dragStartX = this.dragLastX = e.clientX;
      this.dragMoved = 0;
      this.vel = 0;
      this.lastMoveT = performance.now();
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.enabled) return;
      const rect = c.getBoundingClientRect();
      this.mouse.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      if (this.dragging) {
        const dx = e.clientX - this.dragLastX;
        this.dragLastX = e.clientX;
        this.dragMoved = Math.max(this.dragMoved, Math.abs(e.clientX - this.dragStartX));
        const k = 7.5 / Math.max(400, rect.width);
        this.targetX = THREE.MathUtils.clamp(this.targetX - dx * k, CAMERA_X_MIN, CAMERA_X_MAX);
        const now = performance.now();
        const dt = Math.max(1, now - this.lastMoveT) / 1000;
        this.vel = THREE.MathUtils.lerp(this.vel, (-dx * k) / dt, 0.4);
        this.lastMoveT = now;
        if (this.dragMoved > 6) this.setHover(null, e.clientX, e.clientY);
      } else if (this.phase === 'aisle' && e.target === c) {
        this.pickAt(e.clientX, e.clientY, false);
      } else if (e.target !== c) this.setHover(null, 0, 0);
    });
    window.addEventListener('pointerup', (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (this.dragMoved < 6) {
        this.pickAt(e.clientX, e.clientY, true);
        this.vel = 0;
      } else if (performance.now() - this.lastMoveT > 120) this.vel = 0;
    });
    c.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled || this.phase !== 'aisle') return;
        e.preventDefault();
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        this.targetX = THREE.MathUtils.clamp(this.targetX + d * 0.006, CAMERA_X_MIN, CAMERA_X_MAX);
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea,select')) return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    c.addEventListener('pointerleave', () => this.setHover(null, 0, 0));
  }

  private pickAt(clientX: number, clientY: number, click: boolean) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const targets = [...this.hitTargets, this.tvMesh, this.registerMesh, this.storeCat.hit];
    const hits = this.raycaster.intersectObjects(targets, false);
    const hit = hits[0];
    if (!hit) {
      this.setHover(null, clientX, clientY);
      this.canvas.style.cursor = '';
      return;
    }
    if (hit.object === this.storeCat.hit) {
      this.setHover(null, clientX, clientY);
      this.canvas.style.cursor = 'pointer';
      if (click) {
        this.storeCat.pet();
        audio.play('blip', { rate: 1.6 });
        audio.play('ding', { rate: 1.3 });
        this.onPet();
      }
      return;
    }
    if (hit.object === this.tvMesh || hit.object === this.registerMesh) {
      this.setHover(null, clientX, clientY);
      this.canvas.style.cursor = 'pointer';
      if (click) (hit.object === this.tvMesh ? this.onTV : this.onRegister)();
      return;
    }
    const item = hit.object.userData.item as ShelfItem;
    this.canvas.style.cursor = 'pointer';
    if (click) {
      this.setHover(null, clientX, clientY);
      item.hover = 1.4;
      this.onPick(item);
    } else this.setHover(item, clientX, clientY);
  }

  private setHover(item: ShelfItem | null, x: number, y: number) {
    if (item !== this.hovered && item) audio.play('blip', { rate: 1 + Math.random() * 0.2, minGap: 0.05 });
    this.hovered = item;
    this.onHover(item, x, y);
  }

  jumpTo(x: number) {
    this.targetX = THREE.MathUtils.clamp(x, CAMERA_X_MIN, CAMERA_X_MAX);
    this.vel = 0;
  }

  jumpToSection(id: SectionInfo['id']) {
    this.jumpTo(sectionCenter(id));
  }

  step(dir: number) {
    this.jumpTo(this.targetX + dir * 4);
  }

  get section() {
    return sectionAt(this.camX);
  }

  // -----------------------------------------------------------------------------------------------
  // Intro: walk in from the street

  async walkIn(fast = false) {
    if (this.phase !== 'outside') return;
    this.phase = 'walking';
    const f = this.facade;
    audio.play('chime');
    const doorOpen = (t: number) => {
      for (const d of f.doors) d.position.x = THREE.MathUtils.lerp(d.userData.closedX, d.userData.openX, t);
    };
    const startPos = this.introCam.pos.clone();
    const startLook = this.introCam.look.clone();
    const mid = new THREE.Vector3(0, 1.65, STORE.frontZ + 1.6);
    const midLook = new THREE.Vector3(0, 1.5, 0);
    if (!fast) {
      await this.tweens.tween(1.1, (t) => {
        this.introCam.pos.lerpVectors(startPos, mid, t);
        this.introCam.look.lerpVectors(startLook, midLook, t);
        doorOpen(Math.min(1, t * 1.6));
      }, ease.inOutSine, 'intro');
    } else doorOpen(1);
    const inside = new THREE.Vector3(0, CAM_Y, CAM_Z);
    const insideLook = new THREE.Vector3(0, LOOK_Y, STORE.shelfFrontZ);
    const p0 = this.introCam.pos.clone();
    const l0 = this.introCam.look.clone();
    await this.tweens.tween(fast ? 0.01 : 1.2, (t) => {
      this.introCam.pos.lerpVectors(p0, inside, t);
      this.introCam.pos.y += Math.sin(t * Math.PI * 4) * 0.03 * (1 - t);
      this.introCam.look.lerpVectors(l0, insideLook, t);
    }, ease.inOutCubic, 'intro');
    this.camX = 0;
    this.targetX = 12.4;
    this.phase = 'aisle';
    void this.tweens.tween(0.8, (t) => doorOpen(1 - t), ease.inOutQuad, 'intro');
  }

  skipIntro() {
    this.tweens.cancel('intro');
    for (const d of this.facade.doors) d.position.x = d.userData.closedX;
    this.phase = 'aisle';
    this.camX = 12.4;
    this.targetX = 12.4;
  }

  // -----------------------------------------------------------------------------------------------

  /** Portrait screens get a wider field of view so a useful slice of the aisle stays visible. */
  fitAspect(aspect: number) {
    const dist = CAM_Z - STORE.shelfFrontZ;
    const minHalfWidth = 2.6;
    const needV = 2 * Math.atan(Math.tan(Math.atan(minHalfWidth / dist)) / aspect);
    this.camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(needV), 36, 72);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  private updateCamera(dt: number) {
    if (this.phase !== 'aisle') {
      this.camera.position.copy(this.introCam.pos);
      this.camera.lookAt(this.introCam.look);
      this.sun.position.set(this.introCam.pos.x + 3, 7, 6);
      this.sun.target.position.set(this.introCam.pos.x, 0, 2);
      return;
    }
    // keyboard
    let kdir = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) kdir -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) kdir += 1;
    if (kdir) this.targetX = THREE.MathUtils.clamp(this.targetX + kdir * dt * 5.5, CAMERA_X_MIN, CAMERA_X_MAX);
    // fling inertia
    if (!this.dragging && Math.abs(this.vel) > 0.01) {
      this.targetX = THREE.MathUtils.clamp(this.targetX + this.vel * dt, CAMERA_X_MIN, CAMERA_X_MAX);
      this.vel *= Math.exp(-4 * dt);
    }
    const prev = this.camX;
    this.camX += (this.targetX - this.camX) * (1 - Math.exp(-7 * dt));
    const moved = Math.abs(this.camX - prev);
    this.stepAcc += moved;
    if (this.stepAcc > 0.9) {
      this.stepAcc = 0;
      audio.play('step', { minGap: 0.15 });
    }
    const speed = moved / Math.max(dt, 1e-4);
    const bob = Math.sin(this.time * 9) * Math.min(1, speed / 4) * 0.02;
    this.camera.position.set(this.camX + this.mouse.x * 0.08, CAM_Y + bob + this.mouse.y * 0.04, CAM_Z);
    this.camLook.set(this.camX + this.mouse.x * 0.25, LOOK_Y + this.mouse.y * 0.08, STORE.shelfFrontZ);
    this.camera.lookAt(this.camLook);
    // keep the shadow camera on screen, snapped to texels to avoid shimmer
    const snap = 18 / 2048;
    const sx = Math.round(this.camX / snap) * snap;
    this.sun.position.set(sx + 3.2, 7.5, 6.5);
    this.sun.target.position.set(sx, 0, -0.5);
  }

  update(dt: number, time: number) {
    this.time = time;
    this.updateCamera(dt);
    for (const s of this.signs) s.rotation.z = Math.sin(time * 0.8 + s.userData.swayPhase) * 0.015;
    this.cat.arm.rotation.x = -0.4 + Math.sin(time * 5) * 0.5;
    for (const r of this.rollers) r.rotation.x += dt * 2;
    this.adScreen.update(dt);
    if (this.phase === 'aisle') this.storeCat.update(dt, this.camX);
    const neon = this.facade.neon.material as THREE.MeshBasicMaterial;
    neon.color.setScalar(Math.sin(time * 13) > -0.92 ? 1 : 0.35);
    // hover animation
    for (const it of this.items) {
      const target = it === this.hovered ? 1 : 0;
      it.hover += (target - it.hover) * (1 - Math.exp(-12 * dt));
      const h = Math.min(1.2, it.hover);
      it.group.position.y = it.baseY + h * 0.06;
      it.group.rotation.z = h > 0.01 ? Math.sin(time * 10 + it.wobble) * 0.05 * h : 0;
    }
    const sec = this.section;
    if (sec.id !== this.lastSection && this.phase === 'aisle') {
      this.lastSection = sec.id;
      this.onSection(sec);
    }
  }

  /** Screen position of a world point (for UI anchors). */
  project(v: THREE.Vector3) {
    const p = v.clone().project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
  }
}

export { SHELF_LEVELS };
