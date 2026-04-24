/**
 * SYSTEM.SYNC payload builder — extracts cartridge context from snapshots
 * and builds per-player SYNC messages with server-projected phase.
 * Eliminates duplication between the subscribe callback and onConnect handler.
 */
import type { Connection } from "partyserver";
import { Events, DayPhases, getChannelHints } from "@pecking-order/shared-types";
import type { DayPhase, ChannelType, ChannelCapability } from "@pecking-order/shared-types";
import { projectGameCartridge } from "@pecking-order/game-cartridges";
import { projectPromptCartridge, projectDilemmaCartridge } from "@pecking-order/cartridges";
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

/** Extract l3-pregame context from an L2 snapshot. Returns null when pregame
 *  actor isn't alive (i.e. L2 has moved past `preGame` — l3-pregame dies on
 *  state exit, so the snapshot.children entry disappears too). Pregame data is
 *  not meant to survive into Day 1; the journal in D1 is the only persistent
 *  record (queryable via GameJournal WHERE day_index = 0).
 *
 *  Returns chatLog + channels too so buildSyncPayload can union them with
 *  the empty l3-session equivalents during pregame — this lets pregame
 *  whispers render through the existing ChatView / WhisperCard path without
 *  special-casing the source. */
export function extractPregameContext(snapshot: any): {
  revealedAnswers: Record<string, { qIndex: number; question: string; answer: string; revealedAt: number }>;
  players: Record<string, { joinedAt: number }>;
  chatLog: any[];
  channels: Record<string, any>;
} | null {
  try {
    const ref = snapshot.children?.['l3-pregame'];
    if (!ref) return null;
    const ctx = ref.getSnapshot()?.context;
    if (!ctx) return null;
    // Strip qaAnswers from the per-player projection — full QA already lives on
    // the roster (SocialPlayer.qaAnswers); the pregame slice only needs the
    // join timestamp for ordering UI.
    const players: Record<string, { joinedAt: number }> = {};
    for (const [pid, info] of Object.entries(ctx.players || {})) {
      players[pid] = { joinedAt: (info as any).joinedAt };
    }
    return {
      revealedAnswers: ctx.revealedAnswers || {},
      players,
      chatLog: Array.isArray(ctx.chatLog) ? ctx.chatLog : [],
      channels: ctx.channels || {},
    };
  } catch (err) {
    console.error('[L1] Pregame context extraction failed:', err);
    return null;
  }
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

function typeKeyFor(kind: 'voting' | 'game' | 'prompt' | 'dilemma', cartridge: any): string {
  if (!cartridge) return 'UNKNOWN';
  switch (kind) {
    case 'voting': return cartridge.mechanism || cartridge.voteType || 'UNKNOWN';
    case 'game': return cartridge.gameType || 'UNKNOWN';
    case 'prompt': return cartridge.promptType || 'UNKNOWN';
    case 'dilemma': return cartridge.dilemmaType || 'UNKNOWN';
  }
}

function decorateCartridge(
  cartridge: any,
  kind: 'voting' | 'game' | 'prompt' | 'dilemma',
  dayIndex: number,
  updatedAt: number | undefined,
): any {
  if (!cartridge) return null;
  return {
    ...cartridge,
    cartridgeId: `${kind}-${dayIndex}-${typeKeyFor(kind, cartridge)}`,
    updatedAt: updatedAt ?? Date.now(),
  };
}

/** Build the per-player SYSTEM.SYNC message object. */
export function buildSyncPayload(deps: SyncDeps, playerId: string, onlinePlayers?: string[]): any {
  const { snapshot, l3Context, chatLog, cartridges } = deps;

  // Resolve phase early — we need it to decide whether to merge in pregame
  // chatLog/channels (and whether to strip qaAnswers below).
  const phaseEarly = resolveDayPhase(snapshot.value, deps.l3SnapshotValue);
  const pregameEarly = phaseEarly === DayPhases.PREGAME ? extractPregameContext(snapshot) : null;

  // During pregame, l3-session doesn't exist — l3-pregame owns the chatLog +
  // channels. Union them so the existing chat / whisper rendering paths just
  // work without special-casing the source.
  const channels = pregameEarly
    ? { ...(l3Context.channels || {}), ...pregameEarly.channels }
    : (l3Context.channels || {});
  const effectiveChatLog = pregameEarly
    ? [...chatLog, ...pregameEarly.chatLog]
    : chatLog;

  const playerChatLog = effectiveChatLog.filter((msg: any) => {
    if (msg.channelId) {
      const ch = channels[msg.channelId];
      if (!ch) return msg.channelId === 'MAIN';
      if (ch.type === 'MAIN') return true;
      return ch.memberIds.includes(playerId) || (ch.pendingMemberIds || []).includes(playerId);
    }
    // Legacy path
    return msg.channel === 'MAIN' || (msg.channel === 'DM' && (msg.senderId === playerId || msg.targetId === playerId));
  }).map((msg: any) => {
    // Whisper projection: sender + target see full message, others see redacted
    if (msg.whisperTarget && msg.senderId !== playerId && msg.whisperTarget !== playerId) {
      return { ...msg, content: '', redacted: true };
    }
    return msg;
  });

  const rawRoster = snapshot.context.roster || {};
  const phase = phaseEarly;
  // During pregame, redact each roster entry's qaAnswers[i].answer EXCEPT for
  // (a) the viewer's own row (always sees own answers) or (b) qIndex matches a
  // recorded reveal in pregame.revealedAnswers. The question stays visible —
  // it's the "locked slot" label the client renders. Once L2 leaves preGame,
  // pregameEarly is null and roster passes through unchanged.
  const roster = pregameEarly
    ? Object.fromEntries(Object.entries(rawRoster).map(([pid, p]: [string, any]) => {
        if (pid === playerId) return [pid, p];
        const qaAnswers = Array.isArray(p?.qaAnswers) ? p.qaAnswers : null;
        if (!qaAnswers) return [pid, p];
        const revealedQIdx = pregameEarly.revealedAnswers[pid]?.qIndex;
        const projected = qaAnswers.map((qa: any, i: number) =>
          i === revealedQIdx ? qa : { ...qa, answer: '' }
        );
        return [pid, { ...p, qaAnswers: projected }];
      }))
    : rawRoster;

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

  const dayIdx = snapshot.context.dayIndex ?? 0;
  const updatedAtMap = l3Context.cartridgeUpdatedAt || {};
  const decoratedVoting = decorateCartridge(cartridges.activeVotingCartridge, 'voting', dayIdx, updatedAtMap.activeVotingCartridge);
  const decoratedGame = decorateCartridge(activeGameCartridge, 'game', dayIdx, updatedAtMap.activeGameCartridge);
  const decoratedPrompt = decorateCartridge(projectPromptCartridge(cartridges.activePromptCartridge), 'prompt', dayIdx, updatedAtMap.activePromptCartridge);
  const decoratedDilemma = decorateCartridge(projectDilemmaCartridge(cartridges.activeDilemmaCartridge), 'dilemma', dayIdx, updatedAtMap.activeDilemmaCartridge);

  const perkOverrides = l3Context.perkOverrides || {};
  const overrides = perkOverrides[playerId] || { extraPartners: 0, extraChars: 0 };
  const dmStats = {
    charsUsed: (l3Context.dmCharsByPlayer || {})[playerId] || 0,
    charsLimit: (l3Context.dmCharsLimit ?? 1200) + overrides.extraChars,
    partnersUsed: ((l3Context.dmPartnersByPlayer || {})[playerId] || []).length,
    partnersLimit: (l3Context.dmPartnersLimit ?? 3) + overrides.extraPartners,
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

  // Per-recipient confessionPhase projection. Server-side `handlesByPlayer` maps
  // every player to their anonymous handle and MUST NEVER ship to a client —
  // collapse to `myHandle` (this player's own handle or null) and `handleCount`.
  // `closesAt` (absolute epoch-ms of the scheduled END_CONFESSION_CHAT) is
  // non-sensitive — it flows through so clients can render the closing-soon
  // warning and a countdown without a new fact/alarm.
  const rawConfession = l3Context.confessionPhase || { active: false, handlesByPlayer: {}, posts: [], closesAt: null };
  const rawHandles = rawConfession.handlesByPlayer || {};
  const confessionPhase = {
    active: rawConfession.active ?? false,
    myHandle: rawHandles[playerId] ?? null,
    handleCount: Object.keys(rawHandles).length,
    posts: rawConfession.posts ?? [],
    closesAt: rawConfession.closesAt ?? null,
  };

  // Pregame slice — only present while l3-pregame is alive (i.e. phase === 'pregame').
  // Drops automatically once L2 transitions to dayLoop and the invoked actor stops.
  // Same data we extracted above for chatLog/channel merging — re-use the snapshot
  // to keep the wire field identical to the v1 contract.
  const pregame = pregameEarly
    ? { revealedAnswers: pregameEarly.revealedAnswers, players: pregameEarly.players }
    : null;

  return {
    type: Events.System.SYNC,
    state: snapshot.value,
    phase,
    context: {
      gameId: snapshot.context.gameId,
      dayIndex: snapshot.context.dayIndex,
      roster,
      manifest: snapshot.context.manifest,
      chatLog: playerChatLog,
      channels: playerChannels,
      // Pregame override: l3-session hasn't spawned yet, so its default (both
      // false) would close the composer entirely. Pregame allows group chat on
      // MAIN (SEND_MSG + REACT) but not DMs — reflect that to clients.
      groupChatOpen: pregameEarly ? true : (l3Context.groupChatOpen ?? false),
      dmsOpen: pregameEarly ? false : (l3Context.dmsOpen ?? false),
      activeVotingCartridge: decoratedVoting,
      activeGameCartridge: decoratedGame,
      activePromptCartridge: decoratedPrompt,
      activeDilemmaCartridge: decoratedDilemma,
      winner: snapshot.context.winner,
      goldPool: snapshot.context.goldPool ?? 0,
      goldPayouts: snapshot.context.goldPayouts ?? [],
      gameHistory: snapshot.context.gameHistory ?? [],
      completedPhases: snapshot.context.completedPhases ?? [],
      dmStats,
      playerActivity,
      confessionPhase,
      ...(pregame ? { pregame } : {}),
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
