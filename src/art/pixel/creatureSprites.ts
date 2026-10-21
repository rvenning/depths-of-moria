// The 18 creature families drawn natively with the pixel engine. The drawings are the same designs the old vector painter used
// (256-unit space, facing left), but every shape is shaded, dithered and outlined by the engine so they match the heroes.
import { Sprite, bayer, def, MAT_ID, toCanvas, type PixImg } from './engine.ts';
import type { CreatureFamily, EnemyDef } from '../../content/schema.ts';
import { shade as vshade, rand } from '../draw.ts';

type Pt = [number, number];
interface Pal { body: string; accent: string; eye: string; gear: string; has: (f: string) => boolean; seed: number }
interface K { S: Sprite; xf: { ox: number; oy: number; c: number; s: number } | null }

const METAL = '#9aa3ad';
const WOOD = '#6a4a2c';
const BONE = '#efe8d4';

// ---------------------------------------------------------------- colour → material
function toHex(c: string): string {
  if (c.startsWith('#')) return c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c.slice(0, 7);
  const m = c.match(/[\d.]+/g) ?? ['128', '128', '128'];
  return `#${m.slice(0, 3).map((x) => Math.max(0, Math.min(255, Math.round(Number(x)))).toString(16).padStart(2, '0')).join('')}`;
}
function mat(color: string, emissive = false): string {
  const hex = toHex(color), name = `${emissive ? 'ce' : 'c'}${hex}`;
  if (!(name in MAT_ID)) def(name, hex, { dither: emissive ? 0 : 0.2, spread: 0.15, emissive });
  return name;
}
const shade = (c: string, a: number): string => toHex(vshade(toHex(c), a));

// ---------------------------------------------------------------- the drawing kit (same names the painters always used)
const T = (k: K, p: Pt): Pt => (k.xf ? [k.xf.ox + p[0] * k.xf.c - p[1] * k.xf.s, k.xf.oy + p[0] * k.xf.s + p[1] * k.xf.c] : p);
const bez = (a: Pt, b: Pt, c: Pt, d: Pt, n = 10): Pt[] => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]] as Pt; });
/** closed Catmull-Rom blob through points */
function blob(pts: Pt[]): Pt[] {
  const out: Pt[] = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let t = 0; t < 1; t += 0.25) {
      const t2 = t * t, t3 = t2 * t;
      out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  return out;
}
const dims = (k: K, pts: Pt[]): [number, number] => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return [(Math.max(...xs) - Math.min(...xs)) * k.S.k, (Math.max(...ys) - Math.min(...ys)) * k.S.k]; };
const area = (k: K, pts: Pt[]): number => { const [w, h] = dims(k, pts); return w * h; };
/** the roundness of a shape follows its size: big bodies are well rounded, small details stay tight */
const bevelFor = (w: number, h: number): number => Math.max(2, Math.min(8, Math.min(w, h) * 0.42));

function poly(k: K, pts: Pt[], color: string, smooth = false, o: { flat?: boolean; grad?: number; emissive?: boolean; g?: string } = {}): void {
  const P = (smooth ? blob(pts) : pts).map((p) => T(k, p));
  const tiny = area(k, pts) < 30;
  const [bw, bh] = dims(k, pts);
  k.S.poly(P, mat(color, o.emissive), { bevel: bevelFor(bw, bh), flat: o.flat || o.emissive, tone: o.emissive ? 3.2 : 2.3, grad: o.grad ?? (bw * bh > 500 ? 0.45 : undefined), g: o.g ?? (tiny ? 'detail' : undefined), noLine: o.emissive });
}
function ellipse(k: K, cx: number, cy: number, rx: number, ry: number, color: string, o: { emissive?: boolean; g?: string } = {}): void {
  const [x, y] = T(k, [cx, cy]);
  const tiny = rx * ry * k.S.k * k.S.k < 6;
  k.S.ell(x, y, rx, ry, mat(color, o.emissive), { bevel: bevelFor(rx * 2 * k.S.k, ry * 2 * k.S.k), flat: o.emissive, tone: 3.2, grad: rx * ry * k.S.k * k.S.k > 120 ? 0.4 : undefined, g: o.g ?? (tiny ? 'detail' : undefined), noLine: o.emissive });
}
const circle = (k: K, cx: number, cy: number, r: number, color: string, o: { emissive?: boolean; g?: string } = {}): void => ellipse(k, cx, cy, r, r, color, o);
function limb(k: K, x1: number, y1: number, x2: number, y2: number, w1: number, w2: number, color: string, g?: string): void {
  k.S.line([T(k, [x1, y1]), T(k, [x2, y2])], w1, mat(color), { bevel: bevelFor(Math.min(w1, w2) * k.S.k, Math.min(w1, w2) * k.S.k * 1.5), g }, w2);
}
function pline(k: K, pts: Pt[], w: number, color: string, w2?: number, g?: string): void { k.S.line(pts.map((p) => T(k, p)), w, mat(color), { bevel: 3, g }, w2); }
function line(k: K, x1: number, y1: number, x2: number, y2: number, w: number, color: string): void {
  k.S.line([T(k, [x1, y1]), T(k, [x2, y2])], w, mat(color), { flat: true, tone: 2.6, g: 'detail' });
}
/** a glowing eye: a bright iris with a dark pupil and a highlight */
function eye(k: K, x: number, y: number, r: number, color: string, angry = 0): void {
  const [cx, cy] = T(k, [x, y]);
  k.S.ell(cx, cy, r * 1.15, r, mat(color, true), { flat: true, tone: 3.4, noLine: true });
  k.S.dot(x + r * 0.2 + (k.xf ? 0 : 0), y + angry * 0.2, '#150d20');
  k.S.dot(x - r * 0.25, y - r * 0.35, '#ffffff');
}

/** a narrow, malevolent slit of an eye (orcs and goblins) */
function slit(k: K, x: number, y: number, w: number, color: string, angry = 0): void {
  const [cx, cy] = T(k, [x, y]);
  k.S.ell(cx, cy, w * 1.1, w * 0.42, mat(color, true), { flat: true, tone: 3.4, noLine: true });
  k.S.dot(x, y + angry * 0.15, '#150d20');
}

// ---------------------------------------------------------------- shared bits
function horns(k: K, x: number, y: number, s: number, color: string, flip = 1): void {
  for (const d of [-1, 1]) poly(k, [[x + d * 10 * s, y], [x + d * 22 * s * flip, y - 26 * s], [x + d * 30 * s, y - 38 * s], [x + d * 24 * s, y - 8 * s], [x + d * 12 * s, y + 4 * s]], color, true);
}
function ears(k: K, x: number, y: number, s: number, color: string): void {
  poly(k, [[x - 6 * s, y], [x - 44 * s, y - 24 * s], [x - 38 * s, y + 4 * s], [x - 8 * s, y + 14 * s]], color, true);
  poly(k, [[x + 14 * s, y - 2], [x + 46 * s, y - 28 * s], [x + 40 * s, y + 2 * s], [x + 14 * s, y + 14 * s]], shade(color, -0.1), true);
}
function helm(k: K, x: number, y: number, s: number, color: string): void {
  poly(k, [[x - 20 * s, y + 4], [x - 18 * s, y - 20 * s], [x, y - 28 * s], [x + 18 * s, y - 20 * s], [x + 20 * s, y + 4]], color, true);
  line(k, x, y - 26 * s, x, y + 2, 3, shade(color, -0.35));
}
function fangs(k: K, x: number, y: number, s: number): void {
  for (const d of [-1, 1]) poly(k, [[x + d * 6 * s, y], [x + d * 9 * s, y + 12 * s], [x + d * 2 * s, y + 2]], BONE, false, { flat: true });
}
function xf<T>(k: K, x: number, y: number, ang: number, fn: () => T): T {
  const prev = k.xf; k.xf = { ox: x, oy: y, c: Math.cos(ang), s: Math.sin(ang) }; const r = fn(); k.xf = prev; return r;
}
function weaponAxe(k: K, x: number, y: number, ang: number, s: number): void {
  xf(k, x, y, ang, () => { limb(k, 0, 0, 0, -70 * s, 7 * s, 6 * s, WOOD, 'haft'); poly(k, [[-4 * s, -70 * s], [-34 * s, -80 * s], [-30 * s, -50 * s], [-4 * s, -52 * s]], METAL, true); });
}
function weaponSword(k: K, x: number, y: number, ang: number, s: number, color = METAL): void {
  xf(k, x, y, ang, () => { poly(k, [[-5 * s, 0], [5 * s, 0], [4 * s, -80 * s], [0, -92 * s], [-4 * s, -80 * s]], color); poly(k, [[-14 * s, 0], [14 * s, 0], [14 * s, 6 * s], [-14 * s, 6 * s]], '#6a5a3a'); limb(k, 0, 6 * s, 0, 22 * s, 6 * s, 6 * s, WOOD); });
}
function weaponClub(k: K, x: number, y: number, ang: number, s: number, color = WOOD): void {
  xf(k, x, y, ang, () => poly(k, [[-5 * s, 0], [5 * s, 0], [14 * s, -70 * s], [8 * s, -96 * s], [-10 * s, -96 * s], [-14 * s, -70 * s]], color, true));
}
function weaponSpear(k: K, x: number, y: number, ang: number, s: number): void {
  xf(k, x, y, ang, () => { limb(k, 0, 30 * s, 0, -90 * s, 5 * s, 5 * s, WOOD); poly(k, [[-8 * s, -90 * s], [0, -122 * s], [8 * s, -90 * s]], METAL); });
}
function weaponHammer(k: K, x: number, y: number, ang: number, s: number): void {
  xf(k, x, y, ang, () => { limb(k, 0, 0, 0, -86 * s, 8 * s, 7 * s, WOOD); poly(k, [[-26 * s, -86 * s], [26 * s, -86 * s], [26 * s, -120 * s], [-26 * s, -120 * s]], '#6a6e76'); });
}
function banner(k: K, x: number, y: number, s: number, color: string): void {
  limb(k, x, y, x, y - 130 * s, 5, 4, WOOD);
  poly(k, [[x, y - 130 * s], [x + 50 * s, y - 118 * s], [x + 38 * s, y - 100 * s], [x + 50 * s, y - 82 * s], [x, y - 92 * s]], color, true);
}
function plate(k: K, x: number, y: number, w: number, h: number, color: string): void {
  poly(k, [[x - w / 2, y], [x + w / 2, y], [x + w / 2 - 6, y + h], [x - w / 2 + 6, y + h]], color, true);
  for (const d of [-0.3, 0.3]) circle(k, x + d * w, y + h * 0.4, 2.5, shade(color, 0.4));
}
function wing(k: K, x: number, y: number, s: number, color: string, flip: number, bat = true): void {
  const d = flip;
  const pts: Pt[] = bat
    ? [[x, y], [x + d * 40 * s, y - 70 * s], [x + d * 90 * s, y - 80 * s], [x + d * 70 * s, y - 40 * s], [x + d * 100 * s, y - 20 * s], [x + d * 60 * s, y - 6 * s], [x + d * 70 * s, y + 20 * s], [x + d * 28 * s, y + 6 * s]]
    : [[x, y], [x + d * 50 * s, y - 80 * s], [x + d * 110 * s, y - 70 * s], [x + d * 80 * s, y - 20 * s], [x + d * 30 * s, y + 10 * s]];
  poly(k, pts, color, bat, { grad: 0.5 });
}
function tail(k: K, x: number, y: number, s: number, color: string, len = 70): void {
  pline(k, bez([x, y], [x + 30 * s, y + 10 * s], [x + len * s, y - 10 * s], [x + (len + 14) * s, y - 40 * s]), 9 * s, color, 4 * s);
}
function tentacle(k: K, x: number, y: number, ang: number, len: number, w: number, color: string, wob: number, amp = 14): void {
  const pts: Pt[] = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([Math.sin(t * 6 + wob) * amp * t, -t * len]); }
  xf(k, x, y, ang, () => pline(k, pts, w, color, w * 0.55));
}

// ---------------------------------------------------------------- families (all face LEFT)
type Painter = (k: K, p: Pal) => void;

/** the six goblins share a skeleton but not a silhouette: the feature list picks a fat grub, a spiked warchief, a caped captain, a lamp-lit tunneler, a hooded ambusher */
const goblin: Painter = (k, p) => {
  const fat = p.has('crown'), caped = p.has('cape'), warchief = p.has('horns') && p.has('axe'), scarf = p.has('hood'), lamp = p.has('pick');
  if (caped) poly(k, [[82, 124], [176, 124], [204, 222], [52, 228]], shade(p.accent, -0.2), true, { grad: 0.6 });                       // the captain's cape hangs behind him
  if (scarf) poly(k, [[84, 150], [172, 150], [196, 226], [62, 232], [76, 196]], shade(p.gear, -0.05), false, { grad: 0.5 });          // a tattered cloak with a ragged hem
  limb(k, 112, 190, 96, 232, fat ? 22 : 18, 14, shade(p.body, -0.1)); limb(k, 146, 190, 160, 232, fat ? 22 : 18, 14, shade(p.body, -0.2));
  ellipse(k, 92, 234, 16, 7, shade(p.gear, -0.2)); ellipse(k, 164, 234, 16, 7, shade(p.gear, -0.25));
  poly(k, [[96, 130], [164, 130], [176, 190], [84, 196]], p.gear, true);
  ellipse(k, 128, 150, fat ? 58 : 44, fat ? 58 : 50, p.body);
  if (fat) ellipse(k, 120, 168, 34, 26, shade(p.body, 0.18));                                                                         // a great pale belly
  poly(k, [[88, 182], [168, 182], [174, 204], [82, 204]], shade(p.gear, -0.1), true);
  if (caped || warchief) for (const x of [104, 128, 152]) circle(k, x, 192, 3, shade(p.accent, 0.2));                                  // studded belt
  if (warchief) for (const [x, y] of [[100, 208], [124, 212], [150, 208]]) { circle(k, x, y, 7, BONE); circle(k, x - 2.5, y - 1, 1.6, '#150d20'); circle(k, x + 2.5, y - 1, 1.6, '#150d20'); }   // trophy skulls
  limb(k, 166, 138, 190, 172, 15, 12, p.body);
  if (p.has('staff')) { limb(k, 194, 236, 194, 96, 7, 6, WOOD); circle(k, 194, 88, 10, p.accent, { emissive: true }); }
  else if (p.has('pick')) weaponHammer(k, 192, 176, 0.5, 0.7);
  else if (p.has('cleaver')) weaponSword(k, 192, 176, 0.6, caped ? 1.05 : 0.8, '#b9bfc6');
  else if (p.has('axe')) weaponAxe(k, 192, 176, 0.3, 0.9);
  else if (p.has('dagger')) weaponSword(k, 192, 176, 0.8, 0.5);
  else weaponSword(k, 192, 176, 0.7, 0.55, '#a8a49a');
  limb(k, 92, 138, 66, 170, 15, 12, p.body);
  if (scarf) weaponSword(k, 62, 176, -0.7, 0.45);                                                                                     // the ambusher carries a second dagger
  if (caped) { poly(k, [[92, 128], [128, 120], [164, 128], [156, 166], [100, 166]], '#8a8f98', true); circle(k, 128, 144, 6, '#d9b25f'); }   // a breastplate with a gold boss
  if (warchief || caped) for (const d of [-1, 1]) poly(k, [[128 + d * 36, 130], [128 + d * 62, 120], [128 + d * 66, 142], [128 + d * 40, 152]], '#6a6e76', true);   // pauldrons
  if (warchief) for (const d of [-1, 1]) poly(k, [[128 + d * 54, 124], [128 + d * 58, 100], [128 + d * 64, 124]], '#d8d0b8', false, { flat: true });   // shoulder spikes
  ears(k, 118, 98, caped || warchief ? 1.15 : 1, p.body);
  circle(k, 118, 98, 36, p.body);
  if (p.has('helm')) helm(k, 118, 80, 1.15, '#7a7f88');
  if (lamp) { circle(k, 118, 50, 8, '#fff0a0', { emissive: true }); poly(k, [[110, 56], [126, 56], [124, 64], [112, 64]], '#4a4a52'); for (const [x, y] of [[96, 112], [136, 108], [110, 122]]) circle(k, x, y, 2.5, '#2a2218'); }   // a miner's lamp and soot
  if (p.has('hood')) poly(k, [[80, 100], [118, 54], [158, 100], [150, 120], [86, 120]], p.gear, true);
  if (p.has('horns')) horns(k, 118, 66, caped ? 1.25 : 1, '#d8d0b8');
  if (p.has('crown')) { poly(k, [[90, 70], [98, 48], [108, 66], [118, 44], [128, 66], [138, 48], [146, 70]], '#d9b25f', false, { flat: true }); for (const x of [98, 118, 138]) circle(k, x, 62, 2.6, '#c8382a'); }
  slit(k, 104, 98, 7.5, p.eye, 1); slit(k, 130, 98, 7.5, p.eye, -1);
  if (p.has('ember')) for (const [x1, y1, x2, y2] of [[96, 150, 112, 184], [146, 140, 160, 178], [126, 160, 132, 196], [108, 84, 114, 104]]) line(k, x1, y1, x2, y2, 2.6, p.accent);   // glowing cracks
  if (warchief) for (const dy of [0, 7, 14]) line(k, 92, 106 + dy, 108, 112 + dy, 3, '#c8382a');                                       // war paint
  if (scarf) poly(k, [[86, 114], [150, 114], [146, 136], [92, 136]], shade(p.gear, -0.25), true);                                      // a scarf over the mouth
  else { poly(k, [[102, 118], [134, 118], [128, 128], [108, 128]], '#2a1410', false, { flat: true }); fangs(k, 118, 120, warchief || caped ? 1.1 : 0.8); }
};

const archer: Painter = (k, p) => {
  limb(k, 112, 190, 104, 232, 16, 13, shade(p.body, -0.1)); limb(k, 144, 190, 152, 232, 16, 13, shade(p.body, -0.2));
  poly(k, [[96, 130], [160, 130], [170, 204], [90, 204]], p.gear, true);
  ellipse(k, 128, 150, 38, 46, p.body);
  poly(k, [[92, 136], [164, 136], [150, 176], [108, 176]], p.gear, true);
  const bow: Pt[] = []; for (let a = -1.1; a <= 1.1; a += 0.15) bow.push([70 + 66 * Math.cos(a), 150 + 66 * Math.sin(a)]);
  pline(k, bow, 6, WOOD);
  line(k, bow[0][0], bow[0][1], bow[bow.length - 1][0], bow[bow.length - 1][1], 1.5, '#e9e2c8');
  line(k, 70, 150, 128, 150, 4, WOOD); poly(k, [[60, 144], [68, 150], [60, 156]], METAL);
  limb(k, 150, 144, 100, 150, 13, 11, p.body); limb(k, 96, 140, 74, 150, 12, 10, p.body);
  ears(k, 120, 100, 0.9, p.body);
  circle(k, 120, 100, 32, p.body);
  poly(k, [[84, 102], [120, 54], [158, 102], [150, 118], [90, 118]], p.gear, true);
  slit(k, 108, 100, 7, p.eye, 1); slit(k, 132, 100, 7, p.eye, -1);
  if (p.has('feather')) line(k, 140, 62, 156, 38, 4, '#d94a3a');
};

const bat: Painter = (k, p) => {
  if (p.has('crow')) {                                                                                                                                // a carrion crow
    wing(k, 118, 132, 1.15, '#1a1a22', -1, false); wing(k, 138, 132, 1.15, '#242430', 1, false);
    poly(k, [[116, 184], [140, 184], [150, 230], [128, 216], [106, 230]], p.body);
    limb(k, 120, 186, 116, 214, 5, 3, '#6a5a30'); limb(k, 138, 186, 142, 214, 5, 3, '#6a5a30');
    ellipse(k, 128, 152, 26, 38, p.body); circle(k, 128, 114, 22, p.body);
    poly(k, [[110, 110], [74, 118], [110, 128]], '#d8b040'); eye(k, 118, 108, 3.8, p.eye, 1);
    return;
  }
  wing(k, 118, 130, 1.3, shade(p.body, -0.15), -1); wing(k, 138, 130, 1.3, shade(p.body, -0.25), 1);
  ellipse(k, 128, 150, 28, 40, p.body);
  limb(k, 120, 184, 116, 214, 8, 6, p.accent); limb(k, 138, 184, 144, 214, 8, 6, p.accent);
  poly(k, [[110, 106], [100, 74], [120, 92]], p.body); poly(k, [[146, 106], [156, 74], [136, 92]], p.body);
  circle(k, 128, 114, 26, p.body);
  eye(k, 118, 112, 5, p.eye, 1); eye(k, 138, 112, 5, p.eye, -1);
  poly(k, [[118, 126], [138, 126], [128, 138]], '#2a1018', false, { flat: true }); fangs(k, 128, 126, 0.7);
};

const orc: Painter = (k, p) => {
  limb(k, 108, 188, 94, 234, 26, 20, shade(p.body, -0.12)); limb(k, 150, 188, 164, 234, 26, 20, shade(p.body, -0.22));
  ellipse(k, 90, 236, 22, 8, '#2a2420'); ellipse(k, 168, 236, 22, 8, '#2a2420');
  poly(k, [[76, 116], [184, 116], [170, 200], [88, 200]], p.body, true);
  if (p.has('plate')) { plate(k, 128, 124, 90, 64, p.gear); plate(k, 128, 190, 74, 18, shade(p.gear, -0.15)); }
  else poly(k, [[92, 150], [164, 150], [168, 204], [88, 204]], p.gear, true);
  if (p.has('whitehand')) {                                                                                                      // the white hand of the Ironworks
    poly(k, [[116, 156], [140, 156], [142, 180], [114, 180]], '#e8e8e0', false, { flat: true });
    for (let i = 0; i < 4; i++) poly(k, [[116 + i * 7, 156], [120 + i * 7, 156], [120 + i * 7, 138 - (i % 3 === 1 ? 4 : 0)], [117 + i * 7, 138 - (i % 3 === 1 ? 4 : 0)]], '#e8e8e0', false, { flat: true });
    poly(k, [[114, 170], [104, 160], [108, 156], [118, 164]], '#e8e8e0', false, { flat: true });
  }
  if (p.has('redeye')) { ellipse(k, 128, 158, 17, 9, '#c8201a', { emissive: true }); ellipse(k, 128, 158, 2.6, 8, '#150d20'); }              // the Red Eye of the Black Country
  ellipse(k, 74, 122, 22, 16, p.gear); ellipse(k, 184, 122, 22, 16, shade(p.gear, -0.1));
  limb(k, 182, 126, 212, 168, 22, 17, p.has('azog') ? '#8a8f98' : p.body); limb(k, 74, 126, 52, 166, 22, 17, p.body);
  if (p.has('azog')) for (const t of [0.3, 0.6]) circle(k, 182 + 30 * t, 126 + 42 * t, 4, '#c8ccd2');                                                      // rivets on the iron arm
  if (p.has('hammer')) weaponHammer(k, 214, 172, 0.45, 0.95);
  else if (p.has('axe')) weaponAxe(k, 214, 172, 0.35, 1.1);
  else if (p.has('sword')) weaponSword(k, 214, 172, 0.5, 1.0);
  else if (p.has('whip')) pline(k, bez([214, 172], [250, 150], [240, 100], [200, 80]), 5, '#4a2a1a');
  else if (p.has('chain')) { for (let i = 0; i < 7; i++) circle(k, 216 + i * 4, 176 - i * 10, 5, METAL); }
  else weaponClub(k, 214, 172, 0.45, 0.95);
  if (p.has('shield')) { poly(k, [[32, 150], [66, 140], [74, 192], [52, 216], [30, 192]], '#6a6e76', true); circle(k, 52, 174, 7, '#b99a4a'); }
  if (p.has('banner')) banner(k, 52, 190, 0.9, p.accent);
  if (p.has('drum')) { ellipse(k, 128, 170, 34, 22, WOOD); ellipse(k, 128, 160, 34, 12, '#e8d8b0'); }
  circle(k, 128, 90, 36, p.body);
  poly(k, [[96, 86], [160, 86], [158, 76], [98, 76]], shade(p.body, -0.25));
  if (p.has('helm')) helm(k, 128, 74, 1.25, '#6a6e76');
  slit(k, 114, 92, 8, p.eye, 1); slit(k, 142, 92, 8, p.eye, -1);
  if (p.has('azog')) { line(k, 106, 74, 122, 112, 2.6, '#d8d0c0'); line(k, 152, 74, 140, 104, 2.6, '#7a2a20'); }                                   // old scars
  if (p.has('gundabad')) { ellipse(k, 128, 122, 58, 13, '#6a5a46'); for (const d of [-1, 0, 1]) poly(k, [[128 + d * 22, 66], [128 + d * 26, 38], [128 + d * 14, 64]], '#b8a888', false, { flat: true }); }   // a fur collar and a spiked cap
  if (p.has('ember')) for (const [x1, y1, x2, y2] of [[96, 150, 112, 188], [150, 146, 164, 184], [126, 164, 134, 200]]) line(k, x1, y1, x2, y2, 2.8, p.accent);
  poly(k, [[104, 108], [152, 108], [146, 124], [110, 124]], '#2a1410', false, { flat: true });
  poly(k, [[108, 108], [112, 96], [118, 110]], BONE, false, { flat: true }); poly(k, [[148, 108], [144, 96], [138, 110]], BONE, false, { flat: true });
  if (p.has('horns')) horns(k, 128, 62, 1, '#d8d0b8');
};

const rat: Painter = (k, p) => {
  const PINK = '#d89a9a';
  pline(k, bez([196, 172], [240, 196], [252, 130], [232, 96]), 8, PINK, 3);                                                          // the long bare tail
  limb(k, 178, 182, 186, 232, 26, 16, shade(p.body, -0.2)); ellipse(k, 182, 234, 18, 6, PINK);
  limb(k, 92, 188, 88, 228, 14, 10, shade(p.body, -0.15)); ellipse(k, 84, 232, 11, 5, PINK); limb(k, 124, 190, 124, 230, 14, 10, shade(p.body, -0.25)); ellipse(k, 120, 234, 11, 5, PINK);
  ellipse(k, 140, 160, 58, 42, p.body);
  ellipse(k, 174, 172, 36, 40, p.body);                                                                                             // the hunched haunch
  ellipse(k, 124, 184, 44, 18, shade(p.body, 0.25));                                                                                // a paler belly
  poly(k, [[96, 118], [64, 128], [26, 150], [30, 160], [66, 166], [100, 160]], p.body, true);                                         // a long pointed head
  circle(k, 26, 152, 6, PINK);                                                                                                      // the nose
  for (const [x, y, ang] of [[40, 146, -0.5], [40, 152, 0.0], [42, 158, 0.5]]) line(k, x, y, x - 30, y + ang * 34, 1.6, '#d8d0c0');   // whiskers
  for (const d of [0, 1]) poly(k, [[100 - d * 12, 112], [92 - d * 14, 82], [118 - d * 12, 92]], d ? shade(p.body, -0.2) : p.body, true);
  circle(k, 100, 98, 11, PINK); circle(k, 88, 100, 9, shade(PINK, -0.25));                                                          // big round ears
  eye(k, 62, 134, 4.5, p.eye, 1);
  poly(k, [[34, 160], [38, 174], [44, 160]], BONE, false, { flat: true }); poly(k, [[46, 160], [50, 172], [54, 160]], BONE, false, { flat: true });   // two long front teeth
  if (p.has('scars')) { line(k, 110, 140, 140, 178, 2.5, '#d8c0a0'); line(k, 118, 134, 146, 170, 2.5, '#d8c0a0'); }
};

const warg: Painter = (k, p) => {
  // a lean wolf: bushy tail, hunched shoulders, a long snout with open jaws and tall pointed ears
  pline(k, bez([196, 150], [226, 150], [246, 120], [240, 80]), 20, p.body, 6);
  limb(k, 78, 180, 66, 232, 17, 11, shade(p.body, -0.15)); limb(k, 108, 186, 108, 232, 17, 11, shade(p.body, -0.25));
  limb(k, 178, 176, 188, 232, 20, 11, shade(p.body, -0.15)); limb(k, 150, 186, 150, 232, 20, 11, shade(p.body, -0.25));
  for (const x of [62, 106, 186, 148]) ellipse(k, x, 234, 11, 5, shade(p.body, -0.3));
  ellipse(k, 146, 152, 62, 38, p.body);
  ellipse(k, 100, 134, 36, 36, p.body);
  if (p.has('rider')) {                                                                                                                              // a Gundabad orc on its back
    poly(k, [[118, 124], [172, 124], [166, 86], [124, 86]], '#2a2a32', true);
    circle(k, 146, 70, 15, '#5a5a48'); poly(k, [[130, 66], [146, 46], [162, 66], [160, 62]], '#4a4a52', true);
    slit(k, 140, 71, 6, '#ff4a22', 1); slit(k, 154, 71, 6, '#ff4a22', -1);
    limb(k, 160, 100, 188, 118, 10, 8, '#5a5a48'); weaponSpear(k, 192, 122, 0.22, 0.95);
  }                                                                                                          // the raised shoulders
  if (p.has('ruff')) poly(k, [[80, 120], [96, 90], [108, 116], [122, 88], [134, 114], [150, 90], [158, 120], [140, 150], [90, 150]], shade(p.body, 0.15));
  ellipse(k, 130, 178, 40, 14, shade(p.body, 0.2));                                                                                                // a paler belly
  poly(k, [[104, 112], [70, 98], [28, 134], [24, 148], [60, 152], [104, 150]], p.body, true);                                                      // head and long snout
  poly(k, [[30, 150], [62, 154], [96, 152], [92, 168], [62, 172], [34, 162]], '#2a1018', false, { flat: true });                                    // open mouth
  poly(k, [[34, 156], [62, 176], [98, 160], [94, 152], [60, 158]], shade(p.body, -0.25), true);                                                    // lower jaw
  circle(k, 24, 138, 5, '#150d20');                                                                                                                // the nose
  for (const [x, y] of [[40, 154], [52, 156], [66, 156]]) poly(k, [[x - 2.5, y], [x, y + 11], [x + 2.5, y]], BONE, false, { flat: true });         // fangs
  for (const [x, y] of [[44, 168], [60, 170]]) poly(k, [[x - 2, y], [x, y - 8], [x + 2, y]], BONE, false, { flat: true });
  poly(k, [[86, 104], [86, 56], [112, 96]], p.body); poly(k, [[100, 100], [114, 54], [126, 104]], shade(p.body, -0.2));                         // tall pointed ears
  poly(k, [[90, 98], [90, 70], [104, 96]], '#d89a9a', false, { flat: true });
  eye(k, 70, 122, 5.5, p.eye, 1);
  if (p.has('ember')) { for (let i = 0; i < 6; i++) circle(k, 100 + i * 14, 124 + (i % 2) * 8, 3, '#ffb347', { emissive: true }); }
  if (p.has('scars')) { line(k, 110, 130, 140, 168, 2.5, '#d8c0a0'); line(k, 118, 126, 146, 160, 2.5, '#d8c0a0'); }
};

const troll: Painter = (k, p) => {
  limb(k, 104, 190, 90, 236, 34, 24, shade(p.body, -0.12)); limb(k, 156, 190, 170, 236, 34, 24, shade(p.body, -0.22));
  ellipse(k, 88, 238, 28, 9, '#3a3a34'); ellipse(k, 174, 238, 28, 9, '#3a3a34');
  ellipse(k, 128, 150, 66, 66, p.body);
  poly(k, [[76, 170], [180, 170], [172, 208], [84, 208]], p.gear, true);
  for (let i = 0; i < 6; i++) circle(k, 96 + i * 12, 130 + (i % 3) * 18, 6, shade(p.accent, 0.1));
  limb(k, 186, 112, 216, 172, 32, 22, p.body); limb(k, 70, 112, 38, 172, 32, 22, p.body);
  if (p.has('club')) weaponClub(k, 218, 178, 0.5, 1.25);
  else if (p.has('spear')) weaponSpear(k, 218, 178, 0.35, 1.2);
  else if (p.has('pillar')) { poly(k, [[208, 50], [242, 50], [240, 196], [212, 196]], '#9a968c', false, { grad: 0.6 }); poly(k, [[202, 40], [248, 40], [248, 54], [202, 54]], '#b0aca0'); }
  if (p.has('manacle')) for (const [x, y] of [[216, 172], [38, 172]]) { circle(k, x, y, 10, METAL); circle(k, x, y, 5.5, '#1a1a1e'); line(k, x, y + 8, x + (x > 128 ? 10 : -10), y + 36, 3, METAL); }
  if (p.has('chain')) for (let i = 0; i < 6; i++) circle(k, 40 + i * 5, 176 - i * 8, 5, METAL);
  circle(k, 130, 80, 30, p.body);
  poly(k, [[102, 84], [158, 84], [156, 72], [104, 72]], shade(p.body, -0.3));
  eye(k, 118, 82, 5, p.eye, 1); eye(k, 142, 82, 5, p.eye, -1);
  poly(k, [[110, 98], [150, 98], [146, 112], [114, 112]], '#2a1814', false, { flat: true });
  poly(k, [[114, 98], [118, 88], [122, 99]], BONE, false, { flat: true }); poly(k, [[146, 98], [142, 88], [138, 99]], BONE, false, { flat: true });
  if (p.has('crown')) poly(k, [[104, 56], [112, 36], [122, 54], [132, 32], [142, 54], [152, 36], [158, 56]], '#d9b25f', false, { flat: true });
};

const wraith: Painter = (k, p) => {
  const body: Pt[] = [...bez([128, 50], [68, 60], [60, 150], [54, 244]), [76, 232], [94, 250], [116, 232], [134, 252], [156, 232], [176, 250], [196, 236], ...bez([196, 236], [196, 150], [188, 60], [128, 50])];
  poly(k, body, shade(p.body, 0.05), false, { grad: 0.9 });
  ellipse(k, 128, 96, 30, 36, '#08060c', { g: 'face' });
  eye(k, 116, 94, 5.5, p.eye, 1); eye(k, 140, 94, 5.5, p.eye, -1);
  limb(k, 80, 140, 36, 170, 14, 6, p.body); limb(k, 176, 140, 214, 170, 14, 6, p.body);
  for (const x of [28, 40, 48]) line(k, 36, 170, x, 186, 2.5, shade(p.body, 0.3));
  if (p.has('quill')) line(k, 214, 170, 230, 120, 3, '#e9e2c8');
  if (p.has('scroll')) poly(k, [[196, 160], [226, 156], [228, 190], [198, 194]], '#d8c8a0');
  if (p.has('keys')) for (let i = 0; i < 3; i++) circle(k, 108 + i * 20, 168, 5, '#d9b25f');
  if (p.has('book')) poly(k, [[170, 164], [210, 156], [214, 192], [174, 200]], '#4a2a5a');
  if (p.has('wight')) {
    poly(k, [[84, 116], [172, 116], [166, 196], [90, 196]], shade(p.gear, 0.15), true);                                                                 // a rusted mail shirt
    for (let y = 124; y < 192; y += 9) for (let x = 94 + (y % 18 ? 0 : 5); x < 164; x += 10) circle(k, x, y, 1.6, shade(p.gear, 0.45));
    ellipse(k, 128, 94, 26, 30, '#cfd6cc', { g: 'face' });                                                                                              // a skull-pale face
    ellipse(k, 116, 90, 7, 9, '#08060c'); ellipse(k, 140, 90, 7, 9, '#08060c');
    circle(k, 116, 91, 2.6, p.eye, { emissive: true }); circle(k, 140, 91, 2.6, p.eye, { emissive: true });
    poly(k, [[118, 108], [138, 108], [134, 118], [122, 118]], '#08060c', false, { flat: true });
    for (const x of [122, 128, 134]) line(k, x, 108, x, 117, 1.4, '#cfd6cc');
  }
  if (p.has('weeds')) for (let i = 0; i < 6; i++) pline(k, bez([86 + i * 17, 124], [80 + i * 17, 154], [92 + i * 17, 186], [86 + i * 17, 226]), 3, '#3a5a3a');
  if (p.has('ringwraith')) {
    for (const x of [80, 176]) ellipse(k, x, 124, 22, 14, '#1a1a22');                                                                                    // black pauldrons
    ellipse(k, 128, 94, 34, 40, '#050408', { g: 'face' });                                                                                              // an empty hood
    circle(k, 121, 98, 2, p.eye, { emissive: true }); circle(k, 135, 98, 2, p.eye, { emissive: true });
    poly(k, [[108, 58], [128, 22], [148, 58]], '#2a2a34', true);
  }
  if (p.has('sword')) weaponSword(k, 214, 176, 0.5, 1.05, p.has('ringwraith') ? '#b8d0f0' : '#8a98a8');
  if (p.has('crown')) poly(k, [[98, 58], [106, 40], [116, 56], [128, 36], [140, 56], [150, 40], [158, 58]], '#d9b25f', false, { flat: true });
};

/** Gollum and his pale kin: a crouched, long-limbed thing with enormous eyes */
const gollum: Painter = (k, p) => {
  const skin = p.body, dark = shade(p.body, -0.25), creeper = p.has('creeper');
  limb(k, 176, 196, 160, 228, 13, 8, dark); ellipse(k, 150, 232, 18, 6, dark);                                                                          // back leg and a big flat foot
  limb(k, 190, 188, 204, 226, 12, 7, shade(p.body, -0.35)); ellipse(k, 208, 232, 14, 5, dark);
  ellipse(k, 150, 166, 48, 36, skin);                                                                                                                  // the hunched back
  ellipse(k, 180, 188, 28, 24, skin);
  if (!creeper) poly(k, [[160, 184], [206, 186], [200, 214], [190, 206], [180, 218], [168, 206], [160, 214]], p.gear, true);                           // a ragged loincloth
  limb(k, 110, 160, 88, 198, 11, 7, skin); limb(k, 128, 164, 120, 210, 11, 7, shade(p.body, -0.12));
  for (const [x, y] of [[84, 204], [116, 214]]) { ellipse(k, x, y, 9, 5, dark); for (const d of [-6, 0, 6]) line(k, x + d, y + 3, x + d - 2, y + 12, 2.5, dark); }
  if (!creeper) { poly(k, [[70, 204], [88, 198], [94, 210], [78, 214]], '#b8c8d8', true); circle(k, 76, 206, 1.8, '#10202a'); }                           // a raw fish
  for (let i = 0; i < 5; i++) circle(k, 120 + i * 16, 138 + Math.abs(i - 2) * 3, 3.2, shade(skin, 0.18));                                               // knobs of spine
  poly(k, [[96, 150], [132, 146], [134, 170], [104, 176]], skin, true);
  ellipse(k, 98, 128, 36, 32, skin);
  for (const d of [-1, 1]) poly(k, [[98 + d * 30, 120], [98 + d * 52, 100], [98 + d * 34, 138]], shade(skin, -0.08), true);                              // big thin ears
  if (!creeper) for (let i = 0; i < 5; i++) line(k, 84 + i * 8, 100, 80 + i * 10 + Math.sin(i) * 6, 78 + i * 2, 1.6, '#6a6a58');                       // a few wisps of hair
  circle(k, 82, 126, creeper ? 14 : 13, p.eye, { emissive: true }); circle(k, 114, 124, creeper ? 13 : 12, p.eye, { emissive: true });                  // the pale eyes
  circle(k, 80, 128, 6.5, '#101820'); circle(k, 112, 126, 6, '#101820'); circle(k, 77, 123, 2.2, '#ffffff'); circle(k, 109, 121, 2, '#ffffff');
  poly(k, [[78, 150], [112, 148], [108, 158], [84, 160]], '#2a1a18', false, { flat: true });
  for (const x of [84, 92, 100, 106]) poly(k, [[x, 150], [x + 3, 159], [x + 6, 150]], BONE, false, { flat: true });
};

/** the Watcher in the Water: seven arms from a black pool and two pale eyes below the surface */
const watcher: Painter = (k, p) => {
  const dark = shade(p.body, -0.3);
  ellipse(k, 128, 232, 108, 24, dark);
  for (const [rx, ry, col] of [[96, 18, shade(p.body, 0.1)], [64, 12, shade(p.body, 0.2)]] as const) ellipse(k, 128, 230, rx, ry, col);
  const arms: [number, number, number, number][] = [[40, -0.7, 120, 13], [66, -0.46, 150, 16], [96, -0.2, 176, 18], [128, 0.04, 198, 20], [158, 0.22, 170, 18], [186, 0.46, 146, 16], [214, 0.7, 112, 13]];
  arms.forEach(([x, ang, len, w], i) => tentacle(k, x, 226, ang, len, w, shade(p.body, i % 2 ? -0.12 : 0.05), i * 1.3, 30));
  ellipse(k, 128, 212, 40, 28, shade(p.body, -0.05));
  for (const x of [112, 144]) { ellipse(k, x, 205, 10, 7, p.eye, { emissive: true }); ellipse(k, x, 205, 2.4, 7, '#0a1410'); }                                  // pale eyes with slit pupils
  poly(k, [[100, 192], [156, 192], [150, 197], [106, 197]], shade(p.body, -0.4), false, { flat: true });                                                // a heavy brow
  poly(k, [[108, 222], [148, 222], [142, 232], [114, 232]], '#0a1410', false, { flat: true });
  for (const x of [100, 128, 156]) for (let i = 1; i < 6; i++) circle(k, x + Math.sin(i * 1.2) * 6, 226 - i * 26, 3.2, shade(p.accent, 0.3));       // suckers
  ellipse(k, 128, 236, 100, 10, shade(p.body, 0.25), { g: 'detail' });                                                                                    // the waterline over the arms' roots
};

const serpent: Painter = (k, p) => {
  const path: Pt[] = [...bez([200, 236], [240, 210], [200, 170], [160, 200], 8), ...bez([160, 200], [120, 232], [80, 220], [70, 190], 8), ...bez([70, 190], [60, 160], [100, 140], [96, 110], 8)];
  pline(k, path, 30, p.body);
  for (let i = 0; i < path.length; i += 3) ellipse(k, path[i][0], path[i][1], 5, 5, shade(p.accent, 0.1), { g: 'detail' });
  poly(k, [[60, 84], [100, 60], [132, 74], [130, 110], [96, 124], [66, 112]], p.body, true);
  eye(k, 88, 86, 5, p.eye, 1);
  poly(k, [[60, 106], [36, 112], [60, 118]], '#6a1a2a', false, { flat: true });
  fangs(k, 70, 112, 0.8);
  if (p.has('fins') || p.has('frill')) for (let i = 0; i < 5; i++) poly(k, [[100 + i * 6, 66 - i * 4], [108 + i * 6, 40 - i * 6], [112 + i * 6, 70 - i * 3]], p.accent);
};

const guardian: Painter = (k, p) => {
  limb(k, 112, 190, 106, 232, 20, 16, p.gear); limb(k, 144, 190, 150, 232, 20, 16, shade(p.gear, -0.2));
  ellipse(k, 102, 234, 18, 7, '#2a2a2e'); ellipse(k, 154, 234, 18, 7, '#2a2a2e');
  poly(k, [[96, 118], [160, 118], [168, 200], [88, 200]], p.body, true);
  plate(k, 128, 124, 70, 56, shade(p.gear, 0.1));
  if (p.has('cape')) poly(k, [[160, 120], [196, 160], [190, 232], [160, 200]], shade(p.accent, -0.2), true);
  limb(k, 164, 128, 188, 170, 16, 13, p.gear); limb(k, 92, 128, 70, 166, 16, 13, p.gear);
  if (p.has('dwarf')) weaponAxe(k, 190, 178, 0.35, 0.95);
  else if (p.has('sword')) weaponSword(k, 190, 176, 0.5, 1.0);
  else if (p.has('spear')) weaponSpear(k, 190, 180, 0.15, 1.0);
  else weaponSword(k, 190, 176, 0.45, 0.9, '#8a8f98');
  if (p.has('shield')) { poly(k, [[28, 146], [70, 136], [76, 190], [50, 214], [24, 190]], '#5a5e66', true); line(k, 50, 142, 50, 206, 3, shade('#5a5e66', 0.3)); }
  if (p.has('banner')) banner(k, 62, 190, 0.8, p.accent);
  if (p.has('robe')) poly(k, [[92, 190], [164, 190], [176, 240], [80, 240]], shade(p.body, -0.1), true);
  circle(k, 128, 90, 30, shade(p.body, 0.1));
  if (p.has('dwarf')) { poly(k, [[98, 100], [158, 100], [154, 152], [128, 180], [102, 152]], '#b8a888', true, { grad: 0.6 }); for (const y of [118, 136, 154]) line(k, 110, y, 146, y, 2, '#8a7a62'); }   // a long braided beard
  if (p.has('weeds')) for (let i = 0; i < 7; i++) pline(k, bez([92 + i * 12, 198], [88 + i * 12, 216], [98 + i * 12, 232], [92 + i * 12, 248]), 3, '#3f6a4a');
  if (p.has('helm')) { helm(k, 128, 84, 1.45, '#6a6e76'); poly(k, [[108, 90], [148, 90], [146, 100], [110, 100]], '#0a0a0e', false, { flat: true }); }
  else { ellipse(k, 118, 92, 8, 9, '#0a0a0e', { g: 'face' }); ellipse(k, 140, 92, 8, 9, '#0a0a0e', { g: 'face' }); }
  eye(k, 118, 92, 4, p.eye, 1); eye(k, 140, 92, 4, p.eye, -1);
};

const spider: Painter = (k, p) => {
  const big = p.has('shelob');
  if (big) for (const [x1, y1, x2, y2] of [[8, 8, 120, 130], [248, 8, 140, 130], [128, 0, 128, 118], [8, 124, 100, 152], [248, 124, 160, 152]]) line(k, x1, y1, x2, y2, 1.4, '#c8c8d8');   // her webs
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const b: Pt = [128 + side * 22, 150 + (i - 1.5) * 8], m: Pt = [128 + side * (70 + i * 6), 100 + i * 16], e: Pt = [128 + side * (96 + i * 12), 226];
    const pts: Pt[] = []; for (let t = 0; t <= 1.001; t += 0.125) { const u = 1 - t; pts.push([u * u * b[0] + 2 * u * t * m[0] + t * t * e[0], u * u * b[1] + 2 * u * t * m[1] + t * t * e[1]]); }
    pline(k, pts, big ? 11 : 6, shade(p.body, i % 2 ? -0.15 : 0), big ? 5 : 3);
  }
  ellipse(k, 150, 160, 44, 38, p.body);
  for (let i = 0; i < 4; i++) circle(k, 140 + i * 12, 152 + (i % 2) * 14, 4, p.accent);
  if (big) { ellipse(k, 170, 168, 30, 26, shade(p.body, -0.25)); for (let i = 0; i < 8; i++) circle(k, 148 + i * 9, 144 + (i % 3) * 15, 3.8, p.accent); poly(k, [[158, 160], [188, 160], [173, 178]], '#7a1a1a', false, { flat: true }); poly(k, [[164, 198], [182, 198], [173, 178]], '#7a1a1a', false, { flat: true}); }
  circle(k, 96, 150, 30, shade(p.body, 0.05));
  ([[84, 142], [96, 138], [108, 142], [90, 152], [102, 152], [96, 162]] as Pt[]).forEach(([x, y], i) => eye(k, x, y, i < 3 ? 4.5 : 3, p.eye, 0));
  for (const d of [-1, 1]) poly(k, [[96 + d * 6, 170], [96 + d * 10, 192], [96 + d * 2, 176]], '#e9e2c8', false, { flat: true });
  if (big) for (const x of [88, 104]) circle(k, x, 200, 2.8, '#9be83a', { emissive: true });                                                      // venom
};

const drake: Painter = (k, p) => {
  wing(k, 122, 120, 1.55, shade(p.accent, -0.3), -1); wing(k, 152, 120, 1.55, shade(p.accent, -0.12), 1);                                                  // two leathery wings
  pline(k, bez([190, 180], [238, 198], [252, 150], [238, 104]), 22, p.body, 5);                                                                           // a long lashing tail
  for (const [x, y] of [[212, 190], [238, 176], [246, 140], [240, 110]]) poly(k, [[x - 5, y], [x, y - 12], [x + 5, y]], shade(p.accent, 0.1), false, { flat: true });
  limb(k, 160, 190, 170, 234, 32, 16, shade(p.body, -0.2)); limb(k, 116, 192, 108, 234, 28, 14, shade(p.body, -0.1));
  for (const x of [172, 110]) { ellipse(k, x, 236, 18, 6, '#201814'); for (const d of [-8, 0, 8]) poly(k, [[x + d - 2, 236], [x + d, 246], [x + d + 2, 236]], BONE, false, { flat: true }); }
  ellipse(k, 142, 164, 64, 42, p.body);
  poly(k, [[94, 176], [190, 176], [180, 208], [104, 208]], shade(p.accent, 0.1), true);                                                                     // belly plates
  for (let i = 0; i < 5; i++) poly(k, [[104 + i * 18, 126], [112 + i * 18, 108 - (i % 2) * 6], [120 + i * 18, 126]], shade(p.accent, 0.05), false, { flat: true });   // a spined back
  pline(k, bez([100, 156], [66, 156], [58, 112], [66, 82]), 32, p.body, 22);                                                                              // the neck
  poly(k, [[30, 64], [74, 48], [102, 66], [94, 94], [46, 100]], p.body, true);                                                                            // head and snout
  poly(k, [[34, 92], [14, 104], [36, 112], [84, 104]], shade(p.body, -0.25));                                                                             // lower jaw
  poly(k, [[36, 94], [86, 94], [80, 104], [42, 104]], '#ffb040', false, { emissive: true });                                                              // fire in the maw
  for (const x of [40, 52, 64, 76]) poly(k, [[x - 3, 94], [x, 104], [x + 3, 94]], BONE, false, { flat: true });
  poly(k, [[74, 50], [94, 22], [98, 52]], shade(p.accent, 0.1)); poly(k, [[88, 56], [112, 32], [108, 64]], shade(p.accent, 0.05));                         // swept-back horns
  slit(k, 66, 72, 8, p.eye, 1);
  circle(k, 26, 76, 3, '#150d20');
};

const fiend: Painter = (k, p) => {
  if (p.has('wings')) { wing(k, 118, 130, 1.1, shade(p.accent, -0.25), -1); wing(k, 140, 130, 1.1, shade(p.accent, -0.35), 1); }
  tail(k, 150, 196, 1, p.body, 44);
  limb(k, 112, 188, 100, 232, 18, 14, shade(p.body, -0.1)); limb(k, 144, 188, 156, 232, 18, 14, shade(p.body, -0.2));
  ellipse(k, 128, 154, 38, 48, p.body);
  ellipse(k, 128, 156, 14, 18, p.accent, { emissive: true });
  limb(k, 160, 138, 190, 168, 14, 10, p.body); limb(k, 96, 138, 68, 168, 14, 10, p.body);
  if (p.has('staff')) { limb(k, 192, 230, 192, 90, 7, 6, WOOD); circle(k, 192, 84, 9, p.accent, { emissive: true }); }
  for (const x of [190, 66]) for (const d of [-8, 0, 8]) circle(k, x + d, 172 + Math.abs(d) * 0.3, 3, '#e9e2c8');
  circle(k, 128, 94, 30, p.body);
  horns(k, 128, 74, 1.1, p.has('horns') ? '#e9e2c8' : shade(p.accent, -0.3));
  eye(k, 116, 94, 5.5, p.eye, 1); eye(k, 140, 94, 5.5, p.eye, -1);
  poly(k, [[112, 110], [144, 110], [138, 122], [118, 122]], '#2a0a08', false, { flat: true }); fangs(k, 128, 112, 0.6);
  if (p.has('crown')) poly(k, [[102, 62], [110, 44], [120, 60], [128, 40], [136, 60], [146, 44], [154, 62]], '#d9b25f', false, { flat: true });
  if (p.has('hood')) poly(k, [[88, 98], [128, 52], [170, 98], [164, 118], [94, 118]], '#2a1a14', true);
};

const wisp: Painter = (k, p) => {
  const shape = (s: number): Pt[] => [...bez([128, 40], [176, 90], [190, 150], [148, 188], 8), ...bez([148, 188], [138, 216], [118, 216], [108, 188], 6), ...bez([108, 188], [66, 150], [80, 90], [128, 40], 8)].map(([x, y]) => [128 + (x - 128) * s, 140 + (y - 140) * s] as Pt);
  poly(k, shape(1), shade(p.accent, -0.1), false, { emissive: true });
  poly(k, shape(0.72), shade(p.accent, 0.35), false, { emissive: true });
  poly(k, shape(0.42), '#ffffff', false, { emissive: true });
  eye(k, 112, 130, 6, p.eye, 1); eye(k, 144, 130, 6, p.eye, -1);
  poly(k, [[112, 150], [144, 150], [138, 164], [118, 164]], '#0b0a0e', false, { flat: true });
  const r = rand(p.seed);
  for (let i = 0; i < 9; i++) circle(k, 70 + r() * 120, 60 + r() * 150, 1.5 + r() * 3, p.eye, { emissive: true });
  for (const d of [-1, 0, 1]) pline(k, bez([128 + d * 14, 200], [128 + d * 40, 224], [128 + d * 20, 240], [128 + d * 20, 246], 5), 6, p.accent, 2);
};

const golem: Painter = (k, p) => {
  poly(k, [[88, 190], [116, 190], [114, 236], [84, 236]], shade(p.body, -0.15));
  poly(k, [[142, 190], [170, 190], [174, 236], [144, 236]], shade(p.body, -0.25));
  poly(k, [[70, 100], [186, 100], [176, 198], [80, 198]], p.body);
  poly(k, [[102, 130], [154, 130], [150, 174], [106, 174]], '#1a0f0c', false, { flat: true });
  ellipse(k, 128, 152, 18, 18, p.accent, { emissive: true });
  for (let i = 0; i < 4; i++) line(k, 110, 138 + i * 10, 146, 138 + i * 10, 3, p.accent);
  poly(k, [[52, 100], [88, 100], [84, 150], [50, 146]], shade(p.body, 0.05));
  poly(k, [[168, 100], [204, 100], [208, 146], [172, 150]], shade(p.body, -0.1));
  poly(k, [[46, 148], [84, 152], [80, 192], [44, 188]], shade(p.body, -0.15));
  poly(k, [[172, 152], [210, 148], [212, 188], [176, 192]], shade(p.body, -0.2));
  if (p.has('hammer')) weaponHammer(k, 212, 192, 0.35, 1.3);
  if (p.has('pillar')) poly(k, [[192, 60], [222, 60], [222, 190], [192, 190]], '#9a968c');
  if (p.has('book')) poly(k, [[170, 130], [208, 124], [212, 164], [174, 170]], '#4a2a5a');
  if (p.has('rivets')) for (let i = 0; i < 6; i++) circle(k, 84 + i * 18, 108, 3, shade(p.body, 0.4));
  poly(k, [[96, 52], [160, 52], [166, 100], [90, 100]], shade(p.body, 0.08));
  poly(k, [[104, 74], [152, 74], [150, 86], [106, 86]], '#0a0a0e', false, { flat: true });
  eye(k, 116, 80, 4.5, p.eye, 0); eye(k, 140, 80, 4.5, p.eye, 0);
  if (p.has('furnace')) { poly(k, [[110, 20], [146, 20], [142, 54], [114, 54]], '#44484e'); ellipse(k, 128, 18, 11, 8, '#ff7a2a', { emissive: true }); }
};

const horror: Painter = (k, p) => {
  const r = rand(p.seed + 5);
  for (let i = 0; i < 7; i++) tentacle(k, 60 + i * 22, 236, (i - 3) * 0.28, 120 + r() * 70, 22 - Math.abs(i - 3) * 2, i % 2 ? shade(p.body, -0.15) : p.body, r() * 5);
  ellipse(k, 128, 150, 70, 62, p.body);
  ellipse(k, 128, 190, 56, 12, '#14081a', { g: 'mouth' });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI; poly(k, [[128 + Math.cos(a) * 52 - 4, 188 + Math.sin(a) * -6], [128 + Math.cos(a) * 52, 202], [128 + Math.cos(a) * 52 + 4, 188]], BONE, false, { flat: true }); }
  ([[104, 128], [128, 112], [152, 128], [116, 150], [140, 150]] as Pt[]).forEach(([x, y], i) => eye(k, x, y, i === 1 ? 9 : 6, p.eye, 0));
  if (p.has('fangs')) fangs(k, 128, 186, 1.4);
};

const balrog: Painter = (k, p) => {
  const lesser = !p.has('whip');                                                                                                                          // the Herald is a lesser spirit: no whip, a shorter blade
  wing(k, 96, 112, 1.65, shade(p.body, -0.1), -1); wing(k, 160, 112, 1.65, shade(p.body, -0.25), 1);
  limb(k, 108, 186, 90, 236, 40, 26, p.body); limb(k, 150, 186, 168, 236, 40, 26, shade(p.body, -0.15));
  for (const x of [88, 170]) poly(k, [[x - 22, 236], [x + 14, 236], [x + 18, 252], [x - 26, 252]], '#14080c');                                           // cloven hooves
  for (const [x, y] of [[96, 212], [166, 206], [112, 232], [150, 230]]) poly(k, [[x - 6, y + 8], [x, y - 14], [x + 6, y + 8]], p.accent, false, { emissive: true });   // flames at the knees
  poly(k, [[66, 114], [190, 114], [172, 200], [84, 200]], p.body, true, { grad: 0.6 });
  for (const [x1, y1, x2, y2] of [[100, 140, 118, 176], [150, 136, 138, 182], [126, 150, 124, 196], [88, 128, 106, 152]]) line(k, x1, y1, x2, y2, 3.4, p.accent);   // cracks of fire
  for (let i = 0; i < 11; i++) {                                                                                                                          // a mane of flame
    const a = -Math.PI * 0.97 + i * ((Math.PI * 0.94) / 10), cx = 128 + Math.cos(a) * 44, cy = 98 + Math.sin(a) * 38;
    poly(k, [[cx - 9, cy + 12], [cx + (i - 5) * 3, cy - 30 - (i % 3) * 12], [cx + 9, cy + 12]], i % 2 ? p.accent : p.eye, false, { emissive: true });
  }
  limb(k, 178, 120, 214, 152, 30, 20, p.body); limb(k, 78, 120, 44, 152, 30, 20, p.body);
  xf(k, 216, 156, 0.3, () => { const s = lesser ? 0.75 : 1; poly(k, [[-11 * s, 0], [11 * s, 0], [14 * s, -118 * s], [0, -150 * s], [-14 * s, -118 * s]], p.accent, false, { emissive: true }); poly(k, [[-4, 0], [4, 0], [5, -110 * s], [0, -130 * s], [-5, -110 * s]], p.eye, false, { emissive: true }); });   // a sword of flame
  if (!lesser) { pline(k, bez([44, 154], [6, 142], [14, 88], [48, 62]), 7, p.accent); pline(k, bez([48, 62], [64, 46], [40, 36], [30, 48]), 5, p.eye); }       // a whip of fire
  ellipse(k, 128, 86, 30, 35, shade(p.body, 0.08));
  horns(k, 128, 62, 1.7, '#2a1a20');
  if (p.has('crown')) poly(k, [[104, 54], [112, 36], [120, 52], [128, 30], [136, 52], [144, 36], [152, 54]], '#d9b25f', false, { flat: true });
  slit(k, 114, 86, 9, p.eye, 1); slit(k, 142, 86, 9, p.eye, -1);
  poly(k, [[110, 102], [146, 102], [140, 120], [116, 120]], '#ffb040', false, { emissive: true });                                                        // a glowing maw
  for (const x of [118, 128, 138]) poly(k, [[x - 3, 102], [x, 112], [x + 3, 102]], '#2a0a08', false, { flat: true });
};

const warden: Painter = (k, p) => {
  poly(k, [[84, 188], [120, 188], [118, 238], [78, 238]], shade(p.body, -0.2));
  poly(k, [[138, 188], [174, 188], [180, 238], [140, 238]], shade(p.body, -0.3));
  poly(k, [[66, 96], [190, 96], [178, 200], [78, 200]], p.body);
  if (p.has('portcullis')) {
    poly(k, [[90, 116], [166, 116], [166, 190], [90, 190]], '#2a2c32', false, { flat: true });
    for (let i = 0; i < 6; i++) line(k, 98 + i * 13, 118, 98 + i * 13, 188, 3, METAL);
    for (let i = 0; i < 4; i++) line(k, 92, 130 + i * 18, 164, 130 + i * 18, 3, METAL);
  }
  poly(k, [[40, 96], [82, 96], [78, 152], [36, 150]], shade(p.body, 0.05));
  poly(k, [[174, 96], [216, 96], [220, 150], [178, 152]], shade(p.body, -0.1));
  poly(k, [[34, 152], [78, 156], [72, 204], [30, 198]], shade(p.body, -0.15));
  poly(k, [[180, 156], [224, 152], [228, 198], [184, 204]], shade(p.body, -0.2));
  if (p.has('chains')) for (let i = 0; i < 8; i++) circle(k, 70 + i * 16, 140 + Math.sin(i) * 8, 5, METAL);
  if (p.has('shield')) poly(k, [[6, 140], [48, 130], [54, 198], [28, 226], [2, 198]], '#5a5e66', true);
  if (p.has('sword')) weaponSword(k, 230, 200, 0.2, 1.3);
  poly(k, [[92, 44], [164, 44], [172, 98], [84, 98]], shade(p.body, 0.1));
  poly(k, [[104, 66], [152, 66], [150, 80], [106, 80]], '#0a0a0e', false, { flat: true });
  eye(k, 116, 73, 4.5, p.eye, 0); eye(k, 140, 73, 4.5, p.eye, 0);
  if (p.has('helm')) poly(k, [[92, 44], [128, 24], [164, 44]], shade(p.body, 0.1));
};

const shadeF: Painter = (k, p) => {
  const body: Pt[] = [...bez([128, 40], [90, 50], [86, 120], [70, 160], 8), [50, 190], [86, 180], [84, 250], [120, 210], [136, 252], [160, 206], [186, 244], [180, 176], [210, 190], ...bez([210, 190], [190, 150], [176, 56], [128, 40], 8)];
  poly(k, body, shade(p.body, 0.1), false, { grad: 0.9 });
  limb(k, 74, 128, 28, 168, 16, 6, p.body); limb(k, 182, 128, 226, 168, 16, 6, p.body);
  for (const x of [18, 30, 40]) line(k, 28, 168, x, 190, 3, '#d8d0e8'); for (const x of [216, 226, 238]) line(k, 226, 168, x, 190, 3, '#d8d0e8');
  eye(k, 114, 84, 6, p.eye, 1); eye(k, 142, 84, 6, p.eye, -1);
  if (p.has('horns')) horns(k, 128, 56, 1.2, '#2a2230');
  if (p.has('crown')) poly(k, [[98, 44], [106, 22], [116, 40], [128, 16], [140, 40], [150, 22], [158, 44]], '#d8e8d0', false, { flat: true });
  if (p.has('helm')) helm(k, 128, 70, 1.2, '#3a3a4a');
  if (p.has('sword')) weaponSword(k, 232, 172, 0.3, 1.0, '#6a6a7a');
  if (p.has('cape')) poly(k, [[160, 100], [200, 140], [196, 230], [160, 190]], shade(p.accent, -0.3), true);
  if (p.has('eyes')) for (let i = 0; i < 3; i++) eye(k, 106 + i * 22, 126, 3.5, p.eye, 0);
};

const PAINTERS: Record<CreatureFamily, Painter> = {
  goblin, archer, bat, orc, warg, troll, wraith, serpent, guardian, spider, drake, fiend, wisp, golem, horror, balrog, warden, shade: shadeF,
};
/** ghosts and flames fade away at their lower edge instead of standing on the floor */
const FADES: Partial<Record<CreatureFamily, number>> = { wraith: 0.72, shade: 0.72, wisp: 0.8 };

/** draw one creature natively at `n` x `n` pixels (a 256-unit drawing scaled down) */
export function creatureImage(d: EnemyDef, n: number): PixImg {
  const S = new Sprite(n, n); S.k = n / 256;
  const pal: Pal = {
    body: toHex(d.palette.body), accent: toHex(d.palette.accent), eye: toHex(d.palette.eye), gear: toHex(d.palette.gear),
    has: (f) => !!d.features?.includes(f), seed: [...d.id].reduce((a, ch) => a + ch.charCodeAt(0), 0),
  };
  const has = (f: string): boolean => !!d.features?.includes(f);
  (has('watcher') ? watcher : has('gollum') || has('creeper') ? gollum : has('rat') ? rat : PAINTERS[d.family])({ S, xf: null }, pal);
  const img = S.finish({ rim: true, contrast: 1.12 });
  const ghost = has('ghost');
  const fade = FADES[d.family] ?? (ghost ? 0.64 : undefined);
  if (ghost) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((x * 7 + y * 13) % 17 === 0) { const i = (y * n + x) * 4; img.rgba[i + 3] = 0; if (img.normal) img.normal[i + 3] = 0; }   // a little see-through
  if (fade !== undefined) {
    const y0 = Math.round(n * fade);
    for (let y = y0; y < n; y++) for (let x = 0; x < n; x++) {
      if (bayer(x, y) < ((y - y0) / Math.max(1, n - y0)) * 1.05) { const i = (y * n + x) * 4; img.rgba[i + 3] = 0; if (img.normal) img.normal[i + 3] = 0; }
    }
  }
  return img;
}
export function creatureCanvases(d: EnemyDef, n: number): { color: HTMLCanvasElement; normal: HTMLCanvasElement } {
  const img = creatureImage(d, n);
  return { color: toCanvas(img), normal: toCanvas(img, img.normal) };
}

// ---------------------------------------------------------------- walk cycle
/** how each family moves: on legs (the lower part of the sprite swings), floating (a hover bob) or slithering (a wave along the body) */
export type WalkStyle = 'legs' | 'float' | 'slither';
export const WALK_STYLE: Record<CreatureFamily, WalkStyle> = {
  goblin: 'legs', archer: 'legs', orc: 'legs', warg: 'legs', troll: 'legs', guardian: 'legs', golem: 'legs', warden: 'legs', balrog: 'legs', drake: 'legs', fiend: 'legs', spider: 'legs',
  bat: 'float', wraith: 'float', wisp: 'float', shade: 'float', horror: 'float', serpent: 'slither',
};
export const WALK_FRAMES = 4;

/**
 * Frame `n` (0-3) of a four-frame walk cycle made from a finished sprite (pure pixels, with its normal map moved the same way):
 * legs - the upper body bobs up on the passing frames while the two halves of the lower body swing opposite ways (the feet most) and the
 * swinging foot lifts; float - a two-pixel hover and sway; slither - a sine wave runs along the body.
 */
export function walkImage(img: PixImg, style: WalkStyle, n: number): PixImg {
  const { w, h } = img, out = new Uint8ClampedArray(w * h * 4), nrm = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { nrm[i * 4] = 128; nrm[i * 4 + 1] = 128; nrm[i * 4 + 2] = 255; }
  // the opaque bounds: where the middle is, and where the feet are
  let x0 = w, x1 = -1, y1 = -1, y0 = h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (img.rgba[(y * w + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return { w, h, rgba: out, normal: nrm };
  const xm = (x0 + x1) / 2, cut = Math.round(y0 + (y1 - y0) * 0.66), amp = Math.max(2, Math.round((x1 - x0) / 34)), k = ((n % 4) + 4) % 4;
  const swingL = [1, 0, -1, 0][k], swingR = [-1, 0, 1, 0][k], liftL = [0, 1, 0, 0][k], liftR = [0, 0, 0, 1][k], bob = [0, -1, 0, -1][k];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sx = x, sy = y;
    if (style === 'legs') {
      if (y < cut) sy = Math.max(0, Math.min(cut - 1, y - bob));         // the upper body bobs; its last row stretches so no seam opens
      else {
        const r = (y - cut) / Math.max(1, y1 - cut), left = x < xm;
        sx = x - Math.round((left ? swingL : swingR) * amp * r);
        sy = Math.min(h - 1, y + (r > 0.45 ? (left ? liftL : liftR) * Math.max(1, Math.round(amp / 2)) : 0));
      }
    } else if (style === 'float') {
      sy = y - [0, -1, -2, -1][k]; sx = x - [0, 1, 0, -1][k];
    } else {
      sy = y - Math.round(Math.sin(((x - x0) / Math.max(1, x1 - x0)) * Math.PI * 3 + k * (Math.PI / 2)) * 2);
    }
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
    const si = (sy * w + sx) * 4, di = (y * w + x) * 4;
    if (!img.rgba[si + 3]) continue;
    out[di] = img.rgba[si]; out[di + 1] = img.rgba[si + 1]; out[di + 2] = img.rgba[si + 2]; out[di + 3] = 255;
    if (img.normal) { nrm[di] = img.normal[si]; nrm[di + 1] = img.normal[si + 1]; nrm[di + 2] = img.normal[si + 2]; nrm[di + 3] = 255; }
  }
  return { w, h, rgba: out, normal: nrm };
}
