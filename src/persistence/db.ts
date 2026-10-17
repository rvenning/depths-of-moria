import { migrate, SaveError } from './migrations.ts';
import type { GameState } from '../core/state.ts';

const DB_NAME = 'depths-of-moria';
const STORE = 'saves';
const KEY = 'main';
const LS_KEY = 'depths-of-moria:save';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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

export async function saveGame(state: GameState): Promise<void> {
  const copy = JSON.parse(JSON.stringify(state)) as GameState;
  if (backend === 'indexeddb') {
    try { await idbPut(copy); return; } catch { backend = 'localstorage'; }
  }
  if (backend === 'localstorage') {
    try { localStorage.setItem(LS_KEY, JSON.stringify(copy)); return; } catch { backend = 'none'; }
  }
}

export async function deleteSave(): Promise<void> {
  try { const db = await openDb(); await new Promise<void>((res) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(KEY); tx.oncomplete = () => res(); tx.onerror = () => res(); }); } catch { /* ignore */ }
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
