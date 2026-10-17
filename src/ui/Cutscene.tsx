import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { animateCast } from '../art/castScene.ts';
import { HEROES } from '../content/heroes.ts';
import type { HeroId } from '../content/schema.ts';
import { sfx } from '../audio/audio.ts';
import { speak, stopSpeaking } from '../audio/voice.ts';
import { t } from './names.ts';
import { store } from './store.ts';

export interface CutLine { who: HeroId | 'narr'; text: string; head?: string }

/**
 * A conversation staged like a JRPG scene: the cast stands on a backdrop, the speaker steps into the light, and the
 * words are typed into a framed box. Click, Enter or Space completes the line, then moves on; Escape or Skip leaves.
 */
export function Cutscene({ title, chapter, cast, lines, onClose, doneLabel = 'Close' }: { title?: string; chapter: number; cast: HeroId[]; lines: CutLine[]; onClose: () => void; doneLabel?: string }) {
  const reduced = store.state.settings.reducedMotion;
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0);
  const cv = useRef<HTMLCanvasElement>(null);
  const line = lines[i];
  const full = useMemo(() => (line.who === 'narr' ? t(line.text) : `“${t(line.text)}”`), [line]);
  const activeRef = useRef<HeroId | null>(null);
  activeRef.current = line.who === 'narr' ? null : line.who;

  useEffect(() => { const c = cv.current; if (!c) return; return animateCast(c, Math.min(10, Math.max(1, chapter)), cast, () => activeRef.current, reduced); }, [chapter, cast, reduced]);
  useEffect(() => {
    setShown(reduced ? full.length : 0);
    if (reduced) return;
    const id = window.setInterval(() => setShown((n) => { if (n >= full.length) { window.clearInterval(id); return n; } if (n % 3 === 0) sfx.tick(); return n + 1; }), 24);
    return () => window.clearInterval(id);
  }, [full, reduced]);

  useEffect(() => { if (store.state.settings.voice) speak(line.who, full); return () => stopSpeaking(); }, [line, full]);
  const done = shown >= full.length;
  const advance = useCallback(() => {
    if (!done) { setShown(full.length); return; }
    if (i < lines.length - 1) setI(i + 1); else onClose();
  }, [done, full, i, lines.length, onClose]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); advance(); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [advance, onClose]);

  const speaker = line.who === 'narr' ? null : t(HEROES[line.who].name);
  return createPortal(
    <div className="cutscene" role="dialog" aria-modal="true" aria-label={title ?? 'Scene'} onClick={advance}>
      <canvas ref={cv} className="cs-stage" aria-hidden="true" />
      <div className="cs-bar top" /><div className="cs-bar bottom" />
      {title && <div className="cs-title">{title}</div>}
      <div className="cs-box" onClick={(e) => { e.stopPropagation(); advance(); }}>
        {line.head && <div className="cs-head">{line.head}</div>}
        {speaker && <div className="cs-name">{speaker}</div>}
        <p className={line.who === 'narr' ? 'cs-text narr' : 'cs-text'} aria-live="polite">{full.slice(0, shown)}<span className="cs-caret" aria-hidden="true">{done ? '▼' : ''}</span></p>
        <div className="cs-foot">
          <span className="dim small">{i + 1} / {lines.length}</span>
          <div className="row">
            <button className="btn small ghost" onClick={(e) => { e.stopPropagation(); onClose(); }}>Skip</button>
            <button className="btn small primary" onClick={(e) => { e.stopPropagation(); advance(); }} autoFocus>{done && i === lines.length - 1 ? doneLabel : 'Next'}</button>
          </div>
        </div>
      </div>
    </div>, document.body);
}
