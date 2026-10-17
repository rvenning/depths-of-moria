import { useMemo, useState } from 'react';
import { ITEMS, AFFIXES, RARITY_NAME } from '../../content/items.ts';
import { STAT_LABEL } from '../../content/schema.ts';
import {
  ASCEND_SHARDS, MAX_PLUS, ascendItem, canAscend, equippedBy, forgeUnlocked, getItem, reforgeAffix, reforgeCost, upgradeCostFor, upgradeItem,
} from '../../core/game.ts';
import { itemName } from '../../core/loot.ts';
import { itemScore, itemStatLines } from '../../core/stats.ts';
import { HEROES } from '../../content/heroes.ts';
import { Icon, ItemCell, ItemTip, fmt, statText, Empty } from '../components.tsx';
import { store, useGame } from '../store.ts';
import { sfx } from '../../audio/audio.ts';
import { rarityIndex } from '../../core/loot.ts';

export function ForgeScreen() {
  const s = useGame();
  const unlocked = forgeUnlocked(s);
  const [sel, setSel] = useState<string | null>(null);
  const [slot, setSlot] = useState<string>('all');
  const items = useMemo(() => s.inventory.filter((i) => slot === 'all' || ITEMS[i.tpl]?.slot === slot).sort((a, b) => Number(!!equippedBy(s, b.uid)) - Number(!!equippedBy(s, a.uid)) || rarityIndex(b.rarity) - rarityIndex(a.rarity) || b.ilvl - a.ilvl), [s.inventory, slot, s.heroes]); // eslint-disable-line react-hooks/exhaustive-deps
  const item = sel ? getItem(s, sel) : undefined;
  const tpl = item ? ITEMS[item.tpl] : null;

  if (!unlocked) {
    return (
      <div className="panel center" style={{ maxWidth: '40rem', margin: '2rem auto' }}>
        <Icon k="anvil" size={48} />
        <h2>The Forge is cold</h2>
        <p className="dim">An abandoned forge-hall waits in the <b className="gold">Abandoned Forges</b> (floors 201–300, the third Age). When you reach it, the camp smith will teach the company to upgrade and reforge gear with ore and cloth.</p>
      </div>
    );
  }
  const cost = item ? upgradeCostFor(s, item) : null;
  const can = item && cost && s.ore >= cost.ore && s.cloth >= cost.cloth && s.gold >= cost.gold && item.plus < MAX_PLUS;
  const rc = item ? reforgeCost(s, item) : null;
  const canReforge = item && rc && !!tpl?.affixes?.length && item.rarity !== 'common' && item.rarity !== 'uncommon' && !tpl.signature && s.ore >= rc.ore && s.cloth >= rc.cloth && s.gold >= rc.gold;
  const after = item ? { ...item, plus: item.plus + 1 } : null;
  const owner = item ? equippedBy(s, item.uid) : null;

  return (
    <div className="two" style={{ gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)' }}>
      <div className="col">
        <div className="ph"><h2>Forge</h2>
          <div className="row wrap">
            <span className="res num"><Icon k="ore" /> {fmt(s.ore)}</span><span className="res num"><Icon k="cloth" /> {fmt(s.cloth)}</span><span className="res num"><Icon k="coin" /> {fmt(s.gold)}</span>
          </div>
        </div>
        <p className="small dim">Upgrade gear up to +{MAX_PLUS} (each level adds 6% to its base stats), reforge the affix on rare and epic items, or — from the Chamber of Flame — ascend an epic into a legendary.</p>
        <div className="row wrap">
          {['all', 'weapon', 'armour', 'offhand', 'accessory'].map((k) => <button key={k} className={`btn small ${slot === k ? 'primary' : ''}`} onClick={() => setSlot(k)}>{k === 'all' ? 'All' : k[0].toUpperCase() + k.slice(1)}</button>)}
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          {items.map((i) => <ItemCell key={i.uid} item={i} selected={sel === i.uid} equippedBy={equippedBy(s, i.uid)} badge={equippedBy(s, i.uid) ? HEROES[equippedBy(s, i.uid)!].name.slice(0, 2) : undefined} onClick={() => setSel(i.uid)} />)}
          {items.length === 0 && <Empty>No items here.</Empty>}
        </div>
      </div>
      <div className="panel">
        {!item || !tpl || !cost || !rc ? <Empty>Choose an item to work on.</Empty> : (
          <div className="col">
            <div className="row"><ItemCell item={item} /><div className="grow"><h3 className={`rar-${item.rarity}`}>{itemName(item)}</h3><div className="small dim">{RARITY_NAME[item.rarity]} · +{item.plus}/{MAX_PLUS}{owner ? ` · equipped on ${HEROES[owner].name}` : ''}</div></div></div>
            <ItemTip item={item} />
            <hr className="hr" />
            <h4>Upgrade to +{item.plus + 1}</h4>
            {item.plus >= MAX_PLUS ? <p className="dim small">Fully upgraded.</p> : (
              <>
                <div className="small">{itemStatLines(item).map((l) => { const a = itemStatLines(after!).find((x) => x.stat === l.stat)!; return <div className="statline" key={l.stat}><span>{STAT_LABEL[l.stat]}</span><b className="num">{statText(l.stat, l.value)} → <span className="good">{statText(l.stat, a.value)}</span></b></div>; })}</div>
                <div className="row wrap" style={{ margin: '6px 0' }}>
                  <span className={`chip ${s.ore >= cost.ore ? '' : 'bad'}`}><Icon k="ore" /> {cost.ore}</span><span className={`chip ${s.cloth >= cost.cloth ? '' : 'bad'}`}><Icon k="cloth" /> {cost.cloth}</span><span className={`chip ${s.gold >= cost.gold ? 'gold' : 'bad'}`}><Icon k="coin" /> {fmt(cost.gold)}</span>
                </div>
                <button className="btn primary" disabled={!can} onClick={() => { if (store.mutate((st) => upgradeItem(st, item.uid), 'now')) sfx.confirm(); }}><Icon k="anvil" /> Upgrade</button>
              </>
            )}
            <hr className="hr" />
            <h4>Reforge affix</h4>
            {!tpl.affixes?.length || item.rarity === 'common' || item.rarity === 'uncommon' || tpl.signature
              ? <p className="small dim">Only rare and epic items with an affix pool can be reforged.</p>
              : <>
                <p className="small dim">Current: <b>{item.affix ? AFFIXES[item.affix].desc : 'none'}</b>. Pool: {tpl.affixes.map((a) => AFFIXES[a].name).join(', ')}.</p>
                <div className="row wrap"><span className="chip"><Icon k="ore" /> {rc.ore}</span><span className="chip"><Icon k="cloth" /> {rc.cloth}</span><span className="chip gold"><Icon k="coin" /> {fmt(rc.gold)}</span></div>
                <button className="btn" disabled={!canReforge} onClick={() => { if (store.mutate((st) => reforgeAffix(st, item.uid, (Math.random() * 1e9) | 0), 'now')) sfx.confirm(); }}>Reforge</button>
              </>}
            <hr className="hr" />
            <h4>Ascend to legendary</h4>
            <p className="small dim">{canAscend(s, item) ? `Costs ${ASCEND_SHARDS} legendary shards (from chapter bosses). The item becomes legendary (+28% base stats over epic).` : item.rarity === 'epic' ? `Needs the Chamber of Flame (Age 9) and ${ASCEND_SHARDS} legendary shards. You have ${s.shards}.` : 'Only epic items can be ascended.'}</p>
            <button className="btn" disabled={!canAscend(s, item)} onClick={() => { if (store.mutate((st) => ascendItem(st, item.uid), 'now')) { sfx.levelUp(); store.toast('The item blazes with legendary power', 'good', 'star'); } }}><Icon k="star" /> Ascend</button>
            <div className="tiny faint">Power score: {Math.round(itemScore(item))}</div>
          </div>
        )}
      </div>
    </div>
  );
}
