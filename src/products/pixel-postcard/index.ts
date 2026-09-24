import { makeStub } from '../common/stub';

// Placeholder: replaced by the real implementation.
export const pixelPostcard = makeStub({
  id: 'pixel-postcard',
  name: 'Pixel Postcard',
  tagline: 'Instant film for your pixels.',
  reveal: 'Flash! The photo slides out and develops, with your code on the frame.',
  section: 'media',
  price: 0,
  preferredMode: 'image',
  flavors: [
    { id: 'classic', name: 'Classic', c: { main: '#f1f1f1' } },
    { id: 'sunset', name: 'Sunset', c: { main: '#ff8c61' } },
    { id: 'mint', name: 'Mint', c: { main: '#7ae7c7' } },
    { id: 'midnight', name: 'Midnight', c: { main: '#2b2d42' } },
  ],
});
