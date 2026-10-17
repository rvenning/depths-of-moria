import type { RelicDef, RelicId } from './schema.ts';

const R = (r: RelicDef): RelicDef => r;

export const RELICS: Record<RelicId, RelicDef> = {
  light: R({
    id: 'light', name: 'Light of Eärendil', effectLabel: 'Max Health', stat: 'hp', perLevel: 1.6, afterSoft: 0.5, softCap: 20, maxLevel: 80,
    costBase: 10, costGrowth: 1.2,
    desc: 'A bottled star. The whole party is sturdier for carrying it.',
    lore: 'A small phial that burns with a cold, patient light. Whoever carries it finds the dark less heavy.',
  }),
  horn: R({
    id: 'horn', name: 'Horn of Gondor', effectLabel: 'Physical Attack', stat: 'atk', perLevel: 1.3, afterSoft: 0.45, softCap: 20, maxLevel: 80,
    costBase: 10, costGrowth: 1.2,
    desc: 'A cracked war-horn whose call steadies every sword in the party.',
    lore: 'Split, mended and split again. Even broken, it carries.',
  }),
  wisdom: R({
    id: 'wisdom', name: 'Wisdom of the Istari', effectLabel: 'Magic', stat: 'mag', perLevel: 1.3, afterSoft: 0.45, softCap: 20, maxLevel: 80,
    costBase: 10, costGrowth: 1.2,
    desc: 'A scroll of notes in a hand older than the halls. It sharpens every spell.',
    lore: 'The margins are more useful than the text. You will not find the author.',
  }),
  blessing: R({
    id: 'blessing', name: 'Blessing of the Valar', effectLabel: 'Healing Power', stat: 'heal', perLevel: 2.0, afterSoft: 0.6, softCap: 20, maxLevel: 80,
    costBase: 12, costGrowth: 1.2,
    desc: 'A drop of water from a spring that does not exist. All healing is stronger.',
    lore: 'A drop. Only a drop. It never gets smaller.',
  }),
  fortune: R({
    id: 'fortune', name: 'Fortune of the Shire', effectLabel: 'Gold and Loot Yield', stat: 'gold', perLevel: 1.8, afterSoft: 0.5, softCap: 20, maxLevel: 80,
    costBase: 9, costGrowth: 1.2,
    desc: 'A seed in a pouch. Wherever it goes, things grow and coins turn up.',
    lore: 'Plant it in a cellar and you will have a garden by morning. Plant it in a dungeon and you will have gold.',
  }),
  courage: R({
    id: 'courage', name: 'Courage of the Free Peoples', effectLabel: 'Party Defence', stat: 'def', perLevel: 1.1, afterSoft: 0.4, softCap: 20, maxLevel: 80,
    costBase: 12, costGrowth: 1.2,
    desc: 'A banner of many colours. No one in the party will fall back alone.',
    lore: 'Stitched from the cloaks of everyone who came before. It smells of woodsmoke.',
  }),
};
export const RELIC_IDS = Object.keys(RELICS) as RelicId[];

/** total bonus (in %) at a given level */
export function relicBonus(def: RelicDef, level: number): number {
  const a = Math.min(level, def.softCap);
  const b = Math.max(0, level - def.softCap);
  return a * def.perLevel + b * def.afterSoft;
}
/** essence to go from `level` to level+1 */
export function relicCost(def: RelicDef, level: number): number {
  const soft = def.softCap;
  if (level < soft) return Math.round(def.costBase * Math.pow(def.costGrowth, level));
  return Math.round(def.costBase * Math.pow(def.costGrowth, soft) * Math.pow(1.3, level - soft + 1));
}
