import { describe, it, expect } from 'vitest';
import { buildL3Context } from '../l3-session';
import type { SocialPlayer } from '@pecking-order/shared-types';

function roster(ids: string[]): Record<string, SocialPlayer> {
  const out: Record<string, SocialPlayer> = {};
  ids.forEach((id, i) => {
    out[id] = {
      id, personaName: `Player ${i}`, avatarUrl: '', status: 'ALIVE',
      silver: 50, gold: 0, realUserId: `u${i}`,
    } as SocialPlayer;
  });
  return out;
}

describe('buildL3Context — confessionPhase initial state (T7)', () => {
  it('initializes confessionPhase with inactive default', () => {
    const ctx = buildL3Context({
      dayIndex: 2,
      roster: roster(['p1', 'p2', 'p3']),
      manifest: undefined,
    });
    expect(ctx.confessionPhase).toEqual({
      active: false,
      handlesByPlayer: {},
      posts: [],
      closesAt: null,
    });
  });

  it('confessionPhase shape is independent of roster size', () => {
    const empty = buildL3Context({ dayIndex: 1, roster: {}, manifest: undefined });
    const large = buildL3Context({ dayIndex: 1, roster: roster(['p1', 'p2', 'p3', 'p4', 'p5']), manifest: undefined });
    expect(empty.confessionPhase).toEqual(large.confessionPhase);
  });

  it('snapshot restore via initialChatLog still produces inactive confessionPhase', () => {
    // initialChatLog non-empty signals snapshot restore; confessionPhase still defaults to inactive
    const ctx = buildL3Context({
      dayIndex: 2,
      roster: roster(['p1', 'p2']),
      manifest: undefined,
      initialChatLog: [{ id: 'm1', senderId: 'p1', content: 'restored', timestamp: 1, channelId: 'MAIN' } as any],
    });
    expect(ctx.confessionPhase.active).toBe(false);
    expect(ctx.confessionPhase.handlesByPlayer).toEqual({});
    expect(ctx.confessionPhase.posts).toEqual([]);
  });
});
