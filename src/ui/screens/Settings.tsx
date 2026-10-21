import { useState } from 'react';
import { audio, sfx } from '../../audio/audio.ts';
import { backend, exportSave, importSave } from '../../persistence/db.ts';
import { Icon, Modal, Section } from '../components.tsx';
import { setNaming, t } from '../names.ts';
import { store, useGame } from '../store.ts';
import { VersionBadge } from '../VersionBadge.tsx';


function Slider({ label, value, onChange, min = 0, max = 1, step = 0.05, fmt = (v: number) => `${Math.round(v * 100)}%` }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; fmt?: (v: number) => string }) {
  return (
    <label className="row" style={{ gap: 10 }}>
      <span style={{ width: '9rem' }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      <span className="num dim" style={{ width: '3.4rem', textAlign: 'right' }}>{fmt(value)}</span>
    </label>
  );
}

export function SettingsScreen() {
  const s = useGame();
  const st = s.settings;
  const set = (patch: Partial<typeof st>) => store.mutate((g) => { Object.assign(g.settings, patch); });
  const [importOpen, setImportOpen] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [wipe, setWipe] = useState(false);
  const [exported, setExported] = useState('');
  const [muted, setMuted] = useState(false);

  return (
    <div className="two">
      <div className="col">
        <Section title="Sound">
          <div className="col">
            <Slider label="Master" value={st.master} onChange={(v) => set({ master: v })} />
            <Slider label="Music" value={st.music} onChange={(v) => set({ music: v })} />
            <Slider label="Sound effects" value={st.sfx} onChange={(v) => { set({ master: st.master, sfx: v }); sfx.resume(); sfx.hit(); }} />
            <Slider label="Ambience" value={st.ambience} onChange={(v) => set({ ambience: v })} />
            <button className="btn small" aria-pressed={muted} onClick={() => { setMuted(!muted); audio.setMuted(!muted); }}><Icon k={muted ? 'mute' : 'sound'} /> {muted ? 'Unmute' : 'Mute all'}</button>
            <label className="check"><input type="checkbox" checked={st.sampledMusic !== false} onChange={(e) => set({ sampledMusic: e.target.checked })} /> Orchestral score (sampled; off = the lightweight built-in synth)</label>
            <p className="tiny dim">The score is original; it is rendered through a free orchestral soundfont. Effects and ambience are synthesised on your device.</p>
          </div>
        </Section>
        <Section title="Battle">
          <div className="col">
            <div className="row">Default speed {([1, 2, 4] as const).map((n) => <button key={n} className={`btn small ${st.speed === n ? 'primary' : ''}`} onClick={() => set({ speed: n })}>{n}×</button>)}</div>
            <div className="row wrap">Graphics {([['auto', 'Auto'], ['hd', 'HD-2D lighting'], ['low', 'Plain pixels']] as const).map(([k, label]) => <button key={k} className={`btn small ${st.graphics === k ? 'primary' : ''}`} onClick={() => { try { localStorage.removeItem('dom.fxLow'); } catch { /* private mode */ } set({ graphics: k }); }}>{label}</button>)}</div>
            <p className="tiny dim">HD-2D adds real-time torch light on the sprites, bloom and a soft depth of field. Auto switches to plain pixels if the battle runs slowly.</p>
            <label className="check"><input type="checkbox" checked={st.voice} onChange={(e) => set({ voice: e.target.checked })} /> Spoken dialogue in cutscenes (uses your device's voices)</label>
            <label className="check"><input type="checkbox" checked={st.showLog} onChange={(e) => set({ showLog: e.target.checked })} /> Show the battle log</label>
            <label className="check"><input type="checkbox" checked={st.autoDelve} onChange={(e) => set({ autoDelve: e.target.checked })} /> Auto-delve: continue to the next floor automatically</label>
          </div>
        </Section>
        <Section title="Accessibility">
          <div className="col">
            <label className="check"><input type="checkbox" checked={st.reducedMotion} onChange={(e) => set({ reducedMotion: e.target.checked })} /> Reduced motion (no screen shake, flashes, drifting or particles)</label>
            <label className="check"><input type="checkbox" checked={st.highContrast} onChange={(e) => set({ highContrast: e.target.checked })} /> High contrast</label>
            <Slider label="Text size" value={st.textScale} min={0.85} max={1.4} step={0.05} onChange={(v) => set({ textScale: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            <p className="tiny dim">Keyboard: Tab / Shift+Tab to move, Enter or Space to press. In battle: Space pause · 1/2/3 speed · S skip · A auto-delve · L log. Screen readers hear the battle log as it happens.</p>
          </div>
        </Section>
      </div>
      <div className="col">
        <Section title="Names">
          <p className="small dim">The game ships with fan-concept names. The Original reskin replaces every restricted name in the interface without touching your save.</p>
          <div className="row">
            {(['fan', 'original'] as const).map((n) => <button key={n} className={`btn ${st.naming === n ? 'primary' : ''}`} onClick={() => { set({ naming: n }); setNaming(n); }}>{n === 'fan' ? 'Fan concept' : 'Original reskin'}</button>)}
          </div>
          <p className="tiny faint" style={{ marginTop: 6 }}>Preview: {t('Aragorn, Gimli and Frodo descend into Moria.')}</p>
        </Section>
        <Section title="Save data">
          <div className="col">
            <div className="small dim">Stored in {backend === 'indexeddb' ? 'IndexedDB' : backend === 'localstorage' ? 'localStorage (fallback)' : 'memory only — your browser blocks storage; export regularly'}. Autosaves after every floor and camp action.</div>
            <div className="row wrap">
              <button className="btn" onClick={() => { void store.saveNow(); store.toast('Saved', 'good', 'check'); }}><Icon k="check" /> Save now</button>
              <button className="btn" onClick={() => { const e = exportSave(store.state); setExported(e); void navigator.clipboard?.writeText(e).catch(() => {}); }}><Icon k="scroll" /> Export</button>
              <button className="btn" onClick={() => setImportOpen(true)}>Import</button>
              <button className="btn danger" onClick={() => setWipe(true)}>Delete save</button>
            </div>
            {exported && (<><textarea readOnly value={exported} aria-label="Exported save" onFocus={(e) => e.target.select()} />
              <div className="row"><span className="tiny dim">Copied to the clipboard if allowed. </span><button className="btn small" onClick={() => { const b = new Blob([exported], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `depths-of-moria-age${s.age}-floor${s.best}.txt`; a.click(); }}>Download file</button></div></>)}
          </div>
        </Section>
        <Section title="About">
          <div className="small dim">Save v{s.v}</div>
          <VersionBadge />
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn small" onClick={() => store.go('about')}><Icon k="info" /> Credits &amp; rights</button>
            <button className="btn small" onClick={() => store.go('title')}>Title screen</button>
            <button className="btn small ghost" onClick={() => { store.debug = !store.debug; store.touch(); }}>Developer panel (`)</button>
          </div>
        </Section>
      </div>
      {importOpen && (
        <Modal label="Import a save" onClose={() => setImportOpen(false)}>
          <h3>Import a save</h3>
          <p className="small dim">This replaces your current game.</p>
          <textarea value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} aria-label="Save data" />
          <input type="file" accept=".txt,.json" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
          {err && <p className="bad">{err}</p>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setImportOpen(false)}>Cancel</button>
            <button className="btn primary" onClick={() => { try { store.replaceState(importSave(text)); setImportOpen(false); } catch (e) { setErr((e as Error).message); } }}>Import</button>
          </div>
        </Modal>
      )}
      {wipe && (
        <Modal label="Delete save" onClose={() => setWipe(false)}>
          <h3>Delete everything?</h3>
          <p>This permanently deletes your save: heroes, relics, lore, everything. Export it first if you may want it back.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setWipe(false)}>Keep my game</button>
            <button className="btn danger" onClick={() => { setWipe(false); void store.wipe(); }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
