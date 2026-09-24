import { beforeEach, describe, expect, it } from 'vitest';
import { buildPayload, defaultContent, DEFAULT_LINK } from '../src/app/content';
import { GameState } from '../src/app/state';
import { CONFIG } from '../src/app/config';
import { demoPixelArt } from '../src/qr/demoArt';
import { decodePixelArt, extractPixelHash } from '../src/qr/pixelCodec';

// minimal localStorage for node
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe('QRBucks wallet', () => {
  it('starts with the welcome balance and persists changes', () => {
    const s = new GameState();
    expect(s.bucks).toBe(CONFIG.startingBucks);
    s.addBucks(50);
    const again = new GameState();
    expect(again.bucks).toBe(CONFIG.startingBucks + 50);
  });

  it('only spends what you have', () => {
    const s = new GameState();
    expect(s.spend(s.bucks + 1)).toBe(false);
    expect(s.spend(20)).toBe(true);
    expect(s.bucks).toBe(CONFIG.startingBucks - 20);
  });

  it('gives the daily bonus once per day', () => {
    const s = new GameState();
    expect(s.claimDaily()).toBe(true);
    expect(s.claimDaily()).toBe(false);
    expect(s.bucks).toBe(CONFIG.startingBucks + CONFIG.dailyBonus);
  });

  it('caps rewarded ads per day', () => {
    const s = new GameState();
    for (let i = 0; i < CONFIG.adsPerDay; i++) s.rewardAd();
    expect(s.adsLeft).toBe(0);
    expect(s.bucks).toBe(CONFIG.startingBucks + CONFIG.adsPerDay * CONFIG.adReward);
  });

  it('tracks unlocks, including the Market Pass', () => {
    const s = new GameState();
    expect(s.owns('volt', 150)).toBe(false);
    expect(s.owns('captain-qr', 0)).toBe(true);
    s.unlock('volt');
    expect(s.owns('volt', 150)).toBe(true);
    expect(s.owns('gacha', 120)).toBe(false);
    s.unlock('*');
    expect(s.owns('gacha', 120)).toBe(true);
  });

  it('pets the cat for a tip once a day', () => {
    const s = new GameState();
    expect(s.pet()).toBe(true);
    expect(s.pet()).toBe(false);
    expect(s.bucks).toBe(CONFIG.startingBucks + 5);
  });
});

describe('content → payload', () => {
  it('normalises links and labels video platforms', async () => {
    const c = defaultContent();
    c.link = 'youtu.be/dQw4w9WgXcQ';
    const p = await buildPayload(c);
    expect(p.text).toBe('https://youtu.be/dQw4w9WgXcQ');
    expect(p.label).toMatch(/YouTube/);
  });

  it('asks for a link when empty but keeps a valid fallback code', async () => {
    const c = defaultContent();
    c.link = '   ';
    const p = await buildPayload(c);
    expect(p.error).toBeTruthy();
    expect(p.text).toBe(DEFAULT_LINK);
  });

  it('builds Wi-Fi and contact payloads', async () => {
    const c = defaultContent();
    c.mode = 'wifi';
    expect((await buildPayload(c)).text).toMatch(/^WIFI:T:WPA;S:QR-Market-Guest;P:scanme123;;$/);
    c.mode = 'contact';
    expect((await buildPayload(c)).text).toMatch(/^BEGIN:VCARD/);
  });

  it('turns a photo into a postcard link that decodes back to the same pixels', async () => {
    const c = defaultContent();
    c.mode = 'image';
    c.image = demoPixelArt(1);
    const p = await buildPayload(c);
    expect(p.art).toBe(c.image);
    const back = await decodePixelArt(extractPixelHash(p.text)!);
    expect(Array.from(back.frames[0])).toEqual(Array.from(c.image.frames[0]));
  });
});
