/**
 * SYSTEM.SYNC payload builder — extracts cartridge context from snapshots
 * and builds per-player SYNC messages. Eliminates duplication between
 * the subscribe callback and onConnect handler.
 */
import type { Connection } from "partyserver";
import { projectGameCartridge, projectPromptCartridge } from "./projections";

export interface CartridgeSnapshots {
  activeVotingCartridge: any;
  rawGameCartridge: any;
  activePromptCartridge: any;
}

/** Extract voting, game, and prompt cartridge context from an L2 snapshot. */
export function extractCartridges(snapshot: any): CartridgeSnapshots {
  let activeVotingCartridge: any = null;
  let rawGameCartridge: any = null;
  let activePromptCartridge: any = null;

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
    }
  } catch (err) {
    console.error('[L1] Cartridge context extraction failed:', err);
  }

  return { activeVotingCartridge, rawGameCartridge, activePromptCartridge };
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
  chatLog: any[];
  cartridges: CartridgeSnapshots;
}

/** Build the per-player SYSTEM.SYNC message object. */
export function buildSyncPayload(deps: SyncDeps, playerId: string): any {
  const { snapshot, l3Context, chatLog, cartridges } = deps;

  const playerChatLog = chatLog.filter((msg: any) =>
    msg.channel === 'MAIN' ||
    (msg.channel === 'DM' && (msg.senderId === playerId || msg.targetId === playerId))
  );

  const activeGameCartridge = projectGameCartridge(cartridges.rawGameCartridge, playerId);

  const perkOverrides = l3Context.perkOverrides || {};
  const overrides = perkOverrides[playerId] || { extraPartners: 0, extraChars: 0 };
  const dmStats = {
    charsUsed: (l3Context.dmCharsByPlayer || {})[playerId] || 0,
    charsLimit: 1200 + overrides.extraChars,
    partnersUsed: ((l3Context.dmPartnersByPlayer || {})[playerId] || []).length,
    partnersLimit: 3 + overrides.extraPartners,
  };

  return {
    type: "SYSTEM.SYNC",
    state: snapshot.value,
    context: {
      gameId: snapshot.context.gameId,
      dayIndex: snapshot.context.dayIndex,
      roster: snapshot.context.roster,
      manifest: snapshot.context.manifest,
      chatLog: playerChatLog,
      activeVotingCartridge: cartridges.activeVotingCartridge,
      activeGameCartridge,
      activePromptCartridge: projectPromptCartridge(cartridges.activePromptCartridge),
      winner: snapshot.context.winner,
      gameHistory: snapshot.context.gameHistory ?? [],
      dmStats,
    },
  };
}

/** Broadcast per-player SYNC to all connected clients. */
export function broadcastSync(deps: SyncDeps, getConnections: () => Iterable<Connection>): void {
  for (const ws of getConnections()) {
    const state = ws.state as { playerId: string } | null;
    const pid = state?.playerId;
    if (!pid) continue;
    ws.send(JSON.stringify(buildSyncPayload(deps, pid)));
  }
}
