import { CONFIG } from './config';

export interface Receipt {
  product: string;
  flavor: string;
  label: string;
  at: number;
  /** The encoded text (omitted when very long). */
  text?: string;
}

export interface SaveData {
  bucks: number;
  unlocked: string[];
  adsDay: string;
  adsWatched: number;
  dailyClaimed: string;
  sound: boolean;
  music: boolean;
  made: number;
  receipts: Receipt[];
  visits: number;
}

const KEY = 'qr-market-save-v1';

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function fresh(): SaveData {
  return { bucks: CONFIG.startingBucks, unlocked: [], adsDay: today(), adsWatched: 0, dailyClaimed: '', sound: true, music: false, made: 0, receipts: [], visits: 0 };
}

type Listener = (s: SaveData) => void;

/** Wallet, unlocks and settings, kept in localStorage (wrapped so private windows still work). */
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
    if (this.data.adsDay !== today()) {
      this.data.adsDay = today();
      this.data.adsWatched = 0;
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

  get bucks() {
    return this.data.bucks;
  }

  owns(productId: string, price: number) {
    return price === 0 || this.data.unlocked.includes(productId) || this.data.unlocked.includes('*');
  }

  addBucks(n: number) {
    this.data.bucks += n;
    this.save();
  }

  spend(n: number): boolean {
    if (this.data.bucks < n) return false;
    this.data.bucks -= n;
    this.save();
    return true;
  }

  unlock(productId: string) {
    if (!this.data.unlocked.includes(productId)) this.data.unlocked.push(productId);
    this.save();
  }

  get dailyAvailable() {
    return this.data.dailyClaimed !== today();
  }

  claimDaily(): boolean {
    if (!this.dailyAvailable) return false;
    this.data.dailyClaimed = today();
    this.data.bucks += CONFIG.dailyBonus;
    this.save();
    return true;
  }

  get adsLeft() {
    if (this.data.adsDay !== today()) return CONFIG.adsPerDay;
    return Math.max(0, CONFIG.adsPerDay - this.data.adsWatched);
  }

  rewardAd() {
    if (this.data.adsDay !== today()) {
      this.data.adsDay = today();
      this.data.adsWatched = 0;
    }
    this.data.adsWatched++;
    this.data.bucks += CONFIG.adReward;
    this.save();
  }

  addReceipt(r: Receipt) {
    this.data.made++;
    this.data.receipts.unshift(r);
    this.data.receipts = this.data.receipts.slice(0, 30);
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
