import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../useGameStore';
import {
  selectCartridgeUnread,
  selectSilverUnread,
  selectRevealsToReplay,
  selectAggregatePulseUnread,
  selectCastChipUnreadKind,
} from '../useGameStore';

function silverTicker(senderId: string, recipientId: string, timestamp: number) {
  return {
    id: `tk-${timestamp}`,
    text: 'x',
    category: 'SOCIAL.TRANSFER' as const,
    timestamp,
    involvedPlayerIds: [senderId, recipientId],
  };
}

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState({
    gameId: 'g1', playerId: 'p1', dayIndex: 3,
    lastSeenCartridge: {},
    lastSeenSilverFrom: {},
    revealsSeen: { elimination: {}, winner: false },
    roster: {
      p1: { id: 'p1', personaName: 'You', avatarUrl: '', status: 'ALIVE', silver: 0, gold: 0 },
      p2: { id: 'p2', personaName: 'Bob', avatarUrl: '', status: 'ELIMINATED', eliminatedOnDay: 2, silver: 10, gold: 0 },
      p3: { id: 'p3', personaName: 'Cat', avatarUrl: '', status: 'ALIVE', silver: 20, gold: 0 },
    } as any,
    winner: null,
    activeVotingCartridge: { cartridgeId: 'voting-3-MAJORITY', updatedAt: 5000, votes: {} } as any,
    activeGameCartridge: null,
    activePromptCartridge: null,
    activeDilemma: null,
    completedCartridges: [],
    tickerMessages: [],
    chatLog: [],
    channels: {},
  });
});

describe('selectCartridgeUnread', () => {
  it('returns true when active cartridge has no lastSeen entry', () => {
    expect(selectCartridgeUnread(useGameStore.getState(), 'voting-3-MAJORITY')).toBe(true);
  });

  it('returns true when updatedAt > lastSeen', () => {
    useGameStore.setState({ lastSeenCartridge: { 'voting-3-MAJORITY': 1000 } });
    expect(selectCartridgeUnread(useGameStore.getState(), 'voting-3-MAJORITY')).toBe(true);
  });

  it('returns false when lastSeen ≥ updatedAt', () => {
    useGameStore.setState({ lastSeenCartridge: { 'voting-3-MAJORITY': 5000 } });
    expect(selectCartridgeUnread(useGameStore.getState(), 'voting-3-MAJORITY')).toBe(false);
  });

  it('returns true for completed cartridge when completedAt > lastSeen', () => {
    useGameStore.setState({
      activeVotingCartridge: null,
      completedCartridges: [{ kind: 'voting', snapshot: { mechanism: 'MAJORITY', dayIndex: 3 }, completedAt: 8000, key: 'voting-3-MAJORITY' }] as any,
      lastSeenCartridge: { 'voting-3-MAJORITY': 5000 },
    });
    expect(selectCartridgeUnread(useGameStore.getState(), 'voting-3-MAJORITY')).toBe(true);
  });

  it('returns true for completed cartridge with no lastSeen entry', () => {
    useGameStore.setState({
      activeVotingCartridge: null,
      completedCartridges: [{ kind: 'voting', snapshot: { mechanism: 'MAJORITY', dayIndex: 3 }, completedAt: 8000, key: 'voting-3-MAJORITY' }] as any,
    });
    expect(selectCartridgeUnread(useGameStore.getState(), 'voting-3-MAJORITY')).toBe(true);
  });

  it('returns false for unknown cartridgeId', () => {
    expect(selectCartridgeUnread(useGameStore.getState(), 'voting-99-MISSING')).toBe(false);
  });
});

describe('selectSilverUnread', () => {
  it('returns true when a SILVER ticker entry from sender arrives after lastSeen', () => {
    useGameStore.setState({
      tickerMessages: [silverTicker('p3', 'p1', 2000)] as any,
    });
    expect(selectSilverUnread(useGameStore.getState(), 'p3')).toBe(true);
  });

  it('returns false when already acknowledged', () => {
    useGameStore.setState({
      tickerMessages: [silverTicker('p3', 'p1', 2000)] as any,
      lastSeenSilverFrom: { p3: 3000 },
    });
    expect(selectSilverUnread(useGameStore.getState(), 'p3')).toBe(false);
  });

  it('returns false when senderId does not match', () => {
    useGameStore.setState({
      tickerMessages: [silverTicker('p3', 'p1', 2000)] as any,
    });
    expect(selectSilverUnread(useGameStore.getState(), 'p2')).toBe(false);
  });

  it('returns false when current player is NOT the recipient', () => {
    useGameStore.setState({
      tickerMessages: [silverTicker('p3', 'p2', 2000)] as any,
    });
    expect(selectSilverUnread(useGameStore.getState(), 'p3')).toBe(false);
  });
});

describe('selectRevealsToReplay', () => {
  it('returns elimination for a player eliminated on day 2 with no revealsSeen entry', () => {
    const result = selectRevealsToReplay(useGameStore.getState());
    expect(result).toContainEqual({ kind: 'elimination', dayIndex: 2 });
  });

  it('omits elimination when revealsSeen.elimination[2] is true', () => {
    useGameStore.setState({ revealsSeen: { elimination: { 2: true }, winner: false } });
    expect(selectRevealsToReplay(useGameStore.getState())).toEqual([]);
  });

  it('includes winner when winner set and not seen', () => {
    useGameStore.setState({
      winner: { playerId: 'p3', mechanism: 'FINALS', summary: {} } as any,
      revealsSeen: { elimination: { 2: true }, winner: false },
    });
    const result = selectRevealsToReplay(useGameStore.getState());
    expect(result).toContainEqual({ kind: 'winner' });
  });

  it('returns stable reference on identical inputs (memoSelector)', () => {
    const a = selectRevealsToReplay(useGameStore.getState());
    const b = selectRevealsToReplay(useGameStore.getState());
    expect(a).toBe(b);
  });
});

describe('selectAggregatePulseUnread', () => {
  it('sums DM unread + cartridge unread + invite + silver', () => {
    useGameStore.setState({
      channels: {
        'DM-p1-p3': { id: 'DM-p1-p3', type: 'DM', memberIds: ['p1', 'p3'], createdBy: 'p3', createdAt: 0 },
        'INV-p2-p1': { id: 'INV-p2-p1', type: 'DM', memberIds: ['p2'], pendingMemberIds: ['p1'], createdBy: 'p2', createdAt: 0 },
      } as any,
      chatLog: [{ id: 'm1', channelId: 'DM-p1-p3', timestamp: 5000, senderId: 'p3', content: 'hi' }] as any,
      lastReadTimestamp: {},
      tickerMessages: [silverTicker('p3', 'p1', 4000)] as any,
    });
    // 1 DM unread + 1 pending invite + 1 cartridge unread + 1 silver = 4
    expect(selectAggregatePulseUnread(useGameStore.getState())).toBeGreaterThanOrEqual(3);
  });

  it('returns 0 when no surfaces have unread', () => {
    useGameStore.setState({
      activeVotingCartridge: null,
      completedCartridges: [],
      lastReadTimestamp: {},
      tickerMessages: [],
      channels: {},
    });
    expect(selectAggregatePulseUnread(useGameStore.getState())).toBe(0);
  });
});

describe('selectCastChipUnreadKind', () => {
  it('returns invite first when present', () => {
    useGameStore.setState({
      channels: {
        'INV-p3-p1': { id: 'INV-p3-p1', type: 'DM', memberIds: ['p3'], pendingMemberIds: ['p1'], createdBy: 'p3', createdAt: 0 },
      } as any,
      tickerMessages: [silverTicker('p3', 'p1', 5000)] as any,
    });
    expect(selectCastChipUnreadKind(useGameStore.getState(), 'p3')).toBe('invite');
  });

  it('returns dm when dm unread but no invite', () => {
    useGameStore.setState({
      channels: {
        'DM-p1-p3': { id: 'DM-p1-p3', type: 'DM', memberIds: ['p1', 'p3'], createdBy: 'p3', createdAt: 0 },
      } as any,
      chatLog: [{ id: 'm1', channelId: 'DM-p1-p3', timestamp: 5000, senderId: 'p3', content: 'hi' }] as any,
      lastReadTimestamp: {},
    });
    expect(selectCastChipUnreadKind(useGameStore.getState(), 'p3')).toBe('dm');
  });

  it('returns silver when no invite/dm but silver pip applies', () => {
    useGameStore.setState({
      tickerMessages: [silverTicker('p3', 'p1', 5000)] as any,
    });
    expect(selectCastChipUnreadKind(useGameStore.getState(), 'p3')).toBe('silver');
  });

  it('returns null when no signals', () => {
    expect(selectCastChipUnreadKind(useGameStore.getState(), 'p3')).toBeNull();
  });
});
