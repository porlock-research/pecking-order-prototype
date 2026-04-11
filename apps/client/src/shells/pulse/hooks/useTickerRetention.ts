import { useMemo } from 'react';
import { useGameStore } from '../../../store/useGameStore';

const SIXTY_MINUTES_MS = 60 * 60 * 1000;

export function useTickerRetention() {
  const tickerMessages = useGameStore(s => s.tickerMessages);
  return useMemo(() => {
    const cutoff = Date.now() - SIXTY_MINUTES_MS;
    return tickerMessages.filter(m => new Date(m.timestamp).getTime() > cutoff);
  }, [tickerMessages]);
}
