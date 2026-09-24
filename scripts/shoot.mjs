// Screenshot helper for visual QA: node scripts/shoot.mjs <url> <out.png> [jsToEval] [waitMs] [w] [h]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const [url = 'http://localhost:5173/', out = 'shots/shot.png', js = '', wait = '1500', w = '1280', h = '720'] = process.argv.slice(2);
const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(800);
if (js) {
  try { const r = await page.evaluate(js); if (r !== undefined) console.log('eval:', JSON.stringify(r)); } catch (e) { console.log('eval error', e.message); }
}
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
console.log(logs.slice(-300).join('\n'));
await browser.close();
