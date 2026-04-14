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

  it('uses UNKNOWN typeKey when mechanism absent', () => {
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
