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

import { creatureImage } from '../src/art/pixel/creatureSprites.ts';
import { ENEMY_LIST } from '../src/content/enemies.ts';

describe('the creature sprites', () => {
  it('draws all 80 enemies as sound sprites (filled, in bounds, stood on the floor, small palette)', () => {
    expect(ENEMY_LIST.length).toBeGreaterThanOrEqual(80);
    for (const e of ENEMY_LIST) {
      const n = Math.round(85 * (e.scale ?? 1) * (e.tier === 'boss' ? 1.05 : 1));
      const img = creatureImage(e, n);
      let opaque = 0, lo = n, hi = 0, left = n, right = 0;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (img.rgba[(y * n + x) * 4 + 3]) { opaque++; lo = Math.min(lo, y); hi = Math.max(hi, y); left = Math.min(left, x); right = Math.max(right, x); }
      expect(opaque, `${e.id} is drawn`).toBeGreaterThan(n * n * 0.06);
      expect(opaque, `${e.id} does not flood its canvas`).toBeLessThan(n * n * 0.8);
      expect(hi, `${e.id} reaches towards the floor`).toBeGreaterThan(n * 0.55);
      expect(right - left, `${e.id} has width`).toBeGreaterThan(n * 0.2);
      expect(colors(img.rgba).size, `${e.id} palette`).toBeLessThan(160);
      expect(img.normal?.length, `${e.id} has a normal map`).toBe(n * n * 4);
    }
  });
});
