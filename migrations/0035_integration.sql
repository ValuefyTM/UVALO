-- Integration API (a firm's own software, e.g. its CRM): the firm creates a key in "Firma mea"; with it the software sends
-- inspections to the firm's valuers (found by their ANEVAR card), keeps the firm's sheets in sync and reads the finished sheets.
-- Changes on such an inspection are posted to the firm's webhook (signed with the webhook secret).
CREATE TABLE IF NOT EXISTS api_keys (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL,
  name            TEXT NOT NULL,
  prefix          TEXT NOT NULL,                       -- the first characters, shown in the list (uvk_ab12…)
  key_hash        TEXT NOT NULL UNIQUE,                -- sha256 of the key; the key itself is shown once
  webhook_url     TEXT,
  webhook_secret  TEXT,                                -- signs the webhook calls (HMAC-SHA256)
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at    TEXT,
  revoked_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id);

-- The other software's id of the inspection / sheet (unique per firm): created again with the same id = updated.
ALTER TABLE inspections ADD COLUMN ext_ref TEXT;
CREATE INDEX IF NOT EXISTS idx_inspections_ext ON inspections(org_id, ext_ref);
ALTER TABLE insp_templates ADD COLUMN ext_ref TEXT;
CREATE INDEX IF NOT EXISTS idx_insp_templates_ext ON insp_templates(owner_id, ext_ref);

-- Webhook calls, the last ones per key (what was sent and how it went), for the panel.
CREATE TABLE IF NOT EXISTS api_hooks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  key_id          TEXT NOT NULL,
  inspection_id   TEXT,
  event           TEXT NOT NULL,
  status          INTEGER,                             -- HTTP status of the answer (NULL = no answer)
  error           TEXT,
  at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_api_hooks_key ON api_hooks(key_id, at);
