import * as THREE from 'three';
import { Buddy } from '../art/buddy';
import { CAST } from '../art/cast';

/** Shoppers: buddies who wander the aisles, browse, hop, and wave when you come close. */

interface Shopper {
  b: Buddy;
  home: number;
  range: number;
  target: number;
  wait: number;
  speed: number;
  z: number;
  waved: number;
}

export class Shoppers {
  readonly group = new THREE.Group();
  readonly list: Shopper[] = [];

  constructor(spots: { id: string; x: number; range?: number; z?: number }[], ppu = 72) {
    for (const s of spots) {
      const spec = CAST[s.id];
      if (!spec) continue;
      const b = new Buddy(spec, ppu);
      const z = s.z ?? -0.72 + Math.random() * 0.3;
      b.position.set(s.x, 0, z);
      this.group.add(b);
      this.list.push({ b, home: s.x, range: s.range ?? 3, target: s.x, wait: 1 + Math.random() * 3, speed: 0.55 + Math.random() * 0.3, z, waved: 0 });
    }
  }

  get hits() {
    return this.list.map((s) => s.b.hit);
  }

  /** A shopper reacts to being clicked. */
  poke(b: Buddy) {
    const s = this.list.find((q) => q.b === b);
    if (!s) return;
    s.wait = Math.max(s.wait, 1.4);
    s.b.walkSpeed = 0;
    void b.boop();
  }

  update(dt: number, camera: THREE.Camera, camX: number, zoom = 0) {
    for (const s of this.list) {
      const b = s.b;
      const dx = s.target - b.position.x;
      if (s.wait > 0) {
        s.wait -= dt;
        b.walkSpeed = 0;
        if (s.wait <= 0) {
          s.target = s.home + (Math.random() - 0.5) * 2 * s.range;
          const roll = Math.random();
          if (roll < 0.15) void b.hop();
          else if (roll < 0.25) void b.nod();
        }
      } else if (Math.abs(dx) > 0.03) {
        const step = Math.sign(dx) * Math.min(Math.abs(dx), s.speed * dt);
        b.position.x += step;
        b.facing = Math.sign(dx);
        b.walkSpeed = s.speed;
      } else {
        s.wait = 1.5 + Math.random() * 4;
        b.walkSpeed = 0;
        b.look((Math.random() - 0.5) * 2);
      }
      // wave hello when the camera arrives nearby (once in a while)
      s.waved -= dt;
      if (Math.abs(b.position.x - camX) < 1.6 && s.waved <= 0 && b.walkSpeed === 0) {
        s.waved = 14 + Math.random() * 10;
        void b.wave();
      }
      // step out of the way when the camera leans in close
      b.visible = !(zoom > 0.28 && Math.abs(b.position.x - camX) < 0.9 + (1 - zoom) * 1.6);
      b.update(dt, camera);
    }
  }
}
