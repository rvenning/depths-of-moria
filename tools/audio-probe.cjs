/* Audio level probe (dev only): plays each mood for a while and reports peak / RMS at the master bus. node tools/audio-probe.cjs */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:8140/?audio=' + Date.now());
  await p.waitForFunction(() => window.__dom && window.__dom.loaded);
  const out = await p.evaluate(async () => {
    const { audio } = await import('/src/audio/audio.ts');
    audio.resume(); const ctx = audio.ensure();
    const an = ctx.createAnalyser(); an.fftSize = 2048; audio.master.connect(an);
    const buf = new Float32Array(an.fftSize), res = [];
    for (const [ch, mood] of [[1, 'title'], [1, 'camp'], [1, 'battle'], [10, 'boss'], [6, 'camp'], [9, 'battle']]) {
      audio.stopMusic(); audio.playMusic(ch, mood);
      let peak = 0, sum = 0, n = 0; const t0 = performance.now();
      while (performance.now() - t0 < 9000) { await new Promise((r) => setTimeout(r, 50)); an.getFloatTimeDomainData(buf); for (const v of buf) { peak = Math.max(peak, Math.abs(v)); sum += v * v; n++; } }
      res.push({ ch, mood, state: ctx.state, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4) });
    }
    return res;
  });
  for (const r of out) console.log(JSON.stringify(r));
  await b.close();
})();
