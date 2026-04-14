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

const START_SIZE = Config.game.recall.startSize;
const MAX_SIZE = Config.game.recall.maxSize;

// Layout — grid always renders within this square box below the HUD
const BOARD_Y = 80;
const BOARD_SIZE = 360;

// Round transition timings
const GRID_INTRO_MS = 380;  // tile cascade-in
const DISSOLVE_MS = 500;    // numbers fading out after first tap — slowed for drama
const CLEAR_CELEBRATE_MS = 900;
const FAIL_REVEAL_MS = 400; // quick game-over transition — no redundant reveal on terminal fail
const HOW_TO_PLAY_MS = 2400;
const FREE_PASS_REVEAL_MS = 700;

// Free-pass allowance scales with grid size — bigger grids get more forgiveness.
// 3×3→1, 4×4→2, 5×5→3, 6×6→4.
function freePassAllowance(size: number): number {
  return Math.max(1, size - 2);
}

type Phase =
  | 'HOW_TO_PLAY' // first round only — overlay explaining the mechanic
  | 'INTRO'       // tiles animating in, numbers just becoming visible
  | 'MEMORIZE'    // full numbers visible, awaiting first tap on "1"
  | 'RECALL'      // numbers dissolved, player tapping 2..N in order
  | 'CLEARED'     // just completed a size, celebrating before next
  | 'FAILED'      // second wrong tap, terminal reveal + wait
  | 'FULL_CLEAR'  // beat 6×6
  | 'TIME_UP';

interface Tile {
  row: number;
  col: number;
  num: number;   // 1-indexed position in sequence
  intro: number; // 0→1 as it animates in
  dissolve: number; // 0→1 once recall begins, numbers fade out
  cleared: boolean;  // true once tapped correctly
  wrongFlash: number; // >0 when tapped wrong; counts down
}

export default function RecallRenderer({ seed, timeLimit, onResult }: ArcadeRendererProps) {
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
    let currentSize: number = START_SIZE;
    let tiles: Tile[] = [];
    let nextNumber = 1;
    let phase: Phase = 'HOW_TO_PLAY';
    let phaseElapsed = 0;
    let elapsed = 0;
    let roundsCleared = 0;
    let roundIndex = 0; // 0 = first size, increments per round
    let highestSize = 0;
    let fullClear = 0;
    let missesThisRound = 0; // free-pass allowance: first miss reveals, second miss ends
    let freePassRevealMs = 0; // countdown while the free-pass reveal is showing
    let freePassTileNum = 0;  // which number was being revealed
    let ending = false;
    let ended = false;

    // --- VFX ---
    const particles = new ParticleEmitter();
    const shake = new ScreenShake();
    const flash = new ScreenFlash();
    const pulseRings = new PulseRingEmitter();
    const floatingText = new FloatingTextEmitter();
    const scorePulse = new SpringValue({ stiffness: 220, damping: 14 });
    scorePulse.snap(1);

    // --- Helpers ---

    function buildTiles(size: number): Tile[] {
      const total = size * size;
      // Random numeric placements 1..total across size² tiles
      const indices = Array.from({ length: total }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      return indices.map((idx, num) => ({
        row: Math.floor(idx / size),
        col: idx % size,
        num: num + 1,
        intro: 0,
        dissolve: 0,
        cleared: false,
        wrongFlash: 0,
      }));
    }

    function cellGeom(size: number) {
      const gap = Math.max(6, Math.round(18 - size * 2)); // 3→12, 4→10, 5→8, 6→6
      const cellPx = (BOARD_SIZE - (size - 1) * gap) / size;
      const boardX = (CANVAS_W - BOARD_SIZE) / 2;
      return { cellPx, gap, boardX, boardY: BOARD_Y };
    }

    function tileRect(tile: Tile, size: number) {
      const { cellPx, gap, boardX, boardY } = cellGeom(size);
      const x = boardX + tile.col * (cellPx + gap);
      const y = boardY + tile.row * (cellPx + gap);
      return { x, y, w: cellPx, h: cellPx };
    }

    function beginRound(size: number) {
      currentSize = size;
      tiles = buildTiles(size);
      nextNumber = 1;
      missesThisRound = 0;
      freePassRevealMs = 0;
      freePassTileNum = 0;
      phase = 'INTRO';
      phaseElapsed = 0;
      const t = themeRef.current!;
      floatingText.emit({
        text: `${size}×${size}`,
        x: CANVAS_W / 2,
        y: BOARD_Y - 30,
        color: t.colors.gold,
        fontSize: 22,
        duration: 700,
        drift: 0,
      });
    }

    // Do NOT start a round yet — first phase is HOW_TO_PLAY which auto-advances.

    // --- Input ---
    function handleTap(clientX: number, clientY: number) {
      if (ending || ended) return;
      // Tap-to-dismiss the how-to-play overlay
      if (phase === 'HOW_TO_PLAY') {
        beginRound(START_SIZE);
        return;
      }
      if (phase !== 'MEMORIZE' && phase !== 'RECALL') return;
      // Suppress taps while a free-pass reveal is active — avoids accidental double-taps
      if (freePassRevealMs > 0) return;

      const rect = canvas!.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * CANVAS_W;
      const y = ((clientY - rect.top) / rect.height) * CANVAS_H;

      const tapped = tiles.find(t => {
        const r = tileRect(t, currentSize);
        return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      });
      if (!tapped || tapped.cleared) return;

      const th = themeRef.current!;

      if (tapped.num === nextNumber) {
        // Correct tap
        tapped.cleared = true;
        nextNumber += 1;
        scorePulse.target = 1.4;

        const r = tileRect(tapped, currentSize);
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;

        particles.emit({
          count: 16,
          position: { x: cx, y: cy },
          velocity: { min: 40, max: 180 },
          angle: { min: 0, max: Math.PI * 2 },
          lifetime: { min: 300, max: 560 },
          size: { start: 4, end: 0 },
          color: [th.colors.gold, th.colors.info],
          opacity: { start: 1, end: 0 },
        }, rng);
        pulseRings.emit({
          x: cx, y: cy,
          color: withAlpha(th.colors.gold, 0.65),
          maxRadius: r.w * 1.3,
          duration: 380,
          lineWidth: 2,
        });

        // First-tap dissolve trigger — theatrical "lock in" moment
        if (phase === 'MEMORIZE') {
          phase = 'RECALL';
          phaseElapsed = 0;
          // Bigger flash + tile-level pulse to sell the dissolve beat
          flash.trigger(withAlpha(th.colors.info, 0.32), 260);
          shake.trigger({ intensity: 3, duration: 180 });
          // Ring pulse sweeping out from the tapped "1"
          pulseRings.emit({
            x: cx, y: cy,
            color: withAlpha(th.colors.info, 0.75),
            maxRadius: BOARD_SIZE * 0.8,
            duration: 520,
            lineWidth: 3,
          });
          // Puff of particles from every remaining number — "they're evaporating"
          for (const other of tiles) {
            if (other.cleared || other.num === 1) continue;
            const otherR = tileRect(other, currentSize);
            particles.emit({
              count: 4,
              position: { x: otherR.x + otherR.w / 2, y: otherR.y + otherR.h / 2 },
              velocity: { min: 10, max: 50 },
              angle: { min: 0, max: Math.PI * 2 },
              lifetime: { min: 260, max: 520 },
              size: { start: 2, end: 0 },
              color: th.colors.text,
              opacity: { start: 0.6, end: 0 },
            }, rng);
          }
        }

        // Round complete?
        if (nextNumber > currentSize * currentSize) {
          onRoundClear();
        }
      } else {
        // Wrong tap
        onWrongTap(tapped);
      }
    }

    function onRoundClear() {
      roundsCleared += 1;
      highestSize = Math.max(highestSize, currentSize);
      const th = themeRef.current!;
      phase = 'CLEARED';
      phaseElapsed = 0;

      floatingText.emit({
        text: 'CLEAR!',
        x: CANVAS_W / 2,
        y: CANVAS_H / 2,
        color: th.colors.gold,
        fontSize: 40,
        duration: 800,
        drift: 20,
      });
      flash.trigger(withAlpha(th.colors.gold, 0.25), 200);
      shake.trigger({ intensity: 5, duration: 200 });

      // Burst at board center
      particles.emit({
        count: 50,
        position: { x: CANVAS_W / 2, y: BOARD_Y + BOARD_SIZE / 2 },
        velocity: { min: 80, max: 280 },
        angle: { min: 0, max: Math.PI * 2 },
        lifetime: { min: 500, max: 1000 },
        size: { start: 5, end: 0 },
        color: [th.colors.gold, th.colors.info, th.colors.pink],
        opacity: { start: 1, end: 0 },
        gravity: 90,
      }, rng);
    }

    function onWrongTap(_tapped: Tile) {
      const th = themeRef.current!;
      scorePulse.target = 0.6;
      missesThisRound += 1;

      // Identify the tile that SHOULD have been tapped
      const correct = tiles.find(t => !t.cleared && t.num === nextNumber);

      const allowance = freePassAllowance(currentSize);
      if (missesThisRound <= allowance) {
        // --- Free pass — reveal the correct tile briefly, don't end the round ---
        if (correct) {
          freePassTileNum = correct.num;
          freePassRevealMs = FREE_PASS_REVEAL_MS;
          const r = tileRect(correct, currentSize);
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          pulseRings.emit({
            x: cx, y: cy,
            color: withAlpha(th.colors.gold, 0.65),
            maxRadius: r.w * 1.6, duration: 520, lineWidth: 3,
          });
        }
        shake.trigger({ intensity: 7, duration: 200 });
        flash.trigger(withAlpha(th.colors.danger, 0.22), 160);
        floatingText.emit({
          text: 'FREE PASS',
          x: CANVAS_W / 2,
          y: BOARD_Y - 10,
          color: th.colors.gold,
          fontSize: 20,
          duration: 700,
          drift: 6,
        });
        return;
      }

      // --- Exceeded allowance — terminal fail. No tile reveal; the game is ending. ---
      phase = 'FAILED';
      phaseElapsed = 0;

      shake.trigger({ intensity: 16, duration: 320 });
      flash.trigger(withAlpha(th.colors.danger, 0.42), 240);

      particles.emit({
        count: 22,
        position: { x: CANVAS_W / 2, y: BOARD_Y + BOARD_SIZE / 2 },
        velocity: { min: 60, max: 220 },
        angle: { min: 0, max: Math.PI * 2 },
        lifetime: { min: 400, max: 700 },
        size: { start: 5, end: 0 },
        color: th.colors.danger,
        opacity: { start: 1, end: 0 },
      }, rng);
    }

    function finishGame(reason: 'FULL_CLEAR' | 'FAILED' | 'TIME_UP') {
      if (ending) return;
      ending = true;
      const th = themeRef.current!;

      if (reason === 'FULL_CLEAR') {
        fullClear = 1;
        phase = 'FULL_CLEAR';
        floatingText.emit({
          text: 'PERFECT',
          x: CANVAS_W / 2,
          y: CANVAS_H / 2 - 24,
          color: th.colors.gold,
          fontSize: 52,
          duration: 1100,
          drift: 14,
          scale: { start: 0.2, peak: 1.6, end: 1.0 },
        });
        flash.trigger(withAlpha(th.colors.gold, 0.45), 320);
        shake.trigger({ intensity: 6, duration: 260 });
        particles.emit({
          count: 80,
          position: { x: CANVAS_W / 2, y: CANVAS_H / 2 },
          velocity: { min: 100, max: 360 },
          angle: { min: 0, max: Math.PI * 2 },
          lifetime: { min: 700, max: 1300 },
          size: { start: 6, end: 0 },
          color: [th.colors.gold, th.colors.info, th.colors.pink, th.colors.orange],
          opacity: { start: 1, end: 0 },
          gravity: 100,
        }, rng);
      } else {
        phase = reason === 'TIME_UP' ? 'TIME_UP' : 'FAILED';
        floatingText.emit({
          text: reason === 'TIME_UP' ? "TIME'S UP" : 'GAME OVER',
          x: CANVAS_W / 2,
          y: CANVAS_H / 2 - 18,
          color: th.colors.danger,
          fontSize: 40,
          duration: 1000,
          drift: 14,
        });
        floatingText.emit({
          text: `ROUND ${roundsCleared}`,
          x: CANVAS_W / 2,
          y: CANVAS_H / 2 + 26,
          color: th.colors.text,
          fontSize: 24,
          duration: 1000,
          drift: 8,
        });
      }

      setTimeout(() => {
        if (ended) return;
        ended = true;
        onResult({
          roundsCleared: Math.floor(roundsCleared),
          highestSize: Math.floor(highestSize),
          fullClear: Math.floor(fullClear),
          timeElapsed: Math.floor(elapsed),
        });
      }, 1200);
    }

    const handlePointer = (e: PointerEvent) => {
      e.preventDefault();
      handleTap(e.clientX, e.clientY);
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
        phaseElapsed += dt;

        // Free-pass reveal countdown (only active during RECALL after first miss)
        if (freePassRevealMs > 0) {
          freePassRevealMs = Math.max(0, freePassRevealMs - dt);
        }

        // Time limit
        if (elapsed >= timeLimit) {
          finishGame('TIME_UP');
        }

        // Phase-specific progression
        if (phase === 'HOW_TO_PLAY') {
          if (phaseElapsed >= HOW_TO_PLAY_MS) {
            beginRound(START_SIZE);
          }
        } else if (phase === 'INTRO') {
          // Advance each tile's intro animation (staggered by index)
          for (let i = 0; i < tiles.length; i++) {
            const start = i * 22; // 22ms stagger
            const localElapsed = phaseElapsed - start;
            tiles[i].intro = Math.max(0, Math.min(1, localElapsed / GRID_INTRO_MS));
          }
          if (phaseElapsed >= GRID_INTRO_MS + tiles.length * 22) {
            phase = 'MEMORIZE';
            phaseElapsed = 0;
          }
        } else if (phase === 'RECALL') {
          // Ramp dissolve on all uncleared, un-"1" tiles
          for (const t of tiles) {
            if (!t.cleared && t.num !== 1) {
              t.dissolve = Math.min(1, t.dissolve + dt / DISSOLVE_MS);
            }
          }
        } else if (phase === 'CLEARED') {
          if (phaseElapsed >= CLEAR_CELEBRATE_MS) {
            if (currentSize >= MAX_SIZE) {
              finishGame('FULL_CLEAR');
            } else {
              roundIndex += 1;
              beginRound(currentSize + 1);
            }
          }
        } else if (phase === 'FAILED') {
          if (phaseElapsed >= FAIL_REVEAL_MS) {
            finishGame('FAILED');
          }
        }

        // Wrong-flash decay on any tile
        for (const t of tiles) {
          if (t.wrongFlash > 0) t.wrongFlash = Math.max(0, t.wrongFlash - dt / 600);
        }
      }

      particles.update(dt);
      shake.update(dt);
      flash.update(dt);
      pulseRings.update(dt);
      floatingText.update(dt);
      scorePulse.update(dt);
      if (scorePulse.settled) scorePulse.target = 1;

      draw(ctx, now);
      animId = requestAnimationFrame(loop);
    }

    function draw(ctx: CanvasRenderingContext2D, _now: number) {
      const t = themeRef.current!;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      shake.apply(ctx);

      // --- BG ---
      ctx.fillStyle = t.colors.bg;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const grd = ctx.createRadialGradient(
        CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.25,
        CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.8,
      );
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // --- Grid (only when a round is active) ---
      if (phase !== 'HOW_TO_PLAY') {
        drawGrid(ctx, t, _now);
      }

      // --- VFX layers ---
      pulseRings.draw(ctx);
      particles.draw(ctx);

      // --- HUD ---
      drawHUD(ctx, t);

      // --- How-to-play overlay (first round only) ---
      if (phase === 'HOW_TO_PLAY') {
        drawHowToPlay(ctx, t);
      }

      // --- Floating text on top ---
      floatingText.draw(ctx);

      shake.restore(ctx);
      flash.draw(ctx, CANVAS_W, CANVAS_H);
    }

    function drawHowToPlay(ctx: CanvasRenderingContext2D, t: CartridgeTheme) {
      const ease = Math.min(1, phaseElapsed / 260);
      const cx = CANVAS_W / 2;
      const cy = CANVAS_H / 2;
      const w = 330;
      const h = 270;
      ctx.save();
      ctx.globalAlpha = ease;

      // Card backdrop
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.strokeStyle = withAlpha(t.colors.gold, 0.5);
      ctx.lineWidth = 2;
      roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 14);
      ctx.fill();
      ctx.stroke();

      // Title
      ctx.fillStyle = t.colors.gold;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('RECALL', cx, cy - h / 2 + 20);

      // Subtitle
      ctx.fillStyle = withAlpha(t.colors.text, 0.7);
      ctx.font = '12px monospace';
      ctx.fillText('MEMORY TEST', cx, cy - h / 2 + 52);

      // Steps
      ctx.font = 'bold 14px monospace';
      const steps = [
        '1.  MEMORIZE the grid positions',
        '2.  TAP 1 to lock in',
        '3.  Numbers VANISH — tap the',
        '    rest in order from memory',
        '4.  1 free pass per round',
      ];
      ctx.textAlign = 'left';
      ctx.fillStyle = t.colors.text;
      for (let i = 0; i < steps.length; i++) {
        ctx.fillText(steps[i], cx - w / 2 + 22, cy - h / 2 + 88 + i * 22);
      }

      // Footer
      ctx.fillStyle = withAlpha(t.colors.info, 0.85);
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TAP TO BEGIN', cx, cy + h / 2 - 22);

      ctx.restore();
    }

    function drawGrid(ctx: CanvasRenderingContext2D, t: CartridgeTheme, now: number) {
      const { cellPx } = cellGeom(currentSize);

      // Pulse ring around the "1" tile during MEMORIZE — draws the eye to the starting action
      if (phase === 'MEMORIZE') {
        const firstTile = tiles.find(x => x.num === 1);
        if (firstTile) {
          const r = tileRect(firstTile, currentSize);
          const pulse = 0.4 + 0.35 * (0.5 + 0.5 * Math.sin(now / 250));
          ctx.save();
          ctx.globalAlpha = pulse;
          ctx.strokeStyle = t.colors.gold;
          ctx.lineWidth = 3;
          roundRect(ctx, r.x - 6, r.y - 6, r.w + 12, r.h + 12, 12);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Free-pass highlight — show the correct tile in gold even though it's been "missed"
      if (freePassRevealMs > 0) {
        const revealTile = tiles.find(x => x.num === freePassTileNum && !x.cleared);
        if (revealTile) {
          const r = tileRect(revealTile, currentSize);
          const fadeT = freePassRevealMs / FREE_PASS_REVEAL_MS;
          ctx.save();
          ctx.globalAlpha = fadeT;
          ctx.fillStyle = withAlpha(t.colors.gold, 0.35);
          ctx.strokeStyle = t.colors.gold;
          ctx.lineWidth = 3;
          roundRect(ctx, r.x, r.y, r.w, r.h, 10);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = t.colors.gold;
          ctx.font = `bold ${Math.round(cellPx * 0.5)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(revealTile.num), r.x + r.w / 2, r.y + r.h / 2);
          ctx.restore();
        }
      }

      for (const tile of tiles) {
        const r = tileRect(tile, currentSize);
        const introS = tile.intro;
        if (introS <= 0) continue;

        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;

        ctx.save();
        ctx.translate(px(cx), px(cy));
        const scale = lerp(0.4, 1, introS);
        ctx.globalAlpha = introS;
        ctx.scale(scale, scale);

        // Tile body
        const cleared = tile.cleared;
        const wrong = tile.wrongFlash;

        let fill = withAlpha(t.colors.panel, 0.9);
        let stroke = withAlpha(t.colors.text, 0.25);
        if (cleared) {
          fill = withAlpha(t.colors.gold, 0.25);
          stroke = withAlpha(t.colors.gold, 0.8);
        } else if (wrong > 0) {
          fill = withAlpha(t.colors.danger, 0.3 + wrong * 0.3);
          stroke = withAlpha(t.colors.danger, 0.9);
        }

        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        roundRect(ctx, -r.w / 2, -r.h / 2, r.w, r.h, 10);
        ctx.fill();
        ctx.stroke();

        // Number
        const numAlpha = Math.max(0, 1 - tile.dissolve);
        // If this is the "1" during MEMORIZE, or the number is visible pre-dissolve,
        // or it's been correctly tapped (cleared), show text.
        const showNumber =
          (phase === 'INTRO' || phase === 'MEMORIZE' || (phase === 'RECALL' && tile.num === 1 && !tile.cleared))
            ? 1
            : (cleared ? 1 : numAlpha);

        if (showNumber > 0.01) {
          ctx.globalAlpha = showNumber * introS;
          ctx.fillStyle = cleared
            ? t.colors.gold
            : (wrong > 0 ? t.colors.danger : t.colors.text);
          const fontSize = Math.round(cellPx * 0.5);
          ctx.font = `bold ${fontSize}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(tile.num), 0, 2);
        }

        ctx.restore();

        // Wrong tile: show what should've been tapped — reveal the correct number big in the center
        if (!cleared && wrong > 0 && phase === 'FAILED') {
          ctx.save();
          ctx.globalAlpha = wrong;
          ctx.fillStyle = withAlpha(t.colors.gold, 0.2);
          ctx.strokeStyle = t.colors.gold;
          ctx.lineWidth = 3;
          roundRect(ctx, r.x, r.y, r.w, r.h, 10);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = t.colors.gold;
          ctx.font = `bold ${Math.round(cellPx * 0.55)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(tile.num), r.x + r.w / 2, r.y + r.h / 2);
          ctx.restore();
        }
      }
    }

    function drawHUD(ctx: CanvasRenderingContext2D, t: CartridgeTheme) {
      // Round plaque (top-left)
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeStyle = withAlpha(t.colors.gold, 0.35);
      ctx.lineWidth = 1;
      roundRect(ctx, px(12), px(12), px(130), px(50), 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = withAlpha(t.colors.text, 0.55);
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('ROUND', px(22), px(18));
      ctx.save();
      ctx.translate(px(22), px(46));
      ctx.scale(scorePulse.value, scorePulse.value);
      ctx.fillStyle = t.colors.gold;
      ctx.font = 'bold 22px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${currentSize}×${currentSize}`, 0, 0);
      ctx.restore();
      ctx.restore();

      // Time plaque (top-right)
      const remaining = Math.max(0, timeLimit - elapsed);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeStyle = withAlpha(t.colors.info, 0.35);
      ctx.lineWidth = 1;
      roundRect(ctx, px(CANVAS_W - 122), px(12), px(110), px(50), 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = withAlpha(t.colors.text, 0.55);
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('TIME', px(CANVAS_W - 112), px(18));
      ctx.fillStyle = t.colors.info;
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${(remaining / 1000).toFixed(1)}s`, px(CANVAS_W - 22), px(46));
      ctx.restore();

      // Large instructional text above the grid (MEMORIZE phase only — crucial onboarding)
      if (phase === 'MEMORIZE') {
        ctx.save();
        ctx.fillStyle = t.colors.gold;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MEMORIZE THE GRID', CANVAS_W / 2, BOARD_Y - 28);
        ctx.fillStyle = withAlpha(t.colors.text, 0.7);
        ctx.font = '11px monospace';
        ctx.fillText('TAP 1 TO LOCK IN · NUMBERS WILL VANISH', CANVAS_W / 2, BOARD_Y - 10);
        ctx.restore();
      }

      // Bottom instruction (contextual)
      const instr = phase === 'RECALL'
        ? (freePassRevealMs > 0 ? 'FREE PASS — TAP THE GOLD TILE' : `TAP ${nextNumber}`)
        : phase === 'CLEARED'
          ? 'NICE — NEXT SIZE'
          : phase === 'FAILED'
            ? 'WRONG — THAT WAS THE TILE'
            : phase === 'FULL_CLEAR'
              ? 'ALL CLEARED'
              : '';
      if (instr) {
        ctx.save();
        ctx.fillStyle = phase === 'FAILED'
          ? t.colors.danger
          : freePassRevealMs > 0
            ? t.colors.gold
            : withAlpha(t.colors.text, 0.85);
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(instr, CANVAS_W / 2, CANVAS_H - 30);
        ctx.restore();
      }

      // Free-pass indicator — shows remaining allowance for this round
      if ((phase === 'MEMORIZE' || phase === 'RECALL') && !ending) {
        const allowance = freePassAllowance(currentSize);
        const remaining = Math.max(0, allowance - missesThisRound);
        ctx.save();
        ctx.fillStyle = remaining > 0
          ? withAlpha(t.colors.gold, 0.7)
          : withAlpha(t.colors.danger, 0.7);
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = remaining === 0
          ? 'NO PASSES LEFT'
          : `${remaining} FREE PASS${remaining === 1 ? '' : 'ES'}`;
        ctx.fillText(label, CANVAS_W / 2, CANVAS_H - 10);
        ctx.restore();
      }
    }

    function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
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
