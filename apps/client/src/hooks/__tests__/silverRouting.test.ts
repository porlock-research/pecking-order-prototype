import { describe, it, expect } from 'vitest';
import { buildSilverPayload } from '../useGameEngine';

describe('SEND_SILVER payload', () => {
  it('never includes channelId: MAIN', () => {
    const payload = buildSilverPayload(5, 'p2') as Record<string, unknown>;
    expect(payload.channelId).toBeUndefined();
    expect(payload.channel).toBeUndefined();
  });

  it('carries targetId so the server can resolve an existing DM/GROUP_DM', () => {
    const payload = buildSilverPayload(7, 'p3');
    expect(payload.targetId).toBe('p3');
    expect(payload.amount).toBe(7);
    expect(payload.type).toBe('SOCIAL.SEND_SILVER');
  });

  it('matches the minimal shape (no extraneous fields leak)', () => {
    const payload = buildSilverPayload(1, 'p4');
    expect(Object.keys(payload).sort()).toEqual(['amount', 'targetId', 'type']);
  });
});
