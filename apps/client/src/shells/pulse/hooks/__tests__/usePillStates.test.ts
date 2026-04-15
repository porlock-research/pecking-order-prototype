import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePillStates } from '../usePillStates';
import { useGameStore } from '../../../../store/useGameStore';

describe('usePillStates — ADR-128 gap detection', () => {
  beforeEach(() => {
    useGameStore.setState({
      activeVotingCartridge: null,
      activeGameCartridge: null,
      activePromptCartridge: null,
      activeDilemma: null,
      completedCartridges: [],
      manifest: null,
      dayIndex: 1,
    } as any);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-14T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits starting pill when timeline event has fired but slot is empty', () => {
    useGameStore.setState({
      manifest: {
        scheduling: 'PRE_SCHEDULED',
        days: [{
          timeline: [
            { action: 'OPEN_VOTING', time: '2026-04-14T11:59:00Z' },
          ],
        }],
      } as any,
    });
    const { result } = renderHook(() => usePillStates());
    expect(result.current).toHaveLength(1);
    expect(result.current[0].lifecycle).toBe('starting');
    expect(result.current[0].kind).toBe('voting');
  });

  it('emits upcoming pill when timeline event is still in the future', () => {
    useGameStore.setState({
      manifest: {
        scheduling: 'PRE_SCHEDULED',
        days: [{
          timeline: [
            { action: 'OPEN_VOTING', time: '2026-04-14T12:05:00Z' },
          ],
        }],
      } as any,
    });
    const { result } = renderHook(() => usePillStates());
    expect(result.current).toHaveLength(1);
    expect(result.current[0].lifecycle).toBe('upcoming');
  });

  it('suppresses starting when the active slot is populated', () => {
    useGameStore.setState({
      activeVotingCartridge: {
        phase: 'VOTING',
        voteType: 'EXECUTIONER',
        eligibleVoters: [],
        votes: {},
      } as any,
      manifest: {
        scheduling: 'PRE_SCHEDULED',
        days: [{
          timeline: [
            { action: 'OPEN_VOTING', time: '2026-04-14T11:59:00Z' },
          ],
        }],
      } as any,
    });
    const { result } = renderHook(() => usePillStates());
    const votingPills = result.current.filter(p => p.kind === 'voting');
    expect(votingPills).toHaveLength(1);
    expect(votingPills[0].lifecycle).not.toBe('starting');
  });
});
