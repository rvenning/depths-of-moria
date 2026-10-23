import { useSyncExternalStore } from 'react';
import { newGame } from '../core/game.ts';
import type { GameState } from '../core/state.ts';
import { loadGame, saveGame, deleteSave } from '../persistence/db.ts';
import { checkAchievements } from '../core/meta.ts';
import { ACH_BY_ID } from '../content/meta.ts';
import { setNaming } from './names.ts';

export type Screen =
  | 'title' | 'camp' | 'roster' | 'party' | 'armoury' | 'forge' | 'shrine' | 'map' | 'journal' | 'quests' | 'settings'
  | 'expedition' | 'ending' | 'about';

export interface Toast { id: number; text: string; tone: 'info' | 'good' | 'warn'; icon?: string }

class Store {
  state: GameState = newGame();
  loaded = false;
  hasSave = false;
  started = false;
  version = 0;
  screen: Screen = 'title';
  screenArg: string | null = null;
  toasts: Toast[] = [];
  debug = false;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private toastId = 1;
  private lastTick = Date.now();

  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getVersion = (): number => this.version;
  private emit(): void { this.version++; for (const l of this.listeners) l(); }

  async init(): Promise<void> {
    try {
      const s = await loadGame();
      if (s) { this.state = s; this.hasSave = true; this.started = true; }
    } catch (e) {
      console.warn('Could not load save', e);
    }
    this.loaded = true;
    setNaming(this.state.settings.naming);
    // play time accrues while the page is visible, not only when something is clicked
    setInterval(() => { if (this.started && document.visibilityState === 'visible') this.state.playMs += 5000; }, 5000);
    this.emit();
  }

  /** mutate the game state in place and notify. Autosave is debounced; pass 'now' after a floor. */
  mutate<T>(fn: (s: GameState) => T, save: 'now' | 'soon' | 'none' = 'soon'): T {
    const r = fn(this.state);
    const now = Date.now();
    this.state.playMs += Math.min(60000, now - this.lastTick);
    this.lastTick = now;
    setNaming(this.state.settings.naming);
    const newAch = checkAchievements(this.state);
    for (const a of newAch) this.toast(`Achievement: ${ACH_BY_ID[a]?.title ?? a} (+${ACH_BY_ID[a]?.renown ?? 0} renown)`, 'good', 'star');
    if (save === 'now') void this.saveNow(); else if (save === 'soon') this.scheduleSave();
    this.emit();
    return r;
  }

  touch(): void { this.emit(); }

  private lastSaveWarn = 0;
  scheduleSave(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.saveNow(); }, 1200);
  }
  async saveNow(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (!this.started) return;
    const ok = await saveGame(this.state);
    this.hasSave = ok || this.hasSave;
    if (!ok && Date.now() - this.lastSaveWarn > 60000) { this.lastSaveWarn = Date.now(); this.toast('Your progress could not be saved: the browser is blocking storage. Export a save from Settings.', 'warn'); }
  }

  go(screen: Screen, arg: string | null = null): void {
    this.screen = screen; this.screenArg = arg;
    this.emit();
  }

  startNew(seed?: number): void {
    this.state = newGame(seed);
    setNaming(this.state.settings.naming);
    this.hasSave = false;
    this.started = true;
    void this.saveNow();
    this.go('camp');
  }
  replaceState(s: GameState): void {
    this.state = s;
    this.started = true;
    setNaming(s.settings.naming);
    void this.saveNow();
    this.go('camp');
  }
  async wipe(): Promise<void> {
    await deleteSave();
    this.state = newGame();
    this.hasSave = false;
    this.started = false;
    this.go('title');
  }

  toast(text: string, tone: Toast['tone'] = 'info', icon?: string): void {
    const t: Toast = { id: this.toastId++, text, tone, icon };
    this.toasts = [...this.toasts, t].slice(-4);
    this.emit();
    setTimeout(() => { this.toasts = this.toasts.filter((x) => x.id !== t.id); this.emit(); }, 4200);
  }
}

export const store = new Store();

/** subscribe a component to the store; returns the live (mutable) game state */
export function useGame(): GameState {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store.state;
}
export function useStore(): Store {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}

if (typeof window !== 'undefined') {
  (window as unknown as { __dom: unknown }).__dom = store; // debugging and e2e hooks
  window.addEventListener('beforeunload', () => { void store.saveNow(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void store.saveNow(); });
}
