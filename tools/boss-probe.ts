import { BAL } from '../src/core/balance.ts';
import { newGame } from '../src/core/game.ts';
import { playAgeOnce, campPhase } from '../src/core/bot.ts';
import { ENEMIES } from '../src/content/enemies.ts';
import { planFloor } from '../src/core/floors.ts';
import { buildSetup, formation } from '../src/core/party.ts';
import { Battle } from '../src/core/battle/engine.ts';
const s = newGame(4242);
playAgeOnce(s, { untilBoss: true }, 150); campPhase(s);
const base = { hp: ENEMIES['gate-warden'].hp, atk: ENEMIES['gate-warden'].atk };
const probe = (hp: number, atk: number, mult: number) => {
  ENEMIES['gate-warden'].hp = hp; ENEMIES['gate-warden'].atk = atk; BAL.ageBoss[0] = mult;
  const plan = planFloor(100, s.seed, formation(s).length);
  let w = 0, r = 0; const N = 120;
  for (let i = 0; i < N; i++) { const res = new Battle(buildSetup(s, plan), 500 + i, { record: false }).run(); if (res.result === 'victory') w++; r += res.rounds; }
  console.log(`hp ${hp} atk ${atk} ×${mult}: win ${(w / N * 100).toFixed(0)}% rounds ${(r / N).toFixed(1)}`);
};
console.log('party', formation(s).map((f) => f.id).join(','));
probe(base.hp, base.atk, BAL.ageBoss[0]);
probe(6, 1.6, 2.6);
