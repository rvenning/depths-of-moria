import type { EnemyDef } from '../content/schema.ts';
import { creatureCanvases } from './pixel/creatureSprites.ts';

/** native pixel width of an enemy sprite whose art scale is 1 (the 256-unit drawings are rendered at a third of that) */
export const CREATURE_PIX = 85;

const cache = new Map<string, { color: HTMLCanvasElement; normal: HTMLCanvasElement }>();
function built(def: EnemyDef): { color: HTMLCanvasElement; normal: HTMLCanvasElement } {
  let c = cache.get(def.id);
  if (!c) {
    // a bigger monster is a bigger native sprite, so every pixel stays the same size on screen
    const n = Math.round(CREATURE_PIX * (def.scale ?? 1) * (def.tier === 'boss' ? 1.05 : 1));
    c = creatureCanvases(def, n); cache.set(def.id, c);
  }
  return c;
}
/** the creature as pixel art, drawn by the pixel engine (see pixel/creatureSprites.ts) */
export function paintCreature(def: EnemyDef): HTMLCanvasElement { return built(def).color; }
/** its normal map, for the battle scene's dynamic lights */
export function paintCreatureNormal(def: EnemyDef): HTMLCanvasElement { return built(def).normal; }
/** where the soles sit, as a fraction of the sprite height */
export const CREATURE_FOOT = 238 / 256;
