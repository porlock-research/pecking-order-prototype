import { describe, it, expect } from 'vitest';
import { buildSyncPayload } from '../sync';

function makeFakeL2Snapshot(opts: { dayIndex: number }) {
  return {
    value: { activeSession: {} },
    context: {
      gameId: 'test-game',
      dayIndex: opts.dayIndex,
      roster: { p1: { personaName: 'Alice', status: 'ALIVE' } },
      manifest: null,
      completedPhases: [],
      winner: null,
      goldPool: 0,
      goldPayouts: [],
      gameHistory: [],
    },
    children: {},
  };
}

describe('buildSyncPayload — cartridgeId + updatedAt', () => {
  it('injects cartridgeId and updatedAt on active voting cartridge', () => {
    const l3Context = {
      cartridgeUpdatedAt: { activeVotingCartridge: 1700000000000 },
      channels: {},
      chatLog: [],
    };
    const cartridges = {
      activeVotingCartridge: { mechanism: 'MAJORITY', votes: {}, eligibleVoters: ['p1'] },
      rawGameCartridge: null,
      activePromptCartridge: null,
      activeDilemmaCartridge: null,
    };
    const snapshot = makeFakeL2Snapshot({ dayIndex: 3 });

    const sync = buildSyncPayload(
      { snapshot, l3Context, chatLog: [], cartridges },
      'p1',
    );

    expect(sync.context.activeVotingCartridge.cartridgeId).toBe('voting-3-MAJORITY');
    expect(sync.context.activeVotingCartridge.updatedAt).toBe(1700000000000);
  });

  it('falls back to voteType when mechanism absent', () => {
    // Voting machine contexts expose voteType (not mechanism); the older
    // code path only checked cartridge.mechanism and every cartridgeId
    // came out as voting-N-UNKNOWN. Guard the voteType fallback with a
    // regression case so the mismatch can't re-open silently.
    const cartridges = {
      activeVotingCartridge: { voteType: 'MAJORITY', votes: {}, eligibleVoters: ['p1'] },
      rawGameCartridge: null,
      activePromptCartridge: null,
      activeDilemmaCartridge: null,
    };
    const sync = buildSyncPayload(
      {
        snapshot: makeFakeL2Snapshot({ dayIndex: 2 }),
        l3Context: { cartridgeUpdatedAt: {} },
        chatLog: [],
        cartridges,
      },
      'p1',
    );
    expect(sync.context.activeVotingCartridge.cartridgeId).toBe('voting-2-MAJORITY');
  });

  it('uses UNKNOWN typeKey when both mechanism and voteType absent', () => {
    const cartridges = {
      activeVotingCartridge: { votes: {} },
      rawGameCartridge: null,
      activePromptCartridge: null,
      activeDilemmaCartridge: null,
    };
    const sync = buildSyncPayload(
      {
        snapshot: makeFakeL2Snapshot({ dayIndex: 1 }),
        l3Context: { cartridgeUpdatedAt: {} },
        chatLog: [],
        cartridges,
      },
      'p1',
    );
    expect(sync.context.activeVotingCartridge.cartridgeId).toBe('voting-1-UNKNOWN');
  });

  it('omits cartridge fields when cartridge is null', () => {
    const cartridges = {
      activeVotingCartridge: null,
      rawGameCartridge: null,
      activePromptCartridge: null,
      activeDilemmaCartridge: null,
    };
    const sync = buildSyncPayload(
      {
        snapshot: makeFakeL2Snapshot({ dayIndex: 1 }),
        l3Context: {},
        chatLog: [],
        cartridges,
      },
      'p1',
    );
    expect(sync.context.activeVotingCartridge).toBeNull();
  });
});
