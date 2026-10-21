import type { AchievementDef, QuestDef } from './schema.ts';

const Q = (id: string, chapter: number, title: string, desc: string, metric: string, target: number, reward: QuestDef['reward'], repeatable = false): QuestDef =>
  ({ id, chapter, title, desc, metric, target, reward, repeatable });

export const QUESTS: QuestDef[] = [
  Q('q-first-blood', 1, 'First Blood', 'Defeat 15 enemies.', 'kills', 15, { gold: 100, renown: 1 }),
  Q('q-gate-open', 1, 'Open the Gate', 'Defeat the Watcher in the Water (floor 100).', 'best', 100, { essence: 15, renown: 2, item: 'rare' }),
  Q('q-company', 1, 'Gather the Company', 'Recruit three heroes.', 'heroes', 3, { gold: 150, renown: 1 }),
  Q('q-ten-floors', 1, 'Ten Deep', 'Reach floor 10.', 'best', 10, { gold: 120 }),
  Q('q-loot-30', 1, 'Spoils of the Deep', 'Find 30 items.', 'itemsFound', 30, { gold: 200, ore: 10, cloth: 10 }),
  Q('q-no-heal', 1, 'Wounds and Walls', 'Win 2 Trials set to “No Healing”.', 'noHealWins', 2, { essence: 10, renown: 2 }),
  Q('q-salvage-20', 1, 'Waste Not', 'Salvage 20 items.', 'salvaged', 20, { ore: 15, cloth: 15 }),
  Q('q-flawless-5', 2, 'Not a Scratch', 'Win 5 battles without a hero falling.', 'flawless', 5, { gold: 250, renown: 1 }),
  Q('q-bosses-2', 2, 'Captain’s Fall', 'Defeat 2 chapter bosses.', 'bossKills', 2, { essence: 20, renown: 2 }),
  Q('q-elites-5', 2, 'Elite Hunter', 'Defeat 5 elite enemies.', 'eliteKills', 5, { gold: 300, item: 'epic' }),
  Q('q-critical-100', 2, 'Hit Them Where It Hurts', 'Land 100 critical hits.', 'crits', 100, { gold: 250, renown: 1 }),
  Q('q-forge-5', 3, 'Master Smith', 'Upgrade items at the forge 5 times.', 'forged', 5, { ore: 20, cloth: 20, renown: 1 }),
  Q('q-set-complete', 2, 'Full Panoply', 'Discover all four pieces of one armour set.', 'setsComplete', 1, { gold: 600, renown: 2, item: 'rare' }),
  Q('q-set-piece', 3, 'Matched Set', 'Find 6 set pieces.', 'setPieces', 6, { gold: 400, renown: 1 }),
  Q('q-relic-10', 3, 'Relic Keeper', 'Raise your relics by 10 levels in total.', 'relicLevels', 10, { essence: 25, renown: 2 }),
  Q('q-rich', 3, 'A Dragon’s Hoard', 'Earn 50,000 gold in total.', 'goldEarned', 50000, { renown: 2 }),
  Q('q-events-10', 4, 'Strange Places', 'Resolve 10 events.', 'eventsDone', 10, { gold: 500, renown: 1 }),
  Q('q-combos', 4, 'Fellowship Strikes', 'Trigger bond combos 25 times.', 'combosFired', 25, { essence: 20, renown: 1 }),
  Q('q-bond-t1', 4, 'Friends in the Dark', 'Reach bond tier 1 with 3 hero pairs.', 'bondT1', 3, { renown: 2 }),
  Q('q-talents-15', 4, 'Learned Hands', 'Learn 15 talents.', 'talents', 15, { gold: 500, renown: 1 }),
  Q('q-bosses-5', 5, 'Giant-slayer', 'Defeat 5 chapter bosses.', 'bossKills', 5, { essence: 60, renown: 3 }),
  Q('q-five-heroes', 5, 'A Full Company', 'Recruit five heroes.', 'heroes', 5, { renown: 2 }),
  Q('q-challenge-5', 5, 'Trial by Fire', 'Win 5 Trials.', 'challengesWon', 5, { item: 'epic', renown: 2 }),
  Q('q-epic-3', 6, 'Epic Finds', 'Find 3 epic items.', 'epicsFound', 3, { gold: 800, renown: 1 }),
  Q('q-ascend', 6, 'Reforged in Fire', 'Defeat the Deepwater Horror (floor 600).', 'best', 600, { essence: 100, renown: 3 }),
  Q('q-bond-t3', 7, 'Bound Together', 'Reach bond tier 3 with 2 hero pairs.', 'bondT3', 2, { essence: 80, renown: 3 }),
  Q('q-all-heroes', 7, 'The Full Fellowship', 'Recruit all seven heroes.', 'heroes', 7, { renown: 3, item: 'epic' }),
  Q('q-deep-800', 8, 'Edge of the Abyss', 'Reach floor 800.', 'best', 800, { essence: 150, renown: 3 }),
  Q('q-kills-2000', 8, 'Relentless', 'Defeat 2,000 enemies.', 'kills', 2000, { essence: 100, renown: 2 }),
  Q('q-legend', 9, 'Legend in the Making', 'Own a legendary item.', 'legendOwned', 1, { renown: 3, essence: 80 }),
  Q('q-balrog', 10, 'You Shall Not Pass', 'Defeat the Balrog (floor 1000).', 'best', 1000, { essence: 300, renown: 8 }),
  Q('q-endless-1050', 10, 'Into the Deep', 'Reach floor 1050 in the Deep Delve.', 'endlessBest', 1050, { essence: 200, renown: 4 }),
  Q('q-ladder-5', 10, 'Climb the Ladder', 'Clear 5 rungs of the Challenge Ladder.', 'ladder', 5, { essence: 150, renown: 4 }),
  Q('q-daily-boss', 1, 'Boss Rush', 'Defeat 10 bosses (repeatable).', 'bossKillsR', 10, { essence: 40, renown: 1 }, true),
];

const A = (id: string, title: string, desc: string, metric: string, target: number, renown = 1, secret = false): AchievementDef =>
  ({ id, title, desc, metric, target, renown, secret });

export const ACHIEVEMENTS: AchievementDef[] = [
  A('a-first-win', 'First Steps', 'Win your first battle.', 'battlesWon', 1),
  A('a-100-wins', 'Veterans', 'Win 100 battles.', 'battlesWon', 100),
  A('a-1000-wins', 'Legion of One Company', 'Win 1,000 battles.', 'battlesWon', 1000, 3),
  A('a-floor-100', 'The Gate Falls', 'Clear floor 100.', 'best', 100),
  A('a-floor-300', 'Up the Stair', 'Clear floor 300.', 'best', 300),
  A('a-floor-500', 'Halfway Down', 'Clear floor 500.', 'best', 500, 2),
  A('a-floor-750', 'Over the Chasm', 'Clear floor 750.', 'best', 750, 2),
  A('a-floor-1000', 'The Bridge Falls', 'Defeat the Balrog.', 'best', 1000, 5),
  A('a-heroes-7', 'The Company is Whole', 'Recruit every hero.', 'heroes', 7, 2),
  A('a-level-30', 'Seasoned', 'Raise a hero to level 30.', 'maxLevel', 30),
  A('a-level-60', 'Veteran Hero', 'Raise a hero to level 60.', 'maxLevel', 60, 2),
  A('a-level-110', 'Legend', 'Raise a hero to level 110.', 'maxLevel', 110, 4),
  A('a-bosses-10', 'Giant-killer', 'Defeat all ten chapter bosses.', 'bossesDistinct', 10, 4),
  A('a-epic', 'Something Special', 'Find an epic item.', 'epicsFound', 1),
  A('a-legendary', 'Heirloom', 'Find a legendary item.', 'legendariesFound', 1, 2),
  A('a-relic-20', 'Relic Bearer', 'Raise any relic to level 20.', 'relicMax', 20, 2),
  A('a-relic-total-100', 'Keeper of Many Things', 'Raise your relics 100 levels in total.', 'relicLevels', 100, 3),
  A('a-bond-1', 'Friendship', 'Reach bond tier 1 with a hero pair.', 'bondT1', 1),
  A('a-bond-all', 'Fellowship Forged', 'Reach bond tier 3 with 10 hero pairs.', 'bondT3', 10, 4),
  A('a-forge-25', 'Hammer and Tongs', 'Upgrade items 25 times.', 'forged', 25),
  A('a-events-25', 'Curious', 'Resolve 25 events.', 'eventsDone', 25),
  A('a-flawless-25', 'Flawless', 'Win 25 battles with no hero falling.', 'flawless', 25, 2),
  A('a-challenge-15', 'Unflinching', 'Win 15 Trials.', 'challengesWon', 15, 2),
  A('a-lore-30', 'Chronicler', 'Unlock 30 lore entries.', 'loreCount', 30, 2),
  A('a-codex-50', 'Naturalist', 'Record 50 enemies in the codex.', 'codexCount', 50, 2),
  A('a-sets-5', 'Matching Sets', 'Discover every piece of five different sets.', 'setsComplete', 5, 3),
  A('a-collect-80', 'Collector', 'Discover 80 different items.', 'collection', 80, 2),
  A('a-endless-1100', 'Deeper Still', 'Reach floor 1100 in the Deep Delve.', 'endlessBest', 1100, 3),
  A('a-ladder-10', 'Ladder Climber', 'Clear 10 rungs of the Challenge Ladder.', 'ladder', 10, 3),
  A('a-age-5', 'The Fifth Age', 'Descend into the Fifth Age.', 'ageNow', 5, 2),
  A('a-ending', 'The End of the Beginning', 'See the ending.', 'endings', 1, 3, true),
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
export const ACH_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
