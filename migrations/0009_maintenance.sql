-- Platform settings changed from the admin panel. "maintenance": while on, people see the maintenance page
-- (/mentenanta) instead of the platform; UVALO administrators keep full access. Turned on with this migration
-- (rebranding to UVALO), turned off from Admin → Panou.
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,                    -- JSON
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES
  ('maintenance', '{"on":true,"message":"Pregătim noua platformă UVALO. Revenim în curând."}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
