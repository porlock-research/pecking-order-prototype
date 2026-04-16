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
  START_DILEMMA: 'dilemma',
};

const ACTION_LABELS: Record<string, string> = {
  OPEN_VOTING: 'Vote',
  START_GAME: 'Game',
  START_ACTIVITY: 'Activity',
  START_DILEMMA: 'Dilemma',
};

/** Pull the day-level type field for a given action kind from the manifest day. */
function dayTypeKeyFor(kind: PillState['kind'], day: any): string | undefined {
  switch (kind) {
    case 'voting': return day?.voteType && day.voteType !== 'NONE' ? day.voteType : undefined;
    case 'game': return day?.gameType && day.gameType !== 'NONE' ? day.gameType : undefined;
    case 'prompt': return day?.activityType && day.activityType !== 'NONE' ? day.activityType : undefined;
    case 'dilemma': return day?.dilemmaType && day.dilemmaType !== 'NONE' ? day.dilemmaType : undefined;
  }
}

/** Build a minimal cartridgeData object for upcoming/starting pills so the
 *  overlay's info splash can render the specific CARTRIDGE_INFO entry. */
function upcomingCartridgeData(kind: PillState['kind'], typeKey: string | undefined): any {
  if (!typeKey) return undefined;
  switch (kind) {
    case 'voting': return { voteType: typeKey };
    case 'game': return { gameType: typeKey };
    case 'prompt': return { promptType: typeKey };
    case 'dilemma': return { dilemmaType: typeKey };
  }
}

/** Build the cartridgeId `${kind}-${dayIndex}-${typeKey}` scheme. */
function cartridgeIdFor(kind: PillState['kind'], dayIndex: number, typeKey: string | undefined): string {
  return `${kind}-${dayIndex}-${typeKey || 'UNKNOWN'}`;
}

function votingTypeKey(c: any): string | undefined {
  return c?.mechanism || c?.voteType;
}
function gameTypeKey(c: any): string | undefined {
  return c?.gameType;
}
function promptTypeKey(c: any): string | undefined {
  return c?.promptType;
}
function dilemmaTypeKey(c: any): string | undefined {
  return c?.dilemmaType;
}

export function usePillStates(): PillState[] {
  const voting = useGameStore(s => s.activeVotingCartridge);
  const game = useGameStore(s => s.activeGameCartridge);
  const prompt = useGameStore(s => s.activePromptCartridge);
  const dilemma = useGameStore(s => s.activeDilemma);
  const completed = useGameStore(s => s.completedCartridges);
  const manifest = useGameStore(s => s.manifest);
  const dayIndex = useGameStore(s => s.dayIndex);
  const playerId = useGameStore(s => s.playerId);

  return useMemo(() => {
    const pills: PillState[] = [];
    // Only today's completed cartridges are relevant to the pill bar.
    // completedCartridges accumulates across the whole game; without this filter
    // Day 1's pills would bleed into Day 2+.
    const todayCompleted = (completed ?? []).filter(c => c.dayIndex === dayIndex);
    const todayCompletedIds = new Set(todayCompleted.map(c => c.key));

    // Active voting
    if (voting) {
      const typeKey = votingTypeKey(voting);
      const cartridgeId = cartridgeIdFor('voting', dayIndex, typeKey);
      const totalVoters = voting.eligibleVoters?.length ?? 0;
      const castCount = Object.keys(voting.votes || {}).length;
      const playerActed = playerId ? Boolean(voting.votes?.[playerId]) : false;
      const thisCompleted = todayCompletedIds.has(cartridgeId);
      pills.push({
        id: cartridgeId,
        kind: 'voting',
        label: prettyLabel(typeKey, 'Vote'),
        lifecycle: thisCompleted || voting.phase === 'REVEAL' || voting.phase === 'WINNER'
          ? 'completed'
          : playerActed
            ? 'in-progress'
            : 'needs-action',
        progress: totalVoters > 0 ? `${castCount}/${totalVoters}` : undefined,
        playerActed,
        cartridgeData: voting,
      });
    }

    // Active game
    if (game) {
      const typeKey = gameTypeKey(game);
      const cartridgeId = cartridgeIdFor('game', dayIndex, typeKey);
      const thisCompleted = todayCompletedIds.has(cartridgeId);
      // Async games (trivia/arcade) expose per-player `status` and
      // `allPlayerResults` on completion; sync-decision games expose `phase`.
      // Match today's completedCartridges entry by exact cartridgeId — the
      // previous `some(c.kind === 'game')` check was too broad and misclassified
      // Day N+1's active game as completed if any earlier game finished.
      const gameLifecycle: PillLifecycle =
        thisCompleted
          || game.phase === 'COMPLETED' || game.phase === 'REVEAL'
          || game.status === 'COMPLETED' || game.allPlayerResults
          ? 'completed'
        : game.phase === 'PLAYING' || game.phase === 'ACTIVE' || game.status === 'PLAYING'
          ? 'in-progress'
        : 'just-started';

      pills.push({
        id: cartridgeId,
        kind: 'game',
        label: prettyLabel(typeKey, 'Game'),
        lifecycle: gameLifecycle,
        cartridgeData: game,
      });
    }

    // Active prompt
    if (prompt) {
      const typeKey = promptTypeKey(prompt);
      const cartridgeId = cartridgeIdFor('prompt', dayIndex, typeKey);
      const thisCompleted = todayCompletedIds.has(cartridgeId);
      // Use the uniform `participated` projection (projections.ts). Each
      // prompt type stores submissions under a different field — some
      // stripped from SYNC during active phases — so the client must not
      // depend on any single type-specific field.
      const playerActed = playerId ? Boolean(prompt.participated?.[playerId]) : false;
      pills.push({
        id: cartridgeId,
        kind: 'prompt',
        label: prettyLabel(typeKey, 'Activity'),
        lifecycle: thisCompleted || prompt.phase === 'RESULTS'
          ? 'completed'
          : playerActed
            ? 'in-progress'
            : 'needs-action',
        playerActed,
        cartridgeData: prompt,
      });
    }

    // Active dilemma
    if (dilemma) {
      const typeKey = dilemmaTypeKey(dilemma);
      const cartridgeId = cartridgeIdFor('dilemma', dayIndex, typeKey);
      const thisCompleted = todayCompletedIds.has(cartridgeId);
      // `decisions` is stripped from the projection during COLLECTING —
      // use the uniform `participated` (mirrored as `submitted`) field.
      const playerActed = playerId
        ? Boolean(dilemma.participated?.[playerId] || dilemma.submitted?.[playerId])
        : false;
      pills.push({
        id: cartridgeId,
        kind: 'dilemma',
        label: prettyLabel(typeKey, 'Dilemma'),
        lifecycle: thisCompleted || dilemma.phase === 'REVEAL'
          ? 'completed'
          : playerActed
            ? 'in-progress'
            : 'needs-action',
        playerActed,
        cartridgeData: dilemma,
      });
    }

    // Today's completed cartridges not already represented by an active slot
    // (active slots keep their refs live per ADR-126 result-hold, but can be
    // absent after gameSummary teardown; render completed-only pills to fill
    // the gap).
    //
    // Attach cartridgeData with the appropriate type field so PulseBar's
    // `pillToCartridgeId` reconstructs the same cartridgeId the server uses
    // (`${kind}-${dayIndex}-${typeKey}`). Without cartridgeData, PulseBar
    // falls back to 'UNKNOWN' and the overlay's focusCartridge lookup fails
    // against completedCartridges.
    for (const c of todayCompleted) {
      if (!pills.some(p => p.id === c.key)) {
        const typeKey =
          c.snapshot?.mechanism ||
          c.snapshot?.voteType ||
          c.snapshot?.gameType ||
          c.snapshot?.promptType ||
          c.snapshot?.dilemmaType ||
          '';
        const cartridgeData =
          typeKey
            ? c.kind === 'voting' ? { mechanism: typeKey, voteType: typeKey, ...c.snapshot }
            : c.kind === 'game' ? { gameType: typeKey, ...c.snapshot }
            : c.kind === 'prompt' ? { promptType: typeKey, ...c.snapshot }
            : { dilemmaType: typeKey, ...c.snapshot }
            : c.snapshot;
        pills.push({
          id: c.key,
          kind: c.kind,
          label: prettyLabel(typeKey, c.kind),
          lifecycle: 'completed',
          cartridgeData,
        });
      }
    }

    // Timeline-driven pills from current day (PRE_SCHEDULED only — ADMIN events
    // have no fixed times). Emits 'upcoming' for future events; 'starting' for
    // past-due events whose active slot hasn't populated yet (ADR-128 SYNC gap).
    //
    // Suppress any upcoming/starting pill whose kind already has an ACTIVE or
    // COMPLETED representation (completed included: a Day N completed cartridge
    // makes any past-due timeline entry for that kind redundant).
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

        const alreadyRepresented = pills.some(p => p.kind === kind);
        if (alreadyRepresented) continue;

        // Resolve the day-level type so the overlay splash can render the
        // specific CARTRIDGE_INFO entry instead of a generic "Activity"/"Vote".
        const typeKey = dayTypeKeyFor(kind, day);
        const label = prettyLabel(typeKey, ACTION_LABELS[ev.action] || kind);
        const cartridgeData = upcomingCartridgeData(kind, typeKey);

        if (eventTime > now) {
          pills.push({
            id: `upcoming-${ev.action}-${ev.time}`,
            kind,
            label,
            lifecycle: 'upcoming',
            timeRemaining: Math.floor((eventTime - now) / 1000),
            cartridgeData,
          });
        } else {
          pills.push({
            id: `starting-${ev.action}-${ev.time}`,
            kind,
            label,
            lifecycle: 'starting',
            cartridgeData,
          });
        }
      }
    }

    return pills;
  }, [voting, game, prompt, dilemma, completed, manifest, dayIndex, playerId]);
}
