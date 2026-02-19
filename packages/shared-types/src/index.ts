import { z } from "zod";

// --- Re-export centralized constants ---
export * from './events';
export { Config } from './config';
import type { TickerCategory } from './events';

// --- Enums ---

export enum GameStatus {
  OPEN = "OPEN",
  FULL = "FULL",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
}

export enum GamePhase {
  LOBBY = "LOBBY",
  DAY_LOOP = "DAY_LOOP",
  PAUSED = "PAUSED",
}

// --- Schemas (Lobby Layer) ---

export const PlayerSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  personaId: z.string().optional(),
  bio: z.string().optional(),
  isHost: z.boolean().default(false),
  status: z.enum(["PENDING", "READY"]),
});

export const LobbyConfigSchema = z.object({
  theme: z.string().optional(),
  gameMode: z.string().default("PECKING_ORDER"),
});

export const LobbySchema = z.object({
  id: z.string(),
  hostEmail: z.string().email(),
  status: z.nativeEnum(GameStatus),
  players: z.array(PlayerSchema),
  config: LobbyConfigSchema,
});

// --- Schemas (Game Engine Layer) ---

export const TimelineEventSchema = z.object({
  time: z.string(), // "09:00" or ISO string
  action: z.enum(["START_CARTRIDGE", "INJECT_PROMPT", "START_ACTIVITY", "END_ACTIVITY", "OPEN_VOTING", "CLOSE_VOTING", "OPEN_DMS", "CLOSE_DMS", "OPEN_GROUP_CHAT", "CLOSE_GROUP_CHAT", "START_GAME", "END_GAME", "END_DAY"]),
  payload: z.any().optional(),
});

// --- Voting Types ---

export const VoteTypeSchema = z.enum([
  "EXECUTIONER", "MAJORITY", "BUBBLE", "SECOND_TO_LAST",
  "PODIUM_SACRIFICE", "SHIELD", "TRUST_PAIRS", "DUELS", "FINALS"
]);
export type VoteType = z.infer<typeof VoteTypeSchema>;

// --- Game (Minigame) Types ---

export const GameTypeSchema = z.enum([
  "TRIVIA", "REALTIME_TRIVIA",
  "GAP_RUN", "GRID_PUSH", "SEQUENCE",
  "REACTION_TIME", "COLOR_MATCH", "STACKER", "QUICK_MATH", "SIMON_SAYS", "AIM_TRAINER",
  "BET_BET_BET", "BLIND_AUCTION", "KINGS_RANSOM", "THE_SPLIT",
  "TOUCH_SCREEN",
  "NONE",
]);
export type GameType = z.infer<typeof GameTypeSchema>;

export interface GameCartridgeInput {
  gameType: GameType;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  difficulty?: number; // 0-1 scale, overrides default day-based difficulty
  mode?: 'SOLO' | 'LIVE'; // default: 'SOLO' (backward compat with existing games)
}

export type VotingPhase = "EXPLAIN" | "VOTING" | "REVEAL" | "EXECUTIONER_PICKING" | "WINNER";

export interface VoteResult {
  eliminatedId: string | null;
  winnerId?: string | null;
  mechanism: VoteType;
  summary: Record<string, any>;
}

export interface VotingCartridgeInput {
  voteType: VoteType;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
}

export const DailyManifestSchema = z.object({
  dayIndex: z.number(),
  theme: z.string(),
  voteType: VoteTypeSchema,
  gameType: GameTypeSchema.default("NONE"),
  gameMode: z.enum(["SOLO", "LIVE"]).optional(),
  timeline: z.array(TimelineEventSchema),
});

// --- Push Notification Config ---

export const PushTriggerSchema = z.enum([
  // Fact-driven
  'DM_SENT',           // targeted -> DM recipient
  'ELIMINATION',       // broadcast
  'WINNER_DECLARED',   // broadcast
  // Phase-transition
  'DAY_START',         // broadcast (morningBriefing/groupChat)
  'ACTIVITY',          // broadcast
  'VOTING',            // broadcast
  'NIGHT_SUMMARY',     // broadcast
  'DAILY_GAME',        // broadcast
]);
export type PushTrigger = z.infer<typeof PushTriggerSchema>;

export const PushConfigSchema = z.record(PushTriggerSchema, z.boolean()).default({});
export type PushConfig = z.infer<typeof PushConfigSchema>;

export const DEFAULT_PUSH_CONFIG: Record<PushTrigger, boolean> = {
  DM_SENT: true, ELIMINATION: true, WINNER_DECLARED: true,
  DAY_START: true, ACTIVITY: true, VOTING: true, NIGHT_SUMMARY: true, DAILY_GAME: true,
};

export const GameManifestSchema = z.object({
  id: z.string(),
  gameMode: z.enum(["PECKING_ORDER", "BLITZ", "DEBUG_PECKING_ORDER"]),
  days: z.array(DailyManifestSchema),
  pushConfig: PushConfigSchema.optional(),
});

export const RosterPlayerSchema = z.object({
  realUserId: z.string(), // Opaque ID (Cookie/Hash), NOT email
  personaName: z.string(),
  avatarUrl: z.string(),
  bio: z.string(),
  isAlive: z.boolean(),
  isSpectator: z.boolean(),
  silver: z.number(),
  gold: z.number(),
  destinyId: z.string(),
});

export const RosterSchema = z.record(z.string(), RosterPlayerSchema);

// --- The Handoff Payload ---

export const InitPayloadSchema = z.object({
  lobbyId: z.string(),
  inviteCode: z.string(),
  roster: RosterSchema,
  manifest: GameManifestSchema,
});

// --- Journal & Facts (Persistence) ---

export const FactSchema = z.object({
  type: z.enum(["CHAT_MSG", "SILVER_TRANSFER", "VOTE_CAST", "ELIMINATION", "DM_SENT", "POWER_USED", "PERK_USED", "GAME_RESULT", "PLAYER_GAME_RESULT", "WINNER_DECLARED", "PROMPT_RESULT"]),
  actorId: z.string(),
  targetId: z.string().optional(),
  payload: z.any().optional(), // JSON details
  timestamp: z.number()
});

export type Fact = z.infer<typeof FactSchema>;

// --- Types (Inferred) ---

export type Player = z.infer<typeof PlayerSchema>;
export type Lobby = z.infer<typeof LobbySchema>;
export type RosterPlayer = z.infer<typeof RosterPlayerSchema>;
export type Roster = z.infer<typeof RosterSchema>;
export type GameManifest = z.infer<typeof GameManifestSchema>;
export type DailyManifest = z.infer<typeof DailyManifestSchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type InitPayload = z.infer<typeof InitPayloadSchema>;

// --- Social & Chat Schemas ---

export const SocialPlayerSchema = z.object({
  id: z.string(),
  personaName: z.string(),
  avatarUrl: z.string(),
  status: z.enum(["ALIVE", "ELIMINATED"]),
  silver: z.number().int().default(0),
  gold: z.number().int().default(0),
  realUserId: z.string().optional(),
});

export const ChatMessageSchema = z.object({
  id: z.string(), // UUID
  senderId: z.string(),
  timestamp: z.number(),
  content: z.string().max(280),
  channelId: z.string(),                         // Channel-based routing
  channel: z.enum(["MAIN", "DM"]).optional(),    // DEPRECATED — kept for migration
  targetId: z.string().optional(),               // DEPRECATED — kept for migration
});

export const SocialEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SOCIAL.SEND_MSG"),
    content: z.string(),
    targetId: z.string().optional()
  }),
  z.object({
    type: z.literal("SOCIAL.SEND_SILVER"),
    amount: z.number().positive(),
    targetId: z.string()
  }),
  z.object({
    type: z.literal("SOCIAL.CREATE_CHANNEL"),
    memberIds: z.array(z.string()).min(2),  // excludes sender (injected by L1)
  })
]);

export const AdminEventSchema = z.object({
  type: z.literal("ADMIN.NEXT_STAGE")
});

export type SocialPlayer = z.infer<typeof SocialPlayerSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type SocialEvent = z.infer<typeof SocialEventSchema>;
export type AdminEvent = z.infer<typeof AdminEventSchema>;

// --- Cartridge Protocol (Minigames) ---

export type CartridgeId = "TRIVIA" | "VOTE_EXECUTIONER" | "VOTE_TRUST";

export interface CartridgeProps {
  stage: "LOBBY" | "PLAY" | "RESULT";
  payload: any; // specific to the game
  onAction: (action: any) => void;
}

// --- DM Constants (backward compat — canonical values in Config) ---

import { Config } from './config';
export const DM_MAX_PARTNERS_PER_DAY = Config.dm.maxPartnersPerDay;
export const DM_MAX_CHARS_PER_DAY = Config.dm.maxCharsPerDay;
export const DM_SILVER_COST = Config.dm.silverCost;
export const DM_MAX_GROUPS_PER_DAY = Config.dm.maxGroupsPerDay;

export type DmRejectionReason = 'DMS_CLOSED' | 'GROUP_CHAT_CLOSED' | 'PARTNER_LIMIT' | 'CHAR_LIMIT' | 'SELF_DM' | 'TARGET_ELIMINATED' | 'INSUFFICIENT_SILVER' | 'GROUP_LIMIT' | 'INVALID_MEMBERS';

// --- Channel System ---

export const ChannelTypeSchema = z.enum(['MAIN', 'DM', 'GROUP_DM', 'GAME_DM']);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

export type ChannelCapability = 'CHAT' | 'SILVER_TRANSFER' | 'GAME_ACTIONS';

export interface Channel {
  id: string;
  type: ChannelType;
  memberIds: string[];
  createdBy: string;           // playerId | 'SYSTEM' | 'GAME:{type}'
  createdAt: number;
  label?: string;
  gameType?: string;           // For GAME_DM: which game created this channel
  capabilities?: ChannelCapability[];
  constraints?: {
    exempt?: boolean;          // exempt from daily limits + open/close flags
    silverCost?: number;       // per-message cost (default: 1 for DM, 0 for MAIN/GAME_DM)
  };
}

export function dmChannelId(a: string, b: string): string {
  const sorted = [a, b].sort();
  return `dm:${sorted[0]}:${sorted[1]}`;
}

export function groupDmChannelId(memberIds: string[]): string {
  return `gdm:${[...memberIds].sort().join(':')}`;
}

export function gameDmChannelId(gameType: string, memberIds: string[]): string {
  return `game-dm:${gameType}:${[...memberIds].sort().join(':')}`;
}

export interface DmRejectedEvent {
  type: 'DM.REJECTED';
  reason: DmRejectionReason;
  senderId: string;
}

// --- Prompt (Activity Layer) Types ---

export const PromptTypeSchema = z.enum(['PLAYER_PICK', 'PREDICTION', 'WOULD_YOU_RATHER', 'HOT_TAKE', 'CONFESSION', 'GUESS_WHO']);
export type PromptType = z.infer<typeof PromptTypeSchema>;

export interface PromptCartridgeInput {
  promptType: PromptType;
  promptText: string;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  optionA?: string;
  optionB?: string;
}

// --- Perks (Economy Powers) ---

export const PerkTypeSchema = z.enum(['SPY_DMS', 'EXTRA_DM_PARTNER', 'EXTRA_DM_CHARS']);
export type PerkType = z.infer<typeof PerkTypeSchema>;

export const PERK_COSTS: Record<PerkType, number> = Config.perk.costs;

// --- Game Master ---

export const GAME_MASTER_ID: string = 'GAME_MASTER';

// --- Game History ---

export interface GameHistoryEntry {
  gameType: string;
  dayIndex: number;
  timestamp: number;
  silverRewards: Record<string, number>;
  goldContribution: number;
  summary: Record<string, any>;
}

// --- Presence ---

export interface PresenceState {
  onlinePlayers: string[];           // playerIds with active WebSocket connections
  typing: Record<string, string>;    // playerId → channel ('MAIN' | targetPlayerId for DM)
}

// --- Ticker (News Feed) ---

export interface TickerMessage {
  id: string;
  text: string;
  category: TickerCategory;
  timestamp: number;
  involvedPlayerIds?: string[];
}

// --- Per-Game Client Events ---

export type GapRunClientEvent =
  | { type: 'GAME.GAP_RUN.START' }
  | { type: 'GAME.GAP_RUN.RESULT'; distance: number; jumps: number; timeElapsed: number };

export type TriviaClientEvent =
  | { type: 'GAME.TRIVIA.START' }
  | { type: 'GAME.TRIVIA.ANSWER'; answerIndex: number };

export type RealtimeTriviaClientEvent =
  | { type: 'GAME.REALTIME_TRIVIA.ANSWER'; answerIndex: number };

export type GridPushClientEvent =
  | { type: 'GAME.GRID_PUSH.START' }
  | { type: 'GAME.GRID_PUSH.RESULT'; bankedTotal: number; longestRun: number; totalFlips: number; timeElapsed: number };

export type SequenceClientEvent =
  | { type: 'GAME.SEQUENCE.START' }
  | { type: 'GAME.SEQUENCE.RESULT'; correctRounds: number; score: number; timeElapsed: number };

export type ReactionTimeClientEvent =
  | { type: 'GAME.REACTION_TIME.START' }
  | { type: 'GAME.REACTION_TIME.RESULT'; avgReactionMs: number; roundsCompleted: number; bestReactionMs: number; timeElapsed: number };

export type ColorMatchClientEvent =
  | { type: 'GAME.COLOR_MATCH.START' }
  | { type: 'GAME.COLOR_MATCH.RESULT'; correctAnswers: number; totalRounds: number; streak: number; timeElapsed: number };

export type StackerClientEvent =
  | { type: 'GAME.STACKER.START' }
  | { type: 'GAME.STACKER.RESULT'; height: number; perfectLayers: number; timeElapsed: number };

export type QuickMathClientEvent =
  | { type: 'GAME.QUICK_MATH.START' }
  | { type: 'GAME.QUICK_MATH.RESULT'; correctAnswers: number; totalRounds: number; streak: number; timeElapsed: number };

export type SimonSaysClientEvent =
  | { type: 'GAME.SIMON_SAYS.START' }
  | { type: 'GAME.SIMON_SAYS.RESULT'; roundsCompleted: number; longestSequence: number; timeElapsed: number };

export type AimTrainerClientEvent =
  | { type: 'GAME.AIM_TRAINER.START' }
  | { type: 'GAME.AIM_TRAINER.RESULT'; targetsHit: number; totalTargets: number; score: number; timeElapsed: number };

export type BetBetBetClientEvent =
  | { type: 'GAME.BET_BET_BET.SUBMIT'; amount: number };

export type BlindAuctionClientEvent =
  | { type: 'GAME.BLIND_AUCTION.SUBMIT'; slot: number; amount: number };

export type KingsRansomClientEvent =
  | { type: 'GAME.KINGS_RANSOM.SUBMIT'; action: 'STEAL' | 'PROTECT' };

export type TouchScreenClientEvent =
  | { type: 'GAME.TOUCH_SCREEN.START' }
  | { type: 'GAME.TOUCH_SCREEN.READY' }
  | { type: 'GAME.TOUCH_SCREEN.TOUCH' }
  | { type: 'GAME.TOUCH_SCREEN.RELEASE' };

export type TheSplitClientEvent =
  | { type: 'GAME.THE_SPLIT.SUBMIT'; action: 'SPLIT' | 'STEAL' };

export type GameClientEvent =
  | GapRunClientEvent
  | TriviaClientEvent
  | RealtimeTriviaClientEvent
  | GridPushClientEvent
  | SequenceClientEvent
  | ReactionTimeClientEvent
  | ColorMatchClientEvent
  | StackerClientEvent
  | QuickMathClientEvent
  | SimonSaysClientEvent
  | AimTrainerClientEvent
  | BetBetBetClientEvent
  | BlindAuctionClientEvent
  | KingsRansomClientEvent
  | TheSplitClientEvent
  | TouchScreenClientEvent;

// --- Per-Game Projected State (what the client renders) ---

/** Projection for all arcade-type games (per-player, client-rendered, one-shot result) */
export interface ArcadeGameProjection {
  gameType: string;
  ready?: boolean;
  status: 'NOT_STARTED' | 'PLAYING' | 'COMPLETED';
  startedAt: number;
  result: Record<string, number> | null;
  silverReward: number;
  goldContribution: number;
  seed: number;
  timeLimit: number;
  difficulty: number;
}

/**
 * Renderer contract for arcade-type minigames.
 * Implement this to create a new arcade game — no XState knowledge needed.
 */
export interface ArcadeRendererProps {
  seed: number;
  difficulty: number;
  timeLimit: number;
  /** Call when the game ends. Keys are score dimensions (e.g. distance, jumps). */
  onResult: (result: Record<string, number>) => void;
}

export type GapRunProjection = ArcadeGameProjection & { gameType: 'GAP_RUN' };

export interface TriviaProjection {
  gameType: 'TRIVIA';
  ready?: boolean;
  status: 'NOT_STARTED' | 'PLAYING' | 'COMPLETED';
  currentRound: number;
  totalRounds: number;
  currentQuestion: { question: string; options: string[]; category?: string; difficulty?: string } | null;
  roundDeadline: number | null;
  lastRoundResult: {
    question: string; options: string[]; correctIndex: number;
    correct: boolean; silver: number; speedBonus: number;
    category?: string; difficulty?: string;
  } | null;
  score: number;
  correctCount: number;
  silverReward: number;
  goldContribution: number;
}

export interface RealtimeTriviaProjection {
  gameType: 'REALTIME_TRIVIA';
  ready?: boolean;
  phase: 'WAITING' | 'QUESTION' | 'RESULT' | 'SCOREBOARD';
  currentRound: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentQuestion: { question: string; options: string[]; category?: string; difficulty?: string } | null;
  roundDeadline: number | null;
  lastRoundResults: {
    correctIndex: number;
    playerResults: Record<string, { correct: boolean; silver: number; speedBonus: number }>;
  } | null;
  silverRewards?: Record<string, number>;
  goldContribution?: number;
  correctCounts?: Record<string, number>;
}

/** Projection for sync decision games (all-players-at-once, collect-then-reveal) */
export interface SyncDecisionProjection {
  gameType: string;
  phase: 'COLLECTING' | 'ROUND_REVEAL' | 'REVEAL';
  eligiblePlayers: string[];
  submitted: Record<string, boolean>;
  /** Only present during COLLECTING — the current player's own decision */
  myDecision?: Record<string, any> | null;
  /** Only present during REVEAL — all players' decisions */
  decisions?: Record<string, any>;
  /** Only present during REVEAL */
  results: {
    silverRewards: Record<string, number>;
    goldContribution: number;
    shieldWinnerId?: string | null;
    summary: Record<string, any>;
  } | null;
  /** Multi-round fields (optional, present when rounds config is used) */
  currentRound?: number;
  totalRounds?: number;
  roundResults?: Array<{ silverRewards: Record<string, number>; goldContribution: number; summary: Record<string, any> }>;
  /** Game-specific extra fields (e.g. prizes, kingId, vaultAmount) */
  [key: string]: any;
}

/** Projection for live/simultaneous games (mode-driven, broadcast state) */
export interface LiveGameProjection {
  gameType: string;
  mode: 'SOLO' | 'LIVE';
  phase: string;
  eligiblePlayers: string[];
  readyPlayers: string[];
  countdownStartedAt: number | null;
  playStartedAt: number | null;
  results: {
    silverRewards: Record<string, number>;
    goldContribution: number;
    shieldWinnerId?: string | null;
    summary: Record<string, any>;
  } | null;
  [key: string]: any; // game-specific fields (holdStates, etc.)
}

export type GameProjection = ArcadeGameProjection | TriviaProjection | RealtimeTriviaProjection | SyncDecisionProjection | LiveGameProjection;

// --- FRIENDLY ALIASES for Zod enum values ---

export const GameTypes = GameTypeSchema.enum;
export const VoteTypes = VoteTypeSchema.enum;
export const PromptTypes = PromptTypeSchema.enum;
export const ChannelTypes = ChannelTypeSchema.enum;
export const PerkTypes = PerkTypeSchema.enum;