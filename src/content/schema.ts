/** Content schema. Pure types + tiny constants. No logic. */

export const HERO_IDS = ['aragorn', 'gimli', 'frodo', 'legolas', 'boromir', 'sam', 'gandalf'] as const;
export type HeroId = (typeof HERO_IDS)[number];

export type StatKey = 'hp' | 'atk' | 'def' | 'mag' | 'res' | 'spd' | 'crit' | 'critDmg' | 'acc' | 'eva';
export const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'mag', 'res', 'spd', 'crit', 'critDmg', 'acc', 'eva'];
export type Stats = Record<StatKey, number>;
export const STAT_LABEL: Record<StatKey, string> = {
  hp: 'Health', atk: 'Attack', def: 'Defence', mag: 'Magic', res: 'Resistance',
  spd: 'Speed', crit: 'Crit chance', critDmg: 'Crit damage', acc: 'Accuracy', eva: 'Evasion',
};
export const STAT_HINT: Record<StatKey, string> = {
  hp: 'How much damage a unit can take before falling.',
  atk: 'Scales physical skills. Damage is cut by the target’s Defence: 100 / (100 + Defence).',
  def: 'Reduces physical damage by 100 / (100 + Defence).',
  mag: 'Scales magical skills and all healing.',
  res: 'Reduces magical damage by 100 / (100 + Resistance).',
  spd: 'Fills the action gauge. Faster units act more often.',
  crit: 'Chance (%) for a hit to be critical. Capped at 75%.',
  critDmg: 'Damage (%) of a critical hit. Base 150%.',
  acc: 'Hit chance is Accuracy − the target’s Evasion (min 15%, max 100%).',
  eva: 'Subtracts from the attacker’s Accuracy.',
};

export type Row = 'front' | 'back';

// ---------------------------------------------------------------- statuses
export type StatusId =
  | 'mark' | 'poison' | 'burn' | 'bleed' | 'stun' | 'slow' | 'haste' | 'weaken' | 'rally'
  | 'vulnerable' | 'guard' | 'ward' | 'regen' | 'taunt' | 'hidden' | 'evasive' | 'blind' | 'curse'
  | 'fear' | 'submerged' | 'sealed' | 'thorns' | 'enrage' | 'focus' | 'shatter';

export interface StatusDef {
  id: StatusId;
  name: string;
  kind: 'buff' | 'debuff';
  glyph: string; // icon key understood by art/icons
  desc: string;
  cleansable: boolean;
}

// ---------------------------------------------------------------- skills
export type SkillTarget =
  | 'enemy' | 'allEnemies' | 'frontEnemies' | 'twoEnemies' | 'randomEnemies' | 'markedEnemy' | 'weakestEnemy'
  | 'ally' | 'lowestAlly' | 'allAllies' | 'self' | 'otherAllies' | 'allUnits';

export type SkillTag =
  | 'basic' | 'heal' | 'cleanse' | 'aoe' | 'mark' | 'buff' | 'debuff' | 'ultimate' | 'guard' | 'taunt'
  | 'rescue' | 'damage' | 'control' | 'summon';

export type EffectOn = 'target' | 'self' | 'allies' | 'enemies' | 'lowestAlly' | 'ally';

export type SkillEffect =
  | { k: 'status'; id: StatusId; turns: number; power?: number; chance?: number; on?: EffectOn; stacks?: number }
  | { k: 'heal'; mult: number; on?: EffectOn }             // mult × Magic
  | { k: 'healPct'; pct: number; on?: EffectOn }           // % of max HP
  | { k: 'shield'; mult: number; turns: number; on?: EffectOn; pctMax?: number } // mult × Magic (or pctMax % max HP)
  | { k: 'cleanse'; n: number; on?: EffectOn }
  | { k: 'dispel'; n: number }                              // strip buffs from enemies
  | { k: 'gauge'; amount: number; on?: EffectOn }           // +/- action gauge (1000 = full)
  | { k: 'cdReduce'; n: number; on?: EffectOn }
  | { k: 'selfDamagePct'; pct: number }
  | { k: 'lifesteal'; pct: number }
  | { k: 'summon'; enemy: string; count: number }
  | { k: 'pushBack' }                                       // front row target is shoved to the back row
  | { k: 'pullFront' }                                      // back row target is dragged to the front row
  | { k: 'execute'; below: number; bonus: number }          // +bonus × damage if target under `below` HP fraction
  | { k: 'revive'; pct: number; on?: EffectOn };

export type SkillFx =
  | 'slash' | 'cleave' | 'arrow' | 'volley' | 'fire' | 'light' | 'heal' | 'shield' | 'buff' | 'horn'
  | 'smash' | 'bite' | 'shadow' | 'poison' | 'water' | 'wave' | 'rally' | 'whip' | 'drum' | 'curse' | 'pierce' | 'slam';

export interface SkillDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cd: number;          // own-turns between uses (0 = every turn)
  startCd?: number;    // own-turns before first use
  target: SkillTarget;
  range: 'melee' | 'ranged' | 'magic' | 'support';
  scale?: 'atk' | 'mag';
  hits?: number[];     // multiplier per hit (omit for non-damaging)
  bonusVsMarked?: number;
  bonusVsTag?: { tag: string; mult: number };
  critBonus?: number;
  pierce?: number;     // fraction of defence ignored
  bypass?: boolean;    // ignore the front-row soak rule
  true?: boolean;      // true damage (ignores def)
  tags: SkillTag[];
  effects?: SkillEffect[];
  fx: SkillFx;
}

// ---------------------------------------------------------------- passives
export type PassiveEffect =
  | { kind: 'stat'; stat: StatKey; pct: number }
  | { kind: 'battleStart'; effects: SkillEffect[]; markHighest?: boolean }
  | { kind: 'onKill'; effects: SkillEffect[] }
  | { kind: 'onCrit'; gauge: number }
  | { kind: 'threat'; mult: number }
  | { kind: 'lowHp'; below: number; stat: StatKey; pct: number }
  | { kind: 'postBattleHeal'; pct: number }
  | { kind: 'allyFalls'; effects: SkillEffect[] }
  | { kind: 'critShield'; pct: number }
  | { kind: 'firstStrike'; critBonus: number }
  | { kind: 'startCdReduce'; n: number };

export interface PassiveDef {
  id: string;
  name: string;
  desc: string;
  effects: PassiveEffect[];
}

// ---------------------------------------------------------------- talents
export type TalentEffect =
  | { kind: 'stat'; stat: StatKey; pct: number }
  | { kind: 'statFlat'; stat: StatKey; value: number }
  | { kind: 'skillMult'; skill: string; pct: number }          // multiplies hit multipliers / heal mult
  | { kind: 'skillCd'; skill: string; delta: number }
  | { kind: 'skillEffect'; skill: string; effect: SkillEffect }
  | { kind: 'passive'; effect: PassiveEffect };

export interface TalentDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  requires: number[]; // indexes of nodes that must be owned
  effects: TalentEffect[];
}

// ---------------------------------------------------------------- AI rules
export type RuleId =
  | 'heal-below' | 'cleanse' | 'focus-marked' | 'aoe-3' | 'ultimate' | 'buff-opener'
  | 'guard-low' | 'rescue' | 'use-ready' | 'basic';
export interface Rule { id: RuleId; enabled: boolean; param?: number }
export type TargetPref = 'default' | 'lowest-hp' | 'highest-atk' | 'back-row' | 'marked-first';

export const RULE_INFO: Record<RuleId, { label: string; desc: string; param?: { min: number; max: number; step: number; unit: string; def: number } }> = {
  'heal-below': { label: 'Heal when an ally is below', desc: 'Use a healing skill on the weakest ally under the threshold.', param: { min: 15, max: 90, step: 5, unit: '% HP', def: 50 } },
  cleanse: { label: 'Cleanse debuffs', desc: 'Use a cleansing skill when an ally carries a harmful status.' },
  'focus-marked': { label: 'Focus the marked target', desc: 'Basic attacks and single-target skills go to the marked enemy first.' },
  'aoe-3': { label: 'Area skill on 3+ enemies', desc: 'Use an area-damage skill when at least three enemies stand.' },
  ultimate: { label: 'Use ultimate when ready', desc: 'Fire the long-cooldown ultimate as soon as it is ready.' },
  'buff-opener': { label: 'Open with party buffs', desc: 'Use buff and guard skills as soon as they are ready.' },
  'guard-low': { label: 'Guard when self is below', desc: 'Use a self-protection skill when this hero is hurt.', param: { min: 15, max: 80, step: 5, unit: '% HP', def: 45 } },
  rescue: { label: 'Rescue allies in danger', desc: 'Use a rescue skill when an ally is about to fall.', param: { min: 10, max: 50, step: 5, unit: '% HP', def: 30 } },
  'use-ready': { label: 'Use any ready skill', desc: 'Use the first ready damaging skill.' },
  basic: { label: 'Basic attack', desc: 'Otherwise, a basic attack.' },
};

// ---------------------------------------------------------------- heroes
export type HeroRole = 'ranger' | 'bruiser' | 'scout' | 'archer' | 'protector' | 'healer' | 'mage';

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  role: HeroRole;
  blurb: string;
  base: Stats;                 // level-1 stats
  basic: string;               // basic attack skill id
  skills: [string, string, string];
  passive: string;
  talents: TalentDef[];        // exactly 10
  defaultRow: Row;
  defaultRules: Rule[];
  weapon: WeaponKind[];        // weapon kinds this hero may equip
  unlock: { chapter: number; floorInChapter: number; note: string };
  palette: { skin: string; hair: string; primary: string; secondary: string; accent: string; metal: string };
  quotes: { start: string; crit: string; low: string; win: string };
}

export type WeaponKind = 'sword' | 'axe' | 'bow' | 'dagger' | 'staff' | 'mace' | 'spear' | 'tool';

// ---------------------------------------------------------------- items
export type ItemSlot = 'weapon' | 'armour' | 'offhand' | 'accessory1' | 'accessory2';
export type ItemSlotKind = 'weapon' | 'armour' | 'offhand' | 'accessory';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#b8b2a4', uncommon: '#6fcf6f', rare: '#58a6ff', epic: '#c780ff', legendary: '#ffb340',
};

export type AffixId =
  | 'vigor' | 'keen' | 'swift' | 'warding' | 'cruel' | 'precise' | 'elusive' | 'thorned'
  | 'vampiric' | 'gilded' | 'studious' | 'stalwart' | 'arcane' | 'mending' | 'fierce';

export interface AffixDef {
  id: AffixId;
  name: string;           // "of Vigor"
  desc: string;
  stat?: { stat: StatKey; pct?: number; flat?: number };
  special?: { kind: 'lifesteal' | 'thorns' | 'gold' | 'xp' | 'heal'; value: number };
}

export interface ItemTemplate {
  id: string;
  name: string;
  slot: ItemSlotKind;
  weapon?: WeaponKind;
  tier: number;                 // chapter 1..10 the item belongs to
  minRarity: Rarity;            // lowest rarity it drops at
  maxRarity: Rarity;
  stats: Partial<Record<StatKey, number>>; // weights, 1 = one "standard share" of that stat for the slot
  affixes?: AffixId[];          // pool (rare+ rolls one; legendary has `signature`)
  set?: string;
  signature?: { name: string; desc: string; effect: PassiveEffect };
  flavor: string;
  icon: string;                 // art key
  heroAffinity?: HeroId;        // curated hero-specific
  boss?: string;                // drops from this boss
}

export interface SetDef {
  id: string;
  name: string;
  tier: number;
  pieces: string[];             // template ids
  bonuses: { count: number; desc: string; stats?: Partial<Record<StatKey, number>>; effect?: PassiveEffect }[];
}

export interface ItemInstance {
  uid: string;
  tpl: string;
  ilvl: number;
  rarity: Rarity;
  plus: number;                 // forge upgrade level
  affix?: AffixId;
  locked?: boolean;
  isNew?: boolean;
  from?: number;                // floor it dropped on
}

// ---------------------------------------------------------------- relics
export type RelicId = 'light' | 'horn' | 'wisdom' | 'blessing' | 'fortune' | 'courage';
export interface RelicDef {
  id: RelicId;
  name: string;
  effectLabel: string;
  stat: 'hp' | 'atk' | 'mag' | 'heal' | 'gold' | 'def';
  perLevel: number;       // % per level up to softCap
  afterSoft: number;      // % per level beyond softCap
  softCap: number;
  maxLevel: number;
  costBase: number;
  costGrowth: number;
  desc: string;
  lore: string;
}

// ---------------------------------------------------------------- enemies
export type EnemyTier = 'normal' | 'mini' | 'elite' | 'boss';
export type CreatureFamily =
  | 'goblin' | 'archer' | 'bat' | 'orc' | 'warg' | 'troll' | 'wraith' | 'serpent' | 'guardian'
  | 'spider' | 'drake' | 'fiend' | 'wisp' | 'golem' | 'horror' | 'balrog' | 'warden' | 'shade';

export interface EnemySkillRef { skill: string; weight: number; cd?: number; startCd?: number; minPhase?: number }

export interface BossPhase {
  hpBelow: number; // fraction of max HP
  announce: string;
  effects: SkillEffect[];
  addSkills?: EnemySkillRef[];
  statPct?: Partial<Record<StatKey, number>>;
}

export interface EnemyDef {
  id: string;
  name: string;
  chapter: number;
  tier: EnemyTier;
  family: CreatureFamily;
  tags: string[];
  row: Row;
  hp: number; atk: number; def: number; mag: number; res: number; spd: number; // multipliers (def/res are absolute multipliers of ref)
  crit?: number; acc?: number; eva?: number;
  skills: EnemySkillRef[];
  phases?: BossPhase[];
  xp: number;      // multiplier
  gold: number;    // multiplier
  palette: { body: string; accent: string; eye: string; gear: string };
  scale?: number;
  features?: string[];
  codex: string;   // lore blurb
  weakness?: string;
}

export type HazardKind = 'furnace' | 'drums' | 'mist' | 'shadowDrain' | 'collapse' | 'emberRain' | 'tide' | 'crumble' | 'ambush';
export interface Hazard { kind: HazardKind; every: number; power: number }

export type ChallengeRule = 'noHealing' | 'darkness' | 'glass' | 'silence' | 'haste' | 'armoured' | 'swarm';

// ---------------------------------------------------------------- chapters
export interface ChapterDef {
  n: number;
  name: string;
  floors: [number, number];
  blurb: string;
  theme: string;                // background family key
  palette: { sky: string; far: string; mid: string; near: string; light: string; fog: string };
  normals: string[];            // enemy ids
  minis: string[];              // enemy ids (floor 10 / 30 / 60 / 80)
  elite: string;
  boss: string;
  hazard?: Hazard;
  unlocks: string[];            // feature keys
  unlockText: string;
  shadow: { name: string; desc: string };   // the Age's twist
  music: { root: number; mode: number[]; tempo: number; tone: string };
}

// ---------------------------------------------------------------- events
export type EventOutcome =
  | { k: 'gold'; amount: number }               // multiplied by floor scale
  | { k: 'essence'; amount: number }
  | { k: 'item'; rarity: Rarity }
  | { k: 'materials'; ore: number; cloth: number }
  | { k: 'healPct'; pct: number }
  | { k: 'damagePct'; pct: number }
  | { k: 'buff'; stat: StatKey; pct: number; battles: number }
  | { k: 'curse'; stat: StatKey; pct: number; battles: number }
  | { k: 'xp'; amount: number }
  | { k: 'lore'; id: string }
  | { k: 'fight'; elite: boolean }
  | { k: 'renown'; amount: number }
  | { k: 'supplies'; amount: number }
  | { k: 'affinity'; amount: number };

export interface EventChoice {
  label: string;
  hint?: string;
  requires?: { hero?: HeroId; gold?: number };
  outcomes: { chance: number; text: string; results: EventOutcome[] }[]; // chances sum to 1
}
export interface EventDef {
  id: string;
  title: string;
  art: string;
  text: string;
  chapters?: [number, number];
  choices: EventChoice[];
}

// ---------------------------------------------------------------- bonds
export interface BondScene { title: string; lines: { who: HeroId | 'narr'; text: string }[] }
export type ComboKind =
  | 'focusFire' | 'competitive' | 'rescue' | 'ward' | 'rally' | 'cover' | 'sparks' | 'mend';
export interface BondDef {
  id: string;                  // "aragorn+legolas" sorted by HERO_IDS order
  a: HeroId; b: HeroId;
  combo: { kind: ComboKind; name: string; desc: string; power: number };
  scenes: [BondScene, BondScene, BondScene];
}

// ---------------------------------------------------------------- quests / achievements / lore
export interface QuestDef {
  id: string;
  title: string;
  desc: string;
  metric: string;               // key in stats counters
  target: number;
  reward: { gold?: number; essence?: number; renown?: number; item?: Rarity; ore?: number; cloth?: number };
  chapter: number;              // available from chapter
  repeatable?: boolean;
}
export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  metric: string;
  target: number;
  renown: number;
  secret?: boolean;
}
export interface LoreDef { id: string; title: string; text: string; chapter: number; source: string }

// ---------------------------------------------------------------- camp upgrades
export interface CampUpgradeDef {
  id: string;
  name: string;
  desc: string;
  kind: 'age' | 'account';       // age = gold, resets each Age; account = renown, permanent
  maxLevel: number;
  baseCost: number;
  growth: number;
  perLevel: number;
  unit: string;
  unlockChapter?: number;
}
