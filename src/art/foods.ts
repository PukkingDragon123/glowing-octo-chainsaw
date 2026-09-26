import { Chef, mat, INK } from './chef';

/**
 * Detailed pixel-art food sprites for the shelves. Each recipe draws one sprite (usually 32×32,
 * 3/4 top-down view, lit from the top-left, dark ink outline) with the procedural Chef.
 */

export type Aisle = 'bakery' | 'snacks' | 'candy' | 'breakfast' | 'fresh' | 'drinks' | 'frozen' | 'meals' | 'pantry';

export interface FoodDef {
  id: string;
  aisle: Aisle;
  draw: () => HTMLCanvasElement;
}

const FOODS: FoodDef[] = [];
function food(id: string, aisle: Aisle, draw: () => HTMLCanvasElement) {
  FOODS.push({ id, aisle, draw });
}

// ---- bakery

food('donut', 'bakery', () => {
  const c = new Chef(32, 32, 11);
  const hole = c.ellipse(16, 15.5, 4.2, 3.2);
  const dough = c.ellipse(16, 17, 13.5, 11).subtract(hole);
  c.layer(dough, mat('crust'));
  const icing = c.blob([
    [5, 14],
    [8, 8],
    [16, 5.5],
    [24, 8],
    [27.5, 14],
    [26, 19],
    [23, 21],
    [21, 19.5],
    [18, 22.5],
    [14, 20.5],
    [10, 22],
    [7.5, 19],
  ]).subtract(c.ellipse(16, 15.5, 5.4, 4.3));
  c.layer(icing, mat('pink'), { form: 'soft', bevel: 3, rim: true });
  c.scatter(icing, { count: 16, colors: ['#ffffff', '#ffe066', '#7fd3ff', '#8be07a', '#c89bff'], kind: 'sprinkle', margin: 1, seed: 3 });
  c.shine(9, 11, 2);
  return c.done();
});

food('croissant', 'bakery', () => {
  const c = new Chef(32, 32, 5);
  const segs: [number, number, number, number][] = [
    [6, 22, 4, 5],
    [10.5, 16, 5, 6.5],
    [16, 13, 6, 7.5],
    [21.5, 16, 5, 6.5],
    [26, 22, 4, 5],
  ];
  // back to front so the middle roll overlaps its neighbours
  for (const i of [0, 4, 1, 3, 2]) {
    const [x, y, rx, ry] = segs[i];
    c.layer(c.ellipse(x, y, rx, ry), mat('crust'), { rim: true, grain: 0.06 });
  }
  c.shine(13, 9, 2);
  c.shine(8, 14, 1);
  return c.done();
});

food('cupcake', 'bakery', () => {
  const c = new Chef(32, 32, 9);
  const wrap = c.poly([
    [8, 18],
    [24, 18],
    [22, 29.5],
    [10, 29.5],
  ]);
  c.layer(wrap, mat('pink'), { form: 'cylY' });
  for (const x of [11, 14, 17, 20]) c.line(x, 19, x - (x - 16) * 0.12, 29, '#bb4b78', wrap);
  c.layer(c.ellipse(16, 18, 9, 3.5), mat('dough'), { form: 'soft' });
  c.layer(c.ellipse(16, 16, 9.5, 4.5), mat('cream'), { form: 'soft', rim: true });
  c.layer(c.ellipse(16, 12.5, 7.5, 4), mat('cream'), { form: 'soft', rim: true });
  c.layer(c.ellipse(16, 9.5, 5, 3), mat('cream'), { form: 'soft', rim: true });
  c.layer(c.circle(17, 5.5, 3), mat('strawberry'));
  c.line(17, 2.5, 19, 0.5, '#3d8f45');
  c.shine(15, 5, 1);
  c.scatter(c.ellipse(16, 13, 9, 7), { count: 7, colors: ['#ff6d9d', '#7fd3ff', '#ffe066'], kind: 'sprinkle', seed: 4 });
  return c.done();
});

// ---- meals

food('burger', 'meals', () => {
  const c = new Chef(32, 32, 4);
  c.layer(c.roundRect(5, 22, 22, 6, 3), mat('crust'), { form: 'soft' });
  c.layer(c.roundRect(4, 18, 24, 5.5, 2.5), mat('meat'), { form: 'soft', grain: 0.3, rim: true });
  const cheese = c.poly([
    [3.5, 16.5],
    [28.5, 16.5],
    [28.5, 19],
    [25, 19],
    [23, 22.5],
    [21, 19],
    [11, 19],
    [9, 21.5],
    [7, 19],
    [3.5, 19],
  ]);
  c.layer(cheese, mat('cheese'), { form: 'flat', rim: true });
  const lettuce = c.poly([
    [3, 15],
    [6, 13.5],
    [9, 15.5],
    [12, 13.5],
    [15, 15.5],
    [18, 13.5],
    [21, 15.5],
    [24, 13.5],
    [27, 15.5],
    [29, 14.5],
    [29, 17],
    [3, 17],
  ]);
  c.layer(lettuce, mat('lettuce'), { form: 'flat', rim: true });
  const top = c.ellipse(16, 13.5, 12.5, 9.5).intersect(c.rect(0, 0, 32, 15.5));
  c.layer(top, mat('crust'), { rim: true });
  c.scatter(top, { count: 9, colors: ['#fff4d6'], kind: 'seed', margin: 2, seed: 9 });
  c.shine(10, 7, 2);
  return c.done();
});

food('pizza', 'meals', () => {
  const c = new Chef(32, 32, 2);
  const slice = c.poly([
    [4, 7],
    [26, 5],
    [26.5, 9],
    [23, 28],
  ]);
  c.layer(slice, mat('cheese'), { form: 'flat', bevel: 2 });
  const crust = c.capsule(4.5, 7.5, 26, 6, 2.6);
  c.layer(crust, mat('crust'), { rim: true });
  for (const [x, y, r] of [
    [12, 11, 2.6],
    [20, 10.5, 2.4],
    [17, 17, 2.5],
    [21.5, 21, 1.8],
    [9.5, 8.5, 1.4],
  ] as [number, number, number][])
    c.layer(c.circle(x, y, r).intersect(slice), mat('tomato'), { rim: true });
  c.scatter(slice, { count: 6, colors: ['#3d8f45', '#58a93a'], kind: 'dot', seed: 5 });
  c.shine(13, 10, 1);
  return c.done();
});

// ---- fresh

food('onigiri', 'fresh', () => {
  const c = new Chef(32, 32, 8);
  const rice = c.blob([
    [16, 3.5],
    [23, 12],
    [28, 22],
    [25, 28],
    [16, 29],
    [7, 28],
    [4, 22],
    [9, 12],
  ]);
  c.layer(rice, mat('rice'), { grain: 0.12 });
  c.scatter(rice, { count: 10, colors: ['#d8d4e2'], kind: 'dot', seed: 2 });
  c.layer(c.roundRect(10.5, 18, 11, 11.5, 1.5).intersect(rice), mat('nori'), { form: 'flat', rim: true });
  c.scatter(c.roundRect(11, 19, 10, 9, 1), { count: 5, colors: ['#557a60'], kind: 'dot', seed: 6 });
  c.shine(11, 9, 2);
  return c.done();
});

food('apple', 'fresh', () => {
  const c = new Chef(32, 32, 3);
  const body = c.circle(10.5, 18, 9).union(c.circle(21.5, 18, 9)).union(c.ellipse(16, 21, 11, 8.5));
  c.layer(body.subtract(c.ellipse(16, 8.5, 3, 2)), mat('apple'));
  c.line(16, 10, 17, 4, '#5e3a24');
  c.line(17, 10, 18, 4, '#8c5a38');
  c.layer(c.blob([
    [18, 6],
    [22, 2.5],
    [27, 3],
    [24, 7],
  ]), mat('green'), { form: 'soft', bevel: 2 });
  c.shine(8, 14, 3);
  c.px(9, 16, '#ffffff');
  return c.done();
});

// ---- drinks

food('milk', 'drinks', () => {
  const c = new Chef(32, 32, 1);
  // front face, side face, gable roof
  const front = c.rect(7, 12, 13, 17);
  const side = c.poly([
    [20, 12],
    [26, 9],
    [26, 26],
    [20, 29],
  ]);
  c.layer(front, mat('white'), { form: 'flat', bevel: 1 });
  c.layer(side, mat('white'), { form: 'flat', bevel: 1, bias: -0.22 });
  c.layer(c.poly([
    [7, 12],
    [13.5, 5],
    [20, 12],
  ]), mat('white'), { form: 'flat', bevel: 1, bias: 0.05 });
  c.layer(c.poly([
    [13.5, 5],
    [20, 3],
    [26, 9],
    [20, 12],
  ]), mat('white'), { form: 'flat', bevel: 1, bias: -0.12 });
  c.layer(c.rect(7, 4, 13, 1.2).intersect(c.rect(12, 2, 4, 3)), mat('white'));
  // blue label band and a little cow-print moon
  c.layer(c.rect(7, 18, 13, 6), mat('sky'), { form: 'flat', bevel: 1 });
  c.layer(c.poly([
    [20, 18],
    [26, 15],
    [26, 21],
    [20, 24],
  ]), mat('sky'), { form: 'flat', bevel: 1, bias: -0.2 });
  c.layer(c.circle(13.5, 21, 2), mat('white'), { form: 'soft' });
  c.px(12, 14, '#e0394a').px(13, 14, '#e0394a').px(15, 14, '#e0394a');
  return c.done();
});

export function foodDefs(): FoodDef[] {
  return FOODS;
}

export { INK };
