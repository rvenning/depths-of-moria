# Rights, restricted content and the clean reskin

**Status: private fan-game concept. Do not market, sell or publicly distribute this build without permission from the relevant rights-holders.** The design brief asks for exactly that treatment, and so does this document.

## What is original

| Area | Status |
|---|---|
| Code, systems, battle engine, balance, progression, UI | Original |
| Enemy roster (80 creatures), boss mechanics, chapter concepts, Age mechanic | Original design and stats; the creature *names and themes* draw on Middle-earth (see the restricted list below), and each has a neutral name in the Original reskin (the ten chapters are "original game-design chapter concepts, not claims about canon") |
| 130 items, 10 sets, affixes, events, quests, achievements, lore entries, bond scenes | Original writing. No sentences, dialogue or song lyrics are taken from any book or film. Two lines that were too close to well-known quotations were rewritten during review. |
| Art | Painted procedurally in code in an original stylised look. No film likenesses, no imported or ripped images. |
| Music | The score is original (composed in code, `src/audio/score.ts`). The shipped tracks in `public/music/` are that score rendered offline (`tools/music/render-music.ts`) through the **MuseScore_General (Lite)** SoundFont, so they contain instrument samples. Licence below. |
| Sound effects and ambience | Synthesised on-device (WebAudio). No samples. |
| Soda Dungeon | Inspiration only (long-form auto-battle progression). No code or assets used. |
| Money | No real-money currency, monetisation, gacha or backend. |

## What is restricted (flagged for any public release)

These names come from the Tolkien legendarium and are the only restricted content. They appear only in the naming layer (`src/ui/names.ts`) and in a few content strings that pass through it.

- **Characters:** Aragorn, Gimli, Frodo, Legolas, Boromir, Sam (Samwise), Gandalf; the title "Strider" and "Mr. Frodo / Mr. Gamgee" in dialogue.
- **Antagonist and places:** the Balrog, Moria, Khazad-dûm ("The Bridge of Khazad-dûm" chapter), Gondor, the Shire, the Lonely Mountain, the White City / White Tower.
- **Relics:** Light of Eärendil, Horn of Gondor, Wisdom of the Istari, Blessing of the Valar, Fortune of the Shire, Courage of the Free Peoples.
- **Terms:** Fellowship, Istari, Valar, Free Peoples.
- **Enemies and bosses (the roster is themed on Middle-earth since v1.2):** the Watcher in the Water, Gollum, Grishnákh, Azog, Bolg and Gundabad, Gorbag, Shelob, the Great Goblin, the Uruk-hai, Olog-hai and snagas, the white hand and Red Eye sigils, Isengard and Mordor, Mazarbul, barrow-wights, the Ringwraith and the Morgul-blade, the Oathbreakers and the King of the Dead, Udûn and Durin’s Bane, the crebain. Generic words kept as they are common fantasy vocabulary: goblin, orc, troll, warg, wight, drake.
- **Hero epithets:** "Ranger of the North", "Axe of the Lonely Mountain", "Bearer of the Burden", "Grey Pilgrim", "Captain of the White Tower", "Gardener, Gaffer's Son".

Everything else (all other bosses, enemies, items, set names, event text, lore) is original. Item names were deliberately kept original; no artefact names from the books are used.

## The clean reskin ("Original")

`Settings → Names → Original reskin` (also on the title screen) rewrites every restricted name in the game content (heroes, enemies, items, lore, quests, events, UI strings) with a neutral original, in memory, from a pristine copy of the data, for example Aragorn → Arvane, Gimli → Dorik, Frodo → Wren, Legolas → Sylvaen, Boromir → Halvard, Sam → Tobin, Gandalf → Eldrin, Moria → the Deepmine, the Balrog → the Ember Tyrant, Light of Eärendil → Star-Phial. It does not touch the save file. The mapping lives in one table in `src/ui/names.ts` (`applyNaming`); `tests/names.test.ts` asserts that no restricted term survives in Original mode.

For a public release, the recommended path is:
1. Make "Original" the default (`defaultSettings().naming`), remove the "Fan concept" option and the restricted strings from the source (the table's left-hand side is the exact worklist).
2. Replace the seven hero palettes' silhouettes' accessories that echo known imagery if desired (hat, horn, axe) — they are generic fantasy shapes, but a legal review should decide.
3. Re-run `npm test` (the content tests assert counts, not names).

## Sampled music: soundfont licence

| | |
|---|---|
| Soundfont | MuseScore_General (Lite), as packaged on npm in `@librescore/sf3` (package licence MIT), by S. Christian Collins; Debian packaging by mirabilos |
| Licence | **MIT**, with parts public domain or CC0: MuseScore Drumline samples (CC0, S. Christian Collins & Amir Oosman), Splendid Grand Piano (public domain), marching cymbals from the Versilian Community Sample Library (CC0, Sam Gossner). It also includes parts of Fluid (R3) GM (MIT, Frank Wen; mono version Michael Cowgill; Temple Blocks Ethan Winer; Drumline cymbals Michael Schorsch). |
| Permits | Use, copy, modify, merge, publish, distribute, sublicense and sell, including in rendered audio, on condition that the copyright and permission notice stay with the software. |
| What we ship | Only rendered MP3 audio, not the soundfont itself. The notices are reproduced in `public/music/LICENSES.txt`, which is served next to the tracks, and in the credits. |
| Renderer | `spessasynth_core` (Apache-2.0) and `@breezystack/lamejs` (LGPL, used only offline at build time; it is not shipped) |
| Fallback | The runtime synth still plays if a track is missing, fails to decode, or the player turns off *Orchestral score* in Settings. |

This is a record of the licence text as found in the package, not legal advice.

## Credits
See `ASSETS.md` for libraries, fonts and licences, and the in-game Credits screen (`Credits & rights` on the title screen and in Settings).
