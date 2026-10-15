-- Inspecții: the sheet's profile photo (one of its photos) and the public share link (a random token; NULL = not shared).
ALTER TABLE inspections ADD COLUMN cover_file_id TEXT;
ALTER TABLE inspections ADD COLUMN share_token TEXT;
ALTER TABLE inspections ADD COLUMN share_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_insp_share ON inspections(share_token) WHERE share_token IS NOT NULL;
