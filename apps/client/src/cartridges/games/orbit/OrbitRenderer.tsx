import { useEffect, useRef, useCallback, useState } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import type { CartridgeTheme } from '@pecking-order/ui-kit/cartridge-theme';
import { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';
import {
  mulberry32, lerp, distance, angleBetween,
  ParticleEmitter, TrailRenderer, ScreenShake,
  drawWithGlow, SlowMo, ScreenFlash, PulseRingEmitter,
  FloatingTextEmitter, SpringValue,
} from '../shared/canvas-vfx';

const px = (v: number) => Math.round(v);

type ColorKey = keyof CartridgeTheme['colors'];

// Transfer milestone ladder — seasoned-run territory
const TRANSFER_MILESTONES: { transfers: number; text: string }[] = [
  { transfers: 5, text: '5 TRANSFERS' },
  { transfers: 15, text: '15 TRANSFERS' },
  { transfers: 30, text: '30 TRANSFERS!' },
];

// --- Star types ---
// Each star is one of these archetypes. Players pick targets based on the
// risk/reward each offers — pulsars pay out but decay fast, red giants are
// a breather at low score, satellites punish bad timing, etc.
type StarType =
  | 'standard'
  | 'red_giant'
  | 'pulsar'
  | 'satellite'
  | 'accelerator'
  | 'brake';

interface StarTypeDef {
  decayDuration: number; // ms until decay ring collapses to orbit and kills
  orbitMult: number;     // multiplier on baseOrbitSpeed while orbiting this star
  orbitRadius: number;   // how far the planet orbits from star centre
  wellMult: number;      // multiplier on generated wellRadius
  scoreMult: number;     // multiplier on per-transfer score
  flightMult: number;    // multiplier on release velocity (accelerator/brake)
  colorKey: ColorKey;    // forced color for type-distinctive rendering
  satelliteRadius?: number; // satellite: moon's orbit radius (must be ≠ orbitRadius)
  label: string;         // short display / debug name
}

const STAR_TYPES: Record<StarType, StarTypeDef> = {
  standard:    { decayDuration: 6000,  orbitMult: 1.0, orbitRadius: 40, wellMult: 1.0, scoreMult: 1.0, flightMult: 1.0, colorKey: 'gold',   label: 'STANDARD' },
  red_giant:   { decayDuration: 11000, orbitMult: 0.65, orbitRadius: 56, wellMult: 1.35, scoreMult: 0.5, flightMult: 1.0, colorKey: 'orange', label: 'RED GIANT' },
  pulsar:      { decayDuration: 3200,  orbitMult: 1.8, orbitRadius: 28, wellMult: 0.85, scoreMult: 2.0, flightMult: 1.0, colorKey: 'info',   label: 'PULSAR' },
  satellite:   { decayDuration: 6500,  orbitMult: 1.0, orbitRadius: 40, wellMult: 1.0, scoreMult: 1.6, flightMult: 1.0, colorKey: 'pink',   satelliteRadius: 62, label: 'SATELLITE' },
  accelerator: { decayDuration: 5500,  orbitMult: 1.1, orbitRadius: 40, wellMult: 1.0, scoreMult: 1.3, flightMult: 1.5, colorKey: 'green',  label: 'BOOST' },
  brake:       { decayDuration: 7000,  orbitMult: 0.85, orbitRadius: 40, wellMult: 1.05, scoreMult: 0.9, flightMult: 0.65, colorKey: 'text', label: 'BRAKE' },
};

// Weighted star-type selection — shifts distribution as the run progresses
function pickStarType(rng: () => number, transferIdx: number): StarType {
  // Early game: standard + red_giant for learning. Mid: introduce pulsar + accelerator/brake.
  // Late: high pulsar/satellite weight (most risk/reward).
  const weights: [StarType, number][] = transferIdx < 3
    ? [['standard', 6], ['red_giant', 2], ['accelerator', 1]]
    : transferIdx < 8
      ? [['standard', 4], ['red_giant', 2], ['pulsar', 2], ['accelerator', 1], ['brake', 1], ['satellite', 1]]
      : [['standard', 3], ['red_giant', 1], ['pulsar', 3], ['accelerator', 2], ['brake', 1], ['satellite', 3]];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [type, w] of weights) {
    roll -= w;
    if (roll <= 0) return type;
  }
  return 'standard';
}

// --- Constants ---

const CANVAS_SIZE = 400;
const HALF = CANVAS_SIZE / 2;
const STAR_COLORS_KEYS: ColorKey[] = ['gold', 'orange', 'pink', 'text'];
const INITIAL_ORBIT_RADIUS = 40;
const INITIAL_ORBIT_SPEED = (Math.PI * 2) / 3.5; // 1 rev per 3.5s — slightly slower start
const ORBIT_SPEED_MULT = 1.05; // 5% faster each transfer — gradual ramp
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
  colorKey: ColorKey; // resolved against themeRef.current at draw time — avoids theme-timing race
  size: number;
  pulsePhase: number;
  orbitDir: 1 | -1; // orbit direction — some stars pull you CW, some CCW; adds read/decision variety
  type: StarType;
  def: StarTypeDef;
  // Decay state: starts on arrival. When decay ring reaches orbitRadius, the player dies if still here.
  arrivalTime: number | null; // ms (elapsed) — null until first arrival
  dead: boolean;              // decay completed — star goes dark after collapse
  // Satellite: a moon orbits this star at satelliteRadius. Kills the player if they share its position.
  satelliteAngle: number;     // current moon angle
  satelliteSpeed: number;     // rad/s
}

export default function OrbitRenderer({ seed, difficulty, timeLimit, onResult }: ArcadeRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useCartridgeTheme(containerRef);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const [showRespawn, setShowRespawn] = useState(false);
  const respawnRef = useRef<(() => void) | null>(null);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    // Theme is read via themeRef.current at point of use (draw time or event time) — avoids
    // capturing a stale default theme if the useLayoutEffect resolution hadn't completed when
    // gameLoop first ran. See the "no stars first time" race in older builds.

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
        const wellRadius = Math.max(MIN_WELL_RADIUS, INITIAL_WELL_RADIUS - transferNum * WELL_SHRINK_PER_TRANSFER) * (1 - difficulty * 0.2);

        let x = HALF, y = HALF;
        if (stars.length === 0) {
          // first star at center
        } else {
          const prev = stars[stars.length - 1];
          const minDist = 140;
          const maxDist = 220;
          const MIN_SEPARATION = 100; // minimum distance from ANY existing star

          // Try up to 20 candidates, pick first that's far enough from all existing stars
          let placed = false;
          for (let attempt = 0; attempt < 20; attempt++) {
            const placeDist = minDist + rng() * (maxDist - minDist);
            const placeAngle = rng() * Math.PI * 2;
            const cx = prev.x + Math.cos(placeAngle) * placeDist;
            const cy = prev.y + Math.sin(placeAngle) * placeDist;

            // Check distance from all existing stars
            let tooClose = false;
            for (const existing of stars) {
              if (distance(cx, cy, existing.x, existing.y) < MIN_SEPARATION) {
                tooClose = true;
                break;
              }
            }
            if (!tooClose) {
              x = cx;
              y = cy;
              placed = true;
              break;
            }
          }
          // Fallback: place further out if all attempts failed
          if (!placed) {
            const placeDist = maxDist + 50;
            const placeAngle = rng() * Math.PI * 2;
            x = prev.x + Math.cos(placeAngle) * placeDist;
            y = prev.y + Math.sin(placeAngle) * placeDist;
          }
        }

        // Select a type — first star is always STANDARD so the tutorial moment is predictable
        const type = stars.length === 0 ? 'standard' : pickStarType(rng, stars.length);
        const def = STAR_TYPES[type];
        const colorKey = def.colorKey;
        const effectiveWell = wellRadius * def.wellMult;
        const size = Math.max(6, effectiveWell / 8);
        // Satellites spin independently; randomize start angle and give them a modest speed
        const satelliteAngle = rng() * Math.PI * 2;
        const satelliteSpeed = type === 'satellite' ? (0.8 + rng() * 0.6) * (rng() > 0.5 ? 1 : -1) : 0;

        stars.push({
          x, y,
          orbitRadius: def.orbitRadius,
          wellRadius: effectiveWell,
          colorKey,
          size,
          pulsePhase: rng() * Math.PI * 2,
          orbitDir: rng() > 0.5 ? 1 : -1,
          type,
          def,
          arrivalTime: null,
          dead: false,
          satelliteAngle,
          satelliteSpeed,
        });

        furthestX = Math.max(furthestX, x);
        furthestY = Math.max(furthestY, y);
      }
    }

    generateStars(STAR_CHUNK_SIZE * 2); // initial batch

    // --- Game state ---
    let currentStarIdx = 0;
    let orbitAngle = 0;
    // baseOrbitSpeed ramps per-transfer; actual orbit speed = baseOrbitSpeed × currentStar.def.orbitMult
    let baseOrbitSpeed = INITIAL_ORBIT_SPEED;
    let orbitSpeed = baseOrbitSpeed * stars[0].def.orbitMult;
    let planetX = stars[0].x + stars[0].orbitRadius;
    let planetY = stars[0].y;
    let planetVx = 0;
    let planetVy = 0;
    let state: 'orbiting' | 'flying' | 'dead' = 'orbiting';
    let transfers = 0;
    let perfectCaptures = 0;
    let score = 0;              // accumulated running score (decay-bonused + type-weighted + perfect bonus)
    let elapsed = 0;
    let dead = false;
    let deathCause: 'decay' | 'satellite' | 'drift' | 'timesup' = 'timesup';
    let deathTime = 0;
    let deathFadeAlpha = 1;
    let flyingTime = 0;
    let pendingFlightMult = 1; // applied to next release — set by accelerator/brake on arrival
    let ending = false; // single end-of-game VFX guard
    const crossedMilestones = new Set<number>();
    const DRIFT_TIMEOUT = 2000; // ms before showing respawn button
    // Star 0 arrival — decay starts from t=0 so there's pressure from the first frame
    stars[0].arrivalTime = 0;
    pendingFlightMult = stars[0].def.flightMult;

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
        const tc = themeRef.current.colors;
        // Blend from info to pink (live theme read — stars + trail stay correct across theme updates)
        return ct < 0.5 ? tc.info : tc.pink;
      },
      opacity: { start: 0.7, end: 0 },
    });
    const pulseRings = new PulseRingEmitter();
    const screenFlash = new ScreenFlash();
    const screenShake = new ScreenShake();
    const floatingText = new FloatingTextEmitter();
    const scoreSpring = new SpringValue({ stiffness: 220, damping: 14 });

    // Compute how much of the current star's decay has elapsed (0..1). Higher = riskier release.
    function decayConsumed(star: Star): number {
      if (star.arrivalTime == null) return 0;
      return Math.max(0, Math.min(1, (elapsed - star.arrivalTime) / star.def.decayDuration));
    }

    // --- Input ---
    function onPointerDown() {
      if (state === 'orbiting' && !dead) {
        const star = stars[currentStarIdx];
        const consumed = decayConsumed(star);
        // Tangential release — velocity direction follows orbit direction; scales with flightMult
        const tangentAngle = orbitAngle + star.orbitDir * Math.PI / 2;
        const releaseSpeed = orbitSpeed * star.orbitRadius * pendingFlightMult;
        planetVx = Math.cos(tangentAngle) * releaseSpeed;
        planetVy = Math.sin(tangentAngle) * releaseSpeed;

        // Score the release — base 1 + decay-risk curve, times star type multiplier
        const timingBonus = 1 + Math.pow(consumed, 1.5) * 3;
        const earned = timingBonus * star.def.scoreMult;
        score += earned;
        scoreSpring.target = Math.min(0.5, 0.15 + consumed * 0.45);

        // Late-release callout — only if the player actually pushed the risk
        const tc = themeRef.current.colors;
        if (consumed >= 0.85) {
          floatingText.emit({
            text: 'LATE!',
            x: star.x, y: star.y - 50,
            color: tc.pink,
            fontSize: 22,
            duration: 700,
            drift: 40,
          });
          pulseRings.emit({
            x: star.x, y: star.y,
            color: tc.pink,
            maxRadius: 80,
            duration: 500,
            lineWidth: 3,
          });
        } else if (consumed >= 0.6) {
          floatingText.emit({
            text: 'CLOSE!',
            x: star.x, y: star.y - 50,
            color: tc.gold,
            fontSize: 18,
            duration: 600,
            drift: 30,
          });
        }

        state = 'flying';
        flyingTime = 0;
        setShowRespawn(false);
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown);

    // Respawn function — called from React button
    respawnRef.current = () => {
      const star = stars[currentStarIdx];
      orbitAngle = 0;
      star.orbitRadius = star.def.orbitRadius;
      star.arrivalTime = elapsed; // reset decay on respawn
      star.dead = false;
      planetX = star.x + star.orbitRadius;
      planetY = star.y;
      planetVx = 0;
      planetVy = 0;
      orbitSpeed = baseOrbitSpeed * star.def.orbitMult;
      pendingFlightMult = star.def.flightMult;
      state = 'orbiting';
      flyingTime = 0;
      trail.clear();
      setShowRespawn(false);
      screenFlash.trigger(withAlpha(themeRef.current.colors.danger, 0.2), 200);
    };

    // --- Render ---
    function renderGame() {
      const t = themeRef.current; // per-frame theme read — picks up resolution after initial default
      const w = CANVAS_SIZE;
      const h = CANVAS_SIZE;

      // Background
      ctx.fillStyle = t.colors.bg;
      ctx.fillRect(0, 0, w, h);

      screenShake.apply(ctx);

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
        ctx.strokeStyle = themeRef.current.colors[star.colorKey];
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

        // Orbit path for current star — prominent solid ring
        if (i === currentStarIdx && state === 'orbiting') {
          ctx.globalAlpha = 0.4 * alpha;
          ctx.strokeStyle = themeRef.current.colors[star.colorKey];
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.orbitRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }

        // Decay ring — contracts from wellRadius toward orbitRadius. If it reaches you, you die.
        // Only draw for stars that have a live decay clock (arrived, not already consumed).
        if (star.arrivalTime != null && !star.dead) {
          const consumed = decayConsumed(star);
          if (consumed < 1) {
            const decayRadius = lerp(star.wellRadius, star.orbitRadius, consumed);
            // Urgency ramps: cool/dim early → bright red + pulsing late
            const urgency = Math.pow(consumed, 1.4);
            const ringAlpha = (0.2 + urgency * 0.6) * alpha;
            const pulseFlicker = consumed > 0.75 ? 0.85 + Math.sin(elapsed * 0.03) * 0.15 : 1;
            ctx.globalAlpha = ringAlpha * pulseFlicker;
            ctx.strokeStyle = t.colors.danger;
            ctx.lineWidth = 1.5 + urgency * 2;
            ctx.setLineDash(consumed > 0.5 ? [] : [6, 4]);
            ctx.beginPath();
            ctx.arc(star.x, star.y, decayRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
          }
        }

        // --- Star body — render function depends on type ---
        const starColor = themeRef.current.colors[star.colorKey];
        ctx.globalAlpha = alpha;

        if (star.type === 'pulsar') {
          // Tiny bright core + fast rotating twin beams + concentric corona rings — reads as a high-energy ball
          const pulse = 1 + Math.sin(elapsed / 1000 * 6 + star.pulsePhase) * 0.3;
          const coreSize = star.size * 0.7 * pulse;
          // Corona rings
          for (let r = 0; r < 3; r++) {
            const coronaR = coreSize + 4 + r * 5;
            ctx.globalAlpha = (0.35 - r * 0.1) * alpha * pulse;
            ctx.strokeStyle = starColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(star.x, star.y, coronaR, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = alpha;
          // Core
          drawWithGlow(ctx, starColor, 24, () => {
            const grad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, coreSize);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.5, starColor);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(star.x, star.y, coreSize, 0, Math.PI * 2);
            ctx.fill();
          });
          // Rotating twin beams — two perpendicular lines
          const beamAngle = elapsed * 0.006 + star.pulsePhase;
          ctx.save();
          ctx.translate(star.x, star.y);
          ctx.rotate(beamAngle);
          ctx.globalAlpha = 0.7 * alpha;
          ctx.strokeStyle = starColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-star.wellRadius * 0.75, 0);
          ctx.lineTo(star.wellRadius * 0.75, 0);
          ctx.moveTo(0, -star.wellRadius * 0.4);
          ctx.lineTo(0, star.wellRadius * 0.4);
          ctx.stroke();
          ctx.restore();
        } else if (star.type === 'red_giant') {
          // Huge, soft, swelling — heavy atmosphere. Slow breathing pulse. Dark heart visible.
          const pulse = 1 + Math.sin(elapsed / 1000 * 0.4 + star.pulsePhase) * 0.15;
          const bodySize = star.size * 1.35 * pulse;
          // Outer haze
          ctx.globalAlpha = 0.25 * alpha;
          const haze = ctx.createRadialGradient(star.x, star.y, bodySize * 0.4, star.x, star.y, bodySize * 2.2);
          haze.addColorStop(0, starColor);
          haze.addColorStop(1, 'transparent');
          ctx.fillStyle = haze;
          ctx.beginPath();
          ctx.arc(star.x, star.y, bodySize * 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
          // Main body
          drawWithGlow(ctx, starColor, 18, () => {
            const grad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, bodySize);
            grad.addColorStop(0, starColor);
            grad.addColorStop(0.7, withAlpha(starColor, 0.4));
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(star.x, star.y, bodySize, 0, Math.PI * 2);
            ctx.fill();
          });
          // Dark heart
          ctx.globalAlpha = 0.5 * alpha;
          ctx.fillStyle = t.colors.bg;
          ctx.beginPath();
          ctx.arc(star.x, star.y, bodySize * 0.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (star.type === 'accelerator') {
          // Green with outward-sweeping chevrons — reads as "speed up / boost"
          const pulse = 1 + Math.sin(elapsed / 1000 * 2 + star.pulsePhase) * 0.12;
          const body = star.size * pulse;
          drawWithGlow(ctx, starColor, 16, () => {
            const grad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, body);
            grad.addColorStop(0, t.colors.text);
            grad.addColorStop(0.4, starColor);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(star.x, star.y, body, 0, Math.PI * 2);
            ctx.fill();
          });
          // Three rotating outward chevrons — spin direction matches the star's orbitDir so the cue is truthful
          const sweep = (elapsed * 0.002 * star.orbitDir) % (Math.PI * 2);
          ctx.strokeStyle = starColor;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.75 * alpha;
          for (let k = 0; k < 3; k++) {
            const a = sweep + (k * Math.PI * 2) / 3;
            const r1 = body + 4;
            const r2 = body + 14;
            const cx1 = star.x + Math.cos(a) * r1;
            const cy1 = star.y + Math.sin(a) * r1;
            const cx2 = star.x + Math.cos(a) * r2;
            const cy2 = star.y + Math.sin(a) * r2;
            ctx.beginPath();
            // Chevron: line pointing outward with a tangent flair
            ctx.moveTo(cx1 + Math.cos(a + Math.PI * 0.8) * 4, cy1 + Math.sin(a + Math.PI * 0.8) * 4);
            ctx.lineTo(cx2, cy2);
            ctx.lineTo(cx1 + Math.cos(a - Math.PI * 0.8) * 4, cy1 + Math.sin(a - Math.PI * 0.8) * 4);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        } else if (star.type === 'brake') {
          // Dim body + inward-pointing arcs — reads as "slow you down / absorb"
          const pulse = 1 + Math.sin(elapsed / 1000 * 0.7 + star.pulsePhase) * 0.08;
          const body = star.size * pulse;
          drawWithGlow(ctx, starColor, 10, () => {
            const grad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, body);
            grad.addColorStop(0, starColor);
            grad.addColorStop(0.5, withAlpha(starColor, 0.5));
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(star.x, star.y, body, 0, Math.PI * 2);
            ctx.fill();
          });
          // Inward-pointing dashed arcs at 3 positions — static, meditative
          ctx.strokeStyle = starColor;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.55 * alpha;
          ctx.setLineDash([3, 3]);
          for (let k = 0; k < 3; k++) {
            const a = (k * Math.PI * 2) / 3 + star.pulsePhase * 0.2;
            const r = body + 10;
            ctx.beginPath();
            ctx.arc(star.x, star.y, r, a - 0.35, a + 0.35);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        } else if (star.type === 'satellite') {
          // Pink body — standard glow, but pairs with its moon (drawn below)
          const pulse = 1 + Math.sin(elapsed / 1000 + star.pulsePhase) * 0.1;
          const body = star.size * pulse;
          drawWithGlow(ctx, starColor, 15, () => {
            const grad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, body);
            grad.addColorStop(0, t.colors.text);
            grad.addColorStop(0.4, starColor);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(star.x, star.y, body, 0, Math.PI * 2);
            ctx.fill();
          });
        } else {
          // standard
          const pulse = 1 + Math.sin(elapsed / 1000 + star.pulsePhase) * 0.1;
          const body = star.size * pulse;
          drawWithGlow(ctx, starColor, 15, () => {
            const grad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, body);
            grad.addColorStop(0, t.colors.text);
            grad.addColorStop(0.4, starColor);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(star.x, star.y, body, 0, Math.PI * 2);
            ctx.fill();
          });
        }

        // Satellite moon — orbits the star; collision kills the player
        if (star.type === 'satellite' && star.def.satelliteRadius != null) {
          const mx = star.x + Math.cos(star.satelliteAngle) * star.def.satelliteRadius;
          const my = star.y + Math.sin(star.satelliteAngle) * star.def.satelliteRadius;
          // Show satellite's orbit path faintly so the player can read the threat
          ctx.globalAlpha = 0.22 * alpha;
          ctx.strokeStyle = t.colors.danger;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 6]);
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.def.satelliteRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = alpha;
          drawWithGlow(ctx, t.colors.danger, 10, () => {
            ctx.fillStyle = t.colors.danger;
            ctx.beginPath();
            ctx.arc(mx, my, 5, 0, Math.PI * 2);
            ctx.fill();
            // Subtle leading trail
            const trailA = star.satelliteAngle - star.satelliteSpeed * 0.08;
            const tx = star.x + Math.cos(trailA) * star.def.satelliteRadius!;
            const ty = star.y + Math.sin(trailA) * star.def.satelliteRadius!;
            ctx.globalAlpha = 0.5 * alpha;
            ctx.beginPath();
            ctx.arc(tx, ty, 3, 0, Math.PI * 2);
            ctx.fill();
          });
        }
        ctx.globalAlpha = 1;
      }

      // Trajectory preview — prominent dashed line showing release direction (follows orbit direction)
      if (state === 'orbiting' && difficulty <= 0.6) {
        const currentStar = stars[currentStarIdx];
        const tangentAngle = orbitAngle + currentStar.orbitDir * Math.PI / 2;
        const startX = planetX;
        const startY = planetY;
        const endX = startX + Math.cos(tangentAngle) * PREVIEW_LENGTH;
        const endY = startY + Math.sin(tangentAngle) * PREVIEW_LENGTH;

        ctx.globalAlpha = 0.6 * deathFadeAlpha;
        ctx.strokeStyle = t.colors.info;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        drawWithGlow(ctx, t.colors.info, 4, () => {
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        });
        // Arrow head
        const arrowSize = 8;
        const ax = endX;
        const ay = endY;
        ctx.fillStyle = t.colors.info;
        ctx.beginPath();
        ctx.moveTo(ax + Math.cos(tangentAngle) * arrowSize, ay + Math.sin(tangentAngle) * arrowSize);
        ctx.lineTo(ax + Math.cos(tangentAngle + 2.5) * arrowSize, ay + Math.sin(tangentAngle + 2.5) * arrowSize);
        ctx.lineTo(ax + Math.cos(tangentAngle - 2.5) * arrowSize, ay + Math.sin(tangentAngle - 2.5) * arrowSize);
        ctx.closePath();
        ctx.fill();
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

      // VFX (in world space — follow the camera)
      particles.draw(ctx);
      pulseRings.draw(ctx);
      floatingText.draw(ctx);

      // Restore camera
      ctx.restore();

      screenShake.restore(ctx);

      // Screen flash (in screen space)
      screenFlash.draw(ctx, w, h);

      // HUD (in screen space) — pixel-snapped
      ctx.font = '14px monospace';
      ctx.textBaseline = 'top';
      ctx.fillStyle = withAlpha(t.colors.text, 0.5);
      ctx.textAlign = 'left';
      ctx.fillText(`Transfers: ${transfers}`, px(12), px(12));

      // Score — spring-pulses on every release (bigger on late/PERFECT)
      const scoreScale = 1 + scoreSpring.value;
      ctx.save();
      ctx.translate(px(w - 12), px(12));
      ctx.scale(scoreScale, scoreScale);
      ctx.fillStyle = withAlpha(t.colors.text, 0.6);
      ctx.textAlign = 'right';
      ctx.fillText(`Score: ${Math.floor(score)}`, 0, 0);
      ctx.restore();

      // Time remaining
      const remaining = Math.max(0, Math.ceil((timeLimit - elapsed) / 1000));
      ctx.fillStyle = remaining <= 10 ? withAlpha(t.colors.danger, 0.8) : withAlpha(t.colors.text, 0.3);
      ctx.textAlign = 'center';
      ctx.fillText(`${remaining}s`, px(w / 2), px(w - 24));
    }

    // --- Game loop ---
    function triggerEnding() {
      if (ending) return;
      ending = true;
      const tc = themeRef.current.colors;
      const cx = planetX;
      const cy = planetY;
      // Death types each get their own end-of-game VFX — so the player reads cause of death from the frame
      let text = "TIME'S UP!";
      let color = tc.gold;
      let particleColors: string[] = [tc.gold, tc.text];
      if (deathCause === 'decay') {
        text = 'CONSUMED!';
        color = tc.danger;
        particleColors = [tc.danger, tc.pink, tc.orange];
      } else if (deathCause === 'satellite') {
        text = 'COLLISION!';
        color = tc.danger;
        particleColors = [tc.danger, tc.pink];
      } else if (deathCause === 'drift') {
        text = 'LOST';
        color = tc.textDim;
        particleColors = [tc.textDim, tc.text];
      }
      screenFlash.trigger(withAlpha(color, 0.3), 400);
      pulseRings.emit({
        x: cx, y: cy,
        color,
        maxRadius: 200,
        duration: 700,
        lineWidth: 3,
      });
      particles.emit({
        count: 36,
        position: { x: cx, y: cy },
        velocity: { min: 100, max: 260 },
        angle: { min: 0, max: Math.PI * 2 },
        lifetime: { min: 500, max: 900 },
        size: { start: 3, end: 0.5 },
        color: particleColors,
        opacity: { start: 1, end: 0 },
      });
      floatingText.emit({
        text,
        x: cx, y: cy - 40,
        color,
        fontSize: 26,
        duration: 900,
        drift: 30,
      });
    }

    let lastTime = performance.now();
    let animId: number;
    let resultSent = false;

    function frame(now: number) {
      const realDt = Math.max(0, Math.min(now - lastTime, 50));
      lastTime = now;
      const dt = realDt;

      if (!dead) {
        elapsed += dt;

        // Time's up
        if (elapsed >= timeLimit && state !== 'dead') {
          dead = true;
          deathTime = 0;
        }

        // Advance all satellites globally so moons drift even when the player is elsewhere —
        // keeps SATELLITE stars visually alive and prevents predictable fixed-phase collisions
        for (const s of stars) {
          if (s.type === 'satellite' && s.def.satelliteRadius != null) {
            s.satelliteAngle += s.satelliteSpeed * (dt / 1000);
          }
        }

        if (state === 'orbiting') {
          const star = stars[currentStarIdx];
          orbitAngle += orbitSpeed * star.orbitDir * (dt / 1000);

          // Decay lethality — if the decay ring has collapsed past the orbit, the star consumes the planet
          const consumed = decayConsumed(star);
          if (consumed >= 1) {
            dead = true;
            deathCause = 'decay';
            deathTime = 0;
            star.dead = true;
            // Death VFX: red supernova-ish burst from the star, planet shatter
            const tc = themeRef.current.colors;
            screenFlash.trigger(withAlpha(tc.danger, 0.45), 500);
            screenShake.trigger({ intensity: 14, duration: 450 });
            pulseRings.emit({
              x: star.x, y: star.y,
              color: tc.danger,
              maxRadius: 160,
              duration: 700,
              lineWidth: 3,
            });
            particles.emit({
              count: 40,
              position: { x: planetX, y: planetY },
              velocity: { min: 80, max: 240 },
              angle: { min: 0, max: Math.PI * 2 },
              lifetime: { min: 400, max: 900 },
              size: { start: 3, end: 0.5 },
              color: [tc.danger, tc.pink, tc.text],
              opacity: { start: 1, end: 0 },
            });
          }

          planetX = star.x + Math.cos(orbitAngle) * star.orbitRadius;
          planetY = star.y + Math.sin(orbitAngle) * star.orbitRadius;
          trail.push(planetX, planetY);

          // Satellite collision — if a moon orbits this star, it kills on touch (moon advanced globally above)
          if (star.type === 'satellite' && star.def.satelliteRadius != null) {
            const mx = star.x + Math.cos(star.satelliteAngle) * star.def.satelliteRadius;
            const my = star.y + Math.sin(star.satelliteAngle) * star.def.satelliteRadius;
            if (!dead && distance(planetX, planetY, mx, my) < PLANET_RADIUS + 6) {
              dead = true;
              deathCause = 'satellite';
              deathTime = 0;
              const tc = themeRef.current.colors;
              screenFlash.trigger(withAlpha(tc.danger, 0.4), 400);
              screenShake.trigger({ intensity: 12, duration: 400 });
              particles.emit({
                count: 30,
                position: { x: planetX, y: planetY },
                velocity: { min: 80, max: 200 },
                angle: { min: 0, max: Math.PI * 2 },
                lifetime: { min: 400, max: 800 },
                size: { start: 3, end: 0.5 },
                color: [tc.danger, tc.pink],
                opacity: { start: 1, end: 0 },
              });
            }
          }

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
              star.orbitRadius = Math.min(dist, star.def.orbitRadius);
              state = 'orbiting';
              transfers++;
              // baseOrbitSpeed ramps globally per transfer; actual orbit speed depends on the star type
              baseOrbitSpeed *= ORBIT_SPEED_MULT;
              orbitSpeed = baseOrbitSpeed * star.def.orbitMult;
              flyingTime = 0;
              // Start the decay clock on THIS star — forces forward movement
              star.arrivalTime = elapsed;
              // Accelerator/brake: next release uses this star's flight multiplier
              pendingFlightMult = star.def.flightMult;
              setShowRespawn(false);

              // Perfect capture?
              const tc = themeRef.current.colors;
              if (dist < star.wellRadius * PERFECT_CAPTURE_RATIO) {
                perfectCaptures++;
                score += 2; // tight landing bonus on top of release timing score
                pulseRings.emit({
                  x: star.x, y: star.y,
                  color: tc.gold,
                  maxRadius: 60,
                  duration: 500,
                  lineWidth: 3,
                });
                particles.emit({
                  count: 16,
                  position: { x: star.x, y: star.y },
                  velocity: { min: 60, max: 160 },
                  angle: { min: 0, max: Math.PI * 2 },
                  lifetime: { min: 300, max: 600 },
                  size: { start: 2.5, end: 0.5 },
                  color: [tc.gold, '#ffffff'],
                  opacity: { start: 1, end: 0 },
                });
                floatingText.emit({
                  text: 'PERFECT',
                  x: star.x, y: star.y - 30,
                  color: tc.gold,
                  fontSize: 16,
                  duration: 700,
                  drift: 30,
                });
                scoreSpring.target = 0.45;
              } else {
                scoreSpring.target = 0.22;
              }

              // Capture VFX
              pulseRings.emit({
                x: star.x, y: star.y,
                color: themeRef.current.colors[star.colorKey],
                maxRadius: 40,
                duration: 400,
              });
              screenFlash.trigger(withAlpha(themeRef.current.colors[star.colorKey], 0.2), 200);
              particles.emit({
                count: 10,
                position: { x: star.x, y: star.y },
                velocity: { min: 30, max: 80 },
                angle: { min: 0, max: Math.PI * 2 },
                lifetime: { min: 300, max: 600 },
                size: { start: 2, end: 0.5 },
                color: themeRef.current.colors[star.colorKey],
                opacity: { start: 0.8, end: 0 },
              });

              // Transfer milestone ladder — gold celebration at 5 / 15 / 30 transfers (no slow-mo)
              for (const m of TRANSFER_MILESTONES) {
                if (transfers === m.transfers && !crossedMilestones.has(m.transfers)) {
                  crossedMilestones.add(m.transfers);
                  const tier = m.transfers >= 30 ? 1 : m.transfers >= 15 ? 0.7 : 0.5;
                  screenFlash.trigger(withAlpha(tc.gold, 0.22 * tier), 140);
                  screenShake.trigger({ intensity: 4 + 3 * tier, duration: 200 });
                  pulseRings.emit({
                    x: star.x, y: star.y,
                    color: tc.gold,
                    maxRadius: 90 + 40 * tier,
                    duration: 560,
                    lineWidth: 2,
                  });
                  particles.emit({
                    count: 28 + Math.round(14 * tier),
                    position: { x: star.x, y: star.y },
                    velocity: { min: 80, max: 220 },
                    angle: { min: 0, max: Math.PI * 2 },
                    lifetime: { min: 400, max: 800 },
                    size: { start: 3, end: 0.5 },
                    color: [tc.gold, tc.pink, '#ffffff'],
                    opacity: { start: 1, end: 0 },
                  });
                  floatingText.emit({
                    text: m.text,
                    x: star.x, y: star.y - 50,
                    color: tc.gold,
                    fontSize: 18 + Math.round(4 * tier),
                    duration: 900,
                    drift: 40,
                  });
                }
              }

              // Generate more stars if needed
              if (i >= stars.length - STAR_CHUNK_SIZE) {
                generateStars(STAR_CHUNK_SIZE);
              }

              captured = true;
              break;
            }
          }

          // Track flying time — show respawn button after timeout
          if (!captured) {
            flyingTime += dt;
            if (flyingTime >= DRIFT_TIMEOUT) {
              setShowRespawn(true);
            }
          }
        }
      }

      if (dead) {
        deathTime += realDt;
        // Fade starts at ~400ms so the ending VFX gets airtime before the scene dims
        deathFadeAlpha = Math.max(0, 1 - Math.max(0, deathTime - 400) / 900);
        if (!ending) {
          triggerEnding();
        }
      }

      // Score spring decays every frame; transfer/perfect bump it
      scoreSpring.target = 0;
      scoreSpring.update(realDt);

      // Update VFX
      particles.update(dt);
      pulseRings.update(dt);
      screenFlash.update(dt);
      screenShake.update(dt);
      floatingText.update(dt);

      // Render
      renderGame();

      // Send result after death fade (ending VFX ~900ms + buffer)
      if (dead && deathTime > 1300 && !resultSent) {
        resultSent = true;
        onResultRef.current({
          transfers,
          perfectCaptures,
          longestChain: transfers,
          score: Math.floor(score),
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
    <div ref={containerRef} className="relative flex items-center justify-center w-full">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="max-w-full max-h-full touch-none"
        style={{ imageRendering: 'pixelated' }}
      />
      {showRespawn && (
        <button
          onClick={() => respawnRef.current?.()}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-2 bg-white/10 border border-white/20 rounded-lg text-sm  text-white/90 hover:bg-white/20 active:scale-95 transition-all animate-pulse"
        >
          Retry from last star
        </button>
      )}
    </div>
  );
}
