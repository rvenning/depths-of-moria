import Phaser from 'phaser';
import { BG_H, BG_PAD, BG_W, HORIZON, PIX, type BgLayers } from '../art/backgrounds.ts';
import { CREATURE_FOOT, paintCreature } from '../art/creatures.ts';
import { HERO_FOOT, HERO_H, paintHero } from '../art/heroes.ts';
import { ENEMIES } from '../content/enemies.ts';
import { HEROES } from '../content/heroes.ts';
import { STATUSES } from '../content/statuses.ts';
import type { StatusId } from '../content/schema.ts';
import type { BEvent, UnitView } from '../core/battle/types.ts';

export const STAGE_W = BG_W;
export const STAGE_H = BG_H;
/** the UI font (a bundled pixel face) */
const FONT = "'Jersey 15', monospace";
/** one art pixel is PIX stage pixels, so every sprite is shown at exactly PIX times its native size */
const ZOOM = PIX;

const HERO_COLOR = '#9ec3ff';
const ENEMY_COLOR = '#ffb09a';

interface Node {
  uid: number;
  view: UnitView;
  c: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Ellipse;
  bar: Phaser.GameObjects.Graphics;
  hpText: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  icons: Phaser.GameObjects.Container;
  statuses: Map<StatusId, Phaser.GameObjects.Image>;
  baseX: number; baseY: number; baseScale: number;
  hp: number; maxHp: number; shownHp: number;
  side: 'hero' | 'enemy';
  idle?: Phaser.Tweens.Tween;
  alive: boolean;
  facing: number;
}

export interface SceneInit {
  bg: BgLayers;
  heroes: UnitView[];
  enemies: UnitView[];
  reduced: boolean;
  icons: Record<string, HTMLImageElement>;
}

export interface SceneHooks { onLog?: (text: string, tone: 'h' | 'e' | 'w' | 'g' | '') => void }

export function slotPos(side: 'hero' | 'enemy', slot: number, scale: number): { x: number; y: number } {
  const cx = side === 'hero' ? 1 : -1;
  const mid = STAGE_W / 2;
  const floorY = STAGE_H * HORIZON;
  let x: number; let y: number;
  // a front row of three stepping down-and-out, with the back row standing in the gaps behind them
  if (slot < 3) { x = mid - cx * (110 + slot * 120); y = floorY + 62 + slot * 18; }
  else { const j = slot - 3; x = mid - cx * (170 + j * 120); y = floorY + 2 + j * 6; }
  if (scale > 1.4) { x = mid + 190; y = floorY + 100; }
  // keep every foot on the pixel grid
  return { x: Math.round(x / ZOOM) * ZOOM, y: Math.round(y / ZOOM) * ZOOM };
}

export class BattleScene extends Phaser.Scene {
  private nodes = new Map<number, Node>();
  private layers: Phaser.GameObjects.Image[] = [];
  private bgLights: { img: Phaser.GameObjects.Image; base: number; speed: number; flick: number }[] = [];
  speed = 2;
  reduced = false;
  hooks: SceneHooks = {};
  private ready = false;
  private pendingInit?: SceneInit;
  private banner?: Phaser.GameObjects.Text;
  private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private fxLayer?: Phaser.GameObjects.Container;
  private driftT = 0;
  private lowSaid = new Set<number>();
  private lastQuote = 0;

  constructor() { super('battle'); }

  create(): void {
    this.makeTextures();
    this.fxLayer = this.add.container(0, 0).setDepth(10000);
    this.ready = true;
    if (this.pendingInit) this.applyInit(this.pendingInit);
  }

  private makeTextures(): void {
    const mk = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
      if (this.textures.exists(key)) return;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const c = cv.getContext('2d') as CanvasRenderingContext2D; c.imageSmoothingEnabled = false; draw(c);
      this.textures.addCanvas(key, cv);
    };
    const px = (c: CanvasRenderingContext2D, color: string, rows: string[]) => { c.fillStyle = color; rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') c.fillRect(x, y, 1, 1); }); };
    // every texture below is a handful of native pixels, shown at PIX x
    mk('dot', 3, 3, (c) => px(c, '#fff', ['.#.', '###', '.#.']));
    mk('dotL', 5, 5, (c) => px(c, '#fff', ['.###.', '#####', '#####', '#####', '.###.']));
    mk('ringtex', 32, 32, (c) => px(c, '#fff', ['..........########..........', '.......###........###.......', '.....##..............##.....']));
    mk('spark', 9, 9, (c) => px(c, '#fff', ['....#....', '....#....', '...###...', '.#######.', '#########', '.#######.', '...###...', '....#....', '....#....']));
    mk('slash', 16, 16, (c) => px(c, '#fff', ['.............##.', '...........####.', '.........####...', '.......####.....', '......###.......', '.....###........', '....###.........', '....###.........', '....###.........', '....###.........', '.....###........', '......###.......', '.......####.....', '.........####...', '...........####.', '.............##.']));
    mk('orb', 11, 11, (c) => { px(c, '#fff', ['...#####...', '..#######..', '.#########.', '###########', '###########', '###########', '###########', '###########', '.#########.', '..#######..', '...#####...']); c.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 6; i++) c.fillRect(2 + i, 8 - (i >> 1), 1, 1); });
    mk('streak', 24, 5, (c) => { px(c, '#fff', ['.......................#', '.....##################', '.....###################', '.....##################', '.......................#']); c.fillStyle = 'rgba(255,255,255,0.45)'; for (let x = 0; x < 5; x++) c.fillRect(x, 2, 1, 1); });
  }

  /** a light's glow: a radial falloff turned into ordered-dither dots, so it stays pixel art */
  private glowTexture(radiusNative: number): string {
    const key = `glow:${radiusNative}`;
    if (this.textures.exists(key)) return key;
    const n = radiusNative * 2, cv = document.createElement('canvas'); cv.width = n; cv.height = n;
    const c = cv.getContext('2d') as CanvasRenderingContext2D; const img = c.createImageData(n, n);
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - radiusNative, y + 0.5 - radiusNative) / radiusNative;
      const a = d >= 1 ? 0 : (1 - d) * (1 - d);
      if (a > (B[((y & 3) << 2) | (x & 3)] + 0.5) / 16 * 0.9) { const i = (y * n + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = 255; }
    }
    c.putImageData(img, 0, 0); this.textures.addCanvas(key, cv); return key;
  }

  /** a dithered ground shadow, wNative pixels wide */
  private shadowTexture(wNative: number): string {
    const key = `sh:${wNative}`;
    if (this.textures.exists(key)) return key;
    const h = Math.max(5, Math.round(wNative / 5)), cv = document.createElement('canvas'); cv.width = wNative; cv.height = h;
    const c = cv.getContext('2d') as CanvasRenderingContext2D; c.fillStyle = '#05030a';
    for (let y = 0; y < h; y++) for (let x = 0; x < wNative; x++) {
      const dx = (x + 0.5 - wNative / 2) / (wNative / 2), dy = (y + 0.5 - h / 2) / (h / 2), d = Math.hypot(dx, dy);
      if (d < 0.62 || (d < 1 && ((x + y) & 1) === 0)) c.fillRect(x, y, 1, 1);
    }
    this.textures.addCanvas(key, cv); return key;
  }

  // ------------------------------------------------------------------ setup
  init0(data: SceneInit): void {
    this.reduced = data.reduced;
    if (!this.ready) { this.pendingInit = data; return; }
    this.applyInit(data);
  }

  private applyInit(data: SceneInit): void {
    this.pendingInit = undefined;
    this.reduced = data.reduced;
    for (const [k, img] of Object.entries(data.icons)) if (!this.textures.exists(k)) this.textures.addImage(k, img);
    this.buildBackground(data.bg);
    for (const n of this.nodes.values()) { n.idle?.stop(); n.c.destroy(); }
    this.nodes.clear(); this.lowSaid.clear();
    for (const u of data.heroes) this.addUnit(u, false);
    for (const u of data.enemies) this.addUnit(u, false);
  }

  private bgKeys: string[] = [];

  private buildBackground(bg: BgLayers): void {
    for (const l of this.layers) l.destroy();
    const keep = new Set(['far', 'mid', 'floor', 'near'].map((n) => `bg:${bg.theme}:${bg.variant}:${n}`));
    for (const k of this.bgKeys) if (!keep.has(k) && this.textures.exists(k)) this.textures.remove(k);
    this.bgKeys = [...keep];
    for (const l of this.bgLights) l.img.destroy();
    for (const e of this.emitters) e.destroy();
    this.layers = []; this.bgLights = []; this.emitters = [];
    const add = (name: string, cv: HTMLCanvasElement, depth: number) => {
      const key = `bg:${bg.theme}:${bg.variant}:${name}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, cv);
      // the layer is BG_PAD native pixels larger on every side, so showing it at exactly ZOOM keeps every pixel square
      const img = this.add.image(STAGE_W / 2, STAGE_H / 2, key).setScale(ZOOM).setDepth(depth);
      this.layers.push(img);
      return img;
    };
    add('far', bg.far, -40); add('mid', bg.mid, -30); add('floor', bg.floor, -20);
    add('near', bg.near, 9000);
    void BG_PAD;
    for (const l of bg.lights) {
      const R = Math.max(8, Math.round(l.r / ZOOM / 8) * 8);
      const x = Math.round(l.x / ZOOM) * ZOOM, y = Math.round(l.y / ZOOM) * ZOOM;
      const img = this.add.image(x, y, this.glowTexture(R)).setScale(ZOOM).setBlendMode(Phaser.BlendModes.ADD).setDepth(-10).setTint(Phaser.Display.Color.HexStringToColor(this.hexOf(l.color)).color);
      img.setAlpha(0.4);
      this.bgLights.push({ img, base: 0.4, speed: 0.004 + Math.random() * 0.004, flick: l.flicker });
    }
    // ambient particles: single pixels drifting
    if (!this.reduced) {
      const cfg: Record<string, { tint: number; speedY: [number, number]; alpha: number; tex: string; freq: number }> = {
        embers: { tint: 0xffa040, speedY: [-30, -80], alpha: 0.9, tex: 'dot', freq: 110 },
        dust: { tint: 0xd8d0b8, speedY: [-4, 6], alpha: 0.45, tex: 'dot', freq: 160 },
        mist: { tint: 0xb8c8d8, speedY: [-3, 3], alpha: 0.22, tex: 'dotL', freq: 200 },
        bubbles: { tint: 0x9affd0, speedY: [-18, -40], alpha: 0.5, tex: 'dotL', freq: 220 },
        sparks: { tint: 0xc8a0ff, speedY: [-8, 8], alpha: 0.8, tex: 'dot', freq: 150 },
        motes: { tint: 0xffe8b0, speedY: [-6, 4], alpha: 0.6, tex: 'dot', freq: 150 },
      };
      const p = cfg[bg.particles];
      const em = this.add.particles(0, 0, p.tex, {
        x: { min: 0, max: STAGE_W }, y: { min: STAGE_H * 0.3, max: STAGE_H }, speedX: { min: -10, max: 10 }, speedY: { min: p.speedY[0], max: p.speedY[1] },
        lifespan: { min: 3000, max: 6000 }, scale: ZOOM, alpha: { start: p.alpha, end: 0 }, tint: p.tint,
        frequency: p.freq, quantity: 1, blendMode: 'ADD',
      }).setDepth(-5);
      this.emitters.push(em);
    }
  }

  private hexOf(c: string): string {
    if (c.startsWith('#')) return c;
    const m = c.match(/\d+/g);
    if (!m) return '#ffffff';
    return `#${m.slice(0, 3).map((x) => Number(x).toString(16).padStart(2, '0')).join('')}`;
  }

  private textureFor(u: UnitView): string {
    if (u.side === 'hero' && u.heroId) {
      const key = `h:${u.heroId}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, paintHero(u.heroId));
      return key;
    }
    const key = `e:${u.id}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, paintCreature(ENEMIES[u.id]));
    return key;
  }

  /** sprites are always shown at exactly ZOOM; a bigger monster is a bigger native sprite (see paintCreature) */
  private footOf(u: UnitView): number { return u.side === 'hero' ? HERO_FOOT / HERO_H : CREATURE_FOOT; }

  addUnit(u: UnitView, animate = true): void {
    if (this.nodes.has(u.uid)) return;
    const scale = ZOOM;
    const pos = slotPos(u.side, u.slot, u.scale);
    const facing = u.side === 'hero' ? 1 : -1;
    const c = this.add.container(pos.x, pos.y);
    const sprite = this.add.image(0, 0, this.textureFor(u)).setOrigin(0.5, this.footOf(u)).setScale(scale);
    const wNative = Math.round(sprite.width * 0.7);
    const shadow = this.add.image(0, -ZOOM, this.shadowTexture(wNative)).setScale(ZOOM).setAlpha(0.8);
    const ring = this.add.ellipse(0, -2, wNative * ZOOM * 1.1, wNative * ZOOM * 0.22).setStrokeStyle(2, 0xffe08a, 1).setAlpha(0);
    // sprites are painted facing: heroes → right, enemies → left. nothing to flip.
    const bar = this.add.graphics();
    const w = Math.max(48, Math.min(104, Math.round(sprite.width * ZOOM * 0.5 / 4) * 4));
    const name = this.add.text(0, 6, u.name, { fontFamily: FONT, fontSize: '16px', color: u.side === 'hero' ? HERO_COLOR : ENEMY_COLOR, stroke: '#0b0714', strokeThickness: 3 }).setOrigin(0.5, 0);
    const hpText = this.add.text(0, 20, '', { fontFamily: FONT, fontSize: '16px', color: '#fff', stroke: '#0b0714', strokeThickness: 3 }).setOrigin(0.5, 0);
    const icons = this.add.container(0, -sprite.displayHeight * this.footOf(u) - 10);
    c.add([shadow, ring, sprite, bar, name, hpText, icons]);
    c.setDepth(pos.y);
    const node: Node = {
      uid: u.uid, view: u, c, sprite, shadow, ring, bar, hpText, name, icons, statuses: new Map(), baseX: pos.x, baseY: pos.y, baseScale: scale,
      hp: u.hp, maxHp: u.maxHp, shownHp: u.hp, side: u.side, alive: true, facing,
    };
    this.nodes.set(u.uid, node);
    this.drawBar(node, w);
    if (!this.reduced) {
      // a two-pixel breath: whole-pixel steps keep the sprite crisp
      node.idle = this.tweens.add({ targets: sprite, y: -ZOOM, duration: 700 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'stepped', easeParams: [2], delay: Math.random() * 600 });
    }
    if (animate) {
      c.setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, duration: 300 / this.speed, ease: 'stepped', easeParams: [4] });
      this.puff(pos.x, pos.y - 30, 0xffffff);
    }
  }

  private drawBar(n: Node, w = 72): void {
    const g = n.bar; g.clear();
    const frac = Math.max(0, Math.min(1, n.shownHp / n.maxHp));
    const x = -w / 2; const y = 17;
    g.fillStyle(0x0b0714, 1); g.fillRect(x - 2, y - 2, w + 4, 10);
    g.fillStyle(0x3a1c2a, 1); g.fillRect(x, y, w, 6);
    const col = n.side === 'hero' ? (frac > 0.5 ? 0x62d98b : frac > 0.25 ? 0xe8c64a : 0xe05a4a) : 0xe0564a;
    const lit = n.side === 'hero' ? (frac > 0.5 ? 0xa6f0bf : frac > 0.25 ? 0xfbe58a : 0xff9a8a) : 0xff9a8a;
    const fw = Math.round(Math.max(0, w * frac) / 2) * 2;
    g.fillStyle(col, 1); g.fillRect(x, y, fw, 6);
    g.fillStyle(lit, 1); g.fillRect(x, y, fw, 2);
    n.hpText.setText(`${Math.max(0, Math.round(n.shownHp))}`);
    n.hpText.setY(28);
    n.name.setY(0);
    if (n.view.tier === 'boss') { n.name.setFontSize('18px'); }
  }

  private setHp(n: Node, hp: number, dur = 260): void {
    n.hp = hp;
    const from = n.shownHp;
    const w = Math.max(48, Math.min(104, Math.round(n.sprite.width * ZOOM * 0.5 / 4) * 4));
    if (this.reduced || dur <= 0) { n.shownHp = hp; this.drawBar(n, w); return; }
    this.tweens.addCounter({ from, to: hp, duration: dur / this.speed, onUpdate: (t) => { n.shownHp = t.getValue() ?? hp; this.drawBar(n, w); }, onComplete: () => { n.shownHp = hp; this.drawBar(n, w); } });
  }

  // ------------------------------------------------------------------ helpers
  private wait(ms: number): Promise<void> {
    return new Promise((res) => { this.time.delayedCall(Math.max(1, ms / this.speed), res); });
  }
  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((res) => { this.tweens.add({ ...cfg, duration: (cfg.duration as number) / this.speed, onComplete: () => res() }); });
  }
  private pos(n: Node): { x: number; y: number } { return { x: n.c.x, y: n.c.y - n.sprite.displayHeight * 0.5 }; }

  private popText(x: number, y: number, text: string, color: string, size = 18, dur = 900): void {
    const t = this.add.text(x, y, text, { fontFamily: FONT, fontSize: `${Math.round(size * 1.3)}px`, color, stroke: '#0b0714', strokeThickness: 4 }).setOrigin(0.5).setDepth(9500);
    this.fxLayer?.add(t);
    if (this.reduced) { this.time.delayedCall(dur / this.speed, () => t.destroy()); return; }
    this.tweens.add({ targets: t, y: y - 42, alpha: { from: 1, to: 0 }, scale: { from: 1.25, to: 1 }, duration: dur / this.speed, ease: 'cubic.out', delay: 80 / this.speed, onComplete: () => t.destroy() });
  }

  private puff(x: number, y: number, tint: number, n = 8): void {
    if (this.reduced) return;
    const e = this.add.particles(x, y, 'dot', { speed: { min: 40, max: 120 }, lifespan: 420, scale: ZOOM, alpha: { start: 0.9, end: 0 }, tint, quantity: n, emitting: false, blendMode: 'ADD' }).setDepth(9400);
    e.explode(n);
    this.time.delayedCall(700, () => e.destroy());
  }

  /** a blade arc or a spark burst where a hit lands, in whole-pixel steps */
  private hitFx(n: Node, kind: string, crit: boolean): void {
    if (this.reduced || kind === 'heal') return;
    const p = this.pos(n);
    const magic = kind === 'magic' || kind === 'dot';
    const img = this.add.image(Math.round(p.x / ZOOM) * ZOOM + (n.side === 'hero' ? -8 : 8), Math.round(p.y / ZOOM) * ZOOM, magic ? 'spark' : 'slash')
      .setScale(crit ? ZOOM * 2 : ZOOM).setDepth(9450).setTint(crit ? 0xffe08a : magic ? 0xb8d0ff : 0xffffff);
    if (!magic) img.setAngle((n.side === 'hero' ? 180 : 0) + Phaser.Math.Between(-3, 3) * 10);
    this.tweens.add({ targets: img, alpha: { from: 1, to: 0 }, duration: 240 / this.speed, ease: 'stepped', easeParams: [4], onComplete: () => img.destroy() });
  }

  private flash(n: Node, color = 0xffffff): void {
    n.sprite.setTint(color).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(90 / this.speed, () => { if (n.sprite.scene) n.sprite.clearTint(); });
  }

  private shake(intensity = 0.004, dur = 120): void {
    if (this.reduced) return;
    this.cameras.main.shake(dur / this.speed, intensity);
  }

  private bannerText(text: string, color = '#ffe08a', size = 22, y = 54, dur = 900): Promise<void> {
    this.banner?.destroy();
    const t = this.add.text(STAGE_W / 2, y, text, { fontFamily: FONT, fontSize: `${Math.round(size * 1.3)}px`, color, stroke: '#0b0714', strokeThickness: 6, align: 'center' }).setOrigin(0.5).setDepth(9800);
    this.banner = t;
    if (this.reduced) { return this.wait(dur).then(() => { t.destroy(); }); }
    t.setAlpha(0).setScale(0.85);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 180 / this.speed });
    return this.wait(dur).then(() => new Promise<void>((res) => this.tweens.add({ targets: t, alpha: 0, duration: 200 / this.speed, onComplete: () => { t.destroy(); res(); } })));
  }

  private unitBanner(n: Node, text: string, color = '#fff', lift = 0): void {
    const t = this.add.text(n.c.x, n.c.y - n.sprite.displayHeight * this.footOf(n.view) - 28 - lift, text, { fontFamily: FONT, fontSize: '17px', color, stroke: '#0b0714', strokeThickness: 4 }).setOrigin(0.5).setDepth(9600);
    this.fxLayer?.add(t);
    this.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, y: t.y - 12, duration: 1100 / this.speed, delay: 250 / this.speed, onComplete: () => t.destroy() });
  }

  // ------------------------------------------------------------------ the event player
  async play(events: BEvent[], speed: number): Promise<void> {
    this.speed = speed;
    let actor: Node | undefined;
    let skillFx = '';
    let lungeBack: (() => Promise<void>) | null = null;
    let firstHitDone = false;
    for (const ev of events) {
      this.speed = this.speed || speed;
      switch (ev.t) {
        case 'wave': {
          await this.bannerText(`Wave ${ev.n}`, '#ffe08a', 20, 54, 600);
          for (const e of ev.enemies) this.addUnit(e, true);
          await this.wait(300);
          break;
        }
        case 'summon': this.addUnit(ev.unit, true); this.hooks.onLog?.(`${ev.unit.name} joins the fight.`, 'w'); await this.wait(260); break;
        case 'turn': {
          actor = this.nodes.get(ev.actor);
          firstHitDone = false;
          if (actor && !ev.skip) { this.ring(actor, true); }
          if (actor && ev.skip) { this.unitBanner(actor, ev.skip === 'stun' ? 'Stunned!' : 'Afraid!', '#ffd24a'); await this.wait(400); }
          break;
        }
        case 'skill': {
          const a = this.nodes.get(ev.actor);
          if (!a) break;
          actor = a; skillFx = ev.fx;
          const targets = ev.targets.map((id) => this.nodes.get(id)).filter(Boolean) as Node[];
          if (ev.name && ev.skill !== 'combo-follow') this.unitBanner(a, ev.name, a.side === 'hero' ? '#cfe2ff' : '#ffcfc4');
          lungeBack = await this.windup(a, targets, ev.fx);
          break;
        }
        case 'hit': {
          const t = this.nodes.get(ev.target);
          const a = this.nodes.get(ev.actor);
          if (!t) break;
          if (a && ev.kind !== 'dot' && ev.kind !== 'hazard' && !firstHitDone && ev.kind !== 'reflect') { await this.projectile(a, t, ev.fx ?? skillFx, ev.kind); firstHitDone = true; }
          else if (a && a !== t && (ev.kind === 'phys' || ev.kind === 'magic' || ev.kind === 'true') && !this.reduced) await this.projectile(a, t, ev.fx ?? skillFx, ev.kind, true);
          this.flash(t, ev.kind === 'dot' ? 0xb86aff : 0xffffff);
          this.hitFx(t, ev.kind, !!ev.crit);
          const col = ev.kind === 'magic' ? '#9ec8ff' : ev.kind === 'dot' ? '#d49aff' : ev.kind === 'reflect' ? '#ffd080' : ev.kind === 'hazard' ? '#ffa860' : t.side === 'hero' ? '#ff9a8a' : '#fff6d6';
          const shown = ev.absorbed && !ev.amount ? `(${ev.absorbed})` : `${ev.amount}`;
          this.popText(t.c.x, t.c.y - t.sprite.displayHeight * 0.7, ev.crit ? `${shown}!` : shown, ev.crit ? '#ffe04a' : col, ev.crit ? 26 : 18);
          this.setHp(t, ev.hp);
          if (!this.reduced) {
            const dir = t.side === 'hero' ? -1 : 1;
            this.tweens.add({ targets: t.sprite, x: dir * 8, duration: 60 / this.speed, yoyo: true, ease: 'quad.out' });
          }
          if (ev.crit) { this.shake(0.006, 140); this.puff(t.c.x, this.pos(t).y, 0xffe08a, 10); if (a && a.side === 'hero' && a.view.heroId && Math.random() < 0.3) this.say(a, HEROES[a.view.heroId].quotes.crit); }
          if (t.side === 'hero' && t.view.heroId && ev.hp > 0 && ev.hp / t.maxHp < 0.25 && !this.lowSaid.has(t.uid)) { this.lowSaid.add(t.uid); this.say(t, HEROES[t.view.heroId].quotes.low); }
          else this.puff(t.c.x, this.pos(t).y, ev.kind === 'magic' ? 0x88b8ff : 0xffffff, 4);
          this.hooks.onLog?.(`${a?.view.name ?? '?'} hits ${t.view.name} for ${ev.amount}${ev.absorbed ? ` (+${ev.absorbed} absorbed)` : ''}${ev.crit ? ' — critical!' : ''}`, a?.side === 'hero' ? 'h' : 'e');
          await this.wait(ev.kind === 'dot' ? 160 : 110);
          break;
        }
        case 'miss': {
          const t = this.nodes.get(ev.target);
          if (t) {
            const a = this.nodes.get(ev.actor);
            if (a) await this.projectile(a, t, skillFx, 'phys');
            this.popText(t.c.x, t.c.y - t.sprite.displayHeight * 0.7, 'Miss', '#cfcfcf', 14);
            if (!this.reduced) this.tweens.add({ targets: t.sprite, x: (t.side === 'hero' ? -14 : 14), duration: 90 / this.speed, yoyo: true });
            this.hooks.onLog?.(`${t.view.name} avoids the attack.`, '');
          }
          await this.wait(140);
          break;
        }
        case 'heal': {
          const t = this.nodes.get(ev.target);
          if (!t) break;
          this.popText(t.c.x, t.c.y - t.sprite.displayHeight * 0.7, `+${ev.amount}`, '#7be39b', 18);
          this.setHp(t, ev.hp);
          this.puff(t.c.x, this.pos(t).y, 0x7be39b, 8);
          this.hooks.onLog?.(`${t.view.name} recovers ${ev.amount}.`, 'g');
          await this.wait(150);
          break;
        }
        case 'shield': {
          const t = this.nodes.get(ev.target);
          if (t) { this.popText(t.c.x, t.c.y - t.sprite.displayHeight * 0.7, `Shield ${ev.amount}`, '#9ec8ff', 14); this.puff(t.c.x, this.pos(t).y, 0x88b8ff, 8); }
          await this.wait(120);
          break;
        }
        case 'status': {
          const t = this.nodes.get(ev.target);
          if (!t) break;
          this.setStatus(t, ev.id, ev.on);
          if (ev.on) this.unitBanner(t, STATUSES[ev.id].name, STATUSES[ev.id].kind === 'buff' ? '#9be8b0' : '#ff9a8a', 16);
          break;
        }
        case 'gauge': break;
        case 'row': { const t = this.nodes.get(ev.target); if (t) { this.unitBanner(t, ev.row === 'back' ? 'Pushed back!' : 'Dragged forward!', '#ffd080'); } await this.wait(200); break; }
        case 'death': {
          const t = this.nodes.get(ev.target);
          if (!t) break;
          t.alive = false; t.idle?.stop();
          for (const k of [...t.statuses.keys()]) this.setStatus(t, k, false);
          this.hooks.onLog?.(`${t.view.name} falls!`, t.side === 'hero' ? 'e' : 'h');
          if (this.reduced) { t.c.setAlpha(0.15); } else {
            this.puff(t.c.x, this.pos(t).y, 0xffffff, 14);
            this.tweens.add({ targets: t.c, alpha: 0.12, y: t.c.y + 8, duration: 420 / this.speed, ease: 'quad.in' });
            this.tweens.add({ targets: t.sprite, angle: t.side === 'hero' ? -90 : 90, duration: 420 / this.speed, ease: 'stepped', easeParams: [3] });
          }
          await this.wait(320);
          break;
        }
        case 'phase': {
          this.shake(0.01, 280);
          this.flashScreen(0xff5030);
          this.hooks.onLog?.(ev.announce, 'w');
          await this.bannerText(ev.announce, '#ffb36a', 22, 70, 1500);
          break;
        }
        case 'hazard': {
          if (ev.warn) { this.hooks.onLog?.(`${ev.name} is coming…`, 'w'); this.unitBannerAt(STAGE_W / 2, 90, `${ev.name} looms…`, '#ffcf9a'); break; }
          this.flashScreen(ev.kind === 'furnace' || ev.kind === 'emberRain' ? 0xff7a2a : ev.kind === 'shadowDrain' ? 0x6a3aaa : 0x88aaff);
          this.shake(0.007, 200);
          this.hooks.onLog?.(`${ev.name}!`, 'w');
          await this.bannerText(ev.name, '#ffb36a', 24, 70, 700);
          break;
        }
        case 'combo': {
          const a = this.nodes.get(ev.actors[0]); const b = this.nodes.get(ev.actors[1]);
          this.hooks.onLog?.(`Fellowship combo — ${ev.name}!`, 'g');
          if (a && b) { this.link(a, b); this.puff(a.c.x, this.pos(a).y, 0xffe08a, 8); this.puff(b.c.x, this.pos(b).y, 0xffe08a, 8); }
          await this.bannerText(`✦ ${ev.name} ✦`, '#ffe08a', 20, 98, 700);
          break;
        }
        case 'round': break;
        case 'text': this.hooks.onLog?.(ev.msg, ev.tone === 'warn' ? 'w' : ev.tone === 'good' ? 'g' : ''); break;
        case 'end': break;
        case 'start': break;
        default: break;
      }
      if (lungeBack && ev.t !== 'skill' && ev.t !== 'hit' && ev.t !== 'miss' && ev.t !== 'status' && ev.t !== 'heal' && ev.t !== 'shield' && ev.t !== 'gauge' && ev.t !== 'death') { await lungeBack(); lungeBack = null; }
    }
    if (lungeBack) await (lungeBack as () => Promise<void>)();
    if (actor) this.ring(actor, false);
  }

  /** a short line of hero dialogue above their head (rate-limited so a long fight is not a chatterbox) */
  private say(n: Node, text: string): void {
    const now = this.time.now;
    if (now - this.lastQuote < 2500 / this.speed) return;
    this.lastQuote = now;
    const t = this.add.text(n.c.x, n.c.y - n.sprite.displayHeight * this.footOf(n.view) - 46, `“${text}”`, { fontFamily: FONT, fontSize: '16px', color: '#f4ecd0', stroke: '#0b0714', strokeThickness: 4, fontStyle: 'italic', wordWrap: { width: 170 }, align: 'center' }).setOrigin(0.5).setDepth(9650);
    this.fxLayer?.add(t);
    this.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, y: t.y - 10, duration: 1800 / this.speed, delay: 700 / this.speed, onComplete: () => t.destroy() });
  }

  private unitBannerAt(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, { fontFamily: FONT, fontSize: '18px', color, stroke: '#0b0714', strokeThickness: 4 }).setOrigin(0.5).setDepth(9600);
    this.fxLayer?.add(t);
    this.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, duration: 1300 / this.speed, onComplete: () => t.destroy() });
  }

  private ring(n: Node, on: boolean): void {
    if (!n.c.scene) return;
    n.ring.setAlpha(on ? 0.9 : 0);
  }

  private link(a: Node, b: Node): void {
    const g = this.add.graphics().setDepth(9500);
    g.lineStyle(4, 0xffe08a, 0.9); g.lineBetween(a.c.x, a.c.y - 50, b.c.x, b.c.y - 50);
    this.tweens.add({ targets: g, alpha: 0, duration: 600 / this.speed, onComplete: () => g.destroy() });
  }

  private flashScreen(color: number): void {
    if (this.reduced) return;
    const r = this.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, color, 0.28).setDepth(9700).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: r, alpha: 0, duration: 380 / this.speed, onComplete: () => r.destroy() });
  }

  private setStatus(n: Node, id: StatusId, on: boolean): void {
    const have = n.statuses.get(id);
    if (on && !have) {
      const key = `ic:${STATUSES[id].glyph}:${STATUSES[id].kind}`;
      if (!this.textures.exists(key)) return;
      const img = this.add.image(0, 0, key).setScale(1);
      n.icons.add(img); n.statuses.set(id, img);
      if (!this.reduced) this.tweens.add({ targets: img, scale: { from: 0.01, to: img.scale }, duration: 160 / this.speed, ease: 'back.out' });
    } else if (!on && have) {
      have.destroy(); n.statuses.delete(id);
    }
    let i = 0; const total = n.statuses.size;
    for (const img of n.statuses.values()) { img.setPosition((i - (total - 1) / 2) * 18, 0); i++; }
  }

  // ------------------------------------------------------------------ attack choreography
  private async windup(a: Node, targets: Node[], fx: string): Promise<(() => Promise<void>) | null> {
    const melee = ['slash', 'cleave', 'smash', 'bite', 'slam', 'pierce', 'whip'].includes(fx);
    if (this.reduced) { await this.wait(180); return null; }
    if (melee && targets.length && targets[0] !== a) {
      const t = targets[0];
      const dir = a.side === 'hero' ? 1 : -1;
      const tx = t.c.x - dir * 54; const ty = t.c.y + 2;
      const ox = a.c.x; const oy = a.c.y;
      await this.tween({ targets: a.c, x: tx, y: ty, duration: 170, ease: 'quad.in' });
      return async () => { await this.tween({ targets: a.c, x: ox, y: oy, duration: 170, ease: 'quad.out' }); };
    }
    // cast / shoot pose: a small hop and glow
    const col = this.fxColor(fx);
    this.puff(a.c.x, this.pos(a).y, col, 6);
    await this.tween({ targets: a.sprite, y: -10, duration: 90, yoyo: true, ease: 'quad.out' });
    return null;
  }

  private fxColor(fx: string): number {
    switch (fx) {
      case 'fire': return 0xff8a3a; case 'light': return 0xfff0a8; case 'heal': return 0x7be39b; case 'shield': case 'wave': case 'water': return 0x88b8ff;
      case 'shadow': case 'curse': return 0xb86aff; case 'poison': return 0x9be83a; case 'buff': case 'rally': case 'horn': case 'drum': return 0xffe08a;
      case 'arrow': case 'volley': case 'pierce': return 0xe8e0c8; default: return 0xffffff;
    }
  }

  private async projectile(a: Node, t: Node, fx: string, kind: string, quick = false): Promise<void> {
    if (this.reduced) return;
    if (a === t) return;
    const melee = ['slash', 'cleave', 'smash', 'bite', 'slam', 'whip'].includes(fx) && kind !== 'magic';
    if (melee) return;
    const from = this.pos(a); const to = this.pos(t);
    const color = this.fxColor(fx);
    const isArrow = fx === 'arrow' || fx === 'volley' || fx === 'pierce';
    const img = this.add.image(from.x, from.y, isArrow ? 'streak' : 'orb').setTint(color).setDepth(9300).setBlendMode(Phaser.BlendModes.ADD);
    if (isArrow) img.setRotation(Math.atan2(to.y - from.y, to.x - from.x)); img.setScale(ZOOM);
    await this.tween({ targets: img, x: to.x, y: to.y, duration: quick ? 90 : 190, ease: 'quad.in' });
    img.destroy();
  }

  // ------------------------------------------------------------------ frame
  update(_t: number, dt: number): void {
    this.driftT += dt;
    for (const l of this.bgLights) {
      const f = Math.sin(this.driftT * l.speed * l.flick * 3) * 0.06 + Math.sin(this.driftT * l.speed * 7.3) * 0.04;
      l.img.setAlpha(this.reduced ? l.base : Math.max(0.12, l.base + f));
    }
    if (!this.reduced && this.layers.length) {
      const d = Math.sin(this.driftT * 0.00025);
      this.layers[0]?.setX(STAGE_W / 2 + Math.round(d * 2) * ZOOM);
      this.layers[1]?.setX(STAGE_W / 2 + Math.round(d * 4) * ZOOM);
      this.layers[3]?.setX(STAGE_W / 2 - Math.round(d * 6) * ZOOM);
    }
  }

  clearAll(): void { for (const n of this.nodes.values()) { n.idle?.stop(); n.c.destroy(); } this.nodes.clear(); }
  unitNode(uid: number): Node | undefined { return this.nodes.get(uid); }
}
