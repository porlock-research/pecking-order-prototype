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

describe('usePillStates — multi-day completion handling', () => {
  beforeEach(() => {
    useGameStore.setState({
      playerId: 'p1',
      activeVotingCartridge: null,
      activeGameCartridge: null,
      activePromptCartridge: null,
      activeDilemma: null,
      completedCartridges: [],
      manifest: null,
      dayIndex: 2,
    } as any);
  });

  it('does not misclassify Day 2 active game when Day 1 game is in completedCartridges', () => {
    useGameStore.setState({
      activeGameCartridge: {
        gameType: 'SEQUENCE',
        players: { p1: { status: 'NOT_STARTED' } },
      } as any,
      completedCartridges: [{
        kind: 'game',
        key: 'game-1-TRIVIA',
        dayIndex: 1,
        completedAt: 1,
        snapshot: { gameType: 'TRIVIA' },
      }] as any,
    });
    const { result } = renderHook(() => usePillStates());
    const gamePills = result.current.filter(p => p.kind === 'game');
    expect(gamePills).toHaveLength(1);
    expect(gamePills[0].id).toBe('game-2-SEQUENCE');
    expect(gamePills[0].lifecycle).not.toBe('completed');
  });

  it('does not bleed Day 1 completed pills into Day 2', () => {
    useGameStore.setState({
      completedCartridges: [{
        kind: 'voting',
        key: 'voting-1-BUBBLE',
        dayIndex: 1,
        completedAt: 1,
        snapshot: { mechanism: 'BUBBLE' },
      }, {
        kind: 'prompt',
        key: 'prompt-1-HOT_TAKE',
        dayIndex: 1,
        completedAt: 2,
        snapshot: { promptType: 'HOT_TAKE' },
      }] as any,
    });
    const { result } = renderHook(() => usePillStates());
    expect(result.current).toHaveLength(0);
  });

  it('renders todays completed cartridge as a pill when no active slot represents it', () => {
    useGameStore.setState({
      completedCartridges: [{
        kind: 'voting',
        key: 'voting-2-MAJORITY',
        dayIndex: 2,
        completedAt: 1,
        snapshot: { mechanism: 'MAJORITY' },
      }] as any,
    });
    const { result } = renderHook(() => usePillStates());
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('voting-2-MAJORITY');
    expect(result.current[0].lifecycle).toBe('completed');
  });
});

describe('usePillStates — per-player needs-action', () => {
  beforeEach(() => {
    useGameStore.setState({
      playerId: 'p1',
      activeVotingCartridge: null,
      activeGameCartridge: null,
      activePromptCartridge: null,
      activeDilemma: null,
      completedCartridges: [],
      manifest: null,
      dayIndex: 1,
    } as any);
  });

  it('voting pill stays needs-action for players who havent voted even if others have', () => {
    useGameStore.setState({
      activeVotingCartridge: {
        phase: 'VOTING',
        voteType: 'MAJORITY',
        eligibleVoters: ['p1', 'p2', 'p3'],
        votes: { p2: 'p3' },
      } as any,
    });
    const { result } = renderHook(() => usePillStates());
    expect(result.current[0].kind).toBe('voting');
    expect(result.current[0].lifecycle).toBe('needs-action');
    expect(result.current[0].playerActed).toBe(false);
  });

  it('voting pill flips to in-progress once the viewing player casts', () => {
    useGameStore.setState({
      activeVotingCartridge: {
        phase: 'VOTING',
        voteType: 'MAJORITY',
        eligibleVoters: ['p1', 'p2', 'p3'],
        votes: { p1: 'p3' },
      } as any,
    });
    const { result } = renderHook(() => usePillStates());
    expect(result.current[0].lifecycle).toBe('in-progress');
    expect(result.current[0].playerActed).toBe(true);
  });
});
