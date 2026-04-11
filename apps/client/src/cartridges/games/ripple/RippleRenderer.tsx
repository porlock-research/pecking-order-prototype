import { useEffect, useRef } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import {
  mulberry32, lerp, distance,
  ParticleEmitter, ScreenShake, ScreenFlash, PulseRingEmitter,
  SlowMo, FloatingTextEmitter, WavePool, SpringValue, drawWithGlow,
} from '../shared/canvas-vfx';
import { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';

const CANVAS_SIZE = 400;
const CENTER = CANVAS_SIZE / 2;
const MAX_STONES = Config.game.ripple.maxStones;
const TARGET_COUNT = 5;
const CANCEL_RADIUS = 40;
const AMPLIFY_WINDOW_MS = 200;

const TARGET_VALUES = [10, 20, 30] as const;

interface Target {
  x: number;
  y: number;
  value: number;
  color: string;
  bob: SpringValue;
  alive: boolean;
  lastHitTime: number;
  lastHitSourceId: number;
}

function targetColor(value: number, colors: Record<string, string>): string {
  if (value >= 30) return colors.pink;
  if (value >= 20) return colors.gold;
  return colors.info;
}

export default function RippleRenderer({ seed, difficulty, timeLimit, onResult }: ArcadeRendererProps) {
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
    let stonesUsed = 0;
    let amplifies = 0;
    let combo = 0;
    let lastHitTime = -9999;
    let elapsed = 0;
    let gameOver = false;
    let sourceIdCounter = 0;

    // --- VFX ---
    const particles = new ParticleEmitter();
    const shake = new ScreenShake();
    const flash = new ScreenFlash();
    const pulseRings = new PulseRingEmitter();
    const slowMo = new SlowMo();
    const floatingText = new FloatingTextEmitter();
    const wavePool = new WavePool();

    // --- Targets ---
    const targets: Target[] = [];

    function spawnTarget() {
      const margin = 40;
      let x: number, y: number;
      // Find position not too close to existing targets
      let attempts = 0;
      do {
        x = margin + rng() * (CANVAS_SIZE - margin * 2);
        y = margin + rng() * (CANVAS_SIZE - margin * 2);
        attempts++;
      } while (
        attempts < 20 &&
        targets.some(t => t.alive && distance(x, y, t.x, t.y) < 60)
      );

      // Higher-value targets at higher difficulty/time
      const t = elapsed / timeLimit;
      const valueRoll = rng();
      let value: number;
      if (t > 0.7 && valueRoll < 0.3) value = 30;
      else if (t > 0.3 && valueRoll < 0.4 + difficulty * 0.2) value = 20;
      else value = 10;

      const bob = new SpringValue({ stiffness: 40, damping: 3 });
      bob.snap(0);
      bob.target = 1;

      targets.push({
        x, y, value,
        color: targetColor(value, colors),
        bob, alive: true,
        lastHitTime: -9999,
        lastHitSourceId: -1,
      });
    }

    // Initial targets
    for (let i = 0; i < TARGET_COUNT; i++) spawnTarget();

    // --- Background noise positions (static, seeded) ---
    const noiseParticles: { x: number; y: number; o: number }[] = [];
    for (let i = 0; i < 60; i++) {
      noiseParticles.push({
        x: rng() * CANVAS_SIZE,
        y: rng() * CANVAS_SIZE,
        o: 0.01 + rng() * 0.03,
      });
    }

    // --- Wave source tracking for cancel/amplify ---
    const recentSources: { id: number; x: number; y: number; time: number }[] = [];

    // --- Drift state for targets ---
    const driftAngles: number[] = [];
    const driftSpeeds: number[] = [];
    for (let i = 0; i < 20; i++) {
      driftAngles.push(rng() * Math.PI * 2);
      driftSpeeds.push(5 + rng() * 15);
    }

    // --- Input ---
    function handlePointerDown(e: PointerEvent) {
      if (gameOver || stonesUsed >= MAX_STONES || !canvas) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * CANVAS_SIZE;
      const y = (e.clientY - rect.top) / rect.height * CANVAS_SIZE;

      // Cancel check: too close to recent source?
      const tooClose = recentSources.some(s =>
        elapsed - s.time < 2000 && distance(x, y, s.x, s.y) < CANCEL_RADIUS
      );

      if (tooClose) {
        floatingText.emit({
          text: 'TOO CLOSE',
          x, y: y - 20,
          color: colors.danger, fontSize: 12, duration: 500,
          scale: { start: 0.8, peak: 1, end: 0.8 },
        });
        // Still drop the stone but with reduced amplitude
        dropStone(x, y, 0.3);
      } else {
        dropStone(x, y, 1);
      }
    }

    function dropStone(x: number, y: number, ampMult: number) {
      stonesUsed++;
      const id = sourceIdCounter++;

      // Determine wave color — cycle through accents
      const waveColors = [colors.gold, colors.pink, colors.info];
      const waveColor = waveColors[id % waveColors.length];

      wavePool.addSource({
        x, y,
        amplitude: ampMult,
        wavelength: 30,
        speed: 60 + difficulty * 40,
        decay: 0.004,
        color: waveColor,
        maxRadius: CANVAS_SIZE * 0.8,
      });

      recentSources.push({ id, x, y, time: elapsed });
      if (recentSources.length > 10) recentSources.shift();

      // Splash VFX
      particles.emit({
        count: 12,
        position: { x, y },
        velocity: { min: 40, max: 100 },
        angle: { min: -Math.PI, max: 0 },
        lifetime: { min: 200, max: 400 },
        size: { start: 3, end: 0 },
        color: [colors.text, colors.info],
        opacity: { start: 0.8, end: 0 },
        gravity: 100,
      });
      pulseRings.emit({ x, y, color: colors.info, maxRadius: 20, duration: 200 });

      // Last stone warning
      if (stonesUsed === MAX_STONES - 1) {
        floatingText.emit({
          text: 'LAST STONE',
          x: CANVAS_SIZE / 2, y: 30,
          color: colors.danger, fontSize: 14, duration: 1000,
        });
      }
    }

    canvas.addEventListener('pointerdown', handlePointerDown);

    // --- Game loop ---
    let lastTime = performance.now();
    let animId: number;

    function loop(now: number) {
      const rawDt = Math.min(now - lastTime, 50);
      lastTime = now;
      const dt = slowMo.update(rawDt);
      elapsed += rawDt;

      if ((elapsed >= timeLimit || (stonesUsed >= MAX_STONES && wavePool.sourceCount === 0)) && !gameOver) {
        gameOver = true;
        onResult({ score, stonesUsed, amplifies });
      }

      if (gameOver) {
        particles.update(dt);
        shake.update(dt);
        flash.update(dt);
        pulseRings.update(dt);
        floatingText.update(dt);
        wavePool.update(dt);
        drawFrame(ctx);
        if (particles.activeCount > 0 || wavePool.sourceCount > 0) {
          animId = requestAnimationFrame(loop);
        }
        return;
      }

      // Update VFX
      wavePool.update(dt);
      particles.update(dt);
      shake.update(dt);
      flash.update(dt);
      pulseRings.update(dt);
      floatingText.update(dt);

      // Update target bobs
      for (const target of targets) {
        if (target.alive) target.bob.update(dt);
      }

      // Target drift (at higher difficulty / later in game)
      const driftMult = Math.max(0, (elapsed / timeLimit - 0.3) * (1 + difficulty));
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        if (!target.alive) continue;
        const driftIdx = i % driftAngles.length;
        const speed = driftSpeeds[driftIdx] * driftMult;
        target.x += Math.cos(driftAngles[driftIdx]) * speed * (dt / 1000);
        target.y += Math.sin(driftAngles[driftIdx]) * speed * (dt / 1000);
        // Bounce off edges
        if (target.x < 30 || target.x > CANVAS_SIZE - 30) driftAngles[driftIdx] = Math.PI - driftAngles[driftIdx];
        if (target.y < 30 || target.y > CANVAS_SIZE - 30) driftAngles[driftIdx] = -driftAngles[driftIdx];
        target.x = Math.max(20, Math.min(CANVAS_SIZE - 20, target.x));
        target.y = Math.max(20, Math.min(CANVAS_SIZE - 20, target.y));
      }

      // Check wave hits on targets
      for (const target of targets) {
        if (!target.alive) continue;
        const h = wavePool.getHeight(target.x, target.y);
        if (Math.abs(h) < 0.25) continue;

        const waveStrength = Math.min(1, Math.abs(h));
        const baseScore = Math.floor(target.value * waveStrength);

        // Amplify check: was this target hit by a different source recently?
        const now = elapsed;
        let isAmplify = false;
        if (now - target.lastHitTime < AMPLIFY_WINDOW_MS) {
          isAmplify = true;
        }

        if (isAmplify) {
          amplifies++;
          const ampScore = baseScore * 3;
          score += ampScore;

          // Amplify VFX
          pulseRings.emit({ x: target.x, y: target.y, color: colors.gold, maxRadius: 80, duration: 400 });
          flash.trigger(colors.gold, 100);
          slowMo.trigger(0.5, 150);
          floatingText.emit({
            text: `AMPLIFY x3  +${ampScore}`,
            x: target.x, y: target.y - 25,
            color: colors.gold, fontSize: 16, duration: 1000,
          });
          particles.emit({
            count: 20,
            position: { x: target.x, y: target.y },
            velocity: { min: 50, max: 130 },
            angle: { min: 0, max: Math.PI * 2 },
            lifetime: { min: 400, max: 800 },
            size: { start: 4, end: 0 },
            color: [colors.gold, colors.orange],
            opacity: { start: 1, end: 0 },
          });
        } else {
          // Combo check
          if (now - lastHitTime < 1000) {
            combo++;
          } else {
            combo = 0;
          }
          const comboMult = combo >= 10 ? 3 : combo >= 6 ? 2 : combo >= 3 ? 1.5 : 1;
          const hitScore = Math.floor(baseScore * comboMult);
          score += hitScore;

          // Hit VFX
          particles.emit({
            count: 10,
            position: { x: target.x, y: target.y },
            velocity: { min: 30, max: 80 },
            angle: { min: 0, max: Math.PI * 2 },
            lifetime: { min: 300, max: 600 },
            size: { start: 3, end: 0 },
            color: target.color,
            opacity: { start: 1, end: 0 },
          });
          pulseRings.emit({ x: target.x, y: target.y, color: target.color, maxRadius: 25, duration: 250 });
          floatingText.emit({
            text: `+${hitScore}`,
            x: target.x, y: target.y - 20,
            color: target.color, fontSize: 14, duration: 600,
          });
        }

        target.lastHitTime = now;
        lastHitTime = now;

        // Remove target and spawn replacement
        target.alive = false;
        setTimeout(() => {
          const idx = targets.indexOf(target);
          if (idx >= 0) targets.splice(idx, 1);
          if (targets.filter(t => t.alive).length < TARGET_COUNT) spawnTarget();
        }, 300);
      }

      drawFrame(ctx);
      animId = requestAnimationFrame(loop);
    }

    function drawFrame(ctx: CanvasRenderingContext2D) {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      shake.apply(ctx);

      // Background — dark pond
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Subtle noise
      ctx.fillStyle = colors.textDim;
      for (const np of noiseParticles) {
        ctx.globalAlpha = np.o;
        ctx.fillRect(np.x + Math.sin(elapsed * 0.001 + np.x) * 2, np.y, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;

      // Faint concentric guide circles
      ctx.strokeStyle = withAlpha(colors.textDim, 0.03);
      ctx.lineWidth = 1;
      for (let r = 50; r < CANVAS_SIZE; r += 50) {
        ctx.beginPath();
        ctx.arc(CENTER, CENTER, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Wave pool
      wavePool.draw(ctx, CANVAS_SIZE, CANVAS_SIZE);

      // Targets
      for (const target of targets) {
        if (!target.alive) continue;
        const bobY = Math.sin(elapsed * 0.002 + target.x) * 3 * target.bob.value;
        const tx = target.x;
        const ty = target.y + bobY;
        const r = 10 + target.value / 10;

        drawWithGlow(ctx, target.color, 12, () => {
          ctx.beginPath();
          ctx.arc(tx, ty, r, 0, Math.PI * 2);
          ctx.fillStyle = target.color;
          ctx.fill();
        });

        // Value rings
        const ringCount = target.value / 10;
        for (let ri = 1; ri < ringCount; ri++) {
          ctx.strokeStyle = withAlpha(target.color, 0.3);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(tx, ty, r + ri * 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Particles & effects
      particles.draw(ctx);
      pulseRings.draw(ctx);
      floatingText.draw(ctx);

      // HUD
      drawHUD(ctx);

      // Flash
      flash.draw(ctx, CANVAS_SIZE, CANVAS_SIZE);

      shake.restore(ctx);
    }

    function drawHUD(ctx: CanvasRenderingContext2D) {
      // Score (top-left)
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = colors.text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.globalAlpha = 0.8;
      ctx.fillText(`${score}`, 14, 14);
      ctx.globalAlpha = 1;

      // Stone counter (top-right)
      const remaining = MAX_STONES - stonesUsed;
      const dotSize = 5;
      const dotGap = 4;
      const dotsPerRow = 10;
      for (let i = 0; i < MAX_STONES; i++) {
        const row = Math.floor(i / dotsPerRow);
        const col = i % dotsPerRow;
        const dx = CANVAS_SIZE - 14 - (dotsPerRow - col) * (dotSize + dotGap);
        const dy = 14 + row * (dotSize + dotGap + 2);
        ctx.beginPath();
        ctx.arc(dx, dy, dotSize / 2, 0, Math.PI * 2);
        if (i < remaining) {
          const isLow = remaining <= 2;
          ctx.fillStyle = isLow ? colors.danger : withAlpha(colors.text, 0.4);
          ctx.fill();
        } else {
          ctx.strokeStyle = withAlpha(colors.textDim, 0.15);
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Combo
      if (combo >= 3) {
        const mult = combo >= 10 ? '3x' : combo >= 6 ? '2x' : '1.5x';
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = colors.gold;
        ctx.textAlign = 'left';
        ctx.globalAlpha = 0.8;
        ctx.fillText(`combo ${mult}`, 14, 38);
        ctx.globalAlpha = 1;
      }

      // Timer (bottom-center)
      const remainingSec = Math.max(0, Math.ceil((timeLimit - elapsed) / 1000));
      ctx.font = '12px monospace';
      ctx.fillStyle = colors.textDim;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.5;
      ctx.fillText(`${remainingSec}s`, CENTER, CANVAS_SIZE - 14);
      ctx.globalAlpha = 1;

      // Amplifies counter
      if (amplifies > 0) {
        ctx.font = '12px monospace';
        ctx.fillStyle = colors.gold;
        ctx.textAlign = 'right';
        ctx.globalAlpha = 0.6;
        ctx.fillText(`amplifies: ${amplifies}`, CANVAS_SIZE - 14, CANVAS_SIZE - 14);
        ctx.globalAlpha = 1;
      }
    }

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('pointerdown', handlePointerDown);
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
