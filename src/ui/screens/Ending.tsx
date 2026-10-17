import { useEffect, useRef, useState } from 'react';
import { compositeBackground } from '../../art/backgrounds.ts';
import { HEROES } from '../../content/heroes.ts';
import { HERO_IDS } from '../../content/schema.ts';
import { HeroPortrait } from '../components.tsx';
import { t } from '../names.ts';
import { store, useGame } from '../store.ts';

const PAGES: { h: string; p: string }[] = [
  { h: 'The Bridge', p: 'The span is narrow and the dark below it has no bottom. Ahead, the thing that has waited since before the halls were hewn: fire wrapped in shadow, wings spread, patient. The company does not retreat. They have come too far down, together, to be afraid of one more step.' },
  { h: 'The Fall', p: 'The stone cracks. The flame rises, and then it falls — wreathed in its own light, into the depths it came from. For a long moment there is only the sound of the bridge settling, and breathing, and the roar of the deep fire growing faint.' },
  { h: 'The Long Way Up', p: 'Ten Ages of descent lie behind them. Ahead, the stair goes up into a morning nobody has seen in a long time. There are not many words. A hand on a shoulder. A pot set on a fire. A song, somewhere, hummed off-key.' },
  { h: 'And Yet the Deep Goes On', p: 'Far below the Bridge, past where the stone remembers, there is more. Deeper floors. Older names. The Deep Delve is open — and with it, the Ladder, the codex yet to be filled, the bonds yet to be deepened. The road goes ever on.' },
];

const CREDITS: [string, string[]][] = [
  ['Design & Code', ['Claude Code', 'from a complete design handoff']],
  ['Engine', ['Deterministic seeded battle simulation', 'Initiative gauge · rows · statuses · boss phases']],
  ['Art', ['Procedural painters: heroes, 80 creatures, ten chapters of rooms', 'All art generated in code']],
  ['Music & Sound', ['Generative score per chapter', 'Synthesised effects and ambience']],
  ['Text', ['Lore, events, quests and bond scenes — original writing']],
  ['Built with', ['Phaser 4 · React · TypeScript · Vite']],
  ['Rights', ['A private fan-game concept', 'Not for distribution without permission', 'A clean original reskin is built in']],
  ['Thank you', ['for playing']],
];

export function EndingScreen() {
  const s = useGame();
  const [page, setPage] = useState(0);
  const [credits, setCredits] = useState(false);
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; c.width = 960; c.height = 480;
    c.getContext('2d')?.drawImage(compositeBackground(10, page === 0 ? 'bridge' : page === 1 ? 'arena' : 'hall', 960, 480), 0, 0);
  }, [page]);
  const finish = () => {
    store.mutate((g) => { g.flags.endingPending = false; g.flags.endingSeen = true; g.counters.endings = 1; }, 'now');
    store.go('camp');
    store.toast('The Deep Delve and Challenge Ladder are now open', 'good', 'map');
  };
  const rm = s.settings.reducedMotion;
  return (
    <div className="title" style={{ position: 'fixed' }}>
      <canvas className="bg" ref={ref} aria-hidden="true" style={{ opacity: 0.55 }} />
      <div className="veil" />
      {!credits ? (
        <div className="box" style={{ maxWidth: '44rem' }}>
          <div className="sub">The Ending</div>
          <h1 style={{ fontSize: 'clamp(1.8rem,5vw,3rem)' }}>{t(PAGES[page].h)}</h1>
          <p style={{ fontSize: '1.25rem', lineHeight: 1.6 }}>{t(PAGES[page].p)}</p>
          {page === 2 && <div className="row wrap" style={{ justifyContent: 'center' }}>{HERO_IDS.filter((h) => s.heroes[h].unlocked).map((h) => <div key={h} className="col" style={{ alignItems: 'center', gap: 2 }}><HeroPortrait id={h} size="md" /><span className="tiny dim">{t(HEROES[h].quotes.win)}</span></div>)}</div>}
          <div className="row">
            {page < PAGES.length - 1 ? <button className="btn primary big" onClick={() => setPage(page + 1)} autoFocus>Continue</button> : <button className="btn primary big" onClick={() => setCredits(true)} autoFocus>Credits</button>}
            <button className="btn ghost" onClick={() => setCredits(true)}>Skip</button>
          </div>
        </div>
      ) : (
        <div className="box" style={{ maxHeight: '100%', overflow: 'hidden' }}>
          <div style={{ height: '70vh', overflow: 'hidden', position: 'relative', width: '30rem', maxWidth: '90vw' }}>
            <div style={{ animation: rm ? undefined : 'credits 36s linear forwards', paddingTop: rm ? 0 : '60vh', textAlign: 'center' }}>
              <h1>Depths of Moria</h1>
              {CREDITS.map(([h, l]) => <div key={h} style={{ margin: '1.6rem 0' }}><h3>{h}</h3>{l.map((x) => <div key={x} className="dim">{t(x)}</div>)}</div>)}
            </div>
          </div>
          <button className="btn primary big" onClick={finish} autoFocus>Return to camp</button>
        </div>
      )}
    </div>
  );
}
