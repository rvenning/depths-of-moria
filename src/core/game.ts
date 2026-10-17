import { HEROES } from '../content/heroes.ts';
import { ITEM_LIST, ITEMS } from '../content/items.ts';
import { CAMP, upgradeCost } from '../content/camp.ts';
import { RELICS, relicCost } from '../content/relics.ts';
import type { HeroId, ItemInstance, ItemSlot, Rarity, RelicId, Row, Rule, TargetPref, WeaponKind } from '../content/schema.ts';
import { HERO_IDS, RARITIES } from '../content/schema.ts';
import { BAL, levelCap, xpToNext } from './balance.ts';
import { makeItem, newUid, salvageValue } from './loot.ts';
import { Rng, mixSeed } from './rng.ts';
import { SAVE_VERSION, type GameState, type HeroState, type Settings } from './state.ts';
import { featureUnlocked, maxChapterReached } from './party.ts';
import { SLOTS, computeHero, itemScore } from './stats.ts';

export const defaultSettings = (): Settings => ({
  master: 0.8, music: 0.5, sfx: 0.7, ambience: 0.5,
  reducedMotion: typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  highContrast: false, graphics: 'auto', voice: false, textScale: 1, speed: 2, showLog: true, naming: 'fan',
  autoSalvageUpTo: null, lootFilter: 'common', autoDelve: false, confirmReset: true, skipStories: false,
});

function newHero(id: HeroId): HeroState {
  const d = HEROES[id];
  return {
    id, unlocked: false, level: 1, xp: 0, talents: [],
    equip: { weapon: null, armour: null, offhand: null, accessory1: null, accessory2: null },
    rules: d.defaultRules.map((r) => ({ ...r })), pref: 'default', row: d.defaultRow,
  };
}

export function newGame(seed = (Date.now() & 0x7fffffff) | 1): GameState {
  const heroes = Object.fromEntries(HERO_IDS.map((id) => [id, newHero(id)])) as Record<HeroId, HeroState>;
  const state: GameState = {
    v: SAVE_VERSION, created: Date.now(), playMs: 0, seed, settings: defaultSettings(),
    heroes, party: ['aragorn', null, null, null, null], presets: [],
    inventory: [], nextUid: 1,
    gold: 60, ore: 0, cloth: 0, essence: 0, renown: 0, shards: 0,
    relics: { light: 0, horn: 0, wisdom: 0, blessing: 0, fortune: 0, courage: 0 },
    bonds: {}, bondSeen: {}, age: 1, best: 0, ageStartBest: 0,
    camp: { age: {}, account: {} }, quests: {}, questsClaimed: {}, achievements: {}, counters: {},
    lore: [], codex: {}, itemsSeen: [], bosses: {}, expedition: null, flags: {},
    endless: { best: 1000, modifiers: 0 }, ladder: { cleared: 0 },
    shop: { seed: seed ^ 0x5a5a, stock: [], rerolls: 0 }, lastSummary: null, merchantCycle: 0,
  };
  unlockHero(state, 'aragorn');
  return state;
}

// ------------------------------------------------------------------ heroes
const WEAPON_FALLBACK: Record<WeaponKind, string> = {
  sword: 'sword', axe: 'axe', bow: 'bow', dagger: 'dagger', staff: 'staff', mace: 'mace', spear: 'spear', tool: 'tool',
};

/** Hero joins the company: starts a little behind the average level, with a starter kit of the current tier. */
export function unlockHero(state: GameState, id: HeroId): void {
  const h = state.heroes[id];
  if (h.unlocked) return;
  h.unlocked = true;
  const others = HERO_IDS.filter((x) => x !== id && state.heroes[x].unlocked);
  const avg = others.length ? others.reduce((a, x) => a + state.heroes[x].level, 0) / others.length : 1;
  h.level = Math.max(1, Math.floor(avg) - 1);
  h.xp = 0;
  starterKit(state, id);
  const free = state.party.indexOf(null);
  if (free >= 0 && !state.party.includes(id)) state.party[free] = id;
}

export function starterKit(state: GameState, id: HeroId): void {
  const d = HEROES[id];
  const tier = Math.max(1, Math.min(10, state.age));
  const floor = Math.max(1, (state.age - 1) * 100 + 1);
  const rng = new Rng(mixSeed(state.seed, id, state.age, 'kit'));
  const pick = (pred: (t: (typeof ITEM_LIST)[number]) => boolean) => {
    const pool = ITEM_LIST.filter((t) => !t.boss && t.tier === tier && pred(t));
    return pool.length ? rng.pick(pool) : ITEM_LIST.find((t) => !t.boss && pred(t))!;
  };
  const w = pick((t) => t.slot === 'weapon' && !!t.weapon && d.weapon.includes(t.weapon));
  const a = pick((t) => t.slot === 'armour');
  for (const t of [w, a]) {
    const it = makeItem(state, rng, { floor, tier, rarity: 'common', tpl: t.id });
    it.isNew = false;
    state.inventory.push(it);
    state.itemsSeen.includes(t.id) || state.itemsSeen.push(t.id);
    state.heroes[id].equip[t.slot === 'weapon' ? 'weapon' : 'armour'] = it.uid;
  }
}
void WEAPON_FALLBACK;

export function heroStatsSummary(state: GameState, id: HeroId) { return computeHero(state, id).stats; }

// ------------------------------------------------------------------ xp / levels / talents
export function ageLevelCap(state: GameState): number { return levelCap(state.age); }

export function grantXp(state: GameState, id: HeroId, xp: number): number[] {
  const h = state.heroes[id];
  const ups: number[] = [];
  const cap = ageLevelCap(state);
  if (h.level >= cap) { h.xp = 0; return ups; }
  h.xp += xp;
  while (h.level < cap && h.xp >= xpToNext(h.level)) {
    h.xp -= xpToNext(h.level);
    h.level++;
    ups.push(h.level);
  }
  if (h.level >= cap) h.xp = 0;
  return ups;
}

export function talentPoints(state: GameState, id: HeroId): { total: number; spent: number; free: number } {
  const h = state.heroes[id];
  const total = h.level - 1;
  const spent = h.talents.reduce((a, i) => a + (HEROES[id].talents[i]?.cost ?? 0), 0);
  return { total, spent, free: total - spent };
}
export function canBuyTalent(state: GameState, id: HeroId, idx: number): { ok: boolean; why?: string } {
  const h = state.heroes[id];
  const t = HEROES[id].talents[idx];
  if (!t) return { ok: false, why: 'No such talent' };
  if (h.talents.includes(idx)) return { ok: false, why: 'Already learned' };
  if (!t.requires.every((r) => h.talents.includes(r))) return { ok: false, why: 'Requires an earlier talent' };
  if (talentPoints(state, id).free < t.cost) return { ok: false, why: `Needs ${t.cost} talent point${t.cost === 1 ? '' : 's'}` };
  return { ok: true };
}
export function buyTalent(state: GameState, id: HeroId, idx: number): boolean {
  if (!canBuyTalent(state, id, idx).ok) return false;
  state.heroes[id].talents.push(idx);
  return true;
}
export function respecTalents(state: GameState, id: HeroId): void { state.heroes[id].talents = []; }

export function setRules(state: GameState, id: HeroId, rules: Rule[]): void { state.heroes[id].rules = rules.map((r) => ({ ...r })); }
export function setPref(state: GameState, id: HeroId, pref: TargetPref): void { state.heroes[id].pref = pref; }

// ------------------------------------------------------------------ party
export function setParty(state: GameState, party: (HeroId | null)[]): void {
  const seen = new Set<string>();
  const out: (HeroId | null)[] = [];
  for (let i = 0; i < 5; i++) {
    const id = party[i] ?? null;
    if (id && state.heroes[id].unlocked && !seen.has(id)) { seen.add(id); out.push(id); } else out.push(null);
  }
  if (!out.some(Boolean)) out[0] = HERO_IDS.find((h) => state.heroes[h].unlocked) ?? null;
  state.party = out;
}
export function presetSlots(state: GameState): number { return 1 + (state.camp.account.presets ?? 0); }
export function savePreset(state: GameState, name: string, idx: number): boolean {
  if (idx >= presetSlots(state)) return false;
  state.presets[idx] = { name, party: [...state.party], rows: {} };
  return true;
}
export function loadPreset(state: GameState, idx: number): boolean {
  const p = state.presets[idx];
  if (!p) return false;
  setParty(state, p.party);
  return true;
}

// ------------------------------------------------------------------ inventory
export const getItem = (state: GameState, uid: string | null): ItemInstance | undefined => (uid ? state.inventory.find((i) => i.uid === uid) : undefined);

export function equippedBy(state: GameState, uid: string): HeroId | null {
  for (const id of HERO_IDS) if (SLOTS.some((s) => state.heroes[id].equip[s] === uid)) return id;
  return null;
}

export function canEquip(_state: GameState, heroId: HeroId, item: ItemInstance, slot: ItemSlot): boolean {
  const tpl = ITEMS[item.tpl];
  if (!tpl) return false;
  const isAcc = slot.startsWith('accessory');
  if (tpl.slot === 'accessory') { if (!isAcc) return false; } else if (tpl.slot !== slot) return false;
  if (tpl.slot === 'weapon' && tpl.weapon && !HEROES[heroId].weapon.includes(tpl.weapon)) return false;
  return true;
}

export function equip(state: GameState, heroId: HeroId, uid: string, slot?: ItemSlot): boolean {
  const item = getItem(state, uid);
  if (!item) return false;
  const tpl = ITEMS[item.tpl];
  let target: ItemSlot | undefined = slot;
  if (!target) {
    if (tpl.slot === 'accessory') target = state.heroes[heroId].equip.accessory1 ? (state.heroes[heroId].equip.accessory2 ? 'accessory1' : 'accessory2') : 'accessory1';
    else target = tpl.slot as ItemSlot;
  }
  if (!canEquip(state, heroId, item, target)) return false;
  const prev = equippedBy(state, uid);
  if (prev) for (const s of SLOTS) if (state.heroes[prev].equip[s] === uid) state.heroes[prev].equip[s] = null;
  const old = state.heroes[heroId].equip[target];
  state.heroes[heroId].equip[target] = uid;
  // if the item came from another hero, give them the one we displaced when it fits
  if (prev && old && prev !== heroId) {
    const oi = getItem(state, old);
    if (oi) for (const s of SLOTS) if (canEquip(state, prev, oi, s) && !state.heroes[prev].equip[s]) { state.heroes[prev].equip[s] = old; break; }
  }
  item.isNew = false;
  return true;
}
export function unequip(state: GameState, heroId: HeroId, slot: ItemSlot): void { state.heroes[heroId].equip[slot] = null; }

export function salvage(state: GameState, uid: string): boolean {
  const item = getItem(state, uid);
  if (!item || item.locked || equippedBy(state, uid)) return false;
  const v = salvageValue(item);
  state.ore += v.ore; state.cloth += v.cloth; state.gold += v.gold;
  state.inventory = state.inventory.filter((i) => i.uid !== uid);
  state.counters.salvaged = (state.counters.salvaged ?? 0) + 1;
  return true;
}
export function salvageBelow(state: GameState, upTo: Rarity): number {
  const cap = RARITIES.indexOf(upTo);
  let n = 0;
  for (const it of state.inventory.slice()) {
    if (RARITIES.indexOf(it.rarity) <= cap && !it.locked && !equippedBy(state, it.uid) && !ITEMS[it.tpl]?.boss && salvage(state, it.uid)) n++;
  }
  return n;
}
export function toggleLock(state: GameState, uid: string): void { const i = getItem(state, uid); if (i) i.locked = !i.locked; }

/** auto-equip suggestion: best item for each empty/weaker slot, without stripping other heroes */
export function suggestEquip(state: GameState, heroId: HeroId): { slot: ItemSlot; item: ItemInstance; gain: number }[] {
  const role = HEROES[heroId].role === 'mage' || HEROES[heroId].role === 'healer' ? 'mag' : HEROES[heroId].role === 'protector' || HEROES[heroId].role === 'bruiser' ? 'tank' : 'phys';
  const out: { slot: ItemSlot; item: ItemInstance; gain: number }[] = [];
  const used = new Set<string>();
  for (const slot of SLOTS) {
    const curUid = state.heroes[heroId].equip[slot];
    const cur = getItem(state, curUid);
    const curScore = cur ? itemScore(cur, role) : 0;
    let best: ItemInstance | null = null; let bestScore = curScore;
    for (const it of state.inventory) {
      if (used.has(it.uid) || it.uid === curUid) continue;
      const other = equippedBy(state, it.uid);
      if (other && other !== heroId) continue;
      if (!canEquip(state, heroId, it, slot)) continue;
      const sc = itemScore(it, role);
      if (sc > bestScore * 1.02) { best = it; bestScore = sc; }
    }
    if (best) { out.push({ slot, item: best, gain: bestScore - curScore }); used.add(best.uid); }
  }
  return out;
}
export function autoEquip(state: GameState, heroId: HeroId): number {
  const s = suggestEquip(state, heroId);
  for (const x of s) equip(state, heroId, x.item.uid, x.slot);
  return s.length;
}
export function autoEquipAll(state: GameState): number {
  let n = 0;
  for (const id of HERO_IDS) if (state.heroes[id].unlocked) n += autoEquip(state, id);
  return n;
}

// ------------------------------------------------------------------ camp: per-Age scale, upgrades, services
/** gold costs scale with the Age so upgrades stay meaningful as income grows */
export function goldScale(age: number): number { return Math.pow(100 * (age - 1) + 50, BAL.goldFloorExp) / Math.pow(50, BAL.goldFloorExp); }

export function campCost(state: GameState, id: string): number | null {
  const u = CAMP[id];
  if (!u) return null;
  const lvl = (u.kind === 'age' ? state.camp.age : state.camp.account)[id] ?? 0;
  if (lvl >= u.maxLevel) return null;
  const base = upgradeCost(u, lvl);
  if (u.kind === 'account') return base;
  const disc = 1 - Math.min(0.24, (state.camp.age.haggler ?? 0) * 0.03);
  return Math.max(1, Math.round(base * goldScale(state.age) * disc));
}
export function buyCamp(state: GameState, id: string): boolean {
  const u = CAMP[id];
  const cost = campCost(state, id);
  if (!u || cost === null) return false;
  if (u.kind === 'age') { if (state.gold < cost) return false; state.gold -= cost; state.camp.age[id] = (state.camp.age[id] ?? 0) + 1; }
  else { if (state.renown < cost) return false; state.renown -= cost; state.camp.account[id] = (state.camp.account[id] ?? 0) + 1; }
  return true;
}

export function trainCost(state: GameState, id: HeroId): number {
  const h = state.heroes[id];
  return Math.round(120 * goldScale(state.age) * (1 + h.level / 8));
}
/** Training Yard: turn gold into experience (a gold sink) */
export function trainHero(state: GameState, id: HeroId): number[] {
  const cost = trainCost(state, id);
  const h = state.heroes[id];
  if (!h.unlocked || state.gold < cost || h.level >= ageLevelCap(state)) return [];
  state.gold -= cost;
  return grantXp(state, id, Math.round(xpToNext(h.level) * 0.35));
}

export const SUPPLY_COST = (state: GameState): number => Math.max(5, Math.round(40 * goldScale(state.age)));
export const suppliesCap = (state: GameState): number => 4 + (state.camp.age.larder ?? 0);
export function buySupplies(state: GameState, n = 1): number {
  let bought = 0;
  for (let i = 0; i < n; i++) {
    const cost = SUPPLY_COST(state);
    if ((state.counters.supplies ?? 0) >= suppliesCap(state) || state.gold < cost) break;
    state.gold -= cost; state.counters.supplies = (state.counters.supplies ?? 0) + 1; bought++;
  }
  return bought;
}

// ------------------------------------------------------------------ relics
export function relicNextCost(state: GameState, id: RelicId): number | null {
  const d = RELICS[id];
  const lvl = state.relics[id] ?? 0;
  if (lvl >= d.maxLevel) return null;
  return relicCost(d, lvl);
}
export function upgradeRelic(state: GameState, id: RelicId): boolean {
  const c = relicNextCost(state, id);
  if (c === null || state.essence < c) return false;
  state.essence -= c;
  state.relics[id] = (state.relics[id] ?? 0) + 1;
  state.counters.relicLevels = (state.counters.relicLevels ?? 0) + 1;
  return true;
}

// ------------------------------------------------------------------ merchant
export function merchantPrice(state: GameState, item: ItemInstance): number {
  const r = RARITIES.indexOf(item.rarity);
  const disc = 1 - Math.min(0.24, (state.camp.age.haggler ?? 0) * 0.03);
  return Math.round(goldScale(state.age) * [90, 260, 700, 1800, 5000][r] * disc);
}
export function refreshShop(state: GameState, free = false): void {
  const rng = new Rng(mixSeed(state.seed, state.age, state.shop.rerolls, state.merchantCycle, 'shop'));
  const floor = Math.max(1, (state.age - 1) * 100 + 10 + Math.min(80, state.best % 100));
  const stock: ItemInstance[] = [];
  for (let i = 0; i < 6; i++) {
    const rarity: Rarity = i < 2 ? 'common' : i < 4 ? 'uncommon' : i === 4 ? 'rare' : rng.chance(0.2) ? 'epic' : 'rare';
    const it = makeItem(state, rng, { floor, tier: state.age, rarity });
    stock.push(it);
  }
  state.shop.stock = stock;
  if (!free) state.shop.rerolls++;
}
export function shopRerollCost(state: GameState): number { return Math.round(goldScale(state.age) * 160); }
export function buyShopItem(state: GameState, uid: string): boolean {
  const it = state.shop.stock.find((i) => i.uid === uid);
  if (!it) return false;
  const price = merchantPrice(state, it);
  if (state.gold < price) return false;
  state.gold -= price;
  state.shop.stock = state.shop.stock.filter((i) => i.uid !== uid);
  state.inventory.push({ ...it, uid: newUid(state), isNew: true });
  if (!state.itemsSeen.includes(it.tpl)) state.itemsSeen.push(it.tpl);
  state.counters.itemsBought = (state.counters.itemsBought ?? 0) + 1;
  return true;
}

// ------------------------------------------------------------------ forge
export function forgeUnlocked(state: GameState): boolean { return featureUnlocked(state, 'forge'); }
export const MAX_PLUS = 10;

export function upgradeCostFor(state: GameState, item: ItemInstance): { ore: number; cloth: number; gold: number } {
  const r = RARITIES.indexOf(item.rarity);
  const n = item.plus + 1;
  const s = 1 + item.ilvl / 30;
  const disc = 1 - Math.min(0.24, (state.camp.age.haggler ?? 0) * 0.03);
  return {
    ore: Math.max(1, Math.round((1 + r * 0.6) * s * Math.pow(n, 1.35) * 1.2)),
    cloth: Math.max(1, Math.round((1 + r * 0.5) * s * Math.pow(n, 1.2) * 0.9)),
    gold: Math.round(goldScale(Math.max(1, Math.ceil(item.ilvl / 100))) * 60 * Math.pow(n, 1.5) * disc),
  };
}
export function upgradeItem(state: GameState, uid: string): boolean {
  const it = getItem(state, uid);
  if (!it || !forgeUnlocked(state) || it.plus >= MAX_PLUS) return false;
  const c = upgradeCostFor(state, it);
  if (state.ore < c.ore || state.cloth < c.cloth || state.gold < c.gold) return false;
  state.ore -= c.ore; state.cloth -= c.cloth; state.gold -= c.gold;
  it.plus++;
  state.counters.forged = (state.counters.forged ?? 0) + 1;
  return true;
}
export function reforgeCost(state: GameState, item: ItemInstance): { ore: number; cloth: number; gold: number } {
  const c = upgradeCostFor(state, { ...item, plus: Math.max(0, item.plus) });
  return { ore: Math.round(c.ore * 1.5), cloth: Math.round(c.cloth * 1.5), gold: Math.round(c.gold * 1.5) };
}
export function reforgeAffix(state: GameState, uid: string, rngSeed: number): boolean {
  const it = getItem(state, uid);
  const tpl = it && ITEMS[it.tpl];
  if (!it || !tpl || !forgeUnlocked(state) || !tpl.affixes?.length || it.rarity === 'common' || it.rarity === 'uncommon' || tpl.signature) return false;
  const c = reforgeCost(state, it);
  if (state.ore < c.ore || state.cloth < c.cloth || state.gold < c.gold) return false;
  state.ore -= c.ore; state.cloth -= c.cloth; state.gold -= c.gold;
  const rng = new Rng(rngSeed);
  const pool = tpl.affixes.filter((a) => a !== it.affix);
  it.affix = (pool.length ? rng.pick(pool) : it.affix);
  state.counters.reforged = (state.counters.reforged ?? 0) + 1;
  return true;
}
export const ASCEND_SHARDS = 3;
export function canAscend(state: GameState, item: ItemInstance): boolean {
  return featureUnlocked(state, 'legendary') && item.rarity === 'epic' && !ITEMS[item.tpl]?.signature && state.shards >= ASCEND_SHARDS;
}
export function ascendItem(state: GameState, uid: string): boolean {
  const it = getItem(state, uid);
  if (!it || !canAscend(state, it)) return false;
  state.shards -= ASCEND_SHARDS;
  it.rarity = 'legendary';
  const pool = ITEMS[it.tpl].affixes ?? [];
  if (!it.affix && pool.length) it.affix = pool[0];
  state.counters.ascended = (state.counters.ascended ?? 0) + 1;
  return true;
}

export { maxChapterReached };
export type { Row };
