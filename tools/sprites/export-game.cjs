/* Export the game's own current sprites (Aragorn frames and the Tunnel Rat) to PNG, for side-by-side comparison. node tools/sprites/export-game.cjs OUTDIR */
const { chromium } = require('playwright-core');
const fs = require('node:fs');
(async () => {
  const out = process.argv[2] || '.scratch/spr'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const p = await b.newPage(); await p.goto('http://localhost:8140/?exp=' + Date.now()); await p.waitForFunction(() => window.__dom && window.__dom.loaded);
  const res = await p.evaluate(async () => {
    const h = await import('/src/art/pixel/heroSprites.ts'); const c = await import('/src/art/creatures.ts'); const e = await import('/src/content/enemies.ts');
    const url = (cv) => cv.toDataURL('image/png');
    const o = {};
    for (const [a, n] of [['idle', 0], ['idle', 1], ['wind', 0], ['strike', 0], ['strike', 1], ['thrust', 2]]) o[`aragorn_${a}${n}`] = url(h.heroFrame('aragorn', a, n).color);
    o['rat_idle0'] = url(c.paintCreature(e.ENEMIES['tunnel-rat']));
    return o;
  });
  for (const [k, v] of Object.entries(res)) fs.writeFileSync(`${out}/game_${k}.png`, Buffer.from(v.split(',')[1], 'base64'));
  console.log(Object.keys(res).join(' ')); await b.close();
})();
