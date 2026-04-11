import { useEffect, useRef, useCallback } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';
import {
  mulberry32, lerp, distance, angleBetween,
  ParticleEmitter, TrailRenderer, ScreenShake,
  drawWithGlow, SlowMo, ScreenFlash, PulseRingEmitter,
} from '../shared/canvas-vfx';

// --- Constants ---

const CANVAS_SIZE = 400;
const HALF = CANVAS_SIZE / 2;
const STAR_COLORS_KEYS = ['gold', 'orange', 'pink', 'text'] as const;
const INITIAL_ORBIT_RADIUS = 40;
const INITIAL_ORBIT_SPEED = (Math.PI * 2) / 3; // 1 rev per 3s
const ORBIT_SPEED_MULT = 1.08; // 8% faster each transfer
const INITIAL_WELL_RADIUS = 80;
const MIN_WELL_RADIUS = 40;
const WELL_SHRINK_PER_TRANSFER = 2;
const STAR_GENERATE_AHEAD = 300; // px ahead of camera
const STAR_CHUNK_SIZE = 5;
const PLANET_RADIUS = 8;
const PREVIEW_LENGTH = 80;
const DEATH_MARGIN = 200; // px outside viewport to trigger death
const PERFECT_CAPTURE_RATIO = 0.3;
const BACKGROUND_STAR_COUNT = 60;

// --- Star type ---

interface Star {
  x: number;
  y: number;
  orbitRadius: number;
  wellRadius: number;
  color: string;
  size: number;
  pulsePhase: number;
}

export default function OrbitRenderer({ seed, difficulty, timeLimit, onResult }: ArcadeRendererProps) {
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

    // --- Background stars (static, parallax) ---
    const bgStars: { x: number; y: number; size: number; opacity: number; layer: number }[] = [];
    for (let i = 0; i < BACKGROUND_STAR_COUNT; i++) {
      bgStars.push({
        x: rng() * 2000 - 500,
        y: rng() * 2000 - 500,
        size: rng() * 1.5 + 0.5,
        opacity: rng() * 0.3 + 0.1,
        layer: rng() > 0.5 ? 1 : 2,
      });
    }

    // --- Star field ---
    const stars: Star[] = [];
    let furthestX = 0;
    let furthestY = 0;

    function generateStars(count: number) {
      for (let i = 0; i < count; i++) {
        const transferNum = stars.length;
        const wellRadius = Math.max(MIN_WELL_RADIUS, INITIAL_WELL_RADIUS - transferNum * WELL_SHRINK_PER_TRANSFER);
        wellRadius * (1 - difficulty * 0.2); // difficulty reduces well size

        let x: number, y: number;
        if (stars.length === 0) {
          x = HALF;
          y = HALF;
        } else {
          const prev = stars[stars.length - 1];
          const minDist = 120;
          const maxDist = 250;
          const placeDist = minDist + rng() * (maxDist - minDist);
          const placeAngle = rng() * Math.PI - Math.PI / 2; // bias forward-ish
          x = prev.x + Math.cos(placeAngle) * placeDist;
          y = prev.y + Math.sin(placeAngle) * placeDist;
        }

        const colorKey = STAR_COLORS_KEYS[Math.floor(rng() * STAR_COLORS_KEYS.length)];
        const color = t.colors[colorKey];
        const size = Math.max(6, wellRadius / 8);

        stars.push({
          x, y,
          orbitRadius: INITIAL_ORBIT_RADIUS,
          wellRadius: Math.max(MIN_WELL_RADIUS, INITIAL_WELL_RADIUS - transferNum * WELL_SHRINK_PER_TRANSFER) * (1 - difficulty * 0.2),
          color,
          size,
          pulsePhase: rng() * Math.PI * 2,
        });

        furthestX = Math.max(furthestX, x);
        furthestY = Math.max(furthestY, y);
      }
    }

    generateStars(STAR_CHUNK_SIZE * 2); // initial batch

    // --- Game state ---
    let currentStarIdx = 0;
    let orbitAngle = 0;
    let orbitSpeed = INITIAL_ORBIT_SPEED;
    let planetX = stars[0].x + INITIAL_ORBIT_RADIUS;
    let planetY = stars[0].y;
    let planetVx = 0;
    let planetVy = 0;
    let state: 'orbiting' | 'flying' | 'dead' = 'orbiting';
    let transfers = 0;
    let perfectCaptures = 0;
    let elapsed = 0;
    let dead = false;
    let deathTime = 0;
    let deathFadeAlpha = 1;

    // Camera
    let cameraX = stars[0].x;
    let cameraY = stars[0].y;

    // VFX
    const particles = new ParticleEmitter();
    const trail = new TrailRenderer({
      maxPoints: 40,
      width: { start: 4, end: 1 },
      color: (i, total) => {
        const ct = i / total;
        // Blend from info to pink
        return ct < 0.5 ? t.colors.info : t.colors.pink;
      },
      opacity: { start: 0.7, end: 0 },
    });
    const pulseRings = new PulseRingEmitter();
    const screenFlash = new ScreenFlash();

    // --- Input ---
    function onPointerDown() {
      if (state === 'orbiting' && !dead) {
        // Release planet tangentially
        const star = stars[currentStarIdx];
        const tangentAngle = orbitAngle + Math.PI / 2;
        const releaseSpeed = orbitSpeed * star.orbitRadius;
        planetVx = Math.cos(tangentAngle) * releaseSpeed;
        planetVy = Math.sin(tangentAngle) * releaseSpeed;
        state = 'flying';
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown);

    // --- Render ---
    function renderGame() {
      const w = CANVAS_SIZE;
      const h = CANVAS_SIZE;

      // Background
      ctx.fillStyle = t.colors.bg;
      ctx.fillRect(0, 0, w, h);

      // Parallax background stars
      for (const bs of bgStars) {
        const parallaxFactor = bs.layer === 1 ? 0.1 : 0.2;
        const sx = bs.x - cameraX * parallaxFactor + w / 2;
        const sy = bs.y - cameraY * parallaxFactor + h / 2;
        // Wrap
        const wrappedX = ((sx % w) + w) % w;
        const wrappedY = ((sy % h) + h) % h;
        ctx.globalAlpha = bs.opacity * deathFadeAlpha;
        ctx.fillStyle = t.colors.text;
        ctx.beginPath();
        ctx.arc(wrappedX, wrappedY, bs.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Camera transform
      ctx.save();
      ctx.translate(-cameraX + w / 2, -cameraY + h / 2);

      // Draw stars (only visible ones)
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const screenX = star.x - cameraX + w / 2;
        const screenY = star.y - cameraY + h / 2;
        if (screenX < -100 || screenX > w + 100 || screenY < -100 || screenY > h + 100) continue;

        const alpha = deathFadeAlpha;

        // Gravity well circles
        const planetDist = distance(planetX, planetY, star.x, star.y);
        const wellProximity = Math.max(0, 1 - planetDist / (star.wellRadius * 2));
        const wellOpacity = 0.06 + wellProximity * 0.12;

        ctx.globalAlpha = wellOpacity * alpha;
        ctx.strokeStyle = star.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.wellRadius, 0, Math.PI * 2);
        ctx.stroke();
        if (star.wellRadius > 50) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.wellRadius * 0.6, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Orbit path for current star
        if (i === currentStarIdx && state === 'orbiting') {
          ctx.globalAlpha = 0.15 * alpha;
          ctx.strokeStyle = star.color;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 5]);
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.orbitRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }

        // Star glow
        const pulse = 1 + Math.sin(elapsed / 1000 + star.pulsePhase) * 0.1;
        const starSize = star.size * pulse;

        ctx.globalAlpha = alpha;
        drawWithGlow(ctx, star.color, 15, () => {
          // Radial gradient
          const grad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, starSize);
          grad.addColorStop(0, t.colors.text);
          grad.addColorStop(0.4, star.color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(star.x, star.y, starSize, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }

      // Trajectory preview
      if (state === 'orbiting' && difficulty <= 0.6) {
        const star = stars[currentStarIdx];
        const tangentAngle = orbitAngle + Math.PI / 2;
        const startX = planetX;
        const startY = planetY;
        const endX = startX + Math.cos(tangentAngle) * PREVIEW_LENGTH;
        const endY = startY + Math.sin(tangentAngle) * PREVIEW_LENGTH;

        ctx.globalAlpha = 0.3 * deathFadeAlpha;
        ctx.strokeStyle = t.colors.textDim;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // Trail
      trail.draw(ctx);

      // Planet
      ctx.globalAlpha = deathFadeAlpha;
      drawWithGlow(ctx, t.colors.info, 12, () => {
        ctx.fillStyle = t.colors.info;
        ctx.beginPath();
        ctx.arc(planetX, planetY, PLANET_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      });
      // Bright core
      ctx.fillStyle = t.colors.text;
      ctx.beginPath();
      ctx.arc(planetX, planetY, PLANET_RADIUS * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // VFX
      particles.draw(ctx);
      pulseRings.draw(ctx);

      // Restore camera
      ctx.restore();

      // Screen flash (in screen space)
      screenFlash.draw(ctx, w, h);

      // HUD (in screen space)
      ctx.font = '14px monospace';
      ctx.textBaseline = 'top';
      ctx.fillStyle = withAlpha(t.colors.text, 0.4);
      ctx.textAlign = 'left';
      ctx.fillText(`Transfers: ${transfers}`, 12, 12);

      ctx.textAlign = 'right';
      const score = transfers + perfectCaptures;
      ctx.fillText(`Score: ${score}`, w - 12, 12);

      // Time remaining
      const remaining = Math.max(0, Math.ceil((timeLimit - elapsed) / 1000));
      ctx.fillStyle = remaining <= 10 ? withAlpha(t.colors.danger, 0.8) : withAlpha(t.colors.text, 0.3);
      ctx.textAlign = 'center';
      ctx.fillText(`${remaining}s`, w / 2, w - 24);
    }

    // --- Game loop ---
    let lastTime = performance.now();
    let animId: number;
    let resultSent = false;

    function frame(now: number) {
      const realDt = Math.min(now - lastTime, 50);
      lastTime = now;
      const dt = realDt;

      if (!dead) {
        elapsed += dt;

        // Time's up
        if (elapsed >= timeLimit && state !== 'dead') {
          dead = true;
          deathTime = 0;
        }

        if (state === 'orbiting') {
          const star = stars[currentStarIdx];
          orbitAngle += orbitSpeed * (dt / 1000);
          planetX = star.x + Math.cos(orbitAngle) * star.orbitRadius;
          planetY = star.y + Math.sin(orbitAngle) * star.orbitRadius;
          trail.push(planetX, planetY);

          // Camera stays on current star
          cameraX = lerp(cameraX, star.x, 0.08);
          cameraY = lerp(cameraY, star.y, 0.08);
        } else if (state === 'flying') {
          planetX += planetVx * (dt / 1000);
          planetY += planetVy * (dt / 1000);
          trail.push(planetX, planetY);

          // Camera follows planet with lag
          cameraX = lerp(cameraX, planetX, 0.05);
          cameraY = lerp(cameraY, planetY, 0.05);

          // Check gravity well capture
          let captured = false;
          for (let i = 0; i < stars.length; i++) {
            if (i === currentStarIdx) continue;
            const star = stars[i];
            const dist = distance(planetX, planetY, star.x, star.y);
            if (dist < star.wellRadius) {
              // Captured!
              currentStarIdx = i;
              orbitAngle = angleBetween(star.x, star.y, planetX, planetY);
              star.orbitRadius = Math.min(dist, INITIAL_ORBIT_RADIUS);
              state = 'orbiting';
              transfers++;
              orbitSpeed *= ORBIT_SPEED_MULT;

              // Perfect capture?
              if (dist < star.wellRadius * PERFECT_CAPTURE_RATIO) {
                perfectCaptures++;
                pulseRings.emit({
                  x: star.x, y: star.y,
                  color: t.colors.gold,
                  maxRadius: 60,
                  duration: 500,
                  lineWidth: 3,
                });
              }

              // Capture VFX
              pulseRings.emit({
                x: star.x, y: star.y,
                color: star.color,
                maxRadius: 40,
                duration: 400,
              });
              screenFlash.trigger(withAlpha(star.color, 0.2), 200);
              particles.emit({
                count: 10,
                position: { x: star.x, y: star.y },
                velocity: { min: 30, max: 80 },
                angle: { min: 0, max: Math.PI * 2 },
                lifetime: { min: 300, max: 600 },
                size: { start: 2, end: 0.5 },
                color: star.color,
                opacity: { start: 0.8, end: 0 },
              });

              // Generate more stars if needed
              if (i >= stars.length - STAR_CHUNK_SIZE) {
                generateStars(STAR_CHUNK_SIZE);
              }

              captured = true;
              break;
            }
          }

          // Check death (drifted too far from all visible stars)
          if (!captured) {
            const screenX = planetX - cameraX + HALF;
            const screenY = planetY - cameraY + HALF;
            if (screenX < -DEATH_MARGIN || screenX > CANVAS_SIZE + DEATH_MARGIN ||
                screenY < -DEATH_MARGIN || screenY > CANVAS_SIZE + DEATH_MARGIN) {
              dead = true;
              deathTime = 0;
            }
          }
        }
      }

      if (dead) {
        deathTime += realDt;
        deathFadeAlpha = Math.max(0, 1 - deathTime / 800);
      }

      // Update VFX
      particles.update(dt);
      pulseRings.update(dt);
      screenFlash.update(dt);

      // Render
      renderGame();

      // Send result after death fade
      if (dead && deathTime > 800 && !resultSent) {
        resultSent = true;
        onResultRef.current({
          transfers,
          perfectCaptures,
          longestChain: transfers,
        });
        return;
      }

      animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('pointerdown', onPointerDown);
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
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="max-w-full max-h-full touch-none"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
