/* The version badge against a production build served by `vite preview` (port 8190): latest, then update available (version.json made newer), then Reload to update.
 * node tools/version-check.cjs */
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const read = async () => page.evaluate(() => [...document.querySelectorAll('.chip, .tiny.dim, button.btn.small')].map((e) => e.textContent.trim()).filter((t) => /v\d|latest|update|check|Reload/.test(t)));
  await page.goto('http://localhost:8190/'); await page.waitForSelector('.title'); await sleep(1500);
  console.log('title, current build   :', JSON.stringify(await read()));
  await page.screenshot({ path: '.scratch/ver-title-latest.png' });
  // pretend the server has a newer build
  const vp = 'dist/version.json'; const orig = fs.readFileSync(vp, 'utf8'); const v = JSON.parse(orig);
  fs.writeFileSync(vp, JSON.stringify({ ...v, built: '2099-01-01T00:00:00.000Z', sha: 'newer01', version: '1.2.0' }));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(1200);
  console.log('title, newer on server :', JSON.stringify(await read()));
  await page.screenshot({ path: '.scratch/ver-title-update.png' });
  fs.writeFileSync(vp, orig);
  // into the game: the compact badge in the top bar
  await page.getByRole('button', { name: /New game/ }).click(); await sleep(1500);
  console.log('in game, top bar       :', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.topbar .chip')].map((e) => e.textContent.trim()))));
  await page.screenshot({ path: '.scratch/ver-camp.png' });
  console.log('errors', errs);
  await b.close();
})();
