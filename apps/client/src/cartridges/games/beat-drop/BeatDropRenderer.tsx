import { useEffect, useRef, useCallback } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';
import {
  mulberry32, lerp,
  ParticleEmitter, ScreenShake, ScreenFlash, PulseRingEmitter,
  drawWithGlow,
} from '../shared/canvas-vfx';

// --- Constants ---

const CANVAS_WIDTH = 300;
const CANVAS_HEIGHT = 500;
const LANE_COUNT = 4;
const LANE_WIDTH = CANVAS_WIDTH / LANE_COUNT;
const HIT_LINE_Y = CANVAS_HEIGHT - 80;
const NOTE_SPEED = 200; // px/s — slower for readability
const NOTE_WIDTH = 36;
const NOTE_HEIGHT = 14;
const NOTE_BORDER_RADIUS = 7;

// Timing windows (ms) — generous for accessibility
const PERFECT_WINDOW = 50;
const GREAT_WINDOW = 100;
const GOOD_WINDOW = 150;

// Points per grade
const PERFECT_POINTS = 100;
const GREAT_POINTS = 60;
const GOOD_POINTS = 30;

// Key bindings
const LANE_KEYS: Record<string, number> = { d: 0, f: 1, j: 2, k: 3 };

type TimingGrade = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';

// Combo multiplier
function comboMultiplier(combo: number): number {
  if (combo >= 50) return 4;
  if (combo >= 25) return 3;
  if (combo >= 10) return 2;
  return 1;
}

// --- Note type ---

interface Note {
  lane: number;
  time: number;    // ms from game start when note should be at hit line
  duration: number; // 0 = tap, >0 = hold (ms)
  hit: boolean;
  grade?: TimingGrade;
  holdProgress?: number; // 0-1 for hold notes
}

// --- Hit feedback text ---

interface HitFeedback {
  text: string;
  lane: number;
  opacity: number;
  y: number;
  color: string;
}

// --- Pattern generation ---

function generateNotes(rng: () => number, timeLimit: number, difficulty: number): Note[] {
  const { startBpm, endBpm } = Config.game.beatDrop;
  const notes: Note[] = [];
  let currentTime = 3000; // 3 second grace period — player orients to the lanes

  while (currentTime < timeLimit - 2000) {
    // BPM at current time
    const progress = currentTime / timeLimit;
    const bpm = startBpm + (endBpm - startBpm) * progress;
    const beatInterval = 60000 / bpm;

    // Pattern selection — more complex patterns at higher difficulty and time
    // Bias starts low so early game is mostly singles
    const complexityBias = progress * 0.4 + difficulty * 0.3;
    const roll = rng();

    if (roll < 0.5 - complexityBias * 0.2) {
      // Single
      const lane = Math.floor(rng() * LANE_COUNT);
      notes.push({ lane, time: currentTime, duration: 0, hit: false });
      currentTime += beatInterval;
    } else if (roll < 0.6 - complexityBias * 0.1) {
      // Double (two lanes)
      const l1 = Math.floor(rng() * LANE_COUNT);
      let l2 = Math.floor(rng() * LANE_COUNT);
      while (l2 === l1) l2 = Math.floor(rng() * LANE_COUNT);
      notes.push({ lane: l1, time: currentTime, duration: 0, hit: false });
      notes.push({ lane: l2, time: currentTime, duration: 0, hit: false });
      currentTime += beatInterval;
    } else if (roll < 0.75) {
      // Run (3 quick notes in one lane)
      const lane = Math.floor(rng() * LANE_COUNT);
      const subInterval = beatInterval / 2;
      for (let i = 0; i < 3; i++) {
        notes.push({ lane, time: currentTime + subInterval * i, duration: 0, hit: false });
      }
      currentTime += beatInterval * 1.5;
    } else if (roll < 0.9) {
      // Sweep (across all lanes)
      const reverse = rng() > 0.5;
      const subInterval = beatInterval / 3;
      const lanes = reverse ? [3, 2, 1, 0] : [0, 1, 2, 3];
      for (let i = 0; i < 4; i++) {
        notes.push({ lane: lanes[i], time: currentTime + subInterval * i, duration: 0, hit: false });
      }
      currentTime += beatInterval * 2;
    } else {
      // Hold note
      const lane = Math.floor(rng() * LANE_COUNT);
      const holdDuration = beatInterval * (1 + rng());
      notes.push({ lane, time: currentTime, duration: holdDuration, hit: false });
      currentTime += holdDuration + beatInterval * 0.5;
    }
  }

  return notes.sort((a, b) => a.time - b.time);
}

export default function BeatDropRenderer({ seed, difficulty, timeLimit, onResult }: ArcadeRendererProps) {
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

    const rng = mulberry32(seed);
    const laneColors = [t.colors.pink, t.colors.orange, t.colors.info, t.colors.gold];

    // Generate all notes
    const notes = generateNotes(rng, timeLimit, difficulty);
    const totalNoteCount = notes.length;

    // Game state
    let elapsed = 0;
    let score = 0;
    let combo = 0;
    let maxCombo = 0;
    let lives = Config.game.beatDrop.maxLives;
    let perfectHits = 0;
    let totalHits = 0;
    let dead = false;
    let deathTime = 0;
    const lanePressed = [false, false, false, false];
    const feedbacks: HitFeedback[] = [];

    // Hold note tracking
    const activeHolds = new Map<Note, { startTime: number }>();

    // VFX
    const particles = new ParticleEmitter();
    const screenShake = new ScreenShake();
    const screenFlash = new ScreenFlash();
    const pulseRings = new PulseRingEmitter();

    // Beat pulse tracking
    let lastBeatTime = 0;
    let beatPulse = 0;

    // --- Input ---
    function processHit(lane: number) {
      if (dead) return;
      lanePressed[lane] = true;

      // Find closest unhit note in this lane within GOOD_WINDOW
      let bestNote: Note | null = null;
      let bestDiff = Infinity;
      for (const note of notes) {
        if (note.hit || note.lane !== lane) continue;
        const diff = Math.abs(note.time - elapsed);
        if (diff <= GOOD_WINDOW && diff < bestDiff) {
          bestNote = note;
          bestDiff = diff;
        }
      }

      if (!bestNote) return;

      bestNote.hit = true;
      let grade: TimingGrade;
      let points: number;

      if (bestDiff <= PERFECT_WINDOW) {
        grade = 'PERFECT';
        points = PERFECT_POINTS;
        perfectHits++;
      } else if (bestDiff <= GREAT_WINDOW) {
        grade = 'GREAT';
        points = GREAT_POINTS;
      } else {
        grade = 'GOOD';
        points = GOOD_POINTS;
      }

      bestNote.grade = grade;
      totalHits++;
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      score += points * comboMultiplier(combo);

      // If it's a hold note, start tracking
      if (bestNote.duration > 0) {
        activeHolds.set(bestNote, { startTime: elapsed });
      }

      // VFX per grade
      const laneX = lane * LANE_WIDTH + LANE_WIDTH / 2;
      const color = laneColors[lane];

      if (grade === 'PERFECT') {
        particles.emit({
          count: 15,
          position: { x: laneX, y: HIT_LINE_Y },
          velocity: { min: 60, max: 150 },
          angle: { min: -Math.PI, max: 0 },
          lifetime: { min: 300, max: 600 },
          size: { start: 3, end: 0.5 },
          color,
          opacity: { start: 1, end: 0 },
        });
        pulseRings.emit({ x: laneX, y: HIT_LINE_Y, color, maxRadius: 30, duration: 300 });
        feedbacks.push({ text: 'PERFECT', lane, opacity: 1, y: HIT_LINE_Y - 20, color: t.colors.gold });
      } else if (grade === 'GREAT') {
        particles.emit({
          count: 8,
          position: { x: laneX, y: HIT_LINE_Y },
          velocity: { min: 40, max: 100 },
          angle: { min: -Math.PI, max: 0 },
          lifetime: { min: 200, max: 400 },
          size: { start: 2, end: 0.5 },
          color,
          opacity: { start: 0.8, end: 0 },
        });
        feedbacks.push({ text: 'GREAT', lane, opacity: 0.7, y: HIT_LINE_Y - 20, color });
      } else {
        particles.emit({
          count: 4,
          position: { x: laneX, y: HIT_LINE_Y },
          velocity: { min: 20, max: 60 },
          angle: { min: -Math.PI, max: 0 },
          lifetime: { min: 150, max: 300 },
          size: { start: 1.5, end: 0.5 },
          color: withAlpha(color, 0.5),
          opacity: { start: 0.5, end: 0 },
        });
        feedbacks.push({ text: 'GOOD', lane, opacity: 0.5, y: HIT_LINE_Y - 20, color: withAlpha(color, 0.5) });
      }
    }

    function processRelease(lane: number) {
      lanePressed[lane] = false;

      // Check active holds in this lane
      for (const [note, hold] of activeHolds) {
        if (note.lane === lane) {
          const holdEnd = note.time + note.duration;
          const holdProgress = (elapsed - hold.startTime) / note.duration;
          note.holdProgress = holdProgress;
          if (holdProgress < 0.8) {
            // Failed hold — counts as miss
            onMiss(lane);
          }
          activeHolds.delete(note);
        }
      }
    }

    function onMiss(lane: number) {
      combo = 0;
      lives--;

      const laneX = lane * LANE_WIDTH + LANE_WIDTH / 2;
      screenShake.trigger({ intensity: 4, duration: 200 });
      feedbacks.push({ text: 'MISS', lane, opacity: 1, y: HIT_LINE_Y - 20, color: t.colors.danger });

      // Shatter particles downward
      particles.emit({
        count: 6,
        position: { x: laneX, y: HIT_LINE_Y },
        velocity: { min: 30, max: 80 },
        angle: { min: 0, max: Math.PI },
        lifetime: { min: 200, max: 400 },
        size: { start: 2, end: 0.5 },
        color: t.colors.danger,
        opacity: { start: 0.6, end: 0 },
        gravity: 300,
      });

      if (lives <= 0) {
        dead = true;
        deathTime = 0;
        screenFlash.trigger(t.colors.danger, 400);
        screenShake.trigger({ intensity: 10, duration: 400 });
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      const lane = LANE_KEYS[e.key.toLowerCase()];
      if (lane !== undefined && !e.repeat) processHit(lane);
    }

    function onKeyUp(e: KeyboardEvent) {
      const lane = LANE_KEYS[e.key.toLowerCase()];
      if (lane !== undefined) processRelease(lane);
    }

    // Touch zones
    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const rect = canvas!.getBoundingClientRect();
        const x = (touch.clientX - rect.left) / rect.width * CANVAS_WIDTH;
        const lane = Math.floor(x / LANE_WIDTH);
        if (lane >= 0 && lane < LANE_COUNT) processHit(lane);
      }
    }

    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const rect = canvas!.getBoundingClientRect();
        const x = (touch.clientX - rect.left) / rect.width * CANVAS_WIDTH;
        const lane = Math.floor(x / LANE_WIDTH);
        if (lane >= 0 && lane < LANE_COUNT) processRelease(lane);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    // --- Render ---
    function renderGame(dt: number) {
      const w = CANVAS_WIDTH;
      const h = CANVAS_HEIGHT;
      const mult = comboMultiplier(combo);

      // Background
      ctx.fillStyle = t.colors.bg;
      ctx.fillRect(0, 0, w, h);

      screenShake.apply(ctx);

      // Beat pulse (dims background subtly on each beat)
      const { startBpm, endBpm } = Config.game.beatDrop;
      const progress = elapsed / timeLimit;
      const bpm = startBpm + (endBpm - startBpm) * progress;
      const beatInterval = 60000 / bpm;
      if (elapsed - lastBeatTime >= beatInterval) {
        lastBeatTime = elapsed;
        beatPulse = 1;
      }
      beatPulse *= 0.92; // decay

      if (beatPulse > 0.01) {
        ctx.globalAlpha = beatPulse * 0.08;
        ctx.fillStyle = t.colors.bgSubtle;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      // Lane backgrounds
      for (let i = 0; i < LANE_COUNT; i++) {
        const laneX = i * LANE_WIDTH;
        ctx.fillStyle = withAlpha(laneColors[i], 0.03);
        ctx.fillRect(laneX, 0, LANE_WIDTH, h);

        // Combo 2x+: pulse lanes on beat
        if (mult >= 2 && beatPulse > 0.01) {
          ctx.globalAlpha = beatPulse * 0.1;
          ctx.fillStyle = laneColors[i];
          ctx.fillRect(laneX, 0, LANE_WIDTH, h);
          ctx.globalAlpha = 1;
        }
      }

      // Combo 4x: edge glow
      if (mult >= 4 && beatPulse > 0.01) {
        const grad = ctx.createLinearGradient(0, 0, 20, 0);
        grad.addColorStop(0, withAlpha(t.colors.gold, 0.3 * beatPulse));
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 20, h);

        const grad2 = ctx.createLinearGradient(w, 0, w - 20, 0);
        grad2.addColorStop(0, withAlpha(t.colors.gold, 0.3 * beatPulse));
        grad2.addColorStop(1, 'transparent');
        ctx.fillStyle = grad2;
        ctx.fillRect(w - 20, 0, 20, h);
      }

      // Lane dividers
      ctx.strokeStyle = withAlpha(t.colors.text, 0.04);
      ctx.lineWidth = 1;
      for (let i = 1; i < LANE_COUNT; i++) {
        ctx.beginPath();
        ctx.moveTo(i * LANE_WIDTH, 0);
        ctx.lineTo(i * LANE_WIDTH, h);
        ctx.stroke();
      }

      // Hit line
      const hitLineGrad = ctx.createLinearGradient(0, HIT_LINE_Y, w, HIT_LINE_Y);
      for (let i = 0; i < LANE_COUNT; i++) {
        hitLineGrad.addColorStop(i / LANE_COUNT, withAlpha(laneColors[i], 0.7));
        hitLineGrad.addColorStop((i + 1) / LANE_COUNT, withAlpha(laneColors[i], 0.7));
      }
      ctx.strokeStyle = hitLineGrad;
      ctx.lineWidth = 3;
      drawWithGlow(ctx, t.colors.text, 6, () => {
        ctx.beginPath();
        ctx.moveTo(0, HIT_LINE_Y);
        ctx.lineTo(w, HIT_LINE_Y);
        ctx.stroke();
      });

      // Draw notes
      const visibleWindowMs = (CANVAS_HEIGHT / NOTE_SPEED) * 1000;
      for (const note of notes) {
        if (note.hit) continue;
        const timeDiff = note.time - elapsed;
        if (timeDiff < -GOOD_WINDOW * 2 || timeDiff > visibleWindowMs) continue;

        const noteY = HIT_LINE_Y - timeDiff * NOTE_SPEED / 1000;
        const laneX = note.lane * LANE_WIDTH + (LANE_WIDTH - NOTE_WIDTH) / 2;
        const color = laneColors[note.lane];

        // Scale as approaching hit line
        const approachFactor = Math.max(0, 1 - Math.abs(timeDiff) / visibleWindowMs);
        const scale = 1 + approachFactor * 0.15;

        ctx.save();
        ctx.translate(laneX + NOTE_WIDTH / 2, noteY);
        ctx.scale(scale, scale);

        if (note.duration > 0) {
          // Hold note: body + head
          const bodyHeight = note.duration * NOTE_SPEED / 1000;
          ctx.fillStyle = withAlpha(color, 0.15);
          ctx.strokeStyle = withAlpha(color, 0.4);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(-NOTE_WIDTH / 2, -bodyHeight, NOTE_WIDTH, bodyHeight, NOTE_BORDER_RADIUS);
          ctx.fill();
          ctx.stroke();

          // Head
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(-NOTE_WIDTH / 2, -NOTE_HEIGHT / 2, NOTE_WIDTH, NOTE_HEIGHT, NOTE_BORDER_RADIUS);
          ctx.fill();
        } else {
          // Regular note
          drawWithGlow(ctx, color, 6, () => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(-NOTE_WIDTH / 2, -NOTE_HEIGHT / 2, NOTE_WIDTH, NOTE_HEIGHT, NOTE_BORDER_RADIUS);
            ctx.fill();
          });
        }

        ctx.restore();
      }

      // VFX layers
      particles.draw(ctx);
      pulseRings.draw(ctx);

      screenShake.restore(ctx);

      screenFlash.draw(ctx, w, h);

      // Hit feedback texts
      for (let i = feedbacks.length - 1; i >= 0; i--) {
        const fb = feedbacks[i];
        fb.opacity -= dt / 400;
        fb.y -= dt * 0.05;
        if (fb.opacity <= 0) {
          feedbacks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = fb.opacity;
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = fb.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fb.text, fb.lane * LANE_WIDTH + LANE_WIDTH / 2, fb.y);
      }
      ctx.globalAlpha = 1;

      // Key indicators at bottom
      for (let i = 0; i < LANE_COUNT; i++) {
        const kx = i * LANE_WIDTH + (LANE_WIDTH - 36) / 2;
        const ky = h - 40;
        const pressed = lanePressed[i];
        ctx.strokeStyle = withAlpha(laneColors[i], pressed ? 0.8 : 0.3);
        ctx.fillStyle = pressed ? withAlpha(laneColors[i], 0.2) : 'transparent';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(kx, ky, 36, 28, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = '11px monospace';
        ctx.fillStyle = withAlpha(laneColors[i], pressed ? 0.8 : 0.5);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(['D', 'F', 'J', 'K'][i], kx + 18, ky + 14);
      }

      // HUD
      ctx.font = '14px monospace';
      ctx.textBaseline = 'top';

      // Score
      ctx.fillStyle = withAlpha(t.colors.text, 0.5);
      ctx.textAlign = 'left';
      ctx.fillText(`${score}`, 12, 12);

      // Combo
      if (combo > 0) {
        const comboSize = 14 + Math.min(combo, 50) * 0.1;
        ctx.font = `bold ${comboSize}px monospace`;
        ctx.fillStyle = t.colors.gold;
        ctx.textAlign = 'right';
        ctx.fillText(`${combo}x${mult > 1 ? ` (${mult}x)` : ''}`, w - 12, 12);
      }

      // Lives
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      for (let i = 0; i < Config.game.beatDrop.maxLives; i++) {
        const dotX = w / 2 + (i - 1) * 16;
        const dotY = h - 14;
        ctx.fillStyle = i < lives ? t.colors.green : withAlpha(t.colors.danger, 0.3);
        ctx.beginPath();
        ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- Game loop ---
    let lastTime = performance.now();
    let animId: number;
    let resultSent = false;

    function frame(now: number) {
      const realDt = Math.min(now - lastTime, 50);
      lastTime = now;

      if (!dead) {
        elapsed += realDt;

        // Auto-miss notes that passed the hit line
        for (const note of notes) {
          if (note.hit) continue;
          if (elapsed - note.time > GOOD_WINDOW) {
            note.hit = true;
            note.grade = 'MISS';
            onMiss(note.lane);
            if (dead) break;
          }
        }

        // Check hold note completion
        for (const [note, hold] of activeHolds) {
          if (elapsed >= note.time + note.duration) {
            note.holdProgress = 1;
            activeHolds.delete(note);
          }
        }

        // Time's up
        if (elapsed >= timeLimit && !dead) {
          dead = true;
          deathTime = 0;
        }
      }

      if (dead) {
        deathTime += realDt;
      }

      // Update VFX
      particles.update(realDt);
      screenShake.update(realDt);
      screenFlash.update(realDt);
      pulseRings.update(realDt);

      // Render
      renderGame(realDt);

      // Send result after death
      if (dead && deathTime > 600 && !resultSent) {
        resultSent = true;
        const accuracyPct = totalNoteCount > 0
          ? Math.round((totalHits / totalNoteCount) * 100)
          : 0;
        onResultRef.current({
          score,
          perfectHits,
          maxCombo,
          accuracyPct,
        });
        return;
      }

      animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
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
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="max-w-full max-h-full touch-none"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
