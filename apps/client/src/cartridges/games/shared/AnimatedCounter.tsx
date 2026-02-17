import { useState, useEffect, useRef } from 'react';

interface AnimatedCounterProps {
  target: number;
  duration?: number;
  onComplete?: () => void;
}

export function AnimatedCounter({ target, duration = 1500, onComplete }: AnimatedCounterProps) {
  const [current, setCurrent] = useState(0);
  const startRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (target <= 0) {
      setCurrent(0);
      onComplete?.();
      return;
    }
    startRef.current = performance.now();
    doneRef.current = false;

    const step = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setCurrent(Math.round(eased * target));
      if (t < 1) {
        requestAnimationFrame(step);
      } else if (!doneRef.current) {
        doneRef.current = true;
        onComplete?.();
      }
    };
    requestAnimationFrame(step);
  }, [target, duration, onComplete]);

  return <>{current}</>;
}
