import { BAL } from '../src/core/balance.ts';
import { newGame } from '../src/core/game.ts';
import { campPhase, runExpedition } from '../src/core/bot.ts';
import { startExpedition, validStartFloors } from '../src/core/expedition.ts';
import { planFloor } from '../src/core/floors.ts';
import { buildSetup } from '../src/core/party.ts';
import { Battle } from '../src/core/battle/engine.ts';
import { HERO_IDS } from '../src/content/schema.ts';
import { computeHero } from '../src/core/stats.ts';

const k = Number(process.argv[2] ?? 1.5);
const floor = Number(process.argv[3] ?? 100);
const warm = Number(process.argv[4] ?? 6);
BAL.ageHp[0] = k; BAL.ageAtk[0] = k;
const s = newGame(4242);
for (let c = 0; c < warm; c++) {
  campPhase(s);
  const starts = validStartFloors(s);
  startExpedition(s, starts[starts.length - 1]);
  runExpedition(s);
}
campPhase(s);
console.log('best', s.best, 'party', s.party.join(','));
for (const h of HERO_IDS) if (s.heroes[h].unlocked) { const c = computeHero(s, h); console.log(h, JSON.stringify(Object.fromEntries(Object.entries(c.stats).map(([a, b]) => [a, Math.round(b)])))); }
const plan = planFloor(floor, s.seed, 3);
console.log(plan.title, plan.waves[0].map((e) => e.id), plan.hazards);
let wins = 0; const N = 40; let rounds = 0;
for (let i = 0; i < N; i++) {
  const b = new Battle(buildSetup(s, plan, {}), 1000 + i, { record: false });
  const r = b.run();
  if (r.result === 'victory') wins++;
  rounds += r.rounds;
}
console.log(`win ${wins}/${N} avg rounds ${(rounds / N).toFixed(1)}`);
