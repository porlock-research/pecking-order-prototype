# New Arcade Cartridges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three visually compelling arcade games (Shockwave, Orbit, Beat Drop) with a shared canvas VFX module.

**Architecture:** Each game follows the existing arcade cartridge pattern — `createArcadeMachine()` on the server, canvas renderer + `ArcadeGameWrapper` on the client. A shared VFX module (`canvas-vfx.ts`) provides reusable particle, trail, shake, glow, and timing effects that consume `CartridgeTheme` colors for shell-adaptive visuals.

**Tech Stack:** XState v5 (server machines), React 19 + HTML5 Canvas (client renderers), TypeScript, Zod (shared types), `@pecking-order/ui-kit` (theme system)

**Spec:** `docs/superpowers/specs/2026-04-10-new-arcade-cartridges-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `apps/client/src/cartridges/games/shared/canvas-vfx.ts` | Shared VFX primitives: ParticleEmitter, TrailRenderer, ScreenShake, drawWithGlow, SlowMo, ScreenFlash, PulseRingEmitter, mulberry32, lerp, angle utils |
| `packages/game-cartridges/src/machines/shockwave.ts` | Shockwave server machine (createArcadeMachine wrapper) |
| `packages/game-cartridges/src/machines/orbit.ts` | Orbit server machine |
| `packages/game-cartridges/src/machines/beat-drop.ts` | Beat Drop server machine |
| `apps/client/src/cartridges/games/shockwave/ShockwaveRenderer.tsx` | Shockwave canvas game renderer |
| `apps/client/src/cartridges/games/shockwave/Shockwave.tsx` | Shockwave ArcadeGameWrapper integration |
| `apps/client/src/cartridges/games/orbit/OrbitRenderer.tsx` | Orbit canvas game renderer |
| `apps/client/src/cartridges/games/orbit/Orbit.tsx` | Orbit ArcadeGameWrapper integration |
| `apps/client/src/cartridges/games/beat-drop/BeatDropRenderer.tsx` | Beat Drop canvas game renderer |
| `apps/client/src/cartridges/games/beat-drop/BeatDrop.tsx` | Beat Drop ArcadeGameWrapper integration |

### Modified Files

| File | Lines | Change |
|------|-------|--------|
| `packages/shared-types/src/index.ts` | ~90 | Add `SHOCKWAVE`, `ORBIT`, `BEAT_DROP` to `GameTypeSchema` |
| `packages/shared-types/src/game-type-info.ts` | ~28 | Add 3 entries to `GAME_TYPE_INFO` |
| `packages/shared-types/src/config.ts` | ~118 | Add `Config.game.shockwave`, `.orbit`, `.beatDrop` |
| `packages/shared-types/src/cycle-defaults.ts` | ~41 | Append 3 entries to `GAME_POOL` |
| `packages/game-cartridges/src/machines/index.ts` | ~22, ~39, ~57 | Export, import, and register 3 machines |
| `apps/client/src/components/panels/GamePanel.tsx` | ~21 | Add 3 lazy imports to `GAME_COMPONENTS` |
| `apps/client/src/cartridges/games/shared/Leaderboard.tsx` | ~21 | Add 3 entries to `GAME_STAT_CONFIG` |

---

## Task 1: Register Game Types in shared-types

**Files:**
- Modify: `packages/shared-types/src/index.ts:86-93`
- Modify: `packages/shared-types/src/game-type-info.ts:12-29`
- Modify: `packages/shared-types/src/config.ts:33-119`
- Modify: `packages/shared-types/src/cycle-defaults.ts:24-41`

- [ ] **Step 1: Add game types to GameTypeSchema**

In `packages/shared-types/src/index.ts`, add the three new types to the `GameTypeSchema` enum (before `"NONE"`):

```typescript
export const GameTypeSchema = z.enum([
  "TRIVIA", "REALTIME_TRIVIA",
  "GAP_RUN", "GRID_PUSH", "SEQUENCE",
  "REACTION_TIME", "COLOR_MATCH", "STACKER", "QUICK_MATH", "SIMON_SAYS", "AIM_TRAINER",
  "BET_BET_BET", "BLIND_AUCTION", "KINGS_RANSOM", "THE_SPLIT",
  "TOUCH_SCREEN",
  "SHOCKWAVE", "ORBIT", "BEAT_DROP",
  "NONE",
]);
```

- [ ] **Step 2: Add GAME_TYPE_INFO entries**

In `packages/shared-types/src/game-type-info.ts`, add before the closing `}` of `GAME_TYPE_INFO`:

```typescript
  SHOCKWAVE:   { name: 'Shockwave', description: 'Dodge contracting rings in a neon arena' },
  ORBIT:       { name: 'Orbit',     description: 'Slingshot between gravity wells — timing is everything' },
  BEAT_DROP:   { name: 'Beat Drop', description: 'Hit notes on the beat, build combos, don\'t miss' },
```

- [ ] **Step 3: Add Config constants**

In `packages/shared-types/src/config.ts`, add inside `Config.game` (after the last game entry, before the closing `}`):

```typescript
    shockwave: {
      timeLimitMs: 60_000,
      scorePerSilver: 3,
      nearMissBonus: 5,
      scorePerGold: 15,
    },
    orbit: {
      timeLimitMs: 60_000,
      transfersPerSilver: 2,
      perfectsPerBonusSilver: 3,
      transfersPerGold: 10,
    },
    beatDrop: {
      timeLimitMs: 90_000,
      scorePerSilver: 500,
      perfectAccuracyBonus: 3,
      scorePerGold: 2500,
      startBpm: 100,
      endBpm: 160,
      maxLives: 3,
    },
```

- [ ] **Step 4: Add to GAME_POOL**

In `packages/shared-types/src/cycle-defaults.ts`, append to the `GAME_POOL` array (after the `AIM_TRAINER` entry, before the closing `]`):

```typescript
  { type: 'SHOCKWAVE', minPlayers: 2 },
  { type: 'ORBIT', minPlayers: 2 },
  { type: 'BEAT_DROP', minPlayers: 2 },
```

Do NOT add to `LIVE_GAMES` — these are solo arcade games.

- [ ] **Step 5: Verify types compile**

Run: `cd packages/shared-types && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/index.ts packages/shared-types/src/game-type-info.ts packages/shared-types/src/config.ts packages/shared-types/src/cycle-defaults.ts
git commit -m "feat: register SHOCKWAVE, ORBIT, BEAT_DROP game types"
```

---

## Task 2: Create Server Machines

**Files:**
- Create: `packages/game-cartridges/src/machines/shockwave.ts`
- Create: `packages/game-cartridges/src/machines/orbit.ts`
- Create: `packages/game-cartridges/src/machines/beat-drop.ts`
- Modify: `packages/game-cartridges/src/machines/index.ts`

- [ ] **Step 1: Write Shockwave machine**

Create `packages/game-cartridges/src/machines/shockwave.ts`:

```typescript
/**
 * Shockwave Machine
 *
 * Neon survival — dodge contracting ring hazards. Uses the generic arcade machine
 * factory — only defines game-specific reward logic.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, scorePerSilver, nearMissBonus, scorePerGold } = Config.game.shockwave;

export const shockwaveMachine = createArcadeMachine({
  gameType: 'SHOCKWAVE',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const wavesCleared = result.wavesCleared || 0;
    const nearMisses = result.nearMisses || 0;
    const silver = Math.min(
      Config.game.arcade.maxSilver,
      Math.floor(wavesCleared / scorePerSilver) + Math.floor(nearMisses / nearMissBonus),
    );
    return {
      silver,
      gold: Math.floor(wavesCleared / scorePerGold),
    };
  },
});
```

- [ ] **Step 2: Write Orbit machine**

Create `packages/game-cartridges/src/machines/orbit.ts`:

```typescript
/**
 * Orbit Machine
 *
 * Cosmic physics/timing — slingshot between gravity wells. Uses the generic arcade
 * machine factory — only defines game-specific reward logic.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, transfersPerSilver, perfectsPerBonusSilver, transfersPerGold } = Config.game.orbit;

export const orbitMachine = createArcadeMachine({
  gameType: 'ORBIT',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const transfers = result.transfers || 0;
    const perfectCaptures = result.perfectCaptures || 0;
    const silver = Math.min(
      Config.game.arcade.maxSilver,
      Math.floor(transfers / transfersPerSilver) + Math.floor(perfectCaptures / perfectsPerBonusSilver),
    );
    return {
      silver,
      gold: Math.floor(transfers / transfersPerGold),
    };
  },
});
```

- [ ] **Step 3: Write Beat Drop machine**

Create `packages/game-cartridges/src/machines/beat-drop.ts`:

```typescript
/**
 * Beat Drop Machine
 *
 * Rhythm lane game — hit notes on the beat, build combos. Uses the generic arcade
 * machine factory — only defines game-specific reward logic.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, scorePerSilver, perfectAccuracyBonus, scorePerGold } = Config.game.beatDrop;

export const beatDropMachine = createArcadeMachine({
  gameType: 'BEAT_DROP',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const accuracyPct = result.accuracyPct || 0;
    const accuracyBonus = accuracyPct === 100 ? perfectAccuracyBonus : 0;
    const silver = Math.min(
      Config.game.arcade.maxSilver,
      Math.floor(score / scorePerSilver) + accuracyBonus,
    );
    return {
      silver,
      gold: Math.floor(score / scorePerGold),
    };
  },
});
```

- [ ] **Step 4: Register in GAME_REGISTRY**

In `packages/game-cartridges/src/machines/index.ts`, add three lines to the export section (after line 22):

```typescript
export { shockwaveMachine } from './shockwave';
export { orbitMachine } from './orbit';
export { beatDropMachine } from './beat-drop';
```

Add three lines to the import section (after line 39):

```typescript
import { shockwaveMachine } from './shockwave';
import { orbitMachine } from './orbit';
import { beatDropMachine } from './beat-drop';
```

Add three entries to `GAME_REGISTRY` (before the closing `} as const`):

```typescript
  SHOCKWAVE: shockwaveMachine,
  ORBIT: orbitMachine,
  BEAT_DROP: beatDropMachine,
```

- [ ] **Step 5: Verify game-cartridges compiles**

Run: `cd packages/game-cartridges && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Run existing tests to confirm no regression**

Run: `cd apps/game-server && npx vitest run`
Expected: All 324 tests pass. New machines don't have tests yet (they use the battle-tested arcade factory).

- [ ] **Step 7: Commit**

```bash
git add packages/game-cartridges/src/machines/shockwave.ts packages/game-cartridges/src/machines/orbit.ts packages/game-cartridges/src/machines/beat-drop.ts packages/game-cartridges/src/machines/index.ts
git commit -m "feat: add Shockwave, Orbit, Beat Drop server machines"
```

---

## Task 3: Build Shared Canvas VFX Module

**Files:**
- Create: `apps/client/src/cartridges/games/shared/canvas-vfx.ts`

This is the largest single file. It contains 7 classes/functions and utility helpers. All are pure canvas logic with no React dependency.

- [ ] **Step 1: Create canvas-vfx.ts with utility functions**

Create `apps/client/src/cartridges/games/shared/canvas-vfx.ts`:

```typescript
/**
 * Shared Canvas VFX Module
 *
 * Composable visual effect primitives for arcade game renderers.
 * All effects accept raw color strings — renderers pass theme colors in.
 * No React dependency — pure canvas logic.
 */

// Re-export from ui-kit — DO NOT re-implement
export { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';

// --- Seeded PRNG (Mulberry32) ---
// Single source of truth — replaces 9 copy-pasted implementations across renderers.

export function mulberry32(seed: number): () => number {
  return () => {
    let s = seed;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    seed = s;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Math Utilities ---

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function normalizeAngle(a: number): number {
  return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

export function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}
```

- [ ] **Step 2: Add ParticleEmitter**

Append to `canvas-vfx.ts`:

```typescript
// --- ParticleEmitter ---

export interface ParticleConfig {
  count: number;
  position: { x: number; y: number };
  velocity: { min: number; max: number };
  angle: { min: number; max: number };
  lifetime: { min: number; max: number };
  size: { start: number; end: number };
  color: string | string[];
  opacity: { start: number; end: number };
  gravity?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  sizeStart: number;
  sizeEnd: number;
  color: string;
  opacityStart: number;
  opacityEnd: number;
  gravity: number;
}

export class ParticleEmitter {
  private particles: Particle[] = [];

  get activeCount(): number {
    return this.particles.length;
  }

  emit(config: ParticleConfig, rng?: () => number): void {
    const rand = rng || Math.random;
    const colors = Array.isArray(config.color) ? config.color : [config.color];
    for (let i = 0; i < config.count; i++) {
      const angle = config.angle.min + rand() * (config.angle.max - config.angle.min);
      const speed = config.velocity.min + rand() * (config.velocity.max - config.velocity.min);
      const life = config.lifetime.min + rand() * (config.lifetime.max - config.lifetime.min);
      this.particles.push({
        x: config.position.x,
        y: config.position.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        sizeStart: config.size.start,
        sizeEnd: config.size.end,
        color: colors[Math.floor(rand() * colors.length)],
        opacityStart: config.opacity.start,
        opacityEnd: config.opacity.end,
        gravity: config.gravity ?? 0,
      });
    }
  }

  update(dt: number): void {
    const dtSec = dt / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dtSec;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const t = 1 - p.life / p.maxLife;
      const size = lerp(p.sizeStart, p.sizeEnd, t);
      const opacity = lerp(p.opacityStart, p.opacityEnd, t);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.particles.length = 0;
  }
}
```

- [ ] **Step 3: Add TrailRenderer**

Append to `canvas-vfx.ts`:

```typescript
// --- TrailRenderer ---

export interface TrailConfig {
  maxPoints: number;
  width: { start: number; end: number };
  color: string | ((index: number, total: number) => string);
  opacity: { start: number; end: number };
}

export class TrailRenderer {
  private points: { x: number; y: number }[] = [];
  private config: TrailConfig;

  constructor(config: TrailConfig) {
    this.config = config;
  }

  push(x: number, y: number): void {
    this.points.unshift({ x, y });
    if (this.points.length > this.config.maxPoints) {
      this.points.length = this.config.maxPoints;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { points, config } = this;
    if (points.length < 2) return;

    for (let i = 0; i < points.length - 1; i++) {
      const t = i / (points.length - 1);
      const width = lerp(config.width.start, config.width.end, t);
      const opacity = lerp(config.opacity.start, config.opacity.end, t);
      const color = typeof config.color === 'function'
        ? config.color(i, points.length)
        : config.color;

      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i + 1].x, points[i + 1].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.points.length = 0;
  }
}
```

- [ ] **Step 4: Add ScreenShake**

Append to `canvas-vfx.ts`:

```typescript
// --- ScreenShake ---

export interface ShakeConfig {
  intensity: number;
  duration: number;
  decay?: 'linear' | 'exponential';
}

export class ScreenShake {
  private intensity = 0;
  private duration = 0;
  private elapsed = 0;
  private decay: 'linear' | 'exponential' = 'exponential';
  private offsetX = 0;
  private offsetY = 0;

  trigger(config: ShakeConfig): void {
    this.intensity = config.intensity;
    this.duration = config.duration;
    this.elapsed = 0;
    this.decay = config.decay ?? 'exponential';
  }

  update(dt: number): void {
    if (this.elapsed >= this.duration) {
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }
    this.elapsed += dt;
    const t = Math.min(1, this.elapsed / this.duration);
    const factor = this.decay === 'exponential' ? Math.pow(1 - t, 2) : 1 - t;
    const mag = this.intensity * factor;
    this.offsetX = (Math.random() * 2 - 1) * mag;
    this.offsetY = (Math.random() * 2 - 1) * mag;
  }

  apply(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
  }

  restore(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }
}
```

- [ ] **Step 5: Add drawWithGlow, SlowMo, ScreenFlash, PulseRingEmitter**

Append to `canvas-vfx.ts`:

```typescript
// --- Glow ---

export function drawWithGlow(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  drawFn: () => void,
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  drawFn();
  ctx.restore();
}

// --- SlowMo ---

export class SlowMo {
  private factor = 1;
  private duration = 0;
  private elapsed = 0;

  get active(): boolean {
    return this.elapsed < this.duration;
  }

  trigger(factor: number, duration: number): void {
    this.factor = factor;
    this.duration = duration;
    this.elapsed = 0;
  }

  update(realDt: number): number {
    if (this.elapsed >= this.duration) return realDt;
    this.elapsed += realDt;
    return realDt * this.factor;
  }
}

// --- ScreenFlash ---

export class ScreenFlash {
  private color = '';
  private duration = 0;
  private elapsed = 0;

  trigger(color: string, duration: number): void {
    this.color = color;
    this.duration = duration;
    this.elapsed = 0;
  }

  update(dt: number): void {
    this.elapsed += dt;
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.elapsed >= this.duration) return;
    const t = this.elapsed / this.duration;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = this.color;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }
}

// --- PulseRingEmitter ---

export interface PulseRingConfig {
  x: number;
  y: number;
  color: string;
  maxRadius: number;
  duration: number;
  lineWidth?: number;
}

interface PulseRing {
  x: number;
  y: number;
  color: string;
  maxRadius: number;
  duration: number;
  lineWidth: number;
  elapsed: number;
}

export class PulseRingEmitter {
  private rings: PulseRing[] = [];

  emit(config: PulseRingConfig): void {
    this.rings.push({
      ...config,
      lineWidth: config.lineWidth ?? 2,
      elapsed: 0,
    });
  }

  update(dt: number): void {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].elapsed += dt;
      if (this.rings[i].elapsed >= this.rings[i].duration) {
        this.rings.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const ring of this.rings) {
      const t = ring.elapsed / ring.duration;
      const radius = ring.maxRadius * t;
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = ring.lineWidth;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
```

- [ ] **Step 6: Verify the file compiles**

Run: `cd apps/client && npx tsc --noEmit`
Expected: No errors. The VFX module has no React imports — it's pure TypeScript with canvas APIs.

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/cartridges/games/shared/canvas-vfx.ts
git commit -m "feat: add shared canvas VFX module (particles, trails, shake, glow, slow-mo)"
```

---

## Task 4: Build Shockwave Client

**Files:**
- Create: `apps/client/src/cartridges/games/shockwave/ShockwaveRenderer.tsx`
- Create: `apps/client/src/cartridges/games/shockwave/Shockwave.tsx`

- [ ] **Step 1: Create ShockwaveRenderer.tsx**

Create `apps/client/src/cartridges/games/shockwave/ShockwaveRenderer.tsx`:

```typescript
import { useEffect, useRef, useCallback } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import type { CartridgeTheme } from '@pecking-order/ui-kit/cartridge-theme';
import { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';
import {
  mulberry32, lerp, normalizeAngle, distance,
  ParticleEmitter, TrailRenderer, ScreenShake,
  drawWithGlow, SlowMo, ScreenFlash, PulseRingEmitter,
} from '../shared/canvas-vfx';
```

The renderer must implement `ArcadeRendererProps`:
```typescript
interface ArcadeRendererProps {
  seed: number;
  difficulty: number;   // 0-1
  timeLimit: number;    // ms
  onResult: (result: Record<string, number>) => void;
}
```

Implement the full game:

**Game state:**
- Player position `{ x, y }` moving toward mouse/touch target at fixed speed (200 px/s)
- Array of `Wave` objects: `{ angle: number, gapStart: number, gapSize: number, radius: number, speed: number, color: string, rotating: boolean, rotationSpeed: number }`
- Waves spawn at arena edge (radius = arena radius) and contract inward. When `radius < 10`, wave is removed and `wavesCleared++`
- Collision: check if player is within ring radius ± half-linewidth AND not within any gap arc
- Near-miss: player passes within 10px of ring edge without collision → `nearMisses++`, trigger SlowMo + ScreenFlash + particles
- Dash: on click/tap, burst player velocity 3x for 150ms. 3-second cooldown. Resets combo.
- Combo: consecutive waves survived without dash → 1x (0-4), 1.5x (5-9), 2x (10-19), 3x (20+)

**Difficulty ramp** (time-based, shifted by `difficulty` param):
```typescript
const phaseTime = (base: number) => base * (1 - difficulty * 0.3);
// 0-10s: gapSize 60°, speed 80px/s, single rings every 2s
// 10-25s: gapSize 45°→30°, speed 120px/s, doubles occasional
// 25-40s: gapSize 30°→20°, speed 160px/s, triples, some rotating
// 40s+: gapSize 20°→15°, speed 200px/s, overlapping, rotating
```

**Wave generation**: Use seeded PRNG. Each wave gets: random gap position (0–2π), gap size (from difficulty ramp), color cycling through `[theme.colors.gold, theme.colors.pink, theme.colors.danger, theme.colors.green]`, optional rotation flag.

**Canvas size**: 400x400. Arena centered, radius 180px.

**Rendering** (each frame):
1. Clear canvas with `theme.colors.bg`
2. `screenShake.apply(ctx)`
3. Draw faint radial grid lines (8 lines, `theme.colors.textDim` at 0.05 opacity)
4. Draw drifting background particles (ambient, very slow, `theme.colors.textDim` at 0.1)
5. Draw each wave ring: `ctx.arc(centerX, centerY, wave.radius, gapEnd, gapStart)` with `drawWithGlow`. Gap edge dots at endpoints.
6. Draw player: white core (6px circle) + glow halo (20px blur) via `drawWithGlow`
7. Draw dash trail (TrailRenderer) if dashing
8. `particles.draw(ctx)`, `pulseRings.draw(ctx)`, `screenFlash.draw(ctx)`
9. `screenShake.restore(ctx)`
10. Draw HUD: wave count (top-left), combo (top-right), time remaining (bottom-center)

**Death sequence**: SlowMo(0.1, 300ms) → player shatters (20 particles outward) → rings freeze → ScreenFlash white → after 500ms call `onResult({ wavesCleared, nearMisses, maxCombo })`.

**Input handling:**
- `mousemove`/`touchmove` → update target position
- `mousedown`/`touchstart` → trigger dash (if off cooldown)
- Register listeners on mount, clean up on unmount

This file will be large (~400-500 lines). That's expected for a canvas game renderer — the game loop, physics, rendering, and input handling are inherently coupled.

- [ ] **Step 2: Create Shockwave.tsx wrapper**

Create `apps/client/src/cartridges/games/shockwave/Shockwave.tsx`:

```typescript
import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import ShockwaveRenderer from './ShockwaveRenderer';

interface ShockwaveProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Shockwave(props: ShockwaveProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Shockwave"
      description="Dodge the contracting rings! Move toward your cursor/finger, click to dash. Survive as long as you can."
      Renderer={ShockwaveRenderer}
      renderBreakdown={(result) => {
        const wavesCleared = result.wavesCleared || 0;
        const nearMisses = result.nearMisses || 0;
        const maxCombo = result.maxCombo || 0;
        const { scorePerSilver, nearMissBonus } = Config.game.shockwave;
        const waveSilver = Math.floor(wavesCleared / scorePerSilver);
        const bonusSilver = Math.floor(nearMisses / nearMissBonus);

        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Waves cleared</span>
              <span className="text-white">{wavesCleared}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Near misses</span>
              <span className="text-white">{nearMisses}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Max combo</span>
              <span className="text-white">{maxCombo}x</span>
            </div>
            <div className="border-t border-white/[0.06] pt-2 flex justify-between">
              <span className="text-white/50">Silver</span>
              <span className="text-skin-gold">{waveSilver} + {bonusSilver} bonus</span>
            </div>
          </div>
        );
      }}
    />
  );
}
```

- [ ] **Step 3: Verify client compiles**

Run: `cd apps/client && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/cartridges/games/shockwave/
git commit -m "feat: add Shockwave client renderer and wrapper"
```

---

## Task 5: Build Orbit Client

**Files:**
- Create: `apps/client/src/cartridges/games/orbit/OrbitRenderer.tsx`
- Create: `apps/client/src/cartridges/games/orbit/Orbit.tsx`

- [ ] **Step 1: Create OrbitRenderer.tsx**

Create `apps/client/src/cartridges/games/orbit/OrbitRenderer.tsx`:

Same imports as Shockwave (ArcadeRendererProps, useCartridgeTheme, withAlpha, canvas-vfx primitives).

**Game state:**
- `stars: Star[]` — each has `{ x, y, radius, wellRadius, color, pulsePhase }`
- `planet: { x, y, vx, vy }` — position and velocity
- `currentStar: number` — index of the star being orbited
- `orbitAngle: number` — current angle of orbit
- `orbitSpeed: number` — radians per second, increases with each transfer
- `state: 'orbiting' | 'flying' | 'captured' | 'dead'`
- `camera: { x, y, targetX, targetY }` — smooth follow
- `transfers, perfectCaptures: number`

**Star field generation**: Generate stars in chunks of 5 ahead of player direction. Use seeded PRNG. Each star is placed within reachable distance (100-250px from at least one existing star). Gravity well radius decreases with progression: `80 - (transferCount * 2)`, min 40px. Colors from `[theme.colors.gold, theme.colors.orange, theme.colors.pink, theme.colors.text]`.

**Orbit physics**:
```typescript
// During orbiting
orbitAngle += orbitSpeed * dtSec;
planet.x = star.x + Math.cos(orbitAngle) * star.radius;
planet.y = star.y + Math.sin(orbitAngle) * star.radius;

// On release (tap/click)
const tangentAngle = orbitAngle + Math.PI / 2; // perpendicular to radius
const releaseSpeed = orbitSpeed * star.radius; // linear speed = angular * radius
planet.vx = Math.cos(tangentAngle) * releaseSpeed;
planet.vy = Math.sin(tangentAngle) * releaseSpeed;
state = 'flying';

// During flying
planet.x += planet.vx * dtSec;
planet.y += planet.vy * dtSec;
// Check if planet entered any star's gravity well
for (const star of visibleStars) {
  if (distance(planet.x, planet.y, star.x, star.y) < star.wellRadius) {
    // Captured! Calculate orbit radius and angle
    currentStar = starIndex;
    orbitAngle = angleBetween(star.x, star.y, planet.x, planet.y);
    state = 'orbiting';
    transfers++;
    // Perfect if within inner 30%
    if (distance(planet.x, planet.y, star.x, star.y) < star.wellRadius * 0.3) {
      perfectCaptures++;
    }
    orbitSpeed *= 1.08; // 8% faster each transfer
    break;
  }
}
// If planet is >200px outside viewport bounds → dead
```

**Camera**:
```typescript
// During orbit: camera target = current star position
// During flight: camera lerps toward planet at 5% per frame
camera.x = lerp(camera.x, camera.targetX, 0.05);
camera.y = lerp(camera.y, camera.targetY, 0.05);
// On capture: camera target = new star, lerps over ~300ms (ease-out handled by lerp rate)
// Drawing: ctx.translate(-camera.x + canvasWidth/2, -camera.y + canvasHeight/2)
```

**Trajectory preview**: Dotted line from planet in tangent direction, length 80px. Hidden when `difficulty > 0.6`.

**Canvas size**: 400x400 (viewport into a larger world).

**Rendering** (each frame):
1. Clear with `theme.colors.bg`
2. Draw parallax background stars (2 layers of static dots, offset by camera * 0.1 and 0.2)
3. Apply camera transform
4. Draw gravity wells (faint dashed circles, brighter when planet nearby)
5. Draw stars (radial gradient + drawWithGlow, subtle size pulse)
6. Draw orbit path (dotted circle) for current star
7. Draw trajectory preview (dotted line, if visible)
8. Draw planet (8px circle + glow) with comet trail (TrailRenderer, 40 points, color gradient info→pink)
9. Draw capture effects (PulseRingEmitter, particles)
10. Restore camera transform
11. Draw HUD (transfers top-left, score top-right)

**Death**: Trail fades, stars dim over 800ms via global alpha ramp, then call `onResult({ transfers, perfectCaptures, longestChain: transfers })`.

**Input**: `mousedown`/`touchstart` → release planet (if orbiting). Single tap. No movement input — the game is pure timing.

- [ ] **Step 2: Create Orbit.tsx wrapper**

Create `apps/client/src/cartridges/games/orbit/Orbit.tsx`:

```typescript
import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import OrbitRenderer from './OrbitRenderer';

interface OrbitProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Orbit(props: OrbitProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Orbit"
      description="Tap to release your planet and fly to the next star. Time your release carefully — miss and you drift into the void."
      Renderer={OrbitRenderer}
      renderBreakdown={(result) => {
        const transfers = result.transfers || 0;
        const perfectCaptures = result.perfectCaptures || 0;
        const { transfersPerSilver, perfectsPerBonusSilver } = Config.game.orbit;
        const baseSilver = Math.floor(transfers / transfersPerSilver);
        const bonusSilver = Math.floor(perfectCaptures / perfectsPerBonusSilver);

        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Transfers</span>
              <span className="text-white">{transfers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Perfect captures</span>
              <span className="text-white">{perfectCaptures}</span>
            </div>
            <div className="border-t border-white/[0.06] pt-2 flex justify-between">
              <span className="text-white/50">Silver</span>
              <span className="text-skin-gold">{baseSilver} + {bonusSilver} bonus</span>
            </div>
          </div>
        );
      }}
    />
  );
}
```

- [ ] **Step 3: Verify client compiles**

Run: `cd apps/client && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/cartridges/games/orbit/
git commit -m "feat: add Orbit client renderer and wrapper"
```

---

## Task 6: Build Beat Drop Client

**Files:**
- Create: `apps/client/src/cartridges/games/beat-drop/BeatDropRenderer.tsx`
- Create: `apps/client/src/cartridges/games/beat-drop/BeatDrop.tsx`

- [ ] **Step 1: Create BeatDropRenderer.tsx**

Create `apps/client/src/cartridges/games/beat-drop/BeatDropRenderer.tsx`:

Same imports as other renderers (ArcadeRendererProps, useCartridgeTheme, withAlpha, canvas-vfx).
Also import `Config` from `@pecking-order/shared-types` for BPM config.

**Game state:**
- `notes: Note[]` — each has `{ lane: 0-3, time: number (ms from start), duration: number (0 for tap, >0 for hold), hit: boolean, grade?: TimingGrade }`
- `activeNotes: Note[]` — notes currently visible on screen (within draw window)
- `combo: number`, `maxCombo: number`, `score: number`, `lives: number` (starts at 3)
- `perfectHits: number`, `totalHits: number`, `totalNotes: number` (for accuracyPct)
- `laneKeyState: boolean[]` — [D, F, J, K] pressed state
- `holdProgress: Map<Note, number>` — tracking hold completion

**Lane colors** (from theme):
```typescript
const LANE_COLORS = [theme.colors.pink, theme.colors.orange, theme.colors.info, theme.colors.gold];
```

**Pattern generation** (seeded, run once at game start):
```typescript
const { startBpm, endBpm } = Config.game.beatDrop;
// Pre-generate all notes for the entire song duration
// BPM ramps linearly: bpm(t) = startBpm + (endBpm - startBpm) * (t / timeLimit)
// Beat interval at time t: 60000 / bpm(t) ms
// Walk through time, placing beats at intervals, selecting patterns from templates
const patterns = {
  single: (lane: number, time: number) => [{ lane, time, duration: 0 }],
  double: (l1: number, l2: number, time: number) => [
    { lane: l1, time, duration: 0 },
    { lane: l2, time, duration: 0 },
  ],
  run: (lane: number, time: number, interval: number) => [
    { lane, time, duration: 0 },
    { lane, time: time + interval, duration: 0 },
    { lane, time: time + interval * 2, duration: 0 },
  ],
  sweep: (time: number, interval: number, reverse: boolean) => {
    const lanes = reverse ? [3, 2, 1, 0] : [0, 1, 2, 3];
    return lanes.map((l, i) => ({ lane: l, time: time + interval * i, duration: 0 }));
  },
  hold: (lane: number, time: number, holdDuration: number) => [
    { lane, time, duration: holdDuration },
  ],
};
// Difficulty controls pattern mix: low difficulty = 80% singles, high = mixed
```

**Timing system**:
```typescript
const HIT_LINE_Y = canvasHeight - 80; // 80px from bottom
const NOTE_SPEED = 300; // px/s — notes fall at this speed
const VISIBLE_AHEAD_MS = (canvasHeight / NOTE_SPEED) * 1000; // how far ahead to show notes

// Note Y position at any moment:
// noteY = HIT_LINE_Y - (note.time - currentTime) * NOTE_SPEED / 1000
// When noteY === HIT_LINE_Y, it's at the hit line

// On key press, find closest unhit note in that lane within ±100ms
const timingDiff = Math.abs(note.time - currentTime);
if (timingDiff <= 30) grade = 'PERFECT'; // 100 pts
else if (timingDiff <= 60) grade = 'GREAT'; // 60 pts
else if (timingDiff <= 100) grade = 'GOOD'; // 30 pts
else grade = 'MISS'; // 0 pts
// Notes that pass HIT_LINE_Y + 100ms without being hit → auto-MISS
```

**Combo multiplier**: `1x (0-9), 2x (10-24), 3x (25-49), 4x (50+)`:
```typescript
function comboMultiplier(combo: number): number {
  if (combo >= 50) return 4;
  if (combo >= 25) return 3;
  if (combo >= 10) return 2;
  return 1;
}
```

**Hold notes**: On key press matching a hold note, start tracking. While key held AND note tail hasn't passed: accumulate hold progress. On key release or tail passing: if progress >= 80%, score as the initial timing grade. If < 80%, score as MISS. If hold notes prove buggy, these can be removed — the pattern generator should have a `includeHolds` flag that defaults to `true` but can be flipped.

**Canvas size**: 300x500 (tall, portrait-oriented for lanes).

**Rendering** (each frame):
1. Clear with `theme.colors.bg`
2. `screenShake.apply(ctx)`
3. Draw lane backgrounds (4 vertical bands, lane colors at `theme.opacity.subtle`)
4. Combo-reactive background: at 2x pulse lanes on beat, at 3x color wash, at 4x edge glow + ember particles
5. Draw hit line (horizontal gradient across all 4 lane colors)
6. Draw notes: pills (36x14, rounded) with gradient fill in lane color. Scale 1.0→1.15 as approaching hit line. Hold notes: pill head + translucent body column.
7. Draw hit feedback text ("PERFECT", "GREAT", "GOOD") — fades up and out over 400ms
8. `particles.draw(ctx)`, `pulseRings.draw(ctx)`, `screenFlash.draw(ctx)`
9. `screenShake.restore(ctx)`
10. Draw key indicators at bottom (4 rounded rects, light up on press)
11. Draw HUD: score (top-left), combo+multiplier (top-right, scale animation), lives as dots (bottom-center)

**Death sequence** (3rd miss): All notes freeze, colors drain to grayscale over 300ms, shatter from center outward (large particle burst), ScreenFlash red. After 600ms call `onResult({ score, perfectHits, maxCombo, accuracyPct: Math.round(totalHits / totalNotes * 100) })`.

**Input**:
- Desktop: `keydown`/`keyup` for D(lane 0), F(lane 1), J(lane 2), K(lane 3)
- Mobile: 4 touch zones at bottom (each `canvasWidth/4` wide, 80px tall). `touchstart`/`touchend`.
- Must handle multiple simultaneous keys (doubles).

- [ ] **Step 2: Create BeatDrop.tsx wrapper**

Create `apps/client/src/cartridges/games/beat-drop/BeatDrop.tsx`:

```typescript
import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import BeatDropRenderer from './BeatDropRenderer';

interface BeatDropProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function BeatDrop(props: BeatDropProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Beat Drop"
      description="Hit the notes as they cross the line! Press D, F, J, K (or tap the lanes). Build combos for bonus points. 3 misses and you're out!"
      Renderer={BeatDropRenderer}
      renderBreakdown={(result) => {
        const score = result.score || 0;
        const perfectHits = result.perfectHits || 0;
        const maxCombo = result.maxCombo || 0;
        const accuracyPct = result.accuracyPct || 0;
        const { scorePerSilver, perfectAccuracyBonus } = Config.game.beatDrop;
        const baseSilver = Math.floor(score / scorePerSilver);
        const bonusSilver = accuracyPct === 100 ? perfectAccuracyBonus : 0;

        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Score</span>
              <span className="text-white">{score.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Perfect hits</span>
              <span className="text-white">{perfectHits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Max combo</span>
              <span className="text-white">{maxCombo}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Accuracy</span>
              <span className="text-white">{accuracyPct}%</span>
            </div>
            <div className="border-t border-white/[0.06] pt-2 flex justify-between">
              <span className="text-white/50">Silver</span>
              <span className="text-skin-gold">{baseSilver}{bonusSilver > 0 ? ` + ${bonusSilver} perfect bonus` : ''}</span>
            </div>
          </div>
        );
      }}
    />
  );
}
```

- [ ] **Step 3: Verify client compiles**

Run: `cd apps/client && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/cartridges/games/beat-drop/
git commit -m "feat: add Beat Drop client renderer and wrapper"
```

---

## Task 7: Wire Up Registration (GamePanel + Leaderboard)

**Files:**
- Modify: `apps/client/src/components/panels/GamePanel.tsx:5-22`
- Modify: `apps/client/src/cartridges/games/shared/Leaderboard.tsx:11-22`

- [ ] **Step 1: Add lazy imports to GAME_COMPONENTS**

In `apps/client/src/components/panels/GamePanel.tsx`, add three entries to the `GAME_COMPONENTS` map (after the `THE_SPLIT` entry, before the closing `}`):

```typescript
  [GameTypes.SHOCKWAVE]: React.lazy(() => import('../../cartridges/games/shockwave/Shockwave')),
  [GameTypes.ORBIT]: React.lazy(() => import('../../cartridges/games/orbit/Orbit')),
  [GameTypes.BEAT_DROP]: React.lazy(() => import('../../cartridges/games/beat-drop/BeatDrop')),
```

- [ ] **Step 2: Add GAME_STAT_CONFIG entries**

In `apps/client/src/cartridges/games/shared/Leaderboard.tsx`, add three entries to `GAME_STAT_CONFIG` (after the `TRIVIA` entry, before the closing `}`):

```typescript
  [GameTypes.SHOCKWAVE]: { key: 'wavesCleared', label: 'Waves' },
  [GameTypes.ORBIT]: { key: 'transfers', label: 'Transfers' },
  [GameTypes.BEAT_DROP]: { key: 'score', label: 'Score' },
```

- [ ] **Step 3: Verify full build**

Run: `npm run build`
Expected: All 8 turborepo tasks succeed. This is the first full build with all pieces wired together.

- [ ] **Step 4: Run all tests**

Run: `npm run test`
Expected: All tests pass. No new tests needed for registration — it's wiring only.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/panels/GamePanel.tsx apps/client/src/cartridges/games/shared/Leaderboard.tsx
git commit -m "feat: wire Shockwave, Orbit, Beat Drop into GamePanel and Leaderboard"
```

---

## Task 8: Manual Play Testing

**Files:** None (testing only)

- [ ] **Step 1: Start dev servers**

Run: `npm run dev`
This starts lobby (:3000), client (:5173), game-server (:8787) via turborepo.

- [ ] **Step 2: Create a test game with one of the new game types**

Use the `/create-game` skill or the lobby admin dashboard to create a dynamic test game. Set one of the days to use `SHOCKWAVE` as the game type. Join as a player.

- [ ] **Step 3: Play through Shockwave**

Verify:
- Game starts when you click "Start"
- Player follows mouse/touch
- Rings contract inward with visible gaps
- Dash works on click with cooldown
- Near-miss triggers slow-mo + particle burst
- Death triggers shatter effect + results screen
- Score breakdown shows waves/near-misses/combo
- Retry works (can play again, previous score preserved)
- Submit works (finalizes score, shows celebration + leaderboard)
- Theme colors adapt to the active shell

- [ ] **Step 4: Play through Orbit**

Set a day to `ORBIT` game type. Verify:
- Planet orbits the first star
- Tap releases tangentially
- Camera follows smoothly
- Gravity well capture works
- Perfect capture detection works (inner 30%)
- Trajectory preview shows (if difficulty < 0.6)
- Death (drifting away) triggers fade + results
- Score breakdown shows transfers/perfects

- [ ] **Step 5: Play through Beat Drop**

Set a day to `BEAT_DROP` game type. Verify:
- Notes fall in 4 lanes with correct colors
- D/F/J/K keys hit the correct lanes
- Timing grades display (PERFECT/GREAT/GOOD/MISS)
- Combo multiplier builds and resets on miss
- Lives decrease on miss, death on 3rd
- Hold notes work (if implemented) — press and hold
- Combo visual effects escalate (2x/3x/4x)
- Mobile: 4 tap zones work
- Score breakdown shows score/perfects/combo/accuracy

- [ ] **Step 6: Fix any issues found**

Address bugs, adjust tuning constants, fix visual glitches.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: address play testing feedback for new arcade games"
```

---

## Task 9: Final Build Verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: All tasks succeed.

- [ ] **Step 2: Full test suite**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: No errors in new files.

- [ ] **Step 4: Commit any remaining fixes**

If lint or build surfaced issues, fix and commit.
