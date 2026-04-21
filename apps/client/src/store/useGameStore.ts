import { create } from 'zustand';
import { SocialPlayer, ChatMessage, DmRejectionReason, TickerMessage, PerkType, GameHistoryEntry, Channel, ChannelTypes, DayPhases, TickerCategories } from '@pecking-order/shared-types';
import type { DayPhase, DeepLinkIntent, CartridgeKind } from '@pecking-order/shared-types';

/**
 * Keep the previous reference if the new value is structurally identical.
 * Prevents Zustand subscribers from re-rendering when SYNC sends the same data.
 */
function stableRef<T>(prev: T, next: T): T {
  if (prev === next) return prev;
  if (prev == null || next == null) return next;
  try {
    if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
  } catch { /* non-serializable — use next */ }
  return next;
}

/**
 * Inline hydration of Pulse Phase 4 seen-state maps. Used by the SYNC reducer
 * (parallel to welcomeSeen's inline read) so the returned patch object
 * preserves the current maps when gameId or playerId isn't known yet.
 * Malformed JSON is swallowed — first-mount must never crash.
 */
function hydratePhase4Maps(
  gameId: string | null,
  playerId: string | null,
  state: {
    lastSeenCartridge: Record<string, number>;
    lastSeenSilverFrom: Record<string, number>;
    lastSeenNudgeFrom: Record<string, number>;
    revealsSeen: { elimination: Record<number, boolean>; winner: boolean };
  },
) {
  if (!gameId || !playerId) {
    return {
      lastSeenCartridge: state.lastSeenCartridge,
      lastSeenSilverFrom: state.lastSeenSilverFrom,
      lastSeenNudgeFrom: state.lastSeenNudgeFrom,
      revealsSeen: state.revealsSeen,
    };
  }
  const scope = `${gameId}-${playerId}`;
  const read = <T>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(`po-${key}-${scope}`);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  // stableRef collapses identical-content reads back to the previous reference
  // so SYNC doesn't trigger unnecessary downstream re-renders.
  return {
    lastSeenCartridge: stableRef(state.lastSeenCartridge, read('lastSeenCartridge', state.lastSeenCartridge)),
    lastSeenSilverFrom: stableRef(state.lastSeenSilverFrom, read('lastSeenSilverFrom', state.lastSeenSilverFrom)),
    lastSeenNudgeFrom: stableRef(state.lastSeenNudgeFrom, read('lastSeenNudgeFrom', state.lastSeenNudgeFrom)),
    revealsSeen: stableRef(state.revealsSeen, read('revealsSeen', state.revealsSeen)),
  };
}

/**
 * Memoize a selector by a tuple of input references. Returns the cached
 * result until any input identity changes. Critical for selectors that
 * build fresh objects/arrays — a fresh reference each call triggers a
 * React 19 `useSyncExternalStore` infinite loop.
 */
function memoSelector<T>(
  inputs: (state: GameState) => readonly unknown[],
  compute: (state: GameState) => T,
): (state: GameState) => T {
  let lastInputs: readonly unknown[] | null = null;
  let lastResult: T;
  return (state) => {
    const next = inputs(state);
    if (
      lastInputs &&
      next.length === lastInputs.length &&
      next.every((v, i) => v === lastInputs![i])
    ) {
      return lastResult;
    }
    lastInputs = next;
    lastResult = compute(state);
    return lastResult;
  };
}

interface DmThread {
  partnerId: string;
  channelId: string;
  messages: ChatMessage[];
  lastTimestamp: number;
  isGroup?: boolean;
  memberIds?: string[];
}

export interface CompletedCartridge {
  kind: 'voting' | 'game' | 'prompt' | 'dilemma';
  snapshot: any;   // L2 result data (mechanism, gameType, silverRewards, etc.)
  completedAt: number;
  /** Day this cartridge was completed on (1-indexed). */
  dayIndex: number;
  key: string;
}

interface GameState {
  gameId: string | null;
  dayIndex: number;
  roster: Record<string, SocialPlayer>;
  chatLog: ChatMessage[];
  channels: Record<string, Channel>;
  groupChatOpen: boolean;
  dmsOpen: boolean;
  manifest: any;
  serverState: string | null;
  /** Server-projected game phase (e.g. 'morning', 'voting', 'elimination') */
  phase: DayPhase;
  playerId: string | null;
  activeVotingCartridge: any | null;
  activeGameCartridge: any | null;
  activePromptCartridge: any | null;
  activeDilemma: any | null;
  completedCartridges: CompletedCartridge[];
  winner: { playerId: string; mechanism: string; summary: Record<string, any> } | null;
  goldPool: number;
  gameHistory: GameHistoryEntry[];
  dmStats: { charsUsed: number; charsLimit: number; partnersUsed: number; partnersLimit: number; groupsUsed: number; groupsLimit: number; slotsUsed: number } | null;
  onlinePlayers: string[];
  typingPlayers: Record<string, string>;  // playerId → channel
  dmRejection: { reason: DmRejectionReason; timestamp: number } | null;
  silverTransferRejection: { reason: string; timestamp: number } | null;
  lastPerkResult: any | null;
  playerActivity: Record<string, { messagesInMain: number; dmPartners: number; isOnline: boolean }>;
  /**
   * Per-recipient confession-phase projection from SYNC (T12 server projection,
   * T15 hydration). Full handlesByPlayer stays server-side; client sees only
   * its own handle. Default inactive shape when no live phase; never null.
   */
  confessionPhase: {
    active: boolean;
    myHandle: string | null;
    handleCount: number;
    posts: Array<{ handle: string; text: string; ts: number }>;
    /** Absolute epoch-ms timestamp of the scheduled END_CONFESSION_CHAT.
     *  Null when inactive or when the day's timeline doesn't schedule one. */
    closesAt: number | null;
  };
  /**
   * Pregame slice from SYNC. Present only while server phase === 'pregame'
   * (l3-pregame is alive). Drops to null automatically once Day 1 starts —
   * pregame content is journaled to D1 but does not carry into game state.
   */
  pregame: {
    revealedAnswers: Record<string, { qIndex: number; question: string; answer: string; revealedAt: number }>;
    players: Record<string, { joinedAt: number }>;
  } | null;
  tickerMessages: TickerMessage[];
  debugTicker: string | null;

  // Showcase extension (admin panel reads this)
  showcaseData: { config: any; state: string; lastResults?: any } | null;

  // Overlay coordination
  splashVisible: boolean;

  // Dashboard / Notifications
  dashboardOpen: boolean;
  dashboardSeenForDay: number | null;
  welcomeSeen: boolean;
  lastSeenFeedTimestamp: number;
  requestedTab: string | null;

  // Pulse Phase 1.5 additions
  lastReadTimestamp: Record<string, number>;
  pickingMode:
    | null
    | { kind: 'new-dm'; selected: string[] }
    | { kind: 'add-member'; channelId: string; selected: string[] };

  // Pulse Phase 4 additions — device-local seen state + deep-link intent retry
  lastSeenCartridge: Record<string, number>;        // cartridgeId → ts
  lastSeenSilverFrom: Record<string, number>;       // senderPlayerId → ts
  lastSeenNudgeFrom: Record<string, number>;        // senderPlayerId → ts
  revealsSeen: { elimination: Record<number, boolean>; winner: boolean };
  pendingIntent: DeepLinkIntent | null;
  pendingIntentAttempts: number;
  pendingIntentFirstReceivedAt: number | null;

  // Cartridge overlay — shell-agnostic attention intent (session-scoped, not persisted).
  // Per spec §2, no auto-coordination with silverTarget/dmTarget/socialPanelOpen —
  // surfaces stack at the same z-tier and dismiss through their own paths.
  focusedCartridge: {
    cartridgeId: string;
    cartridgeKind: CartridgeKind;
    origin: 'manual' | 'push';
  } | null;

  // Actions
  sync: (data: any) => void;
  addChatMessage: (msg: ChatMessage) => void;
  addTickerMessage: (msg: TickerMessage) => void;
  setTickerMessages: (msgs: TickerMessage[]) => void;
  setDebugTicker: (summary: string) => void;
  setPlayerId: (id: string) => void;
  setDmRejection: (reason: DmRejectionReason) => void;
  clearDmRejection: () => void;
  setSilverTransferRejection: (reason: string) => void;
  clearSilverTransferRejection: () => void;
  setPerkResult: (result: any) => void;
  clearPerkResult: () => void;
  setOnlinePlayers: (players: string[]) => void;
  setTyping: (playerId: string, channel: string) => void;
  clearTyping: (playerId: string) => void;
  openDashboard: () => void;
  closeDashboard: () => void;
  toggleDashboard: () => void;
  markDashboardSeen: (dayIndex: number) => void;
  markWelcomeSeen: () => void;
  markFeedSeen: () => void;
  requestNavigation: (tab: string) => void;
  clearNavigation: () => void;
  setSplashVisible: (v: boolean) => void;

  // Pulse Phase 1.5 actions
  hydrateLastRead: (gameId: string, playerId: string) => void;
  markChannelRead: (channelId: string) => void;
  startPicking: () => void;
  startAddMember: (channelId: string) => void;
  cancelPicking: () => void;
  togglePicked: (playerId: string) => void;

  // Pulse Phase 4 actions
  hydratePhase4FromStorage: () => void;
  markCartridgeSeen: (cartridgeId: string) => void;
  markSilverSeen: (senderId: string) => void;
  markNudgeSeen: (senderId: string) => void;
  markRevealSeen: (kind: 'elimination' | 'winner', dayIndex?: number) => void;
  setPendingIntent: (intent: DeepLinkIntent | null) => void;
  incrementIntentAttempts: () => void;
  focusCartridge: (cartridgeId: string, cartridgeKind: CartridgeKind, origin: 'manual' | 'push') => void;
  unfocusCartridge: () => void;
  // Reveal queue — forcedReveal overrides the automatic queue from selectRevealsToReplay.
  // Module-level state so useRevealQueue instances across components see the same value.
  forcedReveal: { kind: 'elimination' | 'winner'; dayIndex?: number } | null;
  setForcedReveal: (reveal: { kind: 'elimination' | 'winner'; dayIndex?: number } | null) => void;
}

// Selectors
export const selectMainChat = (state: GameState): ChatMessage[] =>
  state.chatLog.filter(m => m.channelId === 'MAIN' || (!m.channelId && m.channel === 'MAIN'));

export const selectDmThreads = memoSelector(
  (s) => [s.playerId, s.channels, s.chatLog],
  (state: GameState): DmThread[] => {
    const pid = state.playerId;
    if (!pid) return [];

    const dmChannels = Object.values(state.channels).filter(
      ch => (ch.type === ChannelTypes.DM || ch.type === ChannelTypes.GROUP_DM) && ch.memberIds.includes(pid)
    );

    return dmChannels.map(ch => {
      const isGroup = ch.type === ChannelTypes.GROUP_DM;
      const partnerId = isGroup
        ? ch.id
        : (ch.memberIds.find(id => id !== pid) || ch.memberIds[0]);
      const messages = state.chatLog
        .filter(m => m.channelId === ch.id)
        .sort((a, b) => a.timestamp - b.timestamp);
      return {
        partnerId,
        channelId: ch.id,
        messages,
        lastTimestamp: messages.length > 0 ? messages[messages.length - 1].timestamp : ch.createdAt,
        isGroup,
        memberIds: isGroup ? ch.memberIds : undefined,
      };
    })
    .filter(t => t.isGroup || t.messages.length > 0)
    .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  },
);

export const selectSortedPlayers = (state: GameState): {
  alive: [string, SocialPlayer][];
  eliminated: [string, SocialPlayer][];
} => {
  const entries = Object.entries(state.roster);
  const alive = entries
    .filter(([, p]) => p.status === 'ALIVE')
    .sort((a, b) => {
      const silverDiff = b[1].silver - a[1].silver;
      if (silverDiff !== 0) return silverDiff;
      return a[1].personaName.localeCompare(b[1].personaName);
    });
  const eliminated = entries
    .filter(([, p]) => p.status === 'ELIMINATED')
    .sort((a, b) => a[1].personaName.localeCompare(b[1].personaName));
  return { alive, eliminated };
};

export const selectGameDmChannels = (state: GameState): Channel[] => {
  const pid = state.playerId;
  if (!pid) return [];
  return Object.values(state.channels).filter(
    ch => ch.type === ChannelTypes.GAME_DM && ch.memberIds.includes(pid)
  );
};

/** Channels where the player is a pending member (needs to accept/decline) */
export const selectPendingChannels = (state: GameState): Channel[] => {
  const pid = state.playerId;
  if (!pid) return [];
  return Object.values(state.channels).filter(
    ch => (ch.pendingMemberIds || []).includes(pid)
  );
};

/** Channels where the player has sent invites (created channel, others are pending) */
export const selectSentInviteChannels = (state: GameState): Channel[] => {
  const pid = state.playerId;
  if (!pid) return [];
  return Object.values(state.channels).filter(
    ch => ch.createdBy === pid && (ch.pendingMemberIds || []).length > 0
  );
};

export const selectRequireDmInvite = (state: GameState): boolean => {
  if (!state.manifest?.days) return false;
  const currentDay = state.manifest.days[state.dayIndex - 1];
  return currentDay?.requireDmInvite ?? false;
};

export const selectDmSlots = memoSelector(
  (s) => [s.manifest, s.dayIndex, s.dmStats],
  (state: GameState): { used: number; total: number } => {
    if (!state.manifest?.days) return { used: 0, total: 5 };
    const currentDay = state.manifest.days[state.dayIndex - 1];
    const total = currentDay?.dmSlotsPerPlayer ?? 5;
    const used = state.dmStats?.slotsUsed ?? 0;
    return { used, total };
  },
);

export const selectCanAddMemberTo = (state: GameState, channelId: string): boolean => {
  const channel = state.channels?.[channelId];
  if (!channel) return false;
  if (channel.createdBy !== state.playerId) return false;
  return (channel.capabilities ?? []).includes('INVITE_MEMBER');
};

export const selectGroupDmTitle = (state: GameState, channelId: string): string => {
  const channel = state.channels?.[channelId];
  if (!channel) return '';
  const otherIds = (channel.memberIds || []).filter((id: string) => id !== state.playerId);
  const firstNames = otherIds
    .map((id: string) => state.roster[id]?.personaName?.split(' ')[0] ?? '')
    .filter((n: string) => n.length > 0);
  if (firstNames.length <= 3) return firstNames.join(', ');
  const shown = firstNames.slice(0, 2).join(', ');
  const overflow = firstNames.length - 2;
  return `${shown} +${overflow}`;
};

// --- Vote Results (PT1-UX-005) ---

export interface VoteResultEntry {
  dayIndex: number;
  mechanism: string;
  tally: Record<string, number>;
  votes: Record<string, string>;
  eliminatedId: string | null;
  winnerId?: string | null;
  completedAt: number;
}

export const selectVoteResults = (state: GameState): VoteResultEntry[] => {
  return state.completedCartridges
    .filter(c => c.kind === 'voting')
    .map(c => ({
      dayIndex: c.snapshot.dayIndex ?? 0,
      mechanism: c.snapshot.mechanism ?? 'UNKNOWN',
      tally: c.snapshot.summary?.tallies ?? {},
      votes: c.snapshot.summary?.votes ?? c.snapshot.results?.votes ?? {},
      eliminatedId: c.snapshot.eliminatedId ?? null,
      winnerId: c.snapshot.winnerId ?? null,
      completedAt: c.completedAt,
    }));
};

// --- Game Results (PT1-UX-006) ---

export interface GameResultEntry {
  dayIndex: number;
  gameType: string;
  silverRewards: Record<string, number>;
  goldContribution: number;
  summary: Record<string, any>;
  completedAt: number;
}

export const selectGameResults = (state: GameState): GameResultEntry[] => {
  return state.completedCartridges
    .filter(c => c.kind === 'game')
    .map(c => ({
      dayIndex: c.snapshot.dayIndex ?? 0,
      gameType: c.snapshot.gameType ?? 'UNKNOWN',
      silverRewards: c.snapshot.silverRewards ?? {},
      goldContribution: c.snapshot.goldContribution ?? 0,
      summary: c.snapshot.summary ?? {},
      completedAt: c.completedAt,
    }));
};

// --- Silver Transaction History (PT1-UX-008) ---

export interface SilverTransaction {
  type: string;
  amount: number;
  description: string;
  dayIndex: number;
}

export const selectSilverHistory = (state: GameState): SilverTransaction[] => {
  const pid = state.playerId;
  if (!pid) return [];

  const history: SilverTransaction[] = [];

  // From game results
  for (const c of state.completedCartridges.filter(c => c.kind === 'game')) {
    const reward = c.snapshot.silverRewards?.[pid];
    if (reward) {
      history.push({
        type: 'GAME_REWARD',
        amount: reward,
        description: `${c.snapshot.gameType ?? 'Game'} reward`,
        dayIndex: c.snapshot.dayIndex ?? state.dayIndex,
      });
    }
  }

  // From prompt results
  for (const c of state.completedCartridges.filter(c => c.kind === 'prompt')) {
    const reward = c.snapshot.silverRewards?.[pid];
    if (reward) {
      history.push({
        type: 'PROMPT_REWARD',
        amount: reward,
        description: `${c.snapshot.promptType ?? 'Activity'} reward`,
        dayIndex: c.snapshot.dayIndex ?? state.dayIndex,
      });
    }
  }

  // From dilemma results
  for (const c of state.completedCartridges.filter(c => c.kind === 'dilemma')) {
    const reward = c.snapshot.silverRewards?.[pid];
    if (reward) {
      history.push({
        type: 'DILEMMA_REWARD',
        amount: reward,
        description: `${c.snapshot.dilemmaType ?? 'Dilemma'} reward`,
        dayIndex: c.snapshot.dayIndex ?? state.dayIndex,
      });
    }
  }

  return history;
};

// --- Day Timeline (PT1-UX-010) ---

export interface TimelineEntry {
  time: string;
  action: string;
  payload?: any;
}

export const selectDayTimeline = (state: GameState): TimelineEntry[] => {
  if (!state.manifest) return [];
  const days = state.manifest.days || [];
  const currentDay = days[state.dayIndex];
  if (!currentDay?.timeline) return [];
  return currentDay.timeline.map((event: any) => ({
    time: event.time,
    action: event.action,
    payload: event.payload,
  }));
};

// --- Player Activity (PT1-UX-009) ---

export interface PlayerActivityEntry {
  messagesInMain: number;
  dmPartners: number;
  isOnline: boolean;
}

export const selectPlayerActivity = (state: GameState): Record<string, PlayerActivityEntry> => {
  return state.playerActivity ?? {};
};

export const selectUnreadFeedCount = (state: GameState): number => {
  return state.tickerMessages.filter(m => m.timestamp > state.lastSeenFeedTimestamp).length;
};

export const selectShouldAutoOpenDashboard = (state: GameState): boolean => {
  return state.dayIndex > 0 && state.dashboardSeenForDay !== state.dayIndex;
};

// ------- Pulse Phase 1.5 selectors -------

export interface CastStripEntry {
  kind: 'self' | 'player' | 'group';
  id: string;
  player?: SocialPlayer;
  memberIds?: string[];
  priority: number;
  unreadCount: number;
  hasPendingInviteFromThem: boolean;
  hasOutgoingPendingInvite: boolean;
  isTypingToYou: boolean;
  isOnline: boolean;
  isLeader: boolean;
  /** Latest SOCIAL_NUDGE ts from this player toward me (0 if none in history). */
  lastNudgeFromThemTs: number;
  /** True when lastNudgeFromThemTs > lastSeenNudgeFrom[id] (persisted per-sender). */
  hasUnseenNudgeFromThem: boolean;
  hasUnseenSilver: boolean;
}

export const selectUnreadForChannel = (channelId: string) => (state: GameState): number => {
  const last = state.lastReadTimestamp[channelId] ?? 0;
  return state.chatLog.filter(m => m.channelId === channelId && m.timestamp > last && m.senderId !== state.playerId).length;
};

export const selectTotalDmUnread = (state: GameState): number => {
  const pid = state.playerId;
  if (!pid) return 0;
  const dmChannelIds = Object.values(state.channels)
    .filter(ch => (ch.type === ChannelTypes.DM || ch.type === ChannelTypes.GROUP_DM) && ch.memberIds.includes(pid))
    .map(ch => ch.id);
  return dmChannelIds.reduce((sum, cid) => {
    const last = state.lastReadTimestamp[cid] ?? 0;
    return sum + state.chatLog.filter(m => m.channelId === cid && m.timestamp > last && m.senderId !== pid).length;
  }, 0);
};

export const selectStandings = memoSelector(
  (s) => [s.roster],
  (state: GameState): { id: string; player: SocialPlayer; rank: number }[] => {
    return Object.entries(state.roster)
      .filter(([, p]) => p.status === 'ALIVE')
      .sort((a, b) => b[1].silver - a[1].silver || a[1].personaName.localeCompare(b[1].personaName))
      .map(([id, p], i) => ({ id, player: p, rank: i + 1 }));
  },
);

export const selectIsLeader = (playerId: string) => (state: GameState): boolean => {
  const standings = selectStandings(state);
  return standings.length > 0 && standings[0].id === playerId;
};

export const selectPendingInvitesForMe = memoSelector(
  (s) => [s.playerId, s.channels],
  (state: GameState): Channel[] => {
    const pid = state.playerId;
    if (!pid) return [];
    return Object.values(state.channels).filter(ch => (ch.pendingMemberIds || []).includes(pid));
  },
);

export const selectOutgoingInvites = memoSelector(
  (s) => [s.playerId, s.channels],
  (state: GameState): Channel[] => {
    const pid = state.playerId;
    if (!pid) return [];
    return Object.values(state.channels).filter(ch => ch.createdBy === pid && (ch.pendingMemberIds || []).length > 0);
  },
);

/**
 * Chip tap feasibility: returns 'blocked' when the player can't open a NEW
 * DM with `chipPlayerId` because slots are exhausted. Re-opening an existing
 * DM with that person never blocks (no slot consumption).
 */
/**
 * True if the current player has already nudged `targetId` within the visible
 * ticker window. Mirrors the server's per-day nudge guard so the UI can
 * disable the affordance up-front instead of waiting for a silent server drop.
 */
export const selectHaveINudged = (state: GameState, targetId: string): boolean => {
  const pid = state.playerId;
  if (!pid || pid === targetId) return false;
  for (const m of state.tickerMessages) {
    if (m.category !== TickerCategories.SOCIAL_NUDGE) continue;
    const ids = m.involvedPlayerIds;
    if (ids?.[0] === pid && ids?.[1] === targetId) return true;
  }
  return false;
};

export const selectChipSlotStatus = (state: GameState, chipPlayerId: string): 'ok' | 'blocked' => {
  const pid = state.playerId;
  if (!pid || chipPlayerId === pid) return 'ok';
  const target = state.roster[chipPlayerId];
  if (!target || target.status !== 'ALIVE') return 'ok';
  const hasExistingDm = Object.values(state.channels).some(c =>
    c.type === ChannelTypes.DM && c.memberIds.includes(pid) && c.memberIds.includes(chipPlayerId),
  );
  if (hasExistingDm) return 'ok';
  const { used, total } = selectDmSlots(state);
  return total - used > 0 ? 'ok' : 'blocked';
};

export const selectCastStripEntries = memoSelector(
  (s) => [s.playerId, s.roster, s.channels, s.chatLog, s.onlinePlayers, s.typingPlayers, s.lastReadTimestamp, s.tickerMessages, s.lastSeenNudgeFrom, s.lastSeenSilverFrom],
  (state: GameState): CastStripEntry[] => {
  const pid = state.playerId;
  if (!pid) return [];
  const leaderId = selectStandings(state)[0]?.id;

  const pendingByInviterId: Record<string, true> = {};
  for (const ch of selectPendingInvitesForMe(state)) {
    const inviterId = ch.createdBy;
    if (inviterId && inviterId !== pid) pendingByInviterId[inviterId] = true;
  }
  const outgoingPendingByRecipientId: Record<string, true> = {};
  for (const ch of selectOutgoingInvites(state)) {
    for (const rid of ch.pendingMemberIds || []) outgoingPendingByRecipientId[rid] = true;
  }

  // Latest SOCIAL_NUDGE ts per sender toward me, walking ticker history once.
  const latestNudgeBySender: Record<string, number> = {};
  for (const m of state.tickerMessages) {
    if (m.category !== TickerCategories.SOCIAL_NUDGE) continue;
    const ids = m.involvedPlayerIds;
    if (!ids || ids[1] !== pid) continue;
    const senderId = ids[0];
    if (!senderId) continue;
    const ts = typeof m.timestamp === 'number' ? m.timestamp : 0;
    if (ts > (latestNudgeBySender[senderId] ?? 0)) latestNudgeBySender[senderId] = ts;
  }

  const entries: CastStripEntry[] = [];

  const selfPlayer = state.roster[pid];
  if (selfPlayer) {
    entries.push({
      kind: 'self', id: pid, player: selfPlayer, priority: 0,
      unreadCount: 0, hasPendingInviteFromThem: false, hasOutgoingPendingInvite: false,
      isTypingToYou: false, isOnline: state.onlinePlayers.includes(pid),
      isLeader: leaderId === pid,
      lastNudgeFromThemTs: 0, hasUnseenNudgeFromThem: false,
      hasUnseenSilver: false,
    });
  }

  for (const [id, p] of Object.entries(state.roster)) {
    if (id === pid) continue;
    if (p.status !== 'ALIVE') continue;
    const oneOnOneChannel = Object.values(state.channels).find(ch =>
      ch.type === ChannelTypes.DM && ch.memberIds.includes(pid) && ch.memberIds.includes(id)
    );
    const unread = oneOnOneChannel ? selectUnreadForChannel(oneOnOneChannel.id)(state) : 0;
    const isTyping = oneOnOneChannel ? state.typingPlayers[id] === oneOnOneChannel.id : false;
    const isOnline = state.onlinePlayers.includes(id);
    const pending = !!pendingByInviterId[id];
    const outgoingPending = !!outgoingPendingByRecipientId[id];
    const lastNudgeTs = latestNudgeBySender[id] ?? 0;
    const unseenNudge = lastNudgeTs > 0 && lastNudgeTs > (state.lastSeenNudgeFrom[id] ?? 0);

    let priority: number;
    if (pending) priority = 1;
    else if (unseenNudge) priority = 1;
    else if (unread > 0) priority = 2;
    else if (isTyping) priority = 3;
    else if (isOnline) priority = 5;
    else priority = 7;

    const unseenSilver = selectSilverUnread(state, id);

    entries.push({
      kind: 'player', id, player: p, priority,
      unreadCount: unread, hasPendingInviteFromThem: pending, hasOutgoingPendingInvite: outgoingPending,
      isTypingToYou: isTyping, isOnline, isLeader: leaderId === id,
      lastNudgeFromThemTs: lastNudgeTs, hasUnseenNudgeFromThem: unseenNudge,
      hasUnseenSilver: unseenSilver,
    });
  }

  for (const ch of Object.values(state.channels)) {
    if (ch.type !== ChannelTypes.GROUP_DM) continue;
    if (!ch.memberIds.includes(pid)) continue;
    const unread = selectUnreadForChannel(ch.id)(state);
    entries.push({
      kind: 'group', id: ch.id, memberIds: ch.memberIds,
      priority: unread > 0 ? 2 : 6,
      unreadCount: unread, hasPendingInviteFromThem: false, hasOutgoingPendingInvite: false,
      isTypingToYou: false, isOnline: false, isLeader: false,
      lastNudgeFromThemTs: 0, hasUnseenNudgeFromThem: false,
      hasUnseenSilver: false,
    });
  }

  entries.sort((a, b) => {
    if (a.kind === 'self') return -1;
    if (b.kind === 'self') return 1;
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
    const an = a.player?.personaName || '';
    const bn = b.player?.personaName || '';
    return an.localeCompare(bn);
  });

  return entries;
  },
);

// ─── Pulse Phase 4 selectors ─────────────────────────────────────────────
// Guardrail: selectRevealsToReplay returns a fresh array — wrapped with
// memoSelector. Other Phase 4 selectors return primitives and are safe
// unwrapped (see .claude/guardrails/finite-zustand-selector-fresh-objects.rule).

export function selectCartridgeUnread(s: GameState, cartridgeId: string): boolean {
  const lastSeen = s.lastSeenCartridge[cartridgeId];
  const actives: any[] = [s.activeVotingCartridge, s.activeGameCartridge, s.activePromptCartridge, s.activeDilemma];
  const active = actives.find(c => c?.cartridgeId === cartridgeId);
  if (active) {
    if (lastSeen === undefined) return true;
    return (active.updatedAt ?? 0) > lastSeen;
  }
  const completed = s.completedCartridges.find(c => c.key === cartridgeId);
  if (completed) {
    if (lastSeen === undefined) return true;
    return (completed.completedAt ?? 0) > lastSeen;
  }
  return false;
}

export function selectSilverUnread(s: GameState, senderId: string): boolean {
  const lastSeen = s.lastSeenSilverFrom[senderId] ?? 0;
  const pid = s.playerId;
  if (!pid) return false;
  // Ticker convention (factToTicker): involvedPlayerIds = [actorId, targetId] for
  // SOCIAL.TRANSFER — i.e. [sender, recipient]. Both entries present means a
  // player-to-player transfer; GM-awards have only [recipient].
  return s.tickerMessages.some(m => {
    if (m.category !== 'SOCIAL.TRANSFER') return false;
    const ids = m.involvedPlayerIds ?? [];
    if (ids.length < 2) return false;
    const [sender, recipient] = ids;
    if (sender !== senderId || recipient !== pid) return false;
    const ts = typeof m.timestamp === 'number' ? m.timestamp : new Date(m.timestamp as any).getTime();
    return ts > lastSeen;
  });
}

export const selectRevealsToReplay = memoSelector(
  (s) => [s.roster, s.winner, s.revealsSeen, s.dayIndex],
  (state: GameState): Array<{kind: 'elimination' | 'winner'; dayIndex?: number}> => {
    const out: Array<{kind: 'elimination' | 'winner'; dayIndex?: number}> = [];
    for (const [, r] of Object.entries(state.roster) as Array<[string, any]>) {
      if (r.status === 'ELIMINATED') {
        const day = r.eliminatedOnDay ?? state.dayIndex;
        if (!state.revealsSeen.elimination[day]) {
          out.push({ kind: 'elimination', dayIndex: day });
        }
      }
    }
    if (state.winner && !state.revealsSeen.winner) {
      out.push({ kind: 'winner' });
    }
    return out;
  },
);

function getDmUnreadCount(s: GameState): number {
  const pid = s.playerId;
  if (!pid) return 0;
  const lrt = s.lastReadTimestamp || {};
  let count = 0;
  for (const [chId, ch] of Object.entries(s.channels) as Array<[string, any]>) {
    if (ch.type !== ChannelTypes.DM && ch.type !== ChannelTypes.GROUP_DM) continue;
    if (!ch.memberIds.includes(pid)) continue;
    const lastRead = lrt[chId] ?? 0;
    const unread = s.chatLog.filter(m =>
      m.channelId === chId &&
      m.senderId !== pid &&
      (m.timestamp ?? 0) > lastRead
    ).length;
    count += unread;
  }
  return count;
}

function getCartridgeUnreadCount(s: GameState): number {
  const ids = new Set<string>();
  for (const c of [s.activeVotingCartridge, s.activeGameCartridge, s.activePromptCartridge, s.activeDilemma] as any[]) {
    if (c?.cartridgeId) ids.add(c.cartridgeId);
  }
  for (const c of s.completedCartridges) {
    if (c.key) ids.add(c.key);
  }
  let count = 0;
  for (const id of ids) {
    if (selectCartridgeUnread(s, id)) count++;
  }
  return count;
}

function getSilverUnreadCount(s: GameState): number {
  const pid = s.playerId;
  if (!pid) return 0;
  const senders = new Set<string>();
  for (const m of s.tickerMessages) {
    if (m.category !== 'SOCIAL.TRANSFER') continue;
    const ids = m.involvedPlayerIds ?? [];
    if (ids.length < 2) continue;
    const [sender, recipient] = ids;
    if (recipient === pid && sender) senders.add(sender);
  }
  let count = 0;
  for (const id of senders) {
    if (selectSilverUnread(s, id)) count++;
  }
  return count;
}

export function selectAggregatePulseUnread(s: GameState): number {
  const inviteCount = selectPendingInvitesForMe(s).length;
  return getDmUnreadCount(s)
    + inviteCount
    + getCartridgeUnreadCount(s)
    + getSilverUnreadCount(s);
}

/**
 * Returns the unread treatment to apply to a persona's cast chip.
 * Priority: invite > dm > silver. Rationale: "wants to start talking" (invite)
 * outranks "is talking" (dm) outranks "sent you money" (silver) by social
 * salience — an unanswered invite is the strongest call to action.
 */
export function selectCastChipUnreadKind(s: GameState, personaId: string): 'dm' | 'silver' | 'invite' | null {
  const invites = selectPendingInvitesForMe(s);
  if (invites.some((ch: any) => ch.createdBy === personaId)) return 'invite';

  const pid = s.playerId;
  if (pid) {
    const lrt = s.lastReadTimestamp || {};
    for (const [chId, ch] of Object.entries(s.channels) as Array<[string, any]>) {
      if (ch.type !== ChannelTypes.DM) continue;
      if (!ch.memberIds.includes(personaId) || !ch.memberIds.includes(pid)) continue;
      const lastRead = lrt[chId] ?? 0;
      const hasUnread = s.chatLog.some(m =>
        m.channelId === chId && m.senderId === personaId && (m.timestamp ?? 0) > lastRead
      );
      if (hasUnread) return 'dm';
    }
  }
  if (selectSilverUnread(s, personaId)) return 'silver';
  return null;
}

export const useGameStore = create<GameState>((set) => ({
  gameId: null,
  dayIndex: 0,
  roster: {},
  chatLog: [],
  channels: {},
  groupChatOpen: false,
  dmsOpen: false,
  manifest: null,
  serverState: null,
  phase: DayPhases.PREGAME,
  playerId: null,
  activeVotingCartridge: null,
  activeGameCartridge: null,
  activePromptCartridge: null,
  activeDilemma: null,
  completedCartridges: [],
  winner: null,
  goldPool: 0,
  gameHistory: [],
  dmStats: null,
  onlinePlayers: [],
  typingPlayers: {},
  dmRejection: null,
  silverTransferRejection: null,
  lastPerkResult: null,
  playerActivity: {},
  confessionPhase: { active: false, myHandle: null, handleCount: 0, posts: [], closesAt: null },
  pregame: null,
  tickerMessages: [],
  debugTicker: null,
  showcaseData: null,
  splashVisible: false,
  dashboardOpen: false,
  dashboardSeenForDay: null,
  welcomeSeen: false,
  lastSeenFeedTimestamp: Number(localStorage.getItem('po-lastSeenFeed') || '0'),
  requestedTab: null,

  lastReadTimestamp: {},
  pickingMode: null,

  // Pulse Phase 4 initial state (hydrated from localStorage once gameId+playerId known)
  lastSeenCartridge: {},
  lastSeenSilverFrom: {},
  lastSeenNudgeFrom: {},
  revealsSeen: { elimination: {}, winner: false },
  pendingIntent: null,
  pendingIntentAttempts: 0,
  pendingIntentFirstReceivedAt: null,
  focusedCartridge: null,

  sync: (data) => set((state) => {
    console.log('[SYNC] Received', {
      state: data.state,
      dayIndex: data.context?.dayIndex,
      rosterSize: Object.keys(data.context?.roster || {}).length,
      chatLogSize: data.context?.chatLog?.length ?? 0,
      channels: Object.keys(data.context?.channels || {}).length,
    });
    // Map server completedPhases to client CompletedCartridge format
    const serverPhases: any[] = data.context?.completedPhases ?? [];
    const completedCartridges: CompletedCartridge[] = serverPhases.map((p: any) => {
      const kind = p.kind as 'voting' | 'game' | 'prompt' | 'dilemma';
      const typeKey = p.mechanism || p.gameType || p.promptType || p.dilemmaType || 'UNKNOWN';
      return {
        kind,
        snapshot: p,
        completedAt: p.completedAt,
        dayIndex: p.dayIndex,
        key: `${kind}-${p.dayIndex}-${typeKey}`,
      };
    });

    // Use stableRef to preserve old references when data hasn't changed.
    // This prevents cascading re-renders across the entire component tree
    // when a SYNC arrives but the player-visible data is identical.
    const nextRoster = data.context?.roster ?? state.roster;
    const nextChatLog = data.context?.chatLog?.length ? data.context.chatLog : state.chatLog;
    const nextChannels = data.context?.channels ?? state.channels;

    return {
      gameId: data.context?.gameId || state.gameId,
      dayIndex: data.context?.dayIndex || 0,
      roster: stableRef(state.roster, nextRoster),
      chatLog: stableRef(state.chatLog, nextChatLog),
      channels: stableRef(state.channels, nextChannels),
      groupChatOpen: data.context?.groupChatOpen ?? state.groupChatOpen,
      dmsOpen: data.context?.dmsOpen ?? state.dmsOpen,
      manifest: stableRef(state.manifest, data.context?.manifest || null),
      serverState: stableRef(state.serverState, data.state || null),
      phase: data.phase ?? state.phase,
      activeVotingCartridge: stableRef(state.activeVotingCartridge, data.context?.activeVotingCartridge ?? null),
      activeGameCartridge: stableRef(state.activeGameCartridge, data.context?.activeGameCartridge ?? null),
      activePromptCartridge: stableRef(state.activePromptCartridge, data.context?.activePromptCartridge ?? null),
      activeDilemma: stableRef(state.activeDilemma, data.context?.activeDilemmaCartridge ?? null),
      completedCartridges: stableRef(state.completedCartridges, completedCartridges),
      winner: stableRef(state.winner, data.context?.winner ?? null),
      goldPool: data.context?.goldPool ?? state.goldPool,
      gameHistory: stableRef(state.gameHistory, data.context?.gameHistory ?? state.gameHistory),
      dmStats: stableRef(state.dmStats, data.context?.dmStats ?? null),
      onlinePlayers: stableRef(state.onlinePlayers, data.context?.onlinePlayers ?? state.onlinePlayers),
      playerActivity: stableRef(state.playerActivity, data.context?.playerActivity ?? state.playerActivity),
      // Per-recipient confession-phase projection (T12 put it under `context`, not `l3Context`).
      // stableRef is load-bearing here: posts[] can mutate in-place server-side (reactions,
      // edits-within-window), so length equality is insufficient — rely on deep equality.
      confessionPhase: stableRef(
        state.confessionPhase,
        data.context?.confessionPhase ?? { active: false, myHandle: null, handleCount: 0, posts: [], closesAt: null },
      ),
      // Pregame slice — server only sends it during phase==='pregame'; we
      // drop to null otherwise so consumers can use it as a presence signal.
      pregame: stableRef(state.pregame, data.context?.pregame ?? null),
      welcomeSeen: localStorage.getItem(`po-welcomeSeen-${data.context?.gameId || state.gameId}`) === 'true' || state.welcomeSeen,
      showcaseData: stableRef(state.showcaseData, data.context?.showcase ?? state.showcaseData),
      // Pulse Phase 4 — hydrate seen-state maps from localStorage inline (like welcomeSeen above).
      // Only rehydrate when we have both gameId and playerId; otherwise preserve current state.
      ...hydratePhase4Maps(data.context?.gameId || state.gameId, state.playerId, state),
    };
  }),

  addChatMessage: (msg) => set((state) => ({
    chatLog: [...state.chatLog, msg]
  })),

  addTickerMessage: (msg) => set((state) => ({
    tickerMessages: [...state.tickerMessages, msg].slice(-200)
  })),

  setTickerMessages: (msgs) => set({ tickerMessages: msgs.slice(-200) }),

  setDebugTicker: (summary) => set({ debugTicker: summary }),

  setPlayerId: (id) => set({ playerId: id }),

  setDmRejection: (reason) => set({ dmRejection: { reason, timestamp: Date.now() } }),

  clearDmRejection: () => set({ dmRejection: null }),

  setSilverTransferRejection: (reason) => set({ silverTransferRejection: { reason, timestamp: Date.now() } }),
  clearSilverTransferRejection: () => set({ silverTransferRejection: null }),

  setPerkResult: (result) => set({ lastPerkResult: { ...result, timestamp: Date.now() } }),
  clearPerkResult: () => set({ lastPerkResult: null }),

  setOnlinePlayers: (players) => set({ onlinePlayers: players }),
  setTyping: (playerId, channel) => set((state) => ({
    typingPlayers: { ...state.typingPlayers, [playerId]: channel },
  })),
  clearTyping: (playerId) => set((state) => {
    const { [playerId]: _, ...rest } = state.typingPlayers;
    return { typingPlayers: rest };
  }),
  openDashboard: () => set({ dashboardOpen: true }),
  closeDashboard: () => set({ dashboardOpen: false }),
  toggleDashboard: () => set((state) => ({ dashboardOpen: !state.dashboardOpen })),
  markDashboardSeen: (dayIndex) => set({ dashboardSeenForDay: dayIndex }),
  markWelcomeSeen: () => set((state) => {
    if (state.gameId) localStorage.setItem(`po-welcomeSeen-${state.gameId}`, 'true');
    return { welcomeSeen: true };
  }),
  markFeedSeen: () => {
    const now = Date.now();
    localStorage.setItem('po-lastSeenFeed', String(now));
    set({ lastSeenFeedTimestamp: now });
  },
  requestNavigation: (tab) => set({ requestedTab: tab }),
  clearNavigation: () => set({ requestedTab: null }),
  setSplashVisible: (v) => set({ splashVisible: v }),

  hydrateLastRead: (gameId, playerId) => set(() => {
    try {
      const raw = localStorage.getItem(`po-pulse-lastRead:${gameId}:${playerId}`);
      return { lastReadTimestamp: raw ? JSON.parse(raw) : {} };
    } catch { return { lastReadTimestamp: {} }; }
  }),
  markChannelRead: (channelId) => set((state) => {
    const next = { ...state.lastReadTimestamp, [channelId]: Date.now() };
    try {
      if (state.gameId && state.playerId) {
        localStorage.setItem(`po-pulse-lastRead:${state.gameId}:${state.playerId}`, JSON.stringify(next));
      }
    } catch {}
    return { lastReadTimestamp: next };
  }),
  startPicking: () => set({ pickingMode: { kind: 'new-dm', selected: [] } }),
  startAddMember: (channelId) => set({ pickingMode: { kind: 'add-member', channelId, selected: [] } }),
  cancelPicking: () => set({ pickingMode: null }),
  togglePicked: (playerId) => set((state) => {
    if (!state.pickingMode) return {};
    const sel = state.pickingMode.selected;
    const next = sel.includes(playerId) ? sel.filter(id => id !== playerId) : [...sel, playerId];
    return { pickingMode: { ...state.pickingMode, selected: next } };
  }),

  // Pulse Phase 4 — load seen-state maps from localStorage keyed by (gameId, playerId).
  // No-op if either id is missing. Malformed JSON is swallowed so first-mount doesn't crash.
  hydratePhase4FromStorage: () => set((state) => {
    if (!state.gameId || !state.playerId) return {};
    const scope = `${state.gameId}-${state.playerId}`;
    const read = <T>(key: string, fallback: T): T => {
      try {
        const raw = localStorage.getItem(`po-${key}-${scope}`);
        return raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        return fallback;
      }
    };
    return {
      lastSeenCartridge: read('lastSeenCartridge', {}),
      lastSeenSilverFrom: read('lastSeenSilverFrom', {}),
      lastSeenNudgeFrom: read('lastSeenNudgeFrom', {}),
      revealsSeen: read('revealsSeen', { elimination: {}, winner: false }),
    };
  }),

  markCartridgeSeen: (cartridgeId) => set((state) => {
    const next = { ...state.lastSeenCartridge, [cartridgeId]: Date.now() };
    try {
      if (state.gameId && state.playerId) {
        localStorage.setItem(`po-lastSeenCartridge-${state.gameId}-${state.playerId}`, JSON.stringify(next));
      }
    } catch {}
    return { lastSeenCartridge: next };
  }),

  markSilverSeen: (senderId) => set((state) => {
    const next = { ...state.lastSeenSilverFrom, [senderId]: Date.now() };
    try {
      if (state.gameId && state.playerId) {
        localStorage.setItem(`po-lastSeenSilverFrom-${state.gameId}-${state.playerId}`, JSON.stringify(next));
      }
    } catch {}
    return { lastSeenSilverFrom: next };
  }),

  markNudgeSeen: (senderId) => set((state) => {
    const next = { ...state.lastSeenNudgeFrom, [senderId]: Date.now() };
    try {
      if (state.gameId && state.playerId) {
        localStorage.setItem(`po-lastSeenNudgeFrom-${state.gameId}-${state.playerId}`, JSON.stringify(next));
      }
    } catch {}
    return { lastSeenNudgeFrom: next };
  }),

  markRevealSeen: (kind, dayIndex) => set((state) => {
    const next = kind === 'elimination'
      ? { ...state.revealsSeen, elimination: { ...state.revealsSeen.elimination, [dayIndex as number]: true } }
      : { ...state.revealsSeen, winner: true };
    try {
      if (state.gameId && state.playerId) {
        localStorage.setItem(`po-revealsSeen-${state.gameId}-${state.playerId}`, JSON.stringify(next));
      }
    } catch {}
    return { revealsSeen: next };
  }),

  setPendingIntent: (intent) => set((state) => {
    if (intent === null) {
      return { pendingIntent: null, pendingIntentAttempts: 0, pendingIntentFirstReceivedAt: null };
    }
    return {
      pendingIntent: intent,
      pendingIntentFirstReceivedAt: state.pendingIntentFirstReceivedAt ?? Date.now(),
    };
  }),

  incrementIntentAttempts: () => set((state) => ({
    pendingIntentAttempts: state.pendingIntentAttempts + 1,
  })),

  focusCartridge: (cartridgeId, cartridgeKind, origin) => {
    set({ focusedCartridge: { cartridgeId, cartridgeKind, origin } });
  },

  unfocusCartridge: () => {
    set({ focusedCartridge: null });
  },

  forcedReveal: null,
  setForcedReveal: (reveal) => set({ forcedReveal: reveal }),
}));
