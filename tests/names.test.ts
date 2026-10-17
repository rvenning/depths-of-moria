import { afterAll, describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, QUESTS } from '../src/content/meta.ts';
import { BONDS } from '../src/content/bonds.ts';
import { CHAPTERS } from '../src/content/chapters.ts';
import { ENEMIES } from '../src/content/enemies.ts';
import { EVENTS } from '../src/content/events.ts';
import { HEROES, PASSIVES } from '../src/content/heroes.ts';
import { ITEMS, SETS } from '../src/content/items.ts';
import { LORE } from '../src/content/lore.ts';
import { RELICS } from '../src/content/relics.ts';
import { RESTRICTED, applyNaming, setNaming, t } from '../src/ui/names.ts';

const everything = () => JSON.stringify({ HEROES, PASSIVES, ENEMIES, ITEMS, SETS, CHAPTERS, RELICS, EVENTS, LORE, BONDS, QUESTS, ACHIEVEMENTS });

describe('the original reskin', () => {
  afterAll(() => setNaming('fan'));
  it('the fan build does contain restricted names (so the test below is meaningful)', () => {
    setNaming('fan');
    expect(RESTRICTED.test(everything())).toBe(true);
    expect(HEROES.aragorn.name).toBe('Aragorn');
  });
  it('removes every restricted term from every content table, and is fully reversible', () => {
    setNaming('original');
    const text = everything();
    const hit = text.match(RESTRICTED);
    expect(hit, `leaked: ${hit?.[0]} … ${hit ? text.slice(Math.max(0, hit.index! - 40), hit.index! + 40) : ''}`).toBeNull();
    expect(HEROES.aragorn.name).toBe('Arvane');
    expect(RELICS.light.name).toBe('Star-Phial');
    expect(CHAPTERS[9].name).toBe('The Deepmine Span');
    expect(ENEMIES.balrog.name).toBe('The Ember Tyrant');
    expect(t('Gandalf enters Moria')).toBe('Eldrin enters the Deepmine');
    setNaming('fan');
    expect(HEROES.aragorn.name).toBe('Aragorn');
    expect(RELICS.light.name).toBe('Light of Eärendil');
    expect(everything()).toContain('Balrog');
  });
  it('never touches ids, so saves are unaffected', () => {
    applyNaming('original');
    expect(HEROES.aragorn.id).toBe('aragorn'); expect(Object.keys(BONDS)).toContain('aragorn+gimli'); expect(ENEMIES.balrog.id).toBe('balrog');
    expect(ITEMS['gatewatch-blade'].id).toBe('gatewatch-blade');
    applyNaming('fan');
  });
});
