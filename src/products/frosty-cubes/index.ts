import { makeStub } from '../common/stub';

// Placeholder: replaced by the real implementation.
export const frostyCubes = makeStub({
  id: 'frosty-cubes',
  name: 'Frosty Cubes',
  tagline: 'Stay cool, stay scannable.',
  reveal: 'Tear the ice bag: cubes clatter across the tray and lock into place.',
  section: 'freezer',
  price: 90,
  flavors: [
    { id: 'classic', name: 'Classic Ice', c: { main: '#4cc9f0' } },
    { id: 'blueraz', name: 'Blue Raspberry', c: { main: '#4361ee' } },
    { id: 'cola', name: 'Cola Ice', c: { main: '#7f5539' } },
  ],
});
