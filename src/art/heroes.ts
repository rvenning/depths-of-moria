import { HEROES } from '../content/heroes.ts';
import type { HeroId } from '../content/schema.ts';
import { INK, PEN, circle, ctx2d, ellipse, glow, groundShadow, limb, line, makeCanvas, poly, rimLight, shade, mix, type Ctx } from './draw.ts';

export const HERO_SPRITE = 256;
export const HERO_SCALE: Record<HeroId, number> = { aragorn: 1.0, gimli: 0.86, frodo: 0.78, legolas: 1.0, boromir: 1.0, sam: 0.84, gandalf: 1.06 };

type P = (typeof HEROES)['aragorn']['palette'];

function face(c: Ctx, x: number, y: number, r: number, skin: string, look = 1): void {
  circle(c, x, y, r, skin);
  // eye + brow facing right
  circle(c, x + r * 0.38 * look, y - r * 0.05, r * 0.11, '#fff', { lw: 0, ink: INK }, 0);
  circle(c, x + r * 0.42 * look, y - r * 0.05, r * 0.06, INK, { lw: 0, ink: INK }, 0);
  line(c, x + r * 0.2 * look, y - r * 0.28, x + r * 0.62 * look, y - r * 0.2, 2.5, INK);
  line(c, x + r * 0.25 * look, y + r * 0.45, x + r * 0.55 * look, y + r * 0.42, 2, shade(skin, -0.45));
  circle(c, x + r * 0.72 * look, y + r * 0.12, r * 0.12, shade(skin, -0.1), { lw: 1.5, ink: INK }, 0);
}

function sword(c: Ctx, x: number, y: number, ang: number, s: number, blade = '#c9d0d8', hilt = '#8a6a3a'): void {
  c.save(); c.translate(x, y); c.rotate(ang);
  poly(c, [[-5 * s, 0], [5 * s, 0], [4 * s, -88 * s], [0, -102 * s], [-4 * s, -88 * s]], blade, PEN, 0.38);
  line(c, 0, -2, 0, -86 * s, 1.5, shade(blade, 0.5));
  poly(c, [[-15 * s, 0], [15 * s, 0], [14 * s, 7 * s], [-14 * s, 7 * s]], hilt, PEN, 0.3);
  limb(c, 0, 7 * s, 0, 24 * s, 6 * s, 6 * s, '#4a3220');
  c.restore();
}

function cloak(c: Ctx, p: P, hood: boolean, wide = 1): void {
  poly(c, [[96, 104], [58 - 8 * wide, 188], [48 - 10 * wide, 238], [92, 226], [118, 236], [140, 224], [156, 200]], p.primary, PEN, 0.18, true);
  if (hood) poly(c, [[96, 66], [118, 44], [150, 62], [152, 104], [118, 112], [92, 102]], shade(p.primary, -0.05), PEN, 0.2, true);
}

const aragorn = (c: Ctx, p: P): void => {
  groundShadow(c, 128, 238, 56, 11);
  cloak(c, p, false, 1.2);
  limb(c, 112, 186, 104, 232, 20, 16, '#3a3028'); limb(c, 144, 186, 156, 232, 20, 16, '#2a241e');
  ellipse(c, 104, 236, 20, 7, '#241c16'); ellipse(c, 160, 236, 20, 7, '#1e1812');
  poly(c, [[102, 110], [160, 110], [164, 196], [98, 196]], p.secondary, PEN, 0.2, true);
  poly(c, [[102, 110], [160, 110], [152, 140], [110, 140]], mix(p.secondary, p.metal, 0.3), PEN, 0.25, true);
  line(c, 98, 172, 164, 172, 5, '#2a1c10');
  limb(c, 156, 124, 200, 150, 17, 14, p.secondary);
  limb(c, 104, 124, 84, 156, 17, 14, p.secondary);
  sword(c, 204, 156, 1.0, 1.0, '#cfd6dc');
  face(c, 132, 82, 28, p.skin);
  poly(c, [[102, 74], [112, 48], [138, 44], [160, 62], [156, 84], [146, 66], [114, 70]], p.hair, PEN, 0.2, true);
  poly(c, [[118, 92], [150, 94], [144, 110], [124, 108]], shade(p.hair, 0.0), { lw: 0, ink: INK }, 0.1, true);
  circle(c, 84, 126, 4, p.accent, { lw: 1, ink: INK });
};

const gimli = (c: Ctx, p: P): void => {
  groundShadow(c, 128, 238, 64, 12);
  limb(c, 108, 196, 100, 232, 24, 18, '#3a2a20'); limb(c, 150, 196, 158, 232, 24, 18, '#2a1e16');
  ellipse(c, 100, 236, 22, 8, '#241810'); ellipse(c, 162, 236, 22, 8, '#1e140e');
  poly(c, [[84, 110], [176, 110], [168, 204], [92, 204]], p.primary, PEN, 0.2, true);
  poly(c, [[88, 110], [172, 110], [160, 160], [100, 160]], p.metal, PEN, 0.3, true);
  for (let i = 0; i < 5; i++) circle(c, 100 + i * 15, 130, 3, shade(p.metal, 0.4), { lw: 1, ink: INK });
  poly(c, [[88, 176], [172, 176], [168, 204], [92, 204]], '#2a2420', PEN, 0.2);
  ellipse(c, 82, 120, 22, 16, p.metal); ellipse(c, 180, 120, 22, 16, shade(p.metal, -0.1));
  limb(c, 176, 124, 206, 164, 22, 17, p.primary); limb(c, 84, 124, 64, 160, 22, 17, p.primary);
  // axe
  c.save(); c.translate(210, 170); c.rotate(0.55);
  limb(c, 0, 24, 0, -96, 8, 7, '#6a4a2c');
  poly(c, [[2, -98], [44, -112], [46, -66], [2, -64]], p.metal, PEN, 0.4, true);
  poly(c, [[-2, -98], [-22, -90], [-2, -76]], p.metal, PEN, 0.3);
  c.restore();
  // beard & face
  poly(c, [[106, 82], [160, 84], [166, 150], [136, 188], [108, 150]], p.hair, PEN, 0.25, true);
  face(c, 138, 78, 24, p.skin);
  poly(c, [[104, 76], [112, 54], [140, 50], [164, 60], [168, 82], [150, 70], [112, 76]], p.metal, PEN, 0.35, true);
  poly(c, [[134, 52], [146, 52], [146, 82], [134, 82]], shade(p.metal, -0.2), PEN, 0.2);
  line(c, 118, 130, 128, 168, 2, shade(p.hair, -0.35)); line(c, 140, 130, 142, 172, 2, shade(p.hair, -0.35));
};

const frodo = (c: Ctx, p: P): void => {
  groundShadow(c, 128, 238, 44, 10);
  poly(c, [[102, 114], [156, 114], [166, 206], [94, 206]], p.primary, PEN, 0.18, true);
  limb(c, 112, 200, 104, 236, 20, 15, '#7a6048'); limb(c, 144, 200, 154, 236, 20, 15, '#6a5038');
  ellipse(c, 102, 238, 22, 8, '#8a6a4a'); ellipse(c, 158, 238, 22, 8, '#7a5a3a'); // bare feet furred
  poly(c, [[96, 118], [160, 118], [168, 176], [92, 176]], p.secondary, PEN, 0.2, true);
  line(c, 96, 168, 164, 168, 4, '#2a1c10');
  limb(c, 156, 130, 190, 158, 15, 12, p.secondary); limb(c, 100, 130, 82, 156, 15, 12, p.secondary);
  sword(c, 194, 164, 1.1, 0.5, '#aeb8c0');
  glow(c, 88, 164, 20, '#ffe08a', 0.6); circle(c, 88, 164, 4, '#f0d070', { lw: 1.5, ink: INK }, 0.4);
  // hood/cloak hang
  poly(c, [[92, 108], [104, 100], [112, 130], [96, 150]], shade(p.primary, -0.15), PEN, 0.2, true);
  face(c, 128, 86, 30, p.skin);
  poly(c, [[96, 76], [100, 56], [116, 50], [128, 56], [142, 50], [156, 58], [158, 78], [146, 66], [128, 68], [110, 66]], p.hair, PEN, 0.2, true);
  for (const x of [104, 122, 140]) circle(c, x, 56, 7, p.hair, { lw: 2, ink: INK });
};

const legolas = (c: Ctx, p: P): void => {
  groundShadow(c, 128, 238, 48, 10);
  poly(c, [[100, 108], [76, 190], [64, 236], [100, 216], [128, 232], [150, 214], [158, 190]], shade(p.primary, -0.15), PEN, 0.18, true);
  limb(c, 116, 188, 108, 232, 16, 13, '#4a4a38'); limb(c, 142, 188, 150, 232, 16, 13, '#3a3a2c');
  ellipse(c, 108, 236, 18, 6, '#2a2a20'); ellipse(c, 156, 236, 18, 6, '#222218');
  poly(c, [[104, 112], [158, 112], [160, 196], [102, 196]], p.secondary, PEN, 0.2, true);
  poly(c, [[104, 112], [158, 112], [152, 140], [110, 140]], p.primary, PEN, 0.25, true);
  line(c, 100, 172, 162, 172, 4, '#2a1c10');
  // quiver
  poly(c, [[90, 96], [104, 90], [120, 148], [106, 154]], '#6a4a2c', PEN, 0.2); for (const [x, y] of [[96, 92], [102, 90], [108, 90]] as [number, number][]) line(c, x, y, x - 4, y - 18, 3, p.accent);
  // bow, drawn
  c.save(); c.translate(206, 144); c.beginPath(); c.arc(0, 0, 78, -1.2, 1.2);
  c.lineWidth = 8; c.strokeStyle = INK; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#a8804a'; c.stroke();
  const bx = 78 * Math.cos(1.2), by = 78 * Math.sin(1.2);
  c.restore();
  line(c, 206 + 78 * Math.cos(-1.2), 144 + 78 * Math.sin(-1.2), 150, 142, 1.8, '#f0e8cc'); line(c, 150, 142, 206 + bx, 144 + by, 1.8, '#f0e8cc');
  line(c, 150, 142, 232, 142, 4, '#a8804a'); poly(c, [[232, 136], [250, 142], [232, 148]], '#c8d0d8', { lw: 1.5, ink: INK }, 0.3);
  limb(c, 150, 126, 204, 142, 15, 12, p.secondary); limb(c, 140, 132, 150, 142, 14, 12, p.secondary);
  face(c, 130, 80, 26, p.skin);
  poly(c, [[98, 74], [108, 46], [136, 38], [160, 54], [160, 80], [150, 62], [118, 62]], p.hair, PEN, 0.2, true);
  poly(c, [[100, 80], [94, 130], [112, 150], [108, 100]], p.hair, PEN, 0.2, true);
  poly(c, [[144, 66], [160, 52], [158, 70]], p.skin, PEN, 0.1);
};

const boromir = (c: Ctx, p: P): void => {
  groundShadow(c, 128, 238, 60, 12);
  poly(c, [[102, 108], [66, 188], [58, 236], [96, 222], [122, 236], [140, 220], [156, 190]], '#3a2a24', PEN, 0.18, true);
  limb(c, 112, 190, 104, 232, 22, 17, '#3a3430'); limb(c, 148, 190, 156, 232, 22, 17, '#2a2622');
  ellipse(c, 102, 236, 20, 7, '#201a16'); ellipse(c, 162, 236, 20, 7, '#1a1612');
  poly(c, [[90, 108], [172, 108], [168, 200], [94, 200]], p.primary, PEN, 0.2, true);
  poly(c, [[96, 108], [166, 108], [156, 150], [106, 150]], p.metal, PEN, 0.3, true);
  line(c, 130, 108, 130, 150, 2.5, shade(p.metal, -0.3));
  poly(c, [[92, 160], [168, 160], [166, 180], [94, 180]], '#2a1c10', PEN, 0.2);
  ellipse(c, 86, 116, 20, 15, p.metal);
  // horn at hip
  poly(c, [[152, 186], [186, 176], [196, 200], [176, 214], [160, 204]], '#e0d6b8', PEN, 0.3, true);
  line(c, 160, 196, 188, 190, 3, '#d9b25f');
  // shield (front, left side)
  c.save(); c.translate(76, 160);
  circle(c, 0, 0, 48, p.secondary, { lw: 4, ink: INK }, 0.3);
  circle(c, 0, 0, 36, p.primary, { lw: 2.5, ink: INK }, 0.25);
  circle(c, 0, 0, 11, p.accent, { lw: 2, ink: INK }, 0.4);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; line(c, Math.cos(a) * 12, Math.sin(a) * 12, Math.cos(a) * 34, Math.sin(a) * 34, 2, p.accent); }
  c.restore();
  limb(c, 170, 124, 206, 158, 20, 16, p.primary);
  sword(c, 210, 164, 0.9, 1.05, '#d0d6dc', '#b99a4a');
  face(c, 134, 84, 28, p.skin);
  poly(c, [[102, 80], [104, 52], [136, 40], [166, 56], [164, 80], [152, 62], [118, 66]], p.hair, PEN, 0.2, true);
  poly(c, [[122, 98], [154, 100], [148, 116], [128, 114]], shade(p.hair, -0.05), { lw: 0, ink: INK }, 0.1);
};

const sam = (c: Ctx, p: P): void => {
  groundShadow(c, 128, 238, 56, 11);
  // backpack
  ellipse(c, 92, 150, 34, 44, '#7a5a3a'); line(c, 70, 124, 110, 176, 3, '#4a3220'); poly(c, [[72, 104], [108, 100], [104, 116], [76, 120]], '#d8d0b0', PEN, 0.2);
  circle(c, 80, 196, 12, '#9a9a9a', { lw: 2.5, ink: INK }, 0.35);
  limb(c, 112, 200, 106, 236, 22, 17, '#6a5038'); limb(c, 144, 200, 152, 236, 22, 17, '#5a4030');
  ellipse(c, 104, 238, 22, 8, '#8a6a4a'); ellipse(c, 158, 238, 22, 8, '#7a5a3a');
  poly(c, [[98, 112], [162, 112], [172, 208], [90, 208]], p.primary, PEN, 0.18, true);
  poly(c, [[102, 118], [158, 118], [166, 180], [96, 180]], p.secondary, PEN, 0.2, true);
  line(c, 98, 172, 164, 172, 4, '#2a1c10');
  limb(c, 158, 132, 192, 164, 18, 14, p.secondary); limb(c, 100, 132, 82, 160, 18, 14, p.secondary);
  // frying pan
  circle(c, 214, 156, 22, '#2a2a30', { lw: 3, ink: INK }, 0.35); limb(c, 192, 166, 172, 178, 8, 7, '#4a3220');
  face(c, 130, 84, 31, p.skin);
  poly(c, [[98, 78], [102, 56], [124, 46], [152, 52], [160, 76], [150, 66], [112, 66]], p.hair, PEN, 0.2, true);
  circle(c, 136, 98, 5, shade(p.skin, -0.12), { lw: 0, ink: INK }, 0);
};

const gandalf = (c: Ctx, p: P): void => {
  groundShadow(c, 128, 240, 60, 11);
  poly(c, [[102, 108], [60, 190], [46, 242], [96, 232], [124, 244], [150, 230], [168, 196], [160, 112]], p.primary, PEN, 0.22, true);
  poly(c, [[108, 112], [158, 112], [168, 236], [100, 236]], shade(p.primary, -0.1), PEN, 0.2, true);
  line(c, 100, 170, 166, 172, 5, '#5a4a30');
  limb(c, 160, 130, 202, 152, 20, 16, shade(p.primary, -0.1)); limb(c, 100, 130, 80, 158, 20, 16, shade(p.primary, -0.1));
  // staff with light
  limb(c, 206, 244, 206, 70, 8, 7, '#6a4a2c');
  glow(c, 206, 60, 44, '#fff0a8', 0.85); circle(c, 206, 62, 12, '#fff6c8', { lw: 2, ink: INK }, 0.3);
  for (const k of [-1, 1]) line(c, 206 + k * 4, 76, 206 + k * 16, 56, 3, '#6a4a2c');
  // beard & face
  poly(c, [[104, 86], [162, 86], [170, 170], [136, 214], [102, 172]], p.hair, PEN, 0.25, true);
  face(c, 136, 78, 24, p.skin);
  // hat
  poly(c, [[88, 62], [182, 62], [170, 52], [150, 6], [124, 20], [104, 52]], p.primary, PEN, 0.25, true);
  poly(c, [[76, 66], [186, 66], [178, 56], [90, 56]], shade(p.primary, -0.12), PEN, 0.2, true);
  poly(c, [[108, 50], [138, 52], [138, 62], [108, 62]], shade(p.primary, -0.3), { lw: 0, ink: INK }, 0);
  poly(c, [[124, 86], [156, 86], [156, 96], [124, 96]], p.hair, { lw: 0, ink: INK }, 0.1);
  line(c, 118, 130, 130, 190, 2, shade(p.hair, -0.35)); line(c, 142, 130, 140, 196, 2, shade(p.hair, -0.35));
};

const PAINT: Record<HeroId, (c: Ctx, p: P) => void> = { aragorn, gimli, frodo, legolas, boromir, sam, gandalf };

const cache = new Map<HeroId, HTMLCanvasElement>();
export function paintHero(id: HeroId): HTMLCanvasElement {
  const hit = cache.get(id);
  if (hit) return hit;
  const cv = makeCanvas(HERO_SPRITE, HERO_SPRITE);
  const c = ctx2d(cv);
  c.lineJoin = 'round'; c.lineCap = 'round';
  PAINT[id](c, HEROES[id].palette);
  rimLight(cv, mix(HEROES[id].palette.accent, '#ffffff', 0.55), -3, -3, 0.55);
  cache.set(id, cv);
  return cv;
}
