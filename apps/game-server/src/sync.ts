/**
 * SYSTEM.SYNC payload builder — extracts cartridge context from snapshots
 * and builds per-player SYNC messages with server-projected phase.
 * Eliminates duplication between the subscribe callback and onConnect handler.
 */
import type { Connection } from "partyserver";
import { Events, DayPhases, getChannelHints } from "@pecking-order/shared-types";
import type { DayPhase, ChannelType, ChannelCapability } from "@pecking-order/shared-types";
import { projectGameCartridge, projectPromptCartridge, projectDilemmaCartridge } from "./projections";
import { flattenState } from "./ticker";

export interface CartridgeSnapshots {
  activeVotingCartridge: any;
  rawGameCartridge: any;
  activePromptCartridge: any;
  activeDilemmaCartridge: any;
}

/** Extract voting, game, prompt, and dilemma cartridge context from an L2 snapshot. */
export function extractCartridges(snapshot: any): CartridgeSnapshots {
  let activeVotingCartridge: any = null;
  let rawGameCartridge: any = null;
  let activePromptCartridge: any = null;
  let activeDilemmaCartridge: any = null;

  try {
    const l3Ref = snapshot.children['l3-session'];
    if (l3Ref) {
      const l3Snap = l3Ref.getSnapshot();
      const votingRef = (l3Snap?.children as any)?.['activeVotingCartridge'];
      if (votingRef) {
        activeVotingCartridge = votingRef.getSnapshot()?.context || null;
      }
      const gameRef = (l3Snap?.children as any)?.['activeGameCartridge'];
      if (gameRef) {
        rawGameCartridge = gameRef.getSnapshot()?.context || null;
      }
      const promptRef = (l3Snap?.children as any)?.['activePromptCartridge'];
      if (promptRef) {
        activePromptCartridge = promptRef.getSnapshot()?.context || null;
      }
      const dilemmaRef = (l3Snap?.children as any)?.['activeDilemmaCartridge'];
      if (dilemmaRef) {
        activeDilemmaCartridge = dilemmaRef.getSnapshot()?.context || null;
      }
    }
  } catch (err) {
    console.error('[L1] Cartridge context extraction failed:', err);
  }

  return { activeVotingCartridge, rawGameCartridge, activePromptCartridge, activeDilemmaCartridge };
}

/** Extract L3 context from an L2 snapshot, with fallback chatLog. */
export function extractL3Context(snapshot: any, fallbackChatLog: any[]): {
  l3Context: any;
  l3Snapshot: any;
  chatLog: any[];
} {
  let l3Context: any = {};
  let l3Snapshot: any = null;
  const l3Ref = snapshot.children['l3-session'];
  if (l3Ref) {
    try {
      l3Snapshot = l3Ref.getSnapshot();
      if (l3Snapshot) {
        l3Context = l3Snapshot.context;
      } else {
        console.warn('[L1] L3 ref exists but getSnapshot() returned null');
      }
    } catch (err) {
      console.error('[L1] L3 snapshot extraction FAILED — L3 may have crashed:', err);
    }
  }

  const chatLog = l3Context.chatLog ?? fallbackChatLog;
  return { l3Context, l3Snapshot, chatLog };
}

export interface SyncDeps {
  snapshot: any;
  l3Context: any;
  l3SnapshotValue?: any;
  chatLog: any[];
  cartridges: CartridgeSnapshots;
}

/**
 * Resolve the current game phase from L2 + optional L3 snapshot values.
 * Pure projection — no machine coupling. Uses flattened state string matching
 * (same approach as stateToTicker). Order matters: more specific matches first.
 *
 * L3 states (voting, dailyGame, playing) live in the invoked child machine
 * and are NOT visible in the L2 snapshot.value. When l3Value is provided,
 * we flatten it and check for finer-grained phases.
 */
export function resolveDayPhase(snapshotValue: any, l3Value?: any): DayPhase {
  const s = flattenState(snapshotValue);
  if (s.includes('gameOver'))        return DayPhases.GAME_OVER;
  if (s.includes('gameSummary'))      return DayPhases.FINALE;
  if (s.includes('nightSummary'))     return DayPhases.ELIMINATION;
  if (s.includes('morningBriefing'))  return DayPhases.MORNING;
  if (s.includes('preGame'))          return DayPhases.PREGAME;

  // L3 states — only available when activeSession is running
  if (l3Value) {
    const l3 = flattenState(l3Value);
    if (l3.includes('voting'))                                    return DayPhases.VOTING;
    if (l3.includes('dailyGame'))                                 return DayPhases.GAME;
    if (l3.includes('playing') || l3.includes('dailyActivity') || l3.includes('dailyPrompt')) return DayPhases.ACTIVITY;
    // dilemmaActive does NOT change phase — dilemma overlays the social period
  }

  // Fallback: if we're in activeSession but L3 isn't available, default to SOCIAL
  if (s.includes('activeSession'))   return DayPhases.SOCIAL;

  return DayPhases.PREGAME;
}

/** Build the per-player SYSTEM.SYNC message object. */
export function buildSyncPayload(deps: SyncDeps, playerId: string, onlinePlayers?: string[]): any {
  const { snapshot, l3Context, chatLog, cartridges } = deps;

  const channels = l3Context.channels || {};
  const playerChatLog = chatLog.filter((msg: any) => {
    if (msg.channelId) {
      const ch = channels[msg.channelId];
      if (!ch) return msg.channelId === 'MAIN';
      if (ch.type === 'MAIN') return true;
      return ch.memberIds.includes(playerId) || (ch.pendingMemberIds || []).includes(playerId);
    }
    // Legacy path
    return msg.channel === 'MAIN' || (msg.channel === 'DM' && (msg.senderId === playerId || msg.targetId === playerId));
  });

  const roster = snapshot.context.roster || {};
  const phase = resolveDayPhase(snapshot.value, deps.l3SnapshotValue);

  const playerChannels = Object.fromEntries(
    Object.entries(channels).filter(([_, ch]: [string, any]) =>
      ch.type === 'MAIN' ||
      ch.memberIds.includes(playerId) ||
      (ch.pendingMemberIds || []).includes(playerId)
    ).map(([id, ch]: [string, any]) => {
      // Resolve target name for DM channels
      let targetName: string | undefined;
      if (ch.type === 'DM') {
        const otherId = ch.memberIds.find((mid: string) => mid !== playerId);
        if (otherId) targetName = roster[otherId]?.personaName;
      }

      const hints = getChannelHints(ch.type as ChannelType, {
        targetName,
        capabilities: ch.capabilities as ChannelCapability[] | undefined,
        phase,
      });

      return [id, { ...ch, hints }];
    })
  );

  const activeGameCartridge = projectGameCartridge(cartridges.rawGameCartridge, playerId);

  const perkOverrides = l3Context.perkOverrides || {};
  const overrides = perkOverrides[playerId] || { extraPartners: 0, extraChars: 0 };
  const dmStats = {
    charsUsed: (l3Context.dmCharsByPlayer || {})[playerId] || 0,
    charsLimit: 1200 + overrides.extraChars,
    partnersUsed: ((l3Context.dmPartnersByPlayer || {})[playerId] || []).length,
    partnersLimit: 3 + overrides.extraPartners,
    groupsUsed: ((l3Context.dmGroupsByPlayer || {})[playerId] || []).length,
    groupsLimit: 3,
    slotsUsed: (l3Context.slotsUsedByPlayer || {})[playerId] || 0,
  };

  // Aggregate player activity indicators (visible to all players)
  const playerActivity: Record<string, { messagesInMain: number; dmPartners: number; isOnline: boolean }> = {};
  for (const pid of Object.keys(roster)) {
    playerActivity[pid] = {
      messagesInMain: chatLog.filter((m: any) => m.senderId === pid && (m.channelId === 'MAIN' || (!m.channelId && m.channel === 'MAIN'))).length,
      dmPartners: ((l3Context.dmPartnersByPlayer || {})[pid] || []).length,
      isOnline: (onlinePlayers || []).includes(pid),
    };
  }

  return {
    type: Events.System.SYNC,
    state: snapshot.value,
    phase,
    context: {
      gameId: snapshot.context.gameId,
      dayIndex: snapshot.context.dayIndex,
      roster: snapshot.context.roster,
      manifest: snapshot.context.manifest,
      chatLog: playerChatLog,
      channels: playerChannels,
      groupChatOpen: l3Context.groupChatOpen ?? false,
      dmsOpen: l3Context.dmsOpen ?? false,
      activeVotingCartridge: cartridges.activeVotingCartridge,
      activeGameCartridge,
      activePromptCartridge: projectPromptCartridge(cartridges.activePromptCartridge),
      activeDilemmaCartridge: projectDilemmaCartridge(cartridges.activeDilemmaCartridge),
      winner: snapshot.context.winner,
      goldPool: snapshot.context.goldPool ?? 0,
      goldPayouts: snapshot.context.goldPayouts ?? [],
      gameHistory: snapshot.context.gameHistory ?? [],
      completedPhases: snapshot.context.completedPhases ?? [],
      dmStats,
      playerActivity,
      ...(onlinePlayers ? { onlinePlayers } : {}),
    },
  };
}

/** Broadcast per-player SYNC to all connected clients. */
export function broadcastSync(deps: SyncDeps, getConnections: () => Iterable<Connection>, onlinePlayers?: string[]): void {
  for (const ws of getConnections()) {
    // ws.state may be lost after hibernation — fall back to attachment
    const state = ws.state as { playerId: string } | null;
    const pid = state?.playerId || ws.deserializeAttachment()?.playerId;
    if (!pid) continue;
    ws.send(JSON.stringify(buildSyncPayload(deps, pid, onlinePlayers)));
  }
}
