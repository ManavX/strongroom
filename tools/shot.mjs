// Headless screenshot helper for visual review.
//   node tools/shot.mjs "<path?query>" <out.png> [width] [height] [waitMs]
// Requires the dev server (npm run dev) and a local Chrome install.
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [, , target = '/lab.html', out = 'shot.png', w = '1600', h = '900', wait = '0'] = process.argv;
const base = process.env.SHOT_BASE ?? 'http://127.0.0.1:5183';
const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) {
  console.error('No Chrome found. Set CHROME_PATH.');
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--hide-scrollbars', '--mute-audio', `--window-size=${w},${h}`],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warning' || process.env.SHOT_VERBOSE) console.log(`[${t}] ${m.text()}`);
  });
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
  const url = target.startsWith('http') ? target : base + target;
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__ready === true', { timeout: 90000 });
  // SHOT_EVAL: JavaScript run in the page after it is ready (drive the UI before capturing).
  if (process.env.SHOT_EVAL) {
    const res = await page.evaluate(process.env.SHOT_EVAL);
    if (res !== undefined) console.log('[eval]', typeof res === 'string' ? res : JSON.stringify(res));
  }
  if (+wait > 0) await new Promise((r) => setTimeout(r, +wait));
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out, type: 'png' });
  const hud = await page.evaluate(() => document.getElementById('hud')?.textContent ?? '');
  console.log(`saved ${out}${hud ? `  |  ${hud}` : ''}`);
} finally {
  await browser.close();
}
