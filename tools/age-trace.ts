import { BAL } from '../src/core/balance.ts';
import { newGame } from '../src/core/game.ts';
import { campPhase, playAgeOnce, runExpedition } from '../src/core/bot.ts';
import { descendAge, startExpedition, validStartFloors } from '../src/core/expedition.ts';
import { HERO_IDS } from '../src/content/schema.ts';

const ks = (process.argv[2] ?? '2.7,5.7,4.9,3.5').split(',').map(Number);
const target = Number(process.argv[3] ?? 4);
ks.forEach((k, i) => { BAL.ageHp[i] = k; BAL.ageAtk[i] = k; });
const s = newGame(4242);
for (let a = 1; a < target; a++) { playAgeOnce(s, {}, 150); descendAge(s); campPhase(s); }
console.log('age', s.age, 'best', s.best, 'heroes', HERO_IDS.filter((h) => s.heroes[h].unlocked).join(','));
for (let c = 0; c < 25; c++) {
  campPhase(s);
  const starts = validStartFloors(s);
  const floor = starts[starts.length - 1];
  startExpedition(s, floor);
  const r = runExpedition(s);
  console.log(`cycle ${c}: start ${floor} floors ${r.floors} ${r.reason} best ${s.best} gold ${s.gold} lv ${HERO_IDS.filter((h) => s.heroes[h].unlocked).map((h) => s.heroes[h].level).join('/')} party ${s.party.map((p) => p ?? '-').join(',')}`);
  if (s.best >= s.age * 100) break;
}
