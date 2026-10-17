import { newGame, defaultSettings } from '../core/game.ts';
import { SAVE_VERSION, type GameState } from '../core/state.ts';

type Raw = Record<string, unknown> & { v?: number };

/**
 * Save schema history
 *   v1  internal playtest builds: no Deep Delve, ladder, merchant, shards or settings.skipStories
 *   v2  current
 * Each migration receives the raw object at version N and returns it at N+1.
 */
const MIGRATIONS: Record<number, (s: Raw) => Raw> = {
  1: (s) => ({
    ...s,
    v: 2,
    shards: s.shards ?? 0,
    endless: s.endless ?? { best: 1000, modifiers: 0 },
    ladder: s.ladder ?? { cleared: 0 },
    shop: s.shop ?? { seed: ((s.seed as number) ?? 1) ^ 0x5a5a, stock: [], rerolls: 0 },
    merchantCycle: s.merchantCycle ?? 0,
    settings: { ...defaultSettings(), ...((s.settings as object) ?? {}) },
  }),
};

export class SaveError extends Error {}

export function migrate(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') throw new SaveError('Save data is not an object.');
  let s = raw as Raw;
  let v = typeof s.v === 'number' ? s.v : 0;
  if (v === 0) throw new SaveError('Save has no version number.');
  if (v > SAVE_VERSION) throw new SaveError(`This save is from a newer version of the game (v${v}).`);
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new SaveError(`No migration from save v${v}.`);
    s = step(s);
    v = s.v as number;
  }
  return normalize(s as unknown as GameState);
}

/** Fill any missing keys with defaults and drop unknown heroes so that partial or old saves still load. */
export function normalize(s: GameState): GameState {
  const base = newGame(s.seed ?? 1);
  const out: GameState = { ...base, ...s, settings: { ...base.settings, ...(s.settings ?? {}) } };
  out.heroes = { ...base.heroes };
  for (const id of Object.keys(base.heroes) as (keyof typeof base.heroes)[]) {
    const h = s.heroes?.[id];
    if (h) out.heroes[id] = { ...base.heroes[id], ...h, equip: { ...base.heroes[id].equip, ...(h.equip ?? {}) } };
  }
  // the starter hero in the fresh game would otherwise leak into old saves
  if (!s.heroes) out.heroes = base.heroes;
  out.relics = { ...base.relics, ...(s.relics ?? {}) };
  out.camp = { age: { ...(s.camp?.age ?? {}) }, account: { ...(s.camp?.account ?? {}) } };
  out.counters = { ...(s.counters ?? {}) };
  out.v = SAVE_VERSION;
  return out;
}
