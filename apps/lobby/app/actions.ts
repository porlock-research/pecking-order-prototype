'use server';

import { InitPayloadSchema, Roster } from "@pecking-order/shared-types";

export interface DebugDayConfig {
  voteType: string;
  events: {
    INJECT_PROMPT: boolean;
    OPEN_DMS: boolean;
    OPEN_VOTING: boolean;
    CLOSE_VOTING: boolean;
    CLOSE_DMS: boolean;
    END_DAY: boolean;
  };
}

export interface DebugManifestConfig {
  dayCount: number;
  days: DebugDayConfig[];
}

export async function startGameStub(
  gameMode: "PECKING_ORDER" | "BLITZ" | "DEBUG_PECKING_ORDER" = "PECKING_ORDER",
  debugConfig?: DebugManifestConfig
) {
  const GAME_SERVER_URL = process.env.GAME_SERVER_URL || "http://localhost:8787";
  const GAME_ID = `game-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // 1. Mock Data (Strictly typed)
  // Generate 8 players
  const roster: Roster = {};
  const personas = [
    { name: "Countess Snuffles", emoji: "🐱" },
    { name: "Dr. Spatula", emoji: "🍔" },
    { name: "Baron Von Bon Bon", emoji: "🍬" },
    { name: "Captain Quack", emoji: "🦆" },
    { name: "Lady Fingers", emoji: "💅" },
    { name: "Sir Loin", emoji: "🥩" },
    { name: "Madame Mist", emoji: "🌫️" },
    { name: "Professor Puns", emoji: "🤡" }
  ];

  personas.forEach((p, i) => {
    const id = `p${i + 1}`;
    roster[id] = {
      realUserId: `user-${i + 1}`,
      personaName: p.name,
      avatarUrl: p.emoji,
      bio: "Ready to win.",
      isAlive: true,
      isSpectator: false,
      silver: 50,
      gold: 0,
      destinyId: i === 0 ? "FANATIC" : "FLOAT" // varied destinies
    };
  });

  const now = Date.now();
  // Helper to format time relative to now
  const t = (offset: number) => new Date(now + offset).toISOString();

  let days;

  if (gameMode === 'DEBUG_PECKING_ORDER' && debugConfig) {
    // Build manifest from debug config
    const EVENT_MESSAGES: Record<string, string> = {
      INJECT_PROMPT: "Chat prompt injected.",
      OPEN_DMS: "DMs are now open.",
      OPEN_VOTING: "Voting is now open!",
      CLOSE_VOTING: "Voting is now closed.",
      CLOSE_DMS: "DMs are now closed.",
      END_DAY: "Day has ended.",
    };

    days = debugConfig.days.slice(0, debugConfig.dayCount).map((day, i) => {
      const dayNum = i + 1;
      const baseOffset = i * 30000;
      const timeline: { time: string; action: string; payload: { msg: string } }[] = [];

      let eventOffset = 0;
      for (const eventKey of ['INJECT_PROMPT', 'OPEN_DMS', 'OPEN_VOTING', 'CLOSE_VOTING', 'CLOSE_DMS', 'END_DAY'] as const) {
        if (day.events[eventKey]) {
          timeline.push({
            time: t(baseOffset + eventOffset),
            action: eventKey,
            payload: { msg: EVENT_MESSAGES[eventKey] },
          });
          eventOffset += 5000;
        }
      }

      return {
        dayIndex: dayNum,
        theme: `Debug Day ${dayNum}`,
        voteType: day.voteType,
        timeline,
      };
    });
  } else {
    // Default hardcoded manifest
    const timelineDay1 = [
      { time: t(2000), action: "INJECT_PROMPT", payload: { msg: "Chat is open. Who is the imposter?" } },
      { time: t(10000), action: "OPEN_VOTING", payload: { msg: "Voting is now open!" } },
      { time: t(20000), action: "END_DAY", payload: { msg: "Day has ended." } },
    ];

    const timelineDay2 = [
      { time: t(30000), action: "INJECT_PROMPT", payload: { msg: "Day 2 begins!" } },
      { time: t(35000), action: "OPEN_VOTING", payload: { msg: "Voting is now open!" } },
      { time: t(40000), action: "END_DAY", payload: { msg: "Day 2 ended." } },
    ];

    days = [
      {
        dayIndex: 1,
        theme: "The Beginning",
        voteType: "EXECUTIONER" as const,
        timeline: timelineDay1,
      },
      {
        dayIndex: 2,
        theme: "Double Trouble",
        voteType: "TRUST_PAIRS" as const,
        timeline: timelineDay2,
      },
    ];
  }

  const payload = {
    lobbyId: `lobby-${Date.now()}`,
    roster,
    manifest: {
      id: "manifest-1",
      gameMode: gameMode,
      days,
    }
  };

  // 2. Validate locally (Sanity check)
  const validated = InitPayloadSchema.parse(payload);

  // 3. Send to Game Server
  // URL Pattern: /parties/:party/:id/init
  const targetUrl = `${GAME_SERVER_URL}/parties/game-server/${GAME_ID}/init`;
  
  console.log(`[Lobby] Handoff for ${GAME_ID} to ${targetUrl}`);

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      body: JSON.stringify(validated),
      headers: { "Content-Type": "application/json" }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Server responded ${res.status}: ${text}`);
    }

    const data = await res.json();
    return { success: true, gameId: GAME_ID, data };

  } catch (err: any) {
    console.error("[Lobby] Handoff Failed:", err);
    return { success: false, error: err.message };
  }
}

export async function getGameState(gameId: string) {
  const GAME_SERVER_URL = process.env.GAME_SERVER_URL || "http://localhost:8787";
  const targetUrl = `${GAME_SERVER_URL}/parties/game-server/${gameId}/state`;
  
  try {
    const res = await fetch(targetUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return await res.json();
  } catch (err) {
    return { error: "Failed to fetch state" };
  }
}

export async function sendAdminCommand(gameId: string, command: any) {
  const GAME_SERVER_URL = process.env.GAME_SERVER_URL || "http://localhost:8787";
  const targetUrl = `${GAME_SERVER_URL}/parties/game-server/${gameId}/admin`;

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      body: JSON.stringify(command),
      headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
