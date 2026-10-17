import type { EventChoice, EventDef, EventOutcome, Rarity } from './schema.ts';

const g = (amount: number): EventOutcome => ({ k: 'gold', amount });
const item = (rarity: Rarity): EventOutcome => ({ k: 'item', rarity });
const heal = (pct: number): EventOutcome => ({ k: 'healPct', pct });
const hurt = (pct: number): EventOutcome => ({ k: 'damagePct', pct });
const buff = (stat: import('./schema.ts').StatKey, pct: number, battles = 3): EventOutcome => ({ k: 'buff', stat, pct, battles });
const curse = (stat: import('./schema.ts').StatKey, pct: number, battles = 3): EventOutcome => ({ k: 'curse', stat, pct: -pct, battles });
const mats = (ore: number, cloth: number): EventOutcome => ({ k: 'materials', ore, cloth });
const ess = (amount: number): EventOutcome => ({ k: 'essence', amount });
const xp = (amount: number): EventOutcome => ({ k: 'xp', amount });
const lore = (id: string): EventOutcome => ({ k: 'lore', id });
const fight = (elite = false): EventOutcome => ({ k: 'fight', elite });
const sup = (amount: number): EventOutcome => ({ k: 'supplies', amount });
const aff = (amount: number): EventOutcome => ({ k: 'affinity', amount });
const ren = (amount: number): EventOutcome => ({ k: 'renown', amount });

const one = (text: string, ...results: EventOutcome[]) => [{ chance: 1, text, results }];
const two = (p: number, a: [string, EventOutcome[]], b: [string, EventOutcome[]]) => [
  { chance: p, text: a[0], results: a[1] }, { chance: 1 - p, text: b[0], results: b[1] },
];
const C = (label: string, outcomes: EventChoice['outcomes'], hint?: string, requires?: EventChoice['requires']): EventChoice => ({ label, hint, requires, outcomes });
const leave = C('Move on', one('You leave it as you found it.'), 'Safe');

export const EVENTS: EventDef[] = [
  { id: 'abandoned-camp', title: 'Abandoned Camp', art: 'camp', chapters: [1, 4],
    text: 'A ring of cold stones, a few torn tents, a cook-pot on its side. Whoever slept here left in a hurry.',
    choices: [
      C('Search the tents', two(0.65, ['Under a bedroll: a purse, a little worse for wear.', [g(3)]], ['A snare snaps. The company escapes with scrapes.', [hurt(14)]]), 'Gold, or a trap'),
      C('Rest by the cold fire', one('A few quiet hours. Wounds close.', heal(30)), 'Heal 30%'),
      leave] },
  { id: 'fallen-adventurer', title: 'Fallen Adventurer', art: 'bones',
    text: 'A traveller lies against the wall, long dead, still clutching a satchel. Their boots point towards the way out.',
    choices: [
      C('Take their gear', two(0.5, ['Good steel under the rags.', [item('rare')]], ['The satchel hums. Something hostile rises from it.', [curse('atk', 10, 2)]]), 'Rare item, or a curse'),
      C('Bury them respectfully', one('A cairn of loose stones. The company feels steadier.', buff('hp', 8, 3), lore('lore-event-cairn')), 'Buff'),
      leave] },
  { id: 'whispering-well', title: 'Whispering Well', art: 'well',
    text: 'A stone well, cool air rising. Something at the bottom is whispering, kindly, in a voice you almost remember.',
    choices: [
      C('Drink', two(0.55, ['Cold, clean and strangely warm. Everyone feels better.', [heal(45)]], ['It tastes of ash. Hands tremble for a while.', [curse('spd', 4, 3)]]), 'Heal, or a curse'),
      C('Toss in a coin', one('A faint chime. Something good turns up.', g(-1), ess(2)), 'Essence'),
      leave] },
  { id: 'dwarven-cache', title: 'Dwarven Cache', art: 'chest',
    text: 'A hidden panel in a masons’ wall. Behind it, a locked chest with a maker’s mark that Gimli could surely read.',
    choices: [
      C('Let Gimli open it', one('“Ah. Eight turns, a half-twist, and ask nicely.” The lock opens at once.', item('epic')), 'Guaranteed epic', { hero: 'gimli' }),
      C('Pry it open', two(0.5, ['The lid cracks. Treasure inside.', [item('uncommon'), mats(3, 2)]], ['The lock bites back.', [hurt(15)]]), 'Items, or a bruise'),
      leave] },
  { id: 'collapsed-corridor', title: 'Collapsed Corridor', art: 'rubble',
    text: 'Fallen stone blocks the way. There is something glittering in the rubble.',
    choices: [
      C('Dig through', one('Hours of work, and a pile of useful scrap.', mats(6, 4)), 'Materials'),
      C('Look for another way', one('A long detour, but safe.', xp(60)), 'A little experience'),
      leave] },
  { id: 'goblin-marketeer', title: 'The Marketeer', art: 'merchant',
    text: 'A goblin with a cart. Remarkably, a very polite goblin. “Wares, honoured travellers? Cheap. Mostly not stolen.”',
    choices: [
      C('Buy something (costs gold)', one('Money changes hands; the cart yields a well-made blade.', g(-2), item('rare')), 'Pay for a rare item', { gold: 1 }),
      C('Threaten him', two(0.5, ['He bolts, leaving his cart.', [item('uncommon'), g(2)]], ['His “friends” appear.', [fight()]]), 'Loot, or a fight'),
      leave] },
  { id: 'mirror-of-dust', title: 'Mirror of Dust', art: 'mirror',
    text: 'A tall mirror coated in dust. You wipe a smear of it away and see someone else’s face looking out.',
    choices: [
      C('Look closely', one('A scene from long ago, playing out in the glass.', lore('lore-event-mirror')), 'Lore'),
      C('Smash it', two(0.5, ['Shards of silver glass. They shine.', [ess(3)]], ['Seven years’ bad luck, give or take.', [curse('crit', 3, 3)]]), 'Essence, or bad luck'),
      leave] },
  { id: 'stranded-pilgrim', title: 'Stranded Pilgrim', art: 'pilgrim',
    text: 'A pilgrim sits with a broken ankle and an unbroken smile. “Don’t trouble yourselves,” he says, not meaning it.',
    choices: [
      C('Bind his ankle', one('He insists on repaying you, and what he knows is worth more than gold.', xp(180), lore('lore-event-pilgrim')), 'Experience and lore'),
      C('Share rations', one('He eats gratefully and gives you directions.', sup(1), aff(2)), 'A supply and bonds'),
      leave] },
  { id: 'cold-forge', title: 'A Cold Forge', art: 'forge', chapters: [2, 6],
    text: 'An ancient forge, banked and silent. The bellows are still sound. A good smith could do wonders here.',
    choices: [
      C('Light the forge', one('Sparks; heat; a clean hour at the anvil.', buff('atk', 10, 3)), 'Attack buff'),
      C('Scavenge', one('Offcuts, rivets and a few rolls of good cloth.', mats(5, 5)), 'Materials'),
      leave] },
  { id: 'echoing-hall', title: 'The Listening Hall', art: 'hall', chapters: [1, 5],
    text: 'A vast, still hall. Even your breathing echoes. Something in the roof seems to listen.',
    choices: [
      C('Shout', two(0.5, ['The echo answers with a clatter of coins.', [g(3)]], ['The roof stirs. Wings, and many.', [fight()]]), 'Gold, or a fight'),
      C('Whisper', one('The echo whispers back something useful.', lore('lore-event-whisper')), 'Lore'),
      C('Listen', one('You catch a pattern in the sound and use it.', buff('acc', 12, 3)), 'Accuracy buff')] },
  { id: 'trolls-larder', title: 'Troll’s Larder', art: 'larder', chapters: [4, 7],
    text: 'Something very large keeps its food here. The door is the width of a house, and slightly open.',
    choices: [
      C('Raid it', two(0.5, ['A fortune in salted odds and ends.', [g(5), item('uncommon')]], ['It comes home early.', [fight(true)]]), 'Big loot, or an elite'),
      C('Sneak in and take only a little', one('Light fingers, light footsteps.', g(2), sup(1)), 'Safe'),
      leave] },
  { id: 'sunken-shrine', title: 'Sunken Shrine', art: 'shrine', chapters: [5, 8],
    text: 'A small shrine, half-submerged. A bowl sits on the altar, patient and empty.',
    choices: [
      C('Leave an offering', one('The water in the bowl clears. A calm settles on the party.', g(-2), buff('hp', 12, 4)), 'Pay gold for a Health buff', { gold: 1 }),
      C('Pray', two(0.6, ['A warmth. A blessing.', [heal(50)]], ['Silence; that is all you receive.', []]), 'Heal'),
      leave] },
  { id: 'library-nook', title: 'Library Nook', art: 'books', chapters: [6, 9],
    text: 'A reading nook with a lamp that still burns. A single volume lies open on the table.',
    choices: [
      C('Read it', one('Dense, dry and brilliant. The company learns something.', xp(400), lore('lore-event-nook')), 'Experience'),
      C('Copy a page for the scholars', one('A fair copy, slightly smudged. Some collector will pay well.', g(4), ess(2)), 'Gold and essence'),
      leave] },
  { id: 'rope-bridge', title: 'The Rope Bridge', art: 'bridge',
    text: 'A frayed rope bridge across a deep cleft. There is nothing below you but a sound like falling water.',
    choices: [
      C('Let Legolas lead', one('He crosses without a creak and fixes a line. Everyone follows.', aff(3), xp(120)), 'Safe, with Legolas', { hero: 'legolas' }),
      C('Cross carefully', two(0.7, ['It holds. Barely.', []], ['A plank gives. A hard landing.', [hurt(20)]]), 'Risk'),
      C('Find another way', one('Hours lost, but not a hair out of place.', xp(40)), 'Safe')] },
  { id: 'campfire-circle', title: 'Campfire Circle', art: 'camp',
    text: 'A good place to stop. A ring of stones, dry wood, a spring close by. The company is tired.',
    choices: [
      C('Let Sam cook', one('Dinner is a triumph. Everyone leaves fully rested.', heal(100), aff(3)), 'Full heal and bonds', { hero: 'sam' }),
      C('Tell stories', one('Old tales and bad jokes, and a closer company.', aff(5)), 'Strengthens bonds'),
      C('Rest', one('A short, safe rest.', heal(35)), 'Heal 35%')] },
  { id: 'hooded-stranger', title: 'The Hooded Stranger', art: 'stranger',
    text: 'A figure sits in the corridor. “Answer me a riddle,” he says in a voice like a stopped clock, “or turn back.”',
    choices: [
      C('Answer the riddle', two(0.5, ['“Correct.” He vanishes, leaving a gift.', [ess(4), lore('lore-event-stranger')]], ['“Wrong,” he says, quite kindly, and takes something small.', [curse('def', 6, 3)]]), 'Essence and lore, or a curse'),
      C('Attack', one('He is not there any more.', fight(true)), 'An elite fight'),
      leave] },
  { id: 'ember-vent', title: 'Ember Vent', art: 'vent', chapters: [3, 10],
    text: 'A crack in the floor breathes out heat and orange light. The air tastes of metal.',
    choices: [
      C('Warm your weapons in it', two(0.6, ['Gleaming edges, a satisfying hum.', [buff('atk', 12, 3), hurt(8)]], ['The vent flares.', [hurt(18)]]), 'Attack buff, some burns'),
      C('Cool it with water', one('Steam, then crystals of cooled slag.', mats(5, 3)), 'Materials'),
      leave] },
  { id: 'weeping-statue', title: 'The Weeping Statue', art: 'statue', chapters: [5, 10],
    text: 'A weathered statue. Water runs down its cheeks. Its eyes are two cut stones.',
    choices: [
      C('Touch its hand', two(0.5, ['A kindness passes through you.', [heal(40), buff('res', 10, 3)]], ['Cold fingers, a draining touch.', [curse('hp', 8, 3)]]), 'Blessing, or a curse'),
      C('Pry out an eye', two(0.5, ['A fine gem.', [item('rare')]], ['The statue sighs. The stone cracks, sharp.', [hurt(12)]]), 'Rare item, or a wound'),
      leave] },
  { id: 'old-armoury', title: 'The Old Armoury', art: 'armoury', chapters: [3, 10],
    text: 'Rank after rank of weapon racks, rusted and dusty. Most is junk. A few pieces still shine.',
    choices: [
      C('Choose carefully', one('A single blade, a single breastplate. They fit.', item('rare')), 'A rare item'),
      C('Take everything of value', two(0.55, ['Heavy loot, quickly gathered.', [item('uncommon'), item('uncommon'), mats(4, 4)]], ['One piece is cursed.', [item('uncommon'), curse('spd', 5, 3)]]), 'More, with risk'),
      leave] },
  { id: 'lantern-maker', title: 'The Lantern-maker', art: 'lantern',
    text: 'A little workshop built into a niche. A bent old craftsman looks up from a bench full of lamps. “Cheap light,” he says. “Always cheap light.”',
    choices: [
      C('Buy lamp oil (costs gold)', one('A clay jar of oil, and a spare wick.', g(-1), sup(2)), '+2 supplies', { gold: 1 }),
      C('Trade stories', one('He gives you a small, clean spark in return.', ess(3)), 'Essence'),
      leave] },
  { id: 'shadowed-alcove', title: 'Shadowed Alcove', art: 'alcove', chapters: [7, 10],
    text: 'A recess in the wall. The dark inside seems thicker than it should be. Something moves in it.',
    choices: [
      C('Light a torch', one('The dark flinches. Behind it, a sealed cache.', item('epic'), hurt(10)), 'Epic item, some damage'),
      C('Step inside', one('The shadow turns out to be a shade. An elite.', fight(true)), 'An elite fight'),
      leave] },
  { id: 'silent-chapel', title: 'The Silent Chapel', art: 'chapel',
    text: 'A small chapel carved from the rock. Candles stand in rows, all unlit. Nothing here is hostile.',
    choices: [
      C('Rest in the pews', one('You wake refreshed.', heal(60)), 'Heal 60%'),
      C('Light a candle', one('A small, steady flame. Something is remembered.', ren(1), lore('lore-event-chapel')), 'Renown and lore'),
      leave] },
  { id: 'trapped-chest', title: 'The Trapped Chest', art: 'chest',
    text: 'A plain chest in the middle of the floor. Far too plain. There are scratch marks around the lock.',
    choices: [
      C('Let Frodo pick it', one('Click. Click. Click. The lid lifts without a sound.', item('rare'), g(2)), 'Guaranteed loot', { hero: 'frodo' }),
      C('Smash it open', two(0.5, ['The chest bursts. Something good rolls out.', [item('uncommon'), hurt(12)]], ['A hidden dart.', [hurt(16)]]), 'Loot with a bruise'),
      leave] },
  { id: 'wounded-warg', title: 'The Wounded Warg', art: 'warg', chapters: [3, 8],
    text: 'A warg lies by the wall, bleeding, snarling and too weak to stand. It watches you with intelligent eyes.',
    choices: [
      C('Tend the wound', one('It goes still. Then licks your hand. Then limps away.', xp(220), aff(2)), 'Experience'),
      C('End its suffering', one('It is quick, and mercifully so.', xp(80), g(1)), 'A little experience and gold'),
      leave] },
];

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
