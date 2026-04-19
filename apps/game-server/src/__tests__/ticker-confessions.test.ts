import { describe, it, expect } from 'vitest';
import { FactTypes, TickerCategories } from '@pecking-order/shared-types';
import { factToTicker } from '../ticker';

const roster = {
  p1: { id: 'p1', personaName: 'Ada', status: 'ALIVE' },
  p2: { id: 'p2', personaName: 'Ben', status: 'ALIVE' },
};

describe('factToTicker — confession phase facts', () => {
  it('CONFESSION_PHASE_STARTED → SOCIAL_PHASE ticker with booth copy', () => {
    const fact = {
      type: FactTypes.CONFESSION_PHASE_STARTED,
      actorId: 'SYSTEM',
      payload: { dayIndex: 2, channelId: 'CONFESSION-d2' },
      timestamp: 1_700_000_000_000,
    };
    const msg = factToTicker(fact, roster);
    expect(msg).not.toBeNull();
    expect(msg!.category).toBe(TickerCategories.SOCIAL_PHASE);
    expect(msg!.text).toBe('The confession booth is open.');
    expect(msg!.timestamp).toBe(1_700_000_000_000);
  });

  it('CONFESSION_PHASE_ENDED produces no ticker entry', () => {
    const fact = {
      type: FactTypes.CONFESSION_PHASE_ENDED,
      actorId: 'SYSTEM',
      payload: { dayIndex: 2, channelId: 'CONFESSION-d2', postCount: 14 },
      timestamp: 1_700_000_000_000,
    };
    expect(factToTicker(fact, roster)).toBeNull();
  });

  it('CONFESSION_POSTED produces no ticker entry (policy: silence during phase)', () => {
    const fact = {
      type: FactTypes.CONFESSION_POSTED,
      actorId: 'p1',
      payload: { channelId: 'CONFESSION-d2', handle: 'Confessor #3', text: 'x', dayIndex: 2 },
      timestamp: 1,
    };
    expect(factToTicker(fact, roster)).toBeNull();
  });
});
