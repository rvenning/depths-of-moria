import type { LoreDef } from './schema.ts';

const L = (id: string, chapter: number, source: string, title: string, text: string): LoreDef => ({ id, chapter, source, title, text });

/** source: 'floor:N' (floor-in-chapter cleared), 'boss', 'event', 'codex' */
export const LORE: LoreDef[] = [
  // ---- Chapter 1
  L('lore-1-a', 1, 'floor:5', 'The Door That Failed', 'The West-gate was built to be shut. It was never built to be shut for ever. The hinges are the oldest thing here; they still remember being closed.'),
  L('lore-1-b', 1, 'floor:40', 'Goblin Marks', 'The goblins have scratched tally marks into the wall at every landing. Four strokes and a slash. They have been counting something for a very long time.'),
  L('lore-1-c', 1, 'floor:70', 'The Ledger of the Guard', 'The last entry in the guard’s ledger reads: “Fire in the lower halls. Will report.” There is no report.'),
  L('lore-1-d', 1, 'boss', 'The Watcher’s Pool', 'The pool was here before the gate, and the gate was built beside it on purpose. The dwarves knew what lived in the water. They kept the door shut and the surface calm, and it was calm for a long time.'),
  // ---- Chapter 2
  L('lore-2-a', 2, 'floor:10', 'The Galleries Sing', 'The vaulting was cut to carry sound. Choirs once stood here. Now the bats keep up the harmony, flat as they are.'),
  L('lore-2-b', 2, 'floor:40', 'Archers’ Slots', 'Narrow slits overlook every passage. Whoever built these galleries expected visitors, and did not expect them to be friends.'),
  L('lore-2-c', 2, 'floor:70', 'Names on Stone', 'A wall of names, carved by many hands. The last few were scratched in with a dagger, in a hurry.'),
  L('lore-2-d', 2, 'boss', 'The Captain’s Bargain', 'Grishnákh took the galleries without a single battle. He only had to make a better offer than the last owner. The bats are still waiting for payment.'),
  // ---- Chapter 3
  L('lore-3-a', 3, 'floor:10', 'The Great Furnace', 'A dozen forges, each as big as a house, built to a single design. Not one was ever allowed to go out. They are going out now, one by one.'),
  L('lore-3-b', 3, 'floor:40', 'Guild Marks', 'Every anvil bears a mark: a hammer in a circle. The smiths of this place took pride in their work. Some of the work is still walking about.'),
  L('lore-3-c', 3, 'floor:70', 'Slag and Song', 'The forge-songs had a beat that matched the hammers. Someone has been humming one tonight, off-key, and the hammers are listening.'),
  L('lore-3-d', 3, 'boss', 'The Defiler’s Debt', 'Azog was never much of a smith. He keeps the forges lit for the same reason he keeps his grudges: nobody else would, and someone has to be hurt by them.'),
  // ---- Chapter 4
  L('lore-4-a', 4, 'floor:10', 'The Stair Has No Bottom', 'The builders cut the Stair to reach the roots of the mountain. It has not found them yet. The treads grow older with every flight.'),
  L('lore-4-b', 4, 'floor:40', 'Landing Wardens', 'Every tenth landing has a small alcove for a watchman. A few still have a stool, a cup, and a lantern gone cold.'),
  L('lore-4-c', 4, 'floor:70', 'Wargs and Waiting', 'A warg will follow a company down a thousand steps and not make a sound. Patience is a kind of hunger.'),
  L('lore-4-d', 4, 'boss', 'Shelob’s Silk', 'Shelob has not left the Stair in ten thousand years. She does not need to. Things come to her, and the Stair is long.'),
  // ---- Chapter 5
  L('lore-5-a', 5, 'floor:10', 'Hall of Pillars', 'Each of the great pillars is carved from a single trunk of stone, and each is carved with a different story. Most have been scratched out.'),
  L('lore-5-b', 5, 'floor:40', 'The Drums', 'No one built the drums. Somebody found a big hollow thing and a stick and discovered it could be heard from the top of the mountain.'),
  L('lore-5-c', 5, 'floor:70', 'What Trolls Remember', 'Trolls are said to turn to stone in sunlight. These have not seen the sun in ages, and have grown thoughtful about it.'),
  L('lore-5-d', 5, 'boss', 'The Troll’s Court', 'The cave-troll holds his court at the foot of the largest pillar. It is not a good court. It is, however, a loud one.'),
  // ---- Chapter 6
  L('lore-6-a', 6, 'floor:10', 'The Rising Water', 'The lower halls were dry when they were built. Something up in the mountain’s roots broke, and the water has been rising ever since, patient and black.'),
  L('lore-6-b', 6, 'floor:40', 'Pale Fish', 'The fish here have no eyes, and need none. They know the shape of every wall by the way the water bends against it.'),
  L('lore-6-c', 6, 'floor:70', 'The Mire’s Gifts', 'The mire gives back what it takes, but slowly, and in strange condition. A boot. A bell. A whole, living, furious toad.'),
  L('lore-6-d', 6, 'boss', 'What Lives Below', 'The water is deep here. The thing that lives in it is deeper. It is not malicious. It is only very, very large, and has always been hungry.'),
  // ---- Chapter 7
  L('lore-7-a', 7, 'floor:10', 'The Archives Begin', 'Shelf after shelf of records, every one in a different hand, every one inventorying the same dwindling stores. Whoever kept these knew they were running out.'),
  L('lore-7-b', 7, 'floor:40', 'The Index of Names', 'Every dwarf who ever lived in these halls is recorded here, with date of birth, trade, and cause of departure. The last column grows long.'),
  L('lore-7-c', 7, 'floor:70', 'Ink that Does Not Dry', 'The ink in the last volumes never dried. It runs down the page and forms new words, when no one is watching.'),
  L('lore-7-d', 7, 'boss', 'The Wight-king’s Ledger', 'The Wight-king was left to keep the tomb safe. He did not say from what. He has been very thorough since.'),
  // ---- Chapter 8
  L('lore-8-a', 8, 'floor:10', 'The Chasm', 'A split in the mountain’s heart so deep that stones dropped into it are never heard to land. The builders spanned it with a dozen thin bridges.'),
  L('lore-8-b', 8, 'floor:40', 'Bridge-maker’s Notes', 'The bridge-makers wrote down every span’s maximum load in a neat hand. The notes end with a column labelled: “Do not trust.”'),
  L('lore-8-c', 8, 'floor:70', 'Things That Fell', 'It is said that everything that falls in the Chasm is still falling. If you listen at the edge, sometimes you hear them say hello.'),
  L('lore-8-d', 8, 'boss', 'The Quiet Host', 'The Dead do not hunt for food. They hunt for the sound of your footsteps, and take it. Many have walked on without noticing they had no echo.'),
  // ---- Chapter 9
  L('lore-9-a', 9, 'floor:10', 'The Deep Fire', 'The mountain’s heart is hot. In the old days, the forges tapped it carefully. Something has since opened the tap all the way.'),
  L('lore-9-b', 9, 'floor:40', 'Priests of Ash', 'There is a rumour of a cult that worships the fire. There is no rumour of any that returned from worshipping it.'),
  L('lore-9-c', 9, 'floor:70', 'The Wyrm’s Warm Bed', 'The stone here is warm to the touch, and smooth where a great body has lain. It is still faintly warm tonight.'),
  L('lore-9-d', 9, 'boss', 'The Herald’s Errand', 'The Herald does not carry its own message. It is the message: announce, enter, burn. It has been practising for centuries.'),
  // ---- Chapter 10
  L('lore-10-a', 10, 'floor:10', 'The Last Span', 'A bridge, narrow and unrailed, across a gulf you cannot see the bottom of. On the far side: a door. Behind you: the long way home.'),
  L('lore-10-b', 10, 'floor:40', 'The Bridge Remembers', 'Every footstep on the bridge was once recorded in a ledger. The last page reads: “Too many.”'),
  L('lore-10-c', 10, 'floor:70', 'Light Against the Dark', 'It is a curious thing, but the closer you come to the fire, the brighter your own light seems.'),
  L('lore-10-d', 10, 'boss', 'The End of the Bridge', 'There is a thing on the bridge older than the bridge. It does not hate you. It does not know you. It is simply in the way, and has been for a very long time.'),
  // ---- Events and general
  L('lore-event-cairn', 1, 'event', 'A Small Cairn', 'The stones are laid with care. Whoever did this was in a hurry, but cared very much about doing it properly.'),
  L('lore-event-mirror', 2, 'event', 'The Dust Mirror', 'In the glass you see a hall full of lamplight and a dwarf-woman who looks up as if she heard you. Then the dust settles.'),
  L('lore-event-pilgrim', 1, 'event', 'A Pilgrim’s Directions', 'The pilgrim talks of a place deeper than any map: “Below the stair, below the water, below the books, there is a door. Behind the door, a bridge.”'),
  L('lore-event-whisper', 2, 'event', 'What the Hall Said', 'The hall says: “You are not the first. You are not the last. You may be the best.” It then adds, less kindly: “But it is early yet.”'),
  L('lore-event-nook', 6, 'event', 'A Marginal Note', 'In the margin: “If you are reading this, the lamp is still lit. If the lamp is still lit, someone is still looking after it. Thank you.”'),
  L('lore-event-stranger', 4, 'event', 'The Riddling Stranger', 'He gives a name, but it is not the one he was born with. “Many riddles,” he says, “are only questions that have forgotten they have answers.”'),
  L('lore-event-chapel', 5, 'event', 'A Candle for the Fallen', 'The chapel’s candles were lit for the dead of a long war. One flame still burns, unattended, on the lowest shelf. It is yours now.'),
  L('lore-camp', 1, 'codex', 'On Ages and Descents', 'Each time the company breaks through to the next depth, the world seems to turn: darker, harder, older. The old gear fails. The old ways do not. Wisdom, once earned, stays.'),
  L('lore-fellowship', 1, 'codex', 'The Company', 'Seven came down into the dark. Not all at once, and not all for the same reason. By the end, it hardly mattered. They had each other.'),
  L('lore-endless', 10, 'codex', 'Below the Bridge', 'Beyond the final span the depths go on. Someone, somewhere, is keeping count. The number is not going to stop.'),
];
export const LORE_BY_ID: Record<string, LoreDef> = Object.fromEntries(LORE.map((l) => [l.id, l]));
