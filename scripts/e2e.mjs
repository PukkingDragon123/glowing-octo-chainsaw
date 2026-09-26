// End-to-end scan check: opens every product, plays its reveal, switches to scan mode and verifies
// that the QR decodes from the rendered 3D frame and from the exported poster.
// Usage: node scripts/e2e.mjs [baseUrl] [--products a,b] [--shots dir]
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/';
const only = (args[args.indexOf('--products') + 1] || '').split(',').filter((s) => args.includes('--products') && s);
const shotDir = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });

const LONG = 'https://example.com/a/fairly/long/link/to/test/density?utm_source=qrmarket&utm_medium=qr';

const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => window.__app, null, { timeout: 60000 });
await page.evaluate(() => window.__app.state.unlock('*'));
const ids = await page.evaluate(() => window.__app.products.map((p) => p.id));
const list = only.length ? ids.filter((i) => only.includes(i)) : ids;

const results = [];
for (const id of list) {
  const flavors = await page.evaluate((pid) => window.__app.products.find((p) => p.id === pid).flavors.map((f) => f.id), id);
  const pref = await page.evaluate((pid) => window.__app.products.find((p) => p.id === pid).preferredMode ?? '', id);
  // only the first flavor is used in the game now; test short, long and (thorough) extra sizes
  const runs = [['short', 'https://qr.market/'], ['long', LONG]];
  if (args.includes('--thorough')) {
    runs.push(['v3', 'https://example.com/a/fairly/long/link/to/test/density?utm_source=qrmarket']);
    runs.push(['v4', 'https://pukkingdragon123.github.io/glowing-octo-chainsaw/']);
    runs.push(['text', 'Hello from Xolotl Kobini! Pay me a visit, the axolotl says hi.']);
  }
  // photo/video-first products also get a real pixel postcard / flipbook (a much denser code)
  if (pref === 'image') runs.push(['art', '@art1']);
  if (pref === 'video') runs.push(['art', '@art6']);
  for (const [k, text] of runs) {
    const flavor = flavors[0];
    const r = await page.evaluate(
      async ({ pid, fid, text }) => {
        const a = window.__app;
        await a.quickOpen(pid, fid);
        // let any content refresh triggered by opening (e.g. photo-first products) settle first
        await new Promise((res) => setTimeout(res, 400));
        if (text.startsWith('@art')) await a.useDemoArt(Number(text.slice(4)));
        else a.setQR(text, 'test');
        a.reveal();
        await a.advance(15);
        a.toggleFocus(true);
        await a.advance(1.4);
        await new Promise((res) => setTimeout(res, 900));
        const view = a.scanView();
        const poster = a.posterScan();
        return { view: view === a.qr.text, poster: poster.ok, version: a.qr.version };
      },
      { pid: id, fid: flavor, text },
    );
    if (shotDir) await page.screenshot({ path: `${shotDir}/${id}-${flavor}-${k}.png` });
    results.push({ id, flavor, k, ...r });
    console.log(`${r.view && r.poster ? 'PASS' : 'FAIL'}  ${id.padEnd(16)} ${flavor.padEnd(12)} ${k.padEnd(5)} v${String(r.version).padEnd(3)} 3D:${r.view ? 'ok ' : 'NO '} poster:${r.poster ? 'ok' : 'NO'}`);
  }
}
await browser.close();
const failed = results.filter((r) => !r.view || !r.poster);
if (errors.length) console.log('page errors:\n' + [...new Set(errors)].join('\n'));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length || errors.length ? 1 : 0);
