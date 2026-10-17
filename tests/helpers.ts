import { getSkill } from '../src/content/skills.ts';
import type { Row, SkillDef, Stats } from '../src/content/schema.ts';
import { Battle } from '../src/core/battle/engine.ts';
import type { BattleSetup, UnitInput } from '../src/core/battle/types.ts';

export const BASE: Stats = { hp: 1000, atk: 100, def: 0, mag: 100, res: 0, spd: 100, crit: 0, critDmg: 150, acc: 200, eva: 0 };

export function unit(side: 'hero' | 'enemy', id: string, slot: number, row: Row, over: Partial<Stats> = {}, skills: SkillDef[] = [], basic?: SkillDef, extra: Partial<UnitInput> = {}): UnitInput {
  return {
    side, id, name: id, stats: { ...BASE, ...over }, hpFrac: 1, basic: basic ?? getSkill('e-strike'), skills, passives: [],
    slot, row, tags: [], rules: [{ id: 'use-ready', enabled: true }, { id: 'basic', enabled: true }], ...extra,
  };
}

export function setup(heroes: UnitInput[], enemies: UnitInput[], over: Partial<BattleSetup> = {}): BattleSetup {
  return { heroes, waves: [enemies], hazards: [], challenge: [], combos: [], floor: 10, ...over };
}

export function run(s: BattleSetup, seed = 1) {
  const b = new Battle(s, seed);
  const res = b.run();
  return { b, res, events: b.events };
}
