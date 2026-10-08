-- Cadastral plans uploaded from the admin panel (ANCPI DXF exports): converted on GitHub Actions into a branch,
-- published (merged into main + deploy) or discarded by a VALUEFY administrator.
CREATE TABLE IF NOT EXISTS plan_uploads (
  id TEXT PRIMARY KEY,
  uat_key TEXT NOT NULL,
  uat_name TEXT NOT NULL,
  new_uat INTEGER NOT NULL DEFAULT 0,
  file_name TEXT NOT NULL,
  size INTEGER NOT NULL,          -- the DXF, before compression
  plan_date TEXT,                 -- from the layer name T_A1S1_<UAT>_<date>
  asset_id INTEGER,               -- the compressed file, attached to the draft release "plan-uploads"
  status TEXT NOT NULL,           -- converting | ready | publishing | published | failed | discarded
  summary TEXT,
  error TEXT,
  run_url TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS plan_uploads_created ON plan_uploads (created_at);
CREATE INDEX IF NOT EXISTS plan_uploads_key ON plan_uploads (uat_key, status);
