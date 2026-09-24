import * as THREE from 'three';
import { Painter, shade } from '../../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../../engine/pixelFont';
import { ease } from '../../engine/tween';
import { audio } from '../../engine/audio';
import type { Flavor, ProductContext, ProductDef, SectionId, ShowcaseItem } from '../types';
import { atlasBox } from './box';
import { layoutModules, orderSpots } from './qrLayout';
import { QRSwarm } from './swarm';
import { Particles } from './props';
import { composePoster, posterScale } from './poster';

export interface StubMeta {
  id: string;
  name: string;
  tagline: string;
  reveal: string;
  section: SectionId;
  price: number;
  badge?: ProductDef['badge'];
  preferredMode?: ProductDef['preferredMode'];
  flavors: Flavor[];
}

const INK = '#1d1b26';

function stubFront(meta: StubMeta, f: Flavor): Painter {
  const p = new Painter(64, 88);
  const bg = f.c.main ?? '#5b8def';
  p.clear(bg);
  p.grid(0, 0, 64, 88, 6, shade(bg, 0.08), 2);
  const words = meta.name.toUpperCase().split(' ');
  words.forEach((w, i) => p.text(w, 32, 6 + i * 10, { font: FONT_BIG, bold: true, color: '#ffffff', outline: INK, align: 'center' }));
  p.roundRect(12, 30, 40, 40, 4, INK);
  p.roundRect(13, 31, 38, 38, 3, '#ffffff');
  p.text('?', 32, 44, { font: FONT_BIG, scale: 2, color: bg, align: 'center' });
  p.text(f.name.toUpperCase(), 32, 76, { font: FONT_TINY, color: '#ffffff', outline: INK, align: 'center' });
  return p;
}

/** Placeholder product: a mystery box that pops open and tiles the QR. Replaced by real products. */
export function makeStub(meta: StubMeta): ProductDef {
  const box = (f: Flavor, s: number, mip: boolean) => {
    const front = stubFront(meta, f).canvas;
    const side = new Painter(24, 88).clear(shade(f.c.main ?? '#5b8def', -0.15)).canvas;
    const top = new Painter(64, 24).clear(shade(f.c.main ?? '#5b8def', 0.1)).canvas;
    const m = atlasBox(0.64 * s, 0.88 * s, 0.24 * s, { px: side, nx: side, py: top, ny: top, pz: front, nz: front }, { mipmaps: mip });
    m.position.y = 0.44 * s;
    const g = new THREE.Group();
    g.add(m);
    return g;
  };

  function createShowcase(ctx: ProductContext): ShowcaseItem {
    const { qr, flavor: f, tweens, group: tg } = ctx;
    const root = new THREE.Group();
    const mystery = box(f, 2.2, false);
    mystery.position.set(-1.6, 0, -0.2);
    root.add(mystery);
    const size = 2.3;
    const center = new THREE.Vector3(0.55, 0.04, 0.3);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(size + 0.25, 0.04, size + 0.25), new THREE.MeshToonMaterial({ color: '#ffffff' }));
    plate.position.set(center.x, 0.02, center.z);
    plate.receiveShadow = true;
    root.add(plate);
    const qrSize = (size * qr.size) / (qr.size + 4);
    const m = qrSize / qr.size;
    const spots = layoutModules(qr, { size: qrSize, center: new THREE.Vector3(center.x, 0.04 + m * 0.2, center.z) });
    const col = new THREE.Color(INK);
    const swarm = new QRSwarm({
      spots,
      data: { geometry: new THREE.BoxGeometry(1, 1, 1), scale: new THREE.Vector3(m * 0.95, m * 0.4, m * 0.95), scanScale: new THREE.Vector3(1.06, 1, 1.06), color: () => [col.clone(), col.clone()] },
      radius: m * 0.2,
    });
    for (const mesh of swarm.meshes) root.add(mesh);
    const fx = new Particles(120);
    root.add(fx.mesh);
    let time = 0;
    return {
      root,
      actionLabel: 'Open it!',
      hero: { target: new THREE.Vector3(-0.3, 0.8, 0.1), distance: 6, yaw: 0, pitch: 0.4 },
      async reveal() {
        swarm.hideAll();
        audio.play('pop');
        await tweens.tween(0.4, (t) => (mystery.scale.y = 1 - Math.sin(t * Math.PI) * 0.15), ease.linear, tg);
        fx.burst(new THREE.Vector3(-1.6, 2, -0.2), { count: 30, color: [f.c.main ?? '#5b8def', '#ffffff'], speed: 2, up: 3 });
        await swarm.assemble(orderSpots(spots.map((s, i) => ({ ...s, i })), 'wave').map((s) => s.i), 1.4, 0.4, 0.5);
        audio.play('tada');
      },
      finish() {
        tweens.cancel(tg);
        swarm.settleAll();
      },
      update(dt) {
        time += dt;
        mystery.rotation.y = Math.sin(time) * 0.2;
        swarm.update(dt);
        fx.update(dt);
      },
      focusView: () => ({ center: center.clone(), normal: new THREE.Vector3(0, 1, 0), size, up: new THREE.Vector3(0, 0, -1) }),
      setScanMode: (on) => swarm.setScanMode(on),
      dispose: () => swarm.dispose(),
    };
  }

  return {
    ...meta,
    shelfSize: [0.3, 0.4],
    shelfModel: (f) => box(f, 0.45, true),
    createShowcase,
    poster(ctx) {
      const art = stubFront(meta, ctx.flavor);
      return composePoster(art, posterScale(art.w), { qr: ctx.qr, x: 13, y: 31, size: 38, dark: INK, light: '#ffffff', quiet: 2 }, { label: ctx.label, product: meta.name, accent: ctx.flavor.c.main });
    },
  };
}
