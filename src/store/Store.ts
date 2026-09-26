import * as THREE from 'three';
import { ease, type Tweens } from '../engine/tween';
import { audio } from '../engine/audio';
import { PRODUCTS, productById } from '../products';
import type { ProductDef } from '../products/types';
import { makeClerk, type ClerkAPI } from '../app/clerkApi';
import { spriteMesh } from '../art/spriteMesh';
import { iconBitmap } from '../art/icons';
import { Kit, PAL } from './kit';
import { Stock } from './stock';
import { Shoppers } from './npcs';
import { buildFacade, type Facade } from './facade';
import {
  buildShell,
  checkoutCounter,
  chestFreezer,
  coffeeBar,
  cooler,
  gondola,
  hangingSign,
  lampsAndBunting,
  openChiller,
  photoBooth,
  tvCabinet,
  type ShelfRun,
} from './fixtures';
import { CAMERA_X_MAX, CAMERA_X_MIN, SECTIONS, STORE, sectionAt, type SectionInfo } from './layout';
import type { Aisle } from '../art/foods';
import { Particles } from '../products/common/props';

export interface ShelfItem {
  product: ProductDef;
  group: THREE.Group;
  hit: THREE.Mesh;
  baseY: number;
  hover: number;
  wobble: number;
  lock: THREE.Object3D | null;
}

const SHELF_Z = STORE.shelfFrontZ;
const FAR = 7.4;
const NEAR = 1.25;
const LOOK_Y = 1.12;

type Pick =
  | { kind: 'item'; item: ShelfItem; point: THREE.Vector3 }
  | { kind: 'food'; mesh: THREE.InstancedMesh; index: number; point: THREE.Vector3 }
  | { kind: 'shopper'; object: THREE.Object3D; point: THREE.Vector3 }
  | { kind: 'clerk'; point: THREE.Vector3 };

export class Store {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.05, 140);
  readonly items: ShelfItem[] = [];
  readonly stock = new Stock(96);
  readonly clerk: ClerkAPI;
  readonly shoppers: Shoppers;
  readonly fx = new Particles(400);
  camX = -5.6;
  targetX = -5.6;
  camY = LOOK_Y;
  targetY = LOOK_Y;
  zoom = 0;
  targetZoom = 0;
  phase: 'outside' | 'walking' | 'aisle' = 'outside';
  enabled = true;
  owns: (p: ProductDef) => boolean = (p) => p.price === 0;
  onPick: (item: ShelfItem) => void = () => {};
  onSection: (s: SectionInfo) => void = () => {};
  private facade: Facade;
  private sun: THREE.DirectionalLight;
  private warm: THREE.PointLight;
  private signs: THREE.Group[] = [];
  private tv: ReturnType<typeof tvCabinet>;
  private boothLamp: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private hovered: ShelfItem | null = null;
  private hoverFood: { mesh: THREE.InstancedMesh; index: number } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private dragging = false;
  private dragMoved = 0;
  private dragStart = { x: 0, y: 0 };
  private last = { x: 0, y: 0 };
  private lastMoveT = 0;
  private vel = 0;
  private pinchDist = 0;
  private lastTap = 0;
  private keys = new Set<string>();
  private mouse = new THREE.Vector2();
  private lastSection = '';
  private introCam = { pos: new THREE.Vector3(STORE.doorX, 2.2, STORE.frontZ + 10.5), look: new THREE.Vector3(STORE.doorX, 2.6, STORE.frontZ) };
  private tmp = new THREE.Vector3();
  private promoters: { b: import('../art/buddy').Buddy; next: number }[] = [];

  constructor(private canvas: HTMLCanvasElement, private tweens: Tweens) {
    this.scene.background = new THREE.Color('#f3e4cf');
    buildShell(this.scene);
    const lampXs: number[] = [];
    for (let x = STORE.xMin + 1.2; x < STORE.xMax - 0.5; x += 3.2) lampXs.push(x);
    lampsAndBunting(this.scene, lampXs);

    this.scene.add(new THREE.HemisphereLight('#fff6ea', '#e3cdb8', 1.9));
    this.sun = new THREE.DirectionalLight('#fff4e2', 1.35);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -8;
    sc.right = 8;
    sc.top = 4.5;
    sc.bottom = -3;
    sc.near = 0.5;
    sc.far = 30;
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    this.warm = new THREE.PointLight('#ffcf99', 2.2, 7, 1.5);
    this.scene.add(this.warm);

    this.clerk = makeClerk();
    this.buildAisles();
    this.tv = tvCabinet(this.scene, 46.4, -1.7);
    this.boothLamp = photoBooth(this.scene, 43.2, -1.6).lamp;
    this.scene.add(this.stock.build());

    this.shoppers = new Shoppers([
      { id: 'apple', x: 1.2, range: 2.6 },
      { id: 'eggy', x: 7.8, range: 3 },
      { id: 'milko', x: 13.2, range: 2 },
      { id: 'berry', x: 24.5, range: 2.5 },
      { id: 'avo', x: 32.5, range: 3.2 },
      { id: 'bao', x: 38.6, range: 1.8 },
      { id: 'pudding', x: 44.6, range: 1.8 },
    ]);
    this.scene.add(this.shoppers.group);
    this.scene.add(this.fx.mesh);

    this.facade = buildFacade();
    this.scene.add(this.facade.group);
    this.bindInput();
    this.updateCamera(0);
  }

  // -----------------------------------------------------------------------------------------------
  // Layout

  private addItem(product: ProductDef, x: number, y: number, z: number, scale = 1, ry = 0) {
    const model = product.shelfModel(product.flavors[0]);
    const group = new THREE.Group();
    group.add(model);
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    group.rotation.y = ry;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const map = (mat as THREE.MeshToonMaterial).map;
        if (map && map.generateMipmaps && map.minFilter !== THREE.NearestMipmapNearestFilter) {
          map.minFilter = THREE.NearestMipmapNearestFilter;
          map.needsUpdate = true;
        }
      }
    });
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const hit = new THREE.Mesh(new THREE.BoxGeometry(size.x + 0.05, size.y + 0.06, size.z + 0.08), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(center);
    group.add(hit);
    this.scene.add(group);
    const item: ShelfItem = { product, group, hit, baseY: y, hover: 0, wobble: Math.random() * 6, lock: null };
    hit.userData.item = item;
    this.items.push(item);
    return item;
  }

  /** Product facings on a shelf level; returns the used x-range. */
  private facings(id: string, x0: number, x1: number, y: number, z: number, maxH = 0.42) {
    const p = productById(id);
    if (!p) return;
    const scale = Math.min(0.92, maxH / p.shelfSize[1]);
    const w = p.shelfSize[0] * scale + 0.03;
    const n = Math.max(1, Math.floor((x1 - x0) / w));
    const pad = (x1 - x0 - n * w) / 2;
    for (let i = 0; i < n; i++) this.addItem(p, x0 + pad + w * (i + 0.5), y, z - 0.02, scale);
    this.lockTag(p, (x0 + x1) / 2, y - 0.075, STORE.shelfFrontZ + 0.03);
  }

  private lockTag(p: ProductDef, x: number, y: number, z: number) {
    if (p.price <= 0) return;
    const tag = spriteMesh(iconBitmap('lock'), { ppu: 90, anchor: [0.5, 1], doubleSided: true });
    tag.position.set(x, y, z);
    tag.userData.product = p.id;
    this.scene.add(tag);
    for (const it of this.items) if (it.product === p && !it.lock) it.lock = tag;
  }

  /** Food on a shelf run, skipping reserved x-ranges per level. */
  private fillRun(run: ShelfRun, aisles: Aisle[], reserved: { level: number; x0: number; x1: number }[] = [], seed = 1) {
    run.levels.forEach((y, li) => {
      const cuts = reserved.filter((r) => r.level === li).sort((a, b) => a.x0 - b.x0);
      let x = run.x0;
      const segs: [number, number][] = [];
      for (const c of cuts) {
        if (c.x0 > x + 0.1) segs.push([x, c.x0 - 0.04]);
        x = Math.max(x, c.x1 + 0.04);
      }
      if (run.x1 > x + 0.1) segs.push([x, run.x1]);
      const next = run.levels[li + 1] ?? 2.06;
      for (const [a, b] of segs) this.stock.fillShelf(a, b, y, run.z, this.aislesOrAll(aisles), { seed: seed * 13 + li * 7 + Math.round(a * 3), maxH: next - y - 0.06 });
    });
  }

  private aislesOrAll(aisles: Aisle[]): Aisle[] {
    const ok = aisles.filter((a) => this.stock.aisle(a).length > 0);
    return ok.length ? ok : (['bakery', 'snacks', 'candy', 'breakfast', 'fresh', 'drinks', 'frozen', 'meals', 'pantry'] as Aisle[]).filter((a) => this.stock.aisle(a).length > 0);
  }

  /** Canvas of a food sprite, falling back to any food if the id doesn't exist. */
  private foodIcon(id: string) {
    const def = this.stock.defs.find((d) => d.id === id) ?? this.stock.defs[0];
    return this.stock.canvas(def.id);
  }

  private buildAisles() {
    const kit = new Kit();
    const L = (i: number) => i;

    // ---- checkout: counter, clerk, gacha, scratch cards, golden ticket
    const counter = checkoutCounter(this.scene, -6, 0.2, 4.4);
    this.clerk.root.position.set(-6.2, 0, -1.1);
    this.scene.add(this.clerk.root);
    // menu board behind the clerk: pictures only
    kit.rbox(3.4, 1.0, 0.08, 0.1, PAL.woodDark, -6.2, 2.25, STORE.backZ + 0.05);
    kit.rbox(3.2, 0.84, 0.06, 0.08, '#3d3140', -6.2, 2.33, STORE.backZ + 0.08);
    ['donut', 'onigiri', 'cupcake', 'milk'].forEach((id, i) => {
      const s = spriteMesh(this.foodIcon(id), { ppu: 80, anchor: [0.5, 0.5], doubleSided: true });
      s.position.set(-7.4 + i * 0.8, 2.75, STORE.backZ + 0.13);
      this.scene.add(s);
    });
    // low shelves either side of the clerk with small treats
    const wl = gondola(kit, this.scene, -9.4, -8.3, PAL.pink, {});
    this.fillRun(wl, ['candy', 'snacks'], [], 3);
    const wr = gondola(kit, this.scene, -4.0, -2.6, PAL.pink, {});
    this.fillRun(wr, ['candy', 'snacks'], [], 4);
    this.addItem(productById('gacha')!, -10.1, 0, -0.9, 2.3);
    this.lockTag(productById('gacha')!, -10.1, 0.3, -0.35);
    this.addItem(productById('lucky-scratch')!, -4.7, counter.top, 0.35, 0.95, -0.2);
    this.addItem(productById('lucky-scratch')!, -4.3, counter.top, 0.4, 0.95, 0.15);
    this.lockTag(productById('lucky-scratch')!, -4.5, counter.top - 0.02, counter.front + 0.01);
    // golden ticket under a little glass dome
    const gold = productById('golden-ticket')!;
    this.addItem(gold, -7.7, counter.top + 0.02, 0.3, 0.8);
    kit.cyl(0.26, 0.28, 0.04, PAL.woodDark, -7.7, counter.top, 0.3, 20);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff8d6', transparent: true, opacity: 0.2, depthWrite: false }));
    dome.scale.y = 1.9;
    dome.position.set(-7.7, counter.top + 0.04, 0.3);
    dome.layers.set(1);
    this.scene.add(dome);
    this.lockTag(gold, -7.7, counter.top - 0.02, counter.front + 0.01);
    // basket stack by the door
    for (let i = 0; i < 4; i++) kit.rbox(0.5, 0.26, 0.36, 0.06, PAL.pink, -2.9, i * 0.12, 1.0, 0.1);

    // ---- bakery
    const bakery = gondola(kit, this.scene, -2.2, 4.0, '#ffb98f');
    this.facings('donut-holes', 0.3, 2.3, bakery.levels[L(1)], bakery.z);
    this.fillRun(bakery, ['bakery'], [{ level: 1, x0: 0.3, x1: 2.3 }], 5);

    // ---- snacks
    const s1 = gondola(kit, this.scene, 4.4, 7.6, '#ffd66b');
    const s2 = gondola(kit, this.scene, 7.7, 10.8, '#ffd66b');
    this.facings('crunch-bytes', 4.9, 7.1, s1.levels[1], s1.z);
    this.facings('crunch-bytes', 4.9, 7.1, s1.levels[2], s1.z);
    this.facings('pixel-drops', 8.2, 10.3, s2.levels[1], s2.z);
    this.facings('pixel-drops', 8.2, 10.3, s2.levels[2], s2.z);
    this.fillRun(s1, ['snacks'], [
      { level: 1, x0: 4.9, x1: 7.1 },
      { level: 2, x0: 4.9, x1: 7.1 },
    ], 6);
    this.fillRun(s2, ['snacks', 'candy'], [
      { level: 1, x0: 8.2, x1: 10.3 },
      { level: 2, x0: 8.2, x1: 10.3 },
    ], 7);

    // ---- candy & chocolate
    const c1 = gondola(kit, this.scene, 11.2, 15.4, '#ff9fc0');
    this.facings('choco-block', 12.1, 14.5, c1.levels[2], c1.z);
    this.fillRun(c1, ['candy'], [{ level: 2, x0: 12.1, x1: 14.5 }], 8);

    // ---- cereal: the Captain's aisle with a big pallet display
    const ce = gondola(kit, this.scene, 15.8, 21.6, '#b9a2f0');
    this.facings('captain-qr', 16.6, 20.8, ce.levels[1], ce.z);
    this.facings('captain-qr', 16.6, 20.8, ce.levels[2], ce.z);
    this.fillRun(ce, ['breakfast', 'pantry'], [
      { level: 1, x0: 16.6, x1: 20.8 },
      { level: 2, x0: 16.6, x1: 20.8 },
    ], 9);
    kit.rbox(1.5, 0.14, 0.8, 0.04, PAL.wood, 18.4, 0, 0.7);
    const cap = productById('captain-qr')!;
    const ps = 0.8;
    const bw = cap.shelfSize[0] * ps + 0.02;
    [3, 2].forEach((n, row) => {
      for (let i = 0; i < n; i++) this.addItem(cap, 18.4 + (i - (n - 1) / 2) * bw, 0.14 + row * cap.shelfSize[1] * ps, 0.72, ps);
    });
    this.promoter('captain', 19.55, 0, 0.8);

    // ---- fresh: chiller with onigiri and a coffee bar
    const ch = openChiller(kit, this.scene, 22.0, 25.8);
    this.facings('onigiri', 22.8, 25.0, ch.levels[1], ch.z);
    this.fillRun(ch, ['fresh', 'meals'], [{ level: 1, x0: 22.8, x1: 25.0 }], 10);
    coffeeBar(this.scene, 27.3, -1.75, 2.6);
    const latte = productById('latte-art')!;
    for (let i = 0; i < 2; i++) this.addItem(latte, 27.4 + i * 0.62, 0.96, -1.62, 0.9);
    this.lockTag(latte, 27.7, 0.93, -1.42);

    // ---- drinks cooler
    const co = cooler(this.scene, 29.0, 36.6);
    const doorW = (co.x1 - co.x0) / co.doors.length;
    const drinkDoors: [string, number][] = [
      ['fizz-pop', 1],
      ['boba-bliss', 2],
      ['volt', 3],
    ];
    const reserved: { level: number; x0: number; x1: number }[] = [];
    for (const [id, d] of drinkDoors) {
      const a = co.x0 + d * doorW + 0.08;
      const b = a + doorW - 0.16;
      for (const lv of [1, 2]) {
        this.facings(id, a, b, co.levels[lv], co.z, 0.44);
        reserved.push({ level: lv, x0: a, x1: b });
      }
    }
    this.fillRun(co, ['drinks'], reserved, 11);

    // ---- frozen: freezer gondola + chest freezer
    const fz = gondola(kit, this.scene, 37.0, 41.6, '#9ad7f2');
    this.fillRun(fz, ['frozen'], [], 12);
    const chest = chestFreezer(this.scene, 39.3, 0.35, 3.0);
    const frosty = productById('frosty-cubes')!;
    for (let i = 0; i < 5; i++) this.addItem(frosty, chest.inner.x0 + 0.3 + i * 0.5, chest.top, 0.35, 0.9);
    this.lockTag(frosty, 39.3, 0.7, 0.35 + 0.46);

    // ---- photo corner (booth + TV added in the constructor)
    const pc = productById('pixel-postcard')!;
    kit.rbox(0.7, 0.9, 0.5, 0.08, PAL.lilac, 44.6, 0, -0.8);
    this.addItem(pc, 44.6, 0.9, -0.8, 0.9);
    const ft = productById('flipbook-tape')!;
    for (let i = 0; i < 3; i++) this.addItem(ft, 45.8 + i * 0.32, 0.7, -1.5, 0.85);
    this.lockTag(pc, 44.6, 0.86, -0.54);

    // hanging icon signs
    for (const s of SECTIONS) {
      if (s.id === 'checkout') continue; // the menu board does this job
      const sign = hangingSign(this.foodIcon(s.sign), s.color, (s.x0 + s.x1) / 2);
      this.signs.push(sign);
      this.scene.add(sign);
    }
    this.scene.add(kit.build());

    // check nothing premium-only was left behind
    for (const p of PRODUCTS) if (!this.items.some((i) => i.product === p)) console.warn('product not on a shelf:', p.id);
  }

  /** A mascot buddy standing on a display, waving at passers-by. */
  private promoter(id: string, x: number, y: number, z: number) {
    import('../art/cast').then(({ CAST }) => {
      import('../art/buddy').then(({ Buddy }) => {
        const spec = CAST[id];
        if (!spec) return;
        const b = new Buddy(spec, 72);
        b.position.set(x, y, z);
        this.scene.add(b);
        this.promoters.push({ b, next: 2 + Math.random() * 3 });
      });
    });
  }

  // -----------------------------------------------------------------------------------------------
  // Input

  private bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.phase !== 'aisle') return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        this.dragging = false;
        return;
      }
      this.dragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.last = { x: e.clientX, y: e.clientY };
      this.dragMoved = 0;
      this.vel = 0;
      this.lastMoveT = performance.now();
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.enabled) return;
      const rect = c.getBoundingClientRect();
      this.mouse.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist > 0) this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (d - this.pinchDist) * 0.004);
        this.pinchDist = d;
        return;
      }
      if (this.dragging) {
        const dx = e.clientX - this.last.x;
        const dy = e.clientY - this.last.y;
        this.last = { x: e.clientX, y: e.clientY };
        this.dragMoved = Math.max(this.dragMoved, Math.hypot(e.clientX - this.dragStart.x, e.clientY - this.dragStart.y));
        const upp = this.unitsPerPixel(rect.height);
        this.targetX = THREE.MathUtils.clamp(this.targetX - dx * upp, CAMERA_X_MIN, CAMERA_X_MAX);
        if (this.targetZoom > 0.05) this.targetY = this.clampY(this.targetY + dy * upp);
        const now = performance.now();
        const dt = Math.max(1, now - this.lastMoveT) / 1000;
        this.vel = THREE.MathUtils.lerp(this.vel, (-dx * upp) / dt, 0.4);
        this.lastMoveT = now;
        if (this.dragMoved > 6) this.setHover(null);
      } else if (this.phase === 'aisle' && e.target === c) {
        this.hoverAt(e.clientX, e.clientY);
      }
    });
    const up = (e: PointerEvent) => {
      const wasPinch = this.pointers.size === 2;
      this.pointers.delete(e.pointerId);
      if (wasPinch) {
        this.pinchDist = 0;
        return;
      }
      if (!this.dragging) return;
      this.dragging = false;
      if (this.dragMoved < 7) {
        this.vel = 0;
        const now = performance.now();
        const dbl = now - this.lastTap < 320;
        this.lastTap = now;
        this.click(e.clientX, e.clientY, dbl);
      } else if (performance.now() - this.lastMoveT > 120) this.vel = 0;
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    c.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled || this.phase !== 'aisle') return;
        e.preventDefault();
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.2) {
          this.targetX = THREE.MathUtils.clamp(this.targetX + e.deltaX * 0.006, CAMERA_X_MIN, CAMERA_X_MAX);
        } else {
          const k = e.deltaMode === 1 ? 0.05 : 0.0018;
          this.zoomAt(e.clientX, e.clientY, -e.deltaY * k);
        }
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea,select')) return;
      this.keys.add(e.key.toLowerCase());
      if (!this.enabled || this.phase !== 'aisle') return;
      if (e.key === '+' || e.key === '=') this.zoomAt(null, null, 0.25);
      if (e.key === '-' || e.key === '_') this.zoomAt(null, null, -0.25);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    c.addEventListener('pointerleave', () => this.setHover(null));
  }

  /** World units per screen pixel at the shelf plane for the target zoom. */
  private unitsPerPixel(cssH: number) {
    const dist = THREE.MathUtils.lerp(FAR, NEAR, ease.outQuad(this.targetZoom));
    return (2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / cssH;
  }

  private clampY(y: number) {
    return THREE.MathUtils.clamp(y, 0.42, 2.0);
  }

  /** Zoom toward a screen point (null = centre), keeping that point under the cursor. */
  zoomAt(clientX: number | null, clientY: number | null, delta: number) {
    const rect = this.canvas.getBoundingClientRect();
    const u = clientX === null ? 0 : ((clientX - rect.left) / rect.width) * 2 - 1;
    const v = clientY === null ? 0 : -((clientY - rect.top) / rect.height) * 2 + 1;
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const before = THREE.MathUtils.lerp(FAR, NEAR, ease.outQuad(this.targetZoom));
    const lookBefore = THREE.MathUtils.lerp(LOOK_Y, this.targetY, this.targetZoom);
    const wx = this.targetX + u * before * tanV * this.camera.aspect;
    const wy = lookBefore + v * before * tanV;
    const z0 = this.targetZoom;
    this.targetZoom = THREE.MathUtils.clamp(this.targetZoom + delta, 0, 1);
    if (this.targetZoom === z0) return;
    const after = THREE.MathUtils.lerp(FAR, NEAR, ease.outQuad(this.targetZoom));
    this.targetX = THREE.MathUtils.clamp(wx - u * after * tanV * this.camera.aspect, CAMERA_X_MIN, CAMERA_X_MAX);
    if (this.targetZoom > 0.001) {
      // solve lookY = lerp(LOOK_Y, targetY, zoom) so that wy stays under the cursor
      const wantLook = wy - v * after * tanV;
      this.targetY = this.clampY(LOOK_Y + (wantLook - LOOK_Y) / this.targetZoom);
    }
    if (delta > 0 && z0 < 0.02) audio.play('whoosh', { rate: 1.4, minGap: 0.3 });
  }

  private pick(clientX: number, clientY: number): Pick | null {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const targets: THREE.Object3D[] = [...this.items.map((i) => i.hit), ...this.stock.meshes, ...this.shoppers.hits, this.clerk.hit];
    for (const p of this.promoters) targets.push(p.b.hit);
    const hits = this.raycaster.intersectObjects(targets, false);
    const h = hits[0];
    if (!h) return null;
    const o = h.object;
    if (o.userData.item) return { kind: 'item', item: o.userData.item as ShelfItem, point: h.point };
    if ((o as THREE.InstancedMesh).isInstancedMesh && h.instanceId !== undefined) return { kind: 'food', mesh: o as THREE.InstancedMesh, index: h.instanceId, point: h.point };
    if (o.userData.buddy) return { kind: 'shopper', object: o, point: h.point };
    if (o === this.clerk.hit || o.userData.clerk) return { kind: 'clerk', point: h.point };
    return null;
  }

  private hoverAt(x: number, y: number) {
    const p = this.pick(x, y);
    this.canvas.style.cursor = p ? 'pointer' : 'grab';
    this.setHover(p?.kind === 'item' ? p.item : null);
    const food = p?.kind === 'food' ? { mesh: p.mesh, index: p.index } : null;
    if (food && (food.mesh !== this.hoverFood?.mesh || food.index !== this.hoverFood?.index)) audio.play('blip', { rate: 1.6 + Math.random() * 0.3, minGap: 0.06 });
    this.hoverFood = food;
  }

  private click(x: number, y: number, dbl: boolean) {
    const p = this.pick(x, y);
    if (p?.kind === 'item') {
      this.setHover(null);
      audio.play('select');
      this.sparkle(p.point, ['#ffffff', '#ffd66b', PAL.pink]);
      this.onPick(p.item);
      return;
    }
    if (p?.kind === 'food') {
      this.stock.boop(p.mesh, p.index);
      audio.play('pop', { rate: 1.2 + Math.random() * 0.5 });
      this.hearts(this.stock.positionOf(p.mesh, p.index, this.tmp).clone().add(new THREE.Vector3(0, 0.3, 0.05)));
      return;
    }
    if (p?.kind === 'shopper') {
      const b = p.object.userData.buddy;
      this.shoppers.poke(b);
      if (this.promoters.some((q) => q.b === b)) void b.boop();
      audio.play('blip', { rate: 1.8 });
      audio.play('pop', { rate: 0.9 });
      this.hearts(p.point.clone().add(new THREE.Vector3(0, 0.25, 0.1)));
      return;
    }
    if (p?.kind === 'clerk') {
      audio.play('ding', { rate: 1.2 });
      void this.clerk.wave();
      this.bubbles(p.point);
      return;
    }
    // empty spot: double-tap zooms in / out
    if (dbl) this.zoomAt(x, y, this.targetZoom > 0.4 ? -1 : 0.75);
  }

  private setHover(item: ShelfItem | null) {
    if (item !== this.hovered && item) audio.play('blip', { rate: 1 + Math.random() * 0.2, minGap: 0.05 });
    this.hovered = item;
  }

  // -----------------------------------------------------------------------------------------------
  // Cute effects

  sparkle(at: THREE.Vector3, colors: string[]) {
    this.fx.burst(at, { count: 14, color: colors, speed: 1.4, up: 1.6, size: 0.035, life: 0.6, gravity: -2 });
  }

  hearts(at: THREE.Vector3) {
    this.fx.burst(at, { count: 6, color: [PAL.pink, '#ff9ab8', '#ffffff'], speed: 0.5, up: 1.3, size: 0.045, life: 0.9, gravity: -0.6 });
  }

  bubbles(at: THREE.Vector3) {
    this.fx.burst(at, { count: 10, color: ['#dff6ff', '#ffffff', '#a9e4ff'], speed: 0.5, up: 1.2, size: 0.04, life: 1.1, gravity: -0.8 });
  }

  // -----------------------------------------------------------------------------------------------
  // Intro

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
    const mid = new THREE.Vector3(STORE.doorX, 1.7, STORE.frontZ + 1.8);
    const midLook = new THREE.Vector3(STORE.doorX, 1.5, 0);
    if (!fast) {
      await this.tweens.tween(1.2, (t) => {
        this.introCam.pos.lerpVectors(startPos, mid, t);
        this.introCam.look.lerpVectors(startLook, midLook, t);
        doorOpen(Math.min(1, t * 1.5));
      }, ease.inOutSine, 'intro');
    } else doorOpen(1);
    const insidePos = this.cameraPose(-5.6, 0, LOOK_Y).pos;
    const insideLook = new THREE.Vector3(-5.6, LOOK_Y, SHELF_Z);
    const p0 = this.introCam.pos.clone();
    const l0 = this.introCam.look.clone();
    await this.tweens.tween(fast ? 0.01 : 1.3, (t) => {
      this.introCam.pos.lerpVectors(p0, insidePos, t);
      this.introCam.pos.y += Math.sin(t * Math.PI * 4) * 0.025 * (1 - t);
      this.introCam.look.lerpVectors(l0, insideLook, t);
    }, ease.inOutCubic, 'intro');
    this.camX = this.targetX = -5.6;
    this.phase = 'aisle';
    void this.tweens.tween(0.8, (t) => doorOpen(1 - t), ease.inOutQuad, 'intro');
    void this.clerk.wave();
  }

  skipIntro() {
    this.tweens.cancel('intro');
    for (const d of this.facade.doors) d.position.x = d.userData.closedX;
    this.phase = 'aisle';
    this.camX = this.targetX = -5.6;
  }

  // -----------------------------------------------------------------------------------------------
  // Camera

  fitAspect(aspect: number) {
    // keep ~5.6 units of aisle visible across narrow screens
    const needV = 2 * Math.atan(Math.tan(Math.atan(2.8 / FAR)) / aspect);
    this.camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(needV), 34, 70);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  private cameraPose(x: number, zoom: number, y: number) {
    const z = ease.outQuad(zoom);
    const dist = THREE.MathUtils.lerp(FAR, NEAR, z);
    const lookY = THREE.MathUtils.lerp(LOOK_Y, y, zoom);
    const pos = new THREE.Vector3(x, lookY + THREE.MathUtils.lerp(0.5, 0.06, z), SHELF_Z + dist);
    return { pos, look: new THREE.Vector3(x, lookY, SHELF_Z) };
  }

  /** Where an item sits on screen (CSS px), for anchoring UI. */
  screenOf(v: THREE.Vector3) {
    const p = v.clone().project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
  }

  /** Glide the camera to frame an item (used before a pay screen). */
  focusItem(item: ShelfItem) {
    const c = new THREE.Vector3();
    item.hit.getWorldPosition(c);
    this.targetX = THREE.MathUtils.clamp(c.x, CAMERA_X_MIN, CAMERA_X_MAX);
    this.targetZoom = Math.max(this.targetZoom, 0.55);
    this.targetY = this.clampY(c.y);
  }

  private updateCamera(dt: number) {
    if (this.phase !== 'aisle') {
      this.camera.position.copy(this.introCam.pos);
      this.camera.lookAt(this.introCam.look);
      this.sun.position.set(this.introCam.pos.x + 4, 8, this.introCam.pos.z + 3);
      this.sun.target.position.set(this.introCam.pos.x, 0, STORE.frontZ - 2);
      this.warm.position.set(this.introCam.pos.x, 2.4, STORE.frontZ - 2);
      return;
    }
    let kx = 0;
    let ky = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) kx -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) kx += 1;
    if (this.keys.has('arrowup') || this.keys.has('w')) ky += 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) ky -= 1;
    if (kx) this.targetX = THREE.MathUtils.clamp(this.targetX + kx * dt * (5.5 - this.targetZoom * 3.5), CAMERA_X_MIN, CAMERA_X_MAX);
    if (ky && this.targetZoom > 0.05) this.targetY = this.clampY(this.targetY + ky * dt * 1.5);
    if (!this.dragging && Math.abs(this.vel) > 0.01) {
      this.targetX = THREE.MathUtils.clamp(this.targetX + this.vel * dt, CAMERA_X_MIN, CAMERA_X_MAX);
      this.vel *= Math.exp(-4 * dt);
    }
    const k = 1 - Math.exp(-7 * dt);
    this.camX += (this.targetX - this.camX) * k;
    this.zoom += (this.targetZoom - this.zoom) * k;
    this.camY += (this.targetY - this.camY) * k;
    const pose = this.cameraPose(this.camX, this.zoom, this.camY);
    const par = 1 - this.zoom;
    pose.pos.x += this.mouse.x * 0.08 * par;
    pose.pos.y += this.mouse.y * 0.04 * par;
    this.camera.position.copy(pose.pos);
    this.camera.lookAt(pose.look.x + this.mouse.x * 0.2 * par, pose.look.y + this.mouse.y * 0.06 * par, pose.look.z);
    const snap = 16 / 2048;
    const sx = Math.round(this.camX / snap) * snap;
    this.sun.position.set(sx + 3, 7.5, 6);
    this.sun.target.position.set(sx, 0, -0.6);
    this.warm.position.set(this.camX, 2.4, 0.6);
  }

  update(dt: number, time: number) {
    this.updateCamera(dt);
    for (const s of this.signs) s.rotation.z = Math.sin(time * 0.9 + s.userData.swayPhase) * 0.03;
    this.clerk.update(dt, time, this.camera);
    this.stock.update(dt);
    this.fx.update(dt);
    if (this.phase === 'aisle' || this.phase === 'walking') this.shoppers.update(dt, this.camera, this.camX);
    for (const p of this.promoters) {
      p.next -= dt;
      if (p.next <= 0) {
        p.next = 4 + Math.random() * 4;
        void (Math.random() < 0.6 ? p.b.wave() : p.b.hop());
      }
      p.b.update(dt, this.camera);
    }
    // facade life
    for (const c of this.facade.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 30) c.position.x -= 56;
    }
    this.facade.bulbs.forEach((b, i) => {
      const on = Math.floor(time * 4 + i) % 3 !== 0;
      (b.material as THREE.MeshBasicMaterial).color.set(on ? '#fff3a8' : '#f2b6c6');
    });
    (this.boothLamp.material as THREE.MeshBasicMaterial).color.set(Math.sin(time * 5) > 0 ? '#fff3a8' : '#ffc2d4');
    this.drawTV(time);
    // product hover: lift, wiggle
    for (const it of this.items) {
      const target = it === this.hovered ? 1 : 0;
      it.hover += (target - it.hover) * (1 - Math.exp(-12 * dt));
      const h = Math.min(1.2, it.hover);
      it.group.position.y = it.baseY + h * 0.05;
      it.group.rotation.z = h > 0.01 ? Math.sin(time * 10 + it.wobble) * 0.05 * h : 0;
    }
    const sec = sectionAt(this.camX);
    if (sec.id !== this.lastSection && this.phase === 'aisle') {
      this.lastSection = sec.id;
      this.onSection(sec);
    }
  }

  private tvT = 0;
  private drawTV(time: number) {
    if (time - this.tvT < 0.12) return;
    this.tvT = time;
    const p = this.tv.painter;
    p.clear('#2f3350');
    const f = Math.floor(time * 8);
    for (let i = 0; i < 40; i++) p.px((i * 37 + f * 11) % 48, (i * 17 + f * 5) % 36, '#4a507a');
    // a bouncing little logo heart
    const bx = Math.round(24 + Math.sin(time * 1.7) * 14);
    const by = Math.round(18 + Math.cos(time * 2.3) * 8);
    p.rect(bx - 3, by - 2, 7, 4, '#f47c9f').rect(bx - 2, by + 2, 5, 1, '#f47c9f').rect(bx - 1, by + 3, 3, 1, '#f47c9f');
    this.tv.texture.needsUpdate = true;
  }

  refreshOwnership() {
    for (const it of this.items) if (it.lock) it.lock.visible = !this.owns(it.product);
  }

  get section() {
    return sectionAt(this.camX);
  }
}
