import { describe, expect, it } from 'vitest';
import { Sprite, def } from '../src/art/pixel/engine.ts';
import { HERO_FOOT, HERO_H, HERO_W, heroImage } from '../src/art/pixel/heroSprites.ts';
import { HERO_LIST } from '../src/content/heroes.ts';

const colors = (rgba: Uint8ClampedArray): Set<number> => {
  const s = new Set<number>();
  for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3]) s.add((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]);
  return s;
};

describe('the pixel engine', () => {
  it('is deterministic and draws only fully opaque or fully empty pixels', () => {
    def('t-mat', '#7a5230');
    const make = (): Uint8ClampedArray => new Sprite(24, 24).ell(12, 12, 8, 8, 't-mat').finish().rgba;
    const a = make(), b = make();
    expect(Array.from(a)).toEqual(Array.from(b));
    for (let i = 3; i < a.length; i += 4) expect([0, 255]).toContain(a[i]);
  });

  it('outlines a shape: the outer ring is darker than anything inside it', () => {
    def('t-mat', '#c0a060');
    const img = new Sprite(24, 24).ell(12, 12, 7, 7, 't-mat').finish();
    const lum = (x: number, y: number): number => { const i = (y * 24 + x) * 4; return img.rgba[i] + img.rgba[i + 1] + img.rgba[i + 2]; };
    expect(img.rgba[(12 * 24 + 4) * 4 + 3]).toBe(255); // left edge of the ring is painted
    expect(lum(4, 12)).toBeLessThan(lum(12, 12));
  });
});

describe('the hero sprites', () => {
  for (const h of HERO_LIST) {
    it(`${h.id} fits its canvas, stands on the foot line and uses a small palette`, () => {
      const img = heroImage(h.id);
      expect(img.w).toBe(HERO_W); expect(img.h).toBe(HERO_H);
      let opaque = 0, lowest = 0;
      for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.rgba[(y * img.w + x) * 4 + 3]) { opaque++; lowest = Math.max(lowest, y); }
      expect(opaque).toBeGreaterThan(1200);
      expect(opaque).toBeLessThan(img.w * img.h * 0.7);
      expect(lowest).toBeGreaterThanOrEqual(HERO_FOOT - 4);
      expect(lowest).toBeLessThanOrEqual(HERO_H - 1);
      expect(colors(img.rgba).size).toBeLessThan(120);
    });
  }
  it('each hero is drawn differently', () => {
    const sigs = new Set(HERO_LIST.map((h) => Array.from(heroImage(h.id).rgba).join(',').length + ':' + [...colors(heroImage(h.id).rgba)].slice(0, 8).join('.')));
    expect(sigs.size).toBe(HERO_LIST.length);
  });
});
