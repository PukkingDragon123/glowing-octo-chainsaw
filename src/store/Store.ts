import * as THREE from 'three';
import { Batcher } from '../engine/batch';
import { buildGondola, buildShell, hangingSign, STORE } from './fixtures';

export class Store {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 90);
  camX = 0;
  targetX = 0;
  private sun: THREE.DirectionalLight;
  private signs: THREE.Group[] = [];

  constructor() {
    this.scene.background = new THREE.Color('#141b2d');
    buildShell(this.scene);

    const hemi = new THREE.HemisphereLight('#fff8ec', '#8d93b5', 1.6);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -8;
    sc.right = 8;
    sc.top = 5;
    sc.bottom = -3;
    sc.near = 0.5;
    sc.far = 30;
    this.sun.shadow.bias = -0.0015;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    const b = new Batcher();
    buildGondola(b, 2.5, 6.5, { seed: 1 });
    buildGondola(b, 6.5, 10.5, { seed: 2 });
    buildGondola(b, -1.5, 2.5, { seed: 3, fillerKinds: ['box', 'bag'] });
    this.scene.add(b.build());

    const s1 = hangingSign('SNACKS', '#ff5d73', 6.5, 0.2);
    this.signs.push(s1);
    this.scene.add(s1);
  }

  update(dt: number, time: number) {
    this.camX += (this.targetX - this.camX) * (1 - Math.exp(-6 * dt));
    this.camera.position.set(this.camX, 1.45, 4.4);
    this.camera.lookAt(this.camX, 1.18, STORE.shelfFrontZ);
    this.sun.position.set(this.camX + 3, 7, 6);
    this.sun.target.position.set(this.camX, 0, -1);
    for (const s of this.signs) s.rotation.z = Math.sin(time * 0.8 + s.userData.swayPhase) * 0.012;
  }
}
