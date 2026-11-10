-- Birou de evaluare: the office lets its associated employees (office_links kind = angajat) create inspections for the firm
-- from the phone ("Pentru: Contul meu / Firma X"). Off by default: the firm assigns the work.
ALTER TABLE orgs ADD COLUMN staff_create INTEGER NOT NULL DEFAULT 0;
