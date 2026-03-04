-- Dedup table for nudge emails sent by the nudge-worker.
-- Prevents duplicate emails when the cron fires multiple times within the nudge window.
CREATE TABLE IF NOT EXISTS NudgeLog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  email TEXT NOT NULL,
  nudge_type TEXT NOT NULL,
  sent_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nudge_dedup ON NudgeLog(game_id, email, nudge_type);
