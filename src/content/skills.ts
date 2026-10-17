import type { SkillDef, SkillEffect, SkillTarget } from './schema.ts';
import { HERO_SKILLS } from './heroes.ts';
import { ENEMY_SKILLS } from './enemySkills.ts';
import { STATUSES } from './statuses.ts';

const ALL: Record<string, SkillDef> = { ...HERO_SKILLS, ...ENEMY_SKILLS };

export function getSkill(id: string): SkillDef {
  const s = ALL[id];
  if (!s) throw new Error(`Unknown skill: ${id}`);
  return s;
}
export function hasSkill(id: string): boolean { return id in ALL; }
export const ALL_SKILL_IDS = Object.keys(ALL);

const TARGET_TEXT: Record<SkillTarget, string> = {
  enemy: 'one enemy', allEnemies: 'all enemies', frontEnemies: 'the front row', twoEnemies: 'two enemies',
  randomEnemies: 'random enemies', markedEnemy: 'the marked enemy', weakestEnemy: 'the weakest enemy',
  ally: 'one ally', lowestAlly: 'the most wounded ally', allAllies: 'the whole party', self: 'self',
  otherAllies: 'the other allies', allUnits: 'everyone',
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

function effectText(e: SkillEffect, scaleName: string): string | null {
  const who = (on?: string) => (on === 'self' ? 'self' : on === 'allies' ? 'the party' : on === 'enemies' ? 'all enemies' : on === 'lowestAlly' ? 'the weakest ally' : null);
  const suffix = (on?: string) => { const w = who(on); return w ? ` (${w})` : ''; };
  switch (e.k) {
    case 'status': {
      const s = STATUSES[e.id];
      const chance = e.chance !== undefined ? `${Math.round(e.chance * 100)}% chance: ` : '';
      const dur = e.id === 'stun' ? '' : ` for ${e.turns} turn${e.turns === 1 ? '' : 's'}`;
      const pw = e.power && !['stun', 'taunt', 'hidden', 'submerged', 'sealed', 'blind', 'fear', 'curse', 'weaken', 'vulnerable', 'shatter', 'slow'].includes(e.id) ? ` (${e.power}${['poison', 'burn', 'bleed', 'regen'].includes(e.id) ? '% power' : '%'})` : '';
      return `${chance}${s.kind === 'buff' ? 'Grants' : 'Inflicts'} ${s.name}${pw}${dur}${suffix(e.on)}`;
    }
    case 'heal': return `Heals ${pct(e.mult)} of ${scaleName === 'mag' ? 'Magic' : 'Magic'}${suffix(e.on)}`;
    case 'healPct': return `Heals ${e.pct}% of max health${suffix(e.on)}`;
    case 'shield': return e.pctMax ? `Shields ${e.pctMax}% of max health for ${e.turns} turns${suffix(e.on)}` : `Shield worth ${pct(e.mult)} of Magic for ${e.turns} turns${suffix(e.on)}`;
    case 'cleanse': return e.n >= 9 ? `Cleanses every affliction${suffix(e.on)}` : `Cleanses ${e.n} affliction${e.n === 1 ? '' : 's'}${suffix(e.on)}`;
    case 'dispel': return `Strips ${e.n} enemy buff${e.n === 1 ? '' : 's'}`;
    case 'gauge': return `${e.amount >= 0 ? '+' : ''}${Math.round(e.amount / 10)}% action gauge${suffix(e.on)}`;
    case 'cdReduce': return `Cooldowns −${e.n}${suffix(e.on)}`;
    case 'selfDamagePct': return `Costs ${e.pct}% of own max health`;
    case 'lifesteal': return `Heals self for ${e.pct}% of damage dealt`;
    case 'summon': return `Summons ${e.count} ally`;
    case 'pushBack': return 'Pushes the target to the back row';
    case 'pullFront': return 'Drags the target to the front row';
    case 'execute': return `+${Math.round(e.bonus * 100)}% damage below ${Math.round(e.below * 100)}% health`;
    case 'revive': return `Revives an ally at ${e.pct}% health`;
    default: return null;
  }
}

/** Auto-generated mechanical description, so tooltips can never drift from the numbers in the data. */
export function describeSkill(def: SkillDef): string[] {
  const lines: string[] = [];
  const scale = def.scale === 'mag' ? 'Magic' : 'Attack';
  if (def.hits?.length) {
    const hits = def.hits.map((h) => pct(h));
    const total = def.hits.reduce((a, b) => a + b, 0);
    const each = def.hits.length > 1 ? ` (${def.hits.length} hits${def.hits.every((h) => h === def.hits![0]) ? ` of ${hits[0]}` : `: ${hits.join(' + ')}`}, total ${pct(total)})` : '';
    lines.push(`Deals ${def.hits.length > 1 ? pct(total) : hits[0]} ${scale}${each} to ${TARGET_TEXT[def.target]}.`);
  } else {
    lines.push(`Targets ${TARGET_TEXT[def.target]}.`);
  }
  if (def.bonusVsTag) lines.push(`×${def.bonusVsTag.mult} damage to ${def.bonusVsTag.tag}-aligned foes.`);
  if (def.pierce) lines.push(`Ignores ${Math.round(def.pierce * 100)}% of the target’s defence.`);
  if (def.critBonus) lines.push(`+${def.critBonus} Critical chance.`);
  if (def.bypass) lines.push('Ignores the front-row rule.');
  if (def.range === 'ranged') lines.push('Ranged: can reach the back row.');
  if (def.range === 'magic') lines.push('Magic: reduced by Resistance; ignores the front-row rule.');
  for (const e of def.effects ?? []) {
    const t = effectText(e, def.scale ?? 'atk');
    if (t) lines.push(`${t}.`);
  }
  if (def.cd > 0 && def.cd < 90) lines.push(`Cooldown: ${def.cd} turn${def.cd === 1 ? '' : 's'}${def.startCd && def.startCd > 1 ? `, first usable on turn ${def.startCd}` : ''}.`);
  return lines;
}
