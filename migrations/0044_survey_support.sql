-- Chestionarul de feedback (obligatoriu la următoarea logare pentru cei cu peste N acțiuni; setările în app_settings "survey")
-- și Suport tehnic: sesizările din tabelul feedback devin tichete cu răspunsuri (echipa UVALO ↔ utilizator) și imagini.
CREATE TABLE IF NOT EXISTS survey_answers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id       TEXT NOT NULL,                      -- id-ul chestionarului din setări (unul nou = toți eligibilii îl primesc din nou)
  user_id         TEXT NOT NULL REFERENCES users(id),
  org_id          TEXT,
  answers         TEXT NOT NULL DEFAULT '{}',         -- JSON cu răspunsurile pe chei (nps, why, tools, wants, …)
  step            INTEGER NOT NULL DEFAULT 0,         -- ultimul pas salvat (1–5)
  actions         INTEGER NOT NULL DEFAULT 0,         -- câte acțiuni avea persoana când l-a primit
  done_at         TEXT,                               -- completat până la capăt
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_user ON survey_answers(survey_id, user_id);

-- tichetele: imagine atașată, ultima activitate, când a văzut fiecare parte firul
ALTER TABLE feedback ADD COLUMN image_key TEXT;      -- cheia din R2 (FILES), ex. support/12.jpg
ALTER TABLE feedback ADD COLUMN image_type TEXT;
ALTER TABLE feedback ADD COLUMN updated_at TEXT;     -- ultimul mesaj din fir (NULL = doar sesizarea)
ALTER TABLE feedback ADD COLUMN user_seen_at TEXT;   -- utilizatorul a deschis firul (pentru „răspuns nou”)

CREATE TABLE IF NOT EXISTS feedback_replies (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  feedback_id     INTEGER NOT NULL REFERENCES feedback(id),
  user_id         TEXT REFERENCES users(id),          -- cine a scris (utilizatorul sau administratorul UVALO)
  staff           INTEGER NOT NULL DEFAULT 0,         -- 1 = răspunsul echipei UVALO
  text            TEXT NOT NULL,
  image_key       TEXT,
  image_type      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_replies ON feedback_replies(feedback_id, created_at);
