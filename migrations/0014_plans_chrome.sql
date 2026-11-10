-- UVALO pentru Chrome (capturi de anunțuri pentru comparabile) is included in every plan.
UPDATE plans SET modules = modules || ',chrome'
WHERE ',' || REPLACE(modules, ' ', '') || ',' NOT LIKE '%,chrome,%';
