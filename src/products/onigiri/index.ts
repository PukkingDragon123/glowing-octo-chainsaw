import { makeStub } from '../common/stub';

// Placeholder: replaced by the real implementation.
export const onigiri = makeStub({
  id: 'onigiri',
  name: 'Onigiri QR',
  tagline: 'Pull 1, 2, 3.',
  reveal: 'Pull the tabs 1-2-3: the nori wrap is your code.',
  section: 'fresh',
  price: 0,
  flavors: [
    { id: 'tuna', name: 'Tuna Mayo', c: { main: '#2e86de' } },
    { id: 'salmon', name: 'Salmon', c: { main: '#ff7f50' } },
    { id: 'ume', name: 'Umeboshi', c: { main: '#e84393' } },
    { id: 'pork', name: 'Spicy Pork', c: { main: '#e67e22' } },
  ],
});
