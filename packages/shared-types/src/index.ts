import { z } from "zod";

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
  action: z.enum(["START_CARTRIDGE", "INJECT_PROMPT", "START_ACTIVITY", "END_ACTIVITY", "OPEN_VOTING", "CLOSE_VOTING", "OPEN_DMS", "CLOSE_DMS", "START_GAME", "END_GAME", "END_DAY"]),
  payload: z.any().optional(),
});

// --- Voting Types ---

export const VoteTypeSchema = z.enum([
  "EXECUTIONER", "MAJORITY", "BUBBLE", "SECOND_TO_LAST",
  "PODIUM_SACRIFICE", "SHIELD", "TRUST_PAIRS", "DUELS", "FINALS"
]);
export type VoteType = z.infer<typeof VoteTypeSchema>;

// --- Game (Minigame) Types ---

export const GameTypeSchema = z.enum(["TRIVIA", "REALTIME_TRIVIA", "NONE"]);
export type GameType = z.infer<typeof GameTypeSchema>;

export interface GameCartridgeInput {
  gameType: GameType;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
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
  'VOTING',            // broadcast
  'NIGHT_SUMMARY',     // broadcast
  'DAILY_GAME',        // broadcast
]);
export type PushTrigger = z.infer<typeof PushTriggerSchema>;

export const PushConfigSchema = z.record(PushTriggerSchema, z.boolean()).default({});
export type PushConfig = z.infer<typeof PushConfigSchema>;

export const DEFAULT_PUSH_CONFIG: Record<PushTrigger, boolean> = {
  DM_SENT: true, ELIMINATION: true, WINNER_DECLARED: true,
  DAY_START: true, VOTING: true, NIGHT_SUMMARY: true, DAILY_GAME: true,
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
});

export const ChatMessageSchema = z.object({
  id: z.string(), // UUID
  senderId: z.string(),
  timestamp: z.number(),
  content: z.string().max(280),
  channel: z.enum(["MAIN", "DM"]),
  targetId: z.string().optional()
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

// --- DM Constants ---

export const DM_MAX_PARTNERS_PER_DAY = 3;
export const DM_MAX_CHARS_PER_DAY = 1200;
export const DM_SILVER_COST = 1;

export type DmRejectionReason = 'DMS_CLOSED' | 'PARTNER_LIMIT' | 'CHAR_LIMIT' | 'SELF_DM' | 'TARGET_ELIMINATED' | 'INSUFFICIENT_SILVER';

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

export const PERK_COSTS: Record<PerkType, number> = {
  SPY_DMS: 5,
  EXTRA_DM_PARTNER: 3,
  EXTRA_DM_CHARS: 2,
};

// --- Ticker (News Feed) ---

export interface TickerMessage {
  id: string;
  text: string;
  category: 'SOCIAL' | 'GAME' | 'VOTE' | 'ELIMINATION' | 'SYSTEM';
  timestamp: number;
}