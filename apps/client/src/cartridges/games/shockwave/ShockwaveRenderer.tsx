import { useEffect, useRef, useCallback } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import type { CartridgeTheme } from '@pecking-order/ui-kit/cartridge-theme';
import { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';
import {
  mulberry32, lerp, distance,
  ParticleEmitter, TrailRenderer, ScreenShake,
  drawWithGlow, SlowMo, ScreenFlash, PulseRingEmitter,
  FloatingTextEmitter, SpringValue,
} from '../shared/canvas-vfx';

const px = (v: number) => Math.round(v);

// Wave milestone ladder — highest tier reserved for deep runs
const WAVE_MILESTONES: { waves: number; text: string }[] = [
  { waves: 5, text: '5 WAVES' },
  { waves: 15, text: '15 WAVES' },
  { waves: 30, text: '30 WAVES!' },
];

// --- Constants ---

const CANVAS_SIZE = 400;
const CENTER = CANVAS_SIZE / 2;
const ARENA_RADIUS = 180;
const PLAYER_RADIUS = 6;
const PLAYER_SPEED = 200; // px/s
const DASH_SPEED_MULT = 3;
const DASH_DURATION = 150; // ms
const DASH_COOLDOWN = 3000; // ms
const RING_LINE_WIDTH = 3;
const NEAR_MISS_DIST = 10; // px from ring edge
const WAVE_SPAWN_BASE = 2000; // ms between waves at start

// Combo thresholds (waves survived without dashing)
function comboMultiplier(wavesNoDash: number): number {
  if (wavesNoDash >= 20) return 3;
  if (wavesNoDash >= 10) return 2;
  if (wavesNoDash >= 5) return 1.5;
  return 1;
}

// --- Wave type ---

interface Wave {
  gapStart: number; // radians
  gapSize: number;  // radians
  radius: number;
  speed: number;    // px/s contraction
  color: string;
  rotating: boolean;
  rotationSpeed: number;
  angle: number;    // current rotation offset
}

// --- Difficulty ramp ---

function getDifficultyParams(elapsed: number, difficulty: number) {
  const t = elapsed / 1000;
  const shift = difficulty * 0.3; // shifts phases earlier
  const effectiveT = t / (1 - shift);

  let gapSize: number;
  let speed: number;
  let spawnInterval: number;
  let canRotate = false;

  if (effectiveT < 10) {
    gapSize = (60 * Math.PI) / 180;
    speed = 80;
    spawnInterval = WAVE_SPAWN_BASE;
  } else if (effectiveT < 25) {
    const p = (effectiveT - 10) / 15;
    gapSize = lerp((45 * Math.PI) / 180, (30 * Math.PI) / 180, p);
    speed = 120;
    spawnInterval = lerp(WAVE_SPAWN_BASE, 1500, p);
  } else if (effectiveT < 40) {
    const p = (effectiveT - 25) / 15;
    gapSize = lerp((30 * Math.PI) / 180, (20 * Math.PI) / 180, p);
    speed = 160;
    spawnInterval = lerp(1500, 1000, p);
    canRotate = true;
  } else {
    gapSize = lerp((20 * Math.PI) / 180, (15 * Math.PI) / 180, Math.min(1, (effectiveT - 40) / 20));
    speed = 200;
    spawnInterval = 800;
    canRotate = true;
  }

  // Difficulty makes gaps narrower
  gapSize *= (1 - difficulty * 0.2);

  return { gapSize, speed, spawnInterval, canRotate };
}

// --- Ring colors ---

const RING_COLOR_KEYS: (keyof CartridgeTheme['colors'])[] = ['gold', 'pink', 'danger', 'green'];

export default function ShockwaveRenderer({ seed, difficulty, timeLimit, onResult }: ArcadeRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useCartridgeTheme(containerRef);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const t = themeRef.current;

    // --- Game state ---
    const rng = mulberry32(seed);
    let playerX = CENTER;
    let playerY = CENTER;
    let targetX = CENTER;
    let targetY = CENTER;
    const waves: Wave[] = [];
    let wavesCleared = 0;
    let nearMisses = 0;
    let combo = 0; // waves survived without dashing
    let maxCombo = 0;
    let dead = false;
    let deathTime = 0;
    let ending = false; // single end-of-game VFX guard
    let elapsed = 0;
    let lastWaveSpawn = 0;
    let colorIndex = 0;
    const crossedMilestones = new Set<number>();

    // Dash state
    let dashing = false;
    let dashElapsed = 0;
    let dashCooldown = 0;
    let dashDirX = 0;
    let dashDirY = 0;

    // VFX instances
    const particles = new ParticleEmitter();
    const trail = new TrailRenderer({
      maxPoints: 15,
      width: { start: 4, end: 1 },
      color: t.colors.info,
      opacity: { start: 0.6, end: 0 },
    });
    const screenShake = new ScreenShake();
    const slowMo = new SlowMo();
    const screenFlash = new ScreenFlash();
    const pulseRings = new PulseRingEmitter();
    const floatingText = new FloatingTextEmitter();
    const waveSpring = new SpringValue({ stiffness: 220, damping: 14 });

    // Ambient dust particles
    const ambientParticles = new ParticleEmitter();

    // --- Input ---
    let mouseDown = false;

    function onPointerMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const scaleX = CANVAS_SIZE / rect.width;
      const scaleY = CANVAS_SIZE / rect.height;
      targetX = (e.clientX - rect.left) * scaleX;
      targetY = (e.clientY - rect.top) * scaleY;
    }

    function onPointerDown(e: PointerEvent) {
      mouseDown = true;
      onPointerMove(e);
      // Trigger dash
      if (!dead && dashCooldown <= 0) {
        const dx = targetX - playerX;
        const dy = targetY - playerY;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          dashDirX = dx / len;
          dashDirY = dy / len;
          dashing = true;
          dashElapsed = 0;
          dashCooldown = DASH_COOLDOWN;
          combo = 0; // dash resets combo
        }
      }
    }

    function onPointerUp() {
      mouseDown = false;
    }

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);

    // --- Spawn wave ---
    function spawnWave() {
      const params = getDifficultyParams(elapsed, difficulty);
      const color = t.colors[RING_COLOR_KEYS[colorIndex % RING_COLOR_KEYS.length]];
      colorIndex++;
      waves.push({
        gapStart: rng() * Math.PI * 2,
        gapSize: params.gapSize,
        radius: ARENA_RADIUS + 20,
        speed: params.speed,
        color,
        rotating: params.canRotate && rng() > 0.5,
        rotationSpeed: (rng() > 0.5 ? 1 : -1) * (0.3 + rng() * 0.5),
        angle: 0,
      });
    }

    // --- Check collision ---
    function checkCollision(px: number, py: number): { hit: boolean; nearMiss: boolean; nearMissX: number; nearMissY: number } {
      let nearMiss = false;
      let nearMissX = 0;
      let nearMissY = 0;

      for (const wave of waves) {
        const dist = distance(px, py, CENTER, CENTER);
        const ringDist = Math.abs(dist - wave.radius);

        if (ringDist > RING_LINE_WIDTH + NEAR_MISS_DIST) continue;

        // Check if player is in the gap
        const angleToPlayer = Math.atan2(py - CENTER, px - CENTER);
        const relAngle = ((angleToPlayer - wave.gapStart - wave.angle + Math.PI * 4) % (Math.PI * 2));
        const inGap = relAngle < wave.gapSize;

        if (ringDist <= RING_LINE_WIDTH / 2 + PLAYER_RADIUS && !inGap) {
          return { hit: true, nearMiss: false, nearMissX: 0, nearMissY: 0 };
        }

        if (ringDist <= NEAR_MISS_DIST + PLAYER_RADIUS && !nearMiss) {
          nearMiss = true;
          nearMissX = px;
          nearMissY = py;
        }
      }

      return { hit: false, nearMiss, nearMissX, nearMissY };
    }

    // --- Render ---
    function renderGame(dt: number) {
      const w = CANVAS_SIZE;
      const h = CANVAS_SIZE;

      // Background
      ctx.fillStyle = t.colors.bg;
      ctx.fillRect(0, 0, w, h);

      screenShake.apply(ctx);

      // Radial grid lines
      ctx.strokeStyle = withAlpha(t.colors.textDim, 0.05);
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(CENTER, CENTER);
        ctx.lineTo(CENTER + Math.cos(angle) * ARENA_RADIUS, CENTER + Math.sin(angle) * ARENA_RADIUS);
        ctx.stroke();
      }

      // Arena border
      ctx.strokeStyle = withAlpha(t.colors.textDim, 0.1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, ARENA_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      // Draw waves
      for (const wave of waves) {
        const gapEnd = wave.gapStart + wave.angle + wave.gapSize;
        const gapStart = wave.gapStart + wave.angle;

        drawWithGlow(ctx, wave.color, 8, () => {
          ctx.strokeStyle = wave.color;
          ctx.lineWidth = RING_LINE_WIDTH;
          ctx.beginPath();
          ctx.arc(CENTER, CENTER, wave.radius, gapEnd, gapStart + Math.PI * 2);
          ctx.stroke();
        });

        // Gap edge dots
        ctx.fillStyle = wave.color;
        ctx.globalAlpha = 0.9;
        for (const edgeAngle of [gapStart, gapEnd]) {
          ctx.beginPath();
          ctx.arc(
            CENTER + Math.cos(edgeAngle) * wave.radius,
            CENTER + Math.sin(edgeAngle) * wave.radius,
            4, 0, Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Draw trail when dashing
      trail.draw(ctx);

      // Draw player
      drawWithGlow(ctx, t.colors.info, 20, () => {
        ctx.fillStyle = t.colors.text;
        ctx.beginPath();
        ctx.arc(playerX, playerY, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      });

      // VFX layers
      particles.draw(ctx);
      pulseRings.draw(ctx);
      floatingText.draw(ctx);

      screenShake.restore(ctx);

      screenFlash.draw(ctx, w, h);

      // HUD
      ctx.font = '14px monospace';
      ctx.textBaseline = 'top';

      // Wave count — spring-pulses on every clear
      const waveScale = 1 + waveSpring.value;
      ctx.save();
      ctx.translate(px(12), px(12));
      ctx.scale(waveScale, waveScale);
      ctx.fillStyle = withAlpha(t.colors.text, 0.6);
      ctx.textAlign = 'left';
      ctx.fillText(`Waves: ${wavesCleared}`, 0, 0);
      ctx.restore();

      // Combo
      const mult = comboMultiplier(combo);
      if (mult > 1) {
        ctx.fillStyle = t.colors.gold;
        ctx.textAlign = 'right';
        ctx.fillText(`${mult}x`, w - 12, 12);
      }

      // Time remaining
      const remaining = Math.max(0, Math.ceil((timeLimit - elapsed) / 1000));
      ctx.fillStyle = remaining <= 10 ? withAlpha(t.colors.danger, 0.8) : withAlpha(t.colors.text, 0.4);
      ctx.textAlign = 'center';
      ctx.fillText(`${remaining}s`, w / 2, h - 24);
    }

    function triggerEnding(reason: 'crashed' | 'timesup') {
      if (ending) return;
      ending = true;
      const color = reason === 'crashed' ? t.colors.danger : t.colors.gold;
      const text = reason === 'crashed' ? 'CRASHED!' : "SURVIVED!";
      // Crash VFX already fired inline on collision; for time-up, play a celebratory end
      if (reason === 'timesup') {
        screenFlash.trigger(withAlpha(color, 0.35), 400);
        pulseRings.emit({
          x: CENTER,
          y: CENTER,
          color,
          maxRadius: 220,
          duration: 700,
          lineWidth: 3,
        });
        particles.emit({
          count: 40,
          position: { x: CENTER, y: CENTER },
          velocity: { min: 120, max: 280 },
          angle: { min: 0, max: Math.PI * 2 },
          lifetime: { min: 500, max: 900 },
          size: { start: 3, end: 0.5 },
          color: [color, t.colors.text],
          opacity: { start: 1, end: 0 },
        });
      }
      floatingText.emit({
        text,
        x: CENTER,
        y: CENTER - 20,
        color,
        fontSize: 28,
        duration: 900,
        drift: 30,
      });
    }

    // --- Game loop ---
    let lastTime = performance.now();
    let animId: number;
    let resultSent = false;

    function frame(now: number) {
      const realDt = Math.max(0, Math.min(now - lastTime, 50)); // clamp to [0, 50ms]
      lastTime = now;

      const dt = slowMo.update(realDt);

      if (!dead) {
        elapsed += dt;

        // Time's up
        if (elapsed >= timeLimit) {
          dead = true;
          deathTime = 0;
        }

        // Move player toward target
        if (!dead) {
          const dx = targetX - playerX;
          const dy = targetY - playerY;
          const len = Math.sqrt(dx * dx + dy * dy);

          if (dashing) {
            dashElapsed += dt;
            playerX += dashDirX * PLAYER_SPEED * DASH_SPEED_MULT * (dt / 1000);
            playerY += dashDirY * PLAYER_SPEED * DASH_SPEED_MULT * (dt / 1000);
            trail.push(playerX, playerY);
            if (dashElapsed >= DASH_DURATION) {
              dashing = false;
            }
          } else if (len > 2) {
            const moveSpeed = PLAYER_SPEED * (dt / 1000);
            const moveLen = Math.min(len, moveSpeed);
            playerX += (dx / len) * moveLen;
            playerY += (dy / len) * moveLen;
          }

          // Clamp to arena
          const distFromCenter = distance(playerX, playerY, CENTER, CENTER);
          if (distFromCenter > ARENA_RADIUS - PLAYER_RADIUS) {
            const angle = Math.atan2(playerY - CENTER, playerX - CENTER);
            playerX = CENTER + Math.cos(angle) * (ARENA_RADIUS - PLAYER_RADIUS);
            playerY = CENTER + Math.sin(angle) * (ARENA_RADIUS - PLAYER_RADIUS);
          }

          // Dash cooldown
          if (dashCooldown > 0) dashCooldown -= dt;

          // Spawn waves
          const params = getDifficultyParams(elapsed, difficulty);
          if (elapsed - lastWaveSpawn >= params.spawnInterval) {
            spawnWave();
            lastWaveSpawn = elapsed;
          }

          // Update waves
          for (let i = waves.length - 1; i >= 0; i--) {
            const wave = waves[i];
            wave.radius -= wave.speed * (dt / 1000);
            if (wave.rotating) {
              wave.angle += wave.rotationSpeed * (dt / 1000);
            }
            if (wave.radius < 10) {
              const clearColor = wave.color;
              waves.splice(i, 1);
              wavesCleared++;
              combo++;
              maxCombo = Math.max(maxCombo, combo);

              // Per-clear flash + themed centre burst (subtle — fires every wave)
              screenFlash.trigger(withAlpha(clearColor, 0.14), 90);
              waveSpring.target = 0.25;
              particles.emit({
                count: 14,
                position: { x: CENTER, y: CENTER },
                velocity: { min: 40, max: 120 },
                angle: { min: 0, max: Math.PI * 2 },
                lifetime: { min: 240, max: 480 },
                size: { start: 2, end: 0.5 },
                color: clearColor,
                opacity: { start: 0.9, end: 0 },
              });

              // Milestone ladder — louder celebration at 5 / 15 / 30 waves
              for (const m of WAVE_MILESTONES) {
                if (wavesCleared === m.waves && !crossedMilestones.has(m.waves)) {
                  crossedMilestones.add(m.waves);
                  const tier = m.waves >= 30 ? 1 : m.waves >= 15 ? 0.7 : 0.5;
                  screenFlash.trigger(withAlpha(t.colors.gold, 0.22 * tier), 140);
                  screenShake.trigger({ intensity: 4 + 3 * tier, duration: 200 });
                  pulseRings.emit({
                    x: CENTER,
                    y: CENTER,
                    color: t.colors.gold,
                    maxRadius: 120 + 60 * tier,
                    duration: 560,
                    lineWidth: 2,
                  });
                  particles.emit({
                    count: 28 + Math.round(14 * tier),
                    position: { x: CENTER, y: CENTER },
                    velocity: { min: 80, max: 220 },
                    angle: { min: 0, max: Math.PI * 2 },
                    lifetime: { min: 400, max: 800 },
                    size: { start: 3, end: 0.5 },
                    color: [t.colors.gold, clearColor, '#ffffff'],
                    opacity: { start: 1, end: 0 },
                  });
                  floatingText.emit({
                    text: m.text,
                    x: CENTER,
                    y: CENTER - 30,
                    color: t.colors.gold,
                    fontSize: 18 + Math.round(4 * tier),
                    duration: 900,
                    drift: 40,
                  });
                }
              }
            }
          }

          // Collision check
          const collision = checkCollision(playerX, playerY);
          if (collision.hit) {
            dead = true;
            deathTime = 0;
            slowMo.trigger(0.1, 300);
            screenFlash.trigger(t.colors.text, 400);
            screenShake.trigger({ intensity: 12, duration: 400 });
            // Player shatter particles
            particles.emit({
              count: 20,
              position: { x: playerX, y: playerY },
              velocity: { min: 80, max: 200 },
              angle: { min: 0, max: Math.PI * 2 },
              lifetime: { min: 400, max: 800 },
              size: { start: 3, end: 0.5 },
              color: [t.colors.danger, t.colors.pink, t.colors.text],
              opacity: { start: 1, end: 0 },
            });
          } else if (collision.nearMiss) {
            nearMisses++;
            slowMo.trigger(0.3, 100);
            screenFlash.trigger(withAlpha(t.colors.gold, 0.3), 150);
            particles.emit({
              count: 8,
              position: { x: collision.nearMissX, y: collision.nearMissY },
              velocity: { min: 40, max: 100 },
              angle: { min: 0, max: Math.PI * 2 },
              lifetime: { min: 200, max: 400 },
              size: { start: 2, end: 0.5 },
              color: t.colors.gold,
              opacity: { start: 0.8, end: 0 },
            });
            pulseRings.emit({
              x: collision.nearMissX,
              y: collision.nearMissY,
              color: t.colors.gold,
              maxRadius: 30,
              duration: 300,
            });
          }

          // Ambient dust
          if (rng() < 0.05) {
            ambientParticles.emit({
              count: 1,
              position: { x: CENTER + (rng() - 0.5) * ARENA_RADIUS * 2, y: CENTER + (rng() - 0.5) * ARENA_RADIUS * 2 },
              velocity: { min: 5, max: 15 },
              angle: { min: -Math.PI / 2 - 0.5, max: -Math.PI / 2 + 0.5 },
              lifetime: { min: 2000, max: 4000 },
              size: { start: 1.5, end: 0.5 },
              color: withAlpha(t.colors.textDim, 0.15),
              opacity: { start: 0.15, end: 0 },
            }, rng);
          }
        }
      }

      if (dead) {
        deathTime += realDt;
        if (!ending) {
          // collision path sets dead via hit; time-up path sets dead by clock — distinguish by wave collision VFX being fired inline
          // Treat as 'crashed' if collision VFX was triggered (we detect by slowMo being active), else 'timesup'
          triggerEnding(elapsed >= timeLimit ? 'timesup' : 'crashed');
        }
      }

      // Wave-clear spring decays; clear handlers bump it
      waveSpring.target = 0;
      waveSpring.update(realDt);

      // Update VFX
      particles.update(dt);
      ambientParticles.update(dt);
      screenShake.update(dt);
      screenFlash.update(dt);
      pulseRings.update(dt);
      floatingText.update(dt);

      // Render
      renderGame(dt);

      // Also draw ambient particles
      ambientParticles.draw(ctx);

      // Send result after death animation
      if (dead && deathTime > 800 && !resultSent) {
        resultSent = true;
        onResultRef.current({
          wavesCleared,
          nearMisses,
          maxCombo,
        });
        return;
      }

      animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
    };
  }, [seed, difficulty, timeLimit]);

  useEffect(() => {
    const cleanup = gameLoop();
    return cleanup;
  }, [gameLoop]);

  return (
    <div ref={containerRef} className="flex items-center justify-center w-full">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="max-w-full max-h-full touch-none"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
