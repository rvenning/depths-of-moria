import { describe, expect, it } from 'vitest';
import { Rng, mixSeed } from '../src/core/rng.ts';
import { getSkill } from '../src/content/skills.ts';
import { Battle } from '../src/core/battle/engine.ts';
import type { BEvent } from '../src/core/battle/types.ts';
import { BASE, run, setup, unit } from './helpers.ts';

describe('rng', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const a = new Rng(5), b = new Rng(5), c = new Rng(6);
    const xs = Array.from({ length: 20 }, () => a.next());
    expect(xs).toEqual(Array.from({ length: 20 }, () => b.next()));
    expect(xs).not.toEqual(Array.from({ length: 20 }, () => c.next()));
    for (const x of xs) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
  it('mixSeed is order sensitive and stable', () => {
    expect(mixSeed(1, 2, 3)).toBe(mixSeed(1, 2, 3));
    expect(mixSeed(1, 2, 3)).not.toBe(mixSeed(3, 2, 1));
  });
  it('int stays in range and weighted respects zero weights', () => {
    const r = new Rng(9);
    for (let i = 0; i < 500; i++) { const v = r.int(3, 7); expect(v).toBeGreaterThanOrEqual(3); expect(v).toBeLessThanOrEqual(7); }
    for (let i = 0; i < 100; i++) expect(r.weighted(['a', 'b'], (x) => (x === 'a' ? 0 : 1))).toBe('b');
  });
});

describe('battle determinism', () => {
  const mk = () => setup(
    [unit('hero', 'h1', 0, 'front', { hp: 800 }, [getSkill('gimli-cleave')], getSkill('gimli-basic'), { heroId: 'gimli' }), unit('hero', 'h2', 3, 'back', { spd: 120 }, [], getSkill('legolas-basic'), { heroId: 'legolas' })],
    [unit('enemy', 'e1', 0, 'front', { hp: 900 }), unit('enemy', 'e2', 3, 'back', { hp: 500 }, [], getSkill('e-shoot'))],
  );
  it('same seed gives an identical event log', () => {
    const a = run(mk(), 42), b = run(mk(), 42);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.res.result).toBe(b.res.result);
  });
  it('different seeds diverge', () => {
    expect(JSON.stringify(run(mk(), 1).events)).not.toBe(JSON.stringify(run(mk(), 2).events));
  });
  it('replaying step by step equals run to completion', () => {
    const b1 = new Battle(mk(), 7);
    while (!b1.over) b1.step();
    const b2 = new Battle(mk(), 7); b2.run();
    expect(JSON.stringify(b1.events)).toBe(JSON.stringify(b2.events));
  });
});

describe('damage rules', () => {
  const hits = (events: BEvent[]) => events.filter((e): e is Extract<BEvent, { t: 'hit' }> => e.t === 'hit' && e.kind === 'phys');
  it('follows max(1, atk × mult × 100/(100+def)) within the variance band', () => {
    const s = setup([unit('hero', 'h', 0, 'front', { atk: 200, hp: 1e6 }, [], getSkill('aragorn-basic'))], [unit('enemy', 'e', 0, 'front', { hp: 1e6, def: 100, atk: 1 })]);
    const { events } = run(s, 3);
    const h = hits(events).filter((e) => e.actor === 1 && !e.crit);
    expect(h.length).toBeGreaterThan(3);
    for (const e of h) { expect(e.amount).toBeGreaterThanOrEqual(Math.round(200 * 0.5 * 0.94)); expect(e.amount).toBeLessThanOrEqual(Math.round(200 * 0.5 * 1.06)); }
  });
  it('never deals less than 1', () => {
    const s = setup([unit('hero', 'h', 0, 'front', { atk: 1, hp: 1e6 })], [unit('enemy', 'e', 0, 'front', { hp: 30, def: 100000 })]);
    const { events } = run(s, 1);
    for (const e of hits(events)) expect(e.amount).toBeGreaterThanOrEqual(1);
  });
  it('crits multiply by crit damage', () => {
    const s = setup([unit('hero', 'h', 0, 'front', { atk: 100, crit: 75, critDmg: 300, hp: 1e6 })], [unit('enemy', 'e', 0, 'front', { hp: 1e6, atk: 1 })]);
    const { events } = run(s, 5);
    const crits = hits(events).filter((e) => e.actor === 1 && e.crit); const norm = hits(events).filter((e) => e.actor === 1 && !e.crit);
    expect(crits.length).toBeGreaterThan(0); expect(norm.length).toBeGreaterThan(0);
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(avg(crits.map((e) => e.amount)) / avg(norm.map((e) => e.amount))).toBeGreaterThan(2.7);
  });
  it('magic uses resistance, physical uses defence', () => {
    const s = setup([unit('hero', 'h', 0, 'front', { mag: 100, hp: 1e6 }, [], getSkill('gandalf-basic'))], [unit('enemy', 'e', 0, 'front', { hp: 1e6, def: 0, res: 100, atk: 1 })]);
    const { events } = run(s, 1);
    const m = events.filter((e): e is Extract<BEvent, { t: 'hit' }> => e.t === 'hit' && e.kind === 'magic' && !e.crit);
    for (const e of m.slice(0, 5)) expect(e.amount).toBeLessThanOrEqual(54);
  });
});

describe('rows, taunts and targeting', () => {
  it('melee cannot reach the back row while a front unit lives', () => {
    const s = setup([unit('hero', 'h', 0, 'front', { hp: 1e6, atk: 50 })], [unit('enemy', 'front', 0, 'front', { hp: 400, atk: 1 }), unit('enemy', 'back', 3, 'back', { hp: 400, atk: 1 })]);
    const b = new Battle(s, 1);
    const names = new Map(b.units.map((u) => [u.uid, u.id]));
    let frontAlive = true;
    while (!b.over) {
      for (const e of b.step()) {
        if (e.t === 'death' && names.get(e.target) === 'front') frontAlive = false;
        if (e.t === 'hit' && e.actor === 1 && frontAlive) expect(names.get(e.target)).toBe('front');
      }
    }
  });
  it('ranged skills can hit the back row', () => {
    const s = setup([unit('hero', 'h', 3, 'back', { hp: 1e6, atk: 100 }, [], getSkill('legolas-basic'), { pref: 'back-row' })], [unit('enemy', 'front', 0, 'front', { hp: 1e5, atk: 1 }), unit('enemy', 'back', 3, 'back', { hp: 1e5, atk: 1 })]);
    const b = new Battle(s, 1);
    const names = new Map(b.units.map((u) => [u.uid, u.id]));
    let sawBack = false;
    for (let i = 0; i < 30 && !b.over; i++) for (const e of b.step()) if (e.t === 'hit' && e.actor === 1 && names.get(e.target) === 'back') sawBack = true;
    expect(sawBack).toBe(true);
  });
  it('a taunting unit forces single-target attacks', () => {
    const tank = unit('hero', 'tank', 0, 'front', { hp: 1e6, atk: 1 }, [getSkill('gimli-stoneguard')], getSkill('gimli-basic'), { rules: [{ id: 'guard-low', enabled: true, param: 100 }, { id: 'basic', enabled: true }] });
    const squishy = unit('hero', 'squishy', 3, 'back', { hp: 1e6, atk: 1 });
    const s = setup([tank, squishy], [unit('enemy', 'e', 0, 'front', { hp: 1e6, atk: 50, spd: 140 }, [], getSkill('e-shoot'))]);
    const b = new Battle(s, 2);
    const names = new Map(b.units.map((u) => [u.uid, u.id]));
    let taunting = false; let violations = 0; let seen = 0;
    for (let i = 0; i < 60 && !b.over; i++) {
      for (const e of b.step()) {
        if (e.t === 'status' && e.id === 'taunt' && names.get(e.target) === 'tank') taunting = e.on;
        if (e.t === 'hit' && names.get(e.actor) === 'e' && e.kind === 'phys') { if (taunting) { seen++; if (names.get(e.target) !== 'tank') violations++; } }
      }
    }
    expect(seen).toBeGreaterThan(0); expect(violations).toBe(0);
  });
});

describe('initiative, cooldowns and statuses', () => {
  it('faster units act more often', () => {
    const s = setup([unit('hero', 'fast', 0, 'front', { spd: 200, hp: 1e6, atk: 1 })], [unit('enemy', 'slow', 0, 'front', { spd: 100, hp: 1e6, atk: 1 })]);
    const b = new Battle(s, 1); const n = { fast: 0, slow: 0 };
    for (let i = 0; i < 90; i++) for (const e of b.step()) if (e.t === 'turn' && !e.skip) n[b.unit(e.actor)!.id as 'fast' | 'slow']++;
    expect(n.fast / n.slow).toBeGreaterThan(1.7); expect(n.fast / n.slow).toBeLessThan(2.3);
  });
  it('skills respect their cooldown', () => {
    const cleave = getSkill('gimli-cleave'); // cd 2
    const s = setup([unit('hero', 'h', 0, 'front', { hp: 1e7, atk: 10 }, [cleave], getSkill('gimli-basic'))], [unit('enemy', 'e', 0, 'front', { hp: 1e7, atk: 1 })]);
    const b = new Battle(s, 1); const uses: number[] = []; let turn = 0;
    for (let i = 0; i < 60; i++) for (const e of b.step()) { if (e.t === 'turn' && b.unit(e.actor)!.side === 'hero') turn++; if (e.t === 'skill' && e.skill === 'gimli-cleave') uses.push(turn); }
    expect(uses.length).toBeGreaterThan(3);
    for (let i = 1; i < uses.length; i++) expect(uses[i] - uses[i - 1]).toBeGreaterThanOrEqual(2);
  });
  it('stun costs a turn and wears off', () => {
    const stunner = getSkill('e-crush');
    const s = setup([unit('hero', 'h', 0, 'front', { hp: 1e7, atk: 1 })], [unit('enemy', 'e', 0, 'front', { hp: 1e7, atk: 1, acc: 999 }, [{ ...stunner, effects: [{ k: 'status', id: 'stun', turns: 1 }], cd: 0 }])]);
    const b = new Battle(s, 3); let skipped = 0;
    for (let i = 0; i < 40; i++) for (const e of b.step()) if (e.t === 'turn' && e.skip === 'stun') skipped++;
    expect(skipped).toBeGreaterThan(0);
  });
  it('wards absorb damage before health', () => {
    const s = setup([unit('hero', 'h', 0, 'front', { hp: 1000, atk: 1, mag: 200 }, [getSkill('gandalf-flameward')], getSkill('gandalf-basic'), { rules: [{ id: 'buff-opener', enabled: true }, { id: 'basic', enabled: true }] })], [unit('enemy', 'e', 0, 'front', { hp: 1e7, atk: 60, spd: 90 })]);
    const b = new Battle(s, 1); let absorbed = 0;
    for (let i = 0; i < 12; i++) for (const e of b.step()) if (e.t === 'hit' && e.absorbed > 0) absorbed += e.absorbed;
    expect(absorbed).toBeGreaterThan(0);
  });
  it('healing heals and respects the noHealing challenge', () => {
    const mk = (challenge: string[]) => setup([unit('hero', 'h', 0, 'front', { hp: 1000, atk: 1, mag: 300 }, [getSkill('sam-provision')], getSkill('sam-basic'), { hpFrac: 0.3, rules: [{ id: 'heal-below', enabled: true, param: 90 }, { id: 'basic', enabled: true }] }), unit('hero', 'h2', 1, 'front', { hp: 1000, atk: 1 })], [unit('enemy', 'e', 0, 'front', { hp: 1e7, atk: 1, spd: 30 })], { challenge: challenge as never });
    const heal = (ch: string[]) => { const b = new Battle(mk(ch), 1); let t = 0; for (let i = 0; i < 20; i++) for (const e of b.step()) if (e.t === 'heal') t += e.amount; return t; };
    expect(heal([])).toBeGreaterThan(0); expect(heal(['noHealing'])).toBe(0);
  });
});

describe('no unavoidable one-shots', () => {
  const strike = (frac: number) => {
    const s = setup([unit('hero', 'h', 0, 'front', { hp: 1000, atk: 1, def: 0, spd: 10 }, [], undefined, { hpFrac: frac })], [unit('enemy', 'e', 0, 'front', { hp: 1e9, atk: 1e6, spd: 200 })]);
    const b = new Battle(s, 1); b.step();
    return b.heroes()[0];
  };
  it('a hero above half health survives any single blow with 1 hp', () => { const h = strike(1); expect(h.alive).toBe(true); expect(h.hp).toBe(1); });
  it('a hero below half health can still fall', () => { expect(strike(0.3).alive).toBe(false); });
});

describe('boss phases, hazards, waves and stall protection', () => {
  it('announces boss phases as health falls', () => {
    const boss = { ...unit('enemy', 'boss', 0, 'front', { hp: 5000, atk: 1 }), enemy: { id: 'boss', name: 'Boss', chapter: 1, tier: 'boss', family: 'warden', tags: [], row: 'front', hp: 1, atk: 1, def: 1, mag: 1, res: 1, spd: 100, skills: [{ skill: 'e-strike', weight: 1 }], phases: [{ hpBelow: 0.5, announce: 'half', effects: [] }, { hpBelow: 0.2, announce: 'low', effects: [] }], xp: 1, gold: 1, palette: { body: '#000', accent: '#000', eye: '#000', gear: '#000' }, codex: '' } as never, tier: 'boss' as const };
    const { events } = run(setup([unit('hero', 'h', 0, 'front', { atk: 400, hp: 1e7 })], [boss]), 1);
    const phases = events.filter((e) => e.t === 'phase').map((e) => (e as Extract<BEvent, { t: 'phase' }>).announce);
    expect(phases).toEqual(['half', 'low']);
  });
  it('telegraphs a hazard one round before it strikes and never kills outright', () => {
    const s = setup([unit('hero', 'h', 0, 'front', { hp: 1000, atk: 1 })], [unit('enemy', 'e', 0, 'front', { hp: 1e7, atk: 1 })], { hazards: [{ kind: 'furnace', every: 3, power: 50 }] });
    const b = new Battle(s, 1); const log: { warn: boolean; round: number }[] = [];
    for (let i = 0; i < 80 && !b.over; i++) for (const e of b.step()) if (e.t === 'hazard') log.push({ warn: !!e.warn, round: b.round });
    const strikes = log.filter((l) => !l.warn); const warns = log.filter((l) => l.warn);
    expect(strikes.length).toBeGreaterThan(0);
    for (const st of strikes) expect(warns.some((w) => w.round === st.round - 1 || w.round === st.round)).toBe(true);
    const hazardHits = b.events.filter((e): e is Extract<BEvent, { t: 'hit' }> => e.t === 'hit' && e.kind === 'hazard');
    expect(hazardHits.length).toBeGreaterThan(0);
    for (const h of hazardHits) expect(h.hp).toBeGreaterThanOrEqual(1);
  });
  it('plays multiple waves and ends in victory only after the last', () => {
    const s = setup([unit('hero', 'h', 0, 'front', { atk: 300, hp: 1e7 })], [unit('enemy', 'a', 0, 'front', { hp: 100, atk: 1 })]);
    s.waves.push([unit('enemy', 'b', 0, 'front', { hp: 100, atk: 1 })]);
    const { events, res } = run(s, 1);
    expect(events.filter((e) => e.t === 'wave')).toHaveLength(1);
    expect(res.result).toBe('victory'); expect(res.killedEnemies).toHaveLength(2);
  });
  it('enrage and the round cap prevent AFK stalls', () => {
    const s = setup([unit('hero', 'h', 0, 'front', { hp: 1e9, atk: 1, def: 1e6 })], [unit('enemy', 'e', 0, 'front', { hp: 1e9, atk: 1, def: 1e6 })]);
    const { res } = run(s, 1);
    expect(res.rounds).toBeLessThanOrEqual(65); expect(res.result).toBe('defeat');
  });
  it('summons fill free slots only up to five enemies', () => {
    const summoner = { ...getSkill('e-spawn-goblin'), cd: 0 };
    const s = setup([unit('hero', 'h', 0, 'front', { hp: 1e8, atk: 1 })], [unit('enemy', 'e', 0, 'front', { hp: 1e8, atk: 1 }, [summoner])], {
      spawn: (id, used) => { for (let i = 0; i < 5; i++) if (!used.has(i)) return unit('enemy', id, i, 'front', { hp: 1e8, atk: 1 }); return null; },
    });
    const b = new Battle(s, 1);
    for (let i = 0; i < 80 && !b.over; i++) { b.step(); expect(b.enemies().filter((u) => u.alive).length).toBeLessThanOrEqual(5); }
    expect(b.enemies().length).toBeGreaterThan(2);
  });
});

describe('hero AI rules', () => {
  it('heals below threshold before attacking and logs the rule', () => {
    const s = setup([
      unit('hero', 'healer', 3, 'back', { hp: 1000, atk: 1, mag: 300 }, [getSkill('sam-provision')], getSkill('sam-basic'), { rules: [{ id: 'heal-below', enabled: true, param: 60 }, { id: 'basic', enabled: true }] }),
      unit('hero', 'hurt', 0, 'front', { hp: 1000, atk: 1 }, [], undefined, { hpFrac: 0.4 }),
    ], [unit('enemy', 'e', 0, 'front', { hp: 1e7, atk: 1, spd: 20 })]);
    const b = new Battle(s, 1);
    const first = b.step().find((e) => e.t === 'skill') as Extract<BEvent, { t: 'skill' }>;
    expect(first.skill).toBe('sam-provision'); expect(first.rule).toContain('Heal below');
  });
  it('disabling a rule stops it from firing', () => {
    const s = setup([
      unit('hero', 'healer', 3, 'back', { hp: 1000, atk: 1, mag: 300 }, [getSkill('sam-provision')], getSkill('sam-basic'), { rules: [{ id: 'heal-below', enabled: false, param: 90 }, { id: 'basic', enabled: true }] }),
      unit('hero', 'hurt', 0, 'front', { hp: 1000, atk: 1 }, [], undefined, { hpFrac: 0.2 }),
    ], [unit('enemy', 'e', 0, 'front', { hp: 1e7, atk: 1, spd: 20 })]);
    const b = new Battle(s, 1); const used = new Set<string>();
    for (let i = 0; i < 8; i++) for (const e of b.step()) if (e.t === 'skill') used.add(e.skill);
    expect(used.has('sam-provision')).toBe(false);
  });
  it('uses the area skill only against three or more enemies', () => {
    const mk = (n: number) => setup([unit('hero', 'h', 0, 'front', { hp: 1e7, atk: 100 }, [getSkill('gimli-axestorm')], getSkill('gimli-basic'), { rules: [{ id: 'aoe-3', enabled: true }, { id: 'basic', enabled: true }] })], Array.from({ length: n }, (_, i) => unit('enemy', `e${i}`, i, 'front', { hp: 1e7, atk: 1 })));
    const count = (n: number) => { const b = new Battle(mk(n), 1); let c = 0; for (let i = 0; i < 40; i++) for (const e of b.step()) if (e.t === 'skill' && e.skill === 'gimli-axestorm') c++; return c; };
    expect(count(2)).toBe(0); expect(count(3)).toBeGreaterThan(0);
  });
  it('focuses a marked target when the rule is on', () => {
    const marker = unit('hero', 'marker', 0, 'front', { hp: 1e7, atk: 1 }, [getSkill('aragorn-mark')], getSkill('aragorn-basic'), { rules: [{ id: 'use-ready', enabled: true }, { id: 'basic', enabled: true }] });
    const hitter = unit('hero', 'hitter', 1, 'front', { hp: 1e7, atk: 50, spd: 80 }, [], getSkill('aragorn-basic'), { rules: [{ id: 'focus-marked', enabled: true }, { id: 'basic', enabled: true }] });
    const s = setup([marker, hitter], [unit('enemy', 'a', 0, 'front', { hp: 1e7, atk: 1 }), unit('enemy', 'b', 1, 'front', { hp: 1e6, atk: 1 })]);
    const b = new Battle(s, 1); let markedUid = -1; let hitsOnMarked = 0; let hitsOnOther = 0;
    for (let i = 0; i < 40; i++) for (const e of b.step()) {
      if (e.t === 'status' && e.id === 'mark' && e.on) markedUid = e.target;
      if (e.t === 'hit' && b.unit(e.actor)?.id === 'hitter' && markedUid > 0) { if (e.target === markedUid) hitsOnMarked++; else hitsOnOther++; }
    }
    expect(hitsOnMarked).toBeGreaterThan(0);
    expect(hitsOnOther).toBeLessThanOrEqual(1);
  });
});

describe('bond combos', () => {
  it('a focus-fire pair adds follow-up strikes', () => {
    const base = () => [unit('hero', 'a', 0, 'front', { hp: 1e7, atk: 100 }, [], getSkill('aragorn-basic'), { heroId: 'aragorn' }), unit('hero', 'b', 3, 'back', { hp: 1e7, atk: 100, spd: 80 }, [], getSkill('legolas-basic'), { heroId: 'legolas' })];
    const en = () => [unit('enemy', 'e', 0, 'front', { hp: 1e9, atk: 1 })];
    const count = (combos: boolean) => { const b = new Battle(setup(base(), en(), { combos: combos ? [{ a: 'aragorn', b: 'legolas', kind: 'focusFire', name: 'Test', power: 1 }] : [] }), 1); let n = 0; for (let i = 0; i < 40; i++) for (const e of b.step()) if (e.t === 'combo') n++; return n; };
    expect(count(false)).toBe(0); expect(count(true)).toBeGreaterThan(0);
  });
});

void BASE;
