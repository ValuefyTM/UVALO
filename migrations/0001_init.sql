-- VALUEFY Tools: accounts, firms (subscription with seats), invitations, sign-in, sessions, usage tracking.
-- Invite-only: nobody creates an account by themselves. Dates are ISO text (UTC).

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,               -- lower-case
  name            TEXT NOT NULL DEFAULT '',
  phone           TEXT,
  status          TEXT NOT NULL DEFAULT 'invited',    -- invited | active | disabled
  is_superadmin   INTEGER NOT NULL DEFAULT 0,         -- VALUEFY: manages every firm and sees all activity
  anevar_no       TEXT,                               -- ANEVAR membership card, optional
  terms_at        TEXT,                               -- accepted the terms of use
  created_by      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  activated_at    TEXT,
  last_login_at   TEXT,
  last_seen_at    TEXT,
  disabled_at     TEXT,
  notes           TEXT                                -- internal, never shown to the user
);

-- Plans: which modules a firm gets and the limits. Prices are informative until online payment is added.
CREATE TABLE IF NOT EXISTS plans (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  modules         TEXT NOT NULL,                      -- comma list: localizare, analize, …
  price_month     REAL,                               -- per seat, without VAT
  currency        TEXT NOT NULL DEFAULT 'RON',
  limits          TEXT,                               -- JSON, e.g. {"exports_day": 50}
  active          INTEGER NOT NULL DEFAULT 1,
  sort            INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO plans (id, name, modules, price_month, sort) VALUES
  ('trial', 'Probă', 'localizare', 0, 1),
  ('standard', 'Standard', 'localizare', NULL, 2);

-- Firms of valuers (a self-employed valuer is a firm with one seat). The subscription belongs to the firm.
CREATE TABLE IF NOT EXISTS orgs (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  cui             TEXT,
  city            TEXT,
  status          TEXT NOT NULL DEFAULT 'active',     -- active | suspended
  plan_id         TEXT NOT NULL DEFAULT 'trial' REFERENCES plans(id),
  seats           INTEGER NOT NULL DEFAULT 1,
  valid_until     TEXT,                               -- YYYY-MM-DD, last day of access; empty = no end date
  billing_email   TEXT,
  notes           TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  org_id          TEXT NOT NULL REFERENCES orgs(id),
  user_id         TEXT NOT NULL REFERENCES users(id),
  role            TEXT NOT NULL DEFAULT 'member',     -- owner | admin | member
  status          TEXT NOT NULL DEFAULT 'active',     -- active | removed
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  removed_at      TEXT,
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id, status);

-- Invitations into a firm (they take a seat until accepted or cancelled).
CREATE TABLE IF NOT EXISTS invites (
  id              TEXT PRIMARY KEY,
  org_id          TEXT REFERENCES orgs(id),           -- empty for a VALUEFY super-admin invitation
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'member',
  token_hash      TEXT NOT NULL UNIQUE,
  invited_by      TEXT REFERENCES users(id),
  expires_at      TEXT NOT NULL,
  accepted_at     TEXT,
  cancelled_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_invites_org ON invites(org_id, accepted_at, cancelled_at);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);

-- Sign-in by email: 6-digit code + one-time link.
CREATE TABLE IF NOT EXISTS auth_codes (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL,
  code_hash       TEXT NOT NULL,
  token_hash      TEXT NOT NULL UNIQUE,
  attempts        INTEGER NOT NULL DEFAULT 0,
  expires_at      TEXT NOT NULL,
  used_at         TEXT,
  ip              TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_codes(email, created_at);

-- Sessions (one per device). The user can see and close them; a disabled account loses all of them.
CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  token_hash      TEXT NOT NULL UNIQUE,
  user_id         TEXT NOT NULL REFERENCES users(id),
  org_id          TEXT REFERENCES orgs(id),           -- firm the user works in now (several firms are possible)
  ip              TEXT,
  country         TEXT,
  city            TEXT,
  user_agent      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at    TEXT,
  expires_at      TEXT NOT NULL,
  revoked_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, revoked_at);

-- Usage tracking: what each user does in each module (searches, parcels opened, exports, GPS…).
CREATE TABLE IF NOT EXISTS events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  user_id         TEXT,
  org_id          TEXT,
  session_id      TEXT,
  module          TEXT NOT NULL,                      -- auth | localizare | admin | …
  action          TEXT NOT NULL,                      -- e.g. uat_open, search, parcel, export_pdf, gps_start
  target          TEXT,                               -- e.g. UAT key, cadastral number
  meta            TEXT                                -- JSON, small
);
CREATE INDEX IF NOT EXISTS idx_events_at ON events(at);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id, at);
CREATE INDEX IF NOT EXISTS idx_events_org ON events(org_id, at);
CREATE INDEX IF NOT EXISTS idx_events_action ON events(module, action, at);

-- Changes made by administrators (who invited, disabled, changed a plan…).
CREATE TABLE IF NOT EXISTS audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_id        TEXT,
  action          TEXT NOT NULL,
  entity          TEXT,
  entity_id       TEXT,
  details         TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id, at);
