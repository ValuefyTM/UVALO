-- ANEVAR members (Tabloul membrilor titulari, anevar.ro) and account requests: a valuer asks for an account with the
-- ANEVAR card number, the platform recognises the name, and a VALUEFY admin approves the request.

CREATE TABLE IF NOT EXISTS anevar_members (
  legit           TEXT PRIMARY KEY,                    -- ANEVAR membership card number
  name            TEXT NOT NULL,
  county          TEXT,                                -- județ de domiciliu
  specs           TEXT,                                -- EI,EPI,EBM,EIF,VE-EI,VE-EPI,VE-EBM,VE-EIF
  nr              INTEGER,                             -- position in the published list
  tablou_date     TEXT,                                -- date of the list the row comes from
  in_current      INTEGER NOT NULL DEFAULT 1,          -- 0 = no longer in the latest list
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_anevar_county ON anevar_members(county, name);

CREATE TABLE IF NOT EXISTS account_requests (
  id              TEXT PRIMARY KEY,
  legit           TEXT NOT NULL,
  name            TEXT NOT NULL,                       -- from the list
  email           TEXT NOT NULL,
  phone           TEXT,
  company         TEXT,                                -- firm, optional
  message         TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',     -- pending | approved | rejected
  ip              TEXT,
  user_agent      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  decided_by      TEXT REFERENCES users(id),
  decided_at      TEXT,
  decision_note   TEXT,
  user_id         TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON account_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_requests_legit ON account_requests(legit);

-- Profile: picture (small JPEG data URL), county and specializations from the ANEVAR list (fixed for the user).
ALTER TABLE users ADD COLUMN avatar TEXT;
ALTER TABLE users ADD COLUMN county TEXT;
ALTER TABLE users ADD COLUMN specs TEXT;
CREATE INDEX IF NOT EXISTS idx_users_anevar ON users(anevar_no);

-- Changing the sign-in email: confirmed with a code sent to the new address.
CREATE TABLE IF NOT EXISTS email_changes (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  new_email       TEXT NOT NULL,
  code_hash       TEXT NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  expires_at      TEXT NOT NULL,
  used_at         TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
