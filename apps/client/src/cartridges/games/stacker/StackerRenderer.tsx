import { useRef, useCallback, useEffect } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';
import {
  ParticleEmitter, ScreenShake,
  drawWithGlow, ScreenFlash, PulseRingEmitter,
  SlowMo, FloatingTextEmitter, SpringValue, DebrisEmitter,
} from '../shared/canvas-vfx';

const CANVAS_WIDTH = 280;
const CANVAS_HEIGHT = 360;
const BLOCK_HEIGHT = 16;
const BASE_SPEED = 80; // px/sec
const SPEED_INCREASE = 12; // px/sec per layer
const INITIAL_WIDTH = 100;
const PERFECT_THRESHOLD = 2; // px

const px = (v: number) => Math.round(v);

// Height milestones — fire slow-mo + callout on crossing
const MILESTONES: { height: number; text: string }[] = [
  { height: 5,  text: 'RISING' },
  { height: 10, text: 'TOWER' },
  { height: 20, text: 'SKYLINE' },
  { height: 40, text: 'TITAN' },
];

// Falling piece from overhang trim or miss
interface FallingPiece {
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number;
  opacity: number;
  hue: number;
}

interface Layer {
  x: number;
  width: number;
  perfect: boolean;
}

export default function StackerRenderer({ seed, onResult }: ArcadeRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useCartridgeTheme(containerRef);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // --- Game state ---
    const layers: Layer[] = [];
    const movingBlock = { x: 0, width: INITIAL_WIDTH, direction: 1, speed: BASE_SPEED };
    let gameOver = false;
    let gameOverTime = 0;
    let resultSent = false;
    const startTime = performance.now();
    let consecutivePerfects = 0;

    // Falling pieces (trimmed overhangs and missed blocks)
    const fallingPieces: FallingPiece[] = [];

    // VFX instances
    const particles = new ParticleEmitter();
    const screenShake = new ScreenShake();
    const screenFlash = new ScreenFlash();
    const pulseRings = new PulseRingEmitter();
    const slowMo = new SlowMo();
    const floatingText = new FloatingTextEmitter();
    const heightSpring = new SpringValue({ stiffness: 220, damping: 14 });
    const topple = new DebrisEmitter();
    const crossedMilestones = new Set<number>();
    let ending = false; // single guard — end-of-game VFX fire exactly once
    let finalHeight = 0;
    let finalPerfects = 0;

    // --- Drop handler ---
    function handleDrop() {
      if (gameOver) return;

      const t = themeRef.current;
      const mb = movingBlock;
      const hue = (layers.length * 15) % 360;
      const stackTop = CANVAS_HEIGHT - layers.length * BLOCK_HEIGHT;
      const cameraY = Math.max(0, (layers.length - 15) * BLOCK_HEIGHT);
      const blockScreenY = stackTop - BLOCK_HEIGHT + cameraY;

      if (layers.length === 0) {
        // First layer — always perfect
        layers.push({ x: mb.x, width: mb.width, perfect: true });
        consecutivePerfects = 1;
        mb.speed = BASE_SPEED + SPEED_INCREASE;
        mb.direction = 1;
        mb.x = 0;

        // Landing particle burst
        emitLandingParticles(mb.x + mb.width / 2, blockScreenY, hue, true);
        return;
      }

      const prev = layers[layers.length - 1];

      // Calculate overlap
      const overlapLeft = Math.max(mb.x, prev.x);
      const overlapRight = Math.min(mb.x + mb.width, prev.x + prev.width);
      const overlapWidth = overlapRight - overlapLeft;

      if (overlapWidth <= 0) {
        // Complete miss — game over + tower topple
        gameOver = true;
        gameOverTime = 0;
        consecutivePerfects = 0;

        // The missed block falls straight down
        fallingPieces.push({
          x: mb.x,
          y: blockScreenY,
          width: mb.width,
          height: BLOCK_HEIGHT - 1,
          vy: 0,
          opacity: 1,
          hue,
        });

        triggerTopple(t);
        sendFinalResult();
        return;
      }

      const perfect = Math.abs(mb.x - prev.x) < PERFECT_THRESHOLD;
      const newWidth = perfect ? prev.width : overlapWidth;
      const newX = perfect ? prev.x : overlapLeft;

      layers.push({ x: newX, width: newWidth, perfect });

      const blockCenterX = newX + newWidth / 2;

      if (perfect) {
        consecutivePerfects++;
        const streak = consecutivePerfects;

        // Perfect VFX — intensity scales with combo
        const ringRadius = 30 + Math.min(streak, 10) * 3;
        const particleCount = 10 + Math.min(streak, 8) * 2;
        const glowOpacity = 0.15 + Math.min(streak, 10) * 0.03;

        pulseRings.emit({
          x: blockCenterX,
          y: blockScreenY + BLOCK_HEIGHT / 2,
          color: t.colors.gold,
          maxRadius: ringRadius,
          duration: 500,
          lineWidth: 2,
        });

        particles.emit({
          count: particleCount,
          position: { x: blockCenterX, y: blockScreenY },
          velocity: { min: 60, max: 140 + streak * 10 },
          angle: { min: -Math.PI * 0.9, max: -Math.PI * 0.1 },
          lifetime: { min: 400, max: 700 },
          size: { start: 3, end: 0.5 },
          color: [t.colors.gold, `hsla(${hue}, 80%, 70%, 1)`],
          opacity: { start: 1, end: 0 },
          gravity: 120,
        });

        screenFlash.trigger(withAlpha(t.colors.gold, glowOpacity), 200);
      } else {
        consecutivePerfects = 0;

        // Overhang slice — spawn falling piece for the trimmed part
        if (mb.x < prev.x) {
          // Overhang on the left
          const trimWidth = prev.x - mb.x;
          fallingPieces.push({
            x: mb.x,
            y: blockScreenY,
            width: trimWidth,
            height: BLOCK_HEIGHT - 1,
            vy: 0,
            opacity: 1,
            hue,
          });
        }
        if (mb.x + mb.width > prev.x + prev.width) {
          // Overhang on the right
          const trimX = prev.x + prev.width;
          const trimWidth = (mb.x + mb.width) - trimX;
          fallingPieces.push({
            x: trimX,
            y: blockScreenY,
            width: trimWidth,
            height: BLOCK_HEIGHT - 1,
            vy: 0,
            opacity: 1,
            hue,
          });
        }

        // Non-perfect landing particles (fewer, layer color)
        emitLandingParticles(blockCenterX, blockScreenY, hue, false);
      }

      // Always emit landing particles for perfect too
      if (perfect) {
        emitLandingParticles(blockCenterX, blockScreenY, hue, false);
      }

      // Set up next block
      const h = layers.length;
      mb.width = newWidth;
      mb.speed = BASE_SPEED + SPEED_INCREASE * h;
      mb.direction = 1;
      mb.x = 0;

      // Bump height-pulse spring
      heightSpring.target = 0.3;

      // Milestone crossings (no slow-mo — reserved for topple)
      for (const m of MILESTONES) {
        if (h === m.height && !crossedMilestones.has(m.height)) {
          crossedMilestones.add(m.height);
          screenShake.trigger({ intensity: 6, duration: 220 });
          screenFlash.trigger(withAlpha(t.colors.gold, 0.25), 140);
          const rx = blockCenterX;
          const ry = blockScreenY + BLOCK_HEIGHT / 2;
          pulseRings.emit({ x: rx, y: ry, color: t.colors.gold, maxRadius: 80, duration: 600, lineWidth: 2 });
          pulseRings.emit({ x: rx, y: ry, color: t.colors.pink, maxRadius: 55, duration: 500, lineWidth: 2 });
          particles.emit({
            count: 35,
            position: { x: rx, y: ry },
            velocity: { min: 90, max: 220 },
            angle: { min: 0, max: Math.PI * 2 },
            lifetime: { min: 450, max: 850 },
            size: { start: 3.2, end: 0.5 },
            color: [t.colors.gold, t.colors.pink, '#ffffff'],
            opacity: { start: 1, end: 0 },
            gravity: 80,
          });
          floatingText.emit({
            text: m.text,
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT / 2 - 20,
            color: t.colors.gold,
            fontSize: 20,
            duration: 950,
            drift: 40,
          });
        }
      }

      // Too narrow to continue
      if (newWidth < 4) {
        gameOver = true;
        gameOverTime = 0;
        triggerTopple(t);
        sendFinalResult();
      }
    }

    // Tower topple — on game over, spawn debris for the top N layers
    function triggerTopple(t: typeof themeRef.current) {
      if (ending) return;
      ending = true;
      // Capture final stats BEFORE we remove layers for the topple
      finalHeight = layers.length;
      finalPerfects = layers.filter(l => l.perfect).length;
      slowMo.trigger(0.35, 500);
      screenShake.trigger({ intensity: 12, duration: 600 });
      screenFlash.trigger(withAlpha(t.colors.danger, 0.35), 350);

      const cameraY = Math.max(0, (layers.length - 15) * BLOCK_HEIGHT);
      const topN = Math.min(layers.length, 8);
      const pieces: { x: number; y: number; width: number; height: number }[] = [];
      for (let i = 0; i < topN; i++) {
        const li = layers.length - 1 - i;
        const layer = layers[li];
        const y = CANVAS_HEIGHT - (li + 1) * BLOCK_HEIGHT + cameraY;
        pieces.push({ x: layer.x, y, width: layer.width, height: BLOCK_HEIGHT - 1 });
      }
      // Remove toppled layers from the stack so they don't draw in-place
      layers.length = Math.max(0, layers.length - topN);
      topple.emit({
        pieces,
        color: withAlpha(t.colors.gold, 0.8),
        gravity: 900,
        initialVelocity: {
          x: { min: -140, max: 140 },
          y: { min: -260, max: -60 },
        },
        rotationSpeed: { min: -8, max: 8 },
        fadeDelay: 400,
        fadeDuration: 600,
      });
      floatingText.emit({
        text: 'TOPPLED!',
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2 - 40,
        color: t.colors.danger,
        fontSize: 22,
        duration: 1300,
        drift: 20,
      });
    }

    function emitLandingParticles(cx: number, y: number, hue: number, isPerfect: boolean) {
      const count = isPerfect ? 8 : 5;
      particles.emit({
        count,
        position: { x: cx, y },
        velocity: { min: 30, max: 80 },
        angle: { min: -Math.PI * 0.85, max: -Math.PI * 0.15 },
        lifetime: { min: 250, max: 450 },
        size: { start: 2, end: 0.5 },
        color: `hsla(${hue}, 80%, 65%, 1)`,
        opacity: { start: 0.8, end: 0 },
        gravity: 100,
      });
    }

    function sendFinalResult() {
      if (resultSent) return;
      resultSent = true;
      // Prefer pre-topple snapshot; fall back to current stack (e.g. too-narrow path before triggerTopple ran)
      const h = finalHeight || layers.length;
      const p = finalPerfects || layers.filter(l => l.perfect).length;
      onResultRef.current({
        height: h,
        perfectLayers: p,
        timeElapsed: Math.floor(performance.now() - startTime),
      });
    }

    // --- Input ---
    function onCanvasClick() {
      handleDrop();
    }
    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      handleDrop();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') {
        e.preventDefault();
        handleDrop();
      }
    }

    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    // --- Render loop ---
    let lastTime = performance.now();
    let animId: number;

    function frame(now: number) {
      const realDt = Math.min(now - lastTime, 50);
      lastTime = now;
      const dtMs = realDt;

      // Slow-mo scales simulation dt only; VFX run at real dt
      const simDtMs = slowMo.update(realDt);
      const simDtSec = simDtMs / 1000;

      const t = themeRef.current;
      const mb = movingBlock;

      // --- Update ---
      if (!gameOver) {
        // Move block
        mb.x += mb.direction * mb.speed * simDtSec;
        if (mb.x + mb.width >= CANVAS_WIDTH) {
          mb.x = CANVAS_WIDTH - mb.width;
          mb.direction = -1;
        }
        if (mb.x <= 0) {
          mb.x = 0;
          mb.direction = 1;
        }
      } else {
        gameOverTime += dtMs;
      }

      // Spring decays back to 0
      heightSpring.target = 0;
      heightSpring.update(dtMs);

      // Update falling pieces (use sim dt — they're part of physics)
      for (let i = fallingPieces.length - 1; i >= 0; i--) {
        const fp = fallingPieces[i];
        fp.vy += 600 * simDtSec; // gravity
        fp.y += fp.vy * simDtSec;
        fp.opacity -= 1.2 * simDtSec; // fade out over ~0.8s
        if (fp.opacity <= 0 || fp.y > CANVAS_HEIGHT + 50) {
          fallingPieces.splice(i, 1);
        }
      }

      // Update VFX (real dt)
      particles.update(dtMs);
      screenShake.update(dtMs);
      screenFlash.update(dtMs);
      pulseRings.update(dtMs);
      floatingText.update(dtMs);
      topple.update(dtMs);

      // --- Draw ---
      ctx.fillStyle = t.colors.bg;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      screenShake.apply(ctx);

      const stackTop = CANVAS_HEIGHT - layers.length * BLOCK_HEIGHT;
      const cameraY = Math.max(0, (layers.length - 15) * BLOCK_HEIGHT);

      // Draw placed layers
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        const y = CANVAS_HEIGHT - (i + 1) * BLOCK_HEIGHT + cameraY;
        if (y > CANVAS_HEIGHT + 20 || y < -20) continue;

        const hue = (i * 15) % 360;
        ctx.fillStyle = layer.perfect
          ? `hsla(${hue}, 80%, 60%, 0.9)`
          : `hsla(${hue}, 60%, 50%, 0.7)`;
        ctx.fillRect(layer.x, y, layer.width, BLOCK_HEIGHT - 1);

        // Top highlight
        ctx.fillStyle = `hsla(${hue}, 80%, 75%, 0.3)`;
        ctx.fillRect(layer.x, y, layer.width, 2);
      }

      // Draw moving block with glow
      if (!gameOver) {
        const y = stackTop - BLOCK_HEIGHT + cameraY;
        const hue = (layers.length * 15) % 360;
        const glowColor = `hsla(${hue}, 80%, 65%, 0.7)`;
        const streakBonus = Math.min(consecutivePerfects, 10);
        const glowBlur = 8 + streakBonus * 2;
        const mbx = px(mb.x);
        const mby = px(y);

        drawWithGlow(ctx, glowColor, glowBlur, () => {
          ctx.fillStyle = `hsla(${hue}, 80%, 65%, 0.95)`;
          ctx.fillRect(mbx, mby, mb.width, BLOCK_HEIGHT - 1);
        });

        // Top highlight
        ctx.fillStyle = `hsla(${hue}, 80%, 80%, 0.4)`;
        ctx.fillRect(mbx, mby, mb.width, 2);
      }

      // Draw falling pieces
      for (const fp of fallingPieces) {
        ctx.globalAlpha = Math.max(0, fp.opacity);
        ctx.fillStyle = `hsla(${fp.hue}, 60%, 50%, 0.8)`;
        ctx.fillRect(fp.x, fp.y, fp.width, fp.height);
        ctx.globalAlpha = 1;
      }

      // Ground line
      ctx.strokeStyle = withAlpha(t.colors.gold, t.opacity.medium);
      ctx.lineWidth = 2;
      const groundY = CANVAS_HEIGHT + cameraY;
      if (groundY <= CANVAS_HEIGHT) {
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(CANVAS_WIDTH, groundY);
        ctx.stroke();
      }

      // VFX layers
      topple.draw(ctx);
      particles.draw(ctx);
      pulseRings.draw(ctx);
      floatingText.draw(ctx);

      screenShake.restore(ctx);

      screenFlash.draw(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);

      // --- HUD (canvas-drawn) ---
      const perfectCount = layers.filter(l => l.perfect).length;

      // Height (top-left) — scales with spring on layer increment
      ctx.font = 'bold 13px monospace';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillStyle = withAlpha(t.colors.text, 0.5);
      ctx.fillText('HT', 10, 10);
      const hScale = 1 + heightSpring.value;
      ctx.save();
      ctx.translate(30, 10);
      ctx.scale(hScale, hScale);
      ctx.fillStyle = withAlpha(t.colors.text, 0.9);
      ctx.fillText(`${layers.length}`, 0, 0);
      ctx.restore();

      // Perfect count (top-right)
      ctx.textAlign = 'right';
      ctx.fillStyle = withAlpha(t.colors.gold, 0.6);
      ctx.fillText(`${perfectCount}`, CANVAS_WIDTH - 10, 10);
      ctx.fillStyle = withAlpha(t.colors.gold, 0.4);
      ctx.fillText('PF ', CANVAS_WIDTH - 10 - ctx.measureText(`${perfectCount}`).width, 10);

      // Combo streak indicator
      if (consecutivePerfects >= 2) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = t.colors.gold;
        ctx.fillText(`${consecutivePerfects}x PERFECT`, CANVAS_WIDTH / 2, 10);
      }

      // Game over summary — floating "TOPPLED!" replaces the title; keep stats only
      if (gameOver) {
        // Delay stats until after topple animation begins to settle
        const statsFade = Math.min(1, Math.max(0, (gameOverTime - 700) / 400));
        if (statsFade > 0) {
          ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * statsFade})`;
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

          ctx.globalAlpha = statsFade;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '12px monospace';
          ctx.fillStyle = withAlpha(t.colors.text, 0.55);
          const displayHeight = finalHeight || layers.length;
          const displayPerfects = finalPerfects || perfectCount;
          ctx.fillText(`Height: ${displayHeight}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);
          if (displayPerfects > 0) {
            ctx.fillStyle = withAlpha(t.colors.gold, 0.65);
            ctx.fillText(`Perfect: ${displayPerfects}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 28);
          }
          ctx.globalAlpha = 1;
          ctx.textBaseline = 'top';
        }

        // Stop loop after death animation completes (topple + floating text)
        if (gameOverTime > 1800) {
          return;
        }
      }

      animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('click', onCanvasClick);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [seed, onResult]);

  useEffect(() => {
    const cleanup = gameLoop();
    return cleanup;
  }, [gameLoop]);

  return (
    <div ref={containerRef} className="px-4 pb-4 space-y-3">
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="rounded-lg border border-[var(--po-border)] cursor-pointer"
          style={{ touchAction: 'none' }}
        />
      </div>

      <p className="text-[10px]  text-[var(--po-text-dim)]/50 text-center">
        Tap / Space to drop. Align blocks to keep stacking.
      </p>
    </div>
  );
}
