import { drawLogo } from '../brand';
import { Bitmap, hex, mixRGB, type RGB } from '../pixel';
import {
  BELLY,
  BLUE,
  BLUSH,
  GILL,
  HAZ_BLUE,
  INK,
  LENS,
  LENS_GLOW,
  METAL,
  MOUTH,
  MOUTH_DARK,
  RED,
  SKIN,
  STEEL,
  T,
  TONGUE,
  TONGUE_LIGHT,
  TOOTH,
  WHITE,
  Part,
  crop,
  qb,
  smooth,
  type Cut,
  type Pt,
} from './draw';

/**
 * The store clerk's sprite parts: a pink axolotl piloting a chunky blue shark mech with red fins,
 * a steel drill nose and a big red claw. Everything is drawn in one composition canvas (CW × CH
 * px, 64 px per world unit) in its rest pose; the rig turns each cut into a mesh pivoting at
 * the listed joint.
 */

export const CW = 164;
export const CH = 136;
/** Canvas row of the floor and column of the clerk's centre. */
export const FLOOR = 128;
export const MIDX = 80;

/** Joint positions in canvas pixels (rest pose). */
export const PIV = {
  mech: [78, 90] as Pt,
  tail: [30, 61] as Pt,
  dorsal: [56, 46] as Pt,
  exhaustA: [47, 49] as Pt,
  exhaustB: [39, 55] as Pt,
  hatch: [71, 37] as Pt,
  pilot: [84, 44] as Pt,
  jaw: [98, 52] as Pt,
  finNear: [75, 76] as Pt,
  legNear: [87, 83] as Pt,
  legFar: [67, 85] as Pt,
  drill: [122, 45] as Pt,
  chain: [123.5, 53] as Pt,
  shoulder: [89, 61] as Pt,
  eyes: [84, 25.5] as Pt,
  mouth: [84, 28.6] as Pt,
  armL: [77.5, 37.5] as Pt,
  armR: [90.5, 37.5] as Pt,
  antenna: [117.5, 42] as Pt,
};

/** Rest angles of the arm chain (degrees, clockwise on screen) and bone lengths (px). */
export const ARM = {
  upper: 86,
  fore: -8,
  claw: -12,
  upperLen: 11,
  foreLen: 23,
  knuckles: [
    [13.5, -5.6],
    [14.5, 0],
    [13.5, 5.6],
  ] as Pt[],
  thumb: [9.5, -7] as Pt,
};

/** Centre of the mech's round eye lens (canvas px). */
export const MECH_EYE: Pt = [113, 43.5];

/** Thumb root angle relative to the claw axis (degrees, negative = up). */
export const THUMB_DEG = 26;

/** Drill axis (degrees) and chain link length. */
export const DRILL_DEG = -6;
export const DRILL_LEN = 22;
export const CHAIN_LINK = 5;

/** Gill fronds: base (canvas px), rest angle (deg), length. Right side; left is mirrored. */
export const GILLS: { base: Pt; deg: number; len: number }[] = [
  { base: [96, 18], deg: -52, len: 13 },
  { base: [99, 23.5], deg: -14, len: 14.5 },
  { base: [98, 29.5], deg: 24, len: 12 },
];

export type EyeStyle = 'dot' | 'blink' | 'happy' | 'wide' | 'sleepy' | 'wink' | 'sparkle';
export type MouthStyle = 'grin' | 'open' | 'smile' | 'o' | 'yawn' | 'flat' | 'cat';
export const EYE_STYLES: EyeStyle[] = ['dot', 'blink', 'happy', 'wide', 'sleepy', 'wink', 'sparkle'];
export const MOUTH_STYLES: MouthStyle[] = ['grin', 'open', 'smile', 'o', 'yawn', 'flat', 'cat'];

export interface Sprite extends Cut {
  /** Pivot in the same canvas as ox/oy. */
  px: number;
  py: number;
}

const sp = (c: Cut, pv: Pt): Sprite => ({ ...c, px: pv[0], py: pv[1] });

/** A part painted in the composition canvas, restricted to a window (canvas px) for speed. */
const newPart = (x0: number, y0: number, x1: number, y1: number) => new Part(CW, CH, [x0, y0, x1, y1]);
const around = ([x, y]: Pt, r: number) => newPart(x - r, y - r, x + r, y + r);

// -------------------------------------------------------------------------------------------------
// mech body

const BODY_PTS: Pt[] = [
  [28, 59],
  [37, 52],
  [50, 45],
  [66, 40],
  [82, 37.5],
  [98, 37.5],
  [109, 39],
  [117, 41.5],
  [122.5, 45.5],
  [124.5, 51],
  [123, 56.5],
  [118.5, 62.5],
  [111, 69.5],
  [101, 77],
  [90, 85],
  [77, 90],
  [63, 90],
  [50, 85],
  [40, 77],
  [33, 69],
  [27, 64],
];

/** Mouth line (upper lip) y for x in the jaw span. */
export const mouthY = (x: number) => 51.8 + 2.4 * Math.sin((Math.PI * Math.max(0, Math.min(25.5, x - 98))) / 25.5) + (x - 98) * 0.08;

const BODY_POLY = smooth(BODY_PTS, 8);

function bodySilhouette(p: Part) {
  return p.polyMask(BODY_POLY);
}

function jawMask(p: Part) {
  const S = bodySilhouette(p);
  return S.intersect(p.M((x, y) => x > 98 + (y - 52) * 0.55 && y > mouthY(x) + 0.2));
}

function drawBody(): Sprite {
  const p = newPart(18, 28, 134, 100);
  const S = bodySilhouette(p);
  const belly = S.clone().intersect(p.polyMask([[140, 60], [118, 66], [100, 72], [82, 76], [62, 75], [46, 71], [32, 66], [16, 63], [16, 130], [140, 130]]));
  const top = S.clone().subtract(belly);
  // top shell: base, lower-right shade, lit back
  p.fill(top, BLUE.base);
  p.fill(p.rim(S, 4, 4).subtract(belly), BLUE.shade);
  p.fill(p.rim(S, -2, -3).subtract(p.rim(S, 4, 4)).subtract(belly), BLUE.light);
  // belly: darker underside with its own crescent
  p.fill(belly, BELLY.base);
  p.fill(p.rim(S, 4, 4).intersect(belly), BELLY.shade);
  p.fill(p.rim(S, 1, 2).intersect(belly), BELLY.deep);
  const seam = belly.clone().subtract(belly.clone().shift(0, 1));
  p.fill(seam.intersect(S.erode()), BLUE.deep);
  // highlight streaks on the back and the dome of the head
  const hl = p.M((x, y) => (x > 54 && x < 72 && y < 46) || (x > 101 && x < 113 && y < 45)).intersect(p.rim(S, -2, -3).subtract(p.rim(S, -1, -1)));
  p.fill(hl, BLUE.hi);
  p.px(117, 46, BLUE.hi);
  p.px(118, 47, BLUE.hi);

  // tail joint cuff (grey band where the fins bolt on)
  const cuff = S.clone().intersect(p.M((x) => x < 32));
  p.shade(cuff, METAL, { s: 2, l: 1 });
  p.fill(p.M((x) => x >= 31.5 && x < 32.5).intersect(S), INK);
  p.rivet(28, 61, METAL);
  p.rivet(28, 65, METAL);

  // torso / tail seam with rivets
  const seamX = (y: number) => Math.round(48 - (y - 46) * 0.08 - Math.sin(((y - 46) / 39) * Math.PI) * 3);
  for (let y = 46; y < 86; y++) {
    const x = seamX(y);
    if (p.has(S, x, y) && p.has(S, x + 1, y) && p.has(S, x - 1, y)) {
      p.px(x, y, BLUE.deep);
      p.px(x + 1, y, y < 71 ? BLUE.light : BELLY.shade);
    }
  }
  for (const y of [51, 59, 67]) p.rivet(seamX(y) + 2, y, BLUE);

  // head seam: from the collar down behind the gills to the jaw hinge
  for (let y = 43; y <= 51; y++) {
    const x = Math.round(98.5 - Math.sin(((y - 43) / 8) * Math.PI) * 1.2);
    p.px(x, y, BLUE.deep);
    p.px(x + 1, y, BLUE.light);
  }
  p.rivet(95, 47, BLUE);

  // side panel line from the shoulder back to the seam
  for (let x = 50; x < 83; x++) {
    const y = Math.round(65 + (x - 50) * 0.04 + Math.sin(((x - 50) / 33) * Math.PI) * 1.5);
    p.px(x, y, BLUE.deep);
    p.px(x, y - 1, BLUE.light);
  }
  for (const x of [54, 72]) p.rivet(x, 62, BLUE);

  // gill slits behind the eye
  for (const gx of [102, 105.5]) {
    for (let y = 42; y <= 48; y++) {
      const x = gx + Math.round(Math.sin(((y - 42) / 6) * Math.PI) * 1.2);
      p.px(x, y, INK);
      p.px(x - 1, y, BLUE.light);
    }
  }

  // store badge: the pink Xolotl Kobini axolotl on the flank
  const badge = drawLogo(11, { badge: true });
  p.blit(badge, 70, 47);
  p.fill(p.M(T.roundRect(69.5, 46.5, 12, 12, 3)).edge().subtract(p.M(T.roundRect(70.5, 47.5, 10, 10, 2.4))), BLUE.deep);
  // big X screw on the flank, small one near the tail
  p.xScrew(63, 54.5, 6.8, { deg: 30 });
  p.xScrew(39.5, 62.5, 3.6, { deg: 10 });

  // mech eye: round lens with a metal bezel
  const [ex, ey] = MECH_EYE;
  const bezel = p.M(T.circle(ex, ey, 4.4));
  p.shade(bezel, METAL, { s: 2, l: 1 });
  p.fill(p.M(T.circle(ex, ey, 3.2)), INK);
  p.fill(p.M(T.circle(ex, ey, 2.5)), LENS);
  p.fill(p.M(T.circle(ex + 0.8, ey + 0.8, 1.3)), mixRGB(LENS, LENS_GLOW, 0.4));
  p.px(ex - 1.5, ey - 1.5, [255, 255, 255]);
  p.px(ex - 0.5, ey - 1.5, [255, 255, 255]);
  p.px(ex - 1.5, ey - 0.5, LENS_GLOW);
  // brow plate over the eye (gives the snout some attitude)
  for (let x = 108; x <= 118; x++) p.px(x, Math.round(38.4 + (x - 108) * 0.2), BLUE.deep);

  // mouth cavity (hidden behind the jaw until it opens)
  const J = jawMask(p);
  p.fill(J, MOUTH_DARK);
  p.fill(J.clone().intersect(p.M((x, y) => y > mouthY(x) + 3)), hex('#56182a'));
  p.fill(J.clone().intersect(p.M(T.ellipse(112, 62, 9, 4))), TONGUE);
  p.fill(J.clone().intersect(p.M(T.ellipse(110, 60.8, 5, 1.2))), TONGUE_LIGHT);
  // upper teeth hanging from the lip
  for (let x = 101; x < 122; x += 4) {
    const y0 = mouthY(x + 1) + 0.5;
    p.fill(J.clone().intersect(p.polyMask([[x, y0], [x + 3, y0], [x + 1.5, y0 + 3.2]])), TOOTH);
  }
  // upper lip ink line
  for (let x = 98; x <= 125; x++) {
    const y = Math.floor(mouthY(x + 0.5));
    if (p.has(S, x, y)) p.px(x, y, INK);
  }

  // cockpit collar (back half) and the hole
  const cx = PIV.pilot[0];
  const ring = p.M(T.ellipse(cx, 40, 16.5, 6.6));
  p.shade(ring, METAL, { s: 2, l: 1 });
  p.fill(p.M(T.ellipse(cx, 40.2, 13.6, 4.9)), INK);
  const hole = p.M(T.ellipse(cx, 40.5, 12.8, 4.2));
  p.fill(hole, hex('#1c2530'));
  p.fill(hole.clone().intersect(p.M((_x, y) => y < 38.6)), hex('#34495c'));
  for (const [rx, ry] of [[cx - 14, 38], [cx - 6, 34.5], [cx + 6, 34.5], [cx + 14, 38]] as Pt[]) p.rivet(rx, ry, METAL);

  return sp(p.cut(), PIV.mech);
}

function drawJaw(): Sprite {
  const p = newPart(92, 46, 132, 84);
  const J = jawMask(p);
  p.shade(J, BLUE, { s: 3, l: 0 });
  // underside of the chin continues the dark belly
  const chin = J.clone().intersect(p.M((x, y) => y > 64 - (x - 98) * 0.12));
  p.fill(chin, BELLY.base);
  p.fill(p.rim(J, 2, 2).intersect(chin), BELLY.deep);
  // lower teeth band
  for (let x = 100; x < 122; x += 4) {
    const y0 = mouthY(x + 2) + 1;
    p.fill(J.clone().intersect(p.polyMask([[x, y0 + 3.4], [x + 3.2, y0 + 3.4], [x + 1.6, y0 + 0.4]])), TOOTH);
  }
  p.rivet(103, 61, BLUE);
  return sp(p.cut(), PIV.jaw);
}

function drawRim(): Sprite {
  const p = newPart(62, 30, 106, 52);
  const cx = PIV.pilot[0];
  const ring = p.M(T.ellipse(cx, 40, 16.5, 6.6)).intersect(p.M((_x, y) => y > 40.6));
  ring.subtract(p.M(T.ellipse(cx, 40.2, 13.6, 4.9)));
  p.shade(ring, METAL, { s: 2, l: 0 });
  p.fill(p.rim(ring, 0, -1), METAL.light);
  p.px(cx - 8, 44.5, METAL.hi);
  p.px(cx - 7, 44.5, METAL.hi);
  for (const rx of [cx - 10, cx, cx + 10]) p.rivet(rx, rx === cx ? 45 : 44, METAL);
  return sp(p.cut(), PIV.mech);
}

/** Tiny red valve / antenna nub on top of the head (it wobbles). */
function drawAntenna(): Sprite {
  const p = around(PIV.antenna, 14);
  const [ax, ay] = PIV.antenna;
  const base = p.M(T.roundRect(ax - 3, ay - 1.5, 6, 3.5, 1.2));
  p.shade(base, METAL, { s: 1, l: 1 });
  const stem = p.M(T.rect(ax - 0.8, ay - 6.5, 1.6, 5.5));
  p.fill(stem, METAL.light);
  p.fill(stem.clone().intersect(p.M((x) => x > ax)), METAL.shade);
  const knob = p.M(T.circle(ax, ay - 8, 2.5));
  p.shade(knob, RED, { s: 1, l: 1 });
  p.px(ax - 1, ay - 9, RED.hi);
  return sp(p.cut(), PIV.antenna);
}

function drawHatch(): Sprite {
  const p = newPart(42, 6, 82, 46);
  const hx = 61.5;
  const hy = 26;
  const tilt = -24;
  const disc = p.M(T.rotEllipse(hx, hy, 9.6, 12.4, tilt));
  p.shade(disc, METAL, { s: 2, l: 1 });
  p.fill(p.M(T.rotEllipse(hx, hy, 7.6, 10.2, tilt)).edge(), INK);
  const face = p.M(T.rotEllipse(hx, hy, 6.6, 9.2, tilt));
  p.shade(face, BLUE, { s: 3, l: 1 });
  p.fill(p.M(T.rotEllipse(hx, hy, 4.2, 6.2, tilt)).edge(), BLUE.shade);
  const a = (tilt * Math.PI) / 180;
  for (const [dx, dy] of [[0, -10.8], [0, 10.8], [-8.5, 0], [8.5, 0]] as Pt[]) {
    p.rivet(hx + dx * Math.cos(a) - dy * Math.sin(a) - 0.5, hy + dx * Math.sin(a) + dy * Math.cos(a) - 0.5, METAL);
  }
  // red valve wheel handle
  const wheel = p.M(T.circle(hx, hy, 3.2));
  p.shade(wheel, RED, { s: 1, l: 1 });
  p.line(hx - 2.5, hy - 0.5, hx + 2.5, hy - 0.5, RED.deep);
  p.line(hx - 0.5, hy - 2.5, hx - 0.5, hy + 2.5, RED.deep);
  p.px(hx - 0.5, hy - 0.5, METAL.light);
  // hinge arm down to the collar
  const arm = p.polyMask([[64, 35], [67, 33], [73, 36.5], [71.5, 39.5]]);
  p.shade(arm, METAL, { s: 1, l: 1 });
  return sp(p.cut(), PIV.hatch);
}

function drawDorsal(): Sprite {
  const p = newPart(34, 3, 76, 56);
  const pts: Pt[] = [...qb([68, 47], [62, 21], [42, 9]), ...qb([42, 9], [48, 29], [45, 49]).slice(1)];
  const fin = p.polyMask(pts);
  p.shade(fin, RED, { s: 4, l: 1 });
  const lead = p.rim(fin, -2, -1).subtract(p.rim(fin, -1, 0)).intersect(p.M((x, y) => y > 13 && y < 36 && x > 46));
  p.fill(lead, RED.hi);
  for (const [x, y] of qb([59, 44], [56, 25], [46, 15], 18)) p.px(x, y, RED.shade);
  // metal base plate
  const plate = fin.clone().intersect(p.M((_x, y) => y > 41));
  p.shade(plate, METAL, { s: 2, l: 0 });
  p.fill(p.M((_x, y) => y > 40.5 && y < 41.6).intersect(fin), INK);
  p.rivet(51, 43, METAL);
  p.rivet(59, 43, METAL);
  return sp(p.cut(), PIV.dorsal);
}

function drawTailUpper(): Sprite {
  const p = newPart(2, 18, 42, 72);
  const pts: Pt[] = [...qb([35, 56], [25, 43], [10, 26]), ...qb([10, 26], [18, 45], [23, 62]).slice(1), [32, 64]];
  const fin = p.polyMask(pts);
  p.shade(fin, RED, { s: 3, l: 1 });
  const lead = p.rim(fin, -1, -2).subtract(p.rim(fin, 0, -1)).intersect(p.M((x, y) => x > 12 && x < 30 && y < 50));
  p.fill(lead, RED.hi);
  for (const [x, y] of qb([30, 58], [23, 46], [14, 33], 14)) p.px(x, y, RED.shade);
  return sp(p.cut(), PIV.tail);
}

function drawTailLower(): Sprite {
  const p = newPart(6, 54, 44, 94);
  const pts: Pt[] = [...qb([32, 62], [25, 71], [14, 83]), ...qb([14, 83], [25, 79], [35, 68]).slice(1)];
  const fin = p.polyMask(pts);
  p.shade(fin, RED, { s: 3, l: 1 });
  p.fill(p.rim(fin, -1, -1).intersect(p.M((x) => x > 17 && x < 27)), RED.hi);
  return sp(p.cut(), PIV.tail);
}

/** Stubby exhaust cannon; axis from the base toward `deg`. Returns the sprite and its mouth point. */
function drawExhaust(base: Pt, deg: number, len: number, r: number): { s: Sprite; mouth: Pt } {
  const p = around(base, 24);
  p.frame(base[0], base[1], deg);
  const tube = p.M(T.rect(-4, -r, len + 4, r * 2));
  const up = deg < -90 || deg > 90 ? 1 : -1; // which local side faces the sky
  p.fill(tube, METAL.base);
  p.fill(tube.clone().intersect(p.M((_x, y) => y * up > r * 0.35)), METAL.light);
  p.fill(tube.clone().intersect(p.M((_x, y) => y * up > r * 0.65)), METAL.hi);
  p.fill(tube.clone().intersect(p.M((_x, y) => y * up < -r * 0.35)), METAL.shade);
  p.fill(tube.clone().intersect(p.M((_x, y) => y * up < -r * 0.75)), METAL.deep);
  // collar ring near the mouth
  const lip = p.M(T.rect(len - 3, -r - 1, 3, r * 2 + 2));
  p.fill(lip, METAL.shade);
  p.fill(lip.clone().intersect(p.M((_x, y) => y * up > 0)), METAL.base);
  p.fill(lip.clone().intersect(p.M((_x, y) => y * up > r * 0.6)), METAL.light);
  // opening: ellipse seen at an angle, dark hole
  p.fill(p.M(T.ellipse(len, 0, 2.2, r + 1)), METAL.light);
  p.fill(p.M(T.ellipse(len + 0.2, 0, 1.4, r - 0.6)), INK);
  p.fill(p.M(T.ellipse(len + 0.6, 0, 0.8, r - 1.6)), hex('#0d1116'));
  const mouth = p.at(len + 1.5, 0);
  p.frame();
  return { s: sp(p.cut(), base), mouth };
}

function drawFinNear(): Sprite {
  const p = newPart(44, 62, 90, 100);
  const pts: Pt[] = [...qb([80, 73], [66, 74], [53, 88]), ...qb([53, 88], [66, 83], [79, 80]).slice(1)];
  const fin = p.polyMask(pts);
  p.shade(fin, RED, { s: 2, l: 1 });
  p.fill(p.rim(fin, 0, -1).intersect(p.M((x) => x > 58 && x < 75)), RED.hi);
  for (const [x, y] of qb([75, 77], [66, 78], [58, 85], 12)) p.px(x, y, RED.shade);
  // root cap with a red button
  const cap = p.M(T.circle(77, 76.5, 4.2));
  p.shade(cap, METAL, { s: 2, l: 1 });
  const btn = p.M(T.circle(77, 76.5, 2));
  p.shade(btn, RED, { s: 1, l: 1 });
  p.px(76, 75.5, RED.hi);
  return sp(p.cut(), PIV.finNear);
}

function drawLeg(hip: Pt, far: boolean): Sprite {
  const p = newPart(hip[0] - 14, hip[1] - 10, hip[0] + 18, hip[1] + 28);
  const [hx, hy] = hip;
  const thigh = p.M(T.capsule(hx, hy, hx + 1, hy + 8, 4.6));
  p.shade(thigh, BLUE, { s: 3, l: 1 });
  const knee = p.M(T.roundRect(hx - 4.6, hy + 5, 10, 3.6, 1.5));
  p.shade(knee, METAL, { s: 1, l: 1 });
  const boot = p.M(T.roundRect(hx - 5.5, hy + 8.5, 14, 7, 3.2));
  p.shade(boot, BLUE, { s: 3, l: 1 });
  p.fill(p.M(T.rect(hx - 6, hy + 13.8, 15, 2)).intersect(boot), BELLY.base);
  for (let k = 0; k < 3; k++) {
    const x = hx + 2.6 + k * 3.1;
    const spike = p.polyMask([[x - 1.5, hy + 14], [x + 1.8, hy + 14], [x + 1.4, hy + 19]]);
    p.shade(spike, METAL, { s: 1, l: 1, deep: 0 });
  }
  p.rivet(hx - 2, hy + 11, BLUE);
  if (far) p.tint(p.painted(), BELLY.deep, 0.35);
  return sp(p.cut(), hip);
}

/** Drill cone frames: spiral grooves shifted a quarter turn per frame. */
function drawDrill(frame: number): Sprite {
  const p = newPart(108, 26, 156, 66);
  const [bx, by] = PIV.drill;
  p.frame(bx, by, DRILL_DEG);
  const L = DRILL_LEN;
  const R0 = 7.8;
  const tones = [STEEL.deep, STEEL.shade, STEEL.base, STEEL.light, STEEL.hi];
  const radius = (lx: number) => R0 * (1 - (lx - 3) / (L - 3));
  const cone = p.M((x, y) => x >= 3 && x <= L && Math.abs(y) <= radius(x) + 0.35);
  const c = Math.cos((DRILL_DEG * Math.PI) / 180);
  const s = Math.sin((DRILL_DEG * Math.PI) / 180);
  p.each(cone, (xx, yy) => {
    {
      const X = xx + 0.5 - bx;
      const Y = yy + 0.5 - by;
      const lx = X * c + Y * s;
      const ly = -X * s + Y * c;
      const v = Math.max(-1, Math.min(1, ly / Math.max(0.8, radius(lx)))); // -1 top .. 1 bottom
      let tone = v < -0.62 ? 4 : v < -0.25 ? 3 : v < 0.3 ? 2 : v < 0.72 ? 1 : 0;
      const phase = lx / 5 + Math.asin(v) * 0.55 + frame / 4;
      if (phase - Math.floor(phase) < 0.34) tone = Math.max(0, tone - 2);
      p.px(xx, yy, tones[tone]);
    }
  });
  // base collar with a red band
  const collar = p.M(T.roundRect(-3, -9, 7, 18, 2));
  p.shade(collar, METAL, { s: 2, l: 1 });
  const band = p.M(T.rect(-0.6, -9, 2.2, 18)).intersect(collar);
  p.fill(band, RED.base);
  p.fill(band.clone().intersect(p.M((_x, y) => y > 4)), RED.shade);
  p.fill(band.clone().intersect(p.M((_x, y) => y < -5)), RED.light);
  p.frame();
  return sp(p.cut(), PIV.drill);
}

function drawChainLink(k: number): Sprite {
  const p = newPart(PIV.chain[0] - 8, PIV.chain[1] - 4, PIV.chain[0] + 8, PIV.chain[1] + 20);
  const [cx, cy] = PIV.chain;
  if (k % 2 === 0) {
    const ring = p.M(T.roundRect(cx - 2.5, cy - 0.5, 5, CHAIN_LINK + 2, 2.4));
    p.shade(ring, METAL, { s: 1, l: 1 });
    p.erase(p.M(T.rect(cx - 0.6, cy + 1.5, 1.2, CHAIN_LINK - 2)));
  } else {
    const bar = p.M(T.roundRect(cx - 1.2, cy - 0.5, 2.4, CHAIN_LINK + 2, 1.2));
    p.shade(bar, METAL, { s: 1, l: 1 });
  }
  if (k === 2) {
    // little red tag at the end
    const tag = p.polyMask([[cx - 2.5, cy + CHAIN_LINK + 1], [cx + 2.5, cy + CHAIN_LINK + 1], [cx + 2.5, cy + CHAIN_LINK + 5], [cx, cy + CHAIN_LINK + 7], [cx - 2.5, cy + CHAIN_LINK + 5]]);
    p.shade(tag, RED, { s: 1, l: 1 });
    p.px(cx - 0.5, cy + CHAIN_LINK + 3, RED.deep);
  }
  return sp(p.cut(1), PIV.chain);
}

// -------------------------------------------------------------------------------------------------
// the big arm (drawn along its bones in the rest pose)

export function armJoints() {
  const r = (d: number) => (d * Math.PI) / 180;
  const S = PIV.shoulder;
  const a1 = r(ARM.upper);
  const E: Pt = [S[0] + Math.cos(a1) * ARM.upperLen, S[1] + Math.sin(a1) * ARM.upperLen];
  const fa = r(ARM.fore);
  const W: Pt = [E[0] + Math.cos(fa) * ARM.foreLen, E[1] + Math.sin(fa) * ARM.foreLen];
  return { S, E, W };
}

function drawUpperArm(): Sprite {
  const p = around(PIV.shoulder, 24);
  const { S } = armJoints();
  p.frame(S[0], S[1], ARM.upper);
  const L = ARM.upperLen;
  // accordion segments
  for (let k = 0; k < 3; k++) {
    const x0 = 1.5 + k * 4.2;
    const seg = p.M(T.roundRect(x0, -5.2, 4.4, 10.4, 1.6));
    p.fill(seg, METAL.base);
    p.fill(seg.clone().intersect(p.M((_x, y) => y < -2.2)), METAL.light);
    p.fill(seg.clone().intersect(p.M((_x, y) => y < -4)), METAL.hi);
    p.fill(seg.clone().intersect(p.M((_x, y) => y > 2)), METAL.shade);
    p.fill(seg.clone().intersect(p.M((_x, y) => y > 4)), METAL.deep);
  }
  const core = p.M(T.rect(0, -3.4, L, 6.8)).subtract(p.painted());
  p.fill(core, METAL.deep);
  p.frame();
  return sp(p.cut(), S);
}

function drawShoulderCap(): Sprite {
  const p = around(PIV.shoulder, 14);
  const [sx, sy] = PIV.shoulder;
  const cap = p.M(T.circle(sx, sy, 8.6));
  p.shade(cap, RED, { s: 2, l: 1 });
  p.fill(p.M(T.circle(sx, sy, 6.9)), INK);
  p.xScrew(sx, sy, 6, { deg: 20 });
  return sp(p.cut(), PIV.shoulder);
}

function drawForearm(): Sprite {
  const p = around(armJoints().E, 38);
  const { E } = armJoints();
  p.frame(E[0], E[1], ARM.fore);
  const L = ARM.foreLen;
  const elbow = p.M(T.circle(0, 0, 5.6));
  p.shade(elbow, METAL, { s: 2, l: 1 });
  const box = p.M(T.roundRect(1, -7.5, L - 1, 15, 3));
  p.fill(box, BLUE.base);
  p.fill(box.clone().intersect(p.M((_x, y) => y < -5)), BLUE.light);
  p.fill(box.clone().intersect(p.M((_x, y) => y > 5)), BLUE.shade);
  p.fill(box.clone().intersect(p.M((_x, y) => y > 6.4)), BLUE.deep);
  // hazard panel: diagonal white / blue stripes
  const panel = p.M(T.roundRect(4, -4.6, L - 8, 9.2, 1.5));
  const a = (ARM.fore * Math.PI) / 180;
  p.each(panel, (xx, yy) => {
    {
      const X = xx + 0.5 - E[0];
      const Y = yy + 0.5 - E[1];
      const lx = X * Math.cos(a) + Y * Math.sin(a);
      const ly = -X * Math.sin(a) + Y * Math.cos(a);
      const k = Math.floor((lx + ly) / 3.2);
      const white = ((k % 2) + 2) % 2 === 0;
      const lower = ly > 2.6;
      p.px(xx, yy, white ? (lower ? WHITE.shade : WHITE.base) : lower ? HAZ_BLUE.shade : HAZ_BLUE.base);
    }
  });
  p.fill(panel.edge(), INK);
  for (const [x, y] of [[3, -6], [L - 3, -6], [3, 5.5], [L - 3, 5.5]] as Pt[]) {
    const [cx, cy] = p.at(x, y);
    p.px(cx, cy, y < 0 ? BLUE.hi : BLUE.deep);
  }
  const cuff = p.M(T.roundRect(L - 1, -5.6, 4.5, 11.2, 1.4));
  p.fill(cuff, METAL.base);
  p.fill(cuff.clone().intersect(p.M((_x, y) => y < -2.5)), METAL.light);
  p.fill(cuff.clone().intersect(p.M((_x, y) => y > 2.5)), METAL.shade);
  p.frame();
  return sp(p.cut(), E);
}

function drawPalm(): Sprite {
  const p = around(armJoints().W, 26);
  const { W } = armJoints();
  p.frame(W[0], W[1], ARM.fore + ARM.claw);
  // back of the hand: a chunky armoured mitt
  const palm = p.M(T.roundRect(0.5, -9, 15.5, 18, 5.5));
  p.fill(palm, RED.base);
  p.fill(palm.clone().intersect(p.M((x, y) => y < -6 || x < 2.5)), RED.light);
  p.fill(palm.clone().intersect(p.M((_x, y) => y > 5.5)), RED.shade);
  p.fill(palm.clone().intersect(p.M((_x, y) => y > 7.4)), RED.deep);
  p.fill(palm.clone().intersect(p.M((x, y) => y < -7.6 && x > 4 && x < 10)), RED.hi);
  // raised knuckle plate with two bolts
  const plate = p.M(T.roundRect(4, -5.5, 8, 11, 2.5));
  p.fill(plate, RED.light);
  p.fill(plate.clone().intersect(p.M((x, y) => y > 2.5 || x > 10)), RED.base);
  p.fill(plate.edge().intersect(p.M((x, y) => y > 0 || x > 9)), RED.deep);
  for (const [x, y] of [[7, -2.8], [7, 2.2]] as Pt[]) {
    const [cx, cy] = p.at(x, y);
    p.rivet(cx, cy, METAL);
  }
  // wrist ring
  const ring = p.M(T.roundRect(-3, -6.8, 4.6, 13.6, 1.6));
  p.fill(ring, METAL.base);
  p.fill(ring.clone().intersect(p.M((_x, y) => y < -3)), METAL.light);
  p.fill(ring.clone().intersect(p.M((_x, y) => y > 3)), METAL.shade);
  p.frame();
  return sp(p.cut(), W);
}

/** Knuckle positions (canvas px) in the rest pose. */
export function knuckles() {
  const { W } = armJoints();
  const a = ((ARM.fore + ARM.claw) * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const tr = ([x, y]: Pt): Pt => [W[0] + x * c - y * s, W[1] + x * s + y * c];
  return { fingers: ARM.knuckles.map(tr), thumb: tr(ARM.thumb) };
}

/**
 * One chunky two-segment finger in a curl state (0 open, 1 relaxed, 2 fist): a rounded segment,
 * a dark joint crease, then a tip with a darker nail cap. The thumb curls the other way.
 */
function drawFinger(base: Pt, baseDeg: number, curl: number, thumb: boolean): Sprite {
  const p = around(base, 22);
  const bend1 = thumb ? [-10, 8, 34][curl] : [-6, 16, 52][curl];
  const bend2 = thumb ? [4, 22, 56][curl] : [8, 34, 70][curl];
  const L1 = thumb ? 6.5 : 6.5;
  const L2 = thumb ? 6 : 5.5;
  const r = thumb ? 2.9 : 2.75;
  const a1 = baseDeg + bend1;
  const a2 = a1 + bend2;
  const rad = (d: number) => (d * Math.PI) / 180;
  const j: Pt = [base[0] + Math.cos(rad(a1)) * L1, base[1] + Math.sin(rad(a1)) * L1];
  const tip: Pt = [j[0] + Math.cos(rad(a2)) * L2, j[1] + Math.sin(rad(a2)) * L2];
  const seg1 = p.M(T.capsule(base[0] - Math.cos(rad(a1)) * 3, base[1] - Math.sin(rad(a1)) * 3, j[0], j[1], r));
  const seg2 = p.M(T.capsule(j[0], j[1], tip[0], tip[1], r - 0.15));
  const all = seg1.clone().union(seg2);
  p.shade(all, RED, { s: 2, l: 1 });
  // nail cap on the tip
  const nail = seg2.clone().intersect(p.M((x, y) => (x - j[0]) * Math.cos(rad(a2)) + (y - j[1]) * Math.sin(rad(a2)) > L2 - 0.6));
  p.fill(nail, RED.shade);
  p.fill(p.rim(nail, 1, 1).intersect(nail), RED.deep);
  // grey metal joint band between the segments
  const ax1 = Math.cos(rad(a1));
  const ay1 = Math.sin(rad(a1));
  const ax2 = Math.cos(rad(a2));
  const ay2 = Math.sin(rad(a2));
  const bx = (ax1 + ax2) / 2;
  const by = (ay1 + ay2) / 2;
  const band = all.clone().intersect(p.M((x, y) => Math.abs((x - j[0]) * bx + (y - j[1]) * by) <= 1.05));
  p.fill(band, METAL.base);
  p.fill(band.clone().intersect(p.M((x, y) => -(x - j[0]) * by + (y - j[1]) * bx < -0.6)), METAL.light);
  p.fill(band.clone().intersect(p.M((x, y) => -(x - j[0]) * by + (y - j[1]) * bx > 1.2)), METAL.shade);
  // knuckle ring where the finger leaves the palm
  const root = seg1.clone().intersect(p.M((x, y) => {
    const u = (x - base[0]) * ax1 + (y - base[1]) * ay1;
    return u > 0.6 && u < 2.2;
  }));
  p.fill(root, METAL.shade);
  p.fill(root.clone().intersect(p.M((x, y) => -(x - base[0]) * ay1 + (y - base[1]) * ax1 < -0.5)), METAL.base);
  return sp(p.cut(), base);
}

// -------------------------------------------------------------------------------------------------
// the axolotl pilot

function drawPilotBody(): Sprite {
  const p = newPart(60, 5, 108, 54);
  const cx = PIV.pilot[0];
  const torso = p.M(T.roundRect(cx - 8, 31, 16, 16, 6.5));
  p.shade(torso, SKIN, { s: 3, l: 1 });
  p.fill(p.M(T.ellipse(cx - 0.5, 42.5, 3.6, 4)).intersect(torso), mixRGB(SKIN.base, SKIN.light, 0.6));
  const head = p.M(T.ellipse(cx, 25.2, 17.5, 11.4)).union(p.M(T.ellipse(cx, 28, 16.2, 9.6)));
  p.shade(head, SKIN, { s: 3, l: 1 });
  p.fill(p.M(T.ellipse(cx - 8, 17.4, 4.4, 1.3)).intersect(head), SKIN.hi);
  p.px(cx - 2, 16, SKIN.hi);
  p.px(cx - 1, 16, SKIN.light);
  // chin shadow onto the neck
  for (let x = cx - 6; x <= cx + 6; x++) {
    const y = 36.6 + Math.sin(((x - cx + 6) / 12) * Math.PI) * 0.7;
    if (p.has(torso, x, y + 1) && !p.has(head, x, y + 1)) p.px(x, y + 1, SKIN.shade);
  }
  // blush
  p.fill(p.M(T.ellipse(cx - 10.4, 30, 2.6, 1.3)), BLUSH);
  p.fill(p.M(T.ellipse(cx + 10.4, 30, 2.6, 1.3)), BLUSH);
  p.px(cx - 11.6, 29.4, [255, 214, 220]);
  p.px(cx + 9.2, 29.4, [255, 214, 220]);
  return sp(p.cut(), PIV.pilot);
}

function drawEyes(style: EyeStyle): Sprite {
  const p = newPart(64, 14, 104, 38);
  const [cx, cy] = PIV.eyes;
  const gap = 8.4;
  const white: RGB = [255, 255, 255];
  for (const side of [-1, 1]) {
    const x = cx + side * gap;
    const st = style === 'wink' ? (side < 0 ? 'dot' : 'happy') : style;
    if (st === 'dot' || st === 'sparkle') {
      p.fill(p.M(T.ellipse(x, cy, 2.3, 2.8)), INK);
      p.px(x - 1.3, cy - 1.6, white);
      p.px(x - 0.3, cy - 1.6, white);
      if (st === 'sparkle') {
        p.px(x - 1.3, cy - 0.6, white);
        p.px(x + 0.9, cy + 1.2, white);
      }
    } else if (st === 'blink') {
      p.fill(p.M(T.rect(x - 2.6, cy + 0.2, 5.2, 1.1)), INK);
    } else if (st === 'happy') {
      for (let k = -3; k <= 3; k++) {
        const yy = cy + Math.abs(k) * 0.8 - 0.8;
        p.px(x + k - 0.5, yy, INK);
        p.px(x + k - 0.5, yy + 1, INK);
      }
    } else if (st === 'wide') {
      p.fill(p.M(T.ellipse(x, cy, 3.3, 3.7)), INK);
      p.fill(p.M(T.ellipse(x, cy, 2.4, 2.8)), white);
      p.fill(p.M(T.ellipse(x, cy + 0.3, 1.3, 1.6)), INK);
    } else if (st === 'sleepy') {
      p.fill(p.M(T.ellipse(x, cy + 0.8, 2.4, 1.8)).intersect(p.M((_x, y) => y > cy + 0.5)), INK);
      p.fill(p.M(T.rect(x - 2.8, cy + 0.2, 5.6, 1)), INK);
    }
  }
  return sp(p.cutRaw(), PIV.eyes);
}

function drawMouth(style: MouthStyle): Sprite {
  const p = newPart(66, 20, 102, 44);
  const [cx, cy] = PIV.mouth;
  if (style === 'grin' || style === 'open') {
    const w = style === 'open' ? 7.5 : 7;
    const h = style === 'open' ? 6.8 : 5;
    const m = p.M(T.ellipse(cx, cy, w, h)).intersect(p.M((_x, y) => y >= cy));
    p.fill(m, MOUTH);
    p.fill(p.M(T.ellipse(cx + 0.5, cy + h - 0.6, w * 0.55, h * 0.45)).intersect(m), TONGUE);
    p.fill(p.M(T.ellipse(cx - 0.8, cy + h - 1.6, w * 0.22, 0.8)).intersect(m), TONGUE_LIGHT);
    p.fill(p.M(T.rect(cx - w + 1.5, cy, w * 2 - 3, 1)).intersect(m), MOUTH_DARK);
    p.b.outline(INK);
    p.px(cx - w - 1, cy - 1, INK);
    p.px(cx + w, cy - 1, INK);
  } else if (style === 'smile' || style === 'cat') {
    for (let x = -6; x <= 6; x += 0.5) {
      const t = x / 6;
      const y = style === 'cat' ? cy + 1 + Math.abs(Math.sin(t * Math.PI)) * 1.8 : cy + 0.5 + (1 - t * t) * 2.6;
      p.px(cx + x - 0.5, y, INK);
    }
    p.px(cx - 6.5, cy, INK);
    p.px(cx + 5.5, cy, INK);
  } else if (style === 'o') {
    const m = p.M(T.ellipse(cx, cy + 2.4, 2.3, 2.8));
    p.fill(m, MOUTH);
    p.fill(p.M(T.ellipse(cx, cy + 3.8, 1.3, 1)).intersect(m), TONGUE);
    p.b.outline(INK);
  } else if (style === 'yawn') {
    const m = p.M(T.ellipse(cx, cy + 3.4, 4.6, 5.2));
    p.fill(m, MOUTH);
    p.fill(p.M(T.ellipse(cx, cy + 6.4, 3, 2.2)).intersect(m), TONGUE);
    p.fill(p.M(T.ellipse(cx, cy + 0.2, 3.4, 1)).intersect(m), MOUTH_DARK);
    p.b.outline(INK);
  } else if (style === 'flat') {
    p.fill(p.M(T.rect(cx - 3, cy + 1.5, 6, 1)), INK);
  }
  return sp(p.cutRaw(), PIV.mouth);
}

/** A feathery gill frond: thin stalk with slanted plumes on both sides and a darker tip. */
function drawGill(base: Pt, deg: number, len: number): Sprite {
  const p = around(base, 22);
  p.frame(base[0], base[1], deg);
  const stalk = p.M(T.capsule(-3, 0, len - 0.5, 0, 1.45));
  const top = p.empty();
  const bot = p.empty();
  for (let x = 1.2; x < len - 1.5; x += 2.5) {
    const k = 1 - x / (len * 1.35);
    top.union(p.M(T.capsule(x, -0.8, x + 1.8, -3.6 * k, 0.75)));
    bot.union(p.M(T.capsule(x + 1.25, 0.8, x + 3, 3.3 * k, 0.75)));
  }
  const all = stalk.clone().union(top).union(bot);
  p.fill(all, GILL.base);
  p.fill(top.clone().subtract(stalk), GILL.light);
  p.fill(p.rim(stalk, 0, 1).intersect(stalk), GILL.shade);
  p.fill(p.M((x) => x > len - 4.5).intersect(all), GILL.shade);
  p.fill(p.M((x) => x > len - 2.2).intersect(all), GILL.deep);
  p.frame();
  return sp(p.cut(1), base);
}

/** Arms are a touch pinker than the torso so they separate from it. */
const ARM_SKIN = { ...SKIN, base: mixRGB(SKIN.base, SKIN.shade, 0.22), light: SKIN.base };

/** Pilot arm resting on the cockpit rim, tiny fingers gripping the edge. */
function drawPilotArm(side: -1 | 1): Sprite {
  const p = around(side < 0 ? PIV.armL : PIV.armR, 20);
  const sh = side < 0 ? PIV.armL : PIV.armR;
  const hand: Pt = [sh[0] + side * 8.6, sh[1] + 5.4];
  const arm = p.M(T.capsule(sh[0], sh[1], hand[0], hand[1], 2.1));
  p.shade(arm, ARM_SKIN, { s: 1, l: 1 });
  const palm = p.M(T.circle(hand[0], hand[1], 2.5));
  for (const k of [-1.7, 0, 1.7]) palm.union(p.M(T.circle(hand[0] + k + side * 0.3, hand[1] + 2.2, 1.05)));
  p.shade(palm, ARM_SKIN, { s: 1, l: 1 });
  p.px(hand[0] - 1.2, hand[1] + 2.4, SKIN.shade);
  p.px(hand[0] + 0.6, hand[1] + 2.4, SKIN.shade);
  return sp(p.cut(), sh);
}

/** Longer arm with an open little hand, for waving and cheering (rotated up at the shoulder). */
function drawPilotArmUp(side: -1 | 1): Sprite {
  const p = around(side < 0 ? PIV.armL : PIV.armR, 22);
  const sh = side < 0 ? PIV.armL : PIV.armR;
  const l = Math.hypot(8.6, 5.4);
  const dx = (side * 8.6) / l;
  const dy = 5.4 / l;
  const hand: Pt = [sh[0] + dx * 12, sh[1] + dy * 12];
  const arm = p.M(T.capsule(sh[0], sh[1], hand[0], hand[1], 2.1));
  p.shade(arm, ARM_SKIN, { s: 1, l: 1 });
  const palm = p.M(T.circle(hand[0], hand[1], 2.6));
  for (const k of [-2, 0, 2]) palm.union(p.M(T.circle(hand[0] + dx * 2.4 - dy * k, hand[1] + dy * 2.4 + dx * k, 1.15)));
  p.shade(palm, ARM_SKIN, { s: 1, l: 1 });
  return sp(p.cut(), sh);
}

// -------------------------------------------------------------------------------------------------
// bubbles (their own small canvases)

/** Eyelid over the mech's lens: 0 = half shut (sleepy), 1 = shut (blink). */
function drawMechLid(shut: 0 | 1): Sprite {
  const p = around(MECH_EYE, 8);
  const [ex, ey] = MECH_EYE;
  const lens = p.M(T.circle(ex, ey, 3.3));
  const lid = shut ? lens : lens.clone().intersect(p.M((_x, y) => y < ey + 0.2));
  p.fill(lid, BLUE.base);
  p.fill(lid.clone().intersect(p.M((_x, y) => y < ey - 1.6)), BLUE.light);
  // lash line along the lid's lower edge
  p.fill(lid.clone().subtract(lid.clone().shift(0, -1)), INK);
  return sp(p.cutRaw(), MECH_EYE);
}

function drawBubble(kind: 0 | 1 | 2 | 3 | 4): Cut {
  const S = 11;
  const p = new Part(S, S);
  const rim = hex('#5aa9d4');
  const ice = hex('#c8f4ff');
  const white: RGB = [255, 255, 255];
  const c = S / 2;
  if (kind === 0) {
    p.fill(p.M(T.circle(c, c, 1.6)), ice);
    p.px(c - 1, c - 1, white);
  } else if (kind === 1 || kind === 2) {
    const r = kind === 1 ? 2.6 : 3.7;
    p.fill(p.M(T.circle(c, c, r)), ice);
    p.erase(p.M(T.circle(c + 0.2, c + 0.2, r - 1.2)));
    p.px(c - r * 0.5, c - r * 0.5, white);
    p.px(c - r * 0.5 + 1, c - r * 0.5, white);
  } else if (kind === 3) {
    for (const [dx, dy] of [[0, -4], [0, 3], [-4, 0], [3, 0], [-3, -3], [2, -3], [-3, 2], [2, 2]] as Pt[]) p.px(c + dx, c + dy, Math.abs(dx) === Math.abs(dy) ? ice : white);
  } else {
    // drill spark: a tiny hot plus
    const hot = hex('#ffd460');
    const ember = hex('#ff8a3c');
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as Pt[]) p.px(c + dx, c + dy, hot);
    for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0]] as Pt[]) p.px(c + dx, c + dy, ember);
    p.px(c, c, white);
  }
  if (kind < 3) p.b.outline(rim);
  return crop(p.b);
}

// -------------------------------------------------------------------------------------------------

export interface ClerkArt {
  body: Sprite;
  jaw: Sprite;
  rim: Sprite;
  antenna: Sprite;
  hatch: Sprite;
  dorsal: Sprite;
  tailUpper: Sprite;
  tailLower: Sprite;
  exhaustA: Sprite;
  exhaustB: Sprite;
  exhaustMouths: Pt[];
  finNear: Sprite;
  legNear: Sprite;
  legFar: Sprite;
  drill: Sprite[];
  chain: Sprite[];
  upperArm: Sprite;
  shoulderCap: Sprite;
  forearm: Sprite;
  palm: Sprite;
  /** fingers[f][curl]; f = 0..2 fingers, 3 = thumb. */
  fingers: Sprite[][];
  pilot: Sprite;
  eyes: Record<EyeStyle, Sprite>;
  mouth: Record<MouthStyle, Sprite>;
  /** Right fronds then left fronds (top, middle, bottom). */
  gills: Sprite[];
  armL: Sprite;
  armR: Sprite;
  armLUp: Sprite;
  armRUp: Sprite;
  /** Bubble frames (small, medium, large, pop) and a drill spark. */
  bubbles: Cut[];
  /** Mech eyelid frames: half shut, shut. */
  lids: Sprite[];
  /** Mouth front (where the receipt comes out) and drill tip, canvas px. */
  mouthFront: Pt;
  drillTip: Pt;
}

export function buildClerkArt(): ClerkArt {
  const exA = drawExhaust(PIV.exhaustA, -130, 11, 4.4);
  const exB = drawExhaust(PIV.exhaustB, -150, 10, 3.8);
  const k = knuckles();
  const clawDeg = ARM.fore + ARM.claw;
  const fingerDeg = [clawDeg - 5, clawDeg + 1, clawDeg + 7];
  const fingers: Sprite[][] = [0, 1, 2].map((f) => [0, 1, 2].map((c) => drawFinger(k.fingers[f], fingerDeg[f], c, false)));
  fingers.push([0, 1, 2].map((c) => drawFinger(k.thumb, clawDeg - THUMB_DEG, c, true)));
  const eyes = {} as Record<EyeStyle, Sprite>;
  for (const s of EYE_STYLES) eyes[s] = drawEyes(s);
  const mouth = {} as Record<MouthStyle, Sprite>;
  for (const s of MOUTH_STYLES) mouth[s] = drawMouth(s);
  const gills: Sprite[] = [];
  for (const g of GILLS) gills.push(drawGill(g.base, g.deg, g.len));
  for (const g of GILLS) gills.push(drawGill([2 * PIV.pilot[0] - g.base[0], g.base[1]], 180 - g.deg, g.len));
  const dr = (DRILL_DEG * Math.PI) / 180;
  return {
    body: drawBody(),
    jaw: drawJaw(),
    rim: drawRim(),
    antenna: drawAntenna(),
    hatch: drawHatch(),
    dorsal: drawDorsal(),
    tailUpper: drawTailUpper(),
    tailLower: drawTailLower(),
    exhaustA: exA.s,
    exhaustB: exB.s,
    exhaustMouths: [exA.mouth, exB.mouth],
    finNear: drawFinNear(),
    legNear: drawLeg(PIV.legNear, false),
    legFar: drawLeg(PIV.legFar, true),
    drill: [0, 1, 2, 3].map(drawDrill),
    chain: [0, 1, 2].map(drawChainLink),
    upperArm: drawUpperArm(),
    shoulderCap: drawShoulderCap(),
    forearm: drawForearm(),
    palm: drawPalm(),
    fingers,
    pilot: drawPilotBody(),
    eyes,
    mouth,
    gills,
    armL: drawPilotArm(-1),
    armR: drawPilotArm(1),
    armLUp: drawPilotArmUp(-1),
    armRUp: drawPilotArmUp(1),
    bubbles: [0, 1, 2, 3, 4].map((i) => drawBubble(i as 0 | 1 | 2 | 3 | 4)),
    lids: [drawMechLid(0), drawMechLid(1)],
    mouthFront: [116, 55],
    drillTip: [PIV.drill[0] + Math.cos(dr) * DRILL_LEN, PIV.drill[1] + Math.sin(dr) * DRILL_LEN],
  };
}

/** Flat rest-pose composite (for previews, posters and UI portraits). */
export function clerkPortrait(art: ClerkArt = buildClerkArt(), o: { eyes?: EyeStyle; mouth?: MouthStyle; curl?: number } = {}): Bitmap {
  const out = new Bitmap(CW, CH);
  const put = (s: Sprite) => out.blit(s.bmp, s.ox, s.oy);
  put(art.tailLower);
  put(art.tailUpper);
  put(art.legFar);
  put(art.dorsal);
  put(art.hatch);
  put(art.exhaustB);
  put(art.exhaustA);
  put(art.body);
  put(art.antenna);
  art.gills.forEach(put);
  put(art.pilot);
  put(art.eyes[o.eyes ?? 'dot']);
  put(art.mouth[o.mouth ?? 'grin']);
  put(art.rim);
  put(art.armL);
  put(art.armR);
  put(art.jaw);
  put(art.legNear);
  put(art.finNear);
  art.chain.forEach((c, i) => out.blit(c.bmp, c.ox, c.oy + i * CHAIN_LINK));
  put(art.drill[0]);
  put(art.upperArm);
  put(art.shoulderCap);
  put(art.forearm);
  put(art.fingers[0][o.curl ?? 1]);
  put(art.fingers[1][o.curl ?? 1]);
  put(art.fingers[2][o.curl ?? 1]);
  put(art.palm);
  put(art.fingers[3][o.curl ?? 1]);
  return out;
}
