/**
 * Xolotl Kobini configuration.
 *
 * Payments run in demo mode: "Buy" and "Member pass" unlock for free and say so on screen. To charge
 * real money, create Stripe Payment Links (one per pack you sell and a subscription link for the
 * Member Pass), paste them below and set `demoPayments` to false; the buttons then open Stripe
 * Checkout. Unlocking after a real payment must be verified on a server (a Stripe webhook that
 * records the purchase and returns a signed grant) — the browser-only save in src/app/state.ts is
 * for demo play and can be edited by users. See README.md.
 *
 * Ads: "Watch an ad" plays a built-in house ad, then unlocks that pack for the rest of the day.
 * Replace `showAd` in src/ui/PayScreen.ts with your ad network's rewarded-video SDK.
 */
export const CONFIG = {
  demoPayments: true,
  /** Pack prices by product id. Products not listed here are free. */
  prices: {
    'lucky-scratch': '$0.99',
    'latte-art': '$0.99',
    'fizz-pop': '$1.49',
    'frosty-cubes': '$1.49',
    'boba-bliss': '$1.49',
    gacha: '$1.99',
    volt: '$1.99',
    'golden-ticket': '$2.99',
  } as Record<string, string>,
  /** Stripe Payment Links by product id (https://buy.stripe.com/...). */
  paymentLinks: {} as Record<string, string>,
  member: {
    price: '$2.99',
    period: 'MONTH',
    days: 30,
    /** Stripe subscription Payment Link for the Member Pass. */
    paymentLink: '',
  },
  adSeconds: 8,
  /** Base URL used inside Pixel Postcard codes. Set VITE_PUBLIC_URL at build time for your domain. */
  publicUrl: (import.meta.env.VITE_PUBLIC_URL as string | undefined) ?? '',
};

/** Price label for a locked pack ('' when free). */
export function priceOf(p: { id: string; price: number }): string {
  if (p.price <= 0) return '';
  return CONFIG.prices[p.id] ?? (p.price >= 200 ? '$2.99' : p.price >= 120 ? '$1.99' : p.price >= 80 ? '$1.49' : '$0.99');
}
