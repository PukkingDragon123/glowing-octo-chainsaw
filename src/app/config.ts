/**
 * QR Market configuration.
 *
 * Payments: the store runs in demo mode — "buying" a pack adds QRBucks for free. To charge real money,
 * create Stripe Payment Links and paste them below. Granting QRBucks after a real payment needs a
 * server (Stripe webhook) to verify the purchase; see README.md.
 *
 * Ads: the "watch an ad" reward plays a built-in house ad. Swap `showAd` in src/ui/Shop.ts for your
 * ad network's rewarded-video SDK.
 */
export interface BucksPack {
  id: string;
  name: string;
  bucks: number;
  price: string;
  bonus?: string;
  /** Stripe Payment Link (https://buy.stripe.com/...). Empty = demo mode. */
  paymentLink?: string;
  unlockAll?: boolean;
}

export const CONFIG = {
  startingBucks: 120,
  dailyBonus: 30,
  adReward: 25,
  adsPerDay: 10,
  adSeconds: 12,
  demoPayments: true,
  packs: [
    { id: 'snack', name: 'Snack Pack', bucks: 250, price: '$0.99' },
    { id: 'party', name: 'Party Pack', bucks: 1200, price: '$3.99', bonus: '+20% bonus' },
    { id: 'whale', name: 'Whale Pack', bucks: 4000, price: '$9.99', bonus: 'Best value' },
    { id: 'pass', name: 'Market Pass', bucks: 0, price: '$14.99', bonus: 'Unlock every product', unlockAll: true },
  ] as BucksPack[],
  /** Base URL used inside Pixel Postcard codes. Set VITE_PUBLIC_URL at build time for your domain. */
  publicUrl: (import.meta.env.VITE_PUBLIC_URL as string | undefined) ?? '',
};
