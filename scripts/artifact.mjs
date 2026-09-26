// Turns the single-file build (dist-single/index.html) into a page fragment for hosted previews
// that wrap content in their own <html>/<head>/<body> skeleton.
// Usage: node scripts/artifact.mjs [out.html]
import fs from 'fs';

const src = fs.readFileSync('dist-single/index.html', 'utf8');
const out = process.argv[2] ?? 'dist-single/qr-market-fragment.html';
const title = /<title>([\s\S]*?)<\/title>/.exec(src)?.[1] ?? 'Xolotl Kobini';
const styles = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
const scripts = [...src.matchAll(/<script type="module"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (!scripts.length) throw new Error('No inline module script found. Run `npm run build:single` first.');
const body = /<body>([\s\S]*?)<\/body>/.exec(src)?.[1].replace(/<script[\s\S]*?<\/script>/g, '').trim() ?? '<div id="app"></div>';
const html = [
  `<title>${title}</title>`,
  `<meta name="description" content="A cosy 3D pixel-art convenience store run by an axolotl in a shark mech, where every snack turns your link, photo or video into a QR code.">`,
  ...styles.map((s) => `<style>${s}</style>`),
  body,
  ...scripts.map((s) => `<script type="module">${s.replace(/<\/script/g, '<\\/script')}</script>`),
].join('\n');
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
