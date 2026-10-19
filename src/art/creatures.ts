import type { EnemyDef } from '../content/schema.ts';
import { creatureCanvases, creatureImage, walkImage, WALK_STYLE } from './pixel/creatureSprites.ts';
import { toCanvas, type PixImg } from './pixel/engine.ts';

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

/** the native size an enemy is drawn at (see `built`) */
const sizeOf = (def: EnemyDef): number => Math.round(CREATURE_PIX * (def.scale ?? 1) * (def.tier === 'boss' ? 1.05 : 1));
const baseImg = new Map<string, PixImg>();
const walkCache = new Map<string, { color: HTMLCanvasElement; normal: HTMLCanvasElement }>();
/** frame `i` (0-3) of an enemy's walk cycle, with its normal map, for the battle scene's lights */
export function paintCreatureWalk(def: EnemyDef, i: number): { color: HTMLCanvasElement; normal: HTMLCanvasElement } {
  const key = `${def.id}:${i & 3}`;
  let c = walkCache.get(key);
  if (!c) {
    let img = baseImg.get(def.id);
    if (!img) { img = creatureImage(def, sizeOf(def)); baseImg.set(def.id, img); }
    const w = walkImage(img, WALK_STYLE[def.family], i);
    c = { color: toCanvas(w), normal: toCanvas(w, w.normal) }; walkCache.set(key, c);
  }
  return c;
}
