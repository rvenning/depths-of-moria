/** Tiny procedural-painting toolkit shared by every sprite and backdrop. One ink pen, rim light, soft shadow. */

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}
/** a 2D context, or a clear error: a browser short of canvas memory hands back null, which used to surface as "cannot read properties of null (reading 'drawImage')" far from the cause */
export function ctx2d(c: HTMLCanvasElement, attrs?: CanvasRenderingContext2DSettings): Ctx {
  const x = c.getContext('2d', attrs);
  if (!x) throw new Error(`2D canvas unavailable (${c.width}x${c.height})`);
  return x;
}

export const INK = '#0b0a0e';

// ---------------------------------------------------------------- colour
export function hex(c: string): [number, number, number] {
  let s = c.replace('#', '');
  if (s.length === 3) s = s.split('').map((x) => x + x).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgb(r: number, g: number, b: number): string {
  const f = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
/** amt in -1..1: negative darkens toward black, positive lightens toward white */
export function shade(c: string, amt: number): string {
  const [r, g, b] = hex(c);
  if (amt >= 0) return rgb(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  return rgb(r * (1 + amt), g * (1 + amt), b * (1 + amt));
}
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a); const [r2, g2, b2] = hex(b);
  return rgb(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
export function alpha(c: string, a: number): string {
  const [r, g, b] = hex(c);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------------------------------------------------------------- seeded noise
export function rand(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// ---------------------------------------------------------------- shapes
export type Pt = [number, number];

export function pathPoly(c: Ctx, pts: Pt[], close = true): void {
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
  if (close) c.closePath();
}
/** smooth closed blob through points (Catmull-Rom → bezier) */
export function pathSmooth(c: Ctx, pts: Pt[], close = true, tension = 0.5): void {
  const n = pts.length;
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  const get = (i: number) => (close ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const last = close ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const t = tension / 3;
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t, p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t, p2[0], p2[1]);
  }
  if (close) c.closePath();
}

export interface Pen { lw: number; ink: string }
export const PEN: Pen = { lw: 3, ink: INK };

/** Fill the current path with a lit gradient and ink it. `box` gives the gradient extents. */
export function paint(c: Ctx, color: string, box: [number, number, number, number], pen: Pen = PEN, light = 0.22): void {
  const [x, y, w, h] = box;
  const g = c.createLinearGradient(x, y, x + w * 0.6, y + h);
  g.addColorStop(0, shade(color, light));
  g.addColorStop(0.55, color);
  g.addColorStop(1, shade(color, -light * 1.2));
  c.fillStyle = g;
  c.fill();
  if (pen.lw > 0) {
    c.lineWidth = pen.lw;
    c.strokeStyle = pen.ink;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.stroke();
  }
}

export function ellipse(c: Ctx, cx: number, cy: number, rx: number, ry: number, color: string, pen: Pen = PEN, light = 0.22): void {
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  paint(c, color, [cx - rx, cy - ry, rx * 2, ry * 2], pen, light);
}
export function circle(c: Ctx, cx: number, cy: number, r: number, color: string, pen: Pen = PEN, light = 0.22): void { ellipse(c, cx, cy, r, r, color, pen, light); }

export function poly(c: Ctx, pts: Pt[], color: string, pen: Pen = PEN, light = 0.22, smooth = false): void {
  if (smooth) pathSmooth(c, pts); else pathPoly(c, pts);
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs); const y = Math.min(...ys);
  paint(c, color, [x, y, Math.max(...xs) - x, Math.max(...ys) - y], pen, light);
}

export function limb(c: Ctx, x1: number, y1: number, x2: number, y2: number, w1: number, w2: number, color: string, pen: Pen = PEN): void {
  const a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
  const dx1 = Math.cos(a) * w1 / 2, dy1 = Math.sin(a) * w1 / 2;
  const dx2 = Math.cos(a) * w2 / 2, dy2 = Math.sin(a) * w2 / 2;
  c.beginPath();
  c.moveTo(x1 + dx1, y1 + dy1);
  c.lineTo(x2 + dx2, y2 + dy2);
  c.arc(x2, y2, w2 / 2, a, a + Math.PI, false);
  c.lineTo(x1 - dx1, y1 - dy1);
  c.arc(x1, y1, w1 / 2, a + Math.PI, a + Math.PI * 2, false);
  c.closePath();
  paint(c, color, [Math.min(x1, x2) - w1, Math.min(y1, y2) - w1, Math.abs(x2 - x1) + w1 * 2, Math.abs(y2 - y1) + w1 * 2], pen, 0.2);
}

export function line(c: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, color: string): void {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
  c.lineWidth = w; c.strokeStyle = color; c.lineCap = 'round'; c.stroke();
}

export function glow(c: Ctx, x: number, y: number, r: number, color: string, a = 0.8): void {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(color, a));
  g.addColorStop(0.4, alpha(color, a * 0.35));
  g.addColorStop(1, alpha(color, 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

export function eye(c: Ctx, x: number, y: number, r: number, color: string, angry = 0): void {
  glow(c, x, y, r * 3.2, color, 0.5);
  c.beginPath(); c.ellipse(x, y, r * 1.15, r, angry * 0.5, 0, Math.PI * 2);
  c.fillStyle = color; c.fill();
  c.lineWidth = 1.5; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.arc(x + r * 0.15, y, r * 0.38, 0, Math.PI * 2); c.fillStyle = INK; c.fill();
}

export function groundShadow(c: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save(); c.translate(0, 0); c.scale(1, ry / rx);
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy * (rx / ry), rx, 0, Math.PI * 2); c.fill(); c.restore();
}

/** rim light along the top-left of everything painted so far: composites a lit edge using the sprite's own alpha */
export function rimLight(cv: HTMLCanvasElement, color: string, dx = -3, dy = -3, a = 0.55): void {
  const c = ctx2d(cv);
  const tmp = makeCanvas(cv.width, cv.height);
  const t = ctx2d(tmp);
  t.drawImage(cv, 0, 0);
  t.globalCompositeOperation = 'destination-out';
  t.drawImage(cv, dx, dy);
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = alpha(color, a);
  t.fillRect(0, 0, cv.width, cv.height);
  c.save();
  c.globalCompositeOperation = 'source-atop';
  c.drawImage(tmp, 0, 0);
  c.restore();
}

/** soft vignette-darkening so that sprites sit in the scene */
export function stoneTexture(c: Ctx, x: number, y: number, w: number, h: number, base: string, seed: number, grain = 0.12): void {
  const r = rand(seed);
  c.fillStyle = base; c.fillRect(x, y, w, h);
  const n = Math.floor((w * h) / 90);
  for (let i = 0; i < n; i++) {
    const px = x + r() * w, py = y + r() * h;
    c.fillStyle = r() > 0.5 ? alpha('#ffffff', r() * grain * 0.6) : alpha('#000000', r() * grain);
    c.fillRect(px, py, 1 + r() * 3, 1 + r() * 2);
  }
}

export function toDataUrl(cv: HTMLCanvasElement): string { return cv.toDataURL('image/png'); }
