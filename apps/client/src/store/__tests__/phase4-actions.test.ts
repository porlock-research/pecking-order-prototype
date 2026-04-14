import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useGameStore } from '../useGameStore';

describe('Phase 4 mark actions', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({
      gameId: 'g1',
      playerId: 'p1',
      lastSeenCartridge: {},
      lastSeenSilverFrom: {},
      revealsSeen: { elimination: {}, winner: false },
      pendingIntent: null,
      pendingIntentAttempts: 0,
      pendingIntentFirstReceivedAt: null,
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1700000000000));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('markCartridgeSeen updates map and persists to localStorage', () => {
    useGameStore.getState().markCartridgeSeen('voting-3-MAJORITY');
    const { lastSeenCartridge } = useGameStore.getState();
    expect(lastSeenCartridge['voting-3-MAJORITY']).toBe(1700000000000);
    const stored = JSON.parse(localStorage.getItem('po-lastSeenCartridge-g1-p1')!);
    expect(stored['voting-3-MAJORITY']).toBe(1700000000000);
  });

  it('markSilverSeen updates map and persists', () => {
    useGameStore.getState().markSilverSeen('p3');
    expect(useGameStore.getState().lastSeenSilverFrom['p3']).toBe(1700000000000);
    const stored = JSON.parse(localStorage.getItem('po-lastSeenSilverFrom-g1-p1')!);
    expect(stored['p3']).toBe(1700000000000);
  });

  it('markRevealSeen(elimination, 3) persists dayIndex entry', () => {
    useGameStore.getState().markRevealSeen('elimination', 3);
    expect(useGameStore.getState().revealsSeen.elimination[3]).toBe(true);
    const stored = JSON.parse(localStorage.getItem('po-revealsSeen-g1-p1')!);
    expect(stored.elimination[3]).toBe(true);
    expect(stored.winner).toBe(false);
  });

  it('markRevealSeen(winner) sets the scalar', () => {
    useGameStore.getState().markRevealSeen('winner');
    expect(useGameStore.getState().revealsSeen.winner).toBe(true);
  });

  it('setPendingIntent records firstReceivedAt only on first set', () => {
    useGameStore.getState().setPendingIntent({ kind: 'dm', channelId: 'ch-1' });
    expect(useGameStore.getState().pendingIntentFirstReceivedAt).toBe(1700000000000);
    vi.setSystemTime(new Date(1700000005000));
    useGameStore.getState().setPendingIntent({ kind: 'dm', channelId: 'ch-1' });
    // firstReceivedAt should NOT change on subsequent sets (retention clock starts at first)
    expect(useGameStore.getState().pendingIntentFirstReceivedAt).toBe(1700000000000);
  });

  it('setPendingIntent(null) resets attempts and first-received', () => {
    useGameStore.getState().setPendingIntent({ kind: 'main' });
    useGameStore.getState().incrementIntentAttempts();
    useGameStore.getState().incrementIntentAttempts();
    useGameStore.getState().setPendingIntent(null);
    const s = useGameStore.getState();
    expect(s.pendingIntent).toBeNull();
    expect(s.pendingIntentAttempts).toBe(0);
    expect(s.pendingIntentFirstReceivedAt).toBeNull();
  });

  it('incrementIntentAttempts increments by 1', () => {
    expect(useGameStore.getState().pendingIntentAttempts).toBe(0);
    useGameStore.getState().incrementIntentAttempts();
    expect(useGameStore.getState().pendingIntentAttempts).toBe(1);
    useGameStore.getState().incrementIntentAttempts();
    expect(useGameStore.getState().pendingIntentAttempts).toBe(2);
  });

  it('mark* actions are no-ops when gameId or playerId missing', () => {
    useGameStore.setState({ gameId: null, playerId: null });
    useGameStore.getState().markCartridgeSeen('voting-3-MAJORITY');
    // map still updates (in-memory), but localStorage stays empty.
    expect(useGameStore.getState().lastSeenCartridge['voting-3-MAJORITY']).toBe(1700000000000);
    expect(localStorage.getItem('po-lastSeenCartridge-null-null')).toBeNull();
  });
});
