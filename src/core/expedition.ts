import { CHAPTERS, CHAPTER_BY_N } from '../content/chapters.ts';
import { EVENTS, EVENT_BY_ID } from '../content/events.ts';
import { HEROES } from '../content/heroes.ts';
import { ITEM_LIST, ITEMS } from '../content/items.ts';
import { LORE, LORE_BY_ID } from '../content/lore.ts';
import { BONDS, bondId } from '../content/bonds.ts';
import type { EventChoice, EventOutcome, HeroId, ItemInstance } from '../content/schema.ts';
import { HERO_IDS, RARITIES } from '../content/schema.ts';
import { BAL, refLevel as refLevelB, xpToNext } from './balance.ts';
import { Battle } from './battle/engine.ts';
import type { BattleResult } from './battle/types.ts';
import { type FloorPlan, MAX_CAMPAIGN_FLOOR, isCheckpointFloor, planFloor } from './floors.ts';
import { ageLevelCap, goldScale, grantXp, salvage, starterKit, unlockHero } from './game.ts';
import { makeItem, newUid, rarityIndex, rollRarity, salvageValue } from './loot.ts';
import { checkAchievements, discoverItem, recordCodex } from './meta.ts';
import { battleSeed, buildSetup, formation } from './party.ts';
import { Rng, mixSeed } from './rng.ts';
import type { BattleSummary, Expedition, GameState, RoomKind } from './state.ts';
import { computeHero } from './stats.ts';

// ------------------------------------------------------------------ helpers
export const floorGold = (f: number): number => BAL.goldPerFloor * Math.pow(Math.max(1, f), BAL.goldFloorExp);
export const refLevel = refLevelB;
export const floorXp = (f: number): number => BAL.xpFrac * xpToNext(Math.max(1, Math.round(refLevel(f))));

export function maxStartFloor(state: GameState): number {
  const cap = state.age * 100;
  return Math.min(cap, Math.floor(Math.min(state.best, cap - 1) / 10) * 10 + 1);
}
export function validStartFloors(state: GameState): number[] {
  const out: number[] = [];
  const max = maxStartFloor(state);
  for (let f = 1; f <= max; f += 10) out.push(f);
  return out;
}
export function endlessUnlocked(state: GameState): boolean { return state.best >= MAX_CAMPAIGN_FLOOR; }
export function validEndlessStarts(state: GameState): number[] {
  const out = [1001];
  for (let f = 1026; f <= state.endless.best + 1; f += 25) out.push(f);
  return out;
}

function partyIds(state: GameState): HeroId[] { return formation(state).map((f) => f.id); }

export function partyBonuses(state: GameState): { gold: number; xp: number; luck: number } {
  let gold = 0; let xp = 0;
  const ids = partyIds(state);
  let fort = 0;
  for (const id of ids) {
    const c = computeHero(state, id);
    xp = Math.max(xp, c.xpBonus);
    gold += c.goldBonus;
    fort = Math.max(fort, c.goldBonus);
  }
  const g = ids.length ? gold / ids.length : 0;
  return { gold: g, xp, luck: g / 3 };
}

export function currentPlan(state: GameState): FloorPlan | null {
  const e = state.expedition;
  if (!e) return null;
  return planFloor(e.floor, mixSeed(state.seed, e.attempt), e.party.length, (e as Expedition & { forceKind?: RoomKind }).forceKind);
}
interface ExpFlags { forceKind?: RoomKind; mode?: 'campaign' | 'endless' | 'ladder'; rung?: number; ladderPlan?: FloorPlan }
const xf = (e: Expedition): Expedition & ExpFlags => e as Expedition & ExpFlags;

export function getPlan(state: GameState): FloorPlan | null {
  const e = state.expedition;
  if (!e) return null;
  const f = xf(e);
  if (f.mode === 'ladder' && f.ladderPlan) return f.ladderPlan;
  return currentPlan(state);
}

// ------------------------------------------------------------------ start
export function canStart(state: GameState, floor: number, endless = false): { ok: boolean; why?: string } {
  if (state.expedition) return { ok: false, why: 'An expedition is already underway.' };
  if (!formation(state).length) return { ok: false, why: 'Choose at least one hero.' };
  if (endless) {
    if (!endlessUnlocked(state)) return { ok: false, why: 'Defeat the Balrog first.' };
    if (!validEndlessStarts(state).includes(floor)) return { ok: false, why: 'Not a valid Deep Delve start.' };
    return { ok: true };
  }
  if (!validStartFloors(state).includes(floor)) return { ok: false, why: 'Reach that checkpoint first.' };
  return { ok: true };
}

export function startExpedition(state: GameState, floor: number, endless = false): boolean {
  if (!canStart(state, floor, endless).ok) return false;
  const ids = partyIds(state);
  const attempt = (state.counters.attempt = (state.counters.attempt ?? 0) + 1);
  const hp: Partial<Record<HeroId, number>> = {};
  for (const id of ids) hp[id] = 1;
  const exp: Expedition = {
    startFloor: floor, floor, attempt, room: null, phase: 'room', hp,
    gold: 0, ore: 0, cloth: 0, essence: 0, renown: 0, shards: 0, xp: 0, items: [], lore: [], buffs: [],
    supplies: Math.min(state.counters.supplies ?? 0, 4 + (state.camp.age.larder ?? 0)), cleared: 0, newBest: false, doorSeed: 0,
    eventId: null, doorChoices: null, log: [], party: ids, formation: {}, endless, ended: null,
  };
  state.counters.supplies = Math.max(0, (state.counters.supplies ?? 0) - exp.supplies);
  state.expedition = exp;
  state.counters.expeditions = (state.counters.expeditions ?? 0) + 1;
  xf(exp).mode = endless ? 'endless' : 'campaign';
  enterFloor(state);
  return true;
}

export function startLadder(state: GameState, rung: number): boolean {
  if (state.expedition || !endlessUnlocked(state) || rung > state.ladder.cleared + 1 || rung < 1 || !formation(state).length) return false;
  const ids = partyIds(state);
  const attempt = (state.counters.attempt = (state.counters.attempt ?? 0) + 1);
  const hp: Partial<Record<HeroId, number>> = {};
  for (const id of ids) hp[id] = 1;
  const plan = planLadder(rung, state.seed);
  const exp: Expedition = {
    startFloor: plan.floor, floor: plan.floor, attempt, room: plan.kind, phase: 'room', hp,
    gold: 0, ore: 0, cloth: 0, essence: 0, renown: 0, shards: 0, xp: 0, items: [], lore: [], buffs: [],
    supplies: 0, cleared: 0, newBest: false, doorSeed: 0, eventId: null, doorChoices: null, log: [], party: ids, formation: {}, endless: true, ended: null,
  };
  const f = xf(exp); f.mode = 'ladder'; f.rung = rung; f.ladderPlan = plan;
  state.expedition = exp;
  state.counters.expeditions = (state.counters.expeditions ?? 0) + 1;
  return true;
}

export const LADDER_RUNGS = 30;
export function planLadder(rung: number, seed: number): FloorPlan {
  const rng = new Rng(mixSeed(seed, rung, 'ladder'));
  const floor = 930 + 5 * rung;
  const bosses = CHAPTERS.map((c) => c.boss);
  const elites = CHAPTERS.map((c) => c.elite);
  const ids: string[] = [];
  const nBoss = rung % 5 === 0 ? 2 : 1;
  for (let i = 0; i < nBoss; i++) ids.push(rng.pick(bosses));
  const pool = rung % 2 === 0 ? elites : CHAPTERS.flatMap((c) => c.minis);
  while (ids.length < 3) ids.push(rng.pick(pool));
  const rules: FloorPlan['challenge'] = [rng.pick(['noHealing', 'darkness', 'glass', 'silence', 'haste', 'armoured'] as const)];
  const slots = ids.map((id, i) => ({ id, slot: i }));
  return {
    floor, chapter: 10, inChapter: 100, endless: true, kind: 'boss', tag: 'challenge', title: `Ladder Rung ${rung}`,
    subtitle: `Trial of the Deep — ${rules[0]}`, waves: [slots], hazards: [{ kind: 'crumble', every: 5, power: 8 }], challenge: rules,
    goldMult: 0, xpMult: 6, essence: 10 + rung * 3, guaranteedRarity: 3, dropCount: 2, bg: 'arena', checkpoint: false,
  };
}

// ------------------------------------------------------------------ entering a floor
export function enterFloor(state: GameState): void {
  const e = state.expedition;
  if (!e) return;
  const f = xf(e);
  f.forceKind = undefined;
  const plan = planFloor(e.floor, mixSeed(state.seed, e.attempt), e.party.length);
  e.room = plan.kind;
  e.eventId = null; e.doorChoices = null;
  if (plan.kind === 'door') { e.phase = 'door'; e.doorChoices = plan.doorChoices ?? ['battle', 'rest']; }
  else if (plan.kind === 'event') { pickEvent(state, plan); e.phase = 'event'; }
  else e.phase = 'room';
  for (const w of plan.waves) for (const en of w) recordCodex(state, en.id, false);
}

function pickEvent(state: GameState, plan: FloorPlan): void {
  const e = state.expedition as Expedition;
  const rng = new Rng(mixSeed(state.seed, e.floor, e.attempt, 'event'));
  const ch = plan.chapter;
  const pool = EVENTS.filter((ev) => !ev.chapters || (ch >= ev.chapters[0] && ch <= ev.chapters[1]));
  e.eventId = rng.pick(pool).id;
}

export function chooseDoor(state: GameState, kind: RoomKind): void {
  const e = state.expedition;
  if (!e || e.phase !== 'door') return;
  xf(e).forceKind = kind;
  e.room = kind;
  e.doorChoices = null;
  const plan = currentPlan(state) as FloorPlan;
  if (kind === 'event') { pickEvent(state, plan); e.phase = 'event'; }
  else e.phase = 'room';
}

// ------------------------------------------------------------------ events
export function eventChoiceAvailable(state: GameState, c: EventChoice): { ok: boolean; why?: string } {
  const e = state.expedition;
  if (!e) return { ok: false };
  if (c.requires?.hero && !e.party.includes(c.requires.hero)) return { ok: false, why: `${HEROES[c.requires.hero].name} is not in the party` };
  if (c.requires?.gold) {
    const need = c.requires.gold * floorGold(e.floor);
    if (e.gold + state.gold < need) return { ok: false, why: 'Not enough gold' };
  }
  return { ok: true };
}

export interface EventResult { text: string; lines: string[]; fight: boolean; fightElite: boolean }

export function resolveEvent(state: GameState, choiceIdx: number): EventResult | null {
  const e = state.expedition;
  if (!e || e.phase !== 'event' || !e.eventId) return null;
  const ev = EVENT_BY_ID[e.eventId];
  const choice = ev.choices[choiceIdx];
  if (!choice || !eventChoiceAvailable(state, choice).ok) return null;
  const rng = new Rng(mixSeed(state.seed, e.floor, e.attempt, 'evres', choiceIdx));
  let r = rng.next();
  let outcome = choice.outcomes[choice.outcomes.length - 1];
  for (const o of choice.outcomes) { r -= o.chance; if (r < 0) { outcome = o; break; } }
  const lines: string[] = [outcome.text];
  let fight = false; let elite = false;
  for (const res of outcome.results) {
    const l = applyOutcome(state, e, res, rng);
    if (res.k === 'fight') { fight = true; elite = res.elite; }
    if (l) lines.push(l);
  }
  state.counters.eventsDone = (state.counters.eventsDone ?? 0) + 1;
  e.eventId = null;
  if (fight) {
    xf(e).forceKind = elite ? 'elite' : 'battle';
    e.room = elite ? 'elite' : 'battle';
    e.phase = 'room';
  } else {
    advanceFloor(state, true);
  }
  checkAchievements(state);
  return { text: outcome.text, lines, fight, fightElite: elite };
}

function applyOutcome(state: GameState, e: Expedition, res: EventOutcome, rng: Rng): string | null {
  const f = e.floor;
  switch (res.k) {
    case 'gold': {
      const amt = Math.round(res.amount * floorGold(f));
      if (amt >= 0) { e.gold += amt; return `+${amt} gold`; }
      let pay = -amt;
      const fromExp = Math.min(e.gold, pay); e.gold -= fromExp; pay -= fromExp;
      state.gold = Math.max(0, state.gold - pay);
      return `−${-amt} gold`;
    }
    case 'essence': e.essence += res.amount; return `+${res.amount} relic essence`;
    case 'item': {
      const it = makeItem(state, rng, { floor: f, tier: Math.min(10, Math.max(1, Math.ceil(Math.min(f, 1000) / 100))), rarity: RARITIES[Math.max(rarityIndex(res.rarity), 0)] });
      e.items.push(it); discoverItem(state, it.tpl);
      return `Found ${ITEMS[it.tpl].name} (${it.rarity})`;
    }
    case 'materials': e.ore += res.ore; e.cloth += res.cloth; return `+${res.ore} ore, +${res.cloth} cloth`;
    case 'healPct': for (const id of e.party) e.hp[id] = Math.min(1, Math.max(e.hp[id] ?? 1, 0.05) + res.pct / 100); return `The party recovers ${res.pct}% health`;
    case 'damagePct': for (const id of e.party) e.hp[id] = Math.max(0.05, (e.hp[id] ?? 1) - res.pct / 100); return `The party loses ${res.pct}% health`;
    case 'buff': e.buffs.push({ stat: res.stat, pct: res.pct, battles: res.battles, label: 'Event boon' }); return `+${res.pct}${['crit', 'acc', 'eva', 'spd', 'critDmg'].includes(res.stat) ? '' : '%'} ${res.stat.toUpperCase()} for ${res.battles} battles`;
    case 'curse': e.buffs.push({ stat: res.stat, pct: res.pct, battles: res.battles, label: 'Curse' }); return `${res.pct}${['crit', 'acc', 'eva', 'spd', 'critDmg'].includes(res.stat) ? '' : '%'} ${res.stat.toUpperCase()} for ${res.battles} battles`;
    case 'xp': { const amt = Math.round(res.amount * (1 + f / 200)); for (const id of e.party) grantXp(state, id, amt); e.xp += amt; return `+${amt} experience each`; }
    case 'lore': unlockLore(state, res.id, e); return 'New lore entry';
    case 'renown': e.renown += res.amount; return `+${res.amount} renown`;
    case 'supplies': e.supplies += res.amount; return `+${res.amount} supplies`;
    case 'affinity': addAffinity(state, e.party, res.amount); return 'The company grows closer';
    default: return null;
  }
}

export function unlockLore(state: GameState, id: string, e?: Expedition): boolean {
  if (!LORE_BY_ID[id] || state.lore.includes(id)) return false;
  state.lore.push(id);
  e?.lore.push(id);
  return true;
}

function addAffinity(state: GameState, ids: HeroId[], amt: number): void {
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const id = bondId(ids[i], ids[j]);
    if (!BONDS[id]) continue;
    state.bonds[id] = (state.bonds[id] ?? 0) + amt;
  }
}

export function takeRest(state: GameState): void {
  const e = state.expedition;
  if (!e || e.phase !== 'room' || e.room !== 'rest') return;
  for (const id of e.party) e.hp[id] = Math.min(1, Math.max(e.hp[id] ?? 1, 0.05) + 0.4);
  e.supplies += 1;
  e.log.push('The company rests in a quiet alcove.');
  advanceFloor(state, true);
}

// ------------------------------------------------------------------ battle
export interface BattleStart { battle: Battle; plan: FloorPlan; seed: number }

export function prepareBattle(state: GameState, record = true): BattleStart | null {
  const e = state.expedition;
  if (!e || e.phase !== 'room') return null;
  const plan = getPlan(state);
  if (!plan || !plan.waves.length) return null;
  const buffs = e.buffs.filter((b) => b.battles > 0);
  const setup = buildSetup(state, plan, { hp: e.hp, buffs, attempt: e.attempt });
  const seed = battleSeed(state, e.floor, e.attempt * 31 + (e.cleared));
  return { battle: new Battle(setup, seed, { record }), plan, seed };
}

/** Run the next floor instantly (Accelerated Traversal). Returns the summary, or null if it would not be a safe skip. */
export function quickResolve(state: GameState): BattleSummary | null {
  const bs = prepareBattle(state, false);
  if (!bs) return null;
  const res = bs.battle.run();
  return applyBattleResult(state, bs.plan, res, true);
}

export function traversalSafe(state: GameState): boolean {
  const e = state.expedition;
  if (!e || !(state.camp.account.traversal ?? 0)) return false;
  const plan = getPlan(state);
  if (!plan || plan.tag === 'boss' || plan.tag === 'challenge') return false;
  return e.floor <= state.best - 10 || Math.ceil(e.floor / 100) < state.age;
}

function between(state: GameState, e: Expedition, res: BattleResult, plan: FloorPlan): void {
  const infirm = 1 + (state.camp.age.infirmary ?? 0) * 0.15;
  const checkpoint = isCheckpointFloor(plan.floor) && !plan.endless || (plan.endless && plan.floor % 10 === 0);
  const fieldcraft = 1 + (state.camp.account.fieldcraft ?? 0) * 0.05;
  for (const h of res.heroes) {
    if (!h.heroId) continue;
    let hp = h.alive ? h.hpFrac : 0.25;
    hp += BAL.betweenFloorHeal * infirm;
    const pb = computeHero(state, h.heroId).passives;
    void pb;
    e.hp[h.heroId] = Math.min(1, hp);
  }
  // post-battle healing passives (Sam's Gardener's Care, Hobbit Appetite)
  let post = 0;
  for (const id of e.party) {
    const hd = HEROES[id];
    const pass = [hd.passive];
    void pass;
  }
  for (const id of e.party) {
    const hs = state.heroes[id];
    post += postBattleHealPct(state, id);
    void hs;
  }
  if (post > 0) for (const id of e.party) e.hp[id] = Math.min(1, (e.hp[id] ?? 1) + post / 100);
  if (checkpoint) { for (const id of e.party) e.hp[id] = 1; void fieldcraft; }
  // supplies: auto-use on hurt heroes
  for (const id of e.party) {
    if (e.supplies > 0 && (e.hp[id] ?? 1) < 0.35) { e.hp[id] = Math.min(1, (e.hp[id] ?? 0) + 0.4); e.supplies--; e.log.push(`${HEROES[id].name} uses a supply.`); }
  }
  for (const b of e.buffs) b.battles--;
  e.buffs = e.buffs.filter((b) => b.battles > 0);
}

function postBattleHealPct(state: GameState, id: HeroId): number {
  const def = HEROES[id];
  let pct = 0;
  const hs = state.heroes[id];
  const base = def.passive === 'sam-passive' ? 12 : 0;
  pct += base;
  for (const idx of hs.talents) {
    for (const ef of def.talents[idx]?.effects ?? []) if (ef.kind === 'passive' && ef.effect.kind === 'postBattleHeal') pct += ef.effect.pct;
  }
  return pct;
}

export function applyBattleResult(state: GameState, plan: FloorPlan, res: BattleResult, quick = false): BattleSummary {
  const e = state.expedition as Expedition;
  const victory = res.result === 'victory';
  const rng = new Rng(mixSeed(state.seed, plan.floor, e.attempt, 'reward', e.cleared));
  const summary: BattleSummary = {
    floor: plan.floor, result: res.result, rounds: res.rounds,
    heroes: res.heroes.filter((h) => h.heroId).map((h) => ({ id: h.heroId as HeroId, dealt: h.dealt, healed: h.healed, taken: h.taken, kills: h.kills, alive: h.alive, hpFrac: h.hpFrac })),
    gold: 0, xp: 0, essence: 0, items: [], levelUps: [], kills: res.killedEnemies.map((k) => k.id),
  };
  const bonus = partyBonuses(state);
  const conquered = !plan.endless && plan.floor <= state.best;
  const oldAge = !plan.endless && plan.chapter < state.age;
  const ladder = xf(e).mode === 'ladder';
  const repeatMult = ladder ? 1 : (conquered ? 0.5 : 1) * (oldAge ? 0.5 : 1) * (quick ? 0.7 : 1);

  // counters
  const C = state.counters;
  C.crits = (C.crits ?? 0) + res.crits;
  C.combosFired = (C.combosFired ?? 0) + res.combosFired;
  for (const k of res.killedEnemies) {
    C.kills = (C.kills ?? 0) + 1;
    if (k.tier === 'boss') C.bossKills = (C.bossKills ?? 0) + 1;
    if (k.tier === 'mini') C.miniKills = (C.miniKills ?? 0) + 1;
    if (k.tier === 'elite') C.eliteKills = (C.eliteKills ?? 0) + 1;
    recordCodex(state, k.id, true);
  }

  if (!victory) {
    C.battlesLost = (C.battlesLost ?? 0) + 1;
    const xp = Math.round(floorXp(plan.floor) * plan.xpMult * 0.4 * (1 + bonus.xp));
    for (const id of e.party) summary.levelUps.push(...grantXp(state, id, xp).map((level) => ({ id, level })));
    summary.xp = xp; e.xp += xp;
    e.ended = { reason: 'defeat', keep: BAL.defeatKeep };
    e.phase = 'ended';
    e.log.push(`Defeated on floor ${plan.floor}.`);
    state.lastSummary = summary;
    return summary;
  }

  // rewards ------------------------------------------------
  C.battlesWon = (C.battlesWon ?? 0) + 1;
  if (res.deaths === 0) C.flawless = (C.flawless ?? 0) + 1;
  if (plan.tag === 'challenge') { C.challengesWon = (C.challengesWon ?? 0) + 1; if (plan.challenge.includes('noHealing')) C.noHealWins = (C.noHealWins ?? 0) + 1; }

  const first = !plan.endless && plan.floor > state.best;
  const gold = Math.round(floorGold(plan.floor) * plan.goldMult * rng.range(0.85, 1.15) * (1 + bonus.gold) * repeatMult * (first ? 1.25 : 1));
  const xp = Math.round(floorXp(plan.floor) * plan.xpMult * (1 + bonus.xp) * repeatMult);
  let essence = Math.round(plan.essence * (first ? 1.5 : repeatMult < 1 ? 0.5 : 1));
  if (plan.tag === 'normal' && plan.inChapter % 5 !== 0) essence = 0;
  e.gold += gold; e.xp += xp; e.essence += essence;
  summary.gold = gold; summary.xp = xp; summary.essence = essence;
  C.goldEarned = (C.goldEarned ?? 0) + gold;

  for (const id of e.party) summary.levelUps.push(...grantXp(state, id, xp).map((level) => ({ id, level })));

  // materials
  if (rng.chance(0.55 + (plan.tag === 'normal' ? 0 : 0.4))) { const o = Math.max(1, Math.round((1 + plan.floor / 60) * (0.6 + plan.dropCount * 0.4) * repeatMult * rng.range(0.7, 1.3))); e.ore += o; }
  if (rng.chance(0.5 + (plan.tag === 'normal' ? 0 : 0.4))) { const c = Math.max(1, Math.round((1 + plan.floor / 60) * (0.5 + plan.dropCount * 0.35) * repeatMult * rng.range(0.7, 1.3))); e.cloth += c; }

  // items
  const luck = bonus.luck;
  const tier = Math.min(10, Math.max(1, plan.chapter));
  const dropP = plan.tag === 'normal' || plan.tag === 'ambush' ? 0.38 : 0.85;
  const rolls = plan.dropCount;
  for (let i = 0; i < rolls; i++) {
    if (i > 0 || plan.guaranteedRarity === undefined) { if (!rng.chance(dropP * (repeatMult < 1 ? 0.75 : 1))) continue; }
    const minIdx = i === 0 && plan.guaranteedRarity !== undefined ? plan.guaranteedRarity : 0;
    const rarity = rollRarity(rng, luck, minIdx);
    const it = makeItem(state, rng, { floor: plan.floor, tier, rarity });
    e.items.push(it);
  }
  // boss signature drop
  if (plan.bossId && !ladder) {
    const sigs = ITEM_LIST.filter((t) => t.boss === plan.bossId);
    const firstKill = (state.bosses[plan.bossId] ?? 0) === 0;
    if (sigs.length && (firstKill || rng.chance(0.15))) {
      const it = makeItem(state, rng, { floor: plan.floor, tier, rarity: 'legendary', tpl: sigs[0].id });
      e.items.push(it);
    }
  }
  for (const it of e.items) { if (!summary.items.includes(it.uid)) summary.items.push(it.uid); }
  C.itemsFound = (C.itemsFound ?? 0);

  // boss bookkeeping
  if (plan.bossId) {
    const firstKill = (state.bosses[plan.bossId] ?? 0) === 0;
    state.bosses[plan.bossId] = (state.bosses[plan.bossId] ?? 0) + 1;
    if (firstKill && !ladder) { e.renown += 3; e.shards += 3; unlockLoreFor(state, plan, e); } else if (rng.chance(0.3)) e.shards += 1;
  }
  if (plan.tag === 'challenge' && !ladder && first) e.renown += 1;

  // bonds
  const affin = plan.tag === 'boss' || plan.tag === 'elite' || plan.tag === 'mini' ? 3 : 1;
  addAffinity(state, e.party, affin);

  // lore + heroes
  if (!plan.endless && !ladder) unlockLoreFor(state, plan, e);
  if (!plan.endless && !ladder) {
    for (const hid of HERO_IDS) {
      const u = HEROES[hid].unlock;
      if (!state.heroes[hid].unlocked && u.floorInChapter > 0 && plan.chapter === u.chapter && plan.inChapter >= u.floorInChapter) {
        unlockHero(state, hid);
        e.log.push(`${HEROES[hid].name} joins the company!`);
        state.flags[`joined-${hid}`] = plan.floor;
      }
    }
  }

  // hp & progression
  between(state, e, res, plan);
  e.cleared++;
  if (!plan.endless && plan.floor > state.best) { state.best = plan.floor; e.newBest = true; state.counters.mercy = 0; }
  if (plan.endless && !ladder && plan.floor > state.endless.best) { state.endless.best = plan.floor; e.newBest = true; }

  if (ladder) {
    const r = xf(e).rung ?? 1;
    if (r > state.ladder.cleared) state.ladder.cleared = r;
    e.ended = { reason: 'victory', keep: 1 };
    e.phase = 'ended';
  } else {
    advanceFloor(state, false, plan);
  }
  state.lastSummary = summary;
  checkAchievements(state);
  return summary;
}

function unlockLoreFor(state: GameState, plan: FloorPlan, e: Expedition): void {
  for (const l of LORE) {
    if (l.chapter !== plan.chapter || state.lore.includes(l.id)) continue;
    if (l.source === 'boss' && plan.tag === 'boss') unlockLore(state, l.id, e);
    else if (l.source.startsWith('floor:') && plan.inChapter >= Number(l.source.slice(6)) && !plan.endless) unlockLore(state, l.id, e);
  }
}

/** Move on after a cleared room. */
export function advanceFloor(state: GameState, fromNonBattle: boolean, plan?: FloorPlan): void {
  const e = state.expedition;
  if (!e) return;
  const p = plan ?? (getPlan(state) as FloorPlan);
  if (fromNonBattle) {
    e.cleared++;
    if (!p.endless && p.floor > state.best) { state.best = p.floor; e.newBest = true; }
    if (p.endless && p.floor > state.endless.best) { state.endless.best = p.floor; e.newBest = true; }
    if (p.checkpoint) for (const id of e.party) e.hp[id] = 1;
  }
  const bossDone = !p.endless && p.inChapter === 100 && p.tag === 'boss';
  if (bossDone) {
    e.ended = { reason: 'victory', keep: 1 };
    e.phase = 'ended';
    if (p.chapter === 10) { state.flags.endingPending = true; }
    return;
  }
  e.floor++;
  enterFloor(state);
}

// ------------------------------------------------------------------ ending the expedition
export function retreat(state: GameState): void {
  const e = state.expedition;
  if (!e) return;
  e.ended = { reason: 'retreat', keep: BAL.retreatKeep };
  e.phase = 'ended';
  state.counters.retreats = (state.counters.retreats ?? 0) + 1;
}

export function bankExpedition(state: GameState): { gold: number; ore: number; cloth: number; essence: number; items: ItemInstance[]; salvaged: number } | null {
  const e = state.expedition;
  if (!e || e.phase !== 'ended' || !e.ended) return null;
  const k = e.ended.keep;
  const gold = Math.round(e.gold * k); const ore = Math.round(e.ore * k); const cloth = Math.round(e.cloth * k);
  state.gold += gold; state.ore += ore; state.cloth += cloth;
  state.essence += e.essence; state.renown += e.renown; state.shards += e.shards;
  state.counters.essenceEarned = (state.counters.essenceEarned ?? 0) + e.essence;
  let salvaged = 0;
  const kept: ItemInstance[] = [];
  const cap = state.settings.autoSalvageUpTo && (state.camp.account.autosalvage ?? 0) > 0 ? RARITIES.indexOf(state.settings.autoSalvageUpTo) : -1;
  for (const it of e.items) {
    discoverItem(state, it.tpl);
    state.counters.itemsFound = (state.counters.itemsFound ?? 0) + 1;
    if (it.rarity === 'epic') state.counters.epicsFound = (state.counters.epicsFound ?? 0) + 1;
    if (it.rarity === 'legendary') state.counters.legendariesFound = (state.counters.legendariesFound ?? 0) + 1;
    if (ITEMS[it.tpl]?.set) state.counters.setPieces = (state.counters.setPieces ?? 0) + 1;
    if (RARITIES.indexOf(it.rarity) <= cap && !ITEMS[it.tpl]?.boss) {
      const v = salvageValue(it); state.ore += v.ore; state.cloth += v.cloth; state.gold += v.gold; salvaged++;
      state.counters.salvaged = (state.counters.salvaged ?? 0) + 1;
    } else { state.inventory.push(it); kept.push(it); }
  }
  trimInventory(state);
  // leftover supplies go back to camp
  state.counters.supplies = Math.min((state.counters.supplies ?? 0) + e.supplies, 4 + (state.camp.age.larder ?? 0));
  if (e.ended.reason === 'defeat') state.counters.mercy = (state.counters.mercy ?? 0) + 1;
  else if (!e.newBest && e.ended.reason === 'retreat') { /* keep mercy as-is */ }
  const out = { gold, ore, cloth, essence: e.essence, items: kept, salvaged };
  state.expedition = null;
  checkAchievements(state);
  return out;
}

export const INVENTORY_CAP = 240;
export function trimInventory(state: GameState): void {
  if (state.inventory.length <= INVENTORY_CAP) return;
  const worth = (i: ItemInstance) => rarityIndex(i.rarity) * 100 + i.ilvl / 10;
  const equipped = new Set<string>();
  for (const id of HERO_IDS) for (const v of Object.values(state.heroes[id].equip)) if (v) equipped.add(v);
  const cand = state.inventory.filter((i) => !equipped.has(i.uid) && !i.locked && !ITEMS[i.tpl]?.boss).sort((a, b) => worth(a) - worth(b));
  while (state.inventory.length > INVENTORY_CAP && cand.length) salvage(state, (cand.shift() as ItemInstance).uid);
}

// ------------------------------------------------------------------ Age descent
export interface DescentPreview {
  canDescend: boolean;
  why?: string;
  nextAge: number;
  loses: { gold: number; ore: number; cloth: number; items: number; campUpgrades: number };
  keeps: string[];
  heirlooms: number;
  legendaries: number;
  purse: number;
  levelCapFrom: number;
  levelCapTo: number;
  newShadow: string;
}

export function purseFor(state: GameState, age: number): number {
  const tier = state.camp.account.quartermaster ?? 0;
  return Math.round(tier * 120 * goldScale(age));
}

export function descentPreview(state: GameState): DescentPreview {
  const next = state.age + 1;
  const legendaries = state.inventory.filter((i) => i.rarity === 'legendary').length;
  const heirlooms = 1 + (state.camp.account.heirloom ?? 0);
  const keepable = state.inventory.filter((i) => i.rarity !== 'legendary' && i.locked).length;
  const lost = state.inventory.length - legendaries - Math.min(heirlooms, keepable);
  const can = !state.expedition && state.age < 10 && state.best >= state.age * 100;
  return {
    canDescend: can,
    why: state.expedition ? 'Finish your expedition first.' : state.age >= 10 ? 'There is no deeper Age.' : state.best < state.age * 100 ? `Defeat the boss on floor ${state.age * 100} first.` : undefined,
    nextAge: next,
    loses: { gold: state.gold, ore: state.ore, cloth: state.cloth, items: Math.max(0, lost), campUpgrades: Object.values(state.camp.age).reduce((a, b) => a + b, 0) },
    keeps: ['Heroes, levels and talents', 'Relics and relic essence', 'Fellowship bonds and scenes', 'Lore, codex and collection', 'Renown and account upgrades', 'Legendary items', `${heirlooms} locked heirloom item${heirlooms === 1 ? '' : 's'}`, 'Quests and achievements'],
    heirlooms, legendaries, purse: purseFor(state, next),
    levelCapFrom: ageLevelCap(state), levelCapTo: ageLevelCap({ ...state, age: next } as GameState),
    newShadow: CHAPTER_BY_N(next).shadow.name,
  };
}

export function descendAge(state: GameState): boolean {
  const p = descentPreview(state);
  if (!p.canDescend) return false;
  // keep legendaries and locked heirlooms; everything else goes
  const heirs = state.inventory.filter((i) => i.rarity !== 'legendary' && i.locked).slice(0, p.heirlooms);
  const keep = new Set<string>([...state.inventory.filter((i) => i.rarity === 'legendary').map((i) => i.uid), ...heirs.map((i) => i.uid)]);
  state.inventory = state.inventory.filter((i) => keep.has(i.uid));
  for (const id of HERO_IDS) {
    const h = state.heroes[id];
    for (const s of Object.keys(h.equip) as (keyof typeof h.equip)[]) if (h.equip[s] && !keep.has(h.equip[s] as string)) h.equip[s] = null;
  }
  state.age = p.nextAge;
  state.gold = p.purse; state.ore = 0; state.cloth = 0;
  state.camp.age = {};
  state.counters.supplies = 0;
  state.counters.mercy = 0;
  state.ageStartBest = state.best;
  state.merchantCycle++;
  for (const id of HERO_IDS) if (state.heroes[id].unlocked) {
    // fresh starter kit of the new tier, then slot in whatever heirlooms fit
    starterKit(state, id);
  }
  state.shop.stock = [];
  state.counters.descents = (state.counters.descents ?? 0) + 1;
  state.renown += 2;
  checkAchievements(state);
  return true;
}

export { newUid };
