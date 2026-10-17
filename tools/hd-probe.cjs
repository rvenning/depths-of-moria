/* HD-2D probing (dev only): node tools/hd-probe.cjs <outDir> '[["name","js to run in the page"], ...]' */
const { chromium } = require('playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 200)));
  await page.goto('http://localhost:8140/?probe=' + Date.now());
  await page.waitForFunction(() => window.__dom && window.__dom.loaded);
  await page.evaluate(() => { const d = window.__dom; d.startNew(99); d.mutate((s) => { s.flags.prologue = 1; }); });
  await page.evaluate(async () => {
    const d = window.__dom; const g = await import('/src/core/game.ts'); const x = await import('/src/core/expedition.ts');
    d.mutate((s) => { for (const h of ['gimli', 'frodo', 'legolas', 'sam']) g.unlockHero(s, h); s.party = ['gimli', 'aragorn', null, 'legolas', 'sam']; s.best = 99; });
    d.mutate((s) => { x.startExpedition(s, 91); s.expedition.floor = 100; x.enterFloor(s); }); d.go('expedition');
  });
  await sleep(1500); await page.keyboard.press('Enter'); await sleep(2000);
  const shots = process.argv[2];
  const steps = JSON.parse(process.argv[3]);
  for (const [name, js] of steps) {
    try { const r = await page.evaluate(js); console.log(name, 'ok', JSON.stringify(r)); } catch (e) { console.log(name, 'ERR', String(e.message).split('\n')[0]); }
    await sleep(500);
    await page.screenshot({ path: shots + '/' + name + '.png', clip: { x: 230, y: 56, width: 820, height: 410 } });
  }
  await browser.close();
})();
