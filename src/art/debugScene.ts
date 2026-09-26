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

  if ((params.get('s') ?? kind) === 'clerk' && params.has('flat')) {
    // flat clerk art at high zoom: the rest-pose portrait plus every animation frame
    root.style.background = params.get('bg') ?? '#f6e7c8';
    root.style.alignItems = 'flex-start';
    const { buildClerkArt, clerkPortrait } = await import('./clerk/art');
    const art = buildClerkArt();
    const scale = Number(params.get('scale') ?? 5);
    const show = (src: HTMLCanvasElement, k = scale) => {
      const c = document.createElement('canvas');
      c.width = src.width * k;
      c.height = src.height * k;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, 0, 0, c.width, c.height);
      root.appendChild(c);
    };
    const eyes = (params.get('eyes') ?? 'dot') as 'dot';
    const mouth = (params.get('mouth') ?? 'grin') as 'grin';
    show(clerkPortrait(art, { eyes, mouth, curl: Number(params.get('curl') ?? 1) }).toCanvas());
    if (params.has('frames')) {
      const k = Math.max(2, scale - 1);
      for (const s of Object.values(art.eyes)) show(s.bmp.toCanvas(), k);
      for (const s of Object.values(art.mouth)) show(s.bmp.toCanvas(), k);
      for (const s of art.drill) show(s.bmp.toCanvas(), k);
      for (const f of art.fingers) for (const s of f) show(s.bmp.toCanvas(), k);
      for (const s of art.bubbles) show(s.bmp.toCanvas(), k);
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
    // ?cam=front|low|high|left|right|close  ?counter=0  ?ui=0  ?pause=1 (only advanceScene moves time)
    const mod = await import('./clerk');
    const clerk = new mod.Clerk();
    scene.add(clerk.root);
    (window as unknown as { clerk: unknown }).clerk = clerk;
    if (params.get('counter') !== '0') {
      // checkout counter: 0.95 tall, 0.7 deep, just in front of the clerk
      const lam = (c: string) => new THREE.MeshLambertMaterial({ color: c });
      const counter = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.89, 0.66), lam('#f47c9f'));
      body.position.set(0, 0.445, 0.56);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.08, 0.67), lam('#fff4e6'));
      stripe.position.set(0, 0.7, 0.56);
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 0.74), lam('#fbefe0'));
      top.position.set(0, 0.92, 0.55);
      const item = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.12), lam('#58a8d8'));
      item.position.set(0.72, 1.05, 0.45);
      const item2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 12), lam('#ffd460'));
      item2.position.set(-0.55, 1.03, 0.5);
      for (const m of [body, stripe, top, item, item2]) {
        m.castShadow = true;
        m.receiveShadow = true;
        counter.add(m);
      }
      scene.add(counter);
    }
    const cams: Record<string, number[]> = {
      front: [0, 1.5, 4.4, 0, 1.08, 0],
      low: [0, 1.2, 4.2, 0, 1.05, 0],
      high: [0, 2.0, 4.6, 0, 1.0, 0],
      right: [2.2, 1.5, 3.81, 0, 1.08, 0],
      left: [-2.2, 1.5, 3.81, 0, 1.08, 0],
      close: [0.35, 1.4, 2.5, 0.15, 1.18, 0],
      far: [0, 1.9, 7.5, 0, 1.0, 0],
    };
    const c = cams[params.get('cam') ?? 'front'] ?? cams.front;
    camera.position.set(c[0], c[1], c[2]);
    camera.lookAt(c[3], c[4], c[5]);
    updaters.push((dt, t) => clerk.update(dt, t, camera));
    const acts: Record<string, () => unknown> = {
      '1': () => clerk.wave(),
      '2': () => clerk.cheer(),
      '3': () => clerk.point(),
      '4': () => clerk.scan(),
      '5': () => clerk.print(),
      '6': () => clerk.hideReceipt(),
      q: () => clerk.setMood('idle'),
      w: () => clerk.setMood('happy'),
      e: () => clerk.setMood('surprised'),
      r: () => clerk.setMood('sleepy'),
    };
    window.addEventListener('keydown', (ev) => acts[ev.key.toLowerCase()]?.());
    // the axolotl follows the pointer across a plane just in front of the counter
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.9);
    const hitPt = new THREE.Vector3();
    window.addEventListener('pointermove', (ev) => {
      ray.setFromCamera(new THREE.Vector2((ev.clientX / window.innerWidth) * 2 - 1, -(ev.clientY / window.innerHeight) * 2 + 1), camera);
      if (ray.ray.intersectPlane(plane, hitPt)) clerk.lookAt(hitPt);
    });
    document.addEventListener('pointerleave', () => clerk.lookAt(null));
    if (params.get('ui') !== '0') {
      const legend = document.createElement('div');
      legend.style.cssText = 'position:fixed;left:10px;bottom:10px;font:12px monospace;color:#3a2d33;background:#fff8ecd0;padding:6px 8px;border-radius:6px;pointer-events:none';
      legend.textContent = '1 wave · 2 cheer · 3 point · 4 scan · 5 print · 6 hide receipt · q/w/e/r mood idle/happy/surprised/sleepy · pointer = look';
      document.body.appendChild(legend);
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
  const paused = params.has('pause');
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) {
      time += dt;
      for (const u of updaters) u(dt, time);
    }
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
