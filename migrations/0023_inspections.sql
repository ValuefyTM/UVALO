-- Inspecții (module `inspectii`, in test: super-admins only). Prepared on the web, done on the phone (UVALO app), seen on the web.
-- Templates: UVALO defaults live in code (src/lib/insp-shared.ts); the ones here belong to a firm (shared, can be enforced) or
-- to a person. An inspection keeps a snapshot of the template version it was made with.
CREATE TABLE IF NOT EXISTS insp_templates (
  id                TEXT PRIMARY KEY,
  owner_type        TEXT NOT NULL,                     -- org | user
  owner_id          TEXT NOT NULL,
  name              TEXT NOT NULL,
  prop_type         TEXT,
  draft             TEXT NOT NULL,                     -- JSON: groups with questions (being edited)
  published         TEXT,                              -- JSON: the last published version
  version           INTEGER NOT NULL DEFAULT 0,        -- published version (0 = never published)
  enforced          INTEGER NOT NULL DEFAULT 0,        -- firm template every member must use
  created_by        TEXT NOT NULL REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_insp_templates_owner ON insp_templates(owner_type, owner_id);

CREATE TABLE IF NOT EXISTS inspections (
  id                TEXT PRIMARY KEY,
  code              TEXT NOT NULL,                     -- INS-2026-0001
  created_by        TEXT NOT NULL REFERENCES users(id),  -- whose work it is
  org_id            TEXT,
  assignee_id       TEXT REFERENCES users(id),         -- who does it on the phone
  assignee_kind     TEXT NOT NULL DEFAULT 'me',        -- me | office | collab
  status            TEXT NOT NULL DEFAULT 'prog',      -- prog | plan | lucru | gata | pred
  address           TEXT NOT NULL,
  cad_nr            TEXT,
  cf_nr             TEXT,
  uat               TEXT,
  county            TEXT,
  lat               REAL,
  lng               REAL,
  prop_type         TEXT,
  area_util         REAL,
  area_land         REAL,
  rooms             TEXT,                              -- JSON [{n, a}] from the floor plan (releveu) or typed
  template_id       TEXT,                              -- uvalo:<key> or insp_templates.id
  template_name     TEXT,
  template_version  INTEGER,
  template          TEXT,                              -- JSON snapshot of the template used
  contact_name      TEXT,
  contact_phone     TEXT,
  contact_role      TEXT,
  scheduled_at      TEXT,                              -- local time, 'YYYY-MM-DDTHH:MM'
  duration_min      INTEGER NOT NULL DEFAULT 60,
  answers           TEXT,                              -- JSON {questionId: value}
  room_answers      TEXT,                              -- JSON [{n, a, floor, walls, state}]
  findings          TEXT,                              -- JSON {diff, defects, notes}
  started_at        TEXT,
  finished_at       TEXT,
  signed_name       TEXT,
  signed_at         TEXT,
  notes             TEXT,
  test              INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_inspections_owner ON inspections(created_by, status);
CREATE INDEX IF NOT EXISTS idx_inspections_assignee ON inspections(assignee_id, status);

-- Photos and documents: the files go to R2 (bucket to be bound), here only their data.
CREATE TABLE IF NOT EXISTS insp_files (
  id                TEXT PRIMARY KEY,
  inspection_id     TEXT NOT NULL REFERENCES inspections(id),
  kind              TEXT NOT NULL,                     -- photo | cf | releveu | doc | signature
  name              TEXT,
  room              TEXT,
  r2_key            TEXT,
  taken_at          TEXT,
  lat               REAL,
  lng               REAL,
  in_annex          INTEGER NOT NULL DEFAULT 1,
  is_cover          INTEGER NOT NULL DEFAULT 0,
  meta              TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_insp_files ON insp_files(inspection_id, kind);

CREATE TABLE IF NOT EXISTS insp_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id     TEXT NOT NULL REFERENCES inspections(id),
  user_id           TEXT,
  at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  text              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_insp_log ON insp_log(inspection_id, at);

-- The phone app: a person's connected phones and the short codes that connect them (the module needs one).
CREATE TABLE IF NOT EXISTS insp_devices (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  name              TEXT,
  platform          TEXT,
  token_hash        TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at      TEXT,
  revoked_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_insp_devices_user ON insp_devices(user_id);
CREATE TABLE IF NOT EXISTS insp_pair_codes (
  code_hash         TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  expires_at        TEXT NOT NULL
);
