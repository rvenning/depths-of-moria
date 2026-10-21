/**
 * Naming layer. The game ships with its fan-concept names; every display string passes through t() so that a
 * clean, rights-safe reskin ("Original") is one setting away and needs no content edits.
 * See docs/RIGHTS.md for the full list of restricted names.
 */
type Naming = 'fan' | 'original';
let mode: Naming = 'fan';
export const setNaming = (m: Naming): void => { if (m !== mode) { mode = m; applyNaming(m); } };
export const getNaming = (): Naming => mode;

import { ACHIEVEMENTS, QUESTS } from '../content/meta.ts';
import { BONDS } from '../content/bonds.ts';
import { CAMP_UPGRADES } from '../content/camp.ts';
import { CHAPTERS } from '../content/chapters.ts';
import { ENEMIES } from '../content/enemies.ts';
import { ENEMY_SKILLS } from '../content/enemySkills.ts';
import { EVENTS } from '../content/events.ts';
import { HERO_SKILLS, HEROES, PASSIVES } from '../content/heroes.ts';
import { AFFIXES, ITEMS, SETS } from '../content/items.ts';
import { LORE } from '../content/lore.ts';
import { RELICS } from '../content/relics.ts';

/** longest first so that "Khazad-dûm" wins over "Moria"-style partials */
/** a name that opens a sentence or a quotation keeps its capital */
const cap = (word: string) => (_m: string, off: number, whole: string): string => (off === 0 || /[.!?“—]\s*$/.test(whole.slice(0, off)) ? word[0].toUpperCase() + word.slice(1) : word);
const ORIGINAL: [RegExp, string | ((m: string, off: number, whole: string) => string)][] = [
  // the cast of the deep (the roster's Middle-earth names)
  [/The Watcher in the Water/g, 'The Pool-thing'], [/Watcher in the Water/g, 'Pool-thing'], [/Watcher/g, 'Pool-thing'],
  [/Azog the Defiler/g, 'Vorg the Defiler'], [/Azog/g, 'Vorg'],
  [/Bolg of Gundabad/g, 'Gorrak of the Northern Peaks'], [/Gundabad/g, 'Northern Peaks'],
  [/Grishnákh/g, 'Skarrak'], [/Gorbag/g, 'Ruzgul'], [/Gollum/g, 'Skulker'],
  [/^Shelob$/g, 'The Great Weaver'], [/Shelob’s/g, cap('the Great Weaver’s')], [/Shelob/g, cap('the Great Weaver')],
  [/The Great Goblin/g, 'The Warren-king'], [/Great Goblin/g, 'Warren-king'],
  [/Uruk-hai/g, 'Iron-orcs'], [/Uruks/g, 'Iron-orcs'], [/Uruk/g, 'Iron-orc'], [/Olog-hai/g, 'Black-troll'],
  [/Snagas/g, 'Cutters'], [/Snaga/g, 'Cutter'],
  [/Mazarbul Dead/g, 'Archive Dead'], [/Mazarbul/g, 'the Archive'],
  [/Barrow-/g, 'Grave-'], [/Ringwraith/g, 'Hollow Rider'], [/Morgul-/g, 'Gloom-'],
  [/The King of the Dead/g, 'The Pale King'], [/King of the Dead/g, 'Pale King'],
  [/Udûn/g, 'the Deepfire'], [/Durin’s Bane/g, 'the Deep Terror'],
  [/Isengard/g, 'the Ironworks'], [/Mordor/g, 'the Black Country'], [/the Red Eye/g, 'the Crimson Eye'], [/Crebain/g, 'Black Crows'],
  [/Moria Doorward/g, 'Deepmine Doorward'], [/Moria Orc Guard/g, 'Deepmine Orc Guard'],
  [/The Bridge of Khazad-dûm/g, 'The Deepmine Span'],
  [/Bridge of Khazad-dûm/g, 'Deepmine Span'],
  [/Khazad-dûm/g, 'the Deepmine'],
  [/Depths of Moria/g, 'Depths of the Deepmine'],
  [/The Fellowship/g, 'The Company'],
  [/Fellowship/g, 'Company'],
  [/Moria/g, 'the Deepmine'],
  [/Light of Eärendil/g, 'Star-Phial'],
  [/Horn of Gondor/g, 'Warhorn of the White Keep'],
  [/Wisdom of the Istari/g, 'Scroll of the Sages'],
  [/Blessing of the Valar/g, 'Dewdrop of the Elders'],
  [/Fortune of the Shire/g, 'Seed of the Green Hills'],
  [/Courage of the Free Peoples/g, 'Banner of the Free Folk'],
  [/Valor of the White City/g, 'Valor of the White Keep'],
  [/White City/g, 'White Keep'],
  [/Free Peoples/g, 'Free Folk'],
  [/Istari/g, 'Sages'],
  [/Valar/g, 'Elders'],
  [/Gondorian/g, 'Keepish'],
  [/Gondor/g, 'the White Keep'],
  [/Shire/g, 'Green Hills'],
  [/Lonely Mountain/g, 'Lone Peak'],
  [/The Balrog/g, 'The Ember Tyrant'],
  [/Balrog/g, 'Ember Tyrant'],
  [/Mr\. Gamgee/g, 'Mr. Hale'],
  [/Mr\. Frodo/g, 'Master Wren'],
  [/Strider/g, 'Ranger'],
  [/Aragorn/g, 'Arvane'],
  [/Gimli/g, 'Dorik'],
  [/Frodo/g, 'Wren'],
  [/Legolas/g, 'Sylvaen'],
  [/Boromir/g, 'Halvard'],
  [/Samwise|Sam\b/g, 'Tobin'],
  [/Gandalf/g, 'Eldrin'],
  [/Ranger of the North/g, 'Ranger of the North'],
  [/Bearer of the Burden/g, 'Keeper of the Light'],
  [/Grey Pilgrim/g, 'Grey Pilgrim'],
  [/Captain of the White Tower/g, 'Captain of the White Keep'],
  [/Gardener, Gaffer’s Son/g, 'Gardener, Cobbler’s Son'],
  [/Archer of the Wood/g, 'Archer of the Wood'],
  [/Axe of the Lonely Mountain/g, 'Axe of the Lone Peak'],
];

export function t(text: string | undefined | null): string {
  if (!text) return '';
  if (mode === 'fan') return text;
  return replaceAll(text);
}

/** names only (used for headings, aria labels etc.) */
export const nm = t;

// ------------------------------------------------------------------ data-level reskin
// Every display string in the content tables is rewritten in place (and restored from a pristine copy), so the
// whole interface — including tooltips, battle names and logs — switches without touching each screen.
const ROOTS: Record<string, unknown> = { HEROES, HERO_SKILLS, PASSIVES, ENEMIES, ENEMY_SKILLS, ITEMS, SETS, AFFIXES, CHAPTERS, RELICS, EVENTS, LORE, BONDS, QUESTS, ACHIEVEMENTS, CAMP_UPGRADES };
let pristine: Record<string, unknown> | null = null;

function walk(live: unknown, orig: unknown, fn: (s: string) => string): void {
  if (!live || typeof live !== 'object') return;
  for (const k of Object.keys(live as object)) {
    const lv = (live as Record<string, unknown>)[k];
    const ov = (orig as Record<string, unknown>)[k];
    if (typeof ov === 'string') {
      // ids stay lowercase and are never touched; only prose is
      (live as Record<string, unknown>)[k] = k === 'id' || k === 'icon' || k === 'fx' || k === 'family' ? ov : fn(ov);
    } else walk(lv, ov, fn);
  }
}

export function applyNaming(m: Naming): void {
  if (!pristine) pristine = structuredClone(ROOTS);
  const f = m === 'original' ? (s: string) => replaceAll(s) : (s: string) => s;
  for (const key of Object.keys(ROOTS)) walk(ROOTS[key], (pristine as Record<string, unknown>)[key], f);
}

function replaceAll(text: string): string {
  let out = text;
  for (const [re, rep] of ORIGINAL) out = out.replace(re, rep as string);
  return out.replace(/\b([Tt])he the\b/g, '$1he');       // "of the Moria warrens" -> "of the the Deepmine warrens" -> "of the Deepmine warrens"
}

/** every restricted term the reskin is meant to remove (used by the tests) */
export const RESTRICTED = /Aragorn|Gimli|Frodo|Legolas|Boromir|Gandalf|Balrog|Moria|Khazad|Gondor|Shire|Eärendil|Istari|Valar|Fellowship|Lonely Mountain|Strider|Gamgee|Samwise|\bSam\b|White City|White Tower|Free Peoples|Gollum|Azog|Gundabad|Grishnákh|Gorbag|Shelob|Watcher|Great Goblin|Uruk|Olog-hai|Snaga|Mazarbul|Barrow-|Ringwraith|Morgul|King of the Dead|Udûn|Durin’s Bane|Isengard|Mordor|Red Eye|Crebain/;
