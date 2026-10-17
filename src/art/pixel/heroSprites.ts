import { Sprite, def, toCanvas, type PixImg } from './engine.ts';
import type { HeroId } from '../../content/schema.ts';

// ---------------------------------------------------------------- materials
const SK = { dither: 0.05, shadowHue: 12, shadowShift: 10, spread: 0.11 };
def('skin', '#e9b088', SK); def('skinPale', '#f2cfaa', SK); def('skinDark', '#c98a60', SK);
def('hairDark', '#4b3426'); def('hairOrange', '#dc7428'); def('hairBrown', '#7d5232'); def('hairBlonde', '#f2dc8e'); def('hairWhite', '#ebe8f0', { spread: 0.13 }); def('hairSam', '#b27c3e');
def('tunicGreen', '#4f8242'); def('cloakGreen', '#2f5a4a'); def('leather', '#90603a'); def('leatherDark', '#4e3426');
def('steel', '#a5b2c6', { dither: 0.05 }); def('steelDark', '#58627c'); def('mail', '#8493a9', { dither: 0.3 });
def('gold', '#f0bc46', { dither: 0 }); def('wood', '#96623a'); def('red', '#bd3e32');
def('robe', '#a6abb9', { spread: 0.14 }); def('hat', '#8c92a4'); def('jacket', '#8e5e3e'); def('hobCloak', '#728f6c');
def('tan', '#c4ad7e'); def('elfTunic', '#92ab7e'); def('elfCloak', '#41704f');
def('boroCloak', '#7a3a2c'); def('tabard', '#3d4560'); def('bone', '#f0e8d4', { dither: 0 }); def('jacketGreen', '#718046');
def('cyan', '#a8eeff', { emissive: true, dither: 0 });

const EYE = '#1d1322';
/** near eye 2x3 with a highlight, far eye 1x3 (the face is turned to the right) */
function eyes(S: Sprite, x: number, y: number, iris = EYE): void {
  S.dot(x, y, iris); S.dot(x + 1, y, iris); S.dot(x, y + 1, iris); S.dot(x + 1, y + 1, iris); S.dot(x, y + 2, iris); S.dot(x + 1, y + 2, iris);
  S.dot(x, y, '#ffffff');
  S.dot(x + 5, y, iris); S.dot(x + 5, y + 1, iris); S.dot(x + 5, y + 2, iris);
}
const brow = (S: Sprite, x: number, y: number, c: string): void => { for (const dx of [0, 1, 2]) S.dot(x + dx, y, c); for (const dx of [5, 6]) S.dot(x + dx, y, c); };

// ---------------------------------------------------------------- heroes (72x92, feet at y=90)
function aragorn(): PixImg {
  const S = new Sprite(72, 92).at(0, 8);
  S.poly([[22, 28], [15, 38], [10, 58], [8, 80], [31, 81], [34, 58], [35, 30]], 'cloakGreen', { g: 'cloak', grad: 0.6, fold: { amp: 0.6, period: 7, angle: 0.2 }, bevel: 3 });
  S.line([[22, 33], [17, 44]], 6, 'tunicGreen', { g: 'rarm', light: -0.5 }); S.ell(16, 47, 3.4, 3.4, 'skin', { g: 'rarm' });
  S.poly([[23, 50], [30, 50], [29, 74], [22, 74]], 'leather', { g: 'legA', bevel: 3 });
  S.poly([[30, 50], [39, 50], [41, 74], [31, 74]], 'leather', { g: 'legB', bevel: 3 });
  S.poly([[20, 68], [30, 68], [31, 82], [17, 82]], 'leatherDark', { g: 'bootA', bevel: 3 }); S.poly([[30, 68], [40, 68], [45, 82], [31, 82]], 'leatherDark', { g: 'bootB', bevel: 3 });
  S.poly([[20, 68], [30, 68], [30, 71], [20, 71]], 'leather', { g: 'bootA', flat: true, tone: 2.6 }); S.poly([[30, 68], [40, 68], [40, 71], [31, 71]], 'leather', { g: 'bootB', flat: true, tone: 2.6 });
  S.rect(30, 24, 8, 8, 'skin', { g: 'neck', light: -0.8 });
  S.poly([[21, 29], [41, 29], [40, 51], [23, 51]], 'tunicGreen', { g: 'torso', bevel: 5, grad: 0.5, fold: { amp: 0.25, period: 6, angle: 1.3 } });
  S.poly([[23, 46], [40, 46], [40, 51], [23, 51]], 'leatherDark', { g: 'torso', flat: true, tone: 1.8 }); S.rect(30, 46, 4, 5, 'gold', { g: 'torso', flat: true, tone: 3 });
  S.poly([[27, 29], [35, 29], [31, 38]], 'skin', { g: 'torso', flat: true, tone: 1.6 });
  S.line([[39, 33], [46, 37]], 6, 'tunicGreen', { g: 'farm' }); S.line([[45, 36], [51, 38]], 5.5, 'leather', { g: 'farm' }); S.ell(53, 38, 3.6, 3.6, 'skin', { g: 'farm' });
  S.line([[52, 37], [58, 8]], 3.6, 'steel', { g: 'sword', bevel: 1.8 }, 2.2); S.line([[46, 37], [59, 39]], 3, 'gold', { g: 'guard', bevel: 1.5 });
  S.ell(40, 31, 5.5, 4.5, 'steel', { g: 'pauld' });
  S.poly([[20, 14], [24, 6], [32, 3], [41, 7], [43, 15], [36, 13], [26, 13], [25, 31], [18, 32]], 'hairDark', { g: 'hbk', bevel: 3 });
  S.ell(32, 17, 10, 11, 'skin', { g: 'head', bevel: 6 });
  S.poly([[22, 13], [25, 6], [32, 4], [40, 7], [42, 13], [39, 11], [34, 9], [29, 11], [25, 14]], 'hairDark', { g: 'head', bevel: 2.5 });
  eyes(S, 35, 16); brow(S, 34, 14, '#3a281e');
  S.dot(42, 20, '#c98a62'); S.dot(41, 20, '#d49870'); S.dot(38, 23, '#a5604a'); S.dot(39, 23, '#a5604a'); S.dot(40, 23, '#a5604a');
  for (let x = 32; x <= 41; x += 2) S.dot(x, 25, '#a87455');
  return S.finish();
}
function gimli(): PixImg {
  const S = new Sprite(72, 92).at(0, 8);
  S.line([[18, 54], [13, 66]], 8, 'mail', { g: 'rarm', light: -0.5 }); S.ell(12, 69, 4.2, 4.2, 'skin', { g: 'rarm' });
  S.poly([[21, 70], [31, 70], [30, 82], [19, 82]], 'leatherDark', { g: 'legA' }); S.poly([[33, 70], [45, 70], [47, 82], [34, 82]], 'leatherDark', { g: 'legB' });
  S.poly([[17, 76], [31, 76], [32, 83], [14, 83]], 'steelDark', { g: 'legA', bevel: 2 }); S.poly([[33, 76], [47, 76], [51, 83], [33, 83]], 'steelDark', { g: 'legB', bevel: 2 });
  S.poly([[16, 50], [50, 50], [48, 73], [18, 73]], 'mail', { g: 'torso', bevel: 6, tex: 0.5, grad: 0.5 });
  S.poly([[18, 66], [48, 66], [48, 71], [18, 71]], 'leather', { g: 'torso', flat: true, tone: 2 }); S.rect(30, 66, 6, 5, 'gold', { g: 'torso', flat: true, tone: 3 });
  S.line([[46, 54], [54, 46]], 8, 'mail', { g: 'farm', tex: 0.4 }); S.ell(56, 44, 4.4, 4.4, 'skin', { g: 'farm' });
  S.line([[58, 52], [62, 16]], 3.4, 'wood', { g: 'haft', bevel: 1.7 });
  S.poly([[55, 6], [66, 3], [69, 14], [66, 26], [58, 27], [57, 20]], 'steel', { g: 'axe', bevel: 3.5 });
  S.ell(33, 40, 10, 9, 'skin', { g: 'head', bevel: 5 });
  S.poly([[23, 44], [43, 44], [47, 54], [43, 64], [33, 70], [24, 64], [19, 54]], 'hairOrange', { g: 'beard', bevel: 6, tex: 0.7, fold: { amp: 0.35, period: 4, angle: 1.5 } });
  S.poly([[22, 38], [24, 30], [33, 26], [42, 30], [44, 38]], 'steel', { g: 'helm', bevel: 4 });
  S.rect(21, 36, 24, 4, 'steelDark', { g: 'helm', flat: true, tone: 2.2 }); S.rect(35, 38, 3, 9, 'steel', { g: 'helm', bevel: 1.5 });
  S.poly([[31, 27], [34, 17], [38, 27]], 'red', { g: 'crest' });
  eyes(S, 36, 40); brow(S, 35, 39, '#5a3a1e'); S.dot(40, 46, '#d98a62'); S.dot(41, 46, '#d98a62');
  return S.finish();
}
function frodo(): PixImg {
  const S = new Sprite(72, 92).at(0, 8);
  S.poly([[22, 56], [15, 68], [13, 82], [46, 82], [44, 68], [40, 56]], 'hobCloak', { g: 'cloak', grad: 0.5, fold: { amp: 0.5, period: 7, angle: 0.15 }, bevel: 3 });
  S.line([[24, 62], [20, 71]], 5, 'jacket', { g: 'rarm', light: -0.5 }); S.ell(20, 73, 3, 3, 'skin', { g: 'rarm' });
  S.poly([[26, 71], [31, 71], [31, 79], [26, 79]], 'tan', { g: 'legA' }); S.poly([[34, 71], [39, 71], [40, 79], [34, 79]], 'tan', { g: 'legB' });
  S.ell(28, 81, 7, 3, 'skin', { g: 'footA', bevel: 2 }); S.ell(41, 81, 7, 3, 'skin', { g: 'footB', bevel: 2 });
  for (const x of [24, 27, 30, 38, 41, 44]) S.dot(x, 80, '#a8714f');
  S.poly([[24, 58], [40, 58], [41, 74], [23, 74]], 'jacket', { g: 'torso', bevel: 4, grad: 0.4 });
  for (const y of [62, 66, 70]) S.dot(32, y, '#f0bc46');
  S.line([[40, 61], [48, 65]], 5, 'jacket', { g: 'farm' }); S.ell(50, 65, 3.2, 3.2, 'skin', { g: 'farm' });
  S.line([[52, 64], [63, 50]], 3, 'cyan', { g: 'sting', flat: true, tone: 3.2, noLine: true });
  S.dot(31, 57, '#f0bc46'); S.dot(32, 58, '#f0bc46');
  S.ell(32, 46, 11, 12, 'skin', { g: 'head', bevel: 6 });
  for (const [x, y] of [[21, 47], [21, 41], [24, 36], [29, 33], [35, 33], [40, 36], [43, 41]]) S.ell(x, y, 4.6, 4.6, 'hairBrown', { g: 'head', bevel: 2.5 });
  S.ell(32, 46, 10, 11, 'skin', { g: 'head', bevel: 6 });
  S.poly([[24, 40], [28, 36], [34, 35], [40, 38], [42, 42], [36, 40], [29, 41]], 'hairBrown', { g: 'head', bevel: 2 });
  eyes(S, 35, 46); S.dot(37, 51, '#dc8c70'); S.dot(40, 51, '#dc8c70'); S.dot(42, 50, '#cf936b'); S.dot(38, 53, '#a5604a'); S.dot(39, 53, '#a5604a');
  S.poly([[24, 46], [20, 41], [26, 45]], 'skin', { g: 'head' });
  return S.finish();
}
function legolas(): PixImg {
  const S = new Sprite(72, 92).at(0, 8);
  S.poly([[23, 27], [16, 36], [14, 58], [26, 56], [28, 30]], 'elfCloak', { g: 'cloak', fold: { amp: 0.5, period: 6, angle: 0.1 }, bevel: 3 });
  S.poly([[20, 26], [26, 24], [32, 50], [27, 52]], 'leather', { g: 'quiver', bevel: 2.5 });
  for (const [x, y] of [[21, 22], [24, 21], [27, 22]]) { S.dot(x, y, '#f0e8d4'); S.dot(x, y + 1, '#d8c8a0'); S.dot(x, y + 2, '#a89868'); }
  S.poly([[26, 50], [32, 50], [31, 74], [26, 74]], 'tan', { g: 'legA' }); S.poly([[32, 50], [38, 50], [40, 74], [33, 74]], 'tan', { g: 'legB' });
  S.poly([[25, 60], [32, 60], [32, 82], [22, 82]], 'leatherDark', { g: 'bootA', bevel: 2.5 }); S.poly([[32, 60], [39, 60], [44, 82], [32, 82]], 'leatherDark', { g: 'bootB', bevel: 2.5 });
  S.rect(29, 24, 8, 8, 'skinPale', { g: 'neck', light: -0.8 });
  S.poly([[24, 29], [40, 29], [38, 50], [26, 50]], 'elfTunic', { g: 'torso', bevel: 4, grad: 0.4, fold: { amp: 0.25, period: 6, angle: 1.3 } });
  S.poly([[26, 44], [38, 44], [38, 48], [26, 48]], 'leather', { g: 'torso', flat: true, tone: 2 }); S.rect(31, 44, 3, 4, 'gold', { g: 'torso', flat: true, tone: 3 });
  S.line([[38, 32], [51, 36]], 5, 'elfTunic', { g: 'farm' }); S.ell(53, 37, 3.2, 3.2, 'skinPale', { g: 'farm' });
  S.line([[54, 10], [62, 22], [64, 38], [62, 54], [54, 66]], 3, 'wood', { g: 'bow', bevel: 1.5 });
  S.line([[54, 10], [44, 38], [54, 66]], 1, 'bone', { g: 'str', flat: true, tone: 3, noLine: true });
  S.line([[44, 38], [61, 38]], 1.4, 'wood', { g: 'arrow', flat: true, tone: 2.6, noLine: true });
  S.dot(62, 37, '#cfd8e6'); S.dot(62, 38, '#cfd8e6'); S.dot(62, 39, '#cfd8e6'); S.dot(45, 37, '#f0e8d4'); S.dot(46, 39, '#f0e8d4');
  S.line([[36, 31], [43, 38]], 5, 'elfTunic', { g: 'parm' }); S.ell(44, 38.5, 3.1, 3.1, 'skinPale', { g: 'parm' });
  S.poly([[23, 14], [27, 6], [34, 4], [42, 8], [44, 16], [40, 15], [32, 12], [29, 16], [30, 34], [25, 42], [21, 34], [22, 20]], 'hairBlonde', { g: 'hbk', bevel: 3 });
  S.ell(33, 18, 9, 10, 'skinPale', { g: 'head', bevel: 5.5 });
  S.poly([[24, 13], [28, 7], [35, 5], [41, 9], [43, 15], [38, 12], [32, 10], [27, 13]], 'hairBlonde', { g: 'head', bevel: 2 });
  S.poly([[26, 18], [19, 12], [27, 14]], 'skinPale', { g: 'ear' });
  eyes(S, 36, 17, '#2a4a7a'); brow(S, 35, 15, '#b09a58');
  S.dot(42, 21, '#d7ab88'); S.dot(39, 24, '#b8685a'); S.dot(40, 24, '#b8685a');
  return S.finish();
}
function boromir(): PixImg {
  const S = new Sprite(72, 92).at(0, 8);
  S.poly([[22, 28], [14, 40], [10, 60], [9, 80], [31, 81], [34, 58], [35, 30]], 'boroCloak', { g: 'cloak', grad: 0.6, fold: { amp: 0.6, period: 7, angle: 0.2 }, bevel: 3 });
  S.poly([[23, 50], [30, 50], [29, 74], [22, 74]], 'leatherDark', { g: 'legA', bevel: 3 }); S.poly([[30, 50], [39, 50], [41, 74], [31, 74]], 'leatherDark', { g: 'legB', bevel: 3 });
  S.poly([[22, 62], [30, 62], [30, 76], [21, 76]], 'steelDark', { g: 'legA', bevel: 2 }); S.poly([[30, 62], [40, 62], [42, 76], [31, 76]], 'steelDark', { g: 'legB', bevel: 2 });
  S.poly([[20, 72], [30, 72], [31, 82], [17, 82]], 'leatherDark', { g: 'bootA', bevel: 3 }); S.poly([[30, 72], [40, 72], [45, 82], [31, 82]], 'leatherDark', { g: 'bootB', bevel: 3 });
  S.rect(30, 24, 8, 8, 'skin', { g: 'neck', light: -0.8 });
  S.poly([[20, 29], [42, 29], [41, 52], [23, 52]], 'mail', { g: 'torso', bevel: 5, tex: 0.5, grad: 0.4 });
  S.poly([[26, 29], [37, 29], [38, 58], [27, 58]], 'tabard', { g: 'tabard', bevel: 3, fold: { amp: 0.25, period: 5, angle: 1.4 } });
  for (const y of [36, 37, 38, 39, 40, 41, 42, 43, 44]) S.dot(32, y, '#eef0f6');
  for (const [x, y] of [[30, 38], [34, 38], [29, 41], [35, 41], [30, 34], [34, 34], [31, 36], [33, 36]]) S.dot(x, y, '#eef0f6');
  S.dot(32, 33, '#f6d870');
  S.poly([[23, 47], [40, 47], [40, 51], [23, 51]], 'leather', { g: 'belt', flat: true, tone: 1.9 }); S.rect(30, 47, 4, 4, 'gold', { g: 'belt', flat: true, tone: 3 });
  S.poly([[38, 50], [46, 53], [44, 62], [39, 57]], 'bone', { g: 'horn', bevel: 2 }); S.poly([[43, 58], [45, 55], [47, 54], [45, 62]], 'gold', { g: 'horn', flat: true, tone: 3 });
  S.line([[39, 33], [46, 37]], 7, 'mail', { g: 'farm', tex: 0.4 }); S.ell(53, 38, 3.8, 3.8, 'skin', { g: 'farm' });
  S.line([[52, 37], [58, 8]], 4.6, 'steel', { g: 'sword', bevel: 2.2 }, 2.6); S.line([[46, 37], [60, 39]], 3, 'gold', { g: 'guard', bevel: 1.5 });
  S.ell(40, 31, 6, 5, 'steel', { g: 'pauld' });
  S.ell(14, 54, 12.5, 13, 'steelDark', { g: 'shield', bevel: 4 }); S.ell(14, 54, 10, 10.5, 'wood', { g: 'shield2', bevel: 4 }); S.ell(14, 54, 3.2, 3.2, 'gold', { g: 'shield3', bevel: 1.5 });
  for (const [x, y] of [[14, 45], [14, 63], [5, 54], [23, 54]]) S.dot(x, y, '#d6dbe6');
  S.line([[22, 38], [17, 46]], 5, 'mail', { g: 'rarm', light: -0.4 });
  S.poly([[20, 14], [24, 6], [32, 3], [41, 7], [43, 15], [38, 13], [26, 13], [24, 20], [20, 22]], 'hairBrown', { g: 'hbk', bevel: 3 });
  S.ell(32, 17, 10, 11, 'skin', { g: 'head', bevel: 6 });
  S.poly([[22, 13], [25, 6], [32, 4], [40, 7], [42, 13], [39, 11], [34, 9], [29, 11], [25, 14]], 'hairBrown', { g: 'head', bevel: 2.5 });
  eyes(S, 35, 16); brow(S, 34, 14, '#3a281e'); S.dot(42, 20, '#c98a62'); S.dot(38, 23, '#a5604a'); S.dot(39, 23, '#a5604a');
  for (let x = 28; x <= 41; x += 2) { S.dot(x, 25, '#7a5234'); if (x > 30) S.dot(x, 24, '#7a5234'); }
  return S.finish();
}
function sam(): PixImg {
  const S = new Sprite(72, 92).at(0, 8);
  S.ell(18, 66, 10.5, 12.5, 'leather', { g: 'pack', bevel: 5 }); S.ell(18, 52, 9.5, 5, 'tan', { g: 'roll', bevel: 3 }); S.ell(12, 72, 4.5, 4.5, 'steelDark', { g: 'pot', bevel: 2 });
  S.dot(18, 56, '#3a2a1c'); S.dot(14, 62, '#3a2a1c');
  S.line([[24, 62], [20, 70]], 5, 'jacketGreen', { g: 'rarm', light: -0.5 }); S.ell(20, 72, 3, 3, 'skin', { g: 'rarm' });
  S.poly([[26, 71], [31, 71], [31, 79], [26, 79]], 'tan', { g: 'legA' }); S.poly([[34, 71], [39, 71], [40, 79], [34, 79]], 'tan', { g: 'legB' });
  S.ell(28, 81, 7, 3, 'skin', { g: 'footA', bevel: 2 }); S.ell(41, 81, 7, 3, 'skin', { g: 'footB', bevel: 2 });
  for (const x of [24, 27, 30, 38, 41, 44]) S.dot(x, 80, '#a8714f');
  S.poly([[24, 58], [40, 58], [41, 74], [23, 74]], 'jacketGreen', { g: 'torso', bevel: 4, grad: 0.4 });
  S.poly([[24, 68], [40, 68], [40, 71], [24, 71]], 'leatherDark', { g: 'torso', flat: true, tone: 1.8 }); S.rect(31, 68, 3, 3, 'gold', { g: 'torso', flat: true, tone: 3 });
  S.line([[40, 61], [48, 57]], 5.5, 'jacketGreen', { g: 'farm' }); S.ell(50, 57, 3.4, 3.4, 'skin', { g: 'farm' });
  S.line([[51, 56], [58, 47]], 2.6, 'wood', { g: 'handle', bevel: 1.2 }); S.ell(60, 43, 7, 5.5, 'steelDark', { g: 'pan', bevel: 3.5 }); S.ell(59, 42, 4, 2.5, 'steel', { g: 'pan2', bevel: 1.5 });
  S.ell(32, 46, 11.5, 12, 'skin', { g: 'head', bevel: 6 });
  for (const [x, y] of [[21, 47], [21, 41], [24, 36], [29, 33], [35, 33], [40, 36], [43, 41]]) S.ell(x, y, 4.8, 4.8, 'hairSam', { g: 'head', bevel: 2.5 });
  S.ell(32, 46, 10.5, 11, 'skin', { g: 'head', bevel: 6 });
  S.poly([[24, 40], [28, 36], [34, 35], [40, 38], [42, 42], [36, 40], [29, 41]], 'hairSam', { g: 'head', bevel: 2 });
  eyes(S, 35, 46, '#3a2a1c'); S.dot(36, 51, '#e48a70'); S.dot(37, 51, '#e48a70'); S.dot(41, 50, '#e48a70'); S.dot(42, 49, '#cf936b'); S.dot(38, 53, '#a5604a'); S.dot(39, 53, '#a5604a');
  S.poly([[24, 46], [20, 42], [26, 45]], 'skin', { g: 'head' });
  return S.finish();
}
function gandalf(): PixImg {
  const S = new Sprite(72, 92).at(0, 8);
  S.line([[24, 50], [18, 64]], 7, 'robe', { g: 'rarm', light: -0.6 }); S.ell(18, 66, 3.2, 3.2, 'skin', { g: 'rarm' });
  S.poly([[21, 46], [46, 46], [53, 82], [13, 82]], 'robe', { g: 'robe', bevel: 7, grad: 0.7, fold: { amp: 0.55, period: 6, angle: 1.5 } });
  S.poly([[22, 80], [32, 80], [32, 84], [19, 84]], 'leatherDark', { g: 'feetA' }); S.poly([[34, 80], [45, 80], [48, 84], [34, 84]], 'leatherDark', { g: 'feetB' });
  S.line([[42, 50], [53, 46]], 7.5, 'robe', { g: 'farm', fold: { amp: 0.4, period: 5, angle: 0.4 } }); S.ell(55, 45, 3.4, 3.4, 'skin', { g: 'farm' });
  S.line([[57, 20], [58, 86]], 3.4, 'wood', { g: 'staff', bevel: 1.7 });
  S.poly([[52, 22], [54, 14], [57, 18], [60, 12], [62, 22]], 'wood', { g: 'staff' });
  S.ell(57, 14, 6.4, 6.4, 'cyan', { g: 'orb', flat: true, tone: 3.1, noLine: true }); S.ell(55.5, 12.5, 2.4, 2.4, 'cyan', { g: 'orb', flat: true, tone: 4, noLine: true });
  S.ell(33, 36, 8.5, 8.5, 'skin', { g: 'head', bevel: 5 });
  S.poly([[24, 40], [42, 40], [45, 52], [41, 68], [33, 78], [25, 68], [22, 52]], 'hairWhite', { g: 'beard', bevel: 6, fold: { amp: 0.4, period: 4, angle: 1.45 } });
  S.ell(34, 41, 6.5, 2.5, 'hairWhite', { g: 'beard', bevel: 2 });
  S.poly([[20, 28], [26, 22], [30, 12], [35, 0], [42, -4], [42, 10], [43, 20], [47, 26], [48, 30], [20, 30]], 'hat', { g: 'hat', bevel: 5, fold: { amp: 0.3, period: 6, angle: 0.6 } });
  S.ell(33, 29, 17, 4, 'hat', { g: 'brim', bevel: 2.5 });
  S.rect(25, 26, 16, 2, 'steelDark', { g: 'brim', flat: true, tone: 1.8 });
  eyes(S, 36, 35); S.dot(35, 34, '#d9d6de'); S.dot(36, 34, '#d9d6de'); S.dot(41, 34, '#d9d6de'); S.dot(42, 39, '#d49670');
  return S.finish();
}

const BUILD: Record<HeroId, () => PixImg> = { aragorn, gimli, frodo, legolas, boromir, sam, gandalf };
export const HERO_W = 72;
export const HERO_H = 92;
/** where a hero's soles sit in the sprite (canvas pixels from the top) */
export const HERO_FOOT = 90;
const cache = new Map<HeroId, HTMLCanvasElement>();
export function paintHeroPixel(id: HeroId): HTMLCanvasElement {
  let c = cache.get(id);
  if (!c) { c = toCanvas(BUILD[id]()); cache.set(id, c); }
  return c;
}
export function heroImage(id: HeroId): PixImg { return BUILD[id](); }
