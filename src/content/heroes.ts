import type {
  HeroDef, HeroId, PassiveDef, PassiveEffect, Rule, SkillDef, SkillEffect, StatKey, TalentDef, TalentEffect,
} from './schema.ts';

// ------------------------------------------------------------------ helpers
const st = (stat: StatKey, pct: number): TalentEffect => ({ kind: 'stat', stat, pct });
const flat = (stat: StatKey, value: number): TalentEffect => ({ kind: 'statFlat', stat, value });
const mult = (skill: string, pct: number): TalentEffect => ({ kind: 'skillMult', skill, pct });
const cd = (skill: string, delta: number): TalentEffect => ({ kind: 'skillCd', skill, delta });
const fx = (skill: string, effect: SkillEffect): TalentEffect => ({ kind: 'skillEffect', skill, effect });
const pas = (effect: PassiveEffect): TalentEffect => ({ kind: 'passive', effect });
const T = (name: string, desc: string, cost: number, requires: number[], ...effects: TalentEffect[]): TalentDef =>
  ({ id: '', name, desc, cost, requires, effects });
const ids = (hero: string, list: TalentDef[]): TalentDef[] => list.map((t, i) => ({ ...t, id: `${hero}-t${i}` }));

const R = (id: Rule['id'], enabled = true, param?: number): Rule => ({ id, enabled, param });

// ------------------------------------------------------------------ skills
export const HERO_SKILLS: Record<string, SkillDef> = {
  // Aragorn
  'aragorn-basic': { id: 'aragorn-basic', name: 'Ranger’s Blade', icon: 'sword', desc: 'A measured strike.', cd: 0, target: 'enemy', range: 'melee', scale: 'atk', hits: [1.0], tags: ['basic', 'damage'], fx: 'slash' },
  'aragorn-mark': { id: 'aragorn-mark', name: 'Mark Prey', icon: 'crosshair', desc: 'Pick out the foe that matters. Everyone strikes harder at a marked target.', cd: 3, target: 'enemy', range: 'ranged', scale: 'atk', hits: [0.9], tags: ['mark', 'damage', 'debuff'], effects: [{ k: 'status', id: 'mark', turns: 4, power: 25 }], fx: 'pierce' },
  'aragorn-rally': { id: 'aragorn-rally', name: 'Rally', icon: 'banner', desc: 'A voice that steadies the line.', cd: 4, startCd: 1, target: 'allAllies', range: 'support', tags: ['buff'], effects: [{ k: 'status', id: 'rally', turns: 3, power: 20 }, { k: 'healPct', pct: 8 }], fx: 'rally' },
  'aragorn-laststand': { id: 'aragorn-laststand', name: 'Last Stand', icon: 'bulwark', desc: 'Plant a boot and refuse to fall. Draws every blow.', cd: 6, startCd: 3, target: 'self', range: 'support', tags: ['guard', 'taunt', 'ultimate'], effects: [{ k: 'status', id: 'guard', turns: 3, power: 50 }, { k: 'status', id: 'taunt', turns: 3 }, { k: 'healPct', pct: 20 }, { k: 'gauge', amount: 300 }], fx: 'shield' },
  // Gimli
  'gimli-basic': { id: 'gimli-basic', name: 'Axe Swing', icon: 'axe', desc: 'A short, hard chop.', cd: 0, target: 'enemy', range: 'melee', scale: 'atk', hits: [1.05], tags: ['basic', 'damage'], fx: 'slash' },
  'gimli-cleave': { id: 'gimli-cleave', name: 'Cleave', icon: 'axe', desc: 'One swing, two foes.', cd: 2, target: 'twoEnemies', range: 'melee', scale: 'atk', hits: [1.15], tags: ['damage', 'aoe'], fx: 'cleave' },
  'gimli-stoneguard': { id: 'gimli-stoneguard', name: 'Stoneguard', icon: 'bulwark', desc: 'Stand like the mountain and dare them.', cd: 4, target: 'self', range: 'support', tags: ['guard', 'taunt'], effects: [{ k: 'status', id: 'guard', turns: 2, power: 45 }, { k: 'status', id: 'taunt', turns: 2 }], fx: 'shield' },
  'gimli-axestorm': { id: 'gimli-axestorm', name: 'Axe Storm', icon: 'whirl', desc: 'A whirlwind that cares nothing for rank or row.', cd: 5, startCd: 2, target: 'allEnemies', range: 'melee', scale: 'atk', hits: [0.95, 0.95], bypass: true, tags: ['damage', 'aoe', 'ultimate'], fx: 'smash' },
  // Frodo
  'frodo-basic': { id: 'frodo-basic', name: 'Quick Jab', icon: 'dagger', desc: 'A small blade finds a gap in the armour.', cd: 0, target: 'enemy', range: 'melee', scale: 'atk', hits: [0.9], tags: ['basic', 'damage'], effects: [{ k: 'status', id: 'vulnerable', turns: 2, chance: 0.3 }], fx: 'pierce' },
  'frodo-evade': { id: 'frodo-evade', name: 'Evade', icon: 'feather', desc: 'Be somewhere else when the blow lands.', cd: 3, target: 'self', range: 'support', tags: ['buff', 'guard'], effects: [{ k: 'status', id: 'evasive', turns: 2, power: 45 }, { k: 'gauge', amount: 150 }], fx: 'buff' },
  'frodo-hiddenpath': { id: 'frodo-hiddenpath', name: 'Hidden Path', icon: 'path', desc: 'Lead the company through shadow. Everyone starts moving sooner and is harder to hit.', cd: 5, startCd: 1, target: 'allAllies', range: 'support', tags: ['buff'], effects: [{ k: 'status', id: 'evasive', turns: 2, power: 25 }, { k: 'gauge', amount: 300 }], fx: 'buff' },
  'frodo-resolve': { id: 'frodo-resolve', name: 'Resolve', icon: 'heart-flame', desc: 'Quiet courage, lent to a friend.', cd: 4, target: 'lowestAlly', range: 'support', scale: 'mag', tags: ['cleanse', 'buff'], effects: [{ k: 'cleanse', n: 2 }, { k: 'shield', mult: 1.0, turns: 3 }], fx: 'shield' },
  // Legolas
  'legolas-basic': { id: 'legolas-basic', name: 'Bowshot', icon: 'bow', desc: 'A clean, quick arrow.', cd: 0, target: 'enemy', range: 'ranged', scale: 'atk', hits: [1.0], tags: ['basic', 'damage'], fx: 'arrow' },
  'legolas-twinshot': { id: 'legolas-twinshot', name: 'Twin Shot', icon: 'bow2', desc: 'Two arrows in the time it takes to draw one.', cd: 2, target: 'twoEnemies', range: 'ranged', scale: 'atk', hits: [0.9], critBonus: 12, tags: ['damage', 'aoe'], fx: 'arrow' },
  'legolas-eagleeye': { id: 'legolas-eagleeye', name: 'Eagle Eye', icon: 'eye', desc: 'See the gap in everything.', cd: 4, target: 'self', range: 'support', tags: ['buff'], effects: [{ k: 'status', id: 'focus', turns: 3, power: 25 }, { k: 'gauge', amount: 200 }], fx: 'buff' },
  'legolas-rain': { id: 'legolas-rain', name: 'Rain of Arrows', icon: 'rain', desc: 'The sky falls on everyone below.', cd: 5, startCd: 2, target: 'allEnemies', range: 'ranged', scale: 'atk', hits: [0.6, 0.6, 0.6], tags: ['damage', 'aoe', 'ultimate'], fx: 'volley' },
  // Boromir
  'boromir-basic': { id: 'boromir-basic', name: 'Shield Bash', icon: 'shield', desc: 'Rim and boss first.', cd: 0, target: 'enemy', range: 'melee', scale: 'atk', hits: [0.95], tags: ['basic', 'damage'], fx: 'smash' },
  'boromir-shieldwall': { id: 'boromir-shieldwall', name: 'Shield Wall', icon: 'wall', desc: 'Lock shields. Nothing gets past the line.', cd: 4, startCd: 1, target: 'allAllies', range: 'support', tags: ['guard', 'taunt'], effects: [{ k: 'status', id: 'guard', turns: 2, power: 25 }, { k: 'status', id: 'taunt', turns: 2, on: 'self' }], fx: 'shield' },
  'boromir-horn': { id: 'boromir-horn', name: 'Horn Rally', icon: 'horn', desc: 'One long call that carries down the halls.', cd: 5, startCd: 2, target: 'allAllies', range: 'support', tags: ['buff'], effects: [{ k: 'status', id: 'haste', turns: 3, power: 20 }, { k: 'status', id: 'rally', turns: 3, power: 10 }, { k: 'gauge', amount: 250 }], fx: 'horn' },
  'boromir-sacrifice': { id: 'boromir-sacrifice', name: 'Sacrifice', icon: 'heart-sword', desc: 'Spend his own strength to bring a falling friend back from the brink.', cd: 6, startCd: 3, target: 'lowestAlly', range: 'support', tags: ['rescue', 'heal', 'ultimate'], effects: [{ k: 'selfDamagePct', pct: 20 }, { k: 'healPct', pct: 45 }, { k: 'cleanse', n: 1 }, { k: 'gauge', amount: 300 }], fx: 'heal' },
  // Sam
  'sam-basic': { id: 'sam-basic', name: 'Spade Swing', icon: 'spade', desc: 'A gardener’s honest swing.', cd: 0, target: 'enemy', range: 'melee', scale: 'atk', hits: [0.8], tags: ['basic', 'damage'], fx: 'smash' },
  'sam-steadfast': { id: 'sam-steadfast', name: 'Steadfast', icon: 'ward', desc: 'A warm shield and a steady heart.', cd: 3, target: 'ally', range: 'support', scale: 'mag', tags: ['buff', 'guard'], effects: [{ k: 'shield', mult: 1.2, turns: 3 }, { k: 'status', id: 'regen', turns: 3, power: 45 }], fx: 'shield' },
  'sam-provision': { id: 'sam-provision', name: 'Provision', icon: 'bread', desc: 'Hot food, clean bandages, and a kind word.', cd: 2, target: 'lowestAlly', range: 'support', scale: 'mag', tags: ['heal', 'cleanse'], effects: [{ k: 'heal', mult: 1.6 }, { k: 'cleanse', n: 1 }], fx: 'heal' },
  'sam-rescue': { id: 'sam-rescue', name: 'Loyal Rescue', icon: 'hand', desc: 'He will not leave anyone behind. Heals greatly, frees them of every affliction and gets them moving again.', cd: 5, startCd: 2, target: 'lowestAlly', range: 'support', scale: 'mag', tags: ['heal', 'cleanse', 'rescue', 'ultimate'], effects: [{ k: 'heal', mult: 2.8 }, { k: 'healPct', pct: 15 }, { k: 'cleanse', n: 9 }, { k: 'gauge', amount: 400 }], fx: 'heal' },
  // Gandalf
  'gandalf-basic': { id: 'gandalf-basic', name: 'Staff Bolt', icon: 'staff', desc: 'A crackle of white fire.', cd: 0, target: 'enemy', range: 'magic', scale: 'mag', hits: [1.0], tags: ['basic', 'damage'], fx: 'light' },
  'gandalf-light': { id: 'gandalf-light', name: 'Light', icon: 'sun', desc: 'A blaze that burns the dark away. Shadow-born creatures suffer terribly.', cd: 3, target: 'allEnemies', range: 'magic', scale: 'mag', hits: [0.6], bonusVsTag: { tag: 'shadow', mult: 1.8 }, tags: ['damage', 'aoe', 'control'], effects: [{ k: 'status', id: 'blind', turns: 2, chance: 0.6 }], fx: 'light' },
  'gandalf-flameward': { id: 'gandalf-flameward', name: 'Flame Ward', icon: 'ward-flame', desc: 'A ring of fire that shelters friends and scorches those who strike them.', cd: 4, target: 'allAllies', range: 'support', scale: 'mag', tags: ['buff', 'guard'], effects: [{ k: 'shield', mult: 0.9, turns: 3 }, { k: 'status', id: 'thorns', turns: 3, power: 25 }], fx: 'shield' },
  'gandalf-wrath': { id: 'gandalf-wrath', name: 'Wizard’s Wrath', icon: 'lightning', desc: 'Everything he has, in one word. Cracks armour and stuns.', cd: 6, startCd: 3, target: 'enemy', range: 'magic', scale: 'mag', hits: [3.2], pierce: 0.3, tags: ['damage', 'ultimate', 'control'], effects: [{ k: 'status', id: 'stun', turns: 1, chance: 0.7 }], fx: 'wave' },
};

// ------------------------------------------------------------------ passives
export const PASSIVES: Record<string, PassiveDef> = {
  'aragorn-passive': { id: 'aragorn-passive', name: 'Heir’s Vigil', desc: 'Below 40% health: +30% Defence and +20% Attack.', effects: [{ kind: 'lowHp', below: 0.4, stat: 'def', pct: 30 }, { kind: 'lowHp', below: 0.4, stat: 'atk', pct: 20 }] },
  'gimli-passive': { id: 'gimli-passive', name: 'Stout-Hearted', desc: '+10% Defence and +20% Resistance. Heals 4% max health on every kill.', effects: [{ kind: 'stat', stat: 'def', pct: 10 }, { kind: 'stat', stat: 'res', pct: 20 }, { kind: 'onKill', effects: [{ k: 'healPct', pct: 4, on: 'self' }] }] },
  'frodo-passive': { id: 'frodo-passive', name: 'Unnoticed', desc: 'Enemies are half as likely to pick Frodo. +50% Evasion.', effects: [{ kind: 'threat', mult: 0.5 }, { kind: 'stat', stat: 'eva', pct: 50 }] },
  'legolas-passive': { id: 'legolas-passive', name: 'Elven Grace', desc: 'Every critical hit refills 25% of the action gauge. +20% Evasion.', effects: [{ kind: 'onCrit', gauge: 250 }, { kind: 'stat', stat: 'eva', pct: 20 }] },
  'boromir-passive': { id: 'boromir-passive', name: 'Valor of the White City', desc: '+10% Defence. When an ally falls: +30% Attack for 4 turns.', effects: [{ kind: 'stat', stat: 'def', pct: 10 }, { kind: 'allyFalls', effects: [{ k: 'status', id: 'rally', turns: 4, power: 30, on: 'self' }] }] },
  'sam-passive': { id: 'sam-passive', name: 'Gardener’s Care', desc: 'After every battle the whole party recovers 12% max health. +15% Resistance.', effects: [{ kind: 'postBattleHeal', pct: 12 }, { kind: 'stat', stat: 'res', pct: 15 }] },
  'gandalf-passive': { id: 'gandalf-passive', name: 'Maiar Lore', desc: 'Skills start 2 turns closer to ready. +20% Resistance.', effects: [{ kind: 'startCdReduce', n: 2 }, { kind: 'stat', stat: 'res', pct: 20 }] },
};

// ------------------------------------------------------------------ talents (10 nodes each)
const TALENTS: Record<HeroId, TalentDef[]> = {
  aragorn: ids('aragorn', [
    T('Weathered Cloak', '+10% Health.', 1, [], st('hp', 10)),
    T('Keen Eyes', '+3 Critical chance.', 1, [], flat('crit', 3)),
    T('Practised Quarry', 'Mark Prey cooldown −1.', 2, [0], cd('aragorn-mark', -1)),
    T('Inspiring Presence', 'Rally also cleanses 1 affliction from each ally.', 2, [0], fx('aragorn-rally', { k: 'cleanse', n: 1 })),
    T('Unyielding', 'Last Stand cooldown −1.', 2, [1], cd('aragorn-laststand', -1)),
    T('Ranger’s Reach', '+10% Attack.', 2, [2], st('atk', 10)),
    T('Tireless Wayfarer', '+6 Speed.', 3, [3], flat('spd', 6)),
    T('Fortitude', 'Last Stand heals 10% more max health.', 3, [4], fx('aragorn-laststand', { k: 'healPct', pct: 10, on: 'self' })),
    T('Heir of Kings', 'Battle start: the whole party is Rallied (+15%) for 2 turns.', 3, [5, 6], pas({ kind: 'battleStart', effects: [{ k: 'status', id: 'rally', turns: 2, power: 15, on: 'allies' }] })),
    T('King Returned', '+12% Attack and +12% Defence.', 4, [7, 8], st('atk', 12), st('def', 12)),
  ]),
  gimli: ids('gimli', [
    T('Dwarven Mail', '+10% Defence.', 1, [], st('def', 10)),
    T('Mountain Constitution', '+12% Health.', 1, [], st('hp', 12)),
    T('Sharper Edge', 'Cleave deals 20% more damage.', 2, [0], mult('gimli-cleave', 20)),
    T('Deep Roots', 'Stoneguard cooldown −1.', 2, [0], cd('gimli-stoneguard', -1)),
    T('Whirling Fury', 'Axe Storm cooldown −1.', 2, [1], cd('gimli-axestorm', -1)),
    T('Battle Rhythm', '+10% Attack.', 2, [2], st('atk', 10)),
    T('Stubborn', '+15% Resistance.', 3, [3], st('res', 15)),
    T('Bloodied Axe', 'Axe Storm makes enemies Vulnerable for 2 turns.', 3, [4], fx('gimli-axestorm', { k: 'status', id: 'vulnerable', turns: 2 })),
    T('Counted Heads', 'Kills restore an extra 4% max health.', 3, [5, 6], pas({ kind: 'onKill', effects: [{ k: 'healPct', pct: 4, on: 'self' }] })),
    T('Deepmine Pride', '+15% Attack and +10% Health.', 4, [7, 8], st('atk', 15), st('hp', 10)),
  ]),
  frodo: ids('frodo', [
    T('Light Step', '+8 Evasion.', 1, [], flat('eva', 8)),
    T('Quiet Mind', '+15% Resistance.', 1, [], st('res', 15)),
    T('Second Wind', 'Evade cooldown −1.', 2, [0], cd('frodo-evade', -1)),
    T('Longer Shadows', 'Hidden Path grants Hidden to the whole party for 1 turn.', 2, [0], fx('frodo-hiddenpath', { k: 'status', id: 'hidden', turns: 1 })),
    T('Stronger Heart', 'Resolve shields 40% more.', 2, [1], mult('frodo-resolve', 40)),
    T('Sharp Little Blade', '+12% Attack.', 2, [2], st('atk', 12)),
    T('Quick Feet', '+8 Speed.', 3, [3], flat('spd', 8)),
    T('Gentle Touch', 'Resolve also heals 12% max health.', 3, [4], fx('frodo-resolve', { k: 'healPct', pct: 12 })),
    T('Burden Shared', 'Battle start: the lowest-health ally gains a shield.', 3, [5, 6], pas({ kind: 'battleStart', effects: [{ k: 'shield', mult: 1.0, turns: 3, on: 'lowestAlly' }] })),
    T('Small and Unbowed', '+15% Health, +10 Evasion.', 4, [7, 8], st('hp', 15), flat('eva', 10)),
  ]),
  legolas: ids('legolas', [
    T('Fletcher’s Care', '+10% Attack.', 1, [], st('atk', 10)),
    T('Sure Footing', '+8 Evasion.', 1, [], flat('eva', 8)),
    T('Swift Release', 'Twin Shot cooldown −1.', 2, [0], cd('legolas-twinshot', -1)),
    T('Hawk’s Patience', 'Eagle Eye grants an extra 10 Critical chance.', 2, [0], fx('legolas-eagleeye', { k: 'status', id: 'focus', turns: 3, power: 10 })),
    T('Wider Sky', 'Rain of Arrows deals 20% more damage.', 2, [1], mult('legolas-rain', 20)),
    T('Perfect Pitch', '+5 Critical chance.', 2, [2], flat('crit', 5)),
    T('Windborne', '+8 Speed.', 3, [3], flat('spd', 8)),
    T('Barbed Heads', 'Rain of Arrows causes Bleeding for 2 turns.', 3, [4], fx('legolas-rain', { k: 'status', id: 'bleed', turns: 2, power: 30 })),
    T('First Arrow', 'Your first attack each battle has +30 Critical chance.', 3, [5, 6], pas({ kind: 'firstStrike', critBonus: 30 })),
    T('Edge of the Wood', '+20 Critical damage, +10% Attack.', 4, [7, 8], flat('critDmg', 20), st('atk', 10)),
  ]),
  boromir: ids('boromir', [
    T('Gondorian Plate', '+10% Defence.', 1, [], st('def', 10)),
    T('Hale and Hearty', '+12% Health.', 1, [], st('hp', 12)),
    T('Longer Wall', 'Shield Wall guards for 3 turns.', 2, [0], fx('boromir-shieldwall', { k: 'status', id: 'guard', turns: 1, power: 25 })),
    T('Louder Horn', 'Horn Rally also Rallies +10% more.', 2, [0], fx('boromir-horn', { k: 'status', id: 'rally', turns: 3, power: 10 })),
    T('Faster Recovery', 'Sacrifice cooldown −1.', 2, [1], cd('boromir-sacrifice', -1)),
    T('Steady Blade', '+10% Attack.', 2, [2], st('atk', 10)),
    T('Unbowed', '+15% Resistance.', 3, [3], st('res', 15)),
    T('Hero’s Mercy', 'Sacrifice also grants the ally a shield.', 3, [4], fx('boromir-sacrifice', { k: 'shield', mult: 1.5, turns: 3 })),
    T('Captain’s Eye', 'Battle start: Boromir gains Guard 25% for 2 turns.', 3, [5, 6], pas({ kind: 'battleStart', effects: [{ k: 'status', id: 'guard', turns: 2, power: 25, on: 'self' }] })),
    T('Steward’s Son', '+15% Defence, +10% Health.', 4, [7, 8], st('def', 15), st('hp', 10)),
  ]),
  sam: ids('sam', [
    T('Warm Hands', '+10% Magic.', 1, [], st('mag', 10)),
    T('Sturdy Boots', '+12% Health.', 1, [], st('hp', 12)),
    T('Bigger Portions', 'Provision heals 20% more.', 2, [0], mult('sam-provision', 20)),
    T('Thicker Blanket', 'Steadfast shields 25% more.', 2, [0], mult('sam-steadfast', 25)),
    T('Never Leaves', 'Loyal Rescue cooldown −1.', 2, [1], cd('sam-rescue', -1)),
    T('Hearth Song', '+10% Magic.', 2, [2], st('mag', 10)),
    T('Quick Hands', '+6 Speed.', 3, [3], flat('spd', 6)),
    T('Second Helping', 'Provision cooldown −1.', 3, [4], cd('sam-provision', -1)),
    T('Hobbit Appetite', 'The whole party recovers an extra 8% max health after each battle.', 3, [5, 6], pas({ kind: 'postBattleHeal', pct: 8 })),
    T('Gardener’s Resolve', '+15% Magic, +15% Resistance.', 4, [7, 8], st('mag', 15), st('res', 15)),
  ]),
  gandalf: ids('gandalf', [
    T('Starlit Stave', '+10% Magic.', 1, [], st('mag', 10)),
    T('Grey Robes', '+12% Health.', 1, [], st('hp', 12)),
    T('Brighter Light', 'Light deals 25% more damage.', 2, [0], mult('gandalf-light', 25)),
    T('Hotter Fire', 'Flame Ward shields 25% more.', 2, [0], mult('gandalf-flameward', 25)),
    T('Rising Storm', 'Wizard’s Wrath cooldown −1.', 2, [1], cd('gandalf-wrath', -1)),
    T('Old Wisdom', '+10% Magic.', 2, [2], st('mag', 10)),
    T('Wanderer’s Pace', '+6 Speed.', 3, [3], flat('spd', 6)),
    T('Searing Word', 'Wizard’s Wrath also sets the target Burning.', 3, [4], fx('gandalf-wrath', { k: 'status', id: 'burn', turns: 3, power: 40 })),
    T('Guiding Hand', 'Battle start: the party is Warded for 3 turns.', 3, [5, 6], pas({ kind: 'battleStart', effects: [{ k: 'shield', mult: 0.7, turns: 3, on: 'allies' }] })),
    T('The White Wizard', '+20% Magic, +20 Critical damage.', 4, [7, 8], st('mag', 20), flat('critDmg', 20)),
  ]),
};

// ------------------------------------------------------------------ heroes
export const HEROES: Record<HeroId, HeroDef> = {
  aragorn: {
    id: 'aragorn', name: 'Aragorn', title: 'Ranger of the North', role: 'ranger',
    blurb: 'A tracker and a leader. Marks the foe that matters, rallies the line and refuses to fall.',
    base: { hp: 240, atk: 24, def: 26, mag: 10, res: 18, spd: 102, crit: 8, critDmg: 150, acc: 100, eva: 5 },
    basic: 'aragorn-basic', skills: ['aragorn-mark', 'aragorn-rally', 'aragorn-laststand'], passive: 'aragorn-passive',
    talents: TALENTS.aragorn, defaultRow: 'front',
    defaultRules: [R('guard-low', true, 40), R('focus-marked'), R('buff-opener'), R('use-ready'), R('basic')],
    weapon: ['sword', 'spear'],
    unlock: { chapter: 1, floorInChapter: 0, note: 'Leads the company from the start.' },
    palette: { skin: '#d9b08c', hair: '#3a2a1c', primary: '#2f4a3a', secondary: '#5a4632', accent: '#b8a46a', metal: '#aab2bd' },
    quotes: { start: 'Stay close. Watch the shadows.', crit: 'There!', low: 'Not yet… not yet!', win: 'On. We are not done.' },
  },
  gimli: {
    id: 'gimli', name: 'Gimli', title: 'Axe of the Lonely Mountain', role: 'bruiser',
    blurb: 'A stone-hard dwarf who cleaves through crowds and shrugs off what would fell a lesser warrior.',
    base: { hp: 280, atk: 26, def: 32, mag: 6, res: 14, spd: 92, crit: 6, critDmg: 150, acc: 100, eva: 0 },
    basic: 'gimli-basic', skills: ['gimli-cleave', 'gimli-stoneguard', 'gimli-axestorm'], passive: 'gimli-passive',
    talents: TALENTS.gimli, defaultRow: 'front',
    defaultRules: [R('guard-low', true, 45), R('aoe-3'), R('ultimate'), R('use-ready'), R('basic')],
    weapon: ['axe', 'mace'],
    unlock: { chapter: 1, floorInChapter: 5, note: 'Found in the ruined guardroom on floor 5.' },
    palette: { skin: '#c99571', hair: '#8a4a22', primary: '#6b3a2a', secondary: '#3c4650', accent: '#d8a64a', metal: '#9aa3ad' },
    quotes: { start: 'Let them come to the stone!', crit: 'Ha! Feel that!', low: 'I have had worse!', win: 'That is a hard day’s work.' },
  },
  frodo: {
    id: 'frodo', name: 'Frodo', title: 'Bearer of the Burden', role: 'scout',
    blurb: 'Small, quiet and hard to hit. Slips the company past danger and shelters friends with a courage nobody expects.',
    base: { hp: 170, atk: 16, def: 14, mag: 18, res: 28, spd: 112, crit: 6, critDmg: 150, acc: 105, eva: 15 },
    basic: 'frodo-basic', skills: ['frodo-evade', 'frodo-hiddenpath', 'frodo-resolve'], passive: 'frodo-passive',
    talents: TALENTS.frodo, defaultRow: 'back',
    defaultRules: [R('cleanse'), R('rescue', true, 30), R('buff-opener'), R('use-ready'), R('basic')],
    weapon: ['dagger', 'sword'],
    unlock: { chapter: 1, floorInChapter: 10, note: 'Rescued from the Gate Warden’s lieutenant on floor 10.' },
    palette: { skin: '#e0b793', hair: '#6a4a2a', primary: '#5d7a54', secondary: '#7a6a4a', accent: '#d6c27a', metal: '#b8c0c8' },
    quotes: { start: 'I will go on.', crit: 'Now!', low: 'I… I can still stand.', win: 'We made it. Another step.' },
  },
  legolas: {
    id: 'legolas', name: 'Legolas', title: 'Archer of the Wood', role: 'archer',
    blurb: 'A swift, sharp-eyed archer in the back row. Crits chain into extra turns; his volleys clear whole rooms.',
    base: { hp: 170, atk: 28, def: 14, mag: 12, res: 18, spd: 118, crit: 14, critDmg: 165, acc: 110, eva: 12 },
    basic: 'legolas-basic', skills: ['legolas-twinshot', 'legolas-eagleeye', 'legolas-rain'], passive: 'legolas-passive',
    talents: TALENTS.legolas, defaultRow: 'back',
    defaultRules: [R('aoe-3'), R('ultimate'), R('buff-opener'), R('use-ready'), R('basic')],
    weapon: ['bow', 'dagger'],
    unlock: { chapter: 2, floorInChapter: 10, note: 'Joins on floor 10 of the Echoing Galleries.' },
    palette: { skin: '#e8cfae', hair: '#e2cf8a', primary: '#3f6a4a', secondary: '#7a8a5a', accent: '#cfd9a0', metal: '#c9d0c0' },
    quotes: { start: 'The dark has eyes. So do I.', crit: 'Mark that one.', low: 'Too close…', win: 'The way is open.' },
  },
  boromir: {
    id: 'boromir', name: 'Boromir', title: 'Captain of the White Tower', role: 'protector',
    blurb: 'A proud shield-bearer. Locks the line, sounds the horn and trades his own strength to save a friend.',
    base: { hp: 300, atk: 22, def: 36, mag: 8, res: 18, spd: 90, crit: 5, critDmg: 150, acc: 100, eva: 0 },
    basic: 'boromir-basic', skills: ['boromir-shieldwall', 'boromir-horn', 'boromir-sacrifice'], passive: 'boromir-passive',
    talents: TALENTS.boromir, defaultRow: 'front',
    defaultRules: [R('rescue', true, 35), R('buff-opener'), R('guard-low', true, 40), R('use-ready'), R('basic')],
    weapon: ['sword', 'mace'],
    unlock: { chapter: 5, floorInChapter: 10, note: 'Answers the horn on floor 10 of the Great Halls.' },
    palette: { skin: '#d6a98a', hair: '#5a3a22', primary: '#6a1f2a', secondary: '#c9c2b0', accent: '#e0c070', metal: '#b9c0c8' },
    quotes: { start: 'Shields up. Hold.', crit: 'For the City!', low: 'I will not yield here!', win: 'Gondor stands.' },
  },
  sam: {
    id: 'sam', name: 'Sam', title: 'Gardener, Gaffer’s Son', role: 'healer',
    blurb: 'The dependable heart of the company. Heals, shields and rescues — nobody is left behind.',
    base: { hp: 220, atk: 14, def: 22, mag: 26, res: 26, spd: 98, crit: 4, critDmg: 150, acc: 100, eva: 6 },
    basic: 'sam-basic', skills: ['sam-steadfast', 'sam-provision', 'sam-rescue'], passive: 'sam-passive',
    talents: TALENTS.sam, defaultRow: 'back',
    defaultRules: [R('rescue', true, 30), R('heal-below', true, 55), R('cleanse'), R('buff-opener'), R('basic')],
    weapon: ['tool', 'mace', 'dagger'],
    unlock: { chapter: 6, floorInChapter: 10, note: 'Found tending a lantern in the Flooded Deeps, floor 10.' },
    palette: { skin: '#dfb28a', hair: '#7a4a28', primary: '#7a6a3c', secondary: '#4f6a3a', accent: '#e0b86a', metal: '#a0a8b0' },
    quotes: { start: 'Right behind you, Mr. Frodo.', crit: 'Take that!', low: 'Still on my feet!', win: 'Right. Who’s hungry?' },
  },
  gandalf: {
    id: 'gandalf', name: 'Gandalf', title: 'The Grey Pilgrim', role: 'mage',
    blurb: 'Wizard of light and flame. Wards the party, blinds the dark and lands one world-splitting blow.',
    base: { hp: 190, atk: 12, def: 16, mag: 32, res: 34, spd: 100, crit: 8, critDmg: 160, acc: 105, eva: 4 },
    basic: 'gandalf-basic', skills: ['gandalf-light', 'gandalf-flameward', 'gandalf-wrath'], passive: 'gandalf-passive',
    talents: TALENTS.gandalf, defaultRow: 'back',
    defaultRules: [R('buff-opener'), R('ultimate'), R('aoe-3'), R('use-ready'), R('basic')],
    weapon: ['staff', 'sword'],
    unlock: { chapter: 7, floorInChapter: 10, note: 'Waits among the Archives on floor 10 of the Shadow Archives.' },
    palette: { skin: '#e2c4a4', hair: '#d8d8dc', primary: '#7d8794', secondary: '#4a525c', accent: '#f0d890', metal: '#c8d0d8' },
    quotes: { start: 'Light for the dark, then.', crit: 'Be gone, shadows!', low: 'There is more power in me yet.', win: 'The road goes ever on.' },
  },
};

export const HERO_LIST: HeroDef[] = Object.values(HEROES);
