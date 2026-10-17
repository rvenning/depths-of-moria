# Asset manifest

There are **no external image, audio or model files**. Everything the player sees and hears is generated at runtime from code.

## Generated art (src/art)
| Module | Produces |
|---|---|
| `heroes.ts` + `pixel/heroSprites.ts` | 7 hero sprites, 72×92 native pixels, drawn with the pixel engine (`pixel/engine.ts`): each part is a shape that is shaded by an inflate height-field, mapped to a hue-shifted 5-step ramp with ordered dithering, then given an outer outline and selective inner outlines |
| `creatures.ts` | 18 body-plan families × palettes/features → 80 distinct enemies, minis, elites and bosses; each painting is boiled down 3:1 to native pixel art by `pixel/pixelize.ts` (palette quantised, dithered, outlined) |
| `backgrounds.ts` | 10 chapter themes × 8 room shapes (hall, corridor, cavern, stair, vault, bridge, shrine, arena): 4 parallax layers (painted, then pixelised 2:1 to 480×240 native, with an 8px pad so they can drift), light sources (rendered as dithered glows), theme particles (single pixels) |
| `camp.ts` | the camp scene (tent, forge, shrine, map table, rack, notice board, lectern, campfire), pixelised, with the party standing around the fire as native pixel sprites |
| `icons.ts` | 111 original line icons (skills, statuses, items, resources, UI) as SVG fragments, rasterised once at start-up to 16×16 pixel masks (recoloured with CSS `currentColor`) |

Everything is drawn at a native pixel size and shown at an integer zoom (one art pixel = 2 stage pixels; UI frames use 4px steps), with Phaser in `pixelArt` mode, so every pixel on screen is square. Sprites and rooms are cached; the battle scene registers them as Phaser textures. Hit effects, projectiles, glows and shadows are tiny hand-set pixel textures.

## Generated audio (src/audio/audio.ts)
- Generative score per chapter: drone pad + sparse plucks on a chapter-specific mode and tempo, war drums in fights (boss tempo ×1.5)
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
