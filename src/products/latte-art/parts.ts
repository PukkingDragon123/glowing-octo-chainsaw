import * as THREE from 'three';
import { Painter } from '../../engine/Painter';
import { FONT_TINY } from '../../engine/pixelFont';
import { rng } from '../../engine/tween';
import type { QRMatrix } from '../../qr/qr';
import type { Flavor } from '../types';
import { COCOA_SCAN, FOAM_SCAN, INK } from './art';

/** sRGB bytes of a #rrggbb colour (the DataTextures below are tagged sRGB). */
const rgb = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

function dataTexture(data: Uint8Array, w: number, h: number) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * The cocoa that lands on the foam through the stencil. One texture over the code square (quiet zone
 * included): texels are transparent foam until enough cocoa has fallen on their module.
 * Rows run top→bottom in QR order; the plane lies flat with row 0 at world -Z.
 */
export class CocoaCode {
  readonly N: number;
  readonly k: number;
  readonly tex: THREE.DataTexture;
  /** Module size in world units. */
  readonly m: number;
  private data: Uint8Array;
  private thr: Uint8Array;
  private noise: Uint8Array;
  private acc: Float32Array;
  private dark: { r: number; c: number; x: number; z: number }[] = [];
  private scan = false;
  private fun: number[][];
  private scanDark = rgb(COCOA_SCAN);
  private scanLight = rgb(FOAM_SCAN);
  private dirty = false;

  constructor(private qr: QRMatrix, readonly size: number, readonly quiet: number, f: Flavor) {
    const n = qr.size + quiet * 2;
    this.k = Math.max(3, Math.min(4, Math.floor(200 / n)));
    this.N = n * this.k;
    this.m = size / n;
    this.data = new Uint8Array(this.N * this.N * 4);
    this.thr = new Uint8Array(this.N * this.N);
    this.noise = new Uint8Array(this.N * this.N);
    const r = rng(17);
    for (let i = 0; i < this.thr.length; i++) {
      this.thr[i] = Math.floor(r() * 250) + 3;
      const x = r();
      this.noise[i] = x < 0.55 ? 0 : x < 0.85 ? 1 : 2;
    }
    this.fun = [rgb(f.c.cocoa), rgb(f.c.cocoa2), rgb('#3b2214')];
    const half = (qr.size - 1) / 2;
    for (let rr = 0; rr < qr.size; rr++)
      for (let c = 0; c < qr.size; c++) if (qr.isDark(rr, c)) this.dark.push({ r: rr, c, x: (c - half) * this.m, z: (rr - half) * this.m });
    this.acc = new Float32Array(this.dark.length);
    this.tex = dataTexture(this.data, this.N, this.N);
    this.repaintAll();
  }

  private paintBlock(mr: number, mc: number, fill: number, isDark: boolean) {
    const { k, N, data } = this;
    const lvl = fill * 255;
    for (let y = 0; y < k; y++) {
      const row = N - 1 - (mr * k + y);
      for (let x = 0; x < k; x++) {
        const i = row * N + mc * k + x;
        const o = i * 4;
        if (this.scan) {
          const col = isDark && fill >= 0.5 ? this.scanDark : this.scanLight;
          data[o] = col[0];
          data[o + 1] = col[1];
          data[o + 2] = col[2];
          data[o + 3] = 255;
        } else {
          const on = isDark && this.thr[i] < lvl;
          const col = this.fun[this.noise[i]];
          data[o] = col[0];
          data[o + 1] = col[1];
          data[o + 2] = col[2];
          data[o + 3] = on ? 255 : 0;
        }
      }
    }
  }

  repaintAll() {
    const n = this.qr.size + this.quiet * 2;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) this.paintBlock(r, c, 0, false);
    this.dark.forEach((d, i) => this.paintBlock(d.r + this.quiet, d.c + this.quiet, this.acc[i], true));
    this.tex.needsUpdate = true;
  }

  /** Sprinkle cocoa around (x, z) (relative to the code centre) with a soft radius. */
  sprinkle(x: number, z: number, radius: number, amount: number) {
    const r2 = radius * radius;
    for (let i = 0; i < this.dark.length; i++) {
      const d = this.dark[i];
      if (this.acc[i] >= 1) continue;
      const dx = d.x - x;
      const dz = d.z - z;
      const dd = dx * dx + dz * dz;
      if (dd > r2) continue;
      this.acc[i] = Math.min(1, this.acc[i] + amount * (1 - Math.sqrt(dd) / radius));
      this.paintBlock(d.r + this.quiet, d.c + this.quiet, this.acc[i], true);
      this.dirty = true;
    }
  }

  /** Top every module up by `amount` (used to finish the dusting evenly). */
  topUp(amount: number) {
    for (let i = 0; i < this.dark.length; i++) {
      if (this.acc[i] >= 1) continue;
      this.acc[i] = Math.min(1, this.acc[i] + amount);
      const d = this.dark[i];
      this.paintBlock(d.r + this.quiet, d.c + this.quiet, this.acc[i], true);
      this.dirty = true;
    }
  }

  fillAll() {
    this.acc.fill(1);
    this.repaintAll();
  }

  clear() {
    this.acc.fill(0);
    this.repaintAll();
  }

  setScan(on: boolean) {
    if (on === this.scan) return;
    this.scan = on;
    this.repaintAll();
  }

  /** Upload pending changes (call once per frame). */
  flush() {
    if (this.dirty) {
      this.tex.needsUpdate = true;
      this.dirty = false;
    }
  }

  dispose() {
    this.tex.dispose();
  }
}

/**
 * The stencil card: a kraft card with the dark modules cut out and a pull tab on +X.
 * The same texel grid as the cocoa code, plus a margin, so holes line up exactly.
 */
export class StencilCard {
  readonly tex: THREE.DataTexture;
  readonly W: number;
  readonly H: number;
  /** World size of the card (incl. tab) and the offset of its centre from the code centre (x). */
  readonly worldW: number;
  readonly worldH: number;
  readonly offsetX: number;
  private data: Uint8Array;
  private base: Uint8Array;
  private thr: Uint8Array;
  private acc: Float32Array;
  private cells: number;
  private cellsX: number;
  private cellsY: number;
  private cocoa: number[];
  private dirty = false;
  private tpu: number;
  private k: number;

  constructor(qr: QRMatrix, code: CocoaCode, f: Flavor, cardMargin = 0.42) {
    // coarser texel grid than the cocoa (3 per module): holes still line up, uploads stay small
    const k = 3;
    this.k = k;
    const codeN = (qr.size + code.quiet * 2) * k;
    const tpu = codeN / code.size;
    // the card is a bit wider than the cup (so it rests on the rim), with a pull tab on +X
    const mT = Math.round((cardMargin * tpu) / k) * k;
    const tabT = Math.round((0.36 * tpu) / k) * k;
    this.W = codeN + mT * 2 + tabT;
    this.H = codeN + mT * 2;
    this.tpu = tpu;
    this.worldW = this.W / this.tpu;
    this.worldH = this.H / this.tpu;
    this.offsetX = tabT / 2 / this.tpu;
    // printed card art (canvas, top-down rows)
    const p = new Painter(this.W, this.H);
    const cardW = codeN + mT * 2;
    p.rect(0, 0, cardW, this.H, '#f4e4c4');
    p.strokeRect(0, 0, cardW, this.H, '#c9a26a', Math.max(1, Math.floor(k / 2)));
    for (let x = mT / 2; x < cardW - mT / 2; x += k * 2) {
      p.rect(x, mT / 2, k, 1, '#dcc394');
      p.rect(x, this.H - mT / 2, k, 1, '#dcc394');
    }
    const tabH = Math.round(this.H * 0.34);
    const ty = Math.round((this.H - tabH) / 2);
    p.roundRect(cardW - k, ty, tabT + k, tabH, Math.min(tabH / 2, k * 3), f.c.cup);
    p.roundRect(cardW - k + 2, ty + 2, tabT + k - 4, tabH - 4, Math.min(tabH / 2, k * 3), f.c.cupLight);
    const hx = cardW + tabT / 2;
    const hy = this.H / 2;
    const hs = Math.max(1, Math.floor(k / 2));
    const heart = ['.#.#.', '#####', '#####', '.###.', '..#..'];
    p.sprite(heart, hx - 2.5 * hs, hy - 6 * hs, { '#': '#ff5d73' }, hs);
    const scale = Math.max(1, Math.floor(k / 3));
    p.text('ART', hx, hy + 1 * hs, { font: FONT_TINY, color: INK, align: 'center', scale });
    // holes for dark modules
    const q = code.quiet;
    for (let r = 0; r < qr.size; r++)
      for (let c = 0; c < qr.size; c++)
        if (qr.isDark(r, c)) p.ctx.clearRect(mT + (c + q) * k, mT + (r + q) * k, k, k);
    const img = p.ctx.getImageData(0, 0, this.W, this.H).data;
    this.base = new Uint8Array(this.W * this.H * 4);
    for (let y = 0; y < this.H; y++) {
      const src = y * this.W * 4;
      const dst = (this.H - 1 - y) * this.W * 4;
      for (let i = 0; i < this.W * 4; i++) this.base[dst + i] = img[src + i];
    }
    for (let i = 3; i < this.base.length; i += 4) this.base[i] = this.base[i] > 127 ? 255 : 0;
    this.data = new Uint8Array(this.base);
    this.thr = new Uint8Array(this.W * this.H);
    const rr = rng(23);
    for (let i = 0; i < this.thr.length; i++) this.thr[i] = Math.floor(rr() * 255);
    this.cellsX = Math.ceil(this.W / k);
    this.cellsY = Math.ceil(this.H / k);
    this.cells = this.cellsX * this.cellsY;
    this.acc = new Float32Array(this.cells);
    this.cocoa = rgb(f.c.cocoa2);
    this.tex = dataTexture(this.data, this.W, this.H);
  }

  /** Dust the card around (x, z) relative to the code centre. */
  sprinkle(x: number, z: number, radius: number, amount: number) {
    const { k, tpu } = this;
    // code-relative world → card texel (top-down); the code square is centred on the card body
    const tx = this.H / 2 + x * tpu;
    const ty = this.H / 2 + z * tpu;
    const cr = Math.ceil((radius * tpu) / k);
    const cx0 = Math.floor(tx / k);
    const cy0 = Math.floor(ty / k);
    for (let cy = cy0 - cr; cy <= cy0 + cr; cy++) {
      if (cy < 0 || cy >= this.cellsY) continue;
      for (let cx = cx0 - cr; cx <= cx0 + cr; cx++) {
        if (cx < 0 || cx >= this.cellsX) continue;
        const d = Math.hypot((cx + 0.5) * k - tx, (cy + 0.5) * k - ty) / tpu;
        if (d > radius) continue;
        const ci = cy * this.cellsX + cx;
        if (this.acc[ci] >= 1) continue;
        this.acc[ci] = Math.min(1, this.acc[ci] + amount * (1 - d / radius));
        this.paintCell(cx, cy);
        this.dirty = true;
      }
    }
  }

  private paintCell(cx: number, cy: number) {
    const { k, W, H } = this;
    const lvl = this.acc[cy * this.cellsX + cx] * 255 * 0.45;
    for (let y = cy * k; y < Math.min(H, cy * k + k); y++) {
      const row = H - 1 - y;
      for (let x = cx * k; x < Math.min(W, cx * k + k); x++) {
        const i = row * W + x;
        const o = i * 4;
        if (!this.base[o + 3]) continue;
        const on = this.thr[i] < lvl;
        this.data[o] = on ? this.cocoa[0] : this.base[o];
        this.data[o + 1] = on ? this.cocoa[1] : this.base[o + 1];
        this.data[o + 2] = on ? this.cocoa[2] : this.base[o + 2];
      }
    }
  }

  clean() {
    this.acc.fill(0);
    this.data.set(this.base);
    this.tex.needsUpdate = true;
  }

  flush() {
    if (this.dirty) {
      this.tex.needsUpdate = true;
      this.dirty = false;
    }
  }

  dispose() {
    this.tex.dispose();
  }
}
