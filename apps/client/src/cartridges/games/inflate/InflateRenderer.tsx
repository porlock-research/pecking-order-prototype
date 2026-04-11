import { useEffect, useRef } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import {
  mulberry32, lerp,
  ParticleEmitter, ScreenShake, ScreenFlash, PulseRingEmitter,
  SlowMo, FloatingTextEmitter, SpringValue, DebrisEmitter, drawWithGlow,
} from '../shared/canvas-vfx';
import { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';

const CANVAS_SIZE = 400;
const CENTER = CANVAS_SIZE / 2;
const MAX_LIVES = Config.game.inflate.maxLives;
const MIN_HOLD_MS = 300;

const BALLOON_MAX_RADIUS = 100;
const BALLOON_MIN_RADIUS = 20;

type BalloonType = 'normal' | 'golden' | 'tough';

interface BalloonState {
  type: BalloonType;
  popThreshold: number; // 0-1 fraction of max inflation
  inflateProgress: number; // 0-1 current inflation
  holdStartTime: number | null;
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

function pickBalloonType(rng: () => number, elapsed: number, timeLimit: number): BalloonType {
  const t = elapsed / timeLimit;
  const goldenChance = t < 0.25 ? 0 : t < 0.55 ? 0.2 : t < 0.88 ? 0.3 : 0.4;
  const toughChance = 0.2;
  const r = rng();
  if (r < goldenChance) return 'golden';
  if (r < goldenChance + toughChance) return 'tough';
  return 'normal';
}

function pickPopThreshold(rng: () => number, type: BalloonType, elapsed: number, timeLimit: number): number {
  const t = elapsed / timeLimit;
  // Ranges narrow as game progresses
  let min: number, max: number;
  if (t < 0.22) { min = 0.6; max = 0.9; }
  else if (t < 0.55) { min = 0.4; max = 0.8; }
  else if (t < 0.88) { min = 0.3; max = 0.7; }
  else { min = 0.25; max = 0.6; }

  // Type adjustments
  if (type === 'golden') { min *= 0.7; max *= 0.7; }
  if (type === 'tough') { min *= 1.2; max = Math.min(0.95, max * 1.2); }

  return min + rng() * (max - min);
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
    let holding = false;
    let holdTime = 0;

    // --- Current balloon ---
    let balloon: BalloonState = {
      type: pickBalloonType(rng, 0, timeLimit),
      popThreshold: 0,
      inflateProgress: 0,
      holdStartTime: null,
    };
    balloon.popThreshold = pickPopThreshold(rng, balloon.type, 0, timeLimit);

    // --- VFX ---
    const particles = new ParticleEmitter();
    const shake = new ScreenShake();
    const flash = new ScreenFlash();
    const pulseRings = new PulseRingEmitter();
    const slowMo = new SlowMo();
    const floatingText = new FloatingTextEmitter();
    const debris = new DebrisEmitter();

    const balloonScale = new SpringValue({ stiffness: 200, damping: 8 });
    balloonScale.snap(0);
    balloonScale.target = 1;

    const wobblePhase = { value: 0 };

    // --- Balloon management ---
    function spawnBalloon() {
      balloon = {
        type: pickBalloonType(rng, elapsed, timeLimit),
        popThreshold: 0,
        inflateProgress: 0,
        holdStartTime: null,
      };
      balloon.popThreshold = pickPopThreshold(rng, balloon.type, elapsed, timeLimit);
      balloonScale.snap(0);
      balloonScale.target = 1;
      holdTime = 0;
    }

    function bankBalloon() {
      const value = Math.floor(balloon.inflateProgress * 100 * getValueMultiplier(balloon.type));
      const isPerfect = balloon.popThreshold - balloon.inflateProgress < 0.05 &&
                        balloon.inflateProgress < balloon.popThreshold;

      score += value;
      if (streak >= 5) score += 10;
      balloonsBanked++;
      streak++;

      // Bank VFX
      floatingText.emit({
        text: `+${value}`,
        x: CENTER, y: CENTER - 60,
        color: colors.gold, fontSize: 20, duration: 800,
      });
      particles.emit({
        count: 8,
        position: { x: CENTER, y: CENTER },
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
          x: CENTER, y: CENTER - 100,
          color: colors.gold, fontSize: 16, duration: 1200,
        });
        pulseRings.emit({
          x: CENTER, y: CENTER,
          color: colors.gold, maxRadius: 40, duration: 400,
        });
        particles.emit({
          count: 15,
          position: { x: CENTER, y: CENTER },
          velocity: { min: 60, max: 140 },
          angle: { min: 0, max: Math.PI * 2 },
          lifetime: { min: 500, max: 900 },
          size: { start: 4, end: 0 },
          color: [colors.gold, colors.orange],
          opacity: { start: 1, end: 0 },
        });
      }

      spawnBalloon();
    }

    function popBalloon() {
      lives--;
      balloonsPopped++;
      streak = 0;

      const balloonColor = getBalloonColor(balloon.type, colors);

      // Pop VFX — explosive
      shake.trigger({ intensity: 10, duration: 300 });
      flash.trigger(colors.danger, 200);
      pulseRings.emit({
        x: CENTER, y: CENTER,
        color: balloonColor, maxRadius: 50, duration: 300,
      });
      particles.emit({
        count: 30,
        position: { x: CENTER, y: CENTER },
        velocity: { min: 80, max: 250 },
        angle: { min: 0, max: Math.PI * 2 },
        lifetime: { min: 500, max: 1000 },
        size: { start: 5, end: 1 },
        color: [balloonColor, colors.danger, colors.pink],
        opacity: { start: 1, end: 0 },
        gravity: 200,
      });

      // Debris fragments
      const r = BALLOON_MIN_RADIUS + balloon.inflateProgress * (BALLOON_MAX_RADIUS - BALLOON_MIN_RADIUS);
      debris.emit({
        pieces: Array.from({ length: 6 }, () => ({
          x: CENTER + (rng() - 0.5) * r,
          y: CENTER + (rng() - 0.5) * r,
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
        x: CENTER, y: CENTER - 60,
        color: colors.danger, fontSize: 24, duration: 600,
      });

      if (lives <= 0) {
        gameOver = true;
        onResult({ score, balloonsBanked, balloonsPopped, perfectBanks });
        return;
      }

      spawnBalloon();
    }

    // --- Input ---
    function handlePointerDown(e: PointerEvent) {
      if (gameOver) return;
      e.preventDefault();
      holding = true;
      holdTime = 0;
    }

    function handlePointerUp(e: PointerEvent) {
      if (gameOver || !holding) return;
      e.preventDefault();
      holding = false;
      if (holdTime < MIN_HOLD_MS) return; // too short, ignore
      bankBalloon();
    }

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerUp);

    // --- Game loop ---
    let lastTime = performance.now();
    let animId: number;

    function loop(now: number) {
      const rawDt = Math.min(now - lastTime, 50); // cap at 50ms
      lastTime = now;
      const dt = slowMo.update(rawDt);
      elapsed += rawDt;

      if (elapsed >= timeLimit && !gameOver) {
        gameOver = true;
        onResult({ score, balloonsBanked, balloonsPopped, perfectBanks });
      }

      if (gameOver) {
        // Keep rendering VFX for a moment
        particles.update(dt);
        shake.update(dt);
        flash.update(dt);
        debris.update(dt);
        floatingText.update(dt);
        drawFrame(ctx, dt);
        if (particles.activeCount > 0 || debris !== null) {
          animId = requestAnimationFrame(loop);
        }
        return;
      }

      // Inflate while holding
      if (holding) {
        holdTime += rawDt;
        if (holdTime >= MIN_HOLD_MS) {
          const inflateSpeed = 0.4; // per second at full speed
          balloon.inflateProgress = Math.min(1, balloon.inflateProgress + inflateSpeed * (dt / 1000));

          // Check pop
          if (balloon.inflateProgress >= balloon.popThreshold) {
            holding = false;
            popBalloon();
          }
        }
      }

      // Update VFX
      wobblePhase.value += dt * 0.008;
      balloonScale.update(dt);
      particles.update(dt);
      shake.update(dt);
      flash.update(dt);
      pulseRings.update(dt);
      slowMo.update(0); // already applied above
      floatingText.update(dt);
      debris.update(dt);

      drawFrame(ctx, dt);
      animId = requestAnimationFrame(loop);
    }

    function drawFrame(ctx: CanvasRenderingContext2D, _dt: number) {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      shake.apply(ctx);

      // Background
      const grad = ctx.createRadialGradient(CENTER, CENTER, 0, CENTER, CENTER, CANVAS_SIZE * 0.7);
      grad.addColorStop(0, withAlpha(colors.bgSubtle, 0.3));
      grad.addColorStop(1, colors.bg);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Balloon shadow
      if (!gameOver || balloon.inflateProgress > 0) {
        const r = BALLOON_MIN_RADIUS + balloon.inflateProgress * (BALLOON_MAX_RADIUS - BALLOON_MIN_RADIUS);
        const scale = balloonScale.value;
        const shadowR = r * scale * 0.4;
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = colors.textDim;
        ctx.beginPath();
        ctx.ellipse(CENTER, CENTER + 140, shadowR, shadowR * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Balloon
      if (!gameOver || balloon.inflateProgress > 0) {
        drawBalloon(ctx);
      }

      // Debris
      debris.draw(ctx);

      // Particles
      particles.draw(ctx);

      // Pulse rings
      pulseRings.draw(ctx);

      // Floating text
      floatingText.draw(ctx);

      // HUD
      drawHUD(ctx);

      // Flash overlay
      flash.draw(ctx, CANVAS_SIZE, CANVAS_SIZE);

      shake.restore(ctx);
    }

    function drawBalloon(ctx: CanvasRenderingContext2D) {
      const r = BALLOON_MIN_RADIUS + balloon.inflateProgress * (BALLOON_MAX_RADIUS - BALLOON_MIN_RADIUS);
      const scale = balloonScale.value;
      const balloonColor = getBalloonColor(balloon.type, colors);

      // Danger wobble
      const dangerProximity = balloon.popThreshold > 0
        ? balloon.inflateProgress / balloon.popThreshold
        : 0;
      const wobbleAmp = dangerProximity > 0.7
        ? (dangerProximity - 0.7) / 0.3 * 4
        : 0;
      const wobbleX = Math.sin(wobblePhase.value * 5) * wobbleAmp;
      const wobbleY = Math.cos(wobblePhase.value * 3.7) * wobbleAmp * 0.6;

      // Size jitter near threshold
      const jitter = dangerProximity > 0.85
        ? (rng() - 0.5) * 3 * ((dangerProximity - 0.85) / 0.15)
        : 0;

      const drawR = r * scale + jitter;
      const cx = CENTER + wobbleX;
      const cy = CENTER + wobbleY;

      ctx.save();
      ctx.translate(cx, cy);

      // Balloon body (ellipse, taller than wide)
      drawWithGlow(ctx, balloonColor, balloon.type === 'golden' ? 15 : 8, () => {
        ctx.beginPath();
        ctx.ellipse(0, 0, drawR * 0.85, drawR, 0, 0, Math.PI * 2);
        ctx.fillStyle = balloonColor;
        ctx.fill();
      });

      // Specular highlight
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-drawR * 0.25, -drawR * 0.3, drawR * 0.2, drawR * 0.35, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Stretch marks near threshold
      if (dangerProximity > 0.7) {
        const markOpacity = (dangerProximity - 0.7) / 0.3 * 0.3;
        ctx.globalAlpha = markOpacity;
        ctx.strokeStyle = withAlpha('#ffffff', 0.5);
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const angle = (i / 3) * Math.PI * 2 + wobblePhase.value * 0.5;
          const startR = drawR * 0.5;
          const endR = drawR * 0.8;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * startR * 0.85, Math.sin(angle) * startR);
          ctx.quadraticCurveTo(
            Math.cos(angle + 0.1) * (startR + endR) * 0.5 * 0.85,
            Math.sin(angle + 0.1) * (startR + endR) * 0.5,
            Math.cos(angle + 0.2) * endR * 0.85,
            Math.sin(angle + 0.2) * endR,
          );
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Balloon tie (bottom)
      ctx.fillStyle = balloonColor;
      ctx.beginPath();
      ctx.moveTo(-4, drawR);
      ctx.lineTo(4, drawR);
      ctx.lineTo(0, drawR + 10);
      ctx.closePath();
      ctx.fill();

      // String
      ctx.strokeStyle = colors.textDim;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      const stringWobble = Math.sin(wobblePhase.value * 2) * 3;
      ctx.beginPath();
      ctx.moveTo(0, drawR + 10);
      ctx.quadraticCurveTo(stringWobble, drawR + 40, -stringWobble * 0.5, drawR + 60);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.restore();

      // Golden shimmer particles
      if (balloon.type === 'golden' && holding && balloon.inflateProgress > 0.1) {
        const shimmerAngle = wobblePhase.value * 3;
        const sx = cx + Math.cos(shimmerAngle) * drawR * 0.85 * 0.7;
        const sy = cy + Math.sin(shimmerAngle) * drawR * 0.7;
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
    }

    function drawHUD(ctx: CanvasRenderingContext2D) {
      // Score (top-left)
      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = colors.text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.globalAlpha = 0.8;
      ctx.fillText(`${score}`, 16, 16);
      ctx.globalAlpha = 1;

      // Lives (bottom-center)
      for (let i = 0; i < MAX_LIVES; i++) {
        const x = CENTER - (MAX_LIVES - 1) * 14 + i * 28;
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

      // Streak (top-right)
      if (streak >= 3) {
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = colors.gold;
        ctx.textAlign = 'right';
        ctx.globalAlpha = 0.8;
        ctx.fillText(`streak: ${streak}`, CANVAS_SIZE - 16, 16);
        ctx.globalAlpha = 1;
      }

      // Timer (bottom-left)
      const remaining = Math.max(0, Math.ceil((timeLimit - elapsed) / 1000));
      ctx.font = '12px monospace';
      ctx.fillStyle = colors.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.globalAlpha = 0.5;
      ctx.fillText(`${remaining}s`, 16, CANVAS_SIZE - 16);
      ctx.globalAlpha = 1;

      // Balloon type indicator
      if (balloon.type !== 'normal') {
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = getBalloonColor(balloon.type, colors);
        ctx.globalAlpha = 0.7;
        const label = balloon.type === 'golden' ? '2x GOLDEN' : '1.5x TOUGH';
        ctx.fillText(label, CENTER, 50);
        ctx.globalAlpha = 1;
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
