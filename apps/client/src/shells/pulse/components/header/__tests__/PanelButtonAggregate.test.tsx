import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useGameStore } from '../../../../../store/useGameStore';
import { PanelButton } from '../PanelButton';

beforeEach(() => {
  useGameStore.setState({
    gameId: 'g1',
    playerId: 'p1',
    pendingDmInvites: [],
    activeVotingCartridge: null,
    activeGameCartridge: null,
    activePromptCartridge: null,
    activeDilemma: null,
    completedCartridges: [],
    lastSeenCartridge: {},
    tickerMessages: [],
    lastSeenSilverFrom: {},
    channels: {},
    chatLog: [],
    lastReadTimestamp: {},
    roster: {},
    revealsSeen: { elimination: {}, winner: false },
  } as any);
});

describe('PanelButton — aggregate pip', () => {
  it('renders the aggregate unread count', () => {
    useGameStore.setState({
      activeVotingCartridge: { cartridgeId: 'voting-1-MAJORITY', updatedAt: 1 } as any,
      channels: { 'DM-p1-p2': { id: 'DM-p1-p2', type: 'DM', memberIds: ['p1', 'p2'] } } as any,
      chatLog: [{ id: 'm1', channelId: 'DM-p1-p2', senderId: 'p2', timestamp: 100 }] as any,
    });
    render(<PanelButton onClick={() => {}} />);
    expect(screen.getByTestId('panel-unread-pip').textContent).toBe('2');
  });

  it('collapses to 9+ for large totals', () => {
    const channels: any = {};
    const chatLog: any[] = [];
    for (let i = 0; i < 12; i++) {
      const chId = `DM-p1-p${i + 2}`;
      channels[chId] = { id: chId, type: 'DM', memberIds: ['p1', `p${i + 2}`] };
      chatLog.push({ id: `m${i}`, channelId: chId, senderId: `p${i + 2}`, timestamp: 100 });
    }
    useGameStore.setState({ channels, chatLog });
    render(<PanelButton onClick={() => {}} />);
    expect(screen.getByTestId('panel-unread-pip').textContent).toBe('9+');
  });

  it('hides pip when count is 0', () => {
    render(<PanelButton onClick={() => {}} />);
    expect(screen.queryByTestId('panel-unread-pip')).not.toBeInTheDocument();
  });
});
