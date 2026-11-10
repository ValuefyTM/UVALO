-- Per-member access inside a firm: the tools this member may use, a comma-separated list of module keys
-- (localizare, amplasament, comparabile, word, chrome, inspectii, colaborari). NULL = everything the firm's plan gives.
-- Applies to members only; owners and administrators always have the whole plan.
ALTER TABLE memberships ADD COLUMN modules TEXT;
