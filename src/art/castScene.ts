import type { HeroId } from '../content/schema.ts';
import { PIX, compositeBackground } from './backgrounds.ts';
import { ditherLight } from './camp.ts';
import { HERO_FOOT, HERO_H, HERO_W } from './heroes.ts';
import { heroFrame } from './pixel/heroSprites.ts';
import { ctx2d } from './draw.ts';

/** where each cast member stands (left edge x, feet y in a 960x480 scene), by cast size */
function seats(n: number): [number, number][] {
  if (n <= 1) return [[408, 338]];
  if (n === 2) return [[250, 338], [566, 338]];
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) out.push([Math.round((40 + (736 / Math.max(1, n - 1)) * i) / PIX) * PIX, 328 + (i % 2) * 12]);
  return out;
}

/**
 * A stage for a conversation: the chapter's backdrop, a torch-lit glow, and the cast breathing in place. Whoever `active()`
 * names stands in the light and bobs; everyone else is dimmed. Returns a stop function.
 */
export function animateCast(cv: HTMLCanvasElement, chapter: number, cast: HeroId[], active: () => HeroId | null, reduced: boolean): () => void {
  cv.width = 960; cv.height = 480;
  const ctx = ctx2d(cv); ctx.imageSmoothingEnabled = false;
  const base = compositeBackground(chapter, 'hall', 960, 480);
  const glow = ditherLight(90, '#ffb860');
  const pos = seats(cast.length);
  const tmp = document.createElement('canvas'); tmp.width = HERO_W; tmp.height = HERO_H;
  const tx = ctx2d(tmp); tx.imageSmoothingEnabled = false;
  const t0 = performance.now();
  const frame = (): void => {
    const t = reduced ? 0 : performance.now() - t0, who = active();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.drawImage(base, 0, 0);
    cast.forEach((id, i) => {
      const [x, y] = pos[i], on = who === id || who === null;
      if (on) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = reduced ? 0.22 : 0.2 + 0.05 * Math.sin(t / 130 + i); ctx.drawImage(glow, x + (HERO_W * PIX) / 2 - glow.width * PIX / 2, y - glow.height * PIX * 0.85, glow.width * PIX, glow.height * PIX); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    });
    cast.forEach((id, i) => {
      const [x, y] = pos[i], on = who === id || who === null;
      const f = heroFrame(id, 'idle', reduced ? 0 : Math.floor((t + i * 500) / 260) % 4).color;
      tx.clearRect(0, 0, HERO_W, HERO_H); tx.globalCompositeOperation = 'source-over'; tx.drawImage(f, 0, 0);
      if (!on) { tx.globalCompositeOperation = 'source-atop'; tx.fillStyle = 'rgba(10,6,22,0.52)'; tx.fillRect(0, 0, HERO_W, HERO_H); }
      const lift = on && who !== null && !reduced ? (Math.floor(t / 260) % 2) * PIX : 0;
      ctx.drawImage(tmp, x, y - HERO_FOOT * PIX - lift, HERO_W * PIX, HERO_H * PIX);
    });
  };
  frame();
  if (reduced) return () => undefined;
  const id = window.setInterval(frame, 80);
  return () => window.clearInterval(id);
}
