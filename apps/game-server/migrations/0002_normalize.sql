-- Migration number: 0002 	 2026-02-11T00:00:00.000Z

-- Games table — one row per game instance
CREATE TABLE IF NOT EXISTS Games (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

-- Players table — per-game player roster snapshot
CREATE TABLE IF NOT EXISTS Players (
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  real_user_id TEXT NOT NULL,
  persona_name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'ALIVE',
  silver INTEGER NOT NULL DEFAULT 50,
  gold INTEGER NOT NULL DEFAULT 0,
  destiny_id TEXT,
  PRIMARY KEY (game_id, player_id),
  FOREIGN KEY (game_id) REFERENCES Games(id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_journal_game_type_actor
  ON GameJournal(game_id, event_type, actor_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_journal_game_day
  ON GameJournal(game_id, day_index, timestamp);
CREATE INDEX IF NOT EXISTS idx_players_game
  ON Players(game_id);
CREATE INDEX IF NOT EXISTS idx_players_real_user
  ON Players(real_user_id);
