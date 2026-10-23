# Tracker — final state and completed-vs-remaining audit

Legend: [x] done · [~] done with a caveat (stated) · [ ] not done

Verification at hand-off: `npm run typecheck` clean · `npx vitest run` 193/193 · `npm run build` ok · `node tests/e2e/e2e.cjs` 8/8 · `node tools/monkey.cjs` 136 clicks over 10 screens with a rich late-game save, 0 errors.

## Milestones
- [x] M0 Scaffold — Vite 7, TypeScript strict, React 18, Phaser 4 (battle scene only, lazy chunk), PWA (manifest, icons, service worker), CI workflow
- [x] M1 Engine — seeded sfc32 RNG; event-emitting battle engine (ATB, rows, taunt/hidden/submerged, statuses, hazards, boss phases, summons, waves, enrage, bond combos); editable priority-rule hero AI
- [x] M2 Game core — loot/affixes/sets/signatures, expedition loop, Age-of-Darkness reset with preview + confirmation, relics, bonds, camp upgrades, quests, achievements, ladder, endless Deep Delve; IndexedDB saves (localStorage fallback), v1→v2 migration, export/import with checksum
- [x] M3 Vertical slice — shell, camp, roster, party, battle view, results, onboarding (prologue + first steps)
- [x] M4 Full content, chapters 1–10
- [x] M5 Systems — relics, bonds + scenes, forge, quests, achievements, codex, collection, ladder, endless
- [x] M6 Audio / art / accessibility — procedural art, WebAudio audio, reduced motion, high contrast, text size, keyboard navigation
- [x] M7 Balance sim, tests, perf, docs

## Content against the spec's minimums
| Item | Spec | Built |
|---|---|---|
| Chapters × floors | 10 × 100 | 10 × 100 with the 10/25/50/75/100 special floors and checkpoints |
| Bosses | 10 | 10 (Balrog final) |
| Mini-bosses + elites | 20 | 20 mini + 10 elite |
| Normal enemies | 30+ | 40 (80 enemy defs in total) |
| Items | 100+ | 130 |
| Events | 20+ | 24 |
| Quests | 25+ | 34 |
| Achievements | 20+ | 31 |
| Heroes | 7 | 7, each 3 skills + passive + 10 talents |
| Relics | 6 | 6 (soft caps) |
| Bonds | 3 tiers per pair | 21 pairs × 3 tiers, scenes, tier-3 combos |
| Room variants | 15+ | 10 chapter themes × 8 room shapes |

## Balance (see BALANCE_REPORT.md)
Progression-bot campaign: about 37 h at 1×, about 22 h at the default 2×, inside the 20–40 h target. Bosses are won only after preparation; normal fights run 3–8 rounds and boss fights 14–34.
The numbers come from a bot that plays each floor once and spends as it earns, so treat them as a lower bound for a human. Real playtests still have to confirm the spec's 20–40 h.

## Caveats and remaining work
- [x] Music is sampled (see the Quality pass below) and approved by the owner by ear; effects and ambience are still synthesised and have not been auditioned.
- [~] Phaser battle pacing and animation feel were verified in real Chrome only; the in-app preview pane throttles requestAnimationFrame to about 1 fps. Measured about 56 fps in Chrome.
- [~] Art is procedural, not hand-drawn. Similar creature families (troll/orc variants) share body plans and could use more silhouette variety.
- [~] Multi-hour feel (pacing of the later Ages, whether the grind is fun) is unvalidated by a human player.
- [ ] No colour-blind palette option (high contrast, text size and reduced motion exist).
- [ ] No store packaging. The game is a PWA; there is no Steam/app-store wrapper.
- [x] Deployed (at the owner's request) to GitHub Pages as an unlisted page: https://rvenning.github.io/depths-of-moria/ . By decision it is NOT on the games hub and NOT in the newsletter. It still uses the Tolkien names by default (see RIGHTS.md); the "Original" naming toggle is the clean-reskin path.
- [ ] Optional polish: per-hero voice barks, localisation, more event art.

## Visual overhaul — "Pixel Delve" (2026-10-18)
- [x] Pixel engine (`src/art/pixel/engine.ts`): shape masks, inflate-shaded, hue-shifted 5-step ramps, ordered dither, outer + selective inner outlines. DOM-free; covered by `tests/pixel.test.ts`.
- [x] 7 heroes redrawn natively at 72×92 (faces with highlights, Boromir's shield and horn, Sam's pan and pack, Gandalf's glowing orb).
- [x] 80 enemies, 10 chapter rooms × 8 shapes and the camp: painted procedurally, then pixelised (`pixelize.ts`: 3:1 for creatures, 2:1 for scenery) with palette quantising, dithering and outlines; scenery layers drift in whole-pixel steps.
- [x] One art pixel = 2 stage pixels everywhere; Phaser in `pixelArt` + `roundPixels` mode; sprites, glows (dithered), shadows (dithered), particles (single pixels), projectiles, slash and spark hit effects are native-pixel textures.
- [x] UI skin: notched 4px frames, flat bevels, segmented bars, 111 icons rasterised to 16×16 masks, Jersey 15 pixel font (bundled, ligatures off), pixel portraits cropped from the sprites at 4×.
- [x] Title screen shows the company at the gate.
- [~] Sprites have a two-pixel idle bob, a lunge and a flash but no hand-drawn animation frames (idle/attack poses per hero would be the next art step).
- [~] Creatures share the heroes' palette logic but are pixelised paintings, not hand-placed pixels; the goblin family shares one body plan.
- Verified: typecheck, 203 unit tests, build, e2e 8/8, monkey run (136 clicks, 0 errors), ~56 fps battle scene.

## HD-2D pass — aiming at Octopath Traveler II's presentation (2026-10-18)
- [x] Real-time lighting on sprites and backdrops (normal maps; flickering torches; spell, hit and heal flashes; per-chapter ambient tint), bloom, vignette, baked depth of field.
- [x] Animated heroes: 4-frame breathing/blinking idle, wind-up, strike, hurt, cast and victory poses for all seven (engine-drawn rigs).
- [x] All 80 enemies redrawn by the pixel engine (consistent with the heroes), with breathing, wind-up, strike and hurt frames.
- [x] 13 pixel spell/impact effect clips mapped to every skill effect type.
- [x] Animated camp (idle party, crackling fire, flickering light, embers) and animated title.
- [x] Composed music (chords, answering melody, harp, strings, bass, taiko; brass and choir for bosses) with unit tests that keep every note inside the chapter's scale.
- [x] Cinematics: boss introduction (letterbox, push-in, name card), crit hit-stop, turn marker, victory confetti.
- [x] Graphics setting with automatic fallback on slow GPUs.
- [~] Honest comparison with the benchmark: the techniques (HD-2D lighting, depth of field, bloom, animated sprites, cinematic battle staging, a composed score) are in; the *scale* is not. Octopath Traveler II has a large team's hand-drawn sprite sheets with many frames per character, 3D diorama environments, an orchestral recorded soundtrack, voiced story, a full overworld and eight character campaigns. This game has procedural sprites with a handful of frames, 2D layered backdrops, a synthesised score and a menu-driven camp. It should be judged as a polished indie auto-battler with an HD-2D look, not as equal to the benchmark.
- [x] JRPG-style cutscene presenter (`ui/Cutscene.tsx`, `art/castScene.ts`): the cast on a chapter backdrop, the speaker in the light, typed dialogue in a framed box, letterbox, skippable; used for the prologue and all 63 bond scenes.
- [x] Animated torch flames at a room's light sources and drifting light shafts (theme-tinted).
- Verified after the HD-2D pass: typecheck, 247 unit tests (including the composer, all 80 enemy sprites, all hero sprites), build, e2e 8/8, monkey (139 clicks, 0 errors), battle scene 51–57 fps with lights, bloom and filters on.
- [x] Illustrated descent map on the Delve screen (replaces the chapter list): a cutaway of the mountain with the West-gate, ten strata each showing its own backdrop, a winding path, cleared/current/locked states, an animated banner and a selection halo (`art/descentMap.ts`).
- [x] Richer attack animation: a forward-leaning dash into melee, a two-frame strike with follow-through; ensemble stereo placement in the music.
- [~] Optional spoken dialogue in cutscenes (browser speech synthesis, a pitch per hero; quality depends on the device, so it is off by default).
- [x] Walkable camp: the lead hero walks (arrow keys, WASD or click) with the party trailing on a four-frame walk cycle, and E enters the facility they stand at.
- Still not matched, and not claimed: hand-drawn sprite sheets with many frames per character, 3D diorama environments, a recorded orchestral soundtrack, professional voice acting, a full explorable world map (the camp is walkable, the dungeon is not), per-character campaigns.

## Quality pass — sampled score, modelled backdrops, more animation (2026-10-18)
- [x] **Sampled orchestral score**: 40 tracks (10 chapters × title/camp/battle/boss) rendered offline from the existing composer through the MuseScore_General Lite soundfont (MIT). Loudness −17.0 LUFS on every track; decode, dropout, click-at-seam and level-step checks pass for all 40 in Chrome (`tools/music/verify.cjs`). Licence recorded in `docs/RIGHTS.md` and `public/music/LICENSES.txt`. The synth remains the fallback (missing/undecodable track, or *Orchestral score* off in Settings; `tools/sampled-probe.cjs` checks both paths).
- [x] The sampled score was auditioned by the owner (2026-10-19), who confirmed it sounds good and should stay the default. It is a free GM soundfont at 96 kbps, so a good general-MIDI orchestra rather than a recorded one. `/listen.html` on the live site has a player for all 40 tracks.
- [x] **Modelled backdrops** (Blender 4.5): all ten chapters, each with a hall and a boss arena, four lit layers each, with per-chapter palette, light and features (see ASSETS.md). Checked in the real battle scene at 52–56 fps (chapters 1, 5, 6 and 10 sampled; same range as before). Room shapes reuse the hall (some mirrored), so there are two looks per chapter plus the arena, not eight; the painted rooms remain as the fallback.
- [x] **Animation**: every hero has two distinct melee attacks (`strike` the downward chop, `thrust` the level lunge, with per-hero variants: Legolas draws and looses, Gandalf thrusts the staff) and two distinct casts (`cast`, `cast2`); battle alternates them. A unit test asserts the pairs are visibly different for all 7 heroes; `#gallery/atk` is the contact sheet. Enemies got a two-frame step cycle for their advance.

## Enemy art pass (2026-10-19)
- [x] Rim light and a contrast stretch for every enemy (the same engine pass as the heroes; it moves along each material's ramp, so no new colours).
- [x] The Tunnel Rat is a real rat (pointed snout, big round ears, whiskers, pink tail, two long teeth) via a `rat` feature and its own painter; it no longer shares the warg body.
- [x] The wargs (Cinder Hound, Stair Warg, Warg Hunter, Packleader, Flame Hound) are lean wolves: bushy tail, tall pointed ears, open jaws with fangs.
- [x] The six goblins no longer share one silhouette: a fat crowned Grub, a spiked and war-painted Warchief with trophy skulls, a caped and breastplated Captain, a lamp-lit Tunneler, a hooded, scarfed Ambusher with two daggers.
- Still shared: orcs, trolls and the stone constructs reuse one body plan per family (differing in gear, scale and colour); the flying and ghost families are unchanged.

## Middle-earth roster (2026-10-22, v1.2.0)
- [x] All 80 enemies re-themed (ids, stats and skills unchanged, so saves and balance are intact): Moria goblins and cave-orcs, Gundabad orcs with wargs and riders, Isengard Uruk-hai (white hand) and Mordor orcs (red eye), Stone-, Hill- and Cave-trolls, Olog-hai, barrow-wights and the dwarf dead, Oathbreakers, the Black Rider, crows, fire-drakes.
- [x] Named villains: the Watcher in the Water (ch 1), Gollum (ch 2), Grishnákh (ch 2 boss), Azog the Defiler (ch 3 boss), Shelob (ch 4 boss), the cave-troll of Mazarbul (ch 5), the Nameless Thing (ch 6), the Wight-king (ch 7), the King of the Dead (ch 8), the Herald of Udûn (ch 9), the Balrog (ch 10). Boss skill names, phase text, lore, drop items, quests and chapter blurbs follow.
- [x] New art: a Watcher (seven arms from a pool), Gollum and his kin, wights, a Ringwraith, a crow, dwarf dead, Oathbreakers (fading ghosts), warg riders, chained and pillar-wielding trolls, Uruk sigils, a dragon-shaped drake, a rebuilt Balrog (flame mane, sword and whip of fire) with a lesser version for the Herald; orcs and goblins now have narrow slit eyes.
- [x] The "Original" reskin maps every new name to a neutral one (e.g. Gollum to Skulker, Azog to Vorg, Shelob to the Great Weaver); the leak test covers the new terms.
- Not done: the warg-and-rider pair is one sprite (the rider does not drop when the warg falls), and Gollum and Azog are not recurring villains across Ages (each appears once, in its chapter).

## Stability and performance review (2026-10-23, v1.2.1)
Prompted by two field reports: a descent that never loaded the next floor (retreat forced), and a laggy session after which every image failed until the app was restarted.
- [x] Battle graphics recover from a lost WebGL context or a stalled render loop (stage rebuilt from the live fight, one notice); the Phaser game now releases its GL context on teardown. Checked with `tools/ctxloss.cjs`.
- [x] The fight loop always reaches a result: an engine/UI exception resolves the rest of the battle instantly instead of stranding the floor; a stage that stops responding is skipped (15 s of visible time).
- [x] `hitStop` could leave the scene at 5 % speed if the tab was hidden mid-hit; time scale is now always restored, and room set-up is guarded step by step so one bad hero/enemy cannot block the floor.
- [x] Pixelised background sets are cached in a bounded LRU (8) keyed by source art, shared between hall/cavern/vault, and the next floor's room is built in idle time. The rendered-set cache was unbounded (potentially ~160 MB of canvases) and each floor change repeated the pixelise pass.
- [x] Canvas creation failure now throws a clear error and retries once with empty caches (it surfaced as `reading 'drawImage'` of null).
- [x] Status-icon rasterisation could never settle on a decode failure (stage init waited forever); failed decodes are no longer cached.
- [x] Saves: one IndexedDB connection (a new one per read/write leaked), serialised/coalesced writes, retry before demoting to localStorage, a visible warning if nothing can store the game.
- [x] Service worker keeps the previous cache generation (an open page's lazy chunks vanished after a redeploy) and no longer answers a missing script with the HTML shell; a failed chunk import reloads the page once; an error boundary replaces blank screens.
- Soak (`tools/soak.cjs`, auto-delve at 4×): 70 floors in 7 min, heap 45–75 MB, textures plateau ~290, 60 fps, 0 errors.
- [~] Not provable: the exact cause of the user's stuck floor (the app was restarted); every plausible path above is closed.

## iPad blur (2026-10-23, v1.2.2)
- [~] Top bars looked blurry on iPad in combat. Two Safari-specific causes fixed (no iPad here, so not verified on the device): CSS-mask pixel icons were enlarged by Safari with smoothing (it ignores `image-rendering` on masks) — masks are now pre-enlarged 12× with nearest-neighbour so there is nothing to smooth; the next-up timeline portrait used `transform: scale(1.2)` (rasterised at 1× then enlarged) — now sized directly.
