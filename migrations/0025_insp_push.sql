-- Inspecții, the phone app: Web Push subscriptions (one per phone / browser) and the notifications already sent by the
-- schedule (reminders, morning summary), so each one goes out once.
CREATE TABLE IF NOT EXISTS insp_push (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  endpoint          TEXT NOT NULL UNIQUE,
  p256dh            TEXT NOT NULL,
  auth              TEXT NOT NULL,
  ua                TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_ok_at        TEXT,
  fails             INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_insp_push_user ON insp_push(user_id);

CREATE TABLE IF NOT EXISTS insp_push_sent (
  key               TEXT PRIMARY KEY,
  at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
