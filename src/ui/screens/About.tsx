import { Icon, Section } from '../components.tsx';
import { store } from '../store.ts';

export function AboutScreen() {
  return (
    <div className="col" style={{ maxWidth: '58rem', margin: '0 auto', padding: '1rem' }}>
      <div className="ph"><h2>Credits &amp; rights</h2><button className="btn" onClick={() => store.go(store.hasSave ? 'camp' : 'title')}><Icon k="chevron" /> Back</button></div>
      <Section title="What this is">
        <p>“The Fellowship: Depths of Moria” is a private fan-game concept: a single-player fantasy auto-battler with a ten-Age, thousand-floor campaign. It uses character, place and item names from Tolkien’s legendarium as a creative theme.</p>
        <p className="gold"><b>It must not be marketed, sold or publicly distributed without permission from the relevant rights-holders.</b> Treat any build as an internal prototype. A one-click clean reskin is built in (Settings → Names → Original reskin) and is the intended path for any public release.</p>
      </Section>
      <Section title="What is original">
        <ul className="small" style={{ lineHeight: 1.6, paddingLeft: '1.2rem' }}>
          <li>All code, systems, balance, enemies, items, events, lore entries, quests and bond scenes are original writing and design. No text, dialogue or lyrics are copied from books or films.</li>
          <li>All art is painted procedurally in code at runtime in an original stylised look; there are no film likenesses and no ripped or imported images.</li>
          <li>All music and sound effects are synthesised on-device; there is no copyrighted soundtrack.</li>
          <li>No Soda Dungeon code or assets were used; only the long-form, auto-battle progression inspiration.</li>
          <li>There is no real-money currency, no monetisation, no gacha and no backend.</li>
        </ul>
      </Section>
      <Section title="Restricted names (flagged for any public release)">
        <p className="small dim">These appear in the fan-concept naming layer and are replaced by the Original reskin:</p>
        <p className="small">Heroes: Aragorn, Gimli, Frodo, Legolas, Boromir, Sam, Gandalf · Antagonist &amp; places: Balrog, Moria, Khazad-dûm, Gondor, the Shire, the Lonely Mountain, the White City · Relics: Light of Eärendil, Horn of Gondor, Wisdom of the Istari, Blessing of the Valar, Fortune of the Shire, Courage of the Free Peoples · Terms: Fellowship, Istari, Valar. The ten chapter concepts, the Age mechanic and every other boss, enemy and item name are original; no claim of canon is made.</p>
      </Section>
      <Section title="Open-source components">
        <ul className="small" style={{ lineHeight: 1.6, paddingLeft: '1.2rem' }}>
          <li>Phaser 4 (MIT) — battle rendering · React 18 (MIT) — interface · Vite &amp; TypeScript — tooling</li>
          <li>EB Garamond and Cormorant Garamond (SIL Open Font License 1.1), via Fontsource, bundled locally</li>
        </ul>
        <p className="tiny dim">The full manifest is in docs/ASSETS.md and docs/RIGHTS.md in the project.</p>
      </Section>
    </div>
  );
}
