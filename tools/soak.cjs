/* Soak test: auto-delve through many floors at 4x in real headless Chrome and watch for the things that go wrong in long sessions —
 * a floor that never starts, errors, a growing heap or texture count, a falling frame rate, a lost graphics context.
 * node tools/soak.cjs [minutes=6] [startFloor=1] [level=18]    (needs the dev server on :8140) */
const { chromium } = require('playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const minutes = Number(process.argv[2] || 6), startFloor = Number(process.argv[3] || 1), level = Number(process.argv[4] || 18);
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-precise-memory-info'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [], failed = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200) + ' @ ' + String(e.stack).split(String.fromCharCode(10)).slice(1, 5).join(' | ').slice(0, 500)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  page.on('requestfailed', (r) => failed.push(r.url().slice(-80)));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url().slice(-80)); });
  await page.goto('http://localhost:8140/?soak=' + Date.now());
  await page.waitForFunction(() => window.__dom && window.__dom.loaded);
  await page.evaluate(async ([startFloor, level]) => {
    const d = window.__dom; const g = await import('/src/core/game.ts'); const x = await import('/src/core/expedition.ts');
    d.startNew(11);
    d.mutate((s) => {
      s.flags.prologue = 1; for (const h of ['gimli', 'frodo', 'legolas', 'sam', 'boromir', 'gandalf']) g.unlockHero(s, h);
      s.party = ['gimli', 'aragorn', 'boromir', 'legolas', 'gandalf']; for (const h of Object.keys(s.heroes)) s.heroes[h].level = level;
      s.best = 999; s.age = Math.min(10, Math.floor((startFloor - 1) / 100) + 1); s.settings.speed = 4; s.settings.autoDelve = true; s.settings.skipStories = true;
    });
    d.mutate((s) => { x.startExpedition(s, 1); s.expedition.floor = startFloor; x.enterFloor(s); });
    d.go('expedition');
  }, [startFloor, level]);
  const sample = () => page.evaluate(() => {
    const ph = window.__phaser, e = window.__dom.state.expedition;
    const m = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1;
    return {
      floor: e ? e.floor : null, phase: e ? e.phase : null, heapMB: m,
      textures: ph ? Object.keys(ph.game.textures.list).length : -1,
      objects: ph && ph.scene.children ? ph.scene.children.length : -1,
      tweens: ph && ph.scene.tweens ? ph.scene.tweens.getTweens().length : -1,
      canvases: document.querySelectorAll('canvas').length, nodes: document.getElementsByTagName('*').length,
      fps: ph ? Math.round(ph.game.loop.actualFps) : -1, screen: window.__dom.state.screen ?? '', gl: ph && ph.game.renderer && ph.game.renderer.gl ? (ph.game.renderer.gl.isContextLost() ? 'LOST' : 'ok') : '?',
    };
  });
  // answer the prompts a player would: doors, events (and their outcomes), rest rooms
  const act = () => page.evaluate(() => {
    const ov = document.querySelector('.overlay-center'); if (!ov) return;
    const pick = (sel) => { const b = [...ov.querySelectorAll(sel)].find((x) => !x.disabled); if (b) { b.click(); return true; } return false; };
    if (pick('button.panel.flat')) return;                                   // doors
    if (pick('.btn.primary') && !/Fight/.test(ov.textContent || '')) return;  // event outcome, rest
    if (!/Fight/.test(ov.textContent || '')) pick('.col .btn');               // event choices
  }).catch(() => {});
  let last = { floor: -1 }, stuckSince = Date.now(); const rows = [], t0 = Date.now();
  while (Date.now() - t0 < minutes * 60000) {
    for (let i = 0; i < 5; i++) { await sleep(1000); await act(); }
    let s; try { s = await sample(); } catch (e) { console.log('sample failed', e.message.slice(0, 120)); break; }
    rows.push(s);
    if (s.floor !== last.floor || s.phase !== last.phase) stuckSince = Date.now();
    const stuck = Math.round((Date.now() - stuckSince) / 1000);
    console.log(`t+${String(Math.round((Date.now() - t0) / 1000)).padStart(3)}s floor ${s.floor} ${s.phase} heap ${s.heapMB}MB tex ${s.textures} obj ${s.objects} tw ${s.tweens} cv ${s.canvases} dom ${s.nodes} fps ${s.fps} gl ${s.gl}${stuck > 40 ? '  STUCK ' + stuck + 's' : ''}`);
    if (stuck > 90) { console.log('STUCK: dumping'); await page.screenshot({ path: '.scratch/soak-stuck.png' }); break; }
    last = s;
  }
  console.log('floors:', rows.length ? `${rows[0].floor} -> ${rows[rows.length - 1].floor}` : '-', '| errors', errors.length, [...new Set(errors)].slice(0, 6), '| failed', [...new Set(failed)].slice(0, 6));
  await browser.close();
})();
