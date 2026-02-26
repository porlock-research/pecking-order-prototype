-- Invite tokens for email-based game invitations
-- One-click link: auto-auth + redirect to join flow
CREATE TABLE InviteTokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  game_id TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  sent_by TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (game_id) REFERENCES GameSessions(id),
  FOREIGN KEY (sent_by) REFERENCES Users(id)
);

CREATE INDEX idx_invite_tokens_email_game ON InviteTokens(email, game_id);
