/* Does the game play the sampled track (and fall back to the synth when it cannot)? Headless Chrome has no audio output. */
const { chromium } = require('playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8140/?sp=' + Date.now()); await p.waitForFunction(() => window.__dom && window.__dom.loaded);
  const res = await p.evaluate(async () => {
    const { audio } = await import('/src/audio/audio.ts');
    audio.ensure(); audio.resume();
    const an = audio.ctx.createAnalyser(); an.fftSize = 2048; audio.musicBus.connect(an);
    const level = () => { const d = new Float32Array(2048); an.getFloatTimeDomainData(d); return Math.sqrt(d.reduce((a, x) => a + x * x, 0) / d.length); };
    const out = {};
    audio.playMusic(1, 'battle'); await new Promise((r) => setTimeout(r, 2500));
    out.sampled = !!audio.sampled; out.synthTimer = !!audio.timer; out.level = +level().toFixed(4);
    audio.setSampled(false); await new Promise((r) => setTimeout(r, 1500));
    out.afterToggle = { sampled: !!audio.sampled, synthTimer: !!audio.timer, level: +level().toFixed(4) };
    audio.setSampled(true); await new Promise((r) => setTimeout(r, 2500));
    out.back = { sampled: !!audio.sampled, synthTimer: !!audio.timer };
    audio.playMusic(7, 'boss'); await new Promise((r) => setTimeout(r, 2500));
    out.boss7 = { sampled: !!audio.sampled, level: +level().toFixed(4) };
    return out;
  });
  console.log(JSON.stringify(res), 'errors', errs);
  await b.close();
})();
