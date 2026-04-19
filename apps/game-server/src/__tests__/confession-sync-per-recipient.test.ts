import { describe, it, expect } from 'vitest';
import { buildSyncPayload } from '../sync';

function makeFakeL2Snapshot() {
  return {
    value: { activeSession: {} },
    context: {
      gameId: 'test-game',
      dayIndex: 2,
      roster: {
        p1: { id: 'p1', personaName: 'Ada', status: 'ALIVE' },
        p2: { id: 'p2', personaName: 'Ben', status: 'ALIVE' },
        p3: { id: 'p3', personaName: 'Cid', status: 'ALIVE' },
      },
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

function emptyCartridges() {
  return {
    activeVotingCartridge: null,
    rawGameCartridge: null,
    activePromptCartridge: null,
    activeDilemmaCartridge: null,
  };
}

function activeL3Context() {
  return {
    channels: {
      'CONFESSION-d2': {
        id: 'CONFESSION-d2',
        type: 'CONFESSION',
        memberIds: ['p1', 'p2', 'p3'],
        capabilities: ['CONFESS'],
        createdBy: 'SYSTEM',
        createdAt: 0,
      },
    },
    confessionPhase: {
      active: true,
      handlesByPlayer: { p1: 'Confessor #3', p2: 'Confessor #1', p3: 'Confessor #2' },
      posts: [{ handle: 'Confessor #3', text: 'the truth is', ts: 1 }],
    },
    cartridgeUpdatedAt: {},
  };
}

describe('buildSyncPayload — per-recipient confessionPhase projection', () => {
  it('p1 sees only their own myHandle; handlesByPlayer never leaks', () => {
    const sync = buildSyncPayload(
      { snapshot: makeFakeL2Snapshot(), l3Context: activeL3Context(), chatLog: [], cartridges: emptyCartridges() },
      'p1',
    );
    expect(sync.context.confessionPhase.myHandle).toBe('Confessor #3');
    expect(sync.context.confessionPhase.handleCount).toBe(3);
    expect(sync.context.confessionPhase.handlesByPlayer).toBeUndefined();
  });

  it('p2 sees their own myHandle, not p1 or p3', () => {
    const sync = buildSyncPayload(
      { snapshot: makeFakeL2Snapshot(), l3Context: activeL3Context(), chatLog: [], cartridges: emptyCartridges() },
      'p2',
    );
    expect(sync.context.confessionPhase.myHandle).toBe('Confessor #1');
    expect(sync.context.confessionPhase.handlesByPlayer).toBeUndefined();
  });

  it('non-member receives myHandle: null', () => {
    const sync = buildSyncPayload(
      { snapshot: makeFakeL2Snapshot(), l3Context: activeL3Context(), chatLog: [], cartridges: emptyCartridges() },
      'pUnknown',
    );
    expect(sync.context.confessionPhase.myHandle).toBeNull();
    expect(sync.context.confessionPhase.handleCount).toBe(3);
  });

  it('posts pass through unchanged (already anonymized at record time)', () => {
    const sync = buildSyncPayload(
      { snapshot: makeFakeL2Snapshot(), l3Context: activeL3Context(), chatLog: [], cartridges: emptyCartridges() },
      'p1',
    );
    expect(sync.context.confessionPhase.posts).toEqual([
      { handle: 'Confessor #3', text: 'the truth is', ts: 1 },
    ]);
  });

  it('active=false with empty phase: myHandle null, handleCount 0, posts []', () => {
    const l3Context = {
      ...activeL3Context(),
      confessionPhase: { active: false, handlesByPlayer: {}, posts: [] },
    };
    const sync = buildSyncPayload(
      { snapshot: makeFakeL2Snapshot(), l3Context, chatLog: [], cartridges: emptyCartridges() },
      'p1',
    );
    expect(sync.context.confessionPhase).toEqual({
      active: false,
      myHandle: null,
      handleCount: 0,
      posts: [],
      closesAt: null,
    });
  });

  it('missing confessionPhase in L3 context defaults to inactive projection', () => {
    const l3Context = { channels: {}, cartridgeUpdatedAt: {} };
    const sync = buildSyncPayload(
      { snapshot: makeFakeL2Snapshot(), l3Context, chatLog: [], cartridges: emptyCartridges() },
      'p1',
    );
    expect(sync.context.confessionPhase).toEqual({
      active: false,
      myHandle: null,
      handleCount: 0,
      posts: [],
      closesAt: null,
    });
  });
});
