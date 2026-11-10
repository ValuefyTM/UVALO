-- Inspecții sent back to complete: when the sheet had been finished (shown on the phone) and whether the saved signature stays
-- (1) or the person present signs again (0).
ALTER TABLE inspections ADD COLUMN redo_prev_at TEXT;
ALTER TABLE inspections ADD COLUMN redo_keep_sig INTEGER NOT NULL DEFAULT 0;
