import Phaser from 'phaser';
import { BG_H, BG_W, HORIZON, type BgLayers } from '../art/backgrounds.ts';
import { paintCreature } from '../art/creatures.ts';
import { HERO_SCALE, paintHero } from '../art/heroes.ts';
import { ENEMIES } from '../content/enemies.ts';
import { HEROES } from '../content/heroes.ts';
import { STATUSES } from '../content/statuses.ts';
import type { HeroId, StatusId } from '../content/schema.ts';
import type { BEvent, UnitView } from '../core/battle/types.ts';

export const STAGE_W = BG_W;
export const STAGE_H = BG_H;
const FOOT = 238 / 256;

const HERO_COLOR = '#9ec3ff';
const ENEMY_COLOR = '#ffb09a';

interface Node {
  uid: number;
  view: UnitView;
  c: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
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
  if (slot < 3) { x = mid - cx * (112 + slot * 58); y = floorY + 44 + slot * 58; }
  else { const j = slot - 3; x = mid - cx * (300 + j * 54); y = floorY + 72 + j * 66; }
  if (scale > 1.4) { x = mid + 170; y = floorY + 100; }
  return { x, y };
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
    const mk = (key: string, draw: (c: CanvasRenderingContext2D) => void, w = 64, h = 64) => {
      if (this.textures.exists(key)) return;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const c = cv.getContext('2d') as CanvasRenderingContext2D; draw(c);
      this.textures.addCanvas(key, cv);
    };
    mk('dot', (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
    mk('ringtex', (c) => { c.lineWidth = 5; c.strokeStyle = '#fff'; c.beginPath(); c.arc(32, 32, 26, 0, Math.PI * 2); c.stroke(); });
    mk('spark', (c) => { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(32, 2); c.lineTo(38, 26); c.lineTo(62, 32); c.lineTo(38, 38); c.lineTo(32, 62); c.lineTo(26, 38); c.lineTo(2, 32); c.lineTo(26, 26); c.closePath(); c.fill(); });
    mk('streak', (c) => { const g = c.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)'); c.fillStyle = g; c.fillRect(0, 26, 64, 12); }, 64, 64);
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
      const img = this.add.image(STAGE_W / 2, STAGE_H / 2, key).setDisplaySize(STAGE_W + 24, STAGE_H + 8).setDepth(depth);
      this.layers.push(img);
      return img;
    };
    add('far', bg.far, -40); add('mid', bg.mid, -30); add('floor', bg.floor, -20);
    const near = add('near', bg.near, 9000);
    near.setAlpha(0.95);
    for (const l of bg.lights) {
      const img = this.add.image(l.x, l.y, 'dot').setBlendMode(Phaser.BlendModes.ADD).setDepth(-10).setTint(Phaser.Display.Color.HexStringToColor(this.hexOf(l.color)).color);
      img.setDisplaySize(l.r * 2, l.r * 2).setAlpha(0.28);
      this.bgLights.push({ img, base: 0.28, speed: 0.004 + Math.random() * 0.004, flick: l.flicker });
    }
    // ambient particles
    if (!this.reduced) {
      const cfg: Record<string, { tint: number; speedY: [number, number]; alpha: number; scale: number; count: number }> = {
        embers: { tint: 0xffa040, speedY: [-30, -80], alpha: 0.8, scale: 0.12, count: 90 },
        dust: { tint: 0xd8d0b8, speedY: [-4, 6], alpha: 0.35, scale: 0.08, count: 220 },
        mist: { tint: 0xb8c8d8, speedY: [-3, 3], alpha: 0.25, scale: 0.2, count: 300 },
        bubbles: { tint: 0x9affd0, speedY: [-18, -40], alpha: 0.4, scale: 0.1, count: 200 },
        sparks: { tint: 0xc8a0ff, speedY: [-8, 8], alpha: 0.7, scale: 0.07, count: 160 },
        motes: { tint: 0xffe8b0, speedY: [-6, 4], alpha: 0.5, scale: 0.08, count: 200 },
      };
      const p = cfg[bg.particles];
      const em = this.add.particles(0, 0, 'dot', {
        x: { min: 0, max: STAGE_W }, y: { min: STAGE_H * 0.3, max: STAGE_H }, speedX: { min: -10, max: 10 }, speedY: { min: p.speedY[0], max: p.speedY[1] },
        lifespan: { min: 3000, max: 6000 }, scale: { start: p.scale, end: 0 }, alpha: { start: p.alpha, end: 0 }, tint: p.tint,
        frequency: 160, quantity: 1, blendMode: 'ADD',
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

  private scaleFor(u: UnitView): number {
    const base = 0.66;
    if (u.side === 'hero') return base * (HERO_SCALE[u.heroId as HeroId] ?? 1);
    return base * (u.scale ?? 1) * (u.tier === 'boss' ? 1.05 : 1);
  }

  addUnit(u: UnitView, animate = true): void {
    if (this.nodes.has(u.uid)) return;
    const scale = this.scaleFor(u);
    const pos = slotPos(u.side, u.slot, u.scale);
    const facing = u.side === 'hero' ? 1 : -1;
    const c = this.add.container(pos.x, pos.y);
    const shadow = this.add.ellipse(0, -2, 80 * scale * 1.5, 16 * scale * 1.5, 0x000000, 0.45);
    const ring = this.add.ellipse(0, -2, 100 * scale * 1.5, 22 * scale * 1.5).setStrokeStyle(3, 0xffe08a, 1).setAlpha(0);
    const sprite = this.add.image(0, 0, this.textureFor(u)).setOrigin(0.5, FOOT).setScale(scale * (u.side === 'hero' ? 1 : 1));
    // sprites are painted facing: heroes → right, enemies → left. nothing to flip.
    const bar = this.add.graphics();
    const w = Math.max(60, 74 * Math.min(1.3, u.scale ?? 1));
    const name = this.add.text(0, 6, u.name, { fontFamily: 'Georgia, serif', fontSize: '10px', color: u.side === 'hero' ? HERO_COLOR : ENEMY_COLOR, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0);
    const hpText = this.add.text(0, 20, '', { fontFamily: 'Georgia, serif', fontSize: '9px', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0);
    const icons = this.add.container(0, -sprite.displayHeight * FOOT - 6);
    c.add([shadow, ring, sprite, bar, name, hpText, icons]);
    c.setDepth(pos.y);
    const node: Node = {
      uid: u.uid, view: u, c, sprite, shadow, ring, bar, hpText, name, icons, statuses: new Map(), baseX: pos.x, baseY: pos.y, baseScale: scale,
      hp: u.hp, maxHp: u.maxHp, shownHp: u.hp, side: u.side, alive: true, facing,
    };
    this.nodes.set(u.uid, node);
    this.drawBar(node, w);
    if (!this.reduced) {
      node.idle = this.tweens.add({ targets: sprite, scaleY: scale * 1.025, scaleX: scale * 0.99, duration: 900 + Math.random() * 500, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: Math.random() * 600 });
    }
    if (animate) {
      c.setAlpha(0).setScale(0.6);
      this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 300 / this.speed, ease: 'back.out' });
      this.puff(pos.x, pos.y - 30, 0xffffff);
    }
  }

  private drawBar(n: Node, w = 70): void {
    const g = n.bar; g.clear();
    const frac = Math.max(0, Math.min(1, n.shownHp / n.maxHp));
    const x = -w / 2; const y = 17;
    g.fillStyle(0x000000, 0.8); g.fillRoundedRect(x - 1, y - 1, w + 2, 7, 3);
    g.fillStyle(0x2a0e0c, 1); g.fillRoundedRect(x, y, w, 5, 2);
    const col = n.side === 'hero' ? (frac > 0.5 ? 0x5fd88a : frac > 0.25 ? 0xe8c64a : 0xe05a4a) : 0xd85a4a;
    g.fillStyle(col, 1); g.fillRoundedRect(x, y, Math.max(0, w * frac), 5, 2);
    n.hpText.setText(`${Math.max(0, Math.round(n.shownHp))}`);
    n.hpText.setY(24);
    n.name.setY(3);
    if (n.view.tier === 'boss') { n.name.setFontSize('12px'); }
  }

  private setHp(n: Node, hp: number, dur = 260): void {
    n.hp = hp;
    const from = n.shownHp;
    const w = Math.max(60, 74 * Math.min(1.3, n.view.scale ?? 1));
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
    const t = this.add.text(x, y, text, { fontFamily: 'Georgia, serif', fontSize: `${size}px`, color, stroke: '#000', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5).setDepth(9500);
    this.fxLayer?.add(t);
    if (this.reduced) { this.time.delayedCall(dur / this.speed, () => t.destroy()); return; }
    this.tweens.add({ targets: t, y: y - 42, alpha: { from: 1, to: 0 }, scale: { from: 1.25, to: 1 }, duration: dur / this.speed, ease: 'cubic.out', delay: 80 / this.speed, onComplete: () => t.destroy() });
  }

  private puff(x: number, y: number, tint: number, n = 8): void {
    if (this.reduced) return;
    const e = this.add.particles(x, y, 'dot', { speed: { min: 40, max: 120 }, lifespan: 420, scale: { start: 0.25, end: 0 }, alpha: { start: 0.9, end: 0 }, tint, quantity: n, emitting: false, blendMode: 'ADD' }).setDepth(9400);
    e.explode(n);
    this.time.delayedCall(700, () => e.destroy());
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
    const t = this.add.text(STAGE_W / 2, y, text, { fontFamily: 'Georgia, serif', fontSize: `${size}px`, color, stroke: '#000', strokeThickness: 6, fontStyle: 'bold', align: 'center' }).setOrigin(0.5).setDepth(9800);
    this.banner = t;
    if (this.reduced) { return this.wait(dur).then(() => { t.destroy(); }); }
    t.setAlpha(0).setScale(0.85);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 180 / this.speed });
    return this.wait(dur).then(() => new Promise<void>((res) => this.tweens.add({ targets: t, alpha: 0, duration: 200 / this.speed, onComplete: () => { t.destroy(); res(); } })));
  }

  private unitBanner(n: Node, text: string, color = '#fff', lift = 0): void {
    const t = this.add.text(n.c.x, n.c.y - n.sprite.displayHeight * FOOT - 28 - lift, text, { fontFamily: 'Georgia, serif', fontSize: '13px', color, stroke: '#000', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5).setDepth(9600);
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
            this.tweens.add({ targets: t.sprite, scaleY: t.baseScale * 0.7, angle: t.side === 'hero' ? -12 : 12, duration: 420 / this.speed });
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
    const t = this.add.text(n.c.x, n.c.y - n.sprite.displayHeight * FOOT - 46, `“${text}”`, { fontFamily: 'Georgia, serif', fontSize: '12px', color: '#f4ecd0', stroke: '#000', strokeThickness: 4, fontStyle: 'italic', wordWrap: { width: 170 }, align: 'center' }).setOrigin(0.5).setDepth(9650);
    this.fxLayer?.add(t);
    this.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, y: t.y - 10, duration: 1800 / this.speed, delay: 700 / this.speed, onComplete: () => t.destroy() });
  }

  private unitBannerAt(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, { fontFamily: 'Georgia, serif', fontSize: '14px', color, stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(9600);
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
      const img = this.add.image(0, 0, key).setDisplaySize(15, 15);
      n.icons.add(img); n.statuses.set(id, img);
      if (!this.reduced) this.tweens.add({ targets: img, scale: { from: 0.01, to: img.scale }, duration: 160 / this.speed, ease: 'back.out' });
    } else if (!on && have) {
      have.destroy(); n.statuses.delete(id);
    }
    let i = 0; const total = n.statuses.size;
    for (const img of n.statuses.values()) { img.setPosition((i - (total - 1) / 2) * 16, 0); i++; }
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
    const img = this.add.image(from.x, from.y, isArrow ? 'streak' : 'dot').setTint(color).setDepth(9300).setBlendMode(Phaser.BlendModes.ADD);
    if (isArrow) { img.setRotation(Math.atan2(to.y - from.y, to.x - from.x)); img.setDisplaySize(52, 10); } else { img.setDisplaySize(34, 34); }
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
      this.layers[0]?.setX(STAGE_W / 2 + d * 6);
      this.layers[1]?.setX(STAGE_W / 2 + d * 12);
      this.layers[3]?.setX(STAGE_W / 2 - d * 16);
    }
  }

  clearAll(): void { for (const n of this.nodes.values()) { n.idle?.stop(); n.c.destroy(); } this.nodes.clear(); }
  unitNode(uid: number): Node | undefined { return this.nodes.get(uid); }
}
