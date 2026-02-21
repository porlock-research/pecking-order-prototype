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
    PLAYER_JOINED: 'SYSTEM.PLAYER_JOINED',
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
  Economy: {
    PREFIX: 'ECONOMY.',
    CREDIT_SILVER: 'ECONOMY.CREDIT_SILVER',
    CONTRIBUTE_GOLD: 'ECONOMY.CONTRIBUTE_GOLD',
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
  ROUND_REVEAL: 'ROUND_REVEAL',
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
  PHASE_DAY_START: 'PHASE.DAY_START',
  PHASE_NIGHT: 'PHASE.NIGHT',
  PHASE_GAME_OVER: 'PHASE.GAME_OVER',
  PHASE_WINNER: 'PHASE.WINNER',
  GATE_CHAT_OPEN: 'GATE.CHAT_OPEN',
  GATE_CHAT_CLOSE: 'GATE.CHAT_CLOSE',
  GATE_DMS_OPEN: 'GATE.DMS_OPEN',
  GATE_DMS_CLOSE: 'GATE.DMS_CLOSE',
  VOTE: 'VOTE',
  GAME: 'GAME',
  GAME_REWARD: 'GAME.REWARD',
  SOCIAL_TRANSFER: 'SOCIAL.TRANSFER',
  SOCIAL_PERK: 'SOCIAL.PERK',
  ACTIVITY: 'ACTIVITY',
  ELIMINATION: 'ELIMINATION',
  GOLD_POOL: 'GOLD.POOL',
} as const;

export type TickerCategory = typeof TickerCategories[keyof typeof TickerCategories];

// --- VOTE EVENT CONSTANTS ---

export const VoteEvents = {
  MAJORITY:         { CAST: 'VOTE.MAJORITY.CAST' },
  EXECUTIONER:      { ELECT: 'VOTE.EXECUTIONER.ELECT', PICK: 'VOTE.EXECUTIONER.PICK' },
  BUBBLE:           { CAST: 'VOTE.BUBBLE.CAST' },
  PODIUM_SACRIFICE: { CAST: 'VOTE.PODIUM_SACRIFICE.CAST' },
  SECOND_TO_LAST:   {},  // no client events (display-only)
  SHIELD:           { SAVE: 'VOTE.SHIELD.SAVE' },
  TRUST_PAIRS:      { TRUST: 'VOTE.TRUST_PAIRS.TRUST', ELIMINATE: 'VOTE.TRUST_PAIRS.ELIMINATE' },
  FINALS:           { CAST: 'VOTE.FINALS.CAST' },
} as const;

// --- ACTIVITY EVENT CONSTANTS ---

export const ActivityEvents = {
  PROMPT:     { SUBMIT: 'ACTIVITY.PROMPT.SUBMIT' },
  WYR:        { CHOOSE: 'ACTIVITY.WYR.CHOOSE' },
  HOTTAKE:    { RESPOND: 'ACTIVITY.HOTTAKE.RESPOND' },
  CONFESSION: { SUBMIT: 'ACTIVITY.CONFESSION.SUBMIT', VOTE: 'ACTIVITY.CONFESSION.VOTE' },
  GUESSWHO:   { ANSWER: 'ACTIVITY.GUESSWHO.ANSWER', GUESS: 'ACTIVITY.GUESSWHO.GUESS' },
} as const;

// --- GAME-SPECIFIC EVENT CONSTANTS (non-generic games only) ---

export const TriviaEvents = {
  START: 'GAME.TRIVIA.START',
  ANSWER: 'GAME.TRIVIA.ANSWER',
} as const;

export const RealtimeTriviaEvents = {
  ANSWER: 'GAME.REALTIME_TRIVIA.ANSWER',
} as const;

export const TouchScreenEvents = {
  START: 'GAME.TOUCH_SCREEN.START',
  READY: 'GAME.TOUCH_SCREEN.READY',
  TOUCH: 'GAME.TOUCH_SCREEN.TOUCH',
  RELEASE: 'GAME.TOUCH_SCREEN.RELEASE',
} as const;

// --- ALLOWED CLIENT EVENTS (for L1 allowlist) ---

export const ALLOWED_CLIENT_EVENTS = [
  Events.Social.SEND_MSG,
  Events.Social.SEND_SILVER,
  Events.Social.USE_PERK,
  Events.Social.CREATE_CHANNEL,
] as const;
