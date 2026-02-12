import { create } from 'zustand';
import { SocialPlayer, ChatMessage, DmRejectionReason, TickerMessage } from '@pecking-order/shared-types';

interface DmThread {
  partnerId: string;
  messages: ChatMessage[];
  lastTimestamp: number;
}

interface GameState {
  gameId: string | null;
  dayIndex: number;
  roster: Record<string, SocialPlayer>;
  chatLog: ChatMessage[];
  manifest: any;
  serverState: string | null;
  playerId: string | null;
  activeVotingCartridge: any | null;
  activeGameCartridge: any | null;
  winner: { playerId: string; mechanism: string; summary: Record<string, any> } | null;
  dmRejection: { reason: DmRejectionReason; timestamp: number } | null;
  tickerMessages: TickerMessage[];
  debugTicker: string | null;

  // Actions
  sync: (data: any) => void;
  addChatMessage: (msg: ChatMessage) => void;
  addTickerMessage: (msg: TickerMessage) => void;
  setTickerMessages: (msgs: TickerMessage[]) => void;
  setDebugTicker: (summary: string) => void;
  setPlayerId: (id: string) => void;
  setDmRejection: (reason: DmRejectionReason) => void;
  clearDmRejection: () => void;
}

// Selectors
export const selectMainChat = (state: GameState): ChatMessage[] =>
  state.chatLog.filter(m => m.channel === 'MAIN');

export const selectDmThreads = (state: GameState): DmThread[] => {
  const pid = state.playerId;
  if (!pid) return [];
  const dmMessages = state.chatLog.filter(m => m.channel === 'DM');
  const threadMap = new Map<string, ChatMessage[]>();

  for (const msg of dmMessages) {
    const partnerId = msg.senderId === pid ? msg.targetId! : msg.senderId;
    const existing = threadMap.get(partnerId) || [];
    existing.push(msg);
    threadMap.set(partnerId, existing);
  }

  return Array.from(threadMap.entries())
    .map(([partnerId, messages]) => ({
      partnerId,
      messages: messages.sort((a, b) => a.timestamp - b.timestamp),
      lastTimestamp: messages[messages.length - 1].timestamp,
    }))
    .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
};

export const useGameStore = create<GameState>((set) => ({
  gameId: null,
  dayIndex: 0,
  roster: {},
  chatLog: [],
  manifest: null,
  serverState: null,
  playerId: null,
  activeVotingCartridge: null,
  activeGameCartridge: null,
  winner: null,
  dmRejection: null,
  tickerMessages: [],
  debugTicker: null,

  sync: (data) => set((state) => ({
    gameId: data.context?.gameId || state.gameId,
    dayIndex: data.context?.dayIndex || 0,
    roster: data.context?.roster || {},
    // Server is authoritative, but never wipe a populated chatLog with an empty one
    // (protects against stale syncs from unrelated L2 state changes)
    chatLog: data.context?.chatLog?.length ? data.context.chatLog : state.chatLog,
    manifest: data.context?.manifest || null,
    serverState: data.state || null,
    activeVotingCartridge: data.context?.activeVotingCartridge ?? null,
    activeGameCartridge: data.context?.activeGameCartridge ?? null,
    winner: data.context?.winner ?? null,
  })),

  addChatMessage: (msg) => set((state) => ({
    chatLog: [...state.chatLog, msg]
  })),

  addTickerMessage: (msg) => set((state) => ({
    tickerMessages: [...state.tickerMessages, msg].slice(-20)
  })),

  setTickerMessages: (msgs) => set({ tickerMessages: msgs.slice(-20) }),

  setDebugTicker: (summary) => set({ debugTicker: summary }),

  setPlayerId: (id) => set({ playerId: id }),

  setDmRejection: (reason) => set({ dmRejection: { reason, timestamp: Date.now() } }),

  clearDmRejection: () => set({ dmRejection: null }),
}));
