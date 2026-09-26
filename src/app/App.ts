import * as THREE from 'three';
import { DEFAULT_LOOK, PixelRenderer } from '../engine/PixelRenderer';
import { Tweens, ease } from '../engine/tween';
import { audio } from '../engine/audio';
import { Store, type ShelfItem } from '../store/Store';
import { Showcase } from '../showcase/Showcase';
import { makeQR, type QRMatrix } from '../qr/qr';
import { canvasToBlob, copyCanvas, disableViewerDownloads, downloadBlob, scanCanvas, slug, viewerDownloads } from '../qr/export';
import { imageToPixelArt, loadImage, openVideo, videoToPixelArt } from '../qr/pixelCapture';
import { PRODUCTS, productById } from '../products';
import type { LabelAnchor, ProductContext, ProductDef } from '../products/types';
import type { PixelArt } from '../qr/pixelCodec';
import { GameState } from './state';
import { buildPayload, defaultContent, DEFAULT_LINK, postcardBase, type ContentState } from './content';
import { Sticker } from './Sticker';
import { h } from '../ui/dom';
import { anyModalOpen, closeTopModal, toast } from '../ui/overlay';
import { openPayScreen } from '../ui/PayScreen';
import { openSaveImage } from '../ui/save';
import { Hints } from '../ui/Hints';
import { iconImg } from '../art/icons';
import { drawLogo } from '../art/brand';
import { pixelTexture } from '../art/pixel';
import { STORE } from '../store/layout';

type Mode = 'title' | 'walking' | 'store' | 'showcase';

/** Embedded in another page (a sandboxed preview), where downloads started by the page are blocked. */
const FRAMED = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

export class App {
  readonly pixel: PixelRenderer;
  readonly tweens = new Tweens();
  readonly state = new GameState();
  readonly store: Store;
  readonly showcase: Showcase;
  readonly sticker: Sticker;
  readonly hints: Hints;
  mode: Mode = 'title';
  product: ProductDef | null = null;
  content: ContentState = defaultContent();
  qr: QRMatrix = makeQR(DEFAULT_LINK);
  label = 'Xolotl Kobini';
  art: PixelArt | null = null;
  revealed = false;
  revealing = false;
  /** The QR changed since the item was built (rebuild before opening). */
  private stale = false;
  private status: 'ok' | 'error' | 'empty' = 'ok';
  private last = performance.now();
  private time = 0;
  private transitioning = false;
  private revealRun = 0;
  private qrToken = 0;
  private contentTimer = 0;
  private backBtn: HTMLButtonElement;
  private soundBtn: HTMLButtonElement;
  private scanFrame: HTMLElement;
  private fileInput: HTMLInputElement;
  private fileMode: 'image' | 'video' = 'image';
  private idle = 0;
  private posterTex: THREE.Texture | null = null;

  constructor(private root: HTMLElement) {
    this.pixel = new PixelRenderer(root);
    const mask = pixelTexture(drawLogo(64, { badge: false }).toCanvas());
    this.pixel.iris.mask = mask;
    this.pixel.transitionColor.set('#f59ab6');
    audio.setMuted(!this.state.data.sound);

    this.store = new Store(this.pixel.canvas, this.tweens);
    this.store.owns = (p) => this.state.owns(p);
    this.store.refreshOwnership();
    this.store.onPick = (item) => this.pick(item);
    this.showcase = new Showcase(this.pixel.canvas, this.tweens);
    this.showcase.onClick = (ray) => this.stageClick(ray);

    this.sticker = new Sticker(root, {
      onChange: () => this.contentChanged(),
      onPickFile: (m) => this.pickFile(m),
      onSubmit: () => this.hintNext(),
    });
    this.hints = new Hints(root);

    this.backBtn = h('button', { class: 'kb-btn back', 'aria-label': 'Back to the aisles', hidden: true, onclick: () => this.back() }, iconImg('back', 3, { fill: '#5a3a26' }));
    this.soundBtn = h('button', { class: 'kb-btn sound', 'aria-label': 'Sound on or off', onclick: () => this.toggleSound() }, iconImg(this.state.data.sound ? 'soundOn' : 'soundOff', 2, { fill: '#5a3a26' }));
    this.scanFrame = h('div', { class: 'scan-frame', hidden: true }, h('i'), h('i'), h('i'), h('i'));
    this.fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: () => void this.fileChosen() });
    root.append(this.backBtn, this.soundBtn, this.scanFrame, this.fileInput);

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('paste', (e) => this.onPaste(e));
    this.pixel.canvas.addEventListener('click', () => {
      if (this.mode === 'title') void this.walkIn(false);
    });
    this.resize();
    void viewerDownloads();
    (window as unknown as { __app: App }).__app = this;
  }

  // -----------------------------------------------------------------------------------------------

  resize() {
    const w = this.root.clientWidth || window.innerWidth;
    const hh = this.root.clientHeight || window.innerHeight;
    if (this.mode === 'showcase') this.pixel.setTargetLines(this.showcase.focusMode ? 380 : 460, 1, 4);
    else this.pixel.setTargetLines(430, 1, 4);
    this.pixel.resize(w, hh);
    this.store.renderH = this.showcase.renderH = this.pixel.height;
    this.store.fitAspect(this.pixel.aspect);
    this.showcase.resize(this.pixel.aspect);
  }

  private toggleSound() {
    audio.unlock();
    const on = !this.state.data.sound;
    this.state.setSound(on);
    audio.setMuted(!on);
    this.soundBtn.replaceChildren(iconImg(on ? 'soundOn' : 'soundOff', 2, { fill: '#5a3a26' }));
    if (on) audio.play('blip');
  }

  private onKey(e: KeyboardEvent) {
    const typing = (e.target as HTMLElement)?.closest?.('input,textarea,select');
    if (e.key === 'Escape') {
      if (closeTopModal()) return;
      if (this.mode === 'showcase') {
        if (this.showcase.focusMode) this.toggleFocus(false);
        else this.back();
      } else if (this.mode === 'store' && this.store.targetZoom > 0) this.store.zoomAt(null, null, -1);
      return;
    }
    if (typing || anyModalOpen()) return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (this.mode === 'title') {
        e.preventDefault();
        void this.walkIn(false);
      } else if (this.mode === 'showcase' && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
        if (this.revealing) this.skip();
        else if (!this.revealed) void this.openPack();
      }
    } else if (this.mode === 'showcase' && this.sticker.attached && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      // start typing anywhere on the stage: the sticker takes the keys
      this.sticker.focus();
    }
  }

  private onPaste(e: ClipboardEvent) {
    if (this.mode !== 'showcase' || !this.sticker.attached) return;
    if ((e.target as HTMLElement)?.closest?.('input,textarea')) return;
    const text = e.clipboardData?.getData('text') ?? '';
    if (!text.trim()) return;
    e.preventDefault();
    this.sticker.paste(text);
    audio.play('pop', { rate: 1.3 });
  }

  // -----------------------------------------------------------------------------------------------
  // title → store

  async walkIn(fast: boolean) {
    if (this.mode !== 'title') return;
    audio.unlock();
    this.hints.hideAll();
    this.mode = 'walking';
    if (fast) this.store.skipIntro();
    else await this.store.walkIn();
    this.mode = 'store';
    if (!this.state.seen('drag')) {
      const r = this.pixel.canvas.getBoundingClientRect();
      window.setTimeout(() => {
        if (this.mode !== 'store') return;
        this.hints.show('drag', r.left + r.width / 2, r.top + r.height * 0.72, 'drag');
        window.setTimeout(() => this.hints.hide('drag'), 3800);
        this.state.markSeen('drag');
      }, fast ? 0 : 1200);
    }
  }

  /** Iris wipe (axolotl-shaped) closing on a screen point, swap, then opening. */
  private async iris(center: { x: number; y: number }, midpoint: () => void) {
    this.transitioning = true;
    const r = this.pixel.canvas.getBoundingClientRect();
    this.pixel.iris.center.set((center.x - r.left) / r.width, 1 - (center.y - r.top) / r.height);
    this.pixel.iris.on = true;
    this.pixel.iris.radius = 3;
    await this.tweens.tween(0.45, (t) => (this.pixel.iris.radius = THREE.MathUtils.lerp(3, 0, t)), ease.inCubic, 'transition');
    midpoint();
    this.pixel.iris.center.set(0.5, 0.5);
    await this.tweens.tween(0.55, (t) => (this.pixel.iris.radius = THREE.MathUtils.lerp(0, 3, t)), ease.outCubic, 'transition');
    this.pixel.iris.on = false;
    this.transitioning = false;
  }

  private pick(item: ShelfItem) {
    if (this.transitioning || this.mode !== 'store') return;
    if (!this.state.owns(item.product)) {
      this.store.focusItem(item);
      openPayScreen(item.product, this.state, () => {
        this.store.refreshOwnership();
        const c = new THREE.Vector3();
        item.hit.getWorldPosition(c);
        this.store.sparkle(c, ['#ffd66b', '#ffffff', '#f47c9f']);
        window.setTimeout(() => void this.openProduct(item.product.id, item), 350);
      });
      return;
    }
    void this.openProduct(item.product.id, item);
  }

  async openProduct(id: string, item?: ShelfItem) {
    const p = productById(id);
    if (!p || this.transitioning || this.mode !== 'store') return;
    this.product = p;
    this.hints.hideAll();
    this.store.enabled = false;
    const c = new THREE.Vector3();
    if (item) item.hit.getWorldPosition(c);
    const at = item ? this.store.screenOf(c) : { x: innerWidth / 2, y: innerHeight / 2 };
    if (p.preferredMode && this.content.mode === 'link' && this.content.link === DEFAULT_LINK) this.content.mode = p.preferredMode;
    await this.iris(at, () => {
      this.mode = 'showcase';
      this.showcase.active = true;
      this.backBtn.hidden = false;
      this.resize();
      this.buildItem();
      this.frameLabel(true);
      void this.showcase.clerk.wave();
    });
    this.contentChanged(true);
    this.hintNext();
  }

  back() {
    if (this.mode === 'showcase') void this.closeProduct();
  }

  async closeProduct() {
    if (this.transitioning || this.mode !== 'showcase') return;
    audio.play('back');
    this.hints.hideAll();
    await this.iris({ x: innerWidth / 2, y: innerHeight / 2 }, () => {
      this.setScanMode(false);
      this.sticker.detach();
      this.showcase.clerk.hideReceipt();
      this.mode = 'store';
      this.showcase.active = false;
      this.showcase.setItem(null);
      this.product = null;
      this.backBtn.hidden = true;
      this.store.enabled = true;
      this.resize();
    });
  }

  private ctx(group = 'item'): ProductContext {
    return { qr: this.qr, flavor: this.product!.flavors[0], art: this.art, label: this.label, tweens: this.tweens, group };
  }

  get owned() {
    return !!this.product && this.state.owns(this.product);
  }

  /** Build the unopened package with the sticker on it. */
  buildItem() {
    if (!this.product) return;
    this.revealRun++;
    this.tweens.cancel('item');
    this.sticker.detach();
    const item = this.product.createShowcase(this.ctx());
    this.showcase.setItem(item);
    this.revealed = false;
    this.revealing = false;
    this.stale = false;
    this.showcase.clerk.hideReceipt();
    this.sticker.attach(item.label ?? this.defaultLabel(item.root));
    this.sticker.setContent(this.content, this.status);
  }

  /** A sticker on the front of whatever the product built, when it didn't say where. */
  private defaultLabel(root: THREE.Object3D): LabelAnchor {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const w = THREE.MathUtils.clamp(size.x * 0.55, 0.35, 0.8);
    return { object: root, position: new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y + size.y * 0.55, box.max.z + 0.02), size: [w, w * 0.6] };
  }

  /** Aim the camera at the sticker so it's readable. */
  private frameLabel(instant = false) {
    const m = this.sticker.mesh;
    if (!m.parent) {
      this.showcase.heroCamera(instant);
      return;
    }
    m.updateMatrixWorld(true);
    const c = new THREE.Vector3();
    m.getWorldPosition(c);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion()));
    const wScale = new THREE.Vector3();
    m.getWorldScale(wScale);
    this.showcase.labelCamera(c, n, Math.max(0.3, wScale.x), instant);
  }

  // -----------------------------------------------------------------------------------------------
  // content → QR

  contentChanged(immediate = false) {
    window.clearTimeout(this.contentTimer);
    this.contentTimer = window.setTimeout(() => void this.recompute(), immediate ? 0 : 220);
  }

  private async recompute() {
    const token = ++this.qrToken;
    const payload = await buildPayload(this.content);
    if (token !== this.qrToken) return;
    let qr: QRMatrix | null = null;
    try {
      qr = makeQR(payload.text, this.content.ec);
    } catch {
      qr = null;
    }
    this.status = !qr ? 'error' : payload.error ? 'empty' : 'ok';
    if (payload.error && /paste|enter/i.test(payload.error)) this.status = 'empty';
    if (qr && !payload.error && (qr.text !== this.qr.text || payload.art !== this.art)) {
      this.qr = qr;
      this.label = payload.label;
      this.art = payload.art;
      this.stale = true;
    }
    if (this.sticker.attached) this.sticker.setContent(this.content, this.status);
  }

  /** Test hook / programmatic content: set the code text directly and rebuild. */
  setQR(text: string, label: string, art: PixelArt | null = this.art, qr?: QRMatrix) {
    // a pending sticker recompute must not overwrite an explicit code
    window.clearTimeout(this.contentTimer);
    this.qrToken++;
    this.qr = qr ?? makeQR(text, this.content.ec);
    this.label = label;
    this.art = art;
    this.status = 'ok';
    if (this.mode === 'showcase') {
      const was = this.revealed || this.revealing;
      const scan = this.showcase.focusMode;
      this.setScanMode(false);
      this.buildItem();
      if (was) {
        this.finishNow();
        if (scan) this.toggleFocus(true);
      }
    }
  }

  private pickFile(mode: 'image' | 'video') {
    this.fileMode = mode;
    this.fileInput.accept = mode === 'image' ? 'image/*' : 'video/*';
    this.fileInput.value = '';
    this.fileInput.click();
  }

  private async fileChosen() {
    const file = this.fileInput.files?.[0];
    if (!file) return;
    try {
      if (this.fileMode === 'image') {
        const img = await loadImage(file);
        this.content.image = imageToPixelArt(img, { size: 24, colors: 8, dither: false, caption: '' });
        this.content.mode = 'image';
      } else {
        const cap = await openVideo(file);
        this.content.video = await videoToPixelArt(cap, { size: 16, colors: 8, dither: false, caption: '', frames: 6, fps: 5, start: 0 });
        this.content.mode = 'video';
      }
      audio.play('pop');
      this.contentChanged(true);
    } catch {
      toast('That file did not open', 'bad');
    }
  }

  // -----------------------------------------------------------------------------------------------
  // stage interaction

  private stageClick(ray: THREE.Ray) {
    if (this.transitioning || anyModalOpen()) return;
    this.idle = 0;
    if (this.revealing) {
      this.skip();
      return;
    }
    const item = this.showcase.item;
    if (!item) return;
    const targets: THREE.Object3D[] = [item.root, this.showcase.clerk.hit];
    if (this.showcase.clerk.receipt.visible) targets.unshift(this.showcase.clerk.receipt);
    const hits = this.showcase.intersect(ray, targets);
    const hit = hits.find((hh) => hh.object.visible !== false);
    if (!hit) {
      if (this.showcase.focusMode) this.toggleFocus(false);
      return;
    }
    const o = hit.object;
    if (o === this.sticker.mesh && hit.uv) {
      audio.play('blip', { rate: 1.3 });
      this.sticker.tap(hit.uv);
      this.hints.hide('sticker');
      return;
    }
    if (o === this.showcase.clerk.receipt || isChildOf(o, this.showcase.clerk.receipt)) {
      this.hints.hide('receipt');
      this.state.markSeen('receipt');
      void this.save();
      return;
    }
    if (o.userData.clerk || isChildOf(o, this.showcase.clerk.root)) {
      audio.play('ding', { rate: 1.2 });
      if (this.revealed) this.another();
      else void this.showcase.clerk.wave();
      return;
    }
    // the product itself
    if (!this.revealed) {
      void this.openPack();
      return;
    }
    if (this.hitsQR(ray)) {
      this.hints.hide('qr');
      this.state.markSeen('qr');
      this.toggleFocus();
      return;
    }
    if (item.extra) {
      if (this.showcase.focusMode) this.toggleFocus(false);
      void item.extra.run();
    }
  }

  /** Does a ray hit the finished QR square? */
  private hitsQR(ray: THREE.Ray) {
    const item = this.showcase.item;
    if (!item) return false;
    const f = item.focusView();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(f.normal, f.center);
    const p = ray.intersectPlane(plane, new THREE.Vector3());
    if (!p) return false;
    const right = new THREE.Vector3().crossVectors(f.up, f.normal).normalize();
    const d = p.sub(f.center);
    return Math.abs(d.dot(right)) < f.size * 0.55 && Math.abs(d.dot(f.up)) < f.size * 0.55;
  }

  /** Tap the package: peel the sticker, rebuild with the latest code, play the reveal. */
  async openPack() {
    const item = this.showcase.item;
    if (!item || !this.owned || this.revealing || this.revealed) return;
    if (this.status === 'error') {
      audio.play('error');
      this.sticker.setContent(this.content, 'error');
      return;
    }
    this.hints.hideAll();
    this.sticker.input.blur();
    if (this.stale) {
      this.buildItem();
      this.frameLabel(true);
    }
    await this.sticker.peel(this.tweens, 'item');
    this.showcase.heroCamera();
    void this.showcase.clerk.point();
    await this.reveal();
  }

  async reveal() {
    const item = this.showcase.item;
    if (!item || !this.owned || this.revealing) return;
    if (this.revealed) this.buildItem();
    this.sticker.detach();
    this.setScanMode(false);
    const run = ++this.revealRun;
    this.revealing = true;
    await this.showcase.item!.reveal();
    if (run !== this.revealRun) return;
    this.onRevealed();
  }

  private finishNow() {
    this.sticker.detach();
    this.showcase.item?.finish();
    this.onRevealed();
  }

  skip() {
    if (!this.revealing) return;
    this.revealRun++;
    this.finishNow();
  }

  private onRevealed() {
    const first = !this.revealed;
    this.revealing = false;
    this.revealed = true;
    if (!first) return;
    this.state.addMade();
    const f = this.showcase.item?.focusView();
    if (f) {
      const sp = this.showcase.sparkles;
      sp.burst('star', f.center.clone().add(new THREE.Vector3(0, 0.2, 0)), { count: 8, speed: 1.4, up: 1.6, size: 0.16, life: 1.2, gravity: 1.5, jitter: f.size * 0.6 });
      sp.burst('heart', f.center.clone().add(new THREE.Vector3(0, 0.3, 0)), { count: 6, speed: 0.8, up: 1.2, size: 0.14, life: 1.5, gravity: -0.2, jitter: f.size * 0.5 });
      sp.burst('music', f.center.clone().add(new THREE.Vector3(-0.3, 0.4, 0)), { count: 3, speed: 0.4, up: 0.8, size: 0.14, life: 1.6, gravity: -0.3 });
    }
    void this.showcase.clerk.cheer().then(() => {
      if (this.mode !== 'showcase' || !this.revealed) return;
      void this.showcase.clerk.print(this.receiptTexture());
    });
    this.idle = 0;
  }

  private receiptTexture() {
    if (!this.product) return undefined;
    this.posterTex?.dispose();
    const c = this.product.poster(this.ctx('poster'));
    this.posterTex = pixelTexture(c);
    return this.posterTex;
  }

  /** "Another one!": a fresh unopened pack with the same sticker text. */
  another() {
    audio.play('whoosh');
    this.setScanMode(false);
    this.buildItem();
    this.frameLabel();
    this.hintNext();
  }

  private setScanMode(on: boolean) {
    if (this.showcase.focusMode === on) return;
    this.toggleFocus(on);
  }

  toggleFocus(on = !this.showcase.focusMode) {
    const item = this.showcase.item;
    if (!item) return;
    if (on && !this.revealed) {
      this.revealRun++;
      this.finishNow();
    }
    this.showcase.focusMode = on;
    item.setScanMode?.(on);
    this.pixel.look.normalEdge = on ? 0 : DEFAULT_LOOK.normalEdge;
    this.pixel.look.depthEdge = on ? 0.2 : DEFAULT_LOOK.depthEdge;
    this.pixel.look.vignette = on ? 0 : DEFAULT_LOOK.vignette;
    this.scanFrame.hidden = !on;
    if (this.mode === 'showcase') this.resize();
    if (on) {
      audio.play('ding');
      this.showcase.focusCamera();
    } else this.showcase.heroCamera();
  }

  /** Read the QR code straight off the rendered 3D frame (proves the scene itself scans). */
  scanView(): string | null {
    const src = this.pixel.canvas;
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d')!.drawImage(src, 0, 0);
    return scanCanvas(c, 1400);
  }

  // -----------------------------------------------------------------------------------------------
  // hints

  /** Point at the next thing to do. */
  private hintNext() {
    if (this.mode !== 'showcase') return;
    this.hints.hideAll();
    this.idle = 0;
  }

  private updateHints(dt: number) {
    this.idle += dt;
    const cam = this.showcase.camera;
    const canvas = this.pixel.canvas;
    if (this.mode === 'title') {
      const door = new THREE.Vector3(STORE.doorX, 1.3, STORE.frontZ).project(this.store.camera);
      const r = canvas.getBoundingClientRect();
      this.hints.show('door', r.left + ((door.x + 1) / 2) * r.width, r.top + ((1 - door.y) / 2) * r.height);
      return;
    }
    if (this.mode !== 'showcase' || this.transitioning || anyModalOpen()) return;
    const item = this.showcase.item;
    if (!item) return;
    const typing = document.activeElement === this.sticker.input;
    if (!this.revealed && !this.revealing && this.sticker.attached) {
      // first: the sticker; once there's a code: the package
      if (this.status !== 'ok' || !this.state.seen('sticker')) {
        if (this.idle > 1.2 && !typing) {
          const p = this.sticker.screenCenter(cam, canvas);
          this.hints.show('sticker', p.x, p.y);
        }
        if (typing) this.state.markSeen('sticker');
      } else {
        this.hints.hide('sticker');
        if (this.idle > (this.state.seen('open') ? 6 : 1.5) && !typing) {
          const box = new THREE.Box3().setFromObject(item.root);
          const top = new THREE.Vector3((box.min.x + box.max.x) / 2 + (box.max.x - box.min.x) * 0.3, box.max.y * 0.8, box.max.z);
          const s = project(top, cam, canvas);
          this.hints.show('open', s.x, s.y);
        }
      }
      if (typing) this.hints.hide('open');
      return;
    }
    this.hints.hide('sticker');
    this.hints.hide('open');
    if (this.revealed && !this.showcase.focusMode) {
      this.state.markSeen('open');
      if (!this.state.seen('qr') && this.idle > 1.5) {
        const f = item.focusView();
        const s = project(f.center, cam, canvas);
        this.hints.show('qr', s.x, s.y);
      } else if (this.showcase.clerk.receipt.visible && !this.state.seen('receipt') && this.idle > 3) {
        const v = new THREE.Vector3();
        this.showcase.clerk.receipt.getWorldPosition(v);
        const s = project(v, cam, canvas);
        this.hints.show('receipt', s.x, s.y);
      }
    } else {
      this.hints.hide('qr');
      this.hints.hide('receipt');
    }
  }

  private updateScanFrame() {
    if (this.scanFrame.hidden || !this.showcase.item) return;
    const f = this.showcase.item.focusView();
    const right = new THREE.Vector3().crossVectors(f.up, f.normal).normalize();
    const pts = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].map(([a, b]) => project(f.center.clone().addScaledVector(right, (a * f.size) / 2).addScaledVector(f.up, (b * f.size) / 2), this.showcase.camera, this.pixel.canvas));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const pad = 10;
    Object.assign(this.scanFrame.style, {
      left: `${Math.min(...xs) - pad}px`,
      top: `${Math.min(...ys) - pad}px`,
      width: `${Math.max(...xs) - Math.min(...xs) + pad * 2}px`,
      height: `${Math.max(...ys) - Math.min(...ys) + pad * 2}px`,
    });
  }

  // -----------------------------------------------------------------------------------------------
  // saving

  async save() {
    if (!this.product || !this.owned) return;
    audio.play('register');
    const name = `xolotl-kobini-${this.product.id}-${slug(this.label)}`;
    const canvas = this.product.poster(this.ctx('poster'));
    const file = `${name}.png`;
    await this.saveFile(await canvasToBlob(canvas), file, () => openSaveImage(canvas.toDataURL('image/png'), file, () => copyCanvas(canvas)));
  }

  /** Save through the artifact viewer when hosted there, else as a normal download; framed pages fall back to saving by hand. */
  private async saveFile(blob: Blob, file: string, byHand: () => void) {
    const viewer = await viewerDownloads();
    if (viewer) {
      try {
        await viewer.save({ filename: file, data: blob });
        toast('Saved', 'good', 'check');
        return;
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'declined') return;
        if (code === 'rate_limited') return;
        if (code === 'rejected_extension' || code === 'extension_not_enabled' || code === 'too_large' || code === 'bad_request' || code === 'transform_error') return toast('Could not save', 'bad');
        disableViewerDownloads();
      }
    }
    if (FRAMED) byHand();
    else {
      downloadBlob(blob, file);
      toast('Saved', 'good', 'download');
    }
  }

  // -----------------------------------------------------------------------------------------------
  // test hooks

  /** Build the current product's poster and try to scan it. */
  posterScan(): { ok: boolean; text: string | null; width: number; height: number } {
    if (!this.product) return { ok: false, text: null, width: 0, height: 0 };
    const c = this.product.poster(this.ctx('poster'));
    const text = scanCanvas(c, 1400);
    return { ok: text === this.qr.text, text, width: c.width, height: c.height };
  }

  /** Switch the content to a generated pixel postcard (1 frame) or flipbook (6 frames). */
  async useDemoArt(frames = 1) {
    const { demoPixelArt } = await import('../qr/demoArt');
    const { pixelArtUrl } = await import('../qr/pixelCodec');
    const art = demoPixelArt(frames);
    if (frames > 1) {
      this.content.mode = 'video';
      this.content.video = art;
    } else {
      this.content.mode = 'image';
      this.content.image = art;
    }
    const url = await pixelArtUrl(art, postcardBase());
    this.setQR(url, frames > 1 ? 'Pixel flipbook' : 'Pixel postcard', art);
    return url.length;
  }

  /** Simulate `seconds` of game time without rendering (headless tests run slowly). */
  async advance(seconds: number) {
    const dt = 1 / 60;
    for (let t = 0; t < seconds; t += dt) {
      this.time += dt;
      this.tweens.update(dt);
      if (this.mode === 'showcase') this.showcase.update(dt, this.time);
      else this.store.update(dt, this.time);
      for (let k = 0; k < 6; k++) await Promise.resolve();
    }
  }

  /** Test hook: jump into the aisles and open a product immediately. */
  async quickOpen(id: string, _flavorId?: string) {
    if (this.mode === 'title') await this.walkIn(true);
    if (this.mode === 'showcase') await this.closeProduct();
    const p = this.openProduct(id);
    await this.advance(1.2);
    await p;
  }

  start() {
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      this.tweens.update(dt);
      if (this.mode === 'showcase') {
        this.showcase.update(dt, this.time);
        this.sticker.update(dt, this.showcase.camera, this.pixel.canvas);
        this.updateScanFrame();
        this.pixel.render(this.showcase.scene, this.showcase.camera);
      } else {
        this.store.update(dt, this.time);
        this.pixel.render(this.store.scene, this.store.camera);
      }
      this.updateHints(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  get products() {
    return PRODUCTS;
  }
}

function project(v: THREE.Vector3, camera: THREE.Camera, canvas: HTMLCanvasElement) {
  const p = v.clone().project(camera);
  const r = canvas.getBoundingClientRect();
  return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
}

function isChildOf(o: THREE.Object3D, parent: THREE.Object3D) {
  let cur: THREE.Object3D | null = o;
  while (cur) {
    if (cur === parent) return true;
    cur = cur.parent;
  }
  return false;
}
