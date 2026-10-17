import { newGame } from '../src/core/game.ts';
import { campPhase, playGame, runExpedition } from '../src/core/bot.ts';
import { startExpedition, validEndlessStarts, startLadder, prepareBattle, applyBattleResult, bankExpedition, LADDER_RUNGS } from '../src/core/expedition.ts';

const s = newGame(2027);
const rep = playGame(s, { maxCycles: 2500 });
console.log('campaign finished', rep.finished, 'best', s.best, 'cycles', rep.cycles);
let deepest = 1000;
for (let c = 0; c < 80; c++) {
  campPhase(s);
  const starts = validEndlessStarts(s);
  const start = starts[starts.length - 1];
  if (!startExpedition(s, start, true)) { console.log('cannot start', start); break; }
  const r = runExpedition(s);
  deepest = Math.max(deepest, s.endless.best);
  if (c % 10 === 0 || c === 79) console.log(`cycle ${c}: start ${start} floors ${r.floors} ${r.reason} best ${s.endless.best} gold ${s.gold} essence ${s.essence}`);
}
console.log('deepest endless floor', deepest);
// ladder
let cleared = 0;
for (let rung = 1; rung <= LADDER_RUNGS; rung++) {
  let ok = false;
  for (let t = 0; t < 6 && !ok; t++) {
    campPhase(s);
    if (!startLadder(s, rung)) break;
    const bs = prepareBattle(s, false);
    if (!bs) break;
    const res = bs.battle.run();
    applyBattleResult(s, bs.plan, res);
    ok = res.result === 'victory';
    bankExpedition(s);
  }
  if (!ok) { console.log('ladder stopped at rung', rung); break; }
  cleared = rung;
}
console.log('ladder rungs cleared', cleared, 'of', LADDER_RUNGS);
