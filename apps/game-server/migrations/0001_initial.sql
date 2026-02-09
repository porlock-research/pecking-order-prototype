-- Migration number: 0001 	 2026-02-08T00:00:00.000Z
DROP TABLE IF EXISTS GameJournal;

CREATE TABLE GameJournal (
  id TEXT PRIMARY KEY,
  game_id TEXT,
  day_index INTEGER,
  timestamp INTEGER,
  event_type TEXT,
  actor_id TEXT,
  target_id TEXT,
  payload TEXT,
  trace_id TEXT
);
