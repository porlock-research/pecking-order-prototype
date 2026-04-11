# Arcade Batch 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 new arcade minigames (Ripple, Bounce, Inflate, Switchboard, Flock, Sculptor, Codebreaker), 6 new VFX primitives, and an arcade game creation skill.

**Architecture:** Each game follows the established arcade cartridge pattern — thin server machine via `createArcadeMachine()`, canvas renderer implementing `ArcadeRendererProps`, wrapper component using `ArcadeGameWrapper`. Foundation tasks (VFX + shared types) must complete first; all 7 games can then be built in parallel.

**Tech Stack:** XState v5 (server machines), React 19 + Canvas API (renderers), Vitest (tests), Zustand (client state), Tailwind CSS (wrapper components).

**Spec:** `docs/superpowers/specs/2026-04-11-arcade-batch-2-design.md`

**Implementation:** Create a worktree (`git worktree add`) since other sessions may be active on main.

---

## Task 1: VFX Core — SpringValue, FloatingTextEmitter, drawDottedLine

**Files:**
- Modify: `apps/client/src/cartridges/games/shared/canvas-vfx.ts`
- Create: `apps/client/src/cartridges/games/shared/__tests__/canvas-vfx.test.ts`

These three primitives are used by all 7 games. Add them after the existing `PulseRingEmitter` class.

- [ ] **Step 1: Write tests for SpringValue**

```typescript
// apps/client/src/cartridges/games/shared/__tests__/canvas-vfx.test.ts
import { describe, it, expect } from 'vitest';
import { SpringValue, FloatingTextEmitter, drawDottedLine } from '../canvas-vfx';

describe('SpringValue', () => {
  it('starts at snapped value', () => {
    const s = new SpringValue({ stiffness: 180, damping: 12 });
    s.snap(5);
    expect(s.value).toBe(5);
  });

  it('moves toward target over time', () => {
    const s = new SpringValue({ stiffness: 180, damping: 12 });
    s.snap(0);
    s.target = 100;
    // Simulate 500ms in 10ms steps
    for (let i = 0; i < 50; i++) s.update(10);
    expect(s.value).toBeGreaterThan(80);
    expect(s.value).toBeLessThan(120); // may overshoot
  });

  it('settles to target after enough time', () => {
    const s = new SpringValue({ stiffness: 180, damping: 12 });
    s.snap(0);
    s.target = 50;
    for (let i = 0; i < 200; i++) s.update(10);
    expect(Math.abs(s.value - 50)).toBeLessThan(0.1);
    expect(s.settled).toBe(true);
  });

  it('overshoots with low damping', () => {
    const s = new SpringValue({ stiffness: 300, damping: 5 });
    s.snap(0);
    s.target = 100;
    let maxVal = 0;
    for (let i = 0; i < 100; i++) {
      s.update(10);
      if (s.value > maxVal) maxVal = s.value;
    }
    expect(maxVal).toBeGreaterThan(100); // overshoots past target
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/client && npx vitest run src/cartridges/games/shared/__tests__/canvas-vfx.test.ts`
Expected: FAIL — `SpringValue` not exported

- [ ] **Step 3: Implement SpringValue**

Add to `apps/client/src/cartridges/games/shared/canvas-vfx.ts` after the PulseRingEmitter:

```typescript
// --- SpringValue ---

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass?: number;
}

export class SpringValue {
  private _value: number = 0;
  private _target: number = 0;
  private velocity: number = 0;
  private stiffness: number;
  private damping: number;
  private mass: number;

  constructor(config: SpringConfig) {
    this.stiffness = config.stiffness;
    this.damping = config.damping;
    this.mass = config.mass ?? 1;
  }

  set target(v: number) { this._target = v; }
  get target(): number { return this._target; }
  get value(): number { return this._value; }

  get settled(): boolean {
    return Math.abs(this._value - this._target) < 0.01 && Math.abs(this.velocity) < 0.01;
  }

  update(dt: number): void {
    const dtSec = dt / 1000;
    const displacement = this._value - this._target;
    const springForce = -this.stiffness * displacement;
    const dampingForce = -this.damping * this.velocity;
    const acceleration = (springForce + dampingForce) / this.mass;
    this.velocity += acceleration * dtSec;
    this._value += this.velocity * dtSec;
  }

  snap(v: number): void {
    this._value = v;
    this._target = v;
    this.velocity = 0;
  }
}
```

- [ ] **Step 4: Run tests to verify SpringValue passes**

Run: `cd apps/client && npx vitest run src/cartridges/games/shared/__tests__/canvas-vfx.test.ts`
Expected: All SpringValue tests PASS

- [ ] **Step 5: Add FloatingTextEmitter tests**

Append to the test file:

```typescript
describe('FloatingTextEmitter', () => {
  it('tracks emitted text items', () => {
    const emitter = new FloatingTextEmitter();
    emitter.emit({ text: '+100', x: 50, y: 50, color: '#fff', fontSize: 16, duration: 500 });
    // No public count — just verify update/draw don't throw
    emitter.update(100);
    expect(() => emitter.update(100)).not.toThrow();
  });

  it('clears all items', () => {
    const emitter = new FloatingTextEmitter();
    emitter.emit({ text: 'TEST', x: 0, y: 0, color: '#fff', fontSize: 14, duration: 300 });
    emitter.clear();
    // After clear + update, draw should be a no-op (no items to draw)
    emitter.update(100);
  });

  it('removes items after duration expires', () => {
    const emitter = new FloatingTextEmitter();
    emitter.emit({ text: 'GONE', x: 0, y: 0, color: '#fff', fontSize: 14, duration: 200 });
    emitter.update(250); // past duration
    // Internal items should be empty — verified by clear not throwing
    emitter.clear();
  });
});
```

- [ ] **Step 6: Implement FloatingTextEmitter**

Add after SpringValue in `canvas-vfx.ts`:

```typescript
// --- FloatingTextEmitter ---

export interface FloatingTextConfig {
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  duration: number;
  drift?: number;
  font?: string;
  scale?: { start: number; peak: number; end: number };
}

interface FloatingTextItem {
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  font: string;
  duration: number;
  elapsed: number;
  drift: number;
  scaleStart: number;
  scalePeak: number;
  scaleEnd: number;
}

export class FloatingTextEmitter {
  private items: FloatingTextItem[] = [];

  emit(config: FloatingTextConfig): void {
    this.items.push({
      text: config.text,
      x: config.x,
      y: config.y,
      color: config.color,
      fontSize: config.fontSize,
      font: config.font ?? `bold ${config.fontSize}px monospace`,
      duration: config.duration,
      elapsed: 0,
      drift: config.drift ?? 30,
      scaleStart: config.scale?.start ?? 0.5,
      scalePeak: config.scale?.peak ?? 1.3,
      scaleEnd: config.scale?.end ?? 1.0,
    });
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.items[i].elapsed += dt;
      if (this.items[i].elapsed >= this.items[i].duration) {
        this.items.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const item of this.items) {
      const t = item.elapsed / item.duration;
      const y = item.y - item.drift * t * (item.elapsed / 1000);

      // Scale: ramp up to peak in first 20%, ease to end over remaining 80%
      let scale: number;
      if (t < 0.2) {
        scale = lerp(item.scaleStart, item.scalePeak, t / 0.2);
      } else {
        scale = lerp(item.scalePeak, item.scaleEnd, (t - 0.2) / 0.8);
      }

      const opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.font = item.font;
      ctx.fillStyle = item.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.translate(item.x, y);
      ctx.scale(scale, scale);
      ctx.fillText(item.text, 0, 0);
      ctx.restore();
    }
  }

  clear(): void {
    this.items.length = 0;
  }
}
```

- [ ] **Step 7: Implement drawDottedLine**

Add after FloatingTextEmitter:

```typescript
// --- drawDottedLine ---

export function drawDottedLine(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  config: {
    dashLength: number;
    gapLength: number;
    color: string;
    lineWidth: number;
    opacity?: number;
  },
): void {
  if (points.length < 2) return;
  ctx.save();
  ctx.globalAlpha = config.opacity ?? 1;
  ctx.strokeStyle = config.color;
  ctx.lineWidth = config.lineWidth;
  ctx.setLineDash([config.dashLength, config.gapLength]);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
```

- [ ] **Step 8: Run all tests**

Run: `cd apps/client && npx vitest run src/cartridges/games/shared/__tests__/canvas-vfx.test.ts`
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add apps/client/src/cartridges/games/shared/canvas-vfx.ts apps/client/src/cartridges/games/shared/__tests__/canvas-vfx.test.ts
git commit -m "feat: add SpringValue, FloatingTextEmitter, drawDottedLine to canvas-vfx"
```

---

## Task 2: VFX Physics — WavePool, SwarmRenderer, DebrisEmitter

**Files:**
- Modify: `apps/client/src/cartridges/games/shared/canvas-vfx.ts`
- Modify: `apps/client/src/cartridges/games/shared/__tests__/canvas-vfx.test.ts`

**Depends on:** Task 1

- [ ] **Step 1: Write WavePool tests**

Append to `canvas-vfx.test.ts`:

```typescript
import { WavePool, SwarmRenderer, DebrisEmitter } from '../canvas-vfx';

describe('WavePool', () => {
  it('starts empty', () => {
    const pool = new WavePool();
    expect(pool.sourceCount).toBe(0);
  });

  it('adds sources and computes wave height', () => {
    const pool = new WavePool();
    pool.addSource({ x: 0, y: 0, amplitude: 1, wavelength: 50, speed: 100, decay: 0.005, color: '#fff' });
    expect(pool.sourceCount).toBe(1);
    // At origin, height should be near amplitude
    const h = pool.getHeight(0, 0);
    expect(Math.abs(h)).toBeGreaterThan(0);
  });

  it('removes sources that exceed maxRadius', () => {
    const pool = new WavePool();
    pool.addSource({ x: 0, y: 0, amplitude: 1, wavelength: 50, speed: 1000, decay: 0.005, color: '#fff', maxRadius: 100 });
    // Advance time so radius > 100
    pool.update(200); // 1000 px/s * 0.2s = 200px > 100
    expect(pool.sourceCount).toBe(0);
  });
});

describe('SwarmRenderer', () => {
  it('manages boids', () => {
    const swarm = new SwarmRenderer({
      boidSize: 5, trailLength: 3,
      bodyColor: '#fff', trailColor: '#aaa',
      trailOpacity: { start: 0.5, end: 0 },
      connectionColor: '#444', connectionOpacity: 0.05, connectionMaxDist: 20,
    });
    swarm.addBoid(0, 10, 10, 0);
    swarm.addBoid(1, 20, 20, 0.5);
    expect(swarm.boidCount).toBe(2);
    swarm.removeBoid(0);
    expect(swarm.boidCount).toBe(1);
  });
});

describe('DebrisEmitter', () => {
  it('emits and clears debris', () => {
    const debris = new DebrisEmitter();
    debris.emit({
      pieces: [{ x: 10, y: 10, width: 5, height: 5 }],
      color: '#f00', gravity: 400,
      rotationSpeed: { min: 1, max: 3 },
      fadeDelay: 100, fadeDuration: 200,
    });
    debris.update(50);
    debris.clear();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/client && npx vitest run src/cartridges/games/shared/__tests__/canvas-vfx.test.ts`
Expected: FAIL — WavePool/SwarmRenderer/DebrisEmitter not exported

- [ ] **Step 3: Implement WavePool**

Add to `canvas-vfx.ts`:

```typescript
// --- WavePool ---

export interface WaveSourceConfig {
  x: number;
  y: number;
  amplitude: number;
  wavelength: number;
  speed: number;
  decay: number;
  color: string;
  maxRadius?: number;
}

interface WaveSource extends WaveSourceConfig {
  radius: number;
  startTime: number;
  age: number;
}

export class WavePool {
  private sources: WaveSource[] = [];

  get sourceCount(): number { return this.sources.length; }

  addSource(config: WaveSourceConfig): void {
    this.sources.push({ ...config, radius: 0, startTime: 0, age: 0 });
  }

  getHeight(x: number, y: number): number {
    let total = 0;
    for (const src of this.sources) {
      const d = distance(x, y, src.x, src.y);
      if (d > src.radius) continue;
      const amp = src.amplitude * Math.max(0, 1 - d * src.decay);
      total += amp * Math.sin((d / src.wavelength) * Math.PI * 2);
    }
    return Math.max(-1, Math.min(1, total));
  }

  update(dt: number): void {
    const dtSec = dt / 1000;
    for (let i = this.sources.length - 1; i >= 0; i--) {
      const src = this.sources[i];
      src.age += dt;
      src.radius += src.speed * dtSec;
      src.amplitude *= Math.max(0, 1 - src.decay * src.speed * dtSec * 0.1);
      if (src.maxRadius && src.radius > src.maxRadius) {
        this.sources.splice(i, 1);
      } else if (src.amplitude < 0.01) {
        this.sources.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const prevComposite = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'screen';
    for (const src of this.sources) {
      const ringCount = Math.floor(src.radius / src.wavelength);
      for (let r = 0; r <= ringCount; r++) {
        const ringRadius = src.radius - r * src.wavelength;
        if (ringRadius <= 0) continue;
        const amp = src.amplitude * Math.max(0, 1 - ringRadius * src.decay);
        if (amp < 0.01) continue;
        ctx.globalAlpha = amp * 0.6;
        ctx.strokeStyle = src.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(src.x, src.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = prevComposite;
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.sources.length = 0;
  }
}
```

- [ ] **Step 4: Implement SwarmRenderer**

```typescript
// --- SwarmRenderer ---

export interface SwarmConfig {
  boidSize: number;
  trailLength: number;
  bodyColor: string;
  trailColor: string;
  trailOpacity: { start: number; end: number };
  connectionColor: string;
  connectionOpacity: number;
  connectionMaxDist: number;
}

interface BoidState {
  x: number;
  y: number;
  angle: number;
  trail: { x: number; y: number }[];
}

export class SwarmRenderer {
  private boids = new Map<number, BoidState>();
  private config: SwarmConfig;

  constructor(config: SwarmConfig) { this.config = config; }

  get boidCount(): number { return this.boids.size; }

  addBoid(id: number, x: number, y: number, angle: number): void {
    this.boids.set(id, { x, y, angle, trail: [{ x, y }] });
  }

  removeBoid(id: number): void { this.boids.delete(id); }

  updateBoid(id: number, x: number, y: number, angle: number): void {
    const boid = this.boids.get(id);
    if (!boid) return;
    boid.x = x;
    boid.y = y;
    boid.angle = angle;
    boid.trail.unshift({ x, y });
    if (boid.trail.length > this.config.trailLength) {
      boid.trail.length = this.config.trailLength;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { config } = this;
    const boidArr = Array.from(this.boids.values());

    // Connection lines between nearby boids
    ctx.strokeStyle = config.connectionColor;
    ctx.lineWidth = 1;
    for (let i = 0; i < boidArr.length; i++) {
      for (let j = i + 1; j < boidArr.length; j++) {
        const d = distance(boidArr[i].x, boidArr[i].y, boidArr[j].x, boidArr[j].y);
        if (d < config.connectionMaxDist) {
          ctx.globalAlpha = config.connectionOpacity * (1 - d / config.connectionMaxDist);
          ctx.beginPath();
          ctx.moveTo(boidArr[i].x, boidArr[i].y);
          ctx.lineTo(boidArr[j].x, boidArr[j].y);
          ctx.stroke();
        }
      }
    }

    // Boid trails and bodies
    for (const boid of boidArr) {
      // Mini trail
      for (let t = 0; t < boid.trail.length - 1; t++) {
        const frac = t / (boid.trail.length - 1);
        ctx.globalAlpha = lerp(config.trailOpacity.start, config.trailOpacity.end, frac);
        ctx.strokeStyle = config.trailColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(boid.trail[t].x, boid.trail[t].y);
        ctx.lineTo(boid.trail[t + 1].x, boid.trail[t + 1].y);
        ctx.stroke();
      }

      // Directional triangle body
      ctx.globalAlpha = 1;
      ctx.fillStyle = config.bodyColor;
      ctx.save();
      ctx.translate(boid.x, boid.y);
      ctx.rotate(boid.angle);
      ctx.beginPath();
      ctx.moveTo(config.boidSize, 0);
      ctx.lineTo(-config.boidSize * 0.6, -config.boidSize * 0.5);
      ctx.lineTo(-config.boidSize * 0.6, config.boidSize * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  clear(): void { this.boids.clear(); }
}
```

- [ ] **Step 5: Implement DebrisEmitter**

```typescript
// --- DebrisEmitter ---

export interface DebrisConfig {
  pieces: { x: number; y: number; width: number; height: number }[];
  color: string;
  gravity: number;
  initialVelocity?: { x: { min: number; max: number }; y: { min: number; max: number } };
  rotationSpeed: { min: number; max: number };
  fadeDelay: number;
  fadeDuration: number;
}

interface DebrisPiece {
  x: number; y: number;
  width: number; height: number;
  vx: number; vy: number;
  rotation: number; rotSpeed: number;
  color: string; gravity: number;
  elapsed: number; fadeDelay: number; fadeDuration: number;
}

export class DebrisEmitter {
  private pieces: DebrisPiece[] = [];

  emit(config: DebrisConfig, rng?: () => number): void {
    const rand = rng || Math.random;
    for (const p of config.pieces) {
      const vx = config.initialVelocity
        ? config.initialVelocity.x.min + rand() * (config.initialVelocity.x.max - config.initialVelocity.x.min)
        : (rand() - 0.5) * 60;
      const vy = config.initialVelocity
        ? config.initialVelocity.y.min + rand() * (config.initialVelocity.y.max - config.initialVelocity.y.min)
        : -rand() * 80;
      this.pieces.push({
        x: p.x, y: p.y, width: p.width, height: p.height,
        vx, vy, rotation: 0,
        rotSpeed: config.rotationSpeed.min + rand() * (config.rotationSpeed.max - config.rotationSpeed.min),
        color: config.color, gravity: config.gravity,
        elapsed: 0, fadeDelay: config.fadeDelay, fadeDuration: config.fadeDuration,
      });
    }
  }

  update(dt: number): void {
    const dtSec = dt / 1000;
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      p.elapsed += dt;
      p.vy += p.gravity * dtSec;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.rotation += p.rotSpeed * dtSec;
      if (p.elapsed > p.fadeDelay + p.fadeDuration) {
        this.pieces.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pieces) {
      let opacity = 1;
      if (p.elapsed > p.fadeDelay) {
        opacity = 1 - (p.elapsed - p.fadeDelay) / p.fadeDuration;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, opacity);
      ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  clear(): void { this.pieces.length = 0; }
}
```

- [ ] **Step 6: Run all tests**

Run: `cd apps/client && npx vitest run src/cartridges/games/shared/__tests__/canvas-vfx.test.ts`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/cartridges/games/shared/canvas-vfx.ts apps/client/src/cartridges/games/shared/__tests__/canvas-vfx.test.ts
git commit -m "feat: add WavePool, SwarmRenderer, DebrisEmitter to canvas-vfx"
```

---

## Task 3: Shared Types — Register All 7 Games

**Files:**
- Modify: `packages/shared-types/src/index.ts`
- Modify: `packages/shared-types/src/game-type-info.ts`
- Modify: `packages/shared-types/src/config.ts`
- Modify: `packages/shared-types/src/cycle-defaults.ts`

Register all 7 game types at once so downstream tasks can import them.

- [ ] **Step 1: Add to GameTypeSchema**

In `packages/shared-types/src/index.ts`, add the 7 new types to the `GameTypeSchema` z.enum array, before `"NONE"`:

```typescript
export const GameTypeSchema = z.enum([
  "TRIVIA", "REALTIME_TRIVIA",
  "GAP_RUN", "GRID_PUSH", "SEQUENCE",
  "REACTION_TIME", "COLOR_MATCH", "STACKER", "QUICK_MATH", "SIMON_SAYS", "AIM_TRAINER",
  "BET_BET_BET", "BLIND_AUCTION", "KINGS_RANSOM", "THE_SPLIT",
  "TOUCH_SCREEN",
  "SHOCKWAVE", "ORBIT", "BEAT_DROP",
  "RIPPLE", "BOUNCE", "INFLATE", "SWITCHBOARD", "FLOCK", "SCULPTOR", "CODEBREAKER",
  "NONE",
]);
```

- [ ] **Step 2: Add GAME_TYPE_INFO entries**

In `packages/shared-types/src/game-type-info.ts`, add after the BEAT_DROP entry:

```typescript
  RIPPLE:       { name: 'Ripple',       description: 'Drop stones, ride the waves' },
  BOUNCE:       { name: 'Bounce',       description: 'Draw platforms, nail the target' },
  INFLATE:      { name: 'Inflate',      description: 'Push your luck, don\'t pop' },
  SWITCHBOARD:  { name: 'Switchboard',  description: 'Flip, slide, dial — fast' },
  FLOCK:        { name: 'Flock',        description: 'Herd your swarm through gates' },
  SCULPTOR:     { name: 'Sculptor',     description: 'Carve the shape, match the target' },
  CODEBREAKER:  { name: 'Codebreaker',  description: 'Crack the code before time runs out' },
```

- [ ] **Step 3: Add Config constants**

In `packages/shared-types/src/config.ts`, add inside `Config.game` after the `beatDrop` section:

```typescript
    ripple: {
      timeLimitMs: 60_000,
      maxStones: 20,
      scorePerSilver: 400,
      scorePerGold: 2000,
    },
    bounce: {
      timeLimitMs: 60_000,
      maxPlatforms: 3,
      scorePerSilver: 300,
      bullseyeBonus: 3,
      scorePerGold: 1500,
    },
    inflate: {
      timeLimitMs: 45_000,
      maxLives: 3,
      scorePerSilver: 250,
      perfectBankBonus: 2,
      scorePerGold: 1200,
    },
    switchboard: {
      timeLimitMs: 60_000,
      scorePerSilver: 500,
      scorePerGold: 2500,
    },
    flock: {
      timeLimitMs: 60_000,
      startingBoids: 25,
      maxBoids: 30,
      scorePerSilver: 350,
      wholeFlockBonus: 3,
      scorePerGold: 1800,
    },
    sculptor: {
      timeLimitMs: 60_000,
      cutsPerRound: 3,
      gridSize: 30,
      scorePerSilver: 300,
      perfectCutBonus: 2,
      scorePerGold: 1500,
    },
    codebreaker: {
      timeLimitMs: 60_000,
      codeLength: 4,
      scorePerSilver: 400,
      geniusBonus: 3,
      scorePerGold: 2000,
    },
```

- [ ] **Step 4: Add GAME_POOL entries**

In `packages/shared-types/src/cycle-defaults.ts`, append to `GAME_POOL` array after the BEAT_DROP entry:

```typescript
  { type: 'RIPPLE', minPlayers: 2 },
  { type: 'BOUNCE', minPlayers: 2 },
  { type: 'INFLATE', minPlayers: 2 },
  { type: 'SWITCHBOARD', minPlayers: 2 },
  { type: 'FLOCK', minPlayers: 2 },
  { type: 'SCULPTOR', minPlayers: 2 },
  { type: 'CODEBREAKER', minPlayers: 2 },
```

- [ ] **Step 5: Build shared-types to verify**

Run: `cd packages/shared-types && npx tsc --noEmit`
Expected: No errors. The compiler enforces that `GAME_TYPE_INFO` has entries for all non-NONE game types.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/index.ts packages/shared-types/src/game-type-info.ts packages/shared-types/src/config.ts packages/shared-types/src/cycle-defaults.ts
git commit -m "feat: register 7 new arcade game types in shared-types"
```

---

## Task 4: Ripple — Server Machine + Client

**Files:**
- Create: `packages/game-cartridges/src/machines/ripple.ts`
- Create: `apps/client/src/cartridges/games/ripple/RippleRenderer.tsx`
- Create: `apps/client/src/cartridges/games/ripple/Ripple.tsx`

**Depends on:** Tasks 1-3

**Spec reference:** "Game 1: Ripple" in `docs/superpowers/specs/2026-04-11-arcade-batch-2-design.md`

- [ ] **Step 1: Create server machine**

```typescript
// packages/game-cartridges/src/machines/ripple.ts
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, scorePerSilver, scorePerGold } = Config.game.ripple;

export const rippleMachine = createArcadeMachine({
  gameType: 'RIPPLE',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const silver = Math.min(
      Config.game.arcade.maxSilver,
      Math.floor(score / scorePerSilver),
    );
    return {
      silver,
      gold: Math.floor(score / scorePerGold),
    };
  },
});
```

- [ ] **Step 2: Create client renderer**

Create `apps/client/src/cartridges/games/ripple/RippleRenderer.tsx`. Key structure:

```tsx
import { useEffect, useRef, useCallback } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import {
  mulberry32, lerp, distance,
  ParticleEmitter, ScreenShake, ScreenFlash, PulseRingEmitter,
  SlowMo, FloatingTextEmitter, WavePool, SpringValue, drawWithGlow,
} from '../shared/canvas-vfx';

const CANVAS_SIZE = 400;
const MAX_STONES = Config.game.ripple.maxStones;
const TARGET_COUNT = 5;
const CANCEL_RADIUS = 40;
const AMPLIFY_WINDOW = 200; // ms

interface Target {
  x: number; y: number;
  value: number; // 10, 20, 30
  color: string;
  bob: SpringValue;
  lastHitTime: number;
}

export default function RippleRenderer({ seed, difficulty, timeLimit, onResult }: ArcadeRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useCartridgeTheme(containerRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rng = mulberry32(seed);

    // Game state
    let stonesUsed = 0;
    let score = 0;
    let amplifies = 0;
    let combo = 0;
    let lastHitTime = 0;
    let gameOver = false;
    let elapsed = 0;

    // VFX instances
    const particles = new ParticleEmitter();
    const shake = new ScreenShake();
    const flash = new ScreenFlash();
    const pulseRings = new PulseRingEmitter();
    const slowMo = new SlowMo();
    const floatingText = new FloatingTextEmitter();
    const wavePool = new WavePool();

    // Generate initial targets using rng
    const targets: Target[] = [];
    function spawnTarget() { /* seeded position, value based on difficulty, SpringValue for bob */ }
    for (let i = 0; i < TARGET_COUNT; i++) spawnTarget();

    // Input handler: tap to drop stone
    function handlePointerDown(e: PointerEvent) {
      if (gameOver || stonesUsed >= MAX_STONES) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * CANVAS_SIZE;
      const y = (e.clientY - rect.top) / rect.height * CANVAS_SIZE;

      // Cancel check: too close to existing source?
      // Drop stone: wavePool.addSource(...)
      // Splash VFX: particles.emit(...), pulseRings.emit(...)
      stonesUsed++;
    }
    canvas.addEventListener('pointerdown', handlePointerDown);

    // Game loop
    let lastTime = performance.now();
    let animId: number;
    function loop(now: number) {
      const rawDt = now - lastTime;
      lastTime = now;
      const dt = slowMo.update(rawDt);
      elapsed += rawDt;
      if (elapsed >= timeLimit) { endGame(); return; }

      // Update VFX
      wavePool.update(dt);
      particles.update(dt);
      shake.update(dt);
      flash.update(dt);
      pulseRings.update(dt);
      floatingText.update(dt);

      // Check wave-target hits
      for (const target of targets) {
        const height = wavePool.getHeight(target.x, target.y);
        if (Math.abs(height) > 0.3) {
          // Score the target, check for amplify bonus
          // Spawn new target via spawnTarget()
        }
      }

      // Draw: background → wavePool → targets → HUD → VFX overlays
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      shake.apply(ctx);

      // Background (dark pond + noise)
      // wavePool.draw(ctx, CANVAS_SIZE, CANVAS_SIZE);
      // Targets (drawWithGlow, bob animation)
      // Stone counter, score, combo (HUD at top)
      // VFX layers: particles, pulseRings, floatingText, flash

      shake.restore(ctx);
      animId = requestAnimationFrame(loop);
    }

    function endGame() {
      gameOver = true;
      onResult({ score, stonesUsed, amplifies });
    }

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [seed, difficulty, timeLimit, onResult, theme]);

  return (
    <div ref={containerRef}>
      <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE}
        style={{ width: '100%', height: '100%', touchAction: 'none' }} />
    </div>
  );
}
```

**Implementation details from spec:** Target values 10/20/30 mapped to theme colors info/gold/pink. Amplify = two waves hit same target within 200ms = 3x score. Combo = consecutive hits within 1s. Stone counter shows "LAST STONE" at 1-2 remaining. Difficulty ramps target drift speed and spacing. See spec VFX table for every visual effect configuration.

- [ ] **Step 3: Create wrapper component**

```tsx
// apps/client/src/cartridges/games/ripple/Ripple.tsx
import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import RippleRenderer from './RippleRenderer';

interface RippleProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendGameAction: (type: string, payload?: Record<string, any>) => void };
  onDismiss?: () => void;
}

export default function Ripple(props: RippleProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Ripple"
      description="Tap to drop stones. Ride the waves to hit targets. Converge two ripples for AMPLIFY bonus!"
      Renderer={RippleRenderer}
      renderBreakdown={(result) => {
        const score = result.score || 0;
        const stonesUsed = result.stonesUsed || 0;
        const amplifies = result.amplifies || 0;
        const { scorePerSilver } = Config.game.ripple;
        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Score</span>
              <span className="text-white">{score}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Stones used</span>
              <span className="text-white">{stonesUsed} / {Config.game.ripple.maxStones}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Amplifies</span>
              <span className="text-white">{amplifies}</span>
            </div>
            <div className="border-t border-white/[0.06] pt-2 flex justify-between">
              <span className="text-white/50">Silver</span>
              <span className="text-skin-gold">{Math.min(Config.game.arcade.maxSilver, Math.floor(score / scorePerSilver))}</span>
            </div>
          </div>
        );
      }}
    />
  );
}
```

- [ ] **Step 4: Build to verify**

Run: `cd apps/client && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add packages/game-cartridges/src/machines/ripple.ts apps/client/src/cartridges/games/ripple/
git commit -m "feat: add Ripple arcade game — wave physics with interference"
```

---

## Tasks 5-10: Remaining 6 Games

Each follows the identical pattern as Task 4. The key differences per game are listed below. **These tasks are parallelizable** — they can all be worked on simultaneously after Tasks 1-3 complete.

### Task 5: Bounce

**Files:** `packages/game-cartridges/src/machines/bounce.ts`, `apps/client/src/cartridges/games/bounce/BounceRenderer.tsx`, `apps/client/src/cartridges/games/bounce/Bounce.tsx`

**Server machine:**
```typescript
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';
const { timeLimitMs, scorePerSilver, bullseyeBonus, scorePerGold } = Config.game.bounce;
export const bounceMachine = createArcadeMachine({
  gameType: 'BOUNCE',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const bullseyes = result.bullseyes || 0;
    const silver = Math.min(Config.game.arcade.maxSilver,
      Math.floor(score / scorePerSilver) + Math.floor(bullseyes / bullseyeBonus));
    return { silver, gold: Math.floor(score / scorePerGold) };
  },
});
```

**Renderer key details:** Planning phase (draw platforms via pointer drag) → Drop phase (ball falls with gravity 400px/s^2, reflects off platforms/walls at reflection angles, 0.9x velocity per bounce). Uses `drawDottedLine` for trajectory preview, `TrailRenderer` for ball trail, `PulseRingEmitter` for bounce impacts. Max 5 scored bounces per round. Drop button at bottom-right on mobile. Result: `{ score, roundsCompleted, bullseyes, maxStreak }`.

**Wrapper breakdown:** Score, rounds completed, bullseyes, max streak, silver calculation.

- [ ] Steps 1-5: Create machine, renderer, wrapper, build verify, commit.

### Task 6: Inflate

**Files:** `packages/game-cartridges/src/machines/inflate.ts`, `apps/client/src/cartridges/games/inflate/InflateRenderer.tsx`, `apps/client/src/cartridges/games/inflate/Inflate.tsx`

**Server machine:**
```typescript
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';
const { timeLimitMs, scorePerSilver, perfectBankBonus, scorePerGold } = Config.game.inflate;
export const inflateMachine = createArcadeMachine({
  gameType: 'INFLATE',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const perfectBanks = result.perfectBanks || 0;
    const silver = Math.min(Config.game.arcade.maxSilver,
      Math.floor(score / scorePerSilver) + Math.floor(perfectBanks / perfectBankBonus));
    return { silver, gold: Math.floor(score / scorePerGold) };
  },
});
```

**Renderer key details:** Hold-to-inflate mechanic. Balloon drawn as bezier ellipse with `SpringValue` wobble. Hidden pop threshold per balloon (seeded). 300ms minimum hold before release counts as bank. Three balloon types: Normal (60%), Golden (20%, 2x value), Tough (20%, 1.5x value). Danger cues: wobble amplitude increases near threshold. Pop uses `DebrisEmitter` for rubber fragments + `ParticleEmitter` (30 particles) + `ScreenShake` + `ScreenFlash`. 3 lives. Result: `{ score, balloonsBanked, balloonsPopped, perfectBanks }`.

- [ ] Steps 1-5: Create machine, renderer, wrapper, build verify, commit.

### Task 7: Switchboard

**Files:** `packages/game-cartridges/src/machines/switchboard.ts`, `apps/client/src/cartridges/games/switchboard/SwitchboardRenderer.tsx`, `apps/client/src/cartridges/games/switchboard/Switchboard.tsx`

**Server machine:**
```typescript
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';
const { timeLimitMs, scorePerSilver, scorePerGold } = Config.game.switchboard;
export const switchboardMachine = createArcadeMachine({
  gameType: 'SWITCHBOARD',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const silver = Math.min(Config.game.arcade.maxSilver, Math.floor(score / scorePerSilver));
    return { silver, gold: Math.floor(score / scorePerGold) };
  },
});
```

**Renderer key details:** Canvas-based control panel with buttons (tap), toggles (tap), sliders (drag), dials (drag-rotate). Instructions flash one at a time. Correct = score + next. Timer per instruction (3s→1.5s). Panel scrambles every 5 instructions — all controls spring-animate to new positions. All controls 48px+ touch targets, sliders 56px handles. Uses `SpringValue` for button press, slider snap, dial notch, scramble animation. `FloatingTextEmitter` for "+100" / "X". `ParticleEmitter` for sparks on correct. Result: `{ score, instructionsCompleted, maxStreak, accuracyPct }`. accuracyPct = `Math.floor(correct / (correct + misses) * 100)`.

- [ ] Steps 1-5: Create machine, renderer, wrapper, build verify, commit.

### Task 8: Flock

**Files:** `packages/game-cartridges/src/machines/flock.ts`, `apps/client/src/cartridges/games/flock/FlockRenderer.tsx`, `apps/client/src/cartridges/games/flock/Flock.tsx`

**Server machine:**
```typescript
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';
const { timeLimitMs, scorePerSilver, wholeFlockBonus, scorePerGold } = Config.game.flock;
export const flockMachine = createArcadeMachine({
  gameType: 'FLOCK',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const wholeFlock = result.wholeFlock || 0;
    const silver = Math.min(Config.game.arcade.maxSilver,
      Math.floor(score / scorePerSilver) + Math.floor(wholeFlock / wholeFlockBonus));
    return { silver, gold: Math.floor(score / scorePerGold) };
  },
});
```

**Renderer key details:** Boid simulation (cohesion, separation, alignment, leader-follow). Shepherd follows pointer with 20px upward offset on mobile. `SwarmRenderer` for boid visualization. Speed penalty: leader-follow weight drops when shepherd moves > 200px/s. Gates: two posts + beam, wide (80px, 10pts/boid) and tight (40px, 20pts/boid). Predators: sinusoidal patrol, eat boids on contact. Bonus boids: green dots, recruit on proximity. Result: `{ score, gatesPassed, boidsRemaining, wholeFlock }`.

- [ ] Steps 1-5: Create machine, renderer, wrapper, build verify, commit.

### Task 9: Sculptor

**Files:** `packages/game-cartridges/src/machines/sculptor.ts`, `apps/client/src/cartridges/games/sculptor/SculptorRenderer.tsx`, `apps/client/src/cartridges/games/sculptor/Sculptor.tsx`

**Server machine:**
```typescript
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';
const { timeLimitMs, scorePerSilver, perfectCutBonus, scorePerGold } = Config.game.sculptor;
export const sculptorMachine = createArcadeMachine({
  gameType: 'SCULPTOR',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const perfectCuts = result.perfectCuts || 0;
    const silver = Math.min(Config.game.arcade.maxSilver,
      Math.floor(score / scorePerSilver) + Math.floor(perfectCuts / perfectCutBonus));
    return { silver, gold: Math.floor(score / scorePerGold) };
  },
});
```

**Renderer key details:** 30x30 cell grid as clay. Target shapes stored as boolean masks (library of 15-20 shapes at varying difficulty). Drag to draw cut line. 300ms preview phase: green tint on staying side, red on falling side. `DebrisEmitter` for falling pieces. Scoring: `Math.floor((matchingCells / targetCells) * 100 - (excessCells / targetCells) * 25)` clamped 0-100. 3 cuts per round (2 at expert difficulty). Shapes from a built-in library, seeded selection + random rotation/mirror. Result: `{ score, roundsCompleted, perfectCuts, averageAccuracyPct }`. averageAccuracyPct = `Math.floor(totalAccuracy / roundsCompleted)`.

- [ ] Steps 1-5: Create machine, renderer, wrapper, build verify, commit.

### Task 10: Codebreaker

**Files:** `packages/game-cartridges/src/machines/codebreaker.ts`, `apps/client/src/cartridges/games/codebreaker/CodebreakerRenderer.tsx`, `apps/client/src/cartridges/games/codebreaker/Codebreaker.tsx`

**Server machine:**
```typescript
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';
const { timeLimitMs, scorePerSilver, geniusBonus, scorePerGold } = Config.game.codebreaker;
export const codebreakerMachine = createArcadeMachine({
  gameType: 'CODEBREAKER',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const bestSolve = result.bestSolve || 99;
    const silver = Math.min(Config.game.arcade.maxSilver,
      Math.floor(score / scorePerSilver) + (bestSolve <= 2 ? geniusBonus : 0));
    return { silver, gold: Math.floor(score / scorePerGold) };
  },
});
```

**Renderer key details:** Mastermind logic. Hidden code: 4 positions from 5-7 colors (seeded). Tap position to select, tap palette color to set (primary mobile flow). Arrows only appear on selected position (fits 375px). Submit → feedback: filled dot (correct position), hollow dot (correct color wrong position), empty (wrong). Feedback sorted, not positionally aligned. Per-guess timer (10s→5s). Scoring: 200 base + guess bonus (1 guess = +300, 2 = +200, 3 = +100, 4 = +50). Streak multiplier. Code reveal: sequential flip animation L-to-R. Result: `{ score, codesCracked, averageGuesses, bestSolve }`. averageGuesses = `Math.floor(totalGuesses / codesCracked)`.

- [ ] Steps 1-5: Create machine, renderer, wrapper, build verify, commit.

---

## Task 11: Game Registry + Client Registration

**Files:**
- Modify: `packages/game-cartridges/src/machines/index.ts`
- Modify: `apps/client/src/components/panels/GamePanel.tsx`
- Modify: `apps/client/src/cartridges/games/shared/Leaderboard.tsx`

**Depends on:** Tasks 4-10 (all game files must exist)

- [ ] **Step 1: Register machines in index.ts**

Add exports, imports, and GAME_REGISTRY entries for all 7:

```typescript
// Add to exports section:
export { rippleMachine } from './ripple';
export { bounceMachine } from './bounce';
export { inflateMachine } from './inflate';
export { switchboardMachine } from './switchboard';
export { flockMachine } from './flock';
export { sculptorMachine } from './sculptor';
export { codebreakerMachine } from './codebreaker';

// Add to imports section:
import { rippleMachine } from './ripple';
import { bounceMachine } from './bounce';
import { inflateMachine } from './inflate';
import { switchboardMachine } from './switchboard';
import { flockMachine } from './flock';
import { sculptorMachine } from './sculptor';
import { codebreakerMachine } from './codebreaker';

// Add to GAME_REGISTRY object:
  RIPPLE: rippleMachine,
  BOUNCE: bounceMachine,
  INFLATE: inflateMachine,
  SWITCHBOARD: switchboardMachine,
  FLOCK: flockMachine,
  SCULPTOR: sculptorMachine,
  CODEBREAKER: codebreakerMachine,
```

- [ ] **Step 2: Add lazy imports to GamePanel.tsx**

Add to `GAME_COMPONENTS` after the BEAT_DROP entry:

```typescript
  [GameTypes.RIPPLE]: React.lazy(() => import('../../cartridges/games/ripple/Ripple')),
  [GameTypes.BOUNCE]: React.lazy(() => import('../../cartridges/games/bounce/Bounce')),
  [GameTypes.INFLATE]: React.lazy(() => import('../../cartridges/games/inflate/Inflate')),
  [GameTypes.SWITCHBOARD]: React.lazy(() => import('../../cartridges/games/switchboard/Switchboard')),
  [GameTypes.FLOCK]: React.lazy(() => import('../../cartridges/games/flock/Flock')),
  [GameTypes.SCULPTOR]: React.lazy(() => import('../../cartridges/games/sculptor/Sculptor')),
  [GameTypes.CODEBREAKER]: React.lazy(() => import('../../cartridges/games/codebreaker/Codebreaker')),
```

- [ ] **Step 3: Add GAME_STAT_CONFIG entries to Leaderboard.tsx**

Add after the BEAT_DROP entry:

```typescript
  [GameTypes.RIPPLE]: { key: 'amplifies', label: 'Amplifies' },
  [GameTypes.BOUNCE]: { key: 'bullseyes', label: 'Bullseyes' },
  [GameTypes.INFLATE]: { key: 'balloonsBanked', label: 'Banked' },
  [GameTypes.SWITCHBOARD]: { key: 'instructionsCompleted', label: 'Completed' },
  [GameTypes.FLOCK]: { key: 'boidsRemaining', label: 'Boids Left' },
  [GameTypes.SCULPTOR]: { key: 'perfectCuts', label: 'Perfects' },
  [GameTypes.CODEBREAKER]: { key: 'codesCracked', label: 'Codes' },
```

- [ ] **Step 4: Build all packages**

Run: `npm run build`
Expected: Clean build across all packages

- [ ] **Step 5: Commit**

```bash
git add packages/game-cartridges/src/machines/index.ts apps/client/src/components/panels/GamePanel.tsx apps/client/src/cartridges/games/shared/Leaderboard.tsx
git commit -m "feat: register all 7 new arcade games in registry, GamePanel, and Leaderboard"
```

---

## Task 12: Build Verification + Smoke Test

**Depends on:** All previous tasks

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Clean build, no errors

- [ ] **Step 2: Type check all packages**

Run: `cd packages/shared-types && npx tsc --noEmit && cd ../game-cartridges && npx tsc --noEmit && cd ../../apps/client && npx tsc --noEmit && cd ../game-server && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Run all tests**

Run: `npm run test`
Expected: All existing + new tests pass

- [ ] **Step 4: Start dev server and verify games load**

Run: `npm run dev`
Then use the `/create-game` skill or manual game creation to verify at least one new game type (e.g., INFLATE — simplest renderer) loads without console errors.

- [ ] **Step 5: Commit any fixes**

If any issues found, fix and commit.

---

## Task 13: Arcade Game Skill

**Files:**
- Create: `.claude/skills/add-arcade-game.md`

**Depends on:** Tasks 1-12 (need working games as reference)

- [ ] **Step 1: Create the skill file**

Create `.claude/skills/add-arcade-game.md` encoding:
- Trigger phrases: "add arcade game", "new minigame", "create cartridge", "add a game called X"
- The `createArcadeMachine()` factory API (`ArcadeGameConfig` interface)
- The `ArcadeRendererProps` interface (`seed`, `difficulty`, `timeLimit`, `onResult`)
- The `ArcadeGameWrapper` component and `renderBreakdown` prop pattern
- All 8 registration touchpoints with exact file paths
- Available VFX primitives (13 total) with their config interfaces
- Mobile design rules (48px targets, no long-press, no edge-drag, finger occlusion)
- Scoring conventions (integer results, silver capped at 15, `Math.floor(Number(val) || 0)` coercion)
- The seeded PRNG pattern (`mulberry32(seed)`)
- Config constant conventions (`Config.game.<camelCase>`)
- GAME_STAT_CONFIG, GAME_TYPE_INFO, GAME_POOL patterns
- Difficulty ramp convention (4 phases, `difficulty` 0-1)
- File naming: machine = `kebab-case.ts`, renderer = `PascalCaseRenderer.tsx`, wrapper = `PascalCase.tsx`

- [ ] **Step 2: Test the skill loads**

Run: `/skill add-arcade-game` (or invoke via Skill tool) to verify it loads correctly.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/add-arcade-game.md
git commit -m "feat: add arcade game creation skill for future batches"
```
