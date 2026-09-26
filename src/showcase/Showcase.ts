import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Batcher } from '../engine/batch';
import { Painter, shade } from '../engine/Painter';
import { ease, type Tweens } from '../engine/tween';
import { toonGradient } from '../engine/voxel';
import { buildGondola, STORE } from '../store/fixtures';
import type { ShowcaseItem, FocusView } from '../products/types';

function counterTexture() {
  const p = new Painter(32, 32);
  p.clear('#f3ede2');
  for (let i = 0; i < 60; i++) p.px(Math.floor(Math.random() * 32), Math.floor(Math.random() * 32), '#e6dccb');
  for (let i = 0; i < 12; i++) p.px(Math.floor(Math.random() * 32), Math.floor(Math.random() * 32), '#d9ccb5');
  return p.texture(true);
}

/**
 * The "demo counter": a studio stage in front of blurred-out shelves where the selected product
 * performs its QR reveal. The camera orbits/pans freely and can snap to a straight-on scan view.
 */
export class Showcase {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.05, 60);
  readonly controls: OrbitControls;
  item: ShowcaseItem | null = null;
  focusMode = false;
  /** Only the active scene may take over pointer input. */
  active = false;
  private key: THREE.DirectionalLight;
  private stage = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private interacting = false;
  private turntable = 0;

  constructor(dom: HTMLElement, private tweens: Tweens) {
    this.scene.background = new THREE.Color('#1c2238');
    this.scene.fog = new THREE.Fog('#1c2238', 9, 22);

    const hemi = new THREE.HemisphereLight('#fff6ea', '#6f7598', 1.5);
    this.scene.add(hemi);
    this.key = new THREE.DirectionalLight('#fff3df', 2.4);
    this.key.position.set(-3, 7, 5);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    const sc = this.key.shadow.camera;
    sc.left = -4;
    sc.right = 4;
    sc.top = 4;
    sc.bottom = -4;
    sc.near = 1;
    sc.far = 20;
    this.key.shadow.bias = -0.0008;
    this.key.shadow.normalBias = 0.015;
    this.scene.add(this.key);
    const rim = new THREE.DirectionalLight('#9fd8ff', 0.9);
    rim.position.set(4, 3, -4);
    this.scene.add(rim);

    // counter top
    const tex = counterTexture();
    tex.repeat.set(20, 8);
    const top = new THREE.Mesh(new THREE.BoxGeometry(22, 0.2, 9), new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient() }));
    top.position.set(0, -0.1, 1.9);
    top.receiveShadow = true;
    this.scene.add(top);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(22.02, 0.06, 9.02), new THREE.MeshToonMaterial({ color: '#2ec4b6', gradientMap: toonGradient() }));
    edge.position.set(0, -0.2, 1.9);
    this.scene.add(edge);

    // blurred store backdrop: shelves further back
    const b = new Batcher();
    const off = STORE.shelfFrontZ;
    buildGondola(b, -6, -2, { seed: 91 });
    buildGondola(b, -2, 2, { seed: 92 });
    buildGondola(b, 2, 6, { seed: 93 });
    const shelves = b.build({ castShadow: false });
    shelves.position.set(0, -1.1, -3.2 - off);
    shelves.scale.setScalar(1.25);
    this.scene.add(shelves);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), new THREE.MeshBasicMaterial({ color: shade('#cfe6de', -0.35) }));
    wall.position.set(0, 2, -6.5);
    this.scene.add(wall);

    this.scene.add(this.stage);

    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 11;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.screenSpacePanning = true;
    this.controls.enabled = false;
    this.controls.addEventListener('start', () => (this.turntable = 0));

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
    if (item) {
      this.stage.add(item.root);
      this.heroCamera(true);
    }
  }

  /** Put the camera at the item's hero framing. */
  heroCamera(instant = false) {
    if (!this.item) return;
    const h = this.item.hero;
    const yaw = h.yaw ?? 0;
    const pitch = h.pitch ?? 0.35;
    // back off when UI covers part of the screen, and far enough that ~4.4 units fit across
    const vf = THREE.MathUtils.degToRad(this.camera.fov);
    const halfH = Math.atan(Math.tan(vf / 2) * this.camera.aspect * (this.visibleX ?? 1));
    const dist = Math.max(h.distance / (0.55 + 0.45 * this.visible), 2.2 / Math.tan(halfH));
    const pos = new THREE.Vector3(
      h.target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      h.target.y + Math.sin(pitch) * dist,
      h.target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    this.flyTo(pos, h.target.clone(), instant ? 0 : 0.9);
  }

  focusCamera(): FocusView | null {
    if (!this.item) return null;
    const f = this.item.focusView();
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const fill = 0.8 * this.visible;
    const fitH = f.size / fill;
    const fitW = f.size / fill / Math.min(1, this.camera.aspect);
    const dist = Math.max(fitH, fitW) / 2 / Math.tan(vFov / 2);
    const pos = f.center.clone().add(f.normal.clone().multiplyScalar(dist));
    // Looking straight down is degenerate for a y-up camera; tip it a hair so screen-up = f.up.
    if (Math.abs(f.normal.y) > 0.9) pos.addScaledVector(f.up, -dist * 0.004);
    this.flyTo(pos, f.center.clone(), 0.8);
    return f;
  }

  private flyTo(pos: THREE.Vector3, target: THREE.Vector3, dur: number) {
    this.tweens.cancel('camera');
    const p0 = this.camera.position.clone();
    const t0 = this.controls.target.clone();
    this.controls.enabled = false;
    // move along a slight arc through spherical coords around the target for a nicer swoop
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

  private onPointer(kind: 'down' | 'move' | 'up', e: PointerEvent) {
    if (!this.item?.pointer) return;
    if (kind === 'up') {
      if (this.interacting) {
        this.item.pointer('up', null, this.raycaster.ray);
        this.interacting = false;
        this.controls.enabled = true;
      }
      return;
    }
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.item.root, true);
    const hit = hits[0] ?? null;
    if (kind === 'down') {
      if (this.item.pointer('down', hit, this.raycaster.ray)) {
        this.interacting = true;
        this.controls.enabled = false;
      }
    } else if (this.interacting) this.item.pointer('move', hit, this.raycaster.ray);
  }

  update(dt: number, time: number) {
    this.item?.update(dt, time, this.camera);
    if (this.controls.enabled) this.controls.update();
    void this.turntable;
  }

  /** Shift the projection so the stage centres in the part of the screen not covered by UI. */
  private visible = 1;
  private visibleX = 1;

  setOcclusion(cssW: number, cssH: number, left: number, bottom: number) {
    this.visible = Math.min((cssW - left) / cssW, (cssH - bottom) / cssH);
    this.visibleX = (cssW - left) / cssW;
    if (!left && !bottom) this.camera.clearViewOffset();
    else this.camera.setViewOffset(cssW, cssH, -left / 2, bottom / 2, cssW, cssH);
    this.camera.updateProjectionMatrix();
  }

  resize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 1 ? 48 : 35;
    this.camera.updateProjectionMatrix();
  }
}
