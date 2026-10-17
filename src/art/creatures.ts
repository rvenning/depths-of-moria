import type { CreatureFamily, EnemyDef } from '../content/schema.ts';
import {
  INK, circle, ctx2d, ellipse, eye, glow, groundShadow, limb, line, makeCanvas, mix, poly, rand, rimLight, shade, alpha, PEN, type Ctx, type Pt,
} from './draw.ts';

export const SPRITE = 256;

interface Pal { body: string; accent: string; eye: string; gear: string; has: (f: string) => boolean; seed: number }

const METAL = '#9aa3ad';
const WOOD = '#6a4a2c';

// ---------------------------------------------------------------- shared bits
function horns(c: Ctx, x: number, y: number, s: number, color: string, flip = 1): void {
  for (const k of [-1, 1]) {
    poly(c, [[x + k * 10 * s, y], [x + k * 22 * s * flip, y - 26 * s], [x + k * 30 * s, y - 38 * s], [x + k * 24 * s, y - 8 * s], [x + k * 12 * s, y + 4 * s]], color, { lw: 2.5, ink: INK }, 0.3, true);
  }
}
function ears(c: Ctx, x: number, y: number, s: number, color: string): void {
  poly(c, [[x - 6 * s, y], [x - 44 * s, y - 24 * s], [x - 38 * s, y + 4 * s], [x - 8 * s, y + 14 * s]], color, PEN, 0.2, true);
  poly(c, [[x + 14 * s, y - 2], [x + 46 * s, y - 28 * s], [x + 40 * s, y + 2 * s], [x + 14 * s, y + 14 * s]], shade(color, -0.1), PEN, 0.2, true);
}
function helm(c: Ctx, x: number, y: number, s: number, color: string): void {
  poly(c, [[x - 20 * s, y + 4], [x - 18 * s, y - 20 * s], [x, y - 28 * s], [x + 18 * s, y - 20 * s], [x + 20 * s, y + 4]], color, PEN, 0.3, true);
  line(c, x, y - 26 * s, x, y + 2, 3, shade(color, -0.35));
}
function fangs(c: Ctx, x: number, y: number, s: number): void {
  for (const k of [-1, 1]) poly(c, [[x + k * 6 * s, y], [x + k * 9 * s, y + 12 * s], [x + k * 2 * s, y + 2]], '#efe8d4', { lw: 1.5, ink: INK }, 0.1);
}
function weaponAxe(c: Ctx, x: number, y: number, ang: number, s: number): void {
  c.save(); c.translate(x, y); c.rotate(ang);
  limb(c, 0, 0, 0, -70 * s, 7 * s, 6 * s, WOOD);
  poly(c, [[-4 * s, -70 * s], [-34 * s, -80 * s], [-30 * s, -50 * s], [-4 * s, -52 * s]], METAL, PEN, 0.3, true);
  c.restore();
}
function weaponSword(c: Ctx, x: number, y: number, ang: number, s: number, color = METAL): void {
  c.save(); c.translate(x, y); c.rotate(ang);
  poly(c, [[-5 * s, 0], [5 * s, 0], [4 * s, -80 * s], [0, -92 * s], [-4 * s, -80 * s]], color, PEN, 0.35);
  poly(c, [[-14 * s, 0], [14 * s, 0], [14 * s, 6 * s], [-14 * s, 6 * s]], '#6a5a3a', PEN, 0.2);
  limb(c, 0, 6 * s, 0, 22 * s, 6 * s, 6 * s, WOOD);
  c.restore();
}
function weaponClub(c: Ctx, x: number, y: number, ang: number, s: number, color = WOOD): void {
  c.save(); c.translate(x, y); c.rotate(ang);
  poly(c, [[-5 * s, 0], [5 * s, 0], [14 * s, -70 * s], [8 * s, -96 * s], [-10 * s, -96 * s], [-14 * s, -70 * s]], color, PEN, 0.25, true);
  c.restore();
}
function weaponSpear(c: Ctx, x: number, y: number, ang: number, s: number): void {
  c.save(); c.translate(x, y); c.rotate(ang);
  limb(c, 0, 30 * s, 0, -90 * s, 5 * s, 5 * s, WOOD);
  poly(c, [[-8 * s, -90 * s], [0, -122 * s], [8 * s, -90 * s]], METAL, PEN, 0.3);
  c.restore();
}
function weaponHammer(c: Ctx, x: number, y: number, ang: number, s: number): void {
  c.save(); c.translate(x, y); c.rotate(ang);
  limb(c, 0, 0, 0, -86 * s, 8 * s, 7 * s, WOOD);
  poly(c, [[-26 * s, -86 * s], [26 * s, -86 * s], [26 * s, -120 * s], [-26 * s, -120 * s]], '#6a6e76', PEN, 0.3);
  c.restore();
}
function banner(c: Ctx, x: number, y: number, s: number, color: string): void {
  limb(c, x, y, x, y - 130 * s, 5, 4, WOOD);
  poly(c, [[x, y - 130 * s], [x + 50 * s, y - 118 * s], [x + 38 * s, y - 100 * s], [x + 50 * s, y - 82 * s], [x, y - 92 * s]], color, PEN, 0.2, true);
}
function plate(c: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  poly(c, [[x - w / 2, y], [x + w / 2, y], [x + w / 2 - 6, y + h], [x - w / 2 + 6, y + h]], color, PEN, 0.3, true);
  for (const k of [-0.3, 0.3]) circle(c, x + k * w, y + h * 0.4, 2.5, shade(color, 0.4), { lw: 1, ink: INK });
}
function wing(c: Ctx, x: number, y: number, s: number, color: string, flip: number, bat = true): void {
  const k = flip;
  const pts: Pt[] = bat
    ? [[x, y], [x + k * 40 * s, y - 70 * s], [x + k * 90 * s, y - 80 * s], [x + k * 70 * s, y - 40 * s], [x + k * 100 * s, y - 20 * s], [x + k * 60 * s, y - 6 * s], [x + k * 70 * s, y + 20 * s], [x + k * 28 * s, y + 6 * s]]
    : [[x, y], [x + k * 50 * s, y - 80 * s], [x + k * 110 * s, y - 70 * s], [x + k * 80 * s, y - 20 * s], [x + k * 30 * s, y + 10 * s]];
  poly(c, pts, color, PEN, 0.25, bat);
}
function tail(c: Ctx, x: number, y: number, s: number, color: string, len = 70): void {
  c.beginPath(); c.moveTo(x, y);
  c.bezierCurveTo(x + 30 * s, y + 10 * s, x + len * s, y - 10 * s, x + (len + 14) * s, y - 40 * s);
  c.lineWidth = 12 * s; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke();
  c.lineWidth = 8 * s; c.strokeStyle = color; c.stroke();
}
function tentacle(c: Ctx, x: number, y: number, ang: number, len: number, w: number, color: string, wob: number): void {
  c.save(); c.translate(x, y); c.rotate(ang);
  const pts: Pt[] = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([Math.sin(t * 5 + wob) * 14 * t, -t * len]); }
  c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
  c.lineWidth = w + 4; c.strokeStyle = INK; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  c.lineWidth = w; c.strokeStyle = color; c.stroke();
  c.lineWidth = w * 0.25; c.strokeStyle = shade(color, 0.35); c.stroke();
  c.restore();
}

// ---------------------------------------------------------------- families (all face LEFT)
type Painter = (c: Ctx, p: Pal) => void;

const goblin: Painter = (c, p) => {
  groundShadow(c, 128, 236, 54, 12);
  // legs
  limb(c, 112, 190, 96, 232, 18, 14, shade(p.body, -0.1));
  limb(c, 146, 190, 160, 232, 18, 14, shade(p.body, -0.2));
  ellipse(c, 92, 234, 16, 7, shade(p.gear, -0.2));
  ellipse(c, 164, 234, 16, 7, shade(p.gear, -0.25));
  // body
  poly(c, [[96, 130], [164, 130], [176, 190], [84, 196]], p.gear, PEN, 0.2, true);
  ellipse(c, 128, 150, 44, 50, p.body);
  poly(c, [[88, 182], [168, 182], [174, 204], [82, 204]], shade(p.gear, -0.1), PEN, 0.2, true);
  // arms + weapon
  limb(c, 166, 138, 190, 172, 15, 12, p.body);
  if (p.has('pick')) weaponHammer(c, 192, 176, 0.5, 0.7);
  else if (p.has('cleaver')) weaponSword(c, 192, 176, 0.6, 0.8, '#b9bfc6');
  else if (p.has('axe')) weaponAxe(c, 192, 176, 0.3, 0.9);
  else if (p.has('dagger')) weaponSword(c, 192, 176, 0.8, 0.5);
  else weaponSword(c, 192, 176, 0.7, 0.55, '#a8a49a');
  limb(c, 92, 138, 66, 170, 15, 12, p.body);
  // head
  ears(c, 118, 98, 1, p.body);
  circle(c, 118, 98, 36, p.body);
  if (p.has('helm')) helm(c, 118, 80, 1.15, '#7a7f88');
  if (p.has('hood')) poly(c, [[80, 100], [118, 54], [158, 100], [150, 120], [86, 120]], p.gear, PEN, 0.2, true);
  if (p.has('horns')) horns(c, 118, 66, 1, '#d8d0b8');
  if (p.has('crown')) poly(c, [[90, 70], [98, 48], [108, 66], [118, 44], [128, 66], [138, 48], [146, 70]], '#d9b25f', PEN, 0.3);
  eye(c, 104, 98, 6, p.eye, 1); eye(c, 130, 98, 6, p.eye, -1);
  poly(c, [[102, 118], [134, 118], [128, 128], [108, 128]], '#2a1410', { lw: 1.5, ink: INK }, 0.05);
  fangs(c, 118, 120, 0.8);
};

const archer: Painter = (c, p) => {
  groundShadow(c, 128, 236, 50, 11);
  limb(c, 112, 190, 104, 232, 16, 13, shade(p.body, -0.1));
  limb(c, 144, 190, 152, 232, 16, 13, shade(p.body, -0.2));
  poly(c, [[96, 130], [160, 130], [170, 204], [90, 204]], p.gear, PEN, 0.2, true);
  ellipse(c, 128, 150, 38, 46, p.body, PEN, 0.15);
  poly(c, [[92, 136], [164, 136], [150, 176], [108, 176]], p.gear, PEN, 0.2, true);
  // bow
  c.save(); c.translate(70, 150);
  c.beginPath(); c.arc(0, 0, 66, -1.1, 1.1);
  c.lineWidth = 8; c.strokeStyle = INK; c.stroke(); c.lineWidth = 5; c.strokeStyle = WOOD; c.stroke();
  line(c, 66 * Math.cos(-1.1), 66 * Math.sin(-1.1), 66 * Math.cos(1.1), 66 * Math.sin(1.1), 1.5, '#e9e2c8');
  c.restore();
  line(c, 70, 150, 128, 150, 4, WOOD); poly(c, [[60, 144], [68, 150], [60, 156]], METAL, { lw: 1.5, ink: INK }, 0.2);
  limb(c, 150, 144, 100, 150, 13, 11, p.body);
  limb(c, 96, 140, 74, 150, 12, 10, p.body);
  ears(c, 120, 100, 0.9, p.body);
  circle(c, 120, 100, 32, p.body);
  poly(c, [[84, 102], [120, 54], [158, 102], [150, 118], [90, 118]], p.gear, PEN, 0.2, true);
  eye(c, 108, 100, 5.5, p.eye, 1); eye(c, 132, 100, 5.5, p.eye, -1);
  if (p.has('feather')) line(c, 140, 62, 156, 38, 4, '#d94a3a');
};

const bat: Painter = (c, p) => {
  groundShadow(c, 128, 238, 40, 8);
  wing(c, 118, 130, 1.3, shade(p.body, -0.15), -1);
  wing(c, 138, 130, 1.3, shade(p.body, -0.25), 1);
  ellipse(c, 128, 150, 28, 40, p.body);
  // legs
  limb(c, 120, 184, 116, 214, 8, 6, p.accent); limb(c, 138, 184, 144, 214, 8, 6, p.accent);
  // head
  poly(c, [[110, 106], [100, 74], [120, 92]], p.body, PEN, 0.2); poly(c, [[146, 106], [156, 74], [136, 92]], p.body, PEN, 0.2);
  circle(c, 128, 114, 26, p.body);
  eye(c, 118, 112, 5, p.eye, 1); eye(c, 138, 112, 5, p.eye, -1);
  poly(c, [[118, 126], [138, 126], [128, 138]], '#2a1018', { lw: 1.5, ink: INK }, 0.05); fangs(c, 128, 126, 0.7);
};

const orc: Painter = (c, p) => {
  groundShadow(c, 128, 238, 66, 13);
  limb(c, 108, 188, 94, 234, 26, 20, shade(p.body, -0.12));
  limb(c, 150, 188, 164, 234, 26, 20, shade(p.body, -0.22));
  ellipse(c, 90, 236, 22, 8, '#2a2420'); ellipse(c, 168, 236, 22, 8, '#2a2420');
  // torso
  poly(c, [[76, 116], [184, 116], [170, 200], [88, 200]], p.body, PEN, 0.2, true);
  if (p.has('plate')) { plate(c, 128, 124, 90, 64, p.gear); plate(c, 128, 190, 74, 18, shade(p.gear, -0.15)); }
  else poly(c, [[92, 150], [164, 150], [168, 204], [88, 204]], p.gear, PEN, 0.2, true);
  // pauldrons
  ellipse(c, 74, 122, 22, 16, p.gear); ellipse(c, 184, 122, 22, 16, shade(p.gear, -0.1));
  // arms and weapons
  limb(c, 182, 126, 212, 168, 22, 17, p.body);
  limb(c, 74, 126, 52, 166, 22, 17, p.body);
  if (p.has('hammer')) weaponHammer(c, 214, 172, 0.45, 0.95);
  else if (p.has('axe')) weaponAxe(c, 214, 172, 0.35, 1.1);
  else if (p.has('sword')) weaponSword(c, 214, 172, 0.5, 1.0);
  else if (p.has('whip')) { c.beginPath(); c.moveTo(214, 172); c.bezierCurveTo(250, 150, 240, 100, 200, 80); c.lineWidth = 5; c.strokeStyle = '#4a2a1a'; c.stroke(); }
  else if (p.has('chain')) { for (let i = 0; i < 7; i++) circle(c, 216 + i * 4, 176 - i * 10, 5, METAL, { lw: 1.5, ink: INK }, 0.3); }
  else weaponClub(c, 214, 172, 0.45, 0.95);
  if (p.has('shield')) { poly(c, [[32, 150], [66, 140], [74, 192], [52, 216], [30, 192]], '#6a6e76', PEN, 0.3, true); circle(c, 52, 174, 7, '#b99a4a', { lw: 1.5, ink: INK }); }
  if (p.has('banner')) banner(c, 52, 190, 0.9, p.accent);
  if (p.has('drum')) { ellipse(c, 128, 170, 34, 22, WOOD); ellipse(c, 128, 160, 34, 12, '#e8d8b0'); }
  // head
  circle(c, 128, 90, 36, p.body);
  poly(c, [[96, 86], [160, 86], [158, 76], [98, 76]], shade(p.body, -0.25), PEN, 0.1);
  if (p.has('helm')) helm(c, 128, 74, 1.25, '#6a6e76');
  eye(c, 114, 92, 6, p.eye, 1); eye(c, 142, 92, 6, p.eye, -1);
  poly(c, [[104, 108], [152, 108], [146, 124], [110, 124]], '#2a1410', { lw: 2, ink: INK }, 0.05);
  poly(c, [[108, 108], [112, 96], [118, 110]], '#efe8d4', { lw: 1.5, ink: INK }, 0.1); poly(c, [[148, 108], [144, 96], [138, 110]], '#efe8d4', { lw: 1.5, ink: INK }, 0.1);
  if (p.has('horns')) horns(c, 128, 62, 1, '#d8d0b8');
};

const warg: Painter = (c, p) => {
  groundShadow(c, 128, 238, 80, 12);
  if (p.has('tail')) tail(c, 190, 150, 1, p.body, 36);
  limb(c, 78, 180, 66, 232, 22, 14, shade(p.body, -0.15)); limb(c, 108, 186, 108, 232, 22, 14, shade(p.body, -0.25));
  limb(c, 178, 176, 188, 232, 24, 14, shade(p.body, -0.15)); limb(c, 150, 186, 150, 232, 24, 14, shade(p.body, -0.25));
  ellipse(c, 142, 150, 62, 44, p.body);
  if (p.has('ruff')) poly(c, [[80, 120], [96, 96], [108, 118], [122, 94], [134, 116], [150, 94], [158, 120], [140, 150], [90, 150]], shade(p.body, 0.15), PEN, 0.2);
  // head
  poly(c, [[34, 130], [74, 96], [100, 108], [104, 150], [80, 170], [46, 160]], p.body, PEN, 0.2, true);
  poly(c, [[34, 138], [20, 150], [28, 158], [50, 150]], shade(p.body, -0.2), PEN, 0.2);
  poly(c, [[80, 100], [84, 72], [98, 98]], p.body, PEN, 0.2);
  eye(c, 66, 124, 5.5, p.eye, 1);
  fangs(c, 44, 154, 0.9);
  circle(c, 24, 144, 4, INK, { lw: 0, ink: INK });
  if (p.has('ember')) { glow(c, 142, 150, 70, '#ff8a2a', 0.35); for (let i = 0; i < 6; i++) circle(c, 100 + i * 14, 124 + (i % 2) * 8, 3, '#ffb347', { lw: 0, ink: INK }); }
  if (p.has('scars')) { line(c, 110, 130, 140, 168, 2.5, '#d8c0a0'); line(c, 118, 126, 146, 160, 2.5, '#d8c0a0'); }
};

const troll: Painter = (c, p) => {
  groundShadow(c, 128, 240, 80, 14);
  limb(c, 104, 190, 90, 236, 34, 24, shade(p.body, -0.12)); limb(c, 156, 190, 170, 236, 34, 24, shade(p.body, -0.22));
  ellipse(c, 88, 238, 28, 9, '#3a3a34'); ellipse(c, 174, 238, 28, 9, '#3a3a34');
  ellipse(c, 128, 150, 66, 66, p.body);
  poly(c, [[76, 170], [180, 170], [172, 208], [84, 208]], p.gear, PEN, 0.2, true);
  // belly highlights/moss
  for (let i = 0; i < 6; i++) circle(c, 96 + i * 12, 130 + (i % 3) * 18, 6, shade(p.accent, 0.1), { lw: 0, ink: INK });
  limb(c, 186, 112, 216, 172, 32, 22, p.body); limb(c, 70, 112, 38, 172, 32, 22, p.body);
  if (p.has('club')) weaponClub(c, 218, 178, 0.5, 1.25);
  else if (p.has('spear')) weaponSpear(c, 218, 178, 0.35, 1.2);
  if (p.has('chain')) for (let i = 0; i < 6; i++) circle(c, 40 + i * 5, 176 - i * 8, 5, METAL, { lw: 1.5, ink: INK }, 0.3);
  // head
  circle(c, 130, 80, 30, p.body);
  poly(c, [[102, 84], [158, 84], [156, 72], [104, 72]], shade(p.body, -0.3), PEN, 0.1);
  eye(c, 118, 82, 5, p.eye, 1); eye(c, 142, 82, 5, p.eye, -1);
  poly(c, [[110, 98], [150, 98], [146, 112], [114, 112]], '#2a1814', { lw: 2, ink: INK }, 0.05);
  poly(c, [[114, 98], [118, 88], [122, 99]], '#efe8d4', { lw: 1.5, ink: INK }, 0.1); poly(c, [[146, 98], [142, 88], [138, 99]], '#efe8d4', { lw: 1.5, ink: INK }, 0.1);
  if (p.has('crown')) poly(c, [[104, 56], [112, 36], [122, 54], [132, 32], [142, 54], [152, 36], [158, 56]], '#d9b25f', PEN, 0.3);
};

const wraith: Painter = (c, p) => {
  // ragged hooded cloak, no legs
  glow(c, 128, 150, 100, p.accent, 0.18);
  const g = c.createLinearGradient(0, 70, 0, 250);
  g.addColorStop(0, shade(p.body, 0.15)); g.addColorStop(1, alpha(p.body, 0));
  c.beginPath(); c.moveTo(128, 50);
  c.bezierCurveTo(68, 60, 60, 150, 54, 244); c.lineTo(76, 232); c.lineTo(94, 250); c.lineTo(116, 232); c.lineTo(134, 252); c.lineTo(156, 232); c.lineTo(176, 250); c.lineTo(196, 236);
  c.bezierCurveTo(196, 150, 188, 60, 128, 50); c.closePath();
  c.fillStyle = g; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
  // face void + eyes
  ellipse(c, 128, 96, 30, 36, '#08060c', { lw: 0, ink: INK }, 0);
  eye(c, 116, 94, 5.5, p.eye, 1); eye(c, 140, 94, 5.5, p.eye, -1);
  // arms reaching
  limb(c, 80, 140, 36, 170, 14, 6, alpha(p.body, 0.95));
  limb(c, 176, 140, 214, 170, 14, 6, alpha(p.body, 0.95));
  for (const x of [28, 40, 48]) line(c, 36, 170, x, 186, 2.5, shade(p.body, 0.3));
  if (p.has('quill')) line(c, 214, 170, 230, 120, 3, '#e9e2c8');
  if (p.has('scroll')) poly(c, [[196, 160], [226, 156], [228, 190], [198, 194]], '#d8c8a0', PEN, 0.2);
  if (p.has('keys')) for (let i = 0; i < 3; i++) circle(c, 108 + i * 20, 168, 5, '#d9b25f', { lw: 1.5, ink: INK }, 0.3);
  if (p.has('book')) poly(c, [[170, 164], [210, 156], [214, 192], [174, 200]], '#4a2a5a', PEN, 0.2);
  if (p.has('crown')) poly(c, [[98, 58], [106, 40], [116, 56], [128, 36], [140, 56], [150, 40], [158, 58]], '#d9b25f', PEN, 0.3);
};

const serpent: Painter = (c, p) => {
  groundShadow(c, 128, 240, 80, 12);
  // coil
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(200, 236); c.bezierCurveTo(240, 210, 200, 170, 160, 200); c.bezierCurveTo(120, 232, 80, 220, 70, 190); c.bezierCurveTo(60, 160, 100, 140, 96, 110);
  c.lineWidth = 36; c.strokeStyle = INK; c.stroke();
  c.lineWidth = 30; c.strokeStyle = p.body; c.stroke();
  c.lineWidth = 12; c.strokeStyle = shade(p.accent, 0.1); c.setLineDash([6, 12]); c.stroke(); c.setLineDash([]);
  // head
  poly(c, [[60, 84], [100, 60], [132, 74], [130, 110], [96, 124], [66, 112]], p.body, PEN, 0.25, true);
  eye(c, 88, 86, 5, p.eye, 1);
  poly(c, [[60, 106], [36, 112], [60, 118]], '#6a1a2a', { lw: 1.5, ink: INK }, 0.1);
  fangs(c, 70, 112, 0.8);
  if (p.has('fins') || p.has('frill')) for (let i = 0; i < 5; i++) poly(c, [[100 + i * 6, 66 - i * 4], [108 + i * 6, 40 - i * 6], [112 + i * 6, 70 - i * 3]], p.accent, { lw: 2, ink: INK }, 0.2);
};

const guardian: Painter = (c, p) => {
  groundShadow(c, 128, 238, 54, 11);
  limb(c, 112, 190, 106, 232, 20, 16, p.gear); limb(c, 144, 190, 150, 232, 20, 16, shade(p.gear, -0.2));
  ellipse(c, 102, 234, 18, 7, '#2a2a2e'); ellipse(c, 154, 234, 18, 7, '#2a2a2e');
  poly(c, [[96, 118], [160, 118], [168, 200], [88, 200]], p.body, PEN, 0.2, true);
  plate(c, 128, 124, 70, 56, shade(p.gear, 0.1));
  if (p.has('cape')) poly(c, [[160, 120], [196, 160], [190, 232], [160, 200]], shade(p.accent, -0.2), PEN, 0.15, true);
  limb(c, 164, 128, 188, 170, 16, 13, p.gear); limb(c, 92, 128, 70, 166, 16, 13, p.gear);
  if (p.has('sword')) weaponSword(c, 190, 176, 0.5, 1.0);
  else if (p.has('spear')) weaponSpear(c, 190, 180, 0.15, 1.0);
  else weaponSword(c, 190, 176, 0.45, 0.9, '#8a8f98');
  if (p.has('shield')) { poly(c, [[28, 146], [70, 136], [76, 190], [50, 214], [24, 190]], '#5a5e66', PEN, 0.3, true); line(c, 50, 142, 50, 206, 3, shade('#5a5e66', 0.3)); }
  if (p.has('banner')) banner(c, 62, 190, 0.8, p.accent);
  if (p.has('robe')) poly(c, [[92, 190], [164, 190], [176, 240], [80, 240]], shade(p.body, -0.1), PEN, 0.2, true);
  circle(c, 128, 90, 30, shade(p.body, 0.1));
  if (p.has('helm')) { helm(c, 128, 84, 1.45, '#6a6e76'); poly(c, [[108, 90], [148, 90], [146, 100], [110, 100]], '#0a0a0e', { lw: 1.5, ink: INK }, 0.0); }
  else { ellipse(c, 118, 92, 8, 9, '#0a0a0e', { lw: 0, ink: INK }, 0); ellipse(c, 140, 92, 8, 9, '#0a0a0e', { lw: 0, ink: INK }, 0); }
  eye(c, 118, 92, 4, p.eye, 1); eye(c, 140, 92, 4, p.eye, -1);
};

const spider: Painter = (c, p) => {
  groundShadow(c, 128, 238, 80, 10);
  const legs = [-1, 1];
  for (const side of legs) {
    for (let i = 0; i < 4; i++) {
      const bx = 128 + side * 22, by = 150 + (i - 1.5) * 8;
      const mx = 128 + side * (70 + i * 6), my = 100 + i * 16;
      const ex = 128 + side * (96 + i * 12), ey = 226;
      c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(mx, my, ex, ey);
      c.lineWidth = 9; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke();
      c.lineWidth = 5.5; c.strokeStyle = shade(p.body, i % 2 ? -0.15 : 0); c.stroke();
    }
  }
  ellipse(c, 150, 160, 44, 38, p.body);
  for (let i = 0; i < 4; i++) circle(c, 140 + i * 12, 152 + (i % 2) * 14, 4, p.accent, { lw: 0, ink: INK });
  circle(c, 96, 150, 30, shade(p.body, 0.05));
  const eyes: Pt[] = [[84, 142], [96, 138], [108, 142], [90, 152], [102, 152], [96, 162]];
  eyes.forEach(([x, y], i) => eye(c, x, y, i < 3 ? 4.5 : 3, p.eye, 0));
  for (const k of [-1, 1]) poly(c, [[96 + k * 6, 170], [96 + k * 10, 192], [96 + k * 2, 176]], '#e9e2c8', { lw: 1.5, ink: INK }, 0.1);
};

const drake: Painter = (c, p) => {
  groundShadow(c, 128, 238, 82, 12);
  wing(c, 138, 118, 1.0, shade(p.accent, -0.1), 1, false);
  tail(c, 192, 170, 1, p.body, 38);
  limb(c, 100, 186, 92, 232, 24, 14, shade(p.body, -0.15)); limb(c, 166, 186, 172, 232, 24, 14, shade(p.body, -0.25));
  ellipse(c, 138, 158, 58, 42, p.body);
  poly(c, [[96, 168], [178, 168], [170, 198], [102, 198]], shade(p.accent, 0.1), PEN, 0.2, true);
  limb(c, 86, 138, 62, 104, 28, 22, p.body);
  poly(c, [[34, 92], [74, 74], [96, 92], [88, 120], [44, 116]], p.body, PEN, 0.2, true);
  poly(c, [[34, 100], [18, 108], [32, 116]], shade(p.body, -0.2), PEN, 0.2);
  poly(c, [[70, 76], [60, 52], [82, 74]], p.accent, PEN, 0.2); poly(c, [[84, 80], [82, 56], [96, 82]], p.accent, PEN, 0.2);
  eye(c, 62, 96, 5, p.eye, 1); fangs(c, 42, 116, 0.7);
  if (p.has('horns')) horns(c, 76, 76, 0.7, '#d8d0b8');
  glow(c, 138, 158, 66, p.accent, 0.2);
};

const fiend: Painter = (c, p) => {
  groundShadow(c, 128, 238, 50, 10);
  if (p.has('wings')) { wing(c, 118, 130, 1.1, shade(p.accent, -0.25), -1); wing(c, 140, 130, 1.1, shade(p.accent, -0.35), 1); }
  tail(c, 150, 196, 1, p.body, 44);
  limb(c, 112, 188, 100, 232, 18, 14, shade(p.body, -0.1)); limb(c, 144, 188, 156, 232, 18, 14, shade(p.body, -0.2));
  ellipse(c, 128, 154, 38, 48, p.body);
  glow(c, 128, 156, 40, p.accent, 0.35);
  limb(c, 160, 138, 190, 168, 14, 10, p.body); limb(c, 96, 138, 68, 168, 14, 10, p.body);
  if (p.has('staff')) { limb(c, 192, 230, 192, 90, 7, 6, WOOD); glow(c, 192, 84, 24, p.accent, 0.9); circle(c, 192, 84, 9, p.accent, { lw: 1.5, ink: INK }, 0.4); }
  for (const x of [190, 66]) { for (const d of [-8, 0, 8]) circle(c, x + d, 172 + Math.abs(d) * 0.3, 3, '#e9e2c8', { lw: 1, ink: INK }); }
  circle(c, 128, 94, 30, p.body);
  horns(c, 128, 74, 1.1, p.has('horns') ? '#e9e2c8' : shade(p.accent, -0.3));
  eye(c, 116, 94, 5.5, p.eye, 1); eye(c, 140, 94, 5.5, p.eye, -1);
  poly(c, [[112, 110], [144, 110], [138, 122], [118, 122]], '#2a0a08', { lw: 1.5, ink: INK }, 0.05); fangs(c, 128, 112, 0.6);
  if (p.has('crown')) poly(c, [[102, 62], [110, 44], [120, 60], [128, 40], [136, 60], [146, 44], [154, 62]], '#d9b25f', PEN, 0.3);
  if (p.has('hood')) poly(c, [[88, 98], [128, 52], [170, 98], [164, 118], [94, 118]], '#2a1a14', PEN, 0.2, true);
};

const wisp: Painter = (c, p) => {
  glow(c, 128, 140, 100, p.accent, 0.35);
  // flame body with trail
  const g = c.createRadialGradient(128, 130, 4, 128, 140, 70);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, shade(p.accent, 0.4)); g.addColorStop(1, alpha(p.body, 0.0));
  c.beginPath(); c.moveTo(128, 40);
  c.bezierCurveTo(176, 90, 190, 150, 148, 188); c.bezierCurveTo(138, 216, 118, 216, 108, 188);
  c.bezierCurveTo(66, 150, 80, 90, 128, 40); c.closePath();
  c.fillStyle = g; c.fill(); c.lineWidth = 3; c.strokeStyle = alpha(INK, 0.8); c.stroke();
  // face
  eye(c, 112, 130, 6, p.eye, 1); eye(c, 144, 130, 6, p.eye, -1);
  poly(c, [[112, 150], [144, 150], [138, 164], [118, 164]], alpha('#0b0a0e', 0.9), { lw: 0, ink: INK }, 0);
  const r = rand(p.seed);
  for (let i = 0; i < 9; i++) circle(c, 70 + r() * 120, 60 + r() * 150, 1.5 + r() * 3, p.eye, { lw: 0, ink: INK }, 0);
  // trailing wisps below
  for (const k of [-1, 0, 1]) { c.beginPath(); c.moveTo(128 + k * 14, 200); c.quadraticCurveTo(128 + k * 40, 224, 128 + k * 20, 246); c.lineWidth = 6; c.strokeStyle = alpha(p.accent, 0.5); c.stroke(); }
};

const golem: Painter = (c, p) => {
  groundShadow(c, 128, 240, 76, 13);
  poly(c, [[88, 190], [116, 190], [114, 236], [84, 236]], shade(p.body, -0.15), PEN, 0.25);
  poly(c, [[142, 190], [170, 190], [174, 236], [144, 236]], shade(p.body, -0.25), PEN, 0.25);
  poly(c, [[70, 100], [186, 100], [176, 198], [80, 198]], p.body, PEN, 0.28);
  // furnace chest
  poly(c, [[102, 130], [154, 130], [150, 174], [106, 174]], '#1a0f0c', PEN, 0.1);
  glow(c, 128, 152, 36, p.accent, 0.9);
  for (let i = 0; i < 4; i++) line(c, 110, 138 + i * 10, 146, 138 + i * 10, 3, alpha(p.accent, 0.9));
  poly(c, [[52, 100], [88, 100], [84, 150], [50, 146]], shade(p.body, 0.05), PEN, 0.28);
  poly(c, [[168, 100], [204, 100], [208, 146], [172, 150]], shade(p.body, -0.1), PEN, 0.28);
  poly(c, [[46, 148], [84, 152], [80, 192], [44, 188]], shade(p.body, -0.15), PEN, 0.28);
  poly(c, [[172, 152], [210, 148], [212, 188], [176, 192]], shade(p.body, -0.2), PEN, 0.28);
  if (p.has('hammer')) weaponHammer(c, 212, 192, 0.35, 1.3);
  if (p.has('pillar')) poly(c, [[192, 60], [222, 60], [222, 190], [192, 190]], '#9a968c', PEN, 0.3);
  if (p.has('book')) poly(c, [[170, 130], [208, 124], [212, 164], [174, 170]], '#4a2a5a', PEN, 0.2);
  if (p.has('rivets')) for (let i = 0; i < 6; i++) circle(c, 84 + i * 18, 108, 3, shade(p.body, 0.4), { lw: 1, ink: INK });
  poly(c, [[96, 52], [160, 52], [166, 100], [90, 100]], shade(p.body, 0.08), PEN, 0.28);
  poly(c, [[104, 74], [152, 74], [150, 86], [106, 86]], '#0a0a0e', { lw: 1.5, ink: INK }, 0);
  eye(c, 116, 80, 4.5, p.eye, 0); eye(c, 140, 80, 4.5, p.eye, 0);
  if (p.has('furnace')) { poly(c, [[110, 20], [146, 20], [142, 54], [114, 54]], '#44484e', PEN, 0.3); glow(c, 128, 14, 30, '#ff7a2a', 0.8); }
};

const horror: Painter = (c, p) => {
  groundShadow(c, 128, 240, 90, 12);
  const r = rand(p.seed + 5);
  for (let i = 0; i < 7; i++) tentacle(c, 60 + i * 22, 236, (i - 3) * 0.28, 120 + r() * 70, 22 - Math.abs(i - 3) * 2, i % 2 ? shade(p.body, -0.15) : p.body, r() * 5);
  ellipse(c, 128, 150, 70, 62, p.body);
  ellipse(c, 128, 190, 56, 12, '#14081a', { lw: 0, ink: INK }, 0);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI; poly(c, [[128 + Math.cos(a) * 52 - 4, 188 + Math.sin(a) * -6], [128 + Math.cos(a) * 52, 202], [128 + Math.cos(a) * 52 + 4, 188]], '#efe8d4', { lw: 1, ink: INK }, 0.1); }
  const eyes: Pt[] = [[104, 128], [128, 112], [152, 128], [116, 150], [140, 150]];
  eyes.forEach(([x, y], i) => eye(c, x, y, i === 1 ? 9 : 6, p.eye, 0));
  if (p.has('fangs')) { fangs(c, 128, 186, 1.4); }
};

const balrog: Painter = (c, p) => {
  glow(c, 128, 130, 130, p.accent, 0.35);
  wing(c, 100, 110, 1.45, shade(p.body, -0.1), -1);
  wing(c, 156, 110, 1.45, shade(p.body, -0.2), 1);
  limb(c, 108, 188, 90, 238, 34, 24, p.body); limb(c, 150, 188, 168, 238, 34, 24, shade(p.body, -0.15));
  ellipse(c, 128, 150, 52, 62, p.body);
  // flames licking from torso
  for (let i = 0; i < 9; i++) poly(c, [[88 + i * 10, 150], [92 + i * 10, 110 - (i % 3) * 16], [100 + i * 10, 150]], i % 2 ? p.accent : p.eye, { lw: 0, ink: INK }, 0.2, true);
  limb(c, 170, 112, 214, 156, 26, 18, p.body); limb(c, 86, 112, 44, 148, 26, 18, p.body);
  // blade of fire & whip
  c.save(); c.translate(218, 160); c.rotate(0.35);
  poly(c, [[-9, 0], [9, 0], [12, -110], [0, -134], [-12, -110]], p.accent, PEN, 0.5); glow(c, 0, -70, 60, p.eye, 0.6);
  c.restore();
  c.beginPath(); c.moveTo(44, 150); c.bezierCurveTo(10, 130, 20, 80, 46, 56); c.lineWidth = 5; c.strokeStyle = p.accent; c.stroke();
  // head
  circle(c, 128, 84, 34, p.body);
  horns(c, 128, 60, 1.5, '#3a2a30');
  eye(c, 114, 86, 6, p.eye, 1); eye(c, 142, 86, 6, p.eye, -1);
  poly(c, [[110, 104], [146, 104], [140, 120], [116, 120]], '#1a0408', { lw: 2, ink: INK }, 0.05);
};

const warden: Painter = (c, p) => {
  groundShadow(c, 128, 240, 80, 14);
  poly(c, [[84, 188], [120, 188], [118, 238], [78, 238]], shade(p.body, -0.2), PEN, 0.25);
  poly(c, [[138, 188], [174, 188], [180, 238], [140, 238]], shade(p.body, -0.3), PEN, 0.25);
  poly(c, [[66, 96], [190, 96], [178, 200], [78, 200]], p.body, PEN, 0.28);
  if (p.has('portcullis')) {
    poly(c, [[90, 116], [166, 116], [166, 190], [90, 190]], '#2a2c32', PEN, 0.1);
    for (let i = 0; i < 6; i++) line(c, 98 + i * 13, 118, 98 + i * 13, 188, 3, METAL);
    for (let i = 0; i < 4; i++) line(c, 92, 130 + i * 18, 164, 130 + i * 18, 3, METAL);
  }
  poly(c, [[40, 96], [82, 96], [78, 152], [36, 150]], shade(p.body, 0.05), PEN, 0.28);
  poly(c, [[174, 96], [216, 96], [220, 150], [178, 152]], shade(p.body, -0.1), PEN, 0.28);
  poly(c, [[34, 152], [78, 156], [72, 204], [30, 198]], shade(p.body, -0.15), PEN, 0.28);
  poly(c, [[180, 156], [224, 152], [228, 198], [184, 204]], shade(p.body, -0.2), PEN, 0.28);
  if (p.has('chains')) for (let i = 0; i < 8; i++) { circle(c, 70 + i * 16, 140 + Math.sin(i) * 8, 5, METAL, { lw: 1.5, ink: INK }, 0.3); }
  if (p.has('shield')) { poly(c, [[6, 140], [48, 130], [54, 198], [28, 226], [2, 198]], '#5a5e66', PEN, 0.3, true); }
  if (p.has('sword')) weaponSword(c, 230, 200, 0.2, 1.3);
  poly(c, [[92, 44], [164, 44], [172, 98], [84, 98]], shade(p.body, 0.1), PEN, 0.28);
  poly(c, [[104, 66], [152, 66], [150, 80], [106, 80]], '#0a0a0e', { lw: 1.5, ink: INK }, 0);
  eye(c, 116, 73, 4.5, p.eye, 0); eye(c, 140, 73, 4.5, p.eye, 0);
  if (p.has('helm')) poly(c, [[92, 44], [128, 24], [164, 44]], shade(p.body, 0.1), PEN, 0.28);
};

const shade_: Painter = (c, p) => {
  glow(c, 128, 150, 100, p.accent, 0.2);
  const g = c.createLinearGradient(0, 40, 0, 250);
  g.addColorStop(0, shade(p.body, 0.1)); g.addColorStop(1, alpha(p.body, 0));
  c.beginPath(); c.moveTo(128, 40);
  c.bezierCurveTo(90, 50, 86, 120, 70, 160); c.lineTo(50, 190); c.lineTo(86, 180); c.lineTo(84, 250);
  c.lineTo(120, 210); c.lineTo(136, 252); c.lineTo(160, 206); c.lineTo(186, 244); c.lineTo(180, 176); c.lineTo(210, 190);
  c.bezierCurveTo(190, 150, 176, 56, 128, 40); c.closePath();
  c.fillStyle = g; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
  limb(c, 74, 128, 28, 168, 16, 6, p.body); limb(c, 182, 128, 226, 168, 16, 6, p.body);
  for (const x of [18, 30, 40]) line(c, 28, 168, x, 190, 3, '#d8d0e8'); for (const x of [216, 226, 238]) line(c, 226, 168, x, 190, 3, '#d8d0e8');
  eye(c, 114, 84, 6, p.eye, 1); eye(c, 142, 84, 6, p.eye, -1);
  if (p.has('horns')) horns(c, 128, 56, 1.2, '#2a2230');
  if (p.has('helm')) helm(c, 128, 70, 1.2, '#3a3a4a');
  if (p.has('sword')) weaponSword(c, 232, 172, 0.3, 1.0, '#6a6a7a');
  if (p.has('cape')) poly(c, [[160, 100], [200, 140], [196, 230], [160, 190]], shade(p.accent, -0.3), PEN, 0.1, true);
  if (p.has('eyes')) for (let i = 0; i < 3; i++) eye(c, 106 + i * 22, 126, 3.5, p.eye, 0);
};

const PAINTERS: Record<CreatureFamily, Painter> = {
  goblin, archer, bat, orc, warg, troll, wraith, serpent, guardian, spider, drake, fiend, wisp, golem, horror, balrog, warden, shade: shade_,
};

// ---------------------------------------------------------------- public
const cache = new Map<string, HTMLCanvasElement>();

export function paintCreature(def: EnemyDef): HTMLCanvasElement {
  const hit = cache.get(def.id);
  if (hit) return hit;
  const cv = makeCanvas(SPRITE, SPRITE);
  const c = ctx2d(cv);
  const pal: Pal = {
    body: def.palette.body, accent: def.palette.accent, eye: def.palette.eye, gear: def.palette.gear,
    has: (f) => !!def.features?.includes(f), seed: [...def.id].reduce((a, ch) => a + ch.charCodeAt(0), 0),
  };
  c.lineJoin = 'round'; c.lineCap = 'round';
  PAINTERS[def.family](c, pal);
  if (def.tier !== 'normal' && def.family !== 'wisp') rimLight(cv, mix(def.palette.accent, '#ffffff', 0.5), -3, -3, def.tier === 'boss' ? 0.7 : 0.45);
  else rimLight(cv, '#ffffff', -2, -2, 0.18);
  cache.set(def.id, cv);
  return cv;
}
export function creatureFootprint(): { w: number; h: number; baseY: number } { return { w: SPRITE, h: SPRITE, baseY: 238 }; }
