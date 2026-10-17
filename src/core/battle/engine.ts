import { Rng, clamp } from '../rng.ts';
import type {
  BossPhase, ComboKind, EnemySkillRef, PassiveEffect, Row, SkillDef, SkillEffect, StatKey, StatusId,
} from '../../content/schema.ts';
import { STATUSES } from '../../content/statuses.ts';
import { getSkill } from '../../content/skills.ts';
import type {
  BEvent, BSkill, BStatus, BUnit, BattleResult, BattleSetup, ComboInput, HitKind, UnitInput, UnitView,
} from './types.ts';
import { chooseHeroAction } from './ai.ts';

export const GAUGE_FULL = 1000;
export const ROUND_LEN = 10; // time units per round (a 100-speed unit acts once per round)
const HARD_CC: StatusId[] = ['stun', 'fear', 'sealed'];
const SOFT_CC: StatusId[] = ['slow', 'blind', 'curse', 'weaken', 'vulnerable', 'shatter'];

interface ComboState { inp: ComboInput; a: BUnit; b: BUnit; cdLeft: number; used: number }

export interface BattleOptions { record?: boolean }

export class Battle {
  readonly rng: Rng;
  units: BUnit[] = [];
  events: BEvent[] = [];
  private out: BEvent[] = [];
  time = 0;
  round = 0;
  over = false;
  result: 'victory' | 'defeat' | null = null;
  waveIdx = 0;
  private nextUid = 1;
  private actorUid = -1;
  private combos: ComboState[] = [];
  private record: boolean;
  private healingDone = 0;
  killed: { id: string; tier: string; tags: string[] }[] = [];
  totalEnemies = 0;
  deaths = 0;
  crits = 0;
  actions = 0;
  combosFired = 0;

  readonly setup: BattleSetup;

  constructor(setup: BattleSetup, seed: number, opts: BattleOptions = {}) {
    this.setup = setup;
    this.rng = new Rng(seed);
    this.record = opts.record !== false;
    for (const inp of setup.heroes) this.units.push(this.makeUnit(inp));
    for (const inp of setup.waves[0] ?? []) this.units.push(this.makeUnit(inp));
    this.totalEnemies = setup.waves.reduce((n, w) => n + w.length, 0);
    for (const c of setup.combos) {
      const a = this.units.find((u) => u.heroId === c.a && u.side === 'hero');
      const b = this.units.find((u) => u.heroId === c.b && u.side === 'hero');
      if (a && b) this.combos.push({ inp: c, a, b, cdLeft: 0, used: 0 });
    }
    // opening gauge: faster units start further along, with a little jitter
    for (const u of this.units) u.gauge = Math.min(700, this.effStat(u, 'spd') * 3 + this.rng.range(0, 160));
    this.emit({ t: 'start', heroes: this.views('hero'), enemies: this.views('enemy') });
    this.startOfBattle();
  }

  // ------------------------------------------------------------------ construction
  private makeUnit(inp: UnitInput): BUnit {
    const maxHp = Math.max(1, Math.round(inp.stats.hp));
    const skills: BSkill[] = [];
    if (inp.side === 'hero' || (!inp.enemy && inp.skills.length)) {
      for (const def of inp.skills) skills.push({ def, cdLeft: def.startCd ?? 0, cdBase: def.cd, weight: 1, minPhase: 0 });
    } else if (inp.enemy) {
      for (const ref of inp.enemy.skills) skills.push(this.enemySkill(ref));
    }
    let threat = 1;
    for (const p of inp.passives) if (p.kind === 'threat') threat *= p.mult;
    const u: BUnit = {
      uid: this.nextUid++, side: inp.side, id: inp.id, name: inp.name, slot: inp.slot, row: inp.row,
      stats: { ...inp.stats }, hp: Math.max(1, Math.round(maxHp * clamp(inp.hpFrac, 0.01, 1))), maxHp,
      gauge: 0, alive: true, skills, basic: inp.basic, passives: inp.passives, statuses: [],
      rules: inp.rules ?? [], pref: inp.pref ?? 'default', tags: inp.tags, tier: inp.tier ?? 'normal',
      enemy: inp.enemy, heroId: inp.heroId, healBonus: inp.healBonus ?? 0, lifesteal: inp.lifesteal ?? 0,
      thorns: inp.thorns ?? 0, turns: 0, phase: 0, threat, firstStrike: 0, level: inp.level ?? 1, scale: inp.scale ?? 1,
      stun_immune: 0, dealt: 0, healed: 0, taken: 0, kills: 0,
    };
    for (const p of inp.passives) {
      if (p.kind === 'startCdReduce') for (const s of u.skills) s.cdLeft = Math.max(0, s.cdLeft - p.n);
      if (p.kind === 'firstStrike') u.firstStrike = p.critBonus;
    }
    for (const s of inp.startStatuses ?? []) this.addStatus(u, u, s.id, s.turns, s.power, undefined, true);
    return u;
  }

  private enemySkill(ref: EnemySkillRef): BSkill {
    const def = getSkill(ref.skill);
    return { def, cdLeft: ref.startCd ?? 0, cdBase: ref.cd ?? def.cd, weight: ref.weight, minPhase: ref.minPhase ?? 0 };
  }

  private startOfBattle(): void {
    this.round = 1;
    this.emit({ t: 'round', n: 1 });
    for (const u of this.units) {
      if (!u.alive) continue;
      for (const p of u.passives) {
        if (p.kind === 'battleStart') {
          if (p.markHighest) {
            const foes = this.foes(u).sort((x, y) => y.maxHp - x.maxHp);
            if (foes[0]) this.addStatus(u, foes[0], 'mark', 4, 25);
          }
          this.applyEffects(u, p.effects, [u], 1, true);
        }
      }
    }
    for (const c of this.combos) {
      if (c.inp.kind === 'ward') this.comboWard(c);
      if (c.inp.kind === 'rally') this.comboRally(c);
    }
  }

  // ------------------------------------------------------------------ queries
  heroes(): BUnit[] { return this.units.filter((u) => u.side === 'hero'); }
  enemies(): BUnit[] { return this.units.filter((u) => u.side === 'enemy'); }
  allies(u: BUnit): BUnit[] { return this.units.filter((x) => x.side === u.side && x.alive); }
  foes(u: BUnit): BUnit[] { return this.units.filter((x) => x.side !== u.side && x.alive); }
  unit(uid: number): BUnit | undefined { return this.units.find((u) => u.uid === uid); }
  has(u: BUnit, id: StatusId): BStatus | undefined { return u.statuses.find((s) => s.id === id); }
  hpFrac(u: BUnit): number { return u.hp / u.maxHp; }

  view(u: BUnit): UnitView {
    return {
      uid: u.uid, side: u.side, id: u.id, name: u.name, slot: u.slot, row: u.row, hp: u.hp, maxHp: u.maxHp,
      tier: u.tier, scale: u.scale, heroId: u.heroId, family: u.enemy?.family, gauge: u.gauge,
      skills: u.skills.map((s) => ({ id: s.def.id, name: s.def.name, cdLeft: s.cdLeft, cd: s.cdBase })),
    };
  }
  views(side: 'hero' | 'enemy'): UnitView[] { return this.units.filter((u) => u.side === side && u.alive).map((u) => this.view(u)); }

  effStat(u: BUnit, k: StatKey): number {
    let v = u.stats[k];
    let pct = 0;
    let flat = 0;
    for (const s of u.statuses) {
      switch (s.id) {
        case 'rally': if (k === 'atk' || k === 'mag') pct += s.power || 20; break;
        case 'weaken': if (k === 'atk' || k === 'mag') pct -= 25; break;
        case 'enrage': if (k === 'atk' || k === 'mag') pct += (s.power || 8) * s.stacks; break;
        case 'vulnerable': if (k === 'def' || k === 'res') pct -= 25; break;
        case 'shatter': if (k === 'def') pct -= 50; break;
        case 'haste': if (k === 'spd') pct += s.power || 20; break;
        case 'slow': if (k === 'spd') pct -= 30; break;
        case 'evasive': if (k === 'eva') flat += s.power || 40; break;
        case 'blind': if (k === 'acc') flat -= 40; break;
        case 'focus': if (k === 'crit') flat += s.power || 25; if (k === 'acc') flat += 20; break;
        default: break;
      }
    }
    for (const p of u.passives) if (p.kind === 'lowHp' && p.stat === k && u.hp / u.maxHp < p.below) pct += p.pct;
    const ch = this.setup.challenge;
    if (u.side === 'enemy') {
      if (ch.includes('haste') && k === 'spd') pct += 30;
      if (ch.includes('armoured') && (k === 'def' || k === 'res')) pct += 50;
    } else if (ch.includes('darkness') && k === 'acc') flat -= 30;
    v = v * Math.max(0.1, 1 + pct / 100) + flat;
    if (k === 'crit') v = clamp(v, 0, 75);
    if (k === 'spd') v = Math.max(20, v);
    return v;
  }

  // ------------------------------------------------------------------ events
  private emit(e: BEvent): void {
    if (this.record) { this.events.push(e); this.out.push(e); }
  }

  // ------------------------------------------------------------------ main loop
  /** Advance to the next unit's action. Returns the events produced. */
  step(): BEvent[] {
    this.out = [];
    if (this.over) return this.out;
    const actor = this.nextActor();
    const dt = Math.max(0, (GAUGE_FULL - actor.gauge) / this.effStat(actor, 'spd'));
    for (const u of this.units) if (u.alive) u.gauge += this.effStat(u, 'spd') * dt;
    this.time += dt;
    const newRound = Math.floor(this.time / ROUND_LEN) + 1;
    while (this.round < newRound && !this.over) { this.round++; this.onRoundStart(this.round); }
    if (this.over) return this.out;
    if (actor.alive) {
      actor.gauge = Math.max(0, actor.gauge - GAUGE_FULL);
      this.takeTurn(actor);
    }
    this.checkEnd();
    return this.out;
  }

  run(): BattleResult {
    let guard = 0;
    while (!this.over && guard++ < 20000) this.step();
    if (!this.over) this.finish('defeat');
    return this.summary();
  }

  private nextActor(): BUnit {
    let best: BUnit | null = null;
    let bt = Infinity;
    for (const u of this.units) {
      if (!u.alive) continue;
      const t = Math.max(0, (GAUGE_FULL - u.gauge) / this.effStat(u, 'spd'));
      if (t < bt - 1e-9 || (Math.abs(t - bt) <= 1e-9 && best && this.beats(u, best))) { best = u; bt = t; }
    }
    return best as BUnit;
  }
  private beats(a: BUnit, b: BUnit): boolean {
    const sa = this.effStat(a, 'spd'), sb = this.effStat(b, 'spd');
    if (sa !== sb) return sa > sb;
    if (a.side !== b.side) return a.side === 'hero';
    return a.slot < b.slot;
  }

  /** Predict the next n actors (ignores future effects). For the turn-order bar. */
  forecast(n: number): number[] {
    const g = new Map<number, number>();
    const live = this.units.filter((u) => u.alive);
    for (const u of live) g.set(u.uid, u.gauge);
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      let best: BUnit | null = null;
      let bt = Infinity;
      for (const u of live) {
        const t = Math.max(0, (GAUGE_FULL - (g.get(u.uid) as number)) / this.effStat(u, 'spd'));
        if (t < bt - 1e-9 || (Math.abs(t - bt) <= 1e-9 && best && this.beats(u, best))) { best = u; bt = t; }
      }
      if (!best) break;
      for (const u of live) g.set(u.uid, (g.get(u.uid) as number) + this.effStat(u, 'spd') * bt);
      g.set(best.uid, (g.get(best.uid) as number) - GAUGE_FULL);
      out.push(best.uid);
    }
    return out;
  }

  // ------------------------------------------------------------------ rounds / hazards
  private onRoundStart(r: number): void {
    this.emit({ t: 'round', n: r });
    // enrage so that no fight can stall
    const enrageAt = this.setup.enrageStart ?? 25;
    if (r >= enrageAt) {
      if (r === enrageAt) this.emit({ t: 'text', msg: 'The enemy grows desperate and fierce!', tone: 'warn' });
      for (const e of this.enemies()) if (e.alive) this.addStatus(e, e, 'enrage', 99, 8, 1, true);
    }
    if (r > (this.setup.maxRounds ?? 60)) { this.finish('defeat'); return; }
    for (const h of this.setup.hazards) this.runHazard(h, r);
    for (const c of this.combos) {
      if (!c.a.alive || !c.b.alive) continue;
      if (c.inp.kind === 'ward' && r > 1 && r % 5 === 0) this.comboWard(c);
      if (c.inp.kind === 'mend' && r % 3 === 0) this.comboMend(c);
      if (c.inp.kind === 'sparks' && r % 3 === 0) this.comboSparks(c);
    }
    const shadow = this.setup.shadow ?? 0;
    if (shadow === 5 && r > 1 && r % 4 === 0) {
      // war drums echo: the enemy side quickens its blows
      for (const e of this.enemies()) if (e.alive) this.addStatus(e, e, 'rally', 3, 8, undefined, true);
    }
  }

  private runHazard(h: { kind: string; every: number; power: number }, r: number): void {
    const warnAt = r + 1;
    if (warnAt % h.every === 0 && r >= 1 && !this.over) {
      this.emit({ t: 'hazard', kind: h.kind, name: HAZARD_NAMES[h.kind] ?? h.kind, warn: true });
    }
    if (r % h.every !== 0 || r < h.every) return;
    const heroes = this.heroes().filter((u) => u.alive);
    if (!heroes.length) return;
    this.emit({ t: 'hazard', kind: h.kind, name: HAZARD_NAMES[h.kind] ?? h.kind });
    const hurt = (u: BUnit, pct: number): void => {
      const amount = Math.max(1, Math.min(u.hp - 1, Math.round((u.maxHp * pct) / 100)));
      if (u.hp <= 1) return;
      this.applyRaw(u, u, amount, 'hazard');
    };
    switch (h.kind) {
      case 'furnace': for (const u of heroes) hurt(u, h.power); break;
      case 'emberRain': { const t = this.rng.shuffle(heroes).slice(0, 2); for (const u of t) { hurt(u, h.power); this.addStatus(u, u, 'burn', 2, 20, undefined, false, u.maxHp * 0.01); } break; }
      case 'drums': for (const e of this.enemies()) if (e.alive) this.addStatus(e, e, 'enrage', 99, h.power, 1, true); break;
      case 'mist': for (const u of heroes) this.addStatus(u, u, 'poison', 3, 10, undefined, false, u.maxHp * (h.power / 100)); break;
      case 'shadowDrain': { const u = this.rng.pick(heroes); this.addStatus(u, u, 'curse', 3, 50); break; }
      case 'collapse': { const u = this.rng.pick(heroes); hurt(u, h.power); this.addStatus(u, u, 'stun', 1, 0); break; }
      case 'tide': for (const u of heroes) this.addStatus(u, u, 'slow', 2, 30); break;
      case 'crumble': { const u = this.rng.pick(heroes); hurt(u, h.power); this.addStatus(u, u, 'vulnerable', 2, 25); break; }
      case 'ambush': {
        const add = this.setup.spawn;
        const foes = this.enemies().filter((e) => e.alive);
        if (add && foes.length < 5 && this.setup.waves[0]?.length) {
          const pool = this.setup.waves[0].filter((w) => w.tier !== 'boss');
          if (pool.length) {
            const pick = this.rng.pick(pool);
            const inp = add(pick.id, new Set(foes.map((e) => e.slot)));
            if (inp) this.spawnUnit(inp);
          }
        }
        break;
      }
      default: break;
    }
  }

  private spawnUnit(inp: UnitInput): BUnit {
    const u = this.makeUnit(inp);
    u.gauge = 300 + this.rng.range(0, 100);
    this.units.push(u);
    this.totalEnemies++;
    this.emit({ t: 'summon', unit: this.view(u) });
    return u;
  }

  // ------------------------------------------------------------------ turns
  private takeTurn(u: BUnit): void {
    this.actorUid = u.uid;
    u.turns++;
    this.actions++;
    for (const s of u.skills) if (s.cdLeft > 0) s.cdLeft--;
    if (u.stun_immune > 0) u.stun_immune--;
    // start-of-turn: DoT, regen
    for (const s of u.statuses.slice()) {
      if (s.id === 'poison' || s.id === 'burn' || s.id === 'bleed') {
        const amount = Math.max(1, Math.round(s.amount * s.stacks));
        this.applyRaw(u, this.unit(s.src) ?? u, amount, 'dot', s.id);
      } else if (s.id === 'regen') {
        this.healUnit(u, u, s.amount * s.stacks);
      }
      if (!u.alive) break;
    }
    if (u.alive) {
      const stun = this.has(u, 'stun');
      const fear = this.has(u, 'fear');
      if (stun) {
        this.emit({ t: 'turn', actor: u.uid, skip: 'stun' });
      } else if (fear && this.rng.chance(0.4)) {
        this.emit({ t: 'turn', actor: u.uid, skip: 'fear' });
      } else {
        this.emit({ t: 'turn', actor: u.uid });
        this.act(u);
      }
    }
    // end of turn: tick statuses
    if (u.alive) {
      for (const s of u.statuses.slice()) {
        if (s.fresh) { s.fresh = false; continue; }
        s.turns--;
        if (s.turns <= 0) this.removeStatus(u, s.id);
      }
    }
    this.actorUid = -1;
  }

  private act(u: BUnit): void {
    if (u.side === 'hero') {
      const d = chooseHeroAction(this, u);
      this.useSkill(u, d.skill, d.rule, d.target);
    } else {
      this.enemyAct(u);
    }
  }

  private enemyAct(u: BUnit): void {
    const sealed = this.has(u, 'sealed');
    const usable = u.skills.filter((s) => s.cdLeft <= 0 && u.phase >= s.minPhase && !sealed && this.skillValid(u, s.def));
    let pick: BSkill | null = null;
    if (usable.length) pick = this.rng.weighted(usable, (s) => s.weight);
    if (!pick) {
      const basic = u.skills.find((s) => s.cdBase === 0 && s.def.hits) ?? null;
      if (basic) { this.useSkill(u, basic.def, undefined, undefined, basic); return; }
      this.useSkill(u, u.basic);
      return;
    }
    this.useSkill(u, pick.def, undefined, undefined, pick);
  }

  /** is there something sensible for this skill to do? */
  skillValid(u: BUnit, def: SkillDef): boolean {
    switch (def.target) {
      case 'enemy': case 'twoEnemies': case 'randomEnemies': case 'markedEnemy': case 'weakestEnemy': case 'frontEnemies': case 'allEnemies':
        return this.foes(u).length > 0;
      case 'lowestAlly': case 'ally': {
        const a = this.allies(u).filter((x) => !(def.effects?.some((e) => e.k === 'selfDamagePct') && x === u));
        if (def.tags.includes('heal') && !def.hits) return a.some((x) => x.hp < x.maxHp);
        return a.length > 0;
      }
      default: break;
    }
    if (def.effects?.some((e) => e.k === 'summon')) {
      const free = 5 - this.enemies().filter((e) => e.alive).length;
      return free > 0 && !!this.setup.spawn;
    }
    if (def.tags.includes('heal') && !def.hits) return this.allies(u).some((x) => x.hp < x.maxHp);
    return true;
  }

  // ------------------------------------------------------------------ targeting
  /** the set of enemies a skill may legally pick from */
  targetable(actor: BUnit, def: SkillDef): BUnit[] {
    let c = this.foes(actor).filter((x) => !this.has(x, 'submerged'));
    if (def.target === 'allEnemies' || def.target === 'randomEnemies') return c;
    const notHidden = c.filter((x) => !this.has(x, 'hidden'));
    if (notHidden.length) c = notHidden;
    const taunters = c.filter((x) => this.has(x, 'taunt'));
    if (taunters.length) c = taunters;
    if (def.target === 'frontEnemies') {
      const f = c.filter((x) => x.row === 'front');
      return f.length ? f : c;
    }
    if (def.range === 'melee' && !def.bypass) {
      const f = c.filter((x) => x.row === 'front');
      if (f.length) c = f;
    }
    return c;
  }

  private pickEnemyTarget(actor: BUnit, def: SkillDef, forced?: BUnit): BUnit | null {
    const c = this.targetable(actor, def);
    if (!c.length) return null;
    if (forced && c.includes(forced)) return forced;
    if (actor.side === 'hero') {
      const marked = c.filter((x) => this.has(x, 'mark'));
      const focusRule = actor.rules.some((r) => r.id === 'focus-marked' && r.enabled);
      if (marked.length && (focusRule || actor.pref === 'marked-first')) return marked.sort((a, b) => a.hp - b.hp)[0];
      switch (actor.pref) {
        case 'lowest-hp': return c.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        case 'highest-atk': return c.slice().sort((a, b) => b.stats.atk + b.stats.mag - (a.stats.atk + a.stats.mag))[0];
        case 'back-row': { const back = c.filter((x) => x.row === 'back'); if (back.length) return back.sort((a, b) => a.hp - b.hp)[0]; break; }
        default: break;
      }
      return c.slice().sort((a, b) => a.hp - b.hp || a.slot - b.slot)[0];
    }
    return this.rng.weighted(c, (x) => x.threat * (x.row === 'back' ? 0.8 : 1) * (x.hp / x.maxHp < 0.35 ? 1.3 : 1));
  }

  private allyTarget(actor: BUnit, def: SkillDef): BUnit | null {
    const noSelf = def.effects?.some((e) => e.k === 'selfDamagePct');
    let a = this.allies(actor);
    if (noSelf) a = a.filter((x) => x !== actor);
    if (!a.length) return null;
    if (def.target === 'ally') {
      // shields and wards: prefer a hurt unit who has none yet, frontliners first
      const wantsShield = def.effects?.some((e) => e.k === 'shield');
      const pool = wantsShield ? a.filter((x) => !this.has(x, 'ward')) : a;
      const p = (pool.length ? pool : a).slice().sort((x, y) => (x.hp / x.maxHp) - (y.hp / y.maxHp) || (x.row === 'front' ? -1 : 1));
      return p[0];
    }
    return a.slice().sort((x, y) => (x.hp / x.maxHp) - (y.hp / y.maxHp) || x.slot - y.slot)[0];
  }

  resolveTargets(actor: BUnit, def: SkillDef, forced?: BUnit): BUnit[] {
    switch (def.target) {
      case 'self': return [actor];
      case 'allAllies': return this.allies(actor);
      case 'otherAllies': return this.allies(actor).filter((x) => x !== actor);
      case 'allUnits': return this.units.filter((x) => x.alive);
      case 'ally': case 'lowestAlly': { const t = this.allyTarget(actor, def); return t ? [t] : []; }
      case 'allEnemies': return this.targetable(actor, def);
      case 'frontEnemies': return this.targetable(actor, def);
      case 'randomEnemies': { const c = this.targetable(actor, def); return c.length ? [this.rng.pick(c)] : []; }
      case 'markedEnemy': {
        const m = this.foes(actor).find((x) => this.has(x, 'mark') && !this.has(x, 'submerged'));
        if (m) return [m];
        const t = this.pickEnemyTarget(actor, def, forced); return t ? [t] : [];
      }
      case 'weakestEnemy': {
        const c = this.targetable(actor, def).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        return c[0] ? [c[0]] : [];
      }
      case 'twoEnemies': {
        const first = this.pickEnemyTarget(actor, def, forced);
        if (!first) return [];
        const others = this.foes(actor).filter((x) => x !== first && !this.has(x, 'submerged'))
          .sort((a, b) => Math.abs(a.slot - first.slot) - Math.abs(b.slot - first.slot) || a.slot - b.slot);
        return others[0] ? [first, others[0]] : [first];
      }
      case 'enemy': default: { const t = this.pickEnemyTarget(actor, def, forced); return t ? [t] : []; }
    }
  }

  // ------------------------------------------------------------------ skills
  useSkill(actor: BUnit, def: SkillDef, rule?: string, forced?: BUnit, bs?: BSkill): void {
    const targets = this.resolveTargets(actor, def, forced);
    const found = bs ?? actor.skills.find((s) => s.def.id === def.id);
    if (found && def.cd >= 0 && def.id !== actor.basic.id) found.cdLeft = found.cdBase;
    if (!targets.length && def.target !== 'self' && def.target !== 'allAllies') {
      // nothing to do (e.g. every foe submerged): lose the turn quietly
      this.emit({ t: 'text', msg: `${actor.name} finds no target.`, tone: 'info' });
      return;
    }
    this.emit({ t: 'skill', actor: actor.uid, skill: def.id, name: def.name, targets: targets.map((x) => x.uid), fx: def.fx, rule });
    let dealtTotal = 0;
    const hitOk = new Set<number>();
    const killedBefore = actor.kills;
    if (def.hits && def.hits.length) {
      const hits = def.hits;
      for (let i = 0; i < hits.length; i++) {
        let list = targets;
        if (def.target === 'randomEnemies' && i > 0) {
          const c = this.targetable(actor, def);
          if (!c.length) break;
          list = [this.rng.pick(c)];
        }
        for (const t of list) {
          if (!t.alive) continue;
          if (def.target === 'randomEnemies' && i > 0) this.emit({ t: 'skill', actor: actor.uid, skill: def.id, name: def.name, targets: [t.uid], fx: def.fx });
          const r = this.strike(actor, t, def, hits[i], targets.length);
          if (r.hit) hitOk.add(t.uid);
          dealtTotal += r.dealt;
        }
      }
    }
    // effects
    if (def.effects?.length) {
      const recipients = def.hits ? targets.filter((x) => hitOk.has(x.uid) && x.alive) : targets;
      this.applyEffects(actor, def.effects, recipients, dealtTotal, false, def);
    }
    if (def.hits && def.hits.length) {
      this.afterAttack(actor, def, targets.filter((t) => hitOk.has(t.uid)), actor.kills > killedBefore);
    }
  }

  private applyEffects(actor: BUnit, effects: SkillEffect[], targets: BUnit[], dealt: number, passive = false, def?: SkillDef): void {
    for (const ef of effects) {
      const on = (ef as { on?: string }).on ?? 'target';
      let rec: BUnit[];
      switch (on) {
        case 'self': rec = [actor]; break;
        case 'allies': rec = this.allies(actor); break;
        case 'enemies': rec = this.foes(actor); break;
        case 'lowestAlly': { const t = this.allies(actor).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; rec = t ? [t] : []; break; }
        default: rec = targets; break;
      }
      switch (ef.k) {
        case 'status':
          for (const r of rec) {
            if (!r.alive) continue;
            if (ef.chance !== undefined && !this.rng.chance(ef.chance * this.ccResist(r, ef.id))) continue;
            else if (ef.chance === undefined && HARD_CC.includes(ef.id)) { if (!this.rng.chance(this.ccResist(r, ef.id))) continue; }
            this.addStatus(actor, r, ef.id, ef.turns, ef.power, ef.stacks);
          }
          break;
        case 'heal': for (const r of rec) this.healUnit(actor, r, this.effStat(actor, 'mag') * ef.mult * (1 + actor.healBonus)); break;
        case 'healPct': for (const r of rec) this.healUnit(actor, r, (r.maxHp * ef.pct) / 100 * (1 + actor.healBonus * 0.5)); break;
        case 'shield':
          for (const r of rec) {
            const amt = ef.pctMax ? (r.maxHp * ef.pctMax) / 100 : this.effStat(actor, 'mag') * ef.mult * (1 + actor.healBonus);
            this.addShield(actor, r, amt, ef.turns);
          }
          break;
        case 'cleanse': for (const r of rec) this.cleanse(r, ef.n); break;
        case 'dispel': for (const r of rec) this.dispel(r, ef.n); break;
        case 'gauge': for (const r of rec) { if (!r.alive) continue; r.gauge = clamp(r.gauge + ef.amount, 0, 1400); this.emit({ t: 'gauge', target: r.uid, amount: ef.amount }); } break;
        case 'cdReduce': for (const r of rec) for (const s of r.skills) s.cdLeft = Math.max(0, s.cdLeft - ef.n); break;
        case 'selfDamagePct': {
          const amt = Math.min(actor.hp - 1, Math.round((actor.maxHp * ef.pct) / 100));
          if (amt > 0) this.applyRaw(actor, actor, amt, 'true');
          break;
        }
        case 'lifesteal': if (dealt > 0) this.healUnit(actor, actor, (dealt * ef.pct) / 100); break;
        case 'summon': this.summon(actor, ef.enemy, ef.count); break;
        case 'pushBack': for (const r of rec) this.setRow(r, 'back'); break;
        case 'pullFront': for (const r of rec) this.setRow(r, 'front'); break;
        case 'revive': for (const r of this.units.filter((x) => x.side === actor.side && !x.alive).slice(0, 1)) this.revive(r, ef.pct); break;
        case 'execute': break; // handled in strike
        default: break;
      }
    }
    void passive; void def;
  }

  private ccResist(t: BUnit, id: StatusId): number {
    if (t.side === 'hero') return 1;
    const hard = HARD_CC.includes(id);
    const soft = SOFT_CC.includes(id);
    if (!hard && !soft) return 1;
    if (id === 'stun' && t.stun_immune > 0) return 0;
    if (t.tier === 'boss') return hard ? 0.35 : 0.6;
    if (t.tier === 'elite') return hard ? 0.5 : 0.8;
    if (t.tier === 'mini') return hard ? 0.65 : 0.9;
    return 1;
  }

  private setRow(u: BUnit, row: Row): void {
    if (!u.alive || u.row === row) return;
    u.row = row;
    this.emit({ t: 'row', target: u.uid, row });
  }

  private summon(actor: BUnit, enemyId: string, count: number): void {
    const add = this.setup.spawn;
    if (!add) return;
    for (let i = 0; i < count; i++) {
      const foes = this.enemies().filter((e) => e.alive);
      if (foes.length >= 5) return;
      const inp = add(enemyId, new Set(foes.map((e) => e.slot)));
      if (inp) this.spawnUnit(inp);
    }
    void actor;
  }

  private revive(u: BUnit, pct: number): void {
    u.alive = true;
    u.hp = Math.max(1, Math.round((u.maxHp * pct) / 100));
    u.statuses = [];
    u.gauge = 400;
    this.emit({ t: 'heal', actor: u.uid, target: u.uid, amount: u.hp, hp: u.hp });
  }

  // ------------------------------------------------------------------ damage
  private strike(actor: BUnit, target: BUnit, def: SkillDef, hitMult: number, nTargets: number): { hit: boolean; dealt: number } {
    if (!target.alive || this.has(target, 'submerged')) return { hit: false, dealt: 0 };
    // hit check
    const isTrue = !!def.true;
    if (!isTrue) {
      const chance = clamp(this.effStat(actor, 'acc') - this.effStat(target, 'eva'), 15, 100) / 100;
      if (!this.rng.chance(chance)) {
        this.emit({ t: 'miss', actor: actor.uid, target: target.uid });
        return { hit: false, dealt: 0 };
      }
    }
    const scale = def.scale ?? 'atk';
    const magic = scale === 'mag' || def.range === 'magic';
    let raw = this.effStat(actor, scale) * hitMult;
    if (def.bonusVsTag && target.tags.includes(def.bonusVsTag.tag)) raw *= def.bonusVsTag.mult;
    const mk = this.has(target, 'mark');
    if (def.bonusVsMarked && mk) raw *= 1 + def.bonusVsMarked;
    for (const ef of def.effects ?? []) {
      if (ef.k === 'execute' && target.hp / target.maxHp < ef.below) raw *= 1 + ef.bonus;
    }
    let mitigation = 1;
    if (!isTrue) {
      const d = this.effStat(target, magic ? 'res' : 'def') * (1 - (def.pierce ?? 0));
      mitigation = 100 / (100 + Math.max(0, d));
    }
    // bounded additive modifiers
    let mod = 0;
    if (mk) mod += (mk.power || 25) / 100;
    const guard = this.has(target, 'guard');
    if (guard) mod -= (guard.power || 30) / 100;
    if (this.setup.challenge.includes('glass')) mod += 0.4;
    if (target.side === 'hero' && this.setup.shadow === 4 && actor.turns === 1) mod += 0.15;
    mod = clamp(mod, -0.6, 2.0);
    // crit
    const critChance = clamp(this.effStat(actor, 'crit') + (def.critBonus ?? 0) + actor.firstStrike, 0, 75);
    const crit = this.rng.chance(critChance / 100);
    if (actor.firstStrike > 0) actor.firstStrike = 0;
    let dmg = raw * mitigation * (1 + mod) * this.rng.range(0.95, 1.05);
    if (crit) dmg *= this.effStat(actor, 'critDmg') / 100;
    dmg = Math.max(1, Math.round(dmg));
    const kind: HitKind = isTrue ? 'true' : magic ? 'magic' : 'phys';
    const dealt = this.applyRaw(target, actor, dmg, kind, undefined, crit, def);
    // reflect / thorns
    if (target.alive || dealt > 0) {
      const th = this.has(target, 'thorns');
      if ((th || target.thorns > 0) && def.range === 'melee' && actor.alive && actor !== target) {
        const frac = (th ? (th.power || 20) / 100 : 0) + target.thorns;
        const back = Math.max(1, Math.round(dealt * frac));
        this.applyRaw(actor, target, back, 'reflect');
      }
    }
    if (actor.lifesteal > 0 && dealt > 0 && actor.alive) this.healUnit(actor, actor, dealt * actor.lifesteal);
    if (crit) {
      if (actor.side === 'hero') this.crits++;
      for (const p of actor.passives) if (p.kind === 'onCrit') { actor.gauge = Math.min(1400, actor.gauge + p.gauge); }
      this.comboCrit(actor);
    }
    void nTargets;
    return { hit: true, dealt };
  }

  /** deliver `amount` damage to `target`, absorbing into wards. Returns hp actually removed. */
  private applyRaw(target: BUnit, source: BUnit, amount: number, kind: HitKind, statusId?: StatusId, crit = false, def?: SkillDef): number {
    if (!target.alive) return 0;
    let absorbed = 0;
    let left = amount;
    const ward = this.has(target, 'ward');
    if (ward && ward.amount > 0 && kind !== 'dot') {
      absorbed = Math.min(ward.amount, left);
      ward.amount -= absorbed;
      left -= absorbed;
      if (ward.amount <= 0) this.removeStatus(target, 'ward');
    }
    // "Last gasp": no single blow fells a hero who is above half health — no unavoidable one-shots
    if (target.side === 'hero' && (kind === 'phys' || kind === 'magic' || kind === 'true') && target.hp >= target.maxHp * 0.5 && left >= target.hp) left = target.hp - 1;
    const dealt = Math.min(target.hp, left);
    target.hp -= dealt;
    target.taken += dealt;
    source.dealt += dealt;
    this.emit({ t: 'hit', actor: source.uid, target: target.uid, amount: dealt, absorbed, crit, kind, hp: target.hp, fx: statusId ?? def?.fx, skill: def?.id });
    if (target.hp <= 0) {
      this.kill(target, source);
    } else {
      this.checkPhases(target);
      this.comboDamaged(target);
    }
    return dealt;
  }

  private kill(target: BUnit, killer: BUnit): void {
    target.alive = false;
    target.hp = 0;
    target.statuses = [];
    this.emit({ t: 'death', target: target.uid });
    if (target.side === 'hero') this.deaths++;
    else this.killed.push({ id: target.id, tier: target.tier, tags: target.tags });
    if (killer !== target && killer.alive && killer.side !== target.side) {
      killer.kills++;
      for (const p of killer.passives) if (p.kind === 'onKill') this.applyEffects(killer, p.effects, [killer], 0, true);
      this.comboKill(killer);
    }
    for (const a of this.allies(target)) {
      for (const p of a.passives) if (p.kind === 'allyFalls') this.applyEffects(a, p.effects, [a], 0, true);
    }
  }

  private checkPhases(u: BUnit): void {
    const phases: BossPhase[] | undefined = u.enemy?.phases;
    if (!phases || !u.alive) return;
    while (u.phase < phases.length && u.hp / u.maxHp < phases[u.phase].hpBelow) {
      const ph = phases[u.phase];
      u.phase++;
      this.emit({ t: 'phase', actor: u.uid, announce: ph.announce });
      if (ph.statPct) {
        for (const [k, v] of Object.entries(ph.statPct)) {
          if (k === 'hp') continue;
          u.stats[k as StatKey] *= 1 + (v as number) / 100;
        }
      }
      for (const ref of ph.addSkills ?? []) u.skills.push(this.enemySkill(ref));
      this.applyEffects(u, ph.effects, [u], 0, true);
    }
  }

  // ------------------------------------------------------------------ healing / statuses
  private healUnit(source: BUnit, target: BUnit, amount: number): number {
    if (!target.alive) return 0;
    let a = amount;
    if (this.setup.challenge.includes('noHealing') && target.side === 'hero') a = 0;
    if (this.has(target, 'poison')) a *= 0.7;
    if (this.has(target, 'curse')) a *= 0.5;
    if (this.setup.shadow === 6 && target.side === 'hero') a *= 0.75;
    const heal = Math.max(0, Math.min(target.maxHp - target.hp, Math.round(a)));
    if (heal <= 0) return 0;
    target.hp += heal;
    source.healed += heal;
    if (target.side === 'hero') this.healingDone += heal;
    this.emit({ t: 'heal', actor: source.uid, target: target.uid, amount: heal, hp: target.hp });
    return heal;
  }

  private addShield(source: BUnit, target: BUnit, amount: number, turns: number): void {
    if (!target.alive || amount <= 0) return;
    const cur = this.has(target, 'ward');
    const amt = Math.round(amount);
    if (cur) {
      cur.amount = Math.max(cur.amount, amt);
      cur.turns = Math.max(cur.turns, turns);
      cur.fresh = target.uid === this.actorUid;
    } else {
      target.statuses.push({ id: 'ward', turns, power: 0, stacks: 1, amount: amt, src: source.uid, fresh: target.uid === this.actorUid });
      this.emit({ t: 'status', target: target.uid, id: 'ward', on: true, turns, power: amt });
    }
    this.emit({ t: 'shield', actor: source.uid, target: target.uid, amount: amt });
  }

  addStatus(source: BUnit, target: BUnit, id: StatusId, turns: number, power = 0, stacks = 1, silent = false, amountOverride?: number): void {
    if (!target.alive) return;
    if (id === 'stun') target.stun_immune = Math.max(target.stun_immune, 3);
    let amount = amountOverride ?? 0;
    if (amountOverride === undefined) {
      if (id === 'poison' || id === 'bleed') amount = Math.max(this.effStat(source, 'atk'), this.effStat(source, 'mag')) * (power || 30) / 100;
      else if (id === 'burn') amount = Math.max(this.effStat(source, 'mag'), this.effStat(source, 'atk') * 0.8) * (power || 40) / 100;
      else if (id === 'regen') amount = this.effStat(source, 'mag') * (power || 45) / 100 * (1 + source.healBonus);
    }
    const existing = this.has(target, id);
    const fresh = target.uid === this.actorUid;
    if (existing) {
      existing.turns = Math.max(existing.turns, turns);
      existing.power = Math.max(existing.power, power);
      existing.amount = Math.max(existing.amount, amount);
      existing.fresh = fresh;
      if (id === 'poison' || id === 'enrage') existing.stacks = Math.min(id === 'enrage' ? 20 : 4, existing.stacks + stacks);
    } else {
      target.statuses.push({ id, turns, power, stacks, amount, src: source.uid, fresh });
    }
    if (!silent && !existing) this.emit({ t: 'status', target: target.uid, id, on: true, turns, power });
  }

  private removeStatus(u: BUnit, id: StatusId): void {
    const i = u.statuses.findIndex((s) => s.id === id);
    if (i < 0) return;
    u.statuses.splice(i, 1);
    this.emit({ t: 'status', target: u.uid, id, on: false });
  }

  private cleanse(u: BUnit, n: number): void {
    let left = n;
    // worst first: damage over time, hard CC, then the rest
    const order: StatusId[] = ['poison', 'burn', 'bleed', 'curse', 'fear', 'stun', 'sealed', 'shatter', 'vulnerable', 'weaken', 'blind', 'slow', 'mark'];
    for (const id of order) {
      if (left <= 0) break;
      const s = this.has(u, id);
      if (s && STATUSES[id].cleansable) { this.removeStatus(u, id); left--; }
    }
  }

  private dispel(u: BUnit, n: number): void {
    let left = n;
    for (const s of u.statuses.slice()) {
      if (left <= 0) break;
      if (STATUSES[s.id].kind === 'buff' && STATUSES[s.id].cleansable) { this.removeStatus(u, s.id); left--; }
    }
  }

  hasHarmful(u: BUnit): boolean {
    return u.statuses.some((s) => STATUSES[s.id].kind === 'debuff' && STATUSES[s.id].cleansable && s.id !== 'mark');
  }

  // ------------------------------------------------------------------ combos
  private partner(c: ComboState, u: BUnit): BUnit | null {
    if (u === c.a) return c.b.alive ? c.b : null;
    if (u === c.b) return c.a.alive ? c.a : null;
    return null;
  }
  private comboReady(c: ComboState): boolean { return this.round >= c.cdLeft; }
  private comboFire(c: ComboState, cdRounds: number): void { c.cdLeft = this.round + cdRounds; c.used++; this.combosFired++; this.emit({ t: 'combo', name: c.inp.name, actors: [c.a.uid, c.b.uid] }); }

  private afterAttack(actor: BUnit, def: SkillDef, hitTargets: BUnit[], killedAny: boolean): void {
    void killedAny;
    if (!hitTargets.length || def.tags.includes('basic') === false && def.tags.includes('ultimate')) { /* ultimates still follow up */ }
    for (const c of this.combos) {
      if (c.inp.kind !== 'focusFire') continue;
      const p = this.partner(c, actor);
      const t = hitTargets.find((x) => x.alive);
      if (!p || !t || !this.comboReady(c)) continue;
      this.comboFire(c, 2);
      const follow: SkillDef = { id: 'combo-follow', name: c.inp.name, icon: 'sword', desc: '', cd: 0, target: 'enemy', range: 'ranged', scale: p.stats.mag > p.stats.atk * 1.5 ? 'mag' : 'atk', hits: [0.7 * c.inp.power], tags: ['damage'], fx: 'arrow', bypass: true };
      this.emit({ t: 'skill', actor: p.uid, skill: 'combo-follow', name: c.inp.name, targets: [t.uid], fx: 'arrow' });
      this.strike(p, t, follow, 0.7 * c.inp.power, 1);
    }
  }

  private comboCrit(actor: BUnit): void {
    for (const c of this.combos) {
      if (c.inp.kind !== 'competitive') continue;
      const p = this.partner(c, actor);
      if (!p || !this.comboReady(c)) continue;
      this.comboFire(c, 2);
      this.addStatus(actor, p, 'rally', 2, Math.round(18 * c.inp.power));
    }
  }
  private comboKill(actor: BUnit): void {
    for (const c of this.combos) {
      if (c.inp.kind !== 'competitive') continue;
      const p = this.partner(c, actor);
      if (!p || !this.comboReady(c)) continue;
      this.comboFire(c, 2);
      this.addStatus(actor, p, 'rally', 2, Math.round(18 * c.inp.power));
      p.gauge = Math.min(1400, p.gauge + 200 * c.inp.power);
    }
  }
  private comboDamaged(target: BUnit): void {
    if (target.side !== 'hero') return;
    for (const c of this.combos) {
      if (c.inp.kind !== 'rescue' && c.inp.kind !== 'cover') continue;
      if (target !== c.a && target !== c.b) continue;
      const p = this.partner(c, target);
      if (!p || !this.comboReady(c)) continue;
      if (c.inp.kind === 'rescue' && target.hp / target.maxHp < 0.35) {
        this.comboFire(c, 4);
        this.healUnit(p, target, (target.maxHp * 0.25 * c.inp.power) * (1 + p.healBonus * 0.5));
        this.cleanse(target, 1);
      } else if (c.inp.kind === 'cover' && target.hp / target.maxHp < 0.5) {
        this.comboFire(c, 4);
        this.addStatus(p, target, 'guard', 2, Math.round(30 * c.inp.power));
        this.addStatus(p, p, 'taunt', 1, 0);
      }
    }
  }
  private comboWard(c: ComboState): void {
    if (!c.a.alive || !c.b.alive) return;
    this.emit({ t: 'combo', name: c.inp.name, actors: [c.a.uid, c.b.uid] });
    const strength = Math.max(this.effStat(c.a, 'mag'), this.effStat(c.b, 'mag'));
    this.addShield(c.a, c.a, strength * 0.9 * c.inp.power, 3);
    this.addShield(c.b, c.b, strength * 0.9 * c.inp.power, 3);
  }
  private comboRally(c: ComboState): void {
    this.emit({ t: 'combo', name: c.inp.name, actors: [c.a.uid, c.b.uid] });
    for (const u of [c.a, c.b]) { this.addStatus(u, u, 'haste', 3, Math.round(15 * c.inp.power)); this.addStatus(u, u, 'rally', 3, Math.round(12 * c.inp.power)); }
  }
  private comboMend(c: ComboState): void {
    this.emit({ t: 'combo', name: c.inp.name, actors: [c.a.uid, c.b.uid] });
    for (const u of [c.a, c.b]) this.healUnit(u, u, u.maxHp * 0.07 * c.inp.power);
  }
  private comboSparks(c: ComboState): void {
    const foes = this.foes(c.a).filter((x) => !this.has(x, 'submerged'));
    if (!foes.length) return;
    this.emit({ t: 'combo', name: c.inp.name, actors: [c.a.uid, c.b.uid] });
    const power = Math.max(this.effStat(c.a, 'atk'), this.effStat(c.a, 'mag'), this.effStat(c.b, 'atk'), this.effStat(c.b, 'mag')) * 0.55 * c.inp.power;
    for (const f of foes) {
      const d = Math.max(1, Math.round(power * (100 / (100 + f.stats.res))));
      this.applyRaw(f, c.a, d, 'magic', undefined, false);
    }
  }

  // ------------------------------------------------------------------ end of fight
  private checkEnd(): void {
    if (this.over) return;
    if (!this.heroes().some((u) => u.alive)) { this.finish('defeat'); return; }
    if (!this.enemies().some((u) => u.alive)) {
      if (this.waveIdx + 1 < this.setup.waves.length) {
        this.waveIdx++;
        const wave = this.setup.waves[this.waveIdx];
        const fresh = wave.map((inp) => this.makeUnit(inp));
        for (const u of fresh) { u.gauge = u.stats.spd * 2 + this.rng.range(0, 120); this.units.push(u); }
        this.units = this.units.filter((u) => u.alive || u.side === 'hero');
        this.emit({ t: 'wave', enemies: fresh.map((u) => this.view(u)), n: this.waveIdx + 1 });
        for (const u of fresh) {
          for (const p of u.passives) if (p.kind === 'battleStart') this.applyEffects(u, p.effects, [u], 1, true);
        }
        return;
      }
      this.finish('victory');
    }
  }

  private finish(result: 'victory' | 'defeat'): void {
    if (this.over) return;
    this.over = true;
    this.result = result;
    this.emit({ t: 'end', result, rounds: this.round });
  }

  summary(): BattleResult {
    return {
      result: this.result ?? 'defeat',
      rounds: this.round,
      heroes: this.heroes().map((u) => ({
        uid: u.uid, id: u.id, heroId: u.heroId, hpFrac: u.alive ? u.hp / u.maxHp : 0, alive: u.alive,
        dealt: u.dealt, healed: u.healed, taken: u.taken, kills: u.kills,
      })),
      killedEnemies: this.killed,
      totalEnemies: this.totalEnemies,
      deaths: this.deaths,
      usedHealing: this.healingDone,
      crits: this.crits,
      actions: this.actions,
      combosFired: this.combosFired,
    };
  }
}

export const HAZARD_NAMES: Record<string, string> = {
  furnace: 'Furnace Blast', drums: 'War Drums', mist: 'Poison Mist', shadowDrain: 'Creeping Shadow', collapse: 'Cave-in',
  emberRain: 'Ember Rain', tide: 'Rising Tide', crumble: 'Crumbling Bridge', ambush: 'Ambush!',
};

export type { PassiveEffect, ComboKind };
