/**
 * A progression bot: plays the real game state machine the way a sensible player would.
 * Used by the balance CLI and the integration tests. Headless, deterministic.
 */
import { CAMP_UPGRADES } from '../content/camp.ts';
import { EVENT_BY_ID } from '../content/events.ts';
import { HEROES } from '../content/heroes.ts';
import { ITEMS } from '../content/items.ts';
import { RELIC_IDS } from '../content/relics.ts';
import type { HeroId, RelicId } from '../content/schema.ts';
import { HERO_IDS } from '../content/schema.ts';
import {
  autoEquipAll, buyCamp, buyShopItem, buySupplies, buyTalent, campCost, canBuyTalent, equip, getItem, merchantPrice,
  refreshShop, relicNextCost, salvageBelow, setParty, trainCost, trainHero, upgradeItem, upgradeRelic, forgeUnlocked,
  suppliesCap, SUPPLY_COST,
} from './game.ts';
import {
  advanceFloor as _adv, applyBattleResult, bankExpedition, chooseDoor, descendAge, descentPreview, eventChoiceAvailable,
  prepareBattle, quickResolve, resolveEvent, retreat, startExpedition, takeRest, traversalSafe, validStartFloors,
  endlessUnlocked, validEndlessStarts,
} from './expedition.ts';
import { claimQuest, questViews } from './meta.ts';
import { formation } from './party.ts';
import type { GameState } from './state.ts';
import { SLOTS, computeHero, itemScore } from './stats.ts';

void _adv;

export interface BotOptions {
  maxCycles?: number;
  stopAge?: number;          // stop once this Age is completed
  retreatBelow?: number;     // retreat when the party's average hp fraction drops under this
  secPerAction?: number;
  priority?: HeroId[];
  /** stop as soon as the party is ready to face the Age boss (floor 99 cleared) */
  untilBoss?: boolean;
  endless?: boolean;
  log?: (s: string) => void;
}

export interface AgeReport { age: number; cycles: number; seconds: number; battles: number; deaths: number; startLevel: number; endLevel: number }
export interface BotReport {
  cycles: number; battles: number; secondsAt1x: number; ages: AgeReport[]; finished: boolean; best: number; stuckAt?: number;
  defeats: number; retreats: number; goldTotal: number; essenceTotal: number; renownTotal: number;
}

const DEFAULT_PRIORITY: HeroId[] = ['gimli', 'sam', 'legolas', 'gandalf', 'aragorn', 'boromir', 'frodo'];
let PRIORITY: HeroId[] = DEFAULT_PRIORITY;
/** which heroes the bot prefers, in order (used by the balance report to compare party builds) */
export function setBotPriority(p: HeroId[] | null): void { PRIORITY = p ?? DEFAULT_PRIORITY; }

function chooseParty(state: GameState): void {
  const unlocked = PRIORITY.filter((h) => state.heroes[h].unlocked);
  const frontPool = unlocked.filter((h) => HEROES[h].defaultRow === 'front');
  const backPool = unlocked.filter((h) => HEROES[h].defaultRow === 'back');
  // aim for two or three in front and two behind; spill into whichever row has room
  const front: HeroId[] = frontPool.slice(0, 3);
  const back: HeroId[] = backPool.slice(0, 2);
  for (const h of unlocked) {
    if (front.length + back.length >= 5) break;
    if (front.includes(h) || back.includes(h)) continue;
    if (back.length < 2) back.push(h); else if (front.length < 3) front.push(h);
  }
  const slots: (HeroId | null)[] = [front[0] ?? null, front[1] ?? null, front[2] ?? null, back[0] ?? null, back[1] ?? null];
  setParty(state, slots);
}

export function campPhase(state: GameState, log?: (s: string) => void): void {
  // quests
  for (const q of questViews(state)) if (q.available && q.done && !q.claimed) claimQuest(state, q.def.id);
  chooseParty(state);
  // account upgrades
  for (const id of ['autosalvage', 'traversal', 'quartermaster', 'veterans', 'heirloom', 'fieldcraft', 'presets', 'sorting']) {
    while (campCost(state, id) !== null && state.renown >= (campCost(state, id) as number)) { if (!buyCamp(state, id)) break; }
  }
  if (state.camp.account.autosalvage && !state.settings.autoSalvageUpTo) state.settings.autoSalvageUpTo = 'uncommon';
  // talents
  for (const id of HERO_IDS) {
    if (!state.heroes[id].unlocked) continue;
    let progressed = true;
    while (progressed) {
      progressed = false;
      const order = HEROES[id].talents.map((t, i) => ({ t, i })).sort((a, b) => a.t.cost - b.t.cost || a.i - b.i);
      for (const { i } of order) if (canBuyTalent(state, id, i).ok) { buyTalent(state, id, i); progressed = true; break; }
    }
  }
  // supplies first (cheap), then shop, then upgrades, forge, training
  while (buySupplies(state, 1)) { /* fill up */ }
  if (state.shop.stock.length === 0) refreshShop(state, true);
  for (let round = 0; round < 3; round++) {
    shopRound(state);
    for (let n = 0; n < 40; n++) {
      const cheapest = CAMP_UPGRADES.filter((u) => u.kind === 'age' && campCost(state, u.id) !== null)
        .sort((a, b) => (campCost(state, a.id) as number) - (campCost(state, b.id) as number))[0];
      if (!cheapest) break;
      const c = campCost(state, cheapest.id) as number;
      if (state.gold < c + SUPPLY_COST(state) * suppliesCap(state) * 0.5) break;
      buyCamp(state, cheapest.id);
    }
    autoEquipAll(state);
  }
  if (forgeUnlocked(state)) forgeRound(state);
  // training with spare gold
  for (let n = 0; n < 60; n++) {
    let any = false;
    for (const id of HERO_IDS) {
      const h = state.heroes[id];
      if (!h.unlocked) continue;
      const cost = trainCost(state, id);
      if (state.gold >= cost * 2.5 && trainHero(state, id).length >= 0 && h.level < 999) any = any || state.gold >= cost * 2.5;
    }
    if (!any) break;
  }
  // relics
  const prio: RelicId[] = ['light', 'horn', 'blessing', 'courage', 'wisdom', 'fortune'];
  for (let n = 0; n < 400; n++) {
    const opts = prio.filter((r) => RELIC_IDS.includes(r) && relicNextCost(state, r) !== null)
      .sort((a, b) => (relicNextCost(state, a) as number) - (relicNextCost(state, b) as number));
    const pick = opts[0];
    if (!pick || state.essence < (relicNextCost(state, pick) as number)) break;
    upgradeRelic(state, pick);
  }
  autoEquipAll(state);
  salvageBelow(state, state.age >= 3 ? 'uncommon' : 'common');
  log?.(`camp: gold ${state.gold}`);
}

function shopRound(state: GameState): void {
  const stock = state.shop.stock.slice().sort((a, b) => merchantPrice(state, a) - merchantPrice(state, b));
  for (const it of stock) {
    const price = merchantPrice(state, it);
    if (price > state.gold * 0.35) continue;
    // does anyone in the party want it?
    const tpl = ITEMS[it.tpl];
    let best: { id: HeroId; slot: string; gain: number } | null = null;
    for (const id of formation(state).map((f) => f.id)) {
      const role = HEROES[id].role === 'mage' || HEROES[id].role === 'healer' ? 'mag' : 'phys';
      for (const slot of SLOTS) {
        if (!(tpl.slot === 'accessory' ? slot.startsWith('acc') : tpl.slot === slot)) continue;
        if (tpl.slot === 'weapon' && tpl.weapon && !HEROES[id].weapon.includes(tpl.weapon)) continue;
        const cur = getItem(state, state.heroes[id].equip[slot as 'weapon']);
        const gain = itemScore(it, role) - (cur ? itemScore(cur, role) : 0);
        if (gain > 0 && (!best || gain > best.gain)) best = { id, slot, gain };
      }
    }
    if (best && best.gain > 3) {
      if (buyShopItem(state, it.uid)) {
        const bought = state.inventory[state.inventory.length - 1];
        equip(state, best.id, bought.uid, best.slot as 'weapon');
      }
    }
  }
}

function forgeRound(state: GameState): void {
  const targets: string[] = [];
  for (const { id } of formation(state)) for (const s of ['weapon', 'armour', 'offhand'] as const) { const u = state.heroes[id].equip[s]; if (u) targets.push(u); }
  for (let guard = 0; guard < 120; guard++) {
    const sorted = targets.map((u) => getItem(state, u)).filter(Boolean).sort((a, b) => (a!.plus - b!.plus));
    const t = sorted[0];
    if (!t || !upgradeItem(state, t.uid)) break;
  }
}

function avgHp(state: GameState): number {
  const e = state.expedition;
  if (!e) return 1;
  let s = 0;
  for (const id of e.party) s += e.hp[id] ?? 1;
  return s / Math.max(1, e.party.length);
}

/** fight-length telemetry by room kind, filled while the bot plays (used by the balance tools) */
export const botStats: { rounds: Record<string, { n: number; rounds: number; actions: number }> } = { rounds: {} };
export const resetBotStats = (): void => { botStats.rounds = {}; };

export interface ExpeditionRun { floors: number; seconds: number; battles: number; deaths: number; reason: string; newBest: boolean }

export function runExpedition(state: GameState, opts: BotOptions = {}): ExpeditionRun {
  const e0 = state.expedition;
  if (!e0) return { floors: 0, seconds: 0, battles: 0, deaths: 0, reason: 'none', newBest: false };
  const sec = opts.secPerAction ?? 0.8;
  let seconds = 0; let battles = 0; let deaths = 0;
  const retreatBelow = opts.retreatBelow ?? 0.4;
  let guard = 0;
  while (state.expedition && state.expedition.phase !== 'ended' && guard++ < 5000) {
    const e = state.expedition;
    if (e.phase === 'door') {
      chooseDoor(state, avgHp(state) < 0.55 && (e.doorChoices ?? []).includes('rest') ? 'rest' : (e.doorChoices ?? ['battle'])[0]);
      seconds += 3; continue;
    }
    if (e.phase === 'event') {
      const ev = EVENT_BY_ID[e.eventId as string];
      let pick = ev.choices.length - 1;
      for (let i = 0; i < ev.choices.length - 1; i++) { if (eventChoiceAvailable(state, ev.choices[i]).ok) { pick = i; break; } }
      const hurt = avgHp(state) < 0.6;
      if (hurt) { const hi = ev.choices.findIndex((c) => c.outcomes.some((o) => o.results.some((r) => r.k === 'healPct' && r.pct > 0)) && eventChoiceAvailable(state, c).ok); if (hi >= 0) pick = hi; }
      if (!eventChoiceAvailable(state, ev.choices[pick]).ok) pick = ev.choices.length - 1;
      resolveEvent(state, pick);
      seconds += 8; continue;
    }
    if (e.room === 'rest') { takeRest(state); seconds += 4; continue; }
    if (traversalSafe(state)) {
      const s = quickResolve(state);
      seconds += 3;
      if (s && s.result === 'defeat') break;
      continue;
    }
    const bs = prepareBattle(state, false);
    if (!bs) break;
    const res = bs.battle.run();
    battles++;
    { const r = (botStats.rounds[bs.plan.tag] ??= { n: 0, rounds: 0, actions: 0 }); r.n++; r.rounds += res.rounds; r.actions += res.actions; }
    seconds += res.actions * sec + 3.5;
    deaths += res.deaths;
    applyBattleResult(state, bs.plan, res);
    const ex = state.expedition;
    if (ex && ex.phase === 'room') {
      // retreat if the party is broken and no checkpoint heal is near
      const nextCheckpoint = 10 - (ex.floor - 1) % 10;
      if (avgHp(state) < retreatBelow && ex.supplies === 0 && nextCheckpoint > 2) { retreat(state); break; }
    }
  }
  const e = state.expedition;
  const newBest = !!e?.newBest;
  const reason = e?.ended?.reason ?? 'unknown';
  const floors = e?.cleared ?? 0;
  bankExpedition(state);
  return { floors, seconds, battles, deaths, reason, newBest };
}

export function playGame(state: GameState, opts: BotOptions = {}): BotReport {
  if (opts.priority) setBotPriority(opts.priority);
  const maxCycles = opts.maxCycles ?? 3000;
  const rep: BotReport = { cycles: 0, battles: 0, secondsAt1x: 0, ages: [], finished: false, best: 0, defeats: 0, retreats: 0, goldTotal: 0, essenceTotal: 0, renownTotal: 0 };
  let ageStart = { cycles: 0, seconds: 0, battles: 0, deaths: 0, level: state.heroes.aragorn.level };
  let deathsAge = 0;
  let stagnant = 0; let lastBest = state.best;
  for (let c = 0; c < maxCycles; c++) {
    campPhase(state, opts.log);
    rep.secondsAt1x += 60;
    if (state.best >= state.age * 100 && state.age < 10) {
      const p = descentPreview(state);
      if (p.canDescend) {
        rep.ages.push({ age: state.age, cycles: rep.cycles - ageStart.cycles, seconds: rep.secondsAt1x - ageStart.seconds, battles: rep.battles - ageStart.battles, deaths: deathsAge, startLevel: ageStart.level, endLevel: Math.max(...HERO_IDS.map((h) => state.heroes[h].level)) });
        opts.log?.(`Age ${state.age} complete after ${rep.cycles - ageStart.cycles} cycles`);
        if (opts.stopAge && state.age >= opts.stopAge) { rep.finished = true; break; }
        descendAge(state);
        campPhase(state, opts.log);
        ageStart = { cycles: rep.cycles, seconds: rep.secondsAt1x, battles: rep.battles, deaths: 0, level: Math.max(...HERO_IDS.map((h) => state.heroes[h].level)) };
        deathsAge = 0; stagnant = 0;
      }
    }
    if (state.age === 10 && state.best >= 1000) {
      rep.ages.push({ age: 10, cycles: rep.cycles - ageStart.cycles, seconds: rep.secondsAt1x - ageStart.seconds, battles: rep.battles - ageStart.battles, deaths: deathsAge, startLevel: ageStart.level, endLevel: Math.max(...HERO_IDS.map((h) => state.heroes[h].level)) });
      rep.finished = true; break;
    }
    const starts = validStartFloors(state);
    const floor = starts[starts.length - 1] ?? 1;
    if (!startExpedition(state, floor)) break;
    const g0 = state.gold; void g0;
    const r = runExpedition(state, opts);
    rep.cycles++; rep.battles += r.battles; rep.secondsAt1x += r.seconds; deathsAge += r.deaths;
    if (r.reason === 'defeat') rep.defeats++; else if (r.reason === 'retreat') rep.retreats++;
    if (state.best > lastBest) { lastBest = state.best; stagnant = 0; } else stagnant++;
    if (stagnant > 80) { rep.stuckAt = state.best; break; }
  }
  rep.best = state.best;
  return rep;
}

export function describeEndless(state: GameState): string { return endlessUnlocked(state) ? `endless starts ${validEndlessStarts(state).length}` : 'locked'; }
export { computeHero };

export interface AgeRun { ok: boolean; cycles: number; seconds: number; battles: number; deaths: number; defeats: number }

/** Play the current Age until its boss falls (or the cycle cap is hit). Does not descend. */
export function playAgeOnce(state: GameState, opts: BotOptions = {}, cap = 200): AgeRun {
  if (opts.priority) setBotPriority(opts.priority);
  const run: AgeRun = { ok: false, cycles: 0, seconds: 0, battles: 0, deaths: 0, defeats: 0 };
  let stagnant = 0; let lastBest = state.best;
  while (run.cycles < cap) {
    campPhase(state, opts.log);
    run.seconds += 60;
    if (state.best >= state.age * 100) { run.ok = true; break; }
    if (opts.untilBoss && state.best >= state.age * 100 - 1) { run.ok = true; break; }
    const starts = validStartFloors(state);
    const floor = starts[starts.length - 1] ?? 1;
    if (!startExpedition(state, floor)) break;
    const r = runExpedition(state, opts);
    run.cycles++; run.battles += r.battles; run.seconds += r.seconds; run.deaths += r.deaths;
    if (r.reason === 'defeat') run.defeats++;
    if (state.best > lastBest) { lastBest = state.best; stagnant = 0; } else stagnant++;
    if (stagnant > 60) break;
  }
  if (state.best >= state.age * 100) run.ok = true;
  return run;
}
