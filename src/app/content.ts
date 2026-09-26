import { contactPayload, describePayload, detectLinkKind, LINK_KIND_LABEL, normalizeUrl, wifiPayload, type ContactInfo, type WifiInfo } from '../qr/payload';
import { pixelArtUrl, viewerBase, type PixelArt } from '../qr/pixelCodec';
import { CONFIG } from './config';
import type { ECLevel } from '../qr/qr';

export type ContentMode = 'link' | 'text' | 'wifi' | 'contact' | 'image' | 'video';

export interface ContentState {
  mode: ContentMode;
  link: string;
  text: string;
  wifi: WifiInfo;
  contact: ContactInfo;
  image: PixelArt | null;
  video: PixelArt | null;
  ec: ECLevel;
}

export const DEFAULT_LINK = 'https://pukkingdragon123.github.io/glowing-octo-chainsaw/';

export function defaultContent(): ContentState {
  return {
    mode: 'link',
    link: DEFAULT_LINK,
    text: 'Hello from Xolotl Kobini!',
    wifi: { ssid: 'Kobini-Guest', password: 'scanme123', security: 'WPA' },
    contact: { name: 'Xolo the Clerk', phone: '+66 81 234 5678', email: 'hello@xolotl.kobini', org: 'Xolotl Kobini', url: '' },
    image: null,
    video: null,
    ec: 'M',
  };
}

export interface Payload {
  text: string;
  label: string;
  art: PixelArt | null;
  /** Error message when the content can't be encoded yet. */
  error?: string;
}

export function postcardBase() {
  return CONFIG.publicUrl || viewerBase();
}

/** Turn the editor state into the exact text the QR code will carry. */
export async function buildPayload(c: ContentState): Promise<Payload> {
  switch (c.mode) {
    case 'link': {
      const url = normalizeUrl(c.link);
      if (!url) return { text: DEFAULT_LINK, label: 'Xolotl Kobini', art: null, error: 'Paste a link to make your code.' };
      const kind = detectLinkKind(url);
      return { text: url, label: kind === 'web' ? describePayload(url) : `${LINK_KIND_LABEL[kind]} · ${describePayload(url)}`, art: null };
    }
    case 'text':
      return { text: c.text || ' ', label: c.text.slice(0, 40) || 'Text', art: null };
    case 'wifi':
      if (!c.wifi.ssid) return { text: DEFAULT_LINK, label: 'Wi-Fi', art: null, error: 'Enter the network name.' };
      return { text: wifiPayload(c.wifi), label: `Wi-Fi · ${c.wifi.ssid}`, art: null };
    case 'contact':
      if (!c.contact.name) return { text: DEFAULT_LINK, label: 'Contact', art: null, error: 'Enter a name for the contact card.' };
      return { text: contactPayload(c.contact), label: `Contact · ${c.contact.name}`, art: null };
    case 'image':
      if (!c.image) return { text: DEFAULT_LINK, label: 'Pixel postcard', art: null, error: 'Drop a photo to turn it into a pixel postcard.' };
      return { text: await pixelArtUrl(c.image, postcardBase()), label: c.image.caption ? `Postcard · ${c.image.caption}` : 'Pixel postcard', art: c.image };
    case 'video':
      if (!c.video) return { text: DEFAULT_LINK, label: 'Pixel flipbook', art: null, error: 'Drop a short video to turn it into a flipbook.' };
      return { text: await pixelArtUrl(c.video, postcardBase()), label: c.video.caption ? `Flipbook · ${c.video.caption}` : 'Pixel flipbook', art: c.video };
  }
}
