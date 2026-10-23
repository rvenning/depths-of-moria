import { migrate, SaveError } from './migrations.ts';
import type { GameState } from '../core/state.ts';

const DB_NAME = 'depths-of-moria';
const STORE = 'saves';
const KEY = 'main';
const LS_KEY = 'depths-of-moria:save';

/** one connection for the life of the page (opening one per read/write leaked connections, and a blocked open could stall every save) */
let dbp: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  dbp ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const timer = setTimeout(() => reject(new Error('IndexedDB open timed out')), 6000);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => {
      clearTimeout(timer);
      const db = req.result;
      db.onversionchange = () => { db.close(); dbp = null; };           // another tab upgrading, or the browser clearing site data
      db.onclose = () => { dbp = null; };                               // the browser closed it behind our back
      resolve(db);
    };
    req.onerror = () => { clearTimeout(timer); reject(req.error); };
  });
  dbp.catch(() => { dbp = null; });                                      // a failed open is retried next time
  return dbp;
}

async function idbGet(): Promise<unknown | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(KEY);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => reject(r.error);
  });
}
async function idbPut(value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('save aborted'));
  });
}

export type SaveBackend = 'indexeddb' | 'localstorage' | 'none';
export let backend: SaveBackend = 'indexeddb';

export async function loadGame(): Promise<GameState | null> {
  let raw: unknown = null;
  try { raw = await idbGet(); backend = 'indexeddb'; } catch {
    backend = 'localstorage';
    try { const t = localStorage.getItem(LS_KEY); raw = t ? JSON.parse(t) : null; } catch { backend = 'none'; }
  }
  if (!raw) return null;
  return migrate(raw);
}

const snapshot = (state: GameState): GameState => { try { return structuredClone(state); } catch { return JSON.parse(JSON.stringify(state)) as GameState; } };

async function writeOnce(state: GameState): Promise<boolean> {
  const copy = snapshot(state);
  // indexeddb is tried every time (a transient failure must not demote the save to a lesser store for the rest of the session); one retry on a fresh connection
  for (let attempt = 0; attempt < 2; attempt++) {
    try { await idbPut(copy); backend = 'indexeddb'; return true; } catch { dbp = null; }
  }
  try { localStorage.setItem(LS_KEY, JSON.stringify(copy)); backend = 'localstorage'; return true; } catch { backend = 'none'; }
  return false;
}

let writing: Promise<boolean> | null = null, latest: GameState | null = null, again = false;
/** saves are written one at a time, and a burst collapses into one write of the newest state; resolves true when the data reached some store */
export function saveGame(state: GameState): Promise<boolean> {
  latest = state;
  if (writing) { again = true; return writing; }
  writing = (async () => {
    let ok = true;
    do { again = false; ok = await writeOnce(latest as GameState); } while (again);
    return ok;
  })().finally(() => { writing = null; });
  return writing;
}

export async function deleteSave(): Promise<void> {
  try { const db = await openDb(); await new Promise<void>((res) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(KEY); tx.oncomplete = () => res(); tx.onerror = () => res(); tx.onabort = () => res(); }); } catch { /* ignore */ }
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

// ------------------------------------------------------------------ export / import
const MAGIC = 'DOM1:';
function checksum(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}
export function exportSave(state: GameState): string {
  const json = JSON.stringify(state);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `${MAGIC}${checksum(json)}:${b64}`;
}
export function importSave(text: string): GameState {
  const t = text.trim();
  if (t.startsWith('{')) return migrate(JSON.parse(t));
  if (!t.startsWith(MAGIC)) throw new SaveError('That does not look like a Depths of Moria save.');
  const rest = t.slice(MAGIC.length);
  const i = rest.indexOf(':');
  const sum = rest.slice(0, i);
  const json = decodeURIComponent(escape(atob(rest.slice(i + 1))));
  if (checksum(json) !== sum) throw new SaveError('The save is damaged (checksum mismatch).');
  return migrate(JSON.parse(json));
}
