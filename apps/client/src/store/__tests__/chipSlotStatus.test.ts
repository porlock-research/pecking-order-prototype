import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, selectChipSlotStatus } from '../useGameStore';

describe('selectChipSlotStatus', () => {
  beforeEach(() => {
    useGameStore.setState({
      roster: {
        p1: { id: 'p1', personaName: 'Me', status: 'ALIVE' } as any,
        p2: { id: 'p2', personaName: 'Alice', status: 'ALIVE' } as any,
        p3: { id: 'p3', personaName: 'Bob', status: 'ALIVE' } as any,
        p4: { id: 'p4', personaName: 'Carol', status: 'DEAD' } as any,
      },
      playerId: 'p1',
      channels: {},
      dmStats: { charsUsed: 0, charsLimit: 1000, partnersUsed: 0, partnersLimit: 5, groupsUsed: 0, groupsLimit: 3, slotsUsed: 5 },
      manifest: { days: [{ dmSlotsPerPlayer: 5 }] },
      dayIndex: 1,
    } as any);
  });

  it("returns 'blocked' when remaining === 0 and no existing DM with target", () => {
    expect(selectChipSlotStatus(useGameStore.getState(), 'p2')).toBe('blocked');
  });

  it("returns 'ok' when an existing DM channel with target exists", () => {
    useGameStore.setState({
      channels: {
        'dm_p1_p2': { id: 'dm_p1_p2', type: 'DM', memberIds: ['p1', 'p2'], createdBy: 'p1', createdAt: 0 },
      } as any,
    });
    expect(selectChipSlotStatus(useGameStore.getState(), 'p2')).toBe('ok');
  });

  it("returns 'ok' when slots remain", () => {
    useGameStore.setState({
      dmStats: { charsUsed: 0, charsLimit: 1000, partnersUsed: 0, partnersLimit: 5, groupsUsed: 0, groupsLimit: 3, slotsUsed: 2 } as any,
    });
    expect(selectChipSlotStatus(useGameStore.getState(), 'p3')).toBe('ok');
  });

  it("returns 'ok' for self and dead targets (never blocks)", () => {
    expect(selectChipSlotStatus(useGameStore.getState(), 'p1')).toBe('ok');
    expect(selectChipSlotStatus(useGameStore.getState(), 'p4')).toBe('ok');
  });
});
