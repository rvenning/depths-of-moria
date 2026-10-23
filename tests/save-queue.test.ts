import { afterEach, describe, expect, it, vi } from 'vitest';
import { newGame } from '../src/core/game.ts';

/** a minimal IndexedDB: counts connections and writes, optionally slow */
function fakeIdb(opts: { delay?: number; failPuts?: number } = {}) {
  const stats = { opens: 0, puts: 0, stored: null as unknown, failLeft: opts.failPuts ?? 0 };
  const db = {
    transaction: () => {
      const tx: { oncomplete?: () => void; onerror?: () => void; onabort?: () => void; error?: unknown; objectStore: () => unknown } = {
        objectStore: () => ({
          put: (v: unknown) => { stats.puts++; setTimeout(() => { if (stats.failLeft > 0) { stats.failLeft--; tx.error = new Error('boom'); tx.onerror?.(); } else { stats.stored = v; tx.oncomplete?.(); } }, opts.delay ?? 0); },
          get: () => { const r: { onsuccess?: () => void; result?: unknown } = {}; setTimeout(() => { r.result = stats.stored; r.onsuccess?.(); }, 0); return r; },
        }),
      };
      return tx;
    },
    close: () => {},
  };
  (globalThis as unknown as { indexedDB: unknown }).indexedDB = {
    open: () => { stats.opens++; const req: { onsuccess?: () => void; result?: unknown } = { result: db }; setTimeout(() => req.onsuccess?.(), 0); return req; },
  };
  return stats;
}

afterEach(() => { delete (globalThis as { indexedDB?: unknown }).indexedDB; vi.resetModules(); });

describe('the save queue', () => {
  it('reuses one connection, collapses a burst into the newest state, and writes one at a time', async () => {
    const stats = fakeIdb({ delay: 5 });
    const { saveGame } = await import('../src/persistence/db.ts');
    const s = newGame(1);
    const all: Promise<boolean>[] = [];
    for (let i = 0; i < 6; i++) { s.gold = i; all.push(saveGame(s)); }
    expect((await Promise.all(all)).every(Boolean)).toBe(true);
    expect(stats.opens).toBe(1);
    expect(stats.puts).toBeLessThanOrEqual(2);                           // the first write, then one for everything queued behind it
    expect((stats.stored as { gold: number }).gold).toBe(5);
    await saveGame(s);
    expect(stats.opens).toBe(1);
  });

  it('retries a failed write on a fresh connection before giving up on IndexedDB', async () => {
    const stats = fakeIdb({ failPuts: 1 });
    const { saveGame, backend } = await import('../src/persistence/db.ts');
    expect(await saveGame(newGame(2))).toBe(true);
    expect(stats.puts).toBe(2);
    expect(stats.opens).toBe(2);
    expect((await import('../src/persistence/db.ts')).backend).toBe('indexeddb');
    void backend;
  });
});
