import type { ProductDef, SectionId } from './types';
import { captainQR } from './captain';
import { pixelDrops } from './candy';
import { chocoBlock } from './choco-block';
import { donutHoles } from './donut-holes';
import { crunchBytes } from './crunch-bytes';
import { fizzPop } from './fizz-pop';
import { bobaBliss } from './boba-bliss';
import { volt } from './volt';
import { onigiri } from './onigiri';
import { latteArt } from './latte-art';
import { frostyCubes } from './frosty-cubes';
import { luckyScratch } from './lucky-scratch';
import { gacha } from './gacha';
import { pixelPostcard } from './pixel-postcard';
import { flipbookTape } from './flipbook-tape';
import { goldenTicket } from './golden-ticket';

export const PRODUCTS: ProductDef[] = [
  captainQR,
  pixelDrops,
  chocoBlock,
  donutHoles,
  crunchBytes,
  fizzPop,
  bobaBliss,
  volt,
  onigiri,
  latteArt,
  frostyCubes,
  luckyScratch,
  gacha,
  pixelPostcard,
  flipbookTape,
  goldenTicket,
];

export function productById(id: string): ProductDef | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function productsIn(section: SectionId): ProductDef[] {
  return PRODUCTS.filter((p) => p.section === section);
}
