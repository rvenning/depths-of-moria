/* HD-2D look tuning (dev only): node tools/hd-tune.cjs <outDir> ; captures the boss stage under several ambient/torch settings */
const { chromium } = require('playwright-core');
const path = require('node:path');
const fs = require('node:fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = process.argv[2] || '.';
const configs = JSON.parse(process.argv[3] || '[{"name":"a","ambient":"0xd8dafc","torch":1.5,"radius":1.35}]');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://localhost:8140/?tune=' + Date.now());
  await page.waitForFunction(() => window.__dom && window.__dom.loaded);
  await page.evaluate(() => { const d = window.__dom; d.startNew(99); d.mutate((s) => { s.flags.prologue = 1; }); });
  await page.evaluate(async () => {
    const d = window.__dom; const g = await import('/src/core/game.ts'); const x = await import('/src/core/expedition.ts');
    d.mutate((s) => { for (const h of ['gimli', 'frodo', 'legolas', 'sam']) g.unlockHero(s, h); s.party = ['gimli', 'aragorn', null, 'legolas', 'sam']; for (const h of ['aragorn', 'gimli', 'frodo', 'legolas', 'sam']) s.heroes[h].level = 20; s.best = 99; });
    d.mutate((s) => { x.startExpedition(s, 91); s.expedition.floor = 100; x.enterFloor(s); }); d.go('expedition');
  });
  await sleep(1500); await page.keyboard.press('Enter'); await sleep(2500);
  for (const c of configs) {
    await page.evaluate((c) => {
      const sc = window.__phaser.scene;
      sc.lights.setAmbientColor(Number(c.ambient));
      for (const l of sc.lightObjs) { l.base = c.torch; l.light.radius = l.light.radius0 ??= l.light.radius; l.light.radius = l.light.radius0 * c.radius; if (c.z) l.light.z = l.light.radius * c.z; }
    }, c);
    await sleep(400);
    await page.screenshot({ path: path.join(out, c.name + '.png'), clip: { x: 230, y: 56, width: 820, height: 410 } });
  }
  await browser.close();
})();
