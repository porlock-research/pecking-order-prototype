-- 0015_contact_handle_nullable_email.sql
-- Add contact_handle for frictionless-invite users + make email nullable.
-- SQLite can't drop NOT NULL via ALTER, so we recreate the table.
-- Mirrors the 12-step pattern established in 0014_drop_plaintext_pii.sql.
-- Defer FK checks: Sessions + Invites reference Users.id. Without deferring,
-- DROP TABLE Users + RENAME Users_new triggers SQLITE_CONSTRAINT_FOREIGNKEY.

PRAGMA defer_foreign_keys = ON;

CREATE TABLE Users_new (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,                            -- was NOT NULL UNIQUE; now nullable (SQLite permits multiple NULLs under UNIQUE)
  display_name TEXT,
  contact_handle TEXT,                          -- user-typed label for frictionless joins
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

INSERT INTO Users_new (id, email, display_name, contact_handle, created_at, last_login_at)
  SELECT
    id,
    email,
    display_name,
    COALESCE(display_name, substr(email, 1, instr(email, '@') - 1)),
    created_at,
    last_login_at
  FROM Users;

DROP TABLE Users;
ALTER TABLE Users_new RENAME TO Users;
