import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ICONS, ICON_PX, iconKey, pixelIconUrl } from '../art/icons.ts';
import { paintHero } from '../art/heroes.ts';
import { paintCreature } from '../art/creatures.ts';
import { ENEMIES } from '../content/enemies.ts';
import { ITEMS, AFFIXES, RARITY_NAME, SETS } from '../content/items.ts';
import { STAT_LABEL, STAT_HINT, RARITY_COLOR } from '../content/schema.ts';
import type { HeroId, ItemInstance, StatKey } from '../content/schema.ts';
import { STATUSES } from '../content/statuses.ts';
import type { StatusId } from '../content/schema.ts';
import { itemName } from '../core/loot.ts';
import { itemStatLines } from '../core/stats.ts';
import { t } from './names.ts';
import { store } from './store.ts';

// ------------------------------------------------------------------ icon
export function Icon({ k, size, color, className, title }: { k: string; size?: number | string; color?: string; className?: string; title?: string }) {
  const key = iconKey(k);
  const url = pixelIconUrl(key);
  if (url) {
    // pixel icons only look right at whole multiples of their native size
    const px = typeof size === 'number' ? ICON_PX * Math.max(1, Math.round(size / ICON_PX)) : undefined;
    const style = { '--m': `url(${url})`, ...(px ? { width: px, height: px } : null), ...(color ? { backgroundColor: color } : null) } as CSSProperties;
    return <i className={`icon pix ${className ?? ''}`} style={style} role={title ? 'img' : 'presentation'} aria-label={title} aria-hidden={title ? undefined : true} />;
  }
  return (
    <svg className={`icon ${className ?? ''}`} viewBox="0 0 24 24" width={size ?? '1.1em'} height={size ?? '1.1em'} fill="none"
      stroke={color ?? 'currentColor'} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" role={title ? 'img' : 'presentation'}
      aria-label={title} aria-hidden={title ? undefined : true} dangerouslySetInnerHTML={{ __html: ICONS[key] }} />
  );
}

export function Res({ icon, value, label, color }: { icon: string; value: number | string; label: string; color?: string }) {
  return (
    <Tip content={<h4>{label}</h4>}>
      <span className="res num" aria-label={`${label}: ${value}`}><Icon k={icon} color={color} /> {typeof value === 'number' ? fmt(value) : value}</span>
    </Tip>
  );
}

export function fmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return Math.round(n).toLocaleString('en-US');
}
export const pct = (n: number, d = 0): string => `${n.toFixed(d)}%`;
export function statText(k: StatKey, v: number): string {
  if (k === 'crit' || k === 'critDmg' || k === 'acc' || k === 'eva' || k === 'spd') return `${Math.round(v)}${k === 'crit' || k === 'critDmg' ? '%' : ''}`;
  return fmt(v);
}

// ------------------------------------------------------------------ tooltips
interface TipState { x: number; y: number; content: ReactNode }
const TipCtx = createContext<(s: TipState | null) => void>(() => {});

export function TipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<TipState | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!tip || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    let left = tip.x + 14, top = tip.y + 16;
    if (left + r.width > window.innerWidth - 8) left = Math.max(8, tip.x - r.width - 14);
    if (top + r.height > window.innerHeight - 8) top = Math.max(8, tip.y - r.height - 10);
    setPos({ left, top });
  }, [tip]);
  return (
    <TipCtx.Provider value={setTip}>
      {children}
      {tip && createPortal(<div className="tip" role="tooltip" ref={ref} style={{ left: pos.left, top: pos.top }}>{tip.content}</div>, document.body)}
    </TipCtx.Provider>
  );
}

export function Tip({ content, children }: { content: ReactNode; children: ReactNode }) {
  const set = useContext(TipCtx);
  const show = useCallback((x: number, y: number) => set({ x, y, content }), [set, content]);
  return (
    <span
      style={{ display: 'contents' }}
      onMouseMove={(e) => show(e.clientX, e.clientY)}
      onMouseLeave={() => set(null)}
      onFocus={(e) => { const r = (e.target as HTMLElement).getBoundingClientRect(); show(r.left, r.bottom); }}
      onBlur={() => set(null)}
      onTouchStart={(e) => { const tch = e.touches[0]; show(tch.clientX, tch.clientY); setTimeout(() => set(null), 2600); }}
    >
      {children}
    </span>
  );
}

// ------------------------------------------------------------------ modal
export function Modal({ children, onClose, wide, label }: { children: ReactNode; onClose?: () => void; wide?: boolean; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    first?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
        if (!f.length) return;
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('keydown', key, true); prev?.focus?.(); };
  }, [onClose]);
  return createPortal(
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className={`panel modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={label} ref={ref}>{children}</div>
    </div>, document.body);
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; badge?: number }[]; value: T; onChange: (t: T) => void; label?: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((x) => (
        <button key={x.id} role="tab" aria-selected={value === x.id} onClick={() => onChange(x.id)}>
          {x.label}{x.badge ? <> <span className="badge">{x.badge}</span></> : null}
        </button>
      ))}
    </div>
  );
}

export function Bar({ value, max, kind, label, tall }: { value: number; max: number; kind?: 'xp' | 'gold' | 'bad'; label?: string; tall?: boolean }) {
  const p = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <div className={`bar ${kind ?? ''} ${tall ? 'tall' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={Math.round(max)} aria-valuenow={Math.round(value)} aria-label={label}>
      <i style={{ width: `${p * 100}%` }} />
      {tall && <span className="num">{fmt(value)} / {fmt(max)}</span>}
    </div>
  );
}

// ------------------------------------------------------------------ portraits
/** the head of each sprite, as a 40x40 window into the native pixel art (shown at 4x, so it stays crisp) */
const CROPS: Record<HeroId, [number, number]> = {
  aragorn: [12, 4], gimli: [13, 26], frodo: [12, 32], legolas: [13, 5],
  boromir: [12, 4], sam: [12, 32], gandalf: [14, 0],
};

export function HeroPortrait({ id, size = 'md', className, ko }: { id: HeroId; size?: 'sm' | 'md' | 'lg'; className?: string; ko?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    c.width = 160; c.height = 160;
    const x = c.getContext('2d'); if (!x) return;
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, 160, 160);
    const [sx, sy] = CROPS[id];
    x.drawImage(paintHero(id), sx, sy, 40, 40, 0, 0, 160, 160);
  }, [id]);
  return <div className={`portrait ${size} ${className ?? ''}`} style={ko ? { filter: 'grayscale(1)', opacity: 0.6 } : undefined}><canvas ref={ref} aria-hidden="true" /></div>;
}

export function EnemyPortrait({ id, size = 'md' }: { id: string; size?: 'sm' | 'md' | 'lg' }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    c.width = 160; c.height = 160;
    const x = c.getContext('2d'); if (!x) return;
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, 160, 160);
    const def = ENEMIES[id]; if (!def) return;
    // whole-number zoom, centred, so every pixel is square
    const cv = paintCreature(def), k = Math.max(1, Math.floor(160 / cv.width));
    x.drawImage(cv, 0, 0, cv.width, cv.height, Math.round((160 - cv.width * k) / 2), 160 - cv.height * k, cv.width * k, cv.height * k);
  }, [id]);
  return <div className={`portrait ${size}`}><canvas ref={ref} aria-hidden="true" /></div>;
}

// ------------------------------------------------------------------ status glyphs
export function StatusIcon({ id, turns }: { id: StatusId; turns?: number }) {
  const s = STATUSES[id];
  return (
    <Tip content={<><h4>{s.name}</h4><div className="line">{s.desc}{turns ? ` (${turns} turn${turns === 1 ? '' : 's'})` : ''}</div></>}>
      <span tabIndex={0} aria-label={`${s.name}${turns ? `, ${turns} turns` : ''}`} style={{ color: s.kind === 'buff' ? 'var(--good)' : 'var(--bad)' }}><Icon k={s.glyph} /></span>
    </Tip>
  );
}

// ------------------------------------------------------------------ items
export function itemColor(i: ItemInstance): string { return RARITY_COLOR[i.rarity]; }

export function ItemCell({ item, selected, onClick, equippedBy, locked, badge, onContext }: { item: ItemInstance; selected?: boolean; onClick?: () => void; equippedBy?: string | null; locked?: boolean; badge?: string; onContext?: () => void }) {
  const tpl = ITEMS[item.tpl];
  return (
    <Tip content={<ItemTip item={item} />}>
      <button className={`itemcell border-${item.rarity} ${selected ? 'sel' : ''}`} onClick={onClick} onContextMenu={(e) => { if (onContext) { e.preventDefault(); onContext(); } }}
        aria-label={`${itemName(item)}, ${RARITY_NAME[item.rarity]}${equippedBy ? ', equipped' : ''}`} style={{ color: RARITY_COLOR[item.rarity] }}>
        <Icon k={tpl?.icon ?? 'star'} />
        {item.plus > 0 && <span className="pl">+{item.plus}</span>}
        {equippedBy && <span className="eq">{badge ?? 'E'}</span>}
        {item.isNew && <span className="nw" />}
        {(locked ?? item.locked) && <Icon k="lock" className="lk" />}
      </button>
    </Tip>
  );
}

export function ItemTip({ item, compare }: { item: ItemInstance; compare?: ItemInstance | null }) {
  const tpl = ITEMS[item.tpl];
  if (!tpl) return null;
  const lines = itemStatLines(item);
  const cmp = compare ? Object.fromEntries(itemStatLines(compare).map((l) => [l.stat, l.value])) : null;
  const set = tpl.set ? SETS[tpl.set] : null;
  return (
    <div>
      <h4 style={{ color: RARITY_COLOR[item.rarity] }}>{itemName(item)}</h4>
      <div className="small dim">{RARITY_NAME[item.rarity]} {tpl.weapon ?? tpl.slot} · item level {item.ilvl}</div>
      <div style={{ margin: '0.35rem 0' }}>
        {lines.map((l) => {
          const d = cmp ? l.value - (cmp[l.stat] ?? 0) : 0;
          return (
            <div className="statline" key={l.stat}>
              <span>{STAT_LABEL[l.stat]}</span>
              <b className="num">+{statText(l.stat, l.value)}{cmp && Math.abs(d) >= 1 ? <span className={`delta ${d > 0 ? 'up' : 'down'}`}> ({d > 0 ? '+' : ''}{statText(l.stat, d)})</span> : null}</b>
            </div>
          );
        })}
        {item.affix && <div className="statline"><span>{AFFIXES[item.affix].name}</span><b>{AFFIXES[item.affix].desc}</b></div>}
      </div>
      {tpl.signature && <div className="gold small"><b>{tpl.signature.name}:</b> {t(tpl.signature.desc)}</div>}
      {set && <div className="small" style={{ marginTop: 4 }}><b className="gold">{set.name} set</b>{set.bonuses.map((b) => <div key={b.count} className="dim">({b.count}) {b.desc}</div>)}</div>}
      <div className="small faint" style={{ marginTop: 4, fontStyle: 'italic' }}>{t(tpl.flavor)}</div>
    </div>
  );
}

export function StatTable({ stats, compare }: { stats: Record<StatKey, number>; compare?: Record<StatKey, number> | null }) {
  const keys: StatKey[] = ['hp', 'atk', 'def', 'mag', 'res', 'spd', 'crit', 'critDmg', 'acc', 'eva'];
  return (
    <div>
      {keys.map((k) => {
        const d = compare ? stats[k] - compare[k] : 0;
        return (
          <Tip key={k} content={<><h4>{STAT_LABEL[k]}</h4><div className="line">{STAT_HINT[k]}</div></>}>
            <div className="statline" tabIndex={0} aria-label={`${STAT_LABEL[k]} ${Math.round(stats[k])}`}>
              <span>{STAT_LABEL[k]}</span>
              <b className="num">{statText(k, stats[k])}{compare && Math.abs(d) >= 0.5 ? <span className={`delta ${d > 0 ? 'up' : 'down'}`}> ({d > 0 ? '+' : ''}{statText(k, d)})</span> : null}</b>
            </div>
          </Tip>
        );
      })}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) { return <div className="inset dim center" style={{ padding: '1.2rem' }}>{children}</div>; }

export function Section({ title, right, children, style }: { title: ReactNode; right?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <section className="panel" style={style}>
      <div className="ph"><h3>{title}</h3>{right}</div>
      {children}
    </section>
  );
}

export function useHotkeys(map: Record<string, () => void>, deps: unknown[] = []): void {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches?.('input, textarea, select')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const fn = map[e.key.toLowerCase()];
      if (fn) { e.preventDefault(); fn(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** records that a screen was opened (drives the First Steps checklist) */
export function useVisit(flag: string): void {
  useEffect(() => {
    if (!store.state.flags[flag]) store.mutate((s) => { s.flags[flag] = 1; }, 'soon');
  }, [flag]);
}
