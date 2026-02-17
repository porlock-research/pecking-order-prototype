import { useState, useEffect } from 'react';

interface CountdownBarProps {
  deadline: number | null;
  totalMs?: number;
}

export function CountdownBar({ deadline, totalMs = 15_000 }: CountdownBarProps) {
  const [pct, setPct] = useState(100);

  useEffect(() => {
    if (!deadline) { setPct(100); return; }
    const tick = () => {
      const remaining = deadline - Date.now();
      setPct(Math.max(0, Math.min(100, (remaining / totalMs) * 100)));
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [deadline, totalMs]);

  return (
    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-100 ease-linear"
        style={{
          width: `${pct}%`,
          background: pct > 30
            ? 'linear-gradient(90deg, var(--po-gold), var(--po-gold-bright, #ffd700))'
            : 'linear-gradient(90deg, var(--po-danger, #ef4444), var(--po-pink, #f472b6))',
        }}
      />
    </div>
  );
}
