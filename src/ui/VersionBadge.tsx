import { useCallback, useEffect, useState } from 'react';

declare const __BUILD__: { version: string; sha: string; built: string };

type Status = 'checking' | 'latest' | 'update' | 'dev' | 'offline';
interface Published { version: string; sha: string; built: string }

/** drop the offline caches and the service worker so the next load comes straight from the network (saves live in IndexedDB, untouched) */
async function reloadLatest(): Promise<void> {
  try {
    for (const k of await caches.keys()) await caches.delete(k);
    for (const r of (await navigator.serviceWorker?.getRegistrations()) ?? []) await r.unregister();
  } catch { /* fall through to a plain reload */ }
  location.reload();
}

/**
 * Which build is this, and is it the newest? It reads \`version.json\` from the server (never cached: the service worker lets it through)
 * and compares its build time with the one baked into this bundle. Offline or in dev it says so instead of guessing.
 */
export function VersionBadge({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status>('checking');
  const [latest, setLatest] = useState<Published | null>(null);

  const check = useCallback(async () => {
    if (import.meta.env.DEV) { setStatus('dev'); return; }
    try {
      const res = await fetch(`${new URL('version.json', document.baseURI).href}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const v = (await res.json()) as Published;
      setLatest(v);
      setStatus(v.built === __BUILD__.built ? 'latest' : 'update');
    } catch { setStatus('offline'); }
  }, []);

  useEffect(() => {
    void check();
    const again = (): void => { if (!document.hidden) void check(); };
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  }, [check]);

  const label = `v${__BUILD__.version} · ${__BUILD__.sha}`;
  const note = status === 'latest' ? '✓ latest' : status === 'update' ? 'update available' : status === 'dev' ? 'dev build' : status === 'offline' ? "can't check" : 'checking…';
  const title = `Version ${__BUILD__.version}, build ${__BUILD__.sha}, built ${__BUILD__.built.slice(0, 16).replace('T', ' ')} UTC.` +
    (status === 'update' && latest ? ` The newest is ${latest.version} (${latest.sha}).` : '');
  const cls = status === 'latest' ? 'chip good' : status === 'update' ? 'chip gold' : 'chip';

  if (compact) {
    return (
      <span className={cls} title={title} aria-label={`Version ${__BUILD__.version}, ${note}`}>
        {label} {status === 'latest' ? '✓' : status === 'update' ? '↑' : ''}
        {status === 'update' && <button className="btn small ghost" style={{ marginLeft: '0.3rem' }} onClick={() => void reloadLatest()}>Reload</button>}
      </span>
    );
  }
  return (
    <div className="row wrap" style={{ justifyContent: 'center', gap: '0.5rem' }} title={title}>
      <span className={cls}>{label}</span>
      <span className="tiny dim" aria-live="polite">{note}</span>
      {status === 'update' && <button className="btn small primary" onClick={() => void reloadLatest()}>Reload to update</button>}
    </div>
  );
}
