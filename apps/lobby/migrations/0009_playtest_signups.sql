-- Playtest signup interest list.
-- Stores email + referral source for future playtest invitations.
-- Rate limiting uses ip_address + signed_up_at.
CREATE TABLE PlaytestSignups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  referral_source TEXT NOT NULL,
  referral_detail TEXT,
  signed_up_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip_address TEXT
);

CREATE INDEX idx_playtest_signups_email ON PlaytestSignups(email);
CREATE INDEX idx_playtest_signups_ip ON PlaytestSignups(ip_address, signed_up_at);
