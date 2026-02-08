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
  action: z.enum(["START_CARTRIDGE", "INJECT_PROMPT", "START_ACTIVITY", "OPEN_VOTING", "CLOSE_VOTING", "END_DAY"]),
  payload: z.any().optional(),
});

export const DailyManifestSchema = z.object({
  dayIndex: z.number(),
  theme: z.string(),
  voteType: z.enum(["EXECUTIONER", "TRUST", "MAJORITY", "JURY"]), // Polymorphic voting
  timeline: z.array(TimelineEventSchema),
});

export const GameManifestSchema = z.object({
  id: z.string(),
  gameMode: z.enum(["PECKING_ORDER", "BLITZ"]),
  days: z.array(DailyManifestSchema),
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
  type: z.enum(["SILVER_TRANSFER", "VOTE_CAST", "ELIMINATION", "DM_SENT", "POWER_USED", "GAME_RESULT"]),
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