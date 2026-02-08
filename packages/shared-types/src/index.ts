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

export const DailyManifestSchema = z.object({
  dayIndex: z.number(),
  theme: z.string(),
  timeline: z.array(z.object({
    time: z.string(), // "09:00"
    action: z.string(), // "START_CARTRIDGE"
    payload: z.any().optional(),
  })),
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

// --- Types (Inferred) ---

export type Player = z.infer<typeof PlayerSchema>;
export type Lobby = z.infer<typeof LobbySchema>;
export type RosterPlayer = z.infer<typeof RosterPlayerSchema>;
export type Roster = z.infer<typeof RosterSchema>;
export type GameManifest = z.infer<typeof GameManifestSchema>;
export type InitPayload = z.infer<typeof InitPayloadSchema>;