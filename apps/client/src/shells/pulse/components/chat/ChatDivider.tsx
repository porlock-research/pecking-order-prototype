import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PULSE_SPRING } from '../../springs';

interface Props {
  onCleared: () => void;
}

export function ChatDivider({ onCleared }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting && e.boundingClientRect.top < 0) {
            onCleared();
            io.disconnect();
            return;
          }
        }
      },
      { threshold: 0 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [onCleared]);

  // Lines draw from center outward; label scales up. One-shot on mount —
  // the "new content landed" beat this surface has been missing.
  const lineAnim = reduce
    ? { animate: { scaleX: 1 }, transition: { duration: 0 } }
    : {
        initial: { scaleX: 0 },
        animate: { scaleX: 1 },
        transition: { ...PULSE_SPRING.gentle, delay: 0.05 },
      };
  const labelAnim = reduce
    ? { animate: { opacity: 1, scale: 1 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, scale: 0.85 },
        animate: { opacity: 1, scale: 1 },
        transition: PULSE_SPRING.pop,
      };

  return (
    <div
      ref={ref}
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0 8px',
        color: 'var(--pulse-accent)',
      }}
    >
      <motion.div
        {...lineAnim}
        style={{
          flex: 1,
          height: 1,
          background: 'var(--pulse-accent)',
          opacity: 0.5,
          transformOrigin: 'right center',
        }}
      />
      <motion.div
        {...labelAnim}
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        New
      </motion.div>
      <motion.div
        {...lineAnim}
        style={{
          flex: 1,
          height: 1,
          background: 'var(--pulse-accent)',
          opacity: 0.5,
          transformOrigin: 'left center',
        }}
      />
    </div>
  );
}
