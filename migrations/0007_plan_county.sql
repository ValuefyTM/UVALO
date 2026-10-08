-- The county of an uploaded plan (the locator groups the UATs by county).
ALTER TABLE plan_uploads ADD COLUMN county TEXT;
