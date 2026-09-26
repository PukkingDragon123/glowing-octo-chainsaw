import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ease, type Tweens } from '../engine/tween';
import { toonGradient } from '../engine/voxel';
import type { ShowcaseItem, FocusView } from '../products/types';
import { Kit, PAL, wallpaperTexture, woodTexture } from '../store/kit';
import { Stock } from '../store/stock';
import { lampsAndBunting } from '../store/fixtures';
import { makeClerk, type ClerkAPI } from '../app/clerkApi';
import type { Aisle } from '../art/foods';
import { Sparkles } from '../art/sparkles';

/**
 * The checkout counter where products perform. The clerk floats behind it, the store glows in
 * the background, and the camera orbits / snaps to a straight-on scan view.
 */
export class Showcase {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.05, 80);
  readonly controls: OrbitControls;
  readonly clerk: ClerkAPI;
  item: ShowcaseItem | null = null;
  readonly sparkles = new Sparkles();
  renderH = 400;
  focusMode = false;
  active = false;
  /** Called with a click (tap without dragging) on the stage. */
  onClick: (ray: THREE.Ray, ndc: THREE.Vector2) => void = () => {};
  private stage = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private interacting = false;
  private down: { x: number; y: number; t: number } | null = null;

  constructor(dom: HTMLElement, private tweens: Tweens) {
    this.scene.background = new THREE.Color('#f3e4cf');
    this.scene.fog = new THREE.Fog('#f3e4cf', 10, 24);
    this.scene.add(new THREE.HemisphereLight('#fff6ea', '#dcc6b2', 1.7));
    const key = new THREE.DirectionalLight('#fff3df', 2.0);
    key.position.set(-3, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -4;
    sc.right = 4;
    sc.top = 4;
    sc.bottom = -4;
    sc.near = 1;
    sc.far = 22;
    key.shadow.bias = -0.0008;
    key.shadow.normalBias = 0.015;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#ffd6e4', 0.8);
    rim.position.set(4, 3, -4);
    this.scene.add(rim);

    // counter: rounded pink body with a wood top; the top surface is y = 0
    const k = new Kit();
    k.rbox(14, 0.9, 6.6, 0.18, PAL.pink, 0, -1.0, 0.9);
    k.rbox(14.2, 0.12, 6.8, 0.06, PAL.woodDark, 0, -0.12, 0.9);
    this.scene.add(k.build());
    const tex = woodTexture();
    tex.repeat.set(14 / 0.8, 6.8 / 0.8);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(14.2, 6.8), new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient() }));
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, 0.001, 0.9);
    top.receiveShadow = true;
    this.scene.add(top);

    // the store behind: wallpaper, stocked shelves, lamps and bunting
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshToonMaterial({ color: '#f5ead8', gradientMap: toonGradient() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -1.0, -4);
    this.scene.add(floor);
    const wp = wallpaperTexture();
    wp.repeat.set(40 / 1.2, 8 / 1.2);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), new THREE.MeshToonMaterial({ map: wp, gradientMap: toonGradient() }));
    wall.position.set(0, 2.5, -7.2);
    this.scene.add(wall);
    const back = new Kit();
    const stock = new Stock(96);
    const colors = ['#ffb98f', '#ffd66b', '#ff9fc0', '#b9a2f0', '#7cc9a8', '#79bfee'];
    const aisles: Aisle[][] = [['bakery'], ['snacks'], ['candy'], ['breakfast'], ['fresh', 'meals'], ['drinks']];
    for (let i = 0; i < 6; i++) {
      const x0 = -9 + i * 3;
      const x1 = x0 + 2.9;
      const cx = (x0 + x1) / 2;
      const z = -6.4;
      // open shelving: coloured back panel, white uprights, boards with coloured lips
      back.rbox(2.9, 2.2, 0.06, 0.03, colors[i], cx, -1.0, z - 0.42);
      back.rbox(0.08, 2.25, 0.8, 0.035, '#ffffff', x0 + 0.04, -1.0, z - 0.05);
      back.rbox(0.08, 2.25, 0.8, 0.035, '#ffffff', x1 - 0.04, -1.0, z - 0.05);
      back.rbox(2.9, 0.14, 0.8, 0.05, colors[i], cx, -1.0, z - 0.05);
      for (const y of [-0.3, 0.2, 0.7]) {
        back.rbox(2.76, 0.04, 0.72, 0.02, '#fffdf8', cx, y - 0.04, z - 0.05);
        back.rbox(2.76, 0.06, 0.03, 0.015, colors[i], cx, y - 0.07, z + 0.31);
      }
      for (const y of [-0.86, -0.3, 0.2, 0.7]) {
        const pool = aisles[i].filter((a) => stock.aisle(a).length);
        stock.fillShelf(x0 + 0.1, x1 - 0.1, y, z + 0.18, pool.length ? pool : (['bakery'] as Aisle[]), { seed: 40 + i * 5 + Math.round(y * 10), rows: 2, only: pool.length ? undefined : stock.defs.map((d) => d.id) });
      }
    }
    this.scene.add(back.build({ castShadow: false }));
    this.scene.add(stock.build());
    const lamps = new THREE.Group();
    const tmp = new THREE.Scene();
    lampsAndBunting(tmp, [-8, -4.8, -1.6, 1.6, 4.8, 8]);
    for (const c of [...tmp.children]) lamps.add(c);
    lamps.position.set(0, -0.2, -4.4);
    this.scene.add(lamps);

    // the clerk floats behind the counter, off to the left of the stage
    this.clerk = makeClerk();
    this.clerk.root.position.set(0.9, -1.0, -3.7);
    this.clerk.root.rotation.y = -0.06;
    this.clerk.root.scale.setScalar(1.25);
    this.scene.add(this.clerk.root);

    this.scene.add(this.stage, this.sparkles.group);

    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.0;
    this.controls.maxDistance = 10;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.screenSpacePanning = true;
    this.controls.enabled = false;

    dom.addEventListener('pointerdown', (e) => this.onPointer('down', e));
    dom.addEventListener('pointermove', (e) => this.onPointer('move', e));
    window.addEventListener('pointerup', (e) => this.onPointer('up', e));
  }

  setItem(item: ShowcaseItem | null) {
    this.tweens.cancel('camera');
    if (!item) this.controls.enabled = false;
    if (this.item) {
      this.stage.remove(this.item.root);
      this.item.dispose();
    }
    this.item = item;
    this.focusMode = false;
    if (item) this.stage.add(item.root);
  }

  /** Put the camera at the item's hero framing. */
  heroCamera(instant = false) {
    this.resetFog();
    if (!this.item) return;
    const h = this.item.hero;
    const yaw = h.yaw ?? 0;
    const pitch = h.pitch ?? 0.35;
    const vf = THREE.MathUtils.degToRad(this.camera.fov);
    const halfH = Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    const dist = Math.max(h.distance, 2.2 / Math.tan(halfH));
    const pos = new THREE.Vector3(
      h.target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      h.target.y + Math.sin(pitch) * dist,
      h.target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    this.flyTo(pos, h.target.clone(), instant ? 0 : 0.9);
  }

  /** Frame the package front so the sticker is readable. */
  labelCamera(center: THREE.Vector3, normal: THREE.Vector3, width: number, instant = false) {
    this.resetFog();
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const aspect = this.camera.aspect;
    // the sticker should fill ~45% of the screen width (more on phones)
    const frac = aspect < 1 ? 0.8 : 0.42;
    const visW = width / frac;
    const dist = THREE.MathUtils.clamp(visW / aspect / 2 / Math.tan(vFov / 2), 1.1, 4.2);
    const dir = normal.clone().setY(normal.y + 0.42).normalize();
    const pos = center.clone().addScaledVector(dir, dist);
    this.flyTo(pos, center.clone().add(new THREE.Vector3(0, -0.04, 0)), instant ? 0 : 0.8);
  }

  focusCamera(): FocusView | null {
    if (!this.item) return null;
    const f = this.item.focusView();
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const fill = 0.8;
    const fitH = f.size / fill;
    const fitW = f.size / fill / Math.min(1, this.camera.aspect);
    const dist = Math.max(fitH, fitW) / 2 / Math.tan(vFov / 2);
    const pos = f.center.clone().add(f.normal.clone().multiplyScalar(dist));
    if (Math.abs(f.normal.y) > 0.9) pos.addScaledVector(f.up, -dist * 0.004);
    this.flyTo(pos, f.center.clone(), 0.8);
    // calm everything behind the code into flat fog so scanners only see the code
    const fog = this.scene.fog as THREE.Fog;
    fog.near = dist + f.size * 0.6;
    fog.far = dist + f.size * 0.6 + 1.2;
    return f;
  }

  /** Normal soft fog for the hero view. */
  private resetFog() {
    const fog = this.scene.fog as THREE.Fog;
    fog.near = 10;
    fog.far = 24;
  }

  private flyTo(pos: THREE.Vector3, target: THREE.Vector3, dur: number) {
    this.tweens.cancel('camera');
    const p0 = this.camera.position.clone();
    const t0 = this.controls.target.clone();
    this.controls.enabled = false;
    const apply = (t: number) => {
      this.controls.target.lerpVectors(t0, target, t);
      this.camera.position.lerpVectors(p0, pos, t);
      this.camera.lookAt(this.controls.target);
    };
    if (dur <= 0) {
      apply(1);
      this.controls.enabled = this.active;
      this.controls.update();
      return;
    }
    void this.tweens.tween(dur, apply, ease.inOutCubic, 'camera').then(() => {
      this.controls.enabled = this.active;
      this.controls.update();
    });
  }

  private setNdc(e: PointerEvent) {
    const rect = this.controls.domElement!.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  private onPointer(kind: 'down' | 'move' | 'up', e: PointerEvent) {
    if (!this.active) return;
    if (kind === 'down') {
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.setNdc(e);
      if (this.item?.pointer) {
        const hit = this.raycaster.intersectObject(this.item.root, true)[0] ?? null;
        if (this.item.pointer('down', hit, this.raycaster.ray)) {
          this.interacting = true;
          this.controls.enabled = false;
        }
      }
      return;
    }
    if (kind === 'move') {
      if (this.interacting && this.item?.pointer) {
        this.setNdc(e);
        const hit = this.raycaster.intersectObject(this.item.root, true)[0] ?? null;
        this.item.pointer('move', hit, this.raycaster.ray);
      }
      return;
    }
    if (this.interacting) {
      this.item?.pointer?.('up', null, this.raycaster.ray);
      this.interacting = false;
      this.controls.enabled = true;
    }
    const d = this.down;
    this.down = null;
    if (!d || e.target !== this.controls.domElement) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8 && performance.now() - d.t < 600) {
      this.setNdc(e);
      this.onClick(this.raycaster.ray.clone(), this.ndc.clone());
    }
  }

  /** Raycast helper for the app: intersections against any objects in this scene. */
  intersect(ray: THREE.Ray, objects: THREE.Object3D[], recursive = true) {
    this.raycaster.ray.copy(ray);
    return this.raycaster.intersectObjects(objects, recursive);
  }

  update(dt: number, time: number) {
    this.item?.update(dt, time, this.camera);
    this.clerk.update(dt, time, this.camera);
    this.sparkles.update(dt, this.camera, this.renderH);
    if (this.controls.enabled) this.controls.update();
  }

  resize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 1 ? 50 : 35;
    this.camera.updateProjectionMatrix();
  }
}
