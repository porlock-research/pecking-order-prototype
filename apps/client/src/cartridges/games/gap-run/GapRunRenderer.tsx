import { useEffect, useRef, useCallback } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import type { CartridgeTheme } from '@pecking-order/ui-kit/cartridge-theme';
import { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';
import {
  mulberry32,
  ParticleEmitter, TrailRenderer, ScreenShake,
  drawWithGlow, ScreenFlash,
} from '../shared/canvas-vfx';

// --- Game Constants ---

const GRAVITY = 1800;
const JUMP_VELOCITY = -550;
const BASE_SPEED = 180;
const MAX_SPEED = 480;
const SPEED_RAMP_TIME = 40_000;
const PLAYER_SIZE = 20;
const CANVAS_HEIGHT = 200;
const PLATFORM_Y = CANVAS_HEIGHT - 30;

// --- VFX state (lives alongside game state) ---

interface VfxState {
  particles: ParticleEmitter;
  trail: TrailRenderer;
  shake: ScreenShake;
  flash: ScreenFlash;
  wasOnGround: boolean;
  deathFreezeTimer: number; // ms remaining on death freeze
  deathTriggered: boolean;
}

function createVfxState(): VfxState {
  return {
    particles: new ParticleEmitter(),
    trail: new TrailRenderer({
      maxPoints: 18,
      width: { start: 10, end: 1 },
      color: (i, total) => withAlpha('#fbbf24', 0.4 * (1 - i / total)),
      opacity: { start: 0.5, end: 0 },
    }),
    shake: new ScreenShake(),
    flash: new ScreenFlash(),
    wasOnGround: true,
    deathFreezeTimer: 0,
    deathTriggered: false,
  };
}

// --- Level Generation ---

interface Segment {
  x: number;
  width: number;
  isGap: boolean;
}

function generateSegments(rng: () => number, startX: number, endX: number, difficulty: number): Segment[] {
  const segments: Segment[] = [];
  let x = startX;

  while (x < endX) {
    const minPlatW = Math.max(60, 160 - difficulty * 80);
    const maxPlatW = Math.max(120, 300 - difficulty * 120);
    const platWidth = minPlatW + rng() * (maxPlatW - minPlatW);
    segments.push({ x, width: platWidth, isGap: false });
    x += platWidth;

    const minGapW = 40 + difficulty * 30;
    const maxGapW = 100 + difficulty * 60;
    const gapWidth = minGapW + rng() * (maxGapW - minGapW);
    segments.push({ x, width: gapWidth, isGap: true });
    x += gapWidth;
  }

  return segments;
}

// --- Canvas Game Loop ---

interface GameState {
  playerX: number;
  playerY: number;
  playerVY: number;
  onGround: boolean;
  distance: number;
  jumps: number;
  alive: boolean;
  startTime: number;
  elapsed: number;
  segments: Segment[];
  generatedUpTo: number;
  rng: () => number;
  cameraX: number;
  baseDifficulty: number;
}

function createGameState(seed: number, canvasWidth: number, baseDifficulty: number): GameState {
  const rng = mulberry32(seed);

  const initialSegments: Segment[] = [
    { x: 0, width: canvasWidth * 0.6, isGap: false },
  ];
  const startFrom = canvasWidth * 0.6;
  const initialDifficulty = getDifficulty(0, baseDifficulty);
  const aheadSegments = generateSegments(rng, startFrom, canvasWidth * 3, initialDifficulty);

  const allSegments = [...initialSegments, ...aheadSegments];
  const lastSeg = allSegments[allSegments.length - 1];
  const actualEnd = lastSeg ? lastSeg.x + lastSeg.width : canvasWidth * 3;

  return {
    playerX: 60,
    playerY: PLATFORM_Y - PLAYER_SIZE,
    playerVY: 0,
    onGround: true,
    distance: 0,
    jumps: 0,
    alive: true,
    startTime: performance.now(),
    elapsed: 0,
    segments: allSegments,
    generatedUpTo: actualEnd,
    rng,
    cameraX: 0,
    baseDifficulty,
  };
}

function getSpeed(elapsed: number, baseDifficulty: number): number {
  const speedOffset = baseDifficulty * 120;
  const rampTime = SPEED_RAMP_TIME * (1 - baseDifficulty * 0.5);
  const t = Math.min(1, elapsed / rampTime);
  return (BASE_SPEED + speedOffset) + (MAX_SPEED - BASE_SPEED - speedOffset) * t;
}

function getDifficulty(distance: number, baseDifficulty: number): number {
  const distanceRamp = Math.min(1, distance / 10000);
  return baseDifficulty + (1 - baseDifficulty) * distanceRamp;
}

function isOnPlatform(px: number, py: number, segments: Segment[]): boolean {
  const playerBottom = py + PLAYER_SIZE;
  const playerLeft = px;
  const playerRight = px + PLAYER_SIZE;

  if (playerBottom < PLATFORM_Y - 2 || playerBottom > PLATFORM_Y + 8) return false;

  for (const seg of segments) {
    if (seg.isGap) continue;
    if (playerRight > seg.x && playerLeft < seg.x + seg.width) {
      return true;
    }
  }
  return false;
}

function updateGame(state: GameState, dt: number, canvasWidth: number, timeLimit: number): GameState {
  if (!state.alive) return state;

  const elapsed = performance.now() - state.startTime;
  if (elapsed >= timeLimit) {
    return { ...state, alive: false, elapsed: timeLimit };
  }

  const speed = getSpeed(elapsed, state.baseDifficulty);
  const moveX = speed * dt;

  const newCameraX = state.cameraX + moveX;
  const newDistance = state.distance + moveX;

  let newVY = state.playerVY + GRAVITY * dt;
  let newY = state.playerY + newVY * dt;
  let onGround = false;

  if (newVY >= 0) {
    const worldX = state.playerX + newCameraX;
    if (isOnPlatform(worldX, newY, state.segments)) {
      newY = PLATFORM_Y - PLAYER_SIZE;
      newVY = 0;
      onGround = true;
    }
  }

  if (newY > CANVAS_HEIGHT + 50) {
    return { ...state, alive: false, distance: newDistance, elapsed, cameraX: newCameraX };
  }

  let { segments, generatedUpTo, rng } = state;
  const lookAhead = newCameraX + canvasWidth * 2.5;
  if (generatedUpTo < lookAhead) {
    const difficulty = getDifficulty(newDistance, state.baseDifficulty);
    const newSegs = generateSegments(rng, generatedUpTo, lookAhead, difficulty);
    segments = [...segments, ...newSegs];
    const lastSeg = newSegs[newSegs.length - 1];
    generatedUpTo = lastSeg ? lastSeg.x + lastSeg.width : lookAhead;
  }

  const pruneX = newCameraX - 200;
  segments = segments.filter(s => s.x + s.width > pruneX);

  return {
    ...state,
    playerY: newY,
    playerVY: newVY,
    onGround,
    distance: newDistance,
    elapsed,
    segments,
    generatedUpTo,
    rng,
    cameraX: newCameraX,
  };
}

// --- Find gap edges for glow effect ---

function findGapEdges(segments: Segment[], cameraX: number, canvasWidth: number): { x: number; side: 'left' | 'right' }[] {
  const edges: { x: number; side: 'left' | 'right' }[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg.isGap) continue;
    const leftEdgeScreen = seg.x - cameraX;
    const rightEdgeScreen = seg.x + seg.width - cameraX;
    // Left edge of gap = right edge of preceding platform
    if (leftEdgeScreen > -10 && leftEdgeScreen < canvasWidth + 10) {
      edges.push({ x: leftEdgeScreen, side: 'left' });
    }
    // Right edge of gap = left edge of following platform
    if (rightEdgeScreen > -10 && rightEdgeScreen < canvasWidth + 10) {
      edges.push({ x: rightEdgeScreen, side: 'right' });
    }
  }
  return edges;
}

function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasWidth: number,
  timeLimit: number,
  theme: CartridgeTheme,
  vfx: VfxState,
) {
  const { cameraX, playerX, playerY, playerVY, segments, distance, elapsed, alive } = state;

  // Apply screen shake
  vfx.shake.apply(ctx);

  ctx.fillStyle = theme.colors.bg;
  ctx.fillRect(0, 0, canvasWidth, CANVAS_HEIGHT);

  // Speed factor for speed lines
  const speed = getSpeed(elapsed, state.baseDifficulty);
  const speedFactor = Math.min(1, (speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED));

  // Speed lines — faint horizontal lines racing past
  if (speedFactor > 0.05) {
    const lineCount = Math.floor(3 + speedFactor * 12);
    ctx.strokeStyle = withAlpha(theme.colors.text, 0.03 * speedFactor);
    ctx.lineWidth = 1;
    for (let i = 0; i < lineCount; i++) {
      // Deterministic positions using camera offset
      const seed = (i * 7919 + Math.floor(cameraX * 0.3)) % 1000;
      const y = (seed * 0.2) % CANVAS_HEIGHT;
      const lineLen = 20 + (seed % 40);
      const xOff = (cameraX * (1.5 + (i % 3) * 0.5)) % (canvasWidth + lineLen);
      ctx.beginPath();
      ctx.moveTo(canvasWidth - xOff, y);
      ctx.lineTo(canvasWidth - xOff + lineLen, y);
      ctx.stroke();
    }
  }

  // Parallax background lines
  ctx.strokeStyle = withAlpha(theme.colors.gold, 0.03);
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const parallaxOffset = (cameraX * (0.1 + i * 0.05)) % canvasWidth;
    const y = 30 + i * 35;
    ctx.beginPath();
    ctx.moveTo(-parallaxOffset, y);
    ctx.lineTo(canvasWidth - parallaxOffset, y);
    ctx.moveTo(canvasWidth - parallaxOffset, y);
    ctx.lineTo(canvasWidth * 2 - parallaxOffset, y);
    ctx.stroke();
  }

  // Platforms
  for (const seg of segments) {
    if (seg.isGap) continue;
    const screenX = seg.x - cameraX;
    if (screenX + seg.width < -10 || screenX > canvasWidth + 10) continue;

    ctx.fillStyle = withAlpha(theme.colors.gold, theme.opacity.subtle + 0.02);
    const radius = theme.radius.sm;
    const x = screenX;
    const y = PLATFORM_Y;
    const w = seg.width;
    const h = CANVAS_HEIGHT - PLATFORM_Y;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = withAlpha(theme.colors.gold, theme.opacity.medium);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.stroke();
  }

  // Platform edge glow — bright dots at edges near gaps
  const gapEdges = findGapEdges(segments, cameraX, canvasWidth);
  for (const edge of gapEdges) {
    drawWithGlow(ctx, theme.colors.gold, 12, () => {
      ctx.fillStyle = withAlpha(theme.colors.gold, 0.6);
      ctx.beginPath();
      ctx.arc(edge.x, PLATFORM_Y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Player trail (drawn behind player)
  vfx.trail.draw(ctx);

  // Player
  if (alive) {
    const screenPlayerX = playerX;
    const centerX = screenPlayerX + PLAYER_SIZE / 2;
    const centerY = playerY + PLAYER_SIZE / 2;
    const rotation = Math.max(-0.3, Math.min(0.3, playerVY * 0.0004));

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);

    // Player square with enhanced glow
    drawWithGlow(ctx, theme.colors.gold, 15, () => {
      ctx.fillStyle = theme.colors.gold;
      ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    });

    // Bright white center pixel
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1.5, -1.5, 3, 3);

    ctx.restore();
  }

  // Particles (on top of everything)
  vfx.particles.draw(ctx);

  // HUD: distance
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = withAlpha(theme.colors.gold, 0.7);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.floor(distance)}m`, canvasWidth - 12, 20);

  // HUD: time
  const remaining = Math.max(0, timeLimit - elapsed);
  const seconds = Math.ceil(remaining / 1000);
  ctx.textAlign = 'left';
  ctx.fillStyle = seconds <= 10 ? withAlpha(theme.colors.danger, 0.8) : withAlpha(theme.colors.text, 0.4);
  ctx.fillText(`${seconds}s`, 12, 20);

  // Screen flash (drawn over game content)
  vfx.flash.draw(ctx, canvasWidth, CANVAS_HEIGHT);

  // Death overlay
  if (!alive && vfx.deathFreezeTimer <= 0) {
    // Fade to black after freeze
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvasWidth, CANVAS_HEIGHT);
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = theme.colors.gold;
    ctx.textAlign = 'center';
    const label = elapsed >= timeLimit - 1000 ? 'TIME UP!' : 'GAME OVER';
    ctx.fillText(label, canvasWidth / 2, CANVAS_HEIGHT / 2 - 8);
    ctx.font = '12px monospace';
    ctx.fillStyle = withAlpha(theme.colors.text, 0.5);
    ctx.fillText(`Distance: ${Math.floor(distance)}m`, canvasWidth / 2, CANVAS_HEIGHT / 2 + 14);
  }

  // Restore from screen shake
  vfx.shake.restore(ctx);
}

// --- Renderer Component ---

export default function GapRunRenderer({ seed, difficulty, timeLimit, onResult }: ArcadeRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useCartridgeTheme(containerRef);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const vfxRef = useRef<VfxState | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const resultSentRef = useRef(false);

  // Stable ref for onResult — prevents game loop effect from re-running on parent re-renders
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const handleJump = useCallback(() => {
    const gs = gameStateRef.current;
    const vfx = vfxRef.current;
    if (!gs || !gs.alive || !gs.onGround) return;

    // Jump particles — dust downward from feet
    if (vfx) {
      const t = themeRef.current;
      const screenCenterX = gs.playerX + PLAYER_SIZE / 2;
      const footY = gs.playerY + PLAYER_SIZE;
      vfx.particles.emit({
        count: 7,
        position: { x: screenCenterX, y: footY },
        velocity: { min: 30, max: 80 },
        angle: { min: Math.PI * 0.25, max: Math.PI * 0.75 }, // downward spread
        lifetime: { min: 200, max: 400 },
        size: { start: 2.5, end: 0.5 },
        color: t.colors.gold,
        opacity: { start: 0.7, end: 0 },
        gravity: 200,
      });
    }

    gameStateRef.current = {
      ...gs,
      playerVY: JUMP_VELOCITY,
      onGround: false,
      jumps: gs.jumps + 1,
    };
  }, []);

  // Initialize game loop on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasWidth = canvas.width;

    const gs = createGameState(seed || Date.now(), canvasWidth, difficulty ?? 0);
    gameStateRef.current = gs;
    const vfx = createVfxState();
    vfxRef.current = vfx;
    lastTimeRef.current = performance.now();
    resultSentRef.current = false;

    const loop = (now: number) => {
      if (pausedRef.current) {
        lastTimeRef.current = now;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const rawDt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      const dtMs = rawDt * 1000;
      lastTimeRef.current = now;

      const current = gameStateRef.current!;
      const activeCanvas = canvasRef.current;
      const updated = updateGame(current, rawDt, activeCanvas?.width ?? canvasWidth, timeLimit);
      gameStateRef.current = updated;

      // --- VFX updates ---
      const t = themeRef.current;

      // Update VFX systems
      vfx.particles.update(dtMs);
      vfx.shake.update(dtMs);
      vfx.flash.update(dtMs);

      if (updated.alive) {
        // Push player position to trail
        const screenCenterX = updated.playerX + PLAYER_SIZE / 2;
        const centerY = updated.playerY + PLAYER_SIZE / 2;
        vfx.trail.push(screenCenterX, centerY);

        // Landing dust — onGround transitions from false to true
        if (updated.onGround && !vfx.wasOnGround) {
          const footY = updated.playerY + PLAYER_SIZE;
          vfx.particles.emit({
            count: 9,
            position: { x: screenCenterX, y: footY },
            velocity: { min: 40, max: 100 },
            angle: { min: -Math.PI * 0.15, max: Math.PI * 0.15 }, // spread outward (left)
            lifetime: { min: 200, max: 450 },
            size: { start: 2, end: 0.5 },
            color: t.colors.gold,
            opacity: { start: 0.5, end: 0 },
            gravity: 100,
          });
          // Mirror — particles going right
          vfx.particles.emit({
            count: 9,
            position: { x: screenCenterX, y: footY },
            velocity: { min: 40, max: 100 },
            angle: { min: Math.PI * 0.85, max: Math.PI * 1.15 },
            lifetime: { min: 200, max: 450 },
            size: { start: 2, end: 0.5 },
            color: t.colors.gold,
            opacity: { start: 0.5, end: 0 },
            gravity: 100,
          });
        }
        vfx.wasOnGround = updated.onGround;
      }

      // Death effects — trigger once when alive transitions to false
      if (!updated.alive && !vfx.deathTriggered) {
        vfx.deathTriggered = true;
        vfx.deathFreezeTimer = 200; // 200ms freeze before overlay

        // Screen shake
        vfx.shake.trigger({ intensity: 8, duration: 400 });

        // Screen flash
        vfx.flash.trigger(withAlpha(t.colors.danger, 0.3), 300);

        // Death burst particles
        const lastX = updated.playerX + PLAYER_SIZE / 2;
        const lastY = updated.playerY + PLAYER_SIZE / 2;
        vfx.particles.emit({
          count: 15,
          position: { x: lastX, y: lastY },
          velocity: { min: 60, max: 180 },
          angle: { min: 0, max: Math.PI * 2 },
          lifetime: { min: 400, max: 800 },
          size: { start: 3.5, end: 0.5 },
          color: [t.colors.gold, t.colors.danger, t.colors.pink],
          opacity: { start: 1, end: 0 },
          gravity: 150,
        });
      }

      // Count down death freeze timer
      if (vfx.deathFreezeTimer > 0) {
        vfx.deathFreezeTimer -= dtMs;
      }

      // Render
      if (activeCanvas) {
        const ctx = activeCanvas.getContext('2d')!;
        renderGame(ctx, updated, activeCanvas.width, timeLimit, t, vfx);
      }

      if (!updated.alive) {
        // Keep animating VFX for a short period after death
        if (vfx.particles.activeCount > 0 || vfx.deathFreezeTimer > 0) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        if (!resultSentRef.current) {
          resultSentRef.current = true;
          onResultRef.current({
            distance: Math.floor(updated.distance),
            jumps: updated.jumps,
            timeElapsed: Math.floor(updated.elapsed),
          });
        }
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [seed, difficulty, timeLimit]);

  // Input handlers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleJump();
      }
    };

    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      handleJump();
    };

    const onMouse = () => handleJump();

    window.addEventListener('keydown', onKeyDown);
    const canvas = canvasRef.current;
    canvas?.addEventListener('touchstart', onTouch, { passive: false });
    canvas?.addEventListener('mousedown', onMouse);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      canvas?.removeEventListener('touchstart', onTouch);
      canvas?.removeEventListener('mousedown', onMouse);
    };
  }, [handleJump]);

  // Visibility change: pause/resume
  useEffect(() => {
    const handler = () => {
      pausedRef.current = document.hidden;
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  return (
    <div ref={containerRef} className="px-4 pb-4">
      <canvas
        ref={canvasRef}
        width={320}
        height={CANVAS_HEIGHT}
        className="w-full rounded-lg border border-white/[0.06] cursor-pointer"
        style={{ touchAction: 'none', imageRendering: 'pixelated' }}
      />
      <p className="text-[10px] font-mono text-skin-dim/50 text-center mt-1.5">
        Tap / Space / Click to jump
      </p>
    </div>
  );
}
