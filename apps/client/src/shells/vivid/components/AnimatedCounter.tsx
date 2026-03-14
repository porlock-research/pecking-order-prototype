import React, { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  style?: React.CSSProperties;
  /** Flash color when value decreases (default: coral) */
  decreaseColor?: string;
  /** Flash color when value increases (default: gold) */
  increaseColor?: string;
}

/* ---- Particle burst config ---- */

const PARTICLE_COUNT = 8;

function generateParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: Date.now() + i,
    angle: (360 / PARTICLE_COUNT) * i + (Math.random() - 0.5) * 40,
    distance: 18 + Math.random() * 14,
    size: 3 + Math.random() * 3,
    delay: Math.random() * 0.08,
  }));
}

type Particle = ReturnType<typeof generateParticles>[number];

/**
 * Animated number counter with spring bounce on value changes.
 * Decrease: dramatic shake + scale + color flash + particle burst.
 * Increase: gentle scale bounce + brief color flash.
 */
export function AnimatedCounter({
  value,
  style,
  decreaseColor = '#D94073',
  increaseColor = '#D4960A',
}: AnimatedCounterProps) {
  const prevValue = useRef(value);
  const [flash, setFlash] = useState<'increase' | 'decrease' | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const springValue = useSpring(value, { stiffness: 300, damping: 30 });
  const displayValue = useTransform(springValue, (v) => Math.round(v));
  const [displayed, setDisplayed] = useState(value);

  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  useEffect(() => {
    const unsubscribe = displayValue.on('change', (v) => setDisplayed(v));
    return unsubscribe;
  }, [displayValue]);

  useEffect(() => {
    if (prevValue.current !== value) {
      const direction = value > prevValue.current ? 'increase' : 'decrease';
      setFlash(direction);
      if (direction === 'decrease') {
        setParticles(generateParticles());
      }
      const duration = direction === 'decrease' ? 800 : 400;
      const timeout = setTimeout(() => {
        setFlash(null);
        setParticles([]);
      }, duration);
      prevValue.current = value;
      return () => clearTimeout(timeout);
    }
  }, [value]);

  const flashColor = flash === 'decrease' ? decreaseColor : flash === 'increase' ? increaseColor : undefined;
  const isDecrease = flash === 'decrease';

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <motion.span
        animate={{
          scale: isDecrease
            ? [1, 1.35, 0.9, 1.15, 1]
            : flash
              ? [1, 1.2, 1]
              : 1,
          x: isDecrease ? [0, -3, 3, -2, 2, 0] : 0,
          color: flashColor ?? (style?.color as string) ?? 'inherit',
        }}
        transition={{
          scale: { duration: isDecrease ? 0.5 : 0.3, ease: 'easeOut' },
          x: { duration: 0.4, ease: 'easeOut' },
          color: { duration: isDecrease ? 0.8 : 0.4 },
        }}
        style={{
          ...style,
          display: 'inline-block',
          willChange: 'transform',
        }}
      >
        {displayed}
      </motion.span>

      {/* Particle burst on decrease */}
      <AnimatePresence>
        {particles.map((p) => {
          const rad = (p.angle * Math.PI) / 180;
          const tx = Math.cos(rad) * p.distance;
          const ty = Math.sin(rad) * p.distance;
          return (
            <motion.span
              key={p.id}
              initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              animate={{ opacity: 0, x: tx, y: ty, scale: 0.2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, delay: p.delay, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: p.size,
                height: p.size,
                borderRadius: '50%',
                background: decreaseColor,
                pointerEvents: 'none',
                marginTop: -p.size / 2,
                marginLeft: -p.size / 2,
              }}
            />
          );
        })}
      </AnimatePresence>
    </span>
  );
}
