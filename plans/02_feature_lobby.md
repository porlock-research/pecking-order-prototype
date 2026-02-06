# Feature 1: The Lobby (P1)

**Status:** Draft
**Goal:** Allow a Host to create a game, invite friends, and finalize the roster with AI-generated personas.

## **1. User Stories**
1.  **Host:** "I want to create a new game and get a shareable link."
2.  **Host:** "I want to click a button to generate funny persona options for my players using AI."
3.  **Player:** "I want to join via a link, pick a persona (catfish), and write a bio."
4.  **Host:** "I want to see who has joined and 'Start Game' when we have 8 players."

## **2. Technical Requirements**
*   **Framework:** Next.js (App Router) on Cloudflare Pages.
*   **Database:** Cloudflare D1 (SQLite).
*   **AI:** Google Gemini API (via Vercel AI SDK or direct REST).
*   **Auth:** Passwordless (Magic Link) or simple "Name + Access Code" for MVP to avoid email complexity if needed. *Decision: Use Magic Link stub for now (simulated).*
*   **Limits:** Max 8 Players per Game.

## **3. Data Schemas (D1)**

```sql
-- Lobby Table
CREATE TABLE lobbies (
  id TEXT PRIMARY KEY,
  host_email TEXT NOT NULL,
  status TEXT DEFAULT 'OPEN', -- OPEN, FULL, CLOSED
  created_at INTEGER,
  config_json TEXT -- { "theme": "Sci-Fi" }
);

-- Players Table
CREATE TABLE lobby_players (
  lobby_id TEXT,
  email TEXT,
  name TEXT,
  persona_id TEXT, -- selected persona
  bio TEXT,
  is_host BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'PENDING', -- PENDING, READY
  PRIMARY KEY (lobby_id, email)
);

-- Generated Personas (Cache)
CREATE TABLE generated_personas (
  id TEXT PRIMARY KEY,
  lobby_id TEXT,
  name TEXT,
  avatar_url TEXT,
  bio_blurb TEXT
);
```

## **4. API Endpoints (Next.js Actions)**

### `POST /api/lobby/create`
*   **Input:** `{ hostEmail }`
*   **Logic:** Generate ID, Insert DB, Return Link.

### `POST /api/ai/generate-personas`
*   **Input:** `{ lobbyId, theme }`
*   **Gemini Prompt:**
    > "Generate 24 eccentric, funny, and distinct personas for a social deduction game. Theme: {theme}. Return JSON array: [{ name, bio_blurb, avatar_prompt }]."
*   **Output:** Stores results in `generated_personas`.

### `POST /api/lobby/join`
*   **Input:** `{ lobbyId, email, name }`
*   **Logic:** Check if full (Max 8). Insert Player.

## **5. Implementation Steps**

1.  **Setup D1:** Create `pecking-order-db`. Run migrations.
2.  **Build UI:**
    *   Landing Page (Create Game).
    *   Lobby ID Page (Waiting Room).
    *   Persona Picker (Card Grid).
3.  **Integrate Gemini:**
    *   Set up API Key in `.env`.
    *   Write the Prompt Engineering logic.
4.  **State Management:** Use SWR or React Query to poll `GET /api/lobby/{id}` for real-time updates (Simpler than WebSocket for Lobby).

## **6. Verification**
*   Create a game.
*   Open incognito window (Player 2). Join.
*   Host sees Player 2 appear.
*   Generate Personas works.
