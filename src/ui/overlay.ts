import { h } from './dom';
import { audio } from '../engine/audio';

let toastBox: HTMLElement | null = null;

export function toast(message: string, kind: 'info' | 'good' | 'bad' = 'info', icon?: Node) {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastBox);
  }
  const t = h('div', { class: `toast ${kind}` }, icon ?? null, message);
  toastBox.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

export interface ModalHandle {
  close(): void;
  el: HTMLElement;
}

let openModals: ModalHandle[] = [];

export function openModal(title: string, body: Node, opts: { onClose?: () => void; wide?: boolean } = {}): ModalHandle {
  const close = () => {
    backdrop.remove();
    openModals = openModals.filter((m) => m !== handle);
    opts.onClose?.();
  };
  const modal = h(
    'div',
    { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, style: opts.wide ? { width: 'min(640px, 100%)' } : undefined },
    h('div', { class: 'modal-head' }, h('h2', null, title), h('button', { class: 'modal-close', 'aria-label': 'Close', onclick: () => (audio.play('back'), close()) }, 'X')),
    body,
  );
  const backdrop = h('div', { class: 'backdrop', onclick: (e: Event) => e.target === backdrop && close() }, modal);
  document.body.appendChild(backdrop);
  const handle = { close, el: modal };
  openModals.push(handle);
  setTimeout(() => (modal.querySelector('button.btn, .modal-close') as HTMLElement | null)?.focus(), 30);
  return handle;
}

export function closeTopModal(): boolean {
  const m = openModals[openModals.length - 1];
  if (!m) return false;
  m.close();
  return true;
}

export function anyModalOpen() {
  return openModals.length > 0;
}
