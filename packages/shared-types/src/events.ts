/**
 * Centralized string literal constants for event types, fact types,
 * phase strings, and related identifiers. Single source of truth —
 * all consumers import from here instead of using raw strings.
 *
 * Design: `as const` objects (not TS enums) for tree-shaking + Zod compat.
 */

// --- EVENT TYPE CONSTANTS ---

export const Events = {
  System: {
    SYNC: 'SYSTEM.SYNC',
    INIT: 'SYSTEM.INIT',
    WAKEUP: 'SYSTEM.WAKEUP',
    PAUSE: 'SYSTEM.PAUSE',
  },
  Admin: {
    NEXT_STAGE: 'ADMIN.NEXT_STAGE',
    INJECT_TIMELINE_EVENT: 'ADMIN.INJECT_TIMELINE_EVENT',
  },
  Social: {
    SEND_MSG: 'SOCIAL.SEND_MSG',
    SEND_SILVER: 'SOCIAL.SEND_SILVER',
    USE_PERK: 'SOCIAL.USE_PERK',
    CREATE_CHANNEL: 'SOCIAL.CREATE_CHANNEL',
  },
  Internal: {
    READY: 'INTERNAL.READY',
    END_DAY: 'INTERNAL.END_DAY',
    START_CARTRIDGE: 'INTERNAL.START_CARTRIDGE',
    OPEN_VOTING: 'INTERNAL.OPEN_VOTING',
    CLOSE_VOTING: 'INTERNAL.CLOSE_VOTING',
    OPEN_DMS: 'INTERNAL.OPEN_DMS',
    CLOSE_DMS: 'INTERNAL.CLOSE_DMS',
    OPEN_GROUP_CHAT: 'INTERNAL.OPEN_GROUP_CHAT',
    CLOSE_GROUP_CHAT: 'INTERNAL.CLOSE_GROUP_CHAT',
    INJECT_PROMPT: 'INTERNAL.INJECT_PROMPT',
    START_GAME: 'INTERNAL.START_GAME',
    END_GAME: 'INTERNAL.END_GAME',
    START_ACTIVITY: 'INTERNAL.START_ACTIVITY',
    END_ACTIVITY: 'INTERNAL.END_ACTIVITY',
  },
  Cartridge: {
    VOTE_RESULT: 'CARTRIDGE.VOTE_RESULT',
    GAME_RESULT: 'CARTRIDGE.GAME_RESULT',
    PLAYER_GAME_RESULT: 'CARTRIDGE.PLAYER_GAME_RESULT',
    PROMPT_RESULT: 'CARTRIDGE.PROMPT_RESULT',
  },
  Fact: { RECORD: 'FACT.RECORD' },
  Presence: {
    UPDATE: 'PRESENCE.UPDATE',
    TYPING: 'PRESENCE.TYPING',
    STOP_TYPING: 'PRESENCE.STOP_TYPING',
  },
  Ticker: {
    UPDATE: 'TICKER.UPDATE',
    HISTORY: 'TICKER.HISTORY',
    DEBUG: 'TICKER.DEBUG',
  },
  Rejection: {
    DM: 'DM.REJECTED',
    SILVER_TRANSFER: 'SILVER_TRANSFER.REJECTED',
    CHANNEL: 'CHANNEL.REJECTED',
    PERK: 'PERK.REJECTED',
  },
  Perk: { RESULT: 'PERK.RESULT' },
  GameChannel: {
    CREATE: 'GAME.CHANNEL.CREATE',
    DESTROY: 'GAME.CHANNEL.DESTROY',
  },
  // Dynamic event helpers + namespace prefixes
  Vote: {
    PREFIX: 'VOTE.',
    event: (mechanism: string, action: string) => `VOTE.${mechanism}.${action}`,
  },
  Game: {
    PREFIX: 'GAME.',
    CHANNEL_PREFIX: 'GAME.CHANNEL.',
    start: (gameType: string) => `GAME.${gameType}.START`,
    result: (gameType: string) => `GAME.${gameType}.RESULT`,
    event: (gameType: string, action: string) => `GAME.${gameType}.${action}`,
  },
  Activity: {
    PREFIX: 'ACTIVITY.',
    event: (promptType: string, action: string) => `ACTIVITY.${promptType}.${action}`,
  },
} as const;

// --- FACT TYPE CONSTANTS ---

export const FactTypes = {
  CHAT_MSG: 'CHAT_MSG',
  SILVER_TRANSFER: 'SILVER_TRANSFER',
  VOTE_CAST: 'VOTE_CAST',
  ELIMINATION: 'ELIMINATION',
  DM_SENT: 'DM_SENT',
  POWER_USED: 'POWER_USED',
  PERK_USED: 'PERK_USED',
  GAME_RESULT: 'GAME_RESULT',
  PLAYER_GAME_RESULT: 'PLAYER_GAME_RESULT',
  WINNER_DECLARED: 'WINNER_DECLARED',
  PROMPT_RESULT: 'PROMPT_RESULT',
  GAME_ROUND: 'GAME_ROUND',
  GAME_DECISION: 'GAME_DECISION',
  ALL_SUBMITTED: 'ALL_SUBMITTED',
} as const;

// --- PHASE CONSTANTS ---

export const VotingPhases = {
  EXPLAIN: 'EXPLAIN',
  VOTING: 'VOTING',
  REVEAL: 'REVEAL',
  EXECUTIONER_PICKING: 'EXECUTIONER_PICKING',
  WINNER: 'WINNER',
} as const;

export const ArcadePhases = {
  NOT_STARTED: 'NOT_STARTED',
  PLAYING: 'PLAYING',
  COMPLETED: 'COMPLETED',
} as const;

export const PromptPhases = {
  ACTIVE: 'ACTIVE',
  RESULTS: 'RESULTS',
  COLLECTING: 'COLLECTING',
  VOTING: 'VOTING',
  ANSWERING: 'ANSWERING',
  GUESSING: 'GUESSING',
} as const;

export const SyncDecisionPhases = {
  COLLECTING: 'COLLECTING',
  REVEAL: 'REVEAL',
} as const;

export const LiveGamePhases = {
  INIT: 'INIT',
  WAITING_FOR_START: 'WAITING_FOR_START',
  READY: 'READY',
  COUNTDOWN: 'COUNTDOWN',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
} as const;

export const RealtimeTriviaPhases = {
  WAITING: 'WAITING',
  QUESTION: 'QUESTION',
  RESULT: 'RESULT',
  SCOREBOARD: 'SCOREBOARD',
} as const;

export const PlayerStatuses = {
  ALIVE: 'ALIVE',
  ELIMINATED: 'ELIMINATED',
} as const;

export const TickerCategories = {
  SOCIAL: 'SOCIAL',
  GAME: 'GAME',
  VOTE: 'VOTE',
  ELIMINATION: 'ELIMINATION',
  SYSTEM: 'SYSTEM',
} as const;

// --- ALLOWED CLIENT EVENTS (for L1 allowlist) ---

export const ALLOWED_CLIENT_EVENTS = [
  Events.Social.SEND_MSG,
  Events.Social.SEND_SILVER,
  Events.Social.USE_PERK,
  Events.Social.CREATE_CHANNEL,
] as const;
