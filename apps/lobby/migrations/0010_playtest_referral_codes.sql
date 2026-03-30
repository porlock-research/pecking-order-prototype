-- Add referral tracking to playtest signups.
-- referral_code: unique 6-char code generated at signup, used in share links.
-- referred_by: the referral_code of whoever referred this person (nullable).
ALTER TABLE PlaytestSignups ADD COLUMN referral_code TEXT UNIQUE;
ALTER TABLE PlaytestSignups ADD COLUMN referred_by TEXT;

CREATE INDEX idx_playtest_signups_referral_code ON PlaytestSignups(referral_code);
CREATE INDEX idx_playtest_signups_referred_by ON PlaytestSignups(referred_by);
