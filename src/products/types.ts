import type * as THREE from 'three';
import type { QRMatrix } from '../qr/qr';
import type { PixelArt } from '../qr/pixelCodec';
import type { Tweens } from '../engine/tween';

export type SectionId = 'counter' | 'media' | 'snacks' | 'cereal' | 'fresh' | 'cooler' | 'freezer' | 'premium';

export interface Flavor {
  id: string;
  name: string;
  /** Named colours used by the product's art. */
  c: Record<string, string>;
}

export interface ProductContext {
  qr: QRMatrix;
  flavor: Flavor;
  /** Pixel postcard / flipbook when the content is an image or video. */
  art: PixelArt | null;
  /** Short human description of what the QR holds. */
  label: string;
  tweens: Tweens;
  /** Tween group for this showcase, cancelled on exit. */
  group: string;
}

export interface FocusView {
  /** Centre of the QR in world space. */
  center: THREE.Vector3;
  /** Direction the QR faces (camera sits along this). */
  normal: THREE.Vector3;
  /** World size of the QR including quiet zone. */
  size: number;
  /** Screen-up direction when looking at the QR. */
  up: THREE.Vector3;
}

/** Where the link sticker sits on the unopened package (the diegetic input). */
export interface LabelAnchor {
  /** Object the sticker is glued to; it moves with it until the reveal starts. */
  object: THREE.Object3D;
  /** Sticker centre in the object's local space. */
  position: THREE.Vector3;
  /** Sticker rotation in the object's local space (default: facing +Z). */
  rotation?: THREE.Euler;
  /** Sticker size in world units [width, height]. */
  size: [number, number];
}

export interface ShowcaseItem {
  root: THREE.Object3D;
  /** Plays the unboxing and builds the QR. Resolves once the QR is complete. */
  reveal(): Promise<void>;
  /** Skip straight to the finished QR. */
  finish(): void;
  update(dt: number, time: number, camera?: THREE.Camera): void;
  focusView(): FocusView;
  /** Called when scan mode toggles, e.g. to switch to scan-safe colours. */
  setScanMode?(on: boolean): void;
  /** Where the link sticker goes on the package before it is opened. */
  label?: LabelAnchor;
  /** Camera target + distance for the idle view before the reveal. */
  hero: { target: THREE.Vector3; distance: number; yaw?: number; pitch?: number };
  /** Optional pointer interaction (scratch cards etc). Return true if handled. */
  pointer?(kind: 'down' | 'move' | 'up', hit: THREE.Intersection | null, ray: THREE.Ray): boolean;
  /** Short instruction shown before reveal, e.g. "Rip it open!". */
  actionLabel?: string;
  /** Optional replayable fun action once the code is built (e.g. "Shake it!"). */
  extra?: { label: string; run: () => Promise<void> | void };
  dispose(): void;
}

export interface ProductDef {
  id: string;
  name: string;
  tagline: string;
  /** One line about how the QR is revealed. */
  reveal: string;
  section: SectionId;
  /** Price in QRBucks, 0 = free. */
  price: number;
  badge?: 'NEW' | 'HOT' | 'LIMITED' | 'RARE';
  flavors: Flavor[];
  /** Content types listed first in the editor. */
  preferredMode?: 'link' | 'text' | 'wifi' | 'contact' | 'image' | 'video';
  /** Small model for the shelf, bottom-centred at the origin, facing +Z. */
  shelfModel(flavor: Flavor): THREE.Object3D;
  /** Approximate shelf footprint [width, height] in world units. */
  shelfSize: [number, number];
  createShowcase(ctx: ProductContext): ShowcaseItem;
  /** Downloadable pixel-art poster that still scans. */
  poster(ctx: ProductContext): HTMLCanvasElement;
}
