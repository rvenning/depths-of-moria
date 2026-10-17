import type { AffixDef, AffixId, ItemTemplate, ItemSlotKind, PassiveEffect, Rarity, SetDef, StatKey, WeaponKind } from './schema.ts';

// ------------------------------------------------------------------ affixes
export const AFFIXES: Record<AffixId, AffixDef> = {
  vigor: { id: 'vigor', name: 'of Vigor', desc: '+6% Health', stat: { stat: 'hp', pct: 6 } },
  keen: { id: 'keen', name: 'of Keenness', desc: '+4 Critical chance', stat: { stat: 'crit', flat: 4 } },
  swift: { id: 'swift', name: 'of Swiftness', desc: '+5 Speed', stat: { stat: 'spd', flat: 5 } },
  warding: { id: 'warding', name: 'of Warding', desc: '+8% Resistance', stat: { stat: 'res', pct: 8 } },
  cruel: { id: 'cruel', name: 'of Cruelty', desc: '+15 Critical damage', stat: { stat: 'critDmg', flat: 15 } },
  precise: { id: 'precise', name: 'of Precision', desc: '+10 Accuracy', stat: { stat: 'acc', flat: 10 } },
  elusive: { id: 'elusive', name: 'of Elusion', desc: '+8 Evasion', stat: { stat: 'eva', flat: 8 } },
  thorned: { id: 'thorned', name: 'of Thorns', desc: 'Reflects 10% of melee damage taken', special: { kind: 'thorns', value: 0.1 } },
  vampiric: { id: 'vampiric', name: 'of the Leech', desc: 'Heal 5% of damage dealt', special: { kind: 'lifesteal', value: 0.05 } },
  gilded: { id: 'gilded', name: 'of Gilding', desc: '+8% gold found', special: { kind: 'gold', value: 0.08 } },
  studious: { id: 'studious', name: 'of Study', desc: '+8% experience', special: { kind: 'xp', value: 0.08 } },
  stalwart: { id: 'stalwart', name: 'of the Stalwart', desc: '+6% Defence', stat: { stat: 'def', pct: 6 } },
  arcane: { id: 'arcane', name: 'of the Arcane', desc: '+6% Magic', stat: { stat: 'mag', pct: 6 } },
  mending: { id: 'mending', name: 'of Mending', desc: '+8% healing power', special: { kind: 'heal', value: 0.08 } },
  fierce: { id: 'fierce', name: 'of Ferocity', desc: '+6% Attack', stat: { stat: 'atk', pct: 6 } },
};

// ------------------------------------------------------------------ rarity budget
export const RARITY_MULT: Record<Rarity, number> = { common: 0.6, uncommon: 0.8, rare: 1.0, epic: 1.25, legendary: 1.6 };
export const RARITY_NAME: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

// ------------------------------------------------------------------ builders
type W = Partial<Record<StatKey, number>>;
type Aff = AffixId[];
interface Opt { min?: Rarity; max?: Rarity; set?: string; sig?: ItemTemplate['signature']; boss?: string; hero?: ItemTemplate['heroAffinity'] }

const WEAPON_STATS: Record<WeaponKind, W> = {
  sword: { atk: 1.0, crit: 0.4 }, axe: { atk: 1.1, critDmg: 0.4 }, bow: { atk: 1.0, acc: 0.4 }, dagger: { atk: 0.9, crit: 0.6 },
  staff: { mag: 1.1, res: 0.4 }, mace: { atk: 0.9, hp: 0.35 }, spear: { atk: 0.95, spd: 0.4 }, tool: { atk: 0.55, mag: 0.55, hp: 0.2 },
};

const list: ItemTemplate[] = [];
const push = (t: ItemTemplate) => { list.push(t); };

function weapon(id: string, name: string, kind: WeaponKind, tier: number, aff: Aff, flavor: string, o: Opt = {}): void {
  push({ id, name, slot: 'weapon', weapon: kind, tier, minRarity: o.min ?? 'common', maxRarity: o.max ?? 'epic', stats: WEAPON_STATS[kind], affixes: aff, set: o.set, signature: o.sig, flavor, icon: kind, boss: o.boss, heroAffinity: o.hero });
}
function armour(id: string, name: string, tier: number, stats: W, aff: Aff, flavor: string, o: Opt = {}): void {
  push({ id, name, slot: 'armour', tier, minRarity: o.min ?? 'common', maxRarity: o.max ?? 'epic', stats, affixes: aff, set: o.set, signature: o.sig, flavor, icon: 'armour', boss: o.boss });
}
function offhand(id: string, name: string, tier: number, stats: W, aff: Aff, flavor: string, icon: string, o: Opt = {}): void {
  push({ id, name, slot: 'offhand', tier, minRarity: o.min ?? 'common', maxRarity: o.max ?? 'epic', stats, affixes: aff, set: o.set, signature: o.sig, flavor, icon, boss: o.boss });
}
function acc(id: string, name: string, tier: number, stats: W, aff: Aff, flavor: string, icon: string, o: Opt = {}): void {
  push({ id, name, slot: 'accessory', tier, minRarity: o.min ?? 'common', maxRarity: o.max ?? 'epic', stats, affixes: aff, set: o.set, signature: o.sig, flavor, icon, boss: o.boss });
}
const LEG = { min: 'legendary' as Rarity, max: 'legendary' as Rarity };
const sig = (name: string, desc: string, effect: PassiveEffect) => ({ name, desc, effect });

const TANK: W = { hp: 0.9, def: 0.7 };
const WARD: W = { hp: 0.8, res: 0.8 };
const LIGHT: W = { hp: 0.7, def: 0.35, eva: 0.5 };

// ---- Tier 1 — The West-gate
weapon('gatewatch-blade', 'Gatewatch Blade', 'sword', 1, ['fierce', 'keen', 'vigor'], 'Issue sword of the old gate garrison. Plain, true and worn thin.', { set: 'gatewatch' });
armour('gatewatch-mail', 'Gatewatch Mail', 1, TANK, ['stalwart', 'vigor', 'warding'], 'Riveted rings, mended a hundred times.', { set: 'gatewatch' });
offhand('gatewatch-shield', 'Gatewatch Shield', 1, { def: 0.6, hp: 0.4 }, ['stalwart', 'vigor', 'thorned'], 'Painted white tree, scraped to the wood.', 'shield', { set: 'gatewatch' });
acc('gatewatch-badge', 'Gatewatch Badge', 1, { hp: 0.5, def: 0.3 }, ['vigor', 'stalwart'], 'Awarded for holding the line.', 'badge', { set: 'gatewatch' });
weapon('goblin-hacker', 'Goblin Hacker', 'axe', 1, ['fierce', 'cruel', 'vampiric'], 'A cleaver with a notched edge and a grudge.');
weapon('elm-shortbow', 'Elm Shortbow', 'bow', 1, ['precise', 'keen', 'swift'], 'Light, springy and good enough.');
weapon('notched-dagger', 'Notched Dagger', 'dagger', 1, ['keen', 'cruel', 'elusive'], 'Fits a sleeve; finds gaps.');
weapon('pilgrims-staff', 'Pilgrim’s Staff', 'staff', 1, ['arcane', 'warding', 'mending'], 'A walking-staff with a knot of old light at its head.');
armour('leather-jerkin', 'Leather Jerkin', 1, LIGHT, ['elusive', 'swift', 'vigor'], 'Boiled leather. Quiet, light, a little smelly.');
offhand('wooden-lantern', 'Wooden Lantern', 1, { mag: 0.4, res: 0.4, hp: 0.2 }, ['arcane', 'warding', 'mending'], 'A tin lamp that never quite goes out.', 'lantern');
acc('copper-ring', 'Copper Ring', 1, { atk: 0.4, hp: 0.3 }, ['fierce', 'vigor', 'keen'], 'A plain band. Warm when danger is near.', 'ring');
acc('lucky-coin', 'Lucky Coin', 1, { crit: 0.5, acc: 0.3 }, ['gilded', 'keen', 'precise'], 'Heads you win; tails, you get another go.', 'coin');
weapon('wardens-gatebreaker', 'Warden’s Gatebreaker', 'sword', 1, [], 'Forged to hold a gate shut, and so, to break one.', { ...LEG, boss: 'gate-warden', sig: sig('Gatebreaker', 'Heals the wielder for 5% max health on every kill.', { kind: 'onKill', effects: [{ k: 'healPct', pct: 5, on: 'self' }] }) });

// ---- Tier 2 — Echoing Galleries
weapon('echohunter-sabre', 'Echohunter Sabre', 'sword', 2, ['keen', 'swift', 'fierce'], 'Curved for fast cuts in cramped halls.', { set: 'echohunter' });
armour('echohunter-cloak', 'Echohunter Cloak', 2, LIGHT, ['elusive', 'swift', 'vigor'], 'Sound-damping wool. You will not be heard.', { set: 'echohunter' });
offhand('echohunter-quiver', 'Echohunter Quiver', 2, { acc: 0.5, crit: 0.4 }, ['precise', 'keen', 'cruel'], 'Every arrow fletched with bat-wing.', 'quiver', { set: 'echohunter' });
acc('echohunter-charm', 'Echohunter Charm', 2, { spd: 0.5, eva: 0.3 }, ['swift', 'elusive'], 'A little bell with the clapper removed.', 'charm', { set: 'echohunter' });
weapon('gallery-pick', 'Gallery Pick', 'axe', 2, ['fierce', 'cruel', 'stalwart'], 'A tunnelling pick, repurposed.');
weapon('gallery-longbow', 'Gallery Longbow', 'bow', 2, ['precise', 'keen', 'fierce'], 'Strung for long galleries and longer shots.');
weapon('bat-tooth-dagger', 'Bat-tooth Dagger', 'dagger', 2, ['keen', 'vampiric', 'cruel'], 'Carved from a bat’s fang the size of a hand.');
weapon('whisper-staff', 'Whisper Staff', 'staff', 2, ['arcane', 'mending', 'swift'], 'Mutters when you aren’t listening.');
armour('padded-gambeson', 'Padded Gambeson', 2, TANK, ['vigor', 'stalwart', 'thorned'], 'Quilted, thick and old.');
offhand('tuning-fork', 'Tuning Fork', 2, { mag: 0.4, spd: 0.4 }, ['arcane', 'swift', 'mending'], 'Struck once, rings forever.', 'fork');
acc('bone-whistle', 'Bone Whistle', 2, { atk: 0.4, spd: 0.3 }, ['swift', 'fierce', 'keen'], 'A call the bats dislike.', 'whistle');
acc('silent-ring', 'Silent Ring', 2, { eva: 0.5, res: 0.3 }, ['elusive', 'warding'], 'Muffles whatever it touches.', 'ring');
weapon('captains-longbow', 'Captain’s Longbow', 'bow', 2, [], 'Taken from the Goblin Captain’s own armoury. Strung with sinew.', { ...LEG, boss: 'goblin-captain', sig: sig('Captain’s Call', 'Each critical hit refills 15% of the wielder’s action gauge.', { kind: 'onCrit', gauge: 150 }) });

// ---- Tier 3 — Abandoned Forges
weapon('forgeborn-brand', 'Forgeborn Brand', 'sword', 3, ['fierce', 'keen', 'cruel'], 'Quenched in an old forge’s last coals.', { set: 'forgeborn' });
armour('forgeborn-plate', 'Forgeborn Plate', 3, TANK, ['stalwart', 'vigor', 'thorned'], 'Heavy as a debt, warm as a hearth.', { set: 'forgeborn' });
offhand('forgeborn-buckler', 'Forgeborn Buckler', 3, { def: 0.6, hp: 0.4 }, ['stalwart', 'vigor', 'thorned'], 'Battered on an anvil till it sang.', 'shield', { set: 'forgeborn' });
acc('forgeborn-signet', 'Forgeborn Signet', 3, { atk: 0.4, def: 0.3 }, ['fierce', 'stalwart'], 'The seal of a long-closed guild.', 'ring', { set: 'forgeborn' });
weapon('slagbreaker', 'Slagbreaker', 'axe', 3, ['fierce', 'cruel', 'vampiric'], 'Breaks slag and, with a little push, orcs.');
weapon('furnace-bow', 'Furnace Bow', 'bow', 3, ['precise', 'fierce', 'keen'], 'Horn limbs bound in iron wire.');
weapon('smiths-stiletto', 'Smith’s Stiletto', 'dagger', 3, ['keen', 'cruel', 'elusive'], 'Thin and polished to a mirror.');
weapon('emberwood-staff', 'Emberwood Staff', 'staff', 3, ['arcane', 'mending', 'warding'], 'Carved from a tree that burned and lived.');
armour('asbestos-coat', 'Asbestos Coat', 3, WARD, ['warding', 'vigor', 'mending'], 'Smoky grey, wonderfully fireproof.');
offhand('ledger-of-fires', 'Ledger of Fires', 3, { mag: 0.5, res: 0.3 }, ['arcane', 'warding', 'mending'], 'Who stoked which fire, and when.', 'tome');
acc('cinder-pendant', 'Cinder Pendant', 3, { mag: 0.4, hp: 0.3 }, ['arcane', 'vigor'], 'A coal that has not cooled.', 'pendant');
acc('hearth-charm', 'Hearth Charm', 3, { hp: 0.4, res: 0.4 }, ['vigor', 'warding', 'mending'], 'A reminder of warm kitchens.', 'charm');
acc('tyrants-heart-ember', 'Tyrant’s Heart-ember', 3, { hp: 0.7, atk: 0.5, def: 0.4 }, [], 'Still hot to the touch. The Tyrant’s last fire.', 'pendant', { ...LEG, boss: 'forge-tyrant', sig: sig('Heart-fire', 'At battle start, the wearer gains Thorns (25%) for 3 turns.', { kind: 'battleStart', effects: [{ k: 'status', id: 'thorns', turns: 3, power: 25, on: 'self' }] }) });

// ---- Tier 4 — The Endless Stair
weapon('stairwalker-edge', 'Stairwalker Edge', 'sword', 4, ['keen', 'swift', 'fierce'], 'Balanced for fighting on a slope.', { set: 'stairwalker' });
armour('stairwalker-coat', 'Stairwalker Coat', 4, LIGHT, ['swift', 'elusive', 'vigor'], 'Cut short so it will not catch on the rail.', { set: 'stairwalker' });
offhand('climbers-targe', 'Climber’s Targe', 4, { def: 0.5, spd: 0.3, hp: 0.3 }, ['stalwart', 'swift', 'vigor'], 'Light round shield, easy to sling.', 'shield', { set: 'stairwalker' });
acc('stairwalker-ring', 'Stairwalker Ring', 4, { spd: 0.5, crit: 0.4 }, ['swift', 'keen'], 'Always one step ahead.', 'ring', { set: 'stairwalker' });
weapon('landing-breaker', 'Landing-breaker', 'axe', 4, ['fierce', 'cruel', 'vampiric'], 'Heavy, with a reach for narrow landings.');
weapon('switchback-bow', 'Switchback Bow', 'bow', 4, ['precise', 'keen', 'swift'], 'Short-limbed for shooting round corners.');
weapon('ambushers-knife', 'Ambusher’s Knife', 'dagger', 4, ['keen', 'cruel', 'swift'], 'For the first cut, and sometimes the last.');
weapon('wayfarers-staff', 'Wayfarer’s Staff', 'staff', 4, ['arcane', 'swift', 'warding'], 'Marked with the steps of a hundred stairs.');
armour('chain-hauberk', 'Chain Hauberk', 4, TANK, ['stalwart', 'vigor', 'warding'], 'Close-linked and heavy.');
offhand('signal-lamp', 'Signal Lamp', 4, { mag: 0.4, spd: 0.4 }, ['arcane', 'swift', 'mending'], 'Flashes a code only you remember.', 'lantern');
acc('rope-charm', 'Rope Charm', 4, { hp: 0.4, def: 0.3 }, ['vigor', 'stalwart'], 'A little knot that has held.', 'charm');
acc('warg-tooth-necklace', 'Warg-tooth Necklace', 4, { atk: 0.4, crit: 0.4 }, ['fierce', 'keen', 'cruel'], 'A trophy and a warning.', 'pendant');
armour('sentinels-chainmail', 'Sentinel’s Chainmail', 4, { hp: 1.0, def: 0.9, res: 0.3 }, [], 'Shivered off the Sentinel’s own shoulders when it fell.', { ...LEG, boss: 'stair-sentinel', sig: sig('Unyielding Chain', 'Below 50% health, the wearer gains +25% Defence.', { kind: 'lowHp', below: 0.5, stat: 'def', pct: 25 }) });

// ---- Tier 5 — The Great Halls
weapon('hallguard-blade', 'Hallguard Blade', 'sword', 5, ['fierce', 'keen', 'stalwart'], 'Pattern-welded and tall as a boy.', { set: 'hallguard' });
armour('hallguard-plate', 'Hallguard Plate', 5, TANK, ['stalwart', 'vigor', 'warding'], 'Carved with the hall’s own colonnade.', { set: 'hallguard' });
offhand('hallguard-aegis', 'Hallguard Aegis', 5, { def: 0.6, res: 0.4 }, ['stalwart', 'warding', 'thorned'], 'A tower-shield with a lion’s boss.', 'shield', { set: 'hallguard' });
acc('hallguard-torc', 'Hallguard Torc', 5, { hp: 0.5, def: 0.3 }, ['vigor', 'stalwart'], 'A heavy neck-ring of silver.', 'torc', { set: 'hallguard' });
weapon('pillar-splitter', 'Pillar-splitter', 'axe', 5, ['fierce', 'cruel', 'vampiric'], 'Splits pillars; incidentally, trolls.');
weapon('drumbeat-bow', 'Drumbeat Bow', 'bow', 5, ['precise', 'fierce', 'keen'], 'Twangs on the beat.');
weapon('troll-tooth-dagger', 'Troll-tooth Dagger', 'dagger', 5, ['keen', 'vampiric', 'cruel'], 'A single tooth as long as a forearm.');
weapon('echoing-staff', 'Echoing Staff', 'staff', 5, ['arcane', 'mending', 'swift'], 'Sounds when struck, and again when forgotten.');
armour('hide-vest', 'Hide Vest', 5, LIGHT, ['vigor', 'elusive', 'swift'], 'Stiff, thick and strongly scented.');
offhand('drumhead-shield', 'Drumhead Shield', 5, { def: 0.5, hp: 0.5 }, ['stalwart', 'vigor', 'thorned'], 'It rings when hit. That is the point.', 'shield');
acc('chieftains-tusk', 'Chieftain’s Tusk', 5, { atk: 0.5, hp: 0.3 }, ['fierce', 'vigor', 'cruel'], 'Snapped from a very large jaw.', 'pendant');
acc('stone-ring', 'Stone Ring', 5, { def: 0.4, res: 0.4 }, ['stalwart', 'warding'], 'Cold as the pillar it came from.', 'ring');
armour('chieftains-drumhide', 'Chieftain’s Drumhide', 5, { hp: 1.2, def: 0.7, res: 0.3 }, [], 'Cured hide, thick as a door; the drums still hum inside it.', { ...LEG, boss: 'cave-troll-chieftain', sig: sig('Drumbeat', 'When an ally falls, the wearer is Rallied (+30%) for 4 turns.', { kind: 'allyFalls', effects: [{ k: 'status', id: 'rally', turns: 4, power: 30, on: 'self' }] }) });

// ---- Tier 6 — The Flooded Deeps
weapon('deepdelver-cutlass', 'Deepdelver Cutlass', 'sword', 6, ['fierce', 'keen', 'vampiric'], 'Salt-proof and sea-bright.', { set: 'deepdelver' });
armour('deepdelver-slicker', 'Deepdelver Slicker', 6, WARD, ['warding', 'vigor', 'mending'], 'Oilcloth over scale; does not rot.', { set: 'deepdelver' });
offhand('deepdelver-ward', 'Deepdelver Ward', 6, { res: 0.6, hp: 0.4 }, ['warding', 'vigor', 'mending'], 'A disc of pearl-shell.', 'shield', { set: 'deepdelver' });
acc('deepdelver-pearl', 'Deepdelver Pearl', 6, { mag: 0.4, res: 0.3 }, ['arcane', 'warding'], 'Cold, smooth, faintly humming.', 'pendant', { set: 'deepdelver' });
weapon('eelbreaker-axe', 'Eelbreaker Axe', 'axe', 6, ['fierce', 'cruel', 'thorned'], 'Weighted with lead.');
weapon('reedbow', 'Reedbow', 'bow', 6, ['precise', 'keen', 'swift'], 'Supple, wet and fast.');
weapon('drowners-dirk', 'Drowner’s Dirk', 'dagger', 6, ['keen', 'cruel', 'elusive'], 'For ending a thing quietly under water.');
weapon('tidestaff', 'Tidestaff', 'staff', 6, ['arcane', 'mending', 'warding'], 'Pulls at the air like a current.');
armour('waxed-coat', 'Waxed Coat', 6, LIGHT, ['elusive', 'warding', 'vigor'], 'Beads water like a duck.');
offhand('glass-lantern', 'Glass Lantern', 6, { mag: 0.5, res: 0.3 }, ['arcane', 'warding', 'mending'], 'Burns green. Better than nothing.', 'lantern');
acc('algae-charm', 'Algae Charm', 6, { hp: 0.4, res: 0.4 }, ['vigor', 'warding', 'mending'], 'Slick but lucky.', 'charm');
acc('coral-ring', 'Coral Ring', 6, { crit: 0.4, eva: 0.3 }, ['keen', 'elusive'], 'Pink as a dawn that never reaches the deeps.', 'ring');
acc('horrors-pearl', 'Horror’s Pearl', 6, { hp: 0.6, res: 0.6, mag: 0.4 }, [], 'It looks back at you.', 'pendant', { ...LEG, boss: 'deepwater-horror', sig: sig('Tidal Ward', 'At battle start, every ally gains a shield worth 60% of the wearer’s Magic for 3 turns.', { kind: 'battleStart', effects: [{ k: 'shield', mult: 0.6, turns: 3, on: 'allies' }] }) });

// ---- Tier 7 — The Shadow Archives
weapon('archivist-blade', 'Archivist Blade', 'sword', 7, ['arcane', 'keen', 'fierce'], 'A letter-knife for very long letters.', { set: 'archivist' });
armour('archivist-robe', 'Archivist Robe', 7, WARD, ['arcane', 'warding', 'mending'], 'Ink-stained and thick as a tome.', { set: 'archivist' });
offhand('archivist-codex', 'Archivist Codex', 7, { mag: 0.6, res: 0.4 }, ['arcane', 'mending', 'warding'], 'Read the right page, win the fight.', 'tome', { set: 'archivist' });
acc('archivist-seal', 'Archivist Seal', 7, { mag: 0.5, res: 0.3 }, ['arcane', 'warding'], 'Stamps whatever it touches with weight.', 'ring', { set: 'archivist' });
weapon('bookbinders-cleaver', 'Bookbinder’s Cleaver', 'axe', 7, ['fierce', 'cruel', 'vampiric'], 'Trims spines. And other things.');
weapon('scribes-bow', 'Scribe’s Bow', 'bow', 7, ['precise', 'keen', 'swift'], 'Strung with catgut and sealed in wax.');
weapon('letter-opener', 'Letter-opener', 'dagger', 7, ['keen', 'cruel', 'elusive'], 'Slits a seal. Slits a throat.');
weapon('staff-of-annals', 'Staff of Annals', 'staff', 7, ['arcane', 'mending', 'swift'], 'Remembers every blow you have ever dealt.');
armour('vellum-coat', 'Vellum Coat', 7, LIGHT, ['elusive', 'warding', 'swift'], 'Light, strangely stiff, faintly lettered.');
offhand('reading-lens', 'Reading Lens', 7, { acc: 0.5, crit: 0.3 }, ['precise', 'keen', 'cruel'], 'Sees the small print on everything.', 'lens');
acc('ink-locket', 'Ink Locket', 7, { mag: 0.4, hp: 0.3 }, ['arcane', 'vigor'], 'Holds one very dark drop.', 'pendant');
acc('index-ring', 'Index Ring', 7, { crit: 0.4, acc: 0.3 }, ['keen', 'precise'], 'Finds the entry you need.', 'ring');
acc('keepers-quill', 'Keeper’s Quill', 7, { mag: 0.7, res: 0.5, spd: 0.3 }, [], 'Signs only the truest names.', 'quill', { ...LEG, boss: 'keeper-of-records', sig: sig('Index of Haste', 'The wearer’s skills start 2 turns closer to ready.', { kind: 'startCdReduce', n: 2 }) });

// ---- Tier 8 — The Black Chasm
weapon('shadowward-blade', 'Shadowward Blade', 'sword', 8, ['fierce', 'keen', 'cruel'], 'Dull in daylight, bright in the dark.', { set: 'shadowward' });
armour('shadowward-cowl', 'Shadowward Cowl', 8, { hp: 0.8, def: 0.5, eva: 0.4 }, ['elusive', 'vigor', 'warding'], 'Eats the glint off anything it covers.', { set: 'shadowward' });
offhand('shadowward-aegis', 'Shadowward Aegis', 8, { def: 0.5, res: 0.5 }, ['stalwart', 'warding', 'thorned'], 'A mirrored disc that turns the dark around.', 'shield', { set: 'shadowward' });
acc('shadowward-veil', 'Shadowward Veil', 8, { eva: 0.5, res: 0.4 }, ['elusive', 'warding'], 'Thin as breath, colder than iron.', 'charm', { set: 'shadowward' });
weapon('chasm-cleaver', 'Chasm-cleaver', 'axe', 8, ['fierce', 'cruel', 'vampiric'], 'A bridge-cutter’s axe.');
weapon('voidstring-bow', 'Voidstring Bow', 'bow', 8, ['precise', 'keen', 'swift'], 'The string is not quite there.');
weapon('night-dirk', 'Night Dirk', 'dagger', 8, ['keen', 'cruel', 'elusive'], 'Disappears from the hand.');
weapon('staff-of-dusk', 'Staff of Dusk', 'staff', 8, ['arcane', 'mending', 'warding'], 'A branch from a tree that grows downward.');
armour('bridgewalkers-coat', 'Bridgewalker’s Coat', 8, LIGHT, ['elusive', 'swift', 'vigor'], 'Sure-footed over any gap.');
offhand('pale-lantern', 'Pale Lantern', 8, { mag: 0.5, eva: 0.3 }, ['arcane', 'elusive', 'mending'], 'Gives light that does not carry.', 'lantern');
acc('dusk-locket', 'Dusk Locket', 8, { hp: 0.4, res: 0.4 }, ['vigor', 'warding'], 'A lock of hair, long ago.', 'pendant');
acc('gloom-ring', 'Gloom Ring', 8, { crit: 0.4, critDmg: 0.4 }, ['keen', 'cruel'], 'The dark thinks of you fondly.', 'ring');
weapon('stalkers-fang', 'Stalker’s Fang', 'dagger', 8, [], 'A single tooth of darkness, still sharp.', { ...LEG, boss: 'chasm-stalker', sig: sig('Ambusher’s Edge', 'The wielder’s first attack each battle has +40 Critical chance.', { kind: 'firstStrike', critBonus: 40 }) });

// ---- Tier 9 — The Chamber of Flame
weapon('flamecaller-blade', 'Flamecaller Blade', 'sword', 9, ['fierce', 'cruel', 'keen'], 'Forged in the deepest fire.', { set: 'flamecaller' });
armour('flamecaller-plate', 'Flamecaller Plate', 9, TANK, ['stalwart', 'vigor', 'thorned'], 'Glows in the dark; does not scald.', { set: 'flamecaller' });
offhand('flamecaller-ward', 'Flamecaller Ward', 9, { res: 0.6, def: 0.4 }, ['warding', 'stalwart', 'thorned'], 'A disc of black glass with a molten edge.', 'shield', { set: 'flamecaller' });
acc('flamecaller-sigil', 'Flamecaller Sigil', 9, { atk: 0.4, mag: 0.4 }, ['fierce', 'arcane'], 'A seal of the old fire-priests.', 'ring', { set: 'flamecaller' });
weapon('magma-axe', 'Magma Axe', 'axe', 9, ['fierce', 'cruel', 'vampiric'], 'The edge is molten rock.');
weapon('cinderbow', 'Cinderbow', 'bow', 9, ['precise', 'keen', 'fierce'], 'Arrows ignite in flight.');
weapon('ashen-dagger', 'Ashen Dagger', 'dagger', 9, ['keen', 'cruel', 'elusive'], 'Blackened and sharp.');
weapon('staff-of-embers', 'Staff of Embers', 'staff', 9, ['arcane', 'mending', 'warding'], 'Never entirely cold.');
armour('salamander-coat', 'Salamander Coat', 9, WARD, ['warding', 'vigor', 'mending'], 'Scaled, supple and heat-proof.');
offhand('ember-lantern', 'Ember Lantern', 9, { mag: 0.5, hp: 0.3 }, ['arcane', 'vigor', 'mending'], 'A coal in a cage of gold.', 'lantern');
acc('phoenix-feather', 'Phoenix Feather', 9, { hp: 0.5, mag: 0.4 }, ['vigor', 'arcane', 'mending'], 'Warm. Always.', 'feather');
acc('obsidian-ring', 'Obsidian Ring', 9, { atk: 0.4, crit: 0.4 }, ['fierce', 'keen'], 'Black glass, sharp as an edge.', 'ring');
acc('heralds-ashen-crown', 'Herald’s Ashen Crown', 9, { atk: 0.6, mag: 0.6, crit: 0.4 }, [], 'Charred, delicate and still too warm to hold.', 'crown', { ...LEG, boss: 'flame-herald', sig: sig('Cinder Surge', 'Each kill refills 20% of the wearer’s action gauge.', { kind: 'onKill', effects: [{ k: 'gauge', amount: 200, on: 'self' }] }) });

// ---- Tier 10 — The Bridge of Khazad-dûm
weapon('bridgewarden-blade', 'Bridgewarden Blade', 'sword', 10, ['fierce', 'keen', 'cruel'], 'The oldest steel you will ever hold.', { set: 'bridgewarden' });
armour('bridgewarden-plate', 'Bridgewarden Plate', 10, TANK, ['stalwart', 'vigor', 'warding'], 'Grey as the bridge, heavy as its story.', { set: 'bridgewarden' });
offhand('bridgewarden-aegis', 'Bridgewarden Aegis', 10, { def: 0.6, res: 0.4 }, ['stalwart', 'warding', 'thorned'], 'It has turned fire before.', 'shield', { set: 'bridgewarden' });
acc('bridgewarden-sigil', 'Bridgewarden Sigil', 10, { hp: 0.5, atk: 0.3 }, ['vigor', 'fierce'], 'Inscribed in a tongue long out of use.', 'ring', { set: 'bridgewarden' });
weapon('khazad-axe', 'Deepmine Axe', 'axe', 10, ['fierce', 'cruel', 'vampiric'], 'Dwarf-forged, as heavy as a promise.');
weapon('bridgebow', 'Bridgebow', 'bow', 10, ['precise', 'keen', 'fierce'], 'Long enough to span a gap.');
weapon('dwarf-forged-dagger', 'Dwarf-forged Dagger', 'dagger', 10, ['keen', 'cruel', 'elusive'], 'Kept by a miner for a hundred years.');
weapon('staff-of-the-pilgrim', 'Staff of the Pilgrim', 'staff', 10, ['arcane', 'mending', 'warding'], 'Carried by wanderers, for wandering.');
armour('silverweave-coat', 'Silverweave Coat', 10, { hp: 0.9, def: 0.6, eva: 0.3 }, ['elusive', 'vigor', 'stalwart'], 'Light as cloth, hard as nails.');
offhand('duskglass-lantern', 'Duskglass Lantern', 10, { mag: 0.5, res: 0.4 }, ['arcane', 'warding', 'mending'], 'Burns bright in the dark; invisible in the light.', 'lantern');
acc('mountain-charm', 'Mountain Charm', 10, { hp: 0.5, def: 0.4 }, ['vigor', 'stalwart'], 'A pebble from the high roots.', 'charm');
acc('last-ring', 'The Last Ring', 10, { crit: 0.5, critDmg: 0.5 }, ['keen', 'cruel'], 'A ring that has outlasted its maker.', 'ring');
acc('balrogs-cinder', 'Balrog’s Cinder', 10, { atk: 0.7, mag: 0.7, hp: 0.5 }, [], 'A coal of the old shadow, glowing with its own light.', 'pendant', { ...LEG, boss: 'balrog', sig: sig('Cinder of Dread', 'At battle start, every enemy is Burning (40% power) for 3 turns.', { kind: 'battleStart', effects: [{ k: 'status', id: 'burn', turns: 3, power: 40, on: 'enemies' }] }) });

export const ITEMS: Record<string, ItemTemplate> = Object.fromEntries(list.map((t) => [t.id, t]));
export const ITEM_LIST: ItemTemplate[] = list;

// ------------------------------------------------------------------ sets (stat bonuses: hp/atk/def/mag/res are %, the rest flat)
const setOf = (id: string, name: string, tier: number, two: { desc: string; stats?: W }, four: { desc: string; effect: PassiveEffect }): SetDef => ({
  id, name, tier,
  pieces: list.filter((i) => i.set === id).map((i) => i.id),
  bonuses: [{ count: 2, desc: two.desc, stats: two.stats }, { count: 4, desc: four.desc, effect: four.effect }],
});

export const SETS: Record<string, SetDef> = Object.fromEntries([
  setOf('gatewatch', 'Gatewatch', 1, { desc: '+8% Health', stats: { hp: 8 } }, { desc: 'Battle start: Guard (20%) for 2 turns.', effect: { kind: 'battleStart', effects: [{ k: 'status', id: 'guard', turns: 2, power: 20, on: 'self' }] } }),
  setOf('echohunter', 'Echohunter', 2, { desc: '+6 Evasion', stats: { eva: 6 } }, { desc: 'Each critical hit refills 12% of the action gauge.', effect: { kind: 'onCrit', gauge: 120 } }),
  setOf('forgeborn', 'Forgeborn', 3, { desc: '+8% Attack', stats: { atk: 8 } }, { desc: 'Battle start: Thorns (25%) for 3 turns.', effect: { kind: 'battleStart', effects: [{ k: 'status', id: 'thorns', turns: 3, power: 25, on: 'self' }] } }),
  setOf('stairwalker', 'Stairwalker', 4, { desc: '+6 Speed', stats: { spd: 6 } }, { desc: 'First attack each battle: +30 Critical chance.', effect: { kind: 'firstStrike', critBonus: 30 } }),
  setOf('hallguard', 'Hallguard', 5, { desc: '+8% Defence', stats: { def: 8 } }, { desc: 'When an ally falls: +30% Attack for 4 turns.', effect: { kind: 'allyFalls', effects: [{ k: 'status', id: 'rally', turns: 4, power: 30, on: 'self' }] } }),
  setOf('deepdelver', 'Deepdelver', 6, { desc: '+10% Resistance', stats: { res: 10 } }, { desc: 'Battle start: shield every ally (60% of Magic) for 3 turns.', effect: { kind: 'battleStart', effects: [{ k: 'shield', mult: 0.6, turns: 3, on: 'allies' }] } }),
  setOf('archivist', 'Archivist', 7, { desc: '+8% Magic', stats: { mag: 8 } }, { desc: 'Skills start 1 turn closer to ready.', effect: { kind: 'startCdReduce', n: 1 } }),
  setOf('shadowward', 'Shadowward', 8, { desc: '+4 Critical chance', stats: { crit: 4 } }, { desc: 'Below 40% health: +30% Defence.', effect: { kind: 'lowHp', below: 0.4, stat: 'def', pct: 30 } }),
  setOf('flamecaller', 'Flamecaller', 9, { desc: '+8% Attack and Magic', stats: { atk: 8, mag: 8 } }, { desc: 'Each kill refills 20% of the action gauge.', effect: { kind: 'onKill', effects: [{ k: 'gauge', amount: 200, on: 'self' }] } }),
  setOf('bridgewarden', 'Bridgewarden', 10, { desc: '+10% Health, +6% Defence', stats: { hp: 10, def: 6 } }, { desc: 'Battle start: Guard (25%) on every ally for 2 turns.', effect: { kind: 'battleStart', effects: [{ k: 'status', id: 'guard', turns: 2, power: 25, on: 'allies' }] } }),
].map((s) => [s.id, s]));

export const slotKindOf = (slot: string): ItemSlotKind => (slot.startsWith('accessory') ? 'accessory' : (slot as ItemSlotKind));
