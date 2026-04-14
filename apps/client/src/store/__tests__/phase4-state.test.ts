import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../useGameStore';

describe('useGameStore — Phase 4 state fields', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({
      gameId: null,
      playerId: null,
      lastSeenCartridge: {},
      lastSeenSilverFrom: {},
      revealsSeen: { elimination: {}, winner: false },
      pendingIntent: null,
      pendingIntentAttempts: 0,
      pendingIntentFirstReceivedAt: null,
    });
  });

  it('initializes empty maps and null intent', () => {
    const s = useGameStore.getState();
    expect(s.lastSeenCartridge).toEqual({});
    expect(s.lastSeenSilverFrom).toEqual({});
    expect(s.revealsSeen).toEqual({ elimination: {}, winner: false });
    expect(s.pendingIntent).toBeNull();
    expect(s.pendingIntentAttempts).toBe(0);
    expect(s.pendingIntentFirstReceivedAt).toBeNull();
  });

  it('hydratePhase4FromStorage loads all three maps under (gameId, playerId) scope', () => {
    localStorage.setItem('po-lastSeenCartridge-game1-p1', JSON.stringify({ 'voting-3-MAJORITY': 1700000000000 }));
    localStorage.setItem('po-lastSeenSilverFrom-game1-p1', JSON.stringify({ 'p3': 1700000000500 }));
    localStorage.setItem('po-revealsSeen-game1-p1', JSON.stringify({ elimination: { 2: true }, winner: false }));
    useGameStore.setState({ gameId: 'game1', playerId: 'p1' });
    useGameStore.getState().hydratePhase4FromStorage();
    const s = useGameStore.getState();
    expect(s.lastSeenCartridge['voting-3-MAJORITY']).toBe(1700000000000);
    expect(s.lastSeenSilverFrom['p3']).toBe(1700000000500);
    expect(s.revealsSeen.elimination[2]).toBe(true);
  });

  it('hydratePhase4FromStorage is a no-op when gameId or playerId missing', () => {
    localStorage.setItem('po-lastSeenCartridge-game1-p1', JSON.stringify({ 'voting-3-MAJORITY': 1700000000000 }));
    useGameStore.setState({ gameId: null, playerId: null });
    useGameStore.getState().hydratePhase4FromStorage();
    expect(useGameStore.getState().lastSeenCartridge).toEqual({});
  });

  it('hydratePhase4FromStorage survives malformed localStorage gracefully', () => {
    localStorage.setItem('po-lastSeenCartridge-game1-p1', '{not-json');
    useGameStore.setState({ gameId: 'game1', playerId: 'p1' });
    expect(() => useGameStore.getState().hydratePhase4FromStorage()).not.toThrow();
    expect(useGameStore.getState().lastSeenCartridge).toEqual({});
  });
});
