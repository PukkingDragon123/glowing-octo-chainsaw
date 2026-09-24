import { makeStub } from '../common/stub';

// Placeholder: replaced by the real implementation.
export const gacha = makeStub({
  id: 'gacha',
  name: 'QR Gacha',
  tagline: 'What will you get?',
  reveal: 'Drop a coin, turn the crank: a capsule pops out with a random rare finish.',
  section: 'counter',
  price: 120,
  badge: 'RARE',
  flavors: [
    { id: 'holo', name: 'Holo', c: { main: '#9b5de5' } },
    { id: 'gold', name: 'Gold', c: { main: '#f2a900' } },
    { id: 'neon', name: 'Neon', c: { main: '#00f5d4' } },
    { id: 'galaxy', name: 'Galaxy', c: { main: '#3a0ca3' } },
  ],
});
