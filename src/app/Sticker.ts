import * as THREE from 'three';
import { Painter } from '../engine/Painter';
import { FONT_BIG, measureText } from '../engine/pixelFont';
import { iconBitmap, type IconName } from '../art/icons';
import { pixelTexture } from '../art/pixel';
import type { PixelArt } from '../qr/pixelCodec';
import { pixelArtCanvas } from '../qr/pixelCapture';
import type { LabelAnchor } from '../products/types';
import type { ContentMode, ContentState } from './content';

/**
 * The link sticker glued on the unopened package: the whole "editor" lives here. A row of mode
 * icons (link, text, wifi, contact, photo, video) and your text in pixel letters with a blinking
 * caret. An invisible textarea sits over it on screen so typing, pasting and phone keyboards all
 * work natively.
 */

const MODES: { mode: ContentMode; icon: IconName }[] = [
  { mode: 'link', icon: 'link' },
  { mode: 'text', icon: 'text' },
  { mode: 'wifi', icon: 'wifi' },
  { mode: 'contact', icon: 'contact' },
  { mode: 'image', icon: 'photo' },
  { mode: 'video', icon: 'video' },
];

const INK = '#2a1c22';
const PINK = '#f47c9f';

export interface StickerCallbacks {
  /** Text or mode changed (already written into the content state). */
  onChange(): void;
  /** Pick a photo / video file for image or video mode. */
  onPickFile(mode: 'image' | 'video'): void;
  /** Enter pressed: done editing. */
  onSubmit(): void;
  /** The pull tab was tapped: open the pack. */
  onOpen(): void;
}

/** Width of the pink pull tab on the sticker's right edge (canvas px). */
const TAB = 15;

export class Sticker {
  readonly mesh: THREE.Mesh;
  readonly input: HTMLTextAreaElement;
  private painter: Painter;
  private texture: THREE.CanvasTexture;
  private W = 120;
  private H = 72;
  private content!: ContentState;
  private status: 'ok' | 'error' | 'empty' = 'empty';
  private blink = 0;
  private dirty = true;
  private focused = false;
  private wobble = 0;
  private peeling = false;
  private art: PixelArt | null = null;
  constructor(root: HTMLElement, private cb: StickerCallbacks) {
    this.painter = new Painter(this.W, this.H);
    this.texture = pixelTexture(this.painter.canvas);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, alphaTest: 0.5 }));
    this.mesh.renderOrder = 1;
    this.mesh.name = 'sticker';
    this.input = document.createElement('textarea');
    this.input.className = 'sticker-input';
    this.input.setAttribute('aria-label', 'Link or text for your QR code');
    this.input.setAttribute('autocapitalize', 'off');
    this.input.setAttribute('autocomplete', 'off');
    this.input.setAttribute('spellcheck', 'false');
    this.input.hidden = true;
    root.appendChild(this.input);
    this.input.addEventListener('input', () => this.fromInput());
    this.input.addEventListener('focus', () => {
      this.focused = true;
      this.dirty = true;
    });
    this.input.addEventListener('blur', () => {
      this.focused = false;
      this.dirty = true;
    });
    this.input.addEventListener('keydown', (e) => {
      const multi = this.content.mode === 'text' || this.content.mode === 'wifi' || this.content.mode === 'contact';
      if (e.key === 'Enter' && (!multi || (this.content.mode !== 'text' && this.lines().length >= this.maxLines()))) {
        e.preventDefault();
        this.input.blur();
        this.cb.onSubmit();
      }
      if (e.key === 'Escape') this.input.blur();
      e.stopPropagation();
    });
  }

  /** Glue onto a package. */
  attach(anchor: LabelAnchor) {
    const [w, h] = anchor.size;
    // pick a canvas that matches the sticker's aspect, ~72px tall
    this.H = 72;
    this.W = Math.max(100, Math.min(170, Math.round((72 * w) / h)));
    this.painter = new Painter(this.W, this.H);
    this.texture.dispose();
    this.texture = pixelTexture(this.painter.canvas);
    (this.mesh.material as THREE.MeshBasicMaterial).map = this.texture;
    this.mesh.scale.set(w, (w * this.H) / this.W, 1);
    this.mesh.position.copy(anchor.position);
    this.mesh.rotation.copy(anchor.rotation ?? new THREE.Euler());
    this.mesh.visible = true;
    this.peeling = false;
    anchor.object.add(this.mesh);
    this.input.hidden = false;
    this.dirty = true;
  }

  detach() {
    this.mesh.parent?.remove(this.mesh);
    this.input.hidden = true;
    this.input.blur();
  }

  get attached() {
    return !!this.mesh.parent && this.mesh.visible;
  }

  setContent(c: ContentState, status: 'ok' | 'error' | 'empty') {
    this.content = c;
    if (status === 'error' && this.status !== 'error') this.wobble = 1;
    this.status = status;
    this.art = c.mode === 'image' ? c.image : c.mode === 'video' ? c.video : null;
    const want = this.textFor(c);
    if (document.activeElement !== this.input && this.input.value !== want) this.input.value = want;
    this.dirty = true;
  }

  private maxLines() {
    return this.content.mode === 'wifi' ? 2 : this.content.mode === 'contact' ? 3 : 4;
  }

  private textFor(c: ContentState) {
    switch (c.mode) {
      case 'link':
        return c.link;
      case 'text':
        return c.text;
      case 'wifi':
        return `${c.wifi.ssid}\n${c.wifi.password}`;
      case 'contact':
        return `${c.contact.name}\n${c.contact.phone}\n${c.contact.email}`;
      default:
        return '';
    }
  }

  private lines() {
    return this.input.value.split('\n');
  }

  private fromInput() {
    const c = this.content;
    const v = this.input.value;
    const L = v.split('\n');
    if (c.mode === 'link') c.link = v.replace(/\s+/g, '');
    else if (c.mode === 'text') c.text = v;
    else if (c.mode === 'wifi') {
      c.wifi.ssid = L[0] ?? '';
      c.wifi.password = L[1] ?? '';
    } else if (c.mode === 'contact') {
      c.contact.name = L[0] ?? '';
      c.contact.phone = L[1] ?? '';
      c.contact.email = L[2] ?? '';
    }
    this.blink = 0;
    this.dirty = true;
    this.cb.onChange();
  }

  /** Paste from anywhere on the stage. */
  paste(text: string) {
    if (!this.content) return;
    const t = text.trim();
    if (/^(https?:\/\/|www\.)\S+$/i.test(t) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t)) {
      this.content.mode = 'link';
      this.content.link = t;
    } else if (this.content.mode === 'link' || this.content.mode === 'image' || this.content.mode === 'video') {
      this.content.mode = 'text';
      this.content.text = t;
    } else {
      this.input.value = t;
      this.fromInput();
      return;
    }
    this.input.value = this.textFor(this.content);
    this.dirty = true;
    this.cb.onChange();
  }

  /** Tap on the sticker at texture uv: returns true if it did something. */
  tap(uv: THREE.Vector2): boolean {
    const x = uv.x * this.W;
    const y = (1 - uv.y) * this.H;
    if (x > this.W - TAB - 4 && y > this.H * 0.22 && y < this.H * 0.82) {
      this.cb.onOpen();
      return true;
    }
    const icons = this.iconSlots();
    for (const s of icons) {
      if (x >= s.x - 2 && x <= s.x + 14 && y >= 2 && y <= 19) {
        this.setMode(s.mode);
        return true;
      }
    }
    if (this.content.mode === 'image' || this.content.mode === 'video') {
      this.cb.onPickFile(this.content.mode);
      return true;
    }
    this.focus();
    return true;
  }

  focus() {
    this.input.hidden = false;
    this.input.focus({ preventScroll: true });
    const n = this.input.value.length;
    this.input.setSelectionRange(n, n);
  }

  setMode(mode: ContentMode) {
    if (this.content.mode === mode) {
      if (mode === 'image' || mode === 'video') this.cb.onPickFile(mode);
      else this.focus();
      return;
    }
    this.content.mode = mode;
    this.input.value = this.textFor(this.content);
    this.dirty = true;
    this.cb.onChange();
    if (mode === 'image' || mode === 'video') {
      this.input.blur();
      if (!(mode === 'image' ? this.content.image : this.content.video)) this.cb.onPickFile(mode);
    } else this.focus();
  }

  private iconSlots() {
    const n = MODES.length;
    const BW = this.W - TAB;
    const gap = Math.min(18, (BW - 12) / n);
    const x0 = Math.round((BW - gap * n) / 2 + (gap - 12) / 2);
    return MODES.map((m, i) => ({ ...m, x: Math.round(x0 + i * gap) }));
  }

  /** Peel the sticker off before the reveal (hop, spin, shrink). */
  async peel(tweens: import('../engine/tween').Tweens, group: string) {
    if (!this.attached || this.peeling) return;
    this.peeling = true;
    this.input.blur();
    this.input.hidden = true;
    const s0 = this.mesh.scale.clone();
    const p0 = this.mesh.position.clone();
    await tweens.tween(0.32, (t) => {
      const k = 1 - t;
      this.mesh.scale.set(s0.x * (1 + t * 0.3) * k, s0.y * (1 + t * 0.3) * k, 1);
      this.mesh.position.set(p0.x, p0.y + Math.sin(t * Math.PI) * 0.12, p0.z + t * 0.2);
      this.mesh.rotation.z = t * 1.2;
    }, undefined, group);
    this.mesh.visible = false;
  }

  /** Keep the invisible textarea over the sticker's text area on screen; redraw when needed. */
  update(dt: number, camera: THREE.Camera, canvas: HTMLCanvasElement) {
    if (!this.attached) return;
    this.blink += dt;
    if (this.wobble > 0) {
      this.wobble = Math.max(0, this.wobble - dt * 2.5);
      this.mesh.rotation.z = Math.sin(this.wobble * 30) * 0.06 * this.wobble;
    }
    const caretOn = this.focused && Math.floor(this.blink * 2) % 2 === 0;
    const phase = Math.floor(this.blink * 6) % 6;
    if (this.status === 'ok' && phase !== this.lastPhase) {
      this.lastPhase = phase;
      this.dirty = true;
    }
    if (this.dirty || caretOn !== this.lastCaret) {
      this.draw(caretOn);
      this.lastCaret = caretOn;
      this.dirty = false;
    }
    // project the text region (below the icon row) to CSS pixels
    const rect = canvas.getBoundingClientRect();
    const corners = [
      [-0.5, 0.5 - 22 / this.H],
      [0.5, 0.5 - 22 / this.H],
      [-0.5, -0.5],
      [0.5, -0.5],
    ].map(([x, y]) => {
      const v = new THREE.Vector3(x, y, 0);
      this.mesh.localToWorld(v);
      v.project(camera);
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height, z: v.z };
    });
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const visible = corners.every((c) => c.z < 1) && !this.peeling;
    const box = this.input.style;
    box.left = `${Math.min(...xs)}px`;
    box.top = `${Math.min(...ys)}px`;
    box.width = `${Math.max(24, Math.max(...xs) - Math.min(...xs))}px`;
    box.height = `${Math.max(16, Math.max(...ys) - Math.min(...ys))}px`;
    const media = this.content?.mode === 'image' || this.content?.mode === 'video';
    this.input.hidden = !visible || media;
  }
  private lastCaret = false;
  private lastPhase = -1;

  /** Screen-space centre of the sticker (for hints). */
  screenCenter(camera: THREE.Camera, canvas: HTMLCanvasElement) {
    const v = new THREE.Vector3();
    this.mesh.getWorldPosition(v);
    v.project(camera);
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  private draw(caret: boolean) {
    const p = this.painter;
    const { W, H } = this;
    const BW = W - TAB;
    const c = this.content;
    p.clear();
    // pull tab poking out on the right (wiggles when the code is ready)
    const ready = this.status === 'ok';
    const wig = ready ? [0, 1, 2, 1, 0, 0][Math.floor(this.blink * 6) % 6] : 0;
    const ty = Math.round(H * 0.28);
    const th = Math.round(H * 0.46);
    p.roundRect(BW - 6, ty, TAB + 6 - 1 + wig - 2, th, 5, INK);
    p.roundRect(BW - 5, ty + 2, TAB + 3 + wig - 2, th - 4, 4, ready ? PINK : '#e8c2cf');
    const ax = BW + 1 + wig;
    const ay = ty + Math.round(th / 2);
    p.poly(
      [
        [ax, ay - 4],
        [ax + 5, ay],
        [ax, ay + 4],
      ],
      '#ffffff',
    );
    // sticker body: white rounded card, ink border, pink dashed inner line, folded corner
    p.roundRect(0, 0, BW, H, 7, INK);
    p.roundRect(2, 2, BW - 4, H - 4, 6, '#ffffff');
    for (let y = 8; y < H - 8; y += 4) p.rect(BW - 4, y, 1, 2, ready ? '#f7a8c0' : '#ecd6de');
    for (let x = 8; x < BW - 8; x += 4) {
      p.rect(x, 20, 2, 1, '#ffd0de');
    }
    p.poly(
      [
        [BW - 13, H - 2],
        [BW - 2, H - 13],
        [BW - 2, H - 2],
      ],
      '#fff0f4',
    );
    p.line(BW - 13, H - 3, BW - 3, H - 13, '#e9b7c6');
    // mode icons
    for (const s of this.iconSlots()) {
      const active = c && c.mode === s.mode;
      if (active) p.roundRect(s.x - 2, 3, 16, 16, 4, PINK);
      const ic = iconBitmap(s.icon, active ? { fill: '#ffffff' } : {}).toCanvas();
      p.ctx.globalAlpha = active ? 1 : 0.55;
      p.ctx.drawImage(ic, s.x, 5);
      p.ctx.globalAlpha = 1;
    }
    if (!c) return;
    const x0 = 8;
    let y = 26;
    const maxW = BW - 16;
    const rowH = 10;
    if (c.mode === 'image' || c.mode === 'video') {
      const art = this.art;
      if (art) {
        const frame = pixelArtCanvas(art, 0, 1);
        const scale = Math.max(1, Math.floor(Math.min((H - 30) / frame.height, (BW - 20) / frame.width)));
        const fw = frame.width * scale;
        const fh = frame.height * scale;
        p.rect(Math.round((BW - fw) / 2) - 1, 24 - 1, fw + 2, fh + 2, INK);
        p.ctx.imageSmoothingEnabled = false;
        p.ctx.drawImage(frame, Math.round((BW - fw) / 2), 24, fw, fh);
      } else {
        const ic = iconBitmap(c.mode === 'image' ? 'photo' : 'video').toCanvas();
        p.ctx.imageSmoothingEnabled = false;
        p.ctx.drawImage(ic, Math.round(BW / 2 - 12), 28, 24, 24);
        p.text('+', Math.round(BW / 2 + 12), 26, { font: FONT_BIG, color: PINK });
      }
    } else {
      const raw = this.input.value;
      const empty = !raw.trim();
      if (empty) {
        // paste hint: clipboard icon + blinking caret
        const ic = iconBitmap('paste').toCanvas();
        p.ctx.imageSmoothingEnabled = false;
        p.ctx.drawImage(ic, Math.round(BW / 2 - 12), 28, 24, 24);
        if (caret) p.rect(Math.round(BW / 2 + 16), 30, 2, 18, PINK);
        for (let x = 12; x < BW - 12; x += 3) p.px(x, 58, '#e0c9d2');
      } else {
        const icons: (IconName | null)[] = c.mode === 'wifi' ? ['wifi', 'lock'] : c.mode === 'contact' ? ['contact', null, null] : [];
        const src = raw.split('\n');
        const out: { text: string; icon: IconName | null }[] = [];
        src.forEach((line, i) => {
          const icon = icons[i] ?? null;
          const avail = maxW - (icon ? 14 : 0);
          for (const piece of wrap(line, avail, c.mode === 'link')) out.push({ text: piece, icon: out.length && !icon ? null : icon });
        });
        const maxRows = Math.floor((H - y - 6) / rowH);
        const rows = c.mode === 'link' ? out.slice(-maxRows) : out.slice(0, maxRows);
        let lastEnd = { x: x0, y };
        rows.forEach((r) => {
          let tx = x0;
          if (r.icon) {
            p.ctx.drawImage(iconBitmap(r.icon).toCanvas(), x0, y - 3);
            tx += 14;
          }
          const w = p.text(r.text, tx, y, { font: FONT_BIG, color: INK });
          lastEnd = { x: tx + w + 1, y };
          y += rowH;
        });
        if (caret) p.rect(Math.min(BW - 6, lastEnd.x), lastEnd.y - 1, 1, 9, PINK);
      }
    }
    // status badge
    if (this.status === 'ok' && c.mode !== 'image' && c.mode !== 'video') p.ctx.drawImage(iconBitmap('check').toCanvas(), BW - 18, H - 16);
    if (this.status === 'error') {
      p.roundRect(BW - 18, H - 17, 11, 12, 3, '#e0394a');
      p.text('!', BW - 14, H - 15, { font: FONT_BIG, color: '#ffffff' });
    }
    this.texture.needsUpdate = true;
  }
}

/** Break a line into pieces that fit `maxW` pixels in FONT_BIG. Links break anywhere. */
function wrap(line: string, maxW: number, anywhere: boolean): string[] {
  if (!line) return [''];
  const out: string[] = [];
  if (anywhere) {
    let cur = '';
    for (const ch of line) {
      if (measureText(FONT_BIG, cur + ch) > maxW) {
        out.push(cur);
        cur = ch;
      } else cur += ch;
    }
    out.push(cur);
    return out;
  }
  let cur = '';
  for (const word of line.split(' ')) {
    const next = cur ? cur + ' ' + word : word;
    if (measureText(FONT_BIG, next) > maxW && cur) {
      out.push(cur);
      cur = word;
    } else cur = next;
    while (measureText(FONT_BIG, cur) > maxW) {
      let k = cur.length;
      while (k > 1 && measureText(FONT_BIG, cur.slice(0, k)) > maxW) k--;
      out.push(cur.slice(0, k));
      cur = cur.slice(k);
    }
  }
  out.push(cur);
  return out;
}
