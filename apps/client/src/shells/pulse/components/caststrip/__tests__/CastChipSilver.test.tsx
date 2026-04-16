import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useGameStore } from '../../../../../store/useGameStore';
import { CastChip } from '../CastChip';

beforeEach(() => {
  useGameStore.setState({
    gameId: 'g1',
    playerId: 'p1',
    roster: {
      p1: { personaName: 'You', status: 'ALIVE', silver: 10, avatarUrl: '' } as any,
      p3: { personaName: 'Cat', status: 'ALIVE', silver: 20, avatarUrl: '' } as any,
    },
    tickerMessages: [{
      category: 'SOCIAL.TRANSFER',
      timestamp: 5000,
      involvedPlayerIds: ['p3', 'p1'],
      payload: { senderId: 'p3', recipientId: 'p1', amount: 5 },
    }] as any,
    lastSeenSilverFrom: {},
    channels: {},
    chatLog: [],
    onlinePlayers: ['p1', 'p3'],
    typingPlayers: {},
    lastReadTimestamp: {},
    lastSeenNudgeFrom: {},
    pendingDmInvites: [],
  } as any);
});

function makeEntry(overrides: Partial<Parameters<typeof CastChip>[0]['entry']> = {}) {
  return {
    kind: 'player' as const,
    id: 'p3',
    player: useGameStore.getState().roster.p3,
    priority: 5,
    unreadCount: 0,
    hasPendingInviteFromThem: false,
    hasOutgoingPendingInvite: false,
    isTypingToYou: false,
    isOnline: true,
    isLeader: false,
    lastNudgeFromThemTs: 0,
    hasUnseenNudgeFromThem: false,
    hasUnseenSilver: true,
    ...overrides,
  };
}

describe('CastChip — silver pip', () => {
  it('shows a gold pip when hasUnseenSilver is true', () => {
    render(<CastChip entry={makeEntry()} onTap={() => {}} pickingMode={false} picked={false} pickable={true} />);
    expect(screen.getByTestId('chip-silver-pip-p3')).toBeInTheDocument();
  });

  it('clears silver pip when chip is tapped', () => {
    const onTap = vi.fn();
    render(<CastChip entry={makeEntry()} onTap={onTap} pickingMode={false} picked={false} pickable={true} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onTap).toHaveBeenCalled();
    expect(useGameStore.getState().lastSeenSilverFrom['p3']).toBeDefined();
  });

  it('hides silver pip when invite badge is present', () => {
    render(<CastChip entry={makeEntry({ hasPendingInviteFromThem: true })} onTap={() => {}} pickingMode={false} picked={false} pickable={true} />);
    expect(screen.queryByTestId('chip-silver-pip-p3')).not.toBeInTheDocument();
  });
});
