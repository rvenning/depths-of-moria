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
- [~] Audio is synthesised (WebAudio) and was checked only by code and test, never listened to. Expect to tune mix and music taste by ear.
- [~] Phaser battle pacing and animation feel were verified in real Chrome only; the in-app preview pane throttles requestAnimationFrame to about 1 fps. Measured about 56 fps in Chrome.
- [~] Art is procedural, not hand-drawn. Similar creature families (troll/orc variants) share body plans and could use more silhouette variety.
- [~] Multi-hour feel (pacing of the later Ages, whether the grind is fun) is unvalidated by a human player.
- [ ] No colour-blind palette option (high contrast, text size and reduced motion exist).
- [ ] No store packaging. The game is a PWA; there is no Steam/app-store wrapper.
- [ ] Not deployed. By design (see RIGHTS.md) this fan-concept build stays private; do not publish it, or put it on the games hub or newsletter, without an Original-reskin decision first.
- [ ] Optional polish: per-hero voice barks, localisation, more event art.
