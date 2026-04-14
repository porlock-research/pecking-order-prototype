import { useEffect, useRef } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';
import { useCartridgeTheme } from '../../CartridgeThemeContext';
import {
  mulberry32,
  ParticleEmitter, ScreenShake, ScreenFlash,
  FloatingTextEmitter, SpringValue, PulseRingEmitter, SlowMo,
} from '../shared/canvas-vfx';
import { withAlpha } from '@pecking-order/ui-kit/cartridge-theme';

const CANVAS_SIZE = 400;

// --- Layout ---
const GROUND_H = 44;
const GROUND_Y = CANVAS_SIZE - GROUND_H;
const BIRD_X = CANVAS_SIZE * 0.28;
const BIRD_R = 13;

// --- Physics ---
const GRAVITY = 1400;
const FLAP_VEL_MIN = -230;
const FLAP_VEL_MAX = -410;
const FLAP_CHARGE_MS = 120;
const MAX_FALL_VEL = 500;

// --- Scrolling / spawning ---
const SCROLL_BASE = 140;
const PIPE_W = 52;

// --- Super Mario 3 palette ---
// Locked to a chunky NES-style scheme — cheerful sky blue, saturated green pipes,
// orange/brown dirt ground, gold coins, yellow bird. Themed cartridge colors
// still drive VFX particles (milestones, death bursts) so dramatic moments
// adapt to the shell.
const SMB = {
  // Sky — flat retro blue (no gradient ambiguity)
  skyTop:      '#6b8cff',
  skyBottom:   '#8cb0ff',
  // Parallax layers (farthest to nearest)
  mountainFar: '#6858a8',
  mountainFarHi: '#9888d0',
  mountainNear: '#4838a0',
  mountainNearHi: '#7868c0',
  bushDark:    '#006818',
  bushMid:     '#00a030',
  bushHi:      '#58d858',
  // Clouds
  cloud:       '#ffffff',
  cloudShadow: '#b8c8f0',
  cloudOutline: '#5878c8',
  // Outline (near-black with a touch of warmth)
  outline:     '#181028',
  outlineSoft: '#382848',
  // Pipes — green
  pipeDark:    '#006800',
  pipeMid:     '#00a800',
  pipeLight:   '#80e820',
  // Pipes — red (moving/danger variant)
  movingDark:  '#780000',
  movingMid:   '#e02020',
  movingLight: '#ff7830',
  // Ground
  groundTop:   '#f8a050',
  groundMid:   '#c8601c',
  groundDeep:  '#783808',
  groundLine:  '#381808',
  grass:       '#58d858',
  grassDark:   '#006818',
  // Coin
  coin:        '#fcd800',
  coinHi:      '#fff088',
  coinShadow:  '#c08800',
  // Bird
  birdBody:    '#fcd800',
  birdBodyDark:'#c08020',
  birdBelly:   '#fff0b0',
  birdBeak:    '#e83810',
  birdBeakHi:  '#ff8858',
  feather:     '#fcd800',
  // Enemy — Koopa-paratroopa green with red accents
  enemyShell:  '#008830',
  enemyShellHi:'#58d858',
  enemyShellDark: '#004018',
  enemyBody:   '#fcd800',
  enemyBodyDark:'#c08020',
  enemyEye:    '#e83810',
  // Laser / fireball
  laserBeam:   '#f83810',
  laserGlow:   '#ff9858',
  laserCore:   '#ffffff',
  laserPost:   '#707088',
  laserPostHi: '#c0c0d8',
  laserPostDark: '#303040',
  // HUD strip
  hudBarBg:    '#181028',
  hudBarHi:    '#382848',
  hudText:     '#ffffff',
  hudDim:      '#a8a0c8',
  hudCoin:     '#fcd800',
  hudPhase1:   '#80e820',
  hudPhase2:   '#fcd800',
  hudPhase3:   '#ff7830',
  hudPhase4:   '#e02020',
  // Flap charge
  chargeBg:    '#181028',
  chargeLow:   '#ffffff',
  chargeHigh:  '#fcd800',
};

// Snap to integer pixels for crisp retro rendering.
const px = (v: number) => Math.round(v);

const HUD_H = 22;

const MILESTONES: { score: number; text: string }[] = [
  { score: 3, text: 'PHASE 2!' },
  { score: 8, text: 'PHASE 3!' },
  { score: 15, text: 'PHASE 4!' },
  { score: 25, text: 'ON FIRE!' },
  { score: 40, text: 'LEGENDARY!' },
];

interface Pipe {
  type: 'pipe';
  x: number;
  gapTop: number;
  baseGapTop: number;
  gapH: number;
  w: number;
  moving: boolean;
  movePhase: number;
  moveAmp: number;
  moveSpeed: number;
  scored: boolean;
}
interface Laser {
  type: 'laser';
  x: number;
  y: number;
  baseY: number;
  movePhase: number;
  moveAmp: number;
  moveSpeed: number;
  w: number;
  h: number;
  scored: boolean;
}
type Obstacle = Pipe | Laser;

interface Coin { x: number; y: number; collected: boolean; bob: number; }
interface Enemy { x: number; y: number; phase: number; }
interface Cloud { x: number; y: number; w: number; h: number; speed: number; opacity: number; }
interface Tuft { x: number; h: number; lean: number; }
interface Feather {
  x: number; y: number; vx: number; vy: number;
  rot: number; rotSpeed: number; life: number; maxLife: number; size: number;
}

export default function FlappyRenderer({ seed, difficulty, timeLimit, onResult }: ArcadeRendererProps) {
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
    const bird = { y: CANVAS_SIZE * 0.4, vy: FLAP_VEL_MIN * 0.6, angle: 0, wingPhase: 0 };
    let obstacles: Obstacle[] = [];
    let coins: Coin[] = [];
    let enemies: Enemy[] = [];
    let feathers: Feather[] = [];
    let score = 0;
    let coinsCollected = 0;
    let alive = true;
    let gameOver = false;
    let elapsed = 0;
    let phase = 1;
    let scrollSpeed = SCROLL_BASE;
    let groundScroll = 0;
    let flapStart: number | null = null;
    const milestonesHit = new Set<number>();

    // Difficulty: harder difficulty → phase floor bumps. 0..1.
    const diff = Math.max(0, Math.min(1, difficulty || 0));

    // --- VFX ---
    const particles = new ParticleEmitter();
    const shake = new ScreenShake();
    const flash = new ScreenFlash();
    const floatingText = new FloatingTextEmitter();
    const pulseRings = new PulseRingEmitter();
    const slowMo = new SlowMo();
    const scorePulse = new SpringValue({ stiffness: 200, damping: 12 });
    scorePulse.snap(1);

    // --- Environment ---
    const clouds: Cloud[] = [];
    for (let i = 0; i < 6; i++) {
      clouds.push({
        x: rng() * CANVAS_SIZE * 1.5,
        y: 40 + rng() * (GROUND_Y * 0.4),
        w: 30 + rng() * 50,
        h: 12 + rng() * 15,
        speed: 10 + rng() * 20,
        opacity: 0.04 + rng() * 0.05,
      });
    }
    const tufts: Tuft[] = [];
    for (let x = 0; x < CANVAS_SIZE * 4; x += 12 + rng() * 6) {
      tufts.push({ x, h: 4 + rng() * 4, lean: (rng() - 0.5) * 2 });
    }
    const tuftWorldLen = tufts.length > 0 ? tufts[tufts.length - 1].x + 20 : CANVAS_SIZE * 4;

    // Parallax mountains (far layer) — fixed world positions, scroll at 15% speed
    interface Mountain { x: number; peakH: number; w: number; near: boolean; }
    const mountains: Mountain[] = [];
    for (let x = 0; x < CANVAS_SIZE * 3; x += 90 + rng() * 50) {
      mountains.push({
        x,
        peakH: 50 + rng() * 55,
        w: 80 + rng() * 60,
        near: rng() < 0.4,
      });
    }
    const mountainWorldLen = mountains.length > 0
      ? mountains[mountains.length - 1].x + mountains[mountains.length - 1].w
      : CANVAS_SIZE * 3;

    // Parallax bushes (mid layer) — scroll at 40% speed
    interface Bush { x: number; size: number; tall: boolean; }
    const bushes: Bush[] = [];
    for (let x = 0; x < CANVAS_SIZE * 3; x += 55 + rng() * 40) {
      bushes.push({
        x,
        size: 14 + rng() * 12,
        tall: rng() < 0.3,
      });
    }
    const bushWorldLen = bushes.length > 0
      ? bushes[bushes.length - 1].x + 40
      : CANVAS_SIZE * 3;

    // --- Input ---
    function flapRelease(duration: number) {
      if (!alive) return;
      const t = Math.min(1, duration / FLAP_CHARGE_MS);
      const eased = 1 - (1 - t) * (1 - t);
      bird.vy = FLAP_VEL_MIN + (FLAP_VEL_MAX - FLAP_VEL_MIN) * eased;
      bird.wingPhase = 1;
      const count = 2 + Math.floor(eased * 4);
      for (let i = 0; i < count; i++) {
        feathers.push({
          x: BIRD_X - 5, y: bird.y + 4,
          vx: -20 - rng() * 40,
          vy: 10 + rng() * 30,
          rot: rng() * Math.PI * 2,
          rotSpeed: (rng() - 0.5) * 8,
          life: 500 + rng() * 300,
          maxLife: 800,
          size: 3 + rng() * 3,
        });
      }
    }

    function handlePointerDown(e: PointerEvent) {
      if (!alive) return;
      e.preventDefault();
      // Release any stale press first
      if (flapStart !== null) {
        flapRelease(performance.now() - flapStart);
      }
      flapStart = performance.now();
    }
    function handlePointerUp(e: Event) {
      if (!alive) return;
      e.preventDefault?.();
      if (flapStart !== null) {
        flapRelease(performance.now() - flapStart);
        flapStart = null;
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (!alive) return;
      if ((e.code === 'Space' || e.key === 'ArrowUp') && !e.repeat && flapStart === null) {
        e.preventDefault();
        flapStart = performance.now();
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (!alive) return;
      if ((e.code === 'Space' || e.key === 'ArrowUp') && flapStart !== null) {
        e.preventDefault();
        flapRelease(performance.now() - flapStart);
        flapStart = null;
      }
    }

    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // --- Obstacle spawning ---
    function findGapCenter(pipeX: number): number {
      const pipe = obstacles.find(o => o.type === 'pipe' && Math.abs(o.x - pipeX) < 5) as Pipe | undefined;
      if (pipe) return pipe.gapTop + pipe.gapH / 2;
      return CANVAS_SIZE / 2;
    }

    function spawnPipe(x: number, moving: boolean) {
      const gapH = Math.max(108, 148 - phase * 7);
      const minY = HUD_H + 30;
      const maxY = GROUND_Y - gapH - 50;
      const gapTop = minY + rng() * (maxY - minY);
      obstacles.push({
        type: 'pipe', x, gapTop,
        baseGapTop: gapTop, gapH, w: PIPE_W, moving,
        movePhase: rng() * Math.PI * 2,
        moveAmp: moving ? 35 + rng() * 25 : 0,
        moveSpeed: 1.4,
        scored: false,
      });
    }

    function spawnLaser(x: number) {
      const y = 110 + rng() * (GROUND_Y - 220);
      obstacles.push({
        type: 'laser', x, y, baseY: y,
        movePhase: rng() * Math.PI * 2,
        moveAmp: 28 + rng() * 36,
        moveSpeed: 1.2,
        w: 92, h: 14,
        scored: false,
      });
    }

    function spawnNext(x: number) {
      const r = rng();
      if (phase === 1) {
        spawnPipe(x, false);
        if (rng() < 0.5) coins.push({ x: x + 26, y: findGapCenter(x), collected: false, bob: 0 });
      } else if (phase === 2) {
        if (r < 0.5) spawnPipe(x, false);
        else spawnPipe(x, true);
        if (rng() < 0.5) coins.push({ x: x + 26, y: findGapCenter(x), collected: false, bob: 0 });
      } else if (phase === 3) {
        if (r < 0.35) spawnPipe(x, false);
        else if (r < 0.7) spawnPipe(x, true);
        else spawnLaser(x);
        if (rng() < 0.3) {
          enemies.push({ x: CANVAS_SIZE + 80, y: 60 + rng() * (GROUND_Y - 120), phase: rng() * Math.PI * 2 });
        }
        if (rng() < 0.4) coins.push({ x: x + 26, y: findGapCenter(x), collected: false, bob: 0 });
      } else {
        if (r < 0.3) spawnPipe(x, false);
        else if (r < 0.6) spawnPipe(x, true);
        else spawnLaser(x);
        if (rng() < 0.5) {
          enemies.push({ x: CANVAS_SIZE + 80, y: 60 + rng() * (GROUND_Y - 120), phase: rng() * Math.PI * 2 });
        }
        if (rng() < 0.3) coins.push({ x: x + 26, y: findGapCenter(x), collected: false, bob: 0 });
      }
    }
    spawnNext(CANVAS_SIZE + 60);

    function scoreBurst(x: number, y: number) {
      particles.emit({
        count: 5,
        position: { x, y },
        velocity: { min: 30, max: 90 },
        angle: { min: -Math.PI * 0.75, max: -Math.PI * 0.25 },
        lifetime: { min: 300, max: 500 },
        size: { start: 3, end: 0 },
        color: colors.gold,
        opacity: { start: 1, end: 0 },
      });
      scorePulse.snap(1.4);
      scorePulse.target = 1;
    }

    function triggerMilestone(text: string) {
      slowMo.trigger(0.55, 180);
      flash.trigger(withAlpha(colors.gold, 0.22), 110);
      shake.trigger({ intensity: 5, duration: 200 });
      floatingText.emit({
        text, x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2,
        color: colors.gold, fontSize: 24, duration: 900,
      });
      particles.emit({
        count: 26,
        position: { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 },
        velocity: { min: 90, max: 220 },
        angle: { min: 0, max: Math.PI * 2 },
        lifetime: { min: 500, max: 900 },
        size: { start: 3.5, end: 0 },
        color: [colors.gold, colors.orange, colors.pink],
        opacity: { start: 1, end: 0 },
      });
      pulseRings.emit({ x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2, color: colors.gold, maxRadius: 90, duration: 550 });
    }

    function die() {
      if (!alive) return;
      alive = false;
      shake.trigger({ intensity: 12, duration: 380 });
      flash.trigger(colors.danger, 220);
      slowMo.trigger(0.3, 300);
      particles.emit({
        count: 22,
        position: { x: BIRD_X, y: bird.y },
        velocity: { min: 80, max: 220 },
        angle: { min: 0, max: Math.PI * 2 },
        lifetime: { min: 500, max: 1000 },
        size: { start: 3.5, end: 0 },
        color: [colors.danger, colors.orange, colors.gold],
        opacity: { start: 1, end: 0 },
        gravity: 200,
      });
      pulseRings.emit({ x: BIRD_X, y: bird.y, color: colors.danger, maxRadius: 55, duration: 480 });
      floatingText.emit({
        text: 'CRASHED!',
        x: BIRD_X, y: bird.y - 30,
        color: colors.danger, fontSize: 20, duration: 900,
      });

      setTimeout(() => {
        if (gameOver) return;
        gameOver = true;
        onResult({ score, coinsCollected });
      }, 700);
    }

    // --- Game loop ---
    let lastTime = performance.now();
    let animId: number;

    function loop(now: number) {
      const rawDt = Math.min(now - lastTime, 50);
      lastTime = now;
      const dt = slowMo.update(rawDt);
      elapsed += rawDt;

      // Phase progression — score-driven so short runs still show variety.
      // Difficulty nudges the floor so higher-diff runs get harder pipes sooner.
      const diffBump = Math.floor(diff * 2); // 0..2
      if (alive) {
        const effScore = score + diffBump * 2;
        if (effScore < 3) phase = 1;
        else if (effScore < 8) phase = 2;
        else if (effScore < 15) phase = 3;
        else phase = 4;
        scrollSpeed = SCROLL_BASE + phase * 15 + diff * 20;
      }

      // Time limit
      if (alive && elapsed >= timeLimit) {
        alive = false;
        floatingText.emit({
          text: "TIME'S UP!",
          x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2,
          color: colors.gold, fontSize: 22, duration: 800,
        });
        flash.trigger(withAlpha(colors.gold, 0.18), 150);
        setTimeout(() => {
          if (gameOver) return;
          gameOver = true;
          onResult({ score, coinsCollected });
        }, 600);
      }

      if (alive) {
        const dtSec = dt / 1000;

        // Bird physics
        bird.vy = Math.min(bird.vy + GRAVITY * dtSec, MAX_FALL_VEL);
        bird.y += bird.vy * dtSec;
        const targetAngle = Math.max(-0.5, Math.min(Math.PI / 2.5, bird.vy / 400));
        bird.angle += (targetAngle - bird.angle) * Math.min(1, dtSec * 8);
        if (bird.wingPhase > 0) bird.wingPhase = Math.max(0, bird.wingPhase - dtSec * 5);

        // Scroll world
        for (const o of obstacles) {
          o.x -= scrollSpeed * dtSec;
          if (o.type === 'pipe' && o.moving) {
            o.movePhase += dtSec * o.moveSpeed;
            o.gapTop = o.baseGapTop + Math.sin(o.movePhase) * o.moveAmp;
          }
          if (o.type === 'laser') {
            o.movePhase += dtSec * o.moveSpeed;
            o.y = o.baseY + Math.sin(o.movePhase) * o.moveAmp;
          }
        }
        for (const c of coins) { c.x -= scrollSpeed * dtSec; c.bob += dtSec * 4; }
        for (const en of enemies) {
          en.x -= (scrollSpeed + 30) * dtSec;
          en.phase += dtSec * 3;
          en.y += Math.sin(en.phase) * 30 * dtSec;
        }

        // Spawn next
        const spacing = Math.max(150, 220 - phase * 12);
        let lastX = 0;
        for (const o of obstacles) if (o.x > lastX) lastX = o.x;
        if (lastX < CANVAS_SIZE - spacing) {
          spawnNext(CANVAS_SIZE + 40);
        }

        // Cleanup
        obstacles = obstacles.filter(o => o.x > -100);
        coins = coins.filter(c => c.x > -20);
        enemies = enemies.filter(en => en.x > -40);

        // Ground/ceiling collision
        if (bird.y + BIRD_R > GROUND_Y || bird.y - BIRD_R < HUD_H) {
          bird.y = Math.max(HUD_H + BIRD_R, Math.min(GROUND_Y - BIRD_R, bird.y));
          die();
        }

        // Obstacle collision
        if (alive) {
          for (const o of obstacles) {
            if (o.type === 'pipe') {
              if (BIRD_X + BIRD_R - 4 > o.x && BIRD_X - BIRD_R + 4 < o.x + o.w) {
                if (bird.y - BIRD_R + 3 < o.gapTop || bird.y + BIRD_R - 3 > o.gapTop + o.gapH) {
                  die();
                  break;
                }
              }
              if (!o.scored && o.x + o.w < BIRD_X) {
                o.scored = true;
                score++;
                scoreBurst(BIRD_X + 20, bird.y - 8);
              }
            } else {
              if (BIRD_X + BIRD_R - 3 > o.x && BIRD_X - BIRD_R + 3 < o.x + o.w &&
                  bird.y + BIRD_R - 3 > o.y - o.h / 2 && bird.y - BIRD_R + 3 < o.y + o.h / 2) {
                die();
                break;
              }
              if (!o.scored && o.x + o.w < BIRD_X) {
                o.scored = true;
                score++;
                scoreBurst(BIRD_X + 20, bird.y - 8);
              }
            }
          }
        }

        // Enemy collision
        if (alive) {
          for (const en of enemies) {
            const dx = BIRD_X - en.x;
            const dy = bird.y - en.y;
            if (Math.sqrt(dx * dx + dy * dy) < BIRD_R + 10) {
              die();
              break;
            }
          }
        }

        // Coin pickup
        for (const c of coins) {
          if (c.collected) continue;
          const dx = BIRD_X - c.x;
          const dy = bird.y - c.y;
          if (Math.sqrt(dx * dx + dy * dy) < BIRD_R + 10) {
            c.collected = true;
            coinsCollected++;
            score += 2;
            particles.emit({
              count: 10,
              position: { x: c.x, y: c.y },
              velocity: { min: 60, max: 130 },
              angle: { min: 0, max: Math.PI * 2 },
              lifetime: { min: 400, max: 700 },
              size: { start: 3, end: 0 },
              color: colors.gold,
              opacity: { start: 1, end: 0 },
            });
            floatingText.emit({
              text: '+$', x: c.x, y: c.y - 12,
              color: colors.gold, fontSize: 14, duration: 600,
            });
            scorePulse.snap(1.3);
            scorePulse.target = 1;
          }
        }

        // Milestones
        for (const m of MILESTONES) {
          if (score >= m.score && !milestonesHit.has(m.score)) {
            milestonesHit.add(m.score);
            triggerMilestone(m.text);
          }
        }

        groundScroll += scrollSpeed * dtSec;
      } else {
        // Post-death drop
        const dtSec = dt / 1000;
        bird.vy = Math.min(bird.vy + GRAVITY * dtSec, MAX_FALL_VEL);
        bird.y = Math.min(bird.y + bird.vy * dtSec, GROUND_Y - BIRD_R);
        bird.angle = Math.min(bird.angle + dtSec * 5, Math.PI / 2);
      }

      // Clouds
      const dtSec = dt / 1000;
      for (const c of clouds) {
        c.x -= c.speed * dtSec;
        if (c.x + c.w < 0) {
          c.x = CANVAS_SIZE + c.w;
          c.y = 40 + rng() * (GROUND_Y * 0.4);
        }
      }

      // Feathers
      for (let i = feathers.length - 1; i >= 0; i--) {
        const f = feathers[i];
        f.x += f.vx * dtSec;
        f.y += f.vy * dtSec;
        f.vy += 80 * dtSec;
        f.rot += f.rotSpeed * dtSec;
        f.life -= dt;
        if (f.life <= 0) feathers.splice(i, 1);
      }

      // Update VFX
      particles.update(dt);
      shake.update(dt);
      flash.update(dt);
      floatingText.update(dt);
      pulseRings.update(dt);
      scorePulse.update(dt);

      drawFrame(ctx);
      animId = requestAnimationFrame(loop);
    }

    function drawFrame(ctx: CanvasRenderingContext2D) {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      shake.apply(ctx);

      // Flat sky — SMB always used flat blues, not gradients.
      // A 2-stop gradient still reads as "flat" but adds a hint of depth.
      const skyGrad = ctx.createLinearGradient(0, HUD_H, 0, GROUND_Y);
      skyGrad.addColorStop(0, SMB.skyTop);
      skyGrad.addColorStop(1, SMB.skyBottom);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, HUD_H, CANVAS_SIZE, GROUND_Y - HUD_H);

      // --- Parallax layer 1: distant mountains (15% scroll) ---
      drawMountains(ctx);

      // --- Clouds (30% scroll) ---
      drawClouds(ctx);

      // --- Parallax layer 2: bushes (40% scroll) ---
      drawBushes(ctx);

      // Ground base — draw BEFORE pipes so pipes appear to emerge from ground
      drawGround(ctx);

      // Obstacles (pipes + lasers)
      for (const o of obstacles) {
        if (o.type === 'pipe') drawPipe(ctx, o);
        else drawLaser(ctx, o);
      }

      // Coins sit inside gaps (drawn after pipes so they hover in the gap)
      for (const c of coins) {
        if (!c.collected) drawCoin(ctx, c);
      }

      // Enemies
      for (const en of enemies) drawEnemy(ctx, en);

      // Feathers
      for (const f of feathers) {
        ctx.save();
        ctx.translate(px(f.x), px(f.y));
        ctx.rotate(f.rot);
        ctx.globalAlpha = f.life / f.maxLife;
        ctx.fillStyle = SMB.outline;
        ctx.fillRect(-f.size - 1, -1, f.size * 2 + 2, 3);
        ctx.fillStyle = SMB.feather;
        ctx.fillRect(-f.size, 0, f.size * 2, 1);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // Bird
      drawBird(ctx);

      // VFX layers (above bird so celebrations pop)
      particles.draw(ctx);
      pulseRings.draw(ctx);
      floatingText.draw(ctx);

      // Flap charge indicator — chunky bar above bird
      if (alive && flapStart !== null) {
        const duration = performance.now() - flapStart;
        const charge = Math.min(1, duration / FLAP_CHARGE_MS);
        const chargeW = 22;
        const cx = px(BIRD_X);
        const cy = px(bird.y - 28);
        // Dark frame
        ctx.fillStyle = SMB.outline;
        ctx.fillRect(cx - chargeW / 2 - 1, cy - 1, chargeW + 2, 5);
        ctx.fillStyle = '#000000';
        ctx.fillRect(cx - chargeW / 2, cy, chargeW, 3);
        // Fill
        ctx.fillStyle = charge > 0.9 ? SMB.chargeHigh : SMB.chargeLow;
        ctx.fillRect(cx - chargeW / 2, cy, Math.floor(chargeW * charge), 3);
      }

      // --- HUD strip (top 22px) ---
      drawHudBar(ctx);

      // Flash + shake restore
      flash.draw(ctx, CANVAS_SIZE, CANVAS_SIZE);
      shake.restore(ctx);
    }

    // Outlined bold text helper — 8-way outline for that NES-sprite punch
    function drawOutlinedText(
      ctx: CanvasRenderingContext2D,
      text: string,
      x: number, y: number,
      fill: string,
      outline: string = SMB.outline,
      outlineW: number = 2,
    ) {
      ctx.fillStyle = outline;
      for (let ox = -outlineW; ox <= outlineW; ox++) {
        for (let oy = -outlineW; oy <= outlineW; oy++) {
          if (ox === 0 && oy === 0) continue;
          ctx.fillText(text, x + ox, y + oy);
        }
      }
      ctx.fillStyle = fill;
      ctx.fillText(text, x, y);
    }

    function drawHudBar(ctx: CanvasRenderingContext2D) {
      // Chunky dark bar with a lighter top highlight line
      ctx.fillStyle = SMB.hudBarBg;
      ctx.fillRect(0, 0, CANVAS_SIZE, HUD_H);
      ctx.fillStyle = SMB.hudBarHi;
      ctx.fillRect(0, 0, CANVAS_SIZE, 2);
      // Bottom shadow / divider
      ctx.fillStyle = SMB.outline;
      ctx.fillRect(0, HUD_H - 1, CANVAS_SIZE, 1);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, HUD_H, CANVAS_SIZE, 1);

      // --- Left: coin icon + count ---
      // Mini coin glyph
      const coinX = 10, coinY = 7;
      ctx.fillStyle = SMB.coinShadow;
      ctx.fillRect(coinX, coinY + 1, 8, 8);
      ctx.fillStyle = SMB.coin;
      ctx.fillRect(coinX + 1, coinY, 6, 8);
      ctx.fillStyle = SMB.coinHi;
      ctx.fillRect(coinX + 1, coinY + 1, 2, 6);
      ctx.fillStyle = SMB.coinShadow;
      ctx.fillRect(coinX + 5, coinY + 1, 2, 6);

      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const padded = `x${String(coinsCollected).padStart(2, '0')}`;
      drawOutlinedText(ctx, padded, 22, 12, SMB.hudCoin, '#000000', 1);

      // --- Center: score (pulsing) ---
      const sScale = scorePulse.value;
      ctx.save();
      ctx.translate(CANVAS_SIZE / 2, 12);
      ctx.scale(sScale, sScale);
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const paddedScore = String(score).padStart(4, '0');
      drawOutlinedText(ctx, paddedScore, 0, 0, SMB.hudText, '#000000', 1);
      ctx.restore();

      // --- Right: phase indicator (colored pip + label) ---
      const phaseColor =
        phase >= 4 ? SMB.hudPhase4 :
        phase >= 3 ? SMB.hudPhase3 :
        phase >= 2 ? SMB.hudPhase2 : SMB.hudPhase1;
      // Pip dots (1-4)
      const pipX0 = CANVAS_SIZE - 50;
      for (let i = 0; i < 4; i++) {
        const px0 = pipX0 + i * 7;
        const py0 = 9;
        ctx.fillStyle = '#000000';
        ctx.fillRect(px0 - 1, py0 - 1, 6, 6);
        ctx.fillStyle = i < phase ? phaseColor : SMB.hudDim;
        ctx.fillRect(px0, py0, 4, 4);
      }
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      drawOutlinedText(ctx, 'PHASE', CANVAS_SIZE - 55, 12, SMB.hudDim, '#000000', 1);
    }

    // --- Parallax helpers ---
    function drawMountains(ctx: CanvasRenderingContext2D) {
      const baseY = GROUND_Y - 5; // sit on top of grass
      // Far layer (slowest, lightest)
      const farScroll = (groundScroll * 0.12) % mountainWorldLen;
      for (const m of mountains) {
        if (m.near) continue;
        let x = m.x - farScroll;
        while (x < -m.w) x += mountainWorldLen;
        while (x > CANVAS_SIZE + m.w) x -= mountainWorldLen;
        if (x + m.w < -5 || x > CANVAS_SIZE + 5) continue;
        drawMountain(ctx, x, baseY, m.w, m.peakH, SMB.mountainFar, SMB.mountainFarHi);
      }
      // Near layer (faster, darker)
      const nearScroll = (groundScroll * 0.22) % mountainWorldLen;
      for (const m of mountains) {
        if (!m.near) continue;
        let x = m.x - nearScroll;
        while (x < -m.w) x += mountainWorldLen;
        while (x > CANVAS_SIZE + m.w) x -= mountainWorldLen;
        if (x + m.w < -5 || x > CANVAS_SIZE + 5) continue;
        drawMountain(ctx, x, baseY, m.w, m.peakH * 0.85, SMB.mountainNear, SMB.mountainNearHi);
      }
    }

    function drawMountain(
      ctx: CanvasRenderingContext2D,
      x: number, baseY: number,
      w: number, h: number,
      body: string, highlight: string,
    ) {
      const ix = px(x);
      const ibase = px(baseY);
      // Main triangle
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(ix, ibase);
      ctx.lineTo(ix + w / 2, ibase - h);
      ctx.lineTo(ix + w, ibase);
      ctx.closePath();
      ctx.fill();
      // Snow cap
      const capH = Math.min(14, h * 0.25);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(ix + w / 2 - capH * 0.8, ibase - h + capH * 0.9);
      ctx.lineTo(ix + w / 2, ibase - h);
      ctx.lineTo(ix + w / 2 + capH * 0.8, ibase - h + capH * 0.9);
      // Jagged bottom
      ctx.lineTo(ix + w / 2 + capH * 0.5, ibase - h + capH * 1.3);
      ctx.lineTo(ix + w / 2 + capH * 0.2, ibase - h + capH * 0.9);
      ctx.lineTo(ix + w / 2 - capH * 0.1, ibase - h + capH * 1.2);
      ctx.lineTo(ix + w / 2 - capH * 0.4, ibase - h + capH * 0.85);
      ctx.closePath();
      ctx.fill();
      // Highlight streak (left face lighter)
      ctx.fillStyle = highlight;
      ctx.beginPath();
      ctx.moveTo(ix + w / 2 - 2, ibase - h + 4);
      ctx.lineTo(ix + w / 2 + 4, ibase - h + 4);
      ctx.lineTo(ix + w / 2 + 10, ibase - 12);
      ctx.lineTo(ix + w / 2, ibase - 12);
      ctx.closePath();
      ctx.fill();
    }

    function drawClouds(ctx: CanvasRenderingContext2D) {
      // Clouds scroll at their own horizontal speed (already tracked in cloud.x)
      // but we also nudge them with groundScroll * 0.05 for a gentle parallax.
      for (const c of clouds) {
        const cx = px(c.x);
        const cy = px(c.y);
        const r1 = Math.floor(c.w);
        const r2 = Math.floor(c.w * 0.6);
        const r3 = Math.floor(c.w * 0.55);
        const h = Math.floor(c.h);
        // Outline
        ctx.fillStyle = SMB.cloudOutline;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r1 + 1, h + 1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - r1 * 0.3, cy + h * 0.2, r2 + 1, Math.floor(h * 0.7) + 1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + r1 * 0.35, cy + h * 0.15, r3 + 1, Math.floor(h * 0.65) + 1, 0, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.fillStyle = SMB.cloud;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r1, h, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - r1 * 0.3, cy + h * 0.2, r2, Math.floor(h * 0.7), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + r1 * 0.35, cy + h * 0.15, r3, Math.floor(h * 0.65), 0, 0, Math.PI * 2);
        ctx.fill();
        // Bottom shadow band
        ctx.fillStyle = SMB.cloudShadow;
        ctx.beginPath();
        ctx.ellipse(cx, cy + h * 0.6, r1 * 0.95, Math.max(3, Math.floor(h * 0.35)), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawBushes(ctx: CanvasRenderingContext2D) {
      const bushScroll = (groundScroll * 0.38) % bushWorldLen;
      const baseY = GROUND_Y - 5; // sit on grass line
      for (const b of bushes) {
        let x = b.x - bushScroll;
        while (x < -40) x += bushWorldLen;
        while (x > CANVAS_SIZE + 40) x -= bushWorldLen;
        if (x < -40 || x > CANVAS_SIZE + 40) continue;
        drawBush(ctx, px(x), px(baseY), b.size, b.tall);
      }
    }

    function drawBush(ctx: CanvasRenderingContext2D, x: number, baseY: number, size: number, tall: boolean) {
      const h = tall ? size * 1.4 : size;
      // Dark outline pass
      ctx.fillStyle = SMB.bushDark;
      ctx.beginPath();
      ctx.arc(x - size, baseY - size * 0.4, size * 0.7 + 1, 0, Math.PI * 2);
      ctx.arc(x - size * 0.3, baseY - h + 1, size * 0.9 + 1, 0, Math.PI * 2);
      ctx.arc(x + size * 0.7, baseY - size * 0.9 + 1, size * 0.8 + 1, 0, Math.PI * 2);
      ctx.arc(x + size * 1.4, baseY - size * 0.3, size * 0.6 + 1, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.fillStyle = SMB.bushMid;
      ctx.beginPath();
      ctx.arc(x - size, baseY - size * 0.4, size * 0.7, 0, Math.PI * 2);
      ctx.arc(x - size * 0.3, baseY - h, size * 0.9, 0, Math.PI * 2);
      ctx.arc(x + size * 0.7, baseY - size * 0.9, size * 0.8, 0, Math.PI * 2);
      ctx.arc(x + size * 1.4, baseY - size * 0.3, size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      // Highlight dots
      ctx.fillStyle = SMB.bushHi;
      ctx.fillRect(x - size * 0.3 - 2, baseY - h - 1, 4, 3);
      ctx.fillRect(x + size * 0.7 - 1, baseY - size * 0.9 - 2, 3, 2);
    }

    function drawPipe(ctx: CanvasRenderingContext2D, o: Pipe) {
      const topH = px(o.gapTop);
      const botY = px(o.gapTop + o.gapH);
      const botH = GROUND_Y - botY;
      const capH = 16;
      const ox = px(o.x);
      const ow = o.w;

      const dark = o.moving ? SMB.movingDark : SMB.pipeDark;
      const mid = o.moving ? SMB.movingMid : SMB.pipeMid;
      const light = o.moving ? SMB.movingLight : SMB.pipeLight;

      // --- Body: simple 3-band pillar with thick black outline ---
      // Bands (left-to-right within body): shadow | body | shadow | body | highlight-stripe (inner left)
      // Really we commit to a cleaner SMB look:
      //   [outline 2] [shadow 6] [body ...] [highlight 3] [body ...] [shadow 4] [outline 2]
      // This reads as pillars at a glance, not zebra stripes.
      function pipeBody(y: number, h: number) {
        if (h <= 0) return;
        // Outline
        ctx.fillStyle = SMB.outline;
        ctx.fillRect(ox, y, 2, h);
        ctx.fillRect(ox + ow - 2, y, 2, h);
        // Left shadow
        ctx.fillStyle = dark;
        ctx.fillRect(ox + 2, y, 6, h);
        // Main body
        ctx.fillStyle = mid;
        ctx.fillRect(ox + 8, y, ow - 14, h);
        // Inner highlight stripe (just one, thick, like SMB)
        ctx.fillStyle = light;
        ctx.fillRect(ox + 10, y, 3, h);
        // Right shadow
        ctx.fillStyle = dark;
        ctx.fillRect(ox + ow - 8, y, 6, h);
      }

      // --- Cap: wider than body, chunky outline, rivet dots ---
      function pipeCap(y: number) {
        const cx = ox - 4;
        const cw = ow + 8;
        // Outline box
        ctx.fillStyle = SMB.outline;
        ctx.fillRect(cx, y, cw, capH);
        // Inner fills
        ctx.fillStyle = dark;
        ctx.fillRect(cx + 2, y + 2, cw - 4, capH - 4);
        ctx.fillStyle = mid;
        ctx.fillRect(cx + 4, y + 4, cw - 8, capH - 8);
        // Bright highlight band (left inner)
        ctx.fillStyle = light;
        ctx.fillRect(cx + 4, y + 4, 4, capH - 8);
        // Bottom inner shadow
        ctx.fillStyle = dark;
        ctx.fillRect(cx + 4, y + capH - 6, cw - 8, 2);
        // Rivets (top + bottom inner corners)
        ctx.fillStyle = SMB.outline;
        ctx.fillRect(cx + 3, y + 3, 2, 2);
        ctx.fillRect(cx + cw - 5, y + 3, 2, 2);
        ctx.fillRect(cx + 3, y + capH - 5, 2, 2);
        ctx.fillRect(cx + cw - 5, y + capH - 5, 2, 2);
      }

      // Top half: body hangs from HUD, cap sits at bottom of top half
      if (topH - capH > HUD_H) pipeBody(HUD_H, topH - capH - HUD_H);
      pipeCap(topH - capH);

      // Bottom half: cap at top, body descends
      pipeCap(botY);
      pipeBody(botY + capH, botH - capH);
    }

    function drawLaser(ctx: CanvasRenderingContext2D, o: Laser) {
      const ax = px(o.x), bx = px(o.x + o.w);
      const y = px(o.y);

      // Bowser-castle anchor posts — flat grey blocks with outline + bolt accents
      function post(cx: number) {
        // Outline
        ctx.fillStyle = SMB.outline;
        ctx.fillRect(cx - 5, y - 16, 10, 32);
        // Body
        ctx.fillStyle = SMB.laserPost;
        ctx.fillRect(cx - 4, y - 15, 8, 30);
        // Highlight band
        ctx.fillStyle = SMB.laserPostHi;
        ctx.fillRect(cx - 4, y - 15, 2, 30);
        // Dark shadow band
        ctx.fillStyle = SMB.laserPostDark;
        ctx.fillRect(cx + 2, y - 15, 2, 30);
        // Bolts
        ctx.fillStyle = SMB.outline;
        ctx.fillRect(cx - 1, y - 10, 2, 2);
        ctx.fillRect(cx - 1, y + 8, 2, 2);
      }
      post(ax);
      post(bx);

      // Pulsing beam — flat red with bright yellow-white core, no glow/shadow blur
      const pulse = Math.sin(elapsed * 0.012); // -1..1
      const beamH = Math.round(o.h + pulse * 2);
      const beamY = y - Math.floor(beamH / 2);
      // Outer outline
      ctx.fillStyle = SMB.outline;
      ctx.fillRect(ax + 3, beamY - 1, o.w - 6, beamH + 2);
      // Glow band
      ctx.fillStyle = SMB.laserGlow;
      ctx.fillRect(ax + 3, beamY, o.w - 6, beamH);
      // Main beam
      ctx.fillStyle = SMB.laserBeam;
      ctx.fillRect(ax + 3, beamY + 2, o.w - 6, beamH - 4);
      // Hot core (oscillates)
      const coreH = 2 + Math.floor((pulse + 1) * 1.5);
      ctx.fillStyle = SMB.laserCore;
      ctx.fillRect(ax + 3, y - Math.floor(coreH / 2), o.w - 6, coreH);
    }

    function drawCoin(ctx: CanvasRenderingContext2D, c: Coin) {
      const bob = Math.sin(c.bob) * 3;
      const spin = Math.cos(c.bob * 1.8); // -1..1
      // Width oscillates for spin. Min 2 (thin edge), max 9 (face)
      const w = Math.max(2, Math.round(2 + Math.abs(spin) * 7));
      const cx = px(c.x);
      const cy = px(c.y + bob);
      const h = 11;

      // Outline
      ctx.fillStyle = SMB.outline;
      ctx.fillRect(cx - w - 1, cy - h - 1, (w + 1) * 2, (h + 1) * 2);
      // Shadow ring (under)
      ctx.fillStyle = SMB.coinShadow;
      ctx.fillRect(cx - w, cy - h, w * 2, h * 2);
      // Main gold face
      ctx.fillStyle = SMB.coin;
      ctx.fillRect(cx - w + 1, cy - h + 1, w * 2 - 2, h * 2 - 2);
      // Top highlight stripe
      ctx.fillStyle = SMB.coinHi;
      ctx.fillRect(cx - w + 1, cy - h + 1, w * 2 - 2, 2);
      // Bottom darker band
      ctx.fillStyle = SMB.coinShadow;
      ctx.fillRect(cx - w + 1, cy + h - 3, w * 2 - 2, 2);
      // Center $ mark (only when facing near-forward)
      if (w >= 6) {
        ctx.fillStyle = SMB.coinShadow;
        ctx.fillRect(cx - 1, cy - 5, 2, 10);
        ctx.fillRect(cx - 3, cy - 3, 6, 2);
        ctx.fillRect(cx - 3, cy + 1, 6, 2);
      }
    }

    function drawEnemy(ctx: CanvasRenderingContext2D, en: Enemy) {
      // Koopa Paratroopa style — yellow body, green shell, dark outlines, flapping wings
      const ex = px(en.x);
      const ey = px(en.y);
      const wing = Math.sin(elapsed * 0.025) * 5;

      ctx.save();
      ctx.translate(ex, ey);

      // --- Back wing (behind body) ---
      function drawWing(side: number, flap: number) {
        const wx = -3 * side;
        const wy = -2 + flap;
        // Outline
        ctx.fillStyle = SMB.outline;
        ctx.beginPath();
        ctx.ellipse(wx, wy, 9, 5.5, side * -0.25, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(wx, wy, 7.5, 4, side * -0.25, 0, Math.PI * 2);
        ctx.fill();
        // Feather lines
        ctx.fillStyle = SMB.outline;
        for (let i = -1; i <= 1; i++) {
          ctx.fillRect(wx + i * 2.5, wy - 2, 1, 4);
        }
      }
      drawWing(-1, wing);

      // --- Body (yellow, goomba-ish) ---
      // Outline
      ctx.fillStyle = SMB.outline;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.fillStyle = SMB.enemyBody;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      // Belly shadow (lower half darker)
      ctx.fillStyle = SMB.enemyBodyDark;
      ctx.beginPath();
      ctx.arc(0, 3, 8, 0, Math.PI);
      ctx.fill();

      // --- Shell on top ---
      ctx.fillStyle = SMB.outline;
      ctx.beginPath();
      ctx.ellipse(0, -4, 10, 6, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = SMB.enemyShell;
      ctx.beginPath();
      ctx.ellipse(0, -4, 9, 5, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      // Shell highlight
      ctx.fillStyle = SMB.enemyShellHi;
      ctx.fillRect(-6, -8, 4, 2);
      // Shell dark band
      ctx.fillStyle = SMB.enemyShellDark;
      ctx.fillRect(-9, -5, 18, 1);

      // --- Front wing (in front of body) ---
      drawWing(1, -wing);

      // --- Angry eyes (red pupils, white sclera) ---
      ctx.fillStyle = SMB.outline;
      ctx.fillRect(-5, -2, 4, 5);
      ctx.fillRect(1, -2, 4, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-4, -1, 2, 3);
      ctx.fillRect(2, -1, 2, 3);
      ctx.fillStyle = SMB.enemyEye;
      ctx.fillRect(-3, 0, 1, 2);
      ctx.fillRect(3, 0, 1, 2);

      // --- Sharp beak pointing left (into motion) ---
      ctx.fillStyle = SMB.outline;
      ctx.beginPath();
      ctx.moveTo(-7, 3);
      ctx.lineTo(-15, 2);
      ctx.lineTo(-7, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = SMB.birdBeak;
      ctx.beginPath();
      ctx.moveTo(-7, 4);
      ctx.lineTo(-13, 3);
      ctx.lineTo(-7, 5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    function drawGround(ctx: CanvasRenderingContext2D) {
      // Grass strip — bright green with pixelated jagged top edge
      const grassTop = GROUND_Y - 6;
      // Dark outline on top
      ctx.fillStyle = SMB.outline;
      ctx.fillRect(0, grassTop - 1, CANVAS_SIZE, 2);
      // Grass body
      ctx.fillStyle = SMB.grass;
      ctx.fillRect(0, grassTop, CANVAS_SIZE, 4);
      // Grass dark underside
      ctx.fillStyle = SMB.grassDark;
      ctx.fillRect(0, grassTop + 4, CANVAS_SIZE, 2);

      // Dirt bands — chunky solid colors, no gradients
      const dirtTop = GROUND_Y;
      ctx.fillStyle = SMB.groundTop;
      ctx.fillRect(0, dirtTop, CANVAS_SIZE, 3);
      ctx.fillStyle = SMB.groundMid;
      ctx.fillRect(0, dirtTop + 3, CANVAS_SIZE, GROUND_H - 8);
      ctx.fillStyle = SMB.groundDeep;
      ctx.fillRect(0, dirtTop + GROUND_H - 5, CANVAS_SIZE, 5);

      // Scrolling checkerboard brick pattern in dirt (classic SMB3 look)
      const brickW = 16;
      const brickH = 10;
      const scroll = Math.floor(groundScroll) % (brickW * 2);
      for (let row = 0; row < 3; row++) {
        const by = dirtTop + 4 + row * brickH;
        if (by > dirtTop + GROUND_H - brickH) break;
        const rowOffset = row % 2 === 0 ? 0 : brickW;
        for (let x = -scroll - rowOffset; x < CANVAS_SIZE + brickW; x += brickW * 2) {
          // Alternating bright/dark brick pairs
          ctx.fillStyle = SMB.groundLine;
          ctx.fillRect(x, by, 1, brickH);
          ctx.fillRect(x, by + brickH - 1, brickW * 2, 1);
          // Inner highlight dot
          ctx.fillStyle = SMB.groundTop;
          ctx.fillRect(x + 2, by + 2, 2, 2);
          ctx.fillRect(x + brickW + 2, by + 2, 2, 2);
        }
      }

      // Vertical mortar lines between bricks (every brickW, alternating row offsets)
      ctx.fillStyle = SMB.groundLine;
      for (let row = 0; row < 3; row++) {
        const by = dirtTop + 4 + row * brickH;
        if (by > dirtTop + GROUND_H - brickH) break;
        const rowOffset = row % 2 === 0 ? 0 : Math.floor(brickW / 2);
        for (let x = -scroll + rowOffset; x < CANVAS_SIZE + brickW; x += brickW) {
          ctx.fillRect(x, by, 1, brickH);
        }
      }

      // Grass tufts on top of grass band (fixed world-x positions, scroll-translated)
      const s = groundScroll % tuftWorldLen;
      for (const t of tufts) {
        let x = t.x - s;
        while (x < -8) x += tuftWorldLen;
        while (x > CANVAS_SIZE + 8) x -= tuftWorldLen;
        if (x < -8 || x > CANVAS_SIZE + 8) continue;
        const ix = px(x);
        // Dark base outline
        ctx.fillStyle = SMB.outline;
        ctx.beginPath();
        ctx.moveTo(ix - 1, grassTop);
        ctx.lineTo(ix + 2 + t.lean, grassTop - t.h - 1);
        ctx.lineTo(ix + 5, grassTop);
        ctx.fill();
        // Bright tip
        ctx.fillStyle = SMB.grass;
        ctx.beginPath();
        ctx.moveTo(ix, grassTop);
        ctx.lineTo(ix + 2 + t.lean, grassTop - t.h);
        ctx.lineTo(ix + 4, grassTop);
        ctx.fill();
      }
    }

    function drawBird(ctx: CanvasRenderingContext2D) {
      ctx.save();
      ctx.translate(px(BIRD_X), px(bird.y));
      ctx.rotate(bird.angle);

      // --- Tail (behind body) ---
      ctx.fillStyle = SMB.outline;
      ctx.beginPath();
      ctx.ellipse(-BIRD_R + 1, -2, 8, 4, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = SMB.birdBodyDark;
      ctx.beginPath();
      ctx.ellipse(-BIRD_R + 2, -2, 7, 3, 0.25, 0, Math.PI * 2);
      ctx.fill();
      // Tail feather segments — pixel stripes
      ctx.fillStyle = SMB.outline;
      ctx.fillRect(-BIRD_R - 2, -3, 1, 2);
      ctx.fillRect(-BIRD_R - 1, 0, 1, 2);

      // --- Body: thick black outline + bright body + belly ---
      // Outer outline (silhouette)
      ctx.fillStyle = SMB.outline;
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_R + 1, 0, Math.PI * 2);
      ctx.fill();
      // Dark underside
      ctx.fillStyle = SMB.birdBodyDark;
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
      ctx.fill();
      // Bright top body
      ctx.fillStyle = SMB.birdBody;
      ctx.beginPath();
      ctx.arc(0, -1, BIRD_R - 1, 0, Math.PI * 2);
      ctx.fill();
      // Belly patch (cream)
      ctx.fillStyle = SMB.birdBelly;
      ctx.beginPath();
      ctx.ellipse(2, 4, BIRD_R * 0.55, BIRD_R * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // --- Wing: outlined ellipse with pixel feather detail ---
      const wingY = -1 + bird.wingPhase * -7;
      const wingAngle = bird.wingPhase * -0.5;
      ctx.save();
      ctx.translate(-3, 2);
      ctx.rotate(wingAngle);
      ctx.fillStyle = SMB.outline;
      ctx.beginPath();
      ctx.ellipse(0, wingY, 10, 6, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = SMB.birdBody;
      ctx.beginPath();
      ctx.ellipse(0, wingY, 8.5, 4.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
      // Feather lines
      ctx.fillStyle = SMB.birdBodyDark;
      ctx.fillRect(-5, wingY - 1, 10, 1);
      // Tip highlight
      ctx.fillStyle = SMB.birdBelly;
      ctx.beginPath();
      ctx.ellipse(-1, wingY - 1, 4, 1.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // --- Eye: big white circle with bold black pupil ---
      ctx.fillStyle = SMB.outline;
      ctx.beginPath();
      ctx.arc(6, -5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(6, -5, 4, 0, Math.PI * 2);
      ctx.fill();
      // Pupil (offset to front, gives direction of gaze)
      ctx.fillStyle = SMB.outline;
      ctx.fillRect(7, -6, 3, 4);
      // Sparkle
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(8, -6, 1, 1);

      // --- Beak: two-tone red/orange wedge, pixel-chunky ---
      // Outline
      ctx.fillStyle = SMB.outline;
      ctx.beginPath();
      ctx.moveTo(BIRD_R - 3, -4);
      ctx.lineTo(BIRD_R + 9, 0);
      ctx.lineTo(BIRD_R + 9, 3);
      ctx.lineTo(BIRD_R - 3, 6);
      ctx.closePath();
      ctx.fill();
      // Body
      ctx.fillStyle = SMB.birdBeak;
      ctx.beginPath();
      ctx.moveTo(BIRD_R - 2, -3);
      ctx.lineTo(BIRD_R + 7, 0);
      ctx.lineTo(BIRD_R + 7, 2);
      ctx.lineTo(BIRD_R - 2, 5);
      ctx.closePath();
      ctx.fill();
      // Top highlight
      ctx.fillStyle = SMB.birdBeakHi;
      ctx.beginPath();
      ctx.moveTo(BIRD_R - 2, -3);
      ctx.lineTo(BIRD_R + 6, 0);
      ctx.lineTo(BIRD_R - 2, 0);
      ctx.closePath();
      ctx.fill();
      // Mouth line
      ctx.fillStyle = SMB.outline;
      ctx.fillRect(BIRD_R - 1, 1, 7, 1);

      // --- Cheek blush (small pink dot) ---
      ctx.fillStyle = SMB.birdBeak;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(-1, 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.restore();
    }

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [seed, difficulty, timeLimit, onResult, theme]);

  return (
    <div ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{ width: '100%', height: '100%', touchAction: 'none' }}
      />
    </div>
  );
}
