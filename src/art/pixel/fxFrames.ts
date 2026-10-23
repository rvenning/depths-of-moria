import { ctx2d } from '../draw.ts';
// Pixel-art effect frames: pure canvas drawing with no Phaser, so the camp and the gallery can use them too.
type Ctx = CanvasRenderingContext2D;
export type FxKind = 'torch' | 'flame' | 'burst' | 'slash' | 'heal' | 'ice' | 'bolt' | 'aura' | 'shield' | 'smoke' | 'shadow' | 'poison' | 'rays' | 'impact';

const hash = (a: number, b: number, c = 0): number => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = ((h ^ (h >>> 13)) * 1274126177) | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function mk(w: number, h: number, draw: (c: Ctx, f: number) => void, n: number): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let f = 0; f < n; f++) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = ctx2d(cv); c.imageSmoothingEnabled = false; draw(c, f); out.push(cv);
  }
  return out;
}
const px = (c: Ctx, x: number, y: number, col: string, a = 1, s = 1): void => { c.globalAlpha = a; c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), s, s); c.globalAlpha = 1; };

// ---- the drawers (white unless the effect has its own colours; white ones are tinted when played)
export const drawers: Record<FxKind, { w: number; h: number; n: number; fps: number; blend: 'add' | 'normal'; draw: (c: Ctx, f: number) => void }> = {
  // a small torch flame, four flickering frames (looped at each light in a room)
  torch: {
    w: 9, h: 15, n: 4, fps: 9, blend: 'add',
    draw: (c, f) => {
      for (let y = 0; y < 15; y++) {
        const t = y / 14, hw = 3.7 * Math.sin(Math.PI * Math.min(1, (1 - t) * 0.92 + 0.08) ** 0.75) + 0.4, wob = Math.sin(f * 1.7 + y * 0.8) * 0.9 * (1 - t);
        for (let x = 0; x < 9; x++) {
          const d = Math.abs(x - 4 - wob) / Math.max(0.4, hw);
          if (d > 1 || (d > 0.7 && hash(x, y, f + 3) < 0.35)) continue;
          px(c, x, y, d < 0.3 ? '#fff8d8' : d < 0.6 ? '#ffd860' : d < 0.85 ? '#ff9a2e' : '#d8481e');
        }
      }
    },
  },
  flame: {
    w: 26, h: 34, n: 6, fps: 14, blend: 'add',
    draw: (c, f) => {
      for (let y = 0; y < 34; y++) {
        const t = y / 33, hw = 9 * Math.sin(Math.PI * Math.min(1, (1 - t) * 0.95 + 0.05) ** 0.8) * (1 - 0.15 * f / 5), wob = Math.sin(y * 0.5 + f * 1.7) * 2.2 * (1 - t);
        for (let x = 0; x < 26; x++) {
          const dx = x - 13 - wob, d = Math.abs(dx) / Math.max(0.5, hw);
          if (d > 1 || hash(x, y, f) < d * d * 0.45) continue;
          px(c, x, y, d < 0.3 ? '#fffbe0' : d < 0.55 ? '#ffe07a' : d < 0.8 ? '#ff9a2e' : '#d8421e', 1 - f * 0.1);
        }
      }
    },
  },
  burst: {
    w: 36, h: 36, n: 6, fps: 16, blend: 'add',
    draw: (c, f) => {
      const r = 3 + f * 3, a = 1 - f * 0.14;
      for (let k = 0; k < 64; k++) { const ang = (k / 64) * Math.PI * 2; for (const rr of [r, r - 1]) px(c, 18 + Math.cos(ang) * rr, 18 + Math.sin(ang) * rr, '#fff', a * (rr === r ? 1 : 0.6)); }
      for (let k = 0; k < 8; k++) { const ang = (k / 8) * Math.PI * 2 + f * 0.2, rr = r + 2 + f; px(c, 18 + Math.cos(ang) * rr, 18 + Math.sin(ang) * rr, '#fff', a, 2); }
    },
  },
  slash: {
    w: 32, h: 32, n: 6, fps: 22, blend: 'add',
    draw: (c, f) => {
      // a tapered crescent whose bright head sweeps down and round; the tail fades as it follows
      const head = -1.35 + f * 0.62, N = 22, R = 11;
      for (let s = 0; s < N; s++) {
        const ang = head - s * 0.095, k = 1 - s / N, th = 0.6 + 3.2 * k, a = Math.min(1, k * 1.6);
        for (let rr = R - th; rr <= R + th; rr += 0.5) px(c, 16 + Math.cos(ang) * rr, 16 + Math.sin(ang) * rr * 1.04, Math.abs(rr - R) > th * 0.55 ? '#cfe8ff' : '#fff', a);
      }
    },
  },
  heal: {
    w: 28, h: 40, n: 8, fps: 12, blend: 'add',
    draw: (c, f) => {
      for (let k = 0; k < 5; k++) {
        const x = 4 + k * 5 + Math.sin(f * 0.6 + k) * 1.5, y = 36 - ((f * 4 + k * 7) % 36), a = Math.min(1, y / 10, (40 - y) / 10) * 0.95;
        px(c, x, y, '#fff', a); px(c, x - 1, y, '#fff', a); px(c, x + 1, y, '#fff', a); px(c, x, y - 1, '#fff', a); px(c, x, y + 1, '#fff', a);
      }
      for (let k = 0; k < 6; k++) px(c, 3 + hash(k, f) * 22, 6 + hash(f, k) * 30, '#fff', 0.7);
    },
  },
  ice: {
    w: 30, h: 36, n: 7, fps: 14, blend: 'normal',
    draw: (c, f) => {
      const grow = Math.min(1, f / 3), fade = f > 4 ? 1 - (f - 4) * 0.3 : 1;
      for (const [bx, h, w] of [[8, 20, 4], [15, 30, 5], [22, 17, 4], [11, 12, 3], [19, 13, 3]] as [number, number, number][]) {
        const hh = Math.round(h * grow);
        for (let y = 0; y < hh; y++) { const hw = (w / 2) * (1 - y / Math.max(1, hh)); for (let x = -Math.ceil(hw); x <= Math.ceil(hw); x++) if (Math.abs(x) <= hw) px(c, bx + x, 35 - y, x < 0 ? '#e8f8ff' : y % 5 === 0 ? '#ffffff' : '#7ec8f0', fade); }
      }
    },
  },
  bolt: {
    w: 24, h: 64, n: 5, fps: 20, blend: 'add',
    draw: (c, f) => {
      let x = 12;
      for (let y = 0; y < 64; y++) {
        x += Math.round((hash(y, f, 5) - 0.5) * 4); x = Math.max(3, Math.min(20, x));
        px(c, x, y, '#fff', 1, 2); px(c, x - 1, y, '#bfe8ff', 0.7); px(c, x + 2, y, '#bfe8ff', 0.7);
        if (y % 11 === 7 && hash(y, f, 9) > 0.35) for (let k = 1; k < 8; k++) px(c, x + k * (hash(y, 3) > 0.5 ? 1 : -1), y + k, '#cfeaff', 0.8);
      }
    },
  },
  aura: {
    w: 48, h: 20, n: 8, fps: 12, blend: 'add',
    draw: (c, f) => {
      const t = f / 7, rx = 6 + t * 18, ry = rx * 0.34, a = 1 - t * 0.85;
      for (let k = 0; k < 90; k++) { const ang = (k / 90) * Math.PI * 2; px(c, 24 + Math.cos(ang) * rx, 10 + Math.sin(ang) * ry, '#fff', a); if (k % 3 === 0) px(c, 24 + Math.cos(ang) * (rx - 2), 10 + Math.sin(ang) * (ry - 0.8), '#fff', a * 0.5); }
      for (let k = 0; k < 6; k++) px(c, 24 + (hash(k, 2) - 0.5) * rx * 1.6, 9 - t * 8 - hash(k, f) * 4, '#fff', a);
    },
  },
  shield: {
    w: 40, h: 40, n: 6, fps: 14, blend: 'add',
    draw: (c, f) => {
      const a = f < 2 ? 0.5 + f * 0.25 : 1 - (f - 2) * 0.25;
      for (let k = 0; k < 120; k++) { const ang = Math.PI + (k / 120) * Math.PI; px(c, 20 + Math.cos(ang) * 16, 30 + Math.sin(ang) * 22, '#fff', a); px(c, 20 + Math.cos(ang) * 15, 30 + Math.sin(ang) * 21, '#fff', a * 0.5); }
      for (let y = 10; y < 30; y += 4) for (let x = 6; x < 34; x += 6) if (hash(x, y, f) > 0.55) { const dx = (x - 20) / 16, dy = (y - 30) / 22; if (dx * dx + dy * dy < 0.85) px(c, x + (y % 8 ? 3 : 0), y, '#fff', a, 2); }
    },
  },
  smoke: {
    w: 32, h: 28, n: 6, fps: 10, blend: 'normal',
    draw: (c, f) => {
      for (let k = 0; k < 7; k++) { const ang = (k / 7) * Math.PI * 2, d = 3 + f * 2.2, r = 3 + f * 0.8; const cx = 16 + Math.cos(ang) * d, cy = 16 + Math.sin(ang) * d * 0.6 - f; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r && hash(x + k, y, f) > 0.25) px(c, cx + x, cy + y, y < 0 ? '#d8d4e0' : '#9a96a8', (1 - f * 0.16) * 0.9); }
    },
  },
  shadow: {
    w: 32, h: 40, n: 8, fps: 14, blend: 'normal',
    draw: (c, f) => {
      for (let k = 0; k < 3; k++) for (let s = 0; s < 40; s++) {
        const t = s / 40, ang = f * 0.5 + k * 2.1 + t * 6, r = 2 + t * 12 * (0.6 + 0.4 * Math.sin(f * 0.4 + k)), y = 38 - t * 36;
        px(c, 16 + Math.cos(ang) * r, y, k === 0 ? '#c8a0ff' : '#8a5ad0', 1 - t * 0.85, 2); if (s % 4 === 0) px(c, 16 + Math.cos(ang) * r * 1.4, y - 2, '#e8d8ff', 0.7);
      }
    },
  },
  poison: {
    w: 28, h: 36, n: 8, fps: 12, blend: 'normal',
    draw: (c, f) => {
      for (let k = 0; k < 7; k++) {
        const y = 34 - ((f * 3 + k * 6) % 34), x = 4 + k * 3.4 + Math.sin(f * 0.5 + k) * 1.5, r = 1 + (k % 3), a = Math.min(1, y / 8);
        for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) { const d = xx * xx + yy * yy; if (d <= r * r + 1 && d >= (r - 1) * (r - 1)) px(c, x + xx, y + yy, '#b6ff5a', a); else if (d < r * r) px(c, x + xx, y + yy, '#4a9a2a', a * 0.7); }
      }
    },
  },
  rays: {
    w: 44, h: 44, n: 6, fps: 14, blend: 'add',
    draw: (c, f) => {
      const a = f < 2 ? 0.6 + f * 0.2 : 1 - (f - 2) * 0.22;
      for (let k = 0; k < 8; k++) { const ang = (k / 8) * Math.PI * 2 + f * 0.12; for (let r = 5; r < 20; r++) px(c, 22 + Math.cos(ang) * r, 22 + Math.sin(ang) * r, '#fff', a * (1 - r / 22)); }
      for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 16) px(c, 22 + x, 22 + y, '#fff', a * 0.9);
    },
  },
  impact: {
    w: 28, h: 28, n: 5, fps: 18, blend: 'add',
    draw: (c, f) => {
      const r = 3 + f * 2.6, a = 1 - f * 0.18;
      for (let k = 0; k < 10; k++) { const ang = (k / 10) * Math.PI * 2 + 0.3; for (let s = 0; s < 4; s++) px(c, 14 + Math.cos(ang) * (r + s), 14 + Math.sin(ang) * (r + s), '#fff', a * (1 - s * 0.2)); }
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (f < 3 && x * x + y * y <= 5) px(c, 14 + x, 14 + y, '#fff', a);
    },
  },
};


/** the raw frames of an effect, for the art gallery */
export function previewFrames(kind: FxKind): HTMLCanvasElement[] { const d = drawers[kind]; return mk(d.w, d.h, d.draw, d.n); }
export const FX_KINDS = Object.keys(drawers) as FxKind[];
