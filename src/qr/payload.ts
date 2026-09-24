/** Builders for the different things a QR code can carry. */

export type LinkKind =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'x'
  | 'spotify'
  | 'line'
  | 'maps'
  | 'whatsapp'
  | 'github'
  | 'video'
  | 'image'
  | 'web';

export function normalizeUrl(input: string): string {
  const s = input.trim();
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(s)) return 'https://' + s;
  return s;
}

export function isProbablyUrl(input: string): boolean {
  return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(input.trim());
}

export function detectLinkKind(url: string): LinkKind {
  const u = url.toLowerCase();
  if (/(youtube\.com|youtu\.be)/.test(u)) return 'youtube';
  if (/tiktok\.com/.test(u)) return 'tiktok';
  if (/instagram\.com/.test(u)) return 'instagram';
  if (/(facebook\.com|fb\.watch|fb\.me)/.test(u)) return 'facebook';
  if (/(twitter\.com|\/\/x\.com|^x\.com)/.test(u)) return 'x';
  if (/spotify\.com/.test(u)) return 'spotify';
  if (/(line\.me|lin\.ee)/.test(u)) return 'line';
  if (/(maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl|google\.[a-z.]+\/maps)/.test(u)) return 'maps';
  if (/(wa\.me|whatsapp\.com)/.test(u)) return 'whatsapp';
  if (/github\.com/.test(u)) return 'github';
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/.test(u) || /(vimeo\.com|twitch\.tv)/.test(u)) return 'video';
  if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/.test(u)) return 'image';
  return 'web';
}

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  youtube: 'YouTube video',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X post',
  spotify: 'Spotify',
  line: 'LINE',
  maps: 'Map pin',
  whatsapp: 'WhatsApp',
  github: 'GitHub',
  video: 'Video link',
  image: 'Image link',
  web: 'Website',
};

function wifiEscape(s: string) {
  return s.replace(/([\\;,:"])/g, '\\$1');
}

export interface WifiInfo {
  ssid: string;
  password: string;
  security: 'WPA' | 'WEP' | 'nopass';
  hidden?: boolean;
}

export function wifiPayload(w: WifiInfo): string {
  const parts = [`T:${w.security === 'nopass' ? 'nopass' : w.security}`, `S:${wifiEscape(w.ssid)}`];
  if (w.security !== 'nopass') parts.push(`P:${wifiEscape(w.password)}`);
  if (w.hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

export interface ContactInfo {
  name: string;
  phone?: string;
  email?: string;
  org?: string;
  url?: string;
}

function vEscape(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

export function contactPayload(c: ContactInfo): string {
  const name = c.name.trim();
  const parts = name.split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : name;
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${vEscape(last)};${vEscape(first)};;;`, `FN:${vEscape(name)}`];
  if (c.org) lines.push(`ORG:${vEscape(c.org)}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL:${c.phone.replace(/[^\d+]/g, '')}`);
  if (c.email) lines.push(`EMAIL:${c.email.trim()}`);
  if (c.url) lines.push(`URL:${normalizeUrl(c.url)}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

/** Short summary shown on receipts / labels. */
export function describePayload(text: string): string {
  if (text.startsWith('WIFI:')) {
    const m = /S:((?:\\.|[^;])*)/.exec(text);
    return 'Wi-Fi: ' + (m ? m[1].replace(/\\(.)/g, '$1') : 'network');
  }
  if (text.startsWith('BEGIN:VCARD')) {
    const m = /FN:(.*)/.exec(text);
    return 'Contact: ' + (m ? m[1] : 'card');
  }
  if (/#v1\./.test(text)) return 'Pixel postcard';
  if (/^https?:\/\//i.test(text)) return text.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 40);
  return text.slice(0, 40);
}
