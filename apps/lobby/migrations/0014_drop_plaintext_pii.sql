-- Phase 2: Drop plaintext PII columns after backfill.
-- SQLite can't DROP COLUMN with an inline UNIQUE constraint,
-- so we recreate the table without the plaintext PII columns.

CREATE TABLE PlaytestSignups_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referral_source TEXT NOT NULL,
  referral_detail TEXT,
  signed_up_at TEXT NOT NULL DEFAULT (datetime('now')),
  referral_code TEXT,
  referred_by TEXT,
  messaging_app TEXT,
  email_encrypted TEXT,
  phone_encrypted TEXT,
  email_hash TEXT
);

INSERT INTO PlaytestSignups_new (id, referral_source, referral_detail, signed_up_at, referral_code, referred_by, messaging_app, email_encrypted, phone_encrypted, email_hash)
  SELECT id, referral_source, referral_detail, signed_up_at, referral_code, referred_by, messaging_app, email_encrypted, phone_encrypted, email_hash
  FROM PlaytestSignups;

DROP TABLE PlaytestSignups;
ALTER TABLE PlaytestSignups_new RENAME TO PlaytestSignups;

CREATE UNIQUE INDEX idx_email_hash ON PlaytestSignups(email_hash);
