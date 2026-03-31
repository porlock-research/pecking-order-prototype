-- Add referral tracking to playtest signups.
-- referral_code: 6-char code generated at signup, used in share links.
-- referred_by: the referral_code of whoever referred this person (nullable).
-- Note: SQLite ALTER TABLE ADD COLUMN does not support UNIQUE inline,
-- so uniqueness is enforced via a separate UNIQUE INDEX.
ALTER TABLE PlaytestSignups ADD COLUMN referral_code TEXT;
ALTER TABLE PlaytestSignups ADD COLUMN referred_by TEXT;

CREATE UNIQUE INDEX idx_playtest_signups_referral_code ON PlaytestSignups(referral_code);
CREATE INDEX idx_playtest_signups_referred_by ON PlaytestSignups(referred_by);
