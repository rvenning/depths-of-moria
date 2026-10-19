const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  await p.goto('http://localhost:8140/?v=' + Date.now() + '#gallery/' + (process.argv[2] || 'atk').replace('.', '/'));
  await p.waitForTimeout(2500);
  await p.screenshot({ path: process.argv[3] || 'tools/atk-sheet.png', fullPage: true });
  await b.close();
})();
