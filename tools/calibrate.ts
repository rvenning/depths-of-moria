/**
 * Fit the per-Age enemy multipliers against the progression bot.
 *   A. BAL.ageHp/ageAtk (K): cycles to reach the boss ≈ TARGET[age]
 *   B. BAL.ageBoss: the first prepared attempt on the boss wins ≈ BOSS_WIN of the time
 * Usage: node tools/calibrate.ts [ages=10]   env: TARGET=a,b,c… BOSS_WIN=0.4 SEED=4242
 */
import { BAL } from '../src/core/balance.ts';
import { Battle } from '../src/core/battle/engine.ts';
import { botStats, campPhase, playAgeOnce, resetBotStats } from '../src/core/bot.ts';
import { descendAge } from '../src/core/expedition.ts';
import { planFloor } from '../src/core/floors.ts';
import { newGame } from '../src/core/game.ts';
import { buildSetup, formation } from '../src/core/party.ts';
import type { GameState } from '../src/core/state.ts';

const TARGET = (process.env.TARGET ?? '10,12,14,16,17,18,19,20,21,22').split(',').map(Number);
const BOSS_WIN = Number(process.env.BOSS_WIN ?? 0.4);
const upTo = Number(process.argv[2] ?? 10);
const HP_K = Number(process.env.HP_K ?? 1.6); // enemy health multiplier is held fixed so fights stay short; difficulty lives in damage
const seed = Number(process.env.SEED ?? 4242);

function winRate(s: GameState, n = 80): number {
  const plan = planFloor(s.age * 100, s.seed, formation(s).length);
  let w = 0;
  for (let i = 0; i < n; i++) if (new Battle(buildSetup(s, plan), 31000 + i, { record: false }).run().result === 'victory') w++;
  return w / n;
}

let state: GameState = newGame(seed);
const rows: { age: number; k: number; boss: number; pre: number; tries: number; win: number }[] = [];
for (let age = 1; age <= upTo; age++) {
  const snap = structuredClone(state);
  BAL.ageBoss[age - 1] = 1;
  // A. cycles-to-boss
  const trial = (k: number) => { BAL.ageHp[age - 1] = HP_K; BAL.ageAtk[age - 1] = k; const s = structuredClone(snap); const r = playAgeOnce(s, { untilBoss: true }, 150); return { r, s }; };
  let lo = 0.5; let hi = 60; let k = 2; let bestK = 2; let bestGap = 1e9;
  for (let i = 0; i < 14; i++) {
    k = (lo + hi) / 2;
    const t = trial(k);
    const c = t.r.ok ? t.r.cycles : 999;
    if (c > TARGET[age - 1]) hi = k; else lo = k;
    const gap = t.r.ok ? Math.abs(t.r.cycles - TARGET[age - 1]) : 1e8;
    if (gap < bestGap) { bestGap = gap; bestK = k; }
    if (gap <= 1) break;
  }
  k = bestK;
  resetBotStats();
  const fin = trial(k);
  // B. boss strength at arrival
  const arrival = fin.s; campPhase(arrival);
  let blo = 0.04; let bhi = 8; let boss = 1;
  for (let i = 0; i < 12; i++) {
    boss = (blo + bhi) / 2;
    BAL.ageBoss[age - 1] = boss;
    const w = winRate(arrival);
    if (w > BOSS_WIN) blo = boss; else bhi = boss;
    if (Math.abs(w - BOSS_WIN) < 0.05) break;
  }
  BAL.ageBoss[age - 1] = boss;
  const win = winRate(arrival, 160);
  // C. actually beat it and move on
  const done = playAgeOnce(arrival, {}, 60);
  rows.push({ age, k: +k.toFixed(3), boss: +boss.toFixed(3), pre: fin.r.cycles, tries: done.cycles, win: +win.toFixed(2) });
  const pace = Object.entries(botStats.rounds).filter(([t]) => ['normal', 'elite', 'boss', 'mini'].includes(t)).map(([t, v]) => `${t} ${(v.rounds / v.n).toFixed(1)}r`).join(' ');
  console.log(`Age ${age}: atkK=${k.toFixed(3)} cyclesToBoss=${fin.r.cycles} (target ${TARGET[age - 1]}) boss×${boss.toFixed(3)} firstTryWin=${(win * 100).toFixed(0)}% bossAttempts=${done.cycles} ok=${done.ok} | ${pace}`);
  state = arrival;
  if (!done.ok) break;
  if (age < 10) { descendAge(state); campPhase(state); }
}
console.log('ageHp: ', JSON.stringify(rows.map(() => HP_K)));
console.log('ageAtk:', JSON.stringify(rows.map((r) => r.k)));
console.log('ageBoss:', JSON.stringify(rows.map((r) => r.boss)));
console.log('cycles to boss total', rows.reduce((a, r) => a + r.pre, 0), 'boss attempts', rows.reduce((a, r) => a + r.tries, 0));
