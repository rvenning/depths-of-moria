import { useEffect, useMemo, useRef, useState } from 'react';
import { BAND_H, MAP_H, MAP_W, NODES, SKY_H, drawBanner, paintDescent } from '../../art/descentMap.ts';
import { CHAPTERS } from '../../content/chapters.ts';
import { ENEMIES } from '../../content/enemies.ts';
import { HEROES } from '../../content/heroes.ts';
import { HERO_IDS } from '../../content/schema.ts';
import { HAZARD_NAMES } from '../../core/battle/engine.ts';
import {
  LADDER_RUNGS, canStart, endlessUnlocked, planLadder, startExpedition, startLadder, validEndlessStarts, validStartFloors, maxStartFloor,
} from '../../core/expedition.ts';
import { CHALLENGE_INFO, planFloor } from '../../core/floors.ts';
import { formation } from '../../core/party.ts';
import { Empty, EnemyPortrait, HeroPortrait, Icon, Section, Tabs, Tip } from '../components.tsx';
import { t } from '../names.ts';
import { store, useGame } from '../store.ts';
import { sfx } from '../../audio/audio.ts';

/** the illustrated cutaway of the Deep: one clickable stratum per chapter, a winding path, a banner at the current Age */
function DescentMap({ chapter, setChapter, reach, current, best }: { chapter: number; setChapter: (n: number) => void; reach: number; current: number; best: number }) {
  const base = useRef<HTMLCanvasElement>(null), over = useRef<HTMLCanvasElement>(null), box = useRef<HTMLDivElement>(null);
  const reduced = store.state.settings.reducedMotion;
  useEffect(() => { const c = base.current; if (!c) return; c.width = MAP_W; c.height = MAP_H; (c.getContext('2d') as CanvasRenderingContext2D).drawImage(paintDescent(reach, current), 0, 0); }, [reach, current]);
  useEffect(() => {
    const c = over.current; if (!c) return;
    c.width = MAP_W; c.height = MAP_H;
    const x = c.getContext('2d') as CanvasRenderingContext2D; x.imageSmoothingEnabled = false;
    const draw = (f: number): void => {
      x.clearRect(0, 0, MAP_W, MAP_H);
      const [cx, cy] = NODES[Math.min(10, Math.max(1, current)) - 1];
      drawBanner(x, cx + 5, cy - 4, f);
      const [sx, sy] = NODES[chapter - 1], r = 7 + (f % 4 < 2 ? 0 : 1);
      x.fillStyle = '#ffe08a';
      for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; if (k % 2 === 0) x.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r), 1, 1); }
    };
    draw(0);
    if (reduced) return;
    let f = 0; const id = window.setInterval(() => draw(++f), 160);
    return () => window.clearInterval(id);
  }, [current, chapter, reduced]);
  useEffect(() => { const el = box.current; if (!el) return; const [, y] = NODES[chapter - 1]; el.scrollTo({ top: Math.max(0, (y / MAP_H) * el.scrollHeight - el.clientHeight / 2), behavior: reduced ? 'auto' : 'smooth' }); }, [chapter]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="descent" ref={box}>
      <div className="descent-in" style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
        <canvas ref={base} aria-hidden="true" /><canvas ref={over} aria-hidden="true" />
        {CHAPTERS.map((c, i) => {
          const locked = c.n > reach, cleared = best >= c.n * 100;
          return (
            <button key={c.n} className={`dband ${chapter === c.n ? 'cur' : ''} ${locked ? 'lock' : ''}`} style={{ top: `${((SKY_H + i * BAND_H) / MAP_H) * 100}%`, height: `${(BAND_H / MAP_H) * 100}%` }} onClick={() => setChapter(c.n)} aria-pressed={chapter === c.n}>
              <span className="dlabel"><span className="tiny dim">Chapter {c.n} · floors {c.floors[0]}–{c.floors[1]}</span><br /><b>{t(c.name)}</b>{' '}
                {cleared ? <span className="good tiny">Cleared</span> : c.n === current ? <span className="gold tiny">Current Age</span> : locked ? <span className="faint tiny"><Icon k="lock" /> Locked</span> : <span className="dim tiny">Conquered</span>}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const TAG_ICON: Record<string, { icon: string; label: string }> = {
  boss: { icon: 'boss', label: 'Chapter boss' }, mini: { icon: 'sword2', label: 'Mini-boss' }, elite: { icon: 'boss', label: 'Elite' }, event: { icon: 'event', label: 'Event' },
  challenge: { icon: 'trial', label: 'Trial' }, vault: { icon: 'vault', label: 'Vault' }, gauntlet: { icon: 'whirl', label: 'Gauntlet (2 waves)' }, ambush: { icon: 'claw', label: 'Ambush' },
};

export function MapScreen() {
  const s = useGame();
  const [mode, setMode] = useState<'campaign' | 'endless' | 'ladder'>('campaign');
  const starts = validStartFloors(s);
  const [start, setStart] = useState<number>(starts[starts.length - 1] ?? 1);
  const [chapter, setChapter] = useState<number>(Math.min(s.age, Math.max(1, Math.ceil(start / 100))));
  const form = formation(s);
  const maxStart = maxStartFloor(s);
  useEffect(() => { if (!starts.includes(start)) setStart(starts[starts.length - 1] ?? 1); }, [s.best, s.age]); // eslint-disable-line react-hooks/exhaustive-deps

  const launch = (floor: number, endless = false) => {
    if (store.mutate((st) => startExpedition(st, floor, endless), 'now')) { sfx.battleStart(); store.go('expedition'); }
  };
  const ch = CHAPTERS[chapter - 1];
  const floors = useMemo(() => Array.from({ length: 100 }, (_, i) => planFloor((chapter - 1) * 100 + i + 1, s.seed, Math.max(3, form.length))), [chapter, s.seed, form.length]);
  const boss = ENEMIES[ch.boss];
  const resume = s.expedition;

  return (
    <div className="col">
      <div className="ph"><h2>Delve</h2><span className="small dim">Age {s.age} · best floor {s.best}</span></div>
      {resume && (
        <div className="panel" style={{ borderColor: 'var(--gold)' }}>
          <b>An expedition is under way</b> — floor {resume.floor}. <button className="btn primary small" onClick={() => store.go('expedition')} style={{ marginLeft: 8 }}>Resume</button>
        </div>
      )}
      <Tabs label="Mode" value={mode} onChange={setMode} tabs={[{ id: 'campaign', label: 'Campaign' }, { id: 'endless', label: 'Deep Delve' }, { id: 'ladder', label: 'Challenge Ladder' }]} />
      {mode === 'campaign' && (
        <div className="two" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)' }}>
          <DescentMap chapter={chapter} setChapter={setChapter} reach={Math.max(s.age, Math.ceil(Math.max(1, s.best) / 100))} current={s.age} best={s.best} />
          <div className="col">
            <Section title={`${t(ch.name)}`} right={<span className="chip">{ch.n === s.age ? 'Current Age' : ch.n < s.age ? 'Earlier Age' : 'Locked'}</span>}>
              <p className="small dim">{t(ch.blurb)}</p>
              <div className="row wrap small" style={{ gap: 8 }}>
                <span><b className="gold">{ch.shadow.name}:</b> <span className="dim">{ch.shadow.desc}</span></span>
              </div>
              {ch.hazard && <div className="small"><span className="chip bad"><Icon k="fire" /> {HAZARD_NAMES[ch.hazard.kind]}</span> <span className="dim">strikes every {ch.hazard.every} rounds on many floors, with a one-round warning.</span></div>}
              <div className="small dim" style={{ marginTop: 4 }}>New this chapter: {t(ch.unlockText)}</div>
              <hr className="hr" />
              <div className="row wrap">
                {[...ch.normals, ...ch.minis, ch.elite, ch.boss].map((id) => (
                  <Tip key={id} content={<><h4>{ENEMIES[id].name}</h4><div className="line">{ENEMIES[id].tier}{s.codex[id] ? ` · defeated ${s.codex[id].kills}` : ' · not yet met'}</div></>}>
                    <span tabIndex={0} aria-label={ENEMIES[id].name} style={{ filter: s.codex[id] ? undefined : 'brightness(0.12)' }}><EnemyPortrait id={id} size="sm" /></span>
                  </Tip>
                ))}
              </div>
              <div className="small dim" style={{ marginTop: 4 }}>Boss: <b className="gold">{boss.name}</b>{boss.weakness && s.codex[boss.id] ? ` — ${boss.weakness}` : ''}</div>
            </Section>
            <Section title="Floors" right={<span className="small dim">Click a checkpoint to choose where to start</span>}>
              <div className="mapfloor" style={{ gridTemplateColumns: 'repeat(10, minmax(0,1fr))' }}>
                {floors.map((p) => {
                  const f = p.floor;
                  const cleared = f <= s.best;
                  const startable = (f - 1) % 10 === 0 && f <= maxStart && starts.includes(f);
                  const tag = TAG_ICON[p.tag];
                  return (
                    <Tip key={f} content={<><h4>Floor {f}</h4><div className="line">{tag?.label ?? 'Battle'}{cleared ? ' · cleared' : ''}{startable ? ' · start here' : ''}</div></>}>
                      <button className={`${start === f ? 'sel' : ''}`} disabled={!startable} onClick={() => setStart(f)} aria-label={`Floor ${f}${startable ? ', start here' : ''}${tag ? `, ${tag.label}` : ''}`} style={{ opacity: cleared || startable ? 1 : 0.4, padding: '0.2rem 0' }}>
                        <span className="tiny num" style={{ color: cleared ? 'var(--good)' : undefined }}>{f}</span>
                        {tag ? <Icon k={tag.icon} size={14} color={p.tag === 'boss' ? 'var(--bad)' : 'var(--gold2)'} /> : f % 10 === 0 ? <Icon k="flame" size={13} color="var(--good)" /> : <span style={{ height: 14 }} />}
                      </button>
                    </Tip>
                  );
                })}
              </div>
              <div className="tiny faint" style={{ marginTop: 6 }}>Every 10th floor is a checkpoint (full heal). Floors you have already cleared pay out half as much; floors from earlier Ages half again.</div>
            </Section>
            <Section title="Launch">
              <div className="row wrap">
                {form.map((f) => <span key={f.id} className="row gap-s"><HeroPortrait id={f.id} size="sm" /><span className="small">{HEROES[f.id].name}<br /><span className="tiny dim">Lv {s.heroes[f.id].level} · {f.row}</span></span></span>)}
                <button className="btn small ghost" onClick={() => store.go('party')}>Change party</button>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn primary big" disabled={!canStart(s, start).ok} onClick={() => launch(start)}><Icon k="sword" /> Descend from floor {start}</button>
                <span className="small dim">{canStart(s, start).why}</span>
              </div>
              {s.best >= s.age * 100 && s.age < 10 && <p className="small gold" style={{ marginTop: 6 }}>The boss of this Age has fallen. Return to camp to descend into the next.</p>}
            </Section>
          </div>
        </div>
      )}
      {mode === 'endless' && (
        endlessUnlocked(s) ? (
          <Section title="The Deep Delve" right={<span className="chip gold">Best: floor {s.endless.best}</span>}>
            <p className="dim">Beyond the Bridge the depths go on. Floors from 1,001 scale without a ceiling; every 25th floor is a boss, with trials and elites between. Rewards grow with depth. Your party is capped at its level — gear, relics and talents decide how deep you can go.</p>
            <div className="row wrap">{validEndlessStarts(s).map((f) => <button key={f} className="btn" disabled={!canStart(s, f, true).ok} onClick={() => launch(f, true)}><Icon k="map" /> Start at {f}</button>)}</div>
          </Section>
        ) : <Empty>Defeat the Balrog on floor 1000 to open the Deep Delve.</Empty>
      )}
      {mode === 'ladder' && (
        endlessUnlocked(s) ? (
          <Section title="Challenge Ladder" right={<span className="chip gold">{s.ladder.cleared}/{LADDER_RUNGS} cleared</span>}>
            <p className="dim">A postgame ladder of one-battle trials: fixed foes, a rule that bends the fight, and generous rewards. Each rung unlocks the next. No supplies, no second chances within a rung.</p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(17rem, 1fr))' }}>
              {Array.from({ length: LADDER_RUNGS }, (_, i) => {
                const rung = i + 1; const pl = planLadder(rung, s.seed);
                const locked = rung > s.ladder.cleared + 1; const done = rung <= s.ladder.cleared;
                return (
                  <div key={rung} className="panel flat" style={{ opacity: locked ? 0.45 : 1, borderColor: done ? 'var(--good)' : undefined }}>
                    <div className="ph"><b>Rung {rung}</b>{done ? <span className="chip good">Cleared</span> : locked ? <Icon k="lock" /> : <span className="chip gold">Ready</span>}</div>
                    <div className="row gap-s">{pl.waves[0].map((e, k) => <EnemyPortrait key={k} id={e.id} size="sm" />)}</div>
                    <div className="small"><b className="bad">{CHALLENGE_INFO[pl.challenge[0]].name}</b> <span className="dim">{CHALLENGE_INFO[pl.challenge[0]].desc}</span></div>
                    <button className="btn small primary" style={{ marginTop: 6 }} disabled={locked || !!s.expedition} onClick={() => { if (store.mutate((st) => startLadder(st, rung), 'now')) store.go('expedition'); }}>Face this rung</button>
                  </div>
                );
              })}
            </div>
          </Section>
        ) : <Empty>Defeat the Balrog on floor 1000 to open the Challenge Ladder.</Empty>
      )}
    </div>
  );
}
export { HERO_IDS };
