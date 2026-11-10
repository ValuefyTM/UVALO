-- Birou → asocieri: an angajat asociat can be made administrator of the office's inspections (sees and manages all the firm's
-- inspections, like the office's administrators). Without it, an associate sees only the inspections given to them.
ALTER TABLE office_links ADD COLUMN admin INTEGER NOT NULL DEFAULT 0;
