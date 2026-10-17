import type { CampUpgradeDef } from './schema.ts';

const U = (u: CampUpgradeDef): CampUpgradeDef => u;

export const CAMP_UPGRADES: CampUpgradeDef[] = [
  // ---- gold, reset each Age ("within a chapter")
    U({ id: 'whetstone', name: 'Whetstone Bench', desc: 'Sharper blades and brighter spells for everyone. Costs climb steeply.', kind: 'age', maxLevel: 40, baseCost: 200, growth: 1.16, perLevel: 1.5, unit: '% Attack and Magic' }),
    U({ id: 'bulwark', name: 'Bulwark Racks', desc: 'Thicker padding, tougher hides. Costs climb steeply.', kind: 'age', maxLevel: 40, baseCost: 200, growth: 1.16, perLevel: 1.5, unit: '% Health and Defence' }),
    U({ id: 'infirmary', name: 'Infirmary Tent', desc: 'Heroes recover more health between floors.', kind: 'age', maxLevel: 20, baseCost: 260, growth: 1.2, perLevel: 3, unit: '% extra healing between floors' }),
    U({ id: 'yard', name: 'Training Yard', desc: 'More experience from every battle.', kind: 'age', maxLevel: 25, baseCost: 300, growth: 1.18, perLevel: 3, unit: '% experience' }),
    U({ id: 'scouts', name: 'Scout Network', desc: 'Scouts find better treasure and raid caches.', kind: 'age', maxLevel: 25, baseCost: 360, growth: 1.18, perLevel: 3, unit: '% gold' }),
    U({ id: 'haggler', name: 'Quartermaster’s Ledger', desc: 'Lower prices at the merchant and the forge.', kind: 'age', maxLevel: 8, baseCost: 400, growth: 1.4, perLevel: 3, unit: '% cheaper' }),
  U({ id: 'larder', name: 'Camp Larder', desc: 'Carry more supplies on each expedition.', kind: 'age', maxLevel: 5, baseCost: 250, growth: 1.5, perLevel: 1, unit: ' extra supplies carried' }),
  // ---- renown, permanent ("key account upgrades")
  U({ id: 'sorting', name: 'Loot Sorting', desc: 'Sort and filter the armoury by slot, rarity, set and power.', kind: 'account', maxLevel: 1, baseCost: 2, growth: 1, perLevel: 1, unit: '' }),
  U({ id: 'autosalvage', name: 'Auto-salvage', desc: 'Automatically salvage drops at or below a rarity you choose.', kind: 'account', maxLevel: 1, baseCost: 4, growth: 1, perLevel: 1, unit: '' }),
  U({ id: 'presets', name: 'Saved Companies', desc: 'Save party compositions and formations for quick recall.', kind: 'account', maxLevel: 4, baseCost: 3, growth: 1.6, perLevel: 1, unit: ' saved company slots' }),
  U({ id: 'traversal', name: 'Accelerated Traversal', desc: 'Skip floors far below your strength: they resolve instantly at reduced rewards.', kind: 'account', maxLevel: 1, baseCost: 6, growth: 1, perLevel: 1, unit: '' }),
  U({ id: 'quartermaster', name: 'Seasoned Quartermaster', desc: 'Start each Age with a purse of gold.', kind: 'account', maxLevel: 6, baseCost: 5, growth: 1.5, perLevel: 1, unit: ' purse tier' }),
  U({ id: 'heirloom', name: 'Heirloom Chest', desc: 'Keep this many extra non-legendary items when an Age ends.', kind: 'account', maxLevel: 4, baseCost: 8, growth: 1.7, perLevel: 1, unit: ' heirlooms' }),
  U({ id: 'veterans', name: 'Veteran’s Lore', desc: 'Permanent experience bonus.', kind: 'account', maxLevel: 6, baseCost: 6, growth: 1.5, perLevel: 3, unit: '% experience' }),
  U({ id: 'fieldcraft', name: 'Fieldcraft', desc: 'Permanent bonus to health recovered at checkpoints.', kind: 'account', maxLevel: 5, baseCost: 6, growth: 1.5, perLevel: 5, unit: '% bonus checkpoint healing' }),
];
export const CAMP: Record<string, CampUpgradeDef> = Object.fromEntries(CAMP_UPGRADES.map((u) => [u.id, u]));

export const upgradeCost = (u: CampUpgradeDef, level: number): number => Math.round(u.baseCost * Math.pow(u.growth, level) * (u.kind === 'age' ? 1 : 1));
