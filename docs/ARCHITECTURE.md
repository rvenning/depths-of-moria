# Depths of Moria — Architecture

Private fan-game concept (see RIGHTS.md). TypeScript + React + Vite, Phaser 4 battle scene, WebAudio synthesis, IndexedDB saves, offline PWA.

## Deviations from the "prefer" list in the design
| Spec said | Built | Why |
|---|---|---|
| Phaser 3 / PixiJS for 2D combat | **Phaser 4** (npm latest 4.2.1) for the battle scene only (`src/battle-scene`); React for all menus | Matches the spec and the Tiny Rex pipeline. Phaser gets tweens, particles, parallax, camera FX and GPU filters; procedural art is baked to canvases and registered as textures. |
| vite-plugin-pwa | Hand-written build plugin that emits `sw.js` with a content-hashed precache (same as Scopa) | No extra dependency, deterministic. |

## Layers (dependency direction ↓ only)
```
content/      pure data: heroes, skills, enemies, items, relics, events, lore, quests…
core/         pure logic, no DOM: rng, stats, battle engine, floors, loot, economy,
              progression, expedition, ages, game reducers, balance config
persistence/  IndexedDB (localStorage fallback), versioned schema, migrations, export/import
audio/        WebAudio synth: music director + SFX + volume buses
art/          pixel engine (pixel/engine.ts), hero rigs (heroSprites.ts), creature drawings (creatureSprites.ts), effect frames (fxFrames.ts), vector painters for backgrounds/camp that are pixelised (pixelize.ts), animated camp and title scenes, icons, sprite cache
ui/           React screens/components, battle canvas view, hooks
tools/        balance simulation CLI, icon generator
tests/        unit, integration, e2e
```
`core/` and `content/` never import DOM, React, audio or art, so the balance CLI and the unit tests run them headless under Node.

## Determinism
`core/rng.ts` is a seeded sfc32. Every battle takes `seed = hash(accountSeed, floor, attempt)`. The battle engine is a state machine emitting typed `BattleEvent`s; the renderer plays events, the CLI just runs to completion. Same seed + same setup ⇒ identical log (tested).

## Battle engine (`core/battle`)
- ATB gauge initiative: `gauge += speed`; act at 1000; ties break by speed → slot → heroes first. A round = 10 time units (a speed-100 unit acts once per round). Hazards, enrage and cooldowns key off rounds.
- Damage: `max(1, raw × skillMult × 100/(100+def) × bounded modifiers)`; modifiers are summed then clamped to [-60%, +200%].
- Hit: `clamp(accuracy − evasion, 15, 100)`%; crit chance capped at 75%.
- Rows: front (slots 0–2) soak melee; ranged/magic and `bypass` skills ignore the row rule while any front unit lives.
- Hero AI = ordered, editable priority list (`heal-below`, `cleanse`, `focus-marked`, `aoe-3`, `ultimate`, `buff-opener`, `guard-low`, `basic`) + target preference. Every decision logs the rule that fired.
- Stall guard: round 25+ enemies enrage (+8%/round atk); round 60 is a defeat.

## Game state (`core/game.ts`)
One serialisable `GameState`; every mutation is a pure function `(state, args) => state` or returns events. The UI holds a tiny store (`ui/store.ts`) with `useSyncExternalStore`. Autosave is debounced and fires after every floor and every camp action.

## Content schema
See `src/content/schema.ts` (types) — every content table is `Record<Id, Def>` validated by `tests/content.test.ts` (referential integrity, counts vs. the spec's minimums, every skill has an effect and a tooltip).

## Asset plan
No external assets. Art: a pixel-art look ("Pixel Delve"): heroes are drawn natively with a small pixel engine (shape masks, inflate-shaded, hue-shifted ramps, ordered dither, outlines); creatures, rooms and the camp are painted procedurally and then pixelised; UI frames are notched 4px borders. Audio: synthesised pads/plucks (original, generative per chapter) and SFX. Font: Jersey 15, bundled. Manifest of everything in `docs/ASSETS.md`.

## Milestones → see TRACKER.md
