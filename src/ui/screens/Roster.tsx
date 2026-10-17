import { useEffect, useState } from 'react';
import { BONDS, BOND_TIERS, bondTier } from '../../content/bonds.ts';
import { HEROES, PASSIVES } from '../../content/heroes.ts';
import { SETS } from '../../content/items.ts';
import { RULE_INFO, HERO_IDS } from '../../content/schema.ts';
import type { HeroId, Rule, RuleId, TargetPref } from '../../content/schema.ts';
import { describeSkill } from '../../content/skills.ts';
import { xpToNext } from '../../core/balance.ts';
import { ageLevelCap, buyTalent, canBuyTalent, getItem, respecTalents, setPref, setRules, talentPoints } from '../../core/game.ts';
import { SLOTS, computeHero, heroPower } from '../../core/stats.ts';
import { Bar, HeroPortrait, Icon, ItemCell, Section, StatTable, Tabs, Tip, fmt, Empty, useVisit } from '../components.tsx';
import { t } from '../names.ts';
import { store, useGame } from '../store.ts';
import { sfx } from '../../audio/audio.ts';

type Tab = 'overview' | 'skills' | 'talents' | 'tactics' | 'gear' | 'bonds';

export function RosterScreen() {
  const s = useGame();
  const [id, setId] = useState<HeroId>((store.screenArg as HeroId) in HEROES ? (store.screenArg as HeroId) : 'aragorn');
  const [tab, setTab] = useState<Tab>('overview');
  useEffect(() => { if (store.screenArg && store.screenArg in HEROES) setId(store.screenArg as HeroId); }, []);
  const d = HEROES[id]; const hs = s.heroes[id];
  const pts = talentPoints(s, id);
  return (
    <div className="two" style={{ gridTemplateColumns: 'minmax(0,0.8fr) minmax(0,2.2fr)' }}>
      <div className="col" style={{ gap: 6 }}>
        {HERO_IDS.map((h) => (
          <button key={h} className={`herocard ${s.heroes[h].unlocked ? '' : 'locked'} ${h === id ? 'sel' : ''}`} onClick={() => setId(h)} aria-pressed={h === id}>
            <HeroPortrait id={h} size="sm" />
            <div className="grow"><b>{t(HEROES[h].name)}</b><div className="tiny dim">{s.heroes[h].unlocked ? `Level ${s.heroes[h].level}` : 'Not yet recruited'}</div></div>
            {s.heroes[h].unlocked && talentPoints(s, h).free > 0 && <span className="badge gold" title="Unspent talent points">{talentPoints(s, h).free}</span>}
          </button>
        ))}
      </div>
      <div className="col">
        <div className="panel row" style={{ alignItems: 'flex-start' }}>
          <HeroPortrait id={id} size="lg" ko={!hs.unlocked} />
          <div className="grow">
            <h2>{t(d.name)}</h2>
            <div className="dim">{t(d.title)}</div>
            <p className="small" style={{ margin: '6px 0' }}>{t(d.blurb)}</p>
            {hs.unlocked ? (
              <>
                <div className="row spread small"><span>Level <b className="num gold">{hs.level}</b> / {ageLevelCap(s)}</span><span className="num dim">{hs.level >= ageLevelCap(s) ? 'Level cap for this Age' : `${fmt(hs.xp)} / ${fmt(xpToNext(hs.level))} XP`}</span></div>
                <Bar value={hs.level >= ageLevelCap(s) ? 1 : hs.xp} max={hs.level >= ageLevelCap(s) ? 1 : xpToNext(hs.level)} kind="xp" label="Experience" />
                <div className="small dim" style={{ marginTop: 4 }}>Power <b className="num gold">{fmt(heroPower(computeHero(s, id)))}</b> · talent points <b className="num">{pts.free}</b> free</div>
              </>
            ) : <div className="chip gold">{d.unlock.note}</div>}
          </div>
        </div>
        <Tabs label="Hero details" value={tab} onChange={setTab} tabs={[
          { id: 'overview', label: 'Overview' }, { id: 'skills', label: 'Skills' }, { id: 'talents', label: 'Talents', badge: pts.free > 0 && hs.unlocked ? pts.free : 0 },
          { id: 'tactics', label: 'Tactics' }, { id: 'gear', label: 'Gear' }, { id: 'bonds', label: 'Bonds' },
        ]} />
        {!hs.unlocked ? <Empty>Recruit {d.name} to manage skills, talents and tactics. {d.unlock.note}</Empty> : (
          <>
            {tab === 'overview' && <Overview id={id} />}
            {tab === 'skills' && <Skills id={id} />}
            {tab === 'talents' && <Talents id={id} />}
            {tab === 'tactics' && <Tactics id={id} />}
            {tab === 'gear' && <Gear id={id} />}
            {tab === 'bonds' && <HeroBonds id={id} />}
          </>
        )}
      </div>
    </div>
  );
}

function Overview({ id }: { id: HeroId }) {
  const s = useGame();
  const c = computeHero(s, id);
  const base = computeHero({ ...s, inventory: [], heroes: { ...s.heroes, [id]: { ...s.heroes[id], equip: { weapon: null, armour: null, offhand: null, accessory1: null, accessory2: null }, talents: [] } }, relics: { light: 0, horn: 0, wisdom: 0, blessing: 0, fortune: 0, courage: 0 }, camp: { age: {}, account: {} } }, id).stats;
  const sets = Object.entries(c.setCounts).filter(([, n]) => n >= 2);
  return (
    <div className="two">
      <Section title="Stats" right={<span className="small dim">green = bonus over level alone</span>}><StatTable stats={c.stats} compare={base} /></Section>
      <div className="col">
        <Section title="Passive"><b className="gold">{PASSIVES[HEROES[id].passive].name}</b><div className="small dim">{PASSIVES[HEROES[id].passive].desc}</div></Section>
        <Section title="Bonuses in effect">
          <div className="small col" style={{ gap: 3 }}>
            {c.healBonus > 0 && <div>Healing power <b className="gold">+{(c.healBonus * 100).toFixed(0)}%</b></div>}
            {c.lifesteal > 0 && <div>Life steal <b className="gold">{(c.lifesteal * 100).toFixed(0)}%</b></div>}
            {c.thorns > 0 && <div>Thorns <b className="gold">{(c.thorns * 100).toFixed(0)}%</b></div>}
            <div>Gold find <b className="gold">+{(c.goldBonus * 100).toFixed(0)}%</b> · experience <b className="gold">+{(c.xpBonus * 100).toFixed(0)}%</b></div>
            {sets.map(([sid, n]) => <div key={sid}><b className="gold">{SETS[sid].name}</b> ({n} pieces): {SETS[sid].bonuses.filter((b) => n >= b.count).map((b) => b.desc).join(' · ')}</div>)}
            {c.passives.filter((p) => p.kind !== 'stat').length > 0 && <div className="dim">{c.passives.length} special effect{c.passives.length === 1 ? '' : 's'} from passives, talents and gear.</div>}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Skills({ id }: { id: HeroId }) {
  const s = useGame();
  const c = computeHero(s, id);
  const all = [c.basic, ...c.skills];
  return (
    <div className="col">
      {all.map((sk, i) => (
        <div key={sk.id} className="skillrow">
          <div className="skillicon"><Icon k={sk.icon} /></div>
          <div className="grow">
            <div className="row spread"><b>{t(sk.name)}</b><span className="chip">{i === 0 ? 'Basic' : sk.tags.includes('ultimate') ? 'Ultimate' : `Skill ${i}`}{sk.cd > 0 ? ` · CD ${sk.cd}` : ''}</span></div>
            <div className="small dim" style={{ fontStyle: 'italic' }}>{t(sk.desc)}</div>
            <ul className="small" style={{ margin: '4px 0 0', paddingLeft: '1.1rem' }}>{describeSkill(sk).map((l, j) => <li key={j}>{l}</li>)}</ul>
          </div>
        </div>
      ))}
      <div className="skillrow"><div className="skillicon"><Icon k="star" /></div><div><b className="gold">{PASSIVES[HEROES[id].passive].name}</b> <span className="chip">Passive</span><div className="small dim">{PASSIVES[HEROES[id].passive].desc}</div></div></div>
    </div>
  );
}

function Talents({ id }: { id: HeroId }) {
  const s = useGame();
  const d = HEROES[id]; const hs = s.heroes[id];
  const pts = talentPoints(s, id);
  return (
    <div className="col">
      <div className="row spread wrap">
        <span>Talent points: <b className="num gold">{pts.free}</b> free of {pts.total} (1 per level above 1)</span>
        <button className="btn small" disabled={!hs.talents.length} onClick={() => { store.mutate((st) => respecTalents(st, id)); store.toast('Talents reset — all points refunded', 'info', 'star'); }}>Respec (free)</button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))' }}>
        {d.talents.map((tl, i) => {
          const owned = hs.talents.includes(i);
          const can = canBuyTalent(s, id, i);
          return (
            <button key={tl.id} className={`talent ${owned ? 'owned' : can.ok ? 'avail' : ''}`} disabled={owned || !can.ok} onClick={() => { store.mutate((st) => buyTalent(st, id, i)); sfx.confirm(); }} aria-label={`${tl.name}. ${tl.desc}. Cost ${tl.cost}.${owned ? ' Learned.' : can.ok ? '' : ` ${can.why}`}`}>
              <div className="row spread"><b>{owned && <Icon k="check" color="var(--gold2)" />} {t(tl.name)}</b><span className="chip num">{tl.cost} pt</span></div>
              <div className="small dim">{t(tl.desc)}</div>
              {tl.requires.length > 0 && <div className="tiny faint">Requires: {tl.requires.map((r) => d.talents[r].name).join(' + ')}</div>}
              {!owned && !can.ok && <div className="tiny bad">{can.why}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ruleApplicable(id: HeroId, _rule: RuleId): boolean {
  const skills = [HEROES[id].basic, ...HEROES[id].skills];
  void skills;
  const c = HEROES[id];
  const tags = c.skills.map((sid) => sid);
  void tags;
  return true;
}

const PREFS: { id: TargetPref; label: string; desc: string }[] = [
  { id: 'default', label: 'Weakest foe', desc: 'Finish off the enemy with the least health first.' },
  { id: 'lowest-hp', label: 'Lowest health %', desc: 'Target the enemy closest to death by percentage.' },
  { id: 'highest-atk', label: 'Most dangerous', desc: 'Target the enemy with the highest attack or magic.' },
  { id: 'back-row', label: 'Back row first', desc: 'Reach for archers and casters when possible.' },
  { id: 'marked-first', label: 'Marked first', desc: 'Always go for a marked enemy.' },
];

function Tactics({ id }: { id: HeroId }) {
  const s = useGame();
  useVisit('visitedTactics');
  const hs = s.heroes[id];
  const rules = hs.rules;
  const update = (next: Rule[]) => store.mutate((st) => setRules(st, id, next));
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= rules.length) return; const n = rules.map((r) => ({ ...r })); [n[i], n[j]] = [n[j], n[i]]; update(n); };
  const unused = (Object.keys(RULE_INFO) as RuleId[]).filter((r) => !rules.some((x) => x.id === r));
  return (
    <div className="col">
      <p className="small dim">Each turn, {HEROES[id].name} walks this list from top to bottom and takes the first action that applies. Everything is logged with the rule that fired. Reorder, switch off or adjust thresholds to taste.</p>
      <div className="col" style={{ gap: 4 }}>
        {rules.map((r, i) => {
          const info = RULE_INFO[r.id];
          return (
            <div key={r.id} className={`rulerow ${r.enabled ? '' : 'off'}`}>
              <b className="num dim" style={{ width: '1.4rem' }}>{i + 1}</b>
              <label className="check grow">
                <input type="checkbox" checked={r.enabled} onChange={(e) => update(rules.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))} aria-label={`Enable ${info.label}`} />
                <span><b>{info.label}</b><span className="small dim"> — {info.desc}</span></span>
              </label>
              {info.param && (
                <label className="small row gap-s" style={{ minWidth: '9rem' }}>
                  <input type="range" min={info.param.min} max={info.param.max} step={info.param.step} value={r.param ?? info.param.def} onChange={(e) => update(rules.map((x, j) => (j === i ? { ...x, param: Number(e.target.value) } : x)))} aria-label={`${info.label} threshold`} />
                  <span className="num">{r.param ?? info.param.def}{info.param.unit.startsWith('%') ? '%' : ''}</span>
                </label>
              )}
              <button className="btn small icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><Icon k="buff" /></button>
              <button className="btn small icon" onClick={() => move(i, 1)} disabled={i === rules.length - 1} aria-label="Move down"><Icon k="debuff" /></button>
              <button className="btn small icon" onClick={() => update(rules.filter((_, j) => j !== i))} aria-label="Remove rule"><Icon k="close" /></button>
            </div>
          );
        })}
      </div>
      {unused.length > 0 && (
        <div className="row">
          <select aria-label="Add a rule" defaultValue="" onChange={(e) => { if (e.target.value) { update([...rules, { id: e.target.value as RuleId, enabled: true, param: RULE_INFO[e.target.value as RuleId].param?.def }]); e.target.value = ''; } }}>
            <option value="">Add a rule…</option>{unused.map((r) => <option key={r} value={r}>{RULE_INFO[r].label}</option>)}
          </select>
          <button className="btn small ghost" onClick={() => update(HEROES[id].defaultRules.map((r) => ({ ...r })))}>Reset to default</button>
        </div>
      )}
      <Section title="Target preference">
        <div className="row wrap">{PREFS.map((p) => <Tip key={p.id} content={<div>{p.desc}</div>}><button className={`btn small ${hs.pref === p.id ? 'primary' : ''}`} onClick={() => store.mutate((st) => setPref(st, id, p.id))} aria-pressed={hs.pref === p.id}>{p.label}</button></Tip>)}</div>
        <p className="tiny dim" style={{ marginTop: 6 }}>Taunting enemies and the row rule always take priority: melee skills cannot reach the back row while the front stands.</p>
      </Section>
    </div>
  );
}
void ruleApplicable;

function Gear({ id }: { id: HeroId }) {
  const s = useGame();
  return (
    <div className="col">
      <div className="row wrap" style={{ gap: 12 }}>
        {SLOTS.map((sl) => { const it = getItem(s, s.heroes[id].equip[sl]); return <div key={sl} className="col" style={{ alignItems: 'center', gap: 2 }}><span className="tiny faint">{sl.startsWith('acc') ? 'Accessory' : sl}</span>{it ? <ItemCell item={it} /> : <span className="itemcell" style={{ opacity: 0.4 }}><Icon k="chest" /></span>}</div>; })}
      </div>
      <button className="btn" onClick={() => store.go('armoury', id)}><Icon k="armour" /> Manage gear in the Armoury</button>
    </div>
  );
}

function HeroBonds({ id }: { id: HeroId }) {
  const s = useGame();
  const list = Object.values(BONDS).filter((b) => b.a === id || b.b === id);
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}>
      {list.map((b) => {
        const other = b.a === id ? b.b : b.a;
        const aff = s.bonds[b.id] ?? 0; const tier = bondTier(aff);
        return (
          <div key={b.id} className="panel flat row" style={{ opacity: s.heroes[other].unlocked ? 1 : 0.5 }}>
            <HeroPortrait id={other} size="sm" />
            <div className="grow"><b>{t(HEROES[other].name)}</b> <span className="chip">Tier {tier}</span>
              <div className="tiny dim">{aff}/{BOND_TIERS[Math.min(2, tier)]} affinity · <span className={tier >= 3 ? 'gold' : ''}>{b.combo.name}</span></div></div>
          </div>
        );
      })}
    </div>
  );
}
