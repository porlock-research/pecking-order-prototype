import { useState, useEffect } from 'react';

/**
 * Returns a live-ticking formatted countdown string for an upcoming activity.
 * Returns null if the target time has passed or is undefined.
 */
export function useActivityCountdown(startsAt: number | undefined): string | null {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!startsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startsAt]);

  if (!startsAt) return null;
  const ms = startsAt - now;
  if (ms <= 0) return null;

  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hours > 0) return `Starts in ${hours}h ${mins}m`;
  if (mins > 0) return `Starts in ${mins}m ${secs}s`;
  return `Starts in ${secs}s`;
}
