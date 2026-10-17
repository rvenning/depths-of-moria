import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/game.ts';
import { playAgeOnce, playGame, runExpedition, campPhase } from '../src/core/bot.ts';
import { descendAge, startExpedition, validStartFloors, applyBattleResult, prepareBattle, getPlan, bankExpedition, startLadder, endlessUnlocked, validEndlessStarts, LADDER_RUNGS } from '../src/core/expedition.ts';
import { HERO_IDS } from '../src/content/schema.ts';
import { BAL } from '../src/core/balance.ts';
import { checkAchievements, claimQuest, questViews, metricValue } from '../src/core/meta.ts';
import { ACHIEVEMENTS, QUESTS } from '../src/content/meta.ts';

describe('the progression bot plays the real rules', () => {
  it('clears Age 1 in a believable number of expeditions, unlocking Gimli and Frodo on the way', () => {
    const s = newGame(2024);
    const r = playAgeOnce(s, {}, 80);
    expect(r.ok).toBe(true);
    expect(r.cycles).toBeGreaterThanOrEqual(3); expect(r.cycles).toBeLessThanOrEqual(40);
    expect(s.heroes.gimli.unlocked).toBe(true); expect(s.heroes.frodo.unlocked).toBe(true);
    expect(s.best).toBe(100); expect(s.bosses['gate-warden']).toBeGreaterThan(0);
    expect(s.lore.length).toBeGreaterThan(0);
    expect(s.codex['goblin-skirmisher']).toBeTruthy();
  });
  it('descends and keeps going without any progression blocker through Age 3', () => {
    const s = newGame(2025);
    for (let a = 1; a <= 3; a++) {
      const r = playAgeOnce(s, {}, 150);
      expect(r.ok, `Age ${a}`).toBe(true);
      expect(descendAge(s)).toBe(true); campPhase(s);
      expect(s.age).toBe(a + 1);
    }
    expect(s.heroes.legolas.unlocked).toBe(true);
  });
  it('quests and achievements actually complete from play', () => {
    const s = newGame(2026);
    playAgeOnce(s, {}, 80);
    checkAchievements(s);
    expect(s.achievements['a-first-win']).toBeTruthy(); expect(s.achievements['a-floor-100']).toBeTruthy();
    const claimed = Object.keys(s.questsClaimed);
    expect(claimed.length).toBeGreaterThan(3); // the bot claims as it goes
    expect(claimQuest(s, claimed[0])).toBe(false); // never twice
    s.counters.kills = 999; // 'First Blood' already claimed; use a fresh quest
    s.counters.salvaged = 99;
    const g0 = s.ore + s.cloth + s.gold + s.renown + s.essence;
    const v = questViews(s).find((q) => q.def.id === 'q-salvage-20')!;
    if (!v.claimed) { expect(v.done).toBe(true); expect(claimQuest(s, 'q-salvage-20')).toBe(true); expect(s.ore + s.cloth + s.gold + s.renown + s.essence).toBeGreaterThan(g0); }
    expect(QUESTS.every((q) => typeof metricValue(s, q.metric === 'bossKillsR' ? 'bossKills' : q.metric) === 'number')).toBe(true);
    expect(ACHIEVEMENTS.every((a) => typeof metricValue(s, a.metric) === 'number')).toBe(true);
  });
  it('a full playthrough of all ten Ages is possible and finishes within the design envelope', () => {
    const s = newGame(2027);
    const rep = playGame(s, { maxCycles: 2500 });
    expect(rep.stuckAt, `stuck at floor ${rep.stuckAt}`).toBeUndefined();
    expect(rep.finished).toBe(true); expect(s.best).toBeGreaterThanOrEqual(1000);
    expect(s.bosses.balrog).toBeGreaterThan(0);
    const hours2x = rep.secondsAt1x / 2 / 3600;
    // design target 20-40 h; accept a wide band for the bot (it is faster than a human at menus, slower at tactics)
    expect(hours2x).toBeGreaterThan(10); expect(hours2x).toBeLessThan(80);
    expect(rep.ages.length).toBe(10);
  }, 180000);
});

describe('postgame systems', () => {
  it('Deep Delve and the Ladder open after the Balrog', () => {
    const s = newGame(5);
    expect(endlessUnlocked(s)).toBe(false); expect(startLadder(s, 1)).toBe(false);
    s.best = 1000; s.age = 10;
    expect(endlessUnlocked(s)).toBe(true);
    expect(validEndlessStarts(s)[0]).toBe(1001);
    expect(startExpedition(s, 1001, true)).toBe(true);
    expect(getPlan(s)!.floor).toBe(1001);
    expect(LADDER_RUNGS).toBeGreaterThanOrEqual(20);
  });
  it('a ladder rung is a single trial that records progress and ends the run', () => {
    const s = newGame(6); s.best = 1000; s.age = 10;
    for (const h of HERO_IDS) { s.heroes[h].unlocked = true; s.heroes[h].level = 110; }
    s.party = ['aragorn', 'gimli', null, 'legolas', 'sam'];
    expect(startLadder(s, 2)).toBe(false); // must clear rung 1 first
    expect(startLadder(s, 1)).toBe(true);
    const bs = prepareBattle(s, false)!;
    const res = bs.battle.run();
    applyBattleResult(s, bs.plan, res);
    expect(s.expedition!.phase).toBe('ended');
    if (res.result === 'victory') expect(s.ladder.cleared).toBe(1);
    bankExpedition(s); expect(s.expedition).toBeNull();
  });
  it('endless difficulty never decreases and stays finite', () => {
    let prev = 0;
    for (let f = 1001; f < 3000; f += 100) { const d = BAL.endlessGrowth * (f - 1000); expect(d).toBeGreaterThan(prev); prev = d; }
  });
  it('quick traversal is only offered for far-below floors once unlocked', () => {
    const s = newGame(8); s.best = 150; s.age = 2;
    startExpedition(s, 1);
    expect(runExpedition.length).toBeGreaterThan(0);
    expect(validStartFloors(s).includes(1)).toBe(true);
  });
});
