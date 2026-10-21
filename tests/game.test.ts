import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/content/chapters.ts';
import { ENEMIES } from '../src/content/enemies.ts';
import { HEROES } from '../src/content/heroes.ts';
import { ITEMS, ITEM_LIST, RARITY_MULT } from '../src/content/items.ts';
import { RELICS, relicBonus, relicCost } from '../src/content/relics.ts';
import { HERO_IDS, RARITIES } from '../src/content/schema.ts';
import { BAL, levelCap, xpToNext } from '../src/core/balance.ts';
import { descendAge, descentPreview, startExpedition, retreat, bankExpedition, enterFloor } from '../src/core/expedition.ts';
import { enemyStats, planFloor } from '../src/core/floors.ts';
import {
  autoEquip, autoEquipAll, buyTalent, canBuyTalent, equip, grantXp, newGame, respecTalents, salvage, talentPoints, unlockHero, upgradeItem, ascendItem, canEquip, forgeUnlocked, upgradeCostFor,
} from '../src/core/game.ts';
import { makeItem, rollRarity } from '../src/core/loot.ts';
import { Rng } from '../src/core/rng.ts';
import { computeHero, itemScore, itemStat } from '../src/core/stats.ts';
import { activeCombos, buildSetup, featureUnlocked, formation } from '../src/core/party.ts';
import { Battle } from '../src/core/battle/engine.ts';
import { getItem } from '../src/core/game.ts';

describe('floor plans follow the spec patterns', () => {
  it('floor 10 mini, 25 event, 50 elite, 75 challenge, 100 boss in every chapter', () => {
    for (let c = 0; c < 10; c++) {
      const f = (n: number) => planFloor(c * 100 + n, 1, 3);
      expect(f(10).tag).toBe('mini'); expect(f(25).tag).toBe('event'); expect(f(50).tag).toBe('elite');
      expect(f(75).tag).toBe('challenge'); expect(f(100).tag).toBe('boss'); expect(f(100).bossId).toBe(CHAPTERS[c].boss);
      expect(f(75).challenge.length).toBe(1);
    }
  });
  it('varies the pattern: mini-bosses alternate, and there are gauntlets, ambushes and vaults', () => {
    const tags = new Set(Array.from({ length: 100 }, (_, i) => planFloor(i + 1, 5, 3).tag));
    for (const t of ['normal', 'mini', 'elite', 'event', 'challenge', 'boss', 'gauntlet', 'ambush', 'vault']) expect(tags.has(t as never)).toBe(true);
    expect(planFloor(10, 1, 3).waves[0].map((e) => e.id)).toContain(CHAPTERS[0].minis[0]);
    expect(planFloor(30, 1, 3).waves[0].map((e) => e.id)).toContain(CHAPTERS[0].minis[1]);
  });
  it('is deterministic and uses chapter enemies only (normals)', () => {
    expect(JSON.stringify(planFloor(137, 9, 4))).toBe(JSON.stringify(planFloor(137, 9, 4)));
    const p = planFloor(205, 3, 4); // chapter 3 normal-ish floor
    for (const w of p.waves) for (const e of w) expect([...CHAPTERS[2].normals, ...CHAPTERS[2].minis, CHAPTERS[2].elite, CHAPTERS[2].boss]).toContain(e.id);
  });
  it('enemy counts never exceed five and slots are unique', () => {
    for (let f = 1; f <= 1000; f += 7) { for (const w of planFloor(f, 11, 5).waves) { expect(w.length).toBeLessThanOrEqual(5); expect(new Set(w.map((e) => e.slot)).size).toBe(w.length); } }
  });
  it('endless floors scale up without a ceiling, with a boss every 25', () => {
    expect(planFloor(1025, 1, 5).tag).toBe('boss'); expect(planFloor(1050, 1, 5).tag).toBe('boss');
    const a = enemyStats(ENEMIES['hall-troll'], 1100).hp, b = enemyStats(ENEMIES['hall-troll'], 1500).hp, c = enemyStats(ENEMIES['hall-troll'], 2500).hp;
    expect(b).toBeGreaterThan(a); expect(c).toBeGreaterThan(b);
    expect(Number.isFinite(c)).toBe(true);
  });
  it('the first floors are gentle', () => {
    const s = newGame(7);
    for (let f = 1; f <= 3; f++) {
      const plan = planFloor(f, s.seed, 1); let w = 0;
      for (let i = 0; i < 60; i++) { if (new Battle(buildSetup(s, plan), 100 + i, { record: false }).run().result === 'victory') w++; }
      expect(w, `floor ${f}`).toBeGreaterThanOrEqual(54);
    }
  });
});

describe('heroes, talents and gear', () => {
  it('leveling grants talent points and respec refunds them', () => {
    const s = newGame(1);
    grantXp(s, 'aragorn', 1e9);
    expect(s.heroes.aragorn.level).toBe(levelCap(1));
    expect(talentPoints(s, 'aragorn').free).toBe(levelCap(1) - 1);
    expect(buyTalent(s, 'aragorn', 0)).toBe(true);
    expect(buyTalent(s, 'aragorn', 0)).toBe(false);
    expect(canBuyTalent(s, 'aragorn', 8).ok).toBe(false); // needs prerequisites
    const before = talentPoints(s, 'aragorn').free;
    respecTalents(s, 'aragorn');
    expect(talentPoints(s, 'aragorn').free).toBeGreaterThan(before);
  });
  it('the level cap blocks further xp', () => {
    const s = newGame(1);
    grantXp(s, 'aragorn', 1e12);
    const lv = s.heroes.aragorn.level;
    expect(grantXp(s, 'aragorn', 1e12)).toEqual([]);
    expect(s.heroes.aragorn.level).toBe(lv);
  });
  it('talents change stats and skills', () => {
    const s = newGame(1);
    grantXp(s, 'gimli' as never, 0);
    unlockHero(s, 'gimli'); s.heroes.gimli.level = 20;
    const before = computeHero(s, 'gimli');
    s.heroes.gimli.talents = [0, 2];
    const after = computeHero(s, 'gimli');
    expect(after.stats.def).toBeGreaterThan(before.stats.def);
    expect((after.skills.find((x) => x.id === 'gimli-cleave')!.hits![0])).toBeGreaterThan(before.skills.find((x) => x.id === 'gimli-cleave')!.hits![0]);
  });
  it('equipment adds stats, respects weapon kinds and set bonuses apply', () => {
    const s = newGame(2);
    const rng = new Rng(1);
    const bow = makeItem(s, rng, { floor: 50, tier: 1, rarity: 'rare', tpl: 'elm-shortbow' }); s.inventory.push(bow);
    expect(canEquip(s, 'aragorn', bow, 'weapon')).toBe(false);
    unlockHero(s, 'legolas');
    expect(canEquip(s, 'legolas', bow, 'weapon')).toBe(true);
    const before = computeHero(s, 'legolas').stats.atk;
    equip(s, 'legolas', bow.uid);
    expect(computeHero(s, 'legolas').stats.atk).toBeGreaterThan(before);
    // full Gatewatch set (2 + 4 piece bonuses)
    const pieces = ['gatewatch-blade', 'gatewatch-mail', 'gatewatch-shield', 'gatewatch-badge'].map((id) => makeItem(s, rng, { floor: 20, tier: 1, rarity: 'rare', tpl: id }));
    for (const p of pieces) { s.inventory.push(p); equip(s, 'aragorn', p.uid); }
    const c = computeHero(s, 'aragorn');
    expect(c.setCounts.gatewatch).toBe(4);
    expect(c.passives.some((p) => p.kind === 'battleStart')).toBe(true);
  });
  it('rarity scales item stats and the forge adds 6% per level', () => {
    const s = newGame(3); const rng = new Rng(2);
    const a = makeItem(s, rng, { floor: 100, tier: 1, rarity: 'common', tpl: 'gatewatch-blade' });
    const b = makeItem(s, rng, { floor: 100, tier: 1, rarity: 'epic', tpl: 'gatewatch-blade' });
    expect(itemStat(b, 'atk') / itemStat(a, 'atk')).toBeCloseTo(RARITY_MULT.epic / RARITY_MULT.common, 5);
    const c = { ...a, plus: 5 };
    expect(itemStat(c, 'atk') / itemStat(a, 'atk')).toBeCloseTo(1.3, 5);
  });
  it('the forge is locked until chapter 3 and upgrades cost resources', () => {
    const s = newGame(4); const rng = new Rng(3);
    const it = makeItem(s, rng, { floor: 50, tier: 1, rarity: 'rare' }); s.inventory.push(it);
    expect(forgeUnlocked(s)).toBe(false); expect(upgradeItem(s, it.uid)).toBe(false);
    s.age = 3; s.ore = 1000; s.cloth = 1000; s.gold = 1e6;
    expect(forgeUnlocked(s)).toBe(true);
    const cost = upgradeCostFor(s, it);
    expect(upgradeItem(s, it.uid)).toBe(true);
    expect(s.ore).toBe(1000 - cost.ore); expect(getItem(s, it.uid)!.plus).toBe(1);
  });
  it('ascension needs an epic, the Chamber of Flame and shards', () => {
    const s = newGame(5); const rng = new Rng(4);
    const it = makeItem(s, rng, { floor: 850, tier: 9, rarity: 'epic' }); s.inventory.push(it);
    s.shards = 5; expect(ascendItem(s, it.uid)).toBe(false);
    s.age = 9;
    expect(ascendItem(s, it.uid)).toBe(true); expect(getItem(s, it.uid)!.rarity).toBe('legendary');
  });
  it('salvage refuses equipped and locked items', () => {
    const s = newGame(6);
    const eq = s.heroes.aragorn.equip.weapon!;
    expect(salvage(s, eq)).toBe(false);
    const rng = new Rng(5); const it = makeItem(s, rng, { floor: 10, tier: 1, rarity: 'common' }); s.inventory.push(it); it.locked = true;
    expect(salvage(s, it.uid)).toBe(false); it.locked = false; expect(salvage(s, it.uid)).toBe(true);
  });
  it('autoEquip never leaves a hero worse off', () => {
    const s = newGame(7); const rng = new Rng(7);
    for (let i = 0; i < 30; i++) s.inventory.push(makeItem(s, rng, { floor: 80, tier: 1, rarity: rollRarity(rng, 0) }));
    const p0 = computeHero(s, 'aragorn').stats;
    autoEquip(s, 'aragorn');
    const p1 = computeHero(s, 'aragorn').stats;
    expect(p1.atk + p1.hp / 10).toBeGreaterThanOrEqual(p0.atk + p0.hp / 10);
  });
});

describe('auto-equip fills both accessory slots', () => {
  const accs = ITEM_LIST.filter((i) => i.slot === 'accessory' && !i.boss).slice(0, 4);
  const give = (s: ReturnType<typeof newGame>, n: number) => accs.slice(0, n).map((tpl, i) => { const it = makeItem(s, new Rng(40 + i), { floor: 120, tier: tpl.tier, rarity: 'rare', tpl: tpl.id }); s.inventory.push(it); return it; });
  it('puts two accessories on a hero with none', () => {
    const s = newGame(3); give(s, 3);
    autoEquip(s, 'aragorn');
    expect(s.heroes.aragorn.equip.accessory1).not.toBeNull(); expect(s.heroes.aragorn.equip.accessory2).not.toBeNull();
    expect(s.heroes.aragorn.equip.accessory1).not.toBe(s.heroes.aragorn.equip.accessory2);
  });
  it('adds a second accessory to a hero who already wears one (it used to shuffle the first into the other slot)', () => {
    const s = newGame(3); const items = give(s, 3);
    const best = [...items].sort((x, y) => itemScore(y, 'phys') - itemScore(x, 'phys'))[0];
    equip(s, 'aragorn', best.uid, 'accessory1');
    autoEquip(s, 'aragorn');
    const e = s.heroes.aragorn.equip;
    expect(e.accessory1).toBe(best.uid);              // the best piece stays where it was
    expect(e.accessory2).not.toBeNull(); expect(e.accessory2).not.toBe(best.uid);
  });
  it('keeps a hero\'s two good accessories instead of dropping one when they swap slots', () => {
    const s = newGame(3); const items = give(s, 2);
    const [lo, hi] = [...items].sort((x, y) => itemScore(x, 'phys') - itemScore(y, 'phys'));
    equip(s, 'aragorn', hi.uid, 'accessory2'); equip(s, 'aragorn', lo.uid, 'accessory1');
    autoEquip(s, 'aragorn');
    const e = s.heroes.aragorn.equip;
    expect([e.accessory1, e.accessory2].sort()).toEqual([hi.uid, lo.uid].sort());
  });
  it('autoEquipAll hands out accessories two per hero while there are enough', () => {
    const s = newGame(3); unlockHero(s, 'gimli'); give(s, 4);
    autoEquipAll(s);
    for (const h of ['aragorn', 'gimli'] as const) { expect(s.heroes[h].equip.accessory1).not.toBeNull(); expect(s.heroes[h].equip.accessory2).not.toBeNull(); }
  });
});

describe('relics', () => {
  it('costs rise monotonically, gains are visible and diminish past the soft cap', () => {
    for (const r of Object.values(RELICS)) {
      let prev = 0;
      for (let l = 0; l < r.maxLevel; l++) { const c = relicCost(r, l); expect(c).toBeGreaterThan(prev); prev = c; }
      const early = relicBonus(r, 11) - relicBonus(r, 10); const late = relicBonus(r, r.softCap + 11) - relicBonus(r, r.softCap + 10);
      expect(late).toBeLessThan(early);
      expect(relicBonus(r, 1)).toBeGreaterThan(0);
    }
  });
  it('relic levels change hero stats', () => {
    const s = newGame(8); const base = computeHero(s, 'aragorn').stats;
    s.relics.light = 10; s.relics.horn = 10; s.relics.courage = 10;
    const c = computeHero(s, 'aragorn').stats;
    expect(c.hp).toBeGreaterThan(base.hp); expect(c.atk).toBeGreaterThan(base.atk); expect(c.def).toBeGreaterThan(base.def);
  });
});

describe('loot tables', () => {
  it('rarity weights are roughly as designed and legendary never rolls generically', () => {
    const rng = new Rng(9); const n: Record<string, number> = {};
    for (let i = 0; i < 20000; i++) { const r = rollRarity(rng, 0); n[r] = (n[r] ?? 0) + 1; }
    expect(n.common).toBeGreaterThan(n.uncommon); expect(n.uncommon).toBeGreaterThan(n.rare); expect(n.rare).toBeGreaterThan(n.epic);
    expect(n.legendary ?? 0).toBe(0);
  });
  it('every boss signature item exists and only drops as legendary', () => {
    for (const c of CHAPTERS) { const sig = ITEM_LIST.filter((i) => i.boss === c.boss); expect(sig.length).toBe(1); expect(sig[0].minRarity).toBe('legendary'); }
    void RARITIES; void ITEMS;
  });
});

describe('expeditions and the Age reset', () => {
  it('starts only at checkpoints you have reached', () => {
    const s = newGame(10);
    expect(startExpedition(s, 11)).toBe(false);
    expect(startExpedition(s, 1)).toBe(true);
    expect(s.expedition!.floor).toBe(1);
  });
  it('retreating banks everything and clears the expedition', () => {
    const s = newGame(11); startExpedition(s, 1);
    s.expedition!.gold = 500; s.expedition!.ore = 20; s.expedition!.essence = 7;
    retreat(s);
    const g0 = s.gold;
    const out = bankExpedition(s)!;
    expect(out.gold).toBe(500); expect(s.gold).toBe(g0 + 500); expect(s.essence).toBe(7); expect(s.expedition).toBeNull();
  });
  it('defeat keeps essence but loses 40% of gold and materials', () => {
    const s = newGame(12); startExpedition(s, 1);
    const e = s.expedition!; e.gold = 1000; e.ore = 100; e.essence = 10; e.ended = { reason: 'defeat', keep: BAL.defeatKeep }; e.phase = 'ended';
    const g0 = s.gold;
    bankExpedition(s);
    expect(s.gold - g0).toBe(600); expect(s.essence).toBe(10);
  });
  it('descent is gated, previews honestly, and resets only what it says', () => {
    const s = newGame(13);
    expect(descentPreview(s).canDescend).toBe(false);
    s.best = 100; s.gold = 9999; s.ore = 50; s.camp.age.whetstone = 5; s.relics.light = 7; s.renown = 4; s.essence = 33; s.lore.push('lore-1-a'); s.bonds['aragorn+gimli'] = 77;
    unlockHero(s, 'gimli'); s.heroes.aragorn.level = 20; s.heroes.aragorn.talents = [0, 1];
    const rng = new Rng(1);
    const leg = makeItem(s, rng, { floor: 100, tier: 1, rarity: 'legendary', tpl: 'wardens-gatebreaker' }); s.inventory.push(leg);
    const junk = makeItem(s, rng, { floor: 100, tier: 1, rarity: 'rare' }); s.inventory.push(junk);
    const keepMe = makeItem(s, rng, { floor: 100, tier: 1, rarity: 'epic' }); keepMe.locked = true; s.inventory.push(keepMe);
    const p = descentPreview(s);
    expect(p.canDescend).toBe(true); expect(p.nextAge).toBe(2); expect(p.levelCapTo).toBeGreaterThan(p.levelCapFrom);
    expect(descendAge(s)).toBe(true);
    expect(s.age).toBe(2); expect(s.gold).toBe(p.purse); expect(s.ore).toBe(0); expect(s.camp.age.whetstone).toBeUndefined();
    expect(s.relics.light).toBe(7); expect(s.renown).toBeGreaterThanOrEqual(4); expect(s.essence).toBe(33); expect(s.lore).toContain('lore-1-a'); expect(s.bonds['aragorn+gimli']).toBe(77);
    expect(s.heroes.aragorn.level).toBe(20); expect(s.heroes.aragorn.talents).toEqual([0, 1]); expect(s.heroes.gimli.unlocked).toBe(true);
    expect(getItem(s, leg.uid)).toBeTruthy(); expect(getItem(s, keepMe.uid)).toBeTruthy(); expect(getItem(s, junk.uid)).toBeUndefined();
    expect(levelCap(s.age)).toBeGreaterThan(levelCap(1));
    for (const h of HERO_IDS) if (s.heroes[h].unlocked) { expect(s.heroes[h].equip.weapon).toBeTruthy(); expect(ITEMS[getItem(s, s.heroes[h].equip.weapon)!.tpl].tier).toBe(2); }
  });
  it('cannot descend with an expedition running or past the last Age', () => {
    const s = newGame(14); s.best = 100; startExpedition(s, 1);
    expect(descendAge(s)).toBe(false);
    const t = newGame(15); t.age = 10; t.best = 1000;
    expect(descentPreview(t).canDescend).toBe(false);
  });
});

describe('feature unlocks and bonds', () => {
  it('formation, forge, combos and legendary unlock by chapter', () => {
    const s = newGame(16);
    expect(featureUnlocked(s, 'formation')).toBe(false);
    s.best = 300; s.age = 3; expect(featureUnlocked(s, 'forge')).toBe(true); expect(featureUnlocked(s, 'formation')).toBe(false);
    s.age = 4; expect(featureUnlocked(s, 'formation')).toBe(true);
    expect(featureUnlocked(s, 'combos')).toBe(false); s.age = 8; expect(featureUnlocked(s, 'combos')).toBe(true);
    expect(featureUnlocked(s, 'legendary')).toBe(false); s.age = 9; expect(featureUnlocked(s, 'legendary')).toBe(true);
  });
  it('heroes join at their chapter milestones', () => {
    for (const id of HERO_IDS) expect(HEROES[id].unlock.chapter).toBeGreaterThanOrEqual(1);
    expect(HEROES.legolas.unlock.chapter).toBe(2); expect(HEROES.boromir.unlock.chapter).toBe(5); expect(HEROES.sam.unlock.chapter).toBe(6); expect(HEROES.gandalf.unlock.chapter).toBe(7);
  });
  it('tier-3 bonds activate combos (one until Combo Mastery)', () => {
    const s = newGame(17);
    for (const h of ['gimli', 'legolas', 'sam'] as const) unlockHero(s, h);
    s.bonds['aragorn+gimli'] = 999; s.bonds['aragorn+legolas'] = 999; s.bonds['gimli+legolas'] = 999;
    const ids = formation(s).map((f) => f.id);
    expect(activeCombos(s, ids).length).toBe(1);
    s.age = 8;
    expect(activeCombos(s, ids).length).toBe(3);
  });
});

describe('xp curve', () => {
  it('grows smoothly', () => { for (let l = 1; l < 120; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l)); });
  it('enterFloor on a fresh expedition leaves a usable phase', () => {
    const s = newGame(18); startExpedition(s, 1); enterFloor(s);
    expect(['room', 'door', 'event']).toContain(s.expedition!.phase);
  });
});

describe('formation', () => {
  it('auto mode never puts more than three in front or two behind and keeps everyone', () => {
    const s = newGame(40);
    for (const h of ['gimli', 'frodo', 'legolas', 'sam', 'boromir', 'gandalf'] as const) unlockHero(s, h);
    for (const party of [['legolas', 'sam', 'gandalf', 'frodo', 'aragorn'], ['gimli', 'aragorn', 'boromir', 'legolas', 'sam'], ['sam', null, null, null, null]] as const) {
      s.party = [...party] as never;
      const f = formation(s);
      expect(f.filter((x) => x.row === 'front').length).toBeLessThanOrEqual(3);
      expect(f.filter((x) => x.row === 'back').length).toBeLessThanOrEqual(2);
      expect(f.length).toBe(party.filter(Boolean).length);
      expect(new Set(f.map((x) => x.slot)).size).toBe(f.length);
    }
  });
  it('manual mode (Age 4) uses the slots exactly as arranged', () => {
    const s = newGame(41); s.age = 4;
    for (const h of ['gimli', 'legolas', 'sam'] as const) unlockHero(s, h);
    s.party = ['legolas', null, 'gimli', null, 'sam'];
    const f = formation(s);
    expect(f.find((x) => x.id === 'legolas')).toMatchObject({ slot: 0, row: 'front' });
    expect(f.find((x) => x.id === 'gimli')).toMatchObject({ slot: 2, row: 'front' });
    expect(f.find((x) => x.id === 'sam')).toMatchObject({ slot: 4, row: 'back' });
  });
});
