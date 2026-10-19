/* A chapter-1 battle on a 'hall' floor: screenshots mid-fight and the frame rate. node tools/bdshot.cjs [outDir] [variant] */
const { chromium } = require('playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const out = process.argv[2] || '.scratch/bd'; const variant = process.argv[3] || 'hall'; const chapter = Number(process.argv[4] || 1);
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8140/?bd=' + Date.now());
  await page.waitForFunction(() => window.__dom && window.__dom.loaded);
  const floor = await page.evaluate(async ([variant, chapter]) => {
    const d = window.__dom; const g = await import('/src/core/game.ts'); const x = await import('/src/core/expedition.ts'); const f = await import('/src/core/floors.ts');
    d.startNew(5); d.mutate((s) => { s.flags.prologue = 1; for (const h of ['gimli', 'frodo', 'legolas', 'sam', 'boromir', 'gandalf']) g.unlockHero(s, h); s.party = ['gimli', 'aragorn', 'boromir', 'legolas', 'gandalf']; for (const h of ['aragorn', 'gimli', 'frodo', 'legolas', 'sam', 'boromir', 'gandalf']) s.heroes[h].level = 14; s.best = 999; s.age = chapter; });
    let fl = 0; for (let i = (chapter - 1) * 100 + 2; i <= chapter * 100; i++) { const p = f.planFloor(i, d.state.seed, 5); if (p.bg === variant && p.tag !== 'event' && p.tag !== 'rest' && p.tag !== 'door' && !p.doorChoices) { fl = i; break; } }
    d.mutate((s) => { x.startExpedition(s, 1); s.expedition.floor = fl; x.enterFloor(s); s.settings.speed = 1; }); d.go('expedition');
    return fl;
  }, [variant, chapter]);
  console.log('floor', floor);
  await sleep(1500); await page.keyboard.press('Enter'); await sleep(300); await page.getByText('The Beaten Path').click({ timeout: 800 }).catch(() => {}); await page.keyboard.press('Enter');
  const fps = [];
  for (let i = 0; i < 6; i++) { await sleep(1200); fps.push(await page.evaluate(() => Math.round(window.__phaser.game.loop.actualFps))); if (i === 1 || i === 3) await page.screenshot({ path: `${out}/${variant}-c${chapter}-${i}.png` }); }
  console.log('fps', fps.join(' '), 'errors', errors);
  await browser.close();
})();
