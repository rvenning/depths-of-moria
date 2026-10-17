import { describe, expect, it } from 'vitest';
import { newGame, unlockHero, grantXp } from '../src/core/game.ts';
import { startExpedition } from '../src/core/expedition.ts';
import { SAVE_VERSION } from '../src/core/state.ts';
import { exportSave, importSave } from '../src/persistence/db.ts';
import { migrate, normalize, SaveError } from '../src/persistence/migrations.ts';

describe('save round-trips', () => {
  it('export → import returns an identical game', () => {
    const s = newGame(31); unlockHero(s, 'gimli'); grantXp(s, 'aragorn', 5000); s.gold = 1234; s.best = 77; s.bonds['aragorn+gimli'] = 12; startExpedition(s, 1);
    const back = importSave(exportSave(s));
    expect(JSON.stringify(back)).toBe(JSON.stringify(normalize(JSON.parse(JSON.stringify(s)))));
    expect(back.expedition?.floor).toBe(1);
  });
  it('rejects damaged exports', () => {
    const e = exportSave(newGame(1));
    const broken = `${e.slice(0, e.length - 6)}AAAAAA`;
    expect(() => importSave(broken)).toThrow(SaveError);
    expect(() => importSave('not a save')).toThrow(SaveError);
  });
  it('accepts raw JSON too', () => {
    const s = newGame(2); s.gold = 99;
    expect(importSave(JSON.stringify(s)).gold).toBe(99);
  });
});

describe('versioned schema and migrations', () => {
  it('migrates a v1 save to the current schema without losing progress', () => {
    const s = newGame(5) as unknown as Record<string, unknown>;
    // shape of an internal v1 build: no endless, ladder, shop, shards, merchantCycle; older settings
    const v1: Record<string, unknown> = { ...s, v: 1 };
    delete v1.endless; delete v1.ladder; delete v1.shop; delete v1.shards; delete v1.merchantCycle;
    v1.settings = { master: 0.3, music: 0.2, sfx: 0.1, ambience: 0.1, speed: 4 };
    v1.gold = 4321; v1.best = 55;
    const m = migrate(v1);
    expect(m.v).toBe(SAVE_VERSION);
    expect(m.gold).toBe(4321); expect(m.best).toBe(55);
    expect(m.endless.best).toBe(1000); expect(m.ladder.cleared).toBe(0); expect(m.shop.stock).toEqual([]); expect(m.shards).toBe(0);
    expect(m.settings.master).toBe(0.3); expect(m.settings.speed).toBe(4); expect(m.settings.naming).toBe('fan'); expect(typeof m.settings.reducedMotion).toBe('boolean');
  });
  it('rejects saves from the future, unversioned data and non-objects', () => {
    expect(() => migrate({ v: SAVE_VERSION + 1 })).toThrow(/newer/);
    expect(() => migrate({})).toThrow(SaveError);
    expect(() => migrate(null)).toThrow(SaveError);
    expect(() => migrate({ v: 0 })).toThrow(SaveError);
  });
  it('normalize fills gaps (missing hero fields, relics, camp) and keeps what exists', () => {
    const s = newGame(6) as unknown as Record<string, unknown>;
    const partial = JSON.parse(JSON.stringify(s));
    delete partial.relics.horn; delete partial.heroes.aragorn.rules; partial.heroes.aragorn.level = 9; delete partial.camp;
    const n = normalize(partial);
    expect(n.relics.horn).toBe(0); expect(n.heroes.aragorn.rules.length).toBeGreaterThan(0); expect(n.heroes.aragorn.level).toBe(9); expect(n.camp.age).toEqual({});
  });
});
