import { CHAPTER_BY_N, chapterOf } from '../content/chapters.ts';
import { ENEMIES } from '../content/enemies.ts';
import type { ChallengeRule, ChapterDef, EnemyDef, Hazard, Stats } from '../content/schema.ts';
import { BAL, defUnit, levelMult, refLevel } from './balance.ts';
import { Rng, mixSeed } from './rng.ts';
import type { RoomKind } from './state.ts';
import type { UnitInput } from './battle/types.ts';
import { getSkill } from '../content/skills.ts';

export const MAX_CAMPAIGN_FLOOR = 1000;
export const inChapter = (floor: number): number => ((Math.min(floor, MAX_CAMPAIGN_FLOOR) - 1) % 100) + 1;
export const isCheckpointFloor = (floor: number): boolean => floor % BAL.checkpointEvery === 0;

export type FloorTag = 'normal' | 'gauntlet' | 'ambush' | 'vault' | 'mini' | 'elite' | 'boss' | 'challenge' | 'event' | 'door' | 'rest';

export interface SlotEnemy { id: string; slot: number }
export interface FloorPlan {
  floor: number;
  chapter: number;
  inChapter: number;
  endless: boolean;
  kind: RoomKind;
  tag: FloorTag;
  title: string;
  subtitle: string;
  waves: SlotEnemy[][];
  hazards: Hazard[];
  challenge: ChallengeRule[];
  doorChoices?: RoomKind[];
  goldMult: number;
  xpMult: number;
  essence: number;
  guaranteedRarity?: number;   // min rarity index of the guaranteed drop
  dropCount: number;
  bg: string;                  // background variant key
  bossId?: string;
  checkpoint: boolean;
}

const KIND_MULT: Record<FloorTag, { gold: number; xp: number; ess: number; drops: number }> = {
  normal: { gold: 1, xp: 1, ess: 0, drops: 1 }, gauntlet: { gold: 2, xp: 2, ess: 1, drops: 2 }, ambush: { gold: 1.4, xp: 1.4, ess: 0, drops: 1 },
  vault: { gold: 5, xp: 2, ess: 3, drops: 3 }, mini: { gold: 3, xp: 3, ess: 3, drops: 2 }, elite: { gold: 4, xp: 4, ess: 5, drops: 3 },
  boss: { gold: 8, xp: 8, ess: 14, drops: 4 }, challenge: { gold: 3, xp: 3, ess: 6, drops: 3 }, event: { gold: 0, xp: 0, ess: 0, drops: 0 },
  door: { gold: 0, xp: 0, ess: 0, drops: 0 }, rest: { gold: 0, xp: 0, ess: 0, drops: 0 },
};

const CHALLENGES: ChallengeRule[] = ['noHealing', 'darkness', 'glass', 'silence', 'haste', 'armoured'];
export const CHALLENGE_INFO: Record<ChallengeRule, { name: string; desc: string }> = {
  noHealing: { name: 'No Healing', desc: 'Healing does nothing in this battle. Win on damage, guard and shields.' },
  darkness: { name: 'Darkness', desc: 'Your Accuracy is reduced by 30.' },
  glass: { name: 'Glass', desc: 'All damage dealt, by either side, is increased by 40%.' },
  silence: { name: 'Silence', desc: 'Ultimate skills are sealed.' },
  haste: { name: 'Frenzy', desc: 'Enemies are 30% faster.' },
  armoured: { name: 'Armoured', desc: 'Enemies have 50% more Defence and Resistance.' },
  swarm: { name: 'Swarm', desc: 'More enemies than usual.' },
};

export function hazardsFor(ch: ChapterDef, floor: number, tag: FloorTag): Hazard[] {
  const out: Hazard[] = [];
  if (!ch.hazard) return out;
  const h = mixSeed('hz', floor) % 100;
  const always = ch.n >= 8 || ((tag === 'boss' || tag === 'elite' || tag === 'challenge') && ch.n >= 3);
  if (always || h < 55) out.push({ ...ch.hazard });
  if (ch.n === 10) out.push({ kind: 'emberRain', every: 6, power: 6 });
  if (tag === 'ambush') out.push({ kind: 'ambush', every: 3, power: 1 });
  return out;
}

function pickSlots(ids: string[]): SlotEnemy[] {
  // assign slots: front enemies fill 0..2, back enemies 3..4; overflow wraps to whichever row has room
  const front: string[] = []; const back: string[] = [];
  for (const id of ids) (ENEMIES[id].row === 'front' ? front : back).push(id);
  while (front.length > 3) back.push(front.pop() as string);
  while (back.length > 2) { if (front.length < 3) front.push(back.pop() as string); else back.pop(); }
  return [...front.map((id, i) => ({ id, slot: i })), ...back.map((id, i) => ({ id, slot: 3 + i }))];
}

function composeNormal(ch: ChapterDef, rng: Rng, count: number, ic: number): string[] {
  const pool = ch.normals;
  const ids: string[] = [];
  // early floors favour the first two enemy types; deeper floors use all four
  const depth = ic / 100;
  const usable = pool.slice(0, depth < 0.25 ? 2 : depth < 0.6 ? 3 : 4);
  const primary = rng.pick(usable);
  for (let i = 0; i < count; i++) ids.push(i === 0 ? primary : rng.chance(0.55) ? primary : rng.pick(usable));
  // ensure at least one back-row unit now and then so ranged heroes have something to do
  if (count >= 3 && !ids.some((i) => ENEMIES[i].row === 'back') && rng.chance(0.5)) {
    const back = pool.find((p) => ENEMIES[p].row === 'back');
    if (back) ids[ids.length - 1] = back;
  }
  return ids;
}

/** How many enemies appear, given progress and the size of the player's party. */
function enemyCount(rng: Rng, ic: number, partySize: number): number {
  if (partySize <= 1 && ic <= 6) return 1;
  const cap = Math.min(5, Math.max(2, partySize + (ic > 60 ? 1 : 0)));
  const lo = Math.max(1, Math.round(1 + (cap - 1) * (ic / 140)));
  return Math.min(cap, Math.max(1, lo + (rng.chance(0.4) ? 1 : 0)));
}

const BG_VARIANTS = ['hall', 'corridor', 'cavern', 'stair', 'vault', 'bridge', 'shrine', 'arena'];

export function planFloor(floor: number, seed: number, partySize = 3, force?: RoomKind): FloorPlan {
  const endless = floor > MAX_CAMPAIGN_FLOOR;
  const chN = endless ? 1 + (Math.floor((floor - 1001) / 25) % 10) : chapterOf(floor);
  const ch = CHAPTER_BY_N(chN);
  const ic = endless ? 1 + ((floor - 1001) % 100) : inChapter(floor);
  const rng = new Rng(mixSeed(seed, floor, 'plan'));
  let tag: FloorTag = 'normal';
  let kind: RoomKind = 'battle';
  let title = `Floor ${floor}`;
  let subtitle = ch.name;

  if (endless) {
    const k = (floor - 1000) % 25;
    if (k === 0) { tag = 'boss'; kind = 'boss'; } else if (k % 10 === 0) { tag = 'elite'; kind = 'elite'; } else if (k === 5 || k === 15) { tag = 'challenge'; kind = 'challenge'; } else if (k % 7 === 3) { tag = 'event'; kind = 'event'; } else { tag = 'normal'; }
  } else if (ic === 100) { tag = 'boss'; kind = 'boss'; }
  else if (ic === 75) { tag = 'challenge'; kind = 'challenge'; }
  else if (ic === 50) { tag = 'elite'; kind = 'elite'; }
  else if (ic === 25) { tag = 'event'; kind = 'event'; }
  else if (ic === 10 || ic === 30 || ic === 60 || ic === 80) { tag = 'mini'; kind = 'mini'; }
  else if (ic === 20) { tag = 'gauntlet'; }
  else if (ic === 40) { tag = 'ambush'; }
  else if (ic === 70) { tag = 'vault'; kind = 'vault'; }
  else if (ic === 90) { tag = 'elite'; kind = 'elite'; }
  else {
    const roll = rng.next();
    if (roll < 0.06) { tag = 'event'; kind = 'event'; }
    else if (roll < 0.15 && ic > 3) { tag = 'door'; kind = 'door'; }
    else if (roll < 0.19 && ic > 5) { tag = 'rest'; kind = 'rest'; }
  }

  if (force) {
    const m: Record<string, FloorTag> = { battle: 'normal', elite: 'elite', rest: 'rest', vault: 'vault', event: 'event', mini: 'mini', boss: 'boss', challenge: 'challenge' };
    tag = m[force] ?? 'normal'; kind = force;
  }
  const waves: SlotEnemy[][] = [];
  let challenge: ChallengeRule[] = [];
  let bossId: string | undefined;
  const normalCount = enemyCount(rng, ic, partySize);
  const escorts = (n: number) => composeNormal(ch, rng, n, ic);

  switch (tag) {
    case 'normal': case 'door': case 'rest':
      waves.push(pickSlots(composeNormal(ch, rng, normalCount, ic)));
      break;
    case 'gauntlet':
      title = `Gauntlet — Floor ${floor}`; subtitle = 'Two waves, no rest between';
      waves.push(pickSlots(escorts(Math.min(4, normalCount + 1))), pickSlots(escorts(Math.min(4, normalCount + 1))));
      break;
    case 'ambush':
      title = `Ambush — Floor ${floor}`; subtitle = 'They were waiting for you';
      waves.push(pickSlots(escorts(Math.min(4, normalCount))));
      break;
    case 'vault': {
      title = `Vault Guardians — Floor ${floor}`; subtitle = 'Treasure behind armoured guards';
      waves.push(pickSlots(escorts(Math.min(4, normalCount + 1))));
      challenge = ['armoured'];
      break;
    }
    case 'mini': {
      const which = endless ? rng.pick(ch.minis) : (ic === 10 || ic === 60 ? ch.minis[0] : ch.minis[1]);
      const e = ENEMIES[which];
      title = `${e.name} — Floor ${floor}`; subtitle = 'Mini-boss';
      const esc = (ic >= 60 || endless) ? escorts(Math.min(2, Math.max(1, partySize - 2))) : (ic === 30 ? escorts(1) : []);
      waves.push(pickSlots([which, ...esc]));
      break;
    }
    case 'elite': {
      const e = ENEMIES[ch.elite];
      title = `${e.name} — Floor ${floor}`; subtitle = 'Elite';
      waves.push(pickSlots([ch.elite, ...escorts(Math.min(3, Math.max(1, partySize - 2)))]));
      if (ic === 90) waves[0] = pickSlots([ch.elite, rng.pick(ch.minis), ...escorts(1)]);
      break;
    }
    case 'challenge': {
      challenge = [rng.pick(CHALLENGES)];
      title = `Trial — Floor ${floor}`; subtitle = `Challenge: ${CHALLENGE_INFO[challenge[0]].name}`;
      waves.push(pickSlots([rng.pick(ch.minis), ...escorts(Math.min(3, partySize))]));
      break;
    }
    case 'boss': {
      bossId = ch.boss;
      const e = ENEMIES[bossId];
      title = e.name; subtitle = `Chapter ${ch.n} boss — ${ch.name}`;
      waves.push(pickSlots([bossId]));
      break;
    }
    case 'event': title = 'A Strange Place'; subtitle = ch.name; break;
    default: break;
  }

  const km = KIND_MULT[tag];
  const dropCount = km.drops;
  const chapEss = 1 + 0.3 * (ch.n - 1);
  let essence = km.ess * chapEss;
  if (tag === 'normal' && ic % 5 === 0) essence = 1 * chapEss;
  if (endless && (tag === 'boss' || tag === 'elite')) essence *= 1 + (floor - 1000) / 120;
  return {
    floor, chapter: ch.n, inChapter: ic, endless, kind, tag, title, subtitle, waves,
    hazards: hazardsFor(ch, floor, tag), challenge,
    goldMult: km.gold, xpMult: km.xp, essence: Math.round(essence),
    guaranteedRarity: tag === 'boss' ? 2 : tag === 'challenge' || tag === 'elite' || tag === 'vault' ? 1 : undefined,
    dropCount, bg: tag === 'boss' ? 'arena' : tag === 'vault' ? 'vault' : tag === 'event' ? 'shrine' : BG_VARIANTS[mixSeed('bg', floor) % 5],
    bossId, checkpoint: isCheckpointFloor(floor),
    doorChoices: tag === 'door' ? doorOptions(rng) : undefined,
  };
}

function doorOptions(rng: Rng): RoomKind[] {
  const all: RoomKind[] = ['battle', 'elite', 'rest', 'vault', 'event'];
  const [a, b] = rng.shuffle(all);
  return a === b ? ['battle', 'rest'] : [a, b];
}

// ------------------------------------------------------------------ enemy stat scaling
export function difficulty(floor: number): number {
  if (floor > MAX_CAMPAIGN_FLOOR) {
    const d = floor - MAX_CAMPAIGN_FLOOR;
    return (1.1 + BAL.perChapter * 9) * (1 + BAL.endlessGrowth * d + 0.00001 * d * d);
  }
  const ic = inChapter(floor);
  const ch = chapterOf(floor);
  // the very first floors are a gentle tutorial ramp (0.45 → 0.95)
  const ease = floor <= 10 ? 0.4 + 0.055 * floor : 1;
  return (0.9 + BAL.withinChapter * (ic / 100)) * (1 + BAL.perChapter * (ch - 1)) * ease;
}

export function enemyStats(def: EnemyDef, floor: number): Stats {
  const u = levelMult(refLevel(floor));
  const d = defUnit(Math.min(floor, 1000) + Math.max(0, floor - 1000) * 0.5);
  const diff = difficulty(floor);
  const ai = Math.min(9, Math.max(0, chapterOf(Math.min(floor, 1000)) - 1));
  const boss = def.tier === 'boss' ? BAL.ageBoss[ai] : 1;
  const kHp = BAL.ageHp[ai] * BAL.enemyHp * Math.pow(boss, 0.35);
  const kAtk = BAL.ageAtk[ai] * BAL.enemyAtk * Math.pow(boss, 0.65);
  return {
    hp: BAL.refHp * u * def.hp * kHp * diff * (BAL.tierHp[def.tier] ?? 1),
    atk: BAL.refAtk * u * def.atk * kAtk * diff,
    mag: BAL.refAtk * u * def.mag * kAtk * diff,
    def: d * def.def * BAL.enemyDef * (0.9 + 0.2 * Math.min(1, diff / 1.1)),
    res: d * def.res * BAL.enemyDef * (0.9 + 0.2 * Math.min(1, diff / 1.1)),
    spd: def.spd,
    crit: def.crit ?? 5,
    critDmg: 150,
    acc: 100 + (def.acc ?? 0),
    eva: def.eva ?? 0,
  };
}

const FAMILY_BASIC: Record<string, string> = {
  archer: 'e-shoot', wraith: 'e-bolt', fiend: 'e-flame', wisp: 'e-bolt', drake: 'e-bite', warg: 'e-bite', bat: 'e-bite', spider: 'e-venom',
  serpent: 'e-venom', horror: 'e-swipe', troll: 'e-swipe', shade: 'e-claw', balrog: 'e-swipe',
};

export function enemyUnit(id: string, floor: number, slot: number, hpScale = 1): UnitInput {
  const def = ENEMIES[id];
  if (!def) throw new Error(`Unknown enemy ${id}`);
  const stats = enemyStats(def, floor);
  stats.hp *= hpScale;
  const basicRef = def.skills.find((s) => (s.cd ?? getSkill(s.skill).cd) === 0 && getSkill(s.skill).hits);
  const basicId = basicRef ? basicRef.skill : FAMILY_BASIC[def.family] ?? 'e-strike';
  return {
    side: 'enemy', id: def.id, name: def.name, stats, hpFrac: 1,
    basic: getSkill(basicId), skills: [], passives: [], slot,
    row: slot >= 3 ? 'back' : 'front',
    tags: def.tags, tier: def.tier, enemy: def, scale: def.scale ?? 1,
  };
}

/** choose a free slot for a newly arriving enemy, respecting its preferred row */
export function freeSlot(id: string, used: Set<number>): number | null {
  const back = ENEMIES[id]?.row === 'back';
  const order = back ? [3, 4, 0, 1, 2] : [0, 1, 2, 3, 4];
  for (const s of order) if (!used.has(s)) return s;
  return null;
}
