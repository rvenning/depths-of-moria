import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Phaser from 'phaser';
import { BattleScene, STAGE_H, STAGE_W, type SceneHooks, type SceneInit } from '../battle-scene/BattleScene.ts';
import { pixelIconImage } from '../art/icons.ts';
import { STATUSES } from '../content/statuses.ts';
import type { BEvent } from '../core/battle/types.ts';

export type StageInit = Omit<SceneInit, 'icons'>;
export interface StageApi {
  init(data: StageInit): void;
  /** play a batch of battle events; resolves when they have been shown (never rejects, and gives up after a while rather than hang a fight) */
  play(events: BEvent[], speed: number): Promise<void>;
  setSpeed(n: number): void;
  hooks: SceneHooks;
  ready: Promise<void>;
  /** true when the graphics could not be (re)built and the fight is being resolved without animation */
  readonly broken: boolean;
}

/** one promise for all the status icons, built once; an icon that fails to decode is skipped rather than blocking the stage forever */
let iconPromise: Promise<Record<string, HTMLImageElement>> | null = null;
function loadStatusIcons(): Promise<Record<string, HTMLImageElement>> {
  iconPromise ??= (async () => {
    const out: Record<string, HTMLImageElement> = {};
    await Promise.allSettled(Object.values(STATUSES).map(async (s) => {
      const key = `ic:${s.glyph}:${s.kind}`;
      if (!out[key]) out[key] = await pixelIconImage(s.glyph, s.kind === 'buff' ? '#9be8b0' : '#ff9a8a');
    }));
    return out;
  })();
  return iconPromise;
}

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> => new Promise((res) => { const t = setTimeout(() => res(fallback), ms); p.then((v) => { clearTimeout(t); res(v); }, () => { clearTimeout(t); res(fallback); }); });

/** wait for `p`, but give up after `ms` of *visible* time (a hidden tab legitimately pauses the render loop, so that time does not count) */
function visibleTimeout<T>(p: Promise<T>, ms: number): Promise<{ ok: true; value: T } | { ok: false; why: 'timeout' | 'error' }> {
  return new Promise((res) => {
    let waited = 0, done = false;
    const tick = setInterval(() => { if (!document.hidden && (waited += 500) >= ms && !done) { done = true; clearInterval(tick); res({ ok: false, why: 'timeout' }); } }, 500);
    p.then((value) => { if (!done) { done = true; clearInterval(tick); res({ ok: true, value }); } }, (e) => { console.error('battle scene error', e); if (!done) { done = true; clearInterval(tick); res({ ok: false, why: 'error' }); } });
  });
}

export const BattleStage = forwardRef<StageApi, { className?: string; /** the scene as it is right now, for rebuilding after the graphics were lost */ rebuild?: () => StageInit | null; onFault?: (what: string) => void }>(function BattleStage({ className, rebuild, onFault }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const scene = useRef<BattleScene | null>(null);
  const [epoch, setEpoch] = useState(0);                                  // bumped to throw the Phaser game away and build a new one
  const gate = useMemo(() => { let resolve: () => void = () => {}; const promise = new Promise<void>((r) => { resolve = r; }); return { promise, resolve }; }, [epoch]);
  const hooks = useRef<SceneHooks>({});
  const lastInit = useRef<StageInit | null>(null);
  const broken = useRef(false);
  const rebuildRef = useRef(rebuild); rebuildRef.current = rebuild;
  const faultRef = useRef(onFault); faultRef.current = onFault;

  useEffect(() => {
    if (!host.current) return;
    void document.fonts?.load("16px 'Jersey 15'");
    let disposed = false;
    const s = new BattleScene();
    scene.current = s;
    s.hooks = hooks.current;
    let g: Phaser.Game;
    try {
      g = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        width: STAGE_W,
        height: STAGE_H,
        backgroundColor: '#050507',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        render: { antialias: false, pixelArt: true, roundPixels: true },
        audio: { noAudio: true },
        banner: false,
        disableContextMenu: true,
        scene: s,
        fps: { target: 60 },
        maxLights: 16,
      });
    } catch (e) {
      console.error('could not start the battle graphics', e);
      broken.current = true; faultRef.current?.('The battle graphics could not start.');
      return;
    }
    broken.current = false;
    game.current = g;
    (window as unknown as { __phaser?: unknown }).__phaser = { game: g, scene: s };
    g.events.once('ready', () => gate.resolve());
    // make sure the "ready" promise resolves even if the scene's create has not run yet
    const t = setInterval(() => { if (s.sys?.isActive?.() || (s as unknown as { ready: boolean }).ready) { clearInterval(t); gate.resolve(); } }, 30);

    // a lost graphics context takes every texture with it: rebuild the whole stage from the current state rather than leave a blank, frozen scene
    const restart = (why: string): void => {
      if (disposed) return;
      console.warn('battle graphics restart:', why);
      faultRef.current?.('The battle graphics were reset.');
      setEpoch((n) => n + 1);
    };
    const canvas = g.canvas as HTMLCanvasElement | undefined;
    const onLost = (ev: Event): void => { ev.preventDefault(); setTimeout(() => restart('webgl context lost'), 300); };
    canvas?.addEventListener('webglcontextlost', onLost);

    // heartbeat: a render loop that stops while the page is visible (a crashed renderer, a stalled GPU) is rebuilt
    let lastFrame = (g.loop as unknown as { frame?: number }).frame ?? 0, lastMove = performance.now(), restarts = 0;
    const beat = setInterval(() => {
      if (document.hidden) { lastMove = performance.now(); return; }
      const f = (g.loop as unknown as { frame?: number }).frame ?? 0;
      if (f !== lastFrame) { lastFrame = f; lastMove = performance.now(); return; }
      if (performance.now() - lastMove > 9000 && restarts < 3) { restarts++; lastMove = performance.now(); restart('render loop stalled'); }
    }, 3000);

    return () => {
      disposed = true;
      clearInterval(t); clearInterval(beat);
      canvas?.removeEventListener('webglcontextlost', onLost);
      // give the browser its graphics context back now: they are limited in number and only reclaimed when garbage is collected
      try { (g.renderer as unknown as { gl?: WebGLRenderingContext }).gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* already gone */ }
      try { g.destroy(true); } catch (e) { console.warn('battle graphics teardown', e); }
      game.current = null; scene.current = null;
    };
  }, [gate]);

  // after a rebuild, show the room again (the scene as it is now if the screen can say, else as it was last drawn)
  useEffect(() => {
    if (epoch === 0) return;
    const data = rebuildRef.current?.() ?? lastInit.current;
    if (data) void applyInit(data);
  }, [epoch]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyInit = async (data: StageInit): Promise<void> => {
    lastInit.current = data;
    const ready = await withTimeout(gate.promise.then(() => true), 8000, false);
    if (!ready) { broken.current = true; faultRef.current?.('The battle view did not start.'); return; }
    const icons = await withTimeout(loadStatusIcons(), 4000, {} as Record<string, HTMLImageElement>);
    try { scene.current?.init0({ ...data, icons }); broken.current = false; } catch (e) { console.error('battle scene init failed', e); broken.current = true; faultRef.current?.('The battle view failed to load.'); }
  };

  useImperativeHandle(ref, () => ({
    ready: gate.promise,
    hooks: hooks.current,
    get broken() { return broken.current; },
    init: (data) => { void applyInit(data); },
    play: async (events, speed) => {
      const sc = scene.current;
      if (!sc || broken.current) return;
      // the longest honest batch is a few seconds even at 1x; past this the scene is stuck, so stop waiting for it
      const out = await visibleTimeout(sc.play(events, speed), 15000);
      if (!out.ok && out.why === 'timeout') { broken.current = true; faultRef.current?.('The battle view stopped responding.'); }
    },
    setSpeed: (n) => { if (scene.current) scene.current.speed = n; },
  }), [gate]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className={`phaser ${className ?? ''}`} ref={host} role="img" aria-label="Battle scene" />;
});
