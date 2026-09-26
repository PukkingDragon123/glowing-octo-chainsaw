import * as THREE from 'three';
import * as clerkModule from '../art/clerk';

/** What the game needs from the clerk rig (works with the full rig or a bare placeholder). */
export interface ClerkAPI {
  root: THREE.Group;
  hit: THREE.Object3D;
  receipt: THREE.Mesh;
  update(dt: number, t: number, camera?: THREE.Camera): void;
  wave(): Promise<void>;
  cheer(): Promise<void>;
  point(): Promise<void>;
  scan(): Promise<void>;
  print(tex?: THREE.Texture): Promise<void>;
  hideReceipt(): void;
  lookAt(p: THREE.Vector3 | null): void;
  setMood(m: 'idle' | 'happy' | 'surprised' | 'sleepy'): void;
}

type Partial2 = Partial<ClerkAPI> & { root: THREE.Group; update(dt: number, t: number, camera?: THREE.Camera): void };

export function makeClerk(): ClerkAPI {
  const Ctor = clerkModule.Clerk as unknown as new () => Partial2;
  const c = new Ctor();
  const noop = async () => {};
  let hit = c.hit;
  if (!hit) {
    hit = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.9, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.0;
    c.root.add(hit);
  }
  hit.userData.clerk = true;
  let receipt = c.receipt;
  if (!receipt) {
    receipt = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.5), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }));
    receipt.visible = false;
    receipt.position.set(0.4, 1.0, 0.45);
    c.root.add(receipt);
  }
  return {
    root: c.root,
    hit,
    receipt,
    update: (dt, t, cam) => c.update(dt, t, cam),
    wave: c.wave?.bind(c) ?? noop,
    cheer: c.cheer?.bind(c) ?? noop,
    point: c.point?.bind(c) ?? noop,
    scan: c.scan?.bind(c) ?? noop,
    print: c.print?.bind(c) ?? (async () => void (receipt!.visible = true)),
    hideReceipt: c.hideReceipt?.bind(c) ?? (() => void (receipt!.visible = false)),
    lookAt: c.lookAt?.bind(c) ?? (() => {}),
    setMood: c.setMood?.bind(c) ?? (() => {}),
  };
}
