import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { paintBackground } from '../../art/backgrounds.ts';
import { CHAPTER_BY_N } from '../../content/chapters.ts';
import { ENEMIES } from '../../content/enemies.ts';
import { EVENT_BY_ID } from '../../content/events.ts';
import { HEROES } from '../../content/heroes.ts';
import { ITEMS } from '../../content/items.ts';
import { LORE_BY_ID } from '../../content/lore.ts';
import type { HeroId, StatusId } from '../../content/schema.ts';
import { RARITY_COLOR } from '../../content/schema.ts';
import { Battle, HAZARD_NAMES } from '../../core/battle/engine.ts';
import { buildSetup } from '../../core/party.ts';
import type { BEvent, BattleResult } from '../../core/battle/types.ts';
import {
  applyBattleResult, bankExpedition, chooseDoor, eventChoiceAvailable, getPlan, prepareBattle, quickResolve, resolveEvent, retreat,
  takeRest, traversalSafe, type EventResult,
} from '../../core/expedition.ts';
import { CHALLENGE_INFO, type FloorPlan } from '../../core/floors.ts';
import { itemName } from '../../core/loot.ts';
import type { BattleSummary } from '../../core/state.ts';
import { BattleStage, type StageApi } from '../BattleStage.tsx';
import { Bar, EnemyPortrait, HeroPortrait, Icon, Modal, StatusIcon, Tip, fmt, useHotkeys, ItemCell } from '../components.tsx';
import { t } from '../names.ts';
import { store, useGame } from '../store.ts';
import { sfx } from '../../audio/audio.ts';
import { newBondScenes } from './Journal.tsx';

interface HudUnit { uid: number; name: string; side: 'hero' | 'enemy'; hp: number; maxHp: number; alive: boolean; id: string; heroId?: HeroId; statuses: { id: StatusId; turns: number }[]; skills: { name: string; cdLeft: number }[]; tier: string }
interface Hud { units: HudUnit[]; timeline: number[]; round: number }
interface LogLine { id: number; text: string; tone: string }

function snapshot(b: Battle): Hud {
  return {
    units: b.units.map((u) => ({
      uid: u.uid, name: u.name, side: u.side, hp: u.hp, maxHp: u.maxHp, alive: u.alive, id: u.id, heroId: u.heroId, tier: u.tier,
      statuses: u.statuses.map((s) => ({ id: s.id, turns: s.turns })), skills: u.skills.map((s) => ({ name: s.def.name, cdLeft: s.cdLeft })),
    })),
    timeline: b.forecast(8),
    round: b.round,
  };
}

type Phase = 'intro' | 'fight' | 'summary' | 'ended';

export function ExpeditionScreen() {
  const state = useGame();
  const exp = state.expedition;
  const stage = useRef<StageApi>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [hud, setHud] = useState<Hud | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [summary, setSummary] = useState<BattleSummary | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeedState] = useState<number>(state.settings.speed);
  const [eventResult, setEventResult] = useState<EventResult | null>(null);
  const [confirmRetreat, setConfirmRetreat] = useState(false);
  const battleRef = useRef<{ battle: Battle; plan: FloorPlan } | null>(null);
  const pausedRef = useRef(false);
  const speedRef = useRef(speed);
  const skipRef = useRef(false);
  const runId = useRef(0);
  const logId = useRef(1);
  const autoRef = useRef(state.settings.autoDelve);
  autoRef.current = state.settings.autoDelve;

  const plan = exp ? getPlan(state) : null;
  const chapter = plan ? CHAPTER_BY_N(plan.chapter) : CHAPTER_BY_N(1);

  const pushLog = useCallback((text: string, tone = '') => {
    setLog((l) => [...l.slice(-160), { id: logId.current++, text, tone }]);
  }, []);

  const setSpeed = (n: number) => { setSpeedState(n); speedRef.current = n; stage.current?.setSpeed(n); store.mutate((s) => { s.settings.speed = n as 1 | 2 | 4; }); };
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // background for the current floor
  const bg = useMemo(() => (plan ? paintBackground(plan.chapter, plan.bg, plan.floor) : null), [plan?.floor, plan?.chapter, plan?.bg, exp?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // when the expedition state changes (new floor etc.), reset local phase
  const floorKey = exp ? `${exp.floor}:${exp.phase}:${exp.room}` : 'none';
  useEffect(() => {
    if (!exp) return;
    if (exp.phase === 'ended') setPhase('ended');
    else if (exp.phase === 'room') setPhase((p) => (p === 'fight' || p === 'summary' ? p : 'intro'));
  }, [floorKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stage init for the intro (static preview) so the player sees the room
  useEffect(() => {
    if (!exp || !plan || !bg || exp.phase === 'ended') return;
    const quiet = exp.phase === 'door' || exp.phase === 'event' || plan.kind === 'rest';
    if (quiet) {
      // rooms without a fight still show the party standing in the room
      const setup = buildSetup(store.state, { ...plan, waves: [[]] }, { hp: exp.hp });
      stage.current?.init({ bg, heroes: new Battle(setup, 1, { record: false }).views('hero'), enemies: [], reduced: state.settings.reducedMotion });
      return;
    }
    if (exp.phase !== 'room' || phase !== 'intro') return;
    const bs = prepareBattle(store.state, true);
    if (!bs) return;
    battleRef.current = { battle: bs.battle, plan: bs.plan };
    stage.current?.init({ bg, heroes: bs.battle.views('hero'), enemies: bs.battle.views('enemy'), reduced: state.settings.reducedMotion });
    setHud(snapshot(bs.battle));
    setLog([]);
    pushLog(`— ${plan.title} —`, 'w');
  }, [floorKey, phase === 'intro']); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-start fights when auto-delve is on
  useEffect(() => {
    if (phase !== 'intro' || !exp || exp.phase !== 'room' || !plan || plan.kind === 'rest') return;
    if (!state.settings.autoDelve) return;
    const id = setTimeout(() => {
      if (traversalSafe(store.state)) {
        const s = store.mutate((st) => quickResolve(st), 'now');
        if (s) { setSummary(s); setPhase(store.state.expedition?.phase === 'ended' ? 'ended' : 'intro'); }
        return;
      }
      void startFight();
    }, 900);
    return () => clearTimeout(id);
  }, [phase, floorKey, state.settings.autoDelve]); // eslint-disable-line react-hooks/exhaustive-deps

  // rest rooms and door/event rooms auto-handled by overlays below
  const startFight = useCallback(async () => {
    const cur = battleRef.current;
    if (!cur || !store.state.expedition) return;
    const my = ++runId.current;
    skipRef.current = false;
    setPhase('fight');
    sfx.resume();
    sfx.battleStart();
    const { battle, plan: p } = cur;
    stage.current!.hooks.onLog = (text, tone) => pushLog(text, tone as string);
    stage.current?.setSpeed(speedRef.current);
    await new Promise((r) => setTimeout(r, 120));
    let guard = 0;
    while (!battle.over && my === runId.current && guard++ < 4000) {
      if (pausedRef.current && !skipRef.current) { await new Promise((r) => setTimeout(r, 80)); continue; }
      let evs: BEvent[];
      if (skipRef.current) { const r = battle.run(); void r; evs = []; setHud(snapshot(battle)); break; }
      evs = battle.step();
      for (const e of evs) soundFor(e);
      for (const e of evs) if (e.t === 'skill') pushLog(`${battle.unit(e.actor)?.name ?? '?'} uses ${e.name}${e.rule ? `  ·  ${e.rule}` : ''}`, battle.unit(e.actor)?.side === 'hero' ? 'h' : 'e');
      await stage.current!.play(evs, speedRef.current);
      setHud(snapshot(battle));
    }
    if (my !== runId.current) return;
    const res: BattleResult = battle.summary();
    const s = store.mutate((st) => applyBattleResult(st, p, res), 'now');
    setSummary(s);
    setHud(snapshot(battle));
    if (res.result === 'victory') sfx.victory(); else sfx.defeat();
    setPhase('summary');
  }, [pushLog]);

  useEffect(() => () => { runId.current++; }, []);

  const afterSummary = useCallback(() => {
    setSummary(null);
    const e = store.state.expedition;
    if (!e) return;
    setPhase(e.phase === 'ended' ? 'ended' : 'intro');
  }, []);

  // auto-continue past the summary
  useEffect(() => {
    if (phase !== 'summary' || !state.settings.autoDelve || !summary || summary.result !== 'victory') return;
    const id = setTimeout(afterSummary, 1600);
    return () => clearTimeout(id);
  }, [phase, summary, state.settings.autoDelve, afterSummary]);

  useHotkeys({
    ' ': () => { if (phase === 'intro') void startFight(); else if (phase === 'fight') setPaused((p) => !p); else if (phase === 'summary') afterSummary(); },
    enter: () => { if (phase === 'intro') void startFight(); else if (phase === 'summary') afterSummary(); },
    '1': () => setSpeed(1), '2': () => setSpeed(2), '3': () => setSpeed(4),
    l: () => store.mutate((s) => { s.settings.showLog = !s.settings.showLog; }),
    s: () => { if (phase === 'fight') { skipRef.current = true; stage.current?.setSpeed(200); } },
    a: () => store.mutate((s) => { s.settings.autoDelve = !s.settings.autoDelve; }),
  }, [phase, startFight, afterSummary]);

  if (!exp || !plan) return <div className="main"><p>No expedition under way.</p><button className="btn" onClick={() => store.go('camp')}>Back to camp</button></div>;

  const heroes = hud?.units.filter((u) => u.side === 'hero') ?? [];
  const foes = hud?.units.filter((u) => u.side === 'enemy' && u.alive) ?? [];
  const e = exp;

  return (
    <div className="exp">
      <div className="portrait-hint">Tip: rotate your device to landscape for a bigger battle view.</div>
      <div className="stage">
        <BattleStage ref={stage} />
        <div className="hud-top">
          <div className="col gap-s" style={{ gap: 2 }}>
            <div className="row gap-s">
              <span className="chip gold"><Icon k="map" /> Floor {plan.floor}</span>
              <span className="chip">{t(chapter.name)}</span>
              {plan.checkpoint && <span className="chip good">Checkpoint</span>}
              {hud && phase === 'fight' && <span className="chip num">Round {hud.round}</span>}
              {plan.challenge.map((c) => <Tip key={c} content={<><h4>{CHALLENGE_INFO[c].name}</h4><div className="line">{CHALLENGE_INFO[c].desc}</div></>}><span className="chip bad" tabIndex={0}><Icon k="trial" /> {CHALLENGE_INFO[c].name}</span></Tip>)}
              {plan.hazards.map((h) => <Tip key={h.kind} content={<><h4>{HAZARD_NAMES[h.kind]}</h4><div className="line">Strikes every {h.every} rounds. Telegraphed one round ahead.</div></>}><span className="chip bad" tabIndex={0}><Icon k="fire" /> {HAZARD_NAMES[h.kind]}</span></Tip>)}
            </div>
            {hud && phase === 'fight' && (
              <div className="timeline" aria-label="Turn order">
                {hud.timeline.map((uid, i) => {
                  const u = hud.units.find((x) => x.uid === uid);
                  if (!u) return null;
                  return (
                    <Tip key={`${uid}-${i}`} content={<h4>{u.name}</h4>}>
                      <span className={`tl-unit ${u.side} ${i === 0 ? 'first' : ''}`} aria-label={`${i === 0 ? 'Next: ' : ''}${u.name}`}>
                        {u.side === 'hero' && u.heroId ? <HeroPortrait id={u.heroId} size="sm" /> : <EnemyPortrait id={u.id} size="sm" />}
                      </span>
                    </Tip>
                  );
                })}
              </div>
            )}
          </div>
          <div className="grow" />
          <div className="row gap-s">
            <span className="res num" aria-label="Gold earned this expedition"><Icon k="coin" /> {fmt(e.gold)}</span>
            <span className="res num" aria-label="Relic essence earned"><Icon k="essence" color="#c8a0ff" /> {fmt(e.essence)}</span>
            <span className="res num" aria-label="Supplies"><Icon k="supplies" /> {e.supplies}</span>
          </div>
        </div>

        {/* floor intro */}
        {phase === 'intro' && e.phase === 'room' && e.room !== 'rest' && (
          <div className="overlay-center" style={{ background: 'transparent', alignItems: 'flex-start', paddingTop: '3.4rem', pointerEvents: 'none' }}>
            <div className="panel center" style={{ maxWidth: '34rem', pointerEvents: 'auto', background: 'rgba(16,18,24,0.92)' }}>
              <div className="floor-title">
                <div className="dim small">{plan.subtitle}</div>
                <h2>{t(plan.title)}</h2>
              </div>
              <div className="row wrap" style={{ justifyContent: 'center', margin: '0.6rem 0' }}>
                {plan.waves.flat().filter((w, i, a) => a.findIndex((x) => x.id === w.id) === i).map((w) => (
                  <Tip key={w.id} content={<><h4>{ENEMIES[w.id].name}</h4><div className="line">{t(ENEMIES[w.id].codex)}</div>{ENEMIES[w.id].weakness && <div className="gold small">Tip: {ENEMIES[w.id].weakness}</div>}</>}>
                    <span tabIndex={0} aria-label={ENEMIES[w.id].name}><EnemyPortrait id={w.id} size="md" /></span>
                  </Tip>
                ))}
              </div>
              {plan.waves.length > 1 && <div className="small dim">{plan.waves.length} waves</div>}
              <div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn primary big" onClick={() => void startFight()} autoFocus><Icon k="sword" /> Fight <span className="kbd">Space</span></button>
                <button className="btn" onClick={() => setConfirmRetreat(true)}>Retreat</button>
                <button className={`btn ${state.settings.autoDelve ? 'primary' : ''}`} aria-pressed={state.settings.autoDelve} onClick={() => store.mutate((s) => { s.settings.autoDelve = !s.settings.autoDelve; })}>Auto-delve <span className="kbd">A</span></button>
              </div>
            </div>
          </div>
        )}

        {e.phase === 'door' && <DoorChoice />}
        {e.phase === 'event' && <EventPanel result={eventResult} onResult={setEventResult} />}
        {phase === 'intro' && e.phase === 'room' && e.room === 'rest' && <RestPanel />}
        {phase === 'summary' && summary && <SummaryPanel summary={summary} onContinue={afterSummary} />}
        {phase === 'ended' && <EndPanel />}
      </div>

      <div className="hud-bottom">
        <div className="partybar">
          {heroes.map((u) => (
            <div key={u.uid} className={`pb ${u.alive ? '' : 'ko'}`}>
              {u.heroId && <HeroPortrait id={u.heroId} size="sm" />}
              <div className="grow">
                <div className="row spread small"><b>{t(u.name)}</b><span className="num dim">{fmt(u.hp)}/{fmt(u.maxHp)}</span></div>
                <Bar value={u.hp} max={u.maxHp} label={`${u.name} health`} />
                <div className="statusrow">{u.statuses.map((s) => <StatusIcon key={s.id} id={s.id} turns={s.turns} />)}</div>
                {phase === 'fight' && <div className="tiny faint" aria-hidden="true">{u.skills.map((s) => (s.cdLeft > 0 ? `○` : `●`)).join(' ')}</div>}
              </div>
            </div>
          ))}
        </div>
        {foes.length > 0 && phase !== 'intro' && (
          <div className="col" style={{ flex: '0 1 14rem', gap: 3 }} aria-label="Enemies">
            {foes.slice(0, 5).map((u) => (
              <div key={u.uid} className="row gap-s small">
                <span style={{ width: '6.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(u.name)}</span>
                <div className="grow"><Bar value={u.hp} max={u.maxHp} kind="bad" label={`${u.name} health`} /></div>
                {u.statuses.slice(0, 3).map((s) => <StatusIcon key={s.id} id={s.id} turns={s.turns} />)}
              </div>
            ))}
          </div>
        )}
        {state.settings.showLog && <Log log={log} />}
        <div className="col" style={{ gap: 4 }}>
          <div className="row gap-s speed">
            <button className="btn small" onClick={() => setPaused((p) => !p)} disabled={phase !== 'fight'} aria-pressed={paused} aria-label={paused ? 'Resume' : 'Pause'}><Icon k={paused ? 'play' : 'pause'} /></button>
            {[1, 2, 4].map((n) => <button key={n} className={`btn small ${speed === n ? 'on' : ''}`} onClick={() => setSpeed(n)} aria-pressed={speed === n} aria-label={`${n}x speed`}>{n}×</button>)}
            <button className="btn small" onClick={() => { skipRef.current = true; stage.current?.setSpeed(200); setPaused(false); }} disabled={phase !== 'fight'} aria-label="Skip battle (resolve instantly)"><Icon k="skip" /></button>
          </div>
          <div className="row gap-s">
            <button className="btn small" onClick={() => store.mutate((s) => { s.settings.showLog = !s.settings.showLog; })} aria-pressed={state.settings.showLog}><Icon k="log" /> Log</button>
            <button className="btn small danger" onClick={() => setConfirmRetreat(true)}>Retreat</button>
          </div>
        </div>
      </div>
      <div className="sr-only" role="status" aria-live="polite">{log.slice(-1)[0]?.text}</div>

      {confirmRetreat && (
        <Modal label="Retreat?" onClose={() => setConfirmRetreat(false)}>
          <h3>Retreat to camp?</h3>
          <p>You keep everything you have gathered on this expedition. {phase === 'fight' && <b>The current battle will be abandoned.</b>}</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setConfirmRetreat(false)}>Keep going</button>
            <button className="btn danger" onClick={() => {
              runId.current++; setConfirmRetreat(false);
              store.mutate((s) => retreat(s), 'now'); setPhase('ended');
            }}>Retreat</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function soundFor(e: BEvent): void {
  switch (e.t) {
    case 'hit': if (e.kind === 'dot') sfx.dot(); else if (e.crit) sfx.crit(); else sfx.hit(e.kind === 'magic'); break;
    case 'miss': sfx.miss(); break;
    case 'heal': sfx.heal(); break;
    case 'shield': sfx.shield(); break;
    case 'death': sfx.death(); break;
    case 'phase': sfx.phase(); break;
    case 'skill': sfx.skill(e.fx); break;
    case 'combo': sfx.combo(); break;
    case 'hazard': if (!e.warn) sfx.hazard(); break;
    default: break;
  }
}

function Log({ log }: { log: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [log.length]);
  return (
    <div className="logbox" ref={ref} role="log" aria-label="Battle log">
      {log.map((l) => <div key={l.id} className={`ev ${l.tone}`}>{t(l.text)}</div>)}
    </div>
  );
}

// ------------------------------------------------------------------ rooms
function DoorChoice() {
  const state = useGame();
  const e = state.expedition!;
  const labels: Record<string, { name: string; desc: string; icon: string }> = {
    battle: { name: 'The Beaten Path', desc: 'A normal fight. Steady rewards.', icon: 'sword' },
    elite: { name: 'The Guarded Door', desc: 'An elite lies behind it. Harder, but richer.', icon: 'boss' },
    rest: { name: 'A Quiet Alcove', desc: 'Rest: recover 40% health and find a supply.', icon: 'rest' },
    vault: { name: 'The Vault Door', desc: 'Armoured guardians, and treasure beyond.', icon: 'vault' },
    event: { name: 'A Strange Door', desc: 'Something unusual waits. Anything could happen.', icon: 'event' },
  };
  return (
    <div className="overlay-center">
      <div className="panel center" style={{ maxWidth: '40rem' }}>
        <h2>Two doors</h2>
        <p className="dim">The passage splits. Choose which way to go.</p>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          {(e.doorChoices ?? []).map((k) => (
            <button key={k} className="panel flat" style={{ cursor: 'pointer', width: '15rem' }} onClick={() => store.mutate((s) => chooseDoor(s, k), 'soon')}>
              <Icon k={labels[k].icon} size={36} />
              <h4>{labels[k].name}</h4><div className="small dim">{labels[k].desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventPanel({ result, onResult }: { result: EventResult | null; onResult: (r: EventResult | null) => void }) {
  const state = useGame();
  const e = state.expedition!;
  const ev = e.eventId ? EVENT_BY_ID[e.eventId] : null;
  if (result) {
    return (
      <div className="overlay-center">
        <div className="panel" style={{ maxWidth: '36rem' }}>
          <h3>{ev?.title ?? 'Outcome'}</h3>
          <p>{t(result.text)}</p>
          {result.lines.slice(1).map((l, i) => <div key={i} className="chip gold" style={{ margin: 2 }}>{l}</div>)}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn primary" onClick={() => onResult(null)} autoFocus>{result.fight ? 'Draw weapons!' : 'Continue'}</button>
          </div>
        </div>
      </div>
    );
  }
  if (!ev) return null;
  return (
    <div className="overlay-center">
      <div className="panel" style={{ maxWidth: '40rem' }}>
        <div className="row"><Icon k="event" size={28} /><h2>{ev.title}</h2></div>
        <p style={{ fontSize: '1.1rem' }}>{t(ev.text)}</p>
        <div className="col">
          {ev.choices.map((c, i) => {
            const av = eventChoiceAvailable(state, c);
            return (
              <button key={i} className="btn" style={{ justifyContent: 'space-between', textAlign: 'left' }} disabled={!av.ok}
                onClick={() => { const r = store.mutate((s) => resolveEvent(s, i), 'now'); if (r) onResult(r); }}>
                <span><b>{t(c.label)}</b>{c.requires?.hero ? <span className="chip gold" style={{ marginLeft: 6 }}>{HEROES[c.requires.hero].name}</span> : null}</span>
                <span className="small dim">{av.ok ? c.hint : av.why}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RestPanel() {
  return (
    <div className="overlay-center">
      <div className="panel center" style={{ maxWidth: '30rem' }}>
        <Icon k="rest" size={40} />
        <h2>A quiet alcove</h2>
        <p className="dim">The company can rest here for a while. Recover 40% health and find a spare supply.</p>
        <button className="btn primary big" onClick={() => store.mutate((s) => takeRest(s), 'now')} autoFocus>Rest</button>
      </div>
    </div>
  );
}

function SummaryPanel({ summary, onContinue }: { summary: BattleSummary; onContinue: () => void }) {
  const state = useGame();
  const e = state.expedition;
  const items = e?.items.filter((i) => summary.items.includes(i.uid)).slice(-6) ?? [];
  const victory = summary.result === 'victory';
  const total = Math.max(1, ...summary.heroes.map((h) => h.dealt));
  return (
    <div className="overlay-center" style={{ background: 'transparent', justifyContent: 'flex-end', alignItems: 'flex-start', paddingTop: '3.4rem', pointerEvents: 'none' }}>
      <div className="panel" style={{ maxWidth: '30rem', width: '100%', pointerEvents: 'auto', background: 'rgba(16,18,24,0.94)' }}>
        <div className="ph">
          <h2 style={{ color: victory ? 'var(--gold2)' : 'var(--bad)' }}>{victory ? 'Victory' : 'Defeat'} — floor {summary.floor}</h2>
          <span className="chip">{summary.rounds} rounds</span>
        </div>
        <div className="row wrap">
          {victory && <span className="chip gold"><Icon k="coin" /> +{fmt(summary.gold)}</span>}
          <span className="chip"><Icon k="star" /> +{fmt(summary.xp)} XP each</span>
          {summary.essence > 0 && <span className="chip" style={{ color: '#c8a0ff' }}><Icon k="essence" /> +{summary.essence} essence</span>}
          {state.lastSummary?.levelUps.map((l, i) => <span key={i} className="chip good">{HEROES[l.id].name} → level {l.level}</span>)}
          {newBondScenes(state) > 0 && <button className="chip gold" onClick={() => undefined} title="Open Journal → Bonds in camp">New bond scene waiting in the Journal</button>}
          {Object.keys(state.flags).filter((k) => k.startsWith('joined-') && state.flags[k] === summary.floor).map((k) => <span key={k} className="chip gold">★ {HEROES[k.slice(7) as HeroId].name} joins!</span>)}
        </div>
        {items.length > 0 && <div className="row wrap" style={{ margin: '0.6rem 0' }}>
          {items.map((i) => <ItemCell key={i.uid} item={i} />)}
          <span className="small dim">{items.map((i) => itemName(i)).slice(0, 3).join(', ')}{items.length > 3 ? '…' : ''}</span>
        </div>}
        {victory && summary.heroes.some((h) => h.alive) && <p className="small" style={{ fontStyle: 'italic', margin: '6px 0' }}>{(() => { const alive = summary.heroes.filter((x) => x.alive); const h = alive[summary.floor % alive.length]; return `${HEROES[h.id].name}: “${HEROES[h.id].quotes.win}”`; })()}</p>}
        <details open={!victory}>
          <summary className="small dim" style={{ cursor: 'pointer' }}>Battle report</summary>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(10rem,1fr))', marginTop: 6 }}>
            {summary.heroes.map((h) => (
              <div key={h.id} className="inset small">
                <div className="row gap-s"><HeroPortrait id={h.id} size="sm" ko={!h.alive} /><b>{HEROES[h.id].name}</b></div>
                <div className="num">Dealt {fmt(h.dealt)}</div>
                <div className="bar"><i style={{ width: `${(h.dealt / total) * 100}%`, background: 'linear-gradient(#e8c673,#b88f3a)' }} /></div>
                <div className="num dim">Healed {fmt(h.healed)} · Taken {fmt(h.taken)} · KOs {h.kills}</div>
              </div>
            ))}
          </div>
        </details>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn primary" onClick={onContinue} autoFocus>{e?.phase === 'ended' ? 'Continue' : 'Next floor'} <span className="kbd">Enter</span></button>
        </div>
      </div>
    </div>
  );
}

function EndPanel() {
  const state = useGame();
  const e = state.expedition;
  const [banked, setBanked] = useState<ReturnType<typeof bankExpedition>>(null);
  if (!e) return null;
  const reason = e.ended?.reason;
  const title = reason === 'defeat' ? 'The company falls back' : reason === 'victory' ? 'The way is open' : 'Back to camp';
  const keep = e.ended?.keep ?? 1;
  return (
    <div className="overlay-center" style={{ background: 'rgba(5,6,9,0.7)' }}>
      <div className="panel" style={{ maxWidth: '40rem', width: '100%' }}>
        <h2>{title}</h2>
        {reason === 'defeat' && <p className="dim">You limp back to camp with {Math.round(keep * 100)}% of the gold and materials you were carrying. Relic essence, items and experience are all kept — and the company is more determined than before.</p>}
        {reason === 'victory' && <p className="dim">The guardian falls. {state.age < 10 ? 'Return to camp: a way deeper has opened.' : 'The bridge is behind you.'}</p>}
        <div className="row wrap">
          <span className="chip gold"><Icon k="coin" /> {fmt(Math.round(e.gold * keep))}</span>
          <span className="chip"><Icon k="ore" /> {fmt(Math.round(e.ore * keep))}</span>
          <span className="chip"><Icon k="cloth" /> {fmt(Math.round(e.cloth * keep))}</span>
          <span className="chip" style={{ color: '#c8a0ff' }}><Icon k="essence" /> {e.essence}</span>
          {e.renown > 0 && <span className="chip"><Icon k="renown" /> {e.renown}</span>}
          {e.shards > 0 && <span className="chip"><Icon k="shard" /> {e.shards}</span>}
          <span className="chip">{e.cleared} floors cleared</span>
          {e.newBest && <span className="chip good">New best floor!</span>}
        </div>
        <div className="row wrap" style={{ margin: '0.6rem 0' }}>
          {e.items.slice(0, 24).map((i) => <ItemCell key={i.uid} item={i} />)}
          {e.items.length > 24 && <span className="dim">+{e.items.length - 24} more</span>}
        </div>
        {e.lore.length > 0 && <div className="small dim">New lore: {e.lore.map((l) => LORE_BY_ID[l]?.title).filter(Boolean).join(', ')}</div>}
        {banked && banked.salvaged > 0 && <div className="small dim">{banked.salvaged} items were salvaged automatically.</div>}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn primary big" onClick={() => {
            const b = store.mutate((s) => bankExpedition(s), 'now'); setBanked(b);
            if (store.state.flags.endingPending) store.go('ending'); else store.go('camp');
          }} autoFocus>Return to camp</button>
        </div>
      </div>
    </div>
  );
}

export { RARITY_COLOR, ITEMS };
