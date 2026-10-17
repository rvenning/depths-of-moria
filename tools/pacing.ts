import { newGame } from '../src/core/game.ts';
import { botStats, campPhase, playAgeOnce, resetBotStats } from '../src/core/bot.ts';
import { descendAge } from '../src/core/expedition.ts';
const s = newGame(555);
for (let age = 1; age <= 6; age++) {
  resetBotStats();
  playAgeOnce(s, {}, 300);
  const row = Object.entries(botStats.rounds).map(([k, v]) => `${k}: ${(v.rounds / v.n).toFixed(1)}r/${(v.actions / v.n).toFixed(0)}a (n=${v.n})`).join(' | ');
  console.log(`Age ${age}: ${row}`);
  if (age < 10) { descendAge(s); campPhase(s); }
}
