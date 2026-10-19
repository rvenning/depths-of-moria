/* Checks the rendered music the way the game will use it: decode each file in Chrome, then measure dropouts, spectral balance,
 * duration, and whether the loop seam (the pre-roll vs the end of the loop) lines up. node tools/music/verify.cjs [file ...] */
const { chromium } = require('playwright-core');
const fs = require('node:fs');
(async () => {
  const manifest = JSON.parse(fs.readFileSync('public/music/manifest.json', 'utf8'));
  const keys = Object.keys(manifest).filter((k) => k !== 'encoderDelay');
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const p = await b.newPage();
  await p.goto('http://localhost:8140/?v=' + Date.now());
  const res = await p.evaluate(async ({ manifest, keys }) => {
    const ctx = new OfflineAudioContext(2, 44100, 44100), out = [];
    for (const k of keys) {
      const m = manifest[k];
      const buf = await ctx.decodeAudioData(await (await fetch('/music/' + m.file)).arrayBuffer());
      const L = buf.getChannelData(0), R = buf.getChannelData(1), sr = buf.sampleRate;
      // dropouts: RMS in half-second windows
      const win = Math.round(sr * 0.5), rms = [];
      for (let s = m.preroll; s + win < L.length - 3000; s += win) { let a = 0; for (let i = s; i < s + win; i++) a += L[i] * L[i] + R[i] * R[i]; rms.push(Math.sqrt(a / (2 * win))); }
      const sorted = [...rms].sort((x, y) => x - y), med = sorted[sorted.length >> 1], min = sorted[0];
      // seam: play the loop's wrap-around the way the game does (last samples of the body, then the first) and look for a click:
      // the biggest sample-to-sample jump across the join must be within the range the music itself reaches elsewhere,
      // and the level just before and after the join must match. (A waveform-phase comparison is meaningless here: reverb and
      // vibrato run free, so only a click or a level step can be heard.)
      const start = m.preroll + 1105, endI = start + m.length, jumps = [];
      for (let i = start + 2000; i < endI - 2000; i++) jumps.push(Math.abs(L[i + 1] - L[i]) + Math.abs(R[i + 1] - R[i]));
      jumps.sort((x, y) => x - y); const p999 = jumps[Math.floor(jumps.length * 0.999)] || 1e-9;
      let join = 0; for (let i = -16; i < 16; i++) { const x = i < 0 ? endI + i : start + i, y = i + 1 < 0 ? endI + i + 1 : start + i + 1; join = Math.max(join, Math.abs(L[y] - L[x]) + Math.abs(R[y] - R[x])); }
      const lvl = (from) => { let acc = 0; for (let i = 0; i < 2205; i++) acc += L[from + i] * L[from + i] + R[from + i] * R[from + i]; return Math.sqrt(acc / 4410); };
      const before = lvl(endI - 2205), after = lvl(start), step = Math.max(before, after) / Math.max(1e-9, Math.min(before, after));
      const best = join / p999, bestLag = +step.toFixed(2);
      // tuning: the offset of the semitone grid from A=440, found as the detune (cents) at which six seconds from the middle have the most energy on the grid
      const seg = Math.min(L.length - 1000, Math.round(sr * 6)), st = Math.max(m.preroll, Math.floor(L.length / 2 - seg / 2));
      let bestD = 0, bestE = -1;
      for (let d = -30; d <= 30; d += 10) {
        let e = 0;
        for (let midi = 40; midi < 76; midi++) {
          const f = 440 * Math.pow(2, (midi - 69) / 12 + d / 1200), w = (2 * Math.PI * f) / sr, co = 2 * Math.cos(w); let s1 = 0, s2 = 0;
          for (let i = 0; i < seg; i++) { const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / seg), x = (L[st + i] + R[st + i]) * 0.5 * hann + co * s1 - s2; s2 = s1; s1 = x; }
          e += s1 * s1 + s2 * s2 - co * s1 * s2;
        }
        if (e > bestE) { bestE = e; bestD = d; }
      }
      // spectrum via a 16384-point DFT of coarse bands (energy below 250 Hz, 250-2k, 2k-6k, above)
      const FFT = 4096, bands = [0, 0, 0, 0], mid = Math.floor(L.length / 2);
      for (let f = 1; f < FFT / 2; f += 2) {
        let re = 0, im = 0; const w = (2 * Math.PI * f) / FFT;
        for (let i = 0; i < FFT; i++) { const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FFT), v = L[mid + i] * hann; re += v * Math.cos(w * i); im -= v * Math.sin(w * i); }
        const hz = (f * sr) / FFT, e = re * re + im * im; bands[hz < 250 ? 0 : hz < 2000 ? 1 : hz < 6000 ? 2 : 3] += e;
      }
      const tot = bands.reduce((x, y) => x + y, 0) || 1;
      out.push({ k, secs: +(buf.duration).toFixed(2), expected: +((m.preroll + m.length) / sr + 0.03).toFixed(2), quietest: +(min / (med || 1)).toFixed(2), cents: bestD, seamCorr: +best.toFixed(2), delay: bestLag, spectrum: bands.map((x) => +(100 * x / tot).toFixed(0)) });
    }
    return out;
  }, { manifest, keys });
  let bad = 0;
  for (const r of res) {
    const issues = [];
    if (r.quietest < 0.15) issues.push('a quiet dropout');
    if (r.seamCorr > 3) issues.push('click at the loop seam');
    if (r.delay > 2.5) issues.push('level step at the loop seam');
    if (r.spectrum[0] + r.spectrum[1] < 70) issues.push('thin spectrum');
    if (Math.abs(r.cents) > 20) issues.push('out of tune by ' + r.cents + ' cents');
    if (issues.length) bad++;
    console.log(`${r.k.padEnd(9)} ${String(r.secs).padStart(6)}s (expect ~${r.expected})  seam jump/p99.9 ${r.seamCorr}  level step x${r.delay}  tuning ${r.cents}c  quietest/median ${r.quietest}  bands% <250:${r.spectrum[0]} 250-2k:${r.spectrum[1]} 2-6k:${r.spectrum[2]} >6k:${r.spectrum[3]}  ${issues.length ? '!! ' + issues.join(', ') : 'ok'}`);
  }
  console.log(bad ? `${bad} track(s) with issues` : 'all tracks pass');
  await b.close();
  process.exit(bad ? 1 : 0);
})();
