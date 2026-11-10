-- What the firm's app knows about the property (from the integration API): [{label, value, keys}], shown at the inspection;
-- the sheet's questions that ask the same are pre-filled with it.
ALTER TABLE inspections ADD COLUMN facts TEXT;
