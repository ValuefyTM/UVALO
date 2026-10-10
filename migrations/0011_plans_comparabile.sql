-- The comparables locator (/comparabile) is included in every plan.
UPDATE plans SET modules = modules || ',comparabile'
WHERE ',' || REPLACE(modules, ' ', '') || ',' NOT LIKE '%,comparabile,%';
