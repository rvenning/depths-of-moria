import { useEffect, useState } from 'react';
import { ACHIEVEMENTS } from '../../content/meta.ts';
import { BOND_LIST, BOND_TIERS, bondTier } from '../../content/bonds.ts';
import { CHAPTERS } from '../../content/chapters.ts';
import { ENEMY_LIST } from '../../content/enemies.ts';
import { HEROES } from '../../content/heroes.ts';
import { ITEM_LIST, ITEMS, RARITY_NAME, SETS } from '../../content/items.ts';
import { LORE } from '../../content/lore.ts';
import { RARITY_COLOR } from '../../content/schema.ts';
import type { BondDef, ItemInstance } from '../../content/schema.ts';
import { metricValue } from '../../core/meta.ts';
import type { GameState } from '../../core/state.ts';
import { Bar, EnemyPortrait, HeroPortrait, Icon, ItemCell, Tabs, Tip, fmt } from '../components.tsx';
import { Cutscene } from '../Cutscene.tsx';
import { t } from '../names.ts';
import { store, useGame } from '../store.ts';

export function newBondScenes(s: GameState): number {
  let n = 0;
  for (const b of BOND_LIST) n += Math.max(0, bondTier(s.bonds[b.id] ?? 0) - (s.bondSeen[b.id] ?? 0));
  return n;
}

type Tab = 'lore' | 'codex' | 'items' | 'bonds' | 'records' | 'achievements';

export function JournalScreen() {
  const s = useGame();
  const [tab, setTab] = useState<Tab>(((store.screenArg as Tab) || 'lore'));
  useEffect(() => { if (store.screenArg) setTab(store.screenArg as Tab); }, []);
  return (
    <div>
      <h2 style={{ marginBottom: 8 }}>Journal</h2>
      <Tabs label="Journal" value={tab} onChange={setTab} tabs={[
        { id: 'lore', label: `Lore ${s.lore.length}/${LORE.length}` }, { id: 'codex', label: `Codex ${Object.keys(s.codex).length}/${ENEMY_LIST.length}` },
        { id: 'items', label: `Collection ${s.itemsSeen.length}/${ITEM_LIST.length}` }, { id: 'bonds', label: 'Bonds', badge: newBondScenes(s) },
        { id: 'records', label: 'Records' }, { id: 'achievements', label: `Achievements ${Object.keys(s.achievements).length}/${ACHIEVEMENTS.length}` },
      ]} />
      {tab === 'lore' && <Lore />}
      {tab === 'codex' && <Codex />}
      {tab === 'items' && <Collection />}
      {tab === 'bonds' && <Bonds />}
      {tab === 'records' && <Records />}
      {tab === 'achievements' && <Achievements />}
    </div>
  );
}

function Lore() {
  const s = useGame();
  const [open, setOpen] = useState<string | null>(s.lore[s.lore.length - 1] ?? null);
  const found = LORE.filter((l) => s.lore.includes(l.id));
  const cur = LORE.find((l) => l.id === open);
  return (
    <div className="two" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)' }}>
      <div className="col" style={{ gap: 4 }}>
        {CHAPTERS.map((c) => {
          const here = LORE.filter((l) => l.chapter === c.n);
          return (
            <div key={c.n}>
              <div className="small dim" style={{ margin: '6px 0 2px' }}>Chapter {c.n} — {t(c.name)}</div>
              {here.map((l) => s.lore.includes(l.id)
                ? <button key={l.id} className={`btn small ghost ${open === l.id ? 'primary' : ''}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setOpen(l.id)}><Icon k="scroll" /> {t(l.title)}</button>
                : <div key={l.id} className="small faint" style={{ padding: '2px 8px' }}>??? — {l.source === 'boss' ? 'defeat the boss' : l.source.startsWith('floor') ? `reach floor ${l.source.slice(6)}` : l.source === 'event' ? 'found in an event' : 'discover'}</div>)}
            </div>
          );
        })}
      </div>
      <div className="panel scene-txt">
        {cur ? <><h3>{t(cur.title)}</h3><p style={{ fontSize: '1.15rem' }}>{t(cur.text)}</p></> : <p className="dim">{found.length ? 'Choose an entry.' : 'Nothing recorded yet. Descend, win battles and explore events to fill the journal.'}</p>}
      </div>
    </div>
  );
}

function Codex() {
  const s = useGame();
  const [ch, setCh] = useState(0);
  const list = ENEMY_LIST.filter((e) => ch === 0 || e.chapter === ch);
  return (
    <div className="col">
      <div className="row wrap">
        <button className={`btn small ${ch === 0 ? 'primary' : ''}`} onClick={() => setCh(0)}>All</button>
        {CHAPTERS.map((c) => <button key={c.n} className={`btn small ${ch === c.n ? 'primary' : ''}`} onClick={() => setCh(c.n)}>{c.n}</button>)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(17rem, 1fr))' }}>
        {list.map((e) => {
          const rec = s.codex[e.id];
          return (
            <div key={e.id} className="panel flat row" style={{ opacity: rec ? 1 : 0.5, alignItems: 'flex-start' }}>
              <div style={{ filter: rec ? undefined : 'brightness(0)' }}><EnemyPortrait id={e.id} size="md" /></div>
              <div className="grow">
                <div className="row spread"><b>{rec ? e.name : '???'}</b><span className="chip">{e.tier}</span></div>
                {rec ? <>
                  <p className="small dim" style={{ margin: '2px 0' }}>{t(e.codex)}</p>
                  <div className="tiny faint num">Met {rec.seen} · defeated {rec.kills}{e.weakness ? ` · Tip: ${e.weakness}` : ''}</div>
                </> : <p className="small faint">Not yet encountered (chapter {e.chapter}).</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Collection() {
  const s = useGame();
  const [tier, setTier] = useState(0);
  const list = ITEM_LIST.filter((i) => tier === 0 || i.tier === tier);
  return (
    <div className="col">
      <div className="row wrap">
        <button className={`btn small ${tier === 0 ? 'primary' : ''}`} onClick={() => setTier(0)}>All</button>
        {CHAPTERS.map((c) => <button key={c.n} className={`btn small ${tier === c.n ? 'primary' : ''}`} onClick={() => setTier(c.n)}>{c.n}</button>)}
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        {list.map((tpl) => {
          const seen = s.itemsSeen.includes(tpl.id);
          const fake: ItemInstance = { uid: tpl.id, tpl: tpl.id, ilvl: tpl.tier * 100, rarity: tpl.boss ? 'legendary' : 'rare', plus: 0 };
          return seen
            ? <ItemCell key={tpl.id} item={fake} />
            : <Tip key={tpl.id} content={<><h4>Undiscovered</h4><div className="line small">{tpl.boss ? 'Dropped by a chapter boss.' : `Found in chapter ${tpl.tier}.`}</div></>}><span className="itemcell" style={{ opacity: 0.35 }} tabIndex={0} aria-label="Undiscovered item"><Icon k="chest" /></span></Tip>;
        })}
      </div>
      <h3 style={{ marginTop: 10 }}>Sets</h3>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}>
        {Object.values(SETS).map((set) => {
          const got = set.pieces.filter((p) => s.itemsSeen.includes(p)).length;
          return (
            <div key={set.id} className="panel flat">
              <div className="ph"><h4>{set.name}</h4><span className="chip num">{got}/4</span></div>
              {set.bonuses.map((b) => <div key={b.count} className="small dim">({b.count}) {b.desc}</div>)}
              <div className="tiny faint">{set.pieces.map((p) => (s.itemsSeen.includes(p) ? ITEMS[p].name : '???')).join(' · ')}</div>
            </div>
          );
        })}
      </div>
      <div className="small dim">Legendary signature items: <span style={{ color: RARITY_COLOR.legendary }}>{RARITY_NAME.legendary}</span> drops from chapter bosses.</div>
    </div>
  );
}

function Bonds() {
  const s = useGame();
  const [filter, setFilter] = useState<string>('all');
  const [scene, setScene] = useState<{ b: BondDef; i: number } | null>(null);
  const list = BOND_LIST.filter((b) => filter === 'all' || b.a === filter || b.b === filter).filter((b) => s.heroes[b.a].unlocked && s.heroes[b.b].unlocked || filter === 'all' || true);
  return (
    <div className="col">
      <p className="dim small">Heroes who fight together grow closer: +1 per battle, +3 per boss, elite or mini-boss. Each tier unlocks a short scene (skippable); at tier 3 the pair gains a combo skill that fires in battle.</p>
      <div className="row wrap">
        <button className={`btn small ${filter === 'all' ? 'primary' : ''}`} onClick={() => setFilter('all')}>All</button>
        {Object.values(HEROES).map((h) => <button key={h.id} className={`btn small ${filter === h.id ? 'primary' : ''}`} onClick={() => setFilter(h.id)}>{h.name}</button>)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(21rem, 1fr))' }}>
        {list.map((b) => {
          const aff = s.bonds[b.id] ?? 0;
          const tier = bondTier(aff);
          const next = BOND_TIERS[tier] ?? BOND_TIERS[2];
          const prev = tier > 0 ? BOND_TIERS[tier - 1] : 0;
          const both = s.heroes[b.a].unlocked && s.heroes[b.b].unlocked;
          return (
            <div key={b.id} className="panel flat" style={{ opacity: both ? 1 : 0.5 }}>
              <div className="row">
                <HeroPortrait id={b.a} size="sm" /><Icon k="bond" /><HeroPortrait id={b.b} size="sm" />
                <div className="grow"><b>{t(HEROES[b.a].name)} &amp; {t(HEROES[b.b].name)}</b><div className="small dim">Tier {tier}/3 · {aff} affinity</div></div>
              </div>
              <Bar value={tier >= 3 ? 1 : aff - prev} max={tier >= 3 ? 1 : next - prev} kind="gold" label="Bond progress" />
              <div className="small" style={{ margin: '4px 0' }}><b className={tier >= 3 ? 'gold' : 'faint'}>{b.combo.name}</b> <span className="dim">— {b.combo.desc}</span></div>
              <div className="row gap-s">
                {b.scenes.map((_sc, i) => (
                  <button key={i} className="btn small" disabled={tier < i + 1} onClick={() => { setScene({ b, i }); store.mutate((st) => { st.bondSeen[b.id] = Math.max(st.bondSeen[b.id] ?? 0, i + 1); }); }}>
                    {tier >= i + 1 ? <Icon k="book" /> : <Icon k="lock" />} Scene {i + 1}{tier >= i + 1 && (s.bondSeen[b.id] ?? 0) <= i ? ' ✦' : ''}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {scene && <Cutscene title={t(scene.b.scenes[scene.i].title)} chapter={s.age} cast={[scene.b.a, scene.b.b]} lines={scene.b.scenes[scene.i].lines} onClose={() => setScene(null)} />}
    </div>
  );
}

function Records() {
  const s = useGame();
  const hrs = s.playMs / 3600000;
  const rows: [string, string | number][] = [
    ['Current Age', s.age], ['Best campaign floor', s.best], ['Deep Delve best', Math.max(0, s.endless.best - 1000)], ['Ladder rungs cleared', s.ladder.cleared],
    ['Battles won', s.counters.battlesWon ?? 0], ['Battles lost', s.counters.battlesLost ?? 0], ['Enemies defeated', s.counters.kills ?? 0],
    ['Bosses defeated', s.counters.bossKills ?? 0], ['Elites defeated', s.counters.eliteKills ?? 0], ['Flawless victories', s.counters.flawless ?? 0],
    ['Critical hits', s.counters.crits ?? 0], ['Combos fired', s.counters.combosFired ?? 0], ['Expeditions', s.counters.expeditions ?? 0],
    ['Gold earned (all time)', fmt(s.counters.goldEarned ?? 0)], ['Items found', s.counters.itemsFound ?? 0], ['Items salvaged', s.counters.salvaged ?? 0],
    ['Forge upgrades', s.counters.forged ?? 0], ['Events resolved', s.counters.eventsDone ?? 0], ['Trials won', s.counters.challengesWon ?? 0],
    ['Descents', s.counters.descents ?? 0], ['Time played', `${hrs.toFixed(1)} h`],
  ];
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(15rem, 1fr))' }}>
      {rows.map(([k, v]) => <div key={k} className="panel flat row spread"><span className="dim">{k}</span><b className="num gold">{v}</b></div>)}
    </div>
  );
}

function Achievements() {
  const s = useGame();
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}>
      {ACHIEVEMENTS.map((a) => {
        const got = !!s.achievements[a.id];
        const v = Math.min(a.target, metricValue(s, a.metric));
        const hidden = a.secret && !got;
        return (
          <div key={a.id} className="panel flat" style={{ opacity: got ? 1 : 0.7, borderColor: got ? 'var(--gold)' : undefined }}>
            <div className="ph"><h4>{hidden ? '???' : a.title}</h4><span className="chip gold"><Icon k="renown" /> {a.renown}</span></div>
            <div className="small dim">{hidden ? 'A secret.' : a.desc}</div>
            {!got && !hidden && <Bar value={v} max={a.target} label={a.title} />}
            {got && <div className="small good">Unlocked</div>}
          </div>
        );
      })}
    </div>
  );
}
