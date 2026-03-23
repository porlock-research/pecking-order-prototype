/**
 * Showcase SYNC — builds per-player SYSTEM.SYNC payload.
 * Follows the demo-sync.ts pattern with dilemma cartridge support.
 */
import type { Connection } from 'partyserver';
import { Events } from '@pecking-order/shared-types';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { projectDilemmaCartridge } from '../projections';
import type { ShowcaseConfig } from './showcase-machine';

export interface ShowcaseSyncDeps {
  gameId: string;
  roster: Record<string, SocialPlayer>;
  config: ShowcaseConfig;
  showcaseState: string;  // 'idle' | 'running' | 'results'
  dilemmaChildSnapshot: any | null;  // Snapshot of the spawned dilemma actor
  lastResults: any;
}

export function buildShowcaseSyncPayload(
  deps: ShowcaseSyncDeps,
  playerId: string,
  onlinePlayers: string[],
): any {
  const { gameId, roster, config, showcaseState, dilemmaChildSnapshot, lastResults } = deps;

  // Project dilemma cartridge context for the client (redacted during COLLECTING)
  const activeDilemmaCartridge = dilemmaChildSnapshot
    ? projectDilemmaCartridge(dilemmaChildSnapshot.context)
    : null;

  return {
    type: Events.System.SYNC,
    state: 'socialPeriod',  // Client uses activeDilemmaCartridge presence to show DilemmaCard, not this field
    context: {
      gameId,
      dayIndex: 1,
      roster,
      manifest: {
        kind: 'STATIC' as const,
        id: `manifest-${gameId}`,
        gameMode: 'CONFIGURABLE_CYCLE',
        scheduling: 'ADMIN' as const,
        days: [{ dayIndex: 1, theme: 'Showcase', voteType: 'MAJORITY', gameType: 'NONE', timeline: [], requireDmInvite: false, dmSlotsPerPlayer: 5 }],
        pushConfig: {},
      },
      chatLog: [],
      channels: {
        MAIN: {
          id: 'MAIN',
          type: 'MAIN',
          memberIds: Object.keys(roster),
          createdBy: 'system',
          createdAt: Date.now(),
          capabilities: ['CHAT'],
          constraints: {},
        },
      },
      groupChatOpen: true,
      dmsOpen: false,
      activeVotingCartridge: null,
      activeGameCartridge: null,
      activePromptCartridge: null,
      activeDilemmaCartridge,
      winner: null,
      goldPool: 0,
      goldPayouts: [],
      gameHistory: [],
      completedPhases: [],
      dmStats: {
        charsUsed: 0,
        charsLimit: 1200,
        partnersUsed: 0,
        partnersLimit: 5,
        groupsUsed: 0,
        groupsLimit: 3,
        slotsUsed: 0,
      },
      playerActivity: Object.fromEntries(
        Object.keys(roster).map(pid => [pid, {
          messagesInMain: 0,
          dmPartners: 0,
          isOnline: onlinePlayers.includes(pid),
        }])
      ),
      onlinePlayers,
      // Showcase-specific extension (client ignores, admin panel reads)
      showcase: {
        config,
        state: showcaseState,
        lastResults,
      },
    },
  };
}

export function broadcastShowcaseSync(
  deps: ShowcaseSyncDeps,
  getConnections: () => Iterable<Connection>,
  connectedPlayers: Map<string, Set<string>>,
): void {
  const onlinePlayers = Array.from(connectedPlayers.keys());
  for (const ws of getConnections()) {
    const state = ws.state as { playerId: string } | null;
    const pid = state?.playerId || ws.deserializeAttachment()?.playerId;
    if (!pid) continue;
    ws.send(JSON.stringify(buildShowcaseSyncPayload(deps, pid, onlinePlayers)));
  }
}
