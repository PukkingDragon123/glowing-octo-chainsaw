import { h } from './dom';
import { openPanel, toast } from './overlay';
import { iconImg } from '../art/icons';

/** Embedded previews block downloads the page starts, so hand over the image to save by hand. */
export function openSaveImage(src: string, filename: string, copy: (() => Promise<boolean>) | null) {
  const body = h(
    'div',
    { class: 'save-image' },
    h('img', { class: 'save-image-img', src, alt: filename }),
    h('div', { class: 'how' }, iconImg('hand', 2), iconImg('download', 2)),
    h('p', { class: 'small-print' }, 'Right-click the picture and save it, or long-press it on a phone.'),
    h('p', { class: 'save-image-name' }, filename),
    copy
      ? h('button', {
          class: 'pill',
          onclick: async () => {
            const ok = await copy();
            toast(ok ? 'Copied' : 'Copy blocked here', ok ? 'good' : 'bad', ok ? 'check' : undefined);
          },
        }, h('span', { class: 'lead' }, iconImg('paste', 2), 'COPY PICTURE'))
      : null,
  );
  openPanel('SAVE YOUR CODE', body);
}
