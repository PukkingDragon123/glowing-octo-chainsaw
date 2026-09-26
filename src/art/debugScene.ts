import * as THREE from 'three';
import { PixelRenderer } from '../engine/PixelRenderer';

/** Dev-only live previews for art that needs three.js. */
export async function showScene(root: HTMLElement, kind: string, params: URLSearchParams) {
  if (kind === 'buddy') {
    root.style.background = '#fbe7a1';
    const { CAST } = await import('./cast');
    const { buddyPortrait } = await import('./buddy');
    const scale = Number(params.get('scale') ?? 4);
    for (const spec of Object.values(CAST)) {
      for (const pose of [{}, { armR: 1, eyes: 'happy' as const, mouth: 'open' as const }]) {
        const b = buddyPortrait(spec, pose);
        const src = b.toCanvas();
        const c = document.createElement('canvas');
        c.width = src.width * scale;
        c.height = src.height * scale;
        const ctx = c.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(src, 0, 0, c.width, c.height);
        c.title = spec.id;
        root.appendChild(c);
      }
    }
    return;
  }

  // live 3D preview
  root.style.cssText = 'position:fixed;inset:0;padding:0;background:#222';
  const pixel = new PixelRenderer(root);
  pixel.setTargetLines(Number(params.get('lines') ?? 420), 1, 4);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(params.get('bg') ?? '#f6e7c8');
  scene.add(new THREE.HemisphereLight('#ffffff', '#b0a090', 2));
  const sun = new THREE.DirectionalLight('#ffffff', 1.6);
  sun.position.set(-2, 5, 4);
  sun.castShadow = true;
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshLambertMaterial({ color: '#e9d7b0' }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 1.1, 5);
  camera.lookAt(0, 0.6, 0);
  const updaters: ((dt: number, t: number) => void)[] = [];
  const which = params.get('s') ?? kind;

  if (which === 'buddies' || which === 'scene') {
    const { CAST } = await import('./cast');
    const { Buddy } = await import('./buddy');
    const ids = Object.keys(CAST);
    const perRow = 8;
    ids.forEach((id, i) => {
      const b = new Buddy(CAST[id], 64);
      const row = Math.floor(i / perRow);
      b.position.set((i % perRow - (perRow - 1) / 2) * 0.72, 0, -row * 1.1);
      scene.add(b);
      const acts = [() => b.wave(), () => b.cheer(), () => b.hop(), () => b.boop(), () => b.spin()];
      let next = 1 + Math.random() * 2;
      updaters.push((dt) => {
        next -= dt;
        if (next < 0) {
          void acts[Math.floor(Math.random() * acts.length)]();
          next = 1.5 + Math.random() * 3;
        }
        b.update(dt, camera);
      });
    });
    camera.position.set(0, 1.6, 6.2);
    camera.lookAt(0, 0.4, -0.8);
  }
  if (which === 'clerk') {
    const mod = await import('./clerk');
    if (mod) {
      const clerk = new mod.Clerk();
      scene.add(clerk.root);
      updaters.push((dt, t) => clerk.update(dt, t));
      (window as unknown as { clerk: unknown }).clerk = clerk;
      camera.position.set(0, 1.2, 4.2);
      camera.lookAt(0, 0.9, 0);
    }
  }

  const resize = () => {
    pixel.resize(window.innerWidth, window.innerHeight);
    camera.aspect = pixel.aspect;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();
  let last = performance.now();
  let time = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    for (const u of updaters) u(dt, time);
    pixel.render(scene, camera);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  (window as unknown as { advanceScene: (s: number) => void }).advanceScene = (s: number) => {
    for (let k = 0; k < s * 60; k++) {
      time += 1 / 60;
      for (const u of updaters) u(1 / 60, time);
    }
    pixel.render(scene, camera);
  };
}
