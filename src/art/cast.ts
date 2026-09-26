import type { BuddySpec } from './buddy';
import { ellipse, hex, poly, rect, type Bitmap, type Mask } from './pixel';

/** The cast of Xolotl Kobini: shoppers wandering the aisles and every product's mascot. */

const TEAL = { color: '#58a88f', tip: '#f3d270' };

function speckle(color: string, n: number, seed = 1) {
  return (b: Bitmap, m: Mask) => {
    const c = hex(color);
    let s = seed * 9301 + 49297;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const inner = m.erode().erode();
    const spots: number[] = [];
    for (let i = 0; i < inner.m.length; i++) if (inner.m[i]) spots.push(i);
    for (let k = 0; k < n && spots.length; k++) {
      const i = spots[Math.floor(r() * spots.length)];
      const x = i % m.w;
      const y = Math.floor(i / m.w);
      b.set(x, y, c);
      if (r() < 0.5 && inner.get(x + 1, y)) b.set(x + 1, y, c);
    }
  };
}

export const CAST: Record<string, BuddySpec> = {
  // ---- shoppers
  apple: {
    id: 'apple',
    body: { shape: 'round', w: 40, h: 36, color: '#ec7466', shade: '#c9534f' },
    limbs: TEAL,
    top: { kind: 'leaf' },
    mouth: { style: 'grin' },
  },
  eggy: {
    id: 'eggy',
    body: { shape: 'round', w: 32, h: 40, color: '#fff4e2', shade: '#e3cfb5' },
    limbs: { color: '#f59a3c', tip: '#fff4e2' },
    top: { kind: 'sprout' },
    mouth: { style: 'smile' },
    blush: '#ffb0b8',
  },
  milko: {
    id: 'milko',
    body: {
      shape: 'box',
      w: 30,
      h: 40,
      color: '#fbfbff',
      shade: '#d6dbea',
      pattern: (b, m) => {
        b.paint(rect(m.w, m.h, 0, m.h * 0.66, m.w, m.h * 0.2).intersect(m), '#6fb7e8');
        b.paint(ellipse(m.w, m.h, m.w * 0.5, m.h * 0.76, 3, 2.4).intersect(m), '#fbfbff');
      },
    },
    limbs: { color: '#6fb7e8', tip: '#fbfbff' },
    top: { kind: 'cap', color: '#6fb7e8', color2: '#3f86c4' },
    mouth: { style: 'open' },
  },
  berry: {
    id: 'berry',
    body: { shape: 'drop', w: 34, h: 38, color: '#ef4a5a', shade: '#bd2f45', pattern: speckle('#ffe28a', 14, 3) },
    limbs: { color: '#4f9a4a', tip: '#ffe7a0' },
    top: { kind: 'sprout', color: '#3f8f45', color2: '#6fc35c' },
    mouth: { style: 'grin' },
    blush: '#ffd0a0',
  },
  avo: {
    id: 'avo',
    body: {
      shape: 'bean',
      w: 34,
      h: 40,
      color: '#3f7d3a',
      shade: '#2c5c2c',
      pattern: (b, m) => {
        b.paint(ellipse(m.w, m.h, m.w * 0.48, m.h * 0.56, m.w * 0.34, m.h * 0.36).intersect(m), '#d8e88a');
        b.paint(ellipse(m.w, m.h, m.w * 0.48, m.h * 0.8, 3.5, 3), '#8a5a36');
      },
    },
    eyes: { y: 0.4 },
    mouth: { style: 'grin', y: 0.5, w: 12 },
    limbs: { color: '#2c5c2c', tip: '#f3d270' },
  },
  bao: {
    id: 'bao',
    body: {
      shape: 'blobby',
      w: 40,
      h: 30,
      color: '#fff7ec',
      shade: '#eadbc8',
      pattern: (b, m) => {
        const c = hex('#e3d2bb');
        for (let k = -2; k <= 2; k++) for (let y = 3; y < 8; y++) b.set(Math.round(m.w / 2 + k * 3 + (y - 3) * k * 0.3), y, c);
      },
    },
    limbs: { color: '#f2a65a', tip: '#fff7ec', arm: 10, leg: 7 },
    mouth: { style: 'smile' },
    blush: '#ffb0b8',
  },
  pudding: {
    id: 'pudding',
    body: {
      shape: 'can',
      w: 34,
      h: 32,
      color: '#ffd77a',
      shade: '#e8b04a',
      pattern: (b, m) => {
        b.paint(rect(m.w, m.h, 0, 0, m.w, m.h * 0.3).intersect(m), '#9a4f1c');
        b.paint(poly(m.w, m.h, [
          [m.w * 0.3, m.h * 0.28],
          [m.w * 0.36, m.h * 0.44],
          [m.w * 0.42, m.h * 0.28],
        ]).intersect(m), '#9a4f1c');
      },
    },
    top: { kind: 'swirl' },
    eyes: { y: 0.5 },
    mouth: { style: 'grin', y: 0.64 },
    limbs: { color: '#b86b3a', tip: '#fff1cc' },
  },

  // ---- product mascots
  captain: {
    id: 'captain',
    body: { shape: 'round', w: 40, h: 38, color: '#a0633a', shade: '#744326', pattern: speckle('#7d4a2a', 10, 5) },
    limbs: { color: '#2d3f7c', tip: '#ffffff' },
    top: { kind: 'captain' },
    mouth: { style: 'grin' },
  },
  drops: {
    id: 'drops',
    body: {
      shape: 'round',
      w: 34,
      h: 34,
      color: '#ff6fa3',
      shade: '#d9467f',
      pattern: (b, m) => {
        const c = hex('#ffd1e3');
        for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) && (x + y) % 9 === 0 && y < m.h * 0.3) b.set(x, y, c);
      },
    },
    top: { kind: 'bow', color: '#ffd23f', color2: '#fff1a8' },
    limbs: { color: '#7c5cff', tip: '#ffe28a' },
    mouth: { style: 'grin' },
  },
  choco: {
    id: 'choco',
    body: {
      shape: 'squircle',
      w: 36,
      h: 36,
      color: '#7a432a',
      shade: '#55291a',
      pattern: (b, m) => {
        const c = hex('#5e321f');
        for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) && (x === Math.round(m.w / 2) || y === Math.round(m.h * 0.78)) && y > m.h * 0.66) b.set(x, y, c);
      },
    },
    top: { kind: 'drip', color: '#fff4dc' },
    limbs: { color: '#ff8fb1', tip: '#fff4dc' },
    mouth: { style: 'grin' },
  },
  donut: {
    id: 'donut',
    body: {
      shape: 'round',
      w: 40,
      h: 34,
      color: '#e0a060',
      shade: '#b8763c',
      pattern: (b, m) => {
        const icing = hex('#ff8cb4');
        for (let y = 0; y < m.h; y++)
          for (let x = 0; x < m.w; x++) {
            const edge = m.h * 0.36 + Math.sin(x * 0.9) * 1.6 + (x % 7 === 0 ? 2 : 0);
            if (m.get(x, y) && y < edge && m.get(x, y - 1)) b.set(x, y, icing);
          }
        const sp = ['#ffffff', '#7fd3ff', '#ffe066', '#8be07a'].map(hex);
        for (let k = 0; k < 9; k++) b.set(8 + ((k * 7) % 26), 5 + ((k * 5) % 7), sp[k % sp.length]);
      },
    },
    eyes: { y: 0.5 },
    mouth: { y: 0.64 },
    limbs: { color: '#6ec8b2', tip: '#ffe28a' },
  },
  chipper: {
    id: 'chipper',
    body: { shape: 'tri', w: 40, h: 36, color: '#f2b63e', shade: '#cf8a26', pattern: speckle('#d98f2a', 9, 8) },
    eyes: { y: 0.55 },
    mouth: { y: 0.68, w: 14 },
    limbs: { color: '#e0453a', tip: '#ffe28a' },
  },
  fizzy: {
    id: 'fizzy',
    body: {
      shape: 'round',
      w: 36,
      h: 36,
      color: '#9fe3ff',
      shade: '#68bde8',
      light: '#ffffff',
      pattern: (b, m) => {
        b.paint(ellipse(m.w, m.h, m.w * 0.72, m.h * 0.3, 2, 2).intersect(m), '#ffffff');
      },
    },
    limbs: { color: '#ff7aa8', tip: '#ffffff' },
    top: { kind: 'antenna', color: '#ffffff', color2: '#9fe3ff' },
    mouth: { style: 'open' },
  },
  pearl: {
    id: 'pearl',
    body: { shape: 'round', w: 34, h: 34, color: '#54342a', shade: '#38211b', light: '#a07a6a' },
    eyes: { color: '#1a0f0c' },
    top: { kind: 'straw', color: '#ff8fb1' },
    limbs: { color: '#e0b27a', tip: '#fff4dc' },
    mouth: { style: 'grin' },
    blush: '#ff9ab0',
  },
  volty: {
    id: 'volty',
    body: { shape: 'bolt', w: 34, h: 42, color: '#ffd23f', shade: '#e3a615' },
    eyes: { y: 0.44, gap: 12, r: 1.8 },
    mouth: { y: 0.55, w: 10, style: 'grin' },
    blush: null,
    limbs: { color: '#3a3f5c', tip: '#7df0ff' },
  },
  oni: {
    id: 'oni',
    body: {
      shape: 'tri',
      w: 40,
      h: 38,
      color: '#fbfaff',
      shade: '#d9d6e6',
      pattern: (b, m) => {
        // nori belt with a glossy top edge, and a dab of filling peeking out on top
        b.paint(rect(m.w, m.h, m.w * 0.28, m.h * 0.76, m.w * 0.44, m.h).intersect(m), '#233a2c');
        b.paint(rect(m.w, m.h, m.w * 0.28 + 1, m.h * 0.76, m.w * 0.44 - 2, 0.6).intersect(m), '#3f5f48');
        b.paint(ellipse(m.w, m.h, m.w / 2, m.h * 0.2, 2.6, 1.8).intersect(m.erode()), '#ff9470');
      },
    },
    eyes: { y: 0.47 },
    mouth: { y: 0.56, w: 12 },
    limbs: { color: '#4f9a4a', tip: '#ffe7a0' },
    blush: '#ffb0b8',
  },
  bean: {
    id: 'bean',
    body: {
      shape: 'bean',
      w: 34,
      h: 40,
      color: '#8a5634',
      shade: '#643a22',
      pattern: (b, m) => {
        const c = hex('#5a321d');
        for (let y = Math.round(m.h * 0.72); y < m.h - 3; y++) b.set(Math.round(m.w / 2 + Math.sin(y * 0.5) * 1.5), y, c);
      },
    },
    top: { kind: 'swirl', color: '#fff4dc' },
    limbs: { color: '#fff4dc', tip: '#c98d5a' },
    mouth: { style: 'grin' },
    blush: '#ff9ab0',
  },
  cubey: {
    id: 'cubey',
    body: {
      shape: 'squircle',
      w: 36,
      h: 34,
      color: '#c4ecff',
      shade: '#8fcdf0',
      light: '#ffffff',
      pattern: (b, m) => {
        b.paint(rect(m.w, m.h, 5, 5, 2, 6).intersect(m), '#ffffff');
        b.paint(rect(m.w, m.h, 8, 5, 3, 2).intersect(m), '#ffffff');
      },
    },
    limbs: { color: '#7fb8e6', tip: '#ffffff' },
    mouth: { style: 'grin' },
    blush: '#ffb0d0',
  },
  lucky: {
    id: 'lucky',
    body: {
      shape: 'round',
      w: 36,
      h: 36,
      color: '#f6c945',
      shade: '#d39b1f',
      pattern: (b, m) => {
        const c = hex('#e3ab2a');
        for (let y = 0; y < m.h; y++)
          for (let x = 0; x < m.w; x++) {
            const d = Math.hypot(x + 0.5 - m.w / 2, y + 0.5 - m.h / 2);
            if (m.get(x, y) && Math.abs(d - (m.w / 2 - 5)) < 0.6) b.set(x, y, c);
          }
      },
    },
    top: { kind: 'sprout', color: '#3f8f45', color2: '#5fbf5a' },
    limbs: { color: '#3f8f45', tip: '#ffffff' },
    mouth: { style: 'grin' },
    blush: '#ff9ab0',
  },
  capsu: {
    id: 'capsu',
    body: {
      shape: 'round',
      w: 36,
      h: 36,
      color: '#ffffff',
      shade: '#d9dbe6',
      pattern: (b, m) => {
        b.paint(rect(m.w, m.h, 0, 0, m.w, m.h * 0.46).intersect(m), '#ff5d73');
        b.paint(rect(m.w, m.h, 0, m.h * 0.44, m.w, 1.4).intersect(m), '#c43a55');
      },
    },
    eyes: { y: 0.31 },
    mouth: { y: 0.58 },
    blush: '#ffb0b8',
    limbs: { color: '#8a5cff', tip: '#ffe28a' },
  },
  snappy: {
    id: 'snappy',
    body: {
      shape: 'box',
      w: 34,
      h: 38,
      color: '#fbfaf5',
      shade: '#dcd7c9',
      pattern: (b, m) => {
        b.paint(rect(m.w, m.h, 4, 4, m.w - 8, m.h * 0.64).intersect(m), '#9fd8ff');
        b.paint(rect(m.w, m.h, 4, 4 + m.h * 0.45, m.w - 8, m.h * 0.19).intersect(m), '#8fd18a');
      },
    },
    eyes: { y: 0.34 },
    mouth: { y: 0.46, w: 12 },
    blush: '#ffb0b8',
    limbs: { color: '#f28a5a', tip: '#fff4dc' },
  },
  tapey: {
    id: 'tapey',
    body: {
      shape: 'box',
      w: 44,
      h: 30,
      color: '#474a66',
      shade: '#33354d',
      pattern: (b, m) => {
        b.paint(rect(m.w, m.h, 4, 3, m.w - 8, m.h * 0.6).intersect(m), '#ffe8b8');
        b.paint(rect(m.w, m.h, 4, 3 + m.h * 0.54, m.w - 8, 1.5).intersect(m), '#ff7a8a');
        // two little reel windows under the label
        for (const x of [0.3, 0.7]) {
          b.paint(ellipse(m.w, m.h, m.w * x, m.h * 0.84, 3.2, 2.4).intersect(m), '#fff4e0');
          b.paint(ellipse(m.w, m.h, m.w * x, m.h * 0.84, 1.5, 1.1).intersect(m), '#33354d');
        }
      },
    },
    eyes: { y: 0.27, gap: 16 },
    mouth: { y: 0.39, w: 12 },
    blush: '#ffb0b8',
    limbs: { color: '#ff7a8a', tip: '#ffe8b8', arm: 11, leg: 8 },
  },
  goldie: {
    id: 'goldie',
    body: { shape: 'star', w: 44, h: 42, color: '#ffd23f', shade: '#e9a51c', light: '#fff6c4' },
    eyes: { y: 0.52, gap: 12, r: 1.8 },
    mouth: { y: 0.63, w: 10 },
    top: { kind: 'crown' },
    limbs: { color: '#f08a2c', tip: '#fff6c4', arm: 10, leg: 8 },
    blush: '#ffa0a0',
  },
};

export const SHOPPERS = ['apple', 'eggy', 'milko', 'berry', 'avo', 'bao', 'pudding'];
