import { Bitmap, hex } from './pixel';

/**
 * Hand-drawn pixel icons (no emojis anywhere). Rows of palette characters; '.' is transparent.
 * Used for the few DOM buttons and inside the package sticker.
 */

const PAL: Record<string, string> = {
  '#': '#2a1c22',
  w: '#ffffff',
  c: '#fff3d6',
  p: '#f47c9f',
  P: '#d95a82',
  g: '#5aa05f',
  G: '#3d6b40',
  y: '#f6c945',
  Y: '#d49a1c',
  b: '#6fb7e8',
  B: '#3f86c4',
  r: '#e0394a',
  k: '#9aa3b4',
  K: '#5f6878',
  o: '#f59a3c',
};

export const ICONS = {
  back: [
    '............',
    '.....#......',
    '....#w#.....',
    '...#ww######',
    '..#wwwwwwww#',
    '.#wwwwwwwww#',
    '..#wwwwwwww#',
    '...#ww######',
    '....#w#.....',
    '.....#......',
    '............',
    '............',
  ],
  soundOn: [
    '............',
    '.....##.....',
    '....#w#..#..',
    '.###ww#...#.',
    '.#wwww#.#.#.',
    '.#wwww#.#.#.',
    '.#wwww#.#.#.',
    '.###ww#...#.',
    '....#w#..#..',
    '.....##.....',
    '............',
    '............',
  ],
  soundOff: [
    '............',
    '.....##.....',
    '....#w#.....',
    '.###ww#.#..#',
    '.#wwww#..##.',
    '.#wwww#..##.',
    '.#wwww#.#..#',
    '.###ww#.....',
    '....#w#.....',
    '.....##.....',
    '............',
    '............',
  ],
  link: [
    '............',
    '.......###..',
    '......#bbb#.',
    '.....#b##b#.',
    '....#b#.#b#.',
    '...#b#.#b#..',
    '..#b#.#b#...',
    '.#b#.#b#....',
    '.#b##b#.....',
    '.#bbb#......',
    '..###.......',
    '............',
  ],
  text: [
    '............',
    '.##########.',
    '.#wwwwwwww#.',
    '.####ww####.',
    '....#ww#....',
    '....#ww#....',
    '....#ww#....',
    '....#ww#....',
    '....#ww#....',
    '....####....',
    '............',
    '............',
  ],
  wifi: [
    '............',
    '...######...',
    '.##bbbbbb##.',
    '#bb######bb#',
    '.##.####.##.',
    '...#bbbb#...',
    '..#b####b#..',
    '...#....#...',
    '.....##.....',
    '....#bb#....',
    '.....##.....',
    '............',
  ],
  contact: [
    '............',
    '....####....',
    '...#pppp#...',
    '...#pppp#...',
    '...#pppp#...',
    '....####....',
    '..########..',
    '.#pppppppp#.',
    '.#pppppppp#.',
    '.##########.',
    '............',
    '............',
  ],
  photo: [
    '............',
    '....####....',
    '.###kkkk###.',
    '#kkkk##kkkk#',
    '#kkk#ww#kkk#',
    '#kk#wbbw#kk#',
    '#kk#wbbw#kk#',
    '#kkk#ww#kkk#',
    '#kkkk##kkkk#',
    '.##########.',
    '............',
    '............',
  ],
  video: [
    '............',
    '.##########.',
    '#K#K#K#K#K##',
    '#kkkkkkkkkk#',
    '#kkk#kkkkkk#',
    '#kkk#w#kkkk#',
    '#kkk#ww#kkk#',
    '#kkk#w#kkkk#',
    '#kkk#kkkkkk#',
    '#K#K#K#K#K##',
    '.##########.',
    '............',
  ],
  paste: [
    '....####....',
    '.###kkkk###.',
    '.#cc####cc#.',
    '.#cccccccc#.',
    '.#c######c#.',
    '.#cccccccc#.',
    '.#c#####cc#.',
    '.#cccccccc#.',
    '.#c######c#.',
    '.#cccccccc#.',
    '.##########.',
    '............',
  ],
  lock: [
    '............',
    '....####....',
    '...#kkkk#...',
    '..#k#..#k#..',
    '..#k#..#k#..',
    '.##########.',
    '.#yyyyyyyy#.',
    '.#yyyy#yyy#.',
    '.#yyy##yyy#.',
    '.#YYYYYYYY#.',
    '.##########.',
    '............',
  ],
  check: [
    '............',
    '..........#.',
    '.........#g#',
    '........#gg#',
    '.#.....#gg#.',
    '#g#...#gg#..',
    '#gg#.#gg#...',
    '.#gg#gg#....',
    '..#ggg#.....',
    '...#g#......',
    '....#.......',
    '............',
  ],
  close: [
    '............',
    '.##......##.',
    '#ww#....#ww#',
    '.#ww#..#ww#.',
    '..#ww##ww#..',
    '...#wwww#...',
    '...#wwww#...',
    '..#ww##ww#..',
    '.#ww#..#ww#.',
    '#ww#....#ww#',
    '.##......##.',
    '............',
  ],
  download: [
    '............',
    '....####....',
    '....#ww#....',
    '....#ww#....',
    '..###ww###..',
    '..#wwwwww#..',
    '...#wwww#...',
    '....#ww#....',
    '.#...##...#.',
    '.#w######w#.',
    '.##########.',
    '............',
  ],
  scan: [
    '............',
    '.####..####.',
    '.#ww#..#ww#.',
    '.#w#....#w#.',
    '.##..##..##.',
    '....#ww#....',
    '....#ww#....',
    '.##..##..##.',
    '.#w#....#w#.',
    '.#ww#..#ww#.',
    '.####..####.',
    '............',
  ],
  replay: [
    '............',
    '....####.#..',
    '..##wwww##..',
    '.#ww####w#..',
    '.#w#..#www#.',
    '#w#....####.',
    '#w#.........',
    '#w#.....#w#.',
    '.#w#...#w#..',
    '.#ww###ww#..',
    '..##www##...',
    '....###.....',
  ],
  star: [
    '............',
    '.....##.....',
    '....#yy#....',
    '....#yy#....',
    '.####yy####.',
    '#yyyyyyyyyy#',
    '.#yyyyyyyy#.',
    '..#yyyyyy#..',
    '..#yy##yy#..',
    '.#yy#..#yy#.',
    '.###....###.',
    '............',
  ],
  play: [
    '............',
    '..##........',
    '..#w##......',
    '..#www##....',
    '..#wwwww##..',
    '..#wwwwwww#.',
    '..#wwwww##..',
    '..#www##....',
    '..#w##......',
    '..##........',
    '............',
    '............',
  ],
  card: [
    '............',
    '............',
    '.##########.',
    '#pppppppppp#',
    '#pwwpppppyp#',
    '#pwwpppppyp#',
    '#pppppppppp#',
    '#pp######pp#',
    '#pppppppppp#',
    '.##########.',
    '............',
    '............',
  ],
  heart: [
    '............',
    '..###..###..',
    '.#ppp##ppp#.',
    '#pwppppppPp#',
    '#pwpppppppP#',
    '#ppppppppPP#',
    '.#pppppPPP#.',
    '..#pppPPP#..',
    '...#pPPP#...',
    '....#PP#....',
    '.....##.....',
    '............',
  ],
  sparkle: [
    '.....#......',
    '....#w#.....',
    '....#w#.....',
    '...#www#....',
    '.##wwwww##..',
    '#wwwwwwwww#.',
    '.##wwwww##..',
    '...#www#....',
    '....#w#.....',
    '....#w#.....',
    '.....#......',
    '............',
  ],
  hand: [
    '....##..........',
    '...#ww#.........',
    '...#ww#.........',
    '...#ww###.......',
    '...#ww#ww##.....',
    '...#ww#ww#w##...',
    '.###ww#ww#w#w#..',
    '#ww#wwwwwwwwww#.',
    '#www#wwwwwwwww#.',
    '.#wwwwwwwwwwww#.',
    '..#wwwwwwwwwww#.',
    '...#wwwwwwwww#..',
    '....#wwwwwwww#..',
    '.....#######....',
    '................',
    '................',
  ],
  bubble: [
    '............',
    '....####....',
    '..##bbbb##..',
    '.#bwwbbbbb#.',
    '.#bwbbbbbb#.',
    '#bbbbbbbbbb#',
    '#bbbbbbbbbb#',
    '#bbbbbbbbBb#',
    '.#bbbbbbBb#.',
    '.#bbbbBBBb#.',
    '..##bbbb##..',
    '....####....',
  ],
  music: [
    '............',
    '......####..',
    '......#ww#..',
    '......#w##..',
    '......#w#...',
    '......#w#...',
    '...####w#...',
    '..#wwwww#...',
    '..#wwww#....',
    '...####.....',
    '............',
    '............',
  ],
} satisfies Record<string, string[]>;

export type IconName = keyof typeof ICONS;

/** Render an icon to a bitmap, optionally recolouring the white fill. */
export function iconBitmap(name: IconName, o: { fill?: string; ink?: string } = {}): Bitmap {
  const rows = ICONS[name];
  const b = new Bitmap(rows[0].length, rows.length);
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      let col = PAL[ch];
      if (ch === 'w' && o.fill) col = o.fill;
      if (ch === '#' && o.ink) col = o.ink;
      if (col) b.set(x, y, hex(col));
    }
  return b;
}

const urlCache = new Map<string, string>();

/** Data URL of an icon scaled up with crisp pixels (for DOM <img>/CSS). */
export function iconURL(name: IconName, scale = 3, o: { fill?: string; ink?: string } = {}) {
  const key = `${name}|${scale}|${o.fill ?? ''}|${o.ink ?? ''}`;
  const hit = urlCache.get(key);
  if (hit) return hit;
  const src = iconBitmap(name, o).toCanvas();
  const c = document.createElement('canvas');
  c.width = src.width * scale;
  c.height = src.height * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/png');
  urlCache.set(key, url);
  return url;
}

/** An <img> element for an icon. */
export function iconImg(name: IconName, scale = 3, o: { fill?: string; ink?: string; alt?: string } = {}) {
  const img = document.createElement('img');
  img.src = iconURL(name, scale, o);
  img.alt = o.alt ?? '';
  img.className = 'px-icon';
  img.draggable = false;
  return img;
}
