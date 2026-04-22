import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  /** ISO8601 string — from manifest.startTime on DYNAMIC games. */
  startTime: string | undefined;
}

function formatDelta(msUntilStart: number): { value: string; unit: 'past' | 'soon' | 'close' | 'far' } {
  if (msUntilStart <= 0) return { value: 'now', unit: 'past' };
  const totalSec = Math.floor(msUntilStart / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days >= 1) {
    // Far: days remaining, no seconds
    return { value: hours > 0 ? `${days}d ${hours}h` : `${days}d`, unit: 'far' };
  }
  if (hours >= 1) {
    // Close: H:MM
    return { value: `${hours}h ${String(minutes).padStart(2, '0')}m`, unit: 'close' };
  }
  // Soon: M:SS, tabular
  return { value: `${minutes}:${String(seconds).padStart(2, '0')}`, unit: 'soon' };
}

/**
 * Pregame countdown timer — ticks every second when the startTime is within
 * an hour (so seconds move); every 30s for "close" range (< 24h); every
 * minute otherwise. Degrades gracefully when startTime is absent (STATIC/
 * ADMIN games have no scheduled start — renders nothing).
 *
 * Slotted into PulseHeader next to the Day/Pregame eyebrow. Tabular-nums
 * keeps the value jitter-free during ticking.
 */
export function PregameCountdown({ startTime }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startTime) return;
    const start = new Date(startTime).getTime();
    const tick = () => {
      const current = Date.now();
      setNow(current);
      // Adaptive cadence — 1s when under an hour, 30s when under a day,
      // 60s otherwise. Prevents needless re-renders for distant starts.
      const delta = start - current;
      if (delta <= 3_600_000) return 1000;
      if (delta <= 86_400_000) return 30_000;
      return 60_000;
    };
    let handle: ReturnType<typeof setTimeout>;
    const loop = () => {
      const next = tick();
      handle = setTimeout(loop, next);
    };
    loop();
    return () => clearTimeout(handle);
  }, [startTime]);

  if (!startTime) return null;
  const delta = new Date(startTime).getTime() - now;
  const { value, unit } = formatDelta(delta);

  const color =
    unit === 'past' ? 'var(--pulse-accent)' :
    unit === 'soon' ? 'var(--pulse-accent)' :
    unit === 'close' ? 'var(--pulse-gold)' :
    'var(--pulse-text-2)';

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 'var(--pulse-radius-pill)',
        background: 'var(--pulse-surface-2)',
        border: `1px solid color-mix(in oklch, ${color} 30%, transparent)`,
      }}
    >
      <span style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--pulse-text-3)',
      }}>
        Day 1 in
      </span>
      <span style={{
        fontFamily: 'var(--po-font-display)',
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        color,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
    </motion.div>
  );
}
