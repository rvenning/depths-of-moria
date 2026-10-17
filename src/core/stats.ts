import { HEROES } from '../content/heroes.ts';
import { ITEMS, AFFIXES, RARITY_MULT, SETS } from '../content/items.ts';
import { CAMP } from '../content/camp.ts';
import { RELICS, relicBonus } from '../content/relics.ts';
import { getSkill } from '../content/skills.ts';
import type {
  AffixId, HeroId, ItemInstance, ItemSlot, PassiveEffect, SkillDef, SkillEffect, StatKey, Stats,
} from '../content/schema.ts';
import { STAT_KEYS } from '../content/schema.ts';
import { BAL, defUnit, levelMult, unit } from './balance.ts';
import type { ExpeditionBuff, GameState } from './state.ts';

export const SLOTS: ItemSlot[] = ['weapon', 'armour', 'offhand', 'accessory1', 'accessory2'];
const PCT_STATS: StatKey[] = ['hp', 'atk', 'def', 'mag', 'res'];
export const isPctStat = (k: StatKey): boolean => PCT_STATS.includes(k);

/** per-"share" value of a stat at an item level */
function shareValue(k: StatKey, ilvl: number): number {
  switch (k) {
    case 'hp': return BAL.refHp * unit(ilvl);
    case 'atk': case 'mag': return BAL.refAtk * unit(ilvl);
    case 'def': case 'res': return 0.9 * defUnit(ilvl);
    case 'spd': return 8;
    case 'crit': return 4;
    case 'critDmg': return 12;
    case 'acc': return 6;
    case 'eva': return 5;
    default: return 0;
  }
}

export function itemStat(item: ItemInstance, k: StatKey): number {
  const tpl = ITEMS[item.tpl];
  const w = tpl?.stats[k];
  if (!w) return 0;
  return w * shareValue(k, item.ilvl) * RARITY_MULT[item.rarity] * (1 + 0.06 * item.plus);
}

export function itemStatLines(item: ItemInstance): { stat: StatKey; value: number }[] {
  const tpl = ITEMS[item.tpl];
  if (!tpl) return [];
  return (Object.keys(tpl.stats) as StatKey[]).map((k) => ({ stat: k, value: itemStat(item, k) }));
}

/** crude single-number power rating, used for auto-equip suggestions and sorting */
export function itemScore(item: ItemInstance, role: 'phys' | 'mag' | 'tank' | 'any' = 'any'): number {
  let s = 0;
  const w: Record<StatKey, number> = role === 'mag'
    ? { hp: 0.05, atk: 0.1, def: 0.6, mag: 3, res: 1.1, spd: 4, crit: 3, critDmg: 1, acc: 1.5, eva: 1.5 }
    : role === 'tank'
      ? { hp: 0.15, atk: 0.8, def: 2.2, mag: 0.2, res: 1.4, spd: 3, crit: 2, critDmg: 0.8, acc: 1.5, eva: 2 }
      : { hp: 0.1, atk: 3, def: 0.9, mag: 0.4, res: 0.6, spd: 4, crit: 3, critDmg: 1, acc: 1.5, eva: 1.5 };
  for (const l of itemStatLines(item)) s += l.value * w[l.stat];
  if (item.affix) s += 12 * (1 + item.ilvl / 80);
  const tpl = ITEMS[item.tpl];
  if (tpl?.signature) s += 40 * (1 + item.ilvl / 60);
  return s;
}

export function affixOf(item: ItemInstance): AffixId[] {
  const out: AffixId[] = [];
  if (item.affix) out.push(item.affix);
  return out;
}

export { levelMult };

export interface ComputedHero {
  stats: Stats;
  passives: PassiveEffect[];
  skills: SkillDef[];
  basic: SkillDef;
  healBonus: number;
  lifesteal: number;
  thorns: number;
  goldBonus: number;
  xpBonus: number;
  setCounts: Record<string, number>;
}

export function equippedItems(state: GameState, heroId: HeroId): ItemInstance[] {
  const h = state.heroes[heroId];
  const out: ItemInstance[] = [];
  for (const slot of SLOTS) {
    const uid = h.equip[slot];
    if (!uid) continue;
    const it = state.inventory.find((i) => i.uid === uid);
    if (it) out.push(it);
  }
  return out;
}

function modSkill(base: SkillDef, mods: { mult: number; cd: number; extra: SkillEffect[] }): SkillDef {
  const s: SkillDef = { ...base };
  if (mods.mult) {
    const f = 1 + mods.mult / 100;
    if (s.hits) s.hits = s.hits.map((h) => h * f);
    if (s.effects) {
      s.effects = s.effects.map((e) => (e.k === 'heal' || e.k === 'shield') ? { ...e, mult: e.mult * f } : e);
    }
  }
  if (mods.cd) s.cd = Math.max(0, s.cd + mods.cd);
  if (mods.extra.length) s.effects = [...(s.effects ?? []), ...mods.extra];
  return s;
}

export function computeHero(state: GameState, heroId: HeroId, buffs: ExpeditionBuff[] = []): ComputedHero {
  const def = HEROES[heroId];
  const hs = state.heroes[heroId];
  const lm = levelMult(hs.level);
  const dm = 1 + BAL.defLevelGrowth * (hs.level - 1);
  const base: Stats = {
    hp: def.base.hp * lm, atk: def.base.atk * lm, mag: def.base.mag * lm,
    def: def.base.def * dm, res: def.base.res * dm,
    spd: def.base.spd + BAL.spdLevelGrowth * (hs.level - 1),
    crit: def.base.crit, critDmg: def.base.critDmg, acc: def.base.acc, eva: def.base.eva,
  };
  const flat: Stats = { hp: 0, atk: 0, def: 0, mag: 0, res: 0, spd: 0, crit: 0, critDmg: 0, acc: 0, eva: 0 };
  const pct: Stats = { hp: 0, atk: 0, def: 0, mag: 0, res: 0, spd: 0, crit: 0, critDmg: 0, acc: 0, eva: 0 };
  const passives: PassiveEffect[] = [];
  let healBonus = 0, lifesteal = 0, thorns = 0, goldBonus = 0, xpBonus = 0;
  const setCounts: Record<string, number> = {};

  const items = equippedItems(state, heroId);
  for (const it of items) {
    const tpl = ITEMS[it.tpl];
    for (const k of STAT_KEYS) flat[k] += itemStat(it, k);
    if (it.affix) {
      const a = AFFIXES[it.affix];
      if (a.stat) { if (a.stat.pct) pct[a.stat.stat] += a.stat.pct; if (a.stat.flat) flat[a.stat.stat] += a.stat.flat; }
      if (a.special) {
        if (a.special.kind === 'lifesteal') lifesteal += a.special.value;
        if (a.special.kind === 'thorns') thorns += a.special.value;
        if (a.special.kind === 'gold') goldBonus += a.special.value;
        if (a.special.kind === 'xp') xpBonus += a.special.value;
        if (a.special.kind === 'heal') healBonus += a.special.value;
      }
    }
    if (tpl?.signature) passives.push(tpl.signature.effect);
    if (tpl?.set) setCounts[tpl.set] = (setCounts[tpl.set] ?? 0) + 1;
  }
  for (const [sid, n] of Object.entries(setCounts)) {
    const set = SETS[sid];
    for (const b of set.bonuses) {
      if (n < b.count) continue;
      if (b.stats) for (const [k, v] of Object.entries(b.stats) as [StatKey, number][]) { if (isPctStat(k)) pct[k] += v; else flat[k] += v; }
      if (b.effect) passives.push(b.effect);
    }
  }

  // hero passive
  for (const p of lookupPassive(def.passive).effects) {
    if (p.kind === 'stat') pct[p.stat] += p.pct; else passives.push(p);
  }

  // talents
  const mods: Record<string, { mult: number; cd: number; extra: SkillEffect[] }> = {};
  const getMod = (s: string) => (mods[s] ??= { mult: 0, cd: 0, extra: [] });
  for (const idx of hs.talents) {
    const t = def.talents[idx];
    if (!t) continue;
    for (const e of t.effects) {
      switch (e.kind) {
        case 'stat': pct[e.stat] += e.pct; break;
        case 'statFlat': flat[e.stat] += e.value; break;
        case 'skillMult': getMod(e.skill).mult += e.pct; break;
        case 'skillCd': getMod(e.skill).cd += e.delta; break;
        case 'skillEffect': getMod(e.skill).extra.push(e.effect); break;
        case 'passive': if (e.effect.kind === 'stat') pct[e.effect.stat] += e.effect.pct; else passives.push(e.effect); break;
        default: break;
      }
    }
  }

  // relics
  const R = state.relics;
  pct.hp += relicBonus(RELICS.light, R.light ?? 0);
  pct.atk += relicBonus(RELICS.horn, R.horn ?? 0);
  pct.mag += relicBonus(RELICS.wisdom, R.wisdom ?? 0);
  pct.def += relicBonus(RELICS.courage, R.courage ?? 0);
  healBonus += relicBonus(RELICS.blessing, R.blessing ?? 0) / 100;
  goldBonus += relicBonus(RELICS.fortune, R.fortune ?? 0) / 100;

  // camp (per-Age) upgrades
  const wh = state.camp.age.whetstone ?? 0;
  const bw = state.camp.age.bulwark ?? 0;
  pct.atk += wh * CAMP.whetstone.perLevel; pct.mag += wh * CAMP.whetstone.perLevel;
  pct.hp += bw * CAMP.bulwark.perLevel; pct.def += bw * CAMP.bulwark.perLevel;
  xpBonus += ((state.camp.age.yard ?? 0) * CAMP.yard.perLevel + (state.camp.account.veterans ?? 0) * CAMP.veterans.perLevel) / 100;
  goldBonus += ((state.camp.age.scouts ?? 0) * CAMP.scouts.perLevel) / 100;

  // temporary expedition buffs
  for (const b of buffs) { if (isPctStat(b.stat)) pct[b.stat] += b.pct; else flat[b.stat] += b.pct; }

  const stats = { ...base } as Stats;
  for (const k of STAT_KEYS) {
    if (isPctStat(k)) stats[k] = (base[k] + flat[k]) * Math.max(0.2, 1 + pct[k] / 100);
    else stats[k] = base[k] + flat[k] + (k === 'spd' ? base.spd * pct.spd / 100 : 0);
  }
  stats.crit = Math.min(75, stats.crit);

  const skills = def.skills.map((id) => {
    const m = mods[id];
    const s = getSkill(id);
    return m ? modSkill(s, m) : s;
  });
  const basicBase = getSkill(def.basic);
  const basic = mods[def.basic] ? modSkill(basicBase, mods[def.basic]) : basicBase;
  return { stats, passives, skills, basic, healBonus, lifesteal, thorns, goldBonus, xpBonus, setCounts };
}

import { PASSIVES } from '../content/heroes.ts';
function lookupPassive(id: string) {
  const p = PASSIVES[id];
  if (!p) throw new Error(`Unknown passive ${id}`);
  return p;
}

/** a single comparable number for the UI ("Power") */
export function heroPower(c: ComputedHero): number {
  const s = c.stats;
  const off = Math.max(s.atk, s.mag) * (1 + s.crit / 100 * (s.critDmg / 100 - 1)) * (s.spd / 100);
  const def = s.hp * (1 + s.def / 100 + s.res / 200);
  return Math.round(off * 4 + def * 0.35);
}
