import type {
  HeroId, ItemInstance, ItemSlot, Rarity, RelicId, Row, Rule, TargetPref, StatKey, Stats,
} from '../content/schema.ts';

export const SAVE_VERSION = 2;

export interface HeroState {
  id: HeroId;
  unlocked: boolean;
  level: number;
  xp: number;
  talents: number[];           // owned node indexes
  equip: Record<ItemSlot, string | null>; // item uids
  rules: Rule[];
  pref: TargetPref;
  row: Row;
}

export interface Settings {
  master: number; music: number; sfx: number; ambience: number;
  reducedMotion: boolean; highContrast: boolean; textScale: number;
  speed: 1 | 2 | 4; showLog: boolean;
  naming: 'fan' | 'original';
  autoSalvageUpTo: Rarity | null;
  lootFilter: Rarity;          // hide drops below this in the results screen
  autoDelve: boolean;
  confirmReset: boolean;
  skipStories: boolean;
  /** battle graphics: 'hd' = HD-2D lights, bloom and depth of field; 'low' = flat pixel art; 'auto' = hd, dropping to low on a slow GPU */
  graphics: 'auto' | 'hd' | 'low';
  /** speak cutscene dialogue aloud with the browser's own voices (each hero gets their own pitch) */
  voice: boolean;
}

export interface ExpeditionBuff { stat: StatKey; pct: number; battles: number; label: string }

export type RoomKind = 'battle' | 'mini' | 'elite' | 'boss' | 'challenge' | 'event' | 'door' | 'rest' | 'vault';

export interface Expedition {
  startFloor: number;
  floor: number;               // floor currently being entered / fought
  attempt: number;             // for seeding
  room: RoomKind | null;
  phase: 'room' | 'door' | 'event' | 'result' | 'ended';
  hp: Partial<Record<HeroId, number>>;   // hp fraction per hero
  gold: number; ore: number; cloth: number; essence: number; renown: number; shards: number;
  xp: number;
  items: ItemInstance[];
  lore: string[];
  buffs: ExpeditionBuff[];
  supplies: number;
  cleared: number;             // floors cleared this expedition
  newBest: boolean;
  doorSeed: number;
  eventId: string | null;
  doorChoices: RoomKind[] | null;
  log: string[];
  party: HeroId[];             // snapshot at launch (ordered formation)
  formation: Record<string, Row>;
  endless: boolean;
  ended: null | { reason: 'retreat' | 'defeat' | 'victory'; keep: number };
}

export interface CampLevels { age: Record<string, number>; account: Record<string, number> }

export interface GameState {
  v: number;
  created: number;
  playMs: number;
  seed: number;
  settings: Settings;
  heroes: Record<HeroId, HeroState>;
  party: (HeroId | null)[];    // 5 formation slots
  presets: { name: string; party: (HeroId | null)[]; rows: Partial<Record<HeroId, Row>> }[];
  inventory: ItemInstance[];
  nextUid: number;
  gold: number; ore: number; cloth: number; essence: number; renown: number; shards: number;
  relics: Record<RelicId, number>;
  bonds: Record<string, number>;
  bondSeen: Record<string, number>;
  age: number;
  best: number;                // highest floor ever cleared (campaign)
  ageStartBest: number;
  camp: CampLevels;
  quests: Record<string, number>;      // progress snapshot at accept time
  questsClaimed: Record<string, number>;
  achievements: Record<string, number>; // id -> unlocked timestamp
  counters: Record<string, number>;
  lore: string[];
  codex: Record<string, { seen: number; kills: number }>;
  itemsSeen: string[];
  bosses: Record<string, number>;      // boss id -> times defeated
  expedition: Expedition | null;
  flags: Record<string, number | boolean | string>;
  endless: { best: number; modifiers: number };
  ladder: { cleared: number };
  shop: { seed: number; stock: ItemInstance[]; rerolls: number };
  lastSummary: BattleSummary | null;
  merchantCycle: number;
}

export interface BattleSummary {
  floor: number;
  result: 'victory' | 'defeat';
  rounds: number;
  heroes: { id: HeroId; dealt: number; healed: number; taken: number; kills: number; alive: boolean; hpFrac: number }[];
  gold: number; xp: number; essence: number;
  items: string[];
  levelUps: { id: HeroId; level: number }[];
  kills: string[];
}

export type HeroStats = Stats;
