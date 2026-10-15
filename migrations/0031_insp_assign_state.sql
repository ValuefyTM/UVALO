-- Birou: an inspection given to a colaborator asociat is first a request (assign_state = 'pending'): they accept it
-- (NULL = accepted / no request needed) or decline it ('declined', the inspection goes back to the office without anyone).
-- Angajații asociați and the office's evaluators get it directly.
ALTER TABLE inspections ADD COLUMN assign_state TEXT;
