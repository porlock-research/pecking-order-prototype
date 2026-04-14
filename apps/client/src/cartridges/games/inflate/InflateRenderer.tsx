import { useEffect, useRef } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import {
  mulberry32,
  ParticleEmitter, ScreenShake, ScreenFlash, PulseRingEmitter,
  SlowMo, FloatingTextEmitter, SpringValue, DebrisEmitter, drawWithGlow,
} from '../shared/canvas-vfx';
import { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';

const CANVAS_SIZE = 400;
const MAX_LIVES = Config.game.inflate.maxLives;
const MIN_HOLD_MS = 200;

const BALLOON_MAX_RADIUS = 80;
const BALLOON_MIN_RADIUS = 16;

type BalloonType = 'normal' | 'golden' | 'tough';

interface Balloon {
  id: number;
  type: BalloonType;
  popThreshold: number;
  inflateProgress: number;
  x: number;
  y: number;
  patienceTimer: number; // ms remaining before auto-pop
  maxPatience: number;
  scale: SpringValue;
  wobblePhase: number;
  // Float-up state (after banking)
  banked: boolean;
  bankedTimer: number;
  opacity: number;
}

function getBalloonColor(type: BalloonType, colors: Record<string, string>): string {
  switch (type) {
    case 'golden': return colors.gold;
    case 'tough': return colors.green;
    default: return colors.info;
  }
}

function getValueMultiplier(type: BalloonType): number {
  switch (type) {
    case 'golden': return 2;
    case 'tough': return 1.5;
    default: return 1;
  }
}

export default function InflateRenderer({ seed, difficulty, timeLimit, onResult }: ArcadeRendererProps) {
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
    let score = 0;
    let lives = MAX_LIVES;
    let balloonsBanked = 0;
    let balloonsPopped = 0;
    let perfectBanks = 0;
    let streak = 0;
    let elapsed = 0;
    let gameOver = false;
    let nextId = 0;

    // --- Active balloons ---
    const balloons: Balloon[] = [];
    let holdingId: number | null = null;
    let holdTime = 0;

    // --- VFX ---
    const particles = new ParticleEmitter();
    const shake = new ScreenShake();
    const flash = new ScreenFlash();
    const pulseRings = new PulseRingEmitter();
    const slowMo = new SlowMo();
    const floatingText = new FloatingTextEmitter();
    const debris = new DebrisEmitter();

    // --- Balloon spawning ---
    function getSlotCount(): number {
      if (elapsed < 8000) return 1;
      if (elapsed < 20000) return 2;
      return 3;
    }

    function getPatience(): number {
      // Patience decreases over time — more pressure
      if (elapsed < 8000) return 99999; // single balloon: no patience pressure
      if (elapsed < 15000) return 6000;
      if (elapsed < 25000) return 5000;
      if (elapsed < 35000) return 4000;
      return 3000;
    }

    function pickType(): BalloonType {
      const t = elapsed / timeLimit;
      const goldenChance = t < 0.25 ? 0 : t < 0.55 ? 0.2 : 0.3;
      const toughChance = 0.2;
      const r = rng();
      if (r < goldenChance) return 'golden';
      if (r < goldenChance + toughChance) return 'tough';
      return 'normal';
    }

    function pickPopThreshold(type: BalloonType): number {
      const t = elapsed / timeLimit;
      let min: number, max: number;
      if (t < 0.22) { min = 0.6; max = 0.9; }
      else if (t < 0.55) { min = 0.4; max = 0.8; }
      else if (t < 0.88) { min = 0.3; max = 0.7; }
      else { min = 0.25; max = 0.6; }
      if (type === 'golden') { min *= 0.7; max *= 0.7; }
      if (type === 'tough') { min *= 1.2; max = Math.min(0.95, max * 1.2); }
      return min + rng() * (max - min);
    }

    function randomBalloonPos(): { x: number; y: number } {
      const margin = 70;
      const topMargin = 80; // avoid HUD
      const bottomMargin = 90; // avoid lives
      for (let attempt = 0; attempt < 20; attempt++) {
        const x = margin + rng() * (CANVAS_SIZE - margin * 2);
        const y = topMargin + rng() * (CANVAS_SIZE - topMargin - bottomMargin);
        // Check distance from existing active balloons
        const tooClose = balloons.some(b => {
          if (b.banked) return false;
          const dx = b.x - x;
          const dy = b.y - y;
          return Math.sqrt(dx * dx + dy * dy) < 100;
        });
        if (!tooClose) return { x, y };
      }
      // Fallback: center-ish
      return { x: CANVAS_SIZE / 2 + (rng() - 0.5) * 100, y: CANVAS_SIZE / 2 };
    }

    function spawnBalloon(x: number, y: number): Balloon {
      const type = pickType();
      const patience = getPatience();
      const scale = new SpringValue({ stiffness: 200, damping: 8 });
      scale.snap(0);
      scale.target = 1;
      const b: Balloon = {
        id: nextId++,
        type,
        popThreshold: pickPopThreshold(type),
        inflateProgress: 0,
        x, y,
        patienceTimer: patience,
        maxPatience: patience,
        scale,
        wobblePhase: rng() * Math.PI * 2,
        banked: false,
        bankedTimer: 0,
        opacity: 1,
      };
      return b;
    }

    function ensureBalloons() {
      // Remove fully banked (float-up done)
      for (let i = balloons.length - 1; i >= 0; i--) {
        if (balloons[i].banked && balloons[i].bankedTimer <= 0) {
          balloons.splice(i, 1);
        }
      }

      const targetCount = getSlotCount();
      const activeBalloons = balloons.filter(b => !b.banked);

      // Spawn balloons at random positions to fill gaps
      while (activeBalloons.length < targetCount) {
        const pos = activeBalloons.length === 0 && elapsed < 2000
          ? { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 + 10 } // first balloon: center
          : randomBalloonPos();
        const b = spawnBalloon(pos.x, pos.y);
        balloons.push(b);
        activeBalloons.push(b);
      }
    }

    function bankBalloon(b: Balloon) {
      const value = Math.floor(b.inflateProgress * 100 * getValueMultiplier(b.type));
      const isPerfect = b.popThreshold - b.inflateProgress < 0.05 &&
                        b.inflateProgress < b.popThreshold;

      score += value;
      if (streak >= 5) score += 10;
      balloonsBanked++;
      streak++;

      // Bank VFX
      floatingText.emit({
        text: `+${value}`,
        x: b.x, y: b.y - 60,
        color: colors.gold, fontSize: 20, duration: 800,
      });
      particles.emit({
        count: 8,
        position: { x: b.x, y: b.y },
        velocity: { min: 40, max: 100 },
        angle: { min: -Math.PI, max: 0 },
        lifetime: { min: 400, max: 700 },
        size: { start: 3, end: 0 },
        color: colors.gold,
        opacity: { start: 1, end: 0 },
        gravity: -20,
      });

      if (isPerfect) {
        perfectBanks++;
        score += 50;
        slowMo.trigger(0.5, 200);
        floatingText.emit({
          text: 'NERVES OF STEEL',
          x: b.x, y: b.y - 100,
          color: colors.gold, fontSize: 16, duration: 1200,
        });
        pulseRings.emit({
          x: b.x, y: b.y,
          color: colors.gold, maxRadius: 40, duration: 400,
        });
        particles.emit({
          count: 15,
          position: { x: b.x, y: b.y },
          velocity: { min: 60, max: 140 },
          angle: { min: 0, max: Math.PI * 2 },
          lifetime: { min: 500, max: 900 },
          size: { start: 4, end: 0 },
          color: [colors.gold, colors.orange],
          opacity: { start: 1, end: 0 },
        });
      }

      // Start float-up
      b.banked = true;
      b.bankedTimer = 800;
      b.scale.target = 0.4;
      holdingId = null;
      holdTime = 0;
    }

    function popBalloon(b: Balloon) {
      lives--;
      balloonsPopped++;
      streak = 0;

      const balloonColor = getBalloonColor(b.type, colors);
      const r = BALLOON_MIN_RADIUS + b.inflateProgress * (BALLOON_MAX_RADIUS - BALLOON_MIN_RADIUS);

      shake.trigger({ intensity: 10, duration: 300 });
      flash.trigger(colors.danger, 200);
      pulseRings.emit({
        x: b.x, y: b.y,
        color: balloonColor, maxRadius: 50, duration: 300,
      });
      particles.emit({
        count: 30,
        position: { x: b.x, y: b.y },
        velocity: { min: 80, max: 250 },
        angle: { min: 0, max: Math.PI * 2 },
        lifetime: { min: 500, max: 1000 },
        size: { start: 5, end: 1 },
        color: [balloonColor, colors.danger, colors.pink],
        opacity: { start: 1, end: 0 },
        gravity: 200,
      });
      debris.emit({
        pieces: Array.from({ length: 6 }, () => ({
          x: b.x + (rng() - 0.5) * r,
          y: b.y + (rng() - 0.5) * r,
          width: 6 + rng() * 8,
          height: 4 + rng() * 6,
        })),
        color: balloonColor,
        gravity: 300,
        rotationSpeed: { min: 2, max: 8 },
        fadeDelay: 200,
        fadeDuration: 400,
      });
      floatingText.emit({
        text: 'POP!',
        x: b.x, y: b.y - 60,
        color: colors.danger, fontSize: 24, duration: 600,
      });

      if (holdingId === b.id) {
        holdingId = null;
        holdTime = 0;
      }

      // Remove balloon
      const idx = balloons.indexOf(b);
      if (idx >= 0) balloons.splice(idx, 1);

      if (lives <= 0) {
        gameOver = true;
        onResult({ score, balloonsBanked, balloonsPopped, perfectBanks });
      }
    }

    // --- Input ---
    function getCanvasPos(e: PointerEvent): { x: number; y: number } {
      const rect = canvas!.getBoundingClientRect();
      const scale = CANVAS_SIZE / rect.width;
      return {
        x: (e.clientX - rect.left) * scale,
        y: (e.clientY - rect.top) * scale,
      };
    }

    function hitTestBalloon(px: number, py: number): Balloon | null {
      // Find closest active (non-banked) balloon within touch range
      let best: Balloon | null = null;
      let bestDist = Infinity;
      for (const b of balloons) {
        if (b.banked) continue;
        const r = BALLOON_MIN_RADIUS + b.inflateProgress * (BALLOON_MAX_RADIUS - BALLOON_MIN_RADIUS);
        const hitR = Math.max(r + 20, 48); // generous touch target
        const dx = px - b.x;
        const dy = py - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < hitR && dist < bestDist) {
          bestDist = dist;
          best = b;
        }
      }
      return best;
    }

    function handlePointerDown(e: PointerEvent) {
      if (gameOver) return;
      e.preventDefault();

      const activeBalloons = balloons.filter(b => !b.banked);
      if (activeBalloons.length === 1) {
        // Single balloon: hold anywhere to inflate (like original)
        holdingId = activeBalloons[0].id;
        holdTime = 0;
        return;
      }

      // Multi-balloon: tap on a specific balloon
      const pos = getCanvasPos(e);
      const hit = hitTestBalloon(pos.x, pos.y);
      if (hit) {
        holdingId = hit.id;
        holdTime = 0;
      }
    }

    function handlePointerUp(e: PointerEvent) {
      if (gameOver || holdingId === null) return;
      e.preventDefault();
      const b = balloons.find(b2 => b2.id === holdingId);
      if (b && !b.banked && holdTime >= MIN_HOLD_MS) {
        bankBalloon(b);
      } else {
        holdingId = null;
        holdTime = 0;
      }
    }

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerUp);

    // --- Init ---
    ensureBalloons();

    // --- Game loop ---
    let lastTime = performance.now();
    let animId: number;

    function loop(now: number) {
      const rawDt = Math.min(now - lastTime, 50);
      lastTime = now;
      const dt = slowMo.update(rawDt);
      elapsed += rawDt;

      if (elapsed >= timeLimit && !gameOver) {
        gameOver = true;
        onResult({ score, balloonsBanked, balloonsPopped, perfectBanks });
      }

      if (gameOver) {
        particles.update(dt);
        shake.update(dt);
        flash.update(dt);
        debris.update(dt);
        floatingText.update(dt);
        drawFrame(ctx, dt);
        if (particles.activeCount > 0) {
          animId = requestAnimationFrame(loop);
        }
        return;
      }

      // Inflate held balloon
      if (holdingId !== null) {
        holdTime += rawDt;
        const b = balloons.find(b2 => b2.id === holdingId);
        if (b && !b.banked && holdTime >= MIN_HOLD_MS) {
          const inflateSpeed = 0.4;
          b.inflateProgress = Math.min(1, b.inflateProgress + inflateSpeed * (dt / 1000));
          if (b.inflateProgress >= b.popThreshold) {
            holdingId = null;
            popBalloon(b);
          }
        }
      }

      // Update patience timers for non-held active balloons
      for (const b of balloons) {
        if (b.banked || b.id === holdingId) continue;
        if (b.maxPatience < 90000) { // only tick patience in multi-balloon mode
          b.patienceTimer -= rawDt;
          if (b.patienceTimer <= 0) {
            popBalloon(b);
            if (gameOver) break;
          }
        }
      }

      // Update banked balloon float-ups
      for (const b of balloons) {
        if (!b.banked) continue;
        b.bankedTimer -= rawDt;
        b.y -= dt * 0.15; // float up
        b.scale.update(dt);
        b.opacity = Math.max(0, b.bankedTimer / 800);
      }

      // Ensure slots are filled
      if (!gameOver) ensureBalloons();

      // Update VFX
      for (const b of balloons) {
        b.wobblePhase += dt * 0.008;
        b.scale.update(dt);
      }
      particles.update(dt);
      shake.update(dt);
      flash.update(dt);
      pulseRings.update(dt);
      floatingText.update(dt);
      debris.update(dt);

      drawFrame(ctx, dt);
      animId = requestAnimationFrame(loop);
    }

    function drawFrame(ctx: CanvasRenderingContext2D, _dt: number) {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      shake.apply(ctx);

      // Background
      const grad = ctx.createRadialGradient(
        CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0,
        CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE * 0.7,
      );
      grad.addColorStop(0, withAlpha(colors.bgSubtle, 0.3));
      grad.addColorStop(1, colors.bg);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Draw each balloon
      for (const b of balloons) {
        drawSingleBalloon(ctx, b);
      }

      // Debris
      debris.draw(ctx);
      particles.draw(ctx);
      pulseRings.draw(ctx);
      floatingText.draw(ctx);

      // HUD
      drawHUD(ctx);

      flash.draw(ctx, CANVAS_SIZE, CANVAS_SIZE);
      shake.restore(ctx);
    }

    function drawSingleBalloon(ctx: CanvasRenderingContext2D, b: Balloon) {
      const r = BALLOON_MIN_RADIUS + b.inflateProgress * (BALLOON_MAX_RADIUS - BALLOON_MIN_RADIUS);
      const scale = b.scale.value;
      const balloonColor = getBalloonColor(b.type, colors);
      const isHeld = b.id === holdingId;

      ctx.save();
      ctx.globalAlpha = b.banked ? b.opacity : 1;

      // Danger proximity
      const dangerProximity = b.popThreshold > 0 ? b.inflateProgress / b.popThreshold : 0;
      const wobbleAmp = dangerProximity > 0.7 ? (dangerProximity - 0.7) / 0.3 * 4 : 0;
      const wobbleX = Math.sin(b.wobblePhase * 5) * wobbleAmp;
      const wobbleY = Math.cos(b.wobblePhase * 3.7) * wobbleAmp * 0.6;
      const jitter = dangerProximity > 0.85 ? (rng() - 0.5) * 3 * ((dangerProximity - 0.85) / 0.15) : 0;

      const drawR = r * scale + jitter;
      const cx = b.x + wobbleX;
      const cy = b.y + wobbleY;

      // Balloon shadow
      if (!b.banked) {
        ctx.globalAlpha = 0.04;
        ctx.fillStyle = colors.textDim;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 80, drawR * 0.3, drawR * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = b.banked ? b.opacity : 1;
      }

      ctx.save();
      ctx.translate(cx, cy);

      // Balloon body
      const glowSize = isHeld ? 15 : (b.type === 'golden' ? 12 : 8);
      drawWithGlow(ctx, balloonColor, glowSize, () => {
        ctx.beginPath();
        ctx.ellipse(0, 0, drawR * 0.85, drawR, 0, 0, Math.PI * 2);
        ctx.fillStyle = balloonColor;
        ctx.fill();
      });

      // Specular highlight
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-drawR * 0.25, -drawR * 0.3, drawR * 0.15, drawR * 0.3, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = b.banked ? b.opacity : 1;

      // Stretch marks near threshold
      if (dangerProximity > 0.7 && !b.banked) {
        const markOpacity = (dangerProximity - 0.7) / 0.3 * 0.3;
        ctx.globalAlpha = markOpacity;
        ctx.strokeStyle = withAlpha('#ffffff', 0.5);
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const angle = (i / 3) * Math.PI * 2 + b.wobblePhase * 0.5;
          const startR2 = drawR * 0.5;
          const endR = drawR * 0.8;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * startR2 * 0.85, Math.sin(angle) * startR2);
          ctx.quadraticCurveTo(
            Math.cos(angle + 0.1) * (startR2 + endR) * 0.5 * 0.85,
            Math.sin(angle + 0.1) * (startR2 + endR) * 0.5,
            Math.cos(angle + 0.2) * endR * 0.85,
            Math.sin(angle + 0.2) * endR,
          );
          ctx.stroke();
        }
        ctx.globalAlpha = b.banked ? b.opacity : 1;
      }

      // Balloon tie
      ctx.fillStyle = balloonColor;
      ctx.beginPath();
      ctx.moveTo(-3, drawR);
      ctx.lineTo(3, drawR);
      ctx.lineTo(0, drawR + 8);
      ctx.closePath();
      ctx.fill();

      // String
      ctx.strokeStyle = colors.textDim;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      const stringWobble = Math.sin(b.wobblePhase * 2) * 2;
      ctx.beginPath();
      ctx.moveTo(0, drawR + 8);
      ctx.quadraticCurveTo(stringWobble, drawR + 30, -stringWobble * 0.5, drawR + 50);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.restore();

      // Patience timer ring (multi-balloon mode only)
      if (!b.banked && b.maxPatience < 90000) {
        const frac = b.patienceTimer / b.maxPatience;
        const timerColor = frac > 0.5 ? colors.green : frac > 0.2 ? colors.gold : colors.danger;
        ctx.beginPath();
        ctx.arc(cx, cy, drawR + 8, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.strokeStyle = timerColor;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Pulse when low
        if (frac < 0.3) {
          const pulse = 0.3 + Math.sin(elapsed * 0.015) * 0.3;
          ctx.beginPath();
          ctx.arc(cx, cy, drawR + 12, 0, Math.PI * 2);
          ctx.strokeStyle = withAlpha(colors.danger, pulse);
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Type label
      if (b.type !== 'normal' && !b.banked) {
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = getBalloonColor(b.type, colors);
        ctx.globalAlpha = 0.6;
        const label = b.type === 'golden' ? '2x' : '1.5x';
        ctx.fillText(label, cx, cy + drawR + 20);
        ctx.globalAlpha = 1;
      }

      // Golden shimmer
      if (b.type === 'golden' && isHeld && b.inflateProgress > 0.1 && !b.banked) {
        const shimmerAngle = b.wobblePhase * 3;
        const sx = cx + Math.cos(shimmerAngle) * drawR * 0.7;
        const sy = cy + Math.sin(shimmerAngle) * drawR * 0.6;
        if (Math.random() < 0.3) {
          particles.emit({
            count: 1,
            position: { x: sx, y: sy },
            velocity: { min: 10, max: 30 },
            angle: { min: 0, max: Math.PI * 2 },
            lifetime: { min: 300, max: 500 },
            size: { start: 2, end: 0 },
            color: colors.gold,
            opacity: { start: 0.8, end: 0 },
          });
        }
      }

      ctx.restore();
    }

    function drawHUD(ctx: CanvasRenderingContext2D) {
      // Score
      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = colors.text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.globalAlpha = 0.8;
      ctx.fillText(`${score}`, 16, 16);
      ctx.globalAlpha = 1;

      // Lives
      for (let i = 0; i < MAX_LIVES; i++) {
        const x = CANVAS_SIZE / 2 - (MAX_LIVES - 1) * 14 + i * 28;
        const y = CANVAS_SIZE - 30;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        if (i < lives) {
          ctx.fillStyle = colors.green;
          ctx.fill();
        } else {
          ctx.strokeStyle = withAlpha(colors.danger, 0.4);
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Streak
      if (streak >= 3) {
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = colors.gold;
        ctx.textAlign = 'right';
        ctx.globalAlpha = 0.8;
        ctx.fillText(`streak: ${streak}`, CANVAS_SIZE - 16, 16);
        ctx.globalAlpha = 1;
      }

      // Timer
      const remaining = Math.max(0, Math.ceil((timeLimit - elapsed) / 1000));
      ctx.font = '12px monospace';
      ctx.fillStyle = colors.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.globalAlpha = 0.5;
      ctx.fillText(`${remaining}s`, 16, CANVAS_SIZE - 16);
      ctx.globalAlpha = 1;

      // Multi-balloon hint
      if (elapsed > 7000 && elapsed < 10000) {
        const alpha = Math.min(1, (elapsed - 7000) / 1000) * (1 - Math.max(0, (elapsed - 9000) / 1000));
        if (alpha > 0) {
          ctx.font = 'bold 14px monospace';
          ctx.fillStyle = colors.gold;
          ctx.textAlign = 'center';
          ctx.globalAlpha = alpha * 0.7;
          ctx.fillText('TAP a balloon to inflate it!', CANVAS_SIZE / 2, 50);
          ctx.globalAlpha = 1;
        }
      }
    }

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerUp);
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
