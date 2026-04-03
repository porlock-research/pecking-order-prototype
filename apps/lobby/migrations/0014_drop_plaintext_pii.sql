-- Phase 2: Drop plaintext PII columns AFTER backfill is confirmed.
-- DO NOT apply this migration until:
--   1. Backfill script has run on staging AND production
--   2. All new signups are writing encrypted values
--   3. Admin page reads correctly from encrypted columns

ALTER TABLE PlaytestSignups DROP COLUMN email;
ALTER TABLE PlaytestSignups DROP COLUMN phone;
ALTER TABLE PlaytestSignups DROP COLUMN ip_address;
ALTER TABLE PlaytestSignups DROP COLUMN turnstile_token;

CREATE UNIQUE INDEX idx_email_hash ON PlaytestSignups(email_hash);
