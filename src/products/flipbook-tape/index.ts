import { makeStub } from '../common/stub';

// Placeholder: replaced by the real implementation.
export const flipbookTape = makeStub({
  id: 'flipbook-tape',
  name: 'Flipbook Tape',
  tagline: 'Be kind, rewind.',
  reveal: 'Insert the tape: your flipbook plays on a tiny TV with the code on the label.',
  section: 'media',
  price: 0,
  preferredMode: 'video',
  flavors: [
    { id: 'retro', name: 'Retro Black', c: { main: '#2b2b2b' } },
    { id: 'clear', name: 'Clear Purple', c: { main: '#9d4edd' } },
    { id: 'pastel', name: 'Pastel', c: { main: '#ffafcc' } },
  ],
});
