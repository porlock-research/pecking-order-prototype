import { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { resolveScheduling } from '@pecking-order/shared-types';

/**
 * Returns a formatted countdown string to the next OPEN_GROUP_CHAT or OPEN_DMS event,
 * or null if no countdown is available (ADMIN mode or already open).
 */
export function useCountdown(target: 'group' | 'dm'): string | null {
  const manifest = useGameStore(s => s.manifest);
  const dayIndex = useGameStore(s => s.dayIndex);
  const groupChatOpen = useGameStore(s => s.groupChatOpen);
  const dmsOpen = useGameStore(s => s.dmsOpen);

  const isOpen = target === 'group' ? groupChatOpen : dmsOpen;

  const targetTimestamp = useMemo(() => {
    if (isOpen) return null;
    if (!manifest) return null;

    const scheduling = resolveScheduling(manifest);
    if (scheduling !== 'PRE_SCHEDULED') return null;

    const action = target === 'group' ? 'OPEN_GROUP_CHAT' : 'OPEN_DMS';
    const now = Date.now();

    // Search current day and future days for the next matching event
    const days = manifest.days || [];
    for (let d = Math.max(0, dayIndex - 1); d < days.length; d++) {
      const timeline = days[d]?.timeline || [];
      for (const event of timeline) {
        if (event.action === action) {
          const eventTime = new Date(event.time).getTime();
          if (eventTime > now) return eventTime;
        }
      }
    }
    return null;
  }, [manifest, dayIndex, isOpen, target]);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!targetTimestamp) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  if (isOpen || !targetTimestamp) return null;

  const diff = Math.max(0, targetTimestamp - now);
  if (diff <= 0) return null;

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  const pad = (n: number) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export interface CountdownResult {
  label: string | null;
  urgent: boolean;
}

/**
 * Sibling of useCountdown that takes a raw target timestamp and returns both
 * the formatted label and an urgent flag (< 60s remaining). Used by the Pulse
 * cartridge overlay header so red-coloring isn't driven by string parsing.
 */
export function useCountdownWithUrgency(targetTimestamp: number | null): CountdownResult {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!targetTimestamp) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  if (!targetTimestamp) return { label: null, urgent: false };
  const diff = Math.max(0, targetTimestamp - now);
  if (diff <= 0) return { label: null, urgent: false };

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const label = hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
  return { label, urgent: diff < 60_000 };
}
