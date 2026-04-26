import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useGameStore } from '../../../../store/useGameStore';
import { PulseBar } from '../PulseBar';

beforeEach(() => {
  useGameStore.setState({
    gameId: 'g1',
    playerId: 'p1',
    activeVotingCartridge: {
      cartridgeId: 'voting-3-MAJORITY',
      updatedAt: 5000,
      mechanism: 'MAJORITY',
      votes: {},
      eligibleVoters: ['p1', 'p2'],
      phase: 'VOTING',
    } as any,
    activeGameCartridge: null,
    activePromptCartridge: null,
    activeDilemma: null,
    completedCartridges: [],
    lastSeenCartridge: {},
    manifest: null,
    dayIndex: 3,
    focusedCartridge: null,
  } as any);
});

describe('PulseBar — unread dot', () => {
  it('renders an unread dot on a pill with no lastSeen entry', () => {
    render(<PulseBar />);
    expect(screen.getByTestId('pill-unread-voting-3-MAJORITY')).toBeInTheDocument();
  });

  it('marks the cartridge seen and focuses it when the pill is tapped', () => {
    const { container } = render(<PulseBar />);
    // Multiple pill buttons may render now (cartridges + boundary anchor).
    // Target the voting pill specifically via the data attribute the
    // component sets.
    const votingPill = container.querySelector(
      '[data-pill-cartridge-id="voting-3-MAJORITY"]',
    ) as HTMLButtonElement;
    expect(votingPill).not.toBeNull();
    fireEvent.click(votingPill);
    const state = useGameStore.getState();
    expect(state.lastSeenCartridge['voting-3-MAJORITY']).toBeDefined();
    expect(state.focusedCartridge).toEqual({
      cartridgeId: 'voting-3-MAJORITY',
      cartridgeKind: 'voting',
      origin: 'manual',
    });
  });

  it('does not render unread dot once the cartridge is marked seen', () => {
    useGameStore.setState({ lastSeenCartridge: { 'voting-3-MAJORITY': 10_000 } } as any);
    render(<PulseBar />);
    expect(screen.queryByTestId('pill-unread-voting-3-MAJORITY')).not.toBeInTheDocument();
  });
});
