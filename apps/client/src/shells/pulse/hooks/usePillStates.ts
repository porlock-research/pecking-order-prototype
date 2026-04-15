import { useMemo } from 'react';
import { CARTRIDGE_INFO } from '@pecking-order/shared-types';
import { useGameStore } from '../../../store/useGameStore';

function prettyLabel(typeKey: string | undefined, fallback: string): string {
  if (!typeKey) return fallback;
  return CARTRIDGE_INFO[typeKey]?.displayName ?? fallback;
}

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

const ACTION_TO_KIND: Record<string, PillState['kind']> = {
  OPEN_VOTING: 'voting',
  START_GAME: 'game',
  START_ACTIVITY: 'prompt',
  INJECT_PROMPT: 'prompt',
  START_DILEMMA: 'dilemma',
};

const ACTION_LABELS: Record<string, string> = {
  OPEN_VOTING: 'Vote',
  START_GAME: 'Game',
  START_ACTIVITY: 'Activity',
  INJECT_PROMPT: 'Prompt',
  START_DILEMMA: 'Dilemma',
};

export function usePillStates(): PillState[] {
  const voting = useGameStore(s => s.activeVotingCartridge);
  const game = useGameStore(s => s.activeGameCartridge);
  const prompt = useGameStore(s => s.activePromptCartridge);
  const dilemma = useGameStore(s => s.activeDilemma);
  const completed = useGameStore(s => s.completedCartridges);
  const manifest = useGameStore(s => s.manifest);
  const dayIndex = useGameStore(s => s.dayIndex);

  return useMemo(() => {
    const pills: PillState[] = [];

    if (voting) {
      const totalVoters = voting.eligibleVoters?.length ?? 0;
      const castCount = Object.keys(voting.votes || {}).length;
      pills.push({
        id: 'voting',
        kind: 'voting',
        label: prettyLabel(voting.mechanism || voting.voteType, 'Vote'),
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
        label: prettyLabel(game.gameType, 'Game'),
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
        label: prettyLabel(prompt.promptType, 'Activity'),
        lifecycle: prompt.phase === 'RESULTS' ? 'completed'
          : 'needs-action',
        cartridgeData: prompt,
      });
    }

    if (dilemma) {
      pills.push({
        id: 'dilemma',
        kind: 'dilemma',
        label: prettyLabel(dilemma.dilemmaType, 'Dilemma'),
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
          const typeKey = c.snapshot?.mechanism || c.snapshot?.gameType || c.snapshot?.promptType || c.snapshot?.dilemmaType || '';
          pills.push({
            id: `completed-${c.kind}-${typeKey}`,
            kind: c.kind,
            label: prettyLabel(typeKey, c.kind),
            lifecycle: 'completed',
          });
        }
      }
    }

    // Timeline-driven pills from current day (PRE_SCHEDULED only — ADMIN events have no fixed times).
    // Emits 'upcoming' for future events; 'starting' for past-due events whose active slot
    // hasn't populated yet (ADR-128 SYNC gap).
    const day = manifest?.days?.[dayIndex - 1] ?? manifest?.days?.[dayIndex];
    if (day?.timeline && manifest?.scheduling === 'PRE_SCHEDULED') {
      const now = Date.now();
      for (const ev of day.timeline as any[]) {
        const kind = ACTION_TO_KIND[ev.action];
        if (!kind) continue;
        let eventTime: number | null = null;
        if (ev.time?.includes('T')) {
          eventTime = new Date(ev.time).getTime();
        }
        if (eventTime === null) continue;

        // Skip if an active pill of this kind already exists.
        const alreadyActiveOfKind = pills.some(
          p => p.kind === kind && p.lifecycle !== 'completed' && p.lifecycle !== 'upcoming',
        );
        if (alreadyActiveOfKind) continue;

        if (eventTime > now) {
          pills.push({
            id: `upcoming-${ev.action}-${ev.time}`,
            kind,
            label: ACTION_LABELS[ev.action] || kind,
            lifecycle: 'upcoming',
            timeRemaining: Math.floor((eventTime - now) / 1000),
          });
        } else {
          // Past-due event with no active slot populated yet — ADR-128 SYNC gap.
          // Emit a 'starting' pill so the overlay can render the info splash with
          // "Starting now…" microcopy; it auto-swaps to the playable view when
          // the active slot arrives on the next SYNC.
          pills.push({
            id: `starting-${ev.action}-${ev.time}`,
            kind,
            label: ACTION_LABELS[ev.action] || kind,
            lifecycle: 'starting',
          });
        }
      }
    }

    return pills;
  }, [voting, game, prompt, dilemma, completed, manifest, dayIndex]);
}
