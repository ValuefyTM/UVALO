-- Colaborări: occasional work between valuers (inspections, report + inspection). Profiles with the coverage zone,
-- posts, "Vreau detalii" requests, conversations, messages and in-app notifications.
-- Everything written while the module is not "Activ" (Dezactivat / Test, Admin → Instrumente) has test = 1, so the
-- administration can delete the test data with one button.
CREATE TABLE IF NOT EXISTS collab_profiles (
  user_id         TEXT PRIMARY KEY REFERENCES users(id),
  available       INTEGER NOT NULL DEFAULT 1,         -- 0 = only browses, no notifications
  years           TEXT,                               -- experience bracket
  skills          TEXT NOT NULL DEFAULT '[]',         -- JSON list of strings
  experience      TEXT NOT NULL DEFAULT '[]',         -- JSON list {firm, role, period}
  about           TEXT,
  driving         INTEGER NOT NULL DEFAULT 0,
  travel          INTEGER NOT NULL DEFAULT 0,
  address         TEXT,
  city            TEXT,
  county          TEXT,
  lat             REAL,
  lng             REAL,
  zone_mode       TEXT NOT NULL DEFAULT 'raza',       -- raza | judet
  radius          INTEGER NOT NULL DEFAULT 50,        -- km, on the road (straight line × 1.25)
  extra           TEXT NOT NULL DEFAULT '[]',         -- JSON list of other counties
  kinds           TEXT NOT NULL DEFAULT '["inspectie","raport"]',
  test            INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT
);

CREATE TABLE IF NOT EXISTS collab_posts (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  kind            TEXT NOT NULL,                      -- inspectie | raport
  title           TEXT NOT NULL,
  note            TEXT NOT NULL,
  city            TEXT NOT NULL,
  county          TEXT NOT NULL,
  lat             REAL,
  lng             REAL,
  prop            TEXT,
  spec            TEXT,
  due             TEXT,                               -- YYYY-MM-DD or NULL
  budget          INTEGER,                            -- lei; NULL = "de stabilit"
  status          TEXT NOT NULL DEFAULT 'active',     -- active | inlucru | archived
  chosen_id       TEXT,
  test            INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_collab_posts_status ON collab_posts(status, created_at);
CREATE INDEX IF NOT EXISTS idx_collab_posts_user ON collab_posts(user_id, created_at);

CREATE TABLE IF NOT EXISTS collab_requests (
  id              TEXT PRIMARY KEY,
  post_id         TEXT NOT NULL REFERENCES collab_posts(id),
  user_id         TEXT NOT NULL REFERENCES users(id),
  msg             TEXT,
  status          TEXT NOT NULL DEFAULT 'nou',        -- nou | contactat | ales | retras
  test            INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_collab_requests_user ON collab_requests(user_id);

CREATE TABLE IF NOT EXISTS collab_convs (
  id              TEXT PRIMARY KEY,
  post_id         TEXT NOT NULL REFERENCES collab_posts(id),
  request_id      TEXT NOT NULL UNIQUE REFERENCES collab_requests(id),
  author_id       TEXT NOT NULL REFERENCES users(id),
  peer_id         TEXT NOT NULL REFERENCES users(id),
  author_read     TEXT,
  peer_read       TEXT,
  last_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  test            INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_collab_convs_author ON collab_convs(author_id, last_at);
CREATE INDEX IF NOT EXISTS idx_collab_convs_peer ON collab_convs(peer_id, last_at);

CREATE TABLE IF NOT EXISTS collab_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conv_id         TEXT NOT NULL REFERENCES collab_convs(id),
  user_id         TEXT,                               -- NULL = system message
  body            TEXT NOT NULL,
  test            INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_collab_messages_conv ON collab_messages(conv_id, id);

CREATE TABLE IF NOT EXISTS collab_notifs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT NOT NULL REFERENCES users(id),
  type            TEXT NOT NULL,
  text            TEXT NOT NULL,
  go              TEXT,                               -- JSON: where the click goes in the page
  read_at         TEXT,
  test            INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_collab_notifs_user ON collab_notifs(user_id, id);
