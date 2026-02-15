import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { SocialPlayer, GapRunProjection } from '@pecking-order/shared-types';
import {
  CountdownBar,
  CartridgeContainer,
  CartridgeHeader,
  CelebrationSequence,
} from './game-shared';

interface GapRunProps {
  cartridge: GapRunProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

// --- Game Constants ---

const GRAVITY = 1800;
const JUMP_VELOCITY = -550;
const BASE_SPEED = 200;
const MAX_SPEED = 450;
const SPEED_RAMP_TIME = 40_000;
const PLAYER_SIZE = 20;
const CANVAS_HEIGHT = 200;
const PLATFORM_Y = CANVAS_HEIGHT - 30;
const TIME_LIMIT = 45_000;

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
    // Platform
    const minPlatW = Math.max(80, 220 - difficulty * 100);
    const maxPlatW = Math.max(120, 220 - difficulty * 50);
    const platWidth = minPlatW + rng() * (maxPlatW - minPlatW);
    segments.push({ x, width: platWidth, isGap: false });
    x += platWidth;

    // Gap
    const minGapW = 50 + difficulty * 40;
    const maxGapW = 70 + difficulty * 60;
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
}

function createGameState(seed: number, canvasWidth: number): GameState {
  const rng = mulberry32(seed);

  // Generate initial ground platform + segments ahead
  const initialSegments: Segment[] = [
    { x: 0, width: canvasWidth * 0.6, isGap: false },
  ];
  const startFrom = canvasWidth * 0.6;
  const aheadSegments = generateSegments(rng, startFrom, canvasWidth * 3, 0);

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
    segments: [...initialSegments, ...aheadSegments],
    generatedUpTo: canvasWidth * 3,
    rng,
    cameraX: 0,
  };
}

function getSpeed(elapsed: number): number {
  const t = Math.min(1, elapsed / SPEED_RAMP_TIME);
  return BASE_SPEED + (MAX_SPEED - BASE_SPEED) * t;
}

function getDifficulty(distance: number): number {
  return Math.min(1, distance / 10000);
}

function isOnPlatform(px: number, py: number, segments: Segment[]): boolean {
  const playerBottom = py + PLAYER_SIZE;
  const playerLeft = px;
  const playerRight = px + PLAYER_SIZE;

  // Only check collision if player is at platform level
  if (playerBottom < PLATFORM_Y - 2 || playerBottom > PLATFORM_Y + 8) return false;

  for (const seg of segments) {
    if (seg.isGap) continue;
    if (playerRight > seg.x && playerLeft < seg.x + seg.width) {
      return true;
    }
  }
  return false;
}

function updateGame(state: GameState, dt: number, canvasWidth: number): GameState {
  if (!state.alive) return state;

  const elapsed = performance.now() - state.startTime;
  if (elapsed >= TIME_LIMIT) {
    return { ...state, alive: false, elapsed: TIME_LIMIT };
  }

  const speed = getSpeed(elapsed);
  const moveX = speed * dt;

  // Move camera and player forward
  const newCameraX = state.cameraX + moveX;
  const newDistance = state.distance + moveX;

  // Apply gravity
  let newVY = state.playerVY + GRAVITY * dt;
  let newY = state.playerY + newVY * dt;
  let onGround = false;

  // Check platform collision (only when falling)
  if (newVY >= 0) {
    const worldX = state.playerX + newCameraX;
    if (isOnPlatform(worldX, newY, state.segments)) {
      newY = PLATFORM_Y - PLAYER_SIZE;
      newVY = 0;
      onGround = true;
    }
  }

  // Fell off screen
  if (newY > CANVAS_HEIGHT + 50) {
    return { ...state, alive: false, distance: newDistance, elapsed, cameraX: newCameraX };
  }

  // Generate more terrain ahead
  let { segments, generatedUpTo, rng } = state;
  const lookAhead = newCameraX + canvasWidth * 2.5;
  if (generatedUpTo < lookAhead) {
    const difficulty = getDifficulty(newDistance);
    const newSegs = generateSegments(rng, generatedUpTo, lookAhead, difficulty);
    segments = [...segments, ...newSegs];
    generatedUpTo = lookAhead;
  }

  // Prune old segments behind camera
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

function renderGame(ctx: CanvasRenderingContext2D, state: GameState, canvasWidth: number) {
  const { cameraX, playerX, playerY, playerVY, segments, distance, elapsed, alive } = state;

  // Clear
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

    // Platform body
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

    // Top edge highlight
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

    // Rotation based on vertical velocity
    const rotation = Math.max(-0.3, Math.min(0.3, playerVY * 0.0004));
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);

    // Gold square
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
  const remaining = Math.max(0, TIME_LIMIT - elapsed);
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
    const label = elapsed >= TIME_LIMIT - 1000 ? 'TIME UP!' : 'GAME OVER';
    ctx.fillText(label, canvasWidth / 2, CANVAS_HEIGHT / 2 - 8);
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(`Distance: ${Math.floor(distance)}m`, canvasWidth / 2, CANVAS_HEIGHT / 2 + 14);
  }
}

// --- Main Component ---

export default function GapRun({ cartridge, playerId, engine, onDismiss }: GapRunProps) {
  const { status, silverReward, goldContribution, seed, timeLimit } = cartridge;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const resultSentRef = useRef(false);
  const [gamePhase, setGamePhase] = useState<'NOT_STARTED' | 'PLAYING' | 'DEAD' | 'COMPLETED'>(
    status === 'COMPLETED' ? 'COMPLETED' : 'NOT_STARTED'
  );
  const [gameDeadline, setGameDeadline] = useState<number | null>(null);
  const [finalDistance, setFinalDistance] = useState(cartridge.distance || 0);
  const [finalJumps, setFinalJumps] = useState(cartridge.jumps || 0);

  // Handle jump input
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

  // Send result to server
  const sendResult = useCallback((gs: GameState) => {
    if (resultSentRef.current) return;
    resultSentRef.current = true;
    engine.sendGameAction('GAME.GAP_RUN.RESULT', {
      distance: Math.floor(gs.distance),
      jumps: gs.jumps,
      timeElapsed: Math.floor(gs.elapsed),
    });
  }, [engine]);

  // Start game
  const handleStart = useCallback(() => {
    engine.sendGameAction('GAME.GAP_RUN.START');

    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasWidth = canvas.width;

    const gs = createGameState(seed || Date.now(), canvasWidth);
    gameStateRef.current = gs;
    lastTimeRef.current = performance.now();
    resultSentRef.current = false;
    setGamePhase('PLAYING');
    setGameDeadline(Date.now() + (timeLimit || TIME_LIMIT));

    const loop = (now: number) => {
      if (pausedRef.current) {
        lastTimeRef.current = now;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      const current = gameStateRef.current!;
      const updated = updateGame(current, dt, canvasWidth);
      gameStateRef.current = updated;

      const ctx = canvas.getContext('2d');
      if (ctx) renderGame(ctx, updated, canvasWidth);

      if (!updated.alive) {
        setFinalDistance(Math.floor(updated.distance));
        setFinalJumps(updated.jumps);
        setGamePhase('DEAD');
        sendResult(updated);
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [seed, timeLimit, engine, sendResult]);

  // Input handlers
  useEffect(() => {
    if (gamePhase !== 'PLAYING') return;

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
  }, [gamePhase, handleJump]);

  // Visibility change: pause/resume
  useEffect(() => {
    const handler = () => {
      pausedRef.current = document.hidden;
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Cleanup raf on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Transition from DEAD → COMPLETED when server confirms
  useEffect(() => {
    if (status === 'COMPLETED' && gamePhase === 'DEAD') {
      const timer = setTimeout(() => setGamePhase('COMPLETED'), 1200);
      return () => clearTimeout(timer);
    }
    if (status === 'COMPLETED' && gamePhase === 'NOT_STARTED') {
      setGamePhase('COMPLETED');
    }
  }, [status, gamePhase]);

  // Compute silver breakdown for celebration
  const distanceSilver = Math.min(15, Math.floor(finalDistance / 100));
  const survived = finalDistance > 0 && cartridge.timeElapsed >= (timeLimit || TIME_LIMIT) - 1000;
  const survivalBonus = survived ? 5 : 0;

  return (
    <CartridgeContainer>
      <CartridgeHeader
        label="Gap Run"
        score={gamePhase === 'COMPLETED' ? silverReward : undefined}
        showScore={gamePhase === 'COMPLETED'}
      />

      {gamePhase === 'PLAYING' && gameDeadline && (
        <div className="px-4 pt-2">
          <CountdownBar deadline={gameDeadline} totalMs={timeLimit || TIME_LIMIT} />
        </div>
      )}

      {/* NOT_STARTED: Start Screen */}
      {gamePhase === 'NOT_STARTED' && (
        <div className="p-6 space-y-4 text-center">
          <div className="space-y-2">
            <p className="text-sm font-bold text-skin-base">Gap Run</p>
            <p className="text-xs text-skin-dim leading-relaxed">
              Jump over gaps to survive as long as possible. Tap or press Space to jump.
              The longer you run, the more silver you earn!
            </p>
          </div>
          {/* Preview canvas */}
          <canvas
            ref={canvasRef}
            width={320}
            height={CANVAS_HEIGHT}
            className="w-full rounded-lg border border-white/[0.06]"
            style={{ imageRendering: 'pixelated' }}
          />
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-skin-gold text-skin-inverted font-bold text-sm uppercase tracking-wider rounded-lg hover:brightness-110 active:scale-[0.97] transition-all btn-press shadow-lg"
          >
            Start Running
          </button>
        </div>
      )}

      {/* PLAYING: Canvas game */}
      {gamePhase === 'PLAYING' && (
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
      )}

      {/* DEAD: Brief game-over overlay (before server confirms) */}
      {gamePhase === 'DEAD' && (
        <div className="p-6 text-center space-y-3 animate-fade-in">
          <canvas
            ref={canvasRef}
            width={320}
            height={CANVAS_HEIGHT}
            className="w-full rounded-lg border border-white/[0.06] opacity-60"
            style={{ imageRendering: 'pixelated' }}
          />
          <p className="text-sm font-mono text-skin-dim animate-pulse">Calculating score...</p>
        </div>
      )}

      {/* COMPLETED: Celebration */}
      {gamePhase === 'COMPLETED' && (
        <CelebrationSequence
          title="Gap Run Complete"
          subtitle={survived ? 'Full Survival!' : undefined}
          silverEarned={silverReward}
          goldContribution={goldContribution}
          onDismiss={onDismiss}
          breakdown={
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
              <div className="flex justify-between text-skin-dim">
                <span>Distance</span>
                <span className="text-skin-base font-bold">{finalDistance}m</span>
              </div>
              <div className="flex justify-between text-skin-dim">
                <span>Distance Silver</span>
                <span className="text-skin-base font-bold">{distanceSilver} silver</span>
              </div>
              {survivalBonus > 0 && (
                <div className="flex justify-between">
                  <span className="text-skin-gold gold-glow">Survival Bonus</span>
                  <span className="text-skin-gold font-bold gold-glow">+{survivalBonus} silver</span>
                </div>
              )}
              <div className="flex justify-between text-skin-dim">
                <span>Jumps</span>
                <span className="text-skin-base">{finalJumps}</span>
              </div>
            </div>
          }
        />
      )}
    </CartridgeContainer>
  );
}
