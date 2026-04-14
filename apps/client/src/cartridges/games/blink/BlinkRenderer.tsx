import { useEffect, useRef } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import type { CartridgeTheme } from '@pecking-order/ui-kit/cartridge-theme';
import { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';
import {
  mulberry32, lerp,
  ParticleEmitter, ScreenShake, ScreenFlash,
  PulseRingEmitter, FloatingTextEmitter, SpringValue,
} from '../shared/canvas-vfx';

const CANVAS_W = 400;
const CANVAS_H = 520;
const px = (v: number) => Math.round(v);

const WHITE_PENALTY = Config.game.blink.whitePenalty; // 3
const MIN_STATE_MS = Config.game.blink.minStateMs;    // 220

// Tempo curve — state durations in ms, interpolated by elapsed fraction.
// Early: slow, generous black pauses. Late: tight flickering.
const BLACK_EARLY_MIN = 1200;
const BLACK_EARLY_MAX = 2200;
const BLACK_LATE_MIN  = 500;
const BLACK_LATE_MAX  = 900;

const WHITE_EARLY_MIN = 400;
const WHITE_EARLY_MAX = 900;
const WHITE_LATE_MIN  = MIN_STATE_MS;
const WHITE_LATE_MAX  = 380;

const CROSSFADE_MS = 70;

const STREAK_MILESTONES: { streak: number; text: string }[] = [
  { streak: 10, text: 'CLEAN!' },
  { streak: 25, text: 'LOCKED IN' },
  { streak: 50, text: 'UNSHAKEABLE' },
];

type Phase = 'BLACK' | 'WHITE';
type ColorKey = keyof CartridgeTheme['colors'];

export default function BlinkRenderer({ seed, timeLimit, onResult }: ArcadeRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useCartridgeTheme(containerRef);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !theme) return;
    const ctx = canvas.getContext('2d')!;
    const rng = mulberry32(seed);

    // --- Game state ---
    let phase: Phase = 'BLACK';
    let prevPhase: Phase = 'BLACK';
    let phaseStartAt = 0;      // performance.now() when current phase began
    let phaseDuration = 0;     // how long current phase lasts
    let fadeStartAt = -9999;   // when last crossfade began (for bg blending)
    let elapsed = 0;           // total ms elapsed
    let score = 0;
    let blackTaps = 0;
    let whiteTaps = 0;
    let streak = 0;
    let longestStreak = 0;
    const hitMilestones = new Set<number>();
    let ending = false;
    let ended = false;

    // --- VFX ---
    const pipParticles = new ParticleEmitter();
    const shake = new ScreenShake();
    const flash = new ScreenFlash();
    const pulseRings = new PulseRingEmitter();
    const floatingText = new FloatingTextEmitter();
    const scorePulse = new SpringValue({ stiffness: 220, damping: 14 });
    scorePulse.snap(1);

    // --- Tempo / scheduling ---
    function tempoFraction(): number {
      return Math.min(1, elapsed / timeLimit);
    }

    function nextPhaseDuration(nextPhase: Phase): number {
      const t = tempoFraction();
      if (nextPhase === 'BLACK') {
        const minD = lerp(BLACK_EARLY_MIN, BLACK_LATE_MIN, t);
        const maxD = lerp(BLACK_EARLY_MAX, BLACK_LATE_MAX, t);
        return minD + rng() * (maxD - minD);
      }
      const minD = lerp(WHITE_EARLY_MIN, WHITE_LATE_MIN, t);
      const maxD = lerp(WHITE_EARLY_MAX, WHITE_LATE_MAX, t);
      return Math.max(MIN_STATE_MS, minD + rng() * (maxD - minD));
    }

    function flipPhase(now: number) {
      prevPhase = phase;
      phase = phase === 'BLACK' ? 'WHITE' : 'BLACK';
      phaseStartAt = now;
      phaseDuration = nextPhaseDuration(phase);
      fadeStartAt = now;
      // On flip TO white, small warning pulse-ring at canvas centre — reinforces the threat.
      if (phase === 'WHITE') {
        const t = themeRef.current!;
        pulseRings.emit({
          x: CANVAS_W / 2, y: CANVAS_H / 2,
          color: withAlpha(t.colors.danger, 0.35),
          maxRadius: 180, duration: 280, lineWidth: 3,
        });
      }
    }

    // Initial phase scheduling
    phaseStartAt = performance.now();
    phaseDuration = nextPhaseDuration('BLACK');

    // --- Input ---
    function registerTap(clientX: number, clientY: number) {
      if (ending || ended) return;
      const rect = canvas!.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * CANVAS_W;
      const y = ((clientY - rect.top) / rect.height) * CANVAS_H;
      const t = themeRef.current!;

      if (phase === 'BLACK') {
        blackTaps += 1;
        score += 1;
        streak += 1;
        if (streak > longestStreak) longestStreak = streak;
        scorePulse.target = 1.5;
        pipParticles.emit({
          count: 12,
          position: { x, y },
          velocity: { min: 40, max: 180 },
          angle: { min: 0, max: Math.PI * 2 },
          lifetime: { min: 280, max: 520 },
          size: { start: 4, end: 0 },
          color: [t.colors.gold, t.colors.info],
          opacity: { start: 1, end: 0 },
        }, rng);
        floatingText.emit({
          text: '+1', x, y: y - 12, color: t.colors.gold,
          fontSize: 22, duration: 520, drift: 60,
        });
        pulseRings.emit({
          x, y, color: withAlpha(t.colors.gold, 0.6),
          maxRadius: 50, duration: 360, lineWidth: 2,
        });
        // Milestone check
        for (const m of STREAK_MILESTONES) {
          if (streak >= m.streak && !hitMilestones.has(m.streak)) {
            hitMilestones.add(m.streak);
            floatingText.emit({
              text: m.text, x: CANVAS_W / 2, y: CANVAS_H / 2,
              color: t.colors.gold, fontSize: 30, duration: 900, drift: 30,
            });
            flash.trigger(withAlpha(t.colors.gold, 0.2), 140);
            shake.trigger({ intensity: 4, duration: 180 });
            scorePulse.target = 1.8;
          }
        }
      } else {
        whiteTaps += 1;
        score = Math.max(0, score - WHITE_PENALTY);
        streak = 0;
        scorePulse.target = 0.6;
        // Hard punitive response: shake, red flash, danger pips
        shake.trigger({ intensity: 14, duration: 320 });
        flash.trigger(withAlpha(t.colors.danger, 0.45), 220);
        pipParticles.emit({
          count: 22,
          position: { x, y },
          velocity: { min: 60, max: 240 },
          angle: { min: 0, max: Math.PI * 2 },
          lifetime: { min: 320, max: 640 },
          size: { start: 5, end: 0 },
          color: t.colors.danger,
          opacity: { start: 1, end: 0 },
        }, rng);
        floatingText.emit({
          text: `-${WHITE_PENALTY}`, x, y: y - 12, color: t.colors.danger,
          fontSize: 28, duration: 680, drift: 55,
        });
      }
    }

    const handlePointer = (e: PointerEvent) => {
      e.preventDefault();
      registerTap(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerdown', handlePointer);

    // --- Loop ---
    let lastTs = performance.now();
    let animId = 0;

    function loop(now: number) {
      const rawDt = now - lastTs;
      lastTs = now;
      const dt = Math.max(0, Math.min(50, rawDt));

      if (!ending) {
        elapsed += dt;

        // Phase transition
        if (now - phaseStartAt >= phaseDuration) {
          flipPhase(now);
        }

        // End of game
        if (elapsed >= timeLimit) {
          ending = true;
          const t = themeRef.current!;
          const isGood = score > 20;
          floatingText.emit({
            text: "TIME'S UP", x: CANVAS_W / 2, y: CANVAS_H / 2 - 30,
            color: isGood ? t.colors.gold : t.colors.danger,
            fontSize: 40, duration: 900, drift: 20,
          });
          floatingText.emit({
            text: `${score}`, x: CANVAS_W / 2, y: CANVAS_H / 2 + 24,
            color: isGood ? t.colors.gold : t.colors.text,
            fontSize: 56, duration: 900, drift: 10,
            scale: { start: 0.2, peak: 1.4, end: 1.0 },
          });
          flash.trigger(
            withAlpha(isGood ? t.colors.gold : t.colors.danger, 0.35),
            260,
          );
          shake.trigger({ intensity: 8, duration: 300 });
          // Celebratory burst
          pipParticles.emit({
            count: 60,
            position: { x: CANVAS_W / 2, y: CANVAS_H / 2 },
            velocity: { min: 80, max: 320 },
            angle: { min: 0, max: Math.PI * 2 },
            lifetime: { min: 500, max: 1100 },
            size: { start: 5, end: 0 },
            color: isGood
              ? [t.colors.gold, t.colors.info, t.colors.pink]
              : [t.colors.danger, t.colors.orange],
            opacity: { start: 1, end: 0 },
            gravity: 120,
          }, rng);
          setTimeout(() => {
            if (ended) return;
            ended = true;
            onResult({
              score: Math.floor(score),
              blackTaps: Math.floor(blackTaps),
              whiteTaps: Math.floor(whiteTaps),
              longestStreak: Math.floor(longestStreak),
              timeElapsed: Math.floor(elapsed),
            });
          }, 800);
        }
      }

      // VFX tick
      pipParticles.update(dt);
      shake.update(dt);
      flash.update(dt);
      pulseRings.update(dt);
      floatingText.update(dt);
      scorePulse.update(dt);
      if (scorePulse.settled) scorePulse.target = 1;

      drawFrame(ctx, now);
      animId = requestAnimationFrame(loop);
    }

    function drawFrame(ctx: CanvasRenderingContext2D, now: number) {
      const t = themeRef.current!;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      shake.apply(ctx);

      // --- Background (crossfade between prev & current) ---
      const fadeT = Math.min(1, Math.max(0, (now - fadeStartAt) / CROSSFADE_MS));
      const prevIsBlack = prevPhase === 'BLACK';
      const curIsBlack = phase === 'BLACK';
      // Interpolate a single grayscale level
      const prevLevel = prevIsBlack ? 0 : 245;
      const curLevel  = curIsBlack ? 0 : 245;
      const level = Math.round(lerp(prevLevel, curLevel, fadeT));
      ctx.fillStyle = `rgb(${level},${level},${level})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Black-state vignette texture — gives the "dark" fill some depth
      if (curIsBlack && fadeT > 0.2) {
        const grd = ctx.createRadialGradient(
          CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.2,
          CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.7,
        );
        grd.addColorStop(0, 'rgba(0,0,0,0)');
        grd.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }

      // White-state faint noise lines — keeps raw white from feeling inert
      if (!curIsBlack && fadeT > 0.2) {
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#000';
        for (let y = 0; y < CANVAS_H; y += 3) {
          ctx.fillRect(0, y, CANVAS_W, 1);
        }
        ctx.globalAlpha = 1;
      }

      // Instruction text (crossfades with background so both labels ghost briefly on flip)
      if (!ending) {
        const blackAlpha = Math.max(0, 1 - level / 245);
        const whiteAlpha = Math.max(0, level / 245);
        drawInstruction(ctx, t, 'TAP', t.colors.gold, blackAlpha * 0.55);
        drawInstruction(ctx, t, 'STOP', t.colors.danger, whiteAlpha * 0.72);
      }

      // VFX layers
      pulseRings.draw(ctx);
      pipParticles.draw(ctx);
      floatingText.draw(ctx);

      // --- HUD (always-visible plaques so text reads on black AND white) ---
      drawHUD(ctx, t, now);

      shake.restore(ctx);

      // Flash on top of everything
      flash.draw(ctx, CANVAS_W, CANVAS_H);
    }

    function drawInstruction(
      ctx: CanvasRenderingContext2D,
      _t: CartridgeTheme,
      text: string,
      color: string,
      alpha: number,
    ) {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.font = 'bold 72px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
      ctx.restore();
    }

    function drawHUD(ctx: CanvasRenderingContext2D, t: CartridgeTheme, now: number) {
      // Score plaque (top-left)
      const scoreS = scorePulse.value;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.strokeStyle = withAlpha(t.colors.gold, 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(px(12), px(12), px(110), px(46), 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = withAlpha(t.colors.text, 0.6);
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('SCORE', px(22), px(18));
      ctx.save();
      ctx.translate(px(22 + 45), px(18 + 26));
      ctx.scale(scoreS, scoreS);
      ctx.fillStyle = t.colors.gold;
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(score), 0, 0);
      ctx.restore();
      ctx.restore();

      // Time plaque (top-right)
      const remaining = Math.max(0, timeLimit - elapsed);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.strokeStyle = withAlpha(t.colors.info, 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(px(CANVAS_W - 122), px(12), px(110), px(46), 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = withAlpha(t.colors.text, 0.6);
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('TIME', px(CANVAS_W - 112), px(18));
      ctx.fillStyle = t.colors.info;
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${(remaining / 1000).toFixed(1)}s`, px(CANVAS_W - 22), px(18 + 26));
      ctx.restore();

      // Streak plaque (bottom center) — only when streak is building
      if (streak >= 3 && !ending) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, streak / 5);
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.strokeStyle = withAlpha(t.colors.gold, 0.45);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(px(CANVAS_W / 2 - 60), px(CANVAS_H - 54), px(120), px(38), 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = withAlpha(t.colors.text, 0.55);
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('STREAK', px(CANVAS_W / 2), px(CANVAS_H - 50));
        ctx.fillStyle = t.colors.gold;
        ctx.font = 'bold 20px monospace';
        ctx.textBaseline = 'middle';
        ctx.fillText(`×${streak}`, px(CANVAS_W / 2), px(CANVAS_H - 28));
        ctx.restore();
      }

    }

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('pointerdown', handlePointer);
    };
  }, [seed, timeLimit, onResult, theme]);

  return (
    <div ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ width: '100%', height: '100%', touchAction: 'none' }}
      />
    </div>
  );
}
