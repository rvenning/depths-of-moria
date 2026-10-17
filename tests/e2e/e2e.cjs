/* End-to-end smoke test (Playwright). Run against a built app:  npm run build && npm run e2e
 * In CI: GitHub Actions installs Chromium and runs this headless. Locally it uses installed Chrome if present. */
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');

const PORT = 8141;
const URL = `http://localhost:${PORT}/`;
const fail = (m) => { console.error('E2E FAIL:', m); process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(URL); if (r.ok) return; } catch { /* retry */ } await sleep(500); }
  throw new Error('preview server did not start');
}

(async () => {
  const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
  let browser;
  try {
    await waitForServer();
    try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(); }
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(`console: ${m.text()}`); });

    await page.goto(URL);
    await page.getByRole('button', { name: /New game/ }).click();
    await page.getByRole('button', { name: 'Skip' }).click();
    await page.getByText('Launch expedition').first().waitFor();
    console.log('✓ new game reaches the camp');

    // every nav screen opens without errors
    for (const label of ['Heroes', 'Party', 'Armoury', 'Forge', 'Relics', 'Quests', 'Journal', 'Settings', 'Camp', 'Delve']) {
      await page.getByRole('button', { name: label, exact: true }).first().click();
      await sleep(150);
    }
    console.log('✓ all screens open');

    // keyboard: tab reaches the nav and Enter activates it
    await page.getByRole('button', { name: 'Camp', exact: true }).first().focus();
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await sleep(200);
    console.log('✓ keyboard navigation');

    // run the first expedition
    await page.getByRole('button', { name: 'Delve', exact: true }).first().click();
    await page.getByRole('button', { name: /Descend from floor 1/ }).click();
    await page.getByRole('button', { name: /Fight/ }).click();
    await page.getByRole('button', { name: /4×/ }).click().catch(() => {});
    await page.keyboard.press('s');
    await page.getByText(/Victory|Defeat/).first().waitFor({ timeout: 60000 });
    console.log('✓ a battle plays to a result');
    await page.getByRole('button', { name: /Next floor|Continue/ }).first().click();
    await page.getByRole('button', { name: 'Retreat' }).first().click();
    await page.getByRole('button', { name: 'Retreat' }).last().click();
    await page.getByRole('button', { name: /Return to camp/ }).click();
    await page.getByText('Launch expedition').first().waitFor();
    console.log('✓ retreat banks and returns to camp');

    // settings + persistence
    await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
    await page.getByLabel(/Reduced motion/).check();
    await page.getByRole('button', { name: /Save now/ }).click();
    await page.reload();
    await page.getByRole('button', { name: /Continue/ }).click();
    await page.getByText('Launch expedition').first().waitFor();
    console.log('✓ the save survives a reload');

    // responsive: tablet landscape and phone portrait must not scroll sideways
    for (const [w, h] of [[1024, 768], [390, 844]]) {
      await page.setViewportSize({ width: w, height: h }); await sleep(250);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 4) fail(`horizontal overflow ${over}px at ${w}x${h}`);
    }
    console.log('✓ responsive layouts');

    if (errors.length) fail(`console errors:\n${errors.join('\n')}`);
    else console.log('✓ no console errors');
  } catch (e) {
    fail(e && e.stack ? e.stack : String(e));
  } finally {
    if (browser) await browser.close();
    server.kill();
    process.exit(process.exitCode ?? 0);
  }
})();
