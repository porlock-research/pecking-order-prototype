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
    this.velocity = 0;
  }
}

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
  age: number;
}

export class WavePool {
  private sources: WaveSource[] = [];

  get sourceCount(): number { return this.sources.length; }

  addSource(config: WaveSourceConfig): void {
    this.sources.push({ ...config, radius: 0, age: 0 });
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

  draw(ctx: CanvasRenderingContext2D, _width: number, _height: number): void {
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
