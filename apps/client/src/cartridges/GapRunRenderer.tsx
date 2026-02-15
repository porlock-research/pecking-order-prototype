import { useEffect, useRef, useCallback } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';

// --- Game Constants ---

const GRAVITY = 1800;
const JUMP_VELOCITY = -550;
const BASE_SPEED = 180;
const MAX_SPEED = 480;
const SPEED_RAMP_TIME = 40_000;
const PLAYER_SIZE = 20;
const CANVAS_HEIGHT = 200;
const PLATFORM_Y = CANVAS_HEIGHT - 30;

// --- Seeded PRNG (Mulberry32) ---

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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

function renderGame(ctx: CanvasRenderingContext2D, state: GameState, canvasWidth: number, timeLimit: number) {
  const { cameraX, playerX, playerY, playerVY, segments, distance, elapsed, alive } = state;

  ctx.fillStyle = '#0d0d12';
  ctx.fillRect(0, 0, canvasWidth, CANVAS_HEIGHT);

  // Parallax background lines
  const lineColor = 'rgba(255, 215, 0, 0.03)';
  ctx.strokeStyle = lineColor;
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

    ctx.fillStyle = 'rgba(255, 215, 0, 0.08)';
    const radius = 4;
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

    ctx.strokeStyle = 'rgba(255, 215, 0, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.stroke();
  }

  // Player
  if (alive) {
    ctx.save();
    const screenPlayerX = playerX;
    const centerX = screenPlayerX + PLAYER_SIZE / 2;
    const centerY = playerY + PLAYER_SIZE / 2;

    const rotation = Math.max(-0.3, Math.min(0.3, playerVY * 0.0004));
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);

    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 8;
    ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // HUD: distance
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = 'rgba(255, 215, 0, 0.7)';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.floor(distance)}m`, canvasWidth - 12, 20);

  // HUD: time
  const remaining = Math.max(0, timeLimit - elapsed);
  const seconds = Math.ceil(remaining / 1000);
  ctx.textAlign = 'left';
  ctx.fillStyle = seconds <= 10 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(255, 255, 255, 0.4)';
  ctx.fillText(`${seconds}s`, 12, 20);

  // Death overlay
  if (!alive) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvasWidth, CANVAS_HEIGHT);
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    const label = elapsed >= timeLimit - 1000 ? 'TIME UP!' : 'GAME OVER';
    ctx.fillText(label, canvasWidth / 2, CANVAS_HEIGHT / 2 - 8);
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(`Distance: ${Math.floor(distance)}m`, canvasWidth / 2, CANVAS_HEIGHT / 2 + 14);
  }
}

// --- Renderer Component ---

export default function GapRunRenderer({ seed, difficulty, timeLimit, onResult }: ArcadeRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const resultSentRef = useRef(false);

  const handleJump = useCallback(() => {
    const gs = gameStateRef.current;
    if (!gs || !gs.alive || !gs.onGround) return;
    gameStateRef.current = {
      ...gs,
      playerVY: JUMP_VELOCITY,
      onGround: false,
      jumps: gs.jumps + 1,
    };
  }, []);

  const sendResult = useCallback((gs: GameState) => {
    if (resultSentRef.current) return;
    resultSentRef.current = true;
    onResult({
      distance: Math.floor(gs.distance),
      jumps: gs.jumps,
      timeElapsed: Math.floor(gs.elapsed),
    });
  }, [onResult]);

  // Initialize game loop on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasWidth = canvas.width;

    const gs = createGameState(seed || Date.now(), canvasWidth, difficulty ?? 0);
    gameStateRef.current = gs;
    lastTimeRef.current = performance.now();
    resultSentRef.current = false;

    const loop = (now: number) => {
      if (pausedRef.current) {
        lastTimeRef.current = now;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      const current = gameStateRef.current!;
      const activeCanvas = canvasRef.current;
      const updated = updateGame(current, dt, activeCanvas?.width ?? canvasWidth, timeLimit);
      gameStateRef.current = updated;

      if (activeCanvas) {
        const ctx = activeCanvas.getContext('2d');
        if (ctx) renderGame(ctx, updated, activeCanvas.width, timeLimit);
      }

      if (!updated.alive) {
        sendResult(updated);
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [seed, difficulty, timeLimit, sendResult]);

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
    <div className="px-4 pb-4">
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
