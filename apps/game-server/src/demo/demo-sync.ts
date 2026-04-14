/**
 * Build SYSTEM.SYNC payload from demo machine context.
 * Produces the same shape the client expects, with all
 * game-mechanic fields set to safe defaults.
 */
import type { Connection } from 'partyserver';
import { Events } from '@pecking-order/shared-types';
import type { DemoContext } from './demo-machine';

/** Build a per-player SYNC payload from demo context. */
export function buildDemoSyncPayload(
  context: DemoContext,
  playerId: string,
  onlinePlayers: string[],
): any {
  // Filter chatLog: only messages in channels this player belongs to (or is pending)
  const playerChatLog = context.chatLog.filter((msg: any) => {
    const ch = context.channels[msg.channelId];
    if (!ch) return msg.channelId === 'MAIN';
    if (ch.type === 'MAIN') return true;
    return ch.memberIds.includes(playerId) || (ch.pendingMemberIds || []).includes(playerId);
  }).map((msg: any) => {
    // Whisper projection: sender + target see full message, others see redacted
    if (msg.whisperTarget && msg.senderId !== playerId && msg.whisperTarget !== playerId) {
      return { ...msg, content: '', redacted: true };
    }
    return msg;
  });

  // Filter channels: only those the player belongs to (or is pending)
  const playerChannels = Object.fromEntries(
    Object.entries(context.channels).filter(([_, ch]: [string, any]) =>
      ch.type === 'MAIN' || ch.memberIds.includes(playerId) || (ch.pendingMemberIds || []).includes(playerId)
    )
  );

  return {
    type: Events.System.SYNC,
    state: 'socialPeriod', // client maps this to vivid-phase-social
    context: {
      gameId: context.gameId,
      dayIndex: context.dayIndex,
      roster: context.roster,
      manifest: context.manifest,
      chatLog: playerChatLog,
      channels: playerChannels,
      groupChatOpen: true,
      dmsOpen: true,
      activeVotingCartridge: null,
      activeGameCartridge: null,
      activePromptCartridge: null,
      activeDilemmaCartridge: null,
      winner: context.winner,
      goldPool: context.goldPool,
      goldPayouts: [],
      gameHistory: context.gameHistory,
      completedPhases: context.completedPhases,
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
        Object.keys(context.roster).map(pid => [pid, {
          messagesInMain: context.chatLog.filter((m: any) => m.senderId === pid && m.channelId === 'MAIN').length,
          dmPartners: 0, // Demo doesn't track DM partners
          isOnline: onlinePlayers.includes(pid),
        }])
      ),
      onlinePlayers,
    },
  };
}

/** Broadcast per-player demo SYNC to all connected clients. */
export function broadcastDemoSync(
  context: DemoContext,
  getConnections: () => Iterable<Connection>,
  connectedPlayers: Map<string, Set<string>>,
): void {
  const onlinePlayers = Array.from(connectedPlayers.keys());
  for (const ws of getConnections()) {
    const state = ws.state as { playerId: string } | null;
    const pid = state?.playerId || ws.deserializeAttachment()?.playerId;
    if (!pid || pid === '__admin__') continue;
    ws.send(JSON.stringify(buildDemoSyncPayload(context, pid, onlinePlayers)));
  }
}
