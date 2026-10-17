/**
 * Balance simulation report. Usage: node tools/balance.ts [seeds=3] [--write]
 * Plays the whole campaign with the progression bot over several seeds and thousands of seeded battles, then reports:
 * time to complete, per-Age cycles, boss success rates, income, relic cost curves and party-build variety.
 */
import { writeFileSync } from 'node:fs';
import { CHAPTERS } from '../src/content/chapters.ts';
import { RELICS, relicBonus, relicCost } from '../src/content/relics.ts';
import { HERO_IDS, type HeroId } from '../src/content/schema.ts';
import { Battle } from '../src/core/battle/engine.ts';
import { BAL } from '../src/core/balance.ts';
import { campPhase, playAgeOnce, setBotPriority } from '../src/core/bot.ts';
import { descendAge } from '../src/core/expedition.ts';
import { planFloor } from '../src/core/floors.ts';
import { newGame } from '../src/core/game.ts';
import { buildSetup, formation } from '../src/core/party.ts';
import type { GameState } from '../src/core/state.ts';

const seeds = Number(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 3);
const write = process.argv.includes('--write');
const out: string[] = [];
const log = (s = '') => { out.push(s); console.log(s); };
const pct = (a: number, b: number) => `${Math.round((a / Math.max(1, b)) * 100)}%`;

function bossWinRate(s: GameState, floor: number, n = 200): { win: number; rounds: number } {
  const plan = planFloor(floor, s.seed, formation(s).length);
  let w = 0; let r = 0;
  for (let i = 0; i < n; i++) { const res = new Battle(buildSetup(s, plan), 7000 + i, { record: false }).run(); if (res.result === 'victory') w++; r += res.rounds; }
  return { win: w / n, rounds: r / n };
}

interface AgeRow { cycles: number; hours1x: number; battles: number; deaths: number; startWin: number; endWin: number; rounds: number; gold: number; essence: number; maxLevel: number; party: number }

log('# Balance report');
log();
log(`Seeds: ${seeds} · bot: progression bot (plays each Age to its boss, spends as it earns) · battles are fully seeded.`);
log(`Enemy multipliers by Age — hp: ${BAL.ageHp.map((x) => x.toFixed(2)).join(', ')}; atk: ${BAL.ageAtk.map((x) => x.toFixed(1)).join(', ')}; boss atk: ${BAL.ageBoss.map((x) => x.toFixed(2)).join(', ')} · mercy +4%/defeat up to +30% · defeat keeps ${BAL.defeatKeep * 100}% gold/materials.`);
log();

const rows: AgeRow[][] = [];
let totals: number[] = [];
for (let sd = 0; sd < seeds; sd++) {
  setBotPriority(null);
  const s = newGame(9000 + sd * 77);
  const r: AgeRow[] = [];
  for (let age = 1; age <= 10; age++) {
    campPhase(s);
    const boss = CHAPTERS[age - 1].boss;
    void boss;
    const startWin = bossWinRate(s, age * 100, 100).win;
    const g0 = s.counters.goldEarned ?? 0; const e0 = s.counters.essenceEarned ?? 0;
    const run = playAgeOnce(s, {}, 400);
    const bw = bossWinRate(s, age * 100, 300);
    r.push({ cycles: run.cycles, hours1x: run.seconds / 3600, battles: run.battles, deaths: run.deaths, startWin, endWin: bw.win, rounds: bw.rounds, gold: (s.counters.goldEarned ?? 0) - g0, essence: (s.counters.essenceEarned ?? 0) - e0, maxLevel: Math.max(...HERO_IDS.map((h) => s.heroes[h].level)), party: formation(s).length });
    if (!run.ok) { log(`!! seed ${sd}: Age ${age} not completed`); break; }
    if (age < 10) { descendAge(s); }
  }
  rows.push(r);
  totals.push(r.reduce((a, x) => a + x.hours1x, 0));
}

log('## Time to complete (campaign, one pass, progression bot)');
log('| Seed | Hours at 1× | Hours at 2× (default) | Hours at 4× | Expedition cycles |');
log('|---|---|---|---|---|');
rows.forEach((r, i) => {
  const h1 = r.reduce((a, x) => a + x.hours1x, 0); const cycles = r.reduce((a, x) => a + x.cycles, 0);
  // battle time scales with speed; menus and camp time do not (≈ 20% of the total)
  log(`| ${i + 1} | ${h1.toFixed(1)} | ${(h1 * 0.2 + h1 * 0.8 / 2).toFixed(1)} | ${(h1 * 0.2 + h1 * 0.8 / 4).toFixed(1)} | ${cycles} |`);
});
const avg1 = totals.reduce((a, b) => a + b, 0) / totals.length;
log();
log(`Average ${avg1.toFixed(1)} h at 1×, **${(avg1 * 0.6).toFixed(1)} h at the default 2×** (design target 20–40 h; validate with real players).`);
log();

log('## Per Age (average over seeds)');
log('| Age | Chapter | Cycles | Hours@2× | Battles | Hero deaths | Boss win rate when first prepared → at clear | Avg boss rounds | Max hero level | Party size |');
log('|---|---|---|---|---|---|---|---|---|---|');
for (let a = 0; a < 10; a++) {
  const rs = rows.map((r) => r[a]).filter(Boolean);
  if (!rs.length) continue;
  const m = (f: (x: AgeRow) => number) => rs.reduce((s, x) => s + f(x), 0) / rs.length;
  log(`| ${a + 1} | ${CHAPTERS[a].name} | ${m((x) => x.cycles).toFixed(1)} | ${(m((x) => x.hours1x) * 0.6).toFixed(1)} | ${m((x) => x.battles).toFixed(0)} | ${m((x) => x.deaths).toFixed(0)} | ${pct(m((x) => x.startWin), 1)} → ${pct(m((x) => x.endWin), 1)} | ${m((x) => x.rounds).toFixed(1)} | ${m((x) => x.maxLevel).toFixed(0)} | ${m((x) => x.party).toFixed(1)} |`);
}
log();

log('## Income by Age (per seed average)');
log('| Age | Gold earned | Relic essence earned | Gold per hour (2×) | Essence per hour (2×) |');
log('|---|---|---|---|---|');
for (let a = 0; a < 10; a++) { const rs = rows.map((r) => r[a]).filter(Boolean); if (!rs.length) continue; const g = rs.reduce((s, x) => s + x.gold, 0) / rs.length; const es = rs.reduce((s, x) => s + x.essence, 0) / rs.length; const h = rs.reduce((s, x) => s + x.hours1x, 0) / rs.length * 0.6; log(`| ${a + 1} | ${Math.round(g).toLocaleString('en-US')} | ${Math.round(es).toLocaleString('en-US')} | ${Math.round(g / h).toLocaleString('en-US')} | ${(es / h).toFixed(0)} |`); }
log();

log('## Relic cost curves');
log('| Level | Cost (Light) | Cumulative | Bonus | Next-level gain |');
log('|---|---|---|---|---|');
let cum = 0; const lights = RELICS.light;
for (let l = 0; l < 60; l++) { cum += relicCost(lights, l); if ([0, 4, 9, 19, 29, 39, 59].includes(l)) log(`| ${l + 1} | ${relicCost(lights, l).toLocaleString('en-US')} | ${cum.toLocaleString('en-US')} | +${relicBonus(lights, l + 1).toFixed(1)}% | +${(relicBonus(lights, l + 1) - relicBonus(lights, l)).toFixed(2)}% |`); }
log();

log('## Party-build variety (Age 5 onward, same starting state, different company)');
const base = newGame(4321);
for (let age = 1; age <= 4; age++) { playAgeOnce(base, {}, 400); descendAge(base); }
campPhase(base);
const builds: [string, HeroId[]][] = [
  ['Balanced (default)', ['gimli', 'sam', 'legolas', 'gandalf', 'aragorn', 'boromir', 'frodo']],
  ['Glass cannon', ['legolas', 'gandalf', 'aragorn', 'frodo', 'gimli', 'sam', 'boromir']],
  ['Fortress', ['boromir', 'gimli', 'aragorn', 'sam', 'gandalf', 'legolas', 'frodo']],
  ['Support-heavy', ['sam', 'frodo', 'boromir', 'gandalf', 'aragorn', 'gimli', 'legolas']],
];
log('| Build | Cycles to clear Age 5 | Boss win rate at clear |');
log('|---|---|---|');
const baseCycles: number[] = [];
for (const [name, pr] of builds) {
  const s = structuredClone(base);
  const run = playAgeOnce(s, { priority: pr }, 300);
  baseCycles.push(run.ok ? run.cycles : 999);
  log(`| ${name} | ${run.ok ? run.cycles : 'stuck'} | ${run.ok ? pct(bossWinRate(s, 500, 200).win, 1) : '—'} |`);
}
setBotPriority(null);
log();
log(`Viable builds: ${baseCycles.filter((c) => c < 999).length}/${builds.length}.`);

if (write) { writeFileSync('docs/BALANCE_REPORT.md', out.join('\n') + '\n'); console.log('written docs/BALANCE_REPORT.md'); }
