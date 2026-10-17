import { BAL } from '../src/core/balance.ts';
import { newGame } from '../src/core/game.ts';
import { campPhase, playAgeOnce } from '../src/core/bot.ts';
import { descendAge } from '../src/core/expedition.ts';
import { enemyStats } from '../src/core/floors.ts';
import { ENEMIES } from '../src/content/enemies.ts';
import { CHAPTERS } from '../src/content/chapters.ts';
import { computeHero } from '../src/core/stats.ts';
import { formation } from '../src/core/party.ts';

const hp = [1.6, 1.6, 1.6, 1.6, 1.6, 1.6, 1.6, 1.6, 1.6, 1.6];
const atk = (process.env.ATK ?? '7.938,17.234,14.91,22.813,37.688,45.125,59.768,52.795,22.813,30.25').split(',').map(Number);
hp.forEach((v, i) => { BAL.ageHp[i] = v; BAL.ageAtk[i] = atk[i]; });
const s = newGame(4242);
console.log('age | hero hp(avg) atk def | enemy@99 hp atk def | enemyHit/heroHP% | heroHit/enemyHP% | hero def mitig% | spd');
for (let age = 1; age <= 10; age++) {
  playAgeOnce(s, { untilBoss: true }, 150); campPhase(s);
  const ids = formation(s).map((f) => f.id);
  const st = ids.map((id) => computeHero(s, id).stats);
  const avg = (k: 'hp' | 'atk' | 'def' | 'mag' | 'res' | 'spd') => st.reduce((a, x) => a + x[k], 0) / st.length;
  const ch = CHAPTERS[age - 1];
  const e = enemyStats(ENEMIES[ch.normals[2]], age * 100 - 1);
  const mit = 100 / (100 + avg('def'));
  const heroHit = avg('atk') * 100 / (100 + e.def);
  console.log(`${String(age).padStart(2)}  | ${avg('hp').toFixed(0).padStart(7)} ${avg('atk').toFixed(0).padStart(5)} ${avg('def').toFixed(0).padStart(4)} | ${e.hp.toFixed(0).padStart(6)} ${e.atk.toFixed(0).padStart(5)} ${e.def.toFixed(0).padStart(4)} | ${(e.atk * mit / avg('hp') * 100).toFixed(1).padStart(5)} | ${(heroHit / e.hp * 100).toFixed(1).padStart(5)} | ${(mit * 100).toFixed(0)} | ${avg('spd').toFixed(0)}`);
  playAgeOnce(s, {}, 80);
  if (age < 10) { descendAge(s); campPhase(s); }
}
