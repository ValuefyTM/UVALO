-- Feedback from the floating button (bottom right, on every page of the app and in the tools): what the person wrote,
-- where they were and whether we may answer by email. Read and handled in Admin → Feedback.
CREATE TABLE IF NOT EXISTS feedback (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT REFERENCES users(id),
  org_id          TEXT,
  kind            TEXT NOT NULL DEFAULT 'altceva',    -- problema | idee | altceva
  text            TEXT NOT NULL,
  page            TEXT,                               -- path and query where it was sent from
  ua              TEXT,
  contact         INTEGER NOT NULL DEFAULT 1,         -- 1 = we may answer by email
  status          TEXT NOT NULL DEFAULT 'nou',        -- nou | citit | rezolvat
  note            TEXT,                               -- internal
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id, created_at);
