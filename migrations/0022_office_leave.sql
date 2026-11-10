-- A member of an office asks to leave it and continue with an individual account (only valuers: the ANEVAR card is checked
-- against the Tablou). The office's administrators see the request in "Firma mea" and remove the person, which creates
-- the individual account.
CREATE TABLE IF NOT EXISTS office_leaves (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES orgs(id),
  user_id         TEXT NOT NULL REFERENCES users(id),
  legit           TEXT NOT NULL,                      -- ANEVAR card, checked against anevar_members
  status          TEXT NOT NULL DEFAULT 'pending',    -- pending | done | rejected | cancelled
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  decided_by      TEXT REFERENCES users(id),
  decided_at      TEXT,
  new_org_id      TEXT                                -- the individual account created on approval
);
CREATE INDEX IF NOT EXISTS idx_office_leaves_org ON office_leaves(org_id, status);
CREATE INDEX IF NOT EXISTS idx_office_leaves_user ON office_leaves(user_id, status);
