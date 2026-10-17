import { CHAPTERS } from '../content/chapters.ts';
import { bayer, hash2 } from './pixel/engine.ts';
import { compositeBackground } from './backgrounds.ts';

/** the cutaway of the mountain, in native pixels (it is shown at 2x or more) */
export const MAP_W = 224;
export const SKY_H = 56;
export const BAND_H = 60;
export const MAP_H = SKY_H + BAND_H * 10 + 8;
/** where each chapter's node sits (x, y) on the map */
export const NODES: [number, number][] = CHAPTERS.map((_, i) => [i % 2 === 0 ? 150 : 70, SKY_H + i * BAND_H + 34]);

const cache = new Map<string, HTMLCanvasElement>();
type Rgb = [number, number, number];
const put = (d: Uint8ClampedArray, x: number, y: number, c: Rgb, a = 255): void => { if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return; const i = (y * MAP_W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a; };
const mixc = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * The static painting: dusk sky and a snow-capped mountain with the West-gate, then ten strata of the Deep, each filled with that
 * chapter's own backdrop, ragged where they meet, darkened with depth, fogged over where the company has not yet been, and a
 * winding path down through them with a marker at every chapter.
 */
export function paintDescent(reach: number, current: number): HTMLCanvasElement {
  const key = `${reach}:${current}`;
  const hit = cache.get(key); if (hit) return hit;
  const cv = document.createElement('canvas'); cv.width = MAP_W; cv.height = MAP_H;
  const c = cv.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D; c.imageSmoothingEnabled = false;
  // --- strata first (as drawn images), then the pixel passes on top
  c.fillStyle = '#120d1d'; c.fillRect(0, 0, MAP_W, MAP_H);
  CHAPTERS.forEach((ch, i) => {
    const y0 = SKY_H + i * BAND_H, thumb = compositeBackground(ch.n, 'hall', MAP_W, 112);
    c.drawImage(thumb, 0, 26, MAP_W, BAND_H, 0, y0, MAP_W, BAND_H);
  });
  const img = c.getImageData(0, 0, MAP_W, MAP_H), d = img.data;
  // sky: a dusk gradient in six dithered steps, stars, two ranges of mountains and the gate
  const top: Rgb = [28, 26, 70], mid: Rgb = [112, 70, 120], low: Rgb = [226, 140, 110];
  for (let y = 0; y < SKY_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = y / SKY_H, base = t < 0.6 ? mixc(top, mid, t / 0.6) : mixc(mid, low, (t - 0.6) / 0.4);
    const q = Math.floor((t * 6) + (bayer(x, y) - 0.5) * 1.1), tt = Math.max(0, Math.min(5, q)) / 5;
    put(d, x, y, mixc(base, [base[0] * 1.08, base[1] * 1.04, base[2]], tt * 0.1));
  }
  for (let i = 0; i < 40; i++) { const x = Math.floor(hash2(i, 1) * MAP_W), y = Math.floor(hash2(i, 2) * 26); put(d, x, y, [255, 240, 200]); if (i % 7 === 0) { put(d, x + 1, y, [200, 190, 160]); put(d, x - 1, y, [200, 190, 160]); } }
  const tri = (u: number): number => 1 - Math.abs(2 * (u - Math.floor(u)) - 1);
  const ridge = (seed: number, base: number, amp: number, col: Rgb, snow: boolean): void => {
    for (let x = 0; x < MAP_W; x++) {
      const v = Math.max(tri(x / 58 + seed), 0.7 * tri(x / 31 + seed * 1.7), 0.45 * tri(x / 17 + seed * 2.9)), edge = Math.max(0, Math.round(base - amp * v));
      for (let y = edge; y < SKY_H; y++) {
        const capped = snow && v > 0.72 && y - edge < (v - 0.72) * 34 + (hash2(x, y, 6) > 0.7 ? 1 : 0);
        put(d, x, y, capped ? (y - edge < 2 ? [244, 246, 255] : [196, 204, 228]) : mixc(col, [col[0] * 0.65, col[1] * 0.65, col[2] * 0.8], (y - edge) / 30));
      }
    }
  };
  ridge(0.4, 40, 30, [92, 76, 120], true); ridge(0.9, 48, 36, [54, 44, 82], false);
  // the West-gate: a stone arch set into the foot of the mountain with a torch either side
  for (let y = 38; y < SKY_H; y++) for (let x = 96; x < 128; x++) {
    const ins = x > 103 && x < 121 && (y > 44 || (y > 40 && x > 105 && x < 119) || (y > 42 && x > 104 && x < 120));
    put(d, x, y, ins ? [255, 214, 120] : (x + y) % 5 === 0 ? [96, 90, 118] : [118, 110, 140]);
  }
  for (const tx of [90, 134]) { for (let y = 40; y < 52; y++) put(d, tx, y, [90, 60, 34]); put(d, tx, 38, [255, 220, 120]); put(d, tx, 39, [255, 150, 50]); put(d, tx - 1, 39, [255, 150, 50]); put(d, tx + 1, 39, [255, 150, 50]); }
  // strata: depth shading, fog on chapters not yet reached, ragged seams
  CHAPTERS.forEach((ch, i) => {
    const y0 = SKY_H + i * BAND_H, locked = ch.n > reach;
    for (let y = 0; y < BAND_H; y++) for (let x = 0; x < MAP_W; x++) {
      const idx = ((y0 + y) * MAP_W + x) * 4;
      let k = i * 0.03;
      if (locked) k += 0.5 + 0.2 * (bayer(x, y + i) > 0.5 ? 1 : 0);
      if (k > 0) { d[idx] = d[idx] * (1 - k) + 18 * k; d[idx + 1] = d[idx + 1] * (1 - k) + 12 * k; d[idx + 2] = d[idx + 2] * (1 - k) + 34 * k; }
    }
    if (i > 0) for (let x = 0; x < MAP_W; x++) {
      const rag = Math.floor(hash2(x >> 1, i, 4) * 4) + 1;
      for (let y = -1; y < rag; y++) put(d, x, y0 + y, (y === rag - 1 ? [58, 44, 78] : [24, 16, 38]));
      put(d, x, y0 + rag, [92, 74, 120]);
    }
    void ch;
  });
  // the path: a dashed trail from the gate through every chapter
  const pts: [number, number][] = [[112, 52], ...NODES];
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, ay] = pts[s], [bx, by] = pts[s + 1], n = Math.round(Math.hypot(bx - ax, by - ay));
    for (let k = 0; k < n; k++) {
      if (k % 6 > 3) continue;
      const t = k / n, wob = Math.sin(t * Math.PI * 2) * 6, x = Math.round(ax + (bx - ax) * t + wob * (s % 2 ? 1 : -1)), y = Math.round(ay + (by - ay) * t);
      const lit = s < reach; const col: Rgb = lit ? [255, 214, 120] : [140, 130, 160];
      put(d, x, y, col); put(d, x + 1, y, mixc(col, [20, 12, 30], 0.4)); put(d, x, y + 1, mixc(col, [20, 12, 30], 0.4));
    }
  }
  // chapter nodes: a diamond, gold if the chapter is cleared, red for the current Age, grey if locked
  NODES.forEach(([nx, ny], i) => {
    const n = i + 1, col: Rgb = n < current || n * 100 <= 0 ? [255, 214, 120] : n === current ? [240, 90, 70] : n <= reach ? [120, 200, 140] : [110, 100, 130];
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const a = Math.abs(dx) + Math.abs(dy); if (a <= 4) put(d, nx + dx, ny + dy, a === 4 ? [16, 10, 26] : a === 3 ? mixc(col, [16, 10, 26], 0.5) : col); }
  });
  c.putImageData(img, 0, 0);
  cache.set(key, cv); if (cache.size > 8) cache.delete(cache.keys().next().value as string);
  return cv;
}

/** a banner on a pole that waves in three frames, drawn at a node (the company's camp) */
export function drawBanner(c: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  c.fillStyle = '#e8dcc0'; c.fillRect(x, y - 22, 1, 22);
  const col = '#d8402e', hi = '#f27a58';
  for (let k = 0; k < 10; k++) { const w = Math.round(Math.sin(frame * 2.1 + k * 0.7) * 1.2); c.fillStyle = k % 3 === 0 ? hi : col; c.fillRect(x + 1 + k, y - 22 + w, 1, 8 - Math.floor(k / 4)); }
  c.fillStyle = '#f0d070'; c.fillRect(x - 1, y - 24, 3, 2);
}
