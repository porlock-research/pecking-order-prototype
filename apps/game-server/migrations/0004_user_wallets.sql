-- Persistent gold wallets — one row per real human, survives across tournaments
CREATE TABLE IF NOT EXISTS UserWallets (
  real_user_id TEXT PRIMARY KEY,
  gold INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
