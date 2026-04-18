import { describe, it, expect } from 'vitest';
import { FactTypes } from '@pecking-order/shared-types';
import { projectFactForClient } from '../../projections';

describe('projectFactForClient — CONFESSION_POSTED', () => {
  const baseFact = {
    type: FactTypes.CONFESSION_POSTED,
    actorId: 'p3',
    targetId: undefined,
    payload: { channelId: 'CONFESSION-d2', handle: 'Confessor #3', text: 'the truth is I hate mondays', dayIndex: 2 },
    timestamp: 1_700_000_000_000,
  };

  it('strips actorId before broadcast', () => {
    const projected = projectFactForClient(baseFact);
    expect((projected as any).actorId).toBeUndefined();
  });

  it('preserves handle, text, channelId, dayIndex, timestamp', () => {
    const projected = projectFactForClient(baseFact);
    expect(projected.payload.handle).toBe('Confessor #3');
    expect(projected.payload.text).toBe(baseFact.payload.text);
    expect(projected.payload.channelId).toBe('CONFESSION-d2');
    expect(projected.payload.dayIndex).toBe(2);
    expect(projected.timestamp).toBe(baseFact.timestamp);
  });

  it('does NOT mutate the input fact', () => {
    const copy = JSON.parse(JSON.stringify(baseFact));
    projectFactForClient(baseFact);
    expect(baseFact).toEqual(copy);
  });

  it('pass-through for non-CONFESSION_POSTED facts (preserves actorId)', () => {
    const other = { type: FactTypes.DM_SENT, actorId: 'p1', payload: {}, timestamp: 1 };
    const projected = projectFactForClient(other);
    expect(projected.actorId).toBe('p1');
  });

  it('preserves PROMPT_RESULT actorId (legitimate match-cartridge full-reveal path)', () => {
    // Plan 2 spec: PROMPT_RESULT for CONFESSION_MATCH carries the full handle→author mapping.
    // This is the legitimate reveal path. projectFactForClient must NOT add a generic strip.
    const promptResult = {
      type: FactTypes.PROMPT_RESULT, actorId: 'SYSTEM',
      payload: { promptType: 'CONFESSION_MATCH', results: { fullReveal: [{ handle: 'Confessor #1', authorId: 'p1' }] } },
      timestamp: 1,
    };
    const projected = projectFactForClient(promptResult);
    expect(projected.actorId).toBe('SYSTEM');
    expect(projected.payload.results.fullReveal[0].authorId).toBe('p1');
  });
});
