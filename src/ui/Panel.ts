import { h, clear, coinIcon, formatBucks } from './dom';
import type { Flavor, ProductDef } from '../products/types';
import { DEFAULT_LINK, type ContentMode, type ContentState } from '../app/content';
import { detectLinkKind, LINK_KIND_LABEL, normalizeUrl } from '../qr/payload';
import { densityLabel, type ECLevel, type QRMatrix } from '../qr/qr';
import { imageToPixelArt, loadImage, openVideo, pixelArtCanvas, videoToPixelArt, type VideoCapture } from '../qr/pixelCapture';
import type { PixelArt } from '../qr/pixelCodec';
import { audio } from '../engine/audio';

export interface PanelCallbacks {
  onBack(): void;
  onFlavor(id: string): void;
  onContent(): void;
  onReveal(): void;
  onSkip(): void;
  onScanMode(): void;
  onExport(kind: 'poster' | 'plain' | 'svg' | 'copy' | 'copytext'): void;
  onUnlock(): void;
  onGetBucks(): void;
  onExtra(): void;
}

const MODES: { id: ContentMode; label: string; icon: string }[] = [
  { id: 'link', label: 'Link', icon: '⌁' },
  { id: 'text', label: 'Text', icon: '¶' },
  { id: 'wifi', label: 'Wi-Fi', icon: '≋' },
  { id: 'contact', label: 'Contact', icon: '☺' },
  { id: 'image', label: 'Photo', icon: '▣' },
  { id: 'video', label: 'Video', icon: '▶' },
];

const EC_INFO: Record<ECLevel, string> = {
  L: 'Low: smallest code, 7% damage-proof',
  M: 'Medium: 15% damage-proof (default)',
  Q: 'Quartile: 25% damage-proof',
  H: 'High: 30% damage-proof, densest',
};

function field(label: string, input: HTMLElement) {
  return h('label', { class: 'field' }, h('span', null, label), input);
}

/**
 * The showcase "receipt": product info, flavours, content editor, the big action button,
 * scan badges and exports.
 */
export class Panel {
  readonly el: HTMLElement;
  private receipt: HTMLElement;
  private product: ProductDef | null = null;
  private content!: ContentState;
  private actionBtn!: HTMLButtonElement;
  private scanBtn!: HTMLButtonElement;
  private replayBtn!: HTMLButtonElement;
  private extraBtn!: HTMLButtonElement;
  private editor!: HTMLElement;
  private tabs = new Map<ContentMode, HTMLButtonElement>();
  private flavorBtns = new Map<string, HTMLButtonElement>();
  private meter!: HTMLElement;
  private errorEl!: HTMLElement;
  private badges!: HTMLElement;
  private lockBox!: HTMLElement;
  private exportsBox!: HTMLElement;
  private posterImg!: HTMLImageElement;
  private posterHint!: HTMLElement;
  private status: 'idle' | 'revealing' | 'done' = 'idle';
  private owned = true;
  private image: HTMLImageElement | null = null;
  private video: VideoCapture | null = null;
  private imgOpts = { size: 24, colors: 8, dither: false, caption: '' };
  private vidOpts = { size: 16, colors: 8, dither: false, caption: '', frames: 6, fps: 5, start: 0 };
  private animTimer = 0;

  private footer: HTMLElement;

  constructor(host: HTMLElement, private cb: PanelCallbacks) {
    this.receipt = h('div', { class: 'receipt' });
    this.footer = h('div', { class: 'panel-actions' });
    const handle = h('button', { class: 'sheet-handle', onclick: () => this.el.classList.toggle('collapsed') }, 'Tap to expand or collapse');
    this.el = h('aside', { class: 'panel', hidden: true, 'aria-label': 'Product and QR settings' }, handle, this.receipt, this.footer);
    host.appendChild(this.el);
  }

  /** Width of the panel on the left (desktop) or height of the sheet (mobile), for camera framing. */
  get occlusion(): { left: number; bottom: number } {
    if (this.el.hidden) return { left: 0, bottom: 0 };
    const r = this.el.getBoundingClientRect();
    if (window.innerWidth <= 760) return { left: 0, bottom: r.height };
    return { left: r.right, bottom: 0 };
  }

  open(product: ProductDef, flavor: Flavor, content: ContentState, owned: boolean, bucks: number) {
    this.product = product;
    this.content = content;
    this.owned = owned;
    this.status = 'idle';
    this.el.hidden = false;
    this.el.classList.remove('collapsed');
    // photo/video-first products open on that tab, unless the shopper already typed their own link
    if (product.preferredMode && content.mode === 'link' && content.link === DEFAULT_LINK && !content.image && !content.video) content.mode = product.preferredMode;
    this.render(flavor, bucks);
  }

  close() {
    this.el.hidden = true;
    this.product = null;
    window.clearInterval(this.animTimer);
  }

  private render(flavor: Flavor, bucks: number) {
    const p = this.product!;
    clear(this.receipt);
    const back = h('button', { class: 'btn btn-paper btn-sm', onclick: () => this.cb.onBack() }, '◀ Aisle');
    const price = p.price === 0 ? h('span', { class: 'badge' }, 'FREE') : h('span', { class: 'badge' + (this.owned ? ' ok' : ' bad') }, this.owned ? '✓ OWNED' : `${p.price}QB`);
    this.receipt.append(
      h('div', { class: 'back-row' }, back, h('div', { class: 'row', style: { flex: '0 0 auto', gap: '6px' } }, p.badge ? h('span', { class: 'badge' }, p.badge) : null, price)),
      h('h2', null, p.name),
      h('div', { class: 'tagline' }, p.tagline),
      h('p', { class: 'reveal-line' }, p.reveal),
    );

    // flavours
    this.flavorBtns.clear();
    const fl = h('div', { class: 'flavors' });
    for (const f of p.flavors) {
      const c = f.c.bg ?? f.c.main ?? f.c.bag ?? Object.values(f.c)[0];
      const b = h('button', { class: 'flavor', style: `--c:${c}`, 'aria-pressed': String(f.id === flavor.id), onclick: () => this.cb.onFlavor(f.id) }, h('i'), f.name);
      this.flavorBtns.set(f.id, b);
      fl.appendChild(b);
    }
    this.receipt.append(h('hr', { class: 'rule' }), h('div', { class: 'sec-label' }, 'FLAVOR / TEMPLATE'), fl);

    // lock card for premium products
    this.lockBox = h('div');
    this.receipt.append(this.lockBox);
    this.renderLock(bucks);

    // content editor
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    this.tabs.clear();
    for (const m of MODES) {
      const t = h('button', { class: 'tab', role: 'tab', 'aria-selected': String(this.content.mode === m.id), onclick: () => this.setMode(m.id) }, h('b', null, m.icon), m.label);
      this.tabs.set(m.id, t);
      tabs.appendChild(t);
    }
    this.editor = h('div');
    this.errorEl = h('p', { class: 'note error-note', hidden: true });
    this.receipt.append(h('hr', { class: 'rule' }), h('div', { class: 'sec-label' }, 'WHAT SHOULD IT OPEN?'), tabs, this.editor, this.errorEl);
    this.renderEditor();

    // strength + density
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Error correction' });
    const ecNote = h('p', { class: 'note' }, EC_INFO[this.content.ec]);
    for (const ec of ['L', 'M', 'Q', 'H'] as ECLevel[]) {
      seg.appendChild(
        h('button', {
          'aria-pressed': String(this.content.ec === ec),
          onclick: (e: Event) => {
            this.content.ec = ec;
            seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
            ecNote.textContent = EC_INFO[ec];
            this.cb.onContent();
          },
        }, ec),
      );
    }
    this.meter = h('div', { class: 'meter' });
    this.receipt.append(h('hr', { class: 'rule' }), h('div', { class: 'sec-label' }, 'CODE STRENGTH'), seg, ecNote, this.meter);

    // actions
    this.actionBtn = h('button', { class: 'btn btn-big btn-red', onclick: () => this.onAction() }, '▶ ' + 'Open it!');
    this.scanBtn = h('button', { class: 'btn btn-mint', onclick: () => this.cb.onScanMode(), disabled: true }, '◎ Scan mode');
    this.replayBtn = h('button', { class: 'btn btn-paper', onclick: () => this.cb.onReveal(), disabled: true }, '↻ Replay');
    this.extraBtn = h('button', { class: 'btn btn-paper', hidden: true, disabled: true, onclick: () => this.cb.onExtra() }, '✦ Extra');
    this.badges = h('div', { class: 'scan-badges' });
    clear(this.footer).append(h('div', { class: 'actions' }, this.actionBtn, h('div', { class: 'row' }, this.scanBtn, this.extraBtn, this.replayBtn)));
    this.receipt.append(h('hr', { class: 'rule' }), h('div', { class: 'sec-label' }, 'SCAN CHECK'), this.badges);

    // exports
    this.posterImg = h('img', { class: 'poster-preview', alt: 'Your QR poster', hidden: true });
    this.posterHint = h('p', { class: 'note', hidden: true }, 'Right-click or long-press the poster to save it.');
    this.exportsBox = h(
      'div',
      { class: 'exports' },
      h('button', { class: 'btn', onclick: () => this.cb.onExport('poster') }, '⬇ Poster PNG'),
      h('button', { class: 'btn btn-paper', onclick: () => this.cb.onExport('plain') }, '⬇ Plain PNG'),
      h('button', { class: 'btn btn-paper', onclick: () => this.cb.onExport('svg') }, '⬇ SVG'),
      h('button', { class: 'btn btn-paper', onclick: () => this.cb.onExport('copy') }, '⧉ Copy image'),
    );
    this.receipt.append(
      h('hr', { class: 'rule' }),
      h('div', { class: 'sec-label' }, 'TAKE IT HOME', h('button', { class: 'btn btn-paper btn-sm', onclick: () => this.cb.onExport('copytext') }, 'Copy text')),
      this.exportsBox,
      this.posterImg,
      this.posterHint,
      h('div', { class: 'receipt-foot' }, 'THANK YOU FOR SHOPPING', h('br'), 'AT QR MARKET ♥', h('div', { class: 'barcode' })),
    );
    this.setStatus('idle');
  }

  renderLock(bucks: number) {
    clear(this.lockBox);
    const p = this.product!;
    if (this.owned) return;
    const enough = bucks >= p.price;
    this.lockBox.append(
      h(
        'div',
        { class: 'lock-card' },
        h('h3', null, '🔒 Premium product'),
        h('p', null, `Unlock ${p.name} with QRBucks to open it and export your codes. You can preview it for free.`),
        h('div', { class: 'price-big' }, coinIcon(22), formatBucks(p.price)),
        enough
          ? h('button', { class: 'btn btn-big', onclick: () => this.cb.onUnlock() }, `Unlock for ${p.price} QB`)
          : h('button', { class: 'btn btn-big', onclick: () => this.cb.onGetBucks() }, `Get ${p.price - bucks} more QRBucks`),
      ),
    );
  }

  setOwned(owned: boolean, bucks: number) {
    this.owned = owned;
    if (!this.product) return;
    this.renderLock(bucks);
    this.setStatus(this.status);
  }

  setFlavor(id: string) {
    for (const [k, b] of this.flavorBtns) b.setAttribute('aria-pressed', String(k === id));
  }

  private onAction() {
    if (!this.owned) this.cb.onUnlock();
    else if (this.status === 'revealing') this.cb.onSkip();
    else this.cb.onReveal();
  }

  /** Product-specific fun action (shown once the code is built). */
  setExtra(label: string | null) {
    this.extraBtn.hidden = !label;
    if (label) {
      this.extraBtn.textContent = '✦ ' + label;
      this.replayBtn.hidden = true;
    } else this.replayBtn.hidden = false;
  }

  setStatus(s: 'idle' | 'revealing' | 'done', actionLabel?: string) {
    this.status = s;
    if (!this.actionBtn) return;
    const locked = !this.owned;
    this.actionBtn.disabled = false;
    if (locked) this.actionBtn.textContent = `🔒 Unlock · ${this.product?.price ?? ''} QB`;
    else if (s === 'idle') this.actionBtn.textContent = '▶ ' + (actionLabel ?? 'Open it!');
    else if (s === 'revealing') this.actionBtn.textContent = '⏭ Skip to the code';
    else this.actionBtn.textContent = '↻ Open another';
    this.scanBtn.disabled = s !== 'done';
    this.replayBtn.disabled = s !== 'done';
    this.extraBtn.disabled = s !== 'done';
    for (const b of this.exportsBox.querySelectorAll('button')) (b as HTMLButtonElement).disabled = locked;
  }

  setScanMode(on: boolean) {
    this.scanBtn.textContent = on ? '✕ Exit scan mode' : '◎ Scan mode';
  }

  setQRInfo(qr: QRMatrix | null) {
    clear(this.meter);
    if (!qr) return;
    const d = densityLabel(qr);
    const pct = Math.min(100, (qr.version / 25) * 100);
    const col = d.level === 'easy' ? 'var(--mint)' : d.level === 'ok' ? 'var(--tag)' : 'var(--sale)';
    this.meter.append(h('span', null, `V${qr.version} · ${qr.size}×${qr.size}`), h('span', { class: 'meter-bar', style: `--c:${col}` }, h('i', { style: { width: pct + '%' } })), h('span', null, d.label));
  }

  setError(msg: string | null) {
    this.errorEl.hidden = !msg;
    this.errorEl.textContent = msg ?? '';
  }

  setScanBadges(poster: boolean | null, view: boolean | null) {
    clear(this.badges);
    if (poster !== null) this.badges.append(h('span', { class: 'badge ' + (poster ? 'ok' : 'bad') }, poster ? '✓ Poster scans' : '✗ Poster check failed'));
    if (view !== null) this.badges.append(h('span', { class: 'badge ' + (view ? 'ok' : 'bad') }, view ? '✓ 3D view scans' : '… Zoom in to scan the 3D view'));
  }

  setPosterPreview(url: string | null) {
    this.posterImg.hidden = !url;
    this.posterHint.hidden = !url;
    if (url) this.posterImg.src = url;
  }

  // -----------------------------------------------------------------------------------------------
  // content editor

  private setMode(m: ContentMode) {
    audio.play('blip');
    this.content.mode = m;
    for (const [k, t] of this.tabs) t.setAttribute('aria-selected', String(k === m));
    this.renderEditor();
    this.cb.onContent();
  }

  private renderEditor() {
    window.clearInterval(this.animTimer);
    const c = this.content;
    const ed = clear(this.editor);
    const changed = () => this.cb.onContent();
    if (c.mode === 'link') {
      const kind = h('span', { class: 'chip-kind' });
      const updateKind = () => {
        const url = normalizeUrl(c.link);
        kind.textContent = url ? '● ' + LINK_KIND_LABEL[detectLinkKind(url)].toUpperCase() : '● PASTE A LINK';
      };
      const input = h('input', {
        type: 'url',
        id: 'qr-link',
        value: c.link,
        placeholder: 'https://your-link.com',
        autocomplete: 'off',
        spellcheck: false,
        oninput: (e: Event) => {
          c.link = (e.target as HTMLInputElement).value;
          updateKind();
          changed();
        },
      });
      updateKind();
      ed.append(field('LINK (WEBSITE, YOUTUBE, TIKTOK, LINE, MAPS…)', input), kind);
    } else if (c.mode === 'text') {
      const ta = h('textarea', { id: 'qr-text', maxlength: 1200, oninput: (e: Event) => ((c.text = (e.target as HTMLTextAreaElement).value), changed()) });
      ta.value = c.text;
      ed.append(field('MESSAGE', ta));
    } else if (c.mode === 'wifi') {
      const sec = h('select', { id: 'qr-wifi-sec', onchange: (e: Event) => ((c.wifi.security = (e.target as HTMLSelectElement).value as 'WPA'), changed()) }, ...['WPA', 'WEP', 'nopass'].map((v) => h('option', { value: v, selected: c.wifi.security === v }, v === 'nopass' ? 'No password' : v)));
      ed.append(
        field('NETWORK NAME (SSID)', h('input', { id: 'qr-wifi-ssid', value: c.wifi.ssid, oninput: (e: Event) => ((c.wifi.ssid = (e.target as HTMLInputElement).value), changed()) })),
        h('div', { class: 'row' }, field('PASSWORD', h('input', { id: 'qr-wifi-pass', value: c.wifi.password, oninput: (e: Event) => ((c.wifi.password = (e.target as HTMLInputElement).value), changed()) })), field('SECURITY', sec)),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'qr-wifi-hidden', checked: !!c.wifi.hidden, onchange: (e: Event) => ((c.wifi.hidden = (e.target as HTMLInputElement).checked), changed()) }), 'Hidden network'),
        h('p', { class: 'note' }, 'Guests scan and join. No typing passwords.'),
      );
    } else if (c.mode === 'contact') {
      const f = (label: string, key: keyof typeof c.contact, type = 'text') =>
        field(label, h('input', { type, id: 'qr-contact-' + key, value: c.contact[key] ?? '', oninput: (e: Event) => ((c.contact[key] = (e.target as HTMLInputElement).value), changed()) }));
      ed.append(f('NAME', 'name'), h('div', { class: 'row' }, f('PHONE', 'phone', 'tel'), f('EMAIL', 'email', 'email')), h('div', { class: 'row' }, f('COMPANY', 'org'), f('WEBSITE', 'url', 'url')));
    } else if (c.mode === 'image') {
      this.renderImageEditor(ed);
    } else {
      this.renderVideoEditor(ed);
    }
  }

  private dropZone(accept: string, text: string, onFile: (f: File) => void) {
    const input = h('input', { type: 'file', accept, 'aria-label': text, onchange: (e: Event) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) onFile(f);
    } });
    const zone = h('label', { class: 'drop' }, text, input);
    zone.addEventListener('dragover', (e) => (e.preventDefault(), zone.classList.add('over')));
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('over');
      const f = e.dataTransfer?.files?.[0];
      if (f) onFile(f);
    });
    return zone;
  }

  private slider(label: string, min: number, max: number, step: number, value: number, onInput: (v: number) => void, fmt = (v: number) => String(v)) {
    const out = h('output', null, fmt(value));
    const input = h('input', { type: 'range', min, max, step, value, 'aria-label': label, oninput: (e: Event) => {
      const v = +(e.target as HTMLInputElement).value;
      out.textContent = fmt(v);
      onInput(v);
    } });
    return h('label', { class: 'slider' }, h('span', null, label), input, out);
  }

  private preview(art: PixelArt | null) {
    const box = h('div', { class: 'art-preview' });
    if (!art) return box;
    const canvas = pixelArtCanvas(art, 0, 1);
    box.append(canvas, h('p', { class: 'note', style: { margin: '0' } }, `${art.w}×${art.h} pixels · ${art.palette.length} colours${art.frames.length > 1 ? ` · ${art.frames.length} frames` : ''}. It lives inside the code: scanning opens it, no upload.`));
    if (art.frames.length > 1) {
      let f = 0;
      this.animTimer = window.setInterval(() => {
        f = (f + 1) % art.frames.length;
        const next = pixelArtCanvas(art, f, 1);
        canvas.getContext('2d')!.drawImage(next, 0, 0);
      }, art.delay);
    }
    return box;
  }

  private renderImageEditor(ed: HTMLElement) {
    const c = this.content;
    const redo = () => {
      if (!this.image) return;
      c.image = imageToPixelArt(this.image, this.imgOpts);
      this.renderEditor();
      this.cb.onContent();
    };
    ed.append(
      this.dropZone('image/*', this.image ? 'Drop another photo or tap to choose' : 'Drop a photo here or tap to choose', async (file) => {
        try {
          this.image = await loadImage(file);
          redo();
        } catch {
          this.setError('That file could not be opened as an image.');
        }
      }),
      this.preview(c.image),
      this.slider('SIZE', 12, 40, 4, this.imgOpts.size, (v) => ((this.imgOpts.size = v), redo()), (v) => `${v}px`),
      this.slider('COLOURS', 2, 16, 1, this.imgOpts.colors, (v) => ((this.imgOpts.colors = v), redo())),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: this.imgOpts.dither, onchange: (e: Event) => ((this.imgOpts.dither = (e.target as HTMLInputElement).checked), redo()) }), 'Dither (retro shading)'),
      field('CAPTION (OPTIONAL)', h('input', { id: 'qr-img-caption', maxlength: 60, value: this.imgOpts.caption, placeholder: 'Wish you were here!', onchange: (e: Event) => ((this.imgOpts.caption = (e.target as HTMLInputElement).value), redo()) })),
      h('p', { class: 'note' }, 'Bigger pictures make denser codes. Keep it under V20 for easy scanning.'),
    );
  }

  private renderVideoEditor(ed: HTMLElement) {
    const c = this.content;
    const status = h('p', { class: 'note' });
    const redo = async () => {
      if (!this.video) return;
      status.textContent = 'Cutting frames…';
      try {
        c.video = await videoToPixelArt(this.video, this.vidOpts, (p) => (status.textContent = `Cutting frames… ${Math.round(p * 100)}%`));
        this.renderEditor();
        this.cb.onContent();
      } catch {
        this.setError('Could not read frames from that video.');
      }
    };
    ed.append(
      this.dropZone('video/*', this.video ? 'Drop another clip or tap to choose' : 'Drop a short video here or tap to choose', async (file) => {
        try {
          this.video?.dispose();
          this.video = await openVideo(file);
          this.vidOpts.start = 0;
          await redo();
        } catch (e) {
          this.setError((e as Error).message);
        }
      }),
      status,
      this.preview(c.video),
    );
    if (this.video) {
      const dur = this.video.duration;
      ed.append(this.slider('START', 0, Math.max(0, dur - 0.5), 0.1, this.vidOpts.start, (v) => ((this.vidOpts.start = v), void redo()), (v) => `${v.toFixed(1)}s`));
    }
    ed.append(
      this.slider('FRAMES', 2, 12, 1, this.vidOpts.frames, (v) => ((this.vidOpts.frames = v), void redo())),
      this.slider('SPEED', 2, 12, 1, this.vidOpts.fps, (v) => ((this.vidOpts.fps = v), void redo()), (v) => `${v}fps`),
      this.slider('SIZE', 8, 24, 2, this.vidOpts.size, (v) => ((this.vidOpts.size = v), void redo()), (v) => `${v}px`),
      this.slider('COLOURS', 2, 16, 1, this.vidOpts.colors, (v) => ((this.vidOpts.colors = v), void redo())),
      field('CAPTION (OPTIONAL)', h('input', { id: 'qr-vid-caption', maxlength: 60, value: this.vidOpts.caption, onchange: (e: Event) => ((this.vidOpts.caption = (e.target as HTMLInputElement).value), void redo()) })),
      h('p', { class: 'note' }, 'Your clip becomes a tiny looping flipbook stored inside the code. For long videos, paste a YouTube or TikTok link in the Link tab instead.'),
    );
  }
}
