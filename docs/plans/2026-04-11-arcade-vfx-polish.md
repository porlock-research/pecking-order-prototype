# Arcade VFX Polish Pass

**Date:** 2026-04-11
**Scope:** Bring all pre-batch-2 arcade games up to the VFX + feedback quality established by Snake, Flappy, Color Sort, and Inflate.

## Context

Batch 2 (Inflate → Snake → Flappy → Color Sort) established a consistent feel for arcade games:

- **Canvas-based rendering** with deterministic `mulberry32(seed)` randomness
- **Theme adaptation** via `useCartridgeTheme(containerRef)` so games pick up shell colors (gold, info, danger, etc.)
- **VFX primitives** from `apps/client/src/cartridges/games/shared/canvas-vfx.ts`:
  `ParticleEmitter`, `ScreenShake`, `ScreenFlash`, `FloatingTextEmitter`, `PulseRingEmitter`, `SpringValue`, `SlowMo`
- **Milestone feedback**: on key thresholds (every 5/10/25/40), trigger slow-mo + screen flash + shake + radial pulse + particle burst + floating text
- **Score pulse** spring on every point change
- **Death/game-over VFX**: fragments scatter, slow-mo, colored flash, floating "CRASHED!" / "TIME'S UP!"
- **Pixel-snapping via `px(v) = Math.round(v)`** for crisp rendering on animated elements
- **End-of-game guard** via a single `ending` flag so end-frame effects fire exactly once

The older games either (A) use canvas + some VFX but without milestone/slowmo polish, or (B) are DOM-based with zero VFX. This plan upgrades both tiers to the batch-2 bar.

## Reference Files (The "Gold Standard")

- `apps/client/src/cartridges/games/snake/SnakeRenderer.tsx` — continuous-motion arcade pattern (Bezier body, ambient particle trail, bouncing obstacles, milestone ladder, crash debris)
- `apps/client/src/cartridges/games/inflate/InflateRenderer.tsx` — multi-entity + patience-timer pattern (score breakdown, streak meter, float-up banking VFX)
- `apps/client/src/cartridges/games/color-sort/ColorSortRenderer.tsx` — puzzle pattern (spring-lift, gravity-fall settle, tube-complete celebration, full-solve rainbow overlay, `ending` guard)
- `apps/client/src/cartridges/games/flappy/FlappyRenderer.tsx` — side-scroller with committed visual theme (SMB3 palette, parallax layers, top HUD strip)
- `apps/client/src/cartridges/games/shared/canvas-vfx.ts` — the full primitive library

## Game Inventory

### Tier A — Canvas + some VFX, needs polish (5 games)

These already use canvas-vfx primitives but lack milestone VFX, slow-mo, consistent themed particle palettes, and polished death states. They need **upgrade passes**, not rewrites.

| Game | LOC | VFX imports | Themed | Key gaps |
|---|---|---|---|---|
| `gap-run/GapRunRenderer.tsx` | 637 | 8 | ✓ | No milestones; add slow-mo on big jumps, streak pulse |
| `stacker/StackerRenderer.tsx` | 485 | 6 | partial | Fully theme the blocks; milestone on every 5-stack; tower-topple slow-mo + debris |
| `beat-drop/BeatDropRenderer.tsx` | 658 | 5 | partial | Perfect-hit rings, combo milestone ladder (10/25/50), miss-streak shake |
| `shockwave/ShockwaveRenderer.tsx` | 522 | 8 | partial | Wave-clear flash per clear, slow-mo on wave N milestones |
| `orbit/OrbitRenderer.tsx` | 576 | 5 | partial | Transfer-completion VFX, orbital-streak pulse, gravity-assist success burst |

### Tier B — DOM-based, zero VFX (7 games)

These are React DOM renderers, no canvas. They need **light DOM-level polish** (framer-motion, tailwind animation, spring feedback) — not canvas rewrites. A full canvas conversion would be 2x the work; better to match the batch-2 feel via strong DOM motion.

| Game | LOC | Approach |
|---|---|---|
| `reaction-time/ReactionTimeRenderer.tsx` | 178 | Spring flash, combo streak counter, sub-100ms "LEGENDARY" callout |
| `color-match/ColorMatchRenderer.tsx` | 188 | Correct-answer burst, streak badge, wrong-answer screen shake |
| `quick-math/QuickMathRenderer.tsx` | 207 | Same combo framework as color-match, sequential streak colors |
| `simon-says/SimonSaysRenderer.tsx` | 185 | Tile-pulse on each playback step, success ring per completed round |
| `grid-push/GridPushRenderer.tsx` | 217 | Cell-bank burst, chain-reaction lines, board-clear celebration |
| `aim-trainer/AimTrainerRenderer.tsx` | 206 | Target-hit particle spray, accuracy callouts ("BULLSEYE!"), miss shake |
| `sequence/SequenceRenderer.tsx` | 246 | Sequence-playback shimmer, success confetti, round-number pulse |

### Tier C — Out of scope

- `touch-screen/TouchScreen.tsx` (272L, DOM — intentional social-driven mechanic, the UI chrome is part of the game design)
- Live/decision cartridges: `trivia`, `realtime-trivia`, `bet-bet-bet`, `blind-auction`, `kings-ransom`, `the-split` — these are not arcade-feel games; different aesthetic intent

## Per-Game Polish Checklist

Every Tier A game gets:

- [ ] **Theme adoption** — replace any hardcoded color with `theme.colors` via `useCartridgeTheme(containerRef)`
- [ ] **Milestone ladder** — define `MILESTONES: { score, text }[]` (usually 3–5 steps). On crossing, fire:
  `slowMo.trigger(0.5, 200)` + `flash.trigger(withAlpha(gold, 0.25), 120)` + `shake.trigger({ intensity: 6, duration: 220 })` + `pulseRings.emit(...)` + `particles.emit(...)` (35 particles) + `floatingText.emit(text)`
- [ ] **Score pulse spring** — `SpringValue` applied to HUD score font scale on every point change
- [ ] **Death/game-over VFX** — fragments scatter from relevant points, slow-mo, red/danger screen flash, "CRASHED!" or "TIME'S UP!" floating text, 600–700ms delay before `onResult()`
- [ ] **Ending guard** — single `ending` boolean flag so end-frame effects fire exactly once (lesson learned from Color Sort)
- [ ] **Pixel-snapping helper** — `const px = v => Math.round(v);` applied to all animated entity positions before draw calls
- [ ] **Ambient particles** — light continuous particle emission (trail, confetti, whatever fits) for liveness

Tier B games get a lighter, DOM-adapted version:

- [ ] **Framer-motion spring reveal** on any "answer" or "choice" UI
- [ ] **Combo streak counter** with colored escalation (info → gold → danger)
- [ ] **Floating text** via `<motion.div>` above the action area on key events
- [ ] **CSS keyframe shake** on wrong-answer / miss
- [ ] **Sonner toast** (already available) for streak callouts if inline reveal feels too loud

## Execution Plan (split across sessions)

Each session tackles **2–3 games** to stay focused and leave room for playtest + iteration. Commit per-game or per-batch.

- **Session 1 (Tier A, motion-heavy):** gap-run + stacker (both physics-ish, good together)
- **Session 2 (Tier A, rhythm + waves):** beat-drop + shockwave (VFX-heavy, related)
- **Session 3 (Tier A, spatial):** orbit (standalone, complex)
- **Session 4 (Tier B, answer-based):** reaction-time + color-match + quick-math (same combo framework)
- **Session 5 (Tier B, memory):** simon-says + sequence
- **Session 6 (Tier B, targeting):** grid-push + aim-trainer

Total: ~6 focused sessions.

## Conventions to Repeat

1. **Integer result payloads** — every `onResult({...})` uses integer values. Floats get floor'd by arcade-machine.ts (guardrail `finite-arcade-result-integer-coercion`).
2. **Harness wiring** — new/modified games touching GameType union must update 3 places in `apps/client/src/components/GameDevHarness.tsx` (guardrail `finite-game-dev-harness-local-types`). Not needed for polish-only changes that don't add types.
3. **Leaderboard key** — if result payload shape changes, update `GAME_STAT_CONFIG` in `apps/client/src/cartridges/games/shared/Leaderboard.tsx`.
4. **Typecheck before commit** — `npx tsc --noEmit` from `apps/client`, `packages/game-cartridges`, `apps/game-server` (registry consumer).
5. **Play-test via chrome MCP** — tab must be foregrounded (hidden tabs throttle RAF to 0). Lesson learned during Color Sort verification.

## Risks / Watch-outs

- **Over-polish — milestone text pollution.** Don't add milestones at every score bump; 3–5 total across a run, with the highest reserved for near-end scores only seasoned players hit.
- **Theme clashes with committed palettes.** Flappy chose SMB3 over themed colors for the arena (pipes, ground, sky); kept themed VFX particles only. If a game has a distinct visual identity (stacker blocks, beat-drop tracks), respect that — don't force theme on chromed elements.
- **Slow-mo exhaustion.** If a game has rapid scoring, slow-mo on every milestone becomes annoying. For beat-drop / color-match where hits are frequent, use slow-mo only on combo-break (miss) and end-of-game, not on every correct hit.
- **Canvas size consistency.** Batch-2 games use 400×400 or 400×460. Older games may be 300×400 or other sizes. Don't resize canvases during polish — it breaks the wrapper layout. Keep each game at its current size unless there's a specific reason.

## Out of Scope

- New game types (batch 2 is done; polish is separate work)
- Migrating DOM-based games to canvas (too much churn; DOM polish is sufficient for now)
- Touch-screen, trivia, and decision cartridges (different design intent)
- Balance/difficulty curve changes (polish-only — same scoring rules)
