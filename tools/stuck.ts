import { BAL } from '../src/core/balance.ts';
import { newGame } from '../src/core/game.ts';
import { campPhase, playAgeOnce, runExpedition } from '../src/core/bot.ts';
import { descendAge, startExpedition, validStartFloors } from '../src/core/expedition.ts';
import { planFloor } from '../src/core/floors.ts';
import { buildSetup, formation } from '../src/core/party.ts';
import { Battle } from '../src/core/battle/engine.ts';
import { computeHero } from '../src/core/stats.ts';
import { HERO_IDS } from '../src/content/schema.ts';

const ks = (process.argv[2] ?? '3.086,5.856,5.456,3.455').split(',').map(Number);
const target = Number(process.argv[3] ?? 4);
ks.forEach((k, i) => { BAL.ageHp[i] = k; BAL.ageAtk[i] = k; });
const s = newGame(Number(process.env.SEED ?? 4242));
for (let a = 1; a < target; a++) { playAgeOnce(s, {}, 150); descendAge(s); campPhase(s); }
for (let c = 0; c < 70; c++) {
  campPhase(s);
  const starts = validStartFloors(s);
  startExpedition(s, starts[starts.length - 1]);
  runExpedition(s);
  if (s.best >= s.age * 100) { console.log('cleared at cycle', c); process.exit(0); }
}
console.log('best', s.best, 'party', s.party.join(','));
for (const h of HERO_IDS) if (s.heroes[h].unlocked) console.log(h, JSON.stringify(Object.fromEntries(Object.entries(computeHero(s, h).stats).map(([a, b]) => [a, Math.round(b)]))));
for (const f of [s.best, s.best + 1, s.best + 2]) {
  const plan = planFloor(f, s.seed, formation(s).length);
  let w = 0, r = 0; const N = 30;
  for (let i = 0; i < N; i++) { const b = new Battle(buildSetup(s, plan), 1000 + i, { record: false }); const res = b.run(); if (res.result === 'victory') w++; r += res.rounds; }
  console.log(f, plan.title, plan.tag, plan.waves[0].map((e) => e.id).join(','), plan.hazards.map((h) => h.kind).join('+'), `win ${w}/${N} rounds ${(r / N).toFixed(1)}`);
}
