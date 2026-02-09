import { create } from 'zustand';
import { SocialPlayer, ChatMessage } from '@pecking-order/shared-types';

interface GameState {
  gameId: string | null;
  dayIndex: number;
  roster: Record<string, SocialPlayer>;
  chatLog: ChatMessage[];
  manifest: any; // Add manifest
  serverState: string | null;
  playerId: string | null;
  
  // Actions
  sync: (data: any) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setPlayerId: (id: string) => void;
}

export const useGameStore = create<GameState>((set) => ({
  gameId: null,
  dayIndex: 0,
  roster: {},
  chatLog: [],
  manifest: null,
  serverState: null,
  playerId: null,

  sync: (data) => set((state) => ({
    gameId: data.context?.gameId || state.gameId,
    dayIndex: data.context?.dayIndex || 0,
    roster: data.context?.roster || {},
    // Server is authoritative, but never wipe a populated chatLog with an empty one
    // (protects against stale syncs from unrelated L2 state changes)
    chatLog: data.context?.chatLog?.length ? data.context.chatLog : state.chatLog,
    manifest: data.context?.manifest || null,
    serverState: data.state || null,
  })),

  addChatMessage: (msg) => set((state) => ({
    chatLog: [...state.chatLog, msg]
  })),

  setPlayerId: (id) => set({ playerId: id }),
}));
