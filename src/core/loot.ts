import { ITEMS, ITEM_LIST, AFFIXES, RARITY_MULT } from '../content/items.ts';
import { RARITIES } from '../content/schema.ts';
import type { AffixId, ItemInstance, ItemTemplate, Rarity } from '../content/schema.ts';
import { BAL } from './balance.ts';
import type { Rng } from './rng.ts';
import type { GameState } from './state.ts';

export const rarityIndex = (r: Rarity): number => RARITIES.indexOf(r);

export function newUid(state: GameState): string {
  return `i${(state.nextUid++).toString(36)}`;
}

export function rollRarity(rng: Rng, luck: number, minIdx = 0): Rarity {
  const w = BAL.rarityDropWeights.map((x, i) => (i >= 2 ? x * (1 + luck) : x));
  let idx = 0;
  const total = w.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) { idx = i; break; } }
  idx = Math.max(idx, minIdx);
  return RARITIES[Math.min(idx, 3)]; // legendary never rolls from the generic table
}

function pickTemplate(rng: Rng, tier: number, rarity: Rarity): ItemTemplate {
  const pool = ITEM_LIST.filter((t) => !t.boss && (t.tier === tier || (t.tier === tier - 1 && rng.chance(0.25))) && rarityIndex(t.minRarity) <= rarityIndex(rarity) && rarityIndex(t.maxRarity) >= rarityIndex(rarity));
  const usable = pool.length ? pool : ITEM_LIST.filter((t) => !t.boss && t.tier <= tier);
  // set pieces are slightly favoured so sets can be completed in a chapter
  return rng.weighted(usable, (t) => (t.set ? 1.15 : 1));
}

export function makeItem(state: GameState, rng: Rng, opts: { floor: number; tier: number; rarity: Rarity; tpl?: string; from?: number }): ItemInstance {
  const tpl = opts.tpl ? ITEMS[opts.tpl] : pickTemplate(rng, opts.tier, opts.rarity);
  let rarity = opts.rarity;
  if (rarityIndex(rarity) < rarityIndex(tpl.minRarity)) rarity = tpl.minRarity;
  if (rarityIndex(rarity) > rarityIndex(tpl.maxRarity)) rarity = tpl.maxRarity;
  let affix: AffixId | undefined;
  if (tpl.affixes && tpl.affixes.length && (rarity === 'rare' || rarity === 'epic')) {
    if (rarity === 'epic' || rng.chance(0.65)) affix = rng.pick(tpl.affixes);
  }
  return { uid: newUid(state), tpl: tpl.id, ilvl: Math.max(1, opts.floor), rarity, plus: 0, affix, isNew: true, from: opts.from ?? opts.floor };
}

export function itemName(item: ItemInstance): string {
  const tpl = ITEMS[item.tpl];
  const aff = item.affix ? ` ${AFFIXES[item.affix].name}` : '';
  return `${tpl?.name ?? item.tpl}${aff}${item.plus ? ` +${item.plus}` : ''}`;
}

export function salvageValue(item: ItemInstance): { ore: number; cloth: number; gold: number } {
  const r = rarityIndex(item.rarity);
  const mult = [1, 1.6, 2.6, 4.5, 9][r];
  const s = 1 + item.ilvl / 30;
  const spent = item.plus * 0.5;
  return {
    ore: Math.max(1, Math.round(mult * s * (0.7 + spent) * (ITEMS[item.tpl]?.slot === 'accessory' ? 0.6 : 1))),
    cloth: Math.max(1, Math.round(mult * s * 0.6 * (ITEMS[item.tpl]?.slot === 'armour' || ITEMS[item.tpl]?.slot === 'accessory' ? 1.4 : 0.8))),
    gold: Math.round(mult * s * 6),
  };
}

export const RARITY_BUDGET = RARITY_MULT;
