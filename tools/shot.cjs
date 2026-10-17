/* Visual capture helper (dev only): node tools/shot.cjs <scenario> <outDir>
 * Drives the dev server (port 8140) in real headless Chrome so animation runs at a true frame rate. */
const { chromium } = require('playwright-core');
const path = require('node:path');
const fs = require('node:fs');

const scenario = process.argv[2] || 'battle';
const out = process.argv[3] || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8140/?shot=' + Date.now());
  await page.waitForFunction(() => window.__dom && window.__dom.loaded);
  const shot = (name) => page.screenshot({ path: path.join(out, name + '.png') });
  const setup = (js) => page.evaluate(js);

  await setup(() => { const d = window.__dom; d.startNew(99); d.mutate((s) => { s.flags.prologue = 1; }); });

  if (scenario === 'battle') {
    await setup(async () => {
      const d = window.__dom; const m = await import('/src/core/game.ts');
      d.mutate((s) => { m.unlockHero(s, 'gimli'); m.unlockHero(s, 'frodo'); s.party = ['gimli', 'aragorn', null, 'frodo', null]; for (const h of ['aragorn', 'gimli', 'frodo']) s.heroes[h].level = 8; });
      const x = await import('/src/core/expedition.ts');
      d.mutate((s) => x.startExpedition(s, 1)); d.go('expedition');
    });
    await sleep(1500); await shot('01-intro');
    await page.keyboard.press('Enter');
    for (let i = 0; i < 8; i++) { await sleep(900); await shot(`02-fight-${i}`); }
  } else if (scenario === 'boss') {
    await setup(async () => {
      const d = window.__dom; const g = await import('/src/core/game.ts'); const x = await import('/src/core/expedition.ts');
      d.mutate((s) => { for (const h of ['gimli', 'frodo', 'legolas', 'sam']) g.unlockHero(s, h); s.party = ['gimli', 'aragorn', null, 'legolas', 'sam']; for (const h of ['aragorn', 'gimli', 'frodo', 'legolas', 'sam']) s.heroes[h].level = 20; s.best = 99; });
      d.mutate((s) => { x.startExpedition(s, 91); s.expedition.floor = 100; x.enterFloor(s); }); d.go('expedition');
    });
    await sleep(1500); await shot('01-boss-intro');
    await page.keyboard.press('Enter');
    for (let i = 0; i < 10; i++) { await sleep(500); await shot(`02-boss-${i}`); }
  } else if (scenario === 'tour') {
    await setup(async () => {
      const d = window.__dom; const g = await import('/src/core/game.ts'); const x = await import('/src/core/expedition.ts'); const l = await import('/src/core/loot.ts'); const r = await import('/src/core/rng.ts');
      d.mutate((s) => {
        for (const h of ['gimli', 'frodo', 'legolas', 'sam']) g.unlockHero(s, h);
        s.age = 3; s.best = 250; s.gold = 20000; s.ore = 300; s.cloth = 300; s.essence = 200; s.renown = 30; s.shards = 4;
        for (const h of ['aragorn', 'gimli', 'frodo', 'legolas', 'sam']) s.heroes[h].level = 24;
        const rng = new r.Rng(5);
        for (let i = 0; i < 40; i++) s.inventory.push(l.makeItem(s, rng, { floor: 220, tier: 3, rarity: l.rollRarity(rng, 0.3) }));
        g.autoEquipAll(s); g.refreshShop(s, true);
        s.bonds['aragorn+gimli'] = 140; s.bonds['frodo+sam'] = 400; s.bonds['aragorn+legolas'] = 60;
        s.lore.push('lore-1-a', 'lore-1-b', 'lore-2-a'); s.codex['goblin-skirmisher'] = { seen: 5, kills: 4 }; s.codex['cave-bat'] = { seen: 2, kills: 2 };
        s.relics.light = 12; s.relics.horn = 7; s.camp.age.whetstone = 4;
      });
    });
    for (const sc of ['camp', 'roster', 'party', 'armoury', 'forge', 'shrine', 'map', 'journal', 'quests', 'settings']) {
      await setup((n) => { window.__dom.go(n); }, sc).catch(() => {});
      await page.evaluate((n) => window.__dom.go(n), sc);
      await sleep(700); await shot('tour-' + sc);
    }
    await page.evaluate(() => window.__dom.go('journal', 'bonds')); await sleep(600); await shot('tour-bonds');
  } else if (scenario === 'rooms') {
    const jump = async (tag) => page.evaluate(async (tag) => {
      const d = window.__dom; const g = await import('/src/core/game.ts'); const x = await import('/src/core/expedition.ts'); const f = await import('/src/core/floors.ts');
      if (!d.state.expedition) { d.mutate((s) => { for (const h of ['gimli', 'frodo']) g.unlockHero(s, h); s.best = 99; s.party = ['gimli', 'aragorn', null, 'frodo', null]; x.startExpedition(s, 91); }); }
      let fl = 0; for (let i = 1; i < 100; i++) if (f.planFloor(i, d.state.seed ^ 0, 3).tag === tag) { fl = i; break; }
      return fl;
    }, tag);
    await setup(async () => { const d = window.__dom; const g = await import('/src/core/game.ts'); const x = await import('/src/core/expedition.ts'); d.mutate((s) => { for (const h of ['gimli', 'frodo']) g.unlockHero(s, h); s.best = 99; s.party = ['gimli', 'aragorn', null, 'frodo', null]; x.startExpedition(s, 91); s.expedition.floor = 25; x.enterFloor(s); }); d.go('expedition'); });
    await sleep(1200); await shot('10-event');
    await page.getByRole('button').filter({ hasText: /Search|Rest|Drink|Pry|Bury|Look/ }).first().click().catch(() => {});
    await sleep(700); await shot('11-event-result');
    await setup(async () => { const d = window.__dom; const x = await import('/src/core/expedition.ts'); const f = await import('/src/core/floors.ts'); let door = 0, rest = 0; for (let i = 4; i < 100; i++) { const t = f.planFloor(i, d.state.seed ^ 0, 3).tag; if (t === 'door' && !door) door = i; if (t === 'rest' && !rest) rest = i; } window.__rooms = { door, rest }; });
    void jump;
    await sleep(200);
  } else if (scenario === 'descent') {
    await setup(async () => { const d = window.__dom; const g = await import('/src/core/game.ts'); d.mutate((s) => { for (const h of ['gimli', 'frodo']) g.unlockHero(s, h); s.best = 100; s.gold = 5400; s.ore = 20; s.camp.age.whetstone = 6; }); d.go('camp'); });
    await sleep(1200); await shot('20-camp-descend');
    await page.getByRole('button', { name: /descend to Age 2/ }).click();
    await sleep(700); await shot('21-descent-modal');
    await page.evaluate(() => window.__dom.go('ending')); await sleep(900); await shot('22-ending-1');
    await page.getByRole('button', { name: 'Continue' }).click(); await sleep(600); await shot('23-ending-2');
  } else if (scenario === 'mobile') {
    for (const [name, w, h] of [['phone', 390, 844], ['ipad', 1024, 768], ['phone-land', 844, 390]]) {
      await page.setViewportSize({ width: w, height: h });
      await setup(async () => { const d = window.__dom; const g = await import('/src/core/game.ts'); d.mutate((s) => { for (const x of ['gimli', 'frodo']) g.unlockHero(s, x); }); d.go('camp'); });
      await sleep(700); await shot(name + '-camp');
      await page.evaluate(() => window.__dom.go('roster')); await sleep(500); await shot(name + '-roster');
      await setup(async () => { const d = window.__dom; const x = await import('/src/core/expedition.ts'); d.mutate((s) => { x.startExpedition(s, 1); }); d.go('expedition'); });
      await sleep(1200); await shot(name + '-battle');
      await setup(async () => { const d = window.__dom; const x = await import('/src/core/expedition.ts'); d.mutate((s) => { x.retreat(s); x.bankExpedition(s); }); d.go('camp'); });
    }
  } else {
    await sleep(500); await shot('title');
  }
  console.log('errors:', JSON.stringify(errors.slice(0, 5)));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
