import { useState, useRef, useCallback, useEffect } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';

const CANVAS_WIDTH = 280;
const CANVAS_HEIGHT = 360;
const BLOCK_HEIGHT = 16;
const BASE_SPEED = 80; // px/sec
const SPEED_INCREASE = 12; // px/sec per layer
const INITIAL_WIDTH = 100;

interface Layer {
  x: number;
  width: number;
  perfect: boolean;
}

export default function StackerRenderer({ seed, onResult }: ArcadeRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTimeRef = useRef(performance.now());
  const resultSentRef = useRef(false);
  const rafRef = useRef(0);

  const layersRef = useRef<Layer[]>([]);
  const movingBlockRef = useRef({ x: 0, width: INITIAL_WIDTH, direction: 1, speed: BASE_SPEED });
  const gameOverRef = useRef(false);
  const [height, setHeight] = useState(0);
  const [perfectLayers, setPerfectLayers] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const sendFinalResult = useCallback((h: number, p: number) => {
    if (resultSentRef.current) return;
    resultSentRef.current = true;
    onResult({
      height: h,
      perfectLayers: p,
      timeElapsed: Math.floor(performance.now() - startTimeRef.current),
    });
  }, [onResult]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const mb = movingBlockRef.current;

      if (!gameOverRef.current) {
        // Move block
        mb.x += mb.direction * mb.speed * dt;
        if (mb.x + mb.width >= CANVAS_WIDTH) {
          mb.x = CANVAS_WIDTH - mb.width;
          mb.direction = -1;
        }
        if (mb.x <= 0) {
          mb.x = 0;
          mb.direction = 1;
        }
      }

      // Draw
      ctx.fillStyle = '#0d0d12';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const layers = layersRef.current;
      const stackTop = CANVAS_HEIGHT - layers.length * BLOCK_HEIGHT;

      // Camera offset: keep top of stack visible
      const cameraY = Math.max(0, (layers.length - 15) * BLOCK_HEIGHT);

      // Draw placed layers
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        const y = CANVAS_HEIGHT - (i + 1) * BLOCK_HEIGHT + cameraY;
        if (y > CANVAS_HEIGHT + 20 || y < -20) continue;

        const hue = (i * 15) % 360;
        ctx.fillStyle = layer.perfect
          ? `hsla(${hue}, 80%, 60%, 0.9)`
          : `hsla(${hue}, 60%, 50%, 0.7)`;
        ctx.fillRect(layer.x, y, layer.width, BLOCK_HEIGHT - 1);

        // Top highlight
        ctx.fillStyle = `hsla(${hue}, 80%, 75%, 0.3)`;
        ctx.fillRect(layer.x, y, layer.width, 2);
      }

      // Draw moving block
      if (!gameOverRef.current) {
        const y = stackTop - BLOCK_HEIGHT + cameraY;
        const hue = (layers.length * 15) % 360;
        ctx.fillStyle = `hsla(${hue}, 80%, 65%, 0.9)`;
        ctx.fillRect(mb.x, y, mb.width, BLOCK_HEIGHT - 1);
        ctx.fillStyle = `hsla(${hue}, 80%, 80%, 0.4)`;
        ctx.fillRect(mb.x, y, mb.width, 2);
      }

      // Ground line
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.15)';
      ctx.lineWidth = 2;
      const groundY = CANVAS_HEIGHT + cameraY;
      if (groundY <= CANVAS_HEIGHT) {
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(CANVAS_WIDTH, groundY);
        ctx.stroke();
      }

      // HUD
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = 'rgba(255, 215, 0, 0.7)';
      ctx.textAlign = 'right';
      ctx.fillText(`${layers.length}`, CANVAS_WIDTH - 10, 20);

      if (gameOverRef.current) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = '#ffd700';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 8);
        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillText(`Height: ${layers.length}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 14);
        return; // stop loop
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = useCallback(() => {
    if (gameOverRef.current) return;

    const mb = movingBlockRef.current;
    const layers = layersRef.current;

    if (layers.length === 0) {
      // First layer — always place
      const perfect = true; // first drop is always perfect
      layers.push({ x: mb.x, width: mb.width, perfect });
      setHeight(1);
      setPerfectLayers(1);
      mb.speed = BASE_SPEED + SPEED_INCREASE;
      mb.direction = 1;
      mb.x = 0;
      return;
    }

    const prev = layers[layers.length - 1];

    // Calculate overlap
    const overlapLeft = Math.max(mb.x, prev.x);
    const overlapRight = Math.min(mb.x + mb.width, prev.x + prev.width);
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth <= 0) {
      // Complete miss — game over
      gameOverRef.current = true;
      setGameOver(true);
      sendFinalResult(layers.length, layers.filter(l => l.perfect).length);
      return;
    }

    const perfect = Math.abs(mb.x - prev.x) < 2;
    const newWidth = perfect ? prev.width : overlapWidth;
    const newX = perfect ? prev.x : overlapLeft;

    layers.push({ x: newX, width: newWidth, perfect });
    const h = layers.length;
    const p = layers.filter(l => l.perfect).length;
    setHeight(h);
    setPerfectLayers(p);

    // Set up next block
    mb.width = newWidth;
    mb.speed = BASE_SPEED + SPEED_INCREASE * h;
    mb.direction = 1;
    mb.x = 0;

    // Too narrow to continue
    if (newWidth < 4) {
      gameOverRef.current = true;
      setGameOver(true);
      sendFinalResult(h, p);
    }
  }, [sendFinalResult]);

  // Input handlers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); handleDrop(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleDrop]);

  return (
    <div className="px-4 pb-4 space-y-3">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-skin-dim">
          Height: <span className="text-skin-base font-bold">{height}</span>
        </span>
        <span className="text-skin-dim">
          Perfect: <span className="text-skin-gold font-bold">{perfectLayers}</span>
        </span>
      </div>

      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleDrop}
          className="rounded-lg border border-white/[0.06] cursor-pointer"
          style={{ touchAction: 'none' }}
        />
      </div>

      <p className="text-[10px] font-mono text-skin-dim/50 text-center">
        Tap / Space to drop. Align blocks to keep stacking.
      </p>
    </div>
  );
}
