-- Public contact details of ANEVAR members, as published on anevar.ro (public search; shown there only for members who
-- agreed to it). Only in the administration, marked as public data with their source and date. The data itself is
-- imported straight into the database, never committed: the repository is public.
ALTER TABLE anevar_members ADD COLUMN pub_address TEXT;
ALTER TABLE anevar_members ADD COLUMN pub_phone TEXT;
ALTER TABLE anevar_members ADD COLUMN pub_fax TEXT;
ALTER TABLE anevar_members ADD COLUMN pub_email TEXT;
ALTER TABLE anevar_members ADD COLUMN pub_website TEXT;
ALTER TABLE anevar_members ADD COLUMN contact_source TEXT;    -- e.g. anevar.ro
ALTER TABLE anevar_members ADD COLUMN contact_date TEXT;      -- when the details were taken from the source
