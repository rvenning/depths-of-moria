import { useEffect, useMemo, useRef, useState } from 'react';
import { CAMP_H, CAMP_SPOTS, CAMP_W, paintCamp } from '../../art/camp.ts';
import { CAMP_UPGRADES } from '../../content/camp.ts';
import { CHAPTER_BY_N } from '../../content/chapters.ts';
import { HEROES } from '../../content/heroes.ts';
import { HERO_IDS } from '../../content/schema.ts';
import type { HeroId } from '../../content/schema.ts';
import { descendAge, descentPreview } from '../../core/expedition.ts';
import {
  autoEquipAll, buyCamp, buyShopItem, buySupplies, campCost, merchantPrice, refreshShop, shopRerollCost, suppliesCap, SUPPLY_COST,
  trainCost, trainHero, ageLevelCap, talentPoints,
} from '../../core/game.ts';
import { claimableQuests } from '../../core/meta.ts';
import { formation, maxChapterReached } from '../../core/party.ts';
import { xpToNext } from '../../core/balance.ts';
import { Bar, HeroPortrait, Icon, ItemCell, Modal, Section, Tabs, Tip, fmt, ItemTip } from '../components.tsx';
import { t } from '../names.ts';
import { store, useGame } from '../store.ts';
import { sfx } from '../../audio/audio.ts';
import { newBondScenes } from './Journal.tsx';

const HOT: { id: string; label: string; icon: string; screen: 'map' | 'roster' | 'armoury' | 'forge' | 'shrine' | 'journal' | 'quests' }[] = [
  { id: 'map', label: 'Descend', icon: 'map', screen: 'map' },
  { id: 'roster', label: 'Heroes', icon: 'hero', screen: 'roster' },
  { id: 'armoury', label: 'Armoury', icon: 'armour', screen: 'armoury' },
  { id: 'forge', label: 'Forge', icon: 'anvil', screen: 'forge' },
  { id: 'shrine', label: 'Relic Shrine', icon: 'shrine', screen: 'shrine' },
  { id: 'journal', label: 'Journal', icon: 'book', screen: 'journal' },
  { id: 'quests', label: 'Quest Board', icon: 'scroll', screen: 'quests' },
];

export function CampScreen() {
  const s = useGame();
  const ref = useRef<HTMLCanvasElement>(null);
  const [tab, setTab] = useState<'facilities' | 'merchant' | 'training' | 'legacy' | 'guide'>('facilities');
  const [showDescent, setShowDescent] = useState(false);
  const ids = useMemo(() => formation(s).map((f) => f.id), [s.party, s.heroes, s.age]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = ref.current; if (!c) return;
    c.width = CAMP_W; c.height = CAMP_H;
    c.getContext('2d')?.drawImage(paintCamp(s.age, ids), 0, 0);
  }, [s.age, ids]);

  const preview = descentPreview(s);
  const canDescend = preview.canDescend;
  const quests = claimableQuests(s);
  const scenes = newBondScenes(s);
  const talentHeroes = HERO_IDS.filter((h) => s.heroes[h].unlocked && talentPoints(s, h).free > 0 && ageLevelCap(s) > 0);
  const ch = CHAPTER_BY_N(s.age);

  return (
    <div className="col gap-l">
      {s.flags.prologue === 0 && <Prologue />}
      <div className="two" style={{ gridTemplateColumns: 'minmax(0,1.9fr) minmax(0,1fr)' }}>
        <div className="camp">
          <div className="scene">
            <canvas ref={ref} aria-hidden="true" />
            <div className="fire-glow" style={{ position: 'absolute', left: '50%', top: '86%', width: '34%', height: '34%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(255,150,50,0.35), transparent 70%)', animation: s.settings.reducedMotion ? undefined : 'flicker 1.6s infinite alternate', pointerEvents: 'none' }} />
            {HOT.map((h) => {
              const sp = CAMP_SPOTS[h.id];
              const locked = h.id === 'forge' && maxChapterReached(s) < 3;
              return (
                <button key={h.id} className="hot" style={{ left: `${sp.x * 100}%`, top: `${sp.y * 100}%` }} onClick={() => store.go(h.screen)} aria-label={h.label + (locked ? ' (locked)' : '')}>
                  <Icon k={locked ? 'lock' : h.icon} /> <span className="hotlbl">{h.label}</span>
                  {h.id === 'quests' && quests > 0 && <span className="badge gold">{quests}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="col">
          <Section title={`${t(ch.name)} — Age ${s.age}`} right={<span className="chip">Best {s.best}</span>}>
            <p className="dim small">{t(ch.blurb)}</p>
            <div className="small"><b className="gold">{ch.shadow.name}:</b> <span className="dim">{ch.shadow.desc}</span></div>
            <hr className="hr" />
            <div className="row wrap">
              {ids.map((id) => (
                <Tip key={id} content={<><h4>{HEROES[id].name}</h4><div className="line">{HEROES[id].title} · level {s.heroes[id].level}/{ageLevelCap(s)}</div></>}>
                  <button className="herocard" style={{ width: 'auto', padding: 4 }} onClick={() => store.go('roster', id)} aria-label={`${HEROES[id].name}, level ${s.heroes[id].level}`}>
                    <HeroPortrait id={id} size="sm" /><span className="small num">Lv {s.heroes[id].level}</span>
                  </button>
                </Tip>
              ))}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary big grow" onClick={() => store.go('map')}><Icon k="map" /> Launch expedition</button>
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn grow" onClick={() => { const n = store.mutate((st) => autoEquipAll(st)); store.toast(n ? `Equipped ${n} better item${n === 1 ? '' : 's'}` : 'Everyone is already well equipped', 'good', 'armour'); }}><Icon k="armour" /> Auto-equip all</button>
              <button className="btn grow" onClick={() => store.go('party')}><Icon k="party" /> Party</button>
            </div>
          </Section>
          {!s.flags.tourDone && <FirstSteps />}
          {(canDescend || quests > 0 || talentHeroes.length > 0 || scenes > 0) && (
            <Section title="Needs attention">
              <div className="col" style={{ gap: 6 }}>
                {canDescend && <button className="btn primary" onClick={() => setShowDescent(true)}><Icon k="door" /> The way down is open — descend to Age {preview.nextAge}</button>}
                {quests > 0 && <button className="btn" onClick={() => store.go('quests')}><Icon k="scroll" /> {quests} quest reward{quests === 1 ? '' : 's'} to claim</button>}
                {talentHeroes.length > 0 && <button className="btn" onClick={() => store.go('roster', talentHeroes[0])}><Icon k="star" /> Unspent talent points: {talentHeroes.map((h) => HEROES[h].name).join(', ')}</button>}
                {scenes > 0 && <button className="btn" onClick={() => store.go('journal', 'bonds')}><Icon k="bond" /> {scenes} new bond scene{scenes === 1 ? '' : 's'}</button>}
              </div>
            </Section>
          )}
        </div>
      </div>

      <div>
        <Tabs label="Camp services" value={tab} onChange={setTab} tabs={[
          { id: 'facilities', label: 'Facilities' }, { id: 'merchant', label: 'Merchant' }, { id: 'training', label: 'Training & supplies' },
          { id: 'legacy', label: 'Legacy' }, { id: 'guide', label: 'How to play' },
        ]} />
        {tab === 'facilities' && <Facilities />}
        {tab === 'merchant' && <Merchant />}
        {tab === 'training' && <Training />}
        {tab === 'legacy' && <Legacy />}
        {tab === 'guide' && <Guide />}
      </div>
      {showDescent && <DescentModal onClose={() => setShowDescent(false)} />}
    </div>
  );
}

function FirstSteps() {
  const s = useGame();
  const steps: { label: string; done: boolean; go?: () => void }[] = [
    { label: 'Launch your first expedition', done: (s.counters.expeditions ?? 0) > 0, go: () => store.go('map') },
    { label: 'Reach floor 10 — someone is waiting in the dark', done: s.best >= 10, go: () => store.go('map') },
    { label: 'Equip your loot: Armoury → Auto-equip', done: !!s.flags.visitedArmoury, go: () => store.go('armoury') },
    { label: 'Spend gold on a camp facility', done: Object.values(s.camp.age).some((l) => l > 0) },
    { label: 'Tune a hero’s tactics: Heroes → Tactics', done: !!s.flags.visitedTactics, go: () => store.go('roster') },
    { label: 'Put essence into a relic at the Shrine', done: (s.counters.relicLevels ?? 0) > 0, go: () => store.go('shrine') },
    { label: 'Defeat the Gate Warden on floor 100', done: s.best >= 100, go: () => store.go('map') },
  ];
  const done = steps.filter((x) => x.done).length;
  return (
    <Section title={`First steps (${done}/${steps.length})`} right={<button className="btn small ghost" onClick={() => store.mutate((st) => { st.flags.tourDone = 1; })}>Dismiss</button>}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="col">
        {steps.map((x, i) => (
          <li key={i} className="row small" style={{ opacity: x.done ? 0.55 : 1 }}>
            <Icon k={x.done ? 'check' : 'chevron'} color={x.done ? 'var(--good)' : 'var(--gold)'} />
            {x.go && !x.done ? <button className="btn small ghost" style={{ padding: '0 0.4rem', minHeight: '1.6rem' }} onClick={x.go}>{x.label}</button> : <span>{x.label}</span>}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Prologue() {
  const [page, setPage] = useState(0);
  const pages = [
    { h: 'A road into the dark', p: 'Beneath the mountain lies a labyrinth older than any map: a thousand floors, in ten great Ages of descent. A small company stands at the West-gate. You lead it.' },
    { h: 'How a delve works', p: 'Choose a party, then descend floor by floor. Battles play out on their own: your heroes follow the priority rules you set. Gold, gear and relic essence flow back to camp — whether you retreat in good order or are carried out.' },
    { h: 'Growing stronger', p: 'Gear your heroes in the Armoury, spend gold on camp facilities, raise the Relics with essence you earn from elites and bosses, and learn talents as heroes level. Bonds between heroes unlock stories and combo skills.' },
    { h: 'The Ages', p: 'Each time a chapter boss falls you may descend into the next, harder Age. Gold and ordinary gear reset, but heroes, relics, lore and legendary items stay with you. You will always be shown what is kept before you confirm.' },
  ];
  const p = pages[page];
  return (
    <Modal label="Prologue">
      <h2>{p.h}</h2>
      <p style={{ fontSize: '1.15rem' }}>{p.p}</p>
      <div className="row spread">
        <span className="dim small">{page + 1} / {pages.length}</span>
        <div className="row">
          {page < pages.length - 1 ? <button className="btn primary" onClick={() => setPage(page + 1)} autoFocus>Next</button>
            : <button className="btn primary" onClick={() => store.mutate((s) => { s.flags.prologue = 1; }, 'now')} autoFocus>To the camp</button>}
          <button className="btn ghost" onClick={() => store.mutate((s) => { s.flags.prologue = 1; }, 'now')}>Skip</button>
        </div>
      </div>
    </Modal>
  );
}

function Facilities() {
  const s = useGame();
  const list = CAMP_UPGRADES.filter((u) => u.kind === 'age');
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}>
      {list.map((u) => {
        const lvl = s.camp.age[u.id] ?? 0;
        const cost = campCost(s, u.id);
        return (
          <div key={u.id} className="panel flat">
            <div className="ph"><h4>{u.name}</h4><span className="chip num">Lv {lvl}/{u.maxLevel}</span></div>
            <p className="small dim">{u.desc}</p>
            <div className="small">Now: <b className="gold">+{(lvl * u.perLevel).toFixed(u.perLevel % 1 ? 1 : 0)}{u.unit}</b></div>
            <Bar value={lvl} max={u.maxLevel} kind="gold" label={`${u.name} level`} />
            <div className="row spread" style={{ marginTop: 6 }}>
              <span className="small dim">{cost === null ? 'Maxed' : `Next: +${u.perLevel}${u.unit}`}</span>
              <button className="btn small primary" disabled={cost === null || s.gold < cost} onClick={() => { if (store.mutate((st) => buyCamp(st, u.id))) sfx.coin(); }}>
                <Icon k="coin" /> {cost === null ? '—' : fmt(cost)}
              </button>
            </div>
          </div>
        );
      })}
      <div className="panel flat dim small">Facilities are rebuilt each Age: when you descend, the camp moves on and these reset. They are paid in gold, which also resets. Anything marked <b className="gold">Legacy</b> stays.</div>
    </div>
  );
}

function Merchant() {
  const s = useGame();
  useEffect(() => { if (s.shop.stock.length === 0) store.mutate((st) => refreshShop(st, true)); }, [s.shop.stock.length]);
  return (
    <div className="col">
      <div className="row spread wrap">
        <p className="dim small">A travelling merchant sells gear suited to this Age. Stock changes when you reroll or descend.</p>
        <button className="btn small" disabled={s.gold < shopRerollCost(s)} onClick={() => store.mutate((st) => { st.gold -= shopRerollCost(st); refreshShop(st); })}><Icon k="coin" /> {fmt(shopRerollCost(s))} — new stock</button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))' }}>
        {s.shop.stock.map((it) => {
          const price = merchantPrice(s, it);
          return (
            <div key={it.uid} className="panel flat row">
              <ItemCell item={it} />
              <div className="grow"><ItemTip item={it} /></div>
              <button className="btn small primary" disabled={s.gold < price} onClick={() => { if (store.mutate((st) => buyShopItem(st, it.uid))) sfx.coin(); }}><Icon k="coin" /> {fmt(price)}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Training() {
  const s = useGame();
  const cap = ageLevelCap(s);
  return (
    <div className="two">
      <Section title="Training Yard" right={<span className="small dim">Level cap this Age: {cap}</span>}>
        <p className="small dim">Pay gold for instant experience. Heroes also learn from every battle.</p>
        <div className="col" style={{ gap: 6 }}>
          {HERO_IDS.filter((h) => s.heroes[h].unlocked).map((h) => {
            const hs = s.heroes[h];
            const cost = trainCost(s, h);
            return (
              <div key={h} className="row">
                <HeroPortrait id={h} size="sm" />
                <div className="grow"><b>{HEROES[h].name}</b> <span className="num dim small">Lv {hs.level}/{cap}</span>
                  <Bar value={hs.level >= cap ? 1 : hs.xp} max={hs.level >= cap ? 1 : xpToNext(hs.level)} kind="xp" label={`${HEROES[h].name} experience`} /></div>
                <button className="btn small" disabled={hs.level >= cap || s.gold < cost} onClick={() => { const ups = store.mutate((st) => trainHero(st, h)); if (ups.length) { sfx.levelUp(); store.toast(`${HEROES[h].name} reaches level ${ups[ups.length - 1]}`, 'good', 'star'); } }}><Icon k="coin" /> {fmt(cost)}</button>
              </div>
            );
          })}
        </div>
      </Section>
      <Section title="Supplies">
        <p className="small dim">Supplies are used automatically when a hero drops below 35% health between floors (+40% health).</p>
        <div className="row spread"><span>In the pack: <b className="num gold">{s.counters.supplies ?? 0}</b> / {suppliesCap(s)}</span>
          <button className="btn primary" disabled={(s.counters.supplies ?? 0) >= suppliesCap(s) || s.gold < SUPPLY_COST(s)} onClick={() => { if (store.mutate((st) => buySupplies(st, 1))) sfx.coin(); }}><Icon k="supplies" /> Buy one — <Icon k="coin" /> {fmt(SUPPLY_COST(s))}</button></div>
        <div className="row" style={{ marginTop: 8 }}><button className="btn" onClick={() => store.mutate((st) => buySupplies(st, 20))}>Fill the pack</button></div>
      </Section>
    </div>
  );
}

function Legacy() {
  const s = useGame();
  const list = CAMP_UPGRADES.filter((u) => u.kind === 'account');
  return (
    <div className="col">
      <p className="dim small">Legacy upgrades are paid in <b className="gold">renown</b> (from quests, achievements and first victories) and are never lost when you descend.</p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}>
        {list.map((u) => {
          const lvl = s.camp.account[u.id] ?? 0;
          const cost = campCost(s, u.id);
          return (
            <div key={u.id} className="panel flat">
              <div className="ph"><h4>{u.name}</h4><span className="chip num">{lvl}/{u.maxLevel}</span></div>
              <p className="small dim">{u.desc}</p>
              <div className="row spread">
                <span className="small dim">{u.perLevel && u.unit ? `Per level: +${u.perLevel}${u.unit}` : ''}</span>
                <button className="btn small primary" disabled={cost === null || s.renown < cost} onClick={() => { if (store.mutate((st) => buyCamp(st, u.id))) sfx.confirm(); }}>
                  <Icon k="renown" /> {cost === null ? 'Owned' : fmt(cost)}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Guide() {
  return (
    <div className="two">
      <Section title="The loop">
        <ol className="small" style={{ lineHeight: 1.6, paddingLeft: '1.2rem' }}>
          <li><b>Camp:</b> choose up to five heroes, equip them, tune their tactics.</li>
          <li><b>Delve:</b> pick a checkpoint and launch. Battles are automatic; you set speed, pause, retreat, or let auto-delve run.</li>
          <li><b>Return:</b> bank your rewards. Defeat costs you 40% of gold and materials — nothing else.</li>
          <li><b>Grow:</b> spend gold at the camp, ore &amp; cloth at the forge (from Age 3), essence on relics, talent points on heroes.</li>
          <li><b>Descend:</b> beat the chapter boss to open the next, harder Age.</li>
        </ol>
      </Section>
      <Section title="Tips">
        <ul className="small" style={{ lineHeight: 1.6, paddingLeft: '1.2rem' }}>
          <li>Hover (or focus) anything for a tooltip. Skills and items show exact numbers.</li>
          <li>Open <b>Heroes → Tactics</b> to reorder priority rules: heal thresholds, focus marked targets, area skills on 3+ enemies.</li>
          <li>Front-row heroes take melee hits first; archers and mages in the back row are safe until the front falls.</li>
          <li>Space pauses; 1/2/3 sets speed; S skips a battle; A toggles auto-delve; L toggles the log.</li>
          <li>Lock items you want to keep as <b>heirlooms</b> through an Age change.</li>
        </ul>
      </Section>
    </div>
  );
}

function DescentModal({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const p = descentPreview(s);
  const next = CHAPTER_BY_N(p.nextAge);
  const [busy, setBusy] = useState(false);
  return (
    <Modal label={`Descend into Age ${p.nextAge}`} onClose={onClose} wide>
      <h2>Descend into Age {p.nextAge}: {t(next.name)}</h2>
      <p className="dim">{t(next.blurb)}</p>
      <div className="two">
        <div className="panel flat">
          <h3 className="bad">Left behind</h3>
          <ul className="small" style={{ lineHeight: 1.6, paddingLeft: '1.2rem' }}>
            <li>Gold: <b className="num">{fmt(p.loses.gold)}</b>{p.purse > 0 ? <> (you begin with a purse of <b className="num gold">{fmt(p.purse)}</b>)</> : null}</li>
            <li>Ore and cloth: <b className="num">{fmt(p.loses.ore)}</b> / <b className="num">{fmt(p.loses.cloth)}</b></li>
            <li>Ordinary gear: <b className="num">{p.loses.items}</b> item{p.loses.items === 1 ? '' : 's'} (lock up to {p.heirlooms} heirloom{p.heirlooms === 1 ? '' : 's'} first)</li>
            <li>Camp facilities: {p.loses.campUpgrades} level{p.loses.campUpgrades === 1 ? '' : 's'} (rebuilt in the new Age)</li>
          </ul>
        </div>
        <div className="panel flat">
          <h3 className="good">Carried forward</h3>
          <ul className="small" style={{ lineHeight: 1.6, paddingLeft: '1.2rem' }}>
            {p.keeps.map((k) => <li key={k}>{k}</li>)}
            <li>Hero level cap rises from {p.levelCapFrom} to <b className="gold">{p.levelCapTo}</b></li>
          </ul>
        </div>
      </div>
      <div className="inset small" style={{ margin: '0.6rem 0' }}><b className="gold">New twist — {p.newShadow}:</b> {next.shadow.desc}</div>
      <p className="small dim">Every hero receives a fresh starter kit of the new Age. Legendaries and locked heirlooms stay in the armoury.</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Not yet</button>
        <button className="btn primary big" disabled={busy} onClick={() => {
          setBusy(true);
          store.mutate((st) => { descendAge(st); autoEquipAll(st); }, 'now');
          sfx.confirm(); store.toast(`Age ${p.nextAge} begins`, 'good', 'door'); onClose();
        }}>Descend into Age {p.nextAge}</button>
      </div>
    </Modal>
  );
}

export type { HeroId };
