# Asset manifest

There are **no external image, audio or model files**. Everything the player sees and hears is generated at runtime from code.

## Generated art (src/art)
| Module | Produces |
|---|---|
| `heroes.ts` | 7 hero sprites (256×256 canvases, painted with a shared ink-outline + rim-light pen) |
| `creatures.ts` | 18 body-plan families × palettes/features → 80 distinct enemies, minis, elites and bosses |
| `backgrounds.ts` | 10 chapter themes × 8 room shapes (hall, corridor, cavern, stair, vault, bridge, shrine, arena): 4 parallax layers, light sources, theme particles |
| `camp.ts` | the illustrated camp scene (tent, forge, shrine, map table, rack, notice board, lectern, campfire) |
| `icons.ts` | 111 original line icons (skills, statuses, items, resources, UI) as SVG fragments |

Sprites and rooms are cached; the battle scene registers them as Phaser textures.

## Generated audio (src/audio/audio.ts)
- Generative score per chapter: drone pad + sparse plucks on a chapter-specific mode and tempo, war drums in fights (boss tempo ×1.5)
- Ambience bed (filtered noise + drips) per chapter theme
- 25+ synthesised sound effects (hits, crits, magic, heals, shields, deaths, boss phases, hazards, combos, fanfares)
- Four independent buses: master, music, sound effects, ambience

## Fonts (bundled locally, SIL OFL 1.1, via Fontsource)
- EB Garamond Variable · Cormorant Garamond Variable

## Libraries
| Package | Licence | Use |
|---|---|---|
| phaser 4.2.1 | MIT | battle scene renderer |
| react / react-dom 18 | MIT | interface |
| vite, vitest, typescript | MIT / Apache-2.0 | build and test |
| sharp, playwright-core | Apache-2.0 | icon generation, e2e (dev only) |

## Content volumes (verified by tests/content.test.ts)
10 chapters · 10 bosses · 20 mini/elite variants (+ 10 elites) · 40 normal enemies · 7 heroes (3 skills, 1 passive, 10 talents each) · 130 items in 10 sets + 10 boss legendaries · 15 affixes · 6 relics · 21 hero-pair bonds (63 scenes, 21 combos) · 24 events · 33 quests · 30 achievements · 46 lore entries · 15 room variants.
