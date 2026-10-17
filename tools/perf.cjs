/* FPS probe: runs a boss fight at 4x in real headless Chrome and samples Phaser's frame rate. */
const { chromium } = require('playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://localhost:8140/?perf=' + Date.now());
  await page.waitForFunction(() => window.__dom && window.__dom.loaded);
  await page.evaluate(async () => {
    const d = window.__dom; const g = await import('/src/core/game.ts'); const x = await import('/src/core/expedition.ts');
    d.startNew(5); d.mutate((s) => { s.flags.prologue = 1; for (const h of ['gimli', 'frodo', 'legolas', 'sam', 'boromir', 'gandalf']) g.unlockHero(s, h); s.age = 5; s.best = 499; s.party = ['gimli', 'aragorn', 'boromir', 'legolas', 'sam']; for (const h of ['aragorn', 'gimli', 'frodo', 'legolas', 'sam', 'boromir', 'gandalf']) s.heroes[h].level = 60; });
    d.mutate((s) => { x.startExpedition(s, 491); s.expedition.floor = 500; x.enterFloor(s); s.settings.speed = 4; }); d.go('expedition');
  });
  await sleep(1500); await page.keyboard.press('Enter'); await page.keyboard.press('3');
  const samples = [];
  for (let i = 0; i < 12; i++) { await sleep(1000); samples.push(await page.evaluate(() => Math.round(window.__phaser.game.loop.actualFps))); }
  const mem = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1);
  console.log('fps samples', samples.join(' '), '| heap MB', mem);
  await browser.close();
})();
