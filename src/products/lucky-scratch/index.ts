import { makeStub } from '../common/stub';

// Placeholder: replaced by the real implementation.
export const luckyScratch = makeStub({
  id: 'lucky-scratch',
  name: 'Lucky Scratch',
  tagline: 'Everyone is a winner.',
  reveal: 'Scratch the silver foil with your finger or mouse to reveal the code.',
  section: 'counter',
  price: 50,
  flavors: [
    { id: 'gold', name: 'Gold Rush', c: { main: '#f4c430' } },
    { id: 'jade', name: 'Jade Luck', c: { main: '#2a9d8f' } },
    { id: 'ruby', name: 'Ruby Seven', c: { main: '#d62839' } },
  ],
});
