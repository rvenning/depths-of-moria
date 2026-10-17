import type { HeroId } from '../content/schema.ts';
import { HERO_FOOT, HERO_H, HERO_W, paintHeroPixel } from './pixel/heroSprites.ts';

export { HERO_FOOT, HERO_H, HERO_W };
/** hero sprites are drawn natively at HERO_W x HERO_H pixels and shown at an integer zoom (the "pixel size") */
export function paintHero(id: HeroId): HTMLCanvasElement { return paintHeroPixel(id); }
