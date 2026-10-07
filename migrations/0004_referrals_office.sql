-- "Lucrez ca birou": shows "Firma mea" (colleagues, seats, team activity). On for those who already run a firm with several seats.
ALTER TABLE users ADD COLUMN is_office INTEGER NOT NULL DEFAULT 0;
UPDATE users SET is_office = 1 WHERE id IN (
  SELECT m.user_id FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.status = 'active' AND m.role IN ('owner', 'admin') AND o.seats > 1
);

-- Recommendations: a user sends a colleague the link to "Solicită cont"; we follow what happens next.
CREATE TABLE IF NOT EXISTS referrals (
  id          TEXT PRIMARY KEY,
  by_user     TEXT NOT NULL REFERENCES users(id),
  email       TEXT NOT NULL,
  name        TEXT,
  note        TEXT,
  token_hash  TEXT NOT NULL UNIQUE,
  email_sent  INTEGER NOT NULL DEFAULT 0,
  opened_at   TEXT,                                 -- first visit of the link
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS referrals_by ON referrals(by_user, created_at);
CREATE INDEX IF NOT EXISTS referrals_email ON referrals(email);

ALTER TABLE account_requests ADD COLUMN referral_id TEXT REFERENCES referrals(id);
