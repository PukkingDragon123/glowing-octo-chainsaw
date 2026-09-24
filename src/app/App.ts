import { DEFAULT_LOOK, PixelRenderer } from '../engine/PixelRenderer';
import { Tweens, ease } from '../engine/tween';
import { audio } from '../engine/audio';
import { Store, type ShelfItem } from '../store/Store';
import { Showcase } from '../showcase/Showcase';
import { makeQR, type QRMatrix } from '../qr/qr';
import { copyCanvas, downloadBlob, downloadCanvas, plainQRCanvas, qrSvg, scanCanvas, slug } from '../qr/export';
import { PRODUCTS, productById } from '../products';
import type { Flavor, ProductContext, ProductDef } from '../products/types';
import type { PixelArt } from '../qr/pixelCodec';
import { GameState } from './state';
import { buildPayload, defaultContent, DEFAULT_LINK, type ContentState } from './content';
import { Hud } from '../ui/Hud';
import { Panel } from '../ui/Panel';
import { anyModalOpen, closeTopModal, toast } from '../ui/overlay';
import { confirmUnlock, openHelp, openReceipts, openShop, showAd } from '../ui/Shop';
import { h, coinIcon } from '../ui/dom';
import { isProbablyUrl } from '../qr/payload';

type Mode = 'title' | 'walking' | 'store' | 'showcase';

export class App {
  readonly pixel: PixelRenderer;
  readonly tweens = new Tweens();
  readonly state = new GameState();
  readonly store: Store;
  readonly showcase: Showcase;
  readonly hud: Hud;
  readonly panel: Panel;
  mode: Mode = 'title';
  product: ProductDef | null = null;
  flavor: Flavor | null = null;
  content: ContentState = defaultContent();
  qr: QRMatrix = makeQR(DEFAULT_LINK);
  label = 'QR Market';
  art: PixelArt | null = null;
  revealed = false;
  revealing = false;
  private last = performance.now();
  private time = 0;
  private transitioning = false;
  private revealRun = 0;
  private qrToken = 0;
  private contentTimer = 0;
  private posterTimer = 0;
  private posterOk: boolean | null = null;
  private viewOk: boolean | null = null;
  private scanBanner: HTMLElement;
  private stageHint: HTMLElement;
  private lastBucks = 0;

  constructor(private root: HTMLElement) {
    this.pixel = new PixelRenderer(root);
    audio.setMuted(!this.state.data.sound);
    audio.musicOn = this.state.data.music;

    this.store = new Store(this.pixel.canvas, this.tweens);
    this.store.owns = (p) => this.state.owns(p.id, p.price);
    this.store.refreshOwnership();
    this.showcase = new Showcase(this.pixel.canvas, this.tweens);

    this.hud = new Hud(root, {
      onWallet: () => this.openShop(),
      onSound: () => {
        const on = !this.state.data.sound;
        this.state.setSound(on);
        audio.setMuted(!on);
        this.hud.setSound(on, this.state.data.music);
      },
      onMusic: () => {
        audio.unlock();
        const on = !this.state.data.music;
        this.state.setMusic(on);
        audio.setMusic(on);
        this.hud.setSound(this.state.data.sound, on);
      },
      onHelp: () => openHelp(),
      onReceipts: () => openReceipts(this.state, (pid, fid, text) => this.reopen(pid, fid, text)),
      onSection: (id) => this.store.jumpToSection(id),
      onStep: (d) => this.store.step(d),
      onWalkIn: () => void this.walkIn(false),
      onSkipIntro: () => void this.walkIn(true),
    });
    this.hud.owns = (item: ShelfItem) => this.state.owns(item.product.id, item.product.price);
    this.hud.setSound(this.state.data.sound, this.state.data.music);
    this.lastBucks = this.state.bucks;
    this.hud.setWallet(this.state.bucks);

    this.panel = new Panel(root, {
      onBack: () => void this.closeProduct(),
      onFlavor: (id) => this.setFlavor(id),
      onContent: () => this.contentChanged(),
      onReveal: () => void this.reveal(),
      onSkip: () => this.skip(),
      onScanMode: () => this.toggleFocus(),
      onExport: (k) => void this.exportAs(k),
      onUnlock: () => this.unlockCurrent(),
      onGetBucks: () => this.openShop(),
    });
    this.state.on((d) => {
      this.hud.setWallet(d.bucks, d.bucks > this.lastBucks);
      this.lastBucks = d.bucks;
      if (this.product) this.panel.renderLock(d.bucks);
    });

    this.scanBanner = h('div', { class: 'scan-banner', hidden: true }, '◎ SCAN MODE · point your phone camera at the screen');
    this.stageHint = h('div', { class: 'stage-hint', hidden: true }, 'DRAG: LOOK AROUND', h('br'), 'RIGHT-DRAG / SHIFT: PAN', h('br'), 'SCROLL / PINCH: ZOOM');
    root.append(this.scanBanner, this.stageHint);

    // store events
    this.store.onHover = (item, x, y) => {
      if (this.mode === 'store') this.hud.tooltip(item, x, y);
    };
    this.store.onPick = (item) => void this.openProduct(item.product.id, item.flavor.id);
    this.store.onRegister = () => this.openShop();
    this.store.onTV = () => showAd(this.state, () => {});
    this.store.onSection = (s) => this.hud.setSection(s.id);

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
    window.addEventListener('keydown', (e) => this.onKey(e));
    this.resize();
    (window as unknown as { __app: App }).__app = this;
  }

  // -----------------------------------------------------------------------------------------------

  resize() {
    const w = this.root.clientWidth || window.innerWidth;
    const h2 = this.root.clientHeight || window.innerHeight;
    if (this.mode === 'showcase') this.pixel.setTargetLines(this.showcase.focusMode ? 460 : 330, 1, 4);
    else this.pixel.setTargetLines(250, 2, 5);
    this.pixel.resize(w, h2);
    this.store.camera.aspect = this.pixel.aspect;
    this.store.camera.updateProjectionMatrix();
    this.showcase.resize(this.pixel.aspect);
    this.updateOcclusion();
  }

  /** Keep the showcase stage centred beside the receipt panel (desktop) or above the sheet (mobile). */
  updateOcclusion() {
    const w = this.root.clientWidth || window.innerWidth;
    const hh = this.root.clientHeight || window.innerHeight;
    const o = this.mode === 'showcase' ? this.panel.occlusion : { left: 0, bottom: 0 };
    this.showcase.setOcclusion(w, hh, o.left, o.bottom);
  }

  private onKey(e: KeyboardEvent) {
    const typing = (e.target as HTMLElement)?.closest?.('input,textarea,select');
    if (e.key === 'Escape') {
      if (closeTopModal()) return;
      if (this.mode === 'showcase') {
        if (this.showcase.focusMode) this.toggleFocus(false);
        else void this.closeProduct();
      }
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
        else void this.reveal();
      }
    }
  }

  async walkIn(fast: boolean) {
    if (this.mode !== 'title') return;
    audio.unlock();
    if (this.state.data.music) audio.setMusic(true);
    this.mode = 'walking';
    this.hud.setMode('walking');
    if (fast) this.store.skipIntro();
    else await this.store.walkIn();
    this.mode = 'store';
    this.hud.setMode('store');
    this.hud.setSection(this.store.section.id);
    this.hud.showHint(true);
    window.setTimeout(() => this.hud.showHint(false), 7000);
    if (this.state.dailyAvailable) window.setTimeout(() => toast('Daily bonus ready: tap your QRBucks!', 'good', coinIcon(14)), 1200);
  }

  private async dissolve(midpoint: () => void) {
    this.transitioning = true;
    this.pixel.newTransitionSeed();
    await this.tweens.tween(0.32, (t) => (this.pixel.transition = t), ease.inQuad, 'transition');
    midpoint();
    await this.tweens.tween(0.4, (t) => (this.pixel.transition = 1 - t), ease.outQuad, 'transition');
    this.pixel.transition = 0;
    this.transitioning = false;
  }

  private ctx(group = 'item'): ProductContext {
    return { qr: this.qr, flavor: this.flavor!, art: this.art, label: this.label, tweens: this.tweens, group };
  }

  get owned() {
    return !!this.product && this.state.owns(this.product.id, this.product.price);
  }

  buildItem() {
    if (!this.product || !this.flavor) return;
    this.revealRun++;
    this.tweens.cancel('item');
    this.showcase.setItem(this.product.createShowcase(this.ctx()));
    this.revealed = false;
    this.revealing = false;
    this.viewOk = null;
    this.panel.setStatus('idle', this.showcase.item?.actionLabel);
    this.schedulePosterCheck();
  }

  async openProduct(id: string, flavorId?: string) {
    const p = productById(id);
    if (!p || this.transitioning || this.mode !== 'store') return;
    this.product = p;
    this.flavor = p.flavors.find((f) => f.id === flavorId) ?? p.flavors[0];
    audio.play('select');
    this.hud.tooltip(null, 0, 0);
    this.store.enabled = false;
    await this.dissolve(() => {
      this.mode = 'showcase';
      this.showcase.active = true;
      this.hud.setMode('showcase');
      this.panel.open(p, this.flavor!, this.content, this.owned, this.state.bucks);
      this.panel.setQRInfo(this.qr);
      this.stageHint.hidden = false;
      this.resize();
      this.buildItem();
    });
    if (p.preferredMode && this.content.mode === p.preferredMode) this.contentChanged(true);
  }

  async closeProduct() {
    if (this.transitioning || this.mode !== 'showcase') return;
    audio.play('back');
    await this.dissolve(() => {
      this.setScanMode(false);
      this.mode = 'store';
      this.showcase.active = false;
      this.showcase.setItem(null);
      this.panel.close();
      this.product = null;
      this.stageHint.hidden = true;
      this.hud.setMode('store');
      this.store.enabled = true;
      this.resize();
    });
  }

  private reopen(productId: string, flavorId: string, text: string) {
    if (text) {
      if (isProbablyUrl(text)) {
        this.content.mode = 'link';
        this.content.link = text;
      } else {
        this.content.mode = 'text';
        this.content.text = text;
      }
      this.contentChanged(true);
    }
    const go = () => void this.openProduct(productId, flavorId);
    if (this.mode === 'showcase') void this.closeProduct().then(go);
    else if (this.mode === 'store') go();
  }

  setFlavor(id: string) {
    if (!this.product) return;
    const f = this.product.flavors.find((q) => q.id === id);
    if (!f || f === this.flavor) return;
    audio.play('blip');
    this.flavor = f;
    this.panel.setFlavor(id);
    const was = this.revealed || this.revealing;
    this.setScanMode(false);
    this.buildItem();
    if (was) this.finishNow();
  }

  // -----------------------------------------------------------------------------------------------
  // content → QR

  contentChanged(immediate = false) {
    window.clearTimeout(this.contentTimer);
    this.contentTimer = window.setTimeout(() => void this.recompute(), immediate ? 0 : 260);
  }

  private async recompute() {
    const token = ++this.qrToken;
    const payload = await buildPayload(this.content);
    if (token !== this.qrToken) return;
    let qr: QRMatrix;
    try {
      qr = makeQR(payload.text, this.content.ec);
    } catch (e) {
      this.panel.setError((e as Error).message);
      return;
    }
    this.panel.setError(payload.error ?? null);
    if (qr.text === this.qr.text && qr.ec === this.qr.ec && payload.art === this.art) return;
    this.setQR(payload.text, payload.label, payload.art, qr);
  }

  setQR(text: string, label: string, art: PixelArt | null = this.art, qr?: QRMatrix) {
    this.qr = qr ?? makeQR(text, this.content.ec);
    this.label = label;
    this.art = art;
    this.panel.setQRInfo(this.qr);
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

  private schedulePosterCheck() {
    window.clearTimeout(this.posterTimer);
    this.posterOk = null;
    this.panel.setScanBadges(null, this.viewOk);
    this.panel.setPosterPreview(null);
    if (!this.product || !this.owned) return;
    this.posterTimer = window.setTimeout(() => {
      if (!this.product) return;
      const c = this.product.poster(this.ctx('poster'));
      this.posterOk = scanCanvas(c, 1400) === this.qr.text;
      this.panel.setScanBadges(this.posterOk, this.viewOk);
      this.panel.setPosterPreview(c.toDataURL('image/png'));
    }, 450);
  }

  // -----------------------------------------------------------------------------------------------
  // reveal

  async reveal() {
    const item = this.showcase.item;
    if (!item || !this.owned || this.revealing) return;
    if (this.revealed) this.buildItem();
    this.setScanMode(false);
    const run = ++this.revealRun;
    this.revealing = true;
    this.panel.setStatus('revealing');
    await this.showcase.item!.reveal();
    if (run !== this.revealRun) return;
    this.onRevealed();
  }

  private finishNow() {
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
    this.panel.setStatus('done');
    if (first && this.product && this.flavor) {
      this.state.addReceipt({ product: this.product.id, flavor: this.flavor.id, label: `${this.product.name} · ${this.label}`, at: Date.now(), text: this.qr.text.length < 1200 ? this.qr.text : undefined });
    }
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
    this.scanBanner.hidden = !on;
    this.stageHint.hidden = on || this.mode !== 'showcase';
    this.panel.setScanMode(on);
    // on phones the settings sheet folds away so the whole code is on screen
    if (window.innerWidth <= 760) this.panel.el.classList.toggle('collapsed', on);
    if (this.mode === 'showcase') this.resize();
    if (on) {
      audio.play('ding');
      this.showcase.focusCamera();
      window.setTimeout(() => {
        if (!this.showcase.focusMode) return;
        this.viewOk = this.scanView() === this.qr.text;
        this.panel.setScanBadges(this.posterOk, this.viewOk);
      }, 1400);
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
  // wallet & exports

  openShop() {
    audio.play('register');
    openShop(this.state, {
      onChange: () => {},
      onUnlockAll: () => {
        this.store.refreshOwnership();
        if (this.product) {
          this.panel.setOwned(true, this.state.bucks);
          this.schedulePosterCheck();
        }
      },
    });
  }

  private unlockCurrent() {
    const p = this.product;
    if (!p) return;
    confirmUnlock(
      p,
      this.state,
      () => {
        if (!this.state.spend(p.price)) return;
        this.state.unlock(p.id);
        audio.play('unlock');
        toast(`Unlocked ${p.name}!`, 'good');
        this.store.refreshOwnership();
        this.panel.setOwned(true, this.state.bucks);
        this.panel.setStatus('idle', this.showcase.item?.actionLabel);
        this.schedulePosterCheck();
      },
      () => this.openShop(),
    );
  }

  private async exportAs(kind: 'poster' | 'plain' | 'svg' | 'copy' | 'copytext') {
    if (!this.product || !this.flavor) return;
    const name = `qr-market-${this.product.id}-${slug(this.label)}`;
    audio.play('register');
    if (kind === 'copytext') {
      try {
        await navigator.clipboard.writeText(this.qr.text);
        toast('Copied the code text', 'good');
      } catch {
        toast('Copying was blocked by the browser', 'bad');
      }
      return;
    }
    if (!this.owned) return;
    if (kind === 'poster') await downloadCanvas(this.product.poster(this.ctx('poster')), `${name}.png`);
    else if (kind === 'plain') await downloadCanvas(plainQRCanvas(this.qr), `${name}-plain.png`);
    else if (kind === 'svg') downloadBlob(new Blob([qrSvg(this.qr)], { type: 'image/svg+xml' }), `${name}.svg`);
    else {
      const ok = await copyCanvas(this.product.poster(this.ctx('poster')));
      toast(ok ? 'Poster copied to clipboard' : 'Copy blocked here. Long-press the poster preview to save it.', ok ? 'good' : 'bad');
      return;
    }
    toast('Saved! Check your downloads', 'good');
  }

  // -----------------------------------------------------------------------------------------------
  // test hooks

  /** Build the current product's poster and try to scan it. */
  posterScan(): { ok: boolean; text: string | null; width: number; height: number } {
    if (!this.product || !this.flavor) return { ok: false, text: null, width: 0, height: 0 };
    const c = this.product.poster(this.ctx('poster'));
    const text = scanCanvas(c, 1400);
    return { ok: text === this.qr.text, text, width: c.width, height: c.height };
  }

  /** Switch the content to a generated pixel postcard (1 frame) or flipbook (6 frames). */
  async useDemoArt(frames = 1) {
    const { demoPixelArt } = await import('../qr/demoArt');
    const { pixelArtUrl } = await import('../qr/pixelCodec');
    const { postcardBase } = await import('./content');
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

  /**
   * Test hook: jump into the aisles and open a product immediately (skips the intro and the
   * dissolve). Used by the screenshot and scan scripts.
   */
  async quickOpen(id: string, flavorId?: string) {
    if (this.mode === 'title') await this.walkIn(true);
    if (this.mode === 'showcase') await this.closeProduct();
    const p = this.openProduct(id, flavorId);
    await this.advance(0.8);
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
        this.pixel.render(this.showcase.scene, this.showcase.camera);
      } else {
        this.store.update(dt, this.time);
        this.pixel.render(this.store.scene, this.store.camera);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  get products() {
    return PRODUCTS;
  }
}
