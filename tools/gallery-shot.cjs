const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  for (const g of process.argv.slice(3)) {
    await p.goto('http://localhost:8140/?g=' + Date.now() + '#gallery/' + g); await p.reload();
    await p.waitForTimeout(2500);
    await p.screenshot({ path: process.argv[2] + '/g-' + g + '.png', fullPage: true });
  }
  await b.close();
})();
