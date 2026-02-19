-- Persist persona draws so reloads return the same characters,
-- and lock drawn personas from other players' draws until confirmed or expired.
CREATE TABLE PersonaDraws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  persona_ids TEXT NOT NULL,        -- JSON array of persona IDs, e.g. '["persona-01","persona-05","persona-12"]'
  expires_at INTEGER NOT NULL,      -- Unix ms, draw lock TTL (15 min)
  created_at INTEGER NOT NULL,
  FOREIGN KEY (game_id) REFERENCES GameSessions(id),
  FOREIGN KEY (user_id) REFERENCES Users(id)
);
CREATE UNIQUE INDEX idx_persona_draws_game_user ON PersonaDraws(game_id, user_id);
