-- Inspecții: a finished inspection sent back to the phone to complete details ("Retrimite pe telefon"): what to complete and when.
ALTER TABLE inspections ADD COLUMN redo_note TEXT;
ALTER TABLE inspections ADD COLUMN redo_at TEXT;
