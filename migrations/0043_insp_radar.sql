-- Visibility of an inspection on the colleagues' radar (phone app): yes (everyone with the radar), no, collab (only collaborators — until
-- collaborators are defined, nobody else sees it).
ALTER TABLE inspections ADD COLUMN radar TEXT NOT NULL DEFAULT 'yes';
