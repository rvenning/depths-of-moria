/* Lose the battle scene's WebGL context mid-expedition and check the stage rebuilds and the descent carries on.
 * node tools/ctxloss.cjs    (needs the dev server on :8140) */
const { chromium } = require('playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
  await page.goto('http://localhost:8140/?ctx=' + Date.now());
  await page.waitForFunction(() => window.__dom && window.__dom.loaded);
  await page.evaluate(async () => {
    const d = window.__dom; const g = await import('/src/core/game.ts'); const x = await import('/src/core/expedition.ts');
    d.startNew(11);
    d.mutate((s) => {
      s.flags.prologue = 1; for (const h of ['gimli', 'legolas', 'boromir', 'gandalf']) g.unlockHero(s, h);
      s.party = ['gimli', 'aragorn', 'boromir', 'legolas', 'gandalf']; for (const h of Object.keys(s.heroes)) s.heroes[h].level = 18;
      s.best = 999; s.age = 1; s.settings.speed = 2; s.settings.autoDelve = true; s.settings.skipStories = true;
    });
    d.mutate((s) => { x.startExpedition(s, 1); x.enterFloor(s); });
    d.go('expedition');
  });
  const act = () => page.evaluate(() => {
    const ov = document.querySelector('.overlay-center'); if (!ov) return;
    const pick = (sel) => { const b = [...ov.querySelectorAll(sel)].find((x) => !x.disabled); if (b) { b.click(); return true; } return false; };
    if (pick('button.panel.flat')) return;
    if (pick('.btn.primary') && !/Fight/.test(ov.textContent || '')) return;
    if (!/Fight/.test(ov.textContent || '')) pick('.col .btn');
  }).catch(() => {});
  const snap = () => page.evaluate(() => { const ph = window.__phaser, e = window.__dom.state.expedition; return { floor: e && e.floor, tex: ph ? Object.keys(ph.game.textures.list).length : -1, gl: ph && ph.game.renderer.gl ? (ph.game.renderer.gl.isContextLost() ? 'LOST' : 'ok') : '?', toasts: window.__dom.toasts.map((t) => t.text) }; });
  for (let i = 0; i < 10; i++) { await sleep(1000); await act(); }
  const before = await snap(); console.log('before ', JSON.stringify(before));
  const old = await page.evaluate(() => { const gl = window.__phaser.game.renderer.gl; gl.getExtension('WEBGL_lose_context').loseContext(); return 'lost'; });
  console.log('context', old);
  let after;
  for (let i = 0; i < 24; i++) { await sleep(1000); await act(); after = await snap(); if (i === 3 || i === 23) console.log(`+${i + 1}s   `, JSON.stringify(after)); }
  console.log(after.floor > before.floor && after.gl === 'ok' && after.tex > 20 ? 'RECOVERED' : 'NOT RECOVERED', '| errors', errors);
  await page.screenshot({ path: '.scratch/ctxloss.png' });
  await browser.close();
})();
