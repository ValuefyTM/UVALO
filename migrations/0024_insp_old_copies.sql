-- Inspecții (test): the personal copies of the first UVALO sheets (before the VALUEFY structure, 15 oct 2026) are removed
-- at the owner's request. Soft delete: inspections made with them keep their own snapshot of the sheet.
UPDATE insp_templates SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE deleted_at IS NULL AND owner_type = 'user' AND draft LIKE '%Concordan%' AND draft LIKE '%"ident"%';
