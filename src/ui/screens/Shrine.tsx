import { RELICS, RELIC_IDS, relicBonus } from '../../content/relics.ts';
import { relicNextCost, upgradeRelic } from '../../core/game.ts';
import { Bar, Icon, Tip, fmt } from '../components.tsx';
import { t } from '../names.ts';
import { store, useGame } from '../store.ts';
import { sfx } from '../../audio/audio.ts';

const ICON: Record<string, string> = { light: 'sun', horn: 'horn', wisdom: 'scroll', blessing: 'drop', fortune: 'leaf', courage: 'banner' };

export function ShrineScreen() {
  const s = useGame();
  return (
    <div>
      <div className="ph"><h2>Relic Shrine</h2><span className="chip" style={{ color: '#c8a0ff' }}><Icon k="essence" /> {fmt(s.essence)} essence</span></div>
      <p className="dim small">Relics are permanent: their levels survive every descent. Essence comes from elites, bosses and special rooms. Costs rise with each level, and past level 20 each level adds less — choose where to invest.</p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(20rem, 1fr))' }}>
        {RELIC_IDS.map((id) => {
          const d = RELICS[id];
          const lvl = s.relics[id] ?? 0;
          const cost = relicNextCost(s, id);
          const now = relicBonus(d, lvl);
          const next = relicBonus(d, lvl + 1);
          const soft = lvl >= d.softCap;
          return (
            <div key={id} className="panel">
              <div className="row">
                <div className="skillicon" style={{ width: '3.4rem', height: '3.4rem' }}><Icon k={ICON[id]} size={32} /></div>
                <div className="grow"><h3>{t(d.name)}</h3><div className="small dim">{d.effectLabel}</div></div>
                <span className="chip gold num">Lv {lvl}</span>
              </div>
              <p className="small dim" style={{ margin: '6px 0' }}>{t(d.desc)}</p>
              <div className="row spread small"><span>Now: <b className="num gold">+{now.toFixed(1)}%</b></span><span>Next: <b className="num good">+{next.toFixed(1)}%</b> <span className="dim">(+{(next - now).toFixed(1)})</span></span></div>
              <Tip content={<><h4>Soft cap at level {d.softCap}</h4><div className="line">Up to level {d.softCap} each level gives +{d.perLevel}%. After that, +{d.afterSoft}% per level, and costs climb faster.</div></>}>
                <div tabIndex={0}><Bar value={Math.min(lvl, d.softCap)} max={d.softCap} kind="gold" label={`${d.name} progress to soft cap`} /></div>
              </Tip>
              <div className="row spread" style={{ marginTop: 6 }}>
                <span className="tiny faint">{soft ? 'Past the soft cap' : `${d.softCap - lvl} levels to soft cap`}</span>
                <button className="btn primary small" disabled={cost === null || s.essence < cost} onClick={() => { if (store.mutate((st) => upgradeRelic(st, id), 'now')) sfx.confirm(); }}>
                  <Icon k="essence" /> {cost === null ? 'Max' : fmt(cost)}
                </button>
              </div>
              <div className="tiny faint" style={{ marginTop: 4, fontStyle: 'italic' }}>{t(d.lore)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
