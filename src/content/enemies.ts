import type { BossPhase, CreatureFamily, EnemyDef, EnemySkillRef, EnemyTier, Row } from './schema.ts';

type Stat6 = [hp: number, atk: number, def: number, mag: number, res: number, spd: number];
type Pal = [body: string, accent: string, eye: string, gear: string];
/** skill shorthand: 'id' or 'id:weight' or 'id:weight:cd' */
const sk = (...ids: string[]): EnemySkillRef[] =>
  ids.map((s) => {
    const [skill, w, cd] = s.split(':');
    return { skill, weight: w ? Number(w) : 2, ...(cd ? { cd: Number(cd) } : {}) };
  });

interface Extra {
  scale?: number; features?: string[]; weakness?: string; crit?: number; acc?: number; eva?: number;
  xp?: number; gold?: number; phases?: BossPhase[];
}
const E = (
  id: string, name: string, chapter: number, tier: EnemyTier, family: CreatureFamily, row: Row, s: Stat6,
  skills: EnemySkillRef[], tags: string[], pal: Pal, codex: string, x: Extra = {},
): EnemyDef => ({
  id, name, chapter, tier, family, tags, row,
  hp: s[0], atk: s[1], def: s[2], mag: s[3], res: s[4], spd: s[5],
  crit: x.crit, acc: x.acc, eva: x.eva, skills,
  phases: x.phases, xp: x.xp ?? 1, gold: x.gold ?? 1,
  palette: { body: pal[0], accent: pal[1], eye: pal[2], gear: pal[3] },
  scale: x.scale, features: x.features, codex, weakness: x.weakness,
});

const list: EnemyDef[] = [
  // ============================================================ Chapter 1 — The West-gate
  E('goblin-skirmisher', 'Goblin Skirmisher', 1, 'normal', 'goblin', 'front', [0.65, 0.85, 0.5, 0.4, 0.4, 108], sk('e-strike:3', 'e-lunge:1'), ['goblin'],
    ['#6f8a3c', '#4c5f26', '#ffd24a', '#5a4632'], 'Cheap, quick and cruel. They fight in packs and run when the pack is gone.', { features: ['ears', 'dagger'] }),
  E('tunnel-rat', 'Tunnel Rat', 1, 'normal', 'warg', 'front', [0.5, 0.8, 0.4, 0.3, 0.3, 118], sk('e-bite:3', 'e-leap:1'), ['beast'],
    ['#6a5a4a', '#4a3c30', '#ff6a4a', '#3a2a22'], 'Big as a dog, hungry as two. They infest the gate tunnels.', { scale: 0.8, features: ['tail'] }),
  E('goblin-slinger', 'Goblin Slinger', 1, 'normal', 'archer', 'back', [0.5, 0.9, 0.4, 0.4, 0.4, 100], sk('e-sling:3', 'e-blind:1'), ['goblin'],
    ['#7a8f45', '#566a2a', '#ffd24a', '#6a5030'], 'Stays behind the pack and throws whatever is to hand.', { features: ['sling'] }),
  E('rotting-sentry', 'Rotting Sentry', 1, 'normal', 'guardian', 'front', [1.3, 0.8, 1.1, 0.4, 0.8, 80], sk('e-strike:3', 'e-bash:1'), ['undead'],
    ['#8a8f78', '#5a604c', '#9fe8c0', '#6a6a5a'], 'A gate guard that never stopped guarding, long after the gate was lost.', { features: ['helm', 'spear'] }),
  E('gate-lieutenant', 'Gate Lieutenant', 1, 'mini', 'orc', 'front', [4.0, 1.3, 1.1, 0.5, 0.7, 92], sk('e-strike:3', 'e-warcry:1', 'e-heavy:2'), ['orc'],
    ['#55604a', '#38402e', '#ff8a3a', '#4a4a52'], 'The Warden’s sergeant. He holds the guardroom — and a prisoner.', { scale: 1.25, features: ['helm', 'axe'], xp: 2, gold: 2 }),
  E('warren-boss-grub', 'Warren-boss Grub', 1, 'mini', 'goblin', 'front', [4.5, 1.2, 1.0, 0.5, 0.6, 96], sk('e-strike:3', 'e-spawn-goblin:2', 'e-heavy:2'), ['goblin'],
    ['#8a9a3c', '#5a6a22', '#ffe05a', '#6a4a2a'], 'Fattest goblin in the Gate warrens. Never fights without a crowd.', { scale: 1.3, features: ['ears', 'crown'], xp: 2, gold: 2 }),
  E('goblin-warchief', 'Goblin Warchief', 1, 'elite', 'goblin', 'front', [6.0, 1.5, 1.2, 0.5, 0.8, 98], sk('e-strike:3', 'e-warcry:2', 'e-heavy:2', 'e-spawn-goblin:1'), ['goblin'],
    ['#7a9a3a', '#4a6a1a', '#ff5a3a', '#7a2a2a'], 'Leads the raids on the lower halls. Wears the trophies of a hundred raids.', { scale: 1.4, features: ['ears', 'horns', 'axe'], xp: 3, gold: 3 }),
  E('gate-warden', 'The Gate Warden', 1, 'boss', 'warden', 'front', [6, 1.6, 1.3, 0.8, 1.1, 84], sk('e-strike:2', 'b-warden-slam:3', 'b-warden-bulwark:2', 'b-warden-sweep:2'), ['construct', 'boss'],
    ['#7c8088', '#4c5058', '#ffb347', '#5a5e66'], 'A towering stone sentinel set to hold the West-gate. Whoever it was set to keep out, it no longer remembers.',
    { scale: 1.9, features: ['portcullis'], xp: 8, gold: 8, weakness: 'Break the ward, then burst it down.', phases: [
      { hpBelow: 0.6, announce: 'The portcullis rises — goblins swarm in!', effects: [{ k: 'summon', enemy: 'goblin-skirmisher', count: 2 }] },
      { hpBelow: 0.3, announce: 'Cracks of orange light split the Warden’s stone!', effects: [], statPct: { atk: 25, spd: 15 } },
    ] }),

  // ============================================================ Chapter 2 — Echoing Galleries
  E('cave-bat', 'Cave Bat', 2, 'normal', 'bat', 'back', [0.45, 0.8, 0.3, 0.3, 0.3, 125], sk('e-bite:3', 'e-screech:1'), ['beast', 'flying'],
    ['#4a3c52', '#2e2438', '#ff4a6a', '#2a2030'], 'Blind, fast and many. You hear them long before you see them.', { eva: 20, features: ['wings'] }),
  E('gallery-archer', 'Gallery Archer', 2, 'normal', 'archer', 'back', [0.55, 1.0, 0.45, 0.4, 0.45, 102], sk('e-shoot:3', 'e-volley:2'), ['goblin'],
    ['#6f8a3c', '#4c5f26', '#ffd24a', '#6a5030'], 'Perched on the galleries, loosing arrows into the gloom.', { features: ['bow', 'hood'] }),
  E('goblin-tunneler', 'Goblin Tunneler', 2, 'normal', 'goblin', 'front', [0.9, 1.0, 0.8, 0.4, 0.5, 98], sk('e-strike:3', 'e-shatter:1'), ['goblin'],
    ['#6a7f3a', '#4a5a26', '#ffd24a', '#6a6a72'], 'Digs the side passages and hits armour with a pick.', { features: ['pick', 'helm'] }),
  E('hollow-echo', 'Hollow Echo', 2, 'normal', 'wisp', 'back', [0.5, 0.3, 0.3, 1.1, 1.2, 108], sk('e-bolt:3', 'e-fear:1'), ['shadow'],
    ['#6a7aa8', '#3a4a78', '#c8e0ff', '#2a3050'], 'A sound that remembers it was once a voice.', { features: ['trail'] }),
  E('bat-matriarch', 'Bat Matriarch', 2, 'mini', 'bat', 'back', [4.0, 1.2, 0.8, 0.6, 0.8, 120], sk('e-bite:3', 'e-screech:2', 'e-spawn-bats:2', 'e-howl:1'), ['beast', 'flying'],
    ['#5a3c62', '#382448', '#ff5a8a', '#2a1a38'], 'Mother of the roost. Where she screams, the dark answers.', { scale: 1.5, eva: 15, features: ['wings', 'fangs'], xp: 2, gold: 2 }),
  E('archer-sergeant', 'Archer Sergeant', 2, 'mini', 'archer', 'back', [3.5, 1.4, 0.9, 0.5, 0.7, 108], sk('e-shoot:3', 'e-volley:2', 'e-poisondart:2', 'e-warcry:1'), ['goblin'],
    ['#7a9040', '#566a2a', '#ff7a3a', '#7a3a2a'], 'Drills the galleries’ archers. Never misses twice.', { scale: 1.3, features: ['bow', 'hood', 'feather'], xp: 2, gold: 2 }),
  E('echo-stalker', 'Echo Stalker', 2, 'elite', 'shade', 'front', [6.0, 1.5, 1.0, 1.0, 1.0, 115], sk('e-lunge:3', 'e-screech:2', 'e-fear:2'), ['shadow'],
    ['#4a5078', '#2a3050', '#d8ecff', '#1a2038'], 'It hunts by sound. Stay silent and it will wander past. Nobody ever stays silent.', { scale: 1.4, eva: 20, features: ['claws'], xp: 3, gold: 3 }),
  E('goblin-captain', 'The Goblin Captain', 2, 'boss', 'goblin', 'front', [19, 1.6, 1.3, 0.7, 0.9, 94], sk('e-strike:2', 'b-captain-cleaver:3', 'b-captain-order:2', 'e-warcry:2'), ['goblin', 'boss'],
    ['#7a9a3a', '#4a6a1a', '#ff4a3a', '#8a2a2a'], 'He took the Galleries by being crueller than everyone else. His archers never run out of arrows.',
    { scale: 1.8, features: ['ears', 'horns', 'cleaver', 'cape'], xp: 8, gold: 8, weakness: 'Cut down the archers he calls before they stack up.', phases: [
      { hpBelow: 0.55, announce: 'The Captain bellows: “ALL OF YOU — IN!”', effects: [{ k: 'status', id: 'haste', turns: 99, power: 25, on: 'self' }, { k: 'summon', enemy: 'gallery-archer', count: 1 }], statPct: { atk: 20 } },
    ] }),

  // ============================================================ Chapter 3 — Abandoned Forges
  E('slag-orc', 'Slag Orc', 3, 'normal', 'orc', 'front', [1.4, 1.1, 1.3, 0.4, 0.7, 90], sk('e-strike:3', 'e-bash:1', 'e-harden:1'), ['orc'],
    ['#5a5a4a', '#3a3a2e', '#ff8a3a', '#6a4a3a'], 'Plated in cooled slag. They treat the heat as an old friend.', { features: ['helm', 'plate'] }),
  E('furnace-imp', 'Furnace Imp', 3, 'normal', 'fiend', 'back', [0.6, 0.4, 0.4, 1.2, 0.9, 112], sk('e-flame:3', 'e-fireball:1'), ['fire'],
    ['#b8452a', '#7a2a18', '#ffd24a', '#3a1a10'], 'Born in the flues. It spits embers for sport.', { features: ['horns', 'tail'] }),
  E('cinder-hound', 'Cinder Hound', 3, 'normal', 'warg', 'front', [0.9, 1.2, 0.7, 0.5, 0.6, 112], sk('e-bite:3', 'e-leap:1', 'e-flame:1'), ['beast', 'fire'],
    ['#6a3a2a', '#e8602a', '#ffb347', '#2a1a14'], 'A hound with a glowing coat and smoking jaws.', { features: ['ember'] }),
  E('anvil-golem', 'Anvil Golem', 3, 'normal', 'golem', 'front', [2.0, 1.2, 1.8, 0.4, 0.5, 65], sk('e-crush:2', 'e-strike:3'), ['construct'],
    ['#6a6e76', '#44484e', '#ffb347', '#34383e'], 'Welded from broken anvils and old purpose.', { features: ['rivets'] }),
  E('smelter-brute', 'Smelter Brute', 3, 'mini', 'orc', 'front', [5.0, 1.5, 1.4, 0.5, 0.7, 86], sk('e-crush:3', 'e-smoulder:2', 'e-strike:2'), ['orc', 'fire'],
    ['#6a4a3a', '#8a3a1a', '#ffa83a', '#44484e'], 'Feeds the furnaces with whatever comes to hand.', { scale: 1.4, features: ['helm', 'hammer'], xp: 2, gold: 2 }),
  E('bellows-witch', 'Bellows Witch', 3, 'mini', 'wraith', 'back', [3.5, 0.6, 0.6, 1.5, 1.2, 104], sk('e-firewave:3', 'e-fireball:2', 'e-mend:2', 'e-curse:1'), ['fire', 'shadow'],
    ['#8a3a3a', '#4a1a1a', '#ffd24a', '#2a1010'], 'Her breath keeps the old fires alive. Her voice keeps the orcs obedient.', { scale: 1.2, features: ['hood'], xp: 2, gold: 2 }),
  E('foundry-overseer', 'Foundry Overseer', 3, 'elite', 'orc', 'front', [7.0, 1.6, 1.6, 0.6, 0.9, 90], sk('e-shatter:3', 'e-warcry:2', 'e-harden:2', 'e-heavy:2'), ['orc'],
    ['#5a5a4a', '#8a6a2a', '#ff6a3a', '#3a3a42'], 'Ran the great forge-line for a master who is long dead. Still carries the whip.', { scale: 1.5, features: ['helm', 'plate', 'whip'], xp: 3, gold: 3 }),
  E('forge-tyrant', 'The Forge Tyrant', 3, 'boss', 'golem', 'front', [22, 1.7, 1.8, 1.0, 1.0, 76], sk('e-strike:2', 'b-tyrant-hammer:3', 'b-tyrant-molten:2', 'b-tyrant-furnace:2'), ['construct', 'fire', 'boss'],
    ['#7a4a3a', '#ff7a2a', '#ffe05a', '#44484e'], 'The greatest of the forge-golems, still tending a furnace no one has lit in ages — until now.',
    { scale: 2.0, features: ['furnace', 'hammer'], xp: 9, gold: 9, weakness: 'Do not strike while Molten Plate is up; wait it out and shield the party.', phases: [
      { hpBelow: 0.5, announce: 'The heart-fire flares — the Tyrant’s armour glows white!', effects: [{ k: 'status', id: 'thorns', turns: 3, power: 20, on: 'self' }], statPct: { atk: 20 }, addSkills: sk('e-firewave:2') },
    ] }),

  // ============================================================ Chapter 4 — The Endless Stair
  E('stair-warg', 'Stair Warg', 4, 'normal', 'warg', 'front', [1.0, 1.3, 0.8, 0.4, 0.6, 118], sk('e-bite:3', 'e-leap:1', 'e-howl:1'), ['beast'],
    ['#5a5a62', '#3a3a42', '#ffd24a', '#2a2a32'], 'Hunts in packs on the long stair, and always from above.', { features: ['tail'] }),
  E('ambush-goblin', 'Ambush Goblin', 4, 'normal', 'goblin', 'front', [0.8, 1.2, 0.7, 0.4, 0.5, 115], sk('e-lunge:3', 'e-strike:2'), ['goblin'],
    ['#5f7a40', '#3f5428', '#ffd24a', '#2a3a2a'], 'Waits in the dark of the landings.', { crit: 15, features: ['hood', 'dagger'] }),
  E('chain-orc', 'Chain Orc', 4, 'normal', 'orc', 'front', [1.6, 1.3, 1.3, 0.4, 0.7, 88], sk('e-strike:2', 'e-bash:2', 'e-whip:1'), ['orc'],
    ['#566048', '#363e2c', '#ff7a3a', '#6a6e76'], 'Wraps chains around its fists and the stair-rails alike.', { features: ['chain', 'helm'] }),
  E('climbing-spider', 'Climbing Spider', 4, 'normal', 'spider', 'back', [0.9, 1.1, 0.6, 0.5, 0.7, 108], sk('e-venom:3', 'e-web:2'), ['beast'],
    ['#3a3040', '#6a2a5a', '#ff4a7a', '#201828'], 'Strings webs between the flights and waits.', { features: ['legs'] }),
  E('warg-hunter', 'Warg Hunter', 4, 'mini', 'warg', 'front', [5.0, 1.7, 1.0, 0.5, 0.8, 120], sk('e-leap:3', 'e-bite:3', 'e-howl:2', 'e-spawn-wolf:2'), ['beast'],
    ['#3a3a42', '#6a6a72', '#ff5a3a', '#2a2a32'], 'Bigger than the rest, and the rest follow it.', { scale: 1.4, features: ['scars'], xp: 2, gold: 2 }),
  E('banner-orc', 'Banner Orc', 4, 'mini', 'orc', 'front', [5.5, 1.5, 1.4, 0.5, 0.8, 90], sk('e-warcry:3', 'e-bash:2', 'e-heavy:2'), ['orc'],
    ['#566048', '#8a2a2a', '#ff7a3a', '#6a6e76'], 'Carries a tattered banner. Where it flies, the orcs do not break.', { scale: 1.35, features: ['banner', 'helm'], xp: 2, gold: 2 }),
  E('packleader-warg', 'Packleader Warg', 4, 'elite', 'warg', 'front', [7.5, 1.8, 1.1, 0.6, 0.9, 122], sk('e-bite:3', 'e-leap:2', 'e-howl:2', 'e-spawn-wolf:2'), ['beast'],
    ['#2e2e36', '#8a8a92', '#ff3a3a', '#1e1e26'], 'The alpha of the stair. Silent, patient, deadly.', { scale: 1.55, features: ['scars', 'ruff'], xp: 3, gold: 3 }),
  E('stair-sentinel', 'The Stair Sentinel', 4, 'boss', 'warden', 'front', [25, 1.8, 1.7, 0.8, 1.2, 84], sk('e-strike:2', 'b-sentinel-push:3', 'b-sentinel-call:2', 'b-sentinel-lash:2'), ['construct', 'boss'],
    ['#6a7078', '#3a4048', '#ffb347', '#44484e'], 'A chained watchman that keeps the stair from being climbed. Or descended. It has forgotten which.',
    { scale: 2.0, features: ['chains', 'portcullis'], xp: 10, gold: 10, weakness: 'Kill the wargs before they swarm, then burst the Sentinel.', phases: [
      { hpBelow: 0.5, announce: 'The Sentinel’s chains tighten — it moves faster!', effects: [], statPct: { spd: 20, atk: 20 } },
    ] }),

  // ============================================================ Chapter 5 — The Great Halls
  E('hall-troll', 'Hall Troll', 5, 'normal', 'troll', 'front', [2.4, 1.5, 1.3, 0.4, 0.7, 78], sk('e-swipe:3', 'e-heavy:2', 'e-regen:1'), ['troll'],
    ['#6a7a6a', '#4a5a4a', '#ffd24a', '#5a4632'], 'Stone-skinned and slow, and it will not stop.', { scale: 1.3, features: ['club'] }),
  E('drummer-orc', 'Drummer Orc', 5, 'normal', 'orc', 'back', [1.0, 0.9, 0.8, 0.5, 0.7, 96], sk('e-warcry:2', 'e-strike:2', 'e-howl:1'), ['orc'],
    ['#4a5a42', '#2e3a2a', '#ff7a3a', '#6a4a32'], 'Booms-boom, booms-boom. The drums go deeper than the halls.', { features: ['drum'] }),
  E('troll-whelp', 'Troll Whelp', 5, 'normal', 'troll', 'front', [1.1, 1.1, 0.8, 0.3, 0.5, 95], sk('e-swipe:3', 'e-stomp:1'), ['troll'],
    ['#7a8a7a', '#5a6a5a', '#ffd24a', '#5a4632'], 'Young enough to be hasty, big enough to hurt.', { scale: 0.9, features: ['club'] }),
  E('pillar-breaker', 'Pillar-breaker', 5, 'normal', 'golem', 'front', [2.0, 1.6, 1.6, 0.4, 0.6, 70], sk('e-crush:3', 'e-stomp:1'), ['construct'],
    ['#8a8a82', '#5a5a52', '#ffb347', '#44443e'], 'Hauled the great pillars once; now it takes them down.', { scale: 1.2, features: ['pillar'] }),
  E('drum-master', 'Drum-master', 5, 'mini', 'orc', 'back', [6.0, 1.5, 1.2, 0.6, 0.9, 92], sk('e-warcry:3', 'e-rage:2', 'e-heavy:2', 'e-howl:1'), ['orc'],
    ['#4a5a42', '#8a2a2a', '#ffa83a', '#3a2a22'], 'Sets the beat the whole hall marches to.', { scale: 1.4, features: ['drum', 'banner'], xp: 2, gold: 2 }),
  E('spear-troll', 'Spear Troll', 5, 'mini', 'troll', 'front', [6.5, 1.8, 1.4, 0.5, 0.8, 84], sk('e-lunge:3', 'e-heavy:2', 'e-regen:2'), ['troll'],
    ['#5a6a5a', '#3a4a3a', '#ff7a3a', '#6a5a42'], 'Uses a pillar-splinter as a spear. Hits very, very hard.', { scale: 1.55, features: ['spear'], xp: 2, gold: 2 }),
  E('cave-troll', 'Cave Troll', 5, 'elite', 'troll', 'front', [9.0, 1.9, 1.5, 0.5, 0.9, 80], sk('e-crush:3', 'e-regen:2', 'e-stomp:2', 'e-spawn-whelp:1'), ['troll'],
    ['#5a6a62', '#38483f', '#ffd24a', '#5a4632'], 'A chained brute dragged from the deeps, and now unchained.', { scale: 1.75, features: ['club', 'chain'], xp: 3, gold: 3 }),
  E('cave-troll-chieftain', 'Cave Troll Chieftain', 5, 'boss', 'troll', 'front', [28, 2.0, 1.6, 0.8, 1.0, 80], sk('e-swipe:2', 'b-chief-drums:2', 'b-chief-club:3', 'b-chief-roar:2'), ['troll', 'boss'],
    ['#4e5e56', '#2e3e36', '#ff6a3a', '#6a5a42'], 'The hall’s master, and the hall’s drummer. He is very, very hard to ignore.',
    { scale: 2.1, features: ['club', 'crown', 'chain'], xp: 10, gold: 10, weakness: 'Burst him before the drums stack.', phases: [
      { hpBelow: 0.55, announce: 'The Chieftain roars — his kin answer!', effects: [{ k: 'summon', enemy: 'troll-whelp', count: 2 }], statPct: { atk: 15 } },
      { hpBelow: 0.25, announce: 'The Chieftain is blind with rage!', effects: [{ k: 'status', id: 'enrage', turns: 99, power: 12, on: 'self' }] },
    ] }),

  // ============================================================ Chapter 6 — The Flooded Deeps
  E('deep-lurker', 'Deep Lurker', 6, 'normal', 'serpent', 'front', [1.2, 1.3, 0.8, 0.5, 0.8, 100], sk('e-venom:3', 'e-lunge:1'), ['water', 'beast'],
    ['#3e5a5a', '#24403f', '#d8ff7a', '#1a2a2a'], 'Waits where the path meets the water.', { features: ['fins'] }),
  E('mire-spitter', 'Mire Spitter', 6, 'normal', 'serpent', 'back', [0.8, 0.5, 0.6, 1.2, 0.9, 102], sk('e-spit:3', 'e-curse:1'), ['water'],
    ['#566a3a', '#384a24', '#e0ff7a', '#222e18'], 'Spits a foul green sludge that does not wash out.', { scale: 0.9, features: ['frill'] }),
  E('drowned-dead', 'Drowned Dead', 6, 'normal', 'guardian', 'front', [1.8, 1.2, 1.0, 0.5, 0.8, 82], sk('e-strike:3', 'e-drain:1'), ['undead', 'water'],
    ['#4a6a6a', '#2e4a4a', '#9fffe8', '#36484a'], 'They walked in and never walked out.', { features: ['helm', 'weeds'] }),
  E('tentacle-spawn', 'Tentacle Spawn', 6, 'normal', 'horror', 'front', [1.0, 1.2, 0.7, 0.5, 0.7, 98], sk('e-swipe:3', 'e-poisondart:1'), ['water', 'beast'],
    ['#4a3a5a', '#7a3a7a', '#ffd24a', '#2a1e3a'], 'A loose limb of something much bigger.', { scale: 0.9, features: ['tentacles'] }),
  E('pale-eel', 'Pale Eel', 6, 'mini', 'serpent', 'front', [5.5, 1.6, 1.0, 0.8, 0.9, 108], sk('e-venom:3', 'e-lunge:2', 'e-web:1'), ['water', 'beast'],
    ['#b8c8c0', '#7a8a82', '#ff3a5a', '#5a6a62'], 'White as cave-pearl, blind and furious.', { scale: 1.5, features: ['fins', 'fangs'], xp: 2, gold: 2 }),
  E('bog-witch', 'Bog Witch', 6, 'mini', 'wraith', 'back', [4.0, 0.6, 0.7, 1.6, 1.2, 104], sk('e-curse:3', 'e-spit:2', 'e-mend:2', 'e-drain:1'), ['water', 'shadow'],
    ['#4a6a4a', '#2a3a2a', '#e0ff7a', '#1a2a1a'], 'Lives on the mud-banks and feeds on the lost.', { scale: 1.2, features: ['hood', 'weeds'], xp: 2, gold: 2 }),
  E('bog-behemoth', 'Bog Behemoth', 6, 'elite', 'horror', 'front', [10, 1.7, 1.2, 0.8, 1.0, 84], sk('e-crush:3', 'e-spit:2', 'e-regen:2'), ['water', 'beast'],
    ['#3a4a3a', '#1e2e1e', '#e0ff7a', '#2a3a2a'], 'A heap of mud with teeth. It does not stop to think.', { scale: 1.7, features: ['tentacles', 'fangs'], xp: 3, gold: 3 }),
  E('deepwater-horror', 'The Deepwater Horror', 6, 'boss', 'horror', 'front', [32, 1.9, 1.4, 1.2, 1.2, 86], sk('e-swipe:2', 'b-horror-tentacles:3', 'b-horror-submerge:2', 'b-horror-venom:2', 'b-horror-grasp:2'), ['water', 'boss'],
    ['#2e2a52', '#6a3a8a', '#ffe05a', '#1a1636'], 'Something enormous lives beneath the lake of the lower deeps. It has been waiting a very long time.',
    { scale: 2.3, features: ['tentacles', 'eyes', 'fangs'], xp: 11, gold: 11, weakness: 'It cannot be hit while submerged — spend that turn healing.', phases: [
      { hpBelow: 0.5, announce: 'The water boils — spawn burst from the deep!', effects: [{ k: 'summon', enemy: 'tentacle-spawn', count: 2 }] },
      { hpBelow: 0.25, announce: 'The Horror thrashes in agony!', effects: [], statPct: { atk: 25 } },
    ] }),

  // ============================================================ Chapter 7 — The Shadow Archives
  E('cursed-scribe', 'Cursed Scribe', 7, 'normal', 'wraith', 'back', [0.9, 0.4, 0.5, 1.4, 1.1, 102], sk('e-bolt:3', 'e-curse:2', 'e-seal:1'), ['shadow', 'undead'],
    ['#6a6a88', '#3a3a58', '#c8d8ff', '#26263a'], 'Still copying, long after the ink ran dry.', { features: ['hood', 'quill'] }),
  E('tome-guardian', 'Tome Guardian', 7, 'normal', 'golem', 'front', [2.2, 1.4, 1.8, 0.4, 1.4, 70], sk('e-strike:3', 'e-bash:1', 'e-harden:1'), ['construct'],
    ['#7a6a52', '#4a3e2e', '#ffd24a', '#3a2e22'], 'A shelf that learned to walk and to hold a grudge.', { features: ['book', 'rivets'] }),
  E('ink-wisp', 'Ink Wisp', 7, 'normal', 'wisp', 'back', [0.7, 0.3, 0.4, 1.3, 1.0, 112], sk('e-bolt:3', 'e-blind:2'), ['shadow'],
    ['#2a2a4a', '#5a4a9a', '#e0d8ff', '#14142a'], 'A drop of spilled darkness with an opinion.', { eva: 15, features: ['trail'] }),
  E('dust-revenant', 'Dust Revenant', 7, 'normal', 'guardian', 'front', [1.7, 1.5, 1.1, 0.5, 0.9, 88], sk('e-strike:3', 'e-drain:1', 'e-fear:1'), ['undead', 'shadow'],
    ['#9a9482', '#6a6454', '#a8ffe0', '#4a4636'], 'The archive’s last keeper — or what dust makes of one.', { features: ['robe', 'helm'] }),
  E('archivist-shade', 'Archivist Shade', 7, 'mini', 'wraith', 'back', [6.0, 0.6, 0.8, 1.7, 1.4, 102], sk('e-seal:3', 'e-curse:2', 'e-mend:2', 'e-drain:2'), ['shadow', 'undead'],
    ['#5a5a80', '#2a2a50', '#e0e8ff', '#1a1a34'], 'Reads the names of the fallen aloud. They come when called.', { scale: 1.4, features: ['hood', 'quill', 'scroll'], xp: 2, gold: 2 }),
  E('iron-librarian', 'Iron Librarian', 7, 'mini', 'golem', 'front', [7.0, 1.7, 1.9, 0.5, 1.5, 72], sk('e-shatter:3', 'e-crush:2', 'e-harden:2'), ['construct'],
    ['#6a7078', '#3a4048', '#ffd24a', '#44484e'], 'Its catalogue contains exactly one entry: Intruder.', { scale: 1.45, features: ['book', 'rivets'], xp: 2, gold: 2 }),
  E('scriptorium-lord', 'Scriptorium Lord', 7, 'elite', 'wraith', 'front', [11, 1.7, 1.3, 1.6, 1.4, 96], sk('e-curse:3', 'e-seal:2', 'e-drain:2', 'e-fear:2'), ['shadow', 'undead'],
    ['#4a4a78', '#8a6aca', '#e8f0ff', '#222244'], 'Wears a chain of keys to rooms that no longer exist.', { scale: 1.6, features: ['hood', 'keys', 'scroll'], xp: 3, gold: 3 }),
  E('keeper-of-records', 'The Keeper of Records', 7, 'boss', 'wraith', 'back', [35, 1.1, 1.3, 2.3, 1.6, 90], sk('e-bolt:2', 'b-keeper-pages:3', 'b-keeper-curse:3', 'b-keeper-summon:2'), ['shadow', 'undead', 'boss'],
    ['#4a4a78', '#a88aea', '#f0f4ff', '#1e1e3a'], 'It keeps the ledger of every soul that ever came down. Yours is already open.',
    { scale: 2.1, features: ['hood', 'book', 'quill', 'crown'], xp: 11, gold: 11, weakness: 'Vulnerable to Light.', phases: [
      { hpBelow: 0.6, announce: 'The Keeper opens the Book of Ruin!', effects: [], statPct: { mag: 20 } },
      { hpBelow: 0.3, announce: 'Pages tear loose and swirl in a gale!', effects: [{ k: 'status', id: 'haste', turns: 99, power: 25, on: 'self' }] },
    ] }),

  // ============================================================ Chapter 8 — The Black Chasm
  E('chasm-wraith', 'Chasm Wraith', 8, 'normal', 'wraith', 'back', [1.2, 0.5, 0.6, 1.5, 1.2, 108], sk('e-bolt:3', 'e-fear:1', 'e-drain:1'), ['shadow', 'undead'],
    ['#38384e', '#1c1c2e', '#e0f0ff', '#12121e'], 'A cold shape that clings to the edge of the dark.', { eva: 20, features: ['hood', 'trail'] }),
  E('shade-crawler', 'Shade Crawler', 8, 'normal', 'spider', 'front', [1.1, 1.6, 0.7, 0.5, 0.8, 112], sk('e-venom:2', 'e-leap:2', 'e-web:1'), ['shadow', 'beast'],
    ['#26242e', '#5a3a7a', '#ff4a8a', '#16141a'], 'Skitters down the sheer walls of the chasm.', { features: ['legs'] }),
  E('gloom-bat', 'Gloom Bat', 8, 'normal', 'bat', 'back', [0.8, 1.5, 0.5, 0.4, 0.5, 130], sk('e-bite:3', 'e-screech:1'), ['shadow', 'flying'],
    ['#26263a', '#4a3a7a', '#ff6a9a', '#14141e'], 'Faster than a thought, quieter than a held breath.', { eva: 25, features: ['wings'] }),
  E('void-stalker', 'Void Stalker', 8, 'normal', 'shade', 'front', [1.5, 1.8, 0.9, 0.7, 0.9, 114], sk('e-lunge:3', 'e-fear:1'), ['shadow'],
    ['#1e1e2e', '#4a2a6a', '#ff3a6a', '#0e0e18'], 'A hole in the dark that has learned to hunt.', { scale: 1.1, features: ['claws'] }),
  E('bridge-breaker', 'Bridge-breaker', 8, 'mini', 'golem', 'front', [7.5, 1.9, 1.7, 0.5, 1.0, 74], sk('e-crush:3', 'e-stomp:2', 'e-shatter:2'), ['construct'],
    ['#5a5a66', '#3a3a46', '#ffb347', '#34343e'], 'Built to bring down spans. It is extremely good at that.', { scale: 1.5, features: ['hammer', 'rivets'], xp: 2, gold: 2 }),
  E('night-weaver', 'Night Weaver', 8, 'mini', 'spider', 'back', [6.0, 1.7, 0.9, 0.8, 1.0, 110], sk('e-web:3', 'e-venom:3', 'e-leap:2', 'e-curse:1'), ['shadow', 'beast'],
    ['#1e1a28', '#7a3a9a', '#ff4a9a', '#100e18'], 'Spins strands of nothing across the whole chasm.', { scale: 1.5, features: ['legs'], xp: 2, gold: 2 }),
  E('abyss-lurker', 'Abyss Lurker', 8, 'elite', 'shade', 'front', [12, 2.0, 1.2, 1.0, 1.2, 108], sk('e-lunge:3', 'e-fear:2', 'e-drain:2'), ['shadow'],
    ['#14141e', '#5a2a7a', '#ff3a7a', '#0a0a12'], 'It has been falling for centuries and has grown used to it.', { scale: 1.6, features: ['claws', 'eyes'], xp: 3, gold: 3 }),
  E('chasm-stalker', 'The Chasm Stalker', 8, 'boss', 'shade', 'front', [38, 2.2, 1.5, 1.2, 1.4, 106], sk('e-lunge:2', 'b-stalker-ambush:3', 'b-stalker-cloak:2', 'b-stalker-dread:2'), ['shadow', 'boss'],
    ['#0e0e18', '#6a2a9a', '#ff2a6a', '#06060c'], 'No one has seen it twice. Nobody who has seen it once will say what it was.',
    { scale: 2.1, features: ['claws', 'eyes', 'horns'], xp: 12, gold: 12, weakness: 'Vulnerable to Light; keep the weakest in the back row.', phases: [
      { hpBelow: 0.55, announce: 'The Stalker splits into shadow — and lunges!', effects: [{ k: 'status', id: 'haste', turns: 99, power: 25, on: 'self' }], statPct: { atk: 15 } },
    ] }),

  // ============================================================ Chapter 9 — The Chamber of Flame
  E('ember-wisp', 'Ember Wisp', 9, 'normal', 'wisp', 'back', [0.8, 0.3, 0.4, 1.6, 1.0, 114], sk('e-flame:3', 'e-firewave:1'), ['fire'],
    ['#ff8a2a', '#c8421a', '#fff2a8', '#5a1a0a'], 'A spark that remembered it was fire.', { eva: 12, features: ['trail'] }),
  E('flame-imp', 'Flame Imp', 9, 'normal', 'fiend', 'front', [1.2, 1.5, 0.8, 1.0, 0.8, 114], sk('e-flame:2', 'e-lunge:2', 'e-fireball:1'), ['fire'],
    ['#c8421a', '#7a1a0a', '#ffe05a', '#3a0a04'], 'A small devil with a large temper.', { features: ['horns', 'tail'] }),
  E('ashen-brute', 'Ashen Brute', 9, 'normal', 'orc', 'front', [3.0, 1.8, 1.8, 0.4, 0.8, 84], sk('e-crush:2', 'e-smoulder:1', 'e-strike:3'), ['fire', 'orc'],
    ['#5a4a42', '#c8421a', '#ffb347', '#34302c'], 'Charred black and barely alive. It fights as though it can feel nothing.', { scale: 1.2, features: ['plate', 'hammer'] }),
  E('magma-drake', 'Magma Drake', 9, 'normal', 'drake', 'back', [2.2, 1.9, 1.3, 1.7, 1.2, 100], sk('e-bite:3', 'e-fireball:2', 'e-firewave:1'), ['fire', 'beast'],
    ['#7a2a1a', '#ff7a2a', '#ffe05a', '#2a0a06'], 'A young drake that has taken to the warm stone.', { scale: 1.2, features: ['wings', 'horns', 'tail'] }),
  E('cinder-knight', 'Cinder Knight', 9, 'mini', 'orc', 'front', [8.5, 2.0, 1.9, 0.6, 1.0, 88], sk('e-shatter:3', 'e-smoulder:2', 'e-heavy:2'), ['fire', 'orc'],
    ['#4a3a34', '#ff6a1a', '#ffd24a', '#2a2420'], 'Armoured in embers. The armour has long since stopped being metal.', { scale: 1.5, features: ['plate', 'helm', 'sword'], xp: 2, gold: 2 }),
  E('furnace-shaman', 'Furnace Shaman', 9, 'mini', 'fiend', 'back', [6.0, 0.7, 0.9, 2.0, 1.3, 104], sk('e-fireball:3', 'e-firewave:3', 'e-mend:2', 'e-warcry:1'), ['fire'],
    ['#9a3a1a', '#ffb347', '#fff2a8', '#3a0a04'], 'Chants to the flame. The flame, as ever, replies.', { scale: 1.3, features: ['horns', 'staff'], xp: 2, gold: 2 }),
  E('ember-wyrm', 'Ember Wyrm', 9, 'elite', 'drake', 'front', [14, 2.2, 1.5, 1.8, 1.2, 98], sk('e-bite:3', 'e-fireball:2', 'e-firewave:2', 'e-regen:1'), ['fire', 'beast'],
    ['#6a1a0e', '#ff8a2a', '#fff2a8', '#220804'], 'A wyrm of the old fires. The stone beneath it glows.', { scale: 1.8, features: ['wings', 'horns', 'tail'], xp: 3, gold: 3 }),
  E('flame-herald', 'The Flame Herald', 9, 'boss', 'fiend', 'back', [42, 1.4, 1.5, 2.6, 1.6, 98], sk('e-flame:2', 'b-herald-wave:3', 'b-herald-lance:3', 'e-spawn-wisp:2'), ['fire', 'boss'],
    ['#c8421a', '#ffd24a', '#fff8d0', '#3a0a04'], 'Heralds the awakening of the deep fire, and is delighted to be early.',
    { scale: 2.1, features: ['horns', 'wings', 'crown'], xp: 12, gold: 12, weakness: 'It will rise once from the ashes — hold something back.', phases: [
      { hpBelow: 0.7, announce: 'The Herald’s wings blaze open!', effects: [{ k: 'summon', enemy: 'ember-wisp', count: 1 }] },
      { hpBelow: 0.25, announce: 'The Herald bursts into a final blaze — and rises from its own ash!', effects: [{ k: 'healPct', pct: 25 }, { k: 'status', id: 'rally', turns: 99, power: 25, on: 'self' }] },
    ] }),

  // ============================================================ Chapter 10 — The Bridge of Khazad-dûm
  E('bridge-guard', 'Bridge Guard', 10, 'normal', 'warden', 'front', [3.0, 1.9, 2.0, 0.6, 1.2, 86], sk('e-strike:3', 'e-bash:2', 'e-harden:1'), ['construct'],
    ['#6a7078', '#3a4048', '#ffb347', '#44484e'], 'A stone knight that has stood on the span since the span was new.', { scale: 1.2, features: ['helm', 'shield'] }),
  E('shadow-knight', 'Shadow Knight', 10, 'normal', 'guardian', 'front', [2.5, 2.2, 1.6, 0.8, 1.2, 100], sk('e-lunge:3', 'e-shatter:2', 'e-fear:1'), ['shadow', 'undead'],
    ['#26263a', '#5a3a8a', '#ff4a7a', '#14141e'], 'A knight of nothing, armoured in the dark itself.', { features: ['helm', 'sword', 'cape'] }),
  E('flame-hound', 'Flame Hound', 10, 'normal', 'warg', 'front', [1.8, 2.0, 1.0, 0.8, 0.9, 122], sk('e-bite:3', 'e-leap:2', 'e-flame:1'), ['fire', 'beast'],
    ['#4a2a22', '#ff6a1a', '#ffe05a', '#1e100c'], 'Runs ahead of the fire, and sometimes in it.', { scale: 1.1, features: ['ember'] }),
  E('hollow-captain', 'Hollow Captain', 10, 'normal', 'guardian', 'front', [3.4, 1.8, 1.7, 0.8, 1.3, 90], sk('e-warcry:2', 'e-heavy:2', 'e-drain:1', 'e-strike:2'), ['undead', 'shadow'],
    ['#4a4a58', '#2a2a38', '#a8ffe0', '#1e1e2a'], 'Commands the dead as he did the living.', { scale: 1.2, features: ['helm', 'banner'] }),
  E('gatekeeper-knight', 'Gatekeeper Knight', 10, 'mini', 'warden', 'front', [10, 2.1, 2.1, 0.7, 1.3, 88], sk('e-shatter:3', 'e-harden:2', 'e-heavy:2', 'e-bash:2'), ['construct'],
    ['#5a6068', '#2e343c', '#ffb347', '#363c44'], 'The last of the bridge’s old garrison. He knows his duty. He insists on it.', { scale: 1.5, features: ['helm', 'shield', 'sword'], xp: 2, gold: 2 }),
  E('ash-priest', 'Ash Priest', 10, 'mini', 'fiend', 'back', [8.0, 0.8, 1.0, 2.3, 1.5, 104], sk('e-firewave:3', 'e-fireball:2', 'e-mend:3', 'e-curse:1'), ['fire', 'shadow'],
    ['#4a3a34', '#ff7a2a', '#ffe05a', '#1e1410'], 'Preaches the coming of the deep fire. Congregation: any.', { scale: 1.35, features: ['hood', 'staff', 'horns'], xp: 2, gold: 2 }),
  E('dread-champion', 'Dread Champion', 10, 'elite', 'guardian', 'front', [16, 2.4, 1.9, 1.0, 1.4, 98], sk('e-lunge:3', 'e-shatter:2', 'e-fear:2', 'e-drain:2'), ['shadow', 'undead'],
    ['#1e1e2e', '#6a3aaa', '#ff3a6a', '#0e0e1a'], 'Champion of a king no one remembers. Does not tire; does not forgive.', { scale: 1.65, features: ['helm', 'sword', 'cape'], xp: 3, gold: 3 }),
  E('balrog', 'The Balrog', 10, 'boss', 'balrog', 'front', [55, 2.4, 1.8, 2.2, 1.5, 90], sk('e-swipe:2', 'b-balrog-whip:3', 'b-balrog-flame:3', 'b-balrog-blade:3', 'b-balrog-shadow:2'), ['fire', 'shadow', 'boss'],
    ['#2a1a22', '#ff5a1a', '#ffe05a', '#14080c'], 'A shadow, in the form of a man, wreathed in flame. It has waited on the bridge for a very long time.',
    { scale: 2.6, features: ['wings', 'horns', 'whip', 'blade'], xp: 20, gold: 20, weakness: 'Burst it as the bridge crumbles. Keep a healer alive.', phases: [
      { hpBelow: 0.75, announce: 'Shadow and flame — the Balrog spreads its wings!', effects: [], statPct: { atk: 10 }, addSkills: sk('b-balrog-rise:2') },
      { hpBelow: 0.5, announce: 'The bridge cracks beneath its weight!', effects: [{ k: 'status', id: 'enrage', turns: 99, power: 8, on: 'self' }], statPct: { spd: 10 } },
      { hpBelow: 0.25, announce: 'Fury unbound — the Balrog blazes white!', effects: [], statPct: { atk: 25, spd: 20 } },
    ] }),
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(list.map((e) => [e.id, e]));
export const ENEMY_LIST: EnemyDef[] = list;
