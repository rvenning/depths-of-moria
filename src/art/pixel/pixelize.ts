// Turns a painted canvas into pixel art: box-filter down to the native size, quantise colours into a small
// hue-shifted palette with ordered dithering, drop stray pixels and (for sprites) add a clean 1px outline.
import { OUTLINE, bayer, hexRGB, hsl2rgb, mixc, normalFromImageData, rgb2hsl, type RGB } from './engine.ts';

export interface PixelizeOpts {
  outW: number; outH: number;
  /** add a 1px outline around the silhouette (sprites) */
  outline?: boolean;
  /** treat partial alpha as ordered-dither coverage (vignettes, glows) instead of a hard cut */
  alphaDither?: boolean;
  /** lightness steps, default 7 */
  levels?: number;
  /** how strongly to dither between lightness steps (0..1), default 0.5 */
  dither?: number;
  /** saturation multiplier */
  sat?: number;
  /** contrast around mid-grey, default 1.12 */
  contrast?: number;
}

const rot = (h: number, target: number, amt: number): number => { const d = ((target - h + 540) % 360) - 180; return (h + Math.max(-amt, Math.min(amt, d)) + 360) % 360; };

export function pixelize(src: HTMLCanvasElement, o: PixelizeOpts): HTMLCanvasElement {
  const { outW, outH } = o;
  const small = document.createElement('canvas'); small.width = outW; small.height = outH;
  const sx = small.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = 'high';
  sx.drawImage(src, 0, 0, src.width, src.height, 0, 0, outW, outH);
  const img = sx.getImageData(0, 0, outW, outH), d = img.data;
  const L = o.levels ?? 7, dith = o.dither ?? 0.5, satM = o.sat ?? 1.05, con = o.contrast ?? 1.12;
  const alive = new Uint8Array(outW * outH);
  for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
    const i = (y * outW + x) * 4, a = d[i + 3] / 255;
    const on = o.alphaDither ? a > bayer(x, y) * 0.96 + 0.02 : a >= 0.5;
    if (!on) { d[i + 3] = 0; continue; }
    alive[y * outW + x] = 1; d[i + 3] = 255;
    const [h, s0, l0] = rgb2hsl([d[i], d[i + 1], d[i + 2]]);
    const l = Math.max(0, Math.min(1, (l0 - 0.5) * con + 0.5));
    const lv = Math.max(0, Math.min(L - 1, Math.floor(l * (L - 1) + 0.5 + (bayer(x, y) - 0.5) * dith)));
    const lq = lv / (L - 1);
    const sq = Math.round(Math.min(1, s0 * satM) * 4) / 4;
    const hq = s0 < 0.07 ? h : Math.round(h / 15) * 15;
    const hh = lq < 0.5 ? rot(hq, 262, (0.5 - lq) * 30) : rot(hq, 54, (lq - 0.5) * 20);
    const c = hsl2rgb(hh, sq, 0.07 + lq * 0.86);
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
  }
  // stray single pixels
  const nb4: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
    if (!alive[y * outW + x]) continue;
    let n = 0; for (const [dx, dy] of nb4) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < outW && Y < outH && alive[Y * outW + X]) n++; }
    if (n === 0 && !o.alphaDither) { alive[y * outW + x] = 0; d[(y * outW + x) * 4 + 3] = 0; }
  }
  if (o.outline) {
    const copy = new Uint8ClampedArray(d);
    for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
      if (alive[y * outW + x]) continue;
      let best = -1, bl = 9;
      for (const [dx, dy] of nb4) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= outW || Y >= outH || !alive[Y * outW + X]) continue;
        const j = (Y * outW + X) * 4, l = copy[j] + copy[j + 1] + copy[j + 2]; if (best < 0 || l < bl) { best = j; bl = l; }
      }
      if (best >= 0) {
        const base: RGB = [copy[best], copy[best + 1], copy[best + 2]], [h, s, l] = rgb2hsl(base);
        const dark = hsl2rgb(rot(h, 262, 22), s * 0.7, l * 0.3), c = mixc(dark, OUTLINE, 0.55), i = (y * outW + x) * 4;
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
    }
  }
  sx.putImageData(img, 0, 0);
  return small;
}

/** copy `cv` into a canvas `pad` pixels larger on every side, repeating the edge pixels */
export function padCanvas(cv: HTMLCanvasElement, pad: number): HTMLCanvasElement {
  const o = document.createElement('canvas'); o.width = cv.width + pad * 2; o.height = cv.height + pad * 2;
  const x = o.getContext('2d') as CanvasRenderingContext2D; x.imageSmoothingEnabled = false;
  x.drawImage(cv, pad, pad);
  x.drawImage(cv, 0, 0, 1, cv.height, 0, pad, pad, cv.height); x.drawImage(cv, cv.width - 1, 0, 1, cv.height, cv.width + pad, pad, pad, cv.height);
  x.drawImage(o, 0, pad, o.width, 1, 0, 0, o.width, pad); x.drawImage(o, 0, pad + cv.height - 1, o.width, 1, 0, pad + cv.height, o.width, pad);
  return o;
}

/** a normal map (as a canvas) derived from the brightness of a painted/pixelised canvas, for dynamic lighting */
export function normalMapOf(cv: HTMLCanvasElement, strength = 1.6): HTMLCanvasElement {
  const x = cv.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  const d = x.getImageData(0, 0, cv.width, cv.height);
  const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height;
  (o.getContext('2d') as CanvasRenderingContext2D).putImageData(new ImageData(new Uint8ClampedArray(normalFromImageData(d.data, cv.width, cv.height, strength)), cv.width, cv.height), 0, 0);
  return o;
}

/** a blurred copy of a canvas (blur radius in native pixels). Uses the canvas filter where it exists, a down/up-sample otherwise. */
function blurred(cv: HTMLCanvasElement, px: number): HTMLCanvasElement {
  const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height;
  const x = o.getContext('2d') as CanvasRenderingContext2D;
  if (typeof (x as { filter?: string }).filter === 'string') { x.filter = `blur(${px}px)`; x.drawImage(cv, 0, 0); x.filter = 'none'; return o; }
  const k = Math.max(2, Math.round(px * 2)), s = document.createElement('canvas'); s.width = Math.ceil(cv.width / k); s.height = Math.ceil(cv.height / k);
  const sx = s.getContext('2d') as CanvasRenderingContext2D; sx.imageSmoothingQuality = 'high'; sx.drawImage(cv, 0, 0, s.width, s.height);
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(s, 0, 0, cv.width, cv.height);
  return o;
}

/**
 * Photographic depth of field for a backdrop: a soft base blur everywhere (`all`), and extra blur that grows toward
 * the top and bottom edges (`edge`), so the middle band, where the fight happens, stays crisp. Radii are in native pixels.
 */
export function depthBlur(cv: HTMLCanvasElement, o: { all?: number; edge?: number; band?: [number, number] }): HTMLCanvasElement {
  const base = o.all ? blurred(cv, o.all) : cv;
  if (!o.edge) return base;
  const [top, bottom] = o.band ?? [0.28, 0.72];
  const soft = blurred(cv, o.edge);
  const m = document.createElement('canvas'); m.width = cv.width; m.height = cv.height;
  const mx = m.getContext('2d') as CanvasRenderingContext2D;
  mx.drawImage(soft, 0, 0);
  mx.globalCompositeOperation = 'destination-in';
  const g = mx.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(top, 'rgba(0,0,0,0)'); g.addColorStop(bottom, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
  mx.fillStyle = g; mx.fillRect(0, 0, cv.width, cv.height);
  const out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height;
  const ox = out.getContext('2d') as CanvasRenderingContext2D;
  ox.drawImage(base, 0, 0); ox.drawImage(m, 0, 0);
  return out;
}

/** the same sprite breathing in: everything above `cut` (a fraction of the height) lifted `dy` pixels, the gap stitched */
export function breathe(cv: HTMLCanvasElement, dy = 1, cut = 0.58): HTMLCanvasElement {
  const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height;
  const x = o.getContext('2d') as CanvasRenderingContext2D; x.imageSmoothingEnabled = false;
  const y0 = Math.round(cv.height * cut);
  x.drawImage(cv, 0, y0, cv.width, cv.height - y0, 0, y0, cv.width, cv.height - y0);
  x.drawImage(cv, 0, 0, cv.width, y0, 0, -dy, cv.width, y0);
  x.drawImage(cv, 0, y0 - 1, cv.width, 1, 0, y0 - dy, cv.width, dy);
  return o;
}

/** the sprite with everything above `cut` (a fraction of its height) shifted by (dx, dy): a wind-up, a lunge, a flinch */
export function leanTop(cv: HTMLCanvasElement, dx: number, dy: number, cut = 0.55): HTMLCanvasElement {
  const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height;
  const x = o.getContext('2d') as CanvasRenderingContext2D; x.imageSmoothingEnabled = false;
  const y0 = Math.round(cv.height * cut);
  x.drawImage(cv, 0, y0, cv.width, cv.height - y0, 0, y0, cv.width, cv.height - y0);
  x.drawImage(cv, 0, 0, cv.width, y0, dx, dy, cv.width, y0);
  // stitch the seam between the shifted top and the planted legs
  x.drawImage(cv, 0, y0 - 1, cv.width, 1, 0, y0 - 1 + Math.min(0, dy), cv.width, 1 + Math.max(0, -dy));
  return o;
}

/** nearest-neighbour enlargement by an integer factor */
export function upscale(cv: HTMLCanvasElement, k: number): HTMLCanvasElement {
  const o = document.createElement('canvas'); o.width = cv.width * k; o.height = cv.height * k;
  const x = o.getContext('2d') as CanvasRenderingContext2D; x.imageSmoothingEnabled = false; x.drawImage(cv, 0, 0, o.width, o.height);
  return o;
}
export { hexRGB };
