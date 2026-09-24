// Upload a photo through the Photo tab and confirm the code becomes a Pixel Postcard link that scans.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const [base = 'http://localhost:5173/', image = 'shots/t1.png', out = 'shots/upload.png'] = process.argv.slice(2);
const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base);
await page.waitForFunction(() => window.__app);
await page.evaluate(() => window.__app.quickOpen('pixel-postcard'));
await page.click('.tab:has-text("Photo")');
await page.setInputFiles('.drop input[type=file]', image);
await page.waitForFunction(() => window.__app.qr.text.includes('#v1.'), null, { timeout: 20000 });
const info = await page.evaluate(async () => {
  const a = window.__app;
  a.reveal();
  await a.advance(15);
  a.toggleFocus(true);
  await a.advance(1.4);
  await new Promise((r) => setTimeout(r, 900));
  return { len: a.qr.text.length, version: a.qr.version, view: a.scanView() === a.qr.text, poster: a.posterScan().ok, label: a.label };
});
await page.screenshot({ path: out });
console.log(JSON.stringify(info), errors.length ? 'ERRORS: ' + errors.join(' | ') : '');
await browser.close();
