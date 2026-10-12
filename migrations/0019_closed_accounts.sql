-- Accounts closed by the person ("Contul meu" → "Închide contul"): status 'closed', kept with sessions and history,
-- listed in Admin → Utilizatori as "Au renunțat". The account becomes active again if the person asks for one again.
ALTER TABLE users ADD COLUMN closed_at TEXT;
ALTER TABLE users ADD COLUMN close_reason TEXT;
