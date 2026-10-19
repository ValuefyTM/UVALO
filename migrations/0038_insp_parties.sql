-- Sent by the firm's software with an inspection (not asked in UVALO's own forms): the client of the work and the
-- user of the report (e.g. the bank), shown to the valuer and on the sheet.
ALTER TABLE inspections ADD COLUMN ext_client TEXT;
ALTER TABLE inspections ADD COLUMN ext_user TEXT;
