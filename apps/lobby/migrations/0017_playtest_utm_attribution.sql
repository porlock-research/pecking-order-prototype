-- 0017_playtest_utm_attribution.sql
-- Capture marketing attribution (UTM params) on signup form for the blitz.
-- Without these columns, post-launch we can't tell which subreddit / channel /
-- campaign delivered the qualified signups. Required for the blitz Tier-A/B/C
-- success criteria documented in .agents/blitz-strategy.md.

ALTER TABLE PlaytestSignups ADD COLUMN utm_source TEXT;
ALTER TABLE PlaytestSignups ADD COLUMN utm_medium TEXT;
ALTER TABLE PlaytestSignups ADD COLUMN utm_campaign TEXT;
ALTER TABLE PlaytestSignups ADD COLUMN utm_content TEXT;

-- Most queries will filter by source ("which subreddit converted?").
-- Campaign secondary; full-table scan is acceptable at our volume.
CREATE INDEX idx_playtest_signups_utm_source ON PlaytestSignups(utm_source);
