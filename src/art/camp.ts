import type { HeroId } from '../content/schema.ts';
import { INK, PEN, alpha, circle, ctx2d, ellipse, glow, limb, line, makeCanvas, poly, shade, type Ctx } from './draw.ts';
import { HERO_FOOT, HERO_H, HERO_W } from './heroes.ts';
import { heroFrame } from './pixel/heroSprites.ts';
import { previewFrames } from './pixel/fxFrames.ts';
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

function campfire(c: Ctx, x: number, y: number, flames = true): void {
  glow(c, x, y - 20, 200, '#ff8a2a', 0.45);
  for (const a of [-0.5, 0.5, 0]) { c.save(); c.translate(x, y); c.rotate(a); limb(c, -30, 0, 30, 0, 9, 9, '#5a3a22'); c.restore(); }
  for (let i = 0; i < 7; i++) circle(c, x - 40 + i * 13, y + 4 + (i % 2) * 3, 7, '#6a6a70', { lw: 2, ink: INK }, 0.2);
  if (!flames) return;
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

const baseCache = new Map<number, HTMLCanvasElement>();

/** the camp as painted, boiled down to pixel art, with no party and no flames (those are animated on top) */
function campBase(chapter: number): HTMLCanvasElement {
  const hit = baseCache.get(chapter);
  if (hit) return hit;
  const cv = makeCanvas(CAMP_W, CAMP_H);
  const c = ctx2d(cv);
  const L = paintBackgroundVector(chapter, 'cavern', 7);
  for (const l of [L.far, L.mid, L.floor]) c.drawImage(l, 0, 0, CAMP_W, CAMP_H);
  const W = CAMP_W; const H = CAMP_H;
  const gy = H * 0.7;
  tent(c, W * 0.46, gy + 16, 1.15, '#7a6a52');
  mapTable(c, W * 0.2, gy + 40, 1.0);
  rack(c, W * 0.72, gy + 12, 1.0);
  anvil(c, W * 0.88, gy + 50, 1.0);
  shrine(c, W * 0.08, gy + 70, 0.95);
  noticeBoard(c, W * 0.34, gy + 96, 0.9);
  lectern(c, W * 0.62, gy + 96, 0.95);
  campfire(c, W * 0.5, gy + 78, false);
  c.drawImage(L.near, 0, 0, CAMP_W, CAMP_H);
  const vg = c.createRadialGradient(W / 2, H * 0.6, H * 0.3, W / 2, H * 0.6, H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);
  void ellipse; void shade; void alpha;
  const out = makeCanvas(CAMP_W, CAMP_H); const oc = ctx2d(out);
  oc.imageSmoothingEnabled = false;
  oc.drawImage(pixelize(cv, { outW: CAMP_W / PIX, outH: CAMP_H / PIX, levels: 8, dither: 0.8 }), 0, 0, CAMP_W, CAMP_H);
  baseCache.set(chapter, out);
  if (baseCache.size > 3) baseCache.delete(baseCache.keys().next().value as number);
  return out;
}

/** an orange firelight as ordered-dither dots (native pixels), drawn additively and flickered by its alpha */
export function ditherLight(radius: number, color = '#ff963c'): HTMLCanvasElement {
  const rgb = [parseInt(color.slice(1, 3), 16) || 255, parseInt(color.slice(3, 5), 16) || 150, parseInt(color.slice(5, 7), 16) || 60];
  const n = radius * 2, cv = document.createElement('canvas'); cv.width = n; cv.height = Math.round(n * 0.8);
  const x = cv.getContext('2d') as CanvasRenderingContext2D; const img = x.createImageData(cv.width, cv.height);
  const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < cv.height; y++) for (let px = 0; px < cv.width; px++) {
    const d = Math.hypot((px + 0.5 - radius) / radius, (y + 0.5 - radius * 0.8) / (radius * 0.8));
    const a = d >= 1 ? 0 : (1 - d) * (1 - d);
    if (a > (B[((y & 3) << 2) | (px & 3)] + 0.5) / 16 * 0.9) { const i = (y * cv.width + px) * 4; img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = 255; }
  }
  x.putImageData(img, 0, 0);
  return cv;
}

const CAMP_SEATS: [number, number][] = [[0.40, 0.80], [0.52, 0.80], [0.64, 0.80], [0.34, 0.95], [0.58, 0.95]];
const WALK_BOUNDS = { x0: 70, x1: 890, y0: 336, y1: 462 };

/** the handle the camp screen uses to walk the lead hero around */
export interface CampController {
  stop: () => void;
  /** walk the leader to a point on the scene (960 x 480 space) */
  moveTo: (x: number, y: number) => void;
  /** hold a direction (-1, 0 or 1 on each axis); (0, 0) to stop */
  setDir: (dx: number, dy: number) => void;
  /** which facility the leader is standing at (and so which one E would enter) */
  near: () => string | null;
}

/**
 * Bring the camp to life on a canvas: the party breathes and blinks around a crackling fire whose light flickers on the
 * scene, with embers drifting up. The lead hero can be walked around (the rest follow in a line, on a walk cycle) and
 * stops at a facility to enter it. Returns a controller; with reduced motion nothing idles, but walking still works.
 */
export function animateCamp(cv: HTMLCanvasElement, chapter: number, party: HeroId[], reduced: boolean, onNear?: (id: string | null) => void): CampController {
  cv.width = CAMP_W; cv.height = CAMP_H;
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D; ctx.imageSmoothingEnabled = false;
  const base = campBase(chapter), flame = previewFrames('flame'), light = ditherLight(60);
  const fireX = Math.round((CAMP_W * 0.5) / PIX) * PIX, fireY = Math.round((CAMP_H * 0.7 + 78) / PIX) * PIX;
  const people = party.slice(0, 5).map((id, i) => ({ id, x: CAMP_W * CAMP_SEATS[i][0], y: CAMP_H * CAMP_SEATS[i][1], phase: (i * 677) % 1900, face: 1, walking: false }));
  const trail: [number, number][] = [];
  const embers: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  const dir = { x: 0, y: 0 }; let target: [number, number] | null = null; let near: string | null = null; let moved = false;
  const t0 = performance.now(); let last = t0;
  const nearest = (): string | null => {
    const lead = people[0]; if (!lead) return null;
    let best: string | null = null, bd = 78;
    for (const [id, sp] of Object.entries(CAMP_SPOTS)) { const d = Math.abs(lead.x + (HERO_W * PIX) / 2 - sp.x * CAMP_W); if (d < bd) { bd = d; best = id; } }
    return moved ? best : null;
  };
  const step = (dt: number): void => {
    const lead = people[0]; if (!lead) return;
    let dx = dir.x, dy = dir.y;
    if (!dx && !dy && target) {
      const tx = target[0] - (HERO_W * PIX) / 2, ty = target[1], ddx = tx - lead.x, ddy = ty - lead.y, dist = Math.hypot(ddx, ddy);
      if (dist < 5) target = null; else { dx = ddx / dist; dy = ddy / dist; }
    }
    const walking = !!(dx || dy);
    if (walking) {
      const n = Math.hypot(dx, dy) || 1, sp = 150 * dt / 1000;
      lead.x = Math.max(WALK_BOUNDS.x0, Math.min(WALK_BOUNDS.x1, lead.x + (dx / n) * sp)); lead.y = Math.max(WALK_BOUNDS.y0, Math.min(WALK_BOUNDS.y1, lead.y + (dy / n) * sp));
      if (dx) lead.face = dx > 0 ? 1 : -1;
      moved = true; trail.push([lead.x, lead.y]); if (trail.length > 400) trail.shift();
    }
    lead.walking = walking;
    people.slice(1).forEach((p, k) => {
      if (!moved) return;
      const tr = trail[Math.max(0, trail.length - 1 - (k + 1) * 26)] ?? [p.x, p.y], ox = tr[0] - p.x, oy = tr[1] - p.y;
      p.walking = Math.hypot(ox, oy) > 3; if (ox) p.face = ox > 0 ? 1 : -1;
      p.x += ox * 0.35; p.y += oy * 0.35;
    });
    const nn = nearest(); if (nn !== near) { near = nn; onNear?.(near); }
  };
  const draw = (t: number): void => {
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.drawImage(base, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = reduced ? 0.3 : 0.27 + 0.07 * Math.sin(t / 85) + 0.04 * Math.sin(t / 31);
    ctx.drawImage(light, fireX - light.width * PIX / 2, fireY - light.height * PIX * 0.78, light.width * PIX, light.height * PIX);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    let fireDone = false;
    const drawFire = (): void => {
      fireDone = true;
      const fr = flame[reduced ? 0 : Math.floor(t / 75) % flame.length];
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(fr, fireX - (fr.width * PIX) / 2, fireY - fr.height * PIX + 6, fr.width * PIX, fr.height * PIX);
      ctx.globalCompositeOperation = 'source-over';
    };
    for (const h of [...people].sort((a, b) => a.y - b.y)) {
      const hy = Math.round(h.y / PIX) * PIX, hx = Math.round(h.x / PIX) * PIX;
      if (!fireDone && hy > fireY) drawFire();
      const f = h.walking ? heroFrame(h.id, 'walk', Math.floor(t / 120) % 4).color : heroFrame(h.id, 'idle', reduced ? 0 : Math.floor((t + h.phase) / 260) % 4).color;
      if (h.face < 0) { ctx.save(); ctx.translate(hx + HERO_W * PIX, 0); ctx.scale(-1, 1); ctx.drawImage(f, 0, hy - HERO_FOOT * PIX, HERO_W * PIX, HERO_H * PIX); ctx.restore(); }
      else ctx.drawImage(f, hx, hy - HERO_FOOT * PIX, HERO_W * PIX, HERO_H * PIX);
    }
    if (!fireDone) drawFire();
    if (!reduced) {
      if (Math.random() < 0.5) embers.push({ x: fireX + (Math.random() - 0.5) * 36, y: fireY - 20, vx: (Math.random() - 0.5) * 0.6, vy: -(0.8 + Math.random() * 1.6), life: 1 });
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i]; e.x += e.vx; e.y += e.vy; e.life -= 0.012;
        if (e.life <= 0) { embers.splice(i, 1); continue; }
        ctx.globalAlpha = e.life; ctx.fillStyle = e.life > 0.6 ? '#ffe08a' : '#ff8a2e';
        ctx.fillRect(Math.round(e.x / PIX) * PIX, Math.round(e.y / PIX) * PIX, PIX, PIX);
      }
      ctx.globalAlpha = 1;
    }
    // the stop where the leader stands: a small gold arrow over the facility's hotspot position is drawn by the screen's own button
  };
  draw(0);
  const id = window.setInterval(() => { const now = performance.now(); step(now - last); last = now; draw(reduced ? 0 : now - t0); }, 50);
  return {
    stop: () => window.clearInterval(id),
    moveTo: (x, y) => { target = [x, Math.max(WALK_BOUNDS.y0, Math.min(WALK_BOUNDS.y1, y))]; },
    setDir: (dx, dy) => { dir.x = dx; dir.y = dy; if (dx || dy) target = null; },
    near: () => near,
  };
}
