import { z } from "zod";

// --- Re-export centralized constants ---
export * from './events';
export { Config } from './config';
export { generateCycleDefaults, isLiveGame } from './cycle-defaults';
export type { CycleDayDefaults } from './cycle-defaults';
export { ECONOMY_INFO } from './economy-info';
export { VOTE_TYPE_INFO } from './vote-type-info';
export type { VoteTypeUiInfo } from './vote-type-info';
export { DILEMMA_TYPE_INFO } from './dilemma-type-info';
export type { DilemmaTypeInfo } from './dilemma-type-info';
export { GAME_TYPE_INFO } from './game-type-info';
export type { GameTypeInfo } from './game-type-info';
export { CARTRIDGE_INFO } from './cartridge-info';
export type { CartridgeInfoEntry } from './cartridge-info';
export { ACTIVITY_TYPE_INFO } from './activity-type-info';
export type { ActivityTypeInfo } from './activity-type-info';
export { ACTION_INFO, renderActionInfo } from './action-info';
export type { ActionInfo } from './action-info';
export { WELCOME_MESSAGES } from './welcome-content';
export { buildPhaseInfo } from './phase-info';
export type { PhaseInfo } from './phase-info';
export { buildDayBriefingMessages } from './gm-briefings';
export { getChannelHints } from './channel-hints';
export type { CartridgeKind, DeepLinkIntent } from './push';
export { DilemmaTypeSchema, type DilemmaType, type DilemmaCartridgeInput, type DilemmaOutput } from './dilemma-types';
import { DilemmaTypeSchema } from './dilemma-types';
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
  action: z.enum(["START_CARTRIDGE", "INJECT_PROMPT", "START_ACTIVITY", "END_ACTIVITY", "OPEN_VOTING", "CLOSE_VOTING", "OPEN_DMS", "CLOSE_DMS", "OPEN_GROUP_CHAT", "CLOSE_GROUP_CHAT", "START_GAME", "END_GAME", "START_DILEMMA", "END_DILEMMA", "END_DAY"]),
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
  "SHOCKWAVE", "ORBIT", "BEAT_DROP",
  "INFLATE", "SNAKE", "FLAPPY", "COLOR_SORT",
  "BLINK", "RECALL",
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

// --- Prompt (Activity) Types (moved here for use in manifest + ruleset schemas) ---

export const PromptTypeSchema = z.enum(['PLAYER_PICK', 'PREDICTION', 'WOULD_YOU_RATHER', 'HOT_TAKE', 'CONFESSION', 'GUESS_WHO']);
export type PromptType = z.infer<typeof PromptTypeSchema>;

export const DailyManifestSchema = z.object({
  dayIndex: z.number(),
  theme: z.string(),
  voteType: VoteTypeSchema,
  gameType: GameTypeSchema.default("NONE"),
  gameMode: z.enum(["SOLO", "LIVE"]).optional(),
  activityType: PromptTypeSchema.or(z.literal('NONE')).optional(),
  dilemmaType: DilemmaTypeSchema.or(z.literal('NONE')).optional(),
  timeline: z.array(TimelineEventSchema),
  nextDayStart: z.string().optional(), // ISO 8601 — when the following day begins (undefined on last day)
  // Optional social parameters — director-resolved or lobby-configured
  dmCharsPerPlayer: z.number().optional(),
  dmPartnersPerPlayer: z.number().optional(),
  requireDmInvite: z.boolean().optional(),
  dmSlotsPerPlayer: z.number().optional(),
});
export type DailyManifest = z.infer<typeof DailyManifestSchema>;

// --- Push Notification Config ---

export const PushTriggerSchema = z.enum([
  // Fact-driven
  'DM_SENT',           // targeted -> DM recipient
  'ELIMINATION',       // broadcast
  'WINNER_DECLARED',   // broadcast
  'GROUP_CHAT_MSG',    // broadcast (main channel messages)
  // Phase-transition
  'DAY_START',         // broadcast (morningBriefing/groupChat)
  'ACTIVITY',          // broadcast
  'VOTING',            // broadcast
  'NIGHT_SUMMARY',     // broadcast
  'DAILY_GAME',        // broadcast
  // Gate events
  'OPEN_DMS',          // broadcast
  'CLOSE_DMS',         // broadcast
  'OPEN_GROUP_CHAT',   // broadcast
  'CLOSE_GROUP_CHAT',  // broadcast
  // Cartridge lifecycle
  'START_GAME',        // broadcast
  'END_GAME',          // broadcast
  'START_ACTIVITY',    // broadcast
  'END_ACTIVITY',      // broadcast
]);
export type PushTrigger = z.infer<typeof PushTriggerSchema>;

export const PushConfigSchema = z.record(PushTriggerSchema, z.boolean()).default({});
export type PushConfig = z.infer<typeof PushConfigSchema>;

export const DEFAULT_PUSH_CONFIG: Record<PushTrigger, boolean> = {
  DM_SENT: true, ELIMINATION: true, WINNER_DECLARED: true, GROUP_CHAT_MSG: true,
  DAY_START: true, ACTIVITY: true, VOTING: true, NIGHT_SUMMARY: true, DAILY_GAME: true,
  OPEN_DMS: true, CLOSE_DMS: true, OPEN_GROUP_CHAT: true, CLOSE_GROUP_CHAT: true,
  START_GAME: true, END_GAME: true, START_ACTIVITY: true, END_ACTIVITY: true,
};

// --- Scheduling Strategy (orthogonal to game type) ---

export const SchedulingStrategySchema = z.enum(['ADMIN', 'PRE_SCHEDULED']);
export type SchedulingStrategy = z.infer<typeof SchedulingStrategySchema>;

/**
 * Derive scheduling strategy from a manifest, handling both new (`scheduling`)
 * and legacy (`gameMode`) fields. Safe to call with null/undefined.
 */
export function resolveScheduling(
  manifest: { scheduling?: string; gameMode?: string } | null | undefined
): SchedulingStrategy {
  if (!manifest) return 'PRE_SCHEDULED';
  if (manifest.scheduling === 'ADMIN' || manifest.scheduling === 'PRE_SCHEDULED') return manifest.scheduling;
  if (manifest.gameMode === 'DEBUG_PECKING_ORDER') return 'ADMIN';
  return 'PRE_SCHEDULED';
}

// --- Schedule Presets (lobby-side templates for timeline timestamps) ---

export const SchedulePresetSchema = z.enum(['DEFAULT', 'COMPACT', 'SPEED_RUN', 'SMOKE_TEST', 'PLAYTEST', 'PLAYTEST_SHORT']);
export type SchedulePreset = z.infer<typeof SchedulePresetSchema>;

// --- Scaling Mode (for social rules in dynamic manifests) ---

export const ScalingModeSchema = z.enum(['FIXED', 'PER_ACTIVE_PLAYER', 'DIMINISHING']);
export type ScalingMode = z.infer<typeof ScalingModeSchema>;

// --- Pecking Order Ruleset Sub-Configs ---

export const PeckingOrderVotingRulesSchema = z.object({
  mode: z.enum(['SEQUENCE', 'POOL']).optional(),
  sequence: z.array(VoteTypeSchema).optional(),
  pool: z.array(VoteTypeSchema).optional(),
  allowed: z.array(VoteTypeSchema).optional(),
  constraints: z.array(z.object({
    voteType: VoteTypeSchema,
    minPlayers: z.number(),
  })).optional(),
});
export type PeckingOrderVotingRules = z.infer<typeof PeckingOrderVotingRulesSchema>;

export const PeckingOrderGameRulesSchema = z.object({
  mode: z.enum(['SEQUENCE', 'POOL', 'NONE']).optional(),
  sequence: z.array(GameTypeSchema).optional(),
  pool: z.array(GameTypeSchema).optional(),
  allowed: z.array(GameTypeSchema).optional(),
  avoidRepeat: z.boolean().default(true),
});
export type PeckingOrderGameRules = z.infer<typeof PeckingOrderGameRulesSchema>;

export const PeckingOrderActivityRulesSchema = z.object({
  mode: z.enum(['SEQUENCE', 'POOL', 'NONE']).optional(),
  sequence: z.array(PromptTypeSchema).optional(),
  pool: z.array(PromptTypeSchema).optional(),
  allowed: z.array(PromptTypeSchema).optional(),
  avoidRepeat: z.boolean().default(true),
});
export type PeckingOrderActivityRules = z.infer<typeof PeckingOrderActivityRulesSchema>;

export const PeckingOrderSocialRulesSchema = z.object({
  dmChars: z.object({ mode: ScalingModeSchema, base: z.number(), floor: z.number().optional() }),
  dmPartners: z.object({ mode: ScalingModeSchema, base: z.number(), floor: z.number().optional() }),
  dmCost: z.number(),
  groupDmEnabled: z.boolean(),
  requireDmInvite: z.boolean().default(false),
  dmSlotsPerPlayer: z.number().min(1).max(20).default(5),
});
export type PeckingOrderSocialRules = z.infer<typeof PeckingOrderSocialRulesSchema>;

export const PeckingOrderInactivityRulesSchema = z.object({
  enabled: z.boolean(),
  thresholdDays: z.number(),
  socketInactivityHours: z.number().optional(),
  action: z.enum(['ELIMINATE', 'NUDGE_THEN_ELIMINATE']),
  nudgeDays: z.number().optional(),
});
export type PeckingOrderInactivityRules = z.infer<typeof PeckingOrderInactivityRulesSchema>;

export const PeckingOrderDayCountRulesSchema = z.object({
  mode: z.enum(['ACTIVE_PLAYERS_MINUS_ONE', 'FIXED']),
  fixedCount: z.number().optional(),
  maxDays: z.number().optional(),
});
export type PeckingOrderDayCountRules = z.infer<typeof PeckingOrderDayCountRulesSchema>;

// --- GameRuleset (discriminated union — one variant per game type) ---

export const PeckingOrderDilemmaRulesSchema = z.object({
  mode: z.enum(['SEQUENCE', 'POOL', 'NONE']),
  sequence: z.array(DilemmaTypeSchema).optional(),
  pool: z.array(DilemmaTypeSchema).optional(),
  allowed: z.array(DilemmaTypeSchema).optional(),
  avoidRepeat: z.boolean().default(true),
});
export type PeckingOrderDilemmaRules = z.infer<typeof PeckingOrderDilemmaRulesSchema>;

export const PeckingOrderRulesetSchema = z.object({
  kind: z.literal('PECKING_ORDER'),
  voting: PeckingOrderVotingRulesSchema,
  games: PeckingOrderGameRulesSchema,
  activities: PeckingOrderActivityRulesSchema,
  social: PeckingOrderSocialRulesSchema,
  inactivity: PeckingOrderInactivityRulesSchema,
  dayCount: PeckingOrderDayCountRulesSchema,
  dilemmas: PeckingOrderDilemmaRulesSchema.optional(),
});
export type PeckingOrderRuleset = z.infer<typeof PeckingOrderRulesetSchema>;

export const GameRulesetSchema = z.discriminatedUnion('kind', [
  PeckingOrderRulesetSchema,
]);
export type GameRuleset = z.infer<typeof GameRulesetSchema>;

// --- Manifest Discriminated Union ---

const ManifestKindSchema = z.enum(['STATIC', 'DYNAMIC']);
export type ManifestKind = z.infer<typeof ManifestKindSchema>;

/** Legacy fields shared by both manifest kinds for backward compat */
const legacyManifestFields = {
  id: z.string().optional(),
  gameMode: z.enum(["PECKING_ORDER", "CONFIGURABLE_CYCLE", "DEBUG_PECKING_ORDER"]).optional(),
};

export const StaticManifestSchema = z.object({
  kind: z.literal('STATIC'),
  scheduling: SchedulingStrategySchema.default('PRE_SCHEDULED'),
  days: z.array(DailyManifestSchema),
  pushConfig: PushConfigSchema.optional(),
  ...legacyManifestFields,
});
export type StaticManifest = z.infer<typeof StaticManifestSchema>;

export const DynamicManifestSchema = z.object({
  kind: z.literal('DYNAMIC'),
  scheduling: SchedulingStrategySchema.default('PRE_SCHEDULED'),
  startTime: z.string(), // ISO 8601 — when Day 1 begins
  ruleset: GameRulesetSchema,
  schedulePreset: SchedulePresetSchema,
  maxPlayers: z.number().optional(),
  minPlayers: z.number().min(2).default(3),
  days: z.array(DailyManifestSchema),
  pushConfig: PushConfigSchema.optional(),
  ...legacyManifestFields,
});
export type DynamicManifest = z.infer<typeof DynamicManifestSchema>;

export const GameManifestSchema = z.discriminatedUnion('kind', [
  StaticManifestSchema,
  DynamicManifestSchema,
]);
export type GameManifest = z.infer<typeof GameManifestSchema>;

/**
 * Normalize a raw manifest (possibly from a legacy snapshot) into the
 * typed GameManifest discriminated union. Legacy manifests without a
 * `kind` field are treated as StaticManifest.
 */
export function normalizeManifest(raw: any): GameManifest {
  const manifest = (raw?.kind === 'STATIC' || raw?.kind === 'DYNAMIC')
    ? raw
    : { kind: 'STATIC' as const, ...raw };

  // Fill defaults for DM invite fields on each day
  if (Array.isArray(manifest.days)) {
    for (const day of manifest.days) {
      if (day.requireDmInvite === undefined) day.requireDmInvite = false;
      if (day.dmSlotsPerPlayer === undefined) day.dmSlotsPerPlayer = 5;
    }
  }

  // Fill defaults on dynamic ruleset social config
  if (manifest.kind === 'DYNAMIC' && manifest.ruleset?.social) {
    if (manifest.ruleset.social.requireDmInvite === undefined) manifest.ruleset.social.requireDmInvite = false;
    if (manifest.ruleset.social.dmSlotsPerPlayer === undefined) manifest.ruleset.social.dmSlotsPerPlayer = 5;
  }

  return manifest as GameManifest;
}

export const QaEntrySchema = z.object({
  question: z.string(),
  answer: z.string(),
  narratorIntro: z.string().optional(),
});

export type QaEntry = z.infer<typeof QaEntrySchema>;

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
  qaAnswers: z.array(QaEntrySchema).optional(),
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
  type: z.enum(["CHAT_MSG", "SILVER_TRANSFER", "VOTE_CAST", "ELIMINATION", "DM_SENT", "POWER_USED", "PERK_USED", "GAME_RESULT", "PLAYER_GAME_RESULT", "WINNER_DECLARED", "PROMPT_RESULT", "DM_INVITE_SENT", "DM_INVITE_ACCEPTED", "DM_INVITE_DECLINED", "DILEMMA_RESULT", "REACTION", "NUDGE", "WHISPER"]),
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
// GameManifest, DailyManifest — exported inline with their schemas above
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type InitPayload = z.infer<typeof InitPayloadSchema>;

// --- Social & Chat Schemas ---

export const SocialPlayerSchema = z.object({
  id: z.string(),
  personaName: z.string(),
  avatarUrl: z.string(),
  bio: z.string().optional(),
  status: z.enum(["ALIVE", "ELIMINATED"]),
  silver: z.number().int().default(0),
  gold: z.number().int().default(0),
  realUserId: z.string().optional(),
  qaAnswers: z.array(QaEntrySchema).optional(),
  /** Day on which the player was eliminated. Populated at elimination time.
   *  Used by Pulse Phase 4 reveal replay keying (revealsSeen.elimination[dayIndex]). */
  eliminatedOnDay: z.number().int().optional(),
});

export const ChatMessageSchema = z.object({
  id: z.string(), // UUID
  senderId: z.string(),
  timestamp: z.number(),
  content: z.string().max(280),
  channelId: z.string(),                         // Channel-based routing
  channel: z.enum(["MAIN", "DM"]).optional(),    // DEPRECATED — kept for migration
  targetId: z.string().optional(),               // DEPRECATED — kept for migration
  replyTo: z.string().optional(),                // messageId of the message being replied to
  whisperTarget: z.string().optional(),          // playerId — only sender+target see full content
  reactions: z.record(z.string(), z.array(z.string())).optional(), // emoji → [reactorPlayerIds]
  redacted: z.boolean().optional(),              // true for whisper messages not visible to this player
});

export const SocialEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SOCIAL.SEND_MSG"),
    content: z.string(),
    targetId: z.string().optional(),
    replyTo: z.string().optional(),
  }),
  z.object({
    type: z.literal("SOCIAL.SEND_SILVER"),
    amount: z.number().positive(),
    targetId: z.string()
  }),
  z.object({
    type: z.literal("SOCIAL.CREATE_CHANNEL"),
    memberIds: z.array(z.string()).min(2),  // excludes sender (injected by L1)
  }),
  z.object({
    type: z.literal("SOCIAL.REACT"),
    messageId: z.string(),
    emoji: z.string(),
  }),
  z.object({
    type: z.literal("SOCIAL.NUDGE"),
    targetId: z.string(),
  }),
  z.object({
    type: z.literal("SOCIAL.WHISPER"),
    targetId: z.string(),
    text: z.string().min(1).max(280),
  }),
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

export type DmRejectionReason = 'DMS_CLOSED' | 'GROUP_CHAT_CLOSED' | 'PARTNER_LIMIT' | 'CHAR_LIMIT' | 'SELF_DM' | 'TARGET_ELIMINATED' | 'INSUFFICIENT_SILVER' | 'GROUP_LIMIT' | 'INVALID_MEMBERS'
  | 'INVITE_REQUIRED' | 'CONVERSATION_LIMIT' | 'DUPLICATE_INVITE' | 'UNAUTHORIZED';

// --- Channel System ---

export const ChannelTypeSchema = z.enum(['MAIN', 'DM', 'GROUP_DM', 'GAME_DM']);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

export type ChannelCapability =
  | 'CHAT' | 'SILVER_TRANSFER' | 'INVITE_MEMBER' | 'REACTIONS' | 'REPLIES' | 'GAME_ACTIONS'
  | 'NUDGE'     // MAIN + 1:1 DM — UI affordance flag (NUDGE event is player-scoped)
  | 'WHISPER';  // MAIN only — whisper is MAIN-anonymous

export interface Channel {
  id: string;
  type: ChannelType;
  memberIds: string[];
  pendingMemberIds?: string[];  // invited but haven't accepted yet
  createdBy: string;           // playerId | 'SYSTEM' | 'GAME:{type}'
  createdAt: number;
  label?: string;
  gameType?: string;           // For GAME_DM: which game created this channel
  capabilities?: ChannelCapability[];
  constraints?: {
    exempt?: boolean;          // exempt from daily limits + open/close flags
    silverCost?: number;       // per-message cost (default: 1 for DM, 0 for MAIN/GAME_DM)
  };
  hints?: string[];            // server-enriched placeholder hints for chat input
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

// --- Game Master Action Types ---
export const GameMasterActionTypes = {
  ELIMINATE: 'ELIMINATE',
} as const;
export type GameMasterActionType = typeof GameMasterActionTypes[keyof typeof GameMasterActionTypes];

export interface GameMasterAction {
  action: GameMasterActionType;
  playerId: string;
  reason: string;
}

// --- Game History ---

export interface GameHistoryEntry {
  gameType: string;
  activityType?: string;
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
  // Optional structured discriminator for category variants (e.g. SOCIAL_INVITE
  // needs to distinguish 'initial' DM creation from 'add_member').
  kind?: string;
}

// --- Game Phase (server-projected, consumed by all shells) ---

/**
 * Server-authoritative day phase — projected from XState snapshot in the sync layer.
 * Sent in every SYNC payload as `phase`. Open union: game modes may define additional values.
 */
export const DayPhases = {
  PREGAME: 'pregame',
  MORNING: 'morning',
  SOCIAL: 'social',
  GAME: 'game',
  ACTIVITY: 'activity',
  VOTING: 'voting',
  ELIMINATION: 'elimination',
  FINALE: 'finale',
  GAME_OVER: 'gameOver',
} as const;

export type DayPhase = typeof DayPhases[keyof typeof DayPhases] | (string & {});

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

export type BlinkClientEvent =
  | { type: 'GAME.BLINK.START' }
  | { type: 'GAME.BLINK.RESULT'; score: number; blackTaps: number; whiteTaps: number; longestStreak: number; timeElapsed: number };

export type RecallClientEvent =
  | { type: 'GAME.RECALL.START' }
  | { type: 'GAME.RECALL.RESULT'; roundsCleared: number; highestSize: number; fullClear: number; timeElapsed: number };

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
  status: 'NOT_STARTED' | 'PLAYING' | 'AWAITING_DECISION' | 'COMPLETED';
  startedAt: number;
  result: Record<string, number> | null;
  silverReward: number;
  goldReward: number;
  goldContribution: number;
  seed: number;
  timeLimit: number;
  difficulty: number;
  retryCount: number;
  previousResult: Record<string, number> | null;
  previousSilverReward: number;
  previousGoldReward: number;
  /** All players' results, sorted by silverReward descending. Present once status=COMPLETED. */
  allPlayerResults?: Array<{ playerId: string; silverReward: number; result?: Record<string, number> }>;
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
  status: 'NOT_STARTED' | 'PLAYING' | 'AWAITING_DECISION' | 'COMPLETED';
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
  retryCount: number;
  previousResult: Record<string, number> | null;
  previousSilverReward: number;
  previousGoldReward: number;
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