import { useEffect, useRef } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import {
  mulberry32, lerp,
  ParticleEmitter, ScreenShake, ScreenFlash, PulseRingEmitter,
  SlowMo, FloatingTextEmitter, SpringValue, drawWithGlow,
} from '../shared/canvas-vfx';
import { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';

const CANVAS_W = 400;
const CANVAS_H = 500;
const CODE_LENGTH = Config.game.codebreaker.codeLength;

const SLOT_SIZE = 40;
const SLOT_GAP = 10;
const SLOTS_WIDTH = CODE_LENGTH * SLOT_SIZE + (CODE_LENGTH - 1) * SLOT_GAP;
const SLOTS_X = (CANVAS_W - SLOTS_WIDTH) / 2;

const PALETTE_DOT = 32;
const PALETTE_GAP = 8;

const FEEDBACK_DOT = 8;
const FEEDBACK_GAP = 4;

const SUBMIT_W = 100;
const SUBMIT_H = 44;
const SUBMIT_X = (CANVAS_W - SUBMIT_W) / 2;
const SUBMIT_Y = 340;

type FeedbackDot = 'correct' | 'misplaced' | 'wrong';

interface GuessRow {
  colors: number[];
  feedback: FeedbackDot[];
  revealProgress: number; // 0 = hidden, 1 = all revealed
}

function getColorPalette(count: number, themeColors: Record<string, string>): string[] {
  const all = [
    themeColors.pink, themeColors.info, themeColors.gold,
    themeColors.green, themeColors.danger, themeColors.orange,
    themeColors.text,
  ];
  return all.slice(0, count);
}

function generateCode(rng: () => number, colorCount: number, allowRepeats: boolean): number[] {
  const code: number[] = [];
  const available = Array.from({ length: colorCount }, (_, i) => i);
  for (let i = 0; i < CODE_LENGTH; i++) {
    if (allowRepeats) {
      code.push(Math.floor(rng() * colorCount));
    } else {
      const idx = Math.floor(rng() * available.length);
      code.push(available[idx]);
      available.splice(idx, 1);
    }
  }
  return code;
}

function computeFeedback(guess: number[], code: number[]): FeedbackDot[] {
  const result: FeedbackDot[] = [];
  const codeUsed = new Array(code.length).fill(false);
  const guessUsed = new Array(guess.length).fill(false);

  // Pass 1: correct position
  for (let i = 0; i < code.length; i++) {
    if (guess[i] === code[i]) {
      result.push('correct');
      codeUsed[i] = true;
      guessUsed[i] = true;
    }
  }

  // Pass 2: correct color, wrong position
  for (let i = 0; i < guess.length; i++) {
    if (guessUsed[i]) continue;
    for (let j = 0; j < code.length; j++) {
      if (codeUsed[j]) continue;
      if (guess[i] === code[j]) {
        result.push('misplaced');
        codeUsed[j] = true;
        break;
      }
    }
  }

  // Fill remaining with 'wrong'
  while (result.length < code.length) result.push('wrong');
  return result;
}

function getDifficultyParams(codesCracked: number, difficulty: number) {
  const effective = codesCracked + difficulty * 3;
  if (effective < 2) return { colorCount: 5, guessTimer: 10_000, allowRepeats: false };
  if (effective < 5) return { colorCount: 6, guessTimer: 8_000, allowRepeats: false };
  if (effective < 8) return { colorCount: 6, guessTimer: 6_000, allowRepeats: true };
  return { colorCount: 7, guessTimer: 5_000, allowRepeats: true };
}

export default function CodebreakerRenderer({ seed, difficulty, timeLimit, onResult }: ArcadeRendererProps) {
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
    let codesCracked = 0;
    let totalGuesses = 0;
    let bestSolve = 99;
    let streak = 0;
    let elapsed = 0;
    let gameOver = false;

    // --- Current code ---
    let diffParams = getDifficultyParams(0, difficulty);
    let palette = getColorPalette(diffParams.colorCount, colors);
    let hiddenCode = generateCode(rng, diffParams.colorCount, diffParams.allowRepeats);
    let currentGuess = new Array(CODE_LENGTH).fill(-1);
    let selectedSlot = 0;
    let guessHistory: GuessRow[] = [];
    let guessesThisCode = 0;
    let guessTimerMs = diffParams.guessTimer;
    let guessTimerElapsed = 0;

    // --- Reveal animation state ---
    let revealing = false;
    let revealStartTime = 0;
    const REVEAL_DURATION = CODE_LENGTH * 200;

    // --- Cracked animation state ---
    let crackedAnim = false;
    let crackedStartTime = 0;
    const CRACKED_DURATION = 1200;

    // --- VFX ---
    const particles = new ParticleEmitter();
    const shake = new ScreenShake();
    const flash = new ScreenFlash();
    const pulseRings = new PulseRingEmitter();
    const slowMo = new SlowMo();
    const floatingText = new FloatingTextEmitter();
    const submitScale = new SpringValue({ stiffness: 300, damping: 15 });
    submitScale.snap(1);

    function startNewCode() {
      diffParams = getDifficultyParams(codesCracked, difficulty);
      palette = getColorPalette(diffParams.colorCount, colors);
      hiddenCode = generateCode(rng, diffParams.colorCount, diffParams.allowRepeats);
      currentGuess = new Array(CODE_LENGTH).fill(-1);
      selectedSlot = 0;
      guessHistory = [];
      guessesThisCode = 0;
      guessTimerMs = diffParams.guessTimer;
      guessTimerElapsed = 0;
      revealing = false;
      crackedAnim = false;
    }

    function submitGuess() {
      if (revealing || crackedAnim || gameOver) return;
      // Fill empty slots with first color
      for (let i = 0; i < CODE_LENGTH; i++) {
        if (currentGuess[i] < 0) currentGuess[i] = 0;
      }

      const feedback = computeFeedback(currentGuess, hiddenCode);
      guessHistory.push({
        colors: [...currentGuess],
        feedback,
        revealProgress: 0,
      });
      guessesThisCode++;
      totalGuesses++;
      guessTimerElapsed = 0;

      // Start feedback reveal animation
      revealing = true;
      revealStartTime = elapsed;

      const allCorrect = feedback.every(f => f === 'correct');
      if (allCorrect) {
        // Will be handled after reveal completes
      } else {
        // Reset guess for next attempt
        currentGuess = new Array(CODE_LENGTH).fill(-1);
        selectedSlot = 0;
      }
    }

    function onRevealComplete() {
      revealing = false;
      const lastRow = guessHistory[guessHistory.length - 1];
      const allCorrect = lastRow.feedback.every(f => f === 'correct');

      if (allCorrect) {
        crackedAnim = true;
        crackedStartTime = elapsed;

        // Score
        let guessBonus = 0;
        if (guessesThisCode === 1) guessBonus = 300;
        else if (guessesThisCode === 2) guessBonus = 200;
        else if (guessesThisCode === 3) guessBonus = 100;
        else if (guessesThisCode === 4) guessBonus = 50;
        const roundScore = 200 + guessBonus;
        const streakMult = streak >= 5 ? 2 : streak >= 3 ? 1.5 : 1;
        score += Math.floor(roundScore * streakMult);
        codesCracked++;
        if (guessesThisCode < bestSolve) bestSolve = guessesThisCode;
        if (guessesThisCode <= 4) streak++; else streak = 0;

        // VFX
        flash.trigger(colors.gold, 100);
        shake.trigger({ intensity: 5, duration: 200 });
        pulseRings.emit({ x: CANVAS_W / 2, y: 60, color: colors.gold, maxRadius: 60, duration: 400 });
        floatingText.emit({
          text: 'CRACKED!', x: CANVAS_W / 2, y: 100,
          color: colors.gold, fontSize: 22, duration: 1000,
        });
        particles.emit({
          count: 20,
          position: { x: CANVAS_W / 2, y: 60 },
          velocity: { min: 50, max: 150 },
          angle: { min: 0, max: Math.PI * 2 },
          lifetime: { min: 500, max: 1000 },
          size: { start: 4, end: 0 },
          color: palette,
          opacity: { start: 1, end: 0 },
        });

        if (guessesThisCode <= 2) {
          slowMo.trigger(0.5, 300);
          floatingText.emit({
            text: 'GENIUS!', x: CANVAS_W / 2, y: 130,
            color: colors.gold, fontSize: 26, duration: 1200,
          });
          shake.trigger({ intensity: 8, duration: 300 });
        }
      }
    }

    function onCrackedComplete() {
      crackedAnim = false;
      startNewCode();
    }

    // --- Input ---
    function handlePointerDown(e: PointerEvent) {
      if (gameOver || revealing || crackedAnim || !canvas) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * CANVAS_W;
      const y = (e.clientY - rect.top) / rect.height * CANVAS_H;

      // Check guess slots (tap to select)
      const guessY = 200;
      for (let i = 0; i < CODE_LENGTH; i++) {
        const sx = SLOTS_X + i * (SLOT_SIZE + SLOT_GAP);
        if (x >= sx && x <= sx + SLOT_SIZE && y >= guessY && y <= guessY + SLOT_SIZE) {
          selectedSlot = i;
          return;
        }
      }

      // Check palette (tap to set color on selected slot)
      const paletteY = 270;
      const paletteWidth = palette.length * PALETTE_DOT + (palette.length - 1) * PALETTE_GAP;
      const paletteX = (CANVAS_W - paletteWidth) / 2;
      for (let i = 0; i < palette.length; i++) {
        const px = paletteX + i * (PALETTE_DOT + PALETTE_GAP);
        if (x >= px && x <= px + PALETTE_DOT && y >= paletteY && y <= paletteY + PALETTE_DOT) {
          currentGuess[selectedSlot] = i;
          // Auto-advance to next empty slot
          for (let j = 1; j <= CODE_LENGTH; j++) {
            const next = (selectedSlot + j) % CODE_LENGTH;
            if (currentGuess[next] < 0) { selectedSlot = next; break; }
          }
          return;
        }
      }

      // Check arrows on selected slot
      const arrowY = guessY + SLOT_SIZE / 2;
      const slotCenterX = SLOTS_X + selectedSlot * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2;
      // Left arrow
      if (x >= slotCenterX - SLOT_SIZE / 2 - 24 && x <= slotCenterX - SLOT_SIZE / 2 - 4 &&
          y >= arrowY - 12 && y <= arrowY + 12) {
        currentGuess[selectedSlot] = currentGuess[selectedSlot] <= 0
          ? palette.length - 1
          : currentGuess[selectedSlot] - 1;
        return;
      }
      // Right arrow
      if (x >= slotCenterX + SLOT_SIZE / 2 + 4 && x <= slotCenterX + SLOT_SIZE / 2 + 24 &&
          y >= arrowY - 12 && y <= arrowY + 12) {
        currentGuess[selectedSlot] = (currentGuess[selectedSlot] + 1) % palette.length;
        return;
      }

      // Check submit button
      if (x >= SUBMIT_X && x <= SUBMIT_X + SUBMIT_W && y >= SUBMIT_Y && y <= SUBMIT_Y + SUBMIT_H) {
        submitScale.snap(0.9);
        submitScale.target = 1;
        submitGuess();
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

      if (elapsed >= timeLimit && !gameOver) {
        gameOver = true;
        const avgGuesses = codesCracked > 0 ? Math.floor(totalGuesses / codesCracked) : 0;
        if (bestSolve === 99) bestSolve = 0;
        onResult({ score, codesCracked, averageGuesses: avgGuesses, bestSolve });
      }

      // Guess timer
      if (!gameOver && !revealing && !crackedAnim) {
        guessTimerElapsed += rawDt;
        if (guessTimerElapsed >= guessTimerMs) {
          submitGuess(); // auto-submit
        }
      }

      // Reveal animation
      if (revealing) {
        const revealElapsed = elapsed - revealStartTime;
        const lastRow = guessHistory[guessHistory.length - 1];
        lastRow.revealProgress = Math.min(1, revealElapsed / REVEAL_DURATION);

        // Emit particles for each dot as it reveals
        const dotIdx = Math.floor(lastRow.revealProgress * CODE_LENGTH);
        if (dotIdx < CODE_LENGTH && lastRow.revealProgress > 0) {
          const fb = lastRow.feedback[Math.min(dotIdx, CODE_LENGTH - 1)];
          if (fb === 'correct') {
            const fbX = SLOTS_X + SLOTS_WIDTH + 20 + dotIdx * (FEEDBACK_DOT * 2 + FEEDBACK_GAP);
            pulseRings.emit({ x: fbX + FEEDBACK_DOT, y: 0, color: colors.gold, maxRadius: 15, duration: 200 });
          }
        }

        if (lastRow.revealProgress >= 1) {
          onRevealComplete();
        }
      }

      // Cracked animation
      if (crackedAnim) {
        if (elapsed - crackedStartTime >= CRACKED_DURATION) {
          onCrackedComplete();
        }
      }

      // Update VFX
      submitScale.update(dt);
      particles.update(dt);
      shake.update(dt);
      flash.update(dt);
      pulseRings.update(dt);
      floatingText.update(dt);

      drawFrame(ctx);
      animId = requestAnimationFrame(loop);
    }

    function drawFrame(ctx: CanvasRenderingContext2D) {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      shake.apply(ctx);

      // Background
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Subtle texture
      ctx.globalAlpha = 0.02;
      ctx.fillStyle = colors.textDim;
      for (let i = 0; i < 40; i++) {
        const tx = (mulberry32(seed + i * 7)() * CANVAS_W);
        const ty = (mulberry32(seed + i * 13)() * CANVAS_H);
        ctx.fillRect(tx, ty, 2, 2);
      }
      ctx.globalAlpha = 1;

      // Hidden code (top)
      drawHiddenCode(ctx);

      // Guess history
      drawGuessHistory(ctx);

      // Current guess row
      if (!gameOver && !crackedAnim) {
        drawCurrentGuess(ctx);

        // Palette
        drawPalette(ctx);

        // Submit button
        drawSubmitButton(ctx);
      }

      // Particles & effects
      particles.draw(ctx);
      pulseRings.draw(ctx);
      floatingText.draw(ctx);

      // HUD
      drawHUD(ctx);

      // Flash overlay
      flash.draw(ctx, CANVAS_W, CANVAS_H);

      shake.restore(ctx);
    }

    function drawHiddenCode(ctx: CanvasRenderingContext2D) {
      const y = 30;
      for (let i = 0; i < CODE_LENGTH; i++) {
        const x = SLOTS_X + i * (SLOT_SIZE + SLOT_GAP);
        const cx = x + SLOT_SIZE / 2;
        const cy = y + SLOT_SIZE / 2;

        if (crackedAnim) {
          // Flip reveal animation — sequential L-to-R
          const flipDelay = i * 150;
          const flipElapsed = (elapsed - crackedStartTime) - flipDelay;
          const flipT = Math.max(0, Math.min(1, flipElapsed / 300));

          if (flipT < 0.5) {
            // Closing (squish horizontally)
            const scaleX = 1 - flipT * 2;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(scaleX, 1);
            // Still hidden
            ctx.fillStyle = withAlpha(colors.bgSubtle, 0.6);
            ctx.beginPath();
            ctx.arc(0, 0, SLOT_SIZE / 2 - 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = withAlpha(colors.text, 0.4);
            ctx.font = 'bold 18px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', 0, 0);
            ctx.restore();
          } else {
            // Opening (expand with color)
            const scaleX = (flipT - 0.5) * 2;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(scaleX, 1);
            drawWithGlow(ctx, palette[hiddenCode[i]], 8, () => {
              ctx.beginPath();
              ctx.arc(0, 0, SLOT_SIZE / 2 - 2, 0, Math.PI * 2);
              ctx.fillStyle = palette[hiddenCode[i]];
              ctx.fill();
            });
            ctx.restore();
          }
        } else {
          // Hidden — frosted glass
          ctx.fillStyle = withAlpha(colors.bgSubtle, 0.6);
          ctx.beginPath();
          ctx.arc(cx, cy, SLOT_SIZE / 2 - 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = withAlpha(colors.text, 0.4);
          ctx.font = 'bold 18px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', cx, cy);
        }
      }
    }

    function drawGuessHistory(ctx: CanvasRenderingContext2D) {
      const startY = 90;
      const rowH = 36;
      const maxVisible = 4;
      const visibleStart = Math.max(0, guessHistory.length - maxVisible);

      for (let ri = visibleStart; ri < guessHistory.length; ri++) {
        const row = guessHistory[ri];
        const displayIdx = ri - visibleStart;
        const y = startY + displayIdx * rowH;
        const isLast = ri === guessHistory.length - 1;
        const rowOpacity = isLast ? 1 : 0.5;

        ctx.globalAlpha = rowOpacity;

        // Color dots
        for (let i = 0; i < CODE_LENGTH; i++) {
          const x = SLOTS_X + i * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2;
          const dotR = 12;
          drawWithGlow(ctx, palette[row.colors[i]], 4, () => {
            ctx.beginPath();
            ctx.arc(x, y + rowH / 2, dotR, 0, Math.PI * 2);
            ctx.fillStyle = palette[row.colors[i]];
            ctx.fill();
          });
        }

        // Feedback dots
        const fbX = SLOTS_X + SLOTS_WIDTH + 16;
        for (let i = 0; i < row.feedback.length; i++) {
          const revealedCount = Math.floor(row.revealProgress * CODE_LENGTH);
          if (isLast && i >= revealedCount) continue; // not yet revealed

          const dx = fbX + i * (FEEDBACK_DOT * 2 + FEEDBACK_GAP) + FEEDBACK_DOT;
          const dy = y + rowH / 2;
          const fb = row.feedback[i];

          if (fb === 'correct') {
            ctx.fillStyle = colors.gold;
            ctx.beginPath();
            ctx.arc(dx, dy, FEEDBACK_DOT, 0, Math.PI * 2);
            ctx.fill();
          } else if (fb === 'misplaced') {
            ctx.strokeStyle = colors.info;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(dx, dy, FEEDBACK_DOT, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.fillStyle = withAlpha(colors.textDim, 0.2);
            ctx.beginPath();
            ctx.arc(dx, dy, FEEDBACK_DOT * 0.7, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.globalAlpha = 1;
      }
    }

    function drawCurrentGuess(ctx: CanvasRenderingContext2D) {
      const y = 200;

      for (let i = 0; i < CODE_LENGTH; i++) {
        const x = SLOTS_X + i * (SLOT_SIZE + SLOT_GAP);
        const cx = x + SLOT_SIZE / 2;
        const cy = y + SLOT_SIZE / 2;
        const isSelected = i === selectedSlot;

        // Slot background
        ctx.strokeStyle = isSelected ? colors.gold : withAlpha(colors.text, 0.2);
        ctx.lineWidth = isSelected ? 3 : 1;
        ctx.beginPath();
        ctx.arc(cx, cy, SLOT_SIZE / 2 - 2, 0, Math.PI * 2);
        ctx.stroke();

        // Color fill
        if (currentGuess[i] >= 0) {
          drawWithGlow(ctx, palette[currentGuess[i]], isSelected ? 10 : 6, () => {
            ctx.beginPath();
            ctx.arc(cx, cy, SLOT_SIZE / 2 - 4, 0, Math.PI * 2);
            ctx.fillStyle = palette[currentGuess[i]];
            ctx.fill();
          });
        }

        // Arrows on selected slot only
        if (isSelected) {
          ctx.fillStyle = withAlpha(colors.textDim, 0.6);
          ctx.font = '16px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('<', cx - SLOT_SIZE / 2 - 14, cy);
          ctx.fillText('>', cx + SLOT_SIZE / 2 + 14, cy);
        }
      }
    }

    function drawPalette(ctx: CanvasRenderingContext2D) {
      const y = 270;
      const totalW = palette.length * PALETTE_DOT + (palette.length - 1) * PALETTE_GAP;
      const startX = (CANVAS_W - totalW) / 2;

      for (let i = 0; i < palette.length; i++) {
        const x = startX + i * (PALETTE_DOT + PALETTE_GAP);
        const cx = x + PALETTE_DOT / 2;
        const cy = y + PALETTE_DOT / 2;
        const isActive = currentGuess[selectedSlot] === i;

        drawWithGlow(ctx, palette[i], isActive ? 10 : 4, () => {
          ctx.beginPath();
          ctx.arc(cx, cy, PALETTE_DOT / 2 - 2, 0, Math.PI * 2);
          ctx.fillStyle = palette[i];
          ctx.fill();
        });

        if (isActive) {
          ctx.strokeStyle = colors.text;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, PALETTE_DOT / 2 + 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    function drawSubmitButton(ctx: CanvasRenderingContext2D) {
      const allFilled = currentGuess.every(c => c >= 0);
      const scale = submitScale.value;

      ctx.save();
      ctx.translate(SUBMIT_X + SUBMIT_W / 2, SUBMIT_Y + SUBMIT_H / 2);
      ctx.scale(scale, scale);

      // Button bg
      const btnColor = allFilled ? colors.gold : withAlpha(colors.textDim, 0.3);
      ctx.fillStyle = btnColor;
      const r = 8;
      ctx.beginPath();
      ctx.roundRect(-SUBMIT_W / 2, -SUBMIT_H / 2, SUBMIT_W, SUBMIT_H, r);
      ctx.fill();

      // Text
      ctx.fillStyle = allFilled ? colors.bg : withAlpha(colors.text, 0.3);
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SUBMIT', 0, 0);

      ctx.restore();

      // Timer ring around button
      if (!revealing) {
        const timerFrac = 1 - guessTimerElapsed / guessTimerMs;
        const timerColor = timerFrac > 0.5 ? colors.green : timerFrac > 0.2 ? colors.gold : colors.danger;
        ctx.strokeStyle = timerColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(SUBMIT_X + SUBMIT_W / 2, SUBMIT_Y + SUBMIT_H / 2,
          SUBMIT_W / 2 + 8, -Math.PI / 2, -Math.PI / 2 + timerFrac * Math.PI * 2);
        ctx.stroke();
      }
    }

    function drawHUD(ctx: CanvasRenderingContext2D) {
      // Score (top-left)
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = colors.text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.globalAlpha = 0.8;
      ctx.fillText(`${score}`, 12, 8);
      ctx.globalAlpha = 1;

      // Codes cracked (top-right)
      ctx.textAlign = 'right';
      ctx.font = '12px monospace';
      ctx.fillStyle = colors.textDim;
      ctx.globalAlpha = 0.6;
      ctx.fillText(`codes: ${codesCracked}`, CANVAS_W - 12, 8);
      ctx.globalAlpha = 1;

      // Game timer (bottom)
      const remaining = Math.max(0, Math.ceil((timeLimit - elapsed) / 1000));
      ctx.font = '12px monospace';
      ctx.fillStyle = colors.textDim;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.5;
      ctx.fillText(`${remaining}s`, CANVAS_W / 2, CANVAS_H - 12);
      ctx.globalAlpha = 1;

      // Streak
      if (streak >= 3) {
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = colors.gold;
        ctx.textAlign = 'right';
        ctx.globalAlpha = 0.8;
        ctx.fillText(`streak: ${streak}`, CANVAS_W - 12, 24);
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
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ width: '100%', height: '100%', touchAction: 'none' }}
      />
    </div>
  );
}
