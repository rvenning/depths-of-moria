# Asset manifest

There are no hand-made or downloaded image, audio or model files. Art and effects are generated at runtime from code. Two generated asset sets are rendered *offline* by tools in this repo and shipped as files: the **orchestral music** (`public/music`, below) and the **modelled chapter-1 backdrops** (`public/backdrops`, below).

## Generated art (src/art)
| Module | Produces |
|---|---|
| `heroes.ts` + `pixel/heroSprites.ts` | 7 hero sprites, 72×92 native pixels, each with a posable rig (4-frame idle with breathing and blinking, wind-up, strike, hurt, cast, victory), drawn with the pixel engine (`pixel/engine.ts`): each part is a shape that is shaded by an inflate height-field, mapped to a hue-shifted 5-step ramp with ordered dithering, then given an outer outline and selective inner outlines |
| `creatures.ts` + `pixel/creatureSprites.ts` | 18 body-plan families × palettes/features → 80 distinct enemies, minis, elites and bosses, drawn natively by the pixel engine (same shading, dither and outlines as the heroes); wind-up, strike, hurt and breathing frames are derived from the base sprite |
| `backgrounds.ts` | 10 chapter themes × 8 room shapes (hall, corridor, cavern, stair, vault, bridge, shrine, arena): 4 parallax layers (painted, then pixelised 2:1 to 480×240 native, with an 8px pad so they can drift), light sources (rendered as dithered glows), theme particles (single pixels) |
| `camp.ts` | the camp scene (tent, forge, shrine, map table, rack, notice board, lectern, campfire), pixelised, with the party standing around the fire as native pixel sprites |
| `icons.ts` | 111 original line icons (skills, statuses, items, resources, UI) as SVG fragments, rasterised once at start-up to 16×16 pixel masks (recoloured with CSS `currentColor`) |

Everything is drawn at a native pixel size and shown at an integer zoom (one art pixel = 2 stage pixels; UI frames use 4px steps), with Phaser in `pixelArt` mode, so every pixel on screen is square. Sprites and rooms are cached; the battle scene registers them as Phaser textures. Hit effects, projectiles, glows and shadows are tiny hand-set pixel textures.

## HD-2D layer (src/battle-scene)
- Every sprite and backdrop layer has a normal map (exact for hand-built sprites, derived from brightness for painted layers) and is lit in real time by Phaser 4 lights: torches flicker, spells and hits flash coloured light, chapters have their own ambient tint.
- Bloom (parallel threshold + blur filter) and a vignette on the camera; depth of field baked into the backdrop textures (soft far wall, defocus toward the top and bottom edges).
- `vfx.ts` / `pixel/fxFrames.ts`: 13 procedurally drawn pixel effect clips (flame, burst, slash arc, heal, ice, lightning, aura, shield, smoke, shadow, poison, rays, impact), mapped to each skill's effect type.
- Cinematics: letterboxed boss introduction with a push-in, crit hit-stop and screen punch, turn marker, victory confetti.
- A Graphics setting (Auto / HD-2D / Plain pixels); Auto falls back to plain pixels when the frame rate is poor.

## Sampled orchestral score (public/music, tools/music)
- 40 tracks: every chapter (1–10) × title, camp, battle, boss. The pieces are the runtime composer's (`score.ts`), orchestrated for strings, cello, harp, flute/oboe, brass, choir, timpani and drums (`tools/music/render-music.ts`), rendered through the **MuseScore_General (Lite)** soundfont with `spessasynth_core`, given a Freeverb room, normalised to **−17 LUFS** (ITU-R BS.1770, all 40 within ±0.1), soft-limited and encoded to 96 kbps MP3 (19 MB in all; each track is fetched when first needed and cached by the service worker).
- Each file carries a 4608-sample pre-roll and the encoder delay (`manifest.json`), so the player loops the body gaplessly with `loopStart`/`loopEnd`; the loop's last 93 ms is spliced to the audio that precedes its first sample, so there is no click at the wrap. `node tools/music/verify.cjs` decodes every file in Chrome and checks duration, dropouts, spectrum, the click at the seam and the level step across it.
- Licence: MIT (parts CC0/PD) — recorded in `docs/RIGHTS.md` and shipped as `public/music/LICENSES.txt`.
- The synth below is the fallback (missing track, decode failure, or *Orchestral score* switched off in Settings).

## Generated audio (src/audio/audio.ts, src/audio/score.ts)
- A composed score per chapter and mood: `score.ts` writes an 8-bar piece (chord progression stacked from the chapter's mode, a two-phrase melody that answers itself and closes on the tonic, a harp figure, a bass line); `audio.ts` performs it with string pad, harp, flute-like lead, bass, taiko, snare, and (for bosses) brass stabs and a choir pad, over the drone and ambience beds
- Ambience bed (filtered noise + drips) per chapter theme
- 25+ synthesised sound effects (hits, crits, magic, heals, shields, deaths, boss phases, hazards, combos, fanfares)
- Four independent buses: master, music, sound effects, ambience

## Fonts (bundled locally, SIL OFL 1.1, via Fontsource)
- Jersey 15 (pixel face; `@fontsource/jersey-15`)

## Libraries
| Package | Licence | Use |
|---|---|---|
| phaser 4.2.1 | MIT | battle scene renderer |
| react / react-dom 18 | MIT | interface |
| vite, vitest, typescript | MIT / Apache-2.0 | build and test |
| sharp, playwright-core | Apache-2.0 | icon generation, e2e (dev only) |

## Content volumes (verified by tests/content.test.ts)
10 chapters · 10 bosses · 20 mini/elite variants (+ 10 elites) · 40 normal enemies · 7 heroes (3 skills, 1 passive, 10 talents each) · 130 items in 10 sets + 10 boss legendaries · 15 affixes · 6 relics · 21 hero-pair bonds (63 scenes, 21 combos) · 24 events · 33 quests · 30 achievements · 46 lore entries · 15 room variants.

## Modelled backdrops (public/backdrops, tools/backdrop)
- Every chapter has a modelled `hall` and boss `arena` (20 rooms, about 70 KB each as lossy WebP, 1.4 MB in all), modelled and lit in Blender 4.5 by one parametric script (`tools/backdrop/hall.py`: procedural stone from the chapter's palette, torches, moon/furnace light, depth haze) and rendered with Cycles as four separable layers (far / mid / floor / near; each layer is rendered with the others as holdouts, so shadows and bounce light are baked in). Each chapter adds its own features: balcony gallery (2), furnace and lava channels (3), stair up to the light (4), banners (5), flooded pools (6), bookshelves (7), crystals over a void (8), lava (9), a stone span over fire (10), plus a pillar style per chapter. `pack.py` projects the torches to screen space for the game's flames and lights.
- Room shapes map onto them in `backgrounds.ts` (`RENDERED_SOURCE`): hall, cavern and vault use the hall; corridor, stair, bridge and shrine use it mirrored; every boss floor uses the arena. The painted room painters remain as the fallback if the files fail to load.
- At runtime they go through the same pixelise + dither + depth-of-field pipeline as the painted layers (more tones), and the scene treats them as pre-lit: the backdrop is not re-lit, the torches only light the sprites.
- Rebuild everything: `tools/backdrop/all.sh 160` (about 10 minutes); one room: `tools/backdrop/run.sh tools/backdrop/hall.py .scratch/out 160 960 hall|arena CHAPTER`, then `python -I tools/backdrop/pack.py .scratch/out CHAPTER hall|arena`; `tools/backdrop/sheet.py` makes a contact sheet.
