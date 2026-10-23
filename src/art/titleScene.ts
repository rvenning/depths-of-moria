import type { HeroId } from '../content/schema.ts';
import { PIX, compositeBackground, paintBackground } from './backgrounds.ts';
import { ditherLight } from './camp.ts';
import { HERO_FOOT, HERO_H, HERO_W } from './heroes.ts';
import { heroFrame } from './pixel/heroSprites.ts';
import { ctx2d } from './draw.ts';

/** the company at the gate: breathing heroes, torches that flicker on the stone, embers rising. Returns a stop function. */
export function animateTitle(cv: HTMLCanvasElement, chapter: number, reduced: boolean): () => void {
  cv.width = 960; cv.height = 480;
  const ctx = ctx2d(cv); ctx.imageSmoothingEnabled = false;
  const base = compositeBackground(chapter, 'arena', 960, 480);
  const lights = paintBackground(chapter, 'arena').lights.map((l) => ({ x: Math.round(l.x / PIX) * PIX, y: Math.round(l.y / PIX) * PIX, r: Math.max(24, Math.round(l.r / PIX / 2.4)), glow: ditherLight(Math.max(24, Math.round(l.r / PIX / 2.4)), l.color), flick: 0.6 + Math.random() * 1.2, ph: Math.random() * 100 }));
  const company: [HeroId, number, number, number][] = [['gandalf', 78, 452, 0], ['aragorn', 168, 466, 650], ['legolas', 748, 452, 1300], ['gimli', 672, 466, 1900], ['frodo', 770, 476, 400]];
  const embers: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  const t0 = performance.now();
  const frame = (): void => {
    const t = reduced ? 0 : performance.now() - t0;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.drawImage(base, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      ctx.globalAlpha = reduced ? 0.22 : 0.2 + 0.07 * Math.sin(t / (110 / l.flick) + l.ph) + 0.04 * Math.sin(t / 37 + l.ph);
      ctx.drawImage(l.glow, l.x - (l.glow.width * PIX) / 2, l.y - (l.glow.height * PIX) / 2, l.glow.width * PIX, l.glow.height * PIX);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (const [id, x, y, ph] of company) ctx.drawImage(heroFrame(id, 'idle', reduced ? 0 : Math.floor((t + ph) / 260) % 4).color, x, y - HERO_FOOT * PIX, HERO_W * PIX, HERO_H * PIX);
    if (!reduced) {
      for (const l of lights) if (Math.random() < 0.06) embers.push({ x: l.x + (Math.random() - 0.5) * 20, y: l.y - 4, vx: (Math.random() - 0.5) * 0.5, vy: -(0.6 + Math.random() * 1.3), life: 1 });
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i]; e.x += e.vx + Math.sin(e.y / 17) * 0.2; e.y += e.vy; e.life -= 0.008;
        if (e.life <= 0) { embers.splice(i, 1); continue; }
        ctx.globalAlpha = e.life; ctx.fillStyle = e.life > 0.55 ? '#ffe08a' : '#ff8a2e'; ctx.fillRect(Math.round(e.x / PIX) * PIX, Math.round(e.y / PIX) * PIX, PIX, PIX);
      }
      ctx.globalAlpha = 1;
    }
  };
  frame();
  if (reduced) return () => undefined;
  const id = window.setInterval(frame, 80);
  return () => window.clearInterval(id);
}
