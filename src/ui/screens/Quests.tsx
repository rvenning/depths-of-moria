import { useState } from 'react';
import { claimQuest, questViews } from '../../core/meta.ts';
import { Bar, Icon, Tabs, fmt } from '../components.tsx';
import { store, useGame } from '../store.ts';
import { sfx } from '../../audio/audio.ts';
import type { QuestDef } from '../../content/schema.ts';

function Reward({ r }: { r: QuestDef['reward'] }) {
  return (
    <span className="row wrap gap-s">
      {r.gold ? <span className="chip gold"><Icon k="coin" /> {fmt(r.gold)}</span> : null}
      {r.essence ? <span className="chip" style={{ color: '#c8a0ff' }}><Icon k="essence" /> {r.essence}</span> : null}
      {r.renown ? <span className="chip"><Icon k="renown" /> {r.renown}</span> : null}
      {r.ore ? <span className="chip"><Icon k="ore" /> {r.ore}</span> : null}
      {r.cloth ? <span className="chip"><Icon k="cloth" /> {r.cloth}</span> : null}
      {r.item ? <span className="chip"><Icon k="chest" /> {r.item} item</span> : null}
    </span>
  );
}

export function QuestsScreen() {
  const s = useGame();
  const [tab, setTab] = useState<'open' | 'claimed' | 'later'>('open');
  const all = questViews(s);
  const open = all.filter((q) => q.available && !q.claimed);
  const claimed = all.filter((q) => q.claimed);
  const later = all.filter((q) => !q.available);
  const list = tab === 'open' ? open.sort((a, b) => Number(b.done) - Number(a.done)) : tab === 'claimed' ? claimed : later;
  return (
    <div>
      <div className="ph"><h2>Quest board</h2>
        <button className="btn primary" disabled={!open.some((q) => q.done)} onClick={() => { let n = 0; store.mutate((st) => { for (const q of questViews(st)) if (q.available && q.done && !q.claimed && claimQuest(st, q.def.id)) n++; }, 'now'); if (n) { sfx.coin(); store.toast(`Claimed ${n} reward${n === 1 ? '' : 's'}`, 'good', 'scroll'); } }}>Claim all</button>
      </div>
      <p className="dim small">Authored goals with real rewards. More notices appear as you reach deeper chapters.</p>
      <Tabs label="Quests" value={tab} onChange={setTab} tabs={[{ id: 'open', label: `Open (${open.length})` }, { id: 'claimed', label: `Done (${claimed.length})` }, { id: 'later', label: `Later (${later.length})` }]} />
      <div className="col">
        {list.map((q) => (
          <div key={q.def.id} className={`quest ${q.done ? 'done' : ''} ${q.claimed ? 'claimed' : ''}`}>
            <Icon k={q.done ? 'check' : 'scroll'} size={26} color={q.done ? 'var(--good)' : undefined} />
            <div className="grow">
              <div className="row spread wrap"><b>{q.def.title}</b>{q.def.repeatable && <span className="chip">Repeatable</span>}<Reward r={q.def.reward} /></div>
              <div className="small dim">{q.available ? q.def.desc : `Available from chapter ${q.def.chapter}.`}</div>
              {q.available && !q.claimed && <Bar value={Math.min(q.def.target, q.progress)} max={q.def.target} label={q.def.title} />}
              {q.available && !q.claimed && <div className="tiny faint num">{fmt(Math.min(q.def.target, q.progress))} / {fmt(q.def.target)}</div>}
            </div>
            {q.available && !q.claimed && <button className="btn small primary" disabled={!q.done} onClick={() => { if (store.mutate((st) => claimQuest(st, q.def.id), 'now')) { sfx.coin(); store.toast(`Claimed: ${q.def.title}`, 'good', 'scroll'); } }}>Claim</button>}
          </div>
        ))}
        {list.length === 0 && <div className="inset dim center">Nothing here.</div>}
      </div>
    </div>
  );
}
