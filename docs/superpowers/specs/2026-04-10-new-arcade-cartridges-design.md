# New Arcade Cartridges — Design Spec

**Date:** 2026-04-10
**Status:** Draft
**Scope:** 3 new arcade minigames + shared canvas VFX module

## Overview

Add three visually compelling arcade cartridges — Shockwave, Orbit, and Beat Drop — that raise the visual quality bar through procedural canvas effects. Introduce a shared VFX module that is theme-aware (reads from `CartridgeTheme`) and reusable by both new and existing games.

### Design Goals

- **Visually striking** — heavy use of particles, glow, trails, screen shake, slow-mo, and color
- **Accessible with skill ceiling** — easy to pick up, meaningful score differentiation for skilled players, some seeded variance so anyone can have a good run
- **Under 2 minutes** — each game completes within 45-90 seconds
- **Themable** — all VFX consume `CartridgeTheme` colors, so they adapt to whichever shell (Classic, Immersive, Vivid) is active
- **Pure canvas** — no sprite assets, no audio files. All visuals are procedural

### Architecture Fit

Each game follows the existing arcade cartridge pattern:
- **Server:** `createArcadeMachine()` factory — gameType, timeLimit, computeRewards
- **Client:** Renderer component implementing `ArcadeRendererProps` (seed, difficulty, timeLimit, onResult)
- **Wrapper:** `ArcadeGameWrapper` handles lifecycle (start, retry, submit, celebration, leaderboard)

---

## Shared Canvas VFX Module

**Location:** `apps/client/src/cartridges/games/shared/canvas-vfx.ts`

A collection of composable canvas effect primitives. Each takes a `CartridgeTheme` (or relevant color subset) as input — never hardcodes colors.

### Primitives

#### ParticleEmitter

Spawns and updates a pool of particles with configurable behavior.

```typescript
interface ParticleConfig {
  count: number;                    // particles to spawn
  position: { x: number; y: number };
  velocity: { min: number; max: number };  // random velocity range
  angle: { min: number; max: number };     // emission arc (radians)
  lifetime: { min: number; max: number };  // ms
  size: { start: number; end: number };    // lerp over lifetime
  color: string | string[];               // single or random-from-array
  opacity: { start: number; end: number };
  gravity?: number;                        // downward pull
}

class ParticleEmitter {
  emit(config: ParticleConfig): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  clear(): void;
  readonly activeCount: number;
}
```

#### TrailRenderer

Renders a fading trail behind a moving object.

```typescript
interface TrailConfig {
  maxPoints: number;       // trail length (30-50 typical)
  width: { start: number; end: number };  // taper
  color: string | ((index: number, total: number) => string);  // gradient callback
  opacity: { start: number; end: number };
}

class TrailRenderer {
  push(x: number, y: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  clear(): void;
}
```

#### ScreenShake

Applies camera offset to create shake effects.

```typescript
interface ShakeConfig {
  intensity: number;   // max pixel offset
  duration: number;    // ms
  decay?: 'linear' | 'exponential';  // default exponential
}

class ScreenShake {
  trigger(config: ShakeConfig): void;
  update(dt: number): void;
  apply(ctx: CanvasRenderingContext2D): void;  // call before drawing
  restore(ctx: CanvasRenderingContext2D): void; // call after drawing
}
```

#### GlowRenderer

Draws objects with configurable glow/bloom effect using shadow APIs.

```typescript
function drawWithGlow(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,      // shadowBlur radius
  drawFn: () => void  // the actual draw call
): void;
```

#### SlowMo

Manages time dilation for dramatic moments.

```typescript
class SlowMo {
  trigger(factor: number, duration: number): void;  // e.g., 0.3 for 70% slow
  update(realDt: number): number;  // returns dilated dt
  readonly active: boolean;
}
```

#### ScreenFlash

Full-screen color flash overlay.

```typescript
class ScreenFlash {
  trigger(color: string, duration: number): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void;
}
```

#### PulseRing

Expanding ring effect (for impacts, captures, beats).

```typescript
interface PulseRingConfig {
  x: number; y: number;
  color: string;
  maxRadius: number;
  duration: number;
  lineWidth?: number;
}

class PulseRingEmitter {
  emit(config: PulseRingConfig): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
}
```

### Utility Functions

```typescript
// Re-export from @pecking-order/ui-kit — DO NOT re-implement
export { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';

// Seeded PRNG — extracted from existing copy-pasted mulberry32 implementations
// (currently duplicated in 9 renderer files). Single source of truth.
function mulberry32(seed: number): () => number;

// Lerp for smooth transitions
function lerp(a: number, b: number, t: number): number;

// Angle utilities
function normalizeAngle(a: number): number;
function angleBetween(x1: number, y1: number, x2: number, y2: number): number;
```

**Note:** `withAlpha` already exists in `@pecking-order/ui-kit/cartridge-theme` (line 66). `mulberry32` is currently copy-pasted across 9 renderer files — this module becomes the single source of truth. Existing renderers can migrate their imports incrementally.

### Theme Integration

All VFX primitives accept raw color strings. The game renderer is responsible for pulling colors from `CartridgeTheme` and passing them in. This keeps the VFX module decoupled from React/context — it's pure canvas logic.

```typescript
// Example: game renderer usage
const theme = useCartridgeTheme(containerRef);
particles.emit({
  color: [theme.colors.gold, theme.colors.orange, theme.colors.pink],
  // ...
});
```

### Incremental Adoption for Existing Games

Existing renderers (Gap Run, Stacker, etc.) can import individual primitives without rewriting. For example, Gap Run could add `ParticleEmitter` for landing effects and `ScreenShake` for death, while keeping its existing rendering logic unchanged.

---

## Game 1: Shockwave

### Concept

Neon survival in a circular arena. Contracting ring hazards pulse inward with gaps — dodge through them to survive.

### Timing

- **Duration:** 45-60 seconds (time limit from config)
- **Pacing:** Starts calm, reaches peak intensity around 35s

### Mechanics

- **Arena:** Circular play area centered on canvas. Player is a bright point that moves freely within it.
- **Waves:** Rings spawn at the arena edge and contract inward at constant speed. Each ring is an arc with 1-3 gaps.
- **Movement:** Player moves toward mouse/touch position at a fixed speed. Click/tap to dash (short burst, 3-second cooldown).
- **Scoring:** +1 per wave survived. Near-miss bonus (+0.5) for passing within 10px of a ring edge. Combo multiplier builds from consecutive waves survived without dashing: 1x (0-4 waves), 1.5x (5-9), 2x (10-19), 3x (20+). Resets to 1x on dash. Risky play rewarded.
- **Death:** Touch any ring wall.

### Difficulty Ramp

| Phase | Time | Gap Width | Ring Speed | Pattern |
|-------|------|-----------|------------|---------|
| Learn | 0-10s | 60° | Slow | Single rings, wide gaps |
| Build | 10-25s | 45°→30° | Medium | Narrower gaps, occasional double-ring |
| Intense | 25-40s | 30°→20° | Fast | Triple-rings, some rotating rings |
| Survival | 40s+ | 20°→15° | Very fast | Overlapping patterns, rotating + contracting |

Difficulty parameter (0-1, scales with day index) shifts all phases earlier and makes gaps narrower.

### Visual Effects

| Element | Rendering | Theme Colors |
|---------|-----------|--------------|
| Player | White core circle (6px) + glow halo (20px blur) | `theme.colors.text` core, `theme.colors.info` glow |
| Dash trail | 3-4 fading afterimage copies using TrailRenderer | `theme.colors.info` with decreasing opacity |
| Rings | Arc strokes (3px) with soft glow | Cycle through `gold`, `pink`, `danger`, `green` |
| Gap edges | Brighter accent dots at gap endpoints | Same as ring color, higher opacity |
| Near-miss | SlowMo (0.3, 100ms) + ScreenFlash + particle burst at pass point | `theme.colors.gold` particles |
| Background | Dark fill + faint radial grid lines from center + drifting particle dust | `theme.colors.bg`, grid in `textDim` at 0.05 opacity |
| Death | SlowMo (0.1, 300ms) → player shatters (particles) → rings freeze → ScreenFlash white → fade | `theme.colors.text` flash, `theme.colors.danger` particles |
| HUD | Wave count (top-left), combo multiplier (top-right), time (bottom-center) | `theme.colors.text` at 0.5 opacity, combo in `gold` |

### Server Machine

```
File: packages/game-cartridges/src/machines/shockwave.ts
gameType: 'SHOCKWAVE'
defaultTimeLimit: 60_000
computeRewards:
  silver = floor(wavesCleared / 3) + floor(nearMisses / 5), capped at 15
  gold = floor(wavesCleared / 15)
```

### Result Payload (sent by client via `onResult`)

```typescript
{
  wavesCleared: number;
  nearMisses: number;
  maxCombo: number;
  // timeElapsed is injected server-side by the arcade machine — do NOT send from client
}
```

### Controls

- **Desktop:** Mouse position = movement target. Click = dash.
- **Mobile:** Touch position = movement target. Tap = dash.

---

## Game 2: Orbit

### Concept

Cosmic physics/timing. A planet orbits a star — tap to release it tangentially toward the next star's gravity well. Chain transfers across a field of stars.

### Timing

- **Duration:** 60 seconds (time limit from config)
- **Pacing:** Meditative early, tense later as orbits speed up and wells shrink

### Mechanics

- **Star field:** A procedurally generated (seeded) field of stars, each with a gravity well radius. Stars are revealed as the camera follows the planet.
- **Orbit:** Planet orbits the current star in a circle. Orbit speed increases with each successful transfer.
- **Release:** Tap/click to release. Planet flies off tangentially based on current orbital position and speed.
- **Capture:** If the planet enters another star's gravity well, it locks into orbit around that star. Transfer complete.
- **Failure:** Planet leaves the canvas bounds without entering any gravity well. Game over.
- **Trajectory preview:** A dotted line extends from the planet showing the release direction. Hidden at difficulty > 0.6.
- **Perfect capture:** Landing within the inner 30% of a gravity well scores a perfect. Bonus points.

### Star Field Generation

Stars are generated ahead of the player in chunks. Each star has:
- Position (seeded random, constrained to be reachable from at least one prior star)
- Gravity well radius (decreases with progression: 80px → 40px)
- Color (warm palette: gold, orange, pink, white — seeded selection)
- Size (proportional to gravity well radius)

### Difficulty Ramp

| Phase | Transfers | Well Radius | Orbit Speed | Preview |
|-------|-----------|-------------|-------------|---------|
| Learn | 1-5 | 80px | Slow (1 rev/3s) | Visible |
| Build | 6-15 | 60px | Medium (1 rev/2s) | Visible (fading at difficulty > 0.4) |
| Challenge | 16-25 | 45px | Fast (1 rev/1.5s) | Hidden at difficulty > 0.6 |
| Elite | 25+ | 40px | Very fast (1 rev/1s) | Hidden |

Difficulty parameter shifts phases earlier and reduces well radii further.

### Visual Effects

| Element | Rendering | Theme Colors |
|---------|-----------|--------------|
| Planet | Small circle (8px) with bright core + glow | `theme.colors.info` core, glow halo |
| Comet trail | TrailRenderer (40 points), color shifts from info→pink over length | `theme.colors.info` → `theme.colors.pink` gradient callback |
| Stars | Radial gradient circles with glow. Subtle size pulse animation | Each star uses one of `gold`, `orange`, `pink`, `text` |
| Gravity wells | Faint concentric dashed circles. Intensity increases when planet is nearby | Star's color at `theme.opacity.subtle` |
| Orbit path | Dotted circle around current star | Star's color at 0.15 opacity |
| Trajectory preview | Dotted line from planet in release direction | `theme.colors.textDim` at 0.3 opacity |
| Capture | Star flashes bright + PulseRing + small particle shower outward + subtle zoom pulse | Star's color for all effects |
| Perfect capture | Larger PulseRing + "PERFECT" text pop + extra particles | `theme.colors.gold` |
| Background | Deep dark fill. Scattered tiny static stars (2-3 parallax layers). Very faint nebula color washes | `theme.colors.bg`, static stars in `text` at 0.1-0.3 |
| Death | Trail fades as planet drifts. Stars dim gradually. Quiet, lonely fade to black | All colors fade to 0 opacity |
| HUD | Transfer count (top-left), score (top-right). Minimal | `theme.colors.text` at 0.4 opacity |

### Camera

The canvas viewport follows the planet via a 2D camera offset applied to all drawing.

- **During orbit:** Camera centers on the current star (static).
- **During flight:** Camera lerps toward the planet position at ~5% per frame (smooth follow, slight lag creates dynamism).
- **On capture:** Camera lerps to center the new star over ~300ms (ease-out).
- **Viewport culling:** Only draw stars within `viewport + 100px` margin. Stars are generated in chunks ahead of the player's travel direction, so there's always content to fly toward.
- **Implementation:** `ctx.translate(-cameraX, -cameraY)` before drawing world objects, restore after. HUD draws without camera transform.

### Server Machine

```
File: packages/game-cartridges/src/machines/orbit.ts
gameType: 'ORBIT'
defaultTimeLimit: 60_000
computeRewards:
  silver = floor(transfers / 2) + floor(perfectCaptures / 3), capped at 15
  gold = floor(transfers / 10)
```

### Result Payload (sent by client via `onResult`)

```typescript
{
  transfers: number;
  perfectCaptures: number;
  longestChain: number;  // same as transfers since death ends game, but useful for leaderboard display
  // timeElapsed is injected server-side by the arcade machine — do NOT send from client
}
```

### Controls

- **Desktop:** Click anywhere to release.
- **Mobile:** Tap anywhere to release.

---

## Game 3: Beat Drop

### Concept

Rhythm lane game. Notes fall in 4 lanes — hit them on the beat line. Build combos for multiplied scores. 3 misses and you're out.

### Timing

- **Duration:** 90 seconds (time limit from config)
- **Pacing:** BPM ramps from 100 to 160 over the duration, creating a crescendo

### Mechanics

- **4 lanes:** Notes fall from top to bottom. Each lane has a distinct color.
- **Hit line:** Horizontal line near the bottom. Press the lane key when a note crosses it.
- **Timing grades:**
  - PERFECT: ±30ms — 100 points
  - GREAT: ±60ms — 60 points
  - GOOD: ±100ms — 30 points
  - MISS: >100ms or unpress — 0 points
- **Hold notes:** Elongated notes — press and hold until the tail passes the line. Scored on initial press timing + hold completion. *Implementation note: hold notes are the riskiest mechanic (no existing game has sustained interaction, mobile tap-vs-hold is tricky). If they prove buggy or feel bad, cut them — the base note types provide enough variety.*
- **Combo:** Consecutive non-miss hits build combo. Multipliers: 1x (0-9), 2x (10-24), 3x (25-49), 4x (50+). Miss resets to 0.
- **Lives:** 3 misses total = game over. Keeps tension high in a short game.

### Pattern Generation (seeded)

No audio files. The "rhythm" is created through regular note spacing at the current BPM.

- **BPM ramp:** 100 → 160 BPM over the game duration. BPM determines the time between beat positions.
- **Pattern templates:** The seeded PRNG selects from a library of short patterns (2-8 beats):
  - Singles (one lane per beat)
  - Doubles (two lanes simultaneously)
  - Runs (rapid succession in one lane — 1/2 or 1/4 beat spacing)
  - Sweeps (left-to-right or right-to-left across lanes)
  - Holds (sustained note in one lane, singles in others)
- **Difficulty scaling:** Early patterns are mostly singles and simple doubles. Higher difficulty introduces faster runs, multi-lane doubles, shorter holds, and 1/4 beat spacing.
- **Deterministic:** Same seed = same "song." Retrying plays the exact same pattern.

### Visual Effects

| Element | Rendering | Theme Colors |
|---------|-----------|--------------|
| Notes | Rounded pill shapes (36x14px) with gradient fill. Grow slightly approaching hit line (scale 1.0→1.15) | Lane colors derived from theme: L1=`pink`, L2=`orange`, L3=`info`, L4=`gold` |
| Hold notes | Pill head + translucent body column with lane-colored border | Same lane colors, body at `theme.opacity.medium` |
| Hit line | Horizontal gradient line spanning all lanes | Gradient of all 4 lane colors |
| Lane backgrounds | Very faint vertical bands | Lane colors at `theme.opacity.subtle` |
| Key indicators | Rounded rectangles at bottom, light up on press with ripple from hit line | Lane colors, brighter on press |
| PERFECT hit | Note explodes upward (ParticleEmitter, 15-20 particles). Hit line flashes in lane color. PulseRing. "PERFECT" text pops with spring scale | Lane color particles, `theme.colors.gold` text |
| GREAT hit | Smaller particle burst (8-10). Dimmer flash. "GREAT" text | Lane color, text at 0.7 opacity |
| GOOD hit | Minimal particles (4-5). No flash. "GOOD" text | Lane color at 0.5 opacity |
| MISS | Note shatters downward in dark fragments. Hit line flickers `danger`. ScreenShake (small). Life dot pulses | `theme.colors.danger` |
| Combo 2x | Lane backgrounds pulse faintly on each beat | Lane colors at `theme.opacity.medium` |
| Combo 3x | Background color wash shifts with each beat | `theme.colors.bg` blended with active lane color |
| Combo 4x | Screen edge glow pulses on beat. Notes leave brief trails. Background particle embers drift upward | `theme.colors.gold` edge glow, `theme.colors.orange` embers |
| Background | Near-black. Beat pulse: background brightens subtly on each beat position | `theme.colors.bg`, pulse via `bgSubtle` |
| Death (3rd miss) | All notes freeze, colors drain to grayscale, shatter from center outward | Grayscale transition, `theme.colors.danger` final flash |
| HUD | Score (top-left), combo counter + multiplier (top-right, scales up with combo), lives as dots (bottom-center) | `theme.colors.text`, combo in `gold`, lives in `danger`/`green` |

### Server Machine

```
File: packages/game-cartridges/src/machines/beat-drop.ts
gameType: 'BEAT_DROP'
defaultTimeLimit: 90_000
computeRewards:
  silver = floor(score / 500) + (accuracy === 1.0 ? 3 : 0), capped at 15
  gold = floor(score / 2500)
```

### Result Payload (sent by client via `onResult`)

```typescript
{
  score: number;
  perfectHits: number;
  maxCombo: number;
  accuracy: number;  // 0-1, fraction of non-miss hits
  // timeElapsed is injected server-side by the arcade machine — do NOT send from client
}
```

### Controls

- **Desktop:** D, F, J, K keys (standard rhythm game two-hand layout)
- **Mobile:** 4 tap zones at bottom of screen, one per lane. Zones span the full lane width and extend 80px upward from the bottom for generous touch targets.

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `apps/client/src/cartridges/games/shared/canvas-vfx.ts` | Shared VFX module (ParticleEmitter, TrailRenderer, ScreenShake, GlowRenderer, SlowMo, ScreenFlash, PulseRingEmitter, utilities) |
| `packages/game-cartridges/src/machines/shockwave.ts` | Shockwave server machine |
| `packages/game-cartridges/src/machines/orbit.ts` | Orbit server machine |
| `packages/game-cartridges/src/machines/beat-drop.ts` | Beat Drop server machine |
| `apps/client/src/cartridges/games/shockwave/ShockwaveRenderer.tsx` | Shockwave canvas renderer |
| `apps/client/src/cartridges/games/shockwave/Shockwave.tsx` | Shockwave wrapper component |
| `apps/client/src/cartridges/games/orbit/OrbitRenderer.tsx` | Orbit canvas renderer |
| `apps/client/src/cartridges/games/orbit/Orbit.tsx` | Orbit wrapper component |
| `apps/client/src/cartridges/games/beat-drop/BeatDropRenderer.tsx` | Beat Drop canvas renderer |
| `apps/client/src/cartridges/games/beat-drop/BeatDrop.tsx` | Beat Drop wrapper component |

### Modified Files

| File | Change |
|------|--------|
| `packages/shared-types/src/index.ts` | Add `SHOCKWAVE`, `ORBIT`, `BEAT_DROP` to `GameTypeSchema` |
| `packages/shared-types/src/game-type-info.ts` | Add entries to `GAME_TYPE_INFO` (see below) |
| `packages/shared-types/src/config.ts` | Add config constants (see below) |
| `packages/shared-types/src/cycle-defaults.ts` | Add to `GAME_POOL` (see below). NOT added to `LIVE_GAMES` — all three are solo arcade games. |
| `packages/game-cartridges/src/machines/index.ts` | Export + register in `GAME_REGISTRY` |
| `apps/client/src/components/panels/GamePanel.tsx` | Add lazy imports to `GAME_COMPONENTS` |
| `apps/client/src/cartridges/games/shared/Leaderboard.tsx` | Add stat config to `GAME_STAT_CONFIG` (see below) |

### GAME_POOL Entries

Append after existing arcade games (end of array). All `minPlayers: 2`:

```typescript
{ type: 'SHOCKWAVE', minPlayers: 2 },
{ type: 'ORBIT', minPlayers: 2 },
{ type: 'BEAT_DROP', minPlayers: 2 },
```

### GAME_STAT_CONFIG Entries

```typescript
SHOCKWAVE: { key: 'wavesCleared', label: 'Waves' },
ORBIT:     { key: 'transfers',    label: 'Transfers' },
BEAT_DROP: { key: 'score',        label: 'Score' },
```

### Config Constants

```typescript
Config.game.shockwave = {
  timeLimitMs: 60_000,
  scorePerSilver: 3,       // wavesCleared divisor
  nearMissBonus: 5,        // nearMisses divisor for bonus silver
  scorePerGold: 15,        // wavesCleared divisor
};

Config.game.orbit = {
  timeLimitMs: 60_000,
  transfersPerSilver: 2,
  perfectsPerBonusSilver: 3,
  transfersPerGold: 10,
};

Config.game.beatDrop = {
  timeLimitMs: 90_000,
  scorePerSilver: 500,
  perfectAccuracyBonus: 3, // bonus silver for 100% accuracy
  scorePerGold: 2500,
  startBpm: 100,
  endBpm: 160,
  maxLives: 3,
};
```

### DemoServer

The DemoServer (`apps/game-server/src/demo/`) is chat-only — no game cartridge references. Adding to `GAME_REGISTRY` does **not** require DemoServer changes. Verified: no compilation impact.

---

## Reward Balancing Summary

| Game | Time | Silver Formula | Max Silver | Gold Formula |
|------|------|---------------|------------|-------------|
| Shockwave | 60s | waves/3 + nearMisses/5 | 15 | waves/15 |
| Orbit | 60s | transfers/2 + perfects/3 | 15 | transfers/10 |
| Beat Drop | 90s | score/500 + accuracy bonus | 15 | score/2500 |

All follow the existing pattern: silver is the primary reward (capped at 15), gold is a smaller contribution from exceptional play.

---

## Wrapper Components

Each game's wrapper component (e.g., `Shockwave.tsx`) should implement the `renderBreakdown` prop for `ArcadeGameWrapper`. These games are stat-rich — showing a post-game breakdown adds to the satisfaction:

- **Shockwave:** Waves cleared, near-misses, max combo
- **Orbit:** Transfers, perfect captures
- **Beat Drop:** Perfect/Great/Good/Miss counts, max combo, accuracy %

## Event Types

Arcade events use the factory pattern: `Events.Game.start(gameType)` generates `GAME.{TYPE}.START`, `Events.Game.result(gameType)` generates `GAME.{TYPE}.RESULT`. This works for any string in `GameTypeSchema` — no additional event registration needed for new types.

## Out of Scope

- Audio/sound effects — the game has no audio system currently
- Migrating existing games to shared VFX module — future follow-up, not this batch (but the module is designed for incremental adoption)
- New sync-decision or trivia games
- Leaderboard changes beyond stat config entries
