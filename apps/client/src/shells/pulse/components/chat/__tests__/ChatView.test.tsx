import { describe, it, expect } from 'vitest';
import { TickerCategories } from '@pecking-order/shared-types';
import type { TickerMessage } from '@pecking-order/shared-types';
import { isNarratorTicker } from '../ChatView';

function tickerFixture(overrides: Partial<TickerMessage>): TickerMessage {
  return {
    id: 't1',
    category: TickerCategories.SOCIAL_INVITE,
    text: 'stub',
    timestamp: 1,
    actorId: 'SYSTEM',
    ...overrides,
  } as TickerMessage;
}

describe('ChatView — narrator ticker filter', () => {
  it('accepts SOCIAL_PHASE ticker messages (T4 confession phase signaling)', () => {
    const ticker = tickerFixture({
      category: TickerCategories.SOCIAL_PHASE,
      text: 'The confession booth is open.',
    });
    expect(isNarratorTicker(ticker)).toBe(true);
  });

  it('still accepts SOCIAL_INVITE (regression)', () => {
    const ticker = tickerFixture({ category: TickerCategories.SOCIAL_INVITE });
    expect(isNarratorTicker(ticker)).toBe(true);
  });

  it('rejects SOCIAL_TRANSFER (silver/gold — rendered as BroadcastCard)', () => {
    const ticker = tickerFixture({ category: TickerCategories.SOCIAL_TRANSFER });
    expect(isNarratorTicker(ticker)).toBe(false);
  });

  it('rejects SOCIAL_NUDGE', () => {
    const ticker = tickerFixture({ category: TickerCategories.SOCIAL_NUDGE });
    expect(isNarratorTicker(ticker)).toBe(false);
  });
});
