import { h, coinIcon, formatBucks, clear } from './dom';
import { SECTIONS, type SectionInfo } from '../store/layout';
import type { ShelfItem } from '../store/Store';

export interface HudCallbacks {
  onWallet(): void;
  onSound(): void;
  onMusic(): void;
  onHelp(): void;
  onReceipts(): void;
  onSection(id: SectionInfo['id']): void;
  onStep(dir: number): void;
  onWalkIn(): void;
  onSkipIntro(): void;
}

export const LOGO_SVG =
  '<svg class="logo-mark" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><rect width="16" height="16" fill="#ffd23f"/><path d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2z" fill="#1d1b26"/><path d="M3 3h3v3H3zM10 3h3v3h-3zM3 10h3v3H3z" fill="#ffd23f"/><path d="M4 4h1v1H4zM11 4h1v1h-1zM4 11h1v1H4zM9 9h2v2H9zM12 9h2v2h-2zM10 12h3v2h-3z" fill="#1d1b26"/></svg>';

export class Hud {
  readonly root: HTMLElement;
  private top: HTMLElement;
  private walletValue: HTMLElement;
  private wallet: HTMLElement;
  private soundBtn: HTMLButtonElement;
  private musicBtn: HTMLButtonElement;
  private nav: HTMLElement;
  private chips = new Map<string, HTMLElement>();
  private tip: HTMLElement;
  private hint: HTMLElement;
  private title: HTMLElement;
  owns: (item: ShelfItem) => boolean = () => true;

  constructor(host: HTMLElement, cb: HudCallbacks) {
    this.root = host;
    this.walletValue = h('span', { class: 'wallet-value' }, '0');
    this.wallet = h(
      'button',
      { class: 'wallet', 'aria-label': 'QRBucks wallet: get more QRBucks', onclick: cb.onWallet },
      h('span', { class: 'wallet-screen' }, coinIcon(18), h('span', { class: 'wallet-label' }, 'QRBUCKS'), this.walletValue),
      h('span', { class: 'wallet-plus', 'aria-hidden': 'true' }, '+'),
    );
    this.soundBtn = h('button', { class: 'icon-btn', 'aria-label': 'Sound effects', 'aria-pressed': 'true', onclick: cb.onSound }, '♪');
    this.musicBtn = h('button', { class: 'icon-btn hud-extra', 'aria-label': 'Store music', 'aria-pressed': 'false', onclick: cb.onMusic }, '♫');
    this.top = h(
      'div',
      { class: 'hud-top' },
      h('div', { class: 'logo', html: LOGO_SVG }, h('div', { class: 'logo-text' }, h('span', { class: 'logo-name' }, 'QR MARKET'), h('span', { class: 'logo-sub' }, 'OPEN 24/7 · EVERY SNACK IS A QR'))),
      h(
        'div',
        { class: 'hud-right' },
        this.wallet,
        h('button', { class: 'icon-btn hud-extra', 'aria-label': 'Your receipts', onclick: cb.onReceipts }, '≡'),
        this.soundBtn,
        this.musicBtn,
        h('button', { class: 'icon-btn', 'aria-label': 'How it works', onclick: cb.onHelp }, '?'),
      ),
    );
    const chipBox = h('div', { class: 'aisle-chips', role: 'tablist', 'aria-label': 'Aisles' });
    for (const s of SECTIONS) {
      const chip = h(
        'button',
        { class: 'aisle-chip', role: 'tab', style: `--c:${s.color}`, onclick: () => cb.onSection(s.id), 'aria-label': s.name },
        h('i', { class: 'dot' }),
        h('span', { class: 'name' }, s.name),
      );
      this.chips.set(s.id, chip);
      chipBox.appendChild(chip);
    }
    this.nav = h(
      'div',
      { class: 'aisle-nav' },
      h('button', { class: 'icon-btn', 'aria-label': 'Walk left', onclick: () => cb.onStep(-1) }, '◀'),
      chipBox,
      h('button', { class: 'icon-btn', 'aria-label': 'Walk right', onclick: () => cb.onStep(1) }, '▶'),
    );
    this.tip = h('div', { class: 'tooltip', hidden: true, role: 'tooltip' });
    this.hint = h('div', { class: 'hint', hidden: true }, 'Drag or scroll to walk the aisles · click any product to make your QR');
    this.title = h(
      'div',
      { class: 'title-screen' },
      h(
        'div',
        { class: 'title-card' },
        h('h1', null, 'QR ', h('span', null, 'MARKET')),
        h('p', null, 'A 24/7 pixel convenience store where every snack turns your link, photo or video into a QR code.'),
        h('div', { class: 'title-feats' }, ['Links', 'Wi-Fi', 'Contacts', 'Photos', 'Videos', '16 products'].map((f) => h('span', { class: 'feat' }, f))),
        h(
          'div',
          { class: 'title-actions' },
          h('button', { class: 'btn btn-big', style: { width: 'auto' }, onclick: cb.onWalkIn, id: 'walk-in' }, '▶ Walk in'),
          h('button', { class: 'btn btn-paper', onclick: cb.onSkipIntro }, 'Skip intro'),
        ),
      ),
    );
    host.append(this.top, this.nav, this.tip, this.hint, this.title);
    this.setMode('title');
  }

  setMode(mode: 'title' | 'walking' | 'store' | 'showcase') {
    this.title.hidden = mode !== 'title';
    this.nav.hidden = mode !== 'store';
    this.top.style.visibility = mode === 'walking' ? 'hidden' : 'visible';
    const logo = this.top.querySelector('.logo') as HTMLElement;
    logo.style.visibility = mode === 'showcase' ? 'hidden' : 'visible';
    if (mode !== 'store') {
      this.tip.hidden = true;
      this.hint.hidden = true;
    }
  }

  showHint(show: boolean) {
    this.hint.hidden = !show;
  }

  setWallet(bucks: number, bump = false) {
    this.walletValue.textContent = formatBucks(bucks);
    if (bump) {
      this.wallet.classList.remove('bump');
      void this.wallet.offsetWidth;
      this.wallet.classList.add('bump');
    }
  }

  setSound(on: boolean, music: boolean) {
    this.soundBtn.setAttribute('aria-pressed', String(on));
    this.musicBtn.setAttribute('aria-pressed', String(music));
  }

  setSection(id: string) {
    for (const [k, el] of this.chips) {
      el.classList.toggle('active', k === id);
      el.setAttribute('aria-selected', String(k === id));
      if (k === id) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  tooltip(item: ShelfItem | null, x: number, y: number) {
    if (!item) {
      this.tip.hidden = true;
      return;
    }
    const p = item.product;
    const owned = this.owns(item);
    clear(this.tip);
    this.tip.classList.toggle('locked', !owned);
    this.tip.append(
      h('div', { class: 'tt-top' }, h('span', { class: 'tt-name' }, p.name), p.badge ? h('span', { class: 'tt-badge' }, p.badge) : null),
      h('div', { class: 'tt-flavor' }, item.flavor.name),
      h('div', { class: 'tt-reveal' }, p.reveal),
      h('div', { class: 'tt-price' }, owned ? (p.price > 0 ? '✓ OWNED · CLICK TO OPEN' : 'FREE · CLICK TO OPEN') : [coinIcon(14), `${p.price} QRBUCKS · CLICK TO PREVIEW`]),
    );
    this.tip.hidden = false;
    const w = this.tip.offsetWidth;
    const hgt = this.tip.offsetHeight;
    const left = Math.min(x, window.innerWidth - w - 24);
    const top = Math.min(y, window.innerHeight - hgt - 24);
    this.tip.style.left = `${left}px`;
    this.tip.style.top = `${top}px`;
  }
}
