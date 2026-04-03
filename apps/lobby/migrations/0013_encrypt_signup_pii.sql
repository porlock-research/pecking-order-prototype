-- Phase 1: Add encrypted columns alongside existing plaintext columns.
-- Signup action writes to both during transition period.
ALTER TABLE PlaytestSignups ADD COLUMN email_encrypted TEXT;
ALTER TABLE PlaytestSignups ADD COLUMN phone_encrypted TEXT;
ALTER TABLE PlaytestSignups ADD COLUMN email_hash TEXT;
