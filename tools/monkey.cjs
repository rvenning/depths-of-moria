/* UI monkey test (dev only): clicks every safe button on every screen with a rich save and reports runtime errors.
 *   node tools/monkey.cjs      (needs the dev server on :8140 and Chrome)
 *   env: SCREENS=camp,roster  ONLY="regex of labels to click"  VERBOSE=1 */
const { chromium } = require('playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SKIP = /Delete|Import|New game|Replace|Retreat|Return to camp|Descend|Title screen|Fight|Skip|Credits|Reset|Respec|Salvage|Continue/i;
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const log = (...a) => { if (process.env.VERBOSE) console.log(...a); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('crash', () => { console.log('PAGE CRASHED'); });
  page.on('dialog', (d) => d.dismiss());
  await page.goto('http://localhost:8140/?monkey=' + Date.now());
  await page.waitForFunction(() => window.__dom && window.__dom.loaded);
  await page.evaluate(async () => {
    const d = window.__dom; const g = await import('/src/core/game.ts'); const l = await import('/src/core/loot.ts'); const r = await import('/src/core/rng.ts');
    d.startNew(31337);
    d.mutate((s) => {
      s.flags.prologue = 1;
      for (const h of ['gimli', 'frodo', 'legolas', 'sam', 'boromir', 'gandalf']) g.unlockHero(s, h);
      s.age = 9; s.best = 850; s.gold = 5e5; s.ore = 2000; s.cloth = 2000; s.essence = 5000; s.renown = 200; s.shards = 20;
      for (const h of ['aragorn', 'gimli', 'frodo', 'legolas', 'sam', 'boromir', 'gandalf']) s.heroes[h].level = 70;
      const rng = new r.Rng(3);
      for (let i = 0; i < 60; i++) s.inventory.push(l.makeItem(s, rng, { floor: 850, tier: 9, rarity: l.rollRarity(rng, 0.5) }));
      g.autoEquipAll(s); g.refreshShop(s, true);
      for (const a of ['aragorn', 'gimli', 'frodo', 'legolas', 'sam', 'boromir', 'gandalf']) for (const b of ['aragorn', 'gimli', 'frodo', 'legolas', 'sam', 'boromir', 'gandalf']) if (a < b) s.bonds[a + '+' + b] = 350;
      s.camp.account.presets = 2; s.camp.account.sorting = 1; s.camp.account.autosalvage = 1;
    });
  });
  const cdp = await page.context().newCDPSession(page); await cdp.send('Debugger.enable');
  let clicks = 0;
  const screens = (process.env.SCREENS || 'camp,roster,party,armoury,forge,shrine,map,journal,quests,settings').split(',');
  for (const screen of screens) {
    await page.evaluate((n) => window.__dom.go(n), screen);
    await sleep(500);
    const n = await page.locator('main button:visible').count();
    for (let i = 0; i < Math.min(n, 140); i++) {
      try {
        if (i >= await page.locator('main button:visible').count()) break; // the list can shrink (e.g. a slot filter)
        const btn = page.locator('main button:visible').nth(i);
        const label = await btn.evaluate((e) => ((e.innerText || '') + ' ' + (e.getAttribute('aria-label') || '')).trim());
        if (ONLY ? !ONLY.test(label) : SKIP.test(label)) continue;
        log('  click', JSON.stringify(label.slice(0, 50)));
        await btn.click({ timeout: 1500 }).catch(() => {});
        clicks++;
        if (await page.locator('.scrim').count()) await page.keyboard.press('Escape');
        await page.evaluate((n2) => { if (window.__dom.screen !== n2) window.__dom.go(n2); }, screen);
      } catch (e) {
        console.log(`!! ${screen} button ${i}: ${String(e.message).split('\n')[0]}`);
        await browser.close(); process.exit(2);
      }
    }
    console.log(screen.padEnd(9), 'buttons', n);
  }
  for (const [screen, arg] of [['journal', 'codex'], ['journal', 'items'], ['journal', 'bonds'], ['journal', 'records'], ['journal', 'achievements'], ['roster', 'gimli'], ['armoury', 'legolas']]) {
    await page.evaluate(([n, a]) => window.__dom.go(n, a), [screen, arg]); await sleep(300);
  }
  console.log('clicks', clicks, 'errors', errors.length);
  if (errors.length) console.log(errors.slice(0, 12).join('\n'));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
