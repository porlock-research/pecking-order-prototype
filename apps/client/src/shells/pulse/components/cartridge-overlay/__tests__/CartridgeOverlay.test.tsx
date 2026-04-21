import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { CartridgeOverlay } from '../CartridgeOverlay';
import { useGameStore } from '../../../../../store/useGameStore';
import { PulseContext } from '../../../PulseShell';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockEngine = {
  sendVoteAction: vi.fn(),
  sendGameAction: vi.fn(),
  sendActivityAction: vi.fn(),
} as any;

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <PulseContext.Provider value={{
      engine: mockEngine,
      playerId: 'p1',
      openSendSilver: () => {},
      openNudge: () => {},
      openDM: () => {},
      openSocialPanel: () => {},
      openConfessionBooth: () => {},
      openDossier: () => {},
    }}>
      {children}
    </PulseContext.Provider>
  );
}

describe('CartridgeOverlay', () => {
  beforeEach(() => {
    useGameStore.setState({
      focusedCartridge: null,
      activeVotingCartridge: null,
      activeGameCartridge: null,
      activePromptCartridge: null,
      activeDilemma: null,
      completedCartridges: [],
      manifest: null,
      dayIndex: 1,
      playerId: 'p1',
      roster: {
        p1: { personaName: 'You', status: 'ALIVE', silver: 0 } as any,
        p2: { personaName: 'Brenda', status: 'ALIVE', silver: 0 } as any,
      },
    } as any);
  });

  it('renders nothing when focusedCartridge is null', () => {
    const { container } = render(<Wrap><CartridgeOverlay /></Wrap>);
    expect(container.firstChild).toBeNull();
  });

  it('renders info splash for upcoming pill', () => {
    useGameStore.setState({
      manifest: {
        scheduling: 'PRE_SCHEDULED',
        days: [{
          timeline: [{ action: 'OPEN_VOTING', time: new Date(Date.now() + 300_000).toISOString() }],
        }],
      } as any,
    });
    useGameStore.getState().focusCartridge('voting-1-UNKNOWN', 'voting', 'manual');
    render(<Wrap><CartridgeOverlay /></Wrap>);
    expect(screen.getByText(/Starts in/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Vote/i })).toBeInTheDocument();
  });

  it('renders playable panel for active voting pill', () => {
    useGameStore.setState({
      activeVotingCartridge: {
        phase: 'VOTING', mechanism: 'EXECUTIONER', voteType: 'EXECUTIONER',
        eligibleVoters: ['p1', 'p2'], votes: {},
      } as any,
    });
    useGameStore.getState().focusCartridge('voting-1-EXECUTIONER', 'voting', 'manual');
    render(<Wrap><CartridgeOverlay /></Wrap>);
    expect(screen.getByTestId('cartridge-panel-voting')).toBeInTheDocument();
  });

  it('renders result card for completed cartridge', () => {
    useGameStore.setState({
      completedCartridges: [{
        kind: 'voting',
        key: 'voting-1-EXECUTIONER',
        dayIndex: 1,
        completedAt: Date.now(),
        snapshot: { mechanism: 'EXECUTIONER', eliminatedPlayerId: 'p2' },
      }] as any,
    });
    useGameStore.getState().focusCartridge('voting-1-EXECUTIONER', 'voting', 'manual');
    render(<Wrap><CartridgeOverlay /></Wrap>);
    expect(screen.getByText(/Vote Resolved/i)).toBeInTheDocument();
    expect(screen.getByText(/Brenda/)).toBeInTheDocument();
  });

  it('unfocuses on missing cartridge id (no matching pill)', async () => {
    useGameStore.getState().focusCartridge('voting-999-GHOST', 'voting', 'push');
    render(<Wrap><CartridgeOverlay /></Wrap>);
    await act(() => Promise.resolve());
    expect(useGameStore.getState().focusedCartridge).toBeNull();
  });
});
