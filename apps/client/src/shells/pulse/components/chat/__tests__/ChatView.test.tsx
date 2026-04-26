import { describe, it, expect } from 'vitest';
import { GAME_MASTER_ID, TickerCategories } from '@pecking-order/shared-types';
import type { TickerMessage } from '@pecking-order/shared-types';
import { isNarratorTicker, rendersAsBubble } from '../ChatView';

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

describe('ChatView — rendersAsBubble (clustering predicate)', () => {
  it('treats a regular MAIN message as a bubble', () => {
    expect(rendersAsBubble({ senderId: 'p1' })).toBe(true);
  });

  it('treats a redacted whisper as a non-bubble (centered WhisperCard)', () => {
    // Guards the cluster bug: player whispered to X, then sent a MAIN message.
    // The whisper is rendered to non-targets as "Someone whispered to X" with
    // no avatar header; the next MAIN msg from that same sender must therefore
    // show its own avatar+name header — it is not a continuation of anything
    // visible.
    expect(rendersAsBubble({ senderId: 'p1', whisperTarget: 'p2', redacted: true })).toBe(false);
  });

  it('treats a visible whisper (sender or target view) as a bubble', () => {
    // From the sender or target's perspective, the whisper IS a regular
    // MessageCard bubble. Clustering should still apply.
    expect(rendersAsBubble({ senderId: 'p1', whisperTarget: 'p2', redacted: false })).toBe(true);
    expect(rendersAsBubble({ senderId: 'p1', whisperTarget: 'p2' })).toBe(true);
  });

  it('treats SYSTEM/GM/GAME_MASTER broadcasts as non-bubbles', () => {
    expect(rendersAsBubble({ senderId: 'SYSTEM' })).toBe(false);
    expect(rendersAsBubble({ senderId: 'GM' })).toBe(false);
    expect(rendersAsBubble({ senderId: GAME_MASTER_ID })).toBe(false);
  });
});
