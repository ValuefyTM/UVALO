-- UVALO pentru Chrome → Word: the captures sent from the extension ("Trimite în Word"), kept a few days until they are
-- inserted in the report from the Word add-in. One batch per person (a new send replaces the previous one).
CREATE TABLE IF NOT EXISTS chrome_batches (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  data            TEXT NOT NULL,                      -- JSON: groups → items (label, title, url, capturedAt, slices)
  slices          INTEGER NOT NULL DEFAULT 0,
  done            INTEGER NOT NULL DEFAULT 0,         -- 1 = every image arrived
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_chrome_batches_user ON chrome_batches(user_id, created_at);

CREATE TABLE IF NOT EXISTS chrome_slices (
  batch_id        TEXT NOT NULL,
  item_id         TEXT NOT NULL,
  idx             INTEGER NOT NULL,
  mime            TEXT NOT NULL DEFAULT 'image/jpeg',
  w               INTEGER,
  h               INTEGER,
  data            BLOB NOT NULL,
  PRIMARY KEY (batch_id, item_id, idx)
);
