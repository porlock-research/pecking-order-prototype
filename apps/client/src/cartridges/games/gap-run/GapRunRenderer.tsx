import { useEffect, useRef, useCallback } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import type { CartridgeTheme } from '@pecking-order/ui-kit/cartridge-theme';
import { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';
import {
  mulberry32,
  ParticleEmitter, TrailRenderer, ScreenShake,
  drawWithGlow, ScreenFlash, SlowMo, PulseRingEmitter,
  FloatingTextEmitter, SpringValue,
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

const px = (v: number) => Math.round(v);

// Distance milestones — 4 tiers, highest reserved for seasoned runs
const MILESTONES: { distance: number; text: string }[] = [
  { distance: 1000,  text: '1K!' },
  { distance: 2500,  text: 'FLYING' },
  { distance: 5000,  text: 'UNREAL' },
  { distance: 10000, text: 'GHOST' },
];

// --- VFX state (lives alongside game state) ---

interface VfxState {
  particles: ParticleEmitter;
  trail: TrailRenderer;
  shake: ScreenShake;
  flash: ScreenFlash;
  slowMo: SlowMo;
  pulseRings: PulseRingEmitter;
  floatingText: FloatingTextEmitter;
  scoreSpring: SpringValue;
  wasOnGround: boolean;
  deathFreezeTimer: number; // ms remaining on death freeze
  ending: boolean; // single guard — end-of-game VFX fire exactly once
  crossedMilestones: Set<number>;
  ambientTimer: number;
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
    slowMo: new SlowMo(),
    pulseRings: new PulseRingEmitter(),
    floatingText: new FloatingTextEmitter(),
    scoreSpring: new SpringValue({ stiffness: 220, damping: 14 }),
    wasOnGround: true,
    deathFreezeTimer: 0,
    ending: false,
    crossedMilestones: new Set(),
    ambientTimer: 0,
  };
}

// --- Distance Zones ---

type ZoneKey = 'gold' | 'pink' | 'info' | 'orange';
const ZONES: ZoneKey[] = ['gold', 'pink', 'info', 'orange'];
const ZONE_LENGTH = 2500;

function getZoneColor(theme: CartridgeTheme, distance: number): string {
  const safe = Math.max(0, distance || 0);
  const idx = Math.floor(safe / ZONE_LENGTH) % ZONES.length;
  return theme.colors[ZONES[idx]];
}

// --- Level Generation ---

// Height variation constants — tuned to JUMP_VELOCITY/GRAVITY so every rise is reachable
const BASE_TOP_Y = PLATFORM_Y;
const MIN_TOP_Y = PLATFORM_Y - 120; // highest platforms (topmost) — wider band for visible variety
const MAX_RISE_DELTA = 70;           // max vertical *upward* step between platforms (apex ≈ 84, 14px margin)
const MAX_DROP_DELTA = 120;          // max downward step (gravity carries further)

interface Segment {
  x: number;
  width: number;
  isGap: boolean;
  topY: number; // y of the platform's top surface (only meaningful for platforms)
}

function generateSegments(
  rng: () => number,
  startX: number,
  endX: number,
  difficulty: number,
  initialTopY: number,
  graceUntilX: number = 0,
): Segment[] {
  const segments: Segment[] = [];
  let x = startX;
  let prevTopY = initialTopY;

  // Height-variation frequency ramps with difficulty.
  // Early game reads as mostly flat with rare rises; late game is much bumpier.
  const flatChance = Math.max(0.2, 0.85 - difficulty * 0.65); // 0.85 → 0.2

  while (x < endX) {
    const minPlatW = Math.max(60, 160 - difficulty * 80);
    const maxPlatW = Math.max(120, 300 - difficulty * 120);
    const platWidth = minPlatW + rng() * (maxPlatW - minPlatW);

    // Grace period — platforms spawned before graceUntilX stay at baseline so the
    // player has a runway to orient themselves before encountering height changes.
    const inGrace = x < graceUntilX;

    // Decide whether this platform changes height
    let topY: number;
    if (inGrace || rng() < flatChance) {
      topY = prevTopY;
    } else {
      // Guaranteed-visible delta: magnitude 45-100% of max.
      // Direction biased away from the floor/ceiling so we never pin to a boundary.
      const roomUp = prevTopY - MIN_TOP_Y;     // how much room above
      const roomDown = BASE_TOP_Y - prevTopY;  // how much room below
      let goingUp: boolean;
      if (roomUp < 20) goingUp = false;        // near ceiling → must drop
      else if (roomDown < 20) goingUp = true;  // near floor → must rise
      else {
        // Bias the coin toward the side with more room so the skyline undulates
        const upProb = roomUp / (roomUp + roomDown);
        goingUp = rng() < upProb;
      }
      const mag = 0.45 + rng() * 0.55; // 0.45..1.0 of max range
      topY = goingUp
        ? prevTopY - mag * MAX_RISE_DELTA
        : prevTopY + mag * MAX_DROP_DELTA;
      topY = Math.max(MIN_TOP_Y, Math.min(BASE_TOP_Y, topY));
    }

    segments.push({ x, width: platWidth, isGap: false, topY });
    x += platWidth;
    prevTopY = topY;

    const minGapW = 40 + difficulty * 30;
    const maxGapW = 100 + difficulty * 60;
    const gapWidth = minGapW + rng() * (maxGapW - minGapW);
    segments.push({ x, width: gapWidth, isGap: true, topY: prevTopY });
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
    { x: 0, width: canvasWidth * 0.6, isGap: false, topY: PLATFORM_Y },
  ];
  const startFrom = canvasWidth * 0.6;
  const initialDifficulty = getDifficulty(0, baseDifficulty);
  // Grace zone: first ~600px (~3.3s at base speed) stay at baseline height
  const graceUntilX = startFrom + 600;
  const aheadSegments = generateSegments(rng, startFrom, canvasWidth * 3, initialDifficulty, PLATFORM_Y, graceUntilX);

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

// Returns the topY of the platform the player is landing on, or null.
function findLanding(px: number, py: number, segments: Segment[]): number | null {
  const playerBottom = py + PLAYER_SIZE;
  const playerLeft = px;
  const playerRight = px + PLAYER_SIZE;

  for (const seg of segments) {
    if (seg.isGap) continue;
    if (playerRight > seg.x && playerLeft < seg.x + seg.width) {
      if (playerBottom >= seg.topY - 2 && playerBottom <= seg.topY + 10) {
        return seg.topY;
      }
    }
  }
  return null;
}

// Returns true if player is penetrating the side of a taller platform (wall-slam).
function hitsWall(px: number, py: number, segments: Segment[]): boolean {
  const playerBottom = py + PLAYER_SIZE;
  const playerLeft = px;
  const playerRight = px + PLAYER_SIZE;

  for (const seg of segments) {
    if (seg.isGap) continue;
    if (playerRight > seg.x && playerLeft < seg.x + seg.width) {
      // Horizontal overlap; if body is meaningfully below the top, we're inside the wall
      if (playerBottom > seg.topY + 4) return true;
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

  const worldX = state.playerX + newCameraX;

  // Landing check — only when falling
  if (newVY >= 0) {
    const landingY = findLanding(worldX, newY, state.segments);
    if (landingY !== null) {
      newY = landingY - PLAYER_SIZE;
      newVY = 0;
      onGround = true;
    }
  }

  // Wall collision — ran into a taller platform face
  if (!onGround && hitsWall(worldX, newY, state.segments)) {
    return { ...state, alive: false, distance: newDistance, elapsed, cameraX: newCameraX };
  }

  if (newY > CANVAS_HEIGHT + 50) {
    return { ...state, alive: false, distance: newDistance, elapsed, cameraX: newCameraX };
  }

  let { segments, generatedUpTo, rng } = state;
  const lookAhead = newCameraX + canvasWidth * 2.5;
  if (generatedUpTo < lookAhead) {
    const difficulty = getDifficulty(newDistance, state.baseDifficulty);
    // Find the last platform's topY to continue the height chain smoothly
    let lastTopY = PLATFORM_Y;
    for (let i = segments.length - 1; i >= 0; i--) {
      if (!segments[i].isGap) { lastTopY = segments[i].topY; break; }
    }
    const newSegs = generateSegments(rng, generatedUpTo, lookAhead, difficulty, lastTopY);
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

// --- Find platform edges adjacent to gaps, with their topY, for glow dots ---

function findGapEdges(segments: Segment[], cameraX: number, canvasWidth: number): { x: number; topY: number }[] {
  const edges: { x: number; topY: number }[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.isGap) continue;
    const leftScreen = seg.x - cameraX;
    const rightScreen = seg.x + seg.width - cameraX;
    // Left edge of this platform — if preceding segment is a gap (or start)
    const prev = segments[i - 1];
    if ((!prev || prev.isGap) && leftScreen > -10 && leftScreen < canvasWidth + 10) {
      edges.push({ x: leftScreen, topY: seg.topY });
    }
    // Right edge of this platform — if following segment is a gap
    const next = segments[i + 1];
    if ((!next || next.isGap) && rightScreen > -10 && rightScreen < canvasWidth + 10) {
      edges.push({ x: rightScreen, topY: seg.topY });
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

  // Zone color — cycles every 2500m for visual variety
  const zoneColor = getZoneColor(theme, distance);

  // Parallax background lines (subtle)
  ctx.strokeStyle = withAlpha(zoneColor, 0.04);
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const parallaxOffset = (cameraX * (0.1 + i * 0.05)) % canvasWidth;
    const y = 30 + i * 35;
    ctx.beginPath();
    ctx.moveTo(-parallaxOffset, y);
    ctx.lineTo(canvasWidth - parallaxOffset, y);
    ctx.moveTo(canvasWidth - parallaxOffset, y);
    ctx.lineTo(canvasWidth * 2 - parallaxOffset, y);
    ctx.stroke();
  }

  // Platforms — each at its own topY
  for (const seg of segments) {
    if (seg.isGap) continue;
    const screenX = seg.x - cameraX;
    if (screenX + seg.width < -10 || screenX > canvasWidth + 10) continue;

    const radius = theme.radius.sm;
    const x = screenX;
    const y = seg.topY;
    const w = seg.width;
    const h = CANVAS_HEIGHT - y;

    ctx.fillStyle = withAlpha(zoneColor, theme.opacity.subtle + 0.04);
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

    // Top surface stripe — bright zone color so top edge reads clearly
    ctx.strokeStyle = withAlpha(zoneColor, theme.opacity.medium + 0.1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.stroke();
  }

  // Platform edge glow — bright dots at each platform edge next to a gap
  const gapEdges = findGapEdges(segments, cameraX, canvasWidth);
  for (const edge of gapEdges) {
    drawWithGlow(ctx, zoneColor, 12, () => {
      ctx.fillStyle = withAlpha(zoneColor, 0.75);
      ctx.beginPath();
      ctx.arc(edge.x, edge.topY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Player trail (drawn behind player)
  vfx.trail.draw(ctx);

  // Player
  if (alive) {
    const screenPlayerX = playerX;
    const centerX = px(screenPlayerX + PLAYER_SIZE / 2);
    const centerY = px(playerY + PLAYER_SIZE / 2);
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

  // Pulse rings (behind particles, above player)
  vfx.pulseRings.draw(ctx);

  // Particles (on top of everything)
  vfx.particles.draw(ctx);

  // Floating text (above particles)
  vfx.floatingText.draw(ctx);

  // HUD: distance (with spring pulse scale)
  const distScale = 1 + vfx.scoreSpring.value;
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.translate(canvasWidth - 12, 20);
  ctx.scale(distScale, distScale);
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = withAlpha(theme.colors.gold, 0.8);
  ctx.fillText(`${Math.floor(distance)}m`, 0, 0);
  ctx.restore();

  // HUD: time
  const remaining = Math.max(0, timeLimit - elapsed);
  const seconds = Math.ceil(remaining / 1000);
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = seconds <= 10 ? withAlpha(theme.colors.danger, 0.8) : withAlpha(theme.colors.text, 0.4);
  ctx.fillText(`${seconds}s`, 12, 20);

  // Screen flash (drawn over game content)
  vfx.flash.draw(ctx, canvasWidth, CANVAS_HEIGHT);

  // Death summary — floating callout renders the title; show stats only after a beat
  if (!alive && vfx.deathFreezeTimer <= 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvasWidth, CANVAS_HEIGHT);
    ctx.font = '12px monospace';
    ctx.fillStyle = withAlpha(theme.colors.text, 0.55);
    ctx.textAlign = 'center';
    ctx.fillText(`Distance: ${Math.floor(distance)}m`, canvasWidth / 2, CANVAS_HEIGHT / 2 + 22);
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

      const rawDtMs = Math.max(0, Math.min(50, now - lastTimeRef.current));
      lastTimeRef.current = now;

      // Slow-mo scales game-simulation dt only; VFX run at real dt
      const simDtMs = vfx.slowMo.update(rawDtMs);
      const simDtSec = simDtMs / 1000;
      const dtMs = rawDtMs;

      const current = gameStateRef.current!;
      const activeCanvas = canvasRef.current;
      const prevDistance = current.distance;
      const updated = updateGame(current, simDtSec, activeCanvas?.width ?? canvasWidth, timeLimit);
      gameStateRef.current = updated;

      // --- VFX updates ---
      const t = themeRef.current;

      // Score pulse — target drifts back to 0; bumped on point crossings
      vfx.scoreSpring.target = 0;
      vfx.scoreSpring.update(dtMs);

      // Milestone crossings — slow-mo + shake + flash + rings + particles + floating text
      if (updated.alive) {
        for (const m of MILESTONES) {
          if (prevDistance < m.distance && updated.distance >= m.distance && !vfx.crossedMilestones.has(m.distance)) {
            vfx.crossedMilestones.add(m.distance);
            // No slow-mo on milestones — keep flow at speed; slow-mo reserved for death
            vfx.shake.trigger({ intensity: 6, duration: 220 });
            vfx.flash.trigger(withAlpha(t.colors.gold, 0.25), 120);
            vfx.scoreSpring.target = 0.3;
            const cx = updated.playerX + PLAYER_SIZE / 2;
            const cy = updated.playerY + PLAYER_SIZE / 2;
            vfx.pulseRings.emit({
              x: cx, y: cy,
              color: t.colors.gold,
              maxRadius: 70,
              duration: 550,
              lineWidth: 2,
            });
            vfx.particles.emit({
              count: 35,
              position: { x: cx, y: cy },
              velocity: { min: 80, max: 220 },
              angle: { min: 0, max: Math.PI * 2 },
              lifetime: { min: 400, max: 800 },
              size: { start: 3, end: 0.5 },
              color: [t.colors.gold, t.colors.pink, '#ffffff'],
              opacity: { start: 1, end: 0 },
              gravity: 60,
            });
            vfx.floatingText.emit({
              text: m.text,
              x: canvasWidth / 2,
              y: CANVAS_HEIGHT / 2 - 10,
              color: t.colors.gold,
              fontSize: 18,
              duration: 900,
              drift: 40,
            });
          }
        }
      }

      // Update VFX systems (real dt)
      vfx.particles.update(dtMs);
      vfx.shake.update(dtMs);
      vfx.flash.update(dtMs);
      vfx.pulseRings.update(dtMs);
      vfx.floatingText.update(dtMs);

      // Ambient speed particles — emit faint dots proportional to speed
      if (updated.alive) {
        vfx.ambientTimer += dtMs;
        const speedForAmbient = getSpeed(updated.elapsed, updated.baseDifficulty);
        const ambientInterval = Math.max(60, 220 - (speedForAmbient - BASE_SPEED) * 0.5);
        if (vfx.ambientTimer >= ambientInterval) {
          vfx.ambientTimer = 0;
          vfx.particles.emit({
            count: 1,
            position: { x: canvasWidth + 8, y: 40 + Math.random() * (CANVAS_HEIGHT - 70) },
            velocity: { min: speedForAmbient * 1.2, max: speedForAmbient * 1.6 },
            angle: { min: Math.PI, max: Math.PI },
            lifetime: { min: 500, max: 900 },
            size: { start: 1.2, end: 0.2 },
            color: withAlpha(t.colors.gold, 0.5),
            opacity: { start: 0.35, end: 0 },
          });
        }
      }

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

      // Death effects — trigger once via ending guard
      if (!updated.alive && !vfx.ending) {
        vfx.ending = true;
        vfx.deathFreezeTimer = 200; // 200ms freeze before overlay
        const timedOut = updated.elapsed >= timeLimit - 1;

        // Screen shake + flash
        vfx.shake.trigger({ intensity: timedOut ? 5 : 9, duration: timedOut ? 300 : 450 });
        vfx.flash.trigger(
          withAlpha(timedOut ? t.colors.gold : t.colors.danger, 0.35),
          320,
        );

        const lastX = updated.playerX + PLAYER_SIZE / 2;
        const lastY = updated.playerY + PLAYER_SIZE / 2;

        // Death burst particles — scattered fragments
        vfx.particles.emit({
          count: 22,
          position: { x: lastX, y: lastY },
          velocity: { min: 80, max: 220 },
          angle: { min: 0, max: Math.PI * 2 },
          lifetime: { min: 500, max: 950 },
          size: { start: 4, end: 0.5 },
          color: timedOut
            ? [t.colors.gold, t.colors.pink, '#ffffff']
            : [t.colors.gold, t.colors.danger, t.colors.pink],
          opacity: { start: 1, end: 0 },
          gravity: 220,
        });

        // Floating callout — "CRASHED!" or "TIME'S UP!"
        vfx.floatingText.emit({
          text: timedOut ? "TIME'S UP!" : 'CRASHED!',
          x: canvasWidth / 2,
          y: CANVAS_HEIGHT / 2 - 20,
          color: timedOut ? t.colors.gold : t.colors.danger,
          fontSize: 20,
          duration: 1200,
          drift: 30,
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
        if (vfx.particles.activeCount > 0 || vfx.deathFreezeTimer > 0 || !vfx.scoreSpring.settled) {
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
