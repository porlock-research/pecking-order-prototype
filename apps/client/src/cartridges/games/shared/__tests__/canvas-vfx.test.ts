import { describe, it, expect } from 'vitest';
import {
  SpringValue,
  FloatingTextEmitter,
  drawDottedLine,
  WavePool,
  SwarmRenderer,
  DebrisEmitter,
} from '../canvas-vfx';

// --- SpringValue ---

describe('SpringValue', () => {
  it('starts at snapped value', () => {
    const s = new SpringValue({ stiffness: 180, damping: 12 });
    s.snap(5);
    expect(s.value).toBe(5);
  });

  it('moves toward target over time', () => {
    const s = new SpringValue({ stiffness: 180, damping: 12 });
    s.snap(0);
    s.target = 100;
    for (let i = 0; i < 50; i++) s.update(10);
    expect(s.value).toBeGreaterThan(80);
    expect(s.value).toBeLessThan(120);
  });

  it('settles to target after enough time', () => {
    const s = new SpringValue({ stiffness: 180, damping: 12 });
    s.snap(0);
    s.target = 50;
    for (let i = 0; i < 200; i++) s.update(10);
    expect(Math.abs(s.value - 50)).toBeLessThan(0.1);
    expect(s.settled).toBe(true);
  });

  it('overshoots with low damping', () => {
    const s = new SpringValue({ stiffness: 300, damping: 5 });
    s.snap(0);
    s.target = 100;
    let maxVal = 0;
    for (let i = 0; i < 100; i++) {
      s.update(10);
      if (s.value > maxVal) maxVal = s.value;
    }
    expect(maxVal).toBeGreaterThan(100);
  });

  it('snap resets velocity', () => {
    const s = new SpringValue({ stiffness: 180, damping: 12 });
    s.snap(0);
    s.target = 100;
    for (let i = 0; i < 10; i++) s.update(10);
    s.snap(50);
    expect(s.value).toBe(50);
    expect(s.settled).toBe(false); // target is still 100
    s.target = 50;
    expect(s.settled).toBe(true);
  });
});

// --- FloatingTextEmitter ---

describe('FloatingTextEmitter', () => {
  it('emits and updates without throwing', () => {
    const emitter = new FloatingTextEmitter();
    emitter.emit({ text: '+100', x: 50, y: 50, color: '#fff', fontSize: 16, duration: 500 });
    expect(() => emitter.update(100)).not.toThrow();
  });

  it('clears all items', () => {
    const emitter = new FloatingTextEmitter();
    emitter.emit({ text: 'TEST', x: 0, y: 0, color: '#fff', fontSize: 14, duration: 300 });
    emitter.clear();
    emitter.update(100);
  });

  it('removes items after duration expires', () => {
    const emitter = new FloatingTextEmitter();
    emitter.emit({ text: 'GONE', x: 0, y: 0, color: '#fff', fontSize: 14, duration: 200 });
    emitter.update(250);
    emitter.clear();
  });
});

// --- WavePool ---

describe('WavePool', () => {
  it('starts empty', () => {
    const pool = new WavePool();
    expect(pool.sourceCount).toBe(0);
  });

  it('adds sources and computes wave height', () => {
    const pool = new WavePool();
    pool.addSource({ x: 0, y: 0, amplitude: 1, wavelength: 50, speed: 100, decay: 0.005, color: '#fff' });
    expect(pool.sourceCount).toBe(1);
    const h = pool.getHeight(0, 0);
    expect(typeof h).toBe('number');
  });

  it('removes sources that exceed maxRadius', () => {
    const pool = new WavePool();
    pool.addSource({ x: 0, y: 0, amplitude: 1, wavelength: 50, speed: 1000, decay: 0.005, color: '#fff', maxRadius: 100 });
    pool.update(200);
    expect(pool.sourceCount).toBe(0);
  });

  it('clears all sources', () => {
    const pool = new WavePool();
    pool.addSource({ x: 0, y: 0, amplitude: 1, wavelength: 50, speed: 100, decay: 0.005, color: '#fff' });
    pool.addSource({ x: 50, y: 50, amplitude: 1, wavelength: 50, speed: 100, decay: 0.005, color: '#fff' });
    pool.clear();
    expect(pool.sourceCount).toBe(0);
  });
});

// --- SwarmRenderer ---

describe('SwarmRenderer', () => {
  it('manages boids', () => {
    const swarm = new SwarmRenderer({
      boidSize: 5, trailLength: 3,
      bodyColor: '#fff', trailColor: '#aaa',
      trailOpacity: { start: 0.5, end: 0 },
      connectionColor: '#444', connectionOpacity: 0.05, connectionMaxDist: 20,
    });
    swarm.addBoid(0, 10, 10, 0);
    swarm.addBoid(1, 20, 20, 0.5);
    expect(swarm.boidCount).toBe(2);
    swarm.removeBoid(0);
    expect(swarm.boidCount).toBe(1);
    swarm.clear();
    expect(swarm.boidCount).toBe(0);
  });

  it('updates boid positions and trails', () => {
    const swarm = new SwarmRenderer({
      boidSize: 5, trailLength: 3,
      bodyColor: '#fff', trailColor: '#aaa',
      trailOpacity: { start: 0.5, end: 0 },
      connectionColor: '#444', connectionOpacity: 0.05, connectionMaxDist: 20,
    });
    swarm.addBoid(0, 10, 10, 0);
    swarm.updateBoid(0, 15, 15, 0.3);
    swarm.updateBoid(0, 20, 20, 0.5);
    expect(swarm.boidCount).toBe(1);
  });
});

// --- DebrisEmitter ---

describe('DebrisEmitter', () => {
  it('emits and updates debris', () => {
    const debris = new DebrisEmitter();
    debris.emit({
      pieces: [{ x: 10, y: 10, width: 5, height: 5 }],
      color: '#f00', gravity: 400,
      rotationSpeed: { min: 1, max: 3 },
      fadeDelay: 100, fadeDuration: 200,
    });
    debris.update(50);
    expect(() => debris.update(50)).not.toThrow();
  });

  it('removes debris after fade completes', () => {
    const debris = new DebrisEmitter();
    debris.emit({
      pieces: [{ x: 0, y: 0, width: 5, height: 5 }],
      color: '#f00', gravity: 400,
      rotationSpeed: { min: 1, max: 3 },
      fadeDelay: 100, fadeDuration: 200,
    });
    // Total lifetime = fadeDelay + fadeDuration = 300ms
    debris.update(350);
    debris.clear();
  });
});
