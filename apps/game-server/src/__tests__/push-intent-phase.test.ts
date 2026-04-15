import { describe, it, expect } from 'vitest';
import { phasePushPayload } from '../push-triggers';

describe('phasePushPayload — intents', () => {
  const dayManifest = { gameType: 'TRIVIA', voteType: 'MAJORITY' } as any;

  it('VOTING returns cartridge_active intent with voting kind and cartridgeId', () => {
    const result = phasePushPayload('VOTING', 3, dayManifest);
    expect(result?.intent).toEqual({
      kind: 'cartridge_active',
      cartridgeId: 'voting-3-MAJORITY',
      cartridgeKind: 'voting',
    });
  });

  it('DAILY_GAME returns cartridge_active with game kind', () => {
    const result = phasePushPayload('DAILY_GAME', 3, dayManifest);
    expect(result?.intent).toEqual({
      kind: 'cartridge_active',
      cartridgeId: 'game-3-TRIVIA',
      cartridgeKind: 'game',
    });
  });

  it('ACTIVITY returns cartridge_active with prompt kind', () => {
    const result = phasePushPayload('ACTIVITY', 3, { ...dayManifest, promptType: 'POLL' } as any);
    expect(result?.intent).toEqual({
      kind: 'cartridge_active',
      cartridgeId: 'prompt-3-POLL',
      cartridgeKind: 'prompt',
    });
  });

  it('END_GAME returns cartridge_result intent', () => {
    const result = phasePushPayload('END_GAME', 3, dayManifest);
    expect(result?.intent).toEqual({ kind: 'cartridge_result', cartridgeId: 'game-3-TRIVIA' });
  });

  it('END_ACTIVITY returns cartridge_result with prompt kind', () => {
    const result = phasePushPayload('END_ACTIVITY', 3, { promptType: 'POLL' } as any);
    expect(result?.intent).toEqual({ kind: 'cartridge_result', cartridgeId: 'prompt-3-POLL' });
  });

  it('DAY_START, NIGHT_SUMMARY, OPEN/CLOSE gates return main intent', () => {
    for (const trig of ['DAY_START', 'NIGHT_SUMMARY', 'OPEN_DMS', 'CLOSE_DMS', 'OPEN_GROUP_CHAT', 'CLOSE_GROUP_CHAT']) {
      expect(phasePushPayload(trig, 3, dayManifest)?.intent).toEqual({ kind: 'main' });
    }
  });
});
