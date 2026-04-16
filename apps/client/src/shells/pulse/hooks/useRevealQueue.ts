import { useState, useCallback } from 'react';
import { useGameStore, selectRevealsToReplay } from '../../../store/useGameStore';

type Reveal = { kind: 'elimination' | 'winner'; dayIndex?: number };

export function useRevealQueue() {
  const queue = useGameStore(selectRevealsToReplay);
  const markRevealSeen = useGameStore(s => s.markRevealSeen);
  const [forced, setForced] = useState<Reveal | null>(null);

  const current = forced ?? queue[0] ?? null;

  const dismiss = useCallback(() => {
    if (!current) return;
    markRevealSeen(current.kind, current.dayIndex);
    setForced(null);
  }, [current, markRevealSeen]);

  const forcePlay = useCallback((reveal: Reveal) => {
    setForced(reveal);
  }, []);

  return { current, dismiss, forcePlay };
}
