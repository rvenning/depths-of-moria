const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8140/?c=' + Date.now());
  await p.waitForFunction(() => window.__dom && window.__dom.loaded);
  await p.evaluate(() => { const d = window.__dom; d.startNew(7); d.mutate((s) => { s.flags.prologue = 0; }); d.go('camp'); });
  await p.waitForTimeout(2200);
  await p.screenshot({ path: process.argv[2] + '/prologue.png' });
  await p.keyboard.press('Enter'); await p.waitForTimeout(300); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
  await p.screenshot({ path: process.argv[2] + '/prologue2.png' });
  console.log('errors', errs);
  await b.close();
})();
