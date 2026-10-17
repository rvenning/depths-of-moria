import type { HeroId } from '../content/schema.ts';
import { INK, PEN, alpha, circle, ctx2d, ellipse, glow, limb, line, makeCanvas, poly, shade, type Ctx } from './draw.ts';
import { HERO_FOOT, HERO_H, HERO_W, paintHero } from './heroes.ts';
import { PIX, paintBackgroundVector } from './backgrounds.ts';
import { pixelize } from './pixel/pixelize.ts';

export const CAMP_W = 960;
export const CAMP_H = 480;

/** hotspot anchor positions (fractions of the scene) shared with the UI */
export const CAMP_SPOTS: Record<string, { x: number; y: number }> = {
  map: { x: 0.2, y: 0.5 }, roster: { x: 0.46, y: 0.4 }, armoury: { x: 0.72, y: 0.42 }, forge: { x: 0.88, y: 0.66 },
  shrine: { x: 0.11, y: 0.7 }, journal: { x: 0.62, y: 0.8 }, quests: { x: 0.34, y: 0.8 },
};

function tent(c: Ctx, x: number, y: number, s: number, color: string): void {
  poly(c, [[x - 90 * s, y], [x, y - 120 * s], [x + 90 * s, y]], color, PEN, 0.2);
  poly(c, [[x - 24 * s, y], [x, y - 70 * s], [x + 24 * s, y]], '#0a0a0e', { lw: 2, ink: INK }, 0);
  line(c, x, y - 120 * s, x, y - 134 * s, 4, '#6a4a2c');
  poly(c, [[x, y - 134 * s], [x + 24 * s, y - 128 * s], [x, y - 120 * s]], '#c44a3a', { lw: 1.5, ink: INK }, 0.2);
}

function campfire(c: Ctx, x: number, y: number): void {
  glow(c, x, y - 20, 200, '#ff8a2a', 0.45);
  for (const a of [-0.5, 0.5, 0]) { c.save(); c.translate(x, y); c.rotate(a); limb(c, -30, 0, 30, 0, 9, 9, '#5a3a22'); c.restore(); }
  for (let i = 0; i < 7; i++) circle(c, x - 40 + i * 13, y + 4 + (i % 2) * 3, 7, '#6a6a70', { lw: 2, ink: INK }, 0.2);
  poly(c, [[x - 16, y - 2], [x - 20, y - 26], [x - 6, y - 48], [x, y - 70], [x + 8, y - 44], [x + 22, y - 24], [x + 16, y - 2]], '#ff7a2a', { lw: 2, ink: INK }, 0.4, true);
  poly(c, [[x - 8, y - 2], [x - 8, y - 20], [x, y - 40], [x + 8, y - 18], [x + 8, y - 2]], '#ffd24a', { lw: 0, ink: INK }, 0.3, true);
}

function anvil(c: Ctx, x: number, y: number, s: number): void {
  poly(c, [[x - 30 * s, y - 40 * s], [x + 34 * s, y - 40 * s], [x + 54 * s, y - 52 * s], [x + 30 * s, y - 28 * s], [x + 14 * s, y - 28 * s], [x + 18 * s, y - 8 * s], [x + 30 * s, y], [x - 30 * s, y], [x - 18 * s, y - 8 * s], [x - 14 * s, y - 28 * s], [x - 36 * s, y - 28 * s]], '#6a6e76', PEN, 0.3, true);
  limb(c, x + 50 * s, y - 20 * s, x + 76 * s, y - 80 * s, 8, 7, '#6a4a2c');
  poly(c, [[x + 62 * s, y - 92 * s], [x + 94 * s, y - 80 * s], [x + 90 * s, y - 66 * s], [x + 60 * s, y - 76 * s]], '#7a7e86', PEN, 0.3);
  glow(c, x + 6 * s, y - 44 * s, 36, '#ff8a2a', 0.5);
}

function shrine(c: Ctx, x: number, y: number, s: number): void {
  poly(c, [[x - 44 * s, y], [x + 44 * s, y], [x + 36 * s, y - 20 * s], [x - 36 * s, y - 20 * s]], '#6a6e76', PEN, 0.25);
  poly(c, [[x - 22 * s, y - 20 * s], [x + 22 * s, y - 20 * s], [x + 16 * s, y - 80 * s], [x - 16 * s, y - 80 * s]], '#8a8e96', PEN, 0.3);
  glow(c, x, y - 100 * s, 70, '#bfe0ff', 0.85);
  c.beginPath(); c.moveTo(x, y - 122 * s); c.lineTo(x + 14 * s, y - 100 * s); c.lineTo(x, y - 78 * s); c.lineTo(x - 14 * s, y - 100 * s); c.closePath();
  c.fillStyle = '#e8f6ff'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
  for (const dx of [-30, 30]) { poly(c, [[x + dx * s - 5, y - 20 * s], [x + dx * s + 5, y - 20 * s], [x + dx * s + 4, y - 44 * s], [x + dx * s - 4, y - 44 * s]], '#e8dcc0', PEN, 0.2); glow(c, x + dx * s, y - 50 * s, 22, '#ffd890', 0.9); }
}

function mapTable(c: Ctx, x: number, y: number, s: number): void {
  poly(c, [[x - 70 * s, y - 40 * s], [x + 70 * s, y - 40 * s], [x + 84 * s, y - 30 * s], [x - 84 * s, y - 30 * s]], '#7a5a3a', PEN, 0.25);
  poly(c, [[x - 60 * s, y - 40 * s], [x + 60 * s, y - 40 * s], [x + 76 * s, y - 52 * s], [x - 76 * s, y - 52 * s]], '#d8c8a0', PEN, 0.2);
  line(c, x - 40 * s, y - 46 * s, x - 10 * s, y - 44 * s, 2, '#7a3a2a'); line(c, x - 10 * s, y - 44 * s, x + 30 * s, y - 48 * s, 2, '#7a3a2a');
  circle(c, x + 30 * s, y - 48 * s, 3, '#c44a3a', { lw: 1, ink: INK });
  for (const dx of [-70, 70]) limb(c, x + dx * s, y - 30 * s, x + dx * s, y, 8, 7, '#5a3a22');
}

function rack(c: Ctx, x: number, y: number, s: number): void {
  poly(c, [[x - 70 * s, y - 100 * s], [x + 70 * s, y - 100 * s], [x + 70 * s, y], [x - 70 * s, y]], '#4a3a2a', PEN, 0.15);
  line(c, x - 70 * s, y - 70 * s, x + 70 * s, y - 70 * s, 5, '#6a4a2c'); line(c, x - 70 * s, y - 30 * s, x + 70 * s, y - 30 * s, 5, '#6a4a2c');
  for (let i = 0; i < 5; i++) { const px = x - 56 * s + i * 28 * s; limb(c, px, y - 66 * s, px + 4, y - 108 * s, 6, 3, '#9aa3ad'); }
  circle(c, x - 30 * s, y - 14 * s, 14 * s, '#7a2a24', PEN, 0.25); circle(c, x + 24 * s, y - 14 * s, 14 * s, '#2a4a7a', PEN, 0.25);
}

function noticeBoard(c: Ctx, x: number, y: number, s: number): void {
  poly(c, [[x - 50 * s, y - 80 * s], [x + 50 * s, y - 80 * s], [x + 50 * s, y - 14 * s], [x - 50 * s, y - 14 * s]], '#6a4a2c', PEN, 0.25);
  for (const [dx, dy, a] of [[-26, -60, -0.1], [4, -56, 0.08], [24, -40, -0.05], [-20, -36, 0.1]] as [number, number, number][]) { c.save(); c.translate(x + dx * s, y + dy * s); c.rotate(a); poly(c, [[-12 * s, -10 * s], [12 * s, -10 * s], [12 * s, 10 * s], [-12 * s, 10 * s]], '#e8dcc0', { lw: 1.5, ink: INK }, 0.1); c.restore(); }
  limb(c, x - 40 * s, y - 14 * s, x - 40 * s, y, 7, 6, '#5a3a22'); limb(c, x + 40 * s, y - 14 * s, x + 40 * s, y, 7, 6, '#5a3a22');
}

function lectern(c: Ctx, x: number, y: number, s: number): void {
  limb(c, x, y - 30 * s, x, y, 12, 10, '#5a3a22');
  poly(c, [[x - 36 * s, y - 36 * s], [x + 36 * s, y - 36 * s], [x + 30 * s, y - 54 * s], [x - 30 * s, y - 54 * s]], '#6a4a2c', PEN, 0.2);
  poly(c, [[x - 28 * s, y - 52 * s], [x, y - 58 * s], [x + 28 * s, y - 52 * s], [x + 26 * s, y - 40 * s], [x, y - 44 * s], [x - 26 * s, y - 40 * s]], '#e8dcc0', { lw: 1.5, ink: INK }, 0.15);
  glow(c, x, y - 60 * s, 34, '#ffe08a', 0.35);
}

let campCache: { key: string; cv: HTMLCanvasElement } | null = null;

export function paintCamp(chapter: number, party: HeroId[]): HTMLCanvasElement {
  const key = `${chapter}:${party.join(',')}`;
  if (campCache?.key === key) return campCache.cv;
  const cv = makeCanvas(CAMP_W, CAMP_H);
  const c = ctx2d(cv);
  const L = paintBackgroundVector(chapter, 'cavern', 7);
  for (const l of [L.far, L.mid, L.floor]) c.drawImage(l, 0, 0, CAMP_W, CAMP_H);
  const W = CAMP_W; const H = CAMP_H;
  const gy = H * 0.7;
  // props
  tent(c, W * 0.46, gy + 16, 1.15, '#7a6a52');
  mapTable(c, W * 0.2, gy + 40, 1.0);
  rack(c, W * 0.72, gy + 12, 1.0);
  anvil(c, W * 0.88, gy + 50, 1.0);
  shrine(c, W * 0.08, gy + 70, 0.95);
  noticeBoard(c, W * 0.34, gy + 96, 0.9);
  lectern(c, W * 0.62, gy + 96, 0.95);
  campfire(c, W * 0.5, gy + 78);
  // cave frame
  c.drawImage(L.near, 0, 0, CAMP_W, CAMP_H);
  const vg = c.createRadialGradient(W / 2, H * 0.6, H * 0.3, W / 2, H * 0.6, H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);
  void ellipse; void shade; void alpha;
  // the whole painted scene is boiled down to pixel art, then the party (native pixel sprites) stands around the fire
  const out = makeCanvas(CAMP_W, CAMP_H); const oc = ctx2d(out);
  oc.imageSmoothingEnabled = false;
  oc.drawImage(pixelize(cv, { outW: CAMP_W / PIX, outH: CAMP_H / PIX, levels: 8, dither: 0.8 }), 0, 0, CAMP_W, CAMP_H);
  const spots = [[0.40, 0.80], [0.52, 0.80], [0.64, 0.80], [0.34, 0.95], [0.58, 0.95]];
  party.slice(0, 5).forEach((id, i) => {
    const [fx, fy] = spots[i];
    const fxp = Math.round(W * fx / PIX) * PIX, fyp = Math.round(H * fy / PIX) * PIX;
    oc.drawImage(paintHero(id), fxp - (HERO_W * PIX) / 2, fyp - HERO_FOOT * PIX, HERO_W * PIX, HERO_H * PIX);
  });
  campCache = { key, cv: out };
  return out;
}
