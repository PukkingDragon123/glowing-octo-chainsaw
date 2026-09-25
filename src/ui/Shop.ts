import { h, coinIcon, formatBucks } from './dom';
import { openModal, toast } from './overlay';
import { CONFIG, type BucksPack } from '../app/config';
import type { GameState } from '../app/state';
import { audio } from '../engine/audio';
import { Painter } from '../engine/Painter';
import { FONT_BIG, FONT_TINY } from '../engine/pixelFont';
import { drawCaptain } from '../products/captain/art';
import { candySprite } from '../products/candy/art';
import type { ProductDef } from '../products/types';

export interface ShopCallbacks {
  onChange(): void;
  onUnlockAll(): void;
}

/** The QRBucks exchange at the register: free daily bonus, rewarded ads and (demo) packs. */
export function openShop(state: GameState, cb: ShopCallbacks) {
  const value = h('span', { class: 'wallet-value' }, formatBucks(state.bucks));
  const refresh = () => {
    value.textContent = formatBucks(state.bucks);
    daily.disabled = !state.dailyAvailable;
    daily.textContent = state.dailyAvailable ? `Claim +${CONFIG.dailyBonus}` : 'Come back tomorrow';
    adBtn.disabled = state.adsLeft <= 0;
    adSub.textContent = `${state.adsLeft} of ${CONFIG.adsPerDay} left today`;
    cb.onChange();
  };
  const daily = h('button', {
    class: 'btn btn-mint',
    onclick: () => {
      if (state.claimDaily()) {
        audio.play('coin');
        toast(`+${CONFIG.dailyBonus} QRBucks daily bonus`, 'good', coinIcon(14));
        refresh();
      }
    },
  });
  const adSub = h('div', { class: 'shop-sub' });
  const adBtn = h('button', {
    class: 'btn btn-mint',
    onclick: () =>
      showAd(state, () => {
        refresh();
      }),
  }, '▶ Watch ad');

  const packs = CONFIG.packs.map((p) => packCard(p, state, () => refresh(), cb));
  const body = h(
    'div',
    null,
    h('div', { class: 'register' }, h('div', { class: 'wallet-screen' }, h('span', { class: 'wallet-label' }, 'BALANCE'), h('span', { class: 'row', style: { flex: '0 0 auto', gap: '8px' } }, coinIcon(26), value))),
    h('div', { class: 'sec-label' }, 'FREE QRBUCKS'),
    h(
      'div',
      { class: 'shop-grid' },
      h('div', { class: 'shop-card free' }, h('h3', null, 'Daily bonus'), h('div', { class: 'shop-amount' }, coinIcon(20), `+${CONFIG.dailyBonus}`), h('div', { class: 'shop-sub' }, 'Once a day, every day'), daily),
      h('div', { class: 'shop-card free' }, h('h3', null, 'Watch an ad'), h('div', { class: 'shop-amount' }, coinIcon(20), `+${CONFIG.adReward}`), adSub, adBtn),
    ),
    h('div', { class: 'sec-label', style: { marginTop: '14px' } }, 'QRBUCKS PACKS'),
    h('div', { class: 'shop-grid' }, packs),
    CONFIG.demoPayments ? h('div', { class: 'demo-note' }, 'Demo store: packs are free while payments are switched off. Plug in your Stripe Payment Links in src/app/config.ts to sell QRBucks for real.') : null,
  );
  refresh();
  openModal('QRBucks Exchange', body, { wide: true });
}

function packCard(p: BucksPack, state: GameState, refresh: () => void, cb: ShopCallbacks) {
  const buy = () => {
    if (p.paymentLink && !CONFIG.demoPayments) return;
    if (p.unlockAll) {
      state.unlock('*');
      cb.onUnlockAll();
      toast('Market Pass: every product unlocked!', 'good');
    } else {
      state.addBucks(p.bucks);
      toast(`+${formatBucks(p.bucks)} QRBucks`, 'good', coinIcon(14));
    }
    audio.play('register');
    refresh();
  };
  const btn =
    p.paymentLink && !CONFIG.demoPayments
      ? h('a', { class: 'btn', href: p.paymentLink, target: '_blank', rel: 'noopener' }, `Buy ${p.price}`)
      : h('button', { class: 'btn', onclick: buy }, CONFIG.demoPayments ? `${p.price} · Demo` : `Buy ${p.price}`);
  return h(
    'div',
    { class: 'shop-card' },
    h('h3', null, p.name),
    p.unlockAll ? h('div', { class: 'shop-amount' }, '★ ALL') : h('div', { class: 'shop-amount' }, coinIcon(20), formatBucks(p.bucks)),
    h('div', { class: 'shop-sub' }, p.bonus ?? ''),
    btn,
  );
}

// -------------------------------------------------------------------------------------------------
// Rewarded house ad (replace with a real rewarded-video SDK in production)

type AdScene = (p: Painter, t: number) => void;

const AD_SCENES: AdScene[] = [
  (p, t) => {
    p.gradientV(0, 0, p.w, p.h, '#6f4ef2', '#2b1d6b', 4);
    p.grid(0, 0, p.w, p.h, 8, 'rgba(255,255,255,0.08)');
    const bounce = Math.abs(Math.sin(t * 4)) * 6;
    drawCaptain(p, 12, 22 - bounce, t % 2 < 1 ? 'salute' : 'cheer');
    p.text('CAPTAIN QR', 108, 16, { font: FONT_BIG, scale: 2, bold: true, color: '#ffffff', outline: '#1d1b26', align: 'center' });
    p.text('SCAN YOUR', 108, 40, { font: FONT_BIG, color: '#ffd23f', outline: '#1d1b26', align: 'center' });
    p.text('BREAKFAST!', 108, 50, { font: FONT_BIG, color: '#ffd23f', outline: '#1d1b26', align: 'center' });
    for (let i = 0; i < 6; i++) {
      const x = ((i * 29 + t * 40) % 170) - 5;
      p.rect(x, 74 + Math.sin(t * 3 + i) * 3, 4, 4, '#eba53f');
    }
    p.text('AISLE 4 · FREE', 108, 64, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  },
  (p, t) => {
    p.gradientV(0, 0, p.w, p.h, '#e8233a', '#8f0f24', 4);
    const cols = ['#ff3b4e', '#ff8a1f', '#ffd60a', '#3ddc84', '#8b5cf6'];
    for (let i = 0; i < 18; i++) {
      const x = (i * 23 + t * 30 * (1 + (i % 3))) % 176 - 8;
      const y = 60 + ((i * 17) % 30) + Math.sin(t * 5 + i) * 4;
      candySprite(p, x, y, 5, cols[i % cols.length]);
    }
    p.text('PIXEL DROPS', 80, 12, { font: FONT_BIG, scale: 2, bold: true, color: '#ffffff', outline: '#1d1b26', align: 'center' });
    p.text('RIP. ROLL. SCAN.', 80, 36, { font: FONT_BIG, color: '#ffd60a', outline: '#1d1b26', align: 'center' });
  },
  (p, t) => {
    p.clear('#0b0f1a');
    for (let i = 0; i < 5; i++) {
      const x = 20 + i * 30;
      const y = 10 + Math.sin(t * 8 + i) * 8;
      p.line(x, y, x + 8, y + 20, t * 10 + i > 0 && Math.floor(t * 10 + i) % 3 === 0 ? '#00b4ff' : '#1e3a8a');
    }
    p.text('VOLT', 80, 22, { font: FONT_BIG, scale: 4, bold: true, color: '#00b4ff', outline: '#ffffff', align: 'center' });
    p.text('CHARGE YOUR CODES', 80, 60, { font: FONT_TINY, color: '#a3ff12', align: 'center' });
    p.text('COLD DRINKS AISLE', 80, 70, { font: FONT_TINY, color: '#ffffff', align: 'center' });
  },
];

export function showAd(state: GameState, onDone: () => void) {
  if (state.adsLeft <= 0) {
    toast('No more ads today. Come back tomorrow!', 'bad');
    return;
  }
  const painter = new Painter(160, 90);
  const canvas = painter.canvas;
  const bar = h('i');
  const label = h('span', null, `Reward in ${CONFIG.adSeconds}s`);
  const claim = h('button', { class: 'btn btn-big', disabled: true }, `Claim +${CONFIG.adReward} QRBucks`);
  const scene = AD_SCENES[Math.floor(Math.random() * AD_SCENES.length)];
  const body = h('div', null, h('div', { class: 'tv' }, canvas, h('div', { class: 'tv-bar' }, h('span', { class: 'ad-tag' }, 'AD · HOUSE'), label), h('div', { class: 'progress' }, bar)), h('div', { style: { marginTop: '12px' } }, claim));
  let raf = 0;
  const start = performance.now();
  let finished = false;
  const tick = () => {
    const t = (performance.now() - start) / 1000;
    scene(painter, t);
    const left = Math.max(0, CONFIG.adSeconds - t);
    bar.style.width = `${Math.min(100, (t / CONFIG.adSeconds) * 100)}%`;
    if (left > 0) label.textContent = `Reward in ${Math.ceil(left)}s`;
    else if (!finished) {
      finished = true;
      label.textContent = 'Thanks for watching!';
      claim.disabled = false;
      audio.play('ding');
    }
    raf = requestAnimationFrame(tick);
  };
  const modal = openModal('Rewarded ad', body, { onClose: () => cancelAnimationFrame(raf) });
  claim.addEventListener('click', () => {
    state.rewardAd();
    audio.play('coin');
    toast(`+${CONFIG.adReward} QRBucks`, 'good', coinIcon(14));
    modal.close();
    onDone();
  });
  tick();
}

export function confirmUnlock(product: ProductDef, state: GameState, onUnlock: () => void, onNeedBucks: () => void) {
  const enough = state.bucks >= product.price;
  const body = h(
    'div',
    null,
    h('p', { class: 'note', style: { fontSize: '20px', color: 'var(--ink)' } }, product.reveal),
    h('div', { class: 'register' }, h('div', { class: 'wallet-screen' }, h('span', { class: 'wallet-label' }, 'PRICE'), h('span', { class: 'row', style: { flex: '0 0 auto', gap: '8px' } }, coinIcon(26), h('span', { class: 'wallet-value' }, formatBucks(product.price))))),
    h('p', { class: 'note' }, `Your balance: ${formatBucks(state.bucks)} QRBucks. Unlocks are forever on this device.`),
    h(
      'div',
      { class: 'row', style: { marginTop: '12px' } },
      enough
        ? h('button', {
            class: 'btn btn-big',
            onclick: () => {
              modal.close();
              onUnlock();
            },
          }, `Unlock ${product.name}`)
        : h('button', {
            class: 'btn btn-big',
            onclick: () => {
              modal.close();
              onNeedBucks();
            },
          }, `Get ${product.price - state.bucks} more QRBucks`),
    ),
  );
  const modal = openModal(`Unlock ${product.name}?`, body);
}

export function openHelp() {
  const body = h(
    'div',
    null,
    h(
      'ol',
      { class: 'help-steps' },
      h('li', null, 'Walk the aisles: drag, scroll, use the arrow keys or tap an aisle name.'),
      h('li', null, 'Click any product. Each one reveals your QR code in its own way.'),
      h('li', null, 'Type a link, text, Wi-Fi login or contact, or drop a photo or short video.'),
      h('li', null, 'Press the big red button to unbox it. Drag to look around; right-drag to pan.'),
      h('li', null, 'Tap Scan mode to snap the camera straight on. Point your phone at the screen.'),
      h('li', null, 'Save the poster PNG, a plain PNG or an SVG for printing.'),
    ),
    h('hr', { class: 'rule' }),
    h('p', { class: 'note' }, 'Photos and videos never leave your device. They are squeezed into a tiny pixel picture that lives inside the code itself; scanning it opens this site and shows the picture.'),
    h('p', { class: 'note' }, 'QRBucks unlock premium products in the cooler, freezer and VIP shelf. Earn them free with the daily bonus and ads at the checkout TV.'),
    h('p', { class: 'note' }, 'Keys: ← → walk · Space opens the product · Esc goes back.'),
  );
  openModal('How QR Market works', body);
}

/** Embedded previews block downloads the page starts, so hand over the image to save by hand. */
export function openSaveImage(src: string, filename: string, copy: (() => Promise<boolean>) | null) {
  const body = h(
    'div',
    { class: 'save-image' },
    h('img', { class: 'save-image-img', src, alt: filename }),
    h('p', { class: 'note' }, 'Downloads are blocked in this preview. Right-click the image and choose Save Image As, or long-press it on a phone.'),
    h('p', { class: 'save-image-name' }, filename),
    copy
      ? h('button', {
          class: 'btn btn-paper',
          onclick: async () => {
            const ok = await copy();
            toast(ok ? 'Image copied' : 'Copying was blocked here. Save the image instead.', ok ? 'good' : 'bad');
          },
        }, '⧉ Copy image')
      : null,
  );
  openModal('Save your code', body);
}

export function openReceipts(state: GameState, onOpen: (productId: string, flavorId: string, text: string) => void) {
  const list = h('div', { class: 'receipts-list' });
  if (!state.data.receipts.length) list.append(h('p', { class: 'note' }, 'No receipts yet. Open a product to make your first code.'));
  for (const r of state.data.receipts) {
    const d = new Date(r.at);
    list.append(
      h(
        'button',
        {
          onclick: () => {
            modal.close();
            onOpen(r.product, r.flavor, r.text ?? '');
          },
        },
        h('span', null, r.label),
        h('span', { style: { color: 'var(--muted)' } }, `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`),
      ),
    );
  }
  const modal = openModal(`Your receipts (${state.data.made} made)`, list);
}

export function openCatalog(products: ProductDef[], owns: (p: ProductDef) => boolean, onOpen: (id: string) => void) {
  const sectionName: Record<string, string> = { counter: 'Checkout', media: 'Photo + Video', snacks: 'Snacks', cereal: 'Cereal', fresh: 'Fresh + Hot', cooler: 'Cold Drinks', freezer: 'Frozen', premium: 'Premium' };
  const grid = h('div', { class: 'catalog' });
  const sorted = products.slice().sort((a, b) => a.price - b.price);
  for (const p of sorted) {
    const c = p.flavors[0].c;
    const swatch = c.bg ?? c.main ?? c.bag ?? Object.values(c)[0];
    const owned = owns(p);
    grid.append(
      h(
        'button',
        { class: 'catalog-card', onclick: () => (modal.close(), onOpen(p.id)) },
        h('i', { style: `--c:${swatch}` }),
        h('span', { class: 'cc-body' }, h('b', null, p.name), h('span', null, `${sectionName[p.section] ?? p.section} · ${p.flavors.length} flavors`), h('em', null, p.reveal)),
        h('span', { class: 'cc-price' + (owned ? '' : ' locked') }, p.price === 0 ? 'FREE' : owned ? 'OWNED' : [coinIcon(12), String(p.price)]),
      ),
    );
  }
  const modal = openModal('Catalog', grid, { wide: true });
}
