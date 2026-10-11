-- UVALO pentru Word (Anexă foto, Anexă documente) is included in every plan.
UPDATE plans SET modules = modules || ',word'
WHERE ',' || REPLACE(modules, ' ', '') || ',' NOT LIKE '%,word,%';
