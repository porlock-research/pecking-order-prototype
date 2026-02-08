'use server';

import { InitPayloadSchema, Roster } from "@pecking-order/shared-types";

export async function startGameStub() {
  const GAME_SERVER_URL = process.env.GAME_SERVER_URL || "http://localhost:8787";
  const GAME_ID = "stub-game-123";

  // 1. Mock Data (Strictly typed)
  const roster: Roster = {
    "p1": {
      realUserId: "user-1",
      personaName: "Countess Snuffles",
      avatarUrl: "🐱",
      bio: "Meow.",
      isAlive: true,
      isSpectator: false,
      silver: 0,
      gold: 0,
      destinyId: "FANATIC"
    },
    "p2": {
      realUserId: "user-2",
      personaName: "Dr. Spatula",
      avatarUrl: "🍔",
      bio: "Flip it.",
      isAlive: true,
      isSpectator: false,
      silver: 0,
      gold: 0,
      destinyId: "FLOAT"
    }
    // ... imagine 8 players
  };

  const now = Date.now();
  const timeline = [
    { time: new Date(now + 5000).toISOString(), action: "GAME_STARTED", payload: { msg: "Let the games begin!" } },
    { time: new Date(now + 10000).toISOString(), action: "GROUP_CHAT_OPEN", payload: { msg: "Chat is open." } },
    { time: new Date(now + 15000).toISOString(), action: "DMS_OPEN", payload: { msg: "Secrets allowed." } },
    { time: new Date(now + 20000).toISOString(), action: "VOTING_STARTED", payload: { msg: "Cast your stones." } },
    { time: new Date(now + 25000).toISOString(), action: "GAME_ENDED", payload: { msg: "Day is done." } },
  ];

  const payload = {
    lobbyId: "lobby-debug",
    roster,
    manifest: {
      id: "manifest-1",
      gameMode: "PECKING_ORDER" as const,
      days: [
        {
          dayIndex: 1,
          theme: "Test Day",
          timeline
        }
      ]
    }
  };

  // 2. Validate locally (Sanity check)
  const validated = InitPayloadSchema.parse(payload);

  // 3. Send to Game Server
  // Note: partyserver URL pattern is typically /parties/:party/:id
  // The URL segment must match the kebab-cased Binding Name
  // Binding: GameServer -> URL: game-server
  const targetUrl = `${GAME_SERVER_URL}/parties/game-server/${GAME_ID}/init`;
  
  console.log(`[Lobby] Handoff to ${targetUrl}`);

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
    return { success: true, data };

  } catch (err: any) {
    console.error("[Lobby] Handoff Failed:", err);
    return { success: false, error: err.message };
  }
}
