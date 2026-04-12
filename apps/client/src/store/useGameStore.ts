import { create } from 'zustand';
import { SocialPlayer, ChatMessage, DmRejectionReason, TickerMessage, PerkType, GameHistoryEntry, Channel, ChannelTypes, DayPhases } from '@pecking-order/shared-types';
import type { DayPhase } from '@pecking-order/shared-types';

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
}

// Selectors
export const selectMainChat = (state: GameState): ChatMessage[] =>
  state.chatLog.filter(m => m.channelId === 'MAIN' || (!m.channelId && m.channel === 'MAIN'));

export const selectDmThreads = (state: GameState): DmThread[] => {
  const pid = state.playerId;
  if (!pid) return [];

  // Channel-based: derive threads from DM + GROUP_DM channels
  const dmChannels = Object.values(state.channels).filter(
    ch => (ch.type === ChannelTypes.DM || ch.type === ChannelTypes.GROUP_DM) && ch.memberIds.includes(pid)
  );

  return dmChannels.map(ch => {
    const isGroup = ch.type === ChannelTypes.GROUP_DM;
    const partnerId = isGroup
      ? ch.id  // For groups, use channelId as the thread key
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
  // Group threads appear even if empty (just created); 1-to-1 only if messages exist
  .filter(t => t.isGroup || t.messages.length > 0)
  .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
};

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

export const selectDmSlots = (state: GameState): { used: number; total: number } => {
  if (!state.manifest?.days) return { used: 0, total: 5 };
  const currentDay = state.manifest.days[state.dayIndex - 1];
  const total = currentDay?.dmSlotsPerPlayer ?? 5;
  const used = state.dmStats?.slotsUsed ?? 0;
  return { used, total };
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
  tickerMessages: [],
  debugTicker: null,
  showcaseData: null,
  splashVisible: false,
  dashboardOpen: false,
  dashboardSeenForDay: null,
  welcomeSeen: false,
  lastSeenFeedTimestamp: Number(localStorage.getItem('po-lastSeenFeed') || '0'),
  requestedTab: null,

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
        key: `${kind}-${p.dayIndex}-${typeKey}`,
      };
    });

    // Use stableRef to preserve old references when data hasn't changed.
    // This prevents cascading re-renders across the entire component tree
    // when a SYNC arrives but the player-visible data is identical.
    const nextRoster = data.context?.roster || {};
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
      welcomeSeen: localStorage.getItem(`po-welcomeSeen-${data.context?.gameId || state.gameId}`) === 'true' || state.welcomeSeen,
      showcaseData: stableRef(state.showcaseData, data.context?.showcase ?? state.showcaseData),
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
}));
