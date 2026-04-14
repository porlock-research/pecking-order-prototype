import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, selectGroupDmTitle, selectCanAddMemberTo } from '../useGameStore';

describe('selectGroupDmTitle', () => {
  beforeEach(() => {
    useGameStore.setState({
      playerId: 'p1',
      roster: {
        p1: { id: 'p1', personaName: 'Me Myself', status: 'ALIVE' } as any,
        p2: { id: 'p2', personaName: 'Alice Jones', status: 'ALIVE' } as any,
        p3: { id: 'p3', personaName: 'Bob Smith', status: 'ALIVE' } as any,
        p4: { id: 'p4', personaName: 'Carol Diaz', status: 'ALIVE' } as any,
        p5: { id: 'p5', personaName: 'Dan Evans', status: 'ALIVE' } as any,
        p6: { id: 'p6', personaName: 'Eve Frost', status: 'ALIVE' } as any,
      },
      channels: {
        c2: { id: 'c2', type: 'DM', memberIds: ['p1', 'p2'], createdBy: 'p1', createdAt: 0 },
        c3: { id: 'c3', type: 'GROUP_DM', memberIds: ['p1', 'p2', 'p3'], createdBy: 'p1', createdAt: 0 },
        c4: { id: 'c4', type: 'GROUP_DM', memberIds: ['p1', 'p2', 'p3', 'p4'], createdBy: 'p1', createdAt: 0 },
        c6: { id: 'c6', type: 'GROUP_DM', memberIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], createdBy: 'p1', createdAt: 0 },
      } as any,
    } as any);
  });

  it('2-member fallback: "Alice"', () => {
    expect(selectGroupDmTitle(useGameStore.getState(), 'c2')).toBe('Alice');
  });

  it('3-member group: "Alice, Bob"', () => {
    expect(selectGroupDmTitle(useGameStore.getState(), 'c3')).toBe('Alice, Bob');
  });

  it('4-member group: "Alice, Bob, Carol"', () => {
    expect(selectGroupDmTitle(useGameStore.getState(), 'c4')).toBe('Alice, Bob, Carol');
  });

  it('6-member group: "Alice, Bob +3"', () => {
    expect(selectGroupDmTitle(useGameStore.getState(), 'c6')).toBe('Alice, Bob +3');
  });

  it('returns empty string for unknown channel', () => {
    expect(selectGroupDmTitle(useGameStore.getState(), 'nope')).toBe('');
  });
});

describe('selectCanAddMemberTo', () => {
  beforeEach(() => {
    useGameStore.setState({
      playerId: 'p1',
      channels: {
        mine: { id: 'mine', type: 'DM', memberIds: ['p1', 'p2'], createdBy: 'p1', createdAt: 0, capabilities: ['CHAT', 'INVITE_MEMBER'] },
        theirs: { id: 'theirs', type: 'DM', memberIds: ['p1', 'p2'], createdBy: 'p2', createdAt: 0, capabilities: ['CHAT', 'INVITE_MEMBER'] },
        noCap: { id: 'noCap', type: 'DM', memberIds: ['p1', 'p2'], createdBy: 'p1', createdAt: 0, capabilities: ['CHAT'] },
      } as any,
    } as any);
  });

  it('true when creator and INVITE_MEMBER capability', () => {
    expect(selectCanAddMemberTo(useGameStore.getState(), 'mine')).toBe(true);
  });

  it('false when not creator', () => {
    expect(selectCanAddMemberTo(useGameStore.getState(), 'theirs')).toBe(false);
  });

  it('false when INVITE_MEMBER capability missing', () => {
    expect(selectCanAddMemberTo(useGameStore.getState(), 'noCap')).toBe(false);
  });

  it('false for unknown channel', () => {
    expect(selectCanAddMemberTo(useGameStore.getState(), 'nope')).toBe(false);
  });
});
