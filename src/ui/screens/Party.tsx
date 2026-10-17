import { useState } from 'react';
import { HEROES } from '../../content/heroes.ts';
import { BONDS, bondId, bondTier } from '../../content/bonds.ts';
import { HERO_IDS } from '../../content/schema.ts';
import type { HeroId } from '../../content/schema.ts';
import { loadPreset, presetSlots, savePreset, setParty, ageLevelCap } from '../../core/game.ts';
import { activeCombos, featureUnlocked, formation } from '../../core/party.ts';
import { computeHero, heroPower } from '../../core/stats.ts';
import { HeroPortrait, Icon, Section, fmt } from '../components.tsx';
import { t } from '../names.ts';
import { store, useGame } from '../store.ts';

const ROLE_NOTE: Record<string, string> = { ranger: 'Hybrid', bruiser: 'Front-line damage', scout: 'Evasive support', archer: 'Back-line damage', protector: 'Tank', healer: 'Healer', mage: 'Control & burst' };

export function PartyScreen() {
  const s = useGame();
  const manual = featureUnlocked(s, 'formation');
  const [picked, setPicked] = useState<HeroId | null>(null);
  const form = formation(s);
  const inParty = new Set(form.map((f) => f.id));
  const power = form.reduce((a, f) => a + heroPower(computeHero(s, f.id)), 0);
  const combos = activeCombos(s, form.map((f) => f.id));
  const hasHealer = form.some((f) => ['healer'].includes(HEROES[f.id].role));
  const hasTank = form.some((f) => ['protector', 'bruiser', 'ranger'].includes(HEROES[f.id].role));
  const slots = s.party;

  const place = (slot: number) => {
    if (!picked) { const cur = slots[slot]; if (cur) setPicked(cur); return; }
    store.mutate((st) => {
      const next = [...st.party];
      const from = next.indexOf(picked);
      const displaced = next[slot];
      next[slot] = picked;
      if (from >= 0) next[from] = displaced ?? null;
      setParty(st, next);
    });
    setPicked(null);
  };
  const toggleAuto = (h: HeroId) => {
    store.mutate((st) => {
      const cur = st.party.filter((x): x is HeroId => !!x);
      const next = cur.includes(h) ? cur.filter((x) => x !== h) : cur.length >= 5 ? cur : [...cur, h];
      setParty(st, [...next, null, null, null, null, null].slice(0, 5) as (HeroId | null)[]);
    });
  };

  return (
    <div className="two" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)' }}>
      <Section title="Heroes" right={<span className="small dim">{inParty.size}/5 in the party</span>}>
        <div className="col" style={{ gap: 6 }}>
          {HERO_IDS.map((h) => {
            const hs = s.heroes[h]; const d = HEROES[h];
            const inP = inParty.has(h);
            return (
              <button key={h} className={`herocard ${hs.unlocked ? '' : 'locked'} ${picked === h ? 'sel' : ''}`} disabled={!hs.unlocked}
                aria-pressed={manual ? picked === h : inP}
                onClick={() => (manual ? setPicked(picked === h ? null : h) : toggleAuto(h))}>
                <HeroPortrait id={h} size="md" />
                <div className="grow">
                  <div className="row spread"><b>{t(d.name)}</b>{inP && <span className="chip good">In party</span>}</div>
                  <div className="small dim">{t(d.title)} · {ROLE_NOTE[d.role]}</div>
                  {hs.unlocked ? <div className="small num">Level {hs.level}/{ageLevelCap(s)} · power {fmt(heroPower(computeHero(s, h)))}</div> : <div className="small gold">{d.unlock.note}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </Section>
      <div className="col">
        <Section title="Formation" right={<span className="chip gold num">Power {fmt(power)}</span>}>
          {!manual && <p className="small dim">Formation tactics unlock in <b className="gold">The Endless Stair</b> (Age 4). Until then, heroes line up automatically by role: bruisers and protectors in front, archers, healers and mages behind. Click heroes on the left to add or remove them.</p>}
          {manual && <p className="small dim">Front-row heroes take melee blows first; back-row heroes are only hit by ranged and magic attacks until the front falls. {picked ? <b className="gold">Choose a slot for {HEROES[picked].name}.</b> : 'Select a hero, then a slot. Click a filled slot to pick that hero up.'}</p>}
          <div className="small dim" style={{ margin: '6px 0 2px' }}>Front row</div>
          <div className="slotboard">
            {[0, 1, 2].map((i) => <SlotView key={i} i={i} hero={manual ? slots[i] : form.find((f) => f.slot === i)?.id ?? null} manual={manual} picked={!!picked} onPlace={place} />)}
          </div>
          <div className="small dim" style={{ margin: '8px 0 2px' }}>Back row</div>
          <div className="slotboard" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {[3, 4].map((i) => <SlotView key={i} i={i} hero={manual ? slots[i] : form.find((f) => f.slot === i)?.id ?? null} manual={manual} picked={!!picked} onPlace={place} back />)}
          </div>
          {manual && picked && <div className="row" style={{ marginTop: 8 }}><button className="btn small" onClick={() => { store.mutate((st) => setParty(st, st.party.map((x) => (x === picked ? null : x)))); setPicked(null); }}>Remove {HEROES[picked].name} from the party</button></div>}
          <hr className="hr" />
          <div className="row wrap">
            {!hasTank && <span className="chip bad"><Icon k="shield" /> No front-line hero</span>}
            {!hasHealer && form.length >= 3 && <span className="chip warn" style={{ color: 'var(--warn)' }}><Icon k="heal" /> No healer — supplies matter</span>}
            {form.length === 0 && <span className="chip bad">Choose at least one hero</span>}
          </div>
        </Section>
        <Section title="Fellowship combos">
          {combos.length === 0 ? <p className="small dim">No combos active. Pairs of heroes reach tier 3 after many battles together — see Journal → Bonds.</p> : (
            <div className="col" style={{ gap: 4 }}>
              {combos.map((c) => <div key={c.name} className="small"><b className="gold">{c.name}</b> <span className="dim">({HEROES[c.a].name} &amp; {HEROES[c.b].name}) — {BONDS[bondId(c.a, c.b)].combo.desc}</span></div>)}
              {!featureUnlocked(s, 'combos') && <p className="tiny dim">Only one combo can be active until Combo Mastery (Age 8).</p>}
            </div>
          )}
          <div className="tiny faint">Closest pairs: {Object.entries(s.bonds).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, a]) => `${t(HEROES[BONDS[id].a].name)}+${t(HEROES[BONDS[id].b].name)} (tier ${bondTier(a)})`).join(' · ') || '—'}</div>
        </Section>
        <Section title="Saved companies" right={<span className="small dim">{(s.camp.account.presets ?? 0) > 0 ? `${presetSlots(s)} slots` : 'Locked'}</span>}>
          {(s.camp.account.presets ?? 0) === 0 ? <p className="small dim">Unlock <b>Saved Companies</b> in Camp → Legacy to store party compositions.</p> : (
            <div className="col" style={{ gap: 6 }}>
              {Array.from({ length: presetSlots(s) }, (_, i) => {
                const p = s.presets[i];
                return (
                  <div key={i} className="row">
                    <span className="grow small">{p ? <><b>{p.name}</b> — {p.party.filter(Boolean).map((h) => HEROES[h as HeroId].name).join(', ')}</> : <span className="dim">Empty slot {i + 1}</span>}</span>
                    <button className="btn small" disabled={!p} onClick={() => store.mutate((st) => loadPreset(st, i))}>Load</button>
                    <button className="btn small" onClick={() => store.mutate((st) => savePreset(st, `Company ${i + 1}`, i))}>Save current</button>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function SlotView({ i, hero, manual, picked, onPlace, back }: { i: number; hero: HeroId | null; manual: boolean; picked: boolean; onPlace: (i: number) => void; back?: boolean }) {
  const s = useGame();
  return (
    <button className={`slot ${hero ? 'filled' : ''} ${back ? 'back' : ''} ${picked && manual ? 'over' : ''}`} onClick={() => manual && onPlace(i)} disabled={!manual}
      aria-label={hero ? `${HEROES[hero].name}, ${back ? 'back' : 'front'} row slot ${i + 1}` : `Empty ${back ? 'back' : 'front'} row slot`}>
      {hero ? (<><HeroPortrait id={hero} size="md" /><b className="small">{t(HEROES[hero].name)}</b><span className="tiny dim">Lv {s.heroes[hero].level} · {ROLE_NOTE[HEROES[hero].role]}</span></>) : <span className="dim small">{manual ? (picked ? 'Place here' : 'Empty') : '—'}</span>}
    </button>
  );
}
