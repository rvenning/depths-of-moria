import { ctx2d } from '../draw.ts';
// Pixel-art engine. Shapes are drawn as masks, shaded by an "inflate" height field, mapped to hue-shifted
// colour ramps with ordered dithering, then outlined (outer outline + selective inner outline).
// Pure computation: no DOM, so the unit tests and Node tools can use it too.

export type RGB = [number, number, number];
export interface PixImg { w: number; h: number; rgba: Uint8ClampedArray; /** tangent-space normal map (rgb), alpha follows the sprite */ normal?: Uint8ClampedArray }

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const hexRGB = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function rgb2hsl([r0, g0, b0]: RGB): [number, number, number] {
  const r = r0 / 255, g = g0 / 255, b = b0 / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  }
  return [h, s, l];
}
export function hsl2rgb(h0: number, s: number, l: number): RGB {
  const h = (((h0 % 360) + 360) % 360) / 360;
  const f = (p: number, q: number, t0: number): number => { let t = t0; if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [Math.round(f(p, q, h + 1 / 3) * 255), Math.round(f(p, q, h) * 255), Math.round(f(p, q, h - 1 / 3) * 255)];
}
export { rgb2hsl };
const rot = (h: number, target: number, amt: number): number => { const d = ((target - h + 540) % 360) - 180; return (h + clamp(d, -amt, amt) + 360) % 360; };

export interface RampOpts { spread?: number; shadowHue?: number; shadowShift?: number; lightHue?: number; lightShift?: number }
export function makeRamp(hex: string, o: RampOpts = {}): RGB[] {
  const [h, s, l] = rgb2hsl(hexRGB(hex)); const spread = o.spread ?? 0.16, out: RGB[] = [];
  for (let i = 0; i < 5; i++) {
    const t = (i - 2) / 2;
    const hh = t < 0 ? rot(h, o.shadowHue ?? 262, -t * (o.shadowShift ?? 30)) : rot(h, o.lightHue ?? 54, t * (o.lightShift ?? 16));
    const ss = clamp(s * (1 - 0.1 * Math.abs(t)) + (t < 0 ? 0.05 * -t : 0), 0, 1);
    const ll = clamp(l + t * spread * (t < 0 ? 1.05 : 0.95), 0.05, 0.96);
    out.push(hsl2rgb(hh, ss, ll));
  }
  return out;
}

export interface Mat { name: string; ramp: RGB[]; dither: number; emissive: boolean; /** metals: the brightest tones glint */ shiny: boolean }
export const MATS: Mat[] = [];
export const MAT_ID: Record<string, number> = {};
export function def(name: string, hex: string, o: RampOpts & { dither?: number; emissive?: boolean; shiny?: boolean } = {}): void {
  MAT_ID[name] = MATS.length; MATS.push({ name, ramp: makeRamp(hex, o), dither: o.dither ?? 0.22, emissive: !!o.emissive, shiny: !!o.shiny });
}
export const mixc = (a: RGB, b: RGB, t: number): RGB => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number): number => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
export const hash2 = (x: number, y: number, s = 0): number => { let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0; h = ((h ^ (h >>> 13)) * 1274126177) | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const OUTLINE: RGB = hexRGB('#150d20');
export function shade(matName: string, p: number, x: number, y: number, dit?: number): RGB {
  const m = MATS[MAT_ID[matName]]; const d = dit ?? m.dither;
  const idx = clamp(Math.floor(p + (bayer(x, y) - 0.5) * d * 2 + 0.5), 0, 4);
  return m.ramp[idx];
}

const LIGHT: [number, number, number] = (() => { const v = [-0.55, -0.64, 0.54], n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n] as [number, number, number]; })();

export interface DrawOpts {
  g?: string; flat?: boolean; tone?: number; light?: number; grad?: number; bevel?: number; height?: number; noLine?: boolean; tex?: number;
  fold?: { amp: number; period: number; angle?: number; phase?: number };
}

export class Sprite {
  w: number; h: number; mat: Int16Array; p: Float32Array; part: Int32Array; grp: Int32Array; dir: Int32Array; noline: Uint8Array;
  /** accumulated surface height, used to build the normal map for dynamic lighting */
  height: Float32Array;
  n = 0; ox = 0; oy = 0; grps: Record<string, number> = {};
  /** design-space to pixel scale for every mask and dot (lets a 256-unit drawing be rendered at any sprite size) */
  k = 1;
  constructor(w: number, h: number) {
    this.w = w; this.h = h; const n = w * h;
    this.mat = new Int16Array(n).fill(-1); this.p = new Float32Array(n); this.part = new Int32Array(n).fill(-1);
    this.grp = new Int32Array(n).fill(-1); this.dir = new Int32Array(n).fill(-1); this.noline = new Uint8Array(n);
    this.height = new Float32Array(n);
  }
  at(ox: number, oy: number): this { this.ox = ox; this.oy = oy; return this; }
  mPoly(pts: [number, number][]): Uint8Array {
    const { w, h } = this, m = new Uint8Array(w * h), P = pts.map(([x, y]) => [x * this.k + this.ox, y * this.k + this.oy] as [number, number]);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(h - 1, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(w - 1, Math.ceil(x1)); x++) {
      const px = x + 0.5, py = y + 0.5; let ins = false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ins = !ins; }
      if (ins) m[y * w + x] = 1;
    }
    return m;
  }
  mEll(cx0: number, cy0: number, rx0: number, ry0: number): Uint8Array {
    const { w, h } = this, m = new Uint8Array(w * h), cx = cx0 * this.k + this.ox, cy = cy0 * this.k + this.oy, rx = rx0 * this.k, ry = ry0 * this.k;
    for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(h - 1, Math.ceil(cy + ry)); y++) for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(w - 1, Math.ceil(cx + rx)); x++) { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) m[y * w + x] = 1; }
    return m;
  }
  mRect(x: number, y: number, rw: number, rh: number): Uint8Array { return this.mPoly([[x, y], [x + rw, y], [x + rw, y + rh], [x, y + rh]]); }
  mLine(pts: [number, number][], wd: number, wd2?: number): Uint8Array {
    const { w, h } = this, m = new Uint8Array(w * h), P = pts.map(([x, y]) => [x * this.k + this.ox, y * this.k + this.oy] as [number, number]);
    for (let s = 0; s < P.length - 1; s++) {
      const [ax, ay] = P[s], [bx, by] = P[s + 1], r0 = Math.max(0.6, (wd * this.k) / 2), r1 = Math.max(0.6, ((wd2 ?? wd) * this.k) / 2), pad = Math.max(r0, r1) + 1;
      const xa = Math.max(0, Math.floor(Math.min(ax, bx) - pad)), xb = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + pad)), ya = Math.max(0, Math.floor(Math.min(ay, by) - pad)), yb = Math.min(h - 1, Math.ceil(Math.max(ay, by) + pad));
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
        const t = clamp(((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / L2, 0, 1);
        const qx = ax + dx * t, qy = ay + dy * t, r = r0 + (r1 - r0) * t;
        if ((x + 0.5 - qx) ** 2 + (y + 0.5 - qy) ** 2 <= r * r) m[y * w + x] = 1;
      }
    }
    return m;
  }
  draw(mask: Uint8Array, matName: string, o: DrawOpts = {}): this {
    const { w, h } = this, id = MAT_ID[matName];
    if (id === undefined) throw new Error(`unknown material ${matName}`);
    const pid = this.n++;
    let g: number; if (o.g === undefined) g = pid; else { if (this.grps[o.g] === undefined) this.grps[o.g] = 1000 + Object.keys(this.grps).length; g = this.grps[o.g]; }
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 < 0) return this;
    const d = new Float32Array(w * h), INF = 1e6;
    const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
    for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * w + x; if (!mask[i]) continue; d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.41, at(x + 1, y - 1) + 1.41); }
    for (let y = y1; y >= y0; y--) for (let x = x1; x >= x0; x--) { const i = y * w + x; if (!mask[i]) continue; d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.41, at(x - 1, y + 1) + 1.41); }
    let dmax = 0; for (let i = 0; i < w * h; i++) if (mask[i] && d[i] > dmax) dmax = d[i];
    const R = o.bevel ?? Math.min(5, Math.max(1.5, dmax * 0.8)), K = o.height ?? 1;
    const hh = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) if (mask[i]) { const r = Math.min(d[i], R) / R; hh[i] = K * R * Math.sqrt(Math.max(0, 1 - (1 - r) * (1 - r))); }
    const H = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : hh[y * w + x]);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x; if (!mask[i]) continue;
      let p: number;
      if (o.flat) p = o.tone ?? 2.2;
      else {
        let nx = -(H(x + 1, y) - H(x - 1, y)) / 2, ny = -(H(x, y + 1) - H(x, y - 1)) / 2, nz = 1;
        const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        p = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] + 0.15) * 3.3;
      }
      p += o.light ?? 0;
      if (o.grad) p += o.grad * (0.5 - (y - y0) / Math.max(1, y1 - y0));
      if (o.fold) { const f = o.fold, a = f.angle ?? 0; p += f.amp * Math.sin(((x * Math.cos(a) + y * Math.sin(a)) / f.period) * Math.PI * 2 + (f.phase ?? 0)); }
      if (o.tex) p += o.tex * (hash2(x, y, pid) - 0.5);
      this.mat[i] = id; this.p[i] = clamp(p, 0, 4); this.part[i] = pid; this.grp[i] = g; this.dir[i] = -1; this.noline[i] = o.noLine ? 1 : 0;
      this.height[i] = o.flat ? 0.6 + pid * 0.02 : hh[i] * 0.8 + 0.4 + pid * 0.02;
    }
    return this;
  }
  poly(pts: [number, number][], mat: string, o?: DrawOpts): this { return this.draw(this.mPoly(pts), mat, o); }
  ell(cx: number, cy: number, rx: number, ry: number, mat: string, o?: DrawOpts): this { return this.draw(this.mEll(cx, cy, rx, ry), mat, o); }
  rect(x: number, y: number, rw: number, rh: number, mat: string, o?: DrawOpts): this { return this.draw(this.mRect(x, y, rw, rh), mat, o); }
  line(pts: [number, number][], wd: number, mat: string, o?: DrawOpts, wd2?: number): this { return this.draw(this.mLine(pts, wd, wd2), mat, o); }
  dot(x0: number, y0: number, hex: string, o: { line?: boolean } = {}): this {
    const x = Math.round(x0 * this.k + this.ox), y = Math.round(y0 * this.k + this.oy); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const c = hexRGB(hex), i = y * this.w + x; this.dir[i] = (c[0] << 16) | (c[1] << 8) | c[2]; this.noline[i] = o.line ? 0 : 1;
    if (!o.line) { this.mat[i] = -1; this.part[i] = this.n; }
    return this;
  }
  /** `rim`: the edges facing the light step lighter along the material's ramp and the far edges step darker; `contrast` stretches the shading around mid-tone */
  finish(fo: { rim?: boolean; contrast?: number } = {}): PixImg {
    const { w, h } = this, out = new Uint8ClampedArray(w * h * 4);
    const filled = (i: number): boolean => this.mat[i] >= 0 || this.dir[i] >= 0;
    const sel = new Uint8Array(w * h), outl: (RGB | undefined)[] = new Array(w * h);
    const nb: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!filled(i)) {
        let best = -1;
        for (const [dx, dy] of nb) {
          const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X;
          if (filled(j) && !this.noline[j] && this.mat[j] >= 0 && !MATS[this.mat[j]].emissive) { if (best < 0 || this.p[j] < this.p[best]) best = j; }
        }
        if (best >= 0) outl[i] = mixc(MATS[this.mat[best]].ramp[0], OUTLINE, 0.62);
      } else if (this.mat[i] >= 0 && !this.noline[i]) {
        for (const [dx, dy] of nb) {
          const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X;
          if (this.mat[j] >= 0 && !this.noline[j] && this.part[j] > this.part[i] && this.grp[j] !== this.grp[i]) { sel[i] = 1; break; }
        }
      }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, o = i * 4; let c: RGB | undefined;
      if (this.dir[i] >= 0) c = [(this.dir[i] >> 16) & 255, (this.dir[i] >> 8) & 255, this.dir[i] & 255];
      else if (this.mat[i] >= 0) {
        const m = MATS[this.mat[i]]; const pp = fo.contrast ? clamp(2.1 + (this.p[i] - 2.1) * fo.contrast, 0, 4) : this.p[i];
        c = sel[i] ? mixc(m.ramp[0], OUTLINE, 0.25) : shade(m.name, pp, x, y);
        if (!sel[i] && !m.emissive) {
          if (m.shiny && pp > 3.5) c = mixc(c, [255, 255, 255], 0.5);
          if (fo.rim) {
            const f = (dx: number, dy: number): boolean => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < w && Y < h && filled(Y * w + X); };
            // the rim moves along the material's own ramp (a step lighter toward the light, a step darker away), so it adds no new colours
            if (!f(-1, 0) || !f(0, -1) || !f(-1, -1)) c = shade(m.name, pp + 1.1, x, y);
            else if (!f(1, 0) || !f(0, 1) || !f(1, 1)) c = shade(m.name, pp - 0.7, x, y);
          }
        }
      }
      else if (outl[i]) c = outl[i];
      if (c) { out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255; }
    }
    // normal map from the height field (light comes from the upper left, so y points up the sprite)
    const normal = new Uint8ClampedArray(w * h * 4);
    const Hh = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : this.height[y * w + x]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, o = i * 4;
      if (!out[o + 3]) { normal[o] = 128; normal[o + 1] = 128; normal[o + 2] = 255; continue; }
      let nx = -(Hh(x + 1, y) - Hh(x - 1, y)) * 0.9, ny = (Hh(x, y + 1) - Hh(x, y - 1)) * 0.9; const nz = 1, l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l;
      normal[o] = Math.round((nx * 0.5 + 0.5) * 255); normal[o + 1] = Math.round((ny * 0.5 + 0.5) * 255); normal[o + 2] = Math.round(((nz / l) * 0.5 + 0.5) * 255); normal[o + 3] = 255;
    }
    return { w, h, rgba: out, normal };
  }
}

/** a tangent-space normal map from an image's luminance (for painted art that has no height data) */
export function normalFromImageData(src: Uint8ClampedArray, w: number, h: number, strength = 1.6): Uint8ClampedArray {
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = src[i * 4 + 3] ? (0.3 * src[i * 4] + 0.59 * src[i * 4 + 1] + 0.11 * src[i * 4 + 2]) / 255 : 0;
  const blur = new Float32Array(w * h);
  const L = (x: number, y: number): number => lum[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) blur[y * w + x] = (L(x, y) * 4 + L(x - 1, y) + L(x + 1, y) + L(x, y - 1) + L(x, y + 1)) / 8;
  const B = (x: number, y: number): number => blur[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    let nx = -(B(x + 1, y) - B(x - 1, y)) * strength * 2, ny = (B(x, y + 1) - B(x, y - 1)) * strength * 2; const l = Math.hypot(nx, ny, 1);
    nx /= l; ny /= l;
    out[o] = Math.round((nx * 0.5 + 0.5) * 255); out[o + 1] = Math.round((ny * 0.5 + 0.5) * 255); out[o + 2] = Math.round(((1 / l) * 0.5 + 0.5) * 255); out[o + 3] = 255;
  }
  return out;
}

export function toCanvas(img: PixImg, data: Uint8ClampedArray = img.rgba): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = img.w; cv.height = img.h;
  const x = ctx2d(cv);
  x.putImageData(new ImageData(new Uint8ClampedArray(data), img.w, img.h), 0, 0);
  return cv;
}
