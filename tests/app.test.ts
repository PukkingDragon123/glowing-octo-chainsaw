import { beforeEach, describe, expect, it } from 'vitest';
import { buildPayload, defaultContent, DEFAULT_LINK } from '../src/app/content';
import { GameState } from '../src/app/state';
import { CONFIG, priceOf } from '../src/app/config';
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

describe('unlocks and the member pass', () => {
  const volt = { id: 'volt', price: 150 };
  const gacha = { id: 'gacha', price: 120 };

  it('free packs are always open, paid ones need unlocking', () => {
    const s = new GameState();
    expect(s.owns({ id: 'captain-qr', price: 0 })).toBe(true);
    expect(s.owns(volt)).toBe(false);
    s.unlock('volt');
    expect(s.owns(volt)).toBe(true);
    expect(s.owns(gacha)).toBe(false);
    // persisted
    expect(new GameState().owns(volt)).toBe(true);
  });

  it('the member pass opens everything until it runs out', () => {
    const s = new GameState();
    const now = Date.now();
    s.startMembership(CONFIG.member.days, now);
    expect(s.isMember).toBe(true);
    expect(s.owns(gacha)).toBe(true);
    // extending adds to the remaining time
    const until = s.data.memberUntil;
    s.startMembership(30, now);
    expect(s.data.memberUntil).toBe(until + 30 * 86400000);
    s.data.memberUntil = now - 1;
    expect(s.isMember).toBe(false);
    expect(s.owns(gacha)).toBe(false);
  });

  it('a rewarded ad opens one pack for today only', () => {
    const s = new GameState();
    s.adUnlock('gacha');
    expect(s.owns(gacha)).toBe(true);
    expect(s.owns(volt)).toBe(false);
    s.data.adPass.gacha = '2000-1-1';
    expect(s.owns(gacha)).toBe(false);
  });

  it('remembers which hints were shown', () => {
    const s = new GameState();
    expect(s.seen('qr')).toBe(false);
    s.markSeen('qr');
    expect(new GameState().seen('qr')).toBe(true);
  });

  it('prices every locked pack', () => {
    expect(priceOf({ id: 'captain-qr', price: 0 })).toBe('');
    expect(priceOf({ id: 'volt', price: 150 })).toMatch(/^\$\d+\.\d\d$/);
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
