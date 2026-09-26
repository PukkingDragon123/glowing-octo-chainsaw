import { CONFIG } from './config';

export interface SaveData {
  /** Packs bought for good ('*' = everything, used by tests). */
  owned: string[];
  /** Member Pass expiry (ms since epoch); 0 = not a member. */
  memberUntil: number;
  /** Packs unlocked for one day by watching an ad: product id → day. */
  adPass: Record<string, string>;
  sound: boolean;
  music: boolean;
  made: number;
  visits: number;
  /** One-time hints already shown. */
  hints: string[];
}

const KEY = 'xolotl-kobini-v1';

export function today(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function fresh(): SaveData {
  return { owned: [], memberUntil: 0, adPass: {}, sound: true, music: true, made: 0, visits: 0, hints: [] };
}

type Listener = (s: SaveData) => void;

/** Unlocks, membership and settings, kept in localStorage (wrapped so private windows still work). */
export class GameState {
  data: SaveData;
  private listeners: Listener[] = [];

  constructor() {
    this.data = fresh();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...fresh(), ...JSON.parse(raw) };
    } catch {
      /* storage unavailable: play with defaults */
    }
    this.data.visits++;
    this.save();
  }

  on(fn: Listener) {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((l) => l !== fn));
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* ignore */
    }
    for (const l of this.listeners) l(this.data);
  }

  get isMember() {
    return this.data.memberUntil > Date.now();
  }

  owns(p: { id: string; price: number }) {
    if (p.price <= 0) return true;
    const d = this.data;
    return d.owned.includes(p.id) || d.owned.includes('*') || this.isMember || d.adPass[p.id] === today();
  }

  /** Permanently unlock a pack (after a purchase). */
  unlock(productId: string) {
    if (!this.data.owned.includes(productId)) this.data.owned.push(productId);
    this.save();
  }

  /** Start (or extend) the monthly Member Pass. */
  startMembership(days = CONFIG.member.days, now = Date.now()) {
    this.data.memberUntil = Math.max(now, this.data.memberUntil) + days * 86400000;
    this.save();
  }

  /** Unlock a pack for the rest of today (rewarded ad). */
  adUnlock(productId: string) {
    this.data.adPass[productId] = today();
    this.save();
  }

  seen(hint: string) {
    return this.data.hints.includes(hint);
  }

  markSeen(hint: string) {
    if (!this.seen(hint)) {
      this.data.hints.push(hint);
      this.save();
    }
  }

  addMade() {
    this.data.made++;
    this.save();
  }

  setSound(on: boolean) {
    this.data.sound = on;
    this.save();
  }

  setMusic(on: boolean) {
    this.data.music = on;
    this.save();
  }

  reset() {
    this.data = fresh();
    this.save();
  }
}
