import { CHAPTER_BY_N } from '../content/chapters.ts';
import { alpha, ctx2d, glow, makeCanvas, mix, rand, shade, stoneTexture, type Ctx } from './draw.ts';
import { padCanvas, pixelize } from './pixel/pixelize.ts';

export const BG_W = 960;
export const BG_H = 480;
export const HORIZON = 0.66; // floor line as a fraction of height
/** one art pixel is PIX stage pixels; the pixel layers carry BG_PAD extra native pixels on every side so they can drift */
export const PIX = 2;
export const BG_PAD = 8;

export interface Light { x: number; y: number; r: number; color: string; flicker: number }
export interface BgLayers {
  far: HTMLCanvasElement;
  mid: HTMLCanvasElement;
  floor: HTMLCanvasElement;
  near: HTMLCanvasElement;
  lights: Light[];
  theme: string;
  variant: string;
  particles: 'embers' | 'dust' | 'mist' | 'bubbles' | 'sparks' | 'motes';
}

interface Pal { sky: string; far: string; mid: string; near: string; light: string; fog: string }

function gradient(c: Ctx, w: number, h: number, a: string, b: string): void {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, a); g.addColorStop(1, b);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}

function archRow(c: Ctx, y: number, count: number, w: number, aw: number, ah: number, color: string, inner: string, seed: number, gothic: boolean): void {
  const r = rand(seed);
  const step = w / count;
  for (let i = 0; i < count; i++) {
    const x = i * step + (step - aw) / 2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x, y - ah * 0.6);
    if (gothic) { c.quadraticCurveTo(x, y - ah, x + aw / 2, y - ah - 10); c.quadraticCurveTo(x + aw, y - ah, x + aw, y - ah * 0.6); }
    else c.arc(x + aw / 2, y - ah * 0.6, aw / 2, Math.PI, 0);
    c.lineTo(x + aw, y); c.closePath();
    c.fillStyle = inner; c.fill();
    c.lineWidth = 6; c.strokeStyle = color; c.stroke();
    void r;
  }
}

function pillar(c: Ctx, x: number, top: number, bottom: number, w: number, color: string, seed: number): void {
  const g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, shade(color, -0.3)); g.addColorStop(0.35, shade(color, 0.1)); g.addColorStop(1, shade(color, -0.45));
  c.fillStyle = g; c.fillRect(x, top, w, bottom - top);
  c.fillStyle = shade(color, -0.2); c.fillRect(x - w * 0.12, bottom - w * 0.35, w * 1.24, w * 0.35); c.fillRect(x - w * 0.1, top, w * 1.2, w * 0.3);
  const r = rand(seed);
  for (let i = 0; i < 14; i++) { c.fillStyle = alpha('#000000', 0.12); c.fillRect(x + r() * w, top + r() * (bottom - top), 1.5, 8 + r() * 24); }
}

function stalactites(c: Ctx, w: number, maxH: number, color: string, seed: number, density = 22): void {
  const r = rand(seed);
  for (let i = 0; i < density; i++) {
    const x = r() * w; const hh = 12 + r() * maxH; const ww = 6 + r() * 16;
    c.beginPath(); c.moveTo(x - ww, 0); c.lineTo(x, hh); c.lineTo(x + ww, 0); c.closePath();
    c.fillStyle = shade(color, -0.1 * r()); c.fill();
  }
}

function torch(c: Ctx, lights: Light[], x: number, y: number, color: string, r = 90): void {
  c.fillStyle = '#2a1c10'; c.fillRect(x - 2, y, 4, 18);
  c.fillStyle = '#5a5e66'; c.fillRect(x - 6, y - 2, 12, 5);
  glow(c, x, y - 8, 26, color, 0.9);
  c.beginPath(); c.moveTo(x - 4, y - 2); c.quadraticCurveTo(x - 6, y - 16, x, y - 24); c.quadraticCurveTo(x + 6, y - 14, x + 4, y - 2); c.closePath();
  c.fillStyle = '#ffe9a0'; c.fill();
  lights.push({ x, y: y - 10, r, color, flicker: 1 });
}

function fog(c: Ctx, w: number, _h: number, color: string, a: number, y0: number, y1: number): void {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, alpha(color, 0)); g.addColorStop(1, alpha(color, a));
  c.fillStyle = g; c.fillRect(0, y0, w, y1 - y0);
}

// ------------------------------------------------------------------ floor
function paintFloor(c: Ctx, w: number, h: number, pal: Pal, theme: string, seed: number): void {
  const y0 = h * HORIZON;
  const g = c.createLinearGradient(0, y0, 0, h);
  g.addColorStop(0, shade(pal.mid, -0.1)); g.addColorStop(1, shade(pal.near, -0.3));
  c.fillStyle = g; c.fillRect(0, y0, w, h - y0);
  const r = rand(seed + 9);
  // perspective slab lines
  c.strokeStyle = alpha('#000000', 0.35); c.lineWidth = 1.5;
  for (let i = 1; i < 8; i++) { const y = y0 + Math.pow(i / 8, 1.8) * (h - y0); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  for (let i = -12; i <= 12; i++) { c.beginPath(); c.moveTo(w / 2 + i * 20, y0); c.lineTo(w / 2 + i * 120, h); c.stroke(); }
  for (let i = 0; i < 160; i++) { c.fillStyle = alpha('#ffffff', r() * 0.05); c.fillRect(r() * w, y0 + r() * (h - y0), 2 + r() * 6, 1); }
  if (theme === 'flooded') {
    const wg = c.createLinearGradient(0, y0, 0, h); wg.addColorStop(0, alpha(pal.light, 0.22)); wg.addColorStop(1, alpha(pal.sky, 0.55));
    c.fillStyle = wg; c.fillRect(0, y0, w, h - y0);
    c.strokeStyle = alpha(pal.light, 0.25); for (let i = 0; i < 14; i++) { const y = y0 + 8 + i * ((h - y0) / 14); c.beginPath(); c.moveTo(r() * 80, y); c.bezierCurveTo(w * 0.3, y - 4, w * 0.6, y + 4, w - r() * 80, y); c.stroke(); }
  }
  if (theme === 'flame') {
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(w * (0.1 + i * 0.35), y0); c.bezierCurveTo(w * 0.3, y0 + 40, w * 0.5, h - 40, w * (0.2 + i * 0.3), h); c.lineWidth = 16; c.strokeStyle = alpha('#ff7a2a', 0.5); c.stroke(); c.lineWidth = 5; c.strokeStyle = alpha('#ffd24a', 0.7); c.stroke(); }
  }
  if (theme === 'forge') {
    for (let i = 0; i < 5; i++) { const x = 60 + i * 190 + r() * 40; c.fillStyle = alpha('#ff8a2a', 0.5); c.fillRect(x, y0 + 10 + r() * 80, 50 + r() * 40, 3); }
  }
  // contact shadow band under the horizon
  const sg = c.createLinearGradient(0, y0 - 6, 0, y0 + 30);
  sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sg; c.fillRect(0, y0 - 6, w, 36);
}

// ------------------------------------------------------------------ per-theme dressing
type Dress = (far: Ctx, mid: Ctx, near: Ctx, w: number, h: number, pal: Pal, variant: string, seed: number, lights: Light[]) => void;

const common = (far: Ctx, mid: Ctx, near: Ctx, w: number, h: number, pal: Pal, variant: string, seed: number, lights: Light[], gothic: boolean, pillarsN: number): void => {
  const y0 = h * HORIZON;
  const r = rand(seed);
  // far: deep arcade
  const farInner = shade(pal.far, -0.55);
  if (variant !== 'cavern') archRow(far, y0 - 4, 9, w, 62, 190, shade(pal.far, 0.1), farInner, seed, gothic);
  // mid by variant
  switch (variant) {
    case 'corridor': {
      mid.fillStyle = shade(pal.mid, -0.2); mid.fillRect(0, 0, w, y0);
      // converging walls
      mid.beginPath(); mid.moveTo(0, 0); mid.lineTo(w * 0.34, y0 * 0.34); mid.lineTo(w * 0.34, y0 - 40); mid.lineTo(0, y0); mid.closePath(); mid.fillStyle = shade(pal.mid, -0.1); mid.fill();
      mid.beginPath(); mid.moveTo(w, 0); mid.lineTo(w * 0.66, y0 * 0.34); mid.lineTo(w * 0.66, y0 - 40); mid.lineTo(w, y0); mid.closePath(); mid.fillStyle = shade(pal.mid, -0.2); mid.fill();
      mid.fillStyle = shade(pal.far, -0.6); mid.fillRect(w * 0.34, y0 * 0.34, w * 0.32, y0 * 0.66 - 40);
      glow(mid, w / 2, y0 * 0.7, 120, pal.light, 0.25);
      break;
    }
    case 'cavern': {
      far.fillStyle = shade(pal.far, -0.35); far.fillRect(0, 0, w, y0);
      mid.fillStyle = shade(pal.mid, -0.15);
      mid.beginPath(); mid.moveTo(0, y0);
      for (let x = 0; x <= w; x += 24) mid.lineTo(x, y0 - 40 - r() * 140 * (Math.abs(x - w / 2) / (w / 2) + 0.2));
      mid.lineTo(w, y0); mid.closePath(); mid.fill();
      stalactites(mid, w, 90, shade(pal.mid, -0.25), seed, 28);
      break;
    }
    case 'stair': {
      for (let i = 0; i < 10; i++) { const x = w * 0.5 + i * 38; const y = y0 - i * 20; mid.fillStyle = shade(pal.mid, 0.02 * i - 0.2); mid.fillRect(x, y - 14, w - x, 14); mid.fillStyle = shade(pal.mid, -0.35); mid.fillRect(x, y, 38, 20); }
      pillar(mid, 90, 0, y0, 54, pal.mid, seed); pillar(mid, 300, 0, y0, 54, pal.mid, seed + 1);
      break;
    }
    case 'bridge': {
      mid.fillStyle = shade(pal.sky, -0.4); mid.fillRect(0, y0 - 20, w, 60);
      for (let i = 0; i < 5; i++) { mid.fillStyle = shade(pal.mid, -0.2 - 0.05 * i); mid.fillRect(40 + i * 200, y0 - 22 - (i % 2) * 8, 150, 10); }
      glow(mid, w * 0.5, y0 + 40, 280, pal.light, 0.22);
      break;
    }
    case 'vault': {
      for (let i = 0; i < pillarsN; i++) pillar(mid, 40 + i * (w - 120) / Math.max(1, pillarsN - 1), 0, y0, 46, pal.mid, seed + i);
      for (let i = 0; i < 6; i++) { glow(mid, 160 + r() * 640, y0 - 8, 70, '#ffd24a', 0.5); }
      mid.fillStyle = '#d9b25f'; for (let i = 0; i < 60; i++) mid.fillRect(120 + r() * 720, y0 - 8 - r() * 16, 3, 3);
      break;
    }
    case 'shrine': {
      for (let i = 0; i < 4; i++) pillar(mid, 30 + i * 280, 0, y0, 50, pal.mid, seed + i);
      mid.fillStyle = shade(pal.mid, -0.15); mid.fillRect(w / 2 - 90, y0 - 52, 180, 52);
      mid.fillStyle = shade(pal.mid, 0.1); mid.fillRect(w / 2 - 100, y0 - 58, 200, 8);
      glow(mid, w / 2, y0 - 80, 150, pal.light, 0.5);
      for (const x of [-70, -40, 40, 70]) { mid.fillStyle = '#e8dcc0'; mid.fillRect(w / 2 + x, y0 - 82, 5, 24); glow(mid, w / 2 + x + 2, y0 - 88, 22, '#ffd890', 0.9); }
      break;
    }
    case 'arena': {
      for (let i = 0; i < 6; i++) pillar(mid, 24 + i * 170, 0, y0, 58, pal.mid, seed + i);
      mid.fillStyle = shade(pal.far, -0.5); mid.fillRect(w * 0.3, y0 * 0.3, w * 0.4, y0 * 0.7);
      glow(mid, w / 2, y0 * 0.6, 220, pal.light, 0.28);
      break;
    }
    default: { // hall
      for (let i = 0; i < pillarsN; i++) pillar(mid, 40 + i * (w - 140) / Math.max(1, pillarsN - 1), 0, y0, 40 + (i % 2) * 12, pal.mid, seed + i);
      break;
    }
  }
  // sconces
  for (const x of [130, 330, 630, 830]) { if (variant !== 'bridge' && variant !== 'cavern') torch(mid, lights, x, y0 - 150 + (x % 2) * 6, pal.light, 110); }
  if (variant === 'cavern') for (const x of [220, 700]) torch(mid, lights, x, y0 - 70, pal.light, 120);
  // near: heavy edges + hanging silhouettes
  near.fillStyle = alpha(shade(pal.near, -0.5), 0.92);
  near.beginPath(); near.moveTo(0, 0); near.lineTo(110, 0); near.lineTo(70, h); near.lineTo(0, h); near.closePath(); near.fill();
  near.beginPath(); near.moveTo(w, 0); near.lineTo(w - 90, 0); near.lineTo(w - 50, h); near.lineTo(w, h); near.closePath(); near.fill();
  stalactites(near, w, 46, alpha(shade(pal.near, -0.5), 0.9), seed + 77, 10);
  fog(mid, w, h, pal.fog, 0.35, y0 - 80, y0 + 10);
};

const DRESS: Record<string, Dress> = {
  gate: (f, m, n, w, h, p, v, s, l) => {
    common(f, m, n, w, h, p, v, s, l, false, 6);
    // broken gate arch & rubble
    const y0 = h * HORIZON; const r = rand(s + 3);
    for (let i = 0; i < 14; i++) { m.fillStyle = shade(p.mid, -0.1 - r() * 0.2); m.fillRect(r() * w, y0 - 6 - r() * 12, 8 + r() * 20, 6 + r() * 10); }
  },
  gallery: (f, m, n, w, h, p, v, s, l) => {
    common(f, m, n, w, h, p, v, s, l, true, 7);
    const y0 = h * HORIZON; const r = rand(s + 4);
    // balconies with slits
    for (let i = 0; i < 6; i++) { m.fillStyle = shade(p.mid, -0.35); m.fillRect(30 + i * 150, y0 - 220, 90, 8); m.fillStyle = '#05060a'; m.fillRect(52 + i * 150, y0 - 212, 5, 26); m.fillRect(72 + i * 150, y0 - 212, 5, 26); }
    for (let i = 0; i < 6; i++) { const x = r() * w; m.fillStyle = '#0a0810'; m.beginPath(); m.moveTo(x, 10); m.lineTo(x - 7, 26); m.lineTo(x + 7, 26); m.fill(); }
  },
  forge: (f, m, n, w, h, p, v, s, l) => {
    common(f, m, n, w, h, p, v, s, l, false, 5);
    const y0 = h * HORIZON; const r = rand(s + 5);
    for (let i = 0; i < 4; i++) { const x = 90 + i * 230; m.fillStyle = '#1c1210'; m.fillRect(x, y0 - 120, 78, 120); glow(m, x + 39, y0 - 60, 90, '#ff7a2a', 0.8); m.fillStyle = '#ffb347'; m.fillRect(x + 12, y0 - 80, 54, 40); l.push({ x: x + 39, y: y0 - 60, r: 150, color: '#ff7a2a', flicker: 2 }); }
    for (let i = 0; i < 5; i++) { m.fillStyle = '#34383e'; m.fillRect(120 + r() * 700, y0 - 24, 54, 24); m.fillRect(130 + r() * 700, y0 - 34, 34, 10); }
  },
  stair: (f, m, n, w, h, p, v, s, l) => { common(f, m, n, w, h, p, v === 'hall' ? 'stair' : v, s, l, false, 4); },
  halls: (f, m, n, w, h, p, v, s, l) => {
    common(f, m, n, w, h, p, v, s, l, false, 5);
    const y0 = h * HORIZON;
    for (let i = 0; i < 3; i++) { const x = 160 + i * 300; m.fillStyle = alpha(p.light, 0.07); m.beginPath(); m.moveTo(x, 0); m.lineTo(x + 130, y0); m.lineTo(x - 30, y0); m.closePath(); m.fill(); }
    // a drum
    m.fillStyle = '#6a4a2c'; m.beginPath(); m.ellipse(w * 0.84, y0 - 22, 50, 26, 0, 0, Math.PI * 2); m.fill(); m.fillStyle = '#e8d8b0'; m.beginPath(); m.ellipse(w * 0.84, y0 - 34, 50, 16, 0, 0, Math.PI * 2); m.fill();
  },
  flooded: (f, m, n, w, h, p, v, s, l) => {
    common(f, m, n, w, h, p, v, s, l, true, 6);
    const y0 = h * HORIZON; const r = rand(s + 6);
    fog(m, w, h, p.fog, 0.55, y0 - 160, y0 + 20);
    for (let i = 0; i < 9; i++) { m.strokeStyle = alpha(p.light, 0.2); m.beginPath(); m.ellipse(60 + r() * 840, y0 + 10 + r() * 60, 24 + r() * 40, 5, 0, 0, Math.PI * 2); m.stroke(); }
    for (let i = 0; i < 4; i++) { const x = r() * w; n.strokeStyle = alpha('#0a1a10', 0.7); n.lineWidth = 4; n.beginPath(); n.moveTo(x, 0); n.bezierCurveTo(x + 20, 60, x - 20, 120, x + 8, 190); n.stroke(); }
  },
  archives: (f, m, n, w, h, p, v, s, l) => {
    common(f, m, n, w, h, p, v === 'hall' ? 'hall' : v, s, l, true, 4);
    const y0 = h * HORIZON; const r = rand(s + 7);
    for (let i = 0; i < 4; i++) {
      const x = 20 + i * 235;
      m.fillStyle = shade(p.mid, -0.4); m.fillRect(x, y0 - 230, 130, 230);
      for (let row = 0; row < 7; row++) {
        m.fillStyle = '#05040a'; m.fillRect(x + 4, y0 - 224 + row * 32, 122, 4);
        for (let b = 0; b < 12; b++) { m.fillStyle = mix(p.light, p.mid, r() * 0.8 + 0.2); m.fillRect(x + 6 + b * 10, y0 - 222 + row * 32 + 2, 6 + r() * 3, 24); }
      }
    }
    for (let i = 0; i < 10; i++) { const x = r() * w; m.fillStyle = alpha(p.light, 0.5); m.fillRect(x, 40 + r() * 160, 6, 4); }
  },
  chasm: (f, m, n, w, h, p, v, s, l) => {
    common(f, m, n, w, h, p, v, s, l, false, 3);
    const y0 = h * HORIZON; const r = rand(s + 8);
    glow(f, w / 2, y0 + 30, 340, p.light, 0.25);
    for (let i = 0; i < 12; i++) { f.fillStyle = alpha(p.light, 0.5); f.fillRect(r() * w, 30 + r() * 220, 2, 2); }
    // chasm lips
    m.fillStyle = '#04040a'; m.beginPath(); m.moveTo(w * 0.2, y0); m.bezierCurveTo(w * 0.35, y0 + 28, w * 0.65, y0 + 28, w * 0.8, y0); m.lineTo(w * 0.8, y0 + 6); m.lineTo(w * 0.2, y0 + 6); m.fill();
  },
  flame: (f, m, n, w, h, p, v, s, l) => {
    common(f, m, n, w, h, p, v, s, l, false, 5);
    const y0 = h * HORIZON; const r = rand(s + 9);
    glow(f, w / 2, y0 - 30, 420, '#ff7a2a', 0.35);
    for (let i = 0; i < 7; i++) { const x = 40 + i * 140 + r() * 40; m.beginPath(); m.moveTo(x, y0); m.bezierCurveTo(x - 20, y0 - 60, x + 10, y0 - 90, x, y0 - 150 - r() * 60); m.bezierCurveTo(x + 30, y0 - 90, x + 24, y0 - 50, x + 40, y0); m.fillStyle = alpha('#ff7a2a', 0.35); m.fill(); }
    for (let i = 0; i < 3; i++) l.push({ x: 160 + i * 320, y: y0 - 40, r: 200, color: '#ff7a2a', flicker: 3 });
  },
  bridge: (f, m, n, w, h, p, v, s, l) => {
    common(f, m, n, w, h, p, v === 'hall' ? 'bridge' : v, s, l, false, 3);
    const y0 = h * HORIZON; const r = rand(s + 10);
    glow(f, w / 2, y0 + 20, 400, '#ff5a20', 0.35);
    for (let i = 0; i < 9; i++) { f.fillStyle = alpha('#ff7a2a', 0.5); f.fillRect(r() * w, 20 + r() * 220, 2, 2); }
    // parapets
    for (let i = 0; i < 12; i++) { m.fillStyle = shade(p.mid, -0.2); m.fillRect(30 + i * 80, y0 - 30, 12, 30); }
    m.fillStyle = shade(p.mid, -0.25); m.fillRect(0, y0 - 32, w, 6);
  },
};

// ------------------------------------------------------------------ public
const vcache = new Map<string, BgLayers>();
const vorder: string[] = [];

export function paintBackgroundVector(chapter: number, variant: string, seed = 1): BgLayers {
  const key = `${chapter}:${variant}`;
  const hit = vcache.get(key);
  if (hit) return hit;
  const ch = CHAPTER_BY_N(chapter);
  const pal = ch.palette;
  const w = BG_W, h = BG_H;
  const far = makeCanvas(w, h), mid = makeCanvas(w, h), floor = makeCanvas(w, h), near = makeCanvas(w, h);
  const fc = ctx2d(far), mc = ctx2d(mid), flc = ctx2d(floor), nc = ctx2d(near);
  gradient(fc, w, h, pal.sky, mix(pal.sky, pal.far, 0.65));
  stoneTexture(fc, 0, 0, w, h * HORIZON, 'rgba(0,0,0,0)', seed, 0.08);
  const lights: Light[] = [];
  const s = chapter * 101 + variant.length * 17 + seed;
  (DRESS[ch.theme] ?? DRESS.gate)(fc, mc, nc, w, h, pal, variant, s, lights);
  paintFloor(flc, w, h, pal, ch.theme, s);
  const particles: BgLayers['particles'] = ({ gate: 'dust', gallery: 'dust', forge: 'embers', stair: 'dust', halls: 'motes', flooded: 'bubbles', archives: 'motes', chasm: 'sparks', flame: 'embers', bridge: 'embers' } as const)[ch.theme as 'gate'] ?? 'dust';
  const layers: BgLayers = { far, mid, floor, near, lights, theme: ch.theme, variant, particles };
  vcache.set(key, layers); vorder.push(key);
  while (vorder.length > 3) vcache.delete(vorder.shift() as string);
  return layers;
}

// ------------------------------------------------------------------ pixel version
const pcache = new Map<string, BgLayers>();
const porder: string[] = [];

export function paintBackground(chapter: number, variant: string, seed = 1): BgLayers {
  const key = `${chapter}:${variant}`;
  const hit = pcache.get(key);
  if (hit) return hit;
  const v = paintBackgroundVector(chapter, variant, seed);
  const nw = BG_W / PIX, nh = BG_H / PIX;
  const px = (cv: HTMLCanvasElement, o: { levels: number; dither: number; alphaDither?: boolean }): HTMLCanvasElement => padCanvas(pixelize(cv, { outW: nw, outH: nh, ...o }), BG_PAD);
  const layers: BgLayers = {
    far: px(v.far, { levels: 9, dither: 0.9 }), mid: px(v.mid, { levels: 7, dither: 0.6, alphaDither: true }),
    floor: px(v.floor, { levels: 8, dither: 0.8 }), near: px(v.near, { levels: 6, dither: 0.6, alphaDither: true }),
    lights: v.lights, theme: v.theme, variant: v.variant, particles: v.particles,
  };
  pcache.set(key, layers); porder.push(key);
  while (porder.length > 6) pcache.delete(porder.shift() as string);
  return layers;
}

export const BG_VARIANT_KEYS = ['hall', 'corridor', 'cavern', 'stair', 'vault', 'bridge', 'shrine', 'arena'];

/** a composite single image (for menus, map thumbnails and the camp) */
const thumbs = new Map<string, HTMLCanvasElement>();
export function compositeBackground(chapter: number, variant: string, w = 640, h = 320): HTMLCanvasElement {
  // thumbnails are tiny and reused by the map, title and ending, so they are cached for good;
  // regenerating them on every visit repainted ten full-size rooms and thrashed memory
  const key = `${chapter}:${variant}:${w}x${h}`;
  const hit = thumbs.get(key);
  if (hit) return hit;
  const L = paintBackground(chapter, variant);
  const nw = BG_W / PIX, nh = BG_H / PIX;
  const nat = makeCanvas(nw, nh); const nc = ctx2d(nat); nc.imageSmoothingEnabled = false;
  for (const l of [L.far, L.mid, L.floor, L.near]) nc.drawImage(l, BG_PAD, BG_PAD, nw, nh, 0, 0, nw, nh);
  const cv = makeCanvas(w, h); const c = ctx2d(cv);
  c.imageSmoothingEnabled = w < nw; c.imageSmoothingQuality = 'high';
  c.drawImage(nat, 0, 0, w, h);
  thumbs.set(key, cv);
  return cv;
}
