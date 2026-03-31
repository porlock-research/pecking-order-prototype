-- Add phone number and preferred messaging app to playtest signups.
ALTER TABLE PlaytestSignups ADD COLUMN phone TEXT;
ALTER TABLE PlaytestSignups ADD COLUMN messaging_app TEXT;
