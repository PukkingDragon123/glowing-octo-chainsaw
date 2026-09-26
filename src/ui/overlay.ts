import { h } from './dom';
import { audio } from '../engine/audio';
import { iconImg, type IconName } from '../art/icons';

let toastBox: HTMLElement | null = null;

/** A short pixel toast (use sparingly — the game talks with animations, not words). */
export function toast(message: string, kind: 'info' | 'good' | 'bad' = 'info', icon?: IconName) {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastBox);
  }
  const t = h('div', { class: `toast ${kind}` }, icon ? iconImg(icon, 2) : null, message);
  toastBox.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

export interface PanelHandle {
  close(): void;
  el: HTMLElement;
  body: HTMLElement;
}

let open: PanelHandle[] = [];

/** Parchment RPG panel with a ribbon title and an X button. */
export function openPanel(title: string, body: Node, opts: { ribbon?: 'green' | 'pink'; onClose?: () => void; stamp?: string } = {}): PanelHandle {
  const close = () => {
    backdrop.remove();
    open = open.filter((m) => m !== handle);
    opts.onClose?.();
  };
  const xBtn = h('button', { class: 'x', 'aria-label': 'Close', onclick: () => (audio.play('back'), close()) }, iconImg('close', 2));
  const wrap = h('div', { class: 'rpg-body' }, body);
  const panel = h(
    'div',
    { class: 'rpg', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: `ribbon ${opts.ribbon ?? 'green'}` }, title),
    xBtn,
    wrap,
    opts.stamp ? h('div', { class: 'stamp' }, opts.stamp) : null,
  );
  const backdrop = h('div', { class: 'backdrop', onclick: (e: Event) => e.target === backdrop && close() }, panel);
  document.body.appendChild(backdrop);
  const handle = { close, el: panel, body: wrap };
  open.push(handle);
  setTimeout(() => (panel.querySelector('button.pill') as HTMLElement | null)?.focus(), 40);
  return handle;
}

export function closeTopModal(): boolean {
  const m = open[open.length - 1];
  if (!m) return false;
  m.close();
  return true;
}

export function anyModalOpen() {
  return open.length > 0;
}
