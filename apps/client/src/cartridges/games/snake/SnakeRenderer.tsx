import { useEffect, useRef } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import {
  mulberry32,
  ParticleEmitter, ScreenShake, ScreenFlash, PulseRingEmitter,
  SlowMo, FloatingTextEmitter, SpringValue, drawWithGlow,
} from '../shared/canvas-vfx';
import { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';

const CANVAS_SIZE = 400;
const SWIPE_THRESHOLD = 16;

// --- Continuous movement ---
const HEAD_RADIUS = 10;
const BODY_WIDTH = 16;
const TRAIL_SPACING = 2; // px between trail samples for smooth body
const MIN_BODY_LEN = 120; // px arc length at start
const BODY_PER_PELLET = 22; // px of body added per pellet
const SELF_COLLISION_SKIP = 60; // skip first N px of body for self-collision

// Speed tiers — px/s
const SPEED_TIERS = [
  { score: 0, speed: 120 },
  { score: 5, speed: 145 },
  { score: 10, speed: 170 },
  { score: 18, speed: 195 },
  { score: 28, speed: 220 },
  { score: 40, speed: 250 },
];

const MILESTONES: { score: number; text: string }[] = [
  { score: 5, text: 'NICE!' },
  { score: 10, text: 'STREAK!' },
  { score: 18, text: 'ON FIRE!' },
  { score: 28, text: 'UNSTOPPABLE!' },
  { score: 40, text: 'LEGENDARY!' },
];

interface Vec { x: number; y: number; }
interface TrailPoint { x: number; y: number; }

export default function SnakeRenderer({ seed, difficulty, timeLimit, onResult }: ArcadeRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useCartridgeTheme(containerRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !theme) return;
    const ctx = canvas.getContext('2d')!;
    const rng = mulberry32(seed);
    const colors = theme.colors;

    // --- Game state ---
    let head: Vec = { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 };
    let dir: Vec = { x: 1, y: 0 };
    let nextDir: Vec = { x: 1, y: 0 };
    let trail: TrailPoint[] = [{ x: head.x, y: head.y }];
    let bodyLen = MIN_BODY_LEN;
    let pellet: Vec = { x: 0, y: 0 };
    let pelletAngle = 0;
    let score = 0;
    let alive = true;
    let gameOver = false;
    let elapsed = 0;
    let speed = SPEED_TIERS[0].speed;
    const milestonesHit = new Set<number>();
    let pelletJustSpawned = 0; // ms timer for entry animation

    // Bouncing obstacles — add challenge as score rises
    interface Obstacle { x: number; y: number; vx: number; vy: number; r: number; spawnTimer: number; }
    const obstacles: Obstacle[] = [];
    const OBSTACLE_RADIUS = 10;

    // --- VFX ---
    const particles = new ParticleEmitter();
    const ambientParticles = new ParticleEmitter(); // constant trail particles
    const shake = new ScreenShake();
    const flash = new ScreenFlash();
    const pulseRings = new PulseRingEmitter();
    const slowMo = new SlowMo();
    const floatingText = new FloatingTextEmitter();
    const pelletScale = new SpringValue({ stiffness: 80, damping: 6 });
    pelletScale.snap(0);
    const scorePulse = new SpringValue({ stiffness: 200, damping: 12 });
    scorePulse.snap(1);

    function spawnPellet() {
      const margin = 30;
      let attempts = 0;
      do {
        pellet = {
          x: margin + rng() * (CANVAS_SIZE - margin * 2),
          y: margin + rng() * (CANVAS_SIZE - margin * 2),
        };
        attempts++;
      } while (distanceToTrail(pellet) < 30 && attempts < 50);
      pelletScale.snap(0);
      pelletScale.target = 1;
      pelletJustSpawned = 300;
    }

    function distanceToTrail(p: Vec): number {
      let min = Infinity;
      for (const t of trail) {
        const d = Math.sqrt((t.x - p.x) ** 2 + (t.y - p.y) ** 2);
        if (d < min) min = d;
      }
      return min;
    }

    spawnPellet();

    function getSpeedTier(): number {
      let t = 0;
      for (let i = 0; i < SPEED_TIERS.length; i++) {
        if (score >= SPEED_TIERS[i].score) t = i;
      }
      return t;
    }

    function setDir(nx: number, ny: number) {
      if (dir.x === -nx && dir.y === -ny) return; // no 180-reverse
      nextDir = { x: nx, y: ny };
    }

    function handleKeydown(e: KeyboardEvent) {
      if (!alive) return;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': setDir(0, -1); break;
        case 'ArrowDown': case 's': case 'S': setDir(0, 1); break;
        case 'ArrowLeft': case 'a': case 'A': setDir(-1, 0); break;
        case 'ArrowRight': case 'd': case 'D': setDir(1, 0); break;
        default: return;
      }
      e.preventDefault();
    }

    let touchStart: { x: number; y: number } | null = null;
    function handlePointerDown(e: PointerEvent) {
      if (!alive) return;
      e.preventDefault();
      touchStart = { x: e.clientX, y: e.clientY };
    }
    function handlePointerMove(e: PointerEvent) {
      if (!touchStart || !alive) return;
      e.preventDefault();
      const dx = e.clientX - touchStart.x;
      const dy = e.clientY - touchStart.y;
      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
      if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
      else setDir(0, dy > 0 ? 1 : -1);
      touchStart = { x: e.clientX, y: e.clientY };
    }
    function handlePointerUp() { touchStart = null; }

    document.addEventListener('keydown', handleKeydown);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);

    function triggerMilestone(text: string) {
      slowMo.trigger(0.5, 200);
      flash.trigger(withAlpha(colors.gold, 0.25), 120);
      shake.trigger({ intensity: 6, duration: 220 });
      floatingText.emit({
        text,
        x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2,
        color: colors.gold, fontSize: 28, duration: 1000,
      });
      particles.emit({
        count: 35,
        position: { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 },
        velocity: { min: 100, max: 250 },
        angle: { min: 0, max: Math.PI * 2 },
        lifetime: { min: 500, max: 1000 },
        size: { start: 4, end: 0 },
        color: [colors.gold, colors.orange, colors.pink],
        opacity: { start: 1, end: 0 },
      });
      pulseRings.emit({
        x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2,
        color: colors.gold, maxRadius: 100, duration: 600,
      });
    }

    function spawnObstacle() {
      // Spawn at the edge with an inward velocity
      const margin = 40;
      const side = Math.floor(rng() * 4); // 0=top, 1=right, 2=bottom, 3=left
      let x = 0, y = 0, vx = 0, vy = 0;
      const spd = 80;
      if (side === 0) { x = margin + rng() * (CANVAS_SIZE - margin * 2); y = margin; vy = spd; vx = (rng() - 0.5) * spd; }
      else if (side === 1) { x = CANVAS_SIZE - margin; y = margin + rng() * (CANVAS_SIZE - margin * 2); vx = -spd; vy = (rng() - 0.5) * spd; }
      else if (side === 2) { x = margin + rng() * (CANVAS_SIZE - margin * 2); y = CANVAS_SIZE - margin; vy = -spd; vx = (rng() - 0.5) * spd; }
      else { x = margin; y = margin + rng() * (CANVAS_SIZE - margin * 2); vx = spd; vy = (rng() - 0.5) * spd; }
      obstacles.push({ x, y, vx, vy, r: OBSTACLE_RADIUS, spawnTimer: 500 });
      pulseRings.emit({ x, y, color: colors.danger, maxRadius: 25, duration: 400 });
    }

    function targetObstacleCount(): number {
      if (score < 5) return 0;
      if (score < 15) return 1;
      if (score < 25) return 2;
      if (score < 40) return 3;
      return 4;
    }

    function updateObstacles(rawDt: number) {
      const dtSec = rawDt / 1000;
      // Spawn more as target count increases
      while (obstacles.length < targetObstacleCount()) {
        spawnObstacle();
      }
      for (const o of obstacles) {
        if (o.spawnTimer > 0) {
          o.spawnTimer -= rawDt;
          continue; // grace period — don't move or collide
        }
        o.x += o.vx * dtSec;
        o.y += o.vy * dtSec;
        // Bounce off walls
        if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx); }
        if (o.x > CANVAS_SIZE - o.r) { o.x = CANVAS_SIZE - o.r; o.vx = -Math.abs(o.vx); }
        if (o.y < o.r) { o.y = o.r; o.vy = Math.abs(o.vy); }
        if (o.y > CANVAS_SIZE - o.r) { o.y = CANVAS_SIZE - o.r; o.vy = -Math.abs(o.vy); }
        // Collision with snake head
        const d = Math.sqrt((head.x - o.x) ** 2 + (head.y - o.y) ** 2);
        if (d < HEAD_RADIUS + o.r - 2) {
          die();
          return;
        }
      }
    }

    function eatPellet() {
      score++;
      bodyLen += BODY_PER_PELLET;

      const cx = pellet.x;
      const cy = pellet.y;
      // Big particle burst — radial
      particles.emit({
        count: 16,
        position: { x: cx, y: cy },
        velocity: { min: 80, max: 200 },
        angle: { min: 0, max: Math.PI * 2 },
        lifetime: { min: 400, max: 800 },
        size: { start: 4, end: 0 },
        color: [colors.gold, colors.orange],
        opacity: { start: 1, end: 0 },
      });
      // Small spiraling sparks
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        particles.emit({
          count: 1,
          position: { x: cx, y: cy },
          velocity: { min: 60, max: 90 },
          angle: { min: a, max: a + 0.1 },
          lifetime: { min: 600, max: 800 },
          size: { start: 3, end: 0 },
          color: colors.gold,
          opacity: { start: 1, end: 0 },
        });
      }
      pulseRings.emit({ x: cx, y: cy, color: colors.gold, maxRadius: 35, duration: 350 });
      floatingText.emit({
        text: '+1', x: cx, y: cy - 16,
        color: colors.gold, fontSize: 16, duration: 600,
      });
      scorePulse.snap(1.5);
      scorePulse.target = 1;

      // Speed tier
      const tier = SPEED_TIERS.filter(t => score >= t.score).pop();
      if (tier && tier.speed !== speed) {
        speed = tier.speed;
        shake.trigger({ intensity: 3, duration: 100 });
      }

      for (const m of MILESTONES) {
        if (score === m.score && !milestonesHit.has(m.score)) {
          milestonesHit.add(m.score);
          triggerMilestone(m.text);
        }
      }

      spawnPellet();
    }

    function die() {
      alive = false;
      shake.trigger({ intensity: 14, duration: 400 });
      flash.trigger(colors.danger, 250);
      slowMo.trigger(0.25, 350);

      pulseRings.emit({ x: head.x, y: head.y, color: colors.danger, maxRadius: 60, duration: 500 });

      // Burst from each trail point — fragments scatter
      for (let i = 0; i < trail.length; i += 3) {
        const t = trail[i];
        const a = rng() * Math.PI * 2;
        const sp = 60 + rng() * 140;
        particles.emit({
          count: 1,
          position: { x: t.x, y: t.y },
          velocity: { min: sp, max: sp * 1.5 },
          angle: { min: a, max: a + 0.3 },
          lifetime: { min: 600, max: 1100 },
          size: { start: 4, end: 0 },
          color: [colors.danger, colors.pink],
          opacity: { start: 1, end: 0 },
          gravity: 180,
        });
      }
      floatingText.emit({
        text: 'CRASHED!',
        x: head.x, y: head.y - 30,
        color: colors.danger, fontSize: 22, duration: 900,
      });

      setTimeout(() => {
        if (gameOver) return;
        gameOver = true;
        const finalLength = Math.floor(bodyLen);
        onResult({ score, finalLength });
      }, 700);
    }

    // --- Game loop ---
    let lastTime = performance.now();
    let animId: number;
    let lastTrailEmit = 0;

    function loop(now: number) {
      const rawDt = Math.min(now - lastTime, 50);
      lastTime = now;
      const dt = slowMo.update(rawDt);
      elapsed += rawDt;
      pelletJustSpawned = Math.max(0, pelletJustSpawned - rawDt);

      if (alive && elapsed >= timeLimit) {
        alive = false;
        floatingText.emit({
          text: "TIME'S UP!",
          x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2,
          color: colors.gold, fontSize: 24, duration: 800,
        });
        flash.trigger(withAlpha(colors.gold, 0.18), 150);
        setTimeout(() => {
          if (gameOver) return;
          gameOver = true;
          onResult({ score, finalLength: Math.floor(bodyLen) });
        }, 600);
      }

      if (alive) {
        // Apply queued direction
        dir = nextDir;

        // Move head
        const dtSec = dt / 1000;
        head.x += dir.x * speed * dtSec;
        head.y += dir.y * speed * dtSec;

        // Wall collision
        if (head.x < HEAD_RADIUS || head.x > CANVAS_SIZE - HEAD_RADIUS ||
            head.y < HEAD_RADIUS || head.y > CANVAS_SIZE - HEAD_RADIUS) {
          head.x = Math.max(HEAD_RADIUS, Math.min(CANVAS_SIZE - HEAD_RADIUS, head.x));
          head.y = Math.max(HEAD_RADIUS, Math.min(CANVAS_SIZE - HEAD_RADIUS, head.y));
          die();
        }

        // Add a new trail point when head has moved enough.
        // Always update trail[0] to current head position so the front of
        // the body tracks the head smoothly between samples.
        if (alive) {
          const first = trail[0];
          const d = Math.sqrt((head.x - first.x) ** 2 + (head.y - first.y) ** 2);
          if (d >= TRAIL_SPACING) {
            trail.unshift({ x: head.x, y: head.y });
          } else {
            trail[0] = { x: head.x, y: head.y };
          }
          // Ensure there's at least a tiny tail point to draw a line from
          if (trail.length < 2) {
            trail.push({ x: head.x - dir.x * 1, y: head.y - dir.y * 1 });
          }

          // Trim trail to bodyLen arc length
          let arc = 0;
          for (let i = 1; i < trail.length; i++) {
            arc += Math.sqrt(
              (trail[i].x - trail[i - 1].x) ** 2 + (trail[i].y - trail[i - 1].y) ** 2
            );
            if (arc >= bodyLen) {
              trail.length = i + 1;
              break;
            }
          }

          // Pellet collision
          const pd = Math.sqrt((head.x - pellet.x) ** 2 + (head.y - pellet.y) ** 2);
          if (pd < HEAD_RADIUS + 10) {
            eatPellet();
          }

          // Self-collision (skip the segments right behind the head)
          let skipArc = 0;
          for (let i = 1; i < trail.length; i++) {
            skipArc += Math.sqrt(
              (trail[i].x - trail[i - 1].x) ** 2 + (trail[i].y - trail[i - 1].y) ** 2
            );
            if (skipArc < SELF_COLLISION_SKIP) continue;
            const seg = trail[i];
            const sd = Math.sqrt((head.x - seg.x) ** 2 + (head.y - seg.y) ** 2);
            if (sd < HEAD_RADIUS + BODY_WIDTH * 0.4) {
              die();
              break;
            }
          }
        }

        // Update bouncing obstacles (may kill the snake)
        updateObstacles(rawDt);
        if (!alive) {
          // skip remaining tick work
        }

        // Ambient trail particles — emit from random body positions
        lastTrailEmit += dt;
        if (lastTrailEmit > 30 && trail.length > 5) {
          lastTrailEmit = 0;
          const sampleIdx = 1 + Math.floor(rng() * (trail.length - 2));
          const samp = trail[sampleIdx];
          const t = sampleIdx / trail.length;
          ambientParticles.emit({
            count: 1,
            position: { x: samp.x + (rng() - 0.5) * 4, y: samp.y + (rng() - 0.5) * 4 },
            velocity: { min: 5, max: 20 },
            angle: { min: 0, max: Math.PI * 2 },
            lifetime: { min: 300, max: 600 },
            size: { start: 2, end: 0 },
            color: t < 0.5 ? colors.info : colors.pink,
            opacity: { start: 0.7 * (1 - t), end: 0 },
          });
        }
      }

      // Pellet rotation
      pelletAngle += dt * 0.003;

      // Update VFX
      particles.update(dt);
      ambientParticles.update(dt);
      shake.update(dt);
      flash.update(dt);
      pulseRings.update(dt);
      floatingText.update(dt);
      pelletScale.update(dt);
      scorePulse.update(dt);

      drawFrame(ctx);
      animId = requestAnimationFrame(loop);
    }

    function drawFrame(ctx: CanvasRenderingContext2D) {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      shake.apply(ctx);

      // Background — solid + radial vignette
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const grad = ctx.createRadialGradient(
        CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE * 0.2,
        CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE * 0.7,
      );
      grad.addColorStop(0, withAlpha(colors.bgSubtle, 0.25));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Border (arena edges)
      ctx.strokeStyle = withAlpha(colors.info, 0.2);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(2, 2, CANVAS_SIZE - 4, CANVAS_SIZE - 4);

      // Ambient trail particles (under body)
      ambientParticles.draw(ctx);

      // Pellet
      drawPellet(ctx);

      // Obstacles
      drawObstacles(ctx);

      // Snake body
      drawSnakeBody(ctx);

      // VFX layers
      particles.draw(ctx);
      pulseRings.draw(ctx);
      floatingText.draw(ctx);

      // HUD
      drawHUD(ctx);

      // Flash overlay
      flash.draw(ctx, CANVAS_SIZE, CANVAS_SIZE);
      shake.restore(ctx);
    }

    function drawPellet(ctx: CanvasRenderingContext2D) {
      const s = pelletScale.value;
      if (s < 0.05) return;
      const baseR = 8;
      const pulse = 1 + Math.sin(elapsed * 0.006) * 0.12;
      const r = baseR * s * pulse;

      // Glow orb
      ctx.save();
      ctx.shadowColor = colors.gold;
      ctx.shadowBlur = 20;
      ctx.fillStyle = colors.gold;
      ctx.beginPath();
      ctx.arc(pellet.x, pellet.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // White hot core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pellet.x, pellet.y, r * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Spawn-in ring
      if (pelletJustSpawned > 0) {
        const t = pelletJustSpawned / 300;
        ctx.strokeStyle = withAlpha(colors.gold, t);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pellet.x, pellet.y, r + (1 - t) * 20, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function drawObstacles(ctx: CanvasRenderingContext2D) {
      for (const o of obstacles) {
        const spawnFade = o.spawnTimer > 0 ? (1 - o.spawnTimer / 500) : 1;
        ctx.save();
        ctx.globalAlpha = spawnFade;
        ctx.shadowColor = colors.danger;
        ctx.shadowBlur = 14;
        ctx.fillStyle = colors.danger;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Inner highlight
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(o.x - o.r * 0.3, o.y - o.r * 0.3, o.r * 0.3, 0, Math.PI * 2);
        ctx.fill();
        // Spawning grace ring
        if (o.spawnTimer > 0) {
          const t = o.spawnTimer / 500;
          ctx.strokeStyle = withAlpha(colors.danger, t);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.r + (1 - t) * 18, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    function drawSnakeBody(ctx: CanvasRenderingContext2D) {
      // Render body as a smoothed Bezier spline through the trail points.
      // Use midpoints + quadraticCurveTo to hide trail sampling artifacts.
      if (trail.length >= 2) {
        const tracePath = () => {
          ctx.beginPath();
          ctx.moveTo(trail[0].x, trail[0].y);
          if (trail.length === 2) {
            ctx.lineTo(trail[1].x, trail[1].y);
          } else {
            for (let i = 1; i < trail.length - 1; i++) {
              const mx = (trail[i].x + trail[i + 1].x) / 2;
              const my = (trail[i].y + trail[i + 1].y) / 2;
              ctx.quadraticCurveTo(trail[i].x, trail[i].y, mx, my);
            }
            // Last segment: go straight to the final tail point
            const last = trail[trail.length - 1];
            ctx.lineTo(last.x, last.y);
          }
        };

        // Outer glow
        ctx.save();
        ctx.shadowColor = colors.info;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = withAlpha(colors.info, 0.55);
        ctx.lineWidth = BODY_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        tracePath();
        ctx.stroke();
        ctx.restore();

        // Solid core
        ctx.strokeStyle = colors.info;
        ctx.lineWidth = BODY_WIDTH - 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        tracePath();
        ctx.stroke();

        // Center stripe
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        tracePath();
        ctx.stroke();
      }

      // HEAD — distinct circle on top of the body
      ctx.save();
      ctx.shadowColor = colors.info;
      ctx.shadowBlur = 18;
      ctx.fillStyle = colors.info;
      ctx.beginPath();
      ctx.arc(head.x, head.y, HEAD_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // White inner core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(head.x, head.y, HEAD_RADIUS * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Eyes (dark dots offset perpendicular to motion direction)
      const eyeOffset = HEAD_RADIUS * 0.42;
      const fwd = 1.5;
      const ex1 = head.x + dir.y * eyeOffset + dir.x * fwd;
      const ey1 = head.y - dir.x * eyeOffset + dir.y * fwd;
      const ex2 = head.x - dir.y * eyeOffset + dir.x * fwd;
      const ey2 = head.y + dir.x * eyeOffset + dir.y * fwd;
      ctx.fillStyle = colors.bg;
      ctx.beginPath();
      ctx.arc(ex1, ey1, 1.8, 0, Math.PI * 2);
      ctx.arc(ex2, ey2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawHUD(ctx: CanvasRenderingContext2D) {
      const sScale = scorePulse.value;
      ctx.save();
      ctx.translate(20, 20);
      ctx.scale(sScale, sScale);
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      // Soft outer glow
      ctx.fillStyle = withAlpha(colors.info, 0.25);
      ctx.fillText(`${score}`, -1, -1);
      ctx.fillText(`${score}`, 1, 1);
      // Solid bright fill
      ctx.fillStyle = colors.text;
      ctx.fillText(`${score}`, 0, 0);
      ctx.restore();

      // Speed tier indicator (top right)
      const tier = getSpeedTier();
      ctx.font = '10px monospace';
      ctx.fillStyle = tier >= 4 ? colors.danger : tier >= 2 ? colors.gold : colors.textDim;
      ctx.textAlign = 'right';
      ctx.globalAlpha = 0.85;
      ctx.fillText(`SPEED ${tier + 1}`, CANVAS_SIZE - 16, 18);
      for (let i = 0; i < SPEED_TIERS.length; i++) {
        const x = CANVAS_SIZE - 16 - (SPEED_TIERS.length - 1 - i) * 7;
        const y = 36;
        ctx.fillStyle = i <= tier
          ? (tier >= 4 ? colors.danger : tier >= 2 ? colors.gold : colors.info)
          : withAlpha(colors.textDim, 0.2);
        ctx.fillRect(x - 2, y, 4, 4 + i * 1.2);
      }
      ctx.globalAlpha = 1;
    }

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('keydown', handleKeydown);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [seed, difficulty, timeLimit, onResult, theme]);

  return (
    <div ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{ width: '100%', height: '100%', touchAction: 'none' }}
      />
    </div>
  );
}
