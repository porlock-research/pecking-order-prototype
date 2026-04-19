import { useEffect, useRef, useState } from 'react';

interface GameTimerBarProps {
  /** Epoch ms when the timer expires. */
  deadline: number | null;
  /** Total ms span this bar represents (default 15s). */
  totalMs?: number;
  /** Per-game accent — bar fill color. */
  accent: string;
}

/**
 * Slim per-round timer bar. Replaces CountdownBar's two-stop linear
 * gradient with a single accent fill that crossfades to a warning tint
 * in the last 30%. RAF-driven (one re-render per visible state change),
 * not setState-on-interval.
 */
export function GameTimerBar({ deadline, totalMs = 15_000, accent }: GameTimerBarProps) {
  const [pct, setPct] = useState(100);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      setPct(100);
      return;
    }
    const tick = () => {
      const remaining = deadline - Date.now();
      const next = Math.max(0, Math.min(100, (remaining / totalMs) * 100));
      setPct(prev => (Math.abs(prev - next) > 0.4 ? next : prev));
      if (remaining > 0) rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [deadline, totalMs]);

  const warning = pct <= 30;
  const fill = warning
    ? `color-mix(in oklch, ${accent} 70%, var(--po-pink))`
    : accent;

  return (
    <div
      role="timer"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        width: '100%',
        height: 4,
        borderRadius: 999,
        overflow: 'hidden',
        background: 'color-mix(in oklch, var(--po-text) 8%, transparent)',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 999,
          background: fill,
          transition: 'width 100ms linear, background 300ms ease',
          boxShadow: warning
            ? `0 0 8px color-mix(in oklch, var(--po-pink) 60%, transparent)`
            : undefined,
        }}
      />
    </div>
  );
}
