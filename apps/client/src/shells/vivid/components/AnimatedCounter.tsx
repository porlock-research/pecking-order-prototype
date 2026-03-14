import React, { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  style?: React.CSSProperties;
  /** Flash color when value decreases (default: coral) */
  decreaseColor?: string;
  /** Flash color when value increases (default: gold) */
  increaseColor?: string;
}

/**
 * Animated number counter with spring bounce on value changes.
 * Decrease: dramatic shake + scale + longer color flash.
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
      setFlash(value > prevValue.current ? 'increase' : 'decrease');
      const duration = value < prevValue.current ? 800 : 400;
      const timeout = setTimeout(() => setFlash(null), duration);
      prevValue.current = value;
      return () => clearTimeout(timeout);
    }
  }, [value]);

  const flashColor = flash === 'decrease' ? decreaseColor : flash === 'increase' ? increaseColor : undefined;
  const isDecrease = flash === 'decrease';

  return (
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
  );
}
