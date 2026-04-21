import { useCallback } from 'react';
import { useGameStore, selectRevealsToReplay } from '../../../store/useGameStore';

type Reveal = { kind: 'elimination' | 'winner'; dayIndex?: number };

export function useRevealQueue() {
  const queue = useGameStore(selectRevealsToReplay);
  const forced = useGameStore(s => s.forcedReveal);
  const setForced = useGameStore(s => s.setForcedReveal);
  const markRevealSeen = useGameStore(s => s.markRevealSeen);

  const current = forced ?? queue[0] ?? null;

  // `dismiss()` dismisses the CURRENT reveal at render time via closure.
  // Safe for keyboard/idle dismiss, but NOT for click handlers that might
  // fire across renders during rapid queue progression — use `dismissSpecific`
  // instead, which binds to an explicit (kind, dayIndex) captured at
  // click/callsite time.
  const dismiss = useCallback(() => {
    if (!current) return;
    markRevealSeen(current.kind, current.dayIndex);
    setForced(null);
  }, [current, markRevealSeen, setForced]);

  const dismissSpecific = useCallback(
    (kind: Reveal['kind'], dayIndex?: number) => {
      markRevealSeen(kind, dayIndex);
      setForced(null);
    },
    [markRevealSeen, setForced],
  );

  const forcePlay = useCallback(
    (reveal: Reveal) => {
      setForced(reveal);
    },
    [setForced],
  );

  return { current, dismiss, dismissSpecific, forcePlay };
}
