-- 0015_contact_handle_nullable_email.sql
-- Add contact_handle for frictionless-invite users.
-- Earlier drafts also made Users.email nullable via a table recreation, but that
-- tripped SQLITE_CONSTRAINT_FOREIGNKEY / internal error 7500 on D1 staging even
-- with PRAGMA defer_foreign_keys = ON. Sidestep: keep email NOT NULL and have
-- the frictionless-invite path insert a sentinel value (see claimSeat).

ALTER TABLE Users ADD COLUMN contact_handle TEXT;
