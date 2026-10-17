import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import Phaser from 'phaser';
import { BattleScene, STAGE_H, STAGE_W, type SceneHooks, type SceneInit } from '../battle-scene/BattleScene.ts';
import { iconImage } from '../art/icons.ts';
import { STATUSES } from '../content/statuses.ts';
import type { BEvent } from '../core/battle/types.ts';

export interface StageApi {
  init(data: Omit<SceneInit, 'icons'>): void;
  play(events: BEvent[], speed: number): Promise<void>;
  setSpeed(n: number): void;
  hooks: SceneHooks;
  ready: Promise<void>;
}

const iconCache: Record<string, HTMLImageElement> = {};
async function loadStatusIcons(): Promise<Record<string, HTMLImageElement>> {
  if (Object.keys(iconCache).length) return iconCache;
  await Promise.all(Object.values(STATUSES).map(async (s) => {
    const key = `ic:${s.glyph}:${s.kind}`;
    if (!iconCache[key]) iconCache[key] = await iconImage(s.glyph, 40, s.kind === 'buff' ? '#9be8b0' : '#ff9a8a');
  }));
  return iconCache;
}

export const BattleStage = forwardRef<StageApi, { className?: string }>(function BattleStage({ className }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const scene = useRef<BattleScene | null>(null);
  const gate = useMemo(() => { let resolve: () => void = () => {}; const promise = new Promise<void>((r) => { resolve = r; }); return { promise, resolve }; }, []);
  const hooks = useRef<SceneHooks>({});

  useEffect(() => {
    if (!host.current) return;
    const s = new BattleScene();
    scene.current = s;
    s.hooks = hooks.current;
    const g = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: STAGE_W,
      height: STAGE_H,
      backgroundColor: '#050507',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, pixelArt: false, roundPixels: false },
      audio: { noAudio: true },
      banner: false,
      disableContextMenu: true,
      scene: s,
      fps: { target: 60 },
    });
    game.current = g;
    (window as unknown as { __phaser?: unknown }).__phaser = { game: g, scene: s };
    g.events.once('ready', () => gate.resolve());
    // make sure the "ready" promise resolves even if the scene's create has not run yet
    const t = setInterval(() => { if (s.sys?.isActive?.() || (s as unknown as { ready: boolean }).ready) { clearInterval(t); gate.resolve(); } }, 30);
    return () => { clearInterval(t); g.destroy(true); game.current = null; scene.current = null; };
  }, [gate]);

  useImperativeHandle(ref, () => ({
    ready: gate.promise,
    hooks: hooks.current,
    init: (data) => {
      void (async () => {
        await gate.promise;
        const icons = await loadStatusIcons();
        try { scene.current?.init0({ ...data, icons }); } catch (e) { console.error('battle scene init failed', e); }
      })();
    },
    play: async (events, speed) => { await scene.current?.play(events, speed); },
    setSpeed: (n) => { if (scene.current) scene.current.speed = n; },
  }), [gate]);

  return <div className={`phaser ${className ?? ''}`} ref={host} role="img" aria-label="Battle scene" />;
});
