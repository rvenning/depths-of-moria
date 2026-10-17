import { BAL } from '../src/core/balance.ts';
import { newGame } from '../src/core/game.ts';
import { campPhase, runExpedition } from '../src/core/bot.ts';
import { startExpedition, validStartFloors } from '../src/core/expedition.ts';
import { HERO_IDS } from '../src/content/schema.ts';

const k = Number(process.argv[2] ?? 1.5);
const cycles = Number(process.argv[3] ?? 40);
BAL.ageHp[0] = k; BAL.ageAtk[0] = k;
const s = newGame(4242);
for (let c = 0; c < cycles; c++) {
  campPhase(s);
  const starts = validStartFloors(s);
  const floor = starts[starts.length - 1];
  startExpedition(s, floor);
  const r = runExpedition(s);
  console.log(`cycle ${c}: start ${floor} floors ${r.floors} ${r.reason} best ${s.best} gold ${s.gold} lv ${HERO_IDS.filter((h) => s.heroes[h].unlocked).map((h) => s.heroes[h].level).join('/')} camp ${JSON.stringify(s.camp.age)} mercy ${s.counters.mercy ?? 0}`);
  if (s.best >= 100) break;
}
