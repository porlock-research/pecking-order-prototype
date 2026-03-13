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
 * Shows a brief color flash + scale bounce when the value changes.
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
      const timeout = setTimeout(() => setFlash(null), 400);
      prevValue.current = value;
      return () => clearTimeout(timeout);
    }
  }, [value]);

  const flashColor = flash === 'decrease' ? decreaseColor : flash === 'increase' ? increaseColor : undefined;

  return (
    <motion.span
      animate={{
        scale: flash ? [1, 1.2, 1] : 1,
        color: flashColor ?? (style?.color as string) ?? 'inherit',
      }}
      transition={{
        scale: { duration: 0.3, ease: 'easeOut' },
        color: { duration: 0.4 },
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
