-- "Birou de evaluare": the administration turns it on for chosen accounts (users.office_allowed); they activate it from
-- "Contul meu" with the office details (name, corporate member + authorization number, description, logo) and then
-- manage the office's people in "Firma mea" (colleagues may be people without an ANEVAR card).
ALTER TABLE users ADD COLUMN office_allowed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orgs ADD COLUMN corporate INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orgs ADD COLUMN corp_no TEXT;
ALTER TABLE orgs ADD COLUMN description TEXT;
ALTER TABLE orgs ADD COLUMN logo TEXT;          -- small image as a data URL, served by /api/org/logo/<id>
ALTER TABLE orgs ADD COLUMN office_at TEXT;     -- when the office function was activated
