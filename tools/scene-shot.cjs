/* Open a bond scene in the Journal and screenshot it at a few viewports, with every line fully typed. node tools/scene-shot.cjs [outDir] */
const { chromium } = require('playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const out = process.argv[2] || '.scratch/scene'; require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const sizes = [[1280, 720], [390, 844], [820, 1180], [1920, 1080]];
  for (const [w, h] of sizes) {
    const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
    await page.goto('http://localhost:8140/?scene=' + Date.now());
    await page.waitForFunction(() => window.__dom && window.__dom.loaded);
    await page.evaluate(async () => {
      const d = window.__dom; const g = await import('/src/core/game.ts');
      d.startNew(99); d.mutate((s) => { s.flags.prologue = 1; for (const h of ['gimli', 'frodo', 'legolas', 'sam']) g.unlockHero(s, h); s.bonds['aragorn+gimli'] = 400; s.bonds['frodo+sam'] = 400; });
      d.go('journal', 'bonds');
    });
    await sleep(600);
    const btn = page.getByRole('button', { name: /^[123]$|Scene|Watch|Replay/ }).first();
    const scene = await page.locator('.btn.small:not([disabled])').filter({ hasText: /./ }).evaluateAll((els) => els.map((e) => e.textContent));
    // open the first enabled scene button inside a bond card
    const opened = await page.evaluate(() => { const b = [...document.querySelectorAll('button.btn.small')].find((x) => !x.disabled && /^\s*(1|2|3|I|II|III|Scene)/.test(x.textContent || '')); if (b) { b.click(); return b.textContent; } return null; });
    await sleep(400);
    const has = await page.locator('.cutscene').count();
    if (!has) { console.log(w + 'x' + h, 'no scene opened', opened, scene.slice(0, 6)); await page.screenshot({ path: `${out}/nojournal-${w}.png` }); await page.close(); continue; }
    // type out each line fully and capture; report overflow of the name tag and text box
    for (let n = 0; n < 3; n++) {
      await page.keyboard.press('Enter'); await sleep(150);
      const m = await page.evaluate(() => {
        const q = (s) => document.querySelector(s); const box = q('.cs-box'), name = q('.cs-name'), text = q('.cs-text');
        const bb = box.getBoundingClientRect(), nb = name ? name.getBoundingClientRect() : null, tb = text.getBoundingClientRect();
        return { box: [Math.round(bb.top), Math.round(bb.bottom)], nameTop: nb ? Math.round(nb.top) : null, textBottom: Math.round(tb.bottom), vh: innerHeight, textScroll: [text.scrollHeight, text.clientHeight], boxScroll: [box.scrollHeight, box.clientHeight] };
      });
      console.log(w + 'x' + h, 'line', n, JSON.stringify(m));
      await page.screenshot({ path: `${out}/scene-${w}-${n}.png` });
      await page.keyboard.press('Enter'); await sleep(150);
    }
    await page.close();
  }
  await browser.close();
})();
