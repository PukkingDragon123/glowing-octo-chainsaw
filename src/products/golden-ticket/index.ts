import { makeStub } from '../common/stub';

// Placeholder: replaced by the real implementation.
export const goldenTicket = makeStub({
  id: 'golden-ticket',
  name: 'Golden Ticket',
  tagline: 'Only five in the world. Probably.',
  reveal: 'Unwrap the golden bar to find an embossed gold QR ticket.',
  section: 'premium',
  price: 200,
  badge: 'LIMITED',
  flavors: [
    { id: 'gold', name: 'Gold', c: { main: '#f2c14e' } },
    { id: 'rose', name: 'Rose Gold', c: { main: '#e8a0a0' } },
    { id: 'platinum', name: 'Platinum', c: { main: '#c9d6df' } },
  ],
});
