/** All tunable numbers live here so the balance sim can sweep them. */
export const BAL = {
  // reference unit scaling: 1 + 0.0225 * x  (x = floor / item level)
  unitSlope: 0.0225,
  refHp: 200,
  refAtk: 20,
  // defence scales with an asymptote so that 100/(100+def) stays meaningful
  defBase: 20,
  defRange: 130,
  defHalf: 400,
  // hero level growth
  levelGrowth: 0.18,
  defLevelGrowth: 0.05,
  spdLevelGrowth: 0.1,
  // enemy tuning knobs
  enemyHp: 1.0,
  enemyAtk: 1.0,
  enemyDef: 1.0,
  // per-Age enemy multipliers (calibrated by tools/calibrate.ts against the progression bot)
  ageHp: [2.6, 2.6, 2.6, 2.6, 2.6, 2.6, 2.6, 2.6, 2.6, 2.6] as number[],
  ageAtk: [5.613, 14.213, 15.375, 14.445, 22.813, 26.531, 46.984, 35.828, 18.164, 22.377] as number[],
  // HP multiplier by enemy tier (bosses are long fights, not walls) and by party size
  tierHp: { normal: 1, mini: 0.5, elite: 0.5, boss: 0.3 } as Record<string, number>,
  partyHp: [0.5, 0.5, 0.75, 1.0, 1.2, 1.4] as number[],
  // chapter-boss strength on top of the Age multiplier (fitted so the first prepared attempt is ~40% to win)
  ageBoss: [2.6, 0.6, 0.786, 0.786, 1.035, 0.195, 0.25, 0.88, 0.289, 0.227] as number[],
  // enemy difficulty ramps within a chapter and between chapters
  withinChapter: 0.2,     // +20% over the chapter's 100 floors
  perChapter: 0.0,        // extra flat per chapter (0 = floors alone drive difficulty)
  // loot / economy
  goldPerFloor: 14,
  goldFloorExp: 0.75,
  xpBase: 18,
  xpFloorExp: 1.0,
  xpFrac: 0.22,          // each normal battle grants this fraction of the XP needed at the reference level
  lrefSlope: 0.105,      // reference hero level at floor f = 1 + slope * f
  levelCapBase: 10,
  levelCapPerAge: 10,
  xpLevelBase: 60,
  xpLevelExp: 1.55,
  retreatKeep: 1.0,
  defeatKeep: 0.6,
  betweenFloorHeal: 0.2,
  checkpointEvery: 10,
  // gear
  rarityDropWeights: [60, 28, 9, 2.6, 0.4] as number[],
  // endless
  endlessGrowth: 0.005,
  maxRounds: 60,
  enrageStart: 25,
};

export const unit = (x: number): number => 1 + BAL.unitSlope * x;
export const defUnit = (x: number): number => BAL.defBase + (BAL.defRange * x) / (x + BAL.defHalf);

export const levelCap = (age: number): number => BAL.levelCapBase + BAL.levelCapPerAge * age;
export const xpToNext = (level: number): number => Math.round(BAL.xpLevelBase * Math.pow(level, BAL.xpLevelExp));

/** hero stat multiplier at a level */
export const levelMult = (level: number): number => 1 + BAL.levelGrowth * (level - 1);

/**
 * The level a well-prepared hero is expected to have at a floor. Enemies and XP both follow it, so the
 * campaign tracks the level cap: Age 1 climbs 1→20, every later Age climbs from the previous cap to the next.
 */
export function refLevel(floor: number): number {
  if (floor > 1000) return 110 + (floor - 1000) * 0.1;
  const age = Math.ceil(floor / 100);
  const ic = ((floor - 1) % 100) + 1;
  return age === 1 ? 1 + (19 * ic) / 100 : 10 * age + (10 * ic) / 100;
}
