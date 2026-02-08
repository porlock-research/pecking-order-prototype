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

  const payload = {
    lobbyId: "lobby-debug",
    roster,
    manifest: {
      id: "manifest-1",
      gameMode: "PECKING_ORDER" as const,
      days: []
    }
  };

  // 2. Validate locally (Sanity check)
  const validated = InitPayloadSchema.parse(payload);

  // 3. Send to Game Server
  // Note: partyserver URL pattern is typically /parties/:party/:id
  // We defined "GameServer" class in wrangler.toml.
  // partyserver defaults route: /parties/GameServer/stub-game-123
  // AND we implemented onRequest to handle /init suffix?
  // Let's check server.ts: endsWith("/init")
  // So URL: /parties/GameServer/stub-game-123/init
  
  const targetUrl = `${GAME_SERVER_URL}/parties/GameServer/${GAME_ID}/init`;
  
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
