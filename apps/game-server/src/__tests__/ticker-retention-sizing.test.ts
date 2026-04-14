import { describe, it, expect } from 'vitest';
import { broadcastTicker } from '../ticker';

function makeTickerMsg(timestamp: number) {
  return {
    id: `msg-${timestamp}`,
    text: 'x',
    category: 'SOCIAL.TRANSFER' as const,
    timestamp,
    involvedPlayerIds: [] as string[],
  };
}

describe('ticker retention', () => {
  it('keeps ≥30 messages in a simulated 30-event scenario', () => {
    let history: any[] = [];
    const now = Date.now();
    // 30 events spread across 30 minutes
    for (let i = 0; i < 30; i++) {
      history = broadcastTicker(
        makeTickerMsg(now - (30 - i) * 60_000),
        history,
        () => [] as any,
      );
    }
    expect(history.length).toBeGreaterThanOrEqual(30);
  });

  it('drops entries older than 60 minutes', () => {
    const now = Date.now();
    const oldMsg = makeTickerMsg(now - 61 * 60_000);
    const newMsg = makeTickerMsg(now);
    const result = broadcastTicker(newMsg, [oldMsg], () => [] as any);
    expect(result).not.toContain(oldMsg);
    expect(result).toContain(newMsg);
  });

  it('enforces safety cap of 2000', () => {
    const base = Date.now();
    // Flood with 2500 very-recent messages (all within retention)
    const flood = Array.from({ length: 2500 }, (_, i) => makeTickerMsg(base - i));
    const result = broadcastTicker(makeTickerMsg(base + 1), flood, () => [] as any);
    expect(result.length).toBeLessThanOrEqual(2000);
  });
});
