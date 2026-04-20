import { describe, it, expect, vi } from 'vitest';
import { FactTypes, PushTriggerSchema, DEFAULT_PUSH_CONFIG } from '@pecking-order/shared-types';
import { phasePushPayload, handleFactPush, type PushContext } from '../push-triggers';

describe('PushTriggerSchema — CONFESSION_OPEN', () => {
  it('accepts CONFESSION_OPEN as a valid trigger', () => {
    expect(PushTriggerSchema.parse('CONFESSION_OPEN')).toBe('CONFESSION_OPEN');
  });

  it('DEFAULT_PUSH_CONFIG enables CONFESSION_OPEN by default', () => {
    expect(DEFAULT_PUSH_CONFIG.CONFESSION_OPEN).toBe(true);
  });
});

describe('phasePushPayload — CONFESSION_OPEN', () => {
  it('returns "A confession phase has opened." with main intent', () => {
    const result = phasePushPayload('CONFESSION_OPEN', 2);
    expect(result).not.toBeNull();
    expect(result!.payload.body).toBe('A confession phase has opened.');
    expect(result!.intent).toEqual({ kind: 'main' });
  });
});

describe('handleFactPush — confession fact types return no push', () => {
  function makeCtx(): PushContext & { __sent: unknown[] } {
    const sent: unknown[] = [];
    const ctx = {
      env: {} as any,
      roster: {
        p1: { id: 'p1', personaName: 'Ada', status: 'ALIVE' },
        p2: { id: 'p2', personaName: 'Ben', status: 'ALIVE' },
      },
      connections: new Map(),
      waitUntil: vi.fn(),
      __sent: sent,
    } as any;
    return ctx;
  }

  it.each([
    [FactTypes.CONFESSION_POSTED, { channelId: 'CONFESSION-d2', handle: 'Confessor #1', text: 'x', dayIndex: 2 }],
    [FactTypes.CONFESSION_PHASE_STARTED, { dayIndex: 2, channelId: 'CONFESSION-d2' }],
    [FactTypes.CONFESSION_PHASE_ENDED, { dayIndex: 2, channelId: 'CONFESSION-d2', postCount: 5 }],
  ])('%s returns undefined (no fact-path push)', (type, payload) => {
    const ctx = makeCtx();
    const result = handleFactPush(ctx, {
      type,
      actorId: type === FactTypes.CONFESSION_POSTED ? 'p1' : 'SYSTEM',
      payload,
      timestamp: Date.now(),
    }, null);
    expect(result).toBeUndefined();
  });
});
