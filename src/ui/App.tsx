import { Suspense, lazy, useEffect, useMemo, useRef } from 'react';
import './theme.css';
import { audio, sfx } from '../audio/audio.ts';
import { claimableQuests } from '../core/meta.ts';
import { forgeUnlocked } from '../core/game.ts';
import { maxChapterReached } from '../core/party.ts';
import { HERO_IDS } from '../content/schema.ts';
import { Icon, Res, TipProvider } from './components.tsx';
import { t } from './names.ts';
import { store, useStore, type Screen } from './store.ts';
import { TitleScreen } from './screens/Title.tsx';
import { CampScreen } from './screens/Camp.tsx';
import { RosterScreen } from './screens/Roster.tsx';
import { PartyScreen } from './screens/Party.tsx';
import { ArmouryScreen } from './screens/Armoury.tsx';
import { ForgeScreen } from './screens/Forge.tsx';
import { ShrineScreen } from './screens/Shrine.tsx';
import { MapScreen } from './screens/Map.tsx';
import { JournalScreen } from './screens/Journal.tsx';
import { QuestsScreen } from './screens/Quests.tsx';
import { SettingsScreen } from './screens/Settings.tsx';
// the battle scene pulls in Phaser, so it loads on first descent rather than on the title screen
const ExpeditionScreen = lazy(() => import('./screens/Expedition.tsx').then((m) => ({ default: m.ExpeditionScreen })));
import { EndingScreen } from './screens/Ending.tsx';
import { AboutScreen } from './screens/About.tsx';
import { DebugPanel } from './screens/Debug.tsx';

const NAV: { id: Screen; label: string; icon: string }[] = [
  { id: 'camp', label: 'Camp', icon: 'camp' },
  { id: 'map', label: 'Delve', icon: 'map' },
  { id: 'roster', label: 'Heroes', icon: 'hero' },
  { id: 'party', label: 'Party', icon: 'party' },
  { id: 'armoury', label: 'Armoury', icon: 'armour' },
  { id: 'forge', label: 'Forge', icon: 'anvil' },
  { id: 'shrine', label: 'Relics', icon: 'shrine' },
  { id: 'quests', label: 'Quests', icon: 'scroll' },
  { id: 'journal', label: 'Journal', icon: 'book' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
];

export function App() {
  const st = useStore();
  const s = st.state;
  const mounted = useRef(false);

  useEffect(() => { void store.init(); }, []);

  // accessibility / display settings
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--scale', String(s.settings.textScale));
    r.dataset.contrast = s.settings.highContrast ? 'high' : 'normal';
    r.dataset.motion = s.settings.reducedMotion ? 'reduced' : 'normal';
    audio.configure(s.settings);
  }, [s.settings.textScale, s.settings.highContrast, s.settings.reducedMotion, s.settings.master, s.settings.music, s.settings.sfx, s.settings.ambience]);

  // music follows the screen
  useEffect(() => {
    const ch = Math.max(1, Math.min(10, s.age));
    if (st.screen === 'title') audio.playMusic(1, 'title');
    else if (st.screen === 'expedition') {
      const e = s.expedition;
      const floor = e?.floor ?? 1;
      const c = floor > 1000 ? 10 : Math.ceil(floor / 100);
      audio.playMusic(c, floor % 100 === 0 ? 'boss' : 'battle');
    } else audio.playMusic(ch, 'camp');
  }, [st.screen, s.age, s.expedition?.floor]);

  // first user gesture unlocks audio; every button click gets a soft tick
  useEffect(() => {
    if (mounted.current) return; mounted.current = true;
    const unlock = () => { sfx.resume(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    const click = (e: Event) => { const el = (e.target as HTMLElement).closest('button'); if (el && !el.disabled && !el.closest('.exp')) sfx.click(); };
    document.addEventListener('click', click);
    // developer panel: backtick
    const dbg = (e: KeyboardEvent) => { if (e.key === '`') { store.debug = !store.debug; store.touch(); } };
    window.addEventListener('keydown', dbg);
  }, []);

  const quests = claimableQuests(s);
  const screen = st.screen;
  const inExpedition = screen === 'expedition';
  const showNav = screen !== 'title' && screen !== 'ending' && !inExpedition;
  const heroesNew = useMemo(() => HERO_IDS.filter((h) => s.heroes[h].unlocked).length, [s.heroes]);
  void heroesNew;

  if (!st.loaded) return <div className="center" style={{ padding: '4rem' }}><h2>Loading…</h2></div>;

  return (
    <TipProvider>
      {screen === 'title' ? (
        <TitleScreen />
      ) : screen === 'ending' ? (
        <EndingScreen />
      ) : (
        <>
        <a className="skip-link" href="#main">Skip to content</a>
        <div className="app" style={inExpedition ? { gridTemplateColumns: '1fr', gridTemplateRows: 'var(--top-h) 1fr' } : undefined}>
          <header className="topbar">
            <div className="brand"><Icon k="shield" size={22} color="var(--gold)" /><span>{t('Depths of Moria')}</span></div>
            <span className="chip gold" title="Current Age">Age {s.age}</span>
            <span className="chip">Best floor {s.best}</span>
            <div className="grow" />
            <Res icon="coin" value={s.gold} label="Gold" color="var(--gold2)" />
            <Res icon="ore" value={s.ore} label="Ore" />
            <Res icon="cloth" value={s.cloth} label="Cloth" />
            <Res icon="essence" value={s.essence} label="Relic essence" color="#c8a0ff" />
            <Res icon="renown" value={s.renown} label="Renown" color="#9ec3ff" />
            {maxChapterReached(s) >= 9 && <Res icon="shard" value={s.shards} label="Legendary shards" color="#ffb340" />}
          </header>
          {showNav && (
            <nav className="nav" aria-label="Main">
              {NAV.map((n) => (
                <button key={n.id} aria-current={screen === n.id ? 'page' : undefined} onClick={() => st.go(n.id)} aria-label={n.label}
                  disabled={n.id === 'forge' && !forgeUnlocked(s) ? false : false}>
                  <Icon k={n.icon} />
                  <span>{n.label}</span>
                  {n.id === 'quests' && quests > 0 && <span className="badge gold">{quests}</span>}
                </button>
              ))}
            </nav>
          )}
          <main className={`main ${inExpedition ? 'fill' : ''}`} id="main">
            {screen === 'camp' && <CampScreen />}
            {screen === 'roster' && <RosterScreen />}
            {screen === 'party' && <PartyScreen />}
            {screen === 'armoury' && <ArmouryScreen />}
            {screen === 'forge' && <ForgeScreen />}
            {screen === 'shrine' && <ShrineScreen />}
            {screen === 'map' && <MapScreen />}
            {screen === 'journal' && <JournalScreen />}
            {screen === 'quests' && <QuestsScreen />}
            {screen === 'settings' && <SettingsScreen />}
            {screen === 'about' && <AboutScreen />}
            {screen === 'expedition' && <Suspense fallback={<div className="center" style={{ padding: '3rem' }}><h3>Descending…</h3></div>}><ExpeditionScreen /></Suspense>}
          </main>
        </div>
        </>
      )}
      <div className="toasts" aria-live="polite">
        {st.toasts.map((x) => <div key={x.id} className={`toast ${x.tone}`}>{x.icon && <Icon k={x.icon} />}<span>{x.text}</span></div>)}
      </div>
      {st.debug && <DebugPanel />}
    </TipProvider>
  );
}
