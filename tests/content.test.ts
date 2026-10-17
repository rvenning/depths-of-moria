import { describe, expect, it } from 'vitest';
import { ENEMIES, ENEMY_LIST } from '../src/content/enemies.ts';
import { CHAPTERS } from '../src/content/chapters.ts';
import { HEROES, HERO_LIST, PASSIVES } from '../src/content/heroes.ts';
import { ITEMS, ITEM_LIST, SETS, AFFIXES } from '../src/content/items.ts';
import { getSkill, hasSkill, describeSkill } from '../src/content/skills.ts';
import { EVENTS } from '../src/content/events.ts';
import { QUESTS, ACHIEVEMENTS } from '../src/content/meta.ts';
import { LORE, LORE_BY_ID } from '../src/content/lore.ts';
import { BOND_LIST, BONDS, bondId } from '../src/content/bonds.ts';
import { HERO_IDS } from '../src/content/schema.ts';
import { RELICS } from '../src/content/relics.ts';

describe('content meets the spec minimums', () => {
  it('has 10 chapters of 100 floors each', () => {
    expect(CHAPTERS).toHaveLength(10);
    CHAPTERS.forEach((c, i) => expect(c.floors).toEqual([i * 100 + 1, (i + 1) * 100]));
  });
  it('has 10 bosses, 20+ mini/elites, 30+ normals', () => {
    expect(ENEMY_LIST.filter((e) => e.tier === 'boss')).toHaveLength(10);
    expect(ENEMY_LIST.filter((e) => e.tier === 'mini' || e.tier === 'elite').length).toBeGreaterThanOrEqual(20);
    expect(ENEMY_LIST.filter((e) => e.tier === 'normal').length).toBeGreaterThanOrEqual(30);
  });
  it('has 7 heroes, each with 3 skills, a passive and 10 talents', () => {
    expect(HERO_LIST).toHaveLength(7);
    for (const h of HERO_LIST) {
      expect(h.skills).toHaveLength(3);
      expect(h.talents).toHaveLength(10);
      expect(PASSIVES[h.passive]).toBeTruthy();
      for (const s of [h.basic, ...h.skills]) expect(hasSkill(s)).toBe(true);
      h.talents.forEach((t, i) => t.requires.forEach((r) => expect(r).toBeLessThan(i)));
    }
  });
  it('has 100+ items, 6 relics, 20+ events/quests/achievements', () => {
    expect(ITEM_LIST.length).toBeGreaterThanOrEqual(100);
    expect(Object.keys(RELICS)).toHaveLength(6);
    expect(EVENTS.length).toBeGreaterThanOrEqual(20);
    expect(QUESTS.length).toBeGreaterThanOrEqual(25);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(20);
    expect(LORE.length).toBeGreaterThanOrEqual(40);
  });
  it('has a bond for every hero pair with three scenes and a combo', () => {
    expect(BOND_LIST).toHaveLength(21);
    for (let i = 0; i < HERO_IDS.length; i++) {
      for (let j = i + 1; j < HERO_IDS.length; j++) {
        const b = BONDS[bondId(HERO_IDS[i], HERO_IDS[j])];
        expect(b, `${HERO_IDS[i]}+${HERO_IDS[j]}`).toBeTruthy();
        expect(b.scenes).toHaveLength(3);
        b.scenes.forEach((s) => expect(s.lines.length).toBeGreaterThanOrEqual(3));
      }
    }
  });
});

describe('content integrity', () => {
  it('every chapter references real enemies', () => {
    for (const c of CHAPTERS) {
      for (const id of [...c.normals, ...c.minis, c.elite, c.boss]) expect(ENEMIES[id], id).toBeTruthy();
      expect(ENEMIES[c.boss].tier).toBe('boss');
      expect(ENEMIES[c.elite].tier).toBe('elite');
    }
  });
  it('every enemy skill exists, and every enemy can damage', () => {
    for (const e of ENEMY_LIST) {
      expect(e.skills.length).toBeGreaterThan(0);
      for (const r of e.skills) expect(hasSkill(r.skill), `${e.id}:${r.skill}`).toBe(true);
      expect(e.skills.some((r) => !!getSkill(r.skill).hits), `${e.id} damages`).toBe(true);
      for (const p of e.phases ?? []) for (const r of p.addSkills ?? []) expect(hasSkill(r.skill)).toBe(true);
    }
  });
  it('summon targets exist', () => {
    const all = [
      ...ENEMY_LIST.flatMap((e) => e.skills.map((s) => getSkill(s.skill))),
      ...ENEMY_LIST.flatMap((e) => (e.phases ?? []).flatMap((p) => (p.addSkills ?? []).map((s) => getSkill(s.skill)))),
    ];
    for (const s of all) for (const ef of s.effects ?? []) if (ef.k === 'summon') expect(ENEMIES[ef.enemy], ef.enemy).toBeTruthy();
    for (const e of ENEMY_LIST) for (const p of e.phases ?? []) for (const ef of p.effects) if (ef.k === 'summon') expect(ENEMIES[ef.enemy]).toBeTruthy();
  });
  it('items, sets and affixes are consistent', () => {
    for (const t of ITEM_LIST) {
      for (const a of t.affixes ?? []) expect(AFFIXES[a], `${t.id}:${a}`).toBeTruthy();
      if (t.set) expect(SETS[t.set], t.id).toBeTruthy();
      if (t.boss) { expect(ENEMIES[t.boss], t.id).toBeTruthy(); expect(t.signature).toBeTruthy(); }
      expect(Object.keys(t.stats).length).toBeGreaterThan(0);
    }
    for (const s of Object.values(SETS)) { expect(s.pieces).toHaveLength(4); for (const p of s.pieces) expect(ITEMS[p]).toBeTruthy(); }
  });
  it('every hero can find a weapon in every tier', () => {
    for (const h of HERO_LIST) {
      for (let tier = 1; tier <= 10; tier++) {
        const ok = ITEM_LIST.some((t) => t.tier === tier && t.slot === 'weapon' && !t.boss && t.weapon && h.weapon.includes(t.weapon));
        expect(ok, `${h.id} tier ${tier}`).toBe(true);
      }
    }
  });
  it('every skill has a tooltip and a description line', () => {
    const ids = [...HERO_LIST.flatMap((h) => [h.basic, ...h.skills]), ...ENEMY_LIST.flatMap((e) => e.skills.map((s) => s.skill))];
    for (const id of ids) {
      const s = getSkill(id);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.desc.length).toBeGreaterThan(0);
      expect(describeSkill(s).length).toBeGreaterThan(0);
    }
  });
  it('event outcomes are well-formed', () => {
    for (const e of EVENTS) {
      for (const c of e.choices) {
        expect(c.outcomes.reduce((a, o) => a + o.chance, 0)).toBeCloseTo(1, 5);
        for (const o of c.outcomes) for (const r of o.results) if (r.k === 'lore') expect(LORE_BY_ID[r.id], r.id).toBeTruthy();
      }
    }
    expect(HEROES.aragorn.unlock.chapter).toBe(1);
  });
});
