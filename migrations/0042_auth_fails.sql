-- Failed sign-in attempts (email codes, phone pairing codes), to limit guessing across codes and accounts.
-- key: "code:<email>" (wrong email codes for an account), "codeip:<ip>", "pair:<ip>", "pair:*" (all wrong pairing codes).
CREATE TABLE IF NOT EXISTS auth_fails (
  key TEXT NOT NULL,
  at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_fails_key_at ON auth_fails (key, at);
