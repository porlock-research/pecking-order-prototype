import { useEffect, useRef } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import {
  mulberry32,
  ParticleEmitter, ScreenShake, ScreenFlash,
  FloatingTextEmitter, PulseRingEmitter, SpringValue, SlowMo,
} from '../shared/canvas-vfx';
import { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';

const CANVAS_W = 400;
const CANVAS_H = 460;

// --- Puzzle constants ---
const TUBE_COUNT = 7;
const COLORS_COUNT = 5;
const TUBE_CAPACITY = 4;
const EMPTY_TUBES = 2;
const BALL_R = 18;
const BALL_DIAM = BALL_R * 2;
const BALL_SPACING = BALL_DIAM + 2;

// --- Layout ---
const HUD_H = 40;
const TUBE_TOP = HUD_H + 48;       // below HUD + above for floating ball
const TUBE_BOTTOM = CANVAS_H - 40;
const TUBE_W = BALL_R * 2 + 10;    // glass tube inner width is slightly wider than ball
const TUBE_WALL = 3;

// --- Physics ---
const DROP_GRAVITY = 2200;    // px/s^2
const BOUNCE_DAMPING = 0.38;
const FRICTION = 0.88;
const LIFT_TIME = 180;        // ms for pickup spring animation

// --- Candy palette (5 marble colors) ---
// Vibrant, saturated, highly distinguishable. Each has a body, highlight, shadow, rim.
interface MarbleSkin {
  body: string;
  highlight: string;
  shadow: string;
  rim: string;
  glow: string;
}
const SKINS: MarbleSkin[] = [
  // Cherry red
  { body: '#ff4864', highlight: '#ffb0c0', shadow: '#a01030', rim: '#ffdce4', glow: '#ff7090' },
  // Tangerine
  { body: '#ff9030', highlight: '#ffd098', shadow: '#a85008', rim: '#ffe8c8', glow: '#ffb868' },
  // Lime
  { body: '#68d840', highlight: '#c8f098', shadow: '#1e7018', rim: '#e0f8c8', glow: '#98e868' },
  // Sky
  { body: '#4898f8', highlight: '#a8d0ff', shadow: '#104098', rim: '#d8e8ff', glow: '#70b8ff' },
  // Grape
  { body: '#a858e8', highlight: '#d8b0ff', shadow: '#501098', rim: '#e8d0ff', glow: '#c088f0' },
];

// --- Stage palette ---
const STAGE = {
  bgTop:      '#1a0f2e',
  bgBottom:   '#2a1845',
  surface:    '#0a0418',
  surfaceHi:  '#4020a0',
  plate:      '#2d1a52',
  plateEdge:  '#100820',
  plateRim:   '#6040b8',
  // Glass tube
  glassFill:  'rgba(255, 255, 255, 0.04)',
  glassStroke: 'rgba(255, 255, 255, 0.16)',
  glassHi:    'rgba(255, 255, 255, 0.22)',
  glassDark:  'rgba(0, 0, 0, 0.35)',
  // Selected tube
  selectStroke: '#ffd868',
  selectGlow: '#ffd868',
  // Sorted tube
  sortedGlow:  '#68d840',
  sortedStroke:'#b0f080',
  // HUD
  hudText:    '#ffffff',
  hudDim:     'rgba(255, 255, 255, 0.55)',
  hudAccent:  '#ffd868',
};

interface FloatingBall {
  color: number;
  fromTube: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  phase: 'lifting' | 'traveling' | 'falling' | 'landed';
  liftT: number;            // 0..1 during lifting
  bounceCount: number;
}

const px = (v: number) => Math.round(v);

function tubeCenterX(i: number): number {
  const gap = CANVAS_W / (TUBE_COUNT + 1);
  return gap * (i + 1);
}

function ballYInTube(ballIdx: number): number {
  // ballIdx 0 = bottom. Return center Y.
  return TUBE_BOTTOM - BALL_R - ballIdx * BALL_SPACING;
}

export default function ColorSortRenderer({ seed, difficulty, timeLimit, onResult }: ArcadeRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useCartridgeTheme(containerRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !theme) return;
    const ctx = canvas.getContext('2d')!;
    const rng = mulberry32(seed);

    // --- Puzzle state ---
    // Shuffle depth scales with difficulty (harder = more scrambled)
    const shuffleSteps = 60 + Math.floor((difficulty || 0) * 80);
    const tubes: number[][] = [];
    for (let i = 0; i < COLORS_COUNT; i++) {
      tubes.push(Array(TUBE_CAPACITY).fill(i));
    }
    for (let i = 0; i < EMPTY_TUBES; i++) {
      tubes.push([]);
    }
    // Reverse-shuffle: pop random top, push onto random other non-full tube.
    for (let step = 0; step < shuffleSteps; step++) {
      const fromCandidates: number[] = [];
      for (let i = 0; i < tubes.length; i++) if (tubes[i].length > 0) fromCandidates.push(i);
      const from = fromCandidates[Math.floor(rng() * fromCandidates.length)];
      const toCandidates: number[] = [];
      for (let i = 0; i < tubes.length; i++) {
        if (i !== from && tubes[i].length < TUBE_CAPACITY) toCandidates.push(i);
      }
      if (toCandidates.length === 0) continue;
      const to = toCandidates[Math.floor(rng() * toCandidates.length)];
      tubes[to].push(tubes[from].pop()!);
    }

    let selected = -1;
    let moves = 0;
    let elapsed = 0;
    let gameOver = false;
    let floating: FloatingBall | null = null;
    const settledTubes = new Set<number>();   // animates "just completed" once
    const completedTubes = new Set<number>(); // persistent completed set

    // --- VFX ---
    const particles = new ParticleEmitter();
    const shake = new ScreenShake();
    const flash = new ScreenFlash();
    const floatingText = new FloatingTextEmitter();
    const pulseRings = new PulseRingEmitter();
    const slowMo = new SlowMo();
    const tubeShakes: Record<number, SpringValue> = {};
    const tubeCompleteGlow: Record<number, number> = {}; // ms countdown post-complete
    const selectGlow = new SpringValue({ stiffness: 180, damping: 16 });
    selectGlow.snap(0);
    const solveCelebrate = { active: false, t: 0 };
    let ending = false; // time-up or solve in progress — blocks input + further triggers

    function isSolved(): boolean {
      let sorted = 0;
      for (const t of tubes) {
        if (t.length === TUBE_CAPACITY && t.every(b => b === t[0])) sorted++;
      }
      return sorted === COLORS_COUNT;
    }

    function sortedCount(): number {
      let c = 0;
      for (const t of tubes) {
        if (t.length === TUBE_CAPACITY && t.every(b => b === t[0])) c++;
      }
      return c;
    }

    function currentScore(): number {
      return sortedCount() * 20; // 20 points per sorted tube
    }

    function finish() {
      if (gameOver) return;
      gameOver = true;
      const score = currentScore();
      const solved = isSolved() ? 1 : 0;
      onResult({ score, sortedTubes: sortedCount(), solved });
    }

    function handleTubeComplete(tubeIdx: number) {
      if (completedTubes.has(tubeIdx)) return;
      completedTubes.add(tubeIdx);
      settledTubes.add(tubeIdx);
      tubeCompleteGlow[tubeIdx] = 900;
      const cx = tubeCenterX(tubeIdx);
      const cy = (TUBE_TOP + TUBE_BOTTOM) / 2;
      const skin = SKINS[tubes[tubeIdx][0]];
      slowMo.trigger(0.45, 220);
      flash.trigger(withAlpha(skin.body, 0.25), 140);
      shake.trigger({ intensity: 7, duration: 260 });
      pulseRings.emit({ x: cx, y: cy, color: skin.body, maxRadius: 80, duration: 600 });
      pulseRings.emit({ x: cx, y: cy, color: skin.highlight, maxRadius: 55, duration: 450 });
      particles.emit({
        count: 28,
        position: { x: cx, y: cy },
        velocity: { min: 90, max: 240 },
        angle: { min: 0, max: Math.PI * 2 },
        lifetime: { min: 600, max: 1100 },
        size: { start: 4, end: 0 },
        color: [skin.body, skin.highlight, skin.glow],
        opacity: { start: 1, end: 0 },
      });
      floatingText.emit({
        text: 'SORTED!',
        x: cx, y: cy - 30,
        color: skin.body, fontSize: 18, duration: 850,
      });
      // Vertical confetti bursts from each ball position
      for (let i = 0; i < TUBE_CAPACITY; i++) {
        const by = ballYInTube(i);
        particles.emit({
          count: 6,
          position: { x: cx, y: by },
          velocity: { min: 40, max: 140 },
          angle: { min: -Math.PI * 0.85, max: -Math.PI * 0.15 },
          lifetime: { min: 500, max: 900 },
          size: { start: 3, end: 0 },
          color: [skin.highlight, skin.body],
          opacity: { start: 1, end: 0 },
        });
      }

      // Check full solve
      if (isSolved() && !ending) {
        ending = true;
        solveCelebrate.active = true;
        solveCelebrate.t = 0;
        setTimeout(() => {
          if (gameOver) return;
          finish();
        }, 1600);
      }
    }

    // --- Input ---
    // Ownership model: pickup POPS the ball off the source tube. The floating
    // ball owns it until either (a) it's placed (push to destination on settle)
    // or (b) the player cancels (push back to source on settle).
    function pickupFromTube(tubeIdx: number) {
      if (tubes[tubeIdx].length === 0) return;
      if (completedTubes.has(tubeIdx)) return;
      const originalIdx = tubes[tubeIdx].length - 1;
      const color = tubes[tubeIdx].pop()!;
      const cx = tubeCenterX(tubeIdx);
      const startY = ballYInTube(originalIdx);
      floating = {
        color,
        fromTube: tubeIdx,           // source tube (positive = owned by source)
        x: cx, y: startY,
        vx: 0, vy: 0,
        targetX: cx,
        targetY: TUBE_TOP - BALL_R - 10,
        phase: 'lifting',
        liftT: 0,
        bounceCount: 0,
      };
      selected = tubeIdx;
      selectGlow.target = 1;
    }

    function dropSelected() {
      if (!floating) return;
      // Cancel: travel back above the source tube, then fall into it.
      const home = floating.fromTube >= 0
        ? floating.fromTube
        : -floating.fromTube - 1; // (shouldn't happen but safe)
      const cx = tubeCenterX(home);
      floating.targetX = cx;
      floating.targetY = TUBE_TOP - BALL_R - 5;
      floating.phase = 'traveling';
      floating.vx = 0;
      floating.vy = 0;
      // Destination encoded as negative so travel → falling transition pushes
      // the ball back onto the source tube.
      floating.fromTube = -(home + 1);
      selected = -1;
      selectGlow.target = 0;
    }

    function tryPlaceInto(tubeIdx: number) {
      if (!floating) return;
      if (tubes[tubeIdx].length >= TUBE_CAPACITY) {
        rejectFlash(tubeIdx);
        return;
      }
      if (tubes[tubeIdx].length > 0) {
        const topColor = tubes[tubeIdx][tubes[tubeIdx].length - 1];
        if (topColor !== floating.color) {
          rejectFlash(tubeIdx);
          return;
        }
      }
      const cx = tubeCenterX(tubeIdx);
      floating.targetX = cx;
      floating.targetY = TUBE_TOP - BALL_R - 5;
      floating.phase = 'traveling';
      floating.vx = 0;
      floating.vy = 0;
      // Destination encoded as negative: the falling-settle logic reads
      // `-floating.fromTube - 1` to push onto the right tube.
      floating.fromTube = -(tubeIdx + 1);
      moves++;
      selected = -1;
      selectGlow.target = 0;
    }

    function rejectFlash(tubeIdx: number) {
      if (!tubeShakes[tubeIdx]) {
        tubeShakes[tubeIdx] = new SpringValue({ stiffness: 500, damping: 12 });
        tubeShakes[tubeIdx].snap(0);
      }
      tubeShakes[tubeIdx].snap(1);
      tubeShakes[tubeIdx].target = 0;
      particles.emit({
        count: 8,
        position: { x: tubeCenterX(tubeIdx), y: TUBE_TOP },
        velocity: { min: 40, max: 100 },
        angle: { min: -Math.PI * 0.9, max: -Math.PI * 0.1 },
        lifetime: { min: 300, max: 500 },
        size: { start: 2.5, end: 0 },
        color: '#ff5080',
        opacity: { start: 1, end: 0 },
      });
    }

    function handlePointerDown(e: PointerEvent) {
      if (gameOver || ending) return;
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      const scale = CANVAS_W / rect.width;
      const mx = (e.clientX - rect.left) * scale;
      const my = (e.clientY - rect.top) * scale;
      if (my < HUD_H) return;
      // Find closest tube
      let closest = -1, closestDist = Infinity;
      for (let i = 0; i < TUBE_COUNT; i++) {
        const d = Math.abs(mx - tubeCenterX(i));
        if (d < closestDist) { closestDist = d; closest = i; }
      }
      if (closestDist > TUBE_W * 0.7) return;

      if (floating && (floating.phase === 'falling' || floating.phase === 'traveling')) {
        return; // already animating, ignore
      }

      if (selected < 0) {
        pickupFromTube(closest);
      } else if (closest === selected) {
        dropSelected();
      } else {
        tryPlaceInto(closest);
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

      // Time limit
      if (!ending && elapsed >= timeLimit) {
        ending = true;
        floatingText.emit({
          text: "TIME'S UP!",
          x: CANVAS_W / 2, y: CANVAS_H / 2,
          color: STAGE.hudAccent, fontSize: 24, duration: 800,
        });
        flash.trigger(withAlpha(STAGE.hudAccent, 0.2), 160);
        setTimeout(() => finish(), 700);
      }

      // --- Floating ball physics ---
      if (floating) {
        if (floating.phase === 'lifting') {
          floating.liftT = Math.min(1, floating.liftT + dt / LIFT_TIME);
          // Ease-out
          const t = 1 - (1 - floating.liftT) * (1 - floating.liftT);
          const fromY = ballYInTube(tubes[floating.fromTube].length - 1);
          floating.y = fromY + (floating.targetY - fromY) * t;
          if (floating.liftT >= 1) {
            floating.phase = 'landed'; // hover — waiting for click
          }
        } else if (floating.phase === 'traveling') {
          // Horizontal ease to target, slight vertical settling
          const dx = floating.targetX - floating.x;
          const dy = floating.targetY - floating.y;
          const speed = 0.22;
          floating.x += dx * speed;
          floating.y += dy * speed;
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
            floating.x = floating.targetX;
            floating.y = floating.targetY;
            if (floating.fromTube < 0) {
              // Destination encoded as negative — switch to falling
              floating.phase = 'falling';
              floating.vy = 0;
            } else {
              // Returning home — settle
              floating.phase = 'landed';
              floating = null;
            }
          }
        } else if (floating.phase === 'falling') {
          const dtSec = dt / 1000;
          floating.vy += DROP_GRAVITY * dtSec;
          floating.y += floating.vy * dtSec;
          const destTube = -floating.fromTube - 1;
          const restY = ballYInTube(tubes[destTube].length);
          if (floating.y >= restY) {
            floating.y = restY;
            floating.vy = -floating.vy * BOUNCE_DAMPING;
            floating.bounceCount++;
            // small impact VFX
            const skin = SKINS[floating.color];
            particles.emit({
              count: 4,
              position: { x: floating.x, y: restY + BALL_R },
              velocity: { min: 30, max: 80 },
              angle: { min: Math.PI, max: Math.PI * 2 },
              lifetime: { min: 250, max: 500 },
              size: { start: 2.5, end: 0 },
              color: skin.highlight,
              opacity: { start: 0.8, end: 0 },
            });
            if (Math.abs(floating.vy) < 40) {
              // Settle
              tubes[destTube].push(floating.color);
              const settledTube = destTube;
              floating = null;
              // Check complete
              const t = tubes[settledTube];
              if (t.length === TUBE_CAPACITY && t.every(b => b === t[0])) {
                handleTubeComplete(settledTube);
              }
            }
          }
        }
      }

      // Update VFX
      particles.update(dt);
      shake.update(dt);
      flash.update(dt);
      floatingText.update(dt);
      pulseRings.update(dt);
      selectGlow.update(dt);
      for (const k in tubeShakes) tubeShakes[k].update(dt);
      for (const k in tubeCompleteGlow) tubeCompleteGlow[k] = Math.max(0, tubeCompleteGlow[k] - rawDt);
      if (solveCelebrate.active) solveCelebrate.t += rawDt;

      drawFrame(ctx);
      animId = requestAnimationFrame(loop);
    }

    // --- Drawing ---
    function drawFrame(ctx: CanvasRenderingContext2D) {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      shake.apply(ctx);

      // Backdrop — gradient + noise-free vignette
      const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      bg.addColorStop(0, STAGE.bgTop);
      bg.addColorStop(1, STAGE.bgBottom);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Soft radial glow behind the plate
      const glow = ctx.createRadialGradient(
        CANVAS_W / 2, (TUBE_TOP + TUBE_BOTTOM) / 2, 20,
        CANVAS_W / 2, (TUBE_TOP + TUBE_BOTTOM) / 2, 260,
      );
      glow.addColorStop(0, withAlpha(STAGE.surfaceHi, 0.25));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Stage plate — where tubes sit
      drawPlate(ctx);

      // Tubes + balls
      for (let i = 0; i < TUBE_COUNT; i++) drawTube(ctx, i);

      // Floating ball (above tubes)
      if (floating) drawFloatingBall(ctx);

      // VFX
      particles.draw(ctx);
      pulseRings.draw(ctx);
      floatingText.draw(ctx);

      // HUD
      drawHud(ctx);

      // Full-solve celebration overlay
      if (solveCelebrate.active) drawSolveCelebration(ctx);

      flash.draw(ctx, CANVAS_W, CANVAS_H);
      shake.restore(ctx);
    }

    function drawPlate(ctx: CanvasRenderingContext2D) {
      const plateY = TUBE_BOTTOM + 4;
      const plateH = 16;
      // Top edge highlight
      ctx.fillStyle = STAGE.plateRim;
      ctx.fillRect(0, plateY, CANVAS_W, 2);
      // Body
      ctx.fillStyle = STAGE.plate;
      ctx.fillRect(0, plateY + 2, CANVAS_W, plateH - 2);
      // Shadow underside
      ctx.fillStyle = STAGE.plateEdge;
      ctx.fillRect(0, plateY + plateH - 2, CANVAS_W, 2);
      // Little pin caps where each tube sits
      for (let i = 0; i < TUBE_COUNT; i++) {
        const cx = px(tubeCenterX(i));
        ctx.fillStyle = STAGE.plateEdge;
        ctx.fillRect(cx - TUBE_W / 2 - 2, plateY - 2, TUBE_W + 4, 3);
        ctx.fillStyle = STAGE.plateRim;
        ctx.fillRect(cx - TUBE_W / 2, plateY - 2, TUBE_W, 1);
      }
    }

    function drawTube(ctx: CanvasRenderingContext2D, i: number) {
      const rawCx = tubeCenterX(i);
      const shakeAmt = tubeShakes[i] ? tubeShakes[i].value * 6 * Math.sin(elapsed * 0.08) : 0;
      const cx = px(rawCx + shakeAmt);
      const tubeX = cx - TUBE_W / 2;
      const radius = 14;
      const isSel = selected === i;
      const isComplete = completedTubes.has(i);
      const glowT = (tubeCompleteGlow[i] || 0) / 900;

      // Drop shadow under tube
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(cx, TUBE_BOTTOM + 5, TUBE_W * 0.6, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Complete-glow halo
      if (isComplete || glowT > 0) {
        const skin = SKINS[tubes[i][0]];
        const pulse = 0.6 + Math.sin(elapsed * 0.005) * 0.2 + glowT * 0.4;
        ctx.save();
        ctx.shadowColor = skin.body;
        ctx.shadowBlur = 24;
        ctx.strokeStyle = withAlpha(skin.body, pulse);
        ctx.lineWidth = 3;
        roundRect(ctx, tubeX - 2, TUBE_TOP - 2, TUBE_W + 4, TUBE_BOTTOM - TUBE_TOP + 4, radius);
        ctx.stroke();
        ctx.restore();
      }

      // Glass body (back — darker shading)
      ctx.fillStyle = STAGE.glassFill;
      roundRect(ctx, tubeX, TUBE_TOP, TUBE_W, TUBE_BOTTOM - TUBE_TOP, radius);
      ctx.fill();

      // Clip path for balls inside the tube
      ctx.save();
      roundRect(ctx, tubeX, TUBE_TOP, TUBE_W, TUBE_BOTTOM - TUBE_TOP, radius);
      ctx.clip();

      // Balls — pickup pops from the source tube, so the array already
      // reflects the correct stack; just draw what's there.
      for (let j = 0; j < tubes[i].length; j++) {
        drawBall(ctx, cx, ballYInTube(j), tubes[i][j]);
      }
      ctx.restore();

      // Glass stroke (outline) — last so it overlays balls
      // Selected gets a gold outline with pulse
      const selectT = selectGlow.value * (isSel ? 1 : 0);
      if (selectT > 0.01) {
        ctx.save();
        ctx.shadowColor = STAGE.selectGlow;
        ctx.shadowBlur = 18 * selectT;
        ctx.strokeStyle = withAlpha(STAGE.selectStroke, 0.5 + 0.5 * selectT);
        ctx.lineWidth = 2 + selectT;
        roundRect(ctx, tubeX, TUBE_TOP, TUBE_W, TUBE_BOTTOM - TUBE_TOP, radius);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = STAGE.glassStroke;
        ctx.lineWidth = 1.5;
        roundRect(ctx, tubeX, TUBE_TOP, TUBE_W, TUBE_BOTTOM - TUBE_TOP, radius);
        ctx.stroke();
      }

      // Glass highlight on left edge — thin vertical stripe
      const grad = ctx.createLinearGradient(tubeX, 0, tubeX + TUBE_W, 0);
      grad.addColorStop(0, STAGE.glassHi);
      grad.addColorStop(0.25, 'rgba(255,255,255,0.04)');
      grad.addColorStop(0.7, 'rgba(0,0,0,0)');
      grad.addColorStop(1, STAGE.glassDark);
      ctx.fillStyle = grad;
      roundRect(ctx, tubeX, TUBE_TOP, TUBE_W, TUBE_BOTTOM - TUBE_TOP, radius);
      ctx.fill();

      // Rim — thin ellipse at the opening
      ctx.strokeStyle = STAGE.glassHi;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, TUBE_TOP, TUBE_W / 2 - 1, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, TUBE_TOP + 2, TUBE_W / 2 - 2, 1.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, colorIdx: number) {
      const skin = SKINS[colorIdx];
      // Shadow below
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(x, y + BALL_R - 2, BALL_R * 0.75, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rim ring
      ctx.fillStyle = skin.shadow;
      ctx.beginPath();
      ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      // Main body
      ctx.fillStyle = skin.body;
      ctx.beginPath();
      ctx.arc(x, y, BALL_R - 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Gradient shine (top-left highlight fading into body)
      const grad = ctx.createRadialGradient(
        x - BALL_R * 0.4, y - BALL_R * 0.4, 1,
        x - BALL_R * 0.3, y - BALL_R * 0.3, BALL_R * 1.1,
      );
      grad.addColorStop(0, withAlpha(skin.rim, 0.95));
      grad.addColorStop(0.35, withAlpha(skin.highlight, 0.35));
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, BALL_R - 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Sharp specular dot (top-left)
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(x - BALL_R * 0.35, y - BALL_R * 0.35, BALL_R * 0.18, 0, Math.PI * 2);
      ctx.fill();
      // Subtle bottom bounce light (colored glow)
      ctx.fillStyle = withAlpha(skin.glow, 0.25);
      ctx.beginPath();
      ctx.ellipse(x, y + BALL_R * 0.5, BALL_R * 0.5, BALL_R * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawFloatingBall(ctx: CanvasRenderingContext2D) {
      if (!floating) return;
      // Soft drop shadow on the plate where the ball hovers
      const shadowAlpha = 0.25 - Math.min(0.22, (floating.y - TUBE_TOP) / 400);
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0.05, shadowAlpha)})`;
      ctx.beginPath();
      ctx.ellipse(floating.x, TUBE_BOTTOM + 6, BALL_R * 0.55, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      drawBall(ctx, floating.x, floating.y, floating.color);
    }

    function drawHud(ctx: CanvasRenderingContext2D) {
      // Subtle top strip
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(0, 0, CANVAS_W, HUD_H);
      ctx.fillStyle = withAlpha(STAGE.plateRim, 0.3);
      ctx.fillRect(0, HUD_H, CANVAS_W, 1);

      // Left: moves
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = STAGE.hudDim;
      ctx.fillText('MOVES', 14, 12);
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = STAGE.hudText;
      ctx.fillText(`${moves}`, 14, 28);

      // Center: time remaining
      const remain = Math.max(0, Math.ceil((timeLimit - elapsed) / 1000));
      const timeColor =
        remain <= 10 ? '#ff5080' : remain <= 20 ? STAGE.hudAccent : STAGE.hudText;
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = STAGE.hudDim;
      ctx.fillText('TIME', CANVAS_W / 2, 12);
      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = timeColor;
      const mm = Math.floor(remain / 60);
      const ss = String(remain % 60).padStart(2, '0');
      ctx.fillText(`${mm}:${ss}`, CANVAS_W / 2, 28);

      // Right: sorted count
      const sc = sortedCount();
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = STAGE.hudDim;
      ctx.fillText('SORTED', CANVAS_W - 14, 12);
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = sc === COLORS_COUNT ? STAGE.sortedGlow : STAGE.hudText;
      ctx.fillText(`${sc}/${COLORS_COUNT}`, CANVAS_W - 14, 28);
    }

    function drawSolveCelebration(ctx: CanvasRenderingContext2D) {
      // Rainbow flash across the plate
      const t = Math.min(1, solveCelebrate.t / 1400);
      const cx = CANVAS_W / 2;
      const cy = CANVAS_H / 2;
      // Expanding radial rings
      for (let r = 0; r < 3; r++) {
        const ringT = (solveCelebrate.t / 1400 + r * 0.2) % 1;
        const radius = ringT * 320;
        const skin = SKINS[r % SKINS.length];
        ctx.strokeStyle = withAlpha(skin.body, (1 - ringT) * 0.6);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Headline
      ctx.save();
      const scale = 0.8 + Math.sin(t * Math.PI) * 0.3;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillText('SOLVED!', 2, 2);
      ctx.fillStyle = STAGE.hudAccent;
      ctx.fillText('SOLVED!', 0, 0);
      ctx.restore();
    }

    function roundRect(
      ctx: CanvasRenderingContext2D,
      x: number, y: number, w: number, h: number,
      r: number,
    ) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h - rr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      ctx.lineTo(x + rr, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
      ctx.closePath();
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
