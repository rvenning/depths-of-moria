import { Sprite, def, toCanvas, type PixImg } from './engine.ts';
import type { HeroId } from '../../content/schema.ts';

// ---------------------------------------------------------------- materials
const SK = { dither: 0.05, shadowHue: 12, shadowShift: 10, spread: 0.11 };
def('skin', '#e9b088', SK); def('skinPale', '#f2cfaa', SK); def('skinDark', '#c98a60', SK);
def('hairDark', '#4b3426'); def('hairOrange', '#dc7428'); def('hairBrown', '#7d5232'); def('hairBlonde', '#f2dc8e'); def('hairWhite', '#ebe8f0', { spread: 0.13 }); def('hairSam', '#b27c3e');
def('tunicGreen', '#4f8242'); def('cloakGreen', '#2f5a4a'); def('leather', '#90603a'); def('leatherDark', '#4e3426');
def('steel', '#a5b2c6', { dither: 0.05, shiny: true }); def('steelDark', '#58627c'); def('mail', '#8493a9', { dither: 0.3, shiny: true });
def('gold', '#f0bc46', { dither: 0, shiny: true }); def('wood', '#96623a'); def('red', '#bd3e32');
def('robe', '#a6abb9', { spread: 0.14 }); def('hat', '#8c92a4'); def('jacket', '#8e5e3e'); def('hobCloak', '#728f6c');
def('tan', '#c4ad7e'); def('elfTunic', '#92ab7e'); def('elfCloak', '#41704f');
def('boroCloak', '#7a3a2c'); def('tabard', '#3d4560'); def('bone', '#f0e8d4', { dither: 0 }); def('jacketGreen', '#718046');
def('cyan', '#a8eeff', { emissive: true, dither: 0 });

const EYE = '#1d1322';
/** the finishing look of every hero: rim light and a little more contrast than the scenery */
const HERO_FINISH = { rim: true, contrast: 1.2 };
type Pt = [number, number];

/**
 * A pose: how far each part of the rig is moved from its rest position (pixels).
 * `up`/`lean` move the whole upper body, `hand`/`tip` the weapon hand and the weapon's tip, `rhand` the other hand,
 * `head` nods the head, `cape` swings the hem of a cloak or robe, `blink` closes the eyes.
 */
export interface Pose { stride?: number; up?: number; lean?: number; hand?: Pt; tip?: Pt; rhand?: Pt; head?: Pt; cape?: number; blink?: boolean; open?: boolean }

/** `strike` is the downward chop and `thrust` the level lunge; `cast` raises the hands and `cast2` sweeps them forward (each hero's second attack animation) */
export type HeroAnim = 'idle' | 'walk' | 'wind' | 'dash' | 'strike' | 'thrust' | 'hurt' | 'cast' | 'cast2' | 'win';
/** the frames of each animation; the battle scene plays `idle` in a loop and the others on events */
export const HERO_ANIMS: Record<HeroAnim, Pose[]> = {
  idle: [{}, { up: -1, cape: 1, hand: [0, -1], rhand: [0, -1] }, { up: -1, cape: 2, hand: [0, -1], rhand: [0, -1], head: [0, 1] }, { cape: 1, head: [0, 0], blink: true }],
  walk: [{ stride: 3, lean: 1, cape: 1 }, { stride: 0, up: -1, lean: 1, cape: 2 }, { stride: -3, lean: 1, cape: 1 }, { stride: 0, up: -1, lean: 1, cape: 0 }],
  wind: [{ lean: -3, up: 1, hand: [-5, -7], tip: [-14, 10], rhand: [2, -2], head: [-1, 0], cape: 2 }],
  dash: [{ lean: 4, up: 1, hand: [3, 3], tip: [6, 14], rhand: [-3, 1], head: [2, 1], cape: -4 }, { lean: 5, up: 0, hand: [4, 2], tip: [8, 12], rhand: [-4, 0], head: [3, 0], cape: -5 }],
  strike: [{ lean: 5, up: 1, hand: [7, 3], tip: [14, 26], rhand: [-3, 0], head: [2, 1], cape: -3 }, { lean: 3, up: 1, hand: [5, 5], tip: [10, 30], rhand: [-2, 1], head: [1, 1], cape: -1 }],
  thrust: [{ lean: -4, up: 0, hand: [-6, 2], tip: [-14, 0], rhand: [3, -1], head: [-1, 0], cape: 2 }, { lean: 6, up: 1, hand: [10, -1], tip: [24, -3], rhand: [-4, 0], head: [3, 0], cape: -5 }, { lean: 5, up: 1, hand: [9, 0], tip: [20, -2], rhand: [-3, 1], head: [2, 1], cape: -3 }],
  hurt: [{ lean: -4, up: 1, hand: [-3, 3], tip: [-8, 10], rhand: [-2, 3], head: [-2, 1], cape: 3, blink: true }],
  cast: [{ lean: -1, up: 0, hand: [1, -7], tip: [3, -6], rhand: [2, -9], cape: 1 }, { lean: 1, up: -1, hand: [2, -10], tip: [4, -8], rhand: [3, -12], cape: 2 }],
  cast2: [{ lean: -2, up: 0, hand: [-4, -2], tip: [-6, -4], rhand: [-5, -3], cape: 2 }, { lean: 2, up: -1, hand: [6, -4], tip: [9, -8], rhand: [8, -6], cape: -2 }, { lean: 3, up: 0, hand: [8, -2], tip: [12, -3], rhand: [9, -3], cape: -3 }],
  win: [{ up: -2, hand: [2, -13], tip: [-1, -12], rhand: [1, -13], head: [0, -1], cape: 2 }, { up: 0, hand: [2, -11], tip: [-1, -10], rhand: [1, -11], cape: 0 }],
};

/** a walking stride: parts named leg/boot/foot/feet A and B swing in opposite directions (feet move most; the forward foot lifts) */
function applyStride(S: Sprite, d: number): void {
  if (!d) return;
  const re = /^(leg|boot|foot|feet)([AB])$/;
  const shiftPts = (pts: Pt[], sign: number): Pt[] => pts.map(([x, y]) => [x + sign * d * Math.max(0, Math.min(1, (y - 56) / 24)), y - (sign * d > 0 ? 2 * Math.max(0, Math.min(1, (y - 70) / 12)) : 0)] as Pt);
  const poly = S.poly.bind(S), ell = S.ell.bind(S);
  S.poly = ((pts: Pt[], mat: string, o?: Parameters<Sprite['poly']>[2]) => { const m = o?.g ? re.exec(o.g) : null; return poly(m ? shiftPts(pts, m[2] === 'A' ? 1 : -1) : pts, mat, o); }) as Sprite['poly'];
  S.ell = ((cx: number, cy: number, rx: number, ry: number, mat: string, o?: Parameters<Sprite['ell']>[5]) => { const m = o?.g ? re.exec(o.g) : null; const sg = m ? (m[2] === 'A' ? 1 : -1) : 0; return ell(cx + sg * d, cy - (sg * d > 0 ? 2 : 0), rx, ry, mat, o); }) as Sprite['ell'];
}

/** swing the part of a cloak below y0 sideways, more the lower it hangs */
const sway = (pts: Pt[], amt: number, y0: number): Pt[] => pts.map(([x, y]) => [x + (y > y0 ? (amt * (y - y0)) / (82 - y0) : 0), y] as Pt);
/** a three-quarter face: a 2x3 near eye with a catch-light, and a second, 2x3 far eye two pixels along, so both always read at sprite scale */
const eyes = (S: Sprite, x: number, y: number, blink: boolean | undefined, iris = EYE): void => {
  if (blink) { for (const dx of [0, 1, 5, 6]) S.dot(x + dx, y + 1, iris); return; }
  for (const dx of [0, 1, 5, 6]) for (const dy of [0, 1, 2]) S.dot(x + dx, y + dy, iris);
  S.dot(x, y, '#ffffff'); S.dot(x + 5, y, '#e9e4ee');
};
const brow = (S: Sprite, x: number, y: number, c: string): void => { for (const dx of [0, 1, 2]) S.dot(x + dx, y, c); for (const dx of [5, 6, 7]) S.dot(x + dx, y, c); };
/** the offsets a pose resolves to */
const rig = (P: Pose): { up: number; lean: number; cape: number; h: Pt; t: Pt; r: Pt; hd: Pt } => ({ up: P.up ?? 0, lean: P.lean ?? 0, cape: P.cape ?? 0, h: P.hand ?? [0, 0], t: P.tip ?? [0, 0], r: P.rhand ?? [0, 0], hd: P.head ?? [0, 0] });
/** where a blade of length `len` ends when it points from the hand toward `to` (so a swing never shortens the sword) */
const fixedTip = (from: Pt, to: Pt, len: number): Pt => { const dx = to[0] - from[0], dy = to[1] - from[1], l = Math.hypot(dx, dy) || 1; return [from[0] + (dx * len) / l, from[1] + (dy * len) / l]; };
const mid = (a: Pt, b: Pt, k = 0.5): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];

// ---------------------------------------------------------------- heroes (72x92, feet at y=90)
function aragorn(P: Pose): PixImg {
  const { up, lean, cape, h, t, r, hd } = rig(P);
  const S = new Sprite(72, 92).at(0, 8);
  applyStride(S, P.stride ?? 0);
  S.poly(sway([[22, 28], [15, 38], [10, 58], [8, 80], [31, 81], [34, 58], [35, 30]], cape, 30), 'cloakGreen', { g: 'cloak', grad: 0.6, fold: { amp: 0.6, period: 7, angle: 0.2 }, bevel: 3 });
  S.poly([[23, 50], [30, 50], [29, 74], [22, 74]], 'leather', { g: 'legA', bevel: 3 });
  S.poly([[30, 50], [39, 50], [41, 74], [31, 74]], 'leather', { g: 'legB', bevel: 3 });
  S.poly([[20, 68], [30, 68], [31, 82], [17, 82]], 'leatherDark', { g: 'bootA', bevel: 3 }); S.poly([[30, 68], [40, 68], [45, 82], [31, 82]], 'leatherDark', { g: 'bootB', bevel: 3 });
  S.poly([[20, 68], [30, 68], [30, 71], [20, 71]], 'leather', { g: 'bootA', flat: true, tone: 2.6 }); S.poly([[30, 68], [40, 68], [40, 71], [31, 71]], 'leather', { g: 'bootB', flat: true, tone: 2.6 });
  S.at(lean, 8 + up);
  const sh: Pt = [22, 33], rh: Pt = add([16, 47], r);
  S.line([sh, mid(sh, rh)], 6, 'tunicGreen', { g: 'rarm', light: -0.5 }); S.ell(rh[0], rh[1], 3.4, 3.4, 'skin', { g: 'rarm' });
  S.rect(30, 24, 8, 8, 'skin', { g: 'neck', light: -0.8 });
  S.poly([[21, 29], [41, 29], [40, 51], [23, 51]], 'tunicGreen', { g: 'torso', bevel: 5, grad: 0.5, fold: { amp: 0.25, period: 6, angle: 1.3 } });
  S.poly([[23, 46], [40, 46], [40, 51], [23, 51]], 'leatherDark', { g: 'torso', flat: true, tone: 1.8 }); S.rect(30, 46, 4, 5, 'gold', { g: 'torso', flat: true, tone: 3 });
  S.poly([[27, 29], [35, 29], [31, 38]], 'skin', { g: 'torso', flat: true, tone: 1.6 });
  const H = add([53, 38], h), E = add([46, 37], [h[0] * 0.6, h[1] * 0.6]);
  S.line([[39, 33], E], 6, 'tunicGreen', { g: 'farm' }); S.line([add(E, [-1, 0]), H], 5.5, 'leather', { g: 'farm' }); S.ell(H[0], H[1], 3.6, 3.6, 'skin', { g: 'farm' });
  S.line([add(H, [-1, -1]), fixedTip(H, add([58, 8], t), 31)], 3.6, 'steel', { g: 'sword', bevel: 1.8 }, 2.2); S.line([add([46, 37], h), add([59, 39], h)], 3, 'gold', { g: 'guard', bevel: 1.5 });
  S.ell(H[0], H[1], 3.2, 3.2, 'skin', { g: 'farm', light: 0.4 });      // the fist closes over the hilt
  S.ell(40, 31, 5.5, 4.5, 'steel', { g: 'pauld' });
  S.poly([[24, 51], [29, 51], [29, 58], [24, 58]], 'leather', { g: 'pouch', bevel: 1.8 }); S.dot(26, 52, '#f0bc46');   // belt pouch
  S.dot(24, 31, '#f0bc46'); S.dot(25, 31, '#f0bc46'); S.dot(24, 32, '#c89a30');   // cloak brooch
  for (const [x, y] of [[31, 31], [30, 33], [32, 33], [31, 35]]) S.dot(x, y, '#d9c9a0');   // tunic lacing
  for (const x of [24, 25, 35, 36]) S.dot(x, 70, '#d8a838');   // boot buckles
  S.at(lean + hd[0], 8 + up + hd[1]);
  S.poly([[20, 14], [24, 6], [32, 3], [41, 7], [43, 15], [36, 13], [26, 13], [25, 31], [18, 32]], 'hairDark', { g: 'hbk', bevel: 3 });
  S.ell(32, 17, 10, 11, 'skin', { g: 'head', bevel: 6 });
  S.poly([[22, 13], [25, 6], [32, 4], [40, 7], [42, 13], [39, 11], [34, 9], [29, 11], [25, 14]], 'hairDark', { g: 'head', bevel: 2.5 });
  eyes(S, 35, 16, P.blink); brow(S, 34, 14, '#3a281e');
  S.dot(42, 20, '#c98a62'); S.dot(41, 20, '#d49870'); S.dot(38, 23, '#a5604a'); S.dot(39, 23, '#a5604a'); S.dot(40, 23, '#a5604a');
  for (let x = 32; x <= 41; x += 2) S.dot(x, 25, '#a87455');
  return S.finish(HERO_FINISH);
}
/** both eyes show, either side of the helmet's nasal bar (x 36–37): a 2×3 near eye and a slimmer far eye, each with a catch-light */
function gimliEyes(S: Sprite, blink: boolean | undefined): void {
  if (blink) { for (const x of [32, 33, 39, 40]) S.dot(x, 41, EYE); return; }
  for (const [x, w] of [[32, 2], [39, 2]] as const) for (let dx = 0; dx < w; dx++) for (const y of [40, 41, 42]) S.dot(x + dx, y, EYE);
  S.dot(32, 40, '#ffffff'); S.dot(39, 40, '#ffffff');
}
function gimli(P: Pose): PixImg {
  const { up, lean, h, t, r, hd } = rig(P);
  const S = new Sprite(72, 92).at(0, 8);
  applyStride(S, P.stride ?? 0);
  S.poly([[21, 70], [31, 70], [30, 82], [19, 82]], 'leatherDark', { g: 'legA' }); S.poly([[33, 70], [45, 70], [47, 82], [34, 82]], 'leatherDark', { g: 'legB' });
  S.poly([[17, 76], [31, 76], [32, 83], [14, 83]], 'steelDark', { g: 'legA', bevel: 2 }); S.poly([[33, 76], [47, 76], [51, 83], [33, 83]], 'steelDark', { g: 'legB', bevel: 2 });
  S.at(lean, 8 + up);
  const rh = add([12, 69], r);
  S.line([[18, 54], mid([18, 54], rh, 0.9)], 8, 'mail', { g: 'rarm', light: -0.5 }); S.ell(rh[0], rh[1], 4.2, 4.2, 'skin', { g: 'rarm' });
  S.poly([[16, 50], [50, 50], [48, 73], [18, 73]], 'mail', { g: 'torso', bevel: 6, tex: 0.5, grad: 0.5 });
  S.poly([[18, 66], [48, 66], [48, 71], [18, 71]], 'leather', { g: 'torso', flat: true, tone: 2 }); S.rect(30, 66, 6, 5, 'gold', { g: 'torso', flat: true, tone: 3 });
  for (const [x, y] of [[22, 56], [26, 53], [42, 56], [45, 60], [22, 62]]) S.dot(x, y, '#d6dbe6');   // mail rivets
  const H = add([56, 44], h);
  S.line([[46, 54], mid([46, 54], H, 0.9)], 8, 'mail', { g: 'farm', tex: 0.4 }); S.ell(H[0], H[1], 4.4, 4.4, 'skin', { g: 'farm' });
  const top = add([62, 16], t), base = add([58, 52], h);
  S.line([base, top], 3.4, 'wood', { g: 'haft', bevel: 1.7 });
  const ax = (dx: number, dy: number): Pt[] => ([[55, 6], [66, 3], [69, 14], [66, 26], [58, 27], [57, 20]] as Pt[]).map(([x, y]) => [x + dx, y + dy] as Pt);
  S.poly(ax(t[0] * 0.85 + h[0] * 0.15, t[1] * 0.85 + h[1] * 0.15), 'steel', { g: 'axe', bevel: 3.5 });
  S.at(lean + hd[0], 8 + up + hd[1]);
  S.ell(33, 40, 10, 9, 'skin', { g: 'head', bevel: 5 });
  S.poly([[23, 44], [43, 44], [47, 54], [43, 64], [33, 70], [24, 64], [19, 54]], 'hairOrange', { g: 'beard', bevel: 6, tex: 0.7, fold: { amp: 0.35, period: 4, angle: 1.5 } });
  S.poly([[22, 38], [24, 30], [33, 26], [42, 30], [44, 38]], 'steel', { g: 'helm', bevel: 4 });
  S.rect(21, 36, 24, 4, 'steelDark', { g: 'helm', flat: true, tone: 2.2 }); S.rect(36, 38, 2, 9, 'steel', { g: 'helm', bevel: 1 });   // the nasal bar sits between the eyes, not over one of them
  S.poly([[31, 27], [34, 17], [38, 27]], 'red', { g: 'crest' });
  for (const x of [24, 29, 41]) S.dot(x, 37, '#d6dbe6');   // helmet rivets
  for (const [x, y] of [[29, 62], [37, 62]]) { S.dot(x, y, '#f0bc46'); S.dot(x + 1, y, '#c89a30'); }   // beard rings
  gimliEyes(S, P.blink); brow(S, 31, 39, '#5a3a1e'); for (const x of [38, 39, 40]) S.dot(x, 39, '#5a3a1e'); S.dot(40, 46, '#d98a62'); S.dot(41, 46, '#d98a62');
  return S.finish(HERO_FINISH);
}
function frodo(P: Pose): PixImg {
  const { up, lean, cape, h, t, r, hd } = rig(P);
  const S = new Sprite(72, 92).at(0, 8);
  applyStride(S, P.stride ?? 0);
  S.poly(sway([[22, 56], [15, 68], [13, 82], [46, 82], [44, 68], [40, 56]], cape, 58), 'hobCloak', { g: 'cloak', grad: 0.5, fold: { amp: 0.5, period: 7, angle: 0.15 }, bevel: 3 });
  S.poly([[26, 71], [31, 71], [31, 79], [26, 79]], 'tan', { g: 'legA' }); S.poly([[34, 71], [39, 71], [40, 79], [34, 79]], 'tan', { g: 'legB' });
  S.ell(28, 81, 7, 3, 'skin', { g: 'footA', bevel: 2 }); S.ell(41, 81, 7, 3, 'skin', { g: 'footB', bevel: 2 });
  for (const x of [24, 27, 30, 38, 41, 44]) S.dot(x, 80, '#a8714f');
  S.at(lean, 8 + up);
  const rh = add([20, 73], r);
  S.line([[24, 62], mid([24, 62], rh, 0.9)], 5, 'jacket', { g: 'rarm', light: -0.5 }); S.ell(rh[0], rh[1], 3, 3, 'skin', { g: 'rarm' });
  S.poly([[24, 58], [40, 58], [41, 74], [23, 74]], 'jacket', { g: 'torso', bevel: 4, grad: 0.4 });
  for (const y of [62, 66, 70]) S.dot(32, y, '#f0bc46');
  for (const [x, y] of [[28, 59], [29, 60], [35, 59], [34, 60]]) S.dot(x, y, '#e8e2cc');   // shirt collar
  S.dot(25, 61, '#9fe08a'); S.dot(26, 62, '#9fe08a'); S.dot(25, 62, '#6fb868');   // the Lorien leaf brooch
  const H = add([50, 65], h);
  S.line([[40, 61], mid([40, 61], H, 0.9)], 5, 'jacket', { g: 'farm' }); S.ell(H[0], H[1], 3.2, 3.2, 'skin', { g: 'farm' });
  S.line([add(H, [2, -1]), add([63, 50], t)], 3, 'cyan', { g: 'sting', flat: true, tone: 3.2, noLine: true });
  S.dot(31, 57, '#f0bc46'); S.dot(32, 58, '#f0bc46');
  S.at(lean + hd[0], 8 + up + hd[1]);
  S.ell(32, 46, 11, 12, 'skin', { g: 'head', bevel: 6 });
  for (const [x, y] of [[21, 47], [21, 41], [24, 36], [29, 33], [35, 33], [40, 36], [43, 41]]) S.ell(x, y, 4.6, 4.6, 'hairBrown', { g: 'head', bevel: 2.5 });
  S.ell(32, 46, 10, 11, 'skin', { g: 'head', bevel: 6 });
  S.poly([[24, 40], [28, 36], [34, 35], [40, 38], [42, 42], [36, 40], [29, 41]], 'hairBrown', { g: 'head', bevel: 2 });
  eyes(S, 35, 46, P.blink); S.dot(37, 51, '#dc8c70'); S.dot(40, 51, '#dc8c70'); S.dot(42, 50, '#cf936b'); S.dot(38, 53, '#a5604a'); S.dot(39, 53, '#a5604a');
  S.poly([[24, 46], [20, 41], [26, 45]], 'skin', { g: 'head' });
  return S.finish(HERO_FINISH);
}
function legolas(P: Pose): PixImg {
  const { up, lean, cape, h, t, r, hd } = rig(P);
  const S = new Sprite(72, 92).at(0, 8);
  applyStride(S, P.stride ?? 0);
  S.poly(sway([[23, 27], [16, 36], [14, 58], [26, 56], [28, 30]], cape * 0.6, 40), 'elfCloak', { g: 'cloak', fold: { amp: 0.5, period: 6, angle: 0.1 }, bevel: 3 });
  S.poly([[26, 50], [32, 50], [31, 74], [26, 74]], 'tan', { g: 'legA' }); S.poly([[32, 50], [38, 50], [40, 74], [33, 74]], 'tan', { g: 'legB' });
  S.poly([[25, 60], [32, 60], [32, 82], [22, 82]], 'leatherDark', { g: 'bootA', bevel: 2.5 }); S.poly([[32, 60], [39, 60], [44, 82], [32, 82]], 'leatherDark', { g: 'bootB', bevel: 2.5 });
  S.at(lean, 8 + up);
  S.poly([[20, 26], [26, 24], [32, 50], [27, 52]], 'leather', { g: 'quiver', bevel: 2.5 });
  for (const [x, y] of [[21, 22], [24, 21], [27, 22]]) { S.dot(x, y, '#f0e8d4'); S.dot(x, y + 1, '#d8c8a0'); S.dot(x, y + 2, '#a89868'); }
  S.rect(29, 24, 8, 8, 'skinPale', { g: 'neck', light: -0.8 });
  S.poly([[24, 29], [40, 29], [38, 50], [26, 50]], 'elfTunic', { g: 'torso', bevel: 4, grad: 0.4, fold: { amp: 0.25, period: 6, angle: 1.3 } });
  S.poly([[26, 44], [38, 44], [38, 48], [26, 48]], 'leather', { g: 'torso', flat: true, tone: 2 }); S.rect(31, 44, 3, 4, 'gold', { g: 'torso', flat: true, tone: 3 });
  for (let i = 0; i <= 10; i++) { S.dot(26 + i, 30 + i * 1.6, '#7a5234'); S.dot(27 + i, 30 + i * 1.6, '#5a3a1e'); }   // quiver strap across the chest
  S.dot(31, 38, '#f0bc46');
  for (const x of [27, 30, 33, 36]) S.dot(x, 49, '#c8d8a8');   // leaf trim on the hem
  const H = add([53, 37], h);
  S.line([[38, 32], mid([38, 32], H, 0.9)], 5, 'elfTunic', { g: 'farm' }); S.ell(H[0], H[1], 3.2, 3.2, 'skinPale', { g: 'farm' });
  const bow = ([[54, 10], [62, 22], [64, 38], [62, 54], [54, 66]] as Pt[]).map(([x, y]) => add([x, y], [h[0] * 0.5, h[1] * 0.5]));
  const pull = add([44, 38], r);
  S.line(bow, 3, 'wood', { g: 'bow', bevel: 1.5 });
  S.line([bow[0], pull, bow[4]], 1, 'bone', { g: 'str', flat: true, tone: 3, noLine: true });
  S.line([pull, add([61, 38], r)], 1.4, 'wood', { g: 'arrow', flat: true, tone: 2.6, noLine: true });
  S.dot(62 + r[0], 37 + r[1], '#cfd8e6'); S.dot(62 + r[0], 38 + r[1], '#cfd8e6'); S.dot(62 + r[0], 39 + r[1], '#cfd8e6'); S.dot(45 + r[0], 37 + r[1], '#f0e8d4'); S.dot(46 + r[0], 39 + r[1], '#f0e8d4');
  S.line([[36, 31], mid([36, 31], pull, 0.9)], 5, 'elfTunic', { g: 'parm' }); S.ell(pull[0], pull[1] + 0.5, 3.1, 3.1, 'skinPale', { g: 'parm' });
  S.at(lean + hd[0], 8 + up + hd[1]);
  S.poly([[23, 14], [27, 6], [34, 4], [42, 8], [44, 16], [40, 15], [32, 12], [29, 16], [30, 34], [25, 42], [21, 34], [22, 20]], 'hairBlonde', { g: 'hbk', bevel: 3 });
  S.ell(33, 18, 9, 10, 'skinPale', { g: 'head', bevel: 5.5 });
  S.poly([[24, 13], [28, 7], [35, 5], [41, 9], [43, 15], [38, 12], [32, 10], [27, 13]], 'hairBlonde', { g: 'head', bevel: 2 });
  S.poly([[26, 18], [19, 12], [27, 14]], 'skinPale', { g: 'ear' });
  eyes(S, 34, 17, P.blink, '#2a4a7a'); brow(S, 33, 15, '#b09a58');
  S.dot(42, 21, '#d7ab88'); S.dot(39, 24, '#b8685a'); S.dot(40, 24, '#b8685a');
  void t;
  return S.finish(HERO_FINISH);
}
function boromir(P: Pose): PixImg {
  const { up, lean, cape, h, t, r, hd } = rig(P);
  const S = new Sprite(72, 92).at(0, 8);
  applyStride(S, P.stride ?? 0);
  S.poly(sway([[22, 28], [14, 40], [10, 60], [9, 80], [31, 81], [34, 58], [35, 30]], cape, 30), 'boroCloak', { g: 'cloak', grad: 0.6, fold: { amp: 0.6, period: 7, angle: 0.2 }, bevel: 3 });
  S.poly([[23, 50], [30, 50], [29, 74], [22, 74]], 'leatherDark', { g: 'legA', bevel: 3 }); S.poly([[30, 50], [39, 50], [41, 74], [31, 74]], 'leatherDark', { g: 'legB', bevel: 3 });
  S.poly([[22, 62], [30, 62], [30, 76], [21, 76]], 'steelDark', { g: 'legA', bevel: 2 }); S.poly([[30, 62], [40, 62], [42, 76], [31, 76]], 'steelDark', { g: 'legB', bevel: 2 });
  S.poly([[20, 72], [30, 72], [31, 82], [17, 82]], 'leatherDark', { g: 'bootA', bevel: 3 }); S.poly([[30, 72], [40, 72], [45, 82], [31, 82]], 'leatherDark', { g: 'bootB', bevel: 3 });
  S.at(lean, 8 + up);
  S.rect(30, 24, 8, 8, 'skin', { g: 'neck', light: -0.8 });
  S.poly([[20, 29], [42, 29], [41, 52], [23, 52]], 'mail', { g: 'torso', bevel: 5, tex: 0.5, grad: 0.4 });
  S.poly([[26, 29], [37, 29], [38, 58], [27, 58]], 'tabard', { g: 'tabard', bevel: 3, fold: { amp: 0.25, period: 5, angle: 1.4 } });
  for (const y of [36, 37, 38, 39, 40, 41, 42, 43, 44]) S.dot(32, y, '#eef0f6');
  for (const [x, y] of [[30, 38], [34, 38], [29, 41], [35, 41], [30, 34], [34, 34], [31, 36], [33, 36]]) S.dot(x, y, '#eef0f6');
  S.dot(32, 33, '#f6d870');
  S.poly([[23, 47], [40, 47], [40, 51], [23, 51]], 'leather', { g: 'belt', flat: true, tone: 1.9 }); S.rect(30, 47, 4, 4, 'gold', { g: 'belt', flat: true, tone: 3 });
  S.poly([[38, 50], [46, 53], [44, 62], [39, 57]], 'bone', { g: 'horn', bevel: 2 }); S.poly([[43, 58], [45, 55], [47, 54], [45, 62]], 'gold', { g: 'horn', flat: true, tone: 3 });
  const H = add([53, 38], h);
  S.line([[39, 33], mid([39, 33], H, 0.9)], 7, 'mail', { g: 'farm', tex: 0.4 }); S.ell(H[0], H[1], 3.8, 3.8, 'skin', { g: 'farm' });
  S.line([add(H, [-1, -1]), fixedTip(H, add([58, 8], t), 31)], 4.6, 'steel', { g: 'sword', bevel: 2.2 }, 2.6); S.line([add([46, 37], h), add([60, 39], h)], 3, 'gold', { g: 'guard', bevel: 1.5 });
  S.ell(H[0], H[1], 3.4, 3.4, 'skin', { g: 'farm', light: 0.4 });      // the fist closes over the hilt
  S.ell(40, 31, 6, 5, 'steel', { g: 'pauld' });
  for (const [x, y] of [[37, 29], [43, 30], [41, 34]]) S.dot(x, y, '#d6dbe6');   // pauldron rivets
  for (let x = 28; x <= 36; x += 2) S.dot(x, 56, '#f6d870');   // gold hem on the tabard
  for (const x of [23, 24, 38, 39]) S.dot(x, 73, '#9aa3b8');   // greave straps
  const sc = add([14, 54], r);
  S.ell(sc[0], sc[1], 12.5, 13, 'steelDark', { g: 'shield', bevel: 4 }); S.ell(sc[0], sc[1], 10, 10.5, 'wood', { g: 'shield2', bevel: 4 }); S.ell(sc[0], sc[1], 3.2, 3.2, 'gold', { g: 'shield3', bevel: 1.5 });
  for (const [x, y] of [[14, 45], [14, 63], [5, 54], [23, 54]]) S.dot(x + r[0], y + r[1], '#d6dbe6');
  S.line([[22, 38], add([17, 46], r)], 5, 'mail', { g: 'rarm', light: -0.4 });
  S.at(lean + hd[0], 8 + up + hd[1]);
  S.poly([[20, 14], [24, 6], [32, 3], [41, 7], [43, 15], [38, 13], [26, 13], [24, 20], [20, 22]], 'hairBrown', { g: 'hbk', bevel: 3 });
  S.ell(32, 17, 10, 11, 'skin', { g: 'head', bevel: 6 });
  S.poly([[22, 13], [25, 6], [32, 4], [40, 7], [42, 13], [39, 11], [34, 9], [29, 11], [25, 14]], 'hairBrown', { g: 'head', bevel: 2.5 });
  eyes(S, 35, 16, P.blink); brow(S, 34, 14, '#3a281e'); S.dot(42, 20, '#c98a62'); S.dot(38, 23, '#a5604a'); S.dot(39, 23, '#a5604a');
  for (let x = 28; x <= 41; x += 2) { S.dot(x, 25, '#7a5234'); if (x > 30) S.dot(x, 24, '#7a5234'); }
  return S.finish(HERO_FINISH);
}
function sam(P: Pose): PixImg {
  const { up, lean, h, t, r, hd } = rig(P);
  const S = new Sprite(72, 92).at(0, 8);
  applyStride(S, P.stride ?? 0);
  S.poly([[26, 71], [31, 71], [31, 79], [26, 79]], 'tan', { g: 'legA' }); S.poly([[34, 71], [39, 71], [40, 79], [34, 79]], 'tan', { g: 'legB' });
  S.ell(28, 81, 7, 3, 'skin', { g: 'footA', bevel: 2 }); S.ell(41, 81, 7, 3, 'skin', { g: 'footB', bevel: 2 });
  for (const x of [24, 27, 30, 38, 41, 44]) S.dot(x, 80, '#a8714f');
  S.at(lean, 8 + up);
  S.ell(18, 66, 10.5, 12.5, 'leather', { g: 'pack', bevel: 5 }); S.ell(18, 52, 9.5, 5, 'tan', { g: 'roll', bevel: 3 }); S.ell(12, 72, 4.5, 4.5, 'steelDark', { g: 'pot', bevel: 2 });
  S.dot(18, 56, '#3a2a1c'); S.dot(14, 62, '#3a2a1c');
  const rh = add([20, 72], r);
  S.line([[24, 62], mid([24, 62], rh, 0.9)], 5, 'jacketGreen', { g: 'rarm', light: -0.5 }); S.ell(rh[0], rh[1], 3, 3, 'skin', { g: 'rarm' });
  S.poly([[24, 58], [40, 58], [41, 74], [23, 74]], 'jacketGreen', { g: 'torso', bevel: 4, grad: 0.4 });
  S.poly([[24, 68], [40, 68], [40, 71], [24, 71]], 'leatherDark', { g: 'torso', flat: true, tone: 1.8 }); S.rect(31, 68, 3, 3, 'gold', { g: 'torso', flat: true, tone: 3 });
  for (const y of [62, 65]) S.dot(32, y, '#d8a838');   // jacket buttons
  for (let i = 0; i <= 8; i++) S.dot(25 + i, 59 + i, '#3a2a1c');   // pack strap across the chest
  S.dot(30, 63, '#f0bc46');
  const H = add([50, 57], h);
  S.line([[40, 61], mid([40, 61], H, 0.9)], 5.5, 'jacketGreen', { g: 'farm' }); S.ell(H[0], H[1], 3.4, 3.4, 'skin', { g: 'farm' });
  const pan = add([60, 43], t);
  S.line([add(H, [1, -1]), mid(add(H, [1, -1]), pan, 0.85)], 2.6, 'wood', { g: 'handle', bevel: 1.2 }); S.ell(pan[0], pan[1], 7, 5.5, 'steelDark', { g: 'pan', bevel: 3.5 }); S.ell(pan[0] - 1, pan[1] - 1, 4, 2.5, 'steel', { g: 'pan2', bevel: 1.5 });
  S.at(lean + hd[0], 8 + up + hd[1]);
  S.ell(32, 46, 11.5, 12, 'skin', { g: 'head', bevel: 6 });
  for (const [x, y] of [[21, 47], [21, 41], [24, 36], [29, 33], [35, 33], [40, 36], [43, 41]]) S.ell(x, y, 4.8, 4.8, 'hairSam', { g: 'head', bevel: 2.5 });
  S.ell(32, 46, 10.5, 11, 'skin', { g: 'head', bevel: 6 });
  S.poly([[24, 40], [28, 36], [34, 35], [40, 38], [42, 42], [36, 40], [29, 41]], 'hairSam', { g: 'head', bevel: 2 });
  eyes(S, 35, 46, P.blink, '#3a2a1c'); S.dot(36, 51, '#e48a70'); S.dot(37, 51, '#e48a70'); S.dot(41, 50, '#e48a70'); S.dot(42, 49, '#cf936b'); S.dot(38, 53, '#a5604a'); S.dot(39, 53, '#a5604a');
  S.poly([[24, 46], [20, 42], [26, 45]], 'skin', { g: 'head' });
  return S.finish(HERO_FINISH);
}
function gandalf(P: Pose): PixImg {
  const { up, lean, cape, h, t, r, hd } = rig(P);
  const S = new Sprite(72, 92).at(0, 8);
  applyStride(S, P.stride ?? 0);
  S.poly(sway([[21, 46], [46, 46], [53, 82], [13, 82]], cape, 50), 'robe', { g: 'robe', bevel: 7, grad: 0.7, fold: { amp: 0.55, period: 6, angle: 1.5 } });
  S.poly([[22, 80], [32, 80], [32, 84], [19, 84]], 'leatherDark', { g: 'feetA' }); S.poly([[34, 80], [45, 80], [48, 84], [34, 84]], 'leatherDark', { g: 'feetB' });
  S.at(lean, 8 + up);
  const rh = add([18, 66], r);
  S.line([[24, 50], mid([24, 50], rh, 0.9)], 7, 'robe', { g: 'rarm', light: -0.6 }); S.ell(rh[0], rh[1], 3.2, 3.2, 'skin', { g: 'rarm' });
  const H = add([55, 45], h);
  S.line([[42, 50], mid([42, 50], H, 0.9)], 7.5, 'robe', { g: 'farm', fold: { amp: 0.4, period: 5, angle: 0.4 } }); S.ell(H[0], H[1], 3.4, 3.4, 'skin', { g: 'farm' });
  S.at(lean, 8);
  const top = add([57, 20], [h[0] + t[0], h[1] + t[1]]);
  S.line([top, [58 + lean * 0.5, 86]], 3.4, 'wood', { g: 'staff', bevel: 1.7 });
  S.poly([[top[0] - 5, top[1] + 2], [top[0] - 3, top[1] - 6], [top[0], top[1] - 2], [top[0] + 3, top[1] - 8], [top[0] + 5, top[1] + 2]], 'wood', { g: 'staff' });
  S.ell(top[0], top[1] - 6, 6.4, 6.4, 'cyan', { g: 'orb', flat: true, tone: P.open ? 3.9 : 3.1, noLine: true }); S.ell(top[0] - 1.5, top[1] - 7.5, 2.4, 2.4, 'cyan', { g: 'orb', flat: true, tone: 4, noLine: true });
  S.at(lean + hd[0], 8 + up + hd[1]);
  S.ell(33, 36, 8.5, 8.5, 'skin', { g: 'head', bevel: 5 });
  S.poly([[24, 40], [42, 40], [45, 52], [41, 68], [33, 78], [25, 68], [22, 52]], 'hairWhite', { g: 'beard', bevel: 6, fold: { amp: 0.4, period: 4, angle: 1.45 } });
  S.ell(34, 41, 6.5, 2.5, 'hairWhite', { g: 'beard', bevel: 2 });
  S.poly([[20, 28], [26, 22], [30, 12], [35, 0], [42, -4], [42, 10], [43, 20], [47, 26], [48, 30], [20, 30]], 'hat', { g: 'hat', bevel: 5, fold: { amp: 0.3, period: 6, angle: 0.6 } });
  S.ell(33, 29, 17, 4, 'hat', { g: 'brim', bevel: 2.5 });
  S.rect(25, 26, 16, 2, 'steelDark', { g: 'brim', flat: true, tone: 1.8 });
  for (const x of [32, 33, 34]) S.dot(x, 26, '#f0bc46');   // hat band buckle
  for (const [x, y] of [[38, 11], [41, 18], [35, 20], [39, 6]]) { S.dot(x, y, '#eef0f6'); S.dot(x - 1, y, '#c8cce0'); S.dot(x + 1, y, '#c8cce0'); S.dot(x, y - 1, '#c8cce0'); S.dot(x, y + 1, '#c8cce0'); }   // stars on the hat
  eyes(S, 34, 35, P.blink); for (const x of [33, 34, 35, 39, 40, 41]) S.dot(x, 34, '#d9d6de'); S.dot(42, 39, '#d49670');
  return S.finish(HERO_FINISH);
}

const BUILD: Record<HeroId, (P: Pose) => PixImg> = { aragorn, gimli, frodo, legolas, boromir, sam, gandalf };
export const HERO_W = 72;
export const HERO_H = 92;
/** where a hero's soles sit in the sprite (canvas pixels from the top) */
export const HERO_FOOT = 90;

/** per-hero tweaks of the shared poses: archers draw instead of swinging, wizards raise the staff, and so on */
function poseFor(id: HeroId, anim: HeroAnim, n: number): Pose {
  const base = HERO_ANIMS[anim][n];
  if (id === 'legolas') {
    if (anim === 'dash') return { ...base, hand: [1, 0], tip: [0, 0], rhand: [-2, 0] };
    if (anim === 'wind' || anim === 'cast') return { ...base, hand: [1, -1], tip: [0, 0], rhand: [anim === 'wind' ? -6 : -4 - n * 2, 0], lean: base.lean };
    if (anim === 'strike') return { ...base, hand: [2, 0], rhand: [3, 0], tip: [0, 0] };
    if (anim === 'thrust') return { ...base, hand: [2, -1], rhand: n === 0 ? [-8, -1] : n === 1 ? [3, 0] : [2, 0], tip: [0, 0], lean: n === 0 ? -5 : base.lean };            // draw and loose
    if (anim === 'cast2') return { ...base, hand: [2, -6], rhand: n === 0 ? [-6, -5] : [2, -6], tip: [0, 0], lean: n === 0 ? -4 : -1 };    // a high volley, leaning back
    return { ...base, tip: [0, 0], hand: base.hand ?? [0, 0], rhand: anim === 'win' ? [2, -10] : base.rhand };
  }
  if (id === 'gandalf') {
    if (anim === 'dash') return { ...base, hand: [0, -1], tip: [0, 0] };
    if (anim === 'wind') return { ...base, hand: [-1, -4], tip: [-1, -6], open: false };
    if (anim === 'strike' || anim === 'cast') return { ...base, hand: [3, -7 - n * 2], tip: [3, -6 - n * 2], open: true, rhand: [2, -8] };
    if (anim === 'win') return { ...base, hand: [2, -10], tip: [1, -9], open: true };
    if (anim === 'thrust') return { ...base, hand: [n === 0 ? -3 : 3, -2], tip: [n === 0 ? -4 : 2, -3], open: n > 0, rhand: [n === 0 ? 1 : 4, -2] };    // the staff thrust forward
    if (anim === 'cast2') return { ...base, hand: [n === 0 ? -2 : 3, -5], tip: [n === 0 ? -2 : 2, -6], open: true, rhand: [n === 0 ? -3 : 5, -4] };      // a sweeping gesture
    return { ...base, tip: [0, 0], hand: base.hand };
  }
  if (id === 'frodo' && anim === 'cast') return { ...base, hand: [2, -6], tip: [4, -10] };
  if (id === 'gimli' && (anim === 'thrust' || anim === 'cast' || anim === 'cast2')) return { ...base, hand: [Math.min(base.hand?.[0] ?? 0, 4), base.hand?.[1] ?? 0], tip: [Math.min(base.tip?.[0] ?? 0, 2), anim === 'thrust' ? 6 : base.tip?.[1] ?? 0] };   // the axe head must not leave the cell
  if ((id === 'sam' || id === 'frodo' || id === 'gimli') && anim === 'strike') return { ...base, tip: id === 'gimli' ? (n ? [2, 28] : [3, 24]) : (n ? [8, 18] : [12, 14]) };
  return base;
}

const cache = new Map<string, { color: HTMLCanvasElement; normal: HTMLCanvasElement }>();
function built(id: HeroId, anim: HeroAnim = 'idle', n = 0): { color: HTMLCanvasElement; normal: HTMLCanvasElement } {
  const key = `${id}:${anim}:${n}`;
  let c = cache.get(key);
  if (!c) { const img = BUILD[id](poseFor(id, anim, n)); c = { color: toCanvas(img), normal: toCanvas(img, img.normal) }; cache.set(key, c); }
  return c;
}
export function paintHeroPixel(id: HeroId): HTMLCanvasElement { return built(id).color; }
/** the matching tangent-space normal map, for dynamic lighting */
export function paintHeroNormal(id: HeroId): HTMLCanvasElement { return built(id).normal; }
/** one frame of an animation: colour + normal map */
export function heroFrame(id: HeroId, anim: HeroAnim, n: number): { color: HTMLCanvasElement; normal: HTMLCanvasElement } { return built(id, anim, n % HERO_ANIMS[anim].length); }
export function heroImage(id: HeroId): PixImg { return BUILD[id](poseFor(id, 'idle', 0)); }
/** the raw pixels of one frame of an animation (no canvas needed: used by the tests) */
export function heroPoseImage(id: HeroId, anim: HeroAnim, n: number): PixImg { return BUILD[id](poseFor(id, anim, n % HERO_ANIMS[anim].length)); }
/** the attack animations a hero can play: a melee pair and a ranged/spell pair */
export const HERO_ATTACKS: HeroAnim[][] = [['strike', 'thrust'], ['cast', 'cast2']];
