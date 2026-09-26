import { Chef, mat } from './chef';

/** Non-food pixel sprites for decoration: potted plants and friends. */

/** A leafy plant in a round pink pot. */
export function plantSprite(seed = 1): HTMLCanvasElement {
  const c = new Chef(40, 56, seed);
  // leaves: a fan of rounded blades, back to front
  const blades: [number, number, number, number, number][] = [
    [20, 28, 6, 22, -0.6],
    [20, 28, 34, 20, 0.6],
    [20, 28, 12, 8, -0.3],
    [20, 28, 29, 7, 0.3],
    [20, 28, 20, 3, 0],
    [20, 30, 4, 32, -0.9],
    [20, 30, 36, 31, 0.9],
  ];
  for (const [x0, y0, x1, y1] of blades) {
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const nx = -(y1 - y0) * 0.22;
    const ny = (x1 - x0) * 0.22;
    const leaf = c.blob([
      [x0, y0],
      [mx + nx, my + ny],
      [x1, y1],
      [mx - nx, my - ny],
    ], 6);
    c.layer(leaf, mat('green'), { form: 'soft', bevel: 2, rim: true });
    c.line(x0, y0, x1 + (x0 - x1) * 0.15, y1 + (y0 - y1) * 0.15, '#2b6b37', leaf);
  }
  // pot
  const pot = c.poly([
    [9, 36],
    [31, 36],
    [28, 54],
    [12, 54],
  ]);
  c.layer(pot, mat('pink'), { form: 'cylY' });
  c.layer(c.roundRect(7, 33, 26, 5, 2), mat('pink'), { form: 'soft', bevel: 2, bias: 0.05 });
  c.layer(c.ellipse(20, 34.5, 11, 1.6), mat('brown'), { form: 'none' });
  c.shine(12, 42, 3);
  return c.done();
}

/** A small round cactus in a mint pot, with a pink flower. */
export function cactusSprite(seed = 3): HTMLCanvasElement {
  const c = new Chef(28, 40, seed);
  c.layer(c.roundRect(8, 6, 12, 22, 6), mat('matcha'), { form: 'cylY', rim: true });
  c.layer(c.capsule(6, 18, 4, 11, 2.2), mat('matcha'), { rim: true });
  c.layer(c.capsule(22, 16, 24, 9, 2.2), mat('matcha'), { rim: true });
  c.scatter(c.roundRect(9, 8, 10, 18, 5), { count: 8, colors: ['#fff7d6'], kind: 'dot', seed: 5 });
  c.layer(c.circle(14, 5, 2.6), mat('pink'));
  c.layer(c.poly([
    [6, 26],
    [22, 26],
    [20, 38],
    [8, 38],
  ]), mat('mint'), { form: 'cylY' });
  c.layer(c.roundRect(5, 24, 18, 4, 1.5), mat('mint'), { form: 'soft', bevel: 1, bias: 0.05 });
  return c.done();
}
