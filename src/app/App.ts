import { DEFAULT_LOOK, PixelRenderer } from '../engine/PixelRenderer';
import { Tweens, ease } from '../engine/tween';
import { audio } from '../engine/audio';
import { Store } from '../store/Store';
import { Showcase } from '../showcase/Showcase';
import { makeQR, type QRMatrix } from '../qr/qr';
import { scanCanvas } from '../qr/export';
import { PRODUCTS, productById } from '../products';
import type { Flavor, ProductDef } from '../products/types';
import type { PixelArt } from '../qr/pixelCodec';

type Mode = 'store' | 'showcase';

export class App {
  readonly pixel: PixelRenderer;
  readonly tweens = new Tweens();
  readonly store: Store;
  readonly showcase: Showcase;
  mode: Mode = 'store';
  product: ProductDef | null = null;
  flavor: Flavor | null = null;
  qr: QRMatrix = makeQR('https://pukkingdragon123.github.io/glowing-octo-chainsaw/');
  label = 'QR Market';
  art: PixelArt | null = null;
  revealed = false;
  private last = performance.now();
  private time = 0;
  private transitioning = false;
  private revealRun = 0;

  constructor(private root: HTMLElement) {
    this.pixel = new PixelRenderer(root);
    this.store = new Store();
    this.showcase = new Showcase(this.pixel.canvas, this.tweens);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    (window as unknown as { __app: App }).__app = this;
  }

  resize() {
    const w = this.root.clientWidth || window.innerWidth;
    const h = this.root.clientHeight || window.innerHeight;
    if (this.mode === 'store') this.pixel.setTargetLines(250, 2, 5);
    else this.pixel.setTargetLines(this.showcase.focusMode ? 420 : 330, 1, 4);
    this.pixel.resize(w, h);
    this.store.camera.aspect = this.pixel.aspect;
    this.store.camera.updateProjectionMatrix();
    this.showcase.resize(this.pixel.aspect);
  }

  private async dissolve(midpoint: () => void) {
    this.transitioning = true;
    this.pixel.newTransitionSeed();
    await this.tweens.tween(0.35, (t) => (this.pixel.transition = t), ease.inQuad, 'transition');
    midpoint();
    await this.tweens.tween(0.4, (t) => (this.pixel.transition = 1 - t), ease.outQuad, 'transition');
    this.pixel.transition = 0;
    this.transitioning = false;
  }

  buildItem() {
    if (!this.product || !this.flavor) return;
    this.revealRun++;
    this.tweens.cancel('item');
    const item = this.product.createShowcase({
      qr: this.qr,
      flavor: this.flavor,
      art: this.art,
      label: this.label,
      tweens: this.tweens,
      group: 'item',
    });
    this.showcase.setItem(item);
    this.revealed = false;
  }

  async openProduct(id: string, flavorId?: string) {
    const p = productById(id);
    if (!p || this.transitioning) return;
    this.product = p;
    this.flavor = p.flavors.find((f) => f.id === flavorId) ?? p.flavors[0];
    audio.play('select');
    await this.dissolve(() => {
      this.mode = 'showcase';
      this.buildItem();
      this.resize();
    });
  }

  async closeProduct() {
    if (this.transitioning) return;
    audio.play('back');
    await this.dissolve(() => {
      this.mode = 'store';
      this.showcase.setItem(null);
      this.product = null;
      this.resize();
    });
  }

  async reveal() {
    const item = this.showcase.item;
    if (!item) return;
    const run = ++this.revealRun;
    if (this.revealed) {
      this.buildItem();
    }
    const current = this.showcase.item!;
    await current.reveal();
    if (run === this.revealRun) this.revealed = true;
  }

  setQR(text: string, label: string) {
    this.qr = makeQR(text);
    this.label = label;
    if (this.mode === 'showcase') {
      const wasRevealed = this.revealed;
      this.buildItem();
      if (wasRevealed) {
        this.showcase.item?.finish();
        this.revealed = true;
      }
    }
  }

  toggleFocus(on = !this.showcase.focusMode) {
    const item = this.showcase.item;
    if (!item) return;
    this.showcase.focusMode = on;
    item.setScanMode?.(on);
    this.pixel.look.normalEdge = on ? 0 : DEFAULT_LOOK.normalEdge;
    this.pixel.look.depthEdge = on ? 0.2 : DEFAULT_LOOK.depthEdge;
    this.pixel.look.vignette = on ? 0 : DEFAULT_LOOK.vignette;
    this.resize();
    if (on) this.showcase.focusCamera();
    else {
      this.showcase.heroCamera();
    }
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

  /** Test hook: build the current product's poster and try to scan it. */
  posterScan(): { ok: boolean; text: string | null; width: number; height: number } {
    if (!this.product || !this.flavor) return { ok: false, text: null, width: 0, height: 0 };
    const c = this.product.poster({ qr: this.qr, flavor: this.flavor, art: this.art, label: this.label, tweens: this.tweens, group: 'poster' });
    const text = scanCanvas(c, 1400);
    return { ok: text === this.qr.text, text, width: c.width, height: c.height };
  }

  /** Test hook: switch the content to a generated pixel postcard (1 frame) or flipbook (6 frames). */
  async useDemoArt(frames = 1) {
    const { demoPixelArt } = await import('../qr/demoArt');
    const { pixelArtUrl } = await import('../qr/pixelCodec');
    this.art = demoPixelArt(frames);
    const url = await pixelArtUrl(this.art);
    this.setQR(url, frames > 1 ? 'Pixel flipbook' : 'Pixel postcard');
    return url.length;
  }

  /** Test hook: simulate `seconds` of game time without rendering. */
  async advance(seconds: number) {
    const dt = 1 / 60;
    for (let t = 0; t < seconds; t += dt) {
      this.time += dt;
      this.tweens.update(dt);
      if (this.mode === 'store') this.store.update(dt, this.time);
      else this.showcase.update(dt, this.time);
      // let awaited animation steps continue between frames
      for (let k = 0; k < 6; k++) await Promise.resolve();
    }
  }

  start() {
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      this.tweens.update(dt);
      if (this.mode === 'store') {
        this.store.update(dt, this.time);
        this.pixel.render(this.store.scene, this.store.camera);
      } else {
        this.showcase.update(dt, this.time);
        this.pixel.render(this.showcase.scene, this.showcase.camera);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  get products() {
    return PRODUCTS;
  }
}
