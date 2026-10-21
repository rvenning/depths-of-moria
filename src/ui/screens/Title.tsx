import { useEffect, useRef, useState } from 'react';
import { animateTitle } from '../../art/titleScene.ts';
import { importSave } from '../../persistence/db.ts';
import { Icon, Modal } from '../components.tsx';
import { t, setNaming } from '../names.ts';
import { store, useStore } from '../store.ts';
import { sfx } from '../../audio/audio.ts';
import { VersionBadge } from '../VersionBadge.tsx';

export function TitleScreen() {
  const st = useStore();
  const ref = useRef<HTMLCanvasElement>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [importing, setImporting] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    const c = ref.current; if (!c) return;
    return animateTitle(c, st.hasSave ? Math.min(10, Math.max(1, st.state.age)) : 1, st.state.settings.reducedMotion);
  }, [st.hasSave, st.state.age, st.state.settings.reducedMotion]);

  const start = () => { sfx.resume(); sfx.confirm(); store.startNew(); store.mutate((s) => { s.flags.prologue = 0; }, 'now'); };

  return (
    <div className="title">
      <canvas className="bg" ref={ref} aria-hidden="true" />
      <div className="veil" />
      <div className="box">
        <div className="sub">{t('The Fellowship')}</div>
        <h1>{t('Depths of Moria')}</h1>
        <p className="dim" style={{ maxWidth: '36rem' }}>A long descent in ten Ages. Lead your company through a thousand floors of a labyrinth older than memory.</p>
        <div className="col" style={{ minWidth: '16rem', alignItems: 'stretch' }}>
          {st.hasSave && <button className="btn primary big" onClick={() => { sfx.resume(); sfx.confirm(); store.go('camp'); }} autoFocus><Icon k="play" /> Continue — Age {st.state.age}, floor {st.state.best}</button>}
          <button className={`btn big ${st.hasSave ? '' : 'primary'}`} onClick={() => (st.hasSave ? setConfirmNew(true) : start())} autoFocus={!st.hasSave}><Icon k="sword" /> New game</button>
          <button className="btn" onClick={() => setImporting(true)}><Icon k="scroll" /> Import a save</button>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn ghost small" onClick={() => st.go('about')}><Icon k="info" /> Credits &amp; rights</button>
            <button className="btn ghost small" onClick={() => { const n = st.state.settings.naming === 'fan' ? 'original' : 'fan'; store.mutate((s) => { s.settings.naming = n; }); setNaming(n); }} aria-pressed={st.state.settings.naming === 'original'}>
              Names: {st.state.settings.naming === 'fan' ? 'Fan concept' : 'Original reskin'}
            </button>
          </div>
        </div>
        <div className="tiny faint" style={{ maxWidth: '34rem' }}>A private fan-game concept. Not affiliated with or endorsed by any rights-holder. Not for distribution — see Credits &amp; rights.</div>
        <VersionBadge />
      </div>
      {confirmNew && (
        <Modal label="Start a new game" onClose={() => setConfirmNew(false)}>
          <h3>Begin anew?</h3>
          <p>You have a game in progress (Age {st.state.age}, best floor {st.state.best}). Starting a new game replaces it. Consider exporting it from Settings first.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setConfirmNew(false)}>Cancel</button>
            <button className="btn danger" onClick={() => { setConfirmNew(false); start(); }}>Replace my game</button>
          </div>
        </Modal>
      )}
      {importing && (
        <Modal label="Import a save" onClose={() => setImporting(false)}>
          <h3>Import a save</h3>
          <p className="dim small">Paste an exported save, or choose a file.</p>
          <textarea value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} aria-label="Save data" />
          <input type="file" accept=".txt,.json,.dom" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
          {err && <p className="bad">{err}</p>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setImporting(false)}>Cancel</button>
            <button className="btn primary" onClick={() => { try { store.replaceState(importSave(text)); setImporting(false); } catch (e) { setErr((e as Error).message); } }}>Import</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
