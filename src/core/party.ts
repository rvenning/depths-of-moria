import { HEROES } from '../content/heroes.ts';
import type { ChallengeRule, HeroId, Row } from '../content/schema.ts';
import { HERO_IDS } from '../content/schema.ts';
import { BONDS, bondId, bondTier } from '../content/bonds.ts';
import { CHAPTER_BY_N } from '../content/chapters.ts';
import { BAL } from './balance.ts';
import { enemyUnit, freeSlot, type FloorPlan } from './floors.ts';
import { mixSeed } from './rng.ts';
import type { ExpeditionBuff, GameState } from './state.ts';
import { computeHero } from './stats.ts';
import type { BattleSetup, ComboInput, UnitInput } from './battle/types.ts';

export const featureUnlocked = (state: GameState, feature: string): boolean => {
  const chapterFor: Record<string, number> = { formation: 4, forge: 3, combos: 8, legendary: 9 };
  const need = chapterFor[feature];
  if (need === undefined) return true;
  return maxChapterReached(state) >= need;
};

/** the highest chapter the player has ever entered (Ages persist the milestone) */
export function maxChapterReached(state: GameState): number {
  return Math.max(state.age, Math.ceil(Math.max(1, state.best) / 100));
}

export interface FormationEntry { id: HeroId; slot: number; row: Row }

/** Resolve the saved party into rows and slots. Before Formation Tactics unlock, rows are automatic. */
export function formation(state: GameState): FormationEntry[] {
  const ids = state.party.filter((x): x is HeroId => !!x && state.heroes[x]?.unlocked);
  if (!featureUnlocked(state, 'formation')) {
    const front = ids.filter((i) => HEROES[i].defaultRow === 'front');
    const back = ids.filter((i) => HEROES[i].defaultRow === 'back');
    while (front.length > 3) back.unshift(front.pop() as HeroId);
    while (front.length < 1 && back.length > 0) front.push(back.shift() as HeroId);
    while (back.length > 2) front.push(back.pop() as HeroId);
    return [...front.map((id, i) => ({ id, slot: i, row: 'front' as Row })), ...back.map((id, i) => ({ id, slot: 3 + i, row: 'back' as Row }))];
  }
  const out: FormationEntry[] = [];
  state.party.forEach((id, idx) => {
    if (id && state.heroes[id]?.unlocked && !out.some((o) => o.id === id)) out.push({ id, slot: idx, row: idx < 3 ? 'front' : 'back' });
  });
  return out;
}

export function activeCombos(state: GameState, ids: HeroId[]): ComboInput[] {
  const out: ComboInput[] = [];
  const unlockedAll = featureUnlocked(state, 'combos');
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const id = bondId(ids[i], ids[j]);
      const def = BONDS[id];
      if (!def) continue;
      if (bondTier(state.bonds[id] ?? 0) < 3) continue;
      out.push({ a: def.a, b: def.b, kind: def.combo.kind, name: def.combo.name, power: def.combo.power * (unlockedAll ? 1.25 : 1) });
    }
  }
  return unlockedAll ? out : out.slice(0, 1);
}

export interface BuildOpts {
  hp?: Partial<Record<HeroId, number>>;
  buffs?: ExpeditionBuff[];
  attempt?: number;
}

export function mercyPct(state: GameState): number {
  return Math.min(30, (state.counters.mercy ?? 0) * 4);
}

export function buildHeroUnits(state: GameState, opts: BuildOpts = {}): UnitInput[] {
  const buffs = [...(opts.buffs ?? [])];
  const m = mercyPct(state);
  if (m > 0) buffs.push({ stat: 'hp', pct: m, battles: 1, label: 'Resolve' }, { stat: 'atk', pct: m, battles: 1, label: 'Resolve' }, { stat: 'mag', pct: m, battles: 1, label: 'Resolve' });
  return formation(state).map(({ id, slot, row }) => {
    const def = HEROES[id];
    const hs = state.heroes[id];
    const c = computeHero(state, id, buffs);
    return {
      side: 'hero', id, name: def.name, stats: c.stats, hpFrac: opts.hp?.[id] ?? 1,
      basic: c.basic, skills: c.skills, passives: c.passives, rules: hs.rules, pref: hs.pref,
      slot, row, tags: ['hero'], heroId: id, level: hs.level, healBonus: c.healBonus, lifesteal: c.lifesteal, thorns: c.thorns,
    } satisfies UnitInput;
  });
}

export function buildSetup(state: GameState, plan: FloorPlan, opts: BuildOpts = {}): BattleSetup {
  const heroes = buildHeroUnits(state, opts);
  const shadow = plan.endless ? 0 : plan.chapter;
  const hpScale = (plan.challenge.includes('swarm' as ChallengeRule) ? 0.8 : 1) * (BAL.partyHp[Math.min(5, heroes.length)] ?? 1);
  const waves = plan.waves.map((w) => w.map((e) => enemyUnit(e.id, plan.floor, e.slot, hpScale)));
  if (shadow === 2) for (const e of waves.flat()) e.startStatuses = [{ id: 'haste', turns: 1, power: 60 }];
  const ids = heroes.map((h) => h.heroId as HeroId);
  return {
    heroes, waves, hazards: plan.hazards, challenge: plan.challenge, combos: activeCombos(state, ids),
    floor: plan.floor, shadow, enrageStart: BAL.enrageStart, maxRounds: BAL.maxRounds,
    spawn: (enemyId, used) => {
      const slot = freeSlot(enemyId, used);
      return slot === null ? null : enemyUnit(enemyId, plan.floor, slot, hpScale);
    },
  };
}

export function battleSeed(state: GameState, floor: number, attempt: number): number {
  return mixSeed(state.seed, floor, attempt);
}

export const unlockedHeroes = (state: GameState): HeroId[] => HERO_IDS.filter((h) => state.heroes[h].unlocked);
export const chapterName = (n: number): string => CHAPTER_BY_N(n).name;
