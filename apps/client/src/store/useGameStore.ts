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
  activeCartridge: any | null;
  activeGameCartridge: any | null;
  dmRejection: { reason: DmRejectionReason; timestamp: number } | null;
  tickerMessages: TickerMessage[];

  // Actions
  sync: (data: any) => void;
  addChatMessage: (msg: ChatMessage) => void;
  addTickerMessage: (msg: TickerMessage) => void;
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
  activeCartridge: null,
  activeGameCartridge: null,
  dmRejection: null,
  tickerMessages: [],

  sync: (data) => set((state) => ({
    gameId: data.context?.gameId || state.gameId,
    dayIndex: data.context?.dayIndex || 0,
    roster: data.context?.roster || {},
    // Server is authoritative, but never wipe a populated chatLog with an empty one
    // (protects against stale syncs from unrelated L2 state changes)
    chatLog: data.context?.chatLog?.length ? data.context.chatLog : state.chatLog,
    manifest: data.context?.manifest || null,
    serverState: data.state || null,
    activeCartridge: data.context?.activeCartridge ?? null,
    activeGameCartridge: data.context?.activeGameCartridge ?? null,
  })),

  addChatMessage: (msg) => set((state) => ({
    chatLog: [...state.chatLog, msg]
  })),

  addTickerMessage: (msg) => set((state) => ({
    tickerMessages: [...state.tickerMessages, msg].slice(-20)
  })),

  setPlayerId: (id) => set({ playerId: id }),

  setDmRejection: (reason) => set({ dmRejection: { reason, timestamp: Date.now() } }),

  clearDmRejection: () => set({ dmRejection: null }),
}));
