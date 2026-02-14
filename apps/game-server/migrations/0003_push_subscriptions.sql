-- Push subscriptions: one row per user, updated on re-subscribe
CREATE TABLE PushSubscriptions (
  user_id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
