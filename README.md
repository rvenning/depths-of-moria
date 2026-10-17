# The Fellowship: Depths of Moria

A polished, single-player fantasy auto-battler in the long-form spirit of Soda Dungeon: ten Ages, a thousand authored floors, seven named heroes, relics, fellowship bonds, a Balrog, an ending, an endless Deep Delve and a challenge ladder. TypeScript · React · Phaser 4 · Vite. Offline-first PWA, no backend.

> **Private fan-game concept.** It borrows names from Tolkien's legendarium as a creative theme and must not be distributed without permission. A clean original reskin is built in. Read `docs/RIGHTS.md` first.

## Run it

```bash
npm install
npm run dev          # http://localhost:8140
npm test             # 150+ unit / integration tests (engine, content, progression, saves)
npm run typecheck
npm run build        # tsc + vite build → dist/ (with service worker)
npm run preview      # http://localhost:8141
npm run e2e          # Playwright smoke test against the built app (needs Chrome, or CI)
npm run sim          # progression bot through the campaign (tools/sim.ts)
node tools/balance.ts 3 --write   # full balance report → docs/BALANCE_REPORT.md
node tools/calibrate.ts           # refit the per-Age enemy multipliers against the bot
npm run icons        # regenerate PWA icons
```

Debug: press <kbd>`</kbd> in game for the developer panel (resources, instant level-ups, boss win-rate simulator). `?` in the URL is unused; `#gallery` shows every sprite and room (`#gallery/bg`, `#gallery/1…5`).

## Controls
Mouse or touch everywhere; everything is also keyboard-reachable. In battle: <kbd>Space</kbd> pause / fight · <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> speed 1× 2× 4× · <kbd>S</kbd> skip the battle · <kbd>A</kbd> auto-delve · <kbd>L</kbd> log · <kbd>Enter</kbd> continue. The battle log is a live region for screen readers.

## How the game works
- **Camp → Delve → Camp.** Pick up to five heroes (3 front, 2 back), tune their priority rules, launch from any checkpoint (every 10th floor). Battles resolve themselves with an initiative gauge, rows, statuses, boss phases and telegraphed hazards.
- **Ages.** Beat a chapter's boss, then *descend*: gold, ore, cloth, ordinary gear and camp facilities reset; heroes, levels, talents, relics, bonds, lore, renown, legendaries and locked heirlooms stay. A preview and an explicit confirmation come first.
- **Growth.** Hero levels (cap +10 per Age) and 10 talents each · five-slot gear with rarities, affixes, 10 sets and 10 boss legendaries · forge upgrades (Age 3) · relics with soft caps · camp facilities (gold) and Legacy upgrades (renown) · bonds with scenes and tier-3 combos · quests and achievements.
- **After the Balrog.** The ending, then the Deep Delve (floors 1001+, a boss every 25) and a 30-rung Challenge Ladder.

## Architecture
See `docs/ARCHITECTURE.md`. In short: `content/` (pure data) → `core/` (deterministic simulation, no DOM) → `persistence/`, `audio/`, `art/` → `ui/` and `battle-scene/` (Phaser plays back the engine's event stream). `core/bot.ts` plays the real state machine and drives both the balance tools and the integration tests.

## Saves
IndexedDB (localStorage fallback), versioned schema (`src/persistence/migrations.ts`), autosave after every floor and every camp action, export / import with a checksum. `tests/persistence.test.ts` covers round-trips, migration from the v1 internal schema, corruption and future versions.

## Deployment
It is a static site (`dist/`). The project is **not published**: the design treats it as a private fan concept. If you later have permission (or ship the Original reskin): make "Original" the default (see `docs/RIGHTS.md`), `npm run build`, and host `dist/` on any static host (GitHub Pages works: `base` is `./`). The service worker precaches the build for offline play; a new build installs beside the old cache and takes over on the next load.

## Documents
`docs/ARCHITECTURE.md` · `docs/TRACKER.md` (milestones, test results, completed-vs-remaining audit) · `docs/BALANCE_REPORT.md` · `docs/RIGHTS.md` · `docs/ASSETS.md`
