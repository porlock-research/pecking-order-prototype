-- 0016_anonymous_creates.sql
-- Rate-limit tracking for anonymous user creation via /j/[code].
-- Stores SHA-256 hashes of IPs (no plaintext PII) with creation timestamps.

CREATE TABLE AnonymousCreates (
  ip_hash TEXT NOT NULL,                -- SHA-256 hex of client IP
  created_at INTEGER NOT NULL           -- ms since epoch
);

CREATE INDEX idx_anon_creates_ip_time ON AnonymousCreates(ip_hash, created_at);
