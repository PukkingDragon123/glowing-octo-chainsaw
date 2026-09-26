import { h } from './dom';
import { openPanel, toast } from './overlay';
import { CONFIG, priceOf } from '../app/config';
import type { GameState } from '../app/state';
import type { ProductDef } from '../products/types';
import { audio } from '../engine/audio';
import { Painter } from '../engine/Painter';
import { FONT_BIG } from '../engine/pixelFont';
import { iconImg } from '../art/icons';
import { buddyPortrait } from '../art/buddy';
import { CAST } from '../art/cast';
import { MASCOT_OF } from '../art/mascots';
import { drawLogo, BRAND } from '../art/brand';

export type UnlockKind = 'buy' | 'member' | 'ad';

function portraitCanvas(productId: string, scale = 3, pose: Parameters<typeof buddyPortrait>[1] = { armR: 2.6, mouth: 'open' }) {
  const spec = CAST[MASCOT_OF[productId] ?? 'apple'] ?? CAST.apple;
  const src = buddyPortrait(spec, pose).toCanvas();
  const c = document.createElement('canvas');
  c.width = src.width * scale;
  c.height = src.height * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function scaled(src: HTMLCanvasElement, scale: number) {
  const c = document.createElement('canvas');
  c.width = src.width * scale;
  c.height = src.height * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/**
 * The pay screen that opens right where you tapped a locked pack: buy it, join the monthly
 * Member Pass (every pack), or watch a short ad to try it today.
 */
export function openPayScreen(product: ProductDef, state: GameState, onUnlocked: (kind: UnlockKind) => void) {
  const demo = CONFIG.demoPayments;
  const price = priceOf(product);
  const lock = iconImg('lock', 4);
  const art = h('div', { class: 'showcase-art' }, portraitCanvas(product.id), lock);
  const buy = h(
    'button',
    { class: 'pill', onclick: () => void pay('buy') },
    h('span', { class: 'lead' }, iconImg('star', 2), 'UNLOCK'),
    h('span', { class: 'price' }, price),
  );
  const member = h(
    'button',
    { class: 'pill pink', onclick: () => void pay('member') },
    h('span', { class: 'lead' }, iconImg('card', 2), h('span', null, 'MEMBER PASS', h('br'), h('span', { class: 'member-sub' }, 'EVERY PACK'))),
    h('span', { class: 'price' }, `${CONFIG.member.price}/${CONFIG.member.period === 'MONTH' ? 'MO' : CONFIG.member.period}`),
  );
  const ad = h('button', { class: 'pill paper', onclick: () => watchAd() }, h('span', { class: 'lead' }, iconImg('play', 2, { fill: '#5a3a26' }), 'WATCH AD'), h('span', { class: 'price' }, 'TODAY'));
  const note = demo ? h('div', { class: 'small-print' }, 'Demo store: no real payment is taken.') : null;
  const body = h('div', { class: 'rpg-body' }, art, buy, member, ad, note);
  const panel = openPanel(product.name.toUpperCase(), body, { stamp: demo ? 'DEMO' : undefined });
  audio.play('blip', { rate: 0.8 });

  async function pay(kind: 'buy' | 'member') {
    const link = kind === 'member' ? CONFIG.member.paymentLink : CONFIG.paymentLinks[product.id];
    if (!demo) {
      if (!link) {
        toast('Payments are not set up yet', 'bad');
        return;
      }
      // Real checkout opens Stripe; unlocking must come back from your server after payment.
      const a = document.createElement('a');
      a.href = link;
      a.target = '_blank';
      a.rel = 'noopener';
      a.click();
      toast('Checkout opened in a new tab', 'info', 'card');
      return;
    }
    for (const b of [buy, member, ad]) b.disabled = true;
    audio.play('register');
    await new Promise((r) => setTimeout(r, 650));
    if (kind === 'buy') {
      state.unlock(product.id);
      audio.play('unlock');
      panel.close();
      onUnlocked('buy');
      return;
    }
    state.startMembership();
    audio.play('tada');
    showMemberCard(state, () => {
      panel.close();
      onUnlocked('member');
    }, panel.body);
  }

  function watchAd() {
    audio.play('select');
    showAd(panel.body, () => {
      state.adUnlock(product.id);
      audio.play('unlock');
      panel.close();
      onUnlocked('ad');
    });
  }
}

/** The pink member card flips in, then continues. */
function showMemberCard(state: GameState, done: () => void, into: HTMLElement) {
  const until = new Date(state.data.memberUntil);
  const logo = scaled(drawLogo(32, { badge: true }).toCanvas(), 2);
  logo.style.imageRendering = 'pixelated';
  const card = h(
    'div',
    { class: 'member-card' },
    h('div', { class: 'row' }, logo, iconImg('star', 3)),
    h('div', { class: 'name' }, 'XOLOTL KOBINI', h('br'), 'MEMBER'),
    h('div', { class: 'row' }, h('span', { class: 'until' }, `UNTIL ${until.getDate()}/${until.getMonth() + 1}/${until.getFullYear()}`), iconImg('heart', 2)),
  );
  into.replaceChildren(card, h('button', { class: 'pill pink', onclick: done }, h('span', { class: 'lead' }, iconImg('check', 2), 'LETS GO')));
  setTimeout(done, 2600);
}

/**
 * Built-in rewarded "ad": a cute store promo with a countdown. Swap this for your ad network's
 * rewarded-video SDK (call `onDone` from its reward callback).
 */
export function showAd(into: HTMLElement, onDone: () => void) {
  const p = new Painter(120, 68);
  const canvas = p.canvas;
  const bar = h('i');
  const wrap = h('div', { class: 'ad-screen' }, canvas, h('div', { class: 'ad-bar' }, bar));
  into.replaceChildren(wrap);
  const buddy = buddyPortrait(CAST.apple, { armR: 2.6, mouth: 'open' }).toCanvas();
  const logo = drawLogo(24, { badge: true }).toCanvas();
  const secs = CONFIG.adSeconds;
  const t0 = performance.now();
  let raf = 0;
  const frame = () => {
    const t = (performance.now() - t0) / 1000;
    p.clear('#ffe9f0');
    for (let i = -2; i < 16; i++) p.poly([
      [i * 12 + ((t * 20) % 24), 0],
      [i * 12 + 6 + ((t * 20) % 24), 0],
      [i * 12 - 10 + ((t * 20) % 24), 68],
      [i * 12 - 16 + ((t * 20) % 24), 68],
    ], '#ffd6e2');
    p.ctx.drawImage(logo, 8, 8);
    p.text('XOLOTL', 36, 10, { font: FONT_BIG, color: BRAND.pink, shadow: '#ffffff' });
    p.text('KOBINI', 36, 20, { font: FONT_BIG, color: '#6fb7a8', shadow: '#ffffff' });
    const bob = Math.round(Math.abs(Math.sin(t * 5)) * 5);
    p.ctx.drawImage(buddy, 120 - buddy.width - 8, 68 - buddy.height - 4 - bob);
    for (let i = 0; i < 5; i++) {
      const x = (i * 29 + t * 30) % 120;
      const y = 60 - ((t * 25 + i * 17) % 50);
      p.rect(Math.round(x), Math.round(y), 2, 2, '#ffffff');
    }
    bar.style.width = `${Math.min(100, (t / secs) * 100)}%`;
    if (t >= secs) {
      onDone();
      return;
    }
    if (canvas.isConnected) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  void raf;
}
