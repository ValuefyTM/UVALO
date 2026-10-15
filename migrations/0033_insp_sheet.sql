-- The inspection sheet (fișa) as a record of the property: a number and a date when it starts being filled in.
-- It can be deleted from the property (the property, contact and documents stay) and the inspection given again to someone.
ALTER TABLE inspections ADD COLUMN sheet_no TEXT;          -- FI-2026-0001, given at the first answer on the phone
ALTER TABLE inspections ADD COLUMN sheet_at TEXT;          -- when the sheet started being filled in
ALTER TABLE inspections ADD COLUMN sheet_rev INTEGER NOT NULL DEFAULT 0; -- +1 at each deletion: a phone draft of the old sheet is refused

-- Every sheet that got a number (numbering per year, never reused) and, for deleted ones, a copy of what it held.
CREATE TABLE IF NOT EXISTS insp_sheets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id TEXT NOT NULL,
  no            TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  assignee_id   TEXT,
  deleted_at    TEXT,
  deleted_by    TEXT,
  reason        TEXT,
  snapshot      TEXT,                                     -- JSON: answers, rooms, findings, signature, status at deletion
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_insp_sheets_insp ON insp_sheets(inspection_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_insp_sheets_no ON insp_sheets(no);
