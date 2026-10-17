import type { StatusDef, StatusId } from './schema.ts';

const S = (id: StatusId, name: string, kind: 'buff' | 'debuff', glyph: string, desc: string, cleansable = true): StatusDef =>
  ({ id, name, kind, glyph, desc, cleansable });

export const STATUSES: Record<StatusId, StatusDef> = {
  mark: S('mark', 'Marked', 'debuff', 'target', 'Takes extra damage from every source (+25% by default). Allies focus marked targets.'),
  poison: S('poison', 'Poisoned', 'debuff', 'drop', 'Loses health at the start of each of its turns. Healing received is reduced by 30%.'),
  burn: S('burn', 'Burning', 'debuff', 'flame', 'Takes heavy fire damage at the start of each of its turns.'),
  bleed: S('bleed', 'Bleeding', 'debuff', 'blood', 'Loses health at the start of each of its turns. Ignores armour.'),
  stun: S('stun', 'Stunned', 'debuff', 'bolt', 'Loses its next turn.'),
  slow: S('slow', 'Slowed', 'debuff', 'snail', 'Speed reduced by 30%.'),
  haste: S('haste', 'Hastened', 'buff', 'wing', 'Speed increased (20% by default).'),
  weaken: S('weaken', 'Weakened', 'debuff', 'broken-sword', 'Attack and Magic reduced by 25%.'),
  rally: S('rally', 'Rallied', 'buff', 'banner', 'Attack and Magic increased (20% by default).'),
  vulnerable: S('vulnerable', 'Vulnerable', 'debuff', 'cracked-shield', 'Defence and Resistance reduced by 25%.'),
  guard: S('guard', 'Guarded', 'buff', 'shield', 'Takes reduced damage from all sources (25–50%).'),
  ward: S('ward', 'Warded', 'buff', 'ward', 'A protective shield absorbs damage before health is lost.'),
  regen: S('regen', 'Regenerating', 'buff', 'leaf', 'Recovers health at the start of each of its turns.'),
  taunt: S('taunt', 'Taunting', 'buff', 'horn', 'Enemies must target this unit with single-target skills.'),
  hidden: S('hidden', 'Hidden', 'buff', 'eye-closed', 'Cannot be targeted by single-target skills while other units stand.'),
  evasive: S('evasive', 'Evasive', 'buff', 'feather', 'Evasion greatly increased.'),
  blind: S('blind', 'Blinded', 'debuff', 'eye-x', 'Accuracy reduced by 40.'),
  curse: S('curse', 'Cursed', 'debuff', 'skull', 'Healing received is reduced by 50%.'),
  fear: S('fear', 'Afraid', 'debuff', 'ghost', '40% chance to lose each turn.'),
  submerged: S('submerged', 'Submerged', 'buff', 'wave', 'Cannot be targeted or hit while submerged.', false),
  sealed: S('sealed', 'Sealed', 'debuff', 'seal', 'Cannot use skills; basic attacks only.'),
  thorns: S('thorns', 'Thorned', 'buff', 'thorn', 'Reflects part of melee damage taken back at the attacker.'),
  enrage: S('enrage', 'Enraged', 'buff', 'fury', 'Attack increased; stacks.', false),
  focus: S('focus', 'Focused', 'buff', 'crosshair', 'Critical chance and Accuracy increased.'),
  shatter: S('shatter', 'Shattered', 'debuff', 'shatter', 'Armour broken: Defence reduced by 50%.'),
};

export const DOT_STATUSES: StatusId[] = ['poison', 'burn', 'bleed'];
