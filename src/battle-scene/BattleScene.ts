import Phaser from 'phaser';
import { BG_H, BG_PAD, BG_W, HORIZON, PIX, type BgLayers } from '../art/backgrounds.ts';
import { CREATURE_FOOT, paintCreature, paintCreatureNormal } from '../art/creatures.ts';
import { HERO_FOOT, HERO_H } from '../art/heroes.ts';
import { HERO_ANIMS, heroFrame, type HeroAnim } from '../art/pixel/heroSprites.ts';
import { breathe, leanTop, normalMapOf } from '../art/pixel/pixelize.ts';
import type { HeroId } from '../content/schema.ts';
import { loopVfx, playVfx, registerVfx, type FxKind } from './vfx.ts';
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

/** the ambient light of each chapter's theme (what the unlit stone looks like) */
const AMBIENT: Record<string, number> = {
  gate: 0xc8c8e8, gallery: 0xb8d0e0, forge: 0xe0c0b0, stair: 0xc0c0d0, halls: 0xe0d4b0,
  flooded: 0xa8d4e0, archives: 0xc8b8e8, chasm: 0xa8b0d8, flame: 0xe8b8a0, bridge: 0xe0b0a0,
};

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
  /** sprite animation: the current clip, when a one-shot clip ends, a per-unit phase so a party does not breathe in unison, the texture on show */
  anim: HeroAnim;
  hold: number;
  phase: number;
  texKey: string;
  alive: boolean;
  facing: number;
}

export interface SceneInit {
  bg: BgLayers;
  heroes: UnitView[];
  enemies: UnitView[];
  reduced: boolean;
  icons: Record<string, HTMLImageElement>;
  /** 'hd': dynamic lights, bloom, tilt-shift depth of field; 'low': flat pixel art (for slow GPUs) */
  quality?: 'hd' | 'low';
  /** let the scene drop to 'low' by itself when the frame rate is poor */
  autoQuality?: boolean;
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
  /** HD-2D mode: real lights with normal maps, bloom and a tilt-shift camera */
  hd = true;
  autoQuality = false;
  private slowFor = 0;
  private hdReady = false;
  private deco: { stop: () => void }[] = [];
  private shafts: Phaser.GameObjects.Image[] = [];
  private lightObjs: { light: Phaser.GameObjects.Light; base: number; speed: number; flick: number; phase: number }[] = [];

  constructor() { super('battle'); }

  create(): void {
    this.makeTextures();
    registerVfx(this);
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
    mk('arrow', 11, 7, (c) => { px(c, '#0b0714', ['ooooooooooo', 'o#########o', '.o#######o.', '..o#####o..', '...o###o...', '....o#o....', '.....o.....'].map((r) => r.replace(/[^o]/g, '.').replace(/o/g, '#'))); px(c, '#ffe08a', ['...........', '.#########.', '..#######..', '...#####...', '....###....', '.....#.....', '...........']); });
    // a soft slanted shaft of light, as ordered-dither dots (tinted when shown)
    mk('shaft', 40, 150, (c) => { const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]; const img = c.createImageData(40, 150); for (let y = 0; y < 150; y++) for (let x = 0; x < 40; x++) { const cx = 8 + (y / 150) * 22, w = 5 + (y / 150) * 9, d = Math.abs(x - cx) / w; const a = d >= 1 ? 0 : (1 - d) * (1 - y / 170) * 0.9; if (a > (B[((y & 3) << 2) | (x & 3)] + 0.5) / 16) { const i = (y * 40 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = 255; } } c.putImageData(img, 0, 0); });
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
    this.autoQuality = !!data.autoQuality;
    this.introDone = false;
    this.setQuality(data.quality ?? 'hd');
    for (const [k, img] of Object.entries(data.icons)) if (!this.textures.exists(k)) this.textures.addImage(k, img);
    this.buildBackground(data.bg);
    if (this.hd) this.lights.setAmbientColor(AMBIENT[data.bg.theme] ?? 0xc8c8e8);
    for (const n of this.nodes.values()) { n.idle?.stop(); n.c.destroy(); }
    this.nodes.clear(); this.lowSaid.clear();
    for (const u of data.heroes) this.addUnit(u, false);
    for (const u of data.enemies) this.addUnit(u, false);
  }

  private introDone = false;
  private marker?: Phaser.GameObjects.Image;
  private markerTween?: Phaser.Tweens.Tween;
  /** a gold arrow bobbing over whoever's turn it is */
  private markActor(n?: Node): void {
    this.markerTween?.stop(); this.markerTween = undefined;
    if (!n || this.reduced) { this.marker?.setVisible(false); return; }
    if (!this.marker) this.marker = this.add.image(0, 0, 'arrow').setScale(ZOOM).setDepth(9400);
    const y = Math.round((n.c.y - n.sprite.displayHeight * this.footOf(n.view) - 26) / ZOOM) * ZOOM;
    this.marker.setVisible(true).setPosition(Math.round(n.c.x / ZOOM) * ZOOM, y);
    this.markerTween = this.tweens.add({ targets: this.marker, y: y - 6, duration: 260 / this.speed, yoyo: true, repeat: -1, ease: 'stepped', easeParams: [2] });
  }

  /** film-style black bars sliding in and out (boss introductions, the ending) */
  private bars?: Phaser.GameObjects.Rectangle[];
  private letterbox(on: boolean, ms = 360): Promise<void> {
    if (!this.bars) {
      const mkb = (y: number) => this.add.rectangle(STAGE_W / 2, y, STAGE_W + 8, 60, 0x05030a, 1).setDepth(9900).setScale(1, 0);
      this.bars = [mkb(0), mkb(STAGE_H)];
      this.bars[0].setOrigin(0.5, 0); this.bars[1].setOrigin(0.5, 1);
    }
    const target = on ? 1 : 0;
    return new Promise((res) => {
      let done = 0; const fin = () => { if (++done === 2) res(); };
      for (const b of this.bars as Phaser.GameObjects.Rectangle[]) this.tweens.add({ targets: b, scaleY: target, duration: ms / this.speed, ease: 'quad.out', onComplete: fin });
    });
  }

  /** the opening of a fight: a boss gets a letterboxed name card and a slow push-in; everything else just a short banner */
  private async introFor(enemies: UnitView[]): Promise<void> {
    const boss = enemies.find((e) => e.tier === 'boss');
    if (!boss || this.reduced) return;
    const cam = this.cameras.main;
    void this.letterbox(true);
    this.tweens.add({ targets: cam, zoom: 1.07, duration: 900 / this.speed, ease: 'sine.inOut' });
    const t = this.add.text(STAGE_W / 2, STAGE_H / 2 - 150, boss.name.toUpperCase(), { fontFamily: FONT, fontSize: '46px', color: '#ffd9a0', stroke: '#2a0d06', strokeThickness: 8, align: 'center' }).setOrigin(0.5).setDepth(9950).setAlpha(0);
    const sub = this.add.text(STAGE_W / 2, STAGE_H / 2 - 108, 'chapter boss', { fontFamily: FONT, fontSize: '22px', color: '#ffb36a', stroke: '#0b0714', strokeThickness: 5 }).setOrigin(0.5).setDepth(9950).setAlpha(0);
    this.tweens.add({ targets: [t, sub], alpha: 1, duration: 420 / this.speed, ease: 'stepped', easeParams: [5] });
    this.shake(0.006, 380);
    await this.wait(1500);
    this.tweens.add({ targets: [t, sub], alpha: 0, duration: 280 / this.speed, onComplete: () => { t.destroy(); sub.destroy(); } });
    this.tweens.add({ targets: cam, zoom: 1, duration: 420 / this.speed, ease: 'sine.inOut' });
    await this.letterbox(false);
  }

  /** a shower of gold sparks for a won fight */
  private confetti(): void {
    if (this.reduced) return;
    const e = this.add.particles(STAGE_W / 2, -8, 'spark', { x: { min: -440, max: 440 }, speedY: { min: 60, max: 170 }, speedX: { min: -25, max: 25 }, lifespan: 2400, scale: ZOOM, alpha: { start: 1, end: 0 }, tint: [0xffe08a, 0xffffff, 0x9be8b0, 0xffb36a], frequency: 35, quantity: 2 }).setDepth(9600);
    this.time.delayedCall(1700 / this.speed, () => { e.stop(); this.time.delayedCall(2600, () => e.destroy()); });
  }

  /** switch the HD-2D layer on or off (lights, bloom, depth of field) */
  setQuality(q: 'hd' | 'low'): void {
    const want = q === 'hd';
    if (want === this.hd && (this.hdReady || !want)) return;
    this.hd = want;
    const cam = this.cameras.main;
    if (want) {
      this.lights.enable().setAmbientColor(0xc8c8e8);
      if (!this.hdReady) {
        const pf = cam.filters.internal.addParallelFilters();
        pf.top.addThreshold(0.62, 0.98); pf.top.addBlur(1, 4, 4, 1.3);
        pf.blend.blendMode = Phaser.BlendModes.ADD; pf.blend.amount = 0.55;
        cam.filters.external.addVignette(0.5, 0.52, 0.9, 0.5);
        this.hdReady = true;
      } else { cam.filters.internal.list.forEach((x) => x.setActive(true)); cam.filters.external.list.forEach((x) => x.setActive(true)); }
    } else {
      this.lights.disable();
      cam.filters.internal.list.forEach((x) => x.setActive(false)); cam.filters.external.list.forEach((x) => x.setActive(false));
    }
    for (const l of this.layers) l.setLighting(want);
    for (const n of this.nodes.values()) n.sprite.setLighting(want);
  }

  /** a short coloured flash of light where something happens (a hit, a spell) */
  flashLight(x: number, y: number, color: number, radius = 150, intensity = 2.4, ms = 260): void {
    if (!this.hd || this.reduced) return;
    const l = this.lights.addLight(x, y, radius, color, intensity, radius * 0.6);
    const o = { v: intensity };
    this.tweens.add({ targets: o, v: 0, duration: ms / this.speed, ease: 'quad.out', onUpdate: () => { l.intensity = o.v; }, onComplete: () => { this.lights.removeLight(l); } });
  }

  private bgKeys: string[] = [];

  private buildBackground(bg: BgLayers): void {
    for (const l of this.layers) l.destroy();
    const keep = new Set(['far', 'mid', 'floor', 'near'].map((n) => `bg:${bg.theme}:${bg.variant}:${n}`));
    for (const k of this.bgKeys) if (!keep.has(k) && this.textures.exists(k)) this.textures.remove(k);
    this.bgKeys = [...keep];
    for (const l of this.bgLights) l.img.destroy();
    for (const l of this.lightObjs) this.lights.removeLight(l.light);
    this.lightObjs = [];
    for (const d of this.deco) d.stop();
    this.deco = [];
    for (const s of this.shafts) s.destroy();
    this.shafts = [];
    for (const e of this.emitters) e.destroy();
    this.layers = []; this.bgLights = []; this.emitters = [];
    const add = (name: string, cv: HTMLCanvasElement, depth: number) => {
      const key = `bg:${bg.theme}:${bg.variant}:${name}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, cv);
      // the layer is BG_PAD native pixels larger on every side, so showing it at exactly ZOOM keeps every pixel square
      const img = this.add.image(STAGE_W / 2, STAGE_H / 2, key).setScale(ZOOM).setDepth(depth);
      if (name !== 'near' && !this.textures.get(key).dataSource.length) this.textures.get(key).setDataSource(normalMapOf(cv, 1.8));
      if (name !== 'near') img.setLighting(this.hd);
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
      this.deco.push(loopVfx(this, 'torch', x, y + 8, { scale: 1, depth: -9, phase: Math.floor(Math.random() * 4) }));
      const col = Phaser.Display.Color.HexStringToColor(this.hexOf(l.color));
      const light = this.lights.addLight(x, y, l.r * 2.7, col.color, 1.8, l.r * 2.7 * 0.6);
      this.lightObjs.push({ light, base: 1.8, speed: 0.004 + Math.random() * 0.004, flick: l.flicker, phase: Math.random() * 100 });
    }
    // slanted light shafts falling through the room (a theme-coloured haze), drifting a little
    if (this.hd && !this.reduced) {
      const tint = bg.theme === 'flooded' ? 0x9ad8ff : bg.theme === 'flame' || bg.theme === 'bridge' || bg.theme === 'forge' ? 0xff9a60 : bg.theme === 'archives' ? 0xc8a8ff : 0xffe2a8;
      [0.22, 0.5, 0.78].forEach((fx, i) => { const s = this.add.image(Math.round((STAGE_W * fx) / ZOOM) * ZOOM, 120, 'shaft').setScale(ZOOM * 1.4).setOrigin(0.5, 0).setDepth(-8).setAlpha(0.13).setTint(tint).setBlendMode(Phaser.BlendModes.ADD); this.shafts.push(s); void i; });
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

  /** the texture for one frame of a hero clip (with its normal map for the lights) */
  private heroTex(id: HeroId, anim: HeroAnim, i: number): string {
    const key = `h:${id}:${anim}:${i}`;
    if (!this.textures.exists(key)) { const f = heroFrame(id, anim, i); const t = this.textures.addCanvas(key, f.color); t?.setDataSource(f.normal); }
    return key;
  }

  /** an enemy's frames: as painted, breathing in, winding up, lunging (they face left, so forward is -x) and flinching */
  private enemyTex(id: string, v: 'idle0' | 'idle1' | 'wind' | 'strike' | 'hurt'): string {
    const key = v === 'idle0' ? `e:${id}` : `e:${id}:${v}`;
    if (!this.textures.exists(key)) {
      const def = ENEMIES[id], base = paintCreature(def);
      const cv = v === 'idle0' ? base : v === 'idle1' ? breathe(base) : v === 'wind' ? leanTop(base, 3, -1) : v === 'strike' ? leanTop(base, -5, 1) : leanTop(base, 4, 0);
      const t = this.textures.addCanvas(key, cv); t?.setDataSource(v === 'idle0' ? paintCreatureNormal(def) : normalMapOf(cv, 1.4));
    }
    return key;
  }

  private textureFor(u: UnitView): string {
    if (u.side === 'hero' && u.heroId) return this.heroTex(u.heroId, 'idle', 0);
    return this.enemyTex(u.id, 'idle0');
  }

  /** play a clip once for `ms` (an enemy has wind-up, strike and hurt frames; its cast is a wind-up) */
  private setAnim(n: Node, anim: HeroAnim, ms: number): void {
    if (!n.alive) return;
    if (n.side === 'enemy') { if (anim === 'win' || anim === 'idle') return; if (anim === 'cast') anim = 'wind'; }
    n.anim = anim; n.hold = this.time.now + ms / this.speed;
  }

  private stepAnim(n: Node, now: number): void {
    let key: string;
    if (n.side === 'hero' && n.view.heroId) {
      if (n.anim !== 'idle' && n.anim !== 'win' && now > n.hold) n.anim = 'idle';
      const len = HERO_ANIMS[n.anim].length;
      const per = n.anim === 'idle' ? 260 : n.anim === 'win' ? 300 : 110;
      const i = this.reduced && n.anim === 'idle' ? 0 : Math.floor((now + n.phase) / per) % len;
      key = this.heroTex(n.view.heroId, n.anim, i);
    } else {
      if (n.anim !== 'idle' && now > n.hold) n.anim = 'idle';
      const pose = n.anim === 'wind' || n.anim === 'strike' || n.anim === 'hurt' ? n.anim : null;
      key = this.enemyTex(n.view.id, pose ?? (this.reduced ? 'idle0' : [0, 1, 1, 0][Math.floor((now + n.phase) / 340) % 4] ? 'idle1' : 'idle0'));
    }
    if (key !== n.texKey) { n.sprite.setTexture(key); n.texKey = key; }
  }

  /** sprites are always shown at exactly ZOOM; a bigger monster is a bigger native sprite (see paintCreature) */
  private footOf(u: UnitView): number { return u.side === 'hero' ? HERO_FOOT / HERO_H : CREATURE_FOOT; }

  addUnit(u: UnitView, animate = true): void {
    if (this.nodes.has(u.uid)) return;
    const scale = ZOOM;
    const pos = slotPos(u.side, u.slot, u.scale);
    const facing = u.side === 'hero' ? 1 : -1;
    const c = this.add.container(pos.x, pos.y);
    const sprite = this.add.image(0, 0, this.textureFor(u)).setOrigin(0.5, this.footOf(u)).setScale(scale).setLighting(this.hd);
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
      anim: 'idle', hold: 0, phase: Math.random() * 2000, texKey: '',
    };
    this.nodes.set(u.uid, node);
    this.drawBar(node, w);
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

  /** play an effect clip at a unit (its middle, or its feet) */
  private vfx(kind: FxKind, n: Node, o: { tint?: number; scale?: number; feet?: boolean; angle?: number; flipX?: boolean; dx?: number; dy?: number } = {}): void {
    if (this.reduced) return;
    const x = Math.round((n.c.x + (o.dx ?? 0)) / ZOOM) * ZOOM;
    const y = Math.round((o.feet ? n.c.y : this.pos(n).y) / ZOOM) * ZOOM + (o.dy ?? 0);
    void playVfx(this, kind, x, y, { tint: o.tint, scale: o.scale, angle: o.angle, flipX: o.flipX, speed: this.speed / 2, anchorBottom: false });
  }

  /** what a hit looks like, by the skill's effect type: fire, shadow and poison each have their own animation */
  private hitFx(n: Node, kind: string, crit: boolean, fx = ''): void {
    if (this.reduced || kind === 'heal') return;
    const big = crit ? 1.35 : 1;
    const dir = n.side === 'hero' ? 1 : -1;
    const col = this.fxColor(fx);
    switch (fx) {
      case 'fire': this.vfx('flame', n, { scale: big, dy: -8 }); this.vfx('impact', n, { tint: 0xffb060, scale: big }); break;
      case 'light': this.vfx('rays', n, { tint: 0xfff0a8, scale: big }); break;
      case 'shield': this.vfx('shield', n, { tint: 0x9ec8ff, scale: big }); break;
      case 'wave': this.vfx('burst', n, { tint: 0x88b8ff, scale: big }); break;
      case 'water': this.vfx('ice', n, { scale: big, dy: -6 }); this.vfx('burst', n, { tint: 0xa8d8ff, scale: 0.8 }); break;
      case 'shadow': case 'curse': this.vfx('shadow', n, { scale: big, dy: -6 }); break;
      case 'poison': this.vfx('poison', n, { scale: big, dy: -4 }); break;
      case 'buff': case 'rally': case 'horn': case 'drum': this.vfx('aura', n, { tint: 0xffe08a, feet: true, dy: -4 }); break;
      case 'arrow': case 'volley': case 'pierce': this.vfx('impact', n, { tint: 0xf0e8d0, scale: 0.8 * big, dx: -6 * dir }); break;
      case 'smash': case 'slam': this.vfx('impact', n, { scale: 1.3 * big }); this.vfx('smoke', n, { feet: true, dy: -10 }); break;
      case 'bite': this.vfx('slash', n, { scale: 0.8 * big, angle: 40 * dir }); this.vfx('slash', n, { scale: 0.8 * big, angle: -40 * dir, flipX: true }); break;
      case 'whip': this.vfx('slash', n, { scale: 1.3 * big, angle: 100 * dir }); break;
      default:
        if (kind === 'magic' || kind === 'dot') this.vfx('burst', n, { tint: 0xb8d0ff, scale: 0.7 * big });
        else this.vfx('slash', n, { scale: big, angle: (dir > 0 ? 160 : -20) + Phaser.Math.Between(-2, 2) * 10 });
    }
    const p = this.pos(n);
    this.flashLight(p.x, p.y, fx ? col : crit ? 0xffe08a : 0xfff0d0, crit ? 240 : 150, crit ? 1.9 : 1.2, 260);
  }

  /** a beat of frozen time on a critical hit, the way fighting games land a punch */
  private hitStop(ms: number): void {
    if (this.reduced) return;
    this.tweens.timeScale = 0.05; this.time.timeScale = 0.05;
    window.setTimeout(() => { if (this.sys?.isActive()) { this.tweens.timeScale = 1; this.time.timeScale = 1; } }, ms);
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
    if (!this.introDone) { this.introDone = true; await this.introFor([...this.nodes.values()].filter((n) => n.side === 'enemy').map((n) => n.view)); }
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
          if (actor && !ev.skip) { this.ring(actor, true); this.markActor(actor); }
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
          if (ev.hp > 0) this.setAnim(t, 'hurt', 280);
          this.hitFx(t, ev.kind, !!ev.crit, ev.fx ?? skillFx);
          const col = ev.kind === 'magic' ? '#9ec8ff' : ev.kind === 'dot' ? '#d49aff' : ev.kind === 'reflect' ? '#ffd080' : ev.kind === 'hazard' ? '#ffa860' : t.side === 'hero' ? '#ff9a8a' : '#fff6d6';
          const shown = ev.absorbed && !ev.amount ? `(${ev.absorbed})` : `${ev.amount}`;
          this.popText(t.c.x, t.c.y - t.sprite.displayHeight * 0.7, ev.crit ? `${shown}!` : shown, ev.crit ? '#ffe04a' : col, ev.crit ? 26 : 18);
          this.setHp(t, ev.hp);
          if (!this.reduced) {
            const dir = t.side === 'hero' ? -1 : 1;
            this.tweens.add({ targets: t.sprite, x: dir * 8, duration: 60 / this.speed, yoyo: true, ease: 'quad.out' });
          }
          if (ev.crit) { this.hitStop(75); this.shake(0.006, 140); this.puff(t.c.x, this.pos(t).y, 0xffe08a, 10); if (a && a.side === 'hero' && a.view.heroId && Math.random() < 0.3) this.say(a, HEROES[a.view.heroId].quotes.crit); }
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
          this.flashLight(t.c.x, this.pos(t).y, 0x7be39b, 190, 1.3, 420);
          this.vfx('heal', t, { tint: 0x8affb0, feet: true, dy: -4 });
          this.setHp(t, ev.hp);
          this.puff(t.c.x, this.pos(t).y, 0x7be39b, 8);
          this.hooks.onLog?.(`${t.view.name} recovers ${ev.amount}.`, 'g');
          await this.wait(150);
          break;
        }
        case 'shield': {
          const t = this.nodes.get(ev.target);
          if (t) { this.popText(t.c.x, t.c.y - t.sprite.displayHeight * 0.7, `Shield ${ev.amount}`, '#9ec8ff', 14); this.vfx('shield', t, { tint: 0x9ec8ff }); }
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
        case 'end':
          this.markActor(undefined);
          if (ev.result === 'victory') {
            for (const n of this.nodes.values()) if (n.side === 'hero' && n.alive) this.setAnim(n, 'win', 1e9);
            this.confetti(); void this.bannerText('Victory!', '#ffe08a', 34, 110, 1500);
          } else { this.flashScreen(0xaa2020); void this.bannerText('The company falls…', '#ff9a8a', 28, 110, 1500); }
          break;
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
      this.setAnim(a, 'wind', 190);
      await this.tween({ targets: a.c, x: tx, y: ty, duration: 170, ease: 'quad.in' });
      this.setAnim(a, 'strike', 340);
      return async () => { await this.tween({ targets: a.c, x: ox, y: oy, duration: 170, ease: 'quad.out' }); };
    }
    // cast / shoot pose: a small hop and glow
    const col = this.fxColor(fx);
    this.puff(a.c.x, this.pos(a).y, col, 6);
    this.flashLight(a.c.x, this.pos(a).y, col, 200, 1.4, 380);
    this.setAnim(a, 'cast', 520);
    this.vfx('aura', a, { tint: col, feet: true, dy: -3, scale: 0.7 });
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
    // a slow GPU (software rendering, an old phone) gets plain pixels instead of a slideshow
    if (this.hd && this.autoQuality && this.driftT > 4000) {
      this.slowFor = this.game.loop.actualFps < 26 ? this.slowFor + dt : Math.max(0, this.slowFor - dt);
      if (this.slowFor > 3500) { this.setQuality('low'); try { localStorage.setItem('dom.fxLow', '1'); } catch { /* private mode */ } this.hooks.onLog?.('Graphics switched to plain pixels (slow frame rate). You can change this in Settings.', 'w'); }
    }
    const now = this.time.now;
    for (const n of this.nodes.values()) if (n.alive) this.stepAnim(n, now);
    this.shafts.forEach((s, i) => s.setAlpha(this.reduced ? 0.13 : 0.1 + 0.05 * Math.sin(this.driftT / 1700 + i * 2.1)));
    for (const l of this.lightObjs) {
      const f = Math.sin(this.driftT * l.speed * l.flick * 3 + l.phase) * 0.18 + Math.sin(this.driftT * l.speed * 7.3 + l.phase) * 0.1;
      l.light.intensity = this.reduced ? l.base : Math.max(0.5, l.base + f);
    }
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
