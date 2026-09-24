import * as THREE from 'three';
import { rng } from '../../engine/tween';
import { toonGradient } from '../../engine/voxel';
import type { QRMatrix } from '../../qr/qr';
import { NORI, NORI_SCAN } from './art';

/** sRGB bytes of a #rrggbb colour (DataTextures below are tagged sRGB). */
const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

const NORI_FUN = ['#1c291f', NORI, '#253528', '#2c3e30'];

/**
 * The nori sheet: a bendable plane whose texture starts as solid nori and gets "punched" into the QR.
 * Local origin = bottom-centre of the sheet; the sheet lies on the local XY plane facing +Z.
 */
export class NoriSheet {
  readonly mesh: THREE.Mesh;
  readonly size: number;
  readonly punched: Uint8Array;
  private tex: THREE.DataTexture;
  private data: Uint8Array;
  private noise: Uint8Array;
  private N: number;
  private k: number;
  private geo: THREE.PlaneGeometry;
  private vArr: Float32Array;
  private scan = false;
  private palette: number[][];
  private scanRGB: number[];

  constructor(private qr: QRMatrix, size: number) {
    this.size = size;
    const n = qr.size;
    this.k = Math.max(2, Math.min(6, Math.floor(200 / n)));
    this.N = n * this.k;
    this.data = new Uint8Array(this.N * this.N * 4);
    this.noise = new Uint8Array(this.N * this.N);
    const r = rng(7);
    for (let i = 0; i < this.noise.length; i++) {
      const x = r();
      this.noise[i] = x < 0.18 ? 0 : x < 0.72 ? 1 : x < 0.93 ? 2 : 3;
    }
    this.palette = NORI_FUN.map(hex);
    this.scanRGB = hex(NORI_SCAN);
    this.punched = new Uint8Array(n * n);
    this.tex = new THREE.DataTexture(this.data, this.N, this.N, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.minFilter = THREE.NearestFilter;
    this.tex.generateMipmaps = false;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.redraw();

    const SEG = 24;
    this.geo = new THREE.PlaneGeometry(size, size, 1, SEG);
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    this.vArr = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) this.vArr[i] = pos.getY(i) + size / 2;
    const mat = new THREE.MeshToonMaterial({ map: this.tex, gradientMap: toonGradient(), alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.setWrap(size, 0);
  }

  /** Is module (r,c) nori right now? */
  private solid(r: number, c: number) {
    return this.qr.isDark(r, c) || !this.punched[r * this.qr.size + c];
  }

  private paintModule(r: number, c: number) {
    const { k, N, data } = this;
    const on = this.solid(r, c);
    for (let y = 0; y < k; y++) {
      const row = N - 1 - (r * k + y);
      for (let x = 0; x < k; x++) {
        const col = c * k + x;
        const i = row * N + col;
        const o = i * 4;
        const rgb = this.scan ? this.scanRGB : this.palette[this.noise[i]];
        data[o] = rgb[0];
        data[o + 1] = rgb[1];
        data[o + 2] = rgb[2];
        data[o + 3] = on ? 255 : 0;
      }
    }
  }

  redraw() {
    const n = this.qr.size;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) this.paintModule(r, c);
    this.tex.needsUpdate = true;
  }

  /** Punch one light module out of the sheet. */
  punch(r: number, c: number) {
    this.punched[r * this.qr.size + c] = 1;
    this.paintModule(r, c);
    this.tex.needsUpdate = true;
  }

  punchAll() {
    this.punched.fill(1);
    this.redraw();
  }

  unpunchAll() {
    this.punched.fill(0);
    this.redraw();
  }

  setScan(on: boolean) {
    if (this.scan === on) return;
    this.scan = on;
    this.redraw();
  }

  /**
   * Bend the sheet: the bottom `vw` of it lies flat on the rice, the rest curls away from the face
   * (arc of radius `rc`, then straight at angle `theta` from the face).
   */
  setWrap(vw: number, theta: number, rc = 0.1) {
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    const nor = this.geo.attributes.normal as THREE.BufferAttribute;
    const arcLen = rc * theta;
    const st = Math.sin(theta);
    const ct = Math.cos(theta);
    for (let i = 0; i < pos.count; i++) {
      const v = this.vArr[i];
      let y: number;
      let z: number;
      let ny = 0;
      let nz = 1;
      if (v <= vw) {
        y = v;
        z = 0;
      } else {
        const s = v - vw;
        if (s <= arcLen) {
          const a = s / rc;
          y = vw + rc * Math.sin(a);
          z = rc * (1 - Math.cos(a));
          ny = -Math.sin(a);
          nz = Math.cos(a);
        } else {
          const rest = s - arcLen;
          y = vw + rc * st + rest * ct;
          z = rc * (1 - ct) + rest * st;
          ny = -st;
          nz = ct;
        }
      }
      pos.setY(i, y);
      pos.setZ(i, z);
      nor.setXYZ(i, 0, ny, nz);
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }

  dispose() {
    this.geo.dispose();
    this.tex.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/**
 * Tear strip "1": a long ribbon on the front of the film that rolls itself up like a scroll as it
 * is pulled down. Local origin = top of the strip; the strip hangs down along -Y on the XY plane.
 */
export class TearStrip {
  readonly mesh: THREE.Mesh;
  private geo: THREE.PlaneGeometry;
  private sArr: Float32Array;

  constructor(readonly len: number, width: number, tex: THREE.Texture) {
    const SEG = 220;
    this.geo = new THREE.PlaneGeometry(width, len, 1, SEG);
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    this.sArr = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) this.sArr[i] = len / 2 - pos.getY(i);
    const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient(), side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.castShadow = true;
    this.setPeel(0);
  }

  /** `sp` = how much of the strip (from the top) has been rolled up. */
  setPeel(sp: number) {
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    const nor = this.geo.attributes.normal as THREE.BufferAttribute;
    const rho0 = 0.05;
    const gap = 0.011;
    const psiMax = sp / rho0;
    const outer = rho0 + (gap * psiMax) / (Math.PI * 2);
    for (let i = 0; i < pos.count; i++) {
      const s = this.sArr[i];
      if (s >= sp) {
        pos.setY(i, -s);
        pos.setZ(i, 0);
        nor.setXYZ(i, 0, 0, 1);
        continue;
      }
      const psi = (sp - s) / rho0;
      const rho = rho0 + (gap * (psiMax - psi)) / (Math.PI * 2);
      const sn = Math.sin(psi);
      const cs = Math.cos(psi);
      pos.setY(i, -sp + rho * sn);
      pos.setZ(i, outer - rho * cs);
      nor.setXYZ(i, 0, -sn, cs);
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }

  dispose() {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
