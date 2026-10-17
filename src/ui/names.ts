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
const ORIGINAL: [RegExp, string][] = [
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
  let out = text;
  for (const [re, rep] of ORIGINAL) out = out.replace(re, rep);
  return out;
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
  for (const [re, rep] of ORIGINAL) out = out.replace(re, rep);
  return out;
}

/** every restricted term the reskin is meant to remove (used by the tests) */
export const RESTRICTED = /Aragorn|Gimli|Frodo|Legolas|Boromir|Gandalf|Balrog|Moria|Khazad|Gondor|Shire|Eärendil|Istari|Valar|Fellowship|Lonely Mountain|Strider|Gamgee|Samwise|\bSam\b|White City|White Tower|Free Peoples/;
