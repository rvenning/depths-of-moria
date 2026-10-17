import { useMemo, useState } from 'react';
import { HEROES } from '../../content/heroes.ts';
import { ITEMS, RARITY_NAME, SETS } from '../../content/items.ts';
import { HERO_IDS, RARITIES } from '../../content/schema.ts';
import type { HeroId, ItemInstance, ItemSlot, Rarity } from '../../content/schema.ts';
import { autoEquip, canEquip, equip, equippedBy, getItem, salvage, salvageBelow, suggestEquip, toggleLock, unequip } from '../../core/game.ts';
import { itemName, rarityIndex, salvageValue } from '../../core/loot.ts';
import { SLOTS, computeHero, itemScore } from '../../core/stats.ts';
import { HeroPortrait, Icon, ItemCell, ItemTip, Empty, StatTable, fmt, useVisit } from '../components.tsx';
import { store, useGame } from '../store.ts';
import { sfx } from '../../audio/audio.ts';

const SLOT_LABEL: Record<ItemSlot, string> = { weapon: 'Weapon', armour: 'Armour', offhand: 'Offhand', accessory1: 'Accessory', accessory2: 'Accessory' };

export function ArmouryScreen() {
  const s = useGame();
  useVisit('visitedArmoury');
  const sortingUnlocked = (s.camp.account.sorting ?? 0) > 0;
  const autoUnlocked = (s.camp.account.autosalvage ?? 0) > 0;
  const heroes = HERO_IDS.filter((h) => s.heroes[h].unlocked);
  const [hero, setHero] = useState<HeroId>(((store.screenArg as HeroId) && s.heroes[store.screenArg as HeroId]?.unlocked ? (store.screenArg as HeroId) : heroes[0]));
  const [slotFilter, setSlotFilter] = useState<string>('all');
  const [rarity, setRarity] = useState<string>('all');
  const [sort, setSort] = useState<'new' | 'power' | 'rarity' | 'level'>('new');
  const [onlySets, setOnlySets] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  const role = HEROES[hero].role === 'mage' || HEROES[hero].role === 'healer' ? 'mag' : HEROES[hero].role === 'protector' || HEROES[hero].role === 'bruiser' ? 'tank' : 'phys';
  const items = useMemo(() => {
    let l = s.inventory.slice();
    if (slotFilter !== 'all') l = l.filter((i) => ITEMS[i.tpl]?.slot === slotFilter);
    if (sortingUnlocked) {
      if (rarity !== 'all') l = l.filter((i) => i.rarity === rarity);
      if (onlySets) l = l.filter((i) => !!ITEMS[i.tpl]?.set);
      if (sort === 'power') l.sort((a, b) => itemScore(b, role) - itemScore(a, role));
      else if (sort === 'rarity') l.sort((a, b) => rarityIndex(b.rarity) - rarityIndex(a.rarity) || b.ilvl - a.ilvl);
      else if (sort === 'level') l.sort((a, b) => b.ilvl - a.ilvl);
      else l.reverse();
    } else l.reverse();
    return l;
  }, [s.inventory, slotFilter, rarity, sort, onlySets, sortingUnlocked, role]);

  const item = sel ? getItem(s, sel) : undefined;
  const tpl = item ? ITEMS[item.tpl] : null;
  const suggest = suggestEquip(s, hero);
  const targetSlot = (it: ItemInstance): ItemSlot => {
    const t = ITEMS[it.tpl];
    if (t.slot !== 'accessory') return t.slot as ItemSlot;
    return s.heroes[hero].equip.accessory1 && !s.heroes[hero].equip.accessory2 ? 'accessory2' : 'accessory1';
  };
  const compareWith = item && tpl ? getItem(s, s.heroes[hero].equip[targetSlot(item)]) : undefined;
  const statsNow = computeHero(s, hero).stats;
  const owner = item ? equippedBy(s, item.uid) : null;

  return (
    <div className="two" style={{ gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr)' }}>
      <div className="col">
        <div className="ph"><h2>Armoury <span className="small dim">{s.inventory.length} items</span></h2>
          <div className="row wrap">
            <button className="btn small" onClick={() => { const n = store.mutate((st) => autoEquip(st, hero)); store.toast(n ? `${HEROES[hero].name}: equipped ${n} item${n === 1 ? '' : 's'}` : 'Nothing better to equip', n ? 'good' : 'info'); if (n) sfx.confirm(); }}><Icon k="armour" /> Auto-equip {HEROES[hero].name}</button>
          </div>
        </div>
        <div className="row wrap">
          {heroes.map((h) => (
            <button key={h} className={`herocard ${hero === h ? 'sel' : ''}`} style={{ width: 'auto', padding: 4 }} onClick={() => setHero(h)} aria-pressed={hero === h} aria-label={HEROES[h].name}>
              <HeroPortrait id={h} size="sm" />
            </button>
          ))}
        </div>
        <div className="panel flat">
          <div className="row wrap" style={{ gap: 8 }}>
            {SLOTS.map((sl) => {
              const it = getItem(s, s.heroes[hero].equip[sl]);
              return (
                <div key={sl} className="col" style={{ alignItems: 'center', gap: 2 }}>
                  <span className="tiny faint">{SLOT_LABEL[sl]}</span>
                  {it ? <ItemCell item={it} selected={sel === it.uid} onClick={() => setSel(it.uid)} onContext={() => store.mutate((st) => unequip(st, hero, sl))} />
                    : <button className="itemcell" aria-label={`Empty ${SLOT_LABEL[sl]} slot`} onClick={() => setSlotFilter(sl.startsWith('acc') ? 'accessory' : sl)} style={{ opacity: 0.5 }}><Icon k="chest" /></button>}
                </div>
              );
            })}
            <div className="grow" />
            {suggest.length > 0 && <span className="chip good" title="Better items are waiting in the armoury">{suggest.length} upgrade{suggest.length === 1 ? '' : 's'} available</span>}
          </div>
        </div>
        <div className="row wrap">
          {['all', 'weapon', 'armour', 'offhand', 'accessory'].map((k) => <button key={k} className={`btn small ${slotFilter === k ? 'primary' : ''}`} onClick={() => setSlotFilter(k)}>{k === 'all' ? 'All' : k[0].toUpperCase() + k.slice(1)}</button>)}
          <div className="grow" />
          {sortingUnlocked ? (
            <>
              <select value={rarity} onChange={(e) => setRarity(e.target.value)} aria-label="Rarity filter"><option value="all">Any rarity</option>{RARITIES.map((r) => <option key={r} value={r}>{RARITY_NAME[r]}</option>)}</select>
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort"><option value="new">Newest</option><option value="power">Power for {HEROES[hero].name}</option><option value="rarity">Rarity</option><option value="level">Item level</option></select>
              <label className="check small"><input type="checkbox" checked={onlySets} onChange={(e) => setOnlySets(e.target.checked)} /> Set pieces</label>
            </>
          ) : <span className="small dim">Unlock <b>Loot Sorting</b> in Camp → Legacy for filters and sorting.</span>}
        </div>
        <div className="row wrap" style={{ gap: 6, alignContent: 'flex-start' }}>
          {items.map((i) => <ItemCell key={i.uid} item={i} selected={sel === i.uid} equippedBy={equippedBy(s, i.uid)} badge={equippedBy(s, i.uid) ? HEROES[equippedBy(s, i.uid)!].name.slice(0, 2) : undefined} onClick={() => { setSel(i.uid); i.isNew = false; store.touch(); }} />)}
          {items.length === 0 && <Empty>Nothing matches. Delve to find loot.</Empty>}
        </div>
        <div className="panel flat">
          <div className="row wrap">
            <b>Salvage</b>
            {(['common', 'uncommon', 'rare'] as Rarity[]).map((r) => (
              <button key={r} className="btn small" onClick={() => { const n = store.mutate((st) => salvageBelow(st, r), 'now'); store.toast(`Salvaged ${n} item${n === 1 ? '' : 's'}`, 'info', 'trash'); }}>All ≤ {RARITY_NAME[r]}</button>
            ))}
            <span className="small dim">(locked and equipped items are kept)</span>
          </div>
          {autoUnlocked && (
            <div className="row" style={{ marginTop: 6 }}>
              <span className="small">Loot filter — auto-salvage new drops up to:</span>
              <select value={s.settings.autoSalvageUpTo ?? 'none'} onChange={(e) => store.mutate((st) => { st.settings.autoSalvageUpTo = e.target.value === 'none' ? null : (e.target.value as Rarity); })} aria-label="Auto-salvage threshold">
                <option value="none">Off</option>{(['common', 'uncommon', 'rare'] as Rarity[]).map((r) => <option key={r} value={r}>{RARITY_NAME[r]}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
      <div className="col">
        <div className="panel">
          {!item || !tpl ? <Empty>Select an item to inspect it. Right-click an equipped item to unequip.</Empty> : (
            <div className="col">
              <ItemTip item={item} compare={compareWith} />
              <div className="small dim">{compareWith ? `Compared with ${itemName(compareWith)} on ${HEROES[hero].name}` : `${HEROES[hero].name} has nothing in that slot.`}</div>
              <div className="row wrap">
                {owner ? <span className="chip">Equipped on {HEROES[owner].name}</span> : null}
                <button className="btn primary" disabled={!canEquip(s, hero, item, targetSlot(item))} onClick={() => { store.mutate((st) => equip(st, hero, item.uid, targetSlot(item))); sfx.confirm(); }}>
                  Equip on {HEROES[hero].name}
                </button>
                {!canEquip(s, hero, item, targetSlot(item)) && <span className="small bad">{HEROES[hero].name} cannot use this {tpl.weapon ?? tpl.slot}.</span>}
              </div>
              <div className="row wrap">
                <button className="btn small" onClick={() => store.mutate((st) => toggleLock(st, item.uid))}><Icon k="lock" /> {item.locked ? 'Unlock' : 'Lock (keep as heirloom)'}</button>
                <button className="btn small danger" disabled={!!item.locked || !!owner} onClick={() => { const v = salvageValue(item); store.mutate((st) => salvage(st, item.uid), 'now'); setSel(null); store.toast(`Salvaged: +${v.ore} ore, +${v.cloth} cloth, +${v.gold} gold`, 'info', 'trash'); }}><Icon k="trash" /> Salvage</button>
              </div>
              {tpl.set && <div className="small dim">Set: {SETS[tpl.set].name} ({s.itemsSeen.filter((p) => SETS[tpl.set!].pieces.includes(p)).length}/4 discovered)</div>}
            </div>
          )}
        </div>
        <div className="panel">
          <h3>{HEROES[hero].name} — current stats</h3>
          <StatTable stats={statsNow} />
        </div>
      </div>
    </div>
  );
}
export { fmt };
