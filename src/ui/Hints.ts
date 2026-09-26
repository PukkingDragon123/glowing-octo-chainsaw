import { h } from './dom';
import { iconImg } from '../art/icons';

/** Wordless hints: a bouncing pixel hand (and a pulse ring) pointing at what to do next. */
export class Hints {
  private els = new Map<string, { hand: HTMLElement; ring: HTMLElement }>();

  constructor(private root: HTMLElement) {}

  show(id: string, x: number, y: number, kind: 'tap' | 'drag' = 'tap') {
    let e = this.els.get(id);
    if (!e) {
      const hand = iconImg('hand', 3) as HTMLElement;
      hand.classList.add('hint-hand');
      if (kind === 'drag') hand.classList.add('drag');
      const ring = h('div', { class: 'hint-ring' });
      if (kind === 'drag') ring.hidden = true;
      this.root.append(ring, hand);
      e = { hand, ring };
      this.els.set(id, e);
    }
    e.hand.style.left = `${Math.round(x)}px`;
    e.hand.style.top = `${Math.round(y)}px`;
    e.ring.style.left = `${Math.round(x)}px`;
    e.ring.style.top = `${Math.round(y)}px`;
  }

  hide(id: string) {
    const e = this.els.get(id);
    if (!e) return;
    e.hand.remove();
    e.ring.remove();
    this.els.delete(id);
  }

  has(id: string) {
    return this.els.has(id);
  }

  hideAll() {
    for (const id of [...this.els.keys()]) this.hide(id);
  }
}
