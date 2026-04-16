import { useCallback } from 'react';
import { useGameStore, selectRevealsToReplay } from '../../../store/useGameStore';

type Reveal = { kind: 'elimination' | 'winner'; dayIndex?: number };

export function useRevealQueue() {
  const queue = useGameStore(selectRevealsToReplay);
  const forced = useGameStore(s => s.forcedReveal);
  const setForced = useGameStore(s => s.setForcedReveal);
  const markRevealSeen = useGameStore(s => s.markRevealSeen);

  const current = forced ?? queue[0] ?? null;

  const dismiss = useCallback(() => {
    if (!current) return;
    markRevealSeen(current.kind, current.dayIndex);
    setForced(null);
  }, [current, markRevealSeen, setForced]);

  const forcePlay = useCallback((reveal: Reveal) => {
    setForced(reveal);
  }, [setForced]);

  return { current, dismiss, forcePlay };
}
