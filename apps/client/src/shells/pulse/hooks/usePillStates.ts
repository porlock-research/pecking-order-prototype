import { useMemo } from 'react';
import { useGameStore } from '../../../store/useGameStore';

export type PillLifecycle = 'upcoming' | 'starting' | 'just-started' | 'needs-action' | 'urgent' | 'in-progress' | 'completed';

export interface PillState {
  id: string;
  kind: 'voting' | 'game' | 'prompt' | 'dilemma';
  label: string;
  lifecycle: PillLifecycle;
  timeRemaining?: number;
  progress?: string;
  playerActed?: boolean;
  cartridgeData?: any;
}

export function usePillStates(): PillState[] {
  const voting = useGameStore(s => s.activeVotingCartridge);
  const game = useGameStore(s => s.activeGameCartridge);
  const prompt = useGameStore(s => s.activePromptCartridge);
  const dilemma = useGameStore(s => s.activeDilemma);
  const completed = useGameStore(s => s.completedCartridges);

  return useMemo(() => {
    const pills: PillState[] = [];

    if (voting) {
      const totalVoters = voting.eligibleVoters?.length ?? 0;
      const castCount = Object.keys(voting.votes || {}).length;
      pills.push({
        id: 'voting',
        kind: 'voting',
        label: voting.mechanism || 'Vote',
        lifecycle: voting.phase === 'REVEAL' || voting.phase === 'WINNER' ? 'completed'
          : castCount > 0 ? 'in-progress'
          : 'needs-action',
        progress: totalVoters > 0 ? `${castCount}/${totalVoters}` : undefined,
        playerActed: false, // Will be refined when we have playerId context
        cartridgeData: voting,
      });
    }

    if (game) {
      pills.push({
        id: 'game',
        kind: 'game',
        label: game.gameType || 'Game',
        lifecycle: game.phase === 'COMPLETED' ? 'completed'
          : game.phase === 'PLAYING' || game.phase === 'ACTIVE' ? 'in-progress'
          : 'just-started',
        cartridgeData: game,
      });
    }

    if (prompt) {
      pills.push({
        id: 'prompt',
        kind: 'prompt',
        label: prompt.promptType || 'Activity',
        lifecycle: prompt.phase === 'RESULTS' ? 'completed'
          : 'needs-action',
        cartridgeData: prompt,
      });
    }

    if (dilemma) {
      pills.push({
        id: 'dilemma',
        kind: 'dilemma',
        label: dilemma.dilemmaType || 'Dilemma',
        lifecycle: dilemma.phase === 'REVEAL' ? 'completed'
          : 'needs-action',
        cartridgeData: dilemma,
      });
    }

    // Add completed cartridges not already represented
    if (completed) {
      for (const c of completed) {
        const existingId = c.kind === 'voting' ? 'voting' : c.kind;
        if (!pills.some(p => p.id === existingId)) {
          pills.push({
            id: `completed-${c.kind}-${c.snapshot?.mechanism || c.snapshot?.gameType || ''}`,
            kind: c.kind,
            label: c.snapshot?.mechanism || c.snapshot?.gameType || c.kind,
            lifecycle: 'completed',
          });
        }
      }
    }

    return pills;
  }, [voting, game, prompt, dilemma, completed]);
}
