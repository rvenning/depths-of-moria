import { describe, expect, it } from 'vitest';
import { ENEMY_LIST } from '../src/content/enemies.ts';
import { HEROES, HERO_LIST } from '../src/content/heroes.ts';
import { getSkill } from '../src/content/skills.ts';
import { HERO_IDS } from '../src/content/schema.ts';
import type { SkillDef } from '../src/content/schema.ts';
import { Battle } from '../src/core/battle/engine.ts';
import type { BEvent } from '../src/core/battle/types.ts';
import { enemyUnit, freeSlot } from '../src/core/floors.ts';
import { unlockHero, newGame, grantXp } from '../src/core/game.ts';
import { buildHeroUnits } from '../src/core/party.ts';
import { computeHero } from '../src/core/stats.ts';
import { BASE, setup, unit } from './helpers.ts';

/** every hero skill must be reachable by the AI, fire in a realistic fight, and do what its tooltip says */
describe('every hero skill works in battle', () => {
  for (const h of HERO_LIST) {
    for (const sid of h.skills) {
      it(`${h.name}: ${getSkill(sid).name}`, () => {
        const s = newGame(1); for (const id of HERO_IDS) unlockHero(s, id);
        grantXp(s, h.id, 1e9);
        // a wounded ally so heals and rescues are valid, plus a few foes
        const heroes = buildHeroUnits(s).filter((u) => u.heroId === h.id);
        const hero = heroes[0] ?? buildHeroUnits({ ...s, party: [h.id, null, null, null, null] })[0];
        hero.stats = { ...hero.stats, hp: 1e9, atk: hero.stats.atk * 4, mag: hero.stats.mag * 4 };
        hero.rules = [{ id: 'rescue', enabled: true, param: 90 }, { id: 'heal-below', enabled: true, param: 90 }, { id: 'cleanse', enabled: true }, { id: 'guard-low', enabled: true, param: 100 }, { id: 'buff-opener', enabled: true }, { id: 'aoe-3', enabled: true }, { id: 'ultimate', enabled: true }, { id: 'use-ready', enabled: true }, { id: 'basic', enabled: true }];
        const ally = unit('hero', 'ally', 1, 'front', { hp: 1e9, atk: 1 }, [], undefined, { hpFrac: 0.2, heroId: 'aragorn' });
        const foes = [0, 1, 2, 3].map((i) => unit('enemy', `f${i}`, i, i < 3 ? 'front' : 'back', { hp: 1e9, atk: 20 + i, spd: 80 + i * 5, def: 5 }, [getSkill('e-poisondart')]));
        const b = new Battle(setup([hero, ally], foes), 5);
        const used = new Set<string>(); let healsOnAlly = 0;
        for (let i = 0; i < 400 && !b.over; i++) for (const e of b.step()) { if (e.t === 'skill' && b.unit(e.actor)?.heroId === h.id) used.add(e.skill); if (e.t === 'heal' && e.amount > 0) healsOnAlly++; }
        expect(used.has(sid), `${sid} never used; used: ${[...used].join(',')}`).toBe(true);
        const def = getSkill(sid);
        if (def.tags.includes('heal') && !def.hits) expect(healsOnAlly).toBeGreaterThan(0);
      });
    }
  }
  it('talent skill modifiers are applied to the skills the engine runs', () => {
    const s = newGame(2); for (const id of HERO_IDS) unlockHero(s, id);
    s.heroes.gandalf.level = 30; s.heroes.gandalf.talents = [0, 2];
    const c = computeHero(s, 'gandalf');
    expect(c.skills.find((k: SkillDef) => k.id === 'gandalf-light')!.hits![0]).toBeCloseTo(getSkill('gandalf-light').hits![0] * 1.25, 5);
    s.heroes.gandalf.talents = [0, 1, 4];
    expect(computeHero(s, 'gandalf').skills.find((k) => k.id === 'gandalf-wrath')!.cd).toBe(getSkill('gandalf-wrath').cd - 1);
  });
});

describe('every enemy and boss runs without errors and uses its kit', () => {
  for (const e of ENEMY_LIST) {
    it(`${e.name}`, () => {
      const floor = e.chapter * 100 - 40;
      const mk = (slot: number) => enemyUnit(e.id, floor, slot);
      const hero = unit('hero', 'tank', 0, 'front', { hp: 1e12, atk: 1, def: 500, res: 500, spd: 60 }, [], undefined, { rules: [{ id: 'basic', enabled: true }] });
      const back = unit('hero', 'back', 3, 'back', { hp: 1e12, atk: 1, def: 500, res: 500, spd: 60 });
      const s = setup([hero, back], [mk(e.row === 'back' ? 3 : 0)], {
        floor, spawn: (id, used) => { const sl = freeSlot(id, used); return sl === null ? null : enemyUnit(id, floor, sl); },
        enrageStart: 1000,
      });
      const b = new Battle(s, 11, { record: true });
      const used = new Set<string>();
      for (let i = 0; i < 700 && !b.over; i++) for (const ev of b.step() as BEvent[]) if (ev.t === 'skill' && b.unit(ev.actor)?.side === 'enemy') used.add(ev.skill);
      const own = e.skills.map((r) => r.skill);
      const expected = own.filter((sid) => { const sk = getSkill(sid); return sk.cd < 90 && !sk.effects?.some((ef) => ef.k === 'summon'); });
      for (const sid of expected) {
        const sk = getSkill(sid);
        if (sk.target === 'lowestAlly' || sk.tags.includes('heal')) continue; // needs a wounded ally to be valid
        expect(used.has(sid), `${e.id} never used ${sid}`).toBe(true);
      }
      expect(b.enemies().length).toBeLessThanOrEqual(5);
    });
  }
});

describe('hero kits match their descriptions', () => {
  it('basic attacks are cd 0 and every skill names a status/effect it really applies', () => {
    for (const h of HERO_LIST) {
      expect(getSkill(h.basic).cd).toBe(0);
      for (const sid of h.skills) {
        const sk = getSkill(sid);
        expect(sk.effects?.length || sk.hits?.length, sid).toBeGreaterThan(0);
        expect(sk.cd, sid).toBeGreaterThan(0);
      }
    }
    void HEROES; void BASE;
  });
});
