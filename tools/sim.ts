import { newGame } from '../src/core/game.ts';
import { playGame } from '../src/core/bot.ts';
import { BAL } from '../src/core/balance.ts';
import { HERO_IDS } from '../src/content/schema.ts';

for (const [k, v] of Object.entries(process.env)) if (k.startsWith('BAL_')) (BAL as Record<string, unknown>)[k.slice(4)] = Number(v);
const args = process.argv.slice(2);
const stopAge = Number(args[0] ?? 1);
const seed = Number(args[1] ?? 12345);
const state = newGame(seed);
state.settings.reducedMotion = false;
const t0 = Date.now();
const rep = playGame(state, { stopAge, maxCycles: 600, log: undefined });
console.log(JSON.stringify({ ...rep, ages: undefined }, null, 0));
for (const a of rep.ages) console.log(`Age ${a.age}: cycles ${a.cycles}, battles ${a.battles}, deaths ${a.deaths}, time@1x ${(a.seconds / 3600).toFixed(2)}h, levels ${a.startLevel}->${a.endLevel}`);
console.log('best', state.best, 'age', state.age, 'gold', state.gold, 'essence', state.essence, 'renown', state.renown);
console.log('levels', HERO_IDS.filter((h) => state.heroes[h].unlocked).map((h) => `${h}:${state.heroes[h].level}`).join(' '));
console.log('relics', JSON.stringify(state.relics));
console.log(`wall ${((Date.now() - t0) / 1000).toFixed(1)}s`);
