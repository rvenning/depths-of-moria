import type {
  ChallengeRule, EnemyDef, Hazard, HeroId, PassiveEffect, Row, Rule, SkillDef, Stats, StatusId, TargetPref, ComboKind,
} from '../../content/schema.ts';

export type Side = 'hero' | 'enemy';

/** Everything the engine needs to know about one combatant. Built outside the engine. */
export interface UnitInput {
  side: Side;
  id: string;                  // hero id or enemy id
  name: string;
  stats: Stats;                // final stats
  hpFrac: number;              // starting health fraction (heroes carry damage between floors)
  basic: SkillDef;
  skills: SkillDef[];
  passives: PassiveEffect[];
  rules?: Rule[];
  pref?: TargetPref;
  slot: number;                // 0..4
  row: Row;
  tags: string[];
  tier?: 'normal' | 'mini' | 'elite' | 'boss';
  enemy?: EnemyDef;
  healBonus?: number;          // fraction, relic
  lifesteal?: number;          // fraction of damage dealt
  thorns?: number;             // fraction of melee damage reflected
  heroId?: HeroId;
  level?: number;
  scale?: number;              // art scale
  startStatuses?: { id: StatusId; turns: number; power?: number }[];
}

export interface ComboInput {
  a: HeroId;
  b: HeroId;
  kind: ComboKind;
  name: string;
  power: number;               // 1 = standard strength
}

export interface BattleSetup {
  heroes: UnitInput[];
  waves: UnitInput[][];        // first wave is the opening encounter
  hazards: Hazard[];
  challenge: ChallengeRule[];
  combos: ComboInput[];
  /** build a freshly scaled enemy (for summons / ambushes) */
  spawn?: (enemyId: string, usedSlots: Set<number>) => UnitInput | null;
  enrageStart?: number;        // round enrage begins (default 25)
  maxRounds?: number;          // default 60
  floor: number;
  shadow?: number;             // Age shadow id (chapter number), 0 = none
  reducedEnemyAggression?: number;
}

export interface BStatus {
  id: StatusId;
  turns: number;
  power: number;
  stacks: number;
  amount: number;              // dot per tick / shield remaining / regen per tick
  src: number;
  fresh: boolean;
}

export interface BSkill { def: SkillDef; cdLeft: number; cdBase: number; weight: number; minPhase: number }

export interface BUnit {
  uid: number;
  side: Side;
  id: string;
  name: string;
  slot: number;
  row: Row;
  stats: Stats;
  hp: number;
  maxHp: number;
  gauge: number;
  alive: boolean;
  skills: BSkill[];
  basic: SkillDef;
  passives: PassiveEffect[];
  statuses: BStatus[];
  rules: Rule[];
  pref: TargetPref;
  tags: string[];
  tier: 'normal' | 'mini' | 'elite' | 'boss';
  enemy?: EnemyDef;
  heroId?: HeroId;
  healBonus: number;
  lifesteal: number;
  thorns: number;
  turns: number;
  phase: number;
  threat: number;
  firstStrike: number;         // pending crit bonus for first attack
  level: number;
  scale: number;
  stun_immune: number;         // turns of stun immunity left
  // per-battle stats for the summary
  dealt: number;
  healed: number;
  taken: number;
  kills: number;
}

export type HitKind = 'phys' | 'magic' | 'true' | 'dot' | 'reflect' | 'hazard';

export type BEvent =
  | { t: 'start'; heroes: UnitView[]; enemies: UnitView[] }
  | { t: 'wave'; enemies: UnitView[]; n: number }
  | { t: 'round'; n: number }
  | { t: 'turn'; actor: number; skip?: 'stun' | 'fear' }
  | { t: 'skill'; actor: number; skill: string; name: string; targets: number[]; fx: string; rule?: string }
  | { t: 'hit'; actor: number; target: number; amount: number; absorbed: number; crit: boolean; kind: HitKind; hp: number; fx?: string; skill?: string }
  | { t: 'miss'; actor: number; target: number }
  | { t: 'heal'; actor: number; target: number; amount: number; hp: number }
  | { t: 'shield'; actor: number; target: number; amount: number }
  | { t: 'status'; target: number; id: StatusId; on: boolean; turns?: number; power?: number }
  | { t: 'death'; target: number }
  | { t: 'summon'; unit: UnitView }
  | { t: 'gauge'; target: number; amount: number }
  | { t: 'row'; target: number; row: Row }
  | { t: 'phase'; actor: number; announce: string }
  | { t: 'hazard'; kind: string; name: string; warn?: boolean }
  | { t: 'combo'; name: string; actors: number[] }
  | { t: 'text'; msg: string; tone: 'info' | 'warn' | 'good' }
  | { t: 'end'; result: 'victory' | 'defeat'; rounds: number };

export interface UnitView {
  uid: number;
  side: Side;
  id: string;
  name: string;
  slot: number;
  row: Row;
  hp: number;
  maxHp: number;
  tier: 'normal' | 'mini' | 'elite' | 'boss';
  scale: number;
  heroId?: HeroId;
  family?: string;
  gauge: number;
  skills: { id: string; name: string; cdLeft: number; cd: number }[];
}

export interface BattleResult {
  result: 'victory' | 'defeat';
  rounds: number;
  heroes: { uid: number; id: string; heroId?: HeroId; hpFrac: number; alive: boolean; dealt: number; healed: number; taken: number; kills: number }[];
  killedEnemies: { id: string; tier: string; tags: string[] }[];
  totalEnemies: number;
  deaths: number;
  usedHealing: number;
  crits: number;
  actions: number;
  combosFired: number;
}
