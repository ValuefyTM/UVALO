-- OAuth 2.1 for the MCP server (/api/mcp): Claude (claude.ai, Desktop, Code) registers itself as a client, the person signs in
-- to UVALO and allows it, and the tokens act for that person (their own plan and modules). Codes are single-use (PKCE S256).
CREATE TABLE IF NOT EXISTS oauth_clients (
  id              TEXT PRIMARY KEY,
  name            TEXT,
  redirect_uris   TEXT NOT NULL,                        -- JSON array
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS oauth_codes (
  code_hash       TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  user_id         TEXT NOT NULL REFERENCES users(id),
  redirect_uri    TEXT NOT NULL,
  challenge       TEXT,                                 -- PKCE code_challenge (S256)
  scope           TEXT,
  expires_at      TEXT NOT NULL,
  used_at         TEXT
);
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id              TEXT PRIMARY KEY,
  token_hash      TEXT NOT NULL UNIQUE,
  refresh_hash    TEXT UNIQUE,
  client_id       TEXT NOT NULL,
  client_name     TEXT,
  user_id         TEXT NOT NULL REFERENCES users(id),
  scope           TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at      TEXT NOT NULL,
  refresh_expires_at TEXT,
  last_used_at    TEXT,
  revoked_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(user_id);
