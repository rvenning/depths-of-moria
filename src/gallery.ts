import { ENEMY_LIST } from './content/enemies.ts';
import { HERO_LIST } from './content/heroes.ts';
import { paintCreature } from './art/creatures.ts';
import { paintHero } from './art/heroes.ts';
import { FX_KINDS, previewFrames } from './art/pixel/fxFrames.ts';
import { HERO_ANIMS, heroFrame, type HeroAnim } from './art/pixel/heroSprites.ts';
import { compositeBackground, BG_VARIANT_KEYS } from './art/backgrounds.ts';

/** #gallery, #gallery/1 … #gallery/5 : art review pages */
export function mountGallery(root: HTMLElement): void {
  root.style.cssText = 'background:#1b1d24;min-height:100vh;padding:8px;color:#ddd;font:11px sans-serif';
  const arg = location.hash.split('/')[1] ?? '0';
  if (arg === 'bg' || arg === 'bg2') {
    const mkc = (cv: HTMLCanvasElement, label: string) => { const d = document.createElement('div'); d.style.cssText = 'display:inline-block;margin:3px;text-align:center'; cv.style.cssText = 'width:310px;height:155px;display:block;image-rendering:pixelated'; d.appendChild(cv); const l = document.createElement('div'); l.textContent = label; d.appendChild(l); root.appendChild(d); };
    if (arg === 'bg') for (let ch = 1; ch <= 10; ch++) mkc(compositeBackground(ch, 'hall'), 'Chapter ' + ch);
    else for (const v of BG_VARIANT_KEYS) mkc(compositeBackground(1, v), v + ' (ch1)'), mkc(compositeBackground(8, v), v + ' (ch8)');
    return;
  }
  if (arg === 'fx') {
    root.style.background = '#1c1426';
    for (const k of FX_KINDS) {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;align-items:flex-end;margin:4px 0;color:#fff';
      const l = document.createElement('div'); l.textContent = k; l.style.width = '60px'; row.appendChild(l);
      for (const cv of previewFrames(k)) { cv.style.cssText = 'width:' + cv.width * 3 + 'px;height:' + cv.height * 3 + 'px;image-rendering:pixelated;background:#2a2036'; row.appendChild(cv); }
      root.appendChild(row);
    }
    return;
  }
  if (arg === 'anim') {
    for (const hero of HERO_LIST) {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:2px;align-items:flex-end;margin:2px 0;background:#262033';
      for (const a of Object.keys(HERO_ANIMS) as HeroAnim[]) for (let n = 0; n < HERO_ANIMS[a].length; n++) {
        const cv = heroFrame(hero.id, a, n).color; const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; c.getContext('2d')?.drawImage(cv, 0, 0);
        c.style.cssText = 'width:' + cv.width * 2 + 'px;height:' + cv.height * 2 + 'px;image-rendering:pixelated'; c.title = hero.id + ' ' + a + n; row.appendChild(c);
      }
      root.appendChild(row);
    }
    return;
  }
  const page = Number(arg);
  const mk = (cv: HTMLCanvasElement, label: string, size = 150) => {
    const d = document.createElement('div');
    d.style.cssText = 'display:inline-block;margin:3px;text-align:center;background:linear-gradient(#2a2d38,#14151a);border-radius:6px;padding:3px';
    cv.style.cssText = `width:${cv.width * 2}px;height:${cv.height * 2}px;display:block;image-rendering:pixelated`; void size;
    d.appendChild(cv);
    const l = document.createElement('div'); l.textContent = label; d.appendChild(l);
    root.appendChild(d);
  };
  if (page === 0) {
    for (const hero of HERO_LIST) mk(paintHero(hero.id), hero.name, 170);
    for (const en of ENEMY_LIST.slice(0, 16)) mk(paintCreature(en), en.name, 140);
    return;
  }
  const per = 24;
  for (const en of ENEMY_LIST.slice(16 + (page - 1) * per, 16 + page * per)) mk(paintCreature(en), en.name, 150);
}
