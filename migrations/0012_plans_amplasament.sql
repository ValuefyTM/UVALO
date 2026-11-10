-- The site analysis (/amplasament) is included in every plan.
UPDATE plans SET modules = modules || ',amplasament'
WHERE ',' || REPLACE(modules, ' ', '') || ',' NOT LIKE '%,amplasament,%';
