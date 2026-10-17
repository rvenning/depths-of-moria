import { ACHIEVEMENTS, QUESTS, QUEST_BY_ID } from '../content/meta.ts';
import { BONDS, bondTier } from '../content/bonds.ts';
import { ENEMIES } from '../content/enemies.ts';
import { ITEMS, SETS } from '../content/items.ts';
import { CHAPTERS } from '../content/chapters.ts';
import { HERO_IDS, RARITIES } from '../content/schema.ts';
import type { QuestDef } from '../content/schema.ts';
import { makeItem } from './loot.ts';
import { Rng, mixSeed } from './rng.ts';
import type { GameState } from './state.ts';

export function metricValue(state: GameState, key: string): number {
  switch (key) {
    case 'best': return state.best;
    case 'heroes': return HERO_IDS.filter((h) => state.heroes[h].unlocked).length;
    case 'maxLevel': return Math.max(...HERO_IDS.map((h) => state.heroes[h].level));
    case 'bondT1': return Object.values(state.bonds).filter((a) => bondTier(a) >= 1).length;
    case 'bondT3': return Object.values(state.bonds).filter((a) => bondTier(a) >= 3).length;
    case 'relicMax': return Math.max(0, ...Object.values(state.relics));
    case 'bossesDistinct': return CHAPTERS.filter((c) => (state.bosses[c.boss] ?? 0) > 0).length;
    case 'loreCount': return state.lore.length;
    case 'codexCount': return Object.keys(state.codex).length;
    case 'collection': return state.itemsSeen.length;
    case 'endlessBest': return state.endless.best;
    case 'ladder': return state.ladder.cleared;
    case 'ageNow': return state.age;
    case 'legendOwned': return state.inventory.filter((i) => i.rarity === 'legendary').length;
    case 'setsComplete': return Object.values(SETS).filter((set) => set.pieces.every((p) => state.itemsSeen.includes(p))).length;
    case 'talents': return HERO_IDS.reduce((a, h) => a + state.heroes[h].talents.length, 0);
    default: return state.counters[key] ?? 0;
  }
}

export interface QuestView { def: QuestDef; progress: number; done: boolean; claimed: boolean; available: boolean }

export function questProgress(state: GameState, q: QuestDef): number {
  const base = q.repeatable ? (state.quests[q.id] ?? 0) : 0;
  const key = q.metric === 'bossKillsR' ? 'bossKills' : q.metric;
  return Math.max(0, metricValue(state, key) - base);
}
export function questViews(state: GameState): QuestView[] {
  return QUESTS.map((def) => {
    const progress = questProgress(state, def);
    return { def, progress, done: progress >= def.target, claimed: (state.questsClaimed[def.id] ?? 0) > 0 && !def.repeatable, available: state.age >= def.chapter || Math.ceil(Math.max(1, state.best) / 100) >= def.chapter };
  });
}
export function claimQuest(state: GameState, id: string): boolean {
  const def = QUEST_BY_ID[id];
  if (!def) return false;
  const v = questViews(state).find((x) => x.def.id === id);
  if (!v || !v.available || !v.done || v.claimed) return false;
  const r = def.reward;
  state.gold += r.gold ?? 0; state.essence += r.essence ?? 0; state.renown += r.renown ?? 0;
  state.ore += r.ore ?? 0; state.cloth += r.cloth ?? 0;
  if (r.item) {
    const rng = new Rng(mixSeed(state.seed, id, 'quest', state.questsClaimed[id] ?? 0));
    const floor = Math.max(1, (state.age - 1) * 100 + 50);
    const it = makeItem(state, rng, { floor, tier: state.age, rarity: r.item });
    state.inventory.push(it);
    if (!state.itemsSeen.includes(it.tpl)) state.itemsSeen.push(it.tpl);
  }
  state.questsClaimed[id] = (state.questsClaimed[id] ?? 0) + 1;
  if (def.repeatable) state.quests[id] = metricValue(state, def.metric === 'bossKillsR' ? 'bossKills' : def.metric);
  return true;
}
export function claimableQuests(state: GameState): number {
  return questViews(state).filter((q) => q.available && q.done && !q.claimed).length;
}

/** Returns achievements newly earned. Grants their renown. */
export function checkAchievements(state: GameState): string[] {
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id]) continue;
    if (metricValue(state, a.metric) >= a.target) {
      state.achievements[a.id] = Date.now();
      state.renown += a.renown;
      out.push(a.id);
    }
  }
  return out;
}

export function discoverItem(state: GameState, tplId: string): void {
  if (!state.itemsSeen.includes(tplId) && ITEMS[tplId]) state.itemsSeen.push(tplId);
}
export function recordCodex(state: GameState, enemyId: string, kill: boolean): void {
  if (!ENEMIES[enemyId]) return;
  const c = (state.codex[enemyId] ??= { seen: 0, kills: 0 });
  c.seen++;
  if (kill) c.kills++;
}
export const rarityIdx = (r: string): number => RARITIES.indexOf(r as never);
export { BONDS };
