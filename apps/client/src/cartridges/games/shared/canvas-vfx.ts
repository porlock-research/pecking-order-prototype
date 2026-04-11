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
