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

// --- Schemas ---

export const PlayerSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  personaId: z.string().optional(),
  bio: z.string().optional(),
  isHost: z.boolean().default(false),
  status: z.enum(["PENDING", "READY"]),
});

export const LobbySchema = z.object({
  id: z.string(),
  hostEmail: z.string().email(),
  status: z.nativeEnum(GameStatus),
  players: z.array(PlayerSchema),
  config: z.object({
    theme: z.string().optional(),
    gameMode: z.string().default("PECKING_ORDER"),
  }),
});

// --- Types (Inferred) ---

export type Player = z.infer<typeof PlayerSchema>;
export type Lobby = z.infer<typeof LobbySchema>;

// --- Game Engine Types ---

export interface RosterPlayer {
  realUserId: string;
  personaName: string;
  avatarUrl: string;
  bio: string;
  isAlive: boolean;
  isSpectator: boolean;
  silver: number;
  gold: number;
  destinyId: string;
}

export interface Roster {
  [playerId: string]: RosterPlayer;
}

export interface GameManifest {
  id: string;
  gameMode: "PECKING_ORDER" | "BLITZ"; // Polymorphic Support
  days: DailyManifest[];
}

export interface DailyManifest {
  dayIndex: number;
  theme: string;
  timeline: {
    time: string; // "09:00"
    action: string; // "START_CARTRIDGE"
    payload?: any;
  }[];
}
