-- Users — cross-game identity
CREATE TABLE Users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

-- Sessions — login sessions (cookie-based)
CREATE TABLE Sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES Users(id)
);

-- MagicLinks — email login tokens
CREATE TABLE MagicLinks (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- GameSessions — lobby-side game tracking
CREATE TABLE GameSessions (
  id TEXT PRIMARY KEY,
  host_user_id TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECRUITING',
  player_count INTEGER NOT NULL,
  day_count INTEGER NOT NULL,
  config_json TEXT,
  scheduled_start_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (host_user_id) REFERENCES Users(id)
);

-- Invites — per-slot invite tracking
CREATE TABLE Invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  slot_index INTEGER NOT NULL,
  accepted_by TEXT,
  persona_id TEXT,
  accepted_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (game_id) REFERENCES GameSessions(id),
  FOREIGN KEY (accepted_by) REFERENCES Users(id)
);

-- PersonaPool — curated character roster
CREATE TABLE PersonaPool (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  bio TEXT NOT NULL,
  category TEXT DEFAULT 'DEFAULT'
);

CREATE INDEX idx_sessions_user ON Sessions(user_id);
CREATE INDEX idx_sessions_expires ON Sessions(expires_at);
CREATE INDEX idx_magic_links_email ON MagicLinks(email);
CREATE INDEX idx_invites_game ON Invites(game_id);
CREATE INDEX idx_game_sessions_host ON GameSessions(host_user_id);
CREATE INDEX idx_game_sessions_invite_code ON GameSessions(invite_code);
