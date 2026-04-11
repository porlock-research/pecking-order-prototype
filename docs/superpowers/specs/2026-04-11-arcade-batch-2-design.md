# Arcade Batch 2 — Design Spec

**Date:** 2026-04-11
**Status:** Draft
**Scope:** 7 new arcade minigames + 6 new VFX primitives + arcade game creation skill

## Overview

Add seven arcade cartridges spanning physics, WarioWare-style micro-tasks, creative expression, indirect control, and deductive logic. Expand the shared canvas VFX module with 6 new primitives. Create a reusable skill for adding future arcade games.

### Design Goals

- **Mechanically diverse** — each game fills a gap in the existing roster. No overlap with the 12 existing arcade games.
- **Visually spectacular** — heavy use of existing + new VFX primitives. Every interaction has visual feedback.
- **Mobile-first controls** — 48px+ touch targets, no long-press, no edge-drag conflicts, finger occlusion mitigated.
- **Under 2 minutes** — each game completes within 45-90 seconds.
- **Pure canvas** — no sprites, no audio. All visuals are procedural + theme-aware.
- **Integer results** — all result values are integers (arcade machine floors everything).

### Mechanic Diversity Map

| Game | Category | Feel | Closest Existing | Why It's Different |
|------|----------|------|-----------------|-------------------|
| Ripple | Physics/wave | Cerebral | Orbit | Wave interference + strategic placement vs. release timing + gravity |
| Bounce | Physics/creative | Cerebral | Stacker | Spatial planning + drawing vs. single-bar timing |
| Inflate | Push-your-luck | Frantic | Grid Push | Physical balloon metaphor + hidden thresholds vs. grid advancement |
| Switchboard | Micro-tasks | Frantic | Reaction Time | Multi-type rapid context switching vs. single wait-and-click |
| Flock | Indirect control | Flow | Shockwave | Herding via movement pacing vs. direct dodging |
| Sculptor | Creative/spatial | Flow | — | No existing construction/carving game |
| Codebreaker | Deductive logic | Cerebral | — | No existing logic/deduction game |

---

## VFX Module Additions

**Location:** `apps/client/src/cartridges/games/shared/canvas-vfx.ts`

Six new primitives added to the existing module (ParticleEmitter, TrailRenderer, ScreenShake, drawWithGlow, SlowMo, ScreenFlash, PulseRingEmitter, utilities).

### SpringValue

Spring-physics animated scalar. Overshoots, bounces, settles naturally. Replaces ad-hoc `lerp(current, target, 0.1)` patterns.

```typescript
interface SpringConfig {
  stiffness: number;   // spring constant (e.g., 180)
  damping: number;     // friction (e.g., 12)
  mass?: number;       // default 1
}

class SpringValue {
  constructor(config: SpringConfig);
  set target(v: number);
  get value(): number;
  get settled(): boolean;  // true when velocity ~0 and value ~target
  update(dt: number): void;
  snap(v: number): void;  // instantly set to value, zero velocity
}
```

**Used by:** All 7 new games (balloon wobble, button press, text pop-in, panel scramble, boid recruitment, score counters, code flip reveal). Also useful for existing games — high reuse value.

### FloatingTextEmitter

Pop-up text that scales in with spring overshoot, drifts upward, and fades out. Centralizes the "+100" / "PERFECT!" / "NERVES OF STEEL" pattern.

```typescript
interface FloatingTextConfig {
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  duration: number;           // ms
  drift?: number;             // upward drift px/s, default 30
  font?: string;              // default 'bold {fontSize}px monospace'
  scale?: {
    start: number;            // default 0.5
    peak: number;             // default 1.3
    end: number;              // default 1.0
  };
}

class FloatingTextEmitter {
  emit(config: FloatingTextConfig): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  clear(): void;
}
```

**Used by:** All 7 new games. Replaces manual text animation in Shockwave, Orbit, and Beat Drop (existing games can migrate incrementally).

### WavePool

Multi-source wave simulation with interference. Each source emits expanding concentric rings. Overlapping regions brighten (constructive) or dim (destructive) based on phase alignment.

```typescript
interface WaveSourceConfig {
  x: number;
  y: number;
  amplitude: number;      // initial wave strength (0-1)
  wavelength: number;     // px between wave peaks
  speed: number;          // expansion speed px/s
  decay: number;          // amplitude decay per px distance
  color: string;
  maxRadius?: number;     // auto-remove when radius exceeds this
}

class WavePool {
  addSource(config: WaveSourceConfig): void;
  /** Combined wave height at a point (-1 to 1). Used for gameplay (target scoring). */
  getHeight(x: number, y: number): number;
  update(dt: number): void;
  /** Renders concentric rings with interference. Uses 'screen' composite for overlap brightening. */
  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  clear(): void;
  readonly sourceCount: number;
}
```

**Rendering approach:** Each source draws concentric circle arcs with opacity = amplitude at that distance. Uses `globalCompositeOperation = 'screen'` for overlap regions so constructive interference brightens naturally. Destructive zones rendered via a secondary pass with dimming at half-wavelength offset positions.

**Used by:** Ripple. Available for future water/sound-wave games.

### SwarmRenderer

Efficient batch renderer for boid-like particles. Each boid has a directional body + mini-trail. When boids are close, faint connecting lines form an organic mesh.

```typescript
interface SwarmConfig {
  boidSize: number;             // triangle size px (default 5)
  trailLength: number;          // mini-trail points (3-5)
  bodyColor: string;
  trailColor: string;
  trailOpacity: { start: number; end: number };
  connectionColor: string;
  connectionOpacity: number;
  connectionMaxDist: number;    // only draw lines between boids closer than this
}

class SwarmRenderer {
  constructor(config: SwarmConfig);
  updateBoid(id: number, x: number, y: number, angle: number): void;
  addBoid(id: number, x: number, y: number, angle: number): void;
  removeBoid(id: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  clear(): void;
  readonly boidCount: number;
}
```

Each boid stores its last `trailLength` positions internally. Renders: tiny directional triangle pointing in heading direction + fading mini-trail behind. Connection lines drawn between nearby boids create an organic, breathing mesh.

**Used by:** Flock.

### DebrisEmitter

Falling rectangular debris with rotation, gravity, and fade. For physical "pieces breaking off" effects — more satisfying than circular particles for cut/shatter moments.

```typescript
interface DebrisConfig {
  pieces: { x: number; y: number; width: number; height: number }[];
  color: string;
  gravity: number;                         // px/s^2
  initialVelocity?: { x: { min: number; max: number }; y: { min: number; max: number } };
  rotationSpeed: { min: number; max: number };  // radians/s, randomized per piece
  fadeDelay: number;                       // ms before fade begins
  fadeDuration: number;                    // ms to fully fade
}

class DebrisEmitter {
  emit(config: DebrisConfig, rng?: () => number): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  clear(): void;
}
```

**Used by:** Sculptor. Also useful for any future game with breakable objects.

### drawDottedLine

Utility function for dotted/dashed line rendering. For trajectory previews, borders, target indicators.

```typescript
function drawDottedLine(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  config: {
    dashLength: number;
    gapLength: number;
    color: string;
    lineWidth: number;
    opacity?: number;       // default 1
  },
): void;
```

**Used by:** Bounce (trajectory preview). Generally useful utility.

---

## Mobile Design Rules

All games must follow these rules. Violations are bugs.

### Touch Targets
- **Minimum interactive element size: 48px** (Material Design guideline)
- Buttons, slots, controls, and tap zones must meet this minimum
- Spacing between adjacent interactive elements: minimum 8px gap

### Prohibited Interactions
- **No long-press** — players accidentally trigger while scrolling on chat views. Use tap-to-cycle, arrow buttons, or drag instead.
- **No drag gestures starting within 20px of screen edges** — conflicts with system back/forward gestures (iOS swipe-back, Android gesture nav)
- **No multi-touch** — single-finger only for all games

### Finger Occlusion
- **Interactive elements at bottom, feedback at top** — thumbs rest at bottom; scores, timers, and instructions display at top where fingers don't block
- **Drawing gestures (Bounce, Sculptor):** preview extends beyond finger in both directions so the player sees the full line, not just what's under their thumb
- **Flock shepherd:** follows finger with 20px upward offset so the flock and gates remain visible below the touch point

### Layout
- **Canvas fills available width** — games render at device width, maintaining aspect ratio
- **HUD elements use safe area insets** — no critical info hidden behind notches or home indicators
- **Action buttons (Drop, Submit, Done):** minimum 56px height, full-width or centered with generous padding

### Feedback
- **Every touch produces visual feedback** — no silent taps. Always a flash, scale animation, ripple, or color change within 16ms (one frame)
- **Drag operations show continuous preview** — line follows finger, handle tracks position

---

## Game 1: Ripple

### Concept

Drop stones into a dark pond. Ripples expand outward as concentric rings. Hit floating targets for points. Time your drops to create constructive interference — two ripples converging on a target amplify the score.

### Timing

- **Duration:** 60 seconds
- **Stones:** 20 total (limited — every drop is a decision)

### Mechanics

- **Pond surface:** Dark canvas with subtle animated noise (shifting opacity dots). 4-6 glowing targets float at seeded positions.
- **Drop:** Tap anywhere to drop a stone. Ripple rings expand outward from that point via WavePool.
- **Scoring a target:** When a ripple reaches a target, the target scores. Points = target_value × wave_strength (0.5-1.0, stronger closer to source).
- **Target values:** 10 (common, info-colored), 20 (uncommon, gold-colored), 30 (rare, pink-colored). Higher-value targets placed farther from convenient positions.
- **Amplify bonus:** Two ripples from different drops reach the same target within 200ms → 3x points + golden burst VFX. The core high-skill mechanic.
- **Cancel penalty:** Dropping a stone within 40px of an active ripple source weakens both ripples (reduced range and amplitude). Punishes mindless spam.
- **Target refresh:** Hit targets fade out, new targets spawn at seeded positions. Always 4-6 on screen.
- **Combo:** Consecutive target hits within 1s build combo: 1x (0-2), 1.5x (3-5), 2x (6-9), 3x (10+).

### Difficulty Ramp

| Phase | Time / Difficulty | Targets | Wave Speed | Drop Spacing |
|-------|------------------|---------|------------|--------------|
| Learn | 0-15s / low | Stationary, close together | 60 px/s | Cancel radius 30px |
| Build | 15-35s / mid | Slow drift, some 20-pt targets | 80 px/s | Cancel radius 40px |
| Challenge | 35-50s / high | Faster drift, more spacing, 30-pt targets appear | 100 px/s | Cancel radius 50px |
| Final | 50-60s | Wide spacing, mostly 20/30-pt | 100 px/s | Cancel radius 50px |

Difficulty parameter (0-1, scales with day index) shifts phases earlier and increases target drift speed.

### Visual Effects

| Element | Rendering | Theme Colors |
|---------|-----------|--------------|
| Pond surface | Near-black fill + subtle animated noise (random dots at 0.02 opacity, shift positions each frame) + faint concentric guide circles from center | `theme.colors.bg`, noise in `textDim` |
| Stone drop | Small white circle drops, splash particles burst upward (ParticleEmitter, 15 particles, velocity 80-150, short lifetime 300ms) + PulseRing at impact (20px, 200ms) | `theme.colors.text` splash, `info` PulseRing |
| Ripples | WavePool concentric rings with glow (drawWithGlow, 6px blur). Ring color cycles per-source through `gold`, `pink`, `info` | Cycle through theme accent colors |
| Targets | Glowing circles (12px radius) with gentle bob animation (SpringValue, slow oscillation). Ring count indicates value: 1 ring = 10, 2 = 20, 3 = 30 | 10: `info`, 20: `gold`, 30: `pink` |
| Target hit | Target explodes (ParticleEmitter, 12 particles in target color, radial burst), FloatingText "+20" with spring scale, PulseRing from target (25px, 250ms) | Target's color for all effects |
| Amplify bonus | Large PulseRing (gold, 80px, 400ms), ScreenFlash (gold, 100ms), FloatingText "AMPLIFY x3" (gold, fontSize 24), 20 gold/orange particles shower, SlowMo (0.5, 150ms) | `theme.colors.gold` dominant |
| Cancel warning | Both ripple sources dim briefly, faint red flash at overlap point (ScreenFlash localized), FloatingText "TOO CLOSE" in danger at 0.5 opacity | `theme.colors.danger` at 0.3 |
| Combo indicator | Multiplier text near last hit, scales up with SpringValue. At 3x: gold glow. At 3x: continuous gold ember particles from score display | `theme.colors.gold` text |
| Stone counter | Remaining stones as small dots at top-left, dimming as used | `theme.colors.text` at 0.4 |
| Background details | Faint radial gradient from center (0.03 opacity), gives depth | `theme.colors.bgSubtle` |

### Server Machine

```
File: packages/game-cartridges/src/machines/ripple.ts
gameType: 'RIPPLE'
defaultTimeLimit: 60_000
computeRewards:
  silver = floor(score / 400), capped at 15
  gold = floor(score / 2000)
```

### Result Payload

```typescript
{
  score: number;
  stonesUsed: number;
  amplifies: number;
}
```

### Controls

- **Desktop:** Click anywhere on pond to drop stone.
- **Mobile:** Tap anywhere on pond to drop stone.
- Single-input game. No drag, no long-press.

### Mobile Notes

- Tap anywhere = drop. No occlusion issue — finger lifts before ripple arrives at targets.
- Stone counter and score at top (away from tap zone).
- Targets have 48px+ visual presence (12px radius + glow halo = ~50px visible area).

---

## Game 2: Bounce

### Concept

A ball drops from the top. Before it falls, draw angled platforms. Watch the ball bounce off your creations to hit the target. Your spatial creativity determines the physics outcome.

### Timing

- **Duration:** 60 seconds across multiple rounds
- **Pacing:** 5-8 seconds planning + 2-4 seconds watching physics = ~8-10 seconds per round, ~6-8 rounds per game

### Mechanics

- **Round start:** Target (bullseye) appears at a random (seeded) canvas position. Ball appears at top at a random x coordinate.
- **Planning phase (5s max):** Draw up to 3 short platforms by dragging. Each platform is a line segment (~60-100px long). Angle determined by drag direction.
- **Erase:** Tap an existing platform to remove it. Redraw as needed during planning.
- **Drop:** Press "Drop" button or ball auto-drops after 5s countdown.
- **Physics:** Ball falls with gravity (400 px/s^2). Bounces off platforms and walls at reflection angle. Ball has slight energy loss per bounce (0.9x velocity) to prevent infinite bouncing.
- **Timeout:** If ball hasn't hit target or exited within 4s of drop, round ends as miss.

### Scoring

- Hit target (within 30px): 50 pts
- Bullseye (within 15px): 100 pts
- Each platform/wall bounce before hitting target: +10 pts (encourages creative multi-bounce solutions)
- Speed bonus: completing planning in < 3s = +50 pts
- Streak: consecutive hits build multiplier: 1x (0-2), 1.5x (3-5), 2x (6+)
- Miss (ball exits bounds or timeout): 0 pts, streak resets

### Difficulty Ramp

| Phase | Rounds / Diff | Target Radius | Target Placement | Platforms |
|-------|--------------|---------------|-----------------|-----------|
| Learn | 1-3 / low | 30px | Direct path or 1-bounce reachable | 3 |
| Build | 4-8 / mid | 25px | Requires angled bouncing | 3 |
| Challenge | 9-15 / high | 20px | Behind wall obstacles (static blocks) | 3 |
| Expert | 15+ / very high | 15px | Behind obstacles, smaller | 2 platforms only |

Difficulty parameter shifts phases earlier and reduces target sizes further.

### Visual Effects

| Element | Rendering | Theme Colors |
|---------|-----------|--------------|
| Ball | Bright circle (8px radius) with glow halo (drawWithGlow, 15px blur) | `theme.colors.text` core, `info` glow |
| Ball trail | TrailRenderer (25 points), gradient callback: `info` → `pink` over length | `theme.colors.info` → `pink` |
| Platforms (placed) | Solid lines (4px width) with glow (drawWithGlow, 8px blur). Neon chalk aesthetic | `theme.colors.gold` with glow |
| Platform drawing | DottedLine preview follows finger while dragging, with spark particles trailing along the line (ParticleEmitter, 2-3 particles/frame) | `theme.colors.gold` at 0.5 (preview), orange sparks |
| Platform erase | Platform dissolves (particles scatter outward from line, 10 particles) | Platform color, fading |
| Target | Concentric bullseye rings (3 rings) with gentle pulse animation (SpringValue scale oscillation) | Outer: `textDim`, middle: `info`, center: `gold` |
| Wall bounce | PulseRing at contact point (20px, 150ms) + 5 spark particles | `theme.colors.info` |
| Platform bounce | Larger PulseRing (30px, 200ms) + 8 sparks + platform line flashes bright (opacity → 1 for 100ms) + ScreenShake (3, 100ms) | `theme.colors.gold` |
| Target hit | Target explodes (ParticleEmitter, 20 particles), PulseRing (40px, 300ms), FloatingText "+50" or "+100", ScreenShake (6, 200ms) | `info` for hit, `gold` for bullseye |
| Bullseye | All of above + ScreenFlash (gold, 150ms) + SlowMo (0.3, 200ms) + FloatingText "BULLSEYE!" (gold, fontSize 22) + 15 extra gold particles | `theme.colors.gold` dominant |
| Multi-bounce buildup | Each successive bounce increases ball glow intensity and trail width. At 5+ bounces: SlowMo on final approach to target | Ball glow radius grows: 15 → 20 → 25px |
| Miss | Ball fades as it exits, subtle ScreenShake (2, 80ms), streak counter dims | `theme.colors.danger` subtle flash |
| Drop countdown | "3... 2... 1..." as FloatingText at ball position, shrinking circle timer around Drop button | `theme.colors.text` fading |
| Obstacles (high diff) | Dark rectangles with subtle border glow. Ball bounces off them like walls | `theme.colors.textDim` fill, `text` border at 0.2 |
| Background | Faint grid (cutting mat style), wall edges as subtle glow lines | `theme.colors.bg`, grid in `textDim` at 0.03 |

### Server Machine

```
File: packages/game-cartridges/src/machines/bounce.ts
gameType: 'BOUNCE'
defaultTimeLimit: 60_000
computeRewards:
  silver = floor(score / 300) + floor(bullseyes / 3), capped at 15
  gold = floor(score / 1500)
```

### Result Payload

```typescript
{
  score: number;
  roundsCompleted: number;
  bullseyes: number;
  maxStreak: number;
}
```

### Controls

- **Desktop:** Click + drag to draw a platform. Click existing platform to erase. Click "Drop" or press Space to release ball.
- **Mobile:** Touch + drag to draw (preview extends 20px beyond finger in both directions). Tap existing platform to erase (platform highlights on touch-near, 24px hit zone around line). Tap "Drop" button (56px height, positioned at top-right away from drawing area).

### Mobile Notes

- Drawing area occupies most of canvas. "Drop" button at top-right (thumb can reach, but away from primary drawing zone at bottom).
- Platform erase uses proximity detection (24px from line) rather than requiring precise tap ON the line.
- Drag gestures start 20px+ from edges to avoid system gesture conflicts.
- Score and round info at top-left.

---

## Game 3: Inflate

### Concept

Hold to inflate a balloon. Release to bank the points. But each balloon has a hidden pop threshold — push your luck. WarioWare-style micro-decisions with a physical, tactile metaphor.

### Timing

- **Duration:** 45 seconds (shorter — each balloon is a 3-5 second micro-decision)
- **Pacing:** 9-15 balloons per game depending on courage

### Mechanics

- **Balloon:** Appears center screen. Hold anywhere to inflate. Balloon grows, wobbles, stretches.
- **Bank:** Release to bank. Score = floor(inflatePercentage × 100). Bigger = more points.
- **Pop:** Each balloon has a hidden pop threshold (seeded, varies by type). Exceeding it = pop → 0 points + lose a life.
- **Lives:** 3 total. 3 pops = game over.
- **Balloon types (seeded selection):**
  - Normal (60%): pop threshold 30%-90% of max size
  - Golden (20%): 2x value, but pops ~30% earlier than normal range
  - Tough (20%): 1.5x value, pops ~20% later than normal range
- **Danger cues:** As balloon approaches its threshold:
  - Wobble amplitude increases (SpringValue perturbation)
  - Color saturates / brightens
  - Faint stretch marks appear on surface (thin lines)
  - Size starts micro-jittering
  - BUT the exact threshold is hidden — cues start at ~70% of threshold
- **Perfect bank:** Banking within 5% of the pop threshold without popping = +50 bonus.
- **Streak:** 5+ consecutive banks without popping = +10 per balloon in streak.

### Difficulty Ramp

| Phase | Time / Diff | Pop Threshold Range | Visual Cue Start | Balloon Mix |
|-------|------------|--------------------|--------------------|-------------|
| Learn | 0-10s / low | 60-90% | At ~50% of threshold | 80% normal, 20% tough |
| Build | 10-25s / mid | 40-80% | At ~60% of threshold | 60% normal, 20% golden, 20% tough |
| Tense | 25-40s / high | 30-70% | At ~70% of threshold (subtler) | 50% normal, 30% golden, 20% tough |
| Final | 40-45s | 25-60% | At ~75% of threshold (very subtle) | 40% normal, 40% golden, 20% tough |

Difficulty parameter shifts phases earlier and narrows pop ranges.

### Visual Effects

The balloon IS the visual. Its quality makes or breaks the game.

| Element | Rendering | Theme Colors |
|---------|-----------|--------------|
| Balloon body | Bezier-curved ellipse with neck/tie. Size driven by SpringValue (bouncy, slightly delayed growth). Gentle wobble oscillation. Surface sheen: lighter radial gradient at top-left (specular highlight) | Normal: `info`, Golden: `gold`, Tough: `green` |
| Balloon string | Curved line hanging below, sways with inertia (SpringValue) | `theme.colors.textDim` |
| Inflation | Size pulses slightly with each "breath" frame (SpringValue oscillation, ~4Hz). Faint air particles stream downward from tie opening (ParticleEmitter, 1-2 particles/frame, downward) | Air particles: `text` at 0.08 |
| Approaching threshold | Wobble amplitude increases, color brightens (opacity → 1), stretch marks appear (3-4 thin arced lines on surface), size jitters (±2px random), SpringValue perturbation increases | Same balloon color, brighter |
| Bank (release) | Balloon floats upward with spring bounce (SpringValue y position, overshoot), shrinks (SpringValue scale 1 → 0.6), gold sparkle trail behind (ParticleEmitter, 8 particles trailing), FloatingText "+73" with spring scale | `theme.colors.gold` text and sparkles |
| Pop | EXPLOSIVE: 30 fragment particles burst outward with gravity (ParticleEmitter, velocity 150-300, angle full circle, gravity 200, lifetime 600-1000ms), ScreenShake (intensity 10, 300ms), ScreenFlash (danger, 200ms), PulseRing (50px, 300ms, balloon color), rubber-fragment debris (DebrisEmitter, 5-8 small rectangles) | `theme.colors.danger` flash, balloon color particles/debris |
| Perfect bank | SlowMo (0.5, 200ms), FloatingText "NERVES OF STEEL" (gold, fontSize 20), 15 gold particles (ParticleEmitter), PulseRing (40px, gold), subtle ScreenFlash (gold, 80ms) | `theme.colors.gold` everything |
| Golden balloon | Gold sheen (brighter specular), shimmer particles orbit during inflation (ParticleEmitter, 1 particle/200ms, circular motion), pop is more dramatic (40 particles, bigger shake) | `theme.colors.gold` dominant |
| Tough balloon | Green tint, thicker outline (2px border), slight "solid" visual weight, pop debris is chunkier (larger rectangles) | `theme.colors.green` dominant |
| New balloon entry | Springs in from below canvas (SpringValue y: below → center, overshoot), small bounce settle | — |
| Lives | 3 heart-shaped indicators at bottom-center. On life lost: damaged heart pulses danger-red, shrinks (SpringValue scale 1 → 0.6), shakes (ScreenShake localized) | Full: `green`, lost: `danger` |
| Streak indicator | After 3+ balloons without popping: streak count appears below score, golden glow. At 5+: faint gold ember particles rise from bottom | `theme.colors.gold` |
| Score | Top-left, large font. Pulses (SpringValue scale) on each bank | `theme.colors.text` |
| Background | Clean dark gradient (radial from center), balloon shadow on "floor" (ellipse at bottom, 0.05 opacity), subtle upward-floating ambient particles | `theme.colors.bg`, shadow in `textDim` |

### Server Machine

```
File: packages/game-cartridges/src/machines/inflate.ts
gameType: 'INFLATE'
defaultTimeLimit: 45_000
computeRewards:
  silver = floor(score / 250) + floor(perfectBanks / 2), capped at 15
  gold = floor(score / 1200)
```

### Result Payload

```typescript
{
  score: number;
  balloonsBanked: number;
  balloonsPopped: number;
  perfectBanks: number;
}
```

### Controls

- **Desktop:** Hold mouse button anywhere to inflate. Release to bank.
- **Mobile:** Hold finger anywhere to inflate. Release to bank.
- One-button game. No drag, no long-press distinction needed (hold is the primary mechanic, not a secondary gesture on a scrollable surface — the game canvas is the only interactive surface during play).

### Mobile Notes

- Hold anywhere on canvas to inflate — no occlusion issue since the balloon is center-screen and grows in all directions from center, visible around finger.
- Lives and score at top. Balloon centered. Nothing important hidden under thumb at bottom.
- Balloon must be visible around finger — minimum 60px distance between finger touch point (wherever on canvas) and balloon center. Since the balloon IS center-screen and touch is anywhere, this is naturally satisfied.

---

## Game 4: Switchboard

### Concept

A control panel appears with buttons, sliders, dials, and toggles. Instructions flash one at a time — execute each one as fast as possible. Every 5 instructions, the panel scrambles to new positions. WarioWare-style rapid context switching.

### Timing

- **Duration:** 60 seconds (no lives — misses waste time and reset streaks)
- **Pacing:** 1-3 seconds per instruction, ~25-40 instructions per game

### Mechanics

- **Control panel:** Canvas filled with interactive controls:
  - **Buttons** — colored circles (red, blue, yellow, green). Tap to press.
  - **Toggles** — pill-shaped on/off switches. Tap to flip.
  - **Sliders** — horizontal track with handle. Drag handle to a position (0-10 in notches).
  - **Dials** — circular face with pointer. Drag to rotate pointer to a number (0-9).
- **Instructions:** Displayed as large bold text at top of screen:
  - "RED BUTTON", "PRESS BLUE"
  - "TOGGLE GREEN ON", "TOGGLE RED OFF"
  - "SLIDER → 7", "SLIDER → MAX"
  - "DIAL → 3", "DIAL → 9"
- **Correct execution:** Score + next instruction immediately.
- **Wrong input:** Miss counter increments, instruction stays. No penalty beyond wasted time.
- **Instruction timer:** Shrinking circular progress bar around the instruction. Expires = miss + next instruction.
- **Panel scramble:** Every 5 completed instructions, all controls slide to new random positions with spring animation. Brief "SCRAMBLE!" text. Spatial memory resets.
- **Control unlock progression:** Not all controls appear at start.

### Difficulty Ramp

| Phase | Instructions Completed / Diff | Timer | Active Controls | Scramble |
|-------|------------------------------|-------|-----------------|----------|
| Learn | 0-5 / low | 3.0s | Buttons + toggles only | No scramble |
| Build | 6-15 / mid | 2.5s | + Sliders | Every 5 |
| Challenge | 16-25 / high | 2.0s | + Dials | Every 5 |
| Expert | 25+ / very high | 1.5s | All types | Every 4 |

Difficulty parameter shifts phases earlier and reduces timers further.

### Visual Effects

| Element | Rendering | Theme Colors |
|---------|-----------|--------------|
| Buttons | Circular (56px diameter for mobile). 3D gradient: lighter top half, darker bottom (simulates lighting). Border glow on hover/touch-near. Press: SpringValue scale 1 → 0.85 → 1 + PulseRing (20px) + 8 spark particles | Red: `danger`, Blue: `info`, Yellow: `gold`, Green: `green` |
| Toggles | Pill-shaped track (80x36px) with sliding circle (28px). Toggle: circle slides with SpringValue snap + track color changes + mini ScreenFlash on control | Off: `textDim` track / `text` circle. On: button-specific color |
| Sliders | Rounded rect track (160x12px) + circular handle (36px visible, 48px touch target). Handle has glow. Drag: handle follows with slight SpringValue lag. Snap to notch positions with overshoot | Track: `textDim`, handle: `info`. Active notch position: `gold` |
| Dials | Circle face (72px diameter, 48px+ touch area) with numbered tick marks (0-9). Rotating pointer line. Drag to rotate — pointer snaps to nearest number with SpringValue overshoot. Pointer has glow | Face: `bgSubtle`, ticks: `textDim`, pointer: `gold` with glow |
| Instruction text | Large bold text (20px font) at top-center. Appears with SpringValue scale pop. High-contrast | `theme.colors.text` |
| Instruction timer | Circular progress ring around instruction area. Color transitions as time decreases. At < 0.5s: ring pulses rapidly | Full: `green`, mid: `gold`, low: `danger` |
| Correct execution | Control flashes bright (localized ScreenFlash on control bounds), FloatingText "+100" from control position, 8 spark particles (ParticleEmitter), instruction row slides away | `theme.colors.gold` flash and text |
| Wrong input | Control shakes (localized offset animation, 5px, 200ms — NOT global ScreenShake), red flash on control, FloatingText "X" in danger | `theme.colors.danger` |
| Panel scramble | All controls slide simultaneously to new positions (each with SpringValue, 400ms, staggered by 30ms). "SCRAMBLE!" FloatingText center screen (info, fontSize 24). Brief ScreenFlash (info, 80ms) | `theme.colors.info` scramble text, `bgSubtle` flash |
| Streak 5+ | Score counter starts pulsing gold (SpringValue oscillation) | `theme.colors.gold` |
| Streak 10+ | Faint gold glow around score area, score pulses more intensely | `theme.colors.gold` at 0.3 |
| Streak 15+ | Continuous ember particles (ParticleEmitter, 1 particle/100ms, gold/orange, rising from bottom edges). Score display in full gold glow | `theme.colors.gold` embers, `orange` mix |
| Background | Clean panel surface (bgSubtle fill), subtle embossed grid pattern (1px lines at 0.03 opacity), slightly beveled canvas border | `theme.colors.bgSubtle`, grid in `textDim` |

### Server Machine

```
File: packages/game-cartridges/src/machines/switchboard.ts
gameType: 'SWITCHBOARD'
defaultTimeLimit: 60_000
computeRewards:
  silver = floor(score / 500), capped at 15
  gold = floor(score / 2500)
```

### Result Payload

```typescript
{
  score: number;
  instructionsCompleted: number;
  maxStreak: number;
  accuracyPct: number;       // 0-100 integer, floor(correct / (correct + misses) * 100) — NOT 0-1 fraction
}
```

### Scoring

- Correct instruction: 100 pts × speed multiplier (1.0x at timer start → 2.0x if completed within first 20% of timer)
- Streak: 5+ consecutive correct = 1.5x, 10+ = 2x, 15+ = 3x
- Miss: resets streak, no point deduction

### Controls

- **Desktop:** Click buttons/toggles. Click + drag sliders/dials. Mouse hover shows glow affordance.
- **Mobile:** Tap buttons/toggles (48px+ targets). Touch + drag sliders (56px handle) / dials (48px+ face). Touch-near glow feedback.
- All controls respond to first touch — no double-tap or long-press.

### Mobile Notes

- All interactive controls: minimum 48px touch target, 56px for drag handles.
- Controls spread across full canvas with 8px+ gaps between them.
- Instruction text at top (large, readable). Timer ring around instruction.
- Panel layout algorithm ensures no control overlaps and all are reachable by thumb.
- Sliders are horizontal (natural drag direction). Dials use circular drag (angular delta from center, not absolute position — works well with imprecise touch).

---

## Game 5: Flock

### Concept

Guide a swarm of boid particles through scoring gates by moving your shepherd dot. You can't grab the boids — you influence them through how you move. Too fast and they scatter. Predators steal them. An indirect-control herding game.

### Timing

- **Duration:** 60 seconds
- **Pacing:** Gate appears every 4-6 seconds, ~10-15 gate opportunities per game

### Mechanics

- **Shepherd:** Glowing dot that follows mouse/finger (with 20px upward offset on mobile).
- **Boids (25 starting):** Small triangle particles with flocking behavior:
  - Cohesion: steer toward flock center
  - Separation: avoid crowding neighbors (minimum 8px spacing)
  - Alignment: match heading with nearby boids
  - Leader follow: steer toward shepherd (strongest weight, ~60% of total steering)
- **Speed penalty:** When shepherd moves faster than 200px/s, leader-follow weight drops linearly. At 400px/s, weight is ~20%. Boids fall behind and scatter. Visual: shepherd glow shifts from `info` toward `danger`.
- **Scoring gates:** Two glowing posts with a beam between them.
  - Wide gate (80px opening): 10 pts per boid that passes through
  - Tight gate (40px opening): 20 pts per boid that passes through
  - Gate detection: boid center crosses the gate plane within the opening
  - All boids through = "WHOLE FLOCK" bonus (+50)
- **Predator dots:** Red pulsing dots that patrol in sinusoidal patterns. Touch a boid = boid dies (eaten). Flock permanently shrinks. Predators are NOT attracted to or repelled by the shepherd — they follow their own patterns. Strategy: route your flock around them.
- **Bonus boids:** Green dots appear occasionally. Guiding any boid within 20px of a bonus dot recruits it (flock grows by 1, max 30).

### Difficulty Ramp

| Phase | Time / Diff | Starting Boids | Predators | Gates | Bonus Spawns |
|-------|------------|----------------|-----------|-------|-------------|
| Learn | 0-15s / low | 25 | 0 | Wide only, close together | Every 8s |
| Build | 15-30s / mid | Remaining + recruited | 1 (slow, 40 px/s) | Mix wide/tight | Every 10s |
| Tense | 30-45s / high | Remaining | 2 (medium, 60 px/s) | More tight, farther apart | Every 15s |
| Final | 45-60s | Remaining | 2-3 (fast, 80 px/s) | Mostly tight | No spawns |

Difficulty parameter adds predators earlier and reduces bonus spawn rate.

### Visual Effects

| Element | Rendering | Theme Colors |
|---------|-----------|--------------|
| Shepherd | Circle (8px radius) with glow halo (drawWithGlow, 20px blur), gentle pulse (SpringValue scale oscillation 1.0-1.05, ~2Hz). When moving too fast: glow color lerps from `info` toward `danger` | `theme.colors.text` core, `info` glow (normal), `danger` glow (fast) |
| Boid swarm | SwarmRenderer: directional triangles (5px) + 3-point mini-trails. Nearby boids connected by faint lines (organic mesh). Mesh breathes as flock tightens/spreads | `theme.colors.info` body, trail at 0.2, connections at 0.05 |
| Gate posts | Vertical glowing lines (60px tall, 3px wide, drawWithGlow 10px blur) with subtle pulse. Beam between posts as horizontal line (2px, lower opacity) | Wide: `gold` posts/beam. Tight: `pink` posts/beam |
| Gate approach | Gate beam brightens (opacity 0.3 → 0.8) as flock center gets within 100px. Posts pulse faster | Gate color, intensifying |
| Boid through gate | Each boid: brief golden flash (0.5 opacity, 50ms) + 2 tiny gold particles (ParticleEmitter) | `theme.colors.gold` |
| Whole flock bonus | PulseRing from gate center (60px, 400ms, gold), ScreenFlash (gold, 100ms), FloatingText "WHOLE FLOCK!" (gold, fontSize 22, SpringValue scale), 20 gold particles shower, SlowMo (0.5, 150ms) | `theme.colors.gold` everything |
| Predator | Circle (10px radius) with menacing glow (drawWithGlow, 15px blur, danger). Pulsing opacity (0.7-1.0, ~3Hz). Faint red trail (TrailRenderer, 10 points) | `theme.colors.danger` |
| Predator eats boid | Boid pops: 5 danger-colored particles (ParticleEmitter, burst). Predator briefly swells (SpringValue scale 1 → 1.3 → 1, 200ms). Faint ScreenShake (2, 50ms) | `theme.colors.danger` particles |
| Bonus boid spawn | Green dot fades in (opacity 0→1 over 500ms) with PulseRing (20px, 300ms, green). Gentle float animation (SpringValue y oscillation) | `theme.colors.green` |
| Boid recruited | Green flash at recruit point, new boid pops into existence (SpringValue scale 0→1.2→1) and joins flock formation smoothly | `theme.colors.green` flash |
| Flock scatter (too fast) | Boids spread outward, connection mesh lines break (fade out), mini-trails lengthen and shift toward danger color | Trails: `info` → `danger` transition |
| Flock reform (slow down) | Boids ease back together, connections re-form, trails shorten and return to `info` | Back to normal colors |
| End bonus | At time-up, remaining boids glow gold briefly, FloatingText "+{boids × 5}" | `theme.colors.gold` |
| Background | Deep dark with faint organic ripple shapes (frozen concentric arcs at random positions, 0.02 opacity). Subtle parallax dots at 0.01 | `theme.colors.bg`, `textDim` organic shapes |

### Server Machine

```
File: packages/game-cartridges/src/machines/flock.ts
gameType: 'FLOCK'
defaultTimeLimit: 60_000
computeRewards:
  silver = floor(score / 350) + floor(wholeFlock / 3), capped at 15
  gold = floor(score / 1800)
```

### Result Payload

```typescript
{
  score: number;
  gatesPassed: number;
  boidsRemaining: number;
  wholeFlock: number;
}
```

### Controls

- **Desktop:** Mouse position = shepherd position (direct, no click needed).
- **Mobile:** Finger position = shepherd position with 20px upward offset (flock visible below finger). Shepherd appears when finger touches, disappears when lifted (boids hold last position and slowly drift).

### Mobile Notes

- 20px upward offset on shepherd position so flock and gates are visible below the finger.
- When finger lifts (mobile), shepherd stops. Boids hold formation and slowly drift — they don't scatter. Player can reposition finger without penalty.
- Gates and predators sized for visibility: gate posts 60px tall, predator 10px + glow = ~35px visible area.
- Score and timer at top.

---

## Game 6: Sculptor

### Concept

A target silhouette is shown. You have a rectangular block of "clay." Draw straight cuts to carve away excess material. Score = how closely the remaining shape matches the target. Multiple rounds, shapes get more complex. Creative problem-solving — many valid solutions per target.

### Timing

- **Duration:** 60 seconds across multiple rounds
- **Pacing:** 6-10 seconds per round, ~6-10 rounds per game

### Mechanics

- **Clay grid:** 40x40 cell grid (each cell ~10px). Starts as a solid filled rectangle.
- **Target silhouette:** Shown as a translucent overlay behind/around the clay. The goal shape.
- **Cuts:** Draw a straight line across the clay (drag gesture). The line divides the clay into two regions.
  - The game computes which side has MORE overlap with the target silhouette.
  - The higher-overlap side stays. The other side falls away as debris.
- **3 cuts per round.** After 3 cuts (or tap "Done" to end early): scoring comparison.
- **Scoring:** overlap % = (cells matching target ∩ remaining clay) / (total target cells). Score = floor(overlapPercentage).
  - Note: cells outside the target that remain (excess clay) reduce the score. Precision matters.
  - Adjusted formula: floor((matching_cells / target_cells) × 100 - (excess_cells / target_cells) × 25). Clamped to 0-100.
  - This penalizes leaving too much excess while rewarding close cuts.
- **Round transition:** After scoring, remaining clay clears and a new block + target appear.

### Target Shape Library (seeded selection)

Shapes are stored as 40x40 boolean masks. Seeded PRNG selects from the library and applies random rotation/mirror for variety.

| Difficulty | Shapes | Examples |
|-----------|--------|----------|
| Easy | Convex, simple | Triangle, L-shape, wide arrow, half-circle |
| Medium | Concave, moderate detail | Star, narrow arrow, arch, cross, chevron |
| Hard | Complex, fine features | Key, bird silhouette, lightning bolt, crown |
| Expert | Asymmetric, requires precise angles | Guitar, running figure, spiral staircase |

### Difficulty Ramp

| Phase | Rounds / Diff | Shape Complexity | Cuts Allowed | Perfect Threshold |
|-------|--------------|-----------------|-------------|-------------------|
| Learn | 1-2 / low | Easy (convex) | 3 | 90%+ |
| Build | 3-5 / mid | Medium (concave) | 3 | 92%+ |
| Challenge | 6-8 / high | Hard (complex) | 3 | 95%+ |
| Expert | 9+ / very high | Expert (asymmetric) | 2 cuts only | 95%+ |

### Visual Effects

| Element | Rendering | Theme Colors |
|---------|-----------|--------------|
| Clay block | Grid of filled cells with beveled look: each cell's top-left edge lighter (1px line at 0.1 opacity), bottom-right darker. Creates tactile surface texture | `theme.colors.info` fill, lighter/darker edges |
| Target silhouette | Semi-transparent overlay positioned behind clay. Border outline (2px, dashed). Gentle pulse (opacity oscillation 0.12-0.18 via SpringValue) | `theme.colors.gold` at 0.15 fill, `gold` border at 0.3 |
| Cut line preview (while dragging) | Bright solid line follows finger, extending 20px beyond finger in both directions. Spark particles trail along the line (ParticleEmitter, 3 particles/frame, orange/gold) | `theme.colors.gold` line, `orange` sparks |
| Cut execution | Line flashes bright white (100ms), SlowMo (0.7, 100ms) for dramatic pause, clay visually splits with 2px gap along cut line | `theme.colors.text` flash |
| Debris falling | Non-target side cells form debris pieces via DebrisEmitter. 5-8 rectangular chunks tumble with rotation + gravity. Dust particles trail behind each piece (ParticleEmitter, 1 particle/piece/frame, tiny, textDim). Pieces fade as they fall off-screen | Clay color for debris, `textDim` dust |
| Round scoring | Remaining clay flashes. Overlay comparison: matching cells glow green (0.3 opacity pulse), excess cells flash red briefly (0.2, 200ms). FloatingText "87%" or "PERFECT!" with SpringValue scale. PulseRing from center (30px, 250ms) | Match: `green` glow. Excess: `danger` flash. Score text: `text` if < 80, `gold` if 80-94, special if 95+ |
| Perfect match (95%+) | ScreenFlash (gold, 150ms), large PulseRing (50px, 400ms), 20 gold particles, SlowMo (0.5, 200ms), FloatingText "PERFECT!" (gold, fontSize 22), ScreenShake (4, 150ms) | `theme.colors.gold` everything |
| New round transition | Old clay slides off-screen right (SpringValue x, 200ms). New block springs in from left (SpringValue x, overshoot). New target fades in (opacity 0→0.15, 300ms) | — |
| Cuts remaining | 3 diamond-shaped indicators at top-right. Filled = used, hollow = available. Final cut indicator pulses (SpringValue opacity oscillation) | Used: `gold` filled. Available: `textDim` hollow |
| Speed bonus | If round completed in < 5s, FloatingText "QUICK! +20" appears with sprint effect | `theme.colors.info` |
| Background | Faint grid pattern (cutting mat — 20px cells, 1px lines at 0.03 opacity). Subtle workshop atmosphere | `theme.colors.bg`, grid in `textDim` |

### Server Machine

```
File: packages/game-cartridges/src/machines/sculptor.ts
gameType: 'SCULPTOR'
defaultTimeLimit: 60_000
computeRewards:
  silver = floor(score / 300) + floor(perfectCuts / 2), capped at 15
  gold = floor(score / 1500)
```

### Result Payload

```typescript
{
  score: number;
  roundsCompleted: number;
  perfectCuts: number;
  averageAccuracyPct: number; // 0-100 integer — NOT 0-1 fraction (arcade machine floors all values)
}
```

### Controls

- **Desktop:** Click + drag to draw cut line. Click "Done" to end round early.
- **Mobile:** Touch + drag to draw cut (preview line extends 20px beyond finger in both directions so player sees full line). Tap "Done" button (56px, top-right). No long-press.

### Mobile Notes

- Drawing area = full clay canvas area. "Done" button at top-right.
- Cut preview extends beyond finger so player sees where the cut will go.
- Drag starts 20px+ from edges.
- Target silhouette visible through the clay (semi-transparent overlay) — no occlusion issue since it's behind the clay.
- Score and cuts-remaining at top.

---

## Game 7: Codebreaker

### Concept

Hidden 4-color code. Guess, get Mastermind-style feedback, crack it. Fast-paced deductive logic under time pressure. Multiple codes per game.

### Timing

- **Duration:** 60 seconds
- **Pacing:** 15-30 seconds per code (3-6 guesses), ~2-4 codes per game

### Mechanics

- **Hidden code:** 4 positions, each from a palette of 5-7 colors (increases with difficulty).
- **Guessing:** Tap a position to cycle its color forward. Small arrows flanking each position cycle backward. All 4 positions editable simultaneously.
- **Submit:** Tap Submit button to submit guess.
- **Feedback (classic Mastermind rules):**
  - Filled dot = correct color in correct position
  - Hollow dot = correct color in wrong position
  - Empty = color not in code at all
  - Dots are displayed sorted (filled first, then hollow, then empty) — NOT positionally aligned. Player must deduce which positions are correct.
- **Code cracked:** All 4 filled dots → code solved → score awarded → next code begins.
- **Per-guess timer:** Shrinking circular progress. Expires = auto-submit current guess as-is.
- **No guess limit:** But the per-guess timer and game clock provide pressure. Inefficient guessing wastes time.
- **Repeats:** Not allowed initially. Allowed at higher difficulty (fundamentally changes deduction strategy).

### Difficulty Ramp

| Phase | Codes Cracked / Diff | Color Count | Guess Timer | Repeats Allowed |
|-------|---------------------|-------------|-------------|-----------------|
| Learn | 0-1 / low | 5 | 10s | No |
| Build | 2-4 / mid | 6 | 8s | No |
| Challenge | 5-7 / high | 6 | 6s | Yes |
| Expert | 8+ / very high | 7 | 5s | Yes |

Difficulty parameter shifts phases earlier and reduces guess timers.

### Scoring

- Code cracked: 200 pts base
- Guess bonus: 1 guess = +300, 2 guesses = +200, 3 = +100, 4 = +50, 5+ = +0
- Speed bonus: solving with > 50% of guess timer remaining on final guess = +50
- Streak: consecutive codes cracked in ≤ 4 guesses: 3+ streak = 1.5x, 5+ = 2x

### Visual Effects

| Element | Rendering | Theme Colors |
|---------|-----------|--------------|
| Hidden code | 4 circles (40px diameter) at top, covered with frosted glass overlay (semi-transparent fill + blur effect via layered draws). "?" symbol centered, gentle pulse (SpringValue opacity oscillation). Subtle shimmer: highlight arc sweeps across surface cyclically | `theme.colors.bgSubtle` frosted fill, `text` "?" at 0.4 |
| Color palette | 5-7 color circles (36px, 48px touch target) at bottom of screen. Selected color has bright ring border (3px). Colors derived from theme | `pink`, `info`, `gold`, `green`, `danger`, `orange`, `text` (for 7th) |
| Guess positions | 4 large circles (44px diameter, 48px touch target) in current guess row. Each shows chosen color as gem-like orb with radial gradient + drawWithGlow (8px blur). Tap cycles with SpringValue rotation animation (scale 1→0.8→1 with color change) | Each color from palette |
| Small arrows | Flanking each position: left arrow (cycle back) and right arrow (cycle forward). 36px touch target each. Subtle, visible on focus | `theme.colors.textDim`, brighten on touch |
| Submit button | Rounded rect (56px height, 120px width). Glows when all positions filled. Press: SpringValue scale 1→0.9→1, PulseRing (15px) | `theme.colors.gold` fill, brighter on press |
| Guess timer | Circular progress ring around Submit button. Smooth countdown. Color transitions | Full: `green`, mid: `gold`, low: `danger`. At < 2s: ring pulses, faint ScreenShake (1, continuous) |
| Feedback dots — correct position (filled) | Bright dot (10px) that pops in with SpringValue (scale 0→1.3→1). Tiny PulseRing (15px, 200ms). 3 gold sparkle particles | `theme.colors.gold` dot + sparkles |
| Feedback dots — correct color (hollow) | Ring (10px, 2px stroke) that pops in with SpringValue. Subtle pulse | `theme.colors.info` ring |
| Feedback dots — no match (empty) | Faint circle (10px, 1px stroke, 0.2 opacity). Appears with gentle fade-in | `theme.colors.textDim` at 0.2 |
| Feedback reveal | Dots appear one at a time, left to right, 200ms stagger between each. Each pop creates a micro-moment of anticipation | — |
| Previous guesses | Slide upward, compress, and dim (opacity → 0.5) to make room for new row. SpringValue y position animation | Row colors at reduced opacity |
| Code cracked | Hidden code REVEALS: each position "flips" sequentially L-to-R (scale X: 1→0→1 with color swap, 150ms per position, 100ms stagger). After reveal: PulseRing from code row (60px, 400ms), ScreenFlash (gold, 100ms), FloatingText "CRACKED!" (gold, fontSize 22, SpringValue scale), 20 confetti particles (mixed theme colors), ScreenShake (5, 200ms) | `theme.colors.gold` dominant, confetti in all palette colors |
| Fast crack (1-2 guesses) | Extra: SlowMo (0.5, 300ms), FloatingText "GENIUS!" (gold, fontSize 26), continuous gold particle shower during reveal, ScreenShake (8, 300ms) | `theme.colors.gold` + `orange` particles |
| New code transition | Previous guess history springs off-screen left (SpringValue x, 300ms). New hidden code drops in from above with bounce (SpringValue y, overshoot). Fresh guess row fades in | — |
| Streak 3+ | Score counter pulses gold (SpringValue scale oscillation) | `theme.colors.gold` |
| Streak 5+ | Continuous ember particles (ParticleEmitter, 1/100ms, gold/orange) rising from bottom screen edges | `theme.colors.gold`, `orange` embers |
| Background | Dark surface with subtle felt/table texture (noise at 0.02 opacity). Board-game atmosphere. Faint horizontal guide lines for guess rows | `theme.colors.bg`, texture in `textDim` |

### Server Machine

```
File: packages/game-cartridges/src/machines/codebreaker.ts
gameType: 'CODEBREAKER'
defaultTimeLimit: 60_000
computeRewards:
  silver = floor(score / 400) + (bestSolve <= 2 ? 3 : 0), capped at 15
  gold = floor(score / 2000)
```

### Result Payload

```typescript
{
  score: number;
  codesCracked: number;
  averageGuesses: number;     // integer, floor of average
  bestSolve: number;          // fewest guesses on any single code
}
```

### Controls

- **Desktop:** Click position to cycle color forward. Click left/right arrows to cycle direction. Click Submit.
- **Mobile:** Tap position (48px target) to cycle forward. Tap arrows (36px target, flanking each position). Tap Submit (56px height).
- No long-press. No drag. Pure tap interaction.

### Mobile Notes

- Color palette at bottom of screen — easy thumb access.
- Guess positions in middle area.
- Hidden code at top.
- Submit button between guess row and palette, centered, 56px height.
- All interactive elements ≥ 36px touch target (arrows), ≥ 48px (positions, colors).
- Previous guesses scroll upward and compress — never occlude active guess row.

---

## Files to Create/Modify

### New VFX Additions (1 file modified)

| File | Change |
|------|--------|
| `apps/client/src/cartridges/games/shared/canvas-vfx.ts` | Add SpringValue, FloatingTextEmitter, WavePool, SwarmRenderer, DebrisEmitter, drawDottedLine |

### New Game Machine Files (7 files created)

| File | Game Type | Time Limit |
|------|-----------|------------|
| `packages/game-cartridges/src/machines/ripple.ts` | `RIPPLE` | 60,000 |
| `packages/game-cartridges/src/machines/bounce.ts` | `BOUNCE` | 60,000 |
| `packages/game-cartridges/src/machines/inflate.ts` | `INFLATE` | 45,000 |
| `packages/game-cartridges/src/machines/switchboard.ts` | `SWITCHBOARD` | 60,000 |
| `packages/game-cartridges/src/machines/flock.ts` | `FLOCK` | 60,000 |
| `packages/game-cartridges/src/machines/sculptor.ts` | `SCULPTOR` | 60,000 |
| `packages/game-cartridges/src/machines/codebreaker.ts` | `CODEBREAKER` | 60,000 |

### New Client Files (14 files created — 2 per game)

| File | Purpose |
|------|---------|
| `apps/client/src/cartridges/games/ripple/Ripple.tsx` | Wrapper (ArcadeGameWrapper + renderBreakdown) |
| `apps/client/src/cartridges/games/ripple/RippleRenderer.tsx` | Canvas renderer |
| `apps/client/src/cartridges/games/bounce/Bounce.tsx` | Wrapper |
| `apps/client/src/cartridges/games/bounce/BounceRenderer.tsx` | Canvas renderer |
| `apps/client/src/cartridges/games/inflate/Inflate.tsx` | Wrapper |
| `apps/client/src/cartridges/games/inflate/InflateRenderer.tsx` | Canvas renderer |
| `apps/client/src/cartridges/games/switchboard/Switchboard.tsx` | Wrapper |
| `apps/client/src/cartridges/games/switchboard/SwitchboardRenderer.tsx` | Canvas renderer |
| `apps/client/src/cartridges/games/flock/Flock.tsx` | Wrapper |
| `apps/client/src/cartridges/games/flock/FlockRenderer.tsx` | Canvas renderer |
| `apps/client/src/cartridges/games/sculptor/Sculptor.tsx` | Wrapper |
| `apps/client/src/cartridges/games/sculptor/SculptorRenderer.tsx` | Canvas renderer |
| `apps/client/src/cartridges/games/codebreaker/Codebreaker.tsx` | Wrapper |
| `apps/client/src/cartridges/games/codebreaker/CodebreakerRenderer.tsx` | Canvas renderer |

### Modified Files (7 files)

| File | Change |
|------|--------|
| `packages/shared-types/src/index.ts` | Add `RIPPLE`, `BOUNCE`, `INFLATE`, `SWITCHBOARD`, `FLOCK`, `SCULPTOR`, `CODEBREAKER` to `GameTypeSchema` |
| `packages/shared-types/src/game-type-info.ts` | Add 7 entries to `GAME_TYPE_INFO` (name + description) |
| `packages/shared-types/src/config.ts` | Add `Config.game.ripple/bounce/inflate/switchboard/flock/sculptor/codebreaker` |
| `packages/shared-types/src/cycle-defaults.ts` | Add 7 entries to `GAME_POOL` (all `minPlayers: 2`) |
| `packages/game-cartridges/src/machines/index.ts` | Export + register all 7 in `GAME_REGISTRY` |
| `apps/client/src/components/panels/GamePanel.tsx` | Add 7 lazy imports to `GAME_COMPONENTS` |
| `apps/client/src/cartridges/games/shared/Leaderboard.tsx` | Add 7 entries to `GAME_STAT_CONFIG` |

### Config Constants

```typescript
Config.game.ripple = {
  timeLimitMs: 60_000,
  maxStones: 20,
  scorePerSilver: 400,
  scorePerGold: 2000,
};

Config.game.bounce = {
  timeLimitMs: 60_000,
  maxPlatforms: 3,
  scorePerSilver: 300,
  bullseyeBonus: 3,       // bullseyes divisor for bonus silver
  scorePerGold: 1500,
};

Config.game.inflate = {
  timeLimitMs: 45_000,
  maxLives: 3,
  scorePerSilver: 250,
  perfectBankBonus: 2,     // perfectBanks divisor for bonus silver
  scorePerGold: 1200,
};

Config.game.switchboard = {
  timeLimitMs: 60_000,
  scorePerSilver: 500,
  scorePerGold: 2500,
};

Config.game.flock = {
  timeLimitMs: 60_000,
  startingBoids: 25,
  maxBoids: 30,
  scorePerSilver: 350,
  wholeFlockBonus: 3,      // wholeFlock divisor for bonus silver
  scorePerGold: 1800,
};

Config.game.sculptor = {
  timeLimitMs: 60_000,
  cutsPerRound: 3,
  gridSize: 40,
  scorePerSilver: 300,
  perfectCutBonus: 2,      // perfectCuts divisor for bonus silver
  scorePerGold: 1500,
};

Config.game.codebreaker = {
  timeLimitMs: 60_000,
  codeLength: 4,
  scorePerSilver: 400,
  geniusBonus: 3,          // bonus silver for best solve ≤ 2
  scorePerGold: 2000,
};
```

### GAME_POOL Entries

Append after existing arcade games:

```typescript
{ type: 'RIPPLE', minPlayers: 2 },
{ type: 'BOUNCE', minPlayers: 2 },
{ type: 'INFLATE', minPlayers: 2 },
{ type: 'SWITCHBOARD', minPlayers: 2 },
{ type: 'FLOCK', minPlayers: 2 },
{ type: 'SCULPTOR', minPlayers: 2 },
{ type: 'CODEBREAKER', minPlayers: 2 },
```

### GAME_STAT_CONFIG Entries

```typescript
RIPPLE:       { key: 'score',        label: 'Score' },
BOUNCE:       { key: 'score',        label: 'Score' },
INFLATE:      { key: 'score',        label: 'Score' },
SWITCHBOARD:  { key: 'score',        label: 'Score' },
FLOCK:        { key: 'score',        label: 'Score' },
SCULPTOR:     { key: 'score',        label: 'Score' },
CODEBREAKER:  { key: 'codesCracked', label: 'Codes' },
```

### GAME_TYPE_INFO Entries

```typescript
RIPPLE:       { name: 'Ripple',       description: 'Drop stones, ride the waves' },
BOUNCE:       { name: 'Bounce',       description: 'Draw platforms, nail the target' },
INFLATE:      { name: 'Inflate',      description: 'Push your luck, don\'t pop' },
SWITCHBOARD:  { name: 'Switchboard',  description: 'Flip, slide, dial — fast' },
FLOCK:        { name: 'Flock',        description: 'Herd your swarm through gates' },
SCULPTOR:     { name: 'Sculptor',     description: 'Carve the shape, match the target' },
CODEBREAKER:  { name: 'Codebreaker',  description: 'Crack the code before time runs out' },
```

### DemoServer

The DemoServer (`apps/game-server/src/demo/`) does not import from `GAME_REGISTRY` or spawn cartridge machines. Adding new types to `GameTypeSchema`/`GAME_REGISTRY` does NOT require DemoServer changes.

---

## Reward Balancing Summary

| Game | Time | Silver Formula | Max Silver | Gold Formula |
|------|------|---------------|------------|-------------|
| Ripple | 60s | score/400 | 15 | score/2000 |
| Bounce | 60s | score/300 + bullseyes/3 | 15 | score/1500 |
| Inflate | 45s | score/250 + perfectBanks/2 | 15 | score/1200 |
| Switchboard | 60s | score/500 | 15 | score/2500 |
| Flock | 60s | score/350 + wholeFlock/3 | 15 | score/1800 |
| Sculptor | 60s | score/300 + perfectCuts/2 | 15 | score/1500 |
| Codebreaker | 60s | score/400 + (bestSolve≤2 ? 3 : 0) | 15 | score/2000 |

All follow existing pattern: silver is primary reward (capped at 15), gold is a smaller contribution from exceptional play.

---

## Wrapper Components (renderBreakdown)

Each game's wrapper provides a `renderBreakdown` prop for `ArcadeGameWrapper`:

| Game | Breakdown Stats |
|------|----------------|
| Ripple | Score, stones used (of 20), amplifies triggered |
| Bounce | Score, rounds completed, bullseyes, max streak |
| Inflate | Score, balloons banked, balloons popped, perfect banks |
| Switchboard | Score, instructions completed, max streak, accuracyPct % |
| Flock | Score, gates passed, boids remaining, whole flock gates |
| Sculptor | Score, rounds completed, perfect cuts, avg accuracyPct % |
| Codebreaker | Score, codes cracked, avg guesses, best solve |

---

## Arcade Game Skill

Create a reusable skill for adding future arcade games. Encodes the full pattern so future agents can add games without this conversation's context.

**Skill location:** `.claude/skills/add-arcade-game.md`

**Skill should encode:**
- The `createArcadeMachine()` factory API and config shape
- The `ArcadeRendererProps` interface (`seed`, `difficulty`, `timeLimit`, `onResult`)
- The `ArcadeGameWrapper` lifecycle and `renderBreakdown` prop
- All 8 registration touchpoints (shared-types, game-cartridges, client) with file paths
- Available VFX primitives and their APIs (after this batch: 13 primitives total)
- Canvas rendering conventions (pure procedural, theme-aware, no sprites/audio)
- Mobile design rules (48px targets, no long-press, no edge-drag, finger occlusion)
- Scoring conventions (integer results, silver capped at 15, gold from exceptional play)
- The seeded PRNG pattern (`mulberry32(seed)`)
- Config constant conventions (`Config.game.<name>`)
- GAME_STAT_CONFIG, GAME_TYPE_INFO, GAME_POOL entry patterns
- Difficulty ramp convention (4 phases, `difficulty` parameter 0-1 shifts phases)

**Trigger phrases:** "add arcade game", "new minigame", "create cartridge", "add a game called X"

---

## Out of Scope

- Audio/sound effects — no audio system exists
- Migrating existing games to new VFX primitives (SpringValue, FloatingTextEmitter) — future follow-up
- New sync-decision or trivia games
- Leaderboard changes beyond stat config entries
- Multiplayer/shared arcade games (all arcade games are solo score-based)
- AI opponents (Switchboard instructions and Codebreaker codes are seeded-random, not AI-driven)
